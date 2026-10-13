import "server-only";
import { demoQty } from "../stock-demo";
import { db } from "./runtime-store";

export interface KendraStockInfo {
  qty: number;
  unit: string;
  source: "kendra" | "demo";
  at: string;
}

/** Demo stock is on unless STOCK_DEMO=0. */
export const DEMO_ON = process.env.STOCK_DEMO !== "0";

/**
 * Stock of one medicine at one Kendra. Figures entered by Kendra staff always
 * win; otherwise demo stock (if on); otherwise null (unknown).
 */
export function stockAt(kendraId: string, medId: string, unit = "tablets", now = Date.now()): KendraStockInfo | null {
  const e = db().stock[kendraId]?.items[medId];
  if (e) return { qty: e.qty, unit: e.unit, source: "kendra", at: e.at };
  if (!DEMO_ON) return null;
  const d = demoQty(medId, kendraId, now);
  return { qty: d.qty, unit, source: "demo", at: d.at };
}
