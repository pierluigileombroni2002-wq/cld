// =============================================================================
// ERI v2 · luce/nebbia.js — nebbia in quota + diffusione del sole, factory dei materiali
// Proprietario: [BASE-RENDER]. Stato: COMPLETO (base di [ARCH], rifinita da BASE-RENDER: colori del cielo condivisi).
// BASE-RENDER può rifinire crea()/aggiorna() ma NON cambia le firme di
// nuovoMateriale / aggiungiPatch / collegaNebbia / impostaEnvGlobale / NEBBIA.
//
// DEVE essere il primo modulo valutato (main.js lo importa per primo): sostituisce
// i chunk fog_* PRIMA che qualunque materiale venga compilato (§2.5, §6.3).
// Tema chiaro: i preset del cielo sono colori A SCHERMO; versoScena/INVERSA_TONO li riportano in HDR (inversa di
// ACES e dell'esposizione) per la nebbia e per la cupola (luce/cielo.js).
// =============================================================================
import * as THREE from 'three';
import { NEBBIA as CN, CIELO_PRESET, CIELO, RENDER } from '../config.js';

// ---- 1) sostituzione dei chunk (codice normativo di §6.3) ----
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
 varying float vFogDepth; varying vec3 vFogPosMondo;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
 vFogDepth = - mvPosition.z;
 vFogPosMondo = ( inverse( viewMatrix ) * vec4( mvPosition.xyz, 1.0 ) ).xyz; // robusto anche con istanze
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
 uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogPosMondo;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
 uniform vec3 uSoleDir; uniform vec3 uSoleNebbia; uniform float uNebbiaBase; uniform float uNebbiaDecad;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
 #else
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
 #endif
 float quotaN = exp( - max( vFogPosMondo.y - uNebbiaBase, 0.0 ) * uNebbiaDecad ); // nebbia in quota
 fogFactor *= mix( 0.35, 1.0, quotaN );
 float sol = pow( max( dot( normalize( vFogPosMondo - cameraPosition ), uSoleDir ), 0.0 ), 8.0 );
 gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, uSoleNebbia, sol * 0.6 ), fogFactor );
#endif`;

/** Uniform aggiuntive della nebbia, condivise PER RIFERIMENTO da tutti i materiali. */
export const NEBBIA = {
  uSoleDir: { value: new THREE.Vector3(0, 1, 0) },
  uSoleNebbia: { value: new THREE.Color(CIELO_PRESET.tramonto.bagliore) },
  uNebbiaBase: { value: CN.basePianura },
  uNebbiaDecad: { value: CN.decadimento },
};

// ---- 2) patch composte e chiave di cache dei programmi ----
// three r160 usa customProgramCacheKey() (default: onBeforeCompile.toString()) per distinguere i programmi.
// Con patch composte la funzione è sempre la stessa: la chiave DEVE elencare le patch, altrimenti
// materiali con patch diverse condividono lo stesso programma (bug silenzioso).
/**
 * Aggiunge una patch onBeforeCompile a un materiale, in coda alle precedenti.
 * @param {THREE.Material} materiale
 * @param {(shader:object, renderer:THREE.WebGLRenderer)=>void} patch
 * @param {string} [chiave] OBBLIGATORIA se il codice GLSL generato dipende da variabili di chiusura
 *        (default: patch.toString()).
 */
export function aggiungiPatch(materiale, patch, chiave) {
  const lista = materiale.userData.patch || (materiale.userData.patch = []);
  lista.push({ patch, chiave: chiave ?? patch.toString() });
  materiale.onBeforeCompile = (sh, r) => { for (const p of lista) p.patch(sh, r); };
  materiale.customProgramCacheKey = () => lista.map(p => p.chiave).join('|');
  materiale.needsUpdate = true;
  return materiale;
}
const patchNebbia = sh => {
  sh.uniforms.uSoleDir = NEBBIA.uSoleDir; sh.uniforms.uSoleNebbia = NEBBIA.uSoleNebbia;
  sh.uniforms.uNebbiaBase = NEBBIA.uNebbiaBase; sh.uniforms.uNebbiaDecad = NEBBIA.uNebbiaDecad;
};
/** Collega le uniform della nebbia (idempotente). Necessario per ogni materiale con fog:true. */
export function collegaNebbia(materiale) {
  if (materiale.userData.nebbiaCollegata) return materiale;
  materiale.userData.nebbiaCollegata = true;
  return aggiungiPatch(materiale, patchNebbia, 'nebbia');
}

// ---- 3) registro ENV_GLOBALE (r160 non ha scene.environmentIntensity) ----
const registrati = new Set();
let envGlobale = 1;
/** Registra un materiale: envMapIntensity = envBase × ENV_GLOBALE. */
export function registraEnv(materiale, envBase = materiale.envMapIntensity ?? 1) {
  if (!('envMapIntensity' in materiale)) return materiale;
  materiale.userData.envBase = envBase;
  materiale.envMapIntensity = envBase * envGlobale;
  registrati.add(materiale);
  materiale.addEventListener('dispose', () => registrati.delete(materiale));
  return materiale;
}
/** Applica ENV_GLOBALE a tutti i materiali registrati (chiamata da aggiorna quando cambia). */
export function impostaEnvGlobale(v) {
  if (v === envGlobale) return; envGlobale = v;
  for (const m of registrati) m.envMapIntensity = m.userData.envBase * v;
}

/**
 * FACTORY DEI MATERIALI (vincolante per tutti i pacchetti).
 * new Classe(parametri) + nebbia collegata + registro ENV_GLOBALE + patch opzionale.
 * @param {typeof THREE.Material} Classe es. THREE.MeshStandardMaterial
 * @param {object} parametri parametri del costruttore (envMapIntensity = valore BASE di §2.6)
 * @param {{patch?:Function, chiave?:string}} [opz]
 * @returns {THREE.Material}
 */
export function nuovoMateriale(Classe, parametri = {}, opz = {}) {
  const m = new Classe(parametri);
  if (m.fog !== false) collegaNebbia(m);
  registraEnv(m, parametri.envMapIntensity ?? m.envMapIntensity ?? 1);
  if (opz.patch) aggiungiPatch(m, opz.patch, opz.chiave);
  return m;
}

// ---- 4) colori "a schermo" → HDR della scena (tema chiaro) ----
// I preset del cielo sono i colori che devono APPARIRE a schermo. Cupola e nebbia passano però da bloom e da
// OutputPass (ACES di three con STATO.esposizione): qui c'è l'inversa esatta, usata dalla nebbia (JS) e dalla
// cupola (lo stesso calcolo in GLSL, luce/cielo.js). Così il cielo non dipende dall'esposizione, la campagna
// svanisce esattamente nel colore dell'orizzonte e nulla di chiaro supera la soglia del bloom.
// ACES di three r160: c' = OUT · RRT(IN · c · esp / 0,6); RRT(v) = (v² + 0,0245786 v − 0,000090537) / (0,983729 v² + 0,432951 v + 0,238081).
const ACES_IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777);
const ACES_OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
/** Parametri dell'inversa, condivisi con la cupola (uniform per riferimento). aces = false con ?tm=agx: solo esposizione (approssimato). */
export const INVERSA_TONO = {
  inInv: ACES_IN.clone().invert(), outInv: ACES_OUT.clone().invert(),
  tetto: CIELO.tettoSchermo ?? 0.9,    // tetto per canale del colore a schermo (bagliore pieno = bianco caldo, non HDR)
  aces: true, scala: 1,                // scala = moltiplicatore dell'esposizione del tone mapping (AgX: RENDER.agx.esposizione)
};
/** Esposizione effettiva del tone mapping (la stessa che pipeline.render scrive nel renderer). */
export const esposizioneTono = S => Math.max(1e-3, (S.esposizione ?? 1) * INVERSA_TONO.scala);
const _t = new THREE.Vector3();
/** RRT⁻¹ per un canale (radice positiva della quadratica). */
function rrtInv(y) {
  y = Math.min(Math.max(y, 0), 0.97);
  const a = 1 - 0.983729 * y, b = 0.0245786 - 0.432951 * y, c = -(0.000090537 + 0.238081 * y);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
/**
 * Colore lineare "a schermo" (quello che deve uscire dal tone mapping) → colore HDR lineare della scena.
 * @param {THREE.Color} c @param {number} esp esposizione effettiva (esposizioneTono) @param {THREE.Color} [out]
 */
export function versoScena(c, esp, out = c) {
  const T = INVERSA_TONO.tetto;
  _t.set(Math.min(Math.max(c.r, 0), T), Math.min(Math.max(c.g, 0), T), Math.min(Math.max(c.b, 0), T));
  if (!INVERSA_TONO.aces) return out.setRGB(_t.x / esp, _t.y / esp, _t.z / esp, THREE.LinearSRGBColorSpace);
  _t.applyMatrix3(INVERSA_TONO.outInv);
  _t.set(rrtInv(_t.x), rrtInv(_t.y), rrtInv(_t.z)).applyMatrix3(INVERSA_TONO.inInv).multiplyScalar(0.6 / esp);
  return out.setRGB(Math.max(_t.x, 0), Math.max(_t.y, 0), Math.max(_t.z, 0), THREE.LinearSRGBColorSpace);
}

// ---- 5) colori del cielo condivisi (cupola, nebbia, bagliore) ----
// Calcolati UNA volta per fotogramma qui (nebbia.aggiorna viene prima di cielo.aggiorna nel fotogramma):
// cupola del cielo e nebbia usano gli stessi valori, quindi il terreno svanisce esattamente nell'orizzonte.
/**
 * Colori del cielo per lo STATO corrente (preset interpolati in lineare, §2.5): lineari "a schermo", salvo nota.
 * Tema chiaro: il bagliore non si SOMMA più (su un orizzonte già chiaro la somma satura e vira al giallo limone):
 * il cielo va VERSO il colore del bagliore, c = mix(c, baglioreColore, peso × kBagliore).
 */
export const COLORI_CIELO = {
  zenit: new THREE.Color(), orizzonte: new THREE.Color(),
  bagliore: new THREE.Color(),      // colore del bagliore × fattore del preset (premoltiplicato)
  baglioreColore: new THREE.Color(),// colore del bagliore (non premoltiplicato) e suo peso k del preset
  kBagliore: 0,
  soleNebbia: new THREE.Color(),    // mix(orizzonte, baglioreColore, k): colore della nebbia guardando verso il sole
  nebbia: new THREE.Color(),        // HDR della scena: colore della nebbia (= orizzonte dopo il tone mapping)
  soleNebbiaScena: new THREE.Color(),   // HDR della scena: diffusione verso il sole (= soleNebbia a schermo)
  disco: 0,                         // 0..1, disco solare acceso (regola del preset, × STATO.discoSole)
};
const _c2 = new THREE.Color();
const smussa = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Regola del disco solare di un preset: true | false | 'el>-0.5' (soglia ammorbidita di ±0,3°). */
function discoDi(p, el) {
  if (p.disco === true) return 1;
  if (typeof p.disco === 'string') { const m = /el\s*>\s*(-?[\d.]+)/.exec(p.disco); return m ? smussa(+m[1] - 0.3, +m[1] + 0.3, el) : 0; }
  return 0;
}
/**
 * Calcola i colori del cielo da STATO.cielo = {da, a, k} (nomi di CIELO_PRESET).
 * @param {object} S STATO @param {object} [out] COLORI_CIELO
 */
export function calcolaCielo(S, out = COLORI_CIELO) {
  const A = CIELO_PRESET[S.cielo?.da] || CIELO_PRESET.tramonto, B = CIELO_PRESET[S.cielo?.a] || A, k = S.cielo?.k ?? 0;
  out.zenit.set(A.zenit).lerp(_c2.set(B.zenit), k);
  out.orizzonte.set(A.orizzonte).lerp(_c2.set(B.orizzonte), k);
  out.bagliore.set(A.bagliore).multiplyScalar(A.k).lerp(_c2.set(B.bagliore).multiplyScalar(B.k), k);
  // colore medio pesato con k (verso un preset senza bagliore il colore non scurisce, cala solo il peso)
  const kb = out.kBagliore = A.k + (B.k - A.k) * k;
  if (kb > 1e-4) out.baglioreColore.copy(out.bagliore).multiplyScalar(1 / kb); else out.baglioreColore.copy(out.orizzonte);
  out.soleNebbia.copy(out.orizzonte).lerp(out.baglioreColore, Math.min(1, kb));
  const el = S.sole?.el ?? 0;
  out.disco = (discoDi(A, el) * (1 - k) + discoDi(B, el) * k) * (S.discoSole ?? 1);
  return out;
}

/** Colori HDR della nebbia (C.nebbia, C.soleNebbiaScena) per l'esposizione effettiva esp. */
function nebbiaInScena(C, esp) {
  versoScena(C.orizzonte, esp, C.nebbia);
  versoScena(C.soleNebbia, esp, C.soleNebbiaScena);
  return C;
}

// ---- 6) ciclo di vita ----
export const MONDO = 'sistema';
/** Crea la nebbia FogExp2 per le due scene (colore = orizzonte del cielo, riportato in HDR). */
export function crea(ctx) {
  const { pianura, valle } = ctx.scene;
  const agx = ctx.flags?.tm === 'agx';
  INVERSA_TONO.aces = !agx; INVERSA_TONO.scala = agx ? RENDER.agx.esposizione : 1;
  const esp = esposizioneTono(ctx.STATO);
  pianura.fog = new THREE.FogExp2(versoScena(new THREE.Color(CIELO_PRESET.tramonto.orizzonte), esp), ctx.STATO.nebbia);
  valle.fog = new THREE.FogExp2(versoScena(new THREE.Color(CIELO_PRESET.museale.orizzonte), esp), ctx.STATO.nebbia);
  ctx.nebbia = { NEBBIA, colori: COLORI_CIELO, versoScena, inversa: INVERSA_TONO };
  nebbiaInScena(calcolaCielo(ctx.STATO), esp);
}
/**
 * Ogni fotogramma: densità da STATO.nebbia, colore = orizzonte del preset (lo stesso della cupola, riportato in
 * HDR con l'esposizione corrente), diffusione verso il sole = orizzonte + bagliore, base per mondo, ENV_GLOBALE.
 */
export function aggiorna(ctx /*, T, t, dt */) {
  const S = ctx.STATO, scena = ctx.scene[ctx.mondo];
  const C = nebbiaInScena(calcolaCielo(S), esposizioneTono(S));
  if (scena?.fog) { scena.fog.density = S.nebbia; scena.fog.color.copy(C.nebbia); }
  NEBBIA.uSoleNebbia.value.copy(C.soleNebbiaScena);
  NEBBIA.uNebbiaBase.value = ctx.mondo === 'valle' ? CN.baseValle : CN.basePianura;
  NEBBIA.uSoleDir.value.set(S.soleDir[0], S.soleDir[1], S.soleDir[2]);
  impostaEnvGlobale(S.envGlobale);
}
