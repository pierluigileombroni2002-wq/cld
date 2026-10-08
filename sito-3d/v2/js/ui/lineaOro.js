// =============================================================================
// ERI v2 · ui/lineaOro.js — componente LineaOro (SVG a schermo intero) e transizione 4 → 5
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.2 "Componente LineaOro" (un <path> a schermo intero; morph punto per punto di 64
// punti ricampionati per lunghezza d'arco; tratto oro 1 px con punta luminosa), §4.5 "Transizione verso la
// tappa 5" (15,38 – 15,64: retta dei 10 MW proiettata → linea orizzontale a sy 0,58 → polilinea proiettata
// del cavidotto), config.LINEA_ORO, STATO.lineaOroAlfa / lineaOroStende / lineaOroPiega.
//
// Contratto (ARCHITETTURA §6):
//  export function creaLineaOro(svg) → { imposta(punti), morph(da, a, k), alfa(v), punta(v), svg }
//    punti = [[x, y], …] in px CSS (oppure Float32Array interlacciato con n = lunghezza/2).
//  crea(ctx), aggiorna(ctx, T, t, dt): la transizione 4 → 5 è una funzione pura di T (STATO) più le proiezioni.
// Nessuna allocazione nel ciclo: buffer preallocati; resta solo la stringa dell'attributo d.
// =============================================================================
import { LINEA_ORO, IDRO, PIANURA } from '../config.js';
import { altezza, clamp } from '../geo.js';

export const MONDO = 'ui';

const NS = 'http://www.w3.org/2000/svg';
const N = LINEA_ORO.punti;            // 64 punti per forma
const MAX_INGRESSO = 512;             // punti massimi accettati in ingresso
let progressivo = 0;                  // id univoci dei gradienti della punta

/** Ricampiona per lunghezza d'arco n punti interlacciati (src) in N punti (dst). */
function ricampiona(src, n, dst) {
  if (n <= 0) { dst.fill(0); return dst; }
  if (n === 1) { for (let i = 0; i < N; i++) { dst[2 * i] = src[0]; dst[2 * i + 1] = src[1]; } return dst; }
  // lunghezza totale
  let L = 0;
  for (let i = 1; i < n; i++) L += Math.hypot(src[2 * i] - src[2 * i - 2], src[2 * i + 1] - src[2 * i - 1]);
  if (L < 1e-6) { for (let i = 0; i < N; i++) { dst[2 * i] = src[0]; dst[2 * i + 1] = src[1]; } return dst; }
  let seg = 1, acc = 0, lseg = Math.hypot(src[2] - src[0], src[3] - src[1]);
  for (let i = 0; i < N; i++) {
    const s = (i / (N - 1)) * L;
    while (seg < n - 1 && acc + lseg < s) { acc += lseg; seg++; lseg = Math.hypot(src[2 * seg] - src[2 * seg - 2], src[2 * seg + 1] - src[2 * seg - 1]); }
    const u = lseg > 1e-9 ? clamp((s - acc) / lseg, 0, 1) : 0;
    dst[2 * i] = src[2 * seg - 2] + (src[2 * seg] - src[2 * seg - 2]) * u;
    dst[2 * i + 1] = src[2 * seg - 1] + (src[2 * seg + 1] - src[2 * seg - 1]) * u;
  }
  return dst;
}

/** Copia punti [[x,y],…] (o Float32Array interlacciato) nel buffer di lavoro; restituisce il numero di punti. */
function leggi(punti, buf) {
  if (!punti) return 0;
  if (punti instanceof Float32Array || punti instanceof Float64Array) { const n = Math.min(punti.length >> 1, MAX_INGRESSO); for (let i = 0; i < 2 * n; i++) buf[i] = punti[i]; return n; }
  const n = Math.min(punti.length, MAX_INGRESSO);
  for (let i = 0; i < n; i++) { const p = punti[i]; buf[2 * i] = p[0] ?? p.x; buf[2 * i + 1] = p[1] ?? p.y; }
  return n;
}

/**
 * Componente LineaOro su un <svg> a schermo intero (coordinate = px CSS).
 * @param {SVGSVGElement} svg
 * @returns {{svg:SVGSVGElement, imposta(p:any, n?:number):void, morph(da:any, a:any, k:number):void, alfa(v:number):void, punta(v:number):void, pista(x0:number, x1:number, y:number, v:number):void, morphBuffer(A:Float32Array, nA:number, B:Float32Array, nB:number, k:number):void}}
 */
export function creaLineaOro(svg) {
  if (!svg) return { svg, imposta() {}, morph() {}, alfa() {}, punta() {}, pista() {}, morphBuffer() {} };
  const id = 'eri-punta-' + (++progressivo);
  svg.innerHTML = '';
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<radialGradient id="${id}"><stop offset="0" stop-color="#f1dfb3" stop-opacity=".95"/><stop offset=".35" stop-color="#f1dfb3" stop-opacity=".35"/><stop offset="1" stop-color="#f1dfb3" stop-opacity="0"/></radialGradient>`;
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'linea-oro-g');
  const pista = document.createElementNS(NS, 'line'); pista.setAttribute('class', 'pista'); pista.style.opacity = '0';
  const alone = document.createElementNS(NS, 'path'); alone.setAttribute('class', 'alone');
  const tratto = document.createElementNS(NS, 'path'); tratto.setAttribute('class', 'tratto');
  const puntaAlone = document.createElementNS(NS, 'circle'); puntaAlone.setAttribute('r', '11'); puntaAlone.setAttribute('fill', `url(#${id})`);
  const puntaC = document.createElementNS(NS, 'circle'); puntaC.setAttribute('r', '3'); puntaC.setAttribute('class', 'punta');
  g.append(pista, alone, tratto, puntaAlone, puntaC);
  svg.append(defs, g);
  g.style.opacity = '0';

  const ingresso = new Float32Array(MAX_INGRESSO * 2);
  const A = new Float32Array(N * 2), B = new Float32Array(N * 2), C = new Float32Array(N * 2);
  let ultimoAlfa = -1, ultimaPunta = -1, ultimoD = '';

  function scrivi(buf) {
    let d = 'M' + buf[0].toFixed(1) + ' ' + buf[1].toFixed(1);
    for (let i = 1; i < N; i++) d += 'L' + buf[2 * i].toFixed(1) + ' ' + buf[2 * i + 1].toFixed(1);
    if (d !== ultimoD) { ultimoD = d; tratto.setAttribute('d', d); alone.setAttribute('d', d); }
    const x = buf[2 * N - 2].toFixed(1), y = buf[2 * N - 1].toFixed(1);
    puntaC.setAttribute('cx', x); puntaC.setAttribute('cy', y); puntaAlone.setAttribute('cx', x); puntaAlone.setAttribute('cy', y);
  }
  const api = {
    svg,
    /** Imposta la forma (ricampionata a 64 punti). */
    imposta(punti, n) {
      const k = leggi(punti, ingresso);
      ricampiona(ingresso, n != null ? Math.min(n, k) : k, C); scrivi(C);
    },
    /** Morph punto per punto tra due forme (k 0..1). */
    morph(da, a, k) {
      const nA = leggi(da, ingresso); ricampiona(ingresso, nA, A);
      const nB = leggi(a, ingresso); ricampiona(ingresso, nB, B);
      for (let i = 0; i < 2 * N; i++) C[i] = A[i] + (B[i] - A[i]) * k;
      scrivi(C);
    },
    /** Come morph, ma da buffer interlacciati già pronti (nessuna conversione). */
    morphBuffer(SA, nA, SB, nB, k) {
      ricampiona(SA, nA, A); ricampiona(SB, nB, B);
      for (let i = 0; i < 2 * N; i++) C[i] = A[i] + (B[i] - A[i]) * k;
      scrivi(C);
    },
    /** Opacità del componente. */
    alfa(v) { v = clamp(v, 0, 1); if (Math.abs(v - ultimoAlfa) > 0.003 || (v === 0) !== (ultimoAlfa === 0)) { ultimoAlfa = v; g.style.opacity = v.toFixed(3); } },
    /** Opacità della punta luminosa. */
    punta(v) { v = clamp(v, 0, 1); if (Math.abs(v - ultimaPunta) > 0.003) { ultimaPunta = v; puntaC.style.opacity = puntaAlone.style.opacity = v.toFixed(3); } },
    /** Pista tenue (preloader): linea di riferimento da x0 a x1 alla quota y. */
    pista(x0, x1, y, v) {
      pista.setAttribute('x1', x0.toFixed(1)); pista.setAttribute('x2', x1.toFixed(1));
      pista.setAttribute('y1', y.toFixed(1)); pista.setAttribute('y2', y.toFixed(1)); pista.style.opacity = String(v);
    },
  };
  return api;
}

// ---------------------------------------------------------------- transizione 4 → 5 (§4.5)
let L = null;                                   // LineaOro su svg#linea-oro
const _P = { x: 0, y: 0, z: 0, davanti: false, dentro: false };
const RETTA = new Float32Array(4), ORIZZ = new Float32Array(4), CAVO = new Float32Array(MAX_INGRESSO * 2);
let cavoRiserva = null;                         // [x, y, z][] dal config (altezza + sopraSuolo)
let visibile = false;

export async function crea(ctx) {
  const svg = document.getElementById('linea-oro');
  if (!svg || ctx.noWebGL) return;
  L = creaLineaOro(svg);
  const cv = PIANURA.cavidotto;
  cavoRiserva = cv.punti.map(([x, z]) => [x, altezza(x, z) + (cv.sopraSuolo || 0.02), z]);
}

/** Valore di un'ancora: Vector3 | () => Vector3 | Vector3[] | () => Vector3[]. */
function ancora(ctx, nome) { const a = ctx.ancore?.get(nome); return typeof a === 'function' ? a() : a; }

export function aggiorna(ctx, T, t, dt) {
  if (!L || !ctx.camera) return;
  const S = ctx.STATO, a = S.lineaOroAlfa || 0;
  if (a <= 0.001) { if (visibile) { L.alfa(0); visibile = false; } return; }
  visibile = true;
  const W = innerWidth, H = innerHeight, y58 = LINEA_ORO.sy * H;
  ORIZZ[0] = 0; ORIZZ[1] = y58; ORIZZ[2] = W; ORIZZ[3] = y58;
  if (ctx.mondo === 'valle') {
    // estremi proiettati della retta dei 10 MW → linea orizzontale a tutta larghezza (15,40 → 15,48)
    const r = ancora(ctx, 'diagramma.retta10');
    const p0 = r && r[0] ? r[0] : IDRO.diagramma.retta10Mondo[0], p1 = r && r[1] ? r[1] : IDRO.diagramma.retta10Mondo[1];
    ctx.proietta(p0, _P); RETTA[0] = _P.x; RETTA[1] = _P.y;
    ctx.proietta(p1, _P); RETTA[2] = _P.x; RETTA[3] = _P.y;
    L.morphBuffer(RETTA, 2, ORIZZ, 2, clamp(S.lineaOroStende || 0, 0, 1));
  } else {
    // linea orizzontale → polilinea proiettata del cavidotto (15,50 → 15,58)
    const cavo = ancora(ctx, 'cavo.polilinea');
    const punti = (Array.isArray(cavo) && cavo.length > 1) ? cavo : cavoRiserva;
    const n = Math.min(punti.length, MAX_INGRESSO);
    for (let i = 0; i < n; i++) { ctx.proietta(punti[i], _P); CAVO[2 * i] = _P.x; CAVO[2 * i + 1] = _P.y; }
    L.morphBuffer(ORIZZ, 2, CAVO, n, clamp(S.lineaOroPiega || 0, 0, 1));
  }
  L.punta(1 - clamp(S.lineaOroPiega || 0, 0, 1) * 0.6);
  L.alfa(a);
}
