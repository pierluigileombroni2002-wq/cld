// Ambiente "Galleria Bianca": niente cielo. La parete avorio sta nel CSS (la tela è trasparente);
// qui ci sono il pavimento di cemento levigato chiaro (con un riflesso debole da studio bianco ai livelli alti),
// la striscia di luce della finestra, le luci morbide e la mappa d'ambiente con la finestra alta e stretta.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const COLORI = {
  pavimentoVicino: new THREE.Color('#DDD8CD'),
  pavimentoLontano: new THREE.Color('#E6E1D6'),
  luce: new THREE.Color('#FBF9F4'),
};

const vertPavimento = /* glsl */`
  varying vec3 vPos; varying vec4 vUv4;
  uniform mat4 textureMatrix;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    vUv4 = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// Il pavimento esce con i colori esatti della palette (niente tone mapping) e sfuma in trasparenza lontano,
// dove la parete del CSS prende il suo posto: il ciclorama non ha spigoli.
const fragPavimento = /* glsl */`
  varying vec3 vPos; varying vec4 vUv4;
  uniform vec3 cVicino, cLontano, cLuce;
  uniform vec3 posCam;
  uniform float riflesso, fase, finale;
  uniform sampler2D tDiffuse;
  void main() {
    vec3 v = normalize(posCam - vPos);
    float dist = length(posCam.xz - vPos.xz);
    vec3 c = mix(cVicino, cLontano, smoothstep(4.0, 70.0, dist));
    // la striscia della finestra, in diagonale sul pavimento: si sposta lentissima con lo scorrimento
    float d = vPos.x * 0.55 + vPos.z * 0.83 - fase;
    float banda = exp(-abs(d) * 0.09);
    c = mix(c, cLuce, banda * (0.38 + finale * 0.5));
    // riflesso satinato delle macchine: debole, sfumato, solo radente
    if (riflesso > 0.0) {
      vec2 uv = vUv4.xy / vUv4.w;
      vec4 s = texture2D(tDiffuse, uv);
      s += texture2D(tDiffuse, uv + vec2(0.003, 0.0)); s += texture2D(tDiffuse, uv - vec2(0.003, 0.0));
      s += texture2D(tDiffuse, uv + vec2(0.0, 0.005)); s += texture2D(tDiffuse, uv - vec2(0.0, 0.005));
      s *= 0.2;
      float radente = pow(1.0 - max(v.y, 0.0), 2.0);
      c = mix(c, s.rgb, s.a * (0.07 + 0.26 * radente) * riflesso);
    }
    // una grana appena percettibile: cemento, non plastica
    float grana = fract(sin(dot(floor(vPos.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.012 - 0.006;
    c += grana;
    float alpha = 1.0 - smoothstep(40.0, 190.0, dist);
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }`;

export function creaAmbiente(renderer, scena) {
  const gruppo = new THREE.Group();
  gruppo.name = 'ambiente';

  // --- pavimento: uno con il riflesso (Reflector), uno piatto per i livelli medio e basso ---
  const uniformiPavimento = () => ({
    cVicino: { value: COLORI.pavimentoVicino }, cLontano: { value: COLORI.pavimentoLontano }, cLuce: { value: COLORI.luce },
    posCam: { value: new THREE.Vector3() }, riflesso: { value: 0 }, fase: { value: 0 }, finale: { value: 0 },
    color: { value: new THREE.Color(0) }, // il Reflector lo pretende, anche se qui non serve
    tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() },
  });
  const geoPav = new THREE.PlaneGeometry(3000, 3000, 1, 1);
  const pavimentoPiatto = new THREE.Mesh(geoPav, new THREE.ShaderMaterial({ uniforms: uniformiPavimento(), vertexShader: vertPavimento, fragmentShader: fragPavimento, transparent: true }));
  pavimentoPiatto.rotation.x = -Math.PI / 2; pavimentoPiatto.frustumCulled = false; pavimentoPiatto.renderOrder = -5;
  gruppo.add(pavimentoPiatto);
  const riflettore = new Reflector(geoPav, {
    textureWidth: 1024, textureHeight: 512, clipBias: 0.003,
    shader: { uniforms: uniformiPavimento(), vertexShader: vertPavimento, fragmentShader: fragPavimento },
  });
  riflettore.rotation.x = -Math.PI / 2; riflettore.frustumCulled = false; riflettore.renderOrder = -5;
  riflettore.material.transparent = true;
  riflettore.material.uniforms.riflesso.value = 1;
  gruppo.add(riflettore);
  const unifPav = [pavimentoPiatto.material.uniforms, riflettore.material.uniforms];

  // --- luci (niente ombre): un solo "sole" freddo dalla finestra in alto a destra, un fill caldo debole, l'emisfero chiaro ---
  const chiave = new THREE.DirectionalLight('#F4F6FF', 1.5);
  chiave.position.set(60, 90, 70);
  const riempimento = new THREE.DirectionalLight('#FFE9D2', 0.35);
  riempimento.position.set(-70, 30, 40);
  const controluce = new THREE.DirectionalLight('#FFFFFF', 0.35);
  controluce.position.set(-20, 40, -90);
  const emisfero = new THREE.HemisphereLight('#F6F3EC', '#BDB6AA', 0.7);
  gruppo.add(chiave, riempimento, controluce, emisfero);

  // --- mappa d'ambiente: una sala chiara con una grande finestra alta e stretta, un softbox e due bande scure,
  // così vetro e acciaio hanno la striscia di luce e un bordo con contrasto, invece di un grigio spento ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scenaEnv = new THREE.Scene();
  // le pareti all'altezza degli occhi sono avorio chiaro: i pali e le strutture (che riflettono l'orizzonte) restano acciaio chiaro
  const stanza = new THREE.Mesh(new THREE.BoxGeometry(120, 60, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color('#DED9CF').multiplyScalar(0.9), side: THREE.BackSide }));
  stanza.position.y = 20;
  scenaEnv.add(stanza);
  const pannello = (w, h, colore, forza, pos, mira = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...mira); scenaEnv.add(m);
  };
  // I vetri inclinati dei moduli riflettono la zona dietro di loro (verso -z) a 20-55 gradi di elevazione:
  // lì sta una grande banda scura (il vetro resta antracite) attraversata dalla finestra alta e stretta (la striscia di luce).
  pannello(150, 60, '#2E3135', 1.0, [0, 36, -54]);            // banda scura dietro, alta: dà il blu-nero al vetro
  pannello(16, 56, '#FFFFFF', 6.0, [14, 36, -51]);            // la finestra: alta, stretta, bianchissima
  pannello(60, 26, '#FFF6EA', 0.9, [0, 58, 6], [0, 0, 6]);    // lucernario morbido sopra: il satinato dei metalli
  pannello(5, 40, '#EEF3FF', 2.4, [-54, 22, 14]);             // filo di luce fredda a sinistra: i bordi dei metalli
  pannello(6, 40, '#FFFFFF', 3.0, [50, 24, 30]);              // secondo filo, caldo, a destra davanti
  pannello(12, 60, '#3A3B3E', 1.0, [58, 20, -24]);            // banda scura a destra: contrasto sul vetro e sull'inox
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
      for (const u of unifPav) {
        u.posCam.value.copy(camera.position);
        u.finale.value = finale;
        u.fase.value = camera.position.x * 0.55 + camera.position.z * 0.83 - 14 + p * 40;
      }
    },
    setQualita(q, livello) {
      const dpr = renderer.getPixelRatio();
      const riflessi = !!livello.riflessi;
      riflettore.visible = riflessi; pavimentoPiatto.visible = !riflessi;
      if (riflessi) riflettore.getRenderTarget().setSize(Math.round(innerWidth * 0.5 * Math.min(dpr, 1.25)), Math.round(innerHeight * 0.5 * Math.min(dpr, 1.25)));
    },
  };
}
