// =============================================================================
// ERI v2 · ui/finale.js — interfaccia delle tappe 5–6: archi dei fornitori, piastra dati 5b, petali del logo
// Proprietario: [FINALE]. Stato: prima versione completa di [ARCH] (solo 2D: non dipende dal mondo 3D).
// Specifica: DESIGN §4.6 (archi dei fornitori SVG 15,64 → 15,74; piastra dati 5b 16,82 → 17,00 con contatori da 0 e
// mini-curva del giorno), §4.7 (sole → petali 18,30 → 18,52: i 12 tracciati dei petali del logo ufficiale in 2D,
// colori ufficiali, centro del ventaglio (405, 388) sul sole proiettato, raggio delle punte 0,11·innerHeight, per
// coppia tratto in 0,04 T poi riempimento, sfalsate di 0,025 T da sinistra a destra), §5.2 (classi .petalo),
// §2.8 (il logo non si ricolora, non si estrude, non ruota mai), config.PRODUZIONE, config.PETALI, App. A.
//
// Tutto è funzione pura di T (e di STATO): scroll all'indietro e vaiT corretti per costruzione.
// I petali si clonano dal logo ufficiale già in linea nel preloader (nessuna richiesta di rete); la posizione della
// piastra la decide ui/etichette.js (tipo 'piastra'), qui si scrive solo il contenuto.
//
// Contratto (ARCHITETTURA §6): crea(ctx), aggiorna(ctx, T, t, dt). Proiezioni con ctx.proietta(). Niente
// allocazioni nel ciclo: buffer e oggetti creati in crea(); il DOM si scrive solo quando un valore cambia.
// =============================================================================
import { PRODUZIONE, PETALI, INTRO, LAYOUT, PIANURA, TRACCE } from '../config.js';
import { posizioneSole, angoloTracker, direzioneSole, altezza, numeroIt, clamp, rad } from '../geo.js';
import { ease, fase } from '../regia/stato.js';

export const MONDO = 'ui';

const NS = 'http://www.w3.org/2000/svg';
const expoOut = ease('expo.out');

// [ARCH] archi dei fornitori: da tre punti sui bordi del quadro (frazioni di larghezza/altezza; mai dalla colonna
// del testo, a sinistra) al cancello proiettato; svaniscono subito dopo il disegno.
const ARCHI_DA = [[0.50, -0.02], [0.70, -0.02], [0.58, 1.02]];
const ARCHI_CURVA = 0.22;                    // freccia della curva, frazione della corda
const tracciaArchi = TRACCE.archi?.[0] || [15.64, 15.74];
const ARCHI_VIA = [tracciaArchi[1] + 0.02, tracciaArchi[1] + 0.10];   // T: dissolvenza dopo il disegno
const tracciaPetali = TRACCE.petali?.[0] || [18.30, 18.52];

let F = null;

// ---------------------------------------------------------------- curva del giorno (App. A, "simulazione")
// Modello di cielo sereno: DNI di Meinel (1 353·0,7^(AM^0,678)), diffusa ∝ √sin(el); tracker monoassiale N–S con
// backtracking (stessa funzione dell'HUD e dei tracker, GCR 0,40) contro impianto fisso a 30° sud. La scala k porta il
// tracker al tetto AC di 9,0 MW alle 15:00: ne escono ≈102 MWh contro ≈73 MWh (rapporto ≈1,4, App. A) e ≈8,8 MW alle 16:00.
function irraggiamento(ora, modo, d) {
  const { el, az } = posizioneSole(ora);
  if (el <= 0) return 0;
  direzioneSole(el, az, d);
  const se = Math.sin(rad(el)), am = 1 / Math.max(0.05, se);
  const dni = 1353 * Math.pow(0.7, Math.pow(am, 0.678)), dhi = 90 * Math.sqrt(se);
  if (modo === 'tracker') {
    const th = rad(angoloTracker(el, az, LAYOUT.fv.gcr).theta);           // rotazione attorno all'asse N–S
    return dni * Math.max(0, -Math.sin(th) * d[0] + Math.cos(th) * d[1]) + dhi * (1 + Math.cos(th)) / 2;
  }
  const i = rad(30);
  return dni * Math.max(0, Math.cos(i) * d[1] + Math.sin(i) * d[2]) + dhi * (1 + Math.cos(i)) / 2;
}
/** Punti della mini-curva in coordinate del viewBox (w × h). */
function curve(w, h, pad) {
  const C = PRODUZIONE.curva, d = [0, 0, 0];
  const k = C.tetto / irraggiamento(15, 'tracker', d);
  const h0 = 5, h1 = 21, N = 128, X = o => pad + (o - h0) / (h1 - h0) * (w - 2 * pad), Y = p => h - pad - p / (C.tetto * 1.08) * (h - 2 * pad);
  const linea = (modo, da, a) => {
    let s = '';
    for (let i = 0; i <= N; i++) {
      const o = da + (a - da) * i / N, p = Math.min(C.tetto, k * irraggiamento(o, modo, d));
      s += (i ? 'L' : 'M') + X(o).toFixed(1) + ' ' + Y(p).toFixed(1);
    }
    return s;
  };
  const ora = C.a;
  return {
    trackerPrima: linea('tracker', C.da, ora), trackerDopo: linea('tracker', ora, C.fine),
    fissoPrima: linea('fisso', C.da, ora), fissoDopo: linea('fisso', ora, C.fine),
    xOra: X(ora), yOra: Y(Math.min(C.tetto, k * irraggiamento(ora, 'tracker', d))), yTetto: Y(C.tetto), base: h - pad, x0: X(h0), x1: X(h1),
    tacche: [6, 9, 12, 15, 18, 21].map(o => ({ x: X(o), t: String(o).padStart(2, '0') })),
  };
}

// ---------------------------------------------------------------- crea
export async function crea(ctx) {
  if (ctx.noWebGL) return;
  const svg = document.getElementById('petali');
  F = { ctx, svg, archi: [], petali: [], gruppoPetali: null, gruppoArchi: null, piastra: null, P: { x: 0, y: 0, z: 0, davanti: false, dentro: false },
        cancello: null, sole: [0, 0, 0], ultimo: {}, visPetali: -1, visArchi: -1, s: 0, archiVisibili: false };
  ctx.dati.finale = F;                             // archiVisibili: ui/indice.js attenua l'indice (il cancello cade sotto)

  if (svg) {
    // ---- archi dei fornitori
    const gA = F.gruppoArchi = document.createElementNS(NS, 'g');
    gA.setAttribute('class', 'archi-fornitori'); gA.style.opacity = '0';
    for (let i = 0; i < ARCHI_DA.length; i++) {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('pathLength', '1'); p.setAttribute('class', 'arco');
      p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1';
      gA.appendChild(p); F.archi.push({ p, d: '', off: '' });
    }
    const punto = document.createElementNS(NS, 'circle'); punto.setAttribute('class', 'arco-punto'); punto.setAttribute('r', '2.5');
    gA.appendChild(punto); F.puntoArchi = punto;
    svg.appendChild(gA);
    const [cx, cz] = PIANURA.cancello;
    F.cancello = new ctx.THREE.Vector3(cx, altezza(cx, cz) + 0.3, cz);

    // ---- petali: i 12 tracciati del logo ufficiale (stessi d, fill, stroke del logo in linea), mai ricolorati
    const sorgenti = [...document.querySelectorAll('#preloader .logo-svg .petalo')];
    if (sorgenti.length) {
      const g = F.gruppoPetali = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'petali-finale'); g.style.opacity = '0';
      for (const src of sorgenti) {
        const p = document.createElementNS(NS, 'path');
        for (const a of ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin']) if (src.hasAttribute(a)) p.setAttribute(a, src.getAttribute(a));
        p.setAttribute('pathLength', '1');
        p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1'; p.style.fillOpacity = '0';
        g.appendChild(p);
        F.petali.push({ p, coppia: +src.dataset.coppia || 0, off: '', fo: '' });
      }
      svg.appendChild(g);
    }
  }

  // ---- piastra dati 5b (contenuto; posizione e gomito: ui/etichette.js)
  const el = document.getElementById('piastra-dati');
  if (el) {
    const W = 244, H = 46, pad = 3, c = curve(W, H, pad), P = PRODUZIONE;
    el.innerHTML = `
      <p class="piastra-titolo">IMPIANTO FV · ${numeroIt(LAYOUT.fv.potenzaMWp, 1)} MWp · ORE ${String(Math.floor(P.curva.a)).padStart(2, '0')}:00</p>
      <dl class="piastra-dati">
        <div><dt>POTENZA ORA</dt><dd><b data-v="potenza">0,0</b> MW</dd></div>
        <div><dt>ENERGIA OGGI</dt><dd><b data-v="energia">0,0</b> MWh</dd></div>
        <div><dt>DISPONIBILITÀ</dt><dd><b data-v="disponibilita">0,0</b> %</dd></div>
      </dl>
      <svg class="piastra-curva" viewBox="0 0 ${W} ${H + 12}" aria-hidden="true">
        <line class="tetto" x1="${c.x0}" x2="${c.x1}" y1="${c.yTetto.toFixed(1)}" y2="${c.yTetto.toFixed(1)}"/>
        <line class="base" x1="${c.x0}" x2="${c.x1}" y1="${c.base}" y2="${c.base}"/>
        ${c.tacche.map(q => `<line class="tacca" x1="${q.x.toFixed(1)}" x2="${q.x.toFixed(1)}" y1="${c.base}" y2="${c.base + 3}"/><text x="${q.x.toFixed(1)}" y="${H + 11}">${q.t}</text>`).join('')}
        <path class="fisso" d="${c.fissoPrima}"/><path class="fisso dopo" d="${c.fissoDopo}"/>
        <path class="tracker" d="${c.trackerPrima}"/><path class="tracker dopo" d="${c.trackerDopo}"/>
        <line class="ora" x1="${c.xOra.toFixed(1)}" x2="${c.xOra.toFixed(1)}" y1="${(c.yTetto - 3).toFixed(1)}" y2="${c.base}"/>
        <circle class="adesso" cx="${c.xOra.toFixed(1)}" cy="${c.yOra.toFixed(1)}" r="2.2"/>
      </svg>
      <p class="piastra-legenda"><span class="voce-tracker">tracker</span><span class="voce-fisso">fisso 30° sud</span></p>
      <p class="piastra-nota">${P.dicitura}</p>`;
    F.piastra = { el, valori: {
      potenza: { el: el.querySelector('[data-v="potenza"]'), v: P.potenzaOraMW, d: 1, t: '' },
      energia: { el: el.querySelector('[data-v="energia"]'), v: P.energiaOggiMWh, d: 1, t: '' },
      disponibilita: { el: el.querySelector('[data-v="disponibilita"]'), v: P.disponibilita, d: 1, t: '' },
    } };
  }
}

// ---------------------------------------------------------------- aggiorna
export function aggiorna(ctx, T, t, dt) {
  if (!F) return;
  const S = ctx.STATO, inSez = !!ctx.scroll?.inSezioni;
  // le sezioni HTML coprono la storia: tutto il 2D di questo modulo svanisce con il loro velo (lo .velo sta sotto, z 2)
  const sezioni = 1 - clamp((ctx.veli?.sezioni || 0) / 0.5, 0, 1);
  archi(ctx, T, S, sezioni, inSez);
  petali(ctx, T, S, sezioni, inSez);
  piastra(S);
}

function scriviStile(o, k, v, el, prop) { if (o[k] !== v) { o[k] = v; el.style[prop] = v; } }

/** Tre archi dai bordi del quadro al cancello (procurement e contratti): disegno con STATO.archi, poi dissolvenza. */
function archi(ctx, T, S, sezioni, inSez) {
  if (!F.gruppoArchi) return;
  const k = clamp(S.archi || 0, 0, 1);
  let a = (k > 0.001 && ctx.mondo === 'pianura' && !inSez) ? (1 - fase(T, ARCHI_VIA[0], ARCHI_VIA[1])) * sezioni : 0;
  const P = F.P;
  if (a > 0.001) { ctx.proietta(F.cancello, P); if (!P.davanti) a = 0; }
  const va = a.toFixed(3);
  if (va !== F.visArchi) { F.visArchi = va; F.gruppoArchi.style.opacity = va; }
  F.archiVisibili = a > 0.05;
  if (a <= 0.001) return;
  const W = ctx.vista.w, H = ctx.vista.h, gx = P.x, gy = P.y;
  for (let i = 0; i < F.archi.length; i++) {
    const A = F.archi[i], ax = ARCHI_DA[i][0] * W, ay = ARCHI_DA[i][1] * H;
    // controllo: punto medio spostato in perpendicolare (verso l'alto), freccia proporzionale alla corda
    const mx = (ax + gx) / 2, my = (ay + gy) / 2, dx = gx - ax, dy = gy - ay, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
    const cx = mx + nx * L * ARCHI_CURVA, cy = my + ny * L * ARCHI_CURVA;
    const d = `M${ax.toFixed(1)} ${ay.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${gx.toFixed(1)} ${gy.toFixed(1)}`;
    if (d !== A.d) { A.d = d; A.p.setAttribute('d', d); }
    // sfalsati di poco: il primo arriva per primo
    const ki = clamp((k - i * 0.12) / 0.76, 0, 1);
    scriviStile(A, 'off', (1 - ki).toFixed(3), A.p, 'strokeDashoffset');
  }
  const p = F.puntoArchi;
  p.setAttribute('cx', gx.toFixed(1)); p.setAttribute('cy', gy.toFixed(1));
  scriviStile(F.ultimo, 'punto', k >= 0.999 ? '1' : '0', p, 'opacity');
}

/** Sole → petali (§4.7): ventaglio del logo ufficiale centrato sul sole proiettato; coppie da sinistra a destra. */
function petali(ctx, T, S, sezioni, inSez) {
  const g = F.gruppoPetali; if (!g) return;
  const [T0] = tracciaPetali;
  let a = (T >= T0 && ctx.mondo === 'pianura' && !inSez) ? sezioni : 0;
  const P = F.P, cam = ctx.camera?.position;
  if (a > 0.001 && cam) {
    const d = S.soleDir, o = F.sole;                 // punto lontano nella direzione del sole (buffer riusato)
    o[0] = cam.x + d[0] * 1000; o[1] = cam.y + d[1] * 1000; o[2] = cam.z + d[2] * 1000;
    ctx.proietta(o, P);
    if (!P.davanti) a = 0;
  }
  const va = a.toFixed(3);
  if (va !== F.visPetali) { F.visPetali = va; g.style.opacity = va; }
  if (a <= 0.001) return;
  // scala: raggio delle punte = 0,11·innerHeight (punta più lontana dal centro del ventaglio nel viewBox)
  const [cx, cy] = PETALI.centroVentaglio;
  if (!F.raggioVB) F.raggioVB = Math.max(...INTRO.logo.punte.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const s = PETALI.raggioPunte * innerHeight / F.raggioVB;
  const tr = `translate(${(P.x - cx * s).toFixed(2)} ${(P.y - cy * s).toFixed(2)}) scale(${s.toFixed(4)})`;
  if (tr !== F.ultimo.tr) { F.ultimo.tr = tr; g.setAttribute('transform', tr); }
  // per coppia: tratto in PETALI.tratto, poi riempimento nello stesso tempo; sfalsamento PETALI.sfalsamento
  for (const q of F.petali) {
    const t0 = T0 + q.coppia * PETALI.sfalsamento;
    const kt = expoOut(clamp((T - t0) / PETALI.tratto, 0, 1));
    const kf = expoOut(clamp((T - t0 - PETALI.tratto) / PETALI.tratto, 0, 1));
    scriviStile(q, 'off', (1 - kt).toFixed(3), q.p, 'strokeDashoffset');
    scriviStile(q, 'fo', kf.toFixed(3), q.p, 'fillOpacity');
  }
}

/** Contatori della piastra: da 0 al valore con STATO.piastra (expo.out già nella traccia). */
function piastra(S) {
  const Pz = F.piastra; if (!Pz) return;
  const k = clamp(S.piastra || 0, 0, 1);
  for (const key in Pz.valori) {
    const v = Pz.valori[key], s = numeroIt(v.v * k, v.d);
    if (s !== v.t) { v.t = s; v.el.textContent = s; }
  }
}
