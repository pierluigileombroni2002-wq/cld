// Logo ERI nell'Alba di Vetro: i petali si compongono nel logo completo, nei colori originali.
// Su fondo chiaro non si ricolora nulla: il file originale si legge così com'è (copia di galleria/logo.js, cambia solo la posa).

const PETALI = ['p-arancio-sx', 'p-giallo-sx', 'p-lime', 'p-arancio', 'p-rosso', 'p-giallo-dx', 'p-verde'];
const CENTRO = { x: 112, y: 86 }; // il cuore del sole, nelle coordinate del viewBox

export async function creaLogo(contenitore, urlSvg) {
  const testo = await (await fetch(urlSvg)).text();
  const svg = new DOMParser().parseFromString(testo, 'image/svg+xml').documentElement;

  const petali = [];
  PETALI.forEach((id, i) => {
    const el = svg.getElementById(id);
    if (!el) return;
    const inv = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inv.setAttribute('class', 'petalo-inv');
    el.parentNode.insertBefore(inv, el);
    inv.appendChild(el);
    petali.push({ inv, el, i, angolo: angoloDa(el) });
  });

  const resto = ['collina', 'stelo', 'foglia', 'scritte'].map((id) => svg.getElementById(id)).filter(Boolean);

  contenitore.appendChild(svg);

  function angoloDa(el) {
    const b = el.getBBox ? el.getBBox() : null;
    if (!b) return 0;
    return Math.atan2(b.y + b.height / 2 - CENTRO.y, b.x + b.width / 2 - CENTRO.x);
  }

  // k: 0 = i petali sono ancora da posare, 1 = logo completo
  function componi(k) {
    const kk = Math.min(1, Math.max(0, k));
    for (const p of petali) {
      const locale = Math.min(1, Math.max(0, (kk - p.i * 0.045) / 0.6));
      const e = 1 - Math.pow(1 - locale, 3);
      const rot = (1 - e) * 40;
      const sc = 0.2 + 0.8 * e;
      p.inv.setAttribute('transform', `rotate(${rot} ${CENTRO.x} ${CENTRO.y}) translate(${CENTRO.x} ${CENTRO.y}) scale(${sc}) translate(${-CENTRO.x} ${-CENTRO.y})`);
      p.inv.setAttribute('opacity', Math.min(1, locale * 2.5).toFixed(3));
    }
    const kr = Math.min(1, Math.max(0, (kk - 0.55) / 0.4));
    resto.forEach((el, i) => {
      const loc = Math.min(1, Math.max(0, (kr - i * 0.12) / 0.6));
      el.setAttribute('opacity', loc.toFixed(3));
      if (el.id === 'scritte') el.setAttribute('transform', `translate(0 ${(1 - loc) * 10})`);
    });
  }

  componi(0);

  return {
    svg,
    componi,
    // Alba di Vetro: nell'apertura il logo sta grande in alto al centro, sopra il titolo; da p 0.07 a 0.13 viaggia in testata (in alto a sinistra).
    posiziona(p, larghezza, altezza) {
      const stretto = larghezza < 760 || altezza > larghezza;
      const grande = stretto ? Math.min(200, larghezza * 0.5, altezza * 0.22) : Math.min(300, larghezza * 0.2, altezza * 0.3);
      const piccolo = stretto ? 72 : 92;
      const v = Math.min(1, Math.max(0, (p - 0.07) / 0.06));
      const e = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
      const w = grande + (piccolo - grande) * e;
      const margine = stretto ? 20 : Math.min(96, Math.max(20, larghezza * 0.06));
      const x0 = larghezza / 2 - grande / 2;
      const y0 = stretto ? 68 : altezza * 0.075;
      const x1 = margine, y1 = stretto ? 12 : 18;
      const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
      contenitore.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      contenitore.style.width = `${w.toFixed(1)}px`;
      contenitore.classList.toggle('in-testata', v >= 1);
    },
  };
}
