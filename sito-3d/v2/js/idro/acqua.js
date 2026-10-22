// =============================================================================
// ERI v2 · idro/acqua.js — acqua della VALLE: getti Pelton, lame, spruzzi, linee di corrente, colonne del diagramma
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §6.7 "Acqua" (getti, spruzzi Points balistici × DPR, linee di corrente su DataTexture FloatType
// NearestFilter con interpolazione manuale, colonne, niente transmission), §4.5 (regola di lettura: N = max(2,
// round(Q/1,6)), v = 0,05·√(2gH); getti, lame, spruzzi, tempoScala, condottaEmissione, apertura, aperturaKaplan,
// colonne sfalsate di 0,03), App. B, config.VALLE / config.IDRO, geo.lineeCorrente / velocitaLinee / diagrammaXY.
//
// Tema chiaro "Alba luminosa": l'acqua è VETRO e INCHIOSTRO, mai luce sommata (NormalBlending, niente HDR > 1).
// Colori di palette riportati in HDR con versoScena (a schermo escono esattamente quelli), shader non illuminati.
//  - GETTI A e B: cilindri di vetro d'acqua bianco-azzurri con il filo del contorno a inchiostro, increspatura,
//    filamenti che scorrono, riflesso morbido; il fronte arrotondato avanza dall'ugello al cucchiaio (STATO.getti).
//  - LAME e SPRUZZI: gocce balistiche (§6.7: t = fract(tempo·rate + seme), pos = o + v·τ + ½gτ², diametro in px con
//    il DPR) disegnate come capsule istanziate con la scia del "tempo di posa" (× tempoScala): a ×1/1000 gocce ferme e
//    nitide, a ×1/8 strisce corte, mai salti di decine di px. Lama: ventaglio stretto e fitto ai lati della cresta (±z),
//    deviato di ≈165°, il fronte avanza con STATO.lame; spruzzi: ventaglio largo e rado, accesi da STATO.spruzzi.
//    (Scostamento da §6.7: niente Points né veli a nastro, che nel macro sembravano bolle e un pannello bianco.)
//  - LINEE DI CORRENTE (un solo InstancedBufferGeometry, filo d'inchiostro azzurro a due toni): Pelton 2 (lago alto →
//    condotta → collettore → ugelli, copertura STATO.condottaEmissione), Francis 5 (serbatoio → condotta → tubo a S →
//    chiocciola → girante → aspirazione, accese ∝ STATO.apertura), Kaplan 59 (fiume; macchina: semi-chiocciola →
//    distributore → girante → cono → gomito → fiume a valle, accese ∝ STATO.aperturaKaplan). Velocità v = 0,05·√(2gH)
//    in acqua aperta (tempo idro); i tracciati seguono i canali veri delle tre macchine (acqua-percorsi.js) e si
//    tagliano come le loro casse (Z0, YF nella sala Francis, ZK fuori dall'anello di scarico della Kaplan).
//  - COLONNE del diagramma 4e: cilindri di vetro d'acqua a z = colonneZ, raggio 0,55·√Q, altezza = y del punto di
//    lavoro; sulla colonna CADONO N linee di corrente (le stesse 2, 5, 59) a velocità ∝ √(2gH): la colonna riassume
//    la regola di lettura. Pelo libero con il menisco a inchiostro.
// File privati: acqua-percorsi.js (tracciati e campionamento), acqua-glsl.js (shader).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): pubblica ctx.dati.acqua = { getti, spruzzi, linee, colonne } (getti = { A, B, lame }).
//  aggiorna(ctx, T, t, dt): solo visible, trasformazioni e uniform (nessuna allocazione).
// Tutto noAO, fog:false, materiali con nuovoMateriale(); animazioni continue su U.uTempoIdro (ferme con riduci).
// =============================================================================
import * as THREE from 'three';
import { VALLE, IDRO, PALETTE, TRACCE } from '../config.js';
import { lineeCorrente, velocitaLinee, diagrammaXY, mulberry32, clamp } from '../geo.js';
import { nuovoMateriale, versoScena, esposizioneTono } from '../luce/nebbia.js';
import { fase, sostaVicina } from '../regia/stato.js';
import { tracciati, campiona, PERCORSI, BOX_TAGLI, ASSE_K } from './acqua-percorsi.js';
import * as GL from './acqua-glsl.js';

export const MONDO = 'valle';

const UA = VALLE.ugelloA, UB = VALLE.ugelloB, GP = VALLE.girantePelton.centro;
const D = IDRO.diagramma, ORIGINE = VALLE.diagramma.origine;
const TURBINE = ['pelton', 'francis', 'kaplan'];

// TARATURA: proporre in config (IDRO.acqua) — resa dell'acqua nel tema chiaro (colori a schermo, sRGB)
const COLORI = {
  bianco: '#eef6f8',      // nucleo dei getti e delle gocce
  corpo: '#c9e0ea',       // corpo del vetro d'acqua
  bordo: '#4f8aa6',       // bordo (fresnel)
  luce: '#ffffff',        // riflessi (limitati dal tetto di versoScena: niente bloom)
  inchiostro: PALETTE.acqua,          // linee di corrente, fili dei contorni
  chiaro: VALLE.plastico.acqua,       // coda delle linee, tinta delle colonne
  profondo: '#5d95b0',    // bordo delle colonne
  nucleo: '#d8ecf3',      // anima chiara delle linee di corrente
  colonna: '#62a7cf',     // vetro d'acqua delle colonne (più saturo: sulla carta calda un azzurro velato diventa grigio)
  colonnaFondo: '#2f7aa3',
};
// TARATURA: proporre in config (IDRO.acqua) — getti, lame, spruzzi (u, s di tempo idro)
const GETTO = { segmentiRadiali: 40, segmentiLungo: 64, svasatura: 1.12 };
// gocce: ventaglio = [indietro × j, di lato × ±z, apertura lungo il raggio, apertura lungo j] (velocità d'uscita / getto:
// ≈ −0,06 lungo il getto e ±0,14 di lato, cioè deviate di ≈165° nel cucchiaio); vel u/s; diametro u; vita s idro
const GOCCE = {
  lama:    { n: 5000, vita: 0.014, ventaglio: [0.06, 0.14, 0.04, 0.015], vel: [1.4, 1.9], dia: [0.0001, 0.00032] },
  spruzzi: { n: 900, vita: 0.05, ventaglio: [0.09, 0.14, 0.14, 0.05], vel: [0.8, 2.4], dia: [0.0001, 0.0005] },
  scia: 1 / 120,                    // "tempo di posa" (s reali): scia = tempoScala × scia
  densita: [13.12, 13.22],          // T: gli spruzzi si infittiscono dopo l'accensione (STATO.spruzzi)
};
// TARATURA: proporre in config (IDRO.linee) — tratti delle linee di corrente (φ in u d'acqua aperta)
const TRATTI = {
  larghezzaPx: 3.0,          // DESIGN: 2 px; a due toni serve un px in più per l'anima chiara
  estremi: [0.8, 0.5],                                           // dissolvenza a inizio e fine linea (φ)
  pelton:  { passo: 4.0, lunghezza: 1.8, copertura: 0.95 },
  francis: { passo: 1.2, lunghezza: 0.9, copertura: 0.9 },
  kaplan:  { passo: 2.4, lunghezza: 0.7, copertura: 1.0 },      // sul fiume 0,6 (intensità lungo la linea)
  variazione: 0.25,                                              // ± sulla lunghezza e sulla fase dei tratti
  // Francis "a riposo" (vista d'insieme) prima che il distributore si chiuda per la sosta, poi ∝ apertura
  // (si spengono a camera già nella sala, prima che YF apra la chiocciola: nel serbatoio di V4.5 l'acqua scorre ancora)
  francisRiposo: [13.80, 13.88],
  // Kaplan: tutte le 59 linee nella vista d'insieme, poi ∝ aperturaKaplan durante la sosta (doppia regolazione)
  kaplanRiposo: [14.15, 14.30],
};
// TARATURA: proporre in config (IDRO.diagramma.colonne) — colonne del diagramma
const COLONNA = {
  segmenti: 96,
  velocita: 6,          // × v delle linee (tempo idro a ×1/8 nel diagramma): Pelton ≈ 4,4 u/s, Kaplan ≈ 0,6 u/s
  passo: 3.2,           // u fra due tratti che cadono
  sfasa: 0.03,          // T fra una colonna e la successiva (§4.5)
  th0: { 2: Math.PI / 4, 5: 0 },   // posizione delle corsie (rad da +z): con 2 linee si evita la sagoma
  distacco: [6, 40],    // come la tavola: le colonne si accendono con la camera davanti e lontana
};

let st = null;
const _c = new THREE.Color();

/** Precompila per il render target lineare della pipeline (come diagramma.js): nessuna T di warm-up mostra tutto. */
function precompila(ctx, radici) {
  const r = ctx.renderer; if (!r?.compile || !ctx.camera) return;
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const prima = r.getRenderTarget();
  try { r.setRenderTarget(rt); for (const o of radici) r.compile(o, ctx.camera, ctx.scene.valle); }
  catch (e) { console.warn('[acqua] precompilazione non riuscita', e); }
  finally { r.setRenderTarget(prima); rt.dispose(); }
}

// ---------------------------------------------------------------- colori condivisi (HDR, per riferimento)
function creaColori() {
  const u = {}; for (const k of Object.keys(COLORI)) u[k] = { value: new THREE.Color() };
  return u;
}
const SORGENTI = Object.fromEntries(Object.entries(COLORI).map(([k, v]) => [k, new THREE.Color(v)]));
function aggiornaColori(S, UC) {
  const esp = esposizioneTono(S);
  for (const k in UC) versoScena(_c.copy(SORGENTI[k]), esp, UC[k].value);
}
const matShader = (nome, vertexShader, fragmentShader, uniforms, extra = {}) => {
  const m = nuovoMateriale(THREE.ShaderMaterial, { uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
    fog: false, toneMapped: false, blending: THREE.NormalBlending, ...extra });
  m.name = nome;
  return m;
};
const conUtili = o => { o.userData.noAO = true; o.castShadow = false; o.receiveShadow = false; return o; };

// ---------------------------------------------------------------- getti
function creaGetti(ctx, UC) {
  const r = IDRO.pelton.gettoDM / 20, L = Math.abs(UA.x1 - UA.x0);
  const g = new THREE.CylinderGeometry(r * GETTO.svasatura, r, L, GETTO.segmentiRadiali, GETTO.segmentiLungo, true);
  g.translate(0, L / 2, 0);
  const u = {
    uTempo: ctx.U.uTempoIdro, uFronte: { value: 0 }, uR: { value: r }, uL: { value: L }, uAlfa: { value: 1 },
    uAcBianco: UC.bianco, uAcCorpo: UC.corpo, uAcBordo: UC.bordo, uAcLuce: UC.luce, uAcInch: UC.inchiostro,
  };
  // il getto scrive la profondità: lame e gocce dietro di lui restano dietro
  const m = matShader('acqua.getto', GL.VS_GETTO, GL.FS_GETTO, u, { depthWrite: true });
  const A = conUtili(new THREE.Mesh(g, m)), B = conUtili(new THREE.Mesh(g, m));
  A.name = 'acqua.getto.A'; B.name = 'acqua.getto.B';
  // A: orizzontale verso +x, tangente in basso; B: verticale verso −y, tangente a sinistra
  A.position.set(UA.x0, UA.asseY, GP[2]); A.rotation.z = -Math.PI / 2;
  B.position.set(UB.asseX, UB.y0, GP[2]); B.rotation.z = Math.PI;
  A.renderOrder = B.renderOrder = 5;
  A.frustumCulled = B.frustumCulled = false;   // il fronte sposta i vertici nello shader
  A.visible = B.visible = false;
  return { A, B, u, L };
}

// ---------------------------------------------------------------- lame e spruzzi (gocce con la scia)
/** Gocce di una popolazione ('lama' | 'spruzzi') per le due zone d'impatto (A: getto verso +x, B: verso −y). */
function creaGocce(ctx, UC, tipo, seme0) {
  const P = GOCCE[tipo], rnd = mulberry32(seme0), n = P.n;
  const zone = [{ O: [UA.x1, UA.asseY, GP[2]], J: [1, 0, 0] }, { O: [UB.asseX, UB.y1, GP[2]], J: [0, -1, 0] }];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seme = new Float32Array(n * 4); for (let k = 0; k < n * 4; k++) seme[k] = rnd();
  g.setAttribute('aSeme', new THREE.InstancedBufferAttribute(seme, 4));
  g.instanceCount = n;
  return zone.map((z, i) => {
    const u = {
      uTempo: ctx.U.uTempoIdro, uRate: { value: 1 / P.vita }, uVita: { value: P.vita }, uScia: { value: 0 },
      uDensita: { value: 0 }, uFronte: { value: 1 }, uAlfa: { value: 1 }, uRis: ctx.U.uRisoluzione,
      uO: { value: new THREE.Vector3(...z.O) }, uJ: { value: new THREE.Vector3(...z.J) },
      uWr: { value: new THREE.Vector3(-z.J[1], z.J[0], 0) },                       // ẑ × j: lungo il raggio della ruota
      uVentaglio: { value: new THREE.Vector4(...P.ventaglio) }, uVel: { value: new THREE.Vector4(P.vel[0], P.vel[1], P.dia[0], P.dia[1]) },
      uAcCorpo: UC.corpo, uAcBordo: UC.bordo, uAcLuce: UC.luce,
    };
    const m = matShader(`acqua.${tipo}`, GL.VS_GOCCE, GL.FS_GOCCE, u);
    const o = conUtili(new THREE.Mesh(g, m));
    o.name = `acqua.${tipo}.${i ? 'B' : 'A'}`; o.renderOrder = tipo === 'lama' ? 6 : 7; o.frustumCulled = false; o.visible = false;
    return { mesh: o, u };
  });
}

// ---------------------------------------------------------------- linee di corrente
function creaLinee(ctx, UC) {
  const S = PERCORSI.campioni, curve = tracciati();
  const righe = curve.length * 2, dati = new Float32Array(S * righe * 4);
  const per = [TRATTI.pelton, TRATTI.francis, TRATTI.kaplan];
  const vel = TURBINE.map(k => velocitaLinee(IDRO[k].H));
  const rnd = mulberry32(2207), ist = [];
  curve.forEach((cv, c) => {
    const { A, B, Phi } = campiona(cv.tr, S);
    dati.set(A, (2 * c) * S * 4); dati.set(B, (2 * c + 1) * S * 4);
    const T = per[cv.gruppo], ciclo = Phi + T.lunghezza, n = Math.max(1, Math.round(ciclo / T.passo));
    for (let i = 0; i < n; i++) {
      const fase0 = (i + (rnd() - 0.5) * TRATTI.variazione) * ciclo / n;
      const lung = T.lunghezza * (1 + (rnd() - 0.5) * 2 * TRATTI.variazione);
      ist.push([2 * c, fase0, Phi, cv.gruppo, vel[cv.gruppo], lung, cv.corsia, cv.n]);
    }
  });
  const tex = new THREE.DataTexture(dati, S, righe, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.name = 'acqua.curve'; tex.needsUpdate = true;

  // nastro di K segmenti: position.x = k (0 testa → 1 coda), position.y = lato (±1)
  const K = 12, pos = [], idx = [];
  for (let i = 0; i <= K; i++) pos.push(i / K, -1, 0, i / K, 1, 0);
  for (let i = 0; i < K; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const aC = new Float32Array(ist.length * 4), aT = new Float32Array(ist.length * 4);
  ist.forEach((v, i) => { aC.set(v.slice(0, 4), i * 4); aT.set(v.slice(4, 8), i * 4); });
  g.setAttribute('aCurva', new THREE.InstancedBufferAttribute(aC, 4));
  g.setAttribute('aTratto', new THREE.InstancedBufferAttribute(aT, 4));
  g.instanceCount = ist.length;
  const BF = BOX_TAGLI.francis, BK = BOX_TAGLI.kaplan;
  const u = {
    uCurve: { value: tex }, uS: { value: S }, uTempo: ctx.U.uTempoIdro, uLarg: { value: TRATTI.larghezzaPx },
    uPx: ctx.U.uPx, uRis: ctx.U.uRisoluzione,
    uCop: { value: new THREE.Vector3() }, uFlusso: { value: new THREE.Vector3(1, 1, 1) },
    uEstremi: { value: new THREE.Vector3(TRATTI.estremi[0], TRATTI.estremi[1], 0) },
    uAcInch: UC.inchiostro, uAcChiaro: UC.chiaro, uAcNucleo: UC.nucleo,
    uYF: ctx.U.YF, uZK: { value: VALLE.piani.ZK.costante * -VALLE.piani.ZK.normale[2] },
    uBoxF: { value: new THREE.Vector4(...BF) }, uBoxK: { value: new THREE.Vector4(...BK) },
    uAsseK: { value: new THREE.Vector3(...ASSE_K) },
  };
  const m = matShader('acqua.linee', GL.VS_LINEE, GL.FS_LINEE, u);
  const mesh = conUtili(new THREE.Mesh(g, m));
  // dopo i segni d'oro del plastico: da lontano la condotta è larga 1–2 px e il filo d'oro la coprirebbe
  mesh.name = 'acqua.linee'; mesh.renderOrder = 8; mesh.frustumCulled = false;
  return { mesh, u, tex, tratti: ist.length, curve: curve.length };
}

// ---------------------------------------------------------------- colonne del diagramma
function creaColonne(ctx, UC) {
  const gC = new THREE.CylinderGeometry(1, 1, 1, COLONNA.segmenti, 1, true); gC.translate(0, 0.5, 0);
  const gT = new THREE.CircleGeometry(1, COLONNA.segmenti); gT.rotateX(-Math.PI / 2);
  return TURBINE.map((k, i) => {
    const I = IDRO[k], [x, y] = diagrammaXY(I.Q, I.H), N = lineeCorrente(I.Q);
    const r = 0.55 * Math.sqrt(I.Q);
    const gruppo = new THREE.Group(); gruppo.name = `acqua.colonna.${k}`;
    gruppo.position.set(ORIGINE[0] + x, ORIGINE[1], D.colonneZ);
    const u = {
      uN: { value: N }, uV: { value: velocitaLinee(I.H) * COLONNA.velocita }, uTempo: ctx.U.uTempoIdro, uAlfa: { value: 0 },
      uPasso: { value: COLONNA.passo }, uTh0: { value: COLONNA.th0[N] ?? 0 }, uPx: ctx.U.uPx,
      uAcTinta: UC.colonna, uAcProfondo: UC.colonnaFondo, uAcInch: UC.inchiostro, uAcLuce: UC.luce,
    };
    const corpo = conUtili(new THREE.Mesh(gC, matShader(`acqua.colonna.${k}`, GL.VS_COLONNA, GL.FS_COLONNA, u, { side: THREE.DoubleSide })));
    corpo.name = `acqua.colonna.${k}.corpo`; corpo.renderOrder = 10; corpo.scale.set(r, 1e-3, r);
    const uT = { uAlfa: u.uAlfa, uPx: ctx.U.uPx, uAcTinta: UC.colonna, uAcInch: UC.inchiostro };
    const cima = conUtili(new THREE.Mesh(gT, matShader(`acqua.colonna.${k}.cima`, GL.VS_CIMA, GL.FS_CIMA, uT, { side: THREE.DoubleSide })));
    cima.name = `acqua.colonna.${k}.cima`; cima.renderOrder = 11; cima.scale.set(r, 1, r);
    gruppo.add(corpo, cima); gruppo.visible = false;
    return { gruppo, corpo, cima, u, h: y, i };
  });
}

/** Costruzione (una volta). */
export async function crea(ctx) {
  const scena = ctx.scene.valle;
  const UC = creaColori(); aggiornaColori(ctx.STATO, UC);

  const getti = creaGetti(ctx, UC);
  const lame = creaGocce(ctx, UC, 'lama', 9137);
  const spruzzi = creaGocce(ctx, UC, 'spruzzi', 5821);
  const linee = creaLinee(ctx, UC);
  const colonne = creaColonne(ctx, UC);
  const gocce = [...lame, ...spruzzi].map(s => s.mesh);
  scena.add(getti.A, getti.B, ...gocce, linee.mesh, ...colonne.map(c => c.gruppo));

  const tr = TRACCE.colonne?.[0] || [14.98, 15.12, 0, 1, 'expo.out'];
  st = { UC, getti, lame, spruzzi, linee, colonne, trCol: tr };
  ctx.dati.acqua = {
    getti: { A: getti.A, B: getti.B, lame: lame.map(s => s.mesh) },
    spruzzi: spruzzi.map(s => s.mesh),
    linee: linee.mesh,
    colonne: colonne.map(c => c.gruppo),
  };
  precompila(ctx, [getti.A, getti.B, ...gocce, linee.mesh, ...colonne.map(c => c.gruppo)]);
  if (ctx.flags?.debug) console.info(`[acqua] ${linee.curve} linee di corrente, ${linee.tratti} tratti`);
}

/** Ogni fotogramma (solo nella VALLE). Nessuna allocazione. */
export function aggiorna(ctx, T /*, t, dt */) {
  if (!st) return;
  const S = ctx.STATO;
  const Ts = ctx.flags?.riduci ? sostaVicina(T).t1 : T;            // fasi locali: come le tracce con riduci movimento
  const vela = 1 - clamp(S.oscura ?? 0, 0, 1);                     // 4e: il plastico si vela, l'acqua con lui
  aggiornaColori(S, st.UC);

  // ---- getti: il fronte avanza dall'ugello al cucchiaio
  const g = st.getti, kg = clamp(S.getti ?? 0, 0, 1);
  g.A.visible = g.B.visible = kg > 0.001;
  g.u.uFronte.value = kg * g.L; g.u.uAlfa.value = vela;

  // ---- lame sulla cresta (il fronte del ventaglio avanza) e spruzzi; scia = tempo di posa × tempoScala
  const scia = ctx.flags?.riduci ? 0 : clamp(S.tempoScala ?? 1, 0, 1) * GOCCE.scia;
  const kl = g.A.visible ? clamp(S.lame ?? 0, 0, 1) : 0;
  for (const s of st.lame) {
    s.mesh.visible = kl > 0.001;
    s.u.uFronte.value = kl; s.u.uDensita.value = 1; s.u.uScia.value = scia; s.u.uAlfa.value = vela;
  }
  const ks = (S.spruzzi ?? 0) > 0.5 && g.A.visible ? fase(Ts, GOCCE.densita[0], GOCCE.densita[1], 'power2.out') : 0;
  for (const s of st.spruzzi) { s.mesh.visible = ks > 0.001; s.u.uDensita.value = ks; s.u.uScia.value = scia; s.u.uAlfa.value = vela; }

  // ---- linee di corrente: copertura per gruppo e linee accese (frazione delle corsie)
  const L = st.linee.u, TR = TRATTI;
  const fR = 1 - fase(Ts, TR.francisRiposo[0], TR.francisRiposo[1]);
  const kR = 1 - fase(Ts, TR.kaplanRiposo[0], TR.kaplanRiposo[1]);
  const flF = Math.max(clamp(S.apertura ?? 0, 0, 1), fR), flK = Math.max(clamp(S.aperturaKaplan ?? 1, 0, 1), kR);
  L.uFlusso.value.set(1, flF, flK);
  L.uCop.value.set(TR.pelton.copertura * clamp(S.condottaEmissione ?? 1, 0, 1) * vela, TR.francis.copertura * vela, TR.kaplan.copertura * vela);
  st.linee.mesh.visible = vela > 0.002;

  // ---- colonne del diagramma (sfalsate Pelton → Francis → Kaplan), con la camera davanti alla tavola
  const dz = (ctx.camera?.position.z ?? 1e3) - D.colonneZ;
  const kD = fase(dz, COLONNA.distacco[0], COLONNA.distacco[1], 'power2.inOut');
  const tr = st.trCol;
  for (const c of st.colonne) {
    const f = (S.colonne ?? 0) > 0 ? fase(Ts, tr[0] + c.i * COLONNA.sfasa, tr[1] + c.i * COLONNA.sfasa, tr[4]) : 0;
    c.gruppo.visible = f > 0.001 && kD > 0.001;
    const h = Math.max(1e-3, c.h * f);
    c.corpo.scale.y = h; c.cima.position.y = h;
    c.u.uAlfa.value = kD * Math.min(1, f * 4);
  }
}
