// ERI · Alba di Vetro · bozzetto 3D a scorrimento: aria e leggerezza all'aperto. Cielo dell'alba su una grande sfera,
// pavimento d'acqua ferma che riflette i tracker, i pannelli "da catalogo" di ../pannello/ (non modificati).
// Due momenti: apertura (logo che si compone) e fotovoltaico (la camera scivola dalla fila alla vista eroe, i tracker seguono il sole).
import * as THREE from 'three';
import { creaFila, creaAgrivoltaico, materialiPannello } from '../pannello/pannello.js';
import { PALETTE, uniformiCielo, creaCielo, creaAmbienteAlba } from './cielo.js';
import { creaAcqua } from './acqua.js';
import { creaLogo } from './logo.js';

const param = new URLSearchParams(location.search);
const tela = document.getElementById('scena');
const stato = { p: 0, pMira: 0, tempo: 0, qualita: 'alta', ms: 0, msPeggio: 0, pronto: false, errori: [] };
window.__eri = stato;
window.addEventListener('error', (e) => stato.errori.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => stato.errori.push('promessa: ' + String(e.reason && e.reason.message || e.reason)));

// ---------- qualità: tre livelli, si scende da soli se i fotogrammi sono lenti ----------
const telefono = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && innerWidth < 900);
const LIVELLI = {
  alta:  { dpr: telefono ? 1.25 : 1.5,  riflessi: true,  rt: [768, 480] },
  media: { dpr: telefono ? 1.1 : 1.25,  riflessi: true,  rt: [512, 320] },
  bassa: { dpr: 1.0,                    riflessi: false, rt: [256, 160] },
};
const ORDINE = ['alta', 'media', 'bassa'];
stato.qualita = ORDINE.includes(param.get('q')) ? param.get('q') : (telefono ? 'media' : 'alta');
const qualitaForzata = ORDINE.includes(param.get('q'));

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false;

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 6000);
camera.layers.enable(1); camera.layers.enable(2);

// ---------- cielo, ambiente, acqua ----------
const uCielo = uniformiCielo(PALETTE, { sole: [0.3, 0.16, -1], forzaSole: 0.12 });
const cielo = creaCielo(uCielo);
cielo.layers.set(2);                    // il cielo non entra nello specchio: l'acqua lo calcola da sé
scena.add(cielo);
// (il cielo della mappa è più scuro di quello visibile: il vetro resta blu notte con un velo chiaro, come nella tavola)
const ENV = {
  zenit: '#4C5D78', alto: '#5B6C86', azzurro: '#7487A0', mezzo: '#8E9AAD', rosa: '#C9B3AB',
  cipria: '#E6C6B6', pesca: '#F7DEC4', sotto: '#5E6873', sole: '#FFF1DF',
};
scena.environment = creaAmbienteAlba(renderer, ENV, { sole: [0.3, 0.16, -1], forzaSole: 3.0 });
const acqua = creaAcqua({ renderer, uniformiCielo: uCielo, larghezzaRT: 768, altezzaRT: 480 });
scena.add(acqua.mesh);

// luci morbide (niente ombre): il sole basso dietro e l'emisfero cielo/acqua
const sole = new THREE.DirectionalLight('#FFF1E2', 0.55); sole.position.set(12, 7, -40); scena.add(sole);
const emisfero = new THREE.HemisphereLight('#F4F7FB', '#D8DEE6', 0.9); scena.add(emisfero);

// ---------- i pannelli (materiali ritoccati solo tramite materialiPannello) ----------
const M = materialiPannello();
M.vetro.envMapIntensity = 0.8;
M.cella.envMapIntensity = 0.85;
M.cornice.envMapIntensity = 1.2;
M.zincato.envMapIntensity = 1.1;

const fila = creaFila({ tracker: 3, passo: 7, moduli: 28 });
scena.add(fila.gruppo);
const agri = creaAgrivoltaico({ campate: 4, altezza: 4.5 });
agri.gruppo.position.set(0, 0, -27);
scena.add(agri.gruppo);

// Le parti piccole stanno sul livello 1 (le vede solo la camera vera): lo specchio riflette le parti grandi.
// Le ombre di contatto dipinte diventano blu notte e più tenui: sull'acqua chiara dell'alba sono un velo.
const PICCOLE = new Set(['bulloniPali', 'bulloniMorsetti', 'bulloniAgri', 'morsetti', 'morsettiAgri', 'alette', 'scatole', 'cappe', 'selle', 'staffe', 'anelliInterni', 'cuscinetti']);
for (const g of [fila.gruppo, agri.gruppo]) {
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (PICCOLE.has(o.name) || o.geometry.type === 'TubeGeometry') o.layers.set(1);
    if (o.name === 'ombra') {
      o.layers.set(1);
      o.material.color.set('#2F3F5B');
      o.material.opacity *= 0.5;
    }
  });
}

const deg = THREE.MathUtils.degToRad;
const liscia = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// i tracker seguono il sole: con lo scorrimento del momento il vetro si inclina piano verso la luce
function inclinazioneDi(p) { return deg(5 + 23 * liscia((p - 0.22) / 0.7)); }

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

// ---------- regia della camera: una sola discesa calma, dall'orizzonte lontano al vetro vicino ----------
// Chiavi Catmull-Rom; la mira più alta della camera alza lo sguardo e tiene l'orizzonte basso nel quadro.
// sx, sy: dove sta la mira sullo schermo (frazioni della mezza larghezza e della mezza altezza).
const DESKTOP = [
  { p: 0.00, pos: [-20, 2.6, 70], mira: [16, 14.6, -8] },
  { p: 0.12, pos: [-20, 2.6, 70], mira: [16, 14.6, -8] },
  { p: 0.45, pos: [-14, 2.4, 27], mira: [13, 4.8, -8] },
  { p: 0.52, pos: [-13.5, 2.4, 26.4], mira: [13, 4.7, -8] },
  { p: 0.85, pos: [-7.5, 2.6, 8.6], mira: [6.0, 2.1, -0.8] },
  { p: 1.00, pos: [-6.9, 2.55, 8.1], mira: [6.4, 2.05, -1.0] },
];
const TELEFONO = [
  { p: 0.00, pos: [-14, 2.6, 96], mira: [16, 16.0, -8] },
  { p: 0.12, pos: [-14, 2.6, 96], mira: [16, 16.0, -8] },
  { p: 0.50, pos: [-15, 3.0, 36], mira: [14, 5.6, -7] },
  { p: 0.56, pos: [-14.6, 3.0, 35.4], mira: [14, 5.5, -7] },
  { p: 0.85, pos: [-8.0, 3.0, 11.0], mira: [7.0, 2.3, -0.6] },
  { p: 1.00, pos: [-7.4, 2.95, 10.5], mira: [7.4, 2.25, -0.8] },
];
const chiave = (k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira), sx: k.sx ?? 0, sy: k.sy ?? 0 });
const CHIAVI_DESK = DESKTOP.map(chiave);
const CHIAVI_TEL = TELEFONO.map(chiave);

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3();
function catmull(out, p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}
function stretto() { return innerHeight > innerWidth || innerWidth <= 760; }
function posaCamera(p) {
  if (stato.prova) {
    const q = stato.prova; _a.set(...q.pos); _b.set(...q.mira);
    inquadra(_a, _b, q.sx ?? 0, q.sy ?? 0); return;
  }
  const CHIAVI = stretto() ? CHIAVI_TEL : CHIAVI_DESK;
  let i = 0;
  while (i < CHIAVI.length - 2 && p > CHIAVI[i + 1].p) i++;
  const k0 = CHIAVI[Math.max(0, i - 1)], k1 = CHIAVI[i], k2 = CHIAVI[i + 1], k3 = CHIAVI[Math.min(CHIAVI.length - 1, i + 2)];
  const s = Math.min(1, Math.max(0, (p - k1.p) / (k2.p - k1.p)));
  const e = s * s * (3 - 2 * s);
  catmull(_a, k0.pos, k1.pos, k2.pos, k3.pos, e);
  catmull(_b, k0.mira, k1.mira, k2.mira, k3.mira, e);
  _a.y += Math.sin(stato.tempo * 0.3) * 0.02; // respiro impercettibile
  inquadra(_a, _b, k1.sx + (k2.sx - k1.sx) * e, k1.sy + (k2.sy - k1.sy) * e);
}
function inquadra(pos, mira, sx, sy) {
  _dir.subVectors(mira, pos); const dist = _dir.length(); _dir.normalize();
  const mezzaH = Math.tan(deg(camera.fov) / 2) * dist;
  const mezzaW = mezzaH * camera.aspect;
  _dx.crossVectors(_dir, camera.up).normalize();
  _dy.crossVectors(_dx, _dir).normalize();
  const spX = -sx * mezzaW, spY = -sy * mezzaH;
  camera.position.copy(pos).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  _b.copy(mira).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  camera.lookAt(_b);
}

// ---------- testi: due momenti; l'iter si accende in modo continuo con lo scorrimento ----------
const NOMI_FASI = ['Sviluppo', 'Autorizzazioni', 'Ready to Build', 'Costruzione', 'Gestione'];
const sezioni = [...document.querySelectorAll('.momento')];
const iterLi = [...document.querySelectorAll('.iter li')];
const iterRiga = document.querySelector('.iter .linea i');
const iterCorrente = document.querySelector('.iter .fase-attuale');
const menu = [...document.querySelectorAll('.menu a')];
const DA_FV = 0.30, A_FV = 0.94;
let momentoAttivo = -1, faseAttiva = -1;
function aggiornaTesti(p) {
  const idx = p < 0.26 ? 0 : 1;
  if (idx !== momentoAttivo) {
    sezioni.forEach((s) => s.classList.toggle('attivo', +s.dataset.m === idx));
    menu[0].classList.toggle('on', idx === 1);
    momentoAttivo = idx;
  }
  // la riga accesa cresce con p a ogni fotogramma (nessuna transition sulla lunghezza), la parola corrente in accento
  const a = Math.min(1, Math.max(0, (p - DA_FV) / (A_FV - DA_FV)));
  iterRiga.style.width = (a * 100).toFixed(2) + '%';
  const k = Math.min(4, Math.floor(a * 4 + 1e-6));
  iterLi.forEach((li, i) => { li.classList.toggle('acceso', a * 4 >= i - 1e-6); li.classList.toggle('corrente', i === k); });
  if (k !== faseAttiva) { faseAttiva = k; iterCorrente.textContent = `0${k + 1} · ${NOMI_FASI[k]}`; }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // su desktop il campo ORIZZONTALE è costante (fov verticale ≈ 35° a 1600×992); sul telefono 50° verticali
  camera.fov = stretto() ? 50 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(16)) * 1.766 / camera.aspect)), 26, 42);
  camera.updateProjectionMatrix();
}
addEventListener('resize', ridimensiona);

function applicaQualita(q) {
  stato.qualita = q;
  const L = LIVELLI[q];
  acqua.setRiflessi(L.riflessi);
  acqua.setRisoluzione(L.rt[0], L.rt[1]);
  ridimensiona();
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
  fila.setInclinazione(inclinazioneDi(p));
  aggiornaTesti(p);
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
  posaCamera(stato.p);
  renderer.compile(scena, camera);
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
  cam: camera.position.toArray().map((v) => +v.toFixed(2)), fov: +camera.fov.toFixed(1), aspect: +camera.aspect.toFixed(3), stretto: stretto(),
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
stato.materiali = M;
stato.acqua = acqua.uniformi;
stato.cielo = uCielo;
stato.esposizione = (v) => { renderer.toneMappingExposure = v; };
