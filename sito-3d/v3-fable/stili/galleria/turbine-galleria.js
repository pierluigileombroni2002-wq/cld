// Idroelettrico per la Galleria Bianca (copia di macchine/turbine.js rivista per la sala chiara):
// tre turbine più vicine tra loro, su basamenti in ghisa scura che le reggono davvero (niente pezzi sospesi),
// acciaio inox satinato con i riflessi della finestra, casse verniciate grigio scuro per la Francis e la Kaplan.
// Le ancore delle etichette stanno sotto, al bordo anteriore del basamento.
import * as THREE from 'three';
import { Assemblaggio, facile } from '../../scena/assemblaggio.js';
import { GEO, istanze, bulloniInCerchio } from '../../macchine/materiali.js';

export const DIST = 5.4; // distanza tra le turbine lungo x

// materiali propri delle turbine in galleria
export const MAT_T = {
  inox:      new THREE.MeshStandardMaterial({ color: '#DAD8D2', metalness: 1.0,  roughness: 0.18, envMapIntensity: 1.35 }),
  acciaio:   new THREE.MeshStandardMaterial({ color: '#B6B4AE', metalness: 0.95, roughness: 0.26, envMapIntensity: 1.25 }),
  ghisa:     new THREE.MeshStandardMaterial({ color: '#3E4247', metalness: 0.55, roughness: 0.5,  envMapIntensity: 0.95 }),
  ghisaChiara: new THREE.MeshStandardMaterial({ color: '#5B5E63', metalness: 0.6, roughness: 0.5, envMapIntensity: 0.95 }),
  basamento: new THREE.MeshStandardMaterial({ color: '#4A4D52', metalness: 0.6,  roughness: 0.55, envMapIntensity: 0.9 }),
  bullone:   new THREE.MeshStandardMaterial({ color: '#B4B2AC', metalness: 0.9,  roughness: 0.4,  envMapIntensity: 1.0 }),
  rame:      new THREE.MeshStandardMaterial({ color: '#B5633A', metalness: 1.0,  roughness: 0.38, envMapIntensity: 1.1 }),
  acqua:     new THREE.MeshBasicMaterial({ color: '#E8F0F6', transparent: true, opacity: 0.55, depthWrite: false }),
};

for (const m of Object.values(MAT_T)) m.userData.proprio = true;
const proprio = (m) => { m.userData.proprio = true; return m; };

function base(gruppo, x, ass, ordine) {
  const b = new THREE.Group(); b.position.set(x, 0, 0); gruppo.add(b);
  const telaio = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 3.2), MAT_T.basamento); telaio.position.y = 0.08; b.add(telaio);
  const bordo = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.04, 3.3), MAT_T.ghisa); bordo.position.y = 0.02; b.add(bordo);
  const tr = []; for (const sx of [-2.05, 2.05]) for (const sz of [-1.35, 1.35]) tr.push({ pos: new THREE.Vector3(sx, 0.17, sz), ordine: 0.5, da: [0, 0.2, 0] });
  const bul = new THREE.InstancedMesh(GEO.bulloneGrande, MAT_T.bullone, 4); b.add(bul); ass.aggiungiIstanze(bul, tr, { durata: 0.3, scala: 1 });
  ass.aggiungi(b, { ordine, da: [0, -0.5, 0], durata: 0.1, scala: 1 });
  return b;
}

function flangia(raggio, spessore, nBulloni, mat = MAT_T.inox) {
  const g = new THREE.Group();
  const anello = new THREE.Mesh(new THREE.CylinderGeometry(raggio, raggio, spessore, 32), mat); g.add(anello);
  const bul = istanze(GEO.bullone, MAT_T.bullone, bulloniInCerchio(nBulloni, raggio * 0.82, { y: spessore / 2 + 0.005 }));
  g.add(bul); g.userData.minuteria = bul;
  return g;
}

// ---------- PELTON ----------
function pelton(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const R = 1.0, yC = 1.5, Rc = R + 0.3; // ruota, quota dell'albero, raggio della cassa (il fondo della cassa sfiora il basamento)
  // la cassa: un tamburo in ghisa verniciata, chiuso dietro e aperto davanti (in sezione), con il bordo in acciaio lucido:
  // la ruota resta visibile ma dentro un corpo solido e scuro
  const piede = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.0), MAT_T.ghisaChiara); piede.position.set(0, 0.14 + 0.25, 0); g.add(piede);
  ass.aggiungi(piede, { ordine: o0 + 0.02, da: [0, -0.6, 0], durata: 0.1, scala: 1 });
  const cassa = new THREE.Group(); cassa.position.set(0, yC, 0); g.add(cassa);
  const fondo = new THREE.Mesh(new THREE.CylinderGeometry(Rc, Rc, 0.05, 48), MAT_T.ghisa); fondo.rotation.x = Math.PI / 2; fondo.position.z = -0.45; cassa.add(fondo);
  const tamburo = new THREE.Mesh(new THREE.CylinderGeometry(Rc, Rc, 0.9, 48, 1, true), proprio(new THREE.MeshStandardMaterial({ color: '#3E4247', metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.95 })));
  tamburo.rotation.x = Math.PI / 2; cassa.add(tamburo);
  const bordo = new THREE.Mesh(new THREE.TorusGeometry(Rc, 0.03, 8, 48), MAT_T.acciaio); bordo.position.z = 0.45; cassa.add(bordo);
  const bulCassa = istanze(GEO.bullone, MAT_T.bullone, bulloniInCerchio(24, Rc - 0.1, { y: 0.46, asse: 'z' })); cassa.add(bulCassa); cassa.userData.minuteria = bulCassa;
  ass.aggiungi(cassa, { ordine: o0 + 0.05, da: [0, 0.8, 0], durata: 0.14, scala: 0.9 });
  // il cuscinetto davanti: una colonna stretta fuori dalla cassa, con il cappello in acciaio sull'albero
  const sostegno = new THREE.Mesh(new THREE.BoxGeometry(0.4, yC - 0.3, 0.3), MAT_T.ghisaChiara); sostegno.position.set(0, 0.14 + (yC - 0.3) / 2, 0.72); g.add(sostegno);
  ass.aggiungi(sostegno, { ordine: o0 + 0.04, da: [0, -1.2, 0], durata: 0.1, scala: 1 });
  const cappello = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 20), MAT_T.acciaio); cappello.rotation.x = Math.PI / 2; cappello.position.set(0, yC, 0.72); g.add(cappello);
  ass.aggiungi(cappello, { ordine: o0 + 0.08, da: [0, 0.5, 0], durata: 0.1, scala: 1 });
  // l'albero attraversa la cassa e arriva al generatore, dietro, sul suo piedistallo (una fascia in rame a vista)
  const albero = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.0, 16), MAT_T.inox); albero.rotation.x = Math.PI / 2; albero.position.set(0, yC, -0.1); g.add(albero);
  ass.aggiungi(albero, { ordine: o0 + 0.1, da: [0, 0, 1.5], durata: 0.1, scala: 1 });
  const generatore = new THREE.Group(); generatore.position.set(0, 0, -1.2); g.add(generatore);
  const piedeGen = new THREE.Mesh(new THREE.BoxGeometry(0.9, yC - 0.45 - 0.14, 0.6), MAT_T.ghisaChiara); piedeGen.position.set(0, 0.14 + (yC - 0.45 - 0.14) / 2, 0); generatore.add(piedeGen);
  const corpoGen = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.66, 32), MAT_T.ghisa); corpoGen.rotation.x = Math.PI / 2; corpoGen.position.set(0, yC, 0); generatore.add(corpoGen);
  const rameGen = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 32, 1, true), MAT_T.rame); rameGen.rotation.x = Math.PI / 2; rameGen.position.set(0, yC, 0.2); generatore.add(rameGen);
  const testaGen = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32), MAT_T.acciaio); testaGen.rotation.x = Math.PI / 2; testaGen.position.set(0, yC, 0.36); generatore.add(testaGen);
  ass.aggiungi(generatore, { ordine: o0 + 0.16, da: [0, 0, -1.2], durata: 0.12, scala: 0.8 });
  // la ruota: disco, mozzo con bulloni, 20 cucchiai doppi
  const ruota = new THREE.Group(); ruota.position.set(0, yC, 0); g.add(ruota);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.1, 48), MAT_T.acciaio); disco.rotation.x = Math.PI / 2; ruota.add(disco);
  const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), MAT_T.acciaio); mozzo.rotation.x = Math.PI / 2; ruota.add(mozzo);
  const bulMozzo = istanze(GEO.bullone, MAT_T.bullone, bulloniInCerchio(10, 0.22, { y: 0.105, asse: 'z' })); ruota.add(bulMozzo);
  const geoCucchiaio = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2); // mezza sfera: il cucchiaio
  geoCucchiaio.scale(0.17, 0.13, 0.2);
  const trCuc = [], trRad = [];
  const nC = 20;
  for (let i = 0; i < nC; i++) {
    const a = (i / nC) * Math.PI * 2;
    const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2); // tangenziale
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    for (const lato of [-1, 1]) {
      const p = dir.clone().multiplyScalar(R + 0.02); p.z = lato * 0.14;
      trCuc.push({ pos: p, quat: qa, ordine: 0.1 + (i / nC) * 0.85, da: [dir.x * 0.6, dir.y * 0.6, 0] });
    }
    trRad.push({ pos: dir.clone().multiplyScalar(R - 0.08), quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a), ordine: 0.1 + (i / nC) * 0.85, da: [dir.x * 0.6, dir.y * 0.6, 0] });
  }
  const cucchiai = new THREE.InstancedMesh(geoCucchiaio, MAT_T.inox, trCuc.length); ruota.add(cucchiai);
  const radici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.1, 0.34), MAT_T.acciaio, trRad.length); ruota.add(radici);
  const assRuota = new Assemblaggio();
  assRuota.aggiungiIstanze(cucchiai, trCuc, { durata: 0.15, scala: 0.5 });
  assRuota.aggiungiIstanze(radici, trRad, { durata: 0.15, scala: 0.5 });
  ass.aggiungi(ruota, { ordine: o0 + 0.12, da: [0, 0.8, 0], durata: 0.14, scala: 0.6, rotazione: 1.2, asse: 'z' });
  // l'ugello: il tubo in pressione arriva da destra, basso, posato su due selle, e si imbullona alla cassa con una flangia;
  // dentro la cassa il cono inox spara il getto orizzontale sui cucchiai in basso (la ruota lo attraversa: è così che lavora)
  const yU = yC - R; // la quota del getto: il cerchio primitivo dei cucchiai
  const ugello = new THREE.Group(); g.add(ugello);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 20), MAT_T.acciaio); tubo.rotation.z = Math.PI / 2; tubo.position.set(1.8, yU, 0); ugello.add(tubo);
  for (const sx of [1.5, 2.35]) { const sella = new THREE.Mesh(new THREE.BoxGeometry(0.3, yU - 0.14, 0.5), MAT_T.ghisaChiara); sella.position.set(sx, 0.14 + (yU - 0.14) / 2, 0); ugello.add(sella); }
  const flCassa = flangia(0.27, 0.07, 12); flCassa.rotation.z = Math.PI / 2; flCassa.position.set(0.98, yU, 0); ugello.add(flCassa);
  const flFine = flangia(0.26, 0.06, 12); flFine.rotation.z = Math.PI / 2; flFine.position.set(2.66, yU, 0); ugello.add(flFine);
  const canna = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 20), MAT_T.acciaio); canna.rotation.z = Math.PI / 2; canna.position.set(0.8, yU, 0); ugello.add(canna);
  const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.32, 20), MAT_T.inox); cono.rotation.z = Math.PI / 2; cono.position.set(0.5, yU, 0); ugello.add(cono);
  ass.aggiungi(ugello, { ordine: o0 + 0.22, da: [1.5, 0, 0], durata: 0.12, scala: 1 });
  // il getto: un filo d'acqua chiaro dal cono ai cucchiai
  const getto = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.6, 10), MAT_T.acqua);
  getto.rotation.z = Math.PI / 2; getto.position.set(0.05, yU, 0); ugello.add(getto);
  ass.aggiungi(getto, { ordine: o0 + 0.3, da: [0.4, 0, 0], durata: 0.08, scala: 0.2 });
  return { ruota, assRuota, ancora: new THREE.Vector3(x, 0, 1.7), nome: 'pelton' };
}

// ---------- FRANCIS ----------
function francis(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const yC = 1.15, R = 1.35;
  // il tubo di scarico sotto la girante: regge la macchina e la unisce al basamento
  const scarico = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.0, yC - 0.4 - 0.14, 40), MAT_T.ghisa); scarico.position.set(0, 0.14 + (yC - 0.4 - 0.14) / 2, 0); g.add(scarico);
  ass.aggiungi(scarico, { ordine: o0 + 0.02, da: [0, -0.8, 0], durata: 0.12, scala: 0.9 });
  const flScarico = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 40), MAT_T.acciaio); flScarico.position.set(0, 0.18, 0); g.add(flScarico);
  ass.aggiungi(flScarico, { ordine: o0 + 0.03, da: [0, -0.5, 0], durata: 0.1, scala: 1 });
  // due culle sotto la spirale
  for (const sx of [-1, 1]) { const culla = new THREE.Mesh(new THREE.BoxGeometry(0.4, yC - 0.5 - 0.14, 0.9), MAT_T.ghisaChiara); culla.position.set(sx * 1.35, 0.14 + (yC - 0.5 - 0.14) / 2, 0); g.add(culla); ass.aggiungi(culla, { ordine: o0 + 0.03, da: [0, -0.6, 0], durata: 0.1, scala: 1 }); }
  // cassa a spirale in ghisa verniciata: otto tratti con sezione decrescente e flange d'acciaio tra i tratti
  const n = 7;
  for (let i = 0; i < n; i++) {
    const r0 = 0.5 - i * 0.05;
    const a0 = Math.PI * 0.35 + i * (Math.PI * 2 / 8);
    const tratto = new THREE.Mesh(new THREE.TorusGeometry(R, r0, 14, 12, Math.PI * 2 / 8), MAT_T.ghisa);
    tratto.rotation.x = Math.PI / 2; tratto.rotation.z = a0; tratto.position.set(0, yC, 0); g.add(tratto);
    ass.aggiungi(tratto, { ordine: o0 + 0.06 + i * 0.035, da: [Math.cos(a0 + 0.4) * 0.8, 0.3, -Math.sin(a0 + 0.4) * 0.8], durata: 0.12, scala: 0.85 });
    const fl = flangia(r0 + 0.07, 0.07, 14, MAT_T.acciaio);
    fl.position.set(Math.cos(a0) * R, yC, -Math.sin(a0) * R); fl.rotation.set(0, a0, Math.PI / 2); g.add(fl);
    ass.aggiungi(fl, { ordine: o0 + 0.08 + i * 0.035, da: [0, 0.3, 0], durata: 0.1, scala: 1 });
  }
  // ingresso tangente, con flangia grande
  const ingresso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 24), MAT_T.ghisa);
  const aIn = Math.PI * 0.35;
  ingresso.rotation.z = Math.PI / 2; ingresso.rotation.y = -aIn + Math.PI / 2;
  ingresso.position.set(Math.cos(aIn) * R + Math.sin(aIn) * 0.55, yC, -Math.sin(aIn) * R + Math.cos(aIn) * 0.55);
  const flIn = flangia(0.58, 0.08, 20, MAT_T.acciaio); flIn.rotation.copy(ingresso.rotation); flIn.position.copy(ingresso.position).add(new THREE.Vector3(Math.sin(aIn) * 0.55, 0, Math.cos(aIn) * 0.55)); g.add(flIn);
  ass.aggiungi(flIn, { ordine: o0 + 0.05, da: [1.5, 0, 1.0], durata: 0.12, scala: 1 });
  g.add(ingresso);
  ass.aggiungi(ingresso, { ordine: o0 + 0.04, da: [1.5, 0, 1.0], durata: 0.12, scala: 1 });
  // girante: corona, fascia e 13 pale curve; palette direttrici attorno
  const girante = new THREE.Group(); girante.position.set(0, yC, 0); g.add(girante);
  const corona = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.75, 0.8, 32), MAT_T.inox); girante.add(corona);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.16, 48, 1, true), MAT_T.inox); fascia.position.y = -0.3; girante.add(fascia);
  const trPale = [];
  const nP = 13;
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0.55, 'YXZ'));
    trPale.push({ pos: new THREE.Vector3(Math.cos(a) * 0.72, -0.1, Math.sin(a) * 0.72), quat: q, ordine: i / nP, da: [Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4] });
  }
  const geoPala = new THREE.CylinderGeometry(0.42, 0.3, 0.62, 10, 1, true, 0, 1.1);
  const pale = new THREE.InstancedMesh(geoPala, proprio(new THREE.MeshStandardMaterial({ color: '#DAD8D2', metalness: 1.0, roughness: 0.2, side: THREE.DoubleSide, envMapIntensity: 1.3 })), nP);
  girante.add(pale);
  const assGir = new Assemblaggio(); assGir.aggiungiIstanze(pale, trPale, { durata: 0.3, scala: 0.5 });
  ass.aggiungi(girante, { ordine: o0 + 0.3, da: [0, 1.2, 0], durata: 0.14, scala: 0.6, rotazione: 1.0, asse: 'y' });
  const trDir = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; trDir.push({ pos: new THREE.Vector3(Math.cos(a) * 1.02, yC - 0.1, Math.sin(a) * 1.02), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + 0.5, 0)), ordine: 0.2 + i / 18 * 0.8, da: [0, 0.4, 0] }); }
  const direttrici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.5, 0.03), MAT_T.acciaio, 18); g.add(direttrici); ass.aggiungiIstanze(direttrici, trDir, { durata: 0.2, scala: 1 });
  // albero e generatore sopra, con gli avvolgimenti in rame a vista
  const albero = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 20), MAT_T.inox); albero.position.set(0, yC + 0.9, 0); g.add(albero);
  ass.aggiungi(albero, { ordine: o0 + 0.42, da: [0, 1.0, 0], durata: 0.1, scala: 1 });
  const generatore = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.75, 40), MAT_T.ghisa); generatore.position.set(0, yC + 1.75, 0); g.add(generatore);
  ass.aggiungi(generatore, { ordine: o0 + 0.46, da: [0, 1.2, 0], durata: 0.12, scala: 0.8 });
  const bulGen = istanze(GEO.bulloneGrande, MAT_T.bullone, bulloniInCerchio(16, 0.72, { y: 0.39 })); generatore.add(bulGen);
  const avvolgimenti = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 40, 1, true), MAT_T.rame); avvolgimenti.position.set(0, yC + 1.75 - 0.55, 0); g.add(avvolgimenti);
  ass.aggiungi(avvolgimenti, { ordine: o0 + 0.44, da: [0, 1.0, 0], durata: 0.1, scala: 0.8 });
  const coperchio = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 0.22, 40), MAT_T.acciaio); coperchio.position.set(0, yC + 1.75 + 0.48, 0); g.add(coperchio);
  ass.aggiungi(coperchio, { ordine: o0 + 0.5, da: [0, 0.6, 0], durata: 0.1, scala: 0.8 });
  // colonne che reggono il generatore
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 12), MAT_T.acciaio); c.position.set(Math.cos(a) * 0.65, yC + 0.85, Math.sin(a) * 0.65); g.add(c); ass.aggiungi(c, { ordine: o0 + 0.4, da: [0, 0.8, 0], durata: 0.1, scala: 1 }); }
  return { ruota: girante, assRuota: assGir, ancora: new THREE.Vector3(x, 0, 1.7), nome: 'francis' };
}

// ---------- KAPLAN ----------
function kaplan(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const yC = 1.35, R = 1.05;
  // condotto tagliato in ghisa verniciata: si vede l'elica dentro
  const condotto = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 2.0, 48, 1, true, Math.PI * 0.55, Math.PI * 1.45), proprio(new THREE.MeshStandardMaterial({ color: '#3E4247', metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.95 })));
  condotto.rotation.x = Math.PI / 2; condotto.rotation.y = 0; condotto.position.set(0, yC, 0); g.add(condotto);
  ass.aggiungi(condotto, { ordine: o0 + 0.04, da: [0, 0.8, 0], durata: 0.14, scala: 0.9 });
  for (const sz of [-1.0, 1.0]) {
    const fl = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.06, 10, 48, Math.PI * 1.45), MAT_T.acciaio); fl.position.set(0, yC, sz); fl.rotation.z = Math.PI * 0.55; g.add(fl);
    ass.aggiungi(fl, { ordine: o0 + 0.1, da: [0, 0.4, 0], durata: 0.1, scala: 1 });
    const bul = istanze(GEO.bullone, MAT_T.bullone, bulloniInCerchio(26, R + 0.12, { y: 0, asse: 'z' }).slice(0, 18)); bul.position.set(0, yC, sz + (sz > 0 ? 0.04 : -0.04)); bul.rotation.z = Math.PI * 0.55; g.add(bul);
    ass.aggiungi(bul, { ordine: o0 + 0.12, da: [0, 0.4, 0], durata: 0.1, scala: 1 });
  }
  // sostegno del condotto
  const sella = new THREE.Mesh(new THREE.BoxGeometry(1.6, yC - R + 0.1, 1.6), MAT_T.ghisaChiara); sella.position.set(0, 0.14 + (yC - R + 0.1) / 2, 0); g.add(sella);
  ass.aggiungi(sella, { ordine: o0 + 0.02, da: [0, -0.5, 0], durata: 0.1, scala: 1 });
  // bulbo del generatore dietro, con il muso, retto da una colonna
  const bulbo = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 8, 24), MAT_T.ghisa); bulbo.rotation.x = Math.PI / 2; bulbo.position.set(0, yC, -1.3); g.add(bulbo);
  ass.aggiungi(bulbo, { ordine: o0 + 0.16, da: [0, 0, -1.5], durata: 0.12, scala: 0.8 });
  const colonna = new THREE.Mesh(new THREE.BoxGeometry(0.5, yC - 0.35 - 0.14, 0.6), MAT_T.ghisaChiara); colonna.position.set(0, 0.14 + (yC - 0.35 - 0.14) / 2, -1.3); g.add(colonna);
  ass.aggiungi(colonna, { ordine: o0 + 0.14, da: [0, -0.6, 0], durata: 0.1, scala: 1 });
  // palette direttrici attorno al bulbo
  const trDir = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; trDir.push({ pos: new THREE.Vector3(Math.cos(a) * 0.75, Math.sin(a) * 0.75, -0.6), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0, a, 'ZXY')), ordine: i / 12, da: [0, 0, -0.5] }); }
  const direttrici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.5, 0.36), MAT_T.acciaio, 12); direttrici.position.set(0, yC, 0); g.add(direttrici); ass.aggiungiIstanze(direttrici, trDir, { durata: 0.3, scala: 1 });
  // l'elica: mozzo con muso, cinque pale larghe
  const elica = new THREE.Group(); elica.position.set(0, yC, 0.25); g.add(elica);
  const mozzo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), MAT_T.inox); mozzo.scale.set(1, 1, 1.35); elica.add(mozzo);
  const muso = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 24), MAT_T.inox); muso.rotation.x = Math.PI / 2; muso.position.z = 0.75; elica.add(muso);
  const bulMozzo = istanze(GEO.bullone, MAT_T.bullone, bulloniInCerchio(8, 0.2, { y: 0.44, asse: 'y' })); bulMozzo.rotation.x = Math.PI / 2; bulMozzo.position.z = 0.0; elica.add(bulMozzo);
  const geoPala = new THREE.SphereGeometry(1, 20, 12); geoPala.scale(0.24, 0.62, 0.05);
  const trPale = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a, 'XYZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5));
    trPale.push({ pos: new THREE.Vector3(-Math.sin(a) * 0.62, Math.cos(a) * 0.62, 0), quat: q, ordine: i / 5, da: [-Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0] });
  }
  const pale = new THREE.InstancedMesh(geoPala, MAT_T.inox, 5); elica.add(pale);
  const assEl = new Assemblaggio(); assEl.aggiungiIstanze(pale, trPale, { durata: 0.3, scala: 0.5 });
  ass.aggiungi(elica, { ordine: o0 + 0.26, da: [0, 0, 1.6], durata: 0.14, scala: 0.6, rotazione: 1.0, asse: 'z' });
  return { ruota: elica, assRuota: assEl, ancora: new THREE.Vector3(x, 0, 1.7), nome: 'kaplan' };
}

export function creaTurbine(gruppo) {
  const ass = new Assemblaggio();
  const t = [pelton(gruppo, -DIST, ass, 0.0), francis(gruppo, 0, ass, 0.3), kaplan(gruppo, DIST, ass, 0.6)];
  const minuterie = [];
  gruppo.traverse((o) => { if (o.userData.minuteria) minuterie.push(o.userData.minuteria); });
  const velocita = { pelton: 0.9, francis: 0.7, kaplan: 1.1 };
  return {
    gruppo, assemblaggio: ass,
    ancore: () => t.map((x) => ({ nome: x.nome, pos: x.ancora.clone().add(gruppo.position) })),
    aggiorna(tempo, camera, a) {
      t.forEach((x, i) => {
        const o0 = i * 0.3;
        const k = Math.min(1, Math.max(0, (a - o0 - 0.12) / 0.2));
        x.assRuota.set(k);
        const giro = facile.dentroFuori(Math.min(1, Math.max(0, (a - o0 - 0.3) / 0.12)));
        const asse = x.nome === 'francis' ? 'y' : 'z';
        x.ruota.rotation[asse] += giro * velocita[x.nome] * (1 / 60) * (x.nome === 'pelton' ? -1 : 1);
      });
    },
    setQualita(liv) { for (const m of minuterie) m.visible = liv.dettagli; },
  };
}
