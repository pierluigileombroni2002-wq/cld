// ERI v3 · avvio e ciclo: renderer leggero (niente ombre), qualità a 3 livelli, showroom al crepuscolo,
// macchine dai moduli di macchine/ (o segnaposto con lo stesso contratto), racconto a 5 momenti guidato dallo scorrimento.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { creaAmbiente, creaPiedistallo, creaFaro } from './scena.js';
import { creaLinea, arco } from './linea.js';
import { MOMENTI, TAPPE, clamp, liscio, monotona, creaPercorso, faseIter, inseguiIter, creaScorrimento } from './regia.js';
import { creaLogo } from './logo.js';
import { creaIter } from './iter.js';
import { creaInterfaccia } from './interfaccia.js';
import { creaQualita } from './qualita.js';
import * as riserva from './segnaposto.js';

// protezione HDR: i riflessi speculari estremi superano il half-float e il bloom li allargherebbe a blocchi
THREE.ShaderChunk.opaque_fragment = THREE.ShaderChunk.opaque_fragment.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
  'gl_FragColor = vec4( clamp( outgoingLight, 0.0, 24.0 ), diffuseColor.a );');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const errori = [], moduli = { scena: 'avvio' };
const eri = window.__eri = { pronto: false, errori, moduli: () => ({ ...moduli }), vai: () => false, info: () => ({}) };
addEventListener('error', e => errori.push(String(e.message || e)));
addEventListener('unhandledrejection', e => errori.push(String((e.reason && e.reason.message) || e.reason)));

const QS = new URLSearchParams(location.search);
const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const eMobile = () => matchMedia('(pointer: coarse)').matches || innerWidth < 760;
let mobile = eMobile();
const Q = creaQualita({ forzata: QS.get('q'), mobile });
const corpo = document.body;
corpo.dataset.qualita = Q.livello;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------- interfaccia (subito, anche senza 3D) ----------
const scorr = creaScorrimento();
const iter = creaIter(document.querySelector('.iter'));
const ui = creaInterfaccia({ alNavigare: naviga });
const logoAtteso = creaLogo(document.getElementById('logo-grande'), document.getElementById('logo-piccolo'));
let saltoIter = false, logo = null;

function naviga(chiave) {
  const p = TAPPE[chiave] ?? 0;
  if (Math.abs(p - scorr.p) > 0.2) {
    // salto lungo: dissolvenza nel buio invece di un volo veloce (niente nausea)
    ui.velo(true);
    setTimeout(() => { scorr.vai(p); saltoIter = true; setTimeout(() => ui.velo(false), 60); }, 480);
  } else scorr.scorri(p);
}

// ---------- renderer ----------
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scena'), antialias: false, powerPreference: 'high-performance', stencil: false });
} catch (e) { errori.push('WebGL: ' + e.message); }

let mondo = null;
if (renderer) {
  try { mondo = await costruisci(); moduli.scena = 'ok'; } catch (e) { errori.push('scena: ' + e.message); moduli.scena = 'errore: ' + e.message; console.error(e); }
}
logo = await logoAtteso;
if (!mondo) { corpo.classList.add('senza-3d'); }
avvia();

// ============================================================================
async function costruisci() {
  let w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Q.dpr()); renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = false;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.05, 3000);

  // ---- moduli delle macchine (scritti in parallelo in macchine/): se mancano, segnaposto ----
  const carica = async (nome, url) => {
    try { const m = await import(url); moduli[nome] = 'ok'; return m; }
    catch (e) { moduli[nome] = 'segnaposto (' + String((e && e.message) || e).slice(0, 160) + ')'; return null; }
  };
  const [mMat, mFV, mBESS, mTurb] = await Promise.all([
    carica('materiali', './macchine/materiali.js'), carica('fv', './macchine/fv.js'),
    carica('bess', './macchine/bess.js'), carica('turbine', './macchine/turbine.js'),
  ]);
  let materiali = null;
  if (mMat && typeof mMat.creaMateriali === 'function') {
    try { materiali = mMat.creaMateriali(THREE, Q.livello); } catch (e) { moduli.materiali = 'segnaposto (' + e.message + ')'; }
  }
  if (!materiali) materiali = riserva.materialiBase(THREE);

  const amb = creaAmbiente({ renderer, scene, qualita: Q.livello, materiali });
  const ctx = { THREE, scene, renderer, camera, materiali, qualita: Q.livello };
  function creaMacchina(nome, mod, fn) {
    if (mod && typeof mod[fn] === 'function') {
      try {
        const m = mod[fn](ctx);
        // in qualità bassa la macchina tiene spento il dettaglio da vicino
        if (m && typeof m.qualita === 'function') m.qualita(Q.livello);
        if (m && m.gruppo && typeof m.aggiorna === 'function') return m;
        throw new Error('contratto: mancano gruppo o aggiorna');
      } catch (e) { moduli[nome] = 'segnaposto (' + e.message + ')'; errori.push(nome + ': ' + e.message); console.error(e); }
    }
    return riserva[fn](ctx);
  }
  const statoProva = { t: 0, montaggio: 1, funzione: 0, vicino: 0 };
  const scatola = (obj) => { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty() || !isFinite(b.min.x)) b.set(V(-3, 0, -2.5), V(3, 2.5, 2.5)); return b; };
  const raggio = (b, cx = 0, cz = 0) => {
    const ax = Math.max(Math.abs(b.min.x - cx), Math.abs(b.max.x - cx)), az = Math.max(Math.abs(b.min.z - cz), Math.abs(b.max.z - cz));
    return Math.min(Math.hypot(ax, az), Math.max(ax, az) * 1.06);
  };
  const seg = Q.livello === 'alta' ? 160 : 96;

  // ---- mondo: le isole vanno verso l'orizzonte, a zig-zag; la camera le incontra una dopo l'altra ----
  const W = { S: V(0, 0, 8), fv: V(5, 0, 0), bess: V(-5, 0, -19), idro: V(2, 0, -38), faro: V(9, 0, -64) };

  function isola(nome, mod, fn, c, indice, passo, giaPronta = null) {
    const m = giaPronta || creaMacchina(nome, mod, fn);
    try { m.aggiorna(statoProva); } catch (e) {}
    const b = scatola(m.gruppo);
    const R = Math.max(4.35, raggio(b) + 0.25);
    const ped = creaPiedistallo(amb, { R, H: 0.45, segmenti: seg, indice });
    ped.gruppo.position.copy(c); scene.add(ped.gruppo);
    ped.impostaIngombro((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, passo);
    m.gruppo.position.set(c.x, ped.cima, c.z); scene.add(m.gruppo);
    const altezza = Math.max(1, b.max.y);
    return { nome, fn, m, b, R, ped, c, altezza, centro: V(c.x, ped.cima + altezza * 0.45, c.z), it: 0, fase: faseIter(0, {}), stato: { t: 0, montaggio: 0, funzione: 0, vicino: 0 }, acc: 0, visibile: true };
  }
  const fv = isola('fv', mFV, 'creaFV', W.fv, 0, 0.5);
  const bess = isola('bess', mBESS, 'creaBESS', W.bess, 1, 0.62);

  // ---- idroelettrico: un'isola come le altre; sopra, le tre turbine sui loro piedistalli (dal modulo) ----
  let tm = creaMacchina('turbine', mTurb, 'creaTurbine');
  if (!(tm.pelton && tm.francis && tm.kaplan)) { moduli.turbine = 'segnaposto (mancano pelton/francis/kaplan)'; tm = riserva.creaTurbine(ctx); }
  const idro = isola('idro', null, 'creaTurbine', W.idro, 2, 0.5, tm);
  tm.gruppo.updateMatrixWorld(true);
  const piede = (mTurb && mTurb.PIEDISTALLO && mTurb.PIEDISTALLO.raggio) || 1.0;   // raggio dei piedistalli piccoli
  const turbine = [tm.pelton, tm.francis, tm.kaplan].map(g => {
    const b = new THREE.Box3().setFromObject(g);       // coordinate dell'isola (il gruppo è sul piano del piedistallo)
    const lx = g.position.x, lz = g.position.z, y0 = Math.max(0, g.position.y);
    const r = Math.max(0.6, Math.min(Math.max(b.max.x - W.idro.x - lx, W.idro.x + lx - b.min.x), Math.max(b.max.z - W.idro.z - lz, W.idro.z + lz - b.min.z)));
    const P = V(W.idro.x + lx, 0, W.idro.z + lz), base = idro.ped.cima + y0;
    const altezza = Math.max(0.8, b.max.y - base);
    return { g, P, r, base, altezza, piede, centro: V(P.x, base + altezza * 0.45, P.z) };
  });
  idro.ped.impostaIngombro((idro.b.min.x + idro.b.max.x) / 2, (idro.b.min.z + idro.b.max.z) / 2, (idro.b.max.x - idro.b.min.x) / 2, (idro.b.max.z - idro.b.min.z) / 2, 0.5,
    turbine.map(x => [x.P.x - W.idro.x, x.P.z - W.idro.z, Math.min(x.r, 1.3) + 0.15]));

  // ---- faro dei contatti ----
  const faro = creaFaro(W.faro, 3.2); scene.add(faro.gruppo);

  // ---- linea d'energia: logo → FV → BESS → turbine → faro ----
  const deg = Math.PI / 180;
  const pts = [W.S.clone(), V(0.4, 0, 5.5)];
  const rf = fv.R + 0.75;
  const fvIn = pts.length; pts.push(...arco(fv.c, rf, 148 * deg, 212 * deg, 5)); const fvOut = pts.length - 1;
  pts.push(V(-1.2, 0, -9.5));
  const rb = bess.R + 0.75;
  const bIn = pts.length; pts.push(...arco(bess.c, rb, 34 * deg, -34 * deg, 5)); const bOut = pts.length - 1;
  // davanti alle tre turbine, da Pelton a Kaplan (insieme alla carrellata della camera), poi verso il faro
  const ri = idro.R + 0.75;
  pts.push(V(idro.c.x - ri - 1.6, 0, idro.c.z + ri - 0.2));
  const iIn = pts.length; pts.push(...arco(idro.c, ri, 112 * deg, -40 * deg, 9)); const iOut = pts.length - 1;
  // punto dell'arco davanti a ogni turbina (per accompagnare la carrellata)
  const davanti = turbine.map(x => ri * (112 * deg - Math.acos(clamp((x.P.x - idro.c.x) / ri, -1, 1))));
  pts.push(V(W.faro.x + 0.9, 0, (idro.c.z + W.faro.z) / 2), V(W.faro.x + 0.1, 0, W.faro.z + 4), V(W.faro.x, 0, W.faro.z));
  const linea = creaLinea(pts); scene.add(linea.mesh, linea.scintilla);
  const Lp = i => linea.lunghezzaPunto(i);
  const LK = [[0.03, 0], [0.15, Lp(fvIn) + 1.0], [0.3, Lp(fvIn) + 1.0], [0.385, Lp(fvOut)],
    [0.455, Lp(bIn) + 1.0], [0.56, Lp(bIn) + 1.0], [0.625, Lp(bOut)],
    [0.69, Lp(iIn) + 1.0], [0.728, Lp(iIn) + 1.0],
    [0.768, Lp(iIn) + Math.max(1.4, davanti[0])], [0.812, Lp(iIn) + Math.max(1.8, davanti[1])], [0.856, Lp(iIn) + Math.max(2.2, davanti[2])],
    [0.88, Lp(iOut)], [0.928, linea.tot]];
  const lunghezzaLinea = monotona(LK.map(k => k[0]), LK.map(k => k[1]));
  const ingressi = { fv: Lp(fvIn), bess: Lp(bIn), idro: Lp(iIn) };

  // ---- inquadrature: schermo largo = testo a sinistra (soggetto a destra); telefono = testo sopra (soggetto in basso) ----
  const OX = monotona([0, 0.07, 0.15, 0.385, 0.455, 0.625, 0.69, 0.728, 0.768, 0.866, 0.915, 1], [0, 0, 0.19, 0.19, 0.19, 0.19, 0.06, 0.06, 0.15, 0.15, -0.17, -0.17]);
  const OY = monotona([0, 0.07, 0.15, 0.625, 0.69, 0.728, 0.768, 0.866, 0.915, 1], [0, 0, -0.08, -0.08, -0.05, -0.05, -0.08, -0.08, 0.27, 0.27]);
  const vfov = asp => asp >= 1.2 ? 30 : Math.min(72, 2 * Math.atan(Math.tan(15 * deg) * 1.2 / asp) / deg);
  function percorsoCamera(asp) {
    const tanH = Math.tan(vfov(asp) / 2 * deg) * asp;
    const K = [];
    const fissa = (p, pos, tgt) => K.push({ p, pos, tgt });
    const mira = (p, tgt, dir, rho, tetto = 1.3) => {
      const d0 = dir.length(), u = tanH * (0.5 - (mobile ? 0 : Math.abs(OX(p)))) / 0.5;
      const d = Math.min(Math.max(d0, rho / u), d0 * (mobile ? Math.max(tetto, 1.75) : tetto));   // telefono: può allontanarsi di più per far stare la macchina intera
      K.push({ p, tgt, pos: tgt.clone().addScaledVector(dir.clone().normalize(), d) });
    };
    // centro dell'inquadratura larga e punto del dettaglio (motoriduttore del FV, fronte del BESS)
    const mezzo = is => V(is.c.x + (is.b.min.x + is.b.max.x) / 2, is.ped.cima + is.altezza * 0.38, is.c.z + (is.b.min.z + is.b.max.z) / 2);
    const vicino = (is, dy, dz) => V(is.c.x + (is.b.min.x + is.b.max.x) / 2, is.ped.cima + dy, is.c.z + is.b.max.z - dz);
    // 1 apertura: ferma, guarda il sole sull'orizzonte
    fissa(0, V(0, 2.2, 34), V(0, 12, -40));
    fissa(0.065, V(0.15, 2.3, 32.6), V(0.4, 11.4, -40));
    // 2 fotovoltaico: arriva da sinistra con tutto l'impianto in vista, poi si avvicina piano fino al motoriduttore
    mira(0.15, mezzo(fv), V(-0.5, 0.25, 0.83).multiplyScalar(17), fv.R * 1.3);
    mira(0.27, mezzo(fv).add(V(0.1, -0.1, 0.4)), V(-0.55, 0.21, 0.8).multiplyScalar(12.5), fv.R * 1.0);
    mira(0.385, vicino(fv, 1.0, 0.6), V(-3.0, 1.15, 4.7), 2.6);
    fissa(0.425, V(fv.c.x - fv.R - 1.8, 3.8, fv.c.z + 0.6), bess.c.clone().add(V(2.5, 1.4, 5)));
    // 3 accumulo: dalla destra, avvicinamento continuo fino al fronte delle batterie
    mira(0.455, mezzo(bess), V(0.5, 0.25, 0.83).multiplyScalar(17), bess.R * 1.3);
    mira(0.545, mezzo(bess).add(V(-0.1, -0.1, 0.4)), V(0.55, 0.21, 0.8).multiplyScalar(12.5), bess.R * 1.0);
    mira(0.625, vicino(bess, 0.95, 0.9), V(3.3, 1.0, 3.9), 2.4);
    fissa(0.655, V(bess.c.x + bess.R + 2.8, 4.4, bess.c.z - 0.4), idro.c.clone().add(V(0, 1.4, 5)));
    // 4 idroelettrico: le tre turbine insieme mentre nascono, poi una carrellata lenta da Pelton a Kaplan
    mira(0.69, mezzo(idro), V(0, 0.25, 0.97).multiplyScalar(17), idro.R * 1.3);
    mira(0.728, mezzo(idro).add(V(0, -0.1, 0.3)), V(0, 0.22, 0.975).multiplyScalar(14), idro.R * 1.1);
    turbine.forEach((x, i) => mira(0.768 + i * 0.044, V(x.P.x + (1 - i) * 0.15, x.base + x.altezza * 0.45, x.P.z), V((i - 1) * 0.7, 0.95, 4.6), x.r + 0.7));
    const ult = turbine[2];
    fissa(0.89, V(ult.P.x + idro.R + 2.2, 4.0, idro.c.z - 2.5), W.faro.clone().add(V(0, 3.4, 0)));
    // 5 contatti: verso la luce, l'anello d'oro davanti al sole
    // (sul telefono il modulo occupa la parte bassa: la camera sta più indietro e l'anello resta in alto, intero)
    const kt = mobile ? 1.5 : 1;
    mira(0.915, W.faro.clone().add(V(0, 3.3, 0)), V(-3.2, 1.3, 21).multiplyScalar(kt), faro.r + 1.4);
    mira(1.0, W.faro.clone().add(V(0, 3.3, 0)), V(-2.6, 1.0, 17.8).multiplyScalar(kt), faro.r + 1.2);
    return creaPercorso(K);
  }
  let percorso = percorsoCamera(w / h);

  // ---- velocità massima del racconto punto per punto: la camera non supera VMAX unità/s né WMAX rad/s di rotazione ----
  // (i passaggi da un'isola all'altra diventano planate calme invece di voli veloci)
  const N_LIM = 400, VMAX = 12, WMAX = 0.8, P_MAX = 0.16;
  const limiti = new Float32Array(N_LIM + 1), grezzi = new Float32Array(N_LIM + 1);
  function calcolaLimiti() {
    const a = V(0, 0, 0), b = V(0, 0, 0), ta = V(0, 0, 0), tb = V(0, 0, 0), da = V(0, 0, 0), db = V(0, 0, 0), dp = 1 / N_LIM;
    percorso(0, a, ta); da.subVectors(ta, a).normalize(); grezzi[0] = P_MAX;
    for (let i = 1; i <= N_LIM; i++) {
      percorso(i * dp, b, tb); db.subVectors(tb, b).normalize();
      const v = a.distanceTo(b) / dp, rot = Math.acos(clamp(da.dot(db), -1, 1)) / dp;
      grezzi[i] = Math.min(P_MAX, VMAX / Math.max(v, 1e-6), WMAX / Math.max(rot, 1e-6));
      a.copy(b); da.copy(db);
    }
    // il limite vale anche un poco prima e dopo (si rallenta prima di entrare nella planata)
    for (let i = 0; i <= N_LIM; i++) { let m = P_MAX; for (let j = Math.max(0, i - 5); j <= Math.min(N_LIM, i + 5); j++) m = Math.min(m, grezzi[j]); limiti[i] = m; }
  }
  calcolaLimiti();
  const limite = q => limiti[Math.round(clamp(q) * N_LIM)];

  // ---- post-produzione: bloom a metà risoluzione, MSAA secondo la qualità ----
  const rt = new THREE.WebGLRenderTarget(Math.round(w * Q.dpr()), Math.round(h * Q.dpr()), { type: THREE.HalfFloatType, samples: Q.msaa() });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  const passoScena = new RenderPass(scene, camera);
  const conta = { tri: 0, chiamate: 0 };
  const renderScena = passoScena.render.bind(passoScena);
  passoScena.render = (...a) => { renderScena(...a); conta.tri = renderer.info.render.triangles; conta.chiamate = renderer.info.render.calls; };
  composer.addPass(passoScena);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.38, 0.5, 1.1);
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (x, y) => bloomSize(Math.max(2, Math.round(x * Q.scalaBloom())), Math.max(2, Math.round(y * Q.scalaBloom())));
  if (!QS.has('nobloom')) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finitura = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRis: { value: new THREE.Vector2(w, h) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRis; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5; float v = smoothstep(0.95, 0.3, length(q * vec2(1.0, 0.9)));
        c.rgb *= mix(0.7, 1.0, v); c.rgb += (h(vUv * uRis + fract(uT * 7.0) * 100.0) - 0.5) * 0.018; gl_FragColor = c; }`,
  });
  composer.addPass(finitura);
  composer.setSize(w, h);

  function applicaQualita() {
    const dpr = Q.dpr();
    renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
    for (const t of [composer.renderTarget1, composer.renderTarget2]) { t.samples = Q.msaa(); t.dispose(); }
    composer.setSize(innerWidth, innerHeight);
    amb.impostaQualita(Q.livello); amb.impostaPx(dpr, innerHeight); linea.impostaPx(dpr * innerHeight / 900);
    for (const is of tutte) if (typeof is.m.qualita === 'function') { try { is.m.qualita(Q.livello); } catch (e) {} }
    corpo.dataset.qualita = Q.livello;
  }
  amb.impostaPx(renderer.getPixelRatio(), h); linea.impostaPx(renderer.getPixelRatio() * h / 900);

  function ridimensiona() {
    mobile = eMobile(); w = innerWidth; h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    finitura.uniforms.uRis.value.set(w, h);
    amb.impostaPx(renderer.getPixelRatio(), h); linea.impostaPx(renderer.getPixelRatio() * h / 900);
    percorso = percorsoCamera(w / h); calcolaLimiti();
    ui.misura();
  }
  let tRid = 0;
  addEventListener('resize', () => { clearTimeout(tRid); tRid = setTimeout(ridimensiona, 120); });

  // ---- compilazione anticipata (macchine montate, in primo piano e da lontano) per evitare scatti ----
  const tutte = [fv, bess, idro];
  const prova = (montaggio, funzione, vicino) => { for (const is of tutte) { try { is.m.aggiorna({ t: 0, montaggio, funzione, vicino }); } catch (e) {} } };
  camera.position.set(0, 6, 30); camera.lookAt(0, 1, -20); camera.updateMatrixWorld();
  try {
    prova(1, 1, 1); if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    prova(1, 0, 0); renderer.compile(scene, camera);
  } catch (e) { errori.push('compilazione: ' + e.message); }
  prova(0, 0, 0);

  // ---- guasto a runtime: la macchina passa al segnaposto, la pagina continua ----
  function guasto(is, e) {
    errori.push(is.nome + ' aggiorna: ' + e.message); moduli[is.nome] = 'segnaposto (errore in aggiorna: ' + e.message + ')'; console.error(e);
    const vecchio = is.m.gruppo, r = riserva[is.fn](ctx);
    if (is === idro) [r.pelton, r.francis, r.kaplan].forEach((g, i) => { g.position.x = turbine[i].P.x - W.idro.x; g.position.z = turbine[i].P.z - W.idro.z; });
    r.gruppo.position.copy(vecchio.position);
    vecchio.parent && vecchio.parent.remove(vecchio); scene.add(r.gruppo); is.m = r;
  }

  // ---- stato per fotogramma (vettori riusati: nessuna allocazione nel ciclo) ----
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0), dir = V(0, 0, 0), destra = V(0, 0, 0), SU = V(0, 1, 0), tmp = V(0, 0, 0);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!mobile) addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  const progetto = (is, f) => (is.it > 0 ? f : null);

  function aggiornaIsola(is, M, t, dt, p) {
    const f = clamp((p - M.da) / (M.a - M.da));
    const bersaglio = clamp(f / 0.85);
    is.it = saltoIter ? bersaglio : inseguiIter(is.it, bersaglio, dt);
    faseIter(is.it, is.fase);
    is.stato.t = t; is.stato.montaggio = is.fase.montaggio; is.stato.funzione = is.fase.funzione;
  }
  const accende = (L, ingresso) => clamp((L - ingresso + 0.4) / 1.4);
  function onda(is, acc, t) { if (acc > 0.5 && is.acc <= 0.5) amb.onda(is.c.x, is.c.z, t); is.acc = acc; }
  function vedi(is, on) {
    if (on !== is.visibile) { is.visibile = on; is.m.gruppo.visible = on; }
    if (on) { try { is.m.aggiorna(is.stato); } catch (e) { guasto(is, e); } }
  }

  let camLibera = null;   // solo verifica: camera fissa [x, y, z, tx, ty, tz]
  let tScan = 1000;       // solo verifica: tempo delle misure sincrone
  return {
    camera, renderer, linea, amb, limite,
    // solo verifica: secondi minimi per attraversare ogni tratto del racconto
    durate(tratti) { return tratti.map(([a, b]) => { let s = 0; for (let i = Math.round(a * N_LIM); i < Math.round(b * N_LIM); i++) s += 1 / N_LIM / limiti[i]; return +s.toFixed(2); }); },
    camLibera(v) { camLibera = v && v.length === 6 ? v : null; },
    info: () => ({ triangoli: conta.tri, chiamate: conta.chiamate, dpr: renderer.getPixelRatio() }),
    qualitaCambiata: applicaQualita,
    aggiorna(t, dt, p) {
      // camera: un percorso continuo, più un respiro lentissimo e un filo di parallasse col mouse
      percorso(p, camPos, camTgt);
      if (camLibera) { camPos.fromArray(camLibera, 0); camTgt.fromArray(camLibera, 3); }
      mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 1.6)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 1.6));
      dir.subVectors(camTgt, camPos).normalize(); destra.crossVectors(dir, SU).normalize();
      const resp = ridotto ? 0 : 1;
      camera.position.copy(camPos)
        .addScaledVector(destra, (Math.sin(t * 0.11) * 0.1 + mouse.sx * 0.3) * resp)
        .addScaledVector(SU, (Math.sin(t * 0.083) * 0.05 - mouse.sy * 0.14) * resp);
      camera.lookAt(camTgt);
      const asp = w / h;
      camera.fov = vfov(asp); camera.aspect = asp;
      const ox = mobile ? 0 : OX(p), oy = mobile ? OY(p) : 0;
      if (Math.abs(ox) > 0.001 || Math.abs(oy) > 0.001) camera.setViewOffset(w, h, -ox * w, oy * h, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();

      // linea d'energia e accensione delle isole
      const L = lunghezzaLinea(p);
      linea.aggiorna(t, L);
      const aF = accende(L, ingressi.fv), aB = accende(L, ingressi.bess), aI = accende(L, ingressi.idro);
      onda(fv, aF, t); onda(bess, aB, t); onda(idro, aI, t);
      amb.isoleU[0].set(fv.c.x, fv.c.z, fv.R, aF); amb.isoleU[1].set(bess.c.x, bess.c.z, bess.R, aB); amb.isoleU[2].set(idro.c.x, idro.c.z, idro.R, aI);

      // iter di ogni macchina
      aggiornaIsola(fv, MOMENTI.fv, t, dt, p); aggiornaIsola(bess, MOMENTI.bess, t, dt, p); aggiornaIsola(idro, MOMENTI.idro, t, dt, p);
      fv.ped.aggiorna(t, aF, progetto(fv, fv.fase)); bess.ped.aggiorna(t, aB, progetto(bess, bess.fase)); idro.ped.aggiorna(t, aI, progetto(idro, idro.fase));
      let dMin = 1e9;
      for (let i = 0; i < 3; i++) dMin = Math.min(dMin, camera.position.distanceTo(turbine[i].centro));
      const fp = liscio(0.918, 0.95, p); faro.aggiorna(t, fp, liscio(0.84, 0.9, p)); amb.isoleU[3].set(W.faro.x, W.faro.z, 2.2, fp);
      fv.stato.vicino = 1 - liscio(6.5, 11, camera.position.distanceTo(fv.centro));
      bess.stato.vicino = 1 - liscio(6.5, 11, camera.position.distanceTo(bess.centro));
      idro.stato.vicino = 1 - liscio(4.2, 8, dMin);

      // solo le macchine vicine al racconto restano accese (meno chiamate di disegno)
      vedi(fv, p < 0.47); vedi(bess, p > 0.35 && p < 0.72); vedi(idro, p > 0.6);
      saltoIter = false;
      amb.aggiorna(t, camera, liscio(0.88, 0.97, p));
      finitura.uniforms.uT.value = t;
    },
    render() { renderer.info.reset(); composer.render(); },
    // solo verifica: disegna n fotogrammi aspettando la GPU (readPixels) → ms veri, triangoli, chiamate, camera
    misuraSincrona(p, n = 12) {
      const gl = renderer.getContext(), px = new Uint8Array(4);
      let ms = 0, tm = 0;
      for (let i = 0; i < n + 3; i++) {
        const t0 = performance.now();
        saltoIter = true; this.aggiorna(tScan += 1 / 60, 1 / 60, p); this.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const d = performance.now() - t0;
        if (i >= 3) { ms += d; tm = Math.max(tm, d); }   // i primi 3 scaldano
      }
      const r = v => +v.toFixed(2);
      return { p: r(p), ms: r(ms / n), max: r(tm), tri: conta.tri, chiamate: conta.chiamate, dpr: renderer.getPixelRatio(),
        cam: camera.position.toArray().map(r), vicino: [fv.stato.vicino, bess.stato.vicino, idro.stato.vicino].map(r) };
    },
    // punti utili per l'interfaccia (in pixel)
    proietta(v, out) { tmp.copy(v).project(camera); out.x = (tmp.x + 1) / 2 * w; out.y = (1 - tmp.y) / 2 * h; out.z = tmp.z; return out; },
    W, turbine, faro, idro, fv, bess, OX,
  };
}

// ============================================================================
function avvia() {
  const schermo = { x: 0, y: 0, z: 0 }, schermo2 = { x: 0, y: 0, z: 0 };
  const BASE_LOGO = { x: 116.5, y: 208 };   // sotto "ITALIA", nel viewBox del logo
  const ancora = new THREE.Vector3();
  let prec = performance.now(), t = 0, fotogrammi = 0, partito = false;

  eri.vai = p => {
    logo && logo.completa();
    corpo.classList.remove('carica'); corpo.classList.add('entrata');
    ui.velo(false); scorr.vai(+p || 0); saltoIter = true;
    return true;
  };
  eri.info = () => ({ ms: +Q.ms.toFixed(2), ...(mondo ? mondo.info() : {}), qualita: Q.livello, auto: Q.auto, p: +scorr.p.toFixed(4), misure: Q.stato });
  eri.camera = v => { mondo && mondo.camLibera(v); return true; };
  // solo verifica: misura reale (attende la GPU) in un punto, o lungo tutto il racconto
  eri.misura = (p, n) => (mondo ? mondo.misuraSincrona(+p || 0, n) : null);
  eri.durate = t => (mondo ? mondo.durate(t) : null);
  eri.scansione = (passo = 0.02, n = 6) => {
    if (!mondo) return null;
    const out = [];
    for (let p = 0; p <= 1.0001; p += passo) out.push(mondo.misuraSincrona(Math.min(1, p), n));
    saltoIter = true;
    const peggio = k => out.reduce((a, b) => (b[k] > a[k] ? b : a));
    return { qualita: Q.livello, dpr: mondo.info().dpr, msMedi: +(out.reduce((a, b) => a + b.ms, 0) / out.length).toFixed(2),
      msPeggio: peggio('ms'), triMax: peggio('tri'), chiamateMax: peggio('chiamate'), punti: out };
  };
  eri.scendi = () => { if (Q.scendi() && mondo) mondo.qualitaCambiata(); return Q.livello; };
  // solo verifica: rifà l'apertura dall'inizio (per fotografare il sole che diventa logo)
  eri.intro = () => {
    scorr.vai(0); corpo.classList.remove('entrata');
    if (logo && logo.rifai) logo.rifai(performance.now() + 100);
    setTimeout(() => corpo.classList.add('entrata'), 1850);
    return true;
  };

  function parti(ora) {
    partito = true;
    corpo.classList.remove('carica');
    if (ridotto) { logo && logo.completa(); corpo.classList.add('entrata'); }
    else { logo && logo.avvia(ora + 350); setTimeout(() => corpo.classList.add('entrata'), 1750); }
    const h = { '#fotovoltaico': 'fv', '#accumulo': 'bess', '#idroelettrico': 'idro', '#contatti': 'contatti' }[location.hash];
    if (h) setTimeout(() => naviga(h), 300);
  }

  function ciclo(ora) {
    requestAnimationFrame(ciclo);
    const msF = ora - prec; prec = ora;
    const dt = Math.min(0.1, Math.max(0, msF / 1000)); t += dt;
    try {
      const p = scorr.aggiorna(dt, mondo ? mondo.limite : null);
      logo && logo.aggiorna(ora);
      ui.eroe(p); ui.pannelli(p);
      if (mondo) {
        mondo.aggiorna(t, dt, p);
        // filo d'energia sullo schermo: dal sole del logo alla linea, poi dal faro al pulsante
        if (p < 0.135) {
          const k = liscio(0.068, 0.112, p);
          // parte da sotto il logo (non attraversa le scritte) e scende fino alla linea sul pavimento
          const a = ui.calcolaSole(k, BASE_LOGO, logo && logo.VB ? logo.VB : { w: 233, h: 202 });
          mondo.proietta(mondo.W.S, schermo);
          ui.filo(a.x, a.y, schermo.x, schermo.y, liscio(0.026, 0.07, p), 1 - liscio(0.088, 0.118, p), 'v');
          ui.accendiInvia(false);
        } else if (p > 0.9) {
          const pr = liscio(0.925, 0.956, p);
          if (mobile) {
            ancora.set(mondo.W.faro.x, 0.06, mondo.W.faro.z); mondo.proietta(ancora, schermo);
            const r = ui.rettangoloContatti;   // dal piede dell'anello al bordo alto del modulo (solo se c'è spazio)
            const a = schermo.y < r.top - 24 ? liscio(0.915, 0.93, p) : 0;
            ui.filo(schermo.x, schermo.y, r.left + r.width / 2, r.top, pr, a, 'v');
          } else {
            mondo.faro.puntoBordo(ancora); mondo.proietta(ancora, schermo);
            const rc = ui.rettangoloContatti, ri = ui.rettangoloInvia;   // il filo arriva al bordo del vetro, all'altezza di "Invia"
            ui.filo(schermo.x, schermo.y, rc.left, ri.top + ri.height / 2, pr, liscio(0.915, 0.93, p), 'h');
          }
          ui.accendiInvia(pr > 0.97);
        } else { ui.filo(0, 0, 0, 0, 0, 0); ui.accendiInvia(false); }
        // etichette delle turbine. Schermo largo: prima sotto ai tre piedistalli (le tre insieme, appena montate),
        // poi accanto alla turbina al centro della carrellata. Telefono: solo nella carrellata, in un posto fisso in alto.
        const gT = mobile ? 0 : liscio(0.25, 0.45, mondo.idro.it) * liscio(0.712, 0.724, p) * (1 - liscio(0.738, 0.75, p));
        const g = liscio(0.5, 0.75, mondo.idro.it) * liscio(0.756, 0.768, p) * (1 - liscio(0.862, 0.88, p));
        const xc = innerWidth * (0.5 + (mobile ? 0 : mondo.OX(p)));
        for (let i = 0; i < 3; i++) {
          const x = mondo.turbine[i];
          if (gT > 0.001) {
            ancora.set(x.P.x, mondo.idro.ped.cima, x.P.z + x.piede); mondo.proietta(ancora, schermo);
            const bordo = liscio(110, 170, Math.min(schermo.x, innerWidth - schermo.x));   // niente etichette tagliate dal bordo
            ui.gioiello(i, schermo.x, schermo.y + 14, schermo.z < 1 ? gT * bordo : 0, 'sotto');
            continue;
          }
          if (g <= 0.001) { ui.gioiello(i, 0, 0, 0); continue; }
          ancora.set(x.P.x, x.base + x.altezza * 0.5, x.P.z); mondo.proietta(ancora, schermo2);
          const c = 1 - (mobile ? liscio(0.14, 0.3, Math.abs(schermo2.x - xc) / innerWidth) : liscio(0.1, 0.22, Math.abs(schermo2.x - xc) / innerWidth));
          if (mobile) ui.gioiello(i, innerWidth / 2, 84, schermo2.z < 1 ? g * c : 0, 'accanto');
          else {
            ancora.set(x.P.x + Math.min(x.r, 1.3) + 0.25, x.base + x.altezza * 0.5, x.P.z); mondo.proietta(ancora, schermo);
            ui.gioiello(i, Math.min(schermo.x + 18, innerWidth - 280), schermo.y, schermo2.z < 1 ? g * c : 0, 'accanto');
          }
        }
        mondo.render();
        if (Q.misura(msF)) mondo.qualitaCambiata();
      }
      aggiornaBarra(p);
    } catch (e) { if (errori.length < 50) errori.push('ciclo: ' + e.message); if (errori.length < 3) console.error(e); }
    fotogrammi++;
    if (!partito && fotogrammi >= 2) parti(ora);
    if (!eri.pronto && fotogrammi >= 4) eri.pronto = true;
  }

  function aggiornaBarra(p) {
    if (!mondo) { iter.aggiorna(p > 0.9 ? 'fine' : 'apertura', '', p > 0.9 ? 5 : 0, p > 0.9 ? 1 : 0); return; }
    if (p >= MOMENTI.contatti.barra[0]) { iter.aggiorna('fine', '', 5, 1); return; }
    for (const is of [mondo.fv, mondo.bess, mondo.idro]) {
      const b = MOMENTI[is.nome].barra;
      if (p >= b[0] && p < b[1]) { iter.aggiorna('momento', MOMENTI[is.nome].nome, is.fase.passo, is.fase.avanz); return; }
    }
    iter.aggiorna('apertura', '', 0, 0);
  }
  requestAnimationFrame(ciclo);
}
