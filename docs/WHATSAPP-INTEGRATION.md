# WhatsApp integration assessment

This is the initial assessment. The subsequent medicine-assistant pilot is documented in [WHATSAPP-SETUP.md](WHATSAPP-SETUP.md), including configuration and current limits.

Checked: 13 October 2026. Scope: repository inspection, skill discovery, and documentation research. No messages sent, accounts connected, or application behavior changed.

## Decision

Technically feasible with Meta's hosted WhatsApp Cloud API. This Next.js app can implement sending and webhook endpoints directly; Twilio is optional. A complete medicine comparison bot needs a separate policy assessment before launch.

Meta's [official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) documents the API, tokens, business accounts, and phone numbers. Its [official examples](https://github.com/fbsamples/whatsapp-api-examples) cover messages, media, templates, webhooks, and signature validation.

## Current repository

| Area | Finding |
| --- | --- |
| Framework | Next.js 15 App Router; server endpoints can host the integration. |
| Existing sending endpoint | `src/app/api/whatsapp/route.ts` sends through Twilio, not Meta directly. |
| Current share button | `src/screens/Compare.tsx:104` uses `navigator.share`, then clipboard; it does not call the sending endpoint. |
| Shared URL | Existing endpoint builds `/c/{comparisonId}`, but there is no matching page. Screen navigation currently uses client state. |
| Credentials | Local `.env` has Twilio SID/token entries but an empty sender. No Meta integration configuration was found. Presence does not establish validity; no credential values were exposed or tested. |
| Search and matching | Reusable server engine at `src/lib/server/engine.ts`; search/compare API routes already exist. |
| Strip images | Gemini OCR exists at `src/app/api/ocr/route.ts`; refactor into a server service for bot reuse. |
| State | Saved medicines/history live in browser localStorage. A bot needs durable server storage for its own sessions. |
| Existing endpoint gaps | No authentication, recorded consent, rate limiting, comparison lookup, or approved-template handling. Phone validation alone does not authorize sending. |

## Policy boundary

Meta restricts buying, selling, promoting, and facilitating exchange of prescription drugs and healthcare products. India is listed for limited OTC messaging, subject to age, location, licensing, and other conditions; commerce remains restricted. Recipients must opt in, opt-outs must be honored, and automation needs an escalation path. Free-form replies require a user message within the previous 24 hours; otherwise approved templates are required. Health-data handling also has conditions. See [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy).

Assessment: app support is the best initial scope. Cheaper prescription alternatives could be interpreted as promotion; being informational does not establish permission. Obtain a use-case determination before that launch. Do not assume a drug is OTC from its catalog name, or that template approval permits every related feature.

## Skills found

- No dedicated WhatsApp skill found in the local `.agents/skills` or `.codex/skills` trees searched, or in the fetched OpenAI curated skill catalog.
- Community candidate: [bellopushon/whatsapp-cloud-api](https://github.com/bellopushon/whatsapp-cloud-api/tree/main/skills/whatsapp-cloud-api), with a [SKILL.md](https://github.com/bellopushon/whatsapp-cloud-api/blob/main/skills/whatsapp-cloud-api/SKILL.md) and messaging, webhook, conversation, interactive-message, and coexistence references.
- The candidate is third-party, even though its description calls the API reference official. It hardcodes Graph v21.0 and contains lifecycle/pricing claims that need verification. Use Meta documentation as the authority; do not copy version or pricing assumptions blindly. It was inspected, not installed.
- The built-in skill-installer can install the candidate if selected. No special skill is required to integrate this API.

## Proposed integration

1. Add an explicit WhatsApp share option to the current comparison screen using a user-controlled share action. This is separate from automated business messaging and does not connect a bot or prove business-policy eligibility.
2. Build direct Cloud API support for an initially narrow app-support flow. Add a business chat link and server-only credentials; use Meta's test sender and an authorized test recipient first.
3. Implement `GET /api/whatsapp/webhook` for verification and `POST` for incoming messages/statuses. Validate `X-Hub-Signature-256` against raw request bytes with the app secret, check the expected account/phone ID, and reject invalid payloads. Meta provides a [signature-validation example](https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads).
4. Persist accepted events to a durable queue before acknowledging them. Deduplicate incoming message IDs and let a worker process events; avoid unawaited background promises on serverless hosting. Track delivery separately from send acceptance, and retry transient failures with limits.
5. Store consent/opt-out state, the last inbound message time, selected language, pending image confirmation, and message IDs. Keep credentials and sensitive payloads out of client bundles and logs. Add access controls, per-recipient limits, retention, and deletion behavior.
6. After use-case eligibility is resolved, reuse the engine for medicine queries. For images, retrieve media with server credentials, enforce file limits, run OCR, and ask the user to confirm salt/strength/form/release before comparison. Do not substitute the web UI's demo OCR result into a bot response. Preserve price-source dates and pharmacist/doctor review wording.
7. Implement real shareable comparison pages before sending result links. Composition-only queries need a reproducible, privacy-conscious representation or saved result record; the existing `/c/...` string is insufficient.

Suggested server configuration (new names, not currently wired):

```dotenv
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=
META_APP_SECRET=
META_GRAPH_API_VERSION=
APP_BASE_URL=
```

Set the API version to a currently supported Meta version when implementing. Keep tokens/secrets server-only. The verify token is your own random value and is distinct from the access token and app secret.

## Meta setup and documentation

- Create/select a Meta business portfolio, WhatsApp Business Account, and Meta app with WhatsApp configured. Use test resources before registering a production business phone number. Production onboarding/verification depends on the account and intended setup.
- Use a suitable production system-user access token with required permissions and assigned assets; do not rely on the dashboard's short-lived development token.
- Publish a privacy policy, deploy an HTTPS webhook, verify it, subscribe to message events, and test inbound messages plus delivery statuses.
- For business-initiated notifications, record opt-in and submit the actual templates for review. Avoid an anonymous public endpoint that can send to arbitrary phone numbers.
- If using an existing WhatsApp Business App number, check Meta's supported coexistence/onboarding path before attempting registration.

Primary resources:

- [Meta overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
- [Meta getting started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
- [Meta Cloud API Postman documentation](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Meta sample repository](https://github.com/fbsamples/whatsapp-api-examples)
- [Business messaging policy](https://business.whatsapp.com/policy)
- [Platform pricing](https://business.whatsapp.com/products/platform-pricing)
- [Non-template pricing reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages/)

The research browser could read Meta's policy, pricing overview, official Postman collection, and GitHub samples, but several developer-documentation pages failed to load. Exact current Graph version, India rates, and account eligibility remain to be verified during setup. The pricing overview describes free service replies while other search results describe October 2026 changes: do not budget on free replies without checking the current account rate card. Direct integration avoids a Twilio intermediary fee, but does not imply zero Meta or hosting costs.

## Acceptance checks for implementation

Test valid/invalid webhook verification and signatures; duplicate events; status-only events; malformed/oversized media; missing credentials; expired service windows; consent and STOP handling; unauthorized sending; upstream failures; and working shared links. Run existing engine tests and TypeScript checks after code changes. End-to-end delivery requires authorized Meta credentials and test recipients; it has not been tested in this assessment.
