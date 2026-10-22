// =============================================================================
// ERI v2 · impianti/tracker-celle.js — file PRIVATO del pacchetto FV (regola 0.1 di ARCHITETTURA.md)
// Usato solo da impianti/tracker.js: texture del fronte e del retro del modulo disegnate su canvas.
// Specifica: DESIGN §6.6 (canvas 2048×1024, 6 × 24 mezze celle con gradiente radiale leggero, fuga centrale di 10 mm,
// 16 busbar argentati sottili, ombra del telaio di 2 px, retro con le celle viste da dietro e i busbar), §2.6,
// config.MATERIALI.celle e config.MATERIALI.moduli (colori dello stile: cella, fuga, busbar, retro, telaio).
// Orientamento: u lungo il lato lungo del modulo (x, 2 384 mm), v lungo il lato corto (z, 1 134 mm), come le UV
// delle facce ±y di BoxGeometry.
// =============================================================================
import * as THREE from 'three';
import { MATERIALI, LAYOUT } from '../config.js';

const CEL = MATERIALI.celle, MOD = LAYOUT.modulo;
// TARATURA: proporre in config (MATERIALI.celle) — misure del disegno in mm
export const TELAIO_MM = 12;            // labbro del telaio d'alluminio visto sul fronte (il telaio è alto 35 mm)
const MARGINE_MM = 8;                   // vetro libero fra il telaio e le celle
const GAP_MM = 2;                       // fuga fra le mezze celle
const SMUSSO_MM = 9;                    // smusso delle celle pseudo-quadrate (solo sul lato del bordo originale)
const SCATOLE = { n: 3, mm: [62, 105], passoMm: 300, colore: '#2a2f33' };   // scatole di giunzione sul retro, al centro

/** Frazione di UV coperta dal telaio sui due assi (per lo shader). */
export const TELAIO_UV = [TELAIO_MM / (MOD.lunghezzaM * 1000), TELAIO_MM / (MOD.larghezzaM * 1000)];

const _a = new THREE.Color(), _b = new THREE.Color();
const mescola = (a, b, k) => '#' + _a.set(a).lerp(_b.set(b), k).getHexString();

/**
 * Disegna una faccia del modulo con i colori dello stile.
 * @param {object} st stile (config.MATERIALI.moduli.vetro | blu | plastico)
 * @param {boolean} retro false = fronte (2048×1024), true = retro bifacciale (1024×512)
 * @param {number} anisotropia
 * @returns {THREE.CanvasTexture}
 */
export function texturaModulo(st, retro, anisotropia = 1) {
  const W = retro ? CEL.lato[0] / 2 : CEL.lato[0], H = retro ? CEL.lato[1] / 2 : CEL.lato[1];
  const Lmm = MOD.lunghezzaM * 1000, Hmm = MOD.larghezzaM * 1000, kx = W / Lmm, ky = H / Hmm;
  const tela = document.createElement('canvas'); tela.width = W; tela.height = H;
  const g = tela.getContext('2d');
  const cella = retro ? st.retro : st.cella;
  // fughe: vetro libero sul fondo (dal retro di un vetro-vetro passa la luce: più chiaro)
  g.fillStyle = retro ? mescola(st.fuga, st.retro, 0.35) : st.fuga;
  g.fillRect(0, 0, W, H);

  // 6 righe (lato corto) × 24 colonne (lato lungo), fuga centrale fra le due metà
  const [R, C] = CEL.griglia, x0 = TELAIO_MM + MARGINE_MM, y0 = x0;
  const cw = (Lmm - 2 * x0 - CEL.fugaMm - (C - 2) * GAP_MM) / C;
  const ch = (Hmm - 2 * y0 - (R - 1) * GAP_MM) / R;
  const xCella = c => x0 + c * (cw + GAP_MM) + (c >= C / 2 ? CEL.fugaMm - GAP_MM : 0);
  const chiara = mescola(cella, '#ffffff', retro ? 0.05 : 0.09);
  const sx = SMUSSO_MM * kx, sy = SMUSSO_MM * ky;
  for (let c = 0; c < C; c++) {
    const X = xCella(c) * kx, w = cw * kx, sin = c % 2 === 0;   // mezze celle a coppie: smussi verso l'esterno della coppia
    for (let r = 0; r < R; r++) {
      const Y = (y0 + r * (ch + GAP_MM)) * ky, h = ch * ky;
      g.beginPath();
      if (sin) { g.moveTo(X + sx, Y); g.lineTo(X + w, Y); g.lineTo(X + w, Y + h); g.lineTo(X + sx, Y + h); g.lineTo(X, Y + h - sy); g.lineTo(X, Y + sy); }
      else { g.moveTo(X, Y); g.lineTo(X + w - sx, Y); g.lineTo(X + w, Y + sy); g.lineTo(X + w, Y + h - sy); g.lineTo(X + w - sx, Y + h); g.lineTo(X, Y + h); }
      g.closePath();
      const gr = g.createRadialGradient(X + w / 2, Y + h / 2, 0, X + w / 2, Y + h / 2, Math.hypot(w, h) * 0.6);
      gr.addColorStop(0, chiara); gr.addColorStop(1, cella);
      g.fillStyle = gr; g.fill();
    }
  }

  // busbar: 16 per riga di celle, lungo il lato lungo, uno per metà del modulo
  g.strokeStyle = st.busbar; g.globalAlpha = retro ? 0.45 : 0.38; g.lineWidth = retro ? 0.75 : 1;
  const meta = [[xCella(0), xCella(C / 2 - 1) + cw], [xCella(C / 2), xCella(C - 1) + cw]];
  for (let r = 0; r < R; r++) for (let b = 0; b < CEL.busbar; b++) {
    const y = Math.round((y0 + r * (ch + GAP_MM) + ch * (b + 0.5) / CEL.busbar) * ky) + 0.5;
    for (const [a, z] of meta) { g.beginPath(); g.moveTo(a * kx, y); g.lineTo(z * kx, y); g.stroke(); }
  }
  g.globalAlpha = 1;

  // retro: tre scatole di giunzione nella fuga centrale (si vedono da sotto, nel vicolo dell'agrivoltaico)
  if (retro) {
    g.fillStyle = SCATOLE.colore;
    const [bw, bh] = SCATOLE.mm;
    for (let i = 0; i < SCATOLE.n; i++) {
      const yc = Hmm / 2 + (i - (SCATOLE.n - 1) / 2) * SCATOLE.passoMm;
      g.fillRect((Lmm / 2 - bw / 2) * kx, (yc - bh / 2) * ky, bw * kx, bh * ky);
    }
  }

  // telaio, ombra del telaio di 2 px sul vetro, filo di luce sullo spigolo esterno
  const tx = TELAIO_MM * kx, ty = TELAIO_MM * ky;
  g.fillStyle = st.telaio;
  g.fillRect(0, 0, W, ty); g.fillRect(0, H - ty, W, ty); g.fillRect(0, 0, tx, H); g.fillRect(W - tx, 0, tx, H);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  g.strokeRect(tx + 1, ty + 1, W - 2 * tx - 2, H - 2 * ty - 2);
  g.strokeStyle = mescola(st.telaio, '#ffffff', 0.35); g.lineWidth = 1.5;
  g.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);

  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anisotropia;
  tex.name = retro ? 'tracker.retro' : 'tracker.celle';
  return tex;
}
