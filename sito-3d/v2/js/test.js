// =============================================================================
// ERI v2 · test.js — modalità ?test=1 e ?debug=1: prove automatiche, pannello, mondo di prova, carta grigia
// Proprietario: [BASE-REGIA].
// Specifica: DESIGN §6.13 (pannello: ms, fps, chiamate, triangoli, programmi, livello, scala, T, keyframe;
// carta grigia 18 %; freccia verso azHDRI; ← → tra le soste; prove automatiche: zero errori, programmi
// stabili, centro non vuoto, oro in K1.1/K2.2/K6.0, riflessi in K3.5 ≥ 0,5 %, contrasto ≥ 4,5:1),
// §6.9 punto 4 (programmi stabili), Appendice C (composizione ±0,03), ARCHITETTURA §14 e §17.
//
// window.__eri (main.js) viene ESTESO, mai ridefinito:
//   soste()                 → [{id, mondo, t0, t1, T}] keyframe non 'via' con T centrale
//   composizione(aspetto?)  → verifica di Appendice C con la posa pura del rig (indipendente dalla finestra)
//   contrasto(id)           → {rapporto, testo, fondo, elemento} misurato sui pixel sotto la battuta
//   sonde()                 → {centro, deviazione, luce, oro, riflessiCampo} sui pixel correnti della tela
//   prove(opz?)             → Promise<{ok, voci:[{nome, ok, valore, atteso}]}>  (anche con ?prove=1)
// ?debug=1: pannello in alto a destra; tasti ← → soste, G mondo di prova (auto se il mondo non è
// costruito), C carta grigia 18 % e freccia verso azHDRI.
// Il mondo di prova e la carta esistono SOLO con ?debug=1 e si creano in crea() (prima del warm-up).
// =============================================================================
import * as THREE from 'three';
import { CAMERA, BATTUTE, SITO_C, AGRI_C, PIANURA, VALLE, LAYOUT, PALETTE, COLONNA } from './config.js';
import { altezza, fiumeX, acqua, hValle, fondoValle, direzioneSole, clamp, rad } from './geo.js';
import { nuovoMateriale } from './luce/nebbia.js';

export const MONDO = 'ui';

// ---------------------------------------------------------------- dati di verifica (Appendice C, proiezione 16:9)
// Punti dei soggetti ricostruiti dalle tabelle di §3–§4 (verificati con la posa normativa, scarto ≤ 0,02).
const hS = (x, z, d = 0) => [x, altezza(x, z) + d, z];
const COMPOSIZIONE = [
  { k: 'K0.0', s: [['fiume z=0', [fiumeX(0), acqua(0), 0], [0.50, 0.58]], ['sito', SITO_C, [0.51, 0.34]]] },
  { k: 'K0.1', s: [['sito', SITO_C, [0.62, 0.55]], ['CP', hS(128, -56), [0.81, 0.40]]] },
  // K1.0 è un passaggio ('via'): il rig passa esattamente per il nodo quando il tempo distorto vale 2,45, cioè a T ≈ 2,5077
  { k: 'K1.0', T: 2.5077, s: [['paesaggistico', hS(-112, 18), [0.73, 0.43]], ['archeologico', hS(-20, -52), [0.61, 0.72]], ['sito', SITO_C, [0.44, 0.58]]] },
  { k: 'K1.1', s: [['paesaggistico', hS(-112, 18), [0.69, 0.35]], ['archeologico', hS(-20, -52), [0.69, 0.66]], ['sito', SITO_C, [0.50, 0.61]]] },
  { k: 'K1.2', s: [['sito', SITO_C, [0.66, 0.55]], ['P.lle 117–118', hS(26.35, 14.6), [0.56, 0.52]], ['sopralluogo', hS(33.4, -5.5), [0.72, 0.72]]] },
  { k: 'K1.3', s: [['sito', SITO_C, [0.66, 0.52]], ['punto di connessione', hS(40.5, -12.5), [0.86, 0.82]]] },
  { k: 'K2.0', s: [['sito', SITO_C, [0.44, 0.50]], ['CP', hS(128, -56), [0.89, 0.51]]] },
  { k: 'K2.1', s: [['cabina di consegna', hS(41.2, -11.5), [0.42, 0.59]], ['cavo', hS(84, -35), [0.66, 0.51]], ['CP', hS(128, -56), [0.87, 0.47]]] },
  { k: 'K2.2', s: [['sito e sigillo', SITO_C, [0.64, 0.50]]] },
  { k: 'K3.0', T: 7.75, s: [['sito', SITO_C, [0.59, 0.58]], ['sole', { sole: true }, [0.93, 0.28]]] },
  { k: 'K3.1', s: [['motoriduttore', [20.2, 1.36, 10.64], [0.62, 0.56]]] },
  { k: 'K3.3', s: [['centro del campo', [21.7, 1.36, 5.4], [0.63, 0.51]]] },
  { k: 'K3.5', s: [['centro del campo', [21.7, 1.36, 5.4], [0.60, 0.55]]] },
  { k: 'K3.7', s: [['fondo del vicolo', [84.78, 1.25, 23], [0.60, 0.56]]] },
  { k: 'K5.2', s: [['14-B', [10.0, 1.6, 2.12], [0.55, 0.62]], ['piastra', [24, 7.2, 2], [0.73, 0.66]], ['capannone', [-12, 1.9, -18], [0.63, 0.33]]] },
  { k: 'K6.0', s: [['FV', [SITO_C[0], SITO_C[1] + 0.6, SITO_C[2]], [0.75, 0.64]], ['agrivoltaico', [AGRI_C[0], AGRI_C[1] + 0.8, AGRI_C[2]], [0.85, 0.78]],
                   ['traversa', [-77.5, 0.9, -100], [0.80, 0.55]], ['sole', { sole: true }, [0.65, 0.35]]] },
  { k: 'V4.0', s: [['righello (x −236)', [-236, 0, 0], [0.38, null]], ['estremo est (x 230)', [230, 2, 0], [0.96, null]]] },
  { k: 'V4.8', T: 15.19, s: [['centro del diagramma', [-10, 32, 60], [0.66, null]]] },
];
const TOLLERANZA = 0.03;
const ORO_IN = ['K1.1', 'K2.2', 'K6.0'];

// ---------------------------------------------------------------- utilità colore
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminanza = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
let _pixel = null;                    // tela 1×1 per i colori CSS non rgb (oklab, color-mix…)
/** [r, g, b] 0..255 da '#rrggbb', dal primo 'rgb(a)(…)' della stringa (anche dentro un gradiente), da
 *  'color(srgb r g b)' (lo restituisce getComputedStyle con color-mix) o, in ultimo, da qualunque colore CSS. */
function rgbDi(s, riserva = [255, 255, 255]) {
  if (typeof s !== 'string') return riserva;
  const ok = v => v.length === 3 && v.every(Number.isFinite);
  const h = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) { const v = m[1].split(',').slice(0, 3).map(x => parseFloat(x)); return ok(v) ? v : riserva; }
  const c = /color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)/i.exec(s);
  if (c) { const v = [c[1], c[2], c[3]].map(x => clamp(parseFloat(x), 0, 1) * 255); return ok(v) ? v : riserva; }
  if (/gradient|var\(/i.test(s) || typeof document === 'undefined') return riserva;
  try {
    const g = (_pixel ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true }));
    g.fillStyle = '#010203'; g.fillStyle = s; if (g.fillStyle === '#010203') return riserva;   // colore non valido
    g.clearRect(0, 0, 1, 1); g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return d[3] ? [d[0], d[1], d[2]] : riserva;
  } catch { return riserva; }
}
const rgbCss = s => rgbDi(s);
// colore del fondo (clear color, velo pieno): tema chiaro, PALETTE.fondo
const FONDO = () => rgbDi(PALETTE.fondo || PALETTE.nero, [0, 0, 0]);

export async function crea(ctx) {
  const E = window.__eri || (window.__eri = {});
  const soste = () => ctx.rig?.soste ? ctx.rig.soste() : CAMERA.filter(k => !k.via).map(k => ({ id: k.id, mondo: k.mondo, t0: k.t0, t1: k.t1, T: (k.t0 + k.t1) / 2 }));
  let contestiPersi = 0;
  ctx.canvas?.addEventListener('webglcontextlost', () => contestiPersi++);

  // ---- pixel della tela (richiede preserveDrawingBuffer: vero con ?test=1)
  const tela2d = document.createElement('canvas');
  function leggiTela() {
    const c = ctx.canvas; if (!c || !c.width) return null;
    tela2d.width = c.width; tela2d.height = c.height;
    const g = tela2d.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, 0, 0);
    return { dati: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, sx: c.width / ctx.vista.w, sy: c.height / ctx.vista.h };
  }

  /** Verifica dell'Appendice C con la posa pura del rig (aspetto 16:9 di default). */
  function composizione(aspetto = 16 / 9) {
    const cam = new THREE.PerspectiveCamera(37.8, aspetto, 0.1, 5000); cam.rotation.order = 'YXZ';
    const v = new THREE.Vector3(), out = [];
    for (const voce of COMPOSIZIONE) {
      const k = CAMERA.find(c => c.id === voce.k); if (!k || !ctx.rig) continue;
      const Tk = voce.T ?? k.t0, p = ctx.rig.posa(Tk);
      cam.position.set(...p.posizione); cam.rotation.set(-rad(p.phi), -rad(p.psi), 0, 'YXZ');
      cam.fov = p.fov; cam.near = p.vicino; cam.far = p.lontano; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      for (const [nome, P, att] of voce.s) {
        if (P.sole) {
          const el = ctx.stato.valuta('sole.el', Tk) ?? 0, az = ctx.stato.valuta('sole.az', Tk) ?? 0;
          const d = direzioneSole(el, az); v.set(cam.position.x + d[0] * 1000, cam.position.y + d[1] * 1000, cam.position.z + d[2] * 1000);
        } else v.set(P[0], P[1], P[2]);
        v.project(cam);
        const sx = v.x * 0.5 + 0.5, sy = -v.y * 0.5 + 0.5;
        const err = Math.max(Math.abs(sx - att[0]), att[1] == null ? 0 : Math.abs(sy - att[1]));
        out.push({ keyframe: voce.k, soggetto: nome, sx: +sx.toFixed(3), sy: +sy.toFixed(3), atteso: att, ok: err <= TOLLERANZA });
      }
    }
    return out;
  }

  /** Contrasto del testo di una battuta sui pixel correnti (scrim e velo composti come nel CSS). */
  function contrasto(id) {
    const art = document.querySelector(`.battuta[data-battuta="${id}"]`); if (!art) return null;
    const tela = leggiTela(); if (!tela) return null;
    const scrimEl = document.querySelector('.scrim');
    const aScrim = scrimEl ? +getComputedStyle(scrimEl).opacity || 0 : 0;
    const piccolo = matchMedia('(max-width: 899px)').matches;
    const alfaScrim = (x, y) => {
      // stesse fermate del CSS (config.COLONNA.scrimFermate / scrimPiccoloFermate), interpolate in lineare
      const f = piccolo ? 1 - y / ctx.vista.h : x / ctx.vista.w, F = piccolo ? COLONNA.scrimPiccoloFermate : COLONNA.scrimFermate;
      for (let i = 1; i < F.length; i++) if (f <= F[i][0]) return aScrim * (F[i - 1][1] + (F[i][1] - F[i - 1][1]) * (f - F[i - 1][0]) / (F[i][0] - F[i - 1][0]));
      return 0;
    };
    // velo pieno = colore del fondo; velo .scrim = il colore del suo gradiente (config.COLONNA), riserva il fondo
    const velo = ctx.velo || 0, N = FONDO(), Sc = rgbDi(piccolo ? COLONNA.scrimPiccolo : COLONNA.scrim, N);
    let peggiore = null;
    for (const el of art.querySelectorAll('h1, h2, em, .testo, .occhiello, .dato')) {
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const [tr, tg, tb] = rgbCss(cs.color); const Lt = luminanza(tr, tg, tb);
      const fondi = [];
      for (const r of el.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        const passo = Math.max(2, Math.round(Math.min(r.width, r.height) / 12));
        for (let y = r.top; y < r.bottom; y += passo) for (let x = r.left; x < r.right; x += passo) {
          const px = Math.floor(x * tela.sx), py = Math.floor(y * tela.sy); if (px < 0 || py < 0 || px >= tela.w || py >= tela.h) continue;
          const i = (py * tela.w + px) * 4; let R = tela.dati[i], G = tela.dati[i + 1], B = tela.dati[i + 2];
          R = R * (1 - velo) + N[0] * velo; G = G * (1 - velo) + N[1] * velo; B = B * (1 - velo) + N[2] * velo;
          const a = alfaScrim(x, y); R = R * (1 - a) + Sc[0] * a; G = G * (1 - a) + Sc[1] * a; B = B * (1 - a) + Sc[2] * a;
          fondi.push(luminanza(R, G, B));
        }
      }
      if (!fondi.length) continue;
      fondi.sort((p, q) => p - q);
      // testo scuro su chiaro: conta il fondo più scuro (5° percentile); testo chiaro: il più chiaro (95°). Il peggiore.
      const rap = L => (Math.max(Lt, L) + 0.05) / (Math.min(Lt, L) + 0.05);
      const L05 = fondi[Math.floor(0.05 * (fondi.length - 1))], L95 = fondi[Math.floor(0.95 * (fondi.length - 1))];
      const Lf = rap(L05) <= rap(L95) ? L05 : L95, rapporto = rap(Lf);
      if (!peggiore || rapporto < peggiore.rapporto) peggiore = { rapporto: +rapporto.toFixed(2), testo: +Lt.toFixed(3), fondo: +Lf.toFixed(4), elemento: el.className || el.tagName.toLowerCase() };
    }
    return peggiore;
  }

  /** Sonde sui pixel correnti: centro non vuoto, frazione d'oro-inchiostro, riflessi nel campo FV proiettato. */
  function sonde() {
    const tela = leggiTela(); if (!tela) return null;
    const { dati, w, h } = tela;
    // centro (5×5 px): luminanza massima (non nero) e distanza massima dal colore del fondo (0..1, RGB euclideo)
    const F = FONDO(), c = ((h >> 1) * w + (w >> 1)) * 4;
    let lc = 0, dc = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = c + (dy * w + dx) * 4, R = dati[i], G = dati[i + 1], B = dati[i + 2];
      lc = Math.max(lc, luminanza(R, G, B)); dc = Math.max(dc, Math.hypot(R - F[0], G - F[1], B - F[2]) / 441.67);
    }
    // deviazione: scarto quadratico della luminanza su una griglia 15×15 nel 10 % centrale (una tela vuota è uniforme)
    let s1 = 0, s2 = 0;
    for (let gy = 0; gy < 15; gy++) for (let gx = 0; gx < 15; gx++) {
      const px = Math.floor(w * (0.45 + 0.1 * gx / 14)), py = Math.floor(h * (0.45 + 0.1 * gy / 14)), i = (py * w + px) * 4;
      const L = luminanza(dati[i], dati[i + 1], dati[i + 2]); s1 += L; s2 += L * L;
    }
    const dev = Math.sqrt(Math.max(0, s2 / 225 - (s1 / 225) ** 2));
    // oro-inchiostro su chiaro (≈ #8d5f12, #b9831f): tinta d'oro (22–50°, saturazione ≥ 0,45) E tratto sottile più
    // scuro di ciò che ha intorno (a ±3 px in orizzontale o in verticale). Le terre ocra hanno la stessa tinta ma sono
    // campiture: senza la prova del tratto conterebbero come oro.
    const lumA = j => luminanza(dati[j], dati[j + 1], dati[j + 2]), OH = 3 * 4, OV = 3 * w * 4;
    let oro = 0, n = 0;
    for (let py = 3; py < h - 3; py += 2) for (let px = 3; px < w - 3; px += 2) {
      n++;
      const i = (py * w + px) * 4, R = dati[i], G = dati[i + 1], B = dati[i + 2];
      if (!(R >= G && G >= B && R > 70 && R < 235)) continue;
      const d = R - B; if (d < 0.45 * R) continue;
      const tinta = 60 * (G - B) / d; if (tinta < 22 || tinta > 50) continue;
      const soglia = luminanza(R, G, B) * 1.25 + 0.01;
      if ((lumA(i - OH) > soglia && lumA(i + OH) > soglia) || (lumA(i - OV) > soglia && lumA(i + OV) > soglia)) oro++;
    }
    // campo FV (x 2,2–41,2; z −18,5–29,3) proiettato con la camera corrente
    const v = new THREE.Vector3(); let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (const [x, z] of [[2.2, -18.5], [41.2, -18.5], [41.2, 29.3], [2.2, 29.3]]) {
      v.set(x, 1.36, z).project(ctx.camera); const sx = v.x * 0.5 + 0.5, sy = -v.y * 0.5 + 0.5;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    x0 = clamp(x0, 0, 1); x1 = clamp(x1, 0, 1); y0 = clamp(y0, 0, 1); y1 = clamp(y1, 0, 1);
    let chiari = 0, tot = 0;
    for (let py = Math.floor(y0 * h); py < Math.floor(y1 * h); py += 2) for (let px = Math.floor(x0 * w); px < Math.floor(x1 * w); px += 2) {
      const i = (py * w + px) * 4; tot++; if (luminanza(dati[i], dati[i + 1], dati[i + 2]) > 0.9) chiari++;
    }
    return { centro: +dc.toFixed(4), deviazione: +dev.toFixed(4), luce: +lc.toFixed(4),
             oro: +(oro / Math.max(1, n)).toFixed(5), riflessiCampo: +(chiari / Math.max(1, tot)).toFixed(5) };
  }

  /** Prove automatiche di §6.13 (lente su SwiftShader: da chiamare a mano o con ?prove=1). */
  async function prove(opz = {}) {
    const esito = { ok: true, voci: [] };
    const voce = (nome, ok, valore, atteso) => { esito.voci.push({ nome, ok: !!ok, valore, atteso }); if (!ok) esito.ok = false; };
    await E.quandoPronto;
    // la VALLE deve essere pronta prima di contare i programmi (warm-up di entrambi i mondi)
    if (!ctx.valle.pronta) await new Promise(r => { const off = ctx.eventi.on('valle-pronta', () => { off(); r(); }); setTimeout(r, opz.attesaValle ?? 60000); });
    const p0 = E.info()?.programmi;
    for (const c of composizione()) voce(`composizione ${c.keyframe} · ${c.soggetto}`, c.ok, [c.sx, c.sy], c.atteso);
    const pixel = !!ctx.flags.test || opz.pixel;
    for (const s of (opz.soste || soste())) {
      await E.vaiT(s.T);
      if (!pixel) continue;
      const so = sonde(); if (!so) continue;
      // tela non vuota: non nera e (lontana dal fondo oppure non uniforme)
      voce(`centro non vuoto ${s.id}`, so.luce > 0.002 && (so.centro > 0.03 || so.deviazione > 0.003),
        { centro: so.centro, deviazione: so.deviazione, luce: so.luce }, 'luce > 0,002 e (distanza dal fondo > 0,03 o deviazione > 0,003)');
      if (ORO_IN.includes(s.id)) voce(`oro presente ${s.id}`, so.oro > 0.0005, so.oro, '> 0,05 %');
      if (s.id === 'K3.5') voce('onda di riflessi K3.5', so.riflessiCampo >= 0.005, so.riflessiCampo, '≥ 0,5 % del campo');
    }
    if (opz.contrasto !== false && pixel) {
      for (const b of BATTUTE) {
        const T = b.in == null ? 0.2 : (b.out == null ? b.in + 0.3 : Math.min(b.in + 0.16, (b.in + b.out) / 2));
        await E.vaiT(T);
        const c = contrasto(b.id);
        if (c) voce(`contrasto ${b.id}`, c.rapporto >= 4.5, c, '≥ 4,5:1 (obiettivo 7:1)');
      }
    }
    const p1 = E.info()?.programmi;
    voce('programmi stabili dopo il giro', p0 === p1, { prima: p0, dopo: p1 }, 'uguali');
    voce('moduli senza guasti', !Object.values(E.moduli()).includes('guasto'), E.moduli(), 'nessun guasto');
    voce('nessun errore', E.errori.length === 0, E.errori, '[]');
    voce('nessun webglcontextlost', contestiPersi === 0, contestiPersi, 0);
    E.esitoProve = esito;
    console.info(`[ERI prove] ${esito.ok ? 'OK' : 'NON SUPERATE'} · ${esito.voci.filter(v => v.ok).length}/${esito.voci.length}` +
      esito.voci.filter(v => !v.ok).map(v => `\n  ✗ ${v.nome}: ${JSON.stringify(v.valore)}`).join(''));
    return esito;
  }

  Object.assign(E, { soste, composizione, contrasto, sonde, prove });
  if (new URLSearchParams(location.search).get('prove') === '1') ctx.eventi.on('pronto', () => setTimeout(() => prove(), 500));

  if (!ctx.flags.debug || ctx.noWebGL || !ctx.scene) return;
  creaDebug(ctx, soste);
}

// ---------------------------------------------------------------- ?debug=1
function creaDebug(ctx, soste) {
  const { THREE: T3 } = ctx;
  const pannello = document.createElement('pre');
  pannello.className = 'pannello-debug';
  // in basso a sinistra, sotto la colonna del testo: non copre il soggetto (2/3 di destra, App. C)
  const [fr, fg, fb] = rgbDi(PALETTE.fondo || PALETTE.avorio);
  pannello.style.cssText = `position:fixed;left:8px;bottom:52px;z-index:99;margin:0;padding:6px 8px;background:rgba(${fr},${fg},${fb},.88);color:${PALETTE.inchiostro};font:10px/1.4 "IBM Plex Mono",monospace;pointer-events:none;white-space:pre;border:1px solid ${PALETTE.bordo}`;
  document.body.appendChild(pannello);

  // ---- mondo di prova (terreno analitico, griglia, soggetti di App. C) e carta grigia 18 %
  const mondoProva = { pianura: creaProvaPianura(T3), valle: creaProvaValle(T3) };
  ctx.scene.pianura.add(mondoProva.pianura); ctx.scene.valle.add(mondoProva.valle);
  const grigio = new T3.Color().setRGB(0.18, 0.18, 0.18, T3.LinearSRGBColorSpace);
  const matCarta = nuovoMateriale(T3.MeshStandardMaterial, { color: grigio, roughness: 0.9, metalness: 0, envMapIntensity: 1 });
  const gSfera = new T3.SphereGeometry(1, 48, 24), gPiano = new T3.PlaneGeometry(2.2, 2.2);
  const carte = {}, frecce = {};
  for (const n of ['pianura', 'valle']) {
    const g = new T3.Group(); g.name = 'carta-grigia';
    const s = new T3.Mesh(gSfera, matCarta); s.castShadow = s.receiveShadow = true; g.add(s);
    const p = new T3.Mesh(gPiano, matCarta); p.position.set(2.6, 0, 0); p.receiveShadow = true; g.add(p);
    g.visible = false; ctx.scene[n].add(g); carte[n] = g;
    const f = new T3.ArrowHelper(new T3.Vector3(1, 0, 0), new T3.Vector3(), 1, PALETTE.oro3d, 0.25, 0.12);
    f.line.material.fog = false; f.cone.material.fog = false; f.visible = false; ctx.scene[n].add(f); frecce[n] = f;
  }
  const stato = { prova: 'auto', carta: false, ultimo: -1, esteso: false };

  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const T = ctx.tempo.T, S = soste();
      const s = e.key === 'ArrowRight' ? S.find(x => x.T > T + 1e-3) : [...S].reverse().find(x => x.T < T - 1e-3);
      if (s) { e.preventDefault(); window.__eri.vaiT(s.T); }
    } else if (e.key === 'g' || e.key === 'G') stato.prova = stato.prova === 'auto' ? 'si' : stato.prova === 'si' ? 'no' : 'auto';
    else if (e.key === 'c' || e.key === 'C') stato.carta = !stato.carta;
    else if (e.key === 'd' || e.key === 'D') { stato.esteso = !stato.esteso; stato.ultimo = -1; }
  });
  ctx.dati.debug = { pannello, mondoProva, carte, frecce, stato };
}

const _dx = new THREE.Vector3();
export function aggiorna(ctx, T, t, dt) {
  const D = ctx.dati.debug; if (!D) return;
  const R = ctx.regia, cam = ctx.camera;
  // mondo di prova: automatico se il mondo vero non è costruito
  const costruito = { pianura: !!ctx.dati.terreno?.mesh, valle: !!(ctx.dati.valle && (ctx.dati.valle.materiali || ctx.dati.valle.piani)) };
  for (const n of ['pianura', 'valle']) D.mondoProva[n].visible = D.stato.prova === 'si' || (D.stato.prova === 'auto' && !costruito[n]);
  // carta grigia accanto al target, scala proporzionale alla distanza
  const g = D.carte[ctx.mondo], f = D.frecce[ctx.mondo];
  for (const n of ['pianura', 'valle']) { D.carte[n].visible = false; D.frecce[n].visible = false; }
  if (D.stato.carta && R && g) {
    const s = Math.max(0.02, R.d * 0.05);
    _dx.set(1, 0, 0).applyQuaternion(cam.quaternion);
    g.position.copy(R.target).addScaledVector(_dx, s * 2.2); g.scale.setScalar(s); g.visible = true;
    g.quaternion.copy(cam.quaternion);
    // azimut nel mondo del bagliore della HDRI dell'ambiente corrente (dopo la rotazione): deve indicare il sole
    const az = typeof ctx.cielo?.azAmbiente === 'number' ? ctx.cielo.azAmbiente : null;
    if (az != null) {
      f.position.copy(R.target); f.setDirection(_dx.set(Math.sin(rad(az)), 0, -Math.cos(rad(az))));
      f.setLength(s * 6, s * 1.2, s * 0.6); f.visible = true;
    }
  }
  if (t - D.stato.ultimo < 0.25 && dt > 0) return;
  D.stato.ultimo = t;
  const i = ctx.renderer?.info, q = ctx.qualita?.info?.() || {};
  const v3 = v => v ? `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}` : '-';
  const volo = R?.volo ? `volo ${R.volo.da}→${R.volo.a} ${(R.volo.e * 100).toFixed(0)}%` : (R?.inSosta ? 'sosta' : '');
  const r1 = `T ${T.toFixed(3)} · ${ctx.mondo} · ${R?.keyframe ?? '-'} ${volo}${R?.forzato ? ' · forzato ' + R.forzato : ''}`;
  const r2 = `d ${R ? R.d.toPrecision(4) : '-'} φ ${R ? R.phi.toFixed(2) : '-'} ψ ${R ? R.psi.toFixed(2) : '-'} fov ${R ? R.fov.toFixed(1) : '-'} · fps ${ctx.tempo.fps.toFixed(1)} · prog ${i?.programs?.length ?? '-'}`;
  D.pannello.textContent = !D.stato.esteso ? `${r1}\n${r2}\n← → soste · D dettagli · G prova ${D.stato.prova} · C carta` :
`${r1}
d ${R ? R.d.toFixed(3) : '-'}  φ ${R ? R.phi.toFixed(2) : '-'}°  ψ ${R ? R.psi.toFixed(2) : '-'}°  rollio ${R ? R.rollio.toFixed(2) : '-'}°
fov ${R ? R.fovBase.toFixed(1) : '-'}° → ${R ? R.fov.toFixed(1) : '-'}°  vicino ${R ? R.vicino.toPrecision(3) : '-'}  lontano ${R ? R.lontano.toFixed(0) : '-'}
target ${v3(R?.target)}
P      ${v3(cam?.position)}  ancora ${R?.ancora ?? '-'}
ombra  meta ${R ? R.meta.toPrecision(3) : '-'}  centro ${v3(R?.centroOmbra)}
fps ${ctx.tempo.fps.toFixed(1)}  ms ${(dt * 1000).toFixed(1)}  velo ${(ctx.velo ?? 0).toFixed(2)}  tappa ${ctx.STATO?.tappa ?? '-'}
chiamate ${i?.render.calls ?? '-'}  tri ${i ? (i.render.triangles / 1000).toFixed(0) + 'k' : '-'}  programmi ${i?.programs?.length ?? '-'}
qualità ${q.livello ?? '-'}  scala ${q.scala ?? ctx.pipeline?.scalaInterna ?? '-'}
← → soste · D dettagli · G prova ${D.stato.prova} · C carta ${D.stato.carta ? 'sì' : 'no'}`;
}

// ---------------------------------------------------------------- mondo di prova (solo ?debug=1)
function lineaMat(THREE_, colore) { return new THREE_.LineBasicMaterial({ color: colore, fog: false, transparent: true, opacity: 0.9, depthTest: true }); }
function polilinea(THREE_, punti, colore, chiusa = false) {
  const g = new THREE_.BufferGeometry().setFromPoints(punti.map(p => new THREE_.Vector3(p[0], p[1], p[2])));
  return chiusa ? new THREE_.LineLoop(g, lineaMat(THREE_, colore)) : new THREE_.Line(g, lineaMat(THREE_, colore));
}
function segnaposto(THREE_, p, colore, r = 0.8) {
  const m = new THREE_.Mesh(new THREE_.OctahedronGeometry(r, 0), new THREE_.MeshBasicMaterial({ color: colore, fog: false }));
  m.position.set(p[0], p[1], p[2]); return m;
}
function texturaGriglia(THREE_, lato, passo, forte) {
  const c = document.createElement('canvas'); c.width = c.height = 2048; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 2048, 2048);
  const k = 2048 / lato;
  for (let u = 0; u <= lato; u += passo) {
    const x = Math.round(u * k) + 0.5, f = (u % forte) === 0;
    g.fillStyle = f ? (PALETTE.oroLinea || PALETTE.oro) : (PALETTE.griglia || PALETTE.grigio);
    const s = f ? 3 : 1; g.fillRect(x - s / 2, 0, s, 2048); g.fillRect(0, x - s / 2, 2048, s);
  }
  const t = new THREE_.CanvasTexture(c); t.colorSpace = THREE_.SRGBColorSpace; t.anisotropy = 4; return t;
}
function creaProvaPianura(THREE_) {
  const G = new THREE_.Group(); G.name = 'prova-pianura'; G.visible = false;
  const L = PIANURA.lato, S = 160;
  const geo = new THREE_.PlaneGeometry(L, L, S, S); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  // tema chiaro: carta2 in basso → carta in alto, fiume color acqua (THREE.Color: sRGB → lineare)
  const cB = new THREE_.Color(PALETTE.carta2 || PALETTE.grafite2), cA = new THREE_.Color(PALETTE.carta || PALETTE.avorio), cF = new THREE_.Color(PALETTE.acqua), c = new THREE_.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = altezza(x, z); pos.setY(i, y - 0.03);
    const k = clamp((y + 3) / 18, 0, 1), fiume = Math.abs(x - fiumeX(z)) < 2.1;
    if (fiume) c.copy(cF); else c.lerpColors(cB, cA, k);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE_.BufferAttribute(col, 3)); geo.computeVertexNormals();
  G.add(new THREE_.Mesh(geo, new THREE_.MeshBasicMaterial({ vertexColors: true, map: texturaGriglia(THREE_, L, 10, 50), fog: false })));
  // fiume, contorni, strade, cavidotto
  const fiume = []; for (let z = -180; z <= 180; z += 3) fiume.push([fiumeX(z), acqua(z) + 0.05, z]);
  G.add(polilinea(THREE_, fiume, PALETTE.acqua));
  const sopra = (pts, d = 0.15) => pts.map(([x, z]) => [x, altezza(x, z) + d, z]);
  G.add(polilinea(THREE_, sopra(PIANURA.contornoFV), PALETTE.oroLinea || PALETTE.oro, true));
  G.add(polilinea(THREE_, sopra(PIANURA.contornoAgri), PALETTE.oroLinea || PALETTE.oro, true));
  G.add(polilinea(THREE_, sopra(PIANURA.strade.sp.punti), PALETTE.griglia || PALETTE.grigio));
  G.add(polilinea(THREE_, sopra(PIANURA.strade.poderale.punti), PALETTE.grigio));
  G.add(polilinea(THREE_, sopra(PIANURA.cavidotto.punti, 0.2), PALETTE.rame));
  // soggetti
  G.add(segnaposto(THREE_, [SITO_C[0], SITO_C[1] + 0.8, SITO_C[2]], PALETTE.oro, 1.2));
  G.add(segnaposto(THREE_, [AGRI_C[0], AGRI_C[1] + 0.8, AGRI_C[2]], PALETTE.oro, 1.0));
  G.add(segnaposto(THREE_, hS(128, -56, 1.2), PALETTE.vincolo, 1.6));
  G.add(segnaposto(THREE_, hS(41.2, -11.5, 0.4), PALETTE.oroChiaro, 0.6));
  G.add(segnaposto(THREE_, hS(-12, -18, 1), PALETTE.platino, 1.2));
  G.add(segnaposto(THREE_, [-77.5, 0.9, -100], PALETTE.acqua, 1.2));
  G.add(segnaposto(THREE_, hS(-112, 18, 0.5), PALETTE.vincolo, 1.6));
  G.add(segnaposto(THREE_, hS(-20, -52, 0.5), PALETTE.vincolo, 1.2));
  // tracker eroe e stringa 14-B (scatole sottili), vicolo agrivoltaico
  const te = PIANURA.trackerEroe, s14 = LAYOUT.stringa14B;
  const scatola = (x, z0, z1, y, colore) => { const m = new THREE_.Mesh(new THREE_.BoxGeometry(0.24, 0.04, z1 - z0), new THREE_.MeshBasicMaterial({ color: colore, fog: false })); m.position.set(x, y, (z0 + z1) / 2); return m; };
  G.add(scatola(te.x, te.z0, te.z1, te.centro[1], PALETTE.oro));
  G.add(scatola(s14.x, s14.z0, s14.z1, s14.centro[1], PALETTE.ambra));
  const vic = PIANURA.vicoloAgri;
  G.add(polilinea(THREE_, [[vic.x, 0.85, vic.z0], [vic.x, 0.85, vic.z1]], PALETTE.smeraldo));
  for (const dx of [-0.5, 0.5]) G.add(polilinea(THREE_, [[vic.x + dx, 1.25, vic.z0], [vic.x + dx, 1.25, vic.z1]], PALETTE.oro));
  return G;
}
function creaProvaValle(THREE_) {
  const G = new THREE_.Group(); G.name = 'prova-valle'; G.visible = false;
  const B = VALLE.blocco, nx = 230, nz = 30;
  const geo = new THREE_.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0, nx, nz); geo.rotateX(-Math.PI / 2);
  geo.translate((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  // plastico bianco: carta2 → carta con la quota
  const cB = new THREE_.Color(PALETTE.carta2 || PALETTE.grafite2), cA = new THREE_.Color(PALETTE.carta || PALETTE.avorio), c = new THREE_.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = hValle(x, z); pos.setY(i, y);
    c.lerpColors(cB, cA, clamp(y / 90, 0, 1)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE_.BufferAttribute(col, 3));
  G.add(new THREE_.Mesh(geo, new THREE_.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE_.DoubleSide })));
  const sezione = []; for (let x = B.x0; x <= B.x1; x += 2) sezione.push([x, fondoValle(x) + 0.05, 0.05]);
  G.add(polilinea(THREE_, sezione, PALETTE.oro));
  const r = VALLE.righello; G.add(polilinea(THREE_, [[r.x, r.y0, 0.2], [r.x, r.y1, 0.2]], PALETTE.oroLinea || PALETTE.oro));
  const cp = VALLE.condottaPelton; G.add(polilinea(THREE_, [[cp.da[0], cp.da[1], -0.2], [cp.a[0], cp.a[1], -0.2], cp.fine], PALETTE.acqua));
  G.add(segnaposto(THREE_, VALLE.girantePelton.centro, PALETTE.oro, 0.12));
  G.add(segnaposto(THREE_, VALLE.giranteFrancis.centro, PALETTE.oro, 0.12));
  G.add(segnaposto(THREE_, VALLE.giranteKaplan.centro, PALETTE.oro, 0.25));
  const dg = VALLE.diagramma, [ox, oy, oz] = dg.origine, [w, h] = dg.dim;
  G.add(polilinea(THREE_, [[ox, oy, oz], [ox + w, oy, oz], [ox + w, oy + h, oz], [ox, oy + h, oz]], PALETTE.platino, true));
  return G;
}
