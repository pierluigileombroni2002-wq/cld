// =============================================================================
// ERI v2 · idro/pelton-forme.js — forme della turbina Pelton (file privato di idro/pelton.js)
// Proprietario: [VALLE]. Si importa SOLO da idro/pelton.js. Solo geometrie, niente materiali né ctx.
// Specifica: DESIGN §6.7 Pelton, §3.6 (posizioni), config.VALLE (girantePelton, ugelloA/B, carterPelton,
// generatorePelton, condottaPelton), quote della sala da valle-forme.js (EDIFICI.pelton).
//
// Tutto in METRI nel telaio della macchina: origine al centro della ruota, x verso est, y in alto, z verso il taglio
// (asse della macchina lungo z, piano della ruota z = 0, che è anche il piano di taglio ZP).
// Linguaggio: pezzi torniti con spigoli vivi e raccordi netti (normali separate fra un tratto e l'altro), girante
// monoblocco (cucchiai lucidi a doppia conca con la cresta tagliente e l'intaglio in punta, colli di fusione senza
// bulloni), carter ad arco con le porte dei getti, su due pile nel pozzo. Ugelli con servomotore interno (bulbo
// coassiale): tagliati a metà da ZP, mostrano bulbo e spina lucida.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE, UNITA } from '../config.js';
import { ss } from '../geo.js';
import { EDIFICI } from './valle-forme.js';

const TAU = Math.PI * 2;
const GP = VALLE.girantePelton, C = GP.centro, MU = UNITA.metriPerU;
const loc = (w, i) => (w - C[i]) * MU;                  // u del mondo → metri del telaio della macchina

/** Quote della macchina e della sala, tutte da config (m, telaio della macchina). */
export const QUOTE = {
  rp: GP.diametroPrimitivoM / 2,                                         // 0,84
  larghezza: GP.larghezzaCucchiaioM,                                     // 0,30
  boccaA: [loc(VALLE.ugelloA.x0, 0), loc(VALLE.ugelloA.asseY, 1)],       // (−2,5; −0,84): getto verso +x
  boccaB: [loc(VALLE.ugelloB.asseX, 0), loc(VALLE.ugelloB.y0, 1)],       // (−0,84; 2,5): getto verso −y
  carterR: VALLE.carterPelton.raggioM, carterP: VALLE.carterPelton.profonditaM,
  gen: { z0: loc(VALLE.generatorePelton.z[0], 2), z1: loc(VALLE.generatorePelton.z[1], 2), r: VALLE.generatorePelton.diametroM / 2 },
  condotta: { x: loc(VALLE.condottaPelton.fine[0], 0), y: loc(VALLE.condottaPelton.fine[1], 1), r: VALLE.condottaPelton.raggio * MU },
  pavimento: loc(EDIFICI.pelton.pavimento, 1),                           // −2,0
  fondoPozzo: loc(EDIFICI.pelton.canale.fondo, 1),                       // −5,6
  bordoPozzo: loc(EDIFICI.pelton.canale.x0, 0),                          // −3,0
  retroPozzo: loc(EDIFICI.pelton.canale.z0, 2),                          // −3,5
};

// TARATURA: proporre in config (VALLE.girantePelton.forme / VALLE.ugelli) — misure di dettaglio in m (DESIGN §6.7 dove
// le dà: disco Ø 1,40 × 0,16, cucchiaio 0,26 × 0,085, intaglio ±0,15 / 0,12 della larghezza, corsa della spina 0,08)
export const FORMA = {
  disco: { r: 0.70, spessore: 0.16, mozzo: 0.195, lunghezzaMozzo: 0.54, anima: 0.12 },
  cucchiaio: {
    lunghezza: 0.26, profondita: 0.085, spessore: 0.008, scostamento: 0.01, inclinazione: -0.18,
    intaglio: [0.15, 0.12],          // semilarghezza e arretramento, in frazioni della larghezza (DESIGN)
    contorno: 2.6,                   // superellisse del bordo
    conca: 0.5, cresta: 0.16,        // fondo delle due conche (ζ) e profondità relativa della cresta
    pareti: [2.4, 0.55],             // G(ρ) = (1 − ρ^a)^b: pareti ripide verso il bordo
    dorso: [1.04, 0.8],              // dorso: scala e nervatura centrale (dorso a due lobi con costola)
  },
  ugello: { lunghezza: 1.55, flangia: 0.37, corpo: 0.29, bocca: 0.06, corsa: 0.08 },
  deviatore: { perno: [-0.30, -0.16], ritiro: 0.36 },        // nel telaio dell'ugello (asse +y, bocca in 0)
  carter: { spessore: 0.04, porta: 0.075, fondo: 0.04, fascia: 0.012 },
  albero: { r: 0.11, giunto: [-5.42, -5.20], cuscinetto: -4.2 },
};

// ---------------------------------------------------------------- utilità
/** Unisce geometrie (tutte non indicizzate, stessi attributi), liberando quelle di partenza. */
export function unisci(lista) {
  const g = mergeGeometries(lista.map(x => (x.index ? x.toNonIndexed() : x)), false);
  lista.forEach(x => x.dispose());
  return g;
}
/** Solido di rivoluzione attorno a y: tratti [[r, y], …]; fra un tratto e l'altro lo spigolo è vivo. */
export function tornio(tratti, seg = 96) {
  return unisci(tratti.map(t => new THREE.LatheGeometry(t.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), seg)));
}
/** Stesso tornio coricato sull'asse z (y del profilo → z). */
const tornioZ = (tratti, seg) => tornio(tratti, seg).rotateX(Math.PI / 2);
/** Punti di un arco (centro, raggio, angoli in rad). */
function arco(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
/** Anello piatto rettangolare al tornio (r0..r1, y0..y1): quattro facce a spigolo vivo. */
const anello = (r0, r1, y0, y1) => [[[r0, y0], [r1, y0]], [[r1, y0], [r1, y1]], [[r1, y1], [r0, y1]], [[r0, y1], [r0, y0]]];
/** Estrusione lungo z di una forma piana (x, y) da z0 a z1, con smusso. */
function estrudi(forma, z0, z1, smusso = 0) {
  const g = new THREE.ExtrudeGeometry(forma, { depth: z1 - z0 - 2 * smusso, curveSegments: 24, bevelEnabled: smusso > 0,
    bevelThickness: smusso, bevelSize: smusso, bevelSegments: 2 });
  g.translate(0, 0, z0 + smusso);
  return g;
}
const forma = pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
/** Normali morbide (pezzo di fusione): fonde i vertici coincidenti e ricalcola; uv nulle per l'unione. */
function liscia(g) {
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5); g.dispose();
  m.computeVertexNormals();
  m.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(m.attributes.position.count * 2), 2));
  return m;
}
/** Prisma esagonale (testa di bullone) lungo z, a facce piatte. */
function bullone(r, h, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, h, 6).rotateX(Math.PI / 2).translate(x, y, z).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/**
 * Superficie a griglia (nu × nv quadrilateri) con normali morbide; f(i, j) → [x, y, z]. L'orientamento si corregge
 * da sé: la normale del vertice centrale deve guardare verso `verso`.
 */
function griglia(nu, nv, f, verso) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...f(i, j)); uv.push(i / nu, j / nv); }
  const k = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) idx.push(k(i, j), k(i + 1, j), k(i + 1, j + 1), k(i, j), k(i + 1, j + 1), k(i, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal, m = k(nu >> 1, nv >> 1);
  if (n.getX(m) * verso[0] + n.getY(m) * verso[1] + n.getZ(m) * verso[2] < 0) {
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = a; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return g;
}

/** Facce con normali esplicite; ogni triangolo si gira da sé verso la media delle normali dei vertici. */
class Facce {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  tri(a, b, c) {
    const e1 = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]], e2 = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const d = (a.n[0] + b.n[0] + c.n[0]) * g[0] + (a.n[1] + b.n[1] + c.n[1]) * g[1] + (a.n[2] + b.n[2] + c.n[2]) * g[2];
    for (const v of d < 0 ? [a, c, b] : [a, b, c]) { this.p.push(...v.p); this.n.push(...v.n); this.uv.push(...(v.uv || [0, 0])); }
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

// ---------------------------------------------------------------- girante
/** Disco al tornio (Ø 1,40 × 0,16) con mozzo, anima più sottile raccordata e cerchione arrotondato; asse z. */
export function geoDisco() {
  const D = FORMA.disco, R = D.r, h = D.spessore / 2, rm = D.mozzo, lm = D.lunghezzaMozzo / 2, a = D.anima / 2;
  const meta = s => [   // dal mozzo al cerchione, sul lato s (−1 dietro, +1 davanti), nel verso del profilo
    [rm, s * (lm - 0.03)],
    ...arco(rm + 0.06, s * (a + 0.06), 0.06, Math.PI, s > 0 ? 1.5 * Math.PI : 0.5 * Math.PI, 8),     // raccordo mozzo-anima
    [0.54, s * (a - 0.01)], [0.565, s * (a - 0.008)], [0.585, s * (a + 0.002)], [0.60, s * (h - 0.006)], [0.615, s * h],
    ...arco(R - 0.02, s * (h - 0.02), 0.02, s > 0 ? 0.5 * Math.PI : -0.5 * Math.PI, 0, 5),          // spigolo tondo del cerchione
  ];
  const dietro = meta(-1), davanti = meta(1).reverse();
  return tornioZ([
    [[0, -lm], [rm - 0.03, -lm]], [[rm - 0.03, -lm], [rm, -lm + 0.03]],
    [...dietro, ...davanti],
    [[rm, lm - 0.03], [rm - 0.03, lm]], [[rm - 0.03, lm], [0, lm]],
  ], 128);
}
/** Ogiva lucida sul mozzo (davanti). */
export function geoCappello() {
  const D = FORMA.disco, r = D.mozzo - 0.03, y = D.lunghezzaMozzo / 2;
  const p = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI / 2; p.push([r * Math.cos(a), y - 0.002 + 0.075 * Math.sin(a)]); }
  return tornioZ([p], 96);
}

/**
 * Cucchiaio doppio (DESIGN §6.7), costruito sul raggio +x (posizione θ = 0, moto verso +y, conche aperte verso −y,
 * contro il getto). Due conche separate dalla cresta tagliente (normali spezzate sulla cresta), intaglio in punta,
 * dorso a due lobi con la costola centrale, bordo smussato; collo di fusione che esce dal cerchione (monoblocco).
 * Inclinato all'indietro (punta contro il moto) attorno al punto primitivo.
 */
export function geoCucchiaio() {
  const F = FORMA.cucchiaio, rp = QUOTE.rp, B = QUOTE.larghezza;
  const L = F.lunghezza / 2, W = B / 2, D = F.profondita, th = F.spessore, rc = rp + F.scostamento;
  const hw = F.intaglio[0] * B / W, dn = F.intaglio[1] * B / L, m = F.contorno;
  // contorno normalizzato (superellisse) con l'intaglio in punta (φ = 0 → verso l'esterno)
  const R = phi => {
    const c = Math.cos(phi), s = Math.sin(phi);
    let r = Math.pow(Math.pow(Math.abs(c), m) + Math.pow(Math.abs(s), m), -1 / m);
    if (c > 0) r -= dn * (1 - ss(0.55 * hw, 1.35 * hw, Math.abs(r * s))) / Math.max(c, 0.35);
    return r;
  };
  const G = rho => Math.pow(Math.max(0, 1 - Math.pow(rho, F.pareti[0])), F.pareti[1]);
  const zc = F.conca, hr = F.cresta;
  const sezione = z => { const a = Math.abs(z); return a >= zc ? 1 : hr + (1 - hr) * Math.sqrt(Math.max(0, 1 - ((a - zc) / zc) ** 2)); };
  const NR = 22, NA = 48;
  const rhoDi = i => 1 - Math.pow(1 - i / NR, 1.5);                         // fitto verso il bordo (pareti ripide)
  const phiDi = (h, j) => { const a = j / NA; return h * Math.PI + Math.PI * (a - 0.85 * Math.sin(TAU * a) / TAU); };   // fitto sulla cresta
  const punto = (rho, phi, dorso) => {
    const r = R(phi), xn = rho * r * Math.cos(phi), zn = rho * r * Math.sin(phi), ze = rho * Math.sin(phi);
    if (!dorso) return [rc + L * xn, D * G(rho) * sezione(ze), W * zn];
    return [rc + (L + th) * xn, th + D * F.dorso[0] * G(rho) * Math.max(F.dorso[1], sezione(ze)), (W + th) * zn];
  };
  const parti = [];
  for (const h of [0, 1]) {   // una metà per conca: la cresta resta uno spigolo vivo
    parti.push(griglia(NR, NA, (i, j) => punto(rhoDi(i), phiDi(h, j), false), [0, -1, 0]));
    parti.push(griglia(NR, NA, (i, j) => punto(rhoDi(i), phiDi(h, j), true), [0, 1, 0]));
    parti.push(griglia(1, NA, (i, j) => punto(1, phiDi(h, j), i === 1), [0, -1, h ? -1 : 1]));
  }
  // collo di fusione (girante monoblocco, senza bulloni): esce dal cerchione e sale nel dorso, a spigoli tondi
  const rad = new THREE.Shape();
  rad.moveTo(0.60, -0.004); rad.lineTo(0.70, -0.01); rad.quadraticCurveTo(0.738, -0.006, 0.752, 0.010);
  rad.lineTo(0.79, 0.034); rad.quadraticCurveTo(0.80, 0.05, 0.776, 0.052); rad.lineTo(0.66, 0.05);
  rad.quadraticCurveTo(0.612, 0.048, 0.60, 0.032); rad.closePath();
  parti.push(liscia(new THREE.ExtrudeGeometry(rad, { depth: 0.1, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.02,
    bevelSize: 0.016, bevelSegments: 4 }).translate(0, 0, -0.05)));
  const g = unisci(parti);
  g.translate(-rp, 0, 0).rotateZ(F.inclinazione).translate(rp, 0, 0);
  return g;
}

// ---------------------------------------------------------------- albero, giunto, cuscinetto
/** Albero (dal mozzo al generatore) e giunto a flange con i bulloni: gira con la girante. */
export function geoAlbero() {
  const A = FORMA.albero, r = A.r, [g0, g1] = A.giunto, zg = QUOTE.gen.z0 + 0.04;
  const parti = [
    tornioZ([[[0, zg], [r, zg]], [[r, zg], [r, -FORMA.disco.lunghezzaMozzo / 2 + 0.01]], [[r, -0.26], [0, -0.26]]], 48),
    tornioZ([[[r, g0], [0.31, g0]], [[0.31, g0], ...arco(0.31, g0 + 0.02, 0.02, -Math.PI / 2, 0, 4).slice(1), [0.33, (g0 + g1) / 2 - 0.006]],
             [[0.33, (g0 + g1) / 2 - 0.006], [0.318, (g0 + g1) / 2], [0.33, (g0 + g1) / 2 + 0.006]],
             [[0.33, (g0 + g1) / 2 + 0.006], [0.33, g1 - 0.02], ...arco(0.31, g1 - 0.02, 0.02, 0, Math.PI / 2, 4).slice(1)], [[0.31, g1], [r, g1]]], 96),
  ];
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8 + Math.PI / 8, x = 0.25 * Math.cos(a), y = 0.25 * Math.sin(a);
    parti.push(bullone(0.028, 0.022, x, y, g0 - 0.011), bullone(0.028, 0.022, x, y, g1 + 0.011));
  }
  return unisci(parti);
}
/** Cuscinetto di spinta su piedistallo (cassa) e i suoi anelli di tenuta (dettagli), più la tenuta sul carter. */
export function geoCuscinetto() {
  const z = FORMA.albero.cuscinetto, yP = QUOTE.pavimento, zF = -QUOTE.carterP / 2 - FORMA.carter.fondo;
  const cassa = unisci([
    tornioZ([[[0.115, z - 0.18], [0.30, z - 0.18]], [[0.30, z - 0.18], ...arco(0.30, z - 0.14, 0.04, -Math.PI / 2, 0, 5).slice(1), [0.34, z + 0.14],
             ...arco(0.30, z + 0.14, 0.04, 0, Math.PI / 2, 5).slice(1)], [[0.30, z + 0.18], [0.115, z + 0.18]]], 64),
    estrudi(forma([[-0.52, yP], [0.52, yP], [0.52, yP + 0.07], [0.27, yP + 0.32], [0.22, -0.22], [-0.22, -0.22], [-0.27, yP + 0.32], [-0.52, yP + 0.07]]),
            z - 0.15, z + 0.15, 0.008),
  ]);
  const dettagli = unisci([
    tornioZ(anello(0.118, 0.25, z - 0.205, z - 0.18), 64), tornioZ(anello(0.118, 0.25, z + 0.18, z + 0.205), 64),
    tornioZ(anello(0.115, 0.21, zF - 0.07, zF), 64),                      // tenuta dell'albero sul fondo del carter
  ]);
  return { cassa, dettagli };
}

// ---------------------------------------------------------------- generatore
/** Generatore (Ø 3,5 m, asse z da −6 a −11 m): corpo con spigoli tondi, scudi bombati, anelli e filetti, piedi, morsettiera. */
export function geoGeneratore() {
  const { z0, z1, r } = QUOTE.gen, zB = Math.min(z0, z1), zF = Math.max(z0, z1), yP = QUOTE.pavimento;   // −11, −6
  const rs = r - 0.22, rb = 0.08;
  const scudo = (zE, s) => {   // scudo bombato: dal mozzo (s verso l'esterno della macchina) dentro l'anello
    const p = []; for (let k = 0; k <= 10; k++) { const t = k / 10; p.push([0.42 + (rs + 0.05 - 0.42) * t, zE + s * (0.06 * (1 - t * t) - 0.09 * t * t * t)]); }
    return s < 0 ? p : p.reverse();
  };
  // scudi bombati in tinta scura (come la fodera del carter): il corpo dello stile fra due tappi scuri e due anelli
  const scudi = unisci([
    tornioZ([[[0, zB - 0.04], [0.42, zB - 0.04]], [[0.42, zB - 0.04], [0.42, zB - 0.02]], scudo(zB + 0.04, -1)], 96),
    tornioZ([scudo(zF - 0.04, 1)], 96),
  ]);
  const cassa = unisci([
    tornioZ([[[r - rb - 0.06, zB + 0.24], [r - rb, zB + 0.24], ...arco(r - rb, zB + 0.24 + rb, rb, -Math.PI / 2, 0, 6).slice(1),
              [r, zF - 0.24 - rb], ...arco(r - rb, zF - 0.24 - rb, rb, 0, Math.PI / 2, 6).slice(1), [r - rb - 0.06, zF - 0.24]]], 128),
    // piedi e morsettiera (sul fianco est: dal fronte non spunta sopra il carter)
    ...[-1, 1].map(s => estrudi(forma([[s * 1.02, yP], [s * 1.74, yP], [s * 1.74, yP + 0.1], [s * 1.46, yP + 0.42], [s * 1.40, yP + 1.1], [s * 1.04, yP + 1.1]]),
                                zB + 0.55, zF - 0.55, 0.012)),
    estrudi(new THREE.Shape().moveTo(r - 0.2, -0.36).lineTo(r + 0.32, -0.36).quadraticCurveTo(r + 0.4, -0.36, r + 0.4, -0.28)
              .lineTo(r + 0.4, 0.28).quadraticCurveTo(r + 0.4, 0.36, r + 0.32, 0.36).lineTo(r - 0.2, 0.36).closePath(), zB + 1.9, zB + 2.7, 0.02),
  ]);
  const dettagli = unisci([
    tornioZ(anello(rs - 0.04, r - 0.09, zB + 0.12, zB + 0.24), 128), tornioZ(anello(rs - 0.04, r - 0.09, zF - 0.24, zF - 0.12), 128),
    tornioZ(anello(r - 0.005, r + 0.008, zB + 1.55, zB + 1.6), 128), tornioZ(anello(r - 0.005, r + 0.008, zF - 1.6, zF - 1.55), 128),
    tornioZ([[[0.42, zF - 0.02], [0.42, zF + 0.05]], [[0.42, zF + 0.05], [0.115, zF + 0.05]]], 64),         // mozzo del cuscinetto
    new THREE.BoxGeometry(3.9, 0.04, zF - zB - 0.7).translate(0, yP + 0.02, (zB + zF) / 2),               // piastra di base
  ]);
  return { cassa, dettagli, scudi };
}

// ---------------------------------------------------------------- carter (tagliato da ZP)
/**
 * Carter ad arco (raggio 1,6 m, profondità 1,0 m) con le gambe fino al pavimento (poggiano sulle travi che scavalcano
 * il pozzo) e il fondo con il foro dell'albero. Porte dei getti nella metà tagliata (fra z = −porta e il taglio).
 * Restituisce le facce esterne (cassa), la fodera interna (fodera) e due fasce in rilievo (dettagli).
 */
export function geoCarter() {
  const K = FORMA.carter, R = QUOTE.carterR, t = K.spessore, rm = R - t / 2, yB = QUOTE.pavimento, hp = K.porta;
  const zB = -QUOTE.carterP / 2, zF = QUOTE.carterP / 2, zN = -hp;
  const [, yA] = QUOTE.boccaA, [xB] = QUOTE.boccaB;
  // campioni del percorso (gamba ovest dal basso, arco sopra, gamba est verso il basso): punto, normale, tangente
  const S = [];
  const add = (x, y, nx, ny, tx, ty, a = null) => S.push({ x, y, nx, ny, tx, ty, a });
  for (const y of [yB, yA - hp, yA + hp]) add(-rm, y, -1, 0, 0, 1);
  const aB = Math.acos(xB / rm), da = hp / rm, angoli = [];
  for (let k = 0; k <= 120; k++) angoli.push(Math.PI * (1 - k / 120));
  angoli.push(aB - da, aB + da); angoli.sort((p, q) => q - p);
  for (const a of angoli) add(rm * Math.cos(a), rm * Math.sin(a), Math.cos(a), Math.sin(a), Math.sin(a), -Math.cos(a), a);
  add(rm, yB, 1, 0, 0, -1);
  const inPorta = k => {   // porta A: tratto della gamba ovest attorno a yA; porta B: tratto d'arco attorno ad aB
    if (k < 0 || k >= S.length - 1) return false;
    const a = S[k], b = S[k + 1];
    if (a.a === null && b.a === null) return a.x < 0 && Math.abs((a.y + b.y) / 2 - yA) < hp;
    return a.a !== null && b.a !== null && Math.abs((a.a + b.a) / 2 - aB) < da;
  };
  const v = (s, off, z, n) => ({ p: [s.x + s.nx * off, s.y + s.ny * off, z], n });
  const fuori = new Facce(), dentro = new Facce();
  for (let k = 0; k < S.length - 1; k++) {
    const a = S[k], b = S[k + 1], porta = inPorta(k);
    for (const [z0, z1] of [[zB, zN], [zN, zF]]) {
      if (porta && z0 === zN) continue;
      fuori.quad(v(a, t / 2, z0, [a.nx, a.ny, 0]), v(b, t / 2, z0, [b.nx, b.ny, 0]), v(b, t / 2, z1, [b.nx, b.ny, 0]), v(a, t / 2, z1, [a.nx, a.ny, 0]));
      dentro.quad(v(a, -t / 2, z0, [-a.nx, -a.ny, 0]), v(b, -t / 2, z0, [-b.nx, -b.ny, 0]), v(b, -t / 2, z1, [-b.nx, -b.ny, 0]), v(a, -t / 2, z1, [-a.nx, -a.ny, 0]));
    }
    if (porta) {   // fondo della porta (z = zN) e fianchi all'inizio e alla fine della porta
      const nz = [0, 0, 1];
      fuori.quad(v(a, -t / 2, zN, nz), v(b, -t / 2, zN, nz), v(b, t / 2, zN, nz), v(a, t / 2, zN, nz));
      if (!inPorta(k - 1)) { const n = [a.tx, a.ty, 0]; fuori.quad(v(a, -t / 2, zN, n), v(a, t / 2, zN, n), v(a, t / 2, zF, n), v(a, -t / 2, zF, n)); }
      if (!inPorta(k + 1)) { const n = [-b.tx, -b.ty, 0]; fuori.quad(v(b, -t / 2, zN, n), v(b, t / 2, zN, n), v(b, t / 2, zF, n), v(b, -t / 2, zF, n)); }
    }
  }
  for (const s of [S[0], S[S.length - 1]]) { const n = [0, -1, 0]; fuori.quad(v(s, -t / 2, zB, n), v(s, t / 2, zB, n), v(s, t / 2, zF, n), v(s, -t / 2, zF, n)); }
  // fasce in rilievo (filetti): dietro, sul bordo del fondo, e appena dietro il taglio
  const fasce = new Facce(), e = K.fascia;
  for (const [z0, z1] of [[zB, zB + 0.06], [-0.15, -0.11]]) {
    for (let k = 0; k < S.length - 1; k++) {
      const a = S[k], b = S[k + 1], na = [a.nx, a.ny, 0], nb = [b.nx, b.ny, 0];
      fasce.quad(v(a, t / 2 + e, z0, na), v(b, t / 2 + e, z0, nb), v(b, t / 2 + e, z1, nb), v(a, t / 2 + e, z1, na));
      for (const [z, nz] of [[z0, [0, 0, -1]], [z1, [0, 0, 1]]]) fasce.quad(v(a, t / 2 - 0.002, z, nz), v(b, t / 2 - 0.002, z, nz), v(b, t / 2 + e, z, nz), v(a, t / 2 + e, z, nz));
    }
  }
  // fondo: lastra con il foro dell'albero (cassa) e la sua faccia interna (fodera)
  const sagoma = (r, foro) => {
    const s = new THREE.Shape(); s.moveTo(-r, yB); s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(r, yB); s.closePath();
    const h = new THREE.Path(); h.absarc(0, 0, foro, 0, TAU, true); s.holes.push(h);
    return s;
  };
  const fondo = new THREE.ExtrudeGeometry(sagoma(R, 0.14), { depth: K.fondo, bevelEnabled: false, curveSegments: 96 }).translate(0, 0, zB - K.fondo);
  const fondoDentro = new THREE.ShapeGeometry(sagoma(R - t, 0.14), 96).translate(0, 0, zB + 0.001);
  // dettagli: anello dietro la ruota (come la lunetta di un quadrante), tenuta dell'albero, piastre dei piedi
  const piedi = [-1, 1].map(s => new THREE.BoxGeometry(0.22, 0.045, QUOTE.carterP + 0.12).translate(s * rm, yB + 0.0225, 0));
  return {
    cassa: unisci([fuori.geometria(), fondo]),
    fodera: unisci([dentro.geometria(), fondoDentro]),
    dettagli: unisci([fasce.geometria(), tornioZ(anello(1.10, 1.135, zB, zB + 0.025), 128), tornioZ(anello(0.135, 0.25, zB, zB + 0.05), 64), ...piedi]),
  };
}
/** Pile in calcestruzzo nel pozzo, sotto le gambe del carter (dal fondo del pozzo al pavimento). */
export function geoPile() {
  const rm = QUOTE.carterR - FORMA.carter.spessore / 2, yP = QUOTE.pavimento, yF = QUOTE.fondoPozzo, p = QUOTE.carterP + 0.24;
  return unisci([-1, 1].map(s => new THREE.BoxGeometry(0.36, yP - yF, p).translate(s * rm, (yP + yF) / 2, 0)));
}

// ---------------------------------------------------------------- ugelli (telaio dell'ugello: asse +y, bocca in y = 0)
/** Corpo dell'ugello (cassa, tagliato), flangia e boccaglio (dettagli, tagliati), alette che reggono il bulbo. */
export function geoUgello() {
  const U = FORMA.ugello, Lu = U.lunghezza, rf = U.flangia, rc = U.corpo, rb = U.bocca, ri = 0.22;
  const ogiva = []; for (let k = 0; k <= 14; k++) { const s = k / 14; ogiva.push([0.135 + (rc - 0.135) * Math.pow(Math.cos(s * Math.PI / 2), 0.9), -0.95 + 0.79 * s]); }
  const corpo = tornio([
    [[ri, -Lu + 0.08], [rc, -Lu + 0.08]], [[rc, -Lu + 0.08], [rc, -0.95], ...ogiva.slice(1)], [[0.135, -0.16], [0.10, -0.16]],
    [[0.10, -0.16], [0.13, -0.30], [0.17, -0.45], [0.20, -0.62], [0.215, -0.80], [ri, -0.95], [ri, -Lu + 0.08]],
  ], 96);
  const alette = unisci([0, Math.PI, 1.5 * Math.PI].map(a => {
    const g = new THREE.BoxGeometry(0.115, 0.34, 0.02).translate(0.17, -1.12, 0); g.rotateY(-a); return g;
  }));
  const dettagli = unisci([
    tornio(anello(ri, rf, -Lu, -Lu + 0.08), 96),
    tornio(anello(rc - 0.01, rc + 0.009, -1.0, -0.96), 96),                           // filetto fra corpo e ogiva
    tornio([[[0.10, -0.16], [0.135, -0.16]], [[0.135, -0.16], [0.13, -0.10], [0.118, -0.05], [0.104, -0.015], [0.092, 0]],
            [[0.092, 0], [rb, 0]], [[rb, 0], [rb, -0.012], [0.07, -0.03], [0.078, -0.05], [0.09, -0.10], [0.10, -0.16]]], 96),
  ]);
  return { corpo: unisci([corpo, alette]), dettagli };
}
/** Bulbo del servomotore interno, coassiale (dettagli, intero). */
export function geoBulbo() {
  return tornio([[[0, -1.43], [0.05, -1.425], [0.085, -1.40], [0.11, -1.36], [0.12, -1.30], [0.12, -0.84], [0.11, -0.76], [0.085, -0.69], [0.062, -0.64]],
                 [[0.062, -0.64], [0, -0.64]]], 64);
}
/** Spina a lancia (inox lucido), in posizione chiusa: la punta sporge dalla bocca; si arretra di FORMA.ugello.corsa. */
export function geoSpina() {
  return tornio([[[0, -0.72], [0.04, -0.72]],
                 [[0.04, -0.72], [0.04, -0.32], [0.05, -0.27], [0.065, -0.22], [0.073, -0.18], [0.075, -0.15], [0.0745, -0.10], [0.071, -0.05], [0.0595, -0.012], [0.058, 0]],
                 [[0.058, 0], [0.004, 0.0985], [0, 0.105]]], 96);
}
/**
 * Deviatore (dettagli, intero), nel telaio del perno: lama curva che entra nel getto dal lato della ruota e lo piega
 * verso l'esterno, due bracci a forcella. `fisso`: perno e staffa sul corpo dell'ugello.
 */
export function geoDeviatore() {
  const P = FORMA.deviatore.perno;
  const q = s => { const u = 1 - s; return [u * u * 0.28 + 2 * u * s * 0.30 + s * s * 0.38, u * u * 0.27 + 2 * u * s * 0.42 + s * s * 0.52]; };
  const fuori = [], dentro = [], sp = 0.008;
  for (let k = 0; k <= 16; k++) {
    const s = k / 16, p = q(s), p2 = q(Math.min(1, s + 0.01)), p1 = q(Math.max(0, s - 0.01));
    const tx = p2[0] - p1[0], ty = p2[1] - p1[1], l = Math.hypot(tx, ty), nx = -ty / l, ny = tx / l;
    fuori.push([p[0] + nx * sp, p[1] + ny * sp]); dentro.push([p[0] - nx * sp, p[1] - ny * sp]);
  }
  const lama = estrudi(forma([...fuori, ...dentro.reverse()]), -0.07, 0.07, 0.003);
  const M = q(0.5), lM = Math.hypot(M[0], M[1]), dx = M[0] / lM, dy = M[1] / lM, ex = -dy, ey = dx, a0 = Math.atan2(ey, ex);
  const braccio = new THREE.Shape();
  braccio.moveTo(M[0] + ex * 0.014, M[1] + ey * 0.014); braccio.lineTo(ex * 0.034, ey * 0.034);
  braccio.absarc(0, 0, 0.034, a0, a0 + Math.PI, false); braccio.lineTo(M[0] - ex * 0.014, M[1] - ey * 0.014); braccio.closePath();
  const mobile = unisci([lama, estrudi(braccio, 0.044, 0.06, 0.002), estrudi(braccio, -0.06, -0.044, 0.002)]);
  const fisso = unisci([
    new THREE.CylinderGeometry(0.032, 0.032, 0.17, 24).rotateX(Math.PI / 2),
    new THREE.BoxGeometry(0.2, 0.05, 0.05).translate(0.09, 0, -0.06),
  ]);
  return { mobile, fisso, perno: P };
}

// ---------------------------------------------------------------- collettore (dalla condotta agli ugelli)
/** Tubo di raggio variabile lungo una curva del piano xy; i tappi alle estremità a parte (scuri: si legge un foro). */
function tubo(curva, raggio, n, m = 40) {
  const F = new Facce(), Tp = new Facce(), P = [], T = [];
  for (let i = 0; i <= n; i++) { P.push(curva.getPointAt(i / n)); T.push(curva.getTangentAt(i / n)); }
  const vert = (i, j) => {
    const a = j / m * TAU, c = Math.cos(a), s = Math.sin(a), nx = -T[i].y, ny = T[i].x, r = raggio(i / n);
    const dn = [c * nx, c * ny, s];
    return { p: [P[i].x + r * dn[0], P[i].y + r * dn[1], P[i].z + r * dn[2]], n: dn, uv: [i / n, j / m] };
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) F.quad(vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1));
  for (const [i, sg] of [[0, -1], [n, 1]]) {
    const nt = [T[i].x * sg, T[i].y * sg, T[i].z * sg], c = { p: [P[i].x, P[i].y, P[i].z], n: nt };
    for (let j = 0; j < m; j++) { const a = vert(i, j), b = vert(i, j + 1); Tp.tri(c, { p: a.p, n: nt }, { p: b.p, n: nt }); }
  }
  return { mantello: F.geometria(), tappi: Tp.geometria() };
}
/**
 * Collettore a Y dalla fine della condotta (−15; 0; 0) ai due ugelli: ramo A che scende in asse all'ugello A, ramo B
 * che sale, scavalca la ruota e scende sull'ugello B. Flangia di giunzione con la condotta, sella sotto il ramo A.
 */
export function geoCollettore() {
  const Q = QUOTE, U = FORMA.ugello, [xA, yA] = Q.boccaA, [xB, yB] = Q.boccaB, x0 = Q.condotta.x, y0 = Q.condotta.y, r0 = Q.condotta.r;
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  const iA = xA - U.lunghezza, iB = yB + U.lunghezza, rr = 1.05, k = 0.5523 * rr, yS = iB + rr;   // ingressi, curva sopra la ruota
  const cA = new THREE.CubicBezierCurve3(V(x0, y0), V(x0 + 3.5, y0), V(x0 + 7.0, yA), V(iA, yA));
  const cB = new THREE.CurvePath();
  cB.add(new THREE.CubicBezierCurve3(V(x0, y0), V(x0 + 4.0, y0), V(x0 + 8.2, yS), V(xB - rr, yS)));
  cB.add(new THREE.CubicBezierCurve3(V(xB - rr, yS), V(xB - rr + k, yS), V(xB, iB + k), V(xB, iB)));
  const rA = s => r0 + (0.25 - r0) * ss(0.1, 0.75, s), rB = s => r0 + (0.25 - r0) * ss(0.05, 0.6, s);
  // sella sotto il ramo A, dove il tubo è ormai orizzontale
  const xs = iA - 1.2, ys = yA - 0.25, yP = Q.pavimento;
  const sella = estrudi(forma([[xs - 0.3, yP], [xs + 0.3, yP], [xs + 0.3, yP + 0.06], [xs + 0.18, yP + 0.2], [xs + 0.16, ys + 0.05], [xs - 0.16, ys + 0.05], [xs - 0.18, yP + 0.2], [xs - 0.3, yP + 0.06]]),
                        -0.2, 0.2, 0.008);
  const tA = tubo(cA, rA, 72), tB = tubo(cB, rB, 120);
  const cassa = unisci([tA.mantello, tB.mantello, sella]);
  const flangia = tornio(anello(r0 - 0.005, r0 + 0.11, -0.06, 0.06), 64).rotateZ(-Math.PI / 2).translate(x0, y0, 0);
  return { cassa, dettagli: flangia, tappi: unisci([tA.tappi, tB.tappi]) };
}
/** Piedistallo dell'ugello A (cassa, tagliato): sul pavimento, prima del bordo del pozzo. */
export function geoPiedistallo() {
  const [xA, yA] = QUOTE.boccaA, x = Math.min(xA - 1.0, QUOTE.bordoPozzo - 0.45), yP = QUOTE.pavimento, yt = yA - FORMA.ugello.corpo + 0.07;
  return estrudi(forma([[x - 0.27, yP], [x + 0.27, yP], [x + 0.27, yP + 0.06], [x + 0.18, yP + 0.18], [x + 0.15, yt], [x - 0.15, yt], [x - 0.18, yP + 0.18], [x - 0.27, yP + 0.06]]),
                 -0.24, 0.24, 0.01);
}
