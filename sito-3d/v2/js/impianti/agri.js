// =============================================================================
// ERI v2 · impianti/agri.js — agrivoltaico: colture sotto i tracker, quote 3D, sagoma tecnica del trattore
// Proprietario: [FV]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.5 (quote agrivoltaiche normative), §6.6 (colture: strisce istanziate, vento, alphaTest), §2.6 colture, §2.7 quote tecniche, §4.4 3c (quoteAgri, trattore, etichette), config.LAYOUT.agri, config.LAYOUT.colture, config.LAYOUT.trattore.
//
// Da implementare:
//  - colture: circa 7 600 strisce istanziate nelle particelle 41–44, escluse a 0,05 u dai pali; vento nel vertex shader (+ customDepthMaterial); livello Base: solo nel vicolo.
//  - tre quote 3D in oro alla fila 16 (x 85,28, z 33): asse 4,50 m, bordo inferiore 3,46 m, sagoma del trattore 2,90 m (STATO.quoteAgri, frecce a 30°).
//  - trattore: sagoma tecnica in linee oro LineSegments2 (scatola, ruote come cerchi, cabina) 4,5 × 2,4 × 2,9 m che avanza lungo x = 84,95 da z 24,0 a 39,5 (STATO.trattore). MAI un modello realistico.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'agri.quota1', 'agri.quota2', 'agri.trattore'; pubblica ctx.dati.agri = { colture, quote, trattore }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
