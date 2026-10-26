// ERI v3 · turbina Kaplan (gioiello per il salto basso): elica a 5 pale orientabili, mozzo bulboso, condotto stilizzato.
// Asse orizzontale lungo X (l'acqua va verso +X). Il condotto è mezzo guscio (la metà dietro) con due cerchi d'oro.
import * as THREE from 'three';
import { ParametricGeometry, Fusore, istanze, fissaSfera, geoBox, geoBullone, mat4, mat4Dir, segm, rampa, morbido, esce, rivela } from './materiali-pezzi.js';

const YA = 0.92, N_PALE = 5, F0 = Math.PI / 2, F1 = 3 * Math.PI / 2; // resta la metà dietro: da sotto, dietro, fino in cima
// profilo del condotto attorno alla girante (gola sferica)
const PROF = [[0.7, -0.42], [0.675, -0.3], [0.662, -0.15], [0.658, 0.0], [0.662, 0.15], [0.675, 0.3], [0.7, 0.45]];
const rCond = x => { for (let i = 1; i < PROF.length; i++) if (x <= PROF[i][1]) { const [r0, x0] = PROF[i - 1], [r1, x1] = PROF[i]; return r0 + ((x - x0) / (x1 - x0)) * (r1 - r0); } return PROF[PROF.length - 1][0]; };
// rivoluzione attorno a X (il tornio lavora attorno a Y, poi si ruota)
function tornioX(pts, seg, f0 = 0, fl = Math.PI * 2) { const g = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg, f0, fl); g.rotateZ(-Math.PI / 2); return g; }
// circonferenza attorno a X (per i cerchi d'oro), da f0 a f1
function arco(x, r, f0, f1, n = 64) { const p = []; for (let i = 0; i <= n; i++) { const f = f0 + (i / n) * (f1 - f0); p.push(new THREE.Vector3(x, -r * Math.sin(f), r * Math.cos(f))); } return p; }

// pala larga a punta arrotondata: radiale +Y, assiale +X, tangenziale +Z; perno a metà corda
function geoPala(ss, sc, q) {
  const p = new ParametricGeometry((u, v, t) => {
    const s = v, c = u - 0.5, r = 0.255 + 0.385 * s;
    const env = Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.52) / 0.5, 4)));
    const ch = 0.5 * env + 0.05, b = 0.95 + 0.32 * s, cc = c * ch, cam = 0.045 * ch * (1 - 4 * c * c), sw = 0.09 * s * s;
    t.set(Math.cos(b) * cc - Math.sin(b) * cam, r, Math.sin(b) * cc + Math.cos(b) * cam + sw);
  }, sc, ss);
  const f = new Fusore(), k = {};
  f.add(p, k).add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, segm(q, 32, 20, 12)), k, mat4(0, 0.268, 0));
  return f.geometrie().get(k);
}

export function creaKaplan({ M, D, q, mont, lod, w, linea }) {
  const radice = new THREE.Group(); radice.name = 'kaplan';
  const scala = new THREE.Group(); scala.rotation.y = -0.85; scala.scale.setScalar(0.72); radice.add(scala);
  const ass = new THREE.Group(); ass.position.set(0.08, 0, 0.1); scala.add(ass);
  const s64 = segm(q, 64, 44, 28);

  // ---- appoggi: selle sotto al condotto, pilone sotto al bulbo ----
  const selle = new THREE.Group(); ass.add(selle);
  const fs = new Fusore();
  for (const x of [-0.25, 0.3]) { const h = YA - rCond(x) - 0.02; fs.add(geoBox(0.08, h, 0.42, 0.01), M.grafite, mat4(x, h / 2, 0)); fs.add(geoBox(0.18, 0.02, 0.5, 0.006), M.grafite, mat4(x, 0.01, 0)); }
  fs.in(selle);
  const pilone = new THREE.Group(); ass.add(pilone);
  const fp = new Fusore(), hp = YA - 0.25;
  fp.add(geoBox(0.3, hp, 0.04, 0.012), M.inoxSatinato, mat4(-0.7, hp / 2, 0));
  fp.add(geoBox(0.42, 0.02, 0.2, 0.006), M.grafite, mat4(-0.7, 0.01, 0));
  fp.in(pilone);

  // ---- condotto: mezzo guscio scuro (fuori lucido da vicino), cerchi e bordi d'oro ----
  const cond = new THREE.Group(); cond.position.y = YA; ass.add(cond);
  const gIn = tornioX(PROF, segm(q, 64, 44, 28), F0, F1 - F0);
  cond.add(new THREE.Mesh(gIn, D.grafite));
  const fe = new Fusore(), ke = {};
  fe.add(tornioX(PROF.map(([r, x]) => [r + 0.03, x]), segm(q, 64, 44, 28), F0, F1 - F0), ke);
  for (const fi of [F0, F1]) fe.add(new ParametricGeometry((u, v, t) => { const x = -0.42 + v * 0.87, r = rCond(x) + u * 0.03; t.set(x, -r * Math.sin(fi), r * Math.cos(fi)); }, 2, 24), ke);
  for (const [x, s] of [[-0.42, 1], [0.45, -1]]) fe.add(new THREE.LatheGeometry([new THREE.Vector2(rCond(x), 0), new THREE.Vector2(rCond(x) + 0.03, 0)], s64, F0, F1 - F0).rotateZ(-Math.PI / 2).translate(x, 0, 0), ke);
  const gEst = fe.geometrie().get(ke), est = new THREE.Mesh(gEst, D.inox); cond.add(est); lod.hi.push(est);
  const fl = new Fusore(), kl = {};
  for (const fi of [F0, F1]) { const pts = []; for (let i = 0; i <= 16; i++) { const x = -0.42 + (i / 16) * 0.87, r = rCond(x) + 0.015; pts.push(new THREE.Vector3(x, -r * Math.sin(fi), r * Math.cos(fi))); } fl.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007, 5), kl); }
  for (const x of [-0.42, 0.45]) fl.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arco(x, rCond(x) + 0.015, 0, Math.PI * 2, 96), true), segm(q, 160, 120, 80), 0.008, 5, true), kl);
  const gLinee = fl.geometrie().get(kl), bordi = new THREE.Mesh(gLinee, M.lucOroTenue); cond.add(bordi);

  // ---- bulbo fermo (contiene il generatore) ----
  const bulbo = new THREE.Group(); bulbo.position.y = YA; ass.add(bulbo);
  bulbo.add(new THREE.Mesh(tornioX([[0, -1.16], [0.07, -1.15], [0.15, -1.08], [0.21, -0.97], [0.245, -0.82], [0.258, -0.6], [0.262, -0.3], [0.262, -0.11], [0, -0.11]], segm(q, 64, 44, 28)), D.inox));
  const giunto = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.006, 6, s64), M.lucOroTenue); giunto.position.set(-0.105, YA, 0); giunto.rotation.y = Math.PI / 2; ass.add(giunto);

  // ---- rotore: mozzo e pale (istanze composte a mano: arrivo + passo orientabile) ----
  const rotore = new THREE.Group(); rotore.position.y = YA; ass.add(rotore);
  const mozzo = new THREE.Mesh(tornioX([[0, -0.1], [0.262, -0.1], [0.276, 0.0], [0.272, 0.12], [0.245, 0.25], [0.185, 0.38], [0.1, 0.48], [0, 0.52]], segm(q, 64, 44, 28)), D.inox);
  rotore.add(mozzo);
  const plHi = geoPala(segm(q, 26, 18, 12), segm(q, 20, 14, 8), q), plLo = geoPala(8, 6, q);
  const pale = istanze(plLo, D.inox, Array.from({ length: N_PALE }, () => new THREE.Matrix4()), rotore); lod.cambio(pale, plHi, plLo);
  const bulM = new THREE.Group(), bulH = new THREE.Group(); rotore.add(bulM); bulM.add(bulH); lod.hi.push(bulH);
  const fb = new Fusore(), mb = [];
  for (let k = 0; k < N_PALE; k++) for (let i = 0; i < 6; i++) {
    const ps = (k / N_PALE) * Math.PI * 2, a = (i / 6) * Math.PI * 2, n = new THREE.Vector3(0, Math.cos(ps), Math.sin(ps));
    const lx = Math.cos(a) * 0.075, lt = Math.sin(a) * 0.075, rr = 0.283;
    mb.push(mat4Dir(lx, n.y * rr - Math.sin(ps) * lt, n.z * rr + Math.cos(ps) * lt, n));
  }
  fb.multi(geoBullone(0.009, 8), M.oro, mb); fb.in(bulH);
  const progB = new Float32Array(N_PALE);
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  function paleBlocca(passo) {
    for (let k = 0; k < N_PALE; k++) {
      const x = progB[k], e = esce(x), ps = (k / N_PALE) * Math.PI * 2, d = 0.7 * (1 - e);
      _q.setFromAxisAngle(X, ps); _q2.setFromAxisAngle(Y, passo + 2.2 * (1 - e)); _q.multiply(_q2);
      _p.set(0, Math.cos(ps) * d, Math.sin(ps) * d);
      _s.setScalar(x <= 0 ? 0 : morbido(Math.min(1, x / 0.4)));
      _m.compose(_p, _q, _s); pale.setMatrixAt(k, _m);
    }
    pale.instanceMatrix.needsUpdate = true;
  }
  for (let k = 0; k < N_PALE; k++) progB[k] = 1;
  paleBlocca(0); fissaSfera(pale, 0.8);

  // ---- scie d'acqua: prima dritte, dopo la girante in vortice ----
  const fw = new Fusore(), kw = {};
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + 0.3, r0 = 0.36 + 0.07 * (i % 3), pts = [];
    for (let j = 0; j <= 24; j++) {
      const x = -1.0 + (j / 24) * 2.0, a = a0 + (x > 0.05 ? (x - 0.05) * 2.0 : 0), r = Math.min(0.6, r0 + (x > 0.1 ? (x - 0.1) * 0.1 : 0));
      pts.push(new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
    }
    fw.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segm(q, 90, 60, 40), 0.0045, 4), kw);
  }
  const scie = new THREE.Mesh(fw.geometrie().get(kw), linea); scie.position.y = YA; ass.add(scie);

  // ---- montaggio ----
  mont.oggetto(selle, ...w(0, 0.12), { scala: [1, 0, 1] });
  mont.oggetto(pilone, ...w(0.04, 0.16), { scala: [1, 0, 1] });
  mont.funzione(...w(0.1, 0.32), x => { rivela(gIn, x); rivela(gEst, x); cond.visible = x > 0; });
  mont.oggetto(bulbo, ...w(0.26, 0.4), { off: [-1.2, 0, 0], cresce: false });
  mont.oggetto(mozzo, ...w(0.36, 0.48), { off: [1.0, 0, 0], cresce: false });
  for (let k = 0; k < N_PALE; k++) { const a = 0.46 + k * 0.05; mont.funzione(...w(a, a + 0.14), x => { progB[k] = x; }); }
  mont.oggetto(bulM, ...w(0.7, 0.8));
  mont.funzione(...w(0.78, 0.95), x => { rivela(gLinee, x); bordi.visible = x > 0; });
  mont.oggetto(giunto, ...w(0.82, 0.92));

  let ang = 0, passoPrima = -1, montPrima = -1;
  return {
    gruppo: radice,
    aggiorna(s, dt) {
      const f = s.funzione, passo = 0.8 * (1 - morbido(rampa(f, 0, 0.35)));
      if (passo !== passoPrima || s.montaggio !== montPrima) { paleBlocca(passo); passoPrima = passo; montPrima = s.montaggio; }
      ang += dt * 0.6 * rampa(f, 0.2, 0.55); rotore.rotation.x = ang;
      const k = rampa(f, 0.05, 0.35);
      scie.visible = k > 0.001 && s.montaggio >= 0.99; linea.uniforms.uK.value = k; linea.uniforms.uT.value = s.t;
    },
  };
}
