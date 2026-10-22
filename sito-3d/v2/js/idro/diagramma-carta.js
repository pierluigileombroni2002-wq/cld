// =============================================================================
// ERI v2 · idro/diagramma-carta.js — tavola del diagramma 4e su canvas (file privato di idro/diagramma.js)
// Proprietario: [VALLE]. Disegna UNA volta, in crea():
//  - la CARTA (CanvasTexture config.IDRO.diagramma.canvas): avorio con una luce morbida, carta logaritmica
//    (sottodecadi a filo, decadi al 35 %), assi a inchiostro con tacche, numeri in Plex Mono dentro la tavola:
//    la scala della portata IN ALTO (in basso stanno le giranti e l'HUD), quella del salto sulla decade di 1 m³/s
//    (la sinistra della tavola sta sotto la colonna del testo), cartiglio in alto a destra; rette di isopotenza
//    1 e 100 MW tratteggiate e 1 000 MW a puntini (è il taglio dei campi), con le etichette "a risparmio" lungo la
//    retta, didascalia "campi indicativi";
//  - le MASCHERE dei testi animati (DataTexture RGBA lineare: R Pelton, G Francis, B Kaplan = nome e intervalli del
//    campo, A = "10 MW" lungo la retta), che lo shader della tavola colora e rivela.
// Coordinate del piano (u): x = (log₁₀Q + 1)·25, y = log₁₀H·18,2 (geo.diagrammaXY), origine in basso a sinistra.
// =============================================================================
import * as THREE from 'three';
import { IDRO, VALLE, PALETTE } from '../config.js';
import { diagrammaXY, numeroIt } from '../geo.js';

const D = IDRO.diagramma;
export const [LARGO, ALTO] = VALLE.diagramma.dim;                    // 100 × 60 u
export const CAMPI = ['pelton', 'francis', 'kaplan'];

// TARATURA: proporre in config (IDRO.diagramma.carta) — resa della tavola
export const CARTA = {
  // avorio con una luce morbida al centro; entro il tetto dell'inversa del tono (≈ #f3 per canale): niente bloom
  fondo: '#efe9de', luce: '#f3efe7',
  pxCss: 3.6,                            // px di canvas per px CSS a 1600 px di larghezza (spessori e corpi)
  sottodecadi: 0.10, decadi: 0.34,       // copertura della griglia (decadi al 35 %, §4.5)
  isopotenza: 0.55, taglio: 0.42,        // copertura delle rette 1 / 100 MW e della 1 000 MW
  numeri: 46, titoli: 32, etichette: 42, didascalia: 50,   // corpi (px di canvas)
};

// ---------------------------------------------------------------- geometria del diagramma (u del piano)
const xy = (Q, H) => diagrammaXY(Q, H);
/** y della retta di isopotenza P (MW) all'ascissa x: H = P·1000 / (fattore·Q). */
export function yIso(P, x) { return D.yScala * (Math.log10(P * 1000 / D.retta10.fattore) - (x / D.xScala - 1)); }
/** x della retta di isopotenza P (MW) all'ordinata y. */
export function xIso(P, y) { return D.xScala * (Math.log10(P * 1000 / D.retta10.fattore) - y / D.yScala + 1); }
/** Tratto della retta di isopotenza P dentro la tavola: [[x0, y0], [x1, y1]] (da sinistra in alto a destra in basso). */
export function rettaIso(P, q0 = D.Q[0], q1 = D.Q[1]) {
  let x0 = Math.max(0, xy(q0, 1)[0]), x1 = Math.min(LARGO, xy(q1, 1)[0]);
  // dentro 0 ≤ y ≤ ALTO
  if (yIso(P, x0) > ALTO) x0 = xIso(P, ALTO);
  if (yIso(P, x1) < 0) x1 = xIso(P, 0);
  return [[x0, yIso(P, x0)], [x1, yIso(P, x1)]];
}

/**
 * Campi d'impiego come poligoni convessi antiorari (§4.5): rettangolo in log-log, vertice in alto a destra tagliato
 * dalla retta dei 1 000 MW, tetto alla tavola. Sempre 5 vertici (il quinto ripete l'ultimo se il taglio non c'è).
 * @returns {{nome, vertici:number[][], s:number[], perimetro:number, box:number[]}[]}
 */
export function poligoniCampi() {
  return CAMPI.map(nome => {
    const c = D.campi[nome];
    const [x0, y0] = xy(c.Q[0], c.H[0]); let [x1, y1] = xy(c.Q[1], c.H[1]);
    y1 = Math.min(y1, ALTO);
    const yt = yIso(D.taglioMW, x1);
    const v = [[x0, y0], [x1, y0]];
    if (yt < y1) { v.push([x1, Math.max(y0, yt)], [xIso(D.taglioMW, y1), y1], [x0, y1]); }
    else v.push([x1, y1], [x0, y1], [x0, y1]);
    // ascissa curvilinea normalizzata ai vertici (6 valori: chiude sul primo)
    const L = []; let tot = 0;
    for (let i = 0; i < 5; i++) { const a = v[i], b = v[(i + 1) % 5]; L.push(Math.hypot(b[0] - a[0], b[1] - a[1])); tot += L[i]; }
    const s = [0]; for (let i = 0; i < 5; i++) s.push(s[i] + L[i] / tot);
    return { nome, vertici: v, s, perimetro: tot, box: [x0, y0, x1, y1] };
  });
}

// ---------------------------------------------------------------- utilità di disegno
/** '#rrggbb' (sRGB, come in PALETTE) → 'rgba(r,g,b,a)' per il canvas. */
function col(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
/** Testo con spaziatura delle lettere (em), allineato a sinistra, al centro o a destra. Restituisce la larghezza. */
function spaziato(g, s, x, y, em, allinea = 'left') {
  const sp = em * parseFloat(g.font.match(/(\d+(?:\.\d+)?)px/)[1]);
  const lettere = [...s], larghe = lettere.map(l => g.measureText(l).width);
  const w = larghe.reduce((a, b) => a + b, 0) + sp * (lettere.length - 1);
  let cx = allinea === 'right' ? x - w : allinea === 'center' ? x - w / 2 : x;
  const prima = g.textAlign; g.textAlign = 'left';
  lettere.forEach((l, i) => { g.fillText(l, cx, y); cx += larghe[i] + sp; });
  g.textAlign = prima;
  return w;
}
const FONT = { mono: '"IBM Plex Mono", ui-monospace, monospace', jost: 'Jost, "Helvetica Neue", Arial, sans-serif', bodoni: '"Bodoni Moda", Didot, Georgia, serif' };
const fmt = v => numeroIt(v, v < 1 ? 1 : 0);

// ---------------------------------------------------------------- la carta
/**
 * Disegna la tavola statica. @returns {HTMLCanvasElement}
 */
export function disegnaCarta() {
  const [W, H] = D.canvas;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const kx = W / LARGO, ky = H / ALTO, P = CARTA.pxCss;
  const X = x => x * kx, Y = y => H - y * ky;

  // fondo avorio con luce morbida (il centro della composizione sta a destra del testo)
  const grd = g.createRadialGradient(W * 0.6, H * 0.42, 0, W * 0.6, H * 0.42, W * 0.78);
  grd.addColorStop(0, CARTA.luce); grd.addColorStop(1, CARTA.fondo);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);

  // carta logaritmica: sottodecadi a filo, decadi più marcate
  const linea = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const decQ = [], subQ = [], decH = [], subH = [];
  for (let e = -1; e <= 3; e++) for (let m = 1; m <= 9; m++) {
    const Q = m * 10 ** e; if (Q < D.Q[0] - 1e-9 || Q > D.Q[1] + 1e-9) continue;
    const x = xy(Q, 1)[0]; if (x <= 0.01 || x >= LARGO - 0.01) continue; (m === 1 ? decQ : subQ).push(x);
  }
  for (let e = 0; e <= 3; e++) for (let m = 1; m <= 9; m++) {
    const Hm = m * 10 ** e; if (Hm > D.H[1] + 1e-9) continue;
    const y = xy(1, Hm)[1]; if (y <= 0.01 || y >= ALTO - 0.01) continue; (m === 1 ? decH : subH).push(y);
  }
  g.lineCap = 'butt';
  g.strokeStyle = col(PALETTE.griglia, CARTA.sottodecadi); g.lineWidth = 0.6 * P;
  for (const x of subQ) linea(X(x), 0, X(x), H);
  for (const y of subH) linea(0, Y(y), W, Y(y));
  g.strokeStyle = col(PALETTE.griglia, CARTA.decadi); g.lineWidth = 0.9 * P;
  for (const x of decQ) linea(X(x), 0, X(x), H);
  for (const y of decH) linea(0, Y(y), W, Y(y));

  // rette di isopotenza: 1 e 100 MW tratteggiate in grigio, 1 000 MW a puntini (taglia i campi in alto a destra)
  const iso = [
    { P: D.isopotenzaMW[0], x: 60, testo: `${numeroIt(D.isopotenzaMW[0])} MW`, cop: CARTA.isopotenza, tratto: [9, 6] },
    { P: D.isopotenzaMW[1], x: 58, testo: `${numeroIt(D.isopotenzaMW[1])} MW`, cop: CARTA.isopotenza, tratto: [9, 6] },
    { P: D.taglioMW, x: 84.5, testo: `${numeroIt(D.taglioMW)} MW`, cop: CARTA.taglio, tratto: [1.2, 4.2] },
  ];
  g.font = `400 ${CARTA.etichette}px ${FONT.mono}`; g.textBaseline = 'middle';
  for (const r of iso) {
    const [[x0, y0], [x1, y1]] = rettaIso(r.P);
    const ang = Math.atan2(Y(y1) - Y(y0), X(x1) - X(x0));
    const ex = r.x, ey = yIso(r.P, ex), w = g.measureText(r.testo).width + 0.9 * CARTA.etichette;
    // linea interrotta sotto l'etichetta (risparmio cartografico)
    const cx = X(ex), cy = Y(ey), dx = Math.cos(ang) * w / 2, dy = Math.sin(ang) * w / 2;
    g.strokeStyle = col(PALETTE.grigio, r.cop); g.lineWidth = 0.9 * P; g.setLineDash(r.tratto.map(v => v * P)); g.lineCap = r.tratto[0] < 2 ? 'round' : 'butt';
    linea(X(x0), Y(y0), cx - dx, cy - dy); linea(cx + dx, cy + dy, X(x1), Y(y1));
    g.setLineDash([]); g.lineCap = 'butt';
    g.save(); g.translate(cx, cy); g.rotate(ang); g.fillStyle = col(PALETTE.grigio, Math.min(1, r.cop + 0.3));
    spaziato(g, r.testo, 0, 0, 0.06, 'center'); g.restore();
  }

  // assi a inchiostro (sinistra e basso), filo d'oro su alto e destra
  g.strokeStyle = col(PALETTE.grafite, 0.9); g.lineWidth = 1.25 * P;
  linea(0, H - 0.6 * P, W, H - 0.6 * P); linea(0.6 * P, 0, 0.6 * P, H);
  g.strokeStyle = col(PALETTE.oroLinea, 0.5); g.lineWidth = 0.8 * P;
  linea(0, 0.4 * P, W, 0.4 * P); linea(W - 0.4 * P, 0, W - 0.4 * P, H);
  // tacche verso l'interno, sottodecadi corte e decadi lunghe: portata in basso e in alto (la scala sta in alto),
  // salto a sinistra
  g.strokeStyle = col(PALETTE.grafite, 0.75); g.lineWidth = 0.8 * P;
  const tc = 0.42 * kx, tl = 0.95 * kx;
  for (const x of subQ) { linea(X(x), H, X(x), H - tc); linea(X(x), 0, X(x), tc); }
  for (const x of decQ) { linea(X(x), H, X(x), H - tl); linea(X(x), 0, X(x), tl); }
  for (const y of subH) linea(0, Y(y), tc, Y(y));
  for (const y of decH) linea(0, Y(y), tl, Y(y));

  // scala della portata IN ALTO (in basso stanno le giranti), a destra della propria decade — etichetteAssi
  const valQ = [D.Q[0], 1, 10, 100, D.Q[1]];
  g.font = `400 ${CARTA.numeri}px ${FONT.mono}`; g.textBaseline = 'alphabetic'; g.fillStyle = col(PALETTE.grafite, 0.86);
  const bq = Y(ALTO - 1.75);
  valQ.forEach((Q, i) => {
    const x = xy(Q, 1)[0];
    if (i === valQ.length - 1) spaziato(g, `${fmt(Q)} m³/s`, X(x) - 0.8 * kx, bq, 0.02, 'right');
    else spaziato(g, fmt(Q), X(x) + 0.65 * kx, bq, 0.02, 'left');
  });
  // scala del salto sulla decade di 1 m³/s (la sinistra della tavola sta sotto la colonna del testo)
  const xH = X(xy(1, 1)[0] + 0.65);
  [1, 10, 100, 1000].forEach(Hm => spaziato(g, `${fmt(Hm)} m`, xH, Y(xy(1, Hm)[1] + 0.55), 0.02, 'left'));
  // cartiglio in alto a destra, oltre la retta dei 1 000 MW: nomi degli assi e scala
  g.font = `500 ${CARTA.titoli}px ${FONT.jost}`; g.fillStyle = col(PALETTE.grafite, 0.8);
  spaziato(g, 'SALTO H  ·  PORTATA Q', X(LARGO - 0.8), Y(ALTO - 4.3), 0.2, 'right');
  g.font = `italic 400 ${CARTA.didascalia * 0.9}px ${FONT.bodoni}`; g.fillStyle = col(PALETTE.grigio, 0.95);
  spaziato(g, 'scala logaritmica', X(LARGO - 0.8), Y(ALTO - 6.0), 0.01, 'right');

  // didascalia (§4.5): sotto il campo Francis, a sinistra della colonna Pelton, fuori dalla colonna del testo
  g.font = `italic 400 ${CARTA.didascalia}px ${FONT.bodoni}`; g.fillStyle = col(PALETTE.grigio, 0.95);
  spaziato(g, D.didascalia, X(xy(IDRO.pelton.Q, 1)[0] - 1.3), Y(xy(1, D.campi.francis.H[0])[1] - 3.0), 0.01, 'right');
  return cv;
}

// ---------------------------------------------------------------- maschere dei testi animati
/**
 * Nomi dei campi (con gli intervalli) e scritta "10 MW": quattro maschere in una DataTexture RGBA (lineare).
 * @param {ReturnType<typeof poligoniCampi>} poligoni
 * @returns {THREE.DataTexture}
 */
export function mascheraTesti(poligoni, scala = 0.5) {
  const W = Math.round(D.canvas[0] * scala), H = Math.round(D.canvas[1] * scala);
  const kx = W / LARGO, ky = H / ALTO;
  const X = x => x * kx, Y = y => H - y * ky;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const dati = new Uint8Array(W * H * 4);
  const corpoNome = Math.round(CARTA.titoli * 1.05 * scala * 2), corpoInt = Math.round(CARTA.etichette * 0.62 * scala * 2);

  // posizione del nome dentro il campo, lontano dalle rette di isopotenza e fuori dalla colonna del testo:
  // Pelton a destra in alto, Francis a destra in alto (sotto il taglio dei 1 000 MW), Kaplan a sinistra sotto la 1 MW
  const posa = {
    pelton:  p => ({ x: p.box[2] - 1.4, y: p.box[3] - 4.0, allinea: 'right' }),
    francis: p => ({ x: xIso(D.taglioMW, p.box[3]) - 2.2, y: p.box[3] - 2.0, allinea: 'right' }),
    kaplan:  p => ({ x: p.box[0] + 1.4, y: 19.5, allinea: 'left' }),
  };
  const testoCampo = (p) => {
    const c = D.campi[p.nome], q = posa[p.nome](p);
    g.font = `500 ${corpoNome}px ${FONT.jost}`;
    spaziato(g, p.nome.toUpperCase(), X(q.x), Y(q.y), 0.3, q.allinea);
    g.font = `400 ${corpoInt}px ${FONT.mono}`;
    spaziato(g, `H ${fmt(c.H[0])}–${fmt(c.H[1])} m`, X(q.x), Y(q.y - 1.55), 0.03, q.allinea);
    spaziato(g, `Q ${fmt(c.Q[0])}–${fmt(c.Q[1])} m³/s`, X(q.x), Y(q.y - 2.85), 0.03, q.allinea);
  };
  const scritte = [
    ...poligoni.map(p => () => testoCampo(p)),
    () => {   // "10 MW" sopra la retta, fra il Francis e la Kaplan
      const xs = 61.5, ys = yIso(D.retta10.kW / 1000, xs);
      const ang = Math.atan2(-(yIso(D.retta10.kW / 1000, xs + 10) - ys) * ky, 10 * kx);
      g.save(); g.translate(X(xs), Y(ys)); g.rotate(ang);
      g.font = `500 ${Math.round(CARTA.etichette * 1.15 * scala * 2)}px ${FONT.mono}`; g.textBaseline = 'alphabetic';
      spaziato(g, `${numeroIt(D.retta10.kW / 1000)} MW`, 0, -0.75 * ky, 0.12, 'center');
      g.restore();
    },
  ];
  g.textBaseline = 'alphabetic';
  scritte.forEach((f, ch) => {
    g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; f();
    const img = g.getImageData(0, 0, W, H).data;
    // righe capovolte: v = 0 in basso come le uv del piano
    for (let y = 0; y < H; y++) {
      const src = y * W * 4 + 3, dst = (H - 1 - y) * W * 4 + ch;
      for (let x = 0; x < W; x++) { const a = img[src + x * 4]; if (a) dati[dst + x * 4] = a; }
    }
  });
  const t = new THREE.DataTexture(dati, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.name = 'diagramma-testi'; t.needsUpdate = true;
  return t;
}
