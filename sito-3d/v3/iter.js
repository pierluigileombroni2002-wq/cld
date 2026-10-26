// ERI v3 · barra dell'iter: sempre visibile in basso, cinque passi che si accendono mentre la macchina nasce.
import { PASSI } from './regia.js';

export function creaIter(el) {
  const lista = el.querySelector('ol');
  lista.innerHTML = PASSI.map((s, i) => `<li data-passo="${i}"><i></i><span>${s.nome}</span></li>`).join('') + '<b class="traccia" aria-hidden="true"></b>';
  const voci = [...lista.querySelectorAll('li')];
  const traccia = lista.querySelector('.traccia');
  const etichetta = el.querySelector('.iter-etichetta');
  const didascalia = el.querySelector('.iter-didascalia');
  let prima = { et: null, passo: -1, avanz: -1, did: null, modo: null };
  let timerDid = 0;

  function scriviDidascalia(html) {
    if (html === prima.did) return;
    prima.did = html;
    clearTimeout(timerDid);
    didascalia.classList.add('cambio');
    timerDid = setTimeout(() => { didascalia.innerHTML = html; didascalia.classList.remove('cambio'); }, 220);
  }

  return {
    // modo: 'apertura' | 'momento' | 'fine'; passo: quanti passi raggiunti (0..5); avanz: riempimento 0..1
    aggiorna(modo, nomeMomento, passo, avanz) {
      if (modo !== prima.modo) { el.dataset.modo = modo; prima.modo = modo; }
      // "L'iter" resta sempre scritto: sotto, di quale impianto
      const et = modo === 'apertura' ? '' : modo === 'fine' ? 'Ogni impianto' : nomeMomento;
      if (et !== prima.et) { etichetta.innerHTML = 'L’iter' + (et ? `<em>${et}</em>` : ''); prima.et = et; }
      if (passo !== prima.passo) {
        voci.forEach((v, i) => { v.classList.toggle('fatto', i < passo); v.classList.toggle('ora', modo === 'momento' && i === passo - 1); });
        prima.passo = passo;
      }
      const a = Math.round(avanz * 400) / 400;
      if (a !== prima.avanz) { traccia.style.transform = `scaleX(${a})`; prima.avanz = a; }
      let html;
      if (modo === 'apertura') html = 'Cinque passi, per ogni impianto. <em>Scorri.</em>';
      else if (modo === 'fine') html = 'Tutto l’iter, <b>dal terreno alla gestione.</b>';
      else { const s = PASSI[Math.max(0, passo - 1)]; html = `<b>${s.nome}</b> · ${s.nota}`; }
      scriviDidascalia(html);
    },
  };
}
