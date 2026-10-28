// ERI · Galleria Bianca · le macchine come sculture in una sala bianca, alla luce di una finestra alta.
// Motore e macchine sono quelli di v3-fable; cambiano ambiente, luce, materiali, testi e impaginazione.
import * as THREE from 'three';
import { creaAmbiente } from './ambiente.js';
import { creaMacchine } from '../../macchine/index.js';
import { creaLogo } from './logo.js';
import { MOMENTI, assemblaggioDi } from '../../ui/testi.js';
import { rivestiMateriali, rivestiScena } from './materiali-galleria.js';
import { creaOmbre, creaDisegno } from './ombre.js';

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
const macchine = creaMacchine(scena, ambiente.env);
rivestiScena(scena);

// ---------- ombre di contatto dipinte e disegno a terra ----------
const L = 14 * 1.16;
const ombreFv = creaOmbre([
  { x: 0, z: 4.0, w: L + 3, d: 7.5 }, { x: 0, z: 11.0, w: L + 3, d: 7.5 },
  { x: 0, z: -6.0, w: L + 3, d: 8.5, forza: 0.7 }, { x: 0, z: -13.0, w: L + 3, d: 8.5, forza: 0.7 },
]);
macchine.gruppi.fotovoltaico.parent.add(ombreFv.gruppo); ombreFv.gruppo.position.copy(macchine.gruppi.fotovoltaico.position);
const ombreBess = creaOmbre([
  { x: -4.3, z: -2.5, w: 8.5, d: 5.2 }, { x: 4.3, z: -2.5, w: 8.5, d: 5.2 },
  { x: -6.0, z: 3.0, w: 3.6, d: 2.6 }, { x: 5.5, z: 3.2, w: 3.6, d: 3.0 },
]);
scena.add(ombreBess.gruppo); ombreBess.gruppo.position.copy(macchine.gruppi.bess.position);
const ombreIdro = creaOmbre([
  { x: -12, z: 0, w: 6.5, d: 5 }, { x: 0, z: 0, w: 6.5, d: 5 }, { x: 12, z: 0, w: 6.5, d: 5 },
]);
scena.add(ombreIdro.gruppo); ombreIdro.gruppo.position.copy(macchine.gruppi.idroelettrico.position);
const xPali = [-L / 2 + 1.2, -L / 6, L / 6, L / 2 - 1.2];
const disegnoFv = creaDisegno([
  { x: 0, z: 4.0, w: L + 0.8, d: 4.8, pali: xPali }, { x: 0, z: 11.0, w: L + 0.8, d: 4.8, pali: xPali },
  { x: 0, z: -6.0, w: L + 0.8, d: 4.8, pali: xPali }, { x: 0, z: -13.0, w: L + 0.8, d: 4.8, pali: xPali },
]);
scena.add(disegnoFv.gruppo); disegnoFv.gruppo.position.copy(macchine.gruppi.fotovoltaico.position);
const disegnoBess = creaDisegno([
  { x: -4.3, z: -2.5, w: 6.3, d: 2.7 }, { x: 4.3, z: -2.5, w: 6.3, d: 2.7 }, { x: -6.0, z: 3.0, w: 2.3, d: 1.3 }, { x: 5.5, z: 3.2, w: 2.3, d: 1.7 },
]);
scena.add(disegnoBess.gruppo); disegnoBess.gruppo.position.copy(macchine.gruppi.bess.position);
const disegnoIdro = creaDisegno([{ x: -12, z: 0, w: 4.8, d: 3.4 }, { x: 0, z: 0, w: 4.8, d: 3.4 }, { x: 12, z: 0, w: 4.8, d: 3.4 }]);
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
    const sfuma = 1 - Math.min(1, Math.max(0, (p - t.m.a) / 0.06)); // dopo il momento il disegno svanisce
    t.ombre.set(Math.min(1, Math.max(0, (a - 0.25) / 0.5)) * sfuma);
    t.disegno.set((1 - Math.min(1, Math.max(0, (a - 0.2) / 0.5))) * sfuma);
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
const CHIAVI = [
  { p: 0.00, pos: [-52, 2.6, 30], mira: [-44, 4.5, -30] },
  { p: 0.10, pos: [-46, 2.6, 29], mira: [-30, 3.0, -22] },
  // fotovoltaico: la fila davanti parte vicina a sinistra e si allontana verso destra, vista dal basso di tre quarti
  // (occhio a 1,9-2 m, sguardo appena verso l'alto: i pannelli stanno sopra l'orizzonte e sotto il titolo)
  { p: 0.16, pos: [-30, 2.0, 27], mira: [-4, 2.5, 4] },
  { p: 0.36, pos: [-12, 1.9, 25], mira: [9, 2.5, 3] },
  // BESS: frontale a tre quarti, tutto in campo
  { p: 0.43, pos: [46, 2.3, 26], mira: [72, 1.6, 0] },
  { p: 0.60, pos: [82, 2.1, 24], mira: [73, 1.4, 0] },
  // le tre turbine: la camera passa davanti e si ferma a metà sulla Francis
  { p: 0.67, pos: [122, 2.2, 22], mira: [130, 1.3, 0] },
  { p: 0.84, pos: [154, 2.2, 24], mira: [141, 1.2, 0] },
  { p: 0.90, pos: [166, 2.6, 8], mira: [176, 5.0, -40] },
  { p: 1.00, pos: [176, 4.0, 0], mira: [187, 7.5, -60] },
].map((k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira) }));

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3();
function catmull(out, p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}
function posaCamera(p) {
  let i = 0;
  while (i < CHIAVI.length - 2 && p > CHIAVI[i + 1].p) i++;
  const k0 = CHIAVI[Math.max(0, i - 1)], k1 = CHIAVI[i], k2 = CHIAVI[i + 1], k3 = CHIAVI[Math.min(CHIAVI.length - 1, i + 2)];
  const s = Math.min(1, Math.max(0, (p - k1.p) / (k2.p - k1.p)));
  const e = s * s * (3 - 2 * s);
  catmull(_a, k0.pos, k1.pos, k2.pos, k3.pos, e);
  catmull(_b, k0.mira, k1.mira, k2.mira, k3.mira, e);
  _a.y += Math.sin(stato.tempo * 0.35) * 0.03; // respiro impercettibile
  inquadra(_a, _b);
}
// Il soggetto sta a centro-destra su desktop (il titolo è dietro, in alto a sinistra), in basso sul telefono (i testi stanno in alto).
function stretto() { return innerHeight > innerWidth || innerWidth <= 760; }
function inquadra(pos, mira) {
  const s = stretto();
  // sul telefono la camera arretra: la scultura deve stare tutta nella fascia bassa dello schermo
  _dir.subVectors(mira, pos); let dist = _dir.length(); _dir.normalize();
  if (s) { pos = _a.copy(pos).addScaledVector(_dir, -dist * 0.55); dist *= 1.55; }
  const sx = s ? 0 : 0.02, sy = s ? -0.2 : -0.18;
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
  // la finestra gira piano nella sala con lo scorrimento; nel finale la parete diventa vetrata
  finestra.style.transform = `rotate(${28 - p * 10}deg) translateX(${p * 30}vw)`;
  const finale = Math.min(1, Math.max(0, (p - 0.86) / 0.14));
  vetrata.style.opacity = (finale * 0.9).toFixed(3);
}

// ---------- etichette delle turbine ----------
const etichette = {};
for (const el of document.querySelectorAll('.etichetta')) etichette[el.dataset.turbina] = el;
const _proj = new THREE.Vector3();
function etichetteTurbine(p) {
  const m = MOMENTI[3];
  const dentro = p > m.da && p < m.a + 0.02;
  const a = assemblaggioDi(p, m);
  for (const { nome, pos } of macchine.ancoreTurbine()) {
    const el = etichette[nome]; if (!el) continue;
    const i = nome === 'pelton' ? 0 : nome === 'francis' ? 1 : 2;
    const visibile = dentro && a > i * 0.3 + 0.3;
    if (!visibile) { el.classList.remove('visibile'); continue; }
    _proj.copy(pos).project(camera);
    const x = (_proj.x * 0.5 + 0.5) * innerWidth, y = (-_proj.y * 0.5 + 0.5) * innerHeight;
    const s = stretto();
    const dentroSchermo = _proj.z < 1 && x > 40 && x < innerWidth - 40 && y > (s ? innerHeight * 0.5 : innerHeight * 0.47) && y < innerHeight - 40;
    el.classList.toggle('visibile', dentroSchermo);
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
  }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = stretto() ? 50 : 32;
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
});
stato.azzeraMisure = () => { stato.msPeggio = 0; campioni = []; };
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
