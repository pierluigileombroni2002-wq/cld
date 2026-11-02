// Studio fotografico neutro per il pannello: fondo sfumato (CSS), ciclorama che sfuma, ambiente PMREM
// con softbox e una striscia, una luce di riempimento morbida. Niente testi: solo i pannelli.
// ?luce=nero|bianco|dorata · window.__eri = { pronto, vai(posa), info(), errori }
import * as THREE from 'three';
import { creaFila, creaAgrivoltaico, materialiPannello } from './pannello.js';

const param = new URLSearchParams(location.search);
const LUCI = {
  nero: {
    stanza: '#26282c', soffitto: '#111214', pavEnv: '#3c3e43', pavimento: ['#2a2b2f', '#131417'],
    box1: ['#eef2ff', 1.3], box2: ['#e3e9f7', 0.8], striscia: ['#ffffff', 3.2], taglio: null,
    fill: ['#dde5f5', 0.35], emisfero: ['#3a3d45', '#2a2c30', 0.35], esposizione: 1.15,
  },
  bianco: {
    stanza: '#e9e5dc', soffitto: '#5a5955', pavEnv: '#d6d1c6', pavimento: ['#ebe8e1', '#e2ded5'],
    box1: ['#ffffff', 1.4], box2: ['#fff8ec', 0.9], striscia: ['#ffffff', 2.4], taglio: null,
    fill: ['#fff6e8', 0.5], emisfero: ['#ffffff', '#d3cec3', 0.4], esposizione: 1.0,
  },
  dorata: {
    stanza: '#2c2219', soffitto: '#140e0a', pavEnv: '#3a2d22', pavimento: ['#2f251c', '#17110c'],
    box1: ['#ffe3c2', 1.3], box2: ['#ffd3a2', 0.85], striscia: ['#fff3e0', 3.0], taglio: ['#ffb04a', 2.8],
    fill: ['#ffd9b3', 0.35], emisfero: ['#4a3626', '#2a1f16', 0.35], esposizione: 1.15,
  },
};
const luce = LUCI[param.get('luce')] ? param.get('luce') : 'nero';
const L = LUCI[luce];
document.body.dataset.luce = luce;

const stato = { pronto: false, errori: [], posa: null, luce };
window.__eri = stato;
window.addEventListener('error', (e) => stato.errori.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => stato.errori.push('promessa: ' + String(e.reason && e.reason.message || e.reason)));
stato.moduli = () => ({});

// ---------- renderer ----------
const tela = document.getElementById('scena');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = L.esposizione;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 600);

// ---------- ambiente PMREM: una sala scura con softbox grandi e una striscia stretta ----------
function creaAmbiente() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(160, 90, 160), new THREE.MeshBasicMaterial({ color: L.stanza, side: THREE.BackSide }));
  stanza.position.y = 30; s.add(stanza);
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: L.pavEnv }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = -1.5; s.add(pav);
  // soffitto scuro: è quello che il vetro inclinato riflette agli angoli radenti, così resta vetro e non lenzuolo
  const soff = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: L.soffitto }));
  soff.rotation.x = Math.PI / 2; soff.position.y = 74; s.add(soff);
  const pannello = (w, h, [colore, forza], pos, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 2, 0); m.rotateZ(rotZ); s.add(m);
    return m;
  };
  // softbox grande, in alto a sinistra davanti: la luce principale, larga e morbida
  pannello(44, 30, L.box1, [-34, 38, 30]);
  // softbox medio, dietro a destra: il controluce che disegna i bordi dei metalli
  pannello(26, 18, L.box2, [40, 26, -34]);
  // la striscia: lunga e stretta, sopra e un po' dietro, inclinata: il vetro la riflette come una lama bianca
  pannello(120, 5, L.striscia, [46, 30, -16], 0.4);
  // un pannello di rimbalzo basso davanti: schiarisce il sotto della tavola (retro bianco, tubo, cuscinetti)
  pannello(60, 10, [L.box2[0], L.box2[1] * 0.5], [0, 6, 60]);
  // luce di taglio ambra (solo dorata): bassa, da sinistra dietro
  if (L.taglio) pannello(7, 40, L.taglio, [-48, 14, -36]);
  const env = pmrem.fromScene(s, 0.012).texture;
  pmrem.dispose();
  return env;
}
scena.environment = creaAmbiente();

// luci: un riempimento direzionale morbido, un emisfero tenue; niente ombre
const fill = new THREE.DirectionalLight(L.fill[0], L.fill[1]); fill.position.set(-30, 40, 35); scena.add(fill);
const controluce = new THREE.DirectionalLight(L.box2[0], L.fill[1] * 0.6); controluce.position.set(40, 26, -34); scena.add(controluce);
// un richiamo basso da dietro: disegna il sotto della tavola nella posa "retro"
const richiamo = new THREE.DirectionalLight(L.box1[0], L.fill[1] * 0.8); richiamo.position.set(10, 6, -40); scena.add(richiamo);
scena.add(new THREE.HemisphereLight(L.emisfero[0], L.emisfero[1], L.emisfero[2]));

// ---------- ciclorama: pavimento che sfuma nel fondo del CSS ----------
const vert = /* glsl */`
  varying vec3 vPos;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const frag = /* glsl */`
  varying vec3 vPos; uniform vec3 cVicino, cLontano; uniform vec3 posCam; uniform float raggio;
  void main() {
    float d = length(posCam.xz - vPos.xz);
    float dc = length(vPos.xz - vec2(14.0, -8.0));
    vec3 c = mix(cVicino, cLontano, smoothstep(0.0, raggio, dc));
    float grana = fract(sin(dot(floor(vPos.xz * 400.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.005 - 0.0025;
    c += grana;
    float alpha = 1.0 - smoothstep(raggio * 0.9, raggio * 2.2, dc);
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }`;
const uPav = { cVicino: { value: new THREE.Color(L.pavimento[0]) }, cLontano: { value: new THREE.Color(L.pavimento[1]) }, posCam: { value: new THREE.Vector3() }, raggio: { value: 40 } };
const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShaderMaterial({ uniforms: uPav, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false }));
pavimento.rotation.x = -Math.PI / 2; pavimento.renderOrder = -5; pavimento.frustumCulled = false;
scena.add(pavimento);

// ---------- i pannelli ----------
const fila = creaFila({ tracker: 3, passo: 7, moduli: 28 });
scena.add(fila.gruppo);
const agri = creaAgrivoltaico({ campate: 4, altezza: 4.5 });
agri.gruppo.position.set(0, 0, -27);
scena.add(agri.gruppo);
const T0 = fila.tracker[0];

// ---------- pose ----------
const deg = THREE.MathUtils.degToRad;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POSE = {
  eroe: () => {
    fila.setInclinazione(deg(25)); agri.gruppo.visible = true;
    return { pos: V(-5.2, 2.7, 7.2), mira: V(7.0, 1.55, -0.6), fov: 35 };
  },
  dettaglio: () => {
    fila.setInclinazione(deg(10)); agri.gruppo.visible = true;
    T0.tavola.updateMatrixWorld(true);
    // l'angolo del primo modulo: cornice, vetro, celle e il morsetto d'estremità con il suo bullone
    const mira = T0.tavola.localToWorld(V(T0.x0 + 0.16, T0.yTopMod, T0.zMod + 0.86));
    const pos = T0.tavola.localToWorld(V(T0.x0 - 0.62, T0.yTopMod + 0.5, T0.zMod + 1.72));
    return { pos, mira, fov: 30, near: 0.02 };
  },
  fila: () => {
    fila.setInclinazione(deg(25)); agri.gruppo.visible = true;
    return { pos: V(-8.5, 5.8, 17.5), mira: V(16, 1.0, -9.5), fov: 31 };
  },
  retro: () => {
    fila.setInclinazione(deg(30)); agri.gruppo.visible = true;
    const xM = T0.xPali[Math.floor(T0.xPali.length / 2)];
    // nel corridoio fra il primo e il secondo tracker, bassi, guardando sotto la tavola verso il motore
    return { pos: V(xM + 5.5, 0.85, -3.7), mira: V(xM - 1.2, 1.6, -0.1), fov: 38 };
  },
};

function applica(p) {
  camera.position.copy(p.pos);
  camera.near = p.near || 0.05;
  camera.fov = p.fov || 32;
  camera.lookAt(p.mira);
  camera.updateProjectionMatrix();
}

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', ridimensiona);
ridimensiona();

let misure = { triangoli: 0, chiamate: 0 };
function render() {
  uPav.posCam.value.copy(camera.position);
  renderer.render(scena, camera);
  misure = { triangoli: renderer.info.render.triangles, chiamate: renderer.info.render.calls };
}
function anima() { requestAnimationFrame(anima); render(); }

stato.vai = (posa) => new Promise((ok) => {
  const f = POSE[posa] || POSE.eroe;
  stato.posa = posa;
  applica(f());
  render();
  setTimeout(() => { render(); requestAnimationFrame(() => { render(); ok(); }); }, 350);
});
stato.info = () => ({ posa: stato.posa, luce, ...misure, errori: stato.errori.length });

// primo fotogramma: compila gli shader e carica le texture prima di dichiararsi pronti
applica(POSE.eroe());
renderer.compile(scena, camera);
render();
requestAnimationFrame(() => { render(); stato.pronto = true; anima(); });
