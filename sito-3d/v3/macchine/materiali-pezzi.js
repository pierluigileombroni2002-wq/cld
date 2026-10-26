// ERI v3 · macchine: attrezzi condivisi (texture da canvas, pezzi meccanici, fusione per materiale, montaggio, dettaglio LOD).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry, ParametricGeometry, mergeGeometries };

// somma additiva che NON tocca l'alfa (altrimenti l'alfa supera 1 e il bloom esplode)
export const ADDITIVO = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false,
};

// rumore pseudo-casuale ripetibile
export function rng(seme = 1) { let s = seme >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function texDaCanvas(w, h, disegna, { srgb = true, ripeti = null, anis = 8 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  disegna(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anis;
  if (ripeti) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ripeti[0], ripeti[1]); }
  return t;
}

// segmenti secondo la qualità
export const segm = (q, alta, media, bassa) => (q === 'alta' ? alta : q === 'media' ? media : bassa);

// ---------- geometrie ----------
export function geoBox(w, h, d, r = 0, seg = 2) {
  return r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
}
export const geoCil = (rt, rb, h, seg = 24, aperto = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, aperto);

// bullone esagonale con rondella: asse +Y, base a y=0
export function geoBullone(r = 0.01, seg = 16) {
  const ron = new THREE.CylinderGeometry(r * 1.55, r * 1.55, r * 0.28, seg); ron.translate(0, r * 0.14, 0);
  const tes = new THREE.CylinderGeometry(r, r, r * 0.75, 6); tes.translate(0, r * 0.28 + r * 0.375, 0);
  const smu = new THREE.CylinderGeometry(r * 0.82, r, r * 0.12, 6); smu.translate(0, r * 0.28 + r * 0.81, 0);
  const gam = new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 0.5, Math.max(6, seg >> 1)); gam.translate(0, r * 0.28 + r * 0.75 + r * 0.25, 0);
  return mergeGeometries([ron, tes, smu, gam].map(normalizza));
}

// profilo a I estruso lungo +Y (base a y=0)
export function geoProfiloI(b, h, tw, tf, lung, smusso = 0.003) {
  const s = new THREE.Shape(), x0 = -b / 2, x1 = b / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y0 + tf); s.lineTo(tw / 2, y0 + tf); s.lineTo(tw / 2, y1 - tf);
  s.lineTo(x1, y1 - tf); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y1 - tf); s.lineTo(-tw / 2, y1 - tf);
  s.lineTo(-tw / 2, y0 + tf); s.lineTo(x0, y0 + tf); s.lineTo(x0, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: lung - smusso * 2, bevelEnabled: smusso > 0, bevelThickness: smusso, bevelSize: smusso * 0.6, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, smusso); g.rotateX(-Math.PI / 2);
  return g;
}

// profilo a C estruso lungo X
export function geoProfiloC(b, h, t, lung) {
  const s = new THREE.Shape();
  s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(b / 2, h); s.lineTo(b / 2 - t, h); s.lineTo(b / 2 - t, t);
  s.lineTo(-b / 2 + t, t); s.lineTo(-b / 2 + t, h); s.lineTo(-b / 2, h); s.lineTo(-b / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: lung, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0012, bevelSegments: 1 });
  g.translate(0, 0, -lung / 2); g.rotateY(Math.PI / 2);
  return g;
}

// disco di flangia (rivoluzione attorno a Y, base a y=0)
export function geoFlangia(rEst, rInt, spess, seg = 64) {
  const p = [[rInt, 0], [rEst - spess * 0.15, 0], [rEst, spess * 0.15], [rEst, spess * 0.85], [rEst - spess * 0.15, spess], [rInt, spess], [rInt, 0]];
  return new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), seg);
}

// tubo morbido che passa per dei punti
export function geoTubo(punti, r, seg = 48, rad = 8) {
  const c = new THREE.CatmullRomCurve3(punti, false, 'centripetal');
  return new THREE.TubeGeometry(c, seg, r, rad, false);
}

// ---------- matrici ----------
const _o = new THREE.Object3D(), _Y = new THREE.Vector3(0, 1, 0), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
  return _o.matrix.clone();
}
// matrice che porta l'asse +Y lungo la direzione n (con rotazione propria attorno all'asse)
export function mat4Dir(x, y, z, n, rot = 0, s = 1) {
  _qa.setFromUnitVectors(_Y, n.clone().normalize());
  if (rot) _qa.multiply(_qb.setFromAxisAngle(_Y, rot));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _qa, new THREE.Vector3(s, s, s));
}

// ---------- fusione per materiale: tanti pezzi fermi → una sola chiamata per materiale ----------
export function normalizza(g) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  n.clearGroups(); n.morphAttributes = {};
  return n;
}
export class Fusore {
  constructor() { this.m = new Map(); }
  add(geo, mat, m4 = null) {
    if (!this.m.has(mat)) this.m.set(mat, []);
    const g = normalizza(geo); if (m4) g.applyMatrix4(m4);
    this.m.get(mat).push(g); return this;
  }
  // tante copie della stessa geometria
  multi(geo, mat, matrici) { const base = normalizza(geo); for (const m of matrici) { const g = base.clone(); g.applyMatrix4(m); if (!this.m.has(mat)) this.m.set(mat, []); this.m.get(mat).push(g); } return this; }
  get vuoto() { return this.m.size === 0; }
  geometrie() { const out = new Map(); for (const [mat, l] of this.m) out.set(mat, mergeGeometries(l, false)); return out; }
  // una Mesh per materiale dentro al gruppo
  in(gruppo) {
    const out = [];
    for (const [mat, g] of this.geometrie()) { const m = new THREE.Mesh(g, mat); gruppo.add(m); out.push(m); }
    return out;
  }
  // una InstancedMesh per materiale, con le matrici date
  istanze(gruppo, matrici) {
    const out = [];
    for (const [mat, g] of this.geometrie()) {
      const im = new THREE.InstancedMesh(g, mat, matrici.length);
      matrici.forEach((m, i) => im.setMatrixAt(i, m)); gruppo.add(im); out.push(im);
    }
    return out;
  }
}

// istanze di una geometria con matrici date
export function istanze(geo, mat, matrici, gruppo = null) {
  const im = new THREE.InstancedMesh(geo, mat, matrici.length);
  matrici.forEach((m, i) => im.setMatrixAt(i, m));
  if (gruppo) gruppo.add(im);
  return im;
}

// sfera di ingombro fissata a montaggio finito (+ margine per i pezzi in volo): evita che il frustum li scarti
export function fissaSfera(ims, margine = 0) {
  for (const im of (Array.isArray(ims) ? ims : [ims])) {
    if (im.isInstancedMesh) { im.computeBoundingSphere(); im.boundingSphere.radius += margine; }
  }
}

// ---------- montaggio: i pezzi arrivano in sequenza, con calma ----------
export const morbido = x => x * x * (3 - 2 * x);
export const esce = x => 1 - (1 - x) * (1 - x) * (1 - x);
export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const rampa = (x, a, b) => clamp01((x - a) / (b - a));
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4();

export class Montaggio {
  constructor() { this.voci = []; this.ultimo = -1; this.ims = []; }
  _voce(a, b, o = {}) {
    return {
      a, b, off: new THREE.Vector3().fromArray(o.off || [0, 0, 0]), sc: o.scala ? new THREE.Vector3().fromArray(o.scala) : null,
      rot: o.rot ? new THREE.Vector3().fromArray(o.rot) : null, cresce: o.cresce !== false, fn: o.fn || null, x: -1,
    };
  }
  // o: Object3D. opzioni: off [x,y,z] (partenza), scala [sx,sy,sz] (scala iniziale), rot [rx,ry,rz] (rotazione iniziale), cresce, fn(x)
  oggetto(o, a, b, opz) {
    const v = this._voce(a, b, opz); v.o = o; v.p0 = o.position.clone(); v.q0 = o.quaternion.clone(); v.s0 = o.scale.clone();
    this.voci.push(v); return v;
  }
  // ims: InstancedMesh (o lista che condivide la stessa matrice), i: indice
  istanza(ims, i, a, b, opz) {
    ims = Array.isArray(ims) ? ims : [ims];
    const v = this._voce(a, b, opz); v.ims = ims; v.i = i;
    ims[0].getMatrixAt(i, _m); v.p0 = new THREE.Vector3(); v.q0 = new THREE.Quaternion(); v.s0 = new THREE.Vector3(); _m.decompose(v.p0, v.q0, v.s0);
    for (const im of ims) if (!this.ims.includes(im)) this.ims.push(im);
    this.voci.push(v); return v;
  }
  // solo una funzione chiamata con l'avanzamento 0..1 della finestra
  funzione(a, b, fn) { const v = this._voce(a, b, { fn }); v.solo = true; this.voci.push(v); return v; }

  aggiorna(k) {
    if (k === this.ultimo) return false;
    this.ultimo = k;
    const voci = this.voci;
    for (let n = 0; n < voci.length; n++) {
      const v = voci[n], x = clamp01((k - v.a) / (v.b - v.a));
      if (x === v.x) continue;
      v.x = x;
      if (v.solo) { v.fn(x); continue; }
      const e = esce(x), r = 1 - e;
      _p.copy(v.p0).addScaledVector(v.off, r);
      _q.copy(v.q0);
      if (v.rot) { _e.set(v.rot.x * r, v.rot.y * r, v.rot.z * r); _q.multiply(_q2.setFromEuler(_e)); }
      _s.copy(v.s0);
      if (v.sc) _s.set(_s.x * (v.sc.x + (1 - v.sc.x) * e), _s.y * (v.sc.y + (1 - v.sc.y) * e), _s.z * (v.sc.z + (1 - v.sc.z) * e));
      else if (v.cresce) _s.multiplyScalar(morbido(clamp01(x / 0.4)));
      if (x <= 0) _s.setScalar(0);
      if (v.o) { v.o.position.copy(_p); v.o.quaternion.copy(_q); v.o.scale.copy(_s); v.o.visible = x > 0; }
      else { _m.compose(_p, _q, _s); for (let j = 0; j < v.ims.length; j++) { v.ims[j].setMatrixAt(v.i, _m); v.ims[j].instanceMatrix.needsUpdate = true; } }
      if (v.fn) v.fn(x);
    }
    return true;
  }
}

// ---------- dettaglio (LOD): da vicino i pezzi fini, da lontano la versione leggera ----------
export class Dettaglio {
  constructor(soglia = 0.5) { this.hi = []; this.lo = []; this.cambi = []; this.on = null; this.soglia = soglia; this.permesso = true; }
  // cambio di geometria su una mesh (anche istanziata)
  cambio(mesh, geoHi, geoLo) { this.cambi.push({ mesh, geoHi, geoLo }); }
  aggiorna(vicino) {
    const s = this.soglia, on = this.permesso && (this.on ? vicino > s - 0.06 : vicino > s + 0.06);
    if (on === this.on) return;
    this.on = on;
    for (let i = 0; i < this.hi.length; i++) this.hi[i].visible = on;
    for (let i = 0; i < this.lo.length; i++) this.lo[i].visible = !on;
    for (let i = 0; i < this.cambi.length; i++) { const c = this.cambi[i]; c.mesh.geometry = on ? c.geoHi : c.geoLo; }
  }
}

// rivela una geometria indicizzata per una frazione (le geometrie lungo un percorso "si disegnano")
export function rivela(geo, x) {
  const n = geo.index ? geo.index.count : geo.attributes.position.count;
  geo.setDrawRange(0, x >= 1 ? Infinity : Math.floor((n * x) / 3) * 3);
}
