import "server-only";
import webpush from "web-push";
import { db, save, type Alert } from "./runtime-store";
import { stockAt } from "./stock";

// Web push for restock alerts. VAPID keys come from VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY; if those aren't set (local dev), a pair is generated once
// and kept in data/runtime so existing subscriptions keep working.

let configured = false;
export function vapidPublicKey() {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const d = db();
    if (!d.vapid) {
      d.vapid = webpush.generateVAPIDKeys();
      save();
    }
    pub = d.vapid.publicKey;
    priv = d.vapid.privateKey;
  }
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alerts@dawaidost.local", pub, priv);
    configured = true;
  }
  return pub;
}

async function notify(a: Alert, qty: number, unit: string) {
  if (!a.subscription) return;
  vapidPublicKey();
  const payload = JSON.stringify({
    title: "Back in stock",
    body: `${a.medName}: ${qty} ${unit} at ${a.kendraName}`,
    url: `/?med=${encodeURIComponent(a.medId)}`,
    tag: `restock-${a.medId}-${a.kendraId}`,
  });
  try {
    await webpush.sendNotification(a.subscription, payload, { TTL: 24 * 3600 });
  } catch (e) {
    // 404/410: the subscription is gone (permission revoked, app uninstalled)
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) a.subscription = null;
    else console.error("[push]", code, (e as Error).message);
  }
}

/** Fires every waiting alert whose medicine is now in stock at its Kendra. */
export async function checkAlerts(now = Date.now()) {
  const d = db();
  let changed = false;
  for (const a of d.alerts) {
    if (a.status !== "waiting") continue;
    const s = stockAt(a.kendraId, a.medId, a.unit, now);
    if (!s || s.qty <= 0) continue;
    a.status = "sent";
    a.sentAt = new Date(now).toISOString();
    a.qty = s.qty;
    a.unit = s.unit;
    changed = true;
    await notify(a, s.qty, s.unit);
  }
  // Forget alerts that fired more than 30 days ago
  const cutoff = now - 30 * 86_400_000;
  const before = d.alerts.length;
  d.alerts = d.alerts.filter((a) => a.status === "waiting" || new Date(a.sentAt ?? a.createdAt).getTime() > cutoff);
  if (changed || d.alerts.length !== before) save();
  return changed;
}

/**
 * Checks alerts every 30 s while the server runs (covers demo stock, which
 * changes on its own). Staff updates also trigger a check immediately. On a
 * serverless host, call POST /api/alerts/check from a cron job instead.
 */
export function ensureChecker() {
  const g = globalThis as unknown as { __ddChecker?: ReturnType<typeof setInterval> };
  if (g.__ddChecker) return;
  g.__ddChecker = setInterval(() => void checkAlerts().catch((e) => console.error("[alerts]", e)), 30_000);
  g.__ddChecker.unref?.();
}
