// =============================================================================
// ERI v2 · idro/diagramma.js — diagramma salto-portata 4e (canvas, campi d'impiego, retta dei 10 MW, giranti in scala)
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §4.5 "Il diagramma 4e" (assi log, CanvasTexture 4096×2458, campi indicativi, retta 10 MW LineSegments2, punti di lavoro, giranti ×30), §5.7 (hover su una girante → campo acceso), config.IDRO.diagramma, geo.diagrammaXY.
//
// Da implementare:
//  - piano 100 × 60 u con origine (−60; 2; 60) (angolo in basso a sinistra), MeshBasicMaterial toneMapped:false trasparente (STATO.diagramma).
//  - campi d'impiego (STATO.campi), retta dei 10 MW con bagliore oro × 2,6 (STATO.retta10), punti di lavoro (STATO.puntiLavoro).
//  - giranti in scala relativa vera ×30 a z = 70 (cloni di ctx.dati.pelton/francis/kaplan.girante), STATO.giranti, rotazione ×1/8.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx): registra le ancore 'diagramma.pelton', 'diagramma.francis', 'diagramma.kaplan' (punti di lavoro)
//             e 'diagramma.retta10' = [Vector3 a, Vector3 b] (estremi della retta, per LineaOro 4→5).
//             Riserva se assenti: config.IDRO.diagramma.retta10Mondo.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
