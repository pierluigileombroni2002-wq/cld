# ERI · sito 3D · piano della versione 2 (alta qualità)

Stato: **preparato, non ancora eseguito.** Si parte dopo la conferma sull'eolico.

## Decisione aperta: l'eolico

- **A · Eolico fuori dalla scena 3D.** Resta solo nei testi dei servizi (micrositing, dati anemologici, wind turbine).
- **B · Eolico dentro.** Una tappa 3D dedicata al micrositing: posizioni candidate, rosa dei venti, flussi di vento.

Tutto il resto del piano vale in entrambi i casi.

## Struttura della pagina (tappe allo scroll)

| # | Tappa | Cosa si vede in 3D | Servizi collegati |
|---|-------|--------------------|-------------------|
| 0 | Apertura | Tramonto dorato. La mappa catastale si solleva e diventa terreno. | — |
| 1 | Sviluppo | Vincoli che si accendono, aree idonee, primo layout disegnato sul terreno, segnaposto sui terreni dei proprietari. | 1, 2, 5 |
| 2 | Autorizzazione e connessione | Linea di tappe PAS → AU → VIA. Il cavo si accende fino alla cabina primaria. | 8, iter |
| 3 | Fotovoltaico e agrivoltaico | Tracker in vista esplosa che si monta. Il sole si muove e le ombre lo seguono. Colture sotto i pannelli. | 6 |
| 4 | *(solo se B)* Eolico | Griglia di posizioni candidate, rosa dei venti, particelle di vento. | 3, 4, 6 |
| 5 | Idroelettrico | Diga e condotta. Kaplan, Francis e Pelton con acqua vera, poi in sezione. | — |
| 6 | Costruzione e gestione | Cantiere che si completa. Poi l'impianto con i dati di produzione sospesi sopra. | 9, 10, 11, 12, 13 |
| 7 | Finale | Vista d'insieme al tramonto, logo, invito al contatto. | 7 |

## Testi dei servizi (bozza)

**Sviluppo**
1. **Screening preliminare vincolistico.** Verifichiamo subito vincoli paesaggistici, ambientali, idrogeologici e archeologici. Sappiamo presto se un terreno è idoneo.
2. **Primo layout.** Disegniamo la prima disposizione dell'impianto: file, distanze, accessi, punto di connessione.
3. **Micrositing ed Energy Assessment.** Scegliamo la posizione esatta di ogni macchina e stimiamo la produzione attesa.
4. **Validazione dati anemologici.** Controlliamo e certifichiamo le misure del vento. Ne ricaviamo report solidi per enti e finanziatori.
5. **Sopralluoghi e proprietari.** Andiamo sul posto. Incontriamo i proprietari e costruiamo accordi chiari sui terreni.
6. **Ricerca tecnologica.** Confrontiamo moduli fotovoltaici e aerogeneratori per scegliere la tecnologia più adatta al sito.

**Autorizzazione e connessione**
- **Iter autorizzativo.** PAS, Autorizzazione Unica e VIA, fino al titolo.
- **Connessione e GSE (8).** Gestiamo i portali del gestore di rete e del GSE, dalla richiesta di connessione agli incentivi.

**Costruzione**
- **Budget e fornitori (9).** Prepariamo il budget di costruzione e individuiamo fornitori e subappaltatori.
- **Procurement e contratti (10).** Negoziamo gli acquisti e redigiamo i contratti.
- **Project management in cantiere (12).** Coordiniamo tempi, costi e qualità fino all'entrata in esercizio.

**Esercizio**
- **Asset management (11).** Seguiamo l'impianto nel tempo: produzione, manutenzione, rapporti contrattuali.
- **Efficientamento energetico (13).** Studiamo come ridurre consumi e costi energetici di aziende ed edifici.

**Trasversale**
- **Project Development Management (7).** Un unico referente che coordina tutto, dall'idea al cantiere.

## Tecnica

- Three.js r160. In più: `RGBELoader` per i cieli HDRI, `GLTFLoader` + `DRACOLoader` per i modelli.
- Post-produzione: GTAO (ombre di contatto), SMAA (bordi puliti), bloom leggero, profondità di campo solo nei primi piani.
- Ombre vere dal sole, morbide (PCFSoft), con mappa 4096 sui primi piani.
- Scroll morbido con **Lenis 1.1.13**, sincronizzato con GSAP ScrollTrigger.
- Camera su curve morbide (`CatmullRomCurve3`) invece di salti tra punti.
- Qualità adattiva: risoluzione fino a 2× (nitida su 4K). Si abbassa da sola se il PC rallenta.
- Tutte le librerie verificate sui CDN gratuiti (risposta 200).

## Dove mettere i modelli 3D

Cartella `sito-3d/asset/modelli/`, con questi nomi:

| File | Oggetto |
|------|---------|
| `tracker.glb` | Una fila di tracker con moduli FV (o un singolo tracker) |
| `kaplan.glb` | Girante Kaplan |
| `francis.glb` | Girante Francis |
| `pelton.glb` | Ruota Pelton |
| `eolico.glb` | Aerogeneratore (solo se B) |

Se un file manca, il sito usa la forma procedurale attuale. Si può partire anche senza modelli.

## Ordine di lavoro

1. Base tecnica: luci HDRI, ombre, materiali PBR, scroll morbido, camera su curve.
2. Terreno nuovo con texture reali e passaggio dalla mappa catastale al 3D.
3. Fotovoltaico e agrivoltaico (vista esplosa, sole, ombre).
4. Idroelettrico (acqua, sezioni delle turbine).
5. Costruzione e gestione, servizi, finale.
6. *(se B)* Eolico.
7. Prove di qualità e velocità, poi pubblicazione.
