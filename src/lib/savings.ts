// Savings tracking, kept on the device. When someone buys a same-composition
// medicine instead of their brand, they log it ("I bought this") and the
// difference in listed MRP for that quantity is added to money saved.
// Pure functions so the rules are easy to test.

export interface Purchase {
  id: string;
  /** the brand they were buying */
  from: string;
  /** the same-composition medicine they bought instead */
  to: string;
  qty: number;
  unit: string;
  /** ₹ saved on this purchase */
  amount: number;
  at: string;
}

export interface SavingsState {
  /** ₹ saved — sum of logged purchases */
  saved: number;
  purchases: Purchase[];
}

export const EMPTY_SAVINGS: SavingsState = { saved: 0, purchases: [] };

export function logPurchase(s: SavingsState, p: Omit<Purchase, "id" | "at">, now = new Date(), rand = Math.random): { state: SavingsState; purchase: Purchase } {
  const purchase: Purchase = { ...p, amount: Math.max(0, Math.round(p.amount)), id: `${now.getTime().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`, at: now.toISOString() };
  return { state: { saved: s.saved + purchase.amount, purchases: [purchase, ...s.purchases] }, purchase };
}

export function undoPurchase(s: SavingsState, id: string): SavingsState {
  const p = s.purchases.find((x) => x.id === id);
  if (!p) return s;
  return { saved: Math.max(0, s.saved - p.amount), purchases: s.purchases.filter((x) => x.id !== id) };
}

/** Money saved in the current calendar month. */
export function savedThisMonth(s: SavingsState, now = new Date()) {
  return s.purchases.filter((p) => {
    const d = new Date(p.at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).reduce((sum, p) => sum + p.amount, 0);
}
