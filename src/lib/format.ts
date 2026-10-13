const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rupees = (n: number) => inr0.format(Math.round(n));
export const rupees2 = (n: number) => inr2.format(n);
export const pct = (n: number) => `${Math.round(n)}%`;

export function relativeDate(iso: string, lang: "en" | "hi" = "en") {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (lang === "hi") return days <= 0 ? "आज" : days === 1 ? "कल" : `${days} दिन पहले`;
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const marketLabel = { brand: "Brand", "jan-aushadhi": "Jan Aushadhi" } as const;
