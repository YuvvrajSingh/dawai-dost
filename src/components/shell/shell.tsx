"use client";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowLeft, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { duration, ease, screenVariants, spring } from "@/lib/motion";
import { cx, tick } from "@/components/ui/primitives";
import { RupeeMark } from "@/components/ui/savings";

/** A screen: app bar (back + title) and its own scroll area. */
export function Screen({ title, actions, children, footer, className, onBack }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; onBack?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const app = useApp();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 4);
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={cx("absolute inset-0 flex flex-col bg-bg", className)}>
      <header className={cx("relative z-20 shrink-0 bg-bg transition-shadow duration-200", scrolled && "shadow-[0_1px_0_var(--color-line)]")} style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
        <div className="flex h-14 items-center gap-1 px-1.5">
          <button
            onClick={() => {
              tick(6);
              (onBack ?? app.back)();
            }}
            aria-label="Go back"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-soft"
          >
            <ArrowLeft className="size-6" strokeWidth={2} />
          </button>
          <h1 className="min-w-0 flex-1 truncate pl-1 text-headline font-medium">{title}</h1>
          <div className="flex items-center">{actions}</div>
        </div>
      </header>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-line bg-white px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function ToastHost() {
  const { toast } = useApp();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: duration.quick, ease: ease.exit } }}
            transition={spring.gentle}
            className={cx(
              "pointer-events-auto flex min-h-12 items-center gap-3 rounded-full py-2 pr-2 text-sub shadow-[0_6px_20px_rgb(0_0_0/0.2)]",
              toast.tone === "money" ? "bg-[linear-gradient(135deg,#075a3c,#14a06c)] pl-2.5 text-white" : "bg-[#2b2f2d] pl-5 text-white",
            )}
          >
            {toast.tone === "money" && <RupeeMark size={26} />}
            <span className={cx(toast.tone && "font-medium")}>{toast.text}</span>
            {toast.action && (
              <button onClick={toast.action.run} className={cx("h-9 rounded-full px-4 font-medium hover:bg-white/10", toast.tone === "money" ? "text-white" : "text-[#a8e0c6]")}>
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OfflineBanner() {
  const { online } = useApp();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }} transition={spring.gentle} role="status" className="absolute inset-x-3 top-[max(env(safe-area-inset-top),8px)] z-50 flex items-center gap-2.5 rounded-2xl bg-[#2b2f2d] px-4 py-3 text-sub text-white">
          <WifiOff className="size-4 shrink-0" aria-hidden /> You’re offline. Saved medicines still open.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppFrame({ children, screenKey }: { children: ReactNode; screenKey: string }) {
  const { dir, prefs } = useApp();
  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      <div className="relative flex min-h-dvh w-full items-stretch justify-center md:items-center md:py-6">
        <div className="relative h-dvh w-full overflow-hidden bg-bg md:h-[880px] md:max-h-[calc(100dvh-48px)] md:w-[410px] md:rounded-[36px] md:shadow-[0_30px_80px_-30px_rgb(20_40_30/0.35),0_0_0_1px_rgb(20_40_30/0.06)]">
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.main key={screenKey} custom={dir} variants={screenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0">
              {children}
            </motion.main>
          </AnimatePresence>
          <ToastHost />
          <OfflineBanner />
        </div>
      </div>
    </MotionConfig>
  );
}
