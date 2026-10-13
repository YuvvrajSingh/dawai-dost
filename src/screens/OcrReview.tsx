"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { duration, listContainer, listItem, spring } from "@/lib/motion";
import type { DosageForm, OcrIngredient as Ingredient, OcrResult, ReleaseType } from "@/lib/types";
import { Button, Chips, cx, Pill, tick } from "@/components/ui/primitives";
import { Screen } from "@/components/shell/shell";

const ANSWERS: [ReleaseType | "unsure", string][] = [
  ["immediate", "No, nothing like that"],
  ["sustained", "Yes — SR or CR"],
  ["extended", "Yes — ER or XR"],
  ["delayed", "Yes — DR or gastro-resistant"],
  ["unsure", "I’m not sure"],
];

export function OcrReview({ imageUrl, result }: { imageUrl: string | null; result: OcrResult }) {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(result.name.value ?? "");
  const [ing, setIng] = useState<Ingredient>(result.ingredients.value?.[0] ?? { salt: "", strength: 0, unit: "mg" });
  const extra = result.ingredients.value?.slice(1) ?? [];
  const [form, setForm] = useState<DosageForm>(result.form.value ?? "tablet");
  const [release, setRelease] = useState<ReleaseType | "unsure" | null>(result.release.value ?? null);
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && ing.salt.trim() && ing.strength > 0 && release;

  const go = () => {
    if (!valid) return;
    setBusy(true);
    tick(10);
    if (release === "unsure") {
      app.replace({ name: "search", q: `${ing.salt.split(" ")[0]} ${ing.strength}` });
      return;
    }
    // The server looks the brand up by name; if it isn't in the catalog it compares by composition alone.
    app.replace({ name: "found", query: { name: name.trim(), ingredients: [ing, ...extra], form, release } });
  };

  const unsure = (c: string) => c !== "high";

  return (
    <Screen
      title="Check details"
      footer={
        <Button size="lg" className="w-full" disabled={!valid} loading={busy} onClick={go}>
          Continue
        </Button>
      }
    >
      <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-5 px-4 pb-8 pt-1">
        {/* What we read */}
        <motion.div variants={listItem} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Your strip photo" className="size-12 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sub text-ink-2">We read this from your strip</p>
              {result.engine === "demo" && <p className="text-small text-ink-2">Example reading — add a Gemini key to read real photos</p>}
            </div>
            <button
              onClick={() => {
                tick(6);
                setEditing((e) => !e);
              }}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sub font-medium text-brand hover:bg-brand-tint"
            >
              {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.quick }} className="space-y-3 p-4">
                <Field label="Medicine name">
                  <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
                </Field>
                <Field label="Salt">
                  <input id="f-salt" value={ing.salt} onChange={(e) => setIng({ ...ing, salt: e.target.value })} className="input" />
                </Field>
                <div className="flex gap-3">
                  <Field label="Strength">
                    <input id="f-str" inputMode="decimal" value={ing.strength || ""} onChange={(e) => setIng({ ...ing, strength: Number(e.target.value) || 0 })} className="input num" />
                  </Field>
                  <Field label="Unit">
                    <select id="f-unit" value={ing.unit} onChange={(e) => setIng({ ...ing, unit: e.target.value as Ingredient["unit"] })} className="input">
                      {["mg", "mcg", "g", "ml", "IU"].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Chips label="Form" value={form} onChange={setForm} options={[{ value: "tablet", label: "Tablet" }, { value: "capsule", label: "Capsule" }, { value: "syrup", label: "Syrup" }]} />
              </motion.div>
            ) : (
              <motion.dl key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.quick }} className="px-4 pb-2 pt-2">
                <Line k="Name" v={name} flag={unsure(result.name.confidence)} />
                <Line k="Salt" v={ing.salt} flag={unsure(result.ingredients.confidence)} />
                <Line k="Strength" v={`${ing.strength} ${ing.unit}`} flag={unsure(result.ingredients.confidence)} />
                <Line k="Form" v={form[0].toUpperCase() + form.slice(1)} flag={unsure(result.form.confidence)} />
              </motion.dl>
            )}
          </AnimatePresence>
        </motion.div>

        {/* The one question */}
        <motion.div variants={listItem}>
          <h2 className="px-1 text-headline font-medium">Does the strip say SR, ER, XR or DR?</h2>
          <p className="px-1 pt-1 text-sub text-ink-2">Look next to the name. These letters change how the medicine works, so we don’t guess.</p>
          <div role="radiogroup" aria-label="Release type" className="mt-4 space-y-2">
            {ANSWERS.map(([v, label]) => {
              const on = release === v;
              return (
                <motion.button
                  key={v}
                  role="radio"
                  aria-checked={on}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    tick(8);
                    setRelease(v);
                  }}
                  className={cx("flex h-14 w-full items-center gap-3 rounded-full border px-5 text-left text-body transition-colors duration-200", on ? "border-brand bg-brand-tint text-brand-ink" : "border-line bg-white hover:bg-soft")}
                >
                  <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? "border-brand bg-brand" : "border-ink-3")}>
                    <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.snappy} className="size-2 rounded-full bg-white" />}</AnimatePresence>
                  </span>
                  {label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
      <style>{`.input{height:48px;width:100%;border-radius:14px;background:var(--color-soft);padding:0 14px;font-size:16px;color:var(--color-ink);outline:none;border:1.5px solid transparent}.input:focus{border-color:var(--color-brand);background:#fff}`}</style>
    </Screen>
  );
}

function Line({ k, v, flag }: { k: string; v: string; flag?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sub text-ink-2">{k}</dt>
      <dd className="flex items-center gap-2 text-right text-body">
        {v || <span className="text-ink-3">Missing</span>}
        {flag && <Pill tone="amber">Check</Pill>}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-small font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}


