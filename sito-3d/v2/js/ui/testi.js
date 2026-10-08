// =============================================================================
// ERI v2 · ui/testi.js — battute della storia: ingressi/uscite legati a T, righe a maschera, occhielli decodificati, velo .scrim
// Proprietario: [BASE-REGIA].
// Specifica: DESIGN §4.0 "Testi" (ingresso 0,08 T: righe yPercent 110 → 0 expo.out sfalsate di 0,012 T,
// occhiello decodificato 300 ms all'attivazione, paragrafo opacità 0 → 1 e y 12 → 0 px; uscita 0,05 T:
// opacità 0, y −16 px), §4.0 "Colonna del testo" (.scrim 0 → 1 in 0,04 T), §5.2 punto 4 (titolo della
// battuta 0 a tempo dopo l'intro), §5.7 (divisore di righe fatto in casa, decodifica), §6.11 (riduci:
// dissolvenza di 200 ms, niente maschere né decodifica), §6.12 (senza WebGL: blocchi statici),
// config.BATTUTE, config.TESTI_REGIA, config.INTRO.
//
// Principio: tutto ciò che dipende dallo scroll è una funzione pura di T (reversibile, saltabile con
// vaiT). Restano a tempo solo la decodifica dell'occhiello, l'ingresso della battuta 0 dopo l'intro e
// le dissolvenze del riduci movimento. Il DOM si scrive solo quando un valore cambia.
//
// Stato scritto sul DOM (lo stile è di [BASE-UI], vedi css/stile.css):
//  .battuta.attiva (visibilità) + style.opacity/transform dell'articolo, delle righe e dei blocchi;
//  1a: li[data-voce].spuntata, li[data-voce=idonea].visibile;  2a: .diagramma.binari --riempimento,
//  span[data-nodo].acceso/.tratteggiato;  2b: .diagramma.corsie span[data-corsia] --riempimento,
//  span.passo[data-passo].acceso (i passi della corsia sono avvolti qui, una volta sola).
//
// Contratto (ARCHITETTURA §6):
//  export function dividiRighe(el) → {righe: HTMLElement[], ricalcola()}   (idempotente: stessa istanza per lo stesso el)
//  export function decodifica(el, ms = 300) → void
//  crea(ctx), aggiorna(ctx, T, t, dt). Pubblica ctx.dati.testi = { battute, entraApertura(), presenza }.
// =============================================================================
import { TESTI_REGIA as TR, BATTUTE, COLONNA, INTRO, DOPO_STORIA } from '../config.js';
import { clamp } from '../geo.js';
import { ease } from '../regia/stato.js';

export const MONDO = 'ui';

const expoOut = ease('expo.out');
const p2io = ease('power2.inOut');
// Ritmo dei blocchi e dei diagrammi (config.TESTI_REGIA, tarature [ARCH])
const BLOCCO_RITARDO = TR.bloccoRitardo, BLOCCO_SFALSAMENTO = TR.bloccoSfalsamento;   // T: paragrafo e blocchi dopo il titolo
const SPENTO = TR.spento;                                    // opacità di voci e nodi non ancora accesi
const ACCENSIONE = TR.accensione;                            // T per accendere una voce o un nodo
const AU_FRAZIONE = TR.auFrazione;                           // il binario AU si accende a metà del riempimento
const SALTO_T = TR.saltoT;                                   // oltre questo salto di T le dissolvenze del riduci non si animano

// ---------------------------------------------------------------- divisore di righe (§5.7)
const DIVISI = new WeakMap();
const STILE_MASCHERA = 'display:block;overflow:hidden;padding:.06em .12em .14em 0;margin:-.06em -.12em -.14em 0';
const STILE_RIGA = 'display:block;will-change:translate';

/**
 * Divide un titolo in righe mascherate: <span.riga-maschera><span.riga>…parole…</span></span>.
 * Conserva gli elementi in linea (es. <em>) clonandoli per ogni riga. Idempotente.
 * @param {HTMLElement} el
 * @returns {{righe: HTMLElement[], ricalcola(): void}}
 */
export function dividiRighe(el) {
  if (!el) return { righe: [], ricalcola() {} };
  if (DIVISI.has(el)) return DIVISI.get(el);
  const originale = el.innerHTML;
  const ris = { righe: [], ricalcola: costruisci };
  DIVISI.set(el, ris);

  function costruisci() {
    el.innerHTML = originale;
    // 1. parole in span (inline-block), con il ricordo dello spazio che le precede
    const parole = [];
    let spazio = false;
    const visita = (nodo) => {
      for (const n of [...nodo.childNodes]) {
        if (n.nodeType === 3) {
          // spazi normali sì, spazio indivisibile (&nbsp;) no: "e&nbsp;connessione" resta una parola sola
          const parti = n.nodeValue.split(/([^\S\u00a0]+)/), frag = document.createDocumentFragment();
          for (const p of parti) {
            if (!p) continue;
            if (/^[^\S\u00a0]+$/.test(p)) { spazio = true; continue; }
            const s = document.createElement('span');
            s.className = 'parola'; s.style.display = 'inline-block'; s.textContent = p;
            s._spazio = spazio && parole.length > 0; spazio = false;
            frag.appendChild(s); parole.push(s);
            frag.appendChild(document.createTextNode(' '));
          }
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { spazio = false; continue; }
          visita(n);
        }
      }
    };
    visita(el);
    if (!parole.length) { ris.righe = []; return; }
    // 2. raggruppa per riga (posizione verticale)
    const gruppi = []; let ultimo = -Infinity;
    for (const w of parole) {
      const top = w.getBoundingClientRect().top;
      if (!gruppi.length || top > ultimo + 2) { gruppi.push([]); ultimo = top; }
      gruppi[gruppi.length - 1].push(w);
    }
    // 3. ricostruisci: una maschera per riga, antenati in linea clonati
    const catena = (w) => { const c = []; for (let p = w.parentNode; p && p !== el; p = p.parentNode) c.unshift(p); return c; };
    const catene = new Map(parole.map(w => [w, catena(w)]));
    el.innerHTML = '';
    const righe = [];
    for (const g of gruppi) {
      const m = document.createElement('span'); m.className = 'riga-maschera'; m.style.cssText = STILE_MASCHERA;
      const r = document.createElement('span'); r.className = 'riga'; r.style.cssText = STILE_RIGA;
      m.appendChild(r); el.appendChild(m); righe.push(r);
      let pila = [];                                   // [{orig, clone}]
      g.forEach((w, i) => {
        const c = catene.get(w);
        let k = 0; while (k < pila.length && k < c.length && pila[k].orig === c[k]) k++;
        pila = pila.slice(0, k);
        const contenitore = () => (pila.length ? pila[pila.length - 1].clone : r);
        if (i > 0 && w._spazio) contenitore().appendChild(document.createTextNode(' '));
        for (let j = k; j < c.length; j++) { const cl = c[j].cloneNode(false); contenitore().appendChild(cl); pila.push({ orig: c[j], clone: cl }); }
        contenitore().appendChild(w);
      });
    }
    ris.righe = righe;
  }
  costruisci();
  return ris;
}

// ---------------------------------------------------------------- decodifica dell'occhiello (§5.7)
const DECODIFICHE = new WeakMap();   // el → {finale, raf}
/**
 * Occhiello "decodificato": caratteri casuali dell'alfabeto, fissati da sinistra in ms millisecondi.
 * @param {HTMLElement} el @param {number} [ms]
 */
export function decodifica(el, ms = TR.decodificaMs) {
  if (!el) return;
  let d = DECODIFICHE.get(el);
  if (!d) { d = { finale: el.textContent, raf: 0 }; DECODIFICHE.set(el, d); el.setAttribute('aria-label', d.finale); }
  if (d.raf) cancelAnimationFrame(d.raf);
  const A = TR.alfabetoDecodifica, F = d.finale, t0 = performance.now();
  const passo = (ora) => {
    const k = clamp((ora - t0) / ms, 0, 1), n = Math.floor(k * F.length);
    if (k >= 1) { el.textContent = F; d.raf = 0; return; }
    let s = F.slice(0, n);
    for (let i = n; i < F.length; i++) { const c = F[i]; s += (c === ' ' || c === '·') ? c : A[(Math.random() * A.length) | 0]; }
    el.textContent = s;
    d.raf = requestAnimationFrame(passo);
  };
  d.raf = requestAnimationFrame(passo);
}

// ---------------------------------------------------------------- scritture minime sul DOM
function rec(el) { return { el, op: -1, y: NaN, extra: NaN, cls: null }; }
function opacita(r, v) { if (Math.abs(r.op - v) > 0.002 || (v !== r.op && (v === 0 || v === 1))) { r.op = v; r.el.style.opacity = v.toFixed(3); } }
// Spostamenti con la proprietà CSS 'translate' (si compone con 'transform': .battuta usa translateY(−50%) nel CSS)
function trasla(r, ypx) { if (!(Math.abs(r.y - ypx) <= 0.05) || (ypx === 0 && r.y !== 0)) { r.y = ypx; r.el.style.translate = ypx === 0 ? 'none' : `0 ${ypx.toFixed(2)}px`; } }
function traslaPercento(r, yp) { if (!(Math.abs(r.y - yp) <= 0.05) || (yp === 0 && r.y !== 0)) { r.y = yp; r.el.style.translate = yp === 0 ? 'none' : `0 ${yp.toFixed(2)}%`; } }
function classe(el, nome, si, stato, chiave) { if (stato[chiave] !== si) { stato[chiave] = si; el.classList.toggle(nome, si); } }
function variabile(r, nome, v) { if (!(Math.abs(r.extra - v) <= 0.002)) { r.extra = v; r.el.style.setProperty(nome, v.toFixed(3)); } }

// ---------------------------------------------------------------- crea
export async function crea(ctx) {
  const scrim = document.querySelector('.scrim');
  const battute = [];
  for (const B of BATTUTE) {
    const el = document.querySelector(`.battuta[data-battuta="${B.id}"]`);
    if (!el) continue;
    const occ = el.querySelector('.occhiello'), tit = el.querySelector('h1, h2');
    const b = { ...B, el, art: rec(el), occ: occ ? rec(occ) : null, tit, div: null, righeSrc: null, righe: [],
                blocchi: [...el.children].filter(c => c !== occ && c !== tit).map(rec),
                attiva: null, stato: {}, alfa: 0, voci: [], nodi: [], corsie: [], domBinari: null };
    battute.push(b);
  }
  const dati = ctx.dati.testi = { battute, presenza: 0, t0Apertura: null, entraApertura: null };

  // senza WebGL (§6.12): la storia diventa una sequenza di blocchi statici, tutti visibili
  if (ctx.noWebGL) { for (const b of battute) b.el.classList.add('attiva'); return; }

  // ---- righe mascherate (non con riduci movimento: §6.11)
  const dividi = () => { for (const b of battute) if (b.tit) b.div = dividiRighe(b.tit); };
  if (!ctx.flags.riduci) dividi();
  let timer = 0;
  const ricalcola = () => { clearTimeout(timer); timer = setTimeout(() => { for (const b of battute) b.div?.ricalcola(); }, 200); };
  // a capo ricalcolati solo se può cambiare l'impaginazione: la larghezza, o l'altezza sopra 900 px (i titoli
  // usano anche vh). Sotto 900 px l'altezza cambia con la barra degli indirizzi mobile e non sposta gli a capo.
  const chiaveImpaginazione = () => innerWidth + 'x' + (innerWidth >= 900 ? innerHeight : 0);
  let impaginazione = chiaveImpaginazione();
  addEventListener('resize', () => { const k = chiaveImpaginazione(); if (k !== impaginazione) { impaginazione = k; ricalcola(); } });
  document.fonts?.addEventListener?.('loadingdone', ricalcola);
  ctx.eventi.on('riduci', on => { if (!on) dividi(); });

  // ---- elementi speciali (legende e diagrammi): solo stato
  for (const b of battute) {
    b.voci = [...b.el.querySelectorAll('.legenda li[data-voce]')].map(li => ({ r: rec(li), voce: li.dataset.voce, stato: {} }));
    const bin = b.el.querySelector('.diagramma.binari');
    if (bin) {
      b.domBinari = rec(bin);
      b.nodi = [...bin.querySelectorAll('[data-nodo]')].map(n => ({ r: rec(n), nodo: n.dataset.nodo, stato: {} }));
      for (const n of b.nodi) if (n.nodo === 'pas' || n.nodo === 'via') n.r.el.classList.add('tratteggiato');
    }
    const cor = b.el.querySelector('.diagramma.corsie');
    if (cor) {
      for (const span of cor.querySelectorAll('[data-corsia]')) {
        const c = { r: rec(span), corsia: span.dataset.corsia, passi: [], stato: {} };
        // i passi "richiesta → preventivo (STMG) → accettazione" diventano span accendibili (una volta sola)
        if (c.corsia === 'connessione' && !span.children.length && span.textContent.includes('→')) {
          const testo = span.textContent, m = /^(.*?·\s*)(.*)$/.exec(testo), etichetta = m ? m[1] : '', resto = m ? m[2] : testo;
          span.textContent = '';
          if (etichetta) { const e = document.createElement('span'); e.className = 'etichetta-corsia'; e.textContent = etichetta; span.appendChild(e); }
          resto.split(/\s*→\s*/).forEach((p, i, a) => {
            const s = document.createElement('span'); s.className = 'passo'; s.dataset.passo = String(i); s.textContent = p; span.appendChild(s);
            if (i < a.length - 1) span.appendChild(document.createTextNode(' → '));
          });
        }
        c.passi = [...span.querySelectorAll('.passo')].map(s => ({ r: rec(s), stato: {} }));
        b.corsie.push(c);
      }
    }
  }

  // ---- battuta 0: ingresso a tempo dopo l'intro (§5.2 punto 4). intro.js può anticiparlo con entraApertura().
  dati.entraApertura = () => {
    if (dati.t0Apertura != null) return;
    dati.t0Apertura = ctx.flags.test ? -1e6 : ctx.tempo.t;     // in test: subito completo (deterministico)
    const b0 = battute.find(b => b.in == null);
    if (b0?.occ && !ctx.flags.riduci && !ctx.flags.test) decodifica(b0.occ.el);
  };
  ctx.eventi.on('intro-fine', dati.entraApertura);
  dati.scrim = scrim ? rec(scrim) : null;
  // gradiente del velo: unica fonte config.COLONNA (lo usa anche test.js per il contrasto); il CSS lo legge da --scrim
  scrim?.style.setProperty('--scrim', COLONNA.scrim);
  scrim?.style.setProperty('--scrim-piccolo', COLONNA.scrimPiccolo);   // sotto 900 px (velo verticale, §6.12)
}

// ---------------------------------------------------------------- aggiorna (ogni fotogramma)
let Tprec = 0;
export function aggiorna(ctx, T, t, dt) {
  const d = ctx.dati.testi; if (!d || ctx.noWebGL) return;
  if (d.t0Apertura == null && ctx.introFinita) d.entraApertura();
  const riduci = !!ctx.flags.riduci, salto = Math.abs(T - Tprec) > SALTO_T; Tprec = T;
  const ING = TR.ingresso, USC = TR.uscita, SF = TR.sfalsamentoRighe, SCR = COLONNA.scrimDurataT;
  // le battute con out:null restano "fino alle sezioni": escono nella prima metà dell'ingresso di #chi-siamo
  const fineStoria = clamp((ctx.veli.sezioni || 0) / (DOPO_STORIA.veloChiSiamo * 0.5), 0, 1);
  let presenza = 0;

  for (let i = 0; i < d.battute.length; i++) {
    const b = d.battute[i];
    const apertura = b.in == null;
    const sA = apertura && d.t0Apertura != null ? t - d.t0Apertura : -1;       // secondi dall'inizio dell'ingresso a tempo
    const dentro = (apertura ? d.t0Apertura != null : T >= b.in) && (b.out == null ? fineStoria < 1 : T < b.out + USC);
    const uscita = p2io(b.out == null ? fineStoria : clamp((T - b.out) / USC, 0, 1));

    // ---- riduci movimento: dissolvenza di 200 ms, nessuna maschera
    if (riduci) {
      const voluto = dentro && (b.out == null ? fineStoria < 0.5 : T < b.out) ? 1 : 0;
      b.alfa = salto ? voluto : (voluto > b.alfa ? Math.min(voluto, b.alfa + dt / (TR.riduciMs / 1000)) : Math.max(voluto, b.alfa - dt / (TR.riduciMs / 1000)));
      const vis = b.alfa > 0.001;
      if (vis !== b.attiva) { b.attiva = vis; b.el.classList.toggle('attiva', vis); }
      opacita(b.art, b.alfa); trasla(b.art, 0);
      if (b.occ) opacita(b.occ, 1);
      for (const r of b.righe) traslaPercento(r, 0);
      for (const r of b.blocchi) { opacita(r, 1); trasla(r, 0); }
      presenza = Math.max(presenza, b.alfa);
      speciali(b, T, true);
      continue;
    }

    if (dentro !== b.attiva) {
      b.attiva = dentro; b.el.classList.toggle('attiva', dentro);
      if (dentro && !apertura && b.occ && !ctx.flags.test) decodifica(b.occ.el);   // "lanciato all'attivazione"
    }
    if (!dentro) continue;

    // righe aggiornate dopo un ricalcolo del divisore
    if (b.div && b.div.righe !== b.righeSrc) { b.righeSrc = b.div.righe; b.righe = b.righeSrc.map(rec); }

    // ---- ingresso
    let ingresso;
    if (apertura) {
      const rit = INTRO.titoloRitardoMs / 1000, dur = INTRO.titoloMs / 1000, sf = INTRO.titoloSfalsamentoS;
      for (let k = 0; k < b.righe.length; k++) traslaPercento(b.righe[k], 110 * (1 - expoOut(clamp((sA - rit - k * sf) / dur, 0, 1))));
      if (b.occ) opacita(b.occ, expoOut(clamp(sA / 0.6, 0, 1)));
      const lead = rit + Math.max(0, b.righe.length - 1) * sf + 0.5, durLead = INTRO.leadMs / 1000;
      for (let k = 0; k < b.blocchi.length; k++) {
        const p = expoOut(clamp((sA - lead - k * 0.25) / durLead, 0, 1));
        opacita(b.blocchi[k], p); trasla(b.blocchi[k], TR.ingressoY * (1 - p));
      }
      ingresso = clamp(sA / 0.6, 0, 1);
    } else {
      const x = T - b.in;
      for (let k = 0; k < b.righe.length; k++) traslaPercento(b.righe[k], 110 * (1 - expoOut(clamp((x - k * SF) / ING, 0, 1))));
      if (b.occ) opacita(b.occ, expoOut(clamp(x / ING, 0, 1)));
      for (let k = 0; k < b.blocchi.length; k++) {
        const p = expoOut(clamp((x - BLOCCO_RITARDO - k * BLOCCO_SFALSAMENTO) / ING, 0, 1));
        opacita(b.blocchi[k], p); trasla(b.blocchi[k], TR.ingressoY * (1 - p));
      }
      ingresso = clamp(x / SCR, 0, 1);
    }
    // ---- uscita (tutto l'articolo)
    opacita(b.art, 1 - uscita); trasla(b.art, TR.uscitaY * uscita);
    const via = b.out == null ? fineStoria : clamp((T - b.out) / SCR, 0, 1);
    presenza = Math.max(presenza, ingresso * (1 - via));
    speciali(b, T, false);
  }

  // ---- velo .scrim: segue la presenza del testo (0 → 1 in 0,04 T)
  d.presenza = presenza;
  if (d.scrim) opacita(d.scrim, presenza);
}

/** Legende e diagrammi come funzione di T (§4.2, §4.3). */
function accensione(T, t0, riduci) { return riduci ? (T >= t0 ? 1 : 0) : clamp((T - t0) / ACCENSIONE, 0, 1); }
function speciali(b, T, riduci) {
  // 1a: le voci si spuntano al timbro dei fogli; "Area idonea" compare a 3,20
  if (b.voci.length) {
    for (const v of b.voci) {
      if (v.voce === 'idonea') {
        const p = b.areaIdonea != null ? accensione(T, b.areaIdonea, riduci) : 1;
        opacita(v.r, p); classe(v.r.el, 'visibile', p > 0, v.stato, 'vis');
      } else if (b.spunte && b.spunte[+v.voce] != null) {
        const p = accensione(T, b.spunte[+v.voce], riduci);
        opacita(v.r, SPENTO + (1 - SPENTO) * p); classe(v.r.el, 'spuntata', p >= 1 || (riduci && p > 0), v.stato, 'sp');
      }
    }
  }
  // 2a: binari (Progetto → AU acceso; PAS e VIA tratteggiati; Titolo a 7,00)
  if (b.domBinari && b.binari) {
    const T0 = b.binari[0], T1 = b.binari[1];
    const riemp = riduci ? (T >= T0 ? 1 : 0) : clamp((T - T0) / Math.max(1e-6, T1 - T0), 0, 1);
    variabile(b.domBinari, '--riempimento', riemp);
    for (const n of b.nodi) {
      let p = 0;
      if (n.nodo === 'progetto') p = accensione(T, T0, riduci);
      else if (n.nodo === 'au') p = accensione(T, T0 + AU_FRAZIONE * (T1 - T0), riduci);
      else if (n.nodo === 'titolo') p = b.titolo ? accensione(T, b.titolo[0], riduci) : 0;
      else if (n.nodo === 'via') p = 0.6;
      opacita(n.r, SPENTO + (1 - SPENTO) * p);
      classe(n.r.el, 'acceso', p >= 1 && n.nodo !== 'via' && n.nodo !== 'pas', n.stato, 'acc');
    }
  }
  // 2b: corsie (passi in sequenza; GSE in parallelo)
  for (const c of b.corsie) {
    if (c.corsia === 'gse' && b.gse) {
      const p = riduci ? (T >= b.gse[0] ? 1 : 0) : clamp((T - b.gse[0]) / Math.max(1e-6, b.gse[1] - b.gse[0]), 0, 1);
      variabile(c.r, '--riempimento', p); opacita(c.r, SPENTO + (1 - SPENTO) * p); classe(c.r.el, 'acceso', p >= 1, c.stato, 'acc');
    } else if (c.corsia === 'connessione' && b.passi) {
      let n = 0;
      for (let k = 0; k < c.passi.length; k++) {
        const p = b.passi[k] != null ? accensione(T, b.passi[k], riduci) : 0; if (p >= 1) n++;
        opacita(c.passi[k].r, SPENTO + (1 - SPENTO) * p); classe(c.passi[k].r.el, 'acceso', p >= 1, c.passi[k].stato, 'acc');
      }
      variabile(c.r, '--passo', n);
    }
  }
}
