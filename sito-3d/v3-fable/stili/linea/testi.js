// Testi dei 5 momenti per "Linea di Luce" (copia locale di ui/testi.js, adattata).
// L'iter è UNA sola riga che vive sotto le tre macchine: la parte accesa cresce in modo continuo con lo scorrimento,
// ogni parola si accende quando la punta la raggiunge, tra una macchina e l'altra la riga si ritira verso sinistra
// fino a zero e poi ricresce con la macchina successiva. Nessuna transizione sulla lunghezza: segue p a ogni fotogramma.

export const MOMENTI = [
  { nome: 'apertura',      da: 0.00, a: 0.10 },
  { nome: 'fotovoltaico',  da: 0.13, a: 0.36 },
  { nome: 'bess',          da: 0.40, a: 0.60 },
  { nome: 'idroelettrico', da: 0.64, a: 0.84 },
  { nome: 'contatti',      da: 0.88, a: 1.00 },
];

// Confini dei cinque passi dentro un momento tecnologico (frazione 0..1 del momento):
// Sviluppo · Autorizzazioni · Ready to Build · Costruzione · Gestione
export const PASSI = [0, 0.16, 0.36, 0.48, 0.70, 1];
const PRE = 0.015;     // tratto prima del momento in cui la riga entra da sinistra
const RITIRO = 0.024;  // tratto dopo il momento in cui la riga si ritira

const clamp = (x) => Math.min(1, Math.max(0, x));

// avanzamento 0..1 del momento m (0 prima, 1 dopo)
export function assemblaggioDi(p, m) { return clamp((p - m.da) / (m.a - m.da)); }

// posizione continua della punta: -1 = fuori a sinistra · i = sul passo i (0..4) · 5 = bordo destro dello schermo
export function passoDi(t) {
  for (let i = 0; i < 5; i++) if (t <= PASSI[i + 1]) return i + (t - PASSI[i]) / (PASSI[i + 1] - PASSI[i]);
  return 5;
}

export function puntaIter(p) {
  for (let i = 1; i <= 3; i++) {
    const m = MOMENTI[i];
    if (p < m.da - PRE) break;
    if (p < m.da) return { f: -1 + (p - (m.da - PRE)) / PRE, dentro: false, idx: i };
    if (p <= m.a) return { f: passoDi(assemblaggioDi(p, m)), dentro: true, idx: i };
    if (p <= m.a + RITIRO) return { f: 5 - 6 * (p - m.a) / RITIRO, dentro: false, idx: i };
  }
  return { f: -1, dentro: false, idx: -1 };
}

export function creaTesti() {
  const sezioni = [...document.querySelectorAll('.momento')];
  const iter = document.getElementById('iter');
  const luce = document.getElementById('luce');
  const riga = document.getElementById('riga');
  const li = iter ? [...iter.querySelectorAll('li')] : [];
  let attivo = -1, iterVisibile = false, punti = null, verticale = false, pxLuce = -1, accesi = -1, corrente = -2;

  // I sette punti del percorso della punta: bordo di partenza, i cinque segni dei passi, bordo finale.
  function misura() {
    const v = innerHeight > innerWidth || innerWidth < 820;
    if (v !== verticale) { luce.style.width = ''; luce.style.height = ''; }
    verticale = v; pxLuce = -1;
    const r = riga.getBoundingClientRect();
    const pts = [];
    if (verticale) {
      pts.push(r.top);
      for (const el of li) pts.push(el.getBoundingClientRect().top + 6.5);
      pts.push(innerHeight);
    } else {
      pts.push(0);
      li.forEach((el, i) => { const b = el.getBoundingClientRect(); pts.push(i === 0 ? b.left : i === li.length - 1 ? b.right : (b.left + b.right) / 2); });
      pts.push(innerWidth);
    }
    punti = pts;
  }
  function lunghezza(f) {
    const k = Math.min(5, Math.max(-1, f)) + 1;
    const i = Math.min(5, Math.floor(k)), s = k - i;
    return punti[i] + (punti[i + 1] - punti[i]) * s - punti[0];
  }

  return {
    misura,
    aggiorna(p) {
      let idx = -1;
      MOMENTI.forEach((m, i) => { if (p >= m.da - 0.015 && p <= m.a + (i >= 1 && i <= 3 ? 0.006 : 0.015)) idx = i; });
      if (idx !== attivo) {
        sezioni.forEach((s, i) => s.classList.toggle('attivo', i === idx));
        attivo = idx;
      }
      if (!iter || !luce) return;
      const vis = p > MOMENTI[1].da - PRE - 0.01 && p < MOMENTI[3].a + RITIRO + 0.01;
      if (vis !== iterVisibile) { iterVisibile = vis; iter.classList.toggle('visibile', vis); luce.classList.toggle('visibile', vis); }
      if (!vis) return;
      if (!punti) misura();
      const { f, dentro } = puntaIter(p);
      const px = Math.round(lunghezza(f));
      if (px !== pxLuce) { pxLuce = px; luce.style[verticale ? 'height' : 'width'] = px + 'px'; }
      const nAccesi = Math.max(0, Math.min(5, Math.floor(f + 1.001)));
      const cur = dentro ? Math.min(4, Math.floor(f + 1e-6)) : -1;
      if (nAccesi !== accesi) { accesi = nAccesi; li.forEach((el, i) => el.classList.toggle('acceso', i < nAccesi)); }
      if (cur !== corrente) { corrente = cur; li.forEach((el, i) => el.classList.toggle('corrente', i === cur)); }
    },
    momentoAttivo: () => attivo,
  };
}
