// ERI v3 · idroelettrico: tre turbine in inox come gioielli su tre piedistalli.
// Pelton (salto alto) · Francis (salto medio) · Kaplan (salto basso). Origine = centro della base, piedistalli lungo X.
// Montaggio: i piedistalli salgono, poi ogni turbina si compone pezzo per pezzo. Gestione: girano, calme, a velocità diverse.
import * as THREE from 'three';
import { Montaggio, Dettaglio, segm, rivela } from './materiali-pezzi.js';
import { creaPelton, geoAnello } from './turbine-pelton.js';
import { creaFrancis } from './turbine-francis.js';
import { creaKaplan } from './turbine-kaplan.js';

export const PIEDISTALLO = { raggio: 1.05, altezza: 0.5, passo: 2.8 };
const RP = PIEDISTALLO.raggio, HP = PIEDISTALLO.altezza, PASSO = PIEDISTALLO.passo;

function piedistallo(M, q) {
  const g = new THREE.Group();
  const prof = [[0, 0], [RP - 0.12, 0], [RP - 0.03, 0.03], [RP, 0.08], [RP, HP - 0.08], [RP - 0.02, HP - 0.03], [RP - 0.06, HP], [0, HP]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), segm(q, 128, 96, 64)), M.podio));
  // piano in velluto scuro (un piano lucido rifletterebbe la luce principale come uno specchio)
  const piano = new THREE.Mesh(new THREE.CircleGeometry(RP - 0.065, segm(q, 96, 64, 48)), M.velluto); piano.rotation.x = -Math.PI / 2; piano.position.y = HP + 0.001; g.add(piano);
  // filo d'oro sul bordo in alto e alone sottile alla base
  const geoFilo = geoAnello(RP - 0.1, 0.006, segm(q, 200, 140, 100), 4); geoFilo.rotateX(-Math.PI / 2);
  const filo = new THREE.Mesh(geoFilo, M.lucOro); filo.position.y = HP + 0.002; g.add(filo);
  const geoBase = geoAnello(RP + 0.004, 0.004, segm(q, 200, 140, 100), 4); geoBase.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(geoBase, M.lucOroTenue); base.position.y = 0.06; g.add(base);
  return { gruppo: g, fili: [geoFilo, geoBase] };
}

export function creaTurbine(ctx) {
  const M = ctx.materiali, q = ctx.qualita || 'alta';
  const gruppo = new THREE.Group(); gruppo.name = 'turbine';
  const mont = new Montaggio(), lod = new Dettaglio(0.5);
  // materiali a doppia faccia per superfici sottili (cucchiai, pale, gusci in sezione)
  const ds = M.doppiaFaccia;
  const D = { inox: ds(M.inox), inoxSat: ds(M.inoxSatinato), grafite: ds(M.grafiteSatinata), getto: M.nuovaAcqua() };
  const lineaK = M.nuovaLinea('#8fe6ff', 2.2, 4, 0.9);

  const piedi = [-PASSO, 0, PASSO].map((x, k) => {
    const p = piedistallo(M, q); p.gruppo.position.x = x; gruppo.add(p.gruppo);
    mont.oggetto(p.gruppo, 0.04 * k, 0.12 + 0.04 * k, { scala: [1, 0, 1] });
    mont.funzione(0.06 + 0.04 * k, 0.2 + 0.04 * k, x2 => { for (let i = 0; i < p.fili.length; i++) rivela(p.fili[i], x2); });
    return p.gruppo;
  });
  const finestra = k => { const A = 0.08 + 0.08 * k, B = A + 0.76; return (a, b) => [A + a * (B - A), A + b * (B - A)]; };
  const opz = k => ({ M, D, q, mont, lod, w: finestra(k), linea: lineaK });
  const P = creaPelton(opz(0)), F = creaFrancis(opz(1)), K = creaKaplan(opz(2));
  [P, F, K].forEach((t, k) => { t.gruppo.position.set((k - 1) * PASSO, HP, 0); gruppo.add(t.gruppo); });

  let tPrima = null;
  return {
    gruppo,
    pelton: P.gruppo, francis: F.gruppo, kaplan: K.gruppo, piedistalli: piedi,
    dettaglio: lod,
    qualita(nq) { lod.permesso = nq !== 'bassa'; },
    aggiorna(s) {
      mont.aggiorna(s.montaggio);
      lod.aggiorna(s.vicino);
      const dt = tPrima === null ? 0 : Math.min(0.1, Math.max(0, s.t - tPrima)); tPrima = s.t;
      const px = ctx.renderer ? ctx.renderer.domElement.height / 900 : 1;
      P.aggiorna(s, dt, px); F.aggiorna(s, dt); K.aggiorna(s, dt);
    },
  };
}
