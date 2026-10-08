// =============================================================================
// ERI v2 · render/ombre.js — inquadratura dell'ombra del sole e aggiornamento su richiesta
// Proprietario: [BASE-RENDER]. Stato: COMPLETO.
// Specifica: DESIGN §6.4 (adattaOmbra agganciata al texel, meta per inquadratura), §4 (righe "Ombre"),
// config.META_OMBRA (i valori per keyframe stanno in config.CAMERA[].ombra), config.SOLE.ombra.
//
// Contratto: crea(ctx) pubblica ctx.ombre = {
//   gestisce: true,                          // sole.js non posiziona più il sole
//   adatta(centro:Vector3, meta:number),     // adattaOmbra §6.4 sul sole del mondo attivo (subito)
//   richiedi(),                              // un modulo ha mosso proiettori d'ombra → mappa ridisegnata
//   taglia(n),                               // governatore: nuova taglia della mappa (dispose + null)
//   aggiornamenti: number                    // contatore (debug)
// }
// aggiorna(): centro = ctx.regia.centroOmbra, meta = ctx.regia.meta (dal rig, in log nei voli).
// renderer.shadowMap.autoUpdate è false: needsUpdate = true SOLO se cambia qualcosa (sole, centro agganciato
// al texel, meta, mondo, taglia, richiedi(), chiavi di STATO che muovono proiettori). Sole spento: mappa ferma.
// =============================================================================
import * as THREE from 'three';
import { SOLE } from '../config.js';

export const MONDO = 'sistema';

// Chiavi di STATO legate allo scroll che muovono oggetti che proiettano ombra (sollevamento della carta,
// tracker, cabine, cantiere, macchine). Se una cambia, la mappa si ridisegna anche senza richiedi():
// così l'ombra resta giusta anche se un modulo dimentica di chiamarlo.
const CHIAVI = ['uOnda', 'eroe', 'esplosione', 'giraModulo', 'comparsaFV', 'comparsaAgri', 'comparsaPali', 'comparsaTubi',
  'comparsaModuli', 'cabine', 'trattore', 'sigillo', 'picchetti', 'recinzione', 'uModo', 'YF', 'apertura', 'passoKaplan',
  'aperturaKaplan', 'giranti', 'colonne', 'uAngoloFV', 'uAngoloAgri'];

const SU = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

/**
 * adattaOmbra (§6.4): frustum ortografico ±meta centrato su "centro", agganciato al texel della mappa
 * (niente sfarfallio quando la camera si muove). Scrive in "out" il centro agganciato.
 */
function posiziona(sole, centro, meta, dir, out) {
  const texel = (2 * meta) / sole.shadow.mapSize.x;
  _r.crossVectors(SU, dir); if (_r.lengthSq() < 1e-8) _r.copy(X); _r.normalize();   // sole allo zenit: asse X
  _u.crossVectors(dir, _r);
  const a = Math.round(centro.dot(_r) / texel) * texel, b = Math.round(centro.dot(_u) / texel) * texel, c = centro.dot(dir);
  out.set(0, 0, 0).addScaledVector(_r, a).addScaledVector(_u, b).addScaledVector(dir, c);
  sole.target.position.copy(out);
  sole.position.copy(out).addScaledVector(dir, SOLE.ombra.distanza);
  sole.target.updateMatrixWorld(); sole.updateMatrixWorld();
  const cam = sole.shadow.camera;
  if (cam.right !== meta) { cam.left = cam.bottom = -meta; cam.right = cam.top = meta; cam.updateProjectionMatrix(); }
  return out;
}

export async function crea(ctx) {
  const st = { mondo: null, centro: new THREE.Vector3(1e9, 0, 0), meta: -1, dir: new THREE.Vector3(), richiesto: true,
               chiavi: new Float64Array(CHIAVI.length + 2), pendente: false };
  ctx.dati.ombre = st;
  ctx.renderer.shadowMap.autoUpdate = false;     // la mappa si ridisegna solo su richiesta (§6.4)
  ctx.renderer.shadowMap.needsUpdate = true;
  ctx.ombre = {
    gestisce: true,
    aggiornamenti: 0,
    adatta(centro, meta) {
      const L = ctx.luci?.[ctx.mondo]; if (!L) return;
      _d.copy(ctx.U.uSoleDir.value).normalize();
      posiziona(L.sole, centro, meta, _d, _p);
      st.centro.copy(_p); st.meta = meta; st.dir.copy(_d); st.mondo = ctx.mondo;
      ctx.renderer.shadowMap.needsUpdate = true; ctx.ombre.aggiornamenti++;
    },
    richiedi() { st.richiesto = true; },
    taglia(n) {
      let cambiata = false;
      for (const k of ['pianura', 'valle']) {
        const s = ctx.luci?.[k]?.sole; if (!s || !(n > 0) || s.shadow.mapSize.x === n) continue;
        s.shadow.mapSize.set(n, n); cambiata = true;
        if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; }   // si rialloca al prossimo render (niente ricompilazioni)
      }
      if (cambiata) { st.meta = -1; st.richiesto = true; }
    },
  };
  // Banco di prova della resa (SOLO con ?banco=1 insieme a ?debug=1 o ?test=1): non entra nel flusso normale.
  const P = new URLSearchParams(location.search);
  if (P.get('banco') === '1' && (ctx.flags.debug || ctx.flags.test)) {
    const banco = await import('./pipeline-banco.js');
    await banco.crea(ctx);
    ctx.dati.banco = banco;
  }
}

/** Ogni fotogramma (fase "dopo": camera, luce e contenuti sono già aggiornati). */
export function aggiorna(ctx /*, T, t, dt */) {
  const st = ctx.dati.ombre, L = ctx.luci?.[ctx.mondo]; if (!st || !L) return;
  const S = ctx.STATO, R = ctx.regia;
  if (ctx.mondo === 'pianura') ctx.dati.banco?.aggiorna?.(ctx);   // banco di prova (?banco=1): dopo i contenuti
  _d.copy(ctx.U.uSoleDir.value).normalize();
  const meta = R?.meta > 0 ? R.meta : 190;
  posiziona(L.sole, R?.centroOmbra ?? _p.set(0, 0, 0), meta, _d, _p);

  // proiettori mossi dallo scroll
  let chiavi = false; const v = st.chiavi;
  for (let i = 0; i < CHIAVI.length; i++) {
    const k = CHIAVI[i]; const x = (k in S) ? S[k] : (ctx.U[k]?.value ?? 0);
    if (x !== v[i]) { v[i] = x; chiavi = true; }
  }
  const tf = S.trackerFV?.theta ?? 0, ta = S.trackerAgri?.theta ?? 0;
  if (tf !== v[CHIAVI.length] || ta !== v[CHIAVI.length + 1]) { v[CHIAVI.length] = tf; v[CHIAVI.length + 1] = ta; chiavi = true; }

  const cambiato = st.mondo !== ctx.mondo || !_p.equals(st.centro) || meta !== st.meta || _d.dot(st.dir) < 1 - 1e-9;
  const acceso = S.sole.el > -1 && S.sole.int > 1e-3;
  if (cambiato || chiavi || st.richiesto || st.pendente) {
    if (acceso || st.mondo !== ctx.mondo) {
      ctx.renderer.shadowMap.needsUpdate = true; ctx.ombre.aggiornamenti++;
      st.pendente = false;
    } else st.pendente = true;            // sole sotto l'orizzonte (tappa 2): mappa ferma, si aggiorna al ritorno
    st.centro.copy(_p); st.meta = meta; st.dir.copy(_d); st.mondo = ctx.mondo; st.richiesto = false;
  }
}
