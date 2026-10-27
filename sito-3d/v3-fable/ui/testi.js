// Testi dei 5 momenti: quale blocco è visibile e quanti passi dell'iter sono accesi.

export const MOMENTI = [
  { nome: 'apertura',      da: 0.00, a: 0.10 },
  { nome: 'fotovoltaico',  da: 0.13, a: 0.36 },
  { nome: 'bess',          da: 0.40, a: 0.60 },
  { nome: 'idroelettrico', da: 0.64, a: 0.84 },
  { nome: 'contatti',      da: 0.88, a: 1.00 },
];

// dentro un momento tecnologico: la macchina si compone nel primo 60% e l'iter si accende con lei
export function assemblaggioDi(p, m) {
  const t = (p - m.da) / (m.a - m.da);
  return Math.min(1, Math.max(0, t / 0.6));
}

export function creaTesti() {
  const sezioni = [...document.querySelectorAll('.momento')];
  const iter = sezioni.map((s) => s.querySelector('.iter'));
  let attivo = -1;

  return {
    aggiorna(p) {
      let idx = -1;
      MOMENTI.forEach((m, i) => { if (p >= m.da - 0.015 && p <= m.a + 0.015) idx = i; });
      if (idx !== attivo) {
        sezioni.forEach((s, i) => s.classList.toggle('attivo', i === idx));
        attivo = idx;
      }
      if (idx >= 1 && idx <= 3 && iter[idx]) {
        const a = assemblaggioDi(p, MOMENTI[idx]);
        const passi = Math.min(5, Math.floor(a * 5 + 0.0001) + (a >= 0.999 ? 0 : 1)); // 1..5 passi accesi
        const accesi = a <= 0 ? 0 : passi;
        const li = iter[idx].querySelectorAll('li');
        li.forEach((el, i) => { el.classList.toggle('acceso', i < accesi); el.classList.toggle('corrente', i === accesi - 1); });
        iter[idx].style.setProperty('--acceso', accesi <= 1 ? 0 : (accesi - 1) / 4);
      }
    },
    momentoAttivo: () => attivo,
  };
}
