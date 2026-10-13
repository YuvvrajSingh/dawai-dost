/** Google Maps listings are not PMBI membership verification or live stock. */
export async function locateKendras(latitude: number, longitude: number): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid coordinates");
  const official = "Official PMBI locator: https://janaushadhi.gov.in/near-by-kendra/";
  const maps = `https://www.google.com/maps/search/Jan+Aushadhi+Kendra/@${latitude},${longitude},13z`;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const fallback = `Find nearby Kendras on Google Maps:\n${maps}\n${official}\nMap listings may be incomplete; verify with PMBI and call the Kendra for stock/current price. I cannot verify live stock.`;
  if (!key) return fallback;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.nationalPhoneNumber,places.businessStatus,places.attributions" },
    body: JSON.stringify({ textQuery: "Jan Aushadhi Kendra", pageSize: 10, locationBias: { circle: { center: { latitude, longitude }, radius: 10000 } } }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response?.ok) return fallback;
  const data = await response.json().catch(() => null);
  if (!data) return fallback;
  const rad = (v: number) => v * Math.PI / 180;
  const distance = (lat: number, lng: number) => {
    const a = Math.sin(rad(lat - latitude) / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(lat)) * Math.sin(rad(lng - longitude) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  const places = (Array.isArray(data.places) ? data.places : []).filter((p: any) =>
    p.businessStatus === "OPERATIONAL" && /jan\s*aushadhi|janaushadhi|jan\s*ausadhi|जन\s*औषधि/i.test(p.displayName?.text ?? "") &&
    typeof p.location?.latitude === "number" && typeof p.location?.longitude === "number")
    .map((p: any) => ({ ...p, km: distance(p.location.latitude, p.location.longitude) }))
    .filter((p: any) => p.km <= 10).sort((a: any, b: any) => a.km - b.km).slice(0, 3);
  if (!places.length) return fallback;
  return `Nearby listings from Google Maps (not verified by PMBI):\n\n${places.map((p: any) => `${p.displayName.text}\n${p.formattedAddress}\nAbout ${p.km.toFixed(1)} km in a straight line${p.nationalPhoneNumber ? `\nPhone: ${p.nationalPhoneNumber}` : ""}\n${p.googleMapsUri}${p.attributions?.length ? `\nAttribution: ${p.attributions.map((a: any) => `${a.provider} ${a.providerUri ?? ""}`).join(", ")}` : ""}`).join("\n\n")}\n\n${official}\nCall before visiting: stock and current price are not verified.`;
}
