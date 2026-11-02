// ERI · Monolite · una notte al museo: sala buia grigio caldo, pavimento di pietra appena riflettente,
// un solo cono di luce calda dall'alto che isola i tracker come sculture. Bozzetto a scorrimento: apertura + fotovoltaico.
// Pannelli e tracker: ../pannello/pannello.js (non si tocca). Meccanica di scorrimento e camera: dalla Galleria Bianca.
import * as THREE from 'three';
import { creaFila, creaAgrivoltaico, materialiPannello } from '../pannello/pannello.js';
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
  alta:  { dpr: telefono ? 1.25 : 1.5,  agri: true,  anisotropia: 8 },
  media: { dpr: telefono ? 1.1 : 1.25,  agri: true,  anisotropia: 4 },
  bassa: { dpr: 1.0,                    agri: false, anisotropia: 1 },
};
const ORDINE = ['alta', 'media', 'bassa'];
stato.qualita = ORDINE.includes(param.get('q')) ? param.get('q') : (telefono ? 'media' : 'alta');
const qualitaForzata = ORDINE.includes(param.get('q'));

// ---------- renderer: tela opaca, il fondo e la nebbia sono della sala ----------
const SALA = new THREE.Color('#1E1B19');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(SALA, 1);
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false;

const scena = new THREE.Scene();
scena.background = SALA;
scena.fog = new THREE.Fog(SALA, 34, 120);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

// ---------- ambiente PMREM: softbox caldi deboli su nero, soffitto scuro ----------
function creaAmbiente() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(160, 90, 160), new THREE.MeshBasicMaterial({ color: '#221e1b', side: THREE.BackSide }));
  stanza.position.y = 30; s.add(stanza);
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: '#2a2521' }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = -1.5; s.add(pav);
  const soff = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: '#0d0c0b' }));
  soff.rotation.x = Math.PI / 2; soff.position.y = 74; s.add(soff);
  const pannello = (w, h, colore, forza, pos, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 2, 0); m.rotateZ(rotZ); s.add(m);
  };
  // softbox grande, caldo e debole, in alto a sinistra davanti: la luce morbida della sala
  pannello(44, 30, '#ffe9d0', 1.25, [-34, 38, 30]);
  // softbox medio dietro a destra: il controluce che disegna i bordi dei metalli
  pannello(26, 18, '#ffdcb8', 0.75, [40, 26, -34]);
  // la lampada: una striscia lunga e stretta, calda, sopra e un po' dietro: il vetro la riflette come una lama
  pannello(120, 5, '#fff1dc', 3.0, [44, 32, -14], 0.4);
  // un rimbalzo basso davanti: schiarisce appena il sotto della tavola
  pannello(60, 10, '#ffe3c2', 0.45, [0, 6, 60]);
  const env = pmrem.fromScene(s, 0.012).texture;
  pmrem.dispose();
  return env;
}
scena.environment = creaAmbiente();

// ---------- materiali del pannello, ritoccati per la sala ----------
const M = materialiPannello();
M.vetro.envMapIntensity = 1.45; M.vetro.fog = false; M.vetro.needsUpdate = true; // additivo: la nebbia lo schiarirebbe
M.cella.envMapIntensity = 0.85;
M.cornice.envMapIntensity = 1.2;
M.retro.color.set('#d9d2c6');

// ---------- UNA sola luce: il cono caldo dall'alto, penombra ampia, senza ombre ----------
// sta davanti e sopra la fila: il suo riflesso sul vetro corre via dalla camera; sul vetro resta la lama della striscia
const spot = new THREE.SpotLight('#FFE9C8', 650, 80, 0.95, 1.0, 2);
spot.position.set(18, 17, 8);
spot.target.position.set(18, 0, -5);
scena.add(spot, spot.target);
// un filo di emisfero: i sotto non sono mai nero puro
scena.add(new THREE.HemisphereLight('#3a332c', '#15120f', 0.5));

// ---------- pavimento di pietra scura, appena riflettente ----------
function texturaPietra() {
  const s = 1024;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#2a2622'; g.fillRect(0, 0, s, s);
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // nuvole di tono: la pietra non è uniforme
  for (let i = 0; i < 420; i++) {
    const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const chiaro = rnd() > 0.5;
    gr.addColorStop(0, chiaro ? 'rgba(62,56,50,0.22)' : 'rgba(22,19,17,0.26)');
    gr.addColorStop(1, 'rgba(42,38,34,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // grana fine
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  // giunti delle lastre: 4 × 4 per tessera, sottili e appena più scuri
  g.strokeStyle = 'rgba(14,12,11,0.55)'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const v = (k * s) / 4 + 0.5; g.beginPath(); g.moveTo(v, 0); g.lineTo(v, s); g.moveTo(0, v); g.lineTo(s, v); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // rugosità: le lastre lucidate riflettono un poco, i giunti no
  const cr = document.createElement('canvas'); cr.width = 256; cr.height = 256;
  const gr = cr.getContext('2d'); gr.fillStyle = '#8a8a8a'; gr.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 50; const v = Math.round(110 + rnd() * 50); gr.fillStyle = `rgba(${v},${v},${v},0.5)`; gr.beginPath(); gr.arc(x, y, r, 0, 7); gr.fill(); }
  gr.strokeStyle = '#ffffff'; gr.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { const v = (k * 256) / 4 + 0.5; gr.beginPath(); gr.moveTo(v, 0); gr.lineTo(v, 256); gr.moveTo(0, v); gr.lineTo(256, v); gr.stroke(); }
  const r = new THREE.CanvasTexture(cr); r.wrapS = r.wrapT = THREE.RepeatWrapping; r.repeat.set(30, 30); r.colorSpace = THREE.NoColorSpace;
  return { map: t, rough: r };
}
const pietra = texturaPietra();
const matPavimento = new THREE.MeshPhysicalMaterial({
  color: '#8f8780', map: pietra.map, roughness: 0.5, roughnessMap: pietra.rough, metalness: 0, envMapIntensity: 0.55,
  specularIntensity: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5,
});
const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), matPavimento);
pavimento.rotation.x = -Math.PI / 2; pavimento.position.set(16, 0, -10); pavimento.renderOrder = -6;
scena.add(pavimento);

// ---------- le sculture: tre tracker in fila, l'agrivoltaico dietro ----------
const fila = creaFila({ tracker: 3, passo: 7, moduli: 28 });
scena.add(fila.gruppo);
const agri = creaAgrivoltaico({ campate: 4, altezza: 4.5 });
agri.gruppo.position.set(12, 0, -27);
scena.add(agri.gruppo);
const T0 = fila.tracker[0];
const deg = THREE.MathUtils.degToRad;
const liscia = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// l'inclinazione segue lo scorrimento: i tracker si voltano piano verso la lampada, senza mai tornare indietro
function aggiornaInclinazione(p) {
  const k = liscia((p - 0.28) / 0.57);
  fila.setInclinazione(deg(14 + 16 * k));
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

// ---------- regia della camera: una sola passeggiata calma davanti alle sculture ----------
// Apertura: la sala da lontano, i tracker bassi in penombra. Poi la camera scivola da sinistra a destra lungo il fronte:
// la fila di tre con l'agrivoltaico dietro (p≈0.45), fino alla vista "eroe" sul capo destro del primo tracker (p≈0.85).
// sx, sy: dove sta il soggetto sullo schermo (frazioni della mezza larghezza e della mezza altezza).
const DESKTOP = [
  { p: 0.00, pos: [-2, 5.2, 44], mira: [16, 0.6, -8], sx: 0.0, sy: -0.42 },
  { p: 0.25, pos: [-7, 5.8, 32], mira: [16, 0.5, -8], sx: 0.0, sy: -0.32 },
  { p: 0.45, pos: [-10, 6.4, 22], mira: [16, 0.4, -8], sx: 0.04, sy: -0.22 },
  { p: 0.65, pos: [14, 4.4, 15], mira: [22, 1.0, -4], sx: 0.06, sy: -0.2 },
  { p: 0.85, pos: [38.5, 2.5, 6.0], mira: [26, 1.5, -0.6], sx: 0.1, sy: -0.22 },
  { p: 1.00, pos: [39.5, 2.4, 5.6], mira: [26, 1.5, -0.8], sx: 0.1, sy: -0.22 },
];
// Telefono: i testi stanno in alto, la scena nella metà bassa: la camera arretra e guarda di tre quarti lungo la fila.
const TELEFONO = [
  { p: 0.00, pos: [-6, 6, 46], mira: [16, 0.6, -8], sx: 0, sy: -0.5 },
  { p: 0.25, pos: [-14, 6.5, 30], mira: [14, 0.4, -7], sx: 0, sy: -0.5 },
  { p: 0.50, pos: [-18, 5.5, 18], mira: [12, 0.6, -6], sx: 0, sy: -0.5 },
  { p: 0.75, pos: [20, 4.2, 14], mira: [24, 1.0, -3], sx: 0, sy: -0.5 },
  { p: 1.00, pos: [38, 2.8, 7], mira: [26, 1.4, -0.6], sx: 0, sy: -0.5 },
];
const chiave = (k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira), sx: k.sx ?? 0, sy: k.sy ?? -0.2 });
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
  if (stato.prova) { // posa forzata, solo per le prove di inquadratura
    const q = stato.prova; _a.set(...q.pos); _b.set(...q.mira);
    inquadra(_a, _b, q.sx ?? 0, q.sy ?? -0.2); return;
  }
  const CHIAVI = stretto() ? CHIAVI_TEL : CHIAVI_DESK;
  let i = 0;
  while (i < CHIAVI.length - 2 && p > CHIAVI[i + 1].p) i++;
  const k0 = CHIAVI[Math.max(0, i - 1)], k1 = CHIAVI[i], k2 = CHIAVI[i + 1], k3 = CHIAVI[Math.min(CHIAVI.length - 1, i + 2)];
  const s = Math.min(1, Math.max(0, (p - k1.p) / (k2.p - k1.p)));
  const e = s * s * (3 - 2 * s);
  catmull(_a, k0.pos, k1.pos, k2.pos, k3.pos, e);
  catmull(_b, k0.mira, k1.mira, k2.mira, k3.mira, e);
  _a.y += Math.sin(stato.tempo * 0.35) * 0.02; // respiro impercettibile
  inquadra(_a, _b, k1.sx + (k2.sx - k1.sx) * e, k1.sy + (k2.sy - k1.sy) * e);
}
function inquadra(pos, mira, sx, sy) {
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

// ---------- testi: due momenti; l'iter si accende in modo continuo con lo scorrimento ----------
const NOMI_FASI = ['Sviluppo', 'Autorizzazioni', 'Ready to Build', 'Costruzione', 'Gestione'];
const NUMERI = ['I', 'II', 'III', 'IV', 'V'];
const DESCR_FASI = [
  'terreno, studio e progetto.',
  'permessi e connessione alla rete.',
  'progetto esecutivo, pronto per il cantiere.',
  'cantiere, montaggio e collaudo, fino alla connessione.',
  'esercizio e manutenzione, per tutta la vita dell\'impianto.',
];
const FV = { da: 0.30, a: 1.0 };
const sezioni = [...document.querySelectorAll('.momento')];
const iterLi = [...document.querySelectorAll('.iter li')];
const iterRiga = document.querySelector('.iter .riga');
const iterOl = document.querySelector('.iter ol');
const iterNota = document.querySelector('.iter .nota');
const telRiga = document.querySelector('.iter-tel .riga');
const telPunti = [...document.querySelectorAll('.iter-tel b')];
const telParola = document.querySelector('.iter-tel .parola');
let momentoAttivo = -1, faseAttiva = -1;
function aggiornaTesti(p) {
  const idx = p < 0.27 ? 0 : 1;
  if (idx !== momentoAttivo) {
    sezioni.forEach((s) => s.classList.toggle('attivo', +s.dataset.m === idx));
    document.body.dataset.momento = idx;
    momentoAttivo = idx;
  }
  // la riga d'ottone cresce con p a ogni fotogramma (nessuna transition sulla lunghezza, nessun reset)
  const a = Math.min(1, Math.max(0, (p - FV.da) / (FV.a - FV.da)));
  const k = Math.min(4, Math.floor(a * 5));
  const alto = iterOl.offsetHeight + 52;
  iterRiga.style.height = (a * alto).toFixed(1) + 'px';
  telRiga.style.width = (a * 100).toFixed(2) + '%';
  if (k !== faseAttiva) {
    faseAttiva = k;
    iterLi.forEach((el, i) => { el.classList.toggle('on', i === k); el.classList.toggle('passato', i < k); });
    telPunti.forEach((el, i) => { el.classList.toggle('on', i === k); el.classList.toggle('passato', i < k); });
    iterNota.innerHTML = `<b>${NOMI_FASI[k]}</b> · ${DESCR_FASI[k]}`;
    telParola.innerHTML = `<span>${NUMERI[k]}</span><b>${NOMI_FASI[k]}</b>`;
  }
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // su desktop il campo ORIZZONTALE è costante (quello composto a 1600×992, fov verticale 30°)
  camera.fov = stretto() ? 50 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * 1.613 / camera.aspect)), 24, 40);
  camera.updateProjectionMatrix();
}
addEventListener('resize', ridimensiona);

function applicaQualita(q) {
  stato.qualita = q;
  const L = LIVELLI[q];
  agri.gruppo.visible = L.agri;
  for (const t of [M.cella.map, pietra.map]) { if (t && t.anisotropy !== L.anisotropia) { t.anisotropy = L.anisotropia; t.needsUpdate = true; } }
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
  aggiornaInclinazione(p);
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
  posaCamera(stato.p); aggiornaInclinazione(stato.p);
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
stato.qualitaImposta = (q) => applicaQualita(q);
// posa forzata per le prove di inquadratura: { pos, mira, sx, sy } oppure null per tornare alle chiavi
stato.posa = (q) => new Promise((ok) => { stato.prova = q; let n = 0; (function f() { if (++n < 4) requestAnimationFrame(f); else setTimeout(ok, 600); })(); });
stato.spot = spot; stato.scena = scena; stato.fila = fila; stato.agri = agri; stato.renderer = renderer;
