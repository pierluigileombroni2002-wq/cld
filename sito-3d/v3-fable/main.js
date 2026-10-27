// ERI · v3-fable · regia: un piano-sequenza calmo in uno studio al crepuscolo.
import * as THREE from 'three';
import { creaAmbiente } from './scena/ambiente.js';
import { creaMacchine } from './macchine/index.js';
import { creaLogo } from './ui/logo.js';
import { creaTesti, MOMENTI, assemblaggioDi } from './ui/testi.js';

const param = new URLSearchParams(location.search);
const tela = document.getElementById('scena');
const stato = { p: 0, pMira: 0, tempo: 0, qualita: 'alta', ms: 0, msPeggio: 0, pronto: false, errori: [] };
window.__eri = stato;
window.addEventListener('error', (e) => stato.errori.push(String(e.message)));

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

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false; // il riflesso del pavimento è un secondo passaggio: i conteggi si azzerano a mano, una volta per fotogramma

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 3000);
camera.layers.enable(1); // vede anche cielo, stelle e polvere (che il riflesso del pavimento ignora)
const ambiente = creaAmbiente(renderer, scena);
const macchine = creaMacchine(scena, ambiente.env);

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

// ---------- regia della camera: pochi movimenti lenti e continui ----------
// Le tre tecnologie stanno in fila lungo x; la camera scivola di lato, come su un binario.
// (i punti di mira stanno a distanze simili tra loro: la curva che li unisce resta morbida, senza sbandate)
const CHIAVI = [
  { p: 0.00, pos: [-52, 4.2, 34], mira: [-41, 6.8, -26] },
  { p: 0.10, pos: [-46, 4.4, 33], mira: [-30, 5.0, -20] },
  { p: 0.16, pos: [-26, 5.0, 34], mira: [1, 1.8, 0] },
  { p: 0.36, pos: [18, 4.4, 32], mira: [3, 1.8, 0] },
  { p: 0.43, pos: [52, 4.0, 27], mira: [70, 1.6, 0] },
  { p: 0.60, pos: [86, 3.6, 25], mira: [70, 1.6, 0] },
  { p: 0.67, pos: [119, 2.7, 13], mira: [128, 1.4, 0] },
  { p: 0.84, pos: [160, 3.2, 16], mira: [145, 1.5, 0] },
  { p: 0.90, pos: [170, 5.0, 10], mira: [176, 6.5, -40] },
  { p: 1.00, pos: [176, 7.5, 0], mira: [187, 10.5, -60] },
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
  // respiro impercettibile: la camera non è mai di pietra
  _a.y += Math.sin(stato.tempo * 0.35) * 0.04;
  inquadra(_a, _b);
}
// Mette il soggetto in una zona precisa dell'inquadratura: a destra su desktop (il testo sta a sinistra),
// in basso sul telefono (il testo sta in alto). Nessuna distorsione: si sposta il binario, non l'obiettivo.
function inquadra(pos, mira) {
  const stretto = innerHeight > innerWidth || innerWidth < 820;
  const sx = stretto ? 0 : 0.34, sy = stretto ? -0.5 : -0.04;
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

// ---------- testi, logo, etichette delle turbine ----------
const testi = creaTesti();
let logo = null;
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
    const stretto = innerHeight > innerWidth || innerWidth < 820;
    const dentroSchermo = _proj.z < 1 && x > (stretto ? 40 : innerWidth * 0.42) && x < innerWidth - 40 && y > 150 && y < innerHeight - 40;
    el.classList.toggle('visibile', dentroSchermo);
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
  }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = h > w ? 58 : 36;
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
let campioni = [], ultimoCambio = 0, ultimoAggiornamentoAss = -1;
function fotogramma() {
  requestAnimationFrame(fotogramma);
  const dt = Math.min(0.05, orologio.getDelta());
  stato.tempo += dt;
  const t0 = performance.now();

  // scorrimento filtrato: niente scatti, mai
  const k = 1 - Math.exp(-dt * 4.5);
  stato.p += (stato.pMira - stato.p) * k;
  if (Math.abs(stato.pMira - stato.p) < 0.00005) stato.p = stato.pMira;
  const p = stato.p;

  posaCamera(p);
  const finale = Math.min(1, Math.max(0, (p - 0.86) / 0.14));
  ambiente.aggiorna(stato.tempo, camera, finale);
  macchine.aggiorna(p, stato.tempo, camera);
  testi.aggiorna(p);
  etichetteTurbine(p);
  if (logo) { logo.componi(Math.min(1, p / 0.05 + apertura.k)); logo.posiziona(p, innerWidth, innerHeight); }

  renderer.info.reset();
  renderer.render(scena, camera);

  // misura dei fotogrammi e discesa automatica di qualità
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

// ---------- apertura: il sole d'oro si compone nel logo appena la pagina è pronta ----------
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
    logo = await creaLogo(document.getElementById('logo'), '../logo/ufficiale/logo-eri-originale.svg');
  } catch (e) { stato.errori.push('logo: ' + e.message); }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
  applicaQualita(stato.qualita);
  leggiScroll();
  stato.p = stato.pMira;
  await macchine.pronto;
  fotogramma();
  if (param.get('font') === 'b') document.body.dataset.font = 'b';
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
  // qualche fotogramma e una pausa, perché transizioni e assemblaggio si assestino
  let n = 0; (function f() { if (++n < 4) requestAnimationFrame(f); else setTimeout(ok, 1300); })();
});
stato.info = () => ({
  ms: +stato.ms.toFixed(2), msPeggio: +stato.msPeggio.toFixed(1),
  triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls,
  qualita: stato.qualita, dpr: renderer.getPixelRatio(), p: +stato.p.toFixed(3),
});
stato.azzeraMisure = () => { stato.msPeggio = 0; campioni = []; };
// misura per qualche secondo nel punto in cui si è: ms per fotogramma (media e peggiore) e ms di lavoro del render
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
