import { equalSecret, incomingMessages, validSignature } from "@/lib/whatsapp";
import { enqueue, openWhatsAppStore } from "@/lib/whatsapp-store";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new Response("Verification not configured", { status: 503 });
  const q = new URL(req.url).searchParams, challenge = q.get("hub.challenge");
  if (q.get("hub.mode") !== "subscribe" || !equalSecret(q.get("hub.verify_token") ?? "", token) || !challenge || !/^\d{1,128}$/.test(challenge)) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET, account = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !account || !phone) return new Response("WhatsApp not configured", { status: 503 });
  const reader = req.body?.getReader(); if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 1024 * 1024) { await reader.cancel(); return new Response("Payload too large", { status: 413 }); }
      chunks.push(value);
    }
  } catch { return new Response("Invalid body", { status: 400 }); }
  const raw = Buffer.concat(chunks);
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("Forbidden", { status: 403 });
  let messages;
  try { messages = incomingMessages(JSON.parse(raw.toString("utf8")), account, phone); }
  catch { return new Response("Invalid event", { status: 400 }); }
  if (messages.length) {
    try { const db = openWhatsAppStore(); try { enqueue(db, messages); } finally { db.close(); } }
    catch { return new Response("Persistent inbox unavailable", { status: 503 }); }
  }
  return Response.json({ ok: true });
}
