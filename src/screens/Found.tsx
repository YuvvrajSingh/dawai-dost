"use client";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { matching } from "@/lib/services";
import { useApp } from "@/lib/store";
import { rupees } from "@/lib/format";
import type { Comparison, CompositionQuery } from "@/lib/types";
import { AnimatedNumber, Button, tick } from "@/components/ui/primitives";
import { shortComposition } from "@/components/ui/medicine";

/** The "payment successful" moment after a scan: we identified the medicine and found options. */
export function Found({ id, query }: { id?: string; query?: CompositionQuery }) {
  const app = useApp();
  const reduce = useReducedMotion();
  const [c, setC] = useState<Comparison | null | undefined>(undefined);

  useEffect(() => {
    (id ? matching.compare(id) : query ? matching.compareComposition(query) : Promise.resolve(null))
      .then((x) => {
        setC(x);
        if (x && x.original.id !== "query") app.addRecent(x.original.id, x.original.name);
      })
      .catch(() => setC(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, query]);

  useEffect(() => {
    if (c === undefined) return;
    const t = setTimeout(() => tick(c && c.counts.match ? 30 : 12), 350);
    return () => clearTimeout(t);
  }, [c]);

  if (c === undefined)
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-ink-2">
          <Loader2 className="size-8 animate-spin text-brand" />
          <p className="text-sub">Finding the same medicine…</p>
        </div>
      </div>
    );

  const best = c?.results.find((r) => r.status === "match");
  const o = c?.original;
  const oUnit = o && o.price.mrp > 0 ? o.price.mrp / o.price.packSize : 0;
  const save = best && oUnit ? Math.max(0, (oUnit - best.unitPrice) * 30) : 0;
  const unit = c ? `${c.unit}s` : "tablets";

  return (
    <div className="absolute inset-0 flex flex-col bg-bg px-6 text-center" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div initial={{ scale: reduce ? 1 : 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="relative grid size-28 place-items-center">
          {!reduce && best && <motion.span className="absolute inset-0 rounded-full bg-brand" initial={{ scale: 0.8, opacity: 0.35 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }} />}
          <span className={best ? "absolute inset-0 rounded-full bg-brand" : "absolute inset-0 rounded-full bg-amber"} />
          <svg viewBox="0 0 52 52" className="relative size-14" aria-hidden>
            {best ? (
              <motion.path d="M14 27 l8 8 l16 -18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
            ) : (
              <motion.path d="M26 14 v16 M26 38 v1" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.25 }} />
            )}
          </svg>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
          <h1 className="mt-8 text-title font-medium">{best ? "Same medicine found" : o ? "We found your medicine" : "Couldn’t identify it"}</h1>
          {o && (
            <p className="mt-1 text-body text-ink-2">
              {o.name} · {shortComposition(o)}
            </p>
          )}
          {best && (
            <div className="mt-8">
              {save > 0 ? (
                <>
                  <p className="text-sub text-ink-2">You could save up to</p>
                  <AnimatedNumber value={save} format={rupees} className="mt-1 block text-hero font-medium text-brand" />
                  <p className="mt-2 text-sub text-ink-2">on 30 {unit} · listed MRPs</p>
                </>
              ) : (
                <>
                  <p className="text-sub text-ink-2">Same composition from</p>
                  <AnimatedNumber value={best.unitPrice * 30} format={rupees} className="mt-1 block text-hero font-medium text-brand" />
                  <p className="mt-2 text-sub text-ink-2">for 30 {unit} · {c!.counts.match} options</p>
                </>
              )}
            </div>
          )}
          {!best && o && <p className="mx-auto mt-4 max-w-[30ch] text-sub text-ink-2">No exact match in our data yet. Some options may need a pharmacist’s check.</p>}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.35 }} className="space-y-2">
        {o ? (
          <Button size="lg" className="w-full" onClick={() => app.replace(id ? { name: "compare", id } : { name: "compare", query })}>
            See options
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => app.replace({ name: "search" })}>
            Search by name
          </Button>
        )}
        {c?.results.some((r) => r.status === "match" && r.candidate.market === "jan-aushadhi") && (
          <Button size="lg" variant="tonal" className="w-full" icon={<MapPin className="size-5" />} onClick={() => app.push({ name: "kendras" })}>
            Find a Jan Aushadhi Kendra
          </Button>
        )}
        <Button size="lg" variant="outline" className="w-full border-0" onClick={() => app.tab("home")}>
          Done
        </Button>
      </motion.div>
    </div>
  );
}
