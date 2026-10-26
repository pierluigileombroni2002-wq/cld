// Showroom ERI · isola 2: impianto BESS (container batteria, PCS, trasformatore MT, canalina, recinzione).
// Scala: 1 unità = 2 m. Origine = piano del podio. Il fronte (+Z) guarda la camera.
import * as THREE from 'three';
import { M, box, cil, cavo, istanze, geoBullone, geoProfiloC, texGhiaia, texRete, RoundedBoxGeometry } from './showroom-mat.js';

// raccoglie pezzi uguali in InstancedMesh (un gruppo per oggetto)
class Lotti {
  constructor() { this.m = new Map(); }
  add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const k = geo.uuid + mat.uuid;
    if (!this.m.has(k)) this.m.set(k, { geo, mat, l: [] });
    const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.updateMatrix();
    this.m.get(k).l.push(o.matrix.clone());
  }
  in(gr) {
    for (const { geo, mat, l } of this.m.values()) {
      const im = new THREE.InstancedMesh(geo, mat, l.length); l.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = im.receiveShadow = true; gr.add(im);
    }
  }
}

function ventola(r, pale, mat) {
  const v = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.02 * r / 0.2); s.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.92, -r * 0.08);
  s.quadraticCurveTo(r * 0.98, r * 0.06, r * 0.9, r * 0.14); s.quadraticCurveTo(r * 0.5, r * 0.12, 0, r * 0.1);
  const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.02, bevelEnabled: true, bevelThickness: r * 0.006, bevelSize: r * 0.006, bevelSegments: 1 });
  for (let i = 0; i < pale; i++) {
    const p = new THREE.Mesh(g, mat); p.rotation.z = (i / pale) * Math.PI * 2; p.rotateX(0.38); p.castShadow = true; v.add(p);
  }
  const mozzo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.grafite);
  mozzo.rotation.x = Math.PI / 2; v.add(mozzo);
  return v;
}

function griglia(r, lotti, x, y, z) { // griglia di protezione a cerchi concentrici e raggi, piano XY
  for (const rr of [0.25, 0.45, 0.65, 0.85, 1.0]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * rr, r * 0.012, 6, 64), M.cromo); t.position.set(x, y, z); lotti.push(t);
  }
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 2, r * 0.018, r * 0.018), M.cromo); b.position.set(x, y, z); b.rotation.z = (i / 6) * Math.PI; lotti.push(b);
  }
}

const W = 1.22, H = 1.3, LC = 3.0, B = 0.12;
let geoC = null;
function preparaGeo() {
  if (geoC) return;
  geoC = {
    anta: new RoundedBoxGeometry(0.012, 1.0, 0.43, 2, 0.004),
    maniglia: new RoundedBoxGeometry(0.014, 0.17, 0.014, 2, 0.005),
    asta: new THREE.CylinderGeometry(0.006, 0.006, 1.08, 10),
    camma: new RoundedBoxGeometry(0.02, 0.03, 0.028, 2, 0.004),
    cerniera: new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12),
    giunto: new THREE.BoxGeometry(0.004, 1.0, 0.008),
    lamella: new RoundedBoxGeometry(0.34, 0.012, 0.05, 1, 0.003),
    lamellaPCS: new RoundedBoxGeometry(0.36, 0.01, 0.04, 1, 0.003),
    aletta: new THREE.BoxGeometry(0.13, 0.48, 0.005),
    bullone: geoBullone(0.008),
  };
}

function container() {
  preparaGeo();
  const c = new THREE.Group(), L = new Lotti(), sciolti = [];
  for (const sx of [-1, 1]) { const p = box(0.2, B, LC + 0.12, M.cemento, 0.012); p.position.set(sx * 0.4, B / 2, 0); c.add(p); }
  const corpo = box(W - 0.03, H - 0.14, LC - 0.03, M.bianco, 0.01); corpo.position.y = B + H / 2; c.add(corpo);
  // telaio: longheroni, montanti, blocchi d'angolo ISO
  for (const [y, h] of [[B + 0.05, 0.1], [B + H - 0.035, 0.07]]) {
    for (const sx of [-1, 1]) { const r = box(0.07, h, LC, M.grafite, 0.006); r.position.set(sx * (W / 2 - 0.035), y, 0); c.add(r); }
    for (const sz of [-1, 1]) { const r = box(W, h, 0.07, M.grafite, 0.006); r.position.set(0, y, sz * (LC / 2 - 0.035)); c.add(r); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = box(0.075, H, 0.075, M.grafite, 0.008); m.position.set(sx * (W / 2 - 0.037), B + H / 2, sz * (LC / 2 - 0.037)); c.add(m);
    for (const y of [B + 0.045, B + H - 0.045]) {
      const k = box(0.095, 0.09, 0.095, M.grafiteOpaca, 0.006); k.position.set(sx * (W / 2 - 0.045), y, sz * (LC / 2 - 0.045)); c.add(k);
      const fo = box(0.04, 0.026, 0.004, M.nero, 0.002); fo.position.set(sx * (W / 2 - 0.045), y, sz * (LC / 2 + 0.003)); c.add(fo);
    }
  }
  // tetto: bordo, sfiati, lampeggiante
  const tetto = box(W - 0.05, 0.02, LC - 0.05, M.grafiteOpaca, 0.006); tetto.position.y = B + H + 0.005; c.add(tetto);
  for (const z of [-0.8, 0.5]) {
    const sf = box(0.32, 0.07, 0.26, M.grafite, 0.01); sf.position.set(0.15, B + H + 0.05, z); c.add(sf);
    for (let i = 0; i < 6; i++) L.add(geoC.lamella, M.biancoGriglia, 0.15, B + H + 0.05, z - 0.1 + i * 0.04, 0.5, Math.PI / 2, 0);
  }
  const fa = cil(0.022, 0.026, 0.04, M.grafite, 20); fa.position.set(-W / 2 + 0.12, B + H + 0.035, LC / 2 - 0.12); c.add(fa);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.ledAmbra); lamp.position.set(-W / 2 + 0.12, B + H + 0.055, LC / 2 - 0.12); c.add(lamp);
  // porte sui lati lunghi: 3 coppie per lato, con aste di chiusura, maniglie, cerniere
  for (const sx of [-1, 1]) for (const zc of [-0.96, 0, 0.96]) for (const sl of [-1, 1]) {
    const x = sx * (W / 2 - 0.006), z = zc + sl * 0.222, y = B + 0.63;
    L.add(geoC.anta, M.bianco, x, y, z);
    L.add(geoC.giunto, M.nero, x, y, zc);
    for (const dz of [0.06, 0.14]) {
      const zz = zc + sl * dz;
      L.add(geoC.asta, M.inoxSatinato, x + sx * 0.016, y, zz);
      for (const yy of [y - 0.5, y + 0.5]) L.add(geoC.camma, M.grafite, x + sx * 0.014, yy, zz);
    }
    L.add(geoC.maniglia, M.cromo, x + sx * 0.028, y - 0.08, zc + sl * 0.1);
    for (const yy of [y - 0.4, y, y + 0.4]) L.add(geoC.cerniera, M.inoxSatinato, x + sx * 0.012, yy, zc + sl * 0.43);
  }
  // testata frontale: condizionatore con ventola, feritoie, pannello stato e fungo di emergenza
  const zf = LC / 2;
  const hv = box(0.98, 0.58, 0.2, M.bianco, 0.02); hv.position.set(0, B + H - 0.38, zf + 0.1); c.add(hv);
  const fronte = box(0.92, 0.52, 0.01, M.grafite, 0.004); fronte.position.set(0, B + H - 0.38, zf + 0.203); c.add(fronte);
  const fanY = B + H - 0.38, fanX = 0.2, fanR = 0.19;
  const vano = cil(fanR, fanR, 0.12, M.nero, 48); vano.rotation.x = Math.PI / 2; vano.position.set(fanX, fanY, zf + 0.15); c.add(vano);
  const bordo = new THREE.Mesh(new THREE.TorusGeometry(fanR + 0.008, 0.016, 12, 64), M.grafite); bordo.position.set(fanX, fanY, zf + 0.21); c.add(bordo);
  const v = ventola(fanR * 0.95, 5, M.inoxSatinato); v.position.set(fanX, fanY, zf + 0.18); v.name = 'ventola'; c.add(v);
  griglia(fanR, sciolti, fanX, fanY, zf + 0.222);
  for (let i = 0; i < 9; i++) L.add(geoC.lamella, M.biancoGriglia, -0.22, fanY - 0.2 + i * 0.05, zf + 0.215, 0.55, 0, 0);
  const pan = box(0.36, 0.2, 0.014, M.grafite, 0.005); pan.position.set(-0.22, B + 0.42, zf + 0.008); c.add(pan);
  const leds = [];
  [M.ledVerde, M.ledVerde, M.ledAmbra].forEach((m, i) => { const l = cil(0.011, 0.011, 0.01, m, 14); l.rotation.x = Math.PI / 2; l.position.set(-0.33 + i * 0.045, B + 0.47, zf + 0.018); c.add(l); leds.push(l); });
  const schermo = box(0.13, 0.07, 0.004, new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ad8ff').multiplyScalar(0.9) }), 0.002); schermo.position.set(-0.15, B + 0.4, zf + 0.017); c.add(schermo);
  const base = box(0.09, 0.09, 0.012, new THREE.MeshPhysicalMaterial({ color: '#f2c200', roughness: 0.35, clearcoat: 1 }), 0.006); base.position.set(0.3, B + 0.45, zf + 0.008); c.add(base);
  const fungo = cil(0.03, 0.034, 0.03, new THREE.MeshPhysicalMaterial({ color: '#d1170f', roughness: 0.25, clearcoat: 1 }), 24); fungo.rotation.x = Math.PI / 2; fungo.position.set(0.3, B + 0.45, zf + 0.03); c.add(fungo);
  // pannello d'accesso cavi in basso
  const acc = box(0.5, 0.26, 0.012, M.bianco, 0.005); acc.position.set(0.15, B + 0.2, zf + 0.006); c.add(acc);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const b = new THREE.Mesh(geoC.bullone, M.inoxSatinato); b.rotation.x = Math.PI / 2; b.position.set(0.15 + sx * 0.22, B + 0.2 + sy * 0.1, zf + 0.012); c.add(b);
  }
  for (const s of sciolti) c.add(s);
  L.in(c);
  return c;
}

function pcs() {
  preparaGeo();
  const g = new THREE.Group(), L = new Lotti();
  for (const sz of [-1, 1]) { const ch = new THREE.Mesh(geoProfiloC(0.08, 0.06, 0.006, 1.55), M.acciaio); ch.position.set(0, 0, sz * 0.24); ch.castShadow = true; g.add(ch); }
  const corpo = box(1.45, 0.9, 0.6, M.grafite, 0.015); corpo.position.y = 0.06 + 0.45; g.add(corpo);
  const tetto = box(1.5, 0.03, 0.66, M.grafiteOpaca, 0.008); tetto.position.y = 0.06 + 0.915; g.add(tetto);
  for (let d = 0; d < 3; d++) {
    const x = -0.48 + d * 0.48;
    const anta = box(0.45, 0.82, 0.012, M.bianco, 0.005); anta.position.set(x, 0.51, 0.306); g.add(anta);
    for (let i = 0; i < 11; i++) L.add(geoC.lamellaPCS, M.grafiteOpaca, x, 0.18 + i * 0.03, 0.316, 0.6, 0, 0);
    L.add(geoC.maniglia, M.cromo, x + 0.18, 0.6, 0.322);
  }
  const sch = box(0.16, 0.09, 0.004, new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ad8ff').multiplyScalar(1.1) }), 0.002); sch.position.set(0.0, 0.78, 0.315); g.add(sch);
  const led = cil(0.012, 0.012, 0.01, M.ledVerde, 14); led.rotation.x = Math.PI / 2; led.position.set(0.12, 0.78, 0.316); g.add(led);
  const ventole = [];
  for (const x of [-0.4, 0.4]) {
    const cappa = cil(0.15, 0.16, 0.08, M.grafite, 48); cappa.position.set(x, 1.0, 0); g.add(cappa);
    const vv = ventola(0.13, 7, M.inoxSatinato); vv.rotation.x = -Math.PI / 2; vv.position.set(x, 1.03, 0); g.add(vv); ventole.push(vv);
    const gr = []; griglia(0.14, gr, x, 1.045, 0); gr.forEach(m => { m.position.sub(new THREE.Vector3(x, 1.045, 0)); m.rotation.x = -Math.PI / 2; const h = new THREE.Group(); h.position.set(x, 1.045, 0); h.add(m); g.add(h); });
  }
  L.in(g); g.userData.ventole = ventole;
  return g;
}

// passante in porcellana con alette (profilo di rivoluzione)
function passante(h, r) {
  const p = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 1.4, 0), new THREE.Vector2(r * 1.4, h * 0.08)];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const y0 = h * 0.1 + (i / n) * h * 0.78, y1 = y0 + h * 0.78 / n;
    p.push(new THREE.Vector2(r, y0), new THREE.Vector2(r * 2.1, y0 + (y1 - y0) * 0.35), new THREE.Vector2(r * 2.15, y0 + (y1 - y0) * 0.5), new THREE.Vector2(r, y1 - 0.001));
  }
  p.push(new THREE.Vector2(r * 0.9, h * 0.92), new THREE.Vector2(0, h * 0.92));
  const m = new THREE.Mesh(new THREE.LatheGeometry(p, 40), M.ceramica); m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  const t = cil(r * 0.55, r * 0.55, h * 0.16, M.ottone, 20); t.position.y = h; g.add(t);
  return g;
}

function trasformatore() {
  preparaGeo();
  const g = new THREE.Group(), L = new Lotti();
  for (const sz of [-1, 1]) { const ch = new THREE.Mesh(geoProfiloC(0.07, 0.05, 0.005, 0.95), M.acciaio); ch.position.set(0, 0, sz * 0.2); g.add(ch); }
  const cassa = box(0.6, 0.62, 0.46, M.trasformatore, 0.02); cassa.position.y = 0.05 + 0.31; g.add(cassa);
  const cop = box(0.68, 0.035, 0.54, M.trasformatore, 0.006); cop.position.y = 0.05 + 0.63; g.add(cop);
  const bul = [];
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) bul.push({ p: new THREE.Vector3(-0.32 + i * 0.08, 0.7, sz * 0.25), n: new THREE.Vector3(0, 1, 0) });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) bul.push({ p: new THREE.Vector3(sx * 0.32, 0.7, -0.2 + i * 0.08), n: new THREE.Vector3(0, 1, 0) });
  g.add(istanze(geoBullone(0.009), M.inoxSatinato, bul));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 15; i++) L.add(geoC.aletta, M.trasformatore, sx * (0.3 + 0.068), 0.05 + 0.31, -0.2 + i * 0.0286);
    for (const y of [0.13, 0.6]) { const tb = cil(0.018, 0.018, 0.46, M.trasformatore, 16); tb.rotation.x = Math.PI / 2; tb.position.set(sx * 0.33, y, 0); g.add(tb); }
  }
  for (let i = 0; i < 3; i++) { const p = passante(0.3, 0.022); p.position.set(-0.17 + i * 0.17, 0.7, -0.1); g.add(p); }
  for (let i = 0; i < 4; i++) { const p = passante(0.14, 0.014); p.position.set(-0.18 + i * 0.12, 0.7, 0.16); g.add(p); }
  for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 20, Math.PI), M.acciaio); o.position.set(sx * 0.3, 0.72, 0); o.rotation.y = Math.PI / 2; g.add(o); }
  const targa = box(0.12, 0.08, 0.004, M.inoxSatinato, 0.002); targa.position.set(0.12, 0.42, 0.232); g.add(targa);
  L.in(g);
  return g;
}

function canalina(x0, x1, z, y) {
  const g = new THREE.Group(), L = new Lotti(), len = x1 - x0, xc = (x0 + x1) / 2;
  for (const sz of [-1, 1]) { const r = box(len, 0.055, 0.008, M.acciaio, 0.002); r.position.set(xc, y + 0.0275, z + sz * 0.1); g.add(r); }
  const piolo = new RoundedBoxGeometry(0.016, 0.008, 0.2, 1, 0.002), sost = new RoundedBoxGeometry(0.03, 1, 0.03, 1, 0.004), mensola = new RoundedBoxGeometry(0.03, 0.02, 0.26, 1, 0.004);
  for (let x = x0 + 0.04; x < x1; x += 0.09) L.add(piolo, M.acciaio, x, y + 0.004, z);
  for (let x = x0 + 0.2; x < x1; x += 0.8) {
    const s = new THREE.Mesh(sost, M.acciaio); s.scale.y = y; s.position.set(x, y / 2, z - 0.13); s.castShadow = true; g.add(s);
    L.add(mensola, M.acciaio, x, y - 0.012, z);
  }
  for (let i = 0; i < 5; i++) {
    const pts = []; const zz = z - 0.07 + i * 0.035;
    for (let k = 0; k <= 16; k++) { const x = x0 + (k / 16) * len; pts.push(new THREE.Vector3(x, y + 0.02 + Math.sin(k * 1.7 + i) * 0.004, zz + Math.sin(k * 0.9 + i * 2) * 0.006)); }
    g.add(cavo(pts, 0.013, M.cavo, 200));
  }
  L.in(g); return g;
}

function recinzione(r, h) {
  const g = new THREE.Group(), varco = 0.62;
  const t = texRete(); t.repeat.set((r * (Math.PI * 2 - varco * 2)) / 0.07, h / 0.07);
  const rete = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 160, 1, true, varco, Math.PI * 2 - varco * 2),
    new THREE.MeshStandardMaterial({ map: t, color: '#c9ccd2', metalness: 0.9, roughness: 0.35, alphaTest: 0.35, side: THREE.DoubleSide, alphaToCoverage: true, transparent: false }));
  rete.position.y = h / 2 + 0.04; g.add(rete);
  const pali = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const a = varco + (i / n) * (Math.PI * 2 - varco * 2);
    pali.push({ p: new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r), n: new THREE.Vector3(0, 1, 0) });
  }
  const geoPalo = new THREE.CylinderGeometry(0.014, 0.014, h + 0.08, 12); geoPalo.translate(0, (h + 0.08) / 2, 0);
  g.add(istanze(geoPalo, M.acciaio, pali));
  const arco = new THREE.Curve(); arco.getPoint = (u, v = new THREE.Vector3()) => { const a = varco + u * (Math.PI * 2 - varco * 2); return v.set(Math.sin(a) * r, h + 0.06, Math.cos(a) * r); };
  const cor = new THREE.Mesh(new THREE.TubeGeometry(arco, 200, 0.01, 8, false), M.acciaio); g.add(cor);
  return g;
}

function lampione(h) {
  const g = new THREE.Group();
  const p = cil(0.018, 0.026, h, M.grafite, 20); p.position.y = h / 2; g.add(p);
  const b = cil(0.05, 0.05, 0.02, M.grafite, 24); b.position.y = 0.01; g.add(b);
  const braccio = box(0.32, 0.02, 0.03, M.grafite, 0.006); braccio.position.set(0.15, h, 0); g.add(braccio);
  const testa = box(0.2, 0.025, 0.09, M.grafite, 0.008); testa.position.set(0.32, h - 0.005, 0); g.add(testa);
  const luce = box(0.17, 0.004, 0.07, M.lucOro, 0.001); luce.position.set(0.32, h - 0.02, 0); g.add(luce);
  return g;
}

export function creaBESS() {
  const gruppo = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(3.92, 128), new THREE.MeshStandardMaterial({ map: texGhiaia(), roughness: 0.95, metalness: 0 }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.003; pad.receiveShadow = true; gruppo.add(pad);
  const base = container();
  const conts = [-2.1, -0.7, 0.7, 2.1].map((x, i) => { const c = i ? base.clone() : base; c.position.set(x, 0, -0.85); gruppo.add(c); return c; });
  const ventole = conts.map(c => c.getObjectByName('ventola'));
  const p = pcs(); p.position.set(-2.15, 0, 2.0); p.rotation.y = 0.12; gruppo.add(p);
  const tr = trasformatore(); tr.position.set(2.2, 0, 2.0); tr.rotation.y = -0.15; gruppo.add(tr);
  for (const [o, w, d] of [[p, 1.75, 0.8], [tr, 1.15, 0.75]]) { const s = box(w, 0.05, d, M.cemento, 0.01); s.position.copy(o.position); s.position.y = -0.02; s.rotation.y = o.rotation.y; gruppo.add(s); }
  const can = canalina(-2.55, 2.55, 1.15, 0.3); gruppo.add(can);
  // condotti dai container alla canalina e dalla canalina a PCS e trasformatore
  const cond = new THREE.Group();
  for (const c of conts) for (const dx of [-0.32, 0.38]) {
    const x = c.position.x + dx;
    cond.add(cavo([new THREE.Vector3(x, 0.36, 0.66), new THREE.Vector3(x, 0.36, 0.78), new THREE.Vector3(x, 0.34, 0.95), new THREE.Vector3(x, 0.33, 1.1)], 0.02, M.grafite, 24));
  }
  cond.add(cavo([new THREE.Vector3(-2.5, 0.33, 1.15), new THREE.Vector3(-2.62, 0.28, 1.4), new THREE.Vector3(-2.5, 0.12, 1.66), new THREE.Vector3(-2.4, 0.08, 1.72)], 0.03, M.cavo, 40));
  cond.add(cavo([new THREE.Vector3(2.5, 0.33, 1.15), new THREE.Vector3(2.62, 0.28, 1.4), new THREE.Vector3(2.45, 0.12, 1.7), new THREE.Vector3(2.35, 0.08, 1.75)], 0.03, M.cavo, 40));
  gruppo.add(cond);
  const rec = recinzione(3.95, 0.92); gruppo.add(rec);
  const lamp = lampione(2.2); lamp.position.set(-3.1, 0, -2.2); lamp.rotation.y = -0.6; gruppo.add(lamp);
  const lamp2 = lampione(2.2); lamp2.position.set(3.1, 0, -2.2); lamp2.rotation.y = Math.PI + 0.6; gruppo.add(lamp2);
  const leds = [];
  gruppo.traverse(o => { if (o.material === M.ledVerde && o.isMesh && !o.isInstancedMesh) leds.push(o); });
  return {
    gruppo, pezzi: [...conts, p, tr, can, cond, rec, lamp, lamp2],
    viste: { bess: { pos: [2.95, 2.25, 6.3], target: [0.05, 0.8, 0.15], fov: 32 } },
    aggiorna(t) {
      ventole.forEach((v, i) => { v.rotation.z = -t * (5.5 + i * 0.4); });
      p.userData.ventole.forEach((v, i) => { v.rotation.z = t * (8 + i); });
      leds.forEach((l, i) => { l.visible = Math.sin(t * 2.4 + i * 1.3) > -0.7; });
    },
  };
}
