// =============================================================================
// ERI v2 · render/qualita.js — livelli di qualità, governatore del tempo di fotogramma, budget di pixel
// Proprietario: [BASE-RENDER]. Stato: COMPLETO.
// Specifica: DESIGN §6.8 (livelli, budget, governatore con isteresi, gradini, pause), §6.12, config.QUALITA.
//
// Contratto: crea(ctx) pubblica ctx.qualita = {
//   livello: 'ultra'|'alta'|'media'|'base',
//   Q: copia di config.QUALITA.livelli[livello]   // letta dai moduli SOLO in crea()
//   R: { scalaGradino, gtao, ombra, msaa, smaa, bloom }   // stato di runtime che il governatore cambia
//   scala: number (getter)       // min(1, √(budget/(w·h·dpr²))) × gradino di scala × 0,5 sotto le sezioni
//   gradino: number              // gradini applicati (0 = livello pieno)
//   forzato: boolean             // ?q=… o ?test=1: il governatore non cambia nulla
//   info(), benchmark(): Promise
// }
// aggiorna(): governatore (§6.8). Applica con ctx.pipeline.applicaQualita(R) ed emette 'qualita'.
// =============================================================================
import { QUALITA } from '../config.js';

export const MONDO = 'sistema';

/** Livello iniziale: ?q forzato, ?test=1 e schermi piccoli → base, altrimenti stima dalla GPU (§6.8). */
export function rileva(ctx) {
  const f = ctx.flags;
  if (f.q && QUALITA.livelli[f.q]) return f.q;
  if (f.test || f.piccolo) return 'base';
  let gpu = '';
  try {
    const gl = ctx.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { /* GPU ignota */ }
  if (QUALITA.regexUltra.test(gpu)) return 'ultra';
  if (/SwiftShader|llvmpipe|Mali|Adreno|PowerVR/i.test(gpu)) return 'base';   // CPU e GPU mobili
  if (QUALITA.regexBassa.test(gpu)) return 'media';                            // Intel integrate
  return 'alta';
}

/** Pixel nativi della tela. */
const pixelNativi = dpr => innerWidth * innerHeight * dpr * dpr;

export function crea(ctx) {
  const livello = rileva(ctx);
  const Q = { ...QUALITA.livelli[livello] };
  const G = QUALITA.governatore;
  const dpr = ctx.dprNativo;
  const scalaBudget = () => Math.min(1, Math.sqrt(Q.budget / pixelNativi(dpr)));
  // MSAA: Ultra/Alta passano a 0 + SMAA se i pixel interni superano 3,7 MP (§6.8)
  const msaaIniziale = () => (Q.msaa > 0 && (livello === 'ultra' || livello === 'alta')
    && pixelNativi(dpr) * scalaBudget() ** 2 > QUALITA.sogliaSmaa) ? 0 : Q.msaa;

  // Gradini del governatore per questo livello, nell'ordine di §6.8 (si scende in avanti, si sale indietro)
  const gradini = [];
  for (const s of QUALITA.gradiniScala.slice(1)) gradini.push({ tipo: 'scala', v: s });
  if (Q.gtao) gradini.push({ tipo: 'gtao' });
  if (Q.ombra > 2048) gradini.push({ tipo: 'ombra', v: 2048 });
  if (Q.ombra > 1024) gradini.push({ tipo: 'ombra', v: 1024 });
  if (msaaIniziale() > 0) gradini.push({ tipo: 'msaa' });
  gradini.push({ tipo: 'bloom' });

  const R = { scalaGradino: 1, gtao: Q.gtao, ombra: Q.ombra, msaa: msaaIniziale(), smaa: false, bloom: true };
  function calcolaR(g) {
    R.scalaGradino = 1; R.gtao = Q.gtao; R.ombra = Q.ombra; R.msaa = msaaIniziale(); R.bloom = true;
    for (let i = 0; i < g; i++) {
      const p = gradini[i];
      if (p.tipo === 'scala') R.scalaGradino = p.v;
      else if (p.tipo === 'gtao') R.gtao = false;
      else if (p.tipo === 'ombra') R.ombra = p.v;
      else if (p.tipo === 'msaa') R.msaa = 0;
      else if (p.tipo === 'bloom') R.bloom = false;
    }
    R.smaa = R.msaa === 0;
    return R;
  }
  calcolaR(0);

  const gov = { m: 0, intervallo: 1, primoSecondo: 0, campioni: 0, sopra: 0, sotto: 0, fermo: 0, ultimoCambio: -1e9,
                inSezioni: false, banco: null, mediaInizio: false };
  ctx.dati.qualita = { gov, gradini, calcolaR };

  ctx.qualita = {
    livello, Q, R, gradino: 0, forzato: !!(ctx.flags.q || ctx.flags.test),
    /** Scala della risoluzione interna (budget × gradino × sezioni). */
    get scala() { return scalaBudget() * R.scalaGradino * (gov.inSezioni ? QUALITA.sezioni.scala : 1); },
    /** Ricalcola MSAA dopo un resize (la soglia di 3,7 MP dipende dai pixel). */
    ricalcola() { calcolaR(this.gradino); },
    info() {
      return { livello: this.livello, scala: +this.scala.toFixed(3), gradino: this.gradino, gradini: gradini.length, forzato: this.forzato,
               msaa: R.msaa, smaa: R.smaa, gtao: R.gtao, ombra: R.ombra, bloom: R.bloom, budget: Q.budget,
               mediaMs: +(gov.m * 1000).toFixed(2), obiettivoMs: +(obiettivo() * 1000).toFixed(2) };
    },
    /**
     * Benchmark di 90 fotogrammi (§6.8): da chiamare durante l'intro, con la camera su K0.1.
     * Misura il tempo medio di fotogramma e, se serve, scende subito di più gradini (sotto il velo dell'intro).
     * @returns {Promise<object>} info()
     */
    benchmark() {
      if (this.forzato) return Promise.resolve(this.info());
      if (gov.banco) return gov.banco.promessa;
      let risolvi; const promessa = new Promise(r => { risolvi = r; });
      gov.banco = { n: 0, somma: [], promessa, risolvi };
      return promessa;
    },
  };
  const obiettivo = () => Math.max(gov.intervallo, G.obiettivoMinMs / 1000);
  gov.obiettivo = obiettivo;
}

/** Applica il gradino corrente alla pipeline ed emette l'evento 'qualita'. */
function applica(ctx, motivo) {
  const q = ctx.qualita, d = ctx.dati.qualita;
  d.calcolaR(q.gradino);
  ctx.pipeline?.applicaQualita?.(q.R);
  if (!ctx.inWarmup) ctx.eventi.emit('qualita', { ...q.info(), motivo });
}

/** Governatore (§6.8): media esponenziale del dt, isteresi, un cambio ogni 4 s, solo a scroll fermo o sotto velo. */
export function aggiorna(ctx, T, t, dt) {
  const q = ctx.qualita, d = ctx.dati.qualita; if (!q || !d) return;
  const gov = d.gov, G = QUALITA.governatore;

  // sotto le sezioni HTML: scala 0,5 (la pipeline rialloca solo al cambio)
  const sez = !!ctx.scroll?.inSezioni;
  if (sez !== gov.inSezioni) { gov.inSezioni = sez; ctx.pipeline?.applicaQualita?.(q.R); }

  if (!(dt > 0) || ctx.inWarmup || document.hidden) return;     // passi forzati (vaiT, warm-up): niente misure
  // la costruzione della VALLE in idle (compilazioni, cotture) fa fotogrammi lenti che non dicono nulla della GPU
  if (ctx.valle?.stato === 'costruzione') { gov.sopra = gov.sotto = 0; return; }

  // intervallo del monitor = dt minimo del primo secondo (60, 120, 144 Hz)
  if (gov.primoSecondo < 1) { gov.primoSecondo += dt; gov.intervallo = Math.min(gov.intervallo, dt); gov.m = gov.obiettivo(); return; }
  gov.m = gov.m * (1 - G.media) + dt * G.media;

  // benchmark dell'intro: 90 fotogrammi, poi correzione immediata
  if (gov.banco) {
    const b = gov.banco; b.somma.push(dt); b.tempo = (b.tempo || 0) + dt;
    const B = QUALITA.benchmark;
    if (b.somma.length >= B.fotogrammi || (b.tempo >= (B.maxS ?? Infinity) && b.somma.length >= (B.minimo ?? 1))) {
      const v = b.somma.slice().sort((x, y) => x - y), mediana = v[v.length >> 1];
      let stima = mediana; const obj = gov.obiettivo();
      while (!q.forzato && stima > G.giu * obj && q.gradino < d.gradini.length) {
        const p = d.gradini[q.gradino]; q.gradino++;
        const prima = q.gradino >= 2 && d.gradini[q.gradino - 2].tipo === 'scala' ? d.gradini[q.gradino - 2].v : 1;
        stima *= p.tipo === 'scala' ? (p.v / prima) ** 2 : 0.9;   // stima grezza: il costo scala con i pixel
      }
      if (q.gradino) { applica(ctx, 'benchmark'); gov.ultimoCambio = t; }
      gov.m = mediana; gov.banco = null; b.risolvi(q.info());
    }
    return;
  }
  if (q.forzato) return;

  const obj = gov.obiettivo();
  gov.sopra = gov.m > G.giu * obj ? gov.sopra + dt : 0;
  gov.sotto = gov.m < G.su * obj ? gov.sotto + dt : 0;
  const v = ctx.scroll?.velocita ?? 0;
  gov.fermo = v < G.scrollMax ? gov.fermo + dt : 0;
  const permesso = gov.fermo >= G.scrollFermo || ctx.velo > 0.5 || (ctx.STATO?.nebbia ?? 0) >= 0.01;
  if (!permesso || t - gov.ultimoCambio < G.intervallo) return;
  if (gov.sopra >= G.tGiu && q.gradino < d.gradini.length) {
    q.gradino++; applica(ctx, 'giu');
  } else if (gov.sotto >= G.tSu && q.gradino > 0) {
    q.gradino--; applica(ctx, 'su');
  } else return;
  gov.ultimoCambio = t; gov.sopra = gov.sotto = 0; gov.m = obj;
}
