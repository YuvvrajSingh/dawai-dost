/**
 * Downloads the official list of Jan Aushadhi Kendras (PMBI Kendra Locator,
 * janaushadhi.gov.in/locate-kendra) and writes data/kendras.json.gz.
 *
 *   npm run data:kendras
 *
 * The locator page loads its table from a paged JSON endpoint using a guest
 * token it issues to every visitor; this script does the same, slowly.
 * Only store details are kept (code, address, PIN, district, state,
 * coordinates, phone) — not the operators' names.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BASE = "https://janaushadhi.gov.in:8443";
const HEADERS = { "user-agent": "DawaiDost/0.4 (medicine price comparison)", origin: "https://janaushadhi.gov.in", referer: "https://janaushadhi.gov.in/locate-kendra" };
const PAGE = 1000;

interface RawKendra {
  storeCode: string;
  pinCode: number | null;
  stateName: string | null;
  districtName: string | null;
  kendraAddress: string | null;
  contactNumber: string | null;
  latitude: string | null;
  longitude: string | null;
  status: number | null;
}

/** Compact row: [code, lat, lng, pin, district, state, address, phone] — lat/lng null when missing or outside India. */
export type KendraRow = [string, number | null, number | null, number | null, string, string, string, string | null];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const r = await fetch(`${BASE}/auth/generateGuestToken`, { headers: HEADERS });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return ((await r.json()) as { responseBody: string }).responseBody;
}

async function page(tok: string, i: number) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${BASE}/api/v1/website/getAllKendraByStateDistrict`, {
        method: "POST",
        headers: { ...HEADERS, "content-type": "application/json", authorization: `Bearer ${tok}` },
        body: JSON.stringify({ pageIndex: i, pageSize: PAGE, stateId: 0, districtId: 0, pinCode: 0, storeCode: "" }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) throw new Error(`page ${i}: ${r.status}`);
      const j = (await r.json()) as { responseBody: { totalElement: number; isLastPage: boolean; addKendraResponseList: RawKendra[] } };
      return j.responseBody;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const coord = (v: string | null, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 1e5) / 1e5 : null;
};

async function main() {
  const tok = await token();
  const rows: KendraRow[] = [];
  let total = 0;
  for (let i = 0; ; i++) {
    const p = await page(tok, i);
    total = p.totalElement;
    for (const k of p.addKendraResponseList) {
      if (!k.storeCode || k.status === 0) continue;
      const lat = coord(k.latitude, 6, 37.5);
      const lng = coord(k.longitude, 68, 97.5);
      const phone = clean(k.contactNumber).replace(/[^\d+]/g, "");
      rows.push([k.storeCode, lat && lng ? lat : null, lat && lng ? lng : null, k.pinCode || null, clean(k.districtName), clean(k.stateName), clean(k.kendraAddress), phone.length >= 10 ? phone : null]);
    }
    process.stdout.write(`\r${rows.length} / ${total}`);
    if (p.isLastPage || p.addKendraResponseList.length === 0) break;
    await sleep(800); // be gentle with a government server
  }
  const withCoords = rows.filter((r) => r[1] != null).length;
  console.log(`\n${rows.length} Kendras, ${withCoords} with coordinates`);
  const out = { source: "PMBI Kendra Locator, janaushadhi.gov.in/locate-kendra", fetchedAt: new Date().toISOString(), rows };
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(join(process.cwd(), "data", "kendras.json.gz"), gzipSync(JSON.stringify(out)));
  console.log("wrote data/kendras.json.gz");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
