// ERI v3 · la linea d'energia: un nastro d'oro sul pavimento che guida il racconto (logo → FV → BESS → turbine → contatti).
// La lunghezza visibile (in unità di percorso) la decide la regia; in testa corre una scintilla.
import * as THREE from 'three';
import { ADDITIVO } from './scena.js';

const Y = 0.014, MEZZA = 0.26;   // altezza sul pavimento, mezza larghezza del nastro (nucleo + alone)

// punti di un arco attorno a un centro (angoli in radianti nel piano xz: x = cos, z = sin)
export function arco(c, r, a0, a1, passi = 10) {
  const out = [];
  for (let i = 0; i <= passi; i++) { const a = a0 + (a1 - a0) * (i / passi); out.push(new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r)); }
  return out;
}

export function creaLinea(punti) {
  const curva = new THREE.CatmullRomCurve3(punti, false, 'centripetal');
  curva.arcLengthDivisions = 2000;   // stessa suddivisione per il nastro e per le lunghezze (nessun ricalcolo nel ciclo)
  const tot = curva.getLength();
  const n = Math.ceil(tot / 0.16);
  const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n; curva.getPointAt(u, p); curva.getTangentAt(u, t);
    const l = Math.hypot(t.x, t.z) || 1, nx = -t.z / l, nz = t.x / l;
    pos.set([p.x + nx * MEZZA, Y, p.z + nz * MEZZA, p.x - nx * MEZZA, Y, p.z - nz * MEZZA], i * 6);
    uv.set([u * tot, 1, u * tot, -1], i * 4);
    if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);   // facce verso l'alto
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uL: { value: 0 }, uTot: { value: tot } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uL, uTot; varying vec2 vU;
      void main(){
        float x = vU.x; if (x > uL) discard;
        float a = abs(vU.y);
        float nucleo = 1.0 - smoothstep(0.03, 0.11, a);
        float alone = exp(-a * a * 7.0) * 0.14;
        float imp = pow(fract(x * 0.085 - uT * 0.3), 16.0);
        float testa = exp(-(uL - x) * 1.2) * step(uL, uTot - 0.05);
        float k = (nucleo * (0.6 + imp * 2.8 + testa * 5.0) + alone * (1.0 + imp * 2.5 + testa * 5.0)) * smoothstep(0.0, 1.5, x);
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.4) * k, 1.0);
      }`,
    ...ADDITIVO,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; mesh.frustumCulled = false;

  // scintilla in testa
  const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const ms = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uK: { value: 0 }, uT: { value: 0 } },
    vertexShader: `uniform float uPx, uT; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uPx * (90.0 + 14.0 * sin(uT * 7.0)) / max(-mv.z, 1.0); }`,
    fragmentShader: `uniform float uK; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = (pow(max(1.0 - d, 0.0), 3.0) * 1.2 + pow(max(1.0 - d, 0.0), 12.0) * 4.0) * uK;
      gl_FragColor = vec4(vec3(1.0, 0.8, 0.52) * a, 1.0); }`,
    ...ADDITIVO,
  });
  const scintilla = new THREE.Points(gs, ms); scintilla.frustumCulled = false; scintilla.renderOrder = 4;

  // lunghezza del percorso in corrispondenza di ogni punto di controllo
  const M = curva.arcLengthDivisions, lun = curva.getLengths();
  const lunghezzaPunto = i => lun[Math.round((i / (punti.length - 1)) * M)];

  const testa = new THREE.Vector3();
  return {
    mesh, scintilla, curva, tot, lunghezzaPunto, testa,
    impostaPx(px) { ms.uniforms.uPx.value = px; },
    aggiorna(t, L) {
      L = Math.max(0, Math.min(tot, L));
      mat.uniforms.uT.value = t; mat.uniforms.uL.value = L;
      curva.getPointAt(L / tot, testa); testa.y = 0.06;
      gs.attributes.position.array[0] = testa.x; gs.attributes.position.array[1] = testa.y; gs.attributes.position.array[2] = testa.z;
      gs.attributes.position.needsUpdate = true;
      ms.uniforms.uT.value = t;
      ms.uniforms.uK.value = L > 0.05 && L < tot - 0.05 ? 1 : 0;
    },
  };
}
