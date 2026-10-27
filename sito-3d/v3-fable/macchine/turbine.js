// Idroelettrico: tre turbine diverse, riconoscibili al primo sguardo, in fila su basi d'acciaio sobrie.
// Pelton (ruota a cucchiai con l'ugello), Francis (cassa a spirale con la girante dentro), Kaplan (elica nel condotto).
// Girano piano. L'acqua è luce, non acqua: niente realismo.
import * as THREE from 'three';
import { Assemblaggio, facile } from '../scena/assemblaggio.js';
import { MAT, GEO, istanze, bulloniInCerchio } from './materiali.js';

const DIST = 12; // distanza tra le turbine lungo x

function base(gruppo, x, ass, ordine) {
  const b = new THREE.Group(); b.position.set(x, 0, 0); gruppo.add(b);
  const telaio = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 3.2), MAT.acciaioScuro); telaio.position.y = 0.06; b.add(telaio);
  const tr = []; for (const sx of [-2.05, 2.05]) for (const sz of [-1.35, 1.35]) tr.push({ pos: new THREE.Vector3(sx, 0.13, sz), ordine: 0.5, da: [0, 0.2, 0] });
  const bul = new THREE.InstancedMesh(GEO.bulloneGrande, MAT.bronzo, 4); b.add(bul); ass.aggiungiIstanze(bul, tr, { durata: 0.3, scala: 1 });
  ass.aggiungi(b, { ordine, da: [0, -0.5, 0], durata: 0.1, scala: 1 });
  return b;
}

function flangia(raggio, spessore, nBulloni, mat = MAT.inox) {
  const g = new THREE.Group();
  const anello = new THREE.Mesh(new THREE.CylinderGeometry(raggio, raggio, spessore, 32), mat); g.add(anello);
  const bul = istanze(GEO.bullone, MAT.bronzo, bulloniInCerchio(nBulloni, raggio * 0.82, { y: spessore / 2 + 0.005 }));
  g.add(bul); g.userData.minuteria = bul;
  return g;
}

// ---------- PELTON ----------
function pelton(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const R = 1.05, yC = 1.55;
  // sostegni e albero (lungo z: la ruota guarda la camera)
  for (const sz of [-0.55, 0.55]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, yC - 0.3, 0.3), MAT.acciaioScuro); s.position.set(0, 0.12 + (yC - 0.3) / 2, sz); g.add(s);
    ass.aggiungi(s, { ordine: o0 + 0.04, da: [0, -1.2, 0], durata: 0.1, scala: 1 });
    const cappello = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 20), MAT.acciaio); cappello.rotation.x = Math.PI / 2; cappello.position.set(0, yC, sz); g.add(cappello);
    ass.aggiungi(cappello, { ordine: o0 + 0.08, da: [0, 0.5, 0], durata: 0.1, scala: 1 });
  }
  const albero = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 16), MAT.inox); albero.rotation.x = Math.PI / 2; albero.position.set(0, yC, 0); g.add(albero);
  ass.aggiungi(albero, { ordine: o0 + 0.1, da: [0, 0, 1.5], durata: 0.1, scala: 1 });
  // la ruota: disco, mozzo con bulloni, 20 cucchiai doppi
  const ruota = new THREE.Group(); ruota.position.set(0, yC, 0); g.add(ruota);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.1, 48), MAT.inox); disco.rotation.x = Math.PI / 2; ruota.add(disco);
  const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), MAT.acciaio); mozzo.rotation.x = Math.PI / 2; ruota.add(mozzo);
  const bulMozzo = istanze(GEO.bullone, MAT.bronzo, bulloniInCerchio(10, 0.22, { y: 0.105, asse: 'z' })); ruota.add(bulMozzo);
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
  const cucchiai = new THREE.InstancedMesh(geoCucchiaio, MAT.inox, trCuc.length); ruota.add(cucchiai);
  const radici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.1, 0.34), MAT.acciaio, trRad.length); ruota.add(radici);
  const assRuota = new Assemblaggio();
  assRuota.aggiungiIstanze(cucchiai, trCuc, { durata: 0.15, scala: 0.5 });
  assRuota.aggiungiIstanze(radici, trRad, { durata: 0.15, scala: 0.5 });
  ass.aggiungi(ruota, { ordine: o0 + 0.12, da: [0, 0.8, 0], durata: 0.14, scala: 0.6, rotazione: 1.2, asse: 'z' });
  // l'ugello: tubo con gomito e flange, che punta tangente alla ruota, dal basso a destra
  const ugello = new THREE.Group(); g.add(ugello);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.2, 20), MAT.acciaio); tubo.rotation.z = Math.PI / 2; tubo.position.set(2.0, 0.45, 0); ugello.add(tubo);
  const gomito = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.17, 14, 20, Math.PI / 2), MAT.acciaio); gomito.position.set(0.9, 0.95, 0); gomito.rotation.z = Math.PI; ugello.add(gomito);
  const canna = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 20), MAT.acciaio); canna.position.set(0.4, 0.95 + 0.25, 0); ugello.add(canna);
  const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.07, 0.35, 20), MAT.inox); cono.position.set(0.4, 1.2 + 0.17, 0); ugello.add(cono);
  const fl1 = flangia(0.26, 0.06, 12); fl1.rotation.z = Math.PI / 2; fl1.position.set(1.4, 0.45, 0); ugello.add(fl1);
  const fl2 = flangia(0.26, 0.06, 12); fl2.rotation.z = Math.PI / 2; fl2.position.set(2.9, 0.45, 0); ugello.add(fl2);
  const fl3 = flangia(0.24, 0.05, 10); fl3.position.set(0.4, 1.0, 0); ugello.add(fl3);
  ass.aggiungi(ugello, { ordine: o0 + 0.22, da: [1.5, 0, 0], durata: 0.12, scala: 1 });
  // il getto: una lama di luce dall'ugello ai cucchiai
  const getto = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 10), new THREE.MeshBasicMaterial({ color: '#dfeeff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  getto.position.set(0.4, 1.38 + 0.37, 0); ugello.add(getto);
  ass.aggiungi(getto, { ordine: o0 + 0.3, da: [0, -0.3, 0], durata: 0.08, scala: 0.2 });
  // cappa deflettrice sopra la ruota
  const cappa = new THREE.Mesh(new THREE.TorusGeometry(R + 0.26, 0.09, 10, 40, Math.PI * 0.9), MAT.acciaio); cappa.position.set(0, yC, 0); cappa.rotation.z = Math.PI * 0.05; g.add(cappa);
  ass.aggiungi(cappa, { ordine: o0 + 0.26, da: [0, 0.6, 0], durata: 0.1, scala: 1 });
  return { ruota, assRuota, ancora: new THREE.Vector3(x, yC + R + 0.9, 0), nome: 'pelton' };
}

// ---------- FRANCIS ----------
function francis(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const yC = 1.15, R = 1.35;
  // cassa a spirale: otto tratti con sezione decrescente e flange tra i tratti; aperta dove si vede la girante
  const n = 7;
  for (let i = 0; i < n; i++) {
    const r0 = 0.5 - i * 0.05;
    const a0 = Math.PI * 0.35 + i * (Math.PI * 2 / 8);
    const tratto = new THREE.Mesh(new THREE.TorusGeometry(R, r0, 14, 12, Math.PI * 2 / 8), MAT.vernicePerla);
    tratto.rotation.x = Math.PI / 2; tratto.rotation.z = a0; tratto.position.set(0, yC, 0); g.add(tratto);
    ass.aggiungi(tratto, { ordine: o0 + 0.06 + i * 0.035, da: [Math.cos(a0 + 0.4) * 0.8, 0.3, -Math.sin(a0 + 0.4) * 0.8], durata: 0.12, scala: 0.85 });
    const fl = flangia(r0 + 0.07, 0.07, 14, MAT.acciaio);
    fl.position.set(Math.cos(a0) * R, yC, -Math.sin(a0) * R); fl.rotation.set(0, a0, Math.PI / 2); g.add(fl);
    ass.aggiungi(fl, { ordine: o0 + 0.08 + i * 0.035, da: [0, 0.3, 0], durata: 0.1, scala: 1 });
  }
  // ingresso tangente, con flangia grande
  const ingresso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 24), MAT.vernicePerla);
  const aIn = Math.PI * 0.35;
  ingresso.rotation.z = Math.PI / 2; ingresso.rotation.y = -aIn + Math.PI / 2;
  ingresso.position.set(Math.cos(aIn) * R + Math.sin(aIn) * 0.55, yC, -Math.sin(aIn) * R + Math.cos(aIn) * 0.55);
  const flIn = flangia(0.58, 0.08, 20, MAT.acciaio); flIn.rotation.copy(ingresso.rotation); flIn.position.copy(ingresso.position).add(new THREE.Vector3(Math.sin(aIn) * 0.55, 0, Math.cos(aIn) * 0.55)); g.add(flIn);
  ass.aggiungi(flIn, { ordine: o0 + 0.05, da: [1.5, 0, 1.0], durata: 0.12, scala: 1 });
  g.add(ingresso);
  ass.aggiungi(ingresso, { ordine: o0 + 0.04, da: [1.5, 0, 1.0], durata: 0.12, scala: 1 });
  // girante: corona, fascia e 13 pale curve; palette direttrici attorno
  const girante = new THREE.Group(); girante.position.set(0, yC, 0); g.add(girante);
  const corona = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.75, 0.8, 32), MAT.inox); girante.add(corona);
  const fascia = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.16, 48, 1, true), MAT.inox); fascia.material = MAT.inox; fascia.position.y = -0.3; girante.add(fascia);
  const trPale = [];
  const nP = 13;
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0.55, 'YXZ'));
    trPale.push({ pos: new THREE.Vector3(Math.cos(a) * 0.72, -0.1, Math.sin(a) * 0.72), quat: q, ordine: i / nP, da: [Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4] });
  }
  const geoPala = new THREE.CylinderGeometry(0.42, 0.3, 0.62, 10, 1, true, 0, 1.1);
  geoPala.translate(0, 0, 0);
  const pale = new THREE.InstancedMesh(geoPala, new THREE.MeshStandardMaterial({ color: '#d8d5cf', metalness: 1.0, roughness: 0.25, side: THREE.DoubleSide, envMapIntensity: 1.2 }), nP);
  girante.add(pale);
  const assGir = new Assemblaggio(); assGir.aggiungiIstanze(pale, trPale, { durata: 0.3, scala: 0.5 });
  ass.aggiungi(girante, { ordine: o0 + 0.3, da: [0, 1.2, 0], durata: 0.14, scala: 0.6, rotazione: 1.0, asse: 'y' });
  const trDir = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; trDir.push({ pos: new THREE.Vector3(Math.cos(a) * 1.02, yC - 0.1, Math.sin(a) * 1.02), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + 0.5, 0)), ordine: 0.2 + i / 18 * 0.8, da: [0, 0.4, 0] }); }
  const direttrici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.5, 0.03), MAT.bronzo, 18); g.add(direttrici); ass.aggiungiIstanze(direttrici, trDir, { durata: 0.2, scala: 1 });
  // albero e generatore sopra
  const albero = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 20), MAT.inox); albero.position.set(0, yC + 0.9, 0); g.add(albero);
  ass.aggiungi(albero, { ordine: o0 + 0.42, da: [0, 1.0, 0], durata: 0.1, scala: 1 });
  const generatore = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.75, 40), MAT.grafite); generatore.position.set(0, yC + 1.75, 0); g.add(generatore);
  ass.aggiungi(generatore, { ordine: o0 + 0.46, da: [0, 1.2, 0], durata: 0.12, scala: 0.8 });
  const bulGen = istanze(GEO.bulloneGrande, MAT.bronzo, bulloniInCerchio(16, 0.72, { y: 0.39 })); generatore.add(bulGen);
  const coperchio = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 0.22, 40), MAT.acciaio); coperchio.position.set(0, yC + 1.75 + 0.48, 0); g.add(coperchio);
  ass.aggiungi(coperchio, { ordine: o0 + 0.5, da: [0, 0.6, 0], durata: 0.1, scala: 0.8 });
  // colonne che reggono il generatore
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 12), MAT.acciaio); c.position.set(Math.cos(a) * 0.65, yC + 0.85, Math.sin(a) * 0.65); g.add(c); ass.aggiungi(c, { ordine: o0 + 0.4, da: [0, 0.8, 0], durata: 0.1, scala: 1 }); }
  return { ruota: girante, assRuota: assGir, ancora: new THREE.Vector3(x, yC + 2.5 + 0.5, 0), nome: 'francis' };
}

// ---------- KAPLAN ----------
function kaplan(gruppo, x, ass, o0) {
  base(gruppo, x, ass, o0);
  const g = new THREE.Group(); g.position.set(x, 0, 0); gruppo.add(g);
  const yC = 1.35, R = 1.05;
  // condotto tagliato: si vede l'elica dentro
  const condotto = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 2.0, 48, 1, true, Math.PI * 0.55, Math.PI * 1.45), new THREE.MeshStandardMaterial({ color: '#efe4d2', metalness: 0.1, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.55 }));
  condotto.rotation.x = Math.PI / 2; condotto.rotation.y = 0; condotto.position.set(0, yC, 0); g.add(condotto);
  ass.aggiungi(condotto, { ordine: o0 + 0.04, da: [0, 0.8, 0], durata: 0.14, scala: 0.9 });
  for (const sz of [-1.0, 1.0]) {
    const fl = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.06, 10, 48, Math.PI * 1.45), MAT.acciaio); fl.position.set(0, yC, sz); fl.rotation.z = Math.PI * 0.55; g.add(fl);
    ass.aggiungi(fl, { ordine: o0 + 0.1, da: [0, 0.4, 0], durata: 0.1, scala: 1 });
    const bul = istanze(GEO.bullone, MAT.bronzo, bulloniInCerchio(26, R + 0.12, { y: 0, asse: 'z' }).slice(0, 18)); bul.position.set(0, yC, sz + (sz > 0 ? 0.04 : -0.04)); bul.rotation.z = Math.PI * 0.55; g.add(bul);
    ass.aggiungi(bul, { ordine: o0 + 0.12, da: [0, 0.4, 0], durata: 0.1, scala: 1 });
  }
  // sostegno del condotto
  const sella = new THREE.Mesh(new THREE.BoxGeometry(1.6, yC - R + 0.1, 1.6), MAT.acciaioScuro); sella.position.set(0, 0.12 + (yC - R + 0.1) / 2, 0); g.add(sella);
  ass.aggiungi(sella, { ordine: o0 + 0.02, da: [0, -0.5, 0], durata: 0.1, scala: 1 });
  // bulbo del generatore dietro, con il muso
  const bulbo = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 8, 24), MAT.grafite); bulbo.rotation.x = Math.PI / 2; bulbo.position.set(0, yC, -1.3); g.add(bulbo);
  ass.aggiungi(bulbo, { ordine: o0 + 0.16, da: [0, 0, -1.5], durata: 0.12, scala: 0.8 });
  // palette direttrici attorno al bulbo
  const trDir = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; trDir.push({ pos: new THREE.Vector3(Math.cos(a) * 0.75, Math.sin(a) * 0.75, -0.6), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0, a, 'ZXY')), ordine: i / 12, da: [0, 0, -0.5] }); }
  const direttrici = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.5, 0.36), MAT.bronzo, 12); direttrici.position.set(0, yC, 0); g.add(direttrici); ass.aggiungiIstanze(direttrici, trDir, { durata: 0.3, scala: 1 });
  // l'elica: mozzo con muso, cinque pale larghe
  const elica = new THREE.Group(); elica.position.set(0, yC, 0.25); g.add(elica);
  const mozzo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), MAT.inox); mozzo.scale.set(1, 1, 1.35); elica.add(mozzo);
  const muso = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 24), MAT.inox); muso.rotation.x = Math.PI / 2; muso.position.z = 0.75; elica.add(muso);
  const bulMozzo = istanze(GEO.bullone, MAT.bronzo, bulloniInCerchio(8, 0.2, { y: 0.44, asse: 'y' })); bulMozzo.rotation.x = Math.PI / 2; bulMozzo.position.z = 0.0; elica.add(bulMozzo);
  const geoPala = new THREE.SphereGeometry(1, 20, 12); geoPala.scale(0.24, 0.62, 0.05);
  const trPale = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a, 'XYZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5));
    trPale.push({ pos: new THREE.Vector3(-Math.sin(a) * 0.62, Math.cos(a) * 0.62, 0), quat: q, ordine: i / 5, da: [-Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0] });
  }
  const pale = new THREE.InstancedMesh(geoPala, MAT.inox, 5); elica.add(pale);
  const assEl = new Assemblaggio(); assEl.aggiungiIstanze(pale, trPale, { durata: 0.3, scala: 0.5 });
  ass.aggiungi(elica, { ordine: o0 + 0.26, da: [0, 0, 1.6], durata: 0.14, scala: 0.6, rotazione: 1.0, asse: 'z' });
  return { ruota: elica, assRuota: assEl, ancora: new THREE.Vector3(x, yC + R + 0.9, 0), nome: 'kaplan' };
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
