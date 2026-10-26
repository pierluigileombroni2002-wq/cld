// ERI v3 · turbina Francis (gioiello per il salto medio): chiocciola a spirale in sezione, palette direttrici, girante a pale curve.
// Asse verticale. Unità dello showroom, poi scalata sul piedistallo.
import * as THREE from 'three';
import { ParametricGeometry, Fusore, istanze, fissaSfera, geoBox, geoBullone, geoFlangia, mat4, mat4Dir, segm, rampa, morbido, esce, rivela, ADDITIVO } from './materiali-pezzi.js';

const YD = 0.62, RG = 0.4, RGV = 0.53, RS = 0.66, HD = 0.2, R0 = 0.42, TH = 1.85 * Math.PI, LIN = 0.3, V0 = 0.1;
const N_PAL = 16, N_GIR = 13;
const rS = th => R0 * Math.sqrt(1 - (0.92 * th) / TH);

// percorso della chiocciola: v in [0,1] (tratto d'ingresso dritto, poi spirale che si stringe)
const _sez = { c: new THREE.Vector3(), er: new THREE.Vector3(), r: 0, aperto: 0 };
function sezione(v) {
  const o = _sez;
  if (v < V0) { o.r = R0; o.c.set(RS + R0 * 0.85, YD, -(1 - v / V0) * LIN); o.er.set(1, 0, 0); }
  else {
    const th = ((v - V0) / (1 - V0)) * TH, r = rS(th), rc = RS + r * 0.85;
    o.r = r; o.c.set(rc * Math.cos(th), YD, rc * Math.sin(th)); o.er.set(Math.cos(th), 0, Math.sin(th));
  }
  o.aperto = morbido(Math.min(1, Math.max(0, (v - V0) / 0.04)));
  return o;
}
// guscio tagliato a metà altezza: resta la metà bassa, aperta verso il distributore
function geoGuscio(su, sv, dr = 0) {
  return new ParametricGeometry((u, v, t) => {
    const s = sezione(v), f0 = -Math.PI + s.aperto * Math.asin(Math.min(0.99, HD / 2 / s.r)), f = f0 + u * (0 - f0), rr = s.r + dr;
    t.set(s.c.x + rr * Math.cos(f) * s.er.x, s.c.y + rr * Math.sin(f), s.c.z + rr * Math.cos(f) * s.er.z);
  }, su, sv);
}
// nastro d'acqua dentro la chiocciola (scorre lungo v)
function geoNastro(su, sv) {
  return new ParametricGeometry((u, v, t) => {
    const s = sezione(v), a = s.aperto, rin = -s.r * 0.8 * (1 - a) + a * (RS - 0.02 - (s.c.x * s.er.x + s.c.z * s.er.z)), rout = s.r * 0.8, d = rin + u * (rout - rin);
    t.set(s.c.x + s.er.x * d, YD - 0.05, s.c.z + s.er.z * d);
  }, su, sv);
}
// paletta direttrice: profilo alare estruso in altezza, perno all'origine
function geoPaletta(q) {
  const c = 0.14, t = 0.026, piv = 0.35, n = segm(q, 14, 10, 6), s = new THREE.Shape();
  const h = x => (t / 2) * 2.6 * Math.sqrt(x) * (1 - x) + 0.0015;
  for (let i = 0; i <= n; i++) { const x = i / n; i ? s.lineTo(x * c - piv * c, h(x)) : s.moveTo(x * c - piv * c, h(x)); }
  for (let i = n; i >= 0; i--) { const x = i / n; s.lineTo(x * c - piv * c, -h(x)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: HD, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  return g;
}
// pala della girante tra corona (in alto) e fascia (in basso), avvolta attorno all'asse
const bez = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
const corona = u => [bez(RG, 0.22, 0.14, u), bez(YD + 0.1, YD + 0.08, YD - 0.12, u)];
const fascia = u => [bez(RG, 0.38, 0.345, u), bez(YD - 0.1, YD - 0.16, YD - 0.3, u)];
function geoPala(su, sv) {
  return new ParametricGeometry((u, v, t) => {
    const [r1, y1] = corona(u), [r2, y2] = fascia(u), r = r1 + (r2 - r1) * v, y = y1 + (y2 - y1) * v, f = -u * (0.85 + 0.45 * v);
    t.set(r * Math.cos(f), y, r * Math.sin(f));
  }, su, sv);
}

export function creaFrancis({ M, D, q, mont, lod, w }) {
  const radice = new THREE.Group(); radice.name = 'francis';
  const scala = new THREE.Group(); scala.rotation.y = 0.35; scala.scale.setScalar(0.6); radice.add(scala);
  const ass = new THREE.Group(); ass.position.set(-0.15, 0, 0.2); scala.add(ass);
  const s64 = segm(q, 64, 44, 28);

  // ---- tubo d'aspirazione e gambe ----
  const aspir = new THREE.Group(); ass.add(aspir);
  const fa = new Fusore();
  fa.add(new THREE.LatheGeometry([[0.5, 0.0], [0.46, 0.06], [0.38, YD - 0.36], [0.37, YD - 0.31]].map(([a, b]) => new THREE.Vector2(a, b)), s64), D.inoxSat);
  fa.add(new THREE.TorusGeometry(0.5, 0.02, 8, s64), M.grafite, mat4(0, 0.02, 0, Math.PI / 2));
  fa.in(aspir);
  const gambe = new THREE.Group(); ass.add(gambe);
  const fg = new Fusore();
  for (const th of [0.5 * Math.PI, 1.05 * Math.PI, 1.55 * Math.PI]) {
    const r = rS(th), rc = RS + r * 0.85, hl = YD - r * 0.96;
    fg.add(geoBox(0.06, hl, 0.06, 0.008), M.grafite, mat4(rc * Math.cos(th), hl / 2, rc * Math.sin(th)));
    fg.add(geoBox(0.14, 0.02, 0.14, 0.006), M.grafite, mat4(rc * Math.cos(th), 0.01, rc * Math.sin(th)));
  }
  fg.in(gambe);

  // ---- anello di base (fondo del distributore) ----
  const base = new THREE.Mesh(new THREE.LatheGeometry([[RG + 0.015, -0.015], [RS + 0.04, -0.015], [RS + 0.04, 0.015], [RG + 0.015, 0.015], [RG + 0.015, -0.015]].map(([a, b]) => new THREE.Vector2(a, b)), s64), D.inoxSat);
  base.position.y = YD - HD / 2 - 0.015; ass.add(base);

  // ---- ingresso: bocca in sezione con mezza flangia e sella ----
  const ingr = new THREE.Group(); ass.add(ingr);
  const fi = new Fusore(), xc = RS + R0 * 0.85;
  // sella sotto la bocca d'ingresso
  fi.add(geoBox(0.5, YD - R0 + 0.03, 0.08, 0.01), M.grafite, mat4(xc, (YD - R0 + 0.03) / 2, -LIN + 0.12));
  fi.add(geoBox(0.6, 0.02, 0.18, 0.006), M.grafite, mat4(xc, 0.01, -LIN + 0.12));
  // mezza flangia (il tubo è tagliato a metà altezza come la chiocciola)
  const pfl = [[R0 - 0.01, 0], [R0 + 0.05, 0], [R0 + 0.06, 0.01], [R0 + 0.06, 0.04], [R0 + 0.05, 0.05], [R0 - 0.01, 0.05], [R0 - 0.01, 0]].map(([a, b]) => new THREE.Vector2(a, b));
  fi.add(new THREE.LatheGeometry(pfl, s64, -Math.PI / 2, Math.PI), M.inoxSatinato, mat4(xc, YD, -LIN + 0.01, Math.PI / 2));
  fi.in(ingr);

  // ---- chiocciola in sezione (guscio interno satinato; da vicino anche il guscio esterno lucido) ----
  const gGuscio = geoGuscio(segm(q, 22, 16, 10), segm(q, 150, 100, 60));
  const guscio = new THREE.Mesh(gGuscio, D.inoxSat); ass.add(guscio);
  const gEst = geoGuscio(16, segm(q, 120, 80, 50), 0.025);
  const est = new THREE.Mesh(gEst, D.inox); ass.add(est); lod.hi.push(est);
  // linee d'oro sul taglio
  const lip = [], lipIn = [];
  for (let i = 0; i <= 120; i++) { const s = sezione(i / 120); lip.push(s.c.clone().addScaledVector(s.er, s.r + 0.012)); }
  for (let i = 0; i <= 8; i++) { const s = sezione((i / 8) * V0); lipIn.push(s.c.clone().addScaledVector(s.er, -s.r - 0.012)); }
  const fl = new Fusore(), kl = {};
  fl.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip), segm(q, 240, 160, 100), 0.007, 5), kl);
  fl.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipIn), 16, 0.007, 5), kl);
  const pc = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pc.push(new THREE.Vector3(Math.cos(a) * (RS + 0.04), YD - HD / 2, Math.sin(a) * (RS + 0.04))); }
  fl.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pc, true), segm(q, 160, 120, 80), 0.005, 5, true), kl);
  const gLinee = fl.geometrie().get(kl), linee = new THREE.Mesh(gLinee, M.lucOroTenue); ass.add(linee);
  // acqua che entra e gira
  // filamenti di luce che scorrono lungo la spirale (somma additiva: il fondo resta il metallo)
  const matAcqua = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 0 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uK; varying vec2 vU;
      void main(){ float corsia = floor(vU.x * 7.0), lw = fract(vU.x * 7.0);
        float fase = fract(sin(corsia * 12.9898) * 43758.5453) * 6.2832;
        float s = vU.y * 70.0 - uT * 2.4 + fase;
        float fil = pow(0.5 + 0.5 * sin(s), 14.0) * smoothstep(0.5, 0.12, abs(lw - 0.5));
        float bordo = smoothstep(0.0, 0.12, vU.x) * smoothstep(1.0, 0.85, vU.x);
        vec3 c = vec3(0.02, 0.09, 0.16) * 0.6 + vec3(0.45, 1.35, 2.1) * fil;
        gl_FragColor = vec4(c * uK * bordo, 1.0); }`,
    side: THREE.DoubleSide, ...ADDITIVO,
  });
  const nastro = new THREE.Mesh(geoNastro(8, segm(q, 140, 100, 60)), matAcqua); ass.add(nastro);

  // ---- palette direttrici: istanze composte a mano (montaggio + apertura) ----
  const gp = geoPaletta(q), gLeva = new Fusore(), kv = {};
  gLeva.add(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 10), kv, mat4(0, HD + 0.05, 0));
  gLeva.add(geoBox(0.08, 0.012, 0.022, 0.004), kv, mat4(-0.035, HD + 0.085, 0));
  const id = Array.from({ length: N_PAL }, () => new THREE.Matrix4());
  const palette = istanze(gp, D.inox, id, ass), leve = istanze(gLeva.geometrie().get(kv), M.ottone, id, ass);
  lod.hi.push(leve);
  const regolH = new THREE.Group(); ass.add(regolH); lod.hi.push(regolH);
  const regol = new THREE.Mesh(new THREE.TorusGeometry(RGV, 0.012, 8, s64), M.ottone); regol.rotation.x = Math.PI / 2; regol.position.y = YD + HD / 2 + 0.085; regolH.add(regol);
  const progP = new Float32Array(N_PAL);

  // ---- girante (gira attorno a Y): fascia, pale, corona, albero ----
  const gir = new THREE.Group(); ass.add(gir);
  const fasciaM = new THREE.Group(); gir.add(fasciaM);
  const pf = []; for (let i = 0; i <= 12; i++) { const [r, y] = fascia(i / 12); pf.push(new THREE.Vector2(r - 0.004, y)); }
  for (let i = 12; i >= 0; i--) { const [r, y] = fascia(i / 12); pf.push(new THREE.Vector2(r + 0.024, y - 0.008)); }
  pf.push(pf[0].clone());
  fasciaM.add(new THREE.Mesh(new THREE.LatheGeometry(pf, s64), D.inox));
  const mPala = []; for (let k = 0; k < N_GIR; k++) mPala.push(mat4(0, 0, 0, 0, (k / N_GIR) * Math.PI * 2, 0));
  const plHi = geoPala(segm(q, 22, 16, 10), segm(q, 14, 10, 6)), plLo = geoPala(7, 4);
  const pale = istanze(plLo, D.inox, mPala, gir); lod.cambio(pale, plHi, plLo); fissaSfera(pale, 0.6);
  const cor = new THREE.Group(); gir.add(cor);
  // corona più piccola della girante: da sopra si vedono le pale
  const pcor = [[0, YD + 0.2], [0.1, YD + 0.19], [0.24, YD + 0.155], [0.3, YD + 0.125], [0.305, YD + 0.105]];
  for (let i = 0; i <= 10; i++) { const [r, y] = corona(0.3 + (i / 10) * 0.7); pcor.push([Math.max(0.0, r - 0.002), y - 0.002]); }
  pcor.push([0.1, YD - 0.18], [0.05, YD - 0.22], [0, YD - 0.235]);
  cor.add(new THREE.Mesh(new THREE.LatheGeometry(pcor.map(([a, b]) => new THREE.Vector2(a, b)), s64), D.inox));
  const alb = new THREE.Group(); gir.add(alb);
  const fal = new Fusore(), falH = new Fusore();
  fal.add(new THREE.CylinderGeometry(0.055, 0.055, 0.62, segm(q, 32, 24, 16)), M.inoxSatinato, mat4(0, YD + 0.5, 0));
  fal.add(geoFlangia(0.17, 0.05, 0.05, s64), M.inox, mat4(0, YD + 0.76, 0));
  fal.add(new THREE.CylinderGeometry(0.27, 0.27, 0.05, s64), M.inox, mat4(0, YD + 0.86, 0));
  fal.add(new THREE.SphereGeometry(0.16, s64, s64 >> 1, 0, Math.PI * 2, 0, Math.PI / 2), M.inox, mat4(0, YD + 0.885, 0, 0, 0, 0, 1, 0.55, 1));
  fal.add(new THREE.TorusGeometry(0.272, 0.006, 6, s64), M.lucOroTenue, mat4(0, YD + 0.86, 0, Math.PI / 2));
  const bf = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bf.push(mat4Dir(Math.cos(a) * 0.13, YD + 0.81, Math.sin(a) * 0.13, new THREE.Vector3(0, 1, 0), a)); }
  falH.multi(geoBullone(0.011, 10), M.oro, bf);
  fal.in(alb); const albH = new THREE.Group(); falH.in(albH); alb.add(albH); lod.hi.push(albH);

  // ---- montaggio ----
  mont.oggetto(aspir, ...w(0, 0.12), { scala: [1, 0, 1] });
  mont.oggetto(gambe, ...w(0.04, 0.14), { scala: [1, 0, 1] });
  mont.oggetto(base, ...w(0.08, 0.2), { off: [0, 0.4, 0] });
  mont.oggetto(ingr, ...w(0.12, 0.24), { off: [0, -0.2, -0.3] });
  mont.funzione(...w(0.18, 0.44), x => { rivela(gGuscio, x); rivela(gEst, x); guscio.visible = x > 0; });
  mont.funzione(...w(0.3, 0.52), x => { rivela(gLinee, x); linee.visible = x > 0; });
  for (let i = 0; i < N_PAL; i++) { const a = 0.38 + i * 0.012; mont.funzione(...w(a, a + 0.1), x => { progP[i] = x; }); }
  mont.oggetto(fasciaM, ...w(0.5, 0.6), { off: [0, -0.3, 0] });
  for (let k = 0; k < N_GIR; k++) { const a = 0.54 + k * 0.012; mont.istanza(pale, k, ...w(a, a + 0.1), { off: [0, 0.5, 0], rot: [0, 0.6, 0] }); }
  mont.oggetto(cor, ...w(0.72, 0.82), { off: [0, 0.6, 0] });
  mont.oggetto(alb, ...w(0.78, 0.9), { off: [0, 0.8, 0] });
  mont.oggetto(regol, ...w(0.86, 0.96));

  // composizione delle palette: posizione sul cerchio, apertura e arrivo dal basso
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
  let alfaPrima = -1, montPrima = -1;
  function palettePosa(alfa) {
    for (let i = 0; i < N_PAL; i++) {
      const x = progP[i], e = esce(x), ps = (i / N_PAL) * Math.PI * 2;
      _p.set(RGV * Math.cos(ps), YD - HD / 2 - 0.3 * (1 - e), RGV * Math.sin(ps));
      _q.setFromAxisAngle(Y, -ps - Math.PI / 2 + alfa + 1.4 * (1 - e));
      _s.setScalar(x <= 0 ? 0 : morbido(Math.min(1, x / 0.4)));
      _m.compose(_p, _q, _s); palette.setMatrixAt(i, _m); leve.setMatrixAt(i, _m);
    }
    palette.instanceMatrix.needsUpdate = true; leve.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < N_PAL; i++) progP[i] = 1;
  palettePosa(0.15);
  fissaSfera([palette, leve], 0.5);

  let ang = 0;
  return {
    gruppo: radice,
    aggiorna(s, dt) {
      const f = s.funzione, alfa = 0.12 + 0.5 * morbido(rampa(f, 0, 0.35));
      if (alfa !== alfaPrima || s.montaggio !== montPrima) { palettePosa(alfa); alfaPrima = alfa; montPrima = s.montaggio; }
      regol.rotation.z = alfa * 0.25;
      const kw = rampa(f, 0.05, 0.35);
      nastro.visible = kw > 0.001 && s.montaggio >= 0.99; matAcqua.uniforms.uK.value = kw; matAcqua.uniforms.uT.value = s.t;
      ang += dt * 0.85 * rampa(f, 0.2, 0.55); gir.rotation.y = -ang;
    },
  };
}
