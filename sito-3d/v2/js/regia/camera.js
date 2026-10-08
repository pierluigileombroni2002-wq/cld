// =============================================================================
// ERI v2 · regia/camera.js — rig sferico della camera (keyframe, soste, voli)
// Proprietario: [BASE-REGIA].
// Specifica: DESIGN §0 (rig sferico), §4.0 "Rig della camera" (normativa), §4.1–4.7 (keyframe in
// config.CAMERA), §4.7 (servizi: keyframe forzato in 1,2 s power2.inOut), §6.11 (riduci movimento),
// §6.12 (schermi stretti), config.RIG.
//
// Interpolazione normativa (§4.0):
//  - SOSTA [t0, t1]: parametri del keyframe più l'eventuale 'deriva' lineare (config: deriva:{psi:[a,b], d:[a,b]}).
//  - VOLO dal t1 di una sosta al t0 della successiva, con i passaggi 'via' nel mezzo:
//      e = smootherstep((T − tA)/(tB − tA));  w = tA + e·(tB − tA)        (tempo "distorto")
//      segmento k con Tk ≤ w < Tk+1;  u = (w − Tk)/(Tk+1 − Tk);  s = (k + u)/(n − 1)
//      posizioni: CatmullRomCurve3 CENTRIPETA, getPoint(s), sui TARGET se tutti i nodi hanno ancora
//      'target', sulle POSIZIONI P se anche un solo nodo ha ancora 'camera';
//      scalari: Catmull-Rom uniforme sugli stessi nodi (d, vicino, lontano e meta in log; psi srotolato).
//  - Sempre: micro-deriva nel tempo (psi ±0,4° / 23 s, phi ±0,2° / 31 s) e parallasse del mouse
//    (psi ±0,6°, phi ±0,4°, damp λ 3; spente con ?test=1). Con ancora 'target' si orbita attorno al target; con ancora
//    'camera' si ruota sul posto (nel vicolo agrivoltaico largo 0,87 u la camera non deve spostarsi).
//  - Vincolo P.y ≥ altezza(P.x, P.z) + 0,3 (solo PIANURA). Rollio nei voli = clamp(−0,004·dψ/dT, ±2°).
//  - Schermi stretti: aspect < 1,5 → fovV = 2·atan(tan(fov/2)·1,5/aspect), al massimo 75°.
//  - Riduci movimento: niente voli (sosta più vicina), cambio di sosta con dissolvenza di 300 ms nel
//    velo (ctx.veli.regia), niente deriva, micro-deriva, parallasse e rollio.
//
// Contratto (ARCHITETTURA §6): export posa(T) PURA; crea(ctx) pubblica
//  ctx.rig = { aggiorna(T,t,dt), posa(T), salta(), forza(id|null), mouse(nx, ny) }
//  ctx.regia = { target, posizione, d, phi, psi, fov, vicino, lontano, meta, centroOmbra, keyframe,
//                inSosta, mondo } + (extra) fovBase, ancora, rollio, volo:{da, a, e}|null, forzato, inTransizione
// =============================================================================
import * as THREE from 'three';
import { CAMERA, RIG, SERVIZI_CAMERA } from '../config.js';
import { altezza, clamp, smootherstep, diffAngolo, fovStretto, rad, damp } from '../geo.js';
import { mondoDi, ease, sostaVicina } from './stato.js';   // sostaVicina: stessa regola dello STATO (§6.11)

export const MONDO = 'sistema';

const RIDUCI_DISSOLVENZA_S = RIG.riduciDissolvenzaMs / 1000;   // §6.11
const PASSO_DERIVATA = 0.004;          // T, differenza centrale per dψ/dT (dettaglio numerico, non una taratura)
const easeServizi = ease('power2.inOut');

// ---------------------------------------------------------------- utilità (senza allocazioni)
const LN = Math.log;
/** Direzione di vista (§0): v = (cosφ·sinψ, −sinφ, −cosφ·cosψ), scritta in out (array o Vector3-like). */
function vista(phi, psi, out) {
  const p = rad(phi), s = rad(psi), c = Math.cos(p);
  out[0] = c * Math.sin(s); out[1] = -Math.sin(p); out[2] = -c * Math.cos(s);
  return out;
}
/** Catmull-Rom uniforme scalare sui valori a[0..n−1], segmento k, frazione u (estremi estrapolati come three). */
function crScalare(a, k, u) {
  const n = a.length;
  if (n < 2) return a[0];
  const p1 = a[k], p2 = a[k + 1];
  const p0 = k > 0 ? a[k - 1] : 2 * p1 - p2;
  const p3 = k + 2 < n ? a[k + 2] : 2 * p2 - p1;
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
const norm360 = a => ((a % 360) + 360) % 360;

/** Parametri di un keyframe con la deriva della sosta all'avanzamento u (0 = inizio, 1 = fine). */
function parametri(k, u, conDeriva = true) {
  const dr = (conDeriva && k.deriva) || null;
  const lin = (c) => (dr && dr[c]) ? dr[c][0] + (dr[c][1] - dr[c][0]) * u : 0;
  return { d: k.d + lin('d'), phi: k.phi + lin('phi'), psi: k.psi + lin('psi'), fov: k.fov + lin('fov'),
           vicino: k.vicino, lontano: k.lontano, meta: k.ombra ?? 60 };
}

// ---------------------------------------------------------------- tabelle precalcolate (al caricamento)
// Per mondo: soste (keyframe non 'via', ordinati) e voli tra soste consecutive con i 'via' interni.
function preparaMondo(nome) {
  const K = CAMERA.filter(k => k.mondo === nome).sort((a, b) => a.t0 - b.t0 || a.t1 - b.t1);
  const soste = K.filter(k => !k.via);
  const voli = [];
  for (let i = 0; i < soste.length - 1; i++) {
    const A = soste[i], B = soste[i + 1];
    const nodi = [A, ...K.filter(k => k.via && k.t0 > A.t1 && k.t0 < B.t0), B];
    const par = nodi.map((k, j) => parametri(k, j === 0 ? 1 : 0));
    for (let j = 1; j < par.length; j++) par[j].psi = par[j - 1].psi + diffAngolo(par[j - 1].psi, par[j].psi);   // psi srotolato
    const ancoraCamera = nodi.some(k => k.ancora === 'camera');
    const v = [0, 0, 0];
    const punti = nodi.map((k, j) => {
      const p = par[j];
      if (!ancoraCamera) return new THREE.Vector3(k.T[0], k.T[1], k.T[2]);
      vista(p.phi, p.psi, v);
      return new THREE.Vector3(k.T[0] - p.d * v[0], k.T[1] - p.d * v[1], k.T[2] - p.d * v[2]);
    });
    const centri = nodi.map(k => k.ombraCentro || k.T);
    voli.push({
      A, B, tA: A.t1, tB: B.t0, nodi, ancoraCamera,
      tempi: nodi.map((k, j) => (j === 0 ? A.t1 : k.t0)),
      curva: new THREE.CatmullRomCurve3(punti, false, 'centripetal'),
      logD: par.map(p => LN(p.d)), phi: par.map(p => p.phi), psi: par.map(p => p.psi), fov: par.map(p => p.fov),
      logVicino: par.map(p => LN(p.vicino)), logLontano: par.map(p => LN(p.lontano)), logMeta: par.map(p => LN(p.meta)),
      cx: centri.map(c => c[0]), cy: centri.map(c => c[1]), cz: centri.map(c => c[2]),
    });
  }
  return { K, soste, voli };
}
const MONDI = { pianura: preparaMondo('pianura'), valle: preparaMondo('valle') };
const PER_ID = new Map(CAMERA.map(k => [k.id, k]));

/** Oggetto posa riusabile (nessuna allocazione nel ciclo). */
function nuovaPosa() {
  return { target: [0, 0, 0], posizione: [0, 0, 0], centro: [0, 0, 0], d: 1, phi: 0, psi: 0, fov: 37.8, vicino: 0.5, lontano: 4000,
           meta: 60, keyframe: '', inSosta: true, ancora: 'target', mondo: 'pianura', volo: null, e: 0, da: '', a: '' };
}
const _v = [0, 0, 0];
const _pt = new THREE.Vector3();

/** Scrive in o la sosta k all'avanzamento u. */
function posaSosta(k, u, o, conDeriva = true) {
  const dr = (conDeriva && k.deriva) || null;
  const lin = (c) => (dr && dr[c]) ? dr[c][0] + (dr[c][1] - dr[c][0]) * u : 0;
  o.d = k.d + lin('d'); o.phi = k.phi + lin('phi'); o.psi = k.psi + lin('psi'); o.fov = k.fov + lin('fov');
  o.vicino = k.vicino; o.lontano = k.lontano; o.meta = k.ombra ?? 60;
  o.target[0] = k.T[0]; o.target[1] = k.T[1]; o.target[2] = k.T[2];
  vista(o.phi, o.psi, _v);
  o.posizione[0] = k.T[0] - o.d * _v[0]; o.posizione[1] = k.T[1] - o.d * _v[1]; o.posizione[2] = k.T[2] - o.d * _v[2];
  const c = k.ombraCentro || k.T; o.centro[0] = c[0]; o.centro[1] = c[1]; o.centro[2] = c[2];
  o.keyframe = k.id; o.inSosta = true; o.ancora = k.ancora || 'target'; o.mondo = k.mondo; o.volo = null; o.e = 0; o.da = k.id; o.a = k.id;
  return o;
}

/** Scrive in o la posa del volo v al tempo T (tA < T < tB). */
function posaVolo(v, T, o) {
  const e = smootherstep((T - v.tA) / (v.tB - v.tA));
  const w = v.tA + e * (v.tB - v.tA);
  const n = v.nodi.length, tm = v.tempi;
  let k = 0; while (k < n - 2 && w >= tm[k + 1]) k++;
  const u = clamp((w - tm[k]) / Math.max(1e-9, tm[k + 1] - tm[k]), 0, 1);
  o.d = Math.exp(crScalare(v.logD, k, u)); o.phi = crScalare(v.phi, k, u); o.psi = crScalare(v.psi, k, u); o.fov = crScalare(v.fov, k, u);
  o.vicino = Math.exp(crScalare(v.logVicino, k, u)); o.lontano = Math.exp(crScalare(v.logLontano, k, u)); o.meta = Math.exp(crScalare(v.logMeta, k, u));
  v.curva.getPoint((k + u) / (n - 1), _pt);
  vista(o.phi, o.psi, _v);
  if (v.ancoraCamera) {
    o.posizione[0] = _pt.x; o.posizione[1] = _pt.y; o.posizione[2] = _pt.z;
    o.target[0] = _pt.x + o.d * _v[0]; o.target[1] = _pt.y + o.d * _v[1]; o.target[2] = _pt.z + o.d * _v[2];
  } else {
    o.target[0] = _pt.x; o.target[1] = _pt.y; o.target[2] = _pt.z;
    o.posizione[0] = _pt.x - o.d * _v[0]; o.posizione[1] = _pt.y - o.d * _v[1]; o.posizione[2] = _pt.z - o.d * _v[2];
  }
  o.centro[0] = crScalare(v.cx, k, u); o.centro[1] = crScalare(v.cy, k, u); o.centro[2] = crScalare(v.cz, k, u);
  o.keyframe = (u < 0.5 ? v.nodi[k] : v.nodi[k + 1]).id;
  o.inSosta = false; o.ancora = v.ancoraCamera ? 'camera' : 'target'; o.volo = v; o.e = e; o.da = v.A.id; o.a = v.B.id;
  return o;
}

/** Posa normativa (senza micro-deriva, parallasse, rollio, vincoli) al tempo T, scritta in o. */
function posaIn(T, o) {
  const mondo = mondoDi(T), M = MONDI[mondo], S = M.soste;
  o.mondo = mondo;
  if (T <= S[0].t0) return posaSosta(S[0], 0, o);
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (T >= s.t0 && T <= s.t1) return posaSosta(s, s.t1 > s.t0 ? (T - s.t0) / (s.t1 - s.t0) : 0, o);
  }
  const V = M.voli;
  for (let i = 0; i < V.length; i++) if (T > V[i].tA && T < V[i].tB) return posaVolo(V[i], T, o);
  return posaSosta(S[S.length - 1], 1, o);       // oltre l'ultima sosta: resta alla fine della sua deriva
}

const _pPsi = nuovaPosa();
/** Psi normativo srotolato al tempo T all'interno del volo v (per la derivata del rollio). */
function psiVolo(v, T) { return posaVolo(v, clamp(T, v.tA + 1e-6, v.tB - 1e-6), _pPsi).psi; }

/**
 * Posa normativa PURA al tempo T (nessuno stato del rig).
 * @param {number} T tempo di storia
 * @returns {{target:number[], posizione:number[], d:number, phi:number, psi:number, fov:number, vicino:number,
 *            lontano:number, meta:number, keyframe:string, inSosta:boolean, ancora:string, mondo:string,
 *            centroOmbra:number[], volo:{da:string,a:string,e:number}|null}}
 */
export function posa(T) {
  const o = posaIn(T, nuovaPosa());
  return { target: o.target, posizione: o.posizione, d: o.d, phi: o.phi, psi: norm360(o.psi), fov: o.fov, vicino: o.vicino,
           lontano: o.lontano, meta: o.meta, keyframe: o.keyframe, inSosta: o.inSosta, ancora: o.ancora, mondo: o.mondo,
           centroOmbra: o.centro, volo: o.volo ? { da: o.da, a: o.a, e: o.e } : null };
}
/** Elenco delle soste (keyframe non 'via') con il T centrale: usato da test.js e dal debug. */
export function soste() {
  return CAMERA.filter(k => !k.via).map(k => ({ id: k.id, mondo: k.mondo, t0: k.t0, t1: k.t1, T: (k.t0 + k.t1) / 2 }));
}

/** Ogni fotogramma: delega al rig (contratto: aggiorna a livello di modulo come tutti gli altri). */
export function aggiorna(ctx, T, t, dt) { ctx.rig?.aggiorna(T, t, dt); }

export function crea(ctx) {
  const cam = ctx.camera;
  cam.rotation.order = 'YXZ';
  const regia = ctx.regia = {
    target: new THREE.Vector3(), posizione: new THREE.Vector3(), centroOmbra: new THREE.Vector3(),
    d: 1, phi: 0, psi: 0, fov: 37.8, fovBase: 37.8, vicino: 0.5, lontano: 4000, meta: 190,
    keyframe: 'K0.0', inSosta: true, mondo: 'pianura', ancora: 'target', rollio: 0,
    volo: null, forzato: null, inTransizione: false,
  };
  const voloInfo = { da: '', a: '', e: 0 };          // riusato in regia.volo
  const base = nuovaPosa();                           // posa normativa del fotogramma
  const dest = nuovaPosa();                           // posa di destinazione (servizi)
  const da = nuovaPosa();                             // istantanea all'inizio di una transizione dei servizi
  const fin = nuovaPosa();                            // posa finale (dopo la transizione)
  const coarse = matchMedia('(pointer: coarse)').matches;

  // stato non legato allo scroll (tempo reale): parallasse, transizione dei servizi, dissolvenza del riduci
  const mouse = { nx: 0, ny: 0, psi: 0, phi: 0 };
  let saltaProssimo = true;
  let forzato = null;                                 // keyframe forzato dai Servizi (§4.7)
  let trans = null;                                   // { t0, dur } transizione verso forzato o di ritorno
  const rid = { mostra: null, chiave: null, t0: -1 }; // riduci: sosta mostrata, sosta voluta, inizio dissolvenza

  function copiaPosa(src, o) {
    o.target[0] = src.target[0]; o.target[1] = src.target[1]; o.target[2] = src.target[2];
    o.posizione[0] = src.posizione[0]; o.posizione[1] = src.posizione[1]; o.posizione[2] = src.posizione[2];
    o.centro[0] = src.centro[0]; o.centro[1] = src.centro[1]; o.centro[2] = src.centro[2];
    o.d = src.d; o.phi = src.phi; o.psi = src.psi; o.fov = src.fov; o.vicino = src.vicino; o.lontano = src.lontano; o.meta = src.meta;
    o.keyframe = src.keyframe; o.inSosta = src.inSosta; o.ancora = src.ancora; o.mondo = src.mondo; o.volo = src.volo; o.e = src.e; o.da = src.da; o.a = src.a;
    return o;
  }
  /** Miscela a → b con k (power2.inOut già applicato): target lineare, d/vicino/lontano/meta in log, psi per la via breve. */
  function miscela(a, b, k, o) {
    for (let i = 0; i < 3; i++) { o.target[i] = a.target[i] + (b.target[i] - a.target[i]) * k; o.centro[i] = a.centro[i] + (b.centro[i] - a.centro[i]) * k; }
    o.d = Math.exp(LN(a.d) + (LN(b.d) - LN(a.d)) * k); o.phi = a.phi + (b.phi - a.phi) * k; o.psi = a.psi + diffAngolo(a.psi, b.psi) * k;
    o.fov = a.fov + (b.fov - a.fov) * k; o.vicino = Math.exp(LN(a.vicino) + (LN(b.vicino) - LN(a.vicino)) * k);
    o.lontano = Math.exp(LN(a.lontano) + (LN(b.lontano) - LN(a.lontano)) * k); o.meta = Math.exp(LN(a.meta) + (LN(b.meta) - LN(a.meta)) * k);
    o.ancora = 'target'; o.inSosta = k >= 1 ? b.inSosta : false; o.keyframe = k < 0.5 ? a.keyframe : b.keyframe; o.mondo = b.mondo; o.volo = null;
    vista(o.phi, o.psi, _v);
    for (let i = 0; i < 3; i++) o.posizione[i] = o.target[i] - o.d * _v[i];
    return o;
  }

  function aggiornaRig(T, t, dt) {
    const riduci = !!ctx.flags.riduci;
    const mondo = mondoDi(T);
    // §4.7: la camera forzata dai Servizi vale SOLO sotto le sezioni. Un focus rimasto in una colonna (tastiera,
    // tocco su un collegamento) non deve bloccare la storia quando si torna a scorrere: si rilascia con la
    // transizione di ritorno di 1,2 s.
    if (forzato && !(ctx.scroll?.inSezioni || (ctx.veli?.sezioni ?? 0) > 0.5)) ctx.rig.forza(null);
    // ---- 1. posa normativa (o sosta più vicina con riduci movimento)
    if (riduci) {
      const voluta = (forzato && forzato.mondo === mondo) ? forzato : sostaVicina(T);
      if (saltaProssimo || !rid.mostra || rid.mostra.mondo !== mondo) { rid.mostra = voluta; rid.chiave = voluta; rid.t0 = -1; }
      else if (voluta !== rid.chiave) { rid.chiave = voluta; rid.t0 = t; }          // parte la dissolvenza
      let velo = 0;
      if (rid.t0 >= 0) {
        const p = (t - rid.t0) / RIDUCI_DISSOLVENZA_S;
        if (p >= 0.5) rid.mostra = rid.chiave;                                          // cambio nel buio
        if (p >= 1) rid.t0 = -1; else velo = 1 - Math.abs(2 * p - 1);
      }
      ctx.veli.regia = velo;
      posaSosta(rid.mostra, 0, fin, false);
      trans = null;
    } else {
      ctx.veli.regia = 0;
      rid.mostra = null;
      posaIn(T, base);
      const f = (forzato && forzato.mondo === base.mondo) ? forzato : null;
      if (f) posaSosta(f, 0, dest, false);
      const verso = f ? dest : base;
      if (trans && !saltaProssimo) {
        const k = easeServizi(clamp((t - trans.t0) / trans.dur, 0, 1));
        miscela(da, verso, k, fin);
        if (k >= 1) trans = null;
      } else { trans = null; copiaPosa(verso, fin); }
    }

    // ---- 2. offset nel tempo: micro-deriva e parallasse (non con riduci; non con ?test=1, così le
    //         inquadrature delle prove sono riproducibili al pixel indipendentemente dal numero di fotogrammi)
    let dPsi = 0, dPhi = 0;
    if (!riduci && !ctx.flags.test) {
      const md = RIG.microDeriva, pa = RIG.parallasse;
      dPsi += md.psi * Math.sin(2 * Math.PI * t / md.periodoPsi);
      dPhi += md.phi * Math.sin(2 * Math.PI * t / md.periodoPhi);
      const obPsi = -mouse.nx * pa.psi, obPhi = -mouse.ny * pa.phi;    // la camera segue il mouse come una finestra
      if (saltaProssimo) { mouse.psi = obPsi; mouse.phi = obPhi; }
      else { mouse.psi = damp(mouse.psi, obPsi, pa.lambda, dt); mouse.phi = damp(mouse.phi, obPhi, pa.lambda, dt); }
      dPsi += mouse.psi; dPhi += mouse.phi;
    } else { mouse.psi = mouse.phi = 0; }
    const phi = fin.phi + dPhi, psi = fin.psi + dPsi;
    vista(phi, psi, _v);
    const P = cam.position;
    if (fin.ancora === 'camera') {          // rotazione sul posto (vicolo): P fisso, target ricalcolato
      P.set(fin.posizione[0], fin.posizione[1], fin.posizione[2]);
      regia.target.set(P.x + fin.d * _v[0], P.y + fin.d * _v[1], P.z + fin.d * _v[2]);
    } else {                                // orbita attorno al target
      regia.target.set(fin.target[0], fin.target[1], fin.target[2]);
      P.set(fin.target[0] - fin.d * _v[0], fin.target[1] - fin.d * _v[1], fin.target[2] - fin.d * _v[2]);
    }
    // ---- 3. vincolo sul suolo (solo PIANURA, terreno analitico)
    if (mondo === 'pianura') {
      const yMin = altezza(P.x, P.z) + RIG.quotaMinimaSuolo;
      if (P.y < yMin) P.y = yMin;
    }
    // ---- 4. rollio nei voli: clamp(−0,004·dψ/dT, ±2°) (posa normativa, quindi funzione pura di T)
    let rollio = 0;
    if (!riduci && !trans && !forzato && base.volo) {
      const v = base.volo, h = PASSO_DERIVATA;
      const dpsi = (psiVolo(v, T + h) - psiVolo(v, T - h)) / (Math.min(T + h, v.tB) - Math.max(T - h, v.tA));
      rollio = clamp(RIG.rollio.fattore * dpsi, -RIG.rollio.max, RIG.rollio.max);
    }
    // ---- 5. orientamento e ottica
    cam.rotation.set(-rad(phi), -rad(psi), rad(rollio), 'YXZ');
    const fovEff = fovStretto(fin.fov, cam.aspect, RIG.aspettoStretto, RIG.fovMax);
    if (cam.fov !== fovEff || cam.near !== fin.vicino || cam.far !== fin.lontano) {
      cam.fov = fovEff; cam.near = fin.vicino; cam.far = fin.lontano;
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // ---- 6. ctx.regia (letto da luci, ombre, HUD, etichette)
    regia.posizione.copy(P);
    regia.d = fin.d; regia.phi = phi; regia.psi = norm360(psi); regia.fov = fovEff; regia.fovBase = fin.fov;
    regia.vicino = fin.vicino; regia.lontano = fin.lontano; regia.meta = fin.meta;
    regia.centroOmbra.set(fin.centro[0], fin.centro[1], fin.centro[2]);
    regia.keyframe = fin.keyframe; regia.inSosta = fin.inSosta; regia.mondo = mondo; regia.ancora = fin.ancora; regia.rollio = rollio;
    if (!riduci && !trans && !forzato && base.volo) { voloInfo.da = base.da; voloInfo.a = base.a; voloInfo.e = base.e; regia.volo = voloInfo; }
    else regia.volo = null;
    regia.forzato = forzato ? forzato.id : null;
    regia.inTransizione = !!trans || (rid.t0 >= 0);   // la camera si muove da sola (Servizi, dissolvenza del riduci)
    saltaProssimo = false;
  }

  ctx.rig = {
    posa,
    soste,
    aggiorna: aggiornaRig,
    /** Il prossimo aggiorna non smorza (vaiT, cambio di mondo): parallasse, dissolvenze e transizioni si chiudono. */
    salta() { saltaProssimo = true; },
    /**
     * §4.7 Servizi: porta la camera su un keyframe in 1,2 s (power2.inOut). id = 'K1.3' | chiave di
     * config.SERVIZI_CAMERA ('sviluppo', …) | null per tornare alla posa dello scroll.
     */
    forza(id) {
      const k = id ? (PER_ID.get(id) || PER_ID.get(SERVIZI_CAMERA[id]) || null) : null;
      if (k === forzato) return;
      copiaPosa(fin, da);                       // parte dalla posa mostrata nell'ultimo fotogramma
      forzato = k;
      trans = { t0: ctx.tempo.t, dur: RIG.serviziDurata };
    },
    /** Parallasse: coordinate normalizzate del puntatore (−1..1). Ignorata su schermi touch. */
    mouse(nx, ny) { if (coarse) return; mouse.nx = clamp(nx, -1, 1); mouse.ny = clamp(ny, -1, 1); },
  };
}
