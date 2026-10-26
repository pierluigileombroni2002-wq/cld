// Showroom ERI · isola 3: turbina Pelton in inox lucido con getto d'acqua luminoso.
// Albero lungo Z (girante a sbalzo davanti, generatore dietro). Origine = piano del podio.
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { M, box, cil, cavo, istanze, flangia, geoBullone, ADDITIVO } from './showroom-mat.js';

const N_CUC = 20, RR = 0.58, LB = 0.44, WB = 0.38, DB = 0.13, YC = 1.45;
const RP = RR + LB * 0.55; // cerchio primitivo (dove colpisce il getto)

function geoCucchiaio() {
  const hw = v => (WB / 2) * Math.sqrt(Math.max(0.0001, 1 - ((v - 0.45) / 0.62) ** 2));
  const pr = v => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.7);
  const tacca = (xn, v) => (v > 0.78 && Math.abs(xn) < 0.42 ? (1 - (xn / 0.42) ** 2) * LB * 0.12 * ((v - 0.78) / 0.22) : 0);
  const interno = new ParametricGeometry((u, v, t) => {
    const xn = 2 * u - 1, x = xn * hw(v);
    const d = 1 - ((Math.abs(xn) - 0.5) / 0.5) ** 2;
    t.set(x, v * LB - tacca(xn, v), -DB * d * pr(v));
  }, 48, 40);
  const esterno = new ParametricGeometry((u, v, t) => {
    const xn = 2 * u - 1, x = xn * hw(v);
    t.set(x, v * LB - tacca(xn, v), -DB * 1.22 * Math.pow(Math.max(0, 1 - xn * xn), 0.75) * Math.pow(pr(v), 0.8) - 0.004 * pr(v));
  }, 48, 40);
  return [interno, esterno];
}

function girante() {
  const g = new THREE.Group();
  const [gi, ge] = geoCucchiaio();
  const matI = M.inox.clone(); matI.side = THREE.DoubleSide;
  const imI = new THREE.InstancedMesh(gi, matI, N_CUC), imE = new THREE.InstancedMesh(ge, matI, N_CUC);
  const radice = new THREE.CylinderGeometry(0.05, 0.065, 0.16, 20); radice.rotateX(Math.PI / 2);
  const imR = new THREE.InstancedMesh(radice, M.inoxSatinato, N_CUC);
  const m = new THREE.Matrix4(), ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3();
  for (let i = 0; i < N_CUC; i++) {
    const a = (i / N_CUC) * Math.PI * 2;
    ey.set(Math.cos(a), Math.sin(a), 0); ez.set(Math.sin(a), -Math.cos(a), 0); ex.crossVectors(ey, ez);
    m.makeBasis(ex, ey, ez); m.setPosition(ey.x * RR, ey.y * RR, 0);
    imI.setMatrixAt(i, m); imE.setMatrixAt(i, m);
    const mr = new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(ey.x * (RR - 0.03), ey.y * (RR - 0.03), -0.02);
    imR.setMatrixAt(i, mr);
  }
  for (const im of [imI, imE, imR]) { im.castShadow = im.receiveShadow = true; g.add(im); }
  // mozzo: disco con smussi, bulloni dei cucchiai, ogiva frontale
  const prof = [[0, -0.09], [RR - 0.02, -0.09], [RR + 0.01, -0.06], [RR + 0.01, 0.05], [RR - 0.02, 0.08], [0.24, 0.08], [0.2, 0.17], [0, 0.17]].map(([r, y]) => new THREE.Vector2(r, y));
  const mozzo = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), M.inox); mozzo.rotation.x = Math.PI / 2; mozzo.castShadow = true; g.add(mozzo);
  const ogiva = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.inox); ogiva.rotation.x = Math.PI / 2; ogiva.position.z = 0.17; g.add(ogiva);
  const bul = [];
  for (let i = 0; i < N_CUC * 2; i++) {
    const a = (i / (N_CUC * 2)) * Math.PI * 2;
    bul.push({ p: new THREE.Vector3(Math.cos(a) * (RR - 0.08), Math.sin(a) * (RR - 0.08), 0.08), n: new THREE.Vector3(0, 0, 1), rot: a });
    bul.push({ p: new THREE.Vector3(Math.cos(a) * (RR - 0.08), Math.sin(a) * (RR - 0.08), -0.09), n: new THREE.Vector3(0, 0, -1), rot: a });
  }
  g.add(istanze(geoBullone(0.013), M.inoxSatinato, bul));
  const bulC = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; bulC.push({ p: new THREE.Vector3(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.12), n: new THREE.Vector3(0, 0, 1), rot: a }); }
  const rondelle = istanze(geoBullone(0.016), M.oro, bulC); rondelle.position.z = 0.0; g.add(rondelle);
  return g;
}

function supporto(h) { // supporto a cuscinetto (plummer block) con cappello imbullonato
  const g = new THREE.Group();
  const piede = box(0.46, 0.08, 0.3, M.grafite, 0.012); piede.position.y = 0.04; g.add(piede);
  const col = box(0.3, h - 0.25, 0.24, M.grafite, 0.02); col.position.y = (h - 0.25) / 2 + 0.06; g.add(col);
  const sede = cil(0.19, 0.19, 0.24, M.grafite, 48); sede.rotation.x = Math.PI / 2; sede.position.y = h; g.add(sede);
  const cappello = cil(0.2, 0.2, 0.12, M.inoxSatinato, 48); cappello.rotation.x = Math.PI / 2; cappello.position.y = h; g.add(cappello);
  for (const sz of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 12, 48), M.gomma); t.position.set(0, h, sz * 0.125); g.add(t); }
  const bul = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bul.push({ p: new THREE.Vector3(sx * 0.17, 0.08, sz * 0.1), n: new THREE.Vector3(0, 1, 0) });
    bul.push({ p: new THREE.Vector3(sx * 0.215, h - 0.02, sz * 0.07), n: new THREE.Vector3(0, 1, 0) });
  }
  g.add(istanze(geoBullone(0.016), M.inoxSatinato, bul));
  for (const sx of [-1, 1]) { const o = box(0.08, 0.04, 0.2, M.grafite, 0.01); o.position.set(sx * 0.2, h - 0.04, 0); g.add(o); }
  const ingr = cil(0.008, 0.01, 0.04, M.ottone, 12); ingr.position.set(0, h + 0.21, 0); g.add(ingr);
  return g;
}

function generatore() {
  const g = new THREE.Group();
  const lung = 1.1, r = 0.5;
  const corpo = cil(r, r, lung, M.bianco, 96); corpo.rotation.x = Math.PI / 2; g.add(corpo);
  const alette = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (Math.sin(a) < -0.6) continue;
    alette.push({ p: new THREE.Vector3(Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02), 0), n: new THREE.Vector3(Math.cos(a), Math.sin(a), 0) });
  }
  const ga = new THREE.BoxGeometry(0.012, 0.05, lung * 0.86); g.add(istanze(ga, M.biancoGriglia, alette));
  for (const sz of [-1, 1]) {
    const prof = [[0, 0], [r * 0.98, 0], [r + 0.03, 0.03], [r + 0.03, 0.08], [r * 0.7, 0.16], [0.16, 0.2], [0, 0.2]].map(([a, b]) => new THREE.Vector2(a, b));
    const cam = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), M.grafite); cam.castShadow = true;
    cam.rotation.x = sz * Math.PI / 2; cam.position.z = sz * lung / 2; g.add(cam);
  }
  for (const sx of [-1, 1]) { const p = box(0.16, 0.3, lung * 0.8, M.grafite, 0.02); p.position.set(sx * 0.3, -r + 0.02, 0); g.add(p); }
  const mors = box(0.3, 0.2, 0.34, M.grafite, 0.02); mors.position.set(0, r + 0.1, -0.1); g.add(mors);
  for (let i = 0; i < 3; i++) {
    const pc = cil(0.022, 0.022, 0.05, M.ottone, 16); pc.rotation.z = Math.PI / 2; pc.position.set(0.17, r + 0.1, -0.2 + i * 0.1); g.add(pc);
    g.add(cavo([new THREE.Vector3(0.19, r + 0.1, -0.2 + i * 0.1), new THREE.Vector3(0.45, r + 0.05, -0.25 + i * 0.1), new THREE.Vector3(0.62, 0.0, -0.3 + i * 0.1), new THREE.Vector3(0.66, -YC + 0.05, -0.32 + i * 0.1)], 0.02, M.cavo, 48));
  }
  const targa = box(0.16, 0.1, 0.005, M.inoxSatinato, 0.002); targa.position.set(-0.25, 0.25, lung / 2 - 0.2); targa.rotation.y = -0.6; g.add(targa);
  return g;
}

function iniettore() { // ugello lungo +X con spina, flange e valvola sferica
  const g = new THREE.Group();
  const prof = [[0.15, 0], [0.16, 0.02], [0.16, 0.06], [0.13, 0.08], [0.12, 0.3], [0.085, 0.46], [0.075, 0.5], [0.068, 0.5], [0.06, 0.47], [0, 0.47]].map(([r, y]) => new THREE.Vector2(r, y));
  const ug = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.inox); ug.rotation.z = -Math.PI / 2; ug.castShadow = true; g.add(ug);
  const spina = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 32), M.cromo); spina.rotation.z = -Math.PI / 2; spina.position.x = 0.5; g.add(spina);
  const tubo = cil(0.14, 0.14, 1.0, M.inoxSatinato, 64); tubo.rotation.z = Math.PI / 2; tubo.position.x = -0.5; g.add(tubo);
  for (const x of [0, -0.62, -1.0]) { const f = flangia(0.22, 0.135, 0.05, 12, M.inoxSatinato, M.inox); f.rotation.z = -Math.PI / 2; f.position.x = x - 0.025; g.add(f); }
  const valv = new THREE.Mesh(new THREE.SphereGeometry(0.25, 64, 32), M.grafite); valv.position.x = -1.25; valv.castShadow = true; g.add(valv);
  const att = box(0.16, 0.22, 0.16, M.grafite, 0.02); att.position.set(-1.25, 0.33, 0); g.add(att);
  const vol = cil(0.12, 0.12, 0.03, M.oro, 48); vol.position.set(-1.25, 0.46, 0); g.add(vol);
  const t2 = cil(0.14, 0.14, 0.5, M.inoxSatinato, 64); t2.rotation.z = Math.PI / 2; t2.position.x = -1.7; g.add(t2);
  const gomito = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.14, 32, 48, Math.PI / 2), M.inoxSatinato); gomito.position.set(-1.95, -0.3, 0); gomito.rotation.z = Math.PI / 2; gomito.castShadow = true; g.add(gomito);
  const disc = cil(0.14, 0.14, 1, M.inoxSatinato, 64); disc.position.set(-2.25, -0.8, 0); g.add(disc);
  return g;
}

function acquaGetto(lung) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT; varying vec2 vU; varying vec3 vN; varying vec3 vV;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 1.5);
        float s = 0.6 + 0.4 * sin(vU.y * 60.0 - uT * 40.0 + sin(vU.x * 25.0) * 2.0) * sin(vU.x * 18.0 + uT * 3.0);
        vec3 c = mix(vec3(0.55, 1.6, 2.6), vec3(2.2, 3.4, 4.0), s * (1.0 - f));
        gl_FragColor = vec4(c * (0.85 + 0.6 * f), 1.0); }`,
  });
  const g = new THREE.Group();
  const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.046, lung, 32, 24, true), mat); nucleo.rotation.z = -Math.PI / 2; g.add(nucleo);
  const alone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, lung, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fd6ff').multiplyScalar(0.12), ...ADDITIVO }));
  alone.rotation.z = -Math.PI / 2; g.add(alone);
  g.userData.mat = mat; return g;
}

function spruzzi(n) {
  const geo = new THREE.BufferGeometry(), seme = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seme[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeme', new THREE.BufferAttribute(seme, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `uniform float uT; uniform float uPx; attribute vec4 aSeme; varying float vA;
      void main(){ float age = fract(uT * (0.9 + aSeme.w * 0.6) + aSeme.x);
        float lato = aSeme.y < 0.5 ? -1.0 : 1.0;
        vec3 v = vec3(-0.5 - aSeme.z * 0.9, 0.2 + aSeme.w * 0.9, lato * (0.7 + aSeme.z * 1.3));
        vec3 p = v * age * 1.1 + vec3(0.0, -2.2, 0.0) * age * age;
        vA = (1.0 - age) * smoothstep(0.0, 0.05, age);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (0.012 + aSeme.z * 0.02) * (300.0 / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.2, 2.4, 3.2) * a, a); }`,
    ...ADDITIVO,
  });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; p.userData.mat = mat; return p;
}

function vasca(w, d) {
  const g = new THREE.Group();
  const bordo = 0.08, h = 0.22;
  for (const [x, z, ww, dd] of [[0, d / 2, w + bordo * 2, bordo], [0, -d / 2, w + bordo * 2, bordo], [w / 2, 0, bordo, d], [-w / 2, 0, bordo, d]]) {
    const b = box(ww, h, dd, M.grafite, 0.02); b.position.set(x, h / 2, z); g.add(b);
  }
  const fondo = box(w, 0.02, d, M.nero, 0); fondo.position.y = 0.01; g.add(fondo);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uT; varying vec2 vU;
      void main(){ vec2 p = (vU - 0.5) * vec2(${(w * 6).toFixed(1)}, ${(d * 6).toFixed(1)});
        float r = length(p - vec2(${(w * 0.4 * 6 * 0.1).toFixed(2)}, 0.0));
        float onde = 0.5 + 0.5 * sin(r * 3.2 - uT * 3.0);
        float c1 = pow(abs(sin(p.x * 1.3 + sin(p.y * 1.7 + uT * 0.8) * 1.4 + uT * 0.6)), 18.0);
        float c2 = pow(abs(sin(p.y * 1.1 + sin(p.x * 1.2 - uT * 0.7) * 1.6 - uT * 0.5)), 18.0);
        float e = smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.92, vU.x) * smoothstep(0.0, 0.1, vU.y) * smoothstep(1.0, 0.9, vU.y);
        vec3 base = vec3(0.02, 0.18, 0.32) + vec3(0.05, 0.35, 0.55) * onde * 0.35;
        vec3 col = base + vec3(0.6, 1.7, 2.3) * (c1 + c2) * 0.45;
        gl_FragColor = vec4(col * (0.4 + 0.6 * e), 1.0); }`,
  });
  const acqua = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); acqua.rotation.x = -Math.PI / 2; acqua.position.y = h - 0.05; g.add(acqua);
  g.userData.mat = mat; return g;
}

export function creaIdro() {
  const gruppo = new THREE.Group();
  const ass = new THREE.Group(); ass.position.set(0.35, 0, 0.55); ass.rotation.y = -0.62; gruppo.add(ass);
  const gir = girante(); gir.position.set(0, YC, 0.0); ass.add(gir);
  const albero = cil(0.085, 0.085, 1.9, M.inoxSatinato, 48); albero.rotation.x = Math.PI / 2; albero.position.set(0, YC, -0.9); ass.add(albero);
  const sup = supporto(YC); sup.position.z = -0.62; ass.add(sup);
  for (const z of [-1.0, -1.08]) { const f = flangia(0.22, 0.08, 0.06, 10, M.inoxSatinato, M.inox); f.rotation.x = z > -1.05 ? Math.PI / 2 : -Math.PI / 2; f.position.set(0, YC, z); ass.add(f); }
  const gen = generatore(); gen.position.set(0, YC, -1.78); ass.add(gen);
  const basamento = box(1.3, 0.1, 2.3, M.acciaioScuro, 0.02); basamento.position.set(0, 0.05, -1.25); ass.add(basamento);
  const bb = []; for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) bb.push({ p: new THREE.Vector3(sx * 0.58, 0.1, -2.25 + i * 0.4), n: new THREE.Vector3(0, 1, 0) });
  ass.add(istanze(geoBullone(0.018), M.inoxSatinato, bb));
  const inj = iniettore(); inj.position.set(-1.62, YC - RP, 0); ass.add(inj);
  const xBocca = -1.62 + 0.5, xImpatto = -0.06;
  const getto = acquaGetto(xImpatto - xBocca); getto.position.set((xBocca + xImpatto) / 2, YC - RP, 0); ass.add(getto);
  const spr = spruzzi(900); spr.position.set(xImpatto, YC - RP, 0); ass.add(spr);
  const vas = vasca(2.3, 1.5); vas.position.set(0.1, 0, 0); ass.add(vas);
  const anello = new THREE.Mesh(new THREE.TorusGeometry(RR + LB + 0.16, 0.006, 8, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.8) })); anello.position.set(0, YC, 0); ass.add(anello);
  const luce = new THREE.PointLight('#6fd8ff', 0.6, 2.2, 2); luce.position.set(-0.3, YC - RP + 0.05, 0.25); ass.add(luce);
  ass.updateMatrix();
  const inG = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(ass.matrix).toArray();
  return {
    gruppo, pezzi: [gir, sup, gen, inj, vas, basamento],
    luce,
    viste: { idro: { pos: inG(-2.7, 2.5, 6.4), target: inG(-0.45, 1.05, 0.0), fov: 30 } },
    aggiorna(t) {
      gir.rotation.z = t * 1.6;
      getto.userData.mat.uniforms.uT.value = t;
      spr.userData.mat.uniforms.uT.value = t;
      vas.userData.mat.uniforms.uT.value = t;
      anello.rotation.z = t * 0.1;
      luce.intensity = 0.55 + Math.sin(t * 13.0) * 0.08;
    },
    impostaPx(px) { spr.userData.mat.uniforms.uPx.value = px; },
  };
}
