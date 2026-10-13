import type { CompositionQuery, OcrIngredient, OcrResult, Comparison } from "./types";
import type { WhatsAppMessage } from "./whatsapp";

export interface BotSession {
  consent?: boolean; stopped?: boolean;
  pending?: Partial<CompositionQuery>;
  awaiting?: "ingredients" | "form" | "release" | "confirm";
}
export interface BotServices {
  readImage(id: string): Promise<OcrResult>;
  compare(q: CompositionQuery): Comparison | null;
  centers(lat: number, lng: number): Promise<string>;
  support: string;
}
export function parseIngredients(text: string): OcrIngredient[] | null {
  const parts = text.split("+");
  if (!parts.length || parts.length > 6) return null;
  const items: OcrIngredient[] = [];
  for (const part of parts) {
    const m = /^\s*([a-zA-Z][a-zA-Z ()-]{1,149}?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu)\s*$/i.exec(part);
    if (!m || Number(m[2]) <= 0 || Number(m[2]) > 1000000) return null;
    items.push({ salt: m[1].trim(), strength: Number(m[2]), unit: (m[3].toLowerCase() === "iu" ? "IU" : m[3].toLowerCase()) as OcrIngredient["unit"] });
  }
  return items;
}
function nextQuestion(s: BotSession): string {
  const q = s.pending!;
  if (!q.ingredients?.length) { s.awaiting = "ingredients"; return "What salts and strengths are printed? Type each one, for example: Metformin 500 mg + Glimepiride 1 mg. Copy every ingredient. If unclear, send a sharper photo."; }
  if (!q.form) { s.awaiting = "form"; return "Is it a tablet or capsule? Reply TABLET or CAPSULE. This first version cannot compare liquids or injections safely."; }
  if (!q.release) { s.awaiting = "release"; return "What release type is printed? Reply SR (sustained), ER/XR/CR (extended), DR (delayed), or IMMEDIATE only if confirmed. If you cannot tell, ask your pharmacist or send a clearer photo; I will not assume it."; }
  s.awaiting = "confirm";
  return `Please check against the strip:\n${q.ingredients.map(i => `${i.salt} ${i.strength} ${i.unit}`).join(" + ")}\nForm: ${q.form}\nRelease: ${q.release}\nReply YES if every detail is correct. Reply EDIT to enter the details again, or send a new image.`;
}
export function formatComparison(c: Comparison | null): string {
  if (!c) return "I could not compare these confirmed details. Please check the label with your pharmacist.";
  const exact = c.results.filter(r => r.candidate.market === "jan-aushadhi" && r.status === "match").slice(0, 3);
  const review = c.results.filter(r => r.candidate.market === "jan-aushadhi" && r.status === "review").slice(0, 2);
  const show = (r: typeof c.results[number]) => `${r.candidate.name}\nListed MRP: INR ${r.candidate.price.mrp.toFixed(2)} / ${r.candidate.price.packSize} ${r.candidate.price.packUnit}\nSource: ${r.candidate.price.source}, ${r.candidate.price.asOf}${r.status === "review" ? `\nPharmacist review needed: ${r.reason ?? "release/composition needs review"}` : ""}`;
  return `${exact.length ? `Jan Aushadhi catalog entries matching the confirmed composition:\n${exact.map(show).join("\n\n")}` : "No exact Jan Aushadhi catalog match was found. I will not substitute a different strength, form, or release type."}${review.length ? `\n\nThese require pharmacist review; they are not confirmed substitutes:\n${review.map(show).join("\n\n")}` : ""}\n\nThese are dated listed MRPs, not live prices or stock. Check with your doctor/pharmacist before switching.\nShare your location using WhatsApp's attachment menu to find nearby Kendras.`;
}
export async function botReply(message: WhatsAppMessage, previous: BotSession, services: BotServices): Promise<{ state: BotSession; text: string | null }> {
  const s: BotSession = structuredClone(previous);
  const text = (message.text ?? "").trim(), cmd = text.toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "बंद"].includes(cmd)) return { state: { stopped: true }, text: "Replies paused and your medicine session cleared. Send START to resume." };
  if (cmd === "DELETE") return { state: { stopped: true }, text: "Your saved medicine session has been cleared. Replies paused. Send START to begin again." };
  if (cmd === "START") return { state: {}, text: "Send AGREE to allow us to read medicine images using Gemini and process your chat. Avoid personal identifiers/prescriptions. Location is optional. Send STOP to pause, DELETE to clear your session." };
  if (s.stopped) return { state: s, text: null };
  if (cmd === "HELP") return { state: s, text: `For human app support: ${services.support}\nSend a medicine strip photo after AGREE, or share your location for Kendra lookup. Send STOP to pause or DELETE to clear your session.` };
  if (!s.consent) {
    if (cmd !== "AGREE") return { state: s, text: "Welcome to Dawai Dost. Send AGREE to let us process this chat and read medicine images using Gemini. Please avoid personal identifiers or patient prescriptions. Location sharing is optional. Send HELP for human support, STOP to pause, DELETE to clear your session. After AGREE, resend your strip photo." };
    s.consent = true;
    return { state: s, text: "Thank you. Send a clear photo of the strip's full composition, strength, form, and release marking. I will ask you to confirm what I read before looking for matches. You can also share your location to find Kendras." };
  }
  if (message.location) return { state: s, text: await services.centers(message.location.latitude, message.location.longitude) };
  if (message.type === "image" && message.mediaId) {
    const ocr = await services.readImage(message.mediaId);
    s.pending = { name: ocr.name.value ?? undefined, ingredients: ocr.ingredients.value ?? undefined,
      form: ocr.form.value === "tablet" || ocr.form.value === "capsule" ? ocr.form.value : undefined, release: ocr.release.value ?? undefined };
    if (ocr.form.value && !["tablet", "capsule"].includes(ocr.form.value)) { delete s.pending; delete s.awaiting; return { state: s, text: "This first version supports tablets and capsules. Liquids and injections need additional concentration checks; please ask your pharmacist." }; }
    return { state: s, text: nextQuestion(s) };
  }
  if (cmd === "EDIT") { s.pending = {}; return { state: s, text: nextQuestion(s) }; }
  if (s.pending) {
    if (s.awaiting === "ingredients") {
      const ingredients = parseIngredients(text);
      if (!ingredients) return { state: s, text: "Please copy every salt with its strength and unit, for example: Metformin 500 mg + Glimepiride 1 mg. I cannot compare an unclear composition." };
      s.pending.ingredients = ingredients;
    } else if (s.awaiting === "form") {
      if (!["TABLET", "CAPSULE"].includes(cmd)) return { state: s, text: nextQuestion(s) };
      s.pending.form = cmd.toLowerCase() as "tablet" | "capsule";
    } else if (s.awaiting === "release") {
      const release: Record<string, CompositionQuery["release"]> = { SR: "sustained", SUSTAINED: "sustained", ER: "extended", XR: "extended", CR: "extended", EXTENDED: "extended", DR: "delayed", DELAYED: "delayed", IMMEDIATE: "immediate" };
      if (!release[cmd]) return { state: s, text: nextQuestion(s) };
      s.pending.release = release[cmd];
    } else if (s.awaiting === "confirm" && cmd === "YES") {
      const reply = formatComparison(services.compare(s.pending as CompositionQuery));
      delete s.pending; delete s.awaiting;
      return { state: s, text: reply };
    }
    return { state: s, text: nextQuestion(s) };
  }
  return { state: s, text: "Send a clear medicine strip photo to begin, or share your location to find Kendras. For dosing or treatment advice, ask your doctor. Send HELP for human support." };
}
