# ERI v2 · Architettura (contratto vincolante)

Questo documento è il contratto tecnico fra i pacchetti di lavoro. Vale insieme a `DESIGN.md`, che resta normativo per i contenuti, i numeri e la coreografia. Se i due documenti non sono d'accordo su un'interfaccia, vale questo. Se non sono d'accordo su un numero o su un contenuto, vale `DESIGN.md`. In entrambi i casi la discrepanza va segnalata al lead.

Stato attuale: tutti i file esistono. `config.js`, `geo.js`, `regia/stato.js`, `main.js` e `luce/nebbia.js` sono completi. Gli altri sono stub che rispettano le firme. Alcuni stub già funzionano in modo grezzo (camera, scroll, sole, pipeline, qualità, testi, intro, test) per permettere il lavoro in parallelo. La pagina si carica senza errori in console; `window.__eri.pronto` diventa vero e `vaiT` funziona.

---

## 0. Regole d'oro (valgono per tutti)

1. **Si modificano solo i file del proprio pacchetto** (§1). Un pacchetto può aggiungere file privati nelle cartelle dove ha già dei file. Il nome comincia con quello del modulo (es. `impianti/tracker-eroe.js`) e il file si importa solo dai moduli dello stesso pacchetto. `main.js` importa solo i file dell'albero.
2. **`config.js` è l'unica fonte dei numeri normativi.** Non si copiano numeri di `DESIGN.md` nei moduli: si importano da `config.js`. Chi ha bisogno di un valore nuovo o di una taratura lo chiede al lead. Nel frattempo può usare una costante locale marcata `// TARATURA: proporre in config`.
3. **Ogni animazione legata allo scroll è una funzione pura di T** (§5). Mai stato accumulato fra fotogrammi per ciò che dipende dallo scroll. È così che funzionano lo scroll all'indietro, `vaiT` e il riduci movimento.
4. **Tutti gli oggetti si creano in `crea()`**, anche quelli nascosti. Non si aggiunge nulla alle scene dopo il warm-up. In `aggiorna()` si cambiano solo `visible`, le trasformazioni e i valori delle uniform. Non si allocano oggetti.
5. **Non si cambiano a runtime** i `defines` dei materiali, `transparent`, `side`, `clippingPlanes`, `fog`, il numero di luci, `shadowMap.type` e `castShadow` (§6.8, §6.10). Lo stato iniziale di questi valori deve essere quello definitivo.
6. **Ogni materiale si crea con `nuovoMateriale()`** di `luce/nebbia.js` (§7). Le uniform condivise si collegano per riferimento da `ctx.U`.
7. **Zero errori in console**: niente richieste che rispondono 404 (quindi niente `HEAD` di prova) e niente `console.error` nei casi normali. `console.warn` e `console.info` si usano solo per avvisi veri.
8. Commenti in italiano, testo visibile in italiano, numeri all'italiana (`geo.numeroIt`). **Nessuna traccia dell'eolico.**
9. `metallo_lamiera` è una lamiera mandorlata arrugginita: si usa solo per casse, carter e tetti, **mai** per tracker o giranti.

---

## 1. Albero dei file e proprietà

| File | Pacchetto | Stato | Ruolo |
|---|---|---|---|
| `ARCHITETTURA.md` | ARCH | completo | questo contratto |
| `js/main.js` | ARCH | completo | avvio, caricatore, warm-up, ciclo unico, cambio di mondo, `window.__eri` |
| `js/config.js` | ARCH | completo | costanti normative, keyframe, tracce, battute, etichette, HUD |
| `js/geo.js` | ARCH | completo | funzioni pure: `altezza`, catasto, sole, tracker, layout, valle, formati (aggiunto all'albero di §6.2) |
| `js/regia/stato.js` | ARCH | completo | STATO, tracce, uniform condivise `U`, easing, `fase()` |
| `js/luce/nebbia.js` | BASE-RENDER | **completo** (ARCH) | chunk della nebbia, `nuovoMateriale`, `aggiungiPatch`, registro ENV |
| `js/luce/sole.js` | BASE-RENDER | stub funzionante | luci sole ed emisfera per scena; riesporta le funzioni solari di `geo.js` |
| `js/luce/cielo.js` | BASE-RENDER | stub (ambiente grezzo) | cupole, de-solazione, cotture PMREM |
| `js/render/pipeline.js` | BASE-RENDER | stub funzionante (render diretto) | renderer, composer, Pellicola |
| `js/render/ombre.js` | BASE-RENDER | stub | `adattaOmbra`, aggiornamento su richiesta |
| `js/render/qualita.js` | BASE-RENDER | stub funzionante (scelta del livello) | livelli, governatore |
| `js/regia/camera.js` | BASE-REGIA | stub funzionante (interpolazione semplice) | rig §4.0 |
| `js/regia/scroll.js` | BASE-REGIA | stub funzionante (scroll nativo) | Lenis, T, veli delle sezioni |
| `js/test.js` | BASE-REGIA | stub funzionante (pannello minimo) | `?test=1`, `?debug=1` |
| `js/ui/testi.js` | BASE-REGIA | stub funzionante (accende e spegne) | battute, divisore di righe, decodifica, `.scrim` |
| `index.html` | BASE-UI | scheletro con tutti i testi delle battute | markup §5 |
| `css/stile.css` | BASE-UI | scheletro | token, tipografia, layout |
| `js/ui/intro.js` | BASE-UI | stub (chiude il preloader) | preloader, logo, intro |
| `js/ui/indice.js` | BASE-UI | stub | testata e indice (aggiunto all'albero) |
| `js/ui/etichette.js` | BASE-UI | stub | etichette 3D |
| `js/ui/hud.js` | BASE-UI | stub | HUD e strumenti di tappa |
| `js/ui/cursore.js` | BASE-UI | stub | mirino, hover delle particelle, `rendiMagnetico` |
| `js/ui/lineaOro.js` | BASE-UI | stub | componente LineaOro e transizione 4 → 5 |
| `js/ui/servizi.js` | BASE-UI | stub | Chi siamo e Servizi |
| `js/ui/contatti.js` | BASE-UI | stub | Contatti e modulo di prova |
| `js/mondo/terreno.js` | PIANURA | stub | mesh e shader del terreno |
| `js/mondo/catasto.js` | PIANURA | stub | tStati, tVincoli, tMaschere; fogli GIS, lunetta, tende, percorso, layout, sigillo, polvere |
| `js/mondo/fiume.js` | PIANURA | stub | nastro del fiume, normal map dell'acqua, traversa |
| `js/mondo/contorno.js` | PIANURA | stub | alberi, ponte, cabine, CP, capannone, cavidotto |
| `js/impianti/tracker.js` | FV | stub | tracker FV e agrivoltaici istanziati, tracker eroe |
| `js/impianti/agri.js` | FV | stub | colture, quote, trattore |
| `js/impianti/cantiere.js` | FINALE | stub | picchetti, recinzione, battipali (tappa 5) |
| `js/ui/finale.js` | FINALE | stub | archi dei fornitori, piastra dati 5b, petali del logo (tappe 5 e 6) |
| `js/idro/valle.js` | VALLE | stub | plastico, sezione, laghi, edifici, righello, piani di taglio, luci della valle |
| `js/idro/pelton.js`, `francis.js`, `kaplan.js` | VALLE | stub | macchine procedurali |
| `js/idro/acqua.js` | VALLE | stub | getti, spruzzi, linee di corrente, colonne |
| `js/idro/diagramma.js` | VALLE | stub | diagramma 4e |

Ogni stub ha in testa un commento in italiano con le sezioni di `DESIGN.md` da implementare e il proprio contratto.

---

## 2. Avvio (main.js)

1. Lettura dei parametri dell'URL (§13) e capacità. Senza WebGL2, o con `?nowebgl=1`, la pagina entra nella modalità `html.no-webgl`: si creano solo `testi`, `indice`, `servizi`, `contatti` e `intro`, e `pronto` diventa vero.
2. `import './luce/nebbia.js'` statico, **prima di tutto**. Poi `import()` dinamico di tutti gli altri moduli, in parallelo. Un modulo che non si carica viene escluso e scrive un solo `console.error`.
3. `intro.crea(ctx)`: preloader subito, con solo DOM, eventi e caricatore.
4. `RectAreaLightUniformsLib.init()` → `pipeline.creaRenderer(ctx)` → `qualita.crea(ctx)` → scene `{pianura, valle}` e camera → `creaStato()` → `ctx.dati.layout` → `pipeline.crea(ctx)`.
5. Caricamento in ordine (§6.9), con gli eventi di avanzamento: font (gruppo FONT), HDRI qwantani (CIELO, a byte), `terreno_erba_roccia` + `terreno_campo` (TERRENO).
6. `crea()` di sistema: `nebbia, sole, cielo, ombre, scroll, camera`.
7. `crea()` della PIANURA nell'ordine `catasto, terreno, fiume, contorno, tracker, agri, cantiere` (GEOMETRIA), poi la UI (`testi, etichette, hud, cursore, lineaOro, finale, indice, servizi, contatti, test`).
8. **Warm-up della PIANURA**: tutti gli oggetti visibili, poi `compileAsync` (o `compile` se manca `KHR_parallel_shader_compile`), `initTexture` di ogni texture (SHADER). Poi un render completo, con l'ombra aggiornata, per ogni T di `config.WARMUP.pianura` (VERIFICA). Infine si ripristina la visibilità.
9. Parte il ciclo (`gsap.ticker`, oppure `requestAnimationFrame`). Si salta al T iniziale. `__eri.pronto = true` ed evento `'pronto'`.
10. **VALLE in idle** (`requestIdleCallback`): HDRI kloofendal, set `cemento_diga` e `metallo_lamiera`, `crea()` di `valle, pelton, francis, kaplan, acqua, diagramma` (in quest'ordine), `ctx.cielo.cotturaValle()`, warm-up della VALLE. I render di warm-up sono sincroni e il mondo corrente si ridisegna nello stesso task: allo schermo non arriva mai un fotogramma della valle. Poi `ctx.valle.pronta = true` ed evento `'valle-pronta'`. Infine HDRI autumn.

Se l'utente entra nella VALLE prima che sia pronta, `ctx.veli.valle = 1` per al massimo 3 s. L'HUD mostra `PREPARAZIONE DELLA VALLE · {ctx.valle.progresso}` e `vaiT` aspetta la costruzione.

**Gruppi del preloader** (`config.CARICAMENTO`, somma 1): FONT 0,05 · CIELO 0,20 · TERRENO 0,25 · GEOMETRIA 0,15 · SHADER 0,25 · VERIFICA 0,10.

---

## 3. Il contesto condiviso `ctx`

Lo stesso oggetto passa a ogni funzione di ogni modulo.

| Campo | Tipo | Chi lo scrive | Note |
|---|---|---|---|
| `THREE`, `config`, `geo` | moduli | main | `config` = tutto `config.js` |
| `flags` | `{test, debug, T0, q, tm, riduci, piccolo, nowebgl, intro, lenis}` | main | §13; `riduci` cambia a runtime (evento `'riduci'`) |
| `canvas`, `renderer`, `dprNativo` | | main / pipeline | `dprNativo = min(devicePixelRatio, 2)`, 1 in test |
| `pipeline` | §6 | pipeline | |
| `qualita` | §12 | qualita | |
| `scene` | `{pianura: Scene, valle: Scene}` | main | i moduli aggiungono qui i loro oggetti |
| `camera` | `PerspectiveCamera` | main (scrive il rig) | **una sola** camera per le due scene, `rotation.order = 'YXZ'` |
| `mondo` | `'pianura' \| 'valle'` | main | mondo attivo |
| `stato`, `STATO`, `U` | §5 | stato.js | |
| `tempo` | `{t, dt, T, frame, fps}` | main | `t` in secondi (fisso a 1/60 per fotogramma con `?test=1`) |
| `regia` | `{target, posizione, d, phi, psi, fov, vicino, lontano, meta, centroOmbra, keyframe, inSosta, mondo}` | camera | `target`, `posizione` e `centroOmbra` sono `Vector3` |
| `rig`, `scroll`, `luci`, `cielo`, `ombre`, `nebbia` | servizi | moduli di sistema | §6 |
| `carica` | caricatore | main | §10 |
| `eventi` | `{on(n,f) → off, off, emit}` | main | §11 |
| `ancore` | `Map<string, Vector3 \| () => Vector3 \| Vector3[]>` | moduli | §9 |
| `dati` | oggetto | moduli | dati pubblicati, uno spazio per modulo (§6) |
| `proietta(v, out?)` | → `{x, y, z, davanti, dentro}` | main | px CSS con la camera corrente |
| `veli` | `{stato, sezioni, regia, valle, contesto, intro}` | vari | l'opacità di `.velo` è il **massimo**, scritto da main in `ctx.velo` |
| `valle` | `{costruita, pronta, progresso, stato}` | main | |
| `introFinita`, `inWarmup`, `noWebGL` | boolean | intro / main | in `inWarmup` la UI non si aggiorna e non partono eventi |

---

## 4. Il fotogramma (ordine vincolante)

```
1  orologio        ctx.tempo (t, dt, frame)
2  scroll          T = ctx.scroll.aggiorna(dt)          (Lenis già avanzato dal ticker)
3  mondo           se cambia: pipeline.impostaScena(m), rig.salta(), evento 'mondo'
4  stato           ctx.stato.aggiorna(T, t, dt)         → STATO dalle tracce + valori derivati → U
5  camera          camera.aggiorna  → ctx.camera, ctx.regia
6  luce            sole, nebbia, cielo                  (cotture PMREM solo ai T di tabella)
7  contenuti       PIANURA: catasto, terreno, fiume, contorno, tracker, agri, cantiere
                   oppure VALLE: valle, pelton, francis, kaplan, acqua, diagramma (solo il mondo attivo)
8  dopo            ombre (needsUpdate se serve), qualita (governatore)
9  interfaccia     testi, etichette, hud, cursore, lineaOro, finale, indice, servizi, contatti, intro, test
10 veli            ctx.velo = max(ctx.veli) → opacità di .velo
11 render          pipeline.render(dt), saltato se scheda nascosta o velo ≥ 0,999; 30 fps sotto le sezioni
```

Ogni modulo riceve `aggiorna(ctx, T, t, dt)`. La camera viene prima dei contenuti, così ombre, cupola ed etichette usano la posa del fotogramma corrente. La UI viene dopo tutto, così le proiezioni sono coerenti con il render.

---

## 5. STATO, tracce e uniform: come una tappa anima lo scroll

**Scelta vincolante.** Niente timeline GSAP con i tween delle tappe. Le tabelle "Eventi" di `DESIGN.md` §4 sono trascritte in `config.TRACCE` e `regia/stato.js` le valuta come funzioni pure di T a ogni fotogramma. GSAP resta come ticker unico, e ScrollTrigger serve per le rivelazioni delle sezioni HTML.

**Formato di una traccia**: `chiave: [[T0, T1, da, a, ease?], …]`.

- Il set istantaneo si scrive `[T, T, null, valore]`.
- Le chiavi annidate usano il punto: `'uV.0'`, `'fogliGIS.2.o'`, `'sole.el'`.
- I valori possono essere numeri, colori `'#rrggbb'` (diventano `THREE.Color`, interpolati in lineare) o nomi di preset (diventano `{da, a, k}`, per esempio `STATO.cielo`).
- Semantica: vale l'ultimo segmento con `T0 ≤ T`. Prima del primo segmento vale `STATO_INIZIALE`. Oltre `T1` vale `a`.

**Valori derivati** (scritti da `stato.aggiorna`):

- `STATO.sole` `{el, az, int, col}`: con `soleAuto = 0` viene dalle tracce; con `1` viene da `posizioneSole(STATO.ora)` e `luceSole`; con `2` el, az e int vengono dalle tracce e il colore da `luceSole`. Con riduci movimento, in tappa 3 il sole è fisso alle 10:00.
- `STATO.soleDir` (versore verso il sole).
- `STATO.trackerFV` e `STATO.trackerAgri` `{theta, stato, ideale}`: escono da `angoloTracker` e sono **la stessa funzione dell'HUD**. In tappa 5 valgono `trackerAngoloManuale`.
- `STATO.tempoScala = 10^tempoScalaEsp`; `STATO.tempoIdro = ∫ tempoScala·dt`, quindi cambiare la scala non fa salti.
- `STATO.T`, `tappa`, `mondo`, `t`, `dt`.

**Uniform condivise `ctx.U`**: c'è una `{value}` per **ogni chiave numerica di STATO**, con lo stesso nome (`U.uOnda`, `U.comparsaFV`, `U.YF`…). In più:

- `U.uV` (lo stesso array di STATO);
- `U.uTempo` (secondi);
- `U.uTempoIdro`;
- `U.uPx` (`dprNativo × scala`, la scrive la pipeline);
- `U.uRisoluzione` (`Vector2`);
- `U.uSoleDir` (`Vector3`);
- `U.uColoreSole`;
- `U.uAngoloFV` e `U.uAngoloAgri` (in radianti);
- `U.uSitoC`.

Si collegano **per riferimento** dentro `onBeforeCompile`: `sh.uniforms.uOnda = ctx.U.uOnda`.

**Come un modulo aggiunge animazioni senza toccare i file condivisi:**

1. Se il parametro è già in `STATO` (tabelle §4), il modulo lo legge (`ctx.STATO.esplosione`) o collega `ctx.U.esplosione`.
2. Gli sfalsamenti per elemento e le curve per pezzo si calcolano nel modulo con `fase(T, T0, T1, ease)` e `ease(nome)`, importati da `regia/stato.js`. I tempi vengono da `config` (es. esplosione per pezzo: `fase(1 − STATO.esplosione…)`; parentesi: `VALLE.sfalsamentoParentesi`; colonne sfalsate di 0,03; petali `PETALI`).
3. Per una chiave che manca si chiede al lead di aggiungerla in `config.TRACCE`/`STATO_INIZIALE`. Nel frattempo si usa `fase()` con una costante locale `// TARATURA`.
4. Le animazioni continue (acqua, impulsi, vento, pulsazioni) usano `t` o `U.uTempo`, e `U.uTempoIdro` per l'acqua della valle. Con `ctx.flags.riduci` si fermano.

**Easing ammessi** (nomi GSAP, risolti da `stato.js`): `none`, `power2.in/out/inOut`, `power4.in/out`, `expo.out`, `expo.inOut`, `sine.inOut`. La casa ne usa tre (§2.3).

---

## 6. Interfaccia dei moduli

Ogni modulo dell'albero esporta:

```js
export const MONDO = 'pianura' | 'valle' | 'ui' | 'sistema';
export async function crea(ctx) {}            // una volta; può essere async
export function aggiorna(ctx, T, t, dt) {}    // ogni fotogramma (contenuti: solo nel proprio mondo)
export function ridimensiona(ctx, w, h) {}    // facoltativa
```

`main.js` chiama queste funzioni dentro un `try`. Se una lancia un'eccezione, il modulo scrive **un** `console.error` e viene escluso. Uno stub vuoto va sempre bene.

### Servizi di sistema

| Modulo | Esporta in più | Pubblica |
|---|---|---|
| `render/pipeline.js` | `creaRenderer(ctx) → WebGLRenderer` | `ctx.pipeline = { impostaScena(nome), render(dt), ridimensiona(w,h), applicaQualita(Q), scalaInterna, passi:{render,gtao,bloom,uscita,smaa,pellicola} }`; scrive `U.uPx`, `U.uRisoluzione`; legge `STATO.esposizione/saturazione/gtao/gtaoRaggio` |
| `render/qualita.js` | `rileva(ctx) → livello` | `ctx.qualita = { livello, Q, scala, gradino, forzato, info(), benchmark() }` |
| `render/ombre.js` | — | `ctx.ombre = { gestisce, adatta(centro, meta), richiedi() }`. I moduli chiamano `richiedi()` quando muovono qualcosa che proietta ombra |
| `luce/nebbia.js` | `NEBBIA`, `nuovoMateriale`, `aggiungiPatch`, `collegaNebbia`, `registraEnv`, `impostaEnvGlobale` | `ctx.nebbia`; nebbia FogExp2 per scena |
| `luce/sole.js` | riesporta da `geo.js` `posizioneSole, angoloTracker, luceSole, intensitaSole, coloreSole, direzioneSole, oraDaT` | `ctx.luci = { pianura:{sole, emisfera}, valle:{sole, emisfera} }`; scrive `U.uSoleDir` |
| `luce/cielo.js` | — | `ctx.cielo = { orizzonte: Color, bagliore: Color, forzaCottura(), cotturaValle(): Promise, azHDRI }` |
| `regia/scroll.js` | — | `ctx.scroll = { T, y, inizio, lunghezza, velocita, inSezioni, lenis, aggiorna(dt) → T, vai(T), scorri(y), vaiTappa(i), ricalcola() }`; scrive `ctx.veli.sezioni` |
| `regia/camera.js` | `posa(T)` (pura) | `ctx.rig = { aggiorna, posa, salta(), forza(id\|null), mouse(nx, ny) }` e `ctx.regia` (§3) |
| `ui/testi.js` | `dividiRighe(el) → {righe, ricalcola}`, `decodifica(el, ms)` | — |
| `ui/cursore.js` | `rendiMagnetico(el)` | scrive `ctx.STATO.uHover` |
| `ui/lineaOro.js` | `creaLineaOro(svg) → {imposta, morph, alfa}` | — |

### Dati pubblicati e ancore registrate dai contenuti

| Modulo | `ctx.dati.…` | `ctx.ancore` registrate |
|---|---|---|
| (main) | `layout = { fv, agri }` da `geo.calcolaLayout` | — |
| catasto | `catasto = { tStati, tVincoli, tMaschere, particellaDi(x,z) }` | — |
| terreno | `terreno = { mesh, anello, materiale }`; esporta `SOLLEVAMENTO_GLSL`, `altezza` | — |
| fiume | `fiume = { mesh, normaleAcqua }`; esporta `texturaNormaleAcqua()` (può restituire `null`) | — |
| contorno | `contorno = { cabine, cp, capannone, cavo }` | `cavo.polilinea` (`Vector3[]`) |
| tracker | `tracker = { fv, agri, eroe, materiali, texturaCelle }` | `eroe.palo`, `eroe.tubo`, `eroe.cuscinetto`, `eroe.motoriduttore`, `eroe.controllore`, `eroe.modulo` (funzioni: posizione corrente, esplosione compresa) |
| agri | `agri = { colture, quote, trattore }` | `agri.quota1`, `agri.quota2`, `agri.trattore` |
| cantiere | `cantiere = { picchetti, recinzione, battipali }` | — |
| valle | `valle = { piani:{Z0,ZP,YF,ZK}, patchSezione(m), materiali, luci:{rect:[a,b], spot} }` | — |
| pelton, francis, kaplan | `{ gruppo, girante }` | `pelton.cucchiaio`; `francis.chiocciola/.distributore/.girante`; `kaplan.pala/.distributore/.aspirazione` |
| acqua | `acqua = { getti, spruzzi, linee, colonne }` | — |
| diagramma | — | `diagramma.pelton/.francis/.kaplan`, `diagramma.retta10` (`[Vector3, Vector3]`) |

Chi **legge** dati o ancore di un altro pacchetto deve tollerarne l'assenza, perché l'altro può essere ancora uno stub: usa texture neutre, le coordinate di `riserva` di config o salta l'effetto.

### Layout degli impianti (normativo, già calcolato)

`geo.calcolaLayout('fv' | 'agri')` riproduce esattamente i totali di §3.5: FV 66 file (x da 2,2 a 41,2), 308 tracker, 15 960 moduli; agrivoltaico 29 file (x da 70,28 a 98,28), 79 tracker, 3 696 moduli.

- Ogni tracker porta `{fila, lettera, x, z0, z1, moduli, centro, pali[], chiave, ordine}`:
  - `chiave` è la distanza normalizzata dall'eroe e serve all'onda;
  - `ordine` è l'ordine di montaggio, dal cancello, e serve al cantiere;
  - `pali` sono i pali ogni 0,8 u, simmetrici attorno al palo centrale.
- Il tracker eroe è **la fila 31, tracker D**: z da 7,347 a 13,867.
- La stringa 14-B è **la fila 14, tracker B**: z da −1,182 a 5,338.
- `DESIGN.md` riporta z più alte di 0,03–0,04 u, che nessuna variante del margine riproduce. Per la geometria vale il layout calcolato. Per camera ed etichette restano i valori nominali di config (la differenza non si vede).

---

## 7. Mondi, luci, materiali

- **Due scene, una camera, un renderer.** Il cambio avviene esattamente a T = 11,50 e a T = 15,50 (`config.CAMBIO_MONDO`, `stato.mondoDi(T)`). `pipeline.impostaScena(nome)` cambia `passRender.scene` e `gtao.scene`. La nebbia è `scene.fog` di ciascuna scena (FogExp2, `uNebbiaBase` 0 o 20). L'ambiente è `scene.environment` di ciascuna scena.
- **Luci fisse per scena.**
  - PIANURA: sole e emisfera (da `luce/sole.js`).
  - VALLE: sole, emisfera, 2 `RectAreaLight` e 1 `SpotLight` (questi tre da `idro/valle.js`).
  - Le intensità si animano; le luci non si aggiungono né si tolgono.
- **`nuovoMateriale(Classe, parametri, {patch, chiave})`** fa quattro cose:
  - crea il materiale;
  - collega le uniform della nebbia (`uSoleDir`, `uSoleNebbia`, `uNebbiaBase`, `uNebbiaDecad`);
  - lo registra per ENV_GLOBALE (`envMapIntensity = base × STATO.envGlobale`, dove la base è il valore di §2.6);
  - aggiunge la patch, se c'è.
- **Patch**: si usa sempre `aggiungiPatch(materiale, patch, chiave)`, **mai** `material.onBeforeCompile = …`, perché romperebbe la nebbia. La `chiave` entra in `customProgramCacheKey`. È **obbligatoria** quando il GLSL generato dipende da variabili di chiusura: senza, due materiali diversi condividono lo stesso programma.
- **Overlay e trasparenze** (`LineMaterial`, `ShaderMaterial`): `fog:false` se si dissolvono per alfa propria, oppure si creano con `nuovoMateriale` se devono entrare nella nebbia. Su tutto ciò che non deve scurirsi con il GTAO si mette `userData.noAO = true`: `LineSegments2`, getti, colonne, fogli, tende, sigillo, cupole, piano del diagramma, involucri tagliati.
- **Mesh con vertici spostati nello shader**: `customDepthMaterial` con la stessa patch (terreno, istanze, colture, alberi).
- **Piani di taglio della VALLE**: `ctx.dati.valle.piani` (`THREE.Plane`), assegnati alla creazione dei materiali con `clipShadows: true` e `side: DoubleSide`. `valle.js` aggiorna `YF.constant = STATO.YF`.
- **Cupola del cielo**: segue la camera, con raggio `min(CIELO.raggio, 0,9·camera.far)`. Alcune inquadrature hanno `lontano` pari a 800–3 000, mentre la cupola ha raggio 3 000.

---

## 8. Contratto DOM (index.html; gli id e le classi non si rinominano)

| Elemento | Uso |
|---|---|
| `canvas#scena` | WebGL |
| `.scrim` | velo a gradiente: opacità scritta da `ui/testi.js` |
| `.velo` (con `.velo-messaggio`) | velo nero: opacità scritta da main (`ctx.velo`) |
| `svg#linea-oro` | LineaOro (intro, transizione 4 → 5) |
| `svg#petali` | petali del finale (`ui/finale.js`) |
| `.etichette > svg.richiami`, `#piastra-dati.piastra` | etichette 3D e piastra 5b |
| `header.testata`, `nav.indice` (`a[data-tappa]`), `.hud` (`.hud-sx`, `.hud-strumento`, `.bandierina`), `.cursore` | UI fissa |
| `#preloader` (`.logo-intro`, `.linea-intro`, `.contatore`, `.didascalia .gruppo`, `.salta`) | intro; la classe `.fatto` lo nasconde |
| `section#storia` (alta 2000vh) `> .testi > article.battuta[data-battuta][data-tappa]` | battute: id come in `config.BATTUTE`; `.attiva` = visibile |
| dentro le battute: `.occhiello`, `h1`/`h2` (`.grande`), `.testo`, `.dato`, `.legenda li[data-voce]`, `.diagramma.binari span[data-nodo]`, `.diagramma.corsie span[data-corsia]` | contenuti normativi già trascritti |
| `#chi-siamo`, `#servizi`, `#contatti` (con `form` e `[role=status]`), `footer.piede` | sezioni |
| classi su `html`: `no-webgl`, `riduci`, `piccolo`, `modo-test`, `contesto-perso`; su `body`: `carica` (tolta a pronto) | stati |

**Battute**: i tempi sono solo in `config.BATTUTE` (`in` e `out` sono i T di inizio ingresso e di inizio uscita; più `spunte`, `binari`, `passi`, `gse`…). `in:null` vuol dire visibile da `'intro-fine'`; `out:null` vuol dire che resta fino alle sezioni. Il testo sta solo nell'HTML, così funziona anche senza WebGL.

---

## 9. Etichette 3D

Le etichette sono dichiarate **solo** in `config.ETICHETTE`: `{t0, t1, nome, dato, datoDopo?, ancora, riserva?, colore, tipo?}`. `ui/etichette.js` le disegna con le regole di `config.ETICHETTE_REGOLE`.

`ancora` può avere tre forme:

- `[x, y, z]`, coordinate assolute;
- `{x, z, h}`, cioè `y = altezza(x, z) + h` (solo PIANURA);
- `'nome'`, che si cerca in `ctx.ancore` e ricade su `riserva` se il nome non c'è.

Ogni modulo registra le proprie ancore in `crea()`: `ctx.ancore.set('eroe.palo', () => vettoreMondoCorrente)`. Per le ancore che si muovono la funzione viene chiamata a ogni fotogramma e deve restituire sempre lo **stesso** `Vector3`.

La visibilità dipende da quattro condizioni:

- il punto è davanti alla camera;
- il punto sta nell'area ammessa;
- nella PIANURA, `geo.visibileSulTerreno` dice che non è coperto;
- sono visibili al massimo 3 etichette, oppure 1 su schermi piccoli.

`tipo:'piastra'` posiziona `#piastra-dati`, il cui contenuto è scritto da `ui/finale.js`.

---

## 10. Caricatore `ctx.carica` (con cache; ogni chiamata ripetuta restituisce la stessa Promise)

| Metodo | Restituisce |
|---|---|
| `hdr(nome, onProg?)` | `DataTexture` HalfFloat (`'qwantani'`, `'kloofendal'`, `'autumn'`). Esistono solo le 2K (`config.HDRI.usa1k = false`) |
| `texture(set, onProg?)` | `{diff, nor, arm}` di `config.ASSET.texture[set]`: diff in sRGB, nor e arm in NoColorSpace, Repeat, anisotropia massima |
| `immagine(url)`, `testo(url)` | `HTMLImageElement`, stringa (es. l'SVG del logo da incorporare) |
| `font()` | i pesi di `config.FONT.carica` (al massimo 3 s) |

Modelli `.glb` facoltativi: si caricano solo con `config.ASSET.modelli[x].attivo = true`, senza `HEAD` di prova. Qualunque errore fa tornare alla forma procedurale con un solo `console.info`.

---

## 11. Eventi (`ctx.eventi.on(nome, f)`)

| Evento | Dati | Chi lo emette |
|---|---|---|
| `progresso` | `{totale 0..1, gruppo, id, frazione, completato}` | main |
| `pronto` | `ctx` | main, dopo il warm-up e il primo fotogramma |
| `intro-fine` | — | intro (main lo emette lui stesso se l'intro è disattivata) |
| `mondo` | `'pianura' \| 'valle'` | main |
| `valle-progresso`, `valle-pronta` | `0..1`, — | main |
| `ridimensiona` | `{w, h}` | main (prima chiama `ridimensiona()` di ogni modulo) |
| `riduci` | boolean | main |
| `qualita` | `info` | qualita |
| `contesto-perso`, `contesto-ripristinato` | — | main (il cielo deve rifare le cotture) |

---

## 12. Qualità

`ctx.qualita.Q` è una copia di `config.QUALITA.livelli[livello]`: `{budget, msaa, ombra, gtao, gtaoMezza, iridescenza, terreno, fileAlterne?, coltureSoloVicolo?}`. I moduli la leggono **solo in `crea()`**, per esempio per S del terreno, la taglia dell'ombra, l'iridescenza, le file alterne o le colture.

A runtime il governatore cambia solo la scala interna, il GTAO, la taglia dell'ombra, MSAA/SMAA e il bloom, attraverso `pipeline.applicaQualita`. `?q=` forza il livello e blocca il governatore. Con `?test=1` il livello è base.

---

## 13. Parametri dell'URL

| Parametro | Effetto |
|---|---|
| `?test=1` | DPR 1, livello base, niente Lenis, niente intro, orologio fisso (1/60 per fotogramma), `preserveDrawingBuffer`, `__eri.ctx` esposto |
| `?debug=1` | pannello di debug (`test.js`), ← → tra le soste, `__eri.ctx` esposto |
| `?T=7.5` (o `?t=7.5`) | parte da quel T, senza intro |
| `?q=bassa\|base\|media\|alta\|ultra` | forza il livello (`bassa` = `base`) |
| `?tm=agx` | tone mapping AgX (esposizione × 1,35) |
| `?riduci=1` | forza il riduci movimento |
| `?nowebgl=1` | forza la modalità senza WebGL |
| `?nointro=1` | salta l'intro |

---

## 14. API di debug `window.__eri`

| Membro | Descrizione |
|---|---|
| `pronto: boolean` | vero dopo il warm-up, il primo fotogramma e il salto al T iniziale |
| `quandoPronto: Promise` | |
| `T`, `tappa`, `mondo`, `keyframe` | getter |
| `vaiT(T): Promise` (alias `vaiA`) | salto **immediato**: scroll, `rig.salta()`, cottura forzata, due passi a dt = 0, ombra aggiornata, render, due rAF. Se serve aspetta la VALLE. Si risolve con la scena assestata (< 1 s; la prima volta nella valle può richiedere la costruzione) |
| `scorri(y): Promise` | salto immediato a y px |
| `qualita` | `ctx.qualita.info()` |
| `info()` | `{programmi, chiamate, triangoli, geometrie, texture}` |
| `stato` | STATO (in sola lettura) |
| `config`, `versione`, `errori`, `guasti`, `moduli()` | diagnostica (`moduli()` restituisce `ok`, `assente` o `guasto` per ogni modulo) |
| `ctx` | solo con `?test=1` o `?debug=1` |

`test.js` può aggiungere `contrasto(battuta)` e `soste()`. Non ridefinisce i membri qui sopra.

---

## 15. `geo.js` (funzioni pure, nessuna dipendenza da three, testabili con node)

| Gruppo | Funzioni |
|---|---|
| Numeriche | `clamp`, `lerp`, `ss`, `smootherstep`, `rad`, `deg`, `damp`, `diffAngolo` |
| Rumore | `hash`, `rumore`, `fbm`, `mulberry32` |
| Terreno | `fiumeX`, `letto`, `acqua`, `valleMax`, `valleMin`, `PIANE`, `hNaturale`, `piana`, `altezza`, `normaleTerreno`, `pendenza`, `distanzaFiume`, `distanzaSito`, `raggioTerreno` (ray-march e bisezione), `visibileSulTerreno` |
| Catasto | `versoGriglia`, `versoMondo`, `cellaDi`, `centroCella` |
| Geografia e formati | `lat`, `lon`, `quotaSlm`, `formatoGMS`, `numeroIt` (spazio fine per le migliaia), `formatoOra` |
| Valle | `fondoValle`, `PUNTI_M`, `Mliscia`, `hValle` |
| Sole | `posizioneSole`, `angoloTracker`, `intensitaSole`, `coloreSole` (RGB lineare), `luceSole`, `direzioneSole`, `oraDaT` |
| Camera | `direzioneVista`, `posizioneCamera`, `fovStretto`, `metriPerPx` |
| Idro | `lineeCorrente`, `velocitaLinee`, `potenzaMW`, `diagrammaXY` |
| Layout | `calcolaLayout` |

Verifiche già fatte:

- le posizioni P di tutti i 33 keyframe rispettano la tabella con errore < 0,01 u;
- sole e tracker coincidono con l'Appendice A;
- le quote del terreno vanno da −2,96 a 15,46;
- il cavidotto misura 120,7 u.

---

## 16. Decisioni dell'architetto (dove DESIGN.md tace o si contraddice)

Le voci sono marcate `[ARCH]` in `config.js` e si possono rivedere.

- **Nebbia**: con 0,0018 a 1 150 u la vista K0.0 sarebbe nascosta, quindi parte da 0,0004 e scende a 0,0018 nel volo K0.0 → K0.1. La traccia `nebbia` è scritta per inquadratura (panoramiche, medie, primi piani) e rispetta le transizioni esplicite di §4.4 e §4.5.
- **Raccordi** per evitare salti a T = 5,00: sole, esposizione ed emisfera (§2.4 e §4.3 non coincidono), colore del sole a T = 2,00, saturazione "analisi" 0,85 in tappa 1.
- **Uscita dalla carta all'alba** (7,62 → 7,88): `uSottrazione`, `uIdonee` e `uV[*]` vanno a 0 e `uRealta` si chiude a 1 (7,88 → 7,90). Così anche l'anello oltre il fronte diventa reale. `uSito` scende a 0,3 come il layout.
- **Ritorni a zero**: `uOndaRame` a −1 a 7,45 (nel buio), `uFronte` a −1 a 16,56, `luciCP` spente all'alba, `statoFile` e `termica` spente a 17,42–17,50, `percorsoAlfa`, GTAO a 0 nelle foschie e nel diagramma, `rectInt` a 0 dopo la Kaplan.
- **Interni della valle** (Pelton, Francis, Kaplan): esposizione 1,00 e ENV 0,35 negli interni, contro 0,90 e 0,60 fuori.
- **`tempoScala`** resta a 1/8 fino a T = 15,50 (TEMPO nell'HUD in 4b–4d; giranti del diagramma a 1/8).
- **Valori di `ombra` per keyframe** (meta del frustum) nei voli della valle.
- **`fogliGIS.quotaImpatto`** = 1,5 (da tarare).
- **Niente timeline GSAP**: T si legge dallo scroll e le tracce sono funzioni pure. Il risultato è lo stesso di `tl.to(STATO_T, {T:19})` con `scrub`, ma è più robusto per `vaiT` e lo scroll all'indietro.
- **`compileAsync`** solo se esiste `KHR_parallel_shader_compile`: su SwiftShader three altrimenti scrive un avviso in console.

---

## 17. Verifica (definizione di "fatto" per ogni pacchetto)

```bash
# server (se spento)
cd /home/user/cld/sito-3d && nohup python3 -m http.server 8790 >/dev/null 2>&1 &
# schermate (lente: SwiftShader). Cartella per pacchetto.
node /tmp/claude-0/-home-user-cld/c3d21a17-32c2-5d77-985f-ab05129798fb/scratchpad/foto-v2.js \
  "http://localhost:8790/v2/?test=1" <cartella> "T:1.8,T:9.95,T:13.1" 960 540 3000
```

Un pacchetto è fatto quando valgono tutte queste condizioni:

- nessun `CONSOLE error`, `PAGEERROR` o `REQFAILED`;
- `__eri.moduli()` non riporta nessun modulo `guasto`;
- `__eri.errori` è vuoto;
- `__eri.info().programmi` è uguale prima e dopo un giro di `vaiT` su tutte le soste;
- le inquadrature rispettano l'Appendice C con tolleranza ±0,03.

Si lavora di preferenza a 960 × 540. Le esecuzioni vanno tenute poche, perché la CPU è condivisa.
