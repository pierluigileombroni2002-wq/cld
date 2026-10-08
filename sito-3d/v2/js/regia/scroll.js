// =============================================================================
// ERI v2 · regia/scroll.js — Lenis + ScrollTrigger, tempo di storia T, veli delle sezioni, indice
// Proprietario: [BASE-REGIA].
// Specifica: DESIGN §0 (T = scorrimento dentro #storia diviso l'altezza di uno schermo, levigato da
// Lenis), §6.8 (un solo ciclo gsap.ticker: Lenis → ScrollTrigger → camera → render; Lenis lerp 0,075,
// wheelMultiplier 0,85; niente snap, niente pin), §5.4 (indice: lenis.scrollTo con durata 2,2 e
// easing 1 − (1 − t)^4), §4.7 "Dopo la storia" (veli delle sezioni), §6.11 (riduci: niente Lenis,
// scroll nativo con levigatura "scrub 0,6"), §6.13 (?test=1: niente Lenis, nessuna levigatura).
//
// NOTA ARCHITETTURA (§5, §16): la "timeline principale" NON è una timeline GSAP. Le tabelle degli
// eventi di §4.1–4.7 sono in config.TRACCE e regia/stato.js le valuta come funzioni pure di T a ogni
// fotogramma (stesso risultato di tl.to(STATO_T,{T:19}) con scrub, ma reversibile e saltabile).
// Questo modulo produce soltanto T (e i veli delle sezioni); camera e testi leggono lo stesso T.
//
// Contratto (vincolante): crea(ctx) pubblica ctx.scroll = {
//   T, y, inizio, lunghezza, schermo (px per unità di T), velocita (px/s), inSezioni, lenis,
//   tappa (indice della tappa attiva), avanzamenti (Float32Array: avanzamento 0..1 di ogni tappa),
//   aggiorna(dt) → T, vai(T), scorri(y), vaiTappa(i), ricalcola()
// }
// Scrive ctx.veli.sezioni. Sull'indice (nav.indice a[data-tappa]) scrive solo lo STATO: classe
// .attiva, aria-current="step" e la variabile CSS --avanzamento (0..1). Lo stile è di [BASE-UI].
// =============================================================================
import { T_FINE, STORIA_VH, TAPPE, INDICE, DOPO_STORIA, SCROLL } from '../config.js';
import { clamp, damp } from '../geo.js';
import { tappaDi } from './stato.js';

export const MONDO = 'sistema';

// Valori di DESIGN §6.8 / §6.11 (config.SCROLL)
const LENIS = SCROLL.lenis;
const LAMBDA_RIDUCI = SCROLL.lambdaRiduci;          // levigatura dello scroll nativo con riduci movimento (≈ scrub 0,6 s)
const LAMBDA_VELOCITA = SCROLL.lambdaVelocita;      // media della velocità di scroll (px/s) per il governatore
const SICUREZZA_INTRO_S = SCROLL.sicurezzaIntroS;   // Lenis riparte comunque dopo 'pronto' + 12 s se l'intro non chiude
const easingIndice = t => 1 - Math.pow(1 - t, 4);   // §5.4

/** "top 30%" → 0,30 (frazione dell'altezza della finestra). */
function frazioneFinestra(s, def) { const m = /(\d+(?:\.\d+)?)%/.exec(s || ''); return m ? +m[1] / 100 : def; }

export function crea(ctx) {
  const storia = document.getElementById('storia');
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) { try { gsap.registerPlugin(ST); } catch { /* già registrato */ } }

  // ---- Lenis (§6.8): solo fuori da test e riduci; agganciato al ticker unico di GSAP
  let lenis = null;
  function creaLenis() {
    if (lenis || ctx.flags.test || ctx.flags.riduci || typeof window.Lenis !== 'function') return;
    try {
      lenis = new window.Lenis(LENIS);
      if (ST) lenis.on('scroll', ST.update);
      // con l'intro attiva Lenis resta fermo (anche se nasce durante l'intro, per esempio quando il riduci si spegne)
      if (ctx.flags.intro && !ctx.introFinita) lenis.stop();
    } catch (e) { console.warn('[scroll] Lenis non disponibile, scroll nativo:', e?.message || e); lenis = null; }
    if (ctx.scroll) ctx.scroll.lenis = lenis;
  }
  if (ctx.flags.lenis) creaLenis();
  // un solo ciclo: il ticker di GSAP fa avanzare Lenis PRIMA di disegna (main lo aggiunge dopo)
  if (gsap?.ticker) { gsap.ticker.add(t => { if (lenis) lenis.raf(t * 1000); }); gsap.ticker.lagSmoothing(0); }
  else { const f = t => { if (lenis) lenis.raf(t); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  // §6.11: il riduci movimento cambia a runtime senza ricaricare la pagina
  const distruggiLenis = () => {
    if (!lenis) return;
    const y = lenis.animatedScroll; lenis.destroy(); lenis = null; ctx.scroll.lenis = null;
    window.scrollTo({ top: y, behavior: 'instant' });
  };
  ctx.eventi.on('riduci', on => { if (on) distruggiLenis(); else if (!ctx.noWebGL) creaLenis(); });
  // contesto WebGL perso e non ripristinato: la pagina diventa un documento a scroll nativo
  ctx.eventi.on('senza-webgl', distruggiLenis);

  // ---- geometria della pagina (ricalcolata al resize e quando cambia l'altezza del contenuto)
  const finestra = DOPO_STORIA.finestra || ['top bottom', 'top 30%'];
  const fA = frazioneFinestra(finestra[0], 1), fB = frazioneFinestra(finestra[1], 0.3);
  const sezioni = { chiSiamo: document.getElementById('chi-siamo'), contatti: document.getElementById('contatti') };
  const off = { chiSiamo: Infinity, contatti: Infinity };
  const assoluto = el => el ? el.getBoundingClientRect().top + window.scrollY : Infinity;

  // ---- indice: solo stato (classe, aria-current, --avanzamento)
  const vociIndice = [...document.querySelectorAll('.indice a[data-tappa]')].map(a => ({ a, i: +a.dataset.tappa, attiva: null, av: -1 }));
  const avanzamenti = new Float32Array(TAPPE.length);

  let Tforzato = null, yForzato = NaN;   // salto esatto (vai): vale finché lo scroll non si muove
  let Tliscio = 0;                        // riduci: T levigato

  const S = {
    T: 0, y: 0, inizio: 0, lunghezza: T_FINE * innerHeight, schermo: innerHeight, velocita: 0, inSezioni: false,
    lenis, tappa: 0, avanzamenti,

    /** Ricalcola inizio della storia, altezza di uno schermo e offset delle sezioni. */
    ricalcola() {
      if (ctx.noWebGL) return;                       // senza WebGL la storia è una sequenza di blocchi: niente T
      const schermoPrima = this.schermo, Tprima = this.T;
      this.inizio = assoluto(storia); if (!isFinite(this.inizio)) this.inizio = 0;
      // un "schermo" = altezza di #storia / 20 (2000vh): stabile anche quando la barra del browser mobile cambia innerHeight
      const h = storia ? storia.offsetHeight / (STORIA_VH / 100) : innerHeight;
      this.schermo = h > 1 ? h : innerHeight;
      this.lunghezza = T_FINE * this.schermo;
      off.chiSiamo = assoluto(sezioni.chiSiamo); off.contatti = assoluto(sezioni.contatti);
      // se l'altezza dello schermo cambia (resize desktop) si conserva T, non i pixel
      if (Math.abs(this.schermo - schermoPrima) > 1 && !this.inSezioni && Tprima > 0) this.vai(Tprima);
    },

    /** Chiamata da main all'inizio del fotogramma: restituisce T e scrive ctx.veli.sezioni. */
    aggiorna(dt) {
      const y = lenis ? lenis.animatedScroll : window.scrollY;
      if (dt > 0) this.velocita = damp(this.velocita, Math.abs(y - this.y) / dt, LAMBDA_VELOCITA, dt);
      this.y = y;
      const grezzo = (y - this.inizio) / this.schermo;
      let T = clamp(grezzo, 0, T_FINE);
      if (Tforzato !== null) { if (Math.abs(y - yForzato) < 0.5) T = Tforzato; else Tforzato = null; }
      if (!lenis && ctx.flags.riduci && !ctx.flags.test && Tforzato === null) {
        T = dt > 0 ? damp(Tliscio, T, LAMBDA_RIDUCI, dt) : Tliscio;     // dt = 0 (passi forzati): nessun movimento
        if (Math.abs(T - clamp(grezzo, 0, T_FINE)) < 1e-4) T = clamp(grezzo, 0, T_FINE);
      }
      Tliscio = T;
      this.T = T;
      this.inSezioni = grezzo > T_FINE + 0.02;

      // veli delle sezioni (§4.7): 0 → 0,75 su #chi-siamo, 0,75 → 1 su #contatti (finestra "top bottom" → "top 30%")
      const H = innerHeight, larg = Math.max(1, (fA - fB) * H);
      const p1 = clamp((y + fA * H - off.chiSiamo) / larg, 0, 1);
      const p2 = clamp((y + fA * H - off.contatti) / larg, 0, 1);
      const vChi = DOPO_STORIA.veloChiSiamo;
      ctx.veli.sezioni = p2 > 0 ? vChi + (1 - vChi) * p2 : vChi * p1;

      // tappa attiva e avanzamenti (anche per ui/indice.js e hud.js)
      this.tappa = tappaDi(T);
      for (let i = 0; i < TAPPE.length; i++) avanzamenti[i] = clamp((T - TAPPE[i].T0) / (TAPPE[i].T1 - TAPPE[i].T0), 0, 1);
      for (let j = 0; j < vociIndice.length; j++) {
        const v = vociIndice[j], attiva = v.i === this.tappa && !this.inSezioni, av = avanzamenti[v.i] ?? 0;
        if (attiva !== v.attiva) { v.attiva = attiva; v.a.classList.toggle('attiva', attiva); if (attiva) v.a.setAttribute('aria-current', 'step'); else v.a.removeAttribute('aria-current'); }
        if (Math.abs(av - v.av) > 0.002) { v.av = av; v.a.style.setProperty('--avanzamento', av.toFixed(3)); }
      }
      return T;
    },

    /** Salto IMMEDIATO a T (scroll e T, nessuna levigatura). */
    vai(T) {
      T = clamp(+T || 0, 0, T_FINE);
      this.scorri(this.inizio + T * this.schermo);
      Tforzato = T; yForzato = lenis ? lenis.animatedScroll : window.scrollY;
      this.T = Tliscio = T;
    },

    /** Salto IMMEDIATO a y px. */
    scorri(y) {
      y = Math.max(0, +y || 0);
      if (lenis) {
        lenis.scrollTo(y, { immediate: true, force: true });
        if (Math.abs(lenis.animatedScroll - Math.round(y)) > 0.5) {         // scrollTo ignora il bersaglio uguale: si forza
          lenis.animate.stop(); lenis.animatedScroll = lenis.targetScroll = Math.round(y); lenis.setScroll(lenis.animatedScroll);
        }
      } else window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      Tforzato = null;
      this.y = lenis ? lenis.animatedScroll : window.scrollY;
      Tliscio = clamp((this.y - this.inizio) / this.schermo, 0, T_FINE);
      this.velocita = 0;
    },

    /** Scroll animato all'inizio della tappa i (indice, §5.4). */
    vaiTappa(i) {
      const t = TAPPE[i]; if (!t) return;
      const y = this.inizio + t.T0 * this.schermo;
      if (lenis) lenis.scrollTo(y, { duration: INDICE.durata, easing: easingIndice, force: true });
      else window.scrollTo({ top: y, left: 0, behavior: ctx.flags.riduci ? 'instant' : 'smooth' });
    },
  };
  ctx.scroll = S;
  S.ricalcola();

  // ---- ricalcolo quando cambia il contenuto (font, sezioni costruite da altri moduli)
  let rqa = 0;
  const pianifica = () => { if (rqa) return; rqa = requestAnimationFrame(() => { rqa = 0; S.ricalcola(); }); };
  if (window.ResizeObserver) new ResizeObserver(pianifica).observe(document.body);
  document.fonts?.ready?.then(pianifica);

  // ---- intro: con l'intro attiva Lenis è fermo (la rotella salta l'intro, non scorre la storia)
  //        (lenis si legge al momento: il riduci movimento può averlo distrutto o ricreato nel frattempo)
  if (ctx.flags.intro && !ctx.introFinita) {
    lenis?.stop();
    const riparti = () => { if (lenis?.isStopped) lenis.start(); };
    ctx.eventi.on('intro-fine', riparti);
    ctx.eventi.on('pronto', () => setTimeout(riparti, SICUREZZA_INTRO_S * 1000));
  }
}

export function ridimensiona(ctx) {
  ctx.scroll?.lenis?.resize?.();
  ctx.scroll?.ricalcola();
}

/** Contratto dei moduli: T si legge in main con ctx.scroll.aggiorna(dt) (passo 2 del fotogramma). */
export function aggiorna() {}
