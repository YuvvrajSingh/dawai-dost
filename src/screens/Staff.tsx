"use client";
import { motion } from "motion/react";
import { KeyRound, Minus, PackageCheck, Plus, Search, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { catalog, kendraStock } from "@/lib/services";
import { useApp } from "@/lib/store";
import { listContainer, listItem } from "@/lib/motion";
import type { Medicine, MyKendra } from "@/lib/types";
import { Avatar, Button, cx, tick } from "@/components/ui/primitives";
import { Screen } from "@/components/shell/shell";
import { NearbyKendras } from "@/components/ui/kendras";

type Entry = { id: string; name: string; qty: number; unit: string; at: string };

/** For Kendra staff: enter how much of each Jan Aushadhi medicine is on the shelf. */
export function Staff() {
  const app = useApp();
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [kendra, setKendra] = useState<MyKendra | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const loadEntries = useCallback(
    (k: MyKendra) =>
      kendraStock
        .list(pin, k.id)
        .then((r) => setEntries(r.items))
        .catch(() => setEntries([])),
    [pin],
  );

  const signIn = async () => {
    setChecking(true);
    setErr(null);
    try {
      // Any staff-only call verifies the PIN
      await kendraStock.list(pin, "pin-check");
      setOk(true);
    } catch (e) {
      setErr((e as { status?: number }).status === 403 ? "That PIN isn’t right." : "Couldn’t check the PIN. Try again.");
    }
    setChecking(false);
  };

  useEffect(() => {
    if (kendra) loadEntries(kendra);
  }, [kendra, loadEntries]);

  return (
    <Screen title="Update Kendra stock">
      <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-10">
        {!ok ? (
          <motion.form
            variants={listItem}
            onSubmit={(e) => {
              e.preventDefault();
              if (pin) signIn();
            }}
            className="px-5 pt-4"
          >
            <span className="grid size-14 place-items-center rounded-full bg-[#fff1e6] text-[#e8590c]">
              <KeyRound className="size-7" />
            </span>
            <h2 className="mt-4 text-title font-medium">For Kendra staff</h2>
            <p className="mt-1 text-sub text-ink-2">Enter the staff PIN to update how many of each medicine your Kendra has. Customers waiting for a medicine get notified when you restock it.</p>
            <label htmlFor="staff-pin" className="mt-6 block text-sub font-medium">
              Staff PIN
            </label>
            <input
              id="staff-pin"
              inputMode="numeric"
              autoComplete="off"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.trim())}
              className="mt-2 h-14 w-full rounded-2xl border border-line bg-white px-4 text-headline tracking-[0.3em] outline-none focus:border-brand"
            />
            {err && <p className="mt-2 text-sub text-red">{err}</p>}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={checking} disabled={!pin}>
              Continue
            </Button>
          </motion.form>
        ) : !kendra ? (
          <motion.div variants={listItem} className="pt-2">
            <p className="px-5 pb-3 text-sub text-ink-2">Which Kendra are you updating?</p>
            <NearbyKendras onPick={setKendra} pickLabel="Select" />
          </motion.div>
        ) : (
          <>
            <motion.div variants={listItem} className="mx-4 flex items-center gap-3 rounded-[20px] bg-[#fff4ea] p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ff922b,#e8590c)] text-white">
                <Store className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-small text-ink-2">Updating stock for</span>
                <span className="line-clamp-1 block text-sub font-medium">{kendra.name}</span>
              </span>
              <button onClick={() => setKendra(null)} className="h-8 rounded-full px-3 text-small font-medium text-brand hover:bg-white/60">
                Change
              </button>
            </motion.div>

            <motion.div variants={listItem}>
              <AddStock pin={pin} kendra={kendra} onSaved={() => loadEntries(kendra)} />
            </motion.div>

            <motion.section variants={listItem} className="pt-6">
              <h2 className="px-5 pb-1 text-headline font-medium">Stock you’ve entered</h2>
              {entries.length === 0 ? (
                <p className="px-5 pt-1 text-sub text-ink-2">Nothing yet. Search a medicine above to add its quantity.</p>
              ) : (
                entries.map((e) => <EntryRow key={e.id} e={e} pin={pin} kendra={kendra} onSaved={() => loadEntries(kendra)} />)
              )}
            </motion.section>
          </>
        )}
        {app.myKendra && !ok && <p className="px-5 pt-6 text-small text-ink-3">Customers see this stock on medicines’ pages and in comparisons.</p>}
      </motion.div>
    </Screen>
  );
}

function QtyInput({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Remove 10" onClick={() => (tick(6), onChange(Math.max(0, value - 10)))} className="grid size-11 place-items-center rounded-full bg-soft text-ink hover:bg-soft-2">
        <Minus className="size-5" />
      </button>
      <label className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-white px-4 focus-within:border-brand">
        <span className="sr-only">Quantity in {unit}</span>
        <input
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => onChange(Math.min(100_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
          className="num w-full min-w-0 bg-transparent text-center text-headline outline-none"
        />
        <span className="shrink-0 text-small text-ink-2">{unit}</span>
      </label>
      <button type="button" aria-label="Add 10" onClick={() => (tick(6), onChange(value + 10))} className="grid size-11 place-items-center rounded-full bg-soft text-ink hover:bg-soft-2">
        <Plus className="size-5" />
      </button>
    </div>
  );
}

function AddStock({ pin, kendra, onSaved }: { pin: string; kendra: MyKendra; onSaved: () => void }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [pick, setPick] = useState<Medicine | null>(null);
  const [qty, setQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    setSearching(true);
    let live = true;
    const t = setTimeout(
      () =>
        catalog
          .search(q.trim(), "generic")
          .then((r) => live && setResults(r.results.filter((m) => m.market === "jan-aushadhi").slice(0, 6)))
          .catch(() => live && setResults([]))
          .finally(() => live && setSearching(false)),
      300,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const save = async () => {
    if (!pick) return;
    setSaving(true);
    try {
      await kendraStock.set(pin, kendra, pick.id, qty);
      app.showToast(qty > 0 ? `Saved: ${qty} ${pick.price.packUnit} of ${pick.name}` : `Marked ${pick.name} out of stock`);
      setPick(null);
      setQ("");
      setQty(0);
      onSaved();
    } catch (e) {
      app.showToast((e as Error).message || "Couldn’t save. Try again.");
    }
    setSaving(false);
  };

  return (
    <div className="px-4 pt-5">
      {!pick ? (
        <>
          <label className="flex h-12 items-center gap-3 rounded-full bg-soft px-4">
            <Search className="size-5 text-ink-2" />
            <span className="sr-only">Search a Jan Aushadhi medicine</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a Jan Aushadhi medicine" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-2" />
          </label>
          {results.map((m) => (
            <button key={m.id} onClick={() => (tick(6), setPick(m))} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-soft/60">
              <Avatar name={m.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 block text-body">{m.name}</span>
                <span className="block text-small text-ink-2">
                  Pack of {m.price.packSize} {m.price.packUnit}
                </span>
              </span>
            </button>
          ))}
          {q.trim().length >= 2 && !searching && results.length === 0 && <p className="px-2 pt-3 text-sub text-ink-2">No Jan Aushadhi medicine matches “{q}”.</p>}
        </>
      ) : (
        <div className="rounded-[20px] border border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={pick.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-body">{pick.name}</span>
              <span className="block text-small text-ink-2">How many {pick.price.packUnit} are on the shelf?</span>
            </span>
          </div>
          <div className="mt-4">
            <QtyInput value={qty} onChange={setQty} unit={pick.price.packUnit} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPick(null)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={saving} icon={<PackageCheck className="size-[18px]" />} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({ e, pin, kendra, onSaved }: { e: Entry; pin: string; kendra: MyKendra; onSaved: () => void }) {
  const app = useApp();
  const [edit, setEdit] = useState(false);
  const [qty, setQty] = useState(e.qty);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await kendraStock.set(pin, kendra, e.id, qty);
      app.showToast("Stock updated");
      setEdit(false);
      onSaved();
    } catch (err) {
      app.showToast((err as Error).message || "Couldn’t save. Try again.");
    }
    setSaving(false);
  };
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 block text-body">{e.name}</span>
          <span className="block text-small text-ink-2">Updated {relative(e.at)}</span>
        </span>
        <span className={cx("num shrink-0 rounded-full px-2.5 py-0.5 text-small font-medium", e.qty > 0 ? "bg-brand-tint text-brand-ink" : "bg-red-tint text-red")}>{e.qty > 0 ? `${e.qty} ${e.unit}` : "Out of stock"}</span>
        <button onClick={() => (setQty(e.qty), setEdit((x) => !x))} className="h-8 shrink-0 rounded-full px-3 text-small font-medium text-brand hover:bg-soft">
          {edit ? "Close" : "Edit"}
        </button>
      </div>
      {edit && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <QtyInput value={qty} onChange={setQty} unit={e.unit} />
          </div>
          <Button size="sm" loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function relative(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
