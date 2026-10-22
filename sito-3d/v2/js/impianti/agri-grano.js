// =============================================================================
// ERI v2 · impianti/agri-grano.js — coltura "grano maturo" dell'agrivoltaico (anteprima ?coltura=grano)
// Proprietario: [FV]. File privato di impianti/agri.js (regola 0.1).
//
// Tre strati, tutti fra le linee dei pali (esclusione 0,05 u) e solo nel campo agrivoltaico:
//  - suolo: terra battuta chiara nei viottoli dei pali e nella capezzagna, paglia, erbacce rade, ombra al piede del grano;
//  - massa: il volume del grano (una "lastra" per fascia, con le pareti sui viottoli) alto fino alla base delle spighe:
//    da lontano è il campo intero (macchie di maturazione, file di semina, onde di vento che schiariscono le spighe
//    piegate, traslucenza in controluce), da vicino resta il fondo scuro fra gli steli;
//  - spighe: steli istanziati (nastro rivolto alla camera con ombreggiatura cilindrica) con la spiga a spighette e le
//    reste disegnate nel frammento (copertura → alphaToCoverage), fitti dove passa la camera del vicolo e via via più
//    radi; vento a onde lunghe sottovento più il fremito della singola spiga.
// =============================================================================
import * as THREE from 'three';
import { altezza, mulberry32 } from '../geo.js';
import { f5, vec3Lin, fasce, inColtura, distanzaPercorso, sparpaglia, creaSuolo, materialePianta, creaIstanze, bordo } from './agri-campo.js';

// TARATURA: proporre in config (LAYOUT.colture.grano) — misure in u (1 u = 10 m)
const G = {
  margine: 0.3,                       // capezzagna: il grano resta a 0,3 u dal confine
  altezza: [0.078, 0.094],            // cima della spiga (78–94 cm)
  spiga: 0.0085, reste: 0.0065,       // corpo della spiga e reste oltre la punta
  larghezzaSpiga: 0.0013, larghezzaStelo: 0.00045, larghezzaResta: 0.00007,
  massa: 0.0755,                      // cima della massa: poco sotto la base media delle spighe
  densita: 15000,                     // steli per u² vicino al percorso della camera (ultra)
  d0: 0.75, esponente: 2.0, dMax: 4.5, // densità piena entro d0, poi ∝ (d0/d)^esponente; nessuna istanza oltre dMax
  cella: 0.05, accestimento: 2.2,     // steli per cespo (in media)
  inclinazione: 0.07,
  colori: {
    maturo: '#d3a64e', chiaro: '#e2c27a', verde: '#b8ad62', bruno: '#a97c3a', reste: '#f0dca6',
    stelo: '#cdaa62', steloOmbra: '#5e4a2a', fondo: '#6f5a34',
    suolo: '#86735a', suoloChiaro: '#a48f6c', erbacce: '#76804a', paglia: '#cdb880',
  },
};
const C = G.colori;

const glslColori = `
#define SPIGA_L ${f5(G.spiga)}
#define RESTE_L ${f5(G.reste)}
#define SPIGA_W ${f5(G.larghezzaSpiga)}
#define STELO_W ${f5(G.larghezzaStelo)}
#define RESTA_W ${f5(G.larghezzaResta)}
#define MASSA_H ${f5(G.massa)}
#define MARGINE_G ${f5(G.margine)}
const vec3 MATURO = ${vec3Lin(C.maturo)};
const vec3 CHIARO = ${vec3Lin(C.chiaro)};
const vec3 VERDE = ${vec3Lin(C.verde)};
const vec3 BRUNO = ${vec3Lin(C.bruno)};
const vec3 RESTE = ${vec3Lin(C.reste)};
const vec3 STELO = ${vec3Lin(C.stelo)};
const vec3 STELO_OMBRA = ${vec3Lin(C.steloOmbra)};
const vec3 FONDO = ${vec3Lin(C.fondo)};
`;

// ---------------------------------------------------------------- suolo
const SUOLO = `
const vec3 SUOLO_G = ${vec3Lin(C.suolo)};
const vec3 SUOLO_CH = ${vec3Lin(C.suoloChiaro)};
const vec3 ERBACCE_G = ${vec3Lin(C.erbacce)};
const vec3 PAGLIA_G = ${vec3Lin(C.paglia)};
void suoloC( vec2 p, float dP, float dB, float on, inout vec3 alb, inout float ruv, inout vec3 nW, inout float ao ) {
  float n1 = vnoiseC( p * 2.7 ), n2 = vnoiseC( p * 31.0 ), n3 = vnoiseC( p * 170.0 );
  float fw = max( fwidth( p.x ), fwidth( p.y ) );
  float kf = 1.0 - smoothstep( 0.002, 0.008, fw );
  vec3 c = mix( SUOLO_G, SUOLO_CH, 0.55 * n1 + 0.45 * n2 );
  // pagliuzze chiare (trattini orientati a caso per cella)
  vec2 q = p * 260.0; vec2 ci = floor( q ); vec2 h = hash2C( ci );
  vec2 f = fract( q ) - 0.5; float an = h.x * 6.2832; vec2 dir = vec2( cos( an ), sin( an ) );
  float tr = ( 1.0 - smoothstep( 0.04, 0.09, abs( dot( f, vec2( -dir.y, dir.x ) ) ) ) ) * ( 1.0 - smoothstep( 0.3, 0.45, abs( dot( f, dir ) ) ) ) * step( 0.55, h.y );
  c = mix( c, PAGLIA_G, 0.55 * tr * kf );
  // inerbimento secco sotto i pali e nella capezzagna, a ciuffi; terra battuta al centro del viottolo e sulle ruotate
  float erba = smoothstep( 0.38, 0.72, vnoiseC( p * 45.0 ) * 0.55 + vnoiseC( p * 6.0 ) * 0.45 );
  float battuta = smoothstep( 0.012, 0.0, abs( dP - 0.028 ) ) * 0.6;
  vec3 ce = mix( ERBACCE_G, PAGLIA_G * 0.85, vnoiseC( p * 13.0 ) * 0.6 );
  c = mix( c, ce, erba * ( 1.0 - battuta ) * mix( 0.75, 0.9, 1.0 - smoothstep( 0.0, MARGINE_G, dB ) ) );
  // ombra di contatto al piede delle pareti di grano (viottoli fra i pali e testate delle fasce)
  float aoP = mix( 0.5, 1.0, smoothstep( 0.0, 0.035, ESCLC - dP ) );
  float aoT = mix( 0.55, 1.0, smoothstep( 0.0, 0.035, MARGINE_G - dB ) );
  ao = dB > MARGINE_G ? ( dP < ESCLC ? aoP : 1.0 ) : ( dP > ESCLC ? aoT : 1.0 );
  alb = c * ( 0.86 + 0.22 * mix( 0.5, n3, kf ) );
  ruv = 0.96;
  nW = normalize( vec3( ( n2 - 0.5 ) * 0.25 + ( n3 - 0.5 ) * 0.3 * kf, 1.0, ( n1 - 0.5 ) * 0.2 + ( hashC( ci ) - 0.5 ) * 0.2 * kf ) );
}
`;

// ---------------------------------------------------------------- massa (volume del grano per fascia)
function geometriaMassa(campo) {
  const pos = [], nor = [], su = [], ind = [];
  const vtx = (x, z, s, nx, ny, nz) => { pos.push(x, altezza(x, z), z); nor.push(nx, ny, nz); su.push(s); return pos.length / 3 - 1; };
  for (const f of fasce(campo, G.margine)) {
    const nx = Math.max(2, Math.ceil((f.xb - f.xa) / 0.15)), lz = Math.max(f.za[1] - f.za[0], f.zb[1] - f.zb[0]);
    const nz = Math.max(2, Math.ceil(lz / 0.2));
    const P = (i, j) => {
      const t = i / nx, x = f.xa + (f.xb - f.xa) * t;
      const z0 = f.za[0] + (f.zb[0] - f.za[0]) * t, z1 = f.za[1] + (f.zb[1] - f.za[1]) * t;
      return [x, z0 + (z1 - z0) * j / nz];
    };
    // cima
    const b = pos.length / 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const [x, z] = P(i, j); vtx(x, z, 1, 0, 1, 0); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = b + j * (nx + 1) + i, c = a + nx + 1;
      ind.push(a, c, a + 1, a + 1, c, c + 1);
    }
    // pareti: lungo i viottoli (x = xa, xb) e alle testate (j = 0, nz)
    // pareti verticali con la normale verso l'esterno della fascia
    const [cx, cz] = P(nx / 2, nz / 2);
    const parete = punti => {
      const a0 = punti[0], a1 = punti[punti.length - 1], dx = a1[0] - a0[0], dz = a1[1] - a0[1], l = Math.hypot(dx, dz) || 1;
      let nxw = dz / l, nzw = -dx / l;
      if (nxw * ((a0[0] + a1[0]) / 2 - cx) + nzw * ((a0[1] + a1[1]) / 2 - cz) < 0) { nxw = -nxw; nzw = -nzw; }
      for (let k = 0; k < punti.length - 1; k++) {
        const [xa, za] = punti[k], [xb, zb] = punti[k + 1];
        const v0 = vtx(xa, za, 0, nxw, 0, nzw), v1 = vtx(xb, zb, 0, nxw, 0, nzw), v2 = vtx(xa, za, 1, nxw, 0, nzw), v3 = vtx(xb, zb, 1, nxw, 0, nzw);
        ind.push(v0, v1, v2, v1, v3, v2);
      }
    };
    const ovest = [], est = [], sud = [], nord = [];
    for (let j = 0; j <= nz; j++) { ovest.push(P(0, j)); est.push(P(nx, j)); }
    for (let i = 0; i <= nx; i++) { sud.push(P(i, 0)); nord.push(P(i, nz)); }
    parete(ovest); parete(est); parete(sud); parete(nord);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aSu', new THREE.Float32BufferAttribute(su, 1));
  g.setIndex(ind); g.computeBoundingSphere(); g.boundingSphere.radius += 0.2;
  return g;
}

const MASSA_V = { dich: `attribute float aSu;\nvarying vec3 vPM; varying float vSuM, vOnM, vTopM;\n${glslColori}`, corpo: `
	vec3 B = position;
	float kC = chiaveC( B.xz ); float sC = smoothstep( kC, kC + 0.1, uCrescita );
	float on = ondaC( B.xz );
	float h = MASSA_H * ( 0.93 + 0.12 * vnoiseC( B.xz * 2.7 ) ) * ( 1.0 - 0.07 * on * uVento );
	posC = B + vec3( DIR_VC.x * 0.006 * on * uVento * aSu, aSu * h * max( sC, 1e-3 ), DIR_VC.y * 0.006 * on * uVento * aSu );
	norC = normal;
	vPM = posC; vSuM = aSu; vOnM = on; vTopM = step( 0.5, normal.y );` };

const MASSA_F = { dich: `varying vec3 vPM; varying float vSuM, vOnM, vTopM;\n${glslColori}
float altezzaSpighe( vec2 p ) { return vnoiseC( p * 38.0 ) * 0.6 + vnoiseC( p * 110.0 + 3.0 ) * 0.4; }`, corpo: `
	vec2 p = vPM.xz;
	float on = vOnM;
	float fw = max( fwidth( p.x ), fwidth( p.y ) );
	// macchie di maturazione su più scale
	float m1 = vnoiseC( p * 0.45 + 2.0 ), m2 = vnoiseC( p * 2.1 - 1.0 ), m3 = vnoiseC( p * 9.0 );
	vec3 c = mix( MATURO, CHIARO, 0.75 * m1 );
	c = mix( c, VERDE, 0.4 * smoothstep( 0.6, 0.9, m2 ) );
	c = mix( c, BRUNO, 0.35 * smoothstep( 0.55, 0.85, vnoiseC( p * 1.3 + 9.0 ) ) );
	c *= 0.93 + 0.14 * m3;
	if ( vTopM > 0.5 ) {
	  // file di semina (15 cm) e chiaroscuro delle spighe: svaniscono da lontano (niente moiré)
	  float kf = 1.0 - smoothstep( 0.001, 0.0035, fw );
	  float kr = 1.0 - smoothstep( 0.004, 0.012, fw );
	  float fila = 0.5 + 0.5 * cos( p.x * 6.2832 / 0.015 );
	  float hs = altezzaSpighe( p );
	  c *= mix( 1.0, 0.93 + 0.08 * fila, kr );
	  // da vicino la massa è il fondo fra le spighe vere: più scura, a chiazze morbide
	  c *= mix( 1.0, mix( 0.55, 0.9, smoothstep( 0.2, 0.8, hs ) ), kf );
	  // onde di vento: le spighe piegate mostrano il fianco chiaro (fasce che corrono sul campo)
	  c *= 1.0 + 0.38 * ( on - 0.35 ) * uVento;
	  c = mix( c, c * vec3( 1.05, 1.0, 0.86 ), on * 0.35 );
	  // rilievo dei cespi
	  float e = 0.004;
	  float hx = altezzaSpighe( p + vec2( e, 0.0 ) ) - hs, hz = altezzaSpighe( p + vec2( 0.0, e ) ) - hs;
	  float kb = 0.35 + 0.65 * kf;
	  nWC = normalize( vec3( - hx * 1.6 * kb, 1.0, - hz * 1.6 * kb ) + vec3( DIR_VC.x, 0.0, DIR_VC.y ) * 0.25 * on );
	  traslC = 0.75;
	} else {
	  // pareti sui viottoli: steli fitti, piede in ombra, spighe in cima
	  float kf = 1.0 - smoothstep( 0.0008, 0.004, fw );
	  float lungo = dot( p, vec2( 0.6, 0.8 ) ) + p.x * 0.3;
	  float st = vnoiseC( vec2( lungo * 1400.0, vSuM * 2.0 ) );
	  vec3 cs = mix( STELO_OMBRA, STELO, smoothstep( 0.0, 0.85, vSuM ) );
	  c = mix( cs, c, smoothstep( 0.8, 0.98, vSuM ) );
	  c *= mix( 1.0, 0.7 + 0.5 * st, kf );
	  c *= mix( 0.45, 1.0, smoothstep( 0.0, 0.6, vSuM ) );
	  traslC = 0.45;
	}
	diffuseColor.rgb = c;
	ruvC = 0.85;
	traslCol = vec3( 1.0, 0.8, 0.45 );` };

// ---------------------------------------------------------------- spighe istanziate
/** Stelo (3 tratti) + spiga con le reste (4 tratti): position = (lato −1..1, lungo 0..1, parte 0 stelo / 1 spiga). */
function templateSpiga() {
  const pos = [], ind = [];
  const nastro = (parte, n) => {
    const b = pos.length / 3;
    for (let i = 0; i <= n; i++) { const v = i / n; pos.push(-1, v, parte, 1, v, parte); }
    for (let i = 0; i < n; i++) { const a = b + i * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  nastro(0, 2); nastro(1, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  return g;
}

const SPIGA_V = { dich: `attribute vec4 aA; attribute vec4 aB;
varying vec2 vUvC; varying float vParteC, vWrC, vAltC, vOndaC, vSemeC, vTintaC;
${glslColori}`, corpo: `
	vec3 B = aA.xyz; float H = aA.w;
	float s = position.x, v = position.y, parte = position.z;
	float kC = chiaveC( B.xz ); float sC = max( smoothstep( kC, kC + 0.1, uCrescita ), 1e-3 );
	float on = ondaC( B.xz ), sm = aB.z;
	// piega: inclinazione propria + vento a onde lunghe (sottovento) + fremito della singola spiga
	vec2 perp = vec2( - DIR_VC.y, DIR_VC.x );
	vec2 inc = aB.xy + uVento * ( DIR_VC * ( 0.03 + 0.22 * on ) + perp * 0.03 * sin( uTempoV * ( 2.0 + sm ) + sm * 40.0 ) * ( 0.3 + on ) );
	float ky = sqrt( max( 1.0 - dot( inc, inc ), 0.3 ) );
	float hS = ( H - SPIGA_L ) * sC;
	vec3 Ps, Ax;
	if ( parte < 0.5 ) {
	  Ps = B + vec3( inc.x * hS * v * v, hS * ky * v, inc.y * hS * v * v );
	  Ax = normalize( vec3( 2.0 * inc.x * v, ky, 2.0 * inc.y * v ) );
	} else {
	  vec3 cima = B + vec3( inc.x * hS, hS * ky, inc.y * hS );
	  vec3 tg = normalize( vec3( 2.0 * inc.x, ky, 2.0 * inc.y ) );
	  vec2 dn = inc / max( length( inc ), 1e-4 );
	  float chino = fract( sm * 7.13 ) * 0.5;               // alcune spighe si chinano un poco
	  Ax = normalize( tg + vec3( dn.x, -0.45, dn.y ) * chino );
	  Ps = cima + Ax * v * ( SPIGA_L + RESTE_L ) * sC;
	}
	// nastro rivolto alla camera, mai più sottile di ~1 px (la copertura vera la dà il frammento)
	vec3 Vw = cameraPosition - Ps; float dist = length( Vw ); Vw /= max( dist, 1e-5 );
	vec3 sd = cross( Ax, Vw ); float ls = length( sd );
	sd = ls > 1e-3 ? sd / ls : vec3( 1.0, 0.0, 0.0 );
	float w = parte < 0.5 ? STELO_W * ( 1.0 - 0.3 * v ) : SPIGA_W * ( 1.0 + 1.3 * smoothstep( 0.4, 1.0, v ) );
	float wR = max( w, dist * uPxAng * 1.3 );
	Ps += sd * ( s * 0.5 * wR );
	vec3 fr = normalize( Vw - Ax * dot( Vw, Ax ) + vec3( 0.0, 1e-4, 0.0 ) );
	norC = normalize( fr * sqrt( max( 1.0 - 0.5 * s * s, 0.0 ) ) + sd * ( 0.7 * s ) + vec3( 0.0, 0.3 * parte, 0.0 ) );
	posC = Ps;
	vUvC = vec2( s, v ); vParteC = parte; vWrC = wR; vAltC = clamp( ( Ps.y - B.y ) / H, 0.0, 1.2 );
	vOndaC = on; vSemeC = sm; vTintaC = aB.w;` };

const SPIGA_F = { dich: `varying vec2 vUvC; varying float vParteC, vWrC, vAltC, vOndaC, vSemeC, vTintaC;\n${glslColori}`, corpo: `
	// coordinate "vere" (u) sul nastro: da lontano il nastro è allargato a ~1 px e la forma si allarga con lui
	float v = vUvC.y;
	float wv = vParteC < 0.5 ? STELO_W * ( 1.0 - 0.3 * v ) : SPIGA_W * ( 1.0 + 1.3 * smoothstep( 0.4, 1.0, v ) );
	float xm = vUvC.x * 0.5 * wv;
	float ym = v * ( SPIGA_L + RESTE_L );
	float fx = max( fwidth( xm ), 1e-7 ), fy = max( fwidth( ym ), 1e-7 );
	float pxm = max( fx, fy * 0.5 );
	float tinta = vTintaC;
	vec3 baseSpiga = mix( MATURO, CHIARO, smoothstep( 0.4, 0.9, vSemeC ) * 0.6 );
	baseSpiga = mix( baseSpiga, VERDE, smoothstep( 0.72, 1.0, tinta ) * 0.8 );
	baseSpiga = mix( baseSpiga, BRUNO, smoothstep( 0.3, 0.0, tinta ) * 0.7 );
	vec3 c;
	if ( vParteC < 0.5 ) {
	  copC = clamp( ( 0.5 * wv - abs( xm ) ) / fx + 0.5, 0.0, 1.0 );
	  c = mix( STELO_OMBRA, STELO, smoothstep( 0.2, 0.92, vAltC ) );
	  traslC = 0.3;
	} else {
	  float ve = ym / SPIGA_L, lato = step( 0.0, xm );
	  float prof = pow( max( sin( 3.1416 * clamp( ve * 0.97 + 0.02, 0.0, 1.0 ) ), 0.0 ), 0.45 ) * ( 0.78 + 0.22 * abs( sin( ve * 28.27 + lato * 1.5708 ) ) );
	  float hb = 0.5 * SPIGA_W * prof;
	  float cb = clamp( ( hb - abs( xm ) ) / fx + 0.5, 0.0, 1.0 ) * ( 1.0 - smoothstep( 1.0, 1.0 + fy / SPIGA_L, ve ) );
	  // reste: setole dalle spighette verso l'alto, un po' aperte a pennello
	  float ca = 0.0, wpx = max( RESTA_W / pxm, 0.75 );       // reste mai più sottili di ~1 px (linee chiare, non grana)
	  for ( int i = 0; i < 8; i++ ) {
	    float fi = float( i ), sg = mod( fi, 2.0 ) * 2.0 - 1.0;
	    vec2 a = vec2( sg * 0.3 * SPIGA_W, SPIGA_L * ( 0.28 + 0.09 * fi ) );
	    vec2 b = vec2( sg * SPIGA_W * ( 0.5 + 0.12 * fi ), SPIGA_L + RESTE_L * ( 0.65 + 0.35 * fract( vSemeC * 13.7 + fi * 0.37 ) ) );
	    vec2 pa = vec2( xm, ym ) - a, ba = b - a;
	    float t = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
	    float dd = length( pa - ba * t ) / pxm;
	    ca = max( ca, clamp( 0.5 * max( wpx, 1.0 ) + 0.5 - dd, 0.0, 1.0 ) * min( wpx, 1.0 ) * ( 1.0 - 0.35 * t ) );
	  }
	  copC = max( cb, ca );
	  copC = smoothstep( 0.3, 0.7, copC );                     // bordi netti: niente retino dell'alphaToCoverage
	  float chicchi = 0.82 + 0.18 * sin( ve * 56.5 + lato * 3.1 );
	  vec3 cs = baseSpiga * chicchi * mix( 0.78, 1.06, smoothstep( 0.0, 0.85, ve ) );
	  c = mix( RESTE, cs, clamp( cb / max( max( cb, ca ), 1e-3 ), 0.0, 1.0 ) );
	  c *= 1.0 + 0.18 * ( vOndaC - 0.35 ) * uVento;          // lucentezza delle onde di vento
	  traslC = mix( 1.0, 0.6, cb );
	}
	diffuseColor.rgb = c * ( 0.9 + 0.2 * fract( vSemeC * 31.7 ) );
	ruvC = 0.6;
	traslCol = vec3( 1.0, 0.8, 0.45 );` };

// ---------------------------------------------------------------- crea
/**
 * @param {object} ctx
 * @param {{campo, U, glsl, kQ, P}} K kit comune (agri.js): campo, uniform, GLSL del campo, densità del livello, percorso
 * @returns {{gruppo: THREE.Group, n: number}}
 */
export function creaGrano(ctx, K) {
  const { campo, U, glsl, kQ, P } = K;
  const gruppo = new THREE.Group(); gruppo.name = 'agri.colture.grano';

  // suolo
  gruppo.add(creaSuolo(ctx, campo, U, { glsl, funzioni: glslColori + SUOLO, chiave: 'agri-grano-suolo-v1' }));

  // massa
  const mM = materialePianta(ctx, U, { glsl, dichV: MASSA_V.dich, corpoV: MASSA_V.corpo, dichF: MASSA_F.dich, corpoF: MASSA_F.corpo,
                                       chiave: 'agri-grano-massa-v1', a2c: false, env: 0.5, normaleFissa: true });
  const massa = new THREE.Mesh(geometriaMassa(campo), mM.mat);
  massa.name = 'agri.grano.massa'; massa.castShadow = true; massa.receiveShadow = true;
  massa.customDepthMaterial = mM.prof; massa.userData.materialeNormali = mM.norm;
  gruppo.add(massa);

  // spighe: cespi a densità che cala con la distanza dal percorso della camera
  const yS = campo.quota + 0.085, ro0 = G.densita * kQ / G.accestimento;
  const punti = sparpaglia(campo, {
    cella: G.cella, seme: 7321,
    densita: (x, z) => {
      const d = distanzaPercorso(P, x, yS, z);
      if (d > G.dMax) return 0;
      return ro0 * Math.min(1, Math.pow(G.d0 / Math.max(d, 1e-3), G.esponente)) * (1 - Math.max(0, (d - G.dMax * 0.8) / (G.dMax * 0.2)));
    },
    maschera: (x, z) => inColtura(campo, x, z, G.margine),
  });
  const rnd = mulberry32(9042), aA = [], aB = [];
  for (let i = 0; i < punti.length; i += 3) {
    const cx = punti[i], cz = punti[i + 1];
    const steli = 1 + Math.floor(rnd() * (2 * G.accestimento - 1) + 0.5);
    const tinta = rnd(), y = altezza(cx, cz);
    for (let k = 0; k < steli; k++) {
      const x = cx + (rnd() - 0.5) * 0.004, z = cz + (rnd() - 0.5) * 0.004;
      if (!inColtura(campo, x, z, G.margine)) continue;
      const a = rnd() * Math.PI * 2, r = G.inclinazione * Math.sqrt(rnd());
      aA.push(x, y, z, G.altezza[0] + (G.altezza[1] - G.altezza[0]) * rnd());
      aB.push(Math.cos(a) * r, Math.sin(a) * r, rnd(), Math.min(1, Math.max(0, tinta + (rnd() - 0.5) * 0.25)));
    }
  }
  const n = aA.length / 4;
  const mS = materialePianta(ctx, U, { glsl, dichV: SPIGA_V.dich, corpoV: SPIGA_V.corpo, dichF: SPIGA_F.dich, corpoF: SPIGA_F.corpo,
                                       chiave: 'agri-grano-spighe-v1', a2c: true, env: 0.5, normaleFissa: true, soglia: 0.01 });
  const istanze = creaIstanze(gruppo, { template: templateSpiga(), attr: { aA: [4, new Float32Array(aA)], aB: [4, new Float32Array(aB)] }, n,
                                        materiali: mS, nome: 'agri.grano.spighe', alto: 0.12, dVista: G.dMax + 3 });
  return { gruppo, n, istanze };
}
