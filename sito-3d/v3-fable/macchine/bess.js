// Accumulo BESS: due container di batterie con le porte che si aprono sui rack, il PCS con la ventola, il trasformatore con le alette.
// Un filo d'oro porta l'energia dai container al trasformatore e via verso la rete.
import * as THREE from 'three';
import { Assemblaggio, facile } from '../scena/assemblaggio.js';
import { MAT, GEO, istanze } from './materiali.js';
import { creaLineaLuce } from '../scena/linea-luce.js';

const CONT = { l: 6.06, h: 2.9, p: 2.44 };

export function creaBess(gruppo) {
  const ass = new Assemblaggio();
  const minuterie = []; // bulloni e feritoie: spenti al livello basso
  const porte = [], ventole = [], led = [];

  const geoPorta = new THREE.BoxGeometry(0.94, 2.5, 0.035);
  const geoManiglia = new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10);
  const geoModulo = new THREE.BoxGeometry(0.82, 0.1, 0.62);
  const geoLed = new THREE.BoxGeometry(0.03, 0.012, 0.006);
  const geoAletta = new THREE.BoxGeometry(1.06, 0.03, 0.05);

  function container(x, porteAperte) {
    const c = new THREE.Group(); c.position.set(x, 0, 0); gruppo.add(c);
    const ord = x < 0 ? 0 : 0.05;
    // slitta d'acciaio, corpo, bordo del tetto
    const slitta = new THREE.Mesh(new THREE.BoxGeometry(CONT.l - 0.1, 0.16, CONT.p - 0.2), MAT.acciaioScuro); slitta.position.y = 0.08; c.add(slitta);
    ass.aggiungi(slitta, { ordine: ord, da: [0, -0.3, 0], durata: 0.12, scala: 1 });
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(CONT.l, CONT.h, CONT.p), MAT.vernicePerla); corpo.position.y = 0.16 + CONT.h / 2; c.add(corpo);
    ass.aggiungi(corpo, { ordine: ord + 0.06, da: [0, 2.2, 0], durata: 0.16, scala: 0.96 });
    const tetto = new THREE.Mesh(new THREE.BoxGeometry(CONT.l + 0.08, 0.07, CONT.p + 0.08), MAT.acciaio); tetto.position.y = 0.16 + CONT.h + 0.02; c.add(tetto);
    ass.aggiungi(tetto, { ordine: ord + 0.16, da: [0, 0.6, 0], durata: 0.1, scala: 1 });
    // angolari con bulloni
    const trAng = [], trBul = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      trAng.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 - 0.1), 0.14, sz * (CONT.p / 2 - 0.1)), ordine: ord + 0.02, da: [0, -0.3, 0] });
      for (const d of [-0.06, 0.06]) trBul.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 - 0.1) + d, 0.29, sz * (CONT.p / 2 + 0.01)), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), ordine: ord + 0.05, da: [0, 0, sz * 0.2] });
    }
    const ang = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), MAT.acciaio, trAng.length); c.add(ang); ass.aggiungiIstanze(ang, trAng, { durata: 0.1, scala: 1 });
    const bul = new THREE.InstancedMesh(GEO.bullone, MAT.bronzo, trBul.length); c.add(bul); minuterie.push(bul); ass.aggiungiIstanze(bul, trBul, { durata: 0.08, scala: 1 });
    // porte: sei per container, con maniglia; alcune si aprono sui rack
    for (let i = 0; i < 6; i++) {
      const cerniera = new THREE.Group();
      const x0 = -CONT.l / 2 + 0.08 + i * 0.985;
      cerniera.position.set(x0, 0.16 + 0.2 + 1.25, CONT.p / 2 + 0.02);
      c.add(cerniera);
      const porta = new THREE.Mesh(geoPorta, MAT.vernicePerla); porta.position.set(0.47, 0, 0); cerniera.add(porta);
      const maniglia = new THREE.Mesh(geoManiglia, MAT.inox); maniglia.position.set(0.84, 0, 0.04); cerniera.add(maniglia);
      ass.aggiungi(cerniera, { ordine: ord + 0.2 + i * 0.03, da: [0, 0, 0.5], durata: 0.12, scala: 1 });
      const aperta = porteAperte.includes(i);
      porte.push({ cerniera, aperta, ordine: ord + 0.42 + i * 0.02 });
      if (aperta) {
        // il rack dietro la porta: telaio scuro, moduli impilati, un led per modulo
        const rack = new THREE.Group(); rack.position.set(x0 + 0.49, 0.16, CONT.p / 2 - 0.55); c.add(rack);
        const telaio = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.55, 0.9), MAT.grafite); telaio.position.set(0, 1.28, -0.2); rack.add(telaio);
        ass.aggiungi(telaio, { ordine: ord + 0.3 + i * 0.02, da: [0, 0, -0.8], durata: 0.12, scala: 1 });
        const trMod = [], trLed = [];
        for (let k = 0; k < 16; k++) {
          trMod.push({ pos: new THREE.Vector3(0, 0.22 + k * 0.145, 0.1), ordine: ord + 0.36 + i * 0.02 + k * 0.012, da: [0, 0, -0.5] });
          trLed.push({ pos: new THREE.Vector3(0.3, 0.22 + k * 0.145 + 0.02, 0.415), ordine: ord + 0.55 + k * 0.02, da: [0, 0, 0] });
        }
        const moduli = new THREE.InstancedMesh(geoModulo, MAT.verniceScura, trMod.length); rack.add(moduli); ass.aggiungiIstanze(moduli, trMod, { durata: 0.1, scala: 1 });
        const leds = new THREE.InstancedMesh(geoLed, new THREE.MeshBasicMaterial({ color: '#ffd27a' }), trLed.length); rack.add(leds); ass.aggiungiIstanze(leds, trLed, { durata: 0.06, scala: 1 });
        led.push(leds);
      }
    }
    // unità di raffreddamento sul fianco, con le alette
    const lato = x < 0 ? -1 : 1;
    const hvac = new THREE.Group(); hvac.position.set(lato * (CONT.l / 2 + 0.22), 0.16 + 1.4, 0); c.add(hvac);
    const cassa = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.7, 1.3), MAT.vernicePerla); hvac.add(cassa);
    const trAl = []; for (let k = 0; k < 14; k++) trAl.push({ pos: new THREE.Vector3(lato * 0.23, -0.65 + k * 0.1, 0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), ordine: k / 14, da: [0, 0, 0] });
    const alette = new THREE.InstancedMesh(geoAletta, MAT.acciaio, trAl.length); hvac.add(alette); ass.aggiungiIstanze(alette, trAl, { durata: 0.5, scala: 1 });
    ass.aggiungi(hvac, { ordine: ord + 0.4, da: [lato * 1.2, 0, 0], durata: 0.14, scala: 0.9 });
    return c;
  }
  // i container dietro, in fila; davanti a sinistra il PCS, davanti a destra il trasformatore
  container(-4.3, [2, 3]);
  container(4.3, [1]);
  for (const c of gruppo.children) c.position.z -= 2.5;

  // PCS: armadio con feritoie e ventola in cima
  const pcs = new THREE.Group(); pcs.position.set(-6.0, 0, 3.0); gruppo.add(pcs);
  const armadio = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 1.2), MAT.vernicePerla); armadio.position.y = 1.15 + 0.1; pcs.add(armadio);
  const basePcs = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.1), MAT.acciaioScuro); basePcs.position.y = 0.05; pcs.add(basePcs);
  const trFer = []; for (let k = 0; k < 18; k++) trFer.push({ pos: new THREE.Vector3(-0.55, 0.55 + k * 0.085, 0.61), ordine: k / 18, da: [0, 0, 0] });
  for (let k = 0; k < 18; k++) trFer.push({ pos: new THREE.Vector3(0.55, 0.55 + k * 0.085, 0.61), ordine: k / 18, da: [0, 0, 0] });
  const feritoie = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.028, 0.04), MAT.acciaio, trFer.length); pcs.add(feritoie); minuterie.push(feritoie);
  ass.aggiungiIstanze(feritoie, trFer, { durata: 0.4, scala: 1 });
  const schermo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: '#2a2a40' })); schermo.position.set(0, 2.05, 0.61); pcs.add(schermo);
  const ventola = new THREE.Group(); ventola.position.set(0, 2.3 + 0.1, 0); pcs.add(ventola);
  const anello = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 40), MAT.acciaio); anello.rotation.x = Math.PI / 2; ventola.add(anello);
  const girante = new THREE.Group(); ventola.add(girante);
  const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), MAT.grafite); girante.add(mozzo);
  for (let k = 0; k < 5; k++) { const pala = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.12), MAT.acciaio); pala.position.set(Math.cos(k / 5 * 6.283) * 0.25, 0, Math.sin(k / 5 * 6.283) * 0.25); pala.rotation.y = -k / 5 * 6.283; pala.rotation.x = 0.5; girante.add(pala); }
  ventole.push(girante);
  ass.aggiungi(pcs, { ordine: 0.46, da: [0, -2, 0], durata: 0.16, scala: 0.9 });
  ass.aggiungi(ventola, { ordine: 0.62, da: [0, 0.8, 0], durata: 0.1, scala: 0.5 });

  // trasformatore: cassa con alette, conservatore, tre isolatori
  const trafo = new THREE.Group(); trafo.position.set(5.5, 0, 3.2); gruppo.add(trafo);
  const cassa = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 1.4), MAT.grafite); cassa.position.y = 0.1 + 0.9; trafo.add(cassa);
  const baseTrafo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.6), MAT.acciaioScuro); baseTrafo.position.y = 0.05; trafo.add(baseTrafo);
  const trFin = [];
  for (const sz of [-1, 1]) for (let k = 0; k < 12; k++) trFin.push({ pos: new THREE.Vector3(-0.85 + k * 0.155, 1.0, sz * 0.95), ordine: 0.1 + k / 12 * 0.8, da: [0, 0, sz * 0.4] });
  const alette = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.5, 0.5), MAT.acciaioScuro, trFin.length); trafo.add(alette); ass.aggiungiIstanze(alette, trFin, { durata: 0.25, scala: 1 });
  const conservatore = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 24), MAT.grafite); conservatore.rotation.z = Math.PI / 2; conservatore.position.set(0, 2.3, -0.35); trafo.add(conservatore);
  const profiloIsolatore = []; for (let k = 0; k <= 24; k++) { const y = k / 24; const r = 0.07 + (k % 4 === 2 ? 0.08 : 0); profiloIsolatore.push(new THREE.Vector2(r, y * 0.7)); }
  const geoIso = new THREE.LatheGeometry(profiloIsolatore, 24);
  const trIso = [-0.6, 0, 0.6].map((x, i) => ({ pos: new THREE.Vector3(x, 1.9, 0.2), ordine: i / 3, da: [0, 0.5, 0] }));
  const isolatori = new THREE.InstancedMesh(geoIso, MAT.vernicePerla, 3); trafo.add(isolatori); ass.aggiungiIstanze(isolatori, trIso, { durata: 0.4, scala: 0.7 });
  const trBulT = [];
  for (let k = 0; k < 10; k++) trBulT.push({ pos: new THREE.Vector3(-0.9 + k * 0.2, 1.82, 0.71), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), ordine: k / 10, da: [0, 0, 0.1] });
  const bulT = new THREE.InstancedMesh(GEO.bullone, MAT.bronzo, trBulT.length); trafo.add(bulT); minuterie.push(bulT); ass.aggiungiIstanze(bulT, trBulT, { durata: 0.3, scala: 1 });
  ass.aggiungi(trafo, { ordine: 0.52, da: [0, -1.5, 0], durata: 0.16, scala: 0.9 });
  ass.aggiungi(conservatore, { ordine: 0.66, da: [0, 0.6, 0], durata: 0.1, scala: 0.8 });

  // passerelle dei cavi, a terra
  const trPass = [
    { pos: new THREE.Vector3(-6.0, 0.07, 0.4), ordine: 0.6, da: [0, -0.2, 0] },
    { pos: new THREE.Vector3(-0.2, 0.07, 3.0), ordine: 0.62, da: [0, -0.2, 0] },
  ];
  const passerelle = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.08, 3.2), MAT.acciaioScuro, 2); gruppo.add(passerelle); ass.aggiungiIstanze(passerelle, trPass, { durata: 0.1, scala: 1 });

  // il filo d'oro: dai container al PCS, al trasformatore, poi su verso la rete e l'orizzonte
  const linea = creaLineaLuce([
    [-4.3, 3.3, -2.5], [-5.6, 3.2, 0.2], [-6.0, 2.75, 3.0], [-3.0, 2.9, 3.6], [0, 2.9, 3.6], [5.5, 2.7, 3.4], [5.5, 2.9, 3.2],
    [5.2, 4.6, 0.5], [4.0, 8.0, -8], [2.5, 13, -24], [1, 18, -50],
  ], { raggio: 0.022, impulsi: 7, velocita: 0.3, colore: '#ffc45c', intensita: 0.38 });
  gruppo.add(linea.mesh);
  const linea2 = creaLineaLuce([[4.3, 3.3, -2.5], [1.0, 3.3, -1.2], [-3.2, 3.3, -0.2], [-5.8, 2.9, 2.9]], { raggio: 0.022, impulsi: 3, velocita: 0.3, colore: '#ffc45c', intensita: 0.45 });
  gruppo.add(linea2.mesh);

  return {
    gruppo, assemblaggio: ass,
    aggiorna(tempo, camera, a) {
      // le porte si aprono piano una dopo l'altra; la ventola gira; i led si accendono: l'impianto è in carica
      for (const p of porte) {
        if (!p.aperta) continue;
        const k = facile.dentroFuori(Math.min(1, Math.max(0, (a - p.ordine) / 0.16)));
        p.cerniera.rotation.y = -k * THREE.MathUtils.degToRad(118);
      }
      const giro = Math.min(1, Math.max(0, (a - 0.72) / 0.2));
      for (const g of ventole) g.rotation.y += giro * 2.2 * (1 / 60);
      const v = Math.min(1, Math.max(0, (a - 0.78) / 0.22));
      linea.aggiorna(tempo, v); linea2.aggiorna(tempo, v);
    },
    setQualita(liv) { for (const m of minuterie) m.userData.spento = !liv.dettagli; },
  };
}
