// =============================================================================
// ERI v2 · idro/pelton.js — turbina Pelton procedurale (girante, cucchiai, ugelli, carter, generatore)
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §3.6 (posizioni), §6.7 Pelton (disco, 22 cucchiai con cresta e intaglio, ugelli con spina e deviatore,
// carter tagliato da ZP), §2.6 inox (MAI oro né bronzo), §4.5 (getti, tempoScala, velocità della girante limitata), App. B,
// config.VALLE.girantePelton / ugelloA / ugelloB / carterPelton / generatorePelton, config.IDRO.pelton, MATERIALI.turbine.
//
// Macchina da showroom nella sala bianca, in metri dentro un gruppo × 0,1 centrato sulla ruota (forme: pelton-forme.js):
//  - girante inox (MATERIALI.inox): disco e albero torniti satinati (anisotropia circolare), 22 cucchiai lucidi istanziati
//    (doppia conca, cresta tagliente, intaglio in punta, dorso a due lobi), ogiva lucida sul mozzo;
//  - carter ad arco tagliato da ZP sul piano della ruota: fuori nello stile ?turbine= (cassa), dentro la fodera scura
//    della stessa tinta (la ruota lucida si stacca dal fondo), filetti in rilievo (dettagli), porte dei getti;
//  - due ugelli con servomotore interno, tagliati a metà da ZP: si vedono bulbo e spina lucida che arretra (STATO.getti);
//    deviatori a forcella che escono dal getto mentre la spina apre; collettore a Y dalla condotta; generatore Ø 3,5 m
//    su piedi, con anelli e filetti; cuscinetto su piedistallo e giunto a flange.
// Rotazione: ω = min(ωreale, 0,45·(2π/22)·fps / tempoScala) per unità di tempo idro, integrata su U.uTempoIdro (ferma
// con riduci, al ralenti nel macro). Spina e deviatori: funzioni pure di STATO.getti.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra l'ancora 'pelton.cucchiaio' (cucchiaio in basso, sul punto d'impatto);
//             pubblica ctx.dati.pelton = { gruppo, girante } (la girante si clona nel diagramma 4e).
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
import * as THREE from 'three';
import { VALLE, IDRO, MATERIALI, PALETTE, UNITA } from '../config.js';
import { clamp } from '../geo.js';
import { nuovoMateriale, versoScena, esposizioneTono } from '../luce/nebbia.js';
import { fase } from '../regia/stato.js';
import * as MAT from './valle-materiali.js';
import * as FO from './pelton-forme.js';

export const MONDO = 'valle';

const TAU = Math.PI * 2;
const GP = VALLE.girantePelton, MU = UNITA.metriPerU;
const OMEGA = IDRO.pelton.rpm / 60 * TAU;                 // rad/s reali (600 giri/min)
const PASSO = TAU / GP.cucchiai;
// TARATURA: proporre in config (MATERIALI.turbine.fodera) — interno del carter e scudi del generatore: la cassa dello
// stile scurita e laccata, così la ruota lucida si stacca dal fondo su ogni stile (inox, bianco, verniciato)
const FODERA = { tinta: 0.14, roughness: 0.42, metallo: 0.6, clearcoat: 0.7, clearcoatRoughness: 0.22 };
// TARATURA: proporre in config — oltre questa distanza (u) la girante non ridisegna l'ombra a ogni fotogramma
const OMBRA_VICINO = 6;

let st = null;
const _c = new THREE.Color();
const CARTA = new THREE.Color(PALETTE.carta);

/** Piani di riserva (se la valle non ha pubblicato i suoi). */
function pianiRiserva() {
  const P = VALLE.piani, piano = d => new THREE.Plane(new THREE.Vector3(...d.normale), d.costante);
  return { Z0: piano(P.Z0), ZP: piano(P.ZP), YF: piano(P.YF), ZK: piano(P.ZK) };
}
/** Velo "oscura" (4e) per i materiali interi della macchina: verso la carta, come il plastico. */
function patchOscura(ctx, uCarta) {
  return sh => {
    sh.uniforms.uPeOscura = ctx.U.oscura || { value: 0 }; sh.uniforms.uPeCarta = uCarta;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPeOscura; uniform vec3 uPeCarta;')
      .replace('#include <opaque_fragment>', '\toutgoingLight = mix( outgoingLight, uPeCarta, uPeOscura );\n#include <opaque_fragment>');
  };
}
/** Inox delle giranti (§2.6, MAI oro né bronzo): lucido per cucchiai e spine, satinato tornito (anisotropia) per disco e albero. */
function materialeInox(ctx, uCarta, satinato) {
  const I = MATERIALI.inox;
  const par = { color: I.color, metalness: I.metalness, roughness: I.roughness, envMapIntensity: I.envMapIntensity };
  if (satinato) par.anisotropy = I.anisotropy;
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, par, { patch: patchOscura(ctx, uCarta), chiave: 'pelton.oscura' });
  m.name = satinato ? 'pelton.inox.satinato' : 'pelton.inox.lucido';
  return MAT.usaStudio(ctx, m);     // acciaio da vetrina: riflette lo studio, non la stanza chiara
}
/** Fodera (interno del carter, scudi del generatore, fondi dei tubi): la cassa dello stile scurita e laccata; tagliata da ZP. */
function materialeFodera(ctx, patchSezione, piani) {
  const S = MAT.stileTurbine();
  const m = nuovoMateriale(THREE.MeshPhysicalMaterial, {
    color: new THREE.Color(S.cassa).multiplyScalar(FODERA.tinta), metalness: S.cassaMetallo * FODERA.metallo,
    roughness: FODERA.roughness, clearcoat: FODERA.clearcoat, clearcoatRoughness: FODERA.clearcoatRoughness,
    envMapIntensity: MATERIALI.casse.envMapIntensity, side: THREE.DoubleSide, clippingPlanes: piani, clipShadows: true });
  m.name = 'pelton.fodera';
  return patchSezione(m);
}

/** Costruzione (una volta). */
export async function crea(ctx) {
  const scena = ctx.scene.valle, V = ctx.dati.valle;
  const piani = V?.piani || pianiRiserva();
  const patchSezione = V?.patchSezione || (m => { m.side = THREE.DoubleSide; return m; });

  // ---- materiali: inox della girante (propri, con il velo), casse e dettagli dello stile (interi: quelli della valle;
  // tagliati: propri con ZP), fodera scura del carter
  const uCarta = { value: new THREE.Color() };
  const inoxL = materialeInox(ctx, uCarta, false), inoxS = materialeInox(ctx, uCarta, true);
  const casse = V?.materiali?.casse || MAT.materialeCasse(ctx, patchSezione, [piani.Z0]);
  const dettagli = V?.materiali?.dettagli || MAT.materialeDettagli(ctx, patchSezione, [piani.Z0]);
  const calcestruzzo = V?.materiali?.calcestruzzo || MAT.materialeEdifici(ctx, patchSezione, [piani.Z0]);
  const casseP = MAT.materialeCasse(ctx, patchSezione, [piani.ZP], 'pelton.cassa');
  const dettagliP = MAT.materialeDettagli(ctx, patchSezione, [piani.ZP]); dettagliP.name = 'pelton.dettagli';
  const fodera = materialeFodera(ctx, patchSezione, [piani.ZP]);

  const mesh = (g, m, nome, noAO = false) => {
    const o = new THREE.Mesh(g, m); o.name = nome; o.castShadow = true; o.receiveShadow = true; o.userData.noAO = noAO;
    return o;
  };
  const gruppo = new THREE.Group();
  gruppo.name = 'pelton';
  gruppo.position.set(GP.centro[0], GP.centro[1], GP.centro[2]);
  gruppo.scale.setScalar(UNITA.scalaMeccanica);

  // ---- girante (gira attorno a z, antioraria vista da +z): disco, ogiva, 22 cucchiai istanziati (uno in basso, θ = −90°)
  const girante = new THREE.Group(); girante.name = 'pelton.girante';
  girante.add(mesh(FO.geoDisco(), inoxS, 'pelton.disco'), mesh(FO.geoCappello(), inoxL, 'pelton.ogiva'));
  const cucchiai = new THREE.InstancedMesh(FO.geoCucchiaio(), inoxL, GP.cucchiai);
  cucchiai.name = 'pelton.cucchiai'; cucchiai.castShadow = cucchiai.receiveShadow = true;
  const mI = new THREE.Matrix4();
  for (let i = 0; i < GP.cucchiai; i++) cucchiai.setMatrixAt(i, mI.makeRotationZ(-Math.PI / 2 + i * PASSO));
  cucchiai.instanceMatrix.needsUpdate = true; cucchiai.computeBoundingSphere();
  girante.add(cucchiai);
  const albero = new THREE.Group(); albero.name = 'pelton.albero';
  albero.add(mesh(FO.geoAlbero(), inoxS, 'pelton.albero.giunto'));
  gruppo.add(girante, albero);

  // ---- ugelli A (getto verso +x, in basso) e B (verso −y, a sinistra): telaio dell'ugello con l'asse +y e la bocca in 0
  const U = FO.geoUgello(), bulbo = FO.geoBulbo(), spina = FO.geoSpina(), dev = FO.geoDeviatore();
  const tagliati = { cassa: [], dettagli: [] }, interi = { dettagli: [] };
  const ugelli = [[FO.QUOTE.boccaA, -Math.PI / 2], [FO.QUOTE.boccaB, Math.PI]].map(([b, rot], k) => {
    const g = new THREE.Group(); g.name = `pelton.ugello.${k ? 'B' : 'A'}`;
    g.position.set(b[0], b[1], 0); g.rotation.z = rot; g.updateMatrix();
    tagliati.cassa.push(U.corpo.clone().applyMatrix4(g.matrix));
    tagliati.dettagli.push(U.dettagli.clone().applyMatrix4(g.matrix));
    interi.dettagli.push(bulbo.clone().applyMatrix4(g.matrix));
    const sp = mesh(spina.clone(), inoxL, `${g.name}.spina`);
    const perno = new THREE.Group(); perno.position.set(dev.perno[0], dev.perno[1], 0);
    perno.add(mesh(dev.mobile.clone(), dettagli, `${g.name}.deviatore`));
    const fisso = dev.fisso.clone().translate(dev.perno[0], dev.perno[1], 0).applyMatrix4(g.matrix);
    interi.dettagli.push(fisso);
    g.add(sp, perno);
    gruppo.add(g);
    return { spina: sp, deviatore: perno };
  });
  [U.corpo, U.dettagli, bulbo, spina, dev.mobile, dev.fisso].forEach(x => x.dispose());

  // ---- carter (tagliato da ZP), collettore, cuscinetto, generatore
  const K = FO.geoCarter(), CO = FO.geoCollettore(), CU = FO.geoCuscinetto(), GE = FO.geoGeneratore();
  gruppo.add(
    mesh(FO.unisci([K.cassa, FO.geoPiedistallo(), ...tagliati.cassa]), casseP, 'pelton.cassa.taglio', true),
    mesh(FO.unisci([K.fodera, GE.scudi, CO.tappi]), fodera, 'pelton.fodera', true),
    mesh(FO.unisci([K.dettagli, ...tagliati.dettagli]), dettagliP, 'pelton.dettagli.taglio', true),
    mesh(FO.unisci([CO.cassa, CU.cassa, GE.cassa]), casse, 'pelton.cassa'),
    mesh(FO.geoPile(), calcestruzzo, 'pelton.pile'),
    mesh(FO.unisci([CO.dettagli, CU.dettagli, GE.dettagli, ...interi.dettagli]), dettagli, 'pelton.dettagli'),
  );
  scena.add(gruppo);

  // ---- ancora: il cucchiaio in basso, sulla conca davanti, dove il getto A colpisce la cresta
  const rp = FO.QUOTE.rp;
  ctx.ancore.set('pelton.cucchiaio', new THREE.Vector3(GP.centro[0], GP.centro[1] - (rp + 0.04) / MU, GP.centro[2] + 0.45 * GP.larghezzaCucchiaioM / MU));
  ctx.dati.pelton = { gruppo, girante };

  st = { girante, albero, ugelli, uCarta, angolo: 0, ti: null, centro: new THREE.Vector3(...GP.centro) };
}

/** Ogni fotogramma (solo nella VALLE): rotazione, spine e deviatori, velo. Nessuna allocazione. */
export function aggiorna(ctx, T, t, dt) {
  if (!st) return;
  const S = ctx.STATO, U = ctx.U;
  versoScena(_c.copy(CARTA), esposizioneTono(S), st.uCarta.value);

  // ---- girante: ω reale × tempoScala, limitata a 0,45 del passo dei cucchiai per fotogramma (ruota di carro)
  const ti = U.uTempoIdro?.value ?? 0;
  const dTi = st.ti === null ? 0 : Math.max(0, ti - st.ti);
  st.ti = ti;
  if (dTi > 0) {
    const ts = Math.max(S.tempoScala ?? 1, 1e-6), fps = Math.max(ctx.tempo?.fps ?? 60, 1);
    const omega = Math.min(OMEGA, IDRO.omegaMaxFattore * PASSO * fps / ts);   // rad per secondo di tempo idro
    st.angolo = (st.angolo + omega * dTi) % TAU;
    st.girante.rotation.z = st.albero.rotation.z = st.angolo;
    if (ctx.camera && ctx.camera.position.distanceTo(st.centro) < OMBRA_VICINO) ctx.ombre?.richiedi?.();
  }

  // ---- spina che arretra mentre il getto avanza (STATO.getti), deviatori che escono dal getto
  const g = clamp(S.getti ?? 0, 0, 1), corsa = FO.FORMA.ugello.corsa, rit = FO.FORMA.deviatore.ritiro * fase(g, 0, 1, 'power2.inOut');
  for (let k = 0; k < st.ugelli.length; k++) {
    st.ugelli[k].spina.position.y = -corsa * g;
    st.ugelli[k].deviatore.rotation.z = rit;
  }
}
