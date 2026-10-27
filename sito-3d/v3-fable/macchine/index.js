// Le macchine di ERI, in fila nello studio: fotovoltaico (x=0), BESS (x=70), idroelettrico (x≈140).
// Ogni macchina si compone con lo scorrimento (vedi scena/assemblaggio.js).
import * as THREE from 'three';
import { MOMENTI, assemblaggioDi } from '../ui/testi.js';
import { creaFotovoltaico } from './fotovoltaico.js';
import { creaBess } from './bess.js';
import { creaTurbine } from './turbine.js';

export function creaMacchine(scena, env) {
  const gruppi = { fotovoltaico: new THREE.Group(), bess: new THREE.Group(), idroelettrico: new THREE.Group() };
  gruppi.fotovoltaico.position.set(0, 0, 0);
  gruppi.bess.position.set(70, 0, 0);
  gruppi.idroelettrico.position.set(140, 0, 0);
  for (const g of Object.values(gruppi)) scena.add(g);

  const costruttori = []; // { gruppo, assemblaggio, momento, aggiorna(tempo, camera, a), setQualita(liv) }
  costruttori.push({ momento: MOMENTI[1], ...creaFotovoltaico(gruppi.fotovoltaico) });
  costruttori.push({ momento: MOMENTI[2], ...creaBess(gruppi.bess) });
  const turbine = creaTurbine(gruppi.idroelettrico);
  costruttori.push({ momento: MOMENTI[3], ...turbine });
  const pronto = Promise.resolve();

  return {
    gruppi,
    pronto,
    ancoreTurbine: () => turbine.ancore(),
    aggiorna(p, tempo, camera) {
      for (const c of costruttori) {
        const a = assemblaggioDi(p, c.momento);
        const vicino = p > c.momento.da - 0.08 && p < c.momento.a + 0.1;
        c.gruppo.visible = vicino && a > 0;
        if (c.gruppo.visible) { c.assemblaggio.set(a); c.aggiorna?.(tempo, camera, a); }
      }
    },
    setQualita(livello) {
      for (const c of costruttori) c.setQualita?.(livello);
    },
  };
}
