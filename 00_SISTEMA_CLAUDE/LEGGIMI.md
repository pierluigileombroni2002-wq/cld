# Sistema Claude — Leggimi

Questa cartella serve a usare **Claude Code gratis** (tramite OmniRoute) e a farlo collaborare con **Claude dell'app desktop**. I file dei reel restano fuori, nella cartella del progetto: qui c'è solo il "sistema".

```
Anime Edit S\                        ← cartella del progetto (reel, video, materiali)
├── CLAUDE.md                        ← collega Claude Code alle sue istruzioni (vedi punto 6)
└── 00_SISTEMA_CLAUDE\               ← questa cartella
    ├── LEGGIMI.md                   ← questa guida
    ├── AVVIA_CLAUDE.bat             ← avvio con doppio clic
    ├── ISTRUZIONI_CLAUDE_CODE.md    ← regole per Claude Code (esecutore)
    ├── ISTRUZIONI_CLAUDE_DESKTOP.md ← regole per Claude desktop (pianificatore)
    └── comunicazione\
        ├── PIANO.md                 ← lo scrive solo Claude desktop
        └── REPORT.md                ← lo scrive solo Claude Code
```

---

## 1. Avvio

### Con doppio clic
Apri **`AVVIA_CLAUDE.bat`**. Fa tutto da solo:
1. accende OmniRoute in una finestra (se è già acceso, lo salta);
2. aspetta che sia pronto;
3. apre Claude Code nella cartella del progetto.

**Collegamento sul Desktop:** tasto destro su `AVVIA_CLAUDE.bat` → *Mostra altre opzioni* → *Invia a* → *Desktop (crea collegamento)*.
Usa il **collegamento**, non copiare il file: se lo copi altrove, non trova più la cartella del progetto.

### A mano
1. Apri un PowerShell **normale** (non amministratore) e scrivi `omniroute`. Lascia la finestra aperta.
2. Apri un secondo PowerShell normale, entra nella cartella del progetto con `cd` e scrivi `claude`.

**L'ordine è sempre lo stesso: prima OmniRoute, poi Claude Code.** Se OmniRoute è chiuso, Claude Code non risponde.

---

## 2. Com'è configurato

### Il percorso di ogni richiesta
Claude Code → OmniRoute (solo su questo PC, `127.0.0.1:20128`) → combo **`free-coding`**:

| # | Modello | Provider |
|---|---|---|
| 1 | Gemini 3.8 Flash | Google AI Studio |
| 2 | Gemini 3.7 Flash | Google AI Studio |
| 3 | Kimi K3 | NVIDIA NIM |
| 4 | DeepSeek V4 Pro 0813 | NVIDIA NIM |

Strategia **Priorità**: usa il primo modello e passa al successivo solo se quello dà errore o finisce la quota.

### I file di configurazione

| Dove | Cosa contiene | Note |
|---|---|---|
| `%USERPROFILE%\.claude\settings.json` | I modelli di Claude Code puntati su `free-coding` | Contenuto qui sotto |
| Variabili d'ambiente di Windows | `ANTHROPIC_BASE_URL` (indirizzo di OmniRoute) e `ANTHROPIC_AUTH_TOKEN` | Sono impostate in Windows, non nel file sopra |
| `%USERPROFILE%\.omniroute\.env` | `OMNIROUTE_SERVER_HOST=127.0.0.1` (OmniRoute raggiungibile solo da questo PC) e `STORAGE_ENCRYPTION_KEY` | **Non modificare e non mostrare la chiave**: protegge le chiavi API salvate in OmniRoute |

Contenuto di `settings.json`, utile se un giorno va ripristinato:
```json
{
  "theme": "dark",
  "env": {
    "ANTHROPIC_MODEL": "free-coding",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "free-coding",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "free-coding",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "free-coding"
  }
}
```

### I provider in OmniRoute

| Provider | Stato | Perché |
|---|---|---|
| Gemini (Google AI Studio) | Acceso, nella combo | Gratuito |
| NVIDIA NIM | Acceso, nella combo | Gratuito, ha i modelli più forti |
| Groq | Acceso, **fuori** dalla combo | Gratuito, ma rifiuta le richieste grandi di Claude Code (circa 6.000 token al minuto) |
| Claude Code (OAuth) | **Spento** | Userebbe la quota dell'abbonamento, la stessa dell'app desktop |
| Kimi (Moonshot) | **Spento** | API a pagamento |

### Controllo veloce
In Claude Code scrivi `/status`. Deve risultare:
- **Model:** `free-coding`
- **Anthropic base URL:** `http://localhost:20128`
- **Auth token:** `ANTHROPIC_AUTH_TOKEN`

---

## 3. Costi: perché è tutto gratis

Controllato il 5 ottobre 2026:
- **Google AI Studio:** la chiave è in "Livello gratuito", la fatturazione non è attiva.
- **Groq:** piano Free.
- **NVIDIA NIM:** accesso gratuito, nessuna carta.
- **claude.ai → Impostazioni → Utilizzo:** i "crediti di utilizzo" sono spenti, quindi al limite Claude si ferma e non addebita niente.

Quando una quota gratuita finisce, il servizio rifiuta le richieste. **Nessun addebito.**

### Da non cliccare mai
- **Google AI Studio:** "Configura la fatturazione", "Crea un limite di spesa".
- **claude.ai:** "Acquista più utilizzo" e l'interruttore "Attiva i crediti di utilizzo".
- **Groq:** l'upgrade al piano "Developer".
- **OmniRoute:** i banner pubblicitari ("Ottieni una chiave API Kimi", "Cheaper Inference").
- **OmniRoute:** non usare `auto/...` o `openrouter/auto` come modello, perché possono finire su provider a pagamento.

---

## 4. Limiti da sapere

- **Ogni richiesta di Claude Code pesa circa 33.000 token** (istruzioni e strumenti), anche per un semplice "ciao". Ogni azione, come leggere un file o eseguire un comando, è una nuova richiesta. Le quote gratuite si consumano in fretta.
- Le quote giornaliere di Gemini si azzerano **alle 9:00 ora italiana**.
- I modelli gratuiti sono **meno capaci di Claude**: funzionano meglio con compiti piccoli e chiari.
- **Modalità auto:** con i modelli gratuiti è più prudente la modalità normale, che chiede conferma prima di modificare file o eseguire comandi. In Claude Code premi **Shift+Tab** finché non sparisce la scritta "auto mode on".

---

## 5. Problemi comuni

| Cosa vedi | Causa probabile | Cosa fare |
|---|---|---|
| `API error · Retrying…` | OmniRoute è spento, oppure la quota è finita | Controlla la finestra di OmniRoute. Poi guarda **Richieste recenti** nella dashboard (http://localhost:20128) |
| `/status` mostra `claude-opus-…` | `settings.json` non è stato letto o è stato cambiato | Ricontrolla `settings.json` (punto 2) e riavvia Claude Code |
| Risposte lente (30–60 secondi) | Il primo modello fallisce e OmniRoute passa al successivo | Ogni tanto è normale. Se succede sempre, guarda **Request Logs** in OmniRoute |
| Scritta gialla `"free-coding" isn't described…` | Claude Code non conosce il nome della combo | Innocua, ignorala |
| Avvisi gialli `STORAGE_ENCRYPTION_KEY … is ignored` all'avvio di OmniRoute | Ci sono due file `.env` | Innocui, ignorali |
| `AVVIA_CLAUDE.bat` dice "OmniRoute non risponde" | OmniRoute non è partito | Leggi l'errore nella finestra "OmniRoute" |

---

## 6. Collaborazione tra Claude desktop e Claude Code

- **Claude desktop** (abbonamento) **pianifica e controlla**. Le sue regole sono in `ISTRUZIONI_CLAUDE_DESKTOP.md`.
- **Claude Code** (modelli gratuiti) **esegue**. Le sue regole sono in `ISTRUZIONI_CLAUDE_CODE.md`.
- Si parlano tramite due file in `comunicazione\`:
  - `PIANO.md`: lo scrive solo Claude desktop;
  - `REPORT.md`: lo scrive solo Claude Code.

Così il lavoro pesante consuma modelli gratuiti e la quota dell'abbonamento dura di più.

### Come si usa
1. **App desktop**, dopo averle dato accesso alla cartella del progetto:
   *"Leggi `00_SISTEMA_CLAUDE/ISTRUZIONI_CLAUDE_DESKTOP.md`, poi scrivi in PIANO.md il piano per: …"*
2. **Claude Code:** *"Esegui il prossimo compito del piano"*.
3. **App desktop:** *"Leggi REPORT.md, controlla il lavoro e prepara il passo successivo"*.

Nel piano c'è già un **Compito 1 di prova**: Claude Code fa solo un elenco dei file, senza modificare niente. Serve a verificare che il sistema funzioni.

### Collegare le istruzioni a Claude Code
Claude Code legge da solo il file `CLAUDE.md` della cartella in cui viene avviato. Nel `CLAUDE.md` della cartella del progetto deve esserci questa riga:
```
@00_SISTEMA_CLAUDE/ISTRUZIONI_CLAUDE_CODE.md
```
Se `CLAUDE.md` esiste già, aggiungi la riga in fondo senza cancellare il resto.

---

## 7. Idee per dopo

- **Mistral** (piano gratuito "Experiment", modello **Devstral**): da aggiungere alla combo per avere più quota. Nel piano gratuito Mistral può usare i tuoi dati per addestrare i modelli.
- **Ordine "qualità":** mettere Kimi K3 e DeepSeek V4 Pro prima dei Gemini. Sono più bravi nel codice, ma più lenti.
- **Crediti per sessioni cloud:** 94 USD inclusi nel piano, scadono il **5 novembre 2026** (claude.ai → Impostazioni → Utilizzo). Valgono solo per le sessioni cloud di Claude Code (claude.ai/code) e non consumano la quota dell'abbonamento.
- **Sicurezza:** non condividere screenshot che mostrano chiavi API (`sk-…`, `gsk_…`) o il file `.env`.
