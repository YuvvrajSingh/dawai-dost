import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { Kendra } from "../types";

// The official list of Jan Aushadhi Kendras (PMBI Kendra Locator), compiled by
// scripts/fetch-kendras.ts into data/kendras.json.gz. ~21k rows, so a linear
// scan per request is fast enough (~1 ms) and needs no index.

/** [code, lat, lng, pin, district, state, address, phone] */
type Row = [string, number | null, number | null, number | null, string, string, string, string | null];

let cache: { rows: Row[]; fetchedAt: string; source: string } | null = null;
function data() {
  if (!cache) cache = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), "data", "kendras.json.gz"))).toString("utf8"));
  return cache!;
}

export const kendraListInfo = () => ({ count: data().rows.length, fetchedAt: data().fetchedAt, source: data().source });

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const LANDMARK = /hospital|campus|market|bazar|bazaar|chowk|circle|station|stand|complex|mall|near|opp|college|health|chc|phc|dispensary|road|marg|nagar|colony|vihar|gate/i;
const UNIT = /\b(shop|plot|door|flat|floor|basement|ground|block|ward|khasra|survey|unit|s\/?n|s\.\s?no|d\.?\s?no|h\.?\s?no|no\.?)\b|\d/i;

/** A part of the address people would recognise ("MDM Hospital Campus"), not a shop or plot number. */
function landmarkOf(address: string) {
  const parts = address.split(/,\s*|\s+-\s+/).map((p) => p.trim()).filter((p) => p.length > 3);
  return parts.find((p) => LANDMARK.test(p) && !/^(shop|plot|door|flat|s\/?n|s\.\s?no)\b/i.test(p)) ?? parts.find((p) => !UNIT.test(p)) ?? parts[0] ?? address;
}

function toKendra(r: Row, distanceKm: number | null): Kendra {
  const [code, lat, lng, pin, district, state, address, phone] = r;
  const landmark = landmarkOf(address);
  return {
    id: code,
    code,
    name: `Jan Aushadhi Kendra, ${title(landmark).slice(0, 48)}`,
    lat,
    lng,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
    address: [address, district, pin].filter(Boolean).join(", "),
    pin,
    district: district ? title(district) : null,
    state: state || null,
    phone,
    hours: null,
  };
}

/** Nearest Kendras: within 10 km, widening to 25 and 60 km until at least 5 are found. */
export function nearestKendras(lat: number, lng: number, limit = 20) {
  const all = data()
    .rows.filter((r) => r[1] != null && r[2] != null)
    .map((r) => ({ r, d: km(lat, lng, r[1]!, r[2]!) }))
    .sort((a, b) => a.d - b.d);
  let radiusKm = 10;
  for (radiusKm of [10, 25, 60]) if (all.filter((x) => x.d <= radiusKm).length >= 5) break;
  return { radiusKm, results: all.filter((x) => x.d <= radiusKm).slice(0, limit).map((x) => toKendra(x.r, x.d)) };
}

/**
 * Search by PIN code (exact PIN first, then nearby PINs in the same district),
 * or by district / area / Kendra code text.
 */
export function searchKendras(q: string, limit = 30) {
  const rows = data().rows;
  const pin = /^\d{6}$/.test(q.trim()) ? Number(q.trim()) : null;
  if (pin) {
    const exact = rows.filter((r) => r[3] === pin);
    const districts = new Set(exact.map((r) => r[4].toLowerCase()));
    const near = rows
      .filter((r) => r[3] !== pin && r[3] != null && Math.floor(r[3] / 1000) === Math.floor(pin / 1000) && (districts.size === 0 || districts.has(r[4].toLowerCase())))
      .sort((a, b) => Math.abs(a[3]! - pin) - Math.abs(b[3]! - pin));
    return [...exact, ...near].slice(0, limit).map((r) => toKendra(r, null));
  }
  const words = q.toLowerCase().split(/[\s,]+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  return rows
    .map((r) => {
      const hay = `${r[0]} ${r[4]} ${r[5]} ${r[6]}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      // District matches rank above address-only matches
      const score = words.filter((w) => r[4].toLowerCase().includes(w)).length * 2 + words.filter((w) => r[6].toLowerCase().includes(w)).length;
      return { r, score };
    })
    .filter((x): x is { r: Row; score: number } => !!x)
    .sort((a, b) => b.score - a.score || (a.r[3] ?? 0) - (b.r[3] ?? 0))
    .slice(0, limit)
    .map((x) => toKendra(x.r, null));
}
