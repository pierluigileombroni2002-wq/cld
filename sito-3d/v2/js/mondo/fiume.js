// =============================================================================
// ERI v2 · mondo/fiume.js — fiume (nastro d'acqua), normal map procedurale dell'acqua, traversa
// Proprietario: [PIANURA]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.1 (fiumeX, acqua), §2.6 fiume e laghi, §6.7 "Acqua" (nastro lungo CatmullRomCurve3, normal map su canvas 512², schiuma), §3.4 traversa, §4.1 (STATO.fiume, uFiumeMappa).
//
// Da implementare:
//  - nastro BufferGeometry lungo fiumeX(z) largo 4,4 u alla quota acqua(z) (+0,4 u a monte della traversa), MeshPhysicalMaterial di §2.6, due campioni della normal map che scorrono.
//  - opacità del nastro da STATO.fiume; sollevamento lift() come il terreno (tappa 0).
//  - traversa con centrale ad acqua fluente (§3.4) con salto del pelo libero e fascia di schiuma.
//  - normal map dell'acqua generata su canvas (Sobel), condivisa con la VALLE.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  export function texturaNormaleAcqua(): THREE.Texture | null — memoizzata; la VALLE la usa per i laghi (deve tollerare null).
//  crea(ctx): pubblica ctx.dati.fiume = { mesh, normaleAcqua }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}

/** Normal map procedurale dell'acqua (canvas 512², RepeatWrapping, NoColorSpace). STUB: null. */
export function texturaNormaleAcqua() { return null; }
