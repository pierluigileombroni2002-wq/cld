// =============================================================================
// ERI v2 · idro/francis.js — turbina Francis procedurale (girante, chiocciola, distributore, aspirazione)
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.6 (centro, D1, D2, chiocciola), §6.7 Francis (corona e fascia Lathe, 15 pale ParametricGeometry, chiocciola a sezione decrescente, 20 + 20 pale, tubo a gomito), §4.5 (YF, apertura), config.VALLE.giranteFrancis.
//
// Da implementare:
//  - chiocciola e involucri tagliati da ctx.dati.valle.piani.YF (e Z0), clipShadows, DoubleSide, campitura con ctx.dati.valle.patchSezione.
//  - 20 pale direttrici istanziate ruotate di STATO.apertura × 28° sul proprio perno.
//  - girante in rotazione con ctx.U.uTempoIdro.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'francis.chiocciola', 'francis.distributore', 'francis.girante';
//             pubblica ctx.dati.francis = { gruppo, girante }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
