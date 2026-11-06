// I cinque momenti della Galleria Bianca, come posizioni nello scorrimento (p da 0 a 1).
// Tra un momento e il successivo c'è un passaggio senza testi: la camera cammina fino alla macchina dopo
// (la regia la muove solo lì; mentre i testi sono accesi fa al più un movimento lento attorno alla macchina).
// (La Galleria ha i suoi tempi: gli altri stili continuano a usare ui/testi.js.)

export const MOMENTI = [
  { nome: 'apertura',      da: 0.00, a: 0.10 },
  { nome: 'fotovoltaico',  da: 0.15, a: 0.33 },
  { nome: 'bess',          da: 0.43, a: 0.59 },
  { nome: 'idroelettrico', da: 0.69, a: 0.84 },
  { nome: 'contatti',      da: 0.92, a: 1.00 },
];

// i testi di un momento si accendono poco prima del suo inizio e si spengono poco dopo la sua fine
export const MARGINE_TESTI = 0.015;
// le dissolvenze CSS dei testi durano qualche decimo di secondo: a scorrimento veloce un testo resta visibile
// ancora per circa questo tratto di p, e la regia ne tiene conto
export const CODA_TESTI = 0.006;

export function momentoDeiTesti(p) {
  let indice = -1;
  MOMENTI.forEach((m, i) => { if (p >= m.da - MARGINE_TESTI && p <= m.a + MARGINE_TESTI) indice = i; });
  return indice;
}

// dentro un momento tecnologico la macchina si compone nel primo 60%, e l'iter si accende con lei
export function assemblaggioDi(p, m) {
  const t = (p - m.da) / (m.a - m.da);
  return Math.min(1, Math.max(0, t / 0.6));
}

// una macchina (momenti 1-3) è in scena dall'inizio del suo momento fin poco prima che si accendano i testi
// del momento dopo: a quel punto la camera l'ha già lasciata fuori dall'inquadratura
export function macchinaInScena(i, p) {
  const m = MOMENTI[i], dopo = MOMENTI[i + 1];
  return p > m.da && p < dopo.da - MARGINE_TESTI - 0.001;
}

// il finale: poco prima dei contatti la parete diventa vetrata e la collezione si compone (da 0 a 1)
export function finaleDi(p) {
  const inizio = MOMENTI[4].da - 0.02;
  return Math.min(1, Math.max(0, (p - inizio) / (1 - inizio)));
}
