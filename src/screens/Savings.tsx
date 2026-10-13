"use client";
import { motion } from "motion/react";
import { ArrowLeft, CalendarDays, ScanLine, Search, ShoppingBag } from "lucide-react";
import { useApp } from "@/lib/store";
import { listContainer, listItem } from "@/lib/motion";
import { savedThisMonth } from "@/lib/savings";
import { relativeDate, rupees } from "@/lib/format";
import { AnimatedNumber, Button, tick } from "@/components/ui/primitives";
import { RupeeMark } from "@/components/ui/savings";

export function Savings() {
  const app = useApp();
  const s = app.savings;
  const month = savedThisMonth(s);

  return (
    <div className="absolute inset-0 bg-bg">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar">
        <div className="relative overflow-hidden bg-[linear-gradient(160deg,#075a3c_0%,#0a7a52_50%,#14a06c_100%)] pb-16 text-white" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
          <span aria-hidden className="absolute -right-16 -top-10 size-56 rounded-full bg-white/[0.07]" />
          <span aria-hidden className="absolute -left-10 bottom-0 size-40 rounded-full bg-white/[0.05]" />
          <div className="relative flex h-14 items-center gap-1 px-1.5">
            <button
              onClick={() => {
                tick(6);
                app.back();
              }}
              aria-label="Go back"
              className="grid size-11 place-items-center rounded-full hover:bg-white/10"
            >
              <ArrowLeft className="size-6" strokeWidth={2} />
            </button>
            <h1 className="flex-1 pl-1 text-headline font-medium">{app.t("savings")}</h1>
          </div>
          <div className="relative flex flex-col items-center px-6 pt-1 text-center">
            <motion.div initial={{ scale: 0.6, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
              <RupeeMark size={52} />
            </motion.div>
            <p className="mt-2 text-sub text-white/80">Money saved</p>
            <AnimatedNumber value={s.saved} format={rupees} className="block text-hero font-medium" />
            <p className="mt-1.5 text-sub text-white/80">
              {s.purchases.length ? `on ${s.purchases.length} purchase${s.purchases.length > 1 ? "s" : ""} of same-composition medicines` : "by buying same-composition medicines"}
            </p>
          </div>
        </div>

        <motion.div variants={listContainer} initial="hidden" animate="show" className="relative -mt-10 space-y-7 pb-12">
          <motion.div variants={listItem} className="mx-4 flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_-14px_rgb(10_60_40/0.35),0_0_0_1px_var(--color-line)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff5d6] text-[#b37800]">
              <CalendarDays className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sub text-ink-2">This month</p>
              <p className="num text-title font-medium">{rupees(month)}</p>
            </div>
          </motion.div>

          {s.purchases.length === 0 ? (
            <motion.div variants={listItem} className="mx-4 rounded-[20px] bg-soft p-4">
              <div className="flex gap-3">
                <ShoppingBag className="mt-0.5 size-5 shrink-0 text-brand" />
                <p className="text-sub text-ink-2">Compare your medicine, open a cheaper option and tap “I bought this” after you buy it. We add the difference to your savings.</p>
              </div>
              <div className="mt-3 flex gap-2 pl-8">
                <Button size="sm" icon={<ScanLine className="size-4" />} onClick={() => app.push({ name: "scan" })}>
                  Scan a strip
                </Button>
                <Button size="sm" variant="outline" icon={<Search className="size-4" />} onClick={() => app.push({ name: "search" })}>
                  Search
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.section variants={listItem}>
              <h2 className="px-5 pb-1 text-headline font-medium">History</h2>
              <div className="px-1">
                {s.purchases.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                      <ShoppingBag className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-body">{p.to}</span>
                      <span className="line-clamp-1 block text-sub text-ink-2">
                        instead of {p.from} · {p.qty} {p.unit} · {relativeDate(p.at, app.prefs.lang)}
                      </span>
                    </span>
                    <span className="num shrink-0 text-body font-medium text-brand">+{rupees(p.amount)}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          <motion.p variants={listItem} className="px-5 text-small text-ink-2">
            Savings are worked out from listed MRPs: the brand’s price minus the same-composition medicine’s price, for the quantity you bought. They stay on this phone. {app.t("doctorNote")}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
