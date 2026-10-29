# v3-fable · resoconto della prova

Proposta del sito nuovo di ERI costruita da zero seguendo `sito-3d/BRIEF-FABLE.md`.
Pagina: `http://localhost:8792/v3-fable/` (server: `strumenti/server.ps1 -Porta 8792` dalla copia del progetto).

## La regia

Un unico piano-sequenza, come il film di presentazione di un prodotto di lusso.
Niente isole né piedistalli: le macchine stanno su un pavimento scuro e liscio che si perde nell'orizzonte dorato,
come in uno studio fotografico. Il pavimento ha un riflesso satinato (solo al livello di qualità alto).
La camera scorre di lato su un binario, un solo movimento lento per ogni momento; mentre arriva, la macchina si compone
pezzo dopo pezzo e l'iter (Sviluppo → Autorizzazioni → Ready to Build → Costruzione → Gestione) si accende passo per passo
sotto al titolo, con una riga di spiegazione per ogni passo.

I cinque momenti:
1. **Apertura** — un sole d'oro i cui petali si compongono nel logo ERI completo (scritte chiare, "ITALIA" rame chiaro);
   il sole all'orizzonte sta proprio dietro il logo. Titolo, frase, "Parliamo del progetto".
2. **Fotovoltaico e agrivoltaico** — due file di tracker a terra davanti, due file rialzate dietro (agrivoltaico, con le
   righe di coltura come segni di luce, niente vegetazione). Le tavole ruotano piano verso il sole. In primo piano: celle,
   busbar, morsetti, cuscinetti, motore di rotazione, piastre con bulloni.
3. **Accumulo BESS** — due container con le porte che si aprono sui rack di batterie (led che si accendono), PCS con feritoie
   e ventola che gira, trasformatore con alette e isolatori. Un filo d'oro porta l'energia verso la rete.
4. **Idroelettrico** — tre turbine ben distinte su basi d'acciaio sobrie: Pelton (ruota a cucchiai, ugello con flange e getto
   di luce), Francis (cassa a spirale con flange, girante e palette direttrici, generatore sopra), Kaplan (elica a cinque pale
   nel condotto tagliato, bulbo dietro). Girano piano. Etichette con nome e tipo di salto.
5. **Contatti** — la camera si gira verso l'orizzonte, il sole sale e inonda il cielo; scheda con modulo (invio finto con conferma).

## Scelte tecniche

- Three.js r160 da CDN (importmap), Google Fonts (Cormorant Garamond + Manrope). Nessuna libreria di animazione: scorrimento
  filtrato a mano, curve di camera Catmull-Rom con punti di mira a distanze simili (niente sbandate).
- Tutto procedurale, istanze per le parti ripetute (moduli, pali, bulloni, alette). Niente ombre, niente post-processing:
  la luce viene dalla mappa d'ambiente (cielo + "softbox" da studio) e da tre luci semplici.
- `scena/assemblaggio.js`: ogni pezzo ha un ordine e un'origine; `set(t)` compone la macchina con lo scorrimento.
- Qualità a tre livelli (`?q=alta|media|bassa`): DPR 1,5 / 1,25 / 1 su desktop (1,25 / 1,1 / 1 su telefono), riflesso del
  pavimento solo in alta, minuterie spente in bassa, polvere ridotta. Si scende da soli se la media dei fotogrammi supera 24 ms.
- Telefono: testi in alto, macchina nella metà bassa (la camera sposta il binario, non l'obiettivo), fov più largo.
- Strumenti per le foto: `window.__eri.pronto`, `__eri.vai(p)`, `__eri.info()`, `__eri.misura(ms)`, `__eri.qualitaImposta(q)`.
- Variante tipografica B (solo grotesk) con `?font=b`.

## Misure (Chrome senza finestra, 1600×900, RX 5700 XT — il punto più pesante è la fila delle tre turbine)

| livello | ms per fotogramma (medio / peggiore) | ms di render | triangoli | chiamate |
|---|---|---|---|---|
| alta  (riflesso acceso) | 5,0 / 6,5 | 1,8 | 64 100 | 156 |
| media | 5,0 / 6,2 | 1,1 | 33 200 | 80 |
| bassa | 5,0 / 6,2 | 1,1 | 29 500 | 69 |

Fotovoltaico: alta 27 500 triangoli / 116 chiamate; bassa 8 200 / 58. BESS alta: 26 400 / 138.
Tutto molto sotto i limiti del brief (600k triangoli, 250 chiamate). I ms di render sono il tempo di CPU del render
(headless non è limitato dal vsync): su un portatile con grafica integrata il costo è dominato dal riempimento
(DPR 1,5 e riflesso), per questo il livello medio spegne il riflesso e abbassa il DPR.

## Cosa resta da migliorare

- Provare su un portatile vero con grafica integrata e su un telefono: la discesa automatica è pensata per questo, ma va vista.
- Francis: la cassa a spirale è riconoscibile ma la girante dentro si vede poco; si può aprire di più la cassa o avvicinare la camera.
- Il filo d'oro del BESS: il percorso verso la rete va rifinito (oggi sale dal trasformatore e va verso il sole).
- Carattere: in uso la variante A (serif); da confermare con l'utente (B con `?font=b`).
- Telefono: controllare i testi lunghi su schermi molto piccoli e la scheda contatti con la tastiera aperta.
- Pulizia finale: togliere `__eri.*` di prova prima di pubblicare, ottimizzare le font (subset) e aggiungere i meta social.

## Aggiornamento · stile scelto: Galleria Bianca (2026-10-29)

La versione "crepuscolo" qui sopra è stata scartata dall'utente perché troppo simile all'altra proposta. Dopo tre tavole
di stile (`stili/galleria-bianca.html`, `stili/linea-di-luce.html`, `stili/pietra-e-bronzo.html`) e due bozzetti 3D,
lo stile scelto è **Galleria Bianca**: `stili/galleria/` (pagina `http://localhost:8792/v3-fable/stili/galleria/`).
Sala bianca da museo, pavimento di cemento opaco con ombre di contatto dipinte (niente shadow map), acciaio chiaro,
vetro antracite con la striscia di luce della finestra, titoli enormi neri sottili, iter a numeri 01-05, rame del logo
come unico accento, logo nei colori originali. Le macchine condivise sono riusate; BESS e turbine hanno copie proprie
(`bess-galleria.js`, `turbine-galleria.js`), i contatti mostrano le tre macchine in piccolo (`collezione.js`).
Misure (headless, alta): idro 31,6k triangoli / 94 chiamate, BESS 126 chiamate; nessun errore ai tre livelli, desktop e telefono.
`stili/linea/` (Linea di Luce) resta un bozzetto non rifinito.
