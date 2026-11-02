#!/usr/bin/env node
// clawd-snake.mjs — Clawd as a Pac-Man-style snake that eats your contribution grid.
//
//   node scripts/clawd-snake.mjs --user Rimba-maker --out assets/clawd-snake.svg   (needs GITHUB_TOKEN)
//   node scripts/clawd-snake.mjs --data grid.json --out assets/clawd-snake.svg      (offline: { weeks: [[level, ...], ...] })
//
// Why a custom generator: the path is built only from cells that really exist (the last week is partial), so Clawd
// never walks outside the grid. Pure SMIL, no JS in the SVG, so it animates inside a GitHub README <img>.
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const out = arg('out', 'assets/clawd-snake.svg');

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
async function fetchWeeks(user) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'clawd-snake' },
    body: JSON.stringify({ query: 'query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionLevel weekday}}}}}}', variables: { u: user } }),
  });
  const j = await res.json();
  if (!j.data) throw new Error('GraphQL failed: ' + JSON.stringify(j));
  // each week -> array indexed by weekday (0 = Sunday); the last week may be shorter
  return j.data.user.contributionsCollection.contributionCalendar.weeks.map(w => { const col = []; for (const d of w.contributionDays) col[d.weekday] = LEVEL[d.contributionLevel] ?? 0; return col; });
}
const weeks = arg('data') ? JSON.parse(readFileSync(arg('data'), 'utf8')).weeks : await fetchWeeks(arg('user', process.env.GITHUB_REPOSITORY_OWNER));

// ---------- geometry ----------
const P = 17, CELL = 13, X0 = 24, Y0 = 62, COLS = weeks.length, W = X0 * 2 + COLS * P - 4, H = Y0 + 7 * P + 40;
const cx = c => X0 + c * P + CELL / 2, cy = r => Y0 + r * P + CELL / 2;
const INK = '#2B2118', TERRA = '#D97757', PAPER = '#EFE7D4';
const LV = ['#E3D9C0', '#F3C7AB', '#E79E76', '#D2693A', '#9E452A'];
const FONT = "'Segoe Print','Bradley Hand','Comic Sans MS','Chalkboard SE',cursive";

// ---------- the walk: a boustrophedon over cells that exist ----------
const rows = c => weeks[c].length;                       // rows present in column c (rows 0..n-1 are contiguous)
const steps = [];                                         // [col,row] per step, always orthogonal
let dir = 1;                                              // 1 = down, -1 = up
for (let c = 0; c < COLS; c++) {
  const n = rows(c);
  if (steps.length) {                                     // arrive from the previous column on the same row, clamped into this column
    const [pc, pr] = steps[steps.length - 1];
    const want = Math.min(pr, n - 1);
    for (let r = pr + (want > pr ? 1 : -1); want !== pr && (want > pr ? r <= want : r >= want); r += want > pr ? 1 : -1) steps.push([pc, r]);
    steps.push([c, want]);
    dir = want === 0 ? 1 : -1; if (n === 1) dir = 1;
    const start = want;
    for (let r = start + dir; r >= 0 && r < n; r += dir) steps.push([c, r]);
    continue;
  }
  for (let r = 0; r < n; r++) steps.push([c, r]);
  dir = -1;
}
const DT = 0.085, HOLD = 3.4, MOVE = (steps.length - 1) * DT, T = +(MOVE + HOLD).toFixed(3);
const firstVisit = new Map(); steps.forEach(([c, r], i) => { const k = c + ',' + r; if (!firstVisit.has(k)) firstVisit.set(k, i); });
const pathD = steps.map(([c, r], i) => `${i ? 'L' : 'M'}${cx(c)} ${cy(r)}`).join(' ');
const mKey = (MOVE / T).toFixed(5);
const fade = `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;0.001;${((MOVE + HOLD - 1.0) / T).toFixed(4)};${((MOVE + HOLD - 0.4) / T).toFixed(4)};1" values="1;1;1;0;0"`;

// ---------- cells ----------
let eaten = 0, cells = '';
weeks.forEach((col, c) => col.forEach((lvl, r) => {
  if (lvl === undefined) return;
  const base = `<rect x="${X0 + c * P}" y="${Y0 + r * P}" width="${CELL}" height="${CELL}" rx="3" fill="${LV[lvl]}" stroke="${INK}" stroke-opacity="${lvl ? .55 : .12}" stroke-width="1"`;
  if (!lvl) { cells += base + '/>'; return; }
  eaten++;
  const a = firstVisit.get(c + ',' + r) * DT / T, kt = [0, a, a + .003, 1 - .03, 1].map(x => Math.min(1, x).toFixed(4)).join(';');
  cells += `${base}><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="${kt}" values="1;1;0;0;1"/></rect>`;
}));

// ---------- Clawd: head + body blocks ----------
// The face acts the story: hungry (determined) -> chomping (excited) -> full and happy (love).
const tA = (1.2 / T).toFixed(4), tA2 = (1.2 / T + .001).toFixed(4), tB = (MOVE / T).toFixed(4), tB2 = (MOVE / T + .001).toFixed(4);
const face = (kt, v) => `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="${kt}" values="${v}" calcMode="discrete"/>`;
const head = `
<g transform="translate(-14 -13)">
  <ellipse cx="14" cy="30" rx="13" ry="3" fill="#7C7490" opacity=".3"/>
  <g fill="#C85F34" stroke="${INK}" stroke-width="2"><rect x="3" y="21" width="4.5" height="8"/><rect x="9.5" y="21" width="4.5" height="8"/><rect x="16" y="21" width="4.5" height="8"/><rect x="22.5" y="21" width="4.5" height="8"/></g>
  <rect x="-5" y="9" width="7" height="4" fill="#C85F34" stroke="${INK}" stroke-width="1.8"/><rect x="26" y="9" width="7" height="4" fill="#C85F34" stroke="${INK}" stroke-width="1.8"/>
  <rect x="1" y="0" width="26" height="23" rx="2" fill="#D2693A" stroke="${INK}" stroke-width="2.6"/>
  <!-- 1) hungry & focused: "determined" -->
  <g>${face('0;' + tA + ';' + tA2 + ';1', '1;1;0;0')}
    <rect x="7" y="6.5" width="3.6" height="7" rx="1" fill="${INK}"/><rect x="17.4" y="6.5" width="3.6" height="7" rx="1" fill="${INK}"/>
    <path d="M5.5 4.6 L11.5 7" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M22.5 4.6 L16.5 7" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M10.5 18 H17.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  </g>
  <!-- 2) chomping: "excited" -->
  <g opacity="0">${face('0;' + tA + ';' + tA2 + ';' + tB + ';' + tB2 + ';1', '0;0;1;1;0;0')}
    <rect x="7" y="4" width="3.6" height="9" rx="1" fill="${INK}"/><rect x="17.4" y="4" width="3.6" height="9" rx="1" fill="${INK}"/>
    <rect x="8" y="5" width="1.3" height="2.6" rx=".6" fill="#FFF5E2"/><rect x="18.4" y="5" width="1.3" height="2.6" rx=".6" fill="#FFF5E2"/>
    <ellipse cx="14" cy="17" rx="4" ry="1" fill="#5A1F18" stroke="${INK}" stroke-width="1.2"><animate attributeName="ry" values="1;4.6;1" dur="${(DT * 4).toFixed(3)}s" repeatCount="indefinite"/></ellipse>
  </g>
  <!-- 3) full & happy: "love" -->
  <g opacity="0">${face('0;' + tB + ';' + tB2 + ';1', '0;0;1;1')}
    <path d="M6 11 Q8.8 6 11.6 11" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M16.4 11 Q19.2 6 22 11" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M10.5 15.5 Q14 20.5 17.5 15.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="6" cy="15.5" rx="3" ry="1.8" fill="#E2536E" opacity=".55"/><ellipse cx="22" cy="15.5" rx="3" ry="1.8" fill="#E2536E" opacity=".55"/>
    <g fill="#E2536E" stroke="${INK}" stroke-width="1"><path d="M3 -3 c0-3 5-3 5 0 c0-3 5-3 5 0 c0 4-5 6-5 6 c0 0-5-2-5-6z"><animateTransform attributeName="transform" type="translate" values="0 6;0 -10" dur="1.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.3s" repeatCount="indefinite"/></path>
      <path d="M17 -2 c0-2.4 4-2.4 4 0 c0-2.4 4-2.4 4 0 c0 3.2-4 5-4 5 c0 0-4-1.8-4-5z"><animateTransform attributeName="transform" type="translate" values="0 6;0 -10" dur="1.3s" begin=".6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.3s" begin=".6s" repeatCount="indefinite"/></path></g>
  </g>
</g>`;
const K = 7, SEG_DELAY = 0.17;
let body = '';
for (let k = K; k >= 1; k--) {
  const s = 17 - k * 1.3, tone = ["#C85F34", "#C0592F", "#B8532B", "#AF4D28", "#A64824", "#9E4322", "#963F20"][k - 1];
  const d = (k * SEG_DELAY).toFixed(2);
  body += `<g opacity="0"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="2" fill="${tone}" stroke="${INK}" stroke-width="2"/>
    <rect x="${-s / 2 + 3}" y="${-s / 2 + 3}" width="2.4" height="${s / 2 - 1}" rx=".8" fill="${INK}" opacity=".55"/><rect x="${s / 2 - 5.4}" y="${-s / 2 + 3}" width="2.4" height="${s / 2 - 1}" rx=".8" fill="${INK}" opacity=".55"/>
    <animateMotion dur="${T}s" begin="${d}s" repeatCount="indefinite" path="${pathD}" calcMode="linear" keyTimes="0;${mKey};1" keyPoints="0;1;1"/>
    <animate attributeName="opacity" dur="${T}s" begin="${d}s" repeatCount="indefinite" keyTimes="0;0.001;${((MOVE + HOLD - 1.0 - K * SEG_DELAY + k * SEG_DELAY) / T).toFixed(4)};${((MOVE + HOLD - 0.4 - K * SEG_DELAY + k * SEG_DELAY) / T).toFixed(4)};1" values="1;1;1;0;0"/></g>`;
}
const snake = `<g>${body}<g>${head}
  <animateMotion dur="${T}s" repeatCount="indefinite" path="${pathD}" calcMode="linear" keyTimes="0;${mKey};1" keyPoints="0;1;1"/>
  ${fade}/></g></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.10 0"/></filter></defs>
<rect width="${W}" height="${H}" rx="14" fill="${PAPER}"/><rect width="${W}" height="${H}" rx="14" filter="url(#paper)"/>
<text x="${X0}" y="36" font-family="${FONT}" font-size="24" font-weight="700" fill="${INK}">Clawd is hungry for commits</text>
<path d="M${X0} 44 Q${X0 + 140} 51 ${X0 + 300} 43" stroke="${TERRA}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
<text x="${W - X0}" y="36" text-anchor="end" font-family="${FONT}" font-size="15" fill="#6B5B47">${eaten} commit-days on the menu</text>
${cells}
${snake}
<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#8A7A64">chomp chomp · it stays inside the grid, promise</text>
</svg>`;
writeFileSync(out, svg);
console.log(`wrote ${out}: ${COLS} weeks, ${steps.length} steps, ${eaten} cells to eat, loop ${T}s, ${(svg.length / 1024).toFixed(0)} KB`);
