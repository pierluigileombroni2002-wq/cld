// =============================================================================
// ERI v2 · idro/valle.js — VALLE: plastico in sezione, faccia di taglio, laghi, edifici, condotte, righello, piani di taglio, luci
// Proprietario: [VALLE]. Stato: STUB di [ARCH]: nessuna implementazione, solo le firme concordate.
// Specifica: DESIGN §3.6 (tutto: fondoValle/hValle in geo.js, dimensioni, peli liberi, righello, parentesi, tabella elementi, piani di taglio), §2.6 (calcestruzzo, sezione), §6.7 (sezioni senza stencil: retro-facce campite), §6.4 (luci della valle), §4.5 (righello, parentesi, condottaEmissione, rectInt/rectSala, YF, oscura), config.VALLE.
//
// Da implementare:
//  - plastico PlaneGeometry(460,60,460,60) con hValle (geo.js), materiale del terreno con isoipse ogni 5 u / 25 u e STATO.oscura; piano d'appoggio grafite 2000².
//  - faccia di taglio ShapeGeometry a z = +0,001 con i fori di Francis e Kaplan; sezioni d'acqua al 22 %; superfici dei laghi (MeshPhysicalMaterial §2.6, normal map da texturaNormaleAcqua() se disponibile).
//  - presa, condotta forzata Pelton (blocchi di ancoraggio), centrali Pelton/Francis/Kaplan (edifici tagliati), diga ad arco, condotta Francis, traversa Kaplan.
//  - righello 0–900 m e parentesi dei salti (STATO.righello, STATO.parentesi + VALLE.sfalsamentoParentesi), testi su CanvasTexture.
//  - piani di taglio THREE.Plane Z0, ZP, YF, ZK creati QUI e assegnati alla creazione dei materiali (anche delle macchine); YF.constant = STATO.YF a ogni fotogramma.
//  - luci della valle: 2 RectAreaLight (config.VALLE.luci.rect, spostate tra le sale quando sono a 0: STATO.rectSala) + 1 SpotLight di controluce, intensità da STATO.rectInt. Numero di luci costante.
//  - patchSezione(materiale): campitura della sezione dopo dithering_fragment (if (!gl_FrontFacing) ...), tratteggio oro 45° in px × uPx.
//
// Contratto (vincolante, vedi ARCHITETTURA.md):
//  crea(ctx) (primo dei moduli VALLE; gira in idle dopo il primo fotogramma, vedi main.js):
//     pubblica ctx.dati.valle = { piani:{Z0, ZP, YF, ZK}, patchSezione(materiale), materiali:{calcestruzzo, inox, casse, sezione}, luci:{rect:[a,b], spot} }.
//     aggiunge tutto a ctx.scene.valle.
//  aggiorna(ctx, T, t, dt).
// Regole comuni: materiali con nuovoMateriale() di luce/nebbia.js; tutti gli oggetti creati in crea() (mai dopo);
// animazioni di scroll come funzioni pure di T/STATO; niente allocazioni in aggiorna(); commenti in italiano.
// =============================================================================
export const MONDO = 'valle';

/** Costruzione (una volta). */
export async function crea(ctx) {}

/** Ogni fotogramma (solo se il mondo del modulo è attivo; i moduli 'ui' sempre). */
export function aggiorna(ctx, T, t, dt) {}
