// Showroom ERI · materiali, texture procedurali e piccoli pezzi meccanici riusabili.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry, mergeGeometries };

let ANIS = 8;
export function impostaAnisotropia(n) { ANIS = n; }

export function texDaCanvas(w, h, disegna, { srgb = true, ripeti = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  disegna(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANIS;
  if (ripeti) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ripeti[0], ripeti[1]); }
  return t;
}

// rumore pseudo-casuale ripetibile
export function rng(seme = 1) { let s = seme >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- materiali ----------
const fis = (o) => new THREE.MeshPhysicalMaterial(o);
export const M = {};
export function creaMateriali() {
  // spazzolato: righe sottili nella ruvidità (si vedono da vicino nei riflessi)
  const spazzolato = texDaCanvas(512, 512, (g, w, h) => {
    const r = rng(7); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const y = r() * h, v = 100 + r() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, w, 0.6 + r()); }
  }, { srgb: false, ripeti: [2, 2] });
  Object.assign(M, {
    alluminio: fis({ color: '#c9cdd4', metalness: 1, roughness: 0.3, roughnessMap: spazzolato }),
    acciaio: fis({ color: '#a3a9b0', metalness: 1, roughness: 0.42, roughnessMap: spazzolato }),   // zincato
    acciaioScuro: fis({ color: '#5d636b', metalness: 1, roughness: 0.38 }),
    inox: fis({ color: '#f1f2f5', metalness: 1, roughness: 0.13, clearcoat: 0.4, clearcoatRoughness: 0.14 }),
    inoxSatinato: fis({ color: '#dfe2e6', metalness: 1, roughness: 0.24, roughnessMap: spazzolato }),
    cromo: fis({ color: '#ffffff', metalness: 1, roughness: 0.12 }),
    grafite: fis({ color: '#2a2c32', metalness: 0.5, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    grafiteOpaca: fis({ color: '#1d1f24', metalness: 0.3, roughness: 0.6 }),
    bianco: fis({ color: '#eceae5', metalness: 0.04, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
    biancoGriglia: fis({ color: '#d9d8d4', metalness: 0.1, roughness: 0.5 }),
    gomma: fis({ color: '#121215', metalness: 0, roughness: 0.55 }),
    cavo: fis({ color: '#0e0e11', metalness: 0, roughness: 0.38, clearcoat: 0.4 }),
    rame: fis({ color: '#d58a58', metalness: 1, roughness: 0.28 }),
    ottone: fis({ color: '#e0b25e', metalness: 1, roughness: 0.22 }),
    oro: fis({ color: '#e6b25c', metalness: 1, roughness: 0.18, clearcoat: 0.4 }),
    cemento: fis({ color: '#8f8b86', metalness: 0, roughness: 0.82 }),
    ceramica: fis({ color: '#4a2a22', metalness: 0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.14 }),
    trasformatore: fis({ color: '#7f868d', metalness: 0.45, roughness: 0.4, clearcoat: 0.5 }),
    ledVerde: new THREE.MeshBasicMaterial({ color: new THREE.Color('#4dff9a').multiplyScalar(4) }),
    ledAmbra: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3) }),
    lucOro: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(5) }),
    nero: fis({ color: '#08080a', metalness: 0.2, roughness: 0.4 }),
  });
  return M;
}

// ---------- pezzi meccanici ----------
// bullone esagonale con rondella: asse lungo +Y, base a y=0
export function geoBullone(r = 0.01) {
  const ron = new THREE.CylinderGeometry(r * 1.55, r * 1.55, r * 0.28, 20); ron.translate(0, r * 0.14, 0);
  const tes = new THREE.CylinderGeometry(r, r, r * 0.75, 6); tes.translate(0, r * 0.28 + r * 0.375, 0);
  const smu = new THREE.CylinderGeometry(r * 0.82, r, r * 0.12, 6); smu.translate(0, r * 0.28 + r * 0.81, 0);
  const gam = new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 0.5, 12); gam.translate(0, r * 0.28 + r * 0.75 + r * 0.25, 0);
  return mergeGeometries([ron, tes, smu, gam].map(g => g.toNonIndexed ? g.toNonIndexed() : g));
}

// tante istanze orientate: lista di { p: Vector3, n: Vector3 (direzione asse), s: scala }
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
export function istanze(geo, mat, lista, { ombra = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, lista.length);
  lista.forEach((it, i) => {
    _q.setFromUnitVectors(_Y, (it.n || _Y).clone().normalize());
    if (it.rot) _q.multiply(new THREE.Quaternion().setFromAxisAngle(_Y, it.rot));
    const s = it.s ?? 1; _s.set(s, s, s);
    _m.compose(it.p, _q, _s); im.setMatrixAt(i, _m);
  });
  im.castShadow = ombra; im.receiveShadow = true;
  return im;
}

// profilo a I (HEA/IPE) estruso lungo Y, base a y=0
export function geoProfiloI(b, h, tw, tf, lung, smusso = 0.003) {
  const s = new THREE.Shape();
  const x0 = -b / 2, x1 = b / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y0 + tf); s.lineTo(tw / 2, y0 + tf); s.lineTo(tw / 2, y1 - tf);
  s.lineTo(x1, y1 - tf); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y1 - tf); s.lineTo(-tw / 2, y1 - tf);
  s.lineTo(-tw / 2, y0 + tf); s.lineTo(x0, y0 + tf); s.lineTo(x0, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: lung - smusso * 2, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso * 0.6, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, smusso); g.rotateX(-Math.PI / 2);
  return g;
}

// profilo a C / omega estruso lungo X
export function geoProfiloC(b, h, t, lung) {
  const s = new THREE.Shape();
  s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(b / 2, h); s.lineTo(b / 2 - t, h); s.lineTo(b / 2 - t, t);
  s.lineTo(-b / 2 + t, t); s.lineTo(-b / 2 + t, h); s.lineTo(-b / 2, h); s.lineTo(-b / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: lung, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0012, bevelSegments: 1 });
  g.translate(0, 0, -lung / 2); g.rotateY(Math.PI / 2);
  return g;
}

// flangia con foratura: disco forato + bulloni (asse lungo Y)
export function flangia(rEst, rInt, spess, nBulloni, mat, matBul, rBul = null) {
  const gr = new THREE.Group();
  const prof = [new THREE.Vector2(rInt, 0), new THREE.Vector2(rEst - spess * 0.15, 0), new THREE.Vector2(rEst, spess * 0.15),
    new THREE.Vector2(rEst, spess * 0.85), new THREE.Vector2(rEst - spess * 0.15, spess), new THREE.Vector2(rInt, spess)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), mat); m.castShadow = m.receiveShadow = true; gr.add(m);
  const rb = rBul ?? (rEst - (rEst - rInt) * 0.35), lista = [];
  for (let i = 0; i < nBulloni; i++) {
    const a = (i / nBulloni) * Math.PI * 2;
    lista.push({ p: new THREE.Vector3(Math.cos(a) * rb, spess, Math.sin(a) * rb), n: _Y, rot: a });
  }
  gr.add(istanze(geoBullone((rEst - rInt) * 0.13), matBul, lista));
  return gr;
}

// cavo morbido che passa per dei punti
export function cavo(punti, r, mat, seg = 64) {
  const c = new THREE.CatmullRomCurve3(punti, false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 10, false), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}

export function box(w, h, d, mat, r = 0.004, seg = 2) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}

export function cil(rt, rb, h, mat, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = m.receiveShadow = true; return m;
}

// ---------- texture ----------
// pannello: 6 × 12 celle half-cut, busbar argento, vetro blu-nero
export function texCelle() {
  return texDaCanvas(1024, 2048, (g, w, h) => {
    g.fillStyle = '#c9ced6'; g.fillRect(0, 0, w, h);
    const cx = 6, cy = 12, m = 22, gap = 7;
    const cw = (w - m * 2 - gap * (cx - 1)) / cx, ch = (h - m * 2 - gap * (cy - 1) - 16) / cy;
    const r = rng(3);
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      const x = m + i * (cw + gap), y = m + j * (ch + gap) + (j >= cy / 2 ? 16 : 0);
      for (let k = 0; k < 2; k++) { // mezza cella
        const hy = y + k * (ch / 2 + 1), hh = ch / 2 - 1;
        const gr = g.createLinearGradient(x, hy, x + cw, hy + hh);
        const v = r() * 6;
        gr.addColorStop(0, `rgb(${14 + v},${22 + v},${48 + v})`); gr.addColorStop(1, `rgb(${10 + v},${16 + v},${38 + v})`);
        g.fillStyle = gr; g.fillRect(x, hy, cw, hh);
      }
      g.fillStyle = 'rgba(190,198,212,0.55)';
      for (let b = 1; b <= 10; b++) g.fillRect(x + (cw * b) / 11 - 0.6, y, 1.2, ch);
      g.fillStyle = 'rgba(160,170,190,0.12)';
      for (let f = 0; f < ch; f += 6) g.fillRect(x, y + f, cw, 0.5);
    }
    g.fillStyle = 'rgba(200,205,215,0.9)'; g.fillRect(m, h / 2 - 4, w - m * 2, 8);
  });
}

// quadrante da orologio per il piano delle isole
export function texQuadrante(oro = '#d6a85a') {
  return texDaCanvas(2048, 2048, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, '#24222c'); gr.addColorStop(0.75, '#18171e'); gr.addColorStop(1, '#121118');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1.2;
    for (let r = 40; r < c; r += 26) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = oro;
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2, lung = i % 20 === 0 ? 46 : i % 5 === 0 ? 26 : 12;
      g.globalAlpha = i % 20 === 0 ? 0.85 : 0.45; g.lineWidth = i % 20 === 0 ? 3 : 1.5;
      g.beginPath(); g.moveTo(c + Math.cos(a) * (c - 18), c + Math.sin(a) * (c - 18));
      g.lineTo(c + Math.cos(a) * (c - 18 - lung), c + Math.sin(a) * (c - 18 - lung)); g.stroke();
    }
    g.globalAlpha = 0.5; g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 90, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  });
}

// ghiaia fine (piazzola BESS), stilizzata
export function texGhiaia() {
  return texDaCanvas(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3e3e44'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 26000; i++) {
      const v = 52 + r() * 70, x = r() * w, y = r() * h, s = 1 + r() * 2.6;
      g.fillStyle = `rgb(${v},${v - 2},${v + 4})`; g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { ripeti: [5, 5] });
}

// rete della recinzione (maglia romboidale) con trasparenza
export function texRete() {
  const t = texDaCanvas(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w); g.strokeStyle = '#d5d8dc'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, w); g.moveTo(w, 0); g.lineTo(0, w); g.stroke();
  }, { srgb: true });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// lamiera con pannelli/giunti per i container (mappa di rilievo)
export function texGiunti(colonne = 4) {
  return texDaCanvas(1024, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5a5a';
    for (let i = 1; i < colonne; i++) g.fillRect((w * i) / colonne - 2, 0, 4, h);
    g.fillRect(0, 10, w, 3); g.fillRect(0, h - 13, w, 3);
  }, { srgb: false });
}

// somma additiva che NON tocca l'alfa (altrimenti l'alfa cresce oltre 1 e il bloom esplode in Inf/NaN)
export const ADDITIVO = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false,
};
