# ERI v2: technique dossier for Three.js r160 on a static site with CDN add-ons

I checked the API facts marked **[r160 ✓]** against the `three@0.160.0` files on jsdelivr. Code comments are in Italian, as the project requires.

---

## 0. Verified facts that change the plan

| Fact | Consequence |
|---|---|
| `AgXToneMapping` exists in r160 **[r160 ✓]**, and `OutputPass` supports it (`AGX_TONE_MAPPING` define) | We can compare ACES and AgX with a URL flag. |
| r160 has **no** `scene.environmentIntensity`, `backgroundRotation` or `environmentRotation` **[r160 ✓]** (they arrived later) | Set env strength per material with `envMapIntensity`. Rotate or blend the HDRI with the `pmrem.fromScene` trick in §1. |
| `scene.backgroundIntensity` and `scene.backgroundBlurriness` exist **[r160 ✓]** | These give a quick dimmed sky if you don't want a custom dome. |
| `GTAOPass(scene, camera, width, height, parameters, aoParameters, pdParameters)` **[r160 ✓]**, `GTAOPass.OUTPUT = {Default, Diffuse, Depth, Normal, AO, Denoise}` | The AO pass re-renders the scene with a `MeshNormalMaterial` override. It hides only `Points` and `Line` objects **[r160 ✓]**. |
| `SMAAPass(width, height)`, `UnrealBloomPass(resolution, strength, radius, threshold)`, `OutputPass()`, `EffectComposer(renderer, renderTarget)` **[r160 ✓]** | — |
| `WebGLRenderTarget` defaults to `stencilBuffer: false` **[r160 ✓]**. `WebGLRenderer` defaults to `stencil: true` in r160 | Stencil caps for cut-aways **fail inside the composer** unless the target has `stencilBuffer: true`. |
| `renderer.compileAsync(scene, camera, targetScene)` and `renderer.initTexture(tex)` exist **[r160 ✓]**. `compile` uses `traverseVisible` **[r160 ✓]** | Objects that are hidden during warm-up are **not** pre-compiled. |
| `RGBELoader` defaults to `HalfFloatType` **[r160 ✓]** | Keep it. It is safe on SwiftShader. |
| `CSM.js`, `ParametricGeometry.js`, `BufferGeometryUtils` (`mergeGeometries`, `mergeVertices`, `toCreasedNormals`), `capabilities/WebGL.js`, `KTX2Loader` + basis transcoder, and the Draco decoder all return 200 on jsdelivr at 0.160.0 | — |
| `examples/textures/water/*.jpg` and `waternormals.jpg` return **404** on jsdelivr (npm ships no example textures) | `Water.js`/`Water2.js` need normal maps that you either copy into `asset/texture/` from the GitHub repo (MIT) or generate on a canvas. |
| Lenis 1.1.13: `https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js` (UMD, global `Lenis`) and `/dist/lenis.css`, both 200 | — |
| `THREE.MathUtils.damp(x, y, lambda, dt)` and `smootherstep(x, min, max)` **[r160 ✓]** | — |

---

## 1. Renderer, HDRI lighting, dark graded background, tone mapping

```js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, // l'AA lo fa il composer (MSAA sul target)
  powerPreference: 'high-performance', stencil: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // applicato da OutputPass, non dal RenderPass
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;          // vedi §3: in r160 PCF rispetta shadow.radius
renderer.localClippingEnabled = true;                  // per le sezioni delle turbine
```

**Use the HDRI for lighting, not as the background.** Load `qwantani_dusk_2` first, and lazy-load the other two after first paint with `requestIdleCallback`. The environment only lights the scene: the PMREM cube is 256 px per face, so a **1K .hdr is enough**. The 2K files are 4–5 MB each; download the 1K versions from Poly Haven to save about 10 MB.

**Rotating and blending HDRIs without r162+.** Bake the environment from a tiny scene:

```js
// Cupola che mescola due HDRI e li ruota; poi PMREM la "cuoce" in scene.environment
const domeMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { tA: { value: hdrTramonto }, tB: { value: hdrGiorno }, uMix: { value: 0 }, uRot: { value: 0 }, uGain: { value: 1 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `#include <common>
    uniform sampler2D tA, tB; uniform float uMix, uRot, uGain; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir);
      float c = cos(uRot), s = sin(uRot); d.xz = mat2(c,-s,s,c)*d.xz;
      vec2 uv = equirectUv(d);                      // funzione di <common>
      gl_FragColor = vec4(mix(texture2D(tA,uv).rgb, texture2D(tB,uv).rgb, uMix)*uGain, 1.); }`
});
const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), domeMat));
let envRT = pmrem.fromScene(envScene, 0, 0.1, 10);   // r160: (scene, sigma, near, far)
scene.environment = envRT.texture;
// a un cambio di tappa: aggiorna uMix/uRot, envRT.dispose(), envRT = pmrem.fromScene(...)  (~2–5 ms)
```

Re-bake only at stage transitions, in 4–6 steps hidden by camera motion. Never re-bake every frame.

**Match the sun to the HDRI.** At load time, scan `hdr.image.data` (half floats, decoded with `THREE.DataUtils.fromHalfFloat`) for the brightest texel. Convert it to azimuth and elevation and point the `DirectionalLight` from there. Specular glints on the module glass then agree with the cast shadows, a subtle cue that sells realism.

**Background.** Leave `scene.background = null` and use a **custom sky dome**: a `SphereGeometry` with `BackSide` and `fog: false`, smaller than `camera.far`. The shader blends a near-black zenith (#050607) into a low warm horizon glow built from gold #d8b878 × 0.15, plus a soft sun halo. Use the same horizon colour for `scene.fog = new THREE.FogExp2(horizon, 0.0035)`. The terrain then dissolves into the sky and the world's edge never shows.

**Tone mapping.**
- **ACES** in r160 multiplies exposure by 1/0.6 internally. It gives the punchy, contrasty look of v1, which the owner loved. It pushes saturated oranges toward yellow and white, so gold emissives clip to pale yellow.
- **AgX** keeps the hue of bright gold lines and of the sunset, and bloom highlights roll off more filmically. It looks flatter: it needs exposure of about 1.2–1.6 plus a small contrast and saturation lift in a grade pass.
- **Recommendation:** default to ACES for continuity and add `?tm=agx` to compare on the real monitor.
- Brand colours that must be exact (UI and logo) stay in HTML/CSS. Tone mapping always shifts 3D colours.

**Colour management.**
- Diffuse and canvas textures: `colorSpace = THREE.SRGBColorSpace`. On WebGL2 they upload as `SRGB8_ALPHA8`, so `texture2D` returns linear values, including in custom splat samplers.
- Normal and ARM textures stay in `NoColorSpace`.
- ARM maps to three.js directly: R = AO (`aoMap`), G = roughness (`roughnessMap`), B = metalness (`metalnessMap`).
- Since r151, `aoMap` uses `texture.channel` (default 0), not `uv2`.

---

## 2. Post stack: MSAA vs SMAA, GTAO, bloom, final grade

```js
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa /*4 o 0*/, stencilBuffer: true });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);   // passa w*dpr,h*dpr a ogni pass.setSize
composer.addPass(new RenderPass(scene, camera));

const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 16,
                          distanceFallOff: 1.0, screenSpaceRadius: false });   // unità mondo: 1 = 1 m
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
gtao.blendIntensity = 0.8;
composer.addPass(gtao);

const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());             // tone mapping + sRGB qui
composer.addPass(gradePass);                    // ShaderPass LDR: dither, vignetta, grana, aberrazione minima
if (!Q.msaa) composer.addPass(new SMAAPass(innerWidth * dpr, innerHeight * dpr)); // SMAA lavora meglio in sRGB
```

**Anti-aliasing.**
- On desktop WebGL2, use **MSAA 4×** on the composer target. It handles thin geometry best (tracker posts, torque tubes, the cadastral lines on the terrain mesh) and costs little at DPR 1–1.5.
- At DPR 2, or when the frame-time governor demotes quality, switch to `samples: 0` plus SMAA, placed **after** OutputPass so its luma edge detection runs on display-referred values.
- Shader lines (contours, grid) are anti-aliased in the shader with `fwidth`, so MSAA doesn't need to cover them.

**GTAO gotchas (r160).**
1. The AO normal pass uses `MeshNormalMaterial` through `overrideMaterial`. It **ignores `onBeforeCompile` vertex displacement and per-material clipping planes**. That is why the terrain lift in §4 uses `mesh.scale.y`, and why `gtao.blendIntensity` tweens to 0 during cut-aways.
2. Only Points and Lines are hidden from AO. **Transparent water jets, label sprites and overlay planes would darken the image.** Wrap the pass to hide them too:
   ```js
   const ov = gtao.overrideVisibility.bind(gtao);
   gtao.overrideVisibility = () => { ov(); scene.traverse(o => { if (o.userData.noAO) o.visible = false; }); };
   ```
   Its `restoreVisibility` already uses the visibility cache.
3. AO is a close-up effect. Fade `blendIntensity` from 0.3 in overview shots to 0.9 on the tracker and turbine close-ups.
4. On the "high" tier, run GTAO at half resolution: `const s = gtao.setSize.bind(gtao); gtao.setSize = (w,h) => s(w*0.5, h*0.5);`.

**Bloom.**
- The threshold applies to linear HDR values before tone mapping. Keep everything physically lit below about 0.9.
- Give only *intentional* light sources HDR values above 1: contour and grid emissive (×2–3), the connection cable, water-jet cores and the sun disc.
- That gives selective bloom with a single composer. Skip the layer-based two-composer selective bloom, which costs a second full scene render at 4K.
- Strength 0.3–0.45 and radius 0.5–0.6 suit an elegant look. Above 0.6 strength it starts to look like a game.

**Grade pass.** A tiny `ShaderPass` after OutputPass:
- `col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0` to **dither** dark gradients. Without it, banding is visible on 4K panels in the black-to-gold sky.
- Vignette of about 0.25.
- Film grain at 0.02–0.03 amplitude, animated.
- Optional chromatic aberration of 0.5–1 px, edges only.

This pass turns clean CG into a "camera" image.

---

## 3. Soft, stable sun shadows on a 250×250 world

Use one `DirectionalLight` that casts shadows. **Keep the number of lights constant for the whole page.** Adding or removing a light, or toggling `castShadow`, recompiles every material and causes a hitch; animate `intensity` instead.

```js
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);        // 4096 ultra, 2048 high
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.05;                      // in unità mondo lungo la normale: elimina l'acne sul terreno radente
sun.shadow.radius = 3;                             // PCFShadowMap r160 lo usa; PCFSoftShadowMap lo IGNORA
sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
scene.add(sun.target);

// Inquadratura dell'ombra per tappa + aggancio al texel (niente tremolio quando la camera si muove)
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function adattaOmbra(centro, meta) {
  const dir = sunDir;                                    // versore dal centro verso il sole
  const texel = (2 * meta) / sun.shadow.mapSize.x;
  _r.crossVectors(UP, dir).normalize(); _u.crossVectors(dir, _r);
  const a = Math.round(centro.dot(_r) / texel) * texel, b = Math.round(centro.dot(_u) / texel) * texel;
  const c = centro.dot(dir);
  const snapped = new THREE.Vector3().addScaledVector(_r, a).addScaledVector(_u, b).addScaledVector(dir, c);
  sun.target.position.copy(snapped); sun.position.copy(snapped).addScaledVector(dir, 200);
  const cam = sun.shadow.camera; cam.left = cam.bottom = -meta; cam.right = cam.top = meta; cam.updateProjectionMatrix();
}
```

**Half-size per stage:**

| Stage | `meta` | Texel at 4096 |
|---|---|---|
| Overview | 130 | 0.063 m |
| Development | 70 | — |
| Tracker close-up | 18 | 9 mm, razor-crisp panel shadows |
| Hydro | 25 | — |

Tween `meta` only during camera moves: the scale change shimmers briefly, and motion hides it.

**Shadow-map type.**
- **PCFShadowMap with radius 2–4**: soft and controllable. This is the recommendation.
- **PCFSoftShadowMap**: nice, but its softness is fixed.
- **VSM** (`radius` 8–20, `blurSamples` 8–16): the softest penumbrae. In r160 it also renders every *receiver* into the shadow map (`castShadow || receiveShadow`) **[r160 ✓]**, which means the 260k-vertex terrain, plus a blur pass. It also leaks light under thin panels. Avoid it.
- Never switch the type at runtime: that recompiles every program.

**Terrain casts shadows too.** A low dusk sun throws long hill shadows across the gold contour lines, which is one of the cheapest wow shots available.

**Performance at 4K.** Set `renderer.shadowMap.autoUpdate = false` and `renderer.shadowMap.needsUpdate = true` only when the sun moves, trackers rotate or `adattaOmbra` runs. The shadow pass is skipped on most frames.

**Contact shadows.** GTAO covers the feet of posts and the crop rows under the panels. CSM (`addons/csm/CSM.js`, available) is an option for continuous zooms. It patches shader chunks globally and calls `setupMaterial` on every material, which clashes with custom `onBeforeCompile` terrain work, so prefer per-stage fitting.

---

## 4. Terrain: PBR splat, cadastral overlay in the same shader, map-to-3D lift

**Geometry.**
- `PlaneGeometry(250, 250, 512, 512)` (768 on ultra), with `geo.rotateX(-Math.PI/2)` **baked into the geometry** so that object-space y is up.
- Displace on the CPU with v1's `altezza(x,z)`, carve the riverbed (lower heights within ±w of `fiumeX(z)`), then `computeVertexNormals()`.
- Store the original height as an attribute `aAltezza`: it drives contours even while the map is flat.
- Add a 1500-unit low-poly skirt ring at the same edge height, faded into fog, so the world never shows an edge.
- Alternative "diorama tile" look: a cut edge with gold strata hatching on the sides.

**Material.** Use a `MeshStandardMaterial` with `map`/`normalMap`/`roughnessMap` = the grass-rock set and `metalness: 0`. Assigning these maps turns on `vMapUv`, the TBN (`USE_NORMALMAP_TANGENTSPACE`) and PBR lighting, so you only swap the *samples* in `onBeforeCompile`:

```js
mat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U); // tCampoDiff/Nor/Arm, tErbaArm, tStati, uSollevamento, uOro, uVincolo, uIso, uGriglia, uVincoli...
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aAltezza; varying float vAlt; varying vec3 vPosMondo; varying vec3 vNorMondo;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlt = aAltezza; vPosMondo = (modelMatrix*vec4(transformed,1.)).xyz; vNorMondo = normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + DICHIARAZIONI_GLSL)       // uniform, varying, rumore, noTile()
    .replace('#include <map_fragment>', SPLAT_GLSL)                                  // calcola albedo, armSplat, norSplat
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * armSplat.g;')
    .replace('#include <normal_fragment_maps>',
      THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv ).xyz', 'norSplat'))
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + OVERLAY_GLSL);
};
```

**Splat chunk** (it runs first in `main()`, so its variables stay in scope for the later chunks):

```glsl
vec2 uvT = vMapUv * uRipetizione;                     // usa vMapUv: stessa orientazione del TBN (non vPosMondo.xz, che inverte v)
float pend = 1.0 - vNorMondo.y;                       // pendenza
float wRoccia = smoothstep(0.18, 0.35, pend);
float wCampo  = texture2D(tMaschere, vMapUv).r * (1.0 - wRoccia);   // campi arati dalla mappa catastale
wCampo = smoothstep(0.35, 0.65, wCampo + (vnoise(vPosMondo.xz*0.15)-0.5)*0.3); // bordi naturali
vec4 dA = noTile(map, uvT), dB = noTile(tCampoDiff, uvT*1.3);
vec3 albedo = mix(dA.rgb, dB.rgb, wCampo);
albedo *= mix(0.82, 1.08, vnoise(vPosMondo.xz*0.02));                // variazione macro: rompe la ripetizione
albedo = mix(albedo, vec3(0.010, 0.011, 0.012), uModoMappa);         // "carta" scura nella fase mappa
diffuseColor.rgb *= albedo;
vec4 armSplat = mix(noTile(tErbaArm, uvT), noTile(tCampoArm, uvT*1.3), wCampo);
vec3 norSplat = mix(noTile(normalMap, uvT).xyz, noTile(tCampoNor, uvT*1.3).xyz, wCampo);
```

**Tiling break.** `noTile` blends the plain sample with a rotated and offset sample, chosen by low-frequency noise. For normal maps, rotate the second sample's `xy` back by the inverse rotation, or its lighting points the wrong way:

```glsl
vec4 noTile(sampler2D t, vec2 uv){
  float k = smoothstep(0.35, 0.65, vnoise(uv*0.07));
  vec2 uv2 = mat2(0.8,-0.6,0.6,0.8)*uv + vec2(0.37,0.11);
  return mix(texture2D(t, uv), texture2D(t, uv2), k);
}
```

Full triplanar isn't worth three times the fetches on gentle hills. If needed, apply it only where `wRoccia > 0`.

**AO from the ARM map.** Either skip `aoMap` (GTAO plus env is enough) or patch the aomap chunk the same way: `ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r', 'armSplat.r')`.

**Set anisotropy to the maximum on every terrain texture:** `tex.anisotropy = renderer.capabilities.getMaxAnisotropy()`. At grazing aerial angles this is the single biggest sharpness gain.

**Overlay chunk.** It writes into `totalEmissiveRadiance`, so lines glow, bloom and sit on top of PBR shading:

```glsl
float linea(float v, float spessore){ float fw = fwidth(v); float d = abs(fract(v-0.5)-0.5)/fw;
  return (1.0 - clamp(d - spessore, 0.0, 1.0)) * (1.0 - smoothstep(0.3, 0.8, fw)); } // svanisce in lontananza: niente moiré
float iso = linea(vAlt / 2.5, 0.3) + 0.6*linea(vAlt / 12.5, 0.8);                     // isoipse ogni 2,5 m, maestra ogni 12,5 m
vec2 g = mat2(cosA,-sinA,sinA,cosA) * vPosMondo.xz / uCella;
vec2 gf = abs(fract(g-0.5)-0.5)/fwidth(g); float griglia = 1.0 - clamp(min(gf.x,gf.y)-0.5, 0., 1.);
vec4 stato = texture2D(tStati, (floor(g) + 0.5 + uN*0.5) / uN);                   // DataTexture NearestFilter
float t = (g.x+g.y)*4.0; float tratt = 1.0 - clamp(abs(fract(t)-0.5)/fwidth(t) - 0.6, 0., 1.);
float fronte = smoothstep(uFronte, uFronte - 25.0, length(vPosMondo.xz - uOrigine)); // onda radiale di accensione
totalEmissiveRadiance += fronte * ( uOro*2.2*iso*uIso + uOro*1.6*griglia*uGriglia
   + uVincolo*1.8*tratt*stato.g*uVincoli + uSmeraldo*0.5*stato.r*uIdonee );
```

Contours come from `vAlt`, the original height, not `vPosMondo.y`. They therefore exist on the flat map exactly like a topographic sheet and rise with the land.

**Lift transition (stage 0).**
1. Start with `terrain.scale.y = 0.001`, `uModoMappa = 1`, the camera nearly top-down with FOV about 16° from high up.
2. GSAP scrubs `scale.y` 0.001 → 1 (power2.inOut) **while** a dolly-zoom widens the FOV from 16° to 38° and drops the camera to about 35° pitch.
3. `uModoMappa` goes 1 → 0.25: paper becomes PBR soil, and the lines stay.

Object scale passes correctly through shadows, the GTAO normal pass and `normalMatrix` with no extra work.

If you want a true radial lift in the vertex shader instead, inject the same displacement into `customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })`. Bend normals in `beginnormal_vertex` (`objectNormal = normalize(mix(vec3(0,1,0), objectNormal, k))`) and fade GTAO during the move.

---

## 5. Water: river, penstock, Pelton jets, spray

**River.** Use a custom ribbon instead of `Water.js` (a mirror re-render of the scene, roughly double cost at 4K) or `Water2.js` (reflector plus refractor, two extra renders, and its normal textures aren't on the CDN).
- Build a ribbon `BufferGeometry` along a `CatmullRomCurve3` that follows `fiumeX(z)` at carved height minus 0.3, with u across and v along the arc length.
- Material: `MeshPhysicalMaterial({ color:'#0a171c', roughness: 0.06, metalness: 0, clearcoat: 0.6, envMapIntensity: 1.4 })`. The dusk HDRI reflected in the river *is* the shot.
- In `onBeforeCompile`, replace `normal_fragment_maps` with two normal-map samples scrolling along v at different speeds and scales: `uv + vec2(0, uTempo*0.05)` and `uv*1.7 - vec2(0.02, uTempo*0.08)`, blended in `xy`.
- Edge foam: `smoothstep(0.42, 0.5, abs(vUv.x-0.5))` × noise into emissive at 0.15.
- Normal map: a 512² canvas of value noise converted to a normal (Sobel, 4 taps) at startup, or `waternormals.jpg` copied into `asset/texture/`.

**Penstock.** `TubeGeometry` along the dam-to-powerhouse curve, in dark-steel PBR.
- During the cut-away, a half-pipe clip (§6) reveals **flow lines**: 6–10 thin tubes inside it with a dash shader `step(0.6, fract(vUv.x*20. - uTempo*3.))` in acqua #8fb7c9 × 2.
- Speed scales with head, which tells the "salto" story literally.

**Pelton jets.** These are the hero water. Use an open `CylinderGeometry(r, r*1.12, L, 32, 64, true)` along the nozzle axis with `ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending })` and `userData.noAO = true`.

```glsl
// vertex: increspatura che scorre verso la ruota
float w = 1.0 + 0.04*sin(position.y*14.0 - uTempo*45.0) + 0.02*sin(position.y*31.0 - uTempo*70.0);
vec3 p = vec3(position.x*w, position.y, position.z*w);
// fragment: bordo luminoso (fresnel) + filamenti che scorrono
float fres = pow(1.0 - abs(dot(normalize(vNormV), normalize(-vPosV))), 2.0);
float fil = smoothstep(0.55, 1.0, vnoise(vec2(vUv.x*10.0, vUv.y*5.0 - uTempo*14.0)));
vec3 c = uAcqua*(0.2 + 1.8*fres) + vec3(1.2)*fil*0.5;      // >1 = bloom morbido sul nucleo
gl_FragColor = vec4(c*uIntensita, 1.0);
```

Add a slightly larger, very faint outer cylinder for mist.

**Spray.** One `Points` per impact zone, 3–4k points, with no CPU work:
- Attributes `aSeme` (vec4 random).
- Vertex shader: `t = fract(uTempo*rate + seme.w)`, `pos = origin + vel(seme)*t + 0.5*vec3(0,-9.8,0)*t*t`.
- `gl_PointSize = uDim * uDPR * (1.0 - t) / -mvPosition.z`. **Multiply by DPR**, or the spray shrinks on 4K screens.
- Soft disc from `gl_PointCoord`, additive blending, `depthWrite: false`.

Emit at the bucket splitter and spread sideways, which is how a real Pelton bucket splits and turns the jet back.

**Physical consistency that experts will notice:**
- Runner rim speed ≈ 0.46 × jet speed, so `ω = 0.46*vGetto / R`.
- Bucket width ≈ 3–3.4 × jet diameter.
- On-screen formula `P = 9,81 · Q · H · η` (η ≈ 0.9), recomputed live as the v1 water columns change. That is serious content for investors.

---

## 6. Procedural high-detail models (1 unit = 1 m)

General rules:
- Build with `LatheGeometry`, `ExtrudeGeometry` (with bevel) and `ParametricGeometry` (addon), plus a custom sweep for variable-radius tubes, then `mergeGeometries` per material.
- `mergeGeometries` returns **null** if the attribute sets differ: make all inputs indexed or all `toNonIndexed()`, each with position, normal and uv.
- Run `toCreasedNormals(geo, Math.PI/6)` for hard-surface edges.
- Use `InstancedMesh` for any repetition and call `computeBoundingSphere()` after setting matrices so culling works.
- Keep the optional `.glb` drop-in: `GLTFLoader` + `DRACOLoader` (decoder at `three@0.160.0/examples/jsm/libs/draco/gltf/`). If the file fails to load (404), fall back to the procedural model.

**Single-axis tracker (1P).**

| Part | Approximate spec |
|---|---|
| Module | 2.38 × 1.13 × 0.035 m (bifacial, 144 half-cut cells) |
| Row | about 90 modules, ~100 m |
| Torque tube | square 0.12 m or round 0.13 m |
| Posts | I-beam `ExtrudeGeometry` of an H section, every ~8 m |
| Hub height | ~1.6 m standard, **4.5 m agrivoltaic** |
| Rotation | ±55–60° |
| Row pitch | 5.5–6.5 m (agrivoltaic: 9–12 m with crop rows) |

- **Bearings:** a `TorusGeometry` and a clamp box. **Slew drive:** a gearbox at the central post.
- **Cell texture:** a 2048×1024 canvas with near-black blue cells (#0a1220, a subtle radial gradient per cell), two half-cut blocks with a central gap, 12 thin silver busbars and a 2 px frame shadow. Set it to sRGB with max anisotropy.
- **Module material:** `MeshPhysicalMaterial({ map: celle, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.5, envMapIntensity: 1.3 })`. The clearcoat is the glass. As the rows rotate through the HDRI reflection, a **specular glint sweeps across the field**, the signature wow moment.
- **Frame:** anodised aluminium (#a9afb3, metalness 1, roughness 0.35).
- **Instancing:** one `InstancedMesh` per part (glass, frame, tube, post, bearing). Recompute module matrices only when the angle changes by more than 0.001 rad (about 4k instances, under 0.5 ms). Optionally add backtracking at low sun angles, which real trackers do and which keeps rows from shading each other.
- **Exploded view:** this applies to the hero tracker only, which is not instanced. Each part stores `userData.offset`, and one tweened `esplosione` value (0 → 1) places parts with a stagger: `pos = base + offset * easeOutCubic(clamp(e*1.6 - i*0.08, 0, 1))`. Add gold leader lines (`Line2` or thin quads) and Italian labels: *Modulo bifacciale, Tubo di torsione, Cuscinetto, Palo, Motoriduttore*.

**Kaplan (low head, high flow).**
- Hub: a `LatheGeometry` bulb.
- 4–6 blades from a `ParametricGeometry` callback:
  ```js
  // u: dal mozzo alla punta, v: lungo la corda
  const r = lerp(0.55, 1.6, u), cal = lerp(1.0, 0.35, u), corda = lerp(0.8, 1.25, u);
  const c = (v - 0.5) * corda, curv = 0.07 * corda * Math.sin(Math.PI * v);
  const th = c * Math.cos(cal) / r;
  out.set(r * Math.cos(th), c * Math.sin(cal) + curv, r * Math.sin(th));
  ```
- Give the blade thickness with two sheets offset along the normal by `±0.5*t*sin(πv)`, merged. The leading and trailing edges close where thickness reaches zero.
- Put each blade in a pivot group and **animate the pitch ±15° together with 20–24 instanced wicket gates.** That is Kaplan "double regulation", a detail only a real expert would show.
- Discharge ring and draft-tube cone: lathes.

**Francis (medium head).**
- Crown and band: lathes.
- **13–17 blades:** a `ParametricGeometry` surface between the crown curve and the band curve, from the inlet (outer radius, top) to the outlet (inner radius, bottom), with a wrap of about 70–90° and an S-camber.
- **Spiral casing:** a custom sweep. Centerline angle θ = t·345°, centerline radius `R(t)` shrinking linearly, section radius `r(t) = r0·sqrt(1 - 0.9t)`. The *area* falls linearly, which keeps flow velocity constant as water feeds the stay vanes — physically right. Build the rings yourself and index them into quads.
- Reuse the same sweep for the draft-tube elbow (radius grows along the curve).
- 20–24 stay vanes and wicket gates, instanced.

**Pelton (high head, low flow).**
- Disc: a lathe.
- **20–22 buckets:** one half-cup = `SphereGeometry(1, 32, 16, 0, Math.PI, 0, Math.PI/2)` scaled to an ellipsoid (0.5, 0.35, 0.22). Mirror it in x for the second half, and add a thin splitter ridge (`ExtrudeGeometry`) and a root block. `mergeGeometries` the parts, then build an `InstancedMesh` around the rim, tilted.
- Nozzles: lathe profile plus a lathe needle spear (animate the spear stroke to "regulate" the flow) and a deflector plate.
- Real runners are 13Cr-4Ni **stainless**. Use `MeshPhysicalMaterial({ color:'#c8ccd0', metalness:1, roughness:0.22 })`. The dusk environment warms it toward gold without breaking credibility. Housings are graphite PBR (`metallo_lamiera` set), and the brand gold is used only for accents and lines.

**Cut-away sections.**

```js
const piano = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);   // parte "lontano": il programma include già il clipping
[involucro, chiocciola, condotta].forEach(m => { m.material.clippingPlanes = [piano]; m.material.clipShadows = true; m.material.side = THREE.DoubleSide; });
gsap.to(piano, { constant: 0, scrollTrigger: {...} });                // piano in coordinate MONDO
```

Assign `clippingPlanes` from the start with the plane at a distance. Adding clipping planes later changes the program and stalls the frame.

**Caps** follow the r160 `webgl_clipping_stencil` recipe:
- Two stencil-only clones of each clipped mesh: BackSide with `IncrementWrapStencilOp`, FrontSide with `DecrementWrapStencilOp`, `colorWrite:false`, `depthWrite:false`, `stencilFunc: AlwaysStencilFunc`, `clippingPlanes:[piano]`.
- A cap plane positioned with `piano.coplanarPoint(...)` and `lookAt`, using `stencilFunc: NotEqualStencilFunc`, `stencilRef: 0`, Replace ops, `renderOrder` after the stencil clones, and `onAfterRender = r => r.clearStencil()`.
- **This requires `stencilBuffer: true` on the composer target.**
- Shade the caps as a **technical-drawing section**: graphite with gold 45° hatching computed in the cap shader. That is the identity of the brand.

**Cheap alternative for hollow shells** such as the casing and penstock: append `if (!gl_FrontFacing) gl_FragColor.rgb = uSezione * tratteggio;` after `<dithering_fragment>`. The interior back faces read as the cut. This is robust and needs no stencil.

During cuts, tween `gtao.blendIntensity` to 0: the AO normal pass ignores local clipping.

---

## 7. Scroll choreography

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.css">
```

```js
gsap.registerPlugin(ScrollTrigger);
const lenis = riduci ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, smoothWheel: true });
if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
gsap.ticker.add(disegna);            // UN SOLO rAF: Lenis → ScrollTrigger → camera → render nello stesso frame
```

Rendering from `gsap.ticker` and not from a separate `requestAnimationFrame` removes the one-frame lag between HTML text and the 3D scene, which shows up as jitter on 120/144 Hz monitors.

**Master timeline.** Each stage is 1 unit long. `#storia` is `n × 150vh` tall, which leaves room to dwell.

```js
const tl = gsap.timeline({ defaults: { ease: 'none' },
  scrollTrigger: { trigger: '#storia', start: 'top top', end: 'bottom bottom', scrub: lenis ? true : 0.6 } });
tl.to(S, { progresso: K.length - 1, duration: K.length - 1 }, 0)            // guida la camera
  .addLabel('apertura', 0).to(terrain.scale, { y: 1, duration: 0.8, ease: 'power2.inOut' }, 0.1)
  .addLabel('sviluppo', 1).to(U.uVincoli, { value: 1, duration: 0.4 }, 1.15) /* ... */;
```

Use `scrub: true` with Lenis, because the smoothing is already there; stacking `scrub: 1` on top makes the page feel heavy. Avoid ScrollTrigger `snap` with Lenis because they fight. If snapping is wanted, call `lenis.scrollTo(tl.scrollTrigger.labelToScroll(label))` on scroll end.

**Camera on curves, with a dwell per stage:**

```js
const curvaP = new THREE.CatmullRomCurve3(K.map(k => k.p), false, 'centripetal');   // centripeta: niente anse
const curvaT = new THREE.CatmullRomCurve3(K.map(k => k.t), false, 'centripetal');
function obiettivoCamera(prog) {
  const i = Math.min(Math.floor(prog), K.length - 2);
  const g = THREE.MathUtils.smootherstep(prog - i, 0.18, 0.82);   // sosta all'inizio e alla fine di ogni tratto
  const u = (i + g) / (K.length - 1);
  curvaP.getPoint(u, P); curvaT.getPoint(u, T);                    // getPoint (non getPointAt): passa ESATTAMENTE per i fotogrammi chiave
  fovObiettivo = THREE.MathUtils.lerp(K[i].fov, K[i + 1].fov, g);
}
// nel frame: smorzamento = peso cinematografico
camera.position.x = THREE.MathUtils.damp(camera.position.x, P.x + mouse.sx * 0.6, 3.5, dt); // ... y, z, e anche il target
```

Add micro-parallax from the mouse (±0.6 m, damped), a 1–2° roll during big lateral moves, and an FOV change per keyframe (narrow on hero objects, wide on territory).

**Text.**
- Panels use CSS `position: sticky` inside each stage block, which is more robust with Lenis than `pin`. Align them with `tl.scrollTrigger.labelToScroll()`.
- Line reveals: wrap words and lines in `span`s by hand (SplitText is a paid plugin in 3.12.5), then animate `yPercent: 110 → 0`, stagger 0.035, `ease: 'expo.out'`, with `overflow: hidden` masks.
- Numbers (MWp, MWh/anno, m di salto, m³/s) count up in IBM Plex Mono.
- A home-made "decode" scramble on HUD labels.
- Labels anchored to 3D points use v1's projection plus gold leader lines. Fade them when they face away from the camera, and clamp them inside the viewport.

**Reduced motion.**
- No Lenis, native scroll.
- Camera cuts between keyframes with a 300 ms veil crossfade instead of fly-throughs.
- No idle drift. Static sun, spray and particles.
- Listen to `matchMedia(...).addEventListener('change')`.

---

## 8. Adaptive quality up to 4K, and avoiding hitches

**Pixel budget, not a DPR cap alone.** A 4K monitor at 150% scaling gives 2560×1440 CSS px × DPR 1.5 = 8.3 MP.

```js
const Q = { scala: 1, budget: 3840 * 2160 };          // "ultra": 4K nativo; "high": 2560*1440
const dpr = () => Math.min(devicePixelRatio, 2, Math.sqrt(Q.budget / (innerWidth * innerHeight))) * Q.scala;
```

**Frame-time governor with hysteresis:**
- Keep an exponential moving average of `dt`: `m = m*0.95 + dt*0.05`.
- Estimate the display interval from the shortest `dt` over the first second (60, 120 or 144 Hz).
- If `m > 1.35 × interval` for 1.5 s, step down. If `m < 0.8 × interval` for 3 s, step up, one step at a time.
- Steps: (1) `Q.scala` 1 → 0.85 → 0.7, then `renderer.setPixelRatio` + `composer.setPixelRatio/setSize`; (2) GTAO to half resolution, then off; (3) shadow map 4096 → 2048 (set `shadow.map.dispose(); shadow.map = null`, and the map size change does not recompile); (4) MSAA 4 → 0, add SMAA; (5) bloom off.
- **Never change `shadowMap.type`, the light count or material defines at runtime.**

**Cheap wins:**
- `shadowMap.autoUpdate = false` (§3).
- `InstancedMesh` everywhere, with `frustumCulled` on.
- Skip rendering entirely when the HTML sections fully veil the canvas (veil opacity 1).
- Pause on `visibilitychange`.
- Throttle to 30 fps when idle in the finale.
- Bloom at its internal half resolution (default).

**Shader warm-up.** Do it behind the loading screen, which itself is a premium beat: logo petals drawing on the gold contour lines.
1. Set every stage's objects `visible = true`, because `compile` traverses only visible objects.
2. Apply the final material states: clipping planes assigned, env assigned.
3. `await renderer.compileAsync(scene, camera)` (uses `KHR_parallel_shader_compile` when available).
4. Call `renderer.initTexture(t)` for every texture, which uploads it now and not on first sight.
5. Render one full `composer.render()` per "configuration" (overview, tracker close-up, hydro cut-away). Shadow depth materials, the GTAO normal material and post-pass materials compile only on first real use.
6. Restore visibility.

To check that warm-up worked, `renderer.info.programs.length` after warm-up must equal the count after a full scroll.

**Textures.**
- The current `web/*.webp` files look near-lossless (normals 1.7–2.2 MB). Re-encode diffuse at q80 (~250–400 KB at 2K), ARM at 1K q85 and normals at q90.
- Better: **KTX2** (`KTX2Loader`, transcoder from `three@0.160.0/examples/jsm/libs/basis/`). ETC1S for albedo and ARM, UASTC for normals. That gives 4–6× less VRAM and **no main-thread decode or upload hitch**. Convert offline with the free `toktx`/`basisu`.
- Load order: HDRI-dusk plus the terrain set first. Hydro textures (concrete, metal) load lazily, by the time stage 3 is reached.

---

## 9. Headless Chromium + SwiftShader testing

- **Chromium 139+ no longer falls back to SwiftShader on its own.** Without the opt-in, `getContext('webgl2')` returns `null`. Launch with `--use-angle=swiftshader --enable-unsafe-swiftshader`, or the ANGLE form `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`. Don't use `--disable-gpu` alone. Recent Playwright and chromedp builds pass the flag; confirm in your version.
- The site **must** handle the case with no WebGL at all: check `WebGL.isWebGL2Available()` (`addons/capabilities/WebGL.js`). The fallback is a static poster and the fully usable HTML content.
- **What breaks or differs on SwiftShader:**
  - Speed: a 1280×720 frame with GTAO and MSAA takes hundreds of milliseconds to seconds, so the governor collapses to minimum.
  - Shader compiles take seconds: use 60–120 s test timeouts.
  - `OES_texture_float_linear` may be missing: never linearly filter `FloatType` textures; the HalfFloat HDR is fine.
  - Anisotropy may report 1. `KHR_parallel_shader_compile` and the timer queries are absent; `compileAsync` still resolves.
  - MSAA is capped at 4.
- **Test mode `?test=1`:**
  - DPR 1, quality "low", Lenis off.
  - A fixed clock: `uTempo` advanced manually.
  - `window.__eri = { pronto, vaiA(tappa), info: () => renderer.info }`.
  - `preserveDrawingBuffer: true` **only** in test mode, so pixel probes can run (centre pixel not black, gold present in stage 1).
- **Automated checks:**
  - Zero `console.error`, no `webglcontextlost`.
  - `info.programs.length` stable across stages (late-compile detector).
  - Screenshots per stage at 1280×720 compared with a tolerance.
  - The same suite with `?q=ultra` to catch exceptions in the heavy path, even though it renders slowly.

---

## 10. Reference sites and patterns (what makes them premium)

1. **Igloo Inc** (igloo.inc, Abeto, for the Pudgy Penguins parent company). Awwwards lists it with a **Developer Site of the Year 2024** badge. It has only three sections, and every transition is a crafted VFX moment: ice and particle morphs, restrained monochrome, micro-typographic HUD details. *Lesson: few scenes, each perfect; the transitions are the content.*
2. **Lusion** (lusion.co; Awwwards lists "Lusion v3" as Developer Site of the Year 2023). Physically driven interaction, a loader that dissolves into the scene, a strict 60 fps. *Lesson: perceived performance and responsiveness read as luxury.*
3. **Prometheus Fuels** (Awwwards Site of the Day, score 8.4; usually credited to Lusion, unconfirmed). A stylized WebGL interactive story of an industrial process, fuel from air, told step by step on scroll. *Lesson: an industrial pipeline told as a narrative chain is exactly ERI's journey from cadastral parcel to Ready to Build.*
4. **Apple product pages** (AirPods, iPhone, Mac). Scroll-scrubbed sequences, sticky copy, exploded views, oversized numbers, one idea per viewport, consistent easing. *Lesson: the exploded tracker and the turbine sections should copy this rhythm.*
5. **NYT and Reuters 3D terrain "scrollytelling"** graphics. The camera flies over terrain with annotations and leader lines anchored in 3D, in a restrained palette. *Lesson: cartographic credibility comes from serious typography and labels on real geography; this is the v1 DNA, pushed further.*
6. **Mapbox Storytelling template / Google Earth Voyager.** Chapters with a fixed framing (pitch, bearing, zoom) and smooth flights between them. *Lesson: per-stage keyframes plus dwell, as in §7.*
7. **Hanwha Ocean LNG-carrier scroll animation** (Awwwards inspiration, storytelling and immersive tags). Heavy industrial engineering explained elegantly through scroll and cut-aways. *Lesson: a machine in section can be beautiful.*
8. **Lando Norris** (OFF+BRAND; Awwwards listing shows a Site of the Year 2025 badge). A coherent motion system: every element enters and exits with the same easing signature, and bold type interlocks with 3D. *Lesson: define 2–3 house eases, for example `expo.out` for reveals and `power2.inOut` for camera, and use nothing else.*
9. **Volta Solar "How it works"** (Awwwards inspiration element, tagged 3D). This is a domain example and doesn't share the award level of the others. *Lesson: the bar in renewables is low, so a cinematic ERI site stands out immediately.*

Common premium ingredients across these sites:
- The loader is part of the story.
- A single consistent light mood.
- Dithered dark gradients with grain.
- Typography with real hierarchy: Bodoni display, Jost text, Plex Mono data.
- Restraint: 2–3 accent colours.
- Sound is optional and off by default.
- No frame drops.
- Every number is plausible and sourced.

---

## 11. Suggested refinements to the stage plan

- **Use time of day as the narrative spine.**
  - Dusk at the opening.
  - Cool, analytic "morning" light for Development and Authorization, where the map and constraints read best.
  - A full sun arc in the PV stage, where trackers follow and shadows sweep, driven by scroll.
  - Overcast and blue in the hydro valley.
  - Dusk again in the finale.

  One `pmrem.fromScene` blend drives all of it.
- **Stage 2:** put a gold "READY TO BUILD" stamp on the land as a physical decal plane that drops with weight and slight dust. It closes the authorization arc.
- **Stage 3:** run the sequence exploded tracker → assembly → the **sun-sweep glint across the whole field** → crops under the agrivoltaic rows at 4.5 m.
- **Stage 4:** show Kaplan, Francis and Pelton side by side on a live head/flow chart (log Q vs H). The camera dives into each operating envelope, then into the section, with the formula P = 9,81·Q·H·η computed live.
- **Stage 5:** a construction "build-up" (posts → tubes → modules, instanced with a stagger), then the HUD with plausible data. A Southern Italian tracker plant yields about 1,700–1,900 kWh/kWp per year.
- **Finale:** the logo's six petals trace themselves in gold contour lines over the whole territory, then the contact call to action.