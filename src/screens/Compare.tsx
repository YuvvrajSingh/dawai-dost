"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, CircleHelp, PackageCheck, PackageX, RefreshCw, Share2, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { matching, stockInfo } from "@/lib/services";
import { useApp } from "@/lib/store";
import { duration, ease, listContainer, listItem, spring } from "@/lib/motion";
import type { Comparison, CompositionQuery, KendraStockInfo, MatchResult } from "@/lib/types";
import { relativeDate, rupees, rupees2 } from "@/lib/format";
import { AnimatedNumber, Avatar, Button, Chips, cx, Pill, Skeleton, tick } from "@/components/ui/primitives";
import { SaveButton, shortComposition } from "@/components/ui/medicine";
import { Screen } from "@/components/shell/shell";
import { NearbyKendras } from "@/components/ui/kendras";
import { KendraStockPanel, StockPill, useKendraStock } from "@/components/ui/kendra-stock";

const QTY = ["10", "30", "90"] as const;

export function CompareScreen({ id, query }: { id?: string; query?: CompositionQuery }) {
  const app = useApp();
  const [data, setData] = useState<Comparison | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<(typeof QTY)[number]>("30");
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState<"review" | "excluded" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    (id ? matching.compare(id) : query ? matching.compareComposition(query) : Promise.resolve(null))
      .then((c) => {
        if (!live) return;
        setData(c);
        if (c && c.original.id !== "query") app.remember(c.original.id, c.original.name);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, query, attempt]);

  const groups = useMemo(() => {
    const r = data?.results ?? [];
    return { match: r.filter((x) => x.status === "match"), review: r.filter((x) => x.status === "review"), excluded: r.filter((x) => x.status === "excluded") };
  }, [data]);

  // Stock at My Kendra for the Jan Aushadhi options (staff-entered or demo)
  const jaIds = useMemo(() => [...groups.match, ...groups.review].filter((r) => r.candidate.market === "jan-aushadhi").map((r) => r.candidate.id), [groups]);
  const ks = useKendraStock(jaIds);
  /** Out of stock: Kendra stock for Jan Aushadhi when known, otherwise what this person reported. */
  const isOut = (id: string) => {
    const k = ks?.[id];
    return k ? k.qty === 0 : stockInfo(app.stock, id).status === "out";
  };

  if (error)
    return (
      <Screen>
        <div className="px-6 pt-16 text-center">
          <h1 className="text-headline font-medium">Couldn’t load prices</h1>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-sub text-ink-2">{app.online ? error : "You’re offline. Connect to the internet and try again."}</p>
          <Button className="mt-6" icon={<RefreshCw className="size-[18px]" />} onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </div>
      </Screen>
    );
  if (data === undefined)
    return (
      <Screen>
        <div className="flex flex-col items-center gap-3 px-6 pt-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="size-16" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="mt-8 h-12 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-8 h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </Screen>
    );
  if (data === null)
    return (
      <Screen>
        <p className="px-6 pt-10 text-center text-sub text-ink-2">We couldn’t find this medicine.</p>
      </Screen>
    );

  const o = data.original;
  const n = Number(qty);
  const unit = `${data.unit}s`;
  const oUnit = o.price.mrp > 0 ? o.price.mrp / o.price.packSize : 0;
  // The cheapest match that isn't reported out of stock
  const best = groups.match.find((r) => !isOut(r.candidate.id));
  const cheapestOut = groups.match[0] && best !== groups.match[0] ? groups.match[0] : null;
  const showKendras = groups.match.some((r) => r.candidate.market === "jan-aushadhi");
  const bestUnit = best?.unitPrice ?? 0;
  const save = oUnit > 0 && best ? Math.max(0, (oUnit - bestUnit) * n) : 0;
  const savePct = oUnit > 0 && best ? Math.round(((oUnit - bestUnit) / oUnit) * 100) : 0;
  const isQuery = o.id === "query";
  const isSaved = app.saved.includes(o.id);
  const visibleMatches = showAll ? groups.match : groups.match.slice(0, 8);

  const share = async () => {
    tick();
    const text = best
      ? `${o.name} (${shortComposition(o)}): same composition from ${rupees(bestUnit * n)} for ${n} ${unit}${oUnit ? ` instead of ${rupees(oUnit * n)}` : ""} — ${best.candidate.name}. Ask your doctor before switching. — Dawai Dost`
      : `${o.name} (${shortComposition(o)}) — checked on Dawai Dost`;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Dawai Dost", text });
          return;
        } catch (e) {
          if ((e as DOMException).name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(text);
      app.showToast("Copied — paste it in WhatsApp");
    } catch {
      app.showToast("Couldn’t share. Try again.");
    }
  };

  return (
    <Screen
      actions={!isQuery ? <SaveButton id={o.id} name={o.name} /> : undefined}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" icon={<Share2 className="size-[18px]" />} onClick={share}>
            Share
          </Button>
          {!isQuery && (
            <Button
              className="flex-1"
              onClick={() => {
                tick(12);
                app.remember(o.id, o.name);
                const now = app.toggleSave(o.id);
                app.showToast(now ? "Saved to your medicines" : "Removed");
              }}
              variant={isSaved ? "tonal" : "primary"}
              icon={isSaved ? <Check className="size-[18px]" strokeWidth={2.5} /> : undefined}
            >
              {isSaved ? "Saved" : "Save"}
            </Button>
          )}
        </div>
      }
    >
      <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-6">
        <motion.div variants={listItem} className="flex flex-col items-center px-6 text-center">
          <Avatar name={o.name} size={64} />
          <h1 className="mt-3 text-title font-medium">{o.name}</h1>
          <p className="mt-0.5 text-sub text-ink-2">{shortComposition(o)}</p>
          <p className="text-sub text-ink-2">
            {o.formLabel} · {o.releaseLabel}
          </p>
          {oUnit > 0 && (
            <p className="mt-1 text-small text-ink-2">
              {o.manufacturer} · {rupees2(o.price.mrp)} for {o.price.packSize} {o.price.packUnit}
            </p>
          )}
        </motion.div>

        <motion.div variants={listItem} className="mt-8 flex flex-col items-center px-6 text-center">
          {best ? (
            <>
              <p className="text-sub text-ink-2">Same composition from</p>
              <AnimatedNumber value={bestUnit * n} format={rupees} className="mt-1 text-hero font-medium" />
              <p className="mt-2 text-sub text-ink-2">
                for {n} {unit}
                {oUnit > 0 && (
                  <>
                    {" "}· <span className="line-through">{rupees(oUnit * n)}</span>
                  </>
                )}
              </p>
              {save > 0 && (
                <motion.div key={qty} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.snappy} className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3.5 py-1.5 text-sub font-medium text-brand-ink">
                    You could save <AnimatedNumber value={save} format={rupees} /> · {savePct}%
                  </span>
                </motion.div>
              )}
              {save === 0 && oUnit > 0 && <p className="mt-3 text-sub text-ink-2">This is already one of the lowest prices we have.</p>}
              {cheapestOut && (
                <p className="mt-3 inline-flex max-w-[34ch] items-start gap-1.5 rounded-2xl bg-red-tint px-3 py-2 text-left text-small text-red">
                  <PackageX className="mt-px size-4 shrink-0" /> {cheapestOut.candidate.name} is out of stock{cheapestOut.candidate.market === "jan-aushadhi" && app.myKendra ? ` at ${app.myKendra.name}` : ""}, so this is the next cheapest.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-headline font-medium">No exact match in our data</p>
              <p className="mt-1 max-w-[30ch] text-sub text-ink-2">{groups.review.length ? "Some options need a pharmacist’s check. See below." : "Try searching by the salt name instead."}</p>
            </>
          )}
          {best && <Chips className="mt-6 justify-center" label="Quantity" value={qty} onChange={setQty} options={QTY.map((q) => ({ value: q, label: `${q} ${unit}` }))} />}
        </motion.div>

        {groups.match.length > 0 && (
          <motion.section variants={listItem} className="mt-9">
            <h2 className="px-5 pb-1 text-headline font-medium">Same composition, lower price</h2>
            <p className="px-5 pb-2 text-sub text-ink-2">
              {data.counts.match} products with the same salt, strength, form and release
            </p>
            <div className="px-1">
              {visibleMatches.map((r, i) => (
                <Option key={r.candidate.id} r={r} n={n} unit={unit} original={o} lowest={r === best} kstock={ks?.[r.candidate.id]} out={isOut(r.candidate.id)} open={open === r.candidate.id} onToggle={() => setOpen((x) => (x === r.candidate.id ? null : r.candidate.id))} />
              ))}
            </div>
            {groups.match.length > 8 && (
              <div className="px-4 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show fewer" : `Show ${groups.match.length - 8} more`}
                </Button>
              </div>
            )}
          </motion.section>
        )}

        {showKendras && (
          <motion.div variants={listItem} className="mt-6">
            <NearbyKendras medicine={groups.match.find((r) => r.candidate.market === "jan-aushadhi")?.candidate.name} />
          </motion.div>
        )}

        <motion.div variants={listItem} className="mt-5 space-y-2 px-4">
          {groups.review.length > 0 && (
            <Disclosure title="Check with your pharmacist" count={data.counts.review} open={more === "review"} onToggle={() => setMore((m) => (m === "review" ? null : "review"))}>
              {groups.review.map((r) => (
                <Option key={r.candidate.id} r={r} n={n} kstock={ks?.[r.candidate.id]} out={isOut(r.candidate.id)} open={open === r.candidate.id} onToggle={() => setOpen((x) => (x === r.candidate.id ? null : r.candidate.id))} />
              ))}
            </Disclosure>
          )}
          {groups.excluded.length > 0 && (
            <Disclosure title="Not the same medicine" count={groups.excluded.length} open={more === "excluded"} onToggle={() => setMore((m) => (m === "excluded" ? null : "excluded"))}>
              {groups.excluded.map((r) => (
                <Option key={r.candidate.id} r={r} n={n} open={open === r.candidate.id} onToggle={() => setOpen((x) => (x === r.candidate.id ? null : r.candidate.id))} />
              ))}
            </Disclosure>
          )}
        </motion.div>

        <motion.p variants={listItem} className="px-5 pt-6 text-small text-ink-2">
          Prices are MRPs from public lists — brands from a 2024 online-pharmacy snapshot, Jan Aushadhi from the March 2025 government list. They are not live prices; your pharmacy may charge differently. Jan Aushadhi medicines are sold only at Jan Aushadhi Kendras. {app.t("doctorNote")}
        </motion.p>
      </motion.div>
    </Screen>
  );
}

function Disclosure({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-line">
      <button
        onClick={() => {
          tick(6);
          onToggle();
        }}
        aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 px-4 text-left hover:bg-soft/60"
      >
        <span className="flex-1 text-body">{title}</span>
        <span className="num grid h-6 min-w-6 place-items-center rounded-full bg-soft px-2 text-small font-medium text-ink-2">{count}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
          <ChevronDown className="size-5 text-ink-2" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.emphasized }} className="overflow-hidden">
            <div className="pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Option({ r, n, unit, original, lowest, kstock, out: outProp, open, onToggle }: { r: MatchResult; n: number; unit?: string; original?: Comparison["original"]; lowest?: boolean; kstock?: KendraStockInfo | null; out?: boolean; open: boolean; onToggle: () => void }) {
  const app = useApp();
  const c = r.candidate;
  const ja = c.market === "jan-aushadhi";
  const st = stockInfo(app.stock, c.id);
  const out = (outProp ?? st.status === "out") && r.status !== "excluded";
  const kendraKnown = ja && !!kstock;
  const oUnit = original && original.price.mrp > 0 ? original.price.mrp / original.price.packSize : 0;
  const saving = r.status === "match" && oUnit > r.unitPrice ? (oUnit - r.unitPrice) * n : 0;
  return (
    <div>
      <button
        onClick={() => {
          tick(6);
          onToggle();
        }}
        aria-expanded={open}
        className={cx("flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-soft/60 active:bg-soft", out && "opacity-60")}
      >
        <Avatar name={c.name} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-body">{c.name}</span>
          <span className="mt-0.5 line-clamp-1 text-sub text-ink-2">{r.status === "match" ? (ja ? "Jan Aushadhi Kendra" : c.manufacturer) : r.reason}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {r.status === "excluded" ? (
            <span className="num text-sub text-ink-2">{rupees(c.price.mrp)}</span>
          ) : (
            <AnimatedNumber value={r.unitPrice * n} format={rupees} className="text-body font-medium" />
          )}
          {kendraKnown && r.status !== "excluded" ? (
            <StockPill info={kstock} />
          ) : out ? (
            <span className="inline-flex items-center rounded-full bg-red-tint px-2.5 py-0.5 text-small font-medium text-red">Out of stock</span>
          ) : st.status === "in" && r.status !== "excluded" ? (
            <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-0.5 text-small font-medium text-brand-ink">In stock</span>
          ) : lowest ? <Pill>Lowest</Pill> : ja && r.status !== "excluded" ? <Pill tone="amber">Jan Aushadhi</Pill> : r.status !== "excluded" ? <span className="num text-small text-ink-2">{rupees2(r.unitPrice)} each</span> : null}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.emphasized }} className="overflow-hidden">
            <div className="mx-4 mb-3 ml-[80px] rounded-2xl bg-soft p-3.5">
              <ul className="space-y-1.5">
                {r.checks.map((ch) => (
                  <li key={ch.key} className="flex items-center gap-2 text-sub">
                    <span className={cx("grid size-5 shrink-0 place-items-center rounded-full", ch.ok === true ? "bg-brand text-white" : ch.ok === "unknown" ? "bg-amber-tint text-amber" : "bg-red-tint text-red")}>
                      {ch.ok === true ? <Check className="size-3" strokeWidth={3} /> : ch.ok === "unknown" ? <CircleHelp className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="text-ink-2">{ch.label}</span>
                    <span className="ml-auto truncate pl-2 text-right text-ink">{ch.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-small text-ink-2">
                {rupees2(c.price.mrp)} for {c.price.packSize} {c.price.packUnit} · {c.price.source}, {c.price.asOf}
              </p>
              {r.status !== "excluded" && (ja ? <KendraStockPanel className="mt-3" medId={c.id} info={app.myKendra ? kstock : null} /> : <StockRow id={c.id} ja={ja} />)}
              {saving >= 1 && original && (
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  icon={<ShoppingBag className="size-4" />}
                  disabled={out}
                  onClick={() => app.logPurchase({ from: original.name, to: c.name, qty: n, unit: unit ?? "units", amount: saving })}
                >
                  I bought this · saved {rupees(saving)}
                </Button>
              )}
              <button
                onClick={() => {
                  app.remember(c.id, c.name);
                  app.push({ name: "detail", id: c.id });
                }}
                className="mt-2 text-sub font-medium text-brand"
              >
                View details
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Stock for one option. No live feed exists, so people report what they found at the counter. */
function StockRow({ id, ja }: { id: string; ja: boolean }) {
  const app = useApp();
  const st = stockInfo(app.stock, id);
  const when = st.at ? relativeDate(st.at, app.prefs.lang).toLowerCase() : "";
  return (
    <div className="mt-3 rounded-xl bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sub">
        {st.status === "out" ? <PackageX className="size-4 text-red" /> : st.status === "in" ? <PackageCheck className="size-4 text-brand" /> : <CircleHelp className="size-4 text-ink-3" />}
        <span className="font-medium">{st.status === "out" ? "Out of stock" : st.status === "in" ? "In stock" : "Stock not confirmed"}</span>
        {st.source === "you" && <span className="text-ink-3">· you reported {when}</span>}
      </div>
      {st.status === "unknown" && <p className="mt-1 text-small text-ink-2">{ja ? "Kendras don\u2019t publish live stock. Call the Kendra before you go." : "Pharmacies don\u2019t publish live stock. Call before you go."}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        {st.source === "you" ? (
          <button onClick={() => app.reportStock(id, null)} className="h-8 rounded-full border border-line px-3 text-small font-medium text-ink-2 hover:bg-soft">
            Clear report
          </button>
        ) : (
          <>
            <span className="mr-auto text-small text-ink-2">Was it in stock?</span>
            <button
              onClick={() => {
                tick(8);
                app.reportStock(id, "in");
              }}
              className="h-8 whitespace-nowrap rounded-full bg-brand-tint px-3 text-small font-medium text-brand-ink"
            >
              Yes
            </button>
            <button
              onClick={() => {
                tick(8);
                app.reportStock(id, "out");
                app.showToast("Marked out of stock. Showing the next cheapest.");
              }}
              className="h-8 whitespace-nowrap rounded-full bg-red-tint px-3 text-small font-medium text-red"
            >
              Out of stock
            </button>
          </>
        )}
      </div>
    </div>
  );
}
