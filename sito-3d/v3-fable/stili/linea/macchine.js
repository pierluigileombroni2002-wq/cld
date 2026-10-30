// Le macchine di ERI per "Linea di Luce": le stesse geometrie procedurali (fotovoltaico x=0, BESS x=70, idroelettrico x≈140),
// ma non si compongono pezzo per pezzo: nascono da un disegno a linea che scorre lungo x e si riempiono di materia.
// I cinque passi dell'iter (vedi PASSI in testi.js) sono cinque stati visibili, distribuiti su tutto il momento:
//   Sviluppo = linee di costruzione (ingombro tratteggiato) · Autorizzazioni = il contorno viene disegnato ·
//   Ready to Build = compaiono i dettagli (bulloni, morsetti) · Costruzione = la macchina si solidifica · Gestione = la macchina si muove.
import * as THREE from 'three';
import { MOMENTI, PASSI, assemblaggioDi } from './testi.js';
import { creaFotovoltaico } from '../../macchine/fotovoltaico.js';
import { creaBess } from '../../macchine/bess.js';
import { creaTurbine } from '../../macchine/turbine.js';
import { RIVELAZIONE, aggiungiLinee, creaIngombro } from './linee.js';
import { vestiMaterialiCondivisi, vestiGruppo, MAT_LINEA_STILE } from './materiali.js';
import { MAT } from '../../macchine/materiali.js';

const lisci = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// Distanza tra le turbine: le tre macchine stanno più vicine che nello studio bianco, così entrano intere e grandi.
const DIST_TURBINE = 8.0, DIST_ORIG = 12;

// Estensione lungo x di ogni macchina (coordinate del mondo), con un piccolo margine: i fronti scorrono da x0 a x1.
const ESTENSIONI = [
  { momento: 1, x0: -11, x1: 11, box: new THREE.Box3(new THREE.Vector3(-9, 0, -14.5), new THREE.Vector3(9, 0, 12.5)) },
  { momento: 2, x0: 59, x1: 81, box: new THREE.Box3(new THREE.Vector3(-8.2, 0, -5), new THREE.Vector3(8.2, 0, 3.9)) },
  { momento: 3, x0: 127, x1: 153, box: new THREE.Box3(new THREE.Vector3(-10.9, 0, -2.4), new THREE.Vector3(10.9, 0, 2.4)) },
];

// Quando, dentro il momento (t = 0..1), si muovono i fronti: la punta disegna nel passo Autorizzazioni,
// i dettagli compaiono in Ready to Build, la materia arriva in Costruzione, in Gestione la macchina si muove.
const T_LINEA = [PASSI[1] - 0.03, PASSI[2] + 0.01];
const T_DETTAGLI = [PASSI[2] + 0.01, PASSI[3] + 0.01];
const T_MATERIA = [PASSI[3] + 0.01, PASSI[4] + 0.01];
const T_GESTIONE = [PASSI[4] + 0.01, PASSI[4] + 0.21];
const RESIDUO = { 1: 0.0, 2: 0.22, 3: 0.14 }; // il filo chiaro che resta sugli spigoli a macchina solida

function pDi(m, t) { const mm = MOMENTI[m]; return mm.da + t * (mm.a - mm.da); }

// Fronti come funzioni a tratti dello scorrimento: la punta che disegna (L) e il fronte di materia (S).
// Tra una macchina e l'altra i fronti attraversano lo spazio vuoto: una sola penna che percorre tutto il sito.
const CHIAVI_L = [], CHIAVI_S = [];
for (const e of ESTENSIONI) {
  CHIAVI_L.push([pDi(e.momento, T_LINEA[0]), e.x0], [pDi(e.momento, T_LINEA[1]), e.x1]);
  CHIAVI_S.push([pDi(e.momento, T_MATERIA[0]), e.x0], [pDi(e.momento, T_MATERIA[1]), e.x1]);
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

// --- ritocchi del BESS per questo stile: lamiera grecata sui container con il fronte aperto (ci sono le porte, e dietro
// le porte aperte si vedono i rack), interno scuro, led più leggibili, passerelle a terra tolte ---
const MAT_NULLA = new THREE.MeshBasicMaterial({ visible: false }); MAT_NULLA.userData.pronto = true;
const MAT_INTERNO = new THREE.MeshStandardMaterial({ color: '#17181b', metalness: 0.2, roughness: 0.8, side: THREE.BackSide });
MAT_INTERNO.userData.pronto = true; MAT_INTERNO.userData.senzaLinee = true;
const GEO_LED = new THREE.BoxGeometry(0.1, 0.04, 0.008);
function ritoccaBess(gruppo) {
  if (gruppo.userData.ritoccato) return;
  gruppo.userData.ritoccato = true;
  const corpi = [];
  gruppo.traverse((o) => {
    if (!o.isMesh) return;
    const par = o.geometry.parameters || {};
    if (o.isInstancedMesh && o.count === 2 && Math.abs((par.depth || 0) - 3.2) < 1e-6) { o.visible = false; o.userData.spento = true; }  // passerelle dei cavi
    if (!o.isInstancedMesh && Math.abs((par.width || 0) - 6.06) < 1e-6 && Math.abs((par.height || 0) - 2.9) < 1e-6) corpi.push(o);          // corpo dei container
    if (o.isInstancedMesh && o.count === 16 && o.material.isMeshBasicMaterial) o.geometry = GEO_LED;                                      // led dei rack
  });
  const g = MAT_LINEA_STILE.grecata;
  for (const corpo of corpi) {
    corpo.material = [g, g, g, g, MAT_NULLA, g];
    const interno = new THREE.Mesh(new THREE.BoxGeometry(6.06 - 0.03, 2.9 - 0.03, 2.44 - 0.03), MAT_INTERNO);
    interno.position.copy(corpo.position);
    corpo.parent.add(interno);
  }
}

// --- ritocchi delle turbine: più vicine tra loro, ugello Pelton in rame spento, casse in ghisa ---
function ritoccaTurbine(gruppo) {
  for (const c of gruppo.children) {
    if (Math.abs(Math.abs(c.position.x) - DIST_ORIG) < 1e-6) {
      c.position.x = Math.sign(c.position.x) * DIST_TURBINE;
      if (c.userData.ass) c.userData.ass.base.x = c.position.x; // le basi stanno nell'assemblaggio: anche la loro posa di riferimento si sposta
    }
  }
  gruppo.traverse((o) => {
    if (!o.isMesh) return;
    const par = o.geometry.parameters || {};
    // il gomito dell'ugello (toro r=0.5, tubo 0.17) identifica il gruppo dell'ugello: tubi e cono in rame, flange in acciaio
    if (o.geometry.type === 'TorusGeometry' && Math.abs(par.radius - 0.5) < 1e-6 && Math.abs(par.tube - 0.17) < 1e-6) {
      for (const f of o.parent.children) {
        if (!f.isMesh || f.material.blending === THREE.AdditiveBlending) continue;
        f.material = MAT_LINEA_STILE.rame;
      }
    }
  });
  // la cassa a spirale della Francis e il suo ingresso: ghisa scura, non lamiera verniciata
  gruppo.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && o.material === MAT.vernicePerla) o.material = MAT_LINEA_STILE.ghisa;
  });
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
  ritoccaBess(gruppi.bess);
  ritoccaTurbine(gruppi.idroelettrico);
  // Gestione: la macchina si muove solo nell'ultimo passo. Ogni macchina legge il suo "a" in modo diverso: qui si traduce.
  costruttori.push({ momento: MOMENTI[1], ...fv, mappa: (g) => 0.45 + 0.55 * g });             // la tavola si inclina verso la luce
  costruttori.push({ momento: MOMENTI[2], ...bess, mappa: (g) => g });                          // porte che si aprono, ventola che gira
  costruttori.push({ momento: MOMENTI[3], ...turbine, mappa: (g) => 0.92 + 0.1 * g });          // le giranti complete, poi girano piano

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

  const scalaX = DIST_TURBINE / DIST_ORIG;
  return {
    gruppi,
    segmenti,
    pronto: Promise.resolve(),
    ancoreTurbine: () => turbine.ancore().map((a) => { a.pos.x = 140 + (a.pos.x - 140) * scalaX; return a; }),
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
      let dettagli = 0, residuo = 0;
      costruttori.forEach((c, i) => {
        const t = assemblaggioDi(p, c.momento);
        const vicino = p > c.momento.da - 0.03 && p < c.momento.a + 0.035;
        c.gruppo.visible = vicino && t > 0.012;
        if (!c.gruppo.visible) return;
        c.assemblaggio.set(1);
        const g = lisci((t - T_GESTIONE[0]) / (T_GESTIONE[1] - T_GESTIONE[0]));
        c.aggiorna?.(tempo, camera, c.mappa(g));
        // linee di costruzione: compaiono nel passo Sviluppo, se ne vanno quando la materia arriva
        c.ingombro.material.opacity = 0.45 * lisci((t - 0.015) / 0.08) * (1 - lisci((t - (T_MATERIA[0] - 0.04)) / 0.08));
        c.ingombro.visible = c.ingombro.material.opacity > 0.002;
        if (p >= c.momento.da - 0.015 && p <= c.momento.a + 0.015) {
          dettagli = lisci((t - T_DETTAGLI[0]) / (T_DETTAGLI[1] - T_DETTAGLI[0]));
          residuo = RESIDUO[i + 1] || 0;
        }
      });
      RIVELAZIONE.uDettagli.value = dettagli;
      RIVELAZIONE.uResiduo.value = residuo;
    },
    setQualita(livello) {
      for (const c of costruttori) { c.setQualita?.(livello); c.assemblaggio.t = -1; c.assemblaggio.set(1); }
    },
  };
}
