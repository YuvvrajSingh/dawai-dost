import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_WINDOW_MS, demoQty } from "./stock-demo";

test("demo stock: stable within a window, whole strips, sometimes out", () => {
  const t = 1_800_000_000_000;
  assert.deepEqual(demoQty("ja300", "k1", t), demoQty("ja300", "k1", t + 1000));
  let zeros = 0;
  for (let w = 0; w < 200; w++) {
    const { qty } = demoQty("ja300", "k1", t + w * DEMO_WINDOW_MS);
    assert.equal(qty % 10, 0);
    assert.ok(qty >= 0 && qty <= 310);
    if (qty === 0) zeros++;
  }
  assert.ok(zeros > 20 && zeros < 90, `about a quarter of windows are out of stock (got ${zeros})`);
});
