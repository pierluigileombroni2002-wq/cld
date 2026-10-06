# 01 · Ritmo e BPM: tagli agganciati alla musica

Fonte: dritte di Gemini, 6 ottobre 2026. Filtrate e corrette dove serviva.

## L'idea in una riga
Claude non sente l'audio: il ritmo gli va dato **come numeri** (BPM e primo beat), e lui deve ragionare su una **griglia di tempi**, non "a occhio".

## Regole

### 1. Ogni traccia ha la sua scheda ritmo
Prima di montare, per ogni brano in `musica\` servono:
- **BPM** (battiti al minuto);
- **primo beat** (offset): il secondo in cui cade il primo battito. Quasi mai è 0.0;
- **drop**: il secondo in cui la traccia "esplode".

Formula: `durata di un beat = 60 / BPM`. A 120 BPM un beat dura 0.5 s; a 128 BPM dura 0.469 s.

### 2. Tagli solo sulla griglia
Ogni cambio clip, zoom, flash o comparsa di testo cade su:
`tempo = primo_beat + n × durata_beat` (n intero; mezzi beat ammessi solo per i passaggi veloci).

Mai tempi "liberi" come 1.3 s o 2.1 s se non sono sulla griglia.
I tempi vanno poi **arrotondati al fotogramma** (a 30 fps: multipli di 0.0333 s), altrimenti il render sposta il taglio di qualche millisecondo.

Frase da usare nel prompt:
> La traccia ha {BPM} BPM, primo beat a {offset} s (1 beat = {60/BPM} s). Ogni cambio clip, zoom o testo deve cadere ESATTAMENTE su un beat della griglia. Niente intervalli irregolari.

### 3. Silenzio prima del drop
Se c'è voce narrante, **un attimo prima del drop o della rivelazione** si inserisce una pausa:
- ElevenLabs / SSML: `<break time="1.0s"/>`
- testo per CapCut o lettura manuale: `[PAUSA]`

La voce che copre il drop appiattisce il video; il vuoto vocale lo fa sentire.

### 4. Output in JSON, non in tabella
La struttura del reel si consegna in JSON (oppure EDL), così gli script la leggono senza passaggi a mano:

```json
{
  "traccia": "nome.mp3",
  "bpm": 120,
  "primo_beat": 0.2,
  "fps": 30,
  "segmenti": [
    { "start_time": 0.2, "end_time": 1.2, "visual_action": "clip_03 zoom in", "audio_cue": "intro" },
    { "start_time": 1.2, "end_time": 2.2, "visual_action": "testo: titolo", "audio_cue": "beat" },
    { "start_time": 7.7, "end_time": 8.7, "visual_action": "nero / slow", "audio_cue": "pausa voce prima del drop" }
  ]
}
```

Controllo prima di consegnare: ogni `start_time` e `end_time` meno `primo_beat`, diviso la durata del beat, deve dare un numero intero (o .5).

## Per gli edit anime
- Il colpo forte della scena (pugno, trasformazione, sguardo in camera) va **sul drop**, non prima.
- Nei passaggi d'azione si taglia ogni beat o ogni mezzo beat; nelle parti calme ogni 2 o 4 beat (una battuta), così il ritmo respira.
- Prima del drop, 1 beat di nero, slow-motion o fermo immagine fa da "carica".
