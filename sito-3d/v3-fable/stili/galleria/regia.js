// Regia della camera della Galleria Bianca: una persona che cammina lungo la sala, all'altezza degli occhi.
//
// Le chiavi fissano dove sta la camera (pos) e dove guarda (mira) all'inizio e alla fine di ogni momento (m: indice del
// momento, t: 0 = quando i suoi testi si accendono, 1 = quando si spengono), più dove cade il soggetto sullo schermo
// (sx, sy: frazioni della mezza larghezza e della mezza altezza) e quanto arretra (arretra). Così, se cambiano i tempi
// in momenti.js, le chiavi si spostano da sole.
// Ogni chiave diventa una ripresa "a braccio": il punto guardato, la direzione (imbardata e beccheggio) e la distanza.
// Tra una chiave e l'altra ognuna di queste grandezze segue una curva cubica monotona sul p vero (Fritsch–Carlson):
//   - non oltrepassa mai i valori delle chiavi vicine: la camera non torna indietro e non va oltre la meta;
//   - la velocità cambia sempre con continuità: nessuno scatto quando si passa una chiave;
//   - dove due chiavi hanno lo stesso valore la grandezza resta ferma.
// A ogni ridimensionamento `adatta` sistema ogni momento per lo schermo che c'è: centra la macchina nello spazio libero
// dai testi (spostando l'immagine come un obiettivo decentrato) e, se serve, allontana un poco la camera, quanto basta
// perché nessun pezzo tocchi un testo. Gli stessi valori per tutto il momento, raccordati piano nei passaggi.
import * as THREE from 'three';
import { DIST } from './turbine-galleria.js';
import { MOMENTI, MACCHINE, CONTATTI, MARGINE_TESTI, CODA_TESTI, macchinaInScena, finaleDi } from './momenti.js';
import { rettangoliSchermo, tocca } from './ingombri.js';

// Desktop: le sculture stanno in fila lungo x (fotovoltaico a 0, BESS a 70, turbine a 140); servizi e contatti guardano
// la vetrata. Dentro ogni momento la camera fa un solo movimento lento (gira piano attorno alla macchina e si avvicina
// un poco); tra un momento e l'altro cammina di lato fino alla macchina dopo, più o meno alla stessa distanza.
const DESKTOP = [
  // apertura: la camera guarda la parete alta, dove sta il logo
  { m: 0, t: 0, pos: [-52, 2.6, 30], mira: [-44, 5.6, -30] },
  { m: 0, t: 0.85, pos: [-44, 2.5, 28.5], mira: [-24, 3.0, -16] },
  // fotovoltaico (inquadratura approvata): la fila davanti parte vicina a sinistra e si allontana verso destra
  { m: 1, t: 0, pos: [-30, 2.0, 27], mira: [-4, 2.5, 4] },
  { m: 1, t: 1, pos: [-12, 1.9, 25], mira: [9, 2.5, 3] },
  // BESS: arriva da sinistra all'altezza degli occhi e gira piano fino ai tre quarti davanti alle porte aperte
  { m: 2, t: 0, pos: [60, 1.8, 27], mira: [69, 1.3, -1], sx: -0.2, sy: -0.14 },
  { m: 2, t: 1, pos: [77.5, 1.7, 22], mira: [69.5, 1.3, -1], sx: -0.26, sy: -0.14 },
  // turbine: prima la fila intera, poi la camera si avvicina piano alla Francis
  { m: 3, t: 0, pos: [128, 1.7, 22.5], mira: [138.5, 1.2, 0], sx: -0.12, sy: -0.16 },
  { m: 3, t: 1, pos: [135.6, 1.5, 19.7], mira: [140.3, 1.25, 0], sx: -0.08, sy: -0.24 },
  // servizi: la camera si gira verso la vetrata, ancora vuota, e l'elenco occupa la pagina
  { m: 4, t: 0, pos: [158, 2.4, 12], mira: [169, 4.0, -40] },
  { m: 4, t: 1, pos: [162, 2.5, 10], mira: [172.5, 4.5, -40] },
  // contatti: davanti alla vetrata la collezione aspetta in fila
  { m: 5, t: 0, pos: [166, 2.6, 8], mira: [176, 5.0, -40] },
  { m: 5, t: 1, pos: [176, 4.0, 0], mira: [187, 7.5, -60] },
];

// Telefono: apertura, fotovoltaico e contatti arretrano (la scultura sta nella fascia bassa, i testi in alto);
// BESS e turbine si guardano da vicino, una macchina alla volta, con la camera che cammina lungo la fila.
const TELEFONO = [
  { m: 0, t: 0, pos: [-52, 2.6, 30], mira: [-44, 5.6, -30], arretra: 1.55 },
  { m: 0, t: 0.85, pos: [-46, 2.6, 29], mira: [-30, 3.0, -22], arretra: 1.55 },
  // fotovoltaico: di tre quarti dal capo della fila davanti, alta: la fila si allontana in diagonale verso destra
  { m: 1, t: 0, pos: [-26.6, 6.1, 26.6], mira: [3.8, 1.4, 8.2], sx: 0, sy: -0.24 },
  { m: 1, t: 0.2, pos: [-26.6, 6.1, 26.6], mira: [3.8, 1.4, 8.2], sx: 0, sy: -0.24 },
  { m: 1, t: 0.8, pos: [-25.4, 5.9, 25.4], mira: [4.2, 1.4, 7.8], sx: 0, sy: -0.24 },
  { m: 1, t: 1, pos: [-25.4, 5.9, 25.4], mira: [4.2, 1.4, 7.8], sx: 0, sy: -0.24 },
  // BESS: prima il container A con il PCS davanti, poi la camera cammina a destra e si ferma davanti al container B
  { m: 2, t: 0, pos: [58, 2.0, 24], mira: [65, 1.3, -1] },
  { m: 2, t: 0.35, pos: [66, 1.9, 20], mira: [67.5, 1.2, -1] },
  { m: 2, t: 0.7, pos: [75.15, 1.8, 21], mira: [75.4, 1.2, -1] },
  { m: 2, t: 1, pos: [75.25, 1.8, 21], mira: [75.4, 1.2, -1] },
  // turbine: una alla volta, frontali e vicine (la camera arriva dritta davanti alla Pelton)
  { m: 3, t: 0, pos: [140.15 - DIST, 1.7, 11.8], mira: [140.15 - DIST, 1.1, 0] },
  { m: 3, t: 0.2, pos: [140.15 - DIST, 1.7, 11.8], mira: [140.15 - DIST, 1.1, 0] },
  { m: 3, t: 0.4, pos: [140, 1.7, 11.8], mira: [140, 1.1, 0] },
  { m: 3, t: 0.6, pos: [140, 1.7, 11.8], mira: [140, 1.1, 0] },
  { m: 3, t: 0.8, pos: [140 + DIST, 1.7, 11.8], mira: [140 + DIST, 1.1, 0] },
  { m: 3, t: 1, pos: [140 + DIST, 1.7, 11.8], mira: [140 + DIST, 1.1, 0] },
  // servizi e contatti: la camera guarda un po' più in basso, così la collezione sta tra il titolo e il modulo
  { m: 4, t: 0, pos: [158, 2.6, 12], mira: [166, -2.5, -40], sx: 0.1, sy: 0 },
  { m: 4, t: 1, pos: [162, 2.6, 10], mira: [169, -2.5, -40], sx: 0.1, sy: 0 },
  { m: 5, t: 0, pos: [166, 2.6, 8], mira: [172, -2.5, -40], sx: 0.1, sy: 0 },
  { m: 5, t: 1, pos: [176, 4.0, 0], mira: [181, -4.5, -60], sx: 0.1, sy: 0 },
];

// dove cade una chiave nello scorrimento: t = 0 quando i testi del suo momento si accendono, t = 1 quando si spengono
function pDellaChiave(k) {
  const m = MOMENTI[k.m];
  return Math.min(1, Math.max(0, m.da - MARGINE_TESTI + k.t * (m.a - m.da + 2 * MARGINE_TESTI)));
}

// ---------- curva cubica monotona (Fritsch–Carlson, pesi di Brodlie) su nodi non equidistanti ----------
class Curva {
  constructor(xs, ys) {
    const n = xs.length;
    this.xs = xs; this.ys = ys; this.m = new Float64Array(n); // agli estremi (p = 0 e p = 1) la camera è ferma
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) continue; // un massimo, un minimo o un tratto fermo: qui la grandezza si ferma
      const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i];
      const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
      this.m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  valore(x) {
    const { xs, ys, m } = this, n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  }
}

function binario(chiavi, telefono) {
  const riprese = chiavi.map((k) => {
    const pos = new THREE.Vector3(...k.pos), mira = new THREE.Vector3(...k.mira);
    const d = mira.clone().sub(pos), dist = d.length();
    return {
      p: pDellaChiave(k), mira, dist, imbardata: Math.atan2(d.x, -d.z), beccheggio: Math.asin(d.y / dist),
      sx: k.sx ?? (telefono ? 0 : 0.02), sy: k.sy ?? (telefono ? -0.22 : -0.18), arretra: k.arretra ?? 1,
    };
  });
  const xs = riprese.map((r) => r.p);
  for (let i = 1; i < xs.length; i++) if (!(xs[i] > xs[i - 1])) throw new Error(`regia: chiavi non in ordine a p=${xs[i]}`);
  const curva = (f) => new Curva(xs, riprese.map(f));
  return {
    fineApertura: Math.max(...riprese.filter((_, i) => chiavi[i].m === 0).map((r) => r.p)),
    mx: curva((r) => r.mira.x), my: curva((r) => r.mira.y), mz: curva((r) => r.mira.z),
    imbardata: curva((r) => r.imbardata), beccheggio: curva((r) => r.beccheggio), dist: curva((r) => r.dist),
    sx: curva((r) => r.sx), sy: curva((r) => r.sy), arretra: curva((r) => r.arretra),
  };
}

// ---------- inquadratura: il soggetto (mira) cade in (sx, sy) sullo schermo ----------
const _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
export function inquadra(cam, pos, mira, sx, sy, arretra) {
  _dir.subVectors(mira, pos);
  let dist = _dir.length();
  _dir.normalize();
  _p.copy(pos);
  if (arretra !== 1) { _p.addScaledVector(_dir, -dist * (arretra - 1)); dist *= arretra; }
  const mezzaH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist;
  const mezzaW = mezzaH * cam.aspect;
  _dx.crossVectors(_dir, cam.up).normalize();
  _dy.crossVectors(_dx, _dir).normalize();
  const spX = -sx * mezzaW, spY = -sy * mezzaH;
  cam.position.copy(_p).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  _t.copy(mira).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  cam.lookAt(_t);
}

// ---------- la regia ----------
const FATTORE_MAX = 2.2;
// dove l'adattamento di un momento vale pieno: i suoi testi accesi, più la coda delle loro dissolvenze, più un filo
const FINESTRA = MARGINE_TESTI + CODA_TESTI + 0.001;
// i momenti di cui la regia misura l'ingombro: le tre macchine e la collezione dei contatti
const MISURATI = [...MACCHINE, CONTATTI];

// I punti dello scorrimento in cui la regia controlla un momento: ogni 0.005 dentro la finestra dei suoi testi (coda
// delle dissolvenze compresa), solo dove la sua macchina è in scena; più fitti dove i pezzi arrivano in volo e dove la
// camera comincia a camminare. Per ognuno main.js misura l'ingombro della macchina com'è in quel punto.
export function campioniMomento(i) {
  const m = MOMENTI[i], fine = Math.min(1, m.a + MARGINE_TESTI + CODA_TESTI), punti = [];
  for (let p = Math.max(0, m.da - MARGINE_TESTI - CODA_TESTI); p <= fine + 1e-9; p += 0.005) punti.push(p);
  // mentre la macchina si monta (porte che si aprono, pezzi in volo) ogni 0.0025
  if (MACCHINE.includes(i)) for (let p = m.da + 0.001; p <= m.da + 0.6 * (m.a - m.da) + 1e-9; p += 0.0025) punti.push(p);
  for (let p = m.a + MARGINE_TESTI - 0.004; p <= fine + 1e-9; p += 0.002) punti.push(p);
  const presente = (q) => (i === CONTATTI ? finaleDi(q) > 0.01 : macchinaInScena(i, q));
  return [...new Set(punti.map((p) => +Math.min(1, p).toFixed(4)))].filter(presente).sort((a, b) => a - b);
}

// Il rettangolo libero dai testi dove la macchina (larga ew, alta eh sullo schermo) può stare più grande.
// I lati candidati sono i bordi dello schermo e i bordi delle zone dei testi: con una decina di zone sono poche migliaia
// di prove, un attimo.
function rettangoloLibero(zone, larghezza, altezza, ew, eh) {
  const cl = (v, max) => Math.min(max, Math.max(0, v));
  const xs0 = [0, ...zone.map((z) => cl(z.x1, larghezza))], xs1 = [larghezza, ...zone.map((z) => cl(z.x0, larghezza))];
  const ys0 = [0, ...zone.map((z) => cl(z.y1, altezza))], ys1 = [altezza, ...zone.map((z) => cl(z.y0, altezza))];
  let migliore = null, punteggio = 0;
  for (const x0 of xs0) for (const x1 of xs1) {
    if (x1 - x0 < 40) continue;
    for (const y0 of ys0) for (const y1 of ys1) {
      if (y1 - y0 < 40) continue;
      const s = Math.min((x1 - x0) / ew, (y1 - y0) / eh);
      if (s <= punteggio) continue;
      if (zone.some((z) => z.x0 < x1 && z.x1 > x0 && z.y0 < y1 && z.y1 > y0)) continue;
      punteggio = s; migliore = { x0, y0, x1, y1 };
    }
  }
  return migliore;
}

// raccordo con velocità e accelerazione nulle ai due capi
const raccordo = (t) => t * t * t * (t * (6 * t - 15) + 10);

export function creaRegia(camera) {
  const binari = { desktop: binario(DESKTOP, false), telefono: binario(TELEFONO, true) };
  const prova = new THREE.PerspectiveCamera();
  // Per ogni momento: quanto arretra la camera (fattore) e di quanti px si sposta l'immagine (spostX, spostY: come un
  // decentramento dell'obiettivo, tutto l'inquadrato si sposta insieme senza cambiare prospettiva).
  const uno = () => MOMENTI.map(() => 1), zero = () => MOMENTI.map(() => 0);
  let fattori = uno(), spostX = zero(), spostY = zero();
  const r = { mira: new THREE.Vector3(), pos: new THREE.Vector3(), sx: 0, sy: 0, arretra: 1 };

  function ripresa(b, p) {
    r.mira.set(b.mx.valore(p), b.my.valore(p), b.mz.valore(p));
    const imb = b.imbardata.valore(p), bec = b.beccheggio.valore(p), dist = b.dist.valore(p);
    r.pos.set(Math.cos(bec) * Math.sin(imb), Math.sin(bec), -Math.cos(bec) * Math.cos(imb)).multiplyScalar(-dist).add(r.mira);
    r.sx = b.sx.valore(p); r.sy = b.sy.valore(p); r.arretra = b.arretra.valore(p);
    return r;
  }

  // Dentro la finestra di un momento vale il suo valore; nei passaggi un raccordo morbido, mentre la camera cammina.
  // L'apertura finisce con la sua ultima chiave. I momenti senza macchina (apertura, servizi) prendono i valori del
  // momento dopo (adatta), così nel passaggio verso di lui non c'è nulla da raccordare.
  function finestre(b) {
    return MOMENTI.map((m, i) => (i === 0 ? [0, b.fineApertura] : [m.da - FINESTRA, Math.min(1, m.a + FINESTRA)]));
  }
  const FIN = { desktop: finestre(binari.desktop), telefono: finestre(binari.telefono) };
  function perMomento(fin, p, v) {
    for (let i = 0; i < fin.length; i++) {
      const [da, a] = fin[i], dopo = fin[i + 1];
      if (p >= da && p <= a) return v[i];
      if (dopo && p > a && p < dopo[0]) return v[i] + (v[i + 1] - v[i]) * raccordo((p - a) / (dopo[0] - a));
    }
    return v[v.length - 1];
  }

  function posaSu(cam, stretto, p, fattore, dx, dy, larghezza, altezza, tempo = 0) {
    ripresa(stretto ? binari.telefono : binari.desktop, p);
    if (tempo) r.pos.y += Math.sin(tempo * 0.35) * 0.03; // respiro impercettibile
    inquadra(cam, r.pos, r.mira, r.sx, r.sy, r.arretra * fattore);
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) cam.setViewOffset(larghezza, altezza, -dx, -dy, larghezza, altezza);
    else if (cam.view && cam.view.enabled) cam.clearViewOffset();
  }
  function posaA(cam, stretto, p, larghezza, altezza, tempo = 0) {
    const fin = stretto ? FIN.telefono : FIN.desktop;
    posaSu(cam, stretto, p, perMomento(fin, p, fattori), perMomento(fin, p, spostX), perMomento(fin, p, spostY), larghezza, altezza, tempo);
  }

  return {
    posa(p, tempo, stretto, larghezza, altezza) { posaA(camera, stretto, p, larghezza, altezza, tempo); },

    // Per ogni momento misurato: la macchina finita si centra nel rettangolo più grande libero dai testi (e dalle aree
    // `riservate` alla composizione, come la sfumatura della parete), poi la camera arretra quanto basta (fattore ≥ 1,
    // il più piccolo possibile) perché in tutta la finestra dei testi nessun pezzo, nemmeno in volo, tocchi un testo.
    // impronte[i] = { campioni, punti, montata, buf }: per ogni campione di campioniMomento(i) l'ingombro della macchina
    // in quel punto (Float32Array di punti, vedi ingombri.js), se lì è già montata del tutto, e un buffer di lavoro.
    adatta({ stretto, zone, riservate = [], impronte, larghezza, altezza }) {
      const t0 = performance.now();
      prova.fov = camera.fov; prova.aspect = camera.aspect; prova.up.copy(camera.up);
      const proietta = (imp, k, f, dx, dy) => {
        posaSu(prova, stretto, imp.campioni[k], f, dx, dy, larghezza, altezza);
        prova.updateProjectionMatrix(); prova.updateMatrixWorld();
        return rettangoliSchermo(imp.punti[k], prova, larghezza, altezza, imp.buf);
      };
      const tocc = (imp, k, f, dx, dy, z) => tocca(imp.buf, proietta(imp, k, f, dx, dy), z);
      // l'ingombro sullo schermo (solo la parte dentro lo schermo) della macchina finita, su tutta la finestra del momento
      const estensione = (imp, f, dx, dy) => {
        const e = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        const tutti = !imp.montata.some(Boolean);
        for (let c = 0; c < imp.campioni.length; c++) {
          if (!tutti && !imp.montata[c]) continue;
          const n = proietta(imp, c, f, dx, dy), q = imp.buf;
          for (let k = 0; k < n; k++) {
            if (q[k * 4 + 2] < 0 || q[k * 4] > larghezza || q[k * 4 + 3] < 0 || q[k * 4 + 1] > altezza) continue;
            e.x0 = Math.min(e.x0, Math.max(0, q[k * 4])); e.x1 = Math.max(e.x1, Math.min(larghezza, q[k * 4 + 2]));
            e.y0 = Math.min(e.y0, Math.max(0, q[k * 4 + 1])); e.y1 = Math.max(e.y1, Math.min(altezza, q[k * 4 + 3]));
          }
        }
        return e;
      };
      // il fattore più piccolo che libera tutti i campioni; arretrando un pezzo può anche entrare in una zona, quindi
      // alla fine si ricontrollano tutti i campioni con il fattore scelto e, se serve, si riparte da lì
      const cercaFattore = (imp, dx, dy, z, i) => {
        let f = 1;
        for (let giro = 0; giro < 4; giro++) {
          for (let c = 0; c < imp.campioni.length; c++) {
            if (!tocc(imp, c, f, dx, dy, z)) continue;
            if (tocc(imp, c, FATTORE_MAX, dx, dy, z)) { f = FATTORE_MAX; continue; }
            let lo = f, hi = FATTORE_MAX;
            for (let k = 0; k < 9; k++) { const medio = (lo + hi) / 2; if (tocc(imp, c, medio, dx, dy, z)) lo = medio; else hi = medio; }
            f = hi;
          }
          const ancora = imp.campioni.map((_, c) => c).filter((c) => tocc(imp, c, f, dx, dy, z));
          if (!ancora.length) return { f, restano: [] };
          if (f >= FATTORE_MAX) return { f, restano: ancora.map((c) => ({ momento: i, p: imp.campioni[c] })) };
          f = Math.min(FATTORE_MAX, f * 1.03);
        }
        return { f, restano: [] };
      };
      const nuoviF = uno(), nuoviX = zero(), nuoviY = zero(), liberi = [];
      const nonBasta = [];
      for (const i of MISURATI) {
        const z = zone[i], imp = impronte[i];
        if (!z || !z.length || !imp || !imp.campioni.length) continue;
        let f = 1, dx = 0, dy = 0, restano = [];
        const perComporre = [...z, ...(riservate[i] || [])];
        // lo spostamento resta moderato: oltre, la sala (pavimento e orizzonte) si sposterebbe troppo
        const maxX = larghezza * 0.22, maxY = altezza * 0.16;
        for (let giro = 0; giro < 2; giro++) {
          const e = estensione(imp, f, dx, dy);
          const libero = e.x1 > e.x0 ? rettangoloLibero(perComporre, larghezza, altezza, e.x1 - e.x0, e.y1 - e.y0) : null;
          if (libero) {
            dx = Math.max(-maxX, Math.min(maxX, dx + (libero.x0 + libero.x1) / 2 - (e.x0 + e.x1) / 2));
            dy = Math.max(-maxY, Math.min(maxY, dy + (libero.y0 + libero.y1) / 2 - (e.y0 + e.y1) / 2));
            liberi[i] = [libero.x0, libero.y0, libero.x1, libero.y1].map(Math.round);
          }
          ({ f, restano } = cercaFattore(imp, dx, dy, z, i));
        }
        nonBasta.push(...restano);
        nuoviF[i] = +f.toFixed(3); nuoviX[i] = +dx.toFixed(1); nuoviY[i] = +dy.toFixed(1);
      }
      // i momenti senza macchina prendono i valori del momento dopo (l'apertura dal fotovoltaico, i servizi dai contatti)
      for (let i = MOMENTI.length - 2; i >= 0; i--) {
        if (MISURATI.includes(i)) continue;
        nuoviF[i] = nuoviF[i + 1]; nuoviX[i] = nuoviX[i + 1]; nuoviY[i] = nuoviY[i + 1];
      }
      fattori = nuoviF; spostX = nuoviX; spostY = nuoviY;
      return { fattori: nuoviF.slice(), spostX: nuoviX.slice(), spostY: nuoviY.slice(), liberi, nonBasta, ms: +(performance.now() - t0).toFixed(1) };
    },

    get fattori() { return fattori.slice(); },
    get spostamenti() { return { x: spostX.slice(), y: spostY.slice() }; },

    // per le prove: la camera a p, senza respiro
    campiona(p, stretto, larghezza, altezza) {
      posaA(prova, stretto, p, larghezza, altezza);
      prova.updateMatrixWorld();
      const dir = prova.getWorldDirection(new THREE.Vector3());
      return { pos: prova.position.toArray(), dir: dir.toArray() };
    },
    preparaProva() { prova.fov = camera.fov; prova.aspect = camera.aspect; prova.updateProjectionMatrix(); },
  };
}
