/**
 * Dawai Dost engine — search, lookup and generic matching over the catalog.
 * Pure (no fs / network), so the same code runs in the API routes and,
 * with a smaller catalog, in a static preview build.
 *
 * Matching rules (strictest first):
 *  match    — identical composition key (every salt + strength), same dosage form,
 *             same release category (standard, or delayed for gastro-resistant salts),
 *             and both records list their full composition.
 *  review   — same composition and form, but: extended-release (profiles can differ),
 *             release marking unclear (MR/OD), or a combination whose source may list
 *             only two salts.
 *  excluded — shares a salt but strength, form, release or the salt set differs.
 */
import { canonStrength, compositionKey, effectiveRelease, saltKey, type Form, type Release, type Salt } from "./composition";
import type { CatalogFile, CatalogSource, RawProduct } from "./server/catalog-types";
import type { Comparison, CompositionQuery, MatchAttributeCheck, MatchResult, MatchStatus, Medicine } from "./types";

export const COMPARE_UNITS = 30;
const MAX_MATCH = 25;
const MAX_REVIEW = 10;
const MAX_EXCLUDED = 8;

/** Hindi / misspelt salt names → English salt key (never symptoms → drugs). */
export const ALIASES: Record<string, string> = {
  "मेटफॉर्मिन": "metformin",
  "मेटफार्मिन": "metformin",
  metphormin: "metformin",
  "पैरासिटामोल": "paracetamol",
  paracitamol: "paracetamol",
  "टेल्मिसर्टन": "telmisartan",
  "एटोरवास्टेटिन": "atorvastatin",
  "पैंटोप्राज़ोल": "pantoprazole",
  "एम्लोडिपिन": "amlodipine",
  "थायरोक्सिन": "thyroxine",
};

export const POPULAR_QUERIES = ["Metformin 500", "Telmisartan 40", "Atorvastatin 10", "Pantoprazole 40", "Amlodipine 5"];

const FORM_LABEL: Record<Form, string> = {
  tablet: "Tablet",
  "tablet-dispersible": "Dispersible tablet",
  "tablet-mouth-dissolving": "Mouth-dissolving tablet",
  "tablet-chewable": "Chewable tablet",
  capsule: "Capsule",
  softgel: "Soft gelatin capsule",
  syrup: "Syrup",
  suspension: "Suspension",
  drops: "Drops",
  injection: "Injection",
  cream: "Cream",
  ointment: "Ointment",
  gel: "Gel",
  other: "Other",
};
const RELEASE_LABEL: Record<Release, string> = {
  standard: "Regular release",
  extended: "Extended release (SR/ER/PR)",
  delayed: "Gastro-resistant",
  unknown: "Release type unclear",
};

/** "500mg" → "500 mg", "30mg/5ml" → "30 mg/5 ml" */
export const prettyStrength = (s: string) =>
  s
    .replace(/^(\d+(?:\.\d+)?)(mg|mcg|ml|iu|%)/, (_, n, u) => `${n} ${u === "iu" ? "IU" : u}`)
    .replace(/\/(\d*)(ml|g|mg)$/, (_, n, u) => `/${n ? n + " " : ""}${u}`);

export class Engine {
  readonly products: RawProduct[];
  readonly sources: CatalogSource[];
  readonly builtAt: string;
  private byId = new Map<string, RawProduct>();
  private byKey = new Map<string, RawProduct[]>();
  private bySalt = new Map<string, RawProduct[]>();
  private names: string[];

  constructor(file: CatalogFile) {
    this.products = file.products;
    this.sources = file.sources;
    this.builtAt = file.builtAt;
    for (const p of this.products) {
      this.byId.set(p.i, p);
      push(this.byKey, p.k, p);
      for (const [k] of p.c) push(this.bySalt, k, p);
    }
    this.names = this.products.map((p) => p.n.toLowerCase());
  }

  toMedicine(p: RawProduct): Medicine {
    const src = this.sources[p.src];
    return {
      id: p.i,
      name: p.n,
      manufacturer: p.m,
      market: p.src === 1 ? "jan-aushadhi" : "brand",
      ingredients: p.c.map(([, name, s]) => ({ salt: name, strength: s ? prettyStrength(s) : "" })),
      form: p.f,
      formLabel: FORM_LABEL[p.f],
      release: p.r,
      releaseLabel: RELEASE_LABEL[p.r],
      price: {
        mrp: p.p,
        packSize: p.s,
        packUnit: p.u,
        source: src.name,
        sourceUrl: src.url,
        asOf: p.src === 1 ? "Mar 2025 list" : "2024 snapshot",
        verified: false,
      },
      incomplete: p.inc === 1,
    };
  }

  get(id: string): Medicine | null {
    const p = this.byId.get(id);
    return p ? this.toMedicine(p) : null;
  }

  search(q: string, opts: { market?: "all" | "generic" | "brand"; limit?: number } = {}): Medicine[] {
    let query = q.toLowerCase().trim();
    for (const [k, v] of Object.entries(ALIASES)) query = query.replace(k.toLowerCase(), v);
    const tokens = query.split(/[\s,+/()]+/).filter(Boolean);
    if (!tokens.length) return [];
    const words = tokens.filter((t) => !/^\d/.test(t));
    const nums = tokens.filter((t) => /^\d/.test(t)).map((t) => t.replace(/[a-z]+$/, ""));
    const wordKeys = words.map((w) => saltKey(w));
    const wordRe = words.map((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`));
    const scored: { p: RawProduct; s: number }[] = [];
    const limit = opts.limit ?? 40;

    for (let idx = 0; idx < this.products.length; idx++) {
      const p = this.products[idx];
      if (opts.market === "generic" && p.src !== 1) continue;
      if (opts.market === "brand" && p.src !== 0) continue;
      const name = this.names[idx];
      let s = 0;
      let ok = true;
      for (let w = 0; w < words.length; w++) {
        const t = words[w];
        if (name.includes(t)) {
          s += name.startsWith(t) ? 12 : wordRe[w].test(name) ? 8 : 3;
          continue;
        }
        if (wordKeys[w].length >= 3 && p.c.some(([k]) => k.startsWith(wordKeys[w]))) {
          s += 4;
          continue;
        }
        ok = false;
        break;
      }
      if (!ok) continue;
      if (nums.length) {
        let hit = true;
        for (const n of nums) {
          const inName = new RegExp(`(^|[^0-9.])${n}([^0-9.]|$)`).test(name);
          const inStrength = p.c.some(([, , st]) => st.replace(/[^\d.]/g, "") === n);
          if (!inName && !inStrength) hit = false;
          else s += inName ? 5 : 3;
        }
        if (!hit) continue;
      }
      if (name.startsWith(query)) s += nums.length ? 3 : 10;
      if (words.length && name.split(/[\s-]/)[0] === words[0]) s += 6;
      if (p.f === "tablet" || p.f === "capsule") s += 1;
      // Searching a salt + strength ("telmisartan 40") should surface the plain single-salt product before combinations
      if (p.c.length === 1) s += nums.length ? 9 : 2;
      scored.push({ p, s });
    }
    scored.sort((a, b) => b.s - a.s || a.p.n.length - b.p.n.length || a.p.p / a.p.s - b.p.p / b.p.s);
    const seen = new Set<string>();
    const out: Medicine[] = [];
    for (const { p } of scored) {
      const sig = `${p.n.toLowerCase()}|${p.p}|${p.s}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(this.toMedicine(p));
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Strengths of a salt that exist in the catalog — for "pick the strength on your strip" chips. */
  strengthsFor(q: string): string[] {
    let query = q.toLowerCase().trim();
    for (const [k, v] of Object.entries(ALIASES)) query = query.replace(k.toLowerCase(), v);
    const key = saltKey(query.split(/\s+/)[0] ?? "");
    if (key.length < 3) return [];
    const list = [...this.bySalt.entries()].find(([k]) => k === key)?.[1] ?? [];
    const counts = new Map<string, number>();
    for (const p of list) if (p.c.length === 1 && (p.f === "tablet" || p.f === "capsule") && p.c[0][2]) counts.set(p.c[0][2], (counts.get(p.c[0][2]) ?? 0) + 1);
    const name = list[0]?.c.find(([k]) => k === key)?.[1] ?? query;
    return [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .slice(0, 6)
      .map(([s]) => `${name} ${prettyStrength(s)}`);
  }

  compare(id: string): Comparison | null {
    const o = this.byId.get(id);
    return o ? this.compareRaw(o) : null;
  }

  /** Compare by what the user confirmed on the strip (brand not found / OCR). */
  compareComposition(q: CompositionQuery): Comparison | null {
    const salts: Salt[] = q.ingredients.map((i) => ({ key: saltKey(i.salt), name: i.salt, strength: canonStrength(`${i.strength}${i.unit}`) }));
    if (!salts.length || salts.some((s) => !s.strength)) return null;
    const form: Form = q.form === "capsule" ? "capsule" : q.form === "syrup" ? "syrup" : q.form === "injection" ? "injection" : "tablet";
    const release: Release = q.release === "immediate" ? "standard" : q.release === "delayed" ? "delayed" : "extended";
    const k = compositionKey(salts);
    // Prefer a real product with that exact name; otherwise the cheapest-listed brand with that composition as the reference.
    const same = (this.byKey.get(k) ?? []).filter((p) => p.f === form && p.r === effectiveRelease(salts, release, form));
    // Only treat it as a known brand when the printed name's first word is a brand, not the salt itself.
    const first = (q.name ?? "").toLowerCase().split(/[\s-]+/)[0] ?? "";
    const isSaltWord = salts.some((s) => s.key.startsWith(saltKey(first)) || saltKey(first).startsWith(s.key));
    const named = first.length >= 3 && !isSaltWord ? same.find((p) => p.n.toLowerCase().split(/[\s-]+/)[0] === first) : undefined;
    const ref: RawProduct =
      named ??
      ({
        i: "query",
        n: q.name || salts.map((s) => `${s.name} ${prettyStrength(s.strength!)}`).join(" + "),
        m: "As read from your strip",
        p: 0,
        s: 1,
        u: form === "capsule" ? "capsules" : "tablets",
        f: form,
        r: effectiveRelease(salts, release, form),
        c: salts.map((s) => [s.key, s.name, s.strength ?? ""]),
        k,
        src: 0,
        inc: 0,
      } as RawProduct);
    return this.compareRaw(ref);
  }

  private compareRaw(o: RawProduct): Comparison {
    const oUnit = o.p > 0 ? o.p / o.s : 0;
    const cands = new Set<RawProduct>();
    for (const p of this.byKey.get(o.k) ?? []) cands.add(p);
    // Near-misses worth explaining: same salts in another strength/form/release, or one salt more/less.
    const oKeys = new Set(o.c.map(([k]) => k));
    let near = 0;
    for (const [k] of o.c)
      for (const p of this.bySalt.get(k) ?? []) {
        if (near > 400) break;
        const shared = p.c.filter(([x]) => oKeys.has(x)).length;
        if (shared === o.c.length && Math.abs(p.c.length - o.c.length) <= 1 && p.k !== o.k) (cands.add(p), near++);
        else if (p.k === o.k) cands.add(p);
      }
    cands.delete(o);

    const results: MatchResult[] = [];
    for (const c of cands) {
      if (c.u !== o.u && c.k === o.k && c.f === o.f) continue; // can't price-compare different units
      const checks = this.checks(o, c);
      const status = this.status(o, c, checks);
      const unitPrice = c.p / c.s;
      const saving = oUnit > 0 && c.u === o.u ? (oUnit - unitPrice) * COMPARE_UNITS : 0;
      results.push({
        candidate: this.toMedicine(c),
        status: status.status,
        reason: status.reason,
        checks,
        unitPrice,
        saving,
        savingPct: oUnit > 0 && c.u === o.u ? ((oUnit - unitPrice) / oUnit) * 100 : 0,
      });
    }
    // Guard against data errors (wrong pack size etc.): a listed price far below the typical one isn't headlined.
    const matchPrices = results.filter((r) => r.status === "match").map((r) => r.unitPrice).sort((a, b) => a - b);
    const median = matchPrices.length >= 5 ? matchPrices[Math.floor(matchPrices.length / 2)] : 0;
    for (const r of results) {
      if (r.status === "match" && median && r.candidate.market === "brand" && r.unitPrice < median * 0.1) {
        r.status = "review";
        r.reason = "Listed price looks unusually low — confirm at the pharmacy";
      }
    }
    const by = (s: MatchStatus) => results.filter((r) => r.status === s).sort((a, b) => a.unitPrice - b.unitPrice);
    const match = dedupe(by("match"));
    const review = dedupe(by("review"));
    // Excluded: show the most relevant — same salts first, then cheapest
    const excluded = dedupe(by("excluded")).sort((a, b) => Number(b.checks[0].ok === true) - Number(a.checks[0].ok === true));
    return {
      original: this.toMedicine(o),
      unit: o.u.replace(/s$/, ""),
      results: [...match.slice(0, MAX_MATCH), ...review.slice(0, MAX_REVIEW), ...excluded.slice(0, MAX_EXCLUDED)],
      counts: { match: match.length, review: review.length, excluded: excluded.length },
      generatedAt: new Date().toISOString(),
      dataMode: "live",
    };
  }

  private checks(o: RawProduct, c: RawProduct): MatchAttributeCheck[] {
    const oKeys = o.c.map(([k]) => k).sort();
    const cKeys = c.c.map(([k]) => k).sort();
    const sameSet = oKeys.length === cKeys.length && oKeys.every((k, i) => k === cKeys[i]);
    const extra = c.c.filter(([k]) => !oKeys.includes(k)).map(([, n]) => n);
    const missing = o.c.filter(([k]) => !cKeys.includes(k)).map(([, n]) => n);
    const strengthOk = sameSet && o.k === c.k;
    const relOk: boolean | "unknown" = o.r === "unknown" || c.r === "unknown" ? "unknown" : o.r === c.r;
    return [
      { key: "ingredients", label: "Salts", ok: sameSet, detail: sameSet ? "Same" : [extra.length ? `Adds ${extra.join(", ")}` : "", missing.length ? `No ${missing.join(", ")}` : ""].filter(Boolean).join(" · ") },
      { key: "strength", label: "Strength", ok: sameSet ? strengthOk : false, detail: c.c.map(([, , s]) => (s ? prettyStrength(s) : "not listed")).join(" + ") },
      { key: "form", label: "Form", ok: o.f === c.f, detail: FORM_LABEL[c.f] },
      { key: "release", label: "Release", ok: relOk, detail: RELEASE_LABEL[c.r] },
    ];
  }

  private status(o: RawProduct, c: RawProduct, checks: MatchAttributeCheck[]): { status: MatchStatus; reason?: string } {
    const failed = checks.filter((x) => x.ok === false);
    if (failed.length) {
      const f = failed[0];
      const reason = f.key === "ingredients" ? (checks[0].detail || "Different salts") : f.key === "strength" ? `Different strength (${f.detail})` : f.key === "form" ? `${FORM_LABEL[c.f]}, not ${FORM_LABEL[o.f].toLowerCase()}` : `${RELEASE_LABEL[c.r]}`;
      return { status: "excluded", reason };
    }
    if (checks.some((x) => x.ok === "unknown")) return { status: "review", reason: "Release type isn’t clear from the label" };
    if (o.inc || c.inc) return { status: "review", reason: "Combination — confirm every salt on the strip" };
    if (o.r === "extended") return { status: "review", reason: "Extended-release versions can differ between makers" };
    return { status: "match" };
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

/** Many listings repeat the same product; keep one per name + price. */
function dedupe(rs: MatchResult[]) {
  const seen = new Set<string>();
  return rs.filter((r) => {
    const sig = `${r.candidate.name.toLowerCase()}|${r.candidate.price.mrp}|${r.candidate.price.packSize}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
