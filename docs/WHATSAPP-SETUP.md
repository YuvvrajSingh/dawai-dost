# WhatsApp medicine assistant pilot

The implementation receives signed Meta webhooks, stores incoming events in SQLite, and processes them with a separate worker. The worker downloads a medicine photo, reads it with Gemini, asks for missing details, requires explicit confirmation, then uses the existing composition engine to list Jan Aushadhi catalog matches and dated MRPs. Share a WhatsApp location to find nearby Kendras.

## What is implemented

- `GET /api/whatsapp/webhook`: Meta verification challenge.
- `POST /api/whatsapp/webhook`: raw-body HMAC verification, account/phone checks, bounded input size, persistent event queue, and message-ID deduplication. Delivery-status events are acknowledged but not yet tracked in a delivery dashboard.
- `npm run whatsapp:worker`: one worker per persistent database. User consent before photo processing; STOP/START, DELETE, HELP, manual corrections, and confirmation before matching.
- OCR is a shared service used by the web scanner and WhatsApp. It never substitutes demo OCR in chat. Concentrations and liquids/injections are deliberately unsupported in this first bot version; tablets/capsules are supported.
- Matching preserves the catalog's match/review/excluded distinctions. Only Jan Aushadhi entries are returned; excluded candidates never appear as substitutes. No medical dosing advice, purchase flow, or stock claims.
- Optional Google Places lookup returns up to three operational map listings within 10 km, sorted by straight-line distance. These are Google Maps listings, not verification of PMBI membership. Results include map links and available phone numbers; the official locator is always provided. Without the key, location requests return locator/map-search links instead of invented results.
- The old unauthenticated Twilio send endpoint now returns HTTP 410. No arbitrary-recipient or proactive sending endpoint is exposed.

## Configuration needed

Use `.env.local` (not tracked by git). Copy the new fields from `.env.example`, leaving existing Gemini configuration in place. Never paste secrets into chat or put them in `NEXT_PUBLIC_` variables.

| Variable | Source |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp API setup; development test token initially, appropriate system-user token for production. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta sender's phone number **ID**, not the phone number itself. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID. |
| `META_APP_SECRET` | Meta app settings. |
| `WHATSAPP_VERIFY_TOKEN` | A long random value you create; use the same value in the webhook settings. |
| `META_GRAPH_API_VERSION` | Supported version chosen in your Meta dashboard, e.g. `vXX.0`; no hardcoded old version. |
| `WHATSAPP_DB_PATH` | Absolute path to SQLite on a persistent disk, outside `public/`. Server and worker must use the same file. |
| `WHATSAPP_SUPPORT_CONTACT` | A real support email, phone number, or support-page URL. |
| `WHATSAPP_PRIVACY_URL` | Published HTTPS privacy policy describing Meta/Gemini processing, optional location processing, retention, and deletion. |
| `WHATSAPP_BOT_ENABLED` | `true` enables the worker after pilot setup and policy assessment. Defaults to `false`. |
| `GEMINI_API_KEY` | Existing OCR configuration; use an active key. |
| `GOOGLE_PLACES_API_KEY` | Optional server key with Places API (New) enabled and appropriate billing/API restrictions. |

The Node runtime must support `node:sqlite`; use Node 24 for this implementation. SQLite is experimental in the installed runtime. Restrict database-file access to the server/worker account and protect the persistent volume and backups.

## Start and connect

1. Set up a Meta developer app with WhatsApp, a test sender, and an authorized test recipient. Do not launch to public recipients before assessing the medicine-comparison use case against Meta's business policy.
2. Configure the variables above. The published privacy policy and real human support path must exist before enabling the worker.
3. In one terminal run `npm run dev`. In another, from the same project directory, run `npm run whatsapp:worker`.
4. Expose the Next.js server at a public HTTPS URL with a hosting service or a development tunnel. Set Meta's webhook callback to `https://YOUR-HOST/api/whatsapp/webhook` and enter your verify token. Subscribe to the `messages` field.
5. Message the test business number: `START`, then `AGREE`. Send a clear image of the complete strip composition. Confirm missing details, then reply `YES` to the final summary. Share a location to test Kendra lookup. Check HELP, STOP, START, and DELETE too.

`npm run whatsapp:worker -- --once` drains currently pending messages and exits. It sends real messages when configured; do not use it as a fake/dry-run command.

## Hosting and delivery limits

Run the server and worker on one host with persistent SQLite storage. This version explicitly rejects inbox persistence on Vercel: its ephemeral filesystem is unsuitable. The existing web app can still run there, but the WhatsApp inbox needs an external database/queue adapter or a separate persistent Node server.

The webhook acknowledges messages only after committing them. Up to 30 messages per recipient per hour are queued for processing; STOP/DELETE controls remain available above that limit. Deduplication IDs are retained seven days. Processed media IDs/text payloads are erased; pending payloads and active medicine sessions expire after 24 hours when the worker runs. STOP/DELETE clear the medicine session. DELETE also redacts queued payloads for that sender; a minimal stopped-contact record and dedupe metadata remain temporarily to prevent unwanted replies. Backups and Meta/Gemini retention require separate handling in the privacy policy.

Replies are only to incoming messages less than 23 hours old, providing a margin inside Meta's 24-hour service window. No template or broadcast sending is implemented. The worker records Meta acceptance IDs, not proof of delivery. If a send fails or a crash makes its outcome ambiguous, it marks the event `uncertain` and does not automatically resend; inspect that event manually. This avoids duplicates but can lose a reply during failures. A production outbox with provider-aware reconciliation is future work.

## Validation

The automated suite covers signature tampering, account/number isolation, status-only events, consent before OCR, missing release questions, manual correction, confirmation before matching, unsupported concentrations, opt-out, location-session preservation, excluded-match handling, durable deduplication, and webhook handshake/authentication. Real Meta/Gemini/Places calls require the configured credentials and are not covered by these offline tests.

Primary references: [Meta API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [Meta webhook examples](https://github.com/fbsamples/whatsapp-api-examples), [business policy](https://business.whatsapp.com/policy), [Google Places text search](https://developers.google.com/maps/documentation/places/web-service/text-search), and [PMBI locator](https://janaushadhi.gov.in/near-by-kendra/). Google Maps display/attribution requirements must be checked for the final production presentation.
