import { NextResponse } from "next/server";
import { getEngine } from "@/lib/server/engine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 80);
  const market = (u.searchParams.get("market") ?? "all") as "all" | "generic" | "brand";
  if (q.trim().length < 2) return NextResponse.json({ results: [], strengths: [] });
  const e = getEngine();
  return NextResponse.json({ results: e.search(q, { market, limit: 40 }), strengths: e.strengthsFor(q) });
}
