// Domain types shared by UI, API and engine.
import type { Form, Release } from "./composition";
export type { Form, Release };

export interface Ingredient {
  salt: string;
  /** display strength, e.g. "500 mg", "30 mg/5 ml" ("" if the source doesn't state it) */
  strength: string;
}

export type MarketType = "brand" | "jan-aushadhi";

export interface PriceRecord {
  /** MRP for one pack, ₹ */
  mrp: number;
  packSize: number;
  packUnit: string;
  source: string;
  sourceUrl: string;
  /** Human description of when the price is from */
  asOf: string;
  /** No source here is a live, verified price feed */
  verified: false;
}

export interface Medicine {
  id: string;
  name: string;
  manufacturer: string;
  market: MarketType;
  ingredients: Ingredient[];
  form: Form;
  formLabel: string;
  release: Release;
  releaseLabel: string;
  price: PriceRecord;
  /** true when the source may list only part of a combination */
  incomplete: boolean;
}

export type MatchStatus = "match" | "review" | "excluded";

export interface MatchAttributeCheck {
  key: "ingredients" | "strength" | "form" | "release";
  label: string;
  ok: boolean | "unknown";
  detail: string;
}

export interface MatchResult {
  candidate: Medicine;
  status: MatchStatus;
  checks: MatchAttributeCheck[];
  /** price per tablet / capsule / ml */
  unitPrice: number;
  /** saving per 30 units vs the original (can be negative) */
  saving: number;
  savingPct: number;
  reason?: string;
}

export interface Comparison {
  original: Medicine;
  /** "tablet" | "capsule" | "ml" … */
  unit: string;
  results: MatchResult[];
  counts: { match: number; review: number; excluded: number };
  generatedAt: string;
  dataMode: "live" | "local";
}

export type Confidence = "high" | "medium" | "low" | "missing";

export interface OcrField<T = string> {
  value: T | null;
  confidence: Confidence;
  evidence?: string;
}

/** OCR keeps numeric strength + unit so the user can edit it. */
export interface OcrIngredient {
  salt: string;
  strength: number;
  unit: "mg" | "mcg" | "g" | "ml" | "IU";
}

export type DosageForm = "tablet" | "capsule" | "syrup" | "injection";
export type ReleaseType = "immediate" | "sustained" | "extended" | "delayed";

export interface OcrResult {
  name: OcrField;
  manufacturer: OcrField;
  ingredients: OcrField<OcrIngredient[]>;
  form: OcrField<DosageForm>;
  release: OcrField<ReleaseType>;
  packSize: OcrField<number>;
  mrp: OcrField<number>;
  rawText: string;
  engine: "demo" | "gemini";
}

export interface ImageQuality {
  sharpness: number;
  brightness: number;
  verdict: "ok" | "blurry" | "dark" | "bright";
}

/** What the user confirmed on the strip — used to compare by composition when the brand isn't found. */
export interface CompositionQuery {
  name?: string;
  ingredients: OcrIngredient[];
  form: DosageForm;
  release: ReleaseType;
}

/** A Jan Aushadhi Kendra, from the official PMBI Kendra Locator list. */
export interface Kendra {
  /** Kendra code, e.g. PMBJK01888 */
  id: string;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** null for text/PIN searches */
  distanceKm: number | null;
  address: string | null;
  pin: number | null;
  district: string | null;
  state: string | null;
  phone: string | null;
  hours: string | null;
}

/**
 * Stock for one product. There is no public live stock feed for Jan Aushadhi
 * Kendras or pharmacies, so today this comes only from reports made on this
 * phone ("Was it in stock?"). `qty` is filled only if a real feed is connected.
 */
export interface StockInfo {
  status: "in" | "out" | "unknown";
  source: "you" | "feed" | "none";
  qty?: number;
  at?: string;
}

/** A Kendra the user picked as theirs (or the built-in demo one). */
export interface MyKendra {
  id: string;
  name: string;
}

/** Stock of a Jan Aushadhi medicine at a Kendra, from /api/stock. */
export interface KendraStockInfo {
  qty: number;
  unit: string;
  /** "kendra": entered by Kendra staff · "demo": simulated, labelled in the UI */
  source: "kendra" | "demo";
  at: string;
}

/** A restock reminder, as the server reports it. */
export interface StockAlert {
  id: string;
  medId: string;
  medName: string;
  kendraId: string;
  kendraName: string;
  status: "waiting" | "sent";
  createdAt: string;
  sentAt: string | null;
  qty: number | null;
  unit: string | null;
  push: boolean;
}
