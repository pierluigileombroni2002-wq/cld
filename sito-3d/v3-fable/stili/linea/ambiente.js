// Ambiente "Linea di Luce": nessun cielo, nessun sole. Un fondo grafite (dato dalla pagina: la tela è trasparente),
// un pavimento dello stesso grafite appena più chiaro vicino alle macchine, ombre di contatto dipinte,
// luci fredde e una mappa d'ambiente neutra da studio (softbox bianchi su nero) per acciaio satinato e vetro scuro.
import * as THREE from 'three';
import { iniettaRivelazione } from './linee.js';

const vertPav = /* glsl */`
  varying vec3 vW;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const fragPav = /* glsl */`
  varying vec3 vW;
  uniform vec3 centro, colore; uniform float raggio;
  void main() {
    vec2 d = (vW.xz - centro.xz) / vec2(raggio * 1.6, raggio);
    float k = exp(-dot(d, d));
    float grana = fract(sin(dot(floor(vW.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.012;
    gl_FragColor = vec4(colore * k + grana * k, 0.0);
  }`;

function texturaOmbra(dim = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = dim;
  const g = cv.getContext('2d');
  const r = g.createRadialGradient(dim / 2, dim / 2, 0, dim / 2, dim / 2, dim / 2);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.45, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, dim, dim);
  return new THREE.CanvasTexture(cv);
}

export function creaAmbiente(renderer, scena) {
  const gruppo = new THREE.Group(); gruppo.name = 'ambiente';

  // --- pavimento: una luce morbida sul grafite attorno alla macchina (additivo: non sporca mai i titoli dietro la tela) ---
  const matPav = new THREE.ShaderMaterial({
    uniforms: { centro: { value: new THREE.Vector3() }, colore: { value: new THREE.Color('#2a2b2d') }, raggio: { value: 26 } },
    vertexShader: vertPav, fragmentShader: fragPav,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  });
  const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), matPav);
  pavimento.rotation.x = -Math.PI / 2; pavimento.position.y = -0.002; pavimento.frustumCulled = false; pavimento.renderOrder = -2;
  gruppo.add(pavimento);

  // --- ombre di contatto: ellissi morbide dipinte, niente shadow map ---
  const matOmbra = iniettaRivelazione(new THREE.MeshBasicMaterial({ map: texturaOmbra(), color: '#000000', transparent: true, opacity: 0.62, depthWrite: false }), 'alpha');
  const geoOmbra = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const ombre = new THREE.Group(); gruppo.add(ombre);
  function ombra(x, z, larghezza, profondita, ruota = 0) {
    const m = new THREE.Mesh(geoOmbra, matOmbra);
    m.position.set(x, 0.012, z); m.scale.set(larghezza, 1, profondita); m.rotation.y = ruota;
    m.renderOrder = -1; m.frustumCulled = false;
    ombre.add(m); return m;
  }

  // --- luci: tutte fredde e bianche ---
  const chiave = new THREE.DirectionalLight('#ffffff', 1.45); chiave.position.set(-35, 60, 45);
  const taglio = new THREE.DirectionalLight('#dfe8f0', 1.15); taglio.position.set(60, 24, -30);   // il filo chiaro sui bordi
  const emisfero = new THREE.HemisphereLight('#3a3e44', '#0a0a0b', 0.6);
  // la torcia: una luce vicina, in alto a sinistra davanti alla macchina, che segue il punto di mira
  // e dà un vero gradiente alle pareti verticali (container, PCS, casse)
  const torcia = new THREE.PointLight('#ffffff', 900, 90, 2);
  gruppo.add(chiave, taglio, emisfero, torcia);

  // --- mappa d'ambiente da studio: softbox bianchi su nero, come in un servizio fotografico di orologi ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scenaEnv = new THREE.Scene(); scenaEnv.background = new THREE.Color('#050506');
  const softbox = (w, h, grigio, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(grigio), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scenaEnv.add(m);
  };
  softbox(120, 70, '#ffffff', [-45, 75, 30]);      // grande softbox in alto a sinistra: il volume
  softbox(16, 90, '#ffffff', [80, 22, -10]);        // striscia stretta e lunga a destra: il filo chiaro sui bordi
  softbox(90, 40, '#8f959b', [0, 20, 90]);          // dietro la camera: le facce frontali non sono mai nere del tutto
  softbox(60, 16, '#c9ced3', [10, 6, 70]);          // una lama bassa frontale: gradiente sulle pareti verticali
  softbox(110, 110, '#aeb4ba', [0, 95, 5]);         // cielo da studio sopra: una velatura sui piani orizzontali e sulle giranti
  const pavEnv = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#141516' }));
  pavEnv.rotation.x = -Math.PI / 2; pavEnv.position.y = -1; scenaEnv.add(pavEnv);
  const env = pmrem.fromScene(scenaEnv, 0.05).texture;
  pmrem.dispose();
  scena.environment = env;

  scena.add(gruppo);

  return {
    gruppo, env, ombra,
    aggiorna(centro) { matPav.uniforms.centro.value.copy(centro); torcia.position.set(centro.x - 13, 11, centro.z + 15); },
  };
}
