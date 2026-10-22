// =============================================================================
// ERI v2 · idro/kaplan-forme.js — geometrie della Kaplan (file privato di idro/kaplan.js: niente ctx, niente materiali)
// Proprietario: [VALLE]. Si importa SOLO da idro/kaplan.js.
// Specifica: DESIGN §6.7 (mozzo Lathe Ø 1,9 m; 5 pale a due fogli su perni; 24 direttrici a raggio 3,6 m alte 1,8 m;
// anello di scarico e cono Lathe; semi-chiocciola in calcestruzzo a sezione rettangolare), §3.6, config.VALLE.giranteKaplan.
//
// Misure in METRI nel sistema della macchina: origine al centro della girante (piano dei perni delle pale), y sull'asse
// verso l'alto, angolo in pianta a con (x, z) = (r cos a, r sin a); il gruppo di kaplan.js scala × 0,1 (UNITA).
// Il giro dell'acqua e della girante è quello di a crescente. Ogni solido è CHIUSO (contorni antiorari nel piano (r, y)
// o (x, z), cavità orarie): tagliato da ZK, le retro-facce diventano la campitura della sezione solo nello spessore delle
// pareti. Le superfici bagnate (canale dell'acqua) escono a parte ('acqua') per il loro materiale.
// Tutte le geometrie sono indicizzate con position, normal, uv (l'inox ha anisotropia: senza uv la cornice tangente
// dello shader è nulla e i riflessi diventano NaN).
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE, UNITA } from '../config.js';
import * as VF from './valle-forme.js';

const GK = VALLE.giranteKaplan, MU = UNITA.metriPerU, C0 = GK.centro;
const EK = VF.EDIFICI?.kaplan;
const RAD = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
/** Quota del mondo (u) → y locale della macchina (m). */
const yLoc = y => (y - C0[1]) * MU;

// quote della centrale (valle-forme.js), in metri locali; con i valori di config se l'edificio cambiasse forma
export const QUOTE = {
  interrato: yLoc(EK?.interrato ?? VALLE.taglio.fori.kaplan.y[0]),                       // −14,0 (pavimento dell'interrato)
  terra: (EK?.terra ?? [-0.42, -0.35]).map(yLoc),                                         // −0,2 … 0,5
  medio: (EK?.medio ?? [0.62, 0.74]).map(yLoc),                                           // 10,2 … 11,4
  muroEst: ((EK?.x?.[1] ?? VALLE.taglio.fori.kaplan.x[1]) - (VF.EDIFICI?.muro ?? 0.12) - C0[0]) * MU,   // 58,8
};

// TARATURA: proporre in config (VALLE.giranteKaplan) — forme che DESIGN §6.7 descrive a parole o che non fissa.
// pala: calettamento (rad, dal piano di rotazione) dal mozzo alla punta come §6.7; spessore relativo (profilo NACA a
// bordo d'uscita chiuso), perno a 0,4 della corda; spigoli in punta arrotondati (quarto d'ellisse).
// CORDA 1,4 → 2,4 m invece di 1,1 → 1,7 (§6.7): con 1,7 m in punta le pale sembravano piccole corna attorno al mozzo;
// nelle Kaplan vere a salto basso la solidità in punta è ~0,9 (pale larghe che quasi chiudono il cerchio) ed è questo
// che le fa riconoscere da un'elica qualunque.
// La radice sta sulla sfera 0,9 (dentro il mozzo), la punta sulla sfera dell'anello di scarico meno il gioco: col
// passo le pale girano su perni radiali e restano sempre a filo della sfera.
// Quote verticali: distributore subito sopra la girante (1,2 … 3,0 m), naso del coperchio fino al mozzo, così fra
// direttrici e pale il canale gira da radiale ad assiale senza tratti morti.
export const FORMA = {
  Rpunta: GK.diametroM / 2, Rmozzo: GK.mozzoM / 2, nPale: GK.pale,
  pala: { radice: 0.9, gioco: 0.04, calettamento: [1.0, 0.35], corda: [1.4, 2.4], curvatura: 0.06,
          spessore: [0.12, 0.04], perno: 0.4, punta: { u: 0.8, attacco: 0.2, uscita: 0.05 } },
  borchia: { r: 0.6, sfera: 0.985, base: 0.7 },                        // flangia di ogni pala, a filo della sfera del mozzo
  mozzo: { punta: -2.1, sfera: -0.8, k: 0.55, cima: 1.05 },            // ogiva, zona sferica, cilindro Ø 1,9
  albero: { r: 0.45, cima: QUOTE.medio[1] + 1.2, giunto: { y: 6.0, r: 0.78, bulloni: 12, rb: 0.64 } },
  // distributore: 24 pale direttrici sul cerchio di config, chiuse a 3°, aperte di 30° (aperturaKaplan 0 → 1)
  dist: { n: GK.direttrici, R: GK.raggioDirettriciM, y0: 1.2, alto: GK.altezzaDirettriciM, corda: 1.15, spessore: 0.13,
          curvatura: 0.02, perno: 0.42, chiusa: 3, corsa: 30 },
  // regolazione: perni, leve, bielle, anello di regolazione sul coperchio
  leva: { y: [4.01, 4.11], lunga: 0.5, rPerno: 0.13, rPunta: 0.085 },
  anello: { r: [4.02, 4.3], y: [3.85, 3.95], rPerni: 4.16, biella: 0.62, y2: [3.95, 4.01] },   // bielle fra anello e leve
  // coperchio cavo (pareti di 0,14 m: in sezione un guscio, non un blocco)
  coperchio: { rFuori: 4.55, sotto: 3.0, cima: 3.85, gradino: [2.6, 3.95], cuscinetto: [1.35, 4.98], foro: 0.55, naso: [0.98, 1.1],
               parete: 0.14 },
  scarico: { gola: GK.diametroM / 2 + 0.02, bocca: [3.0, 1.2], cil: 0.55, sfera: -0.6, cono: [3.0, -7.5], parete: 0.12,
             fuori: 2.62, flangia: [-1.2, -0.95, 2.8], fondo: [0.8, 4.6] },
  // semi-chiocciola a "C" (pavimento, parete esterna, tetto inclinato; pareti di 0,5 m): raggio esterno di config
  // all'imbocco; 225° di avvolgimento da a = 150° (davanti a sinistra, tolto dal taglio) a 375°: la sezione visibile
  // si stringe da sinistra (monte) a destra; il pavimento poggia alla quota del solaio di terra
  chiocciola: { a0: 150, a1: 375, Rest: GK.semichioccialaRaggioM, Rfine: 6.6, H0: 5.4, Hfine: 2.0, esp: 0.8, parete: 0.5,
                pavimento: 1.2, base: QUOTE.terra[1], rPavimento: 4.62, rBordo: 4.6, rPiano: 6.0, yTetto: 3.0 },
  avantdistributore: { n: 12, r: 5.25, corda: 1.3, spessore: 0.25, angolo: 38 },
  // gomito e diffusore in calcestruzzo: superellisse da cerchio (r 3) a rettangolo stondato, fondo appena sopra
  // il pavimento dell'interrato, uscita contro il muro est
  gomito: { y0: -7.5, parete: 0.6, sezioni: [[3.0, 3.0, 2], [2.0, 4.2, 5], [2.4, 5.2, 5]] },
  generatore: { r: [4.7, 5.8], alto: 2.8, coperchio: 0.6, rotore: [0.45, 4.5] },
};

// ---------------------------------------------------------------- utilità
/** Geometria indicizzata con position, uv e normal (calcolate se mancano). */
function geo(pos, uv, idx, nor = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals();
  return g;
}
/** Unisce geometrie indicizzate (position, normal, uv) e libera le parti; null se la lista è vuota. */
export function unisci(lista) {
  const l = lista.filter(Boolean); if (!l.length) return null;
  if (l.length === 1) return l[0];
  const g = mergeGeometries(l, false); for (const x of l) x.dispose(); return g;
}
/** Area con segno di un contorno [[a, b], …] (positiva = antiorario). */
const areaSegnata = c => { let s = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Toglie i punti consecutivi coincidenti (anche l'ultimo se coincide col primo). */
function pulisci(p) {
  const out = [];
  for (const q of p) if (!out.length || dist2(q, out[out.length - 1]) > 1e-7) out.push(q);
  if (out.length > 2 && dist2(out[0], out[out.length - 1]) < 1e-7) out.pop();
  return out;
}
/** Arco d'ellisse (centro, semiassi, angoli in gradi), estremi compresi. */
function arco(cx, cy, rx, ry, g0, g1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = (g0 + (g1 - g0) * i / n) * RAD; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
  return out;
}
const spigolo = (a, b, c, cs) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  return lu < 1e-9 || lv < 1e-9 || (ux * vx + uy * vy) / (lu * lv) < cs;
};
/** Spezza un contorno chiuso in tratti lisci: spigolo vivo dove la direzione gira più di 'soglia' gradi. */
function spezza(p, soglia) {
  const n = p.length, cs = Math.cos(soglia * RAD), sp = [];
  for (let i = 0; i < n; i++) if (spigolo(p[(i - 1 + n) % n], p[i], p[(i + 1) % n], cs)) sp.push(i);
  if (!sp.length) return [[...p, p[0]]];
  return sp.map((i0, s) => {
    const i1 = sp[(s + 1) % sp.length], t = [];
    let i = i0; do { t.push(p[i]); i = (i + 1) % n; } while (i !== i1);
    t.push(p[i1]);
    return t;
  });
}
/** Spezza una polilinea aperta nei tratti lisci. */
function spezzaAperta(p, soglia) {
  const cs = Math.cos(soglia * RAD), out = []; let t = [p[0]];
  for (let i = 1; i < p.length; i++) {
    t.push(p[i]);
    if (i < p.length - 1 && spigolo(p[i - 1], p[i], p[i + 1], cs)) { out.push(t); t = [p[i]]; }
  }
  out.push(t);
  return out.filter(q => q.length > 1);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
/** Fissa il verso dei triangoli: la normale del triangolo 'tri' deve concordare con 'atteso'; poi ricalcola le normali. */
function orienta(g, tri, atteso) {
  const p = g.attributes.position, ix = g.index.array;
  _a.fromBufferAttribute(p, ix[3 * tri]); _b.fromBufferAttribute(p, ix[3 * tri + 1]); _c.fromBufferAttribute(p, ix[3 * tri + 2]);
  _b.sub(_a); _c.sub(_a); _b.cross(_c);
  if (_b.x * atteso[0] + _b.y * atteso[1] + _b.z * atteso[2] < 0) {
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- primitive
/**
 * Rivoluzione attorno a y di UN tratto liscio [[r, y], …] (normale a destra del verso: contorno antiorario → esterno).
 * uv.x lungo il profilo (la tornitura: l'anisotropia dell'inox allunga i riflessi lungo il meridiano).
 */
function ruota(t, n) {
  const m = t.length, pos = [], nor = [], uv = [], idx = [];
  const L = [0]; for (let i = 1; i < m; i++) L.push(L[i - 1] + dist2(t[i], t[i - 1]));
  const Lt = L[m - 1] || 1;
  const nm = t.map((q, i) => {
    const a = t[Math.max(0, i - 1)], b = t[Math.min(m - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l];
  });
  for (let k = 0; k <= n; k++) {
    const th = k / n * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < m; i++) {
      pos.push(t[i][0] * c, t[i][1], t[i][0] * s);
      nor.push(nm[i][0] * c, nm[i][1], nm[i][0] * s);
      uv.push(L[i] / Lt, k / n);
    }
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < m - 1; i++) {
    const A = k * m + i, B = A + 1, C = B + m, D = A + m;
    idx.push(A, B, C, A, C, D);
  }
  return geo(pos, uv, idx, nor);
}
/** Solido di rivoluzione da un contorno chiuso [[r, y], …]: tratti lisci, spigoli vivi oltre 'soglia'. */
export function tornio(profilo, n = 128, soglia = 32, cavita = false) {
  let p = pulisci(profilo); if ((areaSegnata(p) < 0) !== cavita) p = p.slice().reverse();
  return unisci(spezza(p, soglia).map(t => ruota(t, n)));
}
/**
 * Solido di rivoluzione da un contorno chiuso fatto di parti [{p: [[r, y], …], acqua}] in sequenza (ogni parte
 * comincia dove finisce la precedente): le parti bagnate escono a parte. → { asciutto, acqua }
 */
function tornioParti(parti, n = 128, soglia = 32, cavita = false) {
  const anello = []; for (const q of parti) for (const v of q.p) if (!anello.length || dist2(v, anello[anello.length - 1]) > 1e-7) anello.push(v);
  let ps = parti;
  if ((areaSegnata(pulisci(anello)) < 0) !== cavita) ps = parti.slice().reverse().map(q => ({ p: q.p.slice().reverse(), acqua: q.acqua }));
  const out = { asciutto: [], acqua: [] };
  for (const q of ps) for (const t of spezzaAperta(pulisci(q.p), soglia)) (q.acqua ? out.acqua : out.asciutto).push(ruota(t, n));
  return { asciutto: unisci(out.asciutto), acqua: unisci(out.acqua) };
}

/** Prisma verticale da y0 a y1 con base un contorno chiuso [[x, z], …] (fianchi lisci, spigoli vivi oltre 'soglia'). */
export function prisma(contorno, y0, y1, soglia = 40) {
  let c = pulisci(contorno); if (areaSegnata(c) < 0) c = c.slice().reverse();
  const parti = [];
  for (const t of spezza(c, soglia)) {
    const m = t.length, pos = [], nor = [], uv = [], idx = [];
    let L = 0;
    for (let i = 0; i < m; i++) {
      const a = t[Math.max(0, i - 1)], b = t[Math.min(m - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      if (i) L += dist2(t[i], t[i - 1]);
      pos.push(t[i][0], y0, t[i][1], t[i][0], y1, t[i][1]);
      nor.push(dz / l, 0, -dx / l, dz / l, 0, -dx / l);
      uv.push(L, y0, L, y1);
    }
    for (let i = 0; i < m - 1; i++) { const A = 2 * i, D = A + 1, B = A + 2, C = A + 3; idx.push(A, C, B, A, D, C); }
    parti.push(geo(pos, uv, idx, nor));
  }
  const tri = THREE.ShapeUtils.triangulateShape(c.map(q => new THREE.Vector2(q[0], q[1])), []);
  for (const [y, s] of [[y1, 1], [y0, -1]]) {
    const pos = [], nor = [], uv = [], idx = [];
    for (const q of c) { pos.push(q[0], y, q[1]); nor.push(0, s, 0); uv.push(q[0], q[1]); }
    for (const [a, b, d] of tri) {
      const ny = (c[b][1] - c[a][1]) * (c[d][0] - c[a][0]) - (c[b][0] - c[a][0]) * (c[d][1] - c[a][1]);
      if (ny * s >= 0) idx.push(a, b, d); else idx.push(a, d, b);
    }
    parti.push(geo(pos, uv, idx, nor));
  }
  return unisci(parti);
}

/** Profilo alare chiuso [[x, z], …]: corda lungo x dall'attacco (−perno·c) all'uscita, bordo d'uscita chiuso (NACA). */
const yNACA = x => 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
export function profiloAla(c, tau, camber, perno, n = 18) {
  const v = j => 0.5 - 0.5 * Math.cos(Math.PI * j / n), out = [];
  for (let j = n; j >= 0; j--) out.push([(v(j) - perno) * c, (camber * Math.sin(Math.PI * v(j)) + tau * yNACA(v(j))) * c]);
  for (let j = 1; j < n; j++) out.push([(v(j) - perno) * c, (camber * Math.sin(Math.PI * v(j)) - tau * yNACA(v(j))) * c]);
  return out;
}

// ---------------------------------------------------------------- girante (inox)
/**
 * Pala nel sistema del suo perno: asse del perno = +x (radiale), +z = verso del moto, y = asse della macchina.
 * Due fogli (dorso e ventre) avvolti dal bordo d'uscita sul dorso all'attacco e di nuovo all'uscita sul ventre:
 * attacco liscio, uscita viva. Ogni sezione u sta sulla sfera ρ(u) (radice nel mozzo, punta a filo dell'anello).
 */
export function geometriaPala() {
  const P = FORMA.pala, R0 = P.radice, R1 = FORMA.Rpunta - P.gioco, NU = 34, NV = 24;
  const vs = []; for (let j = 0; j <= NV; j++) vs.push(0.5 - 0.5 * Math.cos(Math.PI * j / NV));
  const giro = []; for (let j = NV; j >= 0; j--) giro.push([vs[j], 1]); for (let j = 1; j <= NV; j++) giro.push([vs[j], -1]);
  const M = giro.length;
  const punto = (u, v, lato) => {
    const beta = lerp(P.calettamento[0], P.calettamento[1], u), c = lerp(P.corda[0], P.corda[1], u);
    const tau = lerp(P.spessore[0], P.spessore[1], u), rho = lerp(R0, R1, u), Q = P.punta;
    // spigoli in punta arrotondati: attacco e uscita rientrano verso il perno
    const k = u > Q.u ? 1 - Math.sqrt(Math.max(0, 1 - ((u - Q.u) / (1 - Q.u)) ** 2)) : 0;
    const sA = -P.perno * c + Q.attacco * c * k, sU = (1 - P.perno) * c - Q.uscita * c * k, cl = sU - sA;
    const s = lerp(sA, sU, v), n = P.curvatura * cl * Math.sin(Math.PI * v) + lato * tau * cl * yNACA(v);
    // corda dall'attacco (in alto, avanti) all'uscita (in basso, indietro); n verso il dorso (giù, avanti)
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const y = -s * sb - n * cb, z = -s * cb + n * sb;
    return [Math.sqrt(Math.max(1e-6, rho * rho - y * y - z * z)), y, z];
  };
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j < M; j++) { pos.push(...punto(i / NU, giro[j][0], giro[j][1])); uv.push(j / (M - 1), i / NU); }
  for (let i = 0; i < NU; i++) for (let j = 0; j < M - 1; j++) { const A = i * M + j, B = A + 1, C = A + M + 1, D = A + M; idx.push(A, B, C, A, C, D); }
  const bm = lerp(P.calettamento[0], P.calettamento[1], 0.5);
  const sup = orienta(geo(pos, uv, idx), 2 * ((NU >> 1) * (M - 1) + NV / 2), [0, -Math.cos(bm), Math.sin(bm)]);
  // chiusure in punta (a filo della sfera) e alla radice (nel mozzo): fra dorso e ventre alla stessa v
  const tappo = (u, verso) => {
    const p = [], q = [], ix = [];
    for (let j = 0; j < M; j++) { p.push(...punto(u, giro[j][0], giro[j][1])); q.push(j / (M - 1), u); }
    for (let j = 0; j < NV; j++) { const a = j, b = j + 1, c = M - 2 - j, d = M - 1 - j; ix.push(a, b, c, a, c, d); }
    return orienta(geo(p, q, ix), 2 * (NV >> 1), [verso, 0, 0]);
  };
  return unisci([sup, tappo(1, 1), tappo(0, -1)]);
}

/** Flangia della pala sul mozzo: disco sul perno con la faccia sulla sfera appena fuori dal mozzo (asse +x). */
export function geometriaBorchia() {
  const B = FORMA.borchia, xs = r => Math.sqrt(B.sfera * B.sfera - r * r), p = [[0, B.base], [B.r, B.base], [B.r, xs(B.r) - 0.015]];
  for (let i = 0; i <= 10; i++) { const r = B.r - 0.015 - (B.r - 0.015) * i / 10; p.push([r, xs(r)]); }
  const g = tornio(p, 96, 40);
  g.rotateZ(-Math.PI / 2);    // asse y → asse x
  return g;
}

/** Mozzo bulboso: ogiva sotto, zona sferica dei perni, cilindro Ø 1,9 fino al naso del coperchio. */
export function geometriaMozzo() {
  const Z = FORMA.mozzo, R = FORMA.Rmozzo, rS = y => Math.sqrt(R * R - (Z.k * y) ** 2), p = [];
  const rN = rS(Z.sfera);
  for (let i = 0; i <= 18; i++) { const t = i / 18; p.push([rN * Math.pow(Math.sin(Math.PI / 2 * t), 0.7), lerp(Z.punta, Z.sfera, t)]); }
  for (let i = 1; i <= 10; i++) { const y = lerp(Z.sfera, 0, i / 10); p.push([rS(y), y]); }
  p.push([R, Z.cima - 0.06], [R - 0.06, Z.cima], [0, Z.cima]);
  return tornio(p, 144);
}

/** Albero (inox) con il giunto intermedio e i suoi bulloni. */
export function geometriaAlbero() {
  const A = FORMA.albero, G = A.giunto, r = A.r, y = G.y, R = G.r, y0 = FORMA.mozzo.cima;
  const g = tornio([[0, y0], [r, y0], [r, y - 0.02], [R - 0.04, y - 0.02], [R, y + 0.02], [R, y + 0.16],
                    [R - 0.04, y + 0.2], [R - 0.08, y + 0.2], [R - 0.08, y + 0.24], [R - 0.04, y + 0.24], [R, y + 0.28],
                    [R, y + 0.42], [R - 0.04, y + 0.46], [r, y + 0.46], [r, A.cima], [0, A.cima]], 96);
  const parti = [g];
  const esa = []; for (let i = 0; i < 6; i++) { const t = (i * 60 + 30) * RAD; esa.push([0.055 * Math.cos(t), 0.055 * Math.sin(t)]); }
  for (let k = 0; k < G.bulloni; k++) {
    const t = (k + 0.5) / G.bulloni * Math.PI * 2, cx = G.rb * Math.cos(t), cz = G.rb * Math.sin(t);
    parti.push(prisma(esa.map(q => [q[0] + cx, q[1] + cz]), y + 0.46, y + 0.53, 70));
    parti.push(prisma(esa.map(q => [q[0] + cx, q[1] + cz]), y - 0.09, y - 0.02, 70));
  }
  return unisci(parti);
}

// ---------------------------------------------------------------- parti fisse in acciaio (stile delle casse)
/** Coperchio cavo: naso che guida l'acqua dal distributore alla girante, gradino, alloggiamento del cuscinetto. */
export function geometriaCoperchio() {
  const C = FORMA.coperchio, [rn, yn] = C.naso, R3 = FORMA.scarico.bocca[0], [rg, yg] = C.gradino, [rc, yc] = C.cuscinetto;
  const t = C.parete, ry = C.sotto - yn, rx = R3 - rn;
  // naso: parete esterna della curva radiale → assiale (centro in basso a destra), orizzontale sotto il distributore,
  // verticale a filo del mozzo
  const pieno = tornioParti([
    { p: [[C.foro, yn], [rn, yn]], acqua: false },
    { p: [...arco(R3, yn, rx, ry, 180, 90, 22), [C.rFuori, C.sotto]], acqua: true },
    { p: [[C.rFuori, C.sotto], [C.rFuori, C.cima - 0.06], [C.rFuori - 0.06, C.cima], [rg, C.cima], [rg, yg], [rc, yg],
          [rc, yc - 0.08], [rc - 0.08, yc], [C.foro, yc], [C.foro, yn]], acqua: false },
  ]);
  const u0 = 180 - Math.asin(t / (ry + t)) / RAD;
  const vuoto = tornio([[C.foro + t, yn + t], ...arco(R3, yn, rx + t, ry + t, u0, 90, 22), [C.rFuori - t, C.sotto + t],
                        [C.rFuori - t, C.cima - t], [rc - t, C.cima - t], [rc - t, yc - t], [C.foro + t, yc - t]], 128, 32, true);
  return { casse: unisci([pieno.asciutto, vuoto]), acqua: pieno.acqua };
}
/** Anello inferiore, gola dell'anello di scarico (cilindro sopra i perni, sfera sotto) e cono di aspirazione. */
export function geometriaScarico() {
  const S = FORMA.scarico, [rb, yb] = S.bocca, rg = S.gola, [rcF, ycF] = S.cono, t = S.parete, [yF0, yF1, rF] = S.flangia;
  const rSf = Math.sqrt(rg * rg - S.sfera * S.sfera);
  const rCono = y => lerp(rSf, rcF, (S.sfera - y) / (S.sfera - ycF));
  // imbocco a campana: il pavimento del distributore si arrotonda verso il basso fino alla gola (parete interna della curva)
  const bagnata = [[S.fondo[1], yb], ...arco(rb, S.cil, rb - rg, yb - S.cil, 90, 180, 16), [rg, 0]];
  for (let i = 1; i <= 8; i++) { const y = S.sfera * i / 8; bagnata.push([Math.sqrt(rg * rg - y * y), y]); }
  bagnata.push([rcF, ycF]);
  const r = tornioParti([
    { p: bagnata, acqua: true },
    { p: [[rcF, ycF], [rcF + t, ycF], [rCono(yF0) + t, yF0], [rF, yF0], [rF, yF1], [S.fuori, yF1], [S.fuori, S.fondo[0]],
          [S.fondo[1], S.fondo[0]], [S.fondo[1], yb]], acqua: false },
  ]);
  return { casse: r.asciutto, acqua: r.acqua };
}
/** Raggio esterno del cono alla quota y (per le nervature). */
export function rConoFuori(y) {
  const S = FORMA.scarico, rSf = Math.sqrt(S.gola ** 2 - S.sfera ** 2);
  return lerp(rSf, S.cono[0], (S.sfera - y) / (S.sfera - S.cono[1])) + S.parete;
}
/** Nervature del cono e della gola, flangia sul gomito (dettagli). */
export function geometriaNervature() {
  const S = FORMA.scarico, out = [];
  const anello = (r0, r1, y0, y1) => tornio([[r0, y0], [r1 - 0.03, y0], [r1, y0 + 0.03], [r1, y1 - 0.03], [r1 - 0.03, y1], [r0, y1]], 128);
  for (const y of [-3.0, -5.2]) out.push(anello(rConoFuori(y + 0.08) - 0.02, rConoFuori(y) + 0.24, y - 0.08, y + 0.08));
  out.push(anello(S.fuori - 0.02, S.fuori + 0.2, 0.0, 0.15));
  out.push(anello(S.cono[0] + S.parete, S.cono[0] + 0.9, S.cono[1], S.cono[1] + 0.22));
  return unisci(out);
}
/** Generatore sul solaio intermedio (statore a parete spessa, coperchio): fuori quadro in V4.7, visto nel volo. */
export function geometriaGeneratore() {
  const G = FORMA.generatore, y0 = QUOTE.medio[1], y1 = y0 + G.alto, [r0, r1] = G.r;
  const statore = tornio([[r0, y0], [r1, y0], [r1, y1 - 0.08], [r1 - 0.08, y1], [r0, y1]], 128);
  const coperchio = tornio([[1.1, y1], [r1, y1], [r1, y1 + 0.15], [r1 - 0.3, y1 + 0.2], [2.2, y1 + G.coperchio],
                            [1.6, y1 + G.coperchio + 0.5], [1.1, y1 + G.coperchio + 0.5]], 128);
  return unisci([statore, coperchio]);
}
export function geometriaRotore() {
  const G = FORMA.generatore, y0 = QUOTE.medio[1] + 0.25, y1 = y0 + G.alto - 0.5, [r0, r1] = G.rotore;
  return tornio([[r0, y0], [r1, y0], [r1, y1], [r0, y1]], 128);
}

// ---------------------------------------------------------------- distributore e regolazione (istanze)
/** Pala direttrice nel sistema del suo perno (corda lungo +x, perno nell'origine). */
export function geometriaDirettrice() {
  const D = FORMA.dist;
  return prisma(profiloAla(D.corda, D.spessore, D.curvatura, D.perno, 20), D.y0, D.y0 + D.alto, 30);
}
/** Perno, collare e leva della direttrice (dettagli); la leva va lungo 'dir' = ±1 sull'asse z del perno. */
export function geometriaLeva(dir) {
  const D = FORMA.dist, L = FORMA.leva, A = FORMA.anello, [ya, yb] = L.y, top = D.y0 + D.alto, cc = FORMA.coperchio.cima, parti = [];
  parti.push(tornio([[0, top], [0.085, top], [0.085, cc], [0.15, cc], [0.15, ya], [0.085, ya], [0.085, yb + 0.02], [0.065, yb + 0.04],
                     [0, yb + 0.04]], 32));
  // leva a stadio: dal perno (r grande) alla punta (r piccolo) lungo z
  const c = [], n = 14;
  for (let i = 0; i <= n; i++) { const t = Math.PI * i / n; c.push([L.rPerno * Math.cos(t), -dir * L.rPerno * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) { const t = Math.PI * (1 + i / n); c.push([L.rPunta * Math.cos(t), dir * (L.lunga - L.rPunta * Math.sin(t))]); }
  parti.push(prisma(c, ya, yb, 50));
  // spina in punta: attraversa biella e leva
  parti.push(tornio([[0, A.y2[0]], [0.04, A.y2[0]], [0.04, yb + 0.02], [0, yb + 0.02]], 20).translate(0, 0, L.lunga * dir));
  return unisci(parti);
}
/** Biella (lunghezza 1 lungo +x, scalata dall'istanza). */
export function geometriaBiella() {
  const [y0, y1] = FORMA.anello.y2, w = 0.05;
  return prisma([[0, -w], [1, -w], [1, w], [0, w]], y0, y1, 50);
}
/** Anello di regolazione con le spine delle bielle (ruota di γ attorno all'asse). */
export function geometriaAnello() {
  const A = FORMA.anello, [r0, r1] = A.r, [y0, y1] = A.y, parti = [];
  parti.push(tornio([[r0, y0], [r1, y0], [r1, y1 - 0.03], [r1 - 0.03, y1], [r0 + 0.03, y1], [r0, y1 - 0.03]], 160));
  for (let k = 0; k < FORMA.dist.n; k++) {
    const a = (k + 0.5) / FORMA.dist.n * Math.PI * 2;
    parti.push(tornio([[0, y1], [0.04, y1], [0.04, A.y2[1] + 0.01], [0, A.y2[1] + 0.01]], 16)
      .translate(A.rPerni * Math.cos(a), 0, A.rPerni * Math.sin(a)));
  }
  return unisci(parti);
}

// ---------------------------------------------------------------- opere civili (calcestruzzo del plastico)
/**
 * Sezione (r, y) della semi-chiocciola a "C" al progresso s (0 imbocco, 1 fine): pavimento, parete esterna, tetto
 * inclinato (piano sopra l'avantdistributore). Lati bagnati: sotto del tetto, parete interna, pavimento.
 */
function sezioneChiocciola(s) {
  const C = FORMA.chiocciola, f = Math.pow(1 - s, C.esp), t = C.parete;
  const Ro = C.Rfine + (C.Rest - t - C.Rfine) * f, H = C.Hfine + (C.H0 - C.Hfine) * f;
  const yf = C.pavimento, yt = yf + H, yi = C.yTetto, r6 = C.rPiano, ri = C.rBordo, rp = C.rPavimento;
  const k = (yt - yi) / Math.max(1e-6, Ro - r6);
  return [[rp, C.base], [Ro + t, C.base], [Ro + t, yi + t + k * (Ro + t - r6)], [r6, yi + t], [ri, yi + t], [ri, yi], [r6, yi],
          [Ro, yt], [Ro, yf], [rp, yf]];
}
const LATI_BAGNATI = new Set([5, 6, 7, 8]);   // (ri, yi)→(r6, yi)→(Ro, yt)→(Ro, yf)→(rp, yf)
export function geometriaChiocciola() {
  const C = FORMA.chiocciola, N = 150, sez = [], ang = [];
  for (let i = 0; i <= N; i++) { const s = i / N; ang.push(lerp(C.a0, C.a1, s) * RAD); sez.push(sezioneChiocciola(s)); }
  const n = sez[0].length, inverti = areaSegnata(sez[0]) < 0, out = { cls: [], acqua: [] };
  for (let e = 0; e < n; e++) {
    const pos = [], uv = [], idx = [];
    // lato e → e+1 (con l'ordine invertito i vertici si prendono a ritroso)
    const i0 = inverti ? (e + 1) % n : e, i1 = inverti ? e : (e + 1) % n;
    for (let k = 0; k <= N; k++) {
      const c = Math.cos(ang[k]), s = Math.sin(ang[k]);
      for (const i of [i0, i1]) { const [r, y] = sez[k][i]; pos.push(r * c, y, r * s); uv.push(i === i0 ? 0 : 1, k / N); }
    }
    for (let k = 0; k < N; k++) { const A = 2 * k, B = A + 1, Cc = A + 3, D = A + 2; idx.push(A, B, Cc, A, Cc, D); }
    (LATI_BAGNATI.has(e) ? out.acqua : out.cls).push(geo(pos, uv, idx));
  }
  return { cls: unisci(out.cls), acqua: unisci(out.acqua) };
}
/** Avantdistributore: pale fisse in calcestruzzo sotto il tetto piano, orientate sul flusso. */
export function geometriaAvantdistributore() {
  const A = FORMA.avantdistributore, C = FORMA.chiocciola, prof = profiloAla(A.corda, A.spessore / A.corda, 0.02, 0.5, 14), out = [];
  const th = A.angolo * RAD;
  for (let k = 0; k < A.n; k++) {
    const a = (k + 0.25) / A.n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const dx = Math.cos(th) * -sa + Math.sin(th) * -ca, dz = Math.cos(th) * ca + Math.sin(th) * -sa;   // tangente + verso l'asse
    const ex = -dz, ez = dx;                                                                             // normale alla corda
    out.push(prisma(prof.map(([x, z]) => [A.r * ca + x * dx + z * ex, A.r * sa + x * dz + z * ez]), C.pavimento, C.yTetto, 30));
  }
  return unisci(out);
}

/**
 * Gomito e diffusore del tubo di aspirazione (calcestruzzo, parete spessa): arco nel piano x-y dal cono (y0, cerchio)
 * all'orizzontale verso +x (asse ≈ VALLE.giranteKaplan.conoY), poi diffusore fino al muro est. Sezione superellisse
 * nel piano (N, z). → { cls, acqua } (acqua = superficie interna).
 */
export function geometriaGomito() {
  const G = FORMA.gomito, [s0, s1, s2] = G.sezioni, fondo = QUOTE.interrato + 0.1;
  const Re = G.y0 - (fondo + s1[0]), xF = QUOTE.muroEst - 0.1, cammino = [];
  for (let i = 0; i <= 26; i++) {           // gomito: centro (Re, y0)
    const f = i / 26 * Math.PI / 2, q = ss(i / 26);
    cammino.push({ c: [Re - Re * Math.cos(f), G.y0 - Re * Math.sin(f)], n: [Math.cos(f), Math.sin(f)], t: [Math.sin(f), -Math.cos(f)],
                   an: lerp(s0[0], s1[0], q), az: lerp(s0[1], s1[1], q), e: lerp(s0[2], s1[2], q) });
  }
  for (let i = 1; i <= 10; i++) {           // diffusore: il fondo resta appoggiato
    const q = i / 10, an = lerp(s1[0], s2[0], q);
    cammino.push({ c: [lerp(Re, xF, q), fondo + an], n: [0, 1], t: [1, 0], an, az: lerp(s1[1], s2[1], q), e: lerp(s1[2], s2[2], q) });
  }
  const NJ = 72, anelli = d => cammino.map(P => {
    const out = [];
    for (let j = 0; j < NJ; j++) {
      const f = j / NJ * Math.PI * 2, c = Math.cos(f), s = Math.sin(f);
      const u = (P.an + d) * Math.sign(c) * Math.pow(Math.abs(c), 2 / P.e), w = (P.az + d) * Math.sign(s) * Math.pow(Math.abs(s), 2 / P.e);
      out.push([P.c[0] + u * P.n[0], P.c[1] + u * P.n[1], w]);
    }
    return out;
  });
  const superficie = (an, verso) => {
    const K = an.length, pos = [], uv = [], idx = [];
    for (let k = 0; k < K; k++) for (let j = 0; j < NJ; j++) { pos.push(...an[k][j]); uv.push(j / NJ, k / (K - 1)); }
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < NJ; j++) { const A = k * NJ + j, B = k * NJ + (j + 1) % NJ, C = B + NJ, D = A + NJ; idx.push(A, B, C, A, C, D); }
    const n0 = cammino[0].n;
    return orienta(geo(pos, uv, idx), 0, [n0[0] * verso, n0[1] * verso, 0]);
  };
  const fuori = anelli(G.parete), dentro = anelli(0);
  const bordo = (k, verso) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < NJ; j++) { pos.push(...dentro[k][j], ...fuori[k][j]); uv.push(j / NJ, 0, j / NJ, 1); }
    for (let j = 0; j < NJ; j++) { const a = 2 * j, b = 2 * ((j + 1) % NJ); idx.push(a, b, b + 1, a, b + 1, a + 1); }
    const t = cammino[k].t;
    return orienta(geo(pos, uv, idx), 0, [t[0] * verso, t[1] * verso, 0]);
  };
  return { cls: unisci([superficie(fuori, 1), bordo(0, -1), bordo(cammino.length - 1, 1)]), acqua: superficie(dentro, -1) };
}
