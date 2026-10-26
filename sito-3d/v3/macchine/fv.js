// ERI v3 · fotovoltaico: 4 file di tracker monoassiali; la fila dietro è rialzata (agrivoltaico) con sotto colture fatte di luce.
// Scala showroom (1 unità = 2 m). Origine = centro della base. File lungo X, moduli che ruotano attorno a X.
// Montaggio: pali → motoriduttori → tubi → moduli uno per uno. Gestione: i tracker seguono il sole, l'energia scorre.
import * as THREE from 'three';
import {
  Fusore, Montaggio, Dettaglio, istanze, fissaSfera, geoBox, geoBullone, geoProfiloI, geoProfiloC, geoTubo,
  mat4, mat4Dir, segm, rampa, morbido, RoundedBoxGeometry,
} from './materiali-pezzi.js';

const N_MOD = 10, MW = 0.555, ML = 1.13, FH = 0.022, FW = 0.012, PASSO = MW + 0.012, L = N_MOD * PASSO, G = 0.15;
const XS = [-2.5, -1.25, 0, 1.25, 2.5];
const RIGHE = [{ z: -2.75, H: 2.25, agri: true }, { z: -0.45, H: 1.12 }, { z: 1.05, H: 1.12 }, { z: 2.55, H: 1.12 }];
const cx = i => -L / 2 + PASSO * (i + 0.5) + (i < N_MOD / 2 ? -G : G);
const X = new THREE.Vector3(1, 0, 0), mX = new THREE.Vector3(-1, 0, 0), Yv = new THREE.Vector3(0, 1, 0), Zv = new THREE.Vector3(0, 0, 1), mZ = new THREE.Vector3(0, 0, -1);

// moduli: versione leggera (lastra) e di dettaglio (cornice cava, retro, scatola di giunzione)
function geoModuli(q) {
  const loTelaio = new THREE.BoxGeometry(MW, FH - 0.006, ML); loTelaio.translate(0, (FH - 0.006) / 2, 0);
  const s = new THREE.Shape();
  s.moveTo(-MW / 2, -ML / 2); s.lineTo(MW / 2, -ML / 2); s.lineTo(MW / 2, ML / 2); s.lineTo(-MW / 2, ML / 2); s.lineTo(-MW / 2, -ML / 2);
  const h = new THREE.Path();
  h.moveTo(-MW / 2 + FW, -ML / 2 + FW); h.lineTo(-MW / 2 + FW, ML / 2 - FW); h.lineTo(MW / 2 - FW, ML / 2 - FW); h.lineTo(MW / 2 - FW, -ML / 2 + FW); h.lineTo(-MW / 2 + FW, -ML / 2 + FW);
  s.holes.push(h);
  const telaio = new THREE.ExtrudeGeometry(s, { depth: FH - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: segm(q, 2, 1, 1) });
  telaio.rotateX(-Math.PI / 2); telaio.translate(0, 0.002, 0);
  const vetro = new THREE.PlaneGeometry(MW - FW * 1.6, ML - FW * 1.6); vetro.rotateX(-Math.PI / 2); vetro.translate(0, FH - 0.005, 0);
  const f = new Fusore();
  const retro = new THREE.PlaneGeometry(MW - FW, ML - FW); retro.rotateX(Math.PI / 2); retro.translate(0, 0.004, 0);
  const jb = new RoundedBoxGeometry(0.07, 0.014, 0.045, 1, 0.004); jb.translate(0, -0.004, -ML * 0.36);
  const nul = {}; f.add(retro, nul).add(jb, nul);
  return { loTelaio, telaio, vetro, retro: f.geometrie().get(nul) };
}

// motoriduttore (slew drive) + motore alettato + centralina con mini pannello: fisso sul palo centrale, origine sull'asse
function motoriduttore(M, q, hi) {
  const f = new Fusore(), s64 = segm(q, 64, 40, 24), s40 = segm(q, 40, 24, 16);
  if (!hi) {
    f.add(new THREE.CylinderGeometry(0.155, 0.155, 0.13, 20), M.grafite, mat4(0, 0, 0, 0, 0, Math.PI / 2));
    f.add(geoBox(0.12, 0.09, 0.2), M.grafite, mat4(0, -0.19, 0));
    f.add(geoBox(0.13, 0.17, 0.06), M.bianco, mat4(0, -0.55, -0.1));
    return f;
  }
  f.add(new THREE.CylinderGeometry(0.15, 0.15, 0.09, s64), M.inoxSatinato, mat4(0, 0, 0, 0, 0, Math.PI / 2));
  const bul = geoBullone(0.006, segm(q, 12, 8, 6)), bm = [];
  for (const sx of [-1, 1]) {
    f.add(new THREE.TorusGeometry(0.13, 0.022, segm(q, 16, 10, 8), s64), M.grafite, mat4(sx * 0.052, 0, 0, 0, Math.PI / 2, 0));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; bm.push(mat4Dir(sx * 0.074, Math.sin(a) * 0.13, Math.cos(a) * 0.13, sx > 0 ? X : mX)); }
  }
  f.multi(bul, M.inoxSatinato, bm);
  f.add(geoBox(0.12, 0.09, 0.2, 0.008), M.acciaioScuro, mat4(0, -0.19, 0));
  f.add(geoBox(0.1, 0.09, 0.12, 0.012), M.grafite, mat4(0, -0.1, 0.1));
  const mot = mat4(0, -0.12, 0.17, 0.3, Math.PI, 0), loc = (x, y, z, rx = 0) => mot.clone().multiply(mat4(x, y, z, rx));
  f.add(new THREE.CylinderGeometry(0.042, 0.042, 0.16, s40), M.bianco, loc(0, 0, 0, Math.PI / 2));
  for (let i = 0; i < 9; i++) f.add(new THREE.CylinderGeometry(0.05, 0.05, 0.005, s40), M.biancoGriglia, loc(0, 0, -0.06 + i * 0.014, Math.PI / 2));
  f.add(new THREE.CylinderGeometry(0.036, 0.044, 0.025, s40), M.grafite, loc(0, 0, -0.09, Math.PI / 2));
  f.add(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12), M.ottone, loc(0, 0, -0.11, Math.PI / 2));
  // centralina del tracker con mini pannello e led
  f.add(geoBox(0.13, 0.17, 0.06, 0.01), M.bianco, mat4(0, -0.55, -0.1));
  f.add(geoBox(0.11, 0.008, 0.14, 0.002), M.alluminio, mat4(0, -0.43, -0.13, 0.5));
  const pv = new THREE.PlaneGeometry(0.095, 0.12); f.add(pv, M.vetroModulo, mat4(0, -0.425, -0.128, -Math.PI / 2 + 0.5));
  f.add(new THREE.BoxGeometry(0.012, 0.012, 0.004), M.ledVerde, mat4(0.035, -0.5, -0.068));
  f.add(geoTubo([new THREE.Vector3(0, -0.17, 0.29), new THREE.Vector3(0.06, -0.3, 0.24), new THREE.Vector3(0.07, -0.45, 0.02), new THREE.Vector3(0.03, -0.47, -0.07)], 0.006, 32, 6), M.cavo);
  return f;
}

// colture astratte: file di punti di luce che pulsano in onda (nessuna vegetazione)
function colture(lung, file, passoZ) {
  const per = 46, n = per * file;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 1 }, uF: { value: 0 }, uC: { value: new THREE.Color('#e9f2a0') } },
    vertexShader: `uniform float uT, uK, uF; varying float vB;
      void main(){ vec3 p = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        float w = pow(0.5 + 0.5 * sin(p.x * 1.6 - uT * (1.4 + uF * 1.4) + p.z * 3.0), 10.0);
        vB = uK * (0.3 + (2.0 + 1.6 * uF) * w);
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position * uK * (0.8 + w * 0.5), 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vB; void main(){ gl_FragColor = vec4(uC * vB, 1.0); }`,
  });
  const g = new THREE.OctahedronGeometry(0.028, 0); g.scale(1, 0.6, 1);
  const mm = [];
  for (let f = 0; f < file; f++) for (let i = 0; i < per; i++) mm.push(mat4(-lung / 2 + (i + 0.5) * (lung / per), 0.03, (f - (file - 1) / 2) * passoZ));
  const punti = istanze(g, mat, mm);
  // sottili linee di luce sotto ai punti
  const fl = new Fusore(), ml = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe08a').multiplyScalar(0.5) });
  for (let f = 0; f < file; f++) fl.add(new THREE.BoxGeometry(lung, 0.003, 0.006), ml, mat4(0, 0.006, (f - (file - 1) / 2) * passoZ));
  const gr = new THREE.Group(); gr.add(punti); fl.in(gr);
  return { gruppo: gr, mat, ml, colore: ml.color.clone() };
}

export function creaFV(ctx) {
  const M = ctx.materiali, q = ctx.qualita || 'alta';
  const gruppo = new THREE.Group(); gruppo.name = 'fv';
  const mont = new Montaggio(), lod = new Dettaglio(0.5);
  const fissiHi = new THREE.Group(), fissiLo = new THREE.Group();
  gruppo.add(fissiHi, fissiLo); lod.hi.push(fissiHi); lod.lo.push(fissiLo);
  const linea = M.nuovaLinea('#ffd27a', 2.2, 2.0, 0.35);

  // ---- pali: una sola istanza per tutte le file (geometria leggera ↔ profilo a I) ----
  const geoPaloLo = new THREE.BoxGeometry(0.095, 1, 0.075); geoPaloLo.translate(0, 0.5, 0);
  const geoPaloHi = geoProfiloI(0.075, 0.095, 0.008, 0.011, 1); geoPaloHi.rotateY(Math.PI / 2);
  const mPali = [], finPali = [];
  RIGHE.forEach((r, ri) => XS.forEach((x, j) => {
    const centrale = x === 0, k = centrale ? 1.3 : 1, hp = r.H - 0.17 + (centrale ? -0.08 : 0);
    mPali.push(mat4(x, -0.04, r.z, 0, 0, 0, k, hp + 0.04, k));
    const a = (ri * 5 + j) * 0.0105; finPali.push([a, a + 0.1]);
  }));
  const pali = istanze(geoPaloLo, M.zincato, mPali, gruppo);
  lod.cambio(pali, geoPaloHi, geoPaloLo);
  // controventi a ginocchio della fila agrivoltaica
  const mCtr = [], finCtr = [];
  const ra = RIGHE[0];
  XS.forEach((x, j) => { for (const sz of [-1, 1]) { mCtr.push(mat4(x, ra.H - 0.48, ra.z + sz * 0.16, sz * 0.55)); finCtr.push(finPali[j][0] + 0.06); } });
  const ctr = istanze(geoBox(0.022, 0.6, 0.022), M.zincato, mCtr, gruppo);

  // ---- motoriduttori (fissi): istanze per materiale, una per fila ----
  const mMot = RIGHE.map(r => mat4(0, r.H, r.z));
  const motHi = motoriduttore(M, q, true).istanze(fissiHi, mMot), motLo = motoriduttore(M, q, false).istanze(fissiLo, mMot);
  const led = motHi.find(m => m.material === M.ledVerde);

  // ---- piastre cuscinetto e anelli (dettaglio) ----
  const piastraS = new THREE.Shape();
  piastraS.moveTo(-0.085, -0.16); piastraS.lineTo(0.085, -0.16); piastraS.lineTo(0.085, 0.02);
  piastraS.absarc(0, 0.02, 0.085, 0, Math.PI, false); piastraS.lineTo(-0.085, -0.16);
  const foro = new THREE.Path(); foro.absarc(0, 0.02, 0.074, 0, Math.PI * 2, true); piastraS.holes.push(foro);
  const geoPiastra = new THREE.ExtrudeGeometry(piastraS, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: segm(q, 24, 14, 10) });
  geoPiastra.translate(0, 0, -0.006); geoPiastra.rotateY(Math.PI / 2);
  const fCus = new Fusore(), bulC = [];
  fCus.add(geoPiastra, M.acciaio, mat4(0.045, -0.02, 0));
  fCus.add(new THREE.TorusGeometry(0.069, 0.01, 8, segm(q, 40, 24, 16)), M.nero, mat4(0.045, 0, 0, 0, Math.PI / 2, 0));
  for (const [yy, zz] of [[-0.13, -0.05], [-0.13, 0.05], [-0.07, -0.05], [-0.07, 0.05]]) bulC.push(mat4Dir(0.052, yy, zz, X));
  fCus.multi(geoBullone(0.009, segm(q, 12, 8, 6)), M.inoxSatinato, bulC);
  const mCus = [], finCus = [];
  RIGHE.forEach((r, ri) => XS.forEach(x => { if (x !== 0) { mCus.push(mat4(x, r.H, r.z)); finCus.push(ri); } }));
  const cus = fCus.istanze(fissiHi, mCus);

  // ---- parte rotante di ogni fila ----
  const gm = geoModuli(q);
  const tuboGeo = new RoundedBoxGeometry(L + 0.12 + G * 2, 0.1, 0.1, segm(q, 3, 2, 1), 0.014);
  const lineaGeo = new THREE.BoxGeometry(L + G * 2, 0.012, 0.012);
  const seams = [];
  for (let i = 0; i < N_MOD; i++) for (const s of [-1, 1]) { const x = +(cx(i) + s * PASSO / 2).toFixed(4); if (!seams.includes(x)) seams.push(x); }
  // struttura (arcarecci, staffe e bulloni) e finiture (morsetti, cavi di stringa, fascette): fuse per materiale, uguali in ogni fila
  const bulP = geoBullone(0.006, segm(q, 10, 8, 6)), bul = geoBullone(0.009, segm(q, 12, 8, 6));
  const fStr = new Fusore(), fFin = new Fusore();
  const geoArc = geoProfiloC(0.034, 0.026, 0.003, 0.86); geoArc.rotateY(Math.PI / 2);
  const geoStaffa = new RoundedBoxGeometry(0.03, 0.118, 0.118, 1, 0.006), geoMors = new RoundedBoxGeometry(0.024, 0.014, 0.05, 1, 0.003);
  const mArc = [], mSt = [], mBs = [], mMo = [], mBm = [];
  for (const x of seams) {
    mArc.push(mat4(x, 0.05, 0)); mSt.push(mat4(x, 0, 0));
    mBs.push(mat4Dir(x, 0, 0.059, Zv), mat4Dir(x, 0, -0.059, mZ));
    for (const z of [-0.36, 0.36]) { mMo.push(mat4(x, 0.076 + FH, z)); mBm.push(mat4Dir(x, 0.083 + FH, z, Yv)); }
  }
  fStr.multi(geoArc, M.alluminio, mArc).multi(geoStaffa, M.acciaioScuro, mSt).multi(bul, M.inoxSatinato, mBs);
  fFin.multi(geoMors, M.alluminio, mMo).multi(bulP, M.inoxSatinato, mBm);
  for (const z of [-0.025, 0.025]) {
    const pts = [];
    for (let i = 0; i <= N_MOD * 2; i++) { const x = -(L / 2 + G) + (i / (N_MOD * 2)) * (L + 2 * G); pts.push(new THREE.Vector3(x, -0.062 - (i % 2 ? 0.022 : 0), z)); }
    fFin.add(geoTubo(pts, 0.0055, segm(q, 160, 100, 60), 6), M.cavo);
  }
  const fasc = new THREE.TorusGeometry(0.035, 0.004, 5, 20); fasc.rotateY(Math.PI / 2); fasc.scale(1, 0.5, 1.5);
  fFin.multi(fasc, M.nero, seams.map(x => mat4(x + 0.02, -0.057, 0)));
  const geoStr = fStr.geometrie(), geoFin = fFin.geometrie();

  const file = RIGHE.map((r, ri) => {
    const fila = new THREE.Group(); fila.position.z = r.z; gruppo.add(fila);
    const asse = new THREE.Group(); asse.position.y = r.H; fila.add(asse);
    const hi = new THREE.Group(); asse.add(hi); lod.hi.push(hi);
    const tubo = new THREE.Mesh(tuboGeo, M.zincato); asse.add(tubo);
    const lin = new THREE.Mesh(lineaGeo, linea); lin.position.y = -0.062; asse.add(lin);
    const str = new THREE.Group(), fin = new THREE.Group(); hi.add(str, fin);
    for (const [mat, g] of geoStr) str.add(new THREE.Mesh(g, mat));
    for (const [mat, g] of geoFin) fin.add(new THREE.Mesh(g, mat));
    // moduli: istanze (cornice con cambio di geometria, vetro, retro solo da vicino)
    const mm = []; for (let i = 0; i < N_MOD; i++) mm.push(mat4(cx(i), 0.078, 0));
    const telaio = istanze(gm.loTelaio, M.alluminio, mm, asse), vetro = istanze(gm.vetro, M.vetroModulo, mm, asse), retro = istanze(gm.retro, M.retroModulo, mm, hi);
    lod.cambio(telaio, gm.telaio, gm.loTelaio);
    fissaSfera([telaio, vetro, retro], 1.2);
    // tempi del montaggio di questa fila
    const tA = 0.24 + ri * 0.045, sM = 0.40 + ri * 0.1;
    mont.oggetto(tubo, tA, tA + 0.16, { scala: [0.02, 1, 1] });
    mont.oggetto(lin, tA + 0.04, tA + 0.18, { scala: [0.0, 1, 1] });
    mont.oggetto(str, tA + 0.08, tA + 0.18);
    for (let i = 0; i < N_MOD; i++) mont.istanza([telaio, vetro, retro], i, sM + i * 0.015, sM + i * 0.015 + 0.13, { off: [0.3, 0.55, 0], rot: [0, 0, 0.7] });
    mont.oggetto(fin, sM + 0.15, sM + 0.24);
    return { fila, asse, lin, tA };
  });

  // montaggio dei pezzi fissi: pali, controventi, motoriduttori, cuscinetti
  fissaSfera([pali, ctr], 0.2);
  finPali.forEach(([a, b], i) => mont.istanza(pali, i, a, b, { scala: [1, 0, 1] }));
  finCtr.forEach((a, i) => mont.istanza(ctr, i, a, a + 0.08));
  fissaSfera([...motHi, ...motLo], 1.0); fissaSfera(cus, 0.3);
  RIGHE.forEach((r, ri) => { const a = 0.18 + ri * 0.035; mont.istanza([...motHi, ...motLo], ri, a, a + 0.12, { off: [0, 0.8, 0] }); });
  finCus.forEach((ri, i) => { const a = file[ri].tA; mont.istanza(cus, i, a + 0.02, a + 0.12); });

  // colture di luce sotto la fila agrivoltaica
  const col = colture(5.6, 7, 0.26); col.gruppo.position.z = RIGHE[0].z + 0.2; gruppo.add(col.gruppo);
  let kCol = 1;
  mont.funzione(0.86, 1.0, x => { kCol = morbido(x); col.gruppo.visible = x > 0; });

  let qualitaBassa = q === 'bassa';
  return {
    gruppo,
    dettaglio: lod,
    // in qualità bassa il dettaglio meccanico resta spento
    qualita(nq) { qualitaBassa = nq === 'bassa'; lod.permesso = !qualitaBassa; },
    aggiorna(s) {
      mont.aggiorna(s.montaggio);
      lod.aggiorna(s.vicino);
      const f = s.funzione, fe = morbido(rampa(f, 0, 0.6));
      for (let r = 0; r < file.length; r++) file[r].asse.rotation.x = fe * 0.5 * Math.sin(s.t * 0.12 + f * 2.5 - 1.2 - r * 0.1);
      const kl = rampa(f, 0.08, 0.45);
      linea.uniforms.uT.value = s.t; linea.uniforms.uK.value = kl;
      for (let r = 0; r < file.length; r++) file[r].lin.visible = kl > 0.005 && s.montaggio > file[r].tA;
      col.mat.uniforms.uT.value = s.t; col.mat.uniforms.uK.value = kCol; col.mat.uniforms.uF.value = f;
      col.ml.color.copy(col.colore).multiplyScalar(kCol);
      if (led) led.visible = f > 0.05 && Math.sin(s.t * 3.0) > -0.6;
    },
  };
}
