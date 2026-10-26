// ERI v3 · interfaccia: testi cinetici dei momenti, logo che sale nella testata, etichette delle turbine,
// filo d'energia sullo schermo (dal logo alla linea, dal faro al pulsante), modulo contatti, navigazione.
import { MOMENTI, liscio } from './regia.js';

export function creaInterfaccia({ alNavigare }) {
  const corpo = document.body;
  const testiEroe = document.querySelector('.eroe-testi');
  const ctaEroe = testiEroe.querySelector('.cta');
  const logoG = document.getElementById('logo-grande'), marchio = document.querySelector('.marchio');
  const logoP = document.getElementById('logo-piccolo');
  const pannelli = [...document.querySelectorAll('.pannello')].map(el => ({ el, fin: MOMENTI[el.dataset.momento].testo, on: false }));
  const contatti = document.querySelector('.contatti');
  const finContatti = MOMENTI.contatti.testo;
  const invia = contatti.querySelector('.invia');
  const gioielli = [...document.querySelectorAll('.gioiello')].map(el => ({ el, a: -1, x: -1, y: -1 }));
  const velo = document.querySelector('.velo');
  const filo = document.getElementById('filo');
  const tratti = [...filo.querySelectorAll('.filo-tratto')];
  const punta = filo.querySelector('.filo-punta');
  const stato = { contatti: false, eroeA: -1, logoK: -1, filoA: -1, acceso: false };

  // misure (logo grande senza trasformazione, logo della testata)
  let rG = null, rP = null;
  function misura() {
    const tr = logoG.style.transform; logoG.style.transform = 'none';
    rG = logoG.getBoundingClientRect(); logoG.style.transform = tr;
    rP = logoP.getBoundingClientRect();
  }
  misura();

  // navigazione: link e pulsanti con data-vai
  document.querySelectorAll('[data-vai]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); alNavigare(el.dataset.vai); }));
  // tastiera: entrare nel modulo con Tab porta ai contatti
  contatti.addEventListener('focusin', () => { if (!stato.contatti) alNavigare('contatti'); });

  // modulo: invio finto con conferma
  const form = contatti.querySelector('form'), grazie = contatti.querySelector('.grazie');
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const nome = (form.elements.nome.value || '').trim().split(/\s+/)[0];
    grazie.querySelector('.chi').textContent = nome ? `Grazie, ${nome}.` : 'Grazie.';
    contatti.classList.add('inviato');
    grazie.querySelector('button').focus({ preventScroll: true });
  });
  grazie.querySelector('button').addEventListener('click', () => { form.reset(); contatti.classList.remove('inviato'); form.elements.nome.focus({ preventScroll: true }); });

  // punto del sole del logo grande sullo schermo, mentre il logo sale nella testata (k 0..1)
  const puntoSole = { x: 0, y: 0 };
  function calcolaSole(k, SOLE, VB) {
    if (!rG) return puntoSole;
    const cx = rG.left + rG.width / 2, cy = rG.top + rG.height / 2;
    const px = rG.left + (SOLE.x / VB.w) * rG.width, py = rG.top + (SOLE.y / VB.h) * rG.height;
    const s = 1 + ((rP.width / rG.width) - 1) * k;
    const dx = (rP.left + rP.width / 2 - cx) * k, dy = (rP.top + rP.height / 2 - cy) * k;
    puntoSole.x = cx + dx + (px - cx) * s; puntoSole.y = cy + dy + (py - cy) * s;
    return puntoSole;
  }

  let lungFilo = 1;
  return {
    misura, calcolaSole,
    velo(on) { velo.classList.toggle('su', on); },
    get rettangoloInvia() { return invia.getBoundingClientRect(); },
    get rettangoloContatti() { return contatti.getBoundingClientRect(); },
    get contattiAttivi() { return stato.contatti; },

    // apertura: testi che se ne vanno, logo che sale nella testata
    eroe(p) {
      const a = 1 - liscio(0.006, 0.03, p);
      if (Math.abs(a - stato.eroeA) > 0.002) {
        testiEroe.style.opacity = a.toFixed(3);
        testiEroe.style.transform = `translateY(${(-26 * (1 - a)).toFixed(1)}px)`;
        ctaEroe.tabIndex = a > 0.5 ? 0 : -1;
        testiEroe.style.pointerEvents = a > 0.5 ? '' : 'none';
        stato.eroeA = a;
      }
      const k = liscio(0.068, 0.112, p);
      if (Math.abs(k - stato.logoK) > 0.001 && rG && rP) {
        const cx = rG.left + rG.width / 2, cy = rG.top + rG.height / 2;
        const s = 1 + ((rP.width / rG.width) - 1) * k;
        logoG.style.transform = k <= 0 ? 'none' : `translate(${((rP.left + rP.width / 2 - cx) * k).toFixed(1)}px, ${((rP.top + rP.height / 2 - cy) * k).toFixed(1)}px) scale(${s.toFixed(4)})`;
        const passaggio = liscio(0.82, 1, k);
        logoG.style.opacity = (1 - passaggio).toFixed(3);
        marchio.style.opacity = passaggio.toFixed(3);
        marchio.style.pointerEvents = passaggio > 0.5 ? '' : 'none';
        stato.logoK = k;
      }
      return k;
    },

    // pannelli dei momenti: entrano ed escono con le loro transizioni CSS
    pannelli(p) {
      for (const pa of pannelli) {
        const on = p >= pa.fin[0] && p <= pa.fin[1];
        if (on !== pa.on) { pa.on = on; pa.el.classList.toggle('attivo', on); pa.el.setAttribute('aria-hidden', on ? 'false' : 'true'); }
      }
      const c = p >= finContatti[0];
      if (c !== stato.contatti) { stato.contatti = c; contatti.classList.toggle('attivo', c); corpo.classList.toggle('finale', c); }
    },

    // etichette delle turbine (posizione in pixel, trasparenza, 'sotto' al piedistallo o 'accanto' alla turbina)
    gioiello(i, x, y, a, modo) {
      const g = gioielli[i]; if (!g) return;
      if (modo && modo !== g.modo) { g.el.classList.toggle('sotto', modo === 'sotto'); g.modo = modo; }
      if (Math.abs(a - g.a) > 0.004) { g.el.style.opacity = a.toFixed(3); g.el.style.visibility = a > 0.004 ? 'visible' : 'hidden'; g.a = a; }
      if (a > 0.004 && (Math.abs(x - g.x) > 0.3 || Math.abs(y - g.y) > 0.3)) { g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; g.x = x; g.y = y; }
    },

    // filo d'oro sullo schermo da A a B; verticale ('v') o orizzontale ('h')
    filo(ax, ay, bx, by, prog, alfa, modo) {
      if (alfa <= 0.002 || prog <= 0.002) { if (stato.filoA !== 0) { filo.style.opacity = '0'; stato.filoA = 0; } return; }
      filo.style.opacity = alfa.toFixed(3); stato.filoA = alfa;
      const d = modo === 'v'
        ? `M${ax.toFixed(1)} ${ay.toFixed(1)} C${ax.toFixed(1)} ${(ay + (by - ay) * 0.55).toFixed(1)} ${bx.toFixed(1)} ${(by - (by - ay) * 0.35).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`
        : `M${ax.toFixed(1)} ${ay.toFixed(1)} C${(ax + (bx - ax) * 0.45).toFixed(1)} ${ay.toFixed(1)} ${(bx - (bx - ax) * 0.45).toFixed(1)} ${by.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
      for (const t of tratti) { t.setAttribute('d', d); t.style.strokeDasharray = `${prog.toFixed(4)} 2`; }
      if (prog < 0.999) {
        lungFilo = tratti[0].getTotalLength();
        const q = tratti[0].getPointAtLength(lungFilo * prog);
        punta.setAttribute('cx', q.x.toFixed(1)); punta.setAttribute('cy', q.y.toFixed(1)); punta.style.opacity = '1';
      } else punta.style.opacity = '0';
    },
    accendiInvia(on) { if (on !== stato.acceso) { stato.acceso = on; invia.classList.toggle('acceso', on); } },
  };
}
