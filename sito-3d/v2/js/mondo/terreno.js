// =============================================================================
// ERI v2 · mondo/terreno.js — terreno della PIANURA: mesh, anello di bordo, shader (splat PBR + overlay d'oro)
// Proprietario: [PIANURA]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.1 (geometria, quote, aAltezza, anello), §6.5 (shader: splat, carta/realtà, fronte, overlay, sottrazione, nuvole), §2.6 terreno, §2.7 overlay, §4.1–4.7 (uniform u* in STATO), config.PIANURA, config.OVERLAY, config.MATERIALI.terreno.
//
// Da implementare:
//  - PlaneGeometry(360,360,S,S).rotateX(−π/2), S = ctx.qualita.Q.terreno; quote con altezza() di geo.js; attributo aAltezza; computeVertexNormals().
//  - anello di bordo 180 → 1500 u (64×128), stesso materiale senza overlay, svanisce nella nebbia.
//  - MeshStandardMaterial via nuovoMateriale + aggiungiPatch: splat erba-roccia/campo (texture da ctx.carica.texture), noTile, roccia per pendenza, strade/bosco/piazzali da tMaschere.
//  - overlay in totalEmissiveRadiance con fwidth e uPx: isoipse (uIso), confini catastali (uGriglia, tStati.G), stati (uIdonee, uSito, uTrattativaFirmata, uHover), vincoli (uV[0..4], tVincoli, tMaschere.B), fiume carta (uFiumeMappa), onde (uOndaRame, uRitraccia, uFronte), uLayout/uLayoutApprovato se disegnati nel terreno.
//  - carta/realtà: uRealta e fronte uFronteRealta da SITO_C (bordo oro × 3); sottrazione (uSottrazione); nuvole (uNuvole, uNuvoleVel); uCantiere (piazzali di cantiere, tappa 5).
//  - sollevamento radiale uOnda (lift) nel vertice + customDepthMaterial con la STESSA patch; chunk SOLLEVAMENTO_GLSL esportato per alberi/fiume/cabine.
//  - tutte le uniform si collegano PER RIFERIMENTO a ctx.U (sh.uniforms.uOnda = ctx.U.uOnda, ...).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  export { altezza } da ../geo.js (riesportata, NON ridefinita).
//  export const SOLLEVAMENTO_GLSL: string — funzione GLSL lift(vec2 xz) condivisa (uniform uOnda, uSitoC).
//  crea(ctx): legge ctx.dati.catasto (tStati, tVincoli, tMaschere; se assenti usa texture neutre 1×1);
//             pubblica ctx.dati.terreno = { mesh, anello, materiale }.
//  aggiorna(ctx, T, t, dt): solo ciò che non è già una uniform condivisa.
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export { altezza } from '../geo.js';
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}

/** Chunk GLSL del sollevamento radiale (§6.5): float lift = 1 − smoothstep(uOnda − 70, uOnda, distance(xz, uSitoC.xz)). */
export const SOLLEVAMENTO_GLSL = `
uniform float uOnda; uniform vec3 uSitoC;
float lift(vec2 xz){ return 1.0 - smoothstep(uOnda - 70.0, uOnda, distance(xz, uSitoC.xz)); }
`;
