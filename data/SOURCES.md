# Data sources

| File | Source | Licence | What it gives us |
|---|---|---|---|
| `raw/indian_medicine_data.csv` | [Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset) (253,973 rows) | MIT | Brand name, manufacturer, MRP, pack size, up to two salts with strength. Compiled from public online-pharmacy listings (snapshot, 2024). |
| `raw/janaushadhi_2025_part1.psv` | Jan Aushadhi (PMBJP) product MRP list, edition dated 24 Mar 2025 — official list at [janaushadhi.gov.in](https://janaushadhi.gov.in/product-portfolio/product-mrp-list) | Government public information | Generic name with strengths, pack, MRP. **Drug codes 1–1560 only (922 products)**; the rest of the list couldn't be retrieved in this build. |

| `kendras.json.gz` | Official list of Jan Aushadhi Kendras from the PMBI Kendra Locator, [janaushadhi.gov.in/locate-kendra](https://janaushadhi.gov.in/locate-kendra), fetched by `npm run data:kendras` | Government public information | Kendra code, address, PIN code, district, state, coordinates, contact number (operators' names are not kept). 21,356 Kendras, 21,333 with coordinates. |

`npm run data:build` turns these into `catalog.json.gz` (246k active products after removing discontinued ones).

Known limitations, shown to users in the app:
- Prices are listed MRPs, not live shelf prices.
- The dataset keeps at most two salts per product, so combinations are marked "check with your pharmacist", never an exact match.
- Release type comes from SR/ER/PR/CR/XR/DR/EC markings in the name and pack label. MR/OD markings are treated as unclear.
- Jan Aushadhi medicines are sold only at Jan Aushadhi Kendras.

To refresh the Jan Aushadhi list, download the latest MRP list (PDF/Excel) from janaushadhi.gov.in, convert it to `drug_code|generic_name|unit_size|mrp` rows, save it as `raw/janaushadhi_<year>.psv`, point `JA` in `scripts/build-catalog.ts` at it, and rebuild.
