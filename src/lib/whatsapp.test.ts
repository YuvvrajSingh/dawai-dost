import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Engine } from "./engine";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { incomingMessages, validSignature, type WhatsAppMessage } from "./whatsapp";
import { botReply, parseIngredients, formatComparison, type BotServices } from "./whatsapp-bot";
import { enqueue, openWhatsAppStore } from "./whatsapp-store";
import type { OcrResult, Comparison } from "./types";
import { GET, POST } from "../app/api/whatsapp/webhook/route";
import { locateKendras } from "./kendra-locator";

const message = (text: string): WhatsAppMessage => ({ id: "m1", from: "919999999999", timestamp: Date.now() / 1000, type: "text", text });
const reading: OcrResult = {
  name: { value: "Example", confidence: "low" }, manufacturer: { value: null, confidence: "missing" },
  ingredients: { value: [{ salt: "Metformin", strength: 500, unit: "mg" }], confidence: "medium" },
  form: { value: "tablet", confidence: "high" }, release: { value: null, confidence: "missing" },
  packSize: { value: null, confidence: "missing" }, mrp: { value: null, confidence: "missing" }, rawText: "test", engine: "gemini",
};
const services: BotServices = { readImage: async () => reading, compare: () => null, centers: async () => "verified test response", support: "support@example.test" };
test("signatures reject altered raw bytes, missing headers and malformed hashes", () => {
  const raw = Buffer.from('{"a":1}'), secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(validSignature(raw, signature, secret), true);
  assert.equal(validSignature(Buffer.from('{"a":2}'), signature, secret), false);
  assert.equal(validSignature(raw, null, secret), false);
  assert.equal(validSignature(raw, "sha256=x", secret), false);
});
test("webhooks reject other accounts/numbers and status-only events do not reply", () => {
  const make = (id: string, phone: string, value: object) => ({ object: "whatsapp_business_account", entry: [{ id, changes: [{ field: "messages", value: { metadata: { phone_number_id: phone }, ...value } }] }] });
  assert.equal(incomingMessages(make("a", "p", { messages: [{ ...message("hi"), text: { body: "hi" } }] }), "a", "p").length, 1);
  assert.deepEqual(incomingMessages(make("other", "p", {}), "a", "p"), []);
  assert.deepEqual(incomingMessages(make("a", "other", {}), "a", "p"), []);
  assert.deepEqual(incomingMessages(make("a", "p", { statuses: [] }), "a", "p"), []);
  assert.throws(() => incomingMessages(make("a", "p", { messages: [{ ...message("hi"), from: {} }] }), "a", "p"));
  assert.throws(() => incomingMessages(make("a", "p", { messages: [{ ...message("hi"), type: "location", location: { latitude: NaN, longitude: 0 } }] }), "a", "p"));
});
test("medicine photos require consent before OCR", async () => {
  let calls = 0;
  const r = await botReply({ ...message(""), type: "image", mediaId: "123" }, {}, { ...services, readImage: async () => { calls++; return reading; } });
  assert.equal(calls, 0); assert.match(r.text!, /AGREE/);
});
test("photo asks for missing release, then confirmation before matching", async () => {
  let comparisons = 0;
  const deps = { ...services, compare: () => { comparisons++; return null; } };
  let r = await botReply({ ...message(""), type: "image", mediaId: "123" }, { consent: true }, deps);
  assert.equal(r.state.awaiting, "release"); assert.equal(comparisons, 0);
  r = await botReply(message("not sure"), r.state, deps);
  assert.equal(r.state.awaiting, "release"); assert.equal(comparisons, 0);
  r = await botReply(message("SR"), r.state, deps);
  assert.equal(r.state.awaiting, "confirm"); assert.match(r.text!, /sustained/); assert.equal(comparisons, 0);
  r = await botReply(message("YES"), r.state, deps);
  assert.equal(comparisons, 1); assert.equal(r.state.pending, undefined);
});
test("manual correction collects composition, form and release", async () => {
  let r = await botReply(message("EDIT"), { consent: true }, services);
  assert.equal(r.state.awaiting, "ingredients");
  r = await botReply(message("Metformin 500 mg + Glimepiride 1 mg"), r.state, services);
  assert.equal(r.state.awaiting, "form");
  r = await botReply(message("CAPSULE"), r.state, services);
  assert.equal(r.state.awaiting, "release");
  r = await botReply(message("IMMEDIATE"), r.state, services);
  assert.equal(r.state.awaiting, "confirm");
});
test("unclear concentrations cannot be parsed as tablet strength", () => {
  assert.equal(parseIngredients("Paracetamol 125 mg/5 ml"), null);
  assert.equal(parseIngredients("Metformin 0 mg"), null);
  assert.equal(parseIngredients("Metformin 500"), null);
});
test("STOP clears sensitive session and prevents further image work", async () => {
  const stopped = await botReply(message("STOP"), { consent: true, pending: { name: "private" } }, services);
  assert.deepEqual(stopped.state, { stopped: true });
  const r = await botReply({ ...message(""), type: "image", mediaId: "123" }, stopped.state, { ...services, readImage: async () => { throw new Error("must not run"); } });
  assert.equal(r.text, null);
});
test("location lookup preserves pending confirmation", async () => {
  const state = { consent: true, pending: { name: "Example" }, awaiting: "ingredients" as const };
  const r = await botReply({ ...message(""), type: "location", location: { latitude: 28.6, longitude: 77.2 } }, state, services);
  assert.equal(r.text, "verified test response"); assert.deepEqual(r.state, state);
});
test("no-match message never calls a different strength a substitute", () => {
  const c = { results: [{ status: "excluded", candidate: { market: "jan-aushadhi", name: "wrong strength" } }] } as unknown as Comparison;
  const text = formatComparison(c);
  assert.match(text, /No exact/); assert.doesNotMatch(text, /wrong strength/); assert.match(text, /not live prices or stock/);
});
test("confirmed strip composition produces Jan Aushadhi prices from the shipped catalog", async () => {
  const engine = new Engine(JSON.parse(gunzipSync(readFileSync(join(process.cwd(), "data/catalog.json.gz"))).toString("utf8")));
  const q = { ingredients: [{ salt: "Metformin", strength: 500, unit: "mg" as const }], form: "tablet" as const, release: "immediate" as const };
  const r = await botReply(message("YES"), { consent: true, pending: q, awaiting: "confirm" }, { ...services, compare: query => engine.compareComposition(query) });
  assert.match(r.text!, /Jan Aushadhi catalog entries matching/);
  assert.match(r.text!, /Listed MRP: INR/);
  assert.match(r.text!, /not live prices or stock/);
});
test("missing location API key returns real locator links without invented centers", async () => {
  const old = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    const text = await locateKendras(28.6, 77.2);
    assert.match(text, /janaushadhi.gov.in\/near-by-kendra/);
    assert.match(text, /google.com\/maps\/search/);
    assert.doesNotMatch(text, /About .* km/);
    await assert.rejects(() => locateKendras(NaN, 77.2));
  } finally { if (old === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = old; }
});
test("durable inbox deduplicates repeated Meta IDs across reopened connections", () => {
  const dir = mkdtempSync(join(tmpdir(), "dawai-whatsapp-test-"));
  const path = join(dir, "test.sqlite");
  try {
    let db = openWhatsAppStore(path);
    enqueue(db, [message("hi"), message("hi")]); db.close();
    db = openWhatsAppStore(path);
    try { enqueue(db, [message("hi")]); assert.equal((db.prepare("SELECT count(*) AS n FROM events").get() as { n: number }).n, 1); }
    finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("webhook handshake and unsigned POST fail closed", async () => {
  const previous = { token: process.env.WHATSAPP_VERIFY_TOKEN, secret: process.env.META_APP_SECRET, account: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, phone: process.env.WHATSAPP_PHONE_NUMBER_ID };
  process.env.WHATSAPP_VERIFY_TOKEN = "test-token"; process.env.META_APP_SECRET = "test-secret";
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "a"; process.env.WHATSAPP_PHONE_NUMBER_ID = "p";
  try {
    const good = await GET(new Request("https://example.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=123"));
    assert.equal(good.status, 200); assert.equal(await good.text(), "123");
    assert.equal((await GET(new Request("https://example.test/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"))).status, 403);
    assert.equal((await POST(new Request("https://example.test/", { method: "POST", body: "{}" }))).status, 403);
  } finally {
    for (const [key, value] of Object.entries({ WHATSAPP_VERIFY_TOKEN: previous.token, META_APP_SECRET: previous.secret, WHATSAPP_BUSINESS_ACCOUNT_ID: previous.account, WHATSAPP_PHONE_NUMBER_ID: previous.phone })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
