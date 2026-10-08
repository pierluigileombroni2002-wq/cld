// =============================================================================
// ERI v2 · luce/sole.js — sole (DirectionalLight unica con ombre) ed emisfera, per le due scene
// Proprietario: [BASE-RENDER]. Stato: COMPLETO.
// Specifica: DESIGN §2.4 (luce per tappa), §6.3 (posizioneSole, luceSole), §6.4 (ombre), App. A.
//
// Le funzioni pure (posizioneSole, angoloTracker, luceSole, intensitaSole, coloreSole, direzioneSole, oraDaT)
// vivono in ../geo.js [ARCH] e qui sono solo riesportate. La prova automatica contro l'Appendice A è
// luce/sole-prova.mjs (node, scarto massimo 0,05°).
// STATO.sole {el, az, int, col} e STATO.soleDir li calcola regia/stato.js (tracce + soleAuto):
// qui si applicano alle luci del mondo attivo. Posizione e inquadratura dell'ombra: render/ombre.js.
//
// Regole: numero di luci COSTANTE per scena (§6.4). PIANURA = sole + emisfera; VALLE = sole + emisfera
// (+ 2 RectAreaLight + 1 SpotLight di idro/valle.js). Si animano solo colori e intensità.
// =============================================================================
import * as THREE from 'three';
import { SOLE } from '../config.js';
export { posizioneSole, angoloTracker, luceSole, intensitaSole, coloreSole, direzioneSole, oraDaT } from '../geo.js';

export const MONDO = 'sistema';

/** Sole + emisfera di una scena. Il frustum dell'ombra lo inquadra render/ombre.js (adattaOmbra). */
function luciPer(scena, nome, taglia) {
  const sole = new THREE.DirectionalLight(0xffffff, 0);
  sole.name = 'sole-' + nome;
  sole.castShadow = true;                                   // MAI cambiato a runtime
  sole.shadow.mapSize.set(taglia, taglia);
  sole.shadow.bias = SOLE.ombra.bias; sole.shadow.normalBias = SOLE.ombra.normalBias; sole.shadow.radius = SOLE.ombra.radius;
  const cam = sole.shadow.camera; cam.near = SOLE.ombra.near; cam.far = SOLE.ombra.far;
  cam.left = cam.bottom = -190; cam.right = cam.top = 190; cam.updateProjectionMatrix();
  sole.position.set(0, SOLE.ombra.distanza, 0);
  sole.target.name = 'sole-bersaglio-' + nome;
  const emisfera = new THREE.HemisphereLight(new THREE.Color(SOLE.emisfera.cielo), new THREE.Color(SOLE.emisfera.suolo), 0.06);
  emisfera.name = 'emisfera-' + nome;
  // oggetti "di sistema": il banco di prova (?banco=1) non li nasconde
  sole.userData.sistema = sole.target.userData.sistema = emisfera.userData.sistema = true;
  scena.add(sole, sole.target, emisfera);
  return { sole, emisfera };
}

/**
 * Crea sole + emisfera in entrambe le scene. Pubblica ctx.luci = { pianura:{sole, emisfera}, valle:{sole, emisfera} }.
 * La taglia della mappa d'ombra viene da ctx.qualita (il governatore la cambia con ctx.ombre.taglia()).
 */
export function crea(ctx) {
  const taglia = ctx.qualita?.R?.ombra ?? ctx.qualita?.Q?.ombra ?? 2048;
  ctx.luci = { pianura: luciPer(ctx.scene.pianura, 'pianura', taglia), valle: luciPer(ctx.scene.valle, 'valle', taglia) };
}

const _dir = new THREE.Vector3();
/** Ogni fotogramma: colore, intensità (sole ed emisfera) e direzione dal STATO, solo per il mondo attivo. */
export function aggiorna(ctx /*, T, t, dt */) {
  const S = ctx.STATO, L = ctx.luci?.[ctx.mondo]; if (!L) return;
  _dir.set(S.soleDir[0], S.soleDir[1], S.soleDir[2]);
  L.sole.color.copy(S.sole.col);
  // sotto −1° il sole non illumina (le tracce lo portano già a 0: qui è solo una garanzia)
  L.sole.intensity = S.sole.el > -1 ? Math.max(0, S.sole.int) : 0;
  L.emisfera.intensity = S.emisfera;
  // posizione provvisoria se render/ombre.js non è attivo (altrimenti la scrive adattaOmbra)
  if (!ctx.ombre?.gestisce) {
    const c = ctx.regia?.target; if (c) L.sole.target.position.copy(c);
    L.sole.position.copy(L.sole.target.position).addScaledVector(_dir, SOLE.ombra.distanza);
  }
  ctx.U.uSoleDir.value.copy(_dir);
}
