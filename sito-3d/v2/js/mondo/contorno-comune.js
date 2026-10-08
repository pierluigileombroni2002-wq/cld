// =============================================================================
// ERI v2 · mondo/contorno-comune.js — file PRIVATO del pacchetto PIANURA (regola 0.1 di ARCHITETTURA.md)
// Usato solo da mondo/fiume.js e mondo/contorno.js: patch condivise (sollevamento della carta, carta/realtà,
// sottrazione), materiali comuni (calcestruzzo con UV in coordinate mondo), utilità di geometria.
// Specifica: DESIGN §4.1 (gli oggetti seguono lift), §6.5 (carta/realtà, fronte, sottrazione), §2.6 (calcestruzzo).
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { nuovoMateriale, aggiungiPatch } from '../luce/nebbia.js';
import { SOLLEVAMENTO_GLSL } from './terreno.js';
import { PALETTE, MATERIALI, OVERLAY } from '../config.js';

/** Colore di config (sRGB) → letterale GLSL in lineare. */
export function vec3Lin(hex, k = 1) {
  const c = new THREE.Color(hex);
  return `vec3(${(c.r * k).toFixed(5)}, ${(c.g * k).toFixed(5)}, ${(c.b * k).toFixed(5)})`;
}
const NO = OVERLAY.cartaOmbreggiatura.direzione;
const NO_GLSL = `normalize(vec3(${NO[0]}, ${NO[1]}, ${NO[2]}))`;

// ---------------------------------------------------------------- patch del vertice: sollevamento (§4.1)
// La quota mondo si moltiplica per lift(xz), come il terreno (aAltezza·lift): in tappa 0 tutto nasce dalla carta.
const LIFT_PROJECT = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 posMondoC = modelMatrix * mvPosition;
posMondoC.y *= lift( posMondoC.xz );
vPosMondoC = posMondoC.xyz;
mvPosition = viewMatrix * posMondoC;
gl_Position = projectionMatrix * mvPosition;`;
const LIFT_WORLDPOS = `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = posMondoC;
#endif`;

/** Patch del sollevamento per qualunque materiale con <project_vertex> (standard, profondità, normali, base). */
export function patchLift(U) {
  return sh => {
    sh.uniforms.uOnda = U.uOnda; sh.uniforms.uSitoC = U.uSitoC;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SOLLEVAMENTO_GLSL}\nvarying vec3 vPosMondoC;`)
      .replace('#include <project_vertex>', LIFT_PROJECT)
      .replace('#include <worldpos_vertex>', LIFT_WORLDPOS);
  };
}

// ---------------------------------------------------------------- patch del frammento: carta / realtà / sottrazione
// realtà = uRealta, oppure il fronte da SITO_C (§6.5). In carta l'albedo va alla grafite e si aggiunge
// l'ombreggiatura cartografica da NO (platino × 0,06). La sottrazione porta tutto al 15 % (il contorno non è mai idoneo).
const CARTA_PARS = `
uniform float uRealta; uniform float uFronteRealta; uniform float uSottrazione; uniform vec3 uSitoC;
varying vec3 vPosMondoC;
float realtaC() {
  float r = uRealta;
  if (uFronteRealta > 0.0) r = max(r, 1.0 - smoothstep(uFronteRealta - 4.0, uFronteRealta, distance(vPosMondoC.xz, uSitoC.xz)));
  return r;
}`;
export function patchCarta(U, opz = {}) {
  const carta = vec3Lin(opz.carta || PALETTE.grafite2);
  const sottr = OVERLAY.sottrazioneLuminanza.toFixed(3);
  const extraPars = opz.pars || '', dopoColore = opz.dopoColore || '', primaUscita = opz.primaUscita || '';
  return sh => {
    sh.uniforms.uRealta = U.uRealta; sh.uniforms.uFronteRealta = U.uFronteRealta;
    sh.uniforms.uSottrazione = U.uSottrazione; sh.uniforms.uSitoC = U.uSitoC;
    if (opz.uniforms) Object.assign(sh.uniforms, opz.uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${CARTA_PARS}\n${extraPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float kRealta = realtaC();
  ${dopoColore}
  diffuseColor.rgb = mix(${carta}, diffuseColor.rgb, kRealta);`)
      .replace('#include <opaque_fragment>', `
  ${primaUscita}
  outgoingLight *= mix(1.0, ${sottr}, uSottrazione);
  { vec3 nMondo = inverseTransformDirection(normal, viewMatrix);
    outgoingLight += ${vec3Lin(PALETTE.platino)} * 0.06 * clamp(dot(nMondo, ${NO_GLSL}), 0.0, 1.0) * (1.0 - kRealta); }
  #include <opaque_fragment>`);
  };
}

// ---------------------------------------------------------------- materiali condivisi
let _depth = null, _normali = null, _cemento = null;
/** MeshDepthMaterial (RGBA) con il sollevamento: customDepthMaterial di tutti gli oggetti sollevati. */
export function profonditaLift(U) {
  if (!_depth) {
    _depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    aggiungiPatch(_depth, patchLift(U), 'pianura-lift');
  }
  return _depth;
}
/** MeshNormalMaterial con il sollevamento: passaggio delle normali del GTAO (userData.materialeNormali). */
export function normaliLift(U) {
  if (!_normali) { _normali = new THREE.MeshNormalMaterial(); aggiungiPatch(_normali, patchLift(U), 'pianura-lift'); }
  return _normali;
}
/**
 * Materiale "di suolo": nuovoMateriale + sollevamento + carta/realtà/sottrazione (+ patch extra opzionale).
 * @param {object} ctx @param {typeof THREE.Material} Classe @param {object} par @param {{chiave:string, carta?:string, extra?:Function, pars?:string, dopoColore?:string, primaUscita?:string, uniforms?:object}} opz
 */
export function materialeSuolo(ctx, Classe, par, opz = {}) {
  const m = nuovoMateriale(Classe, par);
  aggiungiPatch(m, patchLift(ctx.U), 'pianura-lift');
  aggiungiPatch(m, patchCarta(ctx.U, opz), 'pianura-carta:' + (opz.chiave || 'base'));
  if (opz.extra) aggiungiPatch(m, opz.extra, 'pianura-extra:' + opz.chiave);
  return m;
}
/** Set cemento_diga (§2.6), caricato una volta; null se non disponibile (si usa il solo colore). */
export async function texCemento(ctx) {
  if (_cemento !== null) return _cemento;
  try { _cemento = await ctx.carica.texture('cemento_diga'); } catch (e) { _cemento = false; console.info('[pianura] cemento_diga non disponibile: calcestruzzo a tinta unita'); }
  return _cemento;
}
const _memo = new Map();
/** Calcestruzzo di §2.6 (UV in coordinate mondo · 0,25 u⁻¹ già scritte nella geometria con uvMondo). Condiviso per colore. */
export function materialeCalcestruzzo(ctx, tex, colore = MATERIALI.calcestruzzo.color, chiave = 'cls') {
  if (_memo.has('cls' + colore)) return _memo.get('cls' + colore);
  const m = _calcestruzzo(ctx, tex, colore, chiave); _memo.set('cls' + colore, m); return m;
}
function _calcestruzzo(ctx, tex, colore, chiave) {
  const par = { color: new THREE.Color(colore), roughness: 1, metalness: 0, envMapIntensity: MATERIALI.calcestruzzo.envMapIntensity };
  if (tex) Object.assign(par, { map: tex.diff, normalMap: tex.nor, roughnessMap: tex.arm, aoMap: tex.arm, aoMapIntensity: 0.8, normalScale: new THREE.Vector2(0.6, 0.6) });
  return materialeSuolo(ctx, THREE.MeshStandardMaterial, par, { chiave });
}

/** Metallo verniciato o zincato (pulito, procedurale: MAI metallo_lamiera). Condiviso per chiave. */
export function materialeMetallo(ctx, chiave, par) {
  if (_memo.has('met' + chiave)) return _memo.get('met' + chiave);
  const m = materialeSuolo(ctx, THREE.MeshStandardMaterial, Object.assign({ metalness: 0.6, roughness: 0.45, envMapIntensity: 0.9 }, par,
    { color: new THREE.Color(par.color) }), { chiave: 'met' });
  _memo.set('met' + chiave, m); return m;
}

// ---------------------------------------------------------------- utilità di geometria
/** Box nella lista (dimensioni [x,y,z], centro, rotazione attorno a y). */
export function scatola(lista, dim, pos, rotY = 0) {
  const g = new THREE.BoxGeometry(dim[0], dim[1], dim[2]);
  if (rotY) g.rotateY(rotY);
  g.translate(pos[0], pos[1], pos[2]); lista.push(g); return g;
}
/** Cilindro verticale (o lungo un asse con rot = [rx, ry, rz]). */
export function cilindro(lista, r0, r1, h, seg, pos, rot = null) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  if (rot) { if (rot[0]) g.rotateX(rot[0]); if (rot[2]) g.rotateZ(rot[2]); if (rot[1]) g.rotateY(rot[1]); }
  g.translate(pos[0], pos[1], pos[2]); lista.push(g); return g;
}
/** Trasforma con una matrice tutte le geometrie aggiunte alla lista dall'indice i0 in poi. */
export function trasforma(lista, i0, m) { for (let i = i0; i < lista.length; i++) lista[i].applyMatrix4(m); }
/** Unisce (tutte non indicizzate, solo position/normal/uv). */
export function unisci(lista) {
  const pul = lista.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  const g = mergeGeometries(pul, false);
  for (const x of lista) x.dispose();
  return g;
}
/** UV a proiezione per faccia in coordinate mondo (scala u⁻¹): calcestruzzo, ghiaia (§2.6). */
export function uvMondo(g, s = MATERIALI.calcestruzzo.uvScala, origine = [0, 0, 0]) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + origine[0], y = p.getY(i) + origine[1], z = p.getZ(i) + origine[2];
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x * s, z * s); else if (ax >= az) uv.setXY(i, z * s, y * s); else uv.setXY(i, x * s, y * s);
  }
  uv.needsUpdate = true; return g;
}
/** Prisma triangolare (timpano / falda): triangolo nel piano yz estruso lungo x da x0 a x1. */
export function prisma(lista, x0, x1, punti) {
  // forma nel piano (−z, y): dopo la rotazione di +90° attorno a y la x della forma diventa z
  const s = new THREE.Shape(); s.moveTo(-punti[0][0], punti[0][1]); for (let i = 1; i < punti.length; i++) s.lineTo(-punti[i][0], punti[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  // Shape in (x→z, y→y): ruota attorno a y così l'estrusione (z) va lungo x
  g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
  lista.push(g); return g;
}
/**
 * Spazzata di una sezione rettangolare lungo una polilinea 3D (ponte, passerelle).
 * @param {number[][]} centri punti [x,y,z] dell'asse (bordo SUPERIORE della sezione)
 * @param {number} larg larghezza, @param {number} alt altezza (verso il basso), @param {number} off spostamento laterale
 */
export function spazza(lista, centri, larg, alt, off = 0) {
  const n = centri.length, pos = [];
  const V = [];
  for (let i = 0; i < n; i++) {
    const a = centri[Math.max(0, i - 1)], b = centri[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[2] - a[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz, nz = dx, c = centri[i];
    const l = off - larg / 2, r = off + larg / 2;
    V.push([[c[0] + nx * l, c[1], c[2] + nz * l], [c[0] + nx * r, c[1], c[2] + nz * r],
            [c[0] + nx * r, c[1] - alt, c[2] + nz * r], [c[0] + nx * l, c[1] - alt, c[2] + nz * l]]);
  }
  const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (let i = 0; i < n - 1; i++) {
    const A = V[i], B = V[i + 1];
    quad(A[0], B[0], B[1], A[1]);   // sopra
    quad(A[1], B[1], B[2], A[2]);   // lato destro
    quad(A[2], B[2], B[3], A[3]);   // sotto
    quad(A[3], B[3], B[0], A[0]);   // lato sinistro
  }
  const capo = (Q, inv) => inv ? quad(Q[0], Q[1], Q[2], Q[3]) : quad(Q[3], Q[2], Q[1], Q[0]);
  capo(V[0], false); capo(V[n - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  lista.push(g); return g;
}
/** Mesh "di suolo": ombre, profondità e normali col sollevamento. */
export function meshSuolo(ctx, geo, mat, { proietta = true, riceve = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = proietta; m.receiveShadow = riceve;
  m.customDepthMaterial = profonditaLift(ctx.U);
  m.userData.materialeNormali = normaliLift(ctx.U);
  return m;
}
/** Chioma: icosaedro (1,1) a vertici fusi, bitorzoluto, schiacciato a (1; 1,3; 1) (§3.4), normali lisce. */
export function geometriaChioma(seme = 7) {
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.13 * Math.sin(x * 5.1 + seme) * Math.cos(z * 4.3 - y * 2.7) + 0.06 * Math.sin(y * 9.0 + x * 3.0);
    p.setXYZ(i, x * k, y * k * 1.3 - (y < -0.5 ? 0.12 * (y + 0.5) : 0), z * k);
  }
  g.computeVertexNormals();
  return g;
}
