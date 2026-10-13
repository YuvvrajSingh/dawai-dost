"use client";
import { motion } from "motion/react";
import { Bookmark } from "lucide-react";
import { useApp } from "@/lib/store";
import type { Medicine } from "@/lib/types";
import { rupees } from "@/lib/format";
import { marketLabel } from "@/lib/format";
import { Avatar, cx, Item, Pressable, tick } from "./primitives";

/** Brand mark: capsule split on the diagonal. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#0a7a52" />
      <g transform="rotate(-40 16 16)">
        <rect x="7" y="11.75" width="18" height="8.5" rx="4.25" fill="#fff" />
        <path d="M16 11.75h4.75a4.25 4.25 0 0 1 0 8.5H16z" fill="#a8e0c6" />
      </g>
    </svg>
  );
}

export const composition = (m: Medicine) => m.ingredients.map((i) => `${i.salt} ${i.strength}`.trim()).join(" + ");
export const shortComposition = (m: Medicine) => m.ingredients.map((i) => `${i.salt.split(" ")[0]} ${i.strength}`.trim()).join(" + ");
export const unitWord = (m: Medicine) => m.price.packUnit.replace(/s$/, "");

export function SaveButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const { saved, toggleSave, showToast } = useApp();
  const on = saved.includes(id);
  return (
    <Pressable
      aria-label={on ? `Remove ${name} from saved` : `Save ${name}`}
      aria-pressed={on}
      pressScale={0.88}
      haptic={false}
      onClick={(e) => {
        e.stopPropagation();
        tick(on ? 6 : 12);
        const now = toggleSave(id);
        showToast(now ? "Saved" : "Removed", { label: "Undo", run: () => toggleSave(id) });
      }}
      className={cx("grid size-11 place-items-center rounded-full hover:bg-soft", className)}
    >
      <motion.span key={on ? "on" : "off"} initial={{ scale: on ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
        <Bookmark className={cx("size-[22px] transition-colors", on ? "fill-brand text-brand" : "text-ink")} strokeWidth={1.9} />
      </motion.span>
    </Pressable>
  );
}

export function MedRow({ med, onClick, meta }: { med: Medicine; onClick: () => void; meta?: string }) {
  return (
    <Item
      onClick={onClick}
      avatar={<Avatar name={med.name} />}
      title={med.name}
      subtitle={[meta, med.market === "jan-aushadhi" ? "Jan Aushadhi" : med.manufacturer, shortComposition(med)].filter(Boolean).join(" · ")}
      right={<span className="num text-body font-medium">{rupees(med.price.mrp)}</span>}
    />
  );
}
