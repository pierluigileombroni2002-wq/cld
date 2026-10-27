// Logo ERI: nell'apertura è un sole d'oro i cui petali si compongono nel logo completo;
// poi viaggia in alto a sinistra e resta come marchio della testata.
// Il file originale non viene toccato: lo si legge e si ricolora in memoria per il fondo scuro.

const PETALI = ['p-arancio-sx', 'p-giallo-sx', 'p-lime', 'p-arancio', 'p-rosso', 'p-giallo-dx', 'p-verde'];
const CENTRO = { x: 112, y: 86 }; // il cuore del sole, nelle coordinate del viewBox

export async function creaLogo(contenitore, urlSvg) {
  const testo = await (await fetch(urlSvg)).text();
  const svg = new DOMParser().parseFromString(testo, 'image/svg+xml').documentElement;

  // scritte chiare sul fondo scuro; "ITALIA" resta rame ma più luminoso
  for (const p of svg.querySelectorAll('#scritte path')) {
    if (p.getAttribute('fill') === '#0f3b2c') p.setAttribute('fill', '#fbf3e6');
  }
  const gradItalia = svg.querySelector('#italia');
  if (gradItalia) {
    const stop = gradItalia.querySelectorAll('stop');
    if (stop[0]) stop[0].setAttribute('stop-color', '#e8a070');
    if (stop[1]) stop[1].setAttribute('stop-color', '#d07a50');
  }

  // ogni petalo: un involucro che lo muove, più una copia d'oro sopra che sfuma via
  const petali = [];
  PETALI.forEach((id, i) => {
    const el = svg.getElementById(id);
    if (!el) return;
    const inv = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inv.setAttribute('class', 'petalo-inv');
    el.parentNode.insertBefore(inv, el);
    inv.appendChild(el);
    const oro = el.cloneNode(true);
    oro.removeAttribute('id');
    oro.setAttribute('class', 'oro');
    for (const p of oro.querySelectorAll('path')) { p.removeAttribute('fill'); p.removeAttribute('stroke'); }
    inv.appendChild(oro);
    // bbox del petalo per ruotarlo attorno al cuore del sole
    petali.push({ inv, oro, i, angolo: angoloDa(el) });
  });

  const resto = ['collina', 'stelo', 'foglia', 'scritte'].map((id) => svg.getElementById(id)).filter(Boolean);
  const bagliore = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bagliore.setAttribute('cx', CENTRO.x); bagliore.setAttribute('cy', CENTRO.y); bagliore.setAttribute('r', 70);
  bagliore.setAttribute('fill', 'url(#bagliore-oro)');
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML('beforeend', `<radialGradient id="bagliore-oro"><stop offset="0" stop-color="#ffe3a6" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffcf7a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>`);
  svg.insertBefore(bagliore, svg.firstElementChild.nextSibling);

  contenitore.appendChild(svg);

  function angoloDa(el) {
    // angolo del petalo rispetto al cuore del sole, dalla sua bbox
    const b = el.getBBox ? el.getBBox() : null;
    if (!b) return 0;
    return Math.atan2(b.y + b.height / 2 - CENTRO.y, b.x + b.width / 2 - CENTRO.x);
  }

  // k: 0 = sole d'oro appena nato, 1 = logo completo
  function componi(k) {
    const kk = Math.min(1, Math.max(0, k));
    for (const p of petali) {
      const locale = Math.min(1, Math.max(0, (kk - p.i * 0.045) / 0.6));
      const e = 1 - Math.pow(1 - locale, 3);
      const rot = (1 - e) * 55;                   // arrivano ruotando attorno al sole
      const sc = 0.15 + 0.85 * e;
      p.inv.setAttribute('transform', `rotate(${rot} ${CENTRO.x} ${CENTRO.y}) translate(${CENTRO.x} ${CENTRO.y}) scale(${sc}) translate(${-CENTRO.x} ${-CENTRO.y})`);
      const colore = Math.min(1, Math.max(0, (kk - 0.45 - p.i * 0.04) / 0.35));
      p.oro.setAttribute('opacity', (1 - colore).toFixed(3));
    }
    const kr = Math.min(1, Math.max(0, (kk - 0.55) / 0.4));
    resto.forEach((el, i) => {
      const loc = Math.min(1, Math.max(0, (kr - i * 0.12) / 0.6));
      el.setAttribute('opacity', loc.toFixed(3));
      if (el.id === 'scritte') el.setAttribute('transform', `translate(0 ${(1 - loc) * 10})`);
    });
    bagliore.setAttribute('opacity', (1 - Math.min(1, kk / 0.8)).toFixed(3));
    bagliore.setAttribute('r', (40 + kk * 60).toFixed(1));
  }

  componi(0);

  return {
    svg,
    componi,
    // p di scorrimento: fino a 0.07 è grande al centro; da 0.07 a 0.13 viaggia in testata
    posiziona(p, larghezza, altezza) {
      const stretto = larghezza < 820 || altezza > larghezza;
      const grande = stretto ? Math.min(230, larghezza * 0.56, altezza * 0.3) : Math.min(300, larghezza * 0.62, altezza * 0.36);
      const piccolo = stretto ? 78 : 96;
      const v = Math.min(1, Math.max(0, (p - 0.07) / 0.06));
      const e = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
      const w = grande + (piccolo - grande) * e;
      const margine = stretto ? 20 : Math.min(72, Math.max(20, larghezza * 0.05));
      const x0 = larghezza / 2 - grande / 2, y0 = altezza * (stretto ? 0.25 : 0.3) - grande * 0.43;
      const x1 = margine, y1 = stretto ? 12 : 14;
      const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
      contenitore.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      contenitore.style.width = `${w.toFixed(1)}px`;
      contenitore.classList.toggle('in-testata', v >= 1);
    },
  };
}
