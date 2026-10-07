# ERI v2 · Specifica di progetto definitiva

**Il gemello digitale**: il territorio vero e il suo doppio d'oro.

Questo documento è la specifica di costruzione del sito 3D ERI v2. Lo usano ingegneri diversi, che devono ottenere lo stesso risultato. Per questo ogni numero è normativo, salvo dove è scritto "indicativo" o "da tarare". I valori di mondo, di camera, di sole e di idraulica sono stati calcolati e verificati con script (le tabelle di controllo sono nelle appendici A, B e C).

- **Base del progetto**: la proposta "gemello digitale" (punteggio più alto). Su questa base sono innestate le idee migliori di "Calibro / editoriale-lusso" e "olografico-dati", e sono escluse le cose che i giudici hanno chiesto di evitare.
- **Identità da conservare** (il titolare ha amato il v1): nero, oro, eleganza tecnico-cartografica, isoipse oro, griglia catastale, Bodoni, Jost e Plex Mono.
- **Salto di qualità**: luce e materiali realistici (HDRI come IBL, ombre vere, PBR), più sovrapposizioni oro precise come in un disegno tecnico.
- **Escluso del tutto**: l'eolico. Non compare in testi, indice, icone, orizzonte, codice o meta.

---

## 0. Convenzioni (da leggere prima di tutto)

| Voce | Regola |
|---|---|
| Unità | **1 unità (u) = 10 m**. I modelli meccanici (tracker, turbine) si costruiscono **in metri** dentro un gruppo con `scale = 0.1`. |
| Assi | **+X = Est**, **+Y = alto**, **+Z = Sud** (quindi −Z = Nord). |
| Azimut | In gradi da Nord, in senso orario (90 = Est, 180 = Sud, 270 = Ovest). Versore verso il sole: `(sin az·cos el, sin el, −cos az·cos el)`. |
| Quota s.l.m. (HUD) | `180 m + 10·y`. |
| Coordinate geografiche (fittizie) | Origine (0, 0, 0) = 42°00′00″N 12°30′00″E. `lat = 42 − z·10/111320`, `lon = 12.5 + x·10/82727`. |
| Tempo di scroll **T** | T = scorrimento dentro `#storia` diviso `innerHeight`, levigato da Lenis. Va da 0 a **19**: 1 = un'altezza schermo. Ogni animazione legata allo scroll è definita come `[T_inizio → T_fine]`. |
| Camera (rig sferico) | Ogni inquadratura è `{target T, distanza d, beccheggio φ, rotta ψ, fov, ancora}`. φ è in gradi verso il basso (negativo = guarda in su). ψ è la rotta della direzione di vista (0 = guarda Nord). Il fov è **verticale** in gradi (equivalenze full-frame: 85 mm = 16,1°, 50 mm = 27,0°, 35 mm = 37,8°, 24 mm = 53,1°). Direzione di vista: `v = (cos φ·sin ψ, −sin φ, −cos φ·cos ψ)`. Posizione: `P = T − d·v`. |
| Testo | Italiano. Numeri all'italiana: virgola decimale e spazio fine per le migliaia (`10,4 MWp`, `15 960`, `1 200 m`). |
| Commenti nel codice | In italiano. Gli identificatori possono restare in inglese. |
| Dati | Tutti illustrativi. Ogni numero in pagina porta, vicino o nell'HUD, la dicitura **"dati illustrativi"** oppure **"simulazione"**. |

---

## 1. Concetto e momenti WOW

### 1.1 Concetto (5 righe)

1. Ogni progetto ERI esiste due volte: **nel territorio e nei dati**.
2. Un paesaggio italiano reale, alle ore d'oro e blu, porta sopra di sé il suo **gemello d'oro**: isoipse, catasto, vincoli, layout, cavi, che si disegnano con precisione da strumento.
3. Lo scroll è il **tempo del progetto**: dalla particella catastale al READY TO BUILD, poi l'impianto, l'acqua che cade e il cantiere.
4. Per l'investitore il messaggio è il **rischio ridotto**: conosciamo ogni particella, ogni vincolo, ogni ombra, ogni metro di salto.
5. Lo stile resta nero e oro, cartografico ed elegante come nel v1. La materia diventa vera: luce fisica, vetro, acciaio, acqua, a risoluzione 4K.

### 1.2 I 5 momenti WOW (in ordine di apparizione)

1. **La carta diventa territorio** (tappa 0). La linea d'oro del preloader si piega e diventa il fiume. La carta catastale, nera con isoipse oro, si solleva a onda dal sito. Le colline crescono e le loro ombre si allungano sotto un sole radente a 4°.
2. **L'alba della materia** (passaggio 2 → 3). All'ora blu il territorio è un plastico d'inchiostro, segnato dal sigillo READY TO BUILD in rame. Poi sorge il sole: un fronte circolare con bordo d'oro trasforma la carta in terreno PBR reale.
3. **Lo scroll è il sole** (tappa 3b). 15 960 moduli inseguono il sole e fanno backtracking con ombre vere. La camera compie un giro di 360° attorno al campo mentre il sole compie il suo arco. Alle 13:11 un'onda di riflessi attraversa il campo. L'HUD mostra ora, elevazione e angolo, calcolati dalla stessa funzione che muove i tracker.
4. **La discesa del salto** (tappa 4a-4b). La valle è un plastico in sezione con un righello oro in scala vera da 0 a 900 m. Si scende lungo la condotta forzata dentro la centrale Pelton tagliata. In macro, il getto a 115 m/s parte al ralenti ×1/1000 e si divide sulla cresta del cucchiaio.
5. **Stessa potenza, tre risposte** (tappa 4e). Tre giranti in acciaio, in scala relativa vera, stanno davanti al diagramma salto-portata log-log. Sopra ognuna sale una colonna d'acqua: altezza = salto, spessore = portata. La retta dei 10 MW si accende.

**Sigillo finale.** Il disco del sole al tramonto si scioglie nei 6 petali del logo ufficiale (in 2D, con i colori ufficiali).

---

## 2. Linguaggio visivo

### 2.1 Palette (token CSS = uniform GLSL)

```css
:root{
  --nero:#050607;        /* fondo, cielo allo zenit, nebbia nei vuoti */
  --inchiostro:#0b0f12;  /* terreno in "modalità carta" */
  --grafite:#0d1012;     /* pannelli, piani, base del plastico */
  --grafite-2:#15191c;   /* campitura delle sezioni */
  --bordo:rgba(216,184,120,.16);
  --oro:#d8b878;         /* isoipse, linee dati, occhielli */
  --oro-chiaro:#f1dfb3;  /* corsivi dei titoli, valori attivi, punta della penna */
  --avorio:#f4efe4;      /* titoli */
  --platino:#c9d0d4;     /* testo, griglia catastale */
  --grigio:#8a949a;      /* dati secondari */
  --smeraldo:#36c39a;    /* aree idonee (solo come dato) */
  --vincolo:#e0644f;     /* vincoli: sempre tratteggio, mai pieno */
  --acqua:#8fb7c9;       /* acqua, linee di corrente, idroelettrico */
  --rame:#b8572a;        /* SOLO: sigillo READY TO BUILD, cavidotto acceso, CTA premuta (dal "ITALIA" del logo) */
  --ambra:#e8a33d;       /* SOLO: stringa 14-B in manutenzione (tappa 5b) */
  --oro-3d-emissivo:#d6a454; /* oro per le emissioni 3D: dopo ACES torna percepito come --oro */
}
```

**Regole di colore**

- In ogni inquadratura c'è l'oro più **al massimo un** accento (smeraldo **o** vincolo **o** acqua **o** rame).
- L'oro copre meno del 5% dei pixel, tranne nel preloader.
- In 3D i colori si dichiarano in sRGB (`new THREE.Color('#d8b878')`). Con `ColorManagement` attivo la conversione in lineare è automatica.
- Le emissioni HDR si ottengono moltiplicando il colore per un fattore. I fattori standard sono in §2.6.
- I colori pieni del logo compaiono **solo nel logo**. Il logo non si ricolora mai.

### 2.2 Tipografia (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=IBM+Plex+Mono:wght@400;500&family=Jost:wght@300;400;500&display=swap">
```

| Ruolo | Font | Misure |
|---|---|---|
| H1 | Bodoni Moda 400, opsz 96 | `clamp(56px, 7.4vw, 128px)`, interlinea 0,98, spaziatura −0,01em, colore avorio. Seconda riga in corsivo oro chiaro. |
| H2 | Bodoni Moda 400 | `clamp(34px, 3.6vw, 60px)`, interlinea 1,06. `.grande` = `clamp(56px, 7vw, 120px)`. Corsivo `em` oro chiaro. |
| Testo | Jost 300 | `clamp(17px, 1.25vw, 20px)`, interlinea 1,6, platino, al massimo 52 caratteri per riga. |
| Occhiello | IBM Plex Mono 400 | 12px, spaziatura 0,24em, maiuscolo, oro. |
| Dati | IBM Plex Mono 400 | 12px, `font-variant-numeric: tabular-nums`. |
| Etichette 3D | Nome in Jost 500 13px (spaziatura 0,04em); dato in Plex Mono 400 10,5px maiuscolo, grigio. | — |
| HUD | Plex Mono 400 11px, spaziatura 0,1em, grigio; valori attivi in oro chiaro. | — |

Bodoni si usa solo da 28px in su.

### 2.3 I tre easing della casa

Sono gli unici ammessi per lo stile. Le sole eccezioni sono i movimenti "fisici" indicati nelle tabelle: la caduta dei fogli (`power2.in`), il sigillo che cade (`power4.in`), le onde (`power2.out`).

| Uso | Easing |
|---|---|
| Rivelazioni di testo e UI | `expo.out` |
| Camera e transizioni di scena (fuori dallo scroll) | `power2.inOut` |
| Pezzi della vista esplosa | `power4.out`, senza rimbalzo |
| Parametri legati allo scroll | `none` oppure `power2.inOut`, come indicato nelle tabelle §4. La morbidezza viene da Lenis e, per la camera, da `smootherstep`. |

### 2.4 Luce per tappa

**Le HDRI servono solo da luce (IBL), mai da sfondo.**

- Prima di passarle a PMREM vanno "de-solate": si limita lo 0,1% dei texel più luminosi al valore del percentile 99,9.
- L'unico sole è una `DirectionalLight`.
- Le HDRI si ruotano e si miscelano con la cupola descritta in §6.3.
- La rotazione allinea il bagliore della HDRI al nostro sole: `uRot = rad(azSole − azHDRI)`. `azHDRI` si ricava dal texel più luminoso: `azHDRI = (u* − 0,5)·360° + 90°`.
- L'intensità dell'environment si applica per materiale (`envMapIntensity` × `ENV_GLOBALE`), perché r160 non ha `scene.environmentIntensity`.

Tone mapping di base: **ACES Filmic** (esposizioni in tabella). Con `?tm=agx` si passa ad AgX per il confronto (esposizione ×1,35 e grading con contrasto +0,08 e saturazione +0,1).

| Tappa / tratto T | HDRI (A→B, miscela) | ENV_GLOBALE | Sole: elevazione / azimut | Colore / intensità sole | Emisfera (cielo / suolo / int.) | Esposizione | Cielo (§2.5) |
|---|---|---|---|---|---|---|---|
| 0 · 0–2,0 | qwantani_dusk | 0,55 | 4° / 295° | `#ffb46b` / 2,0 | `#8fa3b8` / `#0b0f12` / 0,06 | 0,95 | tramonto |
| 1 · 2,0–5,0 | qwantani_dusk | 0,50 | 4° → 1,5° / 295° → 298° | `#ffa45c` → `#ff8f4f` / 2,0 → 1,2 | 0,06 → 0,12 | 0,95 → 0,88 | tramonto. Saturazione del grading 0,85 ("analisi") |
| 2 · 5,0–7,45 | qwantani_dusk | 0,50 → 0,35 | −2° → −6° / 300° → 305° | — / 0 | 0,35 | 0,80 → 0,62 | ora blu |
| 2→3 · 7,45–7,60 | **cambio** a qwantani ruotata per l'alba (uRot verso az 57°), fatto nel fotogramma più scuro | 0,35 → 0,45 | −6° → −1° / 305° → 56° (salto nascosto) | — / 0 | 0,35 → 0,15 | 0,62 → 0,80 | ora blu → alba |
| 3a · 7,60–8,70 | qwantani (alba) | 0,45 | −1° → 3,3° / 56° → 61° | `#ff8a4c` → `#ff9d5c` / 0 → 1,6 | 0,15 → 0,08 | 0,80 → 0,85 | alba |
| 3b · 8,70–10,40 | qwantani → kloofendal (uMix 0→1 in 5 cotture, T 9,15–9,60) | 0,45 | **funzione solare reale** 21 giugno 42° N, ore 06:10 → 17:30 (§4.4) | colore e intensità da `luceSole(el)` (§6.3) | 0,06 | 0,85 → 1,00 (alle 12) → 0,95 | giorno scuro |
| 3c · 10,40–11,50 | kloofendal → autumn_field (4 cotture, T 10,40–10,70) | 0,50 | funzione solare, 17:30 → 19:00 (el 33,9° → 17,5°) | `luceSole(el)` | 0,08 | 0,95 | pomeriggio d'oro |
| 4 · Valle (scena separata) | kloofendal ruotata (sole HDRI ad az 210°) | 0,60 | 35° / 210° | `#fff1df` / 2,6 | 0,10 | 0,90; interni 1,00 | vuoto museale |
| 4 · interni centrali | — | 0,35 | sole a 2,6 | 2 `RectAreaLight` 5000 K `#fff4e8`, intensità 8, 0,05 × 0,6 u, più 1 `SpotLight` di controluce `#ffb46b` intensità 30, angolo 0,5, penombra 0,6 | — | 1,00 | — |
| 5a · 15,5–16,55 | autumn_field | 0,55 | 28° / 240° | `#ffe2bf` / 3,0 | 0,06 | 1,00 | pomeriggio. Ombre di nuvole ×20 in velocità ("time-lapse") |
| 5b · 16,55–17,5 | autumn_field | 0,55 | 50,5° / 255,5° (ore 16:00) | `#fff1df` / 3,3 | 0,06 | 1,00 | pomeriggio |
| 6 · 17,5–19,0 | autumn_field → qwantani (5 cotture, T 17,6–18,1) | 0,55 | 50,5° → 2° / 255° → 300° | `luceSole(el)` / 3,3 → 1,6 | 0,06 | 1,00 → 0,95 | tramonto con disco solare in campo |

Le cotture PMREM (`pmrem.fromScene`, 2–5 ms ciascuna) si fanno solo nei T indicati, mai a ogni fotogramma. La texture precedente va sempre liberata con `dispose()`.

### 2.5 Cielo, nebbia, sfondo

- **Sfondo**: `scene.background = null`. Al suo posto una cupola procedurale (`SphereGeometry(raggio 3000 u, 64, 32)`, `BackSide`, `depthWrite:false`, `fog:false`, `renderOrder −1`). È sempre più piccola del `far` della camera.
- **Shader della cupola**: gradiente verticale zenit → orizzonte, bagliore verso il sole (`pow(max(dot(dir, sole), 0), 6)`), disco solare analitico (raggio angolare 0,27°, bordo morbido 0,05°, HDR ×30) e alone di Mie (g = 0,76). È nitido a ogni risoluzione.

**Preset del cielo** (colori lineari da sRGB):

| Preset | Zenit | Orizzonte | Bagliore verso il sole | Disco solare |
|---|---|---|---|---|
| tramonto | `#050607` | `#3a2a1c` | `#b8794a` ×1,0 | sì, se el > −0,5° |
| ora blu | `#04060a` | `#1d2a36` | `#2c3a4a` ×0,6 | no |
| alba | `#06080b` | `#3d2a22` | `#d08a55` ×1,2 | sì |
| giorno scuro | `#101b26` | `#59697a` | `#a99a80` ×0,4 | no (sole fuori campo) |
| pomeriggio | `#0f1820` | `#4f5a62` | `#9c7c5a` ×0,6 | no |
| vuoto museale (Valle) | `#050607` | `#121a22` | — | no |

Il cielo "giorno" è volutamente più scuro del vero ("notte americana"), per tenere l'identità nero-oro.

**Nebbia**

- Si usa `THREE.FogExp2(coloreOrizzonte, densità)`.
- `ShaderChunk.fog_fragment` va sostituito **prima di creare qualunque materiale** con la nebbia in quota più la diffusione del sole (codice in §6.3).

| Situazione | Densità (1/u) |
|---|---|
| Panoramiche | 0,0018 |
| Medie distanze | 0,003 |
| Primi piani | 0,006 |
| Valle, inquadratura generale | 0,00025 |
| Valle, primi piani | 0,004 |
| Transizione "foschia 100%" | 0,02 |

**Bordo del mondo**: un anello di terreno a basso dettaglio, da 180 a 1 500 u, alla quota del bordo (`altezza` campionata sul perimetro) e svanito nella nebbia. Il bordo non deve mai essere visibile.

### 2.6 Materiali chiave

Parametri di partenza. Tarare solo `envMapIntensity` e le intensità, con la "carta grigia 18%" del debug (§6.13).

| Materiale | Tipo | Parametri |
|---|---|---|
| Terreno | `MeshStandardMaterial` + `onBeforeCompile` (§6.5) | Mappe del set `terreno_erba_roccia` (diff/nor/arm) e `terreno_campo` nello splat; `metalness 0`; `roughness 1` (× ARM.g); `envMapIntensity 0,45`; moltiplicatore albedo 0,62; saturazione 0,78; anisotropia massima. |
| Fiume e laghi | `MeshPhysicalMaterial` | `color #0a171c` (laghi `#08141a`), `roughness 0,06`, `metalness 0`, `clearcoat 0,6`, `clearcoatRoughness 0,04`, `envMapIntensity 1,4`. Normal map procedurale che scorre in due strati (§6.7), `normalScale 0,35`. |
| Modulo, faccia (vetro-vetro) | `MeshPhysicalMaterial` | `map` = texture delle celle (canvas 2048×1024, sRGB, anisotropia massima), `roughness 0,32`, `metalness 0`, `clearcoat 1`, `clearcoatRoughness 0,05`, `ior 1,5`, `envMapIntensity 1,25`. `iridescence 0,12`, `iridescenceIOR 1,3`, `iridescenceThicknessRange [180, 320]`, solo nei livelli Ultra e Alta. |
| Modulo, retro (bifacciale) | `MeshPhysicalMaterial` | `map` = celle dal retro (grigio-blu `#1a2230`, busbar visibili), `roughness 0,4`, `clearcoat 0,8`. |
| Telaio del modulo | `MeshStandardMaterial` | `#a9afb3`, `metalness 1`, `roughness 0,35`, `envMapIntensity 1`. |
| Acciaio zincato (pali, tubi, cuscinetti) | `MeshStandardMaterial` | `#9aa1a5`, `metalness 1`, `roughness 0,45`, `envMapIntensity 0,9`. Nel tracker eroe si aggiunge `roughnessMap` da `metallo_lamiera_arm`. |
| Inox delle giranti (13Cr-4Ni) | `MeshPhysicalMaterial` | `#c8ccd0`, `metalness 1`, `roughness 0,18`, `anisotropy 0,6` (mozzo e albero), `envMapIntensity 1,3`. **Mai oro né bronzo.** |
| Casse e carter | `MeshStandardMaterial` | Set `metallo_lamiera`, `color #2a2f33` (moltiplica la diffusa), `metalness` = ARM.b × 0,8, `envMapIntensity 0,8`. |
| Calcestruzzo (dighe, centrali, traversa, cabine) | `MeshStandardMaterial` | Set `cemento_diga`, `color #b9b4ab`, UV in coordinate mondo (`uv = pos·0,25 u⁻¹`), `envMapIntensity 0,6`. |
| Sezione (taglio) | Patch su materiale (§6.7) | Fondo `#15191c`. Tratteggio oro a 45° con passo di 6 px CSS in coordinate schermo (× `uPx`), linea di 1 px, emissivo ×1,2. Strati orizzontali ogni 5 m al 12%. |
| Colture (agrivoltaico) | `MeshStandardMaterial` | `#3d4a2a`, `roughness 0,9`, `alphaTest 0,5`, steli da canvas, `DoubleSide`, vento nel vertex shader. |
| Alberi a massa | `MeshStandardMaterial` | `#1f2b1f`, `roughness 0,95`, `instanceColor` con variazione ±10%. |

### 2.7 Overlay "olografici" (il gemello d'oro)

Regole comuni:

- Tutte le linee sul terreno si disegnano **nello shader del terreno**, dentro `totalEmissiveRadiance`, con anti-alias `fwidth`. Non c'è z-fighting e fa bloom solo il dato.
- Le linee nello spazio usano `LineSegments2` + `LineMaterial`, con larghezza in pixel e `resolution` aggiornata a ogni resize.
- Gli spessori sono in **px CSS** e nello shader si moltiplicano per `uPx = dprNativo × scala`.
- Sopra 1,0 di emissione si accende il bloom (soglia 1,0).
- Le linee svaniscono in lontananza quando `fwidth` supera 0,3–0,8 (anti-moiré).

| Elemento | Stile | Colore × emissione | Spessore |
|---|---|---|---|
| Isoipse ordinarie | Continue, ogni 5 m (0,5 u), calcolate su `aAltezza` (quota originale) | oro-3d-emissivo × 1,2 | 1,0 px |
| Isoipse direttrici | Ogni 25 m (2,5 u) | × 2,4 | 1,6 px |
| Confini catastali | Solo tra particelle diverse | platino × 0,9 | 0,9 px |
| Particelle del sito | Bordo più riempimento al 10% | oro × 2,4 (bordo), × 0,25 (riempimento) | 1,4 px |
| Aree idonee | Riempimento più bordo | smeraldo × 0,35 / × 1,4 | 1 px |
| Vincolo paesaggistico | Tratteggio a 45°, passo 6 px | vincolo × 1,6 | 1,2 px |
| Fascia fluviale 150 m | Tratteggio a 135° più bordo puntinato | vincolo × 1,6 | 1,2 px |
| Idrogeologico (PAI) | Puntinato: punti di 2 px ogni 7 px | vincolo × 1,4 | — |
| Archeologico | Cerchio puntinato (trattini di 4 px, pause di 4 px) più anello di rispetto | vincolo × 1,8 | 1,2 px |
| Ambientale (Natura 2000) | Tratteggio incrociato | vincolo × 1,4 | 1 px |
| Layout proposto | `LineSegments2` tratteggiata (8/6 px), punta luminosa | oro-chiaro × 2,2; punta × 6 | 1,25 px |
| Layout approvato (dopo RTB) | Continua | oro × 2,0 | 1,25 px |
| Cavidotto MT | `LineSegments2` continua più impulsi oro-chiaro che scorrono a 6 u/s | rame × 2,6 | 2 px |
| Lunetta di maturità | 60 tacche radiali (0,12 × 2,2 u) attorno a SITO_C, raggio 32 u | oro × 2,4 accese, × 0,25 spente | — |
| Tende di luce (proprietari) | Pareti verticali sui confini, gradiente da α 0,55 a 0 su 0,8 u, 6 scanline che salgono a 0,4 u/s | oro × 1,8 (firmato); contorno pulsante 0,8–1,8 a 1,2 Hz (in trattativa) | — |
| Quote tecniche (agrivoltaico, righello idro) | Linea con frecce a 30°, testo HTML | oro × 2,0 | 1 px |

**Etichette HTML** (agganciate a punti 3D):

- Niente riquadro e niente vetro.
- Richiamo a gomito di 1 px disegnato in un unico SVG a tutto schermo, punto di 5 px.
- Nome in Jost, dato in Plex Mono.
- **Al massimo 3 etichette visibili.**
- Area ammessa per il punto d'ancoraggio: x da 0,40 a 0,92 e y da 0,10 a 0,85 dello schermo (il testo sta 24 px sopra il punto).
- Se il punto cade nella colonna del testo, il gomito va a destra. Se cade fuori area, l'etichetta svanisce.
- Svaniscono in 250 ms se il punto è dietro la camera o coperto (test di profondità sul terreno analitico).

### 2.8 Grana, vignettatura, grading (passaggio finale "Pellicola")

Un solo `ShaderPass` finale a risoluzione nativa (§6.3). Dentro, in quest'ordine:

1. **Ricampionamento** dal buffer interno con nitidezza CAS: 0,35, oppure 0,5 se `scala < 0,9`.
2. **Grading**: luci calde (+0,02 R, −0,01 B sopra luminanza 0,6), ombre fredde (+0,008 B sotto 0,15), saturazione per tappa (default 1,0).
3. **Vignettatura ellittica** 0,26, centro spostato del 6% verso il lato opposto al testo.
4. **Grana** sulla luminanza: 0,028 sui mezzitoni, 0,01 su neri e luci, aggiornata a 24 fps.
5. **Dithering** triangolare ±0,5/255 contro il banding nei gradienti scuri.

Niente aberrazione cromatica, lens flare o raggi di luce. Niente `backdrop-filter`, né grana CSS sopra la tela.

---

## 3. Mappa del mondo 3D

Le scene sono due e non vengono mai disegnate insieme:

- **PIANURA**: il territorio delle tappe 0, 1, 2, 3, 5, 6 e lo sfondo delle sezioni HTML.
- **VALLE**: il plastico idroelettrico della tappa 4.

Hanno lo stesso renderer e la stessa catena di post-produzione; si scambia `renderPass.scene`. L'unità è la stessa: 1 u = 10 m.

### 3.1 PIANURA · terreno

- **Superficie**: 360 × 360 u (3,6 × 3,6 km), centrata nell'origine.
- **Geometria**: `PlaneGeometry(360, 360, S, S).rotateX(−π/2)`, con la rotazione incorporata nella geometria. S = 768 (Ultra), 512 (Alta e Media), 256 (Base).
- **Quote**: calcolate sulla CPU con `altezza(x, z)`, poi `computeVertexNormals()`. La quota originale si salva nell'attributo `aAltezza`: serve alle isoipse e al sollevamento.
- **Anello di bordo**: da 180 a 1 500 u, 64 segmenti radiali × 128 angolari, quota uguale al bordo, stesso materiale ma senza overlay. Si dissolve nella nebbia.
- **Quote risultanti (verificate)**:
  - minimo −2,96 u (alveo a sud);
  - massimo 15,45 u (crinale a nord-ovest);
  - pianura tra −1 e +1,5;
  - crinale nord a z ≈ −158, alto 10–15 u (100–150 m sopra la pianura);
  - colline a ovest (x ≈ −168) di 3–7 u, a est (x ≈ 150) di 1–3 u.

```js
// ---- Rumore deterministico (identico al v1) ----
function hash(x, y){ const s = Math.sin(x*127.1 + y*311.7)*43758.5453; return s - Math.floor(s); }
function rumore(x, y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash(xi,yi), b=hash(xi+1,yi), c=hash(xi,yi+1), d=hash(xi+1,yi+1);
  return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1; }
function fbm(x, y){ let t=0, amp=0.5, f=1; for(let i=0;i<5;i++){ t+=amp*rumore(x*f,y*f); f*=2.03; amp*=0.5; } return t; }
const ss = (a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };

// ---- Fiume: asse, fondo monotono (scorre da Nord a Sud), pelo libero ----
const fiumeX = z => -62 + 16*Math.sin(z*0.017) + 6*Math.sin(z*0.045 + 1.3);
const letto  = z => 1.2 - 4.0*(z+180)/360 + 0.25*Math.sin(z*0.031);   // da 1,36 (z=-180) a -2,96 (z=+180)
const acqua  = z => letto(z) + 0.35;                                   // pelo libero; larghezza bagnata ≈ 4,1 u (41 m)
const valleMax = dF => 0.55*ss(1.3,2.6,dF) + 0.16*Math.max(0, dF-2.6)**1.3; // fianchi della valle (tetto)
const valleMin = dF => 0.55*ss(1.3,2.6,dF) + 0.02*Math.max(0, dF-2.6);      // sponde sempre sopra l'acqua (pavimento)

// ---- Zone spianate: [x0, x1, z0, z1, quota (null = quota naturale al centro), bordo] ----
const PIANE = [
  [ -3,  47, -21,  33,  1.2, 10],  // sito FV
  [ 68, 112,  22,  54,  0.8,  9],  // agrivoltaico
  [122, 134, -60, -52, null,  4],  // cabina primaria
  [-16,  -8, -21, -15, null,  3],  // capannone aziendale
];
function hNaturale(x, z){
  let h = 2.6*fbm(x*0.011+3.7, z*0.011-1.9);                               // colline (±26 m)
  h += 15*Math.exp(-((z+158)**2)/900)*(0.72+0.28*fbm(x*0.018, 3.1));       // crinale nord
  h += 7*Math.exp(-((x+168)**2)/1000)*(0.6+0.4*fbm(2.7, z*0.02));          // colline ovest
  h += 3*Math.exp(-((x-150)**2)/700)*(0.5+0.5*fbm(5.1, z*0.02));           // colline est
  return h;
}
function piana(x, z, [x0,x1,z0,z1,,b]){ const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1); return 1-ss(0,b,Math.hypot(dx,dz)); }
function altezza(x, z){
  let h = hNaturale(x, z);
  const dF = Math.abs(x - fiumeX(z)), b = letto(z);
  h = Math.max(Math.min(h, b + valleMax(dF)), b + valleMin(dF));          // scava la valle, alza le sponde
  for (const p of PIANE){ const k = piana(x, z, p); if (k <= 0) continue;
    const q = p[4] ?? hNaturale((p[0]+p[1])/2, (p[2]+p[3])/2); h += (q - h)*k; }
  return h;
}
```

La stessa `altezza()` alimenta:

- la mesh del terreno;
- la posizione di ogni istanza (pali, alberi, cabine);
- il cursore-mirino, tramite ray-march;
- il vincolo della camera, che sta sempre ad almeno 0,3 u sopra il suolo;
- le quote dell'HUD.

### 3.2 PIANURA · catasto

**Griglia** (come nel v1, ruotata):

- `CELLA = 10 u` (100 m, 1 ha), `N = 48`, `ANGOLO = 0.22 rad`.
- Conversioni:
  - `versoGriglia(x,z) = ((cosA·x − sinA·z)/CELLA + N/2, (sinA·x + cosA·z)/CELLA + N/2)`;
  - `versoMondo(gx,gy)`: `X=(gx−N/2)·CELLA, Y=(gy−N/2)·CELLA → (cosA·X + sinA·Y, −sinA·X + cosA·Y)`.

**Particelle**

- Una particella è un insieme di celle con lo stesso id. I confini si disegnano **solo tra id diversi**.
- Fuori dalle tabelle qui sotto le celle si uniscono lungo `i`, a gruppi di 1–3, con `mulberry32(27)`: per ogni riga `j` si percorre `i` da 0 a 47 e la lunghezza del gruppo è `1 + floor(rnd·3)`.

**Tabella `tStati`** (`DataTexture` 48×48 RGBA8, `NearestFilter`), un texel per cella:

- **R**: bit di stato:
  - bit 0 = idonea;
  - bit 1 = sito FV;
  - bit 2 = agrivoltaico;
  - bit 3 = diritto firmato;
  - bit 4 = in trattativa.
- **G**: id particella (1–255).
- **B**: proprietario × 64 (A = 1, B = 2, C = 3).
- **A**: frazione della cella coperta da vincoli (0–255).

**Sito FV · Foglio 27, particelle 112–118** (14 celle, superficie catastale illustrativa 14,00 ha):

| Particella | Celle (i, j) | Centroide (x, z) | Superficie (ha, illustrativa) | Proprietario | Stato iniziale → finale |
|---|---|---|---|---|---|
| 112 | (25,23) (26,23) | (18,4; −9,2) | 1,98 | A | firmato |
| 113 | (27,23) | (33,1; −12,5) | 1,02 | A | firmato |
| 114 | (24,24) (25,24) (26,24) | (15,7; 1,6) | 2,95 | A | firmato |
| 115 | (27,24) | (35,2; −2,8) | 0,97 | B | firmato |
| 116 | (24,25) (25,25) | (13,0; 12,5) | 2,04 | B | firmato |
| 117 | (26,25) (27,25) | (32,6; 8,1) | 1,96 | C | in trattativa → firmato a T = 4,00 |
| 118 | (24,26) (25,26) (26,26) | (20,1; 21,1) | 3,08 | C | in trattativa → firmato a T = 4,00 |

- Contorno dell'unione (mondo, in senso orario): (7,58; −11,94) → (36,85; −18,49) → (43,40; 10,79) → (33,64; 12,97) → (35,82; 22,73) → (6,55; 29,28) → (0,00; 0,00) → (9,76; −2,18).
- **Centroide del sito `SITO_C = (21,7; 1,2; 5,4)`**: è l'origine di tutte le onde radiali.

**Agrivoltaico · Foglio 28, particelle 41–44** (6 celle, 6,00 ha):

| Particella | Celle | Centroide | ha | Proprietario | Stato |
|---|---|---|---|---|---|
| 41 | (30,28) (31,28) | (78,1; 28,6) | 1,96 | D | firmato |
| 42 | (32,28) | (92,8; 25,4) | 1,03 | D | firmato |
| 43 | (30,29) | (75,4; 39,5) | 0,98 | D | firmato |
| 44 | (31,29) (32,29) | (90,1; 36,2) | 2,03 | D | firmato |

Angoli dell'unione: (67,28; 25,94), (96,56; 19,40), (100,92; 38,91), (71,65; 45,46).

**Aree idonee**: celle con copertura di vincoli sotto il 5%, pendenza massima (9 campioni per cella) sotto 0,05, fuori da strade, fiume e bosco. Etichetta "pendenza < 5 % · nessun vincolo".

### 3.3 PIANURA · vincoli

Si rasterizzano sulla CPU nella `DataTexture` `tVincoli` (1024² RGBA8, che copre x e z da −180 a 180, 0,35 u per pixel, filtro lineare). L'ambientale va in `tMaschere.B`.

| Canale | Vincolo | Forma esatta | Etichetta (strato GIS) |
|---|---|---|---|
| tVincoli.R | Paesaggistico | Cerchio con centro (−112, 18) e raggio `40·(1 + 0,08 sin 5θ + 0,05 sin(11θ+1))`, **più** la fascia di crinale `z < −138 e altezza > 7` | Paesaggistico · D.Lgs. 42/2004 |
| tVincoli.G | Fascia fluviale | `dF ≤ 17,0` con `dF = abs(x − fiumeX(z))` (sponde a ±2,07 più 150 m) | Fascia fluviale · 150 m |
| tVincoli.B | Idrogeologico | Pendenza > 0,20 **oppure** (`dF < 25` e `altezza < acqua(z) + 1,0`) | Idrogeologico · PAI |
| tVincoli.A | Archeologico | Cerchio con centro (−20, −52) e raggio 8, più un anello di rispetto da 8 a 12 (solo contorno puntinato) | Archeologico · area di rispetto |
| tMaschere.B | Ambientale / bosco | Ellisse con centro (58, −78), semiassi 34 (x) × 24 (z), ruotata di 0,3 rad, bordo rumoroso ±2 u | Ambientale · Natura 2000 |

Verifica: il sito FV, l'agrivoltaico e il cavidotto **non toccano** alcun vincolo.

### 3.4 PIANURA · luoghi, strade, impianti

| Luogo | Coordinate (u) | Dimensioni / note |
|---|---|---|
| Centroide sito FV `SITO_C` | (21,7; 1,2; 5,4) | Quota spianata 1,2 (192 m s.l.m.) |
| Tracker eroe (tappa 3a) | Fila 31 a x = 20,2; z da 7,379 a 13,901; centro (20,2; 1,36; 10,64) | 56 moduli, motoriduttore al centro |
| Centroide agrivoltaico `AGRI_C` | (86; 0,8; 32,5) | Quota spianata 0,8 |
| Vicolo agrivoltaico (tappa 3c) | x = 84,78 (tra le file 15 e 16), z da 23 a 41,5 | Larghezza libera 0,87 u con moduli a 58° |
| Gruppo cabine al cancello | Centro (41,2; h; −11,5), lato lungo N-S | Cabina di consegna 12 × 2,5 × 2,7 m e cabina utente 8 × 2,5 × 2,7 m, affiancate, calcestruzzo `#8e8a83`. Inverter di stringa sui pali: niente cabine in campo. |
| Cabina primaria AT/MT (CP) | (128; h; −56), piazzale 12 × 8 u | 2 trasformatori (box 1,0 × 0,8 × 0,9 u), 4 portali (montanti 0,05 u, alti 1,4 u), sbarre come `LineSegments2` grigie, recinzione. Luci calde emissive ×3 all'ora blu. |
| Cavidotto MT 20 kV interrato | (40,5; −12,5) → (41; −33) → (126; −37) → (128; −52) | Lunghezza 120,7 u ≈ **1,2 km**, sul bordo strada a +0,02 u dal suolo |
| Strada provinciale (SP) | (−180,−34) (−120,−31) (−75,−29) (−30,−33) (0,−34) (41,−33) (90,−35) (126,−37) (180,−40) | Larghezza 0,7 u, asfalto (albedo `#2b2c2c`, ruvidità 0,85). Ponte sul fiume a x ≈ −70: impalcato 10 × 0,7 × 0,12 u e 2 pile. |
| Strada poderale | (41,−33) → (41,−12,5) → (45,14) → (60,30) → (70,32) | Larghezza 0,45 u, ghiaia `#6b6155` |
| Accesso alla CP | (126,−37) → (128,−52) | 0,5 u |
| Accesso al capannone | (−12,−18) → (−12,−33) | 0,45 u |
| Capannone aziendale (efficientamento) | Centro (−12; h; −18), asse lungo E-O | 4,0 × 1,8 u, muri alti 0,7 u, tetto a due falde con colmo a +0,25 u. Muri calcestruzzo, tetto lamiera `#4a4f53`. |
| Traversa con centrale ad acqua fluente (contesto, Kaplan) | (−77,5; 0,3; −100) | Soglia 7 × 0,6 × 0,4 u perpendicolare al fiume, salto del pelo libero 0,4 u con fascia di schiuma; centrale 2,4 × 1,6 × 1,0 u sulla sponda est (centro x = −72,5) |
| Bosco (Natura 2000) | Ellisse come in §3.3 | 1 500 alberi |
| Vegetazione di ripa | `2,8 < dF < 6`, esclusi ±4 u da ponte e traversa | 700 alberi |
| Filare lungo la SP | Lati della SP, tra x = −30 e x = 0, passo 1,2 u | 50 alberi |
| Campi arati (`tMaschere.R`) | Celle catastali non idonee e non vincolate, scelte con `rnd > 0,55`, contorno sfumato con rumore | Usano il set `terreno_campo` |

**Maschere** (`tMaschere`, canvas 2048² su x e z da −180 a 180, poi `CanvasTexture`, `NoColorSpace`, filtro lineare):

- R = campi arati;
- G = strade (asfalto 1,0, ghiaia 0,6);
- B = bosco / Natura 2000;
- A = piazzali e ghiaia (CP, cabine, cantiere).

**Alberi**: `InstancedMesh` di `IcosahedronGeometry(1, 1)` schiacciata a (r, 1,3·r, r), con r da 0,25 a 0,45 u. Base a `altezza + 0,8·r`. Proiettano e ricevono ombra.

### 3.5 PIANURA · layout degli impianti (algoritmo normativo)

Moduli 2 384 × 1 134 × 35 mm, 650 Wp, bifacciali vetro-vetro, 144 mezze celle. Tracker 1P (un modulo in verticale): larghezza utile trasversale 2,40 m.

```
layout(celle, passoFile, margine = 1,0 u):
  per x = (minX dell'unione + margine); x ≤ maxX − margine; x += passoFile
     intervalli z dentro l'unione, con distanza dal bordo ≥ margine (controllo a x ± 0,12 u)
     in ogni intervallo, da nord a sud:
        tracker interi da 56 moduli: lunghezza L = 56 × 0,1154 + 0,06 = 6,52 u; corridoio di 0,5 u tra tracker
        se resta posto ≥ L/2: mezzo tracker da 28 moduli
  passo del modulo lungo la fila = 0,1154 u (1 134 mm più 20 mm di fuga)
```

| Impianto | Passo file | GCR | Quota asse | File | Tracker | Moduli | Potenza (650 Wp) |
|---|---|---|---|---|---|---|---|
| FV (Fg. 27) | 0,6 u (6,0 m) | 0,40 | 1,6 m (0,16 u) | 66 (x da 2,2 a 41,2) | 308 | **15 960** | **10,37 MWp** |
| Agrivoltaico (Fg. 28) | 1,0 u (10,0 m) | 0,24 | **4,5 m** (0,45 u) | 29 (x da 70,28 a 98,28) | 79 | 3 696 | 2,40 MWp |

- **Nomi**: le file si numerano da ovest a est (01–66). I tracker di una fila hanno una lettera da nord (A, B, C…).
- **Stringa 14-B** (tappa 5b): fila 14 (x = 10,0), tracker B (z da −1,14 a 5,38), centro (10,0; 1,36; 2,12).
- **Pali**: ogni 8 m (0,8 u) lungo il tracker, più quello centrale del motoriduttore.
  - FV: profilo H (HEA 120), testa a 1,5 m.
  - Agrivoltaico: testa a 4,4 m.
- **Quote agrivoltaiche** (normative per testi e quote):
  - asse a 4,50 m;
  - bordo inferiore del modulo a ±60° = 4,50 − 1,20·sin 60° = **3,46 m ≈ 3,5 m**;
  - bordo superiore 5,54 m.

### 3.6 VALLE · il plastico idroelettrico (scena separata)

Plastico di una valle alpina tagliata in **sezione longitudinale lungo il fondovalle**. Il piano di taglio è **z = 0**, la faccia tagliata guarda verso +z e il plastico occupa z da −60 a 0. Unità: 1 u = 10 m, **scala vera, senza esagerazione verticale**.

**Dimensioni del blocco**

- x da −230 a 230 (4,6 km);
- base a y = −6;
- appoggiato su un piano grafite a y = −6.02, 2 000 × 2 000 u, che riceve l'ombra e svanisce nella nebbia.

```js
// Profilo del fondovalle sul taglio (z = 0)
function fondoValle(x){
  if (x < -179) return 84;                                             // fondo del lago alto (pelo libero 88,0)
  if (x < -176) return 84 + 5*ss(-179,-176,x);                         // soglia rocciosa a 89
  if (x < -96)  return 17.5 + 71.5*Math.pow((-96 - x)/80, 1.15);       // versante della condotta Pelton
  if (x < -86)  return 17.4;                                           // piazzale della centrale Pelton
  if (x < -42)  return 16 - 13.5*Math.pow((x + 86)/44, 0.8);           // fondo del serbatoio Francis (pelo libero 17,0)
  if (x < -38)  return 2.0;                                            // impronta della diga ad arco
  if (x < -29)  return 1.0;                                            // piede diga e centrale Francis
  if (x < 106)  return 1.3 - 0.45*(x + 29)/135;                        // fiume fino alla traversa (fondo 1,3 → 0,85)
  if (x < 118)  return -0.35;                                          // traversa e centrale Kaplan
  return -0.35 - 0.15*(x - 118)/112;                                   // pianura a valle
}
// Montagne alle spalle del taglio
const PUNTI_M = [[-230,18],[-106,18],[-94,14],[-46,14],[-34,10],[14,10],[26,5],[114,5],[126,2],[230,2]];
function Mliscia(x){ // interpolazione tra i punti, con raccordo smoothstep in ogni tratto
  for (let i = 0; i < PUNTI_M.length - 1; i++){ const [x0,m0] = PUNTI_M[i], [x1,m1] = PUNTI_M[i+1];
    if (x <= x1) return m0 + (m1 - m0)*ss(x0, x1, x); }
  return 2; }
function hValle(x, z){ const s = Math.pow(ss(0, 45, -z), 1.3);
  return fondoValle(x) + Mliscia(x)*s + 0.6*fbm(x*0.05, z*0.05)*s; }
```

**Peli liberi**:

- lago alto 88,0;
- serbatoio Francis 17,0;
- fiume da 1,7 (x = −29) a 1,2 (pool della traversa, x = 106);
- a valle della traversa da 0,0 a −0,1.

**Superficie del plastico**: `PlaneGeometry(460, 60, 460, 60)`, spostata sulla CPU con `hValle`, materiale del terreno (splat più isoipse oro ogni 50 m, direttrici ogni 250 m).

**Faccia di taglio**: `ShapeGeometry` sul piano z = +0,001, materiale "sezione" (§2.6).

- Il contorno va da y = −6 a `fondoValle(x)`, campionato ogni 0,5 u.
- È **forato**, solo sotto il profilo del terreno, dove ci sono le parti interrate delle centrali:
  - Francis: x da −37 a −29, y da 0,2 a 0,95;
  - Kaplan: x da 106 a 118, y da −1,8 a −0,40.
- Le parti fuori terra sono gli edifici stessi, tagliati da `Z0` con la campitura sul retro delle facce.
- **Sezioni d'acqua** (forme separate, `acqua` al 22%, linee di corrente sopra): lago alto, serbatoio Francis, fiume, pool.

**Righello**

- Linea verticale oro a x = −236, da y = 0 a y = 90 (0–900 m).
- Tacche ogni 50 m (0,6 u); tacche lunghe ogni 100 m (1,4 u) con numeri "0 … 900 m" su `CanvasTexture`.
- **Parentesi del salto**:
  - Pelton da 18,0 a 88,0 a x = −100, testo "700 m";
  - Francis da 2,0 a 17,0 a x = −46, testo "150 m";
  - Kaplan da 0,0 a 1,2 a x = 104, testo "12 m" (la parentesi minuscola è il messaggio).

| Elemento | Posizione (u) | Dimensioni e note (tutte le misure delle macchine in m, gruppo con scala 0,1) |
|---|---|---|
| Presa Pelton | (−176; 87; −0,2) | Torre in calcestruzzo 0,6 × 1,0 × 0,6 u |
| Condotta forzata Pelton | Asse a z = 0 (tagliata a metà dal piano), da (−175,5; 86,0) lungo `fondoValle + 0,06` fino a (−96; 18,6), poi orizzontale fino a (−93,5; 18,0; −0,4) | Ø 0,7 m (raggio 0,035 u), blocchi di ancoraggio ogni 10 u. Lunghezza ≈ 104 u (1,04 km) |
| Centrale Pelton | x da −98 a −86, y da 17,4 a 19,6, z da −2,4 a 2,4 (tagliata da z = 0) | Asse orizzontale lungo z |
| Girante Pelton | Centro (−92; 18,0; −0,4), piano ⟂ z | Ø primitivo 1,68 m, 22 cucchiai larghi 0,30 m, rotazione antioraria vista da +z |
| Ugello A | Getto orizzontale verso +x, tangente in basso: asse y = 17,916, da x = −92,25 all'impatto in x = −92,0 | Getto Ø 9,4 cm, spina e deviatore |
| Ugello B | Getto verticale verso −y, tangente a sinistra: asse x = −92,084, da y = 18,25 a 18,0 | Come A |
| Carter Pelton | Semicilindro, raggio 1,6 m, profondità 1,0 m | Piano di taglio proprio a z = −0,4: si vede la ruota |
| Generatore Pelton | Asse z da −1,0 a −1,5 | Cilindro Ø 3,5 m |
| Serbatoio Francis | Lago a y = 17,0 tra x = −86 e −42 | — |
| Diga ad arco | x da −42 a −38; coronamento 17,6, fondazione 2,0 | Spessore 4 m al coronamento e 25 m alla base. Arco in pianta di raggio 30 u, convesso verso monte. Estrusa da z = −18 a +18, tagliata da z = 0. |
| Condotta Francis | Dalla presa (−43; 9,0; 0) dentro la diga fino all'imbocco della chiocciola (−34,4; 2,0; −0,8) | Ø 1,55 m |
| Centrale Francis | x da −37 a −29, y da 0,2 a 3,4, z da −2,5 a 2,5 | Tagliata da z = 0 e dal piano orizzontale mobile `YF` |
| Girante Francis | Asse verticale, centro (−33; 2,0; −0,8) | D1 1,60 m, D2 1,26 m, 15 pale. Chiocciola: raggio di mezzeria da 2,6 a 1,7 m su 345°, sezione `0,775·√(1 − 0,9t)` m. 20 pale fisse dell'avantdistributore, 20 pale direttrici, tubo di aspirazione a gomito verso +x. |
| Traversa e centrale Kaplan | Traversa a x = 112 (profilo a "S"), pool 1,2, valle 0,0. Centrale a z da −3,5 a 0 | Calcestruzzo |
| Girante Kaplan | Asse verticale, centro (112; −0,4; −1,2) | Ø 4,5 m, mozzo Ø 1,9 m, 5 pale orientabili, 24 pale direttrici a raggio 3,6 m (altezza 1,8 m), semi-chiocciola in calcestruzzo (raggio esterno 12 m) tagliata dal piano `ZK` (z = −1,2), cono di aspirazione fino a y = −1,6 |
| Diagramma 4e | Gruppo con origine (−60; 2; 60), piano x-y rivolto a +z, 100 × 60 u | Vedi §4.5, tappa 4e |

**Piani di taglio** (oggetti `THREE.Plane`, in coordinate mondo, assegnati **fin dalla creazione**):

| Nome | Piano | Si applica a | Valore iniziale e animazione |
|---|---|---|---|
| `Z0` | normale (0,0,−1), costante 0: tiene z ≤ 0 | Edifici, condotte, diga, plastico | Fisso |
| `ZP` | normale (0,0,−1), costante −0,4 | Carter Pelton | Fisso |
| `YF` | normale (0,−1,0): tiene y ≤ c | Edificio, tetto e chiocciola Francis | Costante da 10 (nessun taglio) a 2,0 in T 13,80 → 13,90 |
| `ZK` | normale (0,0,−1), costante −1,2 | Semi-chiocciola e carter Kaplan | Fisso |

---

## 4. Coreografia, tappa per tappa

### 4.0 Il sistema di regia (vale per tutte le tappe)

**Durate.** La storia (`#storia`) è alta **2 000vh**: 19 schermi di scroll più l'ultima finestra.

| Tappa | id | Nome nell'indice | Durata (schermi) | T | Mondo | Lato del testo |
|---|---|---|---|---|---|---|
| 0 | `apertura` | 00 Territorio | 2,0 | 0,00 – 2,00 | PIANURA | sinistra |
| 1 | `sviluppo` | 01 Sviluppo | 3,0 | 2,00 – 5,00 | PIANURA | sinistra |
| 2 | `autorizzazione` | 02 Autorizzazioni | 2,5 | 5,00 – 7,50 | PIANURA | sinistra |
| 3 | `fotovoltaico` | 03 Fotovoltaico | 4,0 | 7,50 – 11,50 | PIANURA | sinistra |
| 4 | `idroelettrico` | 04 Idroelettrico | 4,0 | 11,50 – 15,50 | VALLE | sinistra |
| 5 | `costruzione` | 05 Cantiere e gestione | 2,0 | 15,50 – 17,50 | PIANURA | sinistra |
| 6 | `finale` | 06 Un referente | 1,5 | 17,50 – 19,00 | PIANURA | sinistra |

**Colonna del testo** (uguale in tutte le tappe):

- Livello fisso a sinistra: `left: clamp(24px, 6vw, 112px)`, larghezza `min(36vw, 600px)`, centrata in verticale con uno spostamento di −4vh.
- Il soggetto 3D sta **sempre** nei 2/3 di destra. Tutte le inquadrature sono state verificate per proiezione (Appendice C).
- Velo `.scrim`: `linear-gradient(90deg, rgba(5,6,7,.82) 0%, rgba(5,6,7,.62) 22%, rgba(5,6,7,0) 44%)`. La sua opacità segue la presenza del testo (0 → 1 in 0,04 T).
- Ombra del testo: `0 2px 24px rgba(5,6,7,.9)`.

**Rig della camera**

- Ogni keyframe è `{id, t0, t1, T:[x,y,z], d, phi, psi, fov, ancora:'target'|'camera', vicino, lontano}`.
- Tra `t0` e `t1` c'è la **sosta**: la camera è quasi ferma.
- Un **volo** va dal `t1` di una sosta al `t0` della successiva.
- I keyframe con `t0 = t1`, segnati "via", sono **passaggi** dentro un volo.

```js
// regia/camera.js — interpolazione normativa
// Dentro un volo [tA, tB] con passaggi (via) ai tempi Tk:
//   e = smootherstep(clamp((T - tA)/(tB - tA), 0, 1))   // 6e^5 − 15e^4 + 10e^3
//   w = tA + e*(tB - tA)                                // tempo "distorto": parte e arriva a velocità zero
//   segmento k tale che Tk <= w < Tk+1;  u = (w - Tk)/(Tk+1 - Tk)
// Posizioni: Catmull-Rom CENTRIPETO (THREE.CatmullRomCurve3, 'centripetal'), getPoint((k+u)/(n-1)).
//   Se tutti i punti del volo hanno ancora 'target' si interpolano i TARGET (movimento ad orbita);
//   se anche uno ha ancora 'camera' si interpolano le POSIZIONI P (necessario nei passaggi stretti).
// Scalari: d in scala logaritmica, phi, psi (prima "srotolato": differenze ridotte a ±180°), fov, vicino e lontano (log):
//   Catmull-Rom uniforme scalare sugli stessi nodi.
// In sosta: parametri del keyframe, più eventuale 'deriva' lineare (es. psi +40° in una sosta) indicata nelle tabelle.
// Poi, sempre: micro-deriva nel tempo (non nello scroll): psi ± 0,4° (periodo 23 s), phi ± 0,2° (31 s);
//   parallasse del mouse: psi ± 0,6°, phi ± 0,4°, smorzata con THREE.MathUtils.damp(…, λ=3, dt).
// Vincolo: P.y ≥ altezza(P.x, P.z) + 0,3 (solo PIANURA).
// Orientamento: camera.rotation.order = 'YXZ'; rotation.y = −rad(psi); rotation.x = −rad(phi); rotation.z = rollio.
// Rollio automatico nei voli: clamp(−0,004·dψ/dT, ±2°). Riduci movimento: 0.
// Schermi stretti: se aspect < 1,5 → fovV = 2·atan(tan(fov/2)·1,5/aspect), al massimo 75°.
```

**Testi.**

- I testi della storia sono livelli fissi (`.battuta`), uno per battuta, tutti presenti nel DOM in ordine di lettura. La timeline principale li accende e li spegne con lo stesso T della camera.
- **Ingresso** in 0,08 T, legato allo scroll:
  - le righe del titolo salgono da una maschera (`yPercent 110 → 0`, `expo.out`, sfalsate di 0,012 T per riga);
  - l'occhiello si "decodifica" (300 ms a tempo, lanciato all'attivazione);
  - il paragrafo passa da opacità 0 a 1 e da y 12px a 0.
- **Uscita** in 0,05 T: opacità 0, y −16px.
- I valori di ingresso e uscita delle tabelle sono il **T di inizio ingresso** e il **T di inizio uscita**.
- Regola di sincronia: il titolo inizia a entrare quando il volo è al 70%, così testo e camera "atterrano" insieme.

**Etichette 3D.** Al massimo 3 per volta. Entrano in 0,03 T: il gomito si disegna, poi compare il testo. Escono in 0,03 T.

**Stato condiviso.** `STATO` è l'oggetto di uniform e valori che la timeline scrive e il ciclo di disegno legge. Nomi e valori iniziali:

```js
const STATO = {
  // terreno (uniform condivise da terreno, alberi, fiume, cabine)
  uOnda:-10, uRealta:0, uFronteRealta:-1, uIso:1.0, uGriglia:0.8, uFiumeMappa:1,
  uV:[0,0,0,0,0],            // vincoli: paesaggistico, fluviale, PAI, archeologico, ambientale
  uIdonee:0, uSottrazione:0, uSito:0, uProprietari:0, uTrattativaFirmata:0, uAgriSel:0,
  uLayout:0, uLayoutApprovato:0, uOndaRame:-1, uRitraccia:-1, uNuvole:0, uNuvoleVel:1, uHover:0,
  // oggetti
  fogliGIS:[{y:22,o:0},{y:26,o:0},{y:30,o:0},{y:34,o:0},{y:38,o:0}],
  tende:0, percorso:0, cavo:0, impulsi:0, lunetta:0, sigillo:0, polvere:0,
  esplosione:1, comparsaFV:-0.1, comparsaAgri:-0.1, comparsaPali:1.1, comparsaTubi:1.1, comparsaModuli:1.1,
  ora:6.1667, tempoScala:1, quoteAgri:0, trattore:0,
  // idro
  righello:0, parentesi:0, YF:10, apertura:0, passoKaplan:-8, oscura:0, diagramma:0, colonne:0, giranti:0, retta10:0,
  // luce
  sole:{el:4, az:295, int:2.0, col:'#ffb46b'}, emisfera:0.06, envGlobale:0.55, esposizione:0.95,
  mixHDRI:0, nebbia:0.0018, velo:0, saturazione:1, maturita:0,
};
```

---

### 4.1 Tappa 0 · Apertura, "La carta diventa territorio" (T 0,00 – 2,00 · 2 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | Ancora | Posizione risultante P | vicino / lontano |
|---|---|---|---|---|---|---|---|---|---|
| K0.0 | 0,00 – 0,15 | (−30; 0; 0) | 1 150 | 89,5 | 90 | 16,1 | target | (−40,04; 1 149,96; 0,00) | 5 / 4 000 |
| K0.1 | 1,55 – 2,00 | (−12,6; 0; −27,8) | 300 | 24 | 12 | 37,8 | target | (−69,58; 122,02; 240,27) | 0,5 / 4 000 |

- **K0.0**: vista zenitale quasi ortografica (85 mm). In alto sullo schermo c'è l'Est, il fiume corre orizzontale al 58% dell'altezza e il sito sta al 35%.
- **Volo 0,15 → 1,55**: la camera si inclina da 89,5° a 24° e ruota la rotta da 90° a 12° (−78°). La distanza scende da 1 150 a 300, il fov si apre da 16,1° a 37,8°. È un dolly-zoom percepito: "la prospettiva nasce davanti all'utente".

**Eventi legati allo scroll**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| H1 e lead | 0,55 → 0,60 | uscita | — | Il titolo resta mentre la carta è ferma |
| `uOnda` (sollevamento radiale da SITO_C) | 0,20 → 1,25 | −10 → 360 u | power2.inOut | `lift(d) = 1 − smoothstep(uOnda−70, uOnda, d)`; altezza visualizzata = `aAltezza·lift`. Ogni isoipsa resta alla sua quota originale. |
| `uRealta` (carta → PBR) | 0,55 → 1,35 | 0 → 1 | power2.inOut | Inchiostro `#0b0f12` più ombreggiatura cartografica da NO (315°/45°) → splat PBR illuminato dal sole radente |
| `uFiumeMappa` (fiume disegnato come linea) | 0,90 → 1,30 | 1 → 0 | none | Passa il testimone al nastro d'acqua |
| Nastro del fiume, opacità | 0,95 → 1,35 | 0 → 1 | none | — |
| `uIso` | 0,00 → 2,00 | 1,0 → 0,75 | none | — |
| `uGriglia` | 0,00 → 1,40 | 0,8 → 0,55 | none | — |
| Alberi, cabine, CP, capannone, ponte, traversa | seguono `lift` | — | — | Stessa patch `sollevamento` del vertex shader (istanze) oppure `position.y` da JS |
| Ombre | 0,20 → 1,30 | aggiornate a ogni fotogramma | — | `adattaOmbra(SITO_C, meta = 190)`, mappa intera. Le ombre delle colline si allungano mentre il rilievo cresce: sole a 4°/295°. |
| `maturita` (HUD) | 1,25 → 1,55 | 0 → 5 % | none | Tappa: "Territorio" |

- **Animazioni continue**: riflessi del fiume (normal che scorrono), micro-deriva della camera.
- **Etichette 3D**: nessuna. Il WOW deve respirare.
- **HUD**: coordinate e quota della camera (scala "1:10 000 → 1:2 000" in 0,15 → 1,55), barra di scala reale, maturità.

**Testo HTML** (sinistra, già visibile all'uscita dall'intro, uscita a T 0,55)

- Occhiello: `Energie Rinnovabili Italia`
- H1: `Dalla particella<br><em>al Ready to Build.</em>`
- Lead: `Sviluppiamo impianti fotovoltaici, agrivoltaici e idroelettrici. Dal primo esame del terreno al progetto autorizzato, pronto da costruire.`
- Segnale: `Scorri`, con la goccia oro del v1.

**Transizione verso la tappa 1**: l'orbita del volo K0.1 → K1.1 (−172° di rotta, passando per Est). Mentre la camera gira compaiono i fogli GIS.

---

### 4.2 Tappa 1 · Sviluppo (T 2,00 – 5,00 · 3 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | Ancora | P risultante |
|---|---|---|---|---|---|---|---|---|
| K1.0 (via) | 2,45 | (−8,7; 0; 26,0) | 340 | 40 | 200 | 37,8 | target | (80,38; 218,55; −218,75) |
| K1.1 | 3,15 – 3,30 | (−4,2; 0; 32,3) | 330 | 38 | 222 | 37,8 | target | (169,80; 203,17; −160,95) |
| K1.2 | 3,55 – 4,15 | (27,0; 1,2; 23,4) | 95 | 34 | 236 | 37,8 | target | (92,29; 54,32; −20,64) |
| K1.3 | 4,40 – 4,95 | (20,6; 1,2; 22,9) | 125 | 62 | 270 | 27,0 | target | (79,28; 111,57; 22,90) |

- vicino / lontano: 0,5 / 4 000 per K1.0 e K1.1; 0,2 / 3 000 per K1.2 e K1.3.
- Da K1.0 a K1.1 la camera fa un'orbita lenta (rotta da 200° a 222°) a quota quasi costante, come uno scanner che legge il territorio.
- **K1.0 e K1.1**: si guarda verso sud-ovest dal crinale. In proiezione: fiume a sx 0,63–0,65, area paesaggistica a 0,70–0,73, archeologico a 0,61–0,69, sito a 0,45–0,49. Il sole (az 297°) è fuori campo a destra: luce radente laterale.
- **K1.2**: il sito sta tra sx 0,46 e 0,86. Il sole è basso e fuori campo a destra.
- **K1.3**: sito dall'alto a 62°, visto da est. Le file nord-sud appaiono orizzontali sullo schermo e il "plotter" disegna da destra (punto di connessione) verso sinistra.

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| Lunetta (60 tacche, raggio 32 u attorno a SITO_C) | 2,00 → 2,10 | opacità 0 → 1 (tacche spente ×0,25) | none | Le tacche si accendono con la maturità |
| Fogli GIS 0–4, comparsa | 2,30 → 2,45 | opacità 0 → 0,55, sfalsati di 0,02 | none | Piani 360 × 360 u alle quote y = 22, 26, 30, 34, 38. `CanvasTexture` con il motivo del vincolo, cornice oro di 1 px e titolo in Plex Mono nell'angolo. `MeshBasicMaterial` trasparente, `depthWrite:false`, `noAO`. |
| Foglio 0 Paesaggistico | 2,55 → 2,65 discesa; 2,63 → 2,67 timbro | y 22 → quota; `uV[0]` 0 → 1; opacità foglio 0,55 → 0 | power2.in (discesa), none | All'impatto: lampo emissivo ×1,5 per 0,02 T. In HTML si spunta la voce 1 della legenda. |
| Foglio 1 Fascia fluviale | 2,67 → 2,77; 2,75 → 2,79 | `uV[1]` 0 → 1 | idem | Voce 2 |
| Foglio 2 Idrogeologico PAI | 2,79 → 2,89; 2,87 → 2,91 | `uV[2]` 0 → 1 | idem | Voce 3 |
| Foglio 3 Archeologico | 2,91 → 3,01; 2,99 → 3,03 | `uV[3]` 0 → 1 | idem | Voce 4 |
| Foglio 4 Ambientale Natura 2000 | 3,03 → 3,13; 3,11 → 3,15 | `uV[4]` 0 → 1 | idem | Voce 5 |
| `maturita` | 2,55 → 3,15 | 5 → 20 % | none | Tappa: "Screening" |
| **Sottrazione**: `uSottrazione` | 3,15 → 3,30 | 0 → 1 | power2.inOut | Tutto ciò che non è idoneo scende al **15%** di luminanza |
| `uIdonee` | 3,15 → 3,30 | 0 → 1 | power2.inOut | Smeraldo × 0,35 più bordo × 1,4 |
| `uV[0..4]` | 3,30 → 3,55 | 1 → 0,25 | none | I vincoli restano come memoria |
| `uIdonee` | 3,30 → 3,55 | 1 → 0,4 | none | — |
| `uSito` (particelle 112–118 in oro) | 3,50 → 3,60 | 0 → 1 | none | — |
| `tende` (tende di luce sui confini delle 7 particelle) | 3,55 → 3,70 | altezza 0 → 0,8 u | expo.out | A e B oro pieno; C (117–118) contorno pulsante a 1,2 Hz |
| `percorso` (sopralluogo, tratteggio oro con un punto che avanza) | 3,65 → 3,85 | 0 → 1 | none | (41,−33) → (41,−12,5) → (22, 5) |
| `uTrattativaFirmata` | 3,95 → 4,05 | 0 → 1 | none | Le particelle di C si riempiono; il pulsare si ferma con un lampo ×2 |
| `maturita` | 3,55 → 4,05 | 20 → 35 % | none | Tappa: "Proprietari" |
| `tende` | 4,15 → 4,30 | 0,8 → 0 u | power2.in | — |
| `uLayout` (plotter) | 4,42 → 4,85 | 0 → 1 | none | Ordine: recinzione → viabilità → 308 tracker come linee N-S tratteggiate → cabine al cancello → punto di connessione. Tempo di ogni segmento = distanza del suo centro dal punto di connessione (40,5; −12,5). Punta luminosa ×6. |
| `maturita` | 4,42 → 4,85 | 35 → 45 % | none | Tappa: "Layout" |
| Sole | 2,00 → 5,00 | el 4° → 1,5°; az 295° → 298°; intensità 2,0 → 1,2 | none | Grading con saturazione 0,85 |
| Esposizione | 2,00 → 5,00 | 0,95 → 0,88 | none | — |
| Ombre | sempre | `meta` = 190 (K1.0–K1.1), 60 (K1.2–K1.3), aggiornate solo quando cambia il sole | — | — |

- **Animazioni continue**: punta del plotter, impulsi delle tende (scanline che salgono a 0,4 u/s), pulsare di C, fiume.
- **Interazione**: tra T 2,0 e 5,0 il cursore-mirino su una particella la evidenzia (`uHover` = id) e mostra "Fg. 27 · P.lla 114 · 2,95 ha · idonea".

**Etichette 3D**

| T | Testo (nome / dato) | Ancora (x, y, z) | Colore |
|---|---|---|---|
| 3,20 – 3,52 | Area idonea / pendenza < 5 % · nessun vincolo | (21,7; 1,4; 5,4) | smeraldo |
| 3,22 – 3,52 | Fascia di rispetto fluviale / 150 m dalle sponde | (fiumeX(−20)+12; h; −20) | acqua |
| 3,24 – 3,52 | Vincolo paesaggistico / D.Lgs. 42/2004 | (−112; h+0,5; 18) | vincolo |
| 3,60 – 4,15 | Fg. 27 · P.lle 112–118 / 14,00 ha · 3 proprietari | (21,7; 2,2; 5,4) | oro |
| 3,66 – 4,15 | Sopralluogo / accesso dalla strada poderale | (33,4; h+0,3; −5,5), sul percorso | oro |
| 3,70 – 4,15 | P.lle 117–118 / in trattativa → **diritto firmato** (cambia a 4,00) | (25,1; 1,8; 15,9) | oro |
| 4,60 – 4,95 | Primo layout / 10,4 MWp · 308 tracker · pitch 6,0 m · GCR 0,40 | (21,7; 1,6; 5,4) | oro |
| 4,66 – 4,95 | Punto di connessione / cabina di consegna MT | (40,5; h+0,4; −12,5) | oro |

**Testi HTML** (sinistra)

| Battuta | Ingresso / uscita | Contenuto |
|---|---|---|
| 1a | 2,50 / 3,30 | Occhiello `01 · Sviluppo` · H2 `Prima si legge <em>il territorio.</em>` · P `Sovrapponiamo alle particelle catastali i vincoli paesaggistici, idrogeologici, archeologici e ambientali. Quello che resta libero è l'area idonea.` · Legenda (campione del motivo più testo, ogni voce si spunta al timbro): `Paesaggistico · D.Lgs. 42/2004` · `Fascia fluviale · 150 m` · `Idrogeologico · PAI` · `Archeologico · area di rispetto` · `Ambientale · Natura 2000`. A T 3,20 compare `Area idonea` in smeraldo. |
| 1b | 3,62 / 4,18 | Occhiello `01 · Sviluppo · Proprietari` · H2 `Poi si incontrano <em>le persone.</em>` · P `Sopralluoghi sul posto e incontri con i proprietari terrieri. Accordi chiari sul diritto di superficie, particella per particella.` · Legenda: `● Diritto di superficie firmato` · `○ In trattativa` |
| 1c | 4,48 / 5,02 | Occhiello `01 · Sviluppo · Layout` · H2 `Il primo layout, <em>sul terreno vero.</em>` · P `Sulle aree idonee disegniamo la prima disposizione dell'impianto: file di tracker, distanze, accessi, cabine e punto di connessione.` · Dato (mono): `10,4 MWp · 308 tracker · moduli 650 Wp · dati illustrativi` |

**Transizione verso la tappa 2**: volo 4,95 → 5,25 all'indietro e verso nord-ovest. La luce comincia a virare all'ora blu.

---

### 4.3 Tappa 2 · Autorizzazione e connessione (T 5,00 – 7,50 · 2,5 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | Ancora | P risultante |
|---|---|---|---|---|---|---|---|---|
| K2.0 | 5,25 – 5,95 | (34,3; 0; −4,0) | 230 | 32 | 329 | 37,8 | target | (134,76; 121,88; 163,19) |
| K2.1 | 6,20 – 6,80 | (51,4; 0; −36,2) | 170 | 30 | 350 | 37,8 | target | (76,97; 85,00; 108,79) |
| K2.2 | 7,00 – 7,45 | (−3,4; 1,2; 5,8) | 150 | 66 | 0 | 37,8 | target | (−3,40; 138,23; 66,81) |

- vicino / lontano: 0,5 / 4 000.
- **K2.0**: sito a sx 0,39–0,50, cabina primaria a 0,89.
- **K2.1**: tutto il tracciato del cavo, dalla cabina di consegna (sx 0,42) alla CP (sx 0,87).
- **K2.2**: sito dall'alto, a sx 0,52–0,76.

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| Sole | 5,00 → 7,45 | el −2° → −6°; az 300° → 305°; intensità 0 | none | Ora blu |
| Cielo | 5,00 → 5,60 | tramonto → ora blu | none | — |
| Emisfera | 5,00 → 5,60 | 0,06 → 0,35 | none | — |
| Esposizione | 5,00 → 7,45 | 0,80 → 0,62 | none | — |
| `uRealta` | 5,05 → 5,60 | 1 → 0,30 | power2.inOut | Il territorio torna "carta": un plastico d'inchiostro e grafite su cui l'oro porta l'inquadratura |
| `uIso` | 5,05 → 5,60 | 0,75 → 1,2 | none | — |
| `uSottrazione` / `uIdonee` | 5,05 → 5,60 | 1 → 0,5 / 0,4 → 0,2 | none | — |
| Diagramma a binari (HTML, battuta 2a) | 5,30 → 5,90 | riempimento 0 → 1 | none | Progetto ● → binario **AU** acceso (oro). PAS tratteggiato e spento. Etichetta "+ VIA quando richiesta" tratteggiata. Nodo "Titolo" ancora vuoto. |
| `maturita` | 5,30 → 5,90 | 45 → 65 % | none | Tappa: "Iter" |
| `cavo` (cavidotto: la linea si disegna dalla cabina di consegna alla CP) | 6,22 → 6,62 | 0 → 1 | none | Rame × 2,6, 2 px |
| `impulsi` | 6,62 → fine tappa | 0 → 1 | none | Impulsi oro-chiaro a 6 u/s verso la CP, uno ogni 4 u |
| Luci della CP | 6,55 → 6,65 | emissivo 0 → 3 | none | Finestre e lampioni caldi `#ffb46b` |
| Corsie HTML (battuta 2b) | 6,30 / 6,45 / 6,60; GSE 6,50 → 6,70 | passi accesi in sequenza | none | "Richiesta" → "Preventivo (STMG)" → "Accettazione" · "GSE · pratiche e portali" |
| `maturita` | 6,25 → 6,70 | 65 → 85 % | none | Tappa: "Connessione" |
| `lunetta` e `maturita` | 7,00 → 7,10 | 85 → 100 % | none | Le ultime tacche si accendono in senso orario da nord. A 100%: lampo ×4 per 0,02 T. Il nodo "Titolo" del diagramma si accende. |
| `sigillo` (decalcomania circolare a terra, diametro 26 u, rame) | 7,10 → 7,18 | y 3,0 → 0,02 sopra 1,2; scala 1,15 → 1,0 | power4.in | `CanvasTexture` 2048²: anello doppio, "READY TO BUILD" in Bodoni maiuscolo, "Fg. 27 · P.lle 112–118 · titolo autorizzativo" in Plex Mono. `polygonOffset −2`. |
| `polvere` | 7,18 → 7,30 | anello di 400 punti, raggio 0 → 6 u, alfa 0,6 → 0 | expo.out | — |
| `uOndaRame` (anello rame sul terreno, largo 3 u) | 7,18 → 7,42 | −1 → 140 u | power2.out | Rame × 2,6 |
| `uLayoutApprovato` | 7,20 → 7,26 | 0 → 1 | none | Le linee del layout passano da tratteggiate a continue |
| Ombre | sempre | sole sotto l'orizzonte: niente ombre dirette; `shadowMap` ferma | — | — |

- **Animazioni continue**: impulsi sul cavo, luci della CP, isoipse.
- **Etichette 3D**:
  - 6,30 – 6,85: `Cabina primaria AT/MT` / `punto di connessione alla rete`, a (128; h+1,2; −56);
  - 6,34 – 6,85: `Cavidotto MT interrato` / `≈1,2 km lungo la viabilità esistente`, a (84; h+0,3; −35).
  - Nella battuta 2c non c'è nessuna etichetta: il sigillo è il messaggio.

**Testi HTML** (sinistra)

| Battuta | Ingresso / uscita | Contenuto |
|---|---|---|
| 2a | 5,30 / 6,00 | Occhiello `02 · Autorizzazione e connessione` · H2 `Il percorso giusto, <em>non il più lungo.</em>` · P `PAS o Autorizzazione Unica, con VIA quando richiesta: dipende da taglia, area e vincoli. Prepariamo progetto e relazioni specialistiche e seguiamo enti e conferenza dei servizi fino al titolo.` · Diagramma a binari (SVG, 1 px): `Progetto` → `PAS · procedura abilitativa semplificata` (tratteggiato) / `AU · Autorizzazione Unica` (acceso) con l'etichetta `+ VIA quando richiesta` → `Titolo autorizzativo` · Nota mono: `Esempio: Autorizzazione Unica` |
| 2b | 6,28 / 6,85 | Occhiello `02 · Connessione` · H2 `In parallelo, <em>la rete.</em>` · P `Richiesta di connessione, preventivo (STMG) e accettazione sui portali del gestore di rete. Sui portali del GSE seguiamo le pratiche dell'impianto.` · Due corsie parallele (SVG): `Connessione · richiesta → preventivo (STMG) → accettazione` e `GSE · pratiche e portali` |
| 2c | 7,08 / 7,46 | Occhiello `02 · Titolo` · H2 `.grande`: `<em>Ready to Build.</em>` · P `Titolo autorizzativo, connessione accettata, diritti sui terreni: il progetto è pronto da costruire.` |

**Transizione verso la tappa 3** ("notte breve", T 7,45 – 7,60):

1. Esposizione 0,62 → 0,45 in 7,45 → 7,52.
2. **A T = 7,52, nel fotogramma più scuro**:
   - nuova cottura PMREM con qwantani ruotata per l'alba (`uRot = rad(57 − azHDRI)`);
   - il sole salta a −1°/56°, invisibile perché sotto l'orizzonte;
   - il cielo passa al preset alba.
3. Esposizione 0,45 → 0,80 in 7,52 → 7,62.
4. Il volo K2.2 → K3.0 (7,45 → 7,60) scende verso il suolo.
5. La maturità nell'HUD si chiude in un'etichetta `● RTB` (7,60).

---

### 4.4 Tappa 3 · Fotovoltaico e agrivoltaico (T 7,50 – 11,50 · 4 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | Ancora | P risultante | vicino / lontano |
|---|---|---|---|---|---|---|---|---|---|
| K3.0 | 7,60 – 7,90 | (26,4; 1,2; −12,1) | 60 | 8 | 30 | 37,8 | target | (−3,31; 9,55; 39,36) | 0,2 / 3 000 |
| K3.1 | 8,10 – 8,70 | (20,2; 1,36; 10,2) | 3,4 | 18 | 45 | 27,0 | target | (17,91; 2,41; 12,49) | 0,02 / 1 500 |
| K3.2 (via) | 8,95 | (15,7; 1,36; 2,0) | 55 | 24 | 20 | 37,8 | target | (−1,48; 23,73; 49,21) | 0,2 / 3 000 |
| K3.3 | 9,15 – 9,30 | (17,0; 1,36; 4,0) | 34 | 9 | 0 | 37,8 | target | (17,00; 6,68; 37,58) | 0,1 / 3 000 |
| K3.4 (via) | 9,55 | (18,1; 1,36; 10,7) | 40 | 30 | 285 | 37,8 | target | (51,56; 21,36; 19,67) | 0,1 / 3 000 |
| K3.5 | 9,95 – 10,08 | (27,5; 1,36; 7,7) | 46 | 70 | 180 | 37,8 | target | (27,50; 44,59; −8,03) | 0,2 / 3 000 |
| K3.6 (via) | 10,40 | (90,8; 1,0; 25,7) | 42 | 20 | 80 | 37,8 | target | (51,93; 15,36; 32,55) | 0,1 / 3 000 |
| K3.65 (via) | 10,58 | (82,03; −3,40; 26,88) | 17,5 | 25 | 350 | 45,0 | **camera** | (84,78; 4,00; 42,50) | 0,02 / 2 000 |
| K3.7 | 10,70 | (81,75; 2,27; 23,31) | 17,5 | −4 | 350 | 53,1 | **camera** | (84,78; 1,05; 40,50) | 0,02 / 2 000 |
| K3.8 | 11,30 | (81,75; 2,27; 19,31) | 17,5 | −4 | 350 | 53,1 | **camera** | (84,78; 1,05; 36,50) | 0,02 / 2 000 |
| K3.9 | 11,50 | (76,52; 3,97; −60,0) | 95 | 4 | 355 | 45,0 | **camera** | (84,78; 10,60; 34,40) | 0,1 / 3 000 |

- **K3.0** (alba): camera bassa a sud-ovest del sito, verso nord-nord-est. Il sole che sorge (az 57°) sta a sx 0,93, sy 0,28, fuori dalla colonna del testo.
- **K3.1** (vista esplosa, 50 mm): vista di 3/4 da sud-ovest sul centro del tracker eroe (motoriduttore a sx 0,62, sy 0,57). Il sole è davanti a destra, sopra il bordo del quadro: controluce che disegna i profili.
- **K3.3 → K3.4 → K3.5 → K3.6 → K3.7**: un **giro completo di 360°** attorno al campo (rotta 0 → 285 → 180 → 80 → 350, sempre decrescente) mentre il sole va da est a ovest.
  - **K3.3**: da sud, bassa, lungo le file. La rotazione est-ovest si legge da destra a sinistra.
  - **K3.4**: da est, con le facce dei moduli verso la camera e il sole alle spalle.
  - **K3.5**: da nord, alta, con elevazione di vista di 70,8° sul centro del campo. È esattamente la riflessione speculare del sole di mezzogiorno (71,45°), quindi l'**onda di riflessi** passa sotto la camera.
  - **K3.6 / K3.65**: da ovest, poi giù verso l'agrivoltaico.
- **K3.65 → K3.7 → K3.8**: discesa verticale **dentro il vicolo** x = 84,78. Le posizioni si interpolano sulla camera, perché il vicolo è largo soltanto 0,87 u.
- **K3.8 → K3.9**: gru verticale fuori dalla tettoia, verso nord.

**L'orologio solare** (§6.3, `posizioneSole`): 21 giugno 2026, lat 42,0° N, lon 12,5° E, ora legale.

- `ora(T)` è lineare a tratti:
  - 7,60 → 05:34 (alba);
  - 8,70 → 06:00;
  - 9,15 → 06:10;
  - 9,55 → 09:40;
  - 9,95 → 13:11 (mezzogiorno solare);
  - 10,40 → 17:30;
  - 11,30 → 19:00;
  - 11,50 → 19:15.
- Il sole, l'angolo dei tracker FV (GCR 0,40) e agrivoltaici (GCR 0,24), lo stato (`INSEGUIMENTO` / `BACKTRACKING` / `FINE CORSA`) e i numeri dell'HUD vengono **dalla stessa funzione**. Valori di controllo in Appendice A.

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| **3a-i · Alba della materia**: `uFronteRealta` | 7,62 → 7,88 | −1 → 300 u da SITO_C | power2.inOut | Dietro il fronte `uRealta` passa da 0,30 a 1. Bordo del fronte: oro × 3, largo 4 u. |
| Sole | 7,60 → 8,10 | el −1° → 3,3°; az 56° → 61°; intensità 0 → 1,6; colore `#ff8a4c` → `#ff9d5c` | none | — |
| `uIso` | 7,62 → 7,90 | 1,2 → 0,6 | none | — |
| Sigillo e lunetta | 7,62 → 7,75 | opacità 1 → 0 | none | — |
| `uLayoutApprovato` (linee del layout) | 7,75 → 8,70 | 1 → 0,3 | none | Diventano il "doppio" tenue sotto le file |
| GTAO `blendIntensity` | 7,95 → 8,10 | 0 → 0,9 | none | Raggio 0,012 u, solo nel primo piano |
| Tracker eroe, comparsa | 7,92 → 8,08 | scala dei pezzi 0 → 1, con `esplosione` = 1 (pezzi sospesi e separati) | expo.out | Il resto del campo non c'è ancora |
| **3a-ii · Vista esplosa**: `esplosione` | 8,15 → 8,60 | 1 → 0 | per pezzo `power4.out` | Ordine e sfalsamento: pali (0,00) → cuscinetti (0,08) → tubo di torsione (0,16) → ralla e motoriduttore (0,24) → controllore (0,32) → 56 moduli (0,40 → 0,90, dal centro verso le estremità, 0,009 ciascuno). `pos = base + offset·(1 − easeOut(clamp((1−e)·1,6 − i·0,08, 0, 1)))`. Offset: pali −1,2 m in y; cuscinetti +0,8 m in y; tubo +1,6 m in y; motoriduttore +0,9 m in x; controllore +1,0 m in x e +0,6 m in y; moduli +2,4 m in y più 0,3 m in x alternati. |
| Modulo che si gira (retro bifacciale) | 8,56 → 8,66 | rotazione attorno al lato lungo 0 → 180° → 0 | power2.inOut | Il modulo accanto alla ralla, lato sud |
| **3b-i · Onda**: `comparsaFV` | 8,72 → 8,98 | −0,1 → 1,1 | none | Per istanza: `s = smoothstep(k, k+0,1, comparsa)` con `k` = distanza normalizzata dal tracker eroe. Scala più salita da −0,2 m. |
| `comparsaAgri` | 8,80 → 9,00 | −0,1 → 1,1 | none | `k` = distanza da AGRI_C |
| GTAO | 8,70 → 8,85 | 0,9 → 0,3 | none | — |
| **3b-ii · Orologio**: `ora` | 9,15 → 10,40 | 06:10 → 17:30 | lineare a tratti | Ombre aggiornate a ogni fotogramma con T in movimento. `meta` = 26, centrato sul target. |
| Miscela HDRI qwantani → kloofendal | 9,15 → 9,60 | uMix 0 → 1 (cotture a 9,15 / 9,26 / 9,37 / 9,48 / 9,60) | none | — |
| Cielo | 9,15 → 9,60 / 10,10 → 10,40 | alba → giorno scuro / giorno scuro → pomeriggio | none | — |
| Esposizione | 9,15 → 9,95 → 10,40 | 0,85 → 1,00 → 0,95 | none | — |
| Avviso HUD "mezzogiorno" | 9,93 → 10,10 | visibile | — | `13:11 · MEZZOGIORNO SOLARE · ELEVAZIONE 71,4°` |
| **3c · Agrivoltaico**: miscela kloofendal → autumn_field | 10,40 → 10,70 | 4 cotture | none | — |
| `quoteAgri` (quote 3D in oro) | 10,72 → 10,80 | 0 → 1 | expo.out | Tre linee di quota alla fila 16 (x = 85,28, z = 33): suolo → asse (4,50 m); suolo → bordo inferiore (3,46 m a 60°); suolo → cima della sagoma del trattore (2,90 m) |
| `trattore` (sagoma tecnica in linee oro, ingombro 4,5 × 2,4 × 2,9 m) | 10,78 → 11,22 | z 24,0 → 39,5 lungo x = 84,95 | none | `LineSegments2`: scatola più ruote come cerchi più cabina. Avanza verso la camera e si ferma a 1 u da lei. |
| Colture | sempre in 3c | vento: spostamento `0,04 u·sin(t·1,6 + x·0,7)·h²` | — | Strisce istanziate (§6.6) |
| Ombre | 10,58 → 11,30 | `meta` = 10, centrato sul vicolo | — | Strisce d'ombra nette sulle colture |
| Uscita: densità della nebbia | 11,32 → 11,50 | 0,003 → 0,02 | power2.in | "Foschia al 100%" |
| `velo` | 11,42 → 11,50 | 0 → 1 | none | A T = 11,50 si cambia scena (VALLE) |

- **Animazioni continue**: tracker che seguono l'ora; colture al vento; fiume; impulsi assenti.
- **Onda di riflessi a mezzogiorno**: è fisica (riflesso speculare del sole sul clearcoat) e non usa trucchi. Deve vedersi bene in K3.5: è una prova di accettazione (§6.13).

**Etichette 3D** (vista esplosa: al massimo 3 per volta)

| T | Nome / dato | Ancora (coordinate locali del tracker eroe, poi mondo) |
|---|---|---|
| 8,16 – 8,32 | Palo infisso / acciaio zincato · profilo H | Testa del palo centrale |
| 8,22 – 8,40 | Tubo di torsione / asse nord–sud | Tubo a +1,5 m dal centro |
| 8,30 – 8,46 | Cuscinetto / rotazione ±60° | Cuscinetto a −8 m |
| 8,38 – 8,54 | Ralla e motoriduttore / un motore per tracker | Motoriduttore |
| 8,46 – 8,62 | Controllore / inclinometro e backtracking | Scatola del controllore |
| 8,52 – 8,70 | Modulo bifacciale vetro-vetro / 650 Wp · 144 mezze celle | Modulo girato |
| 10,74 – 11,30 | Asse dei tracker / 4,50 m | Metà della quota 1 |
| 10,76 – 11,30 | Bordo inferiore / ≈3,5 m anche a 60° | Metà della quota 2 |
| 10,80 – 11,30 | Mezzo agricolo / ingombro 2,9 m | Cima della sagoma |

**HUD · strumento solare** (in basso a destra, T 9,15 – 11,45)

- Valori: `ORA 09:40 · ELEVAZIONE 42,7° · AZIMUT 95,9° · TRACKER −47,1° · INSEGUIMENTO`.
- Un mini-spaccato SVG di 3 file (linee di 2,4 m su pali, passo 6 m) ruota con l'angolo reale; un raggio oro segna il sole proiettato nel piano est-ovest.
- In backtracking le ombre delle file (grigio al 40%) arrivano a toccare la fila successiva senza coprirla.

**Testi HTML** (sinistra)

| Battuta | Ingresso / uscita | Contenuto |
|---|---|---|
| 3a | 8,16 / 8,72 | Occhiello `03 · Fotovoltaico · Tecnologia` · H2 `Ogni componente, <em>scelto.</em>` · P `Confrontiamo moduli, strutture e tracker sul mercato e scegliamo la tecnologia giusta per il sito: rendimento, affidabilità, costo nel tempo.` |
| 3b | 9,20 / 10,02 | Occhiello `03 · Fotovoltaico · Il sole` · H2 `Moduli che <em>seguono il sole.</em>` · P `Tracker monoassiali con asse nord–sud: dall'alba al tramonto i moduli ruotano da est a ovest. Al mattino e alla sera si raddrizzano, così una fila non fa ombra all'altra.` · Dato: `21 giugno · 42° N · GCR 0,40 · ±60° · simulazione` |
| 3c | 10,78 / 11,32 | Occhiello `03 · Agrivoltaico` · H2 `Energia sopra, <em>raccolto sotto.</em>` · P `Nell'agrivoltaico l'asse dei tracker sale a 4,5 metri. Sotto si continua a coltivare e passano i mezzi agricoli.` · Dato: `asse 4,50 m · bordo inferiore ≈3,5 m a 60° · 2,4 MWp · dati illustrativi` |

**Transizione verso la tappa 4**: gru verso nord, foschia al 100% e velo nero. **A T = 11,50 la scena cambia** (`renderPass.scene = VALLE`, la camera passa a V4.0, `scene.fog` è quello della Valle). Poi, da 11,50 a 11,65, il velo va da 1 a 0 e la nebbia da 0,02 a 0,00025.

---

### 4.5 Tappa 4 · Idroelettrico, "La stessa valle, tre salti" (T 11,50 – 15,50 · 4 schermi, scena VALLE)

**Regola di lettura**, uguale in tutta la tappa e ripetuta nella legenda dell'HUD:

- **altezza = salto** (righello in scala vera);
- **numero di linee di corrente ∝ portata**: `N = max(2, round(Q/1,6))`, cioè Pelton 2, Francis 5, Kaplan 59;
- **velocità delle linee ∝ √(2gH)**: `v = 0,05·√(2gH)` u/s, cioè Pelton 5,86, Francis 2,71, Kaplan 0,77 (rapporto 7,6 : 3,5 : 1).

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | P risultante | vicino / lontano |
|---|---|---|---|---|---|---|---|---|
| V4.0 | 11,50 – 12,05 | (−140; 60; −20) | 1 600 | 8 | 0 | 16,1 | (−140,00; 282,68; 1 564,43) | 20 / 6 000 |
| V4.1 (via) | 12,25 | (−168; 82; −2) | 40 | 12 | 350 | 37,8 | (−161,21; 90,32; 36,53) | 0,2 / 3 000 |
| V4.2 (via) | 12,55 | (−125; 45; −1) | 22 | 18 | 340 | 37,8 | (−117,84; 51,80; 18,66) | 0,1 / 3 000 |
| V4.3 | 12,80 | (−92; 18,0; −0,4) | 1,5 | 6 | 0 | 37,8 | (−92,00; 18,16; 1,09) | 0,01 / 1 500 |
| V4.4 | 13,00 – 13,30 | (−92,02; 17,916; −0,4) | 0,12 | 4 | 345 | 22,0 | (−91,99; 17,92; −0,28) | 0,005 / 800 |
| V4.5 (via) | 13,55 | (−62; 10; −3) | 70 | 14 | 0 | 37,8 | (−62,00; 26,93; 64,92) | 0,2 / 3 000 |
| V4.6 | 13,80 – 14,15 | (−33; 2,0; −0,8) | 1,4 | 60 | 0 | 37,8 | (−33,00; 3,21; −0,10) | 0,01 / 1 500 |
| V4.7 | 14,40 – 14,75, deriva ψ +40° | (112; −0,4; −1,2) | 2,6 | 22 | 340 → 20 | 37,8 | (112,82; 0,57; 1,07) a ψ 340 | 0,01 / 1 500 |
| V4.8 | 15,00 – 15,38, deriva ψ −4° → +4° | (−33,5; 32; 60) | 120 | 3 | 0 | 37,8 | (−33,50; 38,28; 179,84) | 0,5 / 4 000 |

- **V4.0**: il plastico intero, da x = −236 (righello) a x = 230, occupa sx 0,38–0,96. È quasi un prospetto tecnico (85 mm).
- **V4.0 → V4.3**: **la discesa del salto**. Si scende lungo la condotta forzata (passaggi V4.1, V4.2) fino alla sala macchine Pelton tagliata.
- **V4.4**: macro di 1,2 m sul punto d'impatto del getto A, in basso sulla circonferenza primitiva.
- **V4.5**: si esce lungo il canale di scarico; vista del serbatoio e della diga in sezione.
- **V4.6**: dall'alto a 60° sulla chiocciola Francis, tagliata a metà dal piano orizzontale `YF`.
- **V4.7**: dentro la centrale Kaplan tagliata. Orbita di 40° durante la sosta.
- **V4.8**: indietro, davanti al diagramma (centro del diagramma a sx 0,66).

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| `velo` / nebbia | 11,50 → 11,65 | 1 → 0 / 0,02 → 0,00025 | power2.out | — |
| `righello` | 11,66 → 11,80 | 0 → 1 | none | La linea sale da 0 a 900 m; le tacche compaiono al passaggio |
| `parentesi` | 11,80 → 11,95 | 0 → 1 (Pelton, Francis, Kaplan, sfalsate di 0,04) | expo.out | — |
| Linee di corrente | sempre | — | — | Quad istanziati che scorrono su curve campionate in una `DataTexture` (§6.7) |
| Indicatore idro dell'HUD | 11,70 → 11,76 | comparsa | — | SALTO (righello verticale 0–900 m), PORTATA (barra log 0,1–1 000 m³/s), POTENZA |
| Nebbia | 12,05 → 12,55 → 12,80 | 0,00025 → 0,003 → 0,006 | none | — |
| SALTO dell'HUD | 12,05 → 12,80 | contatore 0 → 700 m (segue la quota della camera) | none | — |
| Linee nella condotta Pelton | 12,05 → 12,80 | emissione acqua × 1,4 → × 2,4 | none | — |
| `RectAreaLight` (sala Pelton) | 12,65 → 12,80 | intensità 0 → 8 | none | Due strisce sopra la ruota, a y = 19,4, z = −0,3 e −1,2, lungo x |
| GTAO | 12,70 → 12,85 | 0 → 0,9 | none | Raggio 0,004 u (4 cm) |
| Getto A e B: lunghezza (spina che arretra) | 13,02 → 13,10 | 0 → 1 (il fronte avanza dall'ugello al cucchiaio) | none | — |
| Lame d'acqua sulla cresta | 13,08 → 13,14 | 0 → 1 | none | Due lame deviate di circa 165° ai lati (±z) |
| Spruzzi | 13,12 → | emissione accesa | — | `Points` balistici (§6.7) |
| `tempoScala` | 13,00 → 13,08 / 13,08 → 13,26 | 1/1000 fisso / `10^lerp(−3, −0,903)` → **×1/8** | power2.in | Moltiplica `uTempo` di getti, spruzzi e girante. HUD `TEMPO ×1/1000 → ×1/8`. Girante limitata a `ωmax = 0,45·(2π/22)·fps` |
| `RectAreaLight` → sala Francis | 13,35 (spente) / 13,70 → 13,80 | 0 → 8 | none | Spostate quando sono a 0 |
| `YF` (taglio orizzontale Francis) | 13,80 → 13,90 | costante 10 → 2,0 | power2.inOut | Rivela chiocciola, avantdistributore, distributore e girante |
| `apertura` (20 pale direttrici, "diaframma") | 13,92 → 14,10 | 0 → 1 (angolo 0° → 28°) | power2.inOut | Particelle ∝ apertura: entrano radiali, spiralano, escono assiali nel tubo di aspirazione |
| `RectAreaLight` → sala Kaplan | 14,20 / 14,35 → 14,45 | 0 → 8 | none | — |
| `passoKaplan` (5 pale) con `aperturaKaplan` (24 pale direttrici) | 14,45 → 14,70 | −8° → +15° / 0,3 → 1 | power2.inOut | Doppia regolazione sincronizzata con le 59 linee di corrente del fiume |
| `oscura` (plastico che si scurisce) | 14,80 → 15,00 | 0 → 0,85 | none | Moltiplicatore della luce in uscita del plastico |
| `diagramma`, opacità del piano | 14,85 → 15,00 | 0 → 1 | none | — |
| Campi d'impiego | 14,95 → 15,05 | disegno 0 → 1 | none | — |
| `giranti` | 14,95 → 15,10 | scala 0 → 1 | power4.out | — |
| `colonne` | 14,98 → 15,12 | altezza 0 → piena (Pelton → Francis → Kaplan, sfalsate di 0,03) | expo.out | — |
| `retta10` (retta dei 10 MW) | 15,10 → 15,20 | disegno 0 → 1, poi bagliore oro × 2,6 | none | — |
| Punti di lavoro (dischi oro) | 15,18 → 15,22 | 0 → 1 | expo.out | — |

**Il diagramma 4e** (gruppo con origine (−60; 2; 60), piano x-y)

- **Assi**:
  - Q da 0,1 a 1 000 m³/s in log, x = (log₁₀Q + 1)·25 (da 0 a 100 u);
  - H da 1 a 2 000 m in log, y = log₁₀H·18,2 (da 0 a 60,1 u).
- **Disegno su `CanvasTexture`** 4096 × 2458 su un piano 100 × 60 u (`MeshBasicMaterial`, `toneMapped:false`, trasparente):
  - assi platino 1 px;
  - griglia delle decadi al 35%;
  - etichette in Plex Mono ("0,1 1 10 100 1 000 m³/s", "1 10 100 1 000 2 000 m");
  - rette di isopotenza a 1 e 100 MW tratteggiate in grigio.
- **Campi d'impiego indicativi** (contorno platino 1 px, riempimento al 5%, nome in Jost):
  - Kaplan: H 2–40 m, Q 2–1 000;
  - Francis: H 30–400 m, Q 0,5–600;
  - Pelton: H 300–2 000 m, Q 0,1–40.
  - Il vertice in alto a destra è tagliato dalla retta dei 1 000 MW.
  - Si sovrappongono come nella realtà: 30–40 m (Kaplan / Francis) e 300–400 m (Francis / Pelton).
  - Didascalia: "campi indicativi".
- **Retta dei 10 MW**: `LineSegments2` oro, H = 10 000 / (8,829·Q) kW, da Q = 0,6 a Q = 1 000.
- **Punti di lavoro**:

| Turbina | Q (m³/s) | H (m) | x | y | Colonna (raggio, altezza) | Girante (scala relativa vera ×30) |
|---|---|---|---|---|---|---|
| Pelton | 1,6 | 700 | 30,1 | 51,8 | r 0,70 u, alta 51,8 u | Ø 2,0 m → 6,0 u |
| Francis | 7,5 | 150 | 46,9 | 39,6 | r 1,51 u, alta 39,6 u | Ø 1,6 m → 4,8 u |
| Kaplan | 95 | 12 | 74,4 | 19,6 | r 5,36 u, alta 19,6 u | Ø 4,5 m → 13,5 u |

- **Colonne**: cilindri d'acqua a z = 64. Lo shader è quello del v1 migliorato: fresnel più strisce più nucleo, additivo, `noAO`. Raggio `0,55·√Q`; velocità delle strisce ∝ √H.
- **Giranti**: davanti, a z = 70, alla base delle colonne. Ruotano a velocità visualizzata ×1/8: Pelton 600 giri/min → 1,25 giri/s, Francis 600 → 1,25, Kaplan 150 → 0,31.

**Etichette 3D**

| T | Nome / dato | Ancora |
|---|---|---|
| 11,82 – 12,10 | Pelton / salto 700 m | (−100; 53; 0) |
| 11,86 – 12,10 | Francis / salto 150 m | (−46; 9,5; 0) |
| 11,90 – 12,10 | Kaplan / salto 12 m | (104; 0,6; 0) |
| 12,82 – 13,30 | Getto ≈115 m/s / Ø 9,4 cm · tangente alla circonferenza primitiva | (−92,15; 17,916; −0,4) |
| 12,86 – 13,30 | Cucchiaio doppio / la cresta divide il getto in due lame | Cucchiaio in basso |
| 12,90 – 13,30 | Spina e deviatore / regolano e deviano il getto | Punta dell'ugello A (−92,27; 17,916; −0,4) |
| 13,84 – 14,15 | Chiocciola / sezione decrescente, velocità costante | Mezzeria della chiocciola a 180° |
| 13,88 – 14,15 | Distributore / 20 pale direttrici regolabili | Anello delle pale direttrici |
| 13,92 – 14,15 | Girante / ingresso radiale · uscita assiale | Corona della girante |
| 14,44 – 14,75 | Pale orientabili / 5 pale a passo variabile | Punta di una pala |
| 14,48 – 14,75 | Distributore / 24 pale · doppia regolazione | Anello delle pale direttrici |
| 14,52 – 14,75 | Tubo di aspirazione / recupera energia allo scarico | Cono a y = −1,2 |
| 15,12 – 15,38 | Pelton / 700 m · 1,6 m³/s | Punto di lavoro Pelton |
| 15,15 – 15,38 | Francis / 150 m · 7,5 m³/s | Punto di lavoro Francis |
| 15,18 – 15,38 | Kaplan / 12 m · 95 m³/s | Punto di lavoro Kaplan |

Le etichette il cui punto esce dal quadro (per esempio nel macro) si nascondono.

**Testi HTML** (sinistra)

| Battuta | Ingresso / uscita | Contenuto |
|---|---|---|
| 4a | 11,72 / 12,20 | Occhiello `04 · Idroelettrico` · H2 `Due numeri <em>scelgono la turbina.</em>` · P `Il salto, cioè il dislivello che l'acqua percorre, e la portata, cioè quanta acqua passa ogni secondo. In montagna poca acqua da grande altezza; in pianura tanta acqua da pochi metri.` · Lista mono: `Pelton · oltre 300 m` / `Francis · 40–400 m` / `Kaplan · sotto 40 m` |
| 4b | 12,70 / 13,32 | Occhiello `04 · Pelton` · H2 `Pelton: <em>salto alto, poca acqua.</em>` · P `Oltre circa 300 metri di salto. L'acqua scende in condotta forzata ed esce dagli ugelli a più di 100 m/s: il getto colpisce i cucchiai e la cresta lo divide in due.` · Dato: `Esempio · H 700 m · Q 1,6 m³/s · getto ≈115 m/s · ≈10 MW` |
| 4c | 13,84 / 14,18 | Occhiello `04 · Francis` · H2 `Francis: <em>il punto di mezzo.</em>` · P `Da circa 40 a 400 metri di salto, tipica delle dighe. L'acqua entra dalla chiocciola in senso radiale ed esce in basso, in senso assiale, nel tubo di aspirazione.` · Dato: `Esempio · H 150 m · Q 7,5 m³/s · ≈10 MW` |
| 4d | 14,44 / 14,78 | Occhiello `04 · Kaplan` · H2 `Kaplan: <em>tanta acqua, pochi metri.</em>` · P `Sotto circa 40 metri di salto, sui fiumi, con traverse ad acqua fluente. Pale e distributore regolabili insieme seguono la portata del fiume.` · Dato: `Esempio · H 12 m · Q 95 m³/s · ≈10 MW` |
| 4e | 15,04 / 15,40 | Occhiello `04 · Il confronto` · H2 `Stessa potenza. <em>Tre risposte.</em>` · P `10 MW con 95 m³/s su 12 metri, oppure con 1,6 m³/s da 700 metri. Scegliamo la macchina che il sito chiede.` · Formula mono: `P = ρ · g · Q · H · η   (η ≈ 0,9)` |

**Transizione verso la tappa 5** ("la linea d'oro", T 15,38 – 15,64)

1. A 15,38 il componente `LineaOro` (§5.2) prende i due estremi proiettati della retta dei 10 MW.
2. Il velo nero sale da 0 a 1 in 15,40 → 15,47. Intanto la linea si stende orizzontale a tutta larghezza a sy 0,58 (15,40 → 15,48).
3. **A T = 15,50**: scena PIANURA, stato "cantiere · mese 1", camera K5.0.
4. Da 15,50 a 15,58 la linea si piega sulla polilinea proiettata del cavidotto lungo la SP. Intanto il velo scende da 1 a 0 (15,52 → 15,62).
5. Da 15,58 a 15,64 la linea SVG svanisce e resta il cavidotto 3D, ancora "di progetto" (tratteggiato).

---

### 4.6 Tappa 5 · Costruzione e gestione (T 15,50 – 17,50 · 2 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | P risultante |
|---|---|---|---|---|---|---|---|
| K5.0 | 15,50 – 15,62 | (4,6; 1,2; 11,3) | 110 | 38 | 330 | 37,8 | (47,94; 68,92; 86,37) |
| K5.1 | 16,55 | (6,1; 1,2; 2,2) | 105 | 36 | 0 | 37,8 | (6,10; 62,92; 87,15) |
| K5.2 | 16,80 – 17,40 | (0,0; 1,2; 0,6) | 55 | 24 | 295 | 37,8 | (45,54; 23,57; 21,83) |

- vicino / lontano: 0,5 / 4 000.
- **K5.0 → K5.1**: un unico volo lento di 0,93 schermi durante il time-lapse, orbita di +30°.
- **K5.2**: il terzetto delle etichette sta a destra: stringa 14-B (0,55; 0,62), piastra dati (0,73; 0,66), capannone (0,64; 0,33).

**Stato all'arrivo** (T 15,50):

- `uRealta 1`, `uLayoutApprovato 1` (linee oro continue su terreno nudo), `uModo 1`, impostati con un `tl.set` reversibile;
- `comparsaPali / Tubi / Moduli = −0,1` (nulla di costruito);
- cabine nascoste, cavidotto tratteggiato "di progetto".

Le istanze usano la chiave `aOrdine`, cioè l'ordine di montaggio: si parte dal cancello (41; −11,5) e si procede per distanza crescente, fila per fila.

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| Gantt dell'HUD `MESE 1 → 9` | 15,62 → 16,50 | 0 → 1 | none | Fasi: Budget (15,62), Fornitori (15,66), Contratti (15,70), Montaggio (15,76 → 16,40), Collaudo (16,42 → 16,52) |
| Archi dei fornitori (SVG sullo schermo, oro chiaro 1 px) | 15,64 → 15,74 | 3 archi dai bordi del quadro al cancello, poi svaniscono | expo.out | Procurement e contratti |
| Picchetti (`Points` oro alle posizioni dei pali) | 15,66 → 15,76 | 0 → 1 | none | — |
| Recinzione (pali ogni 3 m sul contorno rientrato di 0,5 u, più filo) e viabilità (`tMaschere.A`) | 15,72 → 15,84 | 0 → 1 | none | — |
| `comparsaPali` | 15,80 → 16,05 | −0,1 → 1,1 | none | Due battipali (box grafite 0,6 × 0,25 × 0,25 u con antenna di 0,9 u) seguono il fronte dell'onda lungo le file |
| `comparsaTubi` | 15,95 → 16,15 | −0,1 → 1,1 | none | — |
| `comparsaModuli` | 16,05 → 16,40 | −0,1 → 1,1 | none | Scala da 0,6 a 1 e salita da −0,3 m |
| `uLayoutApprovato` | 16,05 → 16,40 | 1 → 0,3 | none | Le linee oro restano come "doppio" tenue sotto i moduli montati |
| Cabine al cancello | 16,30 → 16,36 | scala 0 → 1 | power4.out | — |
| Cavidotto: scavo / acceso | 16,35 → 16,45 / 16,45 | tratteggio scuro → rame continuo | none | — |
| Collaudo: `uFronte` (anello oro dal cancello) | 16,45 → 16,55 | 0 → 80 u | none | — |
| Tracker: angolo | 16,46 → 16,55 | 0° → 38,6° (ore 16:00) | power2.inOut | — |
| `uNuvole` (ombre di nuvole) | 15,62 → 16,50 | 0,25, velocità ×20 | — | Sensazione di time-lapse |
| Sole | 15,50 → 16,50 / 16,50 → 16,60 | 28°/240° fisso / → 50,5°/255,5° (16:00) | none | — |
| Ombre | sempre | `meta` = 60, aggiornate quando cambia qualcosa (in pratica a ogni fotogramma nel time-lapse) | — | — |
| **5b** · piastra dati (HTML ancorata a (24; 7,2; 2)) | 16,82 → 17,00 | i numeri contano da 0 | expo.out | `POTENZA ORA 8,6 MW` · `ENERGIA OGGI 75,4 MWh` · `DISPONIBILITÀ 99,4 %` · mini-curva del giorno: tracker linea piena oro, impianto fisso tratteggio grigio, dalle 05:30 alle 16:00, il resto a puntini · `simulazione · giornata serena del 21 giugno` |
| Stato delle file | 16,84 → 16,95 | emissivo smeraldo ×0,15 sui telai di tutte le file | none | — |
| Stringa 14-B | 16,86 → 17,40 | telai in ambra, pulsanti ×1,5 a 0,8 Hz | — | Fila 14, tracker B |
| Capannone · scansione termica | 16,90 → 17,00 | 0 → 1 | none | Emissivo su tetto e pareti, scala oro: `#2a1c10 → --oro → --oro-chiaro` da rumore (dispersioni su colmo e serramenti). Niente falsi colori blu-rossi. |

**Etichette 3D**

| T | Nome / dato | Ancora |
|---|---|---|
| 16,82 – 17,42 | (la piastra dati stessa, con gomito) | (24; 7,2; 2) |
| 16,88 – 17,42 | Stringa 14-B / intervento programmato | (10,0; 1,6; 2,12) |
| 16,92 – 17,42 | Capannone aziendale / studio di efficientamento energetico | (−12; 1,9; −18) |

**Testi HTML** (sinistra)

| Battuta | Ingresso / uscita | Contenuto |
|---|---|---|
| 5a | 15,70 / 16,52 | Occhiello `05 · Costruzione` · H2 `Budget, contratti, cantiere. <em>Una sola regia.</em>` · P `Prepariamo il budget di costruzione, individuiamo fornitori e subappaltatori, negoziamo i contratti di acquisto e seguiamo il cantiere fino all'entrata in esercizio.` |
| 5b | 16,86 / 17,42 | Occhiello `05 · Gestione` · H2 `L'impianto, <em>anno dopo anno.</em>` · P `Asset management: produzione, manutenzione, contratti. E studi di efficientamento energetico per aziende ed edifici.` |

**Transizione verso la tappa 6**: è continua, senza tagli. Il sole tramonta in time-lapse mentre la camera sale e arretra.

---

### 4.7 Tappa 6 · Finale (T 17,50 – 19,00 · 1,5 schermi)

**Camera**

| id | T sosta | Target | d | φ | ψ | fov | Ancora | P risultante |
|---|---|---|---|---|---|---|---|---|
| K6.0 | 18,30 – 19,00, deriva ψ +1,5°, d −10 | (−99,23; 15,85; 42,65) | 300 | 5 | 288 | 45,0 | target | (185,00; 42,00; 135,00) |

- Il volo va da 17,40 a 18,30.
- Il quadro guarda verso ovest-nord-ovest, verso il tramonto. Il sole (2°/300°) sta a sx 0,65, sy 0,35.
- Fotovoltaico a (0,73; 0,64), agrivoltaico a (0,84; 0,79), traversa idroelettrica a (0,80; 0,55).
- Il bordo del mondo resta fuori campo: il piede del quadro tocca il suolo a x ≈ 110.

**Eventi**

| Parametro | T | Da → a | Easing | Note |
|---|---|---|---|---|
| Sole | 17,45 → 18,30 | el 50,5° → 2,0°; az 255,5° → 300,2°; intensità 3,3 → 1,6; colore `luceSole(el)` | none | Ombre lunghissime sulle file |
| Miscela HDRI autumn → qwantani | 17,60 → 18,10 | 5 cotture | none | — |
| Cielo | 17,80 → 18,30 | pomeriggio → tramonto con disco solare | none | — |
| Esposizione | 17,45 → 18,30 | 1,00 → 0,95 | none | — |
| `uRealta` | 17,95 → 18,30 | 1 → 0,6 | power2.inOut | Carta e realtà insieme, come specchio dell'apertura |
| `uIso` / `uGriglia` / `uLayoutApprovato` | 17,95 → 18,30 | 0,6 → 1,0 / 0,55 → 0,45 / 0,3 → 0,6 | none | — |
| `uRitraccia` (onda che ripassa tutte le linee, ×2 sul fronte) | 18,00 → 18,40 | −1 → 320 u da SITO_C | none | — |
| Tracker | 17,45 → 18,30 | seguono il sole (backtracking finale fino a 3,7°) | — | — |
| **Sole → petali** | 18,30 → 18,52 | Bagliore del disco ×1 → ×0,3. I 12 tracciati dei petali del **logo ufficiale** compaiono in SVG nella posizione proiettata del sole. | expo.out | Centro del ventaglio (405, 388 nel viewBox del logo) sul sole proiettato. Raggio delle punte = 0,11·innerHeight. Ogni coppia di facce: tratto disegnato in 0,04 T, poi riempimento con i colori ufficiali, sfalsato di 0,025 T da sinistra a destra. Nessun ricolore, nessun 3D. |
| Etichette 6 | 18,32 – 19,00 | — | — | Vedi sotto |

**Etichette 3D**

| T | Nome / dato | Ancora |
|---|---|---|
| 18,32 – 19,00 | Fotovoltaico / 10,4 MWp | SITO_C più 0,6 u in y |
| 18,35 – 19,00 | Agrivoltaico / 2,4 MWp | AGRI_C più 0,8 u in y |
| 18,38 – 19,00 | Idroelettrico / Kaplan ad acqua fluente | (−77,5; 0,9; −100) |

**Testo HTML** (sinistra, ingresso 18,34, resta fino alle sezioni)

- Occhiello: `06 · Un solo interlocutore`
- H2 `.grande`: `Dall'idea <em>al cantiere.</em>`
- P: `Project Development Management: un referente unico, dalla prima verifica del terreno alla gestione dell'impianto.`
- Bottoni:
  - principale magnetico `Parliamo del progetto` (→ `#contatti`): bordo oro, alla pressione riempimento rame;
  - secondario testuale `Esplora i servizi →` (→ `#servizi`).

**Dopo la storia** (T > 19):

- Il velo scuro sale da 0 a 0,75 mentre `#chi-siamo` passa da "top bottom" a "top 30%".
- L'indice e l'HUD svaniscono.
- Il render scende a 30 fps con `scala = 0,5`.
- Tra `#contatti` e il footer il velo sale da 0,75 a 1; a velo 1 il render si ferma.
- **Al passaggio del mouse su una colonna dei Servizi** la camera si sposta in 1,2 s (`power2.inOut`) sul keyframe della fase:
  - Sviluppo → K1.3;
  - Autorizzazione → K2.0;
  - Costruzione → K5.1;
  - Esercizio → K5.2.
  - Lo stato della scena resta quello finale.

---

## 5. Interfaccia HTML: intro, strumenti, sezioni

### 5.1 Scheletro della pagina (ordine dei livelli, z-index)

```html
<body class="carica">
  <canvas id="scena" aria-hidden="true"></canvas>              <!-- z 0, fissa -->
  <div class="scrim" aria-hidden="true"></div>                 <!-- z 1: velo a gradiente per la colonna del testo -->
  <div class="velo" aria-hidden="true"></div>                  <!-- z 2: nero, opacità da STATO.velo e dalle sezioni -->
  <svg id="linea-oro" aria-hidden="true"></svg>                <!-- z 3: linea d'oro a schermo (intro, 4→5) -->
  <svg id="petali" aria-hidden="true"></svg>                   <!-- z 3: petali del finale -->
  <div class="etichette" aria-hidden="true"><svg class="richiami"></svg></div>  <!-- z 10 -->
  <header class="testata">…</header>                            <!-- z 20 -->
  <nav class="indice" aria-label="Tappe del racconto">…</nav>   <!-- z 20 -->
  <div class="hud" aria-hidden="true">…</div>                   <!-- z 20 -->
  <div class="cursore" aria-hidden="true"></div>                <!-- z 60 -->
  <div id="preloader" role="status" aria-live="polite">…</div>  <!-- z 50 -->
  <main>
    <section id="storia" aria-label="Il percorso di un progetto" style="height:2000vh">
      <div class="testi"> <!-- position:fixed; le .battuta in ordine di lettura --> </div>
    </section>
    <section id="chi-siamo">…</section>
    <section id="servizi">…</section>
    <section id="contatti">…</section>
    <footer class="piede">…</footer>
  </main>
</body>
```

- `<title>`: `ERI · Energie Rinnovabili Italia`
- `meta description`: `Sviluppiamo impianti fotovoltaici, agrivoltaici e idroelettrici: dalla particella catastale al Ready to Build, fino alla costruzione e alla gestione.`
- Nessuna menzione dell'eolico in tutta la pagina.

### 5.2 Preloader e intro con il logo ufficiale

Il logo ufficiale `../logo/ufficiale/logo-eri-v2-su-scuro.svg` (viewBox 812 × 720) si **incorpora in linea** nel preloader. Il disegno resta identico; si aggiungono solo classi ai tracciati, nell'ordine del file:

| Tracciati | Classe | Contenuto |
|---|---|---|
| 1–12 | `.petalo` | 6 petali × 2 facce (chiara e scura), da sinistra a destra. Punte a (74,261), (135,155), (229,77), (343,35), (466,35), (581,77). Centro del ventaglio ≈ (405, 388). |
| 13–18 | `.foglia` | 3 foglie × 2 |
| 19 | `.nastro` | Svolazzo (gradiente `#nastro`) |
| 20 | `.collina` | — |
| 21 | `.scritta-solar` | "solar farm" |
| 22–23 | `.scritta` | ENERGIE / RINNOVABILI |
| 24 | `.scritta-italia` | ITALIA, in rame |

**Sequenza**

1. **Caricamento reale.**
   - Fondo `#050607`. Il logo è centrato (x 50%, y 40%), largo `min(340px, 42vw)`. All'inizio sono visibili solo i **contorni dei petali**:
     - tratto del colore ufficiale di ciascun tracciato, 1,5 px, `vector-effect: non-scaling-stroke`;
     - `fill-opacity 0`, `stroke-dashoffset` = lunghezza.
   - Sotto, a y 58%, la **linea d'oro** di 1 px si allunga da sinistra secondo il progresso reale e ha una punta luminosa oro chiaro di 6 px.
   - Contatore Plex Mono `000 → 100`. Didascalia `CARICAMENTO DEL TERRITORIO · TERRENO` (il nome del gruppo corrente).
   - Gruppi e pesi; ogni gruppo completato disegna i contorni di una coppia di petali in 500 ms, `expo.out`:
     1. FONT 5%;
     2. CIELO, HDRI del tramonto, 20%;
     3. TERRENO, texture, 25%;
     4. GEOMETRIA (terreno, catasto, layout, alberi), 15%;
     5. SHADER (`compileAsync` più `initTexture`), 25%;
     6. VERIFICA (render di riscaldamento più benchmark), 10%.
2. **Rivelazione del logo**:
   - riempimento dei petali con opacità da 0 a 1 (600 ms, sfalsati di 60 ms, `expo.out`);
   - foglie, nastro e collina (400 ms);
   - scritte (500 ms, scala 1,02 → 1);
   - pausa di 700 ms.
3. **Uscita**:
   - il logo vola nella testata con FLIP (1,0 s, `expo.inOut`) e negli ultimi 200 ms passa la mano al simbolo della testata;
   - intanto la linea si allunga a tutta larghezza (300 ms);
   - poi **si piega sulla polilinea proiettata del fiume** nell'inquadratura K0.0 (64 punti, z da −400 a 400; morph di 900 ms, `power2.inOut`, con lo stesso numero di punti su entrambe le forme);
   - il fondo del preloader svanisce 600 ms dopo l'inizio del morph;
   - la linea SVG svanisce in 400 ms quando il fiume della carta è visibile.
4. **Titolo**: dopo 300 ms le righe dell'H1 salgono (1,1 s, sfalsate di 0,08 s, `expo.out`). Poi il lead (0,8 s) e il segnale "Scorri".

**Regole**

- Il preloader dura quanto il caricamento più circa 3,6 s.
- Si salta con rotella, tasto o clic: `timeline.progress(1)` con dissolvenza di 300 ms. Il pulsante `Salta l'intro` è sempre visibile in basso a destra.
- Seconda visita (`sessionStorage 'eri-intro'`): versione da 1,2 s, senza disegno dei petali.
- Riduci movimento: logo in dissolvenza (300 ms), pausa di 500 ms, uscita in 300 ms, nessun morph.
- **Mai ricolorare, estrudere o ruotare in 3D il logo.**

**Componente `LineaOro`** (riusato in intro e nel passaggio 4 → 5):

- un `<path>` SVG a schermo intero;
- `morph(daPunti, aPunti, durata | intervalloT)` interpola punto per punto 64 punti ricampionati per lunghezza d'arco;
- tratto oro 1 px con punta luminosa.

### 5.3 Testata

- Fissa in alto.
- **Sinistra**: simbolo del logo ufficiale ritagliato (stesso SVG, `viewBox="0 20 812 440"`: petali, foglie, nastro), altezza 40 px, seguito da `ERI` in Bodoni 22 px con spaziatura 0,42em in oro chiaro, come nel v1.
- **Destra**: `Metodo` (→ `#storia`) · `Servizi` · `Chi siamo` · bottone `Parliamo del progetto`.
- Sotto i 900 px resta solo il bottone.
- Nessun vetro sfocato. Uno sfondo `linear-gradient(180deg, rgba(5,6,7,.7), transparent)` compare dopo 100 px di scroll.

### 5.4 Indice delle tappe

- Fisso a destra, centrato in verticale, allineato a destra.
- 7 voci in Plex Mono 11 px maiuscolo: `00 Territorio`, `01 Sviluppo`, `02 Autorizzazioni`, `03 Fotovoltaico`, `04 Idroelettrico`, `05 Cantiere e gestione`, `06 Un referente`.
- Accanto a ogni voce una linea di 18 px che si allunga a 36 px e si riempie d'oro con il progresso della tappa.
- La voce attiva è in oro chiaro.
- Clic: `lenis.scrollTo(inizioTappa·innerHeight + offset di #storia, {duration: 2.2, easing: t => 1 − Math.pow(1 − t, 4)})`.
- In fondo: `Salta ai servizi ↓`.
- Nascosto sotto i 900 px e durante le sezioni HTML.

### 5.5 HUD

Barra in basso, a 22 px dal bordo.

- **Sinistra** (sotto la colonna del testo):
  - coordinate WGS84 del target, con formato `42°00′41″N · 12°30′12″E`;
  - `QUOTA 1 420 m`, l'altezza della camera s.l.m.;
  - **barra di scala vera**: m per px = `2·d·tan(fov/2)·10 / innerHeight`. Si sceglie la lunghezza tra 10, 20, 50, 100, 200, 500 m, 1 e 2 km più vicina a 120 px, con etichetta.
- **Strumento di tappa** (a destra, x da 64% a 96%):
  - tappe 0–2: `MATURITÀ DEL PROGETTO` con una barra di 220 px. Tacche alle tappe intermedie (Territorio 5 · Screening 20 · Proprietari 35 · Layout 45 · Iter 65 · Connessione 85 · RTB 100). Valore in percentuale; a 100% la scritta `READY TO BUILD`.
  - tappa 3: strumento solare (§4.4).
  - tappa 4: indicatore idro con SALTO (righello verticale 0–900 m, 140 px, parentesi della centrale attiva), PORTATA (barra log 0,1–1 000 m³/s, 220 px), `POTENZA ≈10 MW` e TEMPO (solo in 4b–4d).
  - tappa 5: Gantt `MESE 1 … 9` più le fasi, poi `SIMULAZIONE · 21 GIUGNO · 16:00`.
- **Sempre visibile** (in basso a destra): bandierina `DATI ILLUSTRATIVI` in Plex Mono 10 px, oro, bordo di 1 px.
- I numeri dell'HUD si aggiornano al massimo 15 volte al secondo, con `tabular-nums`.

### 5.6 Etichette 3D

È un pool di 3 elementi `.etichetta`, riusati.

- Il gomito è un `<path>` nell'SVG `.richiami`: punto di 5 px sul bersaglio, segmento verticale di 24 px, poi orizzontale di 32 px fino al testo.
- Proiezione come nel v1: `vettore.project(camera)`, poi pixel CSS.
- Visibilità:
  - il punto deve essere davanti alla camera, cioè `z < 1` in NDC;
  - deve stare dentro l'area ammessa;
  - deve essere "visibile": per la PIANURA un ray-march di 24 passi sul terreno analitico tra camera e punto; nella VALLE si salta il test.
- La posizione si smorza con `damp` (λ 20) per evitare il tremolio.

### 5.7 Cursore e micro-interazioni

**Cursore-mirino da teodolite** (solo con `pointer: fine` e senza riduci movimento):

- anello di 6 px con 4 tacche e un anello in ritardo di 28 px (`damp` λ 12);
- sopra la tela, accanto, una lettura in Plex Mono 10,5 px: `42°00′12″N 12°30′41″E · q. 214 m`. È calcolata a 30 Hz con un ray-march sulla funzione `altezza` (passo 0,5 u, poi bisezione), senza `Raycaster`;
- tappa 1: sulla particella sotto il cursore `uHover = id` e la lettura diventa `Fg. 27 · P.lla 114 · 2,95 ha · idonea`. Le particelle generiche hanno numeri `Fg. 27 · P.lla {100 + id}` e area `1,00 ha × celle`;
- sui link l'anello sale a 44 px; sugli oggetti esplorabili compare `ESPLORA`;
- sul diagramma 4e, passando su una girante si accende il suo campo d'impiego.

**Bottoni magnetici**:

- attrazione entro 90 px, spostamento massimo 8 px, etichetta in parallasse 0,6×, tutto con `gsap.quickTo` (0,4 s, `power3.out`);
- uscita in 0,6 s `power3.out`;
- riempimento oro radiale che parte dal punto d'ingresso del cursore (variabili CSS `--x --y`), testo che passa a nero;
- bottone principale premuto: rame.

**Altre micro-interazioni**

- **Divisore di righe** scritto da noi (SplitText è a pagamento in GSAP 3.12.5):
  - avvolge le parole in `span`;
  - misura `offsetTop` per raggruppare le righe;
  - avvolge ogni riga in una maschera `overflow:hidden`;
  - si ricalcola al resize con un debounce di 200 ms.
- **Occhielli "decodificati"**: 300 ms, alfabeto `0123456789·—/ABCDEFGHIJKLMNOPQRSTUVWXYZ`, carattere finale fissato da sinistra.
- **Contatori dei numeri**: 0,8 s, `expo.out`, `tabular-nums`, formato `toLocaleString('it-IT')`.
- **Focus da tastiera**: contorno oro di 1 px, scostato di 4 px.

### 5.8 Sezioni dopo la storia

**Chi siamo** (`#chi-siamo`, griglia 1fr / 2fr)

- Colonna sinistra: occhiello `Chi siamo`. Sotto, in Bodoni corsivo enorme (`clamp(44px, 5vw, 84px)`, oro chiaro): `Qui si può costruire?`
- Colonna destra:
  - H2: `Sviluppiamo progetti di energia rinnovabile. Li consegniamo pronti da costruire.`
  - P: `Lavoriamo per investitori, produttori indipendenti (IPP) e proprietari terrieri. Ogni progetto parte da una domanda semplice: qui si può costruire? Rispondiamo con i dati, particella per particella, e seguiamo il progetto fino al cantiere e oltre.`
  - P: `Fotovoltaico, agrivoltaico e idroelettrico: un solo metodo, dal territorio al titolo autorizzativo, dalla costruzione alla gestione.`
  - Tre principi in Plex Mono, con un filetto oro: `01 · Dati prima delle opinioni` · `02 · Un referente unico` · `03 · Tempi e documenti in ordine`.
  - Tre cifre chiave come **segnaposto dichiarati**, in grigio: `[MW in sviluppo]` · `[progetti autorizzati]` · `[anni di esperienza]`, con la nota `Valori da inserire a cura di ERI.` **Nessuna cifra inventata.**

**Servizi** (`#servizi`)

- Occhiello `Servizi`; H2 `Quattro fasi, <em>un solo referente.</em>`
- Quattro colonne (righe di 1 px oro al 16%). Sotto le colonne corre una **fascia oro continua**: `Project Development Management · un unico referente coordina tutte le fasi, dall'idea al cantiere`. Nella fascia, a destra, in mono: `trasversale`.
- Ogni voce ha numero (mono, oro), titolo (Jost 500 17 px, avorio) e una frase (Jost 300 15 px, grigio). Al passaggio del mouse la riga si apre e mostra la frase, con un'icona a filo di 1 px.

| Colonna (→ tappa) | N. | Titolo (dicitura ufficiale) | Frase |
|---|---|---|---|
| **Sviluppo** (→ 01) | 01 | Screening preliminare vincolistico | Verifichiamo subito vincoli paesaggistici, idrogeologici, archeologici e ambientali. Sappiamo presto se un terreno è idoneo. |
| | 02 | Realizzazione primo layout | Disegniamo la prima disposizione dell'impianto: file, distanze, accessi, cabine e punto di connessione. |
| | 03 | Sopralluoghi e incontri con i proprietari terrieri | Andiamo sul posto, incontriamo i proprietari e costruiamo accordi chiari sui terreni. |
| | 04 | Ricerca tecnologica sui moduli fotovoltaici | Confrontiamo moduli e strutture sul mercato per scegliere la tecnologia più adatta al sito. |
| **Autorizzazione e connessione** (→ 02) | 05 | Iter autorizzativo | PAS o Autorizzazione Unica, con VIA quando richiesta: progetto, relazioni specialistiche e rapporti con gli enti fino al titolo. |
| | 06 | Gestione portali per richiesta di connessione elettrica e GSE | Richiesta, preventivo e accettazione sui portali del gestore di rete; pratiche sui portali del GSE. |
| **Costruzione** (→ 05) | 07 | Predisposizione budget di costruzione e individuazione di potenziali fornitori e subappaltatori | Stimiamo i costi di costruzione e selezioniamo fornitori e subappaltatori qualificati. |
| | 08 | Attività di procurement e realizzazione contratti di acquisto | Gestiamo gli acquisti e redigiamo i contratti con i fornitori. |
| | 09 | Attività di project management in fase di costruzione | Coordiniamo tempi, costi e qualità del cantiere fino all'entrata in esercizio. |
| **Esercizio** (→ 05) | 10 | Asset management | Seguiamo l'impianto nel tempo: produzione, manutenzione, contratti e rapporti con gli enti. |
| | 11 | Studi di efficientamento energetico | Analizziamo consumi ed edifici e indichiamo come ridurre costi ed energia per aziende e strutture. |
| **Fascia trasversale** | — | Attività di Project Development Management | Un unico referente coordina tutte le fasi, dall'idea al cantiere. |

Sotto le colonne, l'elenco delle tecnologie in mono con un rombo oro: `Fotovoltaico · Agrivoltaico · Idroelettrico`.

Al passaggio del mouse su una colonna lo sfondo 3D si sposta sulla fase (§4.7). Gli stessi spostamenti si attivano con il focus da tastiera.

**Contatti** (`#contatti`, griglia 1fr / 1fr)

- **Sinistra**:
  - occhiello `Contatti`; H2 `Parliamo del tuo terreno <em>o del tuo progetto.</em>`
  - recapiti (`dl`, mono per le etichette):

| Etichetta | Valore |
|---|---|
| Informazioni | info@eri-esempio.it |
| Progetti e investitori | progetti@eri-esempio.it |
| Proprietari terrieri | terreni@eri-esempio.it |
| Telefono | +39 000 000 0000 |
| Sede | [indirizzo da inserire] |

  - nota: `Recapiti di esempio: saranno sostituiti con quelli reali.`
- **Destra**: modulo finto, senza invio.
  - **Selettore del profilo** (chip, `role="radiogroup"`): `Investitore` · `IPP` · `Proprietario terriero` · `Altro`.
  - **Campi comuni**: `Nome e cognome`, `Azienda`, `Email`, `Telefono (facoltativo)`, `Messaggio`.
  - **Proprietario terriero** apre: `Comune`, `Foglio e particelle` (placeholder `Es. Fg. 27, P.lle 112–118`), `Superficie (ha)`.
  - **Investitore / IPP** apre: `Tecnologia` (Fotovoltaico · Agrivoltaico · Idroelettrico) · `Taglia indicativa (MW)` · `Fase di interesse` (Sviluppo · Ready to Build · In esercizio).
  - Casella `Ho letto l'informativa privacy` (link segnaposto).
  - Bottone magnetico `Invia richiesta`.
  - All'invio: `preventDefault`. Messaggio in `role="status"`: `Versione di prova: il modulo non invia ancora i dati.`
  - Campi: sottolineatura di 1 px, focus oro, etichette in mono 11 px.

**Footer**

- Logo ufficiale completo, piccolo (altezza 64 px), con i colori originali.
- Righe in mono 11 px maiuscolo:
  - `© 2026 ERI · Energie Rinnovabili Italia · P.IVA [da inserire]`
  - `Dati, numeri e scenari presenti nel sito sono illustrativi.`
  - `HDRI e texture: Poly Haven (CC0)`
  - `Privacy · Cookie` (segnaposto)
  - `Versione di prova`

**Comparsa delle sezioni**: titoli con il divisore di righe (`expo.out`, 1,1 s), blocchi con opacità 0 → 1 e y 28 → 0 (`ScrollTrigger` "top 88%"). Con riduci movimento: nessuna animazione.

---

## 6. Specifiche tecniche

### 6.1 Librerie, versioni e URL (verificati, risposta 200)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.css">
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
```

**Moduli aggiuntivi usati** (tutti in `three/addons/`):

- `loaders/RGBELoader.js`, `loaders/GLTFLoader.js`, `loaders/DRACOLoader.js` (decoder in `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/`);
- `postprocessing/EffectComposer.js`, `RenderPass.js`, `GTAOPass.js`, `UnrealBloomPass.js`, `OutputPass.js`, `SMAAPass.js`, `ShaderPass.js`;
- `lines/LineSegments2.js`, `LineSegmentsGeometry.js`, `LineMaterial.js`;
- `geometries/ParametricGeometry.js`;
- `utils/BufferGeometryUtils.js` (`mergeGeometries`, `toCreasedNormals`);
- `lights/RectAreaLightUniformsLib.js`;
- `capabilities/WebGL.js`.

**Fatti di r160 che vincolano il codice** (verificati):

- `AgXToneMapping` esiste.
- **Non esistono** `scene.environmentIntensity`, `backgroundRotation` né `environmentRotation`.
- `pmrem.fromScene(scene, sigma, near, far)`.
- `GTAOPass` nasconde solo `Points` e `Line`.
- `RGBELoader` restituisce `HalfFloatType`.
- `compile` usa `traverseVisible`: gli oggetti nascosti **non** si compilano.
- `aoMap` usa `texture.channel`, non `uv2`.
- PCFShadowMap rispetta `shadow.radius`; PCFSoftShadowMap lo ignora.
- Le texture d'esempio dell'acqua sono 404 su jsdelivr: la normal map dell'acqua si **genera** su canvas.
- SplitText **non** è gratuito in 3.12.5.

### 6.2 Struttura dei file

```
sito-3d/v2/
  index.html                     ← markup §5, logo ufficiale in linea, testi di tutte le battute
  css/stile.css                  ← token §2.1, tipografia §2.2, layout, indice, HUD, etichette, sezioni
  js/main.js                     ← avvio: capacità, livello di qualità, caricamento, warm-up, intro
  js/config.js                   ← costanti NORMATIVE: palette, mondo (§3), tappe e keyframe (§4), testi 3D
  js/mondo/terreno.js            ← altezza(), mesh, anello, shader del terreno (§6.5)
  js/mondo/catasto.js            ← griglia, particelle, tStati, tVincoli, tMaschere
  js/mondo/fiume.js              ← nastro, normal map procedurale, traversa
  js/mondo/contorno.js           ← alberi, strade, ponte, cabine, CP, capannone
  js/impianti/tracker.js         ← layout §3.5, InstancedMesh, tracker eroe, onda, cantiere
  js/impianti/agri.js            ← colture, quote, sagoma del trattore
  js/idro/valle.js               ← plastico, sezione, righello, laghi, centrali, piani di taglio
  js/idro/pelton.js | francis.js | kaplan.js   ← geometrie procedurali (§6.7)
  js/idro/acqua.js               ← getti, spruzzi, linee di corrente, colonne
  js/idro/diagramma.js           ← diagramma salto-portata (canvas più retta 10 MW)
  js/luce/sole.js                ← posizioneSole(), luceSole(), angoloTracker()
  js/luce/cielo.js               ← cupola del cielo, cupola ambiente, desola(), cotture PMREM
  js/luce/nebbia.js              ← sostituzione di fog_* (da eseguire per primo)
  js/render/pipeline.js          ← renderer, composer, passaggio Pellicola
  js/render/ombre.js             ← adattaOmbra()
  js/render/qualita.js           ← livelli, governatore, budget di pixel
  js/regia/scroll.js             ← Lenis + ScrollTrigger + timeline principale (da config)
  js/regia/camera.js             ← rig §4.0
  js/regia/stato.js              ← STATO e scrittura delle uniform
  js/ui/etichette.js | hud.js | testi.js | cursore.js | intro.js | lineaOro.js | servizi.js | contatti.js
  js/test.js                     ← ?test=1, ?debug=1
```

- Moduli ES nativi, senza build.
- Percorsi delle risorse: `../asset/...` e `../logo/...`.
- Le WebP in `../asset/texture/web/` sono **obbligatorie**: 10 MB in tutto contro i 33 MB dei JPG.
- Se esistono, si usano anche le HDRI `*_1k.hdr` (controllo con HEAD); altrimenti le `*_2k.hdr`.

### 6.3 Renderer, luce, cielo, post-produzione

```js
// luce/nebbia.js — DEVE essere importato prima di creare qualunque materiale
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
 varying float vFogDepth; varying vec3 vFogPosMondo;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
 vFogDepth = - mvPosition.z;
 vFogPosMondo = ( inverse( viewMatrix ) * vec4( mvPosition.xyz, 1.0 ) ).xyz; // robusto anche con istanze
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
 uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogPosMondo;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
 uniform vec3 uSoleDir; uniform vec3 uSoleNebbia; uniform float uNebbiaBase; uniform float uNebbiaDecad;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
 #else
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
 #endif
 float quotaN = exp( - max( vFogPosMondo.y - uNebbiaBase, 0.0 ) * uNebbiaDecad ); // nebbia in quota
 fogFactor *= mix( 0.35, 1.0, quotaN );
 float sol = pow( max( dot( normalize( vFogPosMondo - cameraPosition ), uSoleDir ), 0.0 ), 8.0 );
 gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, uSoleNebbia, sol * 0.6 ), fogFactor );
#endif`;
// Le uniform aggiuntive si collegano PER RIFERIMENTO in ogni materiale con la factory
// nuovoMateriale(): onBeforeCompile concatenato → sh.uniforms.uSoleDir = NEBBIA.uSoleDir, ecc.
// La stessa factory registra il materiale per ENV_GLOBALE (envMapIntensity = base × ENV_GLOBALE).
// LineMaterial e ShaderMaterial di overlay: fog:false (si dissolvono per alfa propria).
// Valori: uNebbiaBase = 0 (PIANURA) / 20 (VALLE); uNebbiaDecad = 0,08; uSoleNebbia = colore del bagliore del cielo.
```

```js
// render/pipeline.js
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance',
  stencil:false, preserveDrawingBuffer: TEST });         // preserveDrawingBuffer SOLO in ?test=1
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = TM === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping; // applicato da OutputPass
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;            // MAI cambiarlo a runtime
renderer.shadowMap.autoUpdate = false;                   // needsUpdate solo quando sole/oggetti/inquadratura d'ombra cambiano
renderer.localClippingEnabled = true;
const dprNativo = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(dprNativo); renderer.setSize(innerWidth, innerHeight);   // la tela resta SEMPRE nativa

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa }); // 4 o 0
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(dprNativo * Q.scala);            // risoluzione INTERNA adattiva (§6.8)
composer.setSize(innerWidth, innerHeight);
const passRender = new RenderPass(pianura, camera);
const gtao = new GTAOPass(pianura, camera, wInt, hInt);
gtao.updateGtaoMaterial({ radius: 0.012, distanceExponent: 1.5, thickness: 0.15, scale: 1.0, samples: 16,
                          distanceFallOff: 1.0, screenSpaceRadius: false });  // unità mondo (u); raggio per inquadratura in §4
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
gtao.blendIntensity = 0;                                 // acceso solo nei primi piani (tabelle §4)
// mezza risoluzione (Ultra/Alta): const s = gtao.setSize.bind(gtao); gtao.setSize = (w,h) => s(w*0.5, h*0.5);
// esclusioni dall'AO: const ov = gtao.overrideVisibility.bind(gtao);
//   gtao.overrideVisibility = () => { ov(); scenaAttiva.traverse(o => { if (o.userData.noAO) o.visible = false; }); };
// noAO = TRUE per: LineSegments2 (sono Mesh!), getti, colonne, fogli GIS, tende, sigillo, cupole, piano del diagramma,
//        involucri tagliati (il passaggio delle normali ignora i piani di taglio).
const bloom = new UnrealBloomPass(new THREE.Vector2(wInt, hInt), 0.32, 0.55, 1.0);   // forza, raggio, soglia (HDR lineare)
const uscita = new OutputPass();                         // tone mapping + sRGB
const smaa = new SMAAPass(wInt, hInt); smaa.enabled = Q.msaa === 0;
const pellicola = new ShaderPass(PELLICOLA);             // ultimo: disegna a risoluzione NATIVA
[passRender, gtao, bloom, uscita, smaa, pellicola].forEach(p => composer.addPass(p));
// cambio di scena: passRender.scene = gtao.scene = valle (e viceversa); scene.fog per scena.
```

```glsl
// Passaggio PELLICOLA (fragment). Ingresso: buffer interno sRGB (dopo OutputPass/SMAA). Uscita: tela nativa.
uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uNitidezza, uVignetta, uGrana, uTempo, uSaturazione, uLato;
varying vec2 vUv;
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
vec3 cas(vec2 uv){ // nitidezza adattiva al contrasto (stile AMD CAS) sul ricampionamento
  vec3 e = texture2D(tDiffuse, uv).rgb;
  vec3 a = texture2D(tDiffuse, uv - vec2(uTexel.x, 0.)).rgb, b = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.)).rgb;
  vec3 c = texture2D(tDiffuse, uv - vec2(0., uTexel.y)).rgb, d = texture2D(tDiffuse, uv + vec2(0., uTexel.y)).rgb;
  vec3 mn = min(e, min(min(a, b), min(c, d))), mx = max(e, max(max(a, b), max(c, d)));
  vec3 amp = sqrt(clamp(min(mn, 1. - mx) / max(mx, 1e-4), 0., 1.));
  vec3 w = -amp * mix(.125, .2, uNitidezza);
  return clamp((e + (a + b + c + d) * w) / (1. + 4. * w), 0., 1.);
}
void main(){
  vec3 c = cas(vUv);
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSaturazione);
  c += vec3(.02, 0., -.01) * smoothstep(.6, 1., l) + vec3(0., 0., .008) * (1. - smoothstep(0., .15, l));
  vec2 q = vUv - vec2(.5 + .06 * uLato, .5); q.x *= 1.15;
  c *= 1. - uVignetta * smoothstep(.35, .95, length(q) * 1.4);
  c += (h12(gl_FragCoord.xy + floor(uTempo * 24.) * 17.) - .5) * uGrana * mix(.35, 1., 1. - abs(l * 2. - 1.));
  c += (h12(gl_FragCoord.xy * 1.37 + 3.1) + h12(gl_FragCoord.xy * .73 + 7.7) - 1.) / 255.;   // dithering triangolare
  gl_FragColor = vec4(c, 1.);
}
// Valori: uNitidezza 0,35 (0,5 se scala < 0,9), uVignetta 0,26, uGrana 0,028, uLato +1 (testo a sinistra), uTexel = 1/risoluzione interna.
```

```js
// luce/cielo.js — ambiente (IBL) da 2 HDRI miscelate e ruotate, cotto con PMREM
const cupolaEnv = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  uniforms: { tA:{value:null}, tB:{value:null}, uMix:{value:0}, uRotA:{value:0}, uRotB:{value:0}, uGain:{value:1} },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `#include <common>
    uniform sampler2D tA, tB; uniform float uMix, uRotA, uRotB, uGain; varying vec3 vDir;
    vec3 campiona(sampler2D t, vec3 d, float r){ float c = cos(r), s = sin(r); d.xz = mat2(c,-s,s,c)*d.xz; return texture2D(t, equirectUv(d)).rgb; }
    void main(){ vec3 d = normalize(vDir);
      gl_FragColor = vec4(mix(campiona(tA, d, uRotA), campiona(tB, d, uRotB), uMix)*uGain, 1.); }` });
// uRot = rad(azSoleVoluto − azHDRI). azHDRI = (u* − 0,5)·360° + 90°, dal texel più luminoso PRIMA della de-solazione.
// Attenzione a flipY: con RGBELoader la riga 0 dei dati corrisponde a v = 1 (alto). Verifica: ?debug=1 disegna una freccia verso azHDRI.
// cuoci(): envRT?.dispose(); envRT = pmrem.fromScene(scenaEnv, 0, 0.1, 10); scene.environment = envRT.texture;  // 2–5 ms
// desola(tex): luminanza di ogni texel (DataUtils.fromHalfFloat); soglia = percentile 99,9 (su 1 texel ogni 16);
//   i texel sopra soglia si riscalano a soglia (toHalfFloat). Così il sole della HDRI non fa doppio sole con la DirectionalLight.
```

```js
// luce/sole.js — posizione del sole (NOAA semplificata), verificata con l'Appendice A
export function posizioneSole(oraLocale, giorno = 172, lat = 42.0, lon = 12.5, fuso = 2){
  const g = 2*Math.PI/365*(giorno - 1 + (oraLocale - fuso - 12)/24);
  const eqt = 229.18*(0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g) - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g));
  const dec = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g) - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g)
            - 0.002697*Math.cos(3*g) + 0.00148*Math.sin(3*g);
  const ha = THREE.MathUtils.degToRad((oraLocale*60 + eqt + 4*lon - 60*fuso)/4 - 180);
  const fi = THREE.MathUtils.degToRad(lat);
  const cz = Math.sin(fi)*Math.sin(dec) + Math.cos(fi)*Math.cos(dec)*Math.cos(ha);
  const el = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cz, -1, 1)));
  const az = (THREE.MathUtils.radToDeg(Math.atan2(Math.sin(ha), Math.cos(ha)*Math.sin(fi) - Math.tan(dec)*Math.cos(fi))) + 180 + 360) % 360;
  return { el, az };
}
// Angolo del tracker monoassiale orizzontale N-S, con backtracking. Negativo = moduli verso est (mattino).
export function angoloTracker(el, az, gcr, limite = 60){
  if (el <= 0) return { theta: 0, stato: 'NOTTE' };
  const e = Math.sin(az*Math.PI/180)*Math.cos(el*Math.PI/180), u = Math.sin(el*Math.PI/180);
  const tT = -Math.atan2(e, u)*180/Math.PI;               // inseguimento ideale
  let theta = tT, stato = 'INSEGUIMENTO';
  const c = Math.cos(tT*Math.PI/180)/gcr;
  if (c < 1){ theta = tT - Math.sign(tT)*Math.acos(c)*180/Math.PI; stato = 'BACKTRACKING'; }
  if (Math.abs(theta) > limite){ theta = Math.sign(theta)*limite; if (stato === 'INSEGUIMENTO') stato = 'FINE CORSA'; }
  return { theta, stato, ideale: tT };
}
// In scena: rotazione attorno all'asse z (N-S) di +theta (normale = (−sin θ, cos θ, 0)).
// Colore e intensità del sole dall'elevazione (colori interpolati in lineare):
const COLORI_SOLE = [[-1,'#ff7a3c'],[2,'#ff9a55'],[5,'#ffb46b'],[10,'#ffc98a'],[20,'#ffe0b5'],[35,'#fff1df']];
export const intensitaSole = el => 3.4*THREE.MathUtils.clamp(0.45 + 0.55*el/45, 0.45, 1)*THREE.MathUtils.smoothstep(el, -1, 2);
// luceSole(el) → { colore: interpolazione lineare di COLORI_SOLE (in spazio lineare), intensita: intensitaSole(el) }
// Le tappe 0, 1 e 5a usano i valori fissi della tabella §2.4; la funzione vale per 3b, 3c e 6.
```

**Cupola del cielo** (sfondo). Uniform: `uZenit`, `uOrizzonte`, `uBagliore`, `uSoleDir`, `uDisco` (0/1), `uMieG` (0,76). I preset sono in §2.5 e si interpolano in lineare durante le tappe.

```glsl
vec3 d = normalize(vDir); float h = clamp(d.y, -0.2, 1.0);
vec3 c = mix(uOrizzonte, uZenit, pow(smoothstep(-0.02, 0.6, h), 0.55));
float mu = dot(d, uSoleDir);
c += uBagliore * pow(max(mu, 0.0), 6.0) * (1.0 - smoothstep(0.0, 0.35, h));
float g = uMieG; float mie = (1.0 - g*g) / pow(1.0 + g*g - 2.0*g*mu, 1.5) * 0.02;
c += uBagliore * mie;
float disco = smoothstep(cos(radians(0.32)), cos(radians(0.27)), mu) * uDisco;
c += vec3(1.0, 0.85, 0.62) * 30.0 * disco;                // HDR → bloom controllato
gl_FragColor = vec4(c, 1.0);
```

### 6.4 Ombre

- Una sola `DirectionalLight` "sole" con ombre, più una `HemisphereLight`.
- Nella VALLE si aggiungono 2 `RectAreaLight` e 1 `SpotLight` senza ombre: totale costante in ogni scena.
- **Il numero di luci non cambia mai**: si animano le intensità.
- `RectAreaLightUniformsLib.init()` va chiamato all'avvio, prima di creare i materiali.

```js
sole.castShadow = true;
sole.shadow.mapSize.set(Q.ombra, Q.ombra);   // 4096 Ultra, 2048 Alta/Media, 1024 Base (cambio taglia: shadow.map.dispose(); shadow.map = null)
sole.shadow.bias = -0.0003; sole.shadow.normalBias = 0.005;   // in u (= 5 cm)
sole.shadow.radius = 3;
sole.shadow.camera.near = 1; sole.shadow.camera.far = 600;
scene.add(sole.target);
// adattaOmbra(centro, meta): frustum ortografico ±meta centrato su "centro", agganciato al texel (niente sfarfallio)
function adattaOmbra(centro, meta){
  const dir = soleDir;                                   // versore verso il sole
  const texel = (2*meta)/sole.shadow.mapSize.x;
  _r.crossVectors(SU, dir).normalize(); _u.crossVectors(dir, _r);
  const a = Math.round(centro.dot(_r)/texel)*texel, b = Math.round(centro.dot(_u)/texel)*texel, c = centro.dot(dir);
  const p = new THREE.Vector3().addScaledVector(_r, a).addScaledVector(_u, b).addScaledVector(dir, c);
  sole.target.position.copy(p); sole.position.copy(p).addScaledVector(dir, 300);
  const cam = sole.shadow.camera; cam.left = cam.bottom = -meta; cam.right = cam.top = meta; cam.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
}
```

- **`meta` per inquadratura**: panoramiche 190, medie 60, campo FV 26, mezzogiorno 30, tracker eroe 3, vicolo agrivoltaico 10, Valle generale 260, interni 0,6.
- `meta` cambia solo durante i voli: interpolazione logaritmica, con il movimento che nasconde il salto di scala.
- **Ogni mesh con vertici spostati nello shader ha un `customDepthMaterial` con la stessa patch**: terreno (sollevamento), istanze dei tracker (rotazione e comparsa), colture (vento), alberi (sollevamento). Senza, le ombre non ruotano e non si sollevano.

### 6.5 Shader del terreno (MeshStandardMaterial + onBeforeCompile)

**Vertici**

- Attributo `aAltezza`.
- `float lift = 1.0 - smoothstep(uOnda - 70.0, uOnda, distance(position.xz, SITO_C.xz));`
- `transformed.y = aAltezza * lift;`
- In `beginnormal_vertex`: `objectNormal = normalize(mix(vec3(0,1,0), objectNormal, lift));`
- Varying `vAlt = aAltezza`, `vPosMondo`, `vNorMondo`.
- La **stessa funzione `lift`** (chunk condiviso `sollevamento`) si usa in alberi, fiume e `customDepthMaterial`.

**Frammenti** (sostituzioni di chunk, come nel dossier):

- **Splat** in `map_fragment`:
  - set erba-roccia più campo (`tMaschere.R`), roccia quando la pendenza `1 − N.y` supera 0,18–0,35;
  - asfalto e ghiaia (`tMaschere.G`), bosco più scuro e ruvido (`tMaschere.B`);
  - `noTile()` per rompere la ripetizione (con correzione della rotazione delle normali);
  - variazione macro ±13% con rumore a 0,02;
  - albedo × 0,62, saturazione 0,78;
  - ripetizione 1 texture ogni 6 u (60 m) per erba-roccia, ogni 4,6 u per il campo.
  - `roughnessmap_fragment` e `normal_fragment_maps` leggono `armSplat` e `norSplat`.
- **Carta / realtà**:
  - `realta = uRealta`, oppure il fronte: `max(uRealta, 1 − smoothstep(uFronteRealta − 4, uFronteRealta, dSito))` se `uFronteRealta > 0`;
  - `diffuseColor.rgb = mix(INCHIOSTRO, albedo, realta)`;
  - in modalità carta si aggiunge l'emissivo dell'ombreggiatura cartografica: `platino × 0,05 × clamp(dot(N, (−0,5; 0,707; −0,5)), 0, 1) × (1 − realta)`;
  - bordo del fronte: `oro × 3 × exp(−((dSito − uFronteRealta)/2)²)`.
- **Overlay** in `emissivemap_fragment`, sommati a `totalEmissiveRadiance`, tutti moltiplicati per `uPx` negli spessori:
  - **isoipse**: `linea(vAlt/0,5, 1,0 px)·1,2 + linea(vAlt/2,5, 1,6 px)·2,4`, poi `× uIso × oro-3d-emissivo`, con svanimento per `fwidth`;
  - **confini catastali**: griglia ruotata; si leggono la cella e il vicino più prossimo in x e in y di `tStati.G`. Si disegna se l'id differisce. Platino × 0,9 × `uGriglia`;
  - **stati** da `tStati.R`:
    - idonea: smeraldo × 0,35 × `uIdonee` più bordo;
    - sito: oro × 0,25 riempimento, × 2,4 bordo × `uSito`;
    - firmato / trattativa: pulsazione;
    - hover: `uHover`;
  - **vincoli** da `tVincoli` e `tMaschere.B`, con i motivi di §2.7 calcolati in coordinate schermo (tratteggi) o mondo (cerchi), × `uV[k]`;
  - **fiume in modalità carta**: riempimento acqua × 0,25 più bordi di 1 px × 1,5 sull'acqua bagnata (`|x − fiumeX(z)| < 2,07`) × `uFiumeMappa`;
  - **onde**: `uOndaRame` (anello largo 3 u, rame × 2,6), `uRitraccia` (fronte × 2 su tutte le linee), `uFronte` (collaudo);
  - **nuvole**: `outgoingLight *= 1 − uNuvole·smoothstep(0,4, 0,7, rumore(vPosMondo.xz·0,01 + uTempo·0,004·uNuvoleVel))`.
- **Sottrazione**: prima di `opaque_fragment`, `outgoingLight *= mix(1.0, 0.15, uSottrazione * (1.0 - idonea))`.
- **Plastico** della VALLE: stesso materiale con `uOscura` (moltiplica `outgoingLight` per `1 − uOscura`) e isoipse ogni 5 u.

**Texture del terreno**: `colorSpace` sRGB solo per le diffuse, `NoColorSpace` per normal e ARM, `anisotropy = renderer.capabilities.getMaxAnisotropy()`, `wrapS/T = RepeatWrapping`.

### 6.6 Tracker, colture, alberi (istanze)

**Geometrie dei pezzi** (in metri, gruppo × 0,1):

| Pezzo | Geometria |
|---|---|
| Modulo | `BoxGeometry(2.384, 0.035, 1.134)`, centro a +0,10 m sull'asse. Materiali: `[telaio, telaio, fronte, retro, telaio, telaio]`. |
| Tubo di torsione | Box 0,12 × 0,12 m lungo z, uno per tracker, scalato alla lunghezza |
| Palo | `ExtrudeGeometry` profilo H 0,12 × 0,12 m, alto 1,5 m (FV) o 4,4 m (agrivoltaico) |
| Cuscinetto | `TorusGeometry(0.09, 0.025)` più collare in box |
| Motoriduttore | Box 0,35 × 0,30 × 0,25 m più ralla (cilindro Ø 0,30) |
| Controllore | Box 0,30 × 0,40 × 0,12 m sul palo centrale |

**Texture delle celle**: canvas 2048×1024.

- 6 × 24 mezze celle blu-nere `#0a1220` con un leggero gradiente radiale.
- Fuga centrale di 10 mm, 16 busbar argentati sottili, ombra del telaio di 2 px.
- Il retro è grigio-blu `#1a2230`.
- sRGB, anisotropia massima.

**Un `InstancedMesh` per pezzo e per campo** (FV, agrivoltaico).

- La matrice d'istanza contiene **solo traslazione e scala 0,1**. La rotazione è nel vertex shader.
- Attributi d'istanza:
  - `aChiave`: distanza normalizzata dal tracker eroe, per l'onda;
  - `aOrdine`: ordine di montaggio, per il cantiere;
  - `aFila`: indice della fila, per la stringa 14-B.

```glsl
// patch del vertice (anche nel customDepthMaterial = MeshDepthMaterial con RGBADepthPacking)
attribute float aChiave; attribute float aOrdine; uniform float uAngolo, uComparsa, uModo;
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
// <beginnormal_vertex>:  objectNormal = rotZ(uAngolo) * objectNormal;
// <begin_vertex>:
float k = mix(aChiave, aOrdine, uModo);                   // uModo 0 = onda (tappa 3), 1 = cantiere (tappa 5)
float s = smoothstep(k, k + 0.1, uComparsa);
transformed = rotZ(uAngolo) * transformed;
transformed *= max(s, 1e-4);
transformed.y -= (1.0 - s) * 2.0;                         // sale da −2 m
```

- Dopo aver scritto le matrici: `computeBoundingSphere()`, poi `boundingSphere.radius += 0.15`, perché la rotazione allarga l'ingombro.
- Le matrici non si aggiornano mai sulla CPU durante lo scroll: si aggiorna solo l'uniform dell'angolo.
- **Modi di comparsa**:
  - `uModo = 0` (tappa 3, onda): tutte le parti di un campo usano `comparsaFV` o `comparsaAgri`;
  - `uModo = 1` (tappa 5, cantiere): ogni parte usa la propria uniform (`comparsaPali`, `comparsaTubi`, `comparsaModuli`).
  - A T = 15,50 un `tl.set` (reversibile) porta `uModo` a 1 e le comparse di cantiere a −0,1.
- `castShadow = receiveShadow = true` per moduli, tubi e pali.

**Tracker eroe**: non istanziato.

- Pezzi uniti con `mergeGeometries` per materiale (tutti indicizzati, con position, normal e uv).
- `toCreasedNormals(geo, π/6)` sui pezzi meccanici.
- `userData.offset` per la vista esplosa.
- Nelle istanze FV la sua posizione (fila 31, z da 7,379 a 13,901) è **esclusa** (scala 0 per quelle istanze) mentre l'eroe è visibile, e torna normale a T 8,72.

**Colture**: strisce verticali doppie (lunghe 1 u, alte 0,06 u), istanziate a righe ogni 0,075 u nelle particelle agrivoltaiche.

- Escluse entro 0,05 u dalle linee dei pali.
- Circa 7 600 istanze.
- Canvas di steli con `alphaTest 0,5`.
- Vento: `transformed.x += 0.4 * sin(uTempo*1.6 + pos.z*7.0) * uv.y*uv.y` (in metri).

**Alberi**: §3.4, con la patch `sollevamento` e `customDepthMaterial`.

### 6.7 Idroelettrico: geometrie procedurali, sezioni, acqua

Tutte le misure sono in metri dentro un gruppo × 0,1. Tutto è unito per materiale.

| Macchina | Parti |
|---|---|
| **Pelton** | **Disco**: `LatheGeometry` Ø 1,40 m, spessore 0,16 m. **22 cucchiai**: mezza coppa = quarto di sfera `SphereGeometry(1, 32, 16, 0, π, 0, π/2)` scalato a (0,13; 0,085; 0,15) m (lunghezza 0,26, profondità 0,085, mezza larghezza 0,15), specchiato in z: larghezza totale 0,30 m, cioè 3,2 volte il getto. **Cresta**: `ExtrudeGeometry` triangolare alta 0,02 m. **Intaglio**: i vertici del bordo entro ±0,15 di larghezza dalla cresta arretrano di 0,12 di larghezza. Più radice e blocco d'attacco. `InstancedMesh` attorno a Ø primitivo 1,68 m, concavità rivolta contro il moto (rotazione antioraria vista da +z). **Ugelli**: profilo con `Lathe` più spina a lancia (`Lathe`, corsa 0,08 m animata) più deviatore (piastra curva). **Carter**: semicilindro in grafite, tagliato da `ZP`. **Albero** lungo z e **generatore**. |
| **Francis** | **Corona e fascia**: `Lathe`. **15 pale**: `ParametricGeometry` tra la curva della corona e quella della fascia; ingresso a raggio 0,80 m in alto, uscita a 0,63 m in basso, avvolgimento 80°, curvatura a S, spessore con due fogli ±0,5·t·sin(πv), t = 0,03 m. **Chiocciola**: spazzata propria, θ = t·345°, raggio di mezzeria da 2,6 a 1,7 m, sezione `r(t) = 0,775·√(1 − 0,9t)` m; l'area cala in modo lineare, quindi la velocità resta costante. **Avantdistributore**: 20 pale fisse a raggio 1,25 m. **Distributore**: 20 pale direttrici istanziate a raggio 1,0 m, ciascuna ruotata sul proprio perno verticale di `apertura × 28°`. **Tubo di aspirazione**: la stessa spazzata con raggio crescente da 0,63 a 1,2 m, gomito verso +x. |
| **Kaplan** | **Mozzo**: bulbo `Lathe` Ø 1,9 m. **5 pale** `ParametricGeometry`: u dal mozzo alla punta, r = lerp(0,95; 2,25), calettamento = lerp(1,0; 0,35), corda = lerp(1,1; 1,7), curvatura 0,07·corda·sin(πv), spessore a due fogli. Ogni pala è in un gruppo-perno sull'asse radiale (passo = `passoKaplan`). **24 pale direttrici** a raggio 3,6 m, alte 1,8 m. **Anello di scarico** e **cono di aspirazione**: `Lathe`. **Semi-chiocciola** in calcestruzzo, sezione rettangolare, tagliata da `ZK`. |

**Sezioni**

- Gli involucri tagliati usano `clippingPlanes` assegnati **alla creazione** (con il piano già al valore iniziale), `clipShadows:true`, `side: DoubleSide`.
- La campitura della sezione si fa senza stencil. Dopo `dithering_fragment`: `if (!gl_FrontFacing) gl_FragColor.rgb = SEZIONE(gl_FragCoord.xy);` (grafite più tratteggio oro a 45°, §2.6).
- Mentre si vedono le sezioni, GTAO esclude gli involucri (`noAO`).

**Acqua**

- **Fiume** (PIANURA) e **laghi** (VALLE): nastro `BufferGeometry` lungo `CatmullRomCurve3(fiumeX)` largo 4,4 u, alla quota `acqua(z)` più 0,4 u a monte della traversa, con una fascia di schiuma.
  - Materiale `MeshPhysicalMaterial` (§2.6).
  - In `normal_fragment_maps`: due campioni della normal map procedurale che scorrono lungo v (`uv + vec2(0, t·0,05)` e `uv·1,7 − vec2(0,02, t·0,08)`).
  - Schiuma ai bordi: `smoothstep(0.42, 0.5, abs(vUv.x − 0.5))` × rumore, emissivo × 0,15.
  - **Niente `Water.js` né `Reflector`.**
- **Normal map dell'acqua**: canvas 512² di rumore di valore convertito in normale (Sobel a 4 campioni), `RepeatWrapping`, `NoColorSpace`.
- **Getti Pelton**: `CylinderGeometry(r, 1.12r, L, 32, 64, true)` lungo l'asse dell'ugello, `ShaderMaterial` additivo, `depthWrite:false`, `noAO`.
  - Vertici: increspatura `1 + 0,04 sin(y·14 − t·45) + 0,02 sin(y·31 − t·70)`.
  - Frammenti: fresnel × (0,2 + 1,8) più filamenti di rumore che scorrono, nucleo > 1 per il bloom.
  - `t = uTempo × tempoScala`. Più un alone esterno tenue (raggio × 1,6, alfa 0,08).
- **Spruzzi**: un `Points` per zona d'impatto (3 500 punti), senza lavoro sulla CPU.
  - `t = fract(uTempo·tempoScala·rate + seme.w)`; `pos = origine + vel(seme)·t + ½·(0, −9,81 m/s², 0)·t²`.
  - Le velocità escono ai lati della cresta (±z), deviate di circa 165°.
  - `gl_PointSize = uDim·uDPR·(1 − t)/−mvPosition.z` (**moltiplicato per il DPR**). Disco morbido, additivo.
- **Linee di corrente**: quad istanziati (larghi 2 px, lunghi 0,6–2 u) che scorrono su curve campionate a 64 punti in una `DataTexture` `FloatType` con `NearestFilter`.
  - Interpolazione manuale tra due campioni: **mai filtro lineare su texture float**.
  - Velocità e numero come in §4.5. Colore acqua × 2.
- **Colonne del diagramma**: shader del v1 migliorato (fresnel `pow(1 − |n·v|, 2)` × 0,38, strisce `fract(vUv.y·H·0,22 + t·v)`, nucleo × 0,2), additivo, `DoubleSide`, alfa totale ≤ 0,6. **Niente `transmission`.**
- **Velocità della girante a schermo**: `ω = min(ωreale × tempoScala, 0,45·(2π/Npale)·fpsMisurati)`, contro l'effetto "ruota di carro".

### 6.8 Qualità adattiva fino al 4K

**Livelli** (scelti all'avvio):

1. Prima stima da `WEBGL_debug_renderer_info`:
   - `/RTX|RX [67]\d{3}|Apple M\d (Pro|Max|Ultra)|Arc A7/` → Ultra;
   - `/Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/` → Media / Base.
2. Poi conferma con un benchmark di 90 fotogrammi durante l'intro, sull'inquadratura K0.1.

| Livello | Budget di pixel interni | MSAA | Ombra | GTAO | Iridescenza | Terreno | Note |
|---|---|---|---|---|---|---|---|
| Ultra | 8,3 MP (4K vero) | 0 + SMAA se > 3,7 MP, altrimenti 4 | 4096 | mezza risoluzione, solo nei primi piani | sì | 768² | — |
| Alta | 4,1 MP | come sopra | 2048 | mezza risoluzione, solo nei primi piani | sì | 512² | — |
| Media | 2,1 MP | 4 | 2048 | no | no | 512² | — |
| Base | 1,0 MP | 0 + SMAA | 1024 | no | no | 256² | Istanze FV a file alterne, niente colture fuori dal vicolo |

- **Risoluzione**: la tela è **sempre** a `dprNativo = min(devicePixelRatio, 2)`. La risoluzione interna del composer è `scala = min(1, √(budget / (innerWidth·innerHeight·dprNativo²)))`, moltiplicata dal governatore.
- Il passaggio Pellicola ricampiona alla risoluzione nativa con CAS e grana nativa: è il "4K percepito".

**Governatore**

- Media esponenziale `m = 0,95·m + 0,05·dt`.
- Intervallo del monitor = il `dt` minimo del primo secondo (60, 120 o 144 Hz).
- **Obiettivo = max(intervallo, 16,7 ms)**: si punta a 60 fps anche sugli schermi veloci.
- **Si scende** se `m > 1,35 × obiettivo` per 1,5 s. **Si sale** se `m < 0,8 × obiettivo` per 3 s.
- Al massimo **un cambio ogni 4 s**, applicato **solo** quando la velocità di scroll resta sotto 50 px/s per 300 ms, oppure durante un velo o una foschia.
- Gradini, uno alla volta, in quest'ordine:
  1. `scala ×` 1 → 0,85 → 0,7 → 0,6 (`composer.setPixelRatio` più `setSize`; la tela non cambia);
  2. GTAO spento;
  3. ombra 4096 → 2048 → 1024;
  4. MSAA 4 → 0 più SMAA;
  5. bloom spento.
- **Mai a runtime**: cambiare `shadowMap.type`, il numero di luci o i `defines` dei materiali.

**Pausa**:

- render fermo con `visibilitychange` (scheda nascosta) e con velo a 1;
- 30 fps e `scala` 0,5 sotto le sezioni HTML;
- 30 fps nel finale fermo da più di 4 s.

**Un solo ciclo**: `gsap.ticker` guida Lenis, ScrollTrigger, la camera e il render nello stesso fotogramma.

```js
gsap.registerPlugin(ScrollTrigger);
const lenis = riduci ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, smoothWheel: true });
if (lenis){ lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0); }
gsap.ticker.add(disegna);
const tl = gsap.timeline({ defaults:{ ease:'none' },
  scrollTrigger:{ trigger:'#storia', start:'top top', end:'bottom bottom', scrub: lenis ? true : 0.6 } });
tl.to(STATO_T, { T: 19, duration: 19 }, 0);   // 1 unità di timeline = 1 schermo; poi tutti i tween delle tabelle §4 alle loro posizioni T
// Niente snap di ScrollTrigger con Lenis. Niente "pin": i testi sono livelli fissi pilotati dalla timeline.
```

### 6.9 Caricamento, warm-up, niente scatti

1. **Ordine di caricamento**:
   1. font (`document.fonts.load` per ogni peso, prima di disegnare testo su canvas);
   2. HDRI qwantani con de-solazione;
   3. set WebP `terreno_erba_roccia` e `terreno_campo`;
   4. generazione delle geometrie: terreno, catasto e maschere, layout, alberi;
   5. compilazione;
   6. warm-up.
2. **Dopo la prima immagine**, con `requestIdleCallback`:
   - HDRI kloofendal e autumn_field;
   - set `cemento_diga` e `metallo_lamiera`;
   - costruzione della scena VALLE;
   - `compileAsync(valle)`;
   - warm-up della VALLE.
3. **Warm-up**: tutti gli oggetti della scena `visible = true` (compresi fogli, sigillo, tracker eroe, istanze), materiali nello stato finale (piani di taglio assegnati, ambiente assegnato), poi `await renderer.compileAsync(scena, camera)`.
   - Poi `renderer.initTexture(t)` per ogni texture.
   - Poi **un `composer.render()` completo** per ogni configurazione, con l'ombra aggiornata:
     - PIANURA: K0.1, K3.1 (con GTAO), K3.5, K3.7, K6.0;
     - VALLE: V4.0, V4.4 (con GTAO e luci rettangolari), V4.6.
   - Infine si ripristina la visibilità.
4. **Controllo**: `renderer.info.programs.length` dopo il warm-up deve essere uguale al valore dopo uno scroll completo (test §6.13).
5. Se l'utente salta alla tappa 4 prima che la VALLE sia pronta: il velo resta nero e nell'HUD compare `PREPARAZIONE DELLA VALLE · %` (al massimo 3 s, poi si prosegue).

### 6.10 Regole di performance

- Meno di **250 chiamate di disegno** per fotogramma e meno di **3 milioni di triangoli** visibili.
- Una sola scena attiva.
- Ombre aggiornate solo quando serve.
- Ricotture PMREM solo nei T indicati.
- GTAO solo nei primi piani e a mezza risoluzione.
- Bloom alla mezza risoluzione interna (predefinita).
- Niente `backdrop-filter`, niente grana CSS, niente ombre CSS animate sopra la tela.
- Niente `Water.js` o `Reflector`, niente `BokehPass`, niente `transmission`.
- Niente aggiornamenti CPU di matrici d'istanza durante lo scroll.
- Niente stencil.
- Tutti i `DataTexture` float con `NearestFilter`.
- Etichette mosse con `transform: translate3d`, al massimo 3. HUD a 15 Hz.
- Liberare (`dispose`) le texture d'ambiente sostituite e le geometrie temporanee della generazione.

### 6.11 Riduci movimento (`prefers-reduced-motion: reduce`)

Si ascolta il cambio con `matchMedia(...).addEventListener('change', …)` e si ricarica lo stato senza ricaricare la pagina.

- Niente Lenis: scroll nativo e `scrub: 0.6`. Niente intro animata (§5.2).
- **Camera**: niente voli. In ogni intervallo di T si mostra la sosta più vicina. Al cambio di sosta c'è una dissolvenza di 300 ms attraverso il velo. Niente deriva, niente parallasse, niente rollio.
- **Animazioni continue ferme**:
  - sole fisso alle 10:00 (el 46,4°, tracker −43,2°) in tappa 3;
  - acqua con strisce ferme;
  - giranti, impulsi, spruzzi e colture fermi;
  - grana statica.
- Gli stati delle tappe (vincoli, layout, sigillo, sezioni) saltano al valore finale della battuta.
- Testi in dissolvenza di 200 ms, senza maschere né "decodifica". Cursore di sistema.

### 6.12 Schermi piccoli, niente WebGL, perdita del contesto

- **Sotto i 900 px oppure con `pointer: coarse`**:
  - livello Base;
  - colonna del testo in basso, a tutta larghezza, con velo verticale `linear-gradient(0deg, rgba(5,6,7,.9) 0%, rgba(5,6,7,0) 55%)`;
  - fov allargato con la regola di §4.0;
  - etichette: al massimo 1;
  - HUD ridotto alla sola maturità;
  - niente indice, cursore di sistema, intro breve.
  - **Non deve rompersi**: nessun errore, nessuno scroll orizzontale, il testo si legge.
- **Senza WebGL2** (`WebGL.isWebGL2Available()` falso):
  - classe `no-webgl`, la tela non si crea;
  - fondo `radial-gradient(ellipse at 60% 40%, #0d1012 0%, #050607 70%)` con il simbolo del logo in filigrana;
  - `#storia` diventa una sequenza di blocchi normali (ogni battuta alta almeno 70vh, testo visibile, legende e diagrammi HTML funzionanti);
  - sezioni intatte.
- **`webglcontextlost`**: `preventDefault()`, velo a 1 e scritta `Ripristino della scena…`. Con `webglcontextrestored` si ricostruiscono render target e cotture. Se il ripristino non arriva entro 3 s, si passa alla modalità `no-webgl`.

### 6.13 Modalità test e debug

- **`?test=1`**:
  - DPR 1, livello Base, Lenis spento;
  - orologio fisso (`uTempo` avanzato a mano);
  - `preserveDrawingBuffer: true`;
  - `window.__eri = { pronto: Promise, vaiA(T), info: () => renderer.info, contrasto(battuta) }`.
- **Prove automatiche** (Chromium headless con `--use-angle=swiftshader --enable-unsafe-swiftshader`, timeout 120 s):
  - zero `console.error`, nessun `webglcontextlost`;
  - `info.programs.length` stabile dopo un giro completo;
  - una schermata 1280×720 per ogni sosta, confrontata con tolleranza;
  - pixel di controllo: centro non nero; oro presente in K1.1, K2.2 e K6.0;
  - **in K3.5 almeno lo 0,5% dei pixel del campo con luminanza > 0,9** (onda di riflessi);
  - contrasto del testo **≥ 4,5:1, obiettivo 7:1**, misurato sotto i riquadri di ogni battuta.
  - La stessa serie con `?q=ultra`, per trovare eccezioni nel percorso pesante.
- **`?debug=1`**:
  - pannello con ms, fps, chiamate di disegno, triangoli, programmi, livello, scala, T e keyframe attivo;
  - carta grigia 18% (sfera e piano) per tarare luce ed `envMapIntensity`;
  - freccia verso `azHDRI`;
  - tasti ← e → per saltare tra le soste.
- **Altri parametri**:
  - `?q=ultra|alta|media|base` forza il livello;
  - `?tm=agx` per il confronto del tone mapping;
  - `?t=12.8` per partire da un T.

### 6.14 Modelli .glb opzionali

- File (facoltativi): `../asset/modelli/tracker.glb`, `kaplan.glb`, `francis.glb`, `pelton.glb`.
- Si controllano con `fetch(url, {method:'HEAD'})`. Se rispondono 200: `GLTFLoader` più `DRACOLoader` (`setDecoderPath` come in §6.1).
- Normalizzazione:
  - `Box3` per centrare;
  - scala alla dimensione di riferimento: tracker 65 m di fila o un modulo 2,384 m; Kaplan Ø 4,5 m; Francis D1 1,6 m; Pelton Ø 2,0 m;
  - asse come in §3.6.
- **Materiali della casa** al posto di quelli del file, per nome della mesh:
  - `blade|bucket|runner|pala|cucchiaio|girante` → inox;
  - `casing|housing|cassa` → grafite;
  - `glass|module|modulo` → vetro del modulo;
  - il resto → acciaio zincato.
- `tracker.glb`: se contiene un solo modulo, la sua geometria (unita) diventa la geometria istanziata del modulo, con verifica di dimensioni e assi. Altrimenti si usa solo per il tracker eroe.
- **Qualunque errore** (404, decodifica, dimensioni assurde) fa tornare alla forma procedurale **senza messaggi all'utente** (solo `console.info`).
- I modelli devono restare sotto 3 MB ciascuno.

### 6.15 Ordine di costruzione consigliato

1. **Base**:
   - `config.js` e `nebbia.js`;
   - renderer, composer, Pellicola, cielo e ambiente con de-solazione;
   - rig della camera, scroll e timeline vuota;
   - qualità adattiva e debug.
2. **Terreno della PIANURA**: catasto, vincoli, maschere, overlay, sollevamento. Tappe 0–2, testi e HUD.
3. **Tracker**: istanze, tracker eroe, sole e backtracking, agrivoltaico con colture. Tappa 3.
4. **VALLE**: plastico, sezione, righello, Pelton, Francis, Kaplan, acqua, diagramma. Tappa 4.
5. **Cantiere e finale**: tappe 5–6, logo, sezioni HTML, contatti.
6. **Collaudo**:
   - riduci movimento, schermi piccoli, niente WebGL;
   - prestazioni a 1080p, 1440p e 4K;
   - prove automatiche;
   - revisione dei contenuti con ERI.

---

## 7. Rischi e cose da evitare

### 7.1 Identità ed effetto

- **Non perdere il nero-oro del v1.**
  - In ogni tappa c'è almeno un elemento oro sul buio.
  - Il cielo "giorno" è volutamente scuro.
  - Niente mezzogiorni fotorealistici in campo larghissimo: l'unico mezzogiorno (K3.5) è un campo medio dall'alto con l'onda di riflessi.
- **Niente effetto videogioco o Google Earth**: luce d'oro o blu, campi medi, overlay sempre presenti, albedo ridotta. Niente oggetti di contorno "economici": niente casale, cipressi, ruderi, droni o figure umane. Il trattore è solo una **sagoma tecnica in linee oro**.
- **Vietati**: aberrazione cromatica, lens flare, raggi di luce, glitch, tilt-shift, HUD ciano o neon, griglie stile Tron, rimbalzi, logo che gira in 3D, **turbine color oro o bronzo** (le giranti sono in inox).
- **Logo**: mai ricolorato, mai estruso, mai ruotato in 3D. Si usa solo in 2D con i colori ufficiali (preloader, testata, petali del finale, footer). I petali in oro dell'indice o altre varianti si fanno solo con l'approvazione del titolare.
- **Affollamento**: al massimo 3 etichette e un accento di colore per inquadratura. Un livello esce prima che entri il successivo. Nella vista esplosa solo 6 componenti.
- **Durata**: la storia dura 19 schermi, ed è il massimo. L'idroelettrico occupa 4 schermi. L'indice cliccabile e "Salta ai servizi" sono obbligatori.

### 7.2 Correttezza dei contenuti (da far rivedere a ERI prima della pubblicazione)

- **Iter autorizzativo**: "PAS o Autorizzazione Unica, con VIA quando richiesta".
  - Non è una catena e non sono "tre regimi".
  - La VIA accompagna l'AU (o confluisce nel PAUR) quando è richiesta.
  - Il diagramma è a binari, con l'esempio acceso.
- **Connessione e GSE** sono corsie parallele. Il GSE non viene dopo la STMG. Nessuna promessa di "connessione certa".
- **Tracker**:
  - asse nord-sud, rotazione est-ovest, ±60°, backtracking con GCR 0,40;
  - il sole di giugno sorge a nord-est (56,7°) e tramonta a nord-ovest (303,3°);
  - **ogni angolo dell'HUD esce dalla funzione** di §6.3; nessun numero scritto a mano.
- **Agrivoltaico**: 4,5 m è l'**altezza dell'asse**. Il bordo inferiore a 60° sta a ≈3,5 m.
- **Idroelettrico**:
  - intervalli < 40 m, 40–400 m, > 300 m, con le sovrapposizioni vere;
  - Pelton ad azione, con getto tangente alla circonferenza primitiva, cucchiai doppi con cresta e intaglio, cassa a pressione atmosferica;
  - Francis con ingresso radiale e uscita assiale, pale direttrici regolabili;
  - Kaplan assiale con pale orientabili e doppia regolazione, "ad acqua fluente / traversa" (mai "a pelo libero");
  - P = ρ·g·Q·H·η; Pelton a schermo sotto 1,25 giri/s;
  - condotte dimensionate a circa 4 m/s.
- **Numeri**:
  - tutti illustrativi e marcati come tali;
  - nessuna statistica aziendale inventata: in Chi siamo solo segnaposto dichiarati;
  - niente potenza istantanea di notte (la piastra dati è alle 16:00 di una giornata serena, "simulazione").
- **Normativa** (D.Lgs. 42/2004, fascia di 150 m, PAI, Natura 2000): riferimenti piccoli, **da validare con ERI**. Niente citazioni grandi di D.Lgs. 199/2021, D.Lgs. 190/2024 o DM aree idonee senza una verifica.
- **Eolico**: zero tracce (testi, indice, icone, orizzonte, meta, alt, footer, codice). Il v2 non copia nulla dal codice eolico del v1 (`main.js` del v1, righe 382–406, 558–611).

### 7.3 Rischi tecnici e contromisure

| Rischio | Contromisura |
|---|---|
| Scatti alla prima comparsa (compilazione degli shader) | Warm-up §6.9 con tutti gli oggetti visibili; controllo di `programs.length` |
| Ombre che non ruotano o non si sollevano | `customDepthMaterial` con la stessa patch (§6.4) |
| GTAO che scurisce trasparenze e linee (le `LineSegments2` sono Mesh) | `noAO`, più GTAO solo nei primi piani |
| Clipping ignorato dall'AO | Involucri tagliati in `noAO` |
| Cielo sfocato a 4K | La HDRI non è mai sfondo: cielo procedurale |
| Doppio sole (HDRI più DirectionalLight) | De-solazione e rotazione `uRot` |
| Banding nei neri | Dithering nella Pellicola, render target HalfFloat |
| Moiré di file e isoipse in lontananza | Svanimento con `fwidth`, mipmap e anisotropia |
| Collisione della camera con le file sotto la tettoia | Voli ancorati alla camera (K3.65–K3.9), posizioni verificate |
| Scatti nel ridimensionare i render target | Gradini discreti, solo a camera ferma o sotto velo; tela sempre nativa |
| Lenis e ScrollTrigger in lotta | `scrub: true`, niente snap, niente pin, un solo `gsap.ticker` |
| Texture float filtrate in lineare (SwiftShader) | `NearestFilter` più interpolazione manuale |
| Cotture PMREM che consumano memoria | `dispose()` della precedente; cotture solo nei T di tabella |
| Peso | HDRI: prima la 1K se esiste; WebP; VALLE caricata in idle; HDRI e texture lazy dopo la prima immagine |
| Leggibilità | Colonna sinistra riservata più velo; contrasto misurato ≥ 4,5:1 (obiettivo 7:1); mai testo sopra il disco solare (verificato: il sole sta a sx ≥ 0,65) |

---

## Appendice A · Sole e tracker (verifica)

21 giugno 2026, lat 42,0° N, lon 12,5° E, ora legale (UTC+2).

- **Alba** 05:34 (az 56,7°), **tramonto** 20:49 (az 303,3°).
- **Mezzogiorno solare** 13:11 (el 71,45°, az 180,0°).
- Equazione del tempo −1,3 min, declinazione 23,45°.

| Ora | El. | Az. | Tracker FV (GCR 0,40) | Stato FV | Tracker agrivoltaico (GCR 0,24) | Stato agrivoltaico |
|---|---|---|---|---|---|---|
| 05:45 | 0,9° | 58,6° | −1,6° | BACKTRACKING | −3,3° | BACKTRACKING |
| 06:10 | 4,95° | 62,6° | −8,5° | BACKTRACKING | −18,3° | BACKTRACKING |
| 06:30 | 8,3° | 65,8° | −14,2° | BACKTRACKING | −32,0° | BACKTRACKING |
| 07:00 | 13,5° | 70,4° | −23,7° | BACKTRACKING | −60,0° | FINE CORSA |
| 08:00 | 24,2° | 79,5° | −60,0° | FINE CORSA | −60,0° | FINE CORSA |
| 09:00 | 35,3° | 88,9° | −54,7° | INSEGUIMENTO | −54,7° | INSEGUIMENTO |
| 09:40 | 42,7° | 95,9° | −47,1° | INSEGUIMENTO | −47,1° | INSEGUIMENTO |
| 10:00 | 46,4° | 99,7° | −43,2° | INSEGUIMENTO | −43,2° | INSEGUIMENTO |
| 12:00 | 66,3° | 135,8° | −17,1° | INSEGUIMENTO | −17,1° | INSEGUIMENTO |
| 13:14 | 71,4° | 181,9° | +0,6° | INSEGUIMENTO | +0,6° | INSEGUIMENTO |
| 15:00 | 60,8° | 239,1° | +25,6° | INSEGUIMENTO | +25,6° | INSEGUIMENTO |
| 16:00 | 50,5° | 255,5° | +38,6° | INSEGUIMENTO | +38,6° | INSEGUIMENTO |
| 17:30 | 33,9° | 272,3° | +56,1° | INSEGUIMENTO | +56,1° | INSEGUIMENTO |
| 18:30 | 22,9° | 281,6° | +58,2° | BACKTRACKING | +60,0° | FINE CORSA |
| 19:00 | 17,5° | 286,1° | +33,0° | BACKTRACKING | +60,0° | FINE CORSA |
| 20:00 | 7,05° | 295,4° | +12,0° | BACKTRACKING | +26,6° | BACKTRACKING |
| 20:30 | 2,1° | 300,2° | +3,7° | BACKTRACKING | +7,8° | BACKTRACKING |

**Produzione** (modello di cielo sereno, 10,37 MWp, 9,0 MWac, perdite 14%, "simulazione"):

- alle 16:00: **8,6 MW**; energia dall'alba alle 16:00: **75,4 MWh**;
- giornata intera: tracker 101 MWh contro impianto fisso a 30° sud 72,8 MWh, rapporto 1,39;
- la curva dei tracker è "a campana larga" ed è tagliata a 9,0 MW tra le 10:30 e le 15:00 circa.

## Appendice B · Numeri idroelettrici (verifica, η = 0,9)

| | Pelton | Francis | Kaplan |
|---|---|---|---|
| Salto H | 700 m | 150 m | 12 m |
| Portata Q | 1,6 m³/s | 7,5 m³/s | 95 m³/s |
| P = 9,81·Q·H·η | **9,89 MW** | **9,93 MW** | **10,07 MW** |
| √(2gH) | 117,2 m/s (getto 0,98 × = 114,8 m/s) | 54,2 m/s | 15,3 m/s |
| Rapporto delle velocità a schermo | 7,6 | 3,5 | 1 |
| Condotta (v ≈ 4 m/s) | Ø 0,71 m | Ø 1,55 m | — (presa a canale) |
| Giri al minuto (sincroni, indicativi) | 600 (2 getti) | 600 | 150 |
| Numero di giri specifico n_s | 12 per getto | 114 | 674 |
| Dimensioni | Ø primitivo 1,68 m; getto Ø 9,4 cm; D/d 17,9; 22 cucchiai larghi 0,30 m; velocità periferica 52,8 m/s (0,46 × getto) | D1 1,60 m; D2 1,26 m; 15 pale; 20 + 20 pale fisse e direttrici | Ø 4,5 m (calcolato 4,58 a 7 m/s assiali); mozzo 0,42; 5 pale; 24 pale direttrici |
| Linee di corrente a schermo | 2 | 5 | 59 |
| Raggio della colonna (0,55·√Q) | 0,70 u | 1,51 u | 5,36 u |
| Diagramma (x, y) | (30,1; 51,8) | (46,9; 39,6) | (74,4; 19,6) |

Rette di isopotenza: H = P / (8,829·Q), con P in kW (1 MW: H = 113 m a Q = 1; 10 MW: 1 133 m a Q = 1).

## Appendice C · Composizione verificata (proiezione 16:9)

Coordinate schermo (sx; sy) da 0 a 1, con l'origine in alto a sinistra. La colonna del testo occupa sx < 0,38.

| Keyframe | Soggetti | Sole |
|---|---|---|
| K0.0 | fiume a z = 0 (0,50; 0,58) · sito (0,51; 0,34) | — |
| K0.1 | sito (0,62; 0,55) · CP (0,81; 0,40) · crinale (0,47; 0,28) | fuori campo |
| K1.0 | fiume (0,63; 0,53) · paesaggistico (0,73; 0,43) · archeologico (0,61; 0,72) · sito (0,44; 0,58) | fuori campo |
| K1.1 | fiume (0,65; 0,47) · paesaggistico (0,69; 0,35) · archeologico (0,69; 0,66) · sito (0,50; 0,61) | fuori campo |
| K1.2 | sito (0,66; 0,55) · P.lle 117–118 (0,56; 0,52) · ancoraggio del sopralluogo (0,72; 0,72) | fuori campo |
| K1.3 | sito (0,66; 0,52) · punto di connessione (0,86; 0,82) | — |
| K2.0 | sito (0,44; 0,50) · CP (0,89; 0,51) | sotto l'orizzonte |
| K2.1 | cabina di consegna (0,42; 0,59) · cavo (0,66; 0,51) · CP (0,87; 0,47) | sotto l'orizzonte |
| K2.2 | sito e sigillo (0,64; 0,50) | — |
| K3.0 | sito (0,59; 0,58) | **(0,93; 0,28)** |
| K3.1 | motoriduttore (0,62; 0,56) | fuori campo (controluce da destra) |
| K3.3 | centro del campo (0,63; 0,51) | — |
| K3.5 | centro del campo (0,60; 0,55) | alle spalle (riflesso speculare verso la camera) |
| K3.7 | fondo del vicolo (0,60; 0,56) | fuori campo a sinistra |
| K5.2 | 14-B (0,55; 0,62) · piastra (0,73; 0,66) · capannone (0,63; 0,33) | fuori campo |
| K6.0 | FV (0,75; 0,64) · agrivoltaico (0,85; 0,78) · traversa (0,80; 0,55) | **(0,65; 0,35)**: centro dei petali |

## Appendice D · Criteri di accettazione

1. Zero errori in console. 60 fps a 2560×1440 con DPR 1,5 su una GPU di fascia alta (livello Alta). Nessun calo sotto i 45 fps nei voli.
2. A 3840×2160 (livello Ultra) l'immagine è nitida: righe, isoipse e testi senza scalettature.
3. `renderer.info.programs.length` è uguale prima e dopo uno scroll completo.
4. Ogni keyframe rispetta l'Appendice C (tolleranza ±0,03).
5. Il tracker eroe si monta senza compenetrazioni. Le ombre dei tracker ruotano con i moduli. L'onda di riflessi è visibile in K3.5.
6. I numeri dell'HUD solare coincidono con l'Appendice A (±0,2°).
7. Le tre turbine si distinguono a colpo d'occhio: forma, colonna (altezza e spessore), velocità delle linee. I testi rispettano §7.2.
8. Il contrasto del testo è ≥ 4,5:1 in ogni battuta. Mai testo sopra il disco solare. Al massimo 3 etichette.
9. Riduci movimento, schermi stretti (375 px) e assenza di WebGL2 funzionano senza errori e senza scroll orizzontale.
10. Nessuna parola, icona o geometria legata all'eolico.
