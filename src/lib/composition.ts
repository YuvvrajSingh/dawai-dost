/**
 * Composition normalisation — turns messy Indian label text into comparable keys.
 *
 * Used by the catalog build script (Node) and by the API at runtime.
 * Every function is pure and unit-tested (composition.test.ts).
 *
 * Design rule: when unsure, return something that makes the matcher say
 * "needs review", never something that makes two products look identical.
 */

export type Form =
  | "tablet"
  | "tablet-dispersible"
  | "tablet-mouth-dissolving"
  | "tablet-chewable"
  | "capsule"
  | "softgel"
  | "syrup"
  | "suspension"
  | "drops"
  | "injection"
  | "cream"
  | "ointment"
  | "gel"
  | "other";

/** Release category. "standard" = no modified-release marking. */
export type Release = "standard" | "extended" | "delayed" | "unknown";

export interface Salt {
  /** canonical salt name, lower-case, without counter-ion (e.g. "metformin") */
  key: string;
  /** display name as printed (first seen) */
  name: string;
  /** canonical strength, e.g. "500mg", "30mg/5ml", "1%w/w", "1000iu" — null if not stated */
  strength: string | null;
}

// ── Salt names ────────────────────────────────────────────

/** Spelling variants and INN ↔ Indian names. Only true synonyms. */
const ALIASES: Record<string, string> = {
  amoxycillin: "amoxicillin",
  acetaminophen: "paracetamol",
  thyroxine: "levothyroxine",
  "levo-thyroxine": "levothyroxine",
  "l-thyroxine": "levothyroxine",
  frusemide: "furosemide",
  glibenclamide: "glyburide",
  salbutamol: "salbutamol",
  albuterol: "salbutamol",
  "vitamin d3": "cholecalciferol",
  "vitamin b12": "cyanocobalamin",
  "clavulanic acid": "clavulanate",
  "potassium clavulanate": "clavulanate",
  "clavulanate potassium": "clavulanate",
  "diluted potassium clavulanate": "clavulanate",
  "acetylsalicylic acid": "aspirin",
  "levo-cetirizine": "levocetirizine",
  "s-amlodipine": "s-amlodipine",
  "ursodeoxycholic acid": "ursodiol",
  "esomeprazole magnesium": "esomeprazole",
  cholecalciferol: "cholecalciferol",
};

/**
 * Counter-ions / pharmacopoeia suffixes that don't change the active moiety
 * as labelled in India. Deliberately EXCLUDES succinate/tartrate (metoprolol),
 * and anything where the salt form changes the dose meaning.
 */
const STRIP_WORDS = [
  "hydrochloride", "hcl", "sodium", "potassium", "calcium", "besilate", "besylate", "maleate", "mesylate", "mesilate",
  "bisulphate", "bisulfate", "hydrobromide", "dihydrate", "monohydrate", "trihydrate", "anhydrous", "magnesium",
  "ip", "bp", "usp", "i.p.", "b.p.", "u.s.p.",
];

/** Salts that only exist as gastro-resistant (enteric) oral solids — normalise both sides the same way. */
export const INTRINSIC_DELAYED = new Set(["pantoprazole", "rabeprazole", "esomeprazole", "omeprazole", "lansoprazole", "dexlansoprazole", "dexrabeprazole"]);

export function saltKey(raw: string): string {
  let s = raw.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9\- ]/g, " ").replace(/\s+/g, " ").trim();
  if (ALIASES[s]) return ALIASES[s];
  const words = s.split(" ").filter((w) => w && !STRIP_WORDS.includes(w));
  s = words.join(" ").trim();
  return ALIASES[s] ?? s;
}

// ── Strengths ─────────────────────────────────────────────

const UNIT: Record<string, string> = {
  mg: "mg", milligram: "mg", mcg: "mcg", "µg": "mcg", ug: "mcg", microgram: "mcg", g: "g", gm: "g", gram: "g", grams: "g",
  ml: "ml", iu: "iu", units: "iu", unit: "iu", "%": "%",
};

/** Canonicalise a strength like "500mg", "1gm", "0.5 mg", "30mg/5ml", "1% w/w". Returns null if unparseable. */
export function canonStrength(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.toLowerCase().replace(/\s+/g, "").replace(/per/g, "/");
  if (!s || s === "na") return null;
  const m = s.match(/^(\d+(?:\.\d+)?)(mg|mcg|µg|ug|gm|g|ml|iu|units?|%)(w\/w|w\/v|v\/v)?(?:\/(\d+(?:\.\d+)?)?(ml|g|gm|mg|dose|tablet)?)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  let u = UNIT[m[2]] ?? m[2];
  // normalise mass to mg (or mcg for sub-milligram values) so "1gm" == "1000mg" and "0.5mg" == "500mcg"
  if (u === "g") {
    n = n * 1000;
    u = "mg";
  }
  if (u === "mg" && n < 1) {
    n = Math.round(n * 1000 * 1000) / 1000;
    u = "mcg";
  }
  if (u === "mcg" && n >= 1000 && n % 1000 === 0) {
    n = n / 1000;
    u = "mg";
  }
  const num = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
  let out = num + u + (m[3] ?? "");
  if (m[5]) out += "/" + (m[4] && m[4] !== "1" ? m[4] : "") + (UNIT[m[5]] ?? m[5]);
  return out;
}

/** Parse a dataset composition cell like "Amoxycillin  (500mg)". */
export function parseCompositionCell(cell: string): Salt | null {
  const c = cell.replace(/\s+/g, " ").trim();
  if (!c) return null;
  const m = c.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const name = (m ? m[1] : c).trim();
  if (!name) return null;
  return { key: saltKey(name), name: tidyName(name), strength: canonStrength(m?.[2]) };
}

const tidyName = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (x) => x.toUpperCase());

// ── Form + release from pack label / product name ─────────

const RELEASE_EXT = /\b(sr|er|xr|pr|cr|xl|la|cd|sustained|extended|prolonged|controlled|retard)\b/;
const RELEASE_DEL = /\b(ec|dr|gastro[- ]?resistant|enteric|delayed)\b/;
const RELEASE_UNKNOWN = /\b(mr|od|modified)\b/;

export function releaseFrom(text: string): Release {
  const t = text.toLowerCase().replace(/[-_]/g, " ");
  if (RELEASE_UNKNOWN.test(t)) return "unknown";
  // A combination with one delayed and one extended component isn't comparable as a single category
  if (RELEASE_DEL.test(t) && RELEASE_EXT.test(t)) return "unknown";
  if (RELEASE_DEL.test(t)) return "delayed";
  if (RELEASE_EXT.test(t)) return "extended";
  return "standard";
}

export function formFrom(text: string): Form {
  const t = text.toLowerCase();
  if (/\b(dt|dispersible)\b/.test(t)) return "tablet-dispersible";
  if (/\b(md|mouth dissolving|orally disintegrating|odt)\b/.test(t)) return "tablet-mouth-dissolving";
  if (/\bchewable\b/.test(t)) return "tablet-chewable";
  if (/soft ?gel|soft gelatin/.test(t)) return "softgel";
  if (/\btablets?\b/.test(t)) return "tablet";
  if (/\bcapsules?\b/.test(t)) return "capsule";
  if (/injection|vial|ampoule|infusion/.test(t)) return "injection";
  if (/suspension/.test(t)) return "suspension";
  if (/syrup|oral solution|elixir/.test(t)) return "syrup";
  if (/drops?\b/.test(t)) return "drops";
  if (/cream/.test(t)) return "cream";
  if (/ointment/.test(t)) return "ointment";
  if (/\bgel\b/.test(t)) return "gel";
  return "other";
}

/** Apply salt-level release rules so both sides of a comparison are normalised identically. */
export function effectiveRelease(salts: Salt[], release: Release, form: Form): Release {
  if ((form === "tablet" || form === "capsule") && release === "standard" && salts.length === 1 && INTRINSIC_DELAYED.has(salts[0].key)) return "delayed";
  return release;
}

/** "strip of 15 tablets" → { size: 15, unit: "tablets" } */
export function parsePack(label: string): { size: number; unit: string } | null {
  const m = label.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(ml|gm|g|tablets?|capsules?|softgels?|soft gelatin capsules?|sachets?|units?|injection|vial)?/);
  if (!m) return null;
  const size = parseFloat(m[1]);
  let unit = m[2] ?? "units";
  if (/tablet/.test(label.toLowerCase())) unit = "tablets";
  else if (/capsule|softgel/.test(label.toLowerCase())) unit = "capsules";
  else if (unit === "gm" || unit === "g") unit = "g";
  return size > 0 ? { size, unit } : null;
}

/** Canonical key for a full composition: sorted salt:strength pairs. */
export function compositionKey(salts: Salt[]): string {
  return salts
    .map((s) => `${s.key}:${s.strength ?? "?"}`)
    .sort()
    .join("+");
}

// ── Jan Aushadhi generic-name parser ──────────────────────

/**
 * Parse names like:
 *   "Metformin Hydrochloride Tablets IP 500mg"
 *   "Aceclofenac 100mg and Paracetamol 325mg Tablets"
 *   "Metformin Hydrochloride 500mg (Sustained Release) and Voglibose 0.2mg Tablets"
 * Returns null when any part can't be parsed confidently.
 */
export function parseGenericName(name: string): { salts: Salt[]; form: Form; release: Release } | null {
  const form = formFrom(name);
  const release = releaseFrom(name.replace(/\b(ip|bp|usp)\b/gi, ""));
  let s = name
    .replace(/\((?:[^()]*(release|resistant|coated|enteric|delayed|sustained|prolonged)[^()]*)\)/gi, " ")
    .replace(/\b(tablets?|capsules?|soft gelatin|syrup|oral|suspension|solution|injection|drops?|cream|ointment|gel|ip|bp|usp|film[- ]coated|uncoated|chewable|dispersible|mouth dissolving|gastro[- ]?resistant|enteric[- ]coated|prolonged[- ]release|sustained[- ]release|extended[- ]release|controlled[- ]release|modified[- ]release|delayed[- ]release|release|prolonged|sustained|extended|controlled)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // per-ml liquids: "125 mg per 5 ml" → "125mg/5ml"
  s = s.replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu)\s*(?:per|\/)\s*(\d+(?:\.\d+)?)?\s*ml/gi, (_, a, u, b) => `${a}${u}/${b ?? ""}ml`);
  const parts = s.split(/\s*(?:,| and | \+ |&)\s*/i).filter(Boolean);
  const salts: Salt[] = [];
  for (const p of parts) {
    const m = p.match(/^(.*?)\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|iu|%)(?:\/\d*(?:\.\d+)?ml)?)\s*(.*)$/i);
    if (!m) return null;
    const salt = (m[1] + " " + m[3]).replace(/\s+/g, " ").trim();
    const strength = canonStrength(m[2]);
    if (!salt || !strength || /\d/.test(salt)) return null;
    salts.push({ key: saltKey(salt), name: tidyName(salt.replace(/\b(ip|bp|usp)\b/gi, "").trim()), strength });
  }
  return salts.length ? { salts, form, release } : null;
}
