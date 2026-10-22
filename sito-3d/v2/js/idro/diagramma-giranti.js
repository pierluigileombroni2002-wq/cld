// =============================================================================
// ERI v2 · idro/diagramma-giranti.js — giranti in miniatura del diagramma 4e (file privato di idro/diagramma.js)
// Proprietario: [VALLE]. Forme procedurali, in METRI (il chiamante scala il gruppo × scalaMeccanica × scalaGiranti):
//  - Pelton: disco e mozzo al tornio, 22 cucchiai doppi (due coppe ellissoidali accostate: la cresta e l'intaglio
//    nascono dall'incontro delle due coppe), inclinati sul cerchione e con la radice a vista; asse lungo z.
//  - Francis: corona e fascia al tornio, 15 pale a S con avvolgimento di 80° (ingresso radiale a Ø 1,60 tra corona e
//    fascia, uscita a Ø 1,26 lungo la diagonale), ogiva sotto la corona; asse lungo y.
//  - Kaplan: mozzo a bulbo con ogiva, 5 pale svergolate (calettamento 1,0 → 0,35 rad, corda 1,15 → 1,75 m) con il
//    perno a vista; asse lungo y.
// Due finiture dello stesso inox (§2.6, MAI oro né bronzo): lucida per cucchiai e pale, satinata per il resto.
// Pale e coppe sono fogli singoli: i materiali sono DoubleSide.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE, IDRO } from '../config.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

// ---------------------------------------------------------------- primitive
/** Solido di rivoluzione attorno a y da un profilo [[r, y], …]. */
function tornio(profilo, segmenti = 72) {
  return new THREE.LatheGeometry(profilo.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), segmenti);
}
/** Foglio parametrico (u, v) ∈ [0,1]² → [x, y, z], con uv e normali (indicizzato, come le primitive di three). */
function foglio(f, nu, nv) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), idx = [];
  let k = 0;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = f(i / nu, j / nv); pos.set(p, k * 3); uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv; k++;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- Pelton (asse z, rotazione antioraria vista da +z)
function geoPelton() {
  const P = VALLE.girantePelton, N = P.cucchiai, rp = P.diametroPrimitivoM / 2;
  const meta = P.larghezzaCucchiaioM / 2;
  // disco (Ø 1,40 m, 0,16 m) con mozzo e moncone d'albero, al tornio attorno a y poi coricato sull'asse z
  const disco = tornio([
    [0, 0.40], [0.08, 0.40], [0.095, 0.385], [0.095, 0.21], [0.19, 0.21], [0.215, 0.19], [0.235, 0.13],
    [0.29, 0.085], [0.64, 0.072], [0.695, 0.05], [0.705, 0.0], [0.695, -0.05], [0.64, -0.072], [0.29, -0.085],
    [0.235, -0.13], [0.215, -0.19], [0.19, -0.21], [0.095, -0.21], [0.095, -0.385], [0.08, -0.40], [0, -0.40],
  ], 96);
  disco.rotateX(Math.PI / 2);
  // cucchiaio: due coppe ellissoidali (calotte y ≥ 0) accostate in z. Telaio locale: x radiale, y = verso del moto
  // (dorso), z assiale. Le coppe si aprono verso −y, contro il getto che arriva da dietro.
  const A = 0.13, prof = 0.088, B = meta * 0.56, c = meta - B;
  const parti = [];
  for (const s of [-1, 1]) {
    const g = new THREE.SphereGeometry(1, 22, 10, 0, TAU, 0, Math.PI / 2);
    g.scale(A, prof, B); g.translate(0, 0, s * c); parti.push(g);
  }
  const radice = new THREE.BoxGeometry(0.17, 0.055, 0.11); radice.translate(-0.115, 0.03, 0); parti.push(radice);
  const cucchiaio = mergeGeometries(parti); parti.forEach(g => g.dispose());
  // 22 cucchiai sul cerchio primitivo, punta inclinata all'indietro rispetto al moto
  const m = new THREE.Matrix4(), t = new THREE.Matrix4(), r = new THREE.Matrix4();
  const tutti = [];
  for (let i = 0; i < N; i++) {
    const g = cucchiaio.clone();
    m.makeRotationZ(i * TAU / N).multiply(t.makeTranslation(rp, 0, 0)).multiply(r.makeRotationZ(-0.32));
    g.applyMatrix4(m); tutti.push(g);
  }
  cucchiaio.dispose();
  const lucida = mergeGeometries(tutti); tutti.forEach(g => g.dispose());
  return { lucida, satinata: disco };
}

// ---------------------------------------------------------------- Francis (asse y)
function geoFrancis() {
  const F = VALLE.giranteFrancis, r1 = F.D1M / 2, r2 = F.D2M / 2, N = F.pale;
  // fili meridiani della corona e della fascia (r, y): finestra d'ingresso a r1 alta 0,42 m (stilizzata un po' più
  // alta del vero, così le pale si leggono di lato), uscita diagonale verso la fascia
  const C = u => [bez(r1, 0.50, 0.27, u), bez(0.02, 0.0, -0.21, u)];
  const Bf = u => [bez(r1, r1 - 0.02, r2 + 0.005, u), bez(-0.40, -0.53, -0.64, u)];
  // corona: disco appena bombato verso la flangia dell'albero, sotto segue il filo delle pale e chiude con l'ogiva
  const sotto = []; for (let i = 0; i <= 10; i++) sotto.push(C(i / 10));
  const corona = tornio([
    [0, 0.25], [0.14, 0.25], [0.16, 0.235], [0.175, 0.17], [0.30, 0.125], [0.50, 0.082], [0.68, 0.054], [0.785, 0.042],
    [r1 + 0.014, 0.034], [r1 + 0.01, 0.022], ...sotto,
    [0.25, -0.28], [0.215, -0.36], [0.16, -0.45], [0.09, -0.52], [0, -0.545],
  ], 80);
  // fascia: anello conico (interno sul filo delle pale, esterno 4 cm più fuori) con il labbro d'uscita squadrato
  const dentro = []; for (let i = 0; i <= 10; i++) dentro.push(Bf(i / 10));
  const fuori = dentro.map(([r, y]) => [r + 0.04, y]).reverse();
  const fascia = tornio([[r1 + 0.004, -0.388], ...dentro, [r2 + 0.005, -0.665], [r2 + 0.05, -0.665], [r2 + 0.05, -0.64], ...fuori, [r1 + 0.034, -0.388], [r1 + 0.004, -0.388]], 80);
  // pale: superficie rigata corona → fascia, avvolgimento 80° con curvatura a S (v un po' oltre 0 e 1: incastro)
  const wrap = 80 * Math.PI / 180, pale = [];
  for (let k = 0; k < N; k++) {
    const t0 = k * TAU / N;
    pale.push(foglio((u, v) => {
      const vv = lerp(-0.05, 1.05, v), a = C(u), b = Bf(u);
      const rr = lerp(a[0], b[0], vv), yy = lerp(a[1], b[1], vv);
      const th = t0 - wrap * (0.3 * u + 0.7 * u * u * (3 - 2 * u)) * (1 - 0.22 * vv);
      return [rr * Math.cos(th), yy, rr * Math.sin(th)];
    }, 22, 8));
  }
  const lucida = mergeGeometries(pale); pale.forEach(g => g.dispose());
  const satinata = mergeGeometries([corona, fascia]); corona.dispose(); fascia.dispose();
  return { lucida, satinata };
}

// ---------------------------------------------------------------- Kaplan (asse y)
function geoKaplan(passo = 0) {
  const K = VALLE.giranteKaplan, R = K.diametroM / 2, rm = K.mozzoM / 2, N = K.pale;
  const mozzo = tornio([
    [0, 0.98], [0.40, 0.98], [0.44, 0.95], [0.44, 0.82], [0.62, 0.80], [0.78, 0.74], [0.89, 0.62], [rm, 0.42],
    [rm, -0.22], [0.91, -0.42], [0.79, -0.63], [0.60, -0.86], [0.38, -1.06], [0.17, -1.21], [0, -1.27],
  ], 96);
  const parti = [mozzo], pale = [];
  const yc = 0.12;
  for (let k = 0; k < N; k++) {
    const t0 = k * TAU / N;
    pale.push(foglio((u, v) => {
      const r = lerp(rm - 0.04, R, u);
      const beta = lerp(1.0, 0.35, u) + passo;                       // calettamento (rad dal piano di rotazione)
      const corda = lerp(1.15, 1.75, u) * (u > 0.82 ? Math.sqrt(1 - 0.45 * ((u - 0.82) / 0.18) ** 2) : 1);
      const s = (v - 0.5) * corda + 0.16 * u * u;                    // la pala si allunga e arretra verso la punta
      const camber = 0.07 * corda * Math.sin(Math.PI * v);
      const tang = s * Math.cos(beta) + camber * Math.sin(beta);
      const ass = -s * Math.sin(beta) + camber * Math.cos(beta);
      const th = t0 + tang / r;
      return [r * Math.cos(th), yc + ass, r * Math.sin(th)];
    }, 16, 14));
    // perno della pala, a vista sul mozzo
    const p = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 40);
    p.rotateZ(-Math.PI / 2); p.translate(rm + 0.005, yc, 0); p.rotateY(-t0);
    parti.push(p);
  }
  const lucida = mergeGeometries(pale); pale.forEach(g => g.dispose());
  const satinata = mergeGeometries(parti); parti.forEach(g => g.dispose());
  return { lucida, satinata };
}

/**
 * Le tre giranti in miniatura. Ogni voce: { nome, radice (posa nel mondo), rotore (gira attorno all'asse), asse,
 * pale (numero, per il limite anti "ruota di carro"), rpm, raggio e semialtezza in metri (per pick) }.
 * @param {{lucida: THREE.Material, satinata: THREE.Material}} mat
 */
export function creaGiranti(mat) {
  const costruttori = {
    pelton:  { geo: geoPelton, asse: 'z', pale: VALLE.girantePelton.cucchiai, raggio: IDRO.pelton.girante.dM / 2, semialtezza: IDRO.pelton.girante.dM / 2, centroY: 0 },
    francis: { geo: geoFrancis, asse: 'y', pale: VALLE.giranteFrancis.pale, raggio: IDRO.francis.girante.dM / 2 + 0.04, semialtezza: 0.75, centroY: -0.05 },
    kaplan:  { geo: geoKaplan, asse: 'y', pale: VALLE.giranteKaplan.pale, raggio: IDRO.kaplan.girante.dM / 2, semialtezza: 1.1, centroY: -0.15 },
  };
  const out = {};
  for (const [nome, c] of Object.entries(costruttori)) {
    const g = c.geo();
    const radice = new THREE.Group(), rotore = new THREE.Group();
    radice.name = `diagramma.girante.${nome}`;
    for (const [k, m] of [['satinata', mat.satinata], ['lucida', mat.lucida]]) {
      const mesh = new THREE.Mesh(g[k], m); mesh.name = `${nome}-${k}`;
      rotore.add(mesh);
    }
    radice.add(rotore);
    out[nome] = { nome, radice, rotore, asse: c.asse, pale: c.pale, rpm: IDRO[nome].rpm, raggio: c.raggio, semialtezza: c.semialtezza, centroY: c.centroY };
  }
  return out;
}
