// =============================================================================
// ERI v2 · idro/acqua.js — acqua della VALLE: getti Pelton, spruzzi, linee di corrente, colonne del diagramma
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §6.7 "Acqua" (getti CylinderGeometry additivi, spruzzi Points balistici × DPR, linee di corrente su DataTexture FloatType NearestFilter con interpolazione manuale, colonne del v1 migliorate, niente transmission), §4.5 (regola di lettura: N = max(2, round(Q/1,6)), v = 0,05·√(2gH); getti, lame, spruzzi, colonne), App. B, config.IDRO.
//
// Da implementare:
//  - getti A e B (STATO.getti = avanzamento del fronte), lame sulla cresta (STATO.lame), spruzzi (STATO.spruzzi) con t = ctx.U.uTempoIdro.
//  - linee di corrente: condotta Pelton (2, emissione STATO.condottaEmissione), Francis (5, ∝ STATO.apertura), fiume Kaplan (59).
//  - colonne d'acqua del diagramma a z = 64 (STATO.colonne, sfalsate di 0,03 T), raggio 0,55·√Q, altezza = y del punto di lavoro.
//  - userData.noAO = true su getti, spruzzi, linee e colonne; tutti fog:false o con nuovoMateriale.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): pubblica ctx.dati.acqua = { getti, spruzzi, linee, colonne }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
