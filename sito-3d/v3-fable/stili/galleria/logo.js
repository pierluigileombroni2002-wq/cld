// Logo ERI nella Galleria Bianca: i petali si compongono nel logo completo, nei colori originali.
// Su fondo avorio non si ricolora nulla: il file originale si legge così com'è.

const PETALI = ['p-arancio-sx', 'p-giallo-sx', 'p-lime', 'p-arancio', 'p-rosso', 'p-giallo-dx', 'p-verde'];
const CENTRO = { x: 112, y: 86 }; // il cuore del sole, nelle coordinate del viewBox

export async function creaLogo(contenitore, urlSvg) {
  const testo = await (await fetch(urlSvg)).text();
  const svg = new DOMParser().parseFromString(testo, 'image/svg+xml').documentElement;

  // ogni petalo: un involucro che lo muove
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
      const rot = (1 - e) * 40;                   // arrivano ruotando piano attorno al sole
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
    // (il logo in testata: largo w, in alto a sinistra in x, y; più piccolo sul telefono e sugli schermi orizzontali bassi)
    // p di scorrimento: fino a 0.07 è grande al centro; da 0.07 a 0.13 viaggia in testata
    // Desktop: composizione da rivista, il logo grande sta a centro-destra, il titolo a sinistra. Telefono: in alto al centro.
    posiziona(p, larghezza, altezza) {
      const t = testata(larghezza);
      const grande = t.stretto ? Math.min(210, larghezza * 0.54, altezza * 0.28) : Math.min(470, larghezza * 0.3, altezza * 0.52);
      const v = Math.min(1, Math.max(0, (p - 0.07) / 0.06));
      const e = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
      const w = grande + (t.w - grande) * e;
      const x0 = t.stretto ? larghezza / 2 - grande / 2 : larghezza * 0.71 - grande / 2;
      const y0 = t.stretto ? altezza * 0.22 - grande * 0.43 : altezza * 0.47 - grande * 0.867 / 2;
      const x = x0 + (t.x - x0) * e, y = y0 + (t.y - y0) * e;
      contenitore.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      contenitore.style.width = `${w.toFixed(1)}px`;
      contenitore.classList.toggle('in-testata', v >= 1);
    },
    // dove sta il logo quando è in testata (px CSS): la regia tiene le macchine lontane anche da lì
    rettangoloTestata(larghezza, altezza) {
      const t = testata(larghezza);
      return { x0: t.x, y0: t.y, x1: t.x + t.w, y1: t.y + t.w * 0.867 };
    },
  };
}

// (le stesse media query di style.css e di main.js: telefono, telefono girato)
function testata(larghezza) {
  const stretto = matchMedia('(orientation: portrait), (max-width: 760px) and (min-height: 481px)').matches;
  const basso = !stretto && matchMedia('(orientation: landscape) and (max-height: 480px)').matches;
  return {
    stretto,
    w: stretto ? 74 : basso ? 56 : 92,
    x: stretto ? 20 : Math.min(96, Math.max(20, larghezza * 0.06)),
    y: stretto ? 12 : basso ? 8 : 16,
  };
}
