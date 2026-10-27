// Linea di luce: un filo d'oro sottile lungo cui scorrono impulsi lenti. È l'energia che va verso la rete.
import * as THREE from 'three';

export function creaLineaLuce(punti, { raggio = 0.035, colore = '#ffd27a', velocita = 0.35, impulsi = 5, intensita = 1 } = {}) {
  const curva = new THREE.CatmullRomCurve3(punti.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const geo = new THREE.TubeGeometry(curva, 160, raggio, 6, false);
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, colore: { value: new THREE.Color(colore) }, visibile: { value: 0 }, intensita: { value: intensita } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float t, visibile, intensita; uniform vec3 colore; varying vec2 vUv;
      void main() {
        float u = vUv.x;
        float f = fract(u * ${impulsi.toFixed(1)} - t * ${velocita.toFixed(3)});
        float impulso = smoothstep(0.0, 0.45, f) * (1.0 - smoothstep(0.45, 1.0, f));
        float testa = 1.0 - smoothstep(visibile - 0.08, visibile, u);   // la linea si disegna da sola
        float bordo = 1.0 - abs(vUv.y * 2.0 - 1.0);                      // più morbida ai lati del tubo
        float a = (0.22 + 0.78 * impulso) * testa * (0.4 + 0.6 * bordo) * smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.7, 1.0, u));
        gl_FragColor = vec4(colore * (1.2 + impulso * 0.8) * intensita, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    aggiorna(tempo, visibile = 1) { mat.uniforms.t.value = tempo; mat.uniforms.visibile.value = visibile; mesh.visible = visibile > 0.001; },
  };
}
