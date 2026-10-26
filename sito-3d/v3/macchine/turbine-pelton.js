// ERI v3 · turbina Pelton (gioiello per il salto alto): ruota a cucchiai doppi, ugello con spina, getto d'acqua luminoso.
// Unità dello showroom, poi scalata sul piedistallo. Albero lungo Z, ruota davanti, generatore dietro.
import * as THREE from 'three';
import { ParametricGeometry, Fusore, istanze, fissaSfera, geoBox, geoBullone, geoFlangia, mat4, mat4Dir, segm, rampa, rivela, ADDITIVO } from './materiali-pezzi.js';

const N_CUC = 20, RR = 0.58, LB = 0.44, WB = 0.38, DB = 0.13, YC = 1.37;
const RP = RR + LB * 0.55, YJ = YC - RP, X_BOCCA = -0.68, X_IMPATTO = -0.06;

// cucchiaio doppio con tacca centrale (superficie interna + guscio esterno in un pezzo)
function geoCucchiaio(su, sv) {
  const hw = v => (WB / 2) * Math.sqrt(Math.max(0.0001, 1 - ((v - 0.45) / 0.62) ** 2));
  const pr = v => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.7);
  const tacca = (xn, v) => (v > 0.78 && Math.abs(xn) < 0.42 ? (1 - (xn / 0.42) ** 2) * LB * 0.12 * ((v - 0.78) / 0.22) : 0);
  const interno = new ParametricGeometry((u, v, t) => {
    const xn = 2 * u - 1, x = xn * hw(v), d = 1 - ((Math.abs(xn) - 0.5) / 0.5) ** 2;
    t.set(x, v * LB - tacca(xn, v), -DB * d * pr(v));
  }, su, sv);
  const esterno = new ParametricGeometry((u, v, t) => {
    const xn = 2 * u - 1, x = xn * hw(v);
    t.set(x, v * LB - tacca(xn, v), -DB * 1.22 * Math.pow(Math.max(0, 1 - xn * xn), 0.75) * Math.pow(pr(v), 0.8) - 0.004 * pr(v));
  }, su, sv);
  const f = new Fusore(), k = {}; f.add(interno, k).add(esterno, k);
  return f.geometrie().get(k);
}

// supporto a cuscinetto con cappello imbullonato (alto h, asse lungo Z)
function supporto(M, q, h, lo, hi, m0) {
  const s48 = segm(q, 48, 32, 20), at = (x, y, z, rx = 0) => m0.clone().multiply(mat4(x, y, z, rx));
  lo.add(geoBox(0.46, 0.08, 0.3, 0.012), M.grafite, at(0, 0.04, 0));
  lo.add(geoBox(0.3, h - 0.25, 0.24, 0.02), M.grafite, at(0, (h - 0.25) / 2 + 0.06, 0));
  lo.add(new THREE.CylinderGeometry(0.19, 0.19, 0.24, s48), M.grafite, at(0, h, 0, Math.PI / 2));
  lo.add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, s48), M.inoxSatinato, at(0, h, 0, Math.PI / 2));
  for (const sz of [-1, 1]) hi.add(new THREE.TorusGeometry(0.11, 0.012, 8, s48), M.gomma, at(0, h, sz * 0.125));
  const b = [], g = geoBullone(0.016, segm(q, 14, 10, 6));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.push(m0.clone().multiply(mat4Dir(sx * 0.17, 0.08, sz * 0.1, new THREE.Vector3(0, 1, 0)))); b.push(m0.clone().multiply(mat4Dir(sx * 0.215, h - 0.02, sz * 0.07, new THREE.Vector3(0, 1, 0)))); }
  hi.multi(g, M.inoxSatinato, b);
  for (const sx of [-1, 1]) lo.add(geoBox(0.08, 0.04, 0.2, 0.01), M.grafite, at(sx * 0.2, h - 0.04, 0));
  hi.add(new THREE.CylinderGeometry(0.008, 0.01, 0.04, 10), M.ottone, at(0, h + 0.21, 0));
}

function acquaGetto(D, lung) {
  const g = new THREE.Group();
  const gn = new THREE.CylinderGeometry(0.05, 0.046, lung, 24, 16, true); gn.rotateZ(-Math.PI / 2); gn.translate(lung / 2, 0, 0);
  g.add(new THREE.Mesh(gn, D.getto));
  const ga = new THREE.CylinderGeometry(0.1, 0.08, lung, 20, 1, true); ga.rotateZ(-Math.PI / 2); ga.translate(lung / 2, 0, 0);
  g.add(new THREE.Mesh(ga, new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fd6ff').multiplyScalar(0.12), ...ADDITIVO })));
  return g;
}

function spruzzi(n) {
  const geo = new THREE.BufferGeometry(), seme = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seme[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeme', new THREE.BufferAttribute(seme, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uK: { value: 0 } },
    vertexShader: `uniform float uT, uPx, uK; attribute vec4 aSeme; varying float vA;
      void main(){ float age = fract(uT * (0.9 + aSeme.w * 0.6) + aSeme.x);
        float lato = aSeme.y < 0.5 ? -1.0 : 1.0;
        vec3 v = vec3(-0.5 - aSeme.z * 0.9, 0.2 + aSeme.w * 0.9, lato * (0.7 + aSeme.z * 1.3));
        vec3 p = v * age * 1.1 + vec3(0.0, -2.2, 0.0) * age * age;
        vA = (1.0 - age) * smoothstep(0.0, 0.05, age) * uK;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (0.008 + aSeme.z * 0.012) * (300.0 / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.2, 2.4, 3.2) * a, a); }`,
    ...ADDITIVO,
  });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; return { punti: p, mat };
}

function vasca(M, w, d) {
  const g = new THREE.Group(), f = new Fusore(), bordo = 0.07, h = 0.16;
  for (const [x, z, ww, dd] of [[0, d / 2, w + bordo * 2, bordo], [0, -d / 2, w + bordo * 2, bordo], [w / 2, 0, bordo, d], [-w / 2, 0, bordo, d]]) f.add(geoBox(ww, h, dd, 0.015), M.grafite, mat4(x, h / 2, z));
  f.add(new THREE.BoxGeometry(w, 0.02, d), M.nero, mat4(0, 0.01, 0));
  f.in(g);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 0.35 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uT, uK; varying vec2 vU;
      void main(){ vec2 p = (vU - 0.5) * vec2(${(w * 6).toFixed(1)}, ${(d * 6).toFixed(1)});
        float r = length(p - vec2(-0.4, 0.0)); float onde = 0.5 + 0.5 * sin(r * 3.2 - uT * 3.0);
        float c1 = pow(abs(sin(p.x * 1.3 + sin(p.y * 1.7 + uT * 0.8) * 1.4 + uT * 0.6)), 18.0);
        float c2 = pow(abs(sin(p.y * 1.1 + sin(p.x * 1.2 - uT * 0.7) * 1.6 - uT * 0.5)), 18.0);
        float e = smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.92, vU.x) * smoothstep(0.0, 0.1, vU.y) * smoothstep(1.0, 0.9, vU.y);
        vec3 base = vec3(0.02, 0.16, 0.3) + vec3(0.05, 0.35, 0.55) * onde * 0.35 * uK;
        vec3 col = base + vec3(0.6, 1.7, 2.3) * (c1 + c2) * 0.45 * uK;
        gl_FragColor = vec4(col * (0.4 + 0.6 * e), 1.0); }`,
  });
  const acqua = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); acqua.rotation.x = -Math.PI / 2; acqua.position.y = h - 0.05; g.add(acqua);
  return { gruppo: g, mat };
}

// anello luminoso (tubo lungo una circonferenza nel piano XY): si "disegna" col montaggio
export function geoAnello(r, tubo, seg = 160, rad = 6) {
  const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), seg, tubo, rad, true);
}

export function creaPelton({ M, D, q, mont, lod, w }) {
  const radice = new THREE.Group(); radice.name = 'pelton';
  const scala = new THREE.Group(); scala.rotation.y = -0.5; scala.scale.setScalar(0.62); radice.add(scala);
  const ass = new THREE.Group(); ass.position.set(0.48, 0, 0.72); scala.add(ass);
  const s64 = segm(q, 64, 40, 24);

  // ---- ruota: cucchiai (istanze, cambio di dettaglio), radici, mozzo ----
  const ruota = new THREE.Group(); ruota.position.set(0, YC, 0); ass.add(ruota);
  const cupHi = geoCucchiaio(segm(q, 24, 18, 12), segm(q, 20, 14, 10)), cupLo = geoCucchiaio(8, 7);
  const geoRad = new THREE.CylinderGeometry(0.05, 0.065, 0.16, segm(q, 16, 12, 8)); geoRad.rotateX(Math.PI / 2);
  const mC = [], mR = [], dir = [];
  const ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3();
  for (let i = 0; i < N_CUC; i++) {
    const a = (i / N_CUC) * Math.PI * 2;
    ey.set(Math.cos(a), Math.sin(a), 0); ez.set(Math.sin(a), -Math.cos(a), 0); ex.crossVectors(ey, ez);
    mC.push(new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(ey.x * RR, ey.y * RR, 0));
    mR.push(new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(ey.x * (RR - 0.03), ey.y * (RR - 0.03), -0.02));
    dir.push([ey.x, ey.y]);
  }
  const cups = istanze(cupLo, D.inox, mC, ruota), radici = istanze(geoRad, M.inoxSatinato, mR, ruota);
  lod.cambio(cups, cupHi, cupLo);
  fissaSfera([cups, radici], 1.3);
  const mozzo = new THREE.Group(); ruota.add(mozzo);
  const fm = new Fusore();
  const prof = [[0, -0.09], [RR - 0.02, -0.09], [RR + 0.01, -0.06], [RR + 0.01, 0.05], [RR - 0.02, 0.08], [0.24, 0.08], [0.2, 0.17], [0, 0.17]].map(([r, y]) => new THREE.Vector2(r, y));
  fm.add(new THREE.LatheGeometry(prof, segm(q, 96, 64, 40)), M.inox, mat4(0, 0, 0, Math.PI / 2));
  fm.add(new THREE.SphereGeometry(0.2, s64, s64 >> 1, 0, Math.PI * 2, 0, Math.PI / 2), M.inox, mat4(0, 0, 0.17, Math.PI / 2));
  fm.in(mozzo);
  const bulHi = new Fusore(), gb = geoBullone(0.013, segm(q, 12, 8, 6)), mb = [], mo = [];
  for (let i = 0; i < N_CUC * 2; i++) {
    const a = (i / (N_CUC * 2)) * Math.PI * 2;
    mb.push(mat4Dir(Math.cos(a) * (RR - 0.08), Math.sin(a) * (RR - 0.08), 0.08, new THREE.Vector3(0, 0, 1), a));
    mb.push(mat4Dir(Math.cos(a) * (RR - 0.08), Math.sin(a) * (RR - 0.08), -0.09, new THREE.Vector3(0, 0, -1), a));
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mo.push(mat4Dir(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.12, new THREE.Vector3(0, 0, 1), a)); }
  bulHi.multi(gb, M.inoxSatinato, mb).multi(geoBullone(0.016, 10), M.oro, mo);
  const bulloni = new THREE.Group(), bulH = new THREE.Group(); bulHi.in(bulH); bulloni.add(bulH); ruota.add(bulloni); lod.hi.push(bulH);

  // ---- albero, giunto, supporto, generatore ----
  const albero = new THREE.Group(); ass.add(albero);
  const fa = new Fusore(), faHi = new Fusore();
  fa.add(new THREE.CylinderGeometry(0.085, 0.085, 0.9, segm(q, 40, 28, 16)), M.inoxSatinato, mat4(0, YC, -0.55, Math.PI / 2));
  for (const [z, rx] of [[-0.92, -Math.PI / 2], [-0.98, Math.PI / 2]]) {
    fa.add(geoFlangia(0.22, 0.08, 0.06, s64), M.inoxSatinato, mat4(0, YC, z, rx));
    const bf = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bf.push(mat4Dir(Math.cos(a) * 0.17, YC + Math.sin(a) * 0.17, z + (rx > 0 ? -0.06 : 0.06), new THREE.Vector3(0, 0, rx > 0 ? -1 : 1), a)); }
    faHi.multi(geoBullone(0.012, 10), M.inox, bf);
  }
  fa.in(albero); const albHi = new THREE.Group(); faHi.in(albHi); albero.add(albHi); lod.hi.push(albHi);
  const sup = new THREE.Group(); ass.add(sup);
  const fsl = new Fusore(), fsh = new Fusore(); supporto(M, q, YC, fsl, fsh, mat4(0, 0, -0.5)); fsl.in(sup);
  const supHi = new THREE.Group(); fsh.in(supHi); sup.add(supHi); lod.hi.push(supHi);
  const gen = new THREE.Group(); ass.add(gen);
  const fg = new Fusore(), fgh = new Fusore(), RG = 0.4, LG = 0.6, ZG = -1.35;
  fg.add(new THREE.CylinderGeometry(RG, RG, LG, segm(q, 72, 48, 28)), M.bianco, mat4(0, YC, ZG, Math.PI / 2));
  for (const sz of [-1, 1]) {
    const pc = [[0, 0], [RG * 0.98, 0], [RG + 0.03, 0.03], [RG + 0.03, 0.07], [RG * 0.7, 0.14], [0.14, 0.17], [0, 0.17]].map(([a, b]) => new THREE.Vector2(a, b));
    fg.add(new THREE.LatheGeometry(pc, segm(q, 72, 48, 28)), M.grafite, mat4(0, YC, ZG + sz * LG / 2, sz * Math.PI / 2));
  }
  fg.add(geoBox(0.5, YC - RG + 0.04, 0.5, 0.02), M.grafite, mat4(0, (YC - RG + 0.04) / 2, ZG));
  const al = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; if (Math.sin(a) < -0.5) continue; al.push(mat4Dir(Math.cos(a) * (RG + 0.02), YC + Math.sin(a) * (RG + 0.02), ZG, new THREE.Vector3(Math.cos(a), Math.sin(a), 0))); }
  fgh.multi(new THREE.BoxGeometry(0.012, 0.045, LG * 0.86), M.biancoGriglia, al);
  fgh.add(geoBox(0.26, 0.16, 0.28, 0.02), M.grafite, mat4(0, YC + RG + 0.08, ZG - 0.05));
  for (let i = 0; i < 3; i++) fgh.add(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), M.ottone, mat4(0.15, YC + RG + 0.08, ZG - 0.14 + i * 0.09, 0, 0, Math.PI / 2));
  fg.in(gen); const genHi = new THREE.Group(); fgh.in(genHi); gen.add(genHi); lod.hi.push(genHi);

  // ---- iniettore: ugello con spina, flangia, gomito che scende nel piedistallo ----
  const inj = new THREE.Group(); inj.position.set(X_BOCCA - 0.5, YJ, 0); ass.add(inj);
  const fi = new Fusore(), fih = new Fusore();
  const pu = [[0.15, 0], [0.16, 0.02], [0.16, 0.06], [0.13, 0.08], [0.12, 0.3], [0.085, 0.46], [0.075, 0.5], [0.068, 0.5], [0.06, 0.47], [0, 0.47]].map(([r, y]) => new THREE.Vector2(r, y));
  fi.add(new THREE.LatheGeometry(pu, s64), M.inox, mat4(0, 0, 0, 0, 0, -Math.PI / 2));
  fi.add(new THREE.ConeGeometry(0.045, 0.12, 24), M.cromo, mat4(0.5, 0, 0, 0, 0, -Math.PI / 2));
  fi.add(new THREE.TorusGeometry(0.128, 0.012, 8, s64), M.oro, mat4(0.22, 0, 0, 0, Math.PI / 2, 0));
  fi.add(new THREE.CylinderGeometry(0.14, 0.14, 0.35, s64), M.inoxSatinato, mat4(-0.175, 0, 0, 0, 0, Math.PI / 2));
  fi.add(geoFlangia(0.22, 0.135, 0.05, s64), M.inoxSatinato, mat4(-0.025, 0, 0, 0, 0, -Math.PI / 2));
  const bi = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; bi.push(mat4Dir(0.025, Math.cos(a) * 0.19, Math.sin(a) * 0.19, new THREE.Vector3(1, 0, 0), a)); }
  fih.multi(geoBullone(0.011, 10), M.inox, bi);
  fi.add(new THREE.TorusGeometry(0.3, 0.14, segm(q, 24, 16, 10), segm(q, 32, 20, 12), Math.PI / 2), M.inoxSatinato, mat4(-0.35, -0.3, 0, 0, 0, Math.PI / 2));
  const lv = YJ - 0.3;
  fi.add(new THREE.CylinderGeometry(0.14, 0.14, lv, s64, 1, true), M.inoxSatinato, mat4(-0.65, -0.3 - lv / 2, 0));
  fi.in(inj); const injHi = new THREE.Group(); fih.in(injHi); inj.add(injHi); lod.hi.push(injHi);

  // ---- getto, spruzzi, vasca, anello d'oro ----
  const getto = acquaGetto(D, X_IMPATTO - X_BOCCA); getto.position.set(X_BOCCA, YJ, 0); ass.add(getto);
  const spr = spruzzi(segm(q, 500, 300, 160)); spr.punti.position.set(X_IMPATTO, YJ, 0); ass.add(spr.punti);
  const vas = vasca(M, 1.5, 0.9); vas.gruppo.position.set(0.05, 0, 0); ass.add(vas.gruppo);
  const geoAn = geoAnello(RR + LB + 0.14, 0.007, segm(q, 200, 140, 90));
  const anello = new THREE.Mesh(geoAn, M.lucOroTenue); anello.position.set(0, YC, 0); ass.add(anello);

  // ---- montaggio (finestre locali 0..1 → globali con w) ----
  mont.oggetto(vas.gruppo, ...w(0, 0.12));
  mont.oggetto(sup, ...w(0.04, 0.18), { off: [0, 0.8, 0] });
  mont.oggetto(gen, ...w(0.08, 0.22), { off: [0, 0.8, 0] });
  mont.oggetto(albero, ...w(0.16, 0.28), { off: [0, 0, -1.0], cresce: false });
  mont.oggetto(mozzo, ...w(0.22, 0.34), { off: [0, 0, 1.0], rot: [0, 0, 1.2] });
  for (let i = 0; i < N_CUC; i++) {
    const a = 0.3 + i * 0.021, o = { off: [dir[i][0] * 0.9, dir[i][1] * 0.9, 0.35], rot: [0, 2.0, 0] };
    mont.istanza(cups, i, ...w(a, a + 0.14), o); mont.istanza(radici, i, ...w(a, a + 0.14), o);
  }
  mont.oggetto(bulloni, ...w(0.74, 0.84));
  mont.oggetto(inj, ...w(0.7, 0.86), { off: [-0.9, 0, 0], cresce: false });
  mont.funzione(...w(0.84, 1.0), x => { rivela(geoAn, x); anello.visible = x > 0; });

  let ang = 0;
  return {
    gruppo: radice,
    aggiorna(s, dt, px) {
      const f = s.funzione, kj = rampa(f, 0.05, 0.3);
      getto.visible = kj > 0.001 && s.montaggio >= 0.99; getto.scale.x = Math.max(0.001, kj);
      D.getto.uniforms.uT.value = s.t;
      ang += dt * 1.25 * rampa(f, 0.15, 0.5); ruota.rotation.z = ang;
      spr.mat.uniforms.uT.value = s.t; spr.mat.uniforms.uK.value = rampa(f, 0.2, 0.45); spr.mat.uniforms.uPx.value = px * 0.62;
      spr.punti.visible = f > 0.2;
      vas.mat.uniforms.uT.value = s.t; vas.mat.uniforms.uK.value = 0.35 + 0.65 * rampa(f, 0.2, 0.5);
      anello.rotation.z = s.t * 0.05;
    },
  };
}
