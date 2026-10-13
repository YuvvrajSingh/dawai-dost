import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { PushSubscription } from "web-push";
import { getEngine } from "@/lib/server/engine";
import { db, save, type Alert } from "@/lib/server/runtime-store";
import { checkAlerts, ensureChecker } from "@/lib/server/push";

export const runtime = "nodejs";

const pub = (a: Alert) => ({
  id: a.id,
  medId: a.medId,
  medName: a.medName,
  kendraId: a.kendraId,
  kendraName: a.kendraName,
  status: a.status,
  createdAt: a.createdAt,
  sentAt: a.sentAt ?? null,
  qty: a.qty ?? null,
  unit: a.unit ?? null,
  push: !!a.subscription,
});

/** POST /api/alerts: remind me when this medicine is back in stock at this Kendra. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { medId?: string; kendraId?: string; kendraName?: string; subscription?: PushSubscription | null } | null;
  if (!b?.medId || !b.kendraId || !b.kendraName) return NextResponse.json({ error: "medId, kendraId and kendraName are required" }, { status: 400 });
  const m = getEngine().get(b.medId);
  if (!m || m.market !== "jan-aushadhi") return NextResponse.json({ error: "Alerts are for Jan Aushadhi medicines" }, { status: 400 });
  const sub = b.subscription && typeof b.subscription.endpoint === "string" && b.subscription.endpoint.startsWith("https://") ? b.subscription : null;

  const d = db();
  if (d.alerts.filter((a) => a.status === "waiting").length > 50_000) return NextResponse.json({ error: "Too many alerts" }, { status: 503 });
  const a: Alert = {
    id: randomUUID(),
    medId: m.id,
    medName: m.name,
    kendraId: b.kendraId.slice(0, 80),
    kendraName: b.kendraName.slice(0, 120),
    subscription: sub,
    status: "waiting",
    createdAt: new Date().toISOString(),
    unit: m.price.packUnit,
  };
  d.alerts.push(a);
  save();
  ensureChecker();
  return NextResponse.json(pub(a));
}

/** GET /api/alerts?ids=a,b: status of the caller's alerts (ids are unguessable UUIDs). */
export async function GET(req: Request) {
  ensureChecker();
  await checkAlerts();
  const ids = new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100));
  return NextResponse.json({ alerts: db().alerts.filter((a) => ids.has(a.id)).map(pub) });
}

/** DELETE /api/alerts?id=…: cancel an alert. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const d = db();
  const before = d.alerts.length;
  d.alerts = d.alerts.filter((a) => a.id !== id);
  if (d.alerts.length !== before) save();
  return NextResponse.json({ ok: true });
}
