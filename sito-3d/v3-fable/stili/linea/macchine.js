// Le macchine di ERI per "Linea di Luce": le stesse geometrie procedurali (fotovoltaico x=0, BESS x=70, idroelettrico x≈140),
// ma non si compongono pezzo per pezzo: nascono da un disegno a linea che scorre lungo x e si riempiono di materia.
// I cinque passi dell'iter sono cinque stati visibili:
//   Sviluppo = linee di costruzione (ingombro tratteggiato) · Autorizzazioni = il contorno viene disegnato ·
//   Ready to Build = compaiono i dettagli (bulloni, morsetti) · Costruzione = la macchina si solidifica · Gestione = la macchina si muove.
import * as THREE from 'three';
import { MOMENTI, assemblaggioDi } from '../../ui/testi.js';
import { creaFotovoltaico } from '../../macchine/fotovoltaico.js';
import { creaBess } from '../../macchine/bess.js';
import { creaTurbine } from '../../macchine/turbine.js';
import { RIVELAZIONE, aggiungiLinee, creaIngombro } from './linee.js';
import { vestiMaterialiCondivisi, vestiGruppo } from './materiali.js';

const lisci = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// Estensione lungo x di ogni macchina (coordinate del mondo), con un piccolo margine: i fronti scorrono da x0 a x1.
const ESTENSIONI = [
  { momento: 1, x0: -11, x1: 11, box: new THREE.Box3(new THREE.Vector3(-9, 0, -14.5), new THREE.Vector3(9, 0, 12.5)) },
  { momento: 2, x0: 59, x1: 81, box: new THREE.Box3(new THREE.Vector3(-8.2, 0, -5), new THREE.Vector3(8.2, 0, 4.6)) },
  { momento: 3, x0: 121, x1: 159, box: new THREE.Box3(new THREE.Vector3(-15, 0, -2.4), new THREE.Vector3(15, 0, 2.4)) },
];

// p dello scorrimento in cui la macchina del momento m è all'avanzamento a (0..1)
function pDi(m, a) { const mm = MOMENTI[m]; return mm.da + a * 0.6 * (mm.a - mm.da); }

// Fronti come funzioni a tratti dello scorrimento: la punta che disegna (L) e il fronte di materia (S).
// Tra una macchina e l'altra i fronti attraversano lo spazio vuoto: una sola penna che percorre tutto il sito.
const CHIAVI_L = [], CHIAVI_S = [];
for (const e of ESTENSIONI) {
  CHIAVI_L.push([pDi(e.momento, 0.10), e.x0], [pDi(e.momento, 0.42), e.x1]);
  CHIAVI_S.push([pDi(e.momento, 0.58), e.x0], [pDi(e.momento, 0.84), e.x1]);
}
function aTratti(chiavi, p) {
  if (p <= chiavi[0][0]) return chiavi[0][1];
  for (let i = 1; i < chiavi.length; i++) {
    if (p <= chiavi[i][0]) {
      const [p0, x0] = chiavi[i - 1], [p1, x1] = chiavi[i];
      return x0 + (x1 - x0) * ((p - p0) / (p1 - p0));
    }
  }
  return chiavi[chiavi.length - 1][1];
}

export function creaMacchine(scena, env) {
  vestiMaterialiCondivisi();

  const gruppi = { fotovoltaico: new THREE.Group(), bess: new THREE.Group(), idroelettrico: new THREE.Group() };
  gruppi.fotovoltaico.position.set(0, 0, 0);
  gruppi.bess.position.set(70, 0, 0);
  gruppi.idroelettrico.position.set(140, 0, 0);
  for (const g of Object.values(gruppi)) scena.add(g);

  const costruttori = [];
  const fv = creaFotovoltaico(gruppi.fotovoltaico);
  const bess = creaBess(gruppi.bess);
  const turbine = creaTurbine(gruppi.idroelettrico);
  // Gestione: la macchina si muove solo nell'ultimo passo. Ogni macchina legge il suo "a" in modo diverso: qui si traduce.
  costruttori.push({ momento: MOMENTI[1], ...fv, mappa: (g) => 0.45 + 0.55 * g });             // la tavola si inclina verso la luce
  costruttori.push({ momento: MOMENTI[2], ...bess, mappa: (g) => g });                          // porte che si aprono, ventola che gira
  costruttori.push({ momento: MOMENTI[3], ...turbine, mappa: (g) => 0.92 + 0.1 * g });          // le giranti complete; la Kaplan parte per ultima

  let segmenti = 0;
  costruttori.forEach((c, i) => {
    c.assemblaggio.set(1);
    vestiGruppo(c.gruppo);
    const s = aggiungiLinee(c.gruppo);
    segmenti += s.segmenti;
    c.ingombro = creaIngombro(ESTENSIONI[i].box, 0.6);
    c.gruppo.add(c.ingombro);
    c.gruppo.visible = false;
  });

  return {
    gruppi,
    segmenti,
    pronto: Promise.resolve(),
    ancoreTurbine: () => turbine.ancore(),
    // Avanzamento 0..1 del momento tecnologico corrente (o -1)
    stato(p) {
      for (const c of costruttori) {
        const a = assemblaggioDi(p, c.momento);
        if (p >= c.momento.da - 0.015 && p <= c.momento.a + 0.015) return { a, momento: c.momento };
      }
      return { a: -1, momento: null };
    },
    aggiorna(p, tempo, camera) {
      RIVELAZIONE.uSogliaL.value = aTratti(CHIAVI_L, p);
      RIVELAZIONE.uSogliaS.value = aTratti(CHIAVI_S, p);
      let dettagli = 0;
      for (const c of costruttori) {
        const a = assemblaggioDi(p, c.momento);
        const vicino = p > c.momento.da - 0.08 && p < c.momento.a + 0.1;
        c.gruppo.visible = vicino && a > 0.015;
        if (!c.gruppo.visible) continue;
        c.assemblaggio.set(1);
        const g = lisci((a - 0.8) / 0.2);
        c.aggiorna?.(tempo, camera, c.mappa(g));
        // linee di costruzione: compaiono nel passo Sviluppo, se ne vanno quando la materia arriva
        c.ingombro.material.opacity = 0.45 * lisci((a - 0.02) / 0.1) * (1 - lisci((a - 0.58) / 0.12));
        c.ingombro.visible = c.ingombro.material.opacity > 0.002;
        if (p >= c.momento.da - 0.015 && p <= c.momento.a + 0.015) dettagli = lisci((a - 0.42) / 0.15);
      }
      RIVELAZIONE.uDettagli.value = dettagli;
    },
    setQualita(livello) {
      for (const c of costruttori) { c.setQualita?.(livello); c.assemblaggio.t = -1; c.assemblaggio.set(1); }
    },
  };
}
