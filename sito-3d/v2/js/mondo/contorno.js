// =============================================================================
// ERI v2 · mondo/contorno.js — contorno della PIANURA: alberi, ponte, cabine, cabina primaria, capannone, cavidotto MT
// Proprietario: [PIANURA]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.4 (luoghi, strade, impianti, alberi), §2.6 (alberi, calcestruzzo, asfalto), §2.7 (cavidotto: LineSegments2 rame × 2,6, impulsi), §4.2–4.3 (cavo, impulsi, luciCP), §4.6 (cabine, cavoProgetto, cavoScavo, termica del capannone), config.PIANURA.
//
// Da implementare:
//  - alberi InstancedMesh (bosco 1500, ripa 700, filare 50) con patch sollevamento + customDepthMaterial.
//  - ponte sulla SP, gruppo cabine al cancello (scala STATO.cabine), cabina primaria con trasformatori, portali, sbarre e luci calde (STATO.luciCP).
//  - capannone aziendale con scansione termica in scala oro (STATO.termica; niente falsi colori).
//  - cavidotto MT: LineSegments2 rame (STATO.cavo = disegno progressivo), impulsi oro chiaro a 6 u/s (STATO.impulsi), modo "di progetto" tratteggiato (STATO.cavoProgetto), trincea scura (STATO.cavoScavo).
//  - tutti gli oggetti seguono lift() in tappa 0 (§4.1).
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra ctx.ancore.set('cavo.polilinea', Vector3[]) (polilinea del cavidotto sul terreno, per LineaOro 4→5).
//             pubblica ctx.dati.contorno = { cabine, cp, capannone, cavo }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
