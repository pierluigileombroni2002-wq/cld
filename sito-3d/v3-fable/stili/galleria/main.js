// ERI · Galleria Bianca · le macchine come sculture in una sala bianca, alla luce di una finestra alta.
// Motore e macchine sono quelli di v3-fable; cambiano ambiente, luce, materiali, testi e impaginazione.
import * as THREE from 'three';
import { creaAmbiente } from './ambiente.js';
import { creaMacchine } from './macchine-galleria.js';
import { POSA } from './bess-galleria.js';
import { DIST } from './turbine-galleria.js';
import { creaLogo } from './logo.js';
import { MOMENTI, assemblaggioDi, momentoDeiTesti, macchinaInScena, finaleDi } from './momenti.js';
import { creaRegia, inquadra, campioniMomento } from './regia.js';
import { impronta, misuraZone, rettangoliSchermo, mascheraMacchine, testiDeiMomenti, pixelSotto } from './ingombri.js';
import { rivestiMateriali, rivestiScena, setFaseVetro, setTintaVetro, vetroModulo } from './materiali-galleria.js';
import { creaOmbre, creaDisegno } from './ombre.js';
import { creaCollezione } from './collezione.js';

const param = new URLSearchParams(location.search);
const tela = document.getElementById('scena');
const stato = { p: 0, pMira: 0, tempo: 0, qualita: 'alta', ms: 0, msPeggio: 0, pronto: false, errori: [] };
window.__eri = stato;
window.addEventListener('error', (e) => stato.errori.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => stato.errori.push('promessa: ' + String(e.reason && e.reason.message || e.reason)));

// ---------- qualità: tre livelli, si scende da soli se i fotogrammi sono lenti ----------
const telefono = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && innerWidth < 900);
const LIVELLI = {
  alta:  { dpr: telefono ? 1.25 : 1.5,  dettagli: true,  riflessi: true },
  media: { dpr: telefono ? 1.1 : 1.25,  dettagli: true,  riflessi: false },
  bassa: { dpr: 1.0,                    dettagli: false, riflessi: false },
};
const ORDINE = ['alta', 'media', 'bassa'];
stato.qualita = ORDINE.includes(param.get('q')) ? param.get('q') : (telefono ? 'media' : 'alta');
const qualitaForzata = ORDINE.includes(param.get('q'));

// ---------- renderer: tela trasparente, la parete avorio è il CSS sotto ----------
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;   // i bianchi restano bianchi
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false;

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 3000);
rivestiMateriali();
const ambiente = creaAmbiente(renderer, scena);
const macchine = creaMacchine(scena);
// la collezione del finale: tracker, container e Francis in fila davanti alla vetrata, piccoli e lontani, nella metà sinistra
const collezione = creaCollezione(scena);
collezione.disponi([
  { pos: [169.1, 0, -65.1], rot: 28 },
  { pos: [175.5, 0, -63.9], rot: 24 },
  { pos: [181.9, 0, -62.7], rot: 20 },
]);
rivestiScena(scena);

// ---------- ingombri delle macchine (una volta sola): la regia li tiene lontani dai testi ----------
// Per ogni punto in cui la regia controlla un momento, la macchina com'è lì: montata in parte, con i pezzi ancora in volo.
const impronte = [null, null, null, null, null];
const t0Impronte = performance.now();
for (let i = 1; i <= 4; i++) {
  const campioni = campioniMomento(i), punti = [];
  for (const p of campioni) {
    if (i <= 3) punti.push(impronta(macchine.monta(i, assemblaggioDi(p, MOMENTI[i]), camera)));
    else { collezione.aggiorna(finaleDi(p), 0); punti.push(impronta(collezione.gruppo)); }
  }
  const montata = campioni.map((p) => (i <= 3 ? assemblaggioDi(p, MOMENTI[i]) >= 0.999 : finaleDi(p) >= 0.5));
  impronte[i] = { campioni, punti, montata, buf: new Float32Array(Math.max(0, ...punti.map((q) => q.length)) / 6) };
}
stato.msImpronte = +(performance.now() - t0Impronte).toFixed(1);

// ---------- ombre di contatto dipinte e disegno a terra ----------
const L = 14 * 1.16;
const ombreFv = creaOmbre([
  { x: 0, z: 4.0, w: L + 3, d: 7.5 }, { x: 0, z: 11.0, w: L + 3, d: 7.5 },
  { x: 0, z: -6.0, w: L + 3, d: 8.5, forza: 0.7 }, { x: 0, z: -13.0, w: L + 3, d: 8.5, forza: 0.7 },
]);
macchine.gruppi.fotovoltaico.parent.add(ombreFv.gruppo); ombreFv.gruppo.position.copy(macchine.gruppi.fotovoltaico.position);
const ombreBess = creaOmbre([
  { x: POSA.containerA.x - 0.3, z: POSA.containerA.z, w: 9.0, d: 5.0 }, { x: POSA.containerB.x + 0.3, z: POSA.containerB.z, w: 9.0, d: 5.0 },
  { x: POSA.pcs.x, z: POSA.pcs.z, w: 3.6, d: 2.6 }, { x: POSA.trafo.x, z: POSA.trafo.z, w: 3.6, d: 3.2 },
]);
scena.add(ombreBess.gruppo); ombreBess.gruppo.position.copy(macchine.gruppi.bess.position);
const ombreIdro = creaOmbre([
  { x: -DIST, z: 0, w: 6.8, d: 5.2 }, { x: 0, z: 0, w: 6.8, d: 5.2 }, { x: DIST, z: 0, w: 6.8, d: 5.2 },
]);
scena.add(ombreIdro.gruppo); ombreIdro.gruppo.position.copy(macchine.gruppi.idroelettrico.position);
const xPali = [-L / 2 + 1.2, -L / 6, L / 6, L / 2 - 1.2];
const disegnoFv = creaDisegno([
  { x: 0, z: 4.0, w: L + 0.8, d: 4.8, pali: xPali }, { x: 0, z: 11.0, w: L + 0.8, d: 4.8, pali: xPali },
  { x: 0, z: -6.0, w: L + 0.8, d: 4.8, pali: xPali }, { x: 0, z: -13.0, w: L + 0.8, d: 4.8, pali: xPali },
]);
scena.add(disegnoFv.gruppo); disegnoFv.gruppo.position.copy(macchine.gruppi.fotovoltaico.position);
const disegnoBess = creaDisegno([
  { x: POSA.containerA.x, z: POSA.containerA.z, w: 6.3, d: 2.7 }, { x: POSA.containerB.x, z: POSA.containerB.z, w: 6.3, d: 2.7 },
  { x: POSA.pcs.x, z: POSA.pcs.z, w: 2.3, d: 1.3 }, { x: POSA.trafo.x, z: POSA.trafo.z, w: 2.3, d: 1.7 },
]);
scena.add(disegnoBess.gruppo); disegnoBess.gruppo.position.copy(macchine.gruppi.bess.position);
const disegnoIdro = creaDisegno([{ x: -DIST, z: 0, w: 4.8, d: 3.4 }, { x: 0, z: 0, w: 4.8, d: 3.4 }, { x: DIST, z: 0, w: 4.8, d: 3.4 }]);
scena.add(disegnoIdro.gruppo); disegnoIdro.gruppo.position.copy(macchine.gruppi.idroelettrico.position);
const terra = [
  { i: 1, ombre: ombreFv, disegno: disegnoFv },
  { i: 2, ombre: ombreBess, disegno: disegnoBess },
  { i: 3, ombre: ombreIdro, disegno: disegnoIdro },
];
function aggiornaTerra(p) {
  for (const t of terra) {
    const m = MOMENTI[t.i];
    const fine = MOMENTI[t.i + 1].da - 0.016; // quando la macchina esce di scena
    if (p < m.da - 0.1 || p > fine) { t.ombre.set(0); t.disegno.set(0); continue; }
    const a = assemblaggioDi(p, m);
    const entra = Math.min(1, Math.max(0, (p - (m.da - 0.1)) / 0.04)); // prima del momento il disegno affiora piano
    const sfuma = 1 - Math.min(1, Math.max(0, (p - m.a) / (fine - m.a))); // dopo il momento il disegno svanisce con la macchina
    t.ombre.set(Math.min(1, Math.max(0, (a - 0.25) / 0.5)) * sfuma * entra);
    t.disegno.set((1 - Math.min(1, Math.max(0, (a - 0.2) / 0.5))) * sfuma * entra);
  }
}

// ---------- scorrimento morbido ----------
function leggiScroll() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  stato.pMira = Math.min(1, Math.max(0, scrollY / max));
}
addEventListener('scroll', leggiScroll, { passive: true });
for (const a of document.querySelectorAll('[data-vai]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: parseFloat(a.dataset.vai) * max, behavior: 'smooth' });
  });
}
document.getElementById('logo').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

// modulo contatti: invio finto con conferma
const modulo = document.querySelector('.modulo');
modulo.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!modulo.checkValidity()) { modulo.reportValidity(); return; }
  modulo.querySelector('.riga-invio').hidden = true;
  modulo.querySelector('.conferma').hidden = false;
});

// ---------- regia della camera (regia.js): un percorso che va sempre avanti, e macchine sempre lontane dai testi ----------
// stretto = impaginazione da telefono (testi in alto, macchina sotto): schermi verticali e schermi stretti non troppo bassi.
// Un telefono girato (orizzontale e basso) usa invece l'impaginazione compatta da desktop (vedi style.css).
function stretto() { return innerHeight > innerWidth || (innerWidth <= 760 && innerHeight > 480); }
const regia = creaRegia(camera);
let zone = [[], [], [], [], []];
function posaCamera(p) {
  if (stato.prova) { // posa forzata, solo per le prove di inquadratura (strumenti)
    const q = stato.prova;
    inquadra(camera, new THREE.Vector3(...q.pos), new THREE.Vector3(...q.mira), q.sx ?? 0, q.sy ?? -0.24, q.arretra ?? 1);
    return;
  }
  regia.posa(p, stato.tempo, stretto(), innerWidth, innerHeight);
}
// Le zone dei testi si leggono dalla pagina e la regia sceglie, momento per momento, dove comporre la macchina e quanto
// arretrare la camera. Si rifà a ogni cambio di misura vero, non per la barra del browser del telefono che compare e scompare
// mentre si scorre (cambia l'altezza di poco).
const adattata = { w: 0, h: 0, stretto: null };
function adattaRegia(forza = false) {
  const w = innerWidth, h = innerHeight;
  if (!forza && w === adattata.w && stretto() === adattata.stretto && Math.abs(h - adattata.h) < h * 0.2) return;
  Object.assign(adattata, { w, h, stretto: stretto() });
  zone = misuraZone({ logo: logo ? logo.rettangoloTestata(w, h) : null, margine: stretto() ? 12 : 20 });
  misuraEtichette();
  // su desktop, nei momenti fotovoltaico e BESS, la scena sfuma verso destra (aggiornaMaschera): lì non si compone
  const sfumata = sfumaADestra() ? [{ nome: 'sfumatura', x0: w - 400, y0: 0, x1: w, y1: h }] : [];
  const riservate = [[], sfumata, sfumata, [], []];
  stato.regia = regia.adatta({ stretto: stretto(), zone, riservate, impronte, larghezza: w, altezza: h });
}
let attesaAdatta = 0;
function programmaAdatta() { clearTimeout(attesaAdatta); attesaAdatta = setTimeout(() => adattaRegia(), 150); }

// ---------- testi: titoli, cartellini e iter sopra la tela; le macchine non li toccano mai (regia.js) ----------
const NOMI_FASI = ['Sviluppo', 'Autorizzazioni', 'Ready to Build', 'Costruzione', 'Gestione'];
const DESCR_FASI = ['Terreno, studio e progetto', 'Permessi e connessione alla rete', 'Pronto per il cantiere', 'Cantiere e collaudo', 'Esercizio e manutenzione'];
const titoli = [...document.querySelectorAll('.titolo-grande')];
const sezioni = [...document.querySelectorAll('.momento')];
const iter = sezioni.map((s) => s.querySelector('.iter'));
const barre = sezioni.map((s) => s.querySelector('.barra'));
const faseEl = document.querySelector('.fase');
const vetrata = document.querySelector('.vetrata');
const finestra = document.querySelector('.finestra');
// il titolo entra lettera per lettera
for (const t of titoli) {
  let i = 0;
  const nodi = [...t.childNodes];
  for (const n of nodi) {
    if (n.nodeType !== 3) continue;
    const frag = document.createDocumentFragment();
    for (const ch of n.textContent) {
      const s = document.createElement('span'); s.className = 'l'; s.textContent = ch; s.style.setProperty('--i', i++);
      frag.appendChild(s);
    }
    t.replaceChild(frag, n);
  }
}
let momentoAttivo = -1, faseAttiva = -1;
function aggiornaTesti(p) {
  const idx = momentoDeiTesti(p);
  if (idx !== momentoAttivo) {
    sezioni.forEach((s) => s.classList.toggle('attivo', +s.dataset.m === idx));
    titoli.forEach((t) => t.classList.toggle('attivo', +t.dataset.m === idx));
    document.body.dataset.momento = idx;
    momentoAttivo = idx; faseAttiva = -1;
  }
  if (idx >= 1 && idx <= 3) {
    const a = assemblaggioDi(p, MOMENTI[idx]);
    const passi = Math.min(5, Math.floor(a * 5 + 0.0001) + (a >= 0.999 ? 0 : 1));
    const accesi = a <= 0 ? 0 : passi;
    const sez = sezioni.find((s) => +s.dataset.m === idx);
    if (sez && iter[sezioni.indexOf(sez)]) {
      const li = iter[sezioni.indexOf(sez)].querySelectorAll('li');
      li.forEach((el, i) => { el.classList.toggle('acceso', i < accesi); el.classList.toggle('corrente', i === accesi - 1); });
      const b = barre[sezioni.indexOf(sez)];
      if (b) {
        b.querySelectorAll('i').forEach((el, i) => { el.classList.toggle('acceso', i < accesi); el.classList.toggle('corrente', i === accesi - 1); });
        const k = accesi - 1;
        if (k >= 0 && k !== faseAttiva) b.querySelector('.barra-testo').innerHTML = `<b>0${k + 1}</b> · ${NOMI_FASI[k]} — ${DESCR_FASI[k]}`;
      }
    }
    const k = accesi - 1;
    if (k >= 0 && k !== faseAttiva) {
      faseAttiva = k;
      faseEl.textContent = `0${k + 1} · ${NOMI_FASI[k]}`;
      faseEl.classList.remove('mostra'); void faseEl.offsetWidth; faseEl.classList.add('mostra');
    }
  }
  aggiornaMaschera(p);
  // la finestra gira piano nella sala con lo scorrimento; nel finale la parete diventa vetrata
  finestra.style.transform = `rotate(${28 - p * 10}deg) translateX(${p * 30}vw)`;
  vetrata.style.opacity = (finaleDi(p) * 0.9).toFixed(3);
}

// Su desktop, nei momenti fotovoltaico e BESS, la scena sfuma nella luce della parete a destra (la colonna dell'iter ha la sua
// fascia libera). La maschera entra e esce con p, in modo continuo: niente scatti tra un momento e l'altro.
// Solo dove c'è la colonna dell'iter: non sul telefono e non sugli schermi orizzontali bassi.
function sfumaADestra() { return !stretto() && innerHeight > 480; }
const liscia = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
let mascheraUltima = '';
function aggiornaMaschera(p) {
  const entra = MOMENTI[1].da - 0.04, esce = MOMENTI[2].a;
  const k = sfumaADestra() ? Math.min(liscia((p - entra) / 0.03), 1 - liscia((p - esce) / 0.04)) : 0;
  const chiave = k < 0.005 ? '' : `linear-gradient(90deg, #000 calc(100% - 520px), rgba(0,0,0,${(1 - k).toFixed(2)}) calc(100% - 300px))`;
  if (chiave === mascheraUltima) return;
  mascheraUltima = chiave;
  tela.style.webkitMaskImage = chiave; tela.style.maskImage = chiave;
}

// ---------- etichette delle turbine: targhette di sala appese al bordo anteriore dei basamenti ----------
const etichette = {};
for (const el of document.querySelectorAll('.etichetta')) etichette[el.dataset.turbina] = { el, w: 0, h: 0 };
function misuraEtichette() { for (const e of Object.values(etichette)) { e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; } }
const _proj = new THREE.Vector3();
function etichetteTurbine(p) {
  const m = MOMENTI[3];
  const dentro = p > m.da && p < m.a + 0.02;
  const a = assemblaggioDi(p, m);
  const s = stretto();
  const ancore = macchine.ancoreTurbine().map(({ nome, pos }) => {
    _proj.copy(pos).project(camera);
    return { nome, x: (_proj.x * 0.5 + 0.5) * innerWidth, y: (-_proj.y * 0.5 + 0.5) * innerHeight, z: _proj.z };
  });
  // su desktop le tre targhette stanno su una sola riga, appesa alla piastra più bassa
  const yRiga = Math.max(...ancore.map((q) => q.y)) + 4;
  // da sinistra a destra: una targhetta che finirebbe su un testo, fuori schermo o sopra la precedente resta spenta
  let bordoDestro = -Infinity;
  for (const q of ancore.sort((u, v) => u.x - v.x)) {
    const e = etichette[q.nome]; if (!e) continue;
    const y = s ? q.y + 4 : yRiga;
    const i = q.nome === 'pelton' ? 0 : q.nome === 'francis' ? 1 : 2;
    const visibile = dentro && a > i * 0.3 + 0.3;
    if (!visibile) { e.el.classList.remove('visibile'); continue; }
    const r = { x0: q.x - e.w / 2 - 12, x1: q.x + e.w / 2 + 12, y0: y, y1: y + e.h };
    const libera = q.z < 1 && r.x0 > Math.max(0, bordoDestro) && r.x1 < innerWidth && r.y1 < innerHeight - 8
      && y > innerHeight * (s ? 0.5 : 0.4)
      && !zone[3].some((z) => z.nome !== 'fase' && r.x0 < z.x1 && r.x1 > z.x0 && r.y0 < z.y1 && r.y1 > z.y0);
    e.el.classList.toggle('visibile', libera);
    if (libera) bordoDestro = r.x1;
    e.el.style.transform = `translate(${q.x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, 0)`;
  }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // su desktop il campo ORIZZONTALE è costante (quello approvato a 1600×906, fov verticale 32°): su una finestra più bassa
  // la fila non si allarga fino a finire sotto la colonna dell'iter, su una più alta non si rimpicciolisce
  camera.fov = stretto() ? 50 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) * 1.766 / camera.aspect)), 26, 40);
  camera.updateProjectionMatrix();
  ambiente.setQualita(stato.qualita, LIVELLI[stato.qualita]);
}
addEventListener('resize', () => { ridimensiona(); programmaAdatta(); });

function applicaQualita(q) {
  stato.qualita = q;
  ridimensiona();
  macchine.setQualita(LIVELLI[q]);
}

// ---------- ciclo ----------
const orologio = new THREE.Clock();
let campioni = [], ultimoCambio = 0;
let logo = null;
function fotogramma() {
  requestAnimationFrame(fotogramma);
  const dt = Math.min(0.05, orologio.getDelta());
  stato.tempo += dt;
  const t0 = performance.now();

  const k = 1 - Math.exp(-dt * 4.5);
  stato.p += (stato.pMira - stato.p) * k;
  if (Math.abs(stato.pMira - stato.p) < 0.00005) stato.p = stato.pMira;
  const p = stato.p;

  posaCamera(p);
  const finale = finaleDi(p);
  ambiente.aggiorna(stato.tempo, camera, finale, p);
  macchine.aggiorna(p, stato.tempo, camera);
  collezione.aggiorna(finale, stato.tempo);
  // la striscia della finestra sul vetro dei moduli attraversa la fila con lo scorrimento del momento fotovoltaico
  if (!stato.faseVetroFissa) setFaseVetro(-18 + (p - MOMENTI[1].da) / (MOMENTI[1].a - MOMENTI[1].da) * 36);
  aggiornaTerra(p);
  aggiornaTesti(p);
  etichetteTurbine(p);
  if (logo) { logo.componi(Math.min(1, p / 0.05 + apertura.k)); logo.posiziona(p, innerWidth, innerHeight); }

  renderer.info.reset();
  renderer.render(scena, camera);

  const ms = performance.now() - t0;
  stato.ms = stato.ms * 0.95 + ms * 0.05;
  if (stato.tempo > 3) {
    campioni.push(dt * 1000);
    if (campioni.length > 90) campioni.shift();
    stato.msPeggio = Math.max(stato.msPeggio, dt * 1000);
    if (!qualitaForzata && campioni.length >= 90 && stato.tempo - ultimoCambio > 5) {
      const media = campioni.reduce((a, b) => a + b, 0) / campioni.length;
      const i = ORDINE.indexOf(stato.qualita);
      if (media > 24 && i < ORDINE.length - 1) { applicaQualita(ORDINE[i + 1]); ultimoCambio = stato.tempo; campioni = []; }
    }
  }
}

// ---------- apertura: i petali si posano e compongono il logo ----------
const apertura = { k: 0 };
function animaApertura() {
  const inizio = performance.now();
  const durata = 2600;
  (function passo() {
    const x = Math.min(1, (performance.now() - inizio) / durata);
    apertura.k = x;
    if (x < 1) requestAnimationFrame(passo);
  })();
}

// ---------- avvio ----------
(async function avvia() {
  try {
    logo = await creaLogo(document.getElementById('logo'), '../../../logo/ufficiale/logo-eri-originale.svg');
  } catch (e) { stato.errori.push('logo: ' + e.message); }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
  applicaQualita(stato.qualita);
  adattaRegia(true);
  leggiScroll();
  stato.p = stato.pMira;
  await macchine.pronto;
  fotogramma();
  requestAnimationFrame(() => {
    document.getElementById('caricamento').classList.add('via');
    document.getElementById('logo').classList.add('visibile');
    animaApertura();
    setTimeout(() => { stato.pronto = true; }, 2800);
  });
})();

// ---------- strumenti per le foto e le misure (strumenti/foto-v2.ps1) ----------
const dueFotogrammi = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
stato.moduli = () => ({ scena: 'ok' });
stato.vai = (p) => new Promise((ok) => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo(0, p * max);
  stato.pMira = p; stato.p = p;
  apertura.k = 1;
  let n = 0; (function f() { if (++n < 4) requestAnimationFrame(f); else setTimeout(ok, 1500); })();
});
stato.info = () => ({
  ms: +stato.ms.toFixed(2), msPeggio: +stato.msPeggio.toFixed(1),
  triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls,
  qualita: stato.qualita, dpr: renderer.getPixelRatio(), p: +stato.p.toFixed(3),
  cam: camera.position.toArray().map((v) => +v.toFixed(2)), fov: camera.fov, aspect: +camera.aspect.toFixed(3), stretto: stretto(),
  fattori: regia.fattori, spostamenti: regia.spostamenti,
});
stato.azzeraMisure = () => { stato.msPeggio = 0; campioni = []; };
stato.proietta = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [+((v.x * 0.5 + 0.5) * innerWidth).toFixed(0), +((-v.y * 0.5 + 0.5) * innerHeight).toFixed(0), +v.z.toFixed(3)]; };
stato.misura = (durataMs = 3000) => new Promise((ok) => {
  const t0 = performance.now(); const fotogrammi = []; let peggio = 0, lavoro = 0, n = 0, prima = t0;
  (function f() {
    const ora = performance.now(); const dt = ora - prima; prima = ora;
    if (n > 2) { fotogrammi.push(dt); peggio = Math.max(peggio, dt); lavoro += stato.ms; }
    n++;
    if (ora - t0 < durataMs) requestAnimationFrame(f);
    else ok({ qualita: stato.qualita, dpr: renderer.getPixelRatio(), msFotogrammaMedio: +(fotogrammi.reduce((a, b) => a + b, 0) / fotogrammi.length).toFixed(1), msFotogrammaPeggiore: +peggio.toFixed(1), msRenderMedio: +(lavoro / fotogrammi.length).toFixed(2), triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls, p: +stato.p.toFixed(3) });
  })();
});
stato.qualitaImposta = (q) => applicaQualita(q);
stato.vetro = vetroModulo();
stato.setFaseVetro = (x) => { setFaseVetro(x); stato.faseVetroFissa = true; };
stato.setTintaVetro = setTintaVetro;
// il percorso della camera senza disegnare nulla: [p, x, y, z, dx, dy, dz] ogni `passo`
stato.percorso = (passo = 0.002) => {
  regia.preparaProva();
  const out = [];
  for (let p = 0; p <= 1 + 1e-9; p += passo) { const c = regia.campiona(Math.min(1, p), stretto(), innerWidth, innerHeight); out.push([+p.toFixed(4), ...c.pos.map((v) => +v.toFixed(3)), ...c.dir.map((v) => +v.toFixed(4))]); }
  return out;
};
// Controllo vero delle sovrapposizioni: la GPU disegna le macchine e si contano i pixel sotto le righe di testo.
// `ritardo` allunga la vita dei testi di un momento (le dissolvenze CSS durano qualche decimo di secondo).
const radiciMacchine = [...Object.values(macchine.gruppi), collezione.gruppo];
function controllaOra(p, ritardo, scala) {
  const maschera = mascheraMacchine(renderer, scena, camera, radiciMacchine, scala);
  const indici = MOMENTI.map((m, i) => (p >= m.da - 0.015 - ritardo && p <= m.a + 0.015 + ritardo ? i : -1)).filter((i) => i >= 0);
  const out = [];
  for (const r of testiDeiMomenti(indici)) { const n = pixelSotto(maschera, r); if (n > 0) out.push({ testo: r.nome, pixel: n, rett: [r.x0, r.y0, r.x1, r.y1].map(Math.round) }); }
  return out;
}
stato.controlla = (ritardo = 0, scala = 0.5) => controllaOra(stato.p, ritardo, scala);
stato.spazza = async ({ da = 0, a = 1, passo = 0.0025, ritardo = 0.006, scala = 0.5 } = {}) => {
  const ferma = document.createElement('style');
  ferma.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.appendChild(ferma);
  apertura.k = 1;
  const problemi = [];
  for (let p = da; p <= a + 1e-9; p += passo) {
    stato.pMira = stato.p = Math.min(1, p);
    await dueFotogrammi();
    for (const x of controllaOra(stato.p, ritardo, scala)) problemi.push({ p: +stato.p.toFixed(4), ...x });
  }
  ferma.remove();
  return problemi;
};
// diagnosi della regia a p: le zone dei testi del momento e, per ognuna, quante scatolette della macchina la toccano
stato.diagnosi = async (p) => {
  stato.pMira = stato.p = p;
  await dueFotogrammi();
  camera.updateMatrixWorld();
  const i = momentoDeiTesti(p), imp = impronte[i];
  if (!imp) return { momento: i, zone: zone[i] };
  let kv = 0; imp.campioni.forEach((q, k) => { if (Math.abs(q - p) < Math.abs(imp.campioni[kv] - p)) kv = k; });
  const n = rettangoliSchermo(imp.punti[kv], camera, innerWidth, innerHeight, imp.buf);
  const b = imp.buf, tutto = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < n; k++) { tutto[0] = Math.min(tutto[0], b[k * 4]); tutto[1] = Math.min(tutto[1], b[k * 4 + 1]); tutto[2] = Math.max(tutto[2], b[k * 4 + 2]); tutto[3] = Math.max(tutto[3], b[k * 4 + 3]); }
  return {
    momento: i, scatolette: n, ingombro: tutto.map(Math.round), fattori: regia.fattori, spostamenti: regia.spostamenti,
    zone: zone[i].map((z) => {
      let tocchi = 0; const u = [Infinity, Infinity, -Infinity, -Infinity];
      for (let k = 0; k < n; k++) if (b[k * 4] < z.x1 && b[k * 4 + 2] > z.x0 && b[k * 4 + 1] < z.y1 && b[k * 4 + 3] > z.y0) { tocchi++; u[0] = Math.min(u[0], b[k * 4]); u[1] = Math.min(u[1], b[k * 4 + 1]); u[2] = Math.max(u[2], b[k * 4 + 2]); u[3] = Math.max(u[3], b[k * 4 + 3]); }
      return { nome: z.nome, rett: [z.x0, z.y0, z.x1, z.y1].map(Math.round), tocchi, dove: tocchi ? u.map(Math.round) : null };
    }),
  };
};
// quanto si vede ancora di ogni macchina quando esce di scena (deve essere 0: esce già fuori dall'inquadratura)
stato.uscite = async () => {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const fine = MOMENTI[i + 1].da - 0.0165;
    stato.pMira = stato.p = fine;
    await dueFotogrammi();
    const maschera = mascheraMacchine(renderer, scena, camera, [Object.values(macchine.gruppi)[i - 1]], 0.25);
    let n = 0; for (let k = 3; k < maschera.dati.length; k += 4) if (maschera.dati[k] > 8) n++;
    out.push({ macchina: MOMENTI[i].nome, p: +fine.toFixed(4), pixelAschermo: n, inScena: macchinaInScena(i, fine) });
  }
  return out;
};
