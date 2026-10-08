// =============================================================================
// ERI v2 · main.js — avvio, caricamento con avanzamento, warm-up, ciclo unico, API di debug
// Proprietario: [ARCH]. Contratto completo in ARCHITETTURA.md.
//
// Robustezza: ogni modulo si importa con import() dinamico e ogni chiamata è protetta.
// Un modulo che manca, è uno stub o lancia un'eccezione non ferma la pagina: l'errore va UNA
// volta in console (le prove lo vedono) e il modulo viene escluso dal ciclo.
// =============================================================================
import './luce/nebbia.js';                 // PRIMO: sostituisce i chunk fog_* prima di qualunque materiale (§6.3)
import * as THREE from 'three';
import * as CFG from './config.js';
import * as GEO from './geo.js';
import { creaStato, mondoDi, tappaDi, fase, ease } from './regia/stato.js';

// ---------------------------------------------------------------- parametri dell'URL (§6.13)
const P = new URLSearchParams(location.search);
const vero = k => P.has(k) && P.get(k) !== '0' && P.get(k) !== 'false';
const numero = k => (P.has(k) && P.get(k) !== '' && isFinite(+P.get(k))) ? +P.get(k) : null;
const qGrezzo = (P.get('q') || '').toLowerCase();
const flags = {
  test: vero('test'),                                   // DPR 1, base, niente Lenis, orologio fisso, niente intro
  debug: vero('debug'),                                 // pannello di debug (test.js)
  T0: numero('T') ?? numero('t'),                       // parte da questo T
  q: qGrezzo === 'bassa' ? 'base' : (CFG.QUALITA.livelli[qGrezzo] ? qGrezzo : null),
  tm: (P.get('tm') || '').toLowerCase() === 'agx' ? 'agx' : 'aces',
  riduci: vero('riduci') || matchMedia('(prefers-reduced-motion: reduce)').matches,
  piccolo: innerWidth < CFG.QUALITA.piccolo.larghezza || matchMedia('(pointer: coarse)').matches,
  nowebgl: vero('nowebgl'),
};
flags.intro = !flags.test && !vero('nointro') && flags.T0 == null;
flags.lenis = !flags.test && !flags.riduci;

// ---------------------------------------------------------------- moduli (albero di §6.2 + aggiunte)
const PERCORSI = {
  pipeline: './render/pipeline.js', qualita: './render/qualita.js', ombre: './render/ombre.js',
  nebbia: './luce/nebbia.js', sole: './luce/sole.js', cielo: './luce/cielo.js',
  scroll: './regia/scroll.js', camera: './regia/camera.js', test: './test.js',
  catasto: './mondo/catasto.js', terreno: './mondo/terreno.js', fiume: './mondo/fiume.js', contorno: './mondo/contorno.js',
  tracker: './impianti/tracker.js', agri: './impianti/agri.js', cantiere: './impianti/cantiere.js',
  valle: './idro/valle.js', pelton: './idro/pelton.js', francis: './idro/francis.js', kaplan: './idro/kaplan.js',
  acqua: './idro/acqua.js', diagramma: './idro/diagramma.js',
  intro: './ui/intro.js', indice: './ui/indice.js', testi: './ui/testi.js', etichette: './ui/etichette.js', hud: './ui/hud.js',
  cursore: './ui/cursore.js', lineaOro: './ui/lineaOro.js', finale: './ui/finale.js', servizi: './ui/servizi.js', contatti: './ui/contatti.js',
};
// Ordine di aggiornamento nel fotogramma (vincolante, ARCHITETTURA §4)
const ORDINE = {
  luce: ['sole', 'nebbia', 'cielo'],
  pianura: ['catasto', 'terreno', 'fiume', 'contorno', 'tracker', 'agri', 'cantiere'],
  valle: ['valle', 'pelton', 'francis', 'kaplan', 'acqua', 'diagramma'],
  dopo: ['ombre', 'qualita'],
  ui: ['testi', 'etichette', 'hud', 'cursore', 'lineaOro', 'finale', 'indice', 'servizi', 'contatti', 'intro', 'test'],
};
const M = {};                 // nome → namespace del modulo ({} se non caricato)
const guasti = new Set();     // moduli esclusi dopo un errore
const creati = new Set();     // moduli su cui crea() è già stato chiamato

// ---------------------------------------------------------------- errori e chiamate protette
const errori = [];
function segnala(dove, e) {
  errori.push(`${dove}: ${e?.message || e}`);
  console.error(`[ERI] ${dove}:`, e);
}
async function importa(nome) {
  try { M[nome] = await import(PERCORSI[nome]); }
  catch (e) { M[nome] = {}; guasti.add(nome); segnala(`import ${PERCORSI[nome]}`, e); }
}
function chiama(nome, fn, ...arg) {
  if (guasti.has(nome)) return undefined;
  const f = M[nome]?.[fn]; if (typeof f !== 'function') return undefined;
  try { return f(...arg); } catch (e) { guasti.add(nome); segnala(`${nome}.${fn}`, e); return undefined; }
}
/** crea(ctx) una sola volta per modulo. */
function crea(nome) { if (creati.has(nome)) return undefined; creati.add(nome); return chiamaAsync(nome, 'crea', ctx); }
async function chiamaAsync(nome, fn, ...arg) {
  if (guasti.has(nome)) return undefined;
  const f = M[nome]?.[fn]; if (typeof f !== 'function') return undefined;
  try { return await f(...arg); } catch (e) { guasti.add(nome); segnala(`${nome}.${fn}`, e); return undefined; }
}

// ---------------------------------------------------------------- eventi
function creaEventi() {
  const m = new Map();
  return {
    on(n, f) { if (!m.has(n)) m.set(n, new Set()); m.get(n).add(f); return () => m.get(n)?.delete(f); },
    off(n, f) { m.get(n)?.delete(f); },
    emit(n, d) { for (const f of m.get(n) || []) { try { f(d); } catch (e) { segnala(`evento ${n}`, e); } } },
  };
}

// ---------------------------------------------------------------- contesto condiviso
const pronto = { risolvi: null };
const ctx = {
  THREE, config: CFG, geo: GEO, flags, versione: CFG.VERSIONE,
  canvas: document.getElementById('scena'),
  dprNativo: flags.test ? 1 : Math.min(devicePixelRatio || 1, CFG.RENDER.dprMax),
  renderer: null, pipeline: null, qualita: null,
  scene: null, camera: null, mondo: 'pianura',
  stato: null, STATO: null, U: null,
  tempo: { t: 0, dt: 0, T: 0, frame: 0, fps: 60 },
  carica: null, eventi: creaEventi(),
  ancore: new Map(),          // nome → THREE.Vector3 | () => THREE.Vector3 | Vector3[] (etichette, LineaOro)
  dati: {},                   // dati pubblicati dai moduli (ARCHITETTURA §6)
  veli: { stato: 0, sezioni: 0, regia: 0, valle: 0, contesto: 0, intro: 0 }, velo: 0,
  valle: { costruita: false, pronta: false, progresso: 0, stato: 'attesa' },
  inWarmup: false,            // true durante i render di riscaldamento: niente eventi, niente UI
  introFinita: !flags.intro,
  noWebGL: false,
  // servizi pubblicati dai moduli di sistema: regia, rig, scroll, luci, cielo, ombre, nebbia
};
const _pv = new THREE.Vector3();
/**
 * Proiezione di un punto 3D sullo schermo (px CSS) con la camera corrente.
 * @param {THREE.Vector3|number[]} v @param {object} [out]
 * @returns {{x:number, y:number, z:number, davanti:boolean, dentro:boolean}} z in NDC; dentro = nel quadro
 */
ctx.proietta = (v, out = {}) => {
  if (Array.isArray(v)) _pv.set(v[0], v[1], v[2]); else _pv.copy(v);
  _pv.project(ctx.camera);
  out.x = (_pv.x * 0.5 + 0.5) * innerWidth; out.y = (-_pv.y * 0.5 + 0.5) * innerHeight; out.z = _pv.z;
  out.davanti = _pv.z < 1 && _pv.z > -1; out.dentro = out.davanti && Math.abs(_pv.x) <= 1 && Math.abs(_pv.y) <= 1;
  return out;
};

// ---------------------------------------------------------------- caricatore con avanzamento (§5.2, §6.9)
const gruppi = CFG.CARICAMENTO.map(g => ({ ...g, f: 0 }));
function avanza(id, f) {
  const g = gruppi.find(x => x.id === id); if (!g) return;
  const prima = g.f; g.f = Math.max(g.f, Math.min(1, f)); if (g.f === prima) return;
  const totale = gruppi.reduce((s, x) => s + x.peso * x.f, 0);
  ctx.eventi.emit('progresso', { totale, gruppo: g.nome, id, frazione: g.f, completato: g.f >= 1 && prima < 1 });
}
function creaCaricatore() {
  const cache = new Map();
  const anis = () => ctx.renderer ? ctx.renderer.capabilities.getMaxAnisotropy() : 1;
  let rgbe = null;
  const ricorda = (k, f) => { if (!cache.has(k)) cache.set(k, f().catch(e => { cache.delete(k); throw e; })); return cache.get(k); };
  return {
    /** HDRI per nome di config.HDRI ('qwantani'|'kloofendal'|'autumn') → DataTexture HalfFloat (in cache). */
    hdr(nome, onProg) {
      return ricorda('hdr:' + nome, async () => {
        if (!rgbe) { const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js'); rgbe = new RGBELoader(); }
        const t = await rgbe.loadAsync(CFG.HDRI[nome], e => { if (onProg && e.total) onProg(e.loaded / e.total); });
        t.name = nome; t.mapping = THREE.EquirectangularReflectionMapping; return t;
      });
    },
    /** Set PBR di config.ASSET.texture → {diff, nor, arm} (diff sRGB; nor/arm NoColorSpace; Repeat; anisotropia max). */
    texture(set, onProg) {
      return ricorda('tex:' + set, async () => {
        const def = CFG.ASSET.texture[set]; if (!def) throw new Error('set di texture sconosciuto: ' + set);
        const L = new THREE.TextureLoader(); let n = 0;
        const una = async (k) => {
          const t = await L.loadAsync(def[k]);
          t.colorSpace = k === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis(); t.name = `${set}_${k}`;
          onProg?.(++n / 3); return t;
        };
        const [diff, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map(una));
        return { diff, nor, arm };
      });
    },
    /** Immagine generica (HTMLImageElement). */
    immagine(url) { return ricorda('img:' + url, () => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; })); },
    /** Testo (es. SVG del logo da incorporare). */
    testo(url) { return ricorda('txt:' + url, async () => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); }); },
    /** Font di §2.2 (max 3 s). */
    font() { return ricorda('font', () => Promise.race([Promise.all(CFG.FONT.carica.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 3000))]).then(() => true)); },
  };
}

// ---------------------------------------------------------------- un fotogramma (ordine vincolante)
let ultimoMondo = null;
function cambiaMondo(m) {
  ctx.mondo = m;
  ctx.pipeline?.impostaScena?.(m);
  ctx.rig?.salta?.();
  if (ctx.inWarmup) return;
  if (m === 'valle' && !ctx.valle.pronta) { costruisciValle(); ctx.valle.attesaDa = performance.now(); }
  ctx.eventi.emit('mondo', m);
}
function esegui(lista, T) { for (const n of lista) chiama(n, 'aggiorna', ctx, T, ctx.tempo.t, ctx.tempo.dt); }

/** Aggiorna tutto per il tempo di storia T (o quello dello scroll). Nessun render. */
function passo(dt, Tforzato = null) {
  const tm = ctx.tempo;
  tm.dt = dt; tm.t += flags.test ? 1 / 60 : dt; tm.frame++;
  if (dt > 0) tm.fps = tm.fps * 0.95 + (1 / dt) * 0.05;
  const T = Tforzato ?? (ctx.scroll ? ctx.scroll.aggiorna(dt) : 0);
  tm.T = T;
  const mondo = mondoDi(T);
  if (mondo !== ultimoMondo) { ultimoMondo = mondo; cambiaMondo(mondo); }
  ctx.stato.aggiorna(T, tm.t, dt, { riduci: flags.riduci });                 // 1. STATO e U
  chiama('camera', 'aggiorna', ctx, T, tm.t, dt);                             // 2. camera (ctx.regia)
  esegui(ORDINE.luce, T);                                                     // 3. luce: sole, nebbia, cielo
  esegui(mondo === 'valle' ? (ctx.valle.costruita ? ORDINE.valle : []) : ORDINE.pianura, T);   // 4. contenuti del mondo attivo
  esegui(ORDINE.dopo, T);                                                     // 5. ombre, qualità
  if (!ctx.inWarmup) esegui(ORDINE.ui, T);                                    // 6. interfaccia (dopo la camera)
  // 7. veli: il più opaco vince
  ctx.veli.stato = ctx.STATO.velo;
  if (mondo === 'valle' && !ctx.valle.pronta) ctx.veli.valle = (performance.now() - (ctx.valle.attesaDa || 0) < 3000) ? 1 : 0; else ctx.veli.valle = 0;
  const v = Math.max(...Object.values(ctx.veli));
  if (v !== ctx.velo) { ctx.velo = v; if (domVelo) domVelo.style.opacity = v.toFixed(3); }
  return T;
}
function render(dt) {
  if (document.hidden || ctx.velo >= 0.999 || !ctx.pipeline) return;
  if (ctx.scroll?.inSezioni && (ctx.tempo.frame & 1)) return;                // 30 fps sotto le sezioni (§6.8)
  try { ctx.pipeline.render(dt); } catch (e) { if (!guasti.has('pipeline')) { guasti.add('pipeline'); segnala('pipeline.render', e); } }
}
let tPrec = 0, attivo = false;
function disegna() {
  if (!attivo) return;
  const ora = performance.now(); const dt = tPrec ? Math.min(0.1, (ora - tPrec) / 1000) : 1 / 60; tPrec = ora;
  passo(dt); render(dt);
}
function avviaCiclo() {
  attivo = true;
  if (window.gsap?.ticker) { gsap.ticker.add(disegna); gsap.ticker.lagSmoothing(0); }
  else { const f = () => { disegna(); requestAnimationFrame(f); }; requestAnimationFrame(f); }
}
const dueFotogrammi = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

// ---------------------------------------------------------------- warm-up (§6.9)
function textureDi(m, out) {
  for (const k in m) { const v = m[k]; if (v && v.isTexture) out.add(v); }
  if (m.uniforms) for (const u of Object.values(m.uniforms)) { const v = u?.value; if (v && v.isTexture) out.add(v); }
}
async function riscalda(nome, configurazioni, Tritorno) {
  const scena = ctx.scene[nome]; const r = ctx.renderer;
  ctx.inWarmup = true;
  ctx.mondo = nome; ultimoMondo = nome; ctx.pipeline.impostaScena(nome);
  passo(0, configurazioni[0]);
  ctx.inWarmup = false;
  const nascosti = []; scena.traverse(o => { if (!o.visible) { nascosti.push(o); o.visible = true; } });
  // compileAsync solo con KHR_parallel_shader_compile (senza, three avvisa in console e compila comunque in modo sincrono)
  try { if (r.compileAsync && r.extensions.has('KHR_parallel_shader_compile')) await r.compileAsync(scena, ctx.camera); else r.compile(scena, ctx.camera); }
  catch (e) { segnala('compileAsync ' + nome, e); }
  const tex = new Set(); scena.traverse(o => { const mm = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []); mm.forEach(m => textureDi(m, tex)); });
  if (scena.environment) tex.add(scena.environment);
  for (const t of tex) { try { r.initTexture(t); } catch { /* texture non ancora pronta */ } }
  for (const o of nascosti) o.visible = false;
  if (nome === 'pianura') avanza('shader', 1);
  // render per configurazione: SINCRONI (nessun await) → nessun fotogramma intermedio arriva allo schermo
  let i = 0; ctx.inWarmup = true; ctx.mondo = nome; ultimoMondo = nome; ctx.pipeline.impostaScena(nome);
  for (const T of configurazioni) {                     // un render completo per configurazione, con ombra aggiornata
    passo(0, T); if (r.shadowMap) r.shadowMap.needsUpdate = true;
    try { ctx.pipeline.render(0); } catch (e) { segnala('warm-up render', e); break; }
    if (nome === 'pianura') avanza('verifica', ++i / configurazioni.length);
  }
  ctx.inWarmup = false;
  if (Tritorno != null) { passo(0, Tritorno); try { ctx.pipeline.render(0); } catch { /* */ } }
}

// ---------------------------------------------------------------- VALLE in idle (§6.9)
let promValle = null;
function costruisciValle() {
  if (promValle) return promValle;
  promValle = (async () => {
    ctx.valle.stato = 'costruzione';
    const passi = ORDINE.valle.length + 3; let k = 0; const piu = () => { ctx.valle.progresso = ++k / passi; ctx.eventi.emit('valle-progresso', ctx.valle.progresso); };
    await Promise.allSettled([ctx.carica.hdr('kloofendal'), ctx.carica.texture('cemento_diga'), ctx.carica.texture('metallo_lamiera')]); piu();
    for (const n of ORDINE.valle) { await crea(n); piu(); }
    ctx.valle.costruita = true;
    try { await ctx.cielo?.cotturaValle?.(); } catch (e) { segnala('cielo.cotturaValle', e); } piu();
    await riscalda('valle', CFG.WARMUP.valle, null);
    // torna al mondo corrente nello stesso task: nessun fotogramma della valle arriva allo schermo
    const Tora = ctx.scroll.aggiorna(0), mondoOra = mondoDi(Tora);
    ctx.mondo = mondoOra; ultimoMondo = mondoOra; ctx.pipeline.impostaScena(mondoOra);
    ctx.valle.pronta = true; ctx.valle.stato = 'pronta'; piu();
    passo(0, Tora); render(0);
    ctx.eventi.emit('valle-pronta');
    Promise.allSettled([ctx.carica.hdr('autumn')]);
  })().catch(e => segnala('costruzione VALLE', e));
  return promValle;
}
const inIdle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 600));

// ---------------------------------------------------------------- API di debug (§6.13)
let domVelo = null;
async function vaiT(T) {
  await quandoPronto;
  T = GEO.clamp(+T || 0, 0, CFG.T_FINE);
  if (ctx.noWebGL) return;                                   // senza WebGL non c'è tempo di storia
  if (mondoDi(T) === 'valle' && !ctx.valle.pronta) await costruisciValle();
  ctx.scroll?.vai(T);
  ctx.rig?.salta?.();
  ctx.cielo?.forzaCottura?.();
  passo(0, T); passo(0, T);
  if (ctx.renderer?.shadowMap) ctx.renderer.shadowMap.needsUpdate = true;
  render(0);
  await dueFotogrammi();
}
let risolviPronto; const quandoPronto = new Promise(r => { risolviPronto = r; });
window.__eri = {
  pronto: false,
  quandoPronto,
  versione: CFG.VERSIONE,
  get T() { return ctx.tempo.T; },
  get tappa() { return tappaDi(ctx.tempo.T); },
  get mondo() { return ctx.mondo; },
  get keyframe() { return ctx.regia?.keyframe ?? null; },
  get qualita() { return ctx.qualita?.info?.() ?? null; },
  get stato() { return ctx.STATO; },
  get errori() { return errori.slice(); },
  get guasti() { return [...guasti]; },
  config: CFG,
  vaiT, vaiA: vaiT,
  async scorri(y) { await quandoPronto; if (ctx.noWebGL) { window.scrollTo(0, +y || 0); return; } ctx.scroll?.scorri(+y || 0); ctx.rig?.salta?.(); passo(0); passo(0); render(0); await dueFotogrammi(); },
  info() {
    const i = ctx.renderer?.info; if (!i) return null;
    return { programmi: i.programs?.length ?? 0, chiamate: i.render.calls, triangoli: i.render.triangles, geometrie: i.memory.geometries, texture: i.memory.textures };
  },
  moduli() { return Object.fromEntries(Object.keys(PERCORSI).map(n => [n, guasti.has(n) ? 'guasto' : (Object.keys(M[n] || {}).length ? 'ok' : 'assente')])); },
};
if (flags.test || flags.debug) window.__eri.ctx = ctx;
window.addEventListener('error', e => errori.push('error: ' + e.message));
window.addEventListener('unhandledrejection', e => errori.push('rejection: ' + (e.reason?.message || e.reason)));

// ---------------------------------------------------------------- senza WebGL2 (§6.12)
async function avviaSenzaWebGL(motivo) {
  ctx.noWebGL = true; ctx.introFinita = true;
  document.documentElement.classList.add('no-webgl');
  document.body.classList.remove('carica');
  if (ctx.canvas) ctx.canvas.style.display = 'none';
  console.info('[ERI] modalità senza WebGL:', motivo);
  for (const n of ['testi', 'indice', 'servizi', 'contatti', 'intro']) { if (!M[n]) await importa(n); await crea(n); }
  window.__eri.pronto = true; risolviPronto();
}

// ---------------------------------------------------------------- avvio
async function avvia() {
  history.scrollRestoration = 'manual';
  document.documentElement.classList.toggle('modo-test', flags.test);
  document.documentElement.classList.toggle('riduci', flags.riduci);
  document.documentElement.classList.toggle('piccolo', flags.piccolo);
  domVelo = document.querySelector('.velo');
  ctx.carica = creaCaricatore();

  // 1. capacità
  let webgl2 = false;
  try { const { default: WebGL } = await import('three/addons/capabilities/WebGL.js'); webgl2 = WebGL.isWebGL2Available(); } catch (e) { segnala('WebGL.js', e); }
  if (!webgl2 || flags.nowebgl || !ctx.canvas) return avviaSenzaWebGL(flags.nowebgl ? '?nowebgl=1' : 'WebGL2 non disponibile');

  // 2. moduli (in parallelo) e intro subito (preloader)
  await Promise.all(Object.keys(PERCORSI).filter(n => n !== 'nebbia').map(importa));
  M.nebbia = await import('./luce/nebbia.js');
  await crea('intro');

  // 3. renderer, qualità, scene, camera, STATO, pipeline
  const { RectAreaLightUniformsLib } = await import('three/addons/lights/RectAreaLightUniformsLib.js');
  RectAreaLightUniformsLib.init();                                          // prima di qualunque materiale (§6.4)
  if (typeof M.pipeline.creaRenderer === 'function') M.pipeline.creaRenderer(ctx);
  if (!ctx.renderer) return avviaSenzaWebGL('renderer non creato');
  creati.add('qualita'); chiama('qualita', 'crea', ctx);
  if (!ctx.qualita) ctx.qualita = { livello: 'base', Q: { ...CFG.QUALITA.livelli.base }, scala: 1, info() { return { livello: 'base' }; } };
  ctx.scene = { pianura: new THREE.Scene(), valle: new THREE.Scene() };
  ctx.scene.pianura.name = 'PIANURA'; ctx.scene.valle.name = 'VALLE';
  ctx.camera = new THREE.PerspectiveCamera(37.8, innerWidth / innerHeight, 0.5, 4000);
  ctx.camera.rotation.order = 'YXZ';
  ctx.stato = creaStato(CFG); ctx.STATO = ctx.stato.STATO; ctx.U = ctx.stato.U;
  ctx.dati.layout = { fv: GEO.calcolaLayout('fv'), agri: GEO.calcolaLayout('agri') };
  creati.add('pipeline'); chiama('pipeline', 'crea', ctx);
  if (!ctx.pipeline) return avviaSenzaWebGL('pipeline non creata');
  ctx.canvas.addEventListener('webglcontextlost', contestoPerso, false);
  ctx.canvas.addEventListener('webglcontextrestored', contestoRipristinato, false);

  // 4. caricamento ordinato (§6.9): font → HDRI → texture del terreno
  await ctx.carica.font(); avanza('font', 1);
  try { await ctx.carica.hdr('qwantani', f => avanza('cielo', f * 0.95)); } catch (e) { segnala('HDRI qwantani', e); }
  avanza('cielo', 1);
  let nt = 0;
  await Promise.allSettled(['terreno_erba_roccia', 'terreno_campo'].map(s => ctx.carica.texture(s, () => avanza('terreno', ++nt / 6))));
  avanza('terreno', 1);

  // 5. servizi di sistema
  for (const n of ['nebbia', 'sole', 'cielo', 'ombre', 'scroll', 'camera']) await crea(n);
  if (!ctx.scroll) ctx.scroll = { T: 0, aggiorna: () => 0, vai() {}, scorri() {}, inSezioni: false, velocita: 0 };

  // 6. contenuti della PIANURA, poi interfaccia
  let g = 0;
  for (const n of ORDINE.pianura) { await crea(n); avanza('geometria', ++g / ORDINE.pianura.length); }
  for (const n of ORDINE.ui) await crea(n);

  // 7. warm-up della PIANURA (compilazione + render per configurazione) e primo fotogramma
  const T0 = flags.T0 != null ? GEO.clamp(flags.T0, 0, CFG.T_FINE) : 0;
  if (flags.T0 != null) ctx.scroll.vai(T0);
  const Tstart = flags.T0 != null ? T0 : (ctx.scroll.aggiorna(0) ?? 0);
  await riscalda('pianura', CFG.WARMUP.pianura, mondoDi(Tstart) === 'pianura' ? Tstart : null);
  avanza('shader', 1); avanza('verifica', 1);

  // 8. eventi della finestra e ciclo unico
  addEventListener('resize', ridimensiona);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => { flags.riduci = e.matches; ctx.eventi.emit('riduci', e.matches); });
  addEventListener('pointermove', e => ctx.rig?.mouse?.(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  document.addEventListener('visibilitychange', () => { tPrec = 0; });
  ultimoMondo = null;
  avviaCiclo();
  if (mondoDi(Tstart) === 'valle') await costruisciValle();
  await vaiTInterno(Tstart);
  document.body.classList.remove('carica');
  window.__eri.pronto = true; risolviPronto();
  ctx.eventi.emit('pronto', ctx);
  if (!flags.intro) { ctx.introFinita = true; ctx.eventi.emit('intro-fine'); }
  inIdle(() => costruisciValle());
}
async function vaiTInterno(T) { ctx.scroll.vai(T); ctx.rig?.salta?.(); passo(0, T); render(0); await dueFotogrammi(); }

function ridimensiona() {
  const w = innerWidth, h = innerHeight;
  ctx.camera.aspect = w / h; ctx.camera.updateProjectionMatrix();
  ctx.pipeline?.ridimensiona?.(w, h);
  for (const n of Object.keys(PERCORSI)) chiama(n, 'ridimensiona', ctx, w, h);
  ctx.eventi.emit('ridimensiona', { w, h });
}
let timerContesto = 0;
function contestoPerso(e) {
  e.preventDefault(); ctx.veli.contesto = 1; document.documentElement.classList.add('contesto-perso');
  ctx.eventi.emit('contesto-perso');
  timerContesto = setTimeout(() => { attivo = false; avviaSenzaWebGL('contesto WebGL non ripristinato'); }, 3000);
}
function contestoRipristinato() {
  clearTimeout(timerContesto); ctx.veli.contesto = 0; document.documentElement.classList.remove('contesto-perso');
  ctx.cielo?.forzaCottura?.(); ctx.eventi.emit('contesto-ripristinato');
}

avvia().catch(e => { segnala('avvio', e); avviaSenzaWebGL('errore di avvio'); });

// Esportati solo per test e strumenti (nessun modulo del sito li importa).
export { ctx, flags, fase, ease };
