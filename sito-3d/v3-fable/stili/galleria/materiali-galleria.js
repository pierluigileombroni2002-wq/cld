// I materiali condivisi (macchine/materiali.js) rivestiti per la Galleria Bianca:
// acciaio zincato chiaro e satinato, vetro antracite blu con la striscia della finestra che scorre, lamiera bianco caldo, ghisa grigia.
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

// Celle antracite blu, busbar in rame vero (tre per cella, ben leggibili), dita sottili.
function texturaCelleGalleria(colonne = 6, righe = 12) {
  const w = 512, h = 1024;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#182230'; g.fillRect(0, 0, w, h);
  const cw = w / colonne, ch = h / righe, gap = 3, sm = 7;
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    const x = c * cw + gap, y = r * ch + gap, ww = cw - gap * 2, hh = ch - gap * 2;
    const grad = g.createLinearGradient(x, y, x + ww, y + hh);
    grad.addColorStop(0, '#0F1A26'); grad.addColorStop(1, '#0B1420');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x + sm, y); g.lineTo(x + ww - sm, y); g.lineTo(x + ww, y + sm); g.lineTo(x + ww, y + hh - sm);
    g.lineTo(x + ww - sm, y + hh); g.lineTo(x + sm, y + hh); g.lineTo(x, y + hh - sm); g.lineTo(x, y + sm); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(190,200,214,0.11)'; g.lineWidth = 1;
    for (let f = 6; f < hh; f += 7) { g.beginPath(); g.moveTo(x + 2, y + f); g.lineTo(x + ww - 2, y + f); g.stroke(); }
    g.strokeStyle = 'rgba(206,132,88,0.85)'; g.lineWidth = 3;
    for (let b = 1; b <= 3; b++) { const bx = x + (ww * b) / 4; g.beginPath(); g.moveTo(bx, y + 1); g.lineTo(bx, y + hh - 1); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// La striscia di luce della finestra sul vetro: una banda diagonale in coordinate di mondo che scorre con lo scorrimento.
const faseVetro = { value: 0 };
export function setFaseVetro(x) { faseVetro.value = x; }
export function vetroModulo() { return MAT.vetroModulo; } // per le misure (strumenti)
function striscia(sh) {
  sh.uniforms.uFaseVetro = faseVetro;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPosG;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wpg = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nwpg = instanceMatrix * wpg;\n#endif\nwpg = modelMatrix * wpg; vPosG = wpg.xyz; }');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPosG; uniform float uFaseVetro;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float dg = vPosG.x * 0.8 + vPosG.z * 0.6 - uFaseVetro; float bg = exp(-dg * dg * 0.22); totalEmissiveRadiance += vec3(0.984, 0.976, 0.957) * bg * 0.62; }');
}

export function rivestiMateriali() {
  imposta(MAT.alluminio,    { color: '#C9C8C2', metalness: 0.9,  roughness: 0.4,  envMapIntensity: 1.3 });
  imposta(MAT.acciaio,      { color: '#B9B7B1', metalness: 0.9,  roughness: 0.38, envMapIntensity: 1.3 });
  imposta(MAT.acciaioScuro, { color: '#A8A6A0', metalness: 0.85, roughness: 0.52, envMapIntensity: 1.15 });
  imposta(MAT.inox,         { color: '#D6D4CF', metalness: 1.0,  roughness: 0.28, envMapIntensity: 1.4 });
  imposta(MAT.bronzo,       { color: '#B4B2AC', metalness: 0.9,  roughness: 0.45, envMapIntensity: 1.1 }); // bulloni e minuterie: acciaio, non oro
  imposta(MAT.grafite,      { color: '#3E4247', metalness: 0.5,  roughness: 0.6,  envMapIntensity: 0.9 });
  imposta(MAT.vernicePerla, { color: '#ECE8E0', metalness: 0.05, roughness: 0.5,  envMapIntensity: 0.6 });
  imposta(MAT.verniceScura, { color: '#3E4247', metalness: 0.3,  roughness: 0.6,  envMapIntensity: 0.7 });
  imposta(MAT.retroModulo,  { color: '#EDEAE3', metalness: 0.0,  roughness: 0.8 });
  // le righe dell'agrivoltaico: da fili d'oro a segni sottili tracciati a terra
  MAT.oroLuce.color.set('#A8A196'); MAT.oroLuce.blending = THREE.NormalBlending; MAT.oroLuce.opacity = 0.5; MAT.oroLuce.toneMapped = false; MAT.oroLuce.needsUpdate = true;
  // il vetro dei moduli: antracite blu, riflesso netto della finestra e la striscia di luce che scorre
  const v = MAT.vetroModulo;
  if (v.map) v.map.dispose();
  v.map = texturaCelleGalleria();
  // (metalness alta: il vetro antracite risponde poco alla luce diffusa e riflette la sala con la sua tinta scura; il clearcoat dà solo un velo)
  v.color.set('#ffffff'); v.metalness = 0.65; v.roughness = 0.32; v.clearcoat = 0.35; v.clearcoatRoughness = 0.12; v.envMapIntensity = 0.9;
  v.onBeforeCompile = striscia;
  v.customProgramCacheKey = () => 'vetro-galleria-striscia';
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
