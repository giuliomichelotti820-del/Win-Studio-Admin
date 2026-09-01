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
| **Promemoria** | Gli impegni presi su questa postazione — «richiamare l'idraulico giovedì alle nove» — con l'avviso di Windows all'ora scelta, anche a finestra chiusa. |
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

## Il marchio

L'app usa il **marchio ufficiale dello Studio**, non una sua interpretazione: è
lo stesso file vettoriale del sito (`assets/img/logo-mark.svg` di
`Sito-Amm.Burch`), con la stessa geometria, gli stessi sfumati e gli stessi tre
colori — blu notte `#0B2341`, verde `#2E7A50`, arancio `#E8843D`.

Tre risorse, tre usi distinti, in `src/renderer/assets/`:

| File | Dove si usa | Perché così |
| --- | --- | --- |
| `marchio.svg` | superfici chiare | il simbolo nudo: la «A» blu notte si legge solo su fondo chiaro |
| `logo.svg` | barra dei titoli, laterale, icona di Windows | lo stesso simbolo in una tessera chiara — è anche l'icona che Windows mostra sulla barra delle applicazioni, così il simbolo dell'app e quello dell'icona coincidono ovunque |
| `marchio-esteso.svg` | accesso e blocco | il lockup completo con ragione sociale e attività, dove c'è spazio per leggerlo per intero |

Le risorse binarie — icona di Windows a sette risoluzioni, icona dell'area di
notifica, le due immagini dell'installer — **non sono disegnate a mano**: le
genera `build/genera-marchio.py` dal marchio ufficiale del sito. Se il marchio
dello Studio cambia si rilancia quello, non si rincorrono venti file.

```bash
pip install pillow
python3 build/genera-marchio.py            # cerca ../Sito-Amm.Burch
python3 build/genera-marchio.py /percorso/del/sito
```

Anche la **tavolozza** viene da lì. Non sono grigi neutri: sono i tre colori del
marchio portati alle luminosità che servono su fondo scuro, gli stessi della
console web dello Studio (`admin.css` del sito). L'arancio comanda le azioni, il
verde conferma, il blu notte regge le superfici. Chi passa dal browser all'app
non cambia prodotto, cambia finestra.

## Pensata per il volume

- **Schede di lavoro**: fino a dodici pratiche aperte insieme, come su un
  browser — `Ctrl+Tab` per girare, `Ctrl+W` per chiudere, doppio clic per
  fissare una linguetta. Le pratiche aperte si ritrovano al riavvio.
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
- **Stampa della pratica in PDF** su carta intestata dello Studio: marchio,
  dati, conversazione, storico e numeri di pagina. È il documento che si allega
  a un preventivo o si porta in assemblea, non una schermata di gestionale.
- **Ingrandimento dell'interfaccia** `Ctrl +` / `Ctrl -` / `Ctrl 0`, ricordato
  per postazione: dipende dal monitor che c'è sulla scrivania, non dall'account.

## Interfaccia

L'aspetto è quello di un gestionale da postazione fissa, non di una pagina web
messa in una finestra:

Cinque fasce, dall'alto in basso, e non si spostano mai:

- **Barra dei titoli dello Studio** al posto di quella di Windows. Non è
  decorazione: dice **a quale server sei collegato**, cosa che la barra di
  sistema non può dire, e se non è quello di produzione diventa arancione e lo
  scrive. Chiudere una pratica sul collaudo credendo di essere in produzione si
  scopre il giorno dopo, dal condomino che richiama. In più restituisce
  l'altezza di due righe di coda.
- **Testata di contesto** con percorso della sezione, avanti e indietro,
  ricerca globale, promemoria rapido, spia del collegamento, **menu a tendina
  dello stato del sistema**, notifiche non lette, cambio tema e guida.
- **Nastro delle schede di lavoro**, che compare quando ne hai almeno due.
- **Navigazione raggruppata** per mestiere — Operatività, Anagrafiche,
  Comunicazioni, Amministrazione — comprimibile a sole icone con `Ctrl+B`.
- **Barra di stato** sempre visibile: chi è collegato, a quale server, quando è
  arrivato l'ultimo aggiornamento, se gli avvisi sono silenziati, a che
  ingrandimento sei, quale versione è installata.

E poi:

- **Icone disegnate**, non emoji. Un pittogramma di sistema cambia faccia a
  ogni versione di Windows, non si può colorare e non si allinea con gli altri;
  le icone di `lib/icone.js` sono tracciati che seguono `currentColor`, così la
  voce di menu attiva le accende nell'arancio del marchio.
- **Tema chiaro e scuro** curati entrambi — non l'uno schiarito dall'altro: sul
  bianco l'arancio perde contrasto, quindi scende a una tostatura più scura e i
  collegamenti tornano al blu dello Studio — con due densità di elenco
  (compatta per stare sulle righe, comoda per la lettura prolungata).
- **Schermata di accesso dello Studio**, con il marchio per esteso, la riga di
  attività e l'indirizzo del server a cui ci si sta collegando.

## Schede di lavoro

Una segnalazione non si lavora quasi mai da sola: si apre la pratica
dell'infiltrazione, si va a vedere la scheda del condominio, si controlla il
DURC dell'impresa, si torna alla pratica. Con una vista sola ogni salto costava
il ritorno alla coda e la ricerca da capo — dieci volte al giorno, per anni.

- Ogni apertura **è** una scheda: non esiste un «apri in una scheda nuova».
- Fino a **dodici** insieme. Oltre, le linguette diventano illeggibili, e una
  scheda che non si legge non è una scheda aperta, è disordine. Superato il
  limite si chiude la più vecchia, mai quella su cui si sta lavorando.
- Le **pratiche** aperte si ritrovano al riavvio; le sezioni no, perché la barra
  laterale le raggiunge in un clic e riaprirle tutte farebbe del nastro un
  secondo menu.
- **Doppio clic** fissa una linguetta: resta anche quando si chiude tutto il
  resto.
- `Ctrl+Tab` e `Ctrl+Maiusc+Tab` girano, `Ctrl+W` chiude, il tasto centrale
  chiude quella sotto il puntatore. Sono le combinazioni di un browser, di
  proposito: chi apre otto pratiche insieme le conosce già da vent'anni.

Una scheda conserva il **posto**, non lo stato della pagina: tornandoci i dati
vengono richiesti di nuovo al server. È un bene — quello che si legge è sempre
fresco — ma un modulo lasciato a metà non si ritrova, e le viste con del testo
in lavorazione lo chiedono prima di lasciar cambiare scheda.

## Promemoria

«Richiamare l'idraulico giovedì alle nove» non è uno stato della pratica: è un
impegno di una persona, a un'ora precisa. Finché non c'era un posto dove
metterlo finiva su un foglietto, e il foglietto si perde.

- Si prendono dalla sveglia in testata, da `Ctrl+Maiusc+R`, dal comando rapido
  o **dal bottone dentro la scheda di una pratica** — e in quel caso l'avviso,
  quando suona, riporta dentro quella pratica con un clic.
- Le scorciatoie (fra un'ora, stasera, domani mattina, lunedì prossimo) coprono
  quasi tutti i casi; la data per esteso resta lì sotto per gli altri.
- Suonano con una **notifica di Windows** anche a finestra chiusa: l'app resta
  nell'area di notifica proprio per questo. Uno scaduto mentre l'app era chiusa
  suona alla riapertura, **una volta sola**.
- Si rinviano di dieci minuti o a domani, si segnano come fatti, si eliminano.

Sono **locali**, e la scheda lo dice a schermo invece di lasciarlo intuire: chi
ci mette dentro un impegno che riguarda tutto lo Studio deve sapere che i
colleghi non lo vedranno. Per quello ci sono le note interne sulla pratica.

## Copie di sicurezza dei dati locali

Quasi tutto arriva dal server dello Studio ed è al sicuro lì. Una parte no: le
schede di dettaglio di condominio e di condomino, i file che ci sono attaccati,
i promemoria, il registro della postazione e le viste salvate della coda stanno
**solo su questo computer**.

- **Una copia al giorno**, alla prima apertura utile. Non a orario fisso: l'app
  di uno Studio non è accesa alle tre di notte, e una copia programmata che non
  parte mai è una copia che non esiste. Si tengono le ultime dieci.
- Una copia è una **cartella normale**, non un archivio compresso: si apre con
  Esplora file, si legge con il Blocco note, si copia a mano su una chiavetta.
  Un formato che richiede questo programma per essere riletto sarebbe
  esattamente il formato sbagliato per una copia di sicurezza.
- **«Salva una copia altrove…»** la scrive dove si vuole — ed è l'unica che
  serve davvero quando il disco si rompe.
- Il **ripristino** mette da parte lo stato attuale in una copia di riserva
  prima di toccare qualsiasi cosa: un ripristino sbagliato deve restare
  annullabile, altrimenti è solo un secondo modo di perdere i dati.

Nelle copie non finiscono **mai** il token di sessione, la derivazione del PIN e
la chiave dell'applicazione: sono legati a questo profilo di Windows, e una
copia è fatta per essere portata altrove.

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
  compare in alto («Riavvia e aggiorna adesso»). Anche il menu dell'area di
  notifica ha la voce «Controlla aggiornamenti».

### Impostazioni → Aggiornamenti

Il quadro completo, per chi ha appena pubblicato e non vuole aspettare l'ora
tonda:

| Cosa mostra | |
| --- | --- |
| Stato | *aggiornata*, *disponibile*, *in scaricamento con la percentuale*, *pronta*, *errore con il motivo* |
| Versioni | quella installata e quella trovata sul repository |
| Origine | da quale `owner/repo` arrivano le versioni — è la stessa `build.publish` che legge electron-updater, non un valore scritto due volte |
| Ultimo controllo | data e ora |

E quattro comandi:

- **Controlla adesso** — forza il controllo, senza aspettare l'ora.
- **Scarica la versione …** — compare quando c'è qualcosa da scaricare; serve
  quando lo scaricamento automatico è spento, o quando uno è fallito a metà.
- **Riavvia e installa adesso** — quando la versione è pronta.
- **Vedi le versioni su GitHub** — l'elenco delle Release con le note.

La casella **«Scarica da sola le versioni nuove»** si spegne dove la linea è
lenta o a consumo: da lì in poi l'app avvisa e aspetta il via. Il cambio ha
effetto subito, senza riavviare.

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

### Passare a questa versione da una già installata

Non c'è niente da disinstallare e niente da rifare a mano.

1. Il push su `main` fa partire **Actions → Rilascio Windows**, che alza la
   versione, compila l'installer e pubblica la Release.
2. Le copie già installate se ne accorgono entro un'ora — o subito, da
   **Impostazioni → Aggiornamenti → Controlla adesso**. Chi vuole anticipare
   apre l'app e preme quel bottone.
3. Quando la versione è pronta, **«Riavvia e installa adesso»**. In alternativa
   basta chiudere l'app: si installa da sola alla chiusura.

Nulla va perso nel passaggio: la sessione resta aperta (niente nuovo codice a
sei cifre), il PIN resta valido, e schede di archivio, allegati, viste salvate e
registro restano dove sono — l'installer non tocca `%APPDATA%\Win Studio Admin`
durante un aggiornamento.

Se l'app installata è troppo vecchia per aggiornarsi da sola — o se non è mai
stata installata dall'installer — si scarica `Win Studio Admin-Setup-x.y.z.exe`
dall'ultima Release e lo si esegue **sopra** l'installazione esistente: chiude
l'app aperta da solo, sostituisce i file e lascia stare i dati.

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

### L'installer

Per **utente**, senza diritti di amministratore: sulle postazioni dello Studio
nessuno li ha, e un installer che li chiede finisce con una telefonata al
consulente informatico invece che con un programma installato. Le pagine sono
in **italiano** (`language: 1040`), con il marchio dello Studio sul fianco e in
testata.

Oltre a quello che fa `electron-builder`, `build/installer.nsh` aggiunge:

1. **chiude l'applicazione se è aperta**, compresa quella che sta solo
   nell'area di notifica — che è il caso normale, visto che ci resta tutto il
   giorno. Senza questo passaggio l'aggiornamento fallisce con un «file in uso»
   che non spiega niente a nessuno;
2. **avvio automatico con Windows**, offerto come casella nell'ultima pagina e
   spento di default. Chi installa il programma sulla postazione della
   segreteria lo decide adesso, non fra tre giorni. All'accesso l'app parte
   nell'area di notifica, non a tutto schermo davanti al desktop;
3. registra i collegamenti **`winstudio://`**: un link `winstudio://pratica/1204`
   in una email di servizio apre quella pratica dentro l'app invece di
   costringere a cercarla nella coda. Si accettano solo le forme conosciute —
   un indirizzo storto non può pilotare l'app in un posto qualsiasi;
4. alla **disinstallazione** chiede se buttare via anche i dati locali (schede,
   allegati, promemoria, copie di sicurezza) e di default **li lascia stare**.
   Chi disinstalla per reinstallare non deve perdere niente. Durante un
   aggiornamento la domanda non compare affatto: il disinstallatore gira in
   silenzio e i dati non si toccano mai.

Collegamento sul desktop e voce nel menu Start sotto «Studio Associato Amm.
Burchielli» vengono creati da soli.

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
    main.js     ciclo di vita, IPC, area di notifica, scorciatoia globale,
                comandi finestra, ingrandimento, collegamenti winstudio://
    api.js      chiamate al Worker (Bearer + device id + CSRF automatico)
    store.js    impostazioni, token cifrato, identificativo del dispositivo
    pin.js      PIN rapido: derivazione PBKDF2, tentativi, legame utente+dispositivo
    archivio.js schede locali di condominio e condomino
    registro.js registro locale delle attività della postazione (JSONL)
    promemoria.js     impegni della postazione e loro avviso di Windows
    copie.js          copie di sicurezza dei dati locali, e loro ripristino
    stampa.js         la pratica in PDF su carta intestata dello Studio
    aggiornamenti.js  controllo, scaricamento e installazione delle versioni
  preload/      ponte ristretto fra pagina e processo principale
  renderer/     interfaccia (moduli ES nativi, nessun bundler)
    app.js      guscio, barra dei titoli, navigazione, schede, comando rapido
    assets/marchio.svg         il simbolo ufficiale, nudo
    assets/logo.svg            lo stesso simbolo nella tessera chiara
    assets/marchio-esteso.svg  il lockup completo dello Studio
    lib/ui.js         elementi, formattazione, modali, cache, chiamate
    lib/icone.js      l'insieme dei pittogrammi disegnati dell'applicazione
    lib/marchio.js    marchio e nomi dello Studio
    lib/schede.js     schede di lavoro: apertura, chiusura, fissaggio, ripristino
    lib/esporta.js    esportazione CSV e JSON
    lib/blocco.js     blocco della postazione per inattività (PIN o password)
    lib/pin.js        campo a cifre, tastierino e procedura di scelta del PIN
    lib/stato-sistema.js  sonde dei servizi e menu a tendina dello stato globale
    lib/scorciatoie.js tabella unica di tasti + descrizioni, e finestra dell'aiuto
    views/            una sezione per file (accesso.js è la schermata di accesso,
                      guida.js è il manuale completo)
```

```
build/installer.nsh              aggiunte italiane all'installer NSIS
.github/workflows/rilascio.yml   pubblicazione automatica a ogni push
```

Nessun bundler lato interfaccia e una sola dipendenza a runtime
(`electron-updater`): l'app si avvia subito e si aggiorna da sola.

Quattro punti in cui la struttura porta una decisione, non solo del codice:

- **`lib/scorciatoie.js` è una tabella sola.** Combinazioni, descrizioni e
  comportamento nascono dalla stessa struttura dati: `app.js` fornisce una
  funzione per identificatore, la finestra `Ctrl+/` e il capitolo della guida
  leggono le stesse righe. Finché l'elenco dell'aiuto è scritto a mano da una
  parte e i tasti dall'altra, i due divergono in due settimane.
- **Il PIN non attraversa mai il renderer come segreto.** La pagina lo
  raccoglie e lo consegna al processo principale, che tiene sale, derivazione e
  contatore dei tentativi; non esiste una rotta IPC che lo restituisca. Si può
  impostare e verificare, mai rileggere.
- **Il documento da stampare lo compone il processo principale.** Il renderer
  manda *dati*, non HTML: ogni valore passa da una funzione di neutralizzazione
  prima di finire nella pagina, così l'oggetto di una segnalazione scritto da un
  condomino non può diventare markup. La finestra di stampa nasce senza
  preload, senza Node e senza JavaScript: non ha niente da cui attingere.
- **`lib/icone.js` è un insieme solo, e sono tracciati.** Le emoji che c'erano
  prima cambiavano faccia a ogni versione di Windows, non si potevano colorare e
  non si allineavano fra loro. Chi aggiunge una sezione aggiunge una riga alla
  tabella dei tracciati e la chiama per nome: nessun file nuovo, nessuna
  richiesta di rete.
