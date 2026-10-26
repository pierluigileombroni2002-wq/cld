// Showroom ERI · pagina di prova "Crepuscolo magico": ambiente stilizzato e cinetico, macchine in alta definizione.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { creaMateriali, impostaAnisotropia, texQuadrante, ADDITIVO } from './showroom-mat.js';
import { creaFV } from './showroom-fv.js';
import { creaBESS } from './showroom-bess.js';
import { creaIdro } from './showroom-idro.js';

// protezione HDR: i riflessi speculari estremi superano il half-float (Inf/NaN) e il bloom li allargherebbe a blocchi
THREE.ShaderChunk.opaque_fragment = THREE.ShaderChunk.opaque_fragment.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
  'gl_FragColor = vec4( clamp( outgoingLight, 0.0, 24.0 ), diffuseColor.a );');

const errori = [];
window.__eri = { pronto: false, errori, moduli: () => ({ scena: 'ok' }) };
window.addEventListener('error', e => errori.push(String(e.message)));

const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
const PAL = {
  zenit: C('#0a0920'), indaco: C('#151335'), malva: C('#5a2f58'), arancio: C('#e8975a', 1.05), oro: C('#ffcf8a', 1.12),
  oroLuce: C('#ffd27a'), oroCaldo: C('#e6b25c'),
};

// ---------- renderer ----------
const canvas = document.getElementById('scena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
impostaAnisotropia(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
creaMateriali();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.05, 3000);

// ---------- cielo (gradiente indaco → oro, sole basso, filamenti luminosi) ----------
const cieloFrag = `
  uniform vec3 cZenit, cIndaco, cMalva, cArancio, cOro; uniform vec3 uSole; uniform float uT;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir); float e = d.y; float az = atan(d.x, -d.z);
    vec3 c = cOro;
    c = mix(c, cArancio, smoothstep(0.0, 0.022, e));
    c = mix(c, cMalva, smoothstep(0.012, 0.1, e));
    c = mix(c, cIndaco, smoothstep(0.06, 0.22, e));
    c = mix(c, cZenit, smoothstep(0.24, 0.8, e));
    if (e < 0.0) c = mix(cOro, cArancio * 0.5, smoothstep(0.0, -0.06, e));
    float s = max(dot(d, normalize(uSole)), 0.0);
    c += cOro * (pow(s, 60.0) * 0.25 + pow(s, 12.0) * 0.05) * smoothstep(-0.04, 0.01, e);
    float b1 = exp(-pow((e - 0.05 - 0.008 * sin(az * 2.0 + uT * 0.03)) / 0.0035, 2.0)) * smoothstep(0.1, 1.0, sin(az * 5.0 + uT * 0.02));
    float b2 = exp(-pow((e - 0.085 - 0.01 * sin(az * 3.0 - uT * 0.025)) / 0.0025, 2.0)) * smoothstep(0.2, 1.0, sin(az * 4.0 - uT * 0.015 + 1.0));
    float b3 = exp(-pow((e - 0.026 - 0.006 * sin(az * 4.0 + uT * 0.02)) / 0.004, 2.0)) * smoothstep(0.0, 1.0, sin(az * 3.0 + 2.0 + uT * 0.01));
    c += vec3(1.0, 0.6, 0.45) * (b1 * 0.12 + b2 * 0.05) + vec3(1.0, 0.75, 0.5) * b3 * 0.3;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SOLE = new THREE.Vector3(0.08, 0.01, -1).normalize();
function materialeCielo() {
  return new THREE.ShaderMaterial({
    uniforms: { cZenit: { value: PAL.zenit }, cIndaco: { value: PAL.indaco }, cMalva: { value: PAL.malva }, cArancio: { value: PAL.arancio }, cOro: { value: PAL.oro }, uSole: { value: SOLE }, uT: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: cieloFrag, side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
}
const cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), materialeCielo());
cielo.renderOrder = -10; cielo.frustumCulled = false; scene.add(cielo);

// stelle sottili
{
  const n = 1800, pos = new Float32Array(n * 3), sem = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = 0.06 + Math.pow(Math.random(), 0.8) * 0.94, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - e * e);
    pos.set([Math.cos(a) * r * 1400, e * 1400, Math.sin(a) * r * 1400], i * 3); sem[i] = Math.random();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sem, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPx: { value: DPR } },
    vertexShader: `uniform float uT, uPx; attribute float aS; varying float vA;
      void main(){ vec3 d = normalize(position); vA = smoothstep(0.08, 0.4, d.y) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (0.6 + aS * 2.2) + aS * 60.0), 3.0)) * (0.3 + aS * 0.9);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; gl_PointSize = uPx * (1.0 + step(0.93, aS) * 1.4); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * a * 1.4, 1.0); }`,
    ...ADDITIVO, depthTest: false,
  });
  const stelle = new THREE.Points(g, m); stelle.renderOrder = -9; stelle.frustumCulled = false; stelle.layers.set(1); cielo.add(stelle); cielo.userData.stelle = m;
}

// ---------- ambiente per i riflessi: cielo + softbox da studio dorate ----------
{
  const env = new THREE.Scene();
  const s = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), materialeCielo()); env.add(s);
  const sb = (w, h, col, k, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: C(col, k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); env.add(m); };
  sb(30, 10, '#ffffff', 3.2, [0, 30, 6], [0, 0, 0]);        // softbox alta
  sb(5, 26, '#fff6ea', 3.0, [-30, 8, 10], [0, 4, 0]);       // striscia sinistra
  sb(5, 26, '#eef0ff', 2.4, [30, 8, 6], [0, 4, 0]);         // striscia destra
  sb(40, 2.0, '#ffc68a', 1.2, [0, 3, -40], [0, 3, 0]);      // linea d'orizzonte calda
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  pm.dispose();
}

// ---------- luci ----------
scene.add(new THREE.HemisphereLight('#4b4483', '#1a1016', 0.75));
const sole = new THREE.DirectionalLight('#fff0dc', 2.5);
sole.position.set(-14, 20, 16); sole.castShadow = true;
sole.shadow.mapSize.set(4096, 4096); sole.shadow.bias = -0.00015; sole.shadow.normalBias = 0.015;
Object.assign(sole.shadow.camera, { left: -19, right: 19, top: 14, bottom: -14, near: 1, far: 90 });
scene.add(sole, sole.target);
const DIR_SOLE = sole.position.clone().normalize();
const controluce = new THREE.DirectionalLight('#ffb070', 2.2); controluce.position.set(8, 6, -26); scene.add(controluce);
const riempi = new THREE.DirectionalLight('#b4b8ff', 0.6); riempi.position.set(0, 4, 24); scene.add(riempi);

// ---------- isole ----------
const R = 4.35, H_POD = 0.45, VOLO = 0.32, TOP = VOLO + H_POD;
const ISOLE = [
  { id: 'fv', pos: new THREE.Vector3(-8.7, 0, 2.0), crea: creaFV, ancora: 3.35 },
  { id: 'bess', pos: new THREE.Vector3(0, 0, -3.4), crea: creaBESS, ancora: 2.55 },
  { id: 'idro', pos: new THREE.Vector3(8.7, 0, 2.0), crea: creaIdro, ancora: 3.0 },
];
const matPodio = new THREE.MeshPhysicalMaterial({ color: '#141319', metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 0.6 });
const matQuadrante = new THREE.MeshPhysicalMaterial({ map: texQuadrante(), metalness: 0, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.35, envMapIntensity: 0.22, specularIntensity: 0.5 });
const geoPodio = new THREE.LatheGeometry([[0, 0], [R - 0.55, 0], [R - 0.14, 0.05], [R - 0.03, 0.13], [R, 0.2], [R, 0.38], [R - 0.02, 0.43], [R - 0.06, H_POD], [0, H_POD]].map(([a, b]) => new THREE.Vector2(a, b)), 200);
function matAnello(vel, fase, k) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 }, uC: { value: C('#ffd27a', k) } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg; uniform vec3 uC; varying vec2 vU;
      void main(){ if (vU.x > uProg) discard; float a = fract(vU.x * 2.0 - uT * ${vel.toFixed(3)} + ${fase.toFixed(2)});
        float testa = pow(a, 60.0) * 7.0 + pow(a, 8.0) * 0.9; float coda = smoothstep(uProg - 0.02, uProg, vU.x) * step(uProg, 0.999) * 6.0;
        gl_FragColor = vec4(uC * (1.0 + testa + coda), 1.0); }`,
  });
}
const anelli = [], isole = {};
for (const [i, def] of ISOLE.entries()) {
  const g = new THREE.Group(); g.position.copy(def.pos); scene.add(g);
  const podio = new THREE.Group(); podio.position.y = VOLO; g.add(podio);
  const corpo = new THREE.Mesh(geoPodio, matPodio); corpo.castShadow = true; corpo.receiveShadow = true; podio.add(corpo);
  const piano = new THREE.Mesh(new THREE.CircleGeometry(R - 0.06, 200), matQuadrante); piano.rotation.x = -Math.PI / 2; piano.position.y = H_POD + 0.0005; piano.receiveShadow = true; podio.add(piano);
  const a1 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.014, 12, 400), matAnello(0.05, i * 0.3, 2.6)); a1.rotation.x = -Math.PI / 2; a1.position.y = 0.4; podio.add(a1);
  const a2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.004, 0.007, 8, 400), matAnello(-0.03, i * 0.7, 1.2)); a2.rotation.x = -Math.PI / 2; a2.position.y = 0.2; podio.add(a2);
  const sotto = new THREE.Mesh(new THREE.CircleGeometry(R - 0.7, 96), new THREE.MeshBasicMaterial({ color: C('#ffc070', 0.3) })); sotto.rotation.x = Math.PI / 2; sotto.position.y = -0.001; podio.add(sotto);
  anelli.push(a1.material, a2.material);
  const isola = def.crea(); isola.gruppo.position.y = TOP; g.add(isola.gruppo);
  isola.gruppo.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
  isole[def.id] = { def, g, podio, isola };
}

// ---------- pavimento lucido (riflesso sfumato + griglia cinetica + orizzonte) ----------
const pavShader = {
  name: 'PavimentoERI',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uT: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uOro: { value: C('#ffc879') }, uOrizz: { value: PAL.arancio.clone().lerp(PAL.oro, 0.4).multiplyScalar(0.9) },
    uIsole: { value: ISOLE.map(d => new THREE.Vector4(d.pos.x, 0, d.pos.z, R)) }, uSfoc: { value: 0.009 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uT, uSfoc; uniform vec3 uCam, uOro, uOrizz; uniform vec4 uIsole[3];
    varying vec4 vUv; varying vec3 vW;
    float linea(float x, float w){ float f = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-4); return 1.0 - min(f / w, 1.0); }
    void main(){
      vec2 uv = vUv.xy / vUv.w; vec3 r = vec3(0.0);
      for (int i = 0; i < 16; i++){ float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 16.0); r += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * rr * uSfoc).rgb; }
      r /= 16.0;
      vec3 V = normalize(uCam - vW); float dist = length(vW.xz - uCam.xz);
      float fres = 0.05 + 0.6 * pow(1.0 - max(V.y, 0.0), 5.0);
      vec3 col = vec3(0.008, 0.007, 0.014) + r * (0.05 + fres * 0.5);
      vec2 p = vW.xz; float rc = length(p - vec2(0.0, -0.5));
      float g1 = max(linea(p.x, 0.9), linea(p.y, 0.9)), g2 = max(linea(p.x / 4.0, 1.1), linea(p.y / 4.0, 1.1));
      float fade = exp(-rc * 0.04) * smoothstep(90.0, 8.0, dist);
      float onda = mod(uT * 6.0, 80.0); float w = exp(-pow((rc - onda) / 1.6, 2.0)) * (1.0 - onda / 80.0);
      col += uOro * ((g1 * 0.006 + g2 * 0.02) + (g1 * 0.12 + g2 * 0.28) * w) * fade;
      for (int i = 0; i < 3; i++){ float d = length(p - uIsole[i].xz) - uIsole[i].w; col += uOro * 0.18 * exp(-max(d + 1.2, 0.0) * 1.3) + uOro * 0.06 * exp(-abs(d - 0.7) * 6.0) * 0.0; }
      col = mix(col, uOrizz, smoothstep(30.0, 190.0, dist));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
const pavimento = new Reflector(new THREE.PlaneGeometry(900, 900), { shader: pavShader, textureWidth: Math.round(innerWidth * DPR * 0.6), textureHeight: Math.round(innerHeight * DPR * 0.6), clipBias: 0.002, multisample: 4 });
pavimento.rotation.x = -Math.PI / 2; scene.add(pavimento);
pavimento.camera.layers.set(0); camera.layers.enable(1); // polvere e stelle non si riflettono (il riflesso sfocato le trasformerebbe in segni)

// cerchi tratteggiati rotanti sul pavimento attorno alle isole
const matTratt = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uProg: { value: 0 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT, uProg; varying vec2 vP; void main(){ float a = atan(vP.y, vP.x) / 6.28318 + 0.5; if (a > uProg) discard;
    float d = step(0.55, fract(a * 140.0 + uT * 0.6)); float tick = step(0.94, fract(a * 12.0 - uT * 0.05));
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.4) * (0.25 * d + tick * 1.6), 1.0); }`,
  ...ADDITIVO,
});
for (const d of ISOLE) { const m = new THREE.Mesh(new THREE.RingGeometry(R + 0.55, R + 0.58, 256), matTratt); m.rotation.x = -Math.PI / 2; m.position.set(d.pos.x, 0.004, d.pos.z); scene.add(m); }

// linee d'energia sul pavimento: FV → BESS, idro → BESS, BESS → rete (verso l'orizzonte)
function nastro(punti, larg) {
  const curva = new THREE.CatmullRomCurve3(punti), n = 240, pos = [], uv = [], idx = [];
  const lung = curva.getLength();
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = curva.getPointAt(u), t = curva.getTangentAt(u), nx = -t.z, nz = t.x;
    pos.push(p.x + nx * larg, 0.006, p.z + nz * larg, p.x - nx * larg, 0.006, p.z - nz * larg); uv.push(u * lung, 0, u * lung, 1);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
const matFlusso = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uProg: { value: 0 } },
  vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT, uProg; varying vec2 vU; void main(){ if (vU.x > uProg * 60.0) discard;
    float bordo = 1.0 - abs(vU.y - 0.5) * 2.0; float imp = pow(fract(vU.x * 0.16 - uT * 0.45), 14.0);
    gl_FragColor = vec4(vec3(1.0, 0.74, 0.42) * (0.18 + imp * 3.5) * bordo, 1.0); }`,
  ...ADDITIVO,
});
const P = (x, z) => new THREE.Vector3(x, 0, z);
const [IF, IB, II] = ISOLE.map(d => d.pos);
const bordo = (a, b, s = 1) => a.clone().add(b.clone().sub(a).setY(0).normalize().multiplyScalar(R + 0.6 * s));
for (const pts of [
  [bordo(IF, IB), P((IF.x + IB.x) / 2, (IF.z + IB.z) / 2 + 1.2), bordo(IB, IF)],
  [bordo(II, IB), P((II.x + IB.x) / 2, (II.z + IB.z) / 2 + 1.2), bordo(IB, II)],
  [P(IB.x, IB.z - R - 0.6), P(IB.x + 0.4, -20), P(-1.5, -60), P(0, -140)],
]) scene.add(new THREE.Mesh(nastro(pts, 0.035), matFlusso));

// polvere d'oro sospesa
const polvere = (() => {
  const n = 1700, pos = new Float32Array(n * 3), s = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * 46, 0.3 + Math.random() * 9, -16 + Math.random() * 30], i * 3); s.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPx: { value: DPR * innerHeight / 900 }, uC: { value: C('#ffd27a', 2.6) } },
    vertexShader: `uniform float uT, uPx; attribute vec4 aS; varying float vA;
      void main(){ vec3 p = position;
        p += vec3(sin(uT * 0.21 * (0.5 + aS.x) + aS.y * 6.28) * 0.7, 0.0, cos(uT * 0.17 * (0.5 + aS.y) + aS.x * 6.28) * 0.7);
        p.y = 0.3 + mod(p.y - 0.3 + uT * (0.04 + aS.w * 0.08), 9.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.15 + 0.85 * pow(0.5 + 0.5 * sin(uT * (0.8 + aS.x * 2.5) + aS.z * 40.0), 6.0)) * smoothstep(0.6, 3.0, -mv.z) * smoothstep(0.3, 1.2, p.y) * smoothstep(9.3, 7.5, p.y);
        gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (1.2 + aS.w * 2.6) * (22.0 / -mv.z) + 1.0; }`,
    fragmentShader: `uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = (smoothstep(0.5, 0.0, d) * 0.6 + smoothstep(0.18, 0.0, d)) * vA; gl_FragColor = vec4(uC * a, 1.0); }`,
    ...ADDITIVO,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.layers.set(1); scene.add(p); return m;
})();

// ---------- post-produzione ----------
const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.5, 1.1);
const QS = new URLSearchParams(location.search);
if (!QS.has('nobloom')) composer.addPass(bloom);
composer.addPass(new OutputPass());
const finitura = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRis: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRis; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5; float v = smoothstep(0.9, 0.3, length(q * vec2(1.0, 0.9)));
      c.rgb *= mix(0.68, 1.0, v); c.rgb += (h(vUv * uRis + fract(uT * 7.0) * 100.0) - 0.5) * 0.02; gl_FragColor = c; }`,
});
composer.addPass(finitura);

// ---------- camera e viste ----------
const VISTE = { insieme: { pos: [0, 4.3, 30.5], target: [0, 3.05, 0], fov: 30, off: 0 } };
for (const k in isole) {
  const { isola, g } = isole[k];
  g.updateMatrixWorld(true);
  for (const [nome, v] of Object.entries(isola.viste || {})) {
    VISTE[nome] = { pos: isola.gruppo.localToWorld(new THREE.Vector3(...v.pos)).toArray(), target: isola.gruppo.localToWorld(new THREE.Vector3(...v.target)).toArray(), fov: v.fov, off: 0.17 };
  }
}
const cam = { pos: new THREE.Vector3(...VISTE.insieme.pos), target: new THREE.Vector3(...VISTE.insieme.target), fov: 28, off: 0 };
let volo = null, vistaCorrente = 'insieme';
const mouse = new THREE.Vector2(), mouseL = new THREE.Vector2();
addEventListener('pointermove', e => mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function applicaOmbre(nome) {
  const v = VISTE[nome], vicino = nome !== 'insieme';
  const t = new THREE.Vector3(...v.target);
  const c = vicino ? t : new THREE.Vector3(0, 0, -0.5);
  const s = vicino ? 4.2 : 1;
  sole.target.position.copy(c); sole.position.copy(c).addScaledVector(DIR_SOLE, 40);
  Object.assign(sole.shadow.camera, vicino ? { left: -s, right: s, top: s, bottom: -s } : { left: -19, right: 19, top: 14, bottom: -14 });
  sole.shadow.camera.updateProjectionMatrix();
}

function vista(nome, { anima = false } = {}) {
  if (!VISTE[nome]) return false;
  completaIntro();
  const v = VISTE[nome];
  vistaCorrente = nome;
  document.body.dataset.vista = nome;
  applicaOmbre(nome);
  const fine = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), fov: v.fov, off: v.off };
  if (!anima) { volo = null; cam.pos.copy(fine.pos); cam.target.copy(fine.target); cam.fov = fine.fov; cam.off = fine.off; }
  else volo = { da: { pos: cam.pos.clone(), target: cam.target.clone(), fov: cam.fov, off: cam.off }, a: fine, t0: performance.now(), dur: 2400 };
  return true;
}
window.vista = vista;

// ---------- intro cinetica: i podi salgono, gli anelli si disegnano, i pezzi si posano ----------
let introT0 = null, introFatta = false;
const pezzi = [];
for (const [i, k] of Object.keys(isole).entries()) {
  isole[k].isola.pezzi.forEach((p, j) => { pezzi.push({ o: p, y0: p.position.y, rit: 1.15 + i * 0.25 + j * 0.07 }); });
}
function introAgg(s) {
  const e5 = x => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 5);
  Object.values(isole).forEach(({ g }, i) => { g.position.y = -1.6 * (1 - e5((s - 0.1 - i * 0.18) / 1.3)); });
  anelli.forEach((m, i) => { m.uniforms.uProg.value = Math.min(1, Math.max(0, (s - 0.5 - (i >> 1) * 0.15) / 1.4)); });
  matTratt.uniforms.uProg.value = Math.min(1, Math.max(0, (s - 1.0) / 1.6));
  matFlusso.uniforms.uProg.value = Math.min(1, Math.max(0, (s - 2.0) / 2.0));
  for (const p of pezzi) { const k = (s - p.rit) / 0.9; p.o.visible = k > 0; p.o.position.y = p.y0 + 2.4 * (1 - e5(k)); }
}
function completaIntro() { if (!introFatta) { introFatta = true; introAgg(99); document.body.classList.add('entrata', 'fine-intro'); } }

// ---------- etichette sulle isole ----------
const etichette = [...document.querySelectorAll('.etichetta')].map(el => ({ el, isola: isole[el.dataset.isola] }));
etichette.forEach(({ el }) => el.addEventListener('click', () => vista(el.dataset.isola, { anima: true })));
document.querySelectorAll('[data-vista]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); vista(el.dataset.vista, { anima: true }); }));
const _v = new THREE.Vector3();
function aggiornaEtichette() {
  for (const { el, isola } of etichette) {
    _v.copy(isola.def.pos); _v.y = isola.g.position.y - 0.05; _v.z += R + 0.55;
    _v.project(camera);
    el.style.transform = `translate(${((_v.x + 1) / 2) * innerWidth}px, ${((1 - _v.y) / 2) * innerHeight}px)`;
  }
}

// ---------- ciclo ----------
const orologio = new THREE.Clock();
let fotogrammi = 0;
function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  pavimento.getRenderTarget().setSize(Math.round(w * DPR * 0.6), Math.round(h * DPR * 0.6));
  finitura.uniforms.uRis.value.set(w, h); polvere.uniforms.uPx.value = DPR * h / 900;
  isole.idro.isola.impostaPx?.(DPR * h / 900);
}
addEventListener('resize', ridimensiona);
isole.idro.isola.impostaPx?.(DPR * innerHeight / 900);

function ciclo() {
  requestAnimationFrame(ciclo);
  const t = orologio.getElapsedTime();
  if (introT0 === null) introT0 = t;
  if (!introFatta) { const s = t - introT0; introAgg(s); if (s > 5.2) completaIntro(); }
  for (const k in isole) isole[k].isola.aggiorna(t);
  anelli.forEach(m => (m.uniforms.uT.value = t));
  matTratt.uniforms.uT.value = t; matFlusso.uniforms.uT.value = t; polvere.uniforms.uT.value = t;
  cielo.material.uniforms.uT.value = t; cielo.userData.stelle.uniforms.uT.value = t; finitura.uniforms.uT.value = t;
  pavimento.material.uniforms.uT.value = t;

  if (volo) {
    const k = Math.min(1, (performance.now() - volo.t0) / volo.dur), e = ease(k);
    cam.pos.lerpVectors(volo.da.pos, volo.a.pos, e); cam.pos.y += Math.sin(Math.PI * e) * 1.2;
    cam.target.lerpVectors(volo.da.target, volo.a.target, e);
    cam.fov = THREE.MathUtils.lerp(volo.da.fov, volo.a.fov, e); cam.off = THREE.MathUtils.lerp(volo.da.off, volo.a.off, e);
    if (k >= 1) volo = null;
  }
  mouseL.lerp(mouse, 0.04);
  const vicino = vistaCorrente !== 'insieme';
  const amp = vicino ? 0.12 : 0.6;
  const off = new THREE.Vector3(Math.sin(t * 0.09) * amp + mouseL.x * amp * 1.2, Math.sin(t * 0.13) * amp * 0.25 - mouseL.y * amp * 0.5, 0);
  camera.position.copy(cam.pos).add(off);
  camera.lookAt(cam.target);
  camera.fov = cam.fov;
  if (cam.off > 0.001 && innerWidth > 820) camera.setViewOffset(innerWidth, innerHeight, -cam.off * innerWidth, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  cielo.position.copy(camera.position);
  pavimento.material.uniforms.uCam.value.copy(camera.position);
  pavimento.material.uniforms.uSfoc.value = vicino ? 0.008 : 0.014;
  aggiornaEtichette();
  composer.render();
  fotogrammi++;
  if (introFatta && fotogrammi > 3 && !window.__eri.pronto) { window.__eri.pronto = true; }
}
applicaOmbre('insieme');

document.body.classList.add('entrata');
requestAnimationFrame(ciclo);
