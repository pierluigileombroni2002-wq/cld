// =============================================================================
// ERI v2 · ui/servizi.js — sezioni dopo la storia: Chi siamo e Servizi (rivelazioni, righe che si aprono, camera sulla fase)
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.8 (Chi siamo; Servizi in 4 colonne + fascia trasversale; voci che si aprono al
// passaggio del mouse con icona a filo di 1 px; "Comparsa delle sezioni": titoli con il divisore di righe
// expo.out 1,1 s, blocchi opacità 0 → 1 e y 28 → 0 a "top 88%"; riduci movimento: nessuna animazione),
// §4.7 (passaggio del mouse o focus su una colonna → la camera va sul keyframe della fase in 1,2 s; uscita →
// torna alla posa dello scroll), config.SERVIZI_CAMERA.
// Le rivelazioni usano IntersectionObserver con margine inferiore del 12 % (equivale a ScrollTrigger
// "top 88%", ma resta corretto anche quando l'altezza della pagina cambia dopo il caricamento dei font).
// =============================================================================
import { SERVIZI_CAMERA } from '../config.js';
import { dividiRighe } from './testi.js';

export const MONDO = 'ui';

export async function crea(ctx) {
  const html = document.documentElement;

  // ---- camera sulla fase (§4.7): hover e focus da tastiera
  for (const col of document.querySelectorAll('#servizi .fase[data-fase]')) {
    const chiave = col.dataset.fase;
    if (!SERVIZI_CAMERA[chiave]) continue;
    const entra = () => ctx.rig?.forza?.(chiave);
    const esci = () => ctx.rig?.forza?.(null);
    col.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') entra(); });
    col.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') esci(); });
    col.addEventListener('focusin', entra);
    col.addEventListener('focusout', e => { if (!col.contains(e.relatedTarget)) esci(); });
  }

  // ---- rivelazioni (nessuna con riduci movimento)
  const riduci = ctx.flags.riduci || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (riduci || !('IntersectionObserver' in window)) return;
  const titoli = [...document.querySelectorAll('main .sezione [data-righe]')];
  const divisi = titoli.map(el => dividiRighe(el));
  // sfalsamento delle colonne e dei blocchi fratelli (0,08 s)
  document.querySelectorAll('#servizi .fase').forEach((el, i) => { el.style.transitionDelay = (i * 0.08).toFixed(2) + 's'; });
  html.classList.add('rivela-pronto');

  const io = new IntersectionObserver(ee => {
    for (const e of ee) if (e.isIntersecting) { e.target.classList.add('rivelato'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
  for (const el of document.querySelectorAll('main .sezione .rivela, main .sezione [data-righe]')) io.observe(el);

  // righe ricalcolate al resize (debounce 200 ms) e quando arrivano i font
  let timer = 0;
  const ricalcola = () => { clearTimeout(timer); timer = setTimeout(() => divisi.forEach(d => d.ricalcola()), 200); };
  addEventListener('resize', ricalcola);
  document.fonts?.ready?.then(ricalcola);
}

export function aggiorna() {}
