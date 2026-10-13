"use client";
import { AnimatePresence, motion } from "motion/react";
import { Accessibility, Bell, ChevronRight, FlaskConical, KeyRound, Store, Clock, Globe, Languages, Lock, MessageCircle, ShieldCheck, Trash2, Type, UserRound, Wind } from "lucide-react";
import { RupeeMark } from "@/components/ui/savings";
import { useEffect, useState, type ReactNode } from "react";
import { DATA_MODE, matching } from "@/lib/services";
import { buildDemo, clearDemoServer } from "@/lib/demo";
import type { MatchResult } from "@/lib/types";
import { useApp } from "@/lib/store";
import { duration, listContainer, listItem } from "@/lib/motion";
import { relativeDate, rupees } from "@/lib/format";
import { Avatar, Button, Chips, Item, Pressable, Toggle } from "@/components/ui/primitives";
import { Screen } from "@/components/shell/shell";

export function Saved() {
  const app = useApp();
  const [best, setBest] = useState<Record<string, MatchResult | null>>({});
  useEffect(() => {
    app.saved.forEach((id) =>
      matching
        .compare(id)
        .then((c) => setBest((b) => ({ ...b, [id]: c?.results.find((r) => r.status === "match") ?? null })))
        .catch(() => {}),
    );
  }, [app.saved]);
  const items = app.saved.filter((id) => app.names[id]).map((id) => ({ id, name: app.names[id], best: best[id] }));
  const history = app.recent.filter((r) => app.names[r.id] && !app.saved.includes(r.id)).map((r) => ({ ...r, name: app.names[r.id] }));

  return (
    <Screen title={app.t("yourMeds")}>
      <motion.div variants={listContainer} initial="hidden" animate="show" className="px-1 pb-10">
        {items.length === 0 && history.length === 0 && (
          <div className="px-6 pt-16 text-center">
            <h2 className="text-headline font-medium">Nothing here yet</h2>
            <p className="mx-auto mt-1.5 max-w-[28ch] text-sub text-ink-2">Save medicines you buy every month to check prices in one tap.</p>
            <Button className="mt-6" onClick={() => app.push({ name: "search" })}>
              Search a medicine
            </Button>
          </div>
        )}
        {items.length > 0 && <p className="px-4 pb-1 pt-2 text-sub font-medium text-ink-2">Saved</p>}
        <AnimatePresence initial={false}>
          {items.map(({ id, name, best: b }) => (
            <motion.div key={id} variants={listItem} layout exit={{ opacity: 0, height: 0, transition: { duration: duration.base } }}>
              <Item
                onClick={() => app.push({ name: "compare", id })}
                avatar={<Avatar name={name} />}
                title={name}
                subtitle={b === undefined ? "Checking prices…" : b && b.saving > 0 ? `Same composition from ${rupees(b.unitPrice * 30)} / 30` : "No cheaper exact match found"}
                right={b && b.saving > 0 ? <span className="text-sub font-medium text-brand">Save {Math.round(b.savingPct)}%</span> : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {history.length > 0 && (
          <>
            <p className="px-4 pb-1 pt-6 text-sub font-medium text-ink-2">Recently checked</p>
            {history.map(({ id, at, name }) => (
              <motion.div key={id + at} variants={listItem}>
                <Item onClick={() => app.push({ name: "compare", id })} avatar={<Avatar name={name} />} title={name} subtitle={relativeDate(at, app.prefs.lang)} />
              </motion.div>
            ))}
          </>
        )}
      </motion.div>
    </Screen>
  );
}

function SettingRow({ icon, title, sub, right, onClick, danger }: { icon: ReactNode; title: string; sub?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <Item
      onClick={onClick}
      avatar={<span className={danger ? "grid size-10 place-items-center rounded-full bg-red-tint text-red" : "grid size-10 place-items-center rounded-full bg-soft text-ink"}>{icon}</span>}
      title={<span className={danger ? "text-red" : undefined}>{title}</span>}
      subtitle={sub}
      right={right}
    />
  );
}

export function Profile() {
  const app = useApp();
  const { prefs, setPrefs } = app;
  const [confirmClear, setConfirmClear] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      app.applyDemo(await buildDemo());
      app.showToast("Demo data loaded");
      app.tab("home");
    } catch (e) {
      app.showToast((e as Error).message || "Couldn’t load demo data");
    }
    setDemoBusy(false);
  };
  const clearDemo = async () => {
    setDemoBusy(true);
    await clearDemoServer();
    app.clearDemo();
    setDemoBusy(false);
    app.showToast("Demo data cleared");
  };

  return (
    <Screen title="">
      <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-10">
        <motion.div variants={listItem} className="flex flex-col items-center px-6 pb-6 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-brand-tint text-brand">
            <UserRound className="size-9" strokeWidth={1.8} />
          </span>
          <h1 className="mt-3 text-title font-medium">Guest</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sub text-ink-2">
            <Lock className="size-3.5" /> Everything stays on this phone
          </p>
        </motion.div>

        <motion.div variants={listItem} className="px-4 pb-4">
          <Pressable onClick={() => app.push({ name: "savings" })} pressScale={0.98} className="relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#075a3c,#14a06c)] p-4 text-left text-white">
            <span aria-hidden className="absolute -right-8 -top-10 size-32 rounded-full bg-white/10" />
            <RupeeMark size={40} />
            <span className="relative min-w-0 flex-1">
              <span className="num block text-headline font-medium">{rupees(app.savings.saved)} saved</span>
              <span className="block text-sub text-white/80">
                {app.savings.purchases.length ? `${app.savings.purchases.length} purchase${app.savings.purchases.length > 1 ? "s" : ""} logged` : "Log purchases to track savings"}
              </span>
            </span>
            <ChevronRight className="relative size-5 text-white/80" />
          </Pressable>
        </motion.div>

        <motion.div variants={listItem} className="px-1">
          <SettingRow icon={<Bell className="size-5" />} title="Stock alerts" sub={app.alerts.some((a) => a.status === "waiting") ? `${app.alerts.filter((a) => a.status === "waiting").length} waiting for stock` : "Get notified when a medicine is back"} onClick={() => app.push({ name: "alerts" })} right={<ChevronRight className="size-5 text-ink-3" />} />
          <SettingRow icon={<Store className="size-5" />} title="My Kendra" sub={app.myKendra?.name ?? "Not set: stock is shown at your Kendra"} onClick={() => app.push({ name: "kendras" })} right={<ChevronRight className="size-5 text-ink-3" />} />
          <SettingRow icon={<Languages className="size-5" />} title={app.t("language")} right={<Chips label="Language" value={prefs.lang} onChange={(l) => setPrefs({ lang: l })} options={[{ value: "en", label: "EN" }, { value: "hi", label: "हिं" }]} />} />
          <SettingRow icon={<Type className="size-5" />} title="Larger text" right={<Toggle id="pref-large" label="Larger text" checked={prefs.largeText} onChange={(v) => setPrefs({ largeText: v })} />} />
          <SettingRow icon={<Wind className="size-5" />} title="Reduce motion" right={<Toggle id="pref-motion" label="Reduce motion" checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />} />
          <SettingRow icon={<Clock className="size-5" />} title="Keep search history" right={<Toggle id="pref-history" label="Keep search history" checked={prefs.saveHistory} onChange={(v) => setPrefs({ saveHistory: v })} />} />
          <AnimatePresence mode="wait" initial={false}>
            {confirmClear ? (
              <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-4 py-3">
                <span className="flex-1 text-body">Delete all history?</span>
                <Button size="sm" variant="outline" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    app.clearHistory();
                    setConfirmClear(false);
                    app.showToast("History deleted");
                  }}
                >
                  Delete
                </Button>
              </motion.div>
            ) : (
              <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SettingRow danger icon={<Trash2 className="size-5" />} title="Clear search history" onClick={() => setConfirmClear(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={listItem} className="px-1 pt-2">
          <SettingRow icon={<KeyRound className="size-5" />} title="For Kendra staff" sub="Update your Kendra’s stock" onClick={() => app.push({ name: "staff" })} right={<ChevronRight className="size-5 text-ink-3" />} />
        </motion.div>

        <motion.div variants={listItem} className="mx-4 mt-6 rounded-[20px] border border-dashed border-[#e0b46b] bg-amber-tint/60 p-4">
          <p className="flex items-center gap-2 text-sub font-medium">
            <FlaskConical className="size-4 text-amber" /> Demo data {app.demo && <span className="rounded-full bg-amber px-2 py-px text-small text-white">On</span>}
          </p>
          <p className="mt-1 text-small text-ink-2">
            Fills the app for a presentation: six saved medicines, four months of savings from switching to Jan Aushadhi, a demo Kendra with stock, and two stock reminders. Prices are real listed MRPs. Replaces your saved list and savings on this phone.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={demoBusy && !app.demo} disabled={demoBusy} onClick={loadDemo}>
              {app.demo ? "Reload demo data" : "Load demo data"}
            </Button>
            {app.demo && (
              <Button size="sm" variant="outline" loading={demoBusy} disabled={demoBusy} onClick={clearDemo}>
                Clear demo data
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div variants={listItem} className="mx-4 mt-4 rounded-[20px] bg-soft p-4">
          <p className="text-sub font-medium">Connections</p>
          <ul className="mt-2 space-y-2 text-sub text-ink-2">
            <li className="flex justify-between">
              <span className="flex items-center gap-2"><Globe className="size-4" /> Medicine prices</span>
              <span>{DATA_MODE === "api" ? "Public MRP lists" : "Offline subset"}</span>
            </li>
            <li className="flex justify-between">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Strip reader</span>
              <span>Gemini (needs key)</span>
            </li>
            <li className="flex justify-between">
              <span className="flex items-center gap-2"><Accessibility className="size-4" /> Voice</span>
              <span>On this phone</span>
            </li>
            <li className="flex justify-between">
              <span className="flex items-center gap-2"><MessageCircle className="size-4" /> WhatsApp</span>
              <span>Coming soon</span>
            </li>
          </ul>
        </motion.div>

        <motion.p variants={listItem} className="px-5 pt-5 text-small text-ink-2">
          Dawai Dost compares medicine composition and prices. It doesn’t prescribe. Prices come from the Indian Medicine Dataset (MIT) and the Jan Aushadhi MRP list. Version 0.4.
        </motion.p>
      </motion.div>
    </Screen>
  );
}
