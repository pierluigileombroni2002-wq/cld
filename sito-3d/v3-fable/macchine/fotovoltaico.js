// Fotovoltaico e agrivoltaico: due file di tracker a terra davanti, due file rialzate dietro (agrivoltaico).
// Le tavole inseguono il sole con un movimento lentissimo; in primo piano si vedono celle, morsetti, cuscinetti, motore.
import * as THREE from 'three';
import { Assemblaggio, facile } from '../scena/assemblaggio.js';
import { MAT, GEO, istanze } from './materiali.js';

const MOD_W = 1.134, MOD_L = 2.278, MOD_T = 0.035, PASSO = 1.16, N_MOD = 14;
const L = N_MOD * PASSO; // lunghezza della fila (~16 m)

export function creaFotovoltaico(gruppo) {
  const ass = new Assemblaggio();
  const dettagli = new THREE.Group(); dettagli.name = 'dettagli';
  gruppo.add(dettagli);

  const file = [
    { z: 4.0, h: 2.1, agri: false }, { z: 11.0, h: 2.1, agri: false },
    { z: -6.0, h: 4.5, agri: true }, { z: -13.0, h: 4.5, agri: true },
  ];

  const geoMod = new THREE.BoxGeometry(MOD_W, MOD_T, MOD_L);
  const matMod = [MAT.alluminio, MAT.alluminio, MAT.vetroModulo, MAT.retroModulo, MAT.alluminio, MAT.alluminio];
  const geoPalo = { 2.1: new THREE.BoxGeometry(0.18, 2.1, 0.16), 4.5: new THREE.BoxGeometry(0.2, 4.5, 0.18) };
  const geoPiastra = new THREE.BoxGeometry(0.5, 0.025, 0.5);
  const geoCuscinetto = new THREE.BoxGeometry(0.34, 0.26, 0.3);
  const geoArcata = new THREE.TorusGeometry(0.16, 0.035, 8, 20, Math.PI);
  const geoArcarecci = new THREE.BoxGeometry(0.06, 0.08, MOD_L * 2 + 0.2);
  const geoMorsetto = new THREE.BoxGeometry(0.05, 0.03, 0.09);
  const geoTubo = new THREE.CylinderGeometry(0.09, 0.09, L + 0.8, 18);
  geoTubo.rotateZ(Math.PI / 2);

  const pali = { 2.1: [], 4.5: [] }, piastre = [], cuscinetti = [], arcate = [];
  const tavole = [], dettagliMobili = [];
  const xPali = [-L / 2 + 1.2, -L / 6, L / 6, L / 2 - 1.2];

  file.forEach((f, iFila) => {
    const ordineBase = iFila * 0.06;
    // pali, piastre e cuscinetti: parti fisse
    xPali.forEach((x, k) => {
      pali[f.h].push({ pos: new THREE.Vector3(x, f.h / 2, f.z), ordine: ordineBase + k * 0.02, da: [0, -f.h, 0] });
      piastre.push({ pos: new THREE.Vector3(x, 0.0125, f.z), ordine: ordineBase + k * 0.02, da: [0, -0.2, 0] });
      cuscinetti.push({ pos: new THREE.Vector3(x, f.h + 0.1, f.z), ordine: 0.22 + ordineBase + k * 0.015, da: [0, 0.8, 0] });
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
      arcate.push({ pos: new THREE.Vector3(x, f.h + 0.24, f.z), quat: q, ordine: 0.24 + ordineBase + k * 0.015, da: [0, 0.8, 0] });
    });

    // la tavola: tubo di torsione + arcarecci + moduli; ruota per inseguire il sole
    const tavola = new THREE.Group();
    tavola.position.set(0, f.h + 0.24, f.z);
    gruppo.add(tavola);
    tavole.push(tavola);

    const tubo = new THREE.Mesh(geoTubo, MAT.acciaio);
    tavola.add(tubo);
    ass.aggiungi(tubo, { ordine: 0.3 + ordineBase, da: [-8, 0, 0], durata: 0.2, scala: 1 });

    const trMod = [], trArc = [], trMors = [];
    for (let i = 0; i < N_MOD; i++) {
      const x = -L / 2 + PASSO / 2 + i * PASSO;
      const ord = 0.42 + ordineBase + (i / N_MOD) * 0.4;
      for (const lato of [-1, 1]) {
        trMod.push({ pos: new THREE.Vector3(x, 0.17, lato * (MOD_L / 2 + 0.03)), ordine: ord, da: [0, -1.4, 0] });
        trMors.push({ pos: new THREE.Vector3(x + MOD_W / 2 + 0.003, 0.19, lato * (MOD_L / 2 + 0.03) + lato * 0.55), ordine: ord + 0.02, da: [0, 0.25, 0] });
        trMors.push({ pos: new THREE.Vector3(x + MOD_W / 2 + 0.003, 0.19, lato * (MOD_L / 2 + 0.03) - lato * 0.55), ordine: ord + 0.02, da: [0, 0.25, 0] });
      }
      trArc.push({ pos: new THREE.Vector3(x - PASSO / 2 + 0.03, 0.11, 0), ordine: ord - 0.03, da: [0, -0.6, 0] });
    }
    const moduli = new THREE.InstancedMesh(geoMod, matMod, trMod.length);
    tavola.add(moduli);
    ass.aggiungiIstanze(moduli, trMod, { durata: 0.16, scala: 0.85 });
    const arcarecci = new THREE.InstancedMesh(geoArcarecci, MAT.acciaioScuro, trArc.length);
    tavola.add(arcarecci);
    ass.aggiungiIstanze(arcarecci, trArc, { durata: 0.14, scala: 1 });
    // morsetti: dettaglio da primo piano
    const morsetti = new THREE.InstancedMesh(geoMorsetto, MAT.alluminio, trMors.length);
    tavola.add(morsetti); dettagliMobili.push(morsetti);
    ass.aggiungiIstanze(morsetti, trMors, { durata: 0.1, scala: 1 });

    // motore di rotazione al centro, con riduttore e cavo
    const motore = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 20), MAT.grafite); corpo.rotation.z = Math.PI / 2; corpo.position.set(0.3, -0.12, 0);
    const riduttore = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), MAT.acciaioScuro); riduttore.position.set(0, -0.08, 0);
    const scatola = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), MAT.vernicePerla); scatola.position.set(-0.3, -0.16, 0.12);
    motore.add(corpo, riduttore, scatola);
    motore.position.set(0.3, 0, 0);
    tavola.add(motore);
    ass.aggiungi(motore, { ordine: 0.36 + ordineBase, da: [0, -0.8, 0], durata: 0.18, scala: 0.7 });
    tavola.userData.motore = motore;

    // agrivoltaico: righe di coltura come segni di luce sottili sotto la struttura (niente vegetazione realistica)
    if (f.agri) {
      const righe = [];
      for (let k = -3; k <= 3; k++) righe.push({ pos: new THREE.Vector3(0, 0.02, f.z + k * 0.9), ordine: 0.9 + k * 0.01, da: [0, 0, 0] });
      const segni = new THREE.InstancedMesh(new THREE.PlaneGeometry(L + 2, 0.04).rotateX(-Math.PI / 2), MAT.oroLuce, righe.length);
      gruppo.add(segni);
      ass.aggiungiIstanze(segni, righe, { durata: 0.1, scala: 0.2 });
    }
  });

  for (const h of [2.1, 4.5]) {
    const m = new THREE.InstancedMesh(geoPalo[h], MAT.acciaioScuro, pali[h].length);
    gruppo.add(m); ass.aggiungiIstanze(m, pali[h], { durata: 0.16, scala: 1 });
  }
  const mPiastre = new THREE.InstancedMesh(geoPiastra, MAT.acciaioScuro, piastre.length); gruppo.add(mPiastre); ass.aggiungiIstanze(mPiastre, piastre, { durata: 0.12, scala: 1 });
  const mCusc = new THREE.InstancedMesh(geoCuscinetto, MAT.acciaio, cuscinetti.length); gruppo.add(mCusc); ass.aggiungiIstanze(mCusc, cuscinetti, { durata: 0.12, scala: 1 });
  const mArc = new THREE.InstancedMesh(geoArcata, MAT.bronzo, arcate.length); dettagli.add(mArc); ass.aggiungiIstanze(mArc, arcate, { durata: 0.12, scala: 1 });
  // bulloni sulle piastre di base: quattro per piastra
  const trBull = [];
  piastre.forEach((p) => { for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) trBull.push({ pos: new THREE.Vector3(p.pos.x + dx, 0.03, p.pos.z + dz), ordine: p.ordine + 0.03, da: [0, 0.3, 0] }); });
  const mBull = new THREE.InstancedMesh(GEO.bullone, MAT.bronzo, trBull.length); dettagli.add(mBull); ass.aggiungiIstanze(mBull, trBull, { durata: 0.08, scala: 1 });

  return {
    gruppo, assemblaggio: ass,
    aggiorna(tempo, camera, a) {
      // inseguimento del sole: le tavole ruotano piano verso l'orizzonte mentre l'impianto si completa,
      // e il vetro raccoglie l'oro del cielo; poi respirano lentissime
      const e = facile.dentroFuori(Math.min(1, Math.max(0, (a - 0.45) / 0.55)));
      const inclinazione = THREE.MathUtils.degToRad(27 - 8 * e) + Math.sin(tempo * 0.12) * 0.01;
      for (const t of tavole) t.rotation.x = inclinazione;
    },
    setQualita(liv) { dettagli.visible = liv.dettagli; for (const d of dettagliMobili) d.userData.spento = !liv.dettagli; },
  };
}
