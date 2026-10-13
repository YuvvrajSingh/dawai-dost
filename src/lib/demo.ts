// Sample data for presentations: a family that buys the same medicines every
// month and has switched four of them to Jan Aushadhi. Everything uses real
// catalog products and real listed prices; savings are computed from the same
// comparison the app shows, so the numbers on every screen agree.
import { DEMO_KENDRA, matching } from "./services";
import type { MyKendra, StockAlert } from "./types";
import type { Purchase, SavingsState } from "./savings";

/** Brands this family buys every month (real catalog ids). */
const SAVED = [
  "m214769", // Telma 40 — telmisartan, blood pressure
  "m94187", // Glycomet 500 — metformin, diabetes
  "m184135", // Rosuvas 10 — rosuvastatin, cholesterol
  "m173578", // Pan 40 — pantoprazole, acidity
  "m216173", // Thyronorm 50 — thyroxine
  "m66", // Amlong 5 — amlodipine
];
/** Looked at recently but not saved. */
const RECENT_ONLY = ["m58", "m72306"]; // Atorva 10, Ecosprin 75
/** Switched to Jan Aushadhi: brand → JA product, day of month bought. */
const SWITCHED: [string, string, number][] = [
  ["m214769", "ja300", 3],
  ["m94187", "ja145", 3],
  ["m184135", "ja759", 11],
  ["m173578", "ja212", 18],
];
const QUERIES = ["Telma 40", "Rosuvastatin 10", "Metformin 500", "Pan 40"];

export interface DemoData {
  saved: string[];
  recent: { id: string; at: string }[];
  names: Record<string, string>;
  recentQueries: string[];
  savings: SavingsState;
  myKendra: MyKendra;
  alerts: StockAlert[];
}

const daysAgo = (n: number, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d;
};

export async function buildDemo(): Promise<DemoData> {
  const ids = [...SAVED, ...RECENT_ONLY];
  const comps = await Promise.all(ids.map((id) => matching.compare(id).catch(() => null)));
  const names: Record<string, string> = {};
  comps.forEach((c) => c && (names[c.original.id] = c.original.name));

  // Four months of purchases, one per switched medicine per month, skipping future dates
  const purchases: Purchase[] = [];
  const today = new Date();
  for (const [brandId, jaId, day] of SWITCHED) {
    const c = comps[ids.indexOf(brandId)];
    const ja = c?.results.find((r) => r.candidate.id === jaId);
    if (!c || !ja) continue;
    const perUnit = c.original.price.mrp / c.original.price.packSize - ja.unitPrice;
    if (perUnit <= 0) continue;
    for (let m = 0; m < 4; m++) {
      const at = new Date(today.getFullYear(), today.getMonth() - m, day, 10 + (day % 7), 30);
      if (at > today) continue;
      purchases.push({ id: `demo-${brandId}-${m}`, from: c.original.name, to: ja.candidate.name, qty: 30, unit: ja.candidate.price.packUnit, amount: Math.round(perUnit * 30), at: at.toISOString() });
    }
  }
  purchases.sort((a, b) => b.at.localeCompare(a.at));

  const res = await fetch("/api/demo", { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn’t load demo stock");
  const { kendra, alerts } = (await res.json()) as { kendra: MyKendra; alerts: StockAlert[] };

  return {
    saved: SAVED.filter((id) => names[id]),
    recent: [...SAVED.slice(0, 3), ...RECENT_ONLY].filter((id) => names[id]).map((id, i) => ({ id, at: daysAgo(i * 2 + (i > 2 ? 3 : 0)).toISOString() })),
    names,
    recentQueries: QUERIES,
    savings: { saved: purchases.reduce((s, p) => s + p.amount, 0), purchases },
    myKendra: kendra ?? DEMO_KENDRA,
    // The fired reminder is marked seen, so its banner doesn't pop on load; the badge still shows it
    alerts: alerts.map((a) => ({ ...a, ...(a.status === "sent" ? { seen: true } : {}) })),
  };
}

export async function clearDemoServer() {
  await fetch("/api/demo", { method: "DELETE" }).catch(() => {});
}
