// Accumulo BESS per la Galleria Bianca (copia di macchine/bess.js rivista per la sala chiara):
// due container in lamiera perla con porte in grigio pietra, giunti scuri, maniglie e cerniere leggibili;
// le porte verso la camera si aprono sui rack; PCS con feritoie scure e ventola; trasformatore in ghisa.
// Niente filo d'oro, niente passerelle che galleggiano. Layout compatto: le macchine stanno in un blocco di 14 m.
import * as THREE from 'three';
import { Assemblaggio, facile } from '../../scena/assemblaggio.js';
import { MAT, GEO } from '../../macchine/materiali.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CONT = { l: 6.06, h: 2.9, p: 2.44 };

// materiali propri del BESS in galleria (i condivisi restano come sono per il fotovoltaico)
export const MAT_BESS = {
  lamiera:   new THREE.MeshStandardMaterial({ color: '#E3DED4', metalness: 0.25, roughness: 0.36, envMapIntensity: 1.0 }),
  porta:     new THREE.MeshStandardMaterial({ color: '#D5D0C6', metalness: 0.25, roughness: 0.38, envMapIntensity: 1.0 }),
  tetto:     new THREE.MeshStandardMaterial({ color: '#B3B0A9', metalness: 0.6,  roughness: 0.45, envMapIntensity: 1.0 }),
  giunto:    new THREE.MeshStandardMaterial({ color: '#5A5B5C', metalness: 0.5,  roughness: 0.6,  envMapIntensity: 0.8 }),
  angolare:  new THREE.MeshStandardMaterial({ color: '#7E7C78', metalness: 0.8,  roughness: 0.45, envMapIntensity: 1.0 }),
  ferro:     new THREE.MeshStandardMaterial({ color: '#9A9791', metalness: 0.9,  roughness: 0.35, envMapIntensity: 1.1 }),
  ghisa:     new THREE.MeshStandardMaterial({ color: '#3E4247', metalness: 0.5,  roughness: 0.55, envMapIntensity: 0.9 }),
  rackScuro: new THREE.MeshStandardMaterial({ color: '#2C2F33', metalness: 0.4,  roughness: 0.6,  envMapIntensity: 0.7 }),
  modulo:    new THREE.MeshStandardMaterial({ color: '#D9D5CD', metalness: 0.2,  roughness: 0.5,  envMapIntensity: 0.8 }), // i moduli: cassetti chiari
  fascia:    new THREE.MeshStandardMaterial({ color: '#25282C', metalness: 0.4,  roughness: 0.6,  envMapIntensity: 0.6 }), // la fascia scura con il led
  led:       new THREE.MeshBasicMaterial({ color: '#FFF4E2', toneMapped: false }), // led bianco caldo, pieno, senza alone
  schermo:   new THREE.MeshBasicMaterial({ color: '#2E3136' }),
  porcellana: new THREE.MeshStandardMaterial({ color: '#ECE8E0', metalness: 0.05, roughness: 0.4, envMapIntensity: 0.8 }),
  interno:   new THREE.MeshStandardMaterial({ color: '#2A2D31', metalness: 0.3,  roughness: 0.7,  envMapIntensity: 0.4, side: THREE.BackSide }), // le pareti interne del container
  nulla:     new THREE.MeshBasicMaterial({ visible: false }), // la faccia anteriore del corpo: non c'è, ci sono le porte
};

for (const m of Object.values(MAT_BESS)) m.userData.proprio = true;

// disposizione (nel sistema del gruppo): container dietro, PCS davanti a sinistra, trasformatore davanti al centro-destra
export const POSA = {
  // aperte: porta → lato della cerniera (+1 a sinistra, si apre verso sinistra; -1 a destra): due porte vicine si aprono a libro sui rack
  containerA: { x: -3.7, z: -2.2, aperte: { 3: 1, 4: -1 } },
  containerB: { x: 3.7, z: -2.2, aperte: { 4: 1, 5: -1 } },
  pcs: { x: -5.3, z: 2.7 },   // davanti alle porte chiuse del container A
  trafo: { x: 2.2, z: 2.4 },  // davanti al varco tra i container: non copre le porte aperte

};

export function creaBess(gruppo) {
  const ass = new Assemblaggio();
  const minuterie = []; // bulloni, feritoie, cerniere: spenti al livello basso
  const porte = [], ventole = [];

  // la porta: lamiera con tre nervature verticali fuse in una sola geometria (una chiamata per porta)
  const geoPorta = mergeGeometries([
    new THREE.BoxGeometry(0.93, 2.46, 0.04),
    ...[-0.29, 0, 0.29].map((x) => new THREE.BoxGeometry(0.07, 2.26, 0.016).translate(x, 0, 0.026)),
  ]);
  const geoManiglia = new THREE.CylinderGeometry(0.014, 0.014, 0.30, 10);
  const geoStaffa = new THREE.BoxGeometry(0.05, 0.04, 0.06);
  const geoCerniera = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8);
  const geoModulo = new THREE.BoxGeometry(0.8, 0.24, 0.14);   // il fronte di un modulo batteria
  const geoFascia = new THREE.BoxGeometry(0.8, 0.07, 0.014);   // fascia scura in basso al modulo
  const geoLed = new THREE.BoxGeometry(0.52, 0.03, 0.012);     // striscia led, una per modulo
  const geoAletta = new THREE.BoxGeometry(1.06, 0.03, 0.05);
  const geoNervatura = new THREE.BoxGeometry(0.06, CONT.h - 0.3, 0.03);

  function container({ x, z, aperte }, lato) {
    const c = new THREE.Group(); c.position.set(x, 0, z); gruppo.add(c);
    const ord = x < 0 ? 0 : 0.05;
    // slitta d'acciaio scuro, corpo in lamiera, tetto più scuro con un bordo
    const slitta = new THREE.Mesh(new THREE.BoxGeometry(CONT.l - 0.1, 0.16, CONT.p - 0.2), MAT_BESS.giunto); slitta.position.y = 0.08; c.add(slitta);
    ass.aggiungi(slitta, { ordine: ord, da: [0, -0.3, 0], durata: 0.12, scala: 1 });
    // il corpo: lamiera su cinque lati, il fronte è aperto (ci sono le porte); dentro, pareti scure
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(CONT.l, CONT.h, CONT.p), [MAT_BESS.lamiera, MAT_BESS.lamiera, MAT_BESS.lamiera, MAT_BESS.lamiera, MAT_BESS.nulla, MAT_BESS.lamiera]); corpo.position.y = 0.16 + CONT.h / 2; c.add(corpo);
    ass.aggiungi(corpo, { ordine: ord + 0.06, da: [0, 2.2, 0], durata: 0.16, scala: 0.96 });
    const interno = new THREE.Mesh(new THREE.BoxGeometry(CONT.l - 0.03, CONT.h - 0.03, CONT.p - 0.03), MAT_BESS.interno); interno.position.y = 0.16 + CONT.h / 2; c.add(interno);
    ass.aggiungi(interno, { ordine: ord + 0.06, da: [0, 2.2, 0], durata: 0.16, scala: 0.96 });
    // dietro le porte chiuse: un pannello scuro per vano, così le fughe tra le porte si leggono; dietro quelle aperte c'è il rack
    const trRetro = [];
    for (let i = 0; i < 6; i++) if (!aperte[i]) trRetro.push({ pos: new THREE.Vector3(-CONT.l / 2 + 0.085 + i * 0.985 + 0.465, 0.16 + CONT.h / 2, CONT.p / 2 + 0.005), ordine: ord + 0.08, da: [0, 2.2, 0] });
    const retro = new THREE.InstancedMesh(new THREE.BoxGeometry(0.985, CONT.h - 0.3, 0.02), MAT_BESS.giunto, trRetro.length); c.add(retro);
    ass.aggiungiIstanze(retro, trRetro, { durata: 0.16, scala: 0.96 });
    const tetto = new THREE.Mesh(new THREE.BoxGeometry(CONT.l + 0.1, 0.08, CONT.p + 0.1), MAT_BESS.tetto); tetto.position.y = 0.16 + CONT.h + 0.03; c.add(tetto);
    ass.aggiungi(tetto, { ordine: ord + 0.16, da: [0, 0.6, 0], durata: 0.1, scala: 1 });
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(CONT.l + 0.12, 0.06, CONT.p + 0.12), MAT_BESS.giunto); cornice.position.y = 0.16 + CONT.h - 0.03; c.add(cornice);
    ass.aggiungi(cornice, { ordine: ord + 0.15, da: [0, 0.6, 0], durata: 0.1, scala: 1 });
    // nervature verticali sul retro e sui fianchi (la lamiera ondulata del container)
    const trNer = [];
    for (let i = 0; i < 20; i++) trNer.push({ pos: new THREE.Vector3(-CONT.l / 2 + 0.3 + i * 0.29, 0.16 + CONT.h / 2 + 0.05, -CONT.p / 2 - 0.015), ordine: ord + 0.1 + i * 0.004, da: [0, 0, -0.2] });
    for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) trNer.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 + 0.015), 0.16 + CONT.h / 2 + 0.05, -CONT.p / 2 + 0.35 + i * 0.29), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), ordine: ord + 0.1 + i * 0.004, da: [sx * 0.2, 0, 0] });
    const nervature = new THREE.InstancedMesh(geoNervatura, MAT_BESS.lamiera, trNer.length); c.add(nervature); minuterie.push(nervature); ass.aggiungiIstanze(nervature, trNer, { durata: 0.1, scala: 1 });
    // angolari scuri con bulloni
    const trAng = [], trBul = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      trAng.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 - 0.1), 0.14, sz * (CONT.p / 2 - 0.1)), ordine: ord + 0.02, da: [0, -0.3, 0] });
      trAng.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 - 0.1), 0.16 + CONT.h - 0.14, sz * (CONT.p / 2 - 0.1)), ordine: ord + 0.16, da: [0, 0.6, 0] });
      for (const d of [-0.06, 0.06]) trBul.push({ pos: new THREE.Vector3(sx * (CONT.l / 2 - 0.1) + d, 0.29, sz * (CONT.p / 2 + 0.01)), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), ordine: ord + 0.05, da: [0, 0, sz * 0.2] });
    }
    const ang = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), MAT_BESS.angolare, trAng.length); c.add(ang); ass.aggiungiIstanze(ang, trAng, { durata: 0.1, scala: 1 });
    const bul = new THREE.InstancedMesh(GEO.bullone, MAT_BESS.ferro, trBul.length); c.add(bul); minuterie.push(bul); ass.aggiungiIstanze(bul, trBul, { durata: 0.08, scala: 1 });
    // porte: sei per container, con maniglia, staffe e due cerniere; quelle verso la camera si aprono sui rack
    const trCer = [], trStaffe = [];
    for (let i = 0; i < 6; i++) {
      const cerniera = new THREE.Group();
      const x0 = -CONT.l / 2 + 0.085 + i * 0.985;
      const lato = aperte[i] || 1; // da che parte sta la cerniera
      const xc = lato > 0 ? x0 : x0 + 0.93;
      cerniera.position.set(xc, 0.16 + 0.22 + 1.23, CONT.p / 2 + 0.05);
      c.add(cerniera);
      const porta = new THREE.Mesh(geoPorta, MAT_BESS.porta); porta.position.set(lato * 0.465, 0, 0); cerniera.add(porta);
      const maniglia = new THREE.Mesh(geoManiglia, MAT_BESS.giunto); maniglia.position.set(lato * 0.82, -0.05, 0.065); cerniera.add(maniglia);
      for (const dy of [-0.13, 0.13]) { const st = new THREE.Mesh(geoStaffa, MAT_BESS.giunto); st.position.set(lato * 0.82, -0.05 + dy, 0.04); cerniera.add(st); }
      ass.aggiungi(cerniera, { ordine: ord + 0.2 + i * 0.03, da: [0, 0, 0.5], durata: 0.12, scala: 1 });
      for (const dy of [-0.95, 0.95]) trCer.push({ pos: new THREE.Vector3(xc, 0.16 + 0.22 + 1.23 + dy, CONT.p / 2 + 0.05), ordine: ord + 0.2 + i * 0.03, da: [0, 0, 0.5] });
      const aperta = !!aperte[i];
      porte.push({ cerniera, aperta, lato, ordine: ord + 0.42 + i * 0.02 });
      if (aperta) {
        // il rack dietro la porta: telaio antracite, otto moduli chiari impilati, ognuno con la fascia scura e la striscia led
        const rack = new THREE.Group(); rack.position.set(x0 + 0.49, 0.16, CONT.p / 2 - 0.6); c.add(rack);
        const telaio = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.72, 0.7), MAT_BESS.rackScuro); telaio.position.set(0, 1.36, -0.35); rack.add(telaio);
        ass.aggiungi(telaio, { ordine: ord + 0.3 + i * 0.02, da: [0, 0, -0.8], durata: 0.12, scala: 1 });
        const trMod = [], trFas = [], trLed = [];
        for (let k = 0; k < 8; k++) {
          const y = 0.24 + k * 0.29;
          trMod.push({ pos: new THREE.Vector3(0, y, 0.07), ordine: ord + 0.36 + i * 0.02 + k * 0.02, da: [0, 0, -0.5] });
          trFas.push({ pos: new THREE.Vector3(0, y - 0.085, 0.146), ordine: ord + 0.36 + i * 0.02 + k * 0.02, da: [0, 0, -0.5] });
          trLed.push({ pos: new THREE.Vector3(0, y - 0.085, 0.158), ordine: ord + 0.55 + k * 0.03, da: [0, 0, 0] });
        }
        const moduli = new THREE.InstancedMesh(geoModulo, MAT_BESS.modulo, trMod.length); rack.add(moduli); ass.aggiungiIstanze(moduli, trMod, { durata: 0.1, scala: 1 });
        const fasce = new THREE.InstancedMesh(geoFascia, MAT_BESS.fascia, trFas.length); rack.add(fasce); ass.aggiungiIstanze(fasce, trFas, { durata: 0.1, scala: 1 });
        const leds = new THREE.InstancedMesh(geoLed, MAT_BESS.led, trLed.length); rack.add(leds); ass.aggiungiIstanze(leds, trLed, { durata: 0.06, scala: 1 });
      }
    }
    const cerniere = new THREE.InstancedMesh(geoCerniera, MAT_BESS.giunto, trCer.length); c.add(cerniere); minuterie.push(cerniere); ass.aggiungiIstanze(cerniere, trCer, { durata: 0.12, scala: 1 });
    // unità di raffreddamento sul fianco esterno, con le alette
    const hvac = new THREE.Group(); hvac.position.set(lato * (CONT.l / 2 + 0.22), 0.16 + 1.4, 0); c.add(hvac);
    const cassa = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.7, 1.3), MAT_BESS.lamiera); hvac.add(cassa);
    const griglia = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.5, 1.1), MAT_BESS.giunto); griglia.position.x = lato * 0.225; hvac.add(griglia);
    const trAl = []; for (let k = 0; k < 14; k++) trAl.push({ pos: new THREE.Vector3(lato * 0.24, -0.65 + k * 0.1, 0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), ordine: k / 14, da: [0, 0, 0] });
    const alette = new THREE.InstancedMesh(geoAletta, MAT_BESS.ferro, trAl.length); hvac.add(alette); ass.aggiungiIstanze(alette, trAl, { durata: 0.5, scala: 1 });
    ass.aggiungi(hvac, { ordine: ord + 0.4, da: [lato * 1.2, 0, 0], durata: 0.14, scala: 0.9 });
    return c;
  }
  container(POSA.containerA, -1);
  container(POSA.containerB, 1);

  // PCS: armadio chiaro con due griglie di feritoie scure, schermo e ventola in cima
  const pcs = new THREE.Group(); pcs.position.set(POSA.pcs.x, 0, POSA.pcs.z); gruppo.add(pcs);
  const armadio = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 1.2), MAT_BESS.lamiera); armadio.position.y = 1.15 + 0.1; pcs.add(armadio);
  const basePcs = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.1), MAT_BESS.giunto); basePcs.position.y = 0.05; pcs.add(basePcs);
  const bordoPcs = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.05, 1.24), MAT_BESS.giunto); bordoPcs.position.y = 2.3 + 0.1 - 0.02; pcs.add(bordoPcs);
  for (const sx of [-0.55, 0.55]) {
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.62, 0.02), MAT_BESS.ghisa); fondo.position.set(sx, 1.32, 0.605); pcs.add(fondo);
  }
  const trFer = [];
  for (const sx of [-0.55, 0.55]) for (let k = 0; k < 18; k++) trFer.push({ pos: new THREE.Vector3(sx, 0.55 + k * 0.088, 0.625), ordine: k / 18, da: [0, 0, 0] });
  const feritoie = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.03, 0.04), MAT_BESS.lamiera, trFer.length); pcs.add(feritoie); minuterie.push(feritoie);
  ass.aggiungiIstanze(feritoie, trFer, { durata: 0.4, scala: 1 });
  const schermo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), MAT_BESS.schermo); schermo.position.set(0, 2.18, 0.61); pcs.add(schermo);
  const fessura = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.02), MAT_BESS.giunto); fessura.position.set(0, 1.15, 0.61); pcs.add(fessura);
  const ventola = new THREE.Group(); ventola.position.set(0, 2.3 + 0.1, 0); pcs.add(ventola);
  const anello = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 40), MAT_BESS.ferro); anello.rotation.x = Math.PI / 2; ventola.add(anello);
  const girante = new THREE.Group(); ventola.add(girante);
  const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), MAT_BESS.ghisa); girante.add(mozzo);
  for (let k = 0; k < 5; k++) { const pala = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.12), MAT_BESS.ferro); pala.position.set(Math.cos(k / 5 * 6.283) * 0.25, 0, Math.sin(k / 5 * 6.283) * 0.25); pala.rotation.y = -k / 5 * 6.283; pala.rotation.x = 0.5; girante.add(pala); }
  ventole.push(girante);
  ass.aggiungi(pcs, { ordine: 0.46, da: [0, -2, 0], durata: 0.16, scala: 0.9 });
  ass.aggiungi(ventola, { ordine: 0.62, da: [0, 0.8, 0], durata: 0.1, scala: 0.5 });

  // trasformatore: cassa in ghisa con alette, conservatore, tre isolatori in porcellana
  const trafo = new THREE.Group(); trafo.position.set(POSA.trafo.x, 0, POSA.trafo.z); gruppo.add(trafo);
  const cassa = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 1.4), MAT_BESS.ghisa); cassa.position.y = 0.1 + 0.9; trafo.add(cassa);
  const baseTrafo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.6), MAT_BESS.giunto); baseTrafo.position.y = 0.05; trafo.add(baseTrafo);
  const trFin = [];
  for (const sz of [-1, 1]) for (let k = 0; k < 12; k++) trFin.push({ pos: new THREE.Vector3(-0.85 + k * 0.155, 1.0, sz * 0.95), ordine: 0.1 + k / 12 * 0.8, da: [0, 0, sz * 0.4] });
  const alette = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.5, 0.5), MAT_BESS.ghisa, trFin.length); trafo.add(alette); ass.aggiungiIstanze(alette, trFin, { durata: 0.25, scala: 1 });
  const conservatore = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 24), MAT_BESS.ghisa); conservatore.rotation.z = Math.PI / 2; conservatore.position.set(0, 2.3, -0.35); trafo.add(conservatore);
  const profiloIsolatore = []; for (let k = 0; k <= 24; k++) { const y = k / 24; const r = 0.07 + (k % 4 === 2 ? 0.08 : 0); profiloIsolatore.push(new THREE.Vector2(r, y * 0.7)); }
  const geoIso = new THREE.LatheGeometry(profiloIsolatore, 24);
  const trIso = [-0.6, 0, 0.6].map((x, i) => ({ pos: new THREE.Vector3(x, 1.9, 0.2), ordine: i / 3, da: [0, 0.5, 0] }));
  const isolatori = new THREE.InstancedMesh(geoIso, MAT_BESS.porcellana, 3); trafo.add(isolatori); ass.aggiungiIstanze(isolatori, trIso, { durata: 0.4, scala: 0.7 });
  const trBulT = [];
  for (let k = 0; k < 10; k++) trBulT.push({ pos: new THREE.Vector3(-0.9 + k * 0.2, 1.82, 0.71), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), ordine: k / 10, da: [0, 0, 0.1] });
  const bulT = new THREE.InstancedMesh(GEO.bullone, MAT_BESS.ferro, trBulT.length); trafo.add(bulT); minuterie.push(bulT); ass.aggiungiIstanze(bulT, trBulT, { durata: 0.3, scala: 1 });
  // morsetti in rame sugli isolatori: l'unico rame vero della macchina
  const trRame = [-0.6, 0, 0.6].map((x, i) => ({ pos: new THREE.Vector3(x, 2.62, 0.2), ordine: 0.6 + i / 3 * 0.3, da: [0, 0.3, 0] }));
  const rame = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), MAT.bronzo, 3); trafo.add(rame); ass.aggiungiIstanze(rame, trRame, { durata: 0.3, scala: 0.5 });
  ass.aggiungi(trafo, { ordine: 0.52, da: [0, -1.5, 0], durata: 0.16, scala: 0.9 });
  ass.aggiungi(conservatore, { ordine: 0.66, da: [0, 0.6, 0], durata: 0.1, scala: 0.8 });

  return {
    gruppo, assemblaggio: ass,
    aggiorna(tempo, camera, a) {
      // le porte si aprono piano una dopo l'altra; la ventola gira: l'impianto è in carica
      for (const p of porte) {
        if (!p.aperta) continue;
        const k = facile.dentroFuori(Math.min(1, Math.max(0, (a - p.ordine) / 0.16)));
        p.cerniera.rotation.y = -p.lato * k * THREE.MathUtils.degToRad(138);
      }
      const giro = Math.min(1, Math.max(0, (a - 0.72) / 0.2));
      for (const g of ventole) g.rotation.y += giro * 2.2 * (1 / 60);
    },
    setQualita(liv) { for (const m of minuterie) m.userData.spento = !liv.dettagli; },
  };
}
