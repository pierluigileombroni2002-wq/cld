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

## Chi fa cosa

### Ritmo e BPM (scheda 01)
- **Claude-PowerShell**
  - Per ogni traccia in `musica\` ricava BPM, primo beat e drop e li salva in `analisi\bpm-tracce.json` (uno strumento di analisi audio, oppure i valori dati da Pierluigi). Se non riesce, lo scrive in `COMUNICAZIONI.md` invece di inventarli.
  - Quando riceve un piano JSON, controlla che tutti i tempi stiano sulla griglia e li arrotonda al fotogramma prima del render.
- **Claude-App**
  - Scrive il piano del reel in JSON (campi `start_time`, `end_time`, `visual_action`, `audio_cue`) usando i valori di `analisi\bpm-tracce.json`, mai tempi a occhio.
  - Nello script della voce narrante mette la pausa (`<break time="1.0s"/>` o `[PAUSA]`) subito prima del drop o della rivelazione.

## Registro delle novità
- 2026-10-06 · Aggiunta la scheda 01 (ritmo e BPM). Da adesso i piani di montaggio si consegnano in JSON agganciati alla griglia dei beat.
