// Simulated Jan Aushadhi stock for demos. There is no public stock feed, so
// when STOCK_DEMO is on and Kendra staff haven't entered a figure, quantities
// come from here and the app labels them "Demo stock". Deterministic: the same
// medicine at the same Kendra gives the same answer within a time window, and
// it changes between windows so restock alerts can be seen firing.

/** Each window lasts this long; roughly 1 in 4 windows is out of stock. */
export const DEMO_WINDOW_MS = 3 * 60_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function demoQty(medId: string, kendraId: string, now = Date.now()) {
  const w = Math.floor(now / DEMO_WINDOW_MS);
  const h = hash(`${medId}|${kendraId}|${w}`);
  if (h % 4 === 0) return { qty: 0, at: new Date(w * DEMO_WINDOW_MS).toISOString() };
  // Multiples of 10 — Kendras count strips of 10
  return { qty: 10 * (2 + (h % 30)), at: new Date(w * DEMO_WINDOW_MS).toISOString() };
}
