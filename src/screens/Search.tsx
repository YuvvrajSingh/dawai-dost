"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, History, Mic, Search as SearchIcon, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { catalog } from "@/lib/services";
import { POPULAR_QUERIES } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { duration, listContainer, listItem, spring } from "@/lib/motion";
import type { Medicine } from "@/lib/types";
import { Avatar, Button, Chips, cx, Item, Pressable, Skeleton, tick } from "@/components/ui/primitives";
import { MedRow } from "@/components/ui/medicine";

type Market = "all" | "generic" | "brand";

export function SearchScreen({ initial }: { initial?: string }) {
  const app = useApp();
  const [q, setQ] = useState(initial ?? "");
  const [submitted, setSubmitted] = useState(initial ?? "");
  const [market, setMarket] = useState<Market>("all");
  const [all, setAll] = useState<Medicine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [strengths, setStrengths] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 280);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setSubmitted("");
      return;
    }
    const t = setTimeout(() => setSubmitted(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setMarket("all"), [submitted]);
  useEffect(() => {
    if (!submitted) {
      setAll(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    catalog
      .search(submitted)
      .then((r) => {
        if (id !== reqId.current) return;
        setAll(r.results);
        setStrengths(r.strengths);
        setLoading(false);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setAll([]);
        setLoading(false);
        app.showToast(app.online ? "Search failed. Try again." : "You’re offline");
      });
  }, [submitted]);

  const results = useMemo(() => (all ?? []).filter((m) => (market === "all" ? true : market === "brand" ? m.market === "brand" : m.market !== "brand")), [all, market]);
  const recentMeds = app.recent.filter((r) => app.names[r.id]).map((r) => ({ id: r.id, name: app.names[r.id] })).slice(0, 4);

  const run = (text: string) => {
    setQ(text);
    setSubmitted(text);
    app.addQuery(text);
    inputRef.current?.blur();
  };
  const open = (m: { id: string; name: string }) => {
    app.addQuery(q || m.name);
    app.addRecent(m.id, m.name);
    app.push({ name: "compare", id: m.id });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-bg">
      <header className="shrink-0 px-2" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}>
        <motion.form
          layoutId="search-field"
          transition={spring.layout}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) run(q.trim());
          }}
          className="flex h-14 items-center gap-1 rounded-full bg-soft pl-1 pr-2"
        >
          <button
            type="button"
            aria-label="Go back"
            onClick={() => {
              tick(6);
              app.back();
            }}
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-white"
          >
            <ArrowLeft className="size-[22px]" strokeWidth={2} />
          </button>
          <label htmlFor="search-input" className="sr-only">
            Search medicine or salt
          </label>
          <input
            id="search-input"
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={app.t("searchPill")}
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-2"
          />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => (setQ(""), inputRef.current?.focus())} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white">
              <X className="size-5" strokeWidth={2} />
            </button>
          ) : (
            <button type="button" aria-label="Search by voice" onClick={() => app.push({ name: "voice" })} className="grid size-10 place-items-center rounded-full text-brand hover:bg-white">
              <Mic className="size-5" strokeWidth={2} />
            </button>
          )}
        </motion.form>
        <AnimatePresence initial={false}>
          {all && all.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base }} className="overflow-hidden">
              <Chips
                className="px-2 pb-1 pt-3"
                label="Filter"
                value={market}
                onChange={setMarket}
                options={[
                  { value: "all", label: app.t("all") },
                  { value: "generic", label: "Jan Aushadhi" },
                  { value: "brand", label: app.t("brands") },
                ]}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar px-1 pb-10 pt-2">
        {submitted && strengths.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2 no-scrollbar" aria-label="Pick the strength on your strip">
            {strengths.map((st) => (
              <button key={st} onClick={() => run(st)} className="h-9 shrink-0 rounded-full border border-line px-4 text-sub text-ink hover:bg-soft">
                {st}
              </button>
            ))}
          </div>
        )}
        {!submitted && (
          <motion.div variants={listContainer} initial="hidden" animate="show">
            {recentMeds.length > 0 && (
              <motion.div variants={listItem} className="grid grid-cols-4 gap-y-4 px-2 pb-4 pt-3">
                {recentMeds.map((m) => (
                  <Pressable key={m.id} onClick={() => open(m)} pressScale={0.92} className="flex flex-col items-center gap-2">
                    <Avatar name={m.name} size={52} />
                    <span className="line-clamp-2 max-w-[78px] text-center text-small leading-tight">{m.name}</span>
                  </Pressable>
                ))}
              </motion.div>
            )}
            {app.recentQueries.map((r) => (
              <motion.div key={r} variants={listItem}>
                <Item
                  onClick={() => run(r)}
                  avatar={
                    <span className="grid size-10 place-items-center text-ink-2">
                      <History className="size-5" />
                    </span>
                  }
                  title={r}
                />
              </motion.div>
            ))}
            {POPULAR_QUERIES.map((p) => (
              <motion.div key={p} variants={listItem}>
                <Item
                  onClick={() => run(p)}
                  avatar={
                    <span className="grid size-10 place-items-center text-ink-2">
                      <TrendingUp className="size-5" />
                    </span>
                  }
                  title={p}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {submitted && loading && !all && (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="size-12" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {submitted && all && (
          results.length === 0 ? (
            <div className="px-6 pt-16 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-soft text-ink-2">
                <SearchIcon className="size-7" />
              </span>
              <h2 className="mt-5 text-headline font-medium">No results for “{submitted}”</h2>
              <p className="mx-auto mt-1.5 max-w-[28ch] text-sub text-ink-2">Try the salt name printed on the back of the strip.</p>
              <Button className="mt-6" onClick={() => app.tab("scan")}>
                Scan the strip
              </Button>
            </div>
          ) : (
            <motion.div key={`${submitted}-${market}`} variants={listContainer} initial="hidden" animate="show" className={cx("transition-opacity", loading && "opacity-60")}>
              {results.map((m) => (
                <motion.div key={m.id} variants={listItem}>
                  <MedRow med={m} onClick={() => open(m)} />
                </motion.div>
              ))}
              <p className="px-4 pt-4 text-small text-ink-2">Listed MRPs from public data — not live prices</p>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
