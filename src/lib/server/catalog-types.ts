import type { Form, Release } from "../composition";

/** Compact on-disk product record (short keys keep the catalog small). */
export interface RawProduct {
  /** id: "m<dataset id>" or "ja<drug code>" */
  i: string;
  /** name */
  n: string;
  /** manufacturer */
  m: string;
  /** MRP for the pack, ₹ */
  p: number;
  /** pack size */
  s: number;
  /** pack unit: tablets | capsules | ml | g | units */
  u: string;
  f: Form;
  r: Release;
  /** salts: [key, display name, canonical strength] */
  c: [string, string, string][];
  /** composition key */
  k: string;
  /** source index into CatalogFile.sources */
  src: 0 | 1;
  /** 1 = composition may be incomplete (dataset keeps max two salts) */
  inc: 0 | 1;
}

export interface CatalogSource {
  id: number;
  name: string;
  url: string;
  licence: string;
  note: string;
}

export interface CatalogFile {
  builtAt: string;
  sources: CatalogSource[];
  products: RawProduct[];
}
