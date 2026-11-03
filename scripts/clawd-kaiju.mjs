#!/usr/bin/env node
// clawd-kaiju.mjs — your contribution grid as an isometric night city, with Clawd as a kaiju stomping through it.
//
//   node scripts/clawd-kaiju.mjs --user Rimba-maker --out assets/clawd-kaiju.svg     (needs GITHUB_TOKEN)
//   node scripts/clawd-kaiju.mjs --data grid.json --out assets/clawd-kaiju.svg        (offline: { weeks: [[level, ...], ...] })
//
// One cell = one day. Building height = how much you shipped that day; empty days are empty lots. No text anywhere.
// Pure SVG + SMIL (animates inside a GitHub README <img>). The data comes from live contributions, so it changes daily.
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const out = arg('out', 'assets/clawd-kaiju.svg');
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
async function fetchWeeks(user) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'clawd-kaiju' },
    body: JSON.stringify({ query: 'query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionLevel weekday}}}}}}', variables: { u: user } }),
  });
  const j = await res.json();
  if (!j.data) throw new Error('GraphQL failed: ' + JSON.stringify(j));
  return j.data.user.contributionsCollection.contributionCalendar.weeks.map(w => { const col = []; for (const d of w.contributionDays) col[d.weekday] = LEVEL[d.contributionLevel] ?? 0; return col; });
}
const weeks = arg('data') ? JSON.parse(readFileSync(arg('data'), 'utf8')).weeks : await fetchWeeks(arg('user', process.env.GITHUB_REPOSITORY_OWNER));
const COLS = weeks.length;

// ---------- helpers ----------
const seedStr = arg('seed', new Date().toISOString().slice(0, 10));
let sh = 2166136261; for (const ch of seedStr) sh = Math.imul(sh ^ ch.charCodeAt(0), 16777619);
const hash = i => { const x = Math.sin((i + (sh % 997)) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const f = n => +n.toFixed(1);
const pts = a => a.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

// ---------- world ----------
const W = 900, H = 372, UX = 14.4, VX = -7, VY = 13, X0 = 98, Y0 = 236;
const P = (c, r, z = 0) => [X0 + c * UX + r * VX, Y0 + r * VY - z];
const HEIGHT = [0, 22, 44, 70, 98];
const MOVE = 24, HOLD = 6, T = MOVE + HOLD, XS = -150, XE = W + 150, SPEED = (XE - XS) / MOVE;
const yF = P(0, 3.5)[1];
const tk = t => Math.min(1, Math.max(0, t / T)).toFixed(4);
const LEAD = 82;

// ---------- city ----------
const BASE = ['#3E4A66', '#4B5878', '#586792', '#6578A6', '#7689B8'];     // by level
let lots = '', behind = '', front = '', eaten = 0;
const cells = [];
weeks.forEach((col, c) => col.forEach((lvl, r) => { if (lvl !== undefined) cells.push([c, r, lvl]); }));
cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);                           // back to front, left to right

for (const [c, r, lvl] of cells) {
  const lot = [P(c + .06, r + .06), P(c + .94, r + .06), P(c + .94, r + .94), P(c + .06, r + .94)];
  lots += `<polygon points="${pts(lot)}" fill="#232A3C" stroke="#141927" stroke-width=".8"/>`;
  if (!lvl) continue;
  eaten++;
  const i = .16, x0 = c + i, x1 = c + 1 - i, y0 = r + i, y1 = r + 1 - i, h = HEIGHT[lvl], O = P(c + .5, r + .5);
  const rel = (cc, rr, z) => { const p = P(cc, rr, z); return [p[0] - O[0], p[1] - O[1]]; };
  const base = BASE[lvl], topC = mix(base, '#FFFFFF', .22), frontC = base, rightC = mix(base, '#0A0E1A', .32);
  const frontF = [rel(x0, y1, 0), rel(x1, y1, 0), rel(x1, y1, h), rel(x0, y1, h)];
  const rightF = [rel(x1, y0, 0), rel(x1, y1, 0), rel(x1, y1, h), rel(x1, y0, h)];
  const topF = [rel(x0, y0, h), rel(x1, y0, h), rel(x1, y1, h), rel(x0, y1, h)];
  const wOp = (.35 + .55 * hash(c * 7 + r)).toFixed(2);
  // destruction plan: rows near Clawd's path fall completely, the far edge only burns
  const d = Math.abs(r - 3), mode = r === 0 ? 'safe' : r === 1 ? 'half' : r === 6 ? 'low' : 'full';
  const tb = Math.max(.3, (O[0] - LEAD - XS) / SPEED + d * .3 + hash(c + r * 53) * .25);
  const s = mode === 'full' ? .05 : mode === 'low' ? .3 : mode === 'half' ? .42 : 1;
  const a = tk(tb), b = tk(tb + .55), skew = ((hash(c * 3 + r) - .5) * 14).toFixed(1);
  const burn = mode !== 'safe' && (hash(c * 11 + r * 5) < .42 || mode === 'half');
  const foot = [rel(x0, y0, 0), rel(x1, y0, 0), rel(x1, y1, 0), rel(x0, y1, 0)];
  const show = (extra = '') => `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;${a};${tk(tb + .02)};.978;.98;1" values="0;0;1;1;0;0"${extra}/>`;
  let g = `<g transform="translate(${f(O[0])} ${f(O[1])})">`;
  if (mode !== 'safe') {
    g += `<polygon points="${pts(foot)}" fill="#171B27" opacity="0">${show()}</polygon>`;
    for (let k = 0; k < 3; k++) { const p = rel(x0 + (x1 - x0) * hash(c + k * 9 + r), y0 + (y1 - y0) * hash(r + k * 4 + c), 0); g += `<polygon points="${pts([[p[0] - 2.4, p[1]], [p[0] + 2.4, p[1] - 1.6], [p[0] + 1.4, p[1] + 1.6]])}" fill="${topC}" opacity="0">${show()}</polygon>`; }
    // dust cloud
    g += `<circle cx="0" cy="-4" r="3" fill="#C9B79E" opacity="0"><animate attributeName="r" dur="${T}s" repeatCount="indefinite" keyTimes="0;${a};${tk(tb + 1.1)};1" values="3;3;${22 + Math.round(hash(c + r) * 10)};3"/><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;${a};${tk(tb + .12)};${tk(tb + 1.1)};1" values="0;0;.75;0;0"/></circle>`;
  }
  if (burn) g += `<g opacity="0">${show()}<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1.45;1 .85;1 1" dur="${(.5 + hash(c + r) * .3).toFixed(2)}s" repeatCount="indefinite"/><polygon points="-5,2 0,-16 5,2" fill="#FF7A2E"/><polygon points="-2.6,2 0.6,-9 3,2" fill="#FFD66B"/></g></g>`;
  g += `<g><animateTransform attributeName="transform" type="skewX" dur="${T}s" repeatCount="indefinite" keyTimes="0;${a};${b};.98;1" values="0;0;${skew};${skew};0"/><g><animateTransform attributeName="transform" type="scale" dur="${T}s" repeatCount="indefinite" keyTimes="0;${a};${b};.98;1" values="1 1;1 1;1 ${s};1 ${s};1 1"/>`;
  g += `<polygon points="${pts(frontF)}" fill="${frontC}" stroke="#0E1220" stroke-width=".7"/><polygon points="${pts(frontF)}" fill="url(#win)" opacity="${wOp}"/>`;
  g += `<polygon points="${pts(rightF)}" fill="${rightC}" stroke="#0E1220" stroke-width=".7"/><polygon points="${pts(rightF)}" fill="url(#win)" opacity="${(wOp * .55).toFixed(2)}"/>`;
  g += `<polygon points="${pts(topF)}" fill="${topC}" stroke="#0E1220" stroke-width=".7"/>`;
  if (lvl >= 3 && hash(c * 5 + r) < .5) g += `<line x1="${f(topF[0][0] / 2 + topF[2][0] / 2)}" y1="${f(topF[0][1] / 2 + topF[2][1] / 2)}" x2="${f(topF[0][0] / 2 + topF[2][0] / 2)}" y2="${f(topF[0][1] / 2 + topF[2][1] / 2 - 9)}" stroke="#0E1220" stroke-width="1"/><circle cx="${f(topF[0][0] / 2 + topF[2][0] / 2)}" cy="${f(topF[0][1] / 2 + topF[2][1] / 2 - 9)}" r="1.3" fill="#FF5A5A"><animate attributeName="opacity" values="1;.2;1" dur="1.4s" repeatCount="indefinite"/></circle>`;
  g += `</g></g></g>`;
  if (r <= 3) behind += g; else front += g;
}

// ---------- Clawd the kaiju (drawn in character units; scaled ×5.6) ----------
const INK = '#1B1410';
const win = (list, on = '#FFFFFF') => list.map(([a, b]) => `${tk(a)};${tk(b)}`);
const BEAMS = [[5.5, 7.3], [12, 14], [18.5, 20.5]];
const beamKT = ['0', ...BEAMS.flatMap(([a, b]) => [tk(a), tk(a + .12), tk(b), tk(b + .12)]), '1'].join(';');
const beamV = ['0', ...BEAMS.flatMap(() => ['0', '1', '1', '0']), '0'].join(';');
const kaiju = `
<g><animateMotion dur="${T}s" repeatCount="indefinite" path="M${XS} ${f(yF)} L${XE} ${f(yF)}" calcMode="linear" keyTimes="0;${tk(MOVE)};1" keyPoints="0;1;1"/>
  <ellipse cx="0" cy="3" rx="100" ry="10" fill="#000" opacity=".35"/>
  <g transform="scale(5.6)">
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -.7;0 0" dur=".65s" repeatCount="indefinite"/>
      <g fill="#C85F34" stroke="${INK}" stroke-width=".55" stroke-linejoin="round">
        <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.3s" repeatCount="indefinite"/><rect x="-14" y="-9" width="4.6" height="9"/><rect x="-1.2" y="-9" width="4.6" height="9"/></g>
        <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.3s" begin=".65s" repeatCount="indefinite"/><rect x="-7.6" y="-9" width="4.6" height="9"/><rect x="5.2" y="-9" width="4.6" height="9"/></g>
      </g>
      <g stroke="${INK}" stroke-width=".55" stroke-linejoin="round">
        <polygon points="-11,-31 -8,-41 -5,-31" fill="#8E3F22"/><polygon points="-4,-31 0,-44 4,-31" fill="#8E3F22"/><polygon points="5,-31 8,-41 11,-31" fill="#8E3F22"/>
        <g fill="#C85F34"><g><animateTransform attributeName="transform" type="rotate" values="-8 -13 -22;-34 -13 -22;-8 -13 -22" dur="1.3s" repeatCount="indefinite"/><rect x="-22" y="-24" width="9" height="5"/></g>
        <g><animateTransform attributeName="transform" type="rotate" values="8 13 -22;34 13 -22;8 13 -22" dur="1.3s" begin=".65s" repeatCount="indefinite"/><rect x="13" y="-24" width="9" height="5"/></g></g>
        <rect x="-13" y="-32" width="26" height="24" rx="1.2" fill="#D2693A"/>
        <rect x="-12.4" y="-14" width="24.8" height="5.4" fill="#A84D2A" opacity=".55" stroke="none"/>
      </g>
      <g><circle cx="-5.4" cy="-23" r="5" fill="#FFD66B" opacity=".35"/><circle cx="5.4" cy="-23" r="5" fill="#FFD66B" opacity=".35"/>
        <rect x="-7.4" y="-27" width="3.8" height="9" rx=".8" fill="#FFE9A0" stroke="${INK}" stroke-width=".4"/><rect x="3.6" y="-27" width="3.8" height="9" rx=".8" fill="#FFE9A0" stroke="${INK}" stroke-width=".4"/>
        <rect x="-6.4" y="-24.5" width="1.8" height="5" fill="#FF5A2E"/><rect x="4.6" y="-24.5" width="1.8" height="5" fill="#FF5A2E"/>
        <path d="M-9 -29.5 L-3 -27.6" stroke="${INK}" stroke-width="1" stroke-linecap="round"/><path d="M9 -29.5 L3 -27.6" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>
        <ellipse cx="0" cy="-12.5" rx="6.4" ry="2" fill="#4A130E" stroke="${INK}" stroke-width=".5"><animate attributeName="ry" values="2;5.2;2" dur=".65s" repeatCount="indefinite"/></ellipse>
        <polygon points="-4.6,-14 -3.2,-11.6 -1.8,-14" fill="#FFF5E2"/><polygon points="1.8,-14 3.2,-11.6 4.6,-14" fill="#FFF5E2"/></g>
      <!-- atomic breath -->
      <g opacity="0"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="${beamKT}" values="${beamV}"/>
        <polygon points="5,-13.5 70,-24 70,2 5,-11" fill="url(#beam)"/><polygon points="5,-13 70,-15 70,-5 5,-12" fill="#FFFFFF" opacity=".9"/>
        <circle cx="68" cy="-10" r="9" fill="#FFD66B"><animate attributeName="r" values="7;13;7" dur=".3s" repeatCount="indefinite"/></circle>
        <circle cx="68" cy="-10" r="26" fill="url(#fireglow)"/></g>
    </g>
  </g>
  <g><animate attributeName="opacity" values="0;.8;0" dur="1.3s" repeatCount="indefinite"/><circle cx="-58" cy="-4" r="16" fill="#C9B79E"><animate attributeName="r" values="6;28;6" dur="1.3s" repeatCount="indefinite"/></circle></g>
  <g><animate attributeName="opacity" values="0;.8;0" dur="1.3s" begin=".65s" repeatCount="indefinite"/><circle cx="58" cy="-4" r="16" fill="#C9B79E"><animate attributeName="r" values="6;28;6" dur="1.3s" begin=".65s" repeatCount="indefinite"/></circle></g>
</g>`;

// ---------- sky ----------
let stars = ''; for (let i = 0; i < 26; i++) stars += `<circle cx="${f(hash(i) * W)}" cy="${f(hash(i + 70) * 150)}" r="${(.6 + hash(i + 30) * 1.2).toFixed(1)}" fill="#FFF5E2" opacity="${(.4 + hash(i + 5) * .5).toFixed(2)}"><animate attributeName="opacity" values=".25;.95;.25" dur="${(2 + hash(i) * 3).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
let hills = `M0 ${Y0 - 20}`; for (let x = 0; x <= W; x += 30) hills += ` L${x} ${f(Y0 - 34 - 26 * Math.abs(Math.sin(x * .021) * Math.cos(x * .007 + 1)) - 14 * hash(x))}`; hills += ` L${W} ${Y0 + 10} L0 ${Y0 + 10}Z`;
let plumes = ''; for (let i = 0; i < 5; i++) { const x = 180 + i * 150 + hash(i) * 60; plumes += `<ellipse cx="${f(x)}" cy="${Y0 - 10}" rx="14" ry="22" fill="#2A2D3A" opacity="0"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;${tk(5 + i * 3)};${tk(8 + i * 3)};.96;.98;1" values="0;0;.55;.5;0;0"/><animateTransform attributeName="transform" type="translate" values="0 0;${(hash(i) * 20 - 10).toFixed(0)} -60;0 0" dur="${(6 + i).toFixed(0)}s" repeatCount="indefinite"/></ellipse>`; }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1030"/><stop offset=".55" stop-color="#2B2250"/><stop offset=".85" stop-color="#8A3F62"/><stop offset="1" stop-color="#D9704F"/></linearGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".6" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FF4D2E" stop-opacity=".6"/></linearGradient>
  <linearGradient id="search" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E8F3FF" stop-opacity=".5"/><stop offset="1" stop-color="#E8F3FF" stop-opacity="0"/></linearGradient>
  <radialGradient id="fireglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF9A4D" stop-opacity=".7"/><stop offset="1" stop-color="#FF7A2E" stop-opacity="0"/></radialGradient>
  <radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF1C4" stop-opacity=".9"/><stop offset="1" stop-color="#FFF1C4" stop-opacity="0"/></radialGradient>
  <pattern id="win" width="5.2" height="6.2" patternUnits="userSpaceOnUse"><rect width="5.2" height="6.2" fill="none"/><rect x="1" y="1.4" width="2.3" height="2.8" fill="#FFD98A"/></pattern>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars}
<circle cx="770" cy="64" r="60" fill="url(#moon)"/><circle cx="770" cy="64" r="22" fill="#FFF1C4"/>
<path d="${hills}" fill="#142A36"/>
<g opacity=".22"><polygon points="130,${H} 150,${H} 170,40 120,40" fill="url(#search)"><animateTransform attributeName="transform" type="rotate" values="-14 140 ${H};16 140 ${H};-14 140 ${H}" dur="9s" repeatCount="indefinite"/></polygon>
<polygon points="${W - 150},${H} ${W - 130},${H} ${W - 110},40 ${W - 160},40" fill="url(#search)"><animateTransform attributeName="transform" type="rotate" values="12 ${W - 140} ${H};-16 ${W - 140} ${H};12 ${W - 140} ${H}" dur="11s" repeatCount="indefinite"/></polygon></g>
<g>
  <animateTransform attributeName="transform" type="translate" values="0 0;1.4 -1.8;-1.2 1;0 0" dur="1.3s" repeatCount="indefinite"/>
  <rect y="${f(P(0, 7)[1] - 4)}" width="${W}" height="${H}" fill="#161B28"/>
  <path d="M0 ${f(P(0, 7.7)[1])} H${W}" stroke="#D8C9A0" stroke-opacity=".5" stroke-width="2" stroke-dasharray="26 18"/>
  ${lots}
  ${behind}
  ${plumes}
  ${kaiju}
  ${front}
</g>
<rect width="${W}" height="${H}" fill="#06070E" opacity="1"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" keyTimes="0;.015;.94;.975;1" values="1;0;0;1;1"/></rect>
</g>
</svg>`;
writeFileSync(out, svg);
console.log(`wrote ${out}: ${COLS} weeks, ${eaten} buildings, loop ${T}s, ${(svg.length / 1024).toFixed(0)} KB`);
