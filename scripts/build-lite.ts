/**
 * Builds a small catalog subset for the static, server-less preview:
 * for the most common oral compositions keep the cheapest and the priciest listings, plus all Jan Aushadhi items.
 *   npx tsx scripts/build-lite.ts <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { CatalogFile, RawProduct } from "../src/lib/server/catalog-types";

const file = JSON.parse(gunzipSync(readFileSync("data/catalog.json.gz")).toString()) as CatalogFile;
const oral = (p: RawProduct) => p.f === "tablet" || p.f === "capsule";
const byKey = new Map<string, RawProduct[]>();
for (const p of file.products) if (oral(p) && p.src === 0) (byKey.get(p.k) ?? byKey.set(p.k, []).get(p.k)!).push(p);
const keys = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 260);
const keep = new Set<RawProduct>(file.products.filter((p) => p.src === 1));
for (const [, list] of keys) {
  const sorted = [...list].sort((a, b) => a.p / a.s - b.p / b.s);
  sorted.slice(0, 30).forEach((p) => keep.add(p));
  sorted.slice(-25).forEach((p) => keep.add(p));
}
const out: CatalogFile = { ...file, products: [...keep] };
writeFileSync(process.argv[2] ?? "data/catalog-lite.json", JSON.stringify(out));
console.log(`${out.products.length} products, ${(JSON.stringify(out).length / 1e6).toFixed(1)} MB`);
