// =============================================================================
// ERI v2 · idro/diagramma.js — diagramma salto-portata 4e (tavola, campi d'impiego, retta dei 10 MW, punti di lavoro,
// giranti in miniatura in scala relativa vera)
// Proprietario: [VALLE]. Stato: IMPLEMENTATO.
// Specifica: DESIGN §4.5 "Il diagramma 4e" (assi log, CanvasTexture 4096×2458, campi indicativi, retta 10 MW, punti di
// lavoro, giranti ×30), §5.7 (hover su una girante → campo acceso), config.IDRO.diagramma, geo.diagrammaXY.
//
// Cosa costruisce (tutto in crea(), nulla dopo):
//  - TAVOLA: piano 100 × 60 u con origine VALLE.diagramma.origine (angolo in basso a sinistra), rivolto a +z. Un solo
//    shader non illuminato (fog:false, noAO) compone la carta di idro/diagramma-carta.js (CanvasTexture), i tre campi
//    d'impiego (poligoni analitici: tinta tenue + tratteggio a 45° / 135° / orizzontale, così le fasce comuni si
//    incrociano; contorno tracciato a penna con la punta, STATO.campi sfalsato Pelton → Francis → Kaplan), i nomi
//    dei campi e la retta dei 10 MW (disegno con la punta, STATO.retta10; poi il "bagliore": nel tema chiaro una
//    velatura d'oro attorno al tratto, mai luce sommata). Spessori in px dal fwidth: nitidi a ogni risoluzione.
//    In uscita il colore passa dall'inversa del tone mapping (come la cupola del cielo): a schermo arrivano
//    esattamente i colori della carta (tetto di INVERSA_TONO: niente bloom).
//  - OMBRA PORTATA morbida dietro la tavola (solo fuori dal suo bordo): la tavola si stacca dalla stanza chiara.
//  - PUNTI DI LAVORO: medaglie d'oro (anello, risparmio carta, nucleo) sempre davanti alle colonne (depthTest spento),
//    comparsa expo.out (STATO.puntiLavoro); con l'hover l'anello della girante respira.
//  - GIRANTI in miniatura (idro/diagramma-giranti.js, forme proprie: non dipendono dalle macchine della valle) a
//    z = girantiZ, alla base delle colonne, in scala relativa vera (× scalaMeccanica × scalaGiranti), inox lucido e
//    satinato (MATERIALI.inox) con un ambiente da studio dipinto (pareti scure, softbox): pezzi da vetrina anche
//    sulla carta chiara. Scala con STATO.giranti, rotazione a velocità vera × tempoScala (×1/8) limitata contro
//    l'effetto "ruota di carro" (§6.7), integrata su U.uTempoIdro (ferma con riduci). Hover: la girante si alza appena.
//  - La tavola si spegne quando la camera le passa vicino (il volo V4.7 → V4.8 ne attraversa il piano a T ≈ 14,89).
//  - I programmi si precompilano per il render target lineare della pipeline (nessuna T di WARMUP.valle li mostra).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'diagramma.pelton', 'diagramma.francis', 'diagramma.kaplan' (punti di lavoro)
//             e 'diagramma.retta10' = [Vector3 a, Vector3 b] (estremi della retta, per LineaOro 4→5);
//             pubblica ctx.dati.diagramma = { pick(x, y) → 'pelton'|'francis'|'kaplan'|null, gruppo, giranti }.
//  aggiorna(ctx, T, t, dt): solo visible, trasformazioni e uniform (nessuna allocazione).
// =============================================================================
import * as THREE from 'three';
import { IDRO, VALLE, PALETTE, MATERIALI, UNITA, TRACCE } from '../config.js';
import { diagrammaXY, clamp, damp } from '../geo.js';
import { nuovoMateriale, INVERSA_TONO, esposizioneTono } from '../luce/nebbia.js';
import { fase, sostaVicina } from '../regia/stato.js';
import { disegnaCarta, mascheraTesti, poligoniCampi, CAMPI, LARGO, ALTO } from './diagramma-carta.js';
import { creaGiranti } from './diagramma-giranti.js';
import { usaStudio } from './valle-materiali.js';

export const MONDO = 'valle';

const D = IDRO.diagramma;
const ORIGINE = VALLE.diagramma.origine;

// TARATURA: proporre in config (IDRO.diagramma) — regia e resa del diagramma
const TAR = {
  campi: { sfalsa: 0.14, disegno: 0.62, riempi: [0.42, 0.95] },   // frazioni di STATO.campi per campo (P → F → K)
  bagliore: 0.07,                  // T: la velatura d'oro della retta cresce dopo la fine del disegno (TRACCE.retta10)
  scritta: [-0.03, 0.04],          // T attorno alla fine del disegno: compare "10 MW"
  ombra: { margine: 9, scosta: [0.7, -1.1], vicina: [0.3, 1.5], lontana: [1.5, 7.5], alfa: 0.32, colore: PALETTE.inchiostro },
  tratteggio: { passo: 1.5, copertura: 0.07, accesa: 0.26 },     // u, copertura normale e con l'hover
  punti: { lato: 3.0, dz: 0.2 },   // u: quadrato della medaglia, distacco dalla tavola
  distacco: [6, 40],               // u fra camera e piano della tavola: sotto 6 la tavola è spenta, da 40 piena
  hover: { lambda: 10, alza: 0.45 },
  env: 1.0,                        // envMapIntensity base dell'inox nello studio (studio condiviso: valle-materiali.js)
  // posa delle giranti (u, rad): y dell'asse, rotazione di presentazione (ordine YXZ). Centri allineati a cavallo
  // del bordo basso della tavola (la scala della portata sta in alto): le giranti stanno davanti al piede delle loro
  // colonne. Pelton di tre quarti (ruota e cucchiai), Francis mostrata dallo scarico (pale a spirale nella fascia,
  // ogiva al centro: la sua immagine tipica), Kaplan dall'alto (elica a 5 pale sul mozzo)
  giranti: {
    pelton:  { y: 4.1, rot: [0.08, -0.5, 0] },
    francis: { y: 4.6, rot: [-1.2, 0.32, 0] },
    kaplan:  { y: 5.0, rot: [0.36, 0, 0] },
  },
};

// ---------------------------------------------------------------- GLSL comune
// Inversa del tone mapping (stesso calcolo di luce/cielo.js, matrici di INVERSA_TONO per riferimento)
const GLSL_TONO = /* glsl */`
  uniform mat3 uAcesInInv; uniform mat3 uAcesOutInv; uniform float uEsp; uniform float uTetto; uniform float uAces;
  vec3 rrtInv(vec3 y){
    y = clamp(y, 0.0, 0.97);
    vec3 a = 1.0 - 0.983729 * y, b = 0.0245786 - 0.432951 * y, c = -(0.000090537 + 0.238081 * y);
    return (-b + sqrt(b * b - 4.0 * a * c)) / (2.0 * a);
  }
  vec3 versoScena(vec3 t){
    t = clamp(t, 0.0, uTetto);
    if (uAces < 0.5) return t / uEsp;
    return max(uAcesInInv * rrtInv(uAcesOutInv * t), 0.0) * (0.6 / uEsp);
  }`;
const VS_PIANO = /* glsl */`
  varying vec2 vUv; varying vec2 vP;
  void main(){ vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Tavola: carta + campi + nomi + retta dei 10 MW. vP = coordinate del diagramma (u).
const FS_TAVOLA = /* glsl */`
  uniform sampler2D uCarta; uniform sampler2D uTesti;
  uniform float uOpacita;
  uniform vec2 uV[15]; uniform float uS[18]; uniform vec3 uPerim;
  uniform vec3 uRivela; uniform vec3 uRiempi; uniform vec3 uLuce; uniform vec3 uSpegni;
  uniform vec3 uInk[3]; uniform vec3 uTratto;
  uniform vec2 uRA; uniform vec2 uRB; uniform float uRetta; uniform float uBagliore; uniform float uScritta;
  uniform vec3 uOro; uniform vec3 uOroLinea;
  ${GLSL_TONO}
  varying vec2 vUv; varying vec2 vP;
  // distanza con segno dal campo k (poligono convesso antiorario, negativa dentro) e ascissa curvilinea del contorno
  void campo(int k, vec2 p, out float d, out float s){
    float dm = 1e5; float sm = 0.0; bool dentro = true;
    for (int i = 0; i < 5; i++){
      vec2 a = uV[k * 5 + i]; vec2 b = uV[k * 5 + (i == 4 ? 0 : i + 1)];
      vec2 e = b - a; float l2 = dot(e, e);
      if (l2 < 1e-8) continue;
      float h = clamp(dot(p - a, e) / l2, 0.0, 1.0);
      float dd = length(p - a - e * h);
      if (dd < dm){ dm = dd; sm = mix(uS[k * 6 + i], uS[k * 6 + i + 1], h); }
      if (e.x * (p.y - a.y) - e.y * (p.x - a.x) < 0.0) dentro = false;
    }
    d = dentro ? -dm : dm; s = sm;
  }
  // tratteggio a filo (1 px) perpendicolare a n, passo in u; sparisce prima del moiré
  float trattini(vec2 p, vec2 n, float passo, float pxU){
    float f = abs(fract(dot(p, n) / passo) - 0.5) * passo;
    return (1.0 - smoothstep(0.0, pxU, f)) * smoothstep(3.0, 6.0, passo / pxU);
  }
  float filo(float dpx, float lw){ return 1.0 - smoothstep(0.5 * lw - 0.6, 0.5 * lw + 0.6, dpx); }
  void main(){
    vec2 p = vP;
    vec2 fw = fwidth(p); float pxU = max(max(fw.x, fw.y), 1e-5);   // u per px
    vec3 c = texture2D(uCarta, vUv).rgb;
    vec4 n = texture2D(uTesti, vUv);
    for (int k = 0; k < 3; k++){
      float d; float s; campo(k, p, d, s);
      float vis = 1.0 - 0.6 * uSpegni[k];
      float luce = uLuce[k];
      vec3 ink = uInk[k];
      float m = 1.0 - smoothstep(-0.5 * pxU, 0.5 * pxU, d);
      float rie = uRiempi[k] * vis;
      c = mix(c, ink, m * (0.05 + 0.09 * luce) * rie);
      vec2 nt = k == 0 ? vec2(0.70711, -0.70711) : (k == 1 ? vec2(0.70711, 0.70711) : vec2(0.0, 1.0));
      c = mix(c, ink, m * trattini(p, nt, uTratto.x, pxU) * mix(uTratto.y, uTratto.z, luce) * rie);
      // contorno a penna: tracciato fin dove è arrivata la punta
      float riv = uRivela[k];
      float dietro = (riv - s) * uPerim[k] / pxU;                   // px dietro la punta
      float fatto = riv >= 0.9995 ? 1.0 : smoothstep(-0.6, 0.6, dietro) * step(1e-4, riv);
      float punta = (riv > 1e-4 && riv < 0.9995) ? exp(-dietro * dietro / 16.0 - d * d / (pxU * pxU * 4.0)) : 0.0;
      c = mix(c, ink, clamp(filo(abs(d) / pxU, 1.2 + 0.9 * luce) * fatto * 0.88 * vis + punta, 0.0, 1.0));
      c = mix(c, ink, n[k] * rie * 0.94);
    }
    // retta dei 10 MW: velatura d'oro (bagliore), tratto, punta
    vec2 e = uRB - uRA; float h = clamp(dot(p - uRA, e) / dot(e, e), 0.0, 1.0);
    float dr = length(p - uRA - e * h) / pxU;
    float dietroR = (uRetta - h) * length(e) / pxU;
    float fattoR = uRetta >= 0.9995 ? 1.0 : smoothstep(-0.6, 0.6, dietroR) * step(1e-4, uRetta);
    c = mix(c, uOroLinea, uBagliore * 0.26 * exp(-dr * dr / 70.0) * fattoR);
    c = mix(c, mix(uOroLinea, uOro, 0.45), filo(dr, 2.0 + 0.7 * uBagliore) * fattoR);
    c = mix(c, uOro, (uRetta > 1e-4 && uRetta < 0.9995) ? exp(-(dietroR * dietroR + dr * dr) / 9.0) : 0.0);
    c = mix(c, uOro, n.a * uScritta);
    gl_FragColor = vec4(versoScena(c), uOpacita);
  }`;

// Ombra portata: due velature (vicina e lontana) attorno al rettangolo spostato, nulla sotto la tavola
const FS_OMBRA = /* glsl */`
  uniform vec2 uCentro; uniform vec2 uMezza; uniform vec2 uScosta; uniform vec2 uVicina; uniform vec2 uLontana;
  uniform float uAlfa; uniform vec3 uColore;
  varying vec2 vUv; varying vec2 vP;
  float scatola(vec2 p, vec2 b){ vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
  void main(){
    float ds = scatola(vP - uCentro - uScosta, uMezza), dt = scatola(vP - uCentro, uMezza);
    float a = 0.55 * (1.0 - smoothstep(-uVicina.x, uVicina.y, ds)) + 0.45 * (1.0 - smoothstep(-uLontana.x, uLontana.y, ds));
    a *= smoothstep(0.0, 0.08, dt) * uAlfa;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColore, a);
  }`;

// Punto di lavoro: medaglia d'oro (anello che si stringe, risparmio carta, nucleo con luce in alto a sinistra)
const FS_PUNTO = /* glsl */`
  uniform float uP; uniform float uLuce; uniform float uFase; uniform float uOpacita;
  uniform vec3 uOro; uniform vec3 uOroLinea; uniform vec3 uCarta;
  ${GLSL_TONO}
  varying vec2 vUv; varying vec2 vP;
  void main(){
    vec2 q = (vUv - 0.5) * 2.0; float r = length(q);
    float px = max(fwidth(r), 1e-4);
    float rr = mix(0.98, 0.6, uP) * (1.0 + 0.07 * uLuce * (0.5 + 0.5 * sin(uFase)));
    float anello = 1.0 - smoothstep(0.7 * px, 1.4 * px, abs(r - rr));
    float disco = 1.0 - smoothstep(rr - px, rr + 0.5 * px, r);
    float rc = 0.31 * smoothstep(0.15, 1.0, uP);
    float nucleo = 1.0 - smoothstep(rc - px, rc + px, r);
    vec3 col = uCarta; float a = disco * 0.8 * uP;
    col = mix(col, uOroLinea, anello); a = max(a, anello * uP);
    vec3 oro = mix(uOro, uOroLinea, 0.55 * smoothstep(-0.1, 0.25, (q.y - q.x) / max(rc, 1e-3) * 0.25));
    col = mix(col, oro, nucleo); a = max(a, nucleo);
    if (a < 0.003) discard;
    gl_FragColor = vec4(versoScena(col), a * uOpacita);
  }`;

// ---------------------------------------------------------------- stato del modulo
let st = null;
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _o = { x: 0, y: 0, z: 0, davanti: false, dentro: false };
const col = hex => new THREE.Color(hex);

/**
 * Precompila tavola, medaglie e inox nella variante che userà la pipeline (render target lineare, nebbia e luci della
 * VALLE). Nessuna configurazione di config.WARMUP.valle li mostra, e il compile del warm-up di main gira con la tela
 * come destinazione: senza questo passo i loro programmi nascerebbero al primo fotogramma del 4e.
 */
function precompila(ctx, radici) {
  const r = ctx.renderer; if (!r?.compile || !ctx.camera) return;
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const prima = r.getRenderTarget();
  try { r.setRenderTarget(rt); for (const o of radici) r.compile(o, ctx.camera, ctx.scene.valle); }
  catch (e) { console.warn('[diagramma] precompilazione non riuscita', e); }
  finally { r.setRenderTarget(prima); rt.dispose(); }
}

/** Costruzione (una volta). */
export async function crea(ctx) {
  const t0 = performance.now();
  const scena = ctx.scene.valle;
  try { await ctx.carica?.font?.(); } catch { /* i font di sistema bastano */ }

  // ---- uniform del tono inverso, condivise per riferimento
  const TONO = {
    uAcesInInv: { value: INVERSA_TONO.inInv }, uAcesOutInv: { value: INVERSA_TONO.outInv },
    uEsp: { value: esposizioneTono(ctx.STATO) }, uTetto: { value: INVERSA_TONO.tetto }, uAces: { value: INVERSA_TONO.aces ? 1 : 0 },
  };

  // ---- geometria del diagramma
  const poligoni = poligoniCampi();
  const gruppo = new THREE.Group(); gruppo.name = 'diagramma';
  gruppo.position.set(ORIGINE[0], ORIGINE[1], ORIGINE[2]);

  // ---- tavola
  const carta = new THREE.CanvasTexture(disegnaCarta());
  carta.colorSpace = THREE.SRGBColorSpace; carta.anisotropy = ctx.renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  carta.minFilter = THREE.LinearMipmapLinearFilter; carta.name = 'diagramma-carta';
  const testi = mascheraTesti(poligoni);
  testi.anisotropy = carta.anisotropy;
  const uV = [], uS = [];
  for (const p of poligoni) { p.vertici.forEach(([x, y]) => uV.push(new THREE.Vector2(x, y))); uS.push(...p.s); }
  const rA = diagrammaXY(D.retta10.Q[0], D.retta10.kW / (D.retta10.fattore * D.retta10.Q[0]));
  const rB = diagrammaXY(D.retta10.Q[1], D.retta10.kW / (D.retta10.fattore * D.retta10.Q[1]));
  const uT = {
    uCarta: { value: carta }, uTesti: { value: testi }, uOpacita: { value: 0 },
    uV: { value: uV }, uS: { value: uS }, uPerim: { value: new THREE.Vector3(...poligoni.map(p => p.perimetro)) },
    uRivela: { value: new THREE.Vector3() }, uRiempi: { value: new THREE.Vector3() },
    uLuce: { value: new THREE.Vector3() }, uSpegni: { value: new THREE.Vector3() },
    // inchiostri dei campi: Pelton oro (montagna), Francis acqua (diga), Kaplan smeraldo (fiume di pianura)
    uInk: { value: [col(PALETTE.oro), col(PALETTE.acqua), col(PALETTE.smeraldo)] },
    uTratto: { value: new THREE.Vector3(TAR.tratteggio.passo, TAR.tratteggio.copertura, TAR.tratteggio.accesa) },
    uRA: { value: new THREE.Vector2(...rA) }, uRB: { value: new THREE.Vector2(...rB) },
    uRetta: { value: 0 }, uBagliore: { value: 0 }, uScritta: { value: 0 },
    uOro: { value: col(PALETTE.oro) }, uOroLinea: { value: col(PALETTE.oroLinea) },
    ...TONO,
  };
  const geoT = new THREE.PlaneGeometry(LARGO, ALTO); geoT.translate(LARGO / 2, ALTO / 2, 0);
  const matT = nuovoMateriale(THREE.ShaderMaterial, {
    uniforms: uT, vertexShader: VS_PIANO, fragmentShader: FS_TAVOLA,
    transparent: true, depthWrite: true, fog: false, toneMapped: false,
  });
  matT.name = 'diagramma-tavola';
  const tavola = new THREE.Mesh(geoT, matT);
  tavola.name = 'diagramma-tavola'; tavola.renderOrder = 1; tavola.userData.noAO = true;
  gruppo.add(tavola);

  // ---- ombra portata (dietro, più grande della tavola)
  const O = TAR.ombra;
  const geoO = new THREE.PlaneGeometry(LARGO + 2 * O.margine, ALTO + 2 * O.margine); geoO.translate(LARGO / 2, ALTO / 2, -0.3);
  const uO = {
    uCentro: { value: new THREE.Vector2(LARGO / 2, ALTO / 2) }, uMezza: { value: new THREE.Vector2(LARGO / 2, ALTO / 2) },
    uScosta: { value: new THREE.Vector2(...O.scosta) }, uVicina: { value: new THREE.Vector2(...O.vicina) },
    uLontana: { value: new THREE.Vector2(...O.lontana) }, uAlfa: { value: 0 }, uColore: { value: col(O.colore) },
  };
  const matO = nuovoMateriale(THREE.ShaderMaterial, {
    uniforms: uO, vertexShader: VS_PIANO, fragmentShader: FS_OMBRA,
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
  });
  matO.name = 'diagramma-ombra';
  const ombra = new THREE.Mesh(geoO, matO);
  ombra.name = 'diagramma-ombra'; ombra.renderOrder = 0; ombra.userData.noAO = true;
  gruppo.add(ombra);

  // ---- punti di lavoro (medaglie) e ancore
  const geoP = new THREE.PlaneGeometry(1, 1);
  const punti = {}, ancore = {};
  CAMPI.forEach((k, i) => {
    const [x, y] = diagrammaXY(IDRO[k].Q, IDRO[k].H);
    const u = {
      uP: { value: 0 }, uLuce: { value: 0 }, uFase: { value: 0 }, uOpacita: { value: 1 },
      uOro: { value: col(PALETTE.oro) }, uOroLinea: { value: col(PALETTE.oroLinea) }, uCarta: { value: col(PALETTE.fondo) },
      ...TONO,
    };
    const m = nuovoMateriale(THREE.ShaderMaterial, {
      uniforms: u, vertexShader: VS_PIANO, fragmentShader: FS_PUNTO,
      transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    });
    m.name = `diagramma-punto-${k}`;
    const mesh = new THREE.Mesh(geoP, m);
    mesh.name = `diagramma-punto-${k}`; mesh.renderOrder = 30 + i; mesh.userData.noAO = true;
    mesh.position.set(x, y, TAR.punti.dz); mesh.scale.setScalar(TAR.punti.lato); mesh.visible = false;
    gruppo.add(mesh);
    punti[k] = { mesh, u };
    ancore[k] = new THREE.Vector3(ORIGINE[0] + x, ORIGINE[1] + y, ORIGINE[2]);
    ctx.ancore.set(`diagramma.${k}`, ancore[k]);
  });
  const retta10 = [rA, rB].map(([x, y]) => new THREE.Vector3(ORIGINE[0] + x, ORIGINE[1] + y, ORIGINE[2]));
  ctx.ancore.set('diagramma.retta10', retta10);
  gruppo.visible = false;
  scena.add(gruppo);

  // ---- giranti in miniatura (inox, ambiente da studio condiviso con le giranti delle sale; rifatto da solo se il
  // contesto WebGL torna)
  const I = MATERIALI.inox;
  const parInox = { color: I.color, metalness: I.metalness, envMapIntensity: TAR.env, side: THREE.DoubleSide };
  const lucida = usaStudio(ctx, nuovoMateriale(THREE.MeshStandardMaterial, { ...parInox, roughness: I.roughness }));
  const satinata = usaStudio(ctx, nuovoMateriale(THREE.MeshStandardMaterial, { ...parInox, roughness: I.roughness + 0.16 }));
  lucida.name = 'diagramma-inox-lucido'; satinata.name = 'diagramma-inox-satinato';
  const G = creaGiranti({ lucida, satinata });
  const vetrina = new THREE.Group(); vetrina.name = 'diagramma-giranti';
  const scalaG = UNITA.scalaMeccanica * D.scalaGiranti;
  const giranti = CAMPI.map(k => {
    const g = G[k], p = TAR.giranti[k];
    g.radice.position.set(ancore[k].x, p.y, D.girantiZ);
    g.radice.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
    g.radice.scale.setScalar(scalaG); g.radice.visible = false;
    vetrina.add(g.radice);
    return { ...g, y0: p.y, centro: new THREE.Vector3(ancore[k].x, p.y, D.girantiZ), angolo: 0 };
  });
  scena.add(vetrina);

  // ---- pick: girante sotto il cursore (px CSS), ellisse proiettata attorno al centro
  function pick(x, y) {
    if (!st || !ctx.camera || ctx.mondo !== 'valle' || (ctx.STATO?.giranti ?? 0) < 0.5) return null;
    const cam = ctx.camera; cam.getWorldDirection(_f);
    const kPx = ctx.vista.h / 2 / Math.tan(cam.fov * Math.PI / 360);
    let migliore = null, dMin = 1;
    for (const g of st.giranti) {
      if (!g.radice.visible) continue;
      ctx.proietta(g.centro, _o); if (!_o.davanti) continue;
      const dist = _c.copy(g.centro).sub(cam.position).dot(_f); if (dist <= 0) continue;
      const s = g.radice.scale.x * kPx / dist;
      const rx = g.raggio * s * 1.05, ry = Math.max(g.semialtezza, g.raggio * 0.55) * s * 1.1;
      const nx = (x - _o.x) / rx, ny = (y - _o.y) / ry, d = nx * nx + ny * ny;
      if (d < dMin) { dMin = d; migliore = g.nome; }
    }
    return migliore;
  }

  st = {
    gruppo, tavola, ombra, uT, uO, punti, giranti, vetrina, TONO,
    luce: [0, 0, 0], spegni: [0, 0, 0], tempoIdro: null,
    fineRetta: TRACCE.retta10?.[0]?.[1] ?? 15.2,
  };
  ctx.dati.diagramma = { pick, gruppo, giranti: G, materiali: { tavola: matT, lucida, satinata } };
  precompila(ctx, [gruppo, vetrina]);
  if (ctx.flags?.debug) console.info(`[diagramma] costruito in ${Math.round(performance.now() - t0)} ms`);
}

/** Ogni fotogramma (solo nella VALLE). Nessuna allocazione. */
export function aggiorna(ctx, T, t, dt) {
  if (!st) return;
  const S = ctx.STATO, U = ctx.U, riduci = !!ctx.flags?.riduci;
  const Te = riduci ? sostaVicina(T).t1 : T;                       // come le tracce con riduci movimento
  // il volo V4.7 → V4.8 attraversa il piano della tavola (T ≈ 14,89): la tavola compare solo con la camera davanti
  // e lontana abbastanza (la posa è funzione di T, quindi resta una funzione di T)
  const dzCam = (ctx.camera?.position.z ?? 1e3) - ORIGINE[2];
  const kD = clamp(S.diagramma ?? 0, 0, 1) * fase(dzCam, TAR.distacco[0], TAR.distacco[1], 'power2.inOut');
  const kG = clamp(S.giranti ?? 0, 0, 1);

  // ---- tono inverso (esposizione corrente)
  st.TONO.uEsp.value = esposizioneTono(S); st.TONO.uAces.value = INVERSA_TONO.aces ? 1 : 0;

  // ---- hover (§5.7): campo della girante acceso, gli altri attenuati (smorzati, istantanei con riduci)
  const hov = S.giranteHover | 0;
  for (let i = 0; i < 3; i++) {
    const l = hov === i + 1 ? 1 : 0, s = hov > 0 && hov !== i + 1 ? 1 : 0;
    st.luce[i] = riduci || !(dt > 0) ? l : damp(st.luce[i], l, TAR.hover.lambda, dt);
    st.spegni[i] = riduci || !(dt > 0) ? s : damp(st.spegni[i], s, TAR.hover.lambda, dt);
  }

  // ---- tavola, campi, retta
  st.gruppo.visible = kD > 0.001;
  if (st.gruppo.visible) {
    const u = st.uT, kc = clamp(S.campi ?? 0, 0, 1), C = TAR.campi;
    u.uOpacita.value = kD;
    for (let i = 0; i < 3; i++) {
      const a = i * C.sfalsa;
      u.uRivela.value.setComponent(i, fase(kc, a, a + C.disegno, 'power2.inOut'));
      u.uRiempi.value.setComponent(i, fase(kc, a + C.riempi[0] * (1 - 2 * C.sfalsa), a + C.riempi[1] * (1 - 2 * C.sfalsa), 'power2.out'));
    }
    u.uLuce.value.set(st.luce[0], st.luce[1], st.luce[2]);
    u.uSpegni.value.set(st.spegni[0], st.spegni[1], st.spegni[2]);
    u.uRetta.value = clamp(S.retta10 ?? 0, 0, 1);
    u.uBagliore.value = fase(Te, st.fineRetta, st.fineRetta + TAR.bagliore, 'power2.out');
    u.uScritta.value = fase(Te, st.fineRetta + TAR.scritta[0], st.fineRetta + TAR.scritta[1]);
    st.uO.uAlfa.value = TAR.ombra.alfa * kD * kD;
    // punti di lavoro
    const kP = clamp(S.puntiLavoro ?? 0, 0, 1);
    for (let i = 0; i < 3; i++) {
      const p = st.punti[CAMPI[i]];
      p.mesh.visible = kP > 0.002;
      p.u.uP.value = kP; p.u.uOpacita.value = kD;
      p.u.uLuce.value = st.luce[i];
      p.u.uFase.value = riduci ? 0 : (U.uTempo?.value ?? t) * 4.2;
    }
  }

  // ---- giranti: scala, rotazione (× tempoScala, limitata a 0,45 del passo delle pale per fotogramma), hover
  const ti = U.uTempoIdro?.value ?? 0;
  const dTi = st.tempoIdro == null ? 0 : Math.max(0, ti - st.tempoIdro);
  st.tempoIdro = ti;
  const ts = Math.max(S.tempoScala ?? 1, 1e-6), fps = Math.max(ctx.tempo?.fps ?? 60, 1);
  for (let i = 0; i < 3; i++) {
    const g = st.giranti[i];
    g.radice.visible = kG > 0.002;
    if (!g.radice.visible) continue;
    g.radice.scale.setScalar(UNITA.scalaMeccanica * D.scalaGiranti * kG);
    const omega = Math.min(g.rpm / 60 * Math.PI * 2, IDRO.omegaMaxFattore * (Math.PI * 2 / g.pale) * fps / ts);   // rad per s di tempo idro
    g.angolo = (g.angolo + omega * dTi) % (Math.PI * 2);
    if (g.asse === 'z') g.rotore.rotation.z = g.angolo; else g.rotore.rotation.y = -g.angolo;
    g.radice.position.y = g.y0 + TAR.hover.alza * st.luce[i];
    g.centro.y = g.radice.position.y + g.centroY * g.radice.scale.x;
  }
}
