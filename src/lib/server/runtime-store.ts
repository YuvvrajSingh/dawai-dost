import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PushSubscription } from "web-push";

// Server-side state that changes at runtime: stock entered by Kendra staff,
// restock alerts, and the push keys. Kept in one JSON file so the app runs
// with no database. For a multi-instance deployment (e.g. Vercel), swap this
// module for a real database — every read and write goes through it.

export interface StockEntry {
  qty: number;
  unit: string;
  /** medicine name, so staff lists render without a catalog lookup */
  name: string;
  at: string;
}

export interface KendraStock {
  name: string;
  items: Record<string, StockEntry>;
}

export interface Alert {
  id: string;
  medId: string;
  medName: string;
  kendraId: string;
  kendraName: string;
  /** null when the browser can't do push; the app then shows it on next open */
  subscription: PushSubscription | null;
  status: "waiting" | "sent";
  createdAt: string;
  sentAt?: string;
  /** quantity when it came back in stock */
  qty?: number;
  unit?: string;
}

interface Db {
  stock: Record<string, KendraStock>;
  alerts: Alert[];
  vapid?: { publicKey: string; privateKey: string };
}

const DIR = path.join(process.cwd(), "data", "runtime");
const FILE = path.join(DIR, "state.json");

const g = globalThis as unknown as { __ddDb?: Db };

export function db(): Db {
  if (g.__ddDb) return g.__ddDb;
  try {
    g.__ddDb = { stock: {}, alerts: [], ...JSON.parse(readFileSync(FILE, "utf8")) } as Db;
  } catch {
    g.__ddDb = { stock: {}, alerts: [] };
  }
  return g.__ddDb;
}

/** Writes the whole state atomically (write temp file, then rename). */
export function save() {
  mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db(), null, 1));
  renameSync(tmp, FILE);
}
