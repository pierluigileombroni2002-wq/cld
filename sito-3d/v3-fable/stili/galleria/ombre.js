// Ombre di contatto dipinte (nessuna shadow map) e il disegno a terra della fase "Sviluppo".
import * as THREE from 'three';

function texturaOmbra(larghezza = 256, altezza = 128) {
  const cv = document.createElement('canvas'); cv.width = larghezza; cv.height = altezza;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, larghezza, altezza);
  // un'ellisse morbida: più densa al centro, sfumata fino a sparire
  g.save();
  g.translate(larghezza / 2, altezza / 2);
  g.scale(larghezza / 2, altezza / 2);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.45, 'rgba(0,0,0,0.6)'); r.addColorStop(0.8, 'rgba(0,0,0,0.12)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

let _tex = null;
const _geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// forme: [{ x, z, w, d, forza? }] nel sistema del gruppo. Restituisce { gruppo, set(k) } con k 0..1 = quanto è visibile.
export function creaOmbre(forme, { colore = '#6E685C', opacita = 0.36 } = {}) {
  _tex = _tex || texturaOmbra();
  const gruppo = new THREE.Group(); gruppo.name = 'ombre';
  const mat = new THREE.MeshBasicMaterial({ map: _tex, color: colore, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const forza = [];
  for (const f of forme) {
    const m = new THREE.Mesh(_geo, mat);
    m.position.set(f.x, 0.012, f.z);
    m.scale.set(f.w, 1, f.d);
    m.renderOrder = -4;
    gruppo.add(m);
    forza.push(f.forza ?? 1);
  }
  return {
    gruppo,
    set(k) {
      const o = Math.min(1, Math.max(0, k)) * opacita;
      mat.opacity = o;
      gruppo.visible = o > 0.002;
    },
  };
}

// Disegno a terra: rettangoli sottili con l'asse e i punti dei plinti, come una planimetria tracciata sul pavimento.
// rett: [{ x, z, w, d, pali?: [x...] }]
export function creaDisegno(rett, { colore = '#1C1B18', opacita = 0.35 } = {}) {
  const gruppo = new THREE.Group(); gruppo.name = 'disegno';
  const punti = [];
  const seg = (x1, z1, x2, z2) => { punti.push(x1, 0.02, z1, x2, 0.02, z2); };
  for (const r of rett) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
    // quota lunga sotto il rettangolo
    seg(x0, z1 + 0.9, x1, z1 + 0.9); seg(x0, z1 + 0.7, x0, z1 + 1.1); seg(x1, z1 + 0.7, x1, z1 + 1.1);
    // piccoli quadrati per i plinti
    for (const px of r.pali || []) {
      const s = 0.3;
      seg(r.x + px - s, r.z - s, r.x + px + s, r.z - s); seg(r.x + px + s, r.z - s, r.x + px + s, r.z + s);
      seg(r.x + px + s, r.z + s, r.x + px - s, r.z + s); seg(r.x + px - s, r.z + s, r.x + px - s, r.z - s);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(punti, 3));
  const mat = new THREE.LineBasicMaterial({ color: colore, transparent: true, opacity: opacita, depthWrite: false, toneMapped: false });
  const linee = new THREE.LineSegments(geo, mat);
  linee.renderOrder = -3;
  gruppo.add(linee);
  // l'asse di ogni fila: tratteggiato
  const puntiAsse = [];
  for (const r of rett) puntiAsse.push(r.x - r.w / 2, 0.02, r.z, r.x + r.w / 2, 0.02, r.z);
  const geoAsse = new THREE.BufferGeometry(); geoAsse.setAttribute('position', new THREE.Float32BufferAttribute(puntiAsse, 3));
  const asse = new THREE.LineSegments(geoAsse, new THREE.LineDashedMaterial({ color: colore, transparent: true, opacity: opacita * 0.8, dashSize: 0.5, gapSize: 0.35, depthWrite: false, toneMapped: false }));
  asse.computeLineDistances(); asse.renderOrder = -3;
  gruppo.add(asse);
  return {
    gruppo,
    set(k) {
      const o = Math.min(1, Math.max(0, k));
      linee.material.opacity = opacita * o; asse.material.opacity = opacita * 0.8 * o;
      gruppo.visible = o > 0.002;
    },
  };
}
