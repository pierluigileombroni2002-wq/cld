// Materiali per "Linea di Luce": si prendono quelli condivisi (../../macchine/materiali.js) e si rivestono
// in satinato grafite e acciaio: niente oro, niente perla. Il vetro dei moduli diventa quasi nero, celle appena visibili.
// Qui nascono anche i pochi materiali propri dello stile: la lamiera grecata dei container, il rame spento dell'ugello
// Pelton, la ghisa delle casse. Ogni materiale riceve la rivelazione (fronte di materia lungo x).
import * as THREE from 'three';
import { MAT } from '../../macchine/materiali.js';
import { iniettaRivelazione } from './linee.js';

// Trama delle celle: grafite scura su cornice anodizzata, dita quasi invisibili, busbar grigie.
export function texturaCelleScure(colonne = 6, righe = 12) {
  const w = 512, h = 1024;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#26292d'; g.fillRect(0, 0, w, h);
  const cw = w / colonne, ch = h / righe, gap = 3, sm = 7;
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    const x = c * cw + gap, y = r * ch + gap, ww = cw - gap * 2, hh = ch - gap * 2;
    const grad = g.createLinearGradient(x, y, x + ww, y + hh);
    grad.addColorStop(0, '#1d2125'); grad.addColorStop(1, '#14171a');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x + sm, y); g.lineTo(x + ww - sm, y); g.lineTo(x + ww, y + sm); g.lineTo(x + ww, y + hh - sm);
    g.lineTo(x + ww - sm, y + hh); g.lineTo(x + sm, y + hh); g.lineTo(x, y + hh - sm); g.lineTo(x, y + sm); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(200,206,214,0.07)'; g.lineWidth = 1;
    for (let f = 6; f < hh; f += 7) { g.beginPath(); g.moveTo(x + 2, y + f); g.lineTo(x + ww - 2, y + f); g.stroke(); }
    g.strokeStyle = 'rgba(205,210,216,0.38)'; g.lineWidth = 2;
    for (let b = 1; b <= 3; b++) { const bx = x + (ww * b) / 4; g.beginPath(); g.moveTo(bx, y + 1); g.lineTo(bx, y + hh - 1); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Mappa normale della lamiera grecata: onde verticali (lungo u), come la parete di un container.
// Una sola trama per tutte le facce del parallelepipedo: sul fronte lungo le greche hanno il passo giusto (~22 cm).
export function normaleGrecata(onde = 28) {
  const w = 1024, h = 8;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const fase = (x / w) * onde * Math.PI * 2;
    // profilo trapezoidale smussato: fianchi inclinati, piani in cima e in fondo
    const s = Math.sin(fase);
    const nx = Math.max(-1, Math.min(1, s * 2.2)) * 0.55;
    const nz = Math.sqrt(1 - nx * nx);
    const r = Math.round((nx * 0.5 + 0.5) * 255), b = Math.round((nz * 0.5 + 0.5) * 255);
    for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = 128; img.data[i + 2] = b; img.data[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const PALETTE = {
  alluminio: ['#2a2d31', 0.8, 0.42, 1.0],      // cornici anodizzate grafite
  acciaio: ['#a3a8ad', 0.95, 0.3, 1.35],       // acciaio spazzolato: riflette i softbox
  acciaioScuro: ['#2b2e32', 0.6, 0.62, 0.8],   // pali e assi verniciati grigio scuro opaco
  inox: ['#c6cace', 1.0, 0.2, 1.5],
  bronzo: ['#8c9196', 0.9, 0.42, 1.0],         // bulloni in acciaio: niente oro
  grafite: ['#232528', 0.5, 0.58, 0.8],
  vernicePerla: ['#9a9ea2', 0.3, 0.4, 1.3],    // lamiera verniciata grigio osso spento, con un vero gradiente di luce
  verniceScura: ['#777b80', 0.4, 0.5, 0.9],    // i moduli nei rack: si leggono dietro le porte aperte
  retroModulo: ['#d6d3cd', 0.0, 0.85, 0.4],
};

// Materiali propri dello stile (già "pronti": vestiGruppo non li ricolora, li inietta soltanto).
export const MAT_LINEA_STILE = {
  grecata: null,
  rame: new THREE.MeshStandardMaterial({ color: '#9a6a4e', metalness: 0.9, roughness: 0.42, envMapIntensity: 1.25 }),
  ghisa: new THREE.MeshStandardMaterial({ color: '#3b3e42', metalness: 0.55, roughness: 0.58, envMapIntensity: 0.9 }),
};
for (const m of Object.values(MAT_LINEA_STILE)) if (m) m.userData.pronto = true;

export function vestiMaterialiCondivisi() {
  for (const [nome, [colore, metalness, roughness, env]] of Object.entries(PALETTE)) {
    const m = MAT[nome]; if (!m) continue;
    m.color.set(colore); m.metalness = metalness; m.roughness = roughness; m.envMapIntensity = env;
  }
  MAT.oroLuce.color.set('#eef2f5'); MAT.oroLuce.opacity = 0.1; // righe di coltura: segni bianchi appena accennati
  const v = MAT.vetroModulo;
  if (v.map) v.map.dispose();
  v.map = texturaCelleScure(); v.color.set('#ffffff');
  v.metalness = 0.1; v.roughness = 0.32; v.clearcoat = 0.7; v.clearcoatRoughness = 0.18; v.envMapIntensity = 1.15;
  v.needsUpdate = true;
  if (!MAT_LINEA_STILE.grecata) {
    const g = MAT.vernicePerla.clone();
    g.normalMap = normaleGrecata(); g.normalScale.set(0.9, 0.9);
    g.userData = { pronto: true };
    MAT_LINEA_STILE.grecata = g;
  }
}

// Riveste i materiali creati dentro le macchine (led, schermi, pale, condotti) e inietta la rivelazione in tutti.
export function vestiGruppo(gruppo) {
  const visti = new Set();
  const noti = new Set(Object.values(MAT));
  gruppo.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    const lista = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of lista) {
      if (!m || visti.has(m)) continue;
      visti.add(m);
      if (m.isShaderMaterial) { m.visible = false; continue; }            // il filo d'oro del BESS: qui non c'è oro
      if (!noti.has(m) && !m.userData.pronto) {
        if (m.isMeshStandardMaterial) {
          const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
          if (lum > 0.6) {
            if (m.metalness > 0.7) { m.color.set('#c6cace'); m.roughness = Math.min(m.roughness, 0.24); m.envMapIntensity = 1.5; } // pale della Francis: inox
            else { m.color.set('#4a4e53'); m.metalness = 0.55; m.roughness = 0.5; m.envMapIntensity = 0.95; }                     // condotto Kaplan: ghisa
          } else m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 1.0);
        } else if (m.isMeshBasicMaterial && !m.map) {
          if (m.blending === THREE.AdditiveBlending) m.color.set('#dfe8f0');  // il getto della Pelton: luce fredda
          else m.color.set(m.color.r > 0.6 ? '#eef2f5' : '#1a1b1e');         // led bianchi, schermo spento
        }
      }
      iniettaRivelazione(m, m.transparent ? 'alpha' : 'solido');
    }
  });
}
