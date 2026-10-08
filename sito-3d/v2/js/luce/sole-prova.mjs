// =============================================================================
// ERI v2 · luce/sole-prova.mjs — prova automatica del sole e dei tracker contro l'Appendice A
// Proprietario: [BASE-RENDER]. NON fa parte del sito: si esegue con node, senza dipendenze.
//
//   node sito-3d/v2/js/luce/sole-prova.mjs
//
// Le funzioni provate sono quelle che luce/sole.js riesporta da geo.js (posizioneSole, angoloTracker,
// direzioneSole, intensitaSole, coloreSole): geo.js non dipende da three, quindi si importa direttamente.
// Tolleranza: ±0,2° (DESIGN, Appendice D punto 6). Uscita con codice 1 se una riga non torna.
// =============================================================================
import { posizioneSole, angoloTracker, direzioneSole, intensitaSole, coloreSole, oraDaT } from '../geo.js';
import { LAYOUT } from '../config.js';

const TOLLERANZA = 0.2;
// Appendice A: [ora, el, az, tracker FV, stato FV, tracker agri, stato agri]
const TABELLA = [
  ['05:45', 0.9, 58.6, -1.6, 'BACKTRACKING', -3.3, 'BACKTRACKING'],
  ['06:10', 4.95, 62.6, -8.5, 'BACKTRACKING', -18.3, 'BACKTRACKING'],
  ['06:30', 8.3, 65.8, -14.2, 'BACKTRACKING', -32.0, 'BACKTRACKING'],
  ['07:00', 13.5, 70.4, -23.7, 'BACKTRACKING', -60.0, 'FINE CORSA'],
  ['08:00', 24.2, 79.5, -60.0, 'FINE CORSA', -60.0, 'FINE CORSA'],
  ['09:00', 35.3, 88.9, -54.7, 'INSEGUIMENTO', -54.7, 'INSEGUIMENTO'],
  ['09:40', 42.7, 95.9, -47.1, 'INSEGUIMENTO', -47.1, 'INSEGUIMENTO'],
  ['10:00', 46.4, 99.7, -43.2, 'INSEGUIMENTO', -43.2, 'INSEGUIMENTO'],
  ['12:00', 66.3, 135.8, -17.1, 'INSEGUIMENTO', -17.1, 'INSEGUIMENTO'],
  ['13:14', 71.4, 181.9, 0.6, 'INSEGUIMENTO', 0.6, 'INSEGUIMENTO'],
  ['15:00', 60.8, 239.1, 25.6, 'INSEGUIMENTO', 25.6, 'INSEGUIMENTO'],
  ['16:00', 50.5, 255.5, 38.6, 'INSEGUIMENTO', 38.6, 'INSEGUIMENTO'],
  ['17:30', 33.9, 272.3, 56.1, 'INSEGUIMENTO', 56.1, 'INSEGUIMENTO'],
  ['18:30', 22.9, 281.6, 58.2, 'BACKTRACKING', 60.0, 'FINE CORSA'],
  ['19:00', 17.5, 286.1, 33.0, 'BACKTRACKING', 60.0, 'FINE CORSA'],
  ['20:00', 7.05, 295.4, 12.0, 'BACKTRACKING', 26.6, 'BACKTRACKING'],
  ['20:30', 2.1, 300.2, 3.7, 'BACKTRACKING', 7.8, 'BACKTRACKING'],
];
const ora = s => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
const f = (v, n = 2) => (v >= 0 ? ' ' : '') + v.toFixed(n);
let errori = 0, peggiore = 0;
const controlla = (nome, calcolato, atteso, riga) => {
  const d = Math.abs(calcolato - atteso); peggiore = Math.max(peggiore, d);
  if (d > TOLLERANZA) { errori++; console.log(`  ✗ ${riga} ${nome}: calcolato ${calcolato.toFixed(3)}, atteso ${atteso} (Δ ${d.toFixed(3)}°)`); }
};

console.log('ora    el      az       FV      stato FV        agri    stato agri');
for (const [o, el, az, tFV, sFV, tAg, sAg] of TABELLA) {
  const p = posizioneSole(ora(o));
  const fv = angoloTracker(p.el, p.az, LAYOUT.fv.gcr), ag = angoloTracker(p.el, p.az, LAYOUT.agri.gcr);
  console.log(`${o}  ${f(p.el)}  ${f(p.az)}  ${f(fv.theta)}  ${fv.stato.padEnd(14)}  ${f(ag.theta)}  ${ag.stato}`);
  controlla('el', p.el, el, o); controlla('az', p.az, az, o);
  controlla('tracker FV', fv.theta, tFV, o); controlla('tracker agri', ag.theta, tAg, o);
  if (fv.stato !== sFV) { errori++; console.log(`  ✗ ${o} stato FV: ${fv.stato} invece di ${sFV}`); }
  if (ag.stato !== sAg) { errori++; console.log(`  ✗ ${o} stato agri: ${ag.stato} invece di ${sAg}`); }
}

// Eventi notevoli dell'Appendice A: alba, tramonto, mezzogiorno solare (±1 min, ±0,2°)
const cerca = (f0, a, b) => { for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (f0(a) * f0(m) <= 0) b = m; else a = m; } return (a + b) / 2; };
const elDi = o => posizioneSole(o).el;
// alba/tramonto geometrici con rifrazione standard (−0,833°), come le effemeridi
const alba = cerca(o => elDi(o) + 0.833, 4, 7), tramonto = cerca(o => elDi(o) + 0.833, 19, 22);
let mezzogiorno = 12, elMax = -90; for (let o = 12; o < 14.5; o += 1 / 3600) { const e = elDi(o); if (e > elMax) { elMax = e; mezzogiorno = o; } }
const hm = o => { const h = Math.floor(o), m = Math.round((o - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
console.log(`\nalba ${hm(alba)} az ${posizioneSole(alba).az.toFixed(1)}° · tramonto ${hm(tramonto)} az ${posizioneSole(tramonto).az.toFixed(1)}° · mezzogiorno ${hm(mezzogiorno)} el ${elMax.toFixed(2)}°`);
if (Math.abs(alba - ora('05:34')) > 1.5 / 60) { errori++; console.log('  ✗ alba diversa da 05:34'); }
if (Math.abs(tramonto - ora('20:49')) > 1.5 / 60) { errori++; console.log('  ✗ tramonto diverso da 20:49'); }
if (Math.abs(mezzogiorno - ora('13:11')) > 1.5 / 60) { errori++; console.log('  ✗ mezzogiorno solare diverso da 13:11'); }
controlla('el a mezzogiorno', elMax, 71.45, 'mezzogiorno');
controlla('az all\'alba', posizioneSole(alba).az, 56.7, 'alba'); controlla('az al tramonto', posizioneSole(tramonto).az, 303.3, 'tramonto');

// Coerenza: versore verso il sole unitario e coerente con el/az (§0)
for (const o of [6.1667, 10, 13.1833, 17.5]) {
  const p = posizioneSole(o), d = direzioneSole(p.el, p.az);
  const n = Math.hypot(d[0], d[1], d[2]);
  const elD = Math.asin(d[1]) * 180 / Math.PI, azD = (Math.atan2(d[0], -d[2]) * 180 / Math.PI + 360) % 360;
  if (Math.abs(n - 1) > 1e-9 || Math.abs(elD - p.el) > 1e-6 || Math.abs(((azD - p.az + 540) % 360) - 180) > 1e-6) { errori++; console.log(`  ✗ direzioneSole incoerente alle ${o}`); }
}
// Intensità e colore: continui e nei limiti (§6.3)
let prec = intensitaSole(-3);
for (let e = -3; e <= 90; e += 0.25) { const i = intensitaSole(e); if (i < prec - 1e-9 || i < 0 || i > 3.4 + 1e-9) { errori++; console.log(`  ✗ intensitaSole(${e}) = ${i}`); break; } prec = i; }
const c35 = coloreSole(40); if (Math.abs(c35[0] - 1) > 0.01) { errori++; console.log('  ✗ coloreSole(40) non è #fff1df'); }
// ora(T) ai nodi della tabella §4.4
for (const [T, o] of [[9.15, 6 + 10 / 60], [9.95, 13 + 11 / 60], [10.40, 17.5]]) if (Math.abs(oraDaT(T) - o) > 1e-9) { errori++; console.log(`  ✗ oraDaT(${T})`); }

console.log(`\nscarto massimo sugli angoli: ${peggiore.toFixed(3)}° (tolleranza ±${TOLLERANZA}°)`);
console.log(errori ? `ESITO: ${errori} errori` : 'ESITO: tutto coincide con l\'Appendice A');
process.exit(errori ? 1 : 0);
