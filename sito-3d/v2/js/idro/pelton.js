// =============================================================================
// ERI v2 · idro/pelton.js — turbina Pelton procedurale (girante, cucchiai, ugelli, carter, generatore)
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.6 (posizioni), §6.7 Pelton (disco, 22 cucchiai con cresta e intaglio, ugelli con spina e deviatore, carter tagliato da ZP), §2.6 inox (MAI oro né bronzo), §4.5 (tempoScala, velocità della girante limitata), App. B, config.VALLE.girantePelton, config.IDRO.pelton.
//
// Da implementare:
//  - geometrie in metri dentro un gruppo × 0,1; unire per materiale; cucchiai istanziati sulla circonferenza primitiva Ø 1,68 m, rotazione antioraria vista da +z.
//  - spina degli ugelli animata (regolazione), deviatore; carter semicilindrico tagliato da ctx.dati.valle.piani.ZP; albero lungo z e generatore.
//  - rotazione: ω = min(ωreale × tempoScala, 0,45·(2π/22)·fps) usando ctx.U.uTempoIdro / STATO.tempoScala.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra l'ancora 'pelton.cucchiaio' (cucchiaio in basso, sul punto d'impatto);
//             pubblica ctx.dati.pelton = { gruppo, girante } (la girante si clona nel diagramma 4e).
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
