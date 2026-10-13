"use client";
import { motion } from "motion/react";
import { Bell, Bookmark, ChevronRight, PiggyBank, House, MapPin, Mic, Plus, ScanLine, Search, Share2, ShieldCheck, Store, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { matching } from "@/lib/services";
import { POPULAR_QUERIES } from "@/lib/engine";
import { useApp, type Tab } from "@/lib/store";
import { listContainer, listItem, spring } from "@/lib/motion";
import { rupees } from "@/lib/format";
import { Action, AnimatedNumber, Avatar, cx, Pressable, SectionTitle, tick } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/medicine";
import { RupeeMark } from "@/components/ui/savings";
import type { TKey } from "@/lib/i18n";

function greeting(): TKey {
  const h = new Date().getHours();
  return h < 12 ? "greetingMorning" : h < 17 ? "greetingAfternoon" : "greetingEvening";
}

export function Home() {
  const app = useApp();
  const { t, prefs, setPrefs, push, tab, savings } = app;
  const backInStock = app.alerts.filter((a) => a.status === "sent" && !a.viewed).length;

  // Saved first, then recent, de-duplicated
  const meds = useMemo(() => {
    const ids = [...app.saved, ...app.recent.map((r) => r.id)].filter((id, i, a) => a.indexOf(id) === i && app.names[id]);
    return ids.map((id) => ({ id, name: app.names[id] })).slice(0, 7);
  }, [app.saved, app.recent, app.names]);

  // Possible saving across saved medicines (30 units each), from the live comparison API
  const [save, setSave] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all(app.saved.slice(0, 8).map((id) => matching.compare(id).catch(() => null))).then((cs) => {
      if (!live) return;
      setSave(cs.reduce((sum, c) => sum + Math.max(0, c?.results.find((r) => r.status === "match")?.saving ?? 0), 0));
    });
    return () => {
      live = false;
    };
  }, [app.saved]);

  return (
    <div className="absolute inset-0 bg-bg">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar">
        <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-32">
          {/* Brand header */}
          <div className="relative overflow-hidden bg-[linear-gradient(160deg,#075a3c_0%,#0a7a52_50%,#14a06c_100%)] pb-20 text-white" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}>
            <span aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full bg-white/[0.06]" />
            <span aria-hidden className="absolute -left-16 top-24 size-44 rounded-full bg-white/[0.04]" />
            <svg aria-hidden className="absolute right-6 top-20 size-24 rotate-[-30deg] opacity-[0.09]" viewBox="0 0 40 16">
              <rect width="40" height="16" rx="8" fill="#fff" />
            </svg>

            <motion.div variants={listItem} className="relative flex h-14 items-center gap-2.5 px-4">
              <span className="rounded-full ring-2 ring-white/30">
                <Logo size={34} />
              </span>
              <span className="flex-1 text-[1.25rem] font-medium tracking-[-0.01em]">Dawai Dost</span>
              <Pressable onClick={() => tab("savings")} pressScale={0.92} aria-label={`${rupees(savings.saved)} saved. Open savings`} className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 pl-1.5 pr-3 text-sub font-medium hover:bg-white/20">
                <RupeeMark size={24} />
                <AnimatedNumber value={savings.saved} format={rupees} />
              </Pressable>
              <button
                onClick={() => setPrefs({ lang: prefs.lang === "en" ? "hi" : "en" })}
                aria-label={prefs.lang === "en" ? "हिंदी में बदलें" : "Switch to English"}
                className="h-9 rounded-full bg-white/15 px-3 text-sub font-medium hover:bg-white/20"
              >
                {prefs.lang === "en" ? "हिं" : "EN"}
              </button>
              <Pressable onClick={() => push({ name: "alerts" })} pressScale={0.92} aria-label={`Stock alerts${backInStock ? `, ${backInStock} back in stock` : ""}`} className="relative grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/20">
                <Bell className="size-[18px]" />
                {backInStock > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#ffcf3f] text-[0.625rem] font-semibold text-[#075a3c] ring-2 ring-[#0a7a52]">{backInStock}</span>}
              </Pressable>
            </motion.div>

            <motion.div variants={listItem} className="relative px-5 pt-4">
              <p className="text-sub text-white/75">{t(greeting())} 👋</p>
              <h1 className="mt-1 max-w-[16ch] text-[1.625rem] font-medium leading-[1.2] tracking-[-0.01em]">{t("homeTitle")}</h1>
            </motion.div>

            {/* Search pill */}
            <motion.div variants={listItem} className="relative px-4 pt-5">
              <motion.button
                layoutId="search-field"
                transition={spring.layout}
                onClick={() => push({ name: "search" })}
                className="flex h-14 w-full items-center gap-3 rounded-full bg-white pl-5 pr-2 text-left shadow-[0_8px_24px_-10px_rgb(0_0_0/0.35)]"
              >
                <Search className="size-5 text-ink-2" strokeWidth={2} aria-hidden />
                <span className="flex-1 text-body text-ink-2">{t("searchPill")}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Search by voice"
                  onClick={(e) => {
                    e.stopPropagation();
                    push({ name: "voice" });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), push({ name: "voice" }))}
                  className="grid size-10 place-items-center rounded-full bg-brand-tint text-brand"
                >
                  <Mic className="size-5" strokeWidth={2} />
                </span>
              </motion.button>
            </motion.div>
          </div>

          {/* Actions card, overlapping the header */}
          <motion.div variants={listItem} className="relative -mt-12 px-4">
            <div className="grid grid-cols-4 gap-1 rounded-[24px] bg-white px-2 py-5 shadow-[0_12px_32px_-16px_rgb(10_60_40/0.35),0_0_0_1px_var(--color-line)]">
              <Action tint="green" icon={<ScanLine className="size-6" strokeWidth={2} />} label={t("scanStrip")} onClick={() => tab("scan")} />
              <Action tint="blue" icon={<MapPin className="size-6" strokeWidth={2} />} label={t("findKendra")} onClick={() => tab("kendras")} />
              <Action tint="orange" icon={<Mic className="size-6" strokeWidth={2} />} label={t("speak")} onClick={() => push({ name: "voice" })} />
              <Action tint="purple" icon={<Bookmark className="size-6" strokeWidth={2} />} label={t("saved")} onClick={() => tab("saved")} />
            </div>
          </motion.div>

          {/* Quick tiles: money saved + Kendras */}
          <motion.div variants={listItem} className="grid grid-cols-2 gap-3 px-4 pt-4">
            <Pressable onClick={() => tab("savings")} pressScale={0.97} className="relative flex items-center gap-3 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#0a7a52,#14a06c)] p-3.5 text-left text-white">
              <span aria-hidden className="absolute -right-6 -top-6 size-20 rounded-full bg-white/10" />
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/20">
                <PiggyBank className="size-5" />
              </span>
              <span className="relative min-w-0">
                <span className="num block text-sub font-medium">{rupees(savings.saved)}</span>
                <span className="block truncate text-small text-white/80">{t("moneySaved")}</span>
              </span>
            </Pressable>
            <Pressable onClick={() => tab("kendras")} pressScale={0.97} className="relative flex items-center gap-3 overflow-hidden rounded-[20px] bg-[#fff4ea] p-3.5 text-left">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ff922b,#e8590c)] text-white">
                <Store className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sub font-medium text-ink">{t("kendras")}</span>
                <span className="block truncate text-small text-ink-2">{t("nearYou")}</span>
              </span>
            </Pressable>
          </motion.div>

          {/* Savings banner */}
          {save > 0 && (
            <motion.div variants={listItem} className="px-4 pt-4">
              <Pressable onClick={() => tab("saved")} pressScale={0.98} className="relative w-full overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0a7a52,#14a06c)] px-5 py-5 text-left text-white">
                <span aria-hidden className="absolute -right-10 -top-16 size-48 rounded-full bg-white/[0.08]" />
                <span aria-hidden className="absolute -bottom-20 right-10 size-40 rounded-full bg-white/[0.06]" />
                <span className="relative block text-sub text-white/80">{t("saveUpTo")}</span>
                <AnimatedNumber value={save} format={rupees} className="relative block text-[2.5rem] font-medium leading-tight tracking-[-0.02em]" />
                <span className="relative mt-0.5 flex items-center justify-between gap-3 text-sub text-white/80">
                  {t("onSavedShort")}
                  <ChevronRight className="size-5 shrink-0" />
                </span>
              </Pressable>
            </motion.div>
          )}

          {/* Offers carousel */}
          <motion.div variants={listItem} className="pt-7">
            <Offers />
          </motion.div>

          {/* Your medicines — like "People" in GPay */}
          <motion.section variants={listItem} className="pt-7">
            <SectionTitle>{t("yourMeds")}</SectionTitle>
            <div className="grid grid-cols-4 gap-y-5 px-3 pt-2">
              {meds.map((m) => (
                <Pressable key={m.id} onClick={() => push({ name: "compare", id: m.id })} pressScale={0.92} className="flex flex-col items-center gap-2">
                  <Avatar name={m.name} size={56} />
                  <span className="line-clamp-2 max-w-[78px] text-center text-small leading-tight text-ink">{m.name}</span>
                </Pressable>
              ))}
              <Pressable onClick={() => push({ name: "search" })} pressScale={0.92} className="flex flex-col items-center gap-2">
                <span className="grid size-14 place-items-center rounded-full border border-dashed border-ink-3 text-ink-2">
                  <Plus className="size-6" />
                </span>
                <span className="text-small text-ink-2">{t("addMed")}</span>
              </Pressable>
            </div>
            {meds.length === 0 && (
              <div className="px-5 pt-5">
                <p className="text-sub text-ink-2">Try a common medicine</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {POPULAR_QUERIES.map((q) => (
                    <button key={q} onClick={() => push({ name: "search", q })} className="h-9 rounded-full border border-line bg-white px-4 text-sub hover:bg-soft">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.section>

          {/* Trust */}
          <motion.div variants={listItem} className="px-4 pt-8">
            <div className="flex gap-3 rounded-[20px] bg-soft p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={2} />
              <p className="text-sub text-ink-2">
                {t("safeNote")} {t("sampleNote")}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <BottomNav active="home" />
    </div>
  );
}

// ── Offers carousel ───────────────────────────────────────
function Offers() {
  const { t, tab, push } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const offers: { title: string; sub: string; cta: string; bg: string; art: ReactNode; run: () => void }[] = [
    { title: t("offerScanTitle"), sub: t("offerScanSub"), cta: t("scanNow"), bg: "linear-gradient(135deg,#3a1fb8,#7b4dff)", art: <ScanLine className="size-9" />, run: () => tab("scan") },
    { title: t("offerJaTitle"), sub: t("offerJaSub"), cta: t("compareNow"), bg: "linear-gradient(135deg,#d9480f,#ff922b)", art: <Store className="size-9" />, run: () => push({ name: "kendras" }) },
    { title: t("offerShareTitle"), sub: t("offerShareSub"), cta: t("findMed"), bg: "linear-gradient(135deg,#1554c7,#3cb4ff)", art: <Share2 className="size-9" />, run: () => push({ name: "search" }) },
  ];

  // Auto-advance like the banners in UPI apps; pauses while the user is touching it
  const touching = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = setInterval(() => {
      if (touching.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % offers.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(id);
  }, [offers.length]);

  return (
    <div>
      <div
        ref={ref}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => (touching.current = true)}
        onPointerUp={() => (touching.current = false)}
        onPointerLeave={() => (touching.current = false)}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        aria-roledescription="carousel"
      >
        {offers.map((o, k) => (
          <div key={k} className="w-full shrink-0 snap-center px-4" aria-roledescription="slide" aria-label={`${k + 1} of ${offers.length}`}>
            <Pressable onClick={o.run} pressScale={0.98} className="relative flex h-[132px] w-full items-center overflow-hidden rounded-[24px] p-5 text-left text-white" style={{ background: o.bg }}>
              <span aria-hidden className="absolute -right-8 -top-10 size-40 rounded-full bg-white/10" />
              <span aria-hidden className="absolute -bottom-14 right-16 size-28 rounded-full bg-white/[0.07]" />
              <span className="relative min-w-0 flex-1 pr-3">
                <span className="block text-body font-medium leading-snug">{o.title}</span>
                <span className="mt-1 line-clamp-2 block text-small text-white/80">{o.sub}</span>
                <span className="mt-3 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-small font-medium text-ink">
                  {o.cta} <ChevronRight className="size-3.5" />
                </span>
              </span>
              <span className="relative grid size-16 shrink-0 rotate-[-8deg] place-items-center rounded-[20px] bg-white/20">{o.art}</span>
            </Pressable>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {offers.map((_, k) => (
          <motion.span key={k} className={cx("h-1.5 rounded-full", k === i ? "bg-brand" : "bg-soft-2")} animate={{ width: k === i ? 18 : 6 }} transition={spring.snappy} />
        ))}
      </div>
    </div>
  );
}

// ── Bottom navigation (PhonePe / Paytm style, raised scan button) ──
export function BottomNav({ active }: { active: Tab }) {
  const { t, tab } = useApp();
  const item = (key: Tab, label: string, icon: ReactNode) => (
    <button
      onClick={() => {
        tick(6);
        if (key !== active) tab(key);
      }}
      aria-current={key === active ? "page" : undefined}
      className={cx("relative flex flex-1 flex-col items-center gap-1 pt-2.5 text-small font-medium transition-colors", key === active ? "text-brand" : "text-ink-2 hover:text-ink")}
    >
      <span className={cx("relative grid h-7 w-14 place-items-center rounded-full transition-colors", key === active && "bg-brand-tint")}>
        {icon}
      </span>
      {label}
    </button>
  );
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }} aria-label="Main">
      <div className="flex items-start">
        {item("home", t("home"), <House className="size-[22px]" strokeWidth={2} />)}
        {item("savings", t("savings"), <PiggyBank className="size-[22px]" strokeWidth={2} />)}
        <div className="flex flex-1 flex-col items-center">
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring.gentle, delay: 0.15 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              tick(10);
              tab("scan");
            }}
            aria-label={t("scanStrip")}
            className="-mt-6 grid size-[60px] place-items-center rounded-full bg-[linear-gradient(135deg,#0a7a52,#14a06c)] text-white shadow-[0_10px_24px_-8px_rgb(10_122_82/0.7)] ring-[5px] ring-white"
          >
            <ScanLine className="size-7" strokeWidth={2} />
          </motion.button>
          <span className="mt-1 text-small font-medium text-ink">{t("scan")}</span>
        </div>
        {item("kendras", t("kendrasShort"), <Store className="size-[22px]" strokeWidth={2} />)}
        {item("profile", t("profile"), <UserRound className="size-[22px]" strokeWidth={2} />)}
      </div>
    </nav>
  );
}
