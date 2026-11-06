// I sei momenti della Galleria Bianca, come posizioni nello scorrimento (p da 0 a 1).
// Tra un momento e il successivo c'è un passaggio senza testi: la camera cammina fino alla macchina dopo
// (la regia la muove solo lì; mentre i testi sono accesi fa al più un movimento lento attorno alla macchina).
// I passaggi hanno lunghezze pensate per una velocità simile: quello lungo (fotovoltaico → BESS, 72 m) ha più spazio.
// (La Galleria ha i suoi tempi: gli altri stili continuano a usare ui/testi.js.)

export const MOMENTI = [
  { nome: 'apertura',      da: 0.000, a: 0.070 },
  { nome: 'fotovoltaico',  da: 0.147, a: 0.274 },
  { nome: 'bess',          da: 0.403, a: 0.518 },
  { nome: 'idroelettrico', da: 0.614, a: 0.729 },
  { nome: 'servizi',       da: 0.818, a: 0.866 },
  { nome: 'contatti',      da: 0.936, a: 1.000 },
];
export const SERVIZI = 4, CONTATTI = 5;
// i momenti con una macchina che si compone (fotovoltaico, BESS, turbine)
export const MACCHINE = [1, 2, 3];

// i testi di un momento si accendono poco prima del suo inizio e si spengono poco dopo la sua fine
export const MARGINE_TESTI = 0.015;
// le dissolvenze d'uscita dei testi durano un attimo (style.css): scorrendo veloce un testo resta visibile
// ancora per circa questo tratto di p, e la regia ne tiene conto
export const CODA_TESTI = 0.01;

export function momentoDeiTesti(p) {
  let indice = -1;
  MOMENTI.forEach((m, i) => { if (p >= m.da - MARGINE_TESTI && p <= m.a + MARGINE_TESTI) indice = i; });
  return indice;
}

// dentro un momento con una macchina, la macchina si compone nel primo 60%, e l'iter si accende con lei
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
  const inizio = MOMENTI[CONTATTI].da - 0.02;
  return Math.min(1, Math.max(0, (p - inizio) / (1 - inizio)));
}

// dove porta il menu: le macchine già composte, i servizi a metà, i contatti in fondo
export function puntoDelMomento(i) {
  const m = MOMENTI[i];
  if (MACCHINE.includes(i)) return +(m.da + 0.6 * (m.a - m.da) + 0.01).toFixed(3);
  if (i === CONTATTI) return 1;
  return +((m.da + m.a) / 2).toFixed(3);
}
