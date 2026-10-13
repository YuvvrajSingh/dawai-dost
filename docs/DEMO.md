# Demo script (about 3 minutes)

## Before you present

1. Open the app on the phone you'll present from.
2. **Profile → Demo data → Load demo data.** This fills the phone with a sample family:
   - Saved medicines: Telma 40, Glycomet 500, Rosuvas 10, Pan 40, Thyronorm 50, Amlong 5
   - About ₹4,000 saved over four months by switching four of them to Jan Aushadhi
   - "My Kendra" = Jan Aushadhi Kendra (Demo), with stock entered for 7 medicines
   - Two stock reminders: Telmisartan is out of stock (waiting); Rosuvastatin came back in stock (fired)
3. Optional, for a live push notification: **Bell → Turn on notifications**. On iPhone, first add the site to the Home Screen and open it from there.
4. Keep a second device or laptop on **Profile → For Kendra staff** (PIN `1234` in development, or `KENDRA_STAFF_PIN`). Select **Use demo Kendra**.

All prices are real listed MRPs from the catalog. Stock at the demo Kendra and the purchase history are sample data. **Profile → Clear demo data** removes it all.

## The story

1. **Home.** "Ramesh's family spends about ₹1,500 a month on six medicines. Dawai Dost shows they could save up to ₹1,209 of that, and they've already saved about ₹4,000."
2. **Tap Telma 40** under Your medicines. "Same salt, strength, form and release: 934 products. The cheapest same-composition option costs ₹20 for 30 tablets instead of ₹246." Open an option to show the five checks.
3. **Scroll to the Jan Aushadhi option** (Telmisartan Tablets IP 40mg, ₹36). It shows **Out of stock** at their Kendra, and the headline price moved to the next cheapest option. "We never send people to a shop that's out of stock."
4. **Open it → "We'll remind you when it's back."** The reminder was set yesterday.
5. **Restock live.** On the staff device, search *Telmisartan*, set **120**, and tap **Save**. The phone gets **"Back in stock"** (a push notification, or a banner when the app opens). Tap it and the medicine shows **120 tablets in stock**.
6. **Kendras tab → Find Kendras near me.** "The official list of 21,356 Kendras, with distance, phone and directions. Search by PIN code also works when location is off."
7. **Savings tab.** "Every purchase logged with 'I bought this' adds up here: ₹793 this month."
8. **Scan strip → Use sample photo** (or a real strip if `GEMINI_API_KEY` is set). The strip is read, confirmed and compared.
9. Close with **हिं** at the top of Home: the whole app switches to Hindi.

## If something goes wrong

- **No location:** type a PIN code (for example 342001 or 110001) on the Kendras screen.
- **No notification:** the bell badge and the in-app banner still show the restock on the next app open.
- **Reset:** Profile → Reload demo data.
