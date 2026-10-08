// =============================================================================
// ERI v2 · mondo/fiume.js — fiume (nastro d'acqua), normal map procedurale dell'acqua, traversa
// Proprietario: [PIANURA]. Stato: COMPLETO ([PIANURA-CONTORNO]).
// Specifica: DESIGN §3.1 (fiumeX, acqua), §2.6 fiume e laghi, §6.7 "Acqua" (nastro, normal map su canvas 512², schiuma),
// §3.4 traversa, §4.1 (STATO.fiume, uFiumeMappa).
//
// Cosa c'è:
//  - nastro BufferGeometry lungo fiumeX(z) alla quota acqua(z); a monte della traversa il pelo libero sale di 0,4 u
//    (invaso tra muri d'ala) e scende sulla soglia con una fascia di schiuma. La larghezza si adatta alle sponde
//    vere (ricerca del bordo bagnato su altezza(), più un orlo che scende sotto il terreno): niente bordi sospesi.
//  - MeshPhysicalMaterial di §2.6; due campioni della normal map che scorrono a valle (§6.7); clearcoat increspato;
//    riflessi d'ambiente attenuati vicino alle sponde (la sponda "si specchia" scura); acqua bassa più chiara ai bordi.
//  - modo carta (uFiumeMappa in tappa 0, poi 1 − realtà): riempimento acqua × 0,25 e bordi di 1 px × 1,5 (§6.5), come
//    il fiume disegnato dal terreno, così il passaggio di testimone è continuo; sottrazione (§4.2) e fronte di realtà.
//  - opacità da STATO.fiume; sollevamento lift() come il terreno (tappa 0).
//  - traversa con paratoie, pile, passerella, muri d'ala e centrale ad acqua fluente sulla sponda est (§3.4).
//  - normal map dell'acqua generata su canvas (somma periodica di onde + Sobel a 4 campioni), condivisa con la VALLE.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  export function texturaNormaleAcqua(): THREE.Texture | null — memoizzata; la VALLE la usa per i laghi.
//  crea(ctx): pubblica ctx.dati.fiume = { mesh, normaleAcqua, traversa }.
//  aggiorna(ctx, T, t, dt).
// =============================================================================
import * as THREE from 'three';
import { fiumeX, letto, acqua, altezza, ss, mulberry32 } from '../geo.js';
import { nuovoMateriale, aggiungiPatch } from '../luce/nebbia.js';
import { PIANURA, MATERIALI, PALETTE, OVERLAY } from '../config.js';
import {
  patchLift, vec3Lin, meshSuolo, materialeCalcestruzzo, materialeMetallo, texCemento,
  scatola, unisci, uvMondo, spazza,
} from './contorno-comune.js';

export const MONDO = 'pianura';

// ---------------------------------------------------------------- tarature locali
// TARATURA: proporre in config (PIANURA.fiume / PIANURA.traversa)
const PASSO_Z = 0.5;            // passo delle sezioni del nastro (u)
const PASSO_FINE = 0.06;        // passo vicino alla soglia
const INVASO = 30;              // lunghezza della rampa dell'invaso a monte (u)
const MURI = { monte: 20, valle: 2.5, s: 3.6, spessore: 0.15, rientro: 1.3 };   // muri d'ala lungo l'invaso
const ORLO = { fuori: 0.25, giu: 0.9, cala: 0.45 };                // orlo del nastro sotto il terreno
const SCALA_UV = 4;             // 1 tessera della normal map ogni 4 u (40 m)

// ---------------------------------------------------------------- normal map dell'acqua (§6.7)
let _normaleAcqua = null;
/**
 * Normal map procedurale dell'acqua: canvas 512², somma di onde con vettori d'onda interi (tessera periodica),
 * spettro ∝ k^−1,15, creste per lo più allineate alla corrente; normali con differenze centrali (Sobel a 4 campioni).
 * RepeatWrapping, NoColorSpace. Memoizzata. null fuori dal browser.
 */
export function texturaNormaleAcqua() {
  if (_normaleAcqua) return _normaleAcqua;
  if (typeof document === 'undefined') return null;
  const N = 512, TAB = 4096, K = TAB / N;
  const seno = new Float32Array(TAB);
  for (let i = 0; i < TAB; i++) seno[i] = Math.sin(2 * Math.PI * i / TAB);
  const rnd = mulberry32(4127);
  const onde = [];
  for (let i = 0; i < 56; i++) {
    const k = 2 + Math.floor(Math.pow(rnd(), 1.7) * 46);                 // cicli per tessera
    // 65 % delle onde con vettore quasi trasversale: strisce allungate lungo la corrente
    const ang = rnd() < 0.65 ? (rnd() - 0.5) * 0.9 : rnd() * Math.PI * 2;
    const kx = Math.round(k * Math.cos(ang)), ky = Math.round(k * Math.sin(ang));
    if (!kx && !ky) continue;
    onde.push([kx * K, ky * K, Math.floor(rnd() * TAB), 1 / Math.pow(Math.hypot(kx, ky), 1.15)]);
  }
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0;
    for (let w = 0; w < onde.length; w++) { const o = onde[w]; s += o[3] * seno[(o[0] * x + o[1] * y + o[2]) & (TAB - 1)]; }
    // creste un po' più aguzze (acqua mossa, non sinusoidi pulite)
    h[y * N + x] = s - 0.35 * Math.abs(s) * s;
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const F = 9.0;                                                         // pendenza dell'increspatura
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + N) % N, yp = (y + 1) % N;
    const dx = (h[y * N + xp] - h[y * N + xm]) * 0.5, dy = (h[yp * N + x] - h[ym * N + x]) * 0.5;
    let nx = -dx * F, ny = -dy * F, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const j = (y * N + x) * 4;
    d[j] = (nx * 0.5 + 0.5) * 255; d[j + 1] = (ny * 0.5 + 0.5) * 255; d[j + 2] = (nz * 0.5 + 0.5) * 255; d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.name = 'normale-acqua';
  _normaleAcqua = t;
  return t;
}

// ---------------------------------------------------------------- profilo del pelo libero
const TR = PIANURA.traversa, ZW = TR.centro[2], SALTO = TR.salto;
const dFiume = z => (fiumeX(z + 0.01) - fiumeX(z - 0.01)) / 0.02;
/** Fattore d'invaso: 1 a monte della soglia (rampa di INVASO u), 0 a valle; il salto avviene sulla soglia. */
const invaso = z => ss(ZW - INVASO, ZW - 4, z) * (1 - ss(ZW - TR.soglia[1] * 0.55, ZW + TR.soglia[1] * 0.75, z));
/** Quota del pelo libero (u), traversa compresa. */
export const peloLibero = z => acqua(z) + SALTO * invaso(z);
/** Distanza dei muri d'ala dall'asse (0 = niente muro). */
function muroS(z) {
  if (z < ZW - MURI.monte || z > ZW + MURI.valle) return 0;
  return MURI.s - MURI.rientro * (1 - ss(ZW - MURI.monte, ZW - MURI.monte + 5, z));   // si allarga verso la soglia
}
/** Asse e versori in z: P, tangente t (a valle), normale n (verso est). */
function telaio(z, out) {
  const d = dFiume(z), L = Math.hypot(d, 1);
  out.x = fiumeX(z); out.z = z; out.tx = d / L; out.tz = 1 / L; out.nx = 1 / L; out.nz = -d / L;
  return out;
}
/** Bordo bagnato su un lato (segno ±1): prima distanza dove il terreno supera il pelo libero. */
function bordo(F, livello, segno, sMax) {
  for (let s = 1.2; s <= sMax; s += 0.04) {
    if (altezza(F.x + F.nx * s * segno, F.z + F.nz * s * segno) >= livello) return s;
  }
  return sMax;
}

// ---------------------------------------------------------------- geometria del nastro
function creaNastro() {
  const z0 = -PIANURA.lato / 2 - 1, z1 = PIANURA.lato / 2 + 1;
  const zs = [];
  for (let z = z0; z <= z1 + 1e-6; z += PASSO_Z) {
    if (z > ZW - 2 && z < ZW + 4) continue;
    zs.push(z);
  }
  for (let z = ZW - 2; z < ZW + 4; z += PASSO_FINE) zs.push(z);
  zs.sort((a, b) => a - b);

  const NI = 10;                                   // segmenti interni della sezione
  const colonne = NI + 1 + 4;                      // + orlo (2 per lato)
  const nS = zs.length, nV = nS * colonne;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), bor = new Float32Array(nV), sch = new Float32Array(nV);
  const F = {}, Fp = {};
  let arco = 0;
  const sCol = new Float32Array(colonne), yCol = new Float32Array(colonne);
  for (let i = 0; i < nS; i++) {
    const z = zs[i]; telaio(z, F);
    if (i > 0) { telaio(zs[i - 1], Fp); arco += Math.hypot(F.x - Fp.x, F.z - Fp.z); }
    const L = peloLibero(z), mS = muroS(z);
    let eL, eR;
    if (mS > 0 && z < ZW + 0.2) { eL = eR = mS - MURI.spessore / 2 - 0.02; }            // invaso tra i muri
    else { const sMax = mS > 0 ? mS : 6.5; eL = bordo(F, L, -1, sMax); eR = bordo(F, L, 1, sMax); }
    // colonne: orlo esterno, orlo, interno (NI+1), orlo, orlo esterno
    sCol[0] = -eL - ORLO.giu; yCol[0] = L - ORLO.cala;
    sCol[1] = -eL - ORLO.fuori; yCol[1] = L;
    for (let k = 0; k <= NI; k++) { sCol[2 + k] = -eL + (eL + eR) * k / NI; yCol[2 + k] = L; }
    sCol[colonne - 2] = eR + ORLO.fuori; yCol[colonne - 2] = L;
    sCol[colonne - 1] = eR + ORLO.giu; yCol[colonne - 1] = L - ORLO.cala;
    // schiuma della soglia (salto del pelo libero e risalto a valle)
    const dz = z - ZW;
    const schiumaSoglia = ss(-0.45, -0.05, dz) * Math.exp(-Math.max(0, dz - 0.35) / 1.7) * (dz < 7 ? 1 : 0);
    for (let k = 0; k < colonne; k++) {
      const s = sCol[k], j = i * colonne + k;
      pos[3 * j] = F.x + F.nx * s; pos[3 * j + 1] = yCol[k]; pos[3 * j + 2] = F.z + F.nz * s;
      uv[2 * j] = s / SCALA_UV; uv[2 * j + 1] = -arco / SCALA_UV;          // −arco: la normal map scorre a valle
      bor[j] = Math.min(s + eL, eR - s);
      // scarico della centrale (sponda est, appena a valle della soglia)
      const scarico = dz > 0.8 && dz < 6 ? Math.exp(-(((s - (eR - 0.6)) / 0.7) ** 2)) * Math.exp(-(dz - 0.8) / 2.2) * 0.7 : 0;
      sch[j] = Math.min(1, schiumaSoglia + scarico);
    }
  }
  const idx = [];
  for (let i = 0; i < nS - 1; i++) for (let k = 0; k < colonne - 1; k++) {
    const a = i * colonne + k, b = a + 1, c = a + colonne, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aBordo', new THREE.BufferAttribute(bor, 1));
  g.setAttribute('aSchiuma', new THREE.BufferAttribute(sch, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // le normali dell'acqua sono verticali (l'orlo inclinato non deve cambiare i riflessi)
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- shader dell'acqua
function patchAcqua(U, loc) {
  const ACQUA = vec3Lin(PALETTE.acqua), SCHIUMA = vec3Lin(PALETTE.avorio, 0.85), BASSA = vec3Lin('#1f2e2a');
  const FC = OVERLAY.fiumeCarta;
  return sh => {
    Object.assign(sh.uniforms, {
      uTempoAcqua: loc.uTempoAcqua, uFiumeMappa: U.uFiumeMappa, uRealta: U.uRealta, uFronteRealta: U.uFronteRealta,
      uSottrazione: U.uSottrazione, uPx: U.uPx, uSitoC: U.uSitoC,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aBordo; attribute float aSchiuma; varying float vBordo; varying float vSchiuma;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBordo = aBordo; vSchiuma = aSchiuma;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTempoAcqua; uniform float uFiumeMappa; uniform float uRealta; uniform float uFronteRealta;
uniform float uSottrazione; uniform float uPx; uniform vec3 uSitoC;
varying float vBordo; varying float vSchiuma; varying vec3 vPosMondoC;
float hashA(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rumoreA(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashA(i), hashA(i + vec2(1.0, 0.0)), u.x), mix(hashA(i + vec2(0.0, 1.0)), hashA(i + vec2(1.0, 1.0)), u.x), u.y); }`)
      // colore: acqua bassa vicino alle sponde, schiuma (bordi e soglia) che scorre con la corrente
      .replace('#include <color_fragment>', `#include <color_fragment>
  float realtaA = uRealta;
  if (uFronteRealta > 0.0) realtaA = max(realtaA, 1.0 - smoothstep(uFronteRealta - 4.0, uFronteRealta, distance(vPosMondoC.xz, uSitoC.xz)));
  vec2 uvS = vNormalMapUv + vec2(0.0, uTempoAcqua * 0.05);
  float nS1 = rumoreA(vec2(uvS.x * 9.0, uvS.y * 5.0)), nS2 = rumoreA(vec2(uvS.x * 31.0, (uvS.y + uTempoAcqua * 0.04) * 17.0));
  float fBordo = (1.0 - smoothstep(0.0, 0.2, vBordo)) * smoothstep(0.42, 0.78, nS1 * 0.7 + nS2 * 0.45);
  float fSalto = vSchiuma * smoothstep(0.2, 0.75, nS2 * 0.65 + nS1 * 0.5 + vSchiuma * 0.35);
  float schiuma = clamp(fBordo * 0.7 + fSalto, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${BASSA}, (1.0 - smoothstep(0.0, 0.9, vBordo)) * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${SCHIUMA}, schiuma * 0.9);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.55, schiuma);`)
      // due campioni della normal map che scorrono a valle (§6.7), più forti nella schiuma
      .replace('#include <normal_fragment_maps>', `{
  vec2 uvA = vNormalMapUv + vec2(0.0, uTempoAcqua * 0.05);
  vec2 uvB = vNormalMapUv * 1.7 + vec2(0.02, uTempoAcqua * 0.08);
  vec3 nA = texture2D(normalMap, uvA).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(normalMap, uvB).xyz * 2.0 - 1.0;
  vec3 mapN = normalize(vec3(nA.xy + nB.xy, nA.z * nB.z));
  mapN.xy *= normalScale * (1.0 + 1.6 * schiuma);
  normal = normalize(tbn * mapN);
}`)
      // il clearcoat segue in parte l'increspatura: riflesso del cielo mosso, non uno specchio piatto
      .replace('#include <clearcoat_normal_fragment_begin>', `#ifdef USE_CLEARCOAT
  vec3 clearcoatNormal = normalize(mix(nonPerturbedNormal, normal, 0.55));
#endif`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= 1.0 - schiuma;
#endif`)
      // le sponde "si specchiano": riflessi d'ambiente più scuri vicino ai bordi
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular )
  { float rivaR = mix(0.3, 1.0, smoothstep(0.0, 1.5, vBordo));
    radiance *= rivaR;
  #ifdef USE_CLEARCOAT
    clearcoatRadiance *= rivaR;
  #endif
  }
#endif`)
      // modo carta: riempimento acqua × 0,25 e bordi di 1 px × 1,5 (come il fiume disegnato dal terreno, §6.5)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float mappa = max(uFiumeMappa, 1.0 - realtaA);
    float fw = max(fwidth(vBordo), 1e-4);
    float dB = abs(vBordo - 0.06);
    float linea = 1.0 - smoothstep(0.5 * fw * uPx, 0.5 * fw * uPx + fw, dB);
    totalEmissiveRadiance += ${ACQUA} * (${FC.riempimento.toFixed(3)} + ${FC.bordo.toFixed(3)} * linea) * mappa;
    totalEmissiveRadiance += ${SCHIUMA} * schiuma * 0.15; }`)
      .replace('#include <opaque_fragment>', `
  outgoingLight *= mix(1.0, ${OVERLAY.sottrazioneLuminanza.toFixed(3)}, uSottrazione);
  #include <opaque_fragment>`);
  };
}

// ---------------------------------------------------------------- traversa e centrale (§3.4)
function creaTraversa(ctx, cls, metallo, scuro) {
  const F = telaio(ZW, {});
  const rotY = Math.atan2(-F.nz, F.nx);               // x locale lungo n (attraverso), z locale lungo t (a valle)
  const base = TR.centro[1];                          // = letto(ZW): la soglia poggia sul fondo
  const Lmonte = acqua(ZW) + SALTO;
  const topPile = Lmonte + 0.32;
  const M = new THREE.Matrix4().makeRotationY(rotY).setPosition(F.x, 0, F.z);
  const lc = [], lm = [], ls = [];
  // soglia 7 × 0,6 × 0,4 u perpendicolare al fiume
  scatola(lc, [TR.soglia[0], TR.soglia[2], TR.soglia[1]], [0, base + TR.soglia[2] / 2, 0]);
  // vasca di dissipazione a valle (fondo chiaro sotto la schiuma)
  scatola(lc, [TR.soglia[0], 0.08, 1.8], [0, base - 0.02, 1.2]);
  // pile (2 spalle + 3 pile interne) con rostro a monte, passerella, parapetti
  const xs = [-3.55, -1.775, 0, 1.775, 3.55];
  xs.forEach((x, i) => {
    const sp = i === 0 || i === 4 ? 0.3 : 0.16;
    scatola(lc, [sp, topPile - base, 1.05], [x, (topPile + base) / 2, -0.12]);
    if (i > 0 && i < 4) scatola(lc, [sp * 0.7, topPile - base - 0.1, 0.22], [x, (topPile + base) / 2 - 0.05, -0.72]);
    scatola(lm, [0.24, 0.16, 0.42], [x, topPile + 0.08, -0.14]);       // argani delle paratoie
  });
  scatola(lc, [7.5, 0.06, 0.5], [0, topPile + 0.03, -0.12]);           // passerella
  for (const dz of [-0.36, 0.12]) scatola(lm, [7.5, 0.012, 0.012], [0, topPile + 0.1, dz]);
  for (let x = -3.6; x <= 3.61; x += 0.3) for (const dz of [-0.36, 0.12]) scatola(lm, [0.01, 0.1, 0.01], [x, topPile + 0.06, dz]);
  // paratoie (4 luci): sollevate di poco, l'acqua passa sotto e trabocca
  for (let i = 0; i < 4; i++) { const x = (xs[i] + xs[i + 1]) / 2; scatola(ls, [1.58, 0.36, 0.05], [x, Lmonte - 0.25, -0.42]); }
  for (const g of lc) g.applyMatrix4(M);
  for (const g of lm) g.applyMatrix4(M);
  for (const g of ls) g.applyMatrix4(M);
  // muri d'ala lungo l'invaso (seguono la curva dell'asse)
  for (const lato of [-1, 1]) {
    const centri = [];
    for (let z = ZW - MURI.monte; z <= ZW + MURI.valle + 1e-6; z += 0.5) {
      const Q = telaio(z, {}), s = muroS(z) * lato;
      centri.push([Q.x + Q.nx * s, Math.max(peloLibero(z), acqua(z) + 0.2) + 0.1, Q.z + Q.nz * s]);
    }
    spazza(lc, centri, MURI.spessore, 1.4);
  }
  // centrale ad acqua fluente sulla sponda est (centro x = −72,5): 2,4 (lungo la corrente) × 1,6 × 1,0 u
  const C = TR.centrale, sC = C.x - F.x;               // ≈ 5 u dall'asse
  const piede = Math.min(altezza(F.x + F.nx * (sC - 0.8), F.z + F.nz * (sC - 0.8)), altezza(F.x + F.nx * (sC + 0.8), F.z + F.nz * (sC + 0.8))) - 0.05;
  const lc2 = [], lm2 = [], ls2 = [];
  const [Lc, Wc, Hc] = [C.dim[0], C.dim[1], C.dim[2]];
  scatola(lc2, [Wc, Hc, Lc], [sC, piede + Hc / 2, 0.55]);                              // sala macchine
  scatola(lc2, [Wc + 0.06, 0.05, Lc + 0.06], [sC, piede + Hc + 0.025, 0.55]);          // cornicione
  scatola(lc2, [Wc * 0.62, Hc * 0.55, 0.9], [sC + 0.25, piede + Hc * 0.275, 0.55 + Lc / 2 + 0.45]);   // locale quadri
  scatola(lc2, [1.0, 0.3, 0.6], [sC - Wc / 2 - 0.4, piede + 0.1, 0.0]);                // opera di presa
  for (let k = 0; k < 4; k++) scatola(ls2, [0.012, 0.42, 0.16], [sC - Wc / 2 - 0.005, piede + 0.55, 0.0 + k * 0.5]);   // vetrate (lato fiume)
  for (let k = 0; k < 3; k++) scatola(ls2, [0.18, 0.22, 0.012], [sC - 0.45 + k * 0.45, piede + 0.62, 0.55 - Lc / 2 - 0.006]);
  scatola(lm2, [Wc * 0.9, 0.04, 0.04], [sC, piede + Hc + 0.12, 0.55 - Lc * 0.3]);     // carroponte esterno
  scatola(lm2, [Wc * 0.9, 0.04, 0.04], [sC, piede + Hc + 0.12, 0.55 + Lc * 0.3]);
  scatola(lm2, [0.3, 0.26, 0.24], [sC + 0.45, piede + 0.13, 0.55 + Lc / 2 + 1.15]);    // trasformatore
  for (const g of [...lc2, ...lm2, ...ls2]) g.applyMatrix4(M);
  lc.push(...lc2); lm.push(...lm2); ls.push(...ls2);

  const gc = uvMondo(unisci(lc)), gm = unisci(lm), gs = unisci(ls);
  const G = new THREE.Group(); G.name = 'traversa';
  G.add(meshSuolo(ctx, gc, cls), meshSuolo(ctx, gm, metallo), meshSuolo(ctx, gs, scuro));
  return G;
}

// ---------------------------------------------------------------- modulo
const D = { mesh: null, mat: null, loc: { uTempoAcqua: { value: 0 } } };

/** Costruzione (una volta). */
export async function crea(ctx) {
  const { U } = ctx;
  const tex = texturaNormaleAcqua();
  if (tex && ctx.renderer) tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const P = MATERIALI.fiume;
  const mat = nuovoMateriale(THREE.MeshPhysicalMaterial, {
    color: new THREE.Color(P.color), roughness: P.roughness, metalness: P.metalness,
    clearcoat: P.clearcoat, clearcoatRoughness: P.clearcoatRoughness, envMapIntensity: P.envMapIntensity,
    normalMap: tex, normalScale: new THREE.Vector2(P.normalScale, P.normalScale),
    transparent: true, opacity: 0, depthWrite: true,
  });
  aggiungiPatch(mat, patchLift(U), 'pianura-lift');
  aggiungiPatch(mat, patchAcqua(U, D.loc), 'fiume-acqua');
  const mesh = new THREE.Mesh(creaNastro(), mat);
  mesh.name = 'fiume'; mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.userData.noAO = true; mesh.renderOrder = 1; mesh.visible = false;
  ctx.scene.pianura.add(mesh);
  D.mesh = mesh; D.mat = mat;

  // traversa e centrale
  const cem = await texCemento(ctx);
  const cls = materialeCalcestruzzo(ctx, cem || null);
  const metallo = materialeMetallo(ctx, 'grigio', { color: '#7d868b', metalness: 0.55, roughness: 0.42 });
  const scuro = materialeMetallo(ctx, 'scuro', { color: '#262c30', metalness: 0.35, roughness: 0.38 });
  const traversa = creaTraversa(ctx, cls, metallo, scuro);
  ctx.scene.pianura.add(traversa);

  ctx.dati.fiume = { mesh, normaleAcqua: tex, traversa };
}

/** Ogni fotogramma (solo se il mondo del modulo è attivo). */
export function aggiorna(ctx, T, t, dt) {
  if (!D.mesh) return;
  const a = ctx.STATO.fiume;
  D.mat.opacity = a;
  D.mesh.visible = a > 0.002;
  if (!ctx.flags.riduci) D.loc.uTempoAcqua.value = (D.loc.uTempoAcqua.value + dt) % 2000;
}
