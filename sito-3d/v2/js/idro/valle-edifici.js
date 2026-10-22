// =============================================================================
// ERI v2 · idro/valle-edifici.js — centrali in sezione, diga ad arco, traversa, presa, condotte forzate, luci di sala
// Proprietario: [VALLE]. File privato di idro/valle.js.
// Specifica: DESIGN §3.6 (tabella degli elementi), §6.7 (sezioni), §4.5 (rectInt, rectSala, YF), config.VALLE.
//
// Centrali: scatole bianche nette (pareti 1,2 m, tetto con sbalzo, lesene ritmate attorno all'asse della macchina,
// pavimento in resina lucida, luci lineari a filo soffitto). Sono fatte di più pezzi che si toccano: perciò la loro
// sezione sul piano di taglio è DISEGNATA (rettangoli piatti a z = +0,0015, stessa campitura della roccia) invece di
// affidarsi alle retro-facce, che fra pezzi sovrapposti mostrerebbero facce interne. Diga, ancoraggi, presa Francis e
// condotte sono solidi chiusi singoli: lì la campitura sul retro (patchSezione) basta ed è esatta.
// La Francis ha anche la sezione orizzontale disegnata (pianta delle pareti) che segue il piano mobile YF.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE } from '../config.js';
import { EDIFICI, profiloDiga, digaPunto, digaAsse, digaMonte, profiloTraversa, puntiCondottaPelton, puntiCondottaFrancis,
         RAGGIO_PELTON, RAGGIO_FRANCIS, fondoValle } from './valle-forme.js';

const E = EDIFICI, W = E.muro, Z_CAP = 0.0015;

// ---------------------------------------------------------------- utilità
/** Scatola fra due angoli (senza uv: nessun materiale del plastico usa mappe). */
function scatola(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.deleteAttribute('uv');
  return g;
}
/** Solaio orizzontale con fori circolari: forma in (x, −z), estrusa in altezza da y0 a y1. */
function solaio(x0, x1, z0, z1, y0, y1, fori = []) {
  const s = new THREE.Shape([new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0), new THREE.Vector2(x0, -z0)]);
  for (const f of fori) { const h = new THREE.Path(); h.absarc(f.c[0], -f.c[1], f.r, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}
const unisci = lista => { const g = mergeGeometries(lista.map(x => (x.index ? x.toNonIndexed() : x)), false); lista.forEach(x => x.dispose()); return g; };
/** Rettangoli piatti della sezione disegnata (piano z = +0,0015 o pianta a y = 0). */
function rettangoli(lista, piano = 'z') {
  const forme = lista.map(([a0, a1, b0, b1]) => new THREE.Shape([new THREE.Vector2(a0, b0), new THREE.Vector2(a1, b0), new THREE.Vector2(a1, b1), new THREE.Vector2(a0, b1)]));
  const g = new THREE.ShapeGeometry(forme); g.deleteAttribute('uv');
  if (piano === 'z') g.translate(0, 0, Z_CAP); else g.rotateX(-Math.PI / 2);
  return g;
}
/** Lesene sulla parete di fondo (interno), simmetriche attorno all'asse cx. */
function lesene(cx, xMin, xMax, zFaccia, y0, y1) {
  const L = E.lesena, out = [];
  for (let k = 0; k < 12; k++) for (const s of [-1, 1]) {
    const c = cx + s * L.passo * (k + 0.5);
    if (c - L.larghezza / 2 < xMin + 0.2 || c + L.larghezza / 2 > xMax - 0.2) continue;
    out.push({ c, g: scatola(c - L.larghezza / 2, c + L.larghezza / 2, y0, y1, zFaccia, zFaccia + L.sporgenza) });
  }
  return out;
}

// ---------------------------------------------------------------- centrali
function centralePelton() {
  const P = E.pelton, [x0, x1] = P.x, z0 = P.z[0], z1 = P.z[1], C = P.canale, G = E.gronda;
  const muri = [
    scatola(x0, x0 + W, P.base, P.soffitto, z0, z1),                     // ovest (contro il pendio)
    scatola(x1 - W, x1, P.muroEstBase, P.soffitto, z0, z1),              // est (sul ciglio del serbatoio)
    scatola(x0 + W, x1 - W, P.pavimento, P.soffitto, z0, z0 + W),        // fondo
    scatola(x0 - G, x1 + G, P.soffitto, P.tetto, z0, z1),                // tetto
    ...lesene(VALLE.girantePelton.centro[0], x0 + W, x1 - W, z0 + W, P.pavimento, P.soffitto).map(l => l.g),
  ];
  const pav = [
    scatola(x0, C.x0, P.base, P.pavimento, z0, z1),                      // piano macchine a ovest del pozzo
    scatola(C.x0, x1, P.base, P.pavimento, z0, C.z0),                    // piano del generatore (dietro il canale)
    scatola(C.x0, x1, P.base, C.fondo, C.z0, z1),                        // fondo del pozzo e del canale di scarico
  ];
  const tagli = rettangoli([[x0, C.x0, P.base, P.pavimento], [C.x0, x1, P.base, C.fondo], [x0, x0 + W, P.base, P.soffitto],
                            [x1 - W, x1, P.muroEstBase, P.soffitto], [x0 - G, x1 + G, P.soffitto, P.tetto]]);
  return { muri, pav, tagli };
}
function centraleFrancis() {
  const F = E.francis, [x0, x1] = F.x, z0 = F.z[0], z1 = F.z[1], G = E.gronda, cx = VALLE.giranteFrancis.centro[0];
  const les = lesene(cx, x0 + W, x1 - W, z0 + W, F.terra[1], F.soffitto);
  const muri = [
    scatola(x0, x0 + W, F.base, F.soffitto, z0, z1), scatola(x1 - W, x1, F.base, F.soffitto, z0, z1),
    scatola(x0 + W, x1 - W, F.interrato, F.soffitto, z0, z0 + W),
    scatola(x0 - G, x1 + G, F.soffitto, F.tetto, z0, z1),
    ...les.map(l => l.g),
  ];
  const pav = [scatola(x0, x1, F.base, F.interrato, z0, z1), solaio(x0 + W, x1 - W, z0 + W, z1, F.terra[0], F.terra[1], [F.foro])];
  const argine = scatola(x1 - W, x1, F.argine.y[0], F.argine.y[1], F.argine.z[0], z0);
  const tagli = rettangoli([[x0, x1, F.base, F.interrato], [x0, x1, F.terra[0], F.terra[1]], [x0, x0 + W, F.base, F.soffitto],
                            [x1 - W, x1, F.base, F.soffitto], [x0 - G, x1 + G, F.soffitto, F.tetto]]);
  // pianta delle pareti (sezione orizzontale a YF): U aperta verso il taglio, con le lesene
  const pts = [[x0, 0], [x0, -z0], [x1, -z0], [x1, 0], [x1 - W, 0], [x1 - W, -(z0 + W)]];
  const Lw = E.lesena.larghezza / 2, Ls = E.lesena.sporgenza;
  for (const l of [...les].sort((a, b) => b.c - a.c)) pts.push([l.c + Lw, -(z0 + W)], [l.c + Lw, -(z0 + W + Ls)], [l.c - Lw, -(z0 + W + Ls)], [l.c - Lw, -(z0 + W)]);
  pts.push([x0 + W, -(z0 + W)], [x0 + W, 0]);
  const pianta = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))));
  pianta.rotateX(-Math.PI / 2); pianta.deleteAttribute('uv');
  const piantaTetto = rettangoli([[x0 - G, x1 + G, 0, -z0]], 'y');
  return { muri, pav, argine, tagli, pianta, piantaTetto };
}
function centraleKaplan() {
  const K = E.kaplan, [x0, x1] = K.x, z0 = K.z[0], z1 = K.z[1], G = E.gronda, cx = VALLE.giranteKaplan.centro[0];
  const muri = [
    scatola(x0, x0 + W, K.base, K.soffitto, z0, z1), scatola(x1 - W, x1, K.base, K.soffitto, z0, z1),
    scatola(x0 + W, x1 - W, K.interrato, K.soffitto, z0, z0 + W),
    scatola(x0 - G, x1 + G, K.soffitto, K.tetto, z0, z1),
    ...lesene(cx, x0 + W, x1 - W, z0 + W, K.terra[1], K.soffitto).map(l => l.g),
  ];
  const pav = [
    scatola(x0, x1, K.base, K.interrato, z0, z1),
    solaio(x0 + W, x1 - W, z0 + W, z1, K.terra[0], K.terra[1], [K.foro]),
    solaio(x0 + W, x1 - W, z0 + W, z1, K.medio[0], K.medio[1], [{ c: K.foro.c, r: K.foroMedio }]),
  ];
  // il foro della semi-chiocciola attraversa il taglio: lì il solaio non c'è
  const dz = K.foro.c[1], mezza = Math.sqrt(Math.max(0, K.foro.r * K.foro.r - dz * dz));
  const tagli = rettangoli([[x0, x1, K.base, K.interrato], [x0, K.foro.c[0] - mezza, K.terra[0], K.terra[1]], [K.foro.c[0] + mezza, x1, K.terra[0], K.terra[1]],
                            [x0, x1, K.medio[0], K.medio[1]], [x0, x0 + W, K.base, K.soffitto], [x1 - W, x1, K.base, K.soffitto],
                            [x0 - G, x1 + G, K.soffitto, K.tetto]]);
  return { muri, pav, tagli };
}

// ---------------------------------------------------------------- presa Pelton (camera paratoie, pozzo, casa di manovra)
function presaPelton() {
  const P = E.presa, C = P.camera, Q = P.pozzo, H = P.casa, t = P.parete, zb = C.z;
  const pezzi = [
    scatola(C.x[0] - t, C.x[1] + t, C.y[0] - t, C.y[1] + t, zb - t, zb),            // fondo della camera
    scatola(C.x[0] - t, C.x[0], C.y[0] - t, C.y[1] + t, zb, 0.1),                     // pareti
    scatola(C.x[1], C.x[1] + t, C.y[0] - t, C.y[1] + t, zb, 0.1),
    scatola(C.x[0], C.x[1], C.y[0] - t, C.y[0], zb, 0.1),                             // platea
    scatola(C.x[0], Q.x[0], C.y[1], C.y[1] + t, zb, 0.1), scatola(Q.x[1], C.x[1], C.y[1], C.y[1] + t, zb, 0.1),
    scatola(Q.x[0] - t, Q.x[0], C.y[1], Q.y1, zb, 0.1), scatola(Q.x[1], Q.x[1] + t, C.y[1], Q.y1, zb, 0.1),   // pozzo
    scatola(Q.x[0], Q.x[1], C.y[1], Q.y1, zb - t, zb),
  ];
  const casa = [scatola(H.x[0], H.x[1], H.y[0], H.y[1], H.z[0], H.z[1]),
                scatola(H.x[0] - 0.08, H.x[1] + 0.08, H.y[1], H.y[1] + 0.07, H.z[0] - 0.08, H.z[1])];
  const tagli = rettangoli([[H.x[0], H.x[1], H.y[0], H.y[1]], [H.x[0] - 0.08, H.x[1] + 0.08, H.y[1], H.y[1] + 0.07]]);
  return { pezzi: [...pezzi, ...casa], tagli };
}

// ---------------------------------------------------------------- diga ad arco (spazzata del profilo lungo l'asse)
function geometriaDiga() {
  const D = E.diga, gruppi = profiloDiga();
  const zs = []; for (let z = D.z[0]; z > -26; z -= 0.5) zs.push(z); for (let z = -26; z >= D.z[1] - 1e-9; z -= 1) zs.push(z);
  const parti = [];
  for (const gr of gruppi) {
    const n = gr.length, pos = new Float32Array(zs.length * n * 3), idx = [];
    zs.forEach((z, k) => gr.forEach(([u, y], i) => { const [x, zz] = digaPunto(z, u); pos.set([x, y, zz], (k * n + i) * 3); }));
    for (let k = 0; k < zs.length - 1; k++) for (let i = 0; i < n - 1; i++) {
      const a = k * n + i, b = a + n, c = a + 1, d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    parti.push(g.toNonIndexed());
  }
  // testata posteriore (sul retro del blocco)
  const contorno = []; for (const gr of gruppi) for (let i = 0; i < gr.length - 1; i++) contorno.push(new THREE.Vector2(gr[i][0], gr[i][1]));
  const tri = THREE.ShapeUtils.triangulateShape(contorno, []), zE = zs[zs.length - 1], pos = [];
  for (const [a, b, c] of tri) for (const v of [a, c, b]) { const [x, zz] = digaPunto(zE, contorno[v].x); pos.push(x, contorno[v].y, zz); }
  const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); t.computeVertexNormals(); parti.push(t);
  return mergeGeometries(parti, false);
}

/**
 * Sezione disegnata della diga sul taglio (z = +0,0015): il profilo a z = 0 con il foro della condotta Francis dove
 * il suo asse sta sul piano. Senza, attraverso le retro-facce si vedrebbero i lembi di terreno sotto il piede.
 */
function taglioDiga(curva) {
  const x0 = VALLE.diga.x[0], r = RAGGIO_FRANCIS;
  const cont = []; for (const g of profiloDiga()) for (let i = 0; i < g.length - 1; i++) cont.push(new THREE.Vector2(x0 + g[i][0], g[i][1]));
  const s = new THREE.Shape(cont), alto = [], basso = [], N = 400;
  for (let i = 0; i < N; i++) {
    const p = curva.getPointAt(i / N * 0.4), q = curva.getPointAt((i + 1) / N * 0.4);
    if (Math.abs(p.z) > 0.6 * r) break;
    if (p.x < x0 + digaMonte(p.y) + 0.03) continue;                      // dentro il calcestruzzo, oltre il paramento
    const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    alto.push(new THREE.Vector2(p.x + nx * r, p.y + ny * r)); basso.push(new THREE.Vector2(p.x - nx * r, p.y - ny * r));
  }
  if (alto.length > 2) s.holes.push(new THREE.Path([...basso, ...alto.reverse()]));
  const g = new THREE.ShapeGeometry(s); g.translate(0, 0, Z_CAP); g.deleteAttribute('uv');
  return g;
}

// ---------------------------------------------------------------- traversa Kaplan
function geometriaTraversa() {
  const T = E.traversa, s = new THREE.Shape(profiloTraversa().map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth: T.z[1] - T.z[0], bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, T.z[0]); g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

// ---------------------------------------------------------------- condotte (tubo a parete spessa: esterno, interno, anelli)
function tubo(curva, r, spessore, segmentiPerU = 10, radiali = 20) {
  const L = curva.getLength(), n = Math.max(8, Math.ceil(L * segmentiPerU));
  const fuori = new THREE.TubeGeometry(curva, n, r, radiali, false);
  const dentro = new THREE.TubeGeometry(curva, n, r - spessore, radiali, false);
  // interno: normali verso l'asse, avvolgimento invertito
  const ix = dentro.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const nr = dentro.attributes.normal.array; for (let i = 0; i < nr.length; i++) nr[i] = -nr[i];
  const anelli = [];
  for (const [u, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.RingGeometry(r - spessore, r, radiali);
    const tg = curva.getTangentAt(u).multiplyScalar(s);
    a.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg));
    a.translate(...curva.getPointAt(u).toArray());
    anelli.push(a);
  }
  const parti = [fuori, dentro, ...anelli]; parti.forEach(g => g.deleteAttribute('uv'));
  return unisci(parti);
}
const curvaDa = pts => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');

/** Blocchi di ancoraggio della condotta Pelton (ogni 10 u sul pendio), appoggiati al profilo e attraversati dal tubo. */
function ancoraggi() {
  const A = E.ancoraggi, CPL = VALLE.condottaPelton, out = [];
  for (let x = -170; x <= -100 + 1e-6; x += A.passo) {
    const y = fondoValle(x) + CPL.sopraFondo, dy = (fondoValle(x + 0.05) - fondoValle(x - 0.05)) / 0.1;
    const a = Math.atan(dy), cosA = Math.cos(a);
    const giu = -CPL.sopraFondo * cosA + 0.004, su = CPL.raggio + A.sopra;     // fondo appena sopra il terreno, cima sopra il tubo
    const g = new THREE.BoxGeometry(A.lungo, su - giu, 2 * A.z).toNonIndexed();
    g.translate(0, (su + giu) / 2, 0); g.rotateZ(a); g.translate(x, y, 0); g.deleteAttribute('uv');
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------- tutto
/**
 * Costruisce le geometrie degli edifici. Restituisce gruppi di geometrie per materiale e le curve delle condotte.
 * (Le mesh si assemblano in valle.js, che conosce materiali e piani.)
 */
export function costruisciEdifici() {
  const pe = centralePelton(), fr = centraleFrancis(), ka = centraleKaplan(), pr = presaPelton();
  const curvaPelton = curvaDa(puntiCondottaPelton());
  const cf = puntiCondottaFrancis(), curvaFrancis = curvaDa(cf.fuori), curvaFrancisDentro = curvaDa(cf.dentro);
  const CFR = VALLE.condottaFrancis;
  // presa Francis sul paramento di monte, blocco al piede della diga, pila sotto il tubo verso la sala
  const presaF = scatola(CFR.da[0] - 0.25, digaPunto(0, 0)[0] + 0.15, CFR.da[1] - 0.28, CFR.da[1] + 0.28, -0.4, 0.4);
  const bloccoPiede = scatola(-39.3, -38.0, 1.9, 2.62, -1.0, -0.2);
  const pila = scatola(-37.66, -37.54, 1.0, CFR.a[1] - RAGGIO_FRANCIS + 0.01, -0.9, -0.7);
  return {
    // bianco del plastico tagliato da Z0
    edifici: unisci([...pe.muri, ...ka.muri, ...pr.pezzi, fr.argine, presaF, bloccoPiede, pila, geometriaTraversa(), ...ancoraggi()]),
    edificiF: unisci(fr.muri),                     // Francis: anche YF
    diga: geometriaDiga(),
    pavimenti: unisci([...pe.pav, ...fr.pav, ...ka.pav]),
    tagli: unisci([pe.tagli, ka.tagli, pr.tagli, taglioDiga(curvaFrancis)]),
    tagliF: fr.tagli,
    piantaF: fr.pianta, piantaTettoF: fr.piantaTetto,
    condottaPelton: tubo(curvaPelton, RAGGIO_PELTON, 0.005, 10, 18),
    condottaFrancis: tubo(curvaFrancis, RAGGIO_FRANCIS, 0.009, 12, 24),
    condottaFrancisDentro: tubo(curvaFrancisDentro, RAGGIO_FRANCIS, 0.009, 12, 24),
    curvaPelton, curvaFrancis,
  };
}

/** Plafoniere lineari a filo soffitto, due per sala (sulle posizioni delle RectAreaLight di config). */
export function geometriaPlafoniere(sala) {
  const R = VALLE.luci.rect, [dz, dx] = R.dim, parti = [];
  for (const [x, y, z] of R.sale[sala]) parti.push(scatola(x - dx / 2 - 0.01, x + dx / 2 + 0.01, y, y + 0.02, z - dz / 2 - 0.006, z + dz / 2 + 0.006));
  return unisci(parti);
}
export { digaAsse };
