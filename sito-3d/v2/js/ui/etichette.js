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
// TARATURA: proporre in config (non scritti in DESIGN)
const SPAZIO_TESTO = 8;                          // px tra la fine del gomito e il testo
const MARGINE = 10;                              // px di respiro attorno a testi e ostacoli
const TESTATA_PX = 76;                           // il testo non sale sotto la testata
const AREA_PICCOLO = { x: [0.06, 0.94], y: [0.10, 0.56] };   // schermi piccoli: testo in basso, soggetto in alto
const SALTO_T = 0.05;                            // oltre questo salto di T niente smorzamenti (vaiT, indice)
const LAMBDA_ALZATA = 14;                        // smorzamento dell'altezza del gomito
// candidati di impaginazione: [direzione, gradino di alzata]
const CANDIDATI = [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, 2], [-1, 2]];

let E = null;
const perT0 = (a, b) => a.def.t0 - b.def.t0;
function slotDi(d) { for (const s of E.pool) if (s.def === d) return s; return null; }
function slotVuoto() { for (const s of E.pool) if (!s.def) return s; return null; }
function indiceCandidato(dir, gr) { for (let k = 0; k < CANDIDATI.length; k++) if (CANDIDATI[k][0] === dir && CANDIDATI[k][1] === gr) return k; return -1; }

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
    ostacoli: [rett(), rett(), rett()], posati: [rett(), rett(), rett(), rett()], gambe: [rett(), rett(), rett(), rett()], prova: rett(), gamba: rett(),
    colonnaDx: 0, conta: 0, indiceAttenuato: false,
    dom: { indice: document.querySelector('.indice'), hud: document.querySelector('.hud-strumento'), testi: document.querySelector('.testi') },
  };
}

function nuovoSlot(el, r, piastra = false) {
  return { el, nome: el.querySelector?.('.etichetta-nome'), dato: el.querySelector?.('.etichetta-dato'), ...r, piastra,
           def: null, testoDato: '', x: 0, y: 0, vis: 0, nuovo: true, dir: 1, gradino: 0, alzata: 0, w: 0, h: 0, ok: false, ultimo: {} };
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
  da(1, D.hud?.querySelector('.strumento.attivo'), true);
  O[2].on = false;
  // bordo destro della colonna del testo (il gomito non porta mai il testo lì dentro)
  const t = D.testi?.getBoundingClientRect();
  E.colonnaDx = (t && !(ctx.flags.piccolo || innerWidth < 900)) ? t.right + 12 : 0;
}

const interseca = (a, b) => a.on && b.on && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** Area di sovrapposizione di due rettangoli (0 se disgiunti o spenti). */
function area(a, b) {
  if (!a.on || !b.on) return 0;
  const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return (w > 0 && h > 0) ? w * h : 0;
}
/**
 * Costo di un candidato (direzione, gradino): 0 = posto pulito. Pesi: fuori quadro e colonna del testo
 * (vietati), testi e gomiti delle etichette già posate, strumento dell'HUD, indice (lieve: si attenua),
 * più una preferenza per destra e per il gomito corto. Scrive E.prova e E.copreIndice.
 */
function costo(s, dir, gradino, nPosati) {
  const G = R.gomito, W = innerWidth, H = innerHeight, p = E.prova, g = E.gamba;
  const lift = G.verticalePx + gradino * (s.h + MARGINE);
  const yL = s.y - lift, xL = s.x + dir * G.orizzontalePx;
  p.l = dir > 0 ? xL + SPAZIO_TESTO : xL - SPAZIO_TESTO - s.w; p.r = p.l + s.w;
  p.t = s.piastra ? yL - 14 : yL - s.h / 2; p.b = p.t + s.h; p.on = true;
  g.l = Math.min(s.x, xL) - 2; g.r = Math.max(s.x, xL) + 2; g.t = yL - 2; g.b = s.y; g.on = true;
  let c = (dir > 0 ? 0 : 400) + gradino * 900;
  // fuori dal quadro, sotto la testata, dentro la colonna del testo
  const sx = Math.max(8, E.colonnaDx);
  c += 400 * (Math.max(0, sx - p.l) + Math.max(0, p.r - (W - 8)) + Math.max(0, TESTATA_PX - p.t) + Math.max(0, p.b - (H - 8))) * s.h;
  const ind = area(p, E.ostacoli[0]);
  E.copreIndice = ind > 0;
  c += 0.6 * ind + 6 * area(p, E.ostacoli[1]);
  for (let i = 0; i < nPosati; i++) {
    const q = E.posati[i];
    c += 30 * area(p, q) + 12 * area(g, q) + 12 * area(p, E.gambe[i]);
  }
  return c;
}

export function aggiorna(ctx, T, t, dt) {
  if (!E) return;
  const attiva = ctx.introFinita && !ctx.inWarmup && ctx.camera && !(ctx.scroll?.inSezioni);
  const salto = Math.abs(T - E.Tprec) > SALTO_T || dt === 0; E.Tprec = T;
  if (!attiva) { for (const s of E.tutti) if (s.def) nascondi(s); if (E.indiceAttenuato) { E.indiceAttenuato = false; E.dom.indice?.classList.remove('attenuato'); } return; }

  const piccolo = ctx.flags.piccolo || innerWidth < 900;
  const max = piccolo ? QUALITA.piccolo.etichetteMax : Math.min(R.max, QUALITA.etichetteMax);
  const W = innerWidth, H = innerHeight, area = piccolo ? AREA_PICCOLO : R.area;
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
    let ok = P.davanti && P.x >= area.x[0] * W && P.x <= area.x[1] * W && P.y >= area.y[0] * H && P.y <= area.y[1] * H;
    if (ok && !mondoValle) ok = visibileSulTerreno(cam.x, cam.y, cam.z, a.x, a.y, a.z, R.passiOcclusione);
    const voluto = ok ? 1 : 0;
    if (salto || s.nuovo) s.vis = voluto;
    else { const passo = dt / (R.svanimentoMs / 1000); s.vis = voluto > s.vis ? Math.min(1, s.vis + passo) : Math.max(0, s.vis - passo); }
    if (P.davanti) {
      if (salto || s.nuovo) { s.x = P.x; s.y = P.y; }
      else { s.x = damp(s.x, P.x, R.smorzamento, dt); s.y = damp(s.y, P.y, R.smorzamento, dt); }
    }
    E.ordine.push(s);
  }
  // ---- 2. impaginazione in ordine di comparsa (t0): la scelta precedente resta se è ancora libera
  E.ordine.sort(perT0);
  let n = 0, coperto = false;
  for (const s of E.ordine) {
    // candidato più economico; quello attuale resta se non costa sensibilmente di più (niente sfarfallio)
    let scelto = 0, minimo = Infinity, sopra = false;
    for (let k = 0; k < CANDIDATI.length; k++) {
      const c = costo(s, CANDIDATI[k][0], CANDIDATI[k][1], n);
      if (c < minimo) { minimo = c; scelto = k; sopra = E.copreIndice; }
    }
    if (!s.nuovo && s.dir) {
      const k = indiceCandidato(s.dir, s.gradino);
      if (k >= 0 && k !== scelto) { const c = costo(s, s.dir, s.gradino, n); if (c <= minimo * 1.15 + 200) { scelto = k; sopra = E.copreIndice; } }
    }
    s.sopraIndice = sopra;
    if (sopra && s.vis > 0.05) coperto = true;
    const [dir, gr] = CANDIDATI[scelto];
    if (dir !== s.dir) { s.dir = dir; s.el.classList.toggle('sinistra', dir < 0); }
    s.gradino = gr;
    const alzata = R.gomito.verticalePx + gr * (s.h + MARGINE);
    s.alzata = (salto || s.nuovo) ? alzata : damp(s.alzata, alzata, LAMBDA_ALZATA, dt);
    costo(s, dir, 0, 0);                                          // rettangolo occupato (per le successive)
    const q = E.posati[n], gb = E.gambe[n], p = E.prova, dy = s.alzata - R.gomito.verticalePx; n++;
    q.l = p.l - MARGINE; q.r = p.r + MARGINE; q.t = p.t - dy - MARGINE; q.b = p.b - dy + MARGINE; q.on = true; q.testo = true;
    gb.l = s.x - 3; gb.r = s.x + 3; gb.t = s.y - s.alzata; gb.b = s.y; gb.on = true;
    s.nuovo = false;
    // ingresso (gomito poi testo) e uscita, in T
    const d = s.def;
    const kin = clamp((T - d.t0) / R.ingresso, 0, 1), kout = clamp((T - d.t1) / R.uscita, 0, 1);
    disegna(s, clamp(kin * 2, 0, 1), clamp(kin * 2 - 1, 0, 1), s.vis * (1 - kout));
  }
  if (coperto !== E.indiceAttenuato) { E.indiceAttenuato = coperto; E.dom.indice?.classList.toggle('attenuato', coperto); }
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
  const d1 = `M${x.toFixed(1)} ${(y - G.puntoPx / 2 - 1).toFixed(1)}V${yL.toFixed(1)}H${xL.toFixed(1)}`;
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
