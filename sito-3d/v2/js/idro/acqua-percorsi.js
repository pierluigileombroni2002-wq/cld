// =============================================================================
// ERI v2 · idro/acqua-percorsi.js — tracciati delle linee di corrente della VALLE (file privato di idro/acqua.js)
// Proprietario: [VALLE]. Si importa SOLO da idro/acqua.js.
// Specifica: DESIGN §4.5 (regola di lettura: N = max(2, round(Q/1,6)), v = 0,05·√(2gH)), §6.7 (curve campionate in
// una DataTexture), §3.6 (lago alto, condotta Pelton, serbatoio, condotta Francis, fiume, traversa e Kaplan),
// config.VALLE / config.IDRO, geo.lineeCorrente, misure delle condotte da valle-forme.js.
//
// I tracciati seguono i passaggi d'acqua VERI delle macchine (stesse misure di pelton-forme, francis-forme e
// kaplan-forme, ricostruite da config): così le linee restano dentro i tubi e si vedono solo dove il taglio li apre.
//  - Pelton (2): lago alto → condotta forzata → collettore a Y (ramo A sotto, ramo B che scavalca la ruota) → ugelli
//    (nell'anello attorno al bulbo, fino alla bocca: lì comincia il getto).
//  - Francis (5): serbatoio → presa nella diga → condotta → tubo a S → chiocciola (θ da +z verso +x, 345°) → pale fisse e
//    direttrici (spirale logaritmica) → girante fra corona e fascia → tubo di aspirazione → gomito → muro est.
//  - Kaplan (59 + 59): fiume (fino alla centrale) e macchina: semi-chiocciola (150° → 375°) → avantdistributore e
//    distributore → sotto il coperchio (da radiale ad assiale) → girante → cono → gomito → diffusore → fiume a valle.
// Ogni linea è una polilinea densa di punti [x, y, z, λ, ρ, μ]:
//  - λ scala del flusso: la testa dei tratti avanza a velocità costante nella coordinata φ = ∫ds/λ, quindi nel mondo
//    corre a λ·v e i tratti distano λ·passo (λ = 1 in acqua aperta: lì vale la regola di lettura);
//  - ρ peso della risoluzione: i campioni sono uniformi in ψ = ∫ds/ρ (fitti dentro le macchine);
//  - μ lunghezza relativa del tratto.
// campiona() la riduce a due righe di S campioni per la DataTexture (A: punti, B: φ → indice in A).
// =============================================================================
import * as THREE from 'three';
import { VALLE, IDRO, UNITA } from '../config.js';
import { hValle, lerp, ss, clamp, mulberry32, lineeCorrente } from '../geo.js';
import { puntiCondottaPelton, puntiCondottaFrancis, livelloFiume, livelloValle, EDIFICI } from './valle-forme.js';

const GP = VALLE.girantePelton.centro, GF = VALLE.giranteFrancis, GK = VALLE.giranteKaplan;
const MU = UNITA.metriPerU, R = Math.PI / 180;
const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
/** Metri nel telaio di una macchina (origine c) → u del mondo. */
const mondo = (c, x, y, z) => [c[0] + x / MU, c[1] + y / MU, c[2] + z / MU];
const loc = (w, i, c) => (w - c[i]) * MU;

// TARATURA: proporre in config (IDRO.linee) — tracciati delle linee di corrente (u del mondo salvo "m" = metri macchina)
export const PERCORSI = {
  campioni: 512,
  pelton: {
    lago: { x: -218, y: [86.2, 87.3], z: -0.035 },            // partenza nel lago alto, appena dietro il taglio
    scarto: 0.011,                                           // nel tubo: di lato (u), e verso il fondo dietro il taglio
    fondo: 0.32,                                             //   (frazione del raggio: nel collettore e negli ugelli)
    sala: { lambda: 0.08, rho: 0.02, mu: 1 },                // nella sala: l'acqua si vede da 1,5 u
    ugello: { lunghezza: 1.55, rTubo: 0.25, rBocca: 0.05 },  // m (pelton-forme: ugello, raggio del collettore all'ingresso)
  },
  francis: {
    serbatoio: { x: -78, y: [13.6, 16.2], z: -0.03 },         // dal largo del serbatoio verso la presa nella diga
    tubo: { spaglio: 0.6, fondo: 0.03 },                     // nella condotta: frazione della sezione; verso −z fuori sala
    yMacchina: [-0.05, -0.08],                               // m sotto il piano del distributore (YF = 2,0 lo apre)
    macchina: { lambda: 0.25, rho: 0.03, mu: 0.55 },
    tonoSala: 0.3,                                           // tono del filo dentro le casse (0 scuro … 1 chiaro)
    ingresso: { valvola: [-5.6, -3.4] },                     // m (francis-forme: tubo a S e valvola sferica)
    parete: 0.07, uscita: [0.12, 0.9],                       // m; frazione della chiocciola dove esce ogni linea
    stay: 38,                                                // gradi delle pale fisse sulla tangente (spirale logaritmica)
    girante: { v: [0.6, 0.9], giro: 40 },                    // fra corona (0) e fascia (1); giro nella girante (gradi)
    aspirazione: { y0: -0.55, curva: 2.4, sopraInterrato: 1.8, r: [0.66, 0.95, 1.05, 1.2], giro: 30, fondo: 0.72 },
  },
  kaplan: {
    fiume: { x: [-27, 105.9], margine: 0.32, sotto: 0.012, liscio: 4, presa: { x: 92, z: [-0.25, -3.3] },
             inchiostro: 0.6 },                              // 59 linee fitte sul fiume: inchiostro più leggero che in macchina
    macchina: { lambda: 0.7, rho: 0.05, mu: 0.6 },
    // semi-chiocciola (allineata a kaplan-forme.FORMA): 150° → 375°, parete esterna 11,5 → 6,6 m, canale fra 1,2 e 3,0 m
    chiocciola: { a: [150, 375], R: [GK.semichioccialaRaggioM - 0.5, 6.6], esp: 0.8, partenza: [152, 168], rDentro: 5.6 },
    stay: 38, rCoperchio: 3.0,
    // sotto il coperchio: le linee vicine al naso (centro (3,0; 1,1), semiassi 2,02 × 1,9) e quelle vicine alla campana
    // dell'anello di scarico (centro (3,0; 0,55), semiassi 0,73 × 0,65), scostate verso l'acqua
    naso: { c: [3.0, 1.1], r: [2.02, 1.9], k: 0.9 }, campana: { c: [3.0, 0.55], r: [0.73, 0.65], k: 1.15 },
    giroGirante: [50, 70], yUscita: -0.75,
    cono: { rSfera: 2.19, r: 3.0, y: [-0.6, -7.5], giro: 40 },
    gomito: { y0: -7.5, Re: 4.4, fondo: -13.9, an: [3.0, 2.0, 2.4], az: [3.0, 4.2, 5.2], xF: 58.7 },
    valle: { x: [121.5, 142], margine: 0.3 },
  },
};

// ---------------------------------------------------------------- polilinea con λ, ρ, μ
class Tracciato {
  // k = intensità dell'inchiostro; tono = 0 filo scuro con l'anima sottile (su fondi chiari: plastico, canali azzurri),
  // 1 filo chiaro con i bordi a inchiostro (su fondi scuri: l'interno delle casse della Francis)
  constructor(k = 1, tono = 0) { this.p = []; this.k = k; this.tono = tono; }
  punto(x, y, z, l = 1, r = 1, m = 1, k = this.k, tono = this.tono) {
    const q = this.p[this.p.length - 1];
    if (q && Math.hypot(q[0] - x, q[1] - y, q[2] - z) < 1e-7) return this;
    this.p.push([x, y, z, l, r, m, k, tono]); return this;
  }
  /** Segue f(t) → [x, y, z, (λ, ρ, μ, k, tono)] per t in (0, 1] con n passi (il punto t = 0 è già l'ultimo aggiunto). */
  segui(f, n, l = 1, r = 1, m = 1) {
    for (let i = 1; i <= n; i++) { const q = f(i / n); this.punto(q[0], q[1], q[2], q[3] ?? l, q[4] ?? r, q[5] ?? m, q[6] ?? this.k, q[7] ?? this.tono); }
    return this;
  }
  get ultimo() { return this.p[this.p.length - 1]; }
}
/** Hermite cubica fra a e b con tangenti ta, tb (già scalate). */
function hermite(a, ta, b, tb, t) {
  const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return [0, 1, 2].map(i => h00 * a[i] + h10 * ta[i] + h01 * b[i] + h11 * tb[i]);
}
/** Bézier cubica nel piano (punti [a, b]). */
function bez(P, t) {
  const k = 1 - t, a = k * k * k, b = 3 * k * k * t, c = 3 * k * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}

// ---------------------------------------------------------------- campionamento per la DataTexture
/**
 * Riga A: S punti uniformi in ψ = ∫ds/ρ (xyz, w = μ). Riga B: S valori uniformi in φ = ∫ds/λ → x = indice frazionario
 * in A, y = intensità dell'inchiostro.
 * @returns {{A: Float32Array, B: Float32Array, Phi: number, L: number}}
 */
export function campiona(tr, S = PERCORSI.campioni) {
  const p = tr.p, M = p.length;
  const psi = new Float64Array(M), phi = new Float64Array(M);
  let L = 0;
  for (let k = 1; k < M; k++) {
    const a = p[k - 1], b = p[k], ds = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    L += ds;
    psi[k] = psi[k - 1] + ds / Math.max(1e-3, (a[4] + b[4]) / 2);
    phi[k] = phi[k - 1] + ds / Math.max(1e-3, (a[3] + b[3]) / 2);
  }
  const Psi = psi[M - 1], Phi = phi[M - 1];
  const A = new Float32Array(S * 4), B = new Float32Array(S * 4);
  const phiA = new Float64Array(S), kA = new Float64Array(S), tA = new Float64Array(S);
  let k = 0;
  for (let i = 0; i < S; i++) {
    const t = Psi * i / (S - 1);
    while (k < M - 2 && psi[k + 1] < t) k++;
    const f = clamp((t - psi[k]) / Math.max(psi[k + 1] - psi[k], 1e-12), 0, 1), a = p[k], b = p[k + 1];
    A[i * 4] = lerp(a[0], b[0], f); A[i * 4 + 1] = lerp(a[1], b[1], f); A[i * 4 + 2] = lerp(a[2], b[2], f);
    A[i * 4 + 3] = lerp(a[5], b[5], f);
    phiA[i] = lerp(phi[k], phi[k + 1], f); kA[i] = lerp(a[6], b[6], f); tA[i] = lerp(a[7], b[7], f);
  }
  let j = 0;
  for (let i = 0; i < S; i++) {
    const t = Phi * i / (S - 1);
    while (j < S - 2 && phiA[j + 1] < t) j++;
    const f = clamp((t - phiA[j]) / Math.max(phiA[j + 1] - phiA[j], 1e-12), 0, 1);
    B[i * 4] = j + f; B[i * 4 + 1] = lerp(kA[j], kA[j + 1], f); B[i * 4 + 2] = lerp(tA[j], tA[j + 1], f);
  }
  return { A, B, Phi, L };
}

// ---------------------------------------------------------------- Pelton: lago alto → condotta → collettore → ugelli
/** Rami del collettore a Y (pelton-forme.geoCollettore) fino alla bocca dell'ugello: [x, y, raggio] in metri. */
function ramiPelton() {
  const U = PERCORSI.pelton.ugello, CP = VALLE.condottaPelton.fine;
  const x0 = loc(CP[0], 0, GP), y0 = loc(CP[1], 1, GP), r0 = VALLE.condottaPelton.raggio * MU;
  const xA = loc(VALLE.ugelloA.x0, 0, GP), yA = loc(VALLE.ugelloA.asseY, 1, GP);
  const xB = loc(VALLE.ugelloB.asseX, 0, GP), yB = loc(VALLE.ugelloB.y0, 1, GP);
  const iA = xA - U.lunghezza, iB = yB + U.lunghezza, rr = 1.05, k = 0.5523 * rr, yS = iB + rr;
  const tratto = (curve, nC, ugello) => {
    const out = [];
    curve.forEach((c, ci) => { for (let i = ci ? 1 : 0; i <= nC; i++) { const s = (ci + i / nC) / curve.length, p = bez(c, i / nC);
      out.push([p[0], p[1], lerp(r0, U.rTubo, ss(0.1, 0.75, s))]); } });
    for (let i = 1; i <= 30; i++) { const q = i / 30, p = ugello(q); out.push([p[0], p[1], lerp(U.rTubo, U.rBocca, ss(0.35, 1, q))]); }
    return out;
  };
  return [
    tratto([[[x0, y0], [x0 + 3.5, y0], [x0 + 7.0, yA], [iA, yA]]], 60, q => [lerp(iA, xA, q), yA]),
    tratto([[[x0, y0], [x0 + 4.0, y0], [x0 + 8.2, yS], [xB - rr, yS]], [[xB - rr, yS], [xB - rr + k, yS], [xB, iB + k], [xB, iB]]], 50,
           q => [xB, lerp(iB, yB, q)]),
  ];
}
function pelton() {
  const P = PERCORSI.pelton, N = lineeCorrente(IDRO.pelton.Q), SA = P.sala;
  const curva = new THREE.CatmullRomCurve3(puntiCondottaPelton().map(v3), false, 'centripetal');
  const n = Math.ceil(curva.getLength() / 0.04), rami = ramiPelton(), rT = VALLE.condottaPelton.raggio;
  const pp = new THREE.Vector3(), t = new THREE.Vector3(), nI = new THREE.Vector3(), b = new THREE.Vector3();
  const xSala = EDIFICI.pelton.x[0];
  const out = [];
  for (let j = 0; j < N; j++) {
    const on = N > 1 ? lerp(-P.scarto, P.scarto, j / (N - 1)) : 0, ob = -P.fondo * rT;
    // condotta: scarto nel piano verticale (nI) e verso il fondo dietro il taglio (−b ≈ −z)
    const tubo = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n; curva.getPointAt(u, pp); curva.getTangentAt(u, t);
      nI.set(t.y, -t.x, 0); if (nI.lengthSq() < 1e-8) nI.set(0, 1, 0); nI.normalize();
      b.crossVectors(nI, t).normalize();
      const k = ss(xSala, xSala + 1.5, pp.x);
      tubo.push([pp.x + nI.x * on + b.x * ob, pp.y + nI.y * on + b.y * ob, pp.z + nI.z * on + b.z * ob,
                 lerp(1, SA.lambda, k), lerp(1, SA.rho, k), lerp(1, SA.mu, k)]);
    }
    const tr = new Tracciato(), e = tubo[0];
    const y0 = N > 1 ? lerp(P.lago.y[0], P.lago.y[1], j / (N - 1)) : P.lago.y[0];
    tr.punto(P.lago.x, y0, P.lago.z);
    tr.segui(q => [lerp(P.lago.x, e[0], q), lerp(y0, e[1], ss(0.3, 1, q)), lerp(P.lago.z, e[2], ss(0.55, 1, q))],
             Math.ceil((e[0] - P.lago.x) / 0.25));
    for (const q of tubo) tr.punto(...q);
    // collettore e ugello: ramo A per la prima linea, B per la seconda (le altre, se ci fossero, si alternano)
    const ramo = rami[j % 2], onM = on * MU;
    ramo.forEach(([x, y, r], i) => {
      if (!i) return;
      const a = ramo[i - 1], dx = x - a[0], dy = y - a[1], l = Math.hypot(dx, dy) || 1, s = i / (ramo.length - 1);
      const lato = onM * (1 - ss(0, 0.3, s));                     // stessa normale della condotta: (t.y, −t.x)
      const p = mondo(GP, x + dy / l * lato, y - dx / l * lato, -P.fondo * r);
      tr.punto(p[0], p[1], p[2], SA.lambda, SA.rho, SA.mu);
    });
    out.push({ tr, gruppo: 0, corsia: j / N, n: N });
  }
  return out;
}

// ---------------------------------------------------------------- Francis: serbatoio → … → muro est
// telaio di francis-forme: metri attorno al centro della girante, θ da +z verso +x (verso dell'acqua), (ρ sinθ, y, ρ cosθ)
const CH = GF.chiocciola;
const chR = t => CH.r0M + (CH.r1M - CH.r0M) * t;
const chSez = t => CH.sezioneM * Math.sqrt(Math.max(0.01, 1 - 0.9 * t)) - PERCORSI.francis.parete;
const polare = (rho, th, y) => [rho * Math.sin(th * R), y, rho * Math.cos(th * R)];
function francis() {
  const P = PERCORSI.francis, N = lineeCorrente(IDRO.francis.Q), c = GF.centro, MQ = P.macchina, TB = P.tubo;
  const cf = puntiCondottaFrancis();
  const curva = new THREE.CatmullRomCurve3([...cf.fuori, ...cf.dentro.slice(1)].map(v3), false, 'centripetal');
  const n = Math.ceil(curva.getLength() / 0.03);
  const pp = new THREE.Vector3(), t = new THREE.Vector3(), h = new THREE.Vector3(), w = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const xSala = EDIFICI.francis.x[0], rTubo = VALLE.condottaFrancis.diametroM / 2 / MU - P.parete / MU;   // raggio interno (u)
  // tubo a S e tratto dritto fino all'imbocco (θ = 0, ρ = r0), come francis-forme.ingresso()
  const xc = loc(VALLE.condottaFrancis.a[0], 0, c), R0 = CH.r0M, [v0] = P.ingresso.valvola;
  const esse = new THREE.CatmullRomCurve3([[xc, 0, 0], [xc + 1.2, 0, 0], [xc + 3.0, 0, 0.45], [xc + 5.2, 0, R0 - 0.45],
    [v0 - 1.0, 0, R0], [v0, 0, R0]].map(v3), false, 'centripetal', 0.5);
  // girante: fili di corona e fascia (francis-forme.FORME.girante), D1/2 = 0,8, D2/2 = 0,63
  const R1 = GF.D1M / 2, R2 = GF.D2M / 2, hD = 0.12;
  const PC = [[R1, hD], [0.50, 0.125], [0.24, 0.02], [0.19, -0.34]], PB = [[R1, -hD], [0.70, -0.125], [0.63, -0.22], [R2, -0.50]];
  const A = P.aspirazione, yO = loc(EDIFICI.francis.interrato, 1, c) + A.sopraInterrato, yG = yO + A.curva;
  const muroEst = loc(EDIFICI.francis.x[1] - EDIFICI.muro, 0, c);
  const rAsp = y => lerp(A.r[0], A.r[1], clamp((A.y0 - y) / (A.y0 - yG), 0, 1));
  const K = 1 / Math.tan(P.stay * R);
  const out = [];
  for (let j = 0; j < N; j++) {
    const fj = N > 1 ? j / (N - 1) : 0.5;
    const d = lerp(-TB.spaglio, TB.spaglio, fj), yM = j % 2 ? P.yMacchina[1] : P.yMacchina[0];
    // condotta: fuori dalla sala il tubo è aperto da Z0 (verso −z), dentro da YF (sotto il piano del distributore)
    const tubo = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n; curva.getPointAt(u, pp); curva.getTangentAt(u, t);
      h.crossVectors(t, Y); if (h.lengthSq() < 1e-8) h.set(0, 0, 1); h.normalize();       // orizzontale ⟂ al tubo
      w.crossVectors(h, t).normalize();                                                   // ⟂ nel piano verticale
      const k = ss(xSala - 1.0, xSala + 0.4, pp.x);
      const oh = lerp(-TB.fondo, d * rTubo, k), ow = lerp(d * rTubo, yM / MU, k);
      tubo.push([pp.x + h.x * oh + w.x * ow, pp.y + h.y * oh + w.y * ow, pp.z + h.z * oh + w.z * ow]);
    }
    const tr = new Tracciato(), e = tubo[0], S0 = P.serbatoio;
    const y0 = lerp(S0.y[0], S0.y[1], fj);
    tr.punto(S0.x, y0, S0.z);
    tr.segui(q => [lerp(S0.x, e[0], q), lerp(y0, e[1], ss(0, 1, q)), lerp(S0.z, e[2], ss(0.6, 1, q))], Math.ceil((e[0] - S0.x) / 0.25));
    // nella sala, dentro le casse (interno nello stile delle macchine, anche scuro): anima del filo più larga
    const TS = P.tonoSala;
    for (const q of tubo) tr.punto(q[0], q[1], q[2], 1, q[0] > xSala ? 0.2 : 1, 1, 1, TS * ss(xSala - 0.2, xSala + 0.3, q[0]));
    const M = (x, y, z, f = 1) => { const p = mondo(c, x, y, z); return [...p, lerp(1, MQ.lambda, f), lerp(0.2, MQ.rho, f), lerp(1, MQ.mu, f), 1, TS]; };
    // tubo a S (aperto a metà da YF): scarto orizzontale d·sezione, sotto il piano
    const nE = 60;
    for (let i = 1; i <= nE; i++) {
      const u = i / nE; esse.getPointAt(u, pp); esse.getTangentAt(u, t);
      h.crossVectors(t, Y).normalize();
      tr.punto(...M(pp.x + h.x * d * rTubo * MU, yM, pp.z + h.z * d * rTubo * MU, ss(0, 1, u)));
    }
    tr.segui(q => M(lerp(v0, 0, q), yM, R0 + d * rTubo * MU), 12);
    // chiocciola: 345° con la sezione che cala; le linee più interne escono prima verso il distributore
    const tE = lerp(P.uscita[0], P.uscita[1], fj), dS = d * rTubo * MU / chSez(0);
    tr.segui(q => { const tt = q * tE; return M(...polare(chR(tt) + dS * chSez(tt), tt * CH.gradi, yM)); }, Math.ceil(tE * CH.gradi / 1.5));
    // pale fisse e direttrici: spirale logaritmica fino all'ingresso della girante
    const thE = tE * CH.gradi, rE = chR(tE) + dS * chSez(tE), v = lerp(P.girante.v[0], P.girante.v[1], fj), yD = lerp(hD, -hD, v);
    tr.segui(q => { const r = lerp(rE, R1, q); return M(...polare(r, thE + K * Math.log(rE / r) / R, lerp(yM, yD, ss(0, 1, q)))); }, 40);
    // girante: fra il filo della corona e quello della fascia, da radiale ad assiale
    const th1 = thE + K * Math.log(rE / R1) / R;
    tr.segui(q => { const a = bez(PC, q), b = bez(PB, q); return M(...polare(lerp(a[0], b[0], v), th1 + P.girante.giro * q, lerp(a[1], b[1], v))); }, 36);
    // tubo di aspirazione: scende allargandosi, la rotazione residua si spegne
    const th2 = th1 + P.girante.giro, uR = bez(PC, 1), uB = bez(PB, 1), rU = lerp(uR[0], uB[0], v), yU = lerp(uR[1], uB[1], v);
    const f = rU / rAsp(A.y0);
    tr.segui(q => { const y = lerp(yU, yG, q); return M(...polare(f * rAsp(y), th2 + A.giro * Math.sin(q * Math.PI / 2), y)); }, 50);
    // gomito verso +x (stesse componenti nella sezione) e diffusore fino al muro est
    const th3 = th2 + A.giro, xo = f * A.r[1] * Math.sin(th3 * R), zo = f * A.r[1] * Math.cos(th3 * R);
    tr.segui(q => { const a = Math.PI * (1 + q / 2), k = lerp(1, A.r[2] / A.r[1], q);
      return M(A.curva + A.curva * Math.cos(a) - Math.cos(a) * xo * k, yG + A.curva * Math.sin(a) - Math.sin(a) * xo * k, zo * k); }, 24);
    tr.segui(q => { const k = lerp(A.r[2], A.r[3], ss(0, 0.3, q)) / A.r[1];
      return M(lerp(A.curva, muroEst - 0.6, q), yO + xo * k, zo * k); }, 40);
    out.push({ tr, gruppo: 1, corsia: j / N, n: N });
  }
  return out;
}

// ---------------------------------------------------------------- Kaplan: fiume, poi macchina (semi-chiocciola → valle)
/** Larghezza utile del fiume (z ≤ 0) alla sezione x: dove il terreno resta sotto il pelo libero − margine. */
function zSponda(x, liv, margine) {
  let z = 0;
  for (; z > -24; z -= 0.1) if (hValle(x, z) > liv - margine) break;
  return Math.min(-0.5, z + 0.1);
}
function sponde(x0, x1, passo, livello, margine, liscio) {
  const xs = [], zs = [];
  for (let x = x0; x <= x1 + 1e-6; x += passo) { xs.push(x); zs.push(zSponda(x, livello(x), margine)); }
  // media mobile: le gobbe del rumore non fanno serpeggiare le linee
  const m = Math.max(1, Math.round(liscio / passo)), out = zs.map((_, i) => {
    let s = 0, c = 0; for (let k = -m; k <= m; k++) { s += zs[clamp(i + k, 0, zs.length - 1)]; c++; } return s / c;
  });
  return x => { const u = clamp((x - x0) / passo, 0, xs.length - 1), i = Math.min(Math.floor(u), xs.length - 2); return lerp(out[i], out[i + 1], u - i); };
}
// telaio di kaplan-forme: metri attorno al centro della girante, angolo a da +x verso +z (verso dell'acqua), (r cos a, y, r sin a)
const polareK = (r, a, y) => [r * Math.cos(a * R), y, r * Math.sin(a * R)];
function kaplan() {
  const P = PERCORSI.kaplan, N = lineeCorrente(IDRO.kaplan.Q), c = GK.centro, MQ = P.macchina;
  const F = P.fiume, CH = P.chiocciola, CO = P.cono, G = P.gomito, V = P.valle;
  const zMonte = sponde(F.x[0], F.x[1], 0.5, livelloFiume, F.margine, F.liscio);
  const zValle = sponde(V.x[0], V.x[1], 0.5, livelloValle, V.margine, F.liscio);
  const rnd = mulberry32(4501);
  // ordine di accensione casuale (con l'apertura le linee compaiono sparse su tutto il fiume), uguale fiume e macchina
  const ordine = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [ordine[i], ordine[k]] = [ordine[k], ordine[i]]; }
  const Ro = a => { const s = clamp((a - CH.a[0]) / (CH.a[1] - CH.a[0]), 0, 1); return CH.R[1] + (CH.R[0] - CH.R[1]) * Math.pow(1 - s, CH.esp); };
  const K = 1 / Math.tan(P.stay * R);
  // angolo d'ingresso nel distributore: uniforme su tutto il giro (in ogni tratto metà delle linee sta dietro il taglio)
  const giro = Array.from({ length: N }, (_, i) => (i + 0.5) / N);
  for (let i = N - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [giro[i], giro[k]] = [giro[k], giro[i]]; }
  const out = [];
  for (let j = 0; j < N; j++) {
    const f = (j + 0.5) / N, g = [rnd(), rnd(), rnd(), rnd(), rnd()];
    // ---- fiume: appena sotto il pelo libero, distribuite sulla larghezza; vicino alla centrale si stringono sulla sua facciata
    const tr = new Tracciato(F.inchiostro);
    const zB = lerp(F.presa.z[0], F.presa.z[1], f);
    const zr = x => { const z = -0.12 - f * (-zMonte(x) - 0.12 - 0.15); return lerp(z, zB, ss(F.presa.x, F.x[1], x)); };
    tr.punto(F.x[0], livelloFiume(F.x[0]) - F.sotto, zr(F.x[0]));
    tr.segui(q => { const x = lerp(F.x[0], F.x[1], q); return [x, livelloFiume(x) - F.sotto, zr(x)]; }, Math.ceil((F.x[1] - F.x[0]) / 0.4));
    out.push({ tr, gruppo: 2, corsia: ordine[j] / N, n: N });

    // ---- macchina
    const m = new Tracciato();
    const M = (x, y, z, l = MQ.lambda, r = MQ.rho, mu = MQ.mu) => { const p = mondo(c, x, y, z); return [...p, l, r, mu]; };
    // v: 0 vicino alla campana (in basso), 1 vicino al naso (in alto); la quota nel canale ne segue
    const NA = P.naso, CA = P.campana, v = g[0];
    const eNaso = q => [NA.c[0] - NA.r[0] * NA.k * Math.sin(q * Math.PI / 2), NA.c[1] + NA.r[1] * NA.k * Math.cos(q * Math.PI / 2)];
    const eCamp = q => [CA.c[0] - CA.r[0] * CA.k * Math.sin(q * Math.PI / 2), CA.c[1] + CA.r[1] * CA.k * Math.cos(q * Math.PI / 2)];
    const sotto = q => { const a = eCamp(q), b = eNaso(q); return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)]; };
    const yS = sotto(0)[1];
    // entrata nel distributore ad aE: dentro la semi-chiocciola (150° → 375°) la linea la percorre dall'imbocco, oltre
    // (davanti, dove il taglio ha tolto la cassa) entra dall'apertura della presa e comincia sulle pale fisse
    const aE = CH.a[0] + 360 * giro[j];
    if (aE < CH.a[1] - 5) {
      const a0 = Math.min(lerp(CH.partenza[0], CH.partenza[1], g[1]), aE - 4), r0 = lerp(CH.rDentro + 0.3, Ro(a0) - 0.5, g[2]);
      m.punto(...M(...polareK(r0, a0, yS)));
      // semi-chiocciola: giro lungo la parete esterna che si stringe, poi verso le pale fisse
      m.segui(q => { const a = lerp(a0, aE, q), rr = lerp(r0, CH.rDentro, ss(0, 1, q));
        return M(...polareK(Math.min(rr, Ro(a) - 0.4), a, yS)); }, Math.max(4, Math.ceil((aE - a0) / 1.5)));
    } else {
      m.punto(...M(...polareK(CH.rDentro + 0.8, aE - 12, yS)));
      m.segui(q => M(...polareK(lerp(CH.rDentro + 0.8, CH.rDentro, q), aE - 12 * (1 - q), yS)), 8);
    }
    // pale fisse e direttrici: spirale logaritmica fino al bordo del coperchio
    const rC = P.rCoperchio;
    m.segui(q => { const r = lerp(CH.rDentro, rC, q); return M(...polareK(r, aE + K * Math.log(CH.rDentro / r) / R, yS)); }, 30);
    // sotto il coperchio: da radiale ad assiale fra il naso (in alto) e la campana dell'anello di scarico (in basso)
    const a1 = aE + K * Math.log(CH.rDentro / rC) / R, da = 35;
    m.segui(q => { const [r, y] = sotto(q); return M(...polareK(r, a1 + da * q, y)); }, 30);
    // girante: elica fra mozzo e anello
    const a2 = a1 + da, gG = lerp(P.giroGirante[0], P.giroGirante[1], g[3]), [rG, yG0] = sotto(1);
    m.segui(q => M(...polareK(rG, a2 + gG * q, lerp(yG0, P.yUscita, q))), 30);
    // cono di aspirazione: la linea resta alla stessa frazione del raggio, la rotazione residua si spegne
    const rCo = y => lerp(CO.rSfera, CO.r, clamp((CO.y[0] - y) / (CO.y[0] - CO.y[1]), 0, 1));
    const a3 = a2 + gG, fC = rG / rCo(P.yUscita);
    m.segui(q => { const y = lerp(P.yUscita, CO.y[1], q); return M(...polareK(fC * rCo(y), a3 + CO.giro * Math.sin(q * Math.PI / 2), y)); }, 40);
    // gomito e diffusore (kaplan-forme.geometriaGomito): stesse coordinate normalizzate nella sezione
    const a4 = a3 + CO.giro, un = fC * CO.r * Math.cos(a4 * R) / G.an[0], wn = fC * CO.r * Math.sin(a4 * R) / G.az[0];
    m.segui(q => { const fa = q * Math.PI / 2, k = ss(0, 1, q), an = lerp(G.an[0], G.an[1], k), az = lerp(G.az[0], G.az[1], k);
      const cx = G.Re - G.Re * Math.cos(fa), cy = G.y0 - G.Re * Math.sin(fa);
      return M(cx + Math.cos(fa) * un * an, cy + Math.sin(fa) * un * an, wn * az); }, 30);
    m.segui(q => { const an = lerp(G.an[1], G.an[2], q), az = lerp(G.az[1], G.az[2], q);
      return M(lerp(G.Re, G.xF, q), G.fondo + an + un * an, wn * az); }, 40);
    // risalita nel fiume a valle (nascosta nel terreno) e linee sul pelo libero fino alla pianura
    const e = m.ultimo, zv = x => -0.12 - f * (-zValle(x) - 0.12 - 0.15);
    const p1 = [V.x[0], livelloValle(V.x[0]) - F.sotto, zv(V.x[0])];
    const ea = [e[0], e[1], e[2]];
    m.segui(q => [...hermite(ea, [3, 0, 0], p1, [3, 0, 0], q), lerp(MQ.lambda, 1, q), lerp(MQ.rho, 1, q), lerp(MQ.mu, 1, q),
                  lerp(1, F.inchiostro, q)], 30);
    m.segui(q => { const x = lerp(V.x[0], V.x[1], q); return [x, livelloValle(x) - F.sotto, zv(x), 1, 1, 1, F.inchiostro]; },
            Math.ceil((V.x[1] - V.x[0]) / 0.4));
    out.push({ tr: m, gruppo: 2, corsia: ordine[j] / N, n: N });
  }
  return out;
}

/** Tutte le linee di corrente: Pelton (gruppo 0), Francis (1), Kaplan (2). */
export function tracciati() { return [...pelton(), ...francis(), ...kaplan()]; }
/** Asse della Kaplan (x, z) e raggio entro cui la vena non si taglia (anello di scarico e cono, ≤ 3 m + 0,2). */
export const ASSE_K = [GK.centro[0], GK.centro[2], (PERCORSI.kaplan.cono.r + 0.2) / MU];
/** Box delle sale tagliate per il taglio manuale delle linee: [x0, x1, y0, y1]. */
export const BOX_TAGLI = {
  francis: [EDIFICI.francis.x[0], EDIFICI.francis.x[1], EDIFICI.francis.interrato - 0.2, EDIFICI.francis.tetto + 0.2],
  kaplan: [GK.centro[0] - 1.45, EDIFICI.kaplan.x[1], EDIFICI.kaplan.interrato - 0.2, 0.4],
};
