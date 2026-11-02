// ERI · pannello fotovoltaico e tracker monoassiale "da catalogo": tutto procedurale (geometria e texture in codice).
// Materiali fisici (MeshPhysicalMaterial) pensati per vivere di scene.environment: nessuna luce è necessaria.
// API (contratto): creaModulo, creaTracker, creaFila, creaAgrivoltaico, materialiPannello, ombraContatto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------------------------
// Texture procedurali
// ---------------------------------------------------------------------------------------------

// Le celle: 6 colonne × 24 righe a mezzo taglio, blu-nero profondo, angoli smussati sui due spigoli esterni
// di ogni mezza cella, 5 busbar argento, dita quasi invisibili, interstizi chiari. 2048 × 4096.
function texturaCelle() {
  const w = 2048, h = 4096;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#dcdfd9'; g.fillRect(0, 0, w, h);
  // un velo appena percettibile sugli interstizi: non è carta bianca, è backsheet sotto EVA
  const velo = g.createLinearGradient(0, 0, w, h);
  velo.addColorStop(0, 'rgba(255,255,255,0.08)'); velo.addColorStop(1, 'rgba(180,186,190,0.10)');
  g.fillStyle = velo; g.fillRect(0, 0, w, h);

  const col = 6, righe = 24;
  const gap = 4, gapCentro = 14, margX = 30, margY = 34;
  const cw = (w - margX * 2 - gap * (col - 1)) / col;             // ≈ 329 px ≈ 182 mm
  const ch = (h - margY * 2 - gap * (righe - 2) - gapCentro) / righe; // ≈ 164 px ≈ 91 mm
  const sm = Math.round(cw * 0.065);                               // smusso ≈ 12 mm
  const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  for (let r = 0; r < righe; r++) {
    for (let c = 0; c < col; c++) {
      const x = margX + c * (cw + gap);
      const y = margY + r * (ch + gap) + (r >= righe / 2 ? gapCentro - gap : 0);
      // mezza cella: smussi sui due spigoli lontani dal taglio (righe pari: in alto; dispari: in basso)
      const su = r % 2 === 0;
      const k = r * col + c;
      const tono = 1 + (rnd(k) - 0.5) * 0.08;
      const gr = g.createLinearGradient(x, y, x + cw, y + ch * 2.2);
      const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
      const c0 = mixc([13, 27, 42], [16, 32, 50], rnd(k + 7)).map((v) => Math.min(255, Math.round(v * tono)));
      const c1 = [6, 16, 26].map((v) => Math.round(v * tono));
      gr.addColorStop(0, `rgb(${c0[0]},${c0[1]},${c0[2]})`);
      gr.addColorStop(1, `rgb(${c1[0]},${c1[1]},${c1[2]})`);
      g.fillStyle = gr;
      g.beginPath();
      if (su) {
        g.moveTo(x + sm, y); g.lineTo(x + cw - sm, y); g.lineTo(x + cw, y + sm);
        g.lineTo(x + cw, y + ch); g.lineTo(x, y + ch); g.lineTo(x, y + sm);
      } else {
        g.moveTo(x, y); g.lineTo(x + cw, y); g.lineTo(x + cw, y + ch - sm);
        g.lineTo(x + cw - sm, y + ch); g.lineTo(x + sm, y + ch); g.lineTo(x, y + ch - sm);
      }
      g.closePath(); g.fill();
      // antiriflesso: un velo blu freddo che parte da un angolo
      const sheen = g.createLinearGradient(x, y + ch, x + cw, y);
      sheen.addColorStop(0, 'rgba(40,70,110,0)'); sheen.addColorStop(1, 'rgba(60,95,140,0.16)');
      g.fillStyle = sheen; g.fill();
      // dita: quasi invisibili
      g.strokeStyle = 'rgba(190,200,215,0.07)'; g.lineWidth = 1;
      g.beginPath();
      for (let f = 4; f < ch - 2; f += 4) { g.moveTo(x + 3, y + f + 0.5); g.lineTo(x + cw - 3, y + f + 0.5); }
      g.stroke();
      // 5 busbar sottili argento, lungo la cella
      for (let b = 1; b <= 5; b++) {
        const bx = Math.round(x + (cw * b) / 6) + 0.5;
        g.strokeStyle = 'rgba(200,206,216,0.55)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(bx, y + 2); g.lineTo(bx, y + ch - 2); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(bx - 1.2, y + 2); g.lineTo(bx - 1.2, y + ch - 2); g.stroke();
      }
      // pad di saldatura ai capi dei busbar
      g.fillStyle = 'rgba(215,220,228,0.7)';
      for (let b = 1; b <= 5; b++) {
        const bx = Math.round(x + (cw * b) / 6);
        g.fillRect(bx - 3, su ? y + ch - 7 : y + 1, 6, 6);
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Zincatura a caldo: fiorettatura (spangle) come mappa di rugosità e leggera variazione di tinta.
function texturaZinco() {
  const s = 512;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * s, y = rnd() * s, r = 8 + rnd() * 26, n = 5 + Math.floor(rnd() * 4);
    const v = Math.round(120 + rnd() * 80);
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    g.beginPath();
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const rr = r * (0.7 + rnd() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
function texturaZincoTinta() {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#b9bfc4'; g.fillRect(0, 0, s, s);
  let seed = 3;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i++) {
    const x = rnd() * s, y = rnd() * s, r = 10 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const chiaro = rnd() > 0.5;
    gr.addColorStop(0, chiaro ? 'rgba(206,211,214,0.35)' : 'rgba(160,168,174,0.30)');
    gr.addColorStop(1, 'rgba(185,191,196,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Alluminio anodizzato: righe sottilissime di spazzolatura (mappa di rugosità) a sostegno dell'anisotropia.
function texturaSpazzolatura() {
  const w = 512, h = 64;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, w, h);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < h; y++) {
    const v = Math.round(110 + rnd() * 60);
    g.fillStyle = `rgba(${v},${v},${v},0.6)`;
    g.fillRect(0, y, w, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 40);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Ombra di contatto: disco sfumato (luminanza = alpha).
function texturaOmbra() {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  r.addColorStop(0.7, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Materiali condivisi (creati una volta, ritoccabili dallo stile)
// ---------------------------------------------------------------------------------------------
let _mat = null;
export function materialiPannello() {
  if (_mat) return _mat;
  const celle = texturaCelle();
  const zincoR = texturaZinco(), zincoT = texturaZincoTinta(), spazz = texturaSpazzolatura();
  _mat = {
    // il vetro: nero, solo riflessi (additivo sopra le celle): Fresnel vero ai bordi, riflesso morbido dei softbox
    vetro: new THREE.MeshPhysicalMaterial({
      color: 0x000000, metalness: 0, roughness: 0.12, specularIntensity: 0, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.5,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    // le celle sotto il vetro: opache, blu-nero profondo
    cella: new THREE.MeshPhysicalMaterial({ map: celle, color: 0xffffff, metalness: 0, roughness: 0.72, specularIntensity: 0.15, envMapIntensity: 0.9 }),
    // cornice: alluminio anodizzato nero, spazzolato (anisotropia r160)
    cornice: new THREE.MeshPhysicalMaterial({
      color: '#33363b', metalness: 0.92, roughness: 0.32, roughnessMap: spazz, envMapIntensity: 1.25,
      anisotropy: 0.55, anisotropyRotation: 0,
    }),
    retro: new THREE.MeshPhysicalMaterial({ color: '#efede7', metalness: 0, roughness: 0.86, envMapIntensity: 0.8 }),
    // acciaio verniciato/ghisa scura per motore e riduttore
    acciaio: new THREE.MeshPhysicalMaterial({ color: '#4b4f55', metalness: 0.8, roughness: 0.5, envMapIntensity: 1.0 }),
    // zincato a caldo: grigio chiaro con fiorettatura
    zincato: new THREE.MeshPhysicalMaterial({
      color: '#c6cbcf', map: zincoT, metalness: 0.85, roughness: 0.46, roughnessMap: zincoR, envMapIntensity: 1.15,
    }),
    inox: new THREE.MeshPhysicalMaterial({ color: '#d6d9dc', metalness: 1, roughness: 0.18, envMapIntensity: 1.2 }),
    bullone: new THREE.MeshPhysicalMaterial({ color: '#aeb3b8', metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 }),
    plastica: new THREE.MeshPhysicalMaterial({ color: '#17181b', metalness: 0, roughness: 0.55, envMapIntensity: 0.8 }),
    alluminioChiaro: new THREE.MeshPhysicalMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.4, envMapIntensity: 1.1 }),
  };
  return _mat;
}

// ---------------------------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------------------------
const _geoCache = new Map();

function rettangolo(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  return s;
}
function foro(w, h) {
  const p = new THREE.Path();
  p.moveTo(-w / 2, -h / 2); p.lineTo(-w / 2, h / 2); p.lineTo(w / 2, h / 2); p.lineTo(w / 2, -h / 2); p.closePath();
  return p;
}
function quadroArrotondato(l, r) {
  const s = new THREE.Shape(), h = l / 2;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

// Le parti di un modulo: cornice (profilo a L con bordo smussato), celle, vetro, retro, scatola di giunzione.
export function geometrieModulo({ larghezza = 1.134, altezza = 2.278, spessore = 0.035 } = {}) {
  const chiave = `${larghezza}|${altezza}|${spessore}`;
  if (_geoCache.has(chiave)) return _geoCache.get(chiave);
  const lip = 0.012, bt = 0.0015, bs = 0.0015;
  const wIn = larghezza - 2 * lip, hIn = altezza - 2 * lip;
  // cornice: anello con smusso (il corpo si allarga di bs: compensato)
  const sh = rettangolo(larghezza - 2 * bs, altezza - 2 * bs);
  sh.holes.push(foro(wIn + 2 * bs, hIn + 2 * bs));
  const corn = new THREE.ExtrudeGeometry(sh, { depth: spessore - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 2, curveSegments: 1 });
  corn.rotateX(-Math.PI / 2);
  corn.translate(0, -spessore / 2 + bt, 0);
  // flangia inferiore interna (profilo a L): 30 mm, alta 8 mm
  const fl = rettangolo(wIn + 0.002, hIn + 0.002);
  fl.holes.push(foro(wIn - 0.06, hIn - 0.06));
  const flangia = new THREE.ExtrudeGeometry(fl, { depth: 0.008, bevelEnabled: false, curveSegments: 1 });
  flangia.rotateX(-Math.PI / 2);
  flangia.translate(0, -spessore / 2, 0);
  const cornice = mergeGeometries([corn, flangia], false);
  cornice.computeBoundingSphere();

  const celle = new THREE.PlaneGeometry(wIn - 0.002, hIn - 0.002).rotateX(-Math.PI / 2).translate(0, spessore / 2 - 0.004, 0);
  const vetro = new THREE.PlaneGeometry(wIn + 0.016, hIn + 0.016).rotateX(-Math.PI / 2).translate(0, spessore / 2 - 0.0006, 0);
  const retro = new THREE.PlaneGeometry(wIn - 0.001, hIn - 0.001).rotateX(Math.PI / 2).translate(0, spessore / 2 - 0.0075, 0);
  // scatola di giunzione con tre pressacavi, posata sul retro verso un'estremità
  const yS = spessore / 2 - 0.0075 - 0.011;
  const sc = new THREE.BoxGeometry(0.12, 0.022, 0.09).translate(0, yS, -0.95);
  const pezzi = [sc];
  for (const dx of [-0.035, 0, 0.035]) {
    const c = new THREE.CylinderGeometry(0.0065, 0.0065, 0.05, 10).rotateX(Math.PI / 2).translate(dx, yS - 0.002, -0.95 + 0.065);
    pezzi.push(c);
  }
  const scatola = mergeGeometries(pezzi, false);
  const out = { cornice, celle, vetro, retro, scatola, larghezza, altezza, spessore };
  _geoCache.set(chiave, out);
  return out;
}

// UN modulo come Group (origine al centro, vetro verso +Y).
export function creaModulo(opz = {}) {
  const G = geometrieModulo(opz), M = materialiPannello();
  const g = new THREE.Group(); g.name = 'modulo';
  const cornice = new THREE.Mesh(G.cornice, M.cornice);
  const celle = new THREE.Mesh(G.celle, M.cella);
  const vetro = new THREE.Mesh(G.vetro, M.vetro); vetro.renderOrder = 2;
  const retro = new THREE.Mesh(G.retro, M.retro);
  const scatola = new THREE.Mesh(G.scatola, M.plastica);
  g.add(cornice, celle, vetro, retro, scatola);
  return g;
}

// Tanti moduli in una volta: cinque InstancedMesh con le stesse matrici.
function istanzeModuli(matrici, opz = {}) {
  const G = geometrieModulo(opz), M = materialiPannello();
  const g = new THREE.Group(); g.name = 'moduli';
  const fai = (geo, mat, nome, ordine = 0) => {
    const m = new THREE.InstancedMesh(geo, mat, matrici.length);
    matrici.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.instanceMatrix.needsUpdate = true;
    m.name = nome; m.renderOrder = ordine;
    m.frustumCulled = false;
    g.add(m);
    return m;
  };
  fai(G.cornice, M.cornice, 'cornici');
  fai(G.celle, M.cella, 'celle');
  fai(G.retro, M.retro, 'retri');
  fai(G.scatola, M.plastica, 'scatole');
  fai(G.vetro, M.vetro, 'vetri', 2);
  return g;
}

function istanze(geo, mat, matrici, nome) {
  const m = new THREE.InstancedMesh(geo, mat, matrici.length);
  matrici.forEach((mm, i) => m.setMatrixAt(i, mm));
  m.instanceMatrix.needsUpdate = true;
  m.name = nome; m.frustumCulled = false;
  return m;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function M4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

// Geometrie strutturali condivise
const GEO = {};
function geoStrutture() {
  if (GEO.pronte) return GEO;
  // palo a H (profilo W6): ali 0.152, anima 0.152, spessori 9/6 mm; estruso lungo Y per unità di altezza (scalato dopo)
  const b = 0.152, hh = 0.152, tf = 0.009, tw = 0.0065;
  const H = new THREE.Shape();
  H.moveTo(-b / 2, -hh / 2); H.lineTo(b / 2, -hh / 2); H.lineTo(b / 2, -hh / 2 + tf); H.lineTo(tw / 2, -hh / 2 + tf);
  H.lineTo(tw / 2, hh / 2 - tf); H.lineTo(b / 2, hh / 2 - tf); H.lineTo(b / 2, hh / 2); H.lineTo(-b / 2, hh / 2);
  H.lineTo(-b / 2, hh / 2 - tf); H.lineTo(-tw / 2, hh / 2 - tf); H.lineTo(-tw / 2, -hh / 2 + tf); H.lineTo(-b / 2, -hh / 2 + tf); H.closePath();
  GEO.paloH = new THREE.ExtrudeGeometry(H, { depth: 1, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2); // y da 0 a 1
  // tubo di torsione quadrato 150 mm con spigoli arrotondati, lungo X, lunghezza 1 (scalato)
  GEO.tubo = new THREE.ExtrudeGeometry(quadroArrotondato(0.15, 0.014), { depth: 1, bevelEnabled: false, curveSegments: 3 }).rotateY(Math.PI / 2); // x da 0 a 1
  // binario (C 80×50) lungo Z, lunghezza 1
  GEO.binario = new THREE.BoxGeometry(0.05, 0.08, 1);
  // morsetto centrale: blocchetto d'alluminio con bullone esagonale
  const blocco = new THREE.BoxGeometry(0.04, 0.012, 0.07).translate(0, 0.0475 + 0.006, 0);
  const gambo = new THREE.BoxGeometry(0.012, 0.0475, 0.07).translate(0, 0.0475 / 2, 0);
  GEO.morsetto = mergeGeometries([blocco, gambo], false);
  GEO.bulloneM8 = mergeGeometries([
    new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 6).translate(0, 0.0035, 0),
    new THREE.CylinderGeometry(0.0115, 0.0115, 0.0025, 18).translate(0, -0.00125, 0),
  ], false);
  GEO.bulloneM16 = mergeGeometries([
    new THREE.CylinderGeometry(0.013, 0.013, 0.011, 6).translate(0, 0.0055, 0),
    new THREE.CylinderGeometry(0.019, 0.019, 0.003, 18).translate(0, -0.0015, 0),
  ], false);
  // cuscinetto: anello esterno (tornito) attorno al tubo, lungo X
  GEO.anelloEsterno = new THREE.TorusGeometry(0.128, 0.024, 14, 40).rotateY(Math.PI / 2);
  GEO.flangiaInterno = new THREE.CylinderGeometry(0.113, 0.113, 0.19, 36).rotateZ(Math.PI / 2);
  // sella del cuscinetto: piastra sul palo e due montanti che salgono all'anello
  const piastra = new THREE.BoxGeometry(0.30, 0.016, 0.22).translate(0, 0.008, 0);
  const mont1 = new THREE.BoxGeometry(0.03, 0.17, 0.2).translate(-0.11, 0.1, 0);
  const mont2 = new THREE.BoxGeometry(0.03, 0.17, 0.2).translate(0.11, 0.1, 0);
  GEO.sella = mergeGeometries([piastra, mont1, mont2], false);
  // staffa binario-tubo: sella a U sotto il binario, con due orecchie
  GEO.staffa = mergeGeometries([
    new THREE.BoxGeometry(0.17, 0.012, 0.19).translate(0, 0.006, 0),
    new THREE.BoxGeometry(0.17, 0.09, 0.012).translate(0, -0.045, 0.089),
    new THREE.BoxGeometry(0.17, 0.09, 0.012).translate(0, -0.045, -0.089),
  ], false);
  // motore: corpo del riduttore a vite (attorno al tubo), motore cilindrico di taglio, scatola elettrica
  GEO.riduttore = mergeGeometries([
    new THREE.CylinderGeometry(0.2, 0.2, 0.28, 40).rotateZ(Math.PI / 2),
    new THREE.CylinderGeometry(0.225, 0.225, 0.03, 40).rotateZ(Math.PI / 2).translate(-0.125, 0, 0),
    new THREE.CylinderGeometry(0.225, 0.225, 0.03, 40).rotateZ(Math.PI / 2).translate(0.125, 0, 0),
    new THREE.BoxGeometry(0.22, 0.34, 0.30).translate(0, -0.12, 0),
  ], false);
  GEO.motore = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.07, 0.3, 28).rotateX(Math.PI / 2).translate(0, 0, -0.3),
    new THREE.CylinderGeometry(0.085, 0.085, 0.05, 28).rotateX(Math.PI / 2).translate(0, 0, -0.17),
    new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20).rotateX(Math.PI / 2).translate(0, 0, -0.47),
  ], false);
  GEO.scatolaElettrica = new THREE.BoxGeometry(0.22, 0.3, 0.12);
  // alette di raffreddamento del motore: anelli sottili
  GEO.alette = new THREE.TorusGeometry(0.074, 0.004, 6, 28);
  GEO.pronte = true;
  return GEO;
}

// ---------------------------------------------------------------------------------------------
// Ombra di contatto dipinta
// ---------------------------------------------------------------------------------------------
let _texOmbra = null;
const _geoOmbra = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function ombraContatto(larghezza = 1, profondita = 1, { opacita = 0.55, colore = 0x000000 } = {}) {
  _texOmbra = _texOmbra || texturaOmbra();
  const m = new THREE.Mesh(_geoOmbra, new THREE.MeshBasicMaterial({
    color: colore, alphaMap: _texOmbra, transparent: true, opacity: opacita, depthWrite: false, toneMapped: false,
  }));
  m.scale.set(larghezza, 1, profondita);
  m.position.y = 0.006;
  m.renderOrder = -4;
  m.name = 'ombra';
  return m;
}

// ---------------------------------------------------------------------------------------------
// Tracker monoassiale 2P
// ---------------------------------------------------------------------------------------------
export function creaTracker({ moduli = 28, due = true, passoPali = 8, hAsse = 1.65, larghezza = 1.134, altezza = 2.278, spessore = 0.035 } = {}) {
  const M = materialiPannello(), G = geoStrutture();
  const gruppo = new THREE.Group(); gruppo.name = 'tracker';
  const passoMod = larghezza + 0.02;
  const Lmod = moduli * passoMod;
  const x0 = -0.2;                      // primo modulo appena prima del primo palo
  const xFine = x0 + Lmod;
  const nPali = Math.max(2, Math.round(Lmod / passoPali) + 1);
  const passoReale = (Lmod - 0.4) / (nPali - 1);
  const xPali = []; for (let k = 0; k < nPali; k++) xPali.push(k * passoReale);
  const iMotore = Math.floor(nPali / 2);
  const tuboDa = x0 - 0.3, tuboA = xFine + 0.3, lunghezza = tuboA - tuboDa;
  const righe = due ? [1, -1] : [1];
  const zMod = due ? altezza / 2 + 0.015 : 0;
  const yBin = 0.075 + 0.04;            // binario posato sul tubo
  const yMod = 0.155 + 0.0125 + spessore / 2;
  const yTopMod = yMod + spessore / 2;

  // --- parti fisse: pali, selle, anelli esterni, bulloni ---
  const mPali = [], mSelle = [], mAnelli = [], mBulloni16 = [], ombre = [];
  const yPaloTop = hAsse - 0.128 - 0.024 - 0.17 - 0.016;
  xPali.forEach((x, k) => {
    mPali.push(M4(x, 0, 0, 0, 0, 0, 1, yPaloTop, 1));
    mSelle.push(M4(x, yPaloTop, 0));
    if (k !== iMotore) mAnelli.push(M4(x, hAsse, 0));
    for (const dx of [-0.11, 0.11]) for (const dz of [-0.07, 0.07]) mBulloni16.push(M4(x + dx, yPaloTop + 0.016, dz));
    const o = ombraContatto(1.3, 1.1, { opacita: 0.5 }); o.position.set(x, 0.006, 0); ombre.push(o);
  });
  gruppo.add(istanze(G.paloH, M.zincato, mPali, 'pali'));
  gruppo.add(istanze(G.sella, M.zincato, mSelle, 'selle'));
  gruppo.add(istanze(G.anelloEsterno, M.zincato, mAnelli, 'cuscinetti'));
  gruppo.add(istanze(G.bulloneM16, M.bullone, mBulloni16, 'bulloniPali'));
  ombre.forEach((o) => gruppo.add(o));
  // ombra lunga e tenue sotto tutta la tavola
  const oT = ombraContatto(lunghezza + 2, due ? 6.5 : 4, { opacita: 0.28 }); oT.position.set((tuboDa + tuboA) / 2, 0.004, 0); gruppo.add(oT);

  // riduttore (fisso, sul palo centrale) con motore e scatola
  const xM = xPali[iMotore];
  const riduttore = new THREE.Mesh(G.riduttore, M.acciaio); riduttore.position.set(xM, hAsse, 0);
  const motore = new THREE.Mesh(G.motore, M.acciaio); motore.position.set(xM, hAsse - 0.06, -0.13);
  const alette = []; for (let i = 0; i < 7; i++) alette.push(M4(xM, hAsse - 0.06, -0.13 - 0.2 - i * 0.03, Math.PI / 2, 0, 0));
  const scatola = new THREE.Mesh(G.scatolaElettrica, M.alluminioChiaro); scatola.position.set(xM + 0.16, hAsse - 0.52, -0.12);
  gruppo.add(riduttore, motore, scatola, istanze(G.alette, M.acciaio, alette, 'alette'));
  // cavo dal motore alla scatola: un tubo morbido
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(xM, hAsse - 0.12, -0.42), new THREE.Vector3(xM + 0.05, hAsse - 0.3, -0.5),
    new THREE.Vector3(xM + 0.16, hAsse - 0.42, -0.3), new THREE.Vector3(xM + 0.16, hAsse - 0.46, -0.19),
  ]);
  const cavo = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.009, 8, false), M.plastica);
  gruppo.add(cavo);

  // --- la tavola (ruota attorno all'asse X) ---
  const tavola = new THREE.Group(); tavola.name = 'tavola'; tavola.position.set(0, hAsse, 0);
  gruppo.add(tavola);
  const tubo = new THREE.Mesh(G.tubo, M.zincato); tubo.scale.x = lunghezza; tubo.position.x = tuboDa; tavola.add(tubo);
  // anelli interni (torniti) che girano con il tubo
  const mInt = []; xPali.forEach((x, k) => { if (k !== iMotore) mInt.push(M4(x, 0, 0)); });
  tavola.add(istanze(G.flangiaInterno, M.inox, mInt, 'anelliInterni'));
  // binari a ogni giunto fra moduli, staffe, morsetti, bulloni
  const Lbin = due ? altezza * 2 + 0.06 : altezza + 0.06;
  const mBin = [], mStaffe = [], mMors = [], mBull = [], mMod = [];
  for (let i = 0; i <= moduli; i++) {
    const x = x0 + i * passoMod;
    mBin.push(M4(x, yBin, 0, 0, 0, 0, 1, 1, Lbin));
    mStaffe.push(M4(x, 0.155, 0));
    for (const r of righe) for (const dz of [-0.56, 0.56]) {
      const z = r * zMod + dz;
      mMors.push(M4(x, 0.155, z));
      mBull.push(M4(x, 0.155 + 0.0595, z));
    }
  }
  for (let i = 0; i < moduli; i++) {
    const x = x0 + passoMod / 2 + i * passoMod;
    for (const r of righe) mMod.push(M4(x, yMod, r * zMod, 0, r > 0 ? Math.PI : 0, 0));
  }
  tavola.add(istanze(G.binario, M.zincato, mBin, 'binari'));
  tavola.add(istanze(G.staffa, M.zincato, mStaffe, 'staffe'));
  tavola.add(istanze(G.morsetto, M.alluminioChiaro, mMors, 'morsetti'));
  tavola.add(istanze(G.bulloneM8, M.bullone, mBull, 'bulloniMorsetti'));
  tavola.add(istanzeModuli(mMod, { larghezza, altezza, spessore }));

  let inclinazione = 0;
  const api = {
    gruppo, tavola, lunghezza, xPali, hAsse, x0, xFine, yTopMod, zMod,
    setInclinazione(rad) { inclinazione = rad; tavola.rotation.x = rad; },
    get inclinazione() { return inclinazione; },
  };
  return api;
}

// Più tracker paralleli lungo z (il primo a z = 0, gli altri verso -z).
export function creaFila({ tracker = 3, passo = 7, moduli = 28 } = {}) {
  const gruppo = new THREE.Group(); gruppo.name = 'fila';
  const lista = [];
  for (let i = 0; i < tracker; i++) {
    const t = creaTracker({ moduli });
    t.gruppo.position.z = -i * passo;
    gruppo.add(t.gruppo); lista.push(t);
  }
  return {
    gruppo, tracker: lista,
    setInclinazione(rad) { lista.forEach((t) => t.setInclinazione(rad)); },
  };
}

// ---------------------------------------------------------------------------------------------
// Agrivoltaico rialzato: pali e travi d'acciaio, moduli fissi a 4,5 m, inclinati di 12°
// ---------------------------------------------------------------------------------------------
export function creaAgrivoltaico({ campate = 4, altezza = 4.5, passo = 8.1, inclinazione = THREE.MathUtils.degToRad(12), larghezza = 1.134, altezzaModulo = 2.278, spessore = 0.035 } = {}) {
  const M = materialiPannello(), G = geoStrutture();
  const gruppo = new THREE.Group(); gruppo.name = 'agrivoltaico';
  const passoMod = larghezza + 0.02;
  const perCampata = Math.floor(passo / passoMod);
  const nMod = campate * perCampata;
  const Lmod = nMod * passoMod;
  const Ltot = campate * passo;
  const x0 = (Ltot - Lmod) / 2;
  const zMod = altezzaModulo / 2 + 0.015;
  const zPali = 1.9;
  const sinI = Math.sin(inclinazione), cosI = Math.cos(inclinazione);

  // il piano inclinato: travi, binari e moduli
  const piano = new THREE.Group(); piano.position.y = altezza; piano.rotation.x = inclinazione;
  gruppo.add(piano);
  const mTrav = [], mPali = [], mCappe = [], ombre = [], mBullPali = [];
  for (let k = 0; k <= campate; k++) {
    const x = k * passo;
    mTrav.push(M4(x, -0.1, 0, 0, 0, 0, 1, 1, 5.0));
    for (const s of [-1, 1]) {
      const z = s * zPali;
      // quota del sotto-trave in quel punto (rotazione attorno a X): y = altezza - z·sinI - 0.2
      const yTop = altezza - z * sinI - 0.2 / cosI;
      mPali.push(M4(x, 0, z * cosI, 0, 0, 0, 1, yTop, 1));
      mCappe.push(M4(x, yTop, z * cosI));
      for (const dx of [-0.1, 0.1]) for (const dz of [-0.08, 0.08]) mBullPali.push(M4(x + dx, yTop + 0.016, z * cosI + dz));
      const o = ombraContatto(1.4, 1.2, { opacita: 0.45 }); o.position.set(x, 0.006, z * cosI); ombre.push(o);
    }
  }
  const trave = new THREE.BoxGeometry(0.14, 0.2, 1);
  piano.add(istanze(trave, M.zincato, mTrav, 'traviTrasversali'));
  gruppo.add(istanze(G.paloH, M.zincato, mPali, 'paliAgri'));
  const cappa = new THREE.BoxGeometry(0.3, 0.016, 0.26).translate(0, 0.008, 0);
  gruppo.add(istanze(cappa, M.zincato, mCappe, 'cappe'));
  gruppo.add(istanze(G.bulloneM16, M.bullone, mBullPali, 'bulloniAgri'));
  ombre.forEach((o) => gruppo.add(o));
  const oT = ombraContatto(Ltot + 2, 6.5, { opacita: 0.16 }); oT.position.set(Ltot / 2, 0.004, 0); gruppo.add(oT);
  // travi longitudinali (2) sotto i binari
  const Llong = Ltot + 0.6;
  const mLong = [M4(Ltot / 2, 0.0, -1.2, 0, 0, 0, Llong, 1, 1), M4(Ltot / 2, 0.0, 1.2, 0, 0, 0, Llong, 1, 1)];
  piano.add(istanze(new THREE.BoxGeometry(1, 0.16, 0.1), M.zincato, mLong, 'traviLong'));
  // binari a ogni giunto, morsetti, bulloni, moduli
  const yBin = 0.08 + 0.04, yMod = 0.12 + 0.04 + 0.0125 + spessore / 2, yTop = yMod + spessore / 2;
  const Lbin = altezzaModulo * 2 + 0.06;
  const mBin = [], mMors = [], mBull = [], mMod = [];
  for (let i = 0; i <= nMod; i++) {
    const x = x0 + i * passoMod;
    mBin.push(M4(x, yBin, 0, 0, 0, 0, 1, 1, Lbin));
    for (const r of [-1, 1]) for (const dz of [-0.56, 0.56]) { mMors.push(M4(x, 0.16, r * zMod + dz)); mBull.push(M4(x, 0.16 + 0.0595, r * zMod + dz)); }
  }
  for (let i = 0; i < nMod; i++) {
    const x = x0 + passoMod / 2 + i * passoMod;
    for (const r of [-1, 1]) mMod.push(M4(x, yMod, r * zMod, 0, r > 0 ? Math.PI : 0, 0));
  }
  piano.add(istanze(G.binario, M.zincato, mBin, 'binariAgri'));
  piano.add(istanze(G.morsetto, M.alluminioChiaro, mMors, 'morsettiAgri'));
  piano.add(istanze(G.bulloneM8, M.bullone, mBull, 'bulloniAgri'));
  piano.add(istanzeModuli(mMod, { larghezza, altezza: altezzaModulo, spessore }));

  return { gruppo, piano, lunghezza: Ltot, altezza };
}
