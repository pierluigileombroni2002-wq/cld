// =============================================================================
// ERI v2 · impianti/agri.js — agrivoltaico: colture sotto i tracker, quote 3D, sagoma tecnica del trattore
// Proprietario: [FV]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.5 (quote agrivoltaiche normative), §6.6 (colture: strisce istanziate, vento, alphaTest), §2.6 colture, §2.7 quote tecniche, §4.4 3c (quoteAgri, trattore, etichette), config.LAYOUT.agri, config.LAYOUT.colture, config.LAYOUT.trattore.
//
// Cosa costruisce (tutto in crea(), nulla dopo):
//  - colture: UN InstancedMesh di strisce verticali doppie (due piani di steli affiancati, appena aperti verso l'esterno).
//    Righe nord–sud ogni 0,075 u, parallele ai tracker: 12 righe per interfila, tutte a più di 0,05 u dalle linee dei pali.
//    Strisce lunghe 1 u (la prima di ogni riga sfalsata, l'ultima tagliata al bordo: aTaglio sposta e accorcia le UV, così
//    gli steli non si deformano). Canvas di steli (DataTexture, alphaTest 0,5, alfa rinforzata nei mip lontani).
//    Tinta acquerello: piede più scuro, punte chiare, macchie lente di tono (instanceColor). Vento nel vertex shader
//    (U.uTempo, fermo con riduci), crescita con l'onda comparsaAgri (chiave = distanza da AGRI_C); stessa patch nel
//    customDepthMaterial. Livello base (Q.coltureSoloVicolo): solo la fascia del vicolo, che cresce nella discesa
//    K3.6 → K3.65 e resta solo in tappa 3 (da lontano non si vede una striscia isolata).
//  - quote: tre linee di quota a inchiostro d'oro (LineSegments2, frecce a 30°) nel piano z = 33 accanto alla fila 16:
//    asse 4,50 m, bordo inferiore 3,46 m (con il modulo fantasma tratteggiato a 60°), sagoma del trattore 2,90 m;
//    crescono dal suolo con STATO.quoteAgri. Sempre davanti (depthTest spento): sono un'annotazione.
//  - trattore: sagoma tecnica in linee d'oro (cofano, telaio, cabina, ruote come cerchi, parafanghi, scarico) dentro
//    l'ingombro tratteggiato 4,5 × 2,4 × 2,9 m, con un velo di carta nei volumi (toglie le linee nascoste); avanza lungo
//    x = 84,95 con STATO.trattore e frena dolcemente a 1 u dalla camera (DESIGN §4.4: con z fino a 39,5 passerebbe
//    dietro la camera di K3.8).
//  Tema chiaro: tutto a inchiostro (NormalBlending, colori di palette, copertura = alfa), mai luce sommata.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'agri.quota1', 'agri.quota2' (Vector3 a metà quota), 'agri.trattore' (funzione: cima
//             della sagoma, sempre lo stesso Vector3); pubblica ctx.dati.agri = { colture, quote, trattore }.
//  aggiorna(ctx, T, t, dt): solo visible, trasformazioni e uniform (nessuna allocazione).
// =============================================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT, PIANURA, PALETTE, MATERIALI, OVERLAY, TRACCE, CAMERA, CAMBIO_MONDO, AGRI_C, UNITA } from '../config.js';
import { altezza, rumore, mulberry32, clamp, ss } from '../geo.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import { fase, sostaVicina } from '../regia/stato.js';

export const MONDO = 'pianura';

const A = LAYOUT.agri, CO = LAYOUT.colture, TR = LAYOUT.trattore, VIC = PIANURA.vicoloAgri, MU = UNITA.metriPerU;

// TARATURA: proporre in config (LAYOUT.colture)
const COLTURE = {
  margine: 0.3,            // capezzagna: le righe restano a 0,3 u dal confine delle particelle 41–44
  strisciaMin: 0.12,       // i tagli di bordo più corti non si mettono
  separazione: 0.011,      // mezza distanza fra i due piani della striscia doppia (u)
  apertura: 0.28,          // apertura dei due piani verso l'esterno (rad, ≈ 16°): dall'alto la riga ha corpo
  segmenti: 4,             // suddivisioni lungo la striscia: il vento piega la cima a onde
  inclinaNormale: 0.45,    // normali piegate verso l'esterno: la luce radente disegna le righe, niente facce nere
  bandaBase: 5,            // livello base: righe entro ±5 u dal vicolo (quello che la camera vede da vicino)…
  bordoBase: 1.5,          // …che si abbassano nell'ultimo 1,5 u: niente taglio netto ai lati
  env: 0.5,
  spintaAlfa: 0.45,        // alfa rinforzata nei mip lontani: lontano le righe diventano campiture piene
  // acquerello: colore di config schiarito verso la salvia del terreno, piede appena più scuro, punte paglierine,
  // macchie lente verso l'ocra (moltiplicatori RGB), variazione per striscia
  schiarisci: 0.22,
  tinte: { scuro: 0.74, punte: '#d2d39c', kPunte: 0.5, macchia: [0.10, 0.03, -0.16], variazione: 0.12 },
};
// TARATURA: proporre in config — vento (DESIGN §4.4: 0,04 u·sin(t·1,6 + x·0,7)·h²). La fase lungo la riga è più
// lunga di §6.6 (z·7 per metro): con 4 segmenti per striscia un'onda così corta andrebbe in aliasing.
const VENTO = { ampiezza: 0.04, frequenza: 1.6, kx: 0.7, kz: 2.3, raffica: 0.35 };
// TARATURA: proporre in config (LAYOUT.agri) — disposizione delle tre quote nel piano z = zQuote (u)
const QUOTE = {
  dxAsse: 0.09,            // quota dell'asse a est del palo (il richiamo parte dall'asse)
  dxBordo: -0.12,          // quota del bordo inferiore a ovest, oltre il bordo del modulo a 60°
  scostamento: 0.03,       // quota del mezzo: appena fuori dall'ingombro del trattore
  freccia: 0.022, oltre: 0.018,
  mezzaLarghezzaM: 1.20,   // §3.5: bordo inferiore = 4,50 − 1,20·sin 60°
  angoloModulo: 60, fantasma: 0.5, tratto: [0.012, 0.008],
};
// TARATURA: proporre in config (LAYOUT.trattore). DESIGN §4.4: "si ferma a 1 u dalla camera".
// velo: copertura della carta dentro la sagoma (toglie le linee nascoste e attenua ciò che sta dietro)
const TRATTORE = { px: 1.25, distanzaCamera: 1.0, frenata: 0.6, comparsa: 0.05, ingombro: 0.45, tratto: [0.18, 0.12],
                   velo: 0.3, restringi: 0.97 };
// TARATURA: proporre in config (LAYOUT.trattore) — proporzioni della sagoma (m, dentro l'ingombro)
const SAGOMA = {
  post: { r: 0.80, z: -1.15, xIn: 0.72 },              // ruote posteriori (faccia esterna = mezza larghezza)
  ant: { r: 0.52, z: 1.40, xOut: 1.02, xIn: 0.68 },    // ruote anteriori
  cofano: { x: 0.42, y: [0.70, 1.50], z0: -0.45 },
  telaio: { x: 0.55, y: [0.55, 1.30], z: [-1.90, -0.45] },
  cabina: { x: 0.66, y: [1.30, 2.80], z1: -0.50, davanzale: 1.85 },
  tetto: { x: 0.74, z1: -0.42 },
  scarico: { x: 0.30, z: -0.30, y: [1.50, 2.55] },
  parafango: { r: 0.94, a: [0.35, 2.79] },
};

const col = hex => new THREE.Color(hex);
const f3 = v => (+v).toFixed(4);
/** Colore di config (sRGB) → letterale GLSL in lineare. */
const vec3Lin = hex => { const c = new THREE.Color(hex); return `vec3(${f3(c.r)}, ${f3(c.g)}, ${f3(c.b)})`; };
/** Copertura 0..1 da un fattore di OVERLAY (ripiego se fosse ancora un'emissione HDR > 1). */
const cop = v => Math.min(1, v > 1 ? v / 2.4 : v);

// ---------------------------------------------------------------- colture: texture degli steli
const TEX_L = 1024, TEX_A = 64;   // 1 u di striscia ↔ 1 024 px; 0,06 u ↔ 64 px
function texturaSteli(ctx) {
  const c = document.createElement('canvas'); c.width = TEX_L; c.height = TEX_A;
  const g = c.getContext('2d', { willReadFrequently: true });
  const rnd = mulberry32(2808);
  const grigio = (a, b) => { const v = Math.round(a + rnd() * (b - a)); return `rgb(${v},${v},${v})`; };
  const ripeti = disegna => { for (const dx of [-TEX_L, 0, TEX_L]) disegna(dx); };   // la texture si ripete in u
  // fogliame al piede: masse morbide e dense, restano piene anche nei mip lontani
  for (let i = 0; i < 170; i++) {
    const x = rnd() * TEX_L, rx = 7 + rnd() * 13, ry = TEX_A * (0.18 + rnd() * 0.22);
    g.fillStyle = grigio(200, 232);
    ripeti(dx => { g.beginPath(); g.ellipse(x + dx, TEX_A, rx, ry, 0, Math.PI, 2 * Math.PI); g.fill(); });
  }
  // steli e foglie: lame curve che si assottigliano verso la punta (poche e larghe: pennellate, non erba fotografica)
  for (let i = 0; i < 330; i++) {
    const x = rnd() * TEX_L, foglia = rnd() < 0.38;
    const alto = TEX_A * (foglia ? 0.32 + rnd() * 0.35 : 0.58 + rnd() * 0.4);
    const piega = (rnd() - 0.5) * (foglia ? 40 : 12), w = foglia ? 3 + rnd() * 3.5 : 1.6 + rnd() * 1.2;
    const ty = TEX_A - alto, cx = piega * 0.15, cy = TEX_A - alto * 0.55;
    g.fillStyle = grigio(foglia ? 210 : 220, 255);
    ripeti(dx => {
      const x0 = x + dx;
      g.beginPath(); g.moveTo(x0 - w / 2, TEX_A);
      g.quadraticCurveTo(x0 + cx - w * 0.3, cy, x0 + piega, ty);
      g.quadraticCurveTo(x0 + cx + w * 0.3, cy, x0 + w / 2, TEX_A);
      g.closePath(); g.fill();
    });
    if (!foglia && rnd() < 0.25) {   // spiga in cima a qualche stelo
      g.fillStyle = grigio(232, 255);
      ripeti(dx => { g.beginPath(); g.ellipse(x + dx + piega, ty + 3, 1.5, 4, piega * 0.02, 0, Math.PI * 2); g.fill(); });
    }
  }
  // capovolta (riga 0 = piede, v = 0) e con i pixel trasparenti grigio medio: niente aloni scuri nei mip
  const img = g.getImageData(0, 0, TEX_L, TEX_A).data, dati = new Uint8Array(TEX_L * TEX_A * 4);
  for (let j = 0; j < TEX_A; j++) for (let i = 0; i < TEX_L; i++) {
    const s = ((TEX_A - 1 - j) * TEX_L + i) * 4, d = (j * TEX_L + i) * 4, a = img[s + 3];
    const v = a > 8 ? img[s] : 225;
    dati[d] = dati[d + 1] = dati[d + 2] = v; dati[d + 3] = a;
  }
  c.width = c.height = 1;   // libera la memoria del canvas
  const t = new THREE.DataTexture(dati, TEX_L, TEX_A, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(8, ctx.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  t.name = 'agri.steli'; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- colture: geometria della striscia doppia
/** Due piani di steli lungo z (da −L/2 a L/2), alti H, a ±separazione in x e aperti verso l'esterno; UV u = 1 per 1 u. */
function geometriaStriscia() {
  const n = COLTURE.segmenti, L = CO.lunghezza, H = CO.altezza, s = COLTURE.separazione, ap = Math.tan(COLTURE.apertura) * H;
  const k = COLTURE.inclinaNormale, nl = Math.hypot(k, 1);
  const pos = [], nor = [], uv = [], ind = [];
  for (const [lato, du] of [[-1, 0], [1, 0.37]]) {          // il secondo piano legge la texture spostata
    const b = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const z = -L / 2 + L * i / n, u = du + L * i / n;
      pos.push(lato * s, 0, z, lato * (s + ap), H, z);
      nor.push(lato * k / nl, 1 / nl, 0, lato * k / nl, 1 / nl, 0);
      uv.push(u, 0, u, 1);
    }
    for (let i = 0; i < n; i++) { const a = b + i * 2; ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}

// ---------------------------------------------------------------- colture: righe nelle particelle
/** Semipiani interni (rientrati di m) di un poligono convesso: n·p ≥ c. */
function semipiani(poli, m) {
  let area = 0; const n = poli.length;
  for (let i = 0; i < n; i++) { const [x0, z0] = poli[i], [x1, z1] = poli[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
  const s = area > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const a = poli[i], b = poli[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const nx = -dz * s / l, nz = dx * s / l;               // normale verso l'interno
    out.push([nx, nz, nx * a[0] + nz * a[1] + m]);
  }
  return out;
}
/** Intervallo di z dentro i semipiani sulla retta x (null se vuoto). */
function intervalloZ(semi, x) {
  let z0 = -Infinity, z1 = Infinity;
  for (const [nx, nz, c] of semi) {
    const r = c - nx * x;                                   // nz·z ≥ r
    if (Math.abs(nz) < 1e-9) { if (r > 0) return null; continue; }
    if (nz > 0) z0 = Math.max(z0, r / nz); else z1 = Math.min(z1, r / nz);
  }
  return z1 > z0 ? [z0, z1] : null;
}
/** Strisce: [x, zCentro, lunghezza]. Righe a ±(j + ½)·passoRighe dal centro di ogni interfila. */
function righeColture(ctx, soloVicolo) {
  const lay = ctx.dati.layout?.agri;
  const x0 = lay?.file?.[0]?.x ?? A.x0, passo = A.passoFile, L = CO.lunghezza;
  const poli = PIANURA.contornoAgri, semi = semipiani(poli, COLTURE.margine);
  const xs = poli.map(p => p[0]), minX = Math.min(...xs), maxX = Math.max(...xs);
  // scostamenti dal centro dell'interfila: restano a più di esclusionePali dalle linee dei pali
  const scost = [];
  for (let j = 0; (j + 0.5) * CO.passoRighe <= passo / 2 - CO.esclusionePali + 1e-9; j++) scost.push((j + 0.5) * CO.passoRighe);
  const rnd = mulberry32(2841), voci = [];
  const n0 = Math.floor((minX - x0) / passo) - 1, n1 = Math.ceil((maxX - x0) / passo) + 1;
  for (let k = n0; k <= n1; k++) {
    const c = x0 + passo * (k + 0.5);
    for (const o of scost) for (const lato of [-1, 1]) {
      const x = c + lato * o;
      const iv = intervalloZ(semi, x); if (!iv) continue;
      const vicino = Math.abs(x - VIC.x) <= COLTURE.bandaBase;
      // la prima striscia di ogni riga è sfalsata: i capi non si allineano fra righe vicine
      let z = iv[0], l = Math.min(L * (0.25 + 0.75 * rnd()), iv[1] - z);
      while (z < iv[1] - 1e-6) {
        l = Math.min(l, iv[1] - z);
        if (l >= COLTURE.strisciaMin && (!soloVicolo || vicino)) voci.push([x, z + l / 2, l]);
        z += l; l = L;
      }
    }
  }
  return voci;
}

// ---------------------------------------------------------------- colture: patch (vertice condiviso con l'ombra)
const ALFA_LOD = `#ifdef USE_MAP
	{ vec2 tC = vMapUv * vec2( ${TEX_L}.0, ${TEX_A}.0 );
	  float lodC = 0.5 * log2( max( max( dot( dFdx( tC ), dFdx( tC ) ), dot( dFdy( tC ), dFdy( tC ) ) ), 1.0 ) );
	  diffuseColor.a = clamp( diffuseColor.a * ( 1.0 + ${COLTURE.spintaAlfa.toFixed(3)} * lodC ), 0.0, 1.0 ); }
#endif`;
/** Vento (cima, h²) e crescita (onda per istanza) nel vertice; UV tagliate per istanza (aTaglio = spostamento, scala). */
function patchVerticeColture(u, conVarying) {
  const V = VENTO;
  return sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aChiave; attribute vec2 aTaglio;
uniform float uCrescita, uTempoV, uVento;
${conVarying ? 'varying float vAltC;' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
	vMapUv.x = aTaglio.x + vMapUv.x * aTaglio.y;
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
	float hC = clamp( position.y / ${f3(CO.altezza)}, 0.0, 1.0 );
	vec4 pmC = vec4( position, 1.0 );
	#ifdef USE_INSTANCING
	pmC = instanceMatrix * pmC;
	#endif
	pmC = modelMatrix * pmC;
	float sC = smoothstep( aChiave, aChiave + 0.1, uCrescita );
	float rafC = ${f3(1 - V.raffica)} + ${f3(V.raffica)} * sin( uTempoV * 0.37 + pmC.x * 0.11 - pmC.z * 0.07 );
	transformed.x += uVento * rafC * sin( uTempoV * ${f3(V.frequenza)} + pmC.x * ${f3(V.kx)} + pmC.z * ${f3(V.kz)} ) * hC * hC * sC;
	transformed.y *= max( sC, 1e-4 );
	${conVarying ? 'vAltC = hC;' : ''}`);
  };
}
/** Tinta acquerello, carta/realtà, normali non capovolte sul retro, alfa dei mip lontani. */
function patchFrammentoColture(u) {
  const Ti = COLTURE.tinte;
  return sh => {
    sh.uniforms.uRealta = u.uRealta;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRealta; varying float vAltC;')
      .replace('#include <color_fragment>', `#include <color_fragment>
	diffuseColor.rgb *= mix( ${f3(Ti.scuro)}, 1.0, smoothstep( 0.0, 0.9, vAltC ) );
	diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3Lin(Ti.punte)}, smoothstep( 0.5, 1.0, vAltC ) * ${f3(Ti.kPunte)} );
	diffuseColor.rgb = mix( ${vec3Lin(PALETTE.carta2)}, diffuseColor.rgb, uRealta );`)
      // i due lati di un piano di steli prendono la stessa luce (niente retro nero sotto il sole radente)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );')
      .replace('#include <alphatest_fragment>', `${ALFA_LOD}\n#include <alphatest_fragment>`);
  };
}

function creaColture(ctx) {
  const soloVicolo = !!ctx.qualita?.Q?.coltureSoloVicolo;
  const voci = righeColture(ctx, soloVicolo);
  // chiave dell'onda: distanza da AGRI_C normalizzata sull'intero campo (uguale in tutti i livelli)
  const tutte = soloVicolo ? righeColture(ctx, false) : voci;
  let dMax = 1e-6; for (const [x, z] of tutte) dMax = Math.max(dMax, Math.hypot(x - AGRI_C[0], z - AGRI_C[2]));

  const tex = texturaSteli(ctx), geo = geometriaStriscia(), n = voci.length;
  const chiave = new Float32Array(n), taglio = new Float32Array(n * 2);
  geo.setAttribute('aChiave', new THREE.InstancedBufferAttribute(chiave, 1));
  geo.setAttribute('aTaglio', new THREE.InstancedBufferAttribute(taglio, 2));
  const u = { uCrescita: { value: -0.1 }, uTempoV: { value: 0 }, uVento: { value: VENTO.ampiezza }, uRealta: ctx.U.uRealta };
  const MC = MATERIALI.colture, pv = patchVerticeColture(u, true), pf = patchFrammentoColture(u);
  const colore = col(MC.color).lerp(col(MATERIALI.terreno.stilizzato?.salvia ?? MC.color), COLTURE.schiarisci);
  const mat = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: colore, roughness: MC.roughness, metalness: 0, map: tex, alphaTest: MC.alphaTest,
    side: THREE.DoubleSide, envMapIntensity: COLTURE.env,
  }, { patch: sh => { pv(sh); pf(sh); }, chiave: 'agri-colture-v1' });
  const pvO = patchVerticeColture(u, false);
  const ombra = nuovoMateriale(THREE.MeshDepthMaterial, {
    depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: MC.alphaTest, side: THREE.DoubleSide,
  }, { patch: sh => { pvO(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `${ALFA_LOD}\n#include <alphatest_fragment>`); }, chiave: 'agri-colture-ombra-v1' });

  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  im.count = n; im.name = 'agri.colture';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const rnd = mulberry32(4428), Ti = COLTURE.tinte;
  voci.forEach(([x, z, l], i) => {
    let sy = 0.88 + 0.24 * rumore(x * 0.9 + 3.1, z * 0.6 - 7.7);         // altezza che varia piano lungo il campo
    if (soloVicolo) sy *= Math.max(0.15, ss(COLTURE.bandaBase, COLTURE.bandaBase - COLTURE.bordoBase, Math.abs(x - VIC.x)));
    p.set(x, altezza(x, z) - 0.004, z); s.set(1, sy, l / CO.lunghezza);
    im.setMatrixAt(i, m4.compose(p, q, s));
    chiave[i] = Math.hypot(x - AGRI_C[0], z - AGRI_C[2]) / dMax;
    taglio[i * 2] = rnd(); taglio[i * 2 + 1] = l / CO.lunghezza;
    const mac = rumore(x * 0.13 + 5.3, z * 0.13 - 2.1), v = 1 + (rnd() * 2 - 1) * Ti.variazione * 0.5;
    c.setRGB(v * (1 + Ti.macchia[0] * mac), v * (1 + Ti.macchia[1] * mac), v * (1 + Ti.macchia[2] * mac));
    im.setColorAt(i, c);
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere(); if (im.boundingSphere) im.boundingSphere.radius += 0.1;   // vento e apertura dei piani
  im.castShadow = true; im.receiveShadow = true;
  im.customDepthMaterial = ombra;
  im.userData.noAO = true;        // MeshNormalMaterial non ha alphaTest: il GTAO vedrebbe le strisce piene
  im.visible = false;
  ctx.scene.pianura.add(im);
  // livello base: crescita nella discesa verso il vicolo (K3.6 → K3.65), funzione pura di T
  const k36 = CAMERA.find(k => k.id === 'K3.6'), k365 = CAMERA.find(k => k.id === 'K3.65');
  return { mesh: im, u, soloVicolo, n, tDa: k36?.t0 ?? 10.40, tA: k365?.t0 ?? 10.58 };
}

// ---------------------------------------------------------------- linee a inchiostro (LineSegments2)
/** LineMaterial a inchiostro (NormalBlending, copertura = opacità), come il plotter del catasto. */
function materialeLinea(lista, colore, copertura, px, opz = {}) {
  const par = { color: col(colore), linewidth: px, worldUnits: false, transparent: true, opacity: copertura,
                depthWrite: false, depthTest: opz.depthTest ?? true, blending: THREE.NormalBlending };
  if (opz.tratto) Object.assign(par, { dashed: true, dashSize: opz.tratto[0], gapSize: opz.tratto[1], dashScale: 1 });
  const m = nuovoMateriale(LineMaterial, par);
  lista.push({ m, px, cop: copertura });
  return m;
}
/** LineSegments2 da un array piatto di coppie di punti (x0,y0,z0, x1,y1,z1, …). */
function linee(pos, mat, nome) {
  const g = new LineSegmentsGeometry(); g.setPositions(new Float32Array(pos));
  const l = new LineSegments2(g, mat);
  if (mat.dashed) l.computeLineDistances();
  l.userData.noAO = true; l.name = nome;
  return l;
}

// ---------------------------------------------------------------- quote (§3.5, §2.7, §4.4 3c)
function creaQuote(ctx, listaLinee) {
  const xQ = A.xQuote, zQ = A.zQuote, yG = altezza(xQ, zQ);
  const h1 = A.quoteM.asse / MU, h2 = A.quoteM.bordoInferiore / MU, h3 = A.quoteM.trattore / MU;
  const mezzo = QUOTE.mezzaLarghezzaM / MU, ang = QUOTE.angoloModulo * Math.PI / 180;
  const xBordo = xQ - mezzo * Math.cos(ang);                         // bordo inferiore a 60° (verso ovest, sera)
  const xT0 = TR.x - TR.ingombroM[1] / MU / 2, xT1 = TR.x + TR.ingombroM[1] / MU / 2;
  const d1 = xQ + QUOTE.dxAsse, d2 = xQ + QUOTE.dxBordo, d3 = xT1 + QUOTE.scostamento;
  const a = OVERLAY.quote.freccia * Math.PI / 180, fx = QUOTE.freccia * Math.sin(a), fy = QUOTE.freccia * Math.cos(a), o = QUOTE.oltre;
  const pos = [];
  const seg = (x0, y0, x1, y1) => pos.push(x0, y0, 0, x1, y1, 0);   // nel piano della quota (y dal suolo)
  const quota = (x, h) => {
    seg(x, 0, x, h);
    seg(x, h, x - fx, h - fy); seg(x, h, x + fx, h - fy);           // frecce a 30°
    seg(x, 0, x - fx, fy); seg(x, 0, x + fx, fy);
  };
  quota(d1, h1); quota(d2, h2); quota(d3, h3);
  seg(xQ, h1, d1 + o, h1);                                          // richiamo dall'asse
  seg(xBordo, h2, d2 - o, h2);                                      // richiamo dal bordo inferiore
  seg(xT0, h3, d3 + o, h3);                                         // sagoma limite del mezzo sul suo ingombro
  seg(Math.min(xT0, d2) - o, 0, d1 + o, 0);                         // linea di terra
  const fant = [xQ - mezzo * Math.cos(ang), h1 - mezzo * Math.sin(ang), 0, xQ + mezzo * Math.cos(ang), h1 + mezzo * Math.sin(ang), 0];

  const Q = OVERLAY.quote, copQ = cop(Q.emissione);
  const mat = materialeLinea(listaLinee, PALETTE.oro, copQ, Q.px, { depthTest: false });
  const matF = materialeLinea(listaLinee, PALETTE.oro, copQ * QUOTE.fantasma, Q.px, { depthTest: false, tratto: QUOTE.tratto });
  const gruppo = new THREE.Group(); gruppo.name = 'agri.quote';
  const l1 = linee(pos, mat, 'agri.quote.linee'), l2 = linee(fant, matF, 'agri.quote.modulo60');
  l1.renderOrder = l2.renderOrder = 6;   // prima del velo del trattore: quando il mezzo passa davanti le attenua
  gruppo.add(l1, l2);
  gruppo.position.set(0, yG + 0.002, zQ); gruppo.visible = false;
  ctx.scene.pianura.add(gruppo);
  const ancore = [new THREE.Vector3(d1, yG + h1 / 2, zQ), new THREE.Vector3(d2, yG + h2 / 2, zQ)];
  return { gruppo, mat, matF, copQ, ancore };
}

// ---------------------------------------------------------------- trattore: sagoma tecnica (m, gruppo × 0,1)
function creaTrattore(ctx, listaLinee) {
  const [Lm, Wm, Hm] = TR.ingombroM, L = Lm / 2, W = Wm / 2, G = SAGOMA;
  const pos = [];
  const seg = (a, b) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const scatola = (x, y0, y1, z0, z1, out = pos) => {
    const v = [[-x, y0, z0], [x, y0, z0], [x, y0, z1], [-x, y0, z1], [-x, y1, z0], [x, y1, z0], [x, y1, z1], [-x, y1, z1]];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      out.push(...v[i], ...v[j]);
    }
  };
  // cerchio (o arco da a0 ad a1) nel piano x = cost.; angolo 0 = avanti (+z), π/2 = in alto
  const arco = (x, cy, cz, r, n, a0 = 0, a1 = Math.PI * 2) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
      seg([x, cy + r * Math.sin(t0), cz + r * Math.cos(t0)], [x, cy + r * Math.sin(t1), cz + r * Math.cos(t1)]);
    }
  };
  const ruota = (xOut, xIn, r, z, n) => {
    for (const s of [-1, 1]) {
      arco(s * xOut, r, z, r, n); arco(s * xIn, r, z, r, n); arco(s * xOut, r, z, r * 0.32, 14);   // fianchi e mozzo
      for (let k = 0; k < 4; k++) {                                   // battistrada: quattro generatrici
        const t = k * Math.PI / 2, y = r + r * Math.sin(t), zz = z + r * Math.cos(t);
        seg([s * xOut, y, zz], [s * xIn, y, zz]);
      }
    }
  };
  ruota(W, G.post.xIn, G.post.r, G.post.z, 36);
  ruota(G.ant.xOut, G.ant.xIn, G.ant.r, G.ant.z, 28);
  // parafanghi delle ruote posteriori: archi sulle due facce, chiusi alle estremità
  for (const s of [-1, 1]) {
    const [a0, a1] = G.parafango.a, r = G.parafango.r, cy = G.post.r, cz = G.post.z;
    arco(s * W, cy, cz, r, 14, a0, a1); arco(s * G.post.xIn, cy, cz, r, 14, a0, a1);
    for (const t of [a0, a1]) seg([s * W, cy + r * Math.sin(t), cz + r * Math.cos(t)], [s * G.post.xIn, cy + r * Math.sin(t), cz + r * Math.cos(t)]);
  }
  scatola(G.cofano.x, G.cofano.y[0], G.cofano.y[1], G.cofano.z0, L);
  for (const y of [0.92, 1.08, 1.24]) seg([-G.cofano.x, y, L], [G.cofano.x, y, L]);              // calandra
  scatola(G.telaio.x, G.telaio.y[0], G.telaio.y[1], G.telaio.z[0], G.telaio.z[1]);
  scatola(G.cabina.x, G.cabina.y[0], G.cabina.y[1], -L, G.cabina.z1);
  scatola(G.tetto.x, G.cabina.y[1], Hm, -L, G.tetto.z1);
  { const x = G.cabina.x, y = G.cabina.davanzale, z0 = -L, z1 = G.cabina.z1;                      // davanzale dei vetri
    seg([-x, y, z0], [x, y, z0]); seg([x, y, z0], [x, y, z1]); seg([x, y, z1], [-x, y, z1]); seg([-x, y, z1], [-x, y, z0]); }
  seg([G.scarico.x, G.scarico.y[0], G.scarico.z], [G.scarico.x, G.scarico.y[1], G.scarico.z]);   // scarico
  seg([-G.ant.xIn, G.ant.r, G.ant.z], [G.ant.xIn, G.ant.r, G.ant.z]);                             // assale anteriore
  const ingombro = []; scatola(W, 0, Hm, -L, L, ingombro);

  const copT = cop(OVERLAY.quote.emissione);
  const mat = materialeLinea(listaLinee, PALETTE.oro, copT, TRATTORE.px);
  const matI = materialeLinea(listaLinee, PALETTE.oro, copT * TRATTORE.ingombro, OVERLAY.quote.px, { tratto: TRATTORE.tratto });
  const gruppo = new THREE.Group(); gruppo.name = 'agri.trattore';
  const l1 = linee(pos, mat, 'agri.trattore.sagoma'), l2 = linee(ingombro, matI, 'agri.trattore.ingombro');
  l1.renderOrder = l2.renderOrder = 8;
  // velo di carta: volumi appena rientrati, disegnati prima delle linee con depthWrite (via le linee nascoste)
  const pezzi = [], kr = TRATTORE.restringi;
  const blocco = (x, y0, y1, z0, z1) => {
    pezzi.push(new THREE.BoxGeometry(2 * x * kr, (y1 - y0) * kr, (z1 - z0) * kr).translate(0, (y0 + y1) / 2, (z0 + z1) / 2));
  };
  const gomme = (xIn, xOut, r, z) => {
    for (const s of [-1, 1]) {
      pezzi.push(new THREE.CylinderGeometry(r * kr, r * kr, (xOut - xIn) * kr, 28).rotateZ(Math.PI / 2).translate(s * (xIn + xOut) / 2, r, z));
    }
  };
  blocco(G.cofano.x, G.cofano.y[0], G.cofano.y[1], G.cofano.z0, L);
  blocco(G.telaio.x, G.telaio.y[0], G.telaio.y[1], G.telaio.z[0], G.telaio.z[1]);
  blocco(G.cabina.x, G.cabina.y[0], G.cabina.y[1], -L, G.cabina.z1);
  blocco(G.tetto.x, G.cabina.y[1], Hm, -L, G.tetto.z1);
  gomme(G.post.xIn, W, G.post.r, G.post.z);
  gomme(G.ant.xIn, G.ant.xOut, G.ant.r, G.ant.z);
  const geoVelo = mergeGeometries(pezzi, false); for (const p of pezzi) p.dispose();
  const matV = nuovoMateriale(THREE.MeshBasicMaterial, {
    color: col(PALETTE.carta), transparent: true, opacity: TRATTORE.velo, depthWrite: true, fog: false,
    blending: THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const velo = new THREE.Mesh(geoVelo, matV);
  velo.name = 'agri.trattore.velo'; velo.renderOrder = 7; velo.userData.noAO = true;
  gruppo.add(velo, l1, l2);
  gruppo.scale.setScalar(UNITA.scalaMeccanica); gruppo.visible = false;
  ctx.scene.pianura.add(gruppo);

  // fermata: 1 u davanti alla camera alla fine della traccia (posa normativa pura del rig)
  const tFine = TRACCE.trattore?.[0]?.[1] ?? 11.22;
  let zCam = NaN;
  try { zCam = ctx.rig?.posa?.(tFine)?.posizione?.[2]; } catch { zCam = NaN; }
  if (!Number.isFinite(zCam)) zCam = CAMERA.find(k => k.id === 'K3.8')?.P?.[2] ?? TR.zA + TRATTORE.distanzaCamera;
  const zStop = zCam - TRATTORE.distanzaCamera - L / MU;            // centro della sagoma
  const dzCima = (-L + G.tetto.z1) / 2 / MU;                         // la cima è il tetto della cabina
  return { gruppo, mat, matI, matV, copT, zStop, dzCima, cima: new THREE.Vector3(TR.x, altezza(TR.x, TR.zDa) + Hm / MU, TR.zDa + dzCima) };
}

// ---------------------------------------------------------------- stato del modulo
let st = null;

/** Costruzione (una volta). */
export async function crea(ctx) {
  const t0 = performance.now();
  const listaLinee = [];
  const colture = creaColture(ctx);
  const quote = creaQuote(ctx, listaLinee);
  const trattore = creaTrattore(ctx, listaLinee);

  ctx.ancore.set('agri.quota1', quote.ancore[0]);
  ctx.ancore.set('agri.quota2', quote.ancore[1]);
  ctx.ancore.set('agri.trattore', () => trattore.cima);
  ctx.dati.agri = { colture: colture.mesh, quote: quote.gruppo, trattore: trattore.gruppo };

  st = { colture, quote, trattore, linee: listaLinee };
  if (ctx.flags?.debug) console.info(`[agri] costruito in ${Math.round(performance.now() - t0)} ms · ${colture.n} strisce di colture${colture.soloVicolo ? ' (solo il vicolo)' : ''}`);
}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T /*, t, dt */) {
  if (!st) return;
  const S = ctx.STATO, U = ctx.U, riduci = !!ctx.flags?.riduci;
  const Te = riduci ? sostaVicina(T).t1 : T;                       // come le tracce con riduci movimento
  const tappa3 = T < CAMBIO_MONDO.valleDa;                          // quote e trattore esistono solo in 3c

  // ---- colture: crescita (onda o discesa nel vicolo) e vento
  const c = st.colture;
  const cresce = c.soloVicolo ? (tappa3 ? -0.1 + 1.2 * fase(Te, c.tDa, c.tA) : -0.1) : S.comparsaAgri;
  c.u.uCrescita.value = cresce;
  c.u.uTempoV.value = riduci ? 0 : U.uTempo.value;
  c.mesh.visible = c.n > 0 && cresce > 0;

  // ---- linee: px CSS × uPx sul buffer interno
  const res = U.uRisoluzione.value, px = U.uPx.value;
  for (const r of st.linee) { r.m.linewidth = r.px * px; r.m.resolution.copy(res); }

  // ---- quote: crescono dal suolo con quoteAgri
  const q = st.quote, kq = clamp(S.quoteAgri, 0, 1);
  q.gruppo.visible = tappa3 && kq > 0.002;
  if (q.gruppo.visible) {
    q.gruppo.scale.y = Math.max(kq, 1e-3);
    q.mat.opacity = q.copQ * kq; q.matF.opacity = q.copQ * QUOTE.fantasma * kq;
  }

  // ---- trattore: avanza lungo x = 84,95 e frena a 1 u dalla camera (minimo dolce, funzione pura di STATO.trattore)
  const tr = st.trattore, k = clamp(S.trattore, 0, 1);
  const zLin = TR.zDa + (TR.zA - TR.zDa) * k, fr = TRATTORE.frenata;
  const h = clamp(0.5 + 0.5 * (tr.zStop - zLin) / fr, 0, 1);
  const z = tr.zStop + (zLin - tr.zStop) * h - fr * h * (1 - h);
  const y = altezza(TR.x, z);
  tr.cima.set(TR.x, y + TR.ingombroM[2] / MU, z + tr.dzCima);
  tr.gruppo.visible = tappa3 && k > 0;
  if (tr.gruppo.visible) {
    tr.gruppo.position.set(TR.x, y, z);
    const a = clamp(k / TRATTORE.comparsa, 0, 1);
    tr.mat.opacity = tr.copT * a; tr.matI.opacity = tr.copT * TRATTORE.ingombro * a; tr.matV.opacity = TRATTORE.velo * a;
  }
}
