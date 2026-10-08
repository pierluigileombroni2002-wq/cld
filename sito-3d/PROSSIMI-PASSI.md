# ERI · sito 3D · prossimi passi

Promemoria per la prossima sessione (vale anche se si apre una chat nuova).

## Da ricordare a Pierluigi appena riprende

1. **Generare i modelli 3D** (file `.glb`) da inserire nella scena al posto delle forme semplici:
   - modulo fotovoltaico su tracker monoassiale
   - ~~pala eolica~~ → probabilmente l'eolico verrà tolto (vedi sotto)
   - turbina Kaplan, turbina Francis, turbina Pelton
   - Strumenti consigliati, con piani gratuiti limitati: **Meshy**, **Tripo**, **Luma Genie**.
     Descrivere l'oggetto (es. "Pelton turbine runner, bronze, studio lighting") o caricare una foto, poi esportare in `.glb`.
2. **Scegliere il logo**: `logo/ufficiale/logo-eri.svg` (fedele all'originale) oppure `logo/ufficiale/logo-eri-v2.svg` (rifinito). Poi va messo nel sito al posto del logo provvisorio "Isoipse".

## Stato della versione 2 (sito-3d/v2) · in pausa

- Fatto: progetto (`v2/DESIGN.md`), architettura (`v2/ARCHITETTURA.md`), fondamenta complete e revisionate
  (luce, cielo, ombre, post-produzione, qualità fino a 4K, regia camera, scroll, interfaccia, testi, sezioni).
- Parziale: mondi 3D (terreno, catasto, fiume e dintorni iniziati; fotovoltaico, valle idro, turbine e cantiere da fare).
- Per riprendere: rilanciare la fase "mondi" (costruttori in parallelo che continuano dai file esistenti), poi collaudo visivo e pubblicazione.
  Stima: 4-5 finestre di utilizzo con collaudo doppio, 2-3 con collaudo leggero.
- Anteprima locale: `cd sito-3d && python3 -m http.server 8790` poi aprire http://localhost:8790/v2/

## Servizi reali di ERI (da usare nel sito)

1. Screening preliminare vincolistico
2. Realizzazione primo layout
3. Micrositing ed Energy Assessment
4. Validazione dati anemologici e reportistica
5. Sopralluoghi e incontri con i proprietari terrieri
6. Ricerca tecnologica wind turbine / moduli fotovoltaici
7. Attività di Project Development Management
8. Gestione portali per richiesta di connessione elettrica e GSE
9. Predisposizione budget di costruzione e individuazione di potenziali fornitori e subappaltatori
10. Attività di procurement e realizzazione contratti di acquisto
11. Asset management
12. Attività di project management in fase di costruzione
13. Studi di efficientamento energetico

Già presenti nel sito di prova: studio del territorio dalle particelle alle aree idonee, verifica vincoli,
iter autorizzativo (PAS, Autorizzazione Unica, VIA) fino al Ready to Build.

**Deciso:** niente eolico. Esclusi dal sito i punti 3 e 4; il punto 6 vale solo per moduli FV e turbine idrauliche.

Idea di struttura: i servizi seguono la vita del progetto.
Sviluppo (1–6) → Autorizzazione e connessione (8, PAS/AU/VIA) → Costruzione (9, 10, 12) → Esercizio (11, 13), con 7 trasversale.

## Asset già scaricati

In `sito-3d/asset/` (vedi `LEGGIMI.md`): 3 cieli HDRI e texture PBR 2K (terreno, campo, cemento, metallo), tutti CC0.

## Direzione per la versione "al massimo"

- **Deciso: niente eolico.** Il sito si concentra su tre tecnologie:
  fotovoltaico, agrivoltaico, idroelettrico (Kaplan, Francis, Pelton). Meno cose, fatte meglio.
- Strada consigliata: **ibrida**. Parti chiave in render cinematografico (Blender, sequenza di fotogrammi
  guidata dallo scroll), il resto in tempo reale con Three.js potenziato (modelli PBR, luci "cotte", post-produzione).
- 4K sì (risoluzione dello schermo), 8K no: inutile sul web e troppo pesante.
- Idee di animazione: mappa catastale che diventa terreno 3D; tracker in vista esplosa che si monta e segue il sole
  con ombre vere; ciclo giorno/notte; acqua nella condotta che colpisce la Pelton; turbine in sezione.
- Compito per Pierluigi: scegliere 2-3 siti di riferimento su awwwards.com (sezione 3D / WebGL).

## Modelli 3D: da dove prenderli

- Attenzione: **modello 3D** (l'oggetto) ≠ **render** (l'immagine finale). Nel sito il render lo fa Three.js;
  per immagini o video statici molto realistici c'è **Blender** (gratis).
- **Oggetti tecnici e precisi** (turbine, tracker, pale): meglio modelli già fatti.
  - **Sketchfab**: tanti modelli gratuiti e professionali (cercare "Pelton turbine", "wind turbine"…). Controllare la licenza per uso commerciale.
  - **GrabCAD**: modelli tecnici fatti da ingegneri, molto precisi.
- **Elementi decorativi o "morbidi"**: generatori IA.
  - **Meshy**, **Tripo**: i più usati, facili, buone texture.
  - **Rodin (Hyper3D)**: spesso la qualità più alta.
  - **Hunyuan3D** (Tencent), **TRELLIS** (Microsoft): gratuiti e open source.
  - Limite: con oggetti meccanici l'IA fa forme un po' "sciolte". Settore che cambia in fretta: provarne due sullo stesso oggetto e confrontare.
- Formato da chiedere/esportare: **`.glb`** (lo inserisco io nella scena).

## Quale IA usare per cosa

- **OpenArt** (collegato alla sessione Claude): ha i modelli più recenti per **immagini e video**
  (Nano Banana 2.1 / Pro, GPT Image 2.5, Veo 3.1, Kling 3, Seedance, Wan 3.0…).
  **Non genera modelli 3D.** Piano attuale: Free con 5 crediti; un'immagine costa 6–40 crediti, un video 50–450.
  Utile per: sfondi, texture (terreno, metallo, pannelli), un video aereo di un impianto.
- **Meshy / Tripo / Luma Genie**: modelli 3D da testo o foto → è il salto di realismo più grande per il sito.
- **Google AI Studio (Nano Banana)**: immagini gratis, buono per prove.
- **Recraft**: loghi e grafiche direttamente in vettoriale (SVG).

## Problemi noti nel sito

- Una pala eolica finisce nel fiume (`[-44, -76]` in `main.js`). Si risolve da sé se l'eolico viene tolto.
- La colonna d'acqua della Kaplan sembra un blocco: renderla più trasparente.
- I filari verdi dell'agrivoltaico sono troppo accesi.
- Manca una vera versione per telefono.

## Link

- Sito 3D: https://claude.ai/artifact/PXjnmLFpJRNsVkNZNX3x9A
- Prove loghi: https://claude.ai/artifact/DR3YR7GpKN5VgkCBH4bLQR
- Branch Git: `claude/charming-planck-l43o5q`
