import { NextResponse } from "next/server";
import { kendraListInfo, nearestKendras, searchKendras } from "@/lib/server/kendras";

export const runtime = "nodejs";

// Jan Aushadhi Kendras from the official PMBI Kendra Locator list, bundled in
// data/kendras.json.gz (refresh with `npm run data:kendras`). No external call
// per request, so it's fast and works wherever the app runs.
//
//   GET /api/kendras?lat=26.26&lng=73.01   nearest Kendras
//   GET /api/kendras?q=342003              by PIN code
//   GET /api/kendras?q=jodhpur             by district / area / Kendra code
export async function GET(req: Request) {
  const u = new URL(req.url);
  const meta = kendraListInfo();
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q) return NextResponse.json({ results: searchKendras(q), radiusKm: null, source: meta.source, fetchedAt: meta.fetchedAt });

  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Give lat and lng, or q (PIN code or area)" }, { status: 400 });
  const { results, radiusKm } = nearestKendras(lat, lng);
  return NextResponse.json({ results, radiusKm, source: meta.source, fetchedAt: meta.fetchedAt });
}
