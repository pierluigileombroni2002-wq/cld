/* =========================================================
   ERI · scena 3D guidata dallo scroll
   ---------------------------------------------------------
   Idea: un unico territorio 3D. Scorrendo la pagina:
   0 panoramica → 1 particelle catastali → 2 vincoli e aree idonee
   → 3 iter autorizzativo → 4 Ready to Build (fotovoltaico e agrivoltaico su tracker)
   → 5 eolico → 6 idroelettrico (Kaplan, Francis, Pelton) → 7 panoramica finale.

   Le parti:
   1. Impostazioni (PC o telefono, "riduci movimento")
   2. Renderer, scena, camera, luci
   3. Il terreno (forma + colori disegnati da uno "shader")
   4. Gli impianti (tracker fotovoltaici e agrivoltaici, pale eoliche, turbine idrauliche)
   5. Lo scroll: GSAP + ScrollTrigger muovono camera e colori
   6. Il ciclo di disegno (60 volte al secondo)
   ========================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   1. IMPOSTAZIONI
   --------------------------------------------------------- */
const leggero = matchMedia('(max-width: 900px)').matches;               // telefono/tablet: versione leggera
const riduci = matchMedia('(prefers-reduced-motion: reduce)').matches; // l'utente vuole meno movimento

const Q = {
  segmenti: leggero ? 140 : 280,                       // dettaglio del terreno
  pixel: Math.min(devicePixelRatio, leggero ? 1.5 : 2), // nitidezza
  bagliore: !leggero,                                   // effetto "bloom" solo su PC
};

/* Palette (uguale a style.css) */
const C = {
  nero: new THREE.Color('#050607'),
  base: new THREE.Color('#1b2024'),
  oro: new THREE.Color('#d8b878'),
  platino: new THREE.Color('#c9d0d4'),
  smeraldo: new THREE.Color('#36c39a'),
  rosso: new THREE.Color('#e0644f'),
  acqua: new THREE.Color('#8fb7c9'),
};

/* ---------------------------------------------------------
   2. RENDERER, SCENA, CAMERA, LUCI
   - Scena: il "palcoscenico" che contiene tutti gli oggetti.
   - Camera: il nostro occhio. Ha una posizione e un punto che guarda.
   - Renderer: il motore che trasforma la scena in un'immagine.
   --------------------------------------------------------- */
const tela = document.querySelector('#scena');
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixel);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // colori più cinematografici

const scena = new THREE.Scene();
scena.background = C.nero;

// Camera prospettica: 38° di campo visivo, vede da 0,1 a 600 unità di distanza
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 600);

// Riflessi: una "stanza" virtuale che i metalli riflettono (niente immagini da scaricare)
const pmrem = new THREE.PMREMGenerator(renderer);
scena.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

// Luci: un "sole" basso e caldo + una luce d'ambiente fredda e debole
const sole = new THREE.DirectionalLight('#ffd9a0', 1.6);
sole.position.set(-60, 40, -30);
scena.add(sole);
scena.add(new THREE.HemisphereLight('#9fb4c4', '#050607', 0.35));

/* ---------------------------------------------------------
   3. IL TERRENO
   --------------------------------------------------------- */

// --- Rumore: numeri "casuali ma morbidi" per creare colline naturali
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function rumore(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y) { // più strati di rumore sovrapposti = dettaglio
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { t += amp * rumore(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return t;
}
const morbido = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// --- Luoghi della storia
const SITO = new THREE.Vector2(8, 12);       // il terreno del fotovoltaico
const AGRI = new THREE.Vector2(58, 30);      // il campo agrivoltaico
const PROTETTA = new THREE.Vector2(-68, 8);  // area con vincolo paesaggistico
const fiumeX = z => -35 + 14 * Math.sin(z * 0.035) + 6 * Math.sin(z * 0.09); // percorso del fiume

// --- Altezza del terreno in ogni punto (x, z)
function altezza(x, z) {
  let h = fbm(x * 0.016, z * 0.016) * 13;
  h += 20 * Math.exp(-((z + 72) ** 2) / 260) * (0.7 + 0.3 * fbm(x * 0.03, 4)); // crinale in fondo
  const dF = Math.abs(x - fiumeX(z));
  h -= 6 * Math.exp(-(dF * dF) / 70);                                            // valle del fiume
  const piana = (p, r) => 1 - morbido(r * 0.55, r, Math.hypot(x - p.x, z - p.y));
  h = h + (1.5 - h) * piana(SITO, 30);                                            // terreno spianato (quota scelta fuori dalle curve di livello)
  h = h + (0.9 - h) * piana(AGRI, 26);
  return h;
}

// --- Geometria: un piano suddiviso in tanti quadratini, poi "sollevato"
const LATO = 240;
const geoTerreno = new THREE.PlaneGeometry(LATO, LATO, Q.segmenti, Q.segmenti);
geoTerreno.rotateX(-Math.PI / 2);
{
  const p = geoTerreno.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, altezza(p.getX(i), p.getZ(i)));
  geoTerreno.computeVertexNormals();
}

// --- Particelle catastali: una griglia ruotata di celle da 7 unità.
// Per ogni cella decidiamo lo stato e lo scriviamo in una piccola immagine
// (una "texture") che lo shader legge per colorare il terreno.
const N = 40, CELLA = 7, ANGOLO = 0.22;
const cosA = Math.cos(ANGOLO), sinA = Math.sin(ANGOLO);
const versoGriglia = (x, z) => [(cosA * x - sinA * z) / CELLA + N / 2, (sinA * x + cosA * z) / CELLA + N / 2];
const versoMondo = (gx, gy) => { const X = (gx - N / 2) * CELLA, Y = (gy - N / 2) * CELLA; return [cosA * X + sinA * Y, -sinA * X + cosA * Y]; };

const stati = new Uint8Array(N * N * 4); // r = idonea, g = vincolata, b = fotovoltaico, a = agrivoltaico
const cellaDi = (x, z) => { const [gx, gy] = versoGriglia(x, z); return [Math.floor(gx), Math.floor(gy)]; };
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const [x, z] = versoMondo(i + 0.5, j + 0.5);
  const h = altezza(x, z);
  const pend = Math.hypot(altezza(x + 1, z) - h, altezza(x, z + 1) - h);
  const fiume = Math.abs(x - fiumeX(z)) < 9;
  const protetta = Math.hypot(x - PROTETTA.x, z - PROTETTA.y) < 24;
  const vSito = Math.hypot(x - SITO.x, z - SITO.y), vAgri = Math.hypot(x - AGRI.x, z - AGRI.y);
  const vincolo = fiume || protetta || pend > 0.55 || h > 14;
  const k = (j * N + i) * 4;
  stati[k + 1] = vincolo ? 255 : 0;
  stati[k] = !vincolo && hash(i, j) > 0.3 ? 255 : 0;
  stati[k + 2] = vSito < 15 && hash(i * 3, j) > 0.12 ? 255 : 0;
  stati[k + 3] = vAgri < 13 ? 255 : 0;
  if (stati[k + 2] || stati[k + 3]) { stati[k] = 255; stati[k + 1] = 0; }
}
const texStati = new THREE.DataTexture(stati, N, N, THREE.RGBAFormat);
texStati.magFilter = texStati.minFilter = THREE.NearestFilter;
texStati.needsUpdate = true;
const statoCella = (x, z, canale) => { const [i, j] = cellaDi(x, z); return i >= 0 && j >= 0 && i < N && j < N && stati[(j * N + i) * 4 + canale] > 0; };

// --- Materiale del terreno: uno "shader" è un piccolo programma che gira
// sulla scheda grafica e decide il colore di ogni pixel.
// Qui disegna: rilievo, curve di livello, griglia catastale, vincoli, fiume.
const U = {
  uTempo: { value: 0 },
  uIsoipse: { value: 0.9 },     // curve di livello
  uGriglia: { value: 0 },       // particelle catastali
  uRaggio: { value: 0 },        // fin dove si vede la griglia (si allarga dal sito)
  uIdonee: { value: 0 },
  uVincoli: { value: 0 },
  uSelez: { value: 0 },         // particelle del progetto in oro
  uAgriSel: { value: 0 },
  uAcqua: { value: 0.3 },
  uStati: { value: texStati },
  uN: { value: N }, uCella: { value: CELLA }, uAngolo: { value: ANGOLO },
  uSito: { value: SITO },
  uLuce: { value: new THREE.Vector3(-0.6, 0.55, -0.3).normalize() },
  uBase: { value: C.base }, uOro: { value: C.oro }, uPlatino: { value: C.platino },
  uSmeraldo: { value: C.smeraldo }, uRosso: { value: C.rosso }, uAcquaCol: { value: C.acqua },
  uNebbia: { value: C.nero }, uDensita: { value: 0.0042 },
};

const matTerreno = new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: /* glsl */`
    varying vec3 vPos; varying vec3 vNorm; varying float vDist;
    void main() {
      vPos = position; vNorm = normal;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTempo, uIsoipse, uGriglia, uRaggio, uIdonee, uVincoli, uSelez, uAgriSel, uAcqua;
    uniform float uN, uCella, uAngolo, uDensita;
    uniform sampler2D uStati; uniform vec2 uSito; uniform vec3 uLuce;
    uniform vec3 uBase, uOro, uPlatino, uSmeraldo, uRosso, uAcquaCol, uNebbia;
    varying vec3 vPos; varying vec3 vNorm; varying float vDist;

    float fiumeX(float z) { return -35.0 + 14.0 * sin(z * 0.035) + 6.0 * sin(z * 0.09); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    // linea sottile e nitida a ogni intero di k (fwidth evita lo sfarfallio; max evita di dividere per zero in pianura)
    float linea(float k, float spessore) { float f = abs(fract(k - 0.5) - 0.5) / max(fwidth(k), 1e-4); return 1.0 - min(f / spessore, 1.0); }

    void main() {
      // Rilievo: più chiaro dove il terreno guarda il sole
      float lum = clamp(dot(normalize(vNorm), uLuce), 0.0, 1.0);
      vec3 col = uBase * (0.25 + 1.1 * lum);

      // Curve di livello (isoipse): una ogni 1,2 m, più marcata ogni 6 m
      float iso = linea(vPos.y / 1.2, 1.0) * 0.28 + linea(vPos.y / 6.0, 1.3) * 0.9;
      col += uOro * iso * uIsoipse;

      // Griglia delle particelle catastali (ruotata come una mappa reale)
      float c = cos(uAngolo), s = sin(uAngolo);
      vec2 q = vec2(c * vPos.x - s * vPos.z, s * vPos.x + c * vPos.z) / uCella;
      vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4));
      float bordoCella = 1.0 - min(min(g.x, g.y), 1.0);
      float dSito = length(vPos.xz - uSito);
      float visibile = 1.0 - smoothstep(uRaggio - 10.0, uRaggio, dSito);
      float onda = smoothstep(uRaggio - 14.0, uRaggio - 2.0, dSito) * visibile; // anello che si allarga
      vec2 cella = floor(q) + uN * 0.5;
      vec4 st = texture2D(uStati, (cella + 0.5) / uN);
      vec2 fq = fract(q);
      float dentro = step(0.07, fq.x) * step(fq.x, 0.93) * step(0.07, fq.y) * step(fq.y, 0.93);
      float rnd = hash(cella);

      col += uPlatino * bordoCella * 0.32 * uGriglia * visibile;
      col += uOro * onda * 0.5 * uGriglia * (1.0 - uIdonee);
      col = mix(col, uSmeraldo * (0.28 + 0.22 * rnd), st.r * dentro * 0.6 * uIdonee * visibile);
      float tratteggio = step(0.5, fract((vPos.x + vPos.z) * 0.32));
      col = mix(col, uRosso * 0.5, st.g * uVincoli * visibile * (0.12 + 0.33 * tratteggio));

      // Particelle del progetto: oro che "respira" + bordi luminosi
      float respiro = 0.8 + 0.2 * sin(uTempo * 2.0);
      col = mix(col, uOro * 0.38 * respiro, st.b * dentro * 0.6 * uSelez);
      col += uOro * bordoCella * st.b * uSelez * 1.6;
      col = mix(col, uSmeraldo * 0.45, st.a * dentro * 0.6 * uAgriSel);
      col += uSmeraldo * bordoCella * st.a * uAgriSel * 1.2;

      // Fiume con riflessi che scorrono
      float dF = abs(vPos.x - fiumeX(vPos.z));
      float acqua = 1.0 - smoothstep(1.4, 3.4, dF);
      float riflesso = pow(0.5 + 0.5 * sin(vPos.z * 0.8 - uTempo * 1.6), 14.0);
      col = mix(col, uAcquaCol * (0.25 + 0.3 * uAcqua + 0.6 * riflesso * uAcqua), acqua * (0.5 + 0.4 * uAcqua));

      // Nebbia e bordi sfumati nel nero
      float nebbia = 1.0 - exp(-uDensita * uDensita * vDist * vDist);
      float bordo = smoothstep(92.0, 118.0, length(vPos.xz));
      col = mix(col, uNebbia, max(nebbia, bordo));

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
scena.add(new THREE.Mesh(geoTerreno, matTerreno));

// --- Particelle di luce sul terreno (l'immagine d'apertura)
const UP = { uTempo: U.uTempo, uOpacita: { value: 1 }, uOro: { value: C.oro }, uPixel: { value: Q.pixel }, uNebbia: U.uNebbia, uDensita: U.uDensita };
{
  const pos = [], rnd = [];
  const p = geoTerreno.attributes.position;
  const passo = leggero ? 3 : 2;
  const riga = Q.segmenti + 1;
  for (let i = 0; i < p.count; i++) {
    if ((i % riga) % passo || Math.floor(i / riga) % passo) continue;
    const x = p.getX(i), z = p.getZ(i);
    if (Math.hypot(x, z) > 112) continue;
    pos.push(x + (hash(i, 1) - 0.5) * 0.8, p.getY(i) + 0.25, z + (hash(i, 2) - 0.5) * 0.8);
    rnd.push(hash(i, 3));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: UP, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTempo, uPixel; attribute float aRnd; varying float vLuce; varying float vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        vLuce = 0.45 + 0.55 * sin(uTempo * (0.6 + aRnd) + aRnd * 40.0);
        gl_PointSize = uPixel * (1.2 + 2.2 * aRnd) * (90.0 / vDist);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacita, uDensita; uniform vec3 uOro, uNebbia; varying float vLuce; varying float vDist;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vLuce * uOpacita;
        a *= exp(-uDensita * uDensita * vDist * vDist);
        gl_FragColor = vec4(uOro * 1.4, a);
        #include <colorspace_fragment>
      }`,
  });
  scena.add(new THREE.Points(g, m));
}

/* ---------------------------------------------------------
   4. GLI IMPIANTI
   Materiali:
   - MeshPhysicalMaterial simula materiali reali: metallo, vetro, vernice.
   - "metalness" = quanto è metallo; "roughness" = quanto è ruvido (0 = specchio).
   --------------------------------------------------------- */

// Texture delle celle solari, disegnata al volo su una tela 2D
function texturePannello() {
  const t = document.createElement('canvas'); t.width = 128; t.height = 256;
  const g = t.getContext('2d');
  g.fillStyle = '#0a1726'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(190,205,220,0.35)'; g.lineWidth = 2;
  for (let x = 0; x <= 128; x += 21.3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += 21.3) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  g.strokeStyle = 'rgba(216,184,120,0.9)'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 252);
  const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
const matPannello = new THREE.MeshPhysicalMaterial({
  map: texturePannello(), metalness: 0.4, roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.25, envMapIntensity: 0.9,
});
const matPalo = new THREE.MeshStandardMaterial({ color: '#8b949a', metalness: 0.8, roughness: 0.35 });
const quat = new THREE.Quaternion(), mtx = new THREE.Matrix4(), vett = new THREE.Vector3(), scala = new THREE.Vector3();
const facile = t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3)); // rallenta alla fine

// Crea un campo di tracker: file di pannelli orientate nord-sud che ruotano
// da est a ovest per seguire il sole. Tanti oggetti uguali disegnati in un colpo solo (InstancedMesh).
function creaTracker({ centro, raggio, passoFile, passoModulo, quota, canale, larghezza, profondita, ogniPalo }) {
  const posti = [];
  const [gc, gr] = versoGriglia(centro.x, centro.y);
  for (let b = -raggio; b <= raggio; b += passoFile) {          // b: est-ovest (una fila ogni passoFile)
    let n = 0;
    for (let a = -raggio; a <= raggio; a += passoModulo, n++) {  // a: lungo la fila, da nord a sud
      const [x, z] = versoMondo(gc + b / CELLA, gr + a / CELLA);
      if (!statoCella(x, z, canale)) continue;
      posti.push({ x, y: altezza(x, z), z, palo: n % ogniPalo === 0, ritardo: Math.hypot(a, b) / raggio * 0.55 + hash(a, b) * 0.08 });
    }
  }
  const moduli = new THREE.InstancedMesh(new THREE.BoxGeometry(larghezza, 0.07, profondita), matPannello, posti.length);
  const pali = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 1, 6).translate(0, 0.5, 0), matPalo, posti.length);
  const eul = new THREE.Euler(0, ANGOLO, 0, 'YXZ');
  // p: da 0 a 1, i pannelli emergono dal centro verso fuori; angolo: rotazione del tracker
  return function aggiorna(p, angolo) {
    eul.z = angolo; quat.setFromEuler(eul);
    posti.forEach((s, i) => {
      const t = facile((p * 1.7 - s.ritardo) / 0.6), k = Math.max(t, 0.0001);
      mtx.compose(vett.set(s.x, s.y + quota * t, s.z), quat, scala.set(k, k, k));
      moduli.setMatrixAt(i, mtx);
      mtx.compose(vett.set(s.x, s.y, s.z), IDENTITA, scala.set(s.palo ? k : 0.0001, quota * t + 0.0001, s.palo ? k : 0.0001));
      pali.setMatrixAt(i, mtx);
    });
    moduli.instanceMatrix.needsUpdate = pali.instanceMatrix.needsUpdate = true;
    moduli.visible = pali.visible = p > 0.001;
    if (!moduli.parent) scena.add(moduli, pali);
  };
}
const IDENTITA = new THREE.Quaternion();

const trackerFV = creaTracker({ centro: SITO, raggio: 22, passoFile: 4.2, passoModulo: 1.12, quota: 1.5, canale: 2, larghezza: 2.2, profondita: 1.08, ogniPalo: 4 });
const trackerAgri = creaTracker({ centro: AGRI, raggio: 18, passoFile: 8, passoModulo: 1.12, quota: 4.5, canale: 3, larghezza: 2.4, profondita: 1.08, ogniPalo: 4 });

// Filari di colture sotto l'agrivoltaico, tra una fila di tracker e l'altra
const filari = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: '#1f4a32', roughness: 0.95, emissive: '#0d3a22', emissiveIntensity: 0.25 });
  const geo = new THREE.BoxGeometry(0.55, 0.32, 3.6);
  const [gc, gr] = versoGriglia(AGRI.x, AGRI.y);
  for (let b = -18; b <= 18; b += 1.6) {
    const resto = ((b % 8) + 8) % 8;
    if (resto < 1.3 || resto > 6.7) continue; // sotto i tracker lasciamo il passaggio
    for (let a = -18; a <= 18; a += 4) {
      const [x, z] = versoMondo(gc + b / CELLA, gr + a / CELLA);
      if (!statoCella(x, z, 3)) continue;
      const f = new THREE.Mesh(geo, m);
      f.position.set(x, altezza(x, z) + 0.15, z); f.rotation.y = ANGOLO;
      filari.add(f);
    }
  }
  filari.scale.y = 0.001;
  scena.add(filari);
}

// --- Pale eoliche sul crinale
const matTorre = new THREE.MeshStandardMaterial({ color: '#8f989e', metalness: 0.35, roughness: 0.5, envMapIntensity: 0.35 });
const eoliche = [];
for (const [x, z] of [[-62, -70], [-44, -76], [-26, -71], [-8, -77]]) {
  const gruppo = new THREE.Group();
  gruppo.position.set(x, altezza(x, z) - 0.5, z);
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.85, 26, 24).translate(0, 13, 0), matTorre);
  const navicella = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 3.6), matTorre);
  navicella.position.set(0, 26.4, -0.4);
  const rotore = new THREE.Group();
  rotore.position.set(0, 26.4, 1.7);
  rotore.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), matTorre));
  const geoPala = new THREE.BoxGeometry(1, 13, 0.16, 1, 8, 1).translate(0, 7, 0);
  { // la pala si assottiglia verso la punta
    const p = geoPala.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - 0.8 * (p.getY(i) / 13.5)) + 0.25 * (p.getY(i) / 13.5));
    geoPala.computeVertexNormals();
  }
  for (let k = 0; k < 3; k++) { const pala = new THREE.Mesh(geoPala, matTorre); pala.rotation.z = k * (Math.PI * 2 / 3); rotore.add(pala); }
  const luce = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b2f' }));
  luce.position.set(0, 27.2, -0.6);
  gruppo.add(torre, navicella, rotore, luce);
  gruppo.scale.setScalar(0.0001);
  gruppo.userData = { rotore, luce, fase: Math.random() * 6 };
  eoliche.push(gruppo);
  scena.add(gruppo);
}

/* --- IDROELETTRICO: tre turbine affiancate.
   Sopra ognuna, una colonna d'acqua: ALTEZZA = salto, LARGHEZZA = portata.
   Kaplan: salto basso, tanta acqua.  Francis: valori medi.  Pelton: salto alto, poca acqua. */
const bronzo = new THREE.MeshPhysicalMaterial({ color: '#caa46a', metalness: 1, roughness: 0.3, clearcoat: 0.3, envMapIntensity: 0.8, side: THREE.DoubleSide });
const acciaio = new THREE.MeshStandardMaterial({ color: '#6b747a', metalness: 1, roughness: 0.4, envMapIntensity: 0.6 });

// Kaplan: asse verticale, 5 pale larghe e svergolate (come un'elica)
function creaKaplan() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.1, 3.4, 48), bronzo));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.2, 48).rotateX(Math.PI).translate(0, -3.3, 0), bronzo));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 40).translate(0, 1.95, 0), acciaio));
  const geo = new THREE.PlaneGeometry(1, 1, 20, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i);                   // u: dal mozzo alla punta, v: larghezza
    const forma = Math.sqrt(Math.max(0.02, 1 - ((u - 0.3) / 0.75) ** 2));
    const r = 2.0 + u * 5.6, corda = (3.4 + 1.6 * u) * v * forma;
    const passo = 0.95 - 0.55 * u;                               // angolo della pala
    const curva = 0.35 * (1 - (2 * v) ** 2) * forma;             // leggera concavità
    p.setXYZ(i, r, corda * Math.sin(passo) + curva, corda * Math.cos(passo));
  }
  geo.computeVertexNormals();
  for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(geo, bronzo); m.rotation.y = k * (Math.PI * 2 / 5); g.add(m); }
  g.scale.setScalar(0.62);
  return { g, sopra: 1.4, asse: 'y', vel: 0.6 };
}

// Francis: asse verticale, pale curve chiuse tra un disco (corona) e un anello (fascia)
function creaFrancis() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.5, 64).translate(0, 0.25, 0), bronzo));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.0, 2.0, 64, 1, true).translate(0, -2.6, 0), bronzo));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 40).rotateX(Math.PI).translate(0, -1.3, 0), bronzo));
  const geo = new THREE.PlaneGeometry(1, 1, 16, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;             // u: dal bordo esterno verso il centro
    const r = 4.2 - 2.4 * u, ang = -1.2 * u;                     // la pala si avvolge a spirale
    const y = -v * (1.6 + 1.8 * u);                              // e scende verso l'uscita
    p.setXYZ(i, r * Math.cos(ang), y, r * Math.sin(ang));
  }
  geo.computeVertexNormals();
  for (let k = 0; k < 13; k++) { const m = new THREE.Mesh(geo, bronzo); m.rotation.y = k * (Math.PI * 2 / 13); g.add(m); }
  g.scale.setScalar(0.85);
  return { g, sopra: 0.45, asse: 'y', vel: 0.9 };
}

// Pelton: asse orizzontale, ruota con "cucchiai" doppi colpiti da un getto sottile
function creaPelton() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.5, 64).rotateX(Math.PI / 2), bronzo));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 24).rotateX(Math.PI / 2), acciaio));
  const coppa = new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.75, 0.85);
  const N_CUCCHIAI = 20;
  for (let k = 0; k < N_CUCCHIAI; k++) {
    const a = k * (Math.PI * 2 / N_CUCCHIAI), c = new THREE.Group();
    for (const dz of [-0.5, 0.5]) { const m = new THREE.Mesh(coppa, bronzo); m.position.z = dz; c.add(m); }
    c.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0);
    c.rotation.z = a; // l'apertura del cucchiaio guarda nel verso del getto
    g.add(c);
  }
  // L'ugello: da qui esce il getto che colpisce i cucchiai sul lato destro
  const ugello = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 1.6, 20).translate(3.6, 5.4, 0), acciaio);
  return { g, sopra: 6.2, asse: 'z', vel: -1.3, extra: ugello, xGetto: 3.6 };
}

// Colonna d'acqua animata (uno shader: strisce che scendono + bordi luminosi)
function creaColonna(alt, raggio, vel) {
  const geo = new THREE.CylinderGeometry(raggio, raggio * 1.04, alt, 40, 1, true).translate(0, alt / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: U.uTempo, uOpacita: { value: 0 }, uCol: { value: C.acqua }, uAlt: { value: alt }, uVel: { value: vel } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vBordo;
      void main() {
        vUv = uv;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vBordo = 1.0 - abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTempo, uOpacita, uAlt, uVel; uniform vec3 uCol; varying vec2 vUv; varying float vBordo;
      void main() {
        float s = fract(vUv.y * uAlt * 0.22 + vUv.x * 2.0 + uTempo * uVel);
        float strisce = smoothstep(0.0, 0.12, s) * pow(1.0 - s, 2.0);
        float a = (0.03 + 0.38 * pow(vBordo, 2.0) + 0.2 * strisce) * uOpacita;
        gl_FragColor = vec4(uCol * 1.1, a);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

const IDRO_Z = 62;
const turbine = [
  { nome: 'kaplan', x: -14, crea: creaKaplan, salto: 6, raggio: 3.4 },
  { nome: 'francis', x: -36, crea: creaFrancis, salto: 15, raggio: 1.5 },
  { nome: 'pelton', x: -58, crea: creaPelton, salto: 30, raggio: 0.32 },
];
const QUOTA_IDRO = Math.max(...turbine.map(t => altezza(t.x, IDRO_Z))) + 6;
for (const t of turbine) {
  const tipo = t.crea();
  t.gruppo = new THREE.Group();
  t.gruppo.position.set(t.x, QUOTA_IDRO, IDRO_Z);
  t.rotore = tipo.g; t.asse = tipo.asse; t.vel = tipo.vel;
  t.gruppo.add(tipo.g);
  if (tipo.extra) t.gruppo.add(tipo.extra);
  // colonna d'acqua sopra la turbina (per la Pelton arriva all'ugello sul lato destro)
  t.colonna = creaColonna(t.salto, t.raggio, 0.35 + 18 / t.salto);
  t.colonna.position.set(tipo.xGetto || 0, tipo.sopra, 0);
  // anello dorato che segna il livello dell'acqua a monte (l'inizio del salto)
  const livello = new THREE.Mesh(new THREE.TorusGeometry(t.raggio + 0.7, 0.05, 8, 96).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: C.oro.clone().multiplyScalar(2.4) }));
  livello.position.set(tipo.xGetto || 0, tipo.sopra + t.salto, 0);
  // basamento: un sottile disco di luce
  const base = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.04, 8, 160).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: C.oro.clone().multiplyScalar(1.6) }));
  base.position.y = -4.4;
  t.gruppo.add(t.colonna, livello, base);
  t.cima = new THREE.Vector3(t.x + (tipo.xGetto || 0), QUOTA_IDRO + tipo.sopra + t.salto, IDRO_Z);
  t.gruppo.visible = false;
  scena.add(t.gruppo);
}

/* ---------------------------------------------------------
   POST-PRODUZIONE: il "bloom" fa brillare le parti più luminose
   --------------------------------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scena, camera));
if (Q.bagliore) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.78));
composer.addPass(new OutputPass());

/* ---------------------------------------------------------
   5. LO SCROLL
   ScrollTrigger collega la barra di scorrimento a una "timeline" GSAP:
   scorrere in avanti = far avanzare il film; tornare su = riavvolgerlo.
   --------------------------------------------------------- */

// Inquadrature: posizione della camera (p) e punto che guarda (t), una per tappa
const QI = QUOTA_IDRO;
const K = [
  { p: [0, 64, 128], t: [0, 0, 0] },              // 0 panoramica
  { p: [44, 60, 72], t: [6, 0, 8] },              // 1 territorio
  { p: [-8, 74, 64], t: [-28, 0, 4] },            // 2 vincoli
  { p: [30, 34, 50], t: [8, 0, 12] },             // 3 iter
  { p: [100, 32, 45], t: [27, 0, -4] },           // 4 fotovoltaico + agrivoltaico (agri davanti, fotovoltaico dietro)
  { p: [22, 34, 22], t: [-52, 18, -72] },         // 5 eolico (pale a destra del testo)
  { p: [-56, QI + 18, -29], t: [-56, QI + 13, 62] },// 6 idroelettrico (da nord: le pale eoliche restano alle spalle)
  { p: [10, 100, 150], t: [0, 0, -6] },           // 7 finale
];
const cam = { px: K[0].p[0], py: K[0].p[1], pz: K[0].p[2], tx: 0, ty: 0, tz: 0 };
const ingresso = { y: 0, z: 0 }; // spostamento extra usato solo dall'introduzione

// Valori animati che non sono "uniform" dello shader
const S = { fv: 0, agri: 0, vento: 0, idro: 0, iter: 0, et: {} };
const etichette = {
  vincolo: { el: '#et-vincolo', pos: [PROTETTA.x, 0, PROTETTA.y] },
  fiume: { el: '#et-fiume', pos: [fiumeX(-10), 0, -10] },
  idonea: { el: '#et-idonea', pos: [30, 0, -20] },
  sito: { el: '#et-sito', pos: [SITO.x, 0, SITO.y] },
  fv: { el: '#et-fv', pos: [SITO.x, 0, SITO.y], alto: 3 },
  agri: { el: '#et-agri', pos: [AGRI.x, 0, AGRI.y], alto: 6 },
  eolico: { el: '#et-eolico', pos: [-35, 0, -74], alto: 30 },
};
for (const k in etichette) {
  const e = etichette[k];
  e.v = new THREE.Vector3(e.pos[0], altezza(e.pos[0], e.pos[2]) + (e.alto || 0.5), e.pos[2]);
}
for (const t of turbine) etichette[t.nome] = { el: '#et-' + t.nome, v: t.cima };
for (const k in etichette) { etichette[k].el = document.querySelector(etichette[k].el); S.et[k] = 0; }

const PASSI = K.length - 1;
const tl = gsap.timeline({
  defaults: { ease: 'power2.inOut', duration: 1 },
  scrollTrigger: { trigger: '.storia', start: 'top top', end: 'bottom bottom', scrub: riduci ? true : 1.4 },
});
// Movimenti di camera tra una tappa e la successiva
K.slice(1).forEach((k, i) => tl.to(cam, { px: k.p[0], py: k.p[1], pz: k.p[2], tx: k.t[0], ty: k.t[1], tz: k.t[2] }, i));

// Comparsa/scomparsa di un'etichetta tra due momenti della timeline
const mostra = (nome, da, a) => { tl.to(S.et, { [nome]: 1, duration: 0.4 }, da); tl.to(S.et, { [nome]: 0, duration: 0.4 }, a); };

// 0→1 territorio: si spengono le particelle di luce, si apre la griglia catastale
tl.to(UP.uOpacita, { value: 0.25 }, 0)
  .to(U.uGriglia, { value: 1 }, 0)
  .to(U.uRaggio, { value: 175, ease: 'power1.in' }, 0)
  .to(U.uIsoipse, { value: 0.55 }, 0);
// 1→2 vincoli: compaiono vincoli (rosso), aree idonee (verde) e il fiume
tl.to(U.uVincoli, { value: 1 }, 1).to(U.uIdonee, { value: 1 }, 1).to(U.uAcqua, { value: 1 }, 1);
mostra('vincolo', 1.55, 2.5); mostra('fiume', 1.65, 2.5); mostra('idonea', 1.75, 2.5);
// 2→3 iter: il resto si attenua, le particelle del progetto si accendono in oro
tl.to(U.uVincoli, { value: 0.1 }, 2).to(U.uIdonee, { value: 0.3 }, 2).to(U.uSelez, { value: 1 }, 2)
  .to(S, { iter: 1, ease: 'none' }, 2.5);
mostra('sito', 2.6, 3.4);
// 3→4 ready to build: emergono fotovoltaico e agrivoltaico su tracker
tl.to(S, { fv: 1, ease: 'none' }, 3).to(S, { agri: 1, ease: 'none', duration: 0.9 }, 3.1).to(U.uAgriSel, { value: 1 }, 3);
mostra('fv', 3.6, 4.5); mostra('agri', 3.7, 4.5);
// 4→5 eolico
tl.to(S, { vento: 1, ease: 'none' }, 4);
mostra('eolico', 4.6, 5.5);
// 5→6 idroelettrico: le tre turbine salgono una dopo l'altra
tl.to(S, { idro: 1, ease: 'none' }, 5);
mostra('kaplan', 5.6, 6.5); mostra('francis', 5.68, 6.5); mostra('pelton', 5.76, 6.5);
// 6→7 finale: tutto visibile, griglia più discreta
tl.to(U.uGriglia, { value: 0.45 }, 6).to(U.uIdonee, { value: 0.5 }, 6).to(UP.uOpacita, { value: 0.6 }, 6);

// Indice delle tappe: si accende quella attiva
const voci = [...document.querySelectorAll('.tappe li')];
const tappe = document.querySelector('.tappe'), hud = document.querySelector('.hud');
ScrollTrigger.create({
  trigger: '.storia', start: 'top top', end: 'bottom bottom',
  onUpdate: self => {
    const i = Math.round(self.progress * PASSI);
    voci.forEach(v => v.classList.toggle('attiva', +v.dataset.i === i));
  },
});

// Le procedure PAS → AU → VIA si "spuntano" una dopo l'altra
const passiIter = [...document.querySelectorAll('.iter li')];
const listaIter = document.querySelector('.iter');

// Quando arrivano le sezioni di testo, la scena si scurisce e l'indice sparisce
const velo = document.querySelector('.velo');
ScrollTrigger.create({
  trigger: '#chi-siamo', start: 'top bottom', end: 'top 30%', scrub: true,
  onUpdate: self => {
    velo.style.setProperty('--scuro', (self.progress * 0.72).toFixed(3));
    tappe.classList.toggle('nascoste', self.progress > 0.05);
    hud.classList.toggle('nascoste', self.progress > 0.05);
  },
});

// Comparsa leggera dei blocchi nelle sezioni
if (!riduci) {
  document.querySelectorAll('.sezione h2, .sezione p, .servizi article, .modulo, .recapiti, .tecnologie').forEach(el => {
    el.classList.add('appare');
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
}

// Modulo contatti: in questa versione di prova non invia nulla
document.querySelector('#modulo').addEventListener('submit', e => {
  e.preventDefault();
  document.querySelector('#esito').textContent = 'Versione di prova: il modulo non invia ancora i dati.';
});

/* ---------------------------------------------------------
   6. IL CICLO DI DISEGNO
   --------------------------------------------------------- */
const orologio = new THREE.Clock();
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
if (!riduci && !leggero) addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

const bersaglio = new THREE.Vector3(), proiettato = new THREE.Vector3();
const hudCoord = document.querySelector('#hud-coord'), hudQuota = document.querySelector('#hud-quota');

function disegna() {
  const t = orologio.getElapsedTime();
  U.uTempo.value = riduci ? 0 : t;

  // Camera: posizione della timeline + piccolo movimento del mouse + leggera deriva
  mouse.sx += (mouse.x - mouse.sx) * 0.04; mouse.sy += (mouse.y - mouse.sy) * 0.04;
  const deriva = riduci ? 0 : 1;
  camera.position.set(
    cam.px + mouse.sx * 8 + Math.sin(t * 0.12) * 2.5 * deriva,
    cam.py + ingresso.y - mouse.sy * 5 + Math.sin(t * 0.17) * 1.0 * deriva,
    cam.pz + ingresso.z + Math.cos(t * 0.1) * 2.0 * deriva,
  );
  bersaglio.set(cam.tx, cam.ty, cam.tz);
  camera.lookAt(bersaglio);

  // Tracker: una "giornata" accelerata. Il sole va da est a ovest e i pannelli lo seguono.
  const giorno = riduci ? 0.3 : Math.sin(t * 0.22) * 0.85;
  if (S.fv > 0 || S.agri > 0) {
    trackerFV(S.fv, giorno);
    trackerAgri(S.agri, giorno);
    filari.scale.y = Math.max(0.001, facile(S.agri * 1.5));
  }
  sole.position.set(-Math.sin(giorno) * 80, 40 + Math.cos(giorno) * 20, -30);

  eoliche.forEach((e, i) => {
    const k = facile((S.vento * 1.6 - i * 0.15) / 0.8);
    e.scale.setScalar(Math.max(k, 0.0001));
    e.visible = k > 0.001;
    if (!riduci) e.userData.rotore.rotation.z = t * 0.9 + e.userData.fase;
    e.userData.luce.visible = Math.sin(t * 3 + i) > 0.6;
  });

  turbine.forEach((tb, i) => {
    const k = facile((S.idro * 1.5 - i * 0.18) / 0.8);
    tb.gruppo.visible = k > 0.001;
    if (!tb.gruppo.visible) return;
    tb.gruppo.position.y = QUOTA_IDRO - 14 * (1 - k);
    tb.gruppo.scale.setScalar(Math.max(k, 0.0001));
    tb.colonna.material.uniforms.uOpacita.value = facile((k - 0.6) / 0.4);
    if (!riduci) tb.rotore.rotation[tb.asse] = t * tb.vel;
  });

  // Etichette: dal punto 3D alla posizione sullo schermo
  for (const k in etichette) {
    const e = etichette[k], o = S.et[k];
    if (o < 0.01) { e.el.style.opacity = 0; continue; }
    proiettato.copy(e.v).project(camera);
    const davanti = proiettato.z < 1;
    const x = (proiettato.x * 0.5 + 0.5) * innerWidth, y = (-proiettato.y * 0.5 + 0.5) * innerHeight;
    e.el.style.opacity = davanti ? o : 0;
    e.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 4).toFixed(1)}px) translateY(-100%)`;
  }

  // Procedure PAS → AU → VIA
  listaIter.style.setProperty('--iter', S.iter.toFixed(3));
  passiIter.forEach((li, i) => li.classList.toggle('fatto', S.iter > i * 0.45 + 0.02));

  // HUD: coordinate "di fantasia" calcolate dalla posizione della camera
  const lat = 41.893 + camera.position.z * -0.0009, lon = 12.483 + camera.position.x * 0.0012;
  const gm = v => `${Math.floor(v)}°${String(Math.floor((v % 1) * 60)).padStart(2, '0')}′`;
  hudCoord.textContent = `${gm(lat)}N · ${gm(lon)}E`;
  hudQuota.textContent = `quota ${Math.round(120 + camera.position.y * 6)} m`;

  composer.render();
  requestAnimationFrame(disegna);
}

// Adatta tutto quando cambia la dimensione della finestra
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ---------------------------------------------------------
   INTRODUZIONE: il logo appare, poi si apre sulla scena
   --------------------------------------------------------- */
const intro = document.querySelector('.intro');
const testoEroe = document.querySelectorAll('.eroe .occhiello, .eroe h1, .eroe .lead, .eroe .scorri, .testata');
if (riduci) {
  intro.remove();
} else {
  gsap.timeline()
    .to('.intro img', { opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out' })
    .to('.intro', { opacity: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => intro.remove() }, '+=0.35')
    .from(ingresso, { y: 76, z: 62, duration: 2.6, ease: 'power3.out' }, '<')
    .from(testoEroe, { opacity: 0, y: 24, duration: 1.2, stagger: 0.12, ease: 'power3.out' }, '-=1.9');
}

disegna();
