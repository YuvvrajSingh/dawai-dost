"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { translate, type Lang, type TKey } from "./i18n";
import { rupees as inr } from "./format";
import type { CompositionQuery, MyKendra, OcrResult, StockAlert } from "./types";
import { alerts as alertsApi, push as pushApi } from "./services";
import type { DemoData } from "./demo";
import { EMPTY_SAVINGS, logPurchase as addPurchase, undoPurchase, type Purchase, type SavingsState } from "./savings";

export type StockReport = { status: "in" | "out"; at: string };

export type Screen =
  | { name: "home" }
  | { name: "search"; q?: string }
  | { name: "scan" }
  | { name: "ocr-review"; imageUrl: string | null; result: OcrResult }
  | { name: "compare"; id?: string; query?: CompositionQuery }
  | { name: "detail"; id: string }
  | { name: "voice" }
  | { name: "found"; id?: string; query?: CompositionQuery }
  | { name: "saved" }
  | { name: "profile" }
  | { name: "savings" }
  | { name: "kendras" }
  | { name: "alerts" }
  | { name: "staff" };

export type Tab = "home" | "search" | "scan" | "saved" | "profile" | "savings" | "kendras";

export interface Prefs {
  lang: Lang;
  largeText: boolean;
  reduceMotion: boolean;
  saveHistory: boolean;
}

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  /** money-saved toasts get the green treatment */
  tone?: "money";
}

interface AppState {
  stack: Screen[];
  dir: number;
  current: Screen;
  push(s: Screen): void;
  replace(s: Screen): void;
  back(): void;
  tab(t: Tab): void;
  activeTab: Tab | null;
  saved: string[];
  toggleSave(id: string): boolean;
  recent: { id: string; at: string }[];
  addRecent(id: string, name?: string): void;
  /** id → display name, so saved/recent lists render instantly and offline */
  names: Record<string, string>;
  remember(id: string, name: string): void;
  recentQueries: string[];
  addQuery(q: string): void;
  clearHistory(): void;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  t(k: TKey): string;
  toast: Toast | null;
  showToast(text: string, action?: Toast["action"], tone?: Toast["tone"]): void;
  online: boolean;
  savings: SavingsState;
  /** "I bought this instead" — adds to money saved, with an undo toast. */
  logPurchase(p: Omit<Purchase, "id" | "at">): void;
  /** Stock as reported on this phone ("Was it in stock?"). No live stock feed exists. */
  stock: Record<string, StockReport>;
  reportStock(id: string, status: StockReport["status"] | null): void;
  /** The Jan Aushadhi Kendra this person buys from: stock is shown there */
  myKendra: MyKendra | null;
  setMyKendra(k: MyKendra | null): void;
  /** Restock reminders set on this phone (server keeps the source of truth) */
  /** seen: the in-app toast was shown · viewed: opened on the Alerts screen (clears the badge) */
  alerts: (StockAlert & { seen?: boolean; viewed?: boolean })[];
  markAlertsViewed(): void;
  /** Sample data for presentations is loaded (Profile → Demo data) */
  demo: boolean;
  applyDemo(d: DemoData): void;
  clearDemo(): void;
  /** Sets a "back in stock" reminder at My Kendra (or the given one). Returns false if it failed. */
  addAlert(medId: string, kendra?: MyKendra): Promise<boolean>;
  cancelAlert(id: string): void;
  refreshAlerts(): void;
}

const Ctx = createContext<AppState | null>(null);

const DEFAULT_PREFS: Prefs = { lang: "en", largeText: false, reduceMotion: false, saveHistory: true };

const SEED_RECENT: { id: string; at: string }[] = [];
/** Storage keys are versioned so old sample ids from the prototype are dropped. */
const K = { saved: "dd3.saved", recent: "dd3.recent", queries: "dd3.queries", prefs: "dd3.prefs", names: "dd3.names", savings: "dd4.savings", stock: "dd4.stock", kendra: "dd4.kendra", alerts: "dd4.alerts", demo: "dd4.demo" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage may be unavailable — app keeps working in memory */
  }
}

const TAB_ROOT: Record<Tab, Screen> = {
  home: { name: "home" },
  search: { name: "search" },
  scan: { name: "scan" },
  saved: { name: "saved" },
  profile: { name: "profile" },
  savings: { name: "savings" },
  kendras: { name: "kendras" },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [dir, setDir] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState(SEED_RECENT);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [online, setOnline] = useState(true);
  const [savings, setSavings] = useState<SavingsState>(EMPTY_SAVINGS);
  /** Mirrors `savings` synchronously so undo always acts on the latest state. */
  const savingsRef = useRef<SavingsState>(EMPTY_SAVINGS);
  const [stock, setStock] = useState<Record<string, StockReport>>({});
  const [myKendra, setMyKendraState] = useState<MyKendra | null>(null);
  const [alerts, setAlerts] = useState<(StockAlert & { seen?: boolean; viewed?: boolean })[]>([]);
  const [demo, setDemo] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    setSaved(load(K.saved, [] as string[]));
    setRecent(load(K.recent, SEED_RECENT));
    setRecentQueries(load(K.queries, [] as string[]));
    setPrefsState({ ...DEFAULT_PREFS, ...load(K.prefs, {}) });
    setNames(load(K.names, {} as Record<string, string>));
    savingsRef.current = { ...EMPTY_SAVINGS, ...load(K.savings, {}) };
    setSavings(savingsRef.current);
    setStock(load(K.stock, {} as Record<string, StockReport>));
    setMyKendraState(load(K.kendra, null as MyKendra | null));
    setAlerts(load(K.alerts, [] as StockAlert[]));
    setDemo(load(K.demo, false));
    hydrated.current = true;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (hydrated.current) persist(K.saved, saved);
  }, [saved]);
  useEffect(() => {
    if (hydrated.current) persist(K.recent, recent);
  }, [recent]);
  useEffect(() => {
    if (hydrated.current) persist(K.queries, recentQueries);
  }, [recentQueries]);
  useEffect(() => {
    if (hydrated.current) persist(K.names, names);
  }, [names]);
  useEffect(() => {
    if (hydrated.current) persist(K.savings, savings);
  }, [savings]);
  useEffect(() => {
    if (hydrated.current) persist(K.stock, stock);
  }, [stock]);
  useEffect(() => {
    if (hydrated.current) persist(K.kendra, myKendra);
  }, [myKendra]);
  useEffect(() => {
    if (hydrated.current) persist(K.alerts, alerts);
  }, [alerts]);
  useEffect(() => {
    if (hydrated.current) persist(K.demo, demo);
  }, [demo]);
  const remember = useCallback((id: string, name: string) => setNames((n) => (n[id] === name ? n : { ...n, [id]: name })), []);
  useEffect(() => {
    if (hydrated.current) persist(K.prefs, prefs);
    document.documentElement.lang = prefs.lang;
    document.documentElement.dataset.text = prefs.largeText ? "large" : "normal";
  }, [prefs]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string, action?: Toast["action"], tone?: Toast["tone"]) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, action, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone ? 4500 : 3200);
  }, []);

  const push = useCallback((s: Screen) => {
    setDir(1);
    setStack((st) => [...st, s]);
  }, []);
  const back = useCallback(() => {
    setDir(-1);
    setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  }, []);
  /** No tab bar: Home is the root, every other section opens on top of it. */
  const tab = useCallback((t: Tab) => {
    setDir(t === "home" ? -1 : 1);
    setStack(t === "home" ? [TAB_ROOT.home] : [TAB_ROOT.home, TAB_ROOT[t]]);
  }, []);
  const replace = useCallback((s: Screen) => {
    setDir(1);
    setStack((st) => [...st.slice(0, -1), s]);
  }, []);

  const logPurchase = useCallback(
    (p: Omit<Purchase, "id" | "at">) => {
      const { state, purchase } = addPurchase(savingsRef.current, p);
      savingsRef.current = state;
      setSavings(state);
      showToast(
        `${inr(purchase.amount)} saved! Added to your savings`,
        {
          label: "Undo",
          run: () => {
            savingsRef.current = undoPurchase(savingsRef.current, purchase.id);
            setSavings(savingsRef.current);
            setToast(null);
          },
        },
        "money",
      );
    },
    [showToast],
  );
  const reportStock = useCallback((id: string, status: StockReport["status"] | null) => {
    setStock((st) => {
      const next = { ...st };
      if (status) next[id] = { status, at: new Date().toISOString() };
      else delete next[id];
      return next;
    });
  }, []);

  const toggleSave = useCallback(
    (id: string) => {
      const nowSaved = !saved.includes(id);
      setSaved((s) => (nowSaved ? [id, ...s.filter((x) => x !== id)] : s.filter((x) => x !== id)));
      return nowSaved;
    },
    [saved],
  );

  const addRecent = useCallback(
    (id: string, name?: string) => {
      if (name) remember(id, name);
      if (!prefs.saveHistory) return;
      setRecent((r) => [{ id, at: new Date().toISOString() }, ...r.filter((x) => x.id !== id)].slice(0, 12));
    },
    [prefs.saveHistory, remember],
  );
  const addQuery = useCallback(
    (q: string) => {
      if (!prefs.saveHistory || !q.trim()) return;
      setRecentQueries((r) => [q.trim(), ...r.filter((x) => x.toLowerCase() !== q.trim().toLowerCase())].slice(0, 6));
    },
    [prefs.saveHistory],
  );
  const clearHistory = useCallback(() => {
    setRecent([]);
    setRecentQueries([]);
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsState((o) => ({ ...o, ...p })), []);
  const t = useCallback((k: TKey) => translate(prefs.lang, k), [prefs.lang]);

  const current = stack[stack.length - 1];
  const activeTab: Tab | null = stack.length >= 1 && (["home", "search", "scan", "saved", "profile", "savings", "kendras"] as const).includes(stack[0].name as Tab)
    ? (stack[0].name as Tab)
    : null;

  const setMyKendra = useCallback((k: MyKendra | null) => setMyKendraState(k), []);

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  /** Pulls alert status from the server; a newly fired one gets a toast (the in-app path when push isn't available). */
  const refreshAlerts = useCallback(() => {
    const mine = alertsRef.current;
    if (!mine.length) return;
    alertsApi
      .status(mine.map((a) => a.id))
      .then(({ alerts: srv }) => {
        const byId = new Map(srv.map((a) => [a.id, a]));
        const fresh = mine.filter((a) => a.status === "waiting" && byId.get(a.id)?.status === "sent");
        // Alerts the server no longer knows were cancelled or expired
        setAlerts((cur) => cur.filter((a) => byId.has(a.id)).map((a) => ({ ...a, ...byId.get(a.id)!, seen: a.seen, viewed: a.viewed })));
        const f = fresh[0] && byId.get(fresh[0].id);
        if (f) {
          showToast(`Back in stock: ${f.medName} at ${f.kendraName}`, { label: "View", run: () => push({ name: "detail", id: f.medId }) }, "money");
          setAlerts((cur) => cur.map((a) => (fresh.some((x) => x.id === a.id) ? { ...a, seen: true } : a)));
        }
      })
      .catch(() => {});
  }, [showToast, push]);

  // Check on open and every minute while the app is visible
  useEffect(() => {
    const t0 = setTimeout(refreshAlerts, 1200);
    const id = setInterval(() => document.visibilityState === "visible" && refreshAlerts(), 60_000);
    const vis = () => document.visibilityState === "visible" && refreshAlerts();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [refreshAlerts]);

  const addAlert = useCallback(
    async (medId: string, kendra?: MyKendra) => {
      const k = kendra ?? myKendra;
      if (!k) return false;
      const sub = await pushApi.subscribe();
      try {
        const a = await alertsApi.create(medId, k, sub);
        setAlerts((cur) => [a, ...cur.filter((x) => !(x.medId === medId && x.kendraId === k.id && x.status === "waiting"))]);
        showToast(sub ? "We’ll notify you when it’s back in stock" : "Reminder set. You’ll see it here when it’s back (notifications are off)");
        return true;
      } catch {
        showToast(online ? "Couldn’t set the reminder. Try again." : "You’re offline");
        return false;
      }
    },
    [myKendra, showToast, online],
  );
  const markAlertsViewed = useCallback(() => setAlerts((cur) => (cur.some((a) => a.status === "sent" && !a.viewed) ? cur.map((a) => (a.status === "sent" ? { ...a, viewed: true } : a)) : cur)), []);
  const cancelAlert = useCallback((id: string) => {
    setAlerts((cur) => cur.filter((a) => a.id !== id));
    alertsApi.cancel(id).catch(() => {});
  }, []);

  // Open a medicine from a notification tap (?med=<id> on launch, or a message from the service worker)
  useEffect(() => {
    const open = (url: string) => {
      const med = new URL(url, location.origin).searchParams.get("med");
      if (med) push({ name: "detail", id: med });
    };
    if (location.search.includes("med=")) {
      open(location.href);
      history.replaceState(null, "", location.pathname);
    }
    const onMsg = (e: MessageEvent) => e.data?.type === "open" && open(e.data.url);
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [push]);

  /** Replaces this phone's lists with the sample family's (Profile → Load demo data). */
  const applyDemo = useCallback((d: DemoData) => {
    setSaved(d.saved);
    setRecent(d.recent);
    setNames((n) => ({ ...n, ...d.names }));
    setRecentQueries(d.recentQueries);
    savingsRef.current = d.savings;
    setSavings(d.savings);
    setMyKendraState(d.myKendra);
    setAlerts(d.alerts);
    setDemo(true);
  }, []);
  const clearDemo = useCallback(() => {
    setSaved([]);
    setRecent([]);
    setRecentQueries([]);
    savingsRef.current = EMPTY_SAVINGS;
    setSavings(EMPTY_SAVINGS);
    setMyKendraState(null);
    setAlerts([]);
    setStock({});
    setDemo(false);
  }, []);

  const value = useMemo<AppState>(
    () => ({ stack, dir, current, push, replace, back, tab, activeTab, saved, toggleSave, recent, addRecent, names, remember, recentQueries, addQuery, clearHistory, prefs, setPrefs, t, toast, showToast, online, savings, logPurchase, stock, reportStock, myKendra, setMyKendra, alerts, addAlert, cancelAlert, refreshAlerts, markAlertsViewed, demo, applyDemo, clearDemo }),
    [stack, dir, current, push, replace, back, tab, activeTab, saved, toggleSave, recent, addRecent, names, remember, recentQueries, addQuery, clearHistory, prefs, setPrefs, t, toast, showToast, online, savings, logPurchase, stock, reportStock, myKendra, setMyKendra, alerts, addAlert, cancelAlert, refreshAlerts, markAlertsViewed, demo, applyDemo, clearDemo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
