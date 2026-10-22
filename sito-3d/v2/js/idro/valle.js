// =============================================================================
// ERI v2 · idro/valle.js — VALLE: plastico bianco in sezione, faccia di taglio, laghi, edifici, condotte, righello,
// piani di taglio, luci della valle.
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.6 (plastico, profilo, peli liberi, righello, parentesi, tabella degli elementi, piani di taglio),
// §2.6 (sezione), §6.7 (sezioni senza stencil: retro-facce campite), §6.4 (luci della valle), §4.5 (righello,
// parentesi, condottaEmissione, rectInt/rectSala, YF, oscura), config.VALLE, config.MATERIALI.
//
// Tema chiaro "Alba luminosa": un PLASTICO BIANCO da architetto su un foglio di carta, in una stanza chiara (cielo
// 'museale'). Superficie avorio con isoipse a inchiostro d'oro ogni 50 m (direttrici 250 m), faccia di taglio piatta
// carta2 con tratteggio oro e strati, basamento scuro con filetto d'oro, acque in resina azzurra velata, centrali
// bianche aperte dal taglio (sezione disegnata), diga ad arco, traversa a S, condotte nello stile delle macchine.
// File privati: valle-forme.js (misure pure), valle-materiali.js (GLSL e materiali), valle-plastico.js (blocco e
// acque), valle-edifici.js (centrali, diga, presa, condotte), valle-segni.js (righello, parentesi, linee).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx) (primo dei moduli VALLE; gira in idle dopo il primo fotogramma, vedi main.js):
//     pubblica SUBITO ctx.dati.valle = { piani:{Z0, ZP, YF, ZK}, patchSezione(materiale), materiali:{calcestruzzo, inox,
//     casse, sezione, dettagli}, luci:{rect:[a,b], spot} }, poi costruisce e aggiunge tutto a ctx.scene.valle.
//     - piani: THREE.Plane di config.VALLE.piani (si tiene n·p + c ≥ 0); da assegnare ALLA CREAZIONE dei materiali con
//       clipShadows: true e side: DoubleSide.
//     - patchSezione(m): le retro-facce viste attraverso il taglio diventano la campitura piatta della sezione;
//       imposta m.side = DoubleSide; tutto il materiale segue STATO.oscura (4e). Da chiamare alla creazione.
//     - materiali: calcestruzzo (bianco del plastico, Z0), casse e dettagli (stile ?turbine=, Z0), inox (giranti,
//       non tagliato), sezione (campitura piatta per facce di taglio esplicite).
//  aggiorna(ctx, T, t, dt): YF.constant = STATO.YF; luci di sala (rectInt, rectSala); righello, parentesi, segni.
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VALLE, TRACCE } from '../config.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import { fase, sostaVicina } from '../regia/stato.js';
import * as MAT from './valle-materiali.js';
import { griglia, geometriaSuperficie, geometriaTaglio, geometriaFianchi, acque, geometriaAppoggio } from './valle-plastico.js';
import { costruisciEdifici, geometriaPlafoniere } from './valle-edifici.js';
import { EDIFICI } from './valle-forme.js';
import { creaSegni, SEGNI } from './valle-segni.js';

export const MONDO = 'valle';

const SALE = ['pelton', 'francis', 'kaplan'];
const GIRANTI = { pelton: VALLE.girantePelton.centro, francis: VALLE.giranteFrancis.centro, kaplan: VALLE.giranteKaplan.centro };
// TARATURA: proporre in config (VALLE.luci.spot.sale) — controluce caldo dietro e sopra ogni macchina, verso la girante;
// fattore: quota dell'intensità di config (con il sole che entra dal taglio, 30 pieno brucia il bianco delle sale)
const SPOT = {
  pelton: [-91.15, 19.25, -2.05], francis: [-32.35, 3.12, -2.2], kaplan: [111.2, 0.5, -3.15],
  fattore: 0.6,
};
// TARATURA: plafoniere (bianco caldo, sotto la soglia del bloom) spente / accese
const PLAFONIERA = { spenta: 0.78, accesa: 2.3, tinta: [1, 0.985, 0.95] };

let st = null;

/** Costruzione (una volta). */
export async function crea(ctx) {
  const scena = ctx.scene.valle, S = ctx.STATO;

  // ---- 1. piani di taglio: creati QUI e pubblicati subito (li usano anche le macchine, alla creazione dei materiali)
  const P = VALLE.piani;
  const piano = d => new THREE.Plane(new THREE.Vector3(d.normale[0], d.normale[1], d.normale[2]), d.costante);
  const piani = { Z0: piano(P.Z0), ZP: piano(P.ZP), YF: piano(P.YF), ZK: piano(P.ZK) };
  piani.YF.constant = Number.isFinite(S.YF) ? S.YF : P.YF.costante;

  // ---- 2. materiali condivisi, patch della sezione, luci della valle (numero costante: 2 rettangolari + 1 spot)
  const UV = MAT.creaUniformValle(); MAT.aggiornaColori(ctx, UV);
  const patchSezione = MAT.creaPatchSezione(ctx, UV);
  const materiali = {
    calcestruzzo: MAT.materialeEdifici(ctx, patchSezione, [piani.Z0], 'valle.calcestruzzo'),
    inox: MAT.materialeInox(ctx, UV),
    casse: MAT.materialeCasse(ctx, patchSezione, [piani.Z0]),
    dettagli: MAT.materialeDettagli(ctx, patchSezione, [piani.Z0]),
    sezione: MAT.materialeSezione(ctx, UV, { nome: 'valle.sezione' }),
  };
  const LR = VALLE.luci.rect, LS = VALLE.luci.spot;
  const rect = [0, 1].map(i => {
    // larghezza lungo x (0,6 u), profondità lungo z (0,05 u); ruotata per illuminare verso il basso
    const l = new THREE.RectAreaLight(new THREE.Color(LR.colore), 0, LR.dim[1], LR.dim[0]);
    l.rotation.x = -Math.PI / 2; l.name = `valle.rect.${i}`;
    l.position.set(...LR.sale.pelton[i]);
    return l;
  });
  const spot = new THREE.SpotLight(new THREE.Color(LS.colore), 0, 0, LS.angolo, LS.penombra, 2);
  spot.name = 'valle.spot'; spot.castShadow = false;
  spot.position.set(...SPOT.pelton); spot.target.position.set(...GIRANTI.pelton);
  scena.add(rect[0], rect[1], spot, spot.target);
  ctx.dati.valle = { piani, patchSezione, materiali, luci: { rect, spot } };

  // ---- 3. il blocco del plastico
  const G = griglia();
  const ed = costruisciEdifici();
  const mesh = (g, m, nome, { ombra = true, ricevi = true, noAO = false } = {}) => {
    const o = new THREE.Mesh(g, m); o.name = nome; o.castShadow = ombra; o.receiveShadow = ricevi; o.userData.noAO = noAO;
    scena.add(o); return o;
  };
  mesh(geometriaSuperficie(G), MAT.materialeTerreno(ctx, UV), 'valle.superficie');
  const mSezT = MAT.materialeSezione(ctx, UV, { terreno: true, nome: 'valle.sezione.terreno' });
  mesh(mergeGeometries([geometriaTaglio(ed.curvaPelton), ...geometriaFianchi(G)], false), mSezT, 'valle.taglio', { ricevi: false, noAO: true });
  mesh(geometriaAppoggio(), MAT.materialeAppoggio(), 'valle.appoggio', { ombra: false });

  // acque: peli liberi (normal map del fiume se c'è, clonata: offset proprio) e sezioni al 22 %
  const AQ = acque();
  const base = ctx.dati.fiume?.normaleAcqua || null;
  const normale = base ? base.clone() : null;
  if (normale) { normale.wrapS = normale.wrapT = THREE.RepeatWrapping; normale.repeat.set(0.25, 0.25); normale.needsUpdate = true; }
  const peli = mesh(mergeGeometries(AQ.peli, false), MAT.materialeAcqua(ctx, UV, normale), 'valle.acqua', { ombra: false, noAO: true });
  peli.renderOrder = 2;
  mesh(mergeGeometries(AQ.sezioni, false), MAT.materialeAcquaSezione(ctx, UV), 'valle.acqua.sezione', { ombra: false, ricevi: false, noAO: true }).renderOrder = 3;

  // ---- 4. centrali, diga, traversa, presa, condotte (involucri tagliati: noAO, §6.7)
  const mEdF = MAT.materialeEdifici(ctx, patchSezione, [piani.Z0, piani.YF], 'valle.edifici.francis');
  const mPav = MAT.materialePavimento(ctx, UV, patchSezione, [piani.Z0]);
  const mCasseF = MAT.materialeCasse(ctx, patchSezione, [piani.Z0, piani.YF], 'valle.casse.francis');
  const mCapF = MAT.materialeSezione(ctx, UV, { piani: [piani.YF], nome: 'valle.sezione.francis' });
  mesh(ed.edifici, materiali.calcestruzzo, 'valle.edifici', { noAO: true });
  mesh(ed.edificiF, mEdF, 'valle.edifici.francis', { noAO: true });
  mesh(ed.diga, materiali.calcestruzzo, 'valle.diga', { noAO: true });
  mesh(ed.pavimenti, mPav, 'valle.pavimenti', { noAO: true });
  mesh(ed.condottaPelton, materiali.casse, 'valle.condotta.pelton', { noAO: true });
  mesh(ed.condottaFrancis, materiali.casse, 'valle.condotta.francis', { noAO: true });
  mesh(ed.condottaFrancisDentro, mCasseF, 'valle.condotta.francis.sala', { noAO: true });
  // sezioni disegnate delle centrali (sul taglio) e pianta della Francis (sul piano YF)
  const sx = { ombra: false, ricevi: false, noAO: true };
  mesh(ed.tagli, materiali.sezione, 'valle.sezione.centrali', sx);
  mesh(ed.tagliF, mCapF, 'valle.sezione.francis', sx);
  const piantaF = mesh(ed.piantaF, materiali.sezione, 'valle.pianta.francis', sx);
  const piantaTettoF = mesh(ed.piantaTettoF, materiali.sezione, 'valle.pianta.francis.tetto', sx);
  piantaF.visible = piantaTettoF.visible = false;

  // plafoniere lineari a filo soffitto (si accendono con le RectAreaLight della loro sala)
  const plafoniere = SALE.map(s => {
    const par = { color: 0xffffff };
    if (s === 'francis') Object.assign(par, { clippingPlanes: [piani.YF] });
    return mesh(geometriaPlafoniere(s), nuovoMateriale(THREE.MeshBasicMaterial, par), `valle.plafoniere.${s}`, sx);
  });

  // ---- 5. segni a inchiostro e testi (font già caricati dal caricatore)
  try { await ctx.carica?.font?.(); } catch { /* si disegna con il carattere di riserva */ }
  const segni = creaSegni(ctx, AQ.linee, { pelton: ed.curvaPelton, francis: ed.curvaFrancis });
  scena.add(segni.gruppo);

  st = { piani, UV, rect, spot, plafoniere, piantaF, piantaTettoF, normale, segni,
         trPar: TRACCE.parentesi?.[0] || [11.80, 11.95, 0, 1, 'expo.out'] };
}

/** Ogni fotogramma (solo nella VALLE): solo uniform, trasformazioni e visibilità. */
export function aggiorna(ctx, T /*, t, dt */) {
  if (!st) return;
  const S = ctx.STATO, U = ctx.U;

  // piano mobile della Francis e colori piatti a schermo
  st.piani.YF.constant = S.YF;
  MAT.aggiornaColori(ctx, st.UV);

  // ---- luci di sala: due strisce sopra la macchina della sala corrente (spostate quando sono a 0) + controluce
  const k = Math.min(2, Math.max(0, Math.round(S.rectSala))), sala = SALE[k], pos = VALLE.luci.rect.sale[sala];
  for (let i = 0; i < 2; i++) { st.rect[i].position.set(pos[i][0], pos[i][1], pos[i][2]); st.rect[i].intensity = S.rectInt; }
  const a = Math.max(0, S.rectInt / VALLE.luci.rect.intensita);
  const sp = SPOT[sala], gi = GIRANTI[sala];
  st.spot.position.set(sp[0], sp[1], sp[2]); st.spot.target.position.set(gi[0], gi[1], gi[2]); st.spot.target.updateMatrixWorld();
  st.spot.intensity = VALLE.luci.spot.intensita * SPOT.fattore * a;
  for (let j = 0; j < 3; j++) {
    const v = PLAFONIERA.spenta + (PLAFONIERA.accesa - PLAFONIERA.spenta) * (j === k ? Math.min(1, a) : 0), tn = PLAFONIERA.tinta;
    st.plafoniere[j].material.color.setRGB(v * tn[0], v * tn[1], v * tn[2], THREE.LinearSRGBColorSpace);
  }

  // ---- pianta della Francis sul piano YF (tetto o pareti, secondo la quota del taglio), appena sopra il piano
  const yf = S.YF, FR = EDIFICI.francis;
  st.piantaF.visible = yf < FR.soffitto && yf > FR.terra[1];
  st.piantaTettoF.visible = yf >= FR.soffitto && yf < FR.tetto;
  st.piantaF.position.y = st.piantaTettoF.position.y = yf + 0.0015;

  // ---- acqua: deriva lentissima della normal map (tempo idro: ferma con riduci, al rallentatore nel macro)
  if (st.normale) { const ti = U.uTempoIdro.value * MAT.TARATURA_MAT.acqua.deriva; st.normale.offset.set(ti, ti * 0.6); }

  // ---- segni: spessori in px CSS × uPx, velo "oscura" (4e)
  const sg = st.segni, vela = 1 - S.oscura, res = U.uRisoluzione.value, px = U.uPx.value;
  for (const r of sg.lista) { r.m.linewidth = r.px * px; r.m.resolution.copy(res); r.m.opacity = r.cop * vela; }
  sg.matC.opacity = S.condottaEmissione * vela;

  // righello: l'asta sale da 0 a 900 m, le tacche e i numeri compaiono al passaggio
  const RG = VALLE.righello, rg = sg.rg, alto = S.righello * (RG.y1 - RG.y0);
  rg.asta.visible = S.righello > 0; rg.asta.scale.y = Math.max(1e-4, alto);
  const nT = S.righello > 0 ? Math.min(rg.nTacche, Math.floor(alto / RG.passo + 1e-6) + 1) : 0;
  rg.tacche.geometry.instanceCount = nT; rg.tacche.visible = nT > 0;
  for (const s of rg.numeri) {
    const v = S.righello > 0 ? Math.min(1, Math.max(0, (RG.y0 + alto - s.userData.y) / RG.passo + 1)) : 0;
    s.material.opacity = SEGNI.testo.alfaNumeri * v * vela; s.visible = v > 0;
  }

  // parentesi dei salti, sfalsate (fase pura di T; con riduci al T della sosta, come le tracce)
  const Ts = ctx.flags.riduci ? sostaVicina(T).t1 : T, tr = st.trPar, sf = VALLE.sfalsamentoParentesi;
  for (const p of sg.par) {
    const f = fase(Ts, tr[0] + p.i * sf, tr[1] + p.i * sf, tr[4]);
    p.linea.visible = p.testo.visible = f > 0;
    p.linea.scale.y = Math.max(1e-4, f);
    p.mat.opacity = SEGNI.parentesi.copertura * vela;
    p.testo.material.opacity = Math.min(1, f * 1.4) * vela;
  }

  // testi a grandezza costante: scala = px · 2·tan(fov/2) / altezza della vista
  const kpx = 2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2) / Math.max(1, ctx.vista.h);
  for (const s of sg.sprite) s.scale.set(s.userData.px[0] * kpx, s.userData.px[1] * kpx, 1);
}
