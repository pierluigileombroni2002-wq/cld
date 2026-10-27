// Ambiente: cielo del crepuscolo, stelle, polvere d'oro, pavimento da studio (con un riflesso satinato), luci e mappa d'ambiente.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const COLORI = {
  alto: new THREE.Color('#151335'),
  medio: new THREE.Color('#231b4e'),
  viola: new THREE.Color('#5c3352'),
  orizzonte: new THREE.Color('#e8975a'),
  orizzonteChiaro: new THREE.Color('#ffcf8a'),
  sotto: new THREE.Color('#0d0b1c'),
  sole: new THREE.Color('#ffd27a'),
  pavimentoVicino: new THREE.Color('#13102a'),
  pavimentoLontano: new THREE.Color('#4a2e2c'),
};

// Il sole sta dietro la scena, basso sull'orizzonte: controluce morbido.
export const DIR_SOLE = new THREE.Vector3(0.18, 0.045, -1).normalize();
export const STRATO_CIELO = 1; // cielo, stelle e polvere non entrano nel riflesso del pavimento

const vertCielo = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w; // sempre sul fondo
  }`;

const fragCielo = /* glsl */`
  varying vec3 vDir;
  uniform vec3 cAlto, cMedio, cOrizzonte, cOrizzonteChiaro, cSotto, cSole;
  uniform vec3 cViola;
  uniform vec3 dirSole;
  uniform float finale;   // 0..1: nel finale il sole sale e inonda il cielo
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // dall'alto: indaco → indaco medio → viola caldo → oro dell'orizzonte
    vec3 c = mix(cMedio, cAlto, smoothstep(0.10, 0.6, h));
    c = mix(cViola, c, smoothstep(0.02, 0.16, h));
    vec3 ds = normalize(dirSole + vec3(0.0, finale * 0.09, 0.0));
    vec2 az2 = normalize(d.xz); vec2 as2 = normalize(ds.xz);
    float az = max(dot(az2, as2), 0.0);
    float versoSole = pow(az, 4.0);
    float banda = exp(-abs(h - 0.004) * (19.0 - 8.0 * finale));
    vec3 cBanda = mix(cOrizzonte, cOrizzonteChiaro, versoSole * 0.6 + finale * 0.3);
    c = mix(c, cBanda, banda * (0.42 + 0.45 * versoSole));
    // il sole: un disco piccolo e lontano, con un alone misurato
    float ang = max(dot(d, ds), 0.0);
    c += cSole * (pow(ang, 1400.0) * (0.9 + finale * 1.6) + pow(ang, 40.0) * (0.22 + finale * 0.5) + pow(ang, 5.0) * (0.05 + finale * 0.25));
    c = mix(c, cSotto, smoothstep(0.0, -0.12, h));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const vertPavimento = /* glsl */`
  varying vec3 vPos; varying vec4 vUv4;
  uniform mat4 textureMatrix;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    vUv4 = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const fragPavimento = /* glsl */`
  varying vec3 vPos; varying vec4 vUv4;
  uniform vec3 cVicino, cLontano, cSole, cOrizzonte, color;
  uniform vec3 posCam, dirSole;
  uniform float finale, riflesso;
  uniform sampler2D tDiffuse;
  void main() {
    vec3 v = normalize(posCam - vPos);
    float dist = length(posCam.xz - vPos.xz);
    vec3 c = mix(cVicino, cLontano, smoothstep(10.0, 320.0, dist));
    c = mix(c, cOrizzonte * 0.75, smoothstep(250.0, 1400.0, dist));
    // riflesso del sole sul pavimento liscio: una striscia morbida, come un pavimento di studio
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
    vec3 ds = normalize(dirSole + vec3(0.0, finale * 0.09, 0.0));
    float a = max(dot(r, ds), 0.0);
    float striscia = pow(a, 140.0) * 0.55 + pow(a, 18.0) * 0.06;
    c += cSole * striscia * (1.0 + finale * 1.4);
    // riflesso satinato delle macchine (solo ai livelli di qualità che se lo possono permettere)
    if (riflesso > 0.0) {
      vec2 uv = vUv4.xy / vUv4.w;
      vec4 s = texture2D(tDiffuse, uv);
      s += texture2D(tDiffuse, uv + vec2(0.0025, 0.0)); s += texture2D(tDiffuse, uv - vec2(0.0025, 0.0));
      s += texture2D(tDiffuse, uv + vec2(0.0, 0.004)); s += texture2D(tDiffuse, uv - vec2(0.0, 0.004));
      s *= 0.2;
      float radente = pow(1.0 - max(v.y, 0.0), 1.5);
      c += s.rgb * s.a * (0.12 + 0.38 * radente) * riflesso;
    }
    // leggerissima grana, per non avere un gradiente piatto
    float grana = fract(sin(dot(floor(vPos.xz * 48.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.004;
    c += grana;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function texturaPunto(dim = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = dim;
  const g = cv.getContext('2d');
  const r = g.createRadialGradient(dim / 2, dim / 2, 0, dim / 2, dim / 2, dim / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, dim, dim);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function creaAmbiente(renderer, scena) {
  const gruppo = new THREE.Group();
  gruppo.name = 'ambiente';

  // --- cielo (segue la camera) ---
  const unifCielo = {
    cAlto: { value: COLORI.alto }, cMedio: { value: COLORI.medio }, cViola: { value: COLORI.viola },
    cOrizzonte: { value: COLORI.orizzonte }, cOrizzonteChiaro: { value: COLORI.orizzonteChiaro },
    cSotto: { value: COLORI.sotto }, cSole: { value: COLORI.sole },
    dirSole: { value: DIR_SOLE }, finale: { value: 0 },
  };
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({ uniforms: unifCielo, vertexShader: vertCielo, fragmentShader: fragCielo, side: THREE.BackSide, depthWrite: false, depthTest: false })
  );
  cielo.scale.setScalar(1500);
  cielo.renderOrder = -10;
  cielo.frustumCulled = false;
  cielo.layers.set(STRATO_CIELO);
  gruppo.add(cielo);

  // --- stelle ---
  const nStelle = 1400;
  const posS = new Float32Array(nStelle * 3), dimS = new Float32Array(nStelle), faseS = new Float32Array(nStelle);
  for (let i = 0; i < nStelle; i++) {
    const u = Math.random(), v = Math.random();
    const theta = u * Math.PI * 2, phi = Math.acos(1 - v * 0.9); // emisfero alto, più fitte in alto
    const r = 1400;
    posS[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    posS[i * 3 + 1] = r * Math.cos(phi) + 30;
    posS[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    dimS[i] = 0.6 + Math.random() * Math.random() * 2.2;
    faseS[i] = Math.random() * 6.28;
  }
  const geoS = new THREE.BufferGeometry();
  geoS.setAttribute('position', new THREE.BufferAttribute(posS, 3));
  geoS.setAttribute('dim', new THREE.BufferAttribute(dimS, 1));
  geoS.setAttribute('fase', new THREE.BufferAttribute(faseS, 1));
  const matS = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, mappa: { value: texturaPunto(32) }, dpr: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float dim; attribute float fase; uniform float t; uniform float dpr; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float sfarf = 0.65 + 0.35 * sin(t * (0.6 + fract(fase) * 0.8) + fase * 7.0);
        vA = sfarf * smoothstep(0.0, 0.18, normalize(position).y);
        gl_PointSize = dim * dpr * 1.6;
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D mappa; varying float vA;
      void main() { vec4 m = texture2D(mappa, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.96, 0.9), m.a * vA * 0.9); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const stelle = new THREE.Points(geoS, matS);
  stelle.renderOrder = -9; stelle.frustumCulled = false;
  stelle.layers.set(STRATO_CIELO);
  gruppo.add(stelle);

  // --- polvere d'oro (segue la camera, deriva lenta) ---
  const nPolvereMax = 1400;
  const posP = new Float32Array(nPolvereMax * 3), semeP = new Float32Array(nPolvereMax);
  for (let i = 0; i < nPolvereMax; i++) {
    posP[i * 3] = (Math.random() - 0.5) * 90; posP[i * 3 + 1] = Math.random() * 16; posP[i * 3 + 2] = (Math.random() - 0.5) * 90;
    semeP[i] = Math.random();
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.BufferAttribute(posP, 3));
  geoP.setAttribute('seme', new THREE.BufferAttribute(semeP, 1));
  const matP = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, mappa: { value: texturaPunto(64) }, dpr: { value: 1 }, centro: { value: new THREE.Vector3() }, cOro: { value: COLORI.sole } },
    vertexShader: /* glsl */`
      attribute float seme; uniform float t; uniform float dpr; uniform vec3 centro; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(t * 0.11 + seme * 31.0) * 1.6 + t * 0.12 * (0.3 + seme);
        p.y += sin(t * 0.17 + seme * 17.0) * 0.6 + seme * 0.4;
        p.z += cos(t * 0.09 + seme * 23.0) * 1.6;
        // avvolge attorno alla camera: la polvere non finisce mai
        p.x = mod(p.x - centro.x + 45.0, 90.0) - 45.0 + centro.x;
        p.z = mod(p.z - centro.z + 45.0, 90.0) - 45.0 + centro.z;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float pulsa = 0.5 + 0.5 * sin(t * (0.8 + seme) + seme * 50.0);
        vA = (0.2 + 0.8 * pulsa) * smoothstep(4.0, 14.0, d) * (1.0 - smoothstep(30.0, 60.0, d));
        gl_PointSize = (0.5 + seme * seme * 1.6) * dpr * 90.0 / max(d, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D mappa; uniform vec3 cOro; varying float vA;
      void main() { vec4 m = texture2D(mappa, gl_PointCoord); gl_FragColor = vec4(cOro, m.a * vA * 0.4); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const polvere = new THREE.Points(geoP, matP);
  polvere.frustumCulled = false;
  polvere.layers.set(STRATO_CIELO);
  gruppo.add(polvere);

  // --- pavimento: uno con il riflesso (Reflector), uno piatto per i livelli bassi ---
  const uniformiPavimento = () => ({
    cVicino: { value: COLORI.pavimentoVicino }, cLontano: { value: COLORI.pavimentoLontano },
    cSole: { value: COLORI.sole }, cOrizzonte: { value: COLORI.orizzonte }, color: { value: new THREE.Color(0) },
    posCam: { value: new THREE.Vector3() }, dirSole: { value: DIR_SOLE }, finale: { value: 0 }, riflesso: { value: 0 },
    tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() },
  });
  const geoPav = new THREE.PlaneGeometry(4000, 4000, 1, 1);
  const pavimentoPiatto = new THREE.Mesh(geoPav, new THREE.ShaderMaterial({ uniforms: uniformiPavimento(), vertexShader: vertPavimento, fragmentShader: fragPavimento }));
  pavimentoPiatto.rotation.x = -Math.PI / 2; pavimentoPiatto.frustumCulled = false;
  gruppo.add(pavimentoPiatto);
  const riflettore = new Reflector(geoPav, {
    textureWidth: 1024, textureHeight: 512, clipBias: 0.003,
    shader: { uniforms: uniformiPavimento(), vertexShader: vertPavimento, fragmentShader: fragPavimento },
  });
  riflettore.rotation.x = -Math.PI / 2; riflettore.frustumCulled = false;
  riflettore.material.uniforms.riflesso.value = 1;
  gruppo.add(riflettore);
  const unifPav = [pavimentoPiatto.material.uniforms, riflettore.material.uniforms];

  // --- luci (niente ombre) ---
  const chiave = new THREE.DirectionalLight('#ffd9a8', 1.35);          // dal lato del sole, bassa: controluce caldo
  chiave.position.copy(DIR_SOLE).multiplyScalar(100);
  const riempimento = new THREE.DirectionalLight('#e4ddff', 0.8);      // dall'alto davanti, appena fredda: modella le forme
  riempimento.position.set(-40, 80, 90);
  const emisfero = new THREE.HemisphereLight('#514a8c', '#6e4a2c', 0.7); // il pavimento rimanda un po' di caldo
  gruppo.add(chiave, riempimento, emisfero);

  // --- mappa d'ambiente: cielo + grandi "softbox" da studio, per riflessi credibili su vetro e metalli ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scenaEnv = new THREE.Scene();
  const cieloEnv = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(unifCielo), vertexShader: vertCielo, fragmentShader: fragCielo, side: THREE.BackSide, depthWrite: false,
  }));
  cieloEnv.scale.setScalar(100);
  scenaEnv.add(cieloEnv);
  const softbox = (w, h, colore, forza, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colore).multiplyScalar(forza), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scenaEnv.add(m);
  };
  softbox(90, 9, '#ffd7a0', 2.2, [DIR_SOLE.x * 60, 4, DIR_SOLE.z * 60]);   // la striscia dorata dell'orizzonte
  softbox(90, 36, '#ffe6c4', 0.6, [0, 55, -45]);                             // grande softbox caldo, alto dietro: si specchia nei vetri inclinati
  softbox(50, 30, '#aeb8ff', 0.8, [-40, 60, 55]);                            // softbox freddo davanti: il contrasto del crepuscolo
  softbox(120, 50, '#ffe9d6', 0.9, [10, 28, 85]);                            // grande softbox caldo dietro la camera: i metalli si accendono
  const pavEnv = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#1a1428' }));
  pavEnv.rotation.x = -Math.PI / 2; pavEnv.position.y = -1;
  scenaEnv.add(pavEnv);
  const env = pmrem.fromScene(scenaEnv, 0.04).texture;
  pmrem.dispose();
  scena.environment = env;

  scena.add(gruppo);

  return {
    gruppo,
    env,
    aggiorra: null,
    aggiorna(tempo, camera, finale = 0) {
      cielo.position.copy(camera.position);
      stelle.position.copy(camera.position);
      matS.uniforms.t.value = tempo;
      matP.uniforms.t.value = tempo;
      matP.uniforms.centro.value.copy(camera.position);
      unifCielo.finale.value = finale;
      for (const u of unifPav) { u.posCam.value.copy(camera.position); u.finale.value = finale; }
    },
    setQualita(q, livello) {
      const dpr = renderer.getPixelRatio();
      matS.uniforms.dpr.value = dpr; matP.uniforms.dpr.value = dpr;
      const n = q === 'alta' ? nPolvereMax : q === 'media' ? 700 : 300;
      geoP.setDrawRange(0, n);
      const riflessi = !!livello.riflessi;
      riflettore.visible = riflessi; pavimentoPiatto.visible = !riflessi;
      if (riflessi) riflettore.getRenderTarget().setSize(Math.round(innerWidth * 0.5 * Math.min(dpr, 1.25)), Math.round(innerHeight * 0.5 * Math.min(dpr, 1.25)));
    },
  };
}
