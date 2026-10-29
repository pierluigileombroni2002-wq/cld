// Ambiente "Galleria Bianca": niente cielo. La parete avorio sta nel CSS (la tela è trasparente);
// qui ci sono il pavimento di cemento opaco chiaro (nessun riflesso: le ombre di contatto sono dipinte, vedi ombre.js),
// la striscia di luce della finestra, le luci morbide, la mappa d'ambiente della sala e la vetrata luminosa del finale.
import * as THREE from 'three';

export const COLORI = {
  pavimentoVicino: new THREE.Color('#DDD8CD'),
  pavimentoLontano: new THREE.Color('#E6E1D6'),
  luce: new THREE.Color('#FBF9F4'),
  vetrata: new THREE.Color('#FFFDF8'),
};

const vertPavimento = /* glsl */`
  varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// Il pavimento esce con i colori esatti della palette (niente tone mapping) e sfuma in trasparenza lontano,
// dove la parete del CSS prende il suo posto: il ciclorama non ha spigoli. Cemento opaco: nessun riflesso.
const fragPavimento = /* glsl */`
  varying vec3 vPos;
  uniform vec3 cVicino, cLontano, cLuce;
  uniform vec3 posCam;
  uniform float fase, finale;
  void main() {
    float dist = length(posCam.xz - vPos.xz);
    vec3 c = mix(cVicino, cLontano, smoothstep(4.0, 70.0, dist));
    // la striscia della finestra, in diagonale sul pavimento: si sposta lentissima con lo scorrimento
    float d = vPos.x * 0.55 + vPos.z * 0.83 - fase;
    float banda = exp(-abs(d) * 0.09);
    c = mix(c, cLuce, banda * (0.38 + finale * 0.5));
    // nel finale la luce della vetrata lava anche il pavimento: niente orizzonte scuro sotto il modulo
    c = mix(c, cLuce, finale * 0.45);
    // una grana appena percettibile: cemento, non plastica
    float grana = fract(sin(dot(floor(vPos.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.012 - 0.006;
    c += grana;
    float alpha = 1.0 - smoothstep(40.0, 190.0, dist);
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }`;

// La vetrata del finale: una parete di luce che sale dal pavimento, più chiara a sinistra, sfumata ai bordi.
// (alphaMap legge il canale verde: la maschera è in luminanza, non nell'alpha)
function texturaVetrata() {
  const w = 256, h = 128;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  const liscia = (x) => x * x * (3 - 2 * x);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // sale dal pavimento (bordo basso morbido) e si perde in alto nella parete avorio: il titolo, che sta dietro la tela, resta nero
    const alto = liscia(Math.min(1, v / 0.6));
    const basso = 0.4 + 0.6 * liscia(Math.min(1, (1 - v) / 0.14));
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const sx = liscia(Math.min(1, u / 0.08)), dx = liscia(Math.min(1, (1 - u) / 0.38));
      const a = Math.round(255 * 0.95 * alto * basso * sx * dx);
      const i = (y * w + x) * 4;
      img.data[i] = a; img.data[i + 1] = a; img.data[i + 2] = a; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function creaAmbiente(renderer, scena) {
  const gruppo = new THREE.Group();
  gruppo.name = 'ambiente';

  // --- pavimento: cemento opaco, un solo piano per tutti i livelli di qualità ---
  const uniformi = {
    cVicino: { value: COLORI.pavimentoVicino }, cLontano: { value: COLORI.pavimentoLontano }, cLuce: { value: COLORI.luce },
    posCam: { value: new THREE.Vector3() }, fase: { value: 0 }, finale: { value: 0 },
  };
  const geoPav = new THREE.PlaneGeometry(3000, 3000, 1, 1);
  const pavimento = new THREE.Mesh(geoPav, new THREE.ShaderMaterial({ uniforms: uniformi, vertexShader: vertPavimento, fragmentShader: fragPavimento, transparent: true }));
  pavimento.rotation.x = -Math.PI / 2; pavimento.frustumCulled = false; pavimento.renderOrder = -5;
  gruppo.add(pavimento);

  // --- la vetrata del finale: in fondo alla galleria, davanti alla camera dei contatti ---
  const vetrata = new THREE.Mesh(new THREE.PlaneGeometry(170, 13), new THREE.MeshBasicMaterial({ color: COLORI.vetrata, alphaMap: texturaVetrata(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  vetrata.position.set(190, 6.2, -78);
  vetrata.lookAt(176, 4, 0);
  vetrata.renderOrder = -4.5; vetrata.visible = false;
  gruppo.add(vetrata);

  // --- luci (niente ombre): un solo "sole" freddo dalla finestra in alto a destra, un fill caldo debole, l'emisfero chiaro ---
  const chiave = new THREE.DirectionalLight('#F4F6FF', 1.5);
  chiave.position.set(60, 90, 70);
  const riempimento = new THREE.DirectionalLight('#FFE9D2', 0.4);
  riempimento.position.set(-70, 30, 40);
  const controluce = new THREE.DirectionalLight('#FFFFFF', 0.35);
  controluce.position.set(-20, 40, -90);
  const emisfero = new THREE.HemisphereLight('#F6F3EC', '#BDB6AA', 0.7);
  gruppo.add(chiave, riempimento, controluce, emisfero);

  // --- mappa d'ambiente: una sala avorio con un grande pannello caldo a sinistra, uno piccolo freddo a destra,
  // due bande scure (dietro e a destra) e un soffitto scuro verso il fondo attraversato dalla finestra alta e stretta:
  // il vetro inclinato dei moduli riflette proprio quel soffitto, quindi resta antracite con una sola striscia di luce ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scenaEnv = new THREE.Scene();
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(120, 60, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color('#DED9CF').multiplyScalar(0.9), side: THREE.BackSide }));
  stanza.position.y = 20;
  scenaEnv.add(stanza);
  const pannello = (w, h, colore, forza, pos, mira = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...mira); scenaEnv.add(m);
  };
  pannello(150, 60, '#2E3135', 1.0, [0, 36, -54]);              // banda scura dietro, alta
  pannello(150, 64, '#272A2E', 1.0, [0, 54, -30], [0, 0, -30]);  // soffitto scuro verso il fondo: il vetro resta antracite
  // (la striscia della finestra sul vetro è nello shader del vetro, non qui: nella mappa sfocata una finestra bianchissima ingrigirebbe tutto)
  pannello(40, 16, '#FFF6EA', 0.7, [0, 58, 16], [0, 0, 16]);     // lucernario morbido sopra la camera: il satinato dei metalli
  pannello(34, 38, '#FFE7CC', 1.5, [-57, 24, 8], [0, 24, 8]);    // pannello caldo grande a sinistra (3500 K)
  // banda scura grande sulla parete destra: la camera guarda le file di tre quarti e il vetro riflette proprio lì;
  // senza, il vetro rifletterebbe la parete avorio e diventerebbe grigio. Il filo freddo sta sul suo bordo.
  pannello(80, 52, '#2E3135', 1.0, [58, 30, -14], [0, 30, -14]);
  pannello(7, 40, '#E4ECFF', 3.0, [56, 24, 28], [0, 24, 28]);    // filo freddo piccolo a destra (6000 K): i bordi dei metalli
  const pavEnv = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#B8B2A6' }));
  pavEnv.rotation.x = -Math.PI / 2; pavEnv.position.y = -1;
  scenaEnv.add(pavEnv);
  const env = pmrem.fromScene(scenaEnv, 0.04).texture;
  pmrem.dispose();
  scena.environment = env;

  scena.add(gruppo);

  return {
    gruppo,
    env,
    aggiorna(tempo, camera, finale = 0, p = 0) {
      uniformi.posCam.value.copy(camera.position);
      uniformi.finale.value = finale;
      uniformi.fase.value = camera.position.x * 0.55 + camera.position.z * 0.83 - 14 + p * 40;
      vetrata.material.opacity = finale;
      vetrata.visible = finale > 0.002;
    },
    setQualita() {},
  };
}
