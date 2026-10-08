// =============================================================================
// ERI v2 · ui/intro.js — preloader con il logo ufficiale, avanzamento reale, intro e uscita sulla linea del fiume
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.2 (sequenza completa), §1.2 momento WOW 1 ("la linea d'oro del preloader si piega e
// diventa il fiume"), §6.11 (riduci movimento), §6.12 (schermi piccoli: intro breve), config.INTRO,
// config.CARICAMENTO, config.LINEA_ORO.
//
// Sequenza (tempi da config.INTRO):
//  1. caricamento reale: contorni dei petali per coppia a ogni gruppo completato (500 ms, expo.out);
//     linea d'oro di 1 px che cresce da sinistra con il progresso reale; contatore 000 → 100; didascalia.
//  2. rivelazione (evento 'pronto'): riempimento dei petali (600 ms, sfalsati di 60 ms), foglie/nastro/collina
//     (400 ms), scritte (500 ms, scala 1,02 → 1), pausa 700 ms.
//  3. uscita: FLIP del logo nella testata (1,0 s, expo.inOut; negli ultimi 200 ms passa la mano al simbolo
//     della testata); la linea si allunga a tutta larghezza (300 ms) e si piega sulla polilinea proiettata del
//     fiume in K0.0 (64 punti, z −400 → 400; 900 ms, power2.inOut); il fondo svanisce 600 ms dopo l'inizio
//     del morph; la linea svanisce in 400 ms quando il fiume della carta è visibile.
//  4. 'intro-fine' → ui/testi.js fa salire le righe dell'H1 (dopo 300 ms), poi il lead e "Scorri".
//  Salto con rotella, tasto o clic (e il bottone "Salta l'intro"): timeline al 100% con dissolvenza di 300 ms.
//  Seconda visita (sessionStorage 'eri-intro') e schermi piccoli: versione breve da 1,2 s senza disegno dei petali.
//  Riduci movimento: logo in dissolvenza (300 ms), pausa 500 ms, uscita in 300 ms, nessun morph.
//  Il logo non si ricolora, non si estrude e non ruota mai.
//
// Contratto (ARCHITETTURA §2, §11): crea(ctx) gira PRIMA di renderer e caricamento (solo DOM, eventi,
// config, flags). Alla fine: ctx.introFinita = true ed evento 'intro-fine' (con ctx.flags.intro falso lo fa main).
// =============================================================================
import { INTRO, LINEA_ORO } from '../config.js';
import { fiumeX, clamp, damp } from '../geo.js';
import { ease } from '../regia/stato.js';
import { creaLineaOro } from './lineaOro.js';

export const MONDO = 'ui';

const EXPO_OUT = 'cubic-bezier(.16,1,.3,1)';
const EXPO_INOUT = 'cubic-bezier(.87,0,.13,1)';
const p2io = ease('power2.inOut');

// TARATURA: proporre in config (sovrapposizioni della rivelazione, non scritte in DESIGN)
const FOGLIE_DA_MS = 900, SCRITTE_DA_MS = 1100;   // foglie/nastro/collina e scritte partono prima della fine dei petali
const SCRITTE_VIA_MS = 350;                        // durante il FLIP scritte e collina svaniscono (la testata ha solo il simbolo)
const FONDO_MS = 700;                              // durata della dissolvenza del fondo
const BREVE = { flip: 700, allunga: 150, morph: 600, fondo: 450, fine: 600, lineaVia: 900, totale: 1200 };

let D = null;        // riferimenti DOM e stato
// Solo verifica: ?introlenta=N rallenta l'intro di N volte (le schermate SwiftShader sono lente). Default 1.
const LENTO = Math.max(1, Math.min(20, +(new URLSearchParams(location.search).get('introlenta') || 1) || 1));

/** Mini-timeline: eventi puntuali e tratti continui in ms dall'avvio; completa() = progress(1). */
function creaTimeline() {
  const ev = [], tr = [];
  let t0 = null, finita = false;
  const tl = {
    a(t, fn) { ev.push({ t, fn, ok: false }); return tl; },
    tra(da, a, fn, e = 'none') { tr.push({ da, a, fn, e: ease(e), fine: false }); return tl; },
    avvia(ora) { t0 = ora; return tl; },
    get avviata() { return t0 != null; },
    get finita() { return finita; },
    /** Avanza al tempo ora (ms di performance.now()). */
    avanza(ora) {
      if (t0 == null || finita) return finita;
      const te = (ora - t0) / LENTO; let tutto = true;
      // prima gli eventi puntuali (preparano lo stato), poi i tratti continui che partono allo stesso istante
      for (const e of ev) { if (!e.ok && te >= e.t) { e.ok = true; e.fn(); } if (!e.ok) tutto = false; }
      for (const c of tr) {
        if (c.fine) continue;
        if (te >= c.da) { const k = clamp((te - c.da) / Math.max(1, c.a - c.da), 0, 1); c.fn(c.e(k)); if (k >= 1) c.fine = true; }
        if (!c.fine) tutto = false;
      }
      finita = tutto; return finita;
    },
    completa() { if (t0 == null) t0 = performance.now(); return tl.avanza(t0 + 1e9); },
  };
  return tl;
}

export async function crea(ctx) {
  const html = document.documentElement;
  const pre = document.getElementById('preloader');
  if (!pre) { html.classList.remove('intro-attiva'); return; }
  if (ctx.noWebGL) { pre.classList.add('fatto'); html.classList.remove('intro-attiva'); return; }

  const svg = pre.querySelector('.logo-svg');
  D = {
    ctx, html, pre, svg,
    box: pre.querySelector('.logo-intro'),
    petali: svg ? [...svg.querySelectorAll('.petalo')] : [],
    tardivi: svg ? [...svg.querySelectorAll('.foglie, .nastro, .collina')] : [],
    collina: svg?.querySelector('.collina'), scritte: svg?.querySelector('.scritte'),
    contatore: pre.querySelector('.contatore'), gruppo: pre.querySelector('.didascalia .gruppo'),
    salta: pre.querySelector('.salta'),
    linea: creaLineaOro(pre.querySelector('.linea-intro')),
    anims: [], coppie: 0, disegnate: new Set(),
    obiettivo: 0, mostrato: 0, ultimoNumero: -1,
    fase: 'carica', tl: null, saltaRichiesto: false, fineEmessa: false,
    fiume: new Float32Array(INTRO.fiume.punti * 2), nFiume: 0,
    traccia: new Float32Array(4), piena: new Float32Array(4),
    raf: 0, tPrec: 0,
  };

  // ---- modo dell'intro
  let visto = false;
  try { visto = sessionStorage.getItem(INTRO.chiaveSessione) === '1'; } catch { /* storage bloccato */ }
  D.modo = !ctx.flags.intro ? 'assente' : ctx.flags.riduci ? 'riduci' : (visto || ctx.flags.piccolo) ? 'breve' : 'completa';
  if (D.modo !== 'completa' && svg) {
    // niente disegno dei petali: il logo compare intero (in dissolvenza)
    svg.classList.add('ufficiale');
    animaUno(D.box, [{ opacity: 0 }, { opacity: D.modo === 'assente' ? 0.5 : 1 }], { duration: D.modo === 'riduci' ? INTRO.riduci.dissolvenzaMs : 600, easing: 'linear', fill: 'forwards' });
  }
  if (D.modo === 'assente' && ctx.flags.test) pre.style.transition = 'none';

  // ---- avanzamento reale (evento di main.js)
  ctx.eventi.on('progresso', p => {
    D.obiettivo = Math.max(D.obiettivo, clamp(p.totale, 0, 1));
    if (D.gruppo && p.gruppo && D.fase === 'carica') D.gruppo.textContent = p.gruppo;
    if (p.completato && D.modo === 'completa') disegnaCoppia(D.coppie++, INTRO.coppiaPetaliMs);
  });
  ctx.eventi.on('pronto', () => pronto());

  // ---- salto: bottone, rotella, tasto, clic (§5.2)
  D.salta?.addEventListener('click', e => { e.stopPropagation(); salta(); });
  D.suRotella = e => { if (D.fase === 'finita') return; if (e.cancelable) e.preventDefault(); salta(); };
  D.suTasto = e => { if (D.fase === 'finita' || e.repeat) return; if (['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return; salta(); };
  D.suClic = () => { if (D.fase !== 'finita') salta(); };
  D.suTocco = e => { if (D.fase !== 'finita' && e.cancelable) e.preventDefault(); };
  if (D.modo !== 'assente') {
    addEventListener('wheel', D.suRotella, { passive: false });
    addEventListener('keydown', D.suTasto);
    addEventListener('touchmove', D.suTocco, { passive: false });
    pre.addEventListener('pointerdown', D.suClic);
  }
  D.raf = requestAnimationFrame(ciclo);
}

/** Ogni fotogramma del ciclo di main: l'intro ha un suo rAF (il ciclo di main parte solo dopo il caricamento). */
export function aggiorna() {}

// ---------------------------------------------------------------- animazioni (WAAPI, saltabili)
function animaUno(el, kf, opz) {
  if (!el?.animate) { const ultimo = kf[kf.length - 1]; if (el) Object.assign(el.style, ultimo); return null; }
  const a = el.animate(kf, opz); if (LENTO > 1) a.playbackRate = 1 / LENTO; D.anims.push(a); return a;
}
function disegnaCoppia(k, ms) {
  if (k > 5 || D.disegnate.has(k)) return;
  D.disegnate.add(k);
  for (const p of D.petali) if (+p.dataset.coppia === k) animaUno(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, easing: EXPO_OUT, fill: 'forwards' });
}

// ---------------------------------------------------------------- ciclo del preloader
function ciclo(ora) {
  D.raf = 0;
  if (!D || D.fase === 'finita' || D.ctx.noWebGL) { if (D?.ctx.noWebGL) chiudiSubito(); return; }
  const dt = D.tPrec ? Math.min(0.1, (ora - D.tPrec) / 1000) : 1 / 60; D.tPrec = ora;
  // contatore 000 → 100 (levigato, mai all'indietro)
  const meta = D.fase === 'carica' ? D.obiettivo : 1;
  D.mostrato = Math.max(D.mostrato, damp(D.mostrato, meta, D.fase === 'carica' ? 5 : 12, dt));
  if (meta - D.mostrato < 0.002) D.mostrato = meta;
  const n = Math.round(D.mostrato * 100);
  if (n !== D.ultimoNumero && D.contatore) { D.ultimoNumero = n; D.contatore.textContent = String(n).padStart(3, '0'); }
  // linea: durante il caricamento cresce sulla pista centrale; poi la governa la timeline d'uscita
  const W = innerWidth, H = innerHeight, y = LINEA_ORO.sy * H, pista = Math.min(480, 0.72 * W);
  D.traccia[0] = (W - pista) / 2; D.traccia[1] = y; D.traccia[2] = (W - pista) / 2 + pista * Math.max(0.002, D.mostrato); D.traccia[3] = y;
  if (D.fase === 'carica' || D.fase === 'rivela') {
    D.linea.pista((W - pista) / 2, (W + pista) / 2, y, 1);
    D.linea.morphBuffer(D.traccia, 2, D.traccia, 2, 0);
    D.linea.alfa(1); D.linea.punta(1);
  }
  if (D.tl && D.tl.avviata && D.tl.avanza(ora)) { fine(); return; }
  D.raf = requestAnimationFrame(ciclo);
}

// ---------------------------------------------------------------- scena pronta: rivelazione e uscita
function pronto() {
  if (!D || D.fase !== 'carica') return;
  const { ctx } = D;
  D.obiettivo = 1;
  if (D.modo === 'assente') {            // ?test, ?T=, ?nointro: si chiude e basta (main emette 'intro-fine')
    D.pre.classList.add('fatto'); D.fase = 'finita'; liberaEventi(); return;
  }
  if (D.saltaRichiesto) { chiudi(); return; }
  D.fase = 'rivela';
  const tl = D.tl = creaTimeline();
  if (D.modo === 'riduci') {
    // §6.11: pausa 500 ms, uscita in 300 ms, nessun morph
    tl.a(0, () => D.pre.classList.add('uscita'))
      .a(INTRO.riduci.pausaMs, () => { D.html.classList.add('marchio-in'); D.html.classList.remove('intro-attiva'); emettiFine();
        D.pre.style.transition = `opacity ${INTRO.riduci.uscitaMs}ms linear, visibility 0s linear ${INTRO.riduci.uscitaMs}ms`; D.pre.classList.add('fatto'); })
      .a(INTRO.riduci.pausaMs + INTRO.riduci.uscitaMs, () => {});
    tl.avvia(performance.now());
    if (!D.raf) D.raf = requestAnimationFrame(ciclo);
    return;
  }
  // ---- rivelazione del logo (solo versione completa)
  let r = 0;
  if (D.modo === 'completa') {
    for (let k = 0; k < 6; k++) disegnaCoppia(k, 300);                      // contorni mancanti, se ce ne sono
    D.petali.forEach((p, i) => animaUno(p, [{ fillOpacity: 0 }, { fillOpacity: 1 }],
      { duration: INTRO.petaliRiempimentoMs, delay: i * INTRO.petaliSfalsamentoMs, easing: EXPO_OUT, fill: 'forwards' }));
    for (const el of D.tardivi) animaUno(el, [{ opacity: 0 }, { opacity: 1 }], { duration: INTRO.foglieMs, delay: FOGLIE_DA_MS, easing: EXPO_OUT, fill: 'forwards' });
    if (D.scritte) animaUno(D.scritte, [{ opacity: 0, transform: `scale(${INTRO.scritteScala})` }, { opacity: 1, transform: 'scale(1)' }],
      { duration: INTRO.scritteMs, delay: SCRITTE_DA_MS, easing: EXPO_OUT, fill: 'forwards' });
    r = SCRITTE_DA_MS + INTRO.scritteMs;
    tl.a(r, () => D.svg?.classList.add('ufficiale'));                      // tratto ufficiale (5) a disegno completo
    r += INTRO.pausaMs;
  }
  // ---- uscita
  const B = D.modo === 'breve';
  const flip = B ? BREVE.flip : INTRO.flipMs, allunga = B ? BREVE.allunga : INTRO.lineaAllungaMs, morph = B ? BREVE.morph : INTRO.morphMs;
  const fondo = B ? BREVE.fondo : allunga + INTRO.fondoRitardoMs, lineaVia = B ? BREVE.lineaVia : allunga + morph + 400;
  const totale = B ? BREVE.totale : lineaVia + INTRO.lineaSvanisceMs;
  tl.a(r, () => avviaUscita(flip))
    .tra(r, r + allunga, k => allungaLinea(k), 'power2.inOut')
    .tra(r + allunga, r + allunga + morph, k => { if (D.nFiume > 1) D.linea.morphBuffer(D.piena, 2, D.fiume, D.nFiume, k); D.linea.punta(1 - k); }, 'power2.inOut')
    .a(r + flip - INTRO.consegnaMs, () => D.html.classList.add('marchio-in'))
    .a(r + fondo, () => D.pre.classList.add('sfondo-via'))
    .a(r + (B ? BREVE.fine : flip), () => { D.html.classList.remove('intro-attiva'); emettiFine(); })
    .tra(r + lineaVia, r + totale, k => D.linea.alfa(1 - k))
    .a(r + totale, () => {});
  tl.avvia(performance.now());
  if (!D.raf) D.raf = requestAnimationFrame(ciclo);
}

/** Inizio dell'uscita: FLIP del logo nella testata, polilinea del fiume proiettata in K0.0. */
function avviaUscita(flip) {
  D.fase = 'uscita';
  D.pre.classList.add('uscita');
  D.linea.pista(0, 0, 0, 0);
  const W = innerWidth, H = innerHeight;
  D.da0 = D.traccia[0]; D.da1 = D.traccia[2];          // estremi della pista all'inizio dell'uscita
  // linea a tutta larghezza (forma di partenza del morph) e polilinea del fiume proiettata con la camera di T=0
  D.piena[0] = 0; D.piena[1] = LINEA_ORO.sy * H; D.piena[2] = W; D.piena[3] = LINEA_ORO.sy * H;
  D.nFiume = 0;
  const cam = D.ctx.camera;
  if (cam && D.ctx.proietta) {
    const n = INTRO.fiume.punti, [z0, z1] = INTRO.fiume.z, P = {};
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const z = z0 + (z1 - z0) * i / (n - 1);
      D.ctx.proietta([fiumeX(z), 0, z], P);
      D.fiume[2 * i] = P.x; D.fiume[2 * i + 1] = P.y; if (P.davanti) ok++;
    }
    // il fiume corre da nord (z −400) a sud: sullo schermo deve andare da sinistra a destra come la linea
    if (D.fiume[0] > D.fiume[2 * n - 2]) for (let i = 0; i < n / 2; i++) {
      const j = n - 1 - i; let t = D.fiume[2 * i]; D.fiume[2 * i] = D.fiume[2 * j]; D.fiume[2 * j] = t;
      t = D.fiume[2 * i + 1]; D.fiume[2 * i + 1] = D.fiume[2 * j + 1]; D.fiume[2 * j + 1] = t;
    }
    if (ok === n) D.nFiume = n;
  }
  // FLIP: dal centro del preloader al simbolo della testata (viewBox "0 20 812 440")
  const sim = document.querySelector('.testata .marchio .simbolo');
  if (sim && D.box) {
    const a = D.box.getBoundingClientRect(), b = sim.getBoundingClientRect();
    if (a.width > 0 && b.width > 0) {
      const s = b.width / a.width, k = a.width / INTRO.logo.viewBox[0];
      const dx = b.left - a.left, dy = b.top - a.top - s * 20 * k;
      animaUno(D.box, [{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: flip, easing: EXPO_INOUT, fill: 'forwards' });
      // negli ultimi 200 ms il logo in volo passa la mano al simbolo della testata (che compare con html.marchio-in)
      animaUno(D.box, [{ opacity: 1 }, { opacity: 0 }], { duration: INTRO.consegnaMs, delay: flip - INTRO.consegnaMs, easing: 'linear', fill: 'forwards' });
    }
  }
  // scritte e collina non sono nel simbolo della testata: svaniscono durante il volo
  for (const el of [D.scritte, D.collina]) if (el) animaUno(el, [{ opacity: 1 }, { opacity: 0 }], { duration: SCRITTE_VIA_MS, easing: 'linear', fill: 'forwards' });
}

/** La linea passa dalla pista centrale alla larghezza piena (k 0..1). */
function allungaLinea(k) {
  const W = innerWidth, y = LINEA_ORO.sy * innerHeight;
  D.traccia[0] = D.da0 * (1 - k); D.traccia[1] = y;
  D.traccia[2] = D.da1 + (W - D.da1) * k; D.traccia[3] = y;
  D.linea.morphBuffer(D.traccia, 2, D.traccia, 2, 0);
}

function emettiFine() {
  if (D.fineEmessa) return; D.fineEmessa = true;
  D.ctx.introFinita = true; D.ctx.eventi.emit('intro-fine');
}

/** Salto (§5.2): prima di 'pronto' si ricorda la richiesta; dopo, timeline al 100% con dissolvenza di 300 ms. */
function salta() {
  if (!D || D.fase === 'finita') return;
  if (D.fase === 'carica') { D.saltaRichiesto = true; if (D.salta) D.salta.textContent = 'Un istante…'; return; }
  chiudi();
}
function chiudi() {
  for (const a of D.anims) { try { a.finish(); } catch { /* animazione già annullata */ } }
  D.svg?.classList.add('ufficiale');
  D.html.classList.add('marchio-in'); D.html.classList.remove('intro-attiva');
  D.linea.alfa(0);
  D.pre.style.transition = `opacity ${INTRO.saltoMs}ms linear, visibility 0s linear ${INTRO.saltoMs}ms`;
  D.pre.classList.add('uscita', 'fatto');
  emettiFine();
  fine();
}
function chiudiSubito() { D.pre.classList.add('fatto'); D.html.classList.remove('intro-attiva'); D.fase = 'finita'; liberaEventi(); }

function fine() {
  if (D.fase === 'finita') return;
  D.fase = 'finita';
  D.pre.classList.add('fatto');
  D.html.classList.add('marchio-in'); D.html.classList.remove('intro-attiva');
  emettiFine();
  try { sessionStorage.setItem(INTRO.chiaveSessione, '1'); } catch { /* storage bloccato */ }
  liberaEventi();
  if (D.raf) { cancelAnimationFrame(D.raf); D.raf = 0; }
}
function liberaEventi() {
  removeEventListener('wheel', D.suRotella); removeEventListener('keydown', D.suTasto);
  removeEventListener('touchmove', D.suTocco); D.pre.removeEventListener('pointerdown', D.suClic);
}
