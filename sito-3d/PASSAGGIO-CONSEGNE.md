# ERI · sito 3D · passaggio di consegne

Questo file serve a una **nuova sessione** per riprendere il sito nuovo (versione 2) da dove è stato lasciato.
Leggilo tutto prima di scrivere codice.

> ## Aggiornamento 26/10/2026: SI LAVORA SOLO SU `sito-3d/v3`
> Il cliente ha scartato la v2 (troppo pesante, laggava sui portatili, "anonima", troppo cartografica) e ha approvato lo stile
> "showroom" (`prove/showroom*`). Il prototipo del sito nuovo è in `v3/` (commit `51b52f1`): 5 momenti (apertura con il
> logo completo, fotovoltaico e agrivoltaico, BESS, idroelettrico con Pelton/Francis/Kaplan, contatti), barra dell'ITER sempre
> visibile (messaggio chiave: per ogni impianto ERI segue tutto l'iter), macchine in `v3/macchine/`. Regole vincolanti:
> WOW, stilizzato e kinetic, niente vegetazione/terreni realistici, NIENTE ombre, camera calma (niente zoom avanti-indietro),
> pochi testi grandi e leggibili, fluido su portatili e telefoni (qualità a 3 livelli, `?q=`). Aperti: prova su un portatile
> vero, "ITALIA" del logo poco leggibile sul fondo scuro, riflesso forte sui pannelli agrivoltaici, barra di carica del BESS
> poco leggibile da lontano, togliere gli strumenti di prova prima di pubblicare.
>
> ## Aggiornamento 22/10/2026 (sessione su PC Windows dell'utente)
> **Fatto e approvato dal cliente** (branch `claude/charming-planck-l43o5q`, ultimo commit della tappa 4 `243f6fa`):
> - **Logo** originale ricostruito in vettoriale: `logo/ufficiale/logo-eri-originale.svg` (strumenti in `strumenti/logo-*.html`).
> - **Tema chiaro "Alba luminosa"** (palette B): DESIGN.md §2.1 aggiornato; linee "a inchiostro" (non più luce sommata); crepuscolo chiaro al posto della notte.
> - **Terreno realistico ovunque** (`MATERIALI.terreno.stile = 'naturale'`, `mondo/terreno-natura.js` + erba 3D `mondo/terreno-erba.js`); altri stili con `?stile=`.
> - **Tappa 3**: tracker FV/agri (`impianti/tracker*.js`, moduli in **vetro realistico**), **grano dorato** sotto l'agrivoltaico (`impianti/agri-grano.js`).
> - **Tappa 4**: valle in **plastico bianco**, tre turbine **Pelton, Francis, Kaplan** distinte, stile **inox** (`idro/*`).
>
> **Direzione del cliente (vincolante):** effetto WOW, "moderno, all'avanguardia e lussuoso"; se il realismo viene brutto, meglio stilizzato curato. Chiedere sempre con opzioni e **anteprime come immagini** (l'utente segue dal telefono: mandare le foto con SendUserFile, i link agli artifact non li apre). Foto per il cliente in qualità ultra: `strumenti/foto-v2.ps1 -Url "http://localhost:8790/v2/?nointro=1&q=ultra"` (server: `strumenti/server.ps1`; Git in `C:\Program Files\Git\cmd\git.exe`). Ambito "Medio" (niente viste esplose delle turbine).
>
> **Da fare:**
> 1. **Tappa 5** (cantiere e gestione: `impianti/cantiere.js`) e **tappa 6** (finale: `ui/finale.js` 3D).
> 2. **Rifinitura**: voli della camera nella valle che attraversano i muri (T 13,33–13,50 e 14,28–14,35), Pelton V4.3 meglio di tre quarti, HUD idro che copre la Kaplan nel 4e, etichette sui carter scuri, shader compilati dopo il warm-up (programmi che crescono durante il giro), terreno naturale ripassato in tutte le tappe 0–3, contrasto dei testi piccoli in oro, passata "lusso" generale.
> 3. **Collaudo e pubblicazione** come artifact.
>
> **Costi osservati** (piano Max, blocchi da 5 ore): tema chiaro ~19%, tappa 3 ~14%, tappa 4 con 7 agenti ~75%. Prima di un lavoro grosso dare la stima e aspettare l'ok.

---

## 1. Regole di lavoro con l'utente (obbligatorie)

- **Lingua:** italiano, frasi brevi, spiegazioni semplici. L'utente sta imparando come funzionano i siti 3D.
- **Stile: si decide insieme.** Prima di applicare scelte visive (colori, sfondo, font, logo, luci, materiali, impaginazione):
  - proponi **2-4 opzioni concrete**, con anteprime quando possibile (screenshot o piccole pagine di prova);
  - **chiedi** con lo strumento AskUserQuestion;
  - non procedere a intuito: per ogni dubbio di stile, chiedi.
- **Crediti e limiti di utilizzo.** La sessione precedente ha esaurito il limite 4-5 volte usando molti agenti in parallelo.
  - Lavora a passi piccoli e mostra il risultato dopo ogni passo.
  - Prima di un lavoro grosso, dai una stima di quanto costa (quante "finestre" di utilizzo) e chiedi l'ok.
  - Niente orchestrazioni con tanti agenti, a meno che l'utente non lo chieda espressamente.
- **Niente servizi a pagamento.** Mai generare immagini o video a pagamento (per esempio con OpenArt) senza dire prima il costo e avere l'ok.
- **Solo PC.** La versione per telefono per ora non interessa, ma la pagina non deve rompersi.
- **Git:** lavora sul branch `claude/charming-planck-l43o5q` del repo `pierluigileombroni2002-wq/cld`. Fai commit e push dopo ogni passo. Niente pull request se non richiesta.

---

## 2. L'azienda

- **ERI · Energie Rinnovabili Italia.** Sviluppa progetti di energia rinnovabile fino al **Ready to Build**, poi segue costruzione e gestione.
- **Tecnologie da mostrare:**
  - **fotovoltaico e agrivoltaico** (insieme), con tracker monoassiali nord-sud che seguono il sole; nell'agrivoltaico i tracker sono rialzati sopra le colture;
  - **idroelettrico**: Kaplan, Francis e Pelton. Sono solo idroelettriche e si distinguono per **salto** e **portata**:
    - Kaplan: salto basso, grande portata;
    - Francis: salto e portata medi;
    - Pelton: salto alto, piccola portata.
- **L'eolico è escluso del tutto**: niente pale, niente servizi del vento, nessun riferimento.
- **Servizi** (senza quelli eolici):
  1. Screening preliminare vincolistico
  2. Realizzazione primo layout
  3. Sopralluoghi e incontri con i proprietari terrieri
  4. Ricerca tecnologica sui moduli fotovoltaici
  5. Project Development Management (trasversale)
  6. Gestione portali per la connessione elettrica e GSE
  7. Budget di costruzione, fornitori e subappaltatori
  8. Procurement e contratti di acquisto
  9. Asset management
  10. Project management in fase di costruzione
  11. Studi di efficientamento energetico

  Oltre a: studio del territorio dalle particelle catastali alle aree idonee, verifica dei vincoli e iter autorizzativo (PAS, Autorizzazione Unica, VIA) fino al Ready to Build.
- **Contatti:** per ora finti (`info@eri-esempio.it`, `progetti@eri-esempio.it`, `+39 000 000 0000`).
- **Sensazione voluta:** dinamico, moderno, futuristico, elegante, serio, altissimo livello, "effetto wow", qualità "4K".

---

## 3. Novità dal cliente (da affrontare per prime)

1. **Logo.** Vogliono il **logo originale**, rifatto in alta qualità.
   - L'originale a bassa risoluzione è in `sito-3d/logo/originale.png`: sole a petali, foglie verdi, scritta ENERGIE RINNOVABILI ITALIA.
   - Esiste anche una versione con la scritta "solar farm".
   - Ricostruzioni vettoriali già fatte:
     - `sito-3d/logo/ufficiale/logo-eri.svg` e `logo-eri-su-scuro.svg`: fedeli all'originale;
     - `logo-eri-v2*.svg`: versione "rifinita" con petali simmetrici, ma **senza il petalo verde-lime** dell'originale.
   - Lo script che le genera (Python + fontTools, font Montserrat convertito in tracciati) era in una cartella temporanea e **non c'è più**.
   - **Da fare:** confrontare le ricostruzioni con l'originale, chiedere all'utente quale base usare (fedele, con o senza "solar farm"), poi rifinire in alta qualità.
   - Il sito v2 oggi usa `logo-eri-v2-su-scuro.svg`: va sostituito con quello scelto.
2. **Sfondo troppo scuro.** Il nero (`#050607`) **non piace**.
   - Prima di toccare il codice, prepara **opzioni di palette e sfondo** (3-4) e falle scegliere. Esempi da proporre:
     - chiaro "carta tecnica", avorio o grigio caldo, con oro e verde;
     - grigio-blu ardesia medio;
     - cielo chiaro dell'alba con terreno luminoso;
     - una via di mezzo, scuro ma non nero.
   - Mostra anteprime: per esempio la stessa inquadratura renderizzata con le varie palette.
   - Cambiare sfondo tocca molte cose (token CSS, cielo, nebbia, esposizione, colori degli overlay, contrasto dei testi). Valuta l'impatto e dillo all'utente.
3. **Altri dubbi di stile**, come font, colore oro o luce delle tappe: chiedi, non decidere da solo.

---

## 4. Cosa esiste

### Versione 1 (finita, piaciuta molto, da NON modificare)
- File: `sito-3d/index.html`, `style.css`, `main.js`.
  - Three.js r160 + GSAP ScrollTrigger, un territorio 3D stilizzato scuro con isoipse oro.
  - Tappe: griglia catastale, vincoli, iter, tracker FV e agri, idro con le 3 turbine.
  - Ha ancora le pale eoliche: nella v2 sono escluse.
- È pubblicata come artifact: https://claude.ai/artifact/PXjnmLFpJRNsVkNZNX3x9A
- Problemi noti:
  - una pala eolica finisce nel fiume (l'utente aveva detto di lasciarla);
  - la colonna d'acqua della Kaplan sembra un blocco;
  - i filari verdi dell'agrivoltaico sono troppo accesi.

### Versione 2 (in corso) · `sito-3d/v2/`

**Documenti da leggere:**
- `v2/DESIGN.md`: la specifica completa, circa 156 KB. Concetto "gemello digitale" (territorio reale e il suo doppio d'oro), tappe, camera, testi, numeri.
  - Il **nero e l'oro sono stati decisi qui, ma ora il cliente vuole uno sfondo meno scuro**: la palette in §2 va rivista con l'utente.
- `v2/ARCHITETTURA.md`: il contratto del codice (interfaccia dei moduli, `ctx`, `STATO` e tracce, proprietà dei file, API di debug).
- `v2/DOSSIER-TECNICO.md`: le tecniche di Three.js r160 verificate.

**Fatto e revisionato (fondamenta):**
- `js/config.js` (numeri normativi, keyframe della camera, tracce, battute) e `js/geo.js` (altezza del terreno, catasto, sole NOAA, angolo dei tracker con backtracking, layout di 15 960 + 3 696 moduli).
- `js/main.js`, `js/regia/*` (camera su curve, scroll con Lenis, STATO come funzione pura del tempo di scroll T), `js/render/*` (pipeline con GTAO, bloom, SMAA e passaggio "Pellicola", ombre adattive, qualità fino a 4K), `js/luce/*` (cielo procedurale, luce da HDRI, nebbia, sole).
- `index.html`, `css/stile.css`, `js/ui/*`: preloader con logo, indice, HUD, etichette 3D, testi, sezioni Chi siamo, Servizi e Contatti, cursore.
- La pagina si carica con zero errori in console.

**Parziale:**
- `js/mondo/terreno.js`, `catasto.js`, `fiume.js`, `contorno.js`, `contorno-*.js`: iniziati, circa 2 000 righe, mai verificati visivamente fino in fondo.

**Da fare (oggi sono stub vuoti):**
- `js/impianti/tracker.js`, `agri.js`, `cantiere.js`;
- `js/idro/valle.js`, `pelton.js`, `francis.js`, `kaplan.js`, `acqua.js`, `diagramma.js`;
- rifinitura di `js/ui/finale.js`.

**Asset gratuiti CC0 (Poly Haven):**
- `sito-3d/asset/hdri/*_2k.hdr`: tre cieli;
- `sito-3d/asset/texture/web/*.webp`: terreno, campo, cemento, lamiera. Attenzione: la lamiera è bugnata e arrugginita, non va usata su turbine e tracker.
- Modelli `.glb` facoltativi in `sito-3d/asset/modelli/`; ancora nessuno.

---

## 5. Come provare il sito

```bash
cd /home/user/cld/sito-3d && python3 -m http.server 8790
# poi aprire http://localhost:8790/v2/   (parametri utili: ?nointro=1  ?T=9.2  ?debug=1  ?test=1)
```

- **Debug nel browser:** `window.__eri.vaiT(T)` salta al tempo di scroll T (da 0 a 19); `window.__eri.prove()` lancia le prove automatiche.
- **Screenshot senza GPU:** Playwright con Chromium in `/opt/pw-browsers/chromium`, flag `--use-angle=swiftshader --enable-unsafe-swiftshader`. È lento.
  - Lo script di prima (`foto-v2.js`) era in una cartella temporanea e potrebbe non esserci più. Va rifatto: apre la pagina, aspetta `window.__eri.pronto`, chiama `vaiT`, fa lo screenshot.

---

## 6. Ordine di lavoro consigliato (a passi piccoli)

1. **Logo:** confronto delle versioni, scelta con l'utente, rifinitura in alta qualità.
2. **Palette e sfondo:** 3-4 opzioni con anteprime, scelta con l'utente, aggiornamento di `DESIGN.md` §2 e dei token in CSS e config.
3. **Terreno e catasto** (tappe 0-2): completare e verificare con screenshot, mostrarli all'utente.
4. **Fotovoltaico e agrivoltaico** (tappa 3).
5. **Valle idroelettrica e turbine** (tappa 4).
6. **Cantiere e finale** (tappe 5-6).
7. **Collaudo leggero e pubblicazione** come artifact. Multi-file: la pagina più `asset/` tramite il parametro `files`.

Dopo ogni passo: commit, push, 2-3 righe di resoconto all'utente e, se ci sono scelte di stile, una domanda con opzioni.

---

## 7. Altre cose da ricordare all'utente

- **Modelli 3D:** cercare su Sketchfab o GrabCAD (gratis, controllando la licenza) un tracker con pannello, Pelton, Francis e Kaplan in `.glb`. In alternativa Meshy, Tripo o Rodin per oggetti meno tecnici.
- **OpenArt** (collegato): fa solo immagini e video, non modelli 3D. Il piano è Free con pochi crediti.
- Altre note in `sito-3d/PROSSIMI-PASSI.md`.
