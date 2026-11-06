// Ingombri sullo schermo: dove cadono le macchine e dove stanno i testi, per tenerli sempre separati.
//  - impronta(): la macchina montata ridotta a tante scatolette nel mondo (8 spigoli ciascuna);
//  - rettangoliSchermo() + tocca(): le scatolette proiettate sullo schermo e il confronto con le zone dei testi
//    (calcolo leggero, lo usa la regia per scegliere quanto arretrare la camera);
//  - misuraZone(): le zone dei testi di ogni momento, lette dalla pagina a ogni ridimensionamento;
//  - mascheraMacchine() + testiDeiMomenti() + pixelSotto(): il controllo vero, solo per le prove
//    (la GPU disegna le macchine in bianco e si contano i pixel che finiscono sotto le righe di testo).
import * as THREE from 'three';

// ---------- impronta delle macchine (nel mondo) ----------
const _mi = new THREE.Matrix4(), _mw = new THREE.Matrix4();
const _c0 = new THREE.Vector3(), _q = new THREE.Vector3();
const _assi = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

// I pezzi lunghi (tubi, file di moduli, condotte) sono spezzati in tratti di al più `passo` metri, così il loro
// contorno sullo schermo resta stretto anche quando attraversano l'inquadratura in diagonale. Le minuterie più
// piccole di `minimo` metri stanno dentro i pezzi più grandi e non servono; i decori trasparenti a terra (ombre
// dipinte, segni delle colture) non sono macchina.
const decoro = (o) => o.material && !Array.isArray(o.material) && o.material.depthWrite === false;
export function impronta(radice, { passo = 1.5, minimo = 0.2 } = {}) {
  radice.updateWorldMatrix(true, true);
  const punti = [];
  radice.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry || decoro(o)) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (g.boundingBox.isEmpty()) return;
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _mi); _mw.multiplyMatrices(o.matrixWorld, _mi); scatola(punti, g.boundingBox, _mw, passo, minimo); }
    } else scatola(punti, g.boundingBox, o.matrixWorld, passo, minimo);
  });
  return new Float32Array(punti);
}

function scatola(punti, bb, mw, passo, minimo) {
  _c0.copy(bb.min).applyMatrix4(mw);
  _assi[0].set(bb.max.x, bb.min.y, bb.min.z).applyMatrix4(mw).sub(_c0);
  _assi[1].set(bb.min.x, bb.max.y, bb.min.z).applyMatrix4(mw).sub(_c0);
  _assi[2].set(bb.min.x, bb.min.y, bb.max.z).applyMatrix4(mw).sub(_c0);
  const l = _assi.map((v) => v.length());
  if (Math.max(...l) < minimo) return;
  const iLungo = l[0] >= l[1] && l[0] >= l[2] ? 0 : l[1] >= l[2] ? 1 : 2;
  const lungo = _assi[iLungo], a = _assi[(iLungo + 1) % 3], b = _assi[(iLungo + 2) % 3];
  const n = Math.max(1, Math.ceil(l[iLungo] / passo));
  for (let s = 0; s < n; s++) {
    for (let k = 0; k < 8; k++) {
      _q.copy(_c0).addScaledVector(lungo, (s + (k & 1)) / n);
      if (k & 2) _q.add(a);
      if (k & 4) _q.add(b);
      punti.push(_q.x, _q.y, _q.z);
    }
  }
}

// ---------- proiezione sullo schermo (px CSS) ----------
const _pv = new THREE.Matrix4();

// Scrive in `buf` un rettangolo [x0, y0, x1, y1] per ogni scatoletta davanti alla camera; restituisce quanti.
// Una scatoletta in parte dietro la camera vale quanto tutto lo schermo (caso che le pose non prevedono).
export function rettangoliSchermo(punti, camera, larghezza, altezza, buf) {
  _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = _pv.elements;
  let n = 0;
  for (let s = 0; s < punti.length; s += 24) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, dietro = 0;
    for (let k = s; k < s + 24; k += 3) {
      const px = punti[k], py = punti[k + 1], pz = punti[k + 2];
      const w = e[3] * px + e[7] * py + e[11] * pz + e[15];
      if (w < 0.1) { dietro++; continue; }
      const x = ((e[0] * px + e[4] * py + e[8] * pz + e[12]) / w * 0.5 + 0.5) * larghezza;
      const y = (0.5 - (e[1] * px + e[5] * py + e[9] * pz + e[13]) / w * 0.5) * altezza;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (dietro === 8) continue;
    if (dietro) { x0 = 0; y0 = 0; x1 = larghezza; y1 = altezza; }
    buf[n * 4] = x0; buf[n * 4 + 1] = y0; buf[n * 4 + 2] = x1; buf[n * 4 + 3] = y1;
    n++;
  }
  return n;
}

export function tocca(buf, n, zone) {
  for (let i = 0; i < n; i++) {
    const x0 = buf[i * 4], y0 = buf[i * 4 + 1], x1 = buf[i * 4 + 2], y1 = buf[i * 4 + 3];
    for (const z of zone) if (x0 < z.x1 && x1 > z.x0 && y0 < z.y1 && y1 > z.y0) return true;
  }
  return false;
}

// ---------- zone dei testi (px CSS), come saranno a testo fermo ----------
// Per ogni momento: logo in testata, menu, righe del titolo, cartellino, iter (alla sua altezza massima), nome della fase,
// modulo dei contatti. Tutto è letto dalla pagina, quindi vale per ogni schermo e per l'impaginazione del telefono.
export function misuraZone({ logo, margine }) {
  const gonfia = (r) => ({ nome: r.nome, x0: r.x0 - margine, y0: r.y0 - margine, x1: r.x1 + margine, y1: r.y1 + margine });
  const comuni = [];
  if (logo) comuni.push({ nome: 'logo', ...logo });
  const nav = document.querySelector('.nav');
  if (nav) { const r = nav.getBoundingClientRect(); comuni.push({ nome: 'menu', x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }); }

  // il nome della fase compare al centro, sotto la macchina: lo misuro con la scritta più lunga
  let fase = null;
  const elFase = document.querySelector('.fase');
  if (elFase && getComputedStyle(elFase).display !== 'none') {
    const copia = elFase.cloneNode();
    copia.classList.remove('mostra'); copia.textContent = '02 · Autorizzazioni';
    elFase.after(copia);
    const r = copia.getBoundingClientRect();
    copia.remove();
    fase = { nome: 'fase', x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
  }

  const zone = [];
  for (let i = 0; i < 5; i++) {
    const z = [...comuni];
    const titolo = document.querySelector(`.titolo-grande[data-m="${i}"]`);
    if (titolo) z.push(...righeTitolo(titolo));
    const sezione = document.querySelector(`.momento[data-m="${i}"]`);
    if (sezione) z.push(...testiMomento(sezione));
    if (fase && i >= 1 && i <= 3) z.push(fase);
    zone.push(z.filter((r) => r.x1 > r.x0 && r.y1 > r.y0).map(gonfia));
  }
  return zone;
}

// Le lettere del titolo entrano con una traslazione: le loro posizioni di impaginazione (offset*) non ne tengono conto,
// quindi danno il titolo fermo. Una riga per volta, con lo spazio di ascendenti e discendenti.
function righeTitolo(h) {
  const origine = h.getBoundingClientRect();
  const corpo = parseFloat(getComputedStyle(h).fontSize);
  const righe = new Map();
  for (const l of h.querySelectorAll('.l')) {
    if (!l.textContent.trim()) continue;
    const y = Math.round(l.offsetTop);
    const r = righe.get(y) || { x0: Infinity, x1: -Infinity, y0: y, y1: y + l.offsetHeight };
    r.x0 = Math.min(r.x0, l.offsetLeft); r.x1 = Math.max(r.x1, l.offsetLeft + l.offsetWidth);
    righe.set(y, r);
  }
  return [...righe.values()].map((r) => ({
    nome: 'titolo', x0: origine.left + r.x0, x1: origine.left + r.x1,
    y0: origine.top + r.y0 - 0.1 * corpo, y1: origine.top + r.y1 + 0.22 * corpo,
  }));
}

function testiMomento(sezione) {
  const out = [];
  const o = sezione.getBoundingClientRect();
  const box = (el) => ({ x0: o.left + el.offsetLeft, y0: o.top + el.offsetTop, x1: o.left + el.offsetLeft + el.offsetWidth, y1: o.top + el.offsetTop + el.offsetHeight });

  const cart = sezione.querySelector('.cartellino');
  if (cart && cart.offsetParent) {
    // in verticale la scatola (ferma, senza la traslazione d'ingresso), in orizzontale solo fin dove arriva il testo
    const [x0, x1] = estensioneTesto(cart);
    out.push({ nome: 'cartellino', ...box(cart), x0, x1 });
  }
  const iter = sezione.querySelector('.iter');
  if (iter && iter.offsetParent) {
    // la colonna è più alta quando è acceso l'ultimo passo, che ha la spiegazione più lunga: la misuro su una copia nascosta
    const copia = iter.cloneNode(true);
    copia.style.visibility = 'hidden'; copia.setAttribute('aria-hidden', 'true');
    const voci = copia.querySelectorAll('li');
    voci.forEach((li, i) => li.classList.toggle('corrente', i === voci.length - 1));
    iter.after(copia);
    out.push({ nome: 'iter', ...box(copia) });
    copia.remove();
  }
  const barra = sezione.querySelector('.barra');
  if (barra && barra.offsetParent) {
    const t = barra.querySelector('.barra-testo');
    const r = box(barra);
    out.push({ nome: 'iter', ...r, y1: r.y0 + (t ? t.offsetTop + Math.max(t.offsetHeight, 14) : barra.offsetHeight) });
  }
  const scheda = sezione.querySelector('.scheda');
  if (scheda && scheda.offsetParent) {
    const r = scheda.getBoundingClientRect();
    out.push({ nome: 'modulo', x0: r.left, y0: r.top + sezione.scrollTop, x1: r.right, y1: r.bottom + sezione.scrollTop });
  }
  return out;
}

function estensioneTesto(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  let x0 = Infinity, x1 = -Infinity;
  for (const q of r.getClientRects()) { if (q.width < 1) continue; x0 = Math.min(x0, q.left); x1 = Math.max(x1, q.right); }
  return [x0, x1];
}

// ---------- controllo vero (solo per le prove) ----------
// La GPU disegna solo le macchine, in bianco, in una tela piccola; poi si contano i pixel sotto ogni riga di testo.
export function mascheraMacchine(renderer, scena, camera, radici, scala = 0.5) {
  const W = Math.max(1, Math.round(innerWidth * scala)), H = Math.max(1, Math.round(innerHeight * scala));
  const bersaglio = new THREE.WebGLRenderTarget(W, H);
  const spenti = [];
  for (const o of scena.children) if (!radici.includes(o) && o.visible) { spenti.push(o); o.visible = false; }
  for (const r of radici) r.traverse((o) => { if (o.isMesh && o.visible && decoro(o)) { spenti.push(o); o.visible = false; } });
  const bianco = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const override = scena.overrideMaterial, sfondo = scena.background;
  const coloreFondo = renderer.getClearColor(new THREE.Color()), alfaFondo = renderer.getClearAlpha();
  scena.overrideMaterial = bianco; scena.background = null;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(bersaglio);
  renderer.clear();
  renderer.render(scena, camera);
  renderer.setRenderTarget(null);
  const dati = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(bersaglio, 0, 0, W, H, dati);
  scena.overrideMaterial = override; scena.background = sfondo;
  renderer.setClearColor(coloreFondo, alfaFondo);
  for (const o of spenti) o.visible = true;
  bianco.dispose(); bersaglio.dispose();
  return { W, H, scala, dati };
}

export function pixelSotto(maschera, r, margine = 4) {
  const { W, H, scala, dati } = maschera;
  const x0 = Math.max(0, Math.floor((r.x0 - margine) * scala)), x1 = Math.min(W, Math.ceil((r.x1 + margine) * scala));
  const y0 = Math.max(0, Math.floor((r.y0 - margine) * scala)), y1 = Math.min(H, Math.ceil((r.y1 + margine) * scala));
  let n = 0;
  for (let y = y0; y < y1; y++) {
    const riga = (H - 1 - y) * W;
    for (let x = x0; x < x1; x++) if (dati[(riga + x) * 4 + 3] > 8) n++;
  }
  return n;
}

// Le righe di testo dei momenti indicati come stanno adesso sulla pagina (accese o no), più logo, menu, etichette
// delle turbine accese e nome della fase. Le scatole delle righe coprono anche ascendenti e discendenti.
export function testiDeiMomenti(indici) {
  const out = [];
  const righe = (el, nome) => {
    if (!el || !el.getClientRects().length) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) out.push({ nome, x0: q.left, y0: q.top, x1: q.right, y1: q.bottom });
  };
  const scatolaDi = (el, nome) => {
    if (!el) return;
    const q = el.getBoundingClientRect();
    if (q.width > 1 && q.height > 1) out.push({ nome, x0: q.left, y0: q.top, x1: q.right, y1: q.bottom });
  };
  const logo = document.getElementById('logo');
  if (logo && logo.classList.contains('in-testata')) scatolaDi(logo, 'logo');
  righe(document.querySelector('.nav'), 'menu');
  for (const i of indici) {
    righe(document.querySelector(`.titolo-grande[data-m="${i}"]`), 'titolo');
    const s = document.querySelector(`.momento[data-m="${i}"]`);
    if (!s) continue;
    righe(s.querySelector('.cartellino'), 'cartellino');
    righe(s.querySelector('.iter'), 'iter');
    righe(s.querySelector('.barra'), 'iter');
    const scheda = s.querySelector('.scheda');
    if (scheda) { righe(scheda, 'modulo'); scheda.querySelectorAll('input, textarea, .bottone').forEach((e) => scatolaDi(e, 'modulo')); }
    s.querySelectorAll('.etichetta.visibile').forEach((e) => righe(e, 'etichetta'));
  }
  const fase = document.querySelector('.fase');
  if (indici.some((i) => i >= 1 && i <= 3) && fase && fase.textContent && getComputedStyle(fase).display !== 'none') righe(fase, 'fase');
  return out;
}
