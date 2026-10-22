// =============================================================================
// ERI v2 · idro/francis-forme.js — forme della turbina Francis (file privato di idro/francis.js)
// Proprietario: [VALLE]. Si importa SOLO da idro/francis.js. Niente ctx: solo geometrie, in METRI, attorno al centro
// della girante (y = piano medio del distributore, asse verticale; x verso est, z verso il taglio; angolo θ da +z
// verso +x, cioè antiorario visto dall'alto: è il verso dell'acqua nella chiocciola e della girante).
//
// Disegno (DESIGN §6.7, §3.6, App. B; config.VALLE.giranteFrancis), da modello di showroom: lamiere con spessore vero
// (così ogni taglio mostra la parete campita e, a parte, la superficie del canale: le funzioni restituiscono le parti
// per materiale, { cassa, interno, dettagli, cemento }), spigoli netti, profili alari, flange e bulloni.
//  - chiocciola: spazzata propria su 345° (mezzeria 2,6 → 1,7 m, sezione 0,775·√(1 − 0,9t) m), aperta verso l'anello
//    portante, chiusa da un fondello; becco che chiude il canale fino all'imbocco;
//  - anelli superiore e inferiore (portante + distributore), il bordo esterno segue la chiocciola;
//  - 20 pale fisse e 20 pale direttrici (istanziate: perno, leva), anello di regolazione, due servomotori;
//  - girante: corona e fascia al tornio, 15 pale a doppio foglio (avvolgimento 80° al mozzo, a S), ogiva, flangia;
//  - coperchio, cuscinetto, albero con giunto, generatore su sei montanti, sei montanti sotto l'anello;
//  - tubo di aspirazione: cono, gomito verso +x nell'interrato, diffusore fino al muro; collare sul solaio;
//  - tubo d'ingresso a S dalla condotta, valvola sferica, flange, basamenti in calcestruzzo.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE, UNITA } from '../config.js';
import { EDIFICI, RAGGIO_FRANCIS } from './valle-forme.js';

const TAU = Math.PI * 2, RAD = Math.PI / 180;
const GF = VALLE.giranteFrancis, CH = GF.chiocciola, C0 = GF.centro, SC = UNITA.scalaMeccanica;
const lerp = (a, b, t) => a + (b - a) * t;
const liscio = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Da coordinata mondo (u) a metri locali attorno al centro della girante (asse i: 0 x, 1 y, 2 z). */
const locale = (v, i) => (v - C0[i]) / SC;

// TARATURA: proporre in config (VALLE.giranteFrancis.forme) — misure in metri che config non fissa (DESIGN §6.7 ne dà
// solo una parte: raggi delle pale fisse e direttrici, 28° di corsa, aspirazione da 0,63 a 1,2 m)
export const FORME = {
  h: 0.12,                  // metà altezza del canale del distributore (b0 = 0,24 m)
  piatto: 0.08,             // spessore degli anelli superiore e inferiore
  rAnello: 0.83,            // bordo interno degli anelli (3 cm di gioco sulla girante)
  parete: 0.10,             // lamiera di chiocciola e tubi (stilizzata: ≈ 6 px a V4.6, la campitura si legge)
  avant: { r: 1.25, corda: 0.30, spessore: 0.075, curva: 0.03, angolo: 38, fase: 0.5 },   // pale fisse (gradi sulla tangente)
  direttrici: { r: 1.0, corda: 0.34, spessore: 0.055, curva: 0.02, perno: 0.4, chiuso: 6, corsa: 28 },
  girante: {
    mozzo: [[0.50, 0.125], [0.24, 0.02], [0.19, -0.34]],   // filo della corona dopo l'ingresso (Bézier, r, y)
    fascia: [[0.70, -0.125], [0.63, -0.22]],                // filo della fascia (l'ultimo punto è D2/2 a −0,50)
    uscita: -0.50, ogiva: -0.62, avvolgimento: [80, 55], spessore: 0.032, fasciaSp: 0.035,
  },
  coperchio: { r: 1.15, bulloni: 24 },
  generatore: { y: [1.6, 3.6], r: 1.85 },
  montanti: { sotto: 1.30, sopra: [1.40, 1.62], n: 6 },
  aspirazione: { y0: -0.55, curva: 2.4, sopraInterrato: 1.8, r: [0.66, 0.95, 1.05, 1.2] },
  ingresso: { valvola: [-5.6, -3.4] },     // x (m) della valvola sferica; la S va dalla condotta alla valvola
};
const F = FORME;
const R1 = GF.D1M / 2, R2 = GF.D2M / 2;
// quote dell'edificio (valle-forme), in metri locali
export const SALA = {
  pavimento: locale(EDIFICI.francis.terra[1], 1),                       // −10: piano di calpestio
  interrato: locale(EDIFICI.francis.interrato, 1),                      // −18: pavimento dell'interrato
  muroEst: locale(EDIFICI.francis.x[1] - EDIFICI.muro, 0),               // 38,8: faccia interna del muro est
  foro: EDIFICI.francis.foro.r / SC,                                     // 1,7: foro del solaio
  condotta: [locale(VALLE.condottaFrancis.a[0], 0), locale(VALLE.condottaFrancis.a[1], 1), locale(VALLE.condottaFrancis.a[2], 2)],
  rCondotta: RAGGIO_FRANCIS / SC,                                        // 0,775: raggio esterno della condotta
};

// ---------------------------------------------------------------- geometria della chiocciola (pura)
const TE = CH.gradi * RAD;
export const chiocciolaR = t => CH.r0M + (CH.r1M - CH.r0M) * t;                       // raggio di mezzeria
export const chiocciolaSez = t => CH.sezioneM * Math.sqrt(Math.max(0.01, 1 - 0.9 * t)); // raggio esterno della sezione
const sezDentro = t => chiocciolaSez(t) - F.parete;
/**
 * Bordo esterno degli anelli all'angolo θ: dove la lamiera interna incontra il canale. Nel becco (oltre TE) va verso
 * la faccia interna del tubo d'ingresso, così il becco si salda al tubo senza entrare nel suo canale.
 */
function bordoAnello(th) {
  const b = t => chiocciolaR(t) - Math.sqrt(sezDentro(t) ** 2 - F.h * F.h);
  if (th <= TE) return b(th / TE);
  return lerp(b(1), CH.r0M - chiocciolaSez(0), liscio(TE, TAU, th));
}
/** Faccia esterna del becco: piena fino dentro la lamiera del tubo d'ingresso (niente vuoti fra fondello e imbocco). */
const beccoFuori = th => Math.max(bordoAnello(th) + F.parete, CH.r0M - chiocciolaSez(0) + 0.058);

// ---------------------------------------------------------------- utilità
/** Non indicizzata, con posizione, normale e uv: le parti si uniscono per materiale. */
function pulisci(g) {
  const h = g.index ? g.toNonIndexed() : g;
  if (h !== g) g.dispose();
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') h.deleteAttribute(k);
  return h;
}
/** Unisce (e libera) una lista di geometrie. */
export function unisci(lista) {
  const parti = lista.filter(Boolean).map(pulisci);
  const g = mergeGeometries(parti, false);
  parti.forEach(p => p.dispose());
  return g;
}

/**
 * Griglia di nI × nJ celle da punto(i, j, out). Normali: normale(i, j, out) se data, altrimenti calcolate.
 * L'avvolgimento si sceglie da solo, concorde con le normali date o con verso(i, j, out): così la faccia "davanti" è
 * quella giusta per gl_FrontFacing (la campitura delle sezioni colora solo le retro-facce).
 */
function griglia(nI, nJ, punto, { normale = null, verso = null, uv = null } = {}) {
  const nv = (nI + 1) * (nJ + 1), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
  const p = [0, 0, 0], n = [0, 0, 0], q = [0, 0];
  for (let i = 0; i <= nI; i++) for (let j = 0; j <= nJ; j++) {
    const k = i * (nJ + 1) + j;
    punto(i, j, p); pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    if (normale || verso) {
      (normale || verso)(i, j, n);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      nor[k * 3] = n[0] / l; nor[k * 3 + 1] = n[1] / l; nor[k * 3 + 2] = n[2] / l;
    }
    if (uv) uv(i, j, q); else { q[0] = i / nI; q[1] = j / nJ; }
    uvs[k * 2] = q[0]; uvs[k * 2 + 1] = q[1];
  }
  // verso dell'avvolgimento: somma dei prodotti vettoriali di una riga di celle contro le normali volute
  let somma = 0;
  const ci = Math.floor(nI / 2);
  for (let j = 0; j < nJ; j++) {
    const a = ci * (nJ + 1) + j, b = a + nJ + 1, d = a + 1;
    const e1x = pos[b * 3] - pos[a * 3], e1y = pos[b * 3 + 1] - pos[a * 3 + 1], e1z = pos[b * 3 + 2] - pos[a * 3 + 2];
    const e2x = pos[d * 3] - pos[a * 3], e2y = pos[d * 3 + 1] - pos[a * 3 + 1], e2z = pos[d * 3 + 2] - pos[a * 3 + 2];
    somma += (e1y * e2z - e1z * e2y) * nor[a * 3] + (e1z * e2x - e1x * e2z) * nor[a * 3 + 1] + (e1x * e2y - e1y * e2x) * nor[a * 3 + 2];
  }
  const inverti = somma < 0, idx = [];
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    const a = i * (nJ + 1) + j, b = a + nJ + 1, c = b + 1, d = a + 1;
    if (inverti) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  if (normale) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
  return g;
}

/** Triangoli piatti (array di vertici [x,y,z] a terne), ciascuno girato verso la normale data. */
function triangoli(vertici, normale) {
  const n = vertici.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) {
    let [a, b, c] = [vertici[t], vertici[t + 1], vertici[t + 2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * normale[0] + cr[1] * normale[1] + cr[2] * normale[2] < 0) [b, c] = [c, b];
    [a, b, c].forEach((v, k) => { pos.set(v, (t + k) * 3); nor.set(normale, (t + k) * 3); });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/**
 * Tornio: gruppi di profili [r, y], ognuno liscio (spigolo vivo fra un gruppo e l'altro), percorsi in senso
 * antiorario nel piano (r, y) con il solido a sinistra → normali verso l'esterno. uv = (giro, lunghezza del profilo).
 */
export function tornio(gruppi, n = 96) {
  return unisci(gruppi.map(pr => {
    const m = pr.length, nr = new Float32Array(m), ny = new Float32Array(m), s = new Float32Array(m);
    for (let j = 0; j < m; j++) {
      const p0 = pr[Math.max(0, j - 1)], p1 = pr[Math.min(m - 1, j + 1)];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      nr[j] = dy / l; ny[j] = -dx / l;
      if (j) s[j] = s[j - 1] + Math.hypot(pr[j][0] - pr[j - 1][0], pr[j][1] - pr[j - 1][1]);
    }
    return griglia(n, m - 1,
      (i, j, o) => { const a = TAU * i / n; o[0] = pr[j][0] * Math.sin(a); o[1] = pr[j][1]; o[2] = pr[j][0] * Math.cos(a); },
      { normale: (i, j, o) => { const a = TAU * i / n; o[0] = nr[j] * Math.sin(a); o[1] = ny[j]; o[2] = nr[j] * Math.cos(a); },
        uv: (i, j, o) => { o[0] = i / n; o[1] = s[j]; } });
  }));
}
/** Profilo rettangolare per il tornio (anello pieno da r0 a r1, quote y0 → y1), con smusso opzionale. */
const rettangolo = (r0, r1, y0, y1) => [[[r0, y1], [r0, y0]], [[r0, y0], [r1, y0]], [[r1, y0], [r1, y1]], [[r1, y1], [r0, y1]]];

const bez3 = (P, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
};
const campiona = (P, n) => Array.from({ length: n + 1 }, (_, i) => bez3(P, i / n));

/** Profilo alare NACA a 4 cifre (bordo d'uscita chiuso), corda lungo x da 0 (attacco) a c: contorno antiorario. */
function profiloAla(corda, spessore, curva, n = 22) {
  const t = spessore / corda, pts = [];
  const yt = x => 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const yc = x => curva * (x < 0.4 ? (0.8 * x - x * x) / 0.16 : (0.2 + 0.8 * x - x * x) / 0.36);
  for (let k = n; k >= 0; k--) { const x = (1 - Math.cos(Math.PI * k / n)) / 2; pts.push([x * corda, (yc(x) + yt(x)) * corda]); }
  for (let k = 1; k < n; k++) { const x = (1 - Math.cos(Math.PI * k / n)) / 2; pts.push([x * corda, (yc(x) - yt(x)) * corda]); }
  return pts;
}
/** Prisma verticale da un contorno 2D antiorario [x, y] → (x, ·, −y): pareti a normali lisce, tappi piatti. */
function prisma(cont, y0, y1) {
  const m = cont.length, nx = new Float32Array(m), nz = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    const p0 = cont[(k - 1 + m) % m], p1 = cont[(k + 1) % m], dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
    nx[k] = dy / l; nz[k] = dx / l;                  // normale 2D (dy, −dx) → 3D (dy, 0, dx)
  }
  const pareti = griglia(m, 1, (i, j, o) => { const c = cont[i % m]; o[0] = c[0]; o[1] = j ? y1 : y0; o[2] = -c[1]; },
    { normale: (i, j, o) => { o[0] = nx[i % m]; o[1] = 0; o[2] = nz[i % m]; } });
  const tri = THREE.ShapeUtils.triangulateShape(cont.map(c => new THREE.Vector2(c[0], c[1])), []);
  const tappo = (y, s) => triangoli(tri.flat().map(k => [cont[k][0], y, -cont[k][1]]), [0, s, 0]);
  return unisci([pareti, tappo(y1, 1), tappo(y0, -1)]);
}
/** Prisma a profilo alare con il perno all'origine (frazione 'perno' della corda), corda lungo +x. */
const prismaAla = (A, y0, y1, perno = 0.5) => prisma(profiloAla(A.corda, A.spessore, A.curva).map(([x, y]) => [x - perno * A.corda, y]), y0, y1);

/** Copia di g ruotata di a attorno a y e spostata in (x, y, z). */
function posa(g, a, x, y, z) { const c = g.clone(); c.rotateY(a); c.translate(x, y, z); return c; }
/** Cilindro tra due punti (raggi r0 al primo, r1 al secondo). */
function asta(p0, p1, r0, r1, seg = 16) {
  const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(p0[0], p0[1], p0[2]);
  return g;
}
/** Scatola fra due angoli. */
function scatola(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
/** Corona di n bulloni a testa esagonale sul cerchio r, quota y, rivolti lungo +y (poi orientabili). */
function bulloni(n, r, y, rb = 0.022, hb = 0.022, fase = 0) {
  const b = new THREE.CylinderGeometry(rb, rb, hb, 6); b.translate(0, y + hb / 2, 0);
  const out = [];
  for (let k = 0; k < n; k++) { const a = TAU * (k + fase) / n; out.push(posa(b, a, r * Math.sin(a), 0, r * Math.cos(a))); }
  b.dispose();
  return unisci(out);
}
/** Porta una geometria costruita attorno a +y sull'asse 'dir' (vettore), con origine in p. */
function orienta(g, dir, p) {
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()));
  g.translate(p[0], p[1], p[2]);
  return g;
}

/**
 * Tubo a parete spessa lungo una curva (lunghezza d'arco): esterno (normali fuori), interno (normali verso l'asse),
 * teste ad anello. raggio(s) esterno, s ∈ [0, 1]. Restituisce { fuori, dentro }: la superficie interna è il canale
 * dell'acqua e va col materiale "interno".
 */
function tubo(curva, raggio, spessore, n, radiali = 40, teste = [true, true]) {
  const fr = curva.computeFrenetFrames(n, false), P = [];
  for (let i = 0; i <= n; i++) P.push(curva.getPointAt(i / n));
  const N = fr.normals, B = fr.binormals, T = fr.tangents;
  const sup = dentro => griglia(n, radiali, (i, j, o) => {
    const a = TAU * j / radiali, c = Math.cos(a), s = Math.sin(a), r = raggio(i / n) - (dentro ? spessore : 0);
    o[0] = P[i].x + r * (c * N[i].x + s * B[i].x); o[1] = P[i].y + r * (c * N[i].y + s * B[i].y); o[2] = P[i].z + r * (c * N[i].z + s * B[i].z);
  }, { normale: (i, j, o) => {
    const a = TAU * j / radiali, c = Math.cos(a), s = Math.sin(a), k = dentro ? -1 : 1;
    o[0] = k * (c * N[i].x + s * B[i].x); o[1] = k * (c * N[i].y + s * B[i].y); o[2] = k * (c * N[i].z + s * B[i].z);
  } });
  const parti = [sup(false)];
  for (const [i, k] of [[0, -1], [n, 1]]) {
    if (!teste[k < 0 ? 0 : 1]) continue;
    const r = raggio(i / n);
    parti.push(griglia(radiali, 1, (jj, m, o) => {
      const a = TAU * jj / radiali, c = Math.cos(a), s = Math.sin(a), rr = m ? r : r - spessore;
      o[0] = P[i].x + rr * (c * N[i].x + s * B[i].x); o[1] = P[i].y + rr * (c * N[i].y + s * B[i].y); o[2] = P[i].z + rr * (c * N[i].z + s * B[i].z);
    }, { normale: (jj, m, o) => { o[0] = k * T[i].x; o[1] = k * T[i].y; o[2] = k * T[i].z; } }));
  }
  return { fuori: unisci(parti), dentro: sup(true) };
}
/** Flangia (anello pieno da r0 a r1, spessore L) sul punto s di una curva, ortogonale alla tangente. */
function flangia(curva, s, r0, r1, L, nb = 0) {
  const g = tornio(rettangolo(r0, r1, -L / 2, L / 2), 64);
  const parti = [g];
  if (nb) parti.push(bulloni(nb, (r0 + r1) / 2 + 0.02, L / 2, 0.026, 0.026), bulloni(nb, (r0 + r1) / 2 + 0.02, -L / 2 - 0.026, 0.026, 0.026));
  return orienta(unisci(parti), curva.getTangentAt(s).toArray(), curva.getPointAt(s).toArray());
}

// ================================================================ parti
/**
 * Chiocciola, anelli, becco: la cassa a spirale (DESIGN §6.7). Restituisce una geometria (materiale "cassa").
 * Sezione all'angolo θ: cerchio di centro (R(t), 0) e raggio esterno r(t), parete F.parete, aperta verso l'asse fra
 * gli anelli (y = ±h). La lamiera esterna arriva sul dorso degli anelli, l'interna sul loro bordo.
 */
export function chiocciola() {
  const h = F.h, tp = F.piatto, w = F.parete, dte = w / chiocciolaR(1);
  const nT = 150, nP = 48;
  const ang = (fuori, i) => (fuori ? TE + dte : TE) * i / nT;
  const sezione = (fuori, i, j, o, nor) => {
    const th = ang(fuori, i), t = th / TE, r = fuori ? chiocciolaSez(t) : sezDentro(t);
    const ps = Math.PI - Math.asin(Math.min(1, (fuori ? h + tp : h) / r)), p = -ps + 2 * ps * j / nP;
    if (nor) { const k = fuori ? 1 : -1; o[0] = k * Math.cos(p) * Math.sin(th); o[1] = k * Math.sin(p); o[2] = k * Math.cos(p) * Math.cos(th); return; }
    const rho = chiocciolaR(t) + r * Math.cos(p);
    o[0] = rho * Math.sin(th); o[1] = r * Math.sin(p); o[2] = rho * Math.cos(th);
  };
  const cassa = [], interno = [];      // esterno nello stile della macchina, canale dell'acqua scuro
  for (const fuori of [true, false]) {
    (fuori ? cassa : interno).push(griglia(nT, nP, (i, j, o) => sezione(fuori, i, j, o, false),
      { normale: (i, j, o) => sezione(fuori, i, j, o, true), uv: (i, j, o) => { o[0] = ang(fuori, i); o[1] = j / nP; } }));
  }
  // fondello: due facce a "D" (interna a TE verso il canale, esterna a TE + dte verso fuori)
  const dConFondo = (th, r, yb, normale) => {
    const Rm = chiocciolaR(th / TE), ps = Math.PI - Math.asin(Math.min(1, yb / r)), M = 40, v = [];
    const pt = (rho, y) => [rho * Math.sin(th), y, rho * Math.cos(th)];
    const c = pt(Rm, 0);
    for (let k = 0; k < M; k++) {
      const a0 = -ps + 2 * ps * k / M, a1 = -ps + 2 * ps * (k + 1) / M;
      v.push(c, pt(Rm + r * Math.cos(a0), r * Math.sin(a0)), pt(Rm + r * Math.cos(a1), r * Math.sin(a1)));
    }
    v.push(c, pt(Rm + r * Math.cos(ps), r * Math.sin(ps)), pt(Rm + r * Math.cos(-ps), r * Math.sin(-ps)));
    return triangoli(v, normale);
  };
  interno.push(dConFondo(TE, sezDentro(1), h, [-Math.cos(TE), 0, Math.sin(TE)]));
  const te2 = TE + dte;
  cassa.push(dConFondo(te2, chiocciolaSez(te2 / TE), h + tp, [Math.cos(te2), 0, -Math.sin(te2)]));

  // anelli superiore e inferiore: corona piena da rAnello al bordo che segue la chiocciola; le facce verso il canale
  // (sotto il superiore, sopra l'inferiore, bordo verso la girante) sono "interno"
  const nA = 288;
  for (const [y0, y1, sopra] of [[h, h + tp, true], [-h - tp, -h, false]]) {
    const pt = (i, r, y, o) => { const a = TAU * i / nA; o[0] = r * Math.sin(a); o[1] = y; o[2] = r * Math.cos(a); };
    const rad = (i, k, o) => { const a = TAU * i / nA; o[0] = k * Math.sin(a); o[1] = 0; o[2] = k * Math.cos(a); };
    (sopra ? cassa : interno).push(griglia(nA, 1, (i, j, o) => pt(i, j ? bordoAnello(TAU * i / nA) : F.rAnello, y1, o), { normale: (i, j, o) => { o[0] = 0; o[1] = 1; o[2] = 0; } }));
    (sopra ? interno : cassa).push(griglia(nA, 1, (i, j, o) => pt(i, j ? bordoAnello(TAU * i / nA) : F.rAnello, y0, o), { normale: (i, j, o) => { o[0] = 0; o[1] = -1; o[2] = 0; } }));
    interno.push(griglia(nA, 1, (i, j, o) => pt(i, F.rAnello, j ? y1 : y0, o), { normale: (i, j, o) => rad(i, -1, o) }));
    cassa.push(griglia(nA, 1, (i, j, o) => pt(i, bordoAnello(TAU * i / nA), j ? y1 : y0, o), { normale: (i, j, o) => rad(i, 1, o) }));
  }
  // becco: parete che chiude il canale fra il fondello e l'imbocco (θ da TE a 360°)
  const nB = 24, yb = h + tp;
  const thB = i => TE + (TAU - TE) * i / nB;
  for (const k of [-1, 1]) {
    (k < 0 ? interno : cassa).push(griglia(nB, 1, (i, j, o) => { const a = thB(i), r = k < 0 ? bordoAnello(a) : beccoFuori(a); o[0] = r * Math.sin(a); o[1] = j ? yb : -yb; o[2] = r * Math.cos(a); },
      { normale: (i, j, o) => { const a = thB(i); o[0] = k * Math.sin(a); o[1] = 0; o[2] = k * Math.cos(a); } }));
  }
  for (const s of [1, -1]) {
    cassa.push(griglia(nB, 1, (i, j, o) => { const a = thB(i), r = j ? beccoFuori(a) : bordoAnello(a); o[0] = r * Math.sin(a); o[1] = s * yb; o[2] = r * Math.cos(a); },
      { normale: (i, j, o) => { o[0] = 0; o[1] = s; o[2] = 0; } }));
  }
  return { cassa: unisci(cassa), interno: unisci(interno) };
}

/** Pale fisse dell'avantdistributore (20, profilo alare), fra gli anelli. */
export function paleFisse() {
  const A = F.avant, N = GF.avantdistributore;
  const base = prismaAla(A, -F.h - 0.01, F.h + 0.01, 0.5), out = [];
  for (let k = 0; k < N; k++) {
    const th = TAU * (k + A.fase) / N;
    out.push(posa(base, th + A.angolo * RAD, A.r * Math.sin(th), 0, A.r * Math.cos(th)));
  }
  base.dispose();
  return unisci(out);
}

/**
 * Pala direttrice nel proprio riferimento (perno all'origine, corda lungo +x, +z ≈ verso l'esterno): corpo e perno
 * ("cassa"), leva e testa ("dettagli"). La posa (θ + apertura) è della matrice d'istanza.
 */
export function palaDirettrice() {
  const D = F.direttrici, h = F.h;
  const corpo = unisci([prismaAla(D, -h - 0.005, h + 0.005, D.perno), asta([0, -h - 0.07, 0], [0, 0.46, 0], 0.028, 0.028, 14)]);
  // leva: verso l'anello di regolazione (indietro e in fuori)
  const dir = [-0.45, 0, 0.89], L = 0.21, a = Math.atan2(-dir[2], dir[0]);
  const barra = scatola(0, L, 0.405, 0.44, -0.022, 0.022); barra.rotateY(a);
  const occhio = asta([dir[0] * L, 0.40, dir[2] * L], [dir[0] * L, 0.445, dir[2] * L], 0.03, 0.03, 12);
  const mozzo = asta([0, 0.40, 0], [0, 0.45, 0], 0.045, 0.045, 14);
  return { corpo, leva: unisci([barra, occhio, mozzo]) };
}
/** Raggio, angolo e posa d'istanza della pala direttrice k con apertura a (0..1). */
export function posaDirettrice(k, a, m) {
  const D = F.direttrici, th = TAU * k / GF.direttrici, phi = (D.chiuso + D.corsa * a) * RAD;
  m.makeRotationY(th + phi);
  m.setPosition(D.r * Math.sin(th), 0, D.r * Math.cos(th));
  return m;
}

/** Girante (inox): corona con ogiva e flangia, fascia, 15 pale a doppio foglio, bulloni della flangia. */
export function girante() {
  const G = F.girante, h = F.h;
  const PC = [[R1, h], ...G.mozzo], PB = [[R1, -h], ...G.fascia, [R2, G.uscita]];
  const C = t => bez3(PC, t), B = t => bez3(PB, t);
  // corona: ogiva, filo del mozzo (dall'uscita all'ingresso), bordo, smusso, cielo leggermente conico, flangia
  const fine = C(1), ogiva = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; ogiva.push([fine[0] * Math.sin(a), fine[1] + (G.ogiva - fine[1]) * Math.cos(a)]); }
  const filo = campiona(PC, 28).reverse();
  const yb = h + 0.045, yc = h + 0.06, yt = h + 0.19;
  const corona = tornio([
    [...ogiva, ...filo.slice(1)],
    [[R1, h], [R1, yb]], [[R1, yb], [R1 - 0.015, yc]],
    [[R1 - 0.015, yc], [0.62, h + 0.095], [0.46, h + 0.125], [0.34, h + 0.14]],   // cielo bombato: il riflesso sfuma
    [[0.34, h + 0.14], [0.32, h + 0.15]], [[0.32, h + 0.15], [0.32, yt]], [[0.32, yt], [0, yt]],
  ], 160);
  // fascia: filo interno (dall'ingresso all'uscita), labbro d'uscita, esterno parallelo, testa d'ingresso
  const dentro = campiona(PB, 28);
  const fuori = dentro.map((p, i) => {
    const q0 = dentro[Math.max(0, i - 1)], q1 = dentro[Math.min(dentro.length - 1, i + 1)];
    const dx = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - dy / l * G.fasciaSp, p[1] + dx / l * G.fasciaSp];
  });
  const ult = dentro.length - 1;
  const fascia = tornio([dentro, [dentro[ult], fuori[ult]], [...fuori].reverse(), [fuori[0], dentro[0]]], 160);
  // pale: superficie rigata fra il filo della corona e quello della fascia, avvolta all'indietro (a S), due fogli;
  // v appena oltre 0 e 1: la pala entra di 1–2 cm nella corona e nella fascia (incastro senza fessure)
  const [wH, wB] = G.avvolgimento.map(g => g * RAD), N = GF.pale, nu = 30, nv = 10, est = 0.05;
  const avv = u => 0.3 * u + 0.7 * u * u * (3 - 2 * u);
  const sp = u => G.spessore * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.8);
  const pale = [];
  for (let k = 0; k < N; k++) for (const s of [1, -1]) {
    const th0 = TAU * k / N;
    const punto = (i, j, o, dth = 0) => {
      const u = i / nu, v = lerp(-est, 1 + est, j / nv), c = C(u), b = B(u);
      const r = lerp(c[0], b[0], v), y = lerp(c[1], b[1], v);
      const th = th0 - lerp(wH, wB, v) * avv(u) + s * 0.5 * sp(u) / Math.max(r, 0.05) + dth;
      o[0] = r * Math.sin(th); o[1] = y; o[2] = r * Math.cos(th);
    };
    pale.push(griglia(nu, nv, punto, {
      verso: (i, j, o) => { const p = [0, 0, 0]; punto(i, j, p); const a = Math.atan2(p[0], p[2]); o[0] = s * Math.cos(a); o[1] = 0; o[2] = -s * Math.sin(a); },
      uv: (i, j, o) => { o[0] = i / nu; o[1] = j / nv; },
    }));
  }
  const flangia = bulloni(12, 0.24, yt, 0.024, 0.03, 0.5);
  // due finiture dello stesso inox: satinata per corona, fascia e flangia, lucida per le pale
  return { satinata: unisci([corona, fascia, flangia]), lucida: unisci(pale) };
}

/** Albero con giunto e bulloni (gira con la girante). */
export function albero() {
  const y0 = F.h + 0.19, y1 = F.generatore.y[0] + 0.15;     // dalla flangia della girante al generatore
  return unisci([
    tornio([[[0, y0], [0.12, y0]], [[0.12, y0], [0.12, y1]], [[0.12, y1], [0, y1]]], 48),
    tornio(rettangolo(0.12, 0.29, 1.00, 1.10), 64), bulloni(8, 0.225, 1.10, 0.022, 0.025),
  ]);
}

/** Coperchio, cuscinetto, anello di regolazione, servomotori: parte "cassa" e parte "dettagli". */
export function coperchio() {
  const R = F.coperchio.r;
  const cassa = [
    tornio([
      [[0.14, 0.35], [0.40, 0.35]], [[0.40, 0.35], [0.42, 0.27]], [[0.42, 0.27], [0.83, 0.27]], [[0.83, 0.27], [0.83, 0.20]],
      [[0.83, 0.20], [R, 0.20]], [[R, 0.20], [R, 0.30]], [[R, 0.30], [R - 0.05, 0.34]], [[R - 0.05, 0.34], [0.62, 0.40]],
      [[0.62, 0.40], [0.42, 0.52]], [[0.42, 0.52], [0.14, 0.52]], [[0.14, 0.52], [0.14, 0.35]],
    ], 128),
    // cuscinetto di guida della turbina
    tornio([[[0.14, 0.52], [0.30, 0.52]], [[0.30, 0.52], [0.30, 0.68]], [[0.30, 0.68], [0.27, 0.72]], [[0.27, 0.72], [0.14, 0.72]], [[0.14, 0.72], [0.14, 0.52]]], 64),
  ];
  const dettagli = [
    bulloni(F.coperchio.bulloni, R - 0.04, 0.30, 0.024, 0.026),
    tornio(rettangolo(1.15, 1.22, 0.36, 0.40), 128),        // anello di regolazione (sotto le leve)
  ];
  // due servomotori tangenziali sul coperchio (θ = 90° e 270°), con stelo verso l'anello
  for (const th of [Math.PI / 2, -Math.PI / 2]) {
    const cil = tornio([[[0, -0.5], [0.11, -0.5]], [[0.11, -0.5], [0.11, 0.42]], [[0.11, 0.42], [0.075, 0.47]], [[0.075, 0.47], [0, 0.47]]], 32);
    const stelo = asta([0, 0.47, 0], [0, 0.82, 0], 0.035, 0.035, 12);
    const s = unisci([cil, stelo]); s.rotateZ(-Math.PI / 2);            // asse lungo +x locale
    const sup = scatola(-0.42, -0.30, -0.16, 0.0, -0.08, 0.08);         // staffa sull'anello superiore
    const g = unisci([s, sup]); g.translate(-0.1, 0.36, 1.38);
    g.rotateY(th);
    dettagli.push(g);
  }
  return { cassa: unisci(cassa), dettagli: unisci(dettagli) };
}

/** Generatore (tamburo liscio, cupola, filetti); montanti sopra e sotto l'anello. Parte "cassa" e parte "dettagli". */
export function generatore() {
  const G = F.generatore, [ya, yb] = G.y, R = G.r, M = F.montanti;
  const cassa = tornio([
    [[0, ya + 0.15], [0.35, ya + 0.15]], [[0.35, ya + 0.15], [0.35, ya]], [[0.35, ya], [R - 0.05, ya]], [[R - 0.05, ya], [R, ya + 0.05]],
    [[R, ya + 0.05], [R, yb - 0.15]], [[R, yb - 0.15], [R - 0.05, yb]], [[R - 0.05, yb], [0.95, yb]],
    [[0.95, yb], [0.80, yb + 0.12], [0.55, yb + 0.26], [0.28, yb + 0.33], [0, yb + 0.35]],
  ], 128);
  // pochi segni netti: flangia di base, due filetti sul tamburo, anello alla base della cupola
  const det = [tornio(rettangolo(R - 0.02, R + 0.10, ya, ya + 0.08), 128),
               tornio(rettangolo(R - 0.01, R + 0.025, ya + 0.62, ya + 0.66), 128), tornio(rettangolo(R - 0.01, R + 0.025, ya + 0.72, ya + 0.76), 128),
               tornio(rettangolo(0.92, 1.0, yb - 0.01, yb + 0.03), 96)];
  // montanti: sei sotto l'anello inferiore (fino al pavimento), sei fra l'anello superiore e il generatore
  const yP = SALA.pavimento, yI = -F.h - F.piatto, yS = F.h + F.piatto;
  for (let k = 0; k < M.n; k++) {
    const a = TAU * k / M.n, s = Math.sin(a), c = Math.cos(a);
    det.push(asta([M.sotto * s, yP, M.sotto * c], [M.sotto * s, yI, M.sotto * c], 0.075, 0.075, 20));
    det.push(posa(scatola(-0.17, 0.17, yP, yP + 0.035, -0.17, 0.17), a, M.sotto * s, 0, M.sotto * c));
    det.push(asta([M.sopra[0] * s, yS, M.sopra[0] * c], [M.sopra[1] * s, ya, M.sopra[1] * c], 0.07, 0.055, 20));
  }
  return { cassa, dettagli: unisci(det) };
}

/** Anello di scarico e tubo di aspirazione (cono, gomito verso +x, diffusore); flange, selle, collare sul solaio. */
export function aspirazione() {
  const A = F.aspirazione, w = F.parete, yO = SALA.interrato + A.sopraInterrato, yG = yO + A.curva;
  const pts = [];
  for (let y = A.y0; y > yG + 1e-6; y -= 0.5) pts.push(new THREE.Vector3(0, y, 0));
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (1 + k / 24); pts.push(new THREE.Vector3(A.curva + A.curva * Math.cos(a), yG + A.curva * Math.sin(a), 0)); }
  for (let x = A.curva + 1; x < SALA.muroEst - 0.01; x += 1) pts.push(new THREE.Vector3(x, yO, 0));
  pts.push(new THREE.Vector3(SALA.muroEst, yO, 0));
  const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const L = curva.getLength(), L1 = A.y0 - yG, L2 = L1 + Math.PI * A.curva / 2;
  const rIn = s => {
    const m = s * L, [a, b, c, d] = A.r;
    if (m < L1) return lerp(a, b, m / L1);
    if (m < L2) return lerp(b, c, (m - L1) / (L2 - L1));
    return lerp(c, d, liscio(L2, L2 + 8, m));
  };
  const tb = tubo(curva, s => rIn(s) + w, w, 260, 48);
  const cassa = [
    tb.fuori,
    // anello di scarico attorno alla fascia, con flangia (la faccia verso la girante è "interno")
    tornio([[[0.70, A.y0], [0.86, A.y0]], [[0.86, A.y0], [0.86, A.y0 + 0.05]], [[0.86, A.y0 + 0.05], [0.77, A.y0 + 0.05]],
            [[0.77, A.y0 + 0.05], [0.77, -0.20]], [[0.77, -0.20], [0.70, -0.20]]], 96),
  ];
  const interno = [tb.dentro, tornio([[[0.70, -0.20], [0.70, A.y0]]], 96)];
  const det = [];
  const sF = m => Math.min(1, m / L);
  for (const m of [3.0, 6.0, 9.0, L1, L2, L2 + 8, L2 + 16, L2 + 24]) if (m < L - 0.5) det.push(flangia(curva, sF(m), rIn(sF(m)) + w - 0.005, rIn(sF(m)) + w + 0.09, 0.08, m < L1 ? 16 : 0));
  // selle nell'interrato
  for (const m of [L2 + 4, L2 + 12, L2 + 20, L2 + 28]) {
    if (m > L - 1) continue;
    const p = curva.getPointAt(sF(m)), r = rIn(sF(m)) + w;
    det.push(scatola(p.x - 0.25, p.x + 0.25, SALA.interrato, p.y - r * 0.6, -r * 0.75, r * 0.75));
  }
  // collare sul foro del solaio: nel colore della cassa (un disco largo in oro, nel verniciato, gridava; l'oro resta ai filetti)
  const rP = rIn((A.y0 - SALA.pavimento) / L) + w;
  cassa.push(tornio([[[rP + 0.01, SALA.pavimento + 0.05], [rP + 0.01, SALA.pavimento]], [[rP + 0.01, SALA.pavimento], [SALA.foro + 0.15, SALA.pavimento]],
                   [[SALA.foro + 0.15, SALA.pavimento], [SALA.foro + 0.15, SALA.pavimento + 0.02]], [[SALA.foro + 0.15, SALA.pavimento + 0.02], [rP + 0.12, SALA.pavimento + 0.05]],
                   [[rP + 0.12, SALA.pavimento + 0.05], [rP + 0.01, SALA.pavimento + 0.05]]], 96));
  return { cassa: unisci(cassa), interno: unisci(interno), dettagli: unisci(det) };
}

/** Tubo d'ingresso: S dalla condotta all'imbocco della chiocciola, valvola sferica, flange, selle. */
export function ingresso() {
  const [xc, yc, zc] = SALA.condotta, r = SALA.rCondotta, w = F.parete, I = F.ingresso, R0 = CH.r0M;
  const [v0, v1] = I.valvola, xm = (v0 + v1) / 2;
  const esse = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xc, yc, zc), new THREE.Vector3(xc + 1.2, yc, zc), new THREE.Vector3(xc + 3.0, yc, zc + 0.45),
    new THREE.Vector3(xc + 5.2, yc, R0 - 0.45), new THREE.Vector3(v0 - 1.0, yc, R0), new THREE.Vector3(v0, yc, R0),
  ], false, 'centripetal', 0.5);
  const dritto = new THREE.LineCurve3(new THREE.Vector3(v1, yc, R0), new THREE.Vector3(0, yc, R0));
  // niente teste: i tubi finiscono sempre contro la condotta, la valvola o la chiocciola
  const t1 = tubo(esse, () => r, w, 90, 48, [false, false]), t2 = tubo(dritto, () => r, w, 12, 48, [false, false]);
  const cassa = [t1.fuori, t2.fuori];
  // valvola sferica: corpo al tornio attorno all'asse del tubo (x), foro passante ("interno")
  const lv = (v1 - v0) / 2, rb = 1.25;
  const corpo = tornio([
    [[r - w, -lv], [1.0, -lv]], [[1.0, -lv], [1.0, -lv + 0.15]],
    [[1.0, -lv + 0.15], [1.08, -lv + 0.32], [1.2, -0.45], [rb, 0], [1.2, 0.45], [1.08, lv - 0.32], [1.0, lv - 0.15]],
    [[1.0, lv - 0.15], [1.0, lv]], [[1.0, lv], [r - w, lv]],
  ], 96);
  const foro = tornio([[[r - w, lv], [r - w, -lv]]], 96);
  for (const g of [corpo, foro]) { g.rotateZ(-Math.PI / 2); g.translate(xm, yc, R0); }
  cassa.push(corpo);
  const interno = [t1.dentro, t2.dentro, foro];
  const det = [
    // perni della sfera (sopra e sotto)
    asta([xm, yc - rb + 0.06, R0], [xm, yc - rb - 0.22, R0], 0.32, 0.32, 32),
    asta([xm, yc + rb - 0.06, R0], [xm, yc + rb + 0.10, R0], 0.32, 0.32, 32),
  ];
  for (const [cv, s] of [[esse, 0], [dritto, 1]]) det.push(flangia(cv, s, r - 0.005, r + 0.13, 0.1, 20));
  // basamenti in calcestruzzo bianco (come l'edificio): sotto il tubo (cima dentro la parete) e sotto la valvola
  const cemento = [];
  for (const [x, z, sella] of [[xc + 3.0, zc + 0.45, true], [xm, R0, false], [-1.6, R0, true]]) {
    const cima = sella ? yc - r + 0.05 : yc - rb - 0.22, l = sella ? 0.32 : 0.55;
    cemento.push(scatola(x - l, x + l, SALA.pavimento - 0.01, cima, z - 0.55, z + 0.55));
  }
  return { cassa: unisci(cassa), interno: unisci(interno), dettagli: unisci(det), cemento: unisci(cemento) };
}

/** Punti notevoli (metri locali) per le ancore delle etichette. */
export const PUNTI = {
  // mezzeria della chiocciola a 180° dall'imbocco
  chiocciola: (() => { const t = 180 / CH.gradi; return [0, 0, -chiocciolaR(t)]; })(),
  // anello delle pale direttrici, sul perno della pala a 90° (lato destro dell'inquadratura)
  distributore: [F.direttrici.r, 0, 0],
  // cielo della corona (metà intatta, verso il fondo)
  corona: [-0.16, F.h + 0.127, -0.42],
};
