// ERI · Alba di Vetro · il pavimento d'acqua ferma: riflette il cielo (calcolato) e i tracker (specchio a bassa risoluzione,
// sfocato e smorzato), con una nebbia chiara verso l'orizzonte. Meccanica dello specchio come il Reflector di three,
// ma la camera speculare vede solo il livello 0 (le parti grandi) e il cielo resta fuori dal riflesso (alpha = 0).
import * as THREE from 'three';
import { GLSL_CIELO } from './cielo.js';

const vert = /* glsl */`
  uniform mat4 matriceTessitura;
  varying vec4 vUv4; varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    vUv4 = matriceTessitura * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */`
  uniform sampler2D tRiflesso; uniform vec2 texel; uniform float conRiflesso, forzaRiflesso;
  uniform vec3 posCam, cAcqua, cNebbia;
  varying vec4 vUv4; varying vec3 vPos;
  ${GLSL_CIELO}
  void main() {
    vec3 V = normalize(posCam - vPos);
    float cosT = max(0.0, V.y);
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    float fres = pow(1.0 - cosT, 3.0);
    // acqua ferma: il cielo riflesso, un po' più corpo vicino alla camera
    vec3 base = mix(cAcqua, cielo(R), 0.5 + 0.5 * fres);
    vec3 c = base;
    if (conRiflesso > 0.5) {
      vec2 uv = vUv4.xy / vUv4.w;
      // riflesso morbido: tante prese, allungate in verticale come su acqua appena mossa
      vec4 acc = vec4(0.0);
      acc += texture2D(tRiflesso, uv);
      acc += texture2D(tRiflesso, uv + vec2( 0.0,  1.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2( 0.0, -1.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2( 0.0,  3.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2( 0.0, -3.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2( 1.2,  2.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2(-1.2, -2.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2(-1.2,  2.5) * texel);
      acc += texture2D(tRiflesso, uv + vec2( 1.2, -2.5) * texel);
      acc /= 9.0;
      vec3 ogg = acc.rgb / max(acc.a, 0.001);
      #ifdef TONE_MAPPING
        ogg = toneMapping(ogg);
      #endif
      float a = clamp(acc.a, 0.0, 1.0) * (0.3 + 0.55 * fres) * forzaRiflesso;
      c = mix(base, ogg, a);
    }
    float d = length(posCam.xz - vPos.xz);
    c = mix(c, cNebbia, smoothstep(30.0, 420.0, d));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

export function creaAcqua({ renderer, uniformiCielo, larghezzaRT = 768, altezzaRT = 480 }) {
  const rt = new THREE.WebGLRenderTarget(larghezzaRT, altezzaRT, { depthBuffer: true, stencilBuffer: false });
  rt.texture.minFilter = THREE.LinearFilter; rt.texture.magFilter = THREE.LinearFilter;
  const uniformi = {
    ...uniformiCielo,
    tRiflesso: { value: rt.texture }, texel: { value: new THREE.Vector2(1 / larghezzaRT, 1 / altezzaRT) },
    matriceTessitura: { value: new THREE.Matrix4() }, posCam: { value: new THREE.Vector3() },
    conRiflesso: { value: 1 }, forzaRiflesso: { value: 0.75 },
    cAcqua: { value: new THREE.Color('#E6E9EF') }, cNebbia: { value: new THREE.Color('#F6E6D8') },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: uniformi, vertexShader: vert, fragmentShader: frag, toneMapped: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.frustumCulled = false; mesh.renderOrder = -6; mesh.name = 'acqua';

  const piano = new THREE.Plane(), normale = new THREE.Vector3(), posSpecchio = new THREE.Vector3(), posCam = new THREE.Vector3();
  const rot = new THREE.Matrix4(), mira = new THREE.Vector3(), clip = new THREE.Vector4(), vista = new THREE.Vector3(), bersaglio = new THREE.Vector3(), q = new THREE.Vector4();
  const camV = new THREE.PerspectiveCamera();
  camV.layers.set(0);
  let attiva = true;

  mesh.onBeforeRender = function (renderer, scena, camera) {
    uniformi.posCam.value.setFromMatrixPosition(camera.matrixWorld);
    if (!attiva) { uniformi.conRiflesso.value = 0; return; }
    uniformi.conRiflesso.value = 1;
    posSpecchio.setFromMatrixPosition(mesh.matrixWorld);
    posCam.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(mesh.matrixWorld);
    normale.set(0, 0, 1).applyMatrix4(rot);
    vista.subVectors(posSpecchio, posCam);
    if (vista.dot(normale) > 0) { uniformi.conRiflesso.value = 0; return; }
    vista.reflect(normale).negate().add(posSpecchio);
    rot.extractRotation(camera.matrixWorld);
    mira.set(0, 0, -1).applyMatrix4(rot).add(posCam);
    bersaglio.subVectors(posSpecchio, mira).reflect(normale).negate().add(posSpecchio);
    camV.position.copy(vista);
    camV.up.set(0, 1, 0).applyMatrix4(rot).reflect(normale);
    camV.lookAt(bersaglio);
    camV.far = camera.far;
    camV.updateMatrixWorld();
    camV.projectionMatrix.copy(camera.projectionMatrix);
    uniformi.matriceTessitura.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    uniformi.matriceTessitura.value.multiply(camV.projectionMatrix).multiply(camV.matrixWorldInverse).multiply(mesh.matrixWorld);
    // piano di taglio obliquo: sotto l'acqua non si disegna nulla
    piano.setFromNormalAndCoplanarPoint(normale, posSpecchio).applyMatrix4(camV.matrixWorldInverse);
    clip.set(piano.normal.x, piano.normal.y, piano.normal.z, piano.constant);
    const P = camV.projectionMatrix;
    q.x = (Math.sign(clip.x) + P.elements[8]) / P.elements[0];
    q.y = (Math.sign(clip.y) + P.elements[9]) / P.elements[5];
    q.z = -1.0;
    q.w = (1.0 + P.elements[10]) / P.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    P.elements[2] = clip.x; P.elements[6] = clip.y; P.elements[10] = clip.z + 1.0 - 0.003; P.elements[14] = clip.w;

    mesh.visible = false;
    const rtPrima = renderer.getRenderTarget();
    const xr = renderer.xr.enabled; renderer.xr.enabled = false;
    renderer.setRenderTarget(rt);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scena, camV);
    renderer.xr.enabled = xr;
    renderer.setRenderTarget(rtPrima);
    const vp = camera.viewport; if (vp !== undefined) renderer.state.viewport(vp);
    mesh.visible = true;
  };

  return {
    mesh, uniformi,
    setRiflessi(on) { attiva = !!on; },
    setRisoluzione(w, h) { rt.setSize(w, h); uniformi.texel.value.set(1 / w, 1 / h); },
  };
}
