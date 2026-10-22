// =============================================================================
// ERI v2 · mondo/terreno-erba.js — fili d'erba 3D attorno alla camera (file privato di mondo/terreno.js, regola 0.1)
// Proprietario: [PIANURA]. Solo con ?stile=naturale e ?stile=primipiani, dal livello media in su (il base resta leggero).
//
// Densità costante sullo schermo: K/d² fili per u² (d = distanza dalla camera), a bande che raddoppiano la distanza.
//  - banda k: d in [rc·2^k, rc·2^(k+1)) (la banda 0 parte da 0), piastrelle di lato s0·2^k, sempre B fili per piastrella
//    (posizioni R2 a bassa discrepanza: ogni prefisso è distribuito bene). Nella banda il filo n è attivo se
//    n/B < (rc·2^k/d)²: la densità scende con continuità e al confine combacia con quella della banda successiva;
//    i fili che stanno per spegnersi si abbassano (niente comparse a scatto), il confine è sfrangiato per filo.
//  - piastrelle allineate alla griglia del mondo (i fili non scivolano quando la camera si muove); a ogni fotogramma
//    sulla CPU si tengono solo quelle nella corona della banda e nel frustum (array preallocati, niente allocazioni).
//  - filo: Bezier quadratica con 3/2/1 segmenti secondo la banda, piegato a caso e dal vento (U.uTempo; fermo con
//    riduci movimento), più largo da lontano (almeno ~0,8 px), base più scura, punta più chiara, controluce traslucido.
//  - quota esatta del terreno nel vertice (texture delle quote della mesh, stessa interpolazione dei triangoli) per il
//    sollevamento lift(); tipo, densità, altezza e tinta da suoloDi/erbaDi (terreno-natura.js): stesso colore del suolo.
//  - nessuna ombra proiettata (riceve quelle dei tracker), userData.noAO (il GTAO non vede i fili).
//  - carta (uRealta → 0) e fronte della realtà: i fili si abbassano fino a sparire.
// =============================================================================
import * as THREE from 'three';
import { PIANURA } from '../config.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import { BASE_GLSL, SUOLO_GLSL, NATURA } from './terreno-natura.js';

// TARATURA: proporre in config (QUALITA.livelli[x].erba) — K = fili·u⁻² a 1 u dalla camera, B fili per piastrella,
// rc = raggio della banda 0 (u), rMax = fine dell'erba (u), seg = segmenti del filo per banda
const LIVELLI = {
  ultra: { K: 9.0e4, B: 2048, rc: 0.6, rMax: 38, seg: [3, 3, 2, 2, 1, 1, 1] },
  alta:  { K: 3.2e4, B: 1536, rc: 0.6, rMax: 26, seg: [3, 2, 2, 1, 1, 1] },
  media: { K: 1.6e4, B: 1024, rc: 0.6, rMax: 14, seg: [2, 2, 1, 1, 1] },
};
// TARATURA: proporre in config — forma, luce e vento dei fili
const FILO = { larghezza: 0.0012, minPx: 0.9, sfrangia: 0.14, base: 0.5, baseLontano: 0.8, punta: 0.2, normaleSu: 0.7,
               traslucenza: 1.0, vento: 0.55 };
const LAT = PIANURA.lato, MEZ = LAT / 2;
const f = v => (+v).toFixed(5);

/** Geometria di una piastrella: B fili, nSeg segmenti; position = (u, t, v), aFilo = (lato −1/0/+1, rango n/B). */
function geometriaPiastrella(B, nSeg) {
  const V = 2 * nSeg + 1, pos = new Float32Array(B * V * 3), filo = new Float32Array(B * V * 2), ind = [];
  const g = 1.32471795724474602596, a1 = 1 / g, a2 = 1 / (g * g);
  for (let n = 0; n < B; n++) {
    const u = (0.5 + a1 * n) % 1, v = (0.5 + a2 * n) % 1, r = (n + 0.5) / B, b = n * V;
    for (let i = 0; i < nSeg; i++) for (const lato of [-1, 1]) {
      const k = b + i * 2 + (lato > 0 ? 1 : 0);
      pos.set([u, i / nSeg, v], k * 3); filo.set([lato, r], k * 2);
    }
    pos.set([u, 1, v], (b + V - 1) * 3); filo.set([0, r], (b + V - 1) * 2);
    for (let i = 0; i < nSeg - 1; i++) { const a = b + i * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const a = b + (nSeg - 1) * 2; ind.push(a, a + 1, b + V - 1);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFilo', new THREE.BufferAttribute(filo, 2));
  geo.setIndex(B * V > 65535 ? new THREE.Uint32BufferAttribute(ind, 1) : new THREE.Uint16BufferAttribute(ind, 1));
  return geo;
}

// ---------------------------------------------------------------- GLSL
function vertice(S, sollevamento) {
  return /* glsl */`
${BASE_GLSL}
${sollevamento}
${SUOLO_GLSL}
attribute vec2 aFilo; attribute vec2 aTile;
uniform sampler2D tAlt;
uniform float uLatoP, uRa, uRin, uRout, uRmax, uPxAng, uTempoV, uVento, uRealta, uFronteRealta;
varying vec3 vTinta; varying float vT, vScuro;
#define NS ${f(S)}
// quota e pendenza dalla texture delle quote della mesh (stessi triangoli della PlaneGeometry)
vec2 quotaPend( vec2 xz ) {
  vec2 q = clamp( ( xz + MEZZO ) / LATO * NS, vec2( 0.0 ), vec2( NS - 0.001 ) );
  vec2 i = floor( q ), fq = q - i; ivec2 ii = ivec2( i );
  float ha = texelFetch( tAlt, ii, 0 ).r, hb = texelFetch( tAlt, ii + ivec2( 0, 1 ), 0 ).r;
  float hc = texelFetch( tAlt, ii + ivec2( 1, 1 ), 0 ).r, hd = texelFetch( tAlt, ii + ivec2( 1, 0 ), 0 ).r;
  float h = fq.x + fq.y <= 1.0 ? ha + fq.x * ( hd - ha ) + fq.y * ( hb - ha ) : hc + ( 1.0 - fq.x ) * ( hb - hc ) + ( 1.0 - fq.y ) * ( hd - hc );
  vec2 gr = vec2( hd - ha + hc - hb, hb - ha + hc - hd ) * 0.5 * NS / LATO;
  return vec2( h, 1.0 - inversesqrt( 1.0 + dot( gr, gr ) ) );
}
`;
}

const V_FILO = /* glsl */`
	// posizione nella piastrella (simmetria casuale per piastrella: la trama non si ripete)
	vec2 lp = position.xz;
	float hT = hash12( aTile * 1.37 + 0.5 );
	if ( hT > 0.5 ) lp = lp.yx;
	if ( fract( hT * 7.0 ) > 0.5 ) lp.x = 1.0 - lp.x;
	if ( fract( hT * 13.0 ) > 0.5 ) lp.y = 1.0 - lp.y;
	vec2 base = aTile + lp * uLatoP;
	float s1 = hash12( base * 97.1 + 3.3 ), s2 = hash12( base * 61.7 + 8.1 ), s3 = hash12( base * 23.9 - 1.7 );
	vec2 qp = quotaPend( base );
	vec3 P0 = vec3( base.x, qp.x * lift( base ) - 0.002, base.y );
	float dCam = distance( cameraPosition, P0 );
	float dJ = dCam * ( 1.0 + ( s3 - 0.5 ) * ${f(FILO.sfrangia)} );
	Suolo su = suoloDi( base );
	vec4 eb = erbaDi( su, base, qp.y, textureLod( tMaschere, ( base + MEZZO ) / LATO, 0.0 ) );
	// quota attiva della banda (densità K/d²), crescita dolce dei fili al limite, fine dell'erba, carta ↔ realtà
	float qa = uRa / max( dJ, 1e-3 );
	float att = min( 1.0, qa * qa ) * eb.x;
	float cresce = clamp( ( att - aFilo.y ) / ( 0.25 * att + 1e-4 ), 0.0, 1.0 );
	cresce *= step( uRin, dJ ) * step( dJ, uRout ) * ( 1.0 - smoothstep( uRmax * 0.72, uRmax, dCam ) );
	float realtaB = uRealta;
	if ( uFronteRealta > 0.0 ) realtaB = max( realtaB, 1.0 - smoothstep( uFronteRealta - 4.0, uFronteRealta, distance( base, uSitoC.xz ) ) );
	cresce *= smoothstep( 0.55, 0.95, realtaB );
	// ciuffi (~20 cm) e chiazze (~1,5 m) più alti e più bassi
	float H = eb.y * ( 0.55 + 0.6 * s1 ) * ( 0.55 + 0.9 * vnoise( base * 55.0 + 3.0 ) ) * ( 0.75 + 0.5 * vnoise( base * 6.0 + 1.0 ) ) * cresce;
	// piega casuale + vento (raffiche che corrono nella direzione del vento)
	float ang = s2 * 6.2831853;
	vec2 dirL = vec2( cos( ang ), sin( ang ) );
	float raff = vnoise( base * 0.55 - VENTO_DIR * uTempoV * 0.9 );
	float osc = sin( uTempoV * 2.3 + dot( base, VENTO_DIR ) * 11.0 + s1 * 6.2831853 );
	vec2 off = dirL * ( 0.12 + 0.5 * s3 * s3 ) + VENTO_DIR * uVento * ( 0.55 * raff + 0.12 * osc );
	off *= min( 1.0, 0.9 / max( length( off ), 1e-4 ) );
	vec3 P2 = P0 + vec3( off.x * H, H * sqrt( max( 1.0 - dot( off, off ), 0.1 ) ), off.y * H );
	vec3 P1 = P0 + vec3( off.x * H * 0.12, H * 0.62, off.y * H * 0.12 );
	float tF = position.y;
	vec3 pFilo = mix( mix( P0, P1, tF ), mix( P1, P2, tF ), tF );
	vec3 Tg = normalize( mix( P1 - P0, P2 - P1, tF ) + vec3( 0.0, 1e-5, 0.0 ) );
	// larghezza: di traverso alla piega, un po' girata verso la camera (i fili di taglio non spariscono), almeno ~0,8 px
	vec2 vc = cameraPosition.xz - base; vc /= max( length( vc ), 1e-4 );
	vec2 wd = normalize( mix( vec2( -dirL.y, dirL.x ), vec2( -vc.y, vc.x ), 0.4 ) + 1e-5 );
	float W = max( ${f(FILO.larghezza)} * ( 0.75 + 0.5 * s1 ), dCam * uPxAng * ${f(FILO.minPx)} ) * sqrt( cresce ) * pow( 1.0 - tF, 0.8 );
	pFilo.xz += wd * ( 0.5 * W * aFilo.x );
	vec3 Nf = normalize( cross( Tg, vec3( wd.x, 0.0, wd.y ) ) );
	if ( dot( Nf, cameraPosition - pFilo ) < 0.0 ) Nf = -Nf;
	vec3 objectNormal = normalize( mix( Nf, vec3( 0.0, 1.0, 0.0 ), ${f(FILO.normaleSu)} ) );
	// tinta: la stessa del suolo (prato o paglia); la variazione per filo cresce con la sua grandezza sullo schermo
	// (un filo di 1–2 px tutto diverso dai vicini sarebbe rumore, non erba)
	float kVar = smoothstep( 6.0, 40.0, H / max( dCam * uPxAng, 1e-6 ) );
	vec3 col = eb.w > 0.5 ? mix( N_PAGLIA, N_GRANO, s2 ) : tintaPrato( base, eb.z );
	col *= ( 1.0 + ( s1 - 0.5 ) * mix( 0.12, 0.4, kVar ) ) * macroN( base ) * ${f(NATURA.albedo)};
	col = mix( col, col * vec3( 1.1, 1.02, 0.72 ), step( 0.6, s3 ) * mix( 0.15, 0.4, kVar ) * ( 1.0 - eb.w ) );
	col = mix( col, N_PAGLIA, step( 0.94, fract( s1 * 17.3 ) ) * mix( 0.2, 0.7, kVar ) );
	vTinta = col; vT = tF; vScuro = mix( ${f(FILO.baseLontano)}, ${f(FILO.base)}, kVar );
`;

const F_DICH = 'varying vec3 vTinta; varying float vT, vScuro;\n';
const F_COLORE = `diffuseColor.rgb = vTinta * mix( vScuro, 1.0, smoothstep( 0.0, 0.75, vT ) ) * ( 1.0 + ${f(FILO.punta)} * smoothstep( 0.6, 1.0, vT ) );`;
// le due facce del filo prendono la stessa luce (normale già girata verso la camera nel vertice)
const F_NORMALE = '\n\tnormal = normalize( vNormal ); nonPerturbedNormal = normal;';
// controluce: la luce del sole (già con l'ombra) passa attraverso i fili sottili
const F_TRASLUCE = `
#if NUM_DIR_LIGHTS > 0
	{ float trV = pow( clamp( dot( - normalize( vViewPosition ), directLight.direction ), 0.0, 1.0 ), 2.0 );
	  float trN = clamp( - dot( normal, directLight.direction ), 0.0, 1.0 );
	  reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * ( ${f(FILO.traslucenza)} * ( 0.35 * trN + trV ) * smoothstep( 0.1, 1.0, vT ) ); }
#endif`;

/**
 * Crea le bande d'erba e le aggiunge a ctx.scene.pianura.
 * @param {object} ctx
 * @param {{alt: Float32Array, S: number, uni: object, sollevamento: string, rMax?: number}} o
 *        alt = quote della mesh (S+1)², uni = uniform condivise (uOnda, uSitoC, uRealta, uFronteRealta, uCantiere, tStati, tMaschere)
 * @returns {{bande: object[], aggiorna(ctx): void} | null}
 */
export function creaErba(ctx, o) {
  const P = LIVELLI[ctx.qualita?.livello];
  if (!P) return null;
  const rMax = Math.min(P.rMax, o.rMax ?? Infinity);
  const n1 = o.S + 1;
  const tAlt = new THREE.DataTexture(o.alt, n1, n1, THREE.RedFormat, THREE.FloatType);
  tAlt.minFilter = tAlt.magFilter = THREE.NearestFilter; tAlt.generateMipmaps = false; tAlt.needsUpdate = true; tAlt.name = 'terreno.quote';
  const s0 = P.rc * Math.sqrt(P.B / P.K);
  const uVento = { value: FILO.vento }, uPxAng = { value: 1e-3 };
  const VS = vertice(o.S, o.sollevamento);
  const bande = [];
  for (let k = 0; P.rc * 2 ** k < rMax; k++) {
    const s = s0 * 2 ** k, rIn = k ? P.rc * 2 ** k : 0, rOut = P.rc * 2 ** (k + 1);
    const lato = Math.ceil(2 * Math.min(rOut * (1 + FILO.sfrangia), rMax) / s) + 2, max = lato * lato;
    const geo = geometriaPiastrella(P.B, P.seg[Math.min(k, P.seg.length - 1)]);
    const tile = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    tile.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aTile', tile); geo.instanceCount = 0;
    const u = {
      ...o.uni, tAlt: { value: tAlt }, uLatoP: { value: s }, uRa: { value: P.rc * 2 ** k },
      uRin: { value: rIn }, uRout: { value: rOut }, uRmax: { value: rMax }, uPxAng, uVento, uTempoV: ctx.U.uTempo,
    };
    const mat = nuovoMateriale(THREE.MeshStandardMaterial, { color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6 }, {
      patch: sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' + VS)
          .replace('#include <beginnormal_vertex>', V_FILO)
          .replace('#include <begin_vertex>', 'vec3 transformed = pFilo;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' + F_DICH)
          .replace('#include <color_fragment>', '#include <color_fragment>\n\t' + F_COLORE)
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>' + F_NORMALE)
          .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>' + F_TRASLUCE);
      },
      chiave: `terreno-erba-v1-${o.S}`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `terreno.erba.${k}`; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.noAO = true; mesh.visible = false;
    ctx.scene.pianura.add(mesh);
    bande.push({ mesh, tile, s, rIn: rIn * (1 - FILO.sfrangia), rOut: Math.min(rOut * (1 + FILO.sfrangia), rMax), n: 0, max });
  }

  // ---- aggiornamento per fotogramma (oggetti preallocati)
  const fr = new THREE.Frustum(), m4 = new THREE.Matrix4(), box = new THREE.Box3(), cam = new THREE.Vector3();
  const alt = o.alt, S = o.S;
  const quota = (x, z) => {
    const fx = Math.min(Math.max((x + MEZ) / LAT * S, 0), S - 1e-3), fz = Math.min(Math.max((z + MEZ) / LAT * S, 0), S - 1e-3);
    const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, k = j * n1 + i;
    return (alt[k] * (1 - a) + alt[k + 1] * a) * (1 - b) + (alt[k + n1] * (1 - a) + alt[k + n1 + 1] * a) * b;
  };
  return {
    bande, B: P.B, rMax,
    /** Piastrelle visibili per banda (solo corona e frustum). Nessuna allocazione. */
    aggiorna(ctx) {
      const c = ctx.camera;
      uVento.value = ctx.flags?.riduci ? 0 : FILO.vento;
      uPxAng.value = 2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2) / Math.max(ctx.vista?.h || 900, 1);
      c.updateMatrixWorld();
      m4.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); fr.setFromProjectionMatrix(m4);
      cam.setFromMatrixPosition(c.matrixWorld);
      const hc = cam.y - quota(cam.x, cam.z);
      const reale = (ctx.STATO?.uRealta ?? 1) > 0.5 || (ctx.STATO?.uFronteRealta ?? -1) > 0;   // in carta niente erba
      for (const b of bande) {
        let n = 0;
        if (reale && hc < b.rOut) {
          const s = b.s, R = b.rOut, arr = b.tile.array;
          const i0 = Math.floor((cam.x - R) / s), i1 = Math.floor((cam.x + R) / s);
          const j0 = Math.floor((cam.z - R) / s), j1 = Math.floor((cam.z + R) / s);
          for (let j = j0; j <= j1; j++) {
            const z0 = j * s, dz = Math.max(z0 - cam.z, 0, cam.z - z0 - s), Dz = Math.max(Math.abs(z0 - cam.z), Math.abs(z0 + s - cam.z));
            for (let i = i0; i <= i1; i++) {
              const x0 = i * s, dx = Math.max(x0 - cam.x, 0, cam.x - x0 - s);
              if (dx * dx + dz * dz > R * R || Math.abs(x0) > MEZ + s || Math.abs(z0) > MEZ + s) continue;
              const h = quota(x0 + s / 2, z0 + s / 2), mg = 0.05 + s * 0.35;
              const dy = Math.max(Math.abs(cam.y - h) - mg, 0), Dx = Math.max(Math.abs(x0 - cam.x), Math.abs(x0 + s - cam.x));
              if (dx * dx + dz * dz + dy * dy > R * R) continue;
              if (Dx * Dx + Dz * Dz + (Math.abs(cam.y - h) + mg) ** 2 < b.rIn * b.rIn) continue;
              box.min.set(x0, h - mg, z0); box.max.set(x0 + s, h + mg + 0.12, z0 + s);
              if (!fr.intersectsBox(box) || n >= b.max) continue;
              arr[n * 2] = x0; arr[n * 2 + 1] = z0; n++;
            }
          }
        }
        if (n !== b.n || n > 0) { b.tile.needsUpdate = n > 0; }
        b.n = n; b.mesh.geometry.instanceCount = n; b.mesh.visible = n > 0;
      }
    },
  };
}
