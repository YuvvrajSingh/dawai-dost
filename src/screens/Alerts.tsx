"use client";
import { motion } from "motion/react";
import { Bell, BellOff, BellRing, PackageCheck, Search, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { push } from "@/lib/services";
import { useApp } from "@/lib/store";
import { listContainer, listItem } from "@/lib/motion";
import { relativeDate } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { Screen } from "@/components/shell/shell";

export function Alerts() {
  const app = useApp();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPerm(push.permission());
    app.refreshAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Anything that comes back in stock while this screen is open counts as seen
  useEffect(() => app.markAlertsViewed(), [app.alerts]); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = app.alerts.filter((a) => a.status === "waiting");
  const sent = app.alerts.filter((a) => a.status === "sent");

  /** Turns on push and moves reminders that were set without it over to push. */
  const enable = async () => {
    setBusy(true);
    const sub = await push.subscribe();
    setPerm(push.permission());
    if (sub) {
      for (const a of waiting.filter((x) => !x.push)) {
        if (await app.addAlert(a.medId, { id: a.kendraId, name: a.kendraName })) app.cancelAlert(a.id);
      }
      app.refreshAlerts();
      app.showToast("Notifications are on");
    }
    setBusy(false);
  };

  return (
    <Screen title="Stock alerts">
      <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-10">
        <motion.div variants={listItem} className="mx-4 flex gap-3 rounded-[20px] bg-soft p-4">
          {perm === "granted" ? <BellRing className="mt-0.5 size-5 shrink-0 text-brand" /> : perm === "unsupported" ? <Smartphone className="mt-0.5 size-5 shrink-0 text-ink-2" /> : <BellOff className="mt-0.5 size-5 shrink-0 text-ink-2" />}
          <div className="min-w-0 flex-1">
            <p className="text-sub font-medium">{perm === "granted" ? "Notifications are on" : perm === "denied" ? "Notifications are blocked" : perm === "unsupported" ? "This browser can’t show notifications" : "Notifications are off"}</p>
            <p className="mt-0.5 text-small text-ink-2">
              {perm === "granted"
                ? "We’ll notify this phone when a medicine is back in stock at your Kendra, even if the app is closed."
                : perm === "denied"
                  ? "Allow notifications for this site in your browser settings. Until then, reminders show here when you open the app."
                  : perm === "unsupported"
                    ? "On iPhone, add Dawai Dost to your Home Screen first. Reminders still show here when you open the app."
                    : "Turn them on to hear about restocks even when the app is closed."}
            </p>
            {perm === "default" && (
              <Button size="sm" className="mt-3" loading={busy} icon={<Bell className="size-4" />} onClick={enable}>
                Turn on notifications
              </Button>
            )}
          </div>
        </motion.div>

        {app.alerts.length === 0 && (
          <motion.div variants={listItem} className="px-6 pt-12 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-tint text-brand">
              <BellRing className="size-7" />
            </span>
            <h2 className="mt-5 text-headline font-medium">No reminders yet</h2>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-sub text-ink-2">When a Jan Aushadhi medicine is out of stock at your Kendra, tap “Notify me when back in stock”.</p>
            <Button className="mt-6" icon={<Search className="size-[18px]" />} onClick={() => app.push({ name: "search" })}>
              Find a medicine
            </Button>
          </motion.div>
        )}

        {waiting.length > 0 && (
          <motion.section variants={listItem} className="pt-6">
            <h2 className="px-5 pb-1 text-sub font-medium text-ink-2">Waiting for stock</h2>
            {waiting.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => app.push({ name: "detail", id: a.medId })} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-tint text-amber">
                    <Bell className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 block text-body">{a.medName}</span>
                    <span className="line-clamp-1 block text-sub text-ink-2">
                      {a.kendraName} · set {relativeDate(a.createdAt, app.prefs.lang).toLowerCase()}
                      {!a.push && " · in-app only"}
                    </span>
                  </span>
                </button>
                <button onClick={() => app.cancelAlert(a.id)} aria-label={`Cancel reminder for ${a.medName}`} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-soft">
                  <X className="size-5" />
                </button>
              </div>
            ))}
          </motion.section>
        )}

        {sent.length > 0 && (
          <motion.section variants={listItem} className="pt-6">
            <h2 className="px-5 pb-1 text-sub font-medium text-ink-2">Back in stock</h2>
            {sent.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => app.push({ name: "detail", id: a.medId })} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                    <PackageCheck className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 block text-body">{a.medName}</span>
                    <span className="line-clamp-1 block text-sub text-ink-2">
                      {a.qty != null && <span className="num font-medium text-brand">{a.qty} {a.unit} · </span>}
                      {a.kendraName} · {a.sentAt ? relativeDate(a.sentAt, app.prefs.lang).toLowerCase() : ""}
                    </span>
                  </span>
                </button>
                <button onClick={() => app.cancelAlert(a.id)} aria-label={`Remove ${a.medName}`} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-soft">
                  <X className="size-5" />
                </button>
              </div>
            ))}
          </motion.section>
        )}

        <motion.p variants={listItem} className="px-5 pt-8 text-small text-ink-2">
          Stock can change after a reminder is sent. Call the Kendra before you go.
        </motion.p>
      </motion.div>
    </Screen>
  );
}
