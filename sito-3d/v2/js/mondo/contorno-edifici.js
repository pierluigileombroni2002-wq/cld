// =============================================================================
// ERI v2 · mondo/contorno-edifici.js — file PRIVATO del pacchetto PIANURA (regola 0.1), usato solo da contorno.js
// Edifici e impianti del contorno: cabine al cancello, cabina primaria AT/MT (trasformatori, portali, sbarre,
// apparecchiature, edificio comandi, luci calde), linea AT con tralicci, capannone aziendale con scansione
// termica in scala oro, casali della campagna.
// Specifica: DESIGN §3.4 (luoghi e dimensioni), §2.6 (calcestruzzo), §4.3 (luciCP), §4.6 (cabine, termica).
// Tutto in coordinate locali di un gruppo appoggiato su altezza(); il sollevamento usa modelMatrix (patchLift).
// =============================================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { altezza, mulberry32 } from '../geo.js';
import { aggiungiPatch } from '../luce/nebbia.js';
import { SOLLEVAMENTO_GLSL } from './terreno.js';
import { PIANURA, PALETTE, MATERIALI } from '../config.js';
import {
  vec3Lin, materialeSuolo, materialeCalcestruzzo, materialeMetallo, meshSuolo,
  scatola, cilindro, unisci, uvMondo, prisma,
} from './contorno-comune.js';

// ---------------------------------------------------------------- linee nello spazio (LineSegments2)
/** Patch del sollevamento per LineMaterial (estremi dei segmenti in coordinate mondo × lift). */
export function patchLiftLinea(U) {
  return sh => {
    sh.uniforms.uOnda = U.uOnda; sh.uniforms.uSitoC = U.uSitoC;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SOLLEVAMENTO_GLSL}`)
      .replace('vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
        'vec4 wS = modelMatrix * vec4( instanceStart, 1.0 ); wS.y *= lift( wS.xz ); vec4 start = viewMatrix * wS;')
      .replace('vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
        'vec4 wE = modelMatrix * vec4( instanceEnd, 1.0 ); wE.y *= lift( wE.xz ); vec4 end = viewMatrix * wE;');
  };
}
/** Registro delle LineMaterial: aggiorna() scrive larghezza (px CSS × uPx) e risoluzione del buffer. */
export const LINEE = [];
export function materialeLinea(ctx, colore, px, opz = {}) {
  const m = new LineMaterial(Object.assign({ color: colore, linewidth: px, worldUnits: false, fog: false }, opz.par || {}));
  if (opz.lift !== false) aggiungiPatch(m, patchLiftLinea(ctx.U), 'linea-lift');
  LINEE.push({ m, px });
  return m;
}
/** LineSegments2 da coppie di punti [x,y,z]. */
export function linee(coppie, mat) {
  const pos = new Float32Array(coppie.length * 6);
  coppie.forEach(([a, b], i) => { pos.set(a, i * 6); pos.set(b, i * 6 + 3); });
  const g = new LineSegmentsGeometry(); g.setPositions(pos);
  const l = new LineSegments2(g, mat); l.userData.noAO = true;
  return l;
}
/** Catenaria fra due punti (n tratti, freccia f) → coppie. */
function catenaria(a, b, f, n, out) {
  let p = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * f * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    out.push([p, q]); p = q;
  }
}

// ---------------------------------------------------------------- materiali degli edifici
export function materialiEdifici(ctx, cem) {
  const M = {};
  M.cls = materialeCalcestruzzo(ctx, cem);
  M.cabine = materialeCalcestruzzo(ctx, cem, MATERIALI.cabine.color);
  M.piazzale = materialeCalcestruzzo(ctx, cem, '#8d877c');
  M.acciaio = materialeMetallo(ctx, 'zincato', { color: MATERIALI.acciaio.color, metalness: 1, roughness: 0.45, envMapIntensity: MATERIALI.acciaio.envMapIntensity });
  M.grigio = materialeMetallo(ctx, 'grigio', { color: '#7d868b', metalness: 0.55, roughness: 0.42 });
  M.verniciato = materialeMetallo(ctx, 'trasformatore', { color: '#6c7479', metalness: 0.25, roughness: 0.5, envMapIntensity: 0.8 });
  M.scuro = materialeMetallo(ctx, 'scuro', { color: '#262c30', metalness: 0.35, roughness: 0.38 });
  M.porte = materialeMetallo(ctx, 'porte', { color: '#4f5b58', metalness: 0.35, roughness: 0.55 });
  M.porcellana = materialeSuolo(ctx, THREE.MeshStandardMaterial, { color: new THREE.Color('#5a3426'), roughness: 0.22, metalness: 0, envMapIntensity: 1.0 }, { chiave: 'porcellana' });
  M.intonaco = materialeSuolo(ctx, THREE.MeshStandardMaterial, { color: new THREE.Color('#cbbfa8'), roughness: 0.95, metalness: 0, envMapIntensity: 0.5 }, { chiave: 'intonaco' });
  M.coppi = materialeSuolo(ctx, THREE.MeshStandardMaterial, { color: new THREE.Color('#9a5a3e'), roughness: 0.82, metalness: 0, envMapIntensity: 0.5 }, { chiave: 'coppi' });
  M.lamieraGrigia = materialeMetallo(ctx, 'lamiera', { color: '#59606a', metalness: 0.5, roughness: 0.5 });
  // vetri e lampade: emissivo caldo × STATO.luciCP (§4.3)
  M.luci = materialeSuolo(ctx, THREE.MeshStandardMaterial, {
    color: new THREE.Color('#1b2227'), roughness: 0.18, metalness: 0, envMapIntensity: 1.0,
    emissive: new THREE.Color(PIANURA.cabinaPrimaria.luciColore), emissiveIntensity: 0,
  }, { chiave: 'luci' });
  return M;
}

// ---------------------------------------------------------------- cabine al cancello (§3.4, §4.6)
export function creaCabine(ctx, M) {
  const C = PIANURA.cabineCancello;
  const [cx, cz] = C.centro, h = altezza(cx, cz);
  const G = new THREE.Group(); G.name = 'cabine'; G.position.set(cx, h, cz);
  const lc = [], lp = [], ls = [];
  const corpo = (dim, x) => {           // dim = [lungo (N-S), largo (E-O), alto] in u
    const [L, W, H] = dim;
    scatola(lc, [W + 0.03, 0.025, L + 0.03], [x, 0.0125, 0]);                 // basamento
    scatola(lc, [W, H, L], [x, 0.025 + H / 2, 0]);                             // monoblocco prefabbricato
    scatola(lc, [W + 0.024, 0.016, L + 0.024], [x, 0.025 + H + 0.008, 0]);     // copertura con gocciolatoio
    const nP = Math.max(2, Math.round(L / 0.32));
    for (let k = 0; k < nP; k++) {
      const z = -L / 2 + (k + 0.5) * L / nP;
      for (const lato of [-1, 1]) {
        scatola(lp, [0.006, 0.2, 0.11], [x + lato * (W / 2 + 0.003), 0.025 + 0.1 + 0.005, z]);        // porte
        scatola(ls, [0.006, 0.035, 0.08], [x + lato * (W / 2 + 0.004), 0.025 + H - 0.03, z]);         // griglie di aerazione
      }
    }
  };
  corpo(C.consegna, -0.165);
  corpo(C.utente, 0.165);
  const gc = uvMondo(unisci(lc), undefined, [cx, h, cz]);
  G.add(meshSuolo(ctx, gc, M.cabine), meshSuolo(ctx, unisci(lp), M.porte), meshSuolo(ctx, unisci(ls), M.scuro));
  return G;
}

// ---------------------------------------------------------------- cabina primaria AT/MT (§3.4, §4.3)
export function creaCP(ctx, M) {
  const CP = PIANURA.cabinaPrimaria;
  const [cx, cz] = CP.centro, h = altezza(cx, cz);
  const G = new THREE.Group(); G.name = 'cabina-primaria'; G.position.set(cx, h, cz);
  const [PX, PZ] = CP.piazzale, hx = PX / 2, hz = PZ / 2;
  const lc = [], lpz = [], la = [], lv = [], lpo = [], lsc = [], lu = [], lg = [];
  // piazzale e fondazioni
  scatola(lpz, [PX, 0.04, PZ], [0, 0.0, 0]);
  // trasformatori AT/MT
  const XT = [-3.0, 3.0], ZT = 0.5;
  for (const X of XT) {
    scatola(lc, [1.3, 0.08, 1.05], [X, 0.04, ZT]);                                     // basamento con vasca olio
    scatola(lv, [0.62, 0.52, 0.48], [X, 0.08 + 0.26, ZT]);                             // cassa
    scatola(lv, [0.66, 0.03, 0.52], [X, 0.615, ZT]);                                   // coperchio
    for (const lato of [-1, 1]) {
      for (let k = 0; k < 8; k++) scatola(lv, [0.17, 0.42, 0.012], [X + lato * 0.405, 0.33, ZT - 0.2 + k * 0.057]);   // radiatori
      cilindro(lv, 0.012, 0.012, 0.44, 8, [X + lato * 0.405, 0.56, ZT], [Math.PI / 2, 0, 0]);
      cilindro(lv, 0.012, 0.012, 0.44, 8, [X + lato * 0.405, 0.12, ZT], [Math.PI / 2, 0, 0]);
    }
    cilindro(lv, 0.062, 0.062, 0.46, 16, [X - 0.04, 0.86, ZT + 0.2], [0, 0, Math.PI / 2]);           // conservatore
    for (const dx of [-0.16, 0.08]) scatola(lv, [0.02, 0.22, 0.02], [X + dx, 0.73, ZT + 0.2]);
    for (let k = 0; k < 3; k++) {                                                      // isolatori passanti AT
      const bx = X - 0.18 + k * 0.18, bz = ZT - 0.12;
      cilindro(la, 0.02, 0.026, 0.34, 10, [bx, 0.8, bz]);
      for (let d = 0; d < 5; d++) cilindro(la, 0.042, 0.042, 0.012, 12, [bx, 0.67 + d * 0.06, bz]);
      cilindro(lsc, 0.012, 0.012, 0.05, 8, [bx, 0.995, bz]);
    }
    for (let k = 0; k < 3; k++) cilindro(la, 0.016, 0.02, 0.13, 10, [X - 0.12 + k * 0.12, 0.69, ZT + 0.16]);   // passanti MT
  }
  // portali (4) con montanti 0,05 u e altezza 1,4 u, cimini per la fune di guardia
  const XP = [-4.5, -1.5, 1.5, 4.5], ZP = [-3.25, -1.95], HP = CP.altezzaPortale, mt = CP.montante;
  for (const X of XP) {
    for (const Z of ZP) {
      scatola(lpo, [mt, HP, mt], [X, HP / 2, Z]);
      scatola(lpo, [mt * 0.6, 0.22, mt * 0.6], [X, HP + 0.11, Z]);
      scatola(lc, [0.16, 0.05, 0.16], [X, 0.025, Z]);
      // controventi a croce sul montante (lettura "a traliccio")
      for (let y = 0.15; y < HP - 0.1; y += 0.3) scatola(lpo, [mt * 1.05, 0.012, mt * 1.05], [X, y, Z]);
    }
    scatola(lpo, [0.05, 0.06, 1.42], [X, HP - 0.03, -2.6]);                             // traversa
  }
  // apparecchiature di stallo (interruttori, TA/TV, sezionatori) per ciascun trasformatore
  const fasi = [-0.22, 0, 0.22];
  const coppie = [];
  const ZF = [-2.95, -2.6, -2.25], yS = 1.28;
  for (const X of XT) {
    fasi.forEach((dx, k) => {
      const xb = X + dx;
      scatola(lpo, [0.04, 0.3, 0.04], [xb, 0.15, -1.45]); cilindro(la, 0.032, 0.036, 0.26, 10, [xb, 0.43, -1.45]);   // interruttore
      scatola(lpo, [0.04, 0.28, 0.04], [xb, 0.14, -0.85]); cilindro(la, 0.03, 0.03, 0.2, 10, [xb, 0.38, -0.85]);     // TA
      cilindro(la, 0.026, 0.03, 0.22, 10, [xb, yS - 0.16, ZF[k]]);                                                      // isolatore di sospensione
      // collegamenti: sbarra → interruttore → TA → passante AT
      coppie.push([[xb, yS - 0.27, ZF[k]], [xb, 0.57, -1.45]], [[xb, 0.57, -1.45], [xb, 0.49, -0.85]],
                  [[xb, 0.49, -0.85], [X - 0.18 + k * 0.18, 1.0, ZT - 0.12]]);
    });
  }
  // sbarre AT (3 fasi lungo x fra i portali)
  ZF.forEach(z => coppie.push([[XP[0], yS, z], [XP[3], yS, z]]));
  for (const X of XP) ZF.forEach(z => coppie.push([[X, HP - 0.06, z], [X, yS, z]]));
  // fune di guardia
  coppie.push([[XP[0], HP + 0.22, ZP[0]], [XP[3], HP + 0.22, ZP[0]]], [[XP[0], HP + 0.22, ZP[1]], [XP[3], HP + 0.22, ZP[1]]]);
  // edificio comandi e quadri MT (lato sud, dove arriva il cavidotto)
  const EB = { x: -3.0, z: 2.8, L: 4.6, P: 0.85, H: 0.42 };
  scatola(lc, [EB.L, EB.H, EB.P], [EB.x, EB.H / 2, EB.z]);
  scatola(lc, [EB.L + 0.04, 0.04, EB.P + 0.04], [EB.x, EB.H + 0.02, EB.z]);
  for (let k = 0; k < 7; k++) for (const lato of [-1, 1]) scatola(lu, [0.22, 0.12, 0.01], [EB.x - 1.95 + k * 0.65, 0.25, EB.z + lato * (EB.P / 2 + 0.005)]);
  scatola(lu, [0.01, 0.12, 0.3], [EB.x + EB.L / 2 + 0.005, 0.25, EB.z]);
  scatola(lpo, [0.16, 0.26, 0.012], [EB.x + 1.9, 0.13, EB.z + EB.P / 2 + 0.008]);
  scatola(lc, [1.5, 0.3, 0.6], [3.4, 0.15, 2.9]);                                       // locale MT di consegna
  for (let k = 0; k < 3; k++) scatola(lpo, [0.14, 0.22, 0.01], [2.95 + k * 0.45, 0.12, 3.205]);
  // pali della luce con armatura calda
  const LAMPADE = [[-5.6, -3.6], [5.6, -3.6], [-5.6, 3.55], [5.6, 3.55], [0, -0.9], [0.9, 1.9], [-0.9, 1.9]];
  const testa = [];
  for (const [x, z] of LAMPADE) {
    const vx = -Math.sign(x) * 0.08 || 0.06, vz = -Math.sign(z) * 0.06;
    cilindro(lsc, 0.011, 0.016, 0.8, 6, [x, 0.4, z]);
    scatola(lsc, [0.02, 0.02, 0.02], [x + vx * 0.5, 0.79, z + vz * 0.5]);
    scatola(lu, [0.09, 0.022, 0.05], [x + vx, 0.785, z + vz]);
    testa.push([x + vx, 0.77, z + vz]);
  }
  // recinzione: paletti ogni 0,5 u e due correnti, cancello a sud
  const rx = hx - 0.12, rz = hz - 0.12, giro = [];
  for (let x = -rx; x <= rx + 1e-6; x += 0.5) giro.push([x, -rz], [x, rz]);
  for (let z = -rz + 0.5; z < rz - 1e-6; z += 0.5) giro.push([-rx, z], [rx, z]);
  for (const [x, z] of giro) { if (z > 0 && Math.abs(x) < 0.7) continue; scatola(lg, [0.014, 0.23, 0.014], [x, 0.115, z]); }
  for (const y of [0.04, 0.22]) {
    scatola(lg, [2 * rx, 0.008, 0.008], [0, y, -rz]);
    scatola(lg, [rx - 0.7, 0.008, 0.008], [-(rx + 0.7) / 2, y, rz]); scatola(lg, [rx - 0.7, 0.008, 0.008], [(rx + 0.7) / 2, y, rz]);
    scatola(lg, [0.008, 0.008, 2 * rz], [-rx, y, 0]); scatola(lg, [0.008, 0.008, 2 * rz], [rx, y, 0]);
  }
  const o = [cx, h, cz];
  G.add(meshSuolo(ctx, uvMondo(unisci(lpz), undefined, o), M.piazzale, { proietta: false }),
        meshSuolo(ctx, uvMondo(unisci(lc), undefined, o), M.cls),
        meshSuolo(ctx, unisci(lv), M.verniciato), meshSuolo(ctx, unisci(la), M.porcellana),
        meshSuolo(ctx, unisci(lpo), M.acciaio), meshSuolo(ctx, unisci(lsc), M.scuro),
        meshSuolo(ctx, unisci(lu), M.luci), meshSuolo(ctx, unisci(lg), M.grigio));
  const mLinee = materialeLinea(ctx, new THREE.Color('#8b9398'), 1.1);
  G.add(linee(coppie, mLinee));
  // punti di aggancio della linea AT in uscita (verso nord): fasi sul portale ovest
  const uscita = ZF.map(z => new THREE.Vector3(XP[0], HP - 0.08, z).add(G.position));
  const teste = testa.map(p => new THREE.Vector3(p[0] + cx, p[1] + h, p[2] + cz));
  return { gruppo: G, teste, uscita };
}

// ---------------------------------------------------------------- linea AT e tralicci
export function creaLineaAT(ctx, M, uscita) {
  const PUNTI = [[121.6, -71], [117.4, -88], [112.8, -105], [107.5, -122]];   // TARATURA: tracciato verso il crinale nord
  const lst = [], coppie = [];
  const H = 2.9;
  let prec = uscita.map(v => [v.x, v.y, v.z]);
  PUNTI.forEach(([x, z], i) => {
    const y = altezza(x, z);
    const [nx2, nz2] = PUNTI[i + 1] || [x - (PUNTI[i - 1][0] - x), z - (PUNTI[i - 1][1] - z)];
    const ang = Math.atan2(nx2 - x, nz2 - z);               // direzione della linea
    const m = new THREE.Matrix4().makeRotationY(ang).setPosition(x, y, z);
    const i0 = lst.length;
    const fusto = new THREE.CylinderGeometry(0.07, 0.34, H, 4, 1, true); fusto.rotateY(Math.PI / 4); fusto.translate(0, H / 2, 0); lst.push(fusto);
    scatola(lst, [1.5, 0.05, 0.07], [0, H * 0.78, 0]);
    scatola(lst, [1.1, 0.05, 0.07], [0, H * 0.93, 0]);
    cilindro(lst, 0.0, 0.07, 0.3, 4, [0, H + 0.15, 0]);
    for (let k = 0; k < 4; k++) scatola(lst, [0.5, 0.025, 0.025], [0, H * (0.18 + k * 0.15), 0]);
    for (let k = i0; k < lst.length; k++) lst[k].applyMatrix4(m);
    const bracci = [[-0.7, H * 0.78 - 0.1], [0.7, H * 0.78 - 0.1], [0, H * 0.93 - 0.1]];
    const ora = bracci.map(([bx, by]) => new THREE.Vector3(bx, by, 0).applyMatrix4(m)).map(v => [v.x, v.y, v.z]);
    for (let f = 0; f < 3; f++) catenaria(prec[f], ora[f], i === 0 ? 0.08 : 0.32, 14, coppie);
    prec = ora;
  });
  const G = new THREE.Group(); G.name = 'linea-at';
  G.add(meshSuolo(ctx, unisci(lst), M.acciaio));
  G.add(linee(coppie, materialeLinea(ctx, new THREE.Color('#7f878c'), 1.0)));
  return G;
}

// ---------------------------------------------------------------- capannone aziendale + scansione termica (§3.4, §4.6)
function patchTermica(U, centro) {
  const C0 = vec3Lin('#2a1c10'), ORO = vec3Lin(PALETTE.oro), CH = vec3Lin(PALETTE.oroChiaro);
  return {
    uniforms: { uTermica: U.termica, uCentroCap: { value: centro } },
    pars: `uniform float uTermica; uniform vec3 uCentroCap;
float hashT(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
float rumoreT(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashT(i), hashT(i + vec2(1.0, 0.0)), u.x), mix(hashT(i + vec2(0.0, 1.0)), hashT(i + vec2(1.0, 1.0)), u.x), u.y); }`,
    dopoColore: `
  vec3 lpT = vPosMondoC - uCentroCap;
  float fronteT = mix(-2.7, 2.7, uTermica);
  float kT = (1.0 - smoothstep(fronteT - 0.4, fronteT, lpT.x)) * step(0.001, uTermica);
  float calore = 0.16;
  calore += 0.62 * smoothstep(0.78, 0.95, lpT.y);                                                   // colmo
  float fx = fract(lpT.x / 0.5 + 0.5);
  calore += 0.55 * step(0.36, lpT.y) * step(lpT.y, 0.54) * step(0.12, fx) * step(fx, 0.84) * step(0.84, abs(lpT.z));   // finestre
  calore += 0.5 * step(1.97, lpT.x) * step(abs(lpT.z), 0.36) * step(lpT.y, 0.52);                 // portone
  calore += 0.2 * smoothstep(0.6, 0.7, lpT.y) * step(lpT.y, 0.72);                                 // ponte termico in gronda
  calore += 0.3 * (rumoreT(lpT.xz * 3.1 + lpT.y * 1.7) - 0.45) + 0.12 * (rumoreT(lpT.xy * 9.0) - 0.5);
  calore = clamp(calore, 0.0, 1.0);
  vec3 rampaT = calore < 0.5 ? mix(${C0}, ${ORO}, calore * 2.0) : mix(${ORO}, ${CH}, (calore - 0.5) * 2.0);
  diffuseColor.rgb *= 1.0 - 0.88 * kT;`,
    primaUscita: `
  outgoingLight = mix(outgoingLight, outgoingLight * 0.15, kT);
  outgoingLight += rampaT * (0.25 + 1.6 * calore * calore) * kT;
  outgoingLight += ${CH} * 2.4 * exp(-pow((lpT.x - fronteT) / 0.05, 2.0)) * step(0.001, uTermica) * step(uTermica, 0.999);`,
  };
}
export function creaCapannone(ctx, cem) {
  const K = PIANURA.capannone;
  const [cx, cz] = K.centro, h = altezza(cx, cz);
  const [L, W] = K.dim, Hm = K.muri, Hc = K.colmo;
  const centro = new THREE.Vector3(cx, h, cz);
  const G = new THREE.Group(); G.name = 'capannone'; G.position.copy(centro);
  const pt = patchTermica(ctx.U, centro);
  const opzT = (chiave) => Object.assign({ chiave }, pt);
  const tex = cem || null;
  const parCls = { color: new THREE.Color(MATERIALI.calcestruzzo.color), roughness: 1, metalness: 0, envMapIntensity: MATERIALI.calcestruzzo.envMapIntensity };
  if (tex) Object.assign(parCls, { map: tex.diff, normalMap: tex.nor, roughnessMap: tex.arm, normalScale: new THREE.Vector2(0.6, 0.6) });
  const mMuri = materialeSuolo(ctx, THREE.MeshStandardMaterial, parCls, opzT('capannone-muri'));
  const mTetto = materialeSuolo(ctx, THREE.MeshStandardMaterial, { color: new THREE.Color(MATERIALI.tettoCapannone.color), metalness: 0.55, roughness: 0.42, envMapIntensity: 0.9 }, opzT('capannone-tetto'));
  const mSerr = materialeSuolo(ctx, THREE.MeshStandardMaterial, { color: new THREE.Color('#121a1f'), metalness: 0.1, roughness: 0.16, envMapIntensity: 1.1 }, opzT('capannone-serramenti'));
  // muri a pannelli prefabbricati + timpani
  const lm = [], ls = [];
  scatola(lm, [L, 0.03, W + 0.06], [0, 0.015, 0]);
  scatola(lm, [L, Hm, W], [0, Hm / 2, 0]);
  prisma(lm, -L / 2, L / 2, [[-W / 2, Hm - 0.001], [W / 2, Hm - 0.001], [0, Hm + Hc - 0.01]]);
  for (let x = -L / 2 + 0.5; x < L / 2 - 0.01; x += 0.5) for (const lato of [-1, 1]) scatola(lm, [0.02, Hm, 0.008], [x, Hm / 2, lato * (W / 2 + 0.004)]);   // giunti dei pannelli
  // finestre a nastro sui lati lunghi, portone e porta sul timpano est
  for (let x = -L / 2 + 0.25 + 0.06; x < L / 2 - 0.2; x += 0.5) for (const lato of [-1, 1]) scatola(ls, [0.34, 0.15, 0.012], [x + 0.13, 0.45, lato * (W / 2 + 0.006)]);
  scatola(ls, [0.012, 0.46, 0.64], [L / 2 + 0.006, 0.23, 0]);
  scatola(ls, [0.012, 0.22, 0.1], [L / 2 + 0.006, 0.11, 0.6]);
  scatola(ls, [0.012, 0.16, 0.5], [-L / 2 - 0.006, 0.45, 0]);
  const gm = uvMondo(unisci(lm), undefined, [cx, h, cz]);
  // copertura in lamiera grecata: geometria vera (le greche prendono la luce radente)
  const sporto = 0.09, nx = Math.round((L + 2 * sporto) / 0.02), pos = [], idx = [];
  const falda = Math.hypot(W / 2 + sporto, Hc + sporto * Hc / (W / 2));
  for (const lato of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= nx; i++) {
      const x = -L / 2 - sporto + (L + 2 * sporto) * i / nx;
      const fase = (x / 0.2) % 1, greca = 0.012 * (Math.abs(((fase + 1) % 1) - 0.5) < 0.18 ? 1 : 0);
      for (const t of [0, 1]) {                     // 0 = colmo, 1 = gronda
        const zz = lato * t * (W / 2 + sporto), yy = Hm + Hc - t * (Hc + sporto * Hc / (W / 2)) + 0.012;
        const nz = lato * Hc / falda, ny = (W / 2 + sporto) / falda;   // normale della falda
        pos.push(x, yy + greca * ny, zz + greca * nz);
      }
    }
    for (let i = 0; i < nx; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (lato > 0) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
    }
  }
  const gt = new THREE.BufferGeometry();
  gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setIndex(idx); gt.computeVertexNormals();
  G.add(meshSuolo(ctx, gm, mMuri), meshSuolo(ctx, gt, mTetto), meshSuolo(ctx, unisci(ls), mSerr));
  return { gruppo: G, materiali: [mMuri, mTetto, mSerr] };
}

/** Tetto a capanna: due falde sottili con sporto; colmo lungo x a z = zc. */
function tettoCapanna(lista, x0, x1, zc, larg, yG, hC, sporto = 0.05, sp = 0.022) {
  const ang = Math.atan2(hC, larg / 2), semi = larg / 2 + sporto, lungo = semi / Math.cos(ang), caduta = semi * Math.tan(ang);
  for (const lato of [-1, 1]) {
    const g = new THREE.BoxGeometry(x1 - x0 + 2 * sporto, sp, lungo);
    g.rotateX(lato * ang);
    g.translate((x0 + x1) / 2, yG + hC - caduta / 2 + sp / 2, zc + lato * semi / 2);
    lista.push(g);
  }
}

// ---------------------------------------------------------------- casali della campagna (contesto)
// TARATURA: posizioni scelte fuori da siti, vincoli, bosco, fasce fluviali e strade
const CASALI = [[-37, -41.5, 0.12], [69, -45, -0.08], [124, 13, 0.3], [-29, 63, -0.2], [53, 67, 0.05], [150, -20, 0.15]];
export function creaCasali(ctx, M) {
  const rnd = mulberry32(91);
  const lm = [], lt = [], lg = [];
  for (const [x, z, a] of CASALI) {
    const y = Math.min(altezza(x - 1, z - 1), altezza(x + 1, z + 1), altezza(x, z)) - 0.03;
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(x, y, z);
    const i0 = [lm.length, lt.length, lg.length];
    // casa padronale a due piani (1,1 × 0,7 u), sottotetto intonacato e tetto a capanna in coppi
    scatola(lm, [1.1, 0.62, 0.7], [0, 0.31, 0]);
    prisma(lm, -0.55, 0.55, [[-0.35, 0.6], [0.35, 0.6], [0, 0.78]]);
    tettoCapanna(lt, -0.55, 0.55, 0, 0.7, 0.62, 0.18);
    // annesso agricolo (fienile) con tetto in lamiera, più basso
    const dx = 1.15 + rnd() * 0.3;
    scatola(lm, [1.3, 0.42, 0.8], [dx + 0.1, 0.21, 0.35]);
    prisma(lm, dx - 0.55, dx + 0.75, [[-0.05, 0.41], [0.75, 0.41], [0.35, 0.55]]);
    tettoCapanna(lg, dx - 0.55, dx + 0.75, 0.35, 0.8, 0.42, 0.14);
    // piccolo ricovero attrezzi
    scatola(lm, [0.5, 0.3, 0.45], [-0.78, 0.15, -0.22]);
    tettoCapanna(lt, -1.03, -0.53, -0.22, 0.45, 0.3, 0.08);
    for (let k = i0[0]; k < lm.length; k++) lm[k].applyMatrix4(m);
    for (let k = i0[1]; k < lt.length; k++) lt[k].applyMatrix4(m);
    for (let k = i0[2]; k < lg.length; k++) lg[k].applyMatrix4(m);
  }
  const G = new THREE.Group(); G.name = 'casali';
  G.add(meshSuolo(ctx, unisci(lm), M.intonaco), meshSuolo(ctx, unisci(lt), M.coppi), meshSuolo(ctx, unisci(lg), M.lamieraGrigia));
  return G;
}
export const POSIZIONI_CASALI = CASALI;
