import { createHmac, timingSafeEqual } from "node:crypto";

export interface WhatsAppMessage {
  id: string; from: string; timestamp: number; type: string;
  text?: string; mediaId?: string;
  location?: { latitude: number; longitude: number };
}
export function equalSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function validSignature(raw: Buffer, signature: string | null, secret: string): boolean {
  return !!secret && !!signature && /^sha256=[a-f0-9]{64}$/.test(signature) &&
    equalSecret(signature, `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
}
export function incomingMessages(payload: unknown, account: string, phone: string): WhatsAppMessage[] {
  const p = payload as { object?: string; entry?: Array<{ id: string; changes: Array<{ field: string; value: { metadata?: { phone_number_id: string }; messages?: Array<Record<string, any>> } }> }> };
  if (!p || p.object !== "whatsapp_business_account" || !Array.isArray(p.entry)) throw new Error("Invalid event");
  const result: WhatsAppMessage[] = [];
  for (const entry of p.entry) {
    if (entry?.id !== account) continue;
    if (!Array.isArray(entry.changes)) throw new Error("Invalid changes");
    for (const change of entry.changes) {
      const v = change?.value;
      if (change.field !== "messages" || v?.metadata?.phone_number_id !== phone || !v.messages) continue;
      if (!Array.isArray(v.messages)) throw new Error("Invalid messages");
      for (const m of v.messages) {
        const timestamp = Number(m.timestamp);
        if (typeof m.id !== "string" || !m.id || m.id.length > 512 || typeof m.from !== "string" || !/^\d{7,15}$/.test(m.from) || !Number.isFinite(timestamp) || timestamp <= 0 || typeof m.type !== "string") throw new Error("Invalid message");
        const item: WhatsAppMessage = { id: m.id, from: m.from, timestamp, type: m.type };
        if (m.type === "text") {
          if (typeof m.text?.body !== "string") throw new Error("Invalid text");
          item.text = m.text.body.slice(0, 4096);
        } else if (m.type === "image") {
          if (typeof m.image?.id !== "string" || !/^\d+$/.test(m.image.id)) throw new Error("Invalid media ID");
          item.mediaId = m.image.id;
        } else if (m.type === "location") {
          const { latitude, longitude } = m.location ?? {};
          if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid location");
          item.location = { latitude, longitude };
        }
        result.push(item);
      }
    }
  }
  return result;
}
function metaConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, phone = process.env.WHATSAPP_PHONE_NUMBER_ID, version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^\d+$/.test(phone ?? "") || !/^v\d+\.\d+$/.test(version ?? "")) throw new Error("Meta configuration is missing");
  return { token, phone, base: `https://graph.facebook.com/${version}` };
}
export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const { token, phone, base } = metaConfig();
  const r = await fetch(`${base}/${phone}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4096), preview_url: false } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Meta sending failed (HTTP ${r.status})`);
  const p = await r.json();
  if (typeof p.messages?.[0]?.id !== "string") throw new Error("Missing Meta message ID");
  return p.messages[0].id;
}
export async function downloadWhatsAppImage(id: string): Promise<Blob> {
  if (!/^\d+$/.test(id)) throw new Error("Invalid media ID");
  const { token, base } = metaConfig();
  const headers = { Authorization: `Bearer ${token}` };
  const info = await fetch(`${base}/${id}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!info.ok) throw new Error("Image metadata unavailable");
  const media = await info.json();
  const url = new URL(media.url);
  if (url.protocol !== "https:" || !(url.hostname === "lookaside.fbsbx.com" || url.hostname === "lookaside.facebook.com")) throw new Error("Unexpected media host");
  if (!["image/jpeg", "image/png"].includes(media.mime_type) || media.file_size > 5 * 1024 * 1024) throw new Error("Send a JPEG or PNG image smaller than 5 MB");
  const r = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!r.ok || !r.body) throw new Error("Image download unavailable");
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = r.body.getReader();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new Error("Image too large"); }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks);
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new Error("Invalid image bytes");
  return new Blob([new Uint8Array(data)], { type: png ? "image/png" : "image/jpeg" });
}
