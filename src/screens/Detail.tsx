"use client";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { catalog } from "@/lib/services";
import { useApp } from "@/lib/store";
import { listContainer, listItem } from "@/lib/motion";
import type { Medicine } from "@/lib/types";
import { marketLabel, rupees, rupees2 } from "@/lib/format";
import { Avatar, Button, Skeleton } from "@/components/ui/primitives";
import { SaveButton, shortComposition, unitWord } from "@/components/ui/medicine";
import { Screen } from "@/components/shell/shell";
import { NearbyKendras } from "@/components/ui/kendras";
import { KendraStockPanel, useKendraStock } from "@/components/ui/kendra-stock";

export function Detail({ id }: { id: string }) {
  const app = useApp();
  const [m, setM] = useState<Medicine | null | undefined>(undefined);
  const ks = useKendraStock(m?.market === "jan-aushadhi" ? [m.id] : []);
  useEffect(() => {
    catalog
      .get(id)
      .then((x) => {
        setM(x);
        if (x) app.remember(x.id, x.name);
      })
      .catch(() => setM(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (m === undefined)
    return (
      <Screen>
        <div className="flex flex-col items-center gap-3 pt-4">
          <Skeleton className="size-16" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-6 h-40 w-[90%] rounded-2xl" />
        </div>
      </Screen>
    );
  if (m === null)
    return (
      <Screen>
        <p className="px-6 pt-10 text-center text-sub text-ink-2">This medicine isn’t in the catalog.</p>
      </Screen>
    );

  const rows: [string, string][] = [
    ...m.ingredients.map((i) => [i.salt, i.strength || "Not stated"] as [string, string]),
    ["Form", m.formLabel],
    ["Release", m.releaseLabel],
    ["Pack", `${m.price.packSize} ${m.price.packUnit}`],
    ["Price per " + unitWord(m), rupees2(m.price.mrp / m.price.packSize)],
    ["Maker", m.manufacturer],
    ["Price source", `${m.price.source}, ${m.price.asOf}`],
  ];


  return (
    <Screen actions={<SaveButton id={m.id} name={m.name} />} footer={<Button size="lg" className="w-full" onClick={() => app.push({ name: "compare", id: m.id })}>Compare prices</Button>}>
      <motion.div variants={listContainer} initial="hidden" animate="show" className="pb-8">
        <motion.div variants={listItem} className="flex flex-col items-center px-6 text-center">
          <Avatar name={m.name} size={64} />
          <h1 className="mt-3 text-title font-medium">{m.name}</h1>
          <p className="mt-0.5 text-sub text-ink-2">
            {marketLabel[m.market]} · {shortComposition(m)}
          </p>
          <p className="num mt-6 text-hero font-medium">{rupees(m.price.mrp)}</p>
          <p className="mt-2 text-sub text-ink-2">
            MRP for {m.price.packSize} {m.price.packUnit} · not a live price
          </p>
        </motion.div>

        <motion.div variants={listItem} className="card mx-4 mt-8 px-4 py-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3">
              <span className="text-sub text-ink-2">{k}</span>
              <span className="min-w-0 text-right text-body">{v}</span>
            </div>
          ))}
        </motion.div>

        <motion.div variants={listItem} className="mx-4 mt-4 flex gap-3 rounded-[20px] bg-amber-tint p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-amber" />
          <p className="text-sub text-ink">
            Ask your doctor or pharmacist before switching. SR, ER and gastro-resistant versions work differently, even with the same salt.
            {m.incomplete && " Our source lists at most two salts for combinations — check the strip for any others."}
            {m.market === "jan-aushadhi" && " Sold only at Jan Aushadhi Kendras."}
          </p>
        </motion.div>

        {m.market === "jan-aushadhi" && (
          <>
            <motion.div variants={listItem} className="mx-4 mt-4 rounded-[20px] bg-soft p-1.5">
              <KendraStockPanel medId={m.id} info={ks?.[m.id]} />
            </motion.div>
            <motion.div variants={listItem} className="mt-4">
              <NearbyKendras medicine={m.name} />
            </motion.div>
          </>
        )}
      </motion.div>
    </Screen>
  );
}

