// =============================================================================
// ERI v2 · mondo/terreno-natura.js — stile "naturale" del terreno (file privato di mondo/terreno.js, regola 0.1)
// Proprietario: [PIANURA]. Anteprima: ?stile=naturale (ovunque) e ?stile=primipiani (solo vicino alla camera).
//
// Campagna di giugno vista dall'alto: i campi seguono le particelle del catasto (tStati.G) ma senza mosaico di blocchi:
//  - un tipo di coltura per PARTICELLA (non per cella), scelto da hash + rumore regionale (campi vicini simili);
//  - capezzagne erbose fra particelle diverse (bordi appena irregolari), righe e solchi sempre paralleli agli assi
//    del catasto (lungo la particella o di traverso), con antialiasing analitico (fwidth): da lontano la media;
//  - grano con le carreggiate del trattore e le onde del vento, stoppie con le andane, arato con i solchi in rilievo
//    (normali), erba medica a strisce di falciatura, girasoli a righe, prati con zone più secche e più fresche;
//  - pendii a pascolo e roccia, fascia riparia e greto lungo il fiume, sottobosco, strade e piazzali;
//  - dettaglio fotografico dalle texture (luminanza relativa alla loro media, due scale + noTile: niente ripetizione),
//    normal map e AO delle texture.
// Le stesse funzioni (suoloDi, tintaPrato, erbaDi) servono ai fili d'erba 3D (terreno-erba.js): stesso colore sotto
// e sopra, niente anello visibile dove finisce l'erba.
// =============================================================================
import * as THREE from 'three';
import { PIANURA, LAYOUT, MATERIALI } from '../config.js';

const f = v => (+v).toFixed(5);
const lin = (hex, k = 1) => { const c = new THREE.Color(hex).multiplyScalar(k); return `vec3( ${f(c.r)}, ${f(c.g)}, ${f(c.b)} )`; };

// TARATURA: proporre in config (MATERIALI.terreno.naturale) — tinte sRGB della campagna italiana a giugno
export const NATURA = {
  prato: '#8a9e58', pratoFresco: '#7b9a4d', pratoSecco: '#b8ae74',
  grano: '#d3b264', grano2: '#c79f5a', carreggiata: '#a29561', orzo: '#d9c58e',
  stoppie: '#c9b688', andana: '#b09662', terra: '#9a7c5a', terra2: '#ab9271',
  medica: '#678c45', girasole: '#647f3d', margine: '#6e8a45', riparia: '#5f7f43', sottobosco: '#5b6a40',
  roccia: '#b9ac93', sabbia: '#bfb197', fv: '#8ea65e', fvFila: '#a6a66a', paglia: '#cfbd8c',
  ghiaia: '#c8bda8',
  albedo: 1.0,          // moltiplicatore finale dell'albedo (tema chiaro: campagna luminosa)
  macro: 0.13,          // variazione macro di tono (umidità, esposizione)
  bordo: 0.30,          // mezza larghezza delle capezzagne erbose fra particelle (u)
  normale: 1.0,         // forza delle normal map
  sottoErba: 0.18,      // quanto si scurisce il suolo sotto i fili d'erba 3D
  vento: [0.8, 0.6],    // direzione del vento (x, z), la stessa delle onde sul grano e dei fili d'erba
};

/** Intestazione per gli shader che NON includono F_DICH di terreno.js (fili d'erba): costanti, rumore, bit di stato. */
export const BASE_GLSL = /* glsl */`
#define MEZZO ${f(PIANURA.lato / 2)}
#define LATO ${f(PIANURA.lato)}
#define CELLA ${f(PIANURA.catasto.CELLA)}
#define NCELLE ${f(PIANURA.catasto.N)}
#define CA ${f(Math.cos(PIANURA.catasto.ANGOLO))}
#define SA ${f(Math.sin(PIANURA.catasto.ANGOLO))}
uniform sampler2D tStati, tMaschere;
uniform float uCantiere;
float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), q = fract( p ); vec2 u = q * q * ( 3.0 - 2.0 * q );
  return mix( mix( hash12( i ), hash12( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash12( i + vec2( 0.0, 1.0 ) ), hash12( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float bitDi( float b, float n ) { return mod( floor( b / n + 0.001 ), 2.0 ); }
`;

const N = NATURA, R = MATERIALI.terreno.rocciaPendenza;
/** Uso del suolo e tinte, condivisi da terreno (frammento) ed erba (vertice). Richiede tStati e le funzioni di base. */
export const SUOLO_GLSL = /* glsl */`
const vec3 N_PRATO = ${lin(N.prato)}, N_PRATO_FRESCO = ${lin(N.pratoFresco)}, N_PRATO_SECCO = ${lin(N.pratoSecco)};
const vec3 N_GRANO = ${lin(N.grano)}, N_GRANO2 = ${lin(N.grano2)}, N_CARREGGIATA = ${lin(N.carreggiata)}, N_ORZO = ${lin(N.orzo)};
const vec3 N_STOPPIE = ${lin(N.stoppie)}, N_ANDANA = ${lin(N.andana)}, N_TERRA = ${lin(N.terra)}, N_TERRA2 = ${lin(N.terra2)};
const vec3 N_MEDICA = ${lin(N.medica)}, N_GIRASOLE = ${lin(N.girasole)}, N_MARGINE = ${lin(N.margine)}, N_RIPARIA = ${lin(N.riparia)};
const vec3 N_SOTTOBOSCO = ${lin(N.sottobosco)}, N_ROCCIA = ${lin(N.roccia)}, N_SABBIA = ${lin(N.sabbia)};
const vec3 N_FV = ${lin(N.fv)}, N_FV_FILA = ${lin(N.fvFila)}, N_PAGLIA = ${lin(N.paglia)}, N_GHIAIA = ${lin(N.ghiaia)};
const vec2 VENTO_DIR = vec2( ${f(N.vento[0])}, ${f(N.vento[1])} );
#define NAT_BORDO ${f(N.bordo)}
#define NAT_MACRO ${f(N.macro)}
#define FV_X0 ${f(LAYOUT.fv.x0)}
#define FV_PASSO ${f(LAYOUT.fv.passoFile)}
float fiumeXg( float z ) { return -62.0 + 16.0 * sin( z * 0.017 ) + 6.0 * sin( z * 0.045 + 1.3 ); }
vec2 grigliaDi( vec2 xz ) { return vec2( CA * xz.x - SA * xz.y, SA * xz.x + CA * xz.y ) / CELLA + NCELLE * 0.5; }
// bit di stato e id della particella della cella c; fuori dal foglio una particella per cella (anello lontano)
vec2 statoCella( vec2 c ) {
  if ( c.x < 0.0 || c.y < 0.0 || c.x > NCELLE - 1.0 || c.y > NCELLE - 1.0 ) return vec2( 0.0, 300.0 + floor( hash12( c + 7.1 ) * 700.0 ) );
  vec4 s = textureLod( tStati, ( c + 0.5 ) / NCELLE, 0.0 );
  return vec2( floor( s.r * 255.0 + 0.5 ), floor( s.g * 255.0 + 0.5 ) );
}
// prima cella della particella nella sua riga: le particelle generiche sono gruppi di 1–3 celle lungo i
vec2 ancoraDi( vec2 c, float id ) {
  if ( statoCella( c - vec2( 1.0, 0.0 ) ).y != id ) return c;
  return statoCella( c - vec2( 2.0, 0.0 ) ).y != id ? c - vec2( 1.0, 0.0 ) : c - vec2( 2.0, 0.0 );
}
// coltura della particella (id, ancora a): hash + rumore regionale forte (le particelle vicine si somigliano)
// tipo: 0 prato, 1 grano, 2 orzo maturo, 3 stoppie, 4 arato, 5 erba medica, 6 girasole (righe), 7 impianto FV, 8 agrivoltaico
float tipoDi( vec2 st, vec2 a ) {
  if ( bitDi( st.x, 2.0 ) > 0.5 ) return 7.0;
  if ( bitDi( st.x, 4.0 ) > 0.5 ) return 8.0;
  float u = fract( 0.38 * hash12( vec2( st.y * 1.618 + 0.37, a.y * 0.731 + 3.0 ) ) + 1.5 * vnoise( a * 0.14 + 2.7 ) );
  return u < 0.27 ? 1.0 : u < 0.37 ? 2.0 : u < 0.48 ? 3.0 : u < 0.60 ? 4.0 : u < 0.71 ? 5.0 : u < 0.80 ? 6.0 : 0.0;
}
// campo = particelle contigue con la stessa coltura nella stessa zona (5 × 4 celle): righe e carreggiate continue
float zonaDi( vec2 a ) { return floor( a.x / 5.0 ) + floor( a.y / 4.0 ) * 37.0; }
struct Suolo { float tipo; float h; float hp; float bordo; float bit; float dirI; vec2 g; };
Suolo suoloDi( vec2 xz ) {
  Suolo s;
  vec2 w = vec2( vnoise( xz * 0.21 ), vnoise( xz * 0.21 + 17.3 ) ) - 0.5;      // bordi appena irregolari (±1 m)
  vec2 g = grigliaDi( xz + w * 0.2 );
  vec2 c = floor( g ), fG = g - c;
  vec2 s0 = statoCella( c ), a0 = ancoraDi( c, s0.y );
  float t0 = tipoDi( s0, a0 ), z0 = zonaDi( a0 );
  vec2 dn = vec2( fG.x < 0.5 ? -1.0 : 1.0, fG.y < 0.5 ? -1.0 : 1.0 );
  vec2 cX = c + vec2( dn.x, 0.0 ), cY = c + vec2( 0.0, dn.y );
  vec2 sX = statoCella( cX ), sY = statoCella( cY );
  // capezzagna solo fra campi diversi (coltura o zona diversa)
  float diffX = 0.0, diffY = 0.0;
  float kZ = step( t0, 6.5 );                                                  // gli impianti sono un campo solo
  if ( sX.y != s0.y ) { vec2 aX = ancoraDi( cX, sX.y ); diffX = step( 0.5, abs( tipoDi( sX, aX ) - t0 ) + abs( zonaDi( aX ) - z0 ) * kZ ); }
  if ( sY.y != s0.y ) { vec2 aY = ancoraDi( cY, sY.y ); diffY = step( 0.5, abs( tipoDi( sY, aY ) - t0 ) + abs( zonaDi( aY ) - z0 ) * kZ ); }
  vec2 dB = ( 0.5 - abs( fG - 0.5 ) ) * CELLA;                                 // distanza dai lati più vicini (u)
  s.bordo = min( min( diffX > 0.5 ? dB.x : 1.0, diffY > 0.5 ? dB.y : 1.0 ), 1.0 );
  s.bit = s0.x; s.tipo = t0;
  s.h = hash12( vec2( t0 * 3.1 + 0.5, z0 * 0.917 + 1.3 ) );                    // per campo: righe, carreggiate, tinta
  s.hp = hash12( vec2( s0.y * 1.618 + 0.37, a0.y * 0.731 + 3.0 ) );            // per particella: piccole differenze
  s.dirI = step( 0.28, fract( s.h * 7.31 ) );                                  // righe lungo i (72 %) o di traverso
  s.g = g;
  return s;
}
// variazione macro di tono (umidità, esposizione), uguale per terreno ed erba
float macroN( vec2 xz ) { return 1.0 + NAT_MACRO * ( ( vnoise( xz * 0.018 ) * 0.6 + vnoise( xz * 0.07 + 3.0 ) * 0.4 ) * 2.0 - 1.0 ); }
// prato: zone fresche e secche a più scale (secco 0..1)
vec3 tintaPrato( vec2 xz, float secco ) {
  float n1 = vnoise( xz * 0.035 + 3.0 ), n2 = vnoise( xz * 0.17 + 9.0 ), n3 = vnoise( xz * 0.9 + 1.0 );
  vec3 c = mix( N_PRATO, N_PRATO_FRESCO, smoothstep( 0.25, 0.75, n1 ) );
  return mix( c, N_PRATO_SECCO, clamp( secco + ( n2 - 0.5 ) * 0.6 + ( n3 - 0.5 ) * 0.2, 0.0, 1.0 ) );
}
// erba 3D in xz: x densità 0..1, y altezza (u), z secchezza 0..1, w paglia (0 verde, 1 grano/paglia)
vec4 erbaDi( Suolo s, vec2 xz, float pend, vec4 masc ) {
  float t = s.tipo;
  vec4 e = vec4( 1.0, 0.045, 0.25 + 0.3 * vnoise( xz * 0.05 ), 0.0 );          // prato
  if ( t > 0.5 && t < 1.5 ) e = vec4( 1.0, 0.075, 0.0, 1.0 );                   // grano
  else if ( t > 1.5 && t < 2.5 ) e = vec4( 1.0, 0.06, 0.0, 1.0 );               // orzo
  else if ( t > 2.5 && t < 3.5 ) e = vec4( 0.5, 0.012, 0.0, 1.0 );              // stoppie
  else if ( t > 3.5 && t < 4.5 ) e = vec4( 0.0 );                               // arato
  else if ( t > 4.5 && t < 5.5 ) e = vec4( 0.95, 0.04, 0.0, 0.0 );              // erba medica
  else if ( t > 5.5 ) e = vec4( 0.0 );                                          // girasole
  float fv = bitDi( s.bit, 2.0 ), ag = bitDi( s.bit, 4.0 );
  e = mix( e, vec4( 1.0, 0.02, 0.1, 0.0 ), fv );                                // prato falciato sotto i tracker
  e = mix( e, vec4( 0.3, 0.016, 0.35, 0.0 ), ag );                              // inerbimento fra le colture
  float kM = 1.0 - smoothstep( NAT_BORDO * 0.7, NAT_BORDO, s.bordo );
  e = mix( e, vec4( 1.0, 0.06, 0.2, 0.0 ), kM );                                // capezzagne: erba alta
  e = mix( e, vec4( 0.85, 0.032, 0.6, 0.0 ), smoothstep( 0.045, 0.12, pend ) * ( 1.0 - fv ) );   // pascolo sui pendii
  float dF = abs( xz.x - fiumeXg( xz.y ) );
  e.x *= smoothstep( 2.3, 2.8, dF ) * ( 1.0 - 0.7 * masc.b );
  e.y *= 1.0 + 0.4 * ( 1.0 - smoothstep( 3.5, 7.0, dF ) );                      // erba alta lungo il fiume
  e.x *= 1.0 - smoothstep( 0.3, 0.5, masc.g );                                  // strade
  e.x *= 1.0 - max( smoothstep( 0.75, 0.9, masc.a ), smoothstep( 0.3, 0.45, masc.a ) * ( 1.0 - smoothstep( 0.62, 0.75, masc.a ) ) * uCantiere );
  return e;
}
`;

/** Funzioni del solo frammento (motivi periodici con antialiasing analitico: fw = fwidth della coordinata). */
export const F_NATURA_FUNZ = /* glsl */`
// banda periodica larga w, periodo P: copertura con AA; quando il periodo scende sotto pochi pixel tende alla media w/P
float bandaP( float s, float P, float w, float fw ) {
  float d = abs( fract( s / P ) - 0.5 ) * P;
  float b = 1.0 - smoothstep( 0.5 * w - 0.5 * fw, 0.5 * w + 0.5 * fw, d );
  return mix( b, w / P, smoothstep( 0.2, 0.5, fw / P ) );
}
// onda coseno con AA (−1..1), si spegne sotto ~3 px di periodo
float ondaP( float s, float P, float fw ) { return cos( 6.2831853 * s / P ) * ( 1.0 - smoothstep( 0.15, 0.4, fw / P ) ); }
`;

/**
 * Splat naturale (frammento, al posto dello splat PBR). Usa xz, nM, pend, masc, vMapUv dell'intestazione di F_SPLAT.
 * Definisce albedo, arm, nT, ruv, wRoccia, asf, ghi (come lo splat PBR: il resto di terreno.js non cambia).
 */
export const F_NATURA = /* glsl */`
// ---- naturale: uso del suolo per particella, dettaglio fotografico senza ripetizione
float dentroN = 1.0 - step( MEZZO, max( abs( xz.x ), abs( xz.y ) ) );
vec4 mascN = masc * dentroN;
Suolo su = suoloDi( xz );
float fvN = bitDi( su.bit, 2.0 ), agN = bitDi( su.bit, 4.0 );
// dettaglio: erba-roccia (luminanza relativa alla media della texture, due scale) e terra del campo (assi del catasto)
vec2 uvE = vMapUv * RIP_E;
float kE = smoothstep( 0.35, 0.65, vnoise( uvE * 0.07 ) );
float mE = max( dot( textureLod( map, vec2( 0.5 ), 16.0 ).rgb, LUMA ), 1e-3 );
float dE = dot( ntCol( map, uvE, kE ).rgb, LUMA ) / mE;
dE = mix( dE, dot( texture2D( map, ROT_NT * uvE * 0.29 + 0.43 ).rgb, LUMA ) / mE, 0.35 );
vec3 nE = ntNor( normalMap, uvE, kE, mat2( 1.0 ) );
float aoE = ntCol( tErbaArm, uvE, kE ).r;
mat2 Mg = mat2( CA, -SA, SA, CA );
vec2 uvC = Mg * vMapUv * RIP_C;
float kC = smoothstep( 0.35, 0.65, vnoise( uvC * 0.07 + 3.1 ) );
float mC = max( dot( textureLod( tCampoDiff, vec2( 0.5 ), 16.0 ).rgb, LUMA ), 1e-3 );
float dC = dot( ntCol( tCampoDiff, uvC, kC ).rgb, LUMA ) / mC;
vec3 nC = ntNor( tCampoNor, uvC, kC, Mg );
float aoC = ntCol( tCampoArm, uvC, kC ).r;
// coordinate dei motivi: sR di traverso alle righe (u), gradR = ∇sR nello spazio tangente (x, −z)
vec2 gU = su.g * CELLA;
float sR = mix( gU.x, gU.y, su.dirI );
vec2 gradR = mix( vec2( CA, SA ), vec2( SA, -CA ), su.dirI );
float fwR = max( fwidth( sR ), 1e-5 );
float wPr = step( abs( su.tipo ), 0.5 ), wGr = step( abs( su.tipo - 1.0 ), 0.5 ), wOr = step( abs( su.tipo - 2.0 ), 0.5 );
float wSt = step( abs( su.tipo - 3.0 ), 0.5 ), wAr = step( abs( su.tipo - 4.0 ), 0.5 ), wMe = step( abs( su.tipo - 5.0 ), 0.5 );
float wGi = step( abs( su.tipo - 6.0 ), 0.5 );
float varF = fract( su.h * 13.7 + su.hp * 0.15 ), nF = vnoise( xz * 0.25 + su.h * 50.0 );
// grano e orzo: carreggiate del trattore ogni 24 m, onde del vento
float oT = su.h * 2.4;
float carr = bandaP( sR + 0.09 + oT, 2.4, 0.04, fwR ) + bandaP( sR - 0.09 + oT, 2.4, 0.04, fwR );
float ventoG = vnoise( ( xz - VENTO_DIR * uTempoV * 1.1 ) * 0.3 ) * 0.65 + vnoise( ( xz - VENTO_DIR * uTempoV * 1.7 ) * 0.9 + 5.0 ) * 0.35;
vec3 cGr = mix( N_GRANO, N_GRANO2, clamp( varF * 0.7 + ( nF - 0.5 ) * 0.6, 0.0, 1.0 ) ) * ( 1.0 + ( ventoG - 0.5 ) * 0.24 * uVentoT );
cGr = mix( cGr, N_CARREGGIATA, carr * 0.55 );
vec3 cOr = mix( N_ORZO, N_GRANO, varF * 0.35 ) * ( 1.0 + ( ventoG - 0.5 ) * 0.18 * uVentoT );
cOr = mix( cOr, N_CARREGGIATA, carr * 0.45 );
// stoppie: andane ogni 9 m e passate di falciatura
float andN = bandaP( sR + su.h * 0.9, 0.9, 0.16, fwR );
vec3 cSt = mix( N_STOPPIE, N_STOPPIE * vec3( 0.95, 0.97, 0.9 ), varF ) * ( 1.0 + 0.05 * ondaP( sR + su.h, 1.8, fwR ) );
cSt = mix( cSt, N_ANDANA, andN * 0.75 ) * mix( 1.0, dC, 0.25 );
// arato: solchi ogni 50 cm in rilievo (normali), zolle dalla texture, macchie di umidità
float kSo = 1.0 - smoothstep( 0.15, 0.4, fwR / 0.05 );
float faseS = 6.2831853 * sR / 0.05;
vec3 cAr = mix( N_TERRA, N_TERRA2, clamp( varF * 0.6 + ( vnoise( xz * 0.12 + 2.0 ) - 0.5 ) * 0.9, 0.0, 1.0 ) ) * dC;
cAr *= 1.0 + 0.10 * sin( faseS ) * kSo;
// erba medica a strisce di falciatura, girasoli a righe di 75 cm
vec3 cMe = mix( N_MEDICA, N_PRATO_FRESCO, varF * 0.4 ) * ( 1.0 + 0.07 * ondaP( sR + su.h * 3.0, 0.7, fwR ) ) * mix( 1.0, dE, 0.35 );
float riga = bandaP( sR + su.h * 0.075, 0.075, 0.045, fwR );
vec3 cGi = mix( N_TERRA2 * dC, N_GIRASOLE * mix( 1.0, dE, 0.3 ), riga );
// prati: più secchi sui rilievi
float seccoP = 0.2 + 0.45 * smoothstep( 0.03, 0.15, pend ) + 0.25 * ( vnoise( xz * 0.012 + 7.0 ) - 0.5 );
vec3 cPr = tintaPrato( xz, seccoP ) * mix( 1.0, dE, 0.3 );
// impianto FV: prato curato, fascia meno falciata sotto la fila dei pali; agrivoltaico: terra inerbita fra le colture
float fila = bandaP( xz.x - FV_X0 + 0.5 * FV_PASSO, FV_PASSO, 0.12, max( fwidth( xz.x ), 1e-5 ) );
vec3 cFv = mix( mix( tintaPrato( xz, 0.12 ), N_FV, 0.5 ), N_FV_FILA, fila * 0.55 ) * mix( 1.0, dE, 0.25 );
vec3 cAg = mix( N_TERRA2 * dC, tintaPrato( xz, 0.35 ) * mix( 1.0, dE, 0.4 ), 0.4 );
vec3 cCampo = cPr * wPr + cGr * wGr + cOr * wOr + cSt * wSt + cAr * wAr + cMe * wMe + cGi * wGi;
cCampo = mix( mix( cCampo, cFv, fvN ), cAg, agN );
float wTerra = ( wAr + wGi * ( 1.0 - riga ) + wSt * 0.3 ) * ( 1.0 - fvN ) * ( 1.0 - agN ) + agN * 0.6;
// capezzagne erbose fra particelle diverse; il bordo della coltura è appena più scuro
float wM = NAT_BORDO * ( 0.75 + 0.5 * vnoise( xz * 0.6 + 4.0 ) );
float fwB = max( fwidth( su.bordo ), 1e-5 );
float kM = 1.0 - smoothstep( wM - fwB, wM + fwB, su.bordo );
vec3 cMa = tintaPrato( xz, 0.1 ) * ${lin(N.margine, 1)} / N_PRATO * mix( 1.0, dE, 0.5 );
vec3 cN = mix( cCampo * ( 1.0 - 0.12 * ( 1.0 - smoothstep( wM, wM + 0.25, su.bordo ) ) ), cMa, kM );
// pendii a pascolo e roccia, fiume (fascia riparia e greto), sottobosco
float wPasc = smoothstep( 0.045, 0.12, pend + ( vnoise( xz * 0.3 ) - 0.5 ) * 0.04 ) * ( 1.0 - fvN );
cN = mix( cN, tintaPrato( xz, 0.65 ) * mix( 1.0, dE, 0.55 ), wPasc );
float wRoccia = smoothstep( ${f(R[0])}, ${f(R[1])}, pend );
cN = mix( cN, N_ROCCIA * mix( 1.0, dE, 0.6 ), wRoccia * 0.75 );
float dFi = abs( xz.x - fiumeXg( xz.y ) );
cN = mix( cN, N_RIPARIA * mix( 1.0, dE, 0.5 ), ( 1.0 - smoothstep( 3.5, 7.5, dFi + ( vnoise( xz * 0.35 ) - 0.5 ) * 2.5 ) ) * 0.85 );
float greto = 1.0 - smoothstep( 2.2, 2.9, dFi );
cN = mix( cN, N_SABBIA * mix( 1.0, dC, 0.5 ), greto );
cN = mix( cN, N_SOTTOBOSCO * mix( 1.0, dE, 0.5 ), mascN.b * 0.9 );
// strade (asfalto 1,0 · ghiaia 0,6), piazzali (A = 1) e cantiere (A = 0,5, con uCantiere)
float asf = smoothstep( 0.78, 0.92, mascN.g );
float ghi = max( smoothstep( 0.35, 0.55, mascN.g ) * ( 1.0 - asf ), smoothstep( 0.75, 0.9, mascN.a ) );
ghi = max( ghi, smoothstep( 0.3, 0.45, mascN.a ) * ( 1.0 - smoothstep( 0.62, 0.75, mascN.a ) ) * uCantiere );
cN = mix( cN, N_GHIAIA * mix( 1.0, dC, 0.45 ), ghi );
cN = mix( cN, ASFALTO * ( 0.9 + 0.2 * vnoise( xz * 6.0 ) ), asf );
vec3 albedo = cN * macroN( xz ) * ${f(N.albedo)};
// normali: erba ↔ terra, solchi dell'arato, strade lisce
float wT = clamp( wTerra * ( 1.0 - kM ) + greto * 0.5, 0.0, 1.0 );
vec3 nT = mix( nE, nC, wT );
nT.xy += gradR * ( -0.75 * cos( faseS ) * kSo ) * wAr * ( 1.0 - kM ) * ( 1.0 - fvN ) * ( 1.0 - agN );
nT.xy *= ${f(N.normale)};
nT = normalize( mix( normalize( nT ), vec3( 0.0, 0.0, 1.0 ), max( asf, ghi * 0.6 ) ) );
float aoN = mix( aoE, aoC, wT );
vec4 arm = vec4( aoN, 1.0, 0.0, 1.0 );
float ruv = mix( mix( 0.95, 1.0, wT ), ${f(MATERIALI.asfalto.roughness)}, asf );
albedo *= mix( 1.0, aoN, 0.5 );
// sotto i fili d'erba 3D il suolo è in ombra: fra i fili si vede la base scura (uErbaR = 0 senza erba)
float kErba = erbaDi( su, xz, pend, mascN ).x * ( 1.0 - smoothstep( uErbaR * 0.55, uErbaR * 0.95, distance( cameraPosition, vPosMondo ) ) );
albedo *= 1.0 - ${f(N.sottoErba)} * kErba * smoothstep( 0.55, 0.95, uRealta );
`;
