// ERI · Galleria Bianca · le macchine come sculture in una sala bianca, alla luce di una finestra alta.
// Motore e macchine sono quelli di v3-fable; cambiano ambiente, luce, materiali, testi e impaginazione.
import * as THREE from 'three';
import { creaAmbiente } from './ambiente.js';
import { creaMacchine } from './macchine-galleria.js';
import { POSA } from './bess-galleria.js';
import { DIST } from './turbine-galleria.js';
import { creaLogo } from './logo.js';
import { MOMENTI, assemblaggioDi } from '../../ui/testi.js';
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
  { m: MOMENTI[1], ombre: ombreFv, disegno: disegnoFv },
  { m: MOMENTI[2], ombre: ombreBess, disegno: disegnoBess },
  { m: MOMENTI[3], ombre: ombreIdro, disegno: disegnoIdro },
];
function aggiornaTerra(p) {
  for (const t of terra) {
    const vicino = p > t.m.da - 0.1 && p < t.m.a + 0.1;
    if (!vicino) { t.ombre.set(0); t.disegno.set(0); continue; }
    const a = assemblaggioDi(p, t.m);
    const entra = Math.min(1, Math.max(0, (p - (t.m.da - 0.1)) / 0.04)); // prima del momento il disegno affiora piano
    const sfuma = 1 - Math.min(1, Math.max(0, (p - t.m.a) / 0.06)); // dopo il momento il disegno svanisce
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

// ---------- regia della camera: una persona che cammina in una galleria, all'altezza degli occhi ----------
// Le tre sculture stanno in fila lungo x; tra una e l'altra la camera cammina di lato, dentro ogni momento gira piano.
// Ogni chiave ha anche dove sta il soggetto sullo schermo (sx, sy: frazioni della mezza larghezza e della mezza altezza)
// e, se serve, una posa diversa per il telefono (tel), dove la camera non arretra e segue la macchina da vicino.
// (le chiavi ripetute subito dopo una posa servono a fermare la curva: senza, il punto successivo lontano la piega)
const DESKTOP = [
  { p: 0.00, pos: [-52, 2.6, 30], mira: [-44, 5.6, -30] },
  { p: 0.10, pos: [-46, 2.6, 29], mira: [-30, 3.0, -22] },
  // fotovoltaico (approvato, non si tocca): la fila davanti parte vicina a sinistra e si allontana verso destra, vista dal basso di tre quarti
  { p: 0.16, pos: [-30, 2.0, 27], mira: [-4, 2.5, 4] },
  { p: 0.36, pos: [-12, 1.9, 25], mira: [9, 2.5, 3] },
  { p: 0.43, pos: [46, 2.3, 26], mira: [72, 1.6, 0] },
  // BESS: la camera arriva da sinistra, si abbassa all'altezza degli occhi e si ferma di tre quarti davanti alle porte aperte, il blocco a centro-sinistra
  { p: 0.47, pos: [60, 1.8, 27], mira: [69, 1.3, -1], sx: -0.2, sy: -0.14 },
  { p: 0.60, pos: [80, 1.7, 21.5], mira: [69.5, 1.3, -1], sx: -0.26, sy: -0.14 },
  { p: 0.62, pos: [80.5, 1.7, 21.3], mira: [69.5, 1.3, -1], sx: -0.26, sy: -0.14 },
  // le tre turbine: la camera passa davanti alla fila, bassa, e si ferma vicina sulla Francis (la fila riempie la pagina,
  // le basi restano sopra il blocco iter, che nel momento idro è più basso e più stretto)
  { p: 0.66, pos: [118, 1.7, 29], mira: [137, 1.2, 0], sx: -0.14, sy: -0.14 },
  { p: 0.84, pos: [135.6, 1.5, 19.7], mira: [140.3, 1.25, 0], sx: -0.08, sy: -0.24 },
  { p: 0.86, pos: [136.1, 1.5, 19.6], mira: [140.3, 1.25, 0], sx: -0.08, sy: -0.24 },
  { p: 0.90, pos: [166, 2.6, 8], mira: [176, 5.0, -40] },
  { p: 1.00, pos: [176, 4.0, 0], mira: [187, 7.5, -60] },
];
// Telefono: apertura, fotovoltaico e contatti arretrano (la scultura sta nella fascia bassa); BESS e turbine si guardano da vicino,
// una macchina alla volta, con la camera che cammina lungo la fila.
const TELEFONO = [
  { p: 0.00, pos: [-52, 2.6, 30], mira: [-44, 5.6, -30], arretra: 1.55 },
  { p: 0.10, pos: [-46, 2.6, 29], mira: [-30, 3.0, -22], arretra: 1.55 },
  // fotovoltaico: di tre quarti dal capo della fila davanti, più arretrata e più alta che su desktop: la fila (16 m) si allontana
  // in diagonale verso destra e sta tutta in campo, il capo vicino compreso; le altre file restano dietro, a sinistra
  // (le chiavi doppie fermano la curva: tra 0.20 e 0.32 la camera scivola appena, senza piegarsi verso l'apertura o il BESS)
  { p: 0.16, pos: [-26.6, 6.1, 26.6], mira: [3.8, 1.4, 8.2], sx: 0, sy: -0.24 },
  { p: 0.20, pos: [-26.6, 6.1, 26.6], mira: [3.8, 1.4, 8.2], sx: 0, sy: -0.24 },
  { p: 0.32, pos: [-25.4, 5.9, 25.4], mira: [4.2, 1.4, 7.8], sx: 0, sy: -0.24 },
  { p: 0.36, pos: [-25.4, 5.9, 25.4], mira: [4.2, 1.4, 7.8], sx: 0, sy: -0.24 },
  // BESS: prima il container A con il PCS davanti, poi la camera cammina a destra e si ferma davanti al container B
  // (tutto in campo: il trasformatore davanti alle porte chiuse, le porte aperte libere a destra; il container A resta fuori dal bordo)
  { p: 0.43, pos: [58, 2.0, 24], mira: [65, 1.3, -1] },
  { p: 0.49, pos: [66, 1.9, 20], mira: [67.5, 1.2, -1] },
  { p: 0.55, pos: [75.15, 1.8, 21], mira: [75.4, 1.2, -1] },
  { p: 0.60, pos: [75.25, 1.8, 21], mira: [75.4, 1.2, -1] },
  // turbine: una alla volta, frontali e vicine (le vicine restano fuori dal bordo anche sugli schermi meno stretti)
  { p: 0.64, pos: [126, 1.8, 20], mira: [140 - DIST, 1.1, 0] },
  { p: 0.69, pos: [140.15 - DIST, 1.7, 11.8], mira: [140.15 - DIST, 1.1, 0] },
  { p: 0.72, pos: [140.15 - DIST, 1.7, 11.8], mira: [140.15 - DIST, 1.1, 0] },
  { p: 0.75, pos: [140, 1.7, 11.8], mira: [140, 1.1, 0] },
  { p: 0.78, pos: [140, 1.7, 11.8], mira: [140, 1.1, 0] },
  { p: 0.81, pos: [140 + DIST, 1.7, 11.8], mira: [140 + DIST, 1.1, 0] },
  { p: 0.84, pos: [140 + DIST, 1.7, 11.8], mira: [140 + DIST, 1.1, 0] },
  // contatti: la camera guarda un po' più in basso, così la collezione davanti alla vetrata sta nella fascia tra il titolo e il modulo
  { p: 0.90, pos: [166, 2.6, 8], mira: [172, -2.5, -40], sx: 0.1, sy: 0 },
  { p: 1.00, pos: [176, 4.0, 0], mira: [181, -4.5, -60], sx: 0.1, sy: 0 },
];
const chiave = (k, t) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira),
  sx: k.sx ?? (t ? 0 : 0.02), sy: k.sy ?? (t ? -0.22 : -0.18), arretra: k.arretra ?? 1 });
const CHIAVI_DESK = DESKTOP.map((k) => chiave(k, false));
const CHIAVI_TEL = TELEFONO.map((k) => chiave(k, true));

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3();
function catmull(out, p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}
function posaCamera(p) {
  if (stato.prova) { // posa forzata, solo per le prove di inquadratura (strumenti)
    const q = stato.prova; _a.set(...q.pos); _b.set(...q.mira);
    inquadra(_a, _b, q.sx ?? 0, q.sy ?? -0.24, q.arretra ?? 1); return;
  }
  const CHIAVI = stretto() ? CHIAVI_TEL : CHIAVI_DESK;
  let i = 0;
  while (i < CHIAVI.length - 2 && p > CHIAVI[i + 1].p) i++;
  const k0 = CHIAVI[Math.max(0, i - 1)], k1 = CHIAVI[i], k2 = CHIAVI[i + 1], k3 = CHIAVI[Math.min(CHIAVI.length - 1, i + 2)];
  const s = Math.min(1, Math.max(0, (p - k1.p) / (k2.p - k1.p)));
  const e = s * s * (3 - 2 * s);
  catmull(_a, k0.pos, k1.pos, k2.pos, k3.pos, e);
  catmull(_b, k0.mira, k1.mira, k2.mira, k3.mira, e);
  _a.y += Math.sin(stato.tempo * 0.35) * 0.03; // respiro impercettibile
  inquadra(_a, _b, k1.sx + (k2.sx - k1.sx) * e, k1.sy + (k2.sy - k1.sy) * e, k1.arretra + (k2.arretra - k1.arretra) * e);
}
// Il soggetto sta a centro-destra su desktop (il titolo è dietro, in alto a sinistra), in basso sul telefono (i testi stanno in alto).
function stretto() { return innerHeight > innerWidth || innerWidth <= 760; }
function inquadra(pos, mira, sx, sy, arretra) {
  // sul telefono la camera arretra (salvo le pose pensate per il telefono): la scultura deve stare tutta nella fascia bassa dello schermo
  _dir.subVectors(mira, pos); let dist = _dir.length(); _dir.normalize();
  if (arretra !== 1) { pos = _a.copy(pos).addScaledVector(_dir, -dist * (arretra - 1)); dist *= arretra; }
  const mezzaH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
  const mezzaW = mezzaH * camera.aspect;
  _dx.crossVectors(_dir, camera.up).normalize();
  _dy.crossVectors(_dx, _dir).normalize();
  const spX = -sx * mezzaW, spY = -sy * mezzaH;
  camera.position.copy(pos).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  _b.copy(mira).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  camera.lookAt(_b);
}

// ---------- testi: titoli sotto la tela, cartellini e iter sopra ----------
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
  let idx = -1;
  MOMENTI.forEach((m, i) => { if (p >= m.da - 0.015 && p <= m.a + 0.015) idx = i; });
  if (idx !== momentoAttivo) {
    sezioni.forEach((s) => s.classList.toggle('attivo', +s.dataset.m === idx));
    titoli.forEach((t) => t.classList.toggle('attivo', +t.dataset.m === idx));
    document.body.dataset.momento = idx; // il CSS lascia libera la fascia dell'iter a destra nei momenti tecnologici
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
  const finale = Math.min(1, Math.max(0, (p - 0.86) / 0.14));
  vetrata.style.opacity = (finale * 0.9).toFixed(3);
}

// Su desktop, nei momenti fotovoltaico e BESS, la scena sfuma nella luce della parete a destra (la colonna dell'iter ha la sua
// fascia libera). La maschera entra e esce con p, in modo continuo: niente scatti tra un momento e l'altro.
const liscia = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
let mascheraUltima = '';
function aggiornaMaschera(p) {
  const k = stretto() ? 0 : Math.min(liscia((p - 0.10) / 0.03), 1 - liscia((p - 0.60) / 0.04));
  const chiave = k < 0.005 ? '' : `linear-gradient(90deg, #000 calc(100% - 520px), rgba(0,0,0,${(1 - k).toFixed(2)}) calc(100% - 300px))`;
  if (chiave === mascheraUltima) return;
  mascheraUltima = chiave;
  tela.style.webkitMaskImage = chiave; tela.style.maskImage = chiave;
}

// ---------- etichette delle turbine ----------
const etichette = {};
for (const el of document.querySelectorAll('.etichetta')) etichette[el.dataset.turbina] = el;
const cartellinoIdro = document.querySelector('.momento[data-m="3"] .cartellino');
const _proj = new THREE.Vector3();
function etichetteTurbine(p) {
  const m = MOMENTI[3];
  const dentro = p > m.da && p < m.a + 0.02;
  const a = assemblaggioDi(p, m);
  const s = stretto();
  // l'ancora sta al bordo anteriore del basamento: l'etichetta pende sotto, come una targhetta di sala;
  // su desktop le tre targhette stanno su una sola riga, appesa alla piastra più bassa
  const ancore = macchine.ancoreTurbine().map(({ nome, pos }) => {
    _proj.copy(pos).project(camera);
    return { nome, x: (_proj.x * 0.5 + 0.5) * innerWidth, y: (-_proj.y * 0.5 + 0.5) * innerHeight, z: _proj.z };
  });
  const yRiga = Math.max(...ancore.map((q) => q.y)) + 4;
  // il limite in basso è il cartellino (sul telefono il bordo dello schermo); da sinistra a destra, una targhetta
  // che finirebbe sopra la precedente resta spenta: sugli schermi piccoli, o da lontano, non si accavallano mai
  const limite = dentro ? (s ? innerHeight - 60 : cartellinoIdro.getBoundingClientRect().top - 10) : 0;
  let bordoDestro = -Infinity;
  for (const q of ancore.sort((u, v) => u.x - v.x)) {
    const { nome, x, z } = q;
    const y = s ? q.y + 4 : yRiga;
    const el = etichette[nome]; if (!el) continue;
    const i = nome === 'pelton' ? 0 : nome === 'francis' ? 1 : 2;
    const visibile = dentro && a > i * 0.3 + 0.3;
    if (!visibile) { el.classList.remove('visibile'); continue; }
    const mezza = el.offsetWidth / 2 + 12;
    const dentroSchermo = z < 1 && x - mezza > Math.max(0, bordoDestro) && x < innerWidth - mezza && y > (s ? innerHeight * 0.5 : innerHeight * 0.4) && y + el.offsetHeight < limite;
    el.classList.toggle('visibile', dentroSchermo);
    if (dentroSchermo) bordoDestro = x + mezza;
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, 0)`;
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
addEventListener('resize', ridimensiona);

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
  const finale = Math.min(1, Math.max(0, (p - 0.86) / 0.14));
  ambiente.aggiorna(stato.tempo, camera, finale, p);
  macchine.aggiorna(p, stato.tempo, camera);
  collezione.aggiorna(finale, stato.tempo);
  // la striscia della finestra sul vetro dei moduli attraversa la fila con lo scorrimento del momento fotovoltaico
  if (!stato.faseVetroFissa) setFaseVetro(-18 + (p - 0.13) / 0.23 * 36);
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
});
stato.azzeraMisure = () => { stato.msPeggio = 0; campioni = []; };
stato.proietta = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [+((v.x * 0.5 + 0.5) * innerWidth).toFixed(0), +((-v.y * 0.5 + 0.5) * innerHeight).toFixed(0), +v.z.toFixed(3)]; };
stato.posizioni = () => { const out = {}; for (const [n, g] of Object.entries(macchine.gruppi)) { g.traverse((o) => { if (o.isMesh && o.geometry.type === 'LatheGeometry') { const w = new THREE.Vector3(); o.getWorldPosition(w); out[n + '-isolatori'] = w.toArray().map((v) => +v.toFixed(2)); } }); } return out; };
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
