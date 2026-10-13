"use client";
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { forwardRef, useEffect, type ReactNode } from "react";
import { duration, spring } from "@/lib/motion";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Light haptic tick on Android where supported. */
export const tick = (ms = 8) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {}
};

// ── Pressable ─────────────────────────────────────────────
type PressableProps = HTMLMotionProps<"button"> & { pressScale?: number; haptic?: boolean };
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { pressScale = 0.96, haptic = true, onClick, className, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={rest.disabled || pressScale === 1 ? undefined : { scale: pressScale }}
      transition={spring.press}
      onClick={(e) => {
        if (haptic) tick();
        onClick?.(e);
      }}
      className={cx("select-none touch-manipulation disabled:cursor-not-allowed", className)}
      {...rest}
    />
  );
});

// ── Pill button ───────────────────────────────────────────
type BtnVariant = "primary" | "outline" | "tonal" | "light" | "dark" | "danger";
const variants: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-press disabled:bg-soft-2 disabled:text-ink-3",
  outline: "bg-white text-brand border border-line hover:bg-soft",
  tonal: "bg-brand-tint text-brand-ink hover:bg-[#d4ecdf]",
  light: "bg-white text-ink hover:bg-white/90",
  dark: "bg-white/14 text-white hover:bg-white/20",
  danger: "bg-red text-white",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  success,
  icon,
  children,
  className,
  ...rest
}: Omit<PressableProps, "children"> & { children?: ReactNode; variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean; success?: boolean; icon?: ReactNode }) {
  const h = size === "lg" ? "h-14 px-7 text-body" : size === "sm" ? "h-9 px-4 text-sub" : "h-12 px-6 text-body";
  return (
    <Pressable className={cx("relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-200", h, variants[variant], className)} aria-busy={loading || undefined} {...rest}>
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.quick }}>
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </motion.span>
        ) : success ? (
          <motion.span key="s" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={spring.snappy}>
            <Check className="size-5" strokeWidth={2.6} aria-hidden />
          </motion.span>
        ) : (
          <motion.span key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.quick }} className="inline-flex items-center gap-2">
            {icon}
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </Pressable>
  );
}

export function IconButton({ label, children, className, ...rest }: PressableProps & { label: string }) {
  return (
    <Pressable aria-label={label} pressScale={0.9} className={cx("grid size-11 place-items-center rounded-full transition-colors hover:bg-soft", className)} {...rest}>
      {children}
    </Pressable>
  );
}

// ── Round action (GPay / PhonePe style) ───────────────────
const TINTS = {
  green: "bg-brand-tint text-brand",
  blue: "bg-[#e8eefc] text-[#2a56c6]",
  orange: "bg-[#fdeee4] text-[#c2551a]",
  purple: "bg-[#efeaff] text-[#5b3df5]",
} as const;
export function Action({ icon, label, onClick, tint = "green" }: { icon: ReactNode; label: string; onClick: () => void; tint?: keyof typeof TINTS }) {
  return (
    <Pressable onClick={onClick} pressScale={0.92} className="flex flex-col items-center gap-2">
      <span className={cx("grid size-14 place-items-center rounded-[18px]", TINTS[tint])}>{icon}</span>
      <span className="max-w-[76px] text-center text-small font-medium leading-tight text-ink">{label}</span>
    </Pressable>
  );
}

// ── Chips ─────────────────────────────────────────────────
export function Chips<T extends string>({ options, value, onChange, label, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("flex gap-2 overflow-x-auto no-scrollbar", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => {
              tick(6);
              onChange(o.value);
            }}
            className={cx(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sub font-medium transition-colors duration-200",
              on ? "border-brand bg-brand-tint text-brand-ink" : "border-line bg-white text-ink-2 hover:bg-soft",
            )}
          >
            <AnimatePresence initial={false}>
              {on && (
                <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: duration.quick }} className="-ml-1 overflow-hidden">
                  <Check className="size-4" strokeWidth={2.5} />
                </motion.span>
              )}
            </AnimatePresence>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tick();
        onChange(!checked);
      }}
      className={cx("relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-brand" : "bg-soft-2")}
    >
      <motion.span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)]" animate={{ x: checked ? 20 : 0 }} transition={spring.snappy} />
    </button>
  );
}

// ── Animated number ───────────────────────────────────────
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const s = useSpring(reduce ? value : 0, { stiffness: 110, damping: 22 });
  const text = useTransform(s, (v) => format(v));
  useEffect(() => {
    s.set(value);
  }, [s, value]);
  return (
    <>
      <motion.span aria-hidden className={cx("num", className)}>
        {text}
      </motion.span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-full bg-soft", className)} />;
}

// ── Monogram avatar (like contacts in UPI apps) ───────────
const AV = [
  ["#e3f3eb", "#0a7a52"],
  ["#e8eefc", "#2a56c6"],
  ["#fdeee4", "#b4511a"],
  ["#f3e9fb", "#7b3fb0"],
  ["#e6f4f7", "#0b7285"],
  ["#fcebee", "#b4234a"],
];
export function initials(name: string) {
  const words = name.replace(/[^A-Za-z0-9ऀ-ॿ ]/g, " ").split(/\s+/).filter((w) => w && !/^(tablets?|ip|mg|capsules?)$/i.test(w));
  const a = words[0]?.[0] ?? "?";
  const b = words[1] && /\d/.test(words[1][0]) ? "" : words[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}
export function Avatar({ name, size = 48, className }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AV[h % AV.length];
  return (
    <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-full font-medium", className)} style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

// ── List item (no dividers, like GPay) ────────────────────
export function Item({ avatar, title, subtitle, right, onClick, className }: { avatar?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string }) {
  const inner = (
    <>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-body text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 line-clamp-1 text-sub text-ink-2">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </>
  );
  const base = "flex w-full items-center gap-4 px-4 py-3 text-left";
  if (!onClick) return <div className={cx(base, className)}>{inner}</div>;
  return (
    <button
      onClick={() => {
        tick(6);
        onClick();
      }}
      className={cx(base, "rounded-2xl transition-colors duration-150 hover:bg-soft/60 active:bg-soft", className)}
    >
      {inner}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2">
      <h2 className="text-headline font-medium text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Pill({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "amber" | "grey" }) {
  const t = { brand: "bg-brand-tint text-brand-ink", amber: "bg-amber-tint text-amber", grey: "bg-soft text-ink-2" }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-small font-medium", t)}>{children}</span>;
}
