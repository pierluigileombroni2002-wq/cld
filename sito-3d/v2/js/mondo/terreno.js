// =============================================================================
// ERI v2 · mondo/terreno.js — terreno della PIANURA: mesh, anello di bordo, shader (splat PBR + overlay d'oro)
// Proprietario: [PIANURA]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.1 (geometria, quote, aAltezza, anello), §6.5 (shader: splat, carta/realtà, fronte, overlay, sottrazione, nuvole), §2.6 terreno, §2.7 overlay, §4.1–4.7 (uniform u* in STATO), config.PIANURA, config.OVERLAY, config.MATERIALI.terreno.
//
// Struttura:
//  - mesh: PlaneGeometry(360, 360, S, S) ruotata nella geometria, S = ctx.qualita.Q.terreno; quote dal campo del catasto
//    (identico ad altezza() sui vertici) o da altezza(); attributo aAltezza (quota originale) e normali calcolate.
//  - anello: dal bordo del quadrato (rientrato di 3 u e abbassato, così la mesh lo copre) fino a 1 500 u, 128 × 64,
//    quota del bordo che sfuma in colline lontane dentro la nebbia. Stesso materiale: gli overlay si spengono fuori dal foglio.
//  - materiale: MeshStandardMaterial (nuovoMateriale) + patch: sollevamento radiale uOnda nel vertice (stessa patch per
//    customDepthMaterial e per il materiale delle normali del GTAO), splat erba-roccia / campo (solchi allineati alla
//    particella) / strade / bosco / piazzali con noTile, carta d'inchiostro ↔ PBR (uRealta, fronte uFronteRealta),
//    gemello d'oro in totalEmissiveRadiance (isoipse, confini catastali, stati, vincoli, fiume carta, onde), sottrazione e
//    nuvole prima di opaque_fragment.
//  - tutte le uniform condivise si collegano PER RIFERIMENTO a ctx.U; quelle private del pacchetto stanno in ctx.dati.catasto.U.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  export { altezza } da ../geo.js (riesportata, NON ridefinita).
//  export const SOLLEVAMENTO_GLSL: string — funzione GLSL lift(vec2 xz) condivisa (uniform uOnda, uSitoC).
//  crea(ctx): legge ctx.dati.catasto (tStati, tVincoli, tMaschere; se assenti usa texture neutre 1×1);
//             pubblica ctx.dati.terreno = { mesh, anello, materiale }.
//  aggiorna(ctx, T, t, dt): nulla da fare (tutto è uniform condivisa).
// =============================================================================
import * as THREE from 'three';
import { PIANURA, OVERLAY, PALETTE, MATERIALI } from '../config.js';
import { altezza, fbm, ss } from '../geo.js';
import { nuovoMateriale } from '../luce/nebbia.js';
export { altezza } from '../geo.js';
export const MONDO = 'pianura';

/** Chunk GLSL del sollevamento radiale (§6.5): float lift = 1 − smoothstep(uOnda − 70, uOnda, distance(xz, uSitoC.xz)). */
export const SOLLEVAMENTO_GLSL = `
uniform float uOnda; uniform vec3 uSitoC;
float lift(vec2 xz){ return 1.0 - smoothstep(uOnda - 70.0, uOnda, distance(xz, uSitoC.xz)); }
`;

const LATO = PIANURA.lato, MEZZO = LATO / 2;
const MT = MATERIALI.terreno, OV = OVERLAY;
const f = v => (+v).toFixed(5);
const vec3Lin = (hex, k = 1) => { const c = new THREE.Color(hex).multiplyScalar(k); return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`; };

// ---------------------------------------------------------------- GLSL
const V_DICH = `attribute float aAltezza;\n${SOLLEVAMENTO_GLSL}`;
const V_VARYING = 'varying float vAlt; varying float vLift; varying vec3 vPosMondo; varying vec3 vNorMondo;\n';

/** Patch del vertice: sollevamento radiale (quota visualizzata = aAltezza · lift) e normali piegate verso l'alto. */
function patchVertice(sh, conVarying, conNormale) {
  let v = sh.vertexShader.replace('#include <common>', '#include <common>\n' + V_DICH + (conVarying ? V_VARYING : ''));
  if (conNormale) v = v.replace('#include <beginnormal_vertex>',
    '#include <beginnormal_vertex>\n\tobjectNormal = normalize( mix( vec3( 0.0, 1.0, 0.0 ), objectNormal, lift( position.xz ) ) );');
  v = v.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tfloat kLift = lift( position.xz );\n\ttransformed.y = aAltezza * kLift;' +
    (conVarying ? '\n\tvAlt = aAltezza; vLift = kLift;\n\tvPosMondo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n\tvNorMondo = normalize( mat3( modelMatrix ) * objectNormal );' : ''));
  sh.vertexShader = v;
}

const C = PIANURA.catasto, VIN = PIANURA.vincoli;
// TARATURA: proporre in config — OVERLAY.svanimentoFwidth [0,3; 0,8] lascia una "zebra" di isoipse a 3 px sui crinali
// visti di taglio: qui le linee svaniscono fra 8 e 3 px di passo (isoipse) e fra 16 e 5 px (celle del catasto).
const FW = [0.12, 0.33], FW_GRIGLIA = [0.06, 0.2];
const F_DICH = /* glsl */`
uniform vec3 uSitoC;
uniform float uRealta, uFronteRealta, uIso, uGriglia, uFiumeMappa;
uniform float uV[5]; uniform float uLampo[5];
uniform float uIdonee, uSottrazione, uSito, uProprietari, uTrattativaFirmata, uAgriSel, uHover;
uniform float uOndaRame, uRitraccia, uFronte, uNuvole, uNuvoleVel, uCantiere, uPx, uTempoR, uPulsa, uLampoFirma;
uniform vec2 uHoverPos;
uniform sampler2D tStati, tVincoli, tMaschere, tCampoDiff, tCampoNor, tCampoArm, tErbaArm;
${V_VARYING}
#define MEZZO ${f(MEZZO)}
#define LATO ${f(LATO)}
#define CELLA ${f(C.CELLA)}
#define NCELLE ${f(C.N)}
#define CA ${f(Math.cos(C.ANGOLO))}
#define SA ${f(Math.sin(C.ANGOLO))}
#define RIP_E ${f(LATO / MT.ripetizioneErba)}
#define RIP_C ${f(LATO / MT.ripetizioneCampo)}
#define FW0 ${f(FW[0])}
#define FW1 ${f(FW[1])}
const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );
const vec3 INCHIOSTRO = ${vec3Lin(PALETTE.inchiostro)};
const vec3 ORO = ${vec3Lin(PALETTE.oro)};
const vec3 ORO_E = ${vec3Lin('#d6a454')};
const vec3 ORO_CHIARO = ${vec3Lin(PALETTE.oroChiaro)};
const vec3 PLATINO = ${vec3Lin(PALETTE.platino)};
const vec3 SMERALDO = ${vec3Lin(PALETTE.smeraldo)};
const vec3 VINCOLO = ${vec3Lin(PALETTE.vincolo)};
const vec3 ACQUA = ${vec3Lin(PALETTE.acqua)};
const vec3 RAME = ${vec3Lin(PALETTE.rame)};
const vec3 ASFALTO = ${vec3Lin(MATERIALI.asfalto.color)};
const vec3 GHIAIA = ${vec3Lin(MATERIALI.ghiaia.color)};
const vec3 CARTA_DIR = vec3( ${OV.cartaOmbreggiatura.direzione.map(f).join(', ')} );
const vec2 ARCH_C = vec2( ${f(VIN.archeologico.centro[0])}, ${f(VIN.archeologico.centro[1])} );
const vec2 CANCELLO = vec2( ${f(PIANURA.cancello[0])}, ${f(PIANURA.cancello[1])} );
const mat2 ROT_NT = mat2( 0.8, -0.6, 0.6, 0.8 );
const vec2 OFF_NT = vec2( 0.37, 0.11 );

float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), q = fract( p ); vec2 u = q * q * ( 3.0 - 2.0 * q );
  return mix( mix( hash12( i ), hash12( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash12( i + vec2( 0.0, 1.0 ) ), hash12( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
// noTile: campione semplice + campione ruotato e spostato, scelti da rumore a bassa frequenza (dossier §4)
vec4 ntCol( sampler2D t, vec2 uv, float k ) { return mix( texture2D( t, uv ), texture2D( t, ROT_NT * uv + OFF_NT ), k ); }
// per le normal map il secondo campione si riporta indietro della rotazione (ROTᵀ), poi nello spazio della mesh (Mᵀ)
vec3 ntNor( sampler2D t, vec2 uv, float k, mat2 M ) {
  vec3 n1 = texture2D( t, uv ).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D( t, ROT_NT * uv + OFF_NT ).xyz * 2.0 - 1.0;
  n2.xy = transpose( ROT_NT ) * n2.xy;
  vec3 n = normalize( mix( n1, n2, k ) );
  n.xy = transpose( M ) * n.xy;
  return n;
}
float bitDi( float b, float n ) { return mod( floor( b / n + 0.001 ), 2.0 ); }
// copertura di una linea a distanza d (px) con spessore w (px); sotto 1 px la linea si attenua invece di assottigliarsi
float lineaD( float d, float w ) { return clamp( 0.5 * max( w, 1.0 ) + 0.5 - d, 0.0, 1.0 ) * min( w, 1.0 ); }
// linea periodica (isoipse): svanisce quando fwidth supera FW0–FW1 (anti-moiré)
float lineaP( float v, float w ) {
  float fw = max( fwidth( v ), 1e-5 );
  return lineaD( abs( fract( v - 0.5 ) - 0.5 ) / fw, w ) * ( 1.0 - smoothstep( FW0, FW1, fw ) );
}
float maschera( float v ) { return clamp( ( v - 0.5 ) / max( fwidth( v ), 1e-4 ) + 0.5, 0.0, 1.0 ); }
float bordoM( float v, float w ) { return lineaD( abs( v - 0.5 ) / max( fwidth( v ), 1e-4 ), w ); }
float tratt( vec2 p, vec2 dir, float passo, float w ) { float t = dot( p, dir ) / passo; return lineaD( abs( fract( t - 0.5 ) - 0.5 ) * passo, w ); }
`;

// Splat PBR (sostituisce map_fragment): calcola albedo, armSplat, norSplat e le grandezze riusate dagli overlay.
const F_SPLAT = /* glsl */`
vec2 xz = vPosMondo.xz;
vec3 nM = normalize( vNorMondo );
float pend = 1.0 - nM.y;
vec2 uvM = ( xz + MEZZO ) / LATO;
vec4 masc = texture2D( tMaschere, uvM );
vec2 gC = vec2( CA * xz.x - SA * xz.y, SA * xz.x + CA * xz.y ) / CELLA + NCELLE * 0.5;
vec2 cellaC = floor( gC );
float hC = hash12( cellaC + 17.0 );
// erba-roccia nelle coordinate della mesh (stessa orientazione del TBN), una ripetizione ogni ${MT.ripetizioneErba} u
vec2 uvE = vMapUv * RIP_E;
float kE = smoothstep( 0.35, 0.65, vnoise( uvE * 0.07 ) );
vec4 dErba = ntCol( map, uvE, kE );
vec4 aErba = ntCol( tErbaArm, uvE, kE );
vec3 nErba = ntNor( normalMap, uvE, kE, mat2( 1.0 ) );
// campo arato: solchi allineati alla griglia catastale, ±90° per cella; una ripetizione ogni ${MT.ripetizioneCampo} u
mat2 Mc = mat2( CA, -SA, SA, CA );
if ( hC > 0.5 ) Mc = mat2( 0.0, 1.0, -1.0, 0.0 ) * Mc;
vec2 uvC = Mc * vMapUv * RIP_C + hC * 7.3;
float kC = smoothstep( 0.35, 0.65, vnoise( uvC * 0.07 + 3.1 ) );
vec4 dCampo = ntCol( tCampoDiff, uvC, kC );
vec4 aCampo = ntCol( tCampoArm, uvC, kC );
vec3 nCampo = ntNor( tCampoNor, uvC, kC, Mc );
// pesi: roccia per pendenza, campi dalla maschera R con bordo naturale
float wRoccia = smoothstep( ${f(MT.rocciaPendenza[0])}, ${f(MT.rocciaPendenza[1])}, pend );
float wCampo = smoothstep( 0.3, 0.7, masc.r + ( vnoise( xz * 0.35 ) - 0.5 ) * 0.35 ) * ( 1.0 - wRoccia );
vec3 albedo = mix( dErba.rgb, dCampo.rgb, wCampo );
vec4 arm = mix( aErba, aCampo, wCampo );
vec3 nT = normalize( mix( nErba, nCampo, wCampo ) );
float l0 = dot( albedo, LUMA );
albedo = mix( albedo, vec3( l0 ) * vec3( 1.06, 1.0, 0.92 ) * 1.2, wRoccia * 0.8 );
albedo *= mix( 1.0, 0.45, masc.b );                                         // sottobosco
albedo *= 1.0 + ${f(MT.macro)} * ( vnoise( xz * 0.02 ) * 2.0 - 1.0 );      // variazione macro ±13 %
albedo *= 0.94 + 0.12 * vnoise( xz * 0.13 + 5.0 );
float l1 = dot( albedo, LUMA );
albedo = mix( vec3( l1 ), albedo, ${f(MT.saturazione)} ) * ${f(MT.albedo)};   // saturazione 0,78 · albedo × 0,62 (§2.6)
// strade (asfalto 1,0 · ghiaia 0,6), piazzali (A = 1) e cantiere (A = 0,5, con uCantiere)
float asf = smoothstep( 0.78, 0.92, masc.g );
float ghi = max( smoothstep( 0.35, 0.55, masc.g ) * ( 1.0 - asf ), smoothstep( 0.75, 0.9, masc.a ) );
ghi = max( ghi, smoothstep( 0.3, 0.45, masc.a ) * ( 1.0 - smoothstep( 0.62, 0.75, masc.a ) ) * uCantiere );
albedo = mix( albedo, GHIAIA * ( 0.8 + 0.4 * vnoise( xz * 4.0 ) ), ghi );
albedo = mix( albedo, ASFALTO * ( 0.9 + 0.2 * vnoise( xz * 6.0 ) ), asf );
float ruv = mix( arm.g, 1.0, wRoccia * 0.25 );
ruv = mix( ruv, 0.95, ghi ); ruv = mix( ruv, ${f(MATERIALI.asfalto.roughness)}, asf );
nT = normalize( mix( nT, vec3( 0.0, 0.0, 1.0 ), max( asf, ghi * 0.6 ) ) );
albedo *= mix( 1.0, arm.r, 0.5 );                                            // cavità dall'AO della mappa ARM
// carta d'inchiostro ↔ territorio PBR; fronte circolare da SITO_C (alba della materia)
float dSito = distance( xz, uSitoC.xz );
float realta = uRealta;
if ( uFronteRealta > 0.0 ) realta = max( realta, 1.0 - smoothstep( uFronteRealta - 4.0, uFronteRealta, dSito ) );
diffuseColor.rgb *= mix( INCHIOSTRO, albedo, realta );
vec4 armSplat = vec4( arm.r, mix( 1.0, ruv, realta ), 0.0, 1.0 );
vec3 norSplat = normalize( mix( vec3( 0.0, 0.0, 1.0 ), nT, realta ) ) * 0.5 + 0.5;
`;

// Overlay del gemello d'oro (dopo emissivemap_fragment): tutto in totalEmissiveRadiance, spessori in px CSS × uPx.
const F_OVERLAY = /* glsl */`
vec2 pCss = gl_FragCoord.xy / uPx;
float upx = max( length( fwidth( xz ) ) * 0.70710678, 1e-5 );               // u per pixel del buffer
float dentro = 1.0 - smoothstep( MEZZO - 12.0, MEZZO - 2.0, max( abs( xz.x ), abs( xz.y ) ) );
// isoipse sulla quota originale: ordinarie ogni ${OV.isoipse.passo * 10} m, direttrici ogni ${OV.direttrici.passo * 10} m
float iso = max( lineaP( vAlt / ${f(OV.isoipse.passo)}, ${f(OV.isoipse.px)} * uPx ) * ${f(OV.isoipse.emissione)},
                 lineaP( vAlt / ${f(OV.direttrici.passo)}, ${f(OV.direttrici.px)} * uPx ) * ${f(OV.direttrici.emissione)} );
float zonaLift = vLift * ( 1.0 - vLift ) * 4.0;                              // le isoipse si accendono mentre salgono
float rit = 1.0;
if ( uRitraccia > 0.0 ) { float dd = ( dSito - uRitraccia ) / 4.0; rit += ${f(OV.ritraccia.emissione)} * exp( - dd * dd ) * ( 1.0 - smoothstep( 280.0, 320.0, uRitraccia ) ); }
// catasto: cella corrente e vicini più prossimi in x e in y (tStati, NearestFilter)
vec2 fG = gC - cellaC;
vec2 fwG = max( fwidth( gC ), vec2( 1e-5 ) );
vec2 dirN = vec2( fG.x < 0.5 ? -1.0 : 1.0, fG.y < 0.5 ? -1.0 : 1.0 );
vec2 dB = ( 0.5 - abs( fG - 0.5 ) ) / fwG;
float inGriglia = step( 0.0, cellaC.x ) * step( 0.0, cellaC.y ) * step( cellaC.x, NCELLE - 1.0 ) * step( cellaC.y, NCELLE - 1.0 );
vec4 s0 = textureLod( tStati, ( cellaC + 0.5 ) / NCELLE, 0.0 );
vec4 sX = textureLod( tStati, ( cellaC + vec2( dirN.x, 0.0 ) + 0.5 ) / NCELLE, 0.0 );
vec4 sY = textureLod( tStati, ( cellaC + vec2( 0.0, dirN.y ) + 0.5 ) / NCELLE, 0.0 );
float b0 = floor( s0.r * 255.0 + 0.5 ), bX = floor( sX.r * 255.0 + 0.5 ), bY = floor( sY.r * 255.0 + 0.5 );
float i0 = floor( s0.g * 255.0 + 0.5 ), iX = floor( sX.g * 255.0 + 0.5 ), iY = floor( sY.g * 255.0 + 0.5 );
vec2 fadeG2 = ( 1.0 - smoothstep( vec2( ${f(FW_GRIGLIA[0])} ), vec2( ${f(FW_GRIGLIA[1])} ), fwG ) ) * inGriglia;   // per asse: le linee di taglio svaniscono prima
float fadeG = max( fadeG2.x, fadeG2.y );
float wCf = ${f(OV.confini.px)} * uPx, wI = ${f(OV.idonee.px)} * uPx, wS = ${f(OV.sito.px)} * uPx;
float diffX = step( 0.5, abs( i0 - iX ) ), diffY = step( 0.5, abs( i0 - iY ) );
float confine = max( lineaD( dB.x, wCf ) * diffX * fadeG2.x, lineaD( dB.y, wCf ) * diffY * fadeG2.y );
float ido0 = bitDi( b0, 1.0 ) * inGriglia, sit0 = bitDi( b0, 2.0 ) * inGriglia, agr0 = bitDi( b0, 4.0 ) * inGriglia, trt0 = bitDi( b0, 16.0 );
float bIdo = max( lineaD( dB.x, wI ) * abs( ido0 - bitDi( bX, 1.0 ) ), lineaD( dB.y, wI ) * abs( ido0 - bitDi( bY, 1.0 ) ) ) * fadeG;
float bSit = max( lineaD( dB.x, wS ) * abs( sit0 - bitDi( bX, 2.0 ) ), lineaD( dB.y, wS ) * abs( sit0 - bitDi( bY, 2.0 ) ) );
float bAgr = max( lineaD( dB.x, wS ) * abs( agr0 - bitDi( bX, 4.0 ) ), lineaD( dB.y, wS ) * abs( agr0 - bitDi( bY, 4.0 ) ) );
// stati: idonee, sito (C in trattativa pulsa, poi si firma con un lampo ×2), hover, agrivoltaico, proprietari
float kTr = mix( 0.35 + 0.65 * uPulsa, uLampoFirma, uTrattativaFirmata );
float kSito = mix( 1.0, kTr, trt0 );
vec3 eStati = SMERALDO * uIdonee * ( ${f(OV.idonee.riempimento)} * ido0 + ${f(OV.idonee.bordo)} * bIdo )
            + ORO * uSito * ( ${f(OV.sito.riempimento)} * sit0 + ${f(OV.sito.bordo)} * bSit ) * kSito
            + ORO * uAgriSel * ( ${f(OV.sito.riempimento)} * agr0 + ${f(OV.sito.bordo)} * bAgr );
float hov = ( 1.0 - step( 0.5, abs( i0 - uHover ) ) ) * step( 0.5, uHover ) * ( 1.0 - smoothstep( 30.0, 40.0, distance( xz, uHoverPos ) ) ) * inGriglia;
eStati += ORO_CHIARO * hov * ( 0.3 + 2.0 * max( lineaD( dB.x, wS ) * diffX, lineaD( dB.y, wS ) * diffY ) );
float own = floor( s0.b * 255.0 / 64.0 + 0.5 );
eStati += ( own < 0.5 ? vec3( 0.0 ) : own < 1.5 ? ORO : own < 2.5 ? ORO_CHIARO : own < 3.5 ? PLATINO : ORO ) * 0.3 * uProprietari * inGriglia;
// vincoli: tratteggi in coordinate schermo (px CSS), cerchi in coordinate mondo
vec4 vin = texture2D( tVincoli, uvM );
float h45 = tratt( pCss, vec2( 0.70710678, 0.70710678 ), ${f(OV.paesaggistico.passoPx)}, ${f(OV.paesaggistico.px)} );
float h135 = tratt( pCss, vec2( 0.70710678, -0.70710678 ), ${f(OV.paesaggistico.passoPx)}, ${f(OV.fluviale.px)} );
float h45f = tratt( pCss, vec2( 0.70710678, 0.70710678 ), ${f(OV.paesaggistico.passoPx)}, ${f(OV.ambientale.px)} );
float h135f = tratt( pCss, vec2( 0.70710678, -0.70710678 ), ${f(OV.paesaggistico.passoPx)}, ${f(OV.ambientale.px)} );
vec2 qP = mod( pCss, ${f(OV.pai.passoPx)} ) - ${f(OV.pai.passoPx / 2)};
float punti = clamp( ${f(OV.pai.puntoPx / 2)} + 0.5 - length( qP ), 0.0, 1.0 );
float vP = maschera( vin.r ) * h45 * 0.8 + bordoM( vin.r, ${f(OV.paesaggistico.px)} * uPx );
float vF = maschera( vin.g ) * h135 * 0.8 + bordoM( vin.g, ${f(OV.fluviale.px)} * uPx ) * step( 0.5, fract( ( pCss.x + pCss.y ) * 0.25 ) );
float vI = maschera( vin.b ) * punti;
vec2 dAr = xz - ARCH_C; float rA = length( dAr ); float angA = atan( dAr.y, dAr.x );
float wA = ${f(OV.archeologico.px)} * uPx, periodoA = ${f(OV.archeologico.trattoPx + OV.archeologico.pausaPx)} * uPx * upx;
float c8 = lineaD( abs( rA - ${f(VIN.archeologico.raggio)} ) / upx, wA ) * step( fract( angA * ${f(VIN.archeologico.raggio)} / periodoA ), 0.5 );
float c12 = lineaD( abs( rA - ${f(VIN.archeologico.rispetto)} ) / upx, wA ) * step( fract( angA * ${f(VIN.archeologico.rispetto)} / periodoA ), 0.5 );
float vA = c8 + 0.8 * c12 + ( 1.0 - smoothstep( ${f(VIN.archeologico.raggio)} - upx, ${f(VIN.archeologico.raggio)} + upx, rA ) ) * h45f * 0.45;
float vB = maschera( masc.b ) * max( h45f, h135f ) * 0.7 + bordoM( masc.b, ${f(OV.ambientale.px)} * uPx );
vec3 eVinc = VINCOLO * ( ${f(OV.paesaggistico.emissione)} * vP * uV[0] * uLampo[0] + ${f(OV.fluviale.emissione)} * vF * uV[1] * uLampo[1]
           + ${f(OV.pai.emissione)} * vI * uV[2] * uLampo[2] + ${f(OV.archeologico.emissione)} * vA * uV[3] * uLampo[3]
           + ${f(OV.ambientale.emissione)} * vB * uV[4] * uLampo[4] );
// fiume disegnato sulla carta (passa il testimone al nastro d'acqua)
float fxz = -62.0 + 16.0 * sin( xz.y * 0.017 ) + 6.0 * sin( xz.y * 0.045 + 1.3 );
float dFz = abs( xz.x - fxz );
float riempF = 1.0 - clamp( ( dFz - ${f(OV.fiumeCarta.mezzaLarghezza)} ) / upx + 0.5, 0.0, 1.0 );
vec3 eFiume = ACQUA * ( ${f(OV.fiumeCarta.riempimento)} * riempF + ${f(OV.fiumeCarta.bordo)} * lineaD( abs( dFz - ${f(OV.fiumeCarta.mezzaLarghezza)} ) / upx, uPx ) ) * uFiumeMappa;
// somma: isoipse e confini (ripassati da uRitraccia), stati, vincoli, fiume; spenti fuori dal foglio
vec3 eOv = ( ORO_E * iso * uIso * ( 1.0 + 1.5 * zonaLift ) + PLATINO * ${f(OV.confini.emissione)} * confine * uGriglia ) * rit
         + eStati + eVinc + eFiume;
eOv *= dentro;
// cornice del foglio (carta): linea di squadratura a 3 u dal bordo
float lim = max( abs( xz.x ), abs( xz.y ) );
eOv += ORO * 1.2 * lineaD( abs( lim - ( MEZZO - 3.0 ) ) / upx, uPx ) * ( 1.0 - realta ) * uIso;
// ombreggiatura cartografica da NO (solo carta)
eOv += PLATINO * ${f(OV.cartaOmbreggiatura.emissione)} * clamp( dot( nM, CARTA_DIR ), 0.0, 1.0 ) * ( 1.0 - realta );
// onde: anello di rame (sigillo), bordo d'oro del fronte della realtà, collaudo dal cancello
vec3 eOnde = vec3( 0.0 );
if ( uOndaRame > 0.0 ) {
  float dd = dSito - uOndaRame;
  float a = ( 1.0 - smoothstep( 0.0, ${f(OV.ondaRame.larghezza / 2)}, abs( dd ) ) ) + 0.3 * exp( dd / 6.0 ) * step( dd, 0.0 );
  eOnde += RAME * ${f(OV.ondaRame.emissione)} * a * ( 1.0 - smoothstep( 110.0, 140.0, uOndaRame ) );
}
if ( uFronteRealta > 0.0 ) {
  float dd = ( dSito - uFronteRealta ) / ${f(OV.fronteRealta.larghezza / 2)};
  eOnde += ORO * ${f(OV.fronteRealta.emissione)} * exp( - dd * dd ) * ( 1.0 - smoothstep( 240.0, 300.0, uFronteRealta ) );
}
if ( uFronte >= 0.0 ) {
  float dd = distance( xz, CANCELLO ) - uFronte;
  eOnde += ORO * 2.4 * ( 1.0 - smoothstep( 0.0, 1.0, abs( dd ) ) ) * ( 1.0 - smoothstep( 60.0, 80.0, uFronte ) );
}
totalEmissiveRadiance += eOv + eOnde;
`;

// Prima di opaque_fragment: sottrazione (non idoneo al 15 %) e ombre delle nuvole sulla sola luce del sole/cielo.
const F_FINALE = /* glsl */`
float nuv = 1.0;
if ( uNuvole > 0.0 ) {
  vec2 qn = xz * 0.01 + vec2( 1.0, 0.35 ) * uTempoR * 0.004 * uNuvoleVel;
  float nn = vnoise( qn ) * 0.65 + vnoise( qn * 2.3 + 4.1 ) * 0.35;
  nuv = 1.0 - uNuvole * smoothstep( 0.4, 0.7, nn );
}
float nonIdoneo = uSottrazione * ( 1.0 - ido0 );
vec3 luceBase = outgoingLight - eOv - eOnde;
outgoingLight = luceBase * mix( 1.0, ${f(OV.sottrazioneLuminanza)}, nonIdoneo ) * nuv + eOv * mix( 1.0, 0.6, nonIdoneo ) + eOnde;
#include <opaque_fragment>`;

// ---------------------------------------------------------------- texture neutre (moduli assenti o caricamento fallito)
function neutra(r, g, b, a = 255, srgb = false) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
async function set(ctx, nome) {
  try { return await ctx.carica.texture(nome); }
  catch (e) { console.warn(`[terreno] texture ${nome} assente: uso texture neutre`); return { diff: neutra(90, 84, 60, 255, true), nor: neutra(128, 128, 255), arm: neutra(255, 230, 0) }; }
}

// ---------------------------------------------------------------- geometrie
function creaMesh(S, campo) {
  const geo = new THREE.PlaneGeometry(LATO, LATO, S, S).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = S + 1, aAlt = new Float32Array(n * n);
  const passo = campo ? campo.S / S : 0, daCampo = campo && Number.isInteger(passo);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const h = daCampo ? campo.h[j * passo * campo.n + i * passo] : altezza(pos.getX(k), pos.getZ(k));
    pos.setY(k, h); aAlt[k] = h;
  }
  geo.setAttribute('aAltezza', new THREE.BufferAttribute(aAlt, 1));
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}
/** Anello di bordo: dal perimetro del quadrato (rientrato di 3 u, 0,3 u più in basso: la mesh lo copre) a r1. */
function creaAnello() {
  const A = PIANURA.anello, nA = A.angolari, nR = A.radiali, rIn = MEZZO - 3;
  const ang = [[-rIn, -rIn], [rIn, -rIn], [rIn, rIn], [-rIn, rIn]];
  const pos = new Float32Array((nA + 1) * (nR + 1) * 3), uv = new Float32Array((nA + 1) * (nR + 1) * 2), alt = new Float32Array((nA + 1) * (nR + 1));
  for (let a = 0; a <= nA; a++) {
    const s = (a / nA) * 4, lato = Math.min(3, Math.floor(s)), fr = s - lato;
    const p0 = ang[lato], p1 = ang[(lato + 1) % 4];
    const ix = p0[0] + (p1[0] - p0[0]) * fr, iz = p0[1] + (p1[1] - p0[1]) * fr;
    const th = Math.atan2(iz, ix), ox = Math.cos(th) * A.r1, oz = Math.sin(th) * A.r1;
    const hBordo = altezza(ix, iz) - 0.3;
    // colline lontane, basse, che si perdono nella nebbia (bordo del mondo mai netto)
    const hLontano = 1.5 + 6.5 * (0.5 + 0.5 * fbm(Math.cos(th) * 2.4 + 9.1, Math.sin(th) * 2.4 + 4.3));
    for (let k = 0; k <= nR; k++) {
      const t = k / nR, tt = t * t, x = ix + (ox - ix) * tt, z = iz + (oz - iz) * tt, r = Math.hypot(x, z);
      const lontano = ss(0, 1, (r - rIn) / 420), giu = ss(0, 1, (r - 900) / 600);
      const h = hBordo + (hLontano - hBordo) * lontano - 4 * giu;
      const v = a * (nR + 1) + k;
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z; alt[v] = h;
      uv[v * 2] = (x + MEZZO) / LATO; uv[v * 2 + 1] = (MEZZO - z) / LATO;
    }
  }
  const ind = [];
  for (let a = 0; a < nA; a++) for (let k = 0; k < nR; k++) {
    const A0 = a * (nR + 1) + k, B0 = (a + 1) * (nR + 1) + k;
    ind.push(A0, B0, A0 + 1, B0, B0 + 1, A0 + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aAltezza', new THREE.BufferAttribute(alt, 1));
  geo.setIndex(ind); geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------- crea / aggiorna
let st = null;

export async function crea(ctx) {
  const U = ctx.U, cat = ctx.dati.catasto;
  const [erba, campoTex] = await Promise.all([set(ctx, 'terreno_erba_roccia'), set(ctx, 'terreno_campo')]);
  const P = cat?.U || { uHoverPos: { value: new THREE.Vector2(1e5, 1e5) }, uLampo: { value: [1, 1, 1, 1, 1] }, uPulsa: { value: 0.5 },
                        uLampoFirma: { value: 1 }, uTempoR: U.uTempo };
  const uni = {
    uOnda: U.uOnda, uSitoC: U.uSitoC, uRealta: U.uRealta, uFronteRealta: U.uFronteRealta, uIso: U.uIso, uGriglia: U.uGriglia,
    uFiumeMappa: U.uFiumeMappa, uV: U.uV, uIdonee: U.uIdonee, uSottrazione: U.uSottrazione, uSito: U.uSito, uProprietari: U.uProprietari,
    uTrattativaFirmata: U.uTrattativaFirmata, uAgriSel: U.uAgriSel, uHover: U.uHover, uOndaRame: U.uOndaRame, uRitraccia: U.uRitraccia,
    uFronte: U.uFronte ?? { value: -1 }, uNuvole: U.uNuvole, uNuvoleVel: U.uNuvoleVel, uCantiere: U.uCantiere ?? { value: 0 }, uPx: U.uPx,
    uTempoR: P.uTempoR, uPulsa: P.uPulsa, uLampoFirma: P.uLampoFirma, uLampo: P.uLampo, uHoverPos: P.uHoverPos,
    tStati: { value: cat?.tStati || neutra(0, 0, 0, 0) }, tVincoli: { value: cat?.tVincoli || neutra(0, 0, 0, 0) },
    tMaschere: { value: cat?.tMaschere || neutra(0, 0, 0, 0) },
    tCampoDiff: { value: campoTex.diff }, tCampoNor: { value: campoTex.nor }, tCampoArm: { value: campoTex.arm }, tErbaArm: { value: erba.arm },
  };
  const patchTerreno = sh => {
    Object.assign(sh.uniforms, uni);
    patchVertice(sh, true, true);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + F_DICH)
      .replace('#include <map_fragment>', F_SPLAT)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * armSplat.g;')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv ).xyz').join('norSplat'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + F_OVERLAY)
      .replace('#include <opaque_fragment>', F_FINALE);
  };
  const materiale = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: 0xffffff, map: erba.diff, normalMap: erba.nor, roughness: MT.roughness, metalness: MT.metalness, envMapIntensity: MT.envMapIntensity,
  }, { patch: patchTerreno, chiave: 'terreno-v1' });
  const patchSolo = (normale) => sh => { sh.uniforms.uOnda = U.uOnda; sh.uniforms.uSitoC = U.uSitoC; patchVertice(sh, false, normale); };
  const profondita = nuovoMateriale(THREE.MeshDepthMaterial, { depthPacking: THREE.RGBADepthPacking }, { patch: patchSolo(false), chiave: 'terreno-profondita' });
  const normali = nuovoMateriale(THREE.MeshNormalMaterial, {}, { patch: patchSolo(true), chiave: 'terreno-normali' });

  const S = ctx.qualita?.Q?.terreno || PIANURA.segmenti.media;
  const mesh = new THREE.Mesh(creaMesh(S, cat?.campo), materiale);
  mesh.name = 'terreno'; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.customDepthMaterial = profondita; mesh.userData.materialeNormali = normali;
  const anello = new THREE.Mesh(creaAnello(), materiale);
  anello.name = 'terreno.anello'; anello.receiveShadow = true; anello.castShadow = false; anello.userData.materialeNormali = normali;
  ctx.scene.pianura.add(mesh, anello);
  ctx.dati.terreno = { mesh, anello, materiale };
  st = { mesh, anello, materiale };
}

/** Ogni fotogramma: nulla (tutte le grandezze animate sono uniform condivise collegate per riferimento). */
export function aggiorna(/* ctx, T, t, dt */) {}
