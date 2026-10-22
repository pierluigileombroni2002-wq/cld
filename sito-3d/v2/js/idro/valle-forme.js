// =============================================================================
// ERI v2 · idro/valle-forme.js — forme pure della VALLE (file privato di idro/valle.js: niente three, niente ctx)
// Proprietario: [VALLE]. Si importa SOLO dai moduli idro/valle*.js.
// Specifica: DESIGN §3.6 (profilo, peli liberi, tabella degli elementi), config.VALLE, geo.fondoValle / hValle.
//
// Qui stanno le misure che config non fissa (spessori, quote dei pavimenti, raccordi): costanti marcate TARATURA.
// Le centrali sono pensate come architettura minimale da plastico: scatole bianche nette, solai sottili, lesene
// ritmate attorno all'asse della macchina, luci lineari a filo soffitto. Lo spazio delle macchine (centri e raggi di
// config.VALLE.girante*) resta libero: i pavimenti hanno i fori per pozzo, tubo di aspirazione e semi-chiocciola.
// =============================================================================
import { VALLE } from '../config.js';
import { fondoValle, hValle } from '../geo.js';

export const B = VALLE.blocco;
const CP = VALLE.centralePelton, CF = VALLE.centraleFrancis, TK = VALLE.traversaKaplan, FK = VALLE.taglio.fori.kaplan;
const GP = VALLE.girantePelton.centro, GF = VALLE.giranteFrancis.centro, GK = VALLE.giranteKaplan.centro;
const PE = VALLE.peli;

// TARATURA: proporre in config (VALLE.edifici) — architettura delle centrali, della presa, della diga e della traversa
export const EDIFICI = {
  muro: 0.12,                                   // spessore delle pareti (1,2 m)
  gronda: 0.15,                                 // sbalzo laterale dei tetti
  lesena: { larghezza: 0.10, sporgenza: 0.05, passo: 1.5 },   // lesene interne, simmetriche attorno all'asse macchina
  pelton: {
    x: CP.x, z: CP.z, base: 17.30, pavimento: 17.80,          // pavimento appena sotto il generatore (Ø 3,5 m, asse 18,0)
    soffitto: 19.42, tetto: CP.y[1], piazzale: CP.y[0], muroEstBase: 15.9,
    canale: { x0: GP[0] - 0.3, z0: -0.75, fondo: 17.44, acqua: 17.52 },   // pozzo sotto la ruota + canale di scarico verso il serbatoio
  },
  francis: {
    x: CF.x, z: CF.z, base: 0.08, interrato: CF.y[0], terra: [0.92, VALLE.taglio.fori.francis.y[1] + 0.05], soffitto: 3.32, tetto: 3.46,
    foro: { c: [GF[0], GF[2]], r: 0.17 },                     // passaggio del tubo di aspirazione
    argine: { z: [-12, CF.z[0]], y: [0.9, 1.85] },            // muro d'argine: il fiume (1,7) è più alto del piazzale (1,0)
  },
  kaplan: {
    x: FK.x, z: [TK.centraleZ[0], 0.5], base: -1.92, interrato: FK.y[0], terra: [FK.y[1] - 0.02, fondoValle(112)],
    medio: [0.62, 0.74], soffitto: 2.10, tetto: 2.26,
    foro: { c: [GK[0], GK[2]], r: 1.25 },                     // semi-chiocciola (raggio esterno 12 m)
    foroMedio: 0.55,                                          // albero e generatore
  },
  traversa: { z: [-21, TK.centraleZ[0] + 0.05], monte: 110.95, cresta: PE.fiumePool[1], fondo: -1.0 },
  presa: {
    camera: { x: [-176.25, -175.75], y: [85.9, 87.5], z: -0.5 },  // camera paratoie sotto la soglia (vista nel foro della sezione)
    pozzo: { x: [-176.1, -175.9], y1: 88.4 },
    casa: { x: [-176.5, -175.5], y: [88.4, 89.35], z: [-1.0, 0.5] },   // casa di manovra sulla soglia (allineata alla griglia)
    parete: 0.08,
  },
  diga: { R: VALLE.diga.raggioArco, x0: VALLE.diga.x[0], zArco: VALLE.diga.z[1], raccordo: 8, z: [0.5, B.z0], fondo: -1.0,
          scarpa: 0.25, sbalzo: 0.1, cordolo: 0.12 },        // oltre l'arco (|z| > 18) la diga prosegue in un'ala a gravità
  ancoraggi: { passo: VALLE.condottaPelton.ancoraggiOgni, lungo: 0.32, sopra: 0.05, z: 0.16 },
};
const E = EDIFICI;

// ---------------------------------------------------------------- profilo della sezione (z = 0)
/** Quota del bordo superiore della faccia di taglio: fondoValle, ma sotto la centrale Pelton (scavata nel pendio) il piazzale. */
export function profilo(x) {
  const P = E.pelton;
  if (x >= P.x[0] && x <= P.x[1]) return Math.min(fondoValle(x), P.piazzale);
  return fondoValle(x);
}
/** Punti [x, y] del profilo da x0 a x1 (passo di config), con il gradino verticale al muro ovest della Pelton. */
export function puntiProfilo(x0 = B.x0, x1 = B.x1) {
  const passo = VALLE.taglio.passoContorno, out = [];
  const n = Math.round((x1 - x0) / passo);
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * passo;
    if (Math.abs(x - E.pelton.x[0]) < 1e-6) out.push([x, fondoValle(x)], [x, E.pelton.piazzale]);
    else out.push([x, profilo(x)]);
  }
  return out;
}

// ---------------------------------------------------------------- diga ad arco con ala a gravità
const D = E.diga, COR = VALLE.diga.coronamento, FON = VALLE.diga.fondazione;
const T_COR = VALLE.diga.spessoreCoronamentoM / 10, T_BASE = VALLE.diga.spessoreBaseM / 10;
/** Asse della diga (paramento di monte al piede) come x(z) e pendenza dx/dz: arco R = 30 per |z| ≤ 18, poi raccordo e ala. */
export function digaAsse(z) {
  const { R, x0, zArco, raccordo: L } = D;
  if (z >= -zArco) { const s = Math.sqrt(R * R - z * z); return { x: x0 + R - s, d: z / s }; }
  const sA = Math.sqrt(R * R - zArco * zArco), xA = x0 + R - sA, k = zArco / sA;
  const s = -zArco - z;
  if (s <= L) return { x: xA + k * s - k * s * s / (2 * L), d: -(k - k * s / L) };
  return { x: xA + k * L / 2, d: 0 };
}
/** Paramento di monte (u dall'asse verso valle) alla quota y: lieve scarpa. */
export const digaMonte = y => (y <= FON ? 0 : D.scarpa * (y - FON) / (COR - FON));
/** Paramento di valle: curvo, da 25 m al piede a 4 m al coronamento. */
export const digaValle = y => (y <= FON ? T_BASE : D.scarpa + T_COR + (T_BASE - D.scarpa - T_COR) * Math.pow((COR - y) / (COR - FON), 1.5));
/** Profilo chiuso della diga in (u, y), in gruppi lisci separati da spigoli vivi. */
export function profiloDiga() {
  const yb = D.fondo, yc = COR, s = D.sbalzo, c = D.cordolo, ys = yc - c;
  const valle = []; for (let i = 0; i <= 24; i++) { const y = FON + (ys - FON) * i / 24; valle.push([digaValle(y), y]); }
  const monte = []; for (let i = 0; i <= 8; i++) { const y = ys - (ys - FON) * i / 8; monte.push([digaMonte(y), y]); }
  const uMc = digaMonte(ys), uVc = digaValle(ys);
  return [
    [[0, yb], [T_BASE, yb]],                          // fondo
    [[T_BASE, yb], [T_BASE, FON]],                    // piede di valle
    valle,                                            // paramento di valle (liscio)
    [[uVc, ys], [uVc + s, ys]],                       // sbalzo del coronamento verso valle
    [[uVc + s, ys], [uVc + s, yc]],
    [[uVc + s, yc], [uMc - s, yc]],                   // piano del coronamento
    [[uMc - s, yc], [uMc - s, ys]],
    [[uMc - s, ys], [uMc, ys]],
    monte,                                            // paramento di monte (liscio)
    [[0, FON], [0, yb]],
  ];
}
/** Punto (x, z) del paramento a offset u dall'asse alla sezione z (normale all'asse, verso valle). */
export function digaPunto(z, u) {
  const a = digaAsse(z), l = Math.hypot(1, a.d);
  return [a.x + u / l, z - u * a.d / l];
}
/** La quota (x, y, z) è dentro la diga? (due passi di proiezione sull'asse: basta per i buchi del terreno) */
export function dentroDiga(x, y, z) {
  if (y < D.fondo || y > COR || z > D.z[0] || z < D.z[1]) return false;
  let zz = z, u = 0;
  for (let i = 0; i < 3; i++) { const a = digaAsse(zz), l = Math.hypot(1, a.d); u = (x - a.x) * l; zz = z + u * a.d / l; }
  return u > digaMonte(y) && u < digaValle(y);
}

// ---------------------------------------------------------------- traversa a profilo "S" (Kaplan)
/** Profilo chiuso della traversa in (x, y): paramento di monte verticale, cresta tonda, scivolo a S, platea. */
export function profiloTraversa() {
  const T = E.traversa, xm = T.monte, yc = T.cresta, yf = T.fondo, yp = fondoValle(VALLE.traversaKaplan.x);
  const p = [[xm, yf], [xm, yc - 0.12]];
  // cresta: quarto di ellisse
  for (let i = 1; i <= 6; i++) { const a = Math.PI * (1 - i / 12); p.push([xm + 0.18 + 0.18 * Math.cos(a), yc - 0.12 + 0.12 * Math.sin(a)]); }
  // scivolo: curva convessa poi concava (la "S") fino alla platea, appena sopra il letto
  const x0 = xm + 0.18, x1 = xm + 2.4, ya = yp + 0.03, h = yc - ya;
  for (let i = 1; i <= 20; i++) { const t = i / 20, s = t * t * (3 - 2 * t); p.push([x0 + (x1 - x0) * t, yc - h * s]); }
  p.push([x1 + 1.2, ya], [x1 + 1.2, yf]);
  return p;
}

// ---------------------------------------------------------------- acque (peli liberi, §3.6)
const FM = PE.fiumeMonte, FP = PE.fiumePool, VA = PE.valle;
/** Quota del pelo libero del fiume a monte della traversa (da 1,7 a x = −29 a 1,2 a x = 106). */
export const livelloFiume = x => FM[1] + (FP[1] - FM[1]) * Math.min(1, Math.max(0, (x - FM[0]) / (FP[0] - FM[0])));
/** A valle della traversa: da 0,0 a −0,1 sulla pianura. */
export const livelloValle = x => VA[0] + (VA[1] - VA[0]) * Math.min(1, Math.max(0, (x - E.kaplan.x[1]) / (B.x1 - E.kaplan.x[1])));
/** x dove il fondo del lago alto risale al pelo libero (soglia rocciosa). */
export function xSogliaLago() {
  let a = -179, b = -176;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (fondoValle(m) < PE.lagoAlto) a = m; else b = m; }
  return (a + b) / 2;
}
const XL = xSogliaLago();
/**
 * Pelo libero che copre il punto (x, z) del plastico, o null se il punto è all'asciutto (usato per tingere il fondo
 * sommerso: nei plastici veri il letto dei laghi è dipinto e la resina trasparente sta sopra).
 */
export function livelloAcqua(x, z) {
  const KZ = E.kaplan.z[0], T = E.traversa;
  if (x <= XL) return PE.lagoAlto;
  if (x >= E.pelton.x[1] - 1e-6 && x <= -30) {
    const a = digaAsse(z); if (x <= a.x + digaMonte(PE.serbatoio) / Math.hypot(1, a.d)) return PE.serbatoio;
  }
  if (x >= FM[0] && x <= (z >= KZ ? E.kaplan.x[0] : T.monte)) return livelloFiume(x);
  if (x >= (z >= KZ ? E.kaplan.x[1] : T.monte + 3.6)) return livelloValle(x);
  return null;
}

// ---------------------------------------------------------------- condotte forzate
const CPL = VALLE.condottaPelton, CFR = VALLE.condottaFrancis;
/** Asse della condotta Pelton: imbocco nel lago, camera paratoie, galleria, poi sul pendio (fondoValle + 0,06), sala. */
export function puntiCondottaPelton() {
  const pts = [[-177.70, 86.90, 0], [-176.40, 86.90, 0], [-176.00, 86.86, 0], [-175.60, 86.35, 0],
               [CPL.da[0] + 0.3, 86.06, 0], [-174.50, 86.00, 0], [-173.60, 85.99, 0]];
  for (let x = -173.0; x <= -98.45; x += 0.5) pts.push([x, fondoValle(x) + CPL.sopraFondo, 0]);
  pts.push([-97.6, CPL.a[1], 0], [-96.6, CPL.a[1] - 0.05, -0.05], [-95.5, 18.36, -0.2], [-94.4, 18.07, -0.35], [...CPL.fine]);
  return pts;
}
/** Asse della condotta Francis: presa sul paramento di monte, dentro la diga, giù lungo il paramento, nella sala. */
export function puntiCondottaFrancis() {
  const [x0, y0, z0] = CFR.da, [x1, y1, z1] = CFR.a;
  return {
    fuori: [[x0 - 0.1, y0, z0], [x0 + 1.4, y0 - 0.4, z0], [-40.6, 6.8, -0.08], [-39.9, 4.4, -0.3], [-39.2, 2.75, -0.55],
            [-38.4, 2.15, -0.75], [-37.6, 2.03, z1], [E.francis.x[0] + 0.06, y1 + 0.02, z1]],
    dentro: [[E.francis.x[0] + 0.06, y1 + 0.02, z1], [-36.0, y1 + 0.005, z1], [-35.2, y1, z1], [x1, y1, z1]],
  };
}
export const RAGGIO_PELTON = CPL.raggio;                 // 0,035 u (Ø 0,7 m)
export const RAGGIO_FRANCIS = CFR.diametroM / 20;        // 0,0775 u (Ø 1,55 m)

// ---------------------------------------------------------------- quote del terreno sotto gli elementi
/** Terreno dentro un'impronta da togliere (i muri ne coprono i bordi). Rettangoli allineati alla griglia + diga. */
export function dentroImpronta(x, y, z) {
  const r = (X, Z) => x >= X[0] - 1e-6 && x <= X[1] + 1e-6 && z >= Z[0] - 1e-6 && z <= Z[1] + 1e-6;
  if (r(E.pelton.x, [E.pelton.z[0], 0])) return true;
  if (r(E.francis.x, [E.francis.z[0], 0])) return true;
  if (r(E.kaplan.x, [E.kaplan.z[0], 0])) return true;
  if (r(E.presa.casa.x, [E.presa.casa.z[0], 0])) return true;
  if (z > -25 && dentroDiga(x, y, z)) return true;
  return false;
}
export { hValle, fondoValle };
