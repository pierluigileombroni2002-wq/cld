// =============================================================================
// ERI v2 · ui/contatti.js — sezione Contatti e modulo di prova (nessun invio)
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.8 "Contatti" (recapiti di esempio; selettore del profilo a chip role="radiogroup":
// Investitore · IPP · Proprietario terriero · Altro; campi comuni; Proprietario terriero apre Comune, Foglio e
// particelle, Superficie; Investitore/IPP apre Tecnologia, Taglia indicativa, Fase di interesse; privacy;
// bottone magnetico "Invia richiesta"; all'invio preventDefault e messaggio in role="status"), config.CONTATTI.
// I campi dei gruppi chiusi sono disabilitati (non entrano nel modulo e non ricevono il focus).
// =============================================================================
import { CONTATTI } from '../config.js';
import { rendiMagnetico } from './cursore.js';

export const MONDO = 'ui';

const CHIUSURA_MS = CONTATTI.chiusuraMs;     // rete di sicurezza se transitionend non arriva

export async function crea(ctx) {
  // collegamenti segnaposto (informativa, privacy, cookie): non portano da nessuna parte, per ora
  for (const a of document.querySelectorAll('a[data-segnaposto]')) a.addEventListener('click', e => e.preventDefault());

  const f = document.querySelector('#contatti form');
  if (!f) return;
  const stato = f.querySelector('[role="status"]');
  const gruppi = [...f.querySelectorAll('.condizionale[data-per]')].map(el => ({ el, per: el.dataset.per.split(/\s+/), timer: 0 }));
  const abilita = (g, si) => { for (const c of g.el.querySelectorAll('input, select, textarea')) c.disabled = !si; };
  gruppi.forEach(g => abilita(g, false));

  const apri = g => {
    clearTimeout(g.timer);
    if (g.el.hidden) { g.el.hidden = false; void g.el.offsetHeight; }       // riflusso: la transizione parte da 0fr
    g.el.classList.add('aperto'); abilita(g, true);
  };
  const chiudi = g => {
    if (g.el.hidden) return;
    g.el.classList.remove('aperto'); abilita(g, false);
    const fine = () => { if (!g.el.classList.contains('aperto')) g.el.hidden = true; };
    g.el.addEventListener('transitionend', function una(e) { if (e.target === g.el && e.propertyName === 'grid-template-rows') { g.el.removeEventListener('transitionend', una); fine(); } });
    g.timer = setTimeout(fine, CHIUSURA_MS);
  };
  const profilo = () => {
    const v = f.querySelector('input[name="profilo"]:checked')?.value || '';
    for (const g of gruppi) (g.per.includes(v) ? apri : chiudi)(g);
  };
  f.addEventListener('change', e => { if (e.target.name === 'profilo') profilo(); });
  profilo();

  // invio di prova: mai ricaricare la pagina
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (stato) { stato.textContent = ''; requestAnimationFrame(() => { stato.textContent = CONTATTI.messaggioInvio; }); }
  });
  const invia = f.querySelector('button[type="submit"]');
  if (invia) rendiMagnetico(invia);
}

export function aggiorna() {}
