// =============================================================================
// ERI v2 · idro/valle-segni.js — segni a inchiostro della VALLE: righello, parentesi dei salti, linea di sezione,
// livelli dell'acqua, condotte; testi su CanvasTexture. File privato di idro/valle.js.
// Proprietario: [VALLE].
// Specifica: DESIGN §3.6 (righello 0–900 m, tacche ogni 50/100 m, parentesi dei salti), §4.5 (righello, parentesi
// sfalsate, condottaEmissione), §2.7 (quote tecniche: linee in px CSS × uPx), config.VALLE.righello / parentesi.
//
// Tema chiaro: tutto INCHIOSTRO (NormalBlending, copertura = opacità, colori di palette), mai luce sommata.
// Le linee stanno sul piano di taglio, davanti a tutto: depthTest spento (sono un disegno sulla sezione).
// I testi hanno grandezza costante in px CSS (sprite senza attenuazione, scala ricalcolata col fov).
// =============================================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { VALLE, PALETTE, OVERLAY } from '../config.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import { cop } from './valle-materiali.js';
import { B, EDIFICI, puntiProfilo, hValle, RAGGIO_PELTON, RAGGIO_FRANCIS } from './valle-forme.js';

const RG = VALLE.righello, Z_SEGNI = 0.004;
// TARATURA: proporre in config (VALLE.righello, VALLE.segni)
export const SEGNI = {
  profilo: { px: 1.3, copertura: 0.85 },        // linea di sezione (bordo del taglio)
  acqua: { px: 1.0, copertura: 0.75 },          // livello del pelo libero sul taglio
  contorno: { px: 1.0, copertura: 0.5 },        // bordo superiore del blocco (retro e fianchi)
  condotta: { px: 1.2 },                        // copertura = STATO.condottaEmissione
  righello: { px: 1.2, tacchePx: 1.0, copertura: 0.9, scalaTacche: 4 },   // tacche di config × 4: a 1 600 u sarebbero di 1 px
  parentesi: { px: 1.2, copertura: 0.9, grazia: 2.4 },                   // grazie orizzontali (u)
  testo: { righelloPx: 9.5, parentesiPx: 11, scarto: 7, alfaNumeri: 0.85 },
};

// ---------------------------------------------------------------- linee
function materialeLinea(lista, colore, copertura, px, opz = {}) {
  const par = { color: new THREE.Color(colore), linewidth: px, worldUnits: false, transparent: true, opacity: copertura,
                depthWrite: false, depthTest: opz.depthTest ?? false, blending: THREE.NormalBlending, fog: false };
  if (opz.tratto) Object.assign(par, { dashed: true, dashSize: opz.tratto[0], gapSize: opz.tratto[1], dashScale: 1 });
  // davanti alla superficie complanare e alle gobbe vicine (≈ 1,5 u a 1 600 u, pochi cm da vicino): muri e pendii la coprono
  if (opz.avanti) Object.assign(par, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -200 });
  const m = nuovoMateriale(LineMaterial, par);
  lista.push({ m, px, cop: copertura });
  return m;
}
function linee(pos, mat, nome, ordine = 6) {
  const g = new LineSegmentsGeometry(); g.setPositions(new Float32Array(pos));
  const l = new LineSegments2(g, mat); l.name = nome; l.renderOrder = ordine; l.userData.noAO = true;
  if (mat.dashed) l.computeLineDistances();
  return l;
}
/** Polilinea → coppie di segmenti (x, y, z). */
function coppie(pts, z = Z_SEGNI) {
  const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(pts[i][0], pts[i][1], z, pts[i + 1][0], pts[i + 1][1], z);
  return out;
}

// ---------------------------------------------------------------- testi
/** Sprite di testo (Plex Mono) a grandezza costante in px CSS. ancora: 'sinistra' | 'destra' rispetto al punto. */
function testo(stringa, { px, colore, peso = 400, ancora = 'sinistra', scartoPx = 0 }) {
  const S = 4, font = `${peso} ${px * S}px "IBM Plex Mono", ui-monospace, monospace`;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font; const w = Math.ceil(g.measureText(stringa).width + 2 * S), h = Math.ceil(px * S * 1.5);
  c.width = w; c.height = h;
  g.font = font; g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(stringa, S, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.name = 'valle.testo';
  const m = nuovoMateriale(THREE.SpriteMaterial, { map: t, color: new THREE.Color(colore), transparent: true, depthTest: false,
                                                   depthWrite: false, fog: false, sizeAttenuation: false });
  const s = new THREE.Sprite(m); s.renderOrder = 7; s.userData.noAO = true;
  const wPx = w / S, hPx = h / S, dx = scartoPx / wPx;
  s.center.set(ancora === 'destra' ? 1 + dx : -dx, 0.5);
  s.userData.px = [wPx, hPx];
  return s;
}

// ---------------------------------------------------------------- righello 0–900 m (x = −236)
function righello(lista, gruppo) {
  const R = SEGNI.righello, x = RG.x, col = PALETTE.oroLinea;
  const asta = linee([x, 0, 0, x, 1, 0], materialeLinea(lista, col, R.copertura, R.px), 'valle.righello');
  asta.position.y = RG.y0;
  const tacche = [], quote = [];
  for (let y = RG.y0; y <= RG.y1 + 1e-6; y += RG.passo) {
    const lunga = Math.abs(((y - RG.y0) / RG.passoLungo) - Math.round((y - RG.y0) / RG.passoLungo)) < 1e-6;
    const l = (lunga ? RG.taccaLunga : RG.tacca) * R.scalaTacche;
    tacche.push(x - l, y, 0, x, y, 0);
    if (lunga) quote.push(y);
  }
  const lt = linee(tacche, materialeLinea(lista, col, R.copertura, R.tacchePx), 'valle.righello.tacche');
  const numeri = quote.map(y => {
    const m = Math.round((y - RG.y0) * 10), T = SEGNI.testo;
    const s = testo(y === RG.y1 ? `${m} m` : `${m}`, { px: T.righelloPx, colore: PALETTE.oro, ancora: 'destra', scartoPx: 4 });
    s.position.set(x - RG.taccaLunga * R.scalaTacche, y, 0); s.userData.y = y;
    return s;
  });
  gruppo.add(asta, lt, ...numeri);
  return { asta, tacche: lt, numeri, nTacche: tacche.length / 6 };
}

// ---------------------------------------------------------------- parentesi dei salti
function parentesi(lista, gruppo) {
  const P = SEGNI.parentesi, T = SEGNI.testo;
  return VALLE.parentesi.map((p, i) => {
    const h = (p.y1 - p.y0) / 2, g = P.grazia;
    const m = materialeLinea(lista, PALETTE.oroLinea, P.copertura, P.px);
    // asta e grazie in coordinate locali centrate a metà salto: la scala in y la fa crescere dal centro
    const l = linee([0, -h, 0, 0, h, 0, -g / 2, -h, 0, g / 2, -h, 0, -g / 2, h, 0, g / 2, h, 0], m, `valle.parentesi.${p.nome}`);
    l.position.set(p.x, (p.y0 + p.y1) / 2, Z_SEGNI);
    const s = testo(p.testo, { px: T.parentesiPx, colore: PALETTE.oro, peso: 500, ancora: 'destra', scartoPx: T.scarto });
    s.position.set(p.x - g / 2, (p.y0 + p.y1) / 2, Z_SEGNI);
    gruppo.add(l, s);
    return { linea: l, mat: m, testo: s, i };
  });
}

// ---------------------------------------------------------------- linea di sezione, acqua, condotte
function lineaSezione() {
  const xa = EDIFICI.pelton.x[0], xb = EDIFICI.pelton.x[1];
  // la linea si interrompe sotto la centrale Pelton (lì il bordo del taglio è il suo pavimento, già disegnato)
  const prof = puntiProfilo(), sx = prof.filter(p => p[0] < xa - 1e-6), dx = prof.filter(p => p[0] >= xb - 1e-6);
  sx.push(prof.find(p => Math.abs(p[0] - xa) < 1e-6));
  // fianchi del blocco: dal basamento al profilo
  return [...coppie([[B.x0, B.base], ...sx]), ...coppie([...dx, [B.x1, B.base]])];
}
/**
 * Contorno del blocco: bordo superiore del retro e dei fianchi, esattamente sullo spigolo (vince sulla superficie
 * complanare con il polygonOffset del materiale; muri e montagne davanti la coprono). Il bianco del plastico non si
 * perde nel fondale chiaro.
 */
function lineaContorno() {
  const out = [], e = 0;
  for (let x = B.x0; x < B.x1 - 1e-6; x += 1) out.push(x, hValle(x, B.z0), B.z0 - e, x + 1, hValle(x + 1, B.z0), B.z0 - e);
  for (const x of [B.x0, B.x1]) for (let z = B.z0; z < B.z1 - 1e-6; z += 0.5) {
    const s = x < 0 ? -e : e; out.push(x + s, hValle(x, z), z, x + s, hValle(x, z + 0.5), z + 0.5);
  }
  return out;
}
/** Inchiostro della condotta sul taglio: lungo il colmo del tubo dove l'asse è sul piano z = 0. */
function lineaCondotta(curva, r, xMax) {
  const pts = [], N = Math.ceil(curva.getLength() * 4);
  for (let i = 0; i <= N; i++) {
    const p = curva.getPointAt(i / N); if (p.x > xMax) break;
    if (Math.abs(p.z) > 0.6 * r) continue;
    pts.push([p.x, p.y + r, Z_SEGNI]);
  }
  const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(...pts[i], ...pts[i + 1]);
  return out;
}

/**
 * Crea i segni. lineeAcqua: coppie [x0,y0,x1,y1…] dei peli liberi sul taglio. curve: { pelton, francis }.
 * Restituisce lo stato per aggiorna().
 */
export function creaSegni(ctx, lineeAcqua, curve) {
  const lista = [], gruppo = new THREE.Group(); gruppo.name = 'valle.segni';
  const S = SEGNI;
  const profilo = linee(lineaSezione(), materialeLinea(lista, PALETTE.oroLinea, S.profilo.copertura, S.profilo.px), 'valle.linea.sezione', 5);
  const acq = []; for (let i = 0; i < lineeAcqua.length; i += 4) acq.push(lineeAcqua[i], lineeAcqua[i + 1], Z_SEGNI, lineeAcqua[i + 2], lineeAcqua[i + 3], Z_SEGNI);
  const acqua = linee(acq, materialeLinea(lista, PALETTE.acqua, S.acqua.copertura, S.acqua.px), 'valle.linea.acqua', 5);
  const matC = materialeLinea(lista, PALETTE.oroLinea, 0.6, S.condotta.px);
  const condotte = [
    linee(lineaCondotta(curve.pelton, RAGGIO_PELTON, EDIFICI.pelton.x[0]), matC, 'valle.linea.condottaPelton', 5),
    linee(lineaCondotta(curve.francis, RAGGIO_FRANCIS, EDIFICI.francis.x[0]), matC, 'valle.linea.condottaFrancis', 5),
  ];
  const contorno = linee(lineaContorno(), materialeLinea(lista, PALETTE.oroLinea, S.contorno.copertura, S.contorno.px, { depthTest: true, avanti: true }),
                         'valle.linea.contorno', 4);
  gruppo.add(profilo, acqua, contorno, ...condotte);
  const rg = righello(lista, gruppo);
  const par = parentesi(lista, gruppo);
  const sprite = [...rg.numeri, ...par.map(p => p.testo)];
  return { gruppo, lista, matC, profilo, acqua, condotte, rg, par, sprite };
}
