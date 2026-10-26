// ERI v3 · regia: lo scorrimento diventa un unico racconto (p da 0 a 1).
// La camera va sempre avanti, verso la luce: un solo movimento lento per momento, nessun avanti-indietro.
import * as THREE from 'three';

// finestre del racconto (in p). "da/a" = l'iter della macchina va da 0 a 1 in questo tratto.
export const MOMENTI = {
  apertura: { testo: [-1, 0.03] },
  fv: { da: 0.15, a: 0.385, testo: [0.135, 0.395], barra: [0.11, 0.42], nome: 'Fotovoltaico' },
  bess: { da: 0.455, a: 0.625, testo: [0.44, 0.632], barra: [0.42, 0.655], nome: 'Accumulo' },
  // durante la carrellata sulle turbine il titolo lascia il posto alle etichette di ciascuna
  idro: { da: 0.69, a: 0.785, testo: [0.675, 0.75], barra: [0.655, 0.89], nome: 'Idroelettrico' },
  contatti: { testo: [0.902, 2], barra: [0.89, 2] },
};
// punti di arrivo dei link del menu
export const TAPPE = { apertura: 0, fv: 0.33, bess: 0.585, idro: 0.79, contatti: 0.965 };

// i cinque passi dell'iter: soglia sull'avanzamento "it" (0..1) e didascalia breve
export const PASSI = [
  { nome: 'Sviluppo', soglia: 0.01, nota: 'Terreno, vincoli, layout' },
  { nome: 'Autorizzazioni', soglia: 0.08, nota: 'PAS, Autorizzazione Unica, VIA, connessione' },
  { nome: 'Ready to Build', soglia: 0.16, nota: 'Progetto autorizzato, pronto da costruire' },
  { nome: 'Costruzione', soglia: 0.22, nota: 'Il cantiere: la macchina prende forma' },
  { nome: 'Gestione', soglia: 0.56, nota: 'Esercizio e manutenzione, ogni giorno' },
];

const SOGLIE = PASSI.map(s => s.soglia);

export const clamp =(x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const liscio = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const campana = (x, a, b, c) => (x <= a || x >= c ? 0 : x < b ? liscio(a, b, x) : 1 - liscio(b, c, x));

// interpolazione cubica monotona (Fritsch–Carlson): passa per i punti, senza sbalzi né ritorni
export function monotona(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// percorso della camera: chiavi { p, pos, tgt } → funzione(p, outPos, outTgt)
export function creaPercorso(chiavi) {
  const cp = new THREE.CatmullRomCurve3(chiavi.map(k => k.pos), false, 'centripetal');
  const ct = new THREE.CatmullRomCurve3(chiavi.map(k => k.tgt), false, 'centripetal');
  const u = monotona(chiavi.map(k => k.p), chiavi.map((k, i) => i / (chiavi.length - 1)));
  return (p, outPos, outTgt) => { const k = clamp(u(p)); cp.getPoint(k, outPos); ct.getPoint(k, outTgt); };
}

// dall'avanzamento dell'iter (0..1) allo stato della macchina e della barra
export function faseIter(it, out) {
  out.it = it;
  out.progetto = clamp(it / 0.075);
  out.sigillo = clamp((it - 0.08) / 0.075);
  out.flash = campana(it, 0.15, 0.185, 0.25);
  out.montaggio = clamp((it - 0.22) / 0.33);
  out.funzione = clamp((it - 0.56) / 0.3);
  out.alfaProgetto = it <= 0.0005 ? 0 : 1 - 0.82 * liscio(0.3, 0.6, it);
  let passo = 0; for (const s of PASSI) if (it >= s.soglia) passo++;
  out.passo = passo;
  // riempimento della barra: i passi stanno a 0, ¼, ½, ¾, 1
  if (it >= SOGLIE[4]) out.avanz = 1;
  else if (it <= SOGLIE[0]) out.avanz = 0;
  else { let i = 0; while (it > SOGLIE[i + 1]) i++; out.avanz = (i + (it - SOGLIE[i]) / (SOGLIE[i + 1] - SOGLIE[i])) / 4; }
  return out;
}

// l'iter insegue lo scorrimento con calma: il montaggio non corre mai (le macchine si montano "da sole")
export function inseguiIter(attuale, bersaglio, dt) {
  if (bersaglio < attuale) return Math.max(bersaglio, attuale - dt * 0.45);
  const v = attuale < 0.22 ? 0.32 : attuale < 0.55 ? 0.105 : 0.24;
  return Math.min(bersaglio, attuale + dt * v);
}

// scorrimento: p bersaglio dalla pagina, p "dolce" che lo insegue senza strappi
export function creaScorrimento() {
  const corsa = document.querySelector('.corsa');
  let pB = 0, pD = 0, salto = false;
  const leggi = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    pB = clamp(scrollY / max);
  };
  addEventListener('scroll', leggi, { passive: true });
  addEventListener('resize', leggi);
  leggi(); pD = pB;
  return {
    get p() { return pD; },
    get bersaglio() { return pB; },
    // limite(p): velocità massima del racconto in quel punto (la camera resta calma); senza, 0.16 al secondo
    aggiorna(dt, limite) {
      if (salto) { salto = false; pD = pB; return pD; }
      const diff = pB - pD;
      let passo = diff * (1 - Math.exp(-dt * 3.0));
      const lim = dt * (limite ? limite(pD) : 0.16);
      if (passo > lim) passo = lim; else if (passo < -lim) passo = -lim;
      pD += passo; if (Math.abs(pB - pD) < 1e-5) pD = pB;
      return pD;
    },
    // salto immediato (foto, navigazione lontana dietro il velo)
    vai(p) {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      scrollTo({ top: clamp(p) * max, behavior: 'instant' });
      pB = clamp(p); pD = pB; salto = true;
    },
    // scorrimento morbido della pagina (navigazione vicina)
    scorri(p) {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      scrollTo({ top: clamp(p) * max, behavior: 'smooth' });
    },
    corsa,
  };
}
