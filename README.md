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
| **Impostazioni** | Collegamento, sicurezza della postazione, PIN rapido, orari degli avvisi, copia della configurazione, diagnostica. |
| **Guida del programma** | Manuale completo dentro l'app: sedici capitoli con indice, ricerca a testo pieno, aiuto contestuale (`Maiusc+F1`) ed esportazione in testo. |

## Pensata per il volume

- **Comando rapido** `Ctrl+K`: sezioni, filtri pronti e ricerca di una pratica per numero, oggetto o richiedente.
- **Coda da tastiera**: `j`/`k` scorri, `Invio` apri, `Spazio` seleziona, `1`–`6` cambia stato, `A` assegna a te, `U` togli assegnazione, `/` cerca, `R` aggiorna.
- **Azioni di massa**: stato, priorità e assegnazione su decine di pratiche in un gesto solo.
- **Risposta senza mouse**: `Ctrl+Invio` invia al condomino, `Ctrl+Maiusc+Invio` salva una nota interna.
- **Sempre viva**: la coda si aggiorna da sola in sottofondo e le notifiche arrivano come avvisi di Windows anche a finestra chiusa (l'app resta nell'area di notifica).
- **Richiamo globale** `Ctrl+Alt+S` da qualunque programma: porta su l'app e apre il comando rapido.
- **Spostamenti a due tasti**: `G` e poi l'iniziale della sezione — `G C` la coda, `G S` gli stabili, `G W` WhatsApp, `G H` la guida. Le lettere sono quelle con cui le sezioni vengono chiamate in ufficio, non i numeri di posizione.
- `Ctrl+1`…`Ctrl+9` saltano alle prime nove sezioni, `Ctrl+B` comprime la barra laterale, `Alt+←` e `Alt+→` percorrono la cronologia, `Ctrl+/` mostra tutte le scorciatoie con la ricerca, `F1` apre la guida.
- **Viste salvate**: i tagli della coda che si rifanno ogni giorno ("le mie urgenti", "in attesa da una settimana") si salvano con un nome e tornano nella tendina e nel comando rapido.
- **Esportazione in CSV**: coda e registro finiscono in Excel con un clic, separatore e accenti già giusti per Excel italiano.

## Interfaccia

L'aspetto è quello di un gestionale da postazione fissa, non di una pagina web
messa in una finestra:

- **Navigazione raggruppata** per mestiere — Operatività, Anagrafiche,
  Comunicazioni, Amministrazione — comprimibile a sole icone con `Ctrl+B`.
- **Testata di contesto** con percorso della sezione, ricerca globale, spia del
  collegamento, **menu a tendina dello stato del sistema**, notifiche non lette,
  cambio tema e guida.
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

### PIN rapido di accesso

Appena un account viene associato al computer, l'app propone di scegliere un
**PIN da 4 a 8 cifre**. Da quel momento riprendere la postazione bloccata
richiede il PIN invece della password completa.

Non è una comodità gratuita, è ciò che rende sostenibile il blocco: senza PIN,
quindici minuti di inattività significano digitare una password lunga trenta
volte al giorno, e finisce sempre allo stesso modo — blocco alzato a un'ora,
password accorciata, o foglietto sotto la tastiera.

Che cosa il PIN **è**:

- valido **solo su questo computer** e **solo per quell'account**: è legato al
  `deviceId` della postazione e all'id utente;
- una chiave per **riaprire una sessione già aperta**, non per aprirne di nuove.
  Se il token del server è scaduto si torna comunque alle credenziali;
- **mai in rete**: la verifica avviene tutta nel processo principale.

Come viene conservato: sul disco non finisce mai il PIN, ma solo la sua
derivazione **PBKDF2-SHA512 a 310 000 giri con sale casuale**; dove Windows
offre DPAPI, anche quella derivazione è cifrata con `safeStorage`, così un
altro profilo Windows non può nemmeno tentarne la forzatura offline.

Regole e limiti:

- rifiutate le cifre tutte uguali, le sequenze consecutive e i PIN più diffusi;
- **cinque tentativi**: al quinto errore il PIN viene cancellato dalla
  postazione e si torna alla password, da cui se ne può impostare subito uno
  nuovo. Nessun blocco a tempo — chi ha davvero sbagliato non deve restare
  fuori dal proprio lavoro;
- impostarlo o cambiarlo richiede **sempre la password dell'account**: è
  l'unica prova che davanti alla tastiera ci sia ancora il suo titolare;
- si gestisce da **Impostazioni → Sicurezza**, dal menu dell'account o dal
  comando rapido.

### Stato del sistema, in testata

Un menu a tendina (`Ctrl+Maiusc+S`, o il pallino accanto alle notifiche)
raccoglie **in un posto solo** ogni pezzo che può smettere di funzionare:

| Gruppo | Che cosa sorveglia |
| --- | --- |
| **Collegamento** | Raggiungibilità e latenza del server dello Studio, validità della sessione. |
| **Comunicazioni** | Canale email Gmail e ultimi invii, lettura automatica della posta, WhatsApp Business e il suo webhook, notifiche di Windows. |
| **Lavoro** | Urgenti aperte, pratiche senza assegnatario, richieste dal modulo contatti, tempo medio di chiusura. |
| **Sicurezza** | Blocco per inattività, PIN rapido, cifratura della sessione sul disco. |
| **Postazione** | Aggiornamento dell'applicazione, cartella dei dati locali. |

Tre regole di lettura, applicate senza eccezioni:

1. ogni spia dice sempre una delle cinque cose — *operativo*, *da controllare*,
   *non funziona*, *disattivato*, *non verificato*. Non esiste il verde per
   «probabilmente»: ciò che non è stato interrogato risulta non verificato;
2. il pallino in testata riassume la **peggiore**. Se è rosso, in ufficio si sta
   già perdendo tempo su qualcosa;
3. ogni riga porta **dove si risolve**. Uno stato che non si può affrontare da
   nessuna parte è una notizia inutile.

Le sonde girano in parallelo e cadono ognuna per conto suo: WhatsApp fuori uso
non nasconde che l'email invece funziona. Chi non ha i permessi per una rotta
da titolare non vede un errore rosso, ma una riga che lo dice.

**«Copia il rapporto»**, in fondo alla tendina, mette negli appunti il quadro
completo con versione, utente e orario: è l'unica cosa da incollare in una
richiesta di assistenza.

### Guida del programma

Il manuale sta **dentro l'applicazione**, non in un PDF su una cartella di rete
che nessuno apre: sedici capitoli con indice a sinistra, ricerca a testo pieno
su tutto il contenuto, navigazione avanti/indietro fra capitoli ed esportazione
in testo da mandare per email.

- `F1` apre la guida; `Maiusc+F1` la apre **sul capitolo che riguarda la
  sezione aperta in quel momento**;
- i capitoli più cercati (il PIN, lo stato del sistema, «quando qualcosa non
  va», le domande frequenti) si raggiungono anche dal comando rapido;
- il capitolo delle scorciatoie **non è scritto a mano**: legge la stessa
  tabella che governa i tasti veri, quindi non può raccontarne di diversi.

### Blocco della postazione

Dopo un tempo di inattività configurabile (15 minuti di serie) l'app si oscura
e per riprendere serve il **PIN** — o la password, se il PIN non è impostato o
è stato disattivato dai tentativi sbagliati; `Ctrl+L` blocca subito. La sessione
con il server **non** viene chiusa: non serve un nuovo codice di verifica e non
si perde il lavoro a metà, si verifica soltanto che davanti al computer ci sia
ancora la stessa persona. Si regola da **Impostazioni → Sicurezza della
postazione**.

### Registro locale delle attività

Il server sa che cosa è cambiato sulle pratiche; il registro locale sa che cosa
è stato fatto *da questo computer*, anche quando la rete era giù: accessi
riusciti e **rifiutati**, sblocchi con password e con PIN, PIN impostati,
sostituiti o disattivati dai tentativi, esportazioni, importazioni di
impostazioni.
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
    pin.js      PIN rapido: derivazione PBKDF2, tentativi, legame utente+dispositivo
    archivio.js schede locali di condominio e condomino
    registro.js registro locale delle attività della postazione (JSONL)
    aggiornamenti.js  controllo, scaricamento e installazione delle versioni
  preload/      ponte ristretto fra pagina e processo principale
  renderer/     interfaccia (moduli ES nativi, nessun bundler)
    app.js      guscio, navigazione, cronologia, comando rapido, barra di stato
    assets/logo.svg   marchio dello Studio, usato ovunque nell'app
    lib/ui.js         elementi, formattazione, modali, cache, chiamate
    lib/marchio.js    marchio e nomi dello Studio
    lib/esporta.js    esportazione CSV e JSON
    lib/blocco.js     blocco della postazione per inattività (PIN o password)
    lib/pin.js        campo a cifre, tastierino e procedura di scelta del PIN
    lib/stato-sistema.js  sonde dei servizi e menu a tendina dello stato globale
    lib/scorciatoie.js tabella unica di tasti + descrizioni, e finestra dell'aiuto
    views/            una sezione per file (accesso.js è la schermata di accesso,
                      guida.js è il manuale completo)
```

```
.github/workflows/rilascio.yml   pubblicazione automatica a ogni push
```

Nessun bundler lato interfaccia e una sola dipendenza a runtime
(`electron-updater`): l'app si avvia subito e si aggiorna da sola.

Due punti in cui la struttura porta una decisione, non solo del codice:

- **`lib/scorciatoie.js` è una tabella sola.** Combinazioni, descrizioni e
  comportamento nascono dalla stessa struttura dati: `app.js` fornisce una
  funzione per identificatore, la finestra `Ctrl+/` e il capitolo della guida
  leggono le stesse righe. Finché l'elenco dell'aiuto è scritto a mano da una
  parte e i tasti dall'altra, i due divergono in due settimane.
- **Il PIN non attraversa mai il renderer come segreto.** La pagina lo
  raccoglie e lo consegna al processo principale, che tiene sale, derivazione e
  contatore dei tentativi; non esiste una rotta IPC che lo restituisca. Si può
  impostare e verificare, mai rileggere.
