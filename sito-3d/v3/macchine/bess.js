// ERI v3 · accumulo BESS: 4 container batteria (2 file con corsia), PCS e trasformatore MT, linee d'energia a terra.
// Scala showroom (1 unità = 2 m). Origine = centro della base. Fronte dei container (porte) verso +Z.
// Montaggio: i container scendono uno a uno, poi PCS e trasformatore, gli isolatori, le linee. Gestione: le porte
// si socchiudono e i rack si riempiono di luce come una barra di carica (il BESS "respira").
import * as THREE from 'three';
import { Fusore, Montaggio, Dettaglio, istanze, fissaSfera, geoBox, geoBullone, geoProfiloC, geoTubo, mat4, mat4Dir, segm, rampa, morbido, rivela } from './materiali-pezzi.js';

const CL = 2.7, CW = 1.15, CH = 1.25, B = 0.12;           // container: lunghezza (X), larghezza (Z), altezza, piedi
const AP = 2.28, LW = AP / 6, YP = B + 0.615, ZR = CW / 2 - 0.2; // vano porte, larghezza anta, centro porte, parete dei rack
const N_MOD = 8;                                           // moduli per rack
const APRI_DX = 1.6;                                       // ante di destra: 1.6 × l'apertura di quelle di sinistra (≈ 96°)
const POS = [[-0.775, -0.85], [2.225, -0.85], [-0.775, 0.85], [2.225, 0.85]]; // dietro sx, dietro dx, davanti sx, davanti dx
const PCS_P = [-3.025, 0.95], TR_P = [-3.15, -0.85];  // PCS davanti, trasformatore dietro (gli isolatori spuntano)
const X = new THREE.Vector3(1, 0, 0), Yv = new THREE.Vector3(0, 1, 0), LATI = [1, -1];

// ventola: pale + mozzo in un pezzo solo, gira attorno a Z
function geoVentola(r, pale, q) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.02 * r / 0.2); s.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.92, -r * 0.08);
  s.quadraticCurveTo(r * 0.98, r * 0.06, r * 0.9, r * 0.14); s.quadraticCurveTo(r * 0.5, r * 0.12, 0, r * 0.1);
  const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.02, bevelEnabled: true, bevelThickness: r * 0.006, bevelSize: r * 0.006, bevelSegments: 1, curveSegments: segm(q, 10, 6, 4) });
  const f = new Fusore(), k = {};
  for (let i = 0; i < pale; i++) f.add(g, k, new THREE.Matrix4().makeRotationZ((i / pale) * Math.PI * 2).multiply(new THREE.Matrix4().makeRotationX(0.38)));
  f.add(new THREE.SphereGeometry(r * 0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), k, mat4(0, 0, 0, Math.PI / 2));
  return f.geometrie().get(k);
}
// griglia di protezione a cerchi e raggi, nel piano XY
function geoGriglia(r, q) {
  const f = new Fusore(), k = {};
  for (const rr of [0.25, 0.45, 0.65, 0.85, 1.0]) f.add(new THREE.TorusGeometry(r * rr, r * 0.012, 4, segm(q, 48, 32, 24)), k);
  for (let i = 0; i < 6; i++) f.add(new THREE.BoxGeometry(r * 2, r * 0.018, r * 0.018), k, mat4(0, 0, 0, 0, 0, (i / 6) * Math.PI));
  return f.geometrie().get(k);
}

// ---------- container (geometria ferma, uguale per i 4: istanze per materiale) ----------
function container(M, q, mat) {
  const lo = new Fusore(), hi = new Fusore();
  const rb = (w, h, d, r = 0.006) => geoBox(w, h, d, q === 'bassa' ? 0 : r, 1);
  // piedi in cemento
  for (const sz of [-1, 1]) lo.add(geoBox(CL + 0.12, B, 0.2), M.cemento, mat4(0, B / 2, sz * 0.35));
  // corpo: blocco dietro + cornice del vano porte davanti
  const dz = CW - 0.215;
  lo.add(rb(CL - 0.03, CH - 0.14, dz, 0.01), M.bianco, mat4(0, B + CH / 2, -CW / 2 + 0.015 + dz / 2));
  const zf = ZR + 0.0925;
  lo.add(geoBox(CL - 0.03, 0.03, 0.185), M.bianco, mat4(0, B + 0.085, zf));
  lo.add(geoBox(CL - 0.03, 0.05, 0.185), M.bianco, mat4(0, B + CH - 0.095, zf));
  const ws = (CL - AP) / 2 - 0.015;
  for (const sx of [-1, 1]) lo.add(geoBox(ws, CH - 0.14, 0.185), M.bianco, mat4(sx * (AP / 2 + ws / 2), B + CH / 2, zf));
  // telaio: longheroni, traverse, montanti, blocchi d'angolo
  for (const [y, h] of [[B + 0.05, 0.1], [B + CH - 0.035, 0.07]]) {
    for (const sz of [-1, 1]) lo.add(rb(CL, h, 0.07), M.grafite, mat4(0, y, sz * (CW / 2 - 0.035)));
    for (const sx of [-1, 1]) lo.add(rb(0.07, h, CW), M.grafite, mat4(sx * (CL / 2 - 0.035), y, 0));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    lo.add(rb(0.075, CH, 0.075, 0.008), M.grafite, mat4(sx * (CL / 2 - 0.037), B + CH / 2, sz * (CW / 2 - 0.037)));
    for (const y of [B + 0.045, B + CH - 0.045]) {
      lo.add(rb(0.095, 0.09, 0.095), M.grafiteOpaca, mat4(sx * (CL / 2 - 0.045), y, sz * (CW / 2 - 0.045)));
      hi.add(geoBox(0.004, 0.026, 0.04), M.nero, mat4(sx * (CL / 2 + 0.003), y, sz * (CW / 2 - 0.045)));
    }
  }
  // tetto con due sfiati e lampeggiante
  lo.add(geoBox(CL - 0.05, 0.02, CW - 0.05), M.grafiteOpaca, mat4(0, B + CH + 0.005, 0));
  for (const x of [-0.6, 0.5]) {
    lo.add(rb(0.26, 0.07, 0.32, 0.01), M.grafite, mat4(x, B + CH + 0.05, -0.15));
    for (let i = 0; i < 6; i++) hi.add(geoBox(0.035, 0.01, 0.3), M.biancoGriglia, mat4(x - 0.1 + i * 0.04, B + CH + 0.088, -0.15, 0, 0, 0.5));
  }
  lo.add(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 16), M.grafite, mat4(-CL / 2 + 0.12, B + CH + 0.035, -CW / 2 + 0.12));
  lo.add(new THREE.SphereGeometry(0.022, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.beacon, mat4(-CL / 2 + 0.12, B + CH + 0.055, -CW / 2 + 0.12));
  // rack nel vano: armadi scuri e piastre dei moduli (le strisce di luce sono a parte)
  for (let k = 0; k < 6; k++) {
    const x = -AP / 2 + LW * (k + 0.5);
    lo.add(geoBox(LW - 0.02, 0.98, 0.05), M.grafite, mat4(x, YP, ZR + 0.025));
    for (let m = 0; m < N_MOD; m++) lo.add(geoBox(LW - 0.06, 0.095, 0.02), M.nero, mat4(x, B + 0.185 + m * 0.118, ZR + 0.06));
  }
  // climatizzatore sulla testata +X: cassa, fronte, vano ventola, feritoie
  const xe = CL / 2, fanY = B + CH - 0.38, fanZ = -0.2, fanR = 0.19;
  lo.add(rb(0.2, 0.58, 0.98, 0.02), M.bianco, mat4(xe + 0.1, fanY, 0));
  lo.add(geoBox(0.01, 0.52, 0.92), M.grafite, mat4(xe + 0.203, fanY, 0));
  lo.add(new THREE.CylinderGeometry(fanR, fanR, 0.12, segm(q, 40, 28, 20)), M.nero, mat4(xe + 0.15, fanY, fanZ, 0, 0, Math.PI / 2));
  lo.add(new THREE.TorusGeometry(fanR + 0.008, 0.016, 8, segm(q, 48, 32, 20)), M.grafite, mat4(xe + 0.21, fanY, fanZ, 0, Math.PI / 2, 0));
  for (let i = 0; i < 9; i++) lo.add(geoBox(0.05, 0.012, 0.34), M.biancoGriglia, mat4(xe + 0.215, fanY - 0.2 + i * 0.05, 0.22, 0, 0, -0.55));
  hi.add(geoGriglia(fanR, q), M.cromo, mat4(xe + 0.222, fanY, fanZ, 0, Math.PI / 2, 0));
  // quadro di stato sotto al clima: schermo, led, fungo d'emergenza, sportello cavi
  lo.add(geoBox(0.014, 0.2, 0.36), M.grafite, mat4(xe + 0.007, B + 0.42, 0.2));
  lo.add(geoBox(0.004, 0.07, 0.13), mat.schermo, mat4(xe + 0.016, B + 0.4, 0.27));
  for (let i = 0; i < 3; i++) lo.add(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), i < 2 ? mat.led : mat.ledA, mat4(xe + 0.016, B + 0.47, 0.09 + i * 0.045, 0, 0, Math.PI / 2));
  hi.add(geoBox(0.012, 0.09, 0.09, 0.006), M.giallo, mat4(xe + 0.008, B + 0.45, -0.2));
  hi.add(new THREE.CylinderGeometry(0.03, 0.034, 0.03, 20), M.rosso, mat4(xe + 0.03, B + 0.45, -0.2, 0, 0, Math.PI / 2));
  lo.add(geoBox(0.012, 0.26, 0.5), M.bianco, mat4(xe + 0.006, B + 0.2, -0.2 + 0.05));
  const bm = [];
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) bm.push(mat4Dir(xe + 0.012, B + 0.2 + sy * 0.1, -0.15 + sz * 0.22, X));
  hi.multi(geoBullone(0.008, segm(q, 12, 8, 6)), M.inoxSatinato, bm);
  return { lo, hi, fan: [xe + 0.18, fanY, fanZ] };
}

// ante: geometria per l'anta sinistra (si estende verso +X dalla cerniera) e destra (verso -X); dettagli nello stesso sistema
function ante(M, q) {
  const out = {};
  for (const lato of [1, -1]) {
    const anta = geoBox(LW - 0.006, 1.0, 0.014, 0.004, 1); anta.translate(lato * LW / 2, 0, 0);
    const d = new Fusore(), xl = x => lato * x;
    const asta = new THREE.CylinderGeometry(0.006, 0.006, 1.08, 8), camma = geoBox(0.02, 0.03, 0.028, 0.004, 1);
    for (const dd of [0.06, 0.14]) {
      d.add(asta, M.inoxSatinato, mat4(xl(LW - dd), 0, 0.016));
      for (const yy of [-0.5, 0.5]) d.add(camma, M.grafite, mat4(xl(LW - dd), yy, 0.014));
    }
    d.add(geoBox(0.014, 0.17, 0.014, 0.005, 1), M.cromo, mat4(xl(LW - 0.1), -0.08, 0.028));
    for (const yy of [-0.4, 0, 0.4]) d.add(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), M.inoxSatinato, mat4(xl(0.0), yy, 0.012));
    out[lato] = { anta, dettagli: d.geometrie() };
  }
  return out;
}

function pcs(M, q, mat) {
  const lo = new Fusore(), hi = new Fusore();
  for (const sz of [-1, 1]) lo.add(geoProfiloC(0.08, 0.06, 0.006, 1.55), M.acciaio, mat4(0, 0, sz * 0.24));
  lo.add(geoBox(1.45, 0.9, 0.6, 0.015), M.grafite, mat4(0, 0.51, 0));
  lo.add(geoBox(1.5, 0.03, 0.66, 0.008), M.grafiteOpaca, mat4(0, 0.975, 0));
  for (let d = 0; d < 3; d++) {
    const x = -0.48 + d * 0.48;
    lo.add(geoBox(0.45, 0.82, 0.012, 0.005), M.bianco, mat4(x, 0.51, 0.306));
    for (let i = 0; i < 11; i++) lo.add(geoBox(0.36, 0.01, 0.04), M.grafiteOpaca, mat4(x, 0.18 + i * 0.03, 0.316, 0.6));
    hi.add(geoBox(0.014, 0.17, 0.014, 0.005), M.cromo, mat4(x + 0.18, 0.6, 0.322));
  }
  lo.add(geoBox(0.16, 0.09, 0.004), mat.schermo, mat4(0, 0.78, 0.315));
  lo.add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), mat.led, mat4(0.12, 0.78, 0.316, Math.PI / 2));
  for (const x of [-0.4, 0.4]) {
    lo.add(new THREE.CylinderGeometry(0.15, 0.16, 0.08, segm(q, 40, 28, 20)), M.grafite, mat4(x, 1.0, 0));
    lo.add(new THREE.CircleGeometry(0.14, 24), M.nero, mat4(x, 1.041, 0, -Math.PI / 2));
    hi.add(geoGriglia(0.14, q), M.cromo, mat4(x, 1.05, 0, -Math.PI / 2));
  }
  return { lo, hi, ventole: [[-0.4, 1.045, 0], [0.4, 1.045, 0]] };
}

// passante in porcellana con alette (isolatore): unità alta 0.3
function geoPassante(q, hi) {
  const h = 0.3, r = 0.022, p = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 1.4, 0), new THREE.Vector2(r * 1.4, h * 0.08)];
  const n = hi ? 6 : 3;
  for (let i = 0; i < n; i++) {
    const y0 = h * 0.1 + (i / n) * h * 0.78, y1 = y0 + (h * 0.78) / n;
    p.push(new THREE.Vector2(r, y0), new THREE.Vector2(r * 2.1, y0 + (y1 - y0) * 0.35), new THREE.Vector2(r * 2.15, y0 + (y1 - y0) * 0.5), new THREE.Vector2(r, y1 - 0.001));
  }
  p.push(new THREE.Vector2(r * 0.9, h * 0.92), new THREE.Vector2(0, h * 0.92));
  return new THREE.LatheGeometry(p, hi ? segm(q, 32, 24, 16) : 10);
}

function trasformatore(M, q) {
  const lo = new Fusore(), hi = new Fusore();
  for (const sz of [-1, 1]) lo.add(geoProfiloC(0.07, 0.05, 0.005, 0.95), M.acciaio, mat4(0, 0, sz * 0.2));
  lo.add(geoBox(0.6, 0.62, 0.46, 0.02), M.trasformatore, mat4(0, 0.36, 0));
  lo.add(geoBox(0.68, 0.035, 0.54, 0.006), M.trasformatore, mat4(0, 0.68, 0));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 15; i++) lo.add(new THREE.BoxGeometry(0.13, 0.48, 0.005), M.trasformatore, mat4(sx * 0.368, 0.36, -0.2 + i * 0.0286));
    for (const y of [0.13, 0.6]) hi.add(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 12), M.trasformatore, mat4(sx * 0.33, y, 0, Math.PI / 2));
    hi.add(new THREE.TorusGeometry(0.03, 0.009, 6, 16, Math.PI), M.acciaio, mat4(sx * 0.3, 0.72, 0, 0, Math.PI / 2, 0));
  }
  const bul = [];
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) bul.push(mat4Dir(-0.32 + i * 0.08, 0.6975, sz * 0.25, Yv));
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) bul.push(mat4Dir(sx * 0.32, 0.6975, -0.2 + i * 0.08, Yv));
  hi.multi(geoBullone(0.009, segm(q, 12, 8, 6)), M.inoxSatinato, bul);
  hi.add(geoBox(0.12, 0.08, 0.004, 0.002), M.inoxSatinato, mat4(0.12, 0.42, 0.232));
  // isolatori: 3 di media tensione, 4 di bassa (istanze scalate)
  const mPass = [];
  for (let i = 0; i < 3; i++) mPass.push(mat4(-0.17 + i * 0.17, 0.6975, -0.1));
  for (let i = 0; i < 4; i++) mPass.push(mat4(-0.18 + i * 0.12, 0.6975, 0.16, 0, 0, 0, 0.64, 0.47, 0.64));
  return { lo, hi, mPass };
}

export function creaBESS(ctx) {
  const M = ctx.materiali, q = ctx.qualita || 'alta';
  const gruppo = new THREE.Group(); gruppo.name = 'bess';
  const mont = new Montaggio(), lod = new Dettaglio(0.5);
  const hiG = new THREE.Group(); gruppo.add(hiG); lod.hi.push(hiG);
  const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
  // luci proprie del BESS (si accendono a fine montaggio senza toccare quelle condivise)
  const mat = {
    led: new THREE.MeshBasicMaterial({ color: C('#4dff9a', 4) }), ledA: new THREE.MeshBasicMaterial({ color: C('#ffb347', 3) }),
    beacon: new THREE.MeshBasicMaterial({ color: C('#ffb347', 3) }), schermo: new THREE.MeshBasicMaterial({ color: C('#9ad8ff', 1) }),
  };
  const colLuci = { led: mat.led.color.clone(), ledA: mat.ledA.color.clone(), beacon: mat.beacon.color.clone(), schermo: mat.schermo.color.clone() };

  // ---- container: segnaposto animati dal montaggio, istanze per materiale ----
  const segna = POS.map(([x, z]) => { const o = new THREE.Object3D(); o.position.set(x, 0, z); o.updateMatrix(); gruppo.add(o); return o; });
  const cont = container(M, q, mat);
  const id = POS.map(() => new THREE.Matrix4());
  const contLo = cont.lo.istanze(gruppo, id), contHi = cont.hi.istanze(hiG, id);
  const contIms = [...contLo, ...contHi];

  // ante: 3 sinistre + 3 destre per container
  const gA = ante(M, q), cerniere = { 1: [], [-1]: [] };
  for (let p = 0; p < 3; p++) {
    const xc = -AP / 2 + LW * (2 * p + 1);
    cerniere[1].push(new THREE.Vector3(xc - LW, YP, CW / 2 - 0.007));
    cerniere[-1].push(new THREE.Vector3(xc + LW, YP, CW / 2 - 0.007));
  }
  const nA = POS.length * 3, idA = Array.from({ length: nA }, () => new THREE.Matrix4());
  const porte = {};
  for (const lato of [1, -1]) {
    const anta = istanze(gA[lato].anta, M.bianco, idA, gruppo);
    const det = []; for (const [m, g] of gA[lato].dettagli) det.push(istanze(g, m, idA, hiG));
    porte[lato] = { ims: [anta, ...det] };
  }

  // strisce di luce dei moduli: la barra di carica (ordine: rack da sinistra a destra, ogni rack dal basso in alto)
  // + una sottile barra d'oro sul longherone alto di ogni container che si riempie insieme ai rack (si legge da lontano).
  // Tutto nella stessa istanza: le barre sono 4 istanze in più (nessuna chiamata in più).
  const nS = 6 * N_MOD, nB = POS.length, nTot = POS.length * nS + nB, strLoc = [];
  const ord = new Float32Array(nTot), cnt = new Float32Array(nTot), bar = new Float32Array(nTot);
  for (let k = 0; k < 6; k++) for (let m = 0; m < N_MOD; m++) strLoc.push(mat4(-AP / 2 + LW * (k + 0.5), B + 0.205 + m * 0.118, ZR + 0.0712));
  POS.forEach((_, c) => { for (let j = 0; j < nS; j++) { const k = Math.floor(j / N_MOD), m = j % N_MOD; ord[c * nS + j] = (k + (m + 0.5) / N_MOD) / 6; cnt[c * nS + j] = c; } });
  for (let c = 0; c < nB; c++) { cnt[POS.length * nS + c] = c; bar[POS.length * nS + c] = 1; }
  const geoStr = new THREE.PlaneGeometry(LW - 0.1, 0.016);
  const barLoc = mat4(0, B + CH - 0.035, CW / 2 + 0.002, 0, 0, 0, AP / (LW - 0.1), 1.4, 1);
  geoStr.setAttribute('aOrd', new THREE.InstancedBufferAttribute(ord, 1));
  geoStr.setAttribute('aCont', new THREE.InstancedBufferAttribute(cnt, 1));
  geoStr.setAttribute('aBarra', new THREE.InstancedBufferAttribute(bar, 1));
  // uLon: 0 da vicino (come prima), 1 dall'inquadratura larga (strisce più spesse e più luminose)
  const matStr = new THREE.ShaderMaterial({
    uniforms: { uLiv: { value: 0 }, uT: { value: 0 }, uLon: { value: 0 }, uC: { value: C('#ffc87e', 2.9) }, uSpento: { value: C('#10131a') } },
    vertexShader: `attribute float aOrd; attribute float aCont; attribute float aBarra; uniform float uLiv, uLon; varying float vOrd, vLiv, vBar; varying vec2 vU;
      void main(){ vLiv = clamp(uLiv * 1.2 - aCont * 0.065, 0.0, 1.0); vOrd = aOrd; vBar = aBarra; vU = uv;
        vec3 p = position; p.y *= 1.0 + 0.8 * uLon * (1.0 - aBarra);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uC, uSpento; uniform float uT, uLon; varying float vOrd, vLiv, vBar; varying vec2 vU;
      void main(){ float o = mix(vOrd, vU.x, vBar);
        float on = smoothstep(o - 0.004, o + 0.004, vLiv);
        float fr = exp(-pow((vLiv - o) * 34.0, 2.0)) * step(0.002, vLiv) * step(vLiv, 0.998);
        float br = 0.86 + 0.14 * sin(uT * 1.2 - o * 8.0);
        float b = mix(smoothstep(0.0, 0.1, vU.x) * smoothstep(1.0, 0.9, vU.x), smoothstep(0.0, 0.006, vU.x) * smoothstep(1.0, 0.994, vU.x), vBar);
        float k = mix(1.0 + 0.5 * uLon, 0.8, vBar);
        gl_FragColor = vec4(uSpento + uC * ((on * br + fr * 2.2) * k + vBar * 0.08) * b, 1.0); }`,
  });
  const strisce = istanze(geoStr, matStr, Array.from({ length: nTot }, () => new THREE.Matrix4()), gruppo);

  // ---- PCS e trasformatore ----
  const pcsG = new THREE.Group(); pcsG.position.set(PCS_P[0], 0, PCS_P[1]); gruppo.add(pcsG);
  const P = pcs(M, q, mat); P.lo.in(pcsG); const pHi = new THREE.Group(); P.hi.in(pHi); pcsG.add(pHi); lod.hi.push(pHi);
  const trG = new THREE.Group(); trG.position.set(TR_P[0], 0, TR_P[1]); gruppo.add(trG);
  const T = trasformatore(M, q); T.lo.in(trG); const tHi = new THREE.Group(); T.hi.in(tHi); trG.add(tHi); lod.hi.push(tHi);
  const gpHi = geoPassante(q, true), gpLo = geoPassante(q, false);
  const pass = istanze(gpLo, M.ceramica, T.mPass, trG), capp = istanze(new THREE.CylinderGeometry(0.012, 0.012, 0.048, 10).translate(0, 0.3, 0), M.ottone, T.mPass, trG);
  lod.cambio(pass, gpHi, gpLo);
  fissaSfera([pass, capp], 0.3);

  // ---- ventole (4 dei clima + 2 del PCS): un'unica istanza che gira ----
  const rotori = istanze(geoVentola(0.18, 5, q), M.inoxSatinato, Array.from({ length: 6 }, () => new THREE.Matrix4()), hiG);

  // ---- linee d'energia a terra: trasformatore → PCS → corsia → container ----
  const linea = M.nuovaLinea('#ffd27a', 2.4, 6, 0.6);
  const V = (x, z) => new THREE.Vector3(x, 0.012, z);
  const xP = PCS_P[0], xT = TR_P[0];
  const percorsi = [
    [V(xT + 0.1, TR_P[1] + 0.3), V(xT + 0.1, -0.15), V(xP - 0.25, 0.25), V(xP - 0.25, PCS_P[1] - 0.36)],
    [V(xP + 0.4, PCS_P[1] - 0.36), V(xP + 0.6, 0.06), V(-1.5, 0), V(POS[1][0] - 0.9, 0)],
    ...POS.map(([x, z]) => [V(x - 0.9, 0), V(x - 0.9, z > 0 ? 0.12 : -0.12), V(x - 0.9, z > 0 ? 0.26 : -0.26)]),
  ];
  const fl = new Fusore(), kL = {};
  for (const p of percorsi) fl.add(geoTubo(p, 0.012, segm(q, 64, 40, 24), 5), kL);
  const geoLinee = fl.geometrie().get(kL);
  const linee = new THREE.Mesh(geoLinee, linea); gruppo.add(linee);

  // ---- sincronizzazione delle istanze con i segnaposto ----
  const _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _r = new THREE.Matrix4(), _f = new THREE.Matrix4();
  const fanLoc = mat4(...cont.fan, 0, Math.PI / 2, 0), pcsFan = P.ventole.map(p => mat4(p[0], p[1], p[2], -Math.PI / 2, 0, 0, 0.75));
  function sincContainer() {
    for (let c = 0; c < segna.length; c++) {
      const s = segna[c]; s.updateMatrix();
      for (let i = 0; i < contIms.length; i++) contIms[i].setMatrixAt(c, s.matrix);
      for (let j = 0; j < nS; j++) { _a.multiplyMatrices(s.matrix, strLoc[j]); strisce.setMatrixAt(c * nS + j, _a); }
      _a.multiplyMatrices(s.matrix, barLoc); strisce.setMatrixAt(POS.length * nS + c, _a);
    }
    for (let i = 0; i < contIms.length; i++) contIms[i].instanceMatrix.needsUpdate = true;
    strisce.instanceMatrix.needsUpdate = true;
  }
  // le ante di destra (che dalla camera coprono i rack) si aprono di più, oltre l'angolo retto, verso la camera
  function sincPorte(th) {
    for (let l = 0; l < 2; l++) {
      const lato = LATI[l], ims = porte[lato].ims, cer = cerniere[lato];
      _r.makeRotationY(-lato * th * (lato < 0 ? APRI_DX : 1));
      for (let c = 0; c < segna.length; c++) for (let p = 0; p < 3; p++) {
        const h = cer[p]; _b.makeTranslation(h.x, h.y, h.z).multiply(_r);
        _a.multiplyMatrices(segna[c].matrix, _b);
        for (let i = 0; i < ims.length; i++) ims[i].setMatrixAt(c * 3 + p, _a);
      }
      for (let i = 0; i < ims.length; i++) ims[i].instanceMatrix.needsUpdate = true;
    }
  }
  function sincRotori(ang) {
    _r.makeRotationZ(ang);
    for (let c = 0; c < segna.length; c++) { _a.multiplyMatrices(segna[c].matrix, fanLoc).multiply(_r); rotori.setMatrixAt(c, _a); }
    pcsG.updateMatrix();
    for (let i = 0; i < 2; i++) { _f.makeRotationZ(-ang * 1.3); _a.multiplyMatrices(pcsG.matrix, pcsFan[i]).multiply(_f); rotori.setMatrixAt(4 + i, _a); }
    rotori.instanceMatrix.needsUpdate = true;
  }
  sincContainer(); sincPorte(0); sincRotori(0);
  fissaSfera([...contIms, strisce, rotori, ...porte[1].ims, ...porte[-1].ims], 2.6);

  // ---- montaggio ----
  segna.forEach((s, c) => { const a = 0.02 + c * 0.11; mont.oggetto(s, a, a + 0.22, { off: [0, 2.4, 0], rot: [0, 0.25, 0] }); });
  mont.oggetto(pcsG, 0.5, 0.68, { off: [0, 1.6, 0], rot: [0, -0.3, 0] });
  mont.oggetto(trG, 0.56, 0.74, { off: [0, 1.6, 0], rot: [0, 0.3, 0] });
  T.mPass.forEach((_, i) => { const a = 0.7 + i * 0.018; mont.istanza([pass, capp], i, a, a + 0.07, { off: [0, 0.18, 0] }); });
  mont.funzione(0.74, 0.92, x => { rivela(geoLinee, x); linee.visible = x > 0; });
  let kLuci = 1;
  mont.funzione(0.88, 1.0, x => { kLuci = x; });

  let ang = 0, tPrima = null, thPrima = -1, montPrima = -1;
  return {
    gruppo,
    dettaglio: lod,
    qualita(nq) { lod.permesso = nq !== 'bassa'; },
    aggiorna(s) {
      const cambiato = mont.aggiorna(s.montaggio);
      lod.aggiorna(s.vicino);
      const f = s.funzione, t = s.t;
      const dt = tPrima === null ? 0 : Math.min(0.1, Math.max(0, t - tPrima)); tPrima = t;
      // porte socchiuse che "respirano", carica dei rack
      const th = 1.05 * morbido(rampa(f, 0, 0.3)) + 0.035 * Math.sin(t * 0.9) * rampa(f, 0.3, 0.5);
      if (cambiato || s.montaggio !== montPrima) sincContainer();
      if (cambiato || th !== thPrima) sincPorte(th);
      thPrima = th; montPrima = s.montaggio;
      matStr.uniforms.uLiv.value = rampa(f, 0.22, 1.0); matStr.uniforms.uT.value = t; matStr.uniforms.uLon.value = 1 - (s.vicino || 0);
      strisce.visible = f > 0.001;
      // ventole
      ang += dt * 7 * rampa(f, 0.08, 0.4);
      if (lod.on) sincRotori(ang);
      // linee e luci
      linea.uniforms.uT.value = t; linea.uniforms.uK.value = 0.25 + 0.75 * rampa(f, 0.05, 0.3);
      const lamp = f > 0.02 ? (Math.sin(t * 2.4) > -0.6 ? 1 : 0.15) : 0.6;
      mat.led.color.copy(colLuci.led).multiplyScalar(kLuci * lamp);
      mat.ledA.color.copy(colLuci.ledA).multiplyScalar(kLuci * (0.6 + 0.4 * Math.sin(t * 1.7)));
      mat.beacon.color.copy(colLuci.beacon).multiplyScalar(kLuci * (f > 0.02 ? 0.5 + 0.5 * Math.max(0, Math.sin(t * 3.1)) : 0.3));
      mat.schermo.color.copy(colLuci.schermo).multiplyScalar(0.15 + kLuci * (0.6 + 0.6 * f));
    },
  };
}
