"use client";
import { Screen } from "@/components/shell/shell";
import { NearbyKendras } from "@/components/ui/kendras";

export function Kendras() {
  return (
    <Screen title="Jan Aushadhi Kendras">
      <div className="pb-10 pt-2">
        <NearbyKendras />
      </div>
    </Screen>
  );
}
