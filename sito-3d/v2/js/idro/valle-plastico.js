// =============================================================================
// ERI v2 · idro/valle-plastico.js — il blocco del plastico: superficie, faccia di taglio, fianchi, acque, appoggio
// Proprietario: [VALLE]. File privato di idro/valle.js.
// Specifica: DESIGN §3.6 (blocco, profilo, peli liberi, fori, sezioni d'acqua), §6.5 (plastico), config.VALLE.
//
//  - superficie: griglia x ogni 0,5 u (come il contorno della sezione: bordo e faccia coincidono) × z ogni 1 u
//    (0,5 u vicino al taglio, più i bordi delle impronte), quote hValle; tolte le celle sotto centrali, presa e diga.
//  - faccia di taglio (z = +0,001): ShapeGeometry del profilo con i fori Francis e Kaplan di config e il foro della
//    camera paratoie Pelton (camera, pozzo, imbocco e galleria della condotta).
//  - fianchi e retro chiudono il blocco (non si vedono dalle camere, ma fanno ombra e chiudono l'interno).
//  - acque: peli liberi (resina azzurra velata, inclinati dove il fiume scende) e sezioni d'acqua al 22 %.
// =============================================================================
import * as THREE from 'three';
import { VALLE } from '../config.js';
import { B, EDIFICI, puntiProfilo, profilo, digaPunto, digaMonte, xSogliaLago, livelloFiume, livelloValle, livelloAcqua,
         dentroImpronta, hValle, fondoValle, RAGGIO_PELTON } from './valle-forme.js';

const E = EDIFICI, PE = VALLE.peli, FO = VALLE.taglio.fori;
const Z_TAGLIO = 0.001, Z_ACQUA = 0.002;

/** Ascisse della griglia (passo del contorno) e ordinate (fitte vicino al taglio, con i bordi delle impronte). */
export function griglia() {
  const xs = [], passo = VALLE.taglio.passoContorno;
  for (let i = 0, n = Math.round((B.x1 - B.x0) / passo); i <= n; i++) xs.push(+(B.x0 + i * passo).toFixed(4));
  const zz = new Set();
  for (let z = B.z0; z <= -6; z += 1) zz.add(z);
  for (let z = -6; z <= B.z1 + 1e-9; z += 0.5) zz.add(+z.toFixed(4));
  [E.pelton.z[0], E.francis.z[0], E.kaplan.z[0], E.presa.casa.z[0]].forEach(z => zz.add(z));
  return { xs, zs: [...zz].sort((a, b) => a - b) };
}

// ---------------------------------------------------------------- superficie
export function geometriaSuperficie(G) {
  const { xs, zs } = G, nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), dentro = new Uint8Array(nx * nz), acqua = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], y = hValle(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    dentro[k] = dentroImpronta(x, y, z) ? 1 : 0;
    const L = livelloAcqua(x, z); acqua[k] = L == null ? -1 : L - y;        // profondità sotto il pelo libero (u)
  }
  const tutti = [], buchi = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    tutti.push(a, c, b, b, c, d);
    if (!(dentro[a] && dentro[b] && dentro[c] && dentro[d])) buchi.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAcqua', new THREE.BufferAttribute(acqua, 1));
  g.setIndex(tutti); g.computeVertexNormals();          // normali sulla griglia intera, poi i buchi
  g.setIndex(buchi);
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- faccia di taglio
/** Foro della camera paratoie Pelton: camera + pozzo + imbocco dal lago + galleria della condotta (fino a xE). */
function foroPresa(curva) {
  const P = E.presa, C = P.camera, Q = P.pozzo, r = RAGGIO_PELTON;
  // galleria: offset ±r dell'asse (nel piano di taglio) fra la parete destra della camera e xE (copertura ≥ 0,1 u)
  const cam = [], N = 400;
  for (let i = 0; i <= N; i++) { const p = curva.getPointAt(i / N * 0.06); cam.push(p); }
  const xE = -173.45, alto = [], basso = [];
  for (let i = 0; i < cam.length - 1; i++) {
    const p = cam[i], q = cam[i + 1];
    if (p.x < C.x[1] || p.x > xE) continue;
    const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    alto.push([p.x + nx * r, p.y + ny * r]); basso.push([p.x - nx * r, p.y - ny * r]);
  }
  const yImb = 86.90, xImb = -177.31;      // dove la soglia rocciosa scende sotto il colmo del tubo (margine 0,03 u)
  const yGal = (() => { let best = cam[0]; for (const p of cam) if (Math.abs(p.x - C.x[1]) < Math.abs(best.x - C.x[1])) best = p; return best.y; })();
  const pts = [
    [xImb, yImb - r], [C.x[0], yImb - r], [C.x[0], C.y[0]], [C.x[1], C.y[0]], [C.x[1], yGal - r],
    ...basso, ...alto.reverse(),
    [C.x[1], yGal + r], [C.x[1], C.y[1]], [Q.x[1], C.y[1]], [Q.x[1], Q.y1], [Q.x[0], Q.y1], [Q.x[0], C.y[1]],
    [C.x[0], C.y[1]], [C.x[0], yImb + r], [xImb, yImb + r],
  ];
  return new THREE.Path(pts.map(p => new THREE.Vector2(p[0], p[1])));
}
const rett = (x0, x1, y0, y1) => new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);

export function geometriaTaglio(curvaPelton) {
  const prof = puntiProfilo();
  const pts = [new THREE.Vector2(B.x0, B.base), new THREE.Vector2(B.x1, B.base)];
  for (let i = prof.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(prof[i][0], prof[i][1]));
  const s = new THREE.Shape(pts);
  s.holes.push(rett(FO.francis.x[0], FO.francis.x[1], FO.francis.y[0], FO.francis.y[1]));
  s.holes.push(rett(FO.kaplan.x[0], FO.kaplan.x[1], FO.kaplan.y[0], FO.kaplan.y[1]));
  if (curvaPelton) s.holes.push(foroPresa(curvaPelton));
  const g = new THREE.ShapeGeometry(s);
  g.translate(0, 0, Z_TAGLIO);
  g.deleteAttribute('uv');
  return g;
}

/** Fianchi (x = ±230) e retro (z = −60) del blocco, sulle stesse quote della griglia. */
export function geometriaFianchi(G) {
  const parti = [];
  for (const x of [B.x0, B.x1]) {
    const pts = [new THREE.Vector2(B.z0, B.base), new THREE.Vector2(B.z1, B.base)];
    for (let j = G.zs.length - 1; j >= 0; j--) pts.push(new THREE.Vector2(G.zs[j], hValle(x, G.zs[j])));
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setXYZ(i, x, v, u); }
    parti.push(g);
  }
  {
    const pts = [new THREE.Vector2(B.x0, B.base), new THREE.Vector2(B.x1, B.base)];
    for (let i = G.xs.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(G.xs[i], hValle(G.xs[i], B.z0)));
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.translate(0, 0, B.z0); parti.push(g);
  }
  for (const g of parti) { g.deleteAttribute('uv'); g.computeVertexNormals(); }
  return parti;
}

// ---------------------------------------------------------------- acque
/** Pelo libero inclinato: poligono nel piano (x, −z) → (x, livello(x), z), normali verso l'alto. */
function pelo(poligono, livello, passoX = 2) {
  // infittisce i lati lunghi in x, così il pelo inclinato del fiume segue il livello
  const dense = [];
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i], b = poligono[(i + 1) % poligono.length];
    const n = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / passoX));
    for (let k = 0; k < n; k++) dense.push(new THREE.Vector2(a[0] + (b[0] - a[0]) * k / n, -(a[1] + (b[1] - a[1]) * k / n)));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(dense));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), v = p.getY(i); p.setXYZ(i, x, livello(x), -v); }
  // la triangolazione in (x, −z) dà normali +y; si ricalcolano sul pelo inclinato. uv = (x, −z): la normal map
  // dell'acqua si ripete con texture.repeat
  g.computeVertexNormals();
  return g;
}
/** Sezione d'acqua sul piano di taglio: fra il fondo (profilo) e il pelo libero. */
function sezioneAcqua(x0, x1, livello, fondo = profilo) {
  const pts = [], n = Math.max(2, Math.ceil((x1 - x0) / 0.5));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push(new THREE.Vector2(x, livello(x))); }
  for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; pts.push(new THREE.Vector2(x, fondo(Math.min(Math.max(x, x0 + 1e-4), x1 - 1e-4)))); }
  return poligonoTaglio(pts, livello);
}
/** Poligono d'acqua sul taglio; aLivello = pelo libero sopra ogni vertice (la resina si fa più densa in profondità). */
function poligonoTaglio(pts, livello) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.translate(0, 0, Z_ACQUA); g.deleteAttribute('uv');
  const p = g.attributes.position, L = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) L[i] = livello(p.getX(i));
  g.setAttribute('aLivello', new THREE.BufferAttribute(L, 1));
  return g;
}
/** Serbatoio sul taglio: pelo 17,0 dalla centrale Pelton al paramento di monte della diga, fondo del bacino. */
function sezioneSerbatoio() {
  const x0 = VALLE.diga.x[0], xP = E.pelton.x[1], L = PE.serbatoio, pts = [];
  for (let x = xP; x < x0 + digaMonte(L) - 1e-6; x += 0.5) pts.push(new THREE.Vector2(x, L));
  for (let y = L; y >= 2.5 - 1e-9; y -= 0.25) pts.push(new THREE.Vector2(x0 + digaMonte(y), y));      // paramento della diga
  for (let x = x0 - 0.5; x > xP + 1e-6; x -= 0.5) pts.push(new THREE.Vector2(x, fondoValle(x)));      // fondo del bacino
  pts.push(new THREE.Vector2(xP, fondoValle(xP)));
  return poligonoTaglio(pts, () => L);
}

/**
 * Acque del plastico: { peli: BufferGeometry[], sezioni: BufferGeometry[], linee: [[x0,y0,x1,y1…]] } (linee = bordi dei peli
 * sul taglio, per l'inchiostro del livello).
 */
export function acque() {
  const xL = xSogliaLago(), cost = v => () => v;
  const PC = E.pelton.canale, PX = E.pelton.x, FX = E.francis.x, KX = E.kaplan.x, KZ = E.kaplan.z[0], T = E.traversa;
  // serbatoio: il bordo a valle segue il paramento di monte della diga (0,05 u dentro la diga: niente fessure)
  const uM = digaMonte(PE.serbatoio) + 0.05, bordoDiga = [];
  for (let z = 0; z >= B.z0 - 1e-9; z -= 1) { const [x, zz] = digaPunto(z, uM); bordoDiga.push([x, zz]); }
  const peli = [
    pelo([[B.x0, 0], [xL, 0], [xL, B.z0], [B.x0, B.z0]], cost(PE.lagoAlto)),
    pelo([[PX[1], 0], ...bordoDiga, [PX[1], B.z0]], cost(PE.serbatoio)),
    pelo([[PE.fiumeMonte[0], 0], [KX[0], 0], [KX[0], KZ], [T.monte + 0.02, KZ], [T.monte + 0.02, -22], [PE.fiumeMonte[0], -22]], livelloFiume),
    pelo([[KX[1], 0], [B.x1, 0], [B.x1, -22], [T.monte + 3.6, -22], [T.monte + 3.6, KZ], [KX[1], KZ]], x => (x < KX[1] ? PE.valle[0] : livelloValle(x))),
    pelo([[PC.x0, 0], [PX[1] - E.muro, 0], [PX[1] - E.muro, PC.z0], [PC.x0, PC.z0]], cost(PC.acqua)),
  ];
  // sezioni sul taglio
  const x0 = VALLE.diga.x[0];
  const sezioni = [
    sezioneAcqua(B.x0, xL, cost(PE.lagoAlto)),
    sezioneSerbatoio(),
    sezioneAcqua(PE.fiumeMonte[0], KX[0], livelloFiume),
    sezioneAcqua(KX[1], B.x1, livelloValle),
    sezioneAcqua(PC.x0, PX[1] - E.muro, cost(PC.acqua), cost(PC.fondo)),
  ];
  const linea = (xa, xb, f) => { const out = [], n = Math.max(1, Math.ceil((xb - xa) / 1)); for (let i = 0; i < n; i++) { const a = xa + (xb - xa) * i / n, b = xa + (xb - xa) * (i + 1) / n; out.push(a, f(a), b, f(b)); } return out; };
  const linee = [
    ...linea(B.x0, xL, cost(PE.lagoAlto)), ...linea(PX[1], x0 + digaMonte(PE.serbatoio), cost(PE.serbatoio)),
    ...linea(PE.fiumeMonte[0], KX[0], livelloFiume), ...linea(KX[1], B.x1, livelloValle),
  ];
  return { peli, sezioni, linee };
}

// ---------------------------------------------------------------- appoggio
export function geometriaAppoggio() {
  const A = VALLE.appoggio, g = new THREE.PlaneGeometry(A.lato, A.lato, 1, 1);
  g.rotateX(-Math.PI / 2); g.translate(0, A.y, (B.z0 + B.z1) / 2); g.deleteAttribute('uv');
  return g;
}
export { fondoValle };
