// =============================================================================
// ERI v2 · mondo/catasto.js — catasto, vincoli, maschere (texture dati) e overlay 3D di sviluppo
// Proprietario: [PIANURA]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.2 (griglia, particelle, tStati), §3.3 (vincoli → tVincoli, tMaschere.B), §3.4 (maschere R/G/B/A), §2.7 (fogli, tende, lunetta, layout), §4.1–4.3 (eventi: fogliGIS, lunetta, tende, percorso, uLayout, sigillo, polvere), config.PIANURA, config.OVERLAY, config.LAYOUT.
//
// Da implementare:
//  - tStati: DataTexture 48×48 RGBA8 NearestFilter (R bit di stato, G id particella, B proprietario×64, A copertura vincoli); particelle generiche con mulberry32(27) (geo.js).
//  - tVincoli: DataTexture 1024² RGBA8 lineare (R paesaggistico, G fluviale, B PAI, A archeologico) rasterizzata sulla CPU con le forme esatte di §3.3.
//  - tMaschere: canvas 2048² → CanvasTexture NoColorSpace (R campi arati, G strade, B bosco/Natura 2000, A piazzali).
//  - aree idonee (vincoli < 5 %, pendenza < 0,05 su 9 campioni, fuori da strade/fiume/bosco).
//  - oggetti 3D (tutti creati qui, nascosti finché STATO li accende): 5 fogli GIS (STATO.fogliGIS[i].y/.o, lampo × 1,5 all'impatto), lunetta di 60 tacche (STATO.lunetta, STATO.maturita), tende di luce (STATO.tende, pulsazione di C, uTrattativaFirmata), percorso del sopralluogo (STATO.percorso, STATO.percorsoAlfa), layout proposto/approvato con LineSegments2 (STATO.uLayout, STATO.uLayoutApprovato; plotter ordinato per distanza dal punto di connessione), sigillo READY TO BUILD (STATO.sigillo, STATO.sigilloAlfa), polvere (STATO.polvere).
//  - userData.noAO = true su fogli, tende, sigillo e LineSegments2.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): pubblica ctx.dati.catasto = { tStati, tVincoli, tMaschere, particellaDi(x, z) → {foglio, id, ha, idonea, proprietario, stato} | null }.
//             (crea() del catasto gira PRIMA di terreno.js: ORDINE.pianura in main.js.)
//             layout dei tracker: ctx.dati.layout.fv / .agri (geo.calcolaLayout, già pronto).
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'pianura';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
