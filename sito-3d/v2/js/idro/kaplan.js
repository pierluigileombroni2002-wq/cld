// =============================================================================
// ERI v2 · idro/kaplan.js — turbina Kaplan procedurale (mozzo, pale orientabili, distributore, aspirazione)
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.6 (centro, Ø 4,5 m, semi-chiocciola tagliata da ZK), §6.7 Kaplan (mozzo Lathe, 5 pale a due fogli
// su perni, 24 direttrici a raggio 3,6 m alte 1,8 m, anello di scarico e cono Lathe, semi-chiocciola), §4.5 (passoKaplan,
// aperturaKaplan: doppia regolazione; V4.7; etichette), config.VALLE.giranteKaplan, config.MATERIALI.turbine / inox.
//
// La macchina come un modello da museo aperto a metà dal piano ZK (z = −1,2, sull'asse): tutto ciò che sta fermo
// (semi-chiocciola a "C", avantdistributore, coperchio cavo, anello di scarico, cono, gomito e diffusore, distributore,
// leve e anello di regolazione, generatore) è tagliato e mostra la campitura della sezione nello spessore delle pareti;
// le superfici bagnate sono smaltate nel blu dei laghi del plastico (il percorso dell'acqua si legge a colpo d'occhio);
// la girante in inox lucido resta INTERA e gira (U.uTempoIdro: ×1/8 in 4b–4d, ferma con riduci) e proietta ombra
// sul cono mentre la sala è accesa.
// Stile di casse e dettagli da MATERIALI.turbine (?turbine=inox|bianco|verniciato, materiali di valle-materiali.js con
// il piano ZK), calcestruzzo = bianco degli edifici del plastico; la girante resta SEMPRE inox.
// File privato: kaplan-forme.js (tutte le geometrie, in metri nel sistema della macchina).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'kaplan.pala', 'kaplan.distributore', 'kaplan.aspirazione';
//             pubblica ctx.dati.kaplan = { gruppo, girante }.
//  aggiorna(ctx, T, t, dt): rotazione della girante, passo delle pale, apertura delle direttrici, leve, bielle, anello.
// Tollera l'assenza di ctx.dati.valle (piano ZK e campitura di riserva).
// =============================================================================
import * as THREE from 'three';
import { VALLE, IDRO, UNITA } from '../config.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import { materialeCasse, materialeDettagli, materialeEdifici, materialeInox } from './valle-materiali.js';
import * as F from './kaplan-forme.js';

export const MONDO = 'valle';

const GK = VALLE.giranteKaplan, SC = UNITA.scalaMeccanica, FO = F.FORMA, DUE_PI = Math.PI * 2, RAD = Math.PI / 180;
const OMEGA = DUE_PI * IDRO.kaplan.rpm / 60;      // rad/s reali; a schermo × tempoScala (0,31 giri/s in 4d, sotto il limite di §6.7)
// TARATURA: proporre in config (ETICHETTE, ancore della Kaplan) — metri nel sistema della macchina:
// punto fisso sulla circonferenza delle punte verso la camera (la girante gira, l'etichetta resta ferma),
// pala direttrice a −40° (metà dietro, visibile), parete di fondo del gomito a y = −1,2 (DESIGN: "cono a y = −1,2")
const ANCORE = { pala: [1.62, 0.05, 1.36], distributore: [2.76, 2.1, -2.31], aspirazione: [0.05, -8.0, -2.95] };
// TARATURA: proporre in config (MATERIALI.turbine.canale) — superfici bagnate (chiocciola, distributore, gola, cono,
// gomito) nel blu del letto profondo dei laghi del plastico: il percorso dell'acqua si legge da solo e l'inox della
// girante stacca sul fondo colorato. Uguale nei tre stili.
const CANALE = { colore: '#5d95b0', roughness: 0.42, env: 0.8, riempimento: 0.1 };

const ASSE_Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _d = [0, 0];
let st = null;

/** Direzione (x, z) della corda della direttrice all'angolo a con apertura ap: dalla tangente del giro verso l'asse. */
function corda(a, ap, out) {
  const th = (FO.dist.chiusa + ap * FO.dist.corsa) * RAD, ca = Math.cos(a), sa = Math.sin(a);
  out[0] = -Math.cos(th) * sa - Math.sin(th) * ca;
  out[1] = Math.cos(th) * ca - Math.sin(th) * sa;
  return out;
}

/** Direttrici, leve, bielle e anello di regolazione per l'apertura ap (funzione pura di ap). */
function scriviDistributore(ap) {
  const D = FO.dist, L = FO.leva, A = FO.anello, dl = st.dirLeva;
  // anello: la spina di ogni biella sta sul cerchio rPerni, a distanza 'biella' dalla punta della leva (uguale per tutte)
  const a0 = st.angoli[0];
  corda(a0, ap, _d);
  let psi = Math.atan2(-_d[1], _d[0]);
  const ex = D.R * Math.cos(a0) + dl * L.lunga * Math.sin(psi), ez = D.R * Math.sin(a0) + dl * L.lunga * Math.cos(psi);
  const rE = Math.hypot(ex, ez), cosd = (A.rPerni * A.rPerni + rE * rE - A.biella * A.biella) / (2 * A.rPerni * rE);
  const delta = Math.atan2(ez, ex) + Math.acos(Math.min(1, Math.max(-1, cosd))) - a0;
  st.anello.rotation.y = -delta;
  for (let k = 0; k < D.n; k++) {
    const a = st.angoli[k];
    corda(a, ap, _d); psi = Math.atan2(-_d[1], _d[0]);
    _p.set(D.R * Math.cos(a), 0, D.R * Math.sin(a)); _q.setFromAxisAngle(ASSE_Y, psi); _s.set(1, 1, 1);
    _m.compose(_p, _q, _s);
    st.direttrici.setMatrixAt(k, _m); st.leve.setMatrixAt(k, _m);
    // biella: dalla punta della leva alla spina dell'anello
    const lx = _p.x + dl * L.lunga * Math.sin(psi), lz = _p.z + dl * L.lunga * Math.cos(psi);
    const dx = A.rPerni * Math.cos(a + delta) - lx, dz = A.rPerni * Math.sin(a + delta) - lz;
    _p.set(lx, 0, lz); _q.setFromAxisAngle(ASSE_Y, Math.atan2(-dz, dx)); _s.set(Math.hypot(dx, dz), 1, 1);
    _m.compose(_p, _q, _s);
    st.bielle.setMatrixAt(k, _m);
  }
  st.direttrici.instanceMatrix.needsUpdate = true; st.leve.instanceMatrix.needsUpdate = true; st.bielle.instanceMatrix.needsUpdate = true;
}

/** Costruzione (una volta). */
export async function crea(ctx) {
  // ---- piano ZK e campitura della sezione da valle.js (riserva se la valle mancasse)
  const V = ctx.dati.valle, PZ = VALLE.piani.ZK;
  const ZK = V?.piani?.ZK || new THREE.Plane(new THREE.Vector3(PZ.normale[0], PZ.normale[1], PZ.normale[2]), PZ.costante);
  const patch = V?.patchSezione || (m => { m.side = THREE.DoubleSide; return m; });
  const mat = {
    casse: materialeCasse(ctx, patch, [ZK], 'kaplan.casse'),
    dettagli: materialeDettagli(ctx, patch, [ZK]),
    cls: materialeEdifici(ctx, patch, [ZK], 'kaplan.calcestruzzo'),
    inox: V?.materiali?.inox || materialeInox(ctx),
  };
  mat.dettagli.name = 'kaplan.dettagli';
  // canale dell'acqua: smalto satinato nel blu del letto dei laghi (riempimento come i bianchi del plastico)
  const cA = new THREE.Color(CANALE.colore);
  mat.acqua = patch(nuovoMateriale(THREE.MeshStandardMaterial, {
    color: cA, roughness: CANALE.roughness, metalness: 0, envMapIntensity: CANALE.env, emissive: cA.clone().multiplyScalar(CANALE.riempimento),
    side: THREE.DoubleSide, clippingPlanes: [ZK], clipShadows: true }));
  mat.acqua.name = 'kaplan.canale';

  const gruppo = new THREE.Group(); gruppo.name = 'kaplan';
  gruppo.position.set(GK.centro[0], GK.centro[1], GK.centro[2]); gruppo.scale.setScalar(SC);
  const mesh = (g, m, nome, { ombra = true, noAO = true, padre = gruppo } = {}) => {
    const o = new THREE.Mesh(g, m); o.name = nome; o.castShadow = ombra; o.receiveShadow = true; o.userData.noAO = noAO;
    padre.add(o); return o;
  };

  // ---- parti ferme, tagliate da ZK (involucri: niente AO); le superfici bagnate a parte, nel colore dell'acqua
  const ch = F.geometriaChiocciola(), go = F.geometriaGomito(), co = F.geometriaCoperchio(), sc = F.geometriaScarico();
  mesh(F.unisci([ch.cls, F.geometriaAvantdistributore(), go.cls]), mat.cls, 'kaplan.calcestruzzo');
  mesh(F.unisci([co.casse, sc.casse, F.geometriaGeneratore()]), mat.casse, 'kaplan.casse');
  mesh(F.unisci([F.geometriaNervature(), F.geometriaRotore()]), mat.dettagli, 'kaplan.dettagli');
  mesh(F.unisci([ch.acqua, go.acqua, co.acqua, sc.acqua]), mat.acqua, 'kaplan.canale');

  // ---- girante intera in inox (proietta ombra: aggiorna() chiede la mappa mentre gira nella sala accesa)
  const girante = new THREE.Group(); girante.name = 'kaplan.girante'; gruppo.add(girante);
  mesh(F.unisci([F.geometriaMozzo(), F.geometriaAlbero()]), mat.inox, 'kaplan.mozzo', { noAO: false, padre: girante });
  const gPala = F.unisci([F.geometriaPala(), F.geometriaBorchia()]);
  const perni = [];
  for (let k = 0; k < FO.nPale; k++) {
    const p = new THREE.Group(); p.name = `kaplan.perno.${k}`;
    p.rotation.order = 'YXZ'; p.rotation.y = -k / FO.nPale * DUE_PI;     // prima il passo (x), poi la posizione (y)
    girante.add(p); perni.push(p);
    mesh(gPala, mat.inox, `kaplan.pala.${k}`, { noAO: false, padre: p });
  }

  // ---- distributore e regolazione: istanze (matrici scritte solo quando cambia l'apertura)
  const D = FO.dist, angoli = new Float32Array(D.n);
  for (let k = 0; k < D.n; k++) angoli[k] = (k + 0.5) / D.n * DUE_PI;    // nessuna direttrice proprio sul taglio
  // verso della leva: in fuori a distributore chiuso (uguale per tutte, per simmetria)
  corda(angoli[0], 0, _d);
  const psi0 = Math.atan2(-_d[1], _d[0]);
  const dirLeva = Math.sin(psi0) * Math.cos(angoli[0]) + Math.cos(psi0) * Math.sin(angoli[0]) >= 0 ? 1 : -1;
  const istanze = (g, m, nome) => {
    const o = new THREE.InstancedMesh(g, m, D.n); o.name = nome; o.castShadow = true; o.receiveShadow = true;
    o.userData.noAO = true; o.frustumCulled = false; gruppo.add(o); return o;
  };
  const direttrici = istanze(F.geometriaDirettrice(), mat.casse, 'kaplan.direttrici');
  const leve = istanze(F.geometriaLeva(dirLeva), mat.dettagli, 'kaplan.leve');
  const bielle = istanze(F.geometriaBiella(), mat.dettagli, 'kaplan.bielle');
  const anello = mesh(F.geometriaAnello(), mat.dettagli, 'kaplan.anello');

  ctx.scene.valle.add(gruppo);

  // ---- ancore (punti fissi del mondo) e dati pubblicati
  const mondo = ([x, y, z]) => new THREE.Vector3(GK.centro[0] + x * SC, GK.centro[1] + y * SC, GK.centro[2] + z * SC);
  ctx.ancore.set('kaplan.pala', mondo(ANCORE.pala));
  ctx.ancore.set('kaplan.distributore', mondo(ANCORE.distributore));
  ctx.ancore.set('kaplan.aspirazione', mondo(ANCORE.aspirazione));
  ctx.dati.kaplan = { gruppo, girante };

  st = { girante, perni, direttrici, leve, bielle, anello, angoli, dirLeva, passo: NaN, apertura: NaN };
  aggiorna(ctx);
}

/** Ogni fotogramma (solo nella VALLE): solo trasformazioni e matrici d'istanza, nessuna allocazione. */
export function aggiorna(ctx /*, T, t, dt */) {
  if (!st) return;
  const S = ctx.STATO;
  // girante: angolo = ω · tempo idro (funzione pura; il tempo idro non avanza con riduci → girante ferma)
  const ang = -((OMEGA * (ctx.U.uTempoIdro?.value || 0)) % DUE_PI);
  if (ang !== st.girante.rotation.y) {
    st.girante.rotation.y = ang;
    // ombre delle pale che girano: solo con la sala Kaplan accesa (rectSala 2), altrove la mappa resta ferma
    if (S.rectSala > 1.5 && S.rectInt > 0) ctx.ombre?.richiedi?.();
  }
  // pale orientabili: passo attorno all'asse radiale del perno (+ apre verso l'asse, − chiude verso il piano)
  if (S.passoKaplan !== st.passo) {
    st.passo = S.passoKaplan;
    const r = -(Number.isFinite(st.passo) ? st.passo : 0) * RAD;
    for (let i = 0; i < st.perni.length; i++) st.perni[i].rotation.x = r;
  }
  // distributore: direttrici, leve, bielle e anello di regolazione (doppia regolazione con le pale)
  if (S.aperturaKaplan !== st.apertura) {
    st.apertura = S.aperturaKaplan;
    scriviDistributore(Number.isFinite(st.apertura) ? st.apertura : 0);
  }
}
