// =============================================================================
// ERI v2 · luce/cielo.js — cupola del cielo (sfondo) e ambiente IBL da 2 HDRI miscelate e ruotate
// Proprietario: [BASE-RENDER]. Stato: COMPLETO.
// Specifica: DESIGN §2.4 (HDRI solo come luce, de-solazione, uRot), §2.5 (cupola procedurale, preset),
// §6.3 (shader della cupola, cupolaEnv, cuoci(), desola()), config.COTTURE_PIANURA, config.AMBIENTE_VALLE,
// config.CIELO, config.CIELO_PRESET.
//
// Contratto: crea(ctx) (async) pubblica ctx.cielo = {
//   orizzonte: Color, bagliore: Color,   // colori lineari correnti (gli stessi della nebbia)
//   forzaCottura(): void,                // rifà le cotture al prossimo fotogramma (vaiT, contesto ripristinato)
//   cotturaValle(): Promise,             // ambiente della VALLE (kloofendal ruotata, sole HDRI ad az 210°)
//   azHDRI: {qwantani, kloofendal, autumn},  // azimut del texel più luminoso, PRIMA della de-solazione
//   azAmbiente: number,                  // azimut nel mondo del bagliore della HDRI A dopo la rotazione (freccia ?debug=1)
//   cotture: number                      // contatore (debug)
// }
// Le cotture PMREM avvengono SOLO quando cambia la riga di COTTURE_PIANURA valida per T (funzione pura
// di T: scroll all'indietro e vaiT corretti), o quando arriva una HDRI che la riga aspettava.
// La HDRI non è mai sfondo: lo sfondo è la cupola procedurale, nitida a ogni risoluzione.
// =============================================================================
import * as THREE from 'three';
import { CIELO, COTTURE_PIANURA, AMBIENTE_VALLE, HDRI, PALETTE } from '../config.js';
import { posizioneSole, rad, deg } from '../geo.js';
import { COLORI_CIELO, calcolaCielo } from './nebbia.js';

export const MONDO = 'sistema';

// Tarature dell'ambiente (in config.CIELO.ibl, marcate [ARCH]; DESIGN non dà valori):
//  - luminanza: ogni HDRI si normalizza alla luminanza media del suo emisfero alto (qwantani 1,20 · kloofendal 1,15 ·
//    autumn 1,78 in origine). Il crepuscolo (qwantani: tramonto, ora blu, alba, finale) resta basso perché il sole
//    radente disegni rilievo e ombre; il giorno pieno torna a 1. ENV_GLOBALE di §2.4 regola solo la tappa.
//  - albedoSuolo/tintaSuolo: le HDRI "puresky" non hanno suolo; sotto l'orizzonte si mette un suolo scuro
//    (niente luce "dal basso" sui moduli e sull'acciaio).
//  - saturazione/tinta: le HDRI hanno tinte proprie (qwantani è lilla) che stonano con la palette nero-oro: l'ambiente
//    si desatura in parte e si tinge col colore del cielo procedurale alla riga di cottura.
//  - CIELO.tintaDisco: il disco di §6.3 (1; 0,85; 0,62) × 30 dopo ACES è un punto bianco; tinto col colore del sole
//    ha il nucleo pallido e l'alone arancio di una foto vera (0 = disco esattamente come §6.3).
//  - CIELO.aureola: aureola stretta (~2°) attorno al disco acceso (0 = nessuna).
const IBL = CIELO.ibl;
const LUMINANZA_CIELO = IBL.luminanza;
const ALBEDO_SUOLO = IBL.albedoSuolo;
const TINTA_SUOLO = IBL.tintaSuolo;
const SATURAZIONE_ENV = IBL.saturazione, TINTA_ENV = IBL.tinta;
const TINTA_DISCO = CIELO.tintaDisco;
const AUREOLA = CIELO.aureola;
const LATO_HDRI = IBL.lato;    // dopo la de-solazione le HDRI si ricampionano a 1K (bastano per un cubo PMREM da 256)
const LATO_CUBO = IBL.latoCubo;

// ---------------------------------------------------------------- shader
const VERT = /* glsl */`
  varying vec3 vDir;
  void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Cupola di sfondo (§6.3). Il disco usa la distanza angolare θ = asin|d × s|, precisa anche per 0,27°
// (cos θ in float32 non distingue 0,27° da 0,32°); leggero oscuramento al bordo per un disco "fisico".
const FRAG_CIELO = /* glsl */`
  uniform vec3 uZenit, uOrizzonte, uBagliore, uSoleDir, uDiscoColore, uColoreSole, uNadir;
  uniform float uDisco, uMieG, uEspBagliore, uDiscoR, uDiscoB, uDiscoHDR, uTintaDisco, uAureola, uSuolo, uSuoloH0, uSuoloH1;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir); float h = clamp(d.y, -0.2, 1.0);
    vec3 c = mix(uOrizzonte, uZenit, pow(smoothstep(-0.02, 0.6, h), 0.55));
    float mu = dot(d, uSoleDir);
    c += uBagliore * pow(max(mu, 0.0), uEspBagliore) * (1.0 - smoothstep(0.0, 0.35, h));
    // suolo [ARCH]: sotto l'orizzonte la cupola scende in una piana scura (il mondo vero la copre; la fascia fino a
    // h0 resta del colore dell'orizzonte = nebbia, così il bordo dell'anello del terreno non si vede)
    float s = smoothstep(uSuoloH0, uSuoloH1, d.y);
    vec3 suolo = mix(uOrizzonte * uSuolo + uBagliore * uSuolo * 0.5 * pow(max(mu, 0.0), 2.0), uNadir, smoothstep(uSuoloH1, -0.95, d.y));
    c = mix(c, suolo, s);
    float g = uMieG; float mie = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.02;
    c += uBagliore * mie;
    float th = asin(clamp(length(cross(d, uSoleDir)), 0.0, 1.0));
    float disco = mu > 0.0 ? 1.0 - smoothstep(uDiscoR, uDiscoR + uDiscoB, th) : 0.0;
    float r = clamp(th / uDiscoR, 0.0, 1.0);
    disco *= 0.78 + 0.22 * sqrt(1.0 - r * r);
    vec3 tinta = uColoreSole / max(max(uColoreSole.r, uColoreSole.g), max(uColoreSole.b, 1e-4));
    c += uDiscoColore * mix(vec3(1.0), tinta, uTintaDisco) * uDiscoHDR * disco * uDisco;   // HDR → bloom controllato
    c += tinta * uAureola * uDisco * (exp(-th * 55.0) * 0.8 + exp(-th * 400.0) * 0.6) * step(0.0, mu);   // aureola
    gl_FragColor = vec4(c, 1.0);
  }`;

// Cupola d'ambiente (§6.3): due HDRI ruotate e miscelate, suolo scuro sotto l'orizzonte; la cuoce PMREM.
const FRAG_ENV = /* glsl */`
  #include <common>
  uniform sampler2D tA, tB; uniform float uMix, uRotA, uRotB, uGain, uSat; uniform vec3 uSuoloA, uSuoloB, uTinta;
  varying vec3 vDir;
  vec3 campiona(sampler2D t, vec3 d, float r){ float c = cos(r), s = sin(r); d.xz = mat2(c, -s, s, c) * d.xz; return texture2D(t, equirectUv(d)).rgb; }
  void main(){
    vec3 d = normalize(vDir);
    vec3 col = mix(campiona(tA, d, uRotA), campiona(tB, d, uRotB), uMix);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l) * uTinta, col, uSat);                              // tinta della cupola visibile
    col = mix(col, mix(uSuoloA, uSuoloB, uMix), smoothstep(0.0, -0.08, d.y));
    gl_FragColor = vec4(col * uGain, 1.0);
  }`;

// ---------------------------------------------------------------- de-solazione (§2.4, §6.3)
let LUT = null;
const lut = () => { if (!LUT) { LUT = new Float32Array(65536); for (let i = 0; i < 65536; i++) LUT[i] = THREE.DataUtils.fromHalfFloat(i); } return LUT; };
const UNO_HALF = THREE.DataUtils.toHalfFloat(1);

/**
 * Prepara una HDRI (una volta sola, in place sulla texture in cache del caricatore):
 *  1. azHDRI dal texel più luminoso: azHDRI = (u* − 0,5)·360° + 90° (riga 0 = alto, flipY di RGBELoader);
 *  2. de-solazione: soglia = percentile 99,9 della luminanza su 1 texel ogni 16; i texel sopra si riscalano a soglia;
 *  3. ricampionamento 2×2 a 1K, normalizzazione dell'emisfero alto (LUMINANZA_CIELO[nome]), colore del suolo.
 * È un generatore: desola() lo esegue tutto (preloader), desolaInIdle() a fette di pochi ms (HDRI che arrivano
 * a pagina viva: niente scatti da 60–120 ms durante lo scroll).
 */
function* passiDesola(tex, nome) {
  const t0 = performance.now();
  const img = tex.image, W = img.width, H = img.height, src = img.data;
  const nc = Math.round(src.length / (W * H));
  const L = src instanceof Uint16Array ? lut() : null;
  const v = L ? i => L[src[i]] : i => src[i];
  // 1–2a) texel più luminoso e campione per il percentile
  const passo = HDRI.campionamentoDesolazione || 16;
  const campioni = new Float32Array(Math.ceil(W * H / passo)); let n = 0, max = -1, imax = 0;
  for (let i = 0, k = 0; i < W * H; i++, k += nc) {
    const l = 0.2126 * v(k) + 0.7152 * v(k + 1) + 0.0722 * v(k + 2);
    if (l > max) { max = l; imax = i; }
    if (i % passo === 0) campioni[n++] = l;
    if ((i & 65535) === 65535) yield;
  }
  const ordinati = campioni.subarray(0, n).sort();
  const soglia = Math.max(1e-4, ordinati[Math.min(n - 1, Math.floor(n * (HDRI.percentileDesolazione ?? 0.999)))]);
  const u = ((imax % W) + 0.5) / W, vv = 1 - (Math.floor(imax / W) + 0.5) / H;
  const az = ((u - 0.5) * 360 + 90 + 720) % 360, el = (vv - 0.5) * 180;
  yield;
  // 2b–3) de-solazione + ricampionamento + media dell'emisfero alto (pesata con cos della latitudine)
  const f = Math.max(1, Math.round(W / LATO_HDRI)), W2 = Math.floor(W / f), H2 = Math.floor(H / f);
  const tmp = new Float32Array(W2 * H2 * 3); let sr = 0, sg = 0, sb = 0, sw = 0;
  for (let y = 0; y < H2; y++) {
    const lat = (0.5 - (y + 0.5) / H2) * Math.PI, w = lat > 0 ? Math.cos(lat) : 0;
    for (let x = 0; x < W2; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const k = ((y * f + dy) * W + x * f + dx) * nc;
        let R = v(k), G = v(k + 1), B = v(k + 2);
        const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        if (l > soglia) { const s = soglia / l; R *= s; G *= s; B *= s; }
        r += R; g += G; b += B;
      }
      const j = (y * W2 + x) * 3, q = 1 / (f * f);
      tmp[j] = r * q; tmp[j + 1] = g * q; tmp[j + 2] = b * q;
      if (w) { sr += tmp[j] * w; sg += tmp[j + 1] * w; sb += tmp[j + 2] * w; sw += w; }
    }
    if ((y & 15) === 15) yield;
  }
  const media = (0.2126 * sr + 0.7152 * sg + 0.0722 * sb) / Math.max(sw, 1e-6);
  const obiettivo = LUMINANZA_CIELO[nome] ?? LUMINANZA_CIELO.altro;
  const norma = obiettivo / Math.max(media, 1e-6);
  const out = new Uint16Array(W2 * H2 * 4);
  for (let i = 0, j = 0; i < W2 * H2; i++, j += 3) {
    out[i * 4] = THREE.DataUtils.toHalfFloat(tmp[j] * norma);
    out[i * 4 + 1] = THREE.DataUtils.toHalfFloat(tmp[j + 1] * norma);
    out[i * 4 + 2] = THREE.DataUtils.toHalfFloat(tmp[j + 2] * norma);
    out[i * 4 + 3] = UNO_HALF;
    if ((i & 65535) === 65535) yield;
  }
  tex.image = { data: out, width: W2, height: H2 };
  tex.type = THREE.HalfFloatType; tex.format = THREE.RGBAFormat;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;   // niente cucitura a u = 0/1
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const k = ALBEDO_SUOLO * norma;
  const suolo = new THREE.Color(sr / sw * k * TINTA_SUOLO[0], sg / sw * k * TINTA_SUOLO[1], sb / sw * k * TINTA_SUOLO[2]);
  return (tex.userData.eri = { nome, az, el, soglia, massimo: max, norma, suolo, tex, ms: performance.now() - t0 });
}
/**
 * De-solazione sincrona (preloader).
 * @returns {{nome, az, el, soglia, massimo, norma, suolo:THREE.Color, tex:THREE.DataTexture, ms}}
 */
export function desola(tex, nome = tex.name) {
  if (tex.userData.eri) return tex.userData.eri;
  const g = passiDesola(tex, nome); let r; while (!(r = g.next()).done); return r.value;
}
/** De-solazione a fette di ~6 ms nei momenti liberi (stessa uscita di desola). @returns {Promise<object>} */
export function desolaInIdle(tex, nome = tex.name) {
  if (tex.userData.eri) return Promise.resolve(tex.userData.eri);
  if (tex.userData.eriInCorso) return tex.userData.eriInCorso;
  const g = passiDesola(tex, nome);
  const pausa = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 120 }) : setTimeout(f, 16));
  return (tex.userData.eriInCorso = new Promise((ok, ko) => {
    const fetta = () => {
      try {
        const t = performance.now(); let r;
        do { r = g.next(); } while (!r.done && performance.now() - t < 6);
        if (r.done) ok(r.value); else pausa(fetta);
      } catch (e) { ko(e); }
    };
    pausa(fetta);
  }));
}

// ---------------------------------------------------------------- utilità
/** Riga di COTTURE_PIANURA valida al tempo T (ultima con T_riga ≤ T). */
function rigaCottura(T) { let c = COTTURE_PIANURA[0]; for (const x of COTTURE_PIANURA) if (T >= x.T - 1e-9) c = x; return c; }
/** Azimut del sole al tempo T (stessa logica di regia/stato.js, ma senza scrivere STATO). */
function azSoleA(ctx, T) {
  const st = ctx.stato;
  if (st?.valuta && st.valuta('soleAuto', T) === 1) return posizioneSole(st.valuta('ora', T)).az;
  return st?.valuta ? st.valuta('sole.az', T) : ctx.STATO.sole.az;
}

export async function crea(ctx) {
  const r = ctx.renderer;
  r.setClearColor(new THREE.Color(PALETTE.nero), 1);
  ctx.scene.pianura.background = null; ctx.scene.valle.background = null;   // la HDRI non è mai sfondo

  // ---- cupole di sfondo (§2.5): una per scena, stesso materiale (si disegna un mondo per volta)
  const C = COLORI_CIELO;
  const matCielo = new THREE.ShaderMaterial({
    name: 'ERI.cielo', side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      uZenit: { value: new THREE.Color() }, uOrizzonte: { value: new THREE.Color() }, uBagliore: { value: new THREE.Color() },
      uSoleDir: ctx.U.uSoleDir, uDisco: { value: 0 }, uMieG: { value: CIELO.mieG }, uEspBagliore: { value: CIELO.esponenteBagliore },
      uDiscoR: { value: rad(CIELO.discoRaggio) }, uDiscoB: { value: rad(CIELO.discoBordo) }, uDiscoHDR: { value: CIELO.discoHDR },
      uDiscoColore: { value: new THREE.Vector3(...CIELO.discoColore) },
      uColoreSole: ctx.U.uColoreSole, uTintaDisco: { value: TINTA_DISCO }, uAureola: { value: AUREOLA },
      uSuolo: { value: CIELO.suolo.fattore }, uSuoloH0: { value: CIELO.suolo.h0 }, uSuoloH1: { value: CIELO.suolo.h1 },
      uNadir: { value: new THREE.Color(CIELO.suolo.nadir) },
    },
    vertexShader: VERT, fragmentShader: FRAG_CIELO,
  });
  const geoCupola = new THREE.SphereGeometry(1, CIELO.segmenti[0], CIELO.segmenti[1]);
  const cupole = {};
  for (const nome of ['pianura', 'valle']) {
    const m = new THREE.Mesh(geoCupola, matCielo);
    m.name = 'cupola-' + nome; m.renderOrder = -1; m.frustumCulled = false;
    m.userData.noAO = true; m.userData.sistema = true;
    ctx.scene[nome].add(m); cupole[nome] = m;
  }

  // ---- ambiente: cupola con due HDRI → cubo 256 (CubeCamera) → PMREM (fromCubemap, nel target riusato)
  const matEnv = new THREE.ShaderMaterial({
    name: 'ERI.cupolaEnv', side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uRotA: { value: 0 }, uRotB: { value: 0 }, uGain: { value: 1 },
                uSuoloA: { value: new THREE.Color() }, uSuoloB: { value: new THREE.Color() },
                uSat: { value: SATURAZIONE_ENV }, uTinta: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: VERT, fragmentShader: FRAG_ENV,
  });
  const scenaEnv = new THREE.Scene();
  scenaEnv.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), matEnv));
  const cuboRT = new THREE.WebGLCubeRenderTarget(LATO_CUBO, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cuboCam = new THREE.CubeCamera(0.1, 10, cuboRT);
  const pmrem = new THREE.PMREMGenerator(r);

  const pronte = {};            // nome → risultato di desola()
  const richieste = new Set();
  const st = { chiave: { pianura: null, valle: null }, rt: { pianura: null, valle: null }, az: { pianura: null, valle: null } };

  function prepara(nome) {
    if (pronte[nome] || richieste.has(nome)) return pronte[nome] || null;
    richieste.add(nome);
    ctx.carica.hdr(nome).then(t => desolaInIdle(t, nome)).then(p => {
      pronte[nome] = p; ctx.cielo.azHDRI[nome] = p.az;
    }).catch(e => console.warn(`[cielo] HDRI ${nome} non disponibile: si usa quella di riserva`, e?.message || e));
    return null;
  }

  /** Tinta (luminanza 1) della cupola visibile al tempo T: orizzonte + bagliore del preset di quel momento. */
  const _S = { cielo: null, sole: { el: 0 }, discoSole: 1 }, _col = { zenit: new THREE.Color(), orizzonte: new THREE.Color(), bagliore: new THREE.Color(), soleNebbia: new THREE.Color(), disco: 0 };
  function tintaA(T, out) {
    _S.cielo = T == null ? { da: 'museale', a: 'museale', k: 0 } : (ctx.stato?.valuta?.('cielo', T) ?? ctx.STATO.cielo);
    calcolaCielo(_S, _col);
    out.copy(_col.soleNebbia);
    const l = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b;
    if (l > 1e-6) out.multiplyScalar(1 / l); else out.setRGB(1, 1, 1);
    return out.lerp(_bianco, 1 - TINTA_ENV);
  }
  const _bianco = new THREE.Color(1, 1, 1);
  /** Cottura PMREM (§2.4): 2–5 ms su GPU vere. Il target PMREM si riusa: niente allocazioni, niente dispose. */
  function cuoci(dest, A, B, mix, azA, azB, Tc) {
    const u = matEnv.uniforms;
    tintaA(Tc, u.uTinta.value);
    u.tA.value = A.tex; u.tB.value = (B || A).tex; u.uMix.value = B ? mix : 0;
    u.uRotA.value = rad(azA - A.az); u.uRotB.value = rad((B ? azB : azA) - (B || A).az);
    u.uSuoloA.value.copy(A.suolo); u.uSuoloB.value.copy((B || A).suolo);
    const nu = r.shadowMap.needsUpdate;
    cuboCam.update(r, scenaEnv);
    const prima = st.rt[dest];
    const rt = pmrem.fromCubemap(cuboRT.texture, prima);       // stesso target: la texture d'ambiente non cambia oggetto
    r.shadowMap.needsUpdate = nu;
    st.rt[dest] = rt; ctx.scene[dest].environment = rt.texture;
    ctx.cielo.cotture++;
    st.az[dest] = ((A.az + deg(u.uRotA.value)) % 360 + 360) % 360;   // dove cade ora il bagliore della HDRI A (freccia di test.js)
  }

  /** Cottura della PIANURA per il tempo T, solo se la riga (o le HDRI disponibili) sono cambiate. */
  function ambientePianura(T, forza = false) {
    const c = rigaCottura(T);
    // riserva se la HDRI della riga non è ancora arrivata: meglio un'altra HDRI di giorno che il crepuscolo
    const A = pronte[c.a] || prepara(c.a) || (c.a !== 'qwantani' && (pronte.kloofendal || pronte.autumn)) || pronte.qwantani;
    const B = c.b ? (pronte[c.b] || prepara(c.b)) : null;
    if (!A) return;
    const chiave = `${c.T}|${A.nome}|${B ? B.nome : '-'}`;
    if (!forza && chiave === st.chiave.pianura) return;
    st.chiave.pianura = chiave;
    const azA = c.azA === 'sole' ? azSoleA(ctx, c.T) : c.azA;
    const azB = c.azB === 'sole' ? azSoleA(ctx, c.T) : (c.azB ?? azA);
    cuoci('pianura', A, B, c.mix ?? 0, azA, azB, c.T);
  }
  function ambienteValle() {
    const A = pronte[AMBIENTE_VALLE.a] || pronte.qwantani; if (!A) return;
    const chiave = `valle|${A.nome}`;
    if (chiave === st.chiave.valle) return;
    st.chiave.valle = chiave;
    cuoci('valle', A, null, 0, AMBIENTE_VALLE.azA, AMBIENTE_VALLE.azA, null);
  }

  ctx.cielo = {
    orizzonte: C.orizzonte, bagliore: C.bagliore, colori: C,
    azHDRI: {}, cotture: 0, cupole, materiale: matCielo,
    /** Azimut (°) nel mondo del bagliore della HDRI principale dell'ambiente corrente (= azSole voluto). Per la freccia di ?debug=1. */
    get azAmbiente() { return st.az[ctx.mondo]; },
    forzaCottura() { st.chiave.pianura = null; if (st.rt.valle) st.chiave.valle = null; },
    async cotturaValle() {
      try { const t = await ctx.carica.hdr(AMBIENTE_VALLE.a); pronte[AMBIENTE_VALLE.a] = await desolaInIdle(t, AMBIENTE_VALLE.a); ctx.cielo.azHDRI[AMBIENTE_VALLE.a] = pronte[AMBIENTE_VALLE.a].az; }
      catch (e) { console.warn('[cielo] HDRI della valle non disponibile: si usa qwantani', e?.message || e); }
      ambienteValle();
    },
    /** Statistiche delle HDRI preparate (debug). */
    statistiche() { return Object.fromEntries(Object.entries(pronte).map(([k, p]) => [k, { az: +p.az.toFixed(1), el: +p.el.toFixed(1), soglia: +p.soglia.toFixed(3), massimo: +p.massimo.toFixed(1), norma: +p.norma.toFixed(3), ms: Math.round(p.ms) }])); },
    _ambientePianura: ambientePianura, _ambienteValle: ambienteValle, _st: st,
  };
  ctx.eventi.on('valle-pronta', () => prepara('autumn'));        // autumn serve alle tappe 3c, 5 e 6

  // HDRI iniziale (già scaricata da main.js nel gruppo CIELO) e prima cottura
  try { pronte.qwantani = desola(await ctx.carica.hdr('qwantani'), 'qwantani'); ctx.cielo.azHDRI.qwantani = pronte.qwantani.az; }
  catch (e) { console.warn('[cielo] HDRI qwantani non disponibile: niente IBL', e?.message || e); }
  calcolaCielo(ctx.STATO);
  ambientePianura(ctx.flags.T0 ?? 0);
}

/** Ogni fotogramma: cupola centrata sulla camera, uniform dai preset, cotture ai T di tabella. */
export function aggiorna(ctx, T /*, t, dt */) {
  const cl = ctx.cielo; if (!cl?.cupole) return;
  const C = calcolaCielo(ctx.STATO);           // stessi valori della nebbia (nebbia.js li ha già calcolati)
  const u = cl.materiale.uniforms;
  u.uZenit.value.copy(C.zenit); u.uOrizzonte.value.copy(C.orizzonte); u.uBagliore.value.copy(C.bagliore);
  u.uDisco.value = C.disco;
  const cam = ctx.camera, cupola = cl.cupole[ctx.mondo];
  if (cupola) {
    cupola.position.copy(cam.position);
    cupola.scale.setScalar(Math.min(CIELO.raggio, CIELO.frazioneFar * cam.far));   // sempre dentro il far della camera
  }
  // cotture: mai nel warm-up (il tipo di texture d'ambiente non cambia, i programmi sono gli stessi)
  if (ctx.inWarmup && ctx.scene[ctx.mondo].environment) return;
  if (ctx.mondo === 'pianura') cl._ambientePianura(T);
  else if (cl._st.rt.valle && cl._st.chiave.valle === null) cl._ambienteValle();
}
