import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "./engine";
import type { CatalogFile, RawProduct } from "./server/catalog-types";

const p = (i: string, n: string, price: number, size: number, k: [string, string][], f: RawProduct["f"] = "tablet", r: RawProduct["r"] = "standard", src: 0 | 1 = 0, inc: 0 | 1 = 0): RawProduct => ({
  i, n, m: "Maker", p: price, s: size, u: f === "capsule" ? "capsules" : "tablets", f, r,
  c: k.map(([key, st]) => [key, key, st]), k: k.map(([key, st]) => `${key}:${st}`).sort().join("+"), src, inc,
});
const file: CatalogFile = {
  builtAt: "2026-01-01",
  sources: [
    { id: 0, name: "Dataset", url: "", licence: "MIT", note: "" },
    { id: 1, name: "JA", url: "", licence: "", note: "" },
  ],
  products: [
    p("a", "BrandMet 500", 30, 10, [["metformin", "500mg"]]),
    p("b", "CheapMet 500", 10, 10, [["metformin", "500mg"]]),
    p("c", "Metformin Tablets IP 500mg", 6.6, 10, [["metformin", "500mg"]], "tablet", "standard", 1),
    p("d", "BrandMet SR 500", 40, 10, [["metformin", "500mg"]], "tablet", "extended"),
    p("e", "Met 850", 20, 10, [["metformin", "850mg"]]),
    p("f", "MetGlim", 50, 10, [["metformin", "500mg"], ["glimepiride", "1mg"]], "tablet", "standard", 0, 1),
    p("g", "MetOD 500", 15, 10, [["metformin", "500mg"]], "tablet", "unknown"),
  ],
};
const e = new Engine(file);
const st = (id: string) => Object.fromEntries(e.compare(id)!.results.map((r) => [r.candidate.id, r.status]));

test("exact composition, form and standard release → match, cheapest first", () => {
  const c = e.compare("a")!;
  const m = c.results.filter((r) => r.status === "match").map((r) => r.candidate.id);
  assert.deepEqual(m, ["c", "b"]);
  assert.ok(Math.abs(c.results[0].savingPct - 78) < 0.01);
});
test("extended release, strength and combos are never a plain match", () => {
  const s = st("a");
  assert.equal(s.d, "excluded"); // release differs
  assert.equal(s.e, "excluded"); // strength differs
  assert.equal(s.f, "excluded"); // extra salt
  assert.equal(s.g, "review"); // release unclear
});
test("extended-release vs extended-release is review, not match", () => {
  const e2 = new Engine({ ...file, products: [...file.products, p("h", "OtherMet SR 500", 20, 10, [["metformin", "500mg"]], "tablet", "extended")] });
  const s = Object.fromEntries(e2.compare("d")!.results.map((r) => [r.candidate.id, r.status]));
  assert.equal(s.h, "review");
});
test("search finds brand and salt names", () => {
  assert.equal(e.search("brandmet")[0].id, "a");
  assert.ok(e.search("metformin 500").some((m) => m.id === "c"));
  assert.ok(!e.search("metformin 850").some((m) => m.id === "a"));
});
test("compare by composition from the strip", () => {
  const c = e.compareComposition({ ingredients: [{ salt: "Metformin Hydrochloride", strength: 500, unit: "mg" }], form: "tablet", release: "immediate" })!;
  assert.equal(c.results[0].candidate.id, "c");
});
test("a salt-only name from the strip is not mistaken for a brand", () => {
  const c = e.compareComposition({ name: "Metformin Hydrochloride Tablets 500 mg", ingredients: [{ salt: "Metformin", strength: 500, unit: "mg" }], form: "tablet", release: "immediate" })!;
  assert.equal(c.original.id, "query");
  const d = e.compareComposition({ name: "BrandMet 500", ingredients: [{ salt: "Metformin", strength: 500, unit: "mg" }], form: "tablet", release: "immediate" })!;
  assert.equal(d.original.id, "a");
});
