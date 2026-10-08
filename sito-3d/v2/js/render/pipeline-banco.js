// =============================================================================
// ERI v2 · render/pipeline-banco.js — BANCO DI PROVA della resa (privato di BASE-RENDER)
// Si carica SOLO con ?banco=1 insieme a ?debug=1 o ?test=1 (da render/ombre.js). Non fa parte del sito.
//
// Una natura morta nella PIANURA, nei punti inquadrati dai keyframe veri, per tarare con la regia reale:
//  - terreno da geo.altezza() con il set PBR terreno_erba_roccia (ombre lunghe delle colline al tramonto);
//  - campo FV dal layout normativo (308 tracker) con moduli in vetro e pali: ombre che ruotano con θ,
//    riflessi dell'ambiente, GTAO ai piedi dei pali (K3.1);
//  - carta grigia 18 % (sfera e cartoncino) e sfera cromata (rotazione della HDRI, de-solazione);
//  - lunetta di 60 tacche d'oro (emissione × 2,4) e contorno del campo (× 2,0): bloom solo sul dato;
//  - cabine e un'antenna per le ombre lunghe.
// Il banco nasconde gli altri oggetti della PIANURA (non quelli di sistema: luci, cupola, freccia).
// =============================================================================
import * as THREE from 'three';
import { nuovoMateriale } from '../luce/nebbia.js';
import { altezza } from '../geo.js';
import { PALETTE, MATERIALI, LAYOUT, OVERLAY, SITO_C } from '../config.js';

const st = { gruppo: null, moduli: null, lista: [], theta: NaN };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

export async function crea(ctx) {
  const g = st.gruppo = new THREE.Group(); g.name = 'banco'; g.userData.banco = true;

  // ---- terreno
  let set = null; try { set = await ctx.carica.texture('terreno_erba_roccia'); } catch { /* senza texture */ }
  const LATO = 360, N = 240;
  const geo = new THREE.PlaneGeometry(LATO, LATO, N, N).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, altezza(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const ripeti = t => { if (!t) return null; const c = t.clone(); c.repeat.set(LATO / 7, LATO / 7); c.needsUpdate = true; return c; };
  const MT = MATERIALI.terreno;
  // ?grigio=1: terreno grigio 18 % senza texture, per leggere luce, ombre e rilievo senza il disegno del suolo
  if (new URLSearchParams(location.search).get('grigio') === '1') set = null;
  const matT = nuovoMateriale(THREE.MeshStandardMaterial, {
    color: set ? new THREE.Color(MT.albedo, MT.albedo, MT.albedo) : new THREE.Color().setRGB(0.18, 0.18, 0.18, THREE.LinearSRGBColorSpace), map: ripeti(set?.diff), normalMap: ripeti(set?.nor),
    roughnessMap: ripeti(set?.arm), aoMap: ripeti(set?.arm), roughness: 1, metalness: 0, envMapIntensity: MT.envMapIntensity,
  });
  const terreno = new THREE.Mesh(geo, matT); terreno.receiveShadow = terreno.castShadow = true; terreno.name = 'banco-terreno';
  g.add(terreno);
  const fondo = new THREE.Mesh(new THREE.RingGeometry(LATO * 0.69, 2400, 64, 1).rotateX(-Math.PI / 2),
    nuovoMateriale(THREE.MeshStandardMaterial, { color: '#1a1c18', roughness: 1, metalness: 0, envMapIntensity: MT.envMapIntensity }));
  fondo.position.y = -1.2; fondo.receiveShadow = true; g.add(fondo);

  // ---- campo FV (layout normativo) — moduli, pali, tubi
  const lay = ctx.dati.layout?.fv; const trk = lay?.tracker || [];
  const largh = LAYOUT.larghezzaUtileM / 10, sp = LAYOUT.modulo.spessoreM / 10;
  const matMod = nuovoMateriale(THREE.MeshPhysicalMaterial, { color: '#0b1524', roughness: MATERIALI.moduloFronte.roughness, metalness: 0,
    clearcoat: 1, clearcoatRoughness: MATERIALI.moduloFronte.clearcoatRoughness, ior: 1.5, envMapIntensity: MATERIALI.moduloFronte.envMapIntensity });
  const moduli = st.moduli = new THREE.InstancedMesh(new THREE.BoxGeometry(largh, sp, 1), matMod, Math.max(1, trk.length));
  moduli.castShadow = moduli.receiveShadow = true; moduli.name = 'banco-moduli'; moduli.frustumCulled = false;
  g.add(moduli);
  const MA = MATERIALI.acciaio;
  const matAcc = nuovoMateriale(THREE.MeshStandardMaterial, { color: MA.color, metalness: MA.metalness, roughness: MA.roughness, envMapIntensity: MA.envMapIntensity });
  const nPali = trk.reduce((s, t) => s + t.pali.length, 0);
  const pali = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 1, 0.012), matAcc, Math.max(1, nPali));
  const tubi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 1), matAcc, Math.max(1, trk.length));
  pali.castShadow = tubi.castShadow = true; pali.receiveShadow = tubi.receiveShadow = true; pali.frustumCulled = tubi.frustumCulled = false;
  let ip = 0;
  trk.forEach((t, i) => {
    const y0 = altezza(t.x, t.centro[2]), ya = y0 + LAYOUT.fv.quotaAsse;
    st.lista.push({ x: t.x, y: ya + 0.01, z: t.centro[2], l: t.z1 - t.z0 });
    _m.compose(_p.set(t.x, ya, t.centro[2]), _q.identity(), _s.set(1, 1, t.z1 - t.z0)); tubi.setMatrixAt(i, _m);
    for (const z of t.pali) { const yb = altezza(t.x, z); _m.compose(_p.set(t.x, (yb + ya) / 2, z), _q.identity(), _s.set(1, ya - yb + 0.02, 1)); pali.setMatrixAt(ip++, _m); }
  });
  g.add(pali, tubi);

  // ---- carta grigia 18 % (albedo lineare 0,18), sfera cromata, cartoncino — vicino al motoriduttore di K3.1
  const yS = altezza(20.6, 9.4);
  const grigio = nuovoMateriale(THREE.MeshStandardMaterial, { color: new THREE.Color().setRGB(0.18, 0.18, 0.18, THREE.LinearSRGBColorSpace), roughness: 0.9, metalness: 0, envMapIntensity: 1 });
  const cromo = nuovoMateriale(THREE.MeshStandardMaterial, { color: '#ffffff', roughness: 0.04, metalness: 1, envMapIntensity: 1 });
  const sfG = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 24), grigio); sfG.position.set(20.75, yS + 0.22, 9.35);
  const sfC = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 24), cromo); sfC.position.set(20.2, yS + 0.22, 9.15);
  const carta = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.01), grigio); carta.position.set(21.3, yS + 0.18, 9.6); carta.rotation.y = -0.6;
  for (const m of [sfG, sfC, carta]) { m.castShadow = m.receiveShadow = true; g.add(m); }

  // ---- oro emissivo (HDR > 1: bloom) — lunetta di maturità e contorno del campo
  const oro = c => nuovoMateriale(THREE.MeshBasicMaterial, { color: new THREE.Color(PALETTE.oro3d).multiplyScalar(c) });
  const L = OVERLAY.lunetta;
  const tacche = new THREE.InstancedMesh(new THREE.BoxGeometry(L.tacca[0], 0.02, L.tacca[1]), oro(L.accesa), L.tacche);
  for (let i = 0; i < L.tacche; i++) {
    const a = i / L.tacche * Math.PI * 2, x = SITO_C[0] + Math.cos(a) * L.raggio, z = SITO_C[2] + Math.sin(a) * L.raggio;
    _q.setFromAxisAngle(_p.set(0, 1, 0), -a + Math.PI / 2);
    _m.compose(_p.set(x, altezza(x, z) + 0.03, z), _q, _s.set(1, 1, 1)); tacche.setMatrixAt(i, _m);
  }
  tacche.userData.noAO = true; tacche.frustumCulled = false; g.add(tacche);
  if (trk.length) {
    const xs = trk.map(t => t.x), zs = trk.flatMap(t => [t.z0, t.z1]);
    const x0 = Math.min(...xs) - 0.6, x1 = Math.max(...xs) + 0.6, z0 = Math.min(...zs) - 0.6, z1 = Math.max(...zs) + 0.6;
    const bordo = oro(OVERLAY.layoutApprovato.emissione);
    const lato = (ax, az, bx, bz) => {
      const l = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, l), bordo);
      m.position.set((ax + bx) / 2, Math.max(altezza(ax, az), altezza(bx, bz)) + 0.05, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az);
      m.userData.noAO = true; g.add(m);
    };
    lato(x0, z0, x1, z0); lato(x1, z0, x1, z1); lato(x1, z1, x0, z1); lato(x0, z1, x0, z0);
  }

  // ---- cabine e antenna: ombre lunghe
  const cem = nuovoMateriale(THREE.MeshStandardMaterial, { color: MATERIALI.cabine.color, roughness: 0.85, metalness: 0, envMapIntensity: MATERIALI.calcestruzzo.envMapIntensity });
  for (const [x, z, r] of [[-2, 8, 0.2], [-2.2, 9.2, 0.2], [44, -6, 0.6]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.25), cem); c.position.set(x, altezza(x, z) + 0.15, z); c.rotation.y = r;
    c.castShadow = c.receiveShadow = true; g.add(c);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 3, 8), matAcc); antenna.position.set(-3, altezza(-3, 6) + 1.5, 6);
  antenna.castShadow = true; g.add(antenna);

  ctx.scene.pianura.add(g);
}

/** Dopo i contenuti: nasconde il resto della PIANURA e ruota i moduli con l'angolo dei tracker (θ, §6.6). */
export function aggiorna(ctx) {
  for (const o of ctx.scene.pianura.children) if (!o.userData.banco && !o.userData.sistema) o.visible = false;
  const th = ctx.STATO.trackerFV?.theta ?? 0;
  if (th === st.theta || !st.moduli) return;
  st.theta = th;
  _q.setFromAxisAngle(_z, th * Math.PI / 180);       // rotazione attorno all'asse z (N-S) di +θ
  st.lista.forEach((t, i) => { _m.compose(_p.set(t.x, t.y, t.z), _q, _s.set(1, 1, t.l)); st.moduli.setMatrixAt(i, _m); });
  st.moduli.instanceMatrix.needsUpdate = true;
  ctx.ombre?.richiedi();
}
