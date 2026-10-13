/**
 * Builds data/catalog.json.gz from the raw public sources.
 *
 *   npm run data:build
 *
 * Sources (see data/SOURCES.md):
 *   1. data/raw/indian_medicine_data.csv  — Indian Medicine Dataset (MIT), ~254k products with MRP,
 *      manufacturer, pack and composition. Downloaded automatically if missing.
 *   2. data/raw/janaushadhi_2025_part1.psv — Jan Aushadhi (PMBJP) product MRP list, 24 Mar 2025 edition,
 *      drug codes 1–1560 (922 products).
 */
import { createWriteStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  compositionKey,
  effectiveRelease,
  formFrom,
  parseCompositionCell,
  parseGenericName,
  parsePack,
  releaseFrom,
  type Salt,
} from "../src/lib/composition";
import type { CatalogFile, RawProduct } from "../src/lib/server/catalog-types";

const RAW = "data/raw/indian_medicine_data.csv";
const RAW_URL = "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv";
const JA = "data/raw/janaushadhi_2025_part1.psv";

/** Minimal RFC-4180 CSV parser (handles quotes and embedded commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') (f += '"'), i++;
        else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(f), (f = "");
    else if (c === "\n") row.push(f), rows.push(row), (row = []), (f = "");
    else if (c !== "\r") f += c;
  }
  if (f || row.length) row.push(f), rows.push(row);
  return rows;
}

const packed = (salts: Salt[]) => salts.map((s) => [s.key, s.name, s.strength ?? ""] as [string, string, string]);

async function main() {
  if (!existsSync(RAW)) {
    console.log("Downloading Indian Medicine Dataset…");
    const res = await fetch(RAW_URL);
    if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(RAW));
  }

  const products: RawProduct[] = [];
  const stats = { total: 0, discontinued: 0, noPrice: 0, kept: 0, jaKept: 0, jaSkipped: 0 };

  // 1 ── Indian Medicine Dataset
  const rows = parseCsv(readFileSync(RAW, "utf8"));
  const head = rows.shift()!;
  const col = (n: string) => head.indexOf(n);
  const iId = col("id"), iName = col("name"), iPrice = col("price(₹)"), iDisc = col("Is_discontinued"), iMfr = col("manufacturer_name"), iPack = col("pack_size_label"), iC1 = col("short_composition1"), iC2 = col("short_composition2");
  for (const r of rows) {
    if (r.length < head.length) continue;
    stats.total++;
    if (r[iDisc] === "TRUE") {
      stats.discontinued++;
      continue;
    }
    const price = parseFloat(r[iPrice]);
    if (!(price > 0)) {
      stats.noPrice++;
      continue;
    }
    const salts = [r[iC1], r[iC2]].map((c) => parseCompositionCell(c ?? "")).filter((s): s is Salt => !!s);
    if (!salts.length) continue;
    const label = r[iPack] ?? "";
    const pack = parsePack(label);
    if (!pack) continue;
    const form = formFrom(label + " " + r[iName]);
    // Ignore a marker that is the brand's first word ("MR Met"), keep suffixes ("Glycomet 500 SR", "tablet sr" pack labels)
    const nameTail = r[iName].trim().split(/\s+/).slice(1).join(" ");
    const release = effectiveRelease(salts, releaseFrom(label + " " + nameTail), form);
    products.push({
      i: "m" + r[iId],
      n: r[iName].trim(),
      m: r[iMfr].trim(),
      p: Math.round(price * 100) / 100,
      s: pack.size,
      u: pack.unit,
      f: form,
      r: release,
      c: packed(salts),
      k: compositionKey(salts),
      src: 0,
      // The dataset stores at most two salts per product, so 2-salt rows may be truncated 3+ salt combinations.
      inc: salts.length >= 2 ? 1 : 0,
    });
    stats.kept++;
  }

  // 2 ── Jan Aushadhi
  for (const line of readFileSync(JA, "utf8").split("\n").slice(1)) {
    const [code, name, unitSize, mrp] = line.split("|");
    if (!code || !name) continue;
    const parsed = parseGenericName(name);
    const price = parseFloat(mrp);
    const pm = (unitSize ?? "").match(/(\d+(?:\.\d+)?)/);
    if (!parsed || !(price > 0) || !pm) {
      stats.jaSkipped++;
      continue;
    }
    const isSolid = ["tablet", "capsule", "softgel", "tablet-dispersible", "tablet-chewable", "tablet-mouth-dissolving"].includes(parsed.form);
    const unit = isSolid ? (parsed.form === "capsule" || parsed.form === "softgel" ? "capsules" : "tablets") : /ml/i.test(unitSize) ? "ml" : /\bg\b|gm/i.test(unitSize) ? "g" : "units";
    products.push({
      i: "ja" + code,
      n: name.trim(),
      m: "Jan Aushadhi (PMBI)",
      p: price,
      s: parseFloat(pm[1]),
      u: unit,
      f: parsed.form,
      r: effectiveRelease(parsed.salts, parsed.release, parsed.form),
      c: packed(parsed.salts),
      k: compositionKey(parsed.salts),
      src: 1,
      inc: 0,
    });
    stats.jaKept++;
  }

  const file: CatalogFile = {
    builtAt: new Date().toISOString(),
    sources: [
      {
        id: 0,
        name: "Indian Medicine Dataset",
        url: "https://github.com/junioralive/Indian-Medicine-Dataset",
        licence: "MIT",
        note: "Retail MRP snapshot compiled from public online pharmacy listings (2024). Prices may have changed.",
      },
      {
        id: 1,
        name: "Jan Aushadhi product MRP list",
        url: "https://janaushadhi.gov.in/product-portfolio/product-mrp-list",
        licence: "Government of India public information",
        note: "PMBJP product portfolio, edition dated 24 Mar 2025 (drug codes 1–1560). Sold only at Jan Aushadhi Kendras.",
      },
    ],
    products,
  };
  const json = JSON.stringify(file);
  writeFileSync("data/catalog.json.gz", gzipSync(json, { level: 9 }));
  console.log(stats, `→ data/catalog.json.gz (${(json.length / 1e6).toFixed(1)} MB raw)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
