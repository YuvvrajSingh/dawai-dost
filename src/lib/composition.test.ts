import { test } from "node:test";
import assert from "node:assert/strict";
import { canonStrength, effectiveRelease, formFrom, parseCompositionCell, parseGenericName, releaseFrom, saltKey } from "./composition";

test("salt names: counter-ions and spellings normalise, meaningful salts don't", () => {
  assert.equal(saltKey("Metformin Hydrochloride IP"), "metformin");
  assert.equal(saltKey("Amoxycillin"), "amoxicillin");
  assert.equal(saltKey("Thyroxine Sodium"), "levothyroxine");
  assert.equal(saltKey("Atorvastatin Calcium"), "atorvastatin");
  assert.notEqual(saltKey("Metoprolol Succinate"), saltKey("Metoprolol Tartrate"));
});

test("strengths: units are canonical", () => {
  assert.equal(canonStrength("1gm"), "1000mg");
  assert.equal(canonStrength("500 mg"), "500mg");
  assert.equal(canonStrength("0.5mg"), "500mcg");
  assert.equal(canonStrength("25mcg"), "25mcg");
  assert.equal(canonStrength("30mg/5ml"), "30mg/5ml");
  assert.equal(canonStrength("NA"), null);
});

test("dataset composition cells", () => {
  assert.deepEqual(parseCompositionCell("Amoxycillin  (500mg) "), { key: "amoxicillin", name: "Amoxycillin", strength: "500mg" });
  assert.equal(parseCompositionCell(""), null);
});

test("release and form from labels", () => {
  assert.equal(releaseFrom("strip of 20 tablet sr Glycomet 500 SR Tablet"), "extended");
  assert.equal(releaseFrom("strip of 10 tablets Dolo 650 Tablet"), "standard");
  assert.equal(releaseFrom("Pantoprazole Gastro Resistant Tablets"), "delayed");
  assert.equal(releaseFrom("Riomet OD 500mg Tablet SR"), "unknown");
  assert.equal(formFrom("strip of 10 tablet dt"), "tablet-dispersible");
  assert.equal(formFrom("bottle of 100 ml Syrup"), "syrup");
});

test("PPIs are gastro-resistant on both sides even when the label doesn't say so", () => {
  const s = [{ key: "pantoprazole", name: "Pantoprazole", strength: "40mg" }];
  assert.equal(effectiveRelease(s, "standard", "tablet"), "delayed");
});

test("Jan Aushadhi generic names", () => {
  const a = parseGenericName("Metformin Hydrochloride Tablets IP 500mg")!;
  assert.deepEqual([a.salts[0].key, a.salts[0].strength, a.form, a.release], ["metformin", "500mg", "tablet", "standard"]);
  const b = parseGenericName("Aceclofenac 100mg and Paracetamol 325mg Tablets")!;
  assert.deepEqual(b.salts.map((x) => `${x.key}:${x.strength}`), ["aceclofenac:100mg", "paracetamol:325mg"]);
  const c = parseGenericName("Metformin Hydrochloride Prolonged release Tablets IP 500 mg")!;
  assert.equal(c.release, "extended");
  assert.equal(parseGenericName("Ceftriaxone Injection IP 1 g Vial & Wfi"), null);
});
