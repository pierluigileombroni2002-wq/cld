# ERI · sito 3D · prossimi passi

Promemoria per la prossima sessione (vale anche se si apre una chat nuova).

## Da ricordare a Pierluigi appena riprende

1. **Generare i modelli 3D** (file `.glb`) da inserire nella scena al posto delle forme semplici:
   - modulo fotovoltaico su tracker monoassiale
   - pala eolica (torre, navicella, rotore)
   - turbina Kaplan, turbina Francis, turbina Pelton
   - Strumenti consigliati, con piani gratuiti limitati: **Meshy**, **Tripo**, **Luma Genie**.
     Descrivere l'oggetto (es. "Pelton turbine runner, bronze, studio lighting") o caricare una foto, poi esportare in `.glb`.
2. **Scegliere il logo**: `logo/ufficiale/logo-eri.svg` (fedele all'originale) oppure `logo/ufficiale/logo-eri-v2.svg` (rifinito). Poi va messo nel sito al posto del logo provvisorio "Isoipse".

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

- Una pala eolica finisce nel fiume (posizione `[-44, -76]` in `main.js`): spostarla a `[-57, -77]`.
- La colonna d'acqua della Kaplan sembra un blocco: renderla più trasparente.
- I filari verdi dell'agrivoltaico sono troppo accesi.
- Manca una vera versione per telefono.

## Link

- Sito 3D: https://claude.ai/artifact/PXjnmLFpJRNsVkNZNX3x9A
- Prove loghi: https://claude.ai/artifact/DR3YR7GpKN5VgkCBH4bLQR
- Branch Git: `claude/charming-planck-l43o5q`
