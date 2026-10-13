# Dawai Dost

Find the same medicine for less. Search or scan a strip, confirm what's printed on it, and see products with the **same salt, strength, form and release type**, sorted by price per tablet. The app uses real Indian medicine data: 246,000 brands plus the Jan Aushadhi government list.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Open the address on your phone (same Wi-Fi, use your computer's IP) to try the camera and voice.

Other commands:

```bash
npm test               # composition parser, matching engine, savings
npm run data:build     # rebuild data/catalog.json.gz from data/raw (downloads the dataset if missing)
npm run data:kendras   # refresh data/kendras.json.gz from the official Kendra Locator
npm run build && npm start
```

### Turn on real strip reading (Gemini)

1. Get a key at https://aistudio.google.com/apikey
2. Create `.env.local` containing `GEMINI_API_KEY=your_key`
3. Restart `npm run dev`.

Without a key, the scanner still works: camera, upload, and the blur and brightness check all run. The reading step returns a clearly labelled example instead of reading your photo.

### Presenting it

Profile → **Load demo data** fills the app with a sample family's medicines, savings, a demo Kendra with stock and two stock reminders (prices stay real). See [docs/DEMO.md](docs/DEMO.md) for a 3-minute script. Profile → **Clear demo data** removes it.

## What's real now

| Feature | Status |
|---|---|
| Medicine search (brand, salt, Hindi spellings of salts) | ✅ Real data, `/api/search` |
| Comparison by composition, cheapest first, per-tablet pricing | ✅ `/api/compare/:id` |
| Compare from what's printed on the strip | ✅ `POST /api/compare` |
| Strip reading | ✅ `/api/ocr` with Gemini when `GEMINI_API_KEY` is set |
| Photo quality check (blur and brightness) | ✅ On the device |
| Voice search, Hindi/English | ✅ Browser speech recognition and speech output, answered from real data |
| Saved medicines and history | ✅ On the device (localStorage) |
| WhatsApp medicine assistant | Meta webhook + persistent worker implemented; photo confirmation, Jan Aushadhi listed prices, and location lookup. Requires Meta setup; see `docs/WHATSAPP-SETUP.md`. The app's share button still uses the phone share sheet. |
| Nearby Jan Aushadhi Kendras | ✅ `/api/kendras`: nearest by location, or by PIN code / city / Kendra code, with distance, address, phone and directions. From the official PMBI Kendra Locator list (21,356 Kendras) bundled in `data/kendras.json.gz`; refresh with `npm run data:kendras` |
| Jan Aushadhi stock quantity | ✅ Per Kendra: users pick "My Kendra" and see "120 tablets in stock" on Compare and medicine pages. Figures entered by Kendra staff (Profile → For Kendra staff, PIN in `KENDRA_STAFF_PIN`) always win; otherwise **demo stock** fills in, labelled in the app (`STOCK_DEMO=0` turns it off). No public PMBJP stock feed exists |
| Restock alerts | ✅ "Notify me when back in stock" → web push (`public/sw.js`, `web-push`) when quantity goes above 0; in-app banner when push isn't allowed. Server checks every 30 s and immediately on a staff restock; on serverless, call `POST /api/alerts/check` from a cron |
| Brand / pharmacy stock | ✅ In stock / out of stock as reported on the device ("Was it in stock?"). Out-of-stock options drop out of "cheapest" so the next one is shown |
| Savings tracking | ✅ "I bought this" logs a purchase; money saved = brand MRP − bought medicine MRP for that quantity. On the device (localStorage) |
| Live pharmacy prices or live stock counts | ❌ No public feed exists. Prices are listed MRPs (see `data/SOURCES.md`) |

Stock entries, alerts and dev push keys live in `data/runtime/state.json` (git-ignored) via `src/lib/server/runtime-store.ts`. That's fine for one server; for a multi-instance host (e.g. Vercel) swap that module for a database.

## How matching decides (src/lib/engine.ts)

- **Same composition:** every salt and strength identical, same dosage form, same release category, and both records list their full composition.
- **Check with your pharmacist:** same composition, but one of these applies:
  - extended-release (profiles differ between makers)
  - release marking unclear (MR/OD)
  - a combination (the dataset stores at most two salts)
  - a listed price that looks like a data error
- **Not the same medicine:** shares a salt, but strength, form, release or the salt set differs. Shown so users see why.

Composition text is normalised in `src/lib/composition.ts`:
- Counter-ions are stripped: "Metformin Hydrochloride" = "Metformin". Succinate vs tartrate are kept distinct.
- Spellings are aliased: Amoxycillin = Amoxicillin, Thyroxine = Levothyroxine.
- Units are made canonical: 1 gm = 1000 mg.
- Proton-pump inhibitors are always treated as gastro-resistant.

## Project map

```
data/catalog.json.gz        compiled catalog (8.5 MB)       data/raw/  source files
scripts/build-catalog.ts    raw → catalog                    scripts/build-lite.ts  small subset for a static demo
src/lib/composition.ts      label parsing + normalisation    src/lib/engine.ts      search + matching (pure)
src/lib/server/engine.ts    loads the catalog once           src/app/api/*          search, medicine, compare, ocr, whatsapp, meta
src/lib/services/index.ts   client data layer (api | local)  src/screens/*          UI (UPI-style)
```

## Deploying

The repo works on Vercel as-is. `next.config.ts` ships `data/catalog.json.gz` with the API routes. Add `GEMINI_API_KEY` in the project settings. Expect a cold start of about 1–3 s while the catalog loads.

## Safety

For the WhatsApp pilot, read [setup and hosting requirements](docs/WHATSAPP-SETUP.md). The bot needs a persistent Node server and SQLite; Vercel requires an external storage adapter. The previous public Twilio sending endpoint is disabled.

Dawai Dost compares composition and listed prices. It does not give dosing advice, and the voice assistant refuses dosage questions. Every comparison tells people to check with their doctor or pharmacist before switching.
