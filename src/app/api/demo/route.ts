import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getEngine } from "@/lib/server/engine";
import { db, save, type Alert } from "@/lib/server/runtime-store";
import { DEMO_ON } from "@/lib/server/stock";
import { checkAlerts } from "@/lib/server/push";

export const runtime = "nodejs";

// Sample stock and reminders at the demo Kendra, for presentations.
// Only touches the demo Kendra ("demo:kendra"), never a real one, and is
// available only while demo stock is on (STOCK_DEMO is not "0").

const KENDRA = { id: "demo:kendra", name: "Jan Aushadhi Kendra (Demo)" };

/** Jan Aushadhi medicines and their shelf quantity. Telmisartan is out, so "Notify me" can be shown live. */
const STOCK: [string, number][] = [
  ["ja300", 0], // Telmisartan 40 — out of stock; a reminder is waiting
  ["ja145", 240], // Metformin 500
  ["ja759", 90], // Rosuvastatin 10 — came back in stock (fired reminder)
  ["ja212", 150], // Pantoprazole 40
  ["ja506", 60], // Thyroxine 50 mcg
  ["ja264", 180], // Amlodipine 5
  ["ja266", 300], // Atorvastatin 10
];

const pub = (a: Alert) => ({ id: a.id, medId: a.medId, medName: a.medName, kendraId: a.kendraId, kendraName: a.kendraName, status: a.status, createdAt: a.createdAt, sentAt: a.sentAt ?? null, qty: a.qty ?? null, unit: a.unit ?? null, push: !!a.subscription });

export async function POST() {
  if (!DEMO_ON) return NextResponse.json({ error: "Demo data is off (STOCK_DEMO=0)" }, { status: 403 });
  const e = getEngine();
  const d = db();
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();

  // Fresh start for the demo Kendra
  d.alerts = d.alerts.filter((a) => a.kendraId !== KENDRA.id);
  const k = (d.stock[KENDRA.id] = { name: KENDRA.name, items: {} as Record<string, { qty: number; unit: string; name: string; at: string }> });
  STOCK.forEach(([id, qty], i) => {
    const m = e.get(id);
    if (m) k.items[id] = { qty, unit: m.price.packUnit, name: m.name, at: ago(25 + i * 40) };
  });

  const alert = (medId: string, createdMin: number): Alert | null => {
    const m = e.get(medId);
    if (!m) return null;
    const a: Alert = { id: randomUUID(), medId, medName: m.name, kendraId: KENDRA.id, kendraName: KENDRA.name, subscription: null, status: "waiting", createdAt: ago(createdMin), unit: m.price.packUnit };
    d.alerts.push(a);
    return a;
  };
  const waiting = alert("ja300", 60 * 26); // set yesterday, still out of stock
  const fired = alert("ja759", 60 * 50); // set two days ago, restocked this morning
  if (fired) {
    fired.status = "sent";
    fired.sentAt = ago(60 * 3);
    fired.qty = 90;
  }
  save();
  await checkAlerts(); // no-op for these, but keeps the checker's view consistent
  return NextResponse.json({ kendra: KENDRA, alerts: [waiting, fired].filter((a): a is Alert => !!a).map(pub) });
}

/** Removes the demo Kendra's stock and reminders. */
export async function DELETE() {
  const d = db();
  d.alerts = d.alerts.filter((a) => a.kendraId !== KENDRA.id);
  delete d.stock[KENDRA.id];
  save();
  return NextResponse.json({ ok: true });
}
