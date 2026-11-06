// Le macchine nella Galleria Bianca: fotovoltaico (condiviso, x=0), BESS e turbine nelle versioni per la sala chiara.
import * as THREE from 'three';
import { MOMENTI, assemblaggioDi, macchinaInScena } from './momenti.js';
import { creaFotovoltaico } from '../../macchine/fotovoltaico.js';
import { creaBess } from './bess-galleria.js';
import { creaTurbine } from './turbine-galleria.js';

export function creaMacchine(scena) {
  const gruppi = { fotovoltaico: new THREE.Group(), bess: new THREE.Group(), idroelettrico: new THREE.Group() };
  gruppi.fotovoltaico.position.set(1.5, 0, 0); // 1,5 m a destra: il tracker vicino a sinistra non è più tagliato dal bordo
  gruppi.bess.position.set(70, 0, 0);
  gruppi.idroelettrico.position.set(140, 0, 0);
  for (const g of Object.values(gruppi)) scena.add(g);

  // i costruttori, nell'ordine dei momenti 1, 2, 3
  const costruttori = [];
  costruttori.push({ indice: 1, ...creaFotovoltaico(gruppi.fotovoltaico) });
  costruttori.push({ indice: 2, ...creaBess(gruppi.bess) });
  const turbine = creaTurbine(gruppi.idroelettrico);
  costruttori.push({ indice: 3, ...turbine });

  return {
    gruppi,
    pronto: Promise.resolve(),
    ancoreTurbine: () => turbine.ancore(),
    aggiorna(p, tempo, camera) {
      for (const c of costruttori) {
        c.gruppo.visible = macchinaInScena(c.indice, p);
        if (c.gruppo.visible) { const a = assemblaggioDi(p, MOMENTI[c.indice]); c.assemblaggio.set(a); c.aggiorna?.(tempo, camera, a); }
      }
    },
    // La macchina del momento `indice` montata fino ad `a`, come sarà in scena in quel punto (pezzi in volo compresi):
    // serve a misurarne l'ingombro. Il fotogramma dopo, aggiorna() rimette ogni macchina allo stato giusto.
    monta(indice, a, camera) {
      const c = costruttori.find((x) => x.indice === indice);
      c.assemblaggio.set(a); c.aggiorna?.(0, camera, a);
      return c.gruppo;
    },
    setQualita(livello) {
      for (const c of costruttori) c.setQualita?.(livello);
    },
  };
}
