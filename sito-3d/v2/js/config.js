// =============================================================================
// ERI v2 · config.js — COSTANTI NORMATIVE (unica fonte di verità)
// Proprietario: [ARCH]. Nessun altro pacchetto modifica questo file: le richieste
// di taratura si segnalano al lead, che le applica qui.
// Fonte: sito-3d/v2/DESIGN.md (i § citati sono di DESIGN.md).
// Unità: 1 u = 10 m. Assi: +X Est, +Y alto, +Z Sud. Angoli in gradi salvo nota.
// Le voci marcate [ARCH] NON sono scritte in DESIGN.md: sono deduzioni dell'architetto
// per rendere coerente la storia (es. raccordi, ritorni a zero). Si possono rivedere.
// Nessun riferimento all'eolico, per regola (§0, §7.2).
// =============================================================================

export const VERSIONE = '2.0.0';

// ---------------------------------------------------------------- tempo storia
export const T_FINE = 19;          // T va da 0 a 19 (§0)
export const STORIA_VH = 2000;     // #storia alta 2000vh (§4.0)

// ---------------------------------------------------------------- §2.1 palette
// Colori in sRGB: in 3D si usano con new THREE.Color(hex) (ColorManagement attivo).
export const PALETTE = {
  nero: '#050607', inchiostro: '#0b0f12', grafite: '#0d1012', grafite2: '#15191c',
  bordo: 'rgba(216,184,120,.16)',
  oro: '#d8b878', oroChiaro: '#f1dfb3', avorio: '#f4efe4', platino: '#c9d0d4', grigio: '#8a949a',
  smeraldo: '#36c39a', vincolo: '#e0644f', acqua: '#8fb7c9',
  rame: '#b8572a',   // SOLO sigillo RTB, cavidotto acceso, CTA premuta
  ambra: '#e8a33d',  // SOLO stringa 14-B (tappa 5b)
  oro3d: '#d6a454',  // oro per le emissioni 3D
};

// ---------------------------------------------------------------- §2.3 easing
// Gli unici ammessi. In config le tracce usano questi nomi (risolti da regia/stato.js).
export const EASE = {
  testo: 'expo.out', camera: 'power2.inOut', esplosa: 'power4.out', scroll: 'none',
  fogli: 'power2.in', sigillo: 'power4.in', onde: 'power2.out',
};

// ---------------------------------------------------------------- §0 convenzioni
export const UNITA = {
  metriPerU: 10,
  quotaBaseM: 180,                 // quota s.l.m. (m) = 180 + 10·y
  origineLat: 42.0, origineLon: 12.5,
  mPerGradoLat: 111320, mPerGradoLon: 82727,
  scalaMeccanica: 0.1,             // modelli meccanici in metri dentro un gruppo × 0,1
};

// ---------------------------------------------------------------- §2.2 tipografia
export const FONT = {
  css: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=IBM+Plex+Mono:wght@400;500&family=Jost:wght@300;400;500&display=swap',
  // pesi da caricare con document.fonts.load prima di disegnare testo su canvas (§6.9)
  carica: ['400 32px "Bodoni Moda"', 'italic 400 32px "Bodoni Moda"', '500 32px "Bodoni Moda"',
           '400 12px "IBM Plex Mono"', '500 12px "IBM Plex Mono"',
           '300 16px "Jost"', '400 16px "Jost"', '500 16px "Jost"'],
};

// ---------------------------------------------------------------- §2.6 materiali
export const MATERIALI = {
  terreno: { envMapIntensity: 0.45, metalness: 0, roughness: 1, albedo: 0.62, saturazione: 0.78,
             ripetizioneErba: 6.0, ripetizioneCampo: 4.6, macro: 0.13, rocciaPendenza: [0.18, 0.35] },
  fiume: { color: '#0a171c', roughness: 0.06, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.04,
           envMapIntensity: 1.4, normalScale: 0.35 },
  laghi: { color: '#08141a' },
  moduloFronte: { roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5,
                  envMapIntensity: 1.25, iridescence: 0.12, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 320] },
  moduloRetro: { color: '#1a2230', roughness: 0.4, clearcoat: 0.8 },
  telaio: { color: '#a9afb3', metalness: 1, roughness: 0.35, envMapIntensity: 1 },
  acciaio: { color: '#9aa1a5', metalness: 1, roughness: 0.45, envMapIntensity: 0.9 },
  inox: { color: '#c8ccd0', metalness: 1, roughness: 0.18, anisotropy: 0.6, envMapIntensity: 1.3 }, // MAI oro né bronzo
  casse: { color: '#2a2f33', metalnessDaArm: 0.8, envMapIntensity: 0.8 },
  calcestruzzo: { color: '#b9b4ab', uvScala: 0.25, envMapIntensity: 0.6 },
  cabine: { color: '#8e8a83' },
  sezione: { fondo: '#15191c', passoPx: 6, lineaPx: 1, emissione: 1.2, stratiOgniM: 5, stratiAlfa: 0.12 },
  colture: { color: '#3d4a2a', roughness: 0.9, alphaTest: 0.5 },
  alberi: { color: '#1f2b1f', roughness: 0.95, variazione: 0.10 },
  asfalto: { color: '#2b2c2c', roughness: 0.85 },
  ghiaia: { color: '#6b6155' },
  tettoCapannone: { color: '#4a4f53' },
  celle: { lato: [2048, 1024], colore: '#0a1220', retro: '#1a2230', griglia: [6, 24], fugaMm: 10, busbar: 16 },
};

// ---------------------------------------------------------------- §2.7 overlay
// Emissione = colore × fattore (HDR, soglia bloom 1,0). Spessori in px CSS (× uPx nello shader).
export const OVERLAY = {
  isoipse: { passo: 0.5, emissione: 1.2, px: 1.0 },          // ogni 5 m
  direttrici: { passo: 2.5, emissione: 2.4, px: 1.6 },       // ogni 25 m
  isoipseValle: { passo: 5, direttrici: 25 },                // plastico: ogni 50 m / 250 m (§3.6, §6.5)
  confini: { emissione: 0.9, px: 0.9 },                      // platino
  sito: { bordo: 2.4, riempimento: 0.25, px: 1.4 },          // oro
  idonee: { riempimento: 0.35, bordo: 1.4, px: 1 },          // smeraldo
  paesaggistico: { emissione: 1.6, px: 1.2, angolo: 45, passoPx: 6 },
  fluviale: { emissione: 1.6, px: 1.2, angolo: 135 },
  pai: { emissione: 1.4, puntoPx: 2, passoPx: 7 },
  archeologico: { emissione: 1.8, px: 1.2, trattoPx: 4, pausaPx: 4 },
  ambientale: { emissione: 1.4, px: 1 },
  layoutProposto: { emissione: 2.2, punta: 6, px: 1.25, trattoPx: 8, pausaPx: 6 },   // oro chiaro
  layoutApprovato: { emissione: 2.0, px: 1.25 },
  cavo: { emissione: 2.6, px: 2, impulsiVelocita: 6, impulsiPasso: 4 },             // rame
  lunetta: { tacche: 60, tacca: [0.12, 2.2], raggio: 32, accesa: 2.4, spenta: 0.25 },
  tende: { altezza: 0.8, alfa: 0.55, scanline: 6, scanlineVel: 0.4, firmato: 1.8, pulsa: [0.8, 1.8], hz: 1.2 },
  quote: { emissione: 2.0, px: 1, freccia: 30 },
  fronteRealta: { emissione: 3, larghezza: 4 },
  ondaRame: { emissione: 2.6, larghezza: 3 },
  ritraccia: { emissione: 2 },
  svanimentoFwidth: [0.3, 0.8],
  sottrazioneLuminanza: 0.15,
  cartaOmbreggiatura: { direzione: [-0.5, 0.707, -0.5], emissione: 0.05 },
  fiumeCarta: { riempimento: 0.25, bordo: 1.5, mezzaLarghezza: 2.07 },
};

// ---------------------------------------------------------------- §2.4–2.5 luce e cielo
export const HDRI = {
  qwantani: '../asset/hdri/qwantani_dusk_2_puresky_2k.hdr',
  kloofendal: '../asset/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
  autumn: '../asset/hdri/autumn_field_puresky_2k.hdr',
  // Le versioni _1k NON esistono: niente HEAD di prova (un 404 sporca la console).
  usa1k: false,
  percentileDesolazione: 0.999,   // §2.4: si limita lo 0,1% dei texel più luminosi
  campionamentoDesolazione: 16,   // 1 texel ogni 16 per il percentile (§6.3)
};

// Preset del cielo (§2.5). bagliore: [colore, fattore]. disco: true | false | 'el>-0.5'
export const CIELO_PRESET = {
  tramonto:    { zenit: '#050607', orizzonte: '#3a2a1c', bagliore: '#b8794a', k: 1.0, disco: 'el>-0.5' },
  oraBlu:      { zenit: '#04060a', orizzonte: '#1d2a36', bagliore: '#2c3a4a', k: 0.6, disco: false },
  alba:        { zenit: '#06080b', orizzonte: '#3d2a22', bagliore: '#d08a55', k: 1.2, disco: true },
  giornoScuro: { zenit: '#101b26', orizzonte: '#59697a', bagliore: '#a99a80', k: 0.4, disco: false },
  pomeriggio:  { zenit: '#0f1820', orizzonte: '#4f5a62', bagliore: '#9c7c5a', k: 0.6, disco: false },
  museale:     { zenit: '#050607', orizzonte: '#121a22', bagliore: '#000000', k: 0.0, disco: false },
};
export const CIELO = {
  raggio: 3000, segmenti: [64, 32],
  // La cupola segue la camera e il suo raggio è min(raggio, 0,9·camera.far): deve restare < far (§2.5).
  frazioneFar: 0.9,
  discoRaggio: 0.27, discoBordo: 0.05, discoHDR: 30, discoColore: [1.0, 0.85, 0.62],
  mieG: 0.76, esponenteBagliore: 6,
};

// Cotture PMREM della PIANURA (§2.4). Si cuoce SOLO al passaggio di questi T.
// az*: azimut del sole con cui allineare il bagliore della HDRI (uRot = rad(az − azHDRI)).
// 'sole' = azimut corrente di STATO.sole.az al momento della cottura.
export const COTTURE_PIANURA = [
  { T: 0.00,   a: 'qwantani', b: null, mix: 0, azA: 295 },
  { T: 7.52,   a: 'qwantani', b: null, mix: 0, azA: 57 },                 // alba, nel fotogramma più scuro
  { T: 9.15,   a: 'qwantani', b: 'kloofendal', mix: 0.00, azA: 57, azB: 'sole' },
  { T: 9.26,   a: 'qwantani', b: 'kloofendal', mix: 0.25, azA: 57, azB: 'sole' },
  { T: 9.37,   a: 'qwantani', b: 'kloofendal', mix: 0.50, azA: 57, azB: 'sole' },
  { T: 9.48,   a: 'qwantani', b: 'kloofendal', mix: 0.75, azA: 57, azB: 'sole' },
  { T: 9.60,   a: 'qwantani', b: 'kloofendal', mix: 1.00, azA: 57, azB: 'sole' },
  { T: 10.40,  a: 'kloofendal', b: 'autumn', mix: 0.000, azA: 'sole', azB: 'sole' },
  { T: 10.50,  a: 'kloofendal', b: 'autumn', mix: 0.333, azA: 'sole', azB: 'sole' },
  { T: 10.60,  a: 'kloofendal', b: 'autumn', mix: 0.667, azA: 'sole', azB: 'sole' },
  { T: 10.70,  a: 'kloofendal', b: 'autumn', mix: 1.000, azA: 'sole', azB: 'sole' },
  { T: 15.50,  a: 'autumn', b: null, mix: 0, azA: 240 },
  { T: 17.60,  a: 'autumn', b: 'qwantani', mix: 0.00, azA: 'sole', azB: 300 },
  { T: 17.725, a: 'autumn', b: 'qwantani', mix: 0.25, azA: 'sole', azB: 300 },
  { T: 17.85,  a: 'autumn', b: 'qwantani', mix: 0.50, azA: 'sole', azB: 300 },
  { T: 17.975, a: 'autumn', b: 'qwantani', mix: 0.75, azA: 'sole', azB: 300 },
  { T: 18.10,  a: 'autumn', b: 'qwantani', mix: 1.00, azA: 'sole', azB: 300 },
];
// VALLE: kloofendal ruotata con il sole HDRI ad az 210°, una cottura sola (§2.4).
export const AMBIENTE_VALLE = { a: 'kloofendal', b: null, mix: 0, azA: 210 };

export const NEBBIA = {
  densita: { panoramiche: 0.0018, medie: 0.003, primiPiani: 0.006, valleGenerale: 0.00025, vallePrimiPiani: 0.004, foschia: 0.02 },
  basePianura: 0, baseValle: 20, decadimento: 0.08,   // nebbia in quota (§6.3)
  sole: 0.6, esponenteSole: 8,
};

export const SOLE = {
  giorno: 172, lat: 42.0, lon: 12.5, fuso: 2,          // 21 giugno 2026, ora legale (§4.4)
  // §6.3: colore del sole per elevazione (interpolato in spazio lineare)
  colori: [[-1, '#ff7a3c'], [2, '#ff9a55'], [5, '#ffb46b'], [10, '#ffc98a'], [20, '#ffe0b5'], [35, '#fff1df']],
  intensitaMax: 3.4,
  emisfera: { cielo: '#8fa3b8', suolo: '#0b0f12' },
  ombra: { bias: -0.0003, normalBias: 0.005, radius: 3, near: 1, far: 600, distanza: 300 },
  // Riduci movimento: sole fisso alle 10:00 in tappa 3 (§6.11)
  oraRiduci: 10.0,
};

// ora(T) lineare a tratti (§4.4) — [T, ora decimale]
export const ORA_T = [
  [7.60, 5 + 34 / 60], [8.70, 6.0], [9.15, 6 + 10 / 60], [9.55, 9 + 40 / 60],
  [9.95, 13 + 11 / 60], [10.40, 17.5], [11.30, 19.0], [11.50, 19.25],
];

// Mezza ampiezza del frustum d'ombra per inquadratura (§6.4)
export const META_OMBRA = { panoramiche: 190, medie: 60, campoFV: 26, mezzogiorno: 30, trackerEroe: 3, vicolo: 10, valleGenerale: 260, interni: 0.6 };

// ---------------------------------------------------------------- §6.3 post-produzione
export const RENDER = {
  dprMax: 2,
  esposizioneIniziale: 0.95,
  agx: { esposizione: 1.35, contrasto: 0.08, saturazione: 0.1 },  // ?tm=agx
  bloom: { forza: 0.32, raggio: 0.55, soglia: 1.0 },
  gtao: { radius: 0.012, distanceExponent: 1.5, thickness: 0.15, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false },
  gtaoPd: { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 },
  pellicola: { nitidezza: 0.35, nitidezzaScalaBassa: 0.5, sogliaScalaBassa: 0.9, vignetta: 0.26, spostamentoVignetta: 0.06,
               grana: 0.028, granaEstremi: 0.01, granaFps: 24, lato: 1 },
};

// ---------------------------------------------------------------- §6.8 qualità
export const QUALITA = {
  livelli: {
    ultra: { budget: 8.3e6, msaa: 4, ombra: 4096, gtao: true, gtaoMezza: true, iridescenza: true, terreno: 768 },
    alta:  { budget: 4.1e6, msaa: 4, ombra: 2048, gtao: true, gtaoMezza: true, iridescenza: true, terreno: 512 },
    media: { budget: 2.1e6, msaa: 4, ombra: 2048, gtao: false, gtaoMezza: true, iridescenza: false, terreno: 512 },
    base:  { budget: 1.0e6, msaa: 0, ombra: 1024, gtao: false, gtaoMezza: true, iridescenza: false, terreno: 256,
             fileAlterne: true, coltureSoloVicolo: true },
  },
  ordine: ['base', 'media', 'alta', 'ultra'],
  sogliaSmaa: 3.7e6,             // Ultra/Alta: MSAA 0 + SMAA se pixel interni > 3,7 MP
  regexUltra: /RTX|RX [67]\d{3}|Apple M\d (Pro|Max|Ultra)|Arc A7/,
  regexBassa: /Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/,
  benchmark: { fotogrammi: 90, T: 1.8 },   // sull'inquadratura K0.1
  gradiniScala: [1, 0.85, 0.7, 0.6],
  governatore: { media: 0.05, giu: 1.35, tGiu: 1.5, su: 0.8, tSu: 3, intervallo: 4, scrollMax: 50, scrollFermo: 0.3, obiettivoMinMs: 16.7 },
  sezioni: { fps: 30, scala: 0.5 },
  finaleFermo: { secondi: 4, fps: 30 },
  piccolo: { larghezza: 900, etichetteMax: 1 },
  etichetteMax: 3,
  limiti: { chiamate: 250, triangoli: 3e6 },
};

// ---------------------------------------------------------------- §6.2 asset
const TEX = '../asset/texture/web/';
export const ASSET = {
  texture: {
    terreno_erba_roccia: { diff: TEX + 'terreno_erba_roccia_diff.webp', nor: TEX + 'terreno_erba_roccia_nor.webp', arm: TEX + 'terreno_erba_roccia_arm.webp' },
    terreno_campo:       { diff: TEX + 'terreno_campo_diff.webp', nor: TEX + 'terreno_campo_nor.webp', arm: TEX + 'terreno_campo_arm.webp' },
    cemento_diga:        { diff: TEX + 'cemento_diga_diff.webp', nor: TEX + 'cemento_diga_nor.webp', arm: TEX + 'cemento_diga_arm.webp' },
    // ATTENZIONE: metallo_lamiera è una lamiera mandorlata ARRUGGINITA. Solo casse/carter/tetti, MAI tracker o giranti.
    metallo_lamiera:     { diff: TEX + 'metallo_lamiera_diff.webp', nor: TEX + 'metallo_lamiera_nor.webp', arm: TEX + 'metallo_lamiera_arm.webp' },
  },
  logo: '../logo/ufficiale/logo-eri-v2-su-scuro.svg',
  // §6.14 modelli .glb facoltativi. Niente HEAD di prova (404 = errore in console):
  // il titolare mette attivo:true quando aggiunge il file in asset/modelli/.
  modelli: {
    tracker: { url: '../asset/modelli/tracker.glb', attivo: false, riferimentoM: 2.384 },
    kaplan:  { url: '../asset/modelli/kaplan.glb',  attivo: false, riferimentoM: 4.5 },
    francis: { url: '../asset/modelli/francis.glb', attivo: false, riferimentoM: 1.6 },
    pelton:  { url: '../asset/modelli/pelton.glb',  attivo: false, riferimentoM: 2.0 },
  },
  draco: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/',
};

// Gruppi del preloader con pesi (§5.2). La somma fa 1.
export const CARICAMENTO = [
  { id: 'font',      nome: 'FONT',      peso: 0.05 },
  { id: 'cielo',     nome: 'CIELO',     peso: 0.20 },
  { id: 'terreno',   nome: 'TERRENO',   peso: 0.25 },
  { id: 'geometria', nome: 'GEOMETRIA', peso: 0.15 },
  { id: 'shader',    nome: 'SHADER',    peso: 0.25 },
  { id: 'verifica',  nome: 'VERIFICA',  peso: 0.10 },
];

// =============================================================================
// §3 MONDO
// =============================================================================
export const SITO_C = [21.7, 1.2, 5.4];   // centroide del sito FV, origine di tutte le onde radiali
export const AGRI_C = [86, 0.8, 32.5];

export const PIANURA = {
  lato: 360,                                              // 360 × 360 u, centrata nell'origine
  segmenti: { ultra: 768, alta: 512, media: 512, base: 256 },
  anello: { r0: 180, r1: 1500, radiali: 64, angolari: 128 },
  quoteVerificate: { min: -2.96, max: 15.45 },
  // Zone spianate: [x0, x1, z0, z1, quota (null = naturale al centro), bordo] (§3.1)
  PIANE: [
    [-3, 47, -21, 33, 1.2, 10],    // sito FV
    [68, 112, 22, 54, 0.8, 9],     // agrivoltaico
    [122, 134, -60, -52, null, 4], // cabina primaria
    [-16, -8, -21, -15, null, 3],  // capannone aziendale
  ],
  fiume: { mezzaLarghezzaBagnata: 2.07, larghezzaBagnata: 4.1, nastro: 4.4, sopraTraversa: 0.4 },
  catasto: { CELLA: 10, N: 48, ANGOLO: 0.22, seme: 27, gruppoMax: 3, foglioGenerico: 27, idBase: 100 },
  // tStati: DataTexture 48×48 RGBA8 NearestFilter (§3.2)
  bitStato: { idonea: 1, sitoFV: 2, agri: 4, firmato: 8, trattativa: 16 },
  proprietarioScala: 64,          // B = proprietario × 64 (A=1, B=2, C=3)
  particelleFV: [                  // Foglio 27, 14 celle, 14,00 ha (illustrativi)
    { id: 112, celle: [[25, 23], [26, 23]], centroide: [18.4, -9.2], ha: 1.98, proprietario: 'A', stato: 'firmato' },
    { id: 113, celle: [[27, 23]], centroide: [33.1, -12.5], ha: 1.02, proprietario: 'A', stato: 'firmato' },
    { id: 114, celle: [[24, 24], [25, 24], [26, 24]], centroide: [15.7, 1.6], ha: 2.95, proprietario: 'A', stato: 'firmato' },
    { id: 115, celle: [[27, 24]], centroide: [35.2, -2.8], ha: 0.97, proprietario: 'B', stato: 'firmato' },
    { id: 116, celle: [[24, 25], [25, 25]], centroide: [13.0, 12.5], ha: 2.04, proprietario: 'B', stato: 'firmato' },
    { id: 117, celle: [[26, 25], [27, 25]], centroide: [32.6, 8.1], ha: 1.96, proprietario: 'C', stato: 'trattativa', firmaT: 4.00 },
    { id: 118, celle: [[24, 26], [25, 26], [26, 26]], centroide: [20.1, 21.1], ha: 3.08, proprietario: 'C', stato: 'trattativa', firmaT: 4.00 },
  ],
  foglioFV: 27,
  contornoFV: [[7.58, -11.94], [36.85, -18.49], [43.40, 10.79], [33.64, 12.97], [35.82, 22.73], [6.55, 29.28], [0.00, 0.00], [9.76, -2.18]],
  particelleAgri: [                // Foglio 28, 6 celle, 6,00 ha
    { id: 41, celle: [[30, 28], [31, 28]], centroide: [78.1, 28.6], ha: 1.96, proprietario: 'D', stato: 'firmato' },
    { id: 42, celle: [[32, 28]], centroide: [92.8, 25.4], ha: 1.03, proprietario: 'D', stato: 'firmato' },
    { id: 43, celle: [[30, 29]], centroide: [75.4, 39.5], ha: 0.98, proprietario: 'D', stato: 'firmato' },
    { id: 44, celle: [[31, 29], [32, 29]], centroide: [90.1, 36.2], ha: 2.03, proprietario: 'D', stato: 'firmato' },
  ],
  foglioAgri: 28,
  contornoAgri: [[67.28, 25.94], [96.56, 19.40], [100.92, 38.91], [71.65, 45.46]],
  idonee: { vincoliMax: 0.05, pendenzaMax: 0.05, campioniPerCella: 9, etichetta: 'pendenza < 5 % · nessun vincolo' },

  // §3.3 vincoli (tVincoli 1024² RGBA8 su x,z ∈ [−180,180], 0,35 u/px, filtro lineare; ambientale in tMaschere.B)
  vincoli: {
    texture: { lato: 1024, min: -180, max: 180 },
    paesaggistico: { canale: 'tVincoli.R', centro: [-112, 18], raggio: 40, armoniche: [[5, 0.08, 0], [11, 0.05, 1]], crinale: { zMax: -138, altezzaMin: 7 } },
    fluviale:      { canale: 'tVincoli.G', dF: 17.0 },
    pai:           { canale: 'tVincoli.B', pendenza: 0.20, dF: 25, sopraAcqua: 1.0 },
    archeologico:  { canale: 'tVincoli.A', centro: [-20, -52], raggio: 8, rispetto: 12 },
    ambientale:    { canale: 'tMaschere.B', centro: [58, -78], semiassi: [34, 24], rotazione: 0.3, rumore: 2 },
  },
  // Etichette degli strati GIS, nell'ordine di uV[0..4] e dei fogli 0..4
  stratiGIS: ['Paesaggistico · D.Lgs. 42/2004', 'Fascia fluviale · 150 m', 'Idrogeologico · PAI', 'Archeologico · area di rispetto', 'Ambientale · Natura 2000'],

  // §3.4 maschere (canvas 2048² su x,z ∈ [−180,180], NoColorSpace, lineare)
  maschere: { lato: 2048, R: 'campi arati', G: 'strade (asfalto 1,0 · ghiaia 0,6)', B: 'bosco / Natura 2000', A: 'piazzali e ghiaia (CP, cabine, cantiere)', campiSoglia: 0.55 },

  // §3.4 luoghi
  trackerEroe: { fila: 31, x: 20.2, z0: 7.379, z1: 13.901, centro: [20.2, 1.36, 10.64], moduli: 56 },
  vicoloAgri: { x: 84.78, z0: 23, z1: 41.5, larghezzaLibera: 0.87, filaOvest: 15, filaEst: 16 },
  cancello: [41, -11.5],                      // origine dell'ordine di montaggio (§4.6)
  cabineCancello: { centro: [41.2, -11.5], latoLungo: 'NS',
                    consegna: [1.2, 0.25, 0.27], utente: [0.8, 0.25, 0.27] },   // 12×2,5×2,7 m e 8×2,5×2,7 m in u
  cabinaPrimaria: { centro: [128, -56], piazzale: [12, 8], trasformatori: 2, trasformatore: [1.0, 0.8, 0.9],
                    portali: 4, montante: 0.05, altezzaPortale: 1.4, luciEmissione: 3, luciColore: '#ffb46b' },
  cavidotto: { punti: [[40.5, -12.5], [41, -33], [126, -37], [128, -52]], lunghezza: 120.7, sopraSuolo: 0.02, tensioneKV: 20 },
  strade: {
    sp:        { punti: [[-180, -34], [-120, -31], [-75, -29], [-30, -33], [0, -34], [41, -33], [90, -35], [126, -37], [180, -40]], larghezza: 0.7, tipo: 'asfalto' },
    poderale:  { punti: [[41, -33], [41, -12.5], [45, 14], [60, 30], [70, 32]], larghezza: 0.45, tipo: 'ghiaia' },
    accessoCP: { punti: [[126, -37], [128, -52]], larghezza: 0.5, tipo: 'ghiaia' },
    accessoCapannone: { punti: [[-12, -18], [-12, -33]], larghezza: 0.45, tipo: 'ghiaia' },
  },
  ponte: { x: -70, impalcato: [10, 0.7, 0.12], pile: 2 },
  capannone: { centro: [-12, -18], asse: 'EO', dim: [4.0, 1.8], muri: 0.7, colmo: 0.25 },
  traversa: { centro: [-77.5, 0.3, -100], soglia: [7, 0.6, 0.4], salto: 0.4, centrale: { dim: [2.4, 1.6, 1.0], x: -72.5 } },
  bosco: { alberi: 1500 },
  ripa: { dFMin: 2.8, dFMax: 6, esclusione: 4, alberi: 700 },
  filare: { x0: -30, x1: 0, passo: 1.2, alberi: 50 },
  alberi: { rMin: 0.25, rMax: 0.45, schiacciamento: 1.3, base: 0.8 },
  percorsoSopralluogo: [[41, -33], [41, -12.5], [22, 5]],
  sigillo: { diametro: 26, canvas: 2048, yDa: 3.0, ySopra: 0.02, quota: 1.2, scalaDa: 1.15,
             testi: ['READY TO BUILD', 'Fg. 27 · P.lle 112–118 · titolo autorizzativo'] },
  polvere: { punti: 400, raggio: 6, alfa: 0.6 },
  fogliGIS: { lato: 360, quote: [22, 26, 30, 34, 38], opacita: 0.55, quotaImpatto: 1.5 /* [ARCH] da tarare */, lampo: 1.5, durataLampo: 0.02 },
};

// ---------------------------------------------------------------- §3.5 layout
export const LAYOUT = {
  modulo: { lunghezzaM: 2.384, larghezzaM: 1.134, spessoreM: 0.035, wp: 650, celle: 144, sopraAsseM: 0.10 },
  passoModulo: 0.1154,           // u, 1 134 mm + 20 mm di fuga
  moduliTracker: 56, moduliMezzo: 28,
  lunghezzaTracker: 6.52,        // 56 × 0,1154 + 0,06
  corridoio: 0.5, margine: 1.0, controlloX: 0.12, larghezzaUtileM: 2.40,
  passoPali: 0.8,                 // ogni 8 m più il palo centrale del motoriduttore
  limite: 60,                     // ±60°
  fv:   { passoFile: 0.6, gcr: 0.40, quotaAsse: 0.16, file: 66, x0: 2.2, x1: 41.2, tracker: 308, moduli: 15960, potenzaMWp: 10.37, testaPaloM: 1.5, profilo: 'HEA 120' },
  agri: { passoFile: 1.0, gcr: 0.24, quotaAsse: 0.45, file: 29, x0: 70.28, x1: 98.28, tracker: 79, moduli: 3696, potenzaMWp: 2.40, testaPaloM: 4.4,
          quoteM: { asse: 4.50, bordoInferiore: 3.46, bordoSuperiore: 5.54, trattore: 2.90 }, filaQuote: 16, xQuote: 85.28, zQuote: 33 },
  stringa14B: { fila: 14, x: 10.0, tracker: 'B', z0: -1.14, z1: 5.38, centro: [10.0, 1.36, 2.12] },
  // §6.6 geometrie dei pezzi (metri, gruppo × 0,1)
  pezzi: {
    modulo: [2.384, 0.035, 1.134],
    tubo: [0.12, 0.12],
    palo: { profilo: [0.12, 0.12], altezzaFV: 1.5, altezzaAgri: 4.4 },
    cuscinetto: { toro: [0.09, 0.025] },
    motoriduttore: { box: [0.35, 0.30, 0.25], ralla: 0.30 },
    controllore: [0.30, 0.40, 0.12],
  },
  colture: { lunghezza: 1, altezza: 0.06, passoRighe: 0.075, esclusionePali: 0.05, istanze: 7600 },
  trattore: { ingombroM: [4.5, 2.4, 2.9], x: 84.95, zDa: 24.0, zA: 39.5 },
  bandingCantiere: { battipali: 2, box: [0.6, 0.25, 0.25], antenna: 0.9 },
  recinzione: { passoM: 3, rientro: 0.5 },
};

// =============================================================================
// §3.6 VALLE
// =============================================================================
export const VALLE = {
  blocco: { x0: -230, x1: 230, z0: -60, z1: 0, base: -6 },
  appoggio: { y: -6.02, lato: 2000, colore: '#0d1012' },
  PUNTI_M: [[-230, 18], [-106, 18], [-94, 14], [-46, 14], [-34, 10], [14, 10], [26, 5], [114, 5], [126, 2], [230, 2]],
  superficie: { dim: [460, 60], segmenti: [460, 60] },
  peli: { lagoAlto: 88.0, serbatoio: 17.0, fiumeMonte: [-29, 1.7], fiumePool: [106, 1.2], valle: [0.0, -0.1] },
  taglio: { passoContorno: 0.5,
            fori: { francis: { x: [-37, -29], y: [0.2, 0.95] }, kaplan: { x: [106, 118], y: [-1.8, -0.40] } },
            acquaAlfa: 0.22 },
  righello: { x: -236, y0: 0, y1: 90, passo: 5 /* tacca ogni 50 m */, tacca: 0.6 /* lunghezza */, passoLungo: 10 /* ogni 100 m */, taccaLunga: 1.4, numeri: '0 … 900 m' },
  parentesi: [
    { nome: 'Pelton',  y0: 18.0, y1: 88.0, x: -100, testo: '700 m' },
    { nome: 'Francis', y0: 2.0,  y1: 17.0, x: -46,  testo: '150 m' },
    { nome: 'Kaplan',  y0: 0.0,  y1: 1.2,  x: 104,  testo: '12 m' },
  ],
  sfalsamentoParentesi: 0.04,
  presaPelton: { pos: [-176, 87, -0.2], dim: [0.6, 1.0, 0.6] },
  condottaPelton: { da: [-175.5, 86.0], a: [-96, 18.6], fine: [-93.5, 18.0, -0.4], sopraFondo: 0.06, raggio: 0.035, ancoraggiOgni: 10, lunghezza: 104 },
  centralePelton: { x: [-98, -86], y: [17.4, 19.6], z: [-2.4, 2.4] },
  girantePelton: { centro: [-92, 18.0, -0.4], diametroPrimitivoM: 1.68, cucchiai: 22, larghezzaCucchiaioM: 0.30, verso: 'antiorario da +z' },
  ugelloA: { asseY: 17.916, x0: -92.25, x1: -92.0, direzione: '+x', gettoDiametroM: 0.094 },
  ugelloB: { asseX: -92.084, y0: 18.25, y1: 18.0, direzione: '-y', gettoDiametroM: 0.094 },
  carterPelton: { raggioM: 1.6, profonditaM: 1.0 },
  generatorePelton: { z: [-1.0, -1.5], diametroM: 3.5 },
  diga: { x: [-42, -38], coronamento: 17.6, fondazione: 2.0, spessoreCoronamentoM: 4, spessoreBaseM: 25, raggioArco: 30, z: [-18, 18] },
  condottaFrancis: { da: [-43, 9.0, 0], a: [-34.4, 2.0, -0.8], diametroM: 1.55 },
  centraleFrancis: { x: [-37, -29], y: [0.2, 3.4], z: [-2.5, 2.5] },
  giranteFrancis: { centro: [-33, 2.0, -0.8], D1M: 1.60, D2M: 1.26, pale: 15,
                    chiocciola: { r0M: 2.6, r1M: 1.7, gradi: 345, sezioneM: 0.775 }, avantdistributore: 20, direttrici: 20 },
  traversaKaplan: { x: 112, pool: 1.2, valle: 0.0, centraleZ: [-3.5, 0] },
  giranteKaplan: { centro: [112, -0.4, -1.2], diametroM: 4.5, mozzoM: 1.9, pale: 5, direttrici: 24, raggioDirettriciM: 3.6, altezzaDirettriciM: 1.8,
                   semichioccialaRaggioM: 12, conoY: -1.6 },
  diagramma: { origine: [-60, 2, 60], dim: [100, 60] },
  // Piani di taglio (§3.6): THREE.Plane(normale, costante); si tiene n·p + c ≥ 0.
  piani: {
    Z0: { normale: [0, 0, -1], costante: 0 },      // tiene z ≤ 0
    ZP: { normale: [0, 0, -1], costante: -0.4 },   // carter Pelton
    YF: { normale: [0, -1, 0], costante: 10, fine: 2.0 }, // tiene y ≤ c; animato da STATO.YF
    ZK: { normale: [0, 0, -1], costante: -1.2 },   // Kaplan
  },
  luci: {
    rect: { colore: '#fff4e8', intensita: 8, dim: [0.05, 0.6], kelvin: 5000,
            sale: {   // due strisce sopra ciascuna sala (u, mondo). Pelton da §4.5; Francis/Kaplan [ARCH] da tarare
              pelton:  [[-92, 19.4, -0.3], [-92, 19.4, -1.2]],
              francis: [[-33, 3.3, -0.3], [-33, 3.3, -1.3]],
              kaplan:  [[112, 0.6, -0.6], [112, 0.6, -1.8]],
            } },
    spot: { colore: '#ffb46b', intensita: 30, angolo: 0.5, penombra: 0.6 },
  },
};

// ---------------------------------------------------------------- Appendice B · idro
export const IDRO = {
  g: 9.81, rho: 1000, eta: 0.9,
  pelton:  { H: 700, Q: 1.6, P: 9.89, v: 117.2, getto: 114.8, rpm: 600, ns: 12, linee: 2, vLinee: 5.86, colonna: { r: 0.70, h: 51.8 }, punto: [30.1, 51.8], girante: { dM: 2.0, u: 6.0 }, condottaDM: 0.71, gettoDM: 0.094, giriS: 1.25 },
  francis: { H: 150, Q: 7.5, P: 9.93, v: 54.2, rpm: 600, ns: 114, linee: 5, vLinee: 2.71, colonna: { r: 1.51, h: 39.6 }, punto: [46.9, 39.6], girante: { dM: 1.6, u: 4.8 }, condottaDM: 1.55, giriS: 1.25 },
  kaplan:  { H: 12, Q: 95, P: 10.07, v: 15.3, rpm: 150, ns: 674, linee: 59, vLinee: 0.77, colonna: { r: 5.36, h: 19.6 }, punto: [74.4, 19.6], girante: { dM: 4.5, u: 13.5 }, giriS: 0.31 },
  // N = max(2, round(Q/1,6)); v = 0,05·√(2gH) u/s (§4.5)
  lineeFattoreQ: 1.6, lineeVelocita: 0.05,
  tempoScala: { iniziale: 1 / 1000, finale: 1 / 8 },
  omegaMaxFattore: 0.45,          // ω ≤ 0,45·(2π/Npale)·fps
  diagramma: {
    Q: [0.1, 1000], H: [1, 2000], xScala: 25, yScala: 18.2, canvas: [4096, 2458],
    campi: { kaplan: { H: [2, 40], Q: [2, 1000] }, francis: { H: [30, 400], Q: [0.5, 600] }, pelton: { H: [300, 2000], Q: [0.1, 40] } },
    isopotenzaMW: [1, 100], taglioMW: 1000,
    retta10: { kW: 10000, Q: [0.6, 1000], fattore: 8.829 },
    // estremi della retta dei 10 MW in coordinate mondo (riserva per LineaOro se diagramma.js non registra ancore)
    retta10Mondo: [[-40.546, 61.622, 60], [40.0, 2.984, 60]],
    colonneZ: 64, girantiZ: 70, scalaGiranti: 30,
    etichetteAssi: { Q: '0,1 1 10 100 1 000 m³/s', H: '1 10 100 1 000 2 000 m' },
    didascalia: 'campi indicativi',
  },
};

// =============================================================================
// §4.0 TAPPE
// =============================================================================
export const TAPPE = [
  { indice: 0, id: 'apertura',       nome: '00 Territorio',          durata: 2.0, T0: 0.00,  T1: 2.00,  mondo: 'pianura', lato: 'sinistra' },
  { indice: 1, id: 'sviluppo',       nome: '01 Sviluppo',            durata: 3.0, T0: 2.00,  T1: 5.00,  mondo: 'pianura', lato: 'sinistra' },
  { indice: 2, id: 'autorizzazione', nome: '02 Autorizzazioni',      durata: 2.5, T0: 5.00,  T1: 7.50,  mondo: 'pianura', lato: 'sinistra' },
  { indice: 3, id: 'fotovoltaico',   nome: '03 Fotovoltaico',        durata: 4.0, T0: 7.50,  T1: 11.50, mondo: 'pianura', lato: 'sinistra' },
  { indice: 4, id: 'idroelettrico',  nome: '04 Idroelettrico',       durata: 4.0, T0: 11.50, T1: 15.50, mondo: 'valle',   lato: 'sinistra' },
  { indice: 5, id: 'costruzione',    nome: '05 Cantiere e gestione', durata: 2.0, T0: 15.50, T1: 17.50, mondo: 'pianura', lato: 'sinistra' },
  { indice: 6, id: 'finale',         nome: '06 Un referente',        durata: 1.5, T0: 17.50, T1: 19.00, mondo: 'pianura', lato: 'sinistra' },
];
// Il mondo cambia ESATTAMENTE a questi T (§4.4, §4.5): VALLE per T ∈ [11,50, 15,50)
export const CAMBIO_MONDO = { valleDa: 11.50, valleA: 15.50 };

// Colonna del testo e velo (§4.0)
export const COLONNA = {
  left: 'clamp(24px, 6vw, 112px)', larghezza: 'min(36vw, 600px)', spostamentoY: '-4vh',
  scrim: 'linear-gradient(90deg, rgba(5,6,7,.82) 0%, rgba(5,6,7,.62) 22%, rgba(5,6,7,0) 44%)',
  scrimDurataT: 0.04, ombraTesto: '0 2px 24px rgba(5,6,7,.9)',
  limiteSoggetto: 0.38,           // la colonna occupa sx < 0,38 (App. C)
};

// =============================================================================
// §4.1–4.7 CAMERA — keyframe del rig sferico
// {id, mondo, t0, t1, T:[x,y,z], d, phi, psi, fov, ancora, vicino, lontano, via?, deriva?, ombra, ombraCentro?, P}
// phi verso il basso (°), psi = rotta della vista (0 = Nord), fov verticale (°).
// v = (cosφ·sinψ, −sinφ, −cosφ·cosψ); P = T − d·v. P è la posizione risultante (verifica, App. C).
// ombra = 'meta' del frustum d'ombra (§6.4), interpolata in log nei voli; ombraCentro: default = target.
// deriva: offset lineari applicati durante la sosta: param(t0) = base + deriva[0], param(t1) = base + deriva[1].
// =============================================================================
export const CAMERA = [
  // ---- tappa 0 ----
  { id: 'K0.0', mondo: 'pianura', t0: 0.00, t1: 0.15, T: [-30, 0, 0], d: 1150, phi: 89.5, psi: 90, fov: 16.1, ancora: 'target', vicino: 5, lontano: 4000, ombra: 190, ombraCentro: SITO_C, P: [-40.04, 1149.96, 0.00] },
  { id: 'K0.1', mondo: 'pianura', t0: 1.55, t1: 2.00, T: [-12.6, 0, -27.8], d: 300, phi: 24, psi: 12, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, ombraCentro: SITO_C, P: [-69.58, 122.02, 240.27] },
  // ---- tappa 1 ----
  { id: 'K1.0', mondo: 'pianura', via: true, t0: 2.45, t1: 2.45, T: [-8.7, 0, 26.0], d: 340, phi: 40, psi: 200, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, P: [80.38, 218.55, -218.75] },
  { id: 'K1.1', mondo: 'pianura', t0: 3.15, t1: 3.30, T: [-4.2, 0, 32.3], d: 330, phi: 38, psi: 222, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, P: [169.80, 203.17, -160.95] },
  { id: 'K1.2', mondo: 'pianura', t0: 3.55, t1: 4.15, T: [27.0, 1.2, 23.4], d: 95, phi: 34, psi: 236, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 60, P: [92.29, 54.32, -20.64] },
  { id: 'K1.3', mondo: 'pianura', t0: 4.40, t1: 4.95, T: [20.6, 1.2, 22.9], d: 125, phi: 62, psi: 270, fov: 27.0, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 60, P: [79.28, 111.57, 22.90] },
  // ---- tappa 2 ----
  { id: 'K2.0', mondo: 'pianura', t0: 5.25, t1: 5.95, T: [34.3, 0, -4.0], d: 230, phi: 32, psi: 329, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, P: [134.76, 121.88, 163.19] },
  { id: 'K2.1', mondo: 'pianura', t0: 6.20, t1: 6.80, T: [51.4, 0, -36.2], d: 170, phi: 30, psi: 350, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, P: [76.97, 85.00, 108.79] },
  { id: 'K2.2', mondo: 'pianura', t0: 7.00, t1: 7.45, T: [-3.4, 1.2, 5.8], d: 150, phi: 66, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 60, P: [-3.40, 138.23, 66.81] },
  // ---- tappa 3 ----
  { id: 'K3.0', mondo: 'pianura', t0: 7.60, t1: 7.90, T: [26.4, 1.2, -12.1], d: 60, phi: 8, psi: 30, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 60, P: [-3.31, 9.55, 39.36] },
  { id: 'K3.1', mondo: 'pianura', t0: 8.10, t1: 8.70, T: [20.2, 1.36, 10.2], d: 3.4, phi: 18, psi: 45, fov: 27.0, ancora: 'target', vicino: 0.02, lontano: 1500, ombra: 3, P: [17.91, 2.41, 12.49] },
  { id: 'K3.2', mondo: 'pianura', via: true, t0: 8.95, t1: 8.95, T: [15.7, 1.36, 2.0], d: 55, phi: 24, psi: 20, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 26, P: [-1.48, 23.73, 49.21] },
  { id: 'K3.3', mondo: 'pianura', t0: 9.15, t1: 9.30, T: [17.0, 1.36, 4.0], d: 34, phi: 9, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.1, lontano: 3000, ombra: 26, P: [17.00, 6.68, 37.58] },
  { id: 'K3.4', mondo: 'pianura', via: true, t0: 9.55, t1: 9.55, T: [18.1, 1.36, 10.7], d: 40, phi: 30, psi: 285, fov: 37.8, ancora: 'target', vicino: 0.1, lontano: 3000, ombra: 26, P: [51.56, 21.36, 19.67] },
  { id: 'K3.5', mondo: 'pianura', t0: 9.95, t1: 10.08, T: [27.5, 1.36, 7.7], d: 46, phi: 70, psi: 180, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 30, P: [27.50, 44.59, -8.03] },
  { id: 'K3.6', mondo: 'pianura', via: true, t0: 10.40, t1: 10.40, T: [90.8, 1.0, 25.7], d: 42, phi: 20, psi: 80, fov: 37.8, ancora: 'target', vicino: 0.1, lontano: 3000, ombra: 26, P: [51.93, 15.36, 32.55] },
  { id: 'K3.65', mondo: 'pianura', via: true, t0: 10.58, t1: 10.58, T: [82.03, -3.40, 26.88], d: 17.5, phi: 25, psi: 350, fov: 45.0, ancora: 'camera', vicino: 0.02, lontano: 2000, ombra: 10, P: [84.78, 4.00, 42.50] },
  { id: 'K3.7', mondo: 'pianura', t0: 10.70, t1: 10.70, T: [81.75, 2.27, 23.31], d: 17.5, phi: -4, psi: 350, fov: 53.1, ancora: 'camera', vicino: 0.02, lontano: 2000, ombra: 10, P: [84.78, 1.05, 40.50] },
  { id: 'K3.8', mondo: 'pianura', t0: 11.30, t1: 11.30, T: [81.75, 2.27, 19.31], d: 17.5, phi: -4, psi: 350, fov: 53.1, ancora: 'camera', vicino: 0.02, lontano: 2000, ombra: 10, P: [84.78, 1.05, 36.50] },
  { id: 'K3.9', mondo: 'pianura', t0: 11.50, t1: 11.50, T: [76.52, 3.97, -60.0], d: 95, phi: 4, psi: 355, fov: 45.0, ancora: 'camera', vicino: 0.1, lontano: 3000, ombra: 60, P: [84.78, 10.60, 34.40] },
  // ---- tappa 4 (VALLE) ----
  { id: 'V4.0', mondo: 'valle', t0: 11.50, t1: 12.05, T: [-140, 60, -20], d: 1600, phi: 8, psi: 0, fov: 16.1, ancora: 'target', vicino: 20, lontano: 6000, ombra: 260, P: [-140.00, 282.68, 1564.43] },
  { id: 'V4.1', mondo: 'valle', via: true, t0: 12.25, t1: 12.25, T: [-168, 82, -2], d: 40, phi: 12, psi: 350, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 40 /* [ARCH] */, P: [-161.21, 90.32, 36.53] },
  { id: 'V4.2', mondo: 'valle', via: true, t0: 12.55, t1: 12.55, T: [-125, 45, -1], d: 22, phi: 18, psi: 340, fov: 37.8, ancora: 'target', vicino: 0.1, lontano: 3000, ombra: 25 /* [ARCH] */, P: [-117.84, 51.80, 18.66] },
  { id: 'V4.3', mondo: 'valle', t0: 12.80, t1: 12.80, T: [-92, 18.0, -0.4], d: 1.5, phi: 6, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.01, lontano: 1500, ombra: 0.6, P: [-92.00, 18.16, 1.09] },
  { id: 'V4.4', mondo: 'valle', t0: 13.00, t1: 13.30, T: [-92.02, 17.916, -0.4], d: 0.12, phi: 4, psi: 345, fov: 22.0, ancora: 'target', vicino: 0.005, lontano: 800, ombra: 0.6, P: [-91.99, 17.92, -0.28] },
  { id: 'V4.5', mondo: 'valle', via: true, t0: 13.55, t1: 13.55, T: [-62, 10, -3], d: 70, phi: 14, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.2, lontano: 3000, ombra: 60, P: [-62.00, 26.93, 64.92] },
  { id: 'V4.6', mondo: 'valle', t0: 13.80, t1: 14.15, T: [-33, 2.0, -0.8], d: 1.4, phi: 60, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.01, lontano: 1500, ombra: 0.6, P: [-33.00, 3.21, -0.10] },
  { id: 'V4.7', mondo: 'valle', t0: 14.40, t1: 14.75, T: [112, -0.4, -1.2], d: 2.6, phi: 22, psi: 340, deriva: { psi: [0, 40] }, fov: 37.8, ancora: 'target', vicino: 0.01, lontano: 1500, ombra: 0.6, P: [112.82, 0.57, 1.07] },
  { id: 'V4.8', mondo: 'valle', t0: 15.00, t1: 15.38, T: [-33.5, 32, 60], d: 120, phi: 3, psi: 0, deriva: { psi: [-4, 4] }, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 120 /* [ARCH] */, P: [-33.50, 38.28, 179.84] },
  // ---- tappa 5 ----
  { id: 'K5.0', mondo: 'pianura', t0: 15.50, t1: 15.62, T: [4.6, 1.2, 11.3], d: 110, phi: 38, psi: 330, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 60, P: [47.94, 68.92, 86.37] },
  { id: 'K5.1', mondo: 'pianura', t0: 16.55, t1: 16.55, T: [6.1, 1.2, 2.2], d: 105, phi: 36, psi: 0, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 60, P: [6.10, 62.92, 87.15] },
  { id: 'K5.2', mondo: 'pianura', t0: 16.80, t1: 17.40, T: [0.0, 1.2, 0.6], d: 55, phi: 24, psi: 295, fov: 37.8, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 60, P: [45.54, 23.57, 21.83] },
  // ---- tappa 6 ----
  { id: 'K6.0', mondo: 'pianura', t0: 18.30, t1: 19.00, T: [-99.23, 15.85, 42.65], d: 300, phi: 5, psi: 288, deriva: { psi: [0, 1.5], d: [0, -10] }, fov: 45.0, ancora: 'target', vicino: 0.5, lontano: 4000, ombra: 190, P: [185.00, 42.00, 135.00] },
];

// Regole del rig (§4.0)
export const RIG = {
  microDeriva: { psi: 0.4, periodoPsi: 23, phi: 0.2, periodoPhi: 31 },
  parallasse: { psi: 0.6, phi: 0.4, lambda: 3 },
  quotaMinimaSuolo: 0.3,                       // solo PIANURA
  rollio: { fattore: -0.004, max: 2 },         // clamp(−0,004·dψ/dT, ±2°)
  aspettoStretto: 1.5, fovMax: 75,             // se aspect < 1,5: fovV = 2·atan(tan(fov/2)·1,5/aspect)
  serviziDurata: 1.2,                          // s, power2.inOut (§4.7)
};

// =============================================================================
// §4.0 STATO — valori iniziali (DESIGN) + estensioni [ARCH] marcate
// =============================================================================
export const STATO_INIZIALE = {
  // terreno (uniform condivise da terreno, alberi, fiume, cabine)
  uOnda: -10, uRealta: 0, uFronteRealta: -1, uIso: 1.0, uGriglia: 0.8, uFiumeMappa: 1,
  uV: [0, 0, 0, 0, 0],            // vincoli: paesaggistico, fluviale, PAI, archeologico, ambientale
  uIdonee: 0, uSottrazione: 0, uSito: 0, uProprietari: 0, uTrattativaFirmata: 0, uAgriSel: 0,
  uLayout: 0, uLayoutApprovato: 0, uOndaRame: -1, uRitraccia: -1, uNuvole: 0, uNuvoleVel: 1, uHover: 0,
  // oggetti
  fogliGIS: [{ y: 22, o: 0 }, { y: 26, o: 0 }, { y: 30, o: 0 }, { y: 34, o: 0 }, { y: 38, o: 0 }],
  tende: 0, percorso: 0, cavo: 0, impulsi: 0, lunetta: 0, sigillo: 0, polvere: 0,
  esplosione: 1, comparsaFV: -0.1, comparsaAgri: -0.1, comparsaPali: 1.1, comparsaTubi: 1.1, comparsaModuli: 1.1,
  ora: 6.1667, tempoScala: 1, quoteAgri: 0, trattore: 0,
  // idro
  righello: 0, parentesi: 0, YF: 10, apertura: 0, passoKaplan: -8, oscura: 0, diagramma: 0, colonne: 0, giranti: 0, retta10: 0,
  // luce
  sole: { el: 4, az: 295, int: 2.0, col: '#ffb46b' }, emisfera: 0.06, envGlobale: 0.55, esposizione: 0.95,
  mixHDRI: 0, nebbia: 0.0004 /* [ARCH] K0.0 vista da 1 150 u: 0,0018 la nasconderebbe */, velo: 0, saturazione: 1, maturita: 0,

  // ---- estensioni [ARCH] ----
  fiume: 0,                 // opacità del nastro d'acqua (§4.1)
  percorsoAlfa: 1,          // dissolvenza del sopralluogo dopo 4,15 [ARCH]
  luciCP: 0,                // emissivo luci cabina primaria (0 → 3)
  sigilloAlfa: 1,           // opacità di sigillo (lunetta usa 'lunetta')
  uModo: 0,                 // 0 = onda (tappa 3), 1 = cantiere (tappa 5) (§6.6)
  uFronte: -1,              // anello del collaudo (tappa 5), −1 = spento
  uCantiere: 0,             // piazzali/viabilità di cantiere in tMaschere.A (tappa 5)
  cavoProgetto: 0,          // 1 = cavidotto tratteggiato "di progetto" (tappa 5)
  cavoScavo: 0,             // 1 = trincea scura tratteggiata (tappa 5)
  cabine: 1,                // scala delle cabine al cancello
  eroe: 0,                  // comparsa del tracker eroe (scala pezzi 0 → 1)
  giraModulo: 0,            // 0 → 1: rotazione 0 → 180° → 0 del modulo accanto alla ralla
  gtao: 0, gtaoRaggio: 0.012,
  soleAuto: 0,              // 0 = sole da tracce; 1 = da ora (posizioneSole + luceSole); 2 = el/az/int da tracce, colore da luceSole
  trackerManuale: 0, trackerAngoloManuale: 0,   // tappa 5: angolo dei tracker imposto
  cielo: 'tramonto',        // preset (stringa) → in STATO diventa {da, a, k}
  discoSole: 1,             // moltiplicatore del bagliore del disco (finale: 1 → 0,3)
  idroHud: 0, saltoHud: 0, condottaEmissione: 1.4,
  rectInt: 0, rectSala: 0,  // RectAreaLight: intensità e sala (0 Pelton, 1 Francis, 2 Kaplan)
  getti: 0, lame: 0, spruzzi: 0,
  tempoScalaEsp: 0,         // tempoScala = 10^tempoScalaEsp (derivato)
  aperturaKaplan: 0.3, campi: 0, puntiLavoro: 0,
  lineaOroAlfa: 0, lineaOroStende: 0, lineaOroPiega: 0,
  gantt: 0, archi: 0, picchetti: 0, recinzione: 0,
  piastra: 0, statoFile: 0, stringa14B: 0, termica: 0,
  petali: 0,
};

// =============================================================================
// TRACCE — eventi legati allo scroll (tabelle "Eventi" di §4.1–4.7)
// Formato: chiave → [[T0, T1, da, a, ease?], ...]   (ease di default 'none')
//  - set istantaneo: [T, T, null, valore]
//  - chiave annidata con il punto: 'uV.0', 'fogliGIS.2.o', 'sole.el'
//  - valori: numero | colore '#rrggbb' (interpolato in lineare) | stringa (preset → {da, a, k})
// Semantica (regia/stato.js): vale l'ULTIMO segmento con T0 ≤ T; prima del primo segmento
// vale STATO_INIZIALE; oltre T1 vale 'a'. Funzione pura di T: reversibile e saltabile.
// =============================================================================
const P2IO = 'power2.inOut';
export const TRACCE = {
  // ---------------- tappa 0 (§4.1)
  uOnda:        [[0.20, 1.25, -10, 360, P2IO]],
  uRealta:      [[0.55, 1.35, 0, 1, P2IO], [5.05, 5.60, 1, 0.30, P2IO], [7.88, 7.90, 0.30, 1] /* [ARCH] chiude il fronte */, [17.95, 18.30, 1, 0.6, P2IO]],
  uFiumeMappa:  [[0.90, 1.30, 1, 0]],
  fiume:        [[0.95, 1.35, 0, 1]],
  uIso:         [[0.00, 2.00, 1.0, 0.75], [5.05, 5.60, 0.75, 1.2], [7.62, 7.90, 1.2, 0.6], [17.95, 18.30, 0.6, 1.0]],
  uGriglia:     [[0.00, 1.40, 0.8, 0.55], [17.95, 18.30, 0.55, 0.45]],
  maturita:     [[1.25, 1.55, 0, 5], [2.55, 3.15, 5, 20], [3.55, 4.05, 20, 35], [4.42, 4.85, 35, 45], [5.30, 5.90, 45, 65], [6.25, 6.70, 65, 85], [7.00, 7.10, 85, 100]],

  // ---------------- tappa 1 (§4.2)
  lunetta:      [[2.00, 2.10, 0, 1], [7.62, 7.75, 1, 0]],
  'fogliGIS.0.o': [[2.30, 2.37, 0, 0.55], [2.63, 2.67, 0.55, 0]],
  'fogliGIS.1.o': [[2.32, 2.39, 0, 0.55], [2.75, 2.79, 0.55, 0]],
  'fogliGIS.2.o': [[2.34, 2.41, 0, 0.55], [2.87, 2.91, 0.55, 0]],
  'fogliGIS.3.o': [[2.36, 2.43, 0, 0.55], [2.99, 3.03, 0.55, 0]],
  'fogliGIS.4.o': [[2.38, 2.45, 0, 0.55], [3.11, 3.15, 0.55, 0]],
  'fogliGIS.0.y': [[2.55, 2.65, 22, 1.5, 'power2.in']],
  'fogliGIS.1.y': [[2.67, 2.77, 26, 1.5, 'power2.in']],
  'fogliGIS.2.y': [[2.79, 2.89, 30, 1.5, 'power2.in']],
  'fogliGIS.3.y': [[2.91, 3.01, 34, 1.5, 'power2.in']],
  'fogliGIS.4.y': [[3.03, 3.13, 38, 1.5, 'power2.in']],
  'uV.0':       [[2.63, 2.67, 0, 1], [3.30, 3.55, 1, 0.25], [7.62, 7.88, 0.25, 0] /* [ARCH] */],
  'uV.1':       [[2.75, 2.79, 0, 1], [3.30, 3.55, 1, 0.25], [7.62, 7.88, 0.25, 0] /* [ARCH] */],
  'uV.2':       [[2.87, 2.91, 0, 1], [3.30, 3.55, 1, 0.25], [7.62, 7.88, 0.25, 0] /* [ARCH] */],
  'uV.3':       [[2.99, 3.03, 0, 1], [3.30, 3.55, 1, 0.25], [7.62, 7.88, 0.25, 0] /* [ARCH] */],
  'uV.4':       [[3.11, 3.15, 0, 1], [3.30, 3.55, 1, 0.25], [7.62, 7.88, 0.25, 0] /* [ARCH] */],
  uSottrazione: [[3.15, 3.30, 0, 1, P2IO], [5.05, 5.60, 1, 0.5], [7.62, 7.88, 0.5, 0] /* [ARCH] */],
  uIdonee:      [[3.15, 3.30, 0, 1, P2IO], [3.30, 3.55, 1, 0.4], [5.05, 5.60, 0.4, 0.2], [7.62, 7.88, 0.2, 0] /* [ARCH] */],
  uSito:        [[3.50, 3.60, 0, 1], [7.75, 8.70, 1, 0.3] /* [ARCH] come il layout */],
  tende:        [[3.55, 3.70, 0, 0.8, 'expo.out'], [4.15, 4.30, 0.8, 0, 'power2.in']],
  percorso:     [[3.65, 3.85, 0, 1]],
  percorsoAlfa: [[4.15, 4.30, 1, 0] /* [ARCH] */],
  uTrattativaFirmata: [[3.95, 4.05, 0, 1]],
  uLayout:      [[4.42, 4.85, 0, 1]],

  // ---------------- luce tappe 1–3 (§2.4, §4.2–4.4)
  'sole.el':    [[2.00, 4.95, 4, 1.5], [4.95, 5.25, 1.5, -2] /* [ARCH] raccordo */, [5.25, 7.45, -2, -6], [7.52, 7.52, null, -1], [7.60, 8.10, -1, 3.3],
                 [11.50, 11.50, null, 35], [15.50, 15.50, null, 28], [16.50, 16.60, 28, 50.5], [17.45, 18.30, 50.5, 2.0]],
  'sole.az':    [[2.00, 4.95, 295, 298], [4.95, 5.25, 298, 300], [5.25, 7.45, 300, 305], [7.52, 7.52, null, 56], [7.60, 8.10, 56, 61],
                 [11.50, 11.50, null, 210], [15.50, 15.50, null, 240], [16.50, 16.60, 240, 255.5], [17.45, 18.30, 255.5, 300.2]],
  'sole.int':   [[2.00, 4.95, 2.0, 1.2], [4.95, 5.25, 1.2, 0], [7.60, 8.10, 0, 1.6],
                 [11.50, 11.50, null, 2.6], [15.50, 15.50, null, 3.0], [16.50, 16.60, 3.0, 3.3], [17.45, 18.30, 3.3, 1.6]],
  'sole.col':   [[1.55, 2.00, '#ffb46b', '#ffa45c'] /* [ARCH] */, [2.00, 5.00, '#ffa45c', '#ff8f4f'], [7.60, 8.10, '#ff8a4c', '#ff9d5c'],
                 [11.50, 11.50, null, '#fff1df'], [15.50, 15.50, null, '#ffe2bf'], [16.50, 16.60, '#ffe2bf', '#fff1df']],
  soleAuto:     [[8.70, 8.70, null, 1], [11.50, 11.50, null, 0], [17.45, 17.45, null, 2]],
  ora:          [[7.60, 8.70, 5 + 34 / 60, 6.0], [8.70, 9.15, 6.0, 6 + 10 / 60], [9.15, 9.55, 6 + 10 / 60, 9 + 40 / 60], [9.55, 9.95, 9 + 40 / 60, 13 + 11 / 60],
                 [9.95, 10.40, 13 + 11 / 60, 17.5], [10.40, 11.30, 17.5, 19.0], [11.30, 11.50, 19.0, 19.25], [15.50, 15.50, null, 16.0] /* [ARCH] HUD 16:00 */],
  emisfera:     [[2.00, 5.00, 0.06, 0.12], [5.00, 5.60, 0.12, 0.35], [7.45, 7.60, 0.35, 0.15], [7.60, 8.70, 0.15, 0.08], [8.70, 9.15, 0.08, 0.06],
                 [10.40, 10.70, 0.06, 0.08], [11.50, 11.50, null, 0.10], [15.50, 15.50, null, 0.06]],
  envGlobale:   [[1.90, 2.10, 0.55, 0.50], [5.00, 7.45, 0.50, 0.35], [7.45, 7.60, 0.35, 0.45], [10.40, 10.70, 0.45, 0.50],
                 [11.50, 11.50, null, 0.60], [12.55, 12.80, 0.60, 0.35], [13.30, 13.55, 0.35, 0.60], [13.55, 13.80, 0.60, 0.35], [14.75, 15.00, 0.35, 0.60] /* interni [ARCH] */,
                 [15.50, 15.50, null, 0.55]],
  esposizione:  [[2.00, 4.95, 0.95, 0.88], [4.95, 5.25, 0.88, 0.80] /* [ARCH] raccordo */, [5.25, 7.45, 0.80, 0.62], [7.45, 7.52, 0.62, 0.45], [7.52, 7.62, 0.45, 0.80],
                 [7.62, 8.70, 0.80, 0.85], [9.15, 9.95, 0.85, 1.00], [9.95, 10.40, 1.00, 0.95],
                 [11.50, 11.50, null, 0.90], [12.55, 12.80, 0.90, 1.00], [13.30, 13.55, 1.00, 0.90], [13.55, 13.80, 0.90, 1.00], [14.75, 15.00, 1.00, 0.90] /* interni [ARCH] */,
                 [15.50, 15.50, null, 1.00], [17.45, 18.30, 1.00, 0.95]],
  saturazione:  [[1.90, 2.10, 1, 0.85], [4.90, 5.10, 0.85, 1]],     // "analisi" in tappa 1 [raccordi ARCH]
  cielo:        [[5.00, 5.60, 'tramonto', 'oraBlu'], [7.52, 7.52, null, 'alba'], [9.15, 9.60, 'alba', 'giornoScuro'], [10.10, 10.40, 'giornoScuro', 'pomeriggio'],
                 [11.50, 11.50, null, 'museale'], [15.50, 15.50, null, 'pomeriggio'], [17.80, 18.30, 'pomeriggio', 'tramonto']],
  discoSole:    [[18.30, 18.52, 1, 0.3, 'expo.out']],
  // densità (1/u) per inquadratura; [ARCH] dove DESIGN non fissa il T
  nebbia:       [[0.15, 1.55, 0.0004, 0.0018, P2IO], [3.30, 3.55, 0.0018, 0.003], [4.95, 5.25, 0.003, 0.0018], [7.45, 7.60, 0.0018, 0.003],
                 [7.90, 8.10, 0.003, 0.006], [8.70, 8.95, 0.006, 0.003], [11.32, 11.50, 0.003, 0.02, 'power2.in'],
                 [11.50, 11.65, 0.02, 0.00025, 'power2.out'], [12.05, 12.55, 0.00025, 0.003], [12.55, 12.80, 0.003, 0.006],
                 [13.30, 13.55, 0.006, 0.002], [13.55, 13.80, 0.002, 0.004], [14.75, 15.00, 0.004, 0.00025],
                 [15.50, 15.50, null, 0.003], [17.40, 18.30, 0.003, 0.0018]],
  velo:         [[11.42, 11.50, 0, 1], [11.50, 11.65, 1, 0, 'power2.out'], [15.40, 15.47, 0, 1], [15.52, 15.62, 1, 0]],

  // ---------------- tappa 2 (§4.3)
  cavo:         [[6.22, 6.62, 0, 1]],
  impulsi:      [[6.62, 6.70, 0, 1], [7.45, 7.60, 1, 0] /* "fino a fine tappa" */],
  luciCP:       [[6.55, 6.65, 0, 3], [7.60, 8.10, 3, 0] /* [ARCH] spente all'alba */],
  sigillo:      [[7.10, 7.18, 0, 1, 'power4.in']],
  sigilloAlfa:  [[7.62, 7.75, 1, 0]],
  polvere:      [[7.18, 7.30, 0, 1, 'expo.out']],
  uOndaRame:    [[7.18, 7.42, -1, 140, 'power2.out'], [7.45, 7.45, null, -1] /* [ARCH] spenta nel buio */],
  uLayoutApprovato: [[7.20, 7.26, 0, 1], [7.75, 8.70, 1, 0.3], [15.50, 15.50, null, 1], [16.05, 16.40, 1, 0.3], [17.95, 18.30, 0.3, 0.6]],

  // ---------------- tappa 3 (§4.4)
  uFronteRealta: [[7.62, 7.88, -1, 300, P2IO]],
  gtao:         [[7.95, 8.10, 0, 0.9], [8.70, 8.85, 0.9, 0.3], [11.32, 11.50, 0.3, 0] /* [ARCH] */, [12.70, 12.85, 0, 0.9], [14.75, 15.00, 0.9, 0] /* [ARCH] */],
  gtaoRaggio:   [[11.50, 11.50, null, 0.004], [15.50, 15.50, null, 0.012]],
  eroe:         [[7.92, 8.08, 0, 1, 'expo.out'], [8.72, 8.72, null, 0] /* le istanze prendono il posto dell'eroe */],
  esplosione:   [[8.15, 8.60, 1, 0]],         // per pezzo power4.out (calcolo in impianti/tracker.js)
  giraModulo:   [[8.56, 8.66, 0, 1, P2IO]],
  comparsaFV:   [[8.72, 8.98, -0.1, 1.1]],
  comparsaAgri: [[8.80, 9.00, -0.1, 1.1]],
  quoteAgri:    [[10.72, 10.80, 0, 1, 'expo.out']],
  trattore:     [[10.78, 11.22, 0, 1]],      // z 24,0 → 39,5 lungo x = 84,95

  // ---------------- tappa 4 (§4.5)
  righello:     [[11.66, 11.80, 0, 1]],
  parentesi:    [[11.80, 11.95, 0, 1, 'expo.out']],   // sfalsamento per parentesi: VALLE.sfalsamentoParentesi
  idroHud:      [[11.70, 11.76, 0, 1]],
  saltoHud:     [[12.05, 12.80, 0, 700]],
  condottaEmissione: [[12.05, 12.80, 1.4, 2.4]],
  rectInt:      [[12.65, 12.80, 0, 8], [13.35, 13.35, null, 0], [13.70, 13.80, 0, 8], [14.20, 14.20, null, 0], [14.35, 14.45, 0, 8], [14.75, 15.00, 8, 0] /* [ARCH] */],
  rectSala:     [[13.35, 13.35, null, 1], [14.20, 14.20, null, 2]],
  getti:        [[13.02, 13.10, 0, 1]],
  lame:         [[13.08, 13.14, 0, 1]],
  spruzzi:      [[13.12, 13.12, null, 1]],
  tempoScalaEsp: [[13.00, 13.00, null, -3], [13.08, 13.26, -3, -0.903, 'power2.in'], [15.50, 15.50, null, 0]],
  YF:           [[13.80, 13.90, 10, 2.0, P2IO]],
  apertura:     [[13.92, 14.10, 0, 1, P2IO]],
  passoKaplan:  [[14.45, 14.70, -8, 15, P2IO]],
  aperturaKaplan: [[14.45, 14.70, 0.3, 1, P2IO]],
  oscura:       [[14.80, 15.00, 0, 0.85]],
  diagramma:    [[14.85, 15.00, 0, 1]],
  campi:        [[14.95, 15.05, 0, 1]],
  giranti:      [[14.95, 15.10, 0, 1, 'power4.out']],
  colonne:      [[14.98, 15.12, 0, 1, 'expo.out']],   // sfalsate di 0,03 (Pelton → Francis → Kaplan)
  retta10:      [[15.10, 15.20, 0, 1]],
  puntiLavoro:  [[15.18, 15.22, 0, 1, 'expo.out']],
  // transizione 4 → 5, la linea d'oro (§4.5)
  lineaOroAlfa:   [[15.38, 15.38, null, 1], [15.58, 15.64, 1, 0]],
  lineaOroStende: [[15.40, 15.48, 0, 1]],
  lineaOroPiega:  [[15.50, 15.58, 0, 1]],

  // ---------------- tappa 5 (§4.6) — stato all'arrivo con set reversibili a 15,50
  uModo:        [[15.50, 15.50, null, 1]],
  comparsaPali:   [[15.50, 15.50, null, -0.1], [15.80, 16.05, -0.1, 1.1]],
  comparsaTubi:   [[15.50, 15.50, null, -0.1], [15.95, 16.15, -0.1, 1.1]],
  comparsaModuli: [[15.50, 15.50, null, -0.1], [16.05, 16.40, -0.1, 1.1]],
  cabine:       [[15.50, 15.50, null, 0], [16.30, 16.36, 0, 1, 'power4.out']],
  cavoProgetto: [[15.50, 15.50, null, 1], [16.45, 16.45, null, 0]],
  cavoScavo:    [[16.35, 16.45, 0, 1], [16.45, 16.45, null, 0]],
  gantt:        [[15.62, 16.50, 0, 1]],
  archi:        [[15.64, 15.74, 0, 1, 'expo.out']],
  picchetti:    [[15.66, 15.76, 0, 1]],
  recinzione:   [[15.72, 15.84, 0, 1]],
  uCantiere:    [[15.72, 15.84, 0, 1]],
  uFronte:      [[16.45, 16.55, 0, 80], [16.56, 16.56, null, -1] /* [ARCH] */],
  trackerManuale:       [[15.50, 15.50, null, 1], [16.55, 16.55, null, 0]],
  trackerAngoloManuale: [[16.46, 16.55, 0, 38.6, P2IO]],
  uNuvole:      [[15.58, 15.66, 0, 0.25], [16.46, 16.54, 0.25, 0]],
  uNuvoleVel:   [[15.62, 15.62, null, 20], [16.50, 16.50, null, 1]],
  piastra:      [[16.82, 17.00, 0, 1, 'expo.out']],
  statoFile:    [[16.84, 16.95, 0, 1], [17.42, 17.50, 1, 0] /* [ARCH] */],
  stringa14B:   [[16.86, 16.86, null, 1], [17.40, 17.40, null, 0]],
  termica:      [[16.90, 17.00, 0, 1], [17.42, 17.50, 1, 0] /* [ARCH] */],

  // ---------------- tappa 6 (§4.7)
  uRitraccia:   [[18.00, 18.40, -1, 320]],
  petali:       [[18.30, 18.52, 0, 1]],      // coppie: tratto in 0,04 T, sfalsate di 0,025 T (ui/finale.js)
};

// =============================================================================
// BATTUTE — testi HTML (§4.1–4.7). Il contenuto sta in index.html: <article class="battuta" data-battuta="1a">.
// in / out = T di inizio ingresso / inizio uscita. in:null = visibile dalla fine dell'intro; out:null = resta fino alle sezioni.
// =============================================================================
export const TESTI_REGIA = { ingresso: 0.08, uscita: 0.05, sfalsamentoRighe: 0.012, decodificaMs: 300, uscitaY: -16, ingressoY: 12,
                             alfabetoDecodifica: '0123456789·—/ABCDEFGHIJKLMNOPQRSTUVWXYZ', riduciMs: 200 };
export const BATTUTE = [
  { id: '0',  tappa: 0, in: null,  out: 0.55 },
  { id: '1a', tappa: 1, in: 2.50,  out: 3.30, spunte: [2.63, 2.75, 2.87, 2.99, 3.11], areaIdonea: 3.20 },
  { id: '1b', tappa: 1, in: 3.62,  out: 4.18 },
  { id: '1c', tappa: 1, in: 4.48,  out: 5.02 },
  { id: '2a', tappa: 2, in: 5.30,  out: 6.00, binari: [5.30, 5.90], titolo: [7.00, 7.10] },
  { id: '2b', tappa: 2, in: 6.28,  out: 6.85, passi: [6.30, 6.45, 6.60], gse: [6.50, 6.70] },
  { id: '2c', tappa: 2, in: 7.08,  out: 7.46, grande: true },
  { id: '3a', tappa: 3, in: 8.16,  out: 8.72 },
  { id: '3b', tappa: 3, in: 9.20,  out: 10.02 },
  { id: '3c', tappa: 3, in: 10.78, out: 11.32 },
  { id: '4a', tappa: 4, in: 11.72, out: 12.20 },
  { id: '4b', tappa: 4, in: 12.70, out: 13.32 },
  { id: '4c', tappa: 4, in: 13.84, out: 14.18 },
  { id: '4d', tappa: 4, in: 14.44, out: 14.78 },
  { id: '4e', tappa: 4, in: 15.04, out: 15.40 },
  { id: '5a', tappa: 5, in: 15.70, out: 16.52 },
  { id: '5b', tappa: 5, in: 16.86, out: 17.42 },
  { id: '6',  tappa: 6, in: 18.34, out: null, grande: true },
];

// =============================================================================
// ETICHETTE 3D (§2.7, §5.6, tabelle "Etichette 3D" di §4)
// ancora: [x,y,z] assoluto | {x, z, h} = altezza(x,z) + h (solo PIANURA) | 'nome' = ancora registrata da un modulo
//         con ctx.ancore.set(nome, Vector3 | () => Vector3); 'riserva' = coordinate se il nome non è registrato.
// colore: chiave di PALETTE. tipo 'piastra' = elemento HTML ancorato (selettore).
// =============================================================================
export const ETICHETTE = [
  // tappa 1
  { t0: 3.20, t1: 3.52, nome: 'Area idonea', dato: 'pendenza < 5 % · nessun vincolo', ancora: [21.7, 1.4, 5.4], colore: 'smeraldo' },
  { t0: 3.22, t1: 3.52, nome: 'Fascia di rispetto fluviale', dato: '150 m dalle sponde', ancora: { x: -53.0 /* fiumeX(−20)+12 */, z: -20, h: 0 }, colore: 'acqua' },
  { t0: 3.24, t1: 3.52, nome: 'Vincolo paesaggistico', dato: 'D.Lgs. 42/2004', ancora: { x: -112, z: 18, h: 0.5 }, colore: 'vincolo' },
  { t0: 3.60, t1: 4.15, nome: 'Fg. 27 · P.lle 112–118', dato: '14,00 ha · 3 proprietari', ancora: [21.7, 2.2, 5.4], colore: 'oro' },
  { t0: 3.66, t1: 4.15, nome: 'Sopralluogo', dato: 'accesso dalla strada poderale', ancora: { x: 33.4, z: -5.5, h: 0.3 }, colore: 'oro' },
  { t0: 3.70, t1: 4.15, nome: 'P.lle 117–118', dato: 'in trattativa', datoDopo: { T: 4.00, testo: 'diritto firmato' }, ancora: [25.1, 1.8, 15.9], colore: 'oro' },
  { t0: 4.60, t1: 4.95, nome: 'Primo layout', dato: '10,4 MWp · 308 tracker · pitch 6,0 m · GCR 0,40', ancora: [21.7, 1.6, 5.4], colore: 'oro' },
  { t0: 4.66, t1: 4.95, nome: 'Punto di connessione', dato: 'cabina di consegna MT', ancora: { x: 40.5, z: -12.5, h: 0.4 }, colore: 'oro' },
  // tappa 2 (2c senza etichette: il sigillo è il messaggio)
  { t0: 6.30, t1: 6.85, nome: 'Cabina primaria AT/MT', dato: 'punto di connessione alla rete', ancora: { x: 128, z: -56, h: 1.2 }, colore: 'oro' },
  { t0: 6.34, t1: 6.85, nome: 'Cavidotto MT interrato', dato: '≈1,2 km lungo la viabilità esistente', ancora: { x: 84, z: -35, h: 0.3 }, colore: 'oro' },
  // tappa 3 · vista esplosa (ancore registrate da impianti/tracker.js; riserva = centro dell'eroe)
  { t0: 8.16, t1: 8.32, nome: 'Palo infisso', dato: 'acciaio zincato · profilo H', ancora: 'eroe.palo', riserva: [20.2, 1.31, 10.64], colore: 'oro' },
  { t0: 8.22, t1: 8.40, nome: 'Tubo di torsione', dato: 'asse nord–sud', ancora: 'eroe.tubo', riserva: [20.2, 1.36, 10.79], colore: 'oro' },
  { t0: 8.30, t1: 8.46, nome: 'Cuscinetto', dato: 'rotazione ±60°', ancora: 'eroe.cuscinetto', riserva: [20.2, 1.36, 9.84], colore: 'oro' },
  { t0: 8.38, t1: 8.54, nome: 'Ralla e motoriduttore', dato: 'un motore per tracker', ancora: 'eroe.motoriduttore', riserva: [20.2, 1.34, 10.64], colore: 'oro' },
  { t0: 8.46, t1: 8.62, nome: 'Controllore', dato: 'inclinometro e backtracking', ancora: 'eroe.controllore', riserva: [20.21, 1.30, 10.64], colore: 'oro' },
  { t0: 8.52, t1: 8.70, nome: 'Modulo bifacciale vetro-vetro', dato: '650 Wp · 144 mezze celle', ancora: 'eroe.modulo', riserva: [20.2, 1.38, 10.70], colore: 'oro' },
  // tappa 3c (ancore registrate da impianti/agri.js)
  { t0: 10.74, t1: 11.30, nome: 'Asse dei tracker', dato: '4,50 m', ancora: 'agri.quota1', riserva: [85.28, 1.03, 33], colore: 'oro' },
  { t0: 10.76, t1: 11.30, nome: 'Bordo inferiore', dato: '≈3,5 m anche a 60°', ancora: 'agri.quota2', riserva: [85.28, 0.97, 33], colore: 'oro' },
  { t0: 10.80, t1: 11.30, nome: 'Mezzo agricolo', dato: 'ingombro 2,9 m', ancora: 'agri.trattore', riserva: [84.95, 1.09, 36], colore: 'oro' },
  // tappa 4 (VALLE: niente test di occlusione)
  { t0: 11.82, t1: 12.10, nome: 'Pelton', dato: 'salto 700 m', ancora: [-100, 53, 0], colore: 'oro' },
  { t0: 11.86, t1: 12.10, nome: 'Francis', dato: 'salto 150 m', ancora: [-46, 9.5, 0], colore: 'oro' },
  { t0: 11.90, t1: 12.10, nome: 'Kaplan', dato: 'salto 12 m', ancora: [104, 0.6, 0], colore: 'oro' },
  { t0: 12.82, t1: 13.30, nome: 'Getto ≈115 m/s', dato: 'Ø 9,4 cm · tangente alla circonferenza primitiva', ancora: [-92.15, 17.916, -0.4], colore: 'acqua' },
  { t0: 12.86, t1: 13.30, nome: 'Cucchiaio doppio', dato: 'la cresta divide il getto in due lame', ancora: 'pelton.cucchiaio', riserva: [-92.0, 17.92, -0.4], colore: 'oro' },
  { t0: 12.90, t1: 13.30, nome: 'Spina e deviatore', dato: 'regolano e deviano il getto', ancora: [-92.27, 17.916, -0.4], colore: 'oro' },
  { t0: 13.84, t1: 14.15, nome: 'Chiocciola', dato: 'sezione decrescente, velocità costante', ancora: 'francis.chiocciola', riserva: [-33.0, 2.0, -0.6], colore: 'oro' },
  { t0: 13.88, t1: 14.15, nome: 'Distributore', dato: '20 pale direttrici regolabili', ancora: 'francis.distributore', riserva: [-33.1, 2.0, -0.8], colore: 'oro' },
  { t0: 13.92, t1: 14.15, nome: 'Girante', dato: 'ingresso radiale · uscita assiale', ancora: 'francis.girante', riserva: [-33.0, 2.05, -0.8], colore: 'oro' },
  { t0: 14.44, t1: 14.75, nome: 'Pale orientabili', dato: '5 pale a passo variabile', ancora: 'kaplan.pala', riserva: [112.2, -0.4, -1.2], colore: 'oro' },
  { t0: 14.48, t1: 14.75, nome: 'Distributore', dato: '24 pale · doppia regolazione', ancora: 'kaplan.distributore', riserva: [112.36, -0.3, -1.2], colore: 'oro' },
  { t0: 14.52, t1: 14.75, nome: 'Tubo di aspirazione', dato: 'recupera energia allo scarico', ancora: 'kaplan.aspirazione', riserva: [112, -1.2, -1.2], colore: 'oro' },
  { t0: 15.12, t1: 15.38, nome: 'Pelton', dato: '700 m · 1,6 m³/s', ancora: 'diagramma.pelton', riserva: [-29.9, 53.78, 60], colore: 'oro' },
  { t0: 15.15, t1: 15.38, nome: 'Francis', dato: '150 m · 7,5 m³/s', ancora: 'diagramma.francis', riserva: [-13.12, 41.60, 60], colore: 'oro' },
  { t0: 15.18, t1: 15.38, nome: 'Kaplan', dato: '12 m · 95 m³/s', ancora: 'diagramma.kaplan', riserva: [14.44, 21.64, 60], colore: 'oro' },
  // tappa 5
  { t0: 16.82, t1: 17.42, tipo: 'piastra', elemento: '#piastra-dati', ancora: [24, 7.2, 2], colore: 'oro' },
  { t0: 16.88, t1: 17.42, nome: 'Stringa 14-B', dato: 'intervento programmato', ancora: [10.0, 1.6, 2.12], colore: 'ambra' },
  { t0: 16.92, t1: 17.42, nome: 'Capannone aziendale', dato: 'studio di efficientamento energetico', ancora: [-12, 1.9, -18], colore: 'oro' },
  // tappa 6
  { t0: 18.32, t1: 19.00, nome: 'Fotovoltaico', dato: '10,4 MWp', ancora: [21.7, 1.8, 5.4], colore: 'oro' },
  { t0: 18.35, t1: 19.00, nome: 'Agrivoltaico', dato: '2,4 MWp', ancora: [86, 1.6, 32.5], colore: 'oro' },
  { t0: 18.38, t1: 19.00, nome: 'Idroelettrico', dato: 'Kaplan ad acqua fluente', ancora: [-77.5, 0.9, -100], colore: 'oro' },
];
export const ETICHETTE_REGOLE = {
  ingresso: 0.03, uscita: 0.03, max: 3,
  area: { x: [0.40, 0.92], y: [0.10, 0.85] }, sopraPx: 24,
  gomito: { puntoPx: 5, verticalePx: 24, orizzontalePx: 32 },
  svanimentoMs: 250, smorzamento: 20, passiOcclusione: 24,
};

// =============================================================================
// HUD (§5.5, §4.4, §4.5, §4.6)
// =============================================================================
export const HUD = {
  frequenzaHz: 15, distanzaBordoPx: 22,
  bandierina: 'DATI ILLUSTRATIVI',
  scaleBarraM: [10, 20, 50, 100, 200, 500, 1000, 2000], scalaBarraPx: 120,
  scalaApertura: { T: [0.15, 1.55], testo: ['1:10 000', '1:2 000'] },
  strumenti: [                       // strumento di tappa per intervallo di T
    { tipo: 'maturita', T: [0, 7.60] },
    { tipo: 'rtb', T: [7.60, 9.15] },   // la maturità si chiude in "● RTB" (7,60)
    { tipo: 'solare', T: [9.15, 11.45] },
    { tipo: 'idro', T: [11.70, 15.50] },
    { tipo: 'gantt', T: [15.50, 17.50] },
  ],
  maturita: { larghezzaPx: 220, tacche: [['Territorio', 5], ['Screening', 20], ['Proprietari', 35], ['Layout', 45], ['Iter', 65], ['Connessione', 85], ['RTB', 100]],
              titolo: 'MATURITÀ DEL PROGETTO', completo: 'READY TO BUILD', lampoT: 0.02, lampo: 4 },
  solare: { formato: 'ORA {ora} · ELEVAZIONE {el}° · AZIMUT {az}° · TRACKER {theta}° · {stato}',
            avvisi: [{ T: [9.93, 10.10], testo: '13:11 · MEZZOGIORNO SOLARE · ELEVAZIONE 71,4°' }],
            spaccato: { file: 3, larghezzaM: 2.4, passoM: 6 }, ombraGrigio: 0.4 },
  idro: { salto: { min: 0, max: 900, px: 140 }, portata: { min: 0.1, max: 1000, px: 220, log: true }, potenza: 'POTENZA ≈10 MW',
          tempo: { T: [12.70, 14.78], testo: 'TEMPO ×1/1000 → ×1/8' },
          legenda: ['altezza = salto', 'linee ∝ portata', 'velocità ∝ √(2gH)'],
          preparazione: 'PREPARAZIONE DELLA VALLE · {p} %' },
  gantt: { mesi: 9, fasi: [{ nome: 'Budget', T: [15.62, 15.62] }, { nome: 'Fornitori', T: [15.66, 15.66] }, { nome: 'Contratti', T: [15.70, 15.70] },
                            { nome: 'Montaggio', T: [15.76, 16.40] }, { nome: 'Collaudo', T: [16.42, 16.52] }],
           fine: 'SIMULAZIONE · 21 GIUGNO · 16:00' },
};

// Piastra dati 5b (§4.6) e produzione (App. A) — "simulazione"
export const PRODUZIONE = {
  potenzaOraMW: 8.6, energiaOggiMWh: 75.4, disponibilita: 99.4,
  dicitura: 'simulazione · giornata serena del 21 giugno',
  curva: { da: 5.5, a: 16.0, fine: 20.83, tetto: 9.0 /* MWac */, dcMWp: 10.37, perdite: 0.14,
           giornoTrackerMWh: 101, giornoFissoMWh: 72.8, rapporto: 1.39, tagliataDa: 10.5, tagliataA: 15.0 },
};

// =============================================================================
// §5.2 INTRO
// =============================================================================
export const INTRO = {
  logo: { x: '50%', y: '40%', larghezza: 'min(340px, 42vw)', viewBox: [812, 720], centroVentaglio: [405, 388],
          punte: [[74, 261], [135, 155], [229, 77], [343, 35], [466, 35], [581, 77]] },
  linea: { y: '58%', punta: 6 },
  coppiaPetaliMs: 500, petaliRiempimentoMs: 600, petaliSfalsamentoMs: 60, foglieMs: 400, scritteMs: 500, scritteScala: 1.02, pausaMs: 700,
  flipMs: 1000, consegnaMs: 200, lineaAllungaMs: 300, morphMs: 900, fondoRitardoMs: 600, lineaSvanisceMs: 400,
  titoloRitardoMs: 300, titoloMs: 1100, titoloSfalsamentoS: 0.08, leadMs: 800,
  saltoMs: 300, secondaVisitaMs: 1200, chiaveSessione: 'eri-intro',
  riduci: { dissolvenzaMs: 300, pausaMs: 500, uscitaMs: 300 },
  fiume: { punti: 64, z: [-400, 400] },
  testata: { viewBox: '0 20 812 440', altezzaPx: 40 },
};
export const LINEA_ORO = { punti: 64, sy: 0.58 };

// Petali del finale (§4.7): coppie disegnate in 0,04 T, sfalsate di 0,025 T da sinistra a destra
export const PETALI = { tratto: 0.04, sfalsamento: 0.025, raggioPunte: 0.11 /* × innerHeight */, centroVentaglio: [405, 388] };

// §5.4 indice e §4.7 dopo la storia
export const INDICE = { durata: 2.2, salta: 'Salta ai servizi ↓', lineaPx: [18, 36], nascostoSotto: 900 };
export const DOPO_STORIA = { veloChiSiamo: 0.75, finestra: ['top bottom', 'top 30%'] };

// §5.8 servizi: colonna → keyframe di camera al passaggio del mouse (§4.7)
export const SERVIZI_CAMERA = { sviluppo: 'K1.3', autorizzazione: 'K2.0', costruzione: 'K5.1', esercizio: 'K5.2' };

// §5.7 micro-interazioni
export const INTERAZIONI = {
  cursore: { anello: 6, ritardo: 28, lambda: 12, link: 44, lettura: 30 /* Hz */, passoRay: 0.5 },
  magnetico: { raggio: 90, max: 8, parallasse: 0.6, durata: 0.4, uscita: 0.6 },
  contatori: { durata: 0.8 },
  hoverTappe: [2.0, 5.0],          // tappa 1: uHover sulle particelle
};

// Dati dei contatti (§5.8) — recapiti di esempio
export const CONTATTI = {
  recapiti: [['Informazioni', 'info@eri-esempio.it'], ['Progetti e investitori', 'progetti@eri-esempio.it'],
             ['Proprietari terrieri', 'terreni@eri-esempio.it'], ['Telefono', '+39 000 000 0000'], ['Sede', '[indirizzo da inserire]']],
  profili: ['Investitore', 'IPP', 'Proprietario terriero', 'Altro'],
  messaggioInvio: 'Versione di prova: il modulo non invia ancora i dati.',
};

// Soste per il debug (← →) e per il warm-up (§6.9)
export const WARMUP = {
  pianura: [1.8, 8.4, 10.0, 10.70, 18.6],   // K0.1, K3.1 (GTAO), K3.5, K3.7, K6.0
  valle: [11.8, 13.15, 14.0],               // V4.0, V4.4 (GTAO + luci rettangolari), V4.6
};
