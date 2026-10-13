import { NextResponse } from "next/server";
import { getEngine } from "@/lib/server/engine";
import { db, save } from "@/lib/server/runtime-store";
import { DEMO_ON, stockAt } from "@/lib/server/stock";
import { checkPin } from "@/lib/server/staff";
import { checkAlerts, ensureChecker } from "@/lib/server/push";

export const runtime = "nodejs";

/** GET /api/stock?kendra=<id>&ids=a,b → stock of those medicines at that Kendra. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kendra = u.searchParams.get("kendra");
  const ids = (u.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 60);
  if (!kendra) return NextResponse.json({ error: "kendra is required" }, { status: 400 });
  ensureChecker();
  const e = getEngine();
  const items: Record<string, ReturnType<typeof stockAt>> = {};
  for (const id of ids) {
    const m = e.get(id);
    // Stock is tracked for Jan Aushadhi medicines only: they're the ones sold at Kendras
    if (m?.market === "jan-aushadhi") items[id] = stockAt(kendra, id, m.price.packUnit);
  }
  return NextResponse.json({ kendra, demo: DEMO_ON, items });
}

/** PUT /api/stock: Kendra staff set the quantity of one medicine. */
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as { pin?: string; kendraId?: string; kendraName?: string; medId?: string; qty?: number } | null;
  if (!body || !checkPin(body.pin)) return NextResponse.json({ error: "Wrong staff PIN" }, { status: 403 });
  const { kendraId, kendraName, medId } = body;
  const qty = Number(body.qty);
  if (!kendraId || !kendraName || !medId) return NextResponse.json({ error: "kendraId, kendraName and medId are required" }, { status: 400 });
  if (!Number.isInteger(qty) || qty < 0 || qty > 100_000) return NextResponse.json({ error: "Quantity must be a whole number from 0 to 100000" }, { status: 400 });
  const m = getEngine().get(medId);
  if (!m || m.market !== "jan-aushadhi") return NextResponse.json({ error: "Only Jan Aushadhi medicines can be stocked at a Kendra" }, { status: 400 });

  const d = db();
  const k = (d.stock[kendraId] ??= { name: kendraName.slice(0, 120), items: {} });
  k.name = kendraName.slice(0, 120);
  k.items[medId] = { qty, unit: m.price.packUnit, name: m.name, at: new Date().toISOString() };
  save();
  // A restock should reach waiting users right away, not on the next tick
  if (qty > 0) await checkAlerts();
  return NextResponse.json({ ok: true, item: k.items[medId] });
}
