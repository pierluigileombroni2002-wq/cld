// ERI v3 · materiali condivisi delle macchine (dallo showroom): metalli, vetro dei moduli, bianco container, oro luminoso, acqua, linee di luce.
// creaMateriali(THREE, qualita) → oggetto con i materiali. In qualità media/bassa i materiali costosi diventano "standard".
import { texDaCanvas, rng, ADDITIVO } from './materiali-pezzi.js';

export function creaMateriali(THREE, qualita = 'alta') {
  const q = ['alta', 'media', 'bassa'].includes(qualita) ? qualita : 'alta';
  const anis = q === 'alta' ? 8 : q === 'media' ? 4 : 2;
  const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
  // fisico con vernice solo dove si vede (inox, bianco, vetro…); il resto standard fuori dall'alta qualità
  const fis = (o, vernice = false) => {
    if (q === 'bassa' || (q === 'media' && !vernice)) {
      const { clearcoat, clearcoatRoughness, specularIntensity, ...r } = o;
      return new THREE.MeshStandardMaterial(r);
    }
    return new THREE.MeshPhysicalMaterial(o);
  };

  // spazzolato: righe sottili nella ruvidità (si vedono da vicino nei riflessi)
  const ts = q === 'bassa' ? 256 : 512;
  const spazzolato = texDaCanvas(ts, ts, (g, w, h) => {
    const r = rng(7); g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400 * (w / 512); i++) { const y = r() * h, v = 185 + r() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, w, 0.6 + r()); }
  }, { srgb: false, ripeti: [2, 2], anis });

  const M = {
    qualita: q,
    alluminio: fis({ color: '#c9cdd4', metalness: 1, roughness: 0.3, roughnessMap: spazzolato }),
    acciaio: fis({ color: '#a3a9b0', metalness: 1, roughness: 0.42, roughnessMap: spazzolato }),
    acciaioScuro: fis({ color: '#5d636b', metalness: 1, roughness: 0.38 }),
    zincato: fis({ color: '#b9bec4', metalness: 0.85, roughness: 0.4 }),                        // pali e strutture lunghe (senza righe)
    inox: fis({ color: '#f1f2f5', metalness: 1, roughness: 0.14, clearcoat: 0.4, clearcoatRoughness: 0.2 }, true),
    inoxSatinato: fis({ color: '#dfe2e6', metalness: 1, roughness: 0.28, roughnessMap: spazzolato }),
    cromo: fis({ color: '#ffffff', metalness: 1, roughness: 0.12 }),
    grafite: fis({ color: '#2a2c32', metalness: 0.5, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.3 }, true),
    grafiteOpaca: fis({ color: '#1d1f24', metalness: 0.3, roughness: 0.6 }),
    grafiteSatinata: fis({ color: '#1e2025', metalness: 0.4, roughness: 0.62 }),                  // grandi superfici concave (niente punti caldi)
    velluto: fis({ color: '#0e0d13', metalness: 0, roughness: 0.9 }),                              // piano dei piedistalli, come un portagioie
    bianco: fis({ color: '#eceae5', metalness: 0.04, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.26 }, true),
    biancoGriglia: fis({ color: '#d9d8d4', metalness: 0.1, roughness: 0.5 }),
    gomma: fis({ color: '#121215', metalness: 0, roughness: 0.55 }),
    cavo: fis({ color: '#0e0e11', metalness: 0, roughness: 0.38, clearcoat: 0.4 }),
    rame: fis({ color: '#d58a58', metalness: 1, roughness: 0.28 }),
    ottone: fis({ color: '#e0b25e', metalness: 1, roughness: 0.22 }),
    oro: fis({ color: '#e6b25c', metalness: 1, roughness: 0.18, clearcoat: 0.4 }, true),
    cemento: fis({ color: '#8f8b86', metalness: 0, roughness: 0.82 }),
    ceramica: fis({ color: '#4a2a22', metalness: 0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.14 }, true),
    trasformatore: fis({ color: '#7f868d', metalness: 0.45, roughness: 0.4, clearcoat: 0.5 }),
    nero: fis({ color: '#08080a', metalness: 0.2, roughness: 0.4 }),
    // laccato scuro dei piedistalli (come i podi dello showroom)
    podio: fis({ color: '#141319', metalness: 0.7, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.26, envMapIntensity: 0.6 }, true),
    rosso: fis({ color: '#d1170f', metalness: 0, roughness: 0.25, clearcoat: 1 }, true),
    giallo: fis({ color: '#f2c200', metalness: 0, roughness: 0.35, clearcoat: 1 }),
    // luci (valori oltre 1 → bloom)
    ledVerde: new THREE.MeshBasicMaterial({ color: C('#4dff9a', 4) }),
    ledAmbra: new THREE.MeshBasicMaterial({ color: C('#ffb347', 3) }),
    schermo: new THREE.MeshBasicMaterial({ color: C('#9ad8ff', 1.0) }),
    lucOro: new THREE.MeshBasicMaterial({ color: C('#ffd27a', 5) }),       // oro luminoso pieno
    lucOroTenue: new THREE.MeshBasicMaterial({ color: C('#ffd27a', 1.8) }), // filo d'oro sottile
  };

  // vetro dei moduli FV: celle half-cut blu-nere, busbar d'argento
  const [cw, ch] = q === 'alta' ? [1024, 2048] : [512, 1024];
  M.texCelle = texDaCanvas(cw, ch, (g, w, h) => {
    const k = w / 1024;
    g.fillStyle = '#c9ced6'; g.fillRect(0, 0, w, h);
    const cx = 6, cy = 12, m = 22 * k, gap = 7 * k;
    const cW = (w - m * 2 - gap * (cx - 1)) / cx, cH = (h - m * 2 - gap * (cy - 1) - 16 * k) / cy;
    const r = rng(3);
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      const x = m + i * (cW + gap), y = m + j * (cH + gap) + (j >= cy / 2 ? 16 * k : 0);
      for (let s = 0; s < 2; s++) {
        const hy = y + s * (cH / 2 + 1), hh = cH / 2 - 1;
        const gr = g.createLinearGradient(x, hy, x + cW, hy + hh), v = r() * 6;
        gr.addColorStop(0, `rgb(${14 + v},${22 + v},${48 + v})`); gr.addColorStop(1, `rgb(${10 + v},${16 + v},${38 + v})`);
        g.fillStyle = gr; g.fillRect(x, hy, cW, hh);
      }
      g.fillStyle = 'rgba(190,198,212,0.55)';
      for (let b = 1; b <= 10; b++) g.fillRect(x + (cW * b) / 11 - 0.6 * k, y, Math.max(1, 1.2 * k), cH);
      g.fillStyle = 'rgba(160,170,190,0.12)';
      for (let f = 0; f < cH; f += 6 * k) g.fillRect(x, y + f, cW, 0.5);
    }
    g.fillStyle = 'rgba(200,205,215,0.9)'; g.fillRect(m, h / 2 - 4 * k, w - m * 2, 8 * k);
  }, { anis });
  M.vetroModulo = fis({ map: M.texCelle, color: '#ffffff', metalness: 0.1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.24, envMapIntensity: 1.2, specularIntensity: 1 }, true);
  M.retroModulo = fis({ color: '#141a2a', metalness: 0.2, roughness: 0.25, clearcoat: 0.6 });

  // tetto ai riflessi: le grandi superfici lisce che riflettono la luce principale non devono "accecare" il bloom
  // (l'inox resta alto: i suoi lampi piccoli sono il luccichio dei gioielli)
  const limita = (m, max) => {
    m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight = min(outgoingLight, vec3(${max.toFixed(2)}));\n#include <opaque_fragment>`); };
    m.customProgramCacheKey = () => 'eriLim' + max;
    return m;
  };
  M.limita = limita;
  const tetti = {
    alluminio: 3, acciaio: 3, acciaioScuro: 3, zincato: 2.5, inox: 10, inoxSatinato: 4, cromo: 10, grafite: 2.5, grafiteOpaca: 2.5, grafiteSatinata: 1.2, velluto: 0.8,
    bianco: 2.2, biancoGriglia: 2.2, trasformatore: 2.5, podio: 1.6, oro: 6, ottone: 6, rame: 4, ceramica: 3, cemento: 2, nero: 2, gomma: 2, cavo: 2,
    rosso: 2.5, giallo: 2.5, vetroModulo: 1.3, retroModulo: 1.6,
  };
  for (const k in tetti) limita(M[k], tetti[k]);
  // copia a doppia faccia (per superfici sottili) che conserva il tetto ai riflessi
  M.doppiaFaccia = m => { const c = m.clone(); c.side = THREE.DoubleSide; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; };

  // ---- linea luminosa: impulsi d'energia che scorrono lungo uv.x ----
  M.linea = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 1 }, uC: { value: C('#ffd27a', 1) }, uRip: { value: 3 }, uVel: { value: 0.5 }, uBase: { value: 0.25 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: `uniform float uT, uK, uRip, uVel, uBase; uniform vec3 uC; varying vec2 vU;
      void main(){ float a = fract(vU.x * uRip - uT * uVel); float imp = pow(a, 14.0) * 5.0 + pow(a, 3.0) * 0.6;
        gl_FragColor = vec4(uC * uK * (uBase + imp), 1.0); }`,
  });
  // copia indipendente (ogni macchina regola la sua intensità)
  M.nuovaLinea = (colore = '#ffd27a', k = 1, rip = 3, vel = 0.5) => {
    const m = M.linea.clone(); m.uniforms.uC.value = C(colore, k); m.uniforms.uRip.value = rip; m.uniforms.uVel.value = vel; return m;
  };

  // ---- acqua luminosa: scie che corrono lungo uv.y, bordo fresnel ----
  M.acqua = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 1 }, uVel: { value: 1.0 } },
    vertexShader: `varying vec2 vU; varying vec3 vN; varying vec3 vV;
      void main(){ vU = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uK, uVel; varying vec2 vU; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 1.5);
        float s = 0.6 + 0.4 * sin(vU.y * 60.0 - uT * 40.0 * uVel + sin(vU.x * 25.0) * 2.0) * sin(vU.x * 18.0 + uT * 3.0);
        vec3 c = mix(vec3(0.55, 1.6, 2.6), vec3(2.2, 3.4, 4.0), s * (1.0 - f));
        gl_FragColor = vec4(c * (0.85 + 0.6 * f) * uK, 1.0); }`,
    side: THREE.DoubleSide,
  });
  M.nuovaAcqua = () => M.acqua.clone();

  M.ADDITIVO = ADDITIVO;
  return M;
}
