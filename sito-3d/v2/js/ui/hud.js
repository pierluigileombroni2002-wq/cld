// =============================================================================
// ERI v2 · ui/hud.js — HUD: coordinate, quota, barra di scala, strumento di tappa, bandierina "dati illustrativi"
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.5 (barra in basso a 22 px; coordinate WGS84 del target; QUOTA della camera; barra di
// scala vera m/px = 2·d·tan(fov/2)·10/innerHeight, lunghezza più vicina a 120 px), §4.1 (scala 1:10 000 →
// 1:2 000), §4.2–4.3 (maturità con tacche, lampo a 100 %, "● RTB" dal 7,60), §4.4 (strumento solare: ORA,
// ELEVAZIONE, AZIMUT, TRACKER, stato; mini-spaccato di 3 file che ruota con l'angolo reale, raggio del sole,
// ombre grigie al 40 %; avviso di mezzogiorno), §4.5 (idro: SALTO 0–900 m con parentesi, PORTATA log
// 0,1–1 000 m³/s, POTENZA, TEMPO solo in 4b–4d), §4.6 (Gantt MESE 1 → 9 e fasi), §6.9 (PREPARAZIONE DELLA
// VALLE · %), §6.12 (schermi piccoli: solo maturità), config.HUD, config.IDRO.
//
// Regole: al massimo 15 aggiornamenti al secondo (salvo salti di T); numeri con geo.numeroIt e tabular-nums;
// TUTTI i valori del sole e dei tracker escono da STATO (stessa funzione dei tracker, §4.4): nessun numero a mano.
// Il DOM degli strumenti si costruisce una volta in crea(); in aggiorna() si scrivono solo testi e trasformazioni.
// =============================================================================
import { HUD, IDRO, LAYOUT, TAPPE } from '../config.js';
import { formatoGMS, quotaSlm, metriPerPx, numeroIt, formatoOra, clamp, posizioneSole } from '../geo.js';
import { fase } from '../regia/stato.js';

export const MONDO = 'ui';

// Barra di scala: lunghezze fini per primi piani e macro della valle (config.HUD, tarature [ARCH])
const SCALE = [...HUD.scaleFiniM, ...HUD.scaleBarraM];
const [BARRA_MIN, BARRA_MAX] = HUD.barraLimitiPx;   // px
const T_PIANO_AGRI = HUD.solare.pianoAgriT;          // dall'agrivoltaico lo strumento mostra i tracker con GCR 0,24 (§4.4 3c)
/** Testo di un avviso solare: {el} = elevazione calcolata all'ora dell'avviso (stessa funzione dell'HUD). */
const testoAvviso = av => av.testo.replace('{el}', av.ora != null ? numeroIt(posizioneSole(av.ora).el, 1) : '');

let H = null;                                  // riferimenti e cache

const fmtGradi = (v, d = 1) => (v > 0.05 ? '+' : '') + numeroIt(v, d);
function scalaTesto(L) { return L < 1 ? `${numeroIt(L * 100)} cm` : L < 1000 ? `${numeroIt(L)} m` : `${numeroIt(L / 1000)} km`; }

/** Scrive il testo solo se cambia. */
function testo(el, s) { if (el && el._t !== s) { el._t = s; el.textContent = s; } }
function stile(el, k, v) { if (el && el['_' + k] !== v) { el['_' + k] = v; el.style[k] = v; } }
function classe(el, c, si) { if (el && el['_c' + c] !== si) { el['_c' + c] = si; el.classList.toggle(c, si); } }

export async function crea(ctx) {
  const hud = document.querySelector('.hud');
  if (!hud || ctx.noWebGL) return;
  const q = s => hud.querySelector(s);
  const slot = q('.hud-strumento');
  const mat = HUD.maturita;

  slot.innerHTML = `
  <div class="strumento str-maturita">
    <div class="str-riga"><span class="str-titolo">${mat.titolo}</span><b class="mat-valore">0 %</b></div>
    <div class="mat-barra"><i class="mat-pieno"></i>${mat.tacche.map(([n, v]) => `<i class="mat-tacca" data-v="${v}" title="${n}" style="left:${v}%"></i>`).join('')}<i class="mat-lampo"></i></div>
    <div class="str-riga str-nota"><span class="mat-fase"></span></div>
  </div>
  <div class="strumento str-rtb"><span class="rtb">RTB</span><span class="str-nota">${mat.completo} · <b>titolo, connessione, terreni</b></span></div>
  <div class="strumento str-solare">
    <div class="sol-corpo">
      <svg class="sol-spaccato" viewBox="0 0 150 64" aria-hidden="true">
        <line class="suolo" x1="0" y1="56.5" x2="150" y2="56.5"/>
        <g class="ombre"></g><g class="file"></g>
        <line class="raggio" x1="0" y1="0" x2="0" y2="0"/><circle class="disco" r="2.6"/>
      </svg>
      <div class="sol-testo">
        <div class="str-riga"><span>ORA <b class="sol-ora">—</b></span><span>ELEVAZIONE <b class="sol-el">—</b></span><span>AZIMUT <b class="sol-az">—</b></span></div>
        <div class="str-riga"><span>TRACKER <b class="sol-theta">—</b></span><b class="sol-stato">—</b></div>
        <div class="str-riga str-nota"><span class="sol-nota">SIMULAZIONE · 21 GIUGNO · 42° N</span></div>
      </div>
    </div>
    <div class="sol-avviso">${testoAvviso(HUD.solare.avvisi[0])}</div>
  </div>
  <div class="strumento str-idro">
    <div class="idro-corpo">
      <div class="idro-salto">
        <div class="str-riga" style="flex-direction:column;align-items:flex-end;gap:2px"><span>SALTO</span><b class="idro-salto-v">—</b></div>
        <div class="idro-righello">
          ${[...Array(10)].map((_, i) => `<i style="bottom:${i * 100 / 9}%;width:${i % 3 === 0 ? 7 : 4}px"></i>`).join('')}
          ${[0, 300, 600, 900].map(v => `<em style="bottom:${v / 9}%">${v}</em>`).join('')}
          <span class="pieno"></span>
          ${['pelton', 'francis', 'kaplan'].map((k, i) => `<span class="parentesi" data-turbina="${k}" style="height:${Math.max(1.2, IDRO[k].H / HUD.idro.salto.max * 100)}%;left:calc(100% + ${4 + i * 5}px)"></span>`).join('')}
        </div>
      </div>
      <div class="idro-colonna">
        <div class="str-riga"><span>PORTATA</span><b class="idro-portata-v">—</b></div>
        <div class="idro-portata">${[0, 1, 2, 3, 4].map(i => `<i style="left:${i * 25}%"></i>`).join('')}<span class="pieno"></span>
          ${['pelton', 'francis', 'kaplan'].map(k => `<span class="segno" data-turbina="${k}" style="left:${(Math.log10(IDRO[k].Q) + 1) * 25}%"></span>`).join('')}</div>
        <div class="idro-scala">${HUD.idro.scala.map((v, i, a) => `<span style="left:${(i * 100 / (a.length - 1)).toFixed(2)}%">${v}</span>`).join('')}</div>
        <div class="str-riga"><b>${HUD.idro.potenza}</b><span class="idro-tempo">TEMPO <b class="idro-tempo-v">×1</b></span></div>
        <div class="str-riga idro-legenda">${HUD.idro.legenda.join(' · ')}</div>
      </div>
    </div>
  </div>
  <div class="strumento str-gantt">
    <div class="str-riga"><span class="str-titolo">CANTIERE</span><span>MESE <b class="gantt-mese">1</b> / ${HUD.gantt.mesi}</span></div>
    <div class="gantt">
      ${HUD.gantt.fasi.map(f => `<span class="gantt-nome">${f.nome}</span><span class="gantt-pista"><i class="gantt-barra"></i></span>`).join('')}
      <span></span><span class="gantt-assi">${[...Array(HUD.gantt.mesi)].map((_, i) => `<span style="left:${((i + 0.5) * 100 / HUD.gantt.mesi).toFixed(2)}%">${i + 1}</span>`).join('')}</span>
    </div>
    <div class="str-riga str-nota gantt-fine" style="opacity:0">${HUD.gantt.fine}</div>
  </div>
  <div class="strumento str-attesa"><span class="hud-attesa"></span></div>`;

  const S = {
    hud, ctx,
    coord: q('.hud-coordinate'), quota: q('.hud-quota b'), quotaRiga: q('.hud-quota'),
    barra: q('.hud-barra'), barraTesto: q('.hud-barra-testo'), rapporto: q('.hud-rapporto'),
    strumenti: {}, attivo: null,
    matValore: q('.mat-valore'), matPieno: q('.mat-pieno'), matFase: q('.mat-fase'), matLampo: q('.mat-lampo'),
    tacche: [...hud.querySelectorAll('.mat-tacca')].map(el => ({ el, v: +el.dataset.v, nome: el.title })),
    sol: { ora: q('.sol-ora'), el: q('.sol-el'), az: q('.sol-az'), theta: q('.sol-theta'), stato: q('.sol-stato'), nota: q('.sol-nota'), avviso: q('.sol-avviso'),
           raggio: q('.sol-spaccato .raggio'), disco: q('.sol-spaccato .disco'), file: [], ombre: [] },
    idro: { saltoV: q('.idro-salto-v'), portataV: q('.idro-portata-v'), pienoS: q('.idro-righello .pieno'), pienoQ: q('.idro-portata .pieno'),
            parentesi: [...hud.querySelectorAll('.parentesi')], segni: [...hud.querySelectorAll('.idro-portata .segno')],
            tempo: q('.idro-tempo'), tempoV: q('.idro-tempo-v') },
    gantt: { mese: q('.gantt-mese'), barre: [...hud.querySelectorAll('.gantt-barra')], fine: q('.gantt-fine') },
    attesa: q('.hud-attesa'),
    acc: 1, Tprec: -1, alfa: -1,
  };
  for (const n of ['maturita', 'rtb', 'solare', 'idro', 'gantt', 'attesa']) S.strumenti[n] = q('.str-' + n);

  // Gantt: posizione delle barre sull'asse dei mesi (config.HUD.gantt.T)
  const G = HUD.gantt.fasi, [g0, g1] = HUD.gantt.T;
  S.gantt.def = G.map((f, i) => {
    const a = (f.T[0] - g0) / (g1 - g0), b = Math.max(a + 0.045, (f.T[1] - g0) / (g1 - g0));
    const el = S.gantt.barre[i]; el.style.left = (a * 100).toFixed(2) + '%'; el.style.width = (Math.min(1, b) - a) * 100 + '%';
    return { T0: f.T[0], T1: Math.max(f.T[1], f.T[0] + 0.03) };
  });

  // spaccato solare: 3 file (2,4 m su pali, passo 6 m), 7,5 px/m, asse a 2 m
  const NS = 'http://www.w3.org/2000/svg', sv = hud.querySelector('.sol-spaccato');
  const gF = sv.querySelector('.file'), gO = sv.querySelector('.ombre');
  const sp = HUD.solare.spaccato, pxm = 7.5;
  S.sol.geo = { pxm, suolo: 56.5, asse: 56.5 - 2 * pxm, mezza: sp.larghezzaM / 2 * pxm, x: [] };
  for (let i = 0; i < sp.file; i++) {
    const x = 75 + (i - (sp.file - 1) / 2) * sp.passoM * pxm; S.sol.geo.x.push(x);
    const palo = document.createElementNS(NS, 'line'); palo.setAttribute('class', 'palo');
    palo.setAttribute('x1', x); palo.setAttribute('x2', x); palo.setAttribute('y1', S.sol.geo.suolo); palo.setAttribute('y2', S.sol.geo.asse);
    const mod = document.createElementNS(NS, 'line'); mod.setAttribute('class', 'modulo');
    const omb = document.createElementNS(NS, 'polygon'); omb.setAttribute('class', 'ombra');
    gF.append(palo, mod); gO.append(omb);
    S.sol.file.push(mod); S.sol.ombre.push(omb);
  }
  H = S;
}

// ---------------------------------------------------------------- aggiornamento (≤ 15 Hz)
export function aggiorna(ctx, T, t, dt) {
  const S = H; if (!S || !ctx.camera || !ctx.STATO) return;
  // dissolvenza nelle sezioni HTML (§4.7)
  const alfa = 1 - clamp((ctx.veli?.sezioni || 0) / 0.35, 0, 1);
  if (Math.abs(alfa - S.alfa) > 0.01 || (alfa === 0) !== (S.alfa === 0)) { S.alfa = alfa; S.hud.style.setProperty('--hud-alfa', alfa.toFixed(3)); S.hud.style.opacity = ''; S.hud.style.visibility = alfa <= 0.001 ? 'hidden' : ''; }
  if (alfa <= 0.001) return;
  S.acc += dt;
  const salto = Math.abs(T - S.Tprec) > 0.05;
  if (S.acc < 1 / HUD.frequenzaHz && !salto && dt > 0) return;
  S.acc = 0; S.Tprec = T;

  const ST = ctx.STATO, R = ctx.regia, piccolo = ctx.flags.piccolo || innerWidth < 900;
  // ---- sinistra: coordinate, quota, barra di scala
  if (!piccolo && R?.target) {
    if (ctx.mondo === 'valle') { testo(S.coord, 'PLASTICO IN SEZIONE · SCALA VERA'); stile(S.quotaRiga, 'display', 'none'); }
    else {
      testo(S.coord, formatoGMS(R.target.x, R.target.z));
      stile(S.quotaRiga, 'display', '');
      testo(S.quota, numeroIt(Math.round(quotaSlm(ctx.camera.position.y))) + ' m');
    }
    // scala VERA (§5.5): fov verticale effettivo della camera (allargato da fovStretto sugli schermi con aspect < 1,5)
    const mpp = metriPerPx(R.d, R.fov, ctx.vista?.h ?? innerHeight);
    let best = SCALE[0], err = Infinity;
    for (const L of SCALE) { const e = Math.abs(L / mpp - HUD.scalaBarraPx); if (e < err) { err = e; best = L; } }
    const px = clamp(best / mpp, BARRA_MIN, BARRA_MAX);
    stile(S.barra, 'width', px.toFixed(0) + 'px'); testo(S.barraTesto, scalaTesto(best));
    // tappa 0: scala nominale 1:10 000 → 1:2 000 (§4.1)
    const sa = HUD.scalaApertura;
    if (T < TAPPE[0].T1 && ctx.mondo === 'pianura') {
      const k = fase(T, sa.T[0], sa.T[1]), n = Math.round((sa.da + (sa.a - sa.da) * k) / sa.passo) * sa.passo;
      testo(S.rapporto, 'SCALA 1:' + numeroIt(n));
    } else testo(S.rapporto, '');
  }

  // ---- strumento di tappa
  let voluto = null;
  const attesaValle = ctx.mondo === 'valle' && !ctx.valle?.pronta;
  if (attesaValle) voluto = 'attesa';
  else for (const s of HUD.strumenti) if (T >= s.T[0] && T < s.T[1]) { voluto = s.tipo; break; }
  if (piccolo && voluto !== 'maturita') voluto = null;           // §6.12: HUD ridotto alla sola maturità
  // schermi stretti: con la piastra 5b in scena il Gantt concluso si toglie (stesse informazioni, niente sovrapposizioni)
  if (voluto === 'gantt' && (ST.piastra || 0) > 0.05 && innerWidth < HUD.gantt.liberaPiastraPx) voluto = null;
  if (voluto !== S.attivo) {
    if (S.attivo) S.strumenti[S.attivo]?.classList.remove('attivo');
    if (voluto) S.strumenti[voluto]?.classList.add('attivo');
    S.attivo = voluto;
  }
  if (voluto === 'maturita') maturita(S, ST, T);
  else if (voluto === 'solare') solare(S, ST, T);
  else if (voluto === 'idro') idro(S, ST, T);
  else if (voluto === 'gantt') gantt(S, ST, T);
  else if (voluto === 'attesa') testo(S.attesa, HUD.idro.preparazione.replace('{p}', numeroIt(Math.round((ctx.valle?.progresso || 0) * 100))));
}

function maturita(S, ST, T) {
  const m = clamp(ST.maturita || 0, 0, 100);
  testo(S.matValore, numeroIt(Math.round(m)) + ' %');
  stile(S.matPieno, 'transform', `scaleX(${(m / 100).toFixed(4)})`);
  let fase = '';
  for (const tc of S.tacche) { const ok = m >= tc.v - 0.01; classe(tc.el, 'raggiunta', ok); if (ok) fase = tc.nome; }
  testo(S.matFase, m >= 99.99 ? HUD.maturita.completo : fase ? 'FASE · ' + fase.toUpperCase() : '');
  // lampo × 4 per 0,02 T al raggiungimento del 100 % (§4.3): funzione pura di T
  const T100 = HUD.maturita.completoT, k = (T >= T100 && T < T100 + HUD.maturita.lampoT) ? 1 - (T - T100) / HUD.maturita.lampoT : 0;
  stile(S.matLampo, 'opacity', k.toFixed(2)); stile(S.matLampo, 'transform', `scale(${(1 + k * (HUD.maturita.lampo - 1) * 0.5).toFixed(2)})`);
}

function solare(S, ST, T) {
  const agri = T >= T_PIANO_AGRI;
  const tr = agri ? ST.trackerAgri : ST.trackerFV, sole = ST.sole, Z = S.sol;
  testo(Z.ora, formatoOra(ST.ora)); testo(Z.el, numeroIt(sole.el, 1) + '°'); testo(Z.az, numeroIt(sole.az, 1) + '°');
  testo(Z.theta, fmtGradi(tr.theta) + '°'); testo(Z.stato, tr.stato);
  testo(Z.nota, `SIMULAZIONE · 21 GIUGNO · 42° N · GCR ${numeroIt(agri ? LAYOUT.agri.gcr : LAYOUT.fv.gcr, 2)}`);
  const av = HUD.solare.avvisi[0];
  classe(Z.avviso, 'visibile', T >= av.T[0] && T < av.T[1] && !S.ctx.flags.riduci);   // riduci: sole fisso alle 10:00, niente mezzogiorno
  // mini-spaccato est-ovest (est a destra): moduli ruotati di theta, raggio del sole, ombre al suolo
  const g = Z.geo, th = tr.theta * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  const el = sole.el * Math.PI / 180, az = sole.az * Math.PI / 180;
  const e = Math.sin(az) * Math.cos(el), u = Math.sin(el), n = Math.hypot(e, u) || 1, ex = e / n, uy = u / n;
  const giorno = sole.el > 0.2;
  for (let i = 0; i < g.x.length; i++) {
    const ax = g.x[i] - g.mezza * c, ay = g.asse + g.mezza * s, bx = g.x[i] + g.mezza * c, by = g.asse - g.mezza * s;
    const m = Z.file[i];
    m.setAttribute('x1', ax.toFixed(1)); m.setAttribute('y1', ay.toFixed(1)); m.setAttribute('x2', bx.toFixed(1)); m.setAttribute('y2', by.toFixed(1));
    if (giorno) {
      const k = ex / Math.max(0.02, uy);
      const agx = clamp(ax - (g.suolo - ay) * k, -400, 550), bgx = clamp(bx - (g.suolo - by) * k, -400, 550);
      Z.ombre[i].setAttribute('points', `${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} ${bgx.toFixed(1)},${g.suolo} ${agx.toFixed(1)},${g.suolo}`);
    } else Z.ombre[i].setAttribute('points', '');
  }
  const cx = g.x[1], cy = g.asse, L = 46;
  Z.raggio.setAttribute('x1', cx.toFixed(1)); Z.raggio.setAttribute('y1', cy.toFixed(1));
  Z.raggio.setAttribute('x2', (cx + ex * L).toFixed(1)); Z.raggio.setAttribute('y2', (cy - uy * L).toFixed(1));
  Z.disco.setAttribute('cx', (cx + ex * L).toFixed(1)); Z.disco.setAttribute('cy', (cy - uy * L).toFixed(1));
  stile(Z.raggio, 'opacity', giorno ? '1' : '0'); stile(Z.disco, 'opacity', giorno ? '1' : '0');
}

/** Turbina attiva per T (§4.5, config.HUD.idro.turbine): panoramica, Pelton, Francis, Kaplan, confronto. */
function turbinaDi(T) { for (const x of HUD.idro.turbine) if (T >= x.T[0] && T < x.T[1]) return x.k; return 'tutte'; }
function idro(S, ST, T) {
  const I = S.idro, k = turbinaDi(T), max = HUD.idro.salto.max;
  // SALTO: durante la discesa (12,05 → 12,80) il contatore segue la quota della camera (STATO.saltoHud)
  let H = null, Q = null;
  if (k !== 'tutte') { H = k === 'pelton' && T < HUD.idro.discesa[1] ? ST.saltoHud : IDRO[k].H; Q = IDRO[k].Q; }
  testo(I.saltoV, H == null ? '12–700 m' : numeroIt(Math.round(H)) + ' m');
  stile(I.pienoS, 'transform', `scaleY(${H == null ? 0 : clamp(H / max, 0, 1).toFixed(4)})`);
  testo(I.portataV, Q == null ? '1,6–95 m³/s' : numeroIt(Q, Q < 10 ? 1 : 0) + ' m³/s');
  stile(I.pienoQ, 'transform', `scaleX(${Q == null ? 0 : clamp((Math.log10(Q) + 1) / 4, 0, 1).toFixed(4)})`);
  for (const p of I.parentesi) classe(p, 'attiva', k === 'tutte' ? T >= HUD.idro.confrontoT : p.dataset.turbina === k);
  for (const sgn of I.segni) stile(sgn, 'opacity', (k === 'tutte' || sgn.dataset.turbina === k) ? '1' : '.25');
  // TEMPO solo in 4b–4d (tempoScala: ×1 → ×1/1000 → ×1/8)
  const [t0, t1] = HUD.idro.tempo.T, vis = T >= t0 && T < t1;
  stile(I.tempo, 'visibility', vis ? 'visible' : 'hidden');
  if (vis) { const ts = ST.tempoScala || 1; testo(I.tempoV, ts >= 0.999 ? '×1' : '×1/' + numeroIt(Math.round(1 / ts))); }
}

function gantt(S, ST, T) {
  const G = S.gantt;
  testo(G.mese, String(1 + Math.min(HUD.gantt.mesi - 1, Math.floor(clamp(ST.gantt || 0, 0, 1) * HUD.gantt.mesi))));
  for (let i = 0; i < G.def.length; i++) stile(G.barre[i], 'transform', `scaleX(${fase(T, G.def[i].T0, G.def[i].T1).toFixed(3)})`);
  stile(G.fine, 'opacity', T >= HUD.gantt.fineT ? '1' : '0');
}
