// ERI v3 · logo: il sole d'oro si apre e i suoi petali si compongono nel logo ufficiale COMPLETO.
// Il logo non ruota e non si deforma: i petali escono dal sole (traslazione + scala), l'oro sfuma nei colori veri,
// stelo, collina e foglia si disegnano da sinistra, poi le scritte. Su fondo scuro le scritte #0f3b2c diventano avorio
// e "ITALIA" resta rame ma più chiaro e luminoso (il rame scuro dell'originale sul crepuscolo non si legge).
const URL_LOGO = new URL('../logo/ufficiale/logo-eri-originale.svg', import.meta.url);
const NS = 'http://www.w3.org/2000/svg';
const ORDINE = ['p-arancio', 'p-lime', 'p-rosso', 'p-giallo-sx', 'p-giallo-dx', 'p-arancio-sx', 'p-verde']; // dal centro verso i lati
const SOLE = { x: 117, y: 104 };   // dove convergono i raggi dei petali (coordinate del viewBox)
const DURATA = 2900;

const cl = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const fuori4 = x => 1 - Math.pow(1 - cl(x), 4);
const dentroFuori = x => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// rame chiaro di "ITALIA" su fondo scuro: stessa tinta calda dell'originale (#c4642f → #a8472a), più luminosa
const ITALIA_SU_SCURO = ['#f0a06a', '#e3895a'];
const rameChiaro = testo => testo.replace(/(<linearGradient id="italia"[\s\S]*?<\/linearGradient>)/, g => {
  let i = 0; return g.replace(/stop-color="[^"]*"/g, s => (i < 2 ? `stop-color="${ITALIA_SU_SCURO[i++]}"` : s));
});

// testo SVG con id prefissati (due copie nella stessa pagina non devono condividere i gradienti)
function prefissa(testo, pref) {
  return rameChiaro(testo.replace(/<\?xml[^>]*>/, '')).replace(/#0f3b2c/gi, '#fbf3e6')
    .replace(/id="([^"]+)"/g, `id="${pref}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pref}$1)`);
}

export async function creaLogo(grande, piccolo) {
  let testo = '';
  try { testo = await (await fetch(URL_LOGO)).text(); } catch (e) { return { aggiorna() {}, completa() {}, avvia() {}, finito: true }; }
  piccolo.innerHTML = prefissa(testo, 'lp-');
  grande.innerHTML = prefissa(testo, 'lg-');
  const svg = grande.querySelector('svg');
  svg.removeAttribute('role'); svg.setAttribute('aria-hidden', 'true');
  piccolo.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML('beforeend', `
    <linearGradient id="lg-oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset=".45" stop-color="#ffd27a"/><stop offset="1" stop-color="#e3a043"/></linearGradient>
    <radialGradient id="lg-sole"><stop offset="0" stop-color="#fffaf0"/><stop offset=".3" stop-color="#ffe2a0"/><stop offset=".62" stop-color="#ffc35e" stop-opacity=".55"/><stop offset="1" stop-color="#f0a040" stop-opacity="0"/></radialGradient>
    <clipPath id="lg-taglio"><rect x="-2" y="0" width="0" height="202"/></clipPath>`);
  const taglio = defs.querySelector('#lg-taglio rect');

  // sole: disco luminoso dietro ai petali
  const gruppoPetali = svg.querySelector('#lg-p-arancio-sx').parentNode;
  const sole = document.createElementNS(NS, 'circle');
  sole.setAttribute('cx', SOLE.x); sole.setAttribute('cy', SOLE.y); sole.setAttribute('r', 0); sole.setAttribute('fill', 'url(#lg-sole)');
  gruppoPetali.parentNode.insertBefore(sole, gruppoPetali);

  // ogni petalo in un involucro con la sua copia d'oro sopra
  const petali = ORDINE.map((id, i) => {
    const el = svg.querySelector('#lg-' + id);
    const inv = document.createElementNS(NS, 'g'); el.parentNode.insertBefore(inv, el); inv.appendChild(el);
    const oro = el.cloneNode(true); oro.removeAttribute('id');
    (oro.tagName.toLowerCase() === 'path' ? [oro] : [...oro.querySelectorAll('path')]).forEach(p => { p.setAttribute('fill', 'url(#lg-oro)'); p.setAttribute('stroke', 'url(#lg-oro)'); p.removeAttribute('id'); });
    inv.appendChild(oro);
    let bb = { x: SOLE.x, y: SOLE.y, width: 0, height: 0 };
    try { bb = el.getBBox(); } catch (e) {}
    return { inv, oro, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, ritardo: 280 + i * 85 };
  });

  // stelo, collina, foglia: si disegnano da sinistra a destra
  const terra = document.createElementNS(NS, 'g'); terra.setAttribute('clip-path', 'url(#lg-taglio)');
  // (nel file originale gradiente e tracciato hanno lo stesso id: si prendono i tracciati)
  const collina = svg.querySelector('path#lg-collina');
  collina.parentNode.insertBefore(terra, collina);
  for (const id of ['collina', 'stelo', 'foglia']) terra.appendChild(svg.querySelector('path#lg-' + id));
  const scritte = [...svg.querySelectorAll('#lg-scritte > path')];

  let t0 = null, finito = false;
  function disegna(ms) {
    // sole: si accende, pulsa, poi lascia il posto al logo
    const s1 = fuori4(ms / 650), s2 = cl((ms - 1700) / 900);
    sole.setAttribute('r', (34 * s1 * (1 + 0.06 * Math.sin(ms / 140) * (1 - s2))).toFixed(2));
    sole.setAttribute('opacity', (1 - s2).toFixed(3));
    for (const p of petali) {
      const k = fuori4((ms - p.ritardo) / 1050);
      const sc = 0.18 + 0.82 * k, dx = (SOLE.x - p.cx) * (1 - k), dy = (SOLE.y - p.cy) * (1 - k);
      p.inv.setAttribute('transform', k >= 1 ? '' : `translate(${(dx + p.cx * (1 - sc)).toFixed(2)} ${(dy + p.cy * (1 - sc)).toFixed(2)}) scale(${sc.toFixed(4)})`);
      p.inv.setAttribute('opacity', cl((ms - p.ritardo) / 260).toFixed(3));
      p.oro.setAttribute('opacity', (1 - dentroFuori((ms - 1150 - p.ritardo * 0.5) / 800)).toFixed(3));
    }
    taglio.setAttribute('width', (236 * dentroFuori((ms - 1250) / 950)).toFixed(2));
    scritte.forEach((s, i) => {
      const k = fuori4((ms - 1900 - i * 130) / 700);
      s.setAttribute('opacity', k.toFixed(3)); s.setAttribute('transform', k >= 1 ? '' : `translate(0 ${(7 * (1 - k)).toFixed(2)})`);
    });
  }
  disegna(0);

  return {
    get finito() { return finito; },
    avvia(ora) { if (t0 === null) t0 = ora; },
    aggiorna(ora) {
      if (finito || t0 === null) return;
      const ms = ora - t0; disegna(ms);
      if (ms >= DURATA) finito = true;
    },
    completa() { if (!finito) { if (t0 === null) t0 = 0; disegna(DURATA + 1000); finito = true; } },
    rifai(ora) { t0 = ora; finito = false; disegna(0); },
    // centro del sole in coordinate del viewBox (per il filo d'energia)
    SOLE, VB: { w: 233, h: 202 },
  };
}
