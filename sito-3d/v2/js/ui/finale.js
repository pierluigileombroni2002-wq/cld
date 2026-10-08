// =============================================================================
// ERI v2 · ui/finale.js — interfaccia delle tappe 5–6: archi dei fornitori, piastra dati 5b, petali del logo
// Proprietario: [FINALE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §4.6 (archi fornitori SVG, piastra dati 5b con contatori e mini-curva), §4.7 (sole → petali: logo ufficiale in 2D, colori ufficiali, centro del ventaglio sul sole proiettato), §5.2 (classi .petalo del logo), config.PRODUZIONE, config.PETALI, App. A.
//
// Da implementare:
//  - archi dei fornitori: 3 archi SVG oro chiaro 1 px dai bordi del quadro al cancello proiettato (STATO.archi).
//  - piastra dati #piastra-dati: POTENZA ORA 8,6 MW · ENERGIA OGGI 75,4 MWh · DISPONIBILITÀ 99,4 %, contatori che partono da 0 (STATO.piastra), mini-curva del giorno (tracker oro pieno, fisso tratteggio grigio), dicitura "simulazione"; la posizione la gestisce ui/etichette.js (tipo 'piastra').
//  - petali: SVG #petali con i 12 tracciati dei petali del logo ufficiale (testo da ctx.carica.testo(config.ASSET.logo)), centro (405, 388) sul sole proiettato, raggio punte 0,11·innerHeight; per coppia tratto in 0,04 T poi riempimento con i colori ufficiali, sfalsate di 0,025 T (STATO.petali, T). Mai ricolorare né ruotare in 3D.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx).
//  aggiorna(ctx, T, t, dt): proiezioni con ctx.proietta(vettore).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'ui';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
