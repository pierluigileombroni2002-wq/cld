// Riempie la pagina con i testi di contenuti.js: tutte le scritte si cambiano solo lì.
// (index.html contiene solo la struttura: titoli, cartellini, iter, servizi, modulo e recapiti vuoti.)
import { CONTENUTI as C } from './contenuti.js';

const NOMI = ['apertura', 'fotovoltaico', 'bess', 'idroelettrico', 'servizi', 'contatti'];

// un testo o una lista di righe, con un a capo tra una riga e l'altra
function righe(el, v) {
  el.textContent = '';
  (Array.isArray(v) ? v : [v]).forEach((r, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(r));
  });
}
function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

export function riempiPagina() {
  document.title = C.pagina.titolo;
  document.querySelector('meta[name="description"]')?.setAttribute('content', C.pagina.descrizione);
  for (const a of document.querySelectorAll('.nav [data-va]')) a.textContent = C.menu[a.dataset.va] ?? '';

  // apertura
  const ap = document.querySelector('.momento-apertura');
  righe(ap.querySelector('.titolo-grande'), C.apertura.titolo);
  ap.querySelector('.sotto').textContent = C.apertura.testo;
  ap.querySelector('.bottone').textContent = C.apertura.bottone;
  ap.querySelector('.invito').textContent = C.apertura.invito;

  // i titoli grandi dei momenti dopo l'apertura
  for (const h of document.querySelectorAll('#titoli .titolo-grande')) righe(h, C[NOMI[+h.dataset.m]].titolo);

  // le tre macchine: cartellino, colonna dell'iter, barra (telefono)
  for (const s of document.querySelectorAll('.momento-tech')) {
    const t = C[NOMI[+s.dataset.m]];
    s.querySelector('.cartellino .mono').textContent = t.etichetta;
    righe(s.querySelector('.cartellino p'), t.testo);
    const iter = s.querySelector('.iter');
    iter.textContent = '';
    C.fasi.forEach((f, i) => {
      const li = crea('li');
      li.append(crea('span', 'n', String(i + 1).padStart(2, '0')), crea('span', 'w', f.nome), crea('span', 'd', f.descrizione));
      iter.appendChild(li);
    });
    const barra = s.querySelector('.barra');
    barra.textContent = '';
    C.fasi.forEach(() => barra.appendChild(crea('i')));
    barra.appendChild(crea('span', 'barra-testo'));
  }

  // le targhette sotto le turbine
  const etichette = document.querySelector('.etichette');
  if (etichette) {
    etichette.textContent = '';
    for (const [nome, [tipo, salto]] of Object.entries(C.idroelettrico.turbine)) {
      const d = crea('div', 'etichetta');
      d.dataset.turbina = nome;
      d.append(crea('i'), crea('b', '', tipo), document.createTextNode(' · ' + salto));
      etichette.appendChild(d);
    }
  }

  // servizi
  const sv = document.querySelector('.momento-servizi');
  sv.querySelector('.mono').textContent = C.servizi.etichetta;
  sv.querySelector('.sotto').textContent = C.servizi.testo;
  const elenco = sv.querySelector('.elenco-servizi');
  elenco.textContent = '';
  C.servizi.elenco.forEach((voce, i) => {
    const li = crea('li');
    li.append(crea('span', 'n', String(i + 1).padStart(2, '0')), crea('span', 'v', voce));
    elenco.appendChild(li);
  });

  // contatti
  const ct = document.querySelector('.momento-contatti'), m = C.contatti.modulo;
  ct.querySelector('.mono').textContent = C.contatti.etichetta;
  ct.querySelector('.sotto').textContent = C.contatti.testo;
  for (const s of ct.querySelectorAll('[data-campo]')) s.textContent = m[s.dataset.campo] ?? '';
  ct.querySelector('.modulo [type="submit"]').textContent = m.invia;
  ct.querySelector('.riga-invio small').textContent = m.nota;
  ct.querySelector('.conferma').textContent = m.conferma;
  const recapiti = ct.querySelector('.recapiti');
  recapiti.textContent = '';
  C.contatti.recapiti.forEach((r, i) => {
    if (i) recapiti.appendChild(crea('span', '', '·'));
    const voce = crea(r.link ? 'a' : 'span', '', r.testo);
    if (r.link) voce.href = r.link;
    recapiti.appendChild(voce);
  });
}

// i nomi delle fasi, per la barra e per il nome della fase sotto la macchina
export const FASI = C.fasi;
