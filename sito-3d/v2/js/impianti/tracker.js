// =============================================================================
// ERI v2 · impianti/tracker.js — tracker FV e agrivoltaici istanziati, tracker eroe in vista esplosa, onda, cantiere
// Proprietario: [FV]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.5 (layout normativo: ctx.dati.layout da geo.calcolaLayout), §6.6 (pezzi, texture delle celle,
// InstancedMesh, patch del vertice rotZ/uComparsa/uModo, customDepthMaterial), §2.6 (vetro, retro, telaio, acciaio —
// MAI metallo_lamiera), §4.4 (eroe, esplosione, giraModulo, comparsaFV/Agri, ombre), §4.6 (uModo, comparsaPali/Tubi/
// Moduli, statoFile, stringa14B), App. A; config.MATERIALI.moduli (tre stili: ?moduli=vetro|blu|plastico).
//
// Cosa c'è:
//  - campi FV e agrivoltaico: un InstancedMesh per pezzo e per campo (moduli con tre gruppi telaio/fronte/retro, tubi,
//    pali a profilo H, cuscinetti, motoriduttori con il controllore). Matrici d'istanza con SOLA traslazione e scala
//    0,1 (il tubo anche la lunghezza in z), scritte una volta in crea(). Rotazione nel vertex shader con
//    U.uAngoloFV / U.uAngoloAgri (solo moduli e tubi), comparsa per istanza con aChiave (onda, tappa 3) o aOrdine
//    (cantiere, tappa 5), aFila = fila + lettera/100 (eroe escluso finché è acceso, stringa 14-B).
//    Stessa patch nel customDepthMaterial (ombre) e nel materiale delle normali del GTAO.
//  - livello base: file FV alterne (pari, più la fila dell'eroe).
//  - tracker eroe (fila 31, tracker D del layout): gruppo × 0,1 in metri, pezzi istanziati con matrici scritte dalla
//    CPU solo mentre è acceso (≤ 80 istanze): comparsa (STATO.eroe), esplosione per pezzo power4.out con ritardi e
//    spostamenti di §4.4, modulo girato (STATO.giraModulo) attorno al proprio lato lungo, sollevato per non toccare il
//    tubo. Stessi materiali e stessa patch dei campi (uniform proprie): lo scambio a 8,77 con l'istanza è identico.
//  - tappa 5b (tema chiaro, niente emissione): telai verso PALETTE.smeraldo (statoFile), stringa 14-B che pulsa
//    verso PALETTE.ambra a 0,8 Hz. Sul fronte il telaio è largo almeno ~1 px: la tinta si legge anche da lontano.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'eroe.palo', 'eroe.tubo', 'eroe.cuscinetto', 'eroe.motoriduttore', 'eroe.controllore',
//             'eroe.modulo' (funzioni che restituiscono sempre lo STESSO Vector3, posizione corrente, esplosione compresa);
//             pubblica ctx.dati.tracker = { fv:{moduli, tubi, pali, cuscinetti, motori}, agri:{...}, eroe: THREE.Group,
//             materiali:{fronte, retro, telaio, acciaio}, texturaCelle }.
//  aggiorna(ctx, T, t, dt): solo visible, uniform e le matrici dell'eroe (mai quelle dei campi).
// =============================================================================
import * as THREE from 'three';
import { LAYOUT, PIANURA, MATERIALI, PALETTE, UNITA, EASE } from '../config.js';
import { calcolaLayout, clamp, ss } from '../geo.js';
import { nuovoMateriale, versoScena, esposizioneTono } from '../luce/nebbia.js';
import { ease } from '../regia/stato.js';
import { texturaModulo, TELAIO_UV } from './tracker-celle.js';
import { geoModulo, geoTubo, geoPalo, geoCuscinetto, geoMotore, geoControllore, CENTRO_MOTORE, CONTROLLORE } from './tracker-pezzi.js';

export const MONDO = 'pianura';

const NOME_STILE = MATERIALI.moduli[MATERIALI.moduli.stile] ? MATERIALI.moduli.stile : 'vetro';
const ST = MATERIALI.moduli[NOME_STILE];
const M_U = UNITA.metriPerU, SC = UNITA.scalaMeccanica, SOPRA = LAYOUT.modulo.sopraAsseM;

// TARATURA: proporre in config (MATERIALI.moduli.<stile>.clearcoatRoughness): il vetro fa l'onda di riflessi netta
// a mezzogiorno (K3.5), gli altri stili più morbida
const CC_RUVIDO = { vetro: 0.2, blu: 0.28, plastico: 0.4 };
// TARATURA: proporre in config (MATERIALI.moduloFronte.envMapIntensity, §2.6 ammette di tarare solo env e intensità):
// nel tema chiaro il cielo dell'ambiente è luminoso e con 1,25 il vetro in controluce diventa bianco (celle invisibili)
// (a 0,5 visti di taglio riflettevano ancora il cielo chiaro e sembravano rosa-bianchi: l'onda di mezzogiorno è del sole diretto)
const ENV_FRONTE = { vetro: 0.16, blu: 0.22, plastico: 0.6 };
// TARATURA: proporre in config — specularità dello strato sotto il vetro (vetro solare con antiriflesso): con 1 il
// lobo largo (roughness 0,32) del sole radente imbianca i moduli in controluce (K3.1, K3.3); sotto ~0,75 l'onda
// di K3.5 perde le code luminose (sonda riflessiCampo < 0,5 % al livello base, a file alterne)
const SPECULARE = { vetro: 0.75, blu: 0.5, plastico: 0.5 };
// TARATURA: proporre in config — micro-disallineamento dei moduli (solo la normale di shading, gradi): l'onda di
// riflessi diventa uno sciame di lampi invece di una riga continua
const MICRO = { rollio: 0.9, beccheggio: 0.6 };
// TARATURA: proporre in config (MATERIALI.moduli) — scatole verniciate (motoriduttore del campo, controllore)
const SCATOLA = { verso: PALETTE.carta, k: 0.45, roughness: 0.6, envMapIntensity: 0.8 };
// TARATURA: proporre in config (OVERLAY o TRACKER) — tinte a inchiostro della tappa 5b (tema chiaro, niente HDR)
// (a K5.2 i moduli della 14-B si vedono di taglio, dal retro, larghi 1–2 px: anche il vetro prende tutta l'ambra)
const TINTA = { statoFile: 0.35, stringa: 1.0, stringaVetro: 1.0, pulsaMin: 0.6, hz: 0.8, riduci: 0.9 };
// TARATURA: proporre in config — comparsa per istanza (§6.6, §4.4, §4.6): salita (m), moduli del cantiere
const COMPARSA = { salitaM: 2.0, moduliSalitaM: 0.3, moduliScala: 0.6, raggioExtra: 0.25 };
// TARATURA: proporre in config (TRACKER_EROE) — vista esplosa di §4.4: ritardo e spostamento (m) di ogni pezzo.
// pos = base + offset·(1 − power4.out(clamp((1 − e)·K − ritardo, 0, 1))). Con K = 1,6 l'ultimo modulo (ritardo 0,895)
// resterebbe a 6 mm dal posto: K = max(1,6; 1 + ritardo massimo), così a e = 0 il montaggio è esatto.
const ESPLOSA = {
  pali: { ritardo: 0.00, offset: [0, -1.2, 0] },
  cuscinetti: { ritardo: 0.08, offset: [0, 0.8, 0] },
  tubo: { ritardo: 0.16, offset: [0, 1.6, 0] },
  motore: { ritardo: 0.24, offset: [0.9, 0, 0] },
  controllore: { ritardo: 0.32, offset: [1.0, 0.6, 0] },
  moduli: { ritardo: 0.40, passo: 0.009, offset: [0.3, 2.4, 0] },   // x alternato ±0,3 m
  K: 1.6,
};
// TARATURA: proporre in config — modulo girato: sollevamento massimo (m) e frazione di giro a cui è già tutto su
// (girando attorno al proprio asse lungo, senza salire, il bordo toccherebbe il tubo di torsione)
const GIRA = { sollevaM: 0.7, liberoSu: 0.25 };
// distanza dall'eroe per le ancore di §4.4 (m): tubo a +1,5 m dal centro, cuscinetto a −8 m
const ANCORE_M = { tubo: 1.5, cuscinetto: -8 };

// pezzi: chiave di STATO della comparsa di cantiere (tappa 5), rotazione con l'angolo, regola dei moduli
const PEZZI = {
  moduli: { cantiere: 'comparsaModuli', ruota: 1, moduli: 1 },
  tubi: { cantiere: 'comparsaTubi', ruota: 1, moduli: 0 },
  pali: { cantiere: 'comparsaPali', ruota: 0, moduli: 0 },
  cuscinetti: { cantiere: 'comparsaTubi', ruota: 0, moduli: 0 },
  motori: { cantiere: 'comparsaTubi', ruota: 0, moduli: 0 },
};

const P4 = ease(EASE.esplosa);
const f = v => (+v).toFixed(5);
const vec3Lin = hex => { const c = new THREE.Color(hex); return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`; };
const codiceFila = (fila, lettera) => fila + (lettera.charCodeAt(0) - 65) / 100;

// ---------------------------------------------------------------- GLSL (patch condivisa da tutti i pezzi)
const V_PARS = /* glsl */`
attribute float aChiave; attribute float aOrdine; attribute float aFila;
uniform float uAngolo, uRuota, uComparsa, uComparsaC, uModo, uModuli, uEroe, uFilaEroe, uFila14B;
varying float v14B;
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }`;
// normale: stessa rotazione più un micro-disallineamento per istanza (solo shading, la geometria resta esatta)
const V_NORMALE = /* glsl */`#include <beginnormal_vertex>
  { float hT = fract(sin(float(gl_InstanceID) * 12.9898 + aFila * 78.233) * 43758.5453);
    float h2 = fract(hT * 17.31 + 0.13);
    objectNormal = rotZ(uAngolo * uRuota + uRuota * ${f(MICRO.rollio * Math.PI / 180)} * (2.0 * hT - 1.0)) * objectNormal;
    objectNormal.z += uRuota * ${f(MICRO.beccheggio * Math.PI / 180)} * (2.0 * h2 - 1.0) * objectNormal.y; }`;
// k = aChiave (onda) o aOrdine (cantiere); s = smoothstep(k, k + 0,1, comparsa); sale da −2 m (moduli del cantiere:
// scala da 0,6 e salita da −0,3 m); l'eroe acceso esclude le proprie istanze
const V_VERTICE = /* glsl */`#include <begin_vertex>
  { float kT = mix(aChiave, aOrdine, uModo);
    float sT = smoothstep(kT, kT + 0.1, mix(uComparsa, uComparsaC, uModo));
    if (uEroe > 0.0 && abs(aFila - uFilaEroe) < 0.004) sT = 0.0;
    float scT = sT, giuT = ${f(COMPARSA.salitaM)};
    if (uModuli * uModo > 0.5) { scT = mix(${f(COMPARSA.moduliScala)}, 1.0, sT) * clamp(sT * 10.0, 0.0, 1.0); giuT = ${f(COMPARSA.moduliSalitaM)}; }
    transformed = rotZ(uAngolo * uRuota) * transformed;
    transformed *= max(scT, 1e-4);
    transformed.y -= (1.0 - sT) * giuT;
    v14B = step(abs(aFila - uFila14B), 0.004); }`;

// frammento dei telai (fronte, retro e lati del modulo): tinte a inchiostro della tappa 5b, mescolate DOPO la luce
// (copertura verso il colore a schermo riportato in scena: si leggono anche sui retro in ombra, mai luce sommata)
const F_PARS = /* glsl */`
uniform float uStatoFile, uPulsa14B; uniform vec3 uSmeraldoScena, uAmbraScena;
varying float v14B;
float bordoTelaio(vec2 uv) {   // telaio sul vetro, largo almeno ~1,2 px
  vec2 fw = fwidth(uv), d = min(uv, 1.0 - uv), l = max(vec2(${f(TELAIO_UV[0])}, ${f(TELAIO_UV[1])}), fw * 1.2);
  return 1.0 - min(smoothstep(l.x - fw.x, l.x, d.x), smoothstep(l.y - fw.y, l.y, d.y));
}
float telaioEsatto(vec2 uv) { vec2 d = min(uv, 1.0 - uv); return 1.0 - min(step(${f(TELAIO_UV[0])}, d.x), step(${f(TELAIO_UV[1])}, d.y)); }`;
function fTinte(bordo) {
  return /* glsl */`{ float bT = ${bordo};
    outgoingLight = mix(outgoingLight, uSmeraldoScena, uStatoFile * ${f(TINTA.statoFile)} * bT);
    outgoingLight = mix(outgoingLight, uAmbraScena, v14B * uPulsa14B * mix(${f(TINTA.stringaVetro)}, 1.0, bT)); }
  #include <opaque_fragment>`;
}
// fronte e retro: il telaio disegnato nella texture è metallo come i lati
const F_METALLO = /* glsl */`#include <metalnessmap_fragment>
  { float tE = telaioEsatto(vMapUv);
    metalnessFactor = mix(metalnessFactor, ${f(ST.metalloStrutture)}, tE);
    roughnessFactor = mix(roughnessFactor, ${f(MATERIALI.telaio.roughness)}, tE); }`;

/**
 * Patch di un pezzo: vertice (rotazione, comparsa, eroe, 14-B) e, per i telai, le tinte della tappa 5b.
 * Le uniform si collegano PER RIFERIMENTO all'oggetto "uni" del pezzo (stesso programma, uniform proprie).
 * @param {object} uni @param {'fronte'|'retro'|'telaio'|'acciaio'|'scatola'|'prof'} tipo
 */
function patchPezzo(uni, tipo) {
  const telaio = tipo === 'fronte' || tipo === 'retro' || tipo === 'telaio';
  return sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + V_PARS)
      .replace('#include <beginnormal_vertex>', V_NORMALE)
      .replace('#include <begin_vertex>', V_VERTICE);
    if (!telaio) return;
    let fr = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + F_PARS)
      .replace('#include <opaque_fragment>', fTinte(tipo === 'telaio' ? '1.0' : 'bordoTelaio(vMapUv)'));
    if (tipo !== 'telaio') fr = fr.replace('#include <metalnessmap_fragment>', F_METALLO);
    sh.fragmentShader = fr;
  };
}
const chiavePatch = tipo => `tracker-v1:${tipo}:${NOME_STILE}`;

// ---------------------------------------------------------------- materiali
/** Parametri di base dei materiali (§2.6 e stile di config.MATERIALI.moduli). */
function parametriBase(ctx, tex) {
  const MF = MATERIALI.moduloFronte, MR = MATERIALI.moduloRetro, MT = MATERIALI.telaio, MA = MATERIALI.acciaio;
  const iri = !!ctx.qualita?.Q?.iridescenza && NOME_STILE === 'vetro';
  const scatola = new THREE.Color(ST.telaio).lerp(new THREE.Color(SCATOLA.verso), SCATOLA.k);
  return {
    fronte: [THREE.MeshPhysicalMaterial, {
      map: tex.fronte, color: 0xffffff, roughness: ST.roughness, metalness: 0, clearcoat: ST.clearcoat,
      clearcoatRoughness: CC_RUVIDO[NOME_STILE], ior: MF.ior, envMapIntensity: ENV_FRONTE[NOME_STILE], specularIntensity: SPECULARE[NOME_STILE],
      ...(iri ? { iridescence: MF.iridescence, iridescenceIOR: MF.iridescenceIOR, iridescenceThicknessRange: MF.iridescenceThicknessRange.slice() } : {}),
    }],
    retro: [THREE.MeshPhysicalMaterial, {
      map: tex.retro, color: 0xffffff, roughness: MR.roughness, metalness: 0, clearcoat: MR.clearcoat * ST.clearcoat,
      clearcoatRoughness: Math.min(1, CC_RUVIDO[NOME_STILE] * 2), envMapIntensity: 1,
    }],
    telaio: [THREE.MeshStandardMaterial, { color: new THREE.Color(ST.telaio), metalness: ST.metalloStrutture, roughness: MT.roughness, envMapIntensity: MT.envMapIntensity }],
    acciaio: [THREE.MeshStandardMaterial, { color: new THREE.Color(ST.acciaio), metalness: ST.metalloStrutture, roughness: MA.roughness, envMapIntensity: MA.envMapIntensity }],
    scatola: [THREE.MeshStandardMaterial, { color: scatola, metalness: 0, roughness: SCATOLA.roughness, envMapIntensity: SCATOLA.envMapIntensity }],
  };
}
/** Un materiale del pezzo (classe e parametri di base, patch con le uniform del pezzo). */
function materiale(B, tipo, uni) {
  const [Classe, par] = B[tipo];
  const p = { ...par }; if (p.color?.isColor) p.color = p.color.clone();
  return nuovoMateriale(Classe, p, { patch: patchPezzo(uni, tipo), chiave: chiavePatch(tipo) });
}

// ---------------------------------------------------------------- istanze
const _m = new THREE.Matrix4();
/**
 * InstancedMesh di un pezzo con gli attributi d'istanza e i materiali d'ombra e delle normali con la stessa patch.
 * @param {object} voci { pos: number[] (x,y,z), sc: number[] (sx,sy,sz), chiave: number[], ordine: number[], fila: number[] }
 * @param {boolean} fisse true = matrici scritte qui una volta (campi); false = scritte dalla CPU (eroe)
 */
function creaIstanze(nome, geo, mat, voci, uni, { ombra = true, fisse = true } = {}) {
  const n = voci.chiave.length;
  geo.setAttribute('aChiave', new THREE.InstancedBufferAttribute(new Float32Array(voci.chiave), 1));
  geo.setAttribute('aOrdine', new THREE.InstancedBufferAttribute(new Float32Array(voci.ordine), 1));
  geo.setAttribute('aFila', new THREE.InstancedBufferAttribute(new Float32Array(voci.fila), 1));
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.name = nome;
  for (let i = 0; i < n; i++) {
    _m.makeScale(voci.sc[3 * i], voci.sc[3 * i + 1], voci.sc[3 * i + 2]).setPosition(voci.pos[3 * i], voci.pos[3 * i + 1], voci.pos[3 * i + 2]);
    im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true;
  if (fisse) { im.computeBoundingSphere(); im.boundingSphere.radius += COMPARSA.raggioExtra; }   // rotazione e salita nello shader
  else { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; }
  im.castShadow = ombra; im.receiveShadow = true;
  im.customDepthMaterial = nuovoMateriale(THREE.MeshDepthMaterial, { depthPacking: THREE.RGBADepthPacking }, { patch: patchPezzo(uni, 'prof'), chiave: chiavePatch('prof') });
  im.userData.materialeNormali = nuovoMateriale(THREE.MeshNormalMaterial, {}, { patch: patchPezzo(uni, 'prof'), chiave: chiavePatch('prof') });
  return im;
}
const nuoveVoci = () => ({ pos: [], sc: [], chiave: [], ordine: [], fila: [] });
function voce(V, x, y, z, sx, sy, sz, chiave, ordine, fila) {
  V.pos.push(x, y, z); V.sc.push(sx, sy, sz); V.chiave.push(chiave); V.ordine.push(ordine); V.fila.push(fila);
}
/** z dei centri dei moduli di un tracker (fuga centrale per la ralla), dal centro verso le estremità: [sud, nord, …]. */
function zModuli(t) {
  const c = (t.z0 + t.z1) / 2, p = LAYOUT.passoModulo, gap = (t.z1 - t.z0 - t.moduli * p) / 2, out = [];
  for (let j = 0; j < t.moduli / 2; j++) { const d = gap + p * (j + 0.5); out.push(c + d, c - d); }
  return out;
}

/** Un campo (fv | agri): un InstancedMesh per pezzo. */
function creaCampo(ctx, nome, lay, B, U, codici) {
  const P = LAYOUT[nome], asseM = P.quotaAsse * M_U, fv = nome === 'fv';
  const alterne = fv && !!ctx.qualita?.Q?.fileAlterne;
  const trk = lay.tracker.filter(t => !alterne || t.fila % 2 === 0 || t.fila === codici.filaEroe || t.fila === codici.fila14B);
  const V = { moduli: nuoveVoci(), tubi: nuoveVoci(), pali: nuoveVoci(), cuscinetti: nuoveVoci(), motori: nuoveVoci() };
  let minChiave = Infinity, minOrdine = Infinity;
  for (const t of trk) {
    const y = t.centro[1], suolo = y - P.quotaAsse, c = (t.z0 + t.z1) / 2, k = t.chiave, o = t.ordine, fl = codiceFila(t.fila, t.lettera);
    minChiave = Math.min(minChiave, k); minOrdine = Math.min(minOrdine, o);
    for (const z of zModuli(t)) voce(V.moduli, t.x, y, z, SC, SC, SC, k, o, fl);
    voce(V.tubi, t.x, y, c, SC, SC, t.z1 - t.z0, k, o, fl);
    voce(V.motori, t.x, y, c, SC, SC, SC, k, o, fl);
    for (const zp of t.pali) {
      voce(V.pali, t.x, suolo, zp, SC, SC, SC, k, o, fl);
      if (Math.abs(zp - c) > 1e-6) voce(V.cuscinetti, t.x, y, zp, SC, SC, SC, k, o, fl);
    }
  }
  const geo = { moduli: geoModulo(), tubi: geoTubo(1), pali: geoPalo(P.testaPaloM), cuscinetti: geoCuscinetto(), motori: geoMotore(asseM) };
  const tipi = { moduli: ['telaio', 'fronte', 'retro'], tubi: ['acciaio'], pali: ['acciaio'], cuscinetti: ['acciaio'], motori: ['acciaio', 'scatola'] };
  const ombra = { moduli: true, tubi: true, pali: true, cuscinetti: false, motori: false };
  const mesh = {}, materiali = {};
  for (const p of Object.keys(PEZZI)) {
    const PZ = PEZZI[p];
    const uni = {
      uAngolo: U[fv ? 'uAngoloFV' : 'uAngoloAgri'], uRuota: { value: PZ.ruota },
      uComparsa: U[fv ? 'comparsaFV' : 'comparsaAgri'], uComparsaC: U[PZ.cantiere], uModo: U.uModo,
      uModuli: { value: PZ.moduli }, uEroe: U.eroe, uFilaEroe: { value: fv ? codici.eroe : -1 }, uFila14B: { value: fv ? codici.s14B : -1 },
      uStatoFile: U.statoFile, uPulsa14B: D.uPulsa, uSmeraldoScena: D.uSmeraldo, uAmbraScena: D.uAmbra,
    };
    const mats = tipi[p].map(tp => materiale(B, tp, uni));
    if (p === 'moduli') Object.assign(materiali, { telaio: mats[0], fronte: mats[1], retro: mats[2] });
    if (p === 'tubi') materiali.acciaio = mats[0];
    const im = creaIstanze(`tracker.${nome}.${p}`, geo[p], mats.length > 1 ? mats : mats[0], V[p], uni, { ombra: ombra[p] });
    im.visible = false;
    mesh[p] = im;
  }
  const gruppo = new THREE.Group(); gruppo.name = `tracker.${nome}`;
  gruppo.add(...Object.values(mesh));
  ctx.scene.pianura.add(gruppo);
  const lista = Object.keys(mesh).map(p => ({ mesh: mesh[p], cantiere: PEZZI[p].cantiere }));   // per aggiorna (niente for-in)
  return { nome, gruppo, mesh, lista, materiali, minChiave, minOrdine, onda: fv ? 'comparsaFV' : 'comparsaAgri', moduli: V.moduli.chiave.length };
}

// ---------------------------------------------------------------- tracker eroe
/** Pezzo dell'eroe: istanze con basi (m, nel gruppo), ritardi e spostamenti. */
function pezzoEroe(nome, geo, mat, basi, ritardi, offset, uni, segni = null) {
  const n = ritardi.length, V = nuoveVoci();
  for (let i = 0; i < n; i++) voce(V, basi[3 * i], basi[3 * i + 1], basi[3 * i + 2], 1, 1, 1, 0, 0, 0);
  const mesh = creaIstanze(`tracker.eroe.${nome}`, geo, mat, V, uni, { fisse: false });
  return { mesh, n, basi: Float32Array.from(basi), ritardi: Float32Array.from(ritardi), offset, segni: segni && Float32Array.from(segni), gira: -1 };
}

function creaEroe(ctx, t, B, U) {
  const asseM = LAYOUT.fv.quotaAsse * M_U, c = (t.z0 + t.z1) / 2, E = ESPLOSA;
  const gruppo = new THREE.Group(); gruppo.name = 'tracker.eroe';
  gruppo.position.set(t.x, t.centro[1], c); gruppo.scale.setScalar(SC); gruppo.visible = false;
  // uniform proprie: sempre comparso, mai escluso, nessuna tinta di tappa 5; ruota con i tracker FV
  const uniDi = ruota => ({
    uAngolo: U.uAngoloFV, uRuota: { value: ruota }, uComparsa: { value: 2 }, uComparsaC: { value: 2 }, uModo: { value: 0 },
    uModuli: { value: 0 }, uEroe: { value: 0 }, uFilaEroe: { value: -1 }, uFila14B: { value: -1 },
    uStatoFile: { value: 0 }, uPulsa14B: { value: 0 }, uSmeraldoScena: D.uSmeraldo, uAmbraScena: D.uAmbra,
  });
  const uFissi = uniDi(0), uRuota = uniDi(1);
  const zl = z => (z - c) * M_U;
  // pali (piede al suolo) e cuscinetti (sull'asse, tutti i pali tranne il centrale)
  const bp = [], rp = [], bc = [], rc = [];
  let iPalo = 0, iCusc = 0;
  for (const zp of t.pali) {
    if (Math.abs(zp - c) < 1e-6) iPalo = rp.length;
    bp.push(0, -asseM, zl(zp)); rp.push(E.pali.ritardo);
    if (Math.abs(zp - c) > 1e-6) {
      if (Math.abs(zl(zp) - ANCORE_M.cuscinetto) < 0.05) iCusc = rc.length;
      bc.push(0, 0, zl(zp)); rc.push(E.cuscinetti.ritardo);
    }
  }
  const acc = uni => materiale(B, 'acciaio', uni);
  const pali = pezzoEroe('pali', geoPalo(LAYOUT.fv.testaPaloM), acc(uFissi), bp, rp, E.pali.offset, uFissi);
  const cusc = pezzoEroe('cuscinetti', geoCuscinetto(), acc(uFissi), bc, rc, E.cuscinetti.offset, uFissi);
  const tubo = pezzoEroe('tubo', geoTubo((t.z1 - t.z0) * M_U), acc(uRuota), [0, 0, 0], [E.tubo.ritardo], E.tubo.offset, uRuota);
  const motore = pezzoEroe('motore', geoMotore(), acc(uFissi), [0, 0, 0], [E.motore.ritardo], E.motore.offset, uFissi);
  const ctrl = pezzoEroe('controllore', geoControllore(), materiale(B, 'scatola', uFissi),
    [0, CONTROLLORE.quotaM - asseM, CONTROLLORE.z], [E.controllore.ritardo], E.controllore.offset, uFissi);
  // moduli: ritardo dal centro verso le estremità (0,009 ciascuno), x alternato
  const zs = zModuli(t), bm = [], rm = [], sm = [];
  zs.forEach((z, r) => { bm.push(0, 0, zl(z)); rm.push(E.moduli.ritardo + E.moduli.passo * r); sm.push(r % 2 ? -1 : 1); });
  const mm = ['telaio', 'fronte', 'retro'].map(tp => materiale(B, tp, uRuota));
  const moduli = pezzoEroe('moduli', geoModulo(), mm, bm, rm, E.moduli.offset, uRuota, sm);
  moduli.gira = 0;   // il primo della lista: accanto alla ralla, lato sud (+z)
  const pezzi = [pali, cusc, tubo, motore, ctrl, moduli];
  for (const p of pezzi) gruppo.add(p.mesh);
  ctx.scene.pianura.add(gruppo);
  const K = Math.max(E.K, 1 + Math.max(...rm));
  const A = { palo: new THREE.Vector3(), tubo: new THREE.Vector3(), cuscinetto: new THREE.Vector3(), motoriduttore: new THREE.Vector3(),
              controllore: new THREE.Vector3(), modulo: new THREE.Vector3() };
  return { gruppo, pezzi, pali, cusc, tubo, motore, ctrl, moduli, iPalo, iCusc, K, A, ultimo: new Float64Array([NaN, NaN, NaN, NaN]),
           materiali: { fronte: mm[1], retro: mm[2], telaio: mm[0] } };
}

const _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _c = new THREE.Matrix4();
/** Posizione corrente (m, nel gruppo) dell'istanza i del pezzo P → out [x, y, z]. */
function posPezzo(E, P, i, e, out) {
  const k = 1 - P4(clamp((1 - e) * E.K - P.ritardi[i], 0, 1));
  const sx = P.segni ? P.segni[i] : 1;
  out[0] = P.basi[3 * i] + P.offset[0] * sx * k; out[1] = P.basi[3 * i + 1] + P.offset[1] * k; out[2] = P.basi[3 * i + 2] + P.offset[2] * k;
  return out;
}
const _p = [0, 0, 0];
/** Locale del gruppo (m) → mondo, nel Vector3 dato. */
function versoMondo(E, v, x, y, z) { const g = E.gruppo.position; return v.set(g.x + x * SC, g.y + y * SC, g.z + z * SC); }

/** Matrici dell'eroe e ancore: funzione pura di STATO (comparsa, esplosione, giro) e dell'angolo dei tracker FV. */
function aggiornaEroe(ctx, E) {
  const S = ctx.STATO, th = ctx.U.uAngoloFV.value;
  const s = Math.max(S.eroe, 1e-4), e = S.esplosione, g = S.giraModulo, u = E.ultimo;
  if (u[0] === s && u[1] === e && u[2] === g && u[3] === th) return false;
  u[0] = s; u[1] = e; u[2] = g; u[3] = th;
  for (const P of E.pezzi) {
    for (let i = 0; i < P.n; i++) {
      posPezzo(E, P, i, e, _p);
      if (i === P.gira) {
        // giro attorno al lato lungo (asse x del modulo inclinato): F = T(cc)·Rz(θ)·Rx(φ)·Rz(−θ)·T(−cc), cc = Rz(θ)·(0, sopra, 0)
        const w = Math.sin(Math.PI * g), phi = Math.PI * w, lift = GIRA.sollevaM * ss(0, GIRA.liberoSu, w);
        const cx = -SOPRA * Math.sin(th), cy = SOPRA * Math.cos(th);
        _a.makeTranslation(-cx, -cy, 0);
        _b.makeRotationZ(-th).multiply(_a);
        _c.makeRotationX(phi).multiply(_b);
        _b.makeRotationZ(th).multiply(_c);
        _c.makeTranslation(cx, cy, 0).multiply(_b);
        _m.makeScale(s, s, s).multiply(_c).premultiply(_a.makeTranslation(_p[0], _p[1] + lift, _p[2]));
        versoMondo(E, E.A.modulo, _p[0] + s * cx, _p[1] + lift + s * cy, _p[2]);
      } else _m.makeScale(s, s, s).setPosition(_p[0], _p[1], _p[2]);
      P.mesh.setMatrixAt(i, _m);
    }
    P.mesh.instanceMatrix.needsUpdate = true;
  }
  // ancore di §4.4 (sempre gli stessi Vector3)
  posPezzo(E, E.pali, E.iPalo, e, _p); versoMondo(E, E.A.palo, _p[0], _p[1] + s * LAYOUT.fv.testaPaloM, _p[2]);
  posPezzo(E, E.tubo, 0, e, _p); versoMondo(E, E.A.tubo, _p[0], _p[1], _p[2] + s * ANCORE_M.tubo);
  posPezzo(E, E.cusc, E.iCusc, e, _p); versoMondo(E, E.A.cuscinetto, _p[0], _p[1], _p[2]);
  posPezzo(E, E.motore, 0, e, _p); versoMondo(E, E.A.motoriduttore, _p[0] + s * CENTRO_MOTORE[0], _p[1] + s * CENTRO_MOTORE[1], _p[2]);
  posPezzo(E, E.ctrl, 0, e, _p); versoMondo(E, E.A.controllore, _p[0], _p[1], _p[2]);
  return true;
}

// ---------------------------------------------------------------- modulo
const D = {
  pronto: false, campi: [], eroe: null, firma: new Float64Array(8).fill(NaN),
  uPulsa: { value: 0 },                                        // copertura dell'ambra sulla stringa 14-B (0..1)
  uSmeraldo: { value: new THREE.Color() }, uAmbra: { value: new THREE.Color() },   // colori a schermo riportati in scena
  smeraldo: new THREE.Color(PALETTE.smeraldo), ambra: new THREE.Color(PALETTE.ambra), esp: NaN,
};

/** Costruzione (una volta). */
export async function crea(ctx) {
  const U = ctx.U;
  const lay = { fv: ctx.dati.layout?.fv || calcolaLayout('fv'), agri: ctx.dati.layout?.agri || calcolaLayout('agri') };
  // eroe (fila 31, tracker D) e stringa 14-B dal layout calcolato
  const fe = PIANURA.trackerEroe, s14 = LAYOUT.stringa14B;
  const tEroe = lay.fv.tracker.filter(t => t.fila === fe.fila)
    .sort((a, b) => Math.abs((a.z0 + a.z1) / 2 - fe.centro[2]) - Math.abs((b.z0 + b.z1) / 2 - fe.centro[2]))[0];
  const t14 = lay.fv.tracker.find(t => t.fila === s14.fila && t.lettera === s14.tracker);
  const codici = { filaEroe: fe.fila, fila14B: s14.fila,
                   eroe: tEroe ? codiceFila(tEroe.fila, tEroe.lettera) : -1, s14B: t14 ? codiceFila(t14.fila, t14.lettera) : -1 };

  const aniso = ctx.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
  const tex = { fronte: texturaModulo(ST, false, aniso), retro: texturaModulo(ST, true, aniso) };
  const B = parametriBase(ctx, tex);
  const U2 = new Proxy(U, { get: (o, k) => o[k] ?? { value: 0 } });   // tolleranza a chiavi mancanti di STATO
  const fv = creaCampo(ctx, 'fv', lay.fv, B, U2, codici);
  const agri = creaCampo(ctx, 'agri', lay.agri, B, U2, codici);
  const eroe = tEroe ? creaEroe(ctx, tEroe, B, U2) : null;
  Object.assign(D, { campi: [fv, agri], eroe, pronto: true });

  if (eroe) {
    aggiornaEroe(ctx, eroe);
    for (const k of Object.keys(eroe.A)) ctx.ancore.set('eroe.' + k, () => eroe.A[k]);
  }
  ctx.dati.tracker = {
    fv: fv.mesh, agri: agri.mesh, eroe: eroe?.gruppo || null,
    materiali: { fronte: fv.materiali.fronte, retro: fv.materiali.retro, telaio: fv.materiali.telaio, acciaio: fv.materiali.acciaio },
    texturaCelle: tex.fronte, texturaRetro: tex.retro, stile: NOME_STILE,
    totali: { fv: fv.moduli, agri: agri.moduli },
  };
}

/** Ogni fotogramma (solo nella PIANURA): visibilità, pulsazione della 14-B, matrici dell'eroe, richiesta d'ombra. */
export function aggiorna(ctx, T, t /*, dt */) {
  if (!D.pronto) return;
  const S = ctx.STATO, cantiere = S.uModo >= 0.5;
  // un pezzo è disegnato solo se almeno un'istanza ha s > 0 (comparsa oltre la chiave minima)
  for (const C of D.campi) {
    const kMin = cantiere ? C.minOrdine : C.minChiave;
    for (let i = 0; i < C.lista.length; i++) { const p = C.lista[i]; p.mesh.visible = (cantiere ? S[p.cantiere] : S[C.onda]) > kMin; }
  }
  // stringa 14-B: pulsazione verso l'ambra (ferma con il riduci movimento)
  const k14 = S.stringa14B;
  D.uPulsa.value = k14 > 0 ? k14 * TINTA.stringa * (ctx.flags.riduci ? TINTA.riduci : TINTA.pulsaMin + (1 - TINTA.pulsaMin) * (0.5 + 0.5 * Math.sin(2 * Math.PI * TINTA.hz * t))) : 0;
  // smeraldo e ambra: i colori che devono APPARIRE a schermo, riportati in scena con l'esposizione corrente
  if (S.statoFile > 0 || k14 > 0) {
    const esp = esposizioneTono(S);
    if (esp !== D.esp) { D.esp = esp; versoScena(D.smeraldo, esp, D.uSmeraldo.value); versoScena(D.ambra, esp, D.uAmbra.value); }
  }

  let ombra = false;
  const E = D.eroe;
  if (E) {
    E.gruppo.visible = S.eroe > 1e-4;
    if (E.gruppo.visible) ombra = aggiornaEroe(ctx, E);
  }
  // l'ombra si ridisegna quando cambiano angolo, comparse, esplosione (ombre.js osserva già queste chiavi)
  ombra = cambia(0, S.comparsaFV) | cambia(1, S.comparsaAgri) | cambia(2, S.comparsaPali) | cambia(3, S.comparsaTubi)
        | cambia(4, S.comparsaModuli) | cambia(5, S.uModo) | cambia(6, ctx.U.uAngoloFV.value) | cambia(7, ctx.U.uAngoloAgri.value) | ombra;
  if (ombra) ctx.ombre?.richiedi();
}
/** Firma dei valori che muovono i proiettori d'ombra: true se il valore i è cambiato. */
function cambia(i, x) { if (D.firma[i] === x) return false; D.firma[i] = x; return true; }
