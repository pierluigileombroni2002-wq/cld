// La collezione del finale: davanti alla vetrata, piccole e lontane, le tre sculture in fila (un tracker, un container, la Francis),
// in controluce chiaro, come viste dall'ingresso. È la sola volta in cui si vedono insieme.
// Il tracker è una fila corta costruita qui con le stesse misure e gli stessi materiali di macchine/fotovoltaico.js;
// container e Francis sono quelli di galleria, con gli altri pezzi del blocco nascosti.
import * as THREE from 'three';
import { MAT, GEO } from '../../macchine/materiali.js';
import { creaBess, POSA } from './bess-galleria.js';
import { creaTurbine, DIST } from './turbine-galleria.js';
import { creaOmbre } from './ombre.js';

const MOD_W = 1.134, MOD_L = 2.278, MOD_T = 0.035, PASSO = 1.16;

function tracker(g, nMod = 5) {
  const L = nMod * PASSO, h = 2.1;
  const xPali = [-L / 2 + 0.7, L / 2 - 0.7];
  const pali = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, h, 0.16), MAT.acciaioScuro, 2);
  const piastre = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), MAT.acciaioScuro, 2);
  const cusc = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.26, 0.3), MAT.acciaio, 2);
  const m = new THREE.Matrix4();
  xPali.forEach((x, i) => {
    pali.setMatrixAt(i, m.makeTranslation(x, h / 2, 0));
    piastre.setMatrixAt(i, m.makeTranslation(x, 0.0125, 0));
    cusc.setMatrixAt(i, m.makeTranslation(x, h + 0.1, 0));
  });
  g.add(pali, piastre, cusc);
  const tavola = new THREE.Group(); tavola.position.set(0, h + 0.24, 0); tavola.rotation.x = THREE.MathUtils.degToRad(19); g.add(tavola);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, L + 0.6, 14).rotateZ(Math.PI / 2), MAT.acciaio); tavola.add(tubo);
  const matMod = [MAT.alluminio, MAT.alluminio, MAT.vetroModulo, MAT.retroModulo, MAT.alluminio, MAT.alluminio];
  const moduli = new THREE.InstancedMesh(new THREE.BoxGeometry(MOD_W, MOD_T, MOD_L), matMod, nMod * 2);
  const arcarecci = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.08, MOD_L * 2 + 0.2), MAT.acciaioScuro, nMod);
  let k = 0;
  for (let i = 0; i < nMod; i++) {
    const x = -L / 2 + PASSO / 2 + i * PASSO;
    for (const lato of [-1, 1]) moduli.setMatrixAt(k++, m.makeTranslation(x, 0.17, lato * (MOD_L / 2 + 0.03)));
    arcarecci.setMatrixAt(i, m.makeTranslation(x - PASSO / 2 + 0.03, 0.11, 0));
  }
  tavola.add(moduli, arcarecci);
  return { w: L + 1, d: MOD_L * 2 + 1 };
}

export function creaCollezione(scena) {
  const gruppo = new THREE.Group(); gruppo.name = 'collezione'; gruppo.visible = false;
  scena.add(gruppo);
  const pezzi = [];

  // tracker
  const gT = new THREE.Group(); gruppo.add(gT);
  const mis = tracker(gT);
  pezzi.push({ g: gT, ombra: creaOmbre([{ x: 0, z: 0, w: mis.w + 2, d: mis.d + 2 }]) });

  // container B da solo (il PCS, il trasformatore e il container A restano nascosti)
  const gB = new THREE.Group(); gruppo.add(gB);
  const bess = creaBess(gB);
  bess.assemblaggio.set(1); bess.aggiorna(0, null, 1);
  // (dopo l'assemblaggio, che riaccende i pezzi: il PCS e il trasformatore sono pezzi, i container no)
  for (const c of gB.children) {
    const nascosto = Math.abs(c.position.x - POSA.containerA.x) < 0.01 || Math.abs(c.position.x - POSA.pcs.x) < 0.01 || Math.abs(c.position.x - POSA.trafo.x) < 0.01;
    if (nascosto) c.visible = false;
  }
  // il container B sta a POSA.containerB nel suo gruppo: lo riporto al centro
  gB.children.forEach((c) => { c.position.x -= POSA.containerB.x; c.position.z -= POSA.containerB.z; });
  pezzi.push({ g: gB, ombra: creaOmbre([{ x: 0.3, z: 0, w: 9.5, d: 5.0 }]) });

  // Francis da sola
  const gF = new THREE.Group(); gruppo.add(gF);
  const turbine = creaTurbine(gF);
  turbine.assemblaggio.set(1);
  for (const c of gF.children) if (Math.abs(Math.abs(c.position.x) - DIST) < 0.01) c.visible = false;
  pezzi.push({ g: gF, ombra: creaOmbre([{ x: 0, z: 0, w: 6.8, d: 5.2 }]) });

  for (const p of pezzi) { p.g.add(p.ombra.gruppo); p.ombra.set(1); }

  // Chi nasconde: le porte restano aperte e le macchine ferme; chi vede solo la visibilità in base al finale.
  return {
    gruppo,
    // posa: [{ pos: [x,y,z], rot: gradi }] per tracker, container, Francis
    disponi(pose) { pezzi.forEach((p, i) => { p.g.position.set(...pose[i].pos); p.g.rotation.y = THREE.MathUtils.degToRad(pose[i].rot); }); },
    aggiorna(finale, tempo) {
      gruppo.visible = finale > 0.01;
      if (gruppo.visible) turbine.aggiorna(tempo, null, 1);
    },
  };
}
