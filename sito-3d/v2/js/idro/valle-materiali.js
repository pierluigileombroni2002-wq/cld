// =============================================================================
// ERI v2 · idro/valle-materiali.js — materiali del plastico bianco della VALLE (file privato di idro/valle.js)
// Proprietario: [VALLE]. Si importa SOLO dai moduli idro/*.
// Specifica: DESIGN §2.6 (sezione), §6.5 (plastico: isoipse, oscura), §6.7 (sezioni senza stencil), config.VALLE.plastico,
// config.MATERIALI.sezione / inox / turbine, config.OVERLAY.isoipse / direttrici / isoipseValle.
//
// Linguaggio del plastico (tema chiaro): superfici avorio opache, inchiostro d'oro sottile, facce di taglio PIATTE
// (campitura carta2 con tratteggio oro a 45° in px, come il "poché" di un disegno di sezione: non prendono luce).
// Il colore piatto delle sezioni è quello che deve APPARIRE a schermo: si riporta in HDR con versoScena (l'inversa
// del tone mapping di luce/nebbia.js) a ogni fotogramma, così non dipende dall'esposizione delle tappe.
// "oscura" (4e) vela il plastico verso la carta: c = mix(c, carta, oscura), mai verso il nero.
// Nomi GLSL con prefisso vs/uVs: le patch si sommano a quelle degli altri moduli sullo stesso materiale.
// =============================================================================
import * as THREE from 'three';
import { PALETTE, MATERIALI, OVERLAY, VALLE } from '../config.js';
import { nuovoMateriale, aggiungiPatch, versoScena, esposizioneTono } from '../luce/nebbia.js';

const f = v => (+v).toFixed(5);
const vec3Lin = hex => { const c = new THREE.Color(hex); return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`; };
// copertura d'inchiostro 0..1 dai fattori di OVERLAY (ripiego se un valore fosse ancora un'emissione HDR > 1)
export const cop = v => (v > 1 ? Math.min(v / 2.4, 1) : v);

const PL = VALLE.plastico, SZ = MATERIALI.sezione, ISO = OVERLAY.isoipseValle;
// TARATURA: proporre in config (VALLE.plastico) — tutto ciò che config non fissa per il plastico bianco
// Luce: un bianco appare bianco solo con ≈ 2 di radianza prima di ACES; il sole della valle (2,6 a 35°) ne dà ≈ 0,45.
// Si alza l'ambiente sui materiali del plastico e si aggiunge un riempimento caldo (emissivo "di rimbalzo", come la
// luce diffusa di uno studio fotografico): le ombre restano avorio, non grigio-azzurre.
export const TARATURA_MAT = {
  terreno: { roughness: 0.82, env: 0.95, riempimento: 0.1, bande: 0.035,      // bande ogni 50 m (strati di cartone)
             fini: { passo: 1, px: 0.9, copertura: 0.34 } },                 // isoipse ogni 10 m: compaiono solo da vicino
  edifici: { roughness: 0.74, env: 0.9, riempimento: 0.17 },       // più riempimento: soffitti delle sale avorio, non tortora
  pavimento: { colore: '#efe9e0', roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.18, env: 1.0, riempimento: 0.1,   // resina lucida delle sale
               giunti: { passo: 0.5, px: 0.9, copertura: 0.12 } },      // tagli del pavimento ogni 5 m (scala e finitura)
  acqua: { roughness: 0.08, clearcoat: 0.5, env: 0.6, normale: 0.14, deriva: 0.012 },
  // letto dipinto sotto la resina (come nei plastici veri): riva chiara, fondo più saturo; ink delle isoipse spento sott'acqua
  fondo: { riva: '#b7d3dc', profondo: '#5d95b0', metri: 3.0, forza: 0.92 },
  // sezione d'acqua: 22 % al pelo (config), più densa e più blu in profondità
  sezioneAcqua: { alfaFondo: 0.62, colFondo: '#4c86a3', metri: 4.0 },
  appoggio: { env: 0.9, riempimento: 0.12, contatto: [0.3, 2.5], alone: [0.1, 28], dissolvenza: [80, 650] },   // ombra di contatto, cove
  strati: { forte: 0.26, passoForte: 5 },                       // linee di strato ogni 50 m sulla sezione (oltre ai 5 m di config)
  zoccolo: { y: -4.6, colore: PALETTE.grafite, filetto: PALETTE.oroLinea },   // basamento scuro con filetto d'oro
  fwidth: [0.12, 0.33],                                         // svanimento delle linee periodiche (come terreno.js)
  stili: { inox: { clearcoat: 0.0 }, bianco: { clearcoat: 0.3 }, verniciato: { clearcoat: 0.85 } },   // vernice "da carrozzeria"
};
const TM = TARATURA_MAT;

// ---------------------------------------------------------------- uniform private (colori a schermo → HDR)
/**
 * Uniform del pacchetto VALLE condivise per riferimento da tutti i materiali del plastico.
 * aggiornaColori() le riscrive a ogni fotogramma con l'esposizione corrente.
 */
export function creaUniformValle() {
  return {
    uVsFondo: { value: new THREE.Color() },      // campitura della sezione (carta2 a schermo)
    uVsInch: { value: new THREE.Color() },       // tratteggio pieno (oro a schermo)
    uVsCarta: { value: new THREE.Color() },      // velo "oscura" (carta a schermo)
    uVsZoccolo: { value: new THREE.Color() },    // basamento
    uVsFiletto: { value: new THREE.Color() },    // filetto d'oro del basamento
    uVsDeriva: { value: new THREE.Vector2() },   // deriva lenta della normal map dei laghi
  };
}
const _c = new THREE.Color();
const COL = {
  fondo: new THREE.Color(SZ.fondo || PL.sezione), inch: new THREE.Color(SZ.tratteggio || PALETTE.oro),
  carta: new THREE.Color(PALETTE.carta), zoccolo: new THREE.Color(TM.zoccolo.colore), filetto: new THREE.Color(TM.zoccolo.filetto),
};
/** Riporta in HDR i colori piatti (devono apparire così a schermo, qualunque sia l'esposizione). */
export function aggiornaColori(ctx, UV) {
  const esp = esposizioneTono(ctx.STATO);
  versoScena(_c.copy(COL.fondo), esp, UV.uVsFondo.value);
  versoScena(_c.copy(COL.inch), esp, UV.uVsInch.value);
  versoScena(_c.copy(COL.carta), esp, UV.uVsCarta.value);
  versoScena(_c.copy(COL.zoccolo), esp, UV.uVsZoccolo.value);
  versoScena(_c.copy(COL.filetto), esp, UV.uVsFiletto.value);
}

// ---------------------------------------------------------------- GLSL comune
const GLSL_LINEE = /* glsl */`
#ifndef VS_LINEE
#define VS_LINEE
// copertura di una linea a distanza d (px) con spessore w (px); sotto 1 px si attenua invece di assottigliarsi
float vsLineaD( float d, float w ) { return clamp( 0.5 * max( w, 1.0 ) + 0.5 - d, 0.0, 1.0 ) * min( w, 1.0 ); }
// linea periodica (isoipse, strati): svanisce quando il passo scende sotto pochi px (anti-moiré)
float vsLineaP( float v, float w ) {
  float fw = max( fwidth( v ), 1e-5 );
  return vsLineaD( abs( fract( v - 0.5 ) - 0.5 ) / fw, w ) * ( 1.0 - smoothstep( ${f(TM.fwidth[0])}, ${f(TM.fwidth[1])}, fw ) );
}
#endif
`;
const GLSL_SEZIONE = /* glsl */`
#ifndef VS_SEZIONE
#define VS_SEZIONE
uniform float uVsPx, uVsOscura;
uniform vec3 uVsFondo, uVsInch, uVsCarta;
${GLSL_LINEE}
// campitura della sezione: fondo carta2 + tratteggio oro a 45° ("/") in coordinate schermo, passo e linea in px CSS
vec3 vsSezione( vec2 fc ) {
  float P = ${f(SZ.passoPx)} * uVsPx;
  float d = abs( fract( ( fc.x - fc.y ) * 0.70710678 / P - 0.5 ) - 0.5 ) * P;
  return mix( uVsFondo, uVsInch, vsLineaD( d, ${f(SZ.lineaPx)} * uVsPx ) * ${f(cop(SZ.emissione))} );
}
#endif
`;
const V_POS = 'varying vec3 vVsPos;\n';
function conPosizione(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + V_POS)
    .replace('#include <project_vertex>', '#include <project_vertex>\n\tvVsPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + V_POS);
}
function collegaSezione(sh, ctx, UV) {
  sh.uniforms.uVsPx = ctx.U.uPx; sh.uniforms.uVsOscura = ctx.U.oscura;
  sh.uniforms.uVsFondo = UV.uVsFondo; sh.uniforms.uVsInch = UV.uVsInch; sh.uniforms.uVsCarta = UV.uVsCarta;
}

// ---------------------------------------------------------------- patch pubblica: campitura delle sezioni
/**
 * Crea patchSezione(materiale) (ctx.dati.valle.patchSezione): le retro-facce viste attraverso un piano di taglio
 * diventano la campitura piatta della sezione (§6.7, senza stencil); tutto il materiale segue "oscura" (4e).
 * Imposta side = DoubleSide: va chiamata alla CREAZIONE del materiale, insieme ai clippingPlanes.
 * Vale per MeshStandard/Physical/Lambert/Phong/Basic (serve outgoingLight).
 */
export function creaPatchSezione(ctx, UV) {
  const patch = sh => {
    collegaSezione(sh, ctx, UV);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_SEZIONE)
      .replace('#include <opaque_fragment>',
        '\tif ( !gl_FrontFacing ) outgoingLight = vsSezione( gl_FragCoord.xy );\n' +
        '\toutgoingLight = mix( outgoingLight, uVsCarta, uVsOscura );\n#include <opaque_fragment>');
  };
  return function patchSezione(m) {
    if (!m || m.userData.vsSezione) return m;
    m.userData.vsSezione = true;
    m.side = THREE.DoubleSide;
    return aggiungiPatch(m, patch, 'valle.sezione');
  };
}

// ---------------------------------------------------------------- facce di taglio esplicite (piatte)
/**
 * Materiale piatto delle facce di taglio esplicite. terreno = true: strati ogni 5 m (12 %) e ogni 50 m, basamento
 * scuro con filetto d'oro sotto TARATURA_MAT.zoccolo.y (solo la sezione del blocco). piani = clippingPlanes.
 */
export function materialeSezione(ctx, UV, { terreno = false, piani = null, nome = 'valle.sezione' } = {}) {
  const ST = TM.strati, Z = TM.zoccolo;
  const patch = sh => {
    collegaSezione(sh, ctx, UV);
    sh.uniforms.uVsZoccolo = UV.uVsZoccolo; sh.uniforms.uVsFiletto = UV.uVsFiletto;
    conPosizione(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_SEZIONE + 'uniform vec3 uVsZoccolo, uVsFiletto;\n')
      .replace('#include <opaque_fragment>', /* glsl */`
  vec3 cS = vsSezione( gl_FragCoord.xy );
  ${terreno ? `
  // strati del plastico: ogni ${SZ.stratiOgniM} m (leggeri, solo da vicino) e ogni ${ST.passoForte * 10} m (leggibili anche da lontano)
  float st = max( vsLineaP( vVsPos.y / ${f(SZ.stratiOgniM / 10)}, uVsPx ) * ${f(SZ.stratiAlfa)},
                  vsLineaP( vVsPos.y / ${f(ST.passoForte)}, uVsPx ) * ${f(ST.forte)} );
  cS = mix( cS, uVsInch, st );
  // basamento scuro con filetto d'oro (il plastico poggia su uno zoccolo laccato)
  float fwY = max( fwidth( vVsPos.y ), 1e-5 );
  float sotto = clamp( ( ${f(Z.y)} - vVsPos.y ) / fwY + 0.5, 0.0, 1.0 );
  cS = mix( cS, uVsZoccolo, sotto );
  cS = mix( cS, uVsFiletto, vsLineaD( abs( vVsPos.y - ${f(Z.y)} ) / fwY, 1.4 * uVsPx ) );` : ''}
  outgoingLight = mix( cS, uVsCarta, uVsOscura );
#include <opaque_fragment>`);
  };
  const par = { color: 0xffffff, side: THREE.DoubleSide };
  if (piani) Object.assign(par, { clippingPlanes: piani, clipShadows: true });
  const m = nuovoMateriale(THREE.MeshBasicMaterial, par, { patch, chiave: terreno ? 'valle.sezione.terreno' : 'valle.sezione.piatta' });
  m.name = nome;
  return m;
}

// ---------------------------------------------------------------- superficie del plastico (isoipse a inchiostro)
/** Superficie avorio del plastico: isoipse ogni 50 m e direttrici ogni 250 m a inchiostro d'oro, bande lievi, letto
 *  dei laghi dipinto (attributo aAcqua = profondità sotto il pelo libero), oscura. */
export function materialeTerreno(ctx, UV) {
  const I1 = OVERLAY.isoipse, I2 = OVERLAY.direttrici, T = TM.terreno, FD = TM.fondo;
  const patch = sh => {
    sh.uniforms.uVsPx = ctx.U.uPx; sh.uniforms.uVsOscura = ctx.U.oscura; sh.uniforms.uVsCarta = UV.uVsCarta;
    conPosizione(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAcqua; varying float vVsAcqua;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvVsAcqua = aAcqua;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uVsPx, uVsOscura; uniform vec3 uVsCarta; varying float vVsAcqua;\n' + GLSL_LINEE +
        `const vec3 VS_CARTA = ${vec3Lin(PALETTE.carta)};\nconst vec3 VS_ORO = ${vec3Lin(PL.linee)};\n` +
        `const vec3 VS_RIVA = ${vec3Lin(FD.riva)};\nconst vec3 VS_FONDO = ${vec3Lin(FD.profondo)};\n` +
        // inchiostro sottrattivo: sulla carta dà esattamente il colore della linea (come terreno.js)
        'void vsInch( inout vec3 c, vec3 col, float a ) { c *= mix( vec3( 1.0 ), col / VS_CARTA, clamp( a, 0.0, 1.0 ) ); }\n')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
  {
    float h = vVsPos.y;
    // strati di cartone: una banda ogni ${ISO.passo * 10} m un tono sotto (appena percettibile)
    diffuseColor.rgb *= 1.0 - ${f(T.bande)} * step( 0.5, fract( h / ${f(2 * ISO.passo)} ) );
    // letto sommerso dipinto: riva chiara, fondo più saturo; linea di riva netta (anti-alias con fwidth)
    float bagnato = clamp( vVsAcqua / max( fwidth( vVsAcqua ), 1e-4 ) + 0.5, 0.0, 1.0 );
    vec3 letto = mix( VS_RIVA, VS_FONDO, smoothstep( 0.0, ${f(FD.metri)}, vVsAcqua ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, letto, bagnato * ${f(FD.forza)} );
    float i0 = vsLineaP( h / ${f(T.fini.passo)}, ${f(T.fini.px)} * uVsPx ) * ${f(T.fini.copertura)};
    float i1 = vsLineaP( h / ${f(ISO.passo)}, ${f(I1.px)} * uVsPx ) * ${f(cop(I1.emissione))};
    float i2 = vsLineaP( h / ${f(ISO.direttrici)}, ${f(I2.px)} * uVsPx ) * ${f(cop(I2.emissione))};
    vsInch( diffuseColor.rgb, VS_ORO, max( max( i0, i1 ), i2 ) * ( 1.0 - bagnato ) );
  }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= diffuseColor.rgb;')
      .replace('#include <opaque_fragment>', '\toutgoingLight = mix( outgoingLight, uVsCarta, uVsOscura );\n#include <opaque_fragment>');
  };
  // riempimento caldo: emissivo proporzionale all'albedo (sul letto dei laghi resta azzurro)
  const m = nuovoMateriale(THREE.MeshStandardMaterial,
    { color: PL.superficie, roughness: T.roughness, metalness: 0, envMapIntensity: T.env,
      emissive: new THREE.Color(T.riempimento, T.riempimento, T.riempimento) }, { patch, chiave: 'valle.plastico' });
  m.name = 'valle.plastico';
  return m;
}

// ---------------------------------------------------------------- oscura per i materiali "pieni" (front face)
function patchOscura(ctx, UV) {
  return sh => {
    sh.uniforms.uVsOscura = ctx.U.oscura; sh.uniforms.uVsCarta = UV.uVsCarta;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n#ifndef VS_OSCURA\n#define VS_OSCURA\nuniform float uVsOscura; uniform vec3 uVsCarta;\n#endif\n')
      .replace('#include <opaque_fragment>', '\toutgoingLight = mix( outgoingLight, uVsCarta, uVsOscura );\n#include <opaque_fragment>');
  };
}

// ---------------------------------------------------------------- acqua del plastico (azzurro velato)
/** Pelo libero dei laghi e del fiume: resina azzurra velata, lucida, con una normal map lievissima. */
export function materialeAcqua(ctx, UV, normale) {
  const A = TM.acqua;
  const par = { color: PL.acqua, roughness: A.roughness, metalness: 0, clearcoat: A.clearcoat, clearcoatRoughness: 0.05,
                envMapIntensity: A.env, transparent: true, opacity: PL.acquaAlfa, depthWrite: false };
  if (normale) { par.normalMap = normale; par.normalScale = new THREE.Vector2(A.normale, A.normale); }
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, par, { patch: patchOscura(ctx, UV), chiave: 'valle.oscura' });
  m.name = 'valle.acqua';
  return m;
}
/** Sezione d'acqua sulla faccia di taglio: 22 % al pelo libero (config), più densa e più blu in profondità. */
export function materialeAcquaSezione(ctx, UV) {
  const SA = TM.sezioneAcqua, a0 = VALLE.taglio.acquaAlfa;
  const patch = sh => {
    conPosizione(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLivello; varying float vVsLiv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvVsLiv = aLivello;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vVsLiv;\nconst vec3 VS_ACQUA_FONDO = ${vec3Lin(SA.colFondo)};`)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
  float pr = smoothstep( 0.0, ${f(SA.metri)}, vVsLiv - vVsPos.y );
  diffuseColor.rgb = mix( diffuseColor.rgb, VS_ACQUA_FONDO, pr );
  diffuseColor.a *= mix( 1.0, ${f(SA.alfaFondo / a0)}, pr );`);
  };
  const m = nuovoMateriale(THREE.MeshBasicMaterial,
    { color: PL.acqua, transparent: true, opacity: a0, depthWrite: false, side: THREE.DoubleSide },
    { patch, chiave: 'valle.acqua.sezione' });
  aggiungiPatch(m, patchOscura(ctx, UV), 'valle.oscura');
  m.name = 'valle.acqua.sezione';
  return m;
}

// ---------------------------------------------------------------- edifici, pavimenti, casse, inox
/** Bianco del plastico per centrali, diga, traversa, presa (tagliato dai piani dati, campitura sul retro). */
export function materialeEdifici(ctx, patchSezione, piani, nome = 'valle.edifici') {
  const ED = TM.edifici, e = new THREE.Color(PL.edifici).multiplyScalar(ED.riempimento);
  const m = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: PL.edifici, roughness: ED.roughness, metalness: 0, envMapIntensity: ED.env, emissive: e,
    side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true });
  m.name = nome;
  return patchSezione(m);
}
/** Pavimento delle sale: resina chiara lucida (riflette le strisce di luce), giunti sottili sulle facce orizzontali. */
export function materialePavimento(ctx, UV, patchSezione, piani) {
  const P = TM.pavimento, G = P.giunti;
  const patch = sh => {
    collegaSezione(sh, ctx, UV);
    conPosizione(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_SEZIONE)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
  {
    vec3 nG = normalize( cross( dFdx( vVsPos ), dFdy( vVsPos ) ) );
    float g = max( vsLineaP( vVsPos.x / ${f(G.passo)} + 0.5, ${f(G.px)} * uVsPx ), vsLineaP( vVsPos.z / ${f(G.passo)} + 0.5, ${f(G.px)} * uVsPx ) );
    diffuseColor.rgb *= 1.0 - ${f(G.copertura)} * g * step( 0.9, abs( nG.y ) );
  }`);
  };
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, {
    color: P.colore, roughness: P.roughness, metalness: 0, clearcoat: P.clearcoat, clearcoatRoughness: P.clearcoatRoughness,
    envMapIntensity: P.env, emissive: new THREE.Color(P.colore).multiplyScalar(P.riempimento),
    side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true }, { patch, chiave: 'valle.pavimento' });
  m.name = 'valle.pavimento';
  return patchSezione(m);
}
/** Stile delle macchine (config.MATERIALI.turbine, ?turbine=): casse e dettagli. Le giranti restano inox. */
export function stileTurbine() {
  const T = MATERIALI.turbine; return { nome: T.stile in T ? T.stile : 'inox', ...(T[T.stile] || T.inox) };
}
export function materialeCasse(ctx, patchSezione, piani, nome = 'valle.casse') {
  const S = stileTurbine(), extra = TM.stili[S.nome] || {};
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, {
    color: S.cassa, metalness: S.cassaMetallo, roughness: S.cassaRoughness, envMapIntensity: MATERIALI.casse.envMapIntensity,
    clearcoat: extra.clearcoat ?? 0, clearcoatRoughness: 0.12, side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true });
  m.name = nome;
  if (S.cassaMetallo >= 0.5) usaStudio(ctx, m);     // stile metallico: acciaio da vetrina come le giranti
  return patchSezione(m);
}
export function materialeDettagli(ctx, patchSezione, piani) {
  const S = stileTurbine();
  const m = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: S.dettagli, metalness: S.dettagliMetallo, roughness: 0.38, envMapIntensity: MATERIALI.casse.envMapIntensity,
    side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true });
  m.name = 'valle.dettagli';
  if (S.dettagliMetallo >= 0.5) usaStudio(ctx, m);
  return patchSezione(m);
}
/** Inox delle giranti (13Cr-4Ni): MAI oro né bronzo (§2.6). Non tagliato. Con ctx: riflette lo studio (usaStudio);
 *  con UV segue anche "oscura" (4e), come il resto delle macchine. */
export function materialeInox(ctx = null, UV = null) {
  const I = MATERIALI.inox;
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, { color: I.color, metalness: I.metalness, roughness: I.roughness,
    anisotropy: I.anisotropy, envMapIntensity: I.envMapIntensity },
    ctx && UV ? { patch: patchOscura(ctx, UV), chiave: 'valle.oscura' } : {});
  m.name = 'valle.inox';
  return ctx ? usaStudio(ctx, m) : m;
}

// ---------------------------------------------------------------- ambiente da studio per l'inox
// TARATURA: proporre in config (MATERIALI.inox.studio) — l'inox di TUTTE le giranti della tappa 4 (sale e diagramma)
// riflette uno studio fotografico dipinto (pareti grafite, pavimento avorio, softbox), non la stanza chiara: con la
// stanza il metallo lucido diventava vetro lattiginoso, bianco su bianco; così è acciaio da vetrina, con bande scure e
// luci nette. Colori lineari; luci [lon°, lat°, mezza larghezza°, mezza altezza°, intensità], lon +90° = verso +z
// (dove stanno le camere della tappa); fasce: pavimento sotto −25°/−45°, parete fino a 35°/55°, poi soffitto.
export const STUDIO = {
  parete: [0.055, 0.06, 0.065], pavimento: [0.32, 0.29, 0.25], soffitto: [0.2, 0.2, 0.21], fasce: [-25, -45, 35, 55],
  luci: [[130, 14, 9, 30, 8.0], [48, 12, 6, 26, 5.0], [90, 68, 40, 14, 4.0], [-90, 20, 14, 20, 2.5], [180, 5, 6, 30, 3.0]],
};
const studio = { tex: null, materiali: new Set(), ascolto: false };
const sm01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Equirettangolare dipinta dello studio → PMREM (una sola volta; rifatta se il contesto WebGL torna). */
function cuociStudio(renderer) {
  const S = STUDIO, W = 256, H = 128, dati = new Uint16Array(W * H * 4), h = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < H; j++) {
    const lat = (j + 0.5) / H * 180 - 90;                      // v = 0 in basso (equirectUv di three)
    const kp = sm01(S.fasce[0], S.fasce[1], lat), kc = sm01(S.fasce[2], S.fasce[3], lat);
    const base = [0, 1, 2].map(c => S.parete[c] + (S.pavimento[c] - S.parete[c]) * kp + (S.soffitto[c] - S.parete[c]) * kc);
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * 360 - 180;                    // lon = atan2(z, x)
      let r = base[0], g = base[1], b = base[2];
      for (const [l0, f0, hw, hh, I] of S.luci) {
        let dl = Math.abs(lon - l0); if (dl > 180) dl = 360 - dl;
        const w = 1 - sm01(0.7, 1.0, Math.max(dl / hw, Math.abs(lat - f0) / hh));
        r += I * w; g += I * w * 0.985; b += I * w * 0.95;      // luce appena calda
      }
      const k = (j * W + i) * 4; dati[k] = h(r); dati[k + 1] = h(g); dati[k + 2] = h(b); dati[k + 3] = h(1);
    }
  }
  const eq = new THREE.DataTexture(dati, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  eq.mapping = THREE.EquirectangularReflectionMapping; eq.colorSpace = THREE.LinearSRGBColorSpace;
  eq.magFilter = eq.minFilter = THREE.LinearFilter; eq.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(eq);
  pm.dispose(); eq.dispose();
  rt.texture.name = 'valle-studio';
  return rt.texture;
}
/** Ambiente da studio condiviso (null senza renderer: resta l'ambiente della scena). */
export function ambienteStudio(ctx) {
  if (studio.tex || !ctx?.renderer) return studio.tex;
  try { studio.tex = cuociStudio(ctx.renderer); } catch (e) { console.warn('[valle] ambiente da studio non disponibile', e); return null; }
  if (!studio.ascolto && ctx.eventi?.on) {
    studio.ascolto = true;
    ctx.eventi.on('contesto-ripristinato', () => {
      try { studio.tex = cuociStudio(ctx.renderer); for (const m of studio.materiali) m.envMap = studio.tex; } catch { /* resta il vecchio */ }
    });
  }
  return studio.tex;
}
/** Assegna lo studio a un materiale d'inox (alla creazione, prima della compilazione). */
export function usaStudio(ctx, m) {
  const e = ambienteStudio(ctx);
  if (e) { m.envMap = e; studio.materiali.add(m); }
  return m;
}
/**
 * Piano d'appoggio della stanza (carta): riceve l'ombra, ha un'ombra di contatto morbida attorno al blocco e sfuma nel
 * colore della nebbia (= orizzonte del cielo) allontanandosi: nessun orizzonte netto, come il fondale curvo di uno
 * studio fotografico. Non è il plastico: niente oscura.
 */
export function materialeAppoggio() {
  const A = TM.appoggio, B = VALLE.blocco;
  const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, hx = (B.x1 - B.x0) / 2, hz = (B.z1 - B.z0) / 2;
  const patch = sh => {
    conPosizione(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
float vsDistBlocco( vec3 p ) { vec2 d = max( abs( p.xz - vec2( ${f(cx)}, ${f(cz)} ) ) - vec2( ${f(hx)}, ${f(hz)} ), 0.0 ); return length( d ); }`)
      .replace('#include <opaque_fragment>', /* glsl */`
  float dB = vsDistBlocco( vVsPos );
  outgoingLight *= 1.0 - ${f(A.contatto[0])} * exp( -dB / ${f(A.contatto[1])} ) - ${f(A.alone[0])} * exp( -dB / ${f(A.alone[1])} );
#include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
#ifdef USE_FOG
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, smoothstep( ${f(A.dissolvenza[0])}, ${f(A.dissolvenza[1])}, vsDistBlocco( vVsPos ) ) );
#endif`);
  };
  const c = new THREE.Color(VALLE.appoggio.colore);
  const m = nuovoMateriale(THREE.MeshStandardMaterial, { color: c, roughness: 0.95, metalness: 0, envMapIntensity: A.env,
    emissive: c.clone().multiplyScalar(A.riempimento) }, { patch, chiave: 'valle.appoggio' });
  m.name = 'valle.appoggio';
  return m;
}
