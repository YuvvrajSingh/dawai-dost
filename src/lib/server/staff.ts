import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Kendra staff sign-in is a shared PIN (KENDRA_STAFF_PIN). In development it
 * defaults to 1234; in production staff updates stay off until a PIN is set.
 * Per-Kendra accounts are the next step once Kendras are onboarded.
 */
export function staffPin(): string | null {
  return process.env.KENDRA_STAFF_PIN || (process.env.NODE_ENV === "production" ? null : "1234");
}

export function checkPin(given: string | null | undefined) {
  const pin = staffPin();
  if (!pin || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}
