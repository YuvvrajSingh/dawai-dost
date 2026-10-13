import { DatabaseSync } from "node:sqlite";
import { isAbsolute, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type { WhatsAppMessage } from "./whatsapp";

/** Local or persistent-volume hosting only. Never use ephemeral serverless disk. */
export function openWhatsAppStore(path = process.env.WHATSAPP_DB_PATH) {
  if (!path || !isAbsolute(path) || process.env.VERCEL) throw new Error("Configure an absolute persistent WHATSAPP_DB_PATH; Vercel needs an external storage adapter");
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, sender TEXT NOT NULL, payload TEXT, state TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, outgoing TEXT);
    CREATE TABLE IF NOT EXISTS sessions (sender TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS worker_lock (id INTEGER PRIMARY KEY, until INTEGER NOT NULL);`);
  return db;
}
export function enqueue(db: DatabaseSync, messages: WhatsAppMessage[], now = Date.now()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const m of messages) {
      const count = db.prepare("SELECT count(*) AS n FROM events WHERE sender=? AND created>?").get(m.from, now - 3600000) as { n: number };
      // Bound expensive OCR work per recipient; retain dedupe IDs even for throttled events.
      const control = ["STOP", "UNSUBSCRIBE", "DELETE", "बंद"].includes((m.text ?? "").trim().toUpperCase());
      const allowed = count.n < 30 || control;
      db.prepare("INSERT OR IGNORE INTO events(id,sender,payload,state,created) VALUES(?,?,?,?,?)")
        .run(m.id, m.from, allowed ? JSON.stringify(m) : null, allowed ? "pending" : "throttled", now);
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
