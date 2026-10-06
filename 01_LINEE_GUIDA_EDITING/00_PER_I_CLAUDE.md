# Linee guida di editing · Istruzioni per Claude-App e Claude-PowerShell

Questa cartella raccoglie le regole di editing che Pierluigi passa man mano (dritte da Gemini e da altre fonti), già filtrate. **Valgono per tutti i reel**, salvo che `guida-stile.md` o Pierluigi dicano diversamente.

## Come usarle
1. **Prima di ogni lavoro di montaggio** leggete questo file e le schede numerate qui sotto che riguardano il compito.
2. Se una regola qui va contro `guida-stile.md` o `METODO.md`, **non sceglietene una a caso**: scrivete il conflitto in `COMUNICAZIONI.md` e chiedete a Pierluigi.
3. Quando arriva una dritta nuova, si aggiunge una scheda numerata (`02_…`, `03_…`) e una riga nell'indice e nel registro qui sotto. Le schede restano corte: solo regole che cambiano il lavoro.

## Indice delle schede
| # | Scheda | In breve |
|---|---|---|
| 01 | [Ritmo e BPM](01_ritmo-bpm.md) | Tagli solo sulla griglia dei beat, pausa vocale prima del drop, piano del reel in JSON |
| 02 | [Script a ritenzione](02_script-ritenzione.md) | Hook nei primi 3 s, frasi corte, max 45 s, anello aperto finale, cambio visivo ogni 3 s |

## Chi fa cosa

### Ritmo e BPM (scheda 01)
- **Claude-PowerShell**
  - Per ogni traccia in `musica\` ricava BPM, primo beat e drop e li salva in `analisi\bpm-tracce.json` (uno strumento di analisi audio, oppure i valori dati da Pierluigi). Se non riesce, lo scrive in `COMUNICAZIONI.md` invece di inventarli.
  - Quando riceve un piano JSON, controlla che tutti i tempi stiano sulla griglia e li arrotonda al fotogramma prima del render.
- **Claude-App**
  - Scrive il piano del reel in JSON (campi `start_time`, `end_time`, `visual_action`, `audio_cue`) usando i valori di `analisi\bpm-tracce.json`, mai tempi a occhio.
  - Nello script della voce narrante mette la pausa (`<break time="1.0s"/>` o `[PAUSA]`) subito prima del drop o della rivelazione.

### Script a ritenzione (scheda 02)
- **Claude-App**
  - Scrive lo script seguendo le 5 regole della scheda (hook, frasi corte, tono, anello aperto, cambio ogni 3 s).
  - Lo consegna nel JSON della scheda 01 con i campi `voiceover` (italiano) e `broll_prompt` (inglese), non in tabella Markdown.
- **Claude-PowerShell**
  - Controlla lo script prima del render: nessuna frase oltre 10 parole, voce sotto i 45 s, nessun segmento più lungo di ~3 s. Se qualcosa non torna, lo scrive in `COMUNICAZIONI.md`.

## Registro delle novità
- 2026-10-06 · Aggiunta la scheda 01 (ritmo e BPM). Da adesso i piani di montaggio si consegnano in JSON agganciati alla griglia dei beat.
- 2026-10-06 · Aggiunta la scheda 02 (script a ritenzione). Gli script si consegnano nel JSON della scheda 01 con `voiceover` e `broll_prompt`.
