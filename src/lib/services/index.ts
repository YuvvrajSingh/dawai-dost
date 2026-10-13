/**
 * Client data layer — the only place screens get data from.
 *
 *   api   (default)  → Next.js API routes backed by data/catalog.json.gz
 *   local            → the same Engine running in the browser over a bundled
 *                      subset (used for the static preview build)
 *
 * OCR: /api/ocr (Gemini, server-side key). Without a key the route answers 501
 * and we fall back to a clearly-labelled demo reading.
 */
import type { Engine } from "../engine";
import type { Comparison, CompositionQuery, Kendra, KendraStockInfo, Medicine, MyKendra, OcrResult, StockAlert, StockInfo } from "../types";

export const DATA_MODE: "api" | "local" = process.env.NEXT_PUBLIC_DATA_MODE === "local" ? "local" : "api";

declare global {
  interface Window {
    __DD_ENGINE__?: Engine;
  }
}
const local = () => {
  const e = typeof window !== "undefined" ? window.__DD_ENGINE__ : undefined;
  if (!e) throw new Error("Catalog not loaded");
  return e;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `Request failed (${res.status})`), { status: res.status });
  }
  return res.json();
}

const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key) as Promise<T>;
}

export const catalog = {
  search(q: string, market: "all" | "generic" | "brand" = "all"): Promise<{ results: Medicine[]; strengths: string[] }> {
    if (DATA_MODE === "local") {
      const e = local();
      return Promise.resolve({ results: e.search(q, { market, limit: 40 }), strengths: e.strengthsFor(q) });
    }
    return cached(`s:${market}:${q.toLowerCase()}`, () => getJson(`/api/search?q=${encodeURIComponent(q)}&market=${market}`));
  },
  get(id: string): Promise<Medicine | null> {
    if (DATA_MODE === "local") return Promise.resolve(local().get(id));
    return cached(`m:${id}`, () => getJson<Medicine>(`/api/medicine/${encodeURIComponent(id)}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))));
  },
};

export const matching = {
  compare(id: string): Promise<Comparison | null> {
    if (DATA_MODE === "local") return Promise.resolve(local().compare(id));
    return cached(`c:${id}`, () => getJson<Comparison>(`/api/compare/${encodeURIComponent(id)}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))));
  },
  compareComposition(q: CompositionQuery): Promise<Comparison | null> {
    if (DATA_MODE === "local") return Promise.resolve(local().compareComposition(q));
    return getJson<Comparison>("/api/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(q) });
  },
};

// ── OCR ───────────────────────────────────────────────────
const DEMO_RESULT: OcrResult = {
  name: { value: "Metformin Hydrochloride Tablets 500 mg", confidence: "medium", evidence: "METFORMIN HYDROCHLORIDE TABLETS IP 500 mg" },
  manufacturer: { value: null, confidence: "missing", evidence: "Not visible in photo" },
  ingredients: { value: [{ salt: "Metformin Hydrochloride", strength: 500, unit: "mg" }], confidence: "high", evidence: "Metformin Hydrochloride IP 500 mg" },
  form: { value: "tablet", confidence: "high", evidence: "Tablets" },
  release: { value: null, confidence: "missing", evidence: "No SR / ER marking found" },
  packSize: { value: 10, confidence: "medium", evidence: "10 Tablets" },
  mrp: { value: null, confidence: "low", evidence: "M.R.P. ₹?" },
  rawText: "DEMO — the strip reader isn't connected, so this is a fixed example, not your photo.",
  engine: "demo",
};

export const ocr = {
  /** Whether the server has a strip reader (Gemini key) configured. */
  configured(): Promise<boolean> {
    if (DATA_MODE === "local") return Promise.resolve(false);
    return cached("meta:ocr", () => getJson<{ ocr?: boolean }>("/api/meta").then((m) => !!m.ocr));
  },
  /** Reads the strip with Gemini via /api/ocr. Falls back to a labelled demo result if OCR isn't configured. */
  async read(image: Blob): Promise<OcrResult> {
    if (DATA_MODE === "local") {
      await new Promise((r) => setTimeout(r, 1400));
      return DEMO_RESULT;
    }
    const fd = new FormData();
    fd.append("image", image);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    if (res.status === 501) return DEMO_RESULT;
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "We couldn’t read this image.");
    return res.json();
  },
};

// ── Jan Aushadhi Kendras ──────────────────────────────────
type KendraList = { results: Kendra[]; radiusKm: number | null; source: string; fetchedAt: string };
export const kendras = {
  /** Nearest Kendras from the official list (/api/kendras). */
  near(lat: number, lng: number): Promise<KendraList> {
    return getJson(`/api/kendras?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`);
  },
  /** By PIN code, district, area or Kendra code. */
  search(q: string): Promise<KendraList> {
    return getJson(`/api/kendras?q=${encodeURIComponent(q.trim())}`);
  },
  /** Google Maps search for Kendras around a point (or around the user if no point). */
  mapsSearchUrl(lat?: number, lng?: number) {
    const q = encodeURIComponent("Jan Aushadhi Kendra");
    return lat != null && lng != null ? `https://www.google.com/maps/search/${q}/@${lat},${lng},14z` : `https://www.google.com/maps/search/${q}+near+me`;
  },
  directionsUrl(k: Kendra) {
    const dest = k.lat != null && k.lng != null ? `${k.lat},${k.lng}` : encodeURIComponent(`Jan Aushadhi Kendra ${k.address ?? ""}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  },
};

// ── Stock ─────────────────────────────────────────────────
/** Reports older than this are treated as unknown — stock changes quickly. */
const STOCK_TTL_MS = 7 * 86_400_000;

/**
 * Stock for a product. No live feed exists yet, so this reads reports made on
 * this phone. Connect a feed here (source: "feed", with qty) when one is available.
 */
export function stockInfo(reports: Record<string, { status: "in" | "out"; at: string }>, id: string): StockInfo {
  const r = reports[id];
  if (!r || Date.now() - new Date(r.at).getTime() > STOCK_TTL_MS) return { status: "unknown", source: "none" };
  return { status: r.status, source: "you", at: r.at };
}

// ── Jan Aushadhi stock at a Kendra ────────────────────────
/** Built-in Kendra so stock and alerts can be tried without location. Demo stock only. */
export const DEMO_KENDRA: MyKendra = { id: "demo:kendra", name: "Jan Aushadhi Kendra (Demo)" };

export const kendraStock = {
  /** Quantities at one Kendra. Staff-entered figures win; otherwise demo stock if the server has it on. */
  get(kendraId: string, ids: string[]): Promise<{ demo: boolean; items: Record<string, KendraStockInfo | null> }> {
    if (!ids.length) return Promise.resolve({ demo: false, items: {} });
    return getJson(`/api/stock?kendra=${encodeURIComponent(kendraId)}&ids=${ids.map(encodeURIComponent).join(",")}`);
  },
  /** Kendra staff: set the quantity of one medicine. */
  set(pin: string, kendra: MyKendra, medId: string, qty: number) {
    return getJson<{ ok: true }>("/api/stock", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin, kendraId: kendra.id, kendraName: kendra.name, medId, qty }) });
  },
  /** Kendra staff: everything entered for one Kendra. */
  list(pin: string, kendraId: string): Promise<{ items: { id: string; name: string; qty: number; unit: string; at: string }[] }> {
    return getJson(`/api/stock/kendra?kendra=${encodeURIComponent(kendraId)}`, { headers: { "x-staff-pin": pin } });
  },
};

// ── Restock alerts + push ─────────────────────────────────
function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const push = {
  supported() {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  },
  permission(): NotificationPermission | "unsupported" {
    return push.supported() ? Notification.permission : "unsupported";
  },
  /**
   * Asks for notification permission (only when the user sets an alert) and
   * returns a push subscription, or null if push isn't possible here.
   */
  async subscribe(): Promise<PushSubscriptionJSON | null> {
    if (!push.supported()) return null;
    try {
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (perm !== "granted") return null;
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) return existing.toJSON();
      const { publicKey } = await getJson<{ publicKey: string }>("/api/push/key");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      return sub.toJSON();
    } catch {
      return null;
    }
  },
};

export const alerts = {
  create(medId: string, kendra: MyKendra, subscription: PushSubscriptionJSON | null): Promise<StockAlert> {
    return getJson("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ medId, kendraId: kendra.id, kendraName: kendra.name, subscription }) });
  },
  status(ids: string[]): Promise<{ alerts: StockAlert[] }> {
    if (!ids.length) return Promise.resolve({ alerts: [] });
    return getJson(`/api/alerts?ids=${ids.join(",")}`);
  },
  cancel(id: string) {
    return getJson<{ ok: true }>(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
