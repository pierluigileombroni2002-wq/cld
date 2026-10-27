// Materiali nobili e credibili, condivisi da tutte le macchine: pochi, trattenuti, con riflessi veri dalla mappa d'ambiente.
import * as THREE from 'three';

export const MAT = {
  alluminio: new THREE.MeshStandardMaterial({ color: '#c8c2b4', metalness: 0.85, roughness: 0.38, envMapIntensity: 1.0 }),
  acciaio: new THREE.MeshStandardMaterial({ color: '#8d8a86', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.1 }),
  acciaioScuro: new THREE.MeshStandardMaterial({ color: '#4d4a4c', metalness: 0.85, roughness: 0.5, envMapIntensity: 0.9 }),
  inox: new THREE.MeshStandardMaterial({ color: '#d8d5cf', metalness: 1.0, roughness: 0.22, envMapIntensity: 1.2 }),
  bronzo: new THREE.MeshStandardMaterial({ color: '#a8885a', metalness: 0.95, roughness: 0.32, envMapIntensity: 1.1 }),
  grafite: new THREE.MeshStandardMaterial({ color: '#45404a', metalness: 0.55, roughness: 0.5, envMapIntensity: 0.9 }),
  vernicePerla: new THREE.MeshStandardMaterial({ color: '#efe4d2', metalness: 0.1, roughness: 0.5, envMapIntensity: 0.55 }),
  verniceScura: new THREE.MeshStandardMaterial({ color: '#2f2a33', metalness: 0.3, roughness: 0.6, envMapIntensity: 0.7 }),
  retroModulo: new THREE.MeshStandardMaterial({ color: '#f0ece4', metalness: 0.0, roughness: 0.8 }),
  oroLuce: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  vetroModulo: null, // creato sotto con la trama delle celle
};

// Trama delle celle fotovoltaiche: celle blu notte smussate, busbar argento, dita sottili. Solo per i primi piani.
export function texturaCelle(colonne = 6, righe = 12) {
  const w = 512, h = 1024;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#1c1d26'; g.fillRect(0, 0, w, h);
  const cw = w / colonne, ch = h / righe, gap = 3, sm = 7;
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    const x = c * cw + gap, y = r * ch + gap, ww = cw - gap * 2, hh = ch - gap * 2;
    const grad = g.createLinearGradient(x, y, x + ww, y + hh);
    grad.addColorStop(0, '#0d1c44'); grad.addColorStop(1, '#0a1534');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x + sm, y); g.lineTo(x + ww - sm, y); g.lineTo(x + ww, y + sm); g.lineTo(x + ww, y + hh - sm);
    g.lineTo(x + ww - sm, y + hh); g.lineTo(x + sm, y + hh); g.lineTo(x, y + hh - sm); g.lineTo(x, y + sm); g.closePath();
    g.fill();
    // dita sottili
    g.strokeStyle = 'rgba(200,210,230,0.16)'; g.lineWidth = 1;
    for (let f = 6; f < hh; f += 7) { g.beginPath(); g.moveTo(x + 2, y + f); g.lineTo(x + ww - 2, y + f); g.stroke(); }
    // busbar
    g.strokeStyle = 'rgba(225,228,235,0.75)'; g.lineWidth = 2;
    for (let b = 1; b <= 3; b++) { const bx = x + (ww * b) / 4; g.beginPath(); g.moveTo(bx, y + 1); g.lineTo(bx, y + hh - 1); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

MAT.vetroModulo = new THREE.MeshPhysicalMaterial({
  map: texturaCelle(), color: '#ffffff', metalness: 0.05, roughness: 0.3,
  clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9,
});

// Geometrie minute riusate ovunque (bulloni, flange): una sola geometria, tante istanze.
export const GEO = {
  bullone: new THREE.CylinderGeometry(0.02, 0.02, 0.014, 6),
  bulloneGrande: new THREE.CylinderGeometry(0.035, 0.035, 0.024, 6),
};

// Dispone N bulloni su una circonferenza, nel piano scelto; restituisce le matrici per un InstancedMesh.
export function bulloniInCerchio(n, raggio, { y = 0, asse = 'y' } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * raggio, y, Math.sin(a) * raggio);
    const q = new THREE.Quaternion();
    if (asse === 'z') { p.set(Math.cos(a) * raggio, Math.sin(a) * raggio, y); q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); }
    if (asse === 'x') { p.set(y, Math.cos(a) * raggio, Math.sin(a) * raggio); q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); }
    out.push({ pos: p, quat: q });
  }
  return out;
}

export function istanze(geo, mat, trasformazioni) {
  const m = new THREE.InstancedMesh(geo, mat, trasformazioni.length);
  const mat4 = new THREE.Matrix4(), s1 = new THREE.Vector3(1, 1, 1);
  trasformazioni.forEach((t, i) => { mat4.compose(t.pos, t.quat || new THREE.Quaternion(), t.scala || s1); m.setMatrixAt(i, mat4); });
  m.instanceMatrix.needsUpdate = true;
  return m;
}
