// =============================================================================
// ERI v2 · impianti/cantiere.js — cantiere della tappa 5 (oggetti 3D): picchetti, recinzione, battipali
// Proprietario: [FINALE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §4.6 (eventi: picchetti, recinzione, battipali che seguono il fronte di comparsaPali), §3.5 (pali ogni 0,8 u: campo pali di ctx.dati.layout), config.LAYOUT.recinzione, config.LAYOUT.bandingCantiere.
//
// Da implementare:
//  - picchetti: Points oro alle posizioni dei pali (ctx.dati.layout.fv.tracker[].pali), STATO.picchetti; si spengono dove il palo è già infisso (stessa soglia di comparsaPali e aOrdine).
//  - recinzione: pali ogni 3 m sul contorno del sito rientrato di 0,5 u più il filo (STATO.recinzione).
//  - due battipali (box grafite 0,6 × 0,25 × 0,25 u con antenna 0,9 u) che seguono il fronte dell'onda di montaggio (STATO.comparsaPali, ordine).
//  - tutto visibile solo in tappa 5–6 (T ≥ 15,50).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): pubblica ctx.dati.cantiere = { picchetti, recinzione, battipali }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
