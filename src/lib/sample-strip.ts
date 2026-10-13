// "Use sample photo" in the scanner: the back of a Telma 40 strip on a table,
// drawn as SVG so it ships with the app. It's a real brand in the catalog, so
// the sample shows the full story: read → confirm → "you could save up to …".
// MRP matches the catalog listing (₹245.95 for 30 → ₹123 for a strip of 15).

const W = 1000;
const H = 680;

/** Rows of text printed on the foil (x, y, size, weight, fill, text). */
const PRINT: [number, number, number, number, string, string][] = [
  [70, 118, 64, 800, "#0d6a4a", "TELMA 40"],
  [74, 160, 24, 600, "#1d2b26", "Telmisartan Tablets I.P. 40 mg"],
  [74, 212, 19, 400, "#1d2b26", "Each uncoated tablet contains:"],
  [74, 240, 19, 400, "#1d2b26", "Telmisartan I.P. ............ 40 mg"],
  [74, 268, 17, 400, "#1d2b26", "Excipients ..................... q.s."],
  [74, 322, 22, 700, "#1d2b26", "15 Tablets"],
  [74, 362, 18, 600, "#1d2b26", "M.R.P. Rs. 123.00 for 15 Tablets"],
  [74, 386, 14, 400, "#3a4642", "(Incl. of all taxes)"],
  [74, 428, 15, 400, "#3a4642", "B.No. TLB4521   Mfg. 04/2026   Exp. 03/2028"],
  [74, 464, 15, 600, "#3a4642", "Mfd. by: Glenmark Pharmaceuticals Ltd."],
];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** Faint embossed rings where the blister pockets press through the foil. */
function pockets() {
  let out = "";
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++) {
      const cx = 560 + c * 72;
      const cy = 150 + r * 150;
      out += `<ellipse cx='${cx}' cy='${cy}' rx='30' ry='54' fill='none' stroke='#9aa4ab' stroke-opacity='0.45' stroke-width='2'/>`;
      out += `<ellipse cx='${cx - 4}' cy='${cy - 6}' rx='26' ry='50' fill='none' stroke='#ffffff' stroke-opacity='0.7' stroke-width='1.5'/>`;
    }
  return out;
}

export const SAMPLE_STRIP = { width: W, height: H };

export const SAMPLE_STRIP_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
<defs>
  <linearGradient id='wood' x1='0' y1='0' x2='1' y2='0.3'>
    <stop offset='0' stop-color='#7a5a3f'/><stop offset='0.5' stop-color='#8d6a4c'/><stop offset='1' stop-color='#6b4e36'/>
  </linearGradient>
  <linearGradient id='foil' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#f3f5f7'/><stop offset='0.35' stop-color='#d5dbe0'/><stop offset='0.55' stop-color='#eef1f4'/><stop offset='0.8' stop-color='#cdd4da'/><stop offset='1' stop-color='#e8ecef'/>
  </linearGradient>
  <filter id='shadow' x='-10%' y='-10%' width='120%' height='130%'><feDropShadow dx='0' dy='14' stdDeviation='14' flood-color='#000' flood-opacity='0.35'/></filter>
</defs>
<rect width='${W}' height='${H}' fill='url(#wood)'/>
${Array.from({ length: 14 }, (_, i) => `<path d='M0 ${30 + i * 48} C 250 ${18 + i * 48}, 600 ${46 + i * 48}, ${W} ${28 + i * 48}' stroke='#5e432e' stroke-opacity='0.18' stroke-width='${1 + (i % 3)}' fill='none'/>`).join("")}
<g transform='translate(60 70) rotate(-4 440 260)' filter='url(#shadow)'>
  <rect width='880' height='520' rx='18' fill='url(#foil)'/>
  <rect x='10' y='10' width='860' height='500' rx='12' fill='none' stroke='#b9c1c7' stroke-dasharray='3 5' stroke-width='2'/>
  <rect x='50' y='40' width='6' height='440' fill='#0d6a4a' opacity='0.85'/>
  ${pockets()}
  ${PRINT.map(([x, y, s, w, f, t]) => `<text x='${x}' y='${y}' font-family='Arial, Helvetica, sans-serif' font-size='${s}' font-weight='${w}' fill='${f}'>${esc(t)}</text>`).join("")}
  <text x='560' y='440' font-family='Arial, Helvetica, sans-serif' font-size='13' font-weight='700' fill='#b3261e'>SCHEDULE H PRESCRIPTION DRUG - CAUTION</text>
  <text x='560' y='460' font-family='Arial, Helvetica, sans-serif' font-size='12' fill='#3a4642'>Not to be sold by retail without the prescription</text>
  <text x='560' y='476' font-family='Arial, Helvetica, sans-serif' font-size='12' fill='#3a4642'>of a Registered Medical Practitioner only.</text>
  <rect x='0' y='0' width='880' height='520' rx='18' fill='#fff' opacity='0.06'/>
</g>
<text x='${W - 20}' y='${H - 16}' text-anchor='end' font-family='Arial, sans-serif' font-size='14' fill='#fff' fill-opacity='0.55'>Sample photo</text>
</svg>`;
