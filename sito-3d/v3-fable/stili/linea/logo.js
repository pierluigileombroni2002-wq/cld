// Logo ERI per "Linea di Luce": nell'apertura i petali si compongono nel logo completo con i loro colori veri
// (nessun oro aggiunto, nessun bagliore); poi viaggia in alto a sinistra e resta come marchio della testata.
// Scritte in bianco sul grafite (tornano verde scuro sulla pagina chiara dei contatti, via CSS), ITALIA in rame.
// Il file originale non viene toccato: lo si legge e si ricolora in memoria.

const PETALI = ['p-arancio-sx', 'p-giallo-sx', 'p-lime', 'p-arancio', 'p-rosso', 'p-giallo-dx', 'p-verde'];
const CENTRO = { x: 112, y: 86 }; // il cuore del sole, nelle coordinate del viewBox

export async function creaLogo(contenitore, urlSvg) {
  const testo = await (await fetch(urlSvg)).text();
  const svg = new DOMParser().parseFromString(testo, 'image/svg+xml').documentElement;

  for (const p of svg.querySelectorAll('#scritte path')) {
    if (p.getAttribute('fill') === '#0f3b2c') p.classList.add('scritta');
  }
  const gradItalia = svg.querySelector('#italia');
  if (gradItalia) {
    const stop = gradItalia.querySelectorAll('stop');
    if (stop[0]) stop[0].setAttribute('stop-color', '#d08a62');
    if (stop[1]) stop[1].setAttribute('stop-color', '#c47a52');
  }

  const petali = [];
  PETALI.forEach((id, i) => {
    const el = svg.getElementById(id);
    if (!el) return;
    const inv = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inv.setAttribute('class', 'petalo-inv');
    el.parentNode.insertBefore(inv, el);
    inv.appendChild(el);
    petali.push({ inv, el, i });
  });
  const resto = ['collina', 'stelo', 'foglia', 'scritte'].map((id) => svg.getElementById(id)).filter(Boolean);
  contenitore.appendChild(svg);

  // k: 0 = niente, 1 = logo completo. I petali arrivano uno a uno, in senso orario, e si accendono del loro colore.
  function componi(k) {
    const kk = Math.min(1, Math.max(0, k));
    for (const p of petali) {
      const locale = Math.min(1, Math.max(0, (kk - p.i * 0.05) / 0.55));
      const e = 1 - Math.pow(1 - locale, 3);
      const rot = (1 - e) * 40;
      const sc = 0.2 + 0.8 * e;
      p.inv.setAttribute('transform', `rotate(${rot} ${CENTRO.x} ${CENTRO.y}) translate(${CENTRO.x} ${CENTRO.y}) scale(${sc}) translate(${-CENTRO.x} ${-CENTRO.y})`);
      p.inv.setAttribute('opacity', Math.min(1, locale * 1.6).toFixed(3));
    }
    const kr = Math.min(1, Math.max(0, (kk - 0.5) / 0.45));
    resto.forEach((el, i) => {
      const loc = Math.min(1, Math.max(0, (kr - i * 0.12) / 0.6));
      el.setAttribute('opacity', loc.toFixed(3));
      if (el.id === 'scritte') el.setAttribute('transform', `translate(0 ${(1 - loc) * 8})`);
    });
  }
  componi(0);

  return {
    svg,
    componi,
    // p di scorrimento: fino a 0.07 è grande al centro; da 0.07 a 0.13 viaggia in testata
    posiziona(p, larghezza, altezza) {
      const stretto = larghezza < 820 || altezza > larghezza;
      const grande = stretto ? Math.min(210, larghezza * 0.5, altezza * 0.26) : Math.min(260, larghezza * 0.5, altezza * 0.32);
      const piccolo = stretto ? 74 : 92;
      const v = Math.min(1, Math.max(0, (p - 0.07) / 0.06));
      const e = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
      const w = grande + (piccolo - grande) * e;
      const margine = stretto ? 16 : Math.max(20, larghezza * 0.06);
      const x0 = larghezza / 2 - grande / 2, y0 = altezza * (stretto ? 0.2 : 0.26) - grande * 0.43;
      const x1 = margine, y1 = stretto ? 12 : 18;
      const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
      contenitore.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      contenitore.style.width = `${w.toFixed(1)}px`;
      contenitore.classList.toggle('in-testata', v >= 1);
    },
  };
}
