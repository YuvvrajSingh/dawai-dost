"use client";
import { BellOff, BellRing, Check, CircleHelp, FlaskConical, MapPin, PackageCheck, PackageX, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMO_KENDRA, kendraStock } from "@/lib/services";
import { useApp } from "@/lib/store";
import type { KendraStockInfo } from "@/lib/types";
import { Button, cx, Skeleton } from "./primitives";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/**
 * Stock of these Jan Aushadhi medicines at the user's Kendra. Refreshes every
 * minute. `undefined` while loading; `null` per item when nobody has entered it.
 */
export function useKendraStock(ids: string[]) {
  const { myKendra } = useApp();
  const key = ids.join(",");
  const [items, setItems] = useState<Record<string, KendraStockInfo | null> | undefined>(undefined);
  useEffect(() => {
    if (!myKendra || !key) {
      setItems({});
      return;
    }
    let live = true;
    setItems(undefined);
    const load = () =>
      kendraStock
        .get(myKendra.id, key.split(","))
        .then((r) => live && setItems(r.items))
        .catch(() => live && setItems((cur) => cur ?? {}));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [myKendra, key]);
  return items;
}

/** Small pill for a list row: "120 in stock" / "Out of stock". */
export function StockPill({ info }: { info: KendraStockInfo | null | undefined }) {
  if (!info) return null;
  return info.qty > 0 ? (
    <span className="num inline-flex items-center rounded-full bg-brand-tint px-2.5 py-0.5 text-small font-medium text-brand-ink">{info.qty} in stock</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-tint px-2.5 py-0.5 text-small font-medium text-red">Out of stock</span>
  );
}

/** Stock at My Kendra for one Jan Aushadhi medicine, with the "notify me" reminder. */
export function KendraStockPanel({ medId, info, className }: { medId: string; info: KendraStockInfo | null | undefined; className?: string }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const k = app.myKendra;
  const alert = app.alerts.find((a) => a.medId === medId && a.kendraId === k?.id && a.status === "waiting");

  if (!k)
    return (
      <div className={cx("rounded-xl bg-white p-3", className)}>
        <p className="flex items-center gap-2 text-sub font-medium">
          <Store className="size-4 text-[#e8590c]" /> See stock at your Kendra
        </p>
        <p className="mt-1 text-small text-ink-2">Pick the Jan Aushadhi Kendra you buy from to see how many are in stock and get a reminder when it’s back.</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" icon={<MapPin className="size-4" />} onClick={() => app.push({ name: "kendras" })}>
            Choose my Kendra
          </Button>
          <Button size="sm" variant="outline" onClick={() => app.setMyKendra(DEMO_KENDRA)}>
            Try demo Kendra
          </Button>
        </div>
      </div>
    );

  const set = async () => {
    setBusy(true);
    await app.addAlert(medId);
    setBusy(false);
  };

  return (
    <div className={cx("rounded-xl bg-white p-3", className)}>
      {info === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            {info === null ? <CircleHelp className="mt-0.5 size-4 shrink-0 text-ink-3" /> : info.qty > 0 ? <PackageCheck className="mt-0.5 size-4 shrink-0 text-brand" /> : <PackageX className="mt-0.5 size-4 shrink-0 text-red" />}
            <div className="min-w-0 flex-1">
              <p className="text-sub font-medium">
                {info === null ? "Stock not updated yet" : info.qty > 0 ? <span className="num">{info.qty} {info.unit} in stock</span> : "Out of stock"}
                <span className="font-normal text-ink-2"> at {k.name}</span>
              </p>
              {info && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-small text-ink-2">
                  {info.source === "demo" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-tint px-2 py-px font-medium text-amber">
                      <FlaskConical className="size-3" /> Demo stock
                    </span>
                  ) : (
                    <span>Updated by Kendra staff</span>
                  )}
                  <span>· {ago(info.at)}</span>
                </p>
              )}
              {info === null && <p className="mt-0.5 text-small text-ink-2">This Kendra hasn’t entered stock for it. Call before you go.</p>}
            </div>
          </div>

          {(info === null || info.qty === 0) && (
            <div className="mt-2.5">
              {alert ? (
                <div className="flex items-center gap-2 rounded-full bg-brand-tint py-1 pl-3 pr-1 text-small font-medium text-brand-ink">
                  <Check className="size-3.5" strokeWidth={3} />
                  <span className="flex-1">We’ll remind you when it’s back</span>
                  <button onClick={() => app.cancelAlert(alert.id)} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-ink-2 hover:bg-white/70">
                    <BellOff className="size-3.5" /> Cancel
                  </button>
                </div>
              ) : (
                <Button size="sm" variant="tonal" className="w-full" loading={busy} icon={<BellRing className="size-4" />} onClick={set}>
                  Notify me when back in stock
                </Button>
              )}
            </div>
          )}
          <button onClick={() => app.push({ name: "kendras" })} className="mt-2 text-small font-medium text-brand">
            Change Kendra
          </button>
        </>
      )}
    </div>
  );
}
