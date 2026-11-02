// ERI · Verde Profondo · bozzetto 3D a scorrimento: apertura e fotovoltaico.
// Velluto verde bosco (CSS sotto la tela trasparente), pavimento verde levigato dipinto in uno shader,
// una sola luce calda e bassa da destra (DirectionalLight + softbox ambra nel PMREM), il resto in penombra verde.
// I pannelli sono quelli di ../pannello/pannello.js (non modificati: solo i materiali ritoccati via materialiPannello()).
// window.__eri = { pronto, vai(p), info() → { triangoli, chiamate, ms }, errori: [] } · ?q=alta|media|bassa
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
  alta:  { dpr: telefono ? 1.25 : 1.5,  agri: true,  aniso: 8 },
  media: { dpr: telefono ? 1.1 : 1.25,  agri: true,  aniso: 4 },
  bassa: { dpr: 1.0,                    agri: false, aniso: 2 },
};
const ORDINE = ['alta', 'media', 'bassa'];
stato.qualita = ORDINE.includes(param.get('q')) ? param.get('q') : (telefono ? 'media' : 'alta');
const qualitaForzata = ORDINE.includes(param.get('q'));

// ---------- renderer: tela trasparente, il velluto verde è il CSS sotto ----------
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false;

const scena = new THREE.Scene();
// la penombra verde inghiotte ciò che è lontano (il vetro additivo non la prende: vedi materiali)
scena.fog = new THREE.Fog(0x113329, 26, 92);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);

// ---------- ambiente PMREM: una sala di velluto verde con un solo softbox ambra, grande e basso, a destra ----------
function creaAmbiente() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(200, 100, 200), new THREE.MeshBasicMaterial({ color: '#0f2f27', side: THREE.BackSide }));
  stanza.position.y = 34; s.add(stanza);
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#0a2119' }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = -1.5; s.add(pav);
  // soffitto molto scuro: il vetro inclinato lo riflette agli angoli radenti e resta vetro nero, non un lenzuolo
  const soff = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#06150f' }));
  soff.rotation.x = Math.PI / 2; soff.position.y = 82; s.add(soff);
  const pannello = (w, h, colore, forza, pos, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 2, 0); m.rotateZ(rotZ); s.add(m);
    return m;
  };
  // il softbox ambra: a destra, basso e lungo, è la sola luce vera della sala; il vetro lo riflette come un bordo caldo
  pannello(70, 34, '#ffb46e', 1.7, [64, 24, -4]);
  // una lama più stretta e più calda sopra il softbox: la striscia di luce sul vetro inclinato
  pannello(110, 4.5, '#ffe6c4', 2.8, [60, 44, -12], 0.32);
  // il rimbalzo del pavimento caldo davanti ai tracker: schiarisce appena il sotto della tavola e i pali
  pannello(80, 9, '#d98a52', 0.35, [10, 4, 70]);
  // un soffio freddo, verde, da sinistra in alto: la penombra ha una forma, i metalli non spariscono
  pannello(36, 28, '#8fc4ad', 0.16, [-60, 36, 24]);
  const env = pmrem.fromScene(s, 0.012).texture;
  pmrem.dispose();
  return env;
}
scena.environment = creaAmbiente();

// ---------- luci: una sola luce calda, bassa, da destra; il resto è penombra verde ----------
const calda = new THREE.DirectionalLight('#f5a262', 1.7); calda.position.set(44, 11, 30); scena.add(calda);
const emisfero = new THREE.HemisphereLight('#1f5040', '#061a14', 0.6); scena.add(emisfero);
const freddo = new THREE.DirectionalLight('#5f9e87', 0.22); freddo.position.set(-30, 22, -28); scena.add(freddo);

// ---------- materiali dei pannelli: solo ritocchi, via materialiPannello() ----------
const M = materialiPannello();
M.vetro.envMapIntensity = 1.75;
M.vetro.fog = false; M.vetro.needsUpdate = true;     // additivo: la nebbia lo farebbe brillare
M.cella.envMapIntensity = 0.75;
M.cornice.envMapIntensity = 1.35;
M.zincato.envMapIntensity = 1.3;
M.inox.envMapIntensity = 1.3;
M.retro.color.set('#d8d0c0');

// ---------- il pavimento: verde scuro levigato, dipinto (riflesso morbido della luce calda, grana, dissolvenza lontano) ----------
const vert = /* glsl */`
  varying vec3 vPos;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const frag = /* glsl */`
  varying vec3 vPos;
  uniform vec3 cVicino, cLontano, cLuce, posCam, dirLuce; uniform float raggio;
  void main() {
    float dc = length(vPos.xz - vec2(14.0, -10.0));
    vec3 c = mix(cVicino, cLontano, smoothstep(0.0, raggio, dc));
    // il riflesso morbido della luce calda sul pavimento levigato: un lobo largo, verso destra
    vec3 v = normalize(posCam - vPos);
    vec3 h = normalize(v + dirLuce);
    float s = pow(max(h.y, 0.0), 10.0);
    float fres = pow(1.0 - max(v.y, 0.0), 2.0);
    c += cLuce * s * (0.22 + 0.5 * fres);
    // una lama di luce lunga sul pavimento, da destra (la lama del softbox riflessa)
    float lama = exp(-pow((vPos.z + 0.35 * vPos.x - 4.0) / 9.0, 2.0)) * smoothstep(-6.0, 30.0, vPos.x);
    c += cLuce * lama * 0.10 * (0.4 + fres);
    float grana = fract(sin(dot(floor(vPos.xz * 400.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.006 - 0.003;
    c += grana;
    float alpha = 1.0 - smoothstep(raggio * 0.8, raggio * 2.0, dc);
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }`;
const uPav = {
  cVicino: { value: new THREE.Color('#0a2119') }, cLontano: { value: new THREE.Color('#123529') },
  cLuce: { value: new THREE.Color('#e8742a').multiplyScalar(0.55) },
  posCam: { value: new THREE.Vector3() }, dirLuce: { value: calda.position.clone().normalize() }, raggio: { value: 42 },
};
const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShaderMaterial({ uniforms: uPav, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false }));
pavimento.rotation.x = -Math.PI / 2; pavimento.renderOrder = -6; pavimento.frustumCulled = false;
scena.add(pavimento);

// ---------- i pannelli: tre tracker e, dietro, la fila agrivoltaica rialzata ----------
const fila = creaFila({ tracker: 3, passo: 7, moduli: 28 });
scena.add(fila.gruppo);
const agri = creaAgrivoltaico({ campate: 4, altezza: 4.5 });
agri.gruppo.position.set(0, 0, -27);
scena.add(agri.gruppo);
const deg = THREE.MathUtils.degToRad;

// ---------- regia della camera: due momenti, un solo movimento calmo ----------
// Apertura: la fila lontana, in penombra, sotto il logo. Fotovoltaico: la camera scende e scivola lungo la fila fino
// all'inquadratura "eroe", vicina a un tracker. Chiavi Catmull-Rom; le chiavi doppie fermano la curva.
// sx, sy: dove sta il soggetto sullo schermo (frazioni della mezza larghezza e della mezza altezza).
const DESKTOP = [
  { p: 0.00, pos: [-34, 11, 44], mira: [14, 0.5, -8], sx: 0.46, sy: -0.66 },
  { p: 0.20, pos: [-32, 10.6, 42], mira: [14, 0.5, -8], sx: 0.46, sy: -0.66 },
  { p: 0.45, pos: [-14, 9, 24], mira: [16, 0.5, -9.5], sx: 0.32, sy: 0.15 },
  { p: 0.85, pos: [-5, 2.4, 8], mira: [9, 1.7, -2], sx: 0.45, sy: 0.25 },
  { p: 1.00, pos: [-4.7, 2.35, 7.6], mira: [9, 1.7, -2], sx: 0.45, sy: 0.25 },
];
const TELEFONO = [
  { p: 0.00, pos: [-34, 11, 44], mira: [14, 0.5, -8], sx: 0.0, sy: -0.62, arretra: 1.15 },
  { p: 0.20, pos: [-32, 10.6, 42], mira: [14, 0.5, -8], sx: 0.0, sy: -0.62, arretra: 1.15 },
  { p: 0.45, pos: [-9, 6.5, 14], mira: [12, 1.2, -4], sx: 0.0, sy: -0.55, arretra: 1.0 },
  { p: 0.85, pos: [-5, 2.4, 8], mira: [9, 1.7, -2], sx: 0.1, sy: -0.5, arretra: 1.2 },
  { p: 1.00, pos: [-4.7, 2.35, 7.6], mira: [9, 1.7, -2], sx: 0.1, sy: -0.5, arretra: 1.2 },
];
const chiave = (k) => ({ p: k.p, pos: new THREE.Vector3(...k.pos), mira: new THREE.Vector3(...k.mira), sx: k.sx ?? 0, sy: k.sy ?? 0, arretra: k.arretra ?? 1 });
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
    inquadra(_a, _b, q.sx ?? 0, q.sy ?? 0, q.arretra ?? 1); return;
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
  inquadra(_a, _b, k1.sx + (k2.sx - k1.sx) * e, k1.sy + (k2.sy - k1.sy) * e, k1.arretra + (k2.arretra - k1.arretra) * e);
}
function inquadra(pos, mira, sx, sy, arretra) {
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

// ---------- testi e iter ----------
const MOM_FV = { da: 0.30, a: 1.0 };
const NOMI = ['Sviluppo', 'Autorizzazioni', 'Ready to Build', 'Costruzione', 'Gestione'];
const sezioni = [...document.querySelectorAll('.momento')];
const passi = [...document.querySelectorAll('.iter .passo')];
const accesa = document.querySelector('.iter-accesa');
const punto = document.querySelector('.iter-punto');
const corrente = document.querySelector('.iter-corrente');
// tacche per l'iter compatto del telefono
{
  const tacche = document.createElement('div'); tacche.className = 'iter-tacche';
  for (let i = 0; i < 5; i++) { const t = document.createElement('i'); t.className = 'iter-tacca'; t.style.left = `${i * 25}%`; tacche.appendChild(t); }
  document.querySelector('.iter').appendChild(tacche);
}
let momentoAttivo = 0, passoAttivo = -1, larghezzaUltima = -1;
function aggiornaTesti(p) {
  const idx = p < 0.26 ? 0 : 1;
  if (idx !== momentoAttivo) {
    sezioni.forEach((s) => s.classList.toggle('attivo', +s.dataset.m === idx));
    document.body.dataset.momento = idx;
    momentoAttivo = idx;
  }
  // l'iter si accende in modo continuo con lo scorrimento del momento: la riga accesa cresce a ogni fotogramma
  const a = Math.min(1, Math.max(0, (p - MOM_FV.da) / (MOM_FV.a - MOM_FV.da)));
  const w = +(a * 100).toFixed(2);
  if (w !== larghezzaUltima) {
    accesa.style.width = `${w}%`;
    punto.style.left = `${w}%`;
    larghezzaUltima = w;
  }
  const k = Math.min(4, Math.floor(a * 5 + 0.0001));
  if (k !== passoAttivo) {
    passi.forEach((el, i) => { el.classList.toggle('acceso', i < k); el.classList.toggle('corrente', i === k); });
    corrente.innerHTML = `<b>0${k + 1}</b><span>${NOMI[k]}</span>`;
    passoAttivo = k;
  }
}

// i tracker seguono il sole: si inclinano piano verso la luce (a destra, +z) con lo scorrimento del momento
function aggiornaTracker(p) {
  const a = Math.min(1, Math.max(0, (p - 0.26) / 0.74));
  const e = a * a * (3 - 2 * a);
  fila.setInclinazione(deg(5 + 19 * e));
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LIVELLI[stato.qualita].dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // su desktop il campo orizzontale resta quello composto a 1600×992 (fov verticale 32°): finestre più basse non allargano la fila
  camera.fov = stretto() ? 52 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(16)) * 1.613 / camera.aspect)), 26, 40);
  camera.updateProjectionMatrix();
}
addEventListener('resize', ridimensiona);
function applicaQualita(q) {
  stato.qualita = q;
  agri.gruppo.visible = LIVELLI[q].agri;
  ridimensiona();
}

// ---------- ciclo ----------
const orologio = new THREE.Clock();
let campioni = [], ultimoCambio = 0;
let logo = null;
const apertura = { k: 0 };
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
  aggiornaTracker(p);
  aggiornaTesti(p);
  if (logo) { logo.componi(Math.min(1, p / 0.05 + apertura.k)); logo.posiziona(p, innerWidth, innerHeight); }
  uPav.posCam.value.copy(camera.position);

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
  posaCamera(stato.p); aggiornaTracker(stato.p);
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
  let n = 0; (function f() { if (++n < 4) requestAnimationFrame(f); else setTimeout(ok, 1400); })();
});
stato.info = () => ({
  ms: +stato.ms.toFixed(2), msPeggio: +stato.msPeggio.toFixed(1),
  triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls,
  qualita: stato.qualita, dpr: renderer.getPixelRatio(), p: +stato.p.toFixed(3),
  cam: camera.position.toArray().map((v) => +v.toFixed(2)), fov: +camera.fov.toFixed(1), aspect: +camera.aspect.toFixed(3), stretto: stretto(),
});
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
