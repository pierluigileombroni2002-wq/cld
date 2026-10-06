# 02 · Script a ritenzione: hook, ritmo, anello aperto

Fonte: dritte di Gemini, 6 ottobre 2026 (prompt per Shorts "mistero / sci-fi / lore irrisolta"). Filtrate e adattate al progetto.

## L'idea in una riga
Lo script non racconta una storia: **trattiene l'attenzione**. Tensione che sale, fatti dati col contagocce, nessuna risposta definitiva alla fine.

## Regole

### 1. Hook nei primi 3 secondi
- Si parte con un'affermazione scioccante, una domanda senza risposta o un paradosso.
- Niente saluti, niente "in questo video vi racconto…".
- Anche il visivo deve "rompere" (pattern interrupt): primo fotogramma forte, non un'inquadratura di passaggio.

### 2. Frasi corte, video corto
- Massimo **8-10 parole per frase**.
- Voce letta in **massimo 45 secondi** a ritmo incalzante: in italiano sono circa 110 parole in tutto (stima, da verificare con la voce IA scelta).

### 3. Tono e tensione
- Tono investigativo e cupo (riferimenti: *Fringe*, *Arrival*).
- Un fatto nuovo alla volta: ogni frase deve aggiungere qualcosa o alzare la tensione, altrimenti si taglia.

### 4. Anello aperto alla fine
- Mai una chiusura chiara e rassicurante.
- Si chiude sul picco di tensione con una domanda inquietante o una mezza verità, che spinge a commentare la propria teoria o a riguardare il video.
- Meglio ancora se l'ultima frase si collega alla prima, così il loop è naturale.

### 5. Cambio visivo almeno ogni 3 secondi
Nessuna clip resta a schermo più di ~3 s. Con la scheda [01](01_ritmo-bpm.md) il cambio va **sul beat più vicino** (a 120 BPM 3 s = 6 beat esatti; con altri BPM si arrotonda a un numero intero di beat).

## Formato dell'output
Gemini chiede una tabella Markdown. **Nel nostro flusso si usa il JSON della scheda 01**, con due campi in più, così gli script di montaggio lo leggono direttamente:

```json
{ "start_time": 0.2, "end_time": 3.2,
  "voiceover": "Nel 1977 un radiotelescopio ricevette un segnale. Durò 72 secondi.",
  "broll_prompt": "Extreme close-up of an old radio telescope printout, red pen circling '6EQUJ5', dim green CRT light, film grain",
  "visual_action": "clip_07 zoom in", "audio_cue": "beat" }
```

- `voiceover`: in italiano, le parole esatte che legge la voce IA.
- `broll_prompt`: in inglese, descrizione dettagliata per i generatori video IA (soggetto, inquadratura, luce, stile).

## Per gli edit anime
- La stessa struttura funziona per **lore e teorie anime** (finali ambigui, misteri irrisolti di una serie, "cosa è successo davvero a…").
- Hook: il fotogramma più forte della scena va nei primi 3 secondi, non tenuto per il finale.
- Il drop della musica (scheda 01) coincide con la rivelazione principale; l'anello aperto arriva dopo, negli ultimi 2-3 secondi.
- Al posto del `broll_prompt` per generatori IA si può indicare la clip anime da usare (`clip\…`) quando il materiale c'è già.
