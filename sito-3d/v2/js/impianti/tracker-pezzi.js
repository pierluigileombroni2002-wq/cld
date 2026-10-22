// =============================================================================
// ERI v2 · impianti/tracker-pezzi.js — file PRIVATO del pacchetto FV (regola 0.1 di ARCHITETTURA.md)
// Usato solo da impianti/tracker.js: geometrie dei pezzi del tracker, IN METRI (gruppo / istanze × 0,1).
// Specifica: DESIGN §6.6 (modulo, tubo di torsione, palo a profilo H, cuscinetto, motoriduttore con ralla, controllore),
// config.LAYOUT.pezzi e config.LAYOUT.modulo. Origine: asse di rotazione (moduli, tubo, cuscinetti, motore) oppure
// piede del palo al livello del suolo (pali). Asse del tracker lungo z.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from '../config.js';

const PZ = LAYOUT.pezzi, MOD = LAYOUT.modulo;
// TARATURA: proporre in config (LAYOUT.pezzi) — dettagli non scritti in DESIGN
const H_ALA = 0.012, H_ANIMA = 0.008;     // spessori di ali e anima del profilo H (m)
const INTERRATO = 0.5;                    // parte del palo sotto il suolo (m): niente fessure col terreno
const SELLA = [0.16, 0.05, 0.10];         // staffa del cuscinetto sulla testa del palo (m)
const MOTORE_X = 0.26, MOTORE_Y = -0.02;  // centro della scatola del motoriduttore accanto alla ralla (m)
const RALLA_L = 0.14;                     // spessore della ralla lungo l'asse (m)
export const CONTROLLORE = { quotaM: 1.0, z: 0.12 };   // centro del controllore: 1 m dal suolo, sulla faccia sud del palo

/** Modulo: box 2,384 × 0,035 × 1,134 m, centro a +0,10 m sull'asse; tre gruppi [telaio (lati), fronte, retro]. */
export function geoModulo() {
  const [L, s, W] = PZ.modulo;
  const g = new THREE.BoxGeometry(L, s, W);
  g.translate(0, MOD.sopraAsseM, 0);
  // BoxGeometry ha 6 gruppi (px, nx, py, ny, pz, nz): li riordino in 3 (lati, +y, −y) → 3 chiamate invece di 6
  const idx = g.index.array, nuovo = [];
  const prendi = i => { const G = g.groups[i]; for (let k = 0; k < G.count; k++) nuovo.push(idx[G.start + k]); };
  [0, 1, 4, 5].forEach(prendi); const nLati = nuovo.length; prendi(2); prendi(3);
  g.setIndex(nuovo); g.clearGroups();
  g.addGroup(0, nLati, 0); g.addGroup(nLati, 6, 1); g.addGroup(nLati + 6, 6, 2);
  return g;
}

/** Tubo di torsione: box 0,12 × 0,12 m lungo z (lunghezza 1 = da scalare nell'istanza). */
export function geoTubo(lunghezzaM = 1) {
  return new THREE.BoxGeometry(PZ.tubo[0], PZ.tubo[1], lunghezzaM);
}

/** Palo: profilo H 0,12 × 0,12 m estruso in verticale, dal piede interrato fino alla testa (testaM sopra il suolo). */
export function geoPalo(testaM) {
  const [b, h] = PZ.palo.profilo, a = H_ALA, w = H_ANIMA / 2;
  const s = new THREE.Shape();
  s.moveTo(-b / 2, -h / 2); s.lineTo(b / 2, -h / 2); s.lineTo(b / 2, -h / 2 + a); s.lineTo(w, -h / 2 + a);
  s.lineTo(w, h / 2 - a); s.lineTo(b / 2, h / 2 - a); s.lineTo(b / 2, h / 2); s.lineTo(-b / 2, h / 2);
  s.lineTo(-b / 2, h / 2 - a); s.lineTo(-w, h / 2 - a); s.lineTo(-w, -h / 2 + a); s.lineTo(-b / 2, -h / 2 + a);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: testaM + INTERRATO, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, -INTERRATO, 0);
  g.clearGroups();
  return g;
}

/** Cuscinetto: toro (0,09; 0,025) attorno all'asse più la sella che lo appoggia sulla testa del palo (0,10 m sotto l'asse). */
export function geoCuscinetto() {
  const [R, r] = PZ.cuscinetto.toro;
  const toro = new THREE.TorusGeometry(R, r, 4, 10);   // pochi lati: ~2 300 istanze nel campo FV
  const sella = new THREE.BoxGeometry(SELLA[0], SELLA[1], SELLA[2]);
  sella.translate(0, -(MOD.sopraAsseM + SELLA[1] / 2) + 0.005, 0);
  const g = mergeGeometries([toro, sella], false);
  toro.dispose(); sella.dispose();
  return g;
}

/** Ralla (cilindro Ø 0,30 m attorno all'asse) più la scatola del motoriduttore 0,35 × 0,30 × 0,25 m. */
function motoriduttore() {
  const ralla = new THREE.CylinderGeometry(PZ.motoriduttore.ralla / 2, PZ.motoriduttore.ralla / 2, RALLA_L, 14);
  ralla.rotateX(Math.PI / 2);
  const [bx, by, bz] = PZ.motoriduttore.box;
  const scatola = new THREE.BoxGeometry(bx, by, bz);
  scatola.translate(MOTORE_X, MOTORE_Y, 0);
  const g = mergeGeometries([ralla, scatola], false);
  ralla.dispose(); scatola.dispose();
  return g;
}
/** Centro della scatola del motoriduttore (m, dall'asse): ancora dell'etichetta. */
export const CENTRO_MOTORE = [MOTORE_X, MOTORE_Y, 0];

/** Controllore: box 0,30 × 0,40 × 0,12 m centrato nell'origine. */
export function geoControllore() {
  const [x, y, z] = PZ.controllore;
  return new THREE.BoxGeometry(x, y, z);
}

/**
 * Motoriduttore del tracker eroe (un solo materiale, acciaio) oppure, con asseM, quello delle istanze del campo:
 * due gruppi [acciaio, scatola verniciata] con il controllore sul palo centrale a 1 m dal suolo.
 * @param {number} [asseM] quota dell'asse sul suolo (m)
 */
export function geoMotore(asseM) {
  const m = motoriduttore();
  if (asseM == null) { const g = toCreasedNormals(m, Math.PI / 6); m.dispose(); return g; }
  const c = geoControllore();
  c.translate(0, CONTROLLORE.quotaM - asseM, CONTROLLORE.z);
  const u = mergeGeometries([m, c], true);
  m.dispose(); c.dispose();
  const g = toCreasedNormals(u, Math.PI / 6);
  if (g !== u) u.dispose();
  return g;
}
