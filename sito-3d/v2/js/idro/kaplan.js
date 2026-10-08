// =============================================================================
// ERI v2 · idro/kaplan.js — turbina Kaplan procedurale (mozzo, pale orientabili, distributore, aspirazione)
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.6 (centro, Ø 4,5 m, semi-chiocciola tagliata da ZK), §6.7 Kaplan (5 pale ParametricGeometry su perni, 24 pale direttrici, anello, cono), §4.5 (passoKaplan, aperturaKaplan: doppia regolazione), config.VALLE.giranteKaplan.
//
// Da implementare:
//  - pale in gruppi-perno sull'asse radiale, passo = STATO.passoKaplan (gradi); 24 direttrici a raggio 3,6 m con apertura STATO.aperturaKaplan.
//  - semi-chiocciola in calcestruzzo tagliata da ctx.dati.valle.piani.ZK; cono di aspirazione fino a y = −1,6.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'kaplan.pala', 'kaplan.distributore', 'kaplan.aspirazione';
//             pubblica ctx.dati.kaplan = { gruppo, girante }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
