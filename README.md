# Win Studio Admin

Applicazione desktop per **Windows 10 e 11** con cui lo Studio Associato Amm.
Burchielli lavora le segnalazioni (ticket) e il resto della gestione
condominiale: la stessa banca dati del sito, le stesse credenziali, ma con la
velocità di un programma installato.

Non c'è una seconda anagrafica da tenere allineata: l'app parla con le API del
Worker Cloudflare che serve già il sito (`Sito-Amm.Burch`), usando lo stesso
account, la stessa tabella `sessions` e gli stessi permessi. Quello che si fa
qui si vede subito nell'area riservata, e viceversa.

---

## Che cosa c'è dentro

| Sezione | A che serve |
| --- | --- |
| **Panoramica** | Numeri della giornata, scadenze operative, attività dello staff. Ogni riquadro apre la coda già filtrata. |
| **Coda segnalazioni** | Elenco denso di tutte le pratiche, con filtri, ricerca, selezione multipla e azioni di massa. |
| **Scheda pratica** | Testo, conversazione con il condomino, note interne, storico stati, assegnazione, priorità, fornitore, allegati. |
| **Archivio** | Documenti del condominio (sul server) e schede di dettaglio di condominio e singolo condomino (su questo computer). |
| **Condomini** | Anagrafica stabili, carico di lavoro, morosità del condominio, avvisi allo stabile. |
| **Morosi** | Posizioni scoperte dei singoli condomini, con modifica di stato, importo e note. |
| **Fornitori** | Rubrica operativa con DURC e assicurazione in evidenza. |
| **WhatsApp** | Conversazioni e invio messaggi, con la finestra di 24 ore dichiarata a schermo. |
| **Posta in arrivo** | Diario del riconoscimento automatico delle email e apertura manuale delle pratiche scartate. |
| **Notifiche** | Le stesse notifiche dell'area riservata, con salto diretto alla pratica. |
| **Studio** | Account dipendente, invio email dallo Studio, invito clienti (solo titolare). |
| **Controllo** | Solo titolare: sessioni aperte in tempo reale, attività di ogni dipendente, credenziali di dipendenti e condomini, diario completo. |
| **Registro attività** | Che cosa è stato fatto **da questa postazione**: accessi riusciti e rifiutati, sblocchi, esportazioni, importazioni. Filtrabile ed esportabile. |
| **Impostazioni** | Collegamento, sicurezza della postazione, orari degli avvisi, copia della configurazione, diagnostica. |

## Pensata per il volume

- **Comando rapido** `Ctrl+K`: sezioni, filtri pronti e ricerca di una pratica per numero, oggetto o richiedente.
- **Coda da tastiera**: `j`/`k` scorri, `Invio` apri, `Spazio` seleziona, `1`–`6` cambia stato, `A` assegna a te, `U` togli assegnazione, `/` cerca, `R` aggiorna.
- **Azioni di massa**: stato, priorità e assegnazione su decine di pratiche in un gesto solo.
- **Risposta senza mouse**: `Ctrl+Invio` invia al condomino, `Ctrl+Maiusc+Invio` salva una nota interna.
- **Sempre viva**: la coda si aggiorna da sola in sottofondo e le notifiche arrivano come avvisi di Windows anche a finestra chiusa (l'app resta nell'area di notifica).
- **Richiamo globale** `Ctrl+Alt+S` da qualunque programma: porta su l'app e apre il comando rapido.
- `Ctrl+1`…`Ctrl+9` saltano direttamente alle sezioni, `Ctrl+B` comprime la barra laterale, `F1` mostra tutte le scorciatoie.
- **Viste salvate**: i tagli della coda che si rifanno ogni giorno ("le mie urgenti", "in attesa da una settimana") si salvano con un nome e tornano nella tendina e nel comando rapido.
- **Esportazione in CSV**: coda e registro finiscono in Excel con un clic, separatore e accenti già giusti per Excel italiano.

## Interfaccia

L'aspetto è quello di un gestionale da postazione fissa, non di una pagina web
messa in una finestra:

- **Navigazione raggruppata** per mestiere — Operatività, Anagrafiche,
  Comunicazioni, Amministrazione — comprimibile a sole icone con `Ctrl+B`.
- **Testata di contesto** con percorso della sezione, ricerca globale, spia del
  collegamento, notifiche non lette e cambio tema.
- **Barra di stato** sempre visibile: chi è collegato, a quale server, quando è
  arrivato l'ultimo aggiornamento, se gli avvisi sono silenziati, quale
  versione è installata.
- **Tema chiaro e scuro** curati entrambi, con due densità di elenco
  (compatta per stare sulle righe, comoda per la lettura prolungata).
- **Schermata di accesso dello Studio**, con il marchio, il nome dello Studio e
  l'indirizzo del server a cui ci si sta collegando.

## Accesso e sicurezza

L'accesso è quello del sito: stesse email e stesse password. L'app apre una
sessione che si dichiara `desktop`: token in `Authorization: Bearer`,
identificativo del dispositivo in `X-Device-Id`, durata 30 giorni rinnovata a
ogni uso.

### Accesso senza codice a sei cifre

Su questo computer il codice via email si può saltare, ma non basta che sia
l'app a chiederlo — chiunque potrebbe dichiararsi tale. Il salto vale solo se
combaciano tre cose: la **chiave dell'applicazione** (Impostazioni →
Collegamento) uguale al segreto `DESKTOP_APP_KEY` del Worker, un
identificativo di dispositivo valido, e un account dipendente o titolare. In
quel caso il server risponde subito con il token e si entra con sole email e
password.

Il secondo fattore non sparisce: da "un codice sulla tua casella" diventa
"questo computer, con l'app e la sua chiave". Chi ruba solo la password non
entra da nessun'altra parte, e cancellando il segreto sul Worker la scorciatoia
si chiude per tutti al primo accesso successivo. Con la chiave vuota — la
condizione predefinita — l'app chiede il codice come il sito.

- Il token è cifrato con DPAPI di Windows (`safeStorage`) e leggibile solo
  dall'account Windows che ha fatto l'accesso. Se la cifratura non è
  disponibile, il token resta in memoria e non viene scritto sul disco.
- Il device id è un numero casuale generato alla prima apertura: senza il token
  non serve a niente, e senza di lui il token non vale.
- La rete la fa solo il processo principale: la pagina non ha accesso a Node,
  non vede il token e non può aprire connessioni (`Content-Security-Policy` con
  `connect-src 'none'`).
- I token CSRF monouso richiesti dal server per le operazioni di modifica sono
  gestiti in automatico, senza sprecare un giro di rete sulle rotte che non li
  usano.
- Le sessioni aperte si vedono e si revocano da **Impostazioni → Dispositivi
  collegati**.

### Blocco della postazione

Dopo un tempo di inattività configurabile (15 minuti di serie) l'app si oscura
e chiede di nuovo la password; `Ctrl+L` blocca subito. La sessione con il
server **non** viene chiusa: non serve un nuovo codice di verifica e non si
perde il lavoro a metà, si verifica soltanto che davanti al computer ci sia
ancora la stessa persona. Si regola da **Impostazioni → Sicurezza della
postazione**.

### Registro locale delle attività

Il server sa che cosa è cambiato sulle pratiche; il registro locale sa che cosa
è stato fatto *da questo computer*, anche quando la rete era giù: accessi
riusciti e **rifiutati**, sblocchi, esportazioni, importazioni di impostazioni.
È un file JSONL nella cartella dati, che ruota da solo, consultabile ed
esportabile dalla sezione **Registro attività**.

### Quando avvisare

Le notifiche di Windows si possono silenziare a mano ("non disturbare") o
limitare all'orario di lavoro dello Studio, sabato e domenica esclusi. La coda
continua comunque ad aggiornarsi: cambia solo il riquadro che salta su.

## Pannello di controllo (solo titolare)

Chi entra con l'account `super_admin` trova una sezione in più:

- **Sessioni attive** — chi sta lavorando adesso, da quale computer (browser,
  app Android, app Windows), da quanto è aperta la sessione e quando è stata
  l'ultima attività. Ogni riga si può chiudere.
- **Attività dello staff** — per ciascun dipendente, sul periodo scelto:
  accessi (e quanti dall'app), tentativi falliti, risposte scritte, note
  interne, cambi di stato, chiusure, pratiche in carico e sessioni vive. Sotto,
  gli ultimi eventi in ordine di tempo.
- **Credenziali dipendenti** — creazione account, cambio ruolo, attivazione e
  disattivazione, sblocco dopo troppi tentativi, nuova password (proposta già
  conforme alle regole del server).
- **Credenziali condomini** — stesse operazioni sugli account dei condomini,
  con ricerca per nome o email e i condomini di appartenenza in chiaro.
- **Diario completo** — il registro dello Studio, filtrabile per periodo,
  persona e testo.

Reimpostare una password chiude tutte le sessioni di quell'account, e ogni
operazione delicata resta nel diario con il nome di chi l'ha fatta.

## Archivio: che cosa sta dove

La sezione **Archivio** tiene insieme due cose diverse, e la differenza è
scritta anche a schermo perché cambia chi vede cosa:

- **Documenti del condominio** — verbali, rendiconti, regolamenti,
  comunicazioni. Stanno sul server dello Studio (bucket R2, rotta
  `/api/documents`): li vedono i colleghi e, per le categorie previste, i
  condomini nella loro area riservata. Si caricano e si scaricano da qui.
- **Schede di dettaglio** — condominio (codice fiscale, IBAN, polizza,
  manutentori, assemblee) e singolo condomino (unità immobiliare, millesimi,
  titolo, recapiti, codice fiscale, note di gestione, file allegati). L'API
  dello Studio non ha oggi un posto dove conservarle, quindi restano **su
  questo computer**, in `%APPDATA%\Win Studio Admin\archivio.json` con i file in
  `archivio-file\`. Non vengono sincronizzate né condivise: quello che deve
  vedere anche un collega va caricato tra i documenti del condominio.

Accanto alla scheda di una persona l'app mostra ciò che il server sa già di lei:
posizione contabile, importo scoperto, note e pratiche recenti.

## Aggiornamento automatico

Ogni push sul ramo principale del repository diventa una nuova versione: il
flusso `.github/workflows/rilascio.yml` alza il numero di versione, compila
l'installer per Windows e lo pubblica fra le **Release** di GitHub.

Le copie installate se ne accorgono da sole:

- controllo all'avvio e poi una volta all'ora;
- scaricamento in sottofondo, senza interrompere il lavoro;
- installazione alla chiusura dell'app — oppure subito, dal riquadro che
  compare in alto («Riavvia e aggiorna adesso») o da **Impostazioni →
  Aggiornamenti**, dove si vede sempre a che punto e e si puo forzare un
  controllo. Anche il menu dell'area di notifica ha la voce «Controlla
  aggiornamenti».

Nessun aggiornamento parte di sorpresa mentre si sta scrivendo a un condomino:
il riavvio avviene solo su richiesta o alla chiusura. Se un aggiornamento non
riesce, l'app continua a funzionare con la versione che ha e lo segnala nel
riquadro.

Non serve configurare niente: il flusso usa il `GITHUB_TOKEN` che GitHub
fornisce da solo. Per pubblicare a mano — o per alzare `minor`/`major` invece
di `patch` — basta lanciare il flusso «Rilascio Windows» da **Actions →
Run workflow**. In locale, `npm run rilascia` compila e pubblica usando la
variabile d'ambiente `GH_TOKEN`.

L'aggiornamento automatico vale sull'app installata: avviata da sorgente con
`npm start` il controllo resta spento, e le impostazioni lo dicono.

## Requisiti

- Windows 10 (1809 o successivo) o Windows 11, 64 bit
- Node.js 20 o superiore per compilare
- Un account dipendente o titolare sul sito dello Studio

## Avvio in sviluppo

```bash
npm install
npm start        # oppure: npm run dev  (con gli strumenti di sviluppo aperti)
```

## Pacchetto per Windows

```bash
npm run dist     # installer NSIS in dist\
npm run pack     # solo la cartella eseguibile, senza installer
```

L'installer è per utente (nessun diritto di amministratore), con scelta della
cartella di destinazione.

## Configurazione

Alla prima apertura l'app punta al Worker di produzione
(`https://sitoamm.giuliomichelotti820.workers.dev`). L'indirizzo si cambia da
**Impostazioni → Collegamento**, per esempio per lavorare contro
`wrangler dev`. Da lì si regolano anche il ritmo delle notifiche, la densità
degli elenchi, il tema e l'avvio in area di notifica.

La configurazione di una postazione si **esporta e si importa** in JSON
(**Impostazioni → Copia delle impostazioni**): server, viste salvate, aspetto,
sicurezza e orari si portano su un altro computer senza rifare tutto a mano.
La chiave dell'applicazione e le credenziali non vengono mai esportate.

**Impostazioni → Diagnostica** risponde alla prima domanda dell'assistenza:
versione, latenza verso il server, identificativo del dispositivo, stato della
cifratura della sessione e percorsi dei file. Il rapporto si esporta in un
file.

## Com'è fatta

```
src/
  main/         processo principale: finestra, sessione, rete, notifiche
    main.js     ciclo di vita, IPC, area di notifica, scorciatoia globale
    api.js      chiamate al Worker (Bearer + device id + CSRF automatico)
    store.js    impostazioni, token cifrato, identificativo del dispositivo
    archivio.js schede locali di condominio e condomino
    registro.js registro locale delle attività della postazione (JSONL)
    aggiornamenti.js  controllo, scaricamento e installazione delle versioni
  preload/      ponte ristretto fra pagina e processo principale
  renderer/     interfaccia (moduli ES nativi, nessun bundler)
    app.js      guscio, navigazione, comando rapido, barra di stato
    assets/logo.svg   marchio dello Studio, usato ovunque nell'app
    lib/ui.js         elementi, formattazione, modali, cache, chiamate
    lib/marchio.js    marchio e nomi dello Studio
    lib/esporta.js    esportazione CSV e JSON
    lib/blocco.js     blocco della postazione per inattività
    lib/scorciatoie.js elenco delle scorciatoie (F1)
    views/            una sezione per file (accesso.js è la schermata di accesso)
```

```
.github/workflows/rilascio.yml   pubblicazione automatica a ogni push
```

Nessun bundler lato interfaccia e una sola dipendenza a runtime
(`electron-updater`): l'app si avvia subito e si aggiorna da sola.
