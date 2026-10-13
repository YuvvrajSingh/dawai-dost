import { NextResponse } from "next/server";
import { db } from "@/lib/server/runtime-store";
import { checkPin } from "@/lib/server/staff";

export const runtime = "nodejs";

/** GET /api/stock/kendra?kendra=<id> (header x-staff-pin) → everything staff have entered for that Kendra. */
export async function GET(req: Request) {
  if (!checkPin(req.headers.get("x-staff-pin"))) return NextResponse.json({ error: "Wrong staff PIN" }, { status: 403 });
  const kendra = new URL(req.url).searchParams.get("kendra");
  if (!kendra) return NextResponse.json({ error: "kendra is required" }, { status: 400 });
  const k = db().stock[kendra];
  const items = Object.entries(k?.items ?? {})
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ kendra, name: k?.name ?? null, items });
}
