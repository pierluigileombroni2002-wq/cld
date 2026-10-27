# Brief per Fable · sito 3D di ERI (prova di confronto)

Questo brief serve a costruire, **da zero e in modo indipendente**, una proposta del sito nuovo di ERI.
L'utente vuole confrontarla con il prototipo fatto da un altro modello. Leggilo tutto prima di iniziare.

## 1. Come lavorare con l'utente (obbligatorio)

- **Lingua:** italiano, frasi brevi e semplici. L'utente non è un tecnico.
- **Scelte di stile:** non decidere a intuito. Quando c'è una scelta importante (colori, forme, impaginazione), proponi 2-3 opzioni e chiedi.
- **Anteprime come immagini:** l'utente segue spesso dal telefono e non apre i link interni. Mandagli le foto con SendUserFile.
- **Piccoli passi:** mostra il risultato spesso, così può correggerti subito.
- **Costi:** ha limiti d'uso. Prima di un lavoro grosso dai una stima (in percentuale di un blocco da 5 ore) e aspetta l'ok. Non usare tanti agenti in parallelo senza chiedere.
- **Gratis:** niente servizi a pagamento.

## 2. L'azienda e il messaggio

- **ERI · Energie Rinnovabili Italia** sviluppa impianti:
  - **fotovoltaici e agrivoltaici** (tracker che seguono il sole; nell'agrivoltaico i pannelli sono rialzati sopra le colture);
  - **accumulo BESS** (container di batterie, inverter/PCS, trasformatore);
  - **idroelettrici**, con tre turbine diverse: **Pelton** (salto alto), **Francis** (salto medio), **Kaplan** (salto basso).
- **Messaggio chiave:** per **ogni** impianto ERI segue **tutto l'iter**: Sviluppo → Autorizzazioni → Ready to Build → Costruzione → Gestione. Deve capirsi in pochi secondi, in modo semplice, veloce e funzionale.
- **Scopo del sito:** far capire cosa fa ERI e portare il cliente a **contattarli**. Niente dati tecnici inutili.
- **Niente eolico**, mai.
- **Contatti finti:** info@eri-esempio.it, +39 000 000 0000.

## 3. Struttura: 5 momenti, sito corto

1. **Apertura:** un sole d'oro i cui petali si compongono nel **logo ERI completo** (non tagliato). Titolo breve, una frase, pulsante "Parliamo del progetto".
2. **Fotovoltaico e agrivoltaico.**
3. **Accumulo BESS.**
4. **Idroelettrico:** le tre turbine ben distinte e riconoscibili, una frase ciascuna.
5. **Contatti:** destinazione finale luminosa, con un modulo semplice (nome, email, messaggio; invio finto con conferma).

L'iter deve accompagnare ogni momento tecnologico (come lo mostri lo decidi tu, ma semplice).

## 4. Direzione estetica (parole del cliente)

- "Deve fare **WOW**", "**moderno, all'avanguardia e lussuoso**".
- **Stilizzato e kinetic** (motion design): luce, linee e testi che si muovono con eleganza; oggetti che si compongono.
- **Atmosfera scelta:** "crepuscolo magico". Cielo indaco in alto (circa #151335) che sfuma in un orizzonte dorato (#e8975a / #ffcf8a), stelle sottili, polvere d'oro, oro luminoso (#e6b25c / #ffd27a), testi chiari (#fbf3e6).
- **Vietato:** realismo dell'ambiente (niente terreni fotografici), **niente erba, grano o vegetazione realistica**, **niente ombre**.
- **Primi piani:** quando la camera si avvicina a pannelli, BESS e turbine, la meccanica è in **alta definizione** (bulloni, flange, cavi, ventole, celle), come un render di lusso. Da lontano le forme restano semplici.
- **Camera calma:** pochi movimenti lenti e continui. **Niente zoom avanti-indietro** ripetuti né cambi bruschi: danno nausea.
- **Testi:** pochi, grandi, leggibili e comprensibili.
- **Logo:** `sito-3d/logo/ufficiale/logo-eri-originale.svg`. Su fondo scuro ricolora le scritte verde scuro (#0f3b2c) in chiaro e schiarisci "ITALIA" mantenendo il rame. Non modificare il file originale.

## 5. Prestazioni (regola dura)

Una versione precedente laggava sul portatile di un collega e il cliente l'ha scartata. Il sito deve essere **fluido su un portatile normale con grafica integrata e su un telefono di fascia media**.
- Niente ombre, effetti pesanti con misura, DPR limitato (circa 1,5 su desktop, 1,25 su telefono).
- Un sistema di qualità a 3 livelli che parte alto e scende da solo se i fotogrammi sono lenti; `?q=alta|media|bassa` per forzarlo.
- Indicativamente: meno di 600k triangoli e 250 draw call nella vista più pesante, molto meno al livello basso.
- Deve funzionare anche su schermi stretti (telefono), senza testi sovrapposti alla scena.

## 6. Dove e come lavorare

- **Cartella tua:** `sito-3d/v3-fable/`. Non toccare nient'altro (in particolare `sito-3d/v3/`, `sito-3d/v2/`, `sito-3d/prove/`).
- **Indipendenza:** per un confronto onesto **non leggere** il codice di `sito-3d/v3/` e `sito-3d/prove/`. Puoi usare il logo e questo brief.
- **Tecnica consigliata:** Three.js r160 da CDN con importmap (`https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` e `.../examples/jsm/`), GSAP da cdnjs se ti serve, Google Fonts. Modelli procedurali, niente modelli a pagamento.
- **Anteprima locale:** il server si avvia con
  `powershell -ExecutionPolicy Bypass -File "C:\Users\pierl\Desktop\sito 3d\sito-3d\strumenti\server.ps1"`
  e serve la cartella `sito-3d` su `http://localhost:8790/` (quindi la tua pagina è `http://localhost:8790/v3-fable/`). Se la porta è già occupata, il server è già acceso.
- **Foto senza finestra (Chrome headless):** `sito-3d/strumenti/foto-v2.ps1 -Url <url> -Out <cartella> -Passi <file.json> -Larghezza 1600 -Altezza 900 -Porta <porta libera>`. Lo script aspetta che la pagina imposti `window.__eri = { pronto: true }`. Esponi anche `window.__eri.vai(p)` (p da 0 a 1 = posizione nello scorrimento) e `window.__eri.info()` (ms per fotogramma, triangoli, chiamate, qualità). I passi sono JSON: `[{ "nome": "...", "js": "...", "shot": "foto.jpg" }]`.
- **Git:** `C:\Program Files\Git\cmd\git.exe` (non è nel PATH). Non fare commit sul ramo `claude/charming-planck-l43o5q` se non te lo dice l'utente: usa il tuo ramo o chiedi.

## 7. Cosa consegnare

1. Il sito funzionante su `http://localhost:8790/v3-fable/`.
2. Foto 1600×900 dei 5 momenti, più una da telefono (circa 412×915), mandate all'utente con SendUserFile.
3. Le misure di fluidità per livello di qualità (ms medi e nel punto peggiore, triangoli, chiamate).
4. Un breve resoconto in italiano: le scelte fatte e cosa resta da migliorare.
