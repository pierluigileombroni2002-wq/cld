// =============================================================================
// ERI v2 · render/pipeline.js — renderer, composer, passaggio finale "Pellicola"
// Proprietario: [BASE-RENDER]. Stato: COMPLETO.
// Specifica: DESIGN §6.3 (renderer, composer, GTAO, bloom, OutputPass, SMAA, PELLICOLA), §2.8 (grana,
// vignettatura, grading), §6.8 (risoluzione interna adattiva, tela sempre nativa), config.RENDER.
//
// Catena: RenderPass (HalfFloat, MSAA 4 o 0) → GTAO (solo primi piani) → Bloom (soglia 1,0 in HDR lineare)
//         → OutputPass (ACES/AgX + sRGB) → SMAA (se MSAA 0) → Pellicola (CAS, grading, vignetta, grana,
//         dithering) disegnata sulla tela a risoluzione NATIVA. La risoluzione interna è dprNativo × scala.
//
// Contratto: creaRenderer(ctx) → WebGLRenderer; crea(ctx) pubblica ctx.pipeline = {
//   impostaScena(nome), render(dt), ridimensiona(w, h), applicaQualita(R), scalaInterna,
//   passi: { render, gtao, bloom, uscita, smaa, pellicola }, composer
// }; scrive U.uPx (= dprNativo × scala) e U.uRisoluzione (px interni).
// GTAO: nasconde gli oggetti con userData.noAO; una mesh con vertici spostati nello shader può dare
// userData.materialeNormali (MeshNormalMaterial con la stessa patch): il passaggio delle normali lo usa.
// =============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RENDER, QUALITA, TAPPE } from '../config.js';

export const MONDO = 'sistema';

// ---------------------------------------------------------------- Pellicola (§2.8, codice normativo di §6.3)
// Ingresso: buffer interno già in sRGB (dopo OutputPass/SMAA). Uscita: tela nativa.
// Aggiunte rispetto al codice di §6.3, a valori neutri con ACES: uContrasto (AgX: +0,08) e il recupero del
// ricampionamento quando la scala interna è < 1 (CAS più forte, già previsto da §2.8).
const PELLICOLA = {
  name: 'Pellicola',
  uniforms: {
    tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) },
    uNitidezza: { value: RENDER.pellicola.nitidezza }, uVignetta: { value: RENDER.pellicola.vignetta },
    uSpostamento: { value: RENDER.pellicola.spostamentoVignetta },
    uGrana: { value: RENDER.pellicola.grana }, uGranaEstremi: { value: RENDER.pellicola.granaEstremi / RENDER.pellicola.grana },
    uTempo: { value: 0 }, uSaturazione: { value: 1 }, uLato: { value: RENDER.pellicola.lato }, uContrasto: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uTexel;
    uniform float uNitidezza, uVignetta, uSpostamento, uGrana, uGranaEstremi, uTempo, uSaturazione, uLato, uContrasto;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    // nitidezza adattiva al contrasto (stile AMD CAS) sul ricampionamento dal buffer interno
    vec3 cas(vec2 uv){
      vec3 e = texture2D(tDiffuse, uv).rgb;
      vec3 a = texture2D(tDiffuse, uv - vec2(uTexel.x, 0.)).rgb, b = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.)).rgb;
      vec3 c = texture2D(tDiffuse, uv - vec2(0., uTexel.y)).rgb, d = texture2D(tDiffuse, uv + vec2(0., uTexel.y)).rgb;
      vec3 mn = min(e, min(min(a, b), min(c, d))), mx = max(e, max(max(a, b), max(c, d)));
      vec3 amp = sqrt(clamp(min(mn, 1. - mx) / max(mx, 1e-4), 0., 1.));
      vec3 w = -amp * mix(.125, .2, uNitidezza);
      return clamp((e + (a + b + c + d) * w) / (1. + 4. * w), 0., 1.);
    }
    void main(){
      vec3 c = cas(vUv);
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(vec3(l), c, uSaturazione);                                   // saturazione per tappa
      c = clamp((c - .5) * (1. + uContrasto) + .5, 0., 1.);                 // contrasto (solo AgX)
      c += vec3(.02, 0., -.01) * smoothstep(.6, 1., l) + vec3(0., 0., .008) * (1. - smoothstep(0., .15, l));  // luci calde, ombre fredde
      vec2 q = vUv - vec2(.5 + uSpostamento * uLato, .5); q.x *= 1.15;       // vignetta ellittica, centro opposto al testo
      c *= 1. - uVignetta * smoothstep(.35, .95, length(q) * 1.4);
      c += (h12(gl_FragCoord.xy + floor(uTempo * 24.) * 17.) - .5) * uGrana * mix(uGranaEstremi, 1., 1. - abs(l * 2. - 1.));   // grana a 24 fps
      c += (h12(gl_FragCoord.xy * 1.37 + 3.1) + h12(gl_FragCoord.xy * .73 + 7.7) - 1.) / 255.;   // dithering triangolare
      gl_FragColor = vec4(c, 1.);
    }`,
};

/**
 * Crea il renderer (prima di qualità e scene). La tela resta SEMPRE a dprNativo (§6.8).
 * @returns {THREE.WebGLRenderer}
 */
export function creaRenderer(ctx) {
  const r = new THREE.WebGLRenderer({ canvas: ctx.canvas, antialias: false, powerPreference: 'high-performance',
    stencil: false, depth: true, preserveDrawingBuffer: !!ctx.flags.test });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = ctx.flags.tm === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;  // applicato da OutputPass
  r.toneMappingExposure = RENDER.esposizioneIniziale;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;           // MAI cambiarlo a runtime (PCF rispetta shadow.radius)
  r.shadowMap.autoUpdate = false;                  // needsUpdate solo da render/ombre.js
  r.shadowMap.needsUpdate = true;
  r.localClippingEnabled = true;
  r.setPixelRatio(ctx.dprNativo);
  r.setSize(innerWidth, innerHeight, false);       // dimensione CSS della tela: la decide stile.css (100vw × 100vh)
  r.setClearColor(0x050607, 1);
  r.info.autoReset = false;                        // le statistiche contano TUTTO il fotogramma (render.reset in render())
  ctx.renderer = r;
  return r;
}

/** Composer e passaggi. Sincrona: i moduli di three/addons sono importati staticamente. */
export function crea(ctx) {
  const r = ctx.renderer, Q = ctx.qualita.Q;
  if (!ctx.qualita.R) ctx.qualita.R = { scalaGradino: 1, msaa: Q.msaa, smaa: !Q.msaa, gtao: Q.gtao, ombra: Q.ombra, bloom: true };   // qualita.js assente
  const R = ctx.qualita.R;
  const agx = ctx.flags.tm === 'agx';
  const scalaAgx = agx ? RENDER.agx.esposizione : 1;

  // Buffer della scena: HalfFloat con MSAA (4) o senza (0 + SMAA). Il secondo buffer non ha MSAA:
  // a ogni fotogramma il RenderPass disegna sempre nel primo (vedi render()).
  const rtScena = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: R.msaa, depthBuffer: true, stencilBuffer: false });
  rtScena.texture.name = 'ERI.scena';
  const composer = new EffectComposer(r, rtScena);
  const rtAltro = composer.renderTarget2; rtAltro.samples = 0; rtAltro.texture.name = 'ERI.post';

  const W = innerWidth, H = innerHeight, s0 = ctx.qualita.scala, wInt = Math.max(1, Math.round(W * ctx.dprNativo * s0)), hInt = Math.max(1, Math.round(H * ctx.dprNativo * s0));
  composer._pixelRatio = ctx.dprNativo * s0;
  composer.setSize(W, H);

  let scena = ctx.scene.pianura;
  const passRender = new RenderPass(scena, ctx.camera);

  // ---- GTAO (§6.3): unità mondo, acceso solo nei primi piani (STATO.gtao), mezza risoluzione su Ultra/Alta
  const gtao = new GTAOPass(scena, ctx.camera, wInt, hInt);
  if (Q.gtaoMezza) {
    const s = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => s(Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
    gtao.setSize(wInt, hInt);
  }
  gtao.updateGtaoMaterial({ ...RENDER.gtao });
  gtao.updatePdMaterial({ ...RENDER.gtaoPd });
  gtao.blendIntensity = 0;
  gtao.enabled = false;
  // esclusioni dall'AO: userData.noAO (linee LineSegments2, getti, colonne, fogli, tende, cupole, involucri tagliati)
  const ovVis = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => { ovVis(); gtao.scene.traverse(o => { if (o.userData.noAO) o.visible = false; }); };
  // passaggio delle normali: rispetta userData.materialeNormali (vertici spostati nello shader, piani di taglio)
  const scambi = [], _cc = new THREE.Color();
  const ro = gtao.renderOverride.bind(gtao);
  gtao.renderOverride = (renderer, materiale, target, coloreSfondo, alfa) => {
    let speciali = false;
    gtao.scene.traverseVisible(o => { if (o.isMesh && o.userData.materialeNormali) speciali = true; });
    if (!speciali) return ro(renderer, materiale, target, coloreSfondo, alfa);
    // stesso lavoro di GTAOPass.renderOverride, ma con il materiale delle normali scelto per oggetto
    gtao.scene.traverseVisible(o => { if (o.isMesh) { scambi.push(o, o.material); o.material = o.userData.materialeNormali || materiale; } });
    renderer.getClearColor(_cc); const ca = renderer.getClearAlpha(), ac = renderer.autoClear;
    renderer.setRenderTarget(target); renderer.autoClear = false;
    renderer.setClearColor(coloreSfondo); renderer.setClearAlpha(alfa || 0); renderer.clear();
    try { renderer.render(gtao.scene, gtao.camera); }
    finally {
      for (let i = 0; i < scambi.length; i += 2) scambi[i].material = scambi[i + 1];
      scambi.length = 0;
      renderer.autoClear = ac; renderer.setClearColor(_cc); renderer.setClearAlpha(ca);
    }
  };

  // ---- Bloom (soglia 1,0 in HDR lineare: fa bloom solo il dato emissivo) e uscita
  const bloom = new UnrealBloomPass(new THREE.Vector2(wInt, hInt), RENDER.bloom.forza, RENDER.bloom.raggio, RENDER.bloom.soglia);
  const uscita = new OutputPass();
  const smaa = new SMAAPass(wInt, hInt);
  smaa.enabled = R.msaa === 0;
  const pellicola = new ShaderPass(PELLICOLA);
  pellicola.material.name = 'ERI.pellicola';
  if (agx) { pellicola.uniforms.uContrasto.value = RENDER.agx.contrasto; }
  [passRender, gtao, bloom, uscita, smaa, pellicola].forEach(p => composer.addPass(p));

  const U = ctx.U, PU = pellicola.uniforms, _dim = new THREE.Vector2();
  const st = { gtaoRaggio: -1, msaa: R.msaa, fermoDa: 0, frame: 0 };
  const TAPPA_FINALE = TAPPE[TAPPE.length - 1].T0;

  const P = ctx.pipeline = {
    scalaInterna: s0,
    composer,
    passi: { render: passRender, gtao, bloom, uscita, smaa, pellicola },
    /** Scena attiva ('pianura' | 'valle'): un solo composer, si scambiano le scene. */
    impostaScena(nome) {
      scena = ctx.scene[nome] || ctx.scene.pianura;
      passRender.scene = scena; gtao.scene = scena;
    },
    /** Un fotogramma completo. dt = 0 nei passi forzati (vaiT, warm-up): mai saltati. */
    render(dt) {
      const S = ctx.STATO, R = ctx.qualita.R;
      // 30 fps nel finale fermo da più di 4 s (§6.8)
      st.frame++;
      if (dt > 0 && S.T >= TAPPA_FINALE && !ctx.flags.test) {
        if ((ctx.scroll?.velocita ?? 0) > 1) st.fermoDa = 0; else st.fermoDa += dt;
        if (st.fermoDa > QUALITA.finaleFermo.secondi && (st.frame & 1)) return;
      } else st.fermoDa = 0;

      r.toneMappingExposure = S.esposizione * scalaAgx;
      PU.uSaturazione.value = S.saturazione * (agx ? 1 + RENDER.agx.saturazione : 1);
      PU.uTempo.value = ctx.flags.riduci ? 0 : ctx.tempo.t;            // riduci movimento: grana statica

      // GTAO solo se il livello lo prevede e la tappa lo chiede; nel warm-up sempre (compila i programmi)
      const warm = !!ctx.inWarmup;
      gtao.enabled = R.gtao && (S.gtao > 0.005 || warm);
      if (gtao.enabled) {
        gtao.blendIntensity = warm ? Math.max(S.gtao, 0.5) : S.gtao;
        if (S.gtaoRaggio !== st.gtaoRaggio) { st.gtaoRaggio = S.gtaoRaggio; gtao.gtaoMaterial.uniforms.radius.value = S.gtaoRaggio; }
      }
      bloom.enabled = R.bloom;
      smaa.enabled = R.smaa || warm;                                   // nel warm-up si compila anche SMAA

      // il RenderPass disegna nel buffer con MSAA: lo stato dei buffer non dipende dai passaggi accesi prima
      composer.readBuffer = rtScena; composer.writeBuffer = rtAltro;
      r.info.reset();                                                  // chiamate e triangoli di questo fotogramma (ombre comprese)
      composer.render(dt);
    },
    /** Tela nativa (dprNativo), composer alla risoluzione interna dprNativo × scala. */
    ridimensiona(w = innerWidth, h = innerHeight) {
      ctx.qualita.ricalcola?.();
      const scala = ctx.qualita.scala;
      // la tela si tocca solo se cambia davvero (riassegnare width/height la svuota e la rialloca)
      r.getSize(_dim);
      if (_dim.x !== w || _dim.y !== h || r.getPixelRatio() !== ctx.dprNativo) { r.setPixelRatio(ctx.dprNativo); r.setSize(w, h, false); }
      composer._pixelRatio = ctx.dprNativo * scala;    // una sola riallocazione (setPixelRatio + setSize ne farebbero due)
      composer.setSize(w, h);
      P.scalaInterna = scala;
      const wi = Math.max(1, Math.round(w * ctx.dprNativo * scala)), hi = Math.max(1, Math.round(h * ctx.dprNativo * scala));
      U.uPx.value = ctx.dprNativo * scala;
      U.uRisoluzione.value.set(wi, hi);
      PU.uTexel.value.set(1 / wi, 1 / hi);
      // CAS più forte quando il buffer interno è sotto 0,9 della tela (§2.8)
      PU.uNitidezza.value = scala < RENDER.pellicola.sogliaScalaBassa ? RENDER.pellicola.nitidezzaScalaBassa : RENDER.pellicola.nitidezza;
      applicaMsaa(ctx.qualita.R.msaa);
    },
    /**
     * Gradini del governatore (§6.8): scala interna, GTAO, taglia dell'ombra, MSAA ↔ SMAA, bloom.
     * Mai cambi di defines, di shadowMap.type o del numero di luci.
     * @param {object} R ctx.qualita.R
     */
    applicaQualita(R) {
      if (!R) return;
      if (Math.abs(ctx.qualita.scala - P.scalaInterna) > 1e-4 || R.msaa !== st.msaa) P.ridimensiona(innerWidth, innerHeight);
      ctx.ombre?.taglia?.(R.ombra);
    },
  };
  function applicaMsaa(n) {
    if (n === st.msaa) return;
    st.msaa = n; rtScena.samples = n; rtScena.dispose();   // si rialloca al prossimo uso con i nuovi campioni
  }
  P.ridimensiona(innerWidth, innerHeight);
}
