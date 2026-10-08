// =============================================================================
// ERI v2 · ui/indice.js — testata (logo, navigazione, CTA) e indice delle tappe
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.3 (testata fissa; simbolo del logo ritagliato viewBox "0 20 812 440" + ERI in Bodoni;
// Metodo · Servizi · Chi siamo · bottone; sotto 900 px solo il bottone; sfondo a gradiente dopo 100 px),
// §5.4 (indice: 7 voci, linea 18 → 36 px che si riempie d'oro con il progresso della tappa, voce attiva in oro
// chiaro; clic → lenis.scrollTo(inizio tappa) in 2,2 s con 1 − (1 − t)^4; "Salta ai servizi ↓"; nascosto
// sotto 900 px e durante le sezioni HTML), §6.12 (senza WebGL: collegamenti alle battute in pagina),
// config.TAPPE, config.INDICE.
// Lo STATO dell'indice (.attiva, aria-current, --avanzamento) lo scrive regia/scroll.js; qui solo i clic,
// la testata e la visibilità.
// =============================================================================
import { INDICE } from '../config.js';
import { clamp } from '../geo.js';

export const MONDO = 'ui';

const easingIndice = t => 1 - Math.pow(1 - t, 4);     // §5.4
const SOGLIA_TESTATA = 100;                            // px di scroll prima dello sfondo della testata (§5.3)
let I = null;

export async function crea(ctx) {
  const testata = document.querySelector('.testata'), indice = document.querySelector('.indice');
  I = { ctx, testata, indice, fuori: null };

  /** Scorre fino a un elemento (o a y) con Lenis se c'è, altrimenti con lo scroll nativo. */
  const vaiA = (bersaglio, focus) => {
    const lenis = ctx.scroll?.lenis;
    const riduci = ctx.flags.riduci || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const y = typeof bersaglio === 'number' ? bersaglio : bersaglio.getBoundingClientRect().top + scrollY;
    if (lenis) lenis.scrollTo(y, { duration: INDICE.durata, easing: easingIndice, force: true });
    else scrollTo({ top: y, behavior: riduci ? 'instant' : 'smooth' });
    // accessibilità: il focus segue la sezione raggiunta (senza un secondo scroll)
    if (focus && focus.focus) { if (!focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1'); setTimeout(() => focus.focus({ preventScroll: true }), riduci ? 0 : INDICE.durata * 1000); }
  };

  // ---- collegamenti interni (testata, battuta 6, indice, piede): [data-vai]
  for (const a of document.querySelectorAll('a[data-vai]')) {
    a.addEventListener('click', e => {
      const id = a.dataset.vai, el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (id === 'storia') vaiA(ctx.noWebGL ? 0 : (ctx.scroll?.inizio ?? 0), null);
      else vaiA(el, el.querySelector('h2') || el);
    });
  }

  // ---- indice delle tappe
  for (const a of document.querySelectorAll('.indice a[data-tappa]')) {
    a.addEventListener('click', e => {
      e.preventDefault();
      const i = +a.dataset.tappa;
      if (!ctx.noWebGL && ctx.scroll?.vaiTappa) ctx.scroll.vaiTappa(i);
      else { const b = document.querySelector(`.battuta[data-tappa="${i}"]`); if (b) vaiA(b, b.querySelector('h1, h2')); }
    });
  }

  // ---- testata: sfondo a gradiente dopo 100 px; senza WebGL anche l'indice segue lo scroll nativo
  let rqa = 0;
  const suScroll = () => {
    if (rqa) return;
    rqa = requestAnimationFrame(() => {
      rqa = 0;
      testata?.classList.toggle('scorsa', scrollY > SOGLIA_TESTATA);
      if (ctx.noWebGL) {
        const chi = document.getElementById('chi-siamo');
        const fuori = chi ? chi.getBoundingClientRect().top < innerHeight * 0.7 : false;
        indice?.classList.toggle('fuori', fuori);
      }
    });
  };
  addEventListener('scroll', suScroll, { passive: true });
  suScroll();

  // ---- senza WebGL: voce attiva = tappa della battuta al centro dello schermo
  if (ctx.noWebGL && 'IntersectionObserver' in window) {
    const voci = [...document.querySelectorAll('.indice a[data-tappa]')];
    const io = new IntersectionObserver(ee => {
      for (const e of ee) if (e.isIntersecting) {
        const t = e.target.dataset.tappa;
        for (const v of voci) { const si = v.dataset.tappa === t; v.classList.toggle('attiva', si); if (si) v.setAttribute('aria-current', 'step'); else v.removeAttribute('aria-current'); }
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    for (const b of document.querySelectorAll('.battuta[data-tappa]')) io.observe(b);
  }
}

export function aggiorna(ctx) {
  if (!I || !I.indice || ctx.noWebGL) return;
  // nascosto durante le sezioni HTML (§5.4, §4.7)
  const fuori = !!ctx.scroll?.inSezioni || clamp(ctx.veli?.sezioni || 0, 0, 1) > 0.02;
  if (fuori !== I.fuori) { I.fuori = fuori; I.indice.classList.toggle('fuori', fuori); }
}
