// Linea di Luce: le macchine nascono come disegno a linea (EdgesGeometry) e si riempiono di materia.
// Due fronti scorrono lungo x nel mondo: la punta che disegna (uSogliaL) e il fronte che solidifica (uSogliaS).
//   x < uSogliaS  → macchina vera (solida)
//   uSogliaS < x < uSogliaL → solo linee bianche
//   x > uSogliaL  → niente ancora
// Un terzo valore (uDettagli, 0..1) accende le linee dei pezzi minuti: bulloni, morsetti, feritoie (passo Ready to Build).
// Si fa con onBeforeCompile sui materiali condivisi: niente materiali nuovi, niente post-processing.
import * as THREE from 'three';

export const RIVELAZIONE = {
  uSogliaS: { value: -1e4 },
  uSogliaL: { value: -1e4 },
  uBanda: { value: 0.8 },
  uDettagli: { value: 0 },
  uResiduo: { value: 0 },   // quanto della linea resta sugli spigoli quando la macchina è solida (il filo chiaro)
};

const GLSL_COMUNE = /* glsl */`
  varying vec3 vLineaW;
  uniform float uSogliaS, uSogliaL, uBanda, uDettagli, uResiduo;
  float lineaBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float lineaBayer4(vec2 a) { return lineaBayer2(0.5 * a) * 0.25 + lineaBayer2(a); }
`;

const GLSL_VERTICE = /* glsl */`
  #include <project_vertex>
  vec4 lineaWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    lineaWp = instanceMatrix * lineaWp;
  #endif
  vLineaW = (modelMatrix * lineaWp).xyz;
`;

// solido: oltre il fronte di materia il pezzo sparisce (dither ordinato nella banda di fusione)
const GLSL_SOLIDO = /* glsl */`
  #include <color_fragment>
  {
    float lineaK = smoothstep(uSogliaS - uBanda, uSogliaS + uBanda, vLineaW.x);
    if (lineaK >= 0.999) discard;
    if (lineaK > 0.001 && lineaK > lineaBayer4(gl_FragCoord.xy)) discard;
  }
`;

// trasparente (ombre di contatto, luci): sfuma con il fronte di materia
const GLSL_ALPHA = /* glsl */`
  #include <color_fragment>
  diffuseColor.a *= 1.0 - smoothstep(uSogliaS - uBanda, uSogliaS + uBanda, vLineaW.x);
`;

// linee: vive tra il fronte di materia e la punta che disegna
const GLSL_LINEA = /* glsl */`
  #include <color_fragment>
  {
    float dopoMateria = smoothstep(uSogliaS - uBanda * 0.6, uSogliaS + uBanda * 0.6, vLineaW.x);
    float primaPunta = 1.0 - smoothstep(uSogliaL - 0.5, uSogliaL + 0.5, vLineaW.x);
    diffuseColor.a *= mix(uResiduo, 1.0, dopoMateria) * primaPunta;
  }
`;

// linee dei dettagli: come sopra, ma compaiono solo quando uDettagli sale (Ready to Build)
const GLSL_LINEA_DETT = /* glsl */`
  #include <color_fragment>
  {
    float dopoMateria = smoothstep(uSogliaS - uBanda * 0.6, uSogliaS + uBanda * 0.6, vLineaW.x);
    float primaPunta = 1.0 - smoothstep(uSogliaL - 0.5, uSogliaL + 0.5, vLineaW.x);
    diffuseColor.a *= dopoMateria * primaPunta * uDettagli;
  }
`;

const FRAMMENTI = { solido: GLSL_SOLIDO, alpha: GLSL_ALPHA, linea: GLSL_LINEA, lineaDett: GLSL_LINEA_DETT };

export function iniettaRivelazione(mat, modo = 'solido') {
  if (mat.userData.rivelazione) return mat;
  mat.userData.rivelazione = modo;
  const frag = FRAMMENTI[modo] || GLSL_SOLIDO;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSogliaS = RIVELAZIONE.uSogliaS;
    shader.uniforms.uSogliaL = RIVELAZIONE.uSogliaL;
    shader.uniforms.uBanda = RIVELAZIONE.uBanda;
    shader.uniforms.uDettagli = RIVELAZIONE.uDettagli;
    shader.uniforms.uResiduo = RIVELAZIONE.uResiduo;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLineaW;')
      .replace('#include <project_vertex>', GLSL_VERTICE);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMUNE)
      .replace('#include <color_fragment>', frag);
  };
  mat.customProgramCacheKey = () => 'linea-' + modo;
  mat.needsUpdate = true;
  return mat;
}

// Linee per una InstancedMesh: condividono la stessa instanceMatrix della mesh, così seguono ogni istanza
// senza copiare nulla. Il renderer le tratta come istanze perché isInstancedMesh è vero.
class LineeIstanziate extends THREE.LineSegments {
  constructor(geo, mat, sorgente) {
    super(geo, mat);
    this.isInstancedMesh = true;
    this.instanceMatrix = sorgente.instanceMatrix;
    this.instanceColor = null;
    this.morphTexture = null;
    this.count = sorgente.count;
    this.frustumCulled = false;
  }
  computeBoundingSphere() {}
  computeBoundingBox() {}
}

export const MAT_LINEA = iniettaRivelazione(new THREE.LineBasicMaterial({
  color: '#eef2f5', transparent: true, opacity: 0.82, depthWrite: false,
}), 'linea');
export const MAT_LINEA_DETT = iniettaRivelazione(new THREE.LineBasicMaterial({
  color: '#eef2f5', transparent: true, opacity: 0.7, depthWrite: false,
}), 'lineaDett');

// Aggiunge a ogni Mesh (e InstancedMesh) sotto `radice` un figlio LineSegments con i suoi spigoli.
// I pezzi grandi usano MAT_LINEA; i pezzi minuti (bulloni, morsetti, feritoie) MAT_LINEA_DETT.
// Si saltano le luci additive (getti, segni a terra) e i pezzi davvero microscopici.
export function aggiungiLinee(radice, { soglia = 24, raggioDettaglio = 0.06, raggioMinimo = 0.012 } = {}) {
  const cache = new Map();
  const mesh = [];
  radice.traverse((o) => { if (o.isMesh && !o.userData.linea && !o.isLine) mesh.push(o); });
  let segmenti = 0, oggetti = 0;
  for (const m of mesh) {
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || mat.blending === THREE.AdditiveBlending || mat.userData.senzaLinee) continue;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const r = g.boundingSphere.radius;
    if (r < raggioMinimo) continue;
    let edges = cache.get(g);
    if (!edges) { edges = new THREE.EdgesGeometry(g, soglia); cache.set(g, edges); }
    if (edges.attributes.position.count === 0) continue;
    const materiale = r < raggioDettaglio ? MAT_LINEA_DETT : MAT_LINEA;
    const linee = m.isInstancedMesh ? new LineeIstanziate(edges, materiale, m) : new THREE.LineSegments(edges, materiale);
    linee.userData.linea = true;
    linee.renderOrder = 2;
    linee.frustumCulled = false;
    m.add(linee);
    segmenti += (edges.attributes.position.count / 2) * (m.isInstancedMesh ? m.count : 1);
    oggetti++;
  }
  return { segmenti, oggetti };
}

// Rettangolo d'ingombro a terra, tratteggiato, con una croce d'assi al centro: le "linee di costruzione" del passo Sviluppo.
export function creaIngombro(box, margine = 1.0) {
  const x0 = box.min.x - margine, x1 = box.max.x + margine, z0 = box.min.z - margine, z1 = box.max.z + margine, y = 0.015;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const punti = [
    x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0,
    cx - 1.5, y, cz, cx + 1.5, y, cz, cx, y, cz - 1.5, cx, y, cz + 1.5,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(punti, 3));
  const mat = new THREE.LineDashedMaterial({ color: '#eef2f5', transparent: true, opacity: 0.0, dashSize: 0.35, gapSize: 0.55, depthWrite: false });
  const l = new THREE.LineSegments(geo, mat);
  l.computeLineDistances();
  l.frustumCulled = false;
  l.renderOrder = 1;
  l.userData.linea = true;
  return l;
}
