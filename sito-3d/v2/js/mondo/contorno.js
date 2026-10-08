// =============================================================================
// ERI v2 · mondo/contorno.js — contorno della PIANURA: alberi, strade, ponte, cabine, CP, capannone, cavidotto MT
// Proprietario: [PIANURA]. Stato: COMPLETO ([PIANURA-CONTORNO]).
// Specifica: DESIGN §3.4 (luoghi, strade, impianti, alberi), §2.6 (alberi, calcestruzzo, asfalto), §2.7 (cavidotto:
// LineSegments2 rame × 2,6, impulsi), §4.2–4.3 (cavo, impulsi, luciCP), §4.6 (cabine, cavoProgetto, cavoScavo,
// termica del capannone), config.PIANURA.
//
// Cosa c'è:
//  - alberi: UN InstancedMesh (bosco 1 500 nell'ellisse Natura 2000, ripa 700 a 2,8 < dF < 6, filare 50 lungo la SP),
//    icosaedro (1,1) bitorzoluto schiacciato a (r; 1,3 r; r), instanceColor ±10 %, base a altezza + 0,8 r;
//    patch sollevamento + carta/realtà + sottrazione; customDepthMaterial e materiale delle normali con la stessa patch.
//  - strade (SP in asfalto con segnaletica, poderale e accessi in ghiaia) come nastri sul terreno; ponte sulla SP
//    (impalcato 10 × 0,7 × 0,12 u, 2 pile allineate alla corrente, parapetti, spalle).
//  - cabine al cancello (scala STATO.cabine), cabina primaria con trasformatori, portali, sbarre, apparecchiature,
//    edificio comandi e luci calde (STATO.luciCP), linea AT con tralicci, capannone con scansione termica
//    (STATO.termica), casali della campagna (file privato contorno-edifici.js).
//  - cavidotto MT: LineSegments2 rame × 2,6 disegnato progressivamente (STATO.cavo) con punta luminosa, impulsi oro
//    chiaro a 6 u/s uno ogni 4 u (STATO.impulsi), tratteggio "di progetto" (STATO.cavoProgetto), trincea scura che
//    avanza (STATO.cavoScavo).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra ctx.ancore.set('cavo.polilinea', Vector3[]) (polilinea del cavidotto sul terreno, per LineaOro 4→5).
//             pubblica ctx.dati.contorno = { cabine, cp, capannone, cavo, alberi, strade, ponte }.
//  aggiorna(ctx, T, t, dt).
// =============================================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { altezza, fiumeX, letto, acqua, fbm, rumore, mulberry32, ss, clamp } from '../geo.js';
import { PIANURA, PALETTE, MATERIALI, OVERLAY } from '../config.js';
import {
  vec3Lin, materialeSuolo, meshSuolo, profonditaLift, normaliLift, geometriaChioma, texCemento,
  unisci, uvMondo, spazza, scatola,
} from './contorno-comune.js';
import {
  materialiEdifici, creaCabine, creaCP, creaLineaAT, creaCapannone, creaCasali, POSIZIONI_CASALI,
  materialeLinea, LINEE,
} from './contorno-edifici.js';

export const MONDO = 'pianura';

// TARATURA: proporre in config (PIANURA.alberi / strade / cavidotto)
const PASSO_STRADA = 0.5;                  // passo dei nastri stradali (u)
const SOPRA_STRADA = 0.02;                 // nastro stradale sopra il terreno (+ polygonOffset)
const SOPRA_CAVO = 0.045;                  // cavidotto: sopraSuolo di config più lo spessore della strada
const PASSO_CAVO = 0.5;
const DISTANZA_MIN_ALBERI = 0.5;
const PONTE_ESCLUSIONE = 5.5;              // ripa: esclusa attorno al ponte (≥ ±4 u di §3.4)
const IMPULSI = { scia: [0, 0.32, 0.64], int: [1, 0.5, 0.22], px: [9, 6.5, 5], punta: 13 };

// ---------------------------------------------------------------- polilinee lisce
/** Curva liscia (Catmull-Rom centripeta) campionata a passo costante → { punti: [x,z][], lunghezza }. */
function campiona(punti2, passo) {
  const c = new THREE.CatmullRomCurve3(punti2.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const L = c.getLength(), n = Math.max(2, Math.round(L / passo));
  return { punti: c.getSpacedPoints(n).map(v => [v.x, v.z]), lunghezza: L };
}
/** Polilinea spezzata ricampionata a passo costante (cavidotto: i vertici di config restano esatti). */
function ricampionaSpezzata(punti2, passo) {
  const seg = []; let L = 0;
  for (let i = 0; i < punti2.length - 1; i++) { const [a, b] = [punti2[i], punti2[i + 1]]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, L, l]); L += l; }
  const n = Math.max(2, Math.round(L / passo)), out = [];
  for (let k = 0; k <= n; k++) {
    const s = L * k / n; let j = 0; while (j < seg.length - 1 && s > seg[j][2] + seg[j][3]) j++;
    const [a, b, s0, l] = seg[j], f = clamp((s - s0) / l, 0, 1);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return { punti: out, lunghezza: L };
}
function distanzaPolilinea(x, z, P) {
  let d = Infinity;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (l2 || 1), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}

// ---------------------------------------------------------------- strade e ponte
/** Incrocio della SP con il fiume (cambio di segno di x − fiumeX(z)) sui punti campionati. */
function incrocioFiume(punti) {
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i][0] - fiumeX(punti[i][1]), b = punti[i + 1][0] - fiumeX(punti[i + 1][1]);
    if (a <= 0 && b > 0 || a >= 0 && b < 0) return i + a / (a - b);
  }
  return -1;
}
function nastroStrada(punti, larghezza, tagli = []) {
  const n = punti.length, pos = new Float32Array(n * 3 * 3), st = new Float32Array(n * 3 * 2), idx = [];
  let arco = 0;
  for (let i = 0; i < n; i++) {
    const a = punti[Math.max(0, i - 1)], b = punti[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) arco += Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]);
    for (let k = 0; k < 3; k++) {
      const s = (k - 1) * larghezza / 2, x = punti[i][0] - dz * s, z = punti[i][1] + dx * s, j = i * 3 + k;
      pos[3 * j] = x; pos[3 * j + 1] = altezza(x, z) + SOPRA_STRADA; pos[3 * j + 2] = z;
      st[2 * j] = k - 1; st[2 * j + 1] = arco;
    }
  }
  const tagliato = i => tagli.some(([i0, i1]) => i >= i0 && i <= i1);
  for (let i = 0; i < n - 1; i++) {
    if (tagliato(i) || tagliato(i + 1)) continue;
    for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStrada', new THREE.BufferAttribute(st, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function patchStrada(asfalto) {
  return sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aStrada; varying vec2 vStrada;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrada = aStrada;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vStrada;
float hashS(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float rumoreS(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashS(i), hashS(i + vec2(1.0, 0.0)), u.x), mix(hashS(i + vec2(0.0, 1.0)), hashS(i + vec2(1.0, 1.0)), u.x), u.y); }
float lineaS(float d, float w, float fw) { return 1.0 - smoothstep(0.5 * w, 0.5 * w + fw, abs(d)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  { float fwX = fwidth(vStrada.x), fwY = fwidth(vStrada.y);
    float usura = rumoreS(vec2(vStrada.x * 2.0, vStrada.y * 1.3)) * 0.6 + rumoreS(vStrada * vec2(9.0, 7.0)) * 0.4;
    diffuseColor.rgb *= 0.86 + 0.26 * usura;
    diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.78, 1.0, abs(vStrada.x));                 // banchina
${asfalto ? `    float vis = 1.0 - smoothstep(0.05, 0.16, fwX);                                         // anti-moiré
    float tratto = step(fract(vStrada.y / 1.2), 0.375) * (1.0 - smoothstep(0.1, 0.4, fwY));
    float seg = max(lineaS(abs(vStrada.x) - 0.84, 0.04, fwX), lineaS(vStrada.x, 0.035, fwX) * tratto);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.61, 0.57), seg * vis * 0.85);`
    : `    float solchi = exp(-pow((abs(vStrada.x) - 0.42) / 0.12, 2.0));
    diffuseColor.rgb *= 1.0 - 0.18 * solchi;`}
  }`);
  };
}

function creaStrade(ctx, M) {
  const S = PIANURA.strade, out = { mesh: [], sp: null, ponte: null };
  const asf = materialeSuolo(ctx, THREE.MeshStandardMaterial, {
    color: new THREE.Color(MATERIALI.asfalto.color), roughness: MATERIALI.asfalto.roughness, metalness: 0, envMapIntensity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  }, { chiave: 'asfalto', extra: patchStrada(true) });
  const gh = materialeSuolo(ctx, THREE.MeshStandardMaterial, {
    color: new THREE.Color(MATERIALI.ghiaia.color), roughness: 0.96, metalness: 0, envMapIntensity: 0.45,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  }, { chiave: 'ghiaia', extra: patchStrada(false) });
  // strada provinciale con taglio al ponte
  const sp = campiona(S.sp.punti, PASSO_STRADA); out.sp = sp;
  const ic = incrocioFiume(sp.punti);
  const nP = Math.round(PIANURA.ponte.impalcato[0] / 2 / PASSO_STRADA);
  const iC = Math.round(ic);
  const tagli = ic >= 0 ? [[iC - nP + 1, iC + nP - 1]] : [];
  const add = (g, mat) => {
    const m = meshSuolo(ctx, g, mat, { proietta: false });
    m.userData.noAO = true;                  // nastro quasi complanare al terreno: niente doppio AO
    ctx.scene.pianura.add(m); out.mesh.push(m);
  };
  add(nastroStrada(sp.punti, S.sp.larghezza, tagli), asf);
  for (const k of ['poderale', 'accessoCP', 'accessoCapannone']) {
    const c = campiona(S[k].punti, PASSO_STRADA);
    add(nastroStrada(c.punti, S[k].larghezza), gh);
  }
  if (ic >= 0) out.ponte = creaPonte(ctx, M, sp.punti, iC, nP);
  return out;
}
/** Ponte sulla SP (§3.4): impalcato 10 × 0,7 × 0,12 u con leggera monta, 2 pile allineate alla corrente, spalle. */
function creaPonte(ctx, M, punti, iC, nP) {
  const P = PIANURA.ponte, i0 = iC - nP, i1 = iC + nP;
  const a = punti[i0], b = punti[i1];
  const hA = altezza(a[0], a[1]) + SOPRA_STRADA + 0.004, hB = altezza(b[0], b[1]) + SOPRA_STRADA + 0.004;
  const centri = [], lc = [], lm = [];
  for (let i = i0; i <= i1; i++) {
    const f = (i - i0) / (i1 - i0), [x, z] = punti[i];
    centri.push([x, hA + (hB - hA) * f + 0.11 * Math.sin(Math.PI * f), z]);
  }
  spazza(lc, centri, P.impalcato[1], P.impalcato[2]);                                       // impalcato
  for (const off of [-0.335, 0.335]) spazza(lc, centri.map(c => [c[0], c[1] + 0.05, c[2]]), 0.03, 0.05, off);   // cordoli
  for (const off of [-0.34, 0.34]) spazza(lm, centri.map(c => [c[0], c[1] + 0.105, c[2]]), 0.012, 0.012, off);  // corrimano
  // montanti del parapetto
  for (let i = 0; i < centri.length; i += 1) {
    const c = centri[i], d = centri[Math.min(centri.length - 1, i + 1)], e = centri[Math.max(0, i - 1)];
    const dx = d[0] - e[0], dz = d[2] - e[2], l = Math.hypot(dx, dz) || 1;
    for (const off of [-0.34, 0.34]) scatola(lm, [0.01, 0.06, 0.01], [c[0] - dz / l * off, c[1] + 0.075, c[2] + dx / l * off]);
  }
  // pile a ±1,75 u dall'asse del fiume lungo la strada, allungate nella direzione della corrente
  const nPila = Math.round(1.75 / PASSO_STRADA);
  for (const k of [iC - nPila, iC + nPila]) {
    const [x, z] = punti[k], c = centri[k - i0];
    const d = (fiumeX(z + 0.01) - fiumeX(z - 0.01)) / 0.02, rot = Math.atan2(d, 1);
    const fondo = letto(z) - 0.1, cima = c[1] - P.impalcato[2];
    scatola(lc, [0.16, cima - fondo, 0.85], [x, (cima + fondo) / 2, z], rot);
    scatola(lc, [0.26, 0.05, 0.95], [x, cima - 0.025, z], rot);                              // pulvino
  }
  // spalle
  for (const [k, s] of [[i0, 1], [i1, -1]]) {
    const [x, z] = punti[k], c = centri[k - i0];
    const q = punti[k + s], ang = Math.atan2(q[0] - x, q[1] - z);
    scatola(lc, [0.9, 0.5, 0.35], [x, c[1] - 0.3, z], ang);
  }
  const g = uvMondo(unisci(lc));
  const G = new THREE.Group(); G.name = 'ponte';
  G.add(meshSuolo(ctx, g, M.cls), meshSuolo(ctx, unisci(lm), M.acciaio));
  ctx.scene.pianura.add(G);
  return { gruppo: G, centro: centri[nP] };
}

// ---------------------------------------------------------------- alberi (§3.4, §2.6)
function creaAlberi(ctx, sp, ponte) {
  const A = PIANURA.alberi, rnd = mulberry32(2718);
  const voci = [];                                         // [x, z, r, sy, tipo]
  const hashG = new Map(), CG = 1.0;
  const chiaveG = (i, j) => i * 100003 + j;
  const libero = (x, z, dmin) => {
    const i = Math.floor(x / CG), j = Math.floor(z / CG);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = hashG.get(chiaveG(i + a, j + b)); if (!l) continue;
      for (const [px, pz] of l) if ((px - x) ** 2 + (pz - z) ** 2 < dmin * dmin) return false;
    }
    return true;
  };
  const metti = (x, z, r, sy, tipo) => {
    const k = chiaveG(Math.floor(x / CG), Math.floor(z / CG));
    if (!hashG.has(k)) hashG.set(k, []); hashG.get(k).push([x, z]);
    voci.push([x, z, r, sy, tipo]);
  };
  const raggio = () => A.rMin + (A.rMax - A.rMin) * Math.pow(rnd(), 0.8);
  const bordoMondo = PIANURA.lato / 2 - 2;
  // strade in ghiaia (gli alberi non ci crescono sopra)
  const stradeGh = ['poderale', 'accessoCP', 'accessoCapannone'].map(k => PIANURA.strade[k].punti);
  const suStrada = (x, z, m) => distanzaPolilinea(x, z, sp.punti) < PIANURA.strade.sp.larghezza / 2 + m || stradeGh.some(P => distanzaPolilinea(x, z, P) < 0.3 + m);
  const nonQui = (x, z) => {
    if (Math.abs(x) > bordoMondo || Math.abs(z) > bordoMondo) return true;
    for (const p of PIANURA.PIANE) if (x > p[0] - 1 && x < p[1] + 1 && z > p[2] - 1 && z < p[3] + 1) return true;
    for (const [cx, cz] of POSIZIONI_CASALI) if (Math.hypot(x - cx, z - cz) < 2.4) return true;
    return false;
  };

  // 1) bosco (Natura 2000): ellisse di §3.3, bordo rumoroso, radure
  const V = PIANURA.vincoli.ambientale, [ecx, ecz] = V.centro, [ea, eb] = V.semiassi, cr = Math.cos(V.rotazione), sr = Math.sin(V.rotazione);
  let n = 0, tent = 0;
  while (n < PIANURA.bosco.alberi && tent++ < 200000) {
    const u = rnd() * 2 - 1, v = rnd() * 2 - 1; if (u * u + v * v > 1) continue;
    const lx = u * ea, lz = v * eb, x = ecx + lx * cr - lz * sr, z = ecz + lx * sr + lz * cr;
    const rho = Math.hypot(u, v) + (V.rumore / Math.min(ea, eb)) * 0.5 * fbm(x * 0.09, z * 0.09);
    if (rho > 0.9) continue;
    if (fbm(x * 0.045 + 7.1, z * 0.045 - 3.3) < -0.22 && rnd() < 0.85) continue;          // radure
    if (nonQui(x, z) || suStrada(x, z, 0.4)) continue;
    const r = raggio();
    if (!libero(x, z, Math.max(DISTANZA_MIN_ALBERI, r * 1.05))) continue;
    metti(x, z, r, 0.92 + rnd() * 0.22, 0); n++;
  }
  // 2) vegetazione di ripa: 2,8 < dF < 6, esclusi ponte e traversa (§3.4)
  const TR = PIANURA.traversa, pc = ponte ? ponte.centro : null;
  n = 0; tent = 0;
  while (n < PIANURA.ripa.alberi && tent++ < 200000) {
    const z = -bordoMondo + rnd() * 2 * bordoMondo, lato = rnd() < 0.5 ? -1 : 1;
    const dF = PIANURA.ripa.dFMin + (PIANURA.ripa.dFMax - PIANURA.ripa.dFMin) * Math.pow(rnd(), 1.3);
    const x = fiumeX(z) + lato * dF;
    if (rumore(z * 0.07 + lato * 13.1, 2.3) < -0.25) continue;                              // macchie, non una siepe continua
    if (pc && Math.hypot(x - pc[0], z - pc[2]) < PONTE_ESCLUSIONE) continue;
    if (Math.hypot(x - TR.centro[0], z - TR.centro[2]) < PIANURA.ripa.esclusione + 3.6) continue;   // traversa e muri d'ala
    if (Math.hypot(x - TR.centrale.x, z - TR.centro[2] - 1) < 3.2) continue;                // centrale
    if (z > TR.centro[2] - 21 && z < TR.centro[2] + 3 && dF < 4.4) continue;                 // muri dell'invaso
    if (nonQui(x, z) || suStrada(x, z, 0.5)) continue;
    const r = raggio() * (0.9 + 0.2 * rnd());
    if (!libero(x, z, Math.max(DISTANZA_MIN_ALBERI, r))) continue;
    metti(x, z, r, 1.0 + rnd() * 0.3, 1); n++;
  }
  // 3) filare lungo la SP tra x = −30 e x = 0, passo 1,2 u, sui due lati
  const F = PIANURA.filare;
  for (const lato of [-1, 1]) {
    for (let x = F.x0 + F.passo / 2; x < F.x1; x += F.passo) {
      // punto della SP a questa x e sua direzione
      let best = 0; for (let i = 1; i < sp.punti.length; i++) if (Math.abs(sp.punti[i][0] - x) < Math.abs(sp.punti[best][0] - x)) best = i;
      const p = sp.punti[best], q = sp.punti[Math.min(sp.punti.length - 1, best + 1)];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      const off = PIANURA.strade.sp.larghezza / 2 + 0.42;
      const tx = p[0] - dz / l * off * lato, tz = p[1] + dx / l * off * lato;
      if (stradeGh.some(P => distanzaPolilinea(tx, tz, P) < 0.9)) continue;
      metti(tx, tz, 0.3 + rnd() * 0.04, 1.45, 2);
    }
  }
  // istanze
  const geo = geometriaChioma();
  const mat = materialeSuolo(ctx, THREE.MeshStandardMaterial, {
    color: new THREE.Color(MATERIALI.alberi.color), roughness: MATERIALI.alberi.roughness, metalness: 0, envMapIntensity: 0.55,
  }, {
    chiave: 'alberi',
    extra: sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocY = position.y / 1.3;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLocY;')
        // chioma: più scura in basso e all'interno (occlusione), più chiara in cima
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(0.42, 1.18, smoothstep(-0.95, 0.85, vLocY));');
    },
  });
  const im = new THREE.InstancedMesh(geo, mat, voci.length);
  im.name = 'alberi';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const TINTE = [[0.95, 1.0, 0.92], [1.08, 1.1, 0.86], [0.85, 0.92, 0.88]];
  voci.forEach(([x, z, r, sy, tipo], i) => {
    const h = altezza(x, z);
    e.set((rnd() - 0.5) * 0.12, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.12); q.setFromEuler(e);
    const sxz = tipo === 2 ? r * 0.82 : r;
    s.set(sxz, r * sy, sxz); p.set(x, h + A.base * r * sy, z);
    m4.compose(p, q, s); im.setMatrixAt(i, m4);
    const v = 1 + (rnd() * 2 - 1) * MATERIALI.alberi.variazione, t = TINTE[tipo];
    c.setRGB(v * t[0], v * t[1] * (0.96 + 0.08 * rnd()), v * t[2]); im.setColorAt(i, c);
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = true; im.receiveShadow = true;
  im.customDepthMaterial = profonditaLift(ctx.U);
  im.userData.materialeNormali = normaliLift(ctx.U);
  ctx.scene.pianura.add(im);
  return im;
}

// ---------------------------------------------------------------- cavidotto MT (§2.7, §4.3, §4.6)
function creaCavo(ctx) {
  const C = PIANURA.cavidotto, O = OVERLAY.cavo;
  const { punti, lunghezza } = ricampionaSpezzata(C.punti, PASSO_CAVO);
  const P3 = punti.map(([x, z]) => new THREE.Vector3(x, altezza(x, z) + SOPRA_CAVO, z));
  const nSeg = P3.length - 1;
  const pos = new Float32Array(nSeg * 6);
  for (let i = 0; i < nSeg; i++) { P3[i].toArray(pos, i * 6); P3[i + 1].toArray(pos, i * 6 + 3); }
  const linea = (mat, dy = 0) => {
    const g = new LineSegmentsGeometry(); g.setPositions(pos);
    const l = new LineSegments2(g, mat); l.computeLineDistances(); l.position.y = dy;
    l.userData.noAO = true; l.visible = false; ctx.scene.pianura.add(l); return l;
  };
  const rame = new THREE.Color(PALETTE.rame).multiplyScalar(O.emissione);
  const oroC = new THREE.Color(PALETTE.oroChiaro).multiplyScalar(OVERLAY.layoutProposto.emissione);
  const lp = OVERLAY.layoutProposto;
  const mRame = materialeLinea(ctx, rame, O.px, { lift: false });
  const mProg = materialeLinea(ctx, oroC, lp.px, { lift: false, par: { dashed: true, dashSize: 0.9, gapSize: 0.6 } });
  const mScavo = materialeLinea(ctx, new THREE.Color(PALETTE.inchiostro), 4, { lift: false, par: { dashed: true, dashSize: 0.55, gapSize: 0.18 } });
  const lRame = linea(mRame), lProg = linea(mProg), lScavo = linea(mScavo, 0.004);
  lScavo.renderOrder = 2;
  // impulsi e punta: Points additivi (posizioni scritte in aggiorna, nessuna allocazione)
  const nImp = Math.ceil(lunghezza / O.impulsiPasso), nP = nImp * IMPULSI.scia.length + 1;
  const g = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(new Float32Array(nP * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aInt = new THREE.BufferAttribute(new Float32Array(nP), 1).setUsage(THREE.DynamicDrawUsage);
  const aDim = new THREE.BufferAttribute(new Float32Array(nP), 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aPos); g.setAttribute('aInt', aInt); g.setAttribute('aDim', aDim); g.setDrawRange(0, 0);
  const mImp = new THREE.ShaderMaterial({
    uniforms: { uPx: ctx.U.uPx, uColore: { value: new THREE.Color(PALETTE.oroChiaro).multiplyScalar(3.2) }, uPunta: { value: rame.clone().multiplyScalar(1.4) } },
    vertexShader: `attribute float aInt; attribute float aDim; uniform float uPx; varying float vInt;
      void main() { vInt = aInt; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aDim * uPx; }`,
    fragmentShader: `uniform vec3 uColore; uniform vec3 uPunta; varying float vInt;
      void main() { vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0; if (r2 > 1.0) discard;
        float a = exp(-r2 * 5.0) + 0.35 * exp(-r2 * 1.2) * (1.0 - r2);
        vec3 col = vInt > 1.2 ? mix(uColore, uPunta, 0.35) : uColore;
        gl_FragColor = vec4(col * min(vInt, 1.6), a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const impulsi = new THREE.Points(g, mImp);
  impulsi.frustumCulled = false; impulsi.userData.noAO = true; impulsi.visible = false; impulsi.renderOrder = 3;
  ctx.scene.pianura.add(impulsi);
  return { P3, punti: P3.map(v => v.toArray()), lunghezza, nSeg, nImp, lRame, lProg, lScavo, impulsi, aPos, aInt, aDim };
}

// ---------------------------------------------------------------- luci della CP: aloni e pozze di luce
function creaAloni(ctx, teste) {
  const col = new THREE.Color(PIANURA.cabinaPrimaria.luciColore);
  const pos = new Float32Array(teste.length * 3); teste.forEach((v, i) => v.toArray(pos, i * 3));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mA = new THREE.ShaderMaterial({
    uniforms: { uPx: ctx.U.uPx, uInt: { value: 0 }, uColore: { value: col.clone() } },
    vertexShader: `uniform float uPx; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(260.0 / -mv.z, 6.0, 40.0) * uPx; }`,
    fragmentShader: `uniform vec3 uColore; uniform float uInt; void main() { vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0;
      if (r2 > 1.0) discard; float a = exp(-r2 * 7.0) * 0.9 + exp(-r2 * 2.0) * 0.25; gl_FragColor = vec4(uColore * uInt, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const aloni = new THREE.Points(g, mA); aloni.userData.noAO = true; aloni.visible = false; aloni.renderOrder = 3;
  // pozze di luce sul piazzale (gradiente radiale additivo)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mP = new THREE.MeshBasicMaterial({ map: tex, color: col.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const lp = [];
  for (const v of teste) { const p = new THREE.PlaneGeometry(2.2, 2.2); p.rotateX(-Math.PI / 2); p.translate(v.x, altezza(v.x, v.z) + 0.05, v.z); lp.push(p); }
  const pozze = new THREE.Mesh(unisci(lp), mP); pozze.userData.noAO = true; pozze.visible = false; pozze.renderOrder = 2;
  ctx.scene.pianura.add(aloni, pozze);
  return { aloni, pozze, mA, mP };
}

// ---------------------------------------------------------------- modulo
const D = { pronto: false, tImp: 0, cabScala: -1 };

/** Costruzione (una volta). */
export async function crea(ctx) {
  const cem = await texCemento(ctx);
  const M = materialiEdifici(ctx, cem);
  const strade = creaStrade(ctx, M);
  const alberi = creaAlberi(ctx, strade.sp, strade.ponte);
  const cabine = creaCabine(ctx, M);
  const cp = creaCP(ctx, M);
  const lineaAT = creaLineaAT(ctx, M, cp.uscita);
  const capannone = creaCapannone(ctx, cem);
  const casali = creaCasali(ctx, M);
  ctx.scene.pianura.add(cabine, cp.gruppo, lineaAT, capannone.gruppo, casali);
  const cavo = creaCavo(ctx);
  const luci = creaAloni(ctx, cp.teste);
  Object.assign(D, { M, cabine, cp, capannone, cavo, luci, alberi, pronto: true });
  ctx.ancore.set('cavo.polilinea', cavo.P3);
  ctx.dati.contorno = {
    cabine, cp: cp.gruppo, capannone: capannone.gruppo, cavo: { rame: cavo.lRame, progetto: cavo.lProg, scavo: cavo.lScavo, impulsi: cavo.impulsi, polilinea: cavo.P3, lunghezza: cavo.lunghezza },
    alberi, strade: strade.mesh, ponte: strade.ponte?.gruppo || null, lineaAT, casali,
  };
}

/** Punto del cavidotto all'ascissa s (u) → scrive in arr a partire da o. */
function puntoCavo(C, s, arr, o) {
  const f = clamp(s / C.lunghezza, 0, 1) * C.nSeg, i = Math.min(C.nSeg - 1, Math.floor(f)), k = f - i;
  const a = C.P3[i], b = C.P3[i + 1];
  arr[o] = a.x + (b.x - a.x) * k; arr[o + 1] = a.y + (b.y - a.y) * k + 0.03; arr[o + 2] = a.z + (b.z - a.z) * k;
}

/** Ogni fotogramma (solo se il mondo del modulo è attivo). */
export function aggiorna(ctx, T, t, dt) {
  if (!D.pronto) return;
  const S = ctx.STATO, U = ctx.U;
  // larghezze delle linee in px CSS × uPx sul buffer interno (§2.7)
  for (const r of LINEE) { r.m.linewidth = r.px * U.uPx.value; r.m.resolution.copy(U.uRisoluzione.value); }

  // cabine al cancello: scala dalla base (power4.out è già nella traccia)
  const kc = S.cabine;
  if (kc !== D.cabScala) {
    D.cabine.scale.set(Math.max(kc, 1e-4), Math.max(kc, 1e-4), Math.max(kc, 1e-4));
    D.cabine.visible = kc > 0.001; D.cabScala = kc; ctx.ombre?.richiedi();
  }

  // luci della CP (emissivo × 3 all'ora blu)
  const l = S.luciCP;
  D.M.luci.emissiveIntensity = l;
  D.luci.aloni.visible = D.luci.pozze.visible = l > 0.01;
  D.luci.mA.uniforms.uInt.value = l * 0.9;
  D.luci.mP.opacity = clamp(l / 3, 0, 1) * 0.5;

  // cavidotto
  const C = D.cavo;
  const cavo = clamp(S.cavo, 0, 1), prog = S.cavoProgetto >= 0.5, scavo = clamp(S.cavoScavo, 0, 1);
  C.lRame.visible = cavo > 0.001 && !prog && scavo <= 0;
  C.lRame.geometry.instanceCount = Math.max(1, Math.ceil(cavo * C.nSeg));
  C.lProg.visible = prog;
  C.lScavo.visible = scavo > 0.001;
  C.lScavo.geometry.instanceCount = Math.max(1, Math.ceil(scavo * C.nSeg));

  // impulsi oro chiaro verso la CP (6 u/s, uno ogni 4 u) e punta del disegno
  if (!ctx.flags.riduci) D.tImp = (D.tImp + dt) % 1000;
  const O = OVERLAY.cavo, imp = S.impulsi, pos = C.aPos.array, ai = C.aInt.array, ad = C.aDim.array;
  let n = 0;
  if (C.lRame.visible && imp > 0.001) {
    const fine = cavo * C.lunghezza;
    for (let i = 0; i < C.nImp; i++) {
      const s0 = (D.tImp * O.impulsiVelocita + i * O.impulsiPasso) % C.lunghezza;
      for (let j = 0; j < IMPULSI.scia.length; j++) {
        const s = s0 - IMPULSI.scia[j]; if (s < 0 || s > fine) continue;
        puntoCavo(C, s, pos, n * 3);
        // gli impulsi nascono e muoiono dolcemente agli estremi
        ai[n] = imp * IMPULSI.int[j] * ss(0, 2, s) * (1 - ss(C.lunghezza - 2, C.lunghezza, s));
        ad[n] = IMPULSI.px[j]; n++;
      }
    }
  }
  const disegna = (cavo > 0.001 && cavo < 0.999 && C.lRame.visible) ? cavo : (scavo > 0.001 && scavo < 0.999 ? scavo : -1);
  if (disegna > 0) { puntoCavo(C, disegna * C.lunghezza, pos, n * 3); ai[n] = disegna === cavo ? 1.6 : 0.7; ad[n] = IMPULSI.punta; n++; }
  C.impulsi.visible = n > 0;
  C.impulsi.geometry.setDrawRange(0, n);
  if (n > 0) { C.aPos.needsUpdate = true; C.aInt.needsUpdate = true; C.aDim.needsUpdate = true; }
}
