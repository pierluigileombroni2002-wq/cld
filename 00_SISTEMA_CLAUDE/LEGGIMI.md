# Sistema Claude — Leggimi

Questa cartella contiene la parte **tecnica**: come usare **Claude Code gratis** (tramite OmniRoute) dentro il progetto. Le regole di collaborazione tra i due Claude restano quelle di ieri, nei file della cartella del progetto.

```
AnimeEdits\
├── CLAUDE.md               ← Claude Code lo legge da solo all'avvio: carica COLLABORAZIONE.md
├── COLLABORAZIONE.md       ← ruoli e regole (con la nuova sezione "Modelli e costi")
├── COMPITI.md              ← bacheca dei compiti
├── COMUNICAZIONI.md        ← registro tra le due sessioni
├── METODO.md, guida-stile.md
├── clip\, reel\, musica\, analisi\, render\, REEL FINITI\, ...
└── 00_SISTEMA_CLAUDE\      ← questa cartella
    ├── LEGGIMI.md          ← questa guida
    └── AVVIA_CLAUDE.bat    ← avvio di Claude-PowerShell con doppio clic
```

---

## 1. Avvio

### Con doppio clic
Apri **`AVVIA_CLAUDE.bat`**. Fa tutto da solo:
1. accende OmniRoute in una finestra (se è già acceso, lo salta);
2. aspetta che sia pronto;
3. apre Claude Code nella cartella del progetto, già impostato sui modelli gratuiti e con il nome **Claude-PowerShell**, così sa che ruolo ha.

**Collegamento sul Desktop:** tasto destro su `AVVIA_CLAUDE.bat` → *Mostra altre opzioni* → *Invia a* → *Desktop (crea collegamento)*.
Usa il **collegamento**, non copiare il file: se lo copi altrove, non trova più la cartella del progetto.

### A mano
1. Apri un PowerShell **normale** (non amministratore) e scrivi `omniroute`. Lascia la finestra aperta.
2. Apri un secondo PowerShell normale, entra nella cartella del progetto (`cd $HOME\Desktop\AnimeEdits`) e scrivi `claude`. Poi digli: *"Sei Claude-PowerShell"*.

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
| `00_SISTEMA_CLAUDE\AVVIA_CLAUDE.bat` | Le stesse impostazioni di OmniRoute e dei modelli, valide solo per la finestra che apre | Così Claude-PowerShell funziona anche se un giorno togli le impostazioni globali |
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
| Claude Code non conosce le regole del progetto | Manca `CLAUDE.md` nella cartella del progetto, oppure è stato avviato da un'altra cartella | Controlla che `CLAUDE.md` sia in AnimeEdits e avvia con `AVVIA_CLAUDE.bat` |

---

## 6. Collaborazione tra Claude-App e Claude-PowerShell

Il sistema è quello creato ieri, descritto in `COLLABORAZIONE.md`:
- **Claude-App** (scheda Code dell'app desktop, abbonamento Claude): il regista. Fa le scelte creative, le sceneggiature e i controlli finali.
- **Claude-PowerShell** (avviato con `AVVIA_CLAUDE.bat`, modelli gratuiti): fa i lavori lunghi e meccanici, come analisi, cataloghi, sottotitoli e render.
- **`COMPITI.md`** è la bacheca dei compiti. **`COMUNICAZIONI.md`** è il registro: si scrive solo in fondo, una riga per messaggio.

Novità di oggi:
- **`CLAUDE.md`**: Claude Code lo legge da solo all'avvio, quindi conosce subito le regole di `COLLABORAZIONE.md` senza che tu debba dirglielo.
- **`COLLABORAZIONE.md`**: nuova sezione **"Modelli e costi"**, con le regole per lavorare con i modelli gratuiti.
- **`COMUNICAZIONI.md`**: una riga che avvisa le due sessioni del cambio. Ricorda anche che la sessione di ieri si è fermata a metà di C1 e che il controllo automatico di C5 non è più attivo.

### Frasi utili
- A **Claude-PowerShell**: *"Leggi le ultime righe di COMUNICAZIONI.md e riprendi i tuoi compiti in COMPITI.md"*.
- A **Claude-App**: *"Leggi COMUNICAZIONI.md e dimmi a che punto siamo"*, oppure *"Scrivi in COMPITI.md un nuovo compito per Claude-PowerShell: …"*.

---

## 7. Da verificare: l'app desktop

Alcune impostazioni per OmniRoute sono **globali**: le variabili d'ambiente di Windows e `settings.json`. L'app desktop le legge, quindi potrebbe succedere che anche **Claude-App** passi da OmniRoute, usando i modelli gratuiti invece di Claude, oppure che dia errore sul modello `free-coding`.

**Controllo:** nell'app desktop apri la scheda **Code**, apri una sessione su AnimeEdits e scrivi *"dimmi in una riga che modello sei"*.
- Risponde **Claude**, oppure dice che hai raggiunto il **limite dell'abbonamento**: va tutto bene, Claude-App usa davvero Claude.
- Risponde **Gemini** o un altro modello, oppure dà un errore sul modello: le impostazioni globali vanno tolte. `AVVIA_CLAUDE.bat` contiene già tutto quello che serve a Claude-PowerShell. Fatti guidare da Claude per toglierle.

---

## 8. Idee per dopo

- **Mistral** (piano gratuito "Experiment", modello **Devstral**): da aggiungere alla combo per avere più quota. Nel piano gratuito Mistral può usare i tuoi dati per addestrare i modelli.
- **Ordine "qualità":** mettere Kimi K3 e DeepSeek V4 Pro prima dei Gemini. Sono più bravi nel codice, ma più lenti. Attenzione: per i compiti con le immagini, come il catalogo C2, serve un modello che le veda, e Gemini le vede.
- **Controllo automatico dei reel nuovi (C5):** si può riattivare, ma ogni controllo consuma quota gratuita. Meglio chiederlo a mano ogni tanto.
- **Crediti per sessioni cloud:** 94 USD inclusi nel piano, scadono il **5 novembre 2026** (claude.ai → Impostazioni → Utilizzo). Valgono solo per le sessioni cloud di Claude Code (claude.ai/code) e non consumano la quota dell'abbonamento.
- **Sicurezza:** non condividere screenshot che mostrano chiavi API (`sk-…`, `gsk_…`) o il file `.env`.
