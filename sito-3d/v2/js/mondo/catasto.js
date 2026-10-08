// =============================================================================
// ERI v2 · mondo/catasto.js — catasto, vincoli, maschere (texture dati) e overlay 3D di sviluppo
// Proprietario: [PIANURA]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.2 (griglia, particelle, tStati), §3.3 (vincoli → tVincoli, tMaschere.B), §3.4 (maschere R/G/B/A), §2.7 (fogli, tende, lunetta, layout), §4.1–4.3 (eventi: fogliGIS, lunetta, tende, percorso, uLayout, sigillo, polvere), config.PIANURA, config.OVERLAY, config.LAYOUT.
//
// Cosa costruisce (tutto in crea(), nulla dopo):
//  - campo delle quote 513² (stessa spaziatura della mesh S = 512): base CPU di vincoli, idonee e mesh del terreno;
//  - tStati: DataTexture 48×48 RGBA8 NearestFilter (R bit di stato, G id particella, B proprietario×64, A copertura vincoli);
//    particelle generiche con mulberry32(27), gruppi di 1–3 celle lungo i;
//  - tVincoli: DataTexture 1024² RGBA8 lineare con mip (R paesaggistico, G fluviale, B PAI, A archeologico: nucleo 1, rispetto 0,5),
//    rasterizzata sulla CPU con le forme esatte di §3.3;
//  - tMaschere: DataTexture 2048² RGBA8 lineare con mip (R campi arati, G strade asfalto 1/ghiaia 0,6, B bosco/Natura 2000,
//    A piazzali 1 / cantiere 0,5). Disegnata su canvas canale per canale (il canale alfa di un canvas è premoltiplicato:
//    per questo si legge ogni canale come scala di grigi e si compone a mano). Leggibile anche sulla CPU (maschera(x, z)).
//  - aree idonee (vincoli < 5 %, pendenza < 0,05 su 9 campioni, fuori da strade, fiume e bosco);
//  - oggetti 3D nascosti finché STATO li accende: 5 fogli GIS, lunetta (60 tacche), tende di luce, percorso del sopralluogo,
//    layout proposto/approvato (plotter LineSegments2), sigillo READY TO BUILD, polvere.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): pubblica ctx.dati.catasto = { tStati, tVincoli, tMaschere, particellaDi(x, z) → {foglio, id, numero, ha, idonea,
//             proprietario, stato} | null } più (privati del pacchetto PIANURA) campo, maschera(x, z), U (uniform private
//             condivise con terreno.js), particelle.
//  ancore registrate: 'sito.centro', 'catasto.connessione', 'percorso.punta' (funzione), 'sigillo.centro'.
// =============================================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PIANURA, OVERLAY, PALETTE, SITO_C, TRACCE, LAYOUT } from '../config.js';
import { altezza, fiumeX, acqua, mulberry32, versoMondo, cellaDi, rumore, clamp } from '../geo.js';
import { nuovoMateriale, aggiungiPatch } from '../luce/nebbia.js';

export const MONDO = 'pianura';

const LATO = PIANURA.lato, MEZZO = LATO / 2;
const CAT = PIANURA.catasto, NC = CAT.N;
const BIT = PIANURA.bitStato;
const VIN = PIANURA.vincoli;
const PROPRIETARI = { A: 1, B: 2, C: 3, D: 4 };
const ORO_3D = '#d6a454';                              // --oro-3d-emissivo (§2.1)
// TARATURA: proporre in config — tempi del plotter (frazioni di uLayout) e misure dei tratteggi in u
const PLOTTER = { recinzione: [0.00, 0.18, 0.025], viabilita: [0.10, 0.24, 0.03], tracker: [0.20, 0.86, 0.07],
                  cabine: [0.84, 0.93, 0.03], punto: [0.90, 1.00, 0.06], tratto: 0.8, pausa: 0.6 };
const PERCORSO = { tratto: 0.55, pausa: 0.4, passo: 0.5, sopra: 0.08 };

// Colore lineare HDR (sRGB dichiarato, §2.1) × fattore di emissione.
const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// ---------------------------------------------------------------- campo delle quote (513², passo 360/512)
const CAMPO_S = 512;
function creaCampo() {
  const n = CAMPO_S + 1, passo = LATO / CAMPO_S, h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) { const z = -MEZZO + j * passo; for (let i = 0; i < n; i++) h[j * n + i] = altezza(-MEZZO + i * passo, z); }
  /** Quota bilineare dal campo (identica alla mesh S = 512 sui vertici). */
  function quota(x, z) {
    const fx = clamp((x + MEZZO) / passo, 0, CAMPO_S - 1e-6), fz = clamp((z + MEZZO) / passo, 0, CAMPO_S - 1e-6);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * n + i;
    return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + n] * (1 - u) + h[k + n + 1] * u) * v;
  }
  /** Pendenza 1 − N.y (convenzione dello shader, §6.5) per differenze centrali sul campo. */
  function pendenza(x, z) {
    const gx = (quota(x + passo, z) - quota(x - passo, z)) / (2 * passo), gz = (quota(x, z + passo) - quota(x, z - passo)) / (2 * passo);
    return 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
  }
  return { S: CAMPO_S, n, passo, h, quota, pendenza };
}

// ---------------------------------------------------------------- tVincoli (§3.3), rasterizzati sulla CPU
function rasterVincoli(campo) {
  const { lato: L, min, max } = VIN.texture, px = (max - min) / L;
  const d = new Uint8Array(L * L * 4);
  const P = VIN.paesaggistico, F = VIN.fluviale, I = VIN.pai, A = VIN.archeologico;
  // s = distanza firmata in pixel (positiva dentro): bordo antialiasato su un pixel
  const morbido = s => s <= -0.5 ? 0 : s >= 0.5 ? 255 : Math.round((s + 0.5) * 255);
  for (let j = 0; j < L; j++) {
    const z = min + (j + 0.5) * px, fx = fiumeX(z), aq = acqua(z);
    for (let i = 0; i < L; i++) {
      const x = min + (i + 0.5) * px, k = (j * L + i) * 4, h = campo.quota(x, z);
      // R · paesaggistico: cerchio armonico + fascia di crinale (z < −138 e quota > 7)
      const dx = x - P.centro[0], dz = z - P.centro[1], th = Math.atan2(dz, dx);
      let f = 1; for (const [m, a, ph] of P.armoniche) f += a * Math.sin(m * th + ph);
      const sCerchio = (P.raggio * f - Math.hypot(dx, dz)) / px;
      const sCrinale = Math.min((P.crinale.zMax - z) / px, (h - P.crinale.altezzaMin) / 0.12);
      d[k] = morbido(Math.max(sCerchio, sCrinale));
      // G · fascia fluviale: dF ≤ 17
      const dF = Math.abs(x - fx);
      d[k + 1] = morbido((F.dF - dF) / px);
      // B · PAI: pendenza > 0,20 oppure (dF < 25 e quota < pelo libero + 1)
      const sPend = (campo.pendenza(x, z) - I.pendenza) / 0.01;
      const sEsond = Math.min((I.dF - dF) / px, (aq + I.sopraAcqua - h) / 0.06);
      d[k + 2] = morbido(Math.max(sPend, sEsond));
      // A · archeologico: nucleo r ≤ 8 (1,0) e anello di rispetto 8–12 (0,5)
      const dA = Math.hypot(x - A.centro[0], z - A.centro[1]);
      d[k + 3] = Math.max(morbido((A.raggio - dA) / px), morbido((A.rispetto - dA) / px) >> 1);
    }
  }
  return { dati: d, L, px, min };
}

// ---------------------------------------------------------------- geometria piana di supporto
/** Poligono rientrato di d (u) verso l'interno (bisettrici; orientamento ricavato dall'area firmata). */
function rientra(poli, d) {
  const n = poli.length; let area = 0;
  for (let i = 0; i < n; i++) { const [x0, z0] = poli[i], [x1, z1] = poli[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
  const s = area > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const p = poli[(i - 1 + n) % n], c = poli[i], q = poli[(i + 1) % n];
    const n0 = norm2([-(c[1] - p[1]) * s, (c[0] - p[0]) * s]), n1 = norm2([-(q[1] - c[1]) * s, (q[0] - c[0]) * s]);
    const b = norm2([n0[0] + n1[0], n0[1] + n1[1]]), cosM = Math.max(0.3, b[0] * n0[0] + b[1] * n0[1]);
    out.push([c[0] + b[0] * d / cosM, c[1] + b[1] * d / cosM]);
  }
  return out;
}
function norm2(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
function dentroPoligono(x, z, poli) {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i], [xj, zj] = poli[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** Polilinea suddivisa in pezzi di al massimo `passo` u: [[x, z], …] chiusa se `chiusa`. */
function suddividi(punti, passo, chiusa = false) {
  const out = [], n = punti.length, m = chiusa ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = punti[i], b = punti[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(l / passo));
    for (let s = 0; s < k; s++) out.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]);
  }
  out.push(chiusa ? punti[0] : punti[n - 1]);
  return out;
}

// ---------------------------------------------------------------- tMaschere (canvas → canale)
const L_MASC = PIANURA.maschere.lato;
/** Disegna un canale su un canvas in scala di grigi (coordinate mondo) e ne restituisce la luminanza. */
function canale(disegna) {
  const c = document.createElement('canvas'); c.width = c.height = L_MASC;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, L_MASC, L_MASC);
  const s = L_MASC / LATO; g.setTransform(s, 0, 0, s, MEZZO * s, MEZZO * s);   // (x, z) mondo → pixel; riga = z
  g.lineCap = 'round'; g.lineJoin = 'round';
  disegna(g, s);
  const img = g.getImageData(0, 0, L_MASC, L_MASC).data, out = new Uint8Array(L_MASC * L_MASC);
  for (let i = 0, k = 0; i < out.length; i++, k += 4) out[i] = img[k];
  c.width = c.height = 1;                                     // libera la memoria del canvas
  return out;
}
const percorsoPoli = (g, punti) => { g.beginPath(); punti.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); };
function rettangolo(g, cx, cz, lx, lz) { g.fillRect(cx - lx / 2, cz - lz / 2, lx, lz); }
/** Contorno rumoroso dell'ellisse ambientale (§3.3): [[x, z], …]. Rotazione nel piano x–z: x' = x·cos − z·sin. */
export function contornoBosco(punti = 256) {
  const E = VIN.ambientale, cr = Math.cos(E.rotazione), sr = Math.sin(E.rotazione), out = [];
  for (let k = 0; k < punti; k++) {
    const t = k / punti * Math.PI * 2, ex0 = E.semiassi[0] * Math.cos(t), ez0 = E.semiassi[1] * Math.sin(t);
    const r = Math.hypot(ex0, ez0), sc = (r + E.rumore * rumore(Math.cos(t) * 2.6 + 11.3, Math.sin(t) * 2.6 + 7.1)) / r;
    const ex = ex0 * sc, ez = ez0 * sc;
    out.push([E.centro[0] + ex * cr - ez * sr, E.centro[1] + ex * sr + ez * cr]);
  }
  return out;
}

// ---------------------------------------------------------------- particelle (§3.2)
function creaParticelle() {
  const idCella = new Int32Array(NC * NC).fill(-1), particelle = [];
  const riservati = new Set();
  const tabella = (lista, foglio, fv, agri) => {
    for (const p of lista) {
      const k = particelle.length; riservati.add(p.id);
      particelle.push({ g: p.id, foglio, numero: p.id, ha: p.ha, proprietario: p.proprietario, stato: p.stato, firmaT: p.firmaT,
                        celle: p.celle.map(c => c.slice()), fv, agri, centroide: p.centroide });
      for (const [i, j] of p.celle) idCella[j * NC + i] = k;
    }
  };
  tabella(PIANURA.particelleFV, PIANURA.foglioFV, true, false);
  tabella(PIANURA.particelleAgri, PIANURA.foglioAgri, false, true);
  // generiche: per ogni riga j si percorre i da 0 a 47, gruppi di 1 + floor(rnd·3) celle (mulberry32(27))
  const rnd = mulberry32(CAT.seme);
  let g = 0, numero = 0;
  const prossimoG = () => { do { g = g % 255 + 1; } while (riservati.has(g)); return g; };
  const prossimoNumero = () => { do { numero++; } while (riservati.has(numero)); return numero; };
  for (let j = 0; j < NC; j++) {
    let i = 0;
    while (i < NC) {
      if (idCella[j * NC + i] >= 0) { i++; continue; }
      const lun = 1 + Math.floor(rnd() * CAT.gruppoMax), k = particelle.length, celle = [];
      for (let s = 0; s < lun && i < NC && idCella[j * NC + i] < 0; s++, i++) { idCella[j * NC + i] = k; celle.push([i, j]); }
      const r2 = rnd();
      particelle.push({ g: prossimoG(), foglio: CAT.foglioGenerico, numero: prossimoNumero(), ha: +(celle.length * (0.94 + 0.12 * r2)).toFixed(2),
                        proprietario: null, stato: null, celle, fv: false, agri: false });
    }
  }
  return { idCella, particelle };
}

// ---------------------------------------------------------------- fogli GIS (canvas 1024², §4.2)
const L_FOGLIO = 1024;
function canvasFoglio(k, vincoli, masc) {
  const c = document.createElement('canvas'); c.width = c.height = L_FOGLIO;
  const g = c.getContext('2d');
  const img = g.createImageData(L_FOGLIO, L_FOGLIO), o = img.data;
  const rosso = [224, 100, 79], oro = [216, 184, 120];
  const { dati, L } = vincoli, scV = L / L_FOGLIO, scM = L_MASC / L_FOGLIO;
  const mascheraDi = (i, j) => {
    if (k === 4) return masc[((j * scM) | 0) * L_MASC + ((i * scM) | 0)] / 255;
    return dati[(((j * scV) | 0) * L + ((i * scV) | 0)) * 4 + k] / 255;
  };
  // fondo del foglio: velo d'inchiostro appena dorato (si legge come "foglio" senza coprire la carta)
  for (let i = 0; i < o.length; i += 4) { o[i] = oro[0]; o[i + 1] = oro[1]; o[i + 2] = oro[2]; o[i + 3] = 7; }
  if (k !== 3) {
    for (let j = 1; j < L_FOGLIO - 1; j++) for (let i = 1; i < L_FOGLIO - 1; i++) {
      const m = mascheraDi(i, j); if (m < 0.5) continue;
      const bordo = mascheraDi(i + 1, j) < 0.5 || mascheraDi(i - 1, j) < 0.5 || mascheraDi(i, j + 1) < 0.5 || mascheraDi(i, j - 1) < 0.5;
      let a;
      if (k === 0) a = (i + j) % 6 < 1.3 ? 1 : 0;                             // 45°
      else if (k === 1) a = ((i - j) % 6 + 6) % 6 < 1.3 ? 1 : 0;              // 135°
      else if (k === 2) a = (i % 7 >= 3 && i % 7 <= 4 && j % 7 >= 3 && j % 7 <= 4) ? 1 : 0;   // puntinato
      else a = ((i + j) % 7 < 1.1 || ((i - j) % 7 + 7) % 7 < 1.1) ? 0.8 : 0;   // incrociato
      if (bordo) a = (k === 1 && ((i + j) >> 1) % 2) ? 0.2 : 1;               // fluviale: bordo puntinato
      const p = (j * L_FOGLIO + i) * 4, al = Math.max(a * 230, 26);
      o[p] = rosso[0]; o[p + 1] = rosso[1]; o[p + 2] = rosso[2]; o[p + 3] = al;
    }
  }
  g.putImageData(img, 0, 0);
  const s = L_FOGLIO / LATO, X = x => (x + MEZZO) * s;
  if (k === 3) {   // archeologico: cerchio tratteggiato e anello di rispetto (in canvas, con i trattini)
    const A = VIN.archeologico;
    g.strokeStyle = 'rgba(224,100,79,0.95)'; g.lineWidth = 2; g.setLineDash([4, 4]);
    for (const r of [A.raggio, A.rispetto]) { g.beginPath(); g.arc(X(A.centro[0]), X(A.centro[1]), r * s, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([]); g.fillStyle = 'rgba(224,100,79,0.18)'; g.beginPath(); g.arc(X(A.centro[0]), X(A.centro[1]), A.raggio * s, 0, Math.PI * 2); g.fill();
  }
  // cornice oro (1 px a 1024) con tacche agli angoli, titolo in Plex Mono nell'angolo
  g.strokeStyle = 'rgba(216,184,120,0.95)'; g.lineWidth = 2; g.strokeRect(6, 6, L_FOGLIO - 12, L_FOGLIO - 12);
  g.lineWidth = 1; g.strokeRect(14, 14, L_FOGLIO - 28, L_FOGLIO - 28);
  g.fillStyle = 'rgba(241,223,179,1)'; g.font = '500 22px "IBM Plex Mono", monospace'; g.textBaseline = 'top';
  const titolo = `STRATO ${String(k + 1).padStart(2, '0')} · ${PIANURA.stratiGIS[k].toUpperCase()}`;
  g.fillText(titolo, 30, 28);
  g.font = '400 15px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(216,184,120,0.9)';
  g.fillText('FG. 27–28 · SCALA 1:10 000 · DATI ILLUSTRATIVI', 30, 58);
  g.textAlign = 'right'; g.fillText('42°00′N · 12°30′E', L_FOGLIO - 30, 28);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.name = 'foglioGIS' + k;
  return t;
}

// ---------------------------------------------------------------- sigillo READY TO BUILD (canvas 2048², §4.3)
function canvasSigillo() {
  const L = PIANURA.sigillo.canvas, R = L / 2;
  const c = document.createElement('canvas'); c.width = c.height = L;
  const g = c.getContext('2d'); g.translate(R, R);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  const anello = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  anello(R * 0.975, R * 0.022); anello(R * 0.935, R * 0.006); anello(R * 0.80, R * 0.006); anello(R * 0.775, R * 0.0025);
  // tacche di bussola sull'anello esterno (ogni 6°, più lunghe ogni 30°)
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, l = i % 5 === 0 ? 0.045 : 0.02;
    g.lineWidth = i % 5 === 0 ? 5 : 3; g.beginPath();
    g.moveTo(Math.sin(a) * R * 0.935, -Math.cos(a) * R * 0.935); g.lineTo(Math.sin(a) * R * (0.935 - l), -Math.cos(a) * R * (0.935 - l)); g.stroke();
  }
  // testo circolare in Plex Mono fra i due anelli (ripetuto 2 volte)
  const frase = PIANURA.sigillo.testi[1].toUpperCase() + '  ·  ';
  const testo = frase + frase, n = testo.length, rT = R * 0.845;
  g.font = `500 ${Math.round(R * 0.052)}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -rT); g.fillText(testo[i], 0, 0); g.restore();
  }
  // centro: READY TO BUILD in Bodoni maiuscolo, filetti e losanghe
  const fs = Math.round(R * 0.15);
  g.font = `500 ${fs}px "Bodoni Moda", serif`;
  if ('letterSpacing' in g) g.letterSpacing = Math.round(fs * 0.06) + 'px';
  g.fillText(PIANURA.sigillo.testi[0], 0, -fs * 0.05);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.lineWidth = 4;
  for (const y of [-fs * 0.95, fs * 0.85]) { g.beginPath(); g.moveTo(-R * 0.52, y); g.lineTo(R * 0.52, y); g.stroke(); }
  const losanga = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill(); };
  losanga(0, -fs * 0.95, 14); losanga(0, fs * 0.85, 14);
  g.font = `400 ${Math.round(R * 0.045)}px "IBM Plex Mono", monospace`;
  if ('letterSpacing' in g) g.letterSpacing = Math.round(R * 0.012) + 'px';
  g.fillText('TITOLO AUTORIZZATIVO · CONNESSIONE ACCETTATA', 0, fs * 1.32);
  g.fillText('DIRITTI SUI TERRENI', 0, -fs * 1.4);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  // velo di rame appena percepibile dentro il sigillo
  g.globalAlpha = 0.07; g.beginPath(); g.arc(0, 0, R * 0.775, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.name = 'sigillo';
  return t;
}

// ---------------------------------------------------------------- plotter: LineSegments2 con rivelazione per segmento
// Ogni segmento ha (t0, t1, lunghezza): si disegna da inizio a fine quando uAvanza va da t0 a t1, con una punta luminosa.
// uContinua 0 → 1 chiude i tratteggi (layout approvato), uIntensita dissolve, uRitraccia ripassa le linee (×2 sul fronte).
function patchPlotter(u) {
  return sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('void main() {',
      'attribute vec3 aTempi; varying vec3 vTempi; varying float vFase; varying vec2 vXZ;\nvoid main() {\n' +
      '\tvTempi = aTempi; vFase = position.y < 0.5 ? 0.0 : 1.0; vXZ = ( position.y < 0.5 ? instanceStart : instanceEnd ).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uAvanza; uniform float uContinua; uniform float uIntensita; uniform float uPunta; uniform float uRitraccia;\n' +
        'uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uSitoC;\nvarying vec3 vTempi; varying float vFase; varying vec2 vXZ;\nvoid main() {')
      .replace('if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard;',
        'float rv = clamp( ( uAvanza - vTempi.x ) / max( vTempi.y - vTempi.x, 1e-5 ), 0.0, 1.0 );\n' +
        '\t\t\t\tif ( rv <= 0.0 || vFase > rv ) discard;\n' +
        '\t\t\t\tfloat periodo = dashSize + gapSize;\n' +
        '\t\t\t\tif ( mod( vLineDistance + dashOffset, periodo ) > mix( dashSize, periodo + 0.01, uContinua ) ) discard;')
      .replace('vec4 diffuseColor = vec4( diffuse, alpha );',
        'float dPunta = ( rv - vFase ) * vTempi.z;\n' +
        '\t\t\tfloat punta = rv < 0.999 ? exp( - dPunta * dPunta / 0.12 ) : 0.0;\n' +
        '\t\t\tfloat rit = 1.0;\n' +
        '\t\t\tif ( uRitraccia > 0.0 ) { float dd = ( distance( vXZ, uSitoC.xz ) - uRitraccia ) / 4.0; rit += 2.0 * exp( - dd * dd ) * ( 1.0 - smoothstep( 280.0, 320.0, uRitraccia ) ); }\n' +
        '\t\t\tvec3 colP = ( mix( uColA, uColB, uContinua ) * rit + uColA * uPunta * punta ) * uIntensita;\n' +
        '\t\t\tvec4 diffuseColor = vec4( colP, alpha );');
  };
}
function creaPlotter(ctx, segmenti, opz) {
  const n = segmenti.length, pos = new Float32Array(n * 6), tempi = new Float32Array(n * 3);
  segmenti.forEach((s, i) => {
    pos.set(s.a, i * 6); pos.set(s.b, i * 6 + 3);
    tempi[i * 3] = s.t0; tempi[i * 3 + 1] = s.t1; tempi[i * 3 + 2] = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
  });
  const geo = new LineSegmentsGeometry(); geo.setPositions(pos);
  geo.setAttribute('aTempi', new THREE.InstancedBufferAttribute(tempi, 3));
  const u = {
    uAvanza: { value: 0 }, uContinua: { value: 0 }, uIntensita: { value: 1 }, uPunta: { value: opz.punta ?? OVERLAY.layoutProposto.punta },
    uColA: { value: opz.colA.clone() }, uColB: { value: (opz.colB || opz.colA).clone() },
    uRitraccia: ctx.U.uRitraccia, uSitoC: ctx.U.uSitoC,
  };
  const mat = nuovoMateriale(LineMaterial, {
    color: 0xffffff, linewidth: opz.px, dashed: true, dashSize: opz.tratto, gapSize: opz.pausa, dashScale: 1,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }, { patch: patchPlotter(u), chiave: 'plotter-v1' });
  const linee = new LineSegments2(geo, mat);
  linee.computeLineDistances();
  linee.frustumCulled = false; linee.visible = false; linee.renderOrder = 3;
  linee.userData.noAO = true; linee.name = opz.nome;
  return { linee, mat, u, px: opz.px };
}

// ---------------------------------------------------------------- stato del modulo
let st = null;
const _punta = new THREE.Vector3();

export async function crea(ctx) {
  const t0 = performance.now();
  const campo = creaCampo();
  const vincoli = rasterVincoli(campo);

  // ---- maschere G (strade), B (bosco), A (piazzali e cantiere)
  const strade = PIANURA.strade;
  const mG = canale(g => {
    g.globalCompositeOperation = 'lighten';
    for (const k of Object.keys(strade)) {
      const s = strade[k]; g.strokeStyle = s.tipo === 'asfalto' ? '#fff' : 'rgb(153,153,153)'; g.lineWidth = s.larghezza;
      percorsoPoli(g, s.punti); g.stroke();
    }
  });
  const bosco = contornoBosco();
  const mB = canale(g => { g.filter = 'blur(1.5px)'; g.fillStyle = '#fff'; percorsoPoli(g, bosco); g.closePath(); g.fill(); });
  const contornoFV = PIANURA.contornoFV, recinto = rientra(contornoFV, LAYOUT.recinzione.rientro);
  const pista = rientra(contornoFV, 0.76);
  const mA = canale(g => {
    g.fillStyle = '#fff';
    const cp = PIANURA.cabinaPrimaria; rettangolo(g, cp.centro[0], cp.centro[1], cp.piazzale[0], cp.piazzale[1]);
    const cc = PIANURA.cabineCancello.centro; rettangolo(g, cc[0], cc[1], 1.6, 3.0);
    const cap = PIANURA.capannone; rettangolo(g, cap.centro[0], cap.centro[1], cap.dim[0] + 2.0, cap.dim[1] + 1.6);
    // cantiere (0,5): pista perimetrale dentro la recinzione e piazzale di cantiere vicino al cancello (§4.6)
    g.globalCompositeOperation = 'lighten';
    g.strokeStyle = 'rgb(128,128,128)'; g.fillStyle = 'rgb(128,128,128)'; g.lineWidth = 0.32;
    percorsoPoli(g, pista); g.closePath(); g.stroke();
    rettangolo(g, 44.6, -15.5, 4.0, 5.0);
  });
  const valoreMasc = (m, x, z) => {
    const i = clamp(Math.floor((x + MEZZO) / LATO * L_MASC), 0, L_MASC - 1), j = clamp(Math.floor((z + MEZZO) / LATO * L_MASC), 0, L_MASC - 1);
    return m[j * L_MASC + i] / 255;
  };
  const valoreVin = (x, z, c) => {
    const { dati, L } = vincoli, i = clamp(Math.floor((x + MEZZO) / LATO * L), 0, L - 1), j = clamp(Math.floor((z + MEZZO) / LATO * L), 0, L - 1);
    return dati[(j * L + i) * 4 + c] / 255;
  };

  // ---- particelle, copertura dei vincoli, aree idonee
  const { idCella, particelle } = creaParticelle();
  const copertura = new Float32Array(NC * NC), idoneaCella = new Uint8Array(NC * NC), pendMax = new Float32Array(NC * NC);
  const ID = PIANURA.idonee;
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const k = j * NC + i; let vinc = 0, nv = 0, pm = 0, ostacolo = false, fuori = false;
    for (let b = 0; b < 5; b++) for (let a = 0; a < 5; a++) {
      const [x, z] = versoMondo(i + (a + 0.5) / 5, j + (b + 0.5) / 5); nv++;
      if (Math.abs(x) > MEZZO || Math.abs(z) > MEZZO) { fuori = true; continue; }
      const v = Math.max(valoreVin(x, z, 0), valoreVin(x, z, 1), valoreVin(x, z, 2), valoreVin(x, z, 3), valoreMasc(mB, x, z));
      if (v > 0.5) vinc++;
      if (valoreMasc(mG, x, z) > 0.3 || Math.abs(x - fiumeX(z)) < PIANURA.fiume.mezzaLarghezzaBagnata + 1) ostacolo = true;
      if (a % 2 === 0 && b % 2 === 0) pm = Math.max(pm, campo.pendenza(x, z));    // 9 campioni (3×3)
    }
    copertura[k] = vinc / nv; pendMax[k] = pm;
    idoneaCella[k] = (!fuori && copertura[k] < ID.vincoliMax && pm < ID.pendenzaMax && !ostacolo) ? 1 : 0;
  }
  for (const p of particelle) {
    if (p.fv || p.agri) for (const [i, j] of p.celle) idoneaCella[j * NC + i] = 1;   // i siti sono scelti sulle aree idonee
    p.idonea = p.celle.every(([i, j]) => idoneaCella[j * NC + i]);
    p.copertura = p.celle.reduce((s, [i, j]) => s + copertura[j * NC + i], 0) / p.celle.length;
    p.info = { foglio: p.foglio, id: p.g, numero: p.numero, ha: p.ha, idonea: p.idonea, proprietario: p.proprietario, stato: p.stato };
  }

  // ---- maschera R: campi arati (particelle generiche non vincolate, rnd > 0,55) e agrivoltaico (colture)
  const rndCampi = mulberry32(CAT.seme * 7 + 3);
  const campi = particelle.filter(p => {
    const r = rndCampi(); if (p.fv) return false; if (p.agri) return true;
    if (p.copertura > 0.02) return false;
    const pm = Math.max(...p.celle.map(([i, j]) => pendMax[j * NC + i]));
    const [cx, cz] = versoMondo(p.celle[0][0] + 0.5, p.celle[0][1] + 0.5);
    return r > PIANURA.maschere.campiSoglia && pm < 0.03 && Math.abs(cx) < MEZZO && Math.abs(cz) < MEZZO;
  });
  const rndBordi = mulberry32(91);
  const mR = canale(g => {
    g.filter = 'blur(1.2px)'; g.fillStyle = '#fff';
    for (const p of campi) for (const [i, j] of p.celle) {
      // cella rientrata di 0,3 u (capezzagne e fossi fra i campi), con un leggero tremolio dei vertici
      const e = 0.03, q = [[i + e, j + e], [i + 1 - e, j + e], [i + 1 - e, j + 1 - e], [i + e, j + 1 - e]].map(([a, b]) => {
        const [x, z] = versoMondo(a, b); return [x + (rndBordi() - 0.5) * 0.25, z + (rndBordi() - 0.5) * 0.25];
      });
      percorsoPoli(g, q); g.closePath(); g.fill();
    }
  });

  // ---- tMaschere (RGBA8 composto a mano) e tVincoli
  const masc = new Uint8Array(L_MASC * L_MASC * 4);
  for (let i = 0, k = 0; i < mR.length; i++, k += 4) { masc[k] = mR[i]; masc[k + 1] = mG[i]; masc[k + 2] = mB[i]; masc[k + 3] = mA[i]; }
  const dataTex = (dati, L, mip, nome) => {
    const t = new THREE.DataTexture(dati, L, L, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.name = nome;
    if (mip) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; }
    else { t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.NearestFilter; }
    t.needsUpdate = true; return t;
  };
  const tMaschere = dataTex(masc, L_MASC, true, 'tMaschere');
  const tVincoli = dataTex(vincoli.dati, vincoli.L, true, 'tVincoli');

  // ---- tStati 48×48 (§3.2)
  const stati = new Uint8Array(NC * NC * 4);
  for (let k = 0; k < NC * NC; k++) {
    const p = particelle[idCella[k]];
    let r = idoneaCella[k] ? BIT.idonea : 0;
    if (p.fv) r |= BIT.sitoFV; if (p.agri) r |= BIT.agri;
    if (p.stato === 'firmato') r |= BIT.firmato; if (p.stato === 'trattativa') r |= BIT.trattativa;
    stati[k * 4] = r; stati[k * 4 + 1] = p.g;
    stati[k * 4 + 2] = p.proprietario ? Math.min(255, PROPRIETARI[p.proprietario] * PIANURA.proprietarioScala) : 0;
    stati[k * 4 + 3] = Math.round(copertura[k] * 255);
  }
  const tStati = dataTex(stati, NC, false, 'tStati');

  // ---- uniform private condivise con terreno.js (scritte da aggiorna)
  const U = {
    uHoverPos: { value: new THREE.Vector2(1e5, 1e5) },
    uLampo: { value: [1, 1, 1, 1, 1] },
    uPulsa: { value: 0.5 },           // 0..1, pulsazione 1,2 Hz delle particelle in trattativa
    uLampoFirma: { value: 1 },        // lampo ×2 alla firma (T 4,00)
    uTempoR: { value: 0 },            // secondi, fermo con riduci movimento
  };
  const hover = { x: 1e5, z: 1e5, id: 0 };

  // ---- pubblicazione
  ctx.dati.catasto = {
    tStati, tVincoli, tMaschere, campo, U, particelle,
    /** Particella in (x, z) → {foglio, id, numero, ha, idonea, proprietario, stato} | null (id = tStati.G = uHover). */
    particellaDi(x, z) {
      const c = cellaDi(x, z); if (!c) return null;
      const p = particelle[idCella[c[1] * NC + c[0]]]; if (!p) return null;
      hover.x = x; hover.z = z; hover.id = p.g;
      return p.info;
    },
    /** Maschere sulla CPU in (x, z): {R campi, G strade, B bosco, A piazzali} in 0..1 (out riusabile). */
    maschera(x, z, out = {}) {
      out.R = valoreMasc(mR, x, z); out.G = valoreMasc(mG, x, z); out.B = valoreMasc(mB, x, z); out.A = valoreMasc(mA, x, z); return out;
    },
    contornoBosco: bosco,
  };

  // ======================================================================= oggetti 3D
  const scena = ctx.scene.pianura;
  const gruppo = new THREE.Group(); gruppo.name = 'catasto'; scena.add(gruppo);

  // ---- 5 fogli GIS
  const FG = PIANURA.fogliGIS, fogli = [];
  const geoFoglio = new THREE.PlaneGeometry(FG.lato, FG.lato).rotateX(-Math.PI / 2);
  for (let k = 0; k < 5; k++) {
    const mat = nuovoMateriale(THREE.MeshBasicMaterial, {
      map: canvasFoglio(k, vincoli, mB), color: new THREE.Color(1.35, 1.35, 1.35), transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const m = new THREE.Mesh(geoFoglio, mat);
    m.position.y = FG.quote[k]; m.visible = false; m.renderOrder = 6 + k; m.userData.noAO = true; m.name = 'foglioGIS' + k;
    m.frustumCulled = false;
    gruppo.add(m); fogli.push(m);
  }
  const impattoFoglio = [0, 1, 2, 3, 4].map(k => TRACCE[`fogliGIS.${k}.y`]?.[0]?.[1] ?? 99);

  // ---- lunetta: 60 tacche radiali attorno a SITO_C (§2.7)
  const LU = OVERLAY.lunetta;
  const geoTacca = new THREE.PlaneGeometry(LU.tacca[0], LU.tacca[1]).rotateX(-Math.PI / 2);
  const matTacca = nuovoMateriale(THREE.MeshBasicMaterial, { color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lunetta = new THREE.InstancedMesh(geoTacca, matTacca, LU.tacche);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), su = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < LU.tacche; i++) {
      const th = i / LU.tacche * Math.PI * 2;                              // in senso orario da nord
      const dx = Math.sin(th), dz = -Math.cos(th), r = LU.raggio;
      const x = SITO_C[0] + dx * r, z = SITO_C[2] + dz * r, mezzo = LU.tacca[1] / 2;
      const y = Math.max(altezza(x, z), altezza(x - dx * mezzo, z - dz * mezzo), altezza(x + dx * mezzo, z + dz * mezzo)) + 0.06;
      q.setFromAxisAngle(su, Math.PI - th); p.set(x, y, z);
      lunetta.setMatrixAt(i, m4.compose(p, q, s1)); lunetta.setColorAt(i, new THREE.Color(0, 0, 0));
    } }
  lunetta.instanceMatrix.needsUpdate = true; lunetta.instanceColor.setUsage(THREE.DynamicDrawUsage);
  lunetta.visible = false; lunetta.renderOrder = 4; lunetta.userData.noAO = true; lunetta.name = 'lunetta'; lunetta.frustumCulled = false;
  gruppo.add(lunetta);
  const coloreTacca = { accesa: hdr(PALETTE.oro, LU.accesa), spenta: hdr(PALETTE.oro, LU.spenta), tmp: new THREE.Color() };

  // ---- tende di luce sui confini delle 7 particelle del sito (§2.7, §4.2)
  const TE = OVERLAY.tende;
  const tende = creaTende(ctx, particelle, idCella, TE, U);
  gruppo.add(tende.mesh);

  // ---- percorso del sopralluogo (tratteggio oro con un punto che avanza)
  const puntiPerc = suddividi(PIANURA.percorsoSopralluogo, PERCORSO.passo);
  const lunPerc = []; let accP = 0;
  for (let i = 0; i < puntiPerc.length; i++) { if (i) accP += Math.hypot(puntiPerc[i][0] - puntiPerc[i - 1][0], puntiPerc[i][1] - puntiPerc[i - 1][1]); lunPerc.push(accP); }
  const p3 = ([x, z]) => [x, altezza(x, z) + PERCORSO.sopra, z];
  const segPerc = [];
  for (let i = 0; i < puntiPerc.length - 1; i++) segPerc.push({ a: p3(puntiPerc[i]), b: p3(puntiPerc[i + 1]), t0: lunPerc[i] / accP, t1: lunPerc[i + 1] / accP });
  const percorso = creaPlotter(ctx, segPerc, { nome: 'percorso', colA: hdr(PALETTE.oro, 2.0), px: 1.4, tratto: PERCORSO.tratto, pausa: PERCORSO.pausa, punta: 3 });
  gruppo.add(percorso.linee);
  const matPunta = nuovoMateriale(THREE.MeshBasicMaterial, { color: hdr(PALETTE.oroChiaro, 6), transparent: true, depthWrite: false, fog: false });
  const puntaPerc = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), matPunta);
  puntaPerc.visible = false; puntaPerc.userData.noAO = true; puntaPerc.name = 'percorso.punta'; gruppo.add(puntaPerc);
  const alonePerc = new THREE.Mesh(new THREE.RingGeometry(0.35, 1.1, 40).rotateX(-Math.PI / 2),
    nuovoMateriale(THREE.MeshBasicMaterial, { color: hdr(PALETTE.oro, 1.2), transparent: true, opacity: 0.5, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  alonePerc.visible = false; alonePerc.userData.noAO = true; gruppo.add(alonePerc);
  const puntoSuPercorso = (f, out) => {
    const s = clamp(f, 0, 1) * accP; let i = 1; while (i < lunPerc.length - 1 && lunPerc[i] < s) i++;
    const a = puntiPerc[i - 1], b = puntiPerc[i], u = clamp((s - lunPerc[i - 1]) / Math.max(1e-6, lunPerc[i] - lunPerc[i - 1]), 0, 1);
    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
    return out.set(x, altezza(x, z) + PERCORSO.sopra, z);
  };

  // ---- layout proposto / approvato: plotter dal punto di connessione verso ovest (§4.2, §2.7)
  const conn = PIANURA.cavidotto.punti[0];                  // (40,5; −12,5) punto di connessione
  const segLay = [];
  const gruppoSeg = (lista, [g0, g1, dur]) => {
    if (!lista.length) return;
    const dist = lista.map(s => Math.hypot((s.a[0] + s.b[0]) / 2 - conn[0], (s.a[2] + s.b[2]) / 2 - conn[1]));
    const dMin = Math.min(...dist), dMax = Math.max(...dist), span = Math.max(0, g1 - g0 - dur);
    lista.forEach((s, i) => { const k = dMax > dMin ? (dist[i] - dMin) / (dMax - dMin) : 0; s.t0 = g0 + k * span; s.t1 = s.t0 + dur; segLay.push(s); });
  };
  const s3 = ([x, z], h = 0.05) => [x, altezza(x, z) + h, z];
  const catena = (punti, h) => { const out = []; for (let i = 0; i < punti.length - 1; i++) out.push({ a: s3(punti[i], h), b: s3(punti[i + 1], h) }); return out; };
  gruppoSeg(catena(suddividi(recinto, 2.0, true), 0.06), PLOTTER.recinzione);
  gruppoSeg(catena(suddividi([[41, -33], [41, -12.5], [39.6, -11.9]], 2.0), 0.06), PLOTTER.viabilita);
  const lay = ctx.dati.layout?.fv;
  if (lay) gruppoSeg(lay.tracker.map(t => ({ a: [t.x, altezza(t.x, t.z0) + 0.04, t.z0], b: [t.x, altezza(t.x, t.z1) + 0.04, t.z1] })), PLOTTER.tracker);
  {
    const cc = PIANURA.cabineCancello, cab = [];
    const rett = (cx, cz, lx, lz) => { const p = [[cx - lx / 2, cz - lz / 2], [cx + lx / 2, cz - lz / 2], [cx + lx / 2, cz + lz / 2], [cx - lx / 2, cz + lz / 2]]; cab.push(...catena([...p, p[0]], 0.06)); };
    rett(cc.centro[0] - 0.17, cc.centro[1], cc.consegna[1], cc.consegna[0]);   // lato lungo N–S
    rett(cc.centro[0] + 0.17, cc.centro[1], cc.utente[1], cc.utente[0]);
    gruppoSeg(cab, PLOTTER.cabine);
    const cerchio = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; cerchio.push([conn[0] + Math.cos(a) * 0.9, conn[1] + Math.sin(a) * 0.9]); }
    const punto = catena(cerchio, 0.07);
    punto.push({ a: s3([conn[0] - 1.5, conn[1]], 0.07), b: s3([conn[0] + 1.5, conn[1]], 0.07) }, { a: s3([conn[0], conn[1] - 1.5], 0.07), b: s3([conn[0], conn[1] + 1.5], 0.07) });
    // il punto si disegna tutto insieme, alla fine
    const [g0, g1] = PLOTTER.punto; punto.forEach(s => { s.t0 = g0; s.t1 = g1; segLay.push(s); });
  }
  const layout = creaPlotter(ctx, segLay, { nome: 'layout', colA: hdr(PALETTE.oroChiaro, OVERLAY.layoutProposto.emissione),
    colB: hdr(PALETTE.oro, OVERLAY.layoutApprovato.emissione), px: OVERLAY.layoutProposto.px, tratto: PLOTTER.tratto, pausa: PLOTTER.pausa });
  gruppo.add(layout.linee);
  const tLay = TRACCE.uLayoutApprovato?.[0] || [7.20, 7.26];   // passaggio tratteggiato → continuo

  // ---- sigillo READY TO BUILD (decalcomania a terra, diametro 26 u, rame)
  const SG = PIANURA.sigillo;
  const matSig = nuovoMateriale(THREE.MeshBasicMaterial, { map: canvasSigillo(), color: hdr(PALETTE.rame, 2.4), transparent: true, opacity: 0,
    depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const sigillo = new THREE.Mesh(new THREE.CircleGeometry(SG.diametro / 2, 96).rotateX(-Math.PI / 2), matSig);
  sigillo.position.set(SITO_C[0], SG.quota + SG.ySopra, SITO_C[2]);
  sigillo.visible = false; sigillo.renderOrder = 5; sigillo.userData.noAO = true; sigillo.name = 'sigillo';
  gruppo.add(sigillo);

  // ---- polvere: anello di 400 punti che si allarga dal bordo del sigillo
  const polvere = creaPolvere(ctx, SG);
  gruppo.add(polvere.punti);

  // ---- ancore
  const vSito = new THREE.Vector3(SITO_C[0], SITO_C[1], SITO_C[2]);
  ctx.ancore.set('sito.centro', vSito);
  ctx.ancore.set('catasto.connessione', new THREE.Vector3(conn[0], altezza(conn[0], conn[1]) + 0.4, conn[1]));
  ctx.ancore.set('percorso.punta', () => _punta);
  ctx.ancore.set('sigillo.centro', new THREE.Vector3(SITO_C[0], SG.quota + 0.1, SITO_C[2]));

  st = { campo, U, hover, fogli, impattoFoglio, lunetta, coloreTacca, accesePrima: -1, lampoPrima: -1, tende, percorso, puntaPerc, alonePerc,
         puntoSuPercorso, layout, tLay, sigillo, polvere, particelleC: particelle.filter(p => p.stato === 'trattativa') };
  if (ctx.flags?.debug) console.info(`[catasto] costruito in ${Math.round(performance.now() - t0)} ms · ${particelle.length} particelle · ${segLay.length} segmenti di layout`);
}

// ---------------------------------------------------------------- tende di luce (pareti sui confini delle particelle)
function creaTende(ctx, particelle, idCella, TE, U) {
  const sito = p => p && p.fv;
  const pos = [], aV = [], aC = [], ind = [];
  const PEZZI = 5;
  const parete = (gx0, gy0, gx1, gy1, c) => {
    for (let s = 0; s < PEZZI; s++) {
      const [x0, z0] = versoMondo(gx0 + (gx1 - gx0) * s / PEZZI, gy0 + (gy1 - gy0) * s / PEZZI);
      const [x1, z1] = versoMondo(gx0 + (gx1 - gx0) * (s + 1) / PEZZI, gy0 + (gy1 - gy0) * (s + 1) / PEZZI);
      const y0 = altezza(x0, z0) + 0.01, y1 = altezza(x1, z1) + 0.01, b = pos.length / 3;
      pos.push(x0, y0, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1); aV.push(0, 0, 1, 1); aC.push(c, c, c, c);
      ind.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  };
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const p = particelle[idCella[j * NC + i]]; if (!sito(p)) continue;
    const vicini = [[i + 1, j, i + 1, j, i + 1, j + 1], [i - 1, j, i, j, i, j + 1], [i, j + 1, i, j + 1, i + 1, j + 1], [i, j - 1, i, j, i + 1, j]];
    for (const [vi, vj, ax, ay, bx, by] of vicini) {
      const q = (vi >= 0 && vj >= 0 && vi < NC && vj < NC) ? particelle[idCella[vj * NC + vi]] : null;
      if (q === p) continue;
      if (sito(q) && q.g < p.g) continue;                                      // confine interno: una sola parete
      const c = (p.proprietario === 'C' || (q && sito(q) && q.proprietario === 'C')) ? 1 : 0;
      parete(ax, ay, bx, by, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  geo.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 1));
  geo.setIndex(ind);
  const u = {
    uAltezza: { value: 0 }, uTempo: U.uTempoR, uPulsa: U.uPulsa, uLampoFirma: U.uLampoFirma, uFirma: ctx.U.uTrattativaFirmata,
    uOro: { value: hdr(PALETTE.oro, 1) },
  };
  const mat = nuovoMateriale(THREE.ShaderMaterial, {
    uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aV; attribute float aC; uniform float uAltezza;
      varying float vV; varying float vC; varying float vY;
      void main(){
        vec3 p = position; p.y += aV * uAltezza;
        vV = aV; vC = aC; vY = aV * uAltezza;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uOro; uniform float uAltezza, uTempo, uPulsa, uLampoFirma, uFirma;
      varying float vV; varying float vC; varying float vY;
      void main(){
        // gradiente d'alfa 0,55 → 0 sull'altezza (${TE.altezza} u) e 6 scanline che salgono a ${TE.scanlineVel} u/s
        float a = ${TE.alfa.toFixed(3)} * pow( 1.0 - vV, 1.35 );
        float passo = ${(TE.altezza / TE.scanline).toFixed(4)};
        float s = fract( ( vY - uTempo * ${TE.scanlineVel.toFixed(3)} ) / passo );
        float scan = smoothstep( 0.0, 0.06, s ) * ( 1.0 - smoothstep( 0.06, 0.2, s ) ) * ( 1.0 - vV );
        float piede = exp( - vY * 40.0 );
        // A e B: oro pieno ×1,8. C (in trattativa): contorno pulsante 0,8–1,8 a 1,2 Hz, poi firmato con un lampo ×2
        float pulsa = mix( ${TE.pulsa[0].toFixed(2)}, ${TE.pulsa[1].toFixed(2)}, uPulsa );
        float kC = mix( 0.35, 1.0, uFirma );
        float em = mix( ${TE.firmato.toFixed(2)}, mix( pulsa, ${TE.firmato.toFixed(2)} * uLampoFirma, uFirma ), vC );
        float corpo = mix( 1.0, kC, vC );
        float intens = ( a * corpo + scan * 0.55 + piede * 0.6 ) * em * smoothstep( 0.0, 0.25, uAltezza );
        gl_FragColor = vec4( uOro * intens, 1.0 );
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false; mesh.userData.noAO = true; mesh.name = 'tende';
  return { mesh, u };
}

// ---------------------------------------------------------------- polvere (Points, §4.3)
function creaPolvere(ctx, SG) {
  const PO = PIANURA.polvere, n = PO.punti, rnd = mulberry32(4242);
  const pos = new Float32Array(n * 3), seme = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { seme[i * 3] = rnd() * Math.PI * 2; seme[i * 3 + 1] = rnd(); seme[i * 3 + 2] = rnd(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeme', new THREE.BufferAttribute(seme, 3));
  const u = {
    uP: { value: 0 }, uPx: ctx.U.uPx, uR0: { value: SG.diametro / 2 }, uCentro: { value: new THREE.Vector3(SITO_C[0], SG.quota, SITO_C[2]) },
    uCol: { value: hdr(PALETTE.oroChiaro, 0.9) },
  };
  const mat = nuovoMateriale(THREE.ShaderMaterial, {
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aSeme; uniform float uP, uPx, uR0; uniform vec3 uCentro; varying float vA;
      void main(){
        float r = uR0 - 1.2 + uP * ${PO.raggio.toFixed(2)} * ( 0.35 + 0.65 * aSeme.y );
        vec3 p = uCentro + vec3( sin( aSeme.x ) * r, 0.12 + uP * ( 0.4 + 1.4 * aSeme.z ), - cos( aSeme.x ) * r );
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * ( 1.6 + 3.0 * aSeme.z ) * ( 1.0 + uP ) * clamp( 120.0 / - mv.z, 0.6, 3.0 );
        vA = ${PO.alfa.toFixed(2)} * ( 1.0 - uP ) * ( 0.5 + 0.5 * aSeme.y );
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      void main(){
        float d = length( gl_PointCoord - 0.5 ); if ( d > 0.5 ) discard;
        float a = vA * ( 1.0 - smoothstep( 0.05, 0.5, d ) );
        gl_FragColor = vec4( uCol * a, 1.0 );
      }`,
  });
  const punti = new THREE.Points(geo, mat);
  punti.visible = false; punti.frustumCulled = false; punti.userData.noAO = true; punti.renderOrder = 8; punti.name = 'polvere';
  return { punti, u };
}

// ---------------------------------------------------------------- ogni fotogramma (funzioni pure di T e STATO)
const T_MATURITA_100 = TRACCE.maturita?.at(-1)?.[1] ?? 7.10;   // la maturità arriva a 100 % (§4.3)
const bump = (T, T0, durata) => (T >= T0 && T < T0 + durata) ? 1 - (T - T0) / durata : 0;

export function aggiorna(ctx, T, t /*, dt */) {
  if (!st) return;
  const S = ctx.STATO, riduci = !!ctx.flags?.riduci;
  const res = ctx.U.uRisoluzione.value, px = ctx.U.uPx.value;

  // ---- uniform private (terreno + tende)
  st.U.uTempoR.value = riduci ? 0 : t;
  st.U.uPulsa.value = riduci ? 0.5 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * OVERLAY.tende.hz);
  st.U.uLampoFirma.value = 1 + Math.sin(Math.PI * clamp(S.uTrattativaFirmata, 0, 1));
  const L = st.U.uLampo.value;
  for (let k = 0; k < 5; k++) L[k] = 1 + (PIANURA.fogliGIS.lampo - 1) * bump(T, st.impattoFoglio[k], PIANURA.fogliGIS.durataLampo);
  if (S.uHover) st.U.uHoverPos.value.set(st.hover.x, st.hover.z); else st.U.uHoverPos.value.set(1e5, 1e5);
  // stato delle particelle di C per il cursore (firmate a T 4,00)
  const firmate = S.uTrattativaFirmata >= 0.5;
  for (const p of st.particelleC) p.info.stato = firmate ? 'firmato' : 'trattativa';

  // ---- fogli GIS
  for (let k = 0; k < 5; k++) {
    const f = S.fogliGIS[k], m = st.fogli[k];
    m.visible = f.o > 0.002; m.position.y = f.y; m.material.opacity = f.o;
  }

  // ---- lunetta: tacche accese con la maturità, in senso orario da nord; lampo ×4 a 100 %
  const lu = st.lunetta, nT = OVERLAY.lunetta.tacche;
  lu.visible = S.lunetta > 0.002;
  if (lu.visible) {
    lu.material.opacity = S.lunetta;
    const accese = clamp(S.maturita / 100, 0, 1) * nT, lampo = 1 + 3 * bump(T, T_MATURITA_100, 0.02);   // lampo ×4 per 0,02 T a 100 %
    if (Math.abs(accese - st.accesePrima) > 1e-4 || lampo !== st.lampoPrima) {
      const c = st.coloreTacca;
      for (let i = 0; i < nT; i++) {
        const k = clamp(accese - i, 0, 1);
        c.tmp.copy(c.spenta).lerp(c.accesa, k).multiplyScalar(k > 0 ? lampo : 1); lu.setColorAt(i, c.tmp);
      }
      lu.instanceColor.needsUpdate = true; st.accesePrima = accese; st.lampoPrima = lampo;
    }
  }

  // ---- tende di luce
  st.tende.mesh.visible = S.tende > 0.002;
  st.tende.u.uAltezza.value = S.tende;

  // ---- percorso del sopralluogo
  const pe = st.percorso, vivoP = S.percorso > 0 && S.percorsoAlfa > 0.002;
  pe.linee.visible = vivoP; st.puntaPerc.visible = vivoP && S.percorso < 1; st.alonePerc.visible = st.puntaPerc.visible;
  st.puntoSuPercorso(S.percorso, _punta);
  if (vivoP) {
    pe.u.uAvanza.value = S.percorso; pe.u.uIntensita.value = S.percorsoAlfa;
    pe.mat.resolution.copy(res); pe.mat.linewidth = pe.px * px;
    st.puntaPerc.position.copy(_punta); st.alonePerc.position.copy(_punta); st.alonePerc.position.y += 0.02;
    const pul = riduci ? 1 : 1 + 0.25 * Math.sin(t * 6);
    st.alonePerc.scale.setScalar(pul); st.puntaPerc.material.opacity = S.percorsoAlfa; st.alonePerc.material.opacity = 0.5 * S.percorsoAlfa;
  }

  // ---- layout: proposto (tratteggiato, oro chiaro) → approvato (continuo, oro), poi "doppio" tenue
  const la = st.layout, [a0, a1] = st.tLay;
  la.linee.visible = S.uLayout > 0;
  if (la.linee.visible) {
    const continua = T < a1 ? clamp(S.uLayoutApprovato, 0, 1) : 1;
    const intens = T < a0 ? 1 : (T < a1 ? 1 : clamp(S.uLayoutApprovato, 0, 1));
    la.u.uAvanza.value = S.uLayout; la.u.uContinua.value = continua; la.u.uIntensita.value = intens;
    la.u.uPunta.value = S.uLayout < 1 ? OVERLAY.layoutProposto.punta : 0;
    la.mat.resolution.copy(res); la.mat.linewidth = la.px * px;
    la.linee.visible = intens > 0.002;
  }

  // ---- sigillo: cade da y 3,0 a 0,02 sopra 1,2 con scala 1,15 → 1, poi si dissolve all'alba
  const SG = PIANURA.sigillo, sg = st.sigillo;
  sg.visible = S.sigillo > 0 && S.sigilloAlfa > 0.002;
  if (sg.visible) {
    const k = clamp(S.sigillo, 0, 1);
    sg.position.y = SG.quota + SG.ySopra + (SG.yDa - SG.quota - SG.ySopra) * (1 - k);
    sg.scale.setScalar(SG.scalaDa + (1 - SG.scalaDa) * k);
    sg.material.opacity = S.sigilloAlfa * clamp(k * 4, 0, 1);
  }

  // ---- polvere
  const po = st.polvere;
  po.punti.visible = S.polvere > 0 && S.polvere < 0.999;
  po.u.uP.value = S.polvere;
}
