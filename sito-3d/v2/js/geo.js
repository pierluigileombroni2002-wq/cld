// =============================================================================
// ERI v2 · geo.js — funzioni analitiche PURE e normative (nessuna dipendenza da three)
// Proprietario: [ARCH]. Stabile: le firme non cambiano. Tutti gli altri moduli le importano da qui
// (terreno.js e sole.js le riesportano per comodità, come chiede §6.2).
// Contiene: rumore, terreno della PIANURA (§3.1), catasto (§3.2), coordinate e formati (§0),
// profilo della VALLE (§3.6), sole e tracker (§6.3, App. A), layout degli impianti (§3.5),
// rig sferico della camera (§0, §4.0), ora(T) (§4.4).
// =============================================================================
import { PIANURA, VALLE, LAYOUT, SOLE, UNITA, ORA_T, SITO_C, IDRO } from './config.js';

// ---------------------------------------------------------------- utilità numeriche
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const smootherstep = e => { e = clamp(e, 0, 1); return e * e * e * (e * (e * 6 - 15) + 10); };   // 6e⁵ − 15e⁴ + 10e³
export const rad = g => g * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
/** Smorzamento esponenziale indipendente dal frame rate (come THREE.MathUtils.damp). */
export const damp = (x, y, lambda, dt) => lerp(x, y, 1 - Math.exp(-lambda * dt));
/** Differenza angolare ridotta a (−180, 180]. */
export const diffAngolo = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; };

// ---------------------------------------------------------------- rumore deterministico (identico al v1, §3.1)
export function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function rumore(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, y) { let t = 0, amp = 0.5, f = 1; for (let i = 0; i < 5; i++) { t += amp * rumore(x * f, y * f); f *= 2.03; amp *= 0.5; } return t; }
/** Generatore pseudo-casuale riproducibile (catasto: mulberry32(27)). */
export function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- PIANURA · fiume e terreno (§3.1)
export const fiumeX = z => -62 + 16 * Math.sin(z * 0.017) + 6 * Math.sin(z * 0.045 + 1.3);
export const letto = z => 1.2 - 4.0 * (z + 180) / 360 + 0.25 * Math.sin(z * 0.031);   // da 1,36 (z=−180) a −2,96 (z=+180)
export const acqua = z => letto(z) + 0.35;                                            // pelo libero
export const valleMax = dF => 0.55 * ss(1.3, 2.6, dF) + 0.16 * Math.max(0, dF - 2.6) ** 1.3;
export const valleMin = dF => 0.55 * ss(1.3, 2.6, dF) + 0.02 * Math.max(0, dF - 2.6);
export const PIANE = PIANURA.PIANE;

export function hNaturale(x, z) {
  let h = 2.6 * fbm(x * 0.011 + 3.7, z * 0.011 - 1.9);                                  // colline (±26 m)
  h += 15 * Math.exp(-((z + 158) ** 2) / 900) * (0.72 + 0.28 * fbm(x * 0.018, 3.1));    // crinale nord
  h += 7 * Math.exp(-((x + 168) ** 2) / 1000) * (0.6 + 0.4 * fbm(2.7, z * 0.02));       // colline ovest
  h += 3 * Math.exp(-((x - 150) ** 2) / 700) * (0.5 + 0.5 * fbm(5.1, z * 0.02));        // colline est
  return h;
}
export function piana(x, z, [x0, x1, z0, z1, , b]) {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  return 1 - ss(0, b, Math.hypot(dx, dz));
}
const _quotePiane = PIANE.map(p => p[4] ?? hNaturale((p[0] + p[1]) / 2, (p[2] + p[3]) / 2));
/** Quota del terreno (u) in (x, z). Alimenta mesh, istanze, cursore, vincolo della camera, HUD (§3.1). */
export function altezza(x, z) {
  let h = hNaturale(x, z);
  const dF = Math.abs(x - fiumeX(z)), b = letto(z);
  h = Math.max(Math.min(h, b + valleMax(dF)), b + valleMin(dF));                       // scava la valle, alza le sponde
  for (let i = 0; i < PIANE.length; i++) {
    const p = PIANE[i], k = piana(x, z, p); if (k <= 0) continue;
    h += (_quotePiane[i] - h) * k;
  }
  return h;
}
/** Normale del terreno per differenze finite (out = array di 3). */
export function normaleTerreno(x, z, out = [0, 1, 0], e = 0.25) {
  const hx = altezza(x + e, z) - altezza(x - e, z), hz = altezza(x, z + e) - altezza(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz, l = Math.hypot(nx, ny, nz);
  out[0] = nx / l; out[1] = ny / l; out[2] = nz / l; return out;
}
/** Pendenza come 1 − N.y (convenzione dello shader, §6.5). */
export const pendenza = (x, z) => 1 - normaleTerreno(x, z)[1];
/** Distanza orizzontale dall'asse del fiume. */
export const distanzaFiume = (x, z) => Math.abs(x - fiumeX(z));

/** Ray-march sul terreno analitico: primo punto del raggio sotto il suolo (passo, poi bisezione). Restituisce t o -1. */
export function raggioTerreno(ox, oy, oz, dx, dy, dz, tMax = 3000, passo = 0.5) {
  let t0 = 0, sopra = oy - altezza(ox, oz);
  if (sopra < 0) return 0;
  for (let t = passo; t <= tMax; t += passo * (1 + t * 0.01)) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    if (y - altezza(x, z) < 0) {
      let a = t0, b = t;
      for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (oy + dy * m - altezza(ox + dx * m, oz + dz * m) < 0) b = m; else a = m; }
      return (a + b) / 2;
    }
    t0 = t;
  }
  return -1;
}
/** Test di visibilità tra due punti sul terreno analitico (etichette, §5.6): 24 passi. */
export function visibileSulTerreno(ax, ay, az, bx, by, bz, passi = 24, margine = 0.05) {
  for (let i = 1; i < passi; i++) {
    const t = i / passi, x = lerp(ax, bx, t), y = lerp(ay, by, t), z = lerp(az, bz, t);
    if (y < altezza(x, z) - margine) return false;
  }
  return true;
}

// ---------------------------------------------------------------- PIANURA · catasto (§3.2)
const { CELLA, N, ANGOLO } = PIANURA.catasto;
const cA = Math.cos(ANGOLO), sA = Math.sin(ANGOLO);
/** Mondo → griglia catastale (coordinate continue; la cella è floor). */
export function versoGriglia(x, z) { return [(cA * x - sA * z) / CELLA + N / 2, (sA * x + cA * z) / CELLA + N / 2]; }
/** Griglia → mondo. */
export function versoMondo(gx, gy) { const X = (gx - N / 2) * CELLA, Y = (gy - N / 2) * CELLA; return [cA * X + sA * Y, -sA * X + cA * Y]; }
/** Cella (i, j) che contiene (x, z), o null fuori griglia. */
export function cellaDi(x, z) { const [gx, gy] = versoGriglia(x, z); const i = Math.floor(gx), j = Math.floor(gy); return (i < 0 || j < 0 || i >= N || j >= N) ? null : [i, j]; }
/** Centro della cella (i, j) in mondo. */
export const centroCella = (i, j) => versoMondo(i + 0.5, j + 0.5);

// ---------------------------------------------------------------- coordinate geografiche e formati (§0, §5.5)
export const lat = z => UNITA.origineLat - z * UNITA.metriPerU / UNITA.mPerGradoLat;
export const lon = x => UNITA.origineLon + x * UNITA.metriPerU / UNITA.mPerGradoLon;
export const quotaSlm = y => UNITA.quotaBaseM + UNITA.metriPerU * y;   // metri
function gms(v) { const g = Math.floor(Math.abs(v)); const mf = (Math.abs(v) - g) * 60; const m = Math.floor(mf); const s = Math.round((mf - m) * 60);
  const [mm, ss2] = s === 60 ? [m + 1, 0] : [m, s]; return `${g}°${String(mm).padStart(2, '0')}′${String(ss2).padStart(2, '0')}″`; }
/** "42°00′41″N · 12°30′12″E" */
export const formatoGMS = (x, z, sep = ' · ') => `${gms(lat(z))}N${sep}${gms(lon(x))}E`;
const SPAZIO_FINE = ' ';
/** Numero all'italiana: virgola decimale, spazio fine per le migliaia (§0). */
export function numeroIt(v, decimali = 0) {
  const neg = v < 0; const s = Math.abs(v).toFixed(decimali); const [i, d] = s.split('.');
  const intero = i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, SPAZIO_FINE) : i;   // "1200" resta, "15 960" con spazio
  return (neg ? '−' : '') + intero + (d ? ',' + d : '');
}
/** Ora decimale → "hh:mm". */
export function formatoOra(o) { let h = Math.floor(o), m = Math.round((o - h) * 60); if (m === 60) { h++; m = 0; } return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

// ---------------------------------------------------------------- VALLE (§3.6)
export function fondoValle(x) {
  if (x < -179) return 84;
  if (x < -176) return 84 + 5 * ss(-179, -176, x);
  if (x < -96) return 17.5 + 71.5 * Math.pow((-96 - x) / 80, 1.15);
  if (x < -86) return 17.4;
  if (x < -42) return 16 - 13.5 * Math.pow((x + 86) / 44, 0.8);
  if (x < -38) return 2.0;
  if (x < -29) return 1.0;
  if (x < 106) return 1.3 - 0.45 * (x + 29) / 135;
  if (x < 118) return -0.35;
  return -0.35 - 0.15 * (x - 118) / 112;
}
export const PUNTI_M = VALLE.PUNTI_M;
export function Mliscia(x) {
  for (let i = 0; i < PUNTI_M.length - 1; i++) { const [x0, m0] = PUNTI_M[i], [x1, m1] = PUNTI_M[i + 1]; if (x <= x1) return m0 + (m1 - m0) * ss(x0, x1, x); }
  return 2;
}
export function hValle(x, z) { const s = Math.pow(ss(0, 45, -z), 1.3); return fondoValle(x) + Mliscia(x) * s + 0.6 * fbm(x * 0.05, z * 0.05) * s; }

// ---------------------------------------------------------------- SOLE (§6.3, App. A)
/** Posizione del sole (NOAA semplificata). Restituisce {el, az} in gradi (az da Nord, orario). */
export function posizioneSole(oraLocale, giorno = SOLE.giorno, latG = SOLE.lat, lonG = SOLE.lon, fuso = SOLE.fuso) {
  const g = 2 * Math.PI / 365 * (giorno - 1 + (oraLocale - fuso - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
            - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = rad((oraLocale * 60 + eqt + 4 * lonG - 60 * fuso) / 4 - 180);
  const fi = rad(latG);
  const cz = Math.sin(fi) * Math.sin(dec) + Math.cos(fi) * Math.cos(dec) * Math.cos(ha);
  const el = 90 - deg(Math.acos(clamp(cz, -1, 1)));
  const az = (deg(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(fi) - Math.tan(dec) * Math.cos(fi))) + 180 + 360) % 360;
  return { el, az };
}
/** Angolo del tracker monoassiale N-S con backtracking. Negativo = moduli verso est (mattino). */
export function angoloTracker(el, az, gcr, limite = LAYOUT.limite) {
  if (el <= 0) return { theta: 0, stato: 'NOTTE', ideale: 0 };
  const e = Math.sin(az * Math.PI / 180) * Math.cos(el * Math.PI / 180), u = Math.sin(el * Math.PI / 180);
  const tT = -Math.atan2(e, u) * 180 / Math.PI;
  let theta = tT, stato = 'INSEGUIMENTO';
  const c = Math.cos(tT * Math.PI / 180) / gcr;
  if (c < 1) { theta = tT - Math.sign(tT) * Math.acos(c) * 180 / Math.PI; stato = 'BACKTRACKING'; }
  if (Math.abs(theta) > limite) { theta = Math.sign(theta) * limite; if (stato === 'INSEGUIMENTO') stato = 'FINE CORSA'; }
  return { theta, stato, ideale: tT };
}
// In scena: rotazione attorno all'asse z (N-S) di +theta (normale = (−sin θ, cos θ, 0)).
export const intensitaSole = el => SOLE.intensitaMax * clamp(0.45 + 0.55 * el / 45, 0.45, 1) * (el <= -1 ? 0 : el >= 2 ? 1 : ss(-1, 2, el));
const srgbLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const hexLin = h => { const n = parseInt(h.slice(1), 16); return [srgbLin((n >> 16 & 255) / 255), srgbLin((n >> 8 & 255) / 255), srgbLin((n & 255) / 255)]; };
const COLORI_LIN = SOLE.colori.map(([e, h]) => [e, hexLin(h)]);
/** Colore del sole (RGB LINEARE, array di 3) per elevazione: interpolazione in lineare (§6.3). */
export function coloreSole(el, out = [1, 1, 1]) {
  const C = COLORI_LIN;
  if (el <= C[0][0]) { out[0] = C[0][1][0]; out[1] = C[0][1][1]; out[2] = C[0][1][2]; return out; }
  for (let i = 0; i < C.length - 1; i++) {
    if (el <= C[i + 1][0]) { const t = (el - C[i][0]) / (C[i + 1][0] - C[i][0]); for (let k = 0; k < 3; k++) out[k] = lerp(C[i][1][k], C[i + 1][1][k], t); return out; }
  }
  const u = C[C.length - 1][1]; out[0] = u[0]; out[1] = u[1]; out[2] = u[2]; return out;
}
/** luceSole(el) → { colore: [r,g,b] lineare, intensita } (per 3b, 3c e 6). Con THREE: color.setRGB(r,g,b, THREE.LinearSRGBColorSpace). */
export const luceSole = el => ({ colore: coloreSole(el), intensita: intensitaSole(el) });
/** Versore verso il sole: (sin az·cos el, sin el, −cos az·cos el) (§0). */
export function direzioneSole(el, az, out = [0, 1, 0]) {
  const e = rad(el), a = rad(az);
  out[0] = Math.sin(a) * Math.cos(e); out[1] = Math.sin(e); out[2] = -Math.cos(a) * Math.cos(e); return out;
}
/** ora(T) lineare a tratti (§4.4). Fuori dalla tabella resta agli estremi. */
export function oraDaT(T) {
  const t = ORA_T; if (T <= t[0][0]) return t[0][1];
  for (let i = 0; i < t.length - 1; i++) if (T <= t[i + 1][0]) return lerp(t[i][1], t[i + 1][1], (T - t[i][0]) / (t[i + 1][0] - t[i][0]));
  return t[t.length - 1][1];
}

// ---------------------------------------------------------------- rig sferico (§0, §4.0)
/** Direzione di vista: v = (cosφ·sinψ, −sinφ, −cosφ·cosψ). */
export function direzioneVista(phi, psi, out = [0, 0, -1]) {
  const f = rad(phi), p = rad(psi);
  out[0] = Math.cos(f) * Math.sin(p); out[1] = -Math.sin(f); out[2] = -Math.cos(f) * Math.cos(p); return out;
}
/** Posizione della camera: P = T − d·v. */
export function posizioneCamera(T, d, phi, psi, out = [0, 0, 0]) {
  const v = direzioneVista(phi, psi); out[0] = T[0] - d * v[0]; out[1] = T[1] - d * v[1]; out[2] = T[2] - d * v[2]; return out;
}
/** fov verticale per schermi stretti (§4.0). */
export function fovStretto(fov, aspect, soglia = 1.5, max = 75) {
  if (aspect >= soglia) return fov;
  return Math.min(max, deg(2 * Math.atan(Math.tan(rad(fov) / 2) * soglia / aspect)));
}
/** Metri per pixel della barra di scala dell'HUD (§5.5). */
export const metriPerPx = (d, fov, altezzaPx) => 2 * d * Math.tan(rad(fov) / 2) * UNITA.metriPerU / altezzaPx;

// ---------------------------------------------------------------- idro (§4.5, App. B)
export const lineeCorrente = Q => Math.max(2, Math.round(Q / IDRO.lineeFattoreQ));
export const velocitaLinee = H => IDRO.lineeVelocita * Math.sqrt(2 * IDRO.g * H);
export const potenzaMW = (Q, H) => IDRO.rho * IDRO.g * Q * H * IDRO.eta / 1e6;
/** Diagramma 4e: (Q m³/s, H m) → coordinate locali del piano (u). */
export const diagrammaXY = (Q, H) => [(Math.log10(Q) + 1) * IDRO.diagramma.xScala, Math.log10(H) * IDRO.diagramma.yScala];

// ---------------------------------------------------------------- LAYOUT DEGLI IMPIANTI (§3.5, normativo)
// Intervalli in z (sulla retta verticale x) dentro il poligono (pari-dispari).
function intervalliDentro(poli, x) {
  const zs = [];
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i], b = poli[(i + 1) % poli.length];
    if ((a[0] <= x && x < b[0]) || (b[0] <= x && x < a[0])) zs.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
  }
  zs.sort((p, q) => p - q);
  const out = []; for (let i = 0; i + 1 < zs.length; i += 2) out.push([zs[i], zs[i + 1]]);
  return out;
}
// Intervallo di z (sulla retta x) a distanza ≤ m dal segmento ab: la "capsula" è convessa → un intervallo.
function intervalloCapsula(a, b, m, x) {
  let lo = Infinity, hi = -Infinity;
  for (const c of [a, b]) { const dx = x - c[0]; if (Math.abs(dx) <= m) { const h = Math.sqrt(m * m - dx * dx); lo = Math.min(lo, c[1] - h); hi = Math.max(hi, c[1] + h); } }
  // fascia: 0 ≤ t ≤ 1 e |perp| ≤ m, entrambe lineari in z
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
  let zl = -Infinity, zh = Infinity;
  const vincolo = (al, be, min, max) => { // min ≤ al·z + be ≤ max
    if (Math.abs(al) < 1e-12) { if (be < min || be > max) { zl = Infinity; zh = -Infinity; } return; }
    let z1 = (min - be) / al, z2 = (max - be) / al; if (z1 > z2) [z1, z2] = [z2, z1]; zl = Math.max(zl, z1); zh = Math.min(zh, z2);
  };
  vincolo(dz / L2, ((x - a[0]) * dx - a[1] * dz) / L2, 0, 1);           // t(z) = ((x−ax)dx + (z−az)dz)/L²
  vincolo(-dx / L, ((x - a[0]) * dz + a[1] * dx) / L, -m, m);           // perp(z) = ((x−ax)dz − (z−az)dx)/L
  if (zl <= zh) { lo = Math.min(lo, zl); hi = Math.max(hi, zh); }
  return lo <= hi ? [lo, hi] : null;
}
function sottrai(intervalli, tolti) {
  let out = intervalli.slice();
  for (const [t0, t1] of tolti) {
    const n = [];
    for (const [a, b] of out) { if (t1 <= a || t0 >= b) { n.push([a, b]); continue; } if (t0 > a) n.push([a, t0]); if (t1 < b) n.push([t1, b]); }
    out = n;
  }
  return out;
}
function interseca(A, B) {
  const out = [];
  for (const [a0, a1] of A) for (const [b0, b1] of B) { const l = Math.max(a0, b0), h = Math.min(a1, b1); if (h > l) out.push([l, h]); }
  return out.sort((p, q) => p[0] - q[0]);
}
function liberi(poli, x, m) {
  const tolti = []; for (let i = 0; i < poli.length; i++) { const c = intervalloCapsula(poli[i], poli[(i + 1) % poli.length], m, x); if (c) tolti.push(c); }
  return sottrai(intervalliDentro(poli, x), tolti);
}
function paliDi(z0, z1) {   // ogni 0,8 u simmetrici attorno al palo centrale del motoriduttore
  const c = (z0 + z1) / 2, p = [c];
  for (let k = 1; ; k++) { const d = k * LAYOUT.passoPali; if (c + d > z1 - 0.04) break; p.push(c - d, c + d); }
  return p.sort((a, b) => a - b);
}
const _layout = {};
/**
 * Layout normativo (§3.5). nome = 'fv' | 'agri'.
 * Restituisce { nome, file:[{numero, x, tracker:[{lettera, z0, z1, moduli, centro:[x,y,z], pali:[z...], chiave, ordine}]}],
 *               tracker:[...piatto], totali:{file, tracker, moduli, potenzaMWp}, quotaAsse }
 * chiave = distanza normalizzata dal tracker eroe (onda tappa 3); ordine = ordine di montaggio normalizzato (cantiere tappa 5).
 */
export function calcolaLayout(nome = 'fv') {
  if (_layout[nome]) return _layout[nome];
  const p = LAYOUT[nome], poli = nome === 'fv' ? PIANURA.contornoFV : PIANURA.contornoAgri;
  const m = LAYOUT.margine, dx = LAYOUT.controlloX, L = LAYOUT.lunghezzaTracker, Lm = LAYOUT.moduliMezzo * LAYOUT.passoModulo + 0.06;
  const minX = Math.min(...poli.map(q => q[0])), maxX = Math.max(...poli.map(q => q[0]));
  const quota = nome === 'fv' ? PIANURA.PIANE[0][4] : PIANURA.PIANE[1][4];
  const file = [];
  for (let i = 0, x = minX + m; x <= maxX - m + 1e-9; i++, x = minX + m + i * p.passoFile) {
    const xr = Math.round(x * 1000) / 1000;
    const iv = interseca(interseca(liberi(poli, xr - dx, m), liberi(poli, xr, m)), liberi(poli, xr + dx, m));
    const trk = [];
    for (const [za, zb] of iv) {
      let z = za;
      while (z + L <= zb + 1e-9) { trk.push({ z0: z, z1: z + L, moduli: LAYOUT.moduliTracker }); z += L + LAYOUT.corridoio; }
      if (zb - z >= L / 2 - 1e-9) trk.push({ z0: z, z1: z + Lm, moduli: LAYOUT.moduliMezzo });
    }
    if (trk.length) file.push({ x: xr, tracker: trk });
  }
  const piatto = [];
  file.forEach((f, fi) => {
    f.numero = fi + 1;
    f.tracker.forEach((t, ti) => {
      t.lettera = String.fromCharCode(65 + ti); t.fila = f.numero; t.x = f.x;
      t.centro = [f.x, quota + p.quotaAsse, (t.z0 + t.z1) / 2];
      t.pali = paliDi(t.z0, t.z1);
      piatto.push(t);
    });
  });
  // chiave: distanza dal tracker eroe (FV) o da AGRI_C (agri), normalizzata 0..1
  const eroe = nome === 'fv' ? PIANURA.trackerEroe.centro : [86, 0, 32.5];
  const dE = piatto.map(t => Math.hypot(t.centro[0] - eroe[0], t.centro[2] - eroe[2])); const maxE = Math.max(...dE) || 1;
  // ordine di montaggio: dal cancello, per distanza crescente, fila per fila (§4.6)
  const [gx, gz] = PIANURA.cancello;
  const fileOrdinate = file.map(f => ({ f, d: Math.min(...f.tracker.map(t => Math.hypot(t.centro[0] - gx, t.centro[2] - gz))) })).sort((a, b) => a.d - b.d);
  let k = 0; const n = piatto.length;
  for (const { f } of fileOrdinate) for (const t of f.tracker.slice().sort((a, b) => Math.abs(a.centro[2] - gz) - Math.abs(b.centro[2] - gz))) t.ordine = (k++) / Math.max(1, n - 1);
  piatto.forEach((t, i) => { t.chiave = dE[i] / maxE; });
  const moduli = piatto.reduce((s, t) => s + t.moduli, 0);
  return (_layout[nome] = { nome, file, tracker: piatto, quotaAsse: quota + p.quotaAsse,
    totali: { file: file.length, tracker: piatto.length, moduli, potenzaMWp: moduli * LAYOUT.modulo.wp / 1e6 } });
}

/** Distanza orizzontale da SITO_C (origine delle onde radiali). */
export const distanzaSito = (x, z) => Math.hypot(x - SITO_C[0], z - SITO_C[2]);
