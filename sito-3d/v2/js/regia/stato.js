// =============================================================================
// ERI v2 · regia/stato.js — STATO condiviso, tracce di scroll, uniform condivise (U)
// Proprietario: [ARCH]. Contratto: vedi ARCHITETTURA.md §5.
//
// Principio (vincolante): ogni animazione legata allo scroll è una FUNZIONE PURA di T.
// Le tracce dichiarate in config.TRACCE scrivono STATO a ogni fotogramma; i moduli leggono
// STATO (o le uniform U, collegate per riferimento) e non accumulano stato tra i fotogrammi.
// Così lo scroll all'indietro, i salti (vaiT) e il riduci-movimento sono corretti per costruzione.
// =============================================================================
import * as THREE from 'three';
import * as CFG from '../config.js';
import { posizioneSole, angoloTracker, coloreSole, intensitaSole, direzioneSole, clamp } from '../geo.js';

// ---------------------------------------------------------------- easing (stessa forma di GSAP 3)
const pIn = n => t => Math.pow(t, n);
const pOut = n => t => 1 - Math.pow(1 - t, n);
const pInOut = n => t => t < 0.5 ? Math.pow(2 * t, n) / 2 : 1 - Math.pow(2 * (1 - t), n) / 2;
export const EASING = {
  none: t => t, linear: t => t,
  'power1.in': pIn(2), 'power1.out': pOut(2), 'power1.inOut': pInOut(2),
  'power2.in': pIn(3), 'power2.out': pOut(3), 'power2.inOut': pInOut(3),
  'power3.in': pIn(4), 'power3.out': pOut(4), 'power3.inOut': pInOut(4),
  'power4.in': pIn(5), 'power4.out': pOut(5), 'power4.inOut': pInOut(5),
  'expo.in': t => t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  'expo.out': t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  'expo.inOut': t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  'sine.inOut': t => -(Math.cos(Math.PI * t) - 1) / 2,
  smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10),
};
/** Funzione di easing per nome (default lineare). */
export const ease = nome => EASING[nome] || EASING.none;
/** Avanzamento 0..1 di un intervallo [T0, T1] con easing. T1 = T0 → gradino. */
export function fase(T, T0, T1, nomeEase = 'none') {
  if (T1 <= T0) return T >= T0 ? 1 : 0;
  return ease(nomeEase)(clamp((T - T0) / (T1 - T0), 0, 1));
}
/** Valore numerico di una lista di segmenti [[T0,T1,da,a,ease]] al tempo T (stessa semantica delle tracce). */
export function traccia(segmenti, T, iniziale = 0) {
  for (let i = segmenti.length - 1; i >= 0; i--) {
    const [T0, T1, da, a, e] = segmenti[i];
    if (T < T0) continue;
    if (T >= T1) return a;
    const d = da ?? (i > 0 ? segmenti[i - 1][3] : iniziale);
    return d + (a - d) * ease(e)((T - T0) / (T1 - T0));
  }
  return iniziale;
}

// ---------------------------------------------------------------- tappe e mondi
export const tappaDi = T => { const t = CFG.TAPPE; for (let i = t.length - 1; i >= 0; i--) if (T >= t[i].T0) return i; return 0; };
export const mondoDi = T => (T >= CFG.CAMBIO_MONDO.valleDa && T < CFG.CAMBIO_MONDO.valleA) ? 'valle' : 'pianura';

// ---------------------------------------------------------------- STATO
const copiaProfonda = o => JSON.parse(JSON.stringify(o));
const eColore = v => typeof v === 'string' && v[0] === '#';

/**
 * Crea STATO e U.
 * @returns {{ STATO: object, U: object, aggiorna(T:number, t:number, dt:number, opz?:{riduci?:boolean}): void,
 *             valuta(chiave:string, T:number): any, tracce: object[] }}
 */
export function creaStato(cfg = CFG) {
  const STATO = copiaProfonda(cfg.STATO_INIZIALE);
  // colori come THREE.Color (lineari internamente), preset come {da, a, k}
  STATO.sole.col = new THREE.Color(cfg.STATO_INIZIALE.sole.col);
  STATO.cielo = { da: cfg.STATO_INIZIALE.cielo, a: cfg.STATO_INIZIALE.cielo, k: 0 };
  // valori derivati (scritti da aggiorna)
  Object.assign(STATO, {
    T: 0, tappa: 0, mondo: 'pianura', t: 0, dt: 0,
    soleDir: [0, 1, 0],
    trackerFV: { theta: 0, stato: 'NOTTE', ideale: 0 },
    trackerAgri: { theta: 0, stato: 'NOTTE', ideale: 0 },
    tempoIdro: 0,
  });

  // ---- compilazione delle tracce: percorso → (oggetto, chiave), segmenti ordinati
  const tracce = [];
  for (const [percorso, segmentiGrezzi] of Object.entries(cfg.TRACCE)) {
    const parti = percorso.split('.');
    let obj = STATO; for (let i = 0; i < parti.length - 1; i++) obj = obj[parti[i]];
    const chiave = parti[parti.length - 1];
    if (obj == null || !(chiave in obj)) { console.warn(`[stato] traccia senza chiave in STATO: ${percorso}`); continue; }
    const iniziale = percorso.split('.').reduce((o, k) => o?.[k], cfg.STATO_INIZIALE);
    const segmenti = segmentiGrezzi.map(s => ({ T0: s[0], T1: s[1], da: s[2], a: s[3], e: ease(s[4]) })).sort((p, q) => p.T0 - q.T0);
    let tipo = 'numero';
    if (eColore(iniziale) || segmenti.some(s => eColore(s.a))) tipo = 'colore';
    else if (typeof iniziale === 'string' || segmenti.some(s => typeof s.a === 'string')) tipo = 'preset';
    if (tipo === 'colore') for (const s of segmenti) { s.cDa = s.da ? new THREE.Color(s.da) : null; s.cA = new THREE.Color(s.a); }
    // 'da' mancante (set istantaneo o null): eredita il valore di arrivo del segmento precedente
    for (let i = 0; i < segmenti.length; i++) if (segmenti[i].da == null) {
      segmenti[i].da = i ? segmenti[i - 1].a : iniziale; if (tipo === 'colore') segmenti[i].cDa = i ? segmenti[i - 1].cA : new THREE.Color(iniziale);
    }
    const cIniziale = tipo === 'colore' ? new THREE.Color(iniziale) : null;
    tracce.push({ percorso, obj, chiave, segmenti, tipo, iniziale, cIniziale });
  }

  function valutaTraccia(tr, T, scrivi = true) {
    const segs = tr.segmenti; let s = null;
    for (let i = segs.length - 1; i >= 0; i--) if (T >= segs[i].T0) { s = segs[i]; break; }
    if (tr.tipo === 'numero') {
      let v; if (!s) v = tr.iniziale; else if (T >= s.T1) v = s.a; else v = s.da + (s.a - s.da) * s.e((T - s.T0) / (s.T1 - s.T0));
      if (scrivi) tr.obj[tr.chiave] = v; return v;
    }
    if (tr.tipo === 'colore') {
      const c = scrivi ? tr.obj[tr.chiave] : new THREE.Color();
      if (!s) c.copy(tr.cIniziale); else if (T >= s.T1) c.copy(s.cA); else c.copy(s.cDa).lerp(s.cA, s.e((T - s.T0) / (s.T1 - s.T0)));
      return c;
    }
    // preset
    let v; if (!s) v = { da: tr.iniziale, a: tr.iniziale, k: 0 }; else if (T >= s.T1) v = { da: s.a, a: s.a, k: 0 };
    else v = { da: s.da, a: s.a, k: s.e((T - s.T0) / (s.T1 - s.T0)) };
    if (scrivi) { const o = tr.obj[tr.chiave]; o.da = v.da; o.a = v.a; o.k = v.k; }
    return v;
  }

  // ---- uniform condivise: una {value} per ogni chiave numerica di STATO, più quelle di sistema
  const U = {};
  for (const [k, v] of Object.entries(STATO)) if (typeof v === 'number') U[k] = { value: v };
  U.uV = { value: STATO.uV };                                      // stesso array: float uV[5]
  Object.assign(U, {
    uTempo: { value: 0 },                                          // secondi (orologio di scena)
    uTempoIdro: { value: 0 },                                      // ∫ tempoScala·dt (getti, spruzzi, giranti)
    uPx: { value: 1 },                                             // dprNativo × scala (spessori in px CSS)
    uRisoluzione: { value: new THREE.Vector2(1, 1) },              // px del buffer interno
    uSoleDir: { value: new THREE.Vector3(0, 1, 0) },               // versore verso il sole (scritto da luce/sole.js)
    uColoreSole: { value: new THREE.Color(1, 1, 1) },
    uAngoloFV: { value: 0 }, uAngoloAgri: { value: 0 },            // radianti, rotazione attorno a z (§6.6)
    uSitoC: { value: new THREE.Vector3(...cfg.SITO_C) },
  });
  const chiaviNumeriche = Object.keys(STATO).filter(k => typeof STATO[k] === 'number' && U[k]);

  const _dir = [0, 1, 0], _rgb = [1, 1, 1];
  /**
   * Aggiorna STATO e U al tempo di storia T.
   * @param {number} T tempo di scroll (0..19) @param {number} t secondi @param {number} dt secondi
   * @param {{riduci?:boolean}} opz
   */
  function aggiorna(T, t = 0, dt = 0, opz = {}) {
    for (const tr of tracce) valutaTraccia(tr, T);
    STATO.T = T; STATO.t = t; STATO.dt = dt; STATO.tappa = tappaDi(T); STATO.mondo = mondoDi(T);

    // ---- sole: tracce (soleAuto 0), funzione dell'ora (1), colore da luceSole (2)
    let modo = STATO.soleAuto;
    let ora = STATO.ora;
    if (opz.riduci && T >= 7.60 && T < 11.50) { modo = 1; ora = STATO.ora = cfg.SOLE.oraRiduci; }   // §6.11: sole fisso alle 10:00 (anche l'ORA dell'HUD)
    const sole = STATO.sole;
    if (modo === 1) {
      const p = posizioneSole(ora); sole.el = p.el; sole.az = p.az;
      coloreSole(p.el, _rgb); sole.col.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.LinearSRGBColorSpace);
      sole.int = intensitaSole(p.el);
    } else if (modo === 2) {
      coloreSole(sole.el, _rgb); sole.col.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.LinearSRGBColorSpace);
    }
    direzioneSole(sole.el, sole.az, _dir); STATO.soleDir[0] = _dir[0]; STATO.soleDir[1] = _dir[1]; STATO.soleDir[2] = _dir[2];

    // ---- tracker (stessa funzione dell'HUD: §4.4)
    const fv = angoloTracker(sole.el, sole.az, cfg.LAYOUT.fv.gcr), ag = angoloTracker(sole.el, sole.az, cfg.LAYOUT.agri.gcr);
    if (STATO.trackerManuale >= 0.5) { fv.theta = ag.theta = STATO.trackerAngoloManuale; fv.stato = ag.stato = 'CANTIERE'; }
    STATO.trackerFV = fv; STATO.trackerAgri = ag;

    // ---- tempo idro (integrato: cambiare tempoScala non fa salti)
    STATO.tempoScala = Math.pow(10, STATO.tempoScalaEsp);
    STATO.tempoIdro += dt * STATO.tempoScala * (opz.riduci ? 0 : 1);

    // ---- uniform
    for (const k of chiaviNumeriche) U[k].value = STATO[k];
    U.uTempo.value = t; U.uTempoIdro.value = STATO.tempoIdro;
    U.uSoleDir.value.set(_dir[0], _dir[1], _dir[2]);
    U.uColoreSole.value.copy(sole.col);
    U.uAngoloFV.value = fv.theta * Math.PI / 180; U.uAngoloAgri.value = ag.theta * Math.PI / 180;
  }

  /** Valore di una traccia (percorso di config.TRACCE) a un T qualunque, senza scrivere STATO. */
  function valuta(percorso, T) { const tr = tracce.find(x => x.percorso === percorso); return tr ? valutaTraccia(tr, T, false) : undefined; }

  return { STATO, U, aggiorna, valuta, tracce };
}
