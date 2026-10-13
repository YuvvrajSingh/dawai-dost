"use client";
import { motion } from "motion/react";
import { Check, ExternalLink, LocateFixed, MapPin, Navigation, Phone, Search, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMO_KENDRA, kendras } from "@/lib/services";
import { useApp } from "@/lib/store";
import type { Kendra, MyKendra } from "@/lib/types";
import { listContainer, listItem } from "@/lib/motion";
import { shortDate } from "@/lib/format";
import { Button, cx, tick } from "./primitives";

type Result = { list: Kendra[]; how: "near" | "search"; label: string; fetchedAt: string; at?: { lat: number; lng: number } };
type Phase = { k: "idle" } | { k: "locating" } | { k: "loading" } | { k: "error"; msg: string } | { k: "done"; r: Result };

const SHOW = 5;

const dist = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

/** Why location failed, in words people can act on. */
function locationError(e: GeolocationPositionError | null) {
  if (typeof window !== "undefined" && !window.isSecureContext) return "Location needs a secure (https) link. Search by PIN code or area instead.";
  if (!e) return "This browser can’t share your location. Search by PIN code or area instead.";
  if (e.code === e.PERMISSION_DENIED) return "Location permission is off for this site. Allow it in your browser settings, or search by PIN code or area.";
  if (e.code === e.TIMEOUT) return "Finding your location took too long. Try again outdoors, or search by PIN code or area.";
  return "Couldn’t get your location. Search by PIN code or area instead.";
}

/** Jan Aushadhi Kendras near the user (or by PIN / area), with call, directions and "set as mine". */
export function NearbyKendras({ medicine, onPick, pickLabel = "Set as my Kendra" }: { medicine?: string; onPick?: (k: MyKendra) => void; pickLabel?: string }) {
  const app = useApp();
  const [p, setP] = useState<Phase>({ k: "idle" });
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const chosen = onPick ? null : app.myKendra;

  const pick = (k: MyKendra) => {
    tick(10);
    if (onPick) return onPick(k);
    app.setMyKendra(k);
    app.showToast("Saved as your Kendra");
  };

  // If location is already allowed, don't make people tap: show nearby Kendras right away
  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((s) => live && s.state === "granted" && find())
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const find = () => {
    tick();
    setAll(false);
    if (!navigator.geolocation || !window.isSecureContext) return setP({ k: "error", msg: locationError(null) });
    setP({ k: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setP({ k: "loading" });
        try {
          const r = await kendras.near(at.lat, at.lng);
          setP({ k: "done", r: { list: r.results, how: "near", label: `within ${r.radiusKm} km`, fetchedAt: r.fetchedAt, at } });
        } catch (e) {
          setP({ k: "error", msg: app.online ? (e as Error).message : "You’re offline. Connect and try again." });
        }
      },
      (e) => setP({ k: "error", msg: locationError(e) }),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 300_000 },
    );
  };

  const search = async () => {
    const text = q.trim();
    if (text.length < 2) return;
    tick();
    setAll(false);
    setP({ k: "loading" });
    try {
      const r = await kendras.search(text);
      setP({ k: "done", r: { list: r.results, how: "search", label: `for “${text}”`, fetchedAt: r.fetchedAt } });
    } catch (e) {
      setP({ k: "error", msg: app.online ? (e as Error).message : "You’re offline. Connect and try again." });
    }
  };

  const busy = p.k === "locating" || p.k === "loading";
  const r = p.k === "done" ? p.r : null;
  const list = r ? (all ? r.list : r.list.slice(0, SHOW)) : [];
  const maps = r?.at ? kendras.mapsSearchUrl(r.at.lat, r.at.lng) : kendras.mapsSearchUrl();

  return (
    <section className="mx-4 overflow-hidden rounded-[24px] border border-line bg-white">
      <div className="flex items-start gap-3 bg-[linear-gradient(135deg,#fff4ea,#ffe8d6)] p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ff922b,#e8590c)] text-white">
          <Store className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-medium">Jan Aushadhi Kendras near you</h2>
          <p className="mt-0.5 text-sub text-ink-2">{onPick ? "Find your Kendra and tap Select." : `${medicine ? `${medicine} is sold only at these government stores.` : "Jan Aushadhi medicines are sold only at these government stores."} Call ahead to check stock.`}</p>
        </div>
      </div>

      {chosen && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-small text-ink-2">My Kendra · stock is shown here</span>
            <span className="line-clamp-1 block text-sub font-medium">{chosen.name}</span>
          </span>
          <button onClick={() => app.setMyKendra(null)} className="h-8 rounded-full px-3 text-small font-medium text-ink-2 hover:bg-soft">
            Remove
          </button>
        </div>
      )}

      <div className="space-y-2 p-3">
        <Button onClick={find} loading={p.k === "locating"} disabled={busy} icon={<LocateFixed className="size-[18px]" />} className="w-full">
          {p.k === "locating" ? "Finding your location…" : "Find Kendras near me"}
        </Button>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex h-12 items-center gap-2 rounded-full bg-soft pl-4 pr-1.5"
        >
          <Search className="size-[18px] shrink-0 text-ink-2" />
          <label htmlFor="kendra-q" className="sr-only">
            PIN code, city or area
          </label>
          <input id="kendra-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="PIN code, city or area" enterKeyHint="search" autoComplete="postal-code" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-2" />
          <button type="submit" disabled={q.trim().length < 2 || busy} className="h-9 shrink-0 rounded-full bg-white px-4 text-sub font-medium text-brand disabled:text-ink-3">
            Search
          </button>
        </form>
        {!r && !busy && (onPick || app.myKendra?.id !== DEMO_KENDRA.id) && (
          <button onClick={() => pick(DEMO_KENDRA)} className="w-full py-1 text-center text-small font-medium text-ink-2 hover:text-brand">
            {onPick ? "Use demo Kendra" : "Or try the demo Kendra (sample stock)"}
          </button>
        )}
      </div>

      {p.k === "loading" && <p className="px-4 pb-4 text-sub text-ink-2">Finding Kendras…</p>}

      {p.k === "error" && (
        <div className="mx-3 mb-3 rounded-2xl bg-amber-tint p-3">
          <p className="text-sub text-ink">{p.msg}</p>
          <a href={maps} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sub font-medium text-brand">
            <MapPin className="size-4" /> Open Google Maps instead
          </a>
        </div>
      )}

      {r && (
        <div className="px-1 pb-2">
          <p className="px-3 pb-1 text-small text-ink-2">
            {r.list.length ? `${r.list.length}${r.list.length >= 20 ? "+" : ""} Kendras ${r.label}` : `No Kendras found ${r.label}. Try a nearby PIN code or the district name.`}
          </p>
          <motion.ul variants={listContainer} initial="hidden" animate="show">
            {list.map((k) => {
              const mine = chosen?.id === k.id;
              return (
                <motion.li key={k.id} variants={listItem} className="flex items-start gap-3 rounded-2xl px-3 py-2.5">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-[#fff1e6] text-[#e8590c]">
                    <MapPin className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-body leading-snug">{k.name.replace(/^Jan Aushadhi Kendra, /, "")}</span>
                    <span className="mt-0.5 line-clamp-2 block text-small text-ink-2">
                      {k.distanceKm != null && <span className="num font-medium text-ink">{dist(k.distanceKm)} · </span>}
                      {k.address}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => !mine && pick({ id: k.id, name: k.name })}
                        aria-pressed={mine}
                        className={cx("h-8 rounded-full px-3 text-small font-medium", mine ? "bg-brand text-white" : "border border-line text-brand hover:bg-soft")}
                      >
                        {mine ? "✓ My Kendra" : pickLabel}
                      </button>
                      <span className="text-[0.6875rem] text-ink-3">{k.code}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col gap-2">
                    {k.phone && (
                      <a href={`tel:${k.phone}`} aria-label={`Call ${k.name}`} className="grid size-10 place-items-center rounded-full bg-soft text-ink hover:bg-soft-2">
                        <Phone className="size-[18px]" />
                      </a>
                    )}
                    <a href={kendras.directionsUrl(k)} target="_blank" rel="noreferrer" aria-label={`Directions to ${k.name}`} className="grid size-10 place-items-center rounded-full bg-brand-tint text-brand hover:bg-[#d4ecdf]">
                      <Navigation className="size-[18px]" />
                    </a>
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
          <div className="flex items-center gap-2 px-3 pt-1">
            {r.list.length > SHOW && (
              <Button size="sm" variant="outline" onClick={() => setAll((a) => !a)}>
                {all ? "Show fewer" : `Show ${r.list.length - SHOW} more`}
              </Button>
            )}
            <a href={maps} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sub font-medium text-brand hover:bg-soft">
              Google Maps <ExternalLink className="size-3.5" />
            </a>
          </div>
          <p className="px-3 pt-1 text-small text-ink-3">Official list from the PMBI Kendra Locator, updated {shortDate(r.fetchedAt)}.</p>
        </div>
      )}
    </section>
  );
}
