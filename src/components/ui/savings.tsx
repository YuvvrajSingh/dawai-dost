"use client";
import { useId } from "react";
import { cx } from "./primitives";

/** Gold ₹ disc: the money-saved mark. */
export function RupeeMark({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cx("shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd75e" />
          <stop offset="1" stopColor="#e09a00" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11.5" fill={`url(#${id})`} />
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="#fff3c4" strokeOpacity="0.7" strokeWidth="1.2" />
      <path d="M8.6 7.6h6.8M8.6 10.4h6.8M10.6 7.6c2.6 0 3.6 1.2 3.6 2.8s-1.4 2.8-3.6 2.8H8.8l5 4.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
