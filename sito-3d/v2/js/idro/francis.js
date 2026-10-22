// =============================================================================
// ERI v2 · idro/francis.js — turbina Francis procedurale (chiocciola, distributore, girante, aspirazione, generatore)
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.6 (centro, D1, D2, chiocciola), §6.7 Francis (corona e fascia al tornio, 15 pale, chiocciola a
// sezione decrescente, 20 + 20 pale, tubo a gomito), §4.5 (YF, apertura, etichette), App. B, config.VALLE.giranteFrancis,
// config.MATERIALI.turbine (tre stili: ?turbine=inox|bianco|verniciato) e MATERIALI.inox (girante, sempre).
// File privato: francis-forme.js (tutte le geometrie, in metri).
//
// Cosa c'è (gruppo in metri × 0,1 sul centro della girante, asse verticale):
//  - cassa e dettagli nello stile ?turbine= (materiali della valle: campitura sul retro, oscura in 4e), tagliati da Z0 e
//    dal piano mobile YF: a T 13,80 → 13,90 il piano scende e affetta generatore, coperchio e metà alta della
//    chiocciola; restano la mezza chiocciola con la parete campita, le pale fisse e direttrici in sezione, la girante;
//  - il canale dell'acqua (dentro chiocciola, tubi, anelli, aspirazione) ha un materiale proprio, "interno": tono medio
//    satinato che si scurisce con la profondità sotto il taglio, così la sezione si legge cava e non come un tubo pieno;
//  - basamenti del tubo d'ingresso nel bianco dell'edificio (materiali.calcestruzzo della valle);
//  - 20 pale direttrici istanziate, ruotate sul perno di (6° + 28° × STATO.apertura): il "diaframma" si apre;
//  - girante inox (mai oro né bronzo, satinata la corona, lucide le pale) con uno spaccato: dopo il taglio la metà verso
//    il taglio (+z) è tolta fin sotto YF (TAGLIO.sotto): mezza sezione campita di corona e fascia sul piano dell'asse e,
//    davanti, le pale curve che girano; dietro la corona resta intera;
//  - rotazione: prende velocità con l'apertura, integrata su U.uTempoIdro (ferma con riduci), limitata a
//    0,45·(2π/15) per fotogramma contro l'effetto "ruota di carro" (§6.7).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'francis.chiocciola', 'francis.distributore', 'francis.girante';
//             pubblica ctx.dati.francis = { gruppo, girante } (girante = gruppo che gira, materiale tagliato da piani
//             in coordinate mondo: chi la clona altrove le dia un materiale proprio).
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
import * as THREE from 'three';
import { VALLE, MATERIALI, IDRO, UNITA } from '../config.js';
import { ss } from '../geo.js';
import { nuovoMateriale } from '../luce/nebbia.js';
import * as MAT from './valle-materiali.js';
import { PUNTI, unisci, chiocciola, paleFisse, palaDirettrice, posaDirettrice, girante, albero, coperchio, generatore,
         aspirazione, ingresso } from './francis-forme.js';

export const MONDO = 'valle';

const GF = VALLE.giranteFrancis, SC = UNITA.scalaMeccanica, TAU = Math.PI * 2;
// TARATURA: proporre in config (VALLE.giranteFrancis.spaccato) — finestra della girante dopo il taglio YF:
// profondità sotto YF (u) e mezzo angolo del cuneo attorno a +z (gradi; 90 = mezza sezione sul piano dell'asse)
const TAGLIO = { sotto: 0.02, mezzoAngolo: 90 };
// TARATURA: proporre in config — la girante parte con il distributore (fattore = ss(a0, a1, apertura))
const AVVIO = [0.0, 0.6];
const OMEGA = IDRO.francis.rpm / 60 * TAU;                     // rad/s veri (600 giri/min)
const PASSO_MAX = IDRO.omegaMaxFattore * TAU / GF.pale;        // rad per fotogramma (anti "ruota di carro")
// TARATURA: proporre in config (MATERIALI.turbine.<stile>.interno) — il canale dell'acqua (dentro chiocciola, tubi,
// anelli del distributore, aspirazione) è un tono medio satinato, più scuro della cassa: nella sezione il vuoto si
// legge subito e l'acciaio della girante, le pale e la campitura risaltano. Non più scuro di così: le etichette 3D
// (inchiostro su alone carta) gli passano sopra e devono restare leggibili
const INTERNO = {
  inox:       { color: '#6b7377', metalness: 0.3, roughness: 0.5 },
  bianco:     { color: '#858880', metalness: 0.0, roughness: 0.6 },
  verniciato: { color: '#35606a', metalness: 0.1, roughness: 0.48 },
};
// TARATURA: proporre in config — il canale si scurisce con la profondità sotto il piano di taglio (u): il vuoto si
// legge concavo anche se la lamiera riflette (fattore in fondo, profondità di pieno effetto)
const CANALE = { fondo: 0.6, profondita: 0.07 };
// TARATURA: proporre in config (MATERIALI.inox.satinata) — seconda finitura dell'inox per corona, fascia e albero:
// il cielo della corona non diventa un disco bianco, le pale lucide brillano per contrasto
const SATINATA = { roughness: 0.34, anisotropy: 0.85 };

let st = null;

/** Canale dell'acqua (interno), nello stile corrente; più scuro dove è più profondo sotto il taglio. */
function materialeInterno(patchSez, piani) {
  const I = INTERNO[MAT.stileTurbine().nome] || INTERNO.inox, y0 = GF.centro[1];
  const patch = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFrY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvFrY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFrY;')
      .replace('#include <opaque_fragment>', `\toutgoingLight *= mix( 1.0, ${CANALE.fondo.toFixed(3)}, smoothstep( 0.0, ${CANALE.profondita.toFixed(3)}, ${y0.toFixed(3)} - vFrY ) );\n#include <opaque_fragment>`);
  };
  const m = nuovoMateriale(THREE.MeshStandardMaterial, { ...I, envMapIntensity: MATERIALI.casse.envMapIntensity,
    side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true }, { patch, chiave: 'francis.interno' });
  m.name = 'francis.interno';
  return patchSez(m);
}

/** Inox delle giranti (§2.6) tagliato dai piani dati; campitura sul retro e oscura come il resto delle macchine;
 *  riflette lo studio condiviso (acciaio da vetrina, valle-materiali.js). */
function materialeInox(ctx, patchSez, piani, intersezione, nome, finitura = null) {
  const I = MATERIALI.inox;
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, {
    color: I.color, metalness: I.metalness, roughness: I.roughness, anisotropy: I.anisotropy, envMapIntensity: I.envMapIntensity,
    ...(finitura || {}), side: THREE.DoubleSide, clippingPlanes: piani, clipIntersection: intersezione, clipShadows: true });
  m.name = nome;
  return patchSez(MAT.usaStudio(ctx, m));
}

/** Costruzione (una volta). */
export async function crea(ctx) {
  const scena = ctx.scene.valle, VA = ctx.dati.valle || null, c = GF.centro;

  // ---- piani: quelli della valle; se la valle manca, copie da config (YF lo aggiorno io)
  const piano = d => new THREE.Plane(new THREE.Vector3(d.normale[0], d.normale[1], d.normale[2]), d.costante);
  const Z0 = VA?.piani?.Z0 || piano(VALLE.piani.Z0), YF = VA?.piani?.YF || piano(VALLE.piani.YF);
  if (!VA?.piani?.YF) YF.constant = Number.isFinite(ctx.STATO.YF) ? ctx.STATO.YF : VALLE.piani.YF.costante;
  const patchSez = VA?.patchSezione || (m => { m.side = THREE.DoubleSide; return m; });
  // spaccato della girante: si toglie solo ciò che sta sopra YR E dentro il cuneo (clipIntersection)
  const b = TAGLIO.mezzoAngolo * Math.PI / 180, asse = new THREE.Vector3(c[0], 0, c[2]);
  const nA = new THREE.Vector3(Math.cos(b), 0, -Math.sin(b)), nB = new THREE.Vector3(-Math.cos(b), 0, -Math.sin(b));
  const YR = new THREE.Plane(new THREE.Vector3(0, -1, 0), YF.constant - TAGLIO.sotto);
  const PA = new THREE.Plane(nA, -nA.dot(asse)), PB = new THREE.Plane(nB, -nB.dot(asse));

  // ---- materiali: cassa e dettagli nello stile ?turbine= (stessi della condotta), inox per albero e girante
  const piani = [Z0, YF];
  const mCassa = MAT.materialeCasse(ctx, patchSez, piani, 'francis.casse');
  const mDett = MAT.materialeDettagli(ctx, patchSez, piani); mDett.name = 'francis.dettagli';
  const mInterno = materialeInterno(patchSez, piani);
  const mAlbero = materialeInox(ctx, patchSez, piani, false, 'francis.albero', SATINATA);
  const mGirante = materialeInox(ctx, patchSez, [YR, PA, PB], true, 'francis.girante');
  const mGiranteSat = materialeInox(ctx, patchSez, [YR, PA, PB], true, 'francis.girante.satinata', SATINATA);
  // basamenti: il bianco dell'edificio (se la valle non c'è, un bianco equivalente)
  const mCemento = VA?.materiali?.calcestruzzo || patchSez(nuovoMateriale(THREE.MeshStandardMaterial,
    { color: VALLE.plastico.edifici, roughness: 0.75, metalness: 0, clippingPlanes: [Z0], clipShadows: true }));

  // ---- geometrie (metri) e mesh; tutte "involucri tagliati": niente GTAO (§6.7)
  const gruppo = new THREE.Group(); gruppo.name = 'francis';
  gruppo.position.set(c[0], c[1], c[2]); gruppo.scale.setScalar(SC);
  const mesh = (g, m, nome, ombra = true) => {
    const o = new THREE.Mesh(g, m); o.name = nome; o.castShadow = ombra; o.receiveShadow = true; o.userData.noAO = true;
    return o;
  };
  const ch = chiocciola(), cop = coperchio(), gen = generatore(), asp = aspirazione(), ing = ingresso();
  gruppo.add(mesh(unisci([ch.cassa, paleFisse(), cop.cassa, gen.cassa, asp.cassa, ing.cassa]), mCassa, 'francis.cassa'));
  gruppo.add(mesh(unisci([ch.interno, asp.interno, ing.interno]), mInterno, 'francis.interno'));
  gruppo.add(mesh(unisci([cop.dettagli, gen.dettagli, asp.dettagli, ing.dettagli]), mDett, 'francis.dettagli'));
  gruppo.add(mesh(ing.cemento, mCemento, 'francis.basamenti'));

  // distributore: 20 pale direttrici (corpo e perno nella cassa, leve nei dettagli), stesse matrici d'istanza
  const pd = palaDirettrice(), N = GF.direttrici, m4 = new THREE.Matrix4();
  const corpi = new THREE.InstancedMesh(pd.corpo, mCassa, N), leve = new THREE.InstancedMesh(pd.leva, mDett, N);
  for (const [o, nome] of [[corpi, 'francis.direttrici'], [leve, 'francis.leve']]) {
    o.name = nome; o.castShadow = o.receiveShadow = true; o.userData.noAO = true;
    o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < N; k++) o.setMatrixAt(k, posaDirettrice(k, 0, m4));
    gruppo.add(o);
  }

  // girante e albero: girano insieme (niente ombra propria: sta dentro la macchina, così la mappa resta ferma)
  const rotore = new THREE.Group(); rotore.name = 'francis.rotore';
  const gi = girante();
  rotore.add(mesh(gi.satinata, mGiranteSat, 'francis.girante.corona', false), mesh(gi.lucida, mGirante, 'francis.girante.pale', false),
             mesh(albero(), mAlbero, 'francis.albero', false));
  gruppo.add(rotore);
  scena.add(gruppo);

  // ---- ancore (fisse) e dati pubblicati
  const mondo = p => new THREE.Vector3(c[0] + p[0] * SC, c[1] + p[1] * SC, c[2] + p[2] * SC);
  ctx.ancore.set('francis.chiocciola', mondo(PUNTI.chiocciola));
  ctx.ancore.set('francis.distributore', mondo(PUNTI.distributore));
  ctx.ancore.set('francis.girante', mondo(PUNTI.corona));
  ctx.dati.francis = { gruppo, girante: rotore };

  st = { YF, YR, yfProprio: !VA?.piani?.YF, corpi, leve, rotore, m4, N, ap: 0, ti: ctx.U.uTempoIdro.value, ang: 0 };
}

/** Ogni fotogramma (solo nella VALLE): piani, matrici delle pale direttrici, rotazione della girante. */
export function aggiorna(ctx /*, T, t, dt */) {
  if (!st) return;
  const S = ctx.STATO;

  // piani: YF (se è mio) e lo spaccato della girante appena sotto
  if (st.yfProprio) st.YF.constant = S.YF;
  st.YR.constant = S.YF - TAGLIO.sotto;

  // distributore: ogni pala sul proprio perno, funzione pura di STATO.apertura
  const ap = S.apertura;
  if (ap !== st.ap) {
    st.ap = ap;
    for (let k = 0; k < st.N; k++) { posaDirettrice(k, ap, st.m4); st.corpi.setMatrixAt(k, st.m4); st.leve.setMatrixAt(k, st.m4); }
    st.corpi.instanceMatrix.needsUpdate = st.leve.instanceMatrix.needsUpdate = true;
  }

  // girante: velocità vera × tempoScala (via tempo idro), che sale con l'apertura; passo limitato per fotogramma
  const ti = ctx.U.uTempoIdro.value, d = ti - st.ti;
  st.ti = ti;
  if (d > 0 && d < 0.5) {
    const om = OMEGA * ss(AVVIO[0], AVVIO[1], ap);
    st.ang = (st.ang + Math.min(om * d, PASSO_MAX)) % TAU;
    st.rotore.rotation.y = st.ang;
  }
}
