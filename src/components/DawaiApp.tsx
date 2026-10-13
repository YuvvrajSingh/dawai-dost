"use client";
import { AppProvider, useApp, type Screen as S } from "@/lib/store";
import { AppFrame } from "@/components/shell/shell";
import { Home } from "@/screens/Home";
import { SearchScreen } from "@/screens/Search";
import { Scanner } from "@/screens/Scanner";
import { OcrReview } from "@/screens/OcrReview";
import { CompareScreen } from "@/screens/Compare";
import { Detail } from "@/screens/Detail";
import { Voice } from "@/screens/Voice";
import { Found } from "@/screens/Found";
import { Profile, Saved } from "@/screens/SavedProfile";
import { Savings } from "@/screens/Savings";
import { Kendras } from "@/screens/Kendras";
import { Alerts } from "@/screens/Alerts";
import { Staff } from "@/screens/Staff";

function render(s: S) {
  switch (s.name) {
    case "home":
      return <Home />;
    case "search":
      return <SearchScreen initial={s.q} />;
    case "scan":
      return <Scanner />;
    case "ocr-review":
      return <OcrReview imageUrl={s.imageUrl} result={s.result} />;
    case "compare":
      return <CompareScreen id={s.id} query={s.query} />;
    case "detail":
      return <Detail id={s.id} />;
    case "voice":
      return <Voice />;
    case "found":
      return <Found id={s.id} query={s.query} />;
    case "saved":
      return <Saved />;
    case "profile":
      return <Profile />;
    case "savings":
      return <Savings />;
    case "kendras":
      return <Kendras />;
    case "alerts":
      return <Alerts />;
    case "staff":
      return <Staff />;
  }
}

function Router() {
  const { stack, current } = useApp();
  const key = `${stack.length}-${current.name}-${"id" in current ? current.id ?? "" : ""}`;
  return <AppFrame screenKey={key}>{render(current)}</AppFrame>;
}

export default function DawaiApp() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
