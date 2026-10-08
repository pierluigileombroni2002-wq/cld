// =============================================================================
// ERI v2 · impianti/tracker.js — tracker FV e agrivoltaici istanziati, tracker eroe in vista esplosa, onda, cantiere
// Proprietario: [FV]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.5 (layout normativo: usare ctx.dati.layout da geo.calcolaLayout), §6.6 (pezzi, texture delle celle, InstancedMesh, patch del vertice rotZ/uComparsa/uModo, customDepthMaterial, eroe con mergeGeometries), §2.6 (vetro, retro, telaio, acciaio — MAI metallo_lamiera), §4.4 (eroe, esplosione, giraModulo, comparsaFV/Agri, ombre), §4.6 (uModo, comparsaPali/Tubi/Moduli, statoFile, stringa14B), App. A.
//
// Da implementare:
//  - un InstancedMesh per pezzo e per campo (FV, agri): moduli, telai, tubi, pali, cuscinetti; matrici solo traslazione + scala 0,1; rotazione nel vertex shader con U.uAngoloFV / U.uAngoloAgri (radianti, già calcolati da stato.js con angoloTracker).
//  - attributi d'istanza aChiave (onda tappa 3), aOrdine (montaggio tappa 5), aFila (stringa 14-B): dai campi chiave/ordine/fila di ctx.dati.layout.
//  - comparsa: uModo 0 → comparsaFV/comparsaAgri; uModo 1 → comparsaPali/Tubi/Moduli (STATO).
//  - tracker eroe = fila 31, tracker D del layout calcolato (z 7,347–13,867): non istanziato, pezzi con userData.offset, esplosione per pezzo power4.out (§4.4), modulo girato (STATO.giraModulo); le istanze dell'eroe a scala 0 finché STATO.eroe > 0.
//  - statoFile (emissivo smeraldo × 0,15 sui telai), stringa 14-B (fila 14, tracker B: telai ambra pulsanti × 1,5 a 0,8 Hz).
//  - livello Base: istanze FV a file alterne (ctx.qualita.Q.fileAlterne).
//  - dopo aver scritto le matrici: computeBoundingSphere() e radius += 0,15. Mai aggiornare matrici durante lo scroll.
//  - chiamare ctx.ombre.richiedi() quando cambiano angolo o comparsa.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'eroe.palo', 'eroe.tubo', 'eroe.cuscinetto', 'eroe.motoriduttore', 'eroe.controllore', 'eroe.modulo'
//             (funzioni che restituiscono la posizione mondo CORRENTE del pezzo, esplosione compresa);
//             pubblica ctx.dati.tracker = { fv:{...mesh per pezzo}, agri:{...}, eroe: THREE.Group, materiali:{fronte, retro, telaio, acciaio}, texturaCelle }.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
