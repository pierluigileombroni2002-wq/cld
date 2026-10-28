// ERI · Linea di Luce · regia: fondo grafite, una linea bianca che disegna le macchine e poi le riempie di materia.
// La camera è quasi ferma e bassa: un solo lento carrello laterale per momento.
import * as THREE from 'three';
import { creaAmbiente } from './ambiente.js';
import { creaMacchine } from './macchine.js';
import { creaLogo } from './logo.js';
import { creaTesti, MOMENTI, assemblaggioDi } from '../../ui/testi.js';

const param = new URLSearchParams(location.search);
const tela = document.getElementById('scena');
const stato = { p: 0, pMira: 0, tempo: 0, qualita: 'alta', ms: 0, msPeggio: 0, pronto: false, errori: [] };
window.__eri = stato;
window.addEventListener('error', (e) => stato.errori.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => stato.errori.push('promise: ' + String(e.reason && e.reason.message || e.reason)));

// ---------- qualità: tre livelli, si scende da soli se i fotogrammi sono lenti ----------
const telefono = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && innerWidth < 900);
const LIVELLI = {
  alta:  { dpr: telefono ? 1.25 : 1.5,  dettagli: true },
  media: { dpr: telefono ? 1.1 : 1.25,  dettagli: true },
  bassa: { dpr: 1.0,                    dettagli: false },
};
const ORDINE = ['alta', 'media', 'bassa'];
stato.qualita = ORDINE.includes(param.get('q')) ? param.get('q') : (telefono ? 'media' : 'alta');
const qualitaForzata = ORDINE.includes(param.get('q'));

// ---------- renderer: tela trasparente, così le parole enormi stanno dietro la macchina ----------
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;
renderer.setClearColor(0x000000, 0);

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1200);
const ambiente = creaAmbiente(renderer, scena);
const macchine = creaMacchine(scena, ambiente.env);

// ombre di contatto dipinte: una per ogni corpo appoggiato a terra
for (const z of [4, 11, -6, -13]) ambiente.ombra(0, z, 19, 4.2);                        // le quattro file di tracker
ambiente.ombra(70 - 4.3, -2.5, 7.2, 3.6); ambiente.ombra(70 + 4.3, -2.5, 7.2, 3.6);   // i container
ambiente.ombra(64, 3.0, 3.2, 2.2); ambiente.ombra(75.5, 3.2, 3.4, 2.6);               // PCS e trasformatore
for (const x of [128, 140, 152]) ambiente.ombra(x, 0, 6.0, 4.4);                        // le tre turbine

// ---------- scorrimento morbido ----------
const scorrimento = document.getElementById('scorrimento');
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

// ---------- regia della camera: bassa, quasi ferma; un carrello laterale per momento ----------
const CHIAVI = [
  { p: 0.00, pos: [-27, 3.2, 47], mira: [-4, 1.2, -3] },
  { p: 0.13, pos: [-17, 2.7, 40], mira: [0, 1.2, -2] },
  { p: 0.36, pos: [-6, 2.5, 39], mira: [1, 1.2, -2] },
  { p: 0.43, pos: [59, 2.6, 27], mira: [69, 1.4, 0] },
  { p: 0.60, pos: [65, 2.6, 27], mira: [70, 1.4, 0] },
  { p: 0.67, pos: [128, 2.6, 31], mira: [134, 1.4, 0] },
  { p: 0.84, pos: [150, 2.6, 31], mira: [146, 1.4, 0] },
  { p: 1.00, pos: [152, 2.6, 31], mira: [148, 1.4, 0] },
].map((k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira) }));

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3();
const miraCorrente = new THREE.Vector3();
function catmull(out, p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}
function stretto() { return innerHeight > innerWidth || innerWidth < 820; }
function posaCamera(p) {
  let i = 0;
  while (i < CHIAVI.length - 2 && p > CHIAVI[i + 1].p) i++;
  const k0 = CHIAVI[Math.max(0, i - 1)], k1 = CHIAVI[i], k2 = CHIAVI[i + 1], k3 = CHIAVI[Math.min(CHIAVI.length - 1, i + 2)];
  const s = Math.min(1, Math.max(0, (p - k1.p) / (k2.p - k1.p)));
  const e = s * s * (3 - 2 * s);
  catmull(_a, k0.pos, k1.pos, k2.pos, k3.pos, e);
  catmull(_b, k0.mira, k1.mira, k2.mira, k3.mira, e);
  _a.y += Math.sin(stato.tempo * 0.3) * 0.03; // respiro impercettibile
  miraCorrente.copy(_b);
  inquadra(_a, _b);
}
// Sul telefono la macchina sta nella banda bassa (60%) e la camera arretra: si sposta il binario, non l'obiettivo.
function inquadra(pos, mira) {
  const s = stretto();
  if (s) { _dir.subVectors(pos, mira); pos.copy(mira).addScaledVector(_dir, 1.25); }
  const sx = s ? -0.1 : 0, sy = s ? -0.42 : -0.14; // la macchina appoggia sulla riga: un po' sotto il centro
  _dir.subVectors(mira, pos); const dist = _dir.length(); _dir.normalize();
  const mezzaH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
  const mezzaW = mezzaH * camera.aspect;
  _dx.crossVectors(_dir, camera.up).normalize();
  _dy.crossVectors(_dx, _dir).normalize();
  const spX = -sx * mezzaW, spY = -sy * mezzaH;
  camera.position.copy(pos).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  _b.copy(mira).addScaledVector(_dx, spX).addScaledVector(_dy, spY);
  camera.lookAt(_b);
}

// ---------- testi: parola enorme, numero del momento, iter sulla riga, pagina che si schiarisce ----------
const testi = creaTesti();
const NOMI = ['Apertura', 'Fotovoltaico e agrivoltaico', 'Accumulo BESS', 'Idroelettrico', 'Contatti'];
const parole = [...document.querySelectorAll('.parola[data-m]')];
const navVoci = [...document.querySelectorAll('.nav a[data-m]')];
const numeroEl = document.querySelector('.momento-num em'), nomeEl = document.querySelector('.momento-num span');
const chiaroEl = document.getElementById('chiaro');
const radice = document.documentElement;
let momentoMostrato = -2, wdthMostrata = -1, chiaroMostrato = -1;
function aggiornaTesti(p) {
  testi.aggiorna(p);
  const idx = testi.momentoAttivo();
  if (idx !== momentoMostrato) {
    momentoMostrato = idx;
    for (const el of parole) el.classList.toggle('attiva', +el.dataset.m === idx);
    for (const el of navVoci) el.classList.toggle('on', +el.dataset.m === idx);
    if (idx >= 0) { numeroEl.textContent = String(idx + 1).padStart(2, '0'); nomeEl.textContent = NOMI[idx]; }
  }
  // la parola respira: si allarga piano lungo il momento
  let wdth = 92;
  if (idx >= 1 && idx <= 3) { const m = MOMENTI[idx]; wdth = 86 + 24 * Math.min(1, Math.max(0, (p - m.da) / (m.a - m.da))); }
  if (Math.abs(wdth - wdthMostrata) > 0.4) { wdthMostrata = wdth; radice.style.setProperty('--wdth', wdth.toFixed(1)); }
  // il finale: il grafite si schiarisce in osso
  const k = Math.min(1, Math.max(0, (p - 0.855) / 0.075));
  const kk = k * k * (3 - 2 * k);
  if (Math.abs(kk - chiaroMostrato) > 0.004) { chiaroMostrato = kk; chiaroEl.style.opacity = kk.toFixed(3); document.body.classList.toggle('chiaro', kk > 0.5); }
}

// etichette delle turbine: sulla riga, sotto ciascuna
let logo = null;
const etichette = {};
for (const el of document.querySelectorAll('.etichetta')) etichette[el.dataset.turbina] = el;
const _proj = new THREE.Vector3();
function etichetteTurbine(p) {
  const m = MOMENTI[3];
  const dentro = p > m.da && p < m.a + 0.02;
  const a = assemblaggioDi(p, m);
  const s = stretto();
  for (const { nome, pos } of macchine.ancoreTurbine()) {
    const el = etichette[nome]; if (!el) continue;
    const i = nome === 'pelton' ? 0 : nome === 'francis' ? 1 : 2;
    const visibile = dentro && a > 0.3 + i * 0.1;
    if (!visibile) { el.classList.remove('visibile'); continue; }
    _proj.set(pos.x, 0, pos.z).project(camera);
    const x = (_proj.x * 0.5 + 0.5) * innerWidth;
    const yBase = (-_proj.y * 0.5 + 0.5) * innerHeight;
    const y = s ? yBase + 18 : innerHeight * 0.67 + 70;
    const dentroSchermo = _proj.z < 1 && x > (s ? 60 : 80) && x < innerWidth - 80 && y < innerHeight - 70;
    el.classList.toggle('visibile', dentroSchermo);
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, 0)`;
  }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = h > w ? 58 : 36;
  camera.updateProjectionMatrix();
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
  ambiente.aggiorna(miraCorrente);
  macchine.aggiorna(p, stato.tempo, camera);
  aggiornaTesti(p);
  etichetteTurbine(p);
  if (logo) { logo.componi(Math.min(1, p / 0.05 + apertura.k)); logo.posiziona(p, innerWidth, innerHeight); }

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

// ---------- apertura: il logo si disegna e si accende appena la pagina è pronta ----------
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
stato.moduli = () => ({ scena: 'ok', segmentiLinea: macchine.segmenti });
stato.vai = (p) => new Promise((ok) => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo(0, p * max);
  stato.pMira = p; stato.p = p;
  apertura.k = 1;
  let n = 0; (function f() { if (++n < 4) requestAnimationFrame(f); else setTimeout(ok, 1300); })();
});
stato.info = () => ({
  ms: +stato.ms.toFixed(2), msPeggio: +stato.msPeggio.toFixed(1),
  triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls, linee: renderer.info.render.lines,
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
