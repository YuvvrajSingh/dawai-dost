import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { Engine } from "../src/lib/engine";
import { openWhatsAppStore } from "../src/lib/whatsapp-store";
import { botReply, type BotSession } from "../src/lib/whatsapp-bot";
import { downloadWhatsAppImage, sendWhatsAppText, type WhatsAppMessage } from "../src/lib/whatsapp";
import { readStrip } from "../src/lib/strip-reader";
import { locateKendras } from "../src/lib/kendra-locator";

async function main() {
  loadEnvConfig(process.cwd());
  if (process.env.WHATSAPP_BOT_ENABLED !== "true") throw new Error("Set WHATSAPP_BOT_ENABLED=true after configuring the private pilot and assessing policy eligibility");
  const contact = process.env.WHATSAPP_SUPPORT_CONTACT;
  const privacy = process.env.WHATSAPP_PRIVACY_URL;
  if (!contact || !privacy || new URL(privacy).protocol !== "https:") throw new Error("Configure a human support contact and HTTPS privacy policy URL");
  if (!process.env.GEMINI_API_KEY || !process.env.WHATSAPP_ACCESS_TOKEN || !/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION ?? "") || !/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "")) throw new Error("Configure Gemini and Meta sending credentials first");
  const db = openWhatsAppStore();
  const engine = new Engine(JSON.parse(gunzipSync(readFileSync(join(process.cwd(), "data/catalog.json.gz"))).toString("utf8")));
  // One worker per DB. Lease exceeds bounded external request times.
  const acquired = db.prepare("INSERT INTO worker_lock(id,until) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET until=excluded.until WHERE worker_lock.until<?").run(Date.now() + 300000, Date.now());
  if (!acquired.changes) { db.close(); throw new Error("Another WhatsApp worker is running"); }
  let running = true;
  process.on("SIGINT", () => { running = false; });
  process.on("SIGTERM", () => { running = false; });
  const once = process.argv.includes("--once");
  try {
    // A prior crash may have happened after Meta accepted a send. Never resend blindly.
    db.prepare("UPDATE events SET state='uncertain',payload=NULL WHERE state IN ('processing','sending')").run();
    console.log("WhatsApp worker ready. Medicine images are processed only after user consent.");
    do {
      db.prepare("UPDATE worker_lock SET until=? WHERE id=1").run(Date.now() + 300000);
      db.prepare("DELETE FROM events WHERE created<?").run(Date.now() - 7 * 86400000);
      db.prepare("UPDATE events SET payload=NULL,state='expired' WHERE created<? AND state='pending'").run(Date.now() - 86400000);
      db.prepare("DELETE FROM sessions WHERE updated<? AND json_extract(data,'$.stopped') IS NOT 1").run(Date.now() - 86400000);
      const row = db.prepare("SELECT id,payload FROM events WHERE state='pending' ORDER BY created,rowid LIMIT 1").get() as { id: string; payload: string } | undefined;
      if (!row) { if (once) break; await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
      db.prepare("UPDATE events SET state='processing' WHERE id=?").run(row.id);
      const message = JSON.parse(row.payload) as WhatsAppMessage;
      const old = db.prepare("SELECT data FROM sessions WHERE sender=?").get(message.from) as { data: string } | undefined;
      const state: BotSession = old ? JSON.parse(old.data) : {};
      if (message.timestamp * 1000 < Date.now() - 23 * 3600000 || message.timestamp * 1000 > Date.now() + 300000) {
        db.prepare("UPDATE events SET state='expired',payload=NULL WHERE id=?").run(row.id); continue;
      }
      let result;
      try {
        result = await botReply(message, state, { readImage: async id => readStrip(await downloadWhatsAppImage(id)), compare: q => engine.compareComposition(q), centers: locateKendras, support: contact });
      } catch {
        // Never present a demo result or an inferred composition after an upstream failure.
        result = { state, text: `I could not process that request. Please send a clearer strip photo or try again. For human support: ${contact}` };
      }
      if ((message.text ?? "").trim().toUpperCase() === "DELETE") db.prepare("UPDATE events SET payload=NULL,outgoing=NULL,state=CASE WHEN state='pending' THEN 'deleted' ELSE state END WHERE sender=?").run(message.from);
      if (!state.consent && !result.state.stopped) result.text = `${result.text ?? ""}\nPrivacy: ${privacy}`;
      db.prepare("INSERT INTO sessions(sender,data,updated) VALUES(?,?,?) ON CONFLICT(sender) DO UPDATE SET data=excluded.data,updated=excluded.updated")
        .run(message.from, JSON.stringify(result.state), Date.now());
      if (!result.text) { db.prepare("UPDATE events SET state='completed',payload=NULL WHERE id=?").run(row.id); continue; }
      db.prepare("UPDATE events SET state='sending',payload=NULL WHERE id=?").run(row.id);
      try {
        const id = await sendWhatsAppText(message.from, result.text);
        db.prepare("UPDATE events SET state='completed',outgoing=? WHERE id=?").run(id, row.id);
      } catch {
        db.prepare("UPDATE events SET state='uncertain' WHERE id=?").run(row.id);
        console.error("A Meta send failed or its outcome is uncertain. Inspect event states; automatic resend is disabled.");
      }
    } while (running);
  } finally { db.prepare("DELETE FROM worker_lock WHERE id=1").run(); db.close(); }
}
main().catch(() => { console.error("WhatsApp worker stopped. Check required configuration, persistent DB access, and that only one worker runs."); process.exitCode = 1; });
