// =============================================================================
// ERI v2 · impianti/agri-campo.js — base comune delle colture realistiche dell'agrivoltaico
// Proprietario: [FV]. File privato di impianti/agri.js (regola 0.1): si importa solo da agri.js e da agri-*.js.
// Anteprima per il cliente: ?coltura=grano|ortaggi|prato (senza parametro restano le strisce di agri.js).
//
// Cosa offre alle tre colture (agri-grano.js, agri-ortaggi.js, agri-prato.js):
//  - descrizione del campo: contorno, linee dei pali (esclusione 0,05 u), fasce coltivate fra i pali, chiave dell'onda;
//  - GLSL comune: rumore, maschere del campo, vento a onde lunghe (raffiche che viaggiano, U.uTempo, fermo con riduci);
//  - suolo: mesh sul solo campo agrivoltaico (stesso reticolo del terreno, appena sopra), materiale proprio della coltura,
//    compare con l'onda comparsaAgri;
//  - istanze: InstancedBufferGeometry a blocchi lungo z (frustum culling per blocco), densità che cala con la distanza
//    dal percorso della camera nel vicolo (K3.65 → K3.8): fitte dove la camera passa, rade dove si vedono da lontano;
//  - materiale delle piante: MeshStandardMaterial con patch del vertice (posizione calcolata nello shader), traslucenza
//    in controluce, alfa di copertura (alphaToCoverage con MSAA) e le varianti ombra (customDepthMaterial) e normali (GTAO)
//    con la stessa patch.
// Tutto si crea in crea(); in aggiorna() si scrivono solo uniform.
// =============================================================================
import * as THREE from 'three';
import { LAYOUT, PIANURA, AGRI_C, PALETTE, MATERIALI } from '../config.js';
import { altezza, mulberry32 } from '../geo.js';
import { nuovoMateriale } from '../luce/nebbia.js';

const A = LAYOUT.agri, CO = LAYOUT.colture;
export const f5 = v => (+v).toFixed(5);
/** Colore di config (sRGB) → letterale GLSL in lineare (× k). */
export const vec3Lin = (hex, k = 1) => { const c = new THREE.Color(hex).multiplyScalar(k); return `vec3( ${f5(c.r)}, ${f5(c.g)}, ${f5(c.b)} )`; };

// TARATURA: proporre in config (LAYOUT.colture) — vento a onde lunghe: verso (x, z) in cui soffia, lunghezza d'onda
// e velocità delle raffiche (u, u/s), ampiezza della piega in cima (frazione dell'altezza)
export const VENTO = { dir: [0.8, 0.6], lambda: 2.2, vel: 0.55, ampiezza: 1.0 };
// TARATURA: densità delle istanze per livello di qualità (frazione di ultra)
export const DENSITA_Q = { ultra: 1, alta: 0.6, media: 0.35, base: 0.14 };

// ---------------------------------------------------------------- campo: contorno, pali, fasce
/** Semipiani interni (rientrati di m) di un poligono convesso: [nx, nz, c] con n·p ≥ c (n versore). */
function semipiani(poli, m) {
  let area = 0; const n = poli.length;
  for (let i = 0; i < n; i++) { const [x0, z0] = poli[i], [x1, z1] = poli[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
  const s = area > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const a = poli[i], b = poli[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const nx = -dz * s / l, nz = dx * s / l;
    out.push([nx, nz, nx * a[0] + nz * a[1] + m]);
  }
  return out;
}
function intervalloZ(semi, x) {
  let z0 = -Infinity, z1 = Infinity;
  for (const [nx, nz, c] of semi) {
    const r = c - nx * x;
    if (Math.abs(nz) < 1e-9) { if (r > 0) return null; continue; }
    if (nz > 0) z0 = Math.max(z0, r / nz); else z1 = Math.min(z1, r / nz);
  }
  return z1 > z0 ? [z0, z1] : null;
}
/** Distanza (≥ 0 dentro) dal contorno: minimo sui semipiani. */
export const bordo = (semi, x, z) => Math.min(...semi.map(([nx, nz, c]) => nx * x + nz * z - c));

/** Descrizione del campo agrivoltaico (linee dei pali dal layout calcolato). */
export function descriviCampo(ctx) {
  const lay = ctx.dati.layout?.agri;
  const x0 = lay?.file?.[0]?.x ?? A.x0, passo = A.passoFile, escl = CO.esclusionePali;
  const poli = PIANURA.contornoAgri, semi = semipiani(poli, 0);
  const xs = poli.map(p => p[0]), zs = poli.map(p => p[1]);
  const bbox = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const dMax = Math.max(...poli.map(([x, z]) => Math.hypot(x - AGRI_C[0], z - AGRI_C[2])));
  const quota = PIANURA.PIANE[1][4];
  const distPali = x => Math.abs(((x - x0) / passo + 0.5) - Math.floor((x - x0) / passo + 0.5) - 0.5) * passo;
  return { x0, passo, escl, poli, semi, bbox, dMax, quota, distPali };
}

/** Fasce coltivate fra le linee dei pali, rientrate di m dal contorno: [{xa, xb, za:[z0,z1], zb:[z0,z1], k}]. */
export function fasce(campo, m) {
  const semi = semipiani(campo.poli, m), out = [];
  const [minX, maxX] = campo.bbox;
  const k0 = Math.floor((minX - campo.x0) / campo.passo) - 1, k1 = Math.ceil((maxX - campo.x0) / campo.passo) + 1;
  for (let k = k0; k <= k1; k++) {
    const xa = campo.x0 + campo.passo * k + campo.escl, xb = campo.x0 + campo.passo * (k + 1) - campo.escl;
    let a = null, b = null; const N = 32;
    for (let i = 0; i <= N; i++) { const x = xa + (xb - xa) * i / N; if (intervalloZ(semi, x)) { if (a === null) a = x; b = x; } }
    if (a === null || b - a < 0.03) continue;
    out.push({ xa: a, xb: b, za: intervalloZ(semi, a), zb: intervalloZ(semi, b), k });
  }
  return out;
}
/** Maschera delle colture (JS): fra i pali e dentro il contorno rientrato di m. */
export function inColtura(campo, x, z, m) {
  return campo.distPali(x) > campo.escl && bordo(campo.semi, x, z) > m;
}

// ---------------------------------------------------------------- percorso della camera (densità delle istanze)
/** Punti della camera da K3.65 a K3.8 (posa pura del rig; ripiego sui keyframe di config). */
export function percorsoCamera(ctx) {
  const P = [];
  for (let T = 10.56; T <= 11.301; T += 0.02) {
    try { const p = ctx.rig?.posa?.(T)?.posizione; if (p && Number.isFinite(p[0])) P.push([p[0], p[1], p[2]]); } catch { /* rig assente */ }
  }
  if (P.length < 2) P.push([84.78, 4.0, 42.5], [84.78, 1.05, 40.5], [84.78, 1.05, 36.5]);
  return P;
}
/** Distanza 3D minima di (x, y, z) dalla spezzata. */
export function distanzaPercorso(P, x, y, z) {
  let d2 = Infinity;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const l2 = ux * ux + uy * uy + uz * uz;
    let t = l2 > 1e-12 ? ((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / l2 : 0;
    t = Math.min(1, Math.max(0, t));
    const dx = a[0] + ux * t - x, dy = a[1] + uy * t - y, dz = a[2] + uz * t - z;
    d2 = Math.min(d2, dx * dx + dy * dy + dz * dz);
  }
  return Math.sqrt(d2);
}

/**
 * Punti a densità variabile nel campo: per cella di lato `cella`, n = densita(x, z)·cella² punti uniformi
 * (parte frazionaria estratta a sorte), filtrati da `maschera`. Restituisce [x, z, r] (r casuale 0..1 del punto).
 */
export function sparpaglia(campo, { cella, densita, maschera, seme, max = 2e6 }) {
  const rnd = mulberry32(seme), out = [];
  const [x0, x1, z0, z1] = campo.bbox;
  for (let z = z0; z < z1; z += cella) for (let x = x0; x < x1; x += cella) {
    const xc = x + cella / 2, zc = z + cella / 2;
    if (bordo(campo.semi, xc, zc) < -cella) continue;
    const ro = densita(xc, zc); if (ro <= 0) continue;
    const m = ro * cella * cella; let n = Math.floor(m); if (rnd() < m - n) n++;
    for (let i = 0; i < n; i++) {
      const px = x + rnd() * cella, pz = z + rnd() * cella, r = rnd();
      if (maschera(px, pz)) { out.push(px, pz, r); if (out.length >= max * 3) return out; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- GLSL comune
/** Rumore, maschere del campo, chiave dell'onda e vento (uniform uTempoV, uVento, uCrescita). */
export function glslCampo(campo) {
  const sp = campo.semi.map(([nx, nz, c]) => `dot( vec2( ${f5(nx)}, ${f5(nz)} ), p ) - ${f5(c)}`);
  const d = Math.hypot(VENTO.dir[0], VENTO.dir[1]);
  return /* glsl */`
#define X0C ${f5(campo.x0)}
#define PASSOC ${f5(campo.passo)}
#define ESCLC ${f5(campo.escl)}
#define DMAXC ${f5(campo.dMax)}
#define LAMBDA_V ${f5(VENTO.lambda)}
#define VEL_V ${f5(VENTO.vel)}
const vec2 AGRI_CC = vec2( ${f5(AGRI_C[0])}, ${f5(AGRI_C[2])} );
const vec2 DIR_VC = vec2( ${f5(VENTO.dir[0] / d)}, ${f5(VENTO.dir[1] / d)} );
const vec3 CARTA_C = ${vec3Lin(PALETTE.carta)};
const vec3 LUMA_C = vec3( 0.2126, 0.7152, 0.0722 );
uniform float uTempoV, uVento, uCrescita;
float hashC( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
vec2 hash2C( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.xx + p3.yz ) * p3.zy ); }
float vnoiseC( vec2 p ) {
  vec2 i = floor( p ), q = fract( p ); vec2 u = q * q * ( 3.0 - 2.0 * q );
  return mix( mix( hashC( i ), hashC( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hashC( i + vec2( 0.0, 1.0 ) ), hashC( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
// distanza (≥ 0 dentro) dal contorno del campo
float bordoC( vec2 p ) { return min( min( ${sp[0]}, ${sp[1]} ), min( ${sp[2]}, ${sp[3]} ) ); }
// distanza dalla linea dei pali più vicina e coordinata nella fascia (0 al centro dell'interfila)
float paliC( float x ) { return abs( fract( ( x - X0C ) / PASSOC + 0.5 ) - 0.5 ) * PASSOC; }
// chiave dell'onda di comparsa: distanza da AGRI_C normalizzata (come le strisce e i tracker agrivoltaici)
float chiaveC( vec2 p ) { return distance( p, AGRI_CC ) / DMAXC; }
// vento a onde lunghe: fronti un po' curvi che viaggiano sottovento, raffiche a macchie trascinate (0..1)
float ondaC( vec2 p ) {
  float s = dot( p, DIR_VC ), q = dot( p, vec2( -DIR_VC.y, DIR_VC.x ) ), sv = s - uTempoV * VEL_V;
  float g = vnoiseC( vec2( sv * 0.32, q * 0.22 ) );
  float g2 = vnoiseC( vec2( sv * 1.1, q * 0.7 ) + 7.0 );
  float w = 0.5 + 0.5 * sin( sv * 6.2832 / LAMBDA_V + 2.2 * vnoiseC( vec2( q * 0.12, s * 0.04 ) ) );
  return clamp( ( 0.3 + 0.7 * g ) * ( 0.62 * w * w + 0.38 * g2 ) * 1.25, 0.0, 1.0 );
}
`;
}

/** Uniform della comparsa e del vento, collegate per riferimento dai materiali delle colture. */
export function uniformiCampo(ctx) {
  return {
    uCrescita: { value: -0.1 }, uTempoV: { value: 0 }, uVento: { value: VENTO.ampiezza },
    uPxAng: { value: 0.001 }, uRealta: ctx.U.uRealta,
    uNuvole: ctx.U.uNuvole ?? { value: 0 }, uNuvoleVel: ctx.U.uNuvoleVel ?? { value: 1 }, uTempo: ctx.U.uTempo,
  };
}

// ---------------------------------------------------------------- suolo del campo
/**
 * Suolo del solo campo agrivoltaico: reticolo del terreno (stesso passo e stessa triangolazione) sul riquadro del
 * contorno, quote di altezza() + `quota`. Il frammento chiama `void suoloC(vec2 p, float dP, float dB, float on,
 * inout vec3 alb, inout float ruv, inout vec3 nW, inout float ao)` scritta dalla coltura.
 */
export function creaSuolo(ctx, campo, U, { glsl, funzioni, chiave, quota = 0.004, env = 0.4 }) {
  const S = ctx.qualita?.Q?.terreno || PIANURA.segmenti.media, w = PIANURA.lato / S, M = PIANURA.lato / 2;
  const [bx0, bx1, bz0, bz1] = campo.bbox;
  const i0 = Math.floor((bx0 + M) / w) - 1, i1 = Math.ceil((bx1 + M) / w) + 1;
  const j0 = Math.floor((bz0 + M) / w) - 1, j1 = Math.ceil((bz1 + M) / w) + 1;
  const ni = i1 - i0 + 1, nj = j1 - j0 + 1, pos = new Float32Array(ni * nj * 3), nor = new Float32Array(ni * nj * 3);
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    const x = -M + (i0 + i) * w, z = -M + (j0 + j) * w, k = (j * ni + i) * 3;
    pos[k] = x; pos[k + 1] = altezza(x, z) + quota; pos[k + 2] = z; nor[k + 1] = 1;
  }
  const ind = [];
  for (let j = 0; j < nj - 1; j++) for (let i = 0; i < ni - 1; i++) {
    const xc = -M + (i0 + i + 0.5) * w, zc = -M + (j0 + j + 0.5) * w;
    if (bordo(campo.semi, xc, zc) < -w) continue;                     // solo le celle che toccano il campo
    const a = j * ni + i, b = (j + 1) * ni + i, c = (j + 1) * ni + i + 1, d = j * ni + i + 1;
    ind.push(a, b, d, b, c, d);                                         // come PlaneGeometry (diagonale b–d)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(ind); geo.computeBoundingSphere();

  const patch = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPC;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPC = transformed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPC;
uniform float uRealta, uNuvole, uNuvoleVel, uTempo;
${glsl}
${funzioni}`)
      .replace('#include <map_fragment>', `
	vec2 pC = vPC.xz;
	float dB = bordoC( pC );
	if ( dB < 0.0 ) discard;
	float kC = chiaveC( pC ) + ( vnoiseC( pC * 1.3 ) - 0.5 ) * 0.04;
	if ( uCrescita < kC + 0.004 ) discard;                                  // compare con l'onda comparsaAgri
	float onC = ondaC( pC );
	vec3 albC = vec3( 0.5 ); float ruvC = 1.0; vec3 nWC = vec3( 0.0, 1.0, 0.0 ); float aoC = 1.0;
	suoloC( pC, paliC( pC.x ), dB, onC, albC, ruvC, nWC, aoC );
	diffuseColor.rgb *= mix( CARTA_C, albC * aoC, uRealta );`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = ruvC;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = normalize( ( viewMatrix * vec4( normalize( mix( vec3( 0.0, 1.0, 0.0 ), nWC, uRealta ) ), 0.0 ) ).xyz );')
      .replace('#include <opaque_fragment>', `
	if ( uNuvole > 0.0 ) {                                                  // ombre delle nuvole, come il terreno
	  vec2 qn = pC * 0.01 + vec2( 1.0, 0.35 ) * uTempo * 0.004 * uNuvoleVel;
	  outgoingLight *= 1.0 - uNuvole * smoothstep( 0.4, 0.7, vnoiseC( qn ) * 0.65 + vnoiseC( qn * 2.3 + 4.1 ) * 0.35 );
	}
	#include <opaque_fragment>`);
  };
  const mat = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: env,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  }, { patch, chiave });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'agri.suolo'; mesh.receiveShadow = true; mesh.castShadow = false;
  return mesh;
}

// ---------------------------------------------------------------- materiale delle piante (vertice calcolato nello shader)
/**
 * Tre materiali con la stessa patch del vertice: principale (MeshStandardMaterial), ombra (MeshDepthMaterial) e
 * normali per il GTAO. Il vertice: `void piantaC()` scrive i globali posC e norC (spazio mondo, la mesh non ha
 * trasformazioni) e i varying. Il frammento (`corpoF`, dopo color_fragment) scrive diffuseColor.rgb, copC (copertura
 * 0..1: alfa per alphaToCoverage), ruvC, traslC (quota di luce che passa) e traslCol (tinta della luce trasmessa).
 */
export function materialePianta(ctx, U, { glsl, dichV, corpoV, dichF, corpoF, chiave, a2c = true, env = 0.55,
                                       vertexColors = false, soglia = 0.02, lato = THREE.DoubleSide, normaleFissa = false }) {
  const comuneV = `#include <common>\n${glsl}\nuniform float uPxAng;\n${dichV}\nvec3 posC; vec3 norC;\nvoid piantaC() {\n${corpoV}\n}`;
  const vConNormale = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', comuneV)
      .replace('#include <beginnormal_vertex>', 'piantaC();\n\tvec3 objectNormal = norC;\n\t#ifdef USE_TANGENT\n\tvec3 objectTangent = vec3( 1.0, 0.0, 0.0 );\n\t#endif')
      .replace('#include <begin_vertex>', 'vec3 transformed = posC;');
  };
  const principale = sh => {
    Object.assign(sh.uniforms, U);
    vConNormale(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uRealta;\n${glsl}\n${dichF}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
	float copC = 1.0, ruvC = 0.7, traslC = 0.0; vec3 traslCol = vec3( 1.0 ); vec3 nWC = vec3( 0.0 );
	{
${corpoF}
	}
	if ( copC < ${f5(soglia)} ) discard;
	diffuseColor.rgb = mix( CARTA_C, diffuseColor.rgb, uRealta );`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = ruvC;')
      // nastri rivolti alla camera: la normale è già dalla parte giusta, il lato della faccia non la capovolge
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>${normaleFissa ? '\n\tnormal = normalize( vNormal );' : ''}
	if ( nWC.y > 0.0 ) normal = normalize( ( viewMatrix * vec4( nWC, 0.0 ) ).xyz );   // normale di dettaglio (mondo)`)
      // traslucenza: luce del sole dal retro della foglia e alone in controluce (directLight = il sole, ombra compresa)
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
	#if NUM_DIR_LIGHTS > 0
	{
	  float dietroC = clamp( - dot( geometryNormal, directLight.direction ), 0.0, 1.0 );
	  float contro = clamp( dot( - geometryViewDir, directLight.direction ), 0.0, 1.0 );
	  float alone = contro * contro * contro;
	  reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * traslCol * traslC * ( 0.55 * dietroC + 1.6 * alone ) * uRealta;
	}
	#endif`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${a2c ? '\n\tgl_FragColor.a = clamp( copC, 0.0, 1.0 );' : ''}`);
  };
  const mat = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: env, side: lato, vertexColors,
    alphaToCoverage: a2c,
  }, { patch: principale, chiave });
  const prof = nuovoMateriale(THREE.MeshDepthMaterial, { depthPacking: THREE.RGBADepthPacking, side: lato }, {
    patch: sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', comuneV).replace('#include <begin_vertex>', 'piantaC();\n\tvec3 transformed = posC;');
    }, chiave: chiave + '-ombra',
  });
  const norm = nuovoMateriale(THREE.MeshNormalMaterial, { side: lato }, {
    patch: sh => { Object.assign(sh.uniforms, U); vConNormale(sh); }, chiave: chiave + '-normali',
  });
  return { mat, prof, norm };
}

// ---------------------------------------------------------------- istanze a blocchi
/**
 * Mesh istanziate a blocchi lungo z: `template` (BufferGeometry condivisa), `attr` = { nome: [dim, Float32Array] }
 * con aA.xyz = base della pianta (mondo). Blocchi di `passoZ` u: ogni blocco ha la sua sfera d'ingombro.
 */
export function creaIstanze(gruppo, { template, attr, n, materiali, nome, passoZ = 1.2, passoX = 1.5, alto = 0.15, ombra = false, ao = false,
                                       dVista = 9 }) {
  if (n <= 0) return [];
  const aA = attr.aA[1];
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < n; i++) { const z = aA[i * 4 + 2]; zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
  const nb = Math.max(1, Math.ceil((zMax - zMin + 1e-6) / passoZ)), conta = new Int32Array(nb);
  const blocco = i => Math.min(nb - 1, Math.floor((aA[i * 4 + 2] - zMin) / passoZ));
  for (let i = 0; i < n; i++) conta[blocco(i)]++;
  const inizio = new Int32Array(nb); for (let b = 1; b < nb; b++) inizio[b] = inizio[b - 1] + conta[b - 1];
  const ordine = new Int32Array(n), pieno = inizio.slice();
  for (let i = 0; i < n; i++) ordine[pieno[blocco(i)]++] = i;
  const riordinati = {};
  for (const [k, [dim, dati]] of Object.entries(attr)) {
    const out = new Float32Array(n * dim);
    for (let j = 0; j < n; j++) out.set(dati.subarray(ordine[j] * dim, ordine[j] * dim + dim), j * dim);
    riordinati[k] = [dim, out];
  }
  const mesh = [], c = new THREE.Vector3();
  for (let b = 0; b < nb; b++) {
    const m0 = inizio[b], m = conta[b]; if (!m) continue;
    // dentro la fetta lungo z, blocchi lungo x larghi passoX: scatole strette per il culling
    const A4 = riordinati.aA[1], xs = [];
    for (let j = m0; j < m0 + m; j++) xs.push([A4[j * 4], j]);
    xs.sort((p, q) => p[0] - q[0]);
    let s0 = 0;
    while (s0 < xs.length) {
      let s1 = s0; while (s1 < xs.length && xs[s1][0] - xs[s0][0] < passoX) s1++;
      const idx = xs.slice(s0, s1).map(p => p[1]), mm = idx.length;
      const g = new THREE.InstancedBufferGeometry();
      g.index = template.index;
      for (const [k, a] of Object.entries(template.attributes)) g.setAttribute(k, a);
      for (const [k, [dim, dati]] of Object.entries(riordinati)) {
        const sub = new Float32Array(mm * dim);
        idx.forEach((j, q) => sub.set(dati.subarray(j * dim, j * dim + dim), q * dim));
        g.setAttribute(k, new THREE.InstancedBufferAttribute(sub, dim));
      }
      g.instanceCount = mm;
      const bb = new THREE.Box3();
      for (const j of idx) bb.expandByPoint(c.set(A4[j * 4], A4[j * 4 + 1], A4[j * 4 + 2]));
      bb.max.y += alto; bb.expandByScalar(0.05);
      g.boundingBox = bb; g.boundingSphere = bb.getBoundingSphere(new THREE.Sphere());
      const me = new THREE.Mesh(g, materiali.mat);
      me.name = `${nome}.${mesh.length}`; me.castShadow = ombra; me.receiveShadow = true;
      me.frustumCulled = false;                     // culling con la scatola in cullaIstanze()
      if (ombra) me.customDepthMaterial = materiali.prof;
      if (ao) me.userData.materialeNormali = materiali.norm; else me.userData.noAO = true;
      me.userData.scatola = bb; me.userData.dMax = dVista;
      gruppo.add(me); mesh.push(me);
      s0 = s1;
    }
  }
  return mesh;
}

// ---------------------------------------------------------------- culling dei blocchi (in aggiorna, senza allocazioni)
const _fr = new THREE.Frustum(), _m4 = new THREE.Matrix4();
/** Accende i blocchi dentro il frustum della camera e entro la loro distanza di vista (userData.dMax). */
export function cullaIstanze(lista, camera, acceso) {
  if (!acceso || !camera) { for (const m of lista) m.visible = false; return; }
  camera.updateMatrixWorld();
  _m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_m4);
  const p = camera.position;
  for (const m of lista) {
    const b = m.userData.scatola;
    m.visible = b.distanceToPoint(p) < m.userData.dMax && _fr.intersectsBox(b);
  }
}

/** Colore di MATERIALI (sRGB) come THREE.Color, per le colture che partono dalla palette di config. */
export const coloreConfig = (nome, ripiego) => new THREE.Color(MATERIALI[nome]?.color ?? ripiego);
