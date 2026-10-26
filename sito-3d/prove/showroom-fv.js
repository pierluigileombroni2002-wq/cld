// Showroom ERI · isola 1: tracker monoassiali (fotovoltaico) + fila rialzata (agrivoltaico).
// Scala: 1 unità = 2 m. File lungo X, rotazione attorno a X. Origine = piano del podio.
import * as THREE from 'three';
import { M, box, cil, cavo, istanze, geoBullone, geoProfiloI, geoProfiloC, texCelle, RoundedBoxGeometry } from './showroom-mat.js';

const N_MOD = 10, MW = 0.555, ML = 1.13, FH = 0.022, FW = 0.012, PASSO = MW + 0.012;
const L = N_MOD * PASSO;

let geoModulo = null, matVetro = null, matRetro = null;
function preparaModulo() {
  if (geoModulo) return;
  const s = new THREE.Shape();
  s.moveTo(-MW / 2, -ML / 2); s.lineTo(MW / 2, -ML / 2); s.lineTo(MW / 2, ML / 2); s.lineTo(-MW / 2, ML / 2); s.lineTo(-MW / 2, -ML / 2);
  const h = new THREE.Path();
  h.moveTo(-MW / 2 + FW, -ML / 2 + FW); h.lineTo(-MW / 2 + FW, ML / 2 - FW); h.lineTo(MW / 2 - FW, ML / 2 - FW); h.lineTo(MW / 2 - FW, -ML / 2 + FW); h.lineTo(-MW / 2 + FW, -ML / 2 + FW);
  s.holes.push(h);
  const telaio = new THREE.ExtrudeGeometry(s, { depth: FH - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2 });
  telaio.rotateX(-Math.PI / 2); telaio.translate(0, 0.002, 0);
  const vetro = new THREE.PlaneGeometry(MW - FW * 1.6, ML - FW * 1.6); vetro.rotateX(-Math.PI / 2); vetro.translate(0, FH - 0.005, 0);
  const retro = new THREE.PlaneGeometry(MW - FW, ML - FW); retro.rotateX(Math.PI / 2); retro.translate(0, 0.004, 0);
  const jb = new RoundedBoxGeometry(0.07, 0.014, 0.045, 2, 0.004); jb.translate(0, -0.004, -ML * 0.36);
  geoModulo = { telaio, vetro, retro, jb };
  matVetro = new THREE.MeshPhysicalMaterial({ map: texCelle(), color: '#ffffff', metalness: 0.1, roughness: 0.11,
    clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2, specularIntensity: 1 });
  matRetro = new THREE.MeshPhysicalMaterial({ color: '#141a2a', metalness: 0.2, roughness: 0.25, clearcoat: 0.6 }); // bifacciale vetro-vetro
}

function ingranaggio(rRad, rTesta, denti, spess) {
  const s = new THREE.Shape();
  for (let i = 0; i < denti; i++) {
    const a0 = (i / denti) * Math.PI * 2, d = (Math.PI * 2) / denti;
    const p = [[rRad, a0], [rTesta, a0 + d * 0.22], [rTesta, a0 + d * 0.5], [rRad, a0 + d * 0.72]];
    p.forEach(([r, a], k) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  const foro = new THREE.Path(); foro.absarc(0, 0, rRad * 0.55, 0, Math.PI * 2, true); s.holes.push(foro);
  const g = new THREE.ExtrudeGeometry(s, { depth: spess, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 24 });
  g.translate(0, 0, -spess / 2); g.rotateY(Math.PI / 2);
  return g;
}

function fila({ H = 1.15, agri = false, motore = true }) {
  preparaModulo();
  const fila = new THREE.Group();
  const asse = new THREE.Group(); asse.position.y = H; fila.add(asse);
  const xs = agri ? [-2.45, -1.2, 0, 1.2, 2.45] : [-2.55, -1.3, 0, 1.3, 2.55];
  const bul = geoBullone(0.009), bulP = geoBullone(0.006);
  const bulloni = [], bulloniP = [];
  const X = new THREE.Vector3(1, 0, 0), mX = new THREE.Vector3(-1, 0, 0), Yv = new THREE.Vector3(0, 1, 0);

  // --- pali a I, piastre cuscinetto e cuscinetti
  const piastraS = new THREE.Shape();
  piastraS.moveTo(-0.085, -0.16); piastraS.lineTo(0.085, -0.16); piastraS.lineTo(0.085, 0.02);
  piastraS.absarc(0, 0.02, 0.085, 0, Math.PI, false); piastraS.lineTo(-0.085, -0.16);
  const foro = new THREE.Path(); foro.absarc(0, 0.02, 0.074, 0, Math.PI * 2, true); piastraS.holes.push(foro);
  const geoPiastra = new THREE.ExtrudeGeometry(piastraS, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 32 });
  geoPiastra.translate(0, 0, -0.006); geoPiastra.rotateY(Math.PI / 2);
  const geoAnello = new THREE.TorusGeometry(0.069, 0.01, 12, 48); geoAnello.rotateY(Math.PI / 2);
  for (const x of xs) {
    const centrale = motore && x === 0;
    const hp = H - 0.17 + (centrale ? -0.08 : 0);
    const p = new THREE.Mesh(geoProfiloI(centrale ? 0.1 : 0.075, centrale ? 0.12 : 0.095, 0.008, 0.011, hp + 0.04), M.acciaio);
    p.geometry.rotateY(Math.PI / 2); p.position.set(x, -0.04, 0); p.castShadow = p.receiveShadow = true; fila.add(p);
    if (agri) { // controventi a ginocchio
      for (const sz of [-1, 1]) {
        const d = box(0.022, 0.6, 0.022, M.acciaio, 0.003); d.position.set(x, H - 0.48, sz * 0.16); d.rotation.x = sz * 0.55; fila.add(d);
      }
    }
    if (!centrale) {
      const pl = new THREE.Mesh(geoPiastra, M.acciaio); pl.position.set(x + 0.045, H - 0.02, 0); pl.castShadow = true; fila.add(pl);
      const an = new THREE.Mesh(geoAnello, M.nero); an.position.set(x + 0.045, H, 0); fila.add(an);
      for (const [yy, zz] of [[-0.13, -0.05], [-0.13, 0.05], [-0.07, -0.05], [-0.07, 0.05]]) bulloni.push({ p: new THREE.Vector3(x + 0.052, H + yy, zz), n: X });
    }
  }

  // --- motoriduttore (slew drive) sul palo centrale
  if (motore) {
    const gx = 0;
    const matCarter = M.grafite.clone(); matCarter.side = THREE.DoubleSide;
    const carter = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 64), M.inoxSatinato);
    carter.rotation.z = Math.PI / 2; carter.position.set(gx, H, 0); carter.castShadow = true; fila.add(carter);
    for (const sx of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 16, 64), M.grafite);
      fl.rotation.y = Math.PI / 2; fl.position.set(gx + sx * 0.052, H, 0); fl.castShadow = true; fila.add(fl);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        bulloniP.push({ p: new THREE.Vector3(gx + sx * 0.074, H + Math.sin(a) * 0.13, Math.cos(a) * 0.13), n: sx > 0 ? X : mX });
      }
    }
    // supporto a sella sul palo
    const sella = box(0.12, 0.09, 0.2, M.acciaioScuro, 0.008); sella.position.set(gx, H - 0.19, 0); fila.add(sella);
    // motore con alette di raffreddamento, dietro al carter
    const mot = new THREE.Group(); mot.position.set(gx, H - 0.12, 0.17); mot.rotation.set(0.3, Math.PI, 0); fila.add(mot);
    const vite = box(0.1, 0.09, 0.12, M.grafite, 0.012); vite.position.set(gx, H - 0.1, 0.1); fila.add(vite); // scatola della vite senza fine
    const corpo = cil(0.042, 0.042, 0.16, M.bianco, 40); corpo.rotation.x = Math.PI / 2; mot.add(corpo);
    for (let i = 0; i < 9; i++) { const al = cil(0.05, 0.05, 0.005, M.biancoGriglia, 40); al.rotation.x = Math.PI / 2; al.position.z = -0.06 + i * 0.014; mot.add(al); }
    const tappo = cil(0.036, 0.044, 0.025, M.grafite, 40); tappo.rotation.x = Math.PI / 2; tappo.position.z = -0.09; mot.add(tappo);
    const pressacavo = cil(0.009, 0.009, 0.02, M.ottone, 16); pressacavo.rotation.x = Math.PI / 2; pressacavo.position.z = -0.11; mot.add(pressacavo);
    // centralina del tracker con mini pannello e led
    const cb = box(0.13, 0.17, 0.06, M.bianco, 0.01); cb.position.set(gx, H - 0.55, -0.1); fila.add(cb);
    const sp = box(0.11, 0.008, 0.14, M.alluminio, 0.002); sp.position.set(gx, H - 0.43, -0.13); sp.rotation.x = 0.5; fila.add(sp);
    const spv = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.12), matVetro); spv.rotation.x = -Math.PI / 2 + 0.5; spv.position.set(gx, H - 0.425, -0.128); fila.add(spv);
    const led = box(0.012, 0.012, 0.004, M.ledVerde, 0); led.position.set(gx + 0.035, H - 0.5, -0.068); fila.add(led); fila.userData.led = led;
    fila.add(cavo([new THREE.Vector3(gx, H - 0.17, 0.29), new THREE.Vector3(gx + 0.06, H - 0.3, 0.24), new THREE.Vector3(gx + 0.07, H - 0.45, 0.02), new THREE.Vector3(gx + 0.03, H - 0.47, -0.07)], 0.006, M.cavo));
  }

  // --- parte rotante: tubo di torsione, ingranaggio, arcarecci, moduli, morsetti, cavi di stringa
  const G = motore ? 0.15 : 0; // varco tra i moduli in corrispondenza del motoriduttore
  const cx = i => -L / 2 + PASSO * (i + 0.5) + (i < N_MOD / 2 ? -G : G);
  const tubo = new THREE.Mesh(new RoundedBoxGeometry(L + 0.12 + G * 2, 0.1, 0.1, 3, 0.014), M.acciaio); tubo.castShadow = tubo.receiveShadow = true; asse.add(tubo);
  // (ingranaggio della ralla chiuso nel carter)
  const geoArc = geoProfiloC(0.034, 0.026, 0.003, 0.86); geoArc.rotateY(Math.PI / 2);
  const geoStaffa = new RoundedBoxGeometry(0.03, 0.118, 0.118, 2, 0.006);
  const arcarecci = [], staffe = [], morsetti = [];
  const seams = [];
  for (let i = 0; i < N_MOD; i++) for (const s of [-1, 1]) { const x = +(cx(i) + s * PASSO / 2).toFixed(4); if (!seams.includes(x)) seams.push(x); }
  const _m = new THREE.Matrix4();
  for (const x of seams) {
    arcarecci.push(new THREE.Vector3(x, 0.05, 0));
    staffe.push(new THREE.Vector3(x, 0, 0));
    for (const z of [-0.36, 0.36]) {
      morsetti.push(new THREE.Vector3(x, 0.076 + FH, z));
      bulloniP.push({ p: new THREE.Vector3(x, 0.083 + FH, z), n: Yv });
    }
    bulloni.push({ p: new THREE.Vector3(x, 0, 0.059), n: new THREE.Vector3(0, 0, 1) }, { p: new THREE.Vector3(x, 0, -0.059), n: new THREE.Vector3(0, 0, -1) });
  }
  const imA = new THREE.InstancedMesh(geoArc, M.alluminio, arcarecci.length);
  const imS = new THREE.InstancedMesh(geoStaffa, M.acciaioScuro, staffe.length);
  const imC = new THREE.InstancedMesh(new RoundedBoxGeometry(0.024, 0.014, 0.05, 2, 0.003), M.alluminio, morsetti.length);
  arcarecci.forEach((p, i) => imA.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z)));
  staffe.forEach((p, i) => imS.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z)));
  morsetti.forEach((p, i) => imC.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z)));
  for (const im of [imA, imS, imC]) { im.castShadow = im.receiveShadow = true; asse.add(im); }

  const n = N_MOD, mods = { telaio: M.alluminio, vetro: matVetro, retro: matRetro, jb: M.nero };
  for (const k in mods) {
    const im = new THREE.InstancedMesh(geoModulo[k], mods[k], n);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, _m.makeTranslation(cx(i), 0.078, 0));
    im.castShadow = k !== 'jb'; im.receiveShadow = true; asse.add(im);
  }
  // cavi di stringa sotto al tubo, con piccola catenaria tra le fascette
  for (const z of [-0.025, 0.025]) {
    const pts = [];
    for (let i = 0; i <= n * 2; i++) { const x = -(L / 2 + G) + (i / (n * 2)) * (L + 2 * G); pts.push(new THREE.Vector3(x, -0.062 - (i % 2 ? 0.022 : 0), z)); }
    asse.add(cavo(pts, 0.0055, M.cavo, 400));
  }
  const fasc = []; for (const x of seams) fasc.push({ p: new THREE.Vector3(x + 0.02, -0.057, 0), n: Yv });
  asse.add(istanze(new THREE.TorusGeometry(0.035, 0.004, 6, 24).rotateY(Math.PI / 2).scale(1, 0.5, 1.5), M.nero, fasc));

  fila.add(istanze(bul, M.inoxSatinato, bulloni.filter(b => !b.rot && b.p.y > H - 0.3 && Math.abs(b.p.y - H) > 0.001)));
  asse.add(istanze(bul, M.inoxSatinato, bulloni.filter(b => Math.abs(b.p.y) < 0.001)));
  const bpRuota = bulloniP.filter(b => b.p.y < 0.3), bpFissi = bulloniP.filter(b => b.p.y >= 0.3);
  if (bpRuota.length) asse.add(istanze(bulP, M.inoxSatinato, bpRuota));
  if (bpFissi.length) fila.add(istanze(bulP, M.inox, bpFissi));
  fila.userData.asse = asse;
  return fila;
}

// colture astratte: file di punti luminosi che pulsano in onda (nessuna vegetazione)
function colture(lung, file, passoZ) {
  const per = 46, n = per * file;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color('#e9f2a0') } },
    vertexShader: `uniform float uT; varying float vB;
      void main(){ vec3 p = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
        float w = pow(0.5 + 0.5 * sin(p.x * 1.6 - uT * 2.2 + p.z * 3.0), 10.0);
        vB = 0.35 + 3.2 * w; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position * (0.8 + w * 0.5), 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vB; void main(){ gl_FragColor = vec4(uC * vB, 1.0); }`,
  });
  const g = new THREE.OctahedronGeometry(0.022, 0); g.scale(1, 0.6, 1);
  const im = new THREE.InstancedMesh(g, mat, n), m = new THREE.Matrix4();
  let k = 0;
  for (let f = 0; f < file; f++) for (let i = 0; i < per; i++) im.setMatrixAt(k++, m.makeTranslation(-lung / 2 + (i + 0.5) * (lung / per), 0.03, (f - (file - 1) / 2) * passoZ));
  im.userData.mat = mat;
  // sottili linee di luce sotto ai punti
  const linee = new THREE.Group();
  for (let f = 0; f < file; f++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(lung, 0.003, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe08a').multiplyScalar(0.5) }));
    l.position.set(0, 0.006, (f - (file - 1) / 2) * passoZ); linee.add(l);
  }
  const gr = new THREE.Group(); gr.add(im, linee); gr.userData.mat = mat; return gr;
}

export function creaFV() {
  const gruppo = new THREE.Group();
  const righe = [
    { z: -2.2, H: 2.25, agri: true },
    { z: -0.62, H: 1.12 },
    { z: 0.88, H: 1.12 },
    { z: 2.38, H: 1.12 },
  ];
  const file = righe.map((r, i) => {
    const f = fila(r); f.position.z = r.z; f.userData.fase = i * 0.35; gruppo.add(f); return f;
  });
  const col = colture(5.2, 5, 0.22); col.position.z = -2.2; gruppo.add(col);
  return {
    gruppo, pezzi: [...file, col],
    viste: {
      fv: { pos: [-1.45, 0.95, 4.45], target: [0.05, 1.0, 2.38], fov: 32 }, // coordinate locali dell'isola
    },
    aggiorna(t) {
      for (const f of file) {
        f.userData.asse.rotation.x = 0.42 + 0.32 * Math.sin(t * 0.12 - f.userData.fase);
        if (f.userData.led) f.userData.led.visible = Math.sin(t * 3.0) > -0.6;
      }
      col.userData.mat.uniforms.uT.value = t;
    },
  };
}
