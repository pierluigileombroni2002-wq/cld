// ERI v3 · scena: cielo al crepuscolo, stelle, polvere d'oro, pavimento lucido stilizzato, piedistalli con anelli d'oro, faro finale.
// Niente ombre, niente riflessi veri: il "lucido" del pavimento è un gradiente calcolato nello shader.
import * as THREE from 'three';

// somma additiva che NON tocca l'alfa (altrimenti il bloom esplode in Inf/NaN)
export const ADDITIVO = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false,
};

const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
export const PAL = {
  zenit: C('#0a0920'), indaco: C('#151335'), malva: C('#5a2f58'), arancio: C('#e8975a', 1.05), oro: C('#ffcf8a', 1.12),
  oroLuce: C('#ffd27a'),
};
export const SOLE = new THREE.Vector3(0.04, 0.012, -1).normalize();
export const VOLO = 0.32;          // i piedistalli galleggiano sul pavimento
export const N_ISOLE = 4;          // FV, BESS, idroelettrico, faro (aloni sul pavimento)

// ---------- cielo ----------
const cieloFrag = `
  uniform vec3 cZenit, cIndaco, cMalva, cArancio, cOro, uSole; uniform float uT, uLuce;
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
    c += cOro * (pow(s, 60.0) * 0.25 + pow(s, 12.0) * 0.05) * (1.0 + uLuce * 1.6) * smoothstep(-0.04, 0.01, e);
    c += cOro * pow(s, 900.0) * (0.6 + uLuce * 1.4);
    float b1 = exp(-pow((e - 0.05 - 0.008 * sin(az * 2.0 + uT * 0.03)) / 0.0035, 2.0)) * smoothstep(0.1, 1.0, sin(az * 5.0 + uT * 0.02));
    float b2 = exp(-pow((e - 0.085 - 0.01 * sin(az * 3.0 - uT * 0.025)) / 0.0025, 2.0)) * smoothstep(0.2, 1.0, sin(az * 4.0 - uT * 0.015 + 1.0));
    float b3 = exp(-pow((e - 0.026 - 0.006 * sin(az * 4.0 + uT * 0.02)) / 0.004, 2.0)) * smoothstep(0.0, 1.0, sin(az * 3.0 + 2.0 + uT * 0.01));
    c += vec3(1.0, 0.6, 0.45) * (b1 * 0.12 + b2 * 0.05) + vec3(1.0, 0.75, 0.5) * b3 * 0.3;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function materialeCielo() {
  return new THREE.ShaderMaterial({
    uniforms: { cZenit: { value: PAL.zenit }, cIndaco: { value: PAL.indaco }, cMalva: { value: PAL.malva }, cArancio: { value: PAL.arancio }, cOro: { value: PAL.oro },
      uSole: { value: SOLE }, uT: { value: 0 }, uLuce: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: cieloFrag, side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
}

// quadrante da orologio per il piano dei piedistalli
function texQuadrante(lato) {
  const c = document.createElement('canvas'); c.width = c.height = lato;
  const g = c.getContext('2d'), m = lato / 2, k = lato / 2048;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, '#24222c'); gr.addColorStop(0.75, '#18171e'); gr.addColorStop(1, '#121118');
  g.fillStyle = gr; g.fillRect(0, 0, lato, lato);
  g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1.2 * k;
  for (let r = 40 * k; r < m; r += 26 * k) { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = '#d6a85a';
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2, lung = (i % 20 === 0 ? 46 : i % 5 === 0 ? 26 : 12) * k;
    g.globalAlpha = i % 20 === 0 ? 0.85 : 0.45; g.lineWidth = (i % 20 === 0 ? 3 : 1.5) * k;
    g.beginPath(); g.moveTo(m + Math.cos(a) * (m - 18 * k), m + Math.sin(a) * (m - 18 * k));
    g.lineTo(m + Math.cos(a) * (m - 18 * k - lung), m + Math.sin(a) * (m - 18 * k - lung)); g.stroke();
  }
  g.globalAlpha = 0.5; g.lineWidth = 2 * k; g.beginPath(); g.arc(m, m, m - 90 * k, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- ambiente ----------
export function creaAmbiente({ renderer, scene, qualita, materiali }) {
  // cielo che segue la camera
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), materialeCielo());
  cielo.renderOrder = -10; cielo.frustumCulled = false; scene.add(cielo);

  // stelle sottili (non entrano nella mappa d'ambiente)
  const N_STELLE = 1600;
  const stelle = (() => {
    const pos = new Float32Array(N_STELLE * 3), sem = new Float32Array(N_STELLE);
    for (let i = 0; i < N_STELLE; i++) {
      const e = 0.06 + Math.pow(Math.random(), 0.8) * 0.94, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - e * e);
      pos.set([Math.cos(a) * r * 1400, e * 1400, Math.sin(a) * r * 1400], i * 3); sem[i] = Math.random();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sem, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
      vertexShader: `uniform float uT, uPx; attribute float aS; varying float vA;
        void main(){ vec3 d = normalize(position); vA = smoothstep(0.08, 0.4, d.y) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (0.6 + aS * 2.2) + aS * 60.0), 3.0)) * (0.3 + aS * 0.9);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; gl_PointSize = uPx * (1.0 + step(0.93, aS) * 1.4); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * a * 1.4, 1.0); }`,
      ...ADDITIVO, depthTest: false,
    });
    const p = new THREE.Points(g, m); p.renderOrder = -9; p.frustumCulled = false; cielo.add(p); return p;
  })();

  // mappa d'ambiente per i metalli: cielo + softbox dorate da studio
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), materialeCielo()));
    const sb = (w, h, col, k, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: C(col, k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); env.add(m); };
    sb(30, 10, '#ffffff', 3.2, [0, 30, 6], [0, 0, 0]);
    sb(5, 26, '#fff6ea', 3.0, [-30, 8, 10], [0, 4, 0]);
    sb(5, 26, '#eef0ff', 2.4, [30, 8, 6], [0, 4, 0]);
    sb(40, 2.0, '#ffc68a', 1.2, [0, 3, -40], [0, 3, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
    env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  // luci (nessuna ombra)
  scene.add(new THREE.HemisphereLight('#4b4483', '#1a1016', 0.75));
  const chiave = new THREE.DirectionalLight('#fff0dc', 2.5); chiave.position.set(-14, 20, 16); scene.add(chiave);
  const controluce = new THREE.DirectionalLight('#ffb070', 2.2); controluce.position.set(8, 6, -26); scene.add(controluce);
  const riempi = new THREE.DirectionalLight('#b4b8ff', 0.6); riempi.position.set(0, 4, 24); scene.add(riempi);

  // pavimento lucido stilizzato: riflesso sfumato del cielo, scia del sole, griglia, aloni sotto le isole, onde d'oro
  const isoleU = Array.from({ length: N_ISOLE }, () => new THREE.Vector4(0, 0, 0, 0));
  const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOro: { value: C('#ffc879') }, uSole: { value: SOLE },
      uOrizz: { value: PAL.arancio.clone().lerp(PAL.oro, 0.4).multiplyScalar(0.9) }, uCielo: { value: PAL.malva.clone().lerp(PAL.indaco, 0.5) },
      uIsole: { value: isoleU }, uOnda: { value: new THREE.Vector4(0, 0, -1, 0) }, uLuce: { value: 0 },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uLuce; uniform vec3 uCam, uOro, uOrizz, uCielo, uSole; uniform vec4 uIsole[${N_ISOLE}]; uniform vec4 uOnda;
      varying vec3 vW;
      float linea(float x, float w){ float f = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-4); return 1.0 - min(f / w, 1.0); }
      void main(){
        vec3 V = normalize(uCam - vW); float dist = length(vW.xz - uCam.xz);
        float fres = exp(-max(V.y, 0.0) * 17.0);
        vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0)); float s = max(dot(R, uSole), 0.0);
        vec3 col = vec3(0.006, 0.006, 0.013);
        col += mix(uCielo * 0.6, uOrizz, fres) * fres * 0.4;
        col += uOro * (pow(s, 120.0) * 0.6 + pow(s, 20.0) * 0.04) * (0.6 + uLuce);
        vec2 p = vW.xz;
        float g1 = max(linea(p.x, 0.8), linea(p.y, 0.8)), g2 = max(linea(p.x / 4.0, 1.0), linea(p.y / 4.0, 1.0));
        float fade = smoothstep(60.0, 5.0, dist);
        float onda = 0.0;
        if (uOnda.z > 0.0) { float rc = length(p - uOnda.xy); onda = exp(-pow((rc - uOnda.z) / 1.4, 2.0)) * uOnda.w; }
        col += uOro * ((g1 * 0.005 + g2 * 0.015) + (g1 * 0.1 + g2 * 0.26) * onda) * fade;
        for (int i = 0; i < ${N_ISOLE}; i++) {
          vec4 isl = uIsole[i]; if (isl.z <= 0.0) continue;
          float d = length(p - isl.xy) - isl.z;
          col += uOro * (0.03 + 0.17 * isl.w) * exp(-max(d + 1.0, 0.0) * 1.25);
        }
        col = mix(col, uOrizz * 0.85, smoothstep(80.0, 330.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  pavimento.rotation.x = -Math.PI / 2; pavimento.renderOrder = -5; scene.add(pavimento);

  // polvere d'oro sospesa lungo tutto il percorso
  const N_POLVERE = 1500;
  const polvere = (() => {
    const pos = new Float32Array(N_POLVERE * 3), s = new Float32Array(N_POLVERE * 4);
    for (let i = 0; i < N_POLVERE; i++) {
      pos.set([(Math.random() - 0.5) * 52, 0.3 + Math.random() * 9, -82 + Math.random() * 120], i * 3);
      s.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uC: { value: C('#ffd27a', 2.6) } },
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
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  })();

  // materiali condivisi dei piedistalli
  const matPodio = materiali?.podio || new THREE.MeshPhysicalMaterial({ color: '#141319', metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 0.6 });
  // quadrante: fisico (velo di vernice) solo in alta; altrove standard, più leggero
  const opzQ = { map: texQuadrante(qualita === 'alta' ? 2048 : 1024), color: '#8d8a9c', metalness: 0, roughness: 0.66, envMapIntensity: 0.1 };
  const matQuadrante = qualita === 'alta'
    ? new THREE.MeshPhysicalMaterial({ ...opzQ, clearcoat: 0.05, clearcoatRoughness: 0.4, specularIntensity: 0.3 })
    : new THREE.MeshStandardMaterial({ ...opzQ, roughness: 0.72 });
  const matSotto = new THREE.MeshBasicMaterial({ color: C('#ffc070', 0.3) });

  let ondaT0 = -1, ondaX = 0, ondaZ = 0;
  const amb = {
    cielo, stelle, pavimento, polvere, matPodio, matQuadrante, matSotto, isoleU,
    // un'onda d'oro che si allarga sul pavimento quando un'isola si accende
    onda(x, z, t) { ondaX = x; ondaZ = z; ondaT0 = t; },
    impostaQualita(q) {
      stelle.geometry.setDrawRange(0, q === 'alta' ? N_STELLE : q === 'media' ? 1000 : 600);
      polvere.geometry.setDrawRange(0, q === 'alta' ? N_POLVERE : q === 'media' ? 900 : 450);
    },
    impostaPx(dpr, altezza) {
      stelle.material.uniforms.uPx.value = dpr;
      polvere.material.uniforms.uPx.value = dpr * altezza / 900;
    },
    aggiorna(t, camera, luce) {
      cielo.position.copy(camera.position);
      cielo.material.uniforms.uT.value = t; cielo.material.uniforms.uLuce.value = luce;
      stelle.material.uniforms.uT.value = t; polvere.material.uniforms.uT.value = t;
      const u = pavimento.material.uniforms;
      u.uT.value = t; u.uCam.value.copy(camera.position); u.uLuce.value = luce;
      if (ondaT0 >= 0) {
        const r = (t - ondaT0) * 9.0;
        if (r > 70) { ondaT0 = -1; u.uOnda.value.set(0, 0, -1, 0); } else u.uOnda.value.set(ondaX, ondaZ, r, 1 - r / 70);
      }
    },
  };
  amb.impostaQualita(qualita);
  return amb;
}

// ---------- piedistallo: corpo laccato, quadrante, due anelli d'oro, alone sotto, cerchio tratteggiato a terra, disegno del progetto ----------
function matAnello(vel, fase, k) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 }, uLuce: { value: 0 }, uC: { value: C('#ffd27a', k) } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg, uLuce; uniform vec3 uC; varying vec2 vU;
      void main(){ float a = fract(vU.x * 2.0 - uT * ${vel.toFixed(3)} + ${fase.toFixed(2)});
        float testa = pow(a, 60.0) * 7.0 + pow(a, 8.0) * 0.9;
        float acceso = step(vU.x, uProg);
        float coda = smoothstep(uProg - 0.02, uProg, vU.x) * acceso * step(uProg, 0.999) * 6.0;
        gl_FragColor = vec4(uC * mix(0.07, 1.0 + testa + coda, acceso) * (1.0 + uLuce), 1.0); }`,
  });
}
function matTratteggio() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg; varying vec2 vP; void main(){ float a = atan(vP.y, vP.x) / 6.28318 + 0.5; if (a > uProg) discard;
      float d = step(0.55, fract(a * 140.0 + uT * 0.6)); float tick = step(0.94, fract(a * 12.0 - uT * 0.05));
      gl_FragColor = vec4(vec3(1.0, 0.72, 0.4) * (0.25 * d + tick * 1.6), 1.0); }`,
    ...ADDITIVO,
  });
}
// disegno del progetto sul piano: ingombro, file, squadrette, fascia di rispetto, sigillo dell'autorizzazione
function matProgetto() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uDisegno: { value: 0 }, uSigillo: { value: 0 }, uFlash: { value: 0 }, uAlfa: { value: 1 },
      uR: { value: 4 }, uPasso: { value: 0.5 }, uCentro: { value: new THREE.Vector2() }, uMezzi: { value: new THREE.Vector2(2, 2) }, uC: { value: C('#ffc27a', 1.25) },
      uTondo: { value: 0 }, uCerchi: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    },
    vertexShader: `varying vec2 vP; void main(){ vP = vec2(position.x, -position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uDisegno, uSigillo, uFlash, uAlfa, uR, uPasso, uTondo; uniform vec2 uCentro, uMezzi; uniform vec3 uC; uniform vec3 uCerchi[3];
      varying vec2 vP;
      float aa(float d, float w){ float f = fwidth(d); return 1.0 - smoothstep(w, w + f * 1.5, abs(d)); }
      void main(){
        if (uAlfa < 0.003) discard;
        vec2 r = vP - uCentro;
        float xs = (r.x + uMezzi.x + 0.7) / (2.0 * uMezzi.x + 1.4);
        float fr = uDisegno * 1.25 - 0.1;
        float vis = 1.0 - smoothstep(fr - 0.04, fr, xs);
        float fronte = exp(-pow((xs - fr) * 26.0, 2.0)) * step(0.002, uDisegno) * step(uDisegno, 0.998);
        // ingombro: rettangolo (FV, BESS) o tre cerchi (le turbine sui loro piedistalli)
        vec2 d = abs(r) - uMezzi;
        float sdR = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        float sdC = 1e3; float raggi = 0.0;
        for (int i = 0; i < 3; i++) {
          vec2 q = vP - uCerchi[i].xy; float s = length(q) - uCerchi[i].z; sdC = min(sdC, s);
          raggi += aa(sin(atan(q.y, q.x) * 6.0) * length(q) * 0.2, 0.004) * (1.0 - step(0.0, s));
        }
        float sd = mix(sdR, sdC, uTondo);
        float bordo = aa(sd, 0.012);
        float rispetto = aa(sd - 0.3, 0.006) * step(0.5, fract((r.x + r.y) * 3.0 + uT * 0.15));
        float dentro = 1.0 - step(0.0, sd);
        float lr = (abs(fract(r.y / uPasso) - 0.5)) * uPasso;
        float righe = aa(lr, 0.006) * (1.0 - step(0.0, sdR)) * 0.45 * (1.0 - uTondo);
        raggi *= 0.35 * uTondo;
        // asse che unisce le turbine: la condotta del progetto
        righe += aa(r.y, 0.01) * (1.0 - step(0.0, sdR)) * step(0.0, sdC) * 0.8 * uTondo;
        vec2 c = abs(r) - (uMezzi + 0.45);
        float sq = max(aa(c.y, 0.01) * step(-0.42, c.x) * step(c.x, 0.0), aa(c.x, 0.01) * step(-0.42, c.y) * step(c.y, 0.0));
        float rr = length(vP); float ang = fract(atan(vP.x, vP.y) / 6.28318 + 0.5);
        float sig = step(ang, uSigillo) * step(0.001, uSigillo);
        float cerchio = aa(rr - uR * 0.87, 0.012) * sig;
        float tacche = aa(rr - uR * 0.83, 0.035) * step(0.82, fract(ang * 60.0)) * sig;
        float lum = (bordo + rispetto * 0.55 + righe + raggi + sq * 0.9 + dentro * 0.04) * vis + fronte * 1.4 * step(sd, 0.6);
        lum += cerchio * 1.1 + tacche * 0.5;
        gl_FragColor = vec4(uC * lum * uAlfa * (1.0 + uFlash * 2.2), 1.0);
      }`,
    ...ADDITIVO,
  });
}

export function creaPiedistallo(amb, { R = 4.35, H = 0.45, segmenti = 128, indice = 0 } = {}) {
  const gruppo = new THREE.Group();                 // origine = pavimento sotto il centro
  const podio = new THREE.Group(); podio.position.y = VOLO; gruppo.add(podio);
  const prof = [[0, 0], [R - 0.5, 0], [R - 0.14, 0.05], [R - 0.03, 0.13], [R, 0.2], [R, H - 0.07], [R - 0.02, H - 0.02], [R - 0.06, H], [0, H]];
  const corpo = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), segmenti), amb.matPodio); podio.add(corpo);
  const piano = new THREE.Mesh(new THREE.CircleGeometry(R - 0.06, segmenti), amb.matQuadrante); piano.rotation.x = -Math.PI / 2; piano.position.y = H + 0.0005; podio.add(piano);
  const tub = Math.max(96, segmenti * 2);
  const m1 = matAnello(0.05, indice * 0.3, 2.6), m2 = matAnello(-0.03, indice * 0.7, 1.2);
  const a1 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.014, 6, tub), m1); a1.rotation.x = -Math.PI / 2; a1.position.y = H - 0.05; podio.add(a1);
  const a2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.004, 0.007, 5, tub), m2); a2.rotation.x = -Math.PI / 2; a2.position.y = 0.2; podio.add(a2);
  const sotto = new THREE.Mesh(new THREE.CircleGeometry(R - 0.7, 64), amb.matSotto); sotto.rotation.x = Math.PI / 2; sotto.position.y = -0.001; podio.add(sotto);
  const mt = matTratteggio();
  const tratt = new THREE.Mesh(new THREE.RingGeometry(R + 0.55, R + 0.58, segmenti * 2), mt); tratt.rotation.x = -Math.PI / 2; tratt.position.y = 0.004; gruppo.add(tratt);
  const mp = matProgetto(); mp.uniforms.uR.value = R - 0.06;
  const progetto = new THREE.Mesh(new THREE.CircleGeometry(R - 0.06, 72), mp); progetto.rotation.x = -Math.PI / 2; progetto.position.y = H + 0.004; progetto.renderOrder = 3; podio.add(progetto);
  const cima = VOLO + H;
  return {
    gruppo, R, H, cima, matProgetto: mp,
    // ingombro della macchina (coordinate locali xz del piedistallo)
    impostaIngombro(cx, cz, mx, mz, passo = 0.5, cerchi = null) {
      mp.uniforms.uCentro.value.set(cx, cz); mp.uniforms.uMezzi.value.set(Math.max(0.3, mx), Math.max(0.3, mz));
      mp.uniforms.uPasso.value = passo; mp.uniforms.uTondo.value = cerchi ? 1 : 0;
      if (cerchi) cerchi.slice(0, 3).forEach(([x, z, r], i) => mp.uniforms.uCerchi.value[i].set(x, z, r));
    },
    // accensione: anelli che si disegnano; fase: disegno, sigillo, flash, alfa del progetto
    aggiorna(t, accensione, f) {
      m1.uniforms.uT.value = t; m2.uniforms.uT.value = t; mt.uniforms.uT.value = t; mp.uniforms.uT.value = t;
      m1.uniforms.uProg.value = accensione; m2.uniforms.uProg.value = Math.min(1, accensione * 1.15);
      mt.uniforms.uProg.value = Math.max(0, Math.min(1, accensione * 1.2 - 0.1));
      const fl = f ? f.flash : 0;
      m1.uniforms.uLuce.value = fl * 1.5; m2.uniforms.uLuce.value = fl;
      if (f) {
        mp.uniforms.uDisegno.value = f.progetto; mp.uniforms.uSigillo.value = f.sigillo; mp.uniforms.uFlash.value = fl;
        mp.uniforms.uAlfa.value = f.alfaProgetto;
      } else mp.uniforms.uAlfa.value = 0;
    },
  };
}

// ---------- faro finale: anello d'oro verticale con cuore luminoso, destinazione della linea ----------
export function creaFaro(pos, r) {
  const gruppo = new THREE.Group(); gruppo.position.copy(pos);
  const yc = r + 0.06;
  const mA = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 }, uVis: { value: 0 }, uC: { value: C('#ffd27a', 3.2) } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg, uVis; uniform vec3 uC; varying vec2 vU;
      void main(){ float d = abs(fract(vU.x - 0.75 + 0.5) - 0.5) * 2.0; float acceso = step(d, uProg);
        float imp = pow(fract(vU.x * 3.0 - uT * 0.12), 30.0) * 3.0; float testa = smoothstep(uProg - 0.04, uProg, d) * acceso * step(uProg, 0.999) * 4.0;
        gl_FragColor = vec4(uC * mix(0.06 * uVis, 1.0 + imp + testa, acceso), 1.0); }`,
  });
  const anello = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 8, 256), mA); anello.position.y = yc; gruppo.add(anello);
  const mB = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg; varying vec2 vU; void main(){ float a = fract(vU.x + uT * 0.02);
      float d = step(0.5, fract(a * 90.0)); gl_FragColor = vec4(vec3(1.0, 0.75, 0.45) * d * 0.9 * uProg, 1.0); }`,
    ...ADDITIVO,
  });
  const anello2 = new THREE.Mesh(new THREE.TorusGeometry(r + 0.32, 0.012, 4, 256), mB); anello2.position.y = yc; gruppo.add(anello2);
  // cuore: disco di luce morbida, come un sole che si apre
  const mC = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uProg: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uProg; varying vec2 vP; void main(){ float r = length(vP) / ${r.toFixed(2)};
      float raggi = 0.5 + 0.5 * sin(atan(vP.y, vP.x) * 14.0 + uT * 0.25);
      float k = (pow(max(1.0 - r, 0.0), 2.2) * 0.55 + pow(max(1.0 - r, 0.0), 8.0) * 1.6 + raggi * pow(max(1.0 - r, 0.0), 1.5) * 0.12) * uProg;
      gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * k, 1.0); }`,
    ...ADDITIVO, side: THREE.DoubleSide,
  });
  const cuore = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 96), mC); cuore.position.y = yc; gruppo.add(cuore);
  // alone a terra
  const mD = new THREE.ShaderMaterial({
    uniforms: { uProg: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uProg; varying vec2 vP; void main(){ float r = length(vP * vec2(1.0, 2.2)) / ${(r * 1.5).toFixed(2)};
      gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * pow(max(1.0 - r, 0.0), 2.0) * 0.5 * uProg, 1.0); }`,
    ...ADDITIVO,
  });
  const alone = new THREE.Mesh(new THREE.CircleGeometry(r * 1.5, 64), mD); alone.rotation.x = -Math.PI / 2; alone.position.y = 0.01; gruppo.add(alone);
  const _v = new THREE.Vector3();
  return {
    gruppo, r, yc,
    // punto del bordo destro dell'anello (per il filo verso il modulo dei contatti)
    puntoBordo(out = _v) { return out.set(pos.x + r + 0.05, yc, pos.z); },
    // vis: l'anello spento resta nascosto nell'apertura (non disturba il logo e il pulsante)
    aggiorna(t, prog, vis = 1) {
      anello.visible = vis > 0.001 || prog > 0;
      mA.uniforms.uT.value = t; mA.uniforms.uProg.value = prog; mA.uniforms.uVis.value = vis;
      mB.uniforms.uT.value = t; mB.uniforms.uProg.value = Math.max(0, prog * 1.4 - 0.4);
      mC.uniforms.uT.value = t; mC.uniforms.uProg.value = Math.max(0, prog * 1.6 - 0.6);
      mD.uniforms.uProg.value = prog;
    },
  };
}
