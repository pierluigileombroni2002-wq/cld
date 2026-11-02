// ERI · Alba di Vetro · il cielo dell'alba: un gradiente su una grande sfera (bianco in alto, azzurro pallido,
// rosa cipria e pesca all'orizzonte), un controluce morbido dietro i tracker senza sole disegnato.
// La stessa funzione GLSL serve al cielo visibile, all'acqua (riflesso calcolato) e alla mappa d'ambiente.
import * as THREE from 'three';

export const PALETTE = {
  zenit: '#FBFBFD', alto: '#F4F7FB', azzurro: '#DCE8F3', mezzo: '#E2E5EE', rosa: '#F0DDD8',
  cipria: '#F4DACD', pesca: '#F7E3C8', sotto: '#EEF2F6', sole: '#FFF4E8',
};

export const GLSL_CIELO = /* glsl */`
  uniform vec3 cZenit, cAlto, cAzzurro, cMezzo, cRosa, cCipria, cPesca, cSotto, cSole;
  uniform vec3 dirSole; uniform float forzaSole;
  vec3 cielo(vec3 d) {
    float y = d.y;
    vec3 c;
    if (y < 0.0) {
      c = mix(cPesca, cSotto, smoothstep(0.0, 0.22, -y));
    } else {
      c = mix(cPesca, cCipria, smoothstep(0.0, 0.035, y));
      c = mix(c, cRosa, smoothstep(0.035, 0.085, y));
      c = mix(c, cMezzo, smoothstep(0.085, 0.18, y));
      c = mix(c, cAzzurro, smoothstep(0.18, 0.34, y));
      c = mix(c, cAlto, smoothstep(0.34, 0.62, y));
      c = mix(c, cZenit, smoothstep(0.62, 0.95, y));
    }
    // controluce: un bagliore largo e morbido attorno al sole basso, nessun disco
    float s = max(0.0, dot(d, dirSole));
    c += cSole * forzaSole * (0.75 * pow(s, 30.0) + 0.25 * pow(s, 6.0));
    return c;
  }`;

export function uniformiCielo(pal = PALETTE, { sole = [0.3, 0.16, -1], forzaSole = 0.22 } = {}) {
  const C = (k) => ({ value: new THREE.Color(pal[k]) });
  return {
    cZenit: C('zenit'), cAlto: C('alto'), cAzzurro: C('azzurro'), cMezzo: C('mezzo'), cRosa: C('rosa'),
    cCipria: C('cipria'), cPesca: C('pesca'), cSotto: C('sotto'), cSole: C('sole'),
    dirSole: { value: new THREE.Vector3(...sole).normalize() }, forzaSole: { value: forzaSole },
  };
}

const vert = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */`
  varying vec3 vDir;
  ${GLSL_CIELO}
  void main() {
    gl_FragColor = vec4(cielo(normalize(vDir)), 1.0);
    #include <colorspace_fragment>
  }`;

// La sfera del cielo (colori esatti della palette: niente tone mapping). Raggio grande, sta attorno a tutto.
export function creaCielo(uniformi, raggio = 2500) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(raggio, 48, 24), new THREE.ShaderMaterial({
    uniforms: uniformi, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, toneMapped: false,
  }));
  m.frustumCulled = false; m.renderOrder = -10; m.name = 'cielo';
  return m;
}

// Mappa d'ambiente PMREM: lo stesso cielo, più trattenuto (il vetro nero vive solo di riflessi: un cielo troppo bianco lo
// farebbe diventare un lenzuolo), con il sole basso dietro molto più forte: è lui che accende i bordi dei metalli.
export function creaAmbienteAlba(renderer, pal, opz) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const u = uniformiCielo(pal, opz);
  s.add(creaCielo(u, 60));
  const env = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  return env;
}
