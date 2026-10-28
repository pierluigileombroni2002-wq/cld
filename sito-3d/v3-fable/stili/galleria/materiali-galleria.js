// I materiali condivisi (macchine/materiali.js) rivestiti per la Galleria Bianca:
// acciaio zincato chiaro e satinato, vetro antracite blu con la striscia della finestra, lamiera bianco caldo, ghisa grigia.
// Niente oro. Il rame del logo resta solo sulle busbar delle celle, in primo piano.
import * as THREE from 'three';
import { MAT } from '../../macchine/materiali.js';

function imposta(m, { color, metalness, roughness, envMapIntensity }) {
  if (color !== undefined) m.color.set(color);
  if (metalness !== undefined) m.metalness = metalness;
  if (roughness !== undefined) m.roughness = roughness;
  if (envMapIntensity !== undefined) m.envMapIntensity = envMapIntensity;
  m.needsUpdate = true;
}

// Celle antracite blu, busbar in rame vero, dita sottili: la trama si vede solo nei primi piani.
function texturaCelleGalleria(colonne = 6, righe = 12) {
  const w = 512, h = 1024;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#242A31'; g.fillRect(0, 0, w, h);
  const cw = w / colonne, ch = h / righe, gap = 3, sm = 7;
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    const x = c * cw + gap, y = r * ch + gap, ww = cw - gap * 2, hh = ch - gap * 2;
    const grad = g.createLinearGradient(x, y, x + ww, y + hh);
    grad.addColorStop(0, '#182129'); grad.addColorStop(1, '#111920');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x + sm, y); g.lineTo(x + ww - sm, y); g.lineTo(x + ww, y + sm); g.lineTo(x + ww, y + hh - sm);
    g.lineTo(x + ww - sm, y + hh); g.lineTo(x + sm, y + hh); g.lineTo(x, y + hh - sm); g.lineTo(x, y + sm); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(190,200,214,0.09)'; g.lineWidth = 1;
    for (let f = 6; f < hh; f += 7) { g.beginPath(); g.moveTo(x + 2, y + f); g.lineTo(x + ww - 2, y + f); g.stroke(); }
    g.strokeStyle = 'rgba(214,150,112,0.42)'; g.lineWidth = 1.5;
    for (let b = 1; b <= 3; b++) { const bx = x + (ww * b) / 4; g.beginPath(); g.moveTo(bx, y + 1); g.lineTo(bx, y + hh - 1); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function rivestiMateriali() {
  imposta(MAT.alluminio,    { color: '#C9C8C2', metalness: 0.9,  roughness: 0.42, envMapIntensity: 1.1 });
  imposta(MAT.acciaio,      { color: '#B9B7B1', metalness: 0.9,  roughness: 0.4,  envMapIntensity: 1.1 });
  imposta(MAT.acciaioScuro, { color: '#A8A6A0', metalness: 0.85, roughness: 0.55, envMapIntensity: 1.0 });
  imposta(MAT.inox,         { color: '#D6D4CF', metalness: 1.0,  roughness: 0.3,  envMapIntensity: 1.2 });
  imposta(MAT.bronzo,       { color: '#B4B2AC', metalness: 0.9,  roughness: 0.45, envMapIntensity: 1.0 }); // bulloni e minuterie: acciaio, non oro
  imposta(MAT.grafite,      { color: '#3E4247', metalness: 0.5,  roughness: 0.6,  envMapIntensity: 0.9 });
  imposta(MAT.vernicePerla, { color: '#ECE8E0', metalness: 0.05, roughness: 0.5,  envMapIntensity: 0.6 });
  imposta(MAT.verniceScura, { color: '#3E4247', metalness: 0.3,  roughness: 0.6,  envMapIntensity: 0.7 });
  imposta(MAT.retroModulo,  { color: '#EDEAE3', metalness: 0.0,  roughness: 0.8 });
  // le righe dell'agrivoltaico: da fili d'oro a segni sottili tracciati a terra
  MAT.oroLuce.color.set('#A8A196'); MAT.oroLuce.blending = THREE.NormalBlending; MAT.oroLuce.opacity = 0.5; MAT.oroLuce.toneMapped = false; MAT.oroLuce.needsUpdate = true;
  // il vetro dei moduli: antracite blu, riflesso netto della finestra
  const v = MAT.vetroModulo;
  if (v.map) v.map.dispose();
  v.map = texturaCelleGalleria();
  v.color.set('#ffffff'); v.metalness = 0.1; v.roughness = 0.24; v.clearcoat = 1.0; v.clearcoatRoughness = 0.08; v.envMapIntensity = 1.0;
  v.needsUpdate = true;
}

// Dopo la creazione delle macchine: i pochi materiali creati dentro i moduli (led d'oro, filo d'oro, schermo) si adeguano alla sala.
export function rivestiScena(scena) {
  const daTogliere = [];
  scena.traverse((o) => {
    const m = o.material;
    if (!m || Array.isArray(m)) return;
    if (m.isShaderMaterial && m.uniforms && m.uniforms.intensita && m.uniforms.colore) {
      // il filo d'oro del BESS: tolto dalla scena (la sala non ha bagliori; e sulla tela trasparente l'additivo lascerebbe un segno scuro)
      m.uniforms.intensita.value = 0; daTogliere.push(o);
    } else if (m.isMeshBasicMaterial && m.color && !m.map) {
      const hex = m.color.getHexString();
      if (hex === 'ffd27a') m.color.set('#FFFFFF');          // i led dei rack: bianchi, senza alone
      if (hex === '2a2a40') m.color.set('#2E3136');          // lo schermo del PCS
      if (hex === 'dfeeff') { m.opacity = 0.55; m.blending = THREE.NormalBlending; m.color.set('#E8F0F6'); } // il getto della Pelton: un filo d'acqua chiaro, non un bagliore
    } else if (m.isMeshStandardMaterial && !Object.values(MAT).includes(m) && !m.userData.proprio) {
      // (i materiali propri del BESS e delle turbine di galleria, segnati con userData.proprio, restano come sono)
      // materiali inline (pale Francis, condotto Kaplan): stessa famiglia
      if (m.metalness >= 0.9) { m.color.set('#D6D4CF'); m.roughness = 0.3; m.envMapIntensity = 1.2; }
      else { m.color.set('#ECE8E0'); m.roughness = 0.5; m.envMapIntensity = 0.6; }
      m.needsUpdate = true;
    }
  });
  for (const o of daTogliere) if (o.parent) o.parent.remove(o);
}
