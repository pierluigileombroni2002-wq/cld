// =============================================================================
// ERI v2 · ui/etichette.js — etichette 3D: pool di 3, richiami a gomito in SVG, proiezione e occlusione
// Proprietario: [BASE-UI].
// Specifica: DESIGN §2.7 "Etichette HTML" (niente riquadro né vetro; gomito di 1 px in un unico SVG a tutto
// schermo, punto di 5 px; nome in Jost, dato in Plex Mono; al massimo 3; area ammessa del punto x 0,40–0,92,
// y 0,10–0,85, testo 24 px sopra il punto; svanimento in 250 ms se dietro, fuori area o coperto), §5.6 (pool
// riusato; punto → segmento verticale di 24 px → orizzontale di 32 px fino al testo; damp λ 20), §4.0 (ingresso
// in 0,03 T: prima il gomito poi il testo; uscita in 0,03 T), §4 tabelle "Etichette 3D" (config.ETICHETTE),
// §6.12 (schermi piccoli: al massimo 1), ARCHITETTURA §9 (ancore: [x,y,z] | {x,z,h} | 'nome' con riserva;
// tipo 'piastra' = #piastra-dati posizionata qui, contenuto di ui/finale.js).
//
// Impaginazione: il gomito va a destra; se il testo esce dal quadro, tocca un'altra etichetta, l'indice, lo
// strumento dell'HUD o la testata, si prova a sinistra (mai dentro la colonna del testo) e poi si allunga il
// tratto verticale (24 px → +1, +2 altezze del testo). La scelta resta finché è valida (niente sfarfallio) e
// l'altezza del gomito è smorzata.
// Nessuna allocazione nel ciclo: Vector3 delle ancore statiche creati in crea(); rettangoli riusati.
// =============================================================================
import { ETICHETTE, ETICHETTE_REGOLE as R, PALETTE, QUALITA } from '../config.js';
import { altezza, visibileSulTerreno, clamp, damp } from '../geo.js';

export const MONDO = 'ui';

const NS = 'http://www.w3.org/2000/svg';
// Impaginazione (config.ETICHETTE_REGOLE, tarature [ARCH])
const SPAZIO_TESTO = R.spazioTestoPx;            // px tra la fine del gomito e il testo
const MARGINE = R.marginePx;                     // px di respiro attorno a testi e ostacoli
const TESTATA_PX = R.testataPx;                  // il testo non sale sotto la testata
const AREA_PICCOLO = R.areaPiccolo;              // schermi piccoli: testo in basso, soggetto in alto
const SALTO_T = R.saltoT;                        // oltre questo salto di T niente smorzamenti (vaiT, indice)
const LAMBDA_ALZATA = R.lambdaAlzata;            // smorzamento dell'altezza del gomito
// candidati di impaginazione: [direzione, gradino di alzata]
const CANDIDATI = [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, 2], [-1, 2]];
// la piastra 5b (alta ~170 px) può anche appendersi SOTTO il punto (gradino −1: gomito verso il basso), quando
// sopra coprirebbe il punto di un'altra etichetta (K5.2: la stringa 14-B cade sotto il suo bordo superiore)
const CANDIDATI_PIASTRA = [...CANDIDATI, [-1, -1], [1, -1]];
const PENALITA_APPESA = 700;
const SOGLIA_INDICE_PX2 = 150;       // px² di sovrapposizione con le voci dell'indice oltre i quali l'indice si attenua
const candidatiDi = s => (s.piastra ? CANDIDATI_PIASTRA : CANDIDATI);
/** Alzata del gomito (px, verso l'alto; negativa = appesa sotto il punto). */
const alzataDi = (s, gradino) => (gradino < 0 ? -R.gomito.verticalePx : R.gomito.verticalePx + gradino * (s.h + MARGINE));

let E = null;
const perT0 = (a, b) => a.def.t0 - b.def.t0;
function slotDi(d) { for (const s of E.pool) if (s.def === d) return s; return null; }
function slotVuoto() { for (const s of E.pool) if (!s.def) return s; return null; }
function indiceCandidato(lista, dir, gr) { for (let k = 0; k < lista.length; k++) if (lista[k][0] === dir && lista[k][1] === gr) return k; return -1; }

export async function crea(ctx) {
  const strato = document.querySelector('.etichette');
  const svg = strato?.querySelector('.richiami');
  if (!strato || !svg || ctx.noWebGL) return;
  const V = ctx.THREE.Vector3;

  // definizioni con le ancore statiche già risolte
  const defs = ETICHETTE.map((d, i) => {
    let fissa = null, nome = null;
    if (Array.isArray(d.ancora)) fissa = new V(d.ancora[0], d.ancora[1], d.ancora[2]);
    else if (d.ancora && typeof d.ancora === 'object') fissa = new V(d.ancora.x, altezza(d.ancora.x, d.ancora.z) + (d.ancora.h || 0), d.ancora.z);
    else nome = d.ancora;
    const riserva = d.riserva ? new V(d.riserva[0], d.riserva[1], d.riserva[2]) : null;
    return { ...d, i, fissa, nomeAncora: nome, riserva, colore: PALETTE[d.colore] || PALETTE.oro };
  });

  const creaRichiamo = () => {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'richiamo'); g.style.opacity = '0';
    const p = document.createElementNS(NS, 'path'); p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 1';
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', String(R.gomito.puntoPx / 2));
    g.append(p, c); svg.appendChild(g); return { g, p, c };
  };
  const pool = [];
  for (let i = 0; i < Math.max(QUALITA.etichetteMax, R.max); i++) {
    const el = document.createElement('div'); el.className = 'etichetta';
    el.innerHTML = '<span class="etichetta-nome"></span><span class="etichetta-dato"></span>';
    strato.appendChild(el);
    pool.push(nuovoSlot(el, creaRichiamo()));
  }
  const piastraEl = document.getElementById('piastra-dati');
  const piastra = piastraEl ? nuovoSlot(piastraEl, creaRichiamo(), true) : null;
  const rett = () => ({ l: 0, t: 0, r: 0, b: 0, on: false });
  E = {
    ctx, defs, pool, piastra, tutti: piastra ? [...pool, piastra] : pool, attive: [], ordine: [], Tprec: -1,
    P: { x: 0, y: 0, z: 0, davanti: false, dentro: false },
    ostacoli: [rett(), rett(), rett()], posati: [rett(), rett(), rett(), rett()], gambe: [rett(), rett(), rett(), rett()], prova: rett(), gamba: rett(), ancora: rett(),
    colonnaDx: 0, conta: 0, indiceAttenuato: false,
    dom: { indice: document.querySelector('.indice'), hud: document.querySelector('.hud-strumento'), testi: document.querySelector('.testi'),
           vociIndice: [...document.querySelectorAll('.indice a[data-tappa], .indice .salta-servizi')] },
  };
  E.rettIndice = E.dom.vociIndice.map(rett);     // una per voce: l'ingombro vero del testo, non il riquadro dell'indice
  ctx.dati.etichette = E;                         // diagnostica (test.js, debug)
}

function nuovoSlot(el, r, piastra = false) {
  return { el, nome: el.querySelector?.('.etichetta-nome'), dato: el.querySelector?.('.etichetta-dato'), ...r, piastra,
           def: null, testoDato: '', x: 0, y: 0, vis: 0, nuovo: true, dir: 1, gradino: 0, k: 0, alzata: 0, w: 0, h: 0, ok: false, ultimo: {} };
}

/** Posizione mondo dell'ancora (Vector3 riusato) o null. */
function ancora(ctx, d) {
  if (d.fissa) return d.fissa;
  const a = ctx.ancore?.get(d.nomeAncora);
  const v = typeof a === 'function' ? a() : a;
  return (v && typeof v.x === 'number') ? v : d.riserva;
}

function scrivi(slot, k, v) { if (slot.ultimo[k] !== v) { slot.ultimo[k] = v; return true; } return false; }

function nascondi(slot) {
  if (scrivi(slot, 'op', '0')) { slot.el.style.opacity = '0'; slot.g.style.opacity = '0'; }
  slot.def = null; slot.vis = 0; slot.nuovo = true;
}

/** Ostacoli fissi dell'interfaccia (indice, strumento dell'HUD, colonna del testo): aggiornati ogni 10 fotogrammi. */
function aggiornaOstacoli(ctx) {
  const O = E.ostacoli, D = E.dom;
  const da = (i, el, visibile) => {
    const o = O[i]; o.on = false;
    if (!el || !visibile) return;
    const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
    o.l = r.left - MARGINE; o.t = r.top - MARGINE; o.r = r.right + MARGINE; o.b = r.bottom + MARGINE; o.on = true;
  };
  const indiceVisibile = D.indice && !D.indice.classList.contains('fuori') && getComputedStyle(D.indice).display !== 'none';
  da(0, D.indice, indiceVisibile);
  for (let i = 0; i < E.rettIndice.length; i++) {
    const o = E.rettIndice[i]; o.on = false;
    if (!indiceVisibile) continue;
    const r = D.vociIndice[i].getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    o.l = r.left - MARGINE; o.t = r.top; o.r = r.right + MARGINE; o.b = r.bottom; o.on = true;
  }
  da(1, D.hud?.querySelector('.strumento.attivo'), true);
  O[2].on = false;
  // bordo destro della colonna del testo (il gomito non porta mai il testo lì dentro)
  const t = D.testi?.getBoundingClientRect();
  E.colonnaDx = (t && !(ctx.flags.piccolo || innerWidth < 900)) ? t.right + 12 : 0;
}

const interseca = (a, b) => a.on && b.on && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
/** Sovrapposizione con le voci dell'indice (0 se fuori dal suo riquadro). */
function areaIndice(r) {
  if (!interseca(r, E.ostacoli[0])) return 0;
  let a = 0; for (const v of E.rettIndice) a += area(r, v);
  return a;
}

/** Area di sovrapposizione di due rettangoli (0 se disgiunti o spenti). */
function area(a, b) {
  if (!a.on || !b.on) return 0;
  const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return (w > 0 && h > 0) ? w * h : 0;
}
/** Rettangoli del candidato (direzione, gradino) alla posizione voluta: testo in E.prova, gomito in E.gamba. */
function geometria(s, dir, gradino) {
  const G = R.gomito, p = E.prova, g = E.gamba;
  const yL = s.y - alzataDi(s, gradino), xL = s.x + dir * G.orizzontalePx;
  p.l = dir > 0 ? xL + SPAZIO_TESTO : xL - SPAZIO_TESTO - s.w; p.r = p.l + s.w;
  p.t = s.piastra ? yL - 14 : yL - s.h / 2; p.b = p.t + s.h; p.on = true;
  g.l = Math.min(s.x, xL) - 2; g.r = Math.max(s.x, xL) + 2; g.t = Math.min(yL, s.y) - 2; g.b = Math.max(yL, s.y); g.on = true;
}

/**
 * Costo di un candidato (direzione, gradino): 0 = posto pulito. Pesi: fuori quadro e colonna del testo
 * (vietati), testi e gomiti interi delle altre etichette posate (le prime nPosati, tranne l'indice "salta"),
 * punti d'ancora di TUTTE le etichette attive (un testo non copre mai il punto di un'altra), strumento dell'HUD,
 * indice (si attenua, ma un testo sopra l'indice resta un difetto), più una preferenza per destra e per il
 * gomito corto.
 */
function costo(s, dir, gradino, nPosati, salta = -1) {
  const G = R.gomito, W = E.ctx.vista.w, H = E.ctx.vista.h, p = E.prova, g = E.gamba;
  geometria(s, dir, gradino);
  let c = (dir > 0 ? 0 : 400) + (gradino < 0 ? PENALITA_APPESA : gradino * 900);
  // fuori dal quadro, sotto la testata, dentro la colonna del testo
  const sx = Math.max(8, E.colonnaDx);
  c += 400 * (Math.max(0, sx - p.l) + Math.max(0, p.r - (W - 8)) + Math.max(0, TESTATA_PX - p.t) + Math.max(0, p.b - (H - 8))) * s.h;
  c += 4 * areaIndice(p) + 6 * area(p, E.ostacoli[1]);
  for (let i = 0; i < nPosati; i++) {
    if (i === salta) continue;
    const q = E.posati[i], gb = E.gambe[i];
    c += 30 * area(p, q) + 12 * area(g, q) + 12 * area(p, gb) + 6 * area(g, gb);
  }
  // punto d'ancora e primo tratto verticale delle altre etichette attive
  const A = E.ancora, vp = G.verticalePx;
  for (const o of E.ordine) {
    if (o === s || !o.def || o.vis < 0.05) continue;
    A.l = o.x - 8; A.r = o.x + 8; A.t = o.y - vp - 4; A.b = o.y + 8; A.on = true;
    c += 40 * area(p, A) + 6 * area(g, A);
  }
  return c;
}

/** Registra lo spazio occupato dall'etichetta i (testo con margine e gomito intero) per le altre. */
function occupa(s, i) {
  const [dir, gr] = candidatiDi(s)[s.k], G = R.gomito;
  geometria(s, dir, gr);
  const q = E.posati[i], gb = E.gambe[i], p = E.prova;
  q.l = p.l - MARGINE; q.r = p.r + MARGINE; q.t = p.t - MARGINE; q.b = p.b + MARGINE; q.on = true;
  const yL = s.y - alzataDi(s, gr), xL = s.x + dir * G.orizzontalePx;
  gb.l = Math.min(s.x, xL) - 3; gb.r = Math.max(s.x, xL) + 3; gb.t = Math.min(yL, s.y) - 3; gb.b = Math.max(yL, s.y) + 3; gb.on = true;
}

export function aggiorna(ctx, T, t, dt) {
  if (!E) return;
  const attiva = ctx.introFinita && !ctx.inWarmup && ctx.camera && !(ctx.scroll?.inSezioni);
  const salto = Math.abs(T - E.Tprec) > SALTO_T || dt === 0; E.Tprec = T;
  if (!attiva) { for (const s of E.tutti) if (s.def) nascondi(s); E.indiceAttenuato = false; return; }

  const piccolo = ctx.flags.piccolo || innerWidth < 900;
  const max = piccolo ? QUALITA.piccolo.etichetteMax : Math.min(R.max, QUALITA.etichetteMax);
  const W = ctx.vista.w, H = ctx.vista.h, zona = piccolo ? AREA_PICCOLO : R.area;   // stesso box di ctx.proietta
  const mondoValle = ctx.mondo === 'valle';

  // ---- etichette attive per T (con l'uscita di 0,03 T), al massimo 'max' in ordine di comparsa
  E.attive.length = 0;
  for (const d of E.defs) {
    if (T < d.t0 || T >= d.t1 + R.uscita) continue;
    if (E.attive.length >= max) break;
    E.attive.push(d);
  }
  // ---- assegnazione stabile agli slot (una definizione resta nel suo slot finché è attiva)
  for (const s of E.tutti) if (s.def && !E.attive.includes(s.def)) nascondi(s);
  for (const d of E.attive) {
    if (d.tipo === 'piastra') { if (E.piastra && E.piastra.def !== d) assegna(E.piastra, d); continue; }
    if (slotDi(d)) continue;
    const vuoto = slotVuoto(); if (vuoto) assegna(vuoto, d);
  }
  if ((E.conta++ % 10) === 0 || salto) aggiornaOstacoli(ctx);

  // ---- 1. proiezione e visibilità
  const cam = ctx.camera.position, P = E.P;
  E.ordine.length = 0;
  for (const s of E.tutti) {
    const d = s.def; if (!d) continue;
    if (!s.piastra) { const dato = d.datoDopo && T >= d.datoDopo.T ? d.datoDopo.testo : d.dato; if (dato !== s.testoDato) { s.testoDato = dato; s.dato.textContent = dato; s.w = 0; } }
    if (s.piastra && !s.el.childElementCount && !s.el.textContent.trim()) { nascondi(s); s.def = d; continue; }
    if (!s.w) { s.w = s.el.offsetWidth || 160; s.h = s.el.offsetHeight || 34; }
    const a = ancora(ctx, d); if (!a) { nascondi(s); continue; }
    ctx.proietta(a, P);
    let ok = P.davanti && P.x >= zona.x[0] * W && P.x <= zona.x[1] * W && P.y >= zona.y[0] * H && P.y <= zona.y[1] * H;
    if (ok && !mondoValle) ok = visibileSulTerreno(cam.x, cam.y, cam.z, a.x, a.y, a.z, R.passiOcclusione);
    const voluto = ok ? 1 : 0;
    if (salto || s.nuovo) s.vis = voluto;
    else if (voluto !== s.vis) {      // (a regime vis = voluto: niente passo, altrimenti 1 → 1 − passo → 1 sfarfalla)
      const passo = dt / (R.svanimentoMs / 1000); s.vis = voluto > s.vis ? Math.min(1, s.vis + passo) : Math.max(0, s.vis - passo);
    }
    if (P.davanti) {
      if (salto || s.nuovo) { s.x = P.x; s.y = P.y; }
      else { s.x = damp(s.x, P.x, R.smorzamento, dt); s.y = damp(s.y, P.y, R.smorzamento, dt); }
    }
    E.ordine.push(s);
  }
  // ---- 2. impaginazione in due passate. Prima: in ordine di comparsa (t0), contro le etichette già posate.
  //         Seconda: ogni scelta si rivede contro TUTTE le altre, così un'etichetta posata prima non occupa il
  //         posto naturale di una successiva. La scelta del fotogramma precedente resta se non costa
  //         sensibilmente di più (niente sfarfallio).
  E.ordine.sort(perT0);
  const n = E.ordine.length;
  for (let passata = 0; passata < (n > 1 ? 2 : 1); passata++) {
    for (let i = 0; i < n; i++) {
      const s = E.ordine[i], nConf = passata === 0 ? i : n, lista = candidatiDi(s);
      let scelto = 0, minimo = Infinity;
      for (let k = 0; k < lista.length; k++) {
        const c = costo(s, lista[k][0], lista[k][1], nConf, i);
        if (c < minimo) { minimo = c; scelto = k; }
      }
      if (!s.nuovo && s.dir) {
        const k = indiceCandidato(lista, s.dir, s.gradino);         // scelta del fotogramma precedente
        if (k >= 0 && k !== scelto && costo(s, s.dir, s.gradino, nConf, i) <= minimo * 1.15 + 200) scelto = k;
      }
      s.k = scelto;
      occupa(s, i);
    }
  }
  // ---- 3. scelte definitive, alzata smorzata, disegno
  let coperto = false;
  for (let i = 0; i < n; i++) {
    const s = E.ordine[i], [dir, gr] = candidatiDi(s)[s.k];
    geometria(s, dir, gr);
    // anche il solo gomito sopra l'indice lo attenua (K2.1: il punto della CP cade dentro l'indice)
    // (soglia: uno sfioro di pochi px fra le righe di 25 px dell'indice non lo attenua)
    s.sopraIndice = areaIndice(E.prova) + areaIndice(E.gamba) > SOGLIA_INDICE_PX2;
    if (s.sopraIndice && s.vis > 0.05) coperto = true;
    if (dir !== s.dir) { s.dir = dir; s.el.classList.toggle('sinistra', dir < 0); }
    s.gradino = gr;
    const alzata = alzataDi(s, gr);
    s.alzata = (salto || s.nuovo) ? alzata : damp(s.alzata, alzata, LAMBDA_ALZATA, dt);
    s.nuovo = false;
    // ingresso (gomito poi testo) e uscita, in T
    const d = s.def;
    const kin = clamp((T - d.t0) / R.ingresso, 0, 1), kout = clamp((T - d.t1) / R.uscita, 0, 1);
    disegna(s, clamp(kin * 2, 0, 1), clamp(kin * 2 - 1, 0, 1), s.vis * (1 - kout));
  }
  E.indiceAttenuato = coperto;                    // la classe .attenuato la scrive ui/indice.js (più richiedenti)
}

function assegna(s, d) {
  s.def = d; s.nuovo = true; s.vis = 0; s.ultimo = {}; s.gradino = 0; s.dir = 0;
  s.g.style.stroke = d.colore; s.c.style.fill = d.colore;
  if (!s.piastra) { s.nome.textContent = d.nome || ''; s.testoDato = d.dato || ''; s.dato.textContent = s.testoDato; }
  s.w = 0;
}

function disegna(s, gomito, testoK, alfa) {
  const G = R.gomito, x = s.x, y = s.y, dir = s.dir;
  const yL = y - s.alzata, xL = x + dir * G.orizzontalePx;
  const y0 = s.alzata >= 0 ? y - G.puntoPx / 2 - 1 : y + G.puntoPx / 2 + 1;     // il tratto parte dal bordo del punto
  const d1 = `M${x.toFixed(1)} ${y0.toFixed(1)}V${yL.toFixed(1)}H${xL.toFixed(1)}`;
  if (scrivi(s, 'd', d1)) s.p.setAttribute('d', d1);
  const cx = x.toFixed(1), cy = y.toFixed(1);
  if (scrivi(s, 'cx', cx)) s.c.setAttribute('cx', cx);
  if (scrivi(s, 'cy', cy)) s.c.setAttribute('cy', cy);
  const off = (1 - gomito).toFixed(3);
  if (scrivi(s, 'off', off)) s.p.style.strokeDashoffset = off;
  const r = (G.puntoPx / 2 * Math.min(1, gomito * 3)).toFixed(2);
  if (scrivi(s, 'r', r)) s.c.setAttribute('r', r);
  const ga = alfa.toFixed(3);
  if (scrivi(s, 'ga', ga)) s.g.style.opacity = ga;
  // testo: centrato in verticale sul tratto orizzontale; sale di 6 px mentre compare
  const tx = dir > 0 ? xL + SPAZIO_TESTO : xL - SPAZIO_TESTO - s.w;
  const ty = s.piastra ? yL - 14 : yL - s.h / 2 + (1 - testoK) * 6;
  const tr = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
  if (scrivi(s, 'tr', tr)) s.el.style.transform = tr;
  const op = (alfa * testoK).toFixed(3);
  if (scrivi(s, 'op', op)) s.el.style.opacity = op;
}

export function ridimensiona() { if (E) { for (const s of E.tutti) s.w = 0; E.conta = 0; } }
