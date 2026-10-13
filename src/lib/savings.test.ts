import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SAVINGS, logPurchase, savedThisMonth, undoPurchase } from "./savings";

test("savings: purchases add money saved and can be undone", () => {
  const { state, purchase } = logPurchase(EMPTY_SAVINGS, { from: "Glycomet 500", to: "Metformin JA", qty: 30, unit: "tablets", amount: 54.6 });
  assert.equal(state.saved, 55);
  assert.equal(state.purchases.length, 1);
  const back = undoPurchase(state, purchase.id);
  assert.equal(back.saved, 0);
  assert.equal(back.purchases.length, 0);
  assert.equal(undoPurchase(back, "missing"), back);
});

test("savings: negative savings are never logged", () => {
  assert.equal(logPurchase(EMPTY_SAVINGS, { from: "a", to: "b", qty: 10, unit: "tablets", amount: -20 }).state.saved, 0);
});

test("savings: this month only counts this month's purchases", () => {
  let s = logPurchase(EMPTY_SAVINGS, { from: "a", to: "b", qty: 30, unit: "tablets", amount: 100 }, new Date(2026, 8, 20)).state;
  s = logPurchase(s, { from: "a", to: "b", qty: 30, unit: "tablets", amount: 40 }, new Date(2026, 9, 2)).state;
  assert.equal(savedThisMonth(s, new Date(2026, 9, 13)), 40);
  assert.equal(s.saved, 140);
});
