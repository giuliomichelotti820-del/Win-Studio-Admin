/* =============================================================================
 * Guida del programma
 *
 * Il manuale sta dentro l'applicazione, non in un PDF su una cartella di rete
 * che nessuno apre. Lo Studio assume, sostituisce, va in ferie: chi si siede
 * alla postazione il primo giorno deve poter rispondere da solo alle domande
 * che altrimenti farebbe al collega — e sono sempre le stesse cinque.
 *
 * Come e fatto: un indice a sinistra, il capitolo a destra, una casella di
 * ricerca che cerca dentro il testo di tutti i capitoli e non solo nei titoli.
 * Ogni capitolo e un pezzo di dati, non di HTML scritto a mano: cosi la
 * ricerca puo leggerlo, la stampa puo impaginarlo e l'esportazione puo
 * trasformarlo in un file di testo da mandare per email a chi chiede «come si
 * fa a…».
 *
 * Sul tono: sono istruzioni per chi ha una segnalazione aperta davanti e venti
 * minuti prima dell'assemblea, non documentazione tecnica. Prima cosa fare,
 * poi perche. Le frasi lunghe stanno nelle note, non nei passi.
 * ========================================================================== */

import { el, svuota, toast } from "../lib/ui.js";
import { SCORCIATOIE, VAI_A, SCORCIATOIE_VISTA, mostraScorciatoie } from "../lib/scorciatoie.js";
import { NOME_STUDIO } from "../lib/marchio.js";

/* =============================================================================
 * Blocchi di contenuto
 *
 * Un piccolo vocabolario, cinque forme in tutto. Aggiungerne una sesta e quasi
 * sempre il segno che il testo andava scritto meglio, non impaginato meglio.
 * ========================================================================== */

const p = (testo) => ({ t: "p", testo });
const h = (testo) => ({ t: "h", testo });
const passi = (...voci) => ({ t: "passi", voci });
const punti = (...voci) => ({ t: "punti", voci });
const nota = (testo) => ({ t: "nota", testo });
const attenzione = (testo) => ({ t: "attenzione", testo });
const tabella = (intestazioni, righe) => ({ t: "tabella", intestazioni, righe });
const tasti = (...voci) => ({ t: "tasti", voci });

/* =============================================================================
 * I capitoli
 * ========================================================================== */

const CAPITOLI = [
  /* ======================================================================= */
  {
    id: "primi-passi",
    parte: "Per cominciare",
    titolo: "Primi passi",
    sottotitolo: "Dall'installazione alla prima segnalazione aperta",
    sezioni: [
      p(`Win Studio Admin e la postazione di lavoro dello staff di ${NOME_STUDIO}. Lavora sugli stessi dati dell'area riservata del sito: quello che chiudi qui risulta chiuso anche la, subito. Non e una copia e non va sincronizzato a mano.`),

      h("Il primo accesso"),
      passi(
        "Apri l'applicazione. Si presenta la schermata di accesso con il marchio dello Studio.",
        "Inserisci le stesse email e password che useresti sul sito. Non esistono credenziali separate per l'app.",
        "Se il computer non e ancora riconosciuto come postazione dello Studio, arriva un codice di sei cifre via email: si incolla e si convalida da solo.",
        "Al primo accesso riuscito l'applicazione ti propone di scegliere un PIN rapido. Sceglilo: e la cosa che ti fara risparmiare piu tempo in assoluto."
      ),
      nota("Se spunti «Ricorda l'email su questo computer», la prossima volta trovi la casella gia riempita e il cursore direttamente sulla password. Su una postazione condivisa fra piu colleghi conviene lasciarla vuota."),

      h("Che cosa succede al secondo accesso"),
      p("Una volta che l'account e stato associato al computer, la sessione resta aperta anche chiudendo l'applicazione: riaprendola ti ritrovi dove eri. Il codice di sei cifre non viene piu chiesto, e per riprendere la postazione dopo il blocco basta il PIN."),
      attenzione("La sessione e legata a questo computer. Se apri l'app su un'altra postazione serve un nuovo accesso, e il PIN scelto qui non vale la."),

      h("La giornata tipo"),
      passi(
        "Apri l'app e guarda la Panoramica: dice com'e messo lo Studio stamattina.",
        "Passa alla Coda segnalazioni: e l'elenco delle pratiche aperte, in ordine di lavorazione.",
        "Assegna a te quelle che intendi seguire (basta il tasto A sulla riga).",
        "Lavora le pratiche cambiando stato man mano.",
        "Prima di alzarti, Ctrl+L: la postazione si blocca e per rientrare basta il PIN."
      )
    ]
  },

  /* ======================================================================= */
  {
    id: "finestra",
    parte: "Per cominciare",
    titolo: "Come e fatta la finestra",
    sottotitolo: "Dove sta ogni cosa, e perche non si sposta mai",
    sezioni: [
      p("La disposizione e sempre la stessa, in ogni sezione. E una scelta: chi lavora otto ore dentro un gestionale deve trovare i comandi con la periferia dell'occhio, non cercarli."),

      h("In cima: la barra dei titoli dello Studio"),
      p("Non e quella di Windows: e disegnata dall'applicazione, e per questo puo dire una cosa che quella di sistema non sa — a quale server sei collegato. La pastiglia accanto al nome mostra l'indirizzo; se non e quello di produzione diventa arancione e dice «collaudo». Vale la pena guardarla prima di chiudere una pratica."),
      punti(
        "I tre bottoni a destra sono quelli veri: riduci, ingrandisci, chiudi.",
        "«Chiudi» non spegne il programma: lo manda nell'area di notifica, dove continua a controllare le novita. Si esce davvero dal menu dell'icona in basso a destra.",
        "La barra si trascina come una barra dei titoli normale."
      ),

      h("Sotto la testata: le schede di lavoro"),
      p("Ogni cosa che apri diventa una linguetta, come su un browser. Compaiono quando ne hai almeno due: con una sola sarebbero solo una riga di pixel sprecata. Il capitolo «Le schede di lavoro» le spiega per intero."),

      h("A sinistra: la barra di navigazione"),
      p("Le sezioni sono raggruppate per mestiere: Operativita, Anagrafiche, Comunicazioni, Amministrazione, Aiuto. La mattina si guarda solo il primo gruppo. In fondo c'e il tuo nome: cliccandolo si apre il menu dell'account."),
      punti(
        "Ctrl+B comprime la barra a sole icone, quando servono righe in piu a schermo.",
        "Il numero accanto a «Notifiche» e quante non ne hai ancora lette.",
        "Ctrl+1 … Ctrl+9 saltano alle prime nove voci nell'ordine in cui le vedi."
      ),

      h("In alto: contesto, ricerca e stato"),
      punti(
        "A sinistra le briciole: gruppo e sezione in cui ti trovi, con le frecce avanti e indietro.",
        "Al centro la casella del comando rapido (Ctrl+K): da li si raggiunge tutto.",
        "Accanto, la sveglia: prende un promemoria in due secondi.",
        "A destra il menu a tendina dello stato del sistema, le notifiche, il tema e il blocco della postazione."
      ),

      h("In basso: la barra di stato"),
      p("Chi sei, a quale server sei collegato, quando i dati sono stati aggiornati l'ultima volta, la versione dell'applicazione. E la riga che serve quando qualcosa non torna: dice se stai guardando dati vecchi."),
      p("Se hai ingrandito l'interfaccia con Ctrl e il tasto piu, li compare anche a quale percentuale sei: e la risposta alla domanda «perche adesso e tutto grande?». Ctrl+0 riporta al cento per cento."),

      h("Il comando rapido"),
      p("Ctrl+K apre una sola casella per tutto: le sezioni, le azioni piu frequenti, le viste salvate della coda e la ricerca di una pratica per numero, oggetto o richiedente. Non serve che le parole siano attaccate: «coda urg» trova «Coda: solo urgenti aperte»."),
      tasti(
        ["Ctrl + K", "Apre il comando rapido"],
        ["↑ ↓", "Scorri i risultati"],
        ["Invio", "Apri quello selezionato"],
        ["Esc", "Chiudi"]
      )
    ]
  },

  /* ======================================================================= */
  {
    id: "stato-sistema",
    parte: "Per cominciare",
    titolo: "Lo stato del sistema",
    sottotitolo: "Il menu a tendina in alto: tutto sotto controllo in un posto solo",
    sezioni: [
      p("In testata, accanto alle notifiche, c'e un pulsante con un pallino colorato. Il pallino riassume lo stato peggiore fra tutti i servizi da cui dipende il tuo lavoro. Cliccandolo — o con Ctrl+Shift+S — si apre l'elenco completo."),

      h("Che cosa controlla"),
      tabella(["Gruppo", "Che cosa ti dice"], [
        ["Collegamento", "Se il server dello Studio risponde, con quanti millisecondi, e se la tua sessione e ancora valida."],
        ["Comunicazioni", "Canale email (Gmail), lettura automatica della posta, WhatsApp Business e il suo webhook, notifiche di Windows."],
        ["Lavoro", "Urgenti aperte, pratiche senza assegnatario, richieste dal modulo contatti, tempo medio di chiusura."],
        ["Sicurezza", "Blocco per inattivita, PIN rapido, cifratura della sessione sul disco."],
        ["Postazione", "Aggiornamento dell'applicazione e cartella dei dati locali."]
      ]),

      h("Come si leggono i colori"),
      tabella(["Stato", "Significato", "Che cosa fare"], [
        ["Operativo", "Il servizio risponde come deve.", "Niente."],
        ["Da controllare", "Funziona, ma qualcosa non e come dovrebbe: invii falliti, latenza alta, PIN non impostato.", "Apri la riga: c'e il pulsante che porta dove si risolve."],
        ["Non funziona", "Il servizio e fuori uso. Qualcuno in ufficio sta gia perdendo tempo per colpa sua.", "Segnalalo subito a chi tiene i sistemi, con il rapporto copiato."],
        ["Disattivato", "E spento per scelta dello Studio, non e un guasto.", "Niente, a meno che non lo si volesse acceso."],
        ["Non verificato", "Non e stato possibile controllare: permessi insufficienti o controllo non riuscito.", "Se sei dipendente e la riga riguarda email o WhatsApp, e normale: quei dati li vede il titolare."]
      ]),

      h("Il rapporto da mandare a chi assiste"),
      p("In fondo alla tendina, «Copia il rapporto» mette negli appunti un riassunto testuale di tutte le spie, con versione, utente e orario. E l'unica cosa da incollare in una email di assistenza: contiene gia tutto quello che verrebbe chiesto."),
      nota("Le spie si aggiornano da sole ogni minuto e a ogni apertura della tendina. Il pulsante ↻ forza un controllo immediato.")
    ]
  },

  /* ======================================================================= */
  {
    id: "pin",
    parte: "Sicurezza",
    titolo: "Il PIN rapido",
    sottotitolo: "Sei cifre al posto della password, solo su questo computer",
    sezioni: [
      p("Il PIN serve a una cosa sola: riprendere la postazione dopo il blocco senza ridigitare la password. Non apre sessioni nuove, non vale su altri computer e non viaggia mai in rete."),

      h("Perche esiste"),
      p("Senza PIN, un blocco a quindici minuti significa digitare una password lunga trenta volte al giorno. Finisce sempre allo stesso modo: si alza il blocco a un'ora, o si sceglie una password corta, o la si scrive su un foglietto. Il PIN toglie il motivo per fare una di queste tre cose."),

      h("Come si imposta"),
      passi(
        "L'applicazione te lo propone da sola la prima volta che il tuo account viene associato a questo computer.",
        "Se hai rimandato: Impostazioni → Sicurezza → «Imposta il PIN rapido». Oppure Ctrl+K e cerca «PIN».",
        "Scegli da 4 a 8 cifre. Sei sono l'equilibrio giusto.",
        "Ripetilo per conferma.",
        "Conferma con la password dell'account: serve a garantire che il PIN lo stia scegliendo tu e non chi ha trovato la postazione aperta."
      ),

      h("Che cosa l'applicazione rifiuta"),
      punti(
        "Cifre tutte uguali: 0000, 111111.",
        "Sequenze consecutive in salita o in discesa: 1234, 987654.",
        "I PIN piu diffusi al mondo, quelli che un ladro prova per primi."
      ),

      h("Se lo sbagli"),
      p("Hai cinque tentativi. Al quinto errore il PIN viene cancellato dalla postazione e per rientrare serve la password: da li puoi impostarne subito uno nuovo. Non c'e nessuna attesa forzata e nessun blocco a tempo — chi ha davvero sbagliato non deve restare fuori dal proprio lavoro."),

      h("Dove finisce il PIN"),
      p("Sul disco non viene mai scritto il PIN, ma solo una derivazione crittografica con sale casuale; e dove Windows lo permette anche quella e cifrata con la protezione dati del tuo profilo. Un altro account Windows sullo stesso computer non puo nemmeno provare a forzarla."),
      attenzione("Il PIN e legato al tuo account e a questo computer. Se un collega usa la stessa postazione con il proprio account, dovra sceglierne uno suo: i due non si vedono fra loro."),

      h("Come si cambia o si toglie"),
      p("Impostazioni → Sicurezza. Per cambiarlo serve di nuovo la password. Toglierlo non richiede nulla: da quel momento ogni sblocco chiedera la password completa.")
    ]
  },

  /* ======================================================================= */
  {
    id: "sicurezza",
    parte: "Sicurezza",
    titolo: "Sessione e postazione",
    sottotitolo: "Blocco per inattivita, sessione cifrata, uscita",
    sezioni: [
      h("Il blocco per inattivita"),
      p("Dopo un certo numero di minuti senza tastiera ne mouse lo schermo si oscura e per riprendere serve il PIN o la password. Lo Studio lavora su morosita e dati di condomini, in un ufficio dove entrano fornitori e amministrati: una postazione lasciata aperta e un problema concreto, non teorico."),
      punti(
        "Ctrl+L blocca subito, senza aspettare.",
        "I minuti si scelgono in Impostazioni → Sicurezza. Il valore predefinito e quindici.",
        "Il blocco non chiude la sessione: il lavoro a meta non si perde e non arriva nessun nuovo codice di verifica."
      ),

      h("La sessione sul disco"),
      p("Il token della sessione viene salvato cifrato con la protezione dati di Windows: e leggibile solo dall'account Windows che ha fatto l'accesso. Se quella protezione non e disponibile — succede su profili anomali — il token resta solo in memoria e a ogni riavvio dell'app serve un nuovo accesso. E voluto: meglio un accesso in piu che un token in chiaro su un disco."),
      p("Lo stato della cifratura si legge nella tendina dello stato del sistema, riga «Sessione cifrata sul disco»."),

      h("Uscire davvero"),
      p("«Esci dall'account» chiude la sessione anche sul server: da quel momento il token non vale piu, nemmeno se qualcuno copiasse il file. E la cosa giusta da fare quando lasci una postazione che non e la tua."),

      h("Chi ha fatto cosa"),
      p("Il Registro attivita conserva sulla postazione ogni accesso, sblocco, tentativo negato, PIN impostato e uscita. Non e sorveglianza sui colleghi: e l'unico posto dove si vede un tentativo di accesso che nessuno ha voluto fare.")
    ]
  },

  /* ======================================================================= */
  {
    id: "coda",
    parte: "Il lavoro quotidiano",
    titolo: "La coda delle segnalazioni",
    sottotitolo: "L'elenco su cui si passa la giornata",
    sezioni: [
      p("La coda e l'elenco delle pratiche aperte in ordine di lavorazione. Tutto quello che si puo fare qui si puo fare da tastiera, senza aprire la scheda: e la differenza fra smaltire trenta pratiche e smaltirne dieci."),

      h("Gli stati"),
      tabella(["Stato", "Quando si usa"], [
        ["Nuova", "Appena arrivata, nessuno l'ha ancora guardata."],
        ["Presa in carico", "Qualcuno se ne e assunto la responsabilita."],
        ["In lavorazione", "Ci si sta lavorando adesso."],
        ["In attesa", "Ferma per causa esterna: attesa di un fornitore, di un preventivo, di una delibera."],
        ["Risolta", "Il problema non c'e piu, resta da chiudere formalmente."],
        ["Chiusa", "Finita. Esce dalla coda e resta nello storico."]
      ]),

      h("Le priorita"),
      p("Bassa, Media, Alta, Urgente. L'urgente ha la precedenza su tutto il resto e compare anche nella tendina dello stato del sistema: se ce ne sono piu di tre, il pallino in testata diventa rosso."),

      h("Lavorare da tastiera"),
      tasti(
        ["J / K", "Riga successiva o precedente (anche con le frecce)"],
        ["Invio", "Apri la segnalazione selezionata"],
        ["Spazio", "Seleziona la riga, per le azioni di massa"],
        ["1 … 6", "Cambia stato senza aprire la scheda"],
        ["A", "Assegna a te"],
        ["U", "Togli l'assegnazione"],
        ["/", "Salta al campo di ricerca"],
        ["R", "Ricarica la coda"],
        ["Home / Fine", "Prima o ultima riga"]
      ),

      h("Le azioni di massa"),
      passi(
        "Seleziona le righe con Spazio (o con le caselle a sinistra).",
        "Compare in basso la barra delle azioni con quante ne hai selezionate.",
        "Scegli l'azione: cambio di stato, assegnazione, priorita.",
        "L'operazione vale su tutte le righe selezionate in un colpo solo."
      ),

      h("Le viste salvate"),
      p("Una combinazione di filtri usata spesso si puo salvare con un nome. Da quel momento la trovi nel comando rapido sotto «Viste salvate», e ci arrivi in due tasti."),
      nota("Le viste salvate restano su questa postazione. Non si vedono dal sito ne dai computer dei colleghi.")
    ]
  },

  /* ======================================================================= */
  {
    id: "segnalazione",
    parte: "Il lavoro quotidiano",
    titolo: "La scheda di una segnalazione",
    sottotitolo: "Storico, allegati, risposte",
    sezioni: [
      p("Si apre con Invio dalla coda, oppure cercando il numero della pratica nel comando rapido."),
      punti(
        "In alto: numero, oggetto, stabile, richiedente, stato e priorita.",
        "Al centro: lo storico completo, dal primo messaggio all'ultima risposta.",
        "A destra: assegnatario, categoria, date e allegati."
      ),
      h("Rispondere"),
      p("La risposta parte per lo stesso canale da cui e arrivata la segnalazione: email se e nata da una email, WhatsApp se e nata da WhatsApp. Non serve scegliere, e non c'e modo di sbagliare canale."),
      h("Allegati"),
      p("I documenti si scaricano nella cartella dei download di Windows. I file che aggiungi tu partono verso il server e restano visibili anche dall'area riservata del sito."),
      nota("Ogni cambio di stato o assegnazione finisce nello storico con il nome di chi l'ha fatto e l'ora. Nessuna modifica e anonima.")
    ]
  },

  /* ======================================================================= */
  {
    id: "anagrafiche",
    parte: "Il lavoro quotidiano",
    titolo: "Anagrafiche",
    sottotitolo: "Condomini, morosi, fornitori",
    sezioni: [
      h("Condomini"),
      p("Gli stabili amministrati, con le relative schede: referenti, unita, staff assegnato. Da qui si arriva alle segnalazioni aperte su quello stabile."),
      h("Morosi"),
      p("Le posizioni debitorie e lo stato dei solleciti. Le tre fasce — regolare, lieve, grave — si vedono a colpo d'occhio dalle pastiglie colorate."),
      attenzione("La morosita e un dato sensibile: non si legge a voce alta allo sportello e non si lascia a schermo alzandosi. Ctrl+L prima di allontanarsi."),
      h("Fornitori"),
      p("Imprese, referenti e regolarita documentale. Un DURC irregolare e segnalato in rosso: prima di affidare un intervento vale la pena guardarlo.")
    ]
  },

  /* ======================================================================= */
  {
    id: "comunicazioni",
    parte: "Il lavoro quotidiano",
    titolo: "Comunicazioni",
    sottotitolo: "WhatsApp, posta in arrivo, notifiche",
    sezioni: [
      h("WhatsApp"),
      p("Le conversazioni con condomini e fornitori. Un messaggio in arrivo puo diventare una segnalazione con un comando solo, mantenendo il filo della conversazione attaccato alla pratica."),
      p("Se il canale non e configurato con le credenziali di WhatsApp Business, la sezione resta pienamente utilizzabile passando dai link wa.me: cambia solo che l'invio non e automatico. Lo stato del canale si legge nella tendina dello stato del sistema."),

      h("Posta in arrivo"),
      p("Le email che arrivano alla casella dello Studio vengono lette automaticamente e, quando il testo lo giustifica, trasformate in segnalazioni. Qui si vede il diario del riconoscimento: che cosa e diventato pratica, che cosa e stato scartato e perche."),
      passi(
        "Apri la sezione Posta in arrivo.",
        "Le righe con esito «scartata» sono email che il riconoscimento non ha ritenuto segnalazioni.",
        "Se una e stata scartata a torto, «Apri come segnalazione» la trasforma in pratica.",
        "«Leggi adesso» forza un controllo della casella senza aspettare il giro automatico."
      ),

      h("Notifiche"),
      p("Windows annuncia le novita mentre lavori in un altro programma. Il controllo gira in sottofondo ogni pochi secondi."),
      punti(
        "Ctrl+Shift+D accende e spegne il «non disturbare».",
        "In Impostazioni si puo limitare le notifiche all'orario di lavoro: fuori orario arrivano lo stesso nell'app, ma Windows non le annuncia.",
        "Ctrl+Shift+U forza un controllo immediato."
      )
    ]
  },

  /* ======================================================================= */
  {
    id: "archivio",
    parte: "Il lavoro quotidiano",
    titolo: "Archivio della postazione",
    sottotitolo: "Schede e documenti che restano su questo computer",
    sezioni: [
      p("L'archivio e locale: schede, note e allegati che tieni su questa postazione e che non salgono sul server. Serve per il materiale di lavoro che non ha ancora una collocazione ufficiale."),
      attenzione("Essendo locale, l'archivio non e nei backup del server e non lo vedono i colleghi. Quello che deve restare va caricato sulla pratica, non lasciato qui."),
      p("La cartella fisica si apre dal menu «Dati locali» nella tendina dello stato del sistema, oppure da Impostazioni → Manutenzione.")
    ]
  },

  /* ======================================================================= */
  {
    id: "amministrazione",
    parte: "Amministrazione",
    titolo: "Studio, controllo, registro",
    sottotitolo: "Quello che vede chi ha responsabilita",
    sezioni: [
      h("Studio"),
      p("Le persone dello Studio e i loro carichi di lavoro: quante pratiche ha ciascuno, di che tipo, da quanto tempo aperte."),
      h("Controllo"),
      p("Sessioni attive, credenziali dei dipendenti, credenziali dei condomini, attivita dello staff. Da qui si revoca una sessione, si crea un accesso, si azzera una password."),
      nota("Alcune di queste schede sono riservate al titolare. Se sei dipendente le vedi vuote o assenti: non e un guasto."),
      h("Registro attivita"),
      p("Cosa e stato fatto da questa postazione: accessi, sblocchi, tentativi negati, esportazioni. Resta sul computer e si puo esportare o svuotare da Impostazioni.")
    ]
  },

  /* ======================================================================= */
  {
    id: "impostazioni",
    parte: "Amministrazione",
    titolo: "Impostazioni",
    sottotitolo: "Collegamento, sicurezza, aspetto, manutenzione",
    sezioni: [
      tabella(["Gruppo", "Che cosa contiene"], [
        ["Collegamento", "Indirizzo del server dello Studio, chiave dell'applicazione, frequenza del controllo delle novita."],
        ["Sicurezza", "PIN rapido, minuti del blocco per inattivita, stato della cifratura."],
        ["Aspetto", "Tema (come Windows, chiaro, scuro) e densita delle righe."],
        ["Notifiche", "Notifiche di Windows, non disturbare, orario di lavoro."],
        ["Manutenzione", "Diagnostica, cartella dei dati, esportazione e importazione delle impostazioni, registro attivita."]
      ]),
      h("La chiave dell'applicazione"),
      p("Quando coincide con il segreto configurato sul server, l'accesso dall'app salta il codice a sei cifre. Lasciandola vuota il codice viene chiesto come sul sito. E una configurazione da fare una volta sola, con chi tiene i sistemi."),
      h("Portare le impostazioni su un'altra postazione"),
      passi(
        "Impostazioni → Manutenzione → «Esporta impostazioni».",
        "Salva il file e portalo sull'altro computer.",
        "La, «Importa impostazioni» e scegli il file."
      ),
      attenzione("L'esportazione non contiene ne la sessione, ne il PIN, ne le password: quelli non escono da questo computer. Vengono trasferite solo le preferenze.")
    ]
  },

  /* ======================================================================= */
  {
    id: "schede",
    parte: "Il lavoro quotidiano",
    titolo: "Le schede di lavoro",
    sottotitolo: "Tenere aperte piu pratiche insieme",
    sezioni: [
      p("Una segnalazione non si lavora quasi mai da sola: si apre la pratica dell'infiltrazione, si va a vedere la scheda del condominio, si controlla il DURC dell'impresa, si torna alla pratica. Le schede servono a fare quel giro senza tornare ogni volta alla coda e cercare da capo."),

      h("Come funzionano"),
      punti(
        "Ogni cosa che apri diventa una linguetta: non esiste un comando «apri in una scheda nuova», perche ogni apertura gia lo e.",
        "Il nastro compare quando le schede sono almeno due.",
        "Se ne tengono aperte fino a dodici. Oltre, le linguette diventano illeggibili — e una scheda che non si legge non e una scheda aperta, e disordine. Quando si supera il limite si chiude la piu vecchia, mai quella su cui stai lavorando.",
        "Le pratiche aperte si ritrovano al riavvio dell'applicazione. Le sezioni no: la barra laterale le raggiunge in un clic."
      ),

      h("Fissare una linguetta"),
      p("Doppio clic su una linguetta la fissa: si sposta in testa al nastro e resta anche quando chiudi tutto il resto. Serve alla pratica che stai seguendo da giorni, quella che non vuoi ritrovarti a cercare ogni mattina."),

      tasti(
        ["Ctrl + Tab", "Scheda seguente"],
        ["Ctrl + Maiusc + Tab", "Scheda precedente"],
        ["Ctrl + W", "Chiudi la scheda su cui stai lavorando"],
        ["Tasto centrale", "Chiudi la linguetta sotto il puntatore"],
        ["Doppio clic", "Fissa o libera la linguetta"]
      ),

      nota("Una scheda conserva il posto, non lo stato della pagina: tornandoci, i dati vengono richiesti di nuovo al server. E un bene — quello che leggi e sempre fresco — ma un modulo lasciato a meta non si ritrova. Le viste con del testo in lavorazione te lo chiedono prima di lasciarti cambiare scheda.")
    ]
  },

  /* ======================================================================= */
  {
    id: "promemoria",
    parte: "Il lavoro quotidiano",
    titolo: "I promemoria",
    sottotitolo: "Ricordarsi di richiamare, senza foglietti",
    sezioni: [
      p("«Richiamare l'idraulico giovedi alle nove» non e uno stato della pratica: e un impegno di una persona, a un'ora precisa. Finche non c'era un posto dove metterlo finiva su un foglietto, e il foglietto si perde."),

      h("Come si prende"),
      punti(
        "Dalla sveglia in testata, o con Ctrl+Maiusc+R, per un promemoria qualsiasi.",
        "Dal bottone «Promemoria» dentro la scheda di una pratica: cosi l'avviso, quando suona, ti riporta dentro quella pratica con un clic.",
        "Dal comando rapido (Ctrl+K), cercando «promemoria»."
      ),
      p("Le scorciatoie — fra un'ora, stasera, domani mattina, lunedi prossimo — coprono quasi tutti i casi; la data per esteso resta li sotto per gli altri."),

      h("Quando suona"),
      punti(
        "Arriva una notifica di Windows, anche a finestra chiusa: l'applicazione resta nell'area di notifica proprio per questo.",
        "Cliccando l'avviso si apre la pratica collegata, se ce n'e una.",
        "Un promemoria scaduto mentre l'applicazione era chiusa suona alla riapertura, una volta sola.",
        "Dalla sezione Promemoria si rinvia di dieci minuti o a domani, si segna come fatto, si elimina."
      ),

      nota("I promemoria restano su questo computer e avvisano solo qui: sono un impegno tuo, non dello Studio. Quello che devono vedere anche i colleghi va scritto come nota interna sulla pratica, che sta sul server.")
    ]
  },

  /* ======================================================================= */
  {
    id: "copie",
    parte: "Amministrazione",
    titolo: "Copie di sicurezza",
    sottotitolo: "I dati che esistono solo qui",
    sezioni: [
      p("Quasi tutto quello che vedi arriva dal server dello Studio, ed e al sicuro li. Una parte pero no: le schede di dettaglio di condominio e di condomino, i file che ci sono attaccati, i promemoria, il registro della postazione e le viste salvate della coda stanno solo su questo computer. Se il disco si rompe, quella roba non torna da nessuna parte."),

      h("Che cosa fa l'applicazione da sola"),
      punti(
        "Una copia al giorno, alla prima apertura utile. Non a orario fisso: un'app di uno Studio non e accesa alle tre di notte, e una copia programmata che non parte mai e una copia che non esiste.",
        "Tiene le ultime dieci e butta le piu vecchie. Il numero si cambia in Impostazioni."
      ),

      h("Che cosa conviene fare a mano"),
      p("Una volta ogni tanto, «Salva una copia altrove…» su una chiavetta o su una cartella di rete. Una copia che sta sullo stesso disco dei dati protegge da un errore, non da un guasto."),

      h("Com'e fatta una copia"),
      p("Una cartella normale, non un archivio compresso: si apre con Esplora file, si legge con il Blocco note, si copia a mano. Un formato che richiede questo programma per essere riletto sarebbe esattamente il formato sbagliato per una copia di sicurezza."),

      h("Ripristinare"),
      passi(
        "Impostazioni → Copie di sicurezza, scegli la copia e premi «Ripristina».",
        "L'applicazione mette da parte lo stato attuale in una copia di riserva: un ripristino sbagliato resta annullabile.",
        "Rimette al loro posto schede, allegati, promemoria e registro, e si riavvia."
      ),

      nota("Nelle copie non finiscono mai la sessione, il PIN e la chiave dell'applicazione: sono legati a questo profilo di Windows, e una copia e fatta per essere portata altrove. Dopo un ripristino su un altro computer si rientra con email e password, come la prima volta.")
    ]
  },

  /* ======================================================================= */
  {
    id: "aggiornamenti",
    parte: "Amministrazione",
    titolo: "Aggiornamenti",
    sottotitolo: "La versione nuova arriva da sola",
    sezioni: [
      p("L'applicazione controlla da sola se c'e una versione nuova, la scarica in sottofondo e la installa alla chiusura. Chi non tocca niente se la ritrova installata la mattina dopo."),

      h("Da dove arriva una versione nuova"),
      p("Ogni pubblicazione sul repository dello Studio fa partire un flusso che alza il numero di versione, compila l'installer per Windows e lo mette fra le Release. Da li lo prende l'applicazione installata su ogni postazione. Non c'e niente da configurare e nessuna chiavetta da girare per l'ufficio."),
      punti(
        "Controllo all'avvio e poi una volta all'ora.",
        "Durante lo scaricamento compare una striscia in alto con la percentuale.",
        "Quando e pronta, la stessa striscia offre «Riavvia e aggiorna adesso» — da usare quando fa comodo, non subito.",
        "Nessun aggiornamento parte di sorpresa mentre stai scrivendo a un condomino: il riavvio avviene su richiesta o alla chiusura."
      ),

      h("Impostazioni → Aggiornamenti"),
      p("Il quadro completo, per chi non vuole aspettare l'ora tonda: che versione hai, che versione c'e, da quale repository arrivano, quando e stato l'ultimo controllo, a che punto e lo scaricamento."),
      punti(
        "«Controlla adesso» forza il controllo.",
        "«Scarica la versione …» compare quando c'e qualcosa da scaricare e lo scaricamento automatico e spento.",
        "«Riavvia e installa adesso» quando la versione e pronta.",
        "«Vedi le versioni su GitHub» apre l'elenco delle Release con le note di ogni versione.",
        "La casella «Scarica da sola le versioni nuove» si spegne dove la linea e lenta o a consumo: l'app avvisa e aspetta il tuo via."
      ),
      p("Lo stato si legge anche nella tendina dello stato del sistema, riga «Aggiornamento applicazione»."),

      nota("Avviata da sorgente con npm start l'aggiornamento automatico resta spento: non c'e un pacchetto installato da sostituire. Il riquadro lo dice invece di restare in silenzio.")
    ]
  },

  /* ======================================================================= */
  {
    id: "scorciatoie",
    parte: "Riferimento",
    titolo: "Scorciatoie da tastiera",
    sottotitolo: "L'elenco completo, per famiglie",
    sezioni: [
      p("Tre famiglie: le combinazioni con Ctrl sono comandi; «G poi lettera» sono spostamenti e si leggono «vai a»; i tasti singoli agiscono sulla riga selezionata dentro gli elenchi."),
      { t: "scorciatoie-vive" },
      nota("Ctrl+/ apre questo stesso elenco in una finestra, da qualunque punto dell'applicazione, con una casella di ricerca.")
    ]
  },

  /* ======================================================================= */
  {
    id: "problemi",
    parte: "Riferimento",
    titolo: "Quando qualcosa non va",
    sottotitolo: "I sintomi piu frequenti e cosa controllare",
    sezioni: [
      tabella(["Sintomo", "Cosa controllare"], [
        ["«Server non raggiungibile»", "La spia in testata e rossa. Controlla la connessione dell'ufficio; poi la tendina dello stato del sistema, riga «Server dello Studio». Se risponde ma lento, e la linea."],
        ["«La sessione e scaduta»", "Normale dopo molti giorni o se la sessione e stata revocata dal Controllo. Basta rientrare con email e password."],
        ["Il PIN non viene accettato", "Dopo cinque errori si disattiva da solo: entra con la password e impostane uno nuovo da Impostazioni → Sicurezza."],
        ["I dati sembrano vecchi", "Guarda la barra di stato in basso: dice quando sono stati aggiornati. F5 ricarica la sezione."],
        ["Le notifiche di Windows non arrivano", "Tendina dello stato → «Notifiche di Windows». Puo essere il «non disturbare», l'orario di lavoro, o l'impostazione spenta."],
        ["Le email non partono", "Tendina dello stato → «Invio email». Se dice «credenziali rifiutate» il problema e sul server e va segnalato a chi tiene i sistemi."],
        ["I messaggi WhatsApp non arrivano", "Tendina dello stato → «Webhook WhatsApp in entrata». Se non e attivo, i messaggi dei condomini non entrano affatto."],
        ["L'app non si aggiorna", "Tendina dello stato → «Aggiornamento applicazione», poi «Controlla adesso»."]
      ]),
      h("Prima di chiedere assistenza"),
      passi(
        "Apri la tendina dello stato del sistema (Ctrl+Shift+S).",
        "Premi «Copia il rapporto».",
        "Incollalo nella email o nel messaggio: contiene versione, utente, orario e lo stato di ogni servizio.",
        "Aggiungi una riga su cosa stavi facendo quando e successo."
      ),
      nota("Impostazioni → Manutenzione → Diagnostica mostra le stesse informazioni in forma estesa, con la latenza misurata e i percorsi dei file locali.")
    ]
  },

  /* ======================================================================= */
  {
    id: "domande",
    parte: "Riferimento",
    titolo: "Domande frequenti",
    sottotitolo: "Le cinque che vengono chieste sempre",
    sezioni: [
      h("Se chiudo l'applicazione perdo il lavoro?"),
      p("No. La sessione resta aperta e le pratiche stanno sul server, non su questo computer. Riaprendo ti ritrovi dove eri."),

      h("Il PIN e la password sono la stessa cosa?"),
      p("No. La password apre il tuo account ovunque, anche sul sito. Il PIN riapre solo questa postazione bloccata, solo per te, e non esce da questo computer."),

      h("Perche vedo meno sezioni di un collega?"),
      p("Alcune schede — credenziali, stato del canale email, attivita aggregata dello staff — sono riservate al ruolo di titolare. Non e un guasto e non serve segnalarlo."),

      h("Posso usare l'app da casa?"),
      p("Si, se il computer raggiunge il server dello Studio. Serve pero un nuovo accesso: la sessione e il PIN valgono solo sulla postazione dove sono stati creati."),

      h("Quello che faccio qui si vede sul sito?"),
      p("Si, subito. App e area riservata lavorano sugli stessi dati. L'unica eccezione sono l'archivio locale, le viste salvate e le preferenze, che restano su questa postazione.")
    ]
  }
];

/* --- Da quale sezione dell'app si arriva a quale capitolo ------------------
 * Shift+F1 apre la guida gia aperta al punto giusto. Una guida che si apre
 * sempre dall'indice costringe a cercare due volte.
 * ------------------------------------------------------------------------ */

const DA_SEZIONE = {
  panoramica: "finestra",
  coda: "coda",
  ticket: "segnalazione",
  archivio: "archivio",
  condomini: "anagrafiche",
  morosi: "anagrafiche",
  fornitori: "anagrafiche",
  whatsapp: "comunicazioni",
  posta: "comunicazioni",
  notifiche: "comunicazioni",
  studio: "amministrazione",
  controllo: "amministrazione",
  registro: "amministrazione",
  impostazioni: "impostazioni",
  promemoria: "promemoria",
  guida: "primi-passi"
};

export function capitoloPerSezione(idSezione) {
  return DA_SEZIONE[idSezione] || "primi-passi";
}

/* =============================================================================
 * Resa dei blocchi
 * ========================================================================== */

function rendiBlocco(blocco) {
  switch (blocco.t) {
    case "h":
      return el("h3", { class: "guida-titoletto", text: blocco.testo });

    case "p":
      return el("p", { class: "guida-testo", text: blocco.testo });

    case "punti":
      return el("ul", { class: "guida-punti" }, blocco.voci.map((v) => el("li", { text: v })));

    case "passi":
      return el("ol", { class: "guida-passi" }, blocco.voci.map((v) => el("li", { text: v })));

    case "nota":
      return el("div", { class: "guida-nota" }, [
        el("span", { class: "guida-segno", text: "i" }),
        el("p", { text: blocco.testo })
      ]);

    case "attenzione":
      return el("div", { class: "guida-nota guida-attenzione" }, [
        el("span", { class: "guida-segno", text: "!" }),
        el("p", { text: blocco.testo })
      ]);

    case "tabella":
      return el("div", { class: "tabella-wrap" }, [
        el("table", { class: "tabella guida-tabella" }, [
          el("thead", {}, [el("tr", {}, blocco.intestazioni.map((i) => el("th", { text: i })))]),
          el("tbody", {}, blocco.righe.map((riga) => el("tr", {}, riga.map((cella) => el("td", { text: cella })))))
        ])
      ]);

    case "tasti":
      return el("div", { class: "scorciatoie" }, blocco.voci.map(([tasto, descrizione]) =>
        el("div", { class: "riga-tasto" }, [
          el("kbd", { text: tasto }),
          el("span", { class: "sotto", text: descrizione })
        ])));

    // Il capitolo delle scorciatoie non ha testo proprio: legge la stessa
    // tabella che governa i tasti veri, cosi non puo raccontarne di diversi.
    case "scorciatoie-vive":
      return el("div", {}, [
        ...raggruppa(SCORCIATOIE.map((s) => [s.gruppo, s.tasti, s.descrizione + (s.nota ? ` — ${s.nota}` : "")])),
        el("h3", { class: "guida-titoletto", text: "Vai a (premi G, poi la lettera)" }),
        el("div", { class: "scorciatoie" }, VAI_A.map(([tasto, , nome]) =>
          el("div", { class: "riga-tasto" }, [
            el("kbd", { text: `G  ${tasto.toUpperCase()}` }),
            el("span", { class: "sotto", text: nome })
          ]))),
        ...SCORCIATOIE_VISTA.flatMap(([gruppo, voci]) => [
          el("h3", { class: "guida-titoletto", text: gruppo }),
          el("div", { class: "scorciatoie" }, voci.map(([tasto, descrizione]) =>
            el("div", { class: "riga-tasto" }, [
              el("kbd", { text: tasto }),
              el("span", { class: "sotto", text: descrizione })
            ])))
        ])
      ]);

    default:
      return null;
  }
}

function raggruppa(triple) {
  const nodi = [];
  for (const gruppo of [...new Set(triple.map(([g]) => g))]) {
    nodi.push(
      el("h3", { class: "guida-titoletto", text: gruppo }),
      el("div", { class: "scorciatoie" }, triple.filter(([g]) => g === gruppo).map(([, tasto, descrizione]) =>
        el("div", { class: "riga-tasto" }, [
          el("kbd", { text: tasto }),
          el("span", { class: "sotto", text: descrizione })
        ])))
    );
  }
  return nodi;
}

/* --- Testo piatto di un capitolo, per la ricerca e l'esportazione --------- */

function testoDi(capitolo) {
  const pezzi = [capitolo.titolo, capitolo.sottotitolo];
  for (const blocco of capitolo.sezioni) {
    if (blocco.testo) pezzi.push(blocco.testo);
    if (blocco.voci) pezzi.push(blocco.voci.map((v) => (Array.isArray(v) ? v.join(" ") : v)).join(" "));
    if (blocco.righe) pezzi.push(blocco.intestazioni.join(" "), blocco.righe.map((r) => r.join(" ")).join(" "));
  }
  return pezzi.join("\n");
}

const INDICE_TESTO = CAPITOLI.map((c) => ({ id: c.id, testo: testoDi(c).toLowerCase() }));

/* =============================================================================
 * La vista
 * ========================================================================== */

export default function monta(radice, ctx) {
  let apertoSu = ctx.parametro && CAPITOLI.some((c) => c.id === ctx.parametro)
    ? ctx.parametro
    : CAPITOLI[0].id;

  const indice = el("nav", { class: "guida-indice" });
  const lettura = el("article", { class: "guida-lettura" });
  const ricerca = el("input", {
    class: "campo", type: "search", placeholder: "Cerca nella guida…",
    "aria-label": "Cerca nella guida"
  });

  let filtro = "";

  /* --- Indice ------------------------------------------------------------- */

  function capitoliVisibili() {
    const q = filtro.trim().toLowerCase();
    if (!q) return CAPITOLI;
    const trovati = new Set(INDICE_TESTO.filter((v) => v.testo.includes(q)).map((v) => v.id));
    return CAPITOLI.filter((c) => trovati.has(c.id));
  }

  function disegnaIndice() {
    const visibili = capitoliVisibili();
    svuota(indice);

    if (!visibili.length) {
      indice.append(el("p", { class: "vuoto-sotto", text: "Nessun capitolo con queste parole." }));
      return;
    }

    for (const parte of [...new Set(visibili.map((c) => c.parte))]) {
      indice.append(el("div", { class: "gruppo-titolo", text: parte }));
      for (const capitolo of visibili.filter((c) => c.parte === parte)) {
        indice.append(el("button", {
          class: `guida-voce ${capitolo.id === apertoSu ? "attiva" : ""}`,
          onclick: () => apri(capitolo.id)
        }, [
          el("span", { text: capitolo.titolo }),
          el("span", { class: "sotto", text: capitolo.sottotitolo })
        ]));
      }
    }
  }

  /* --- Capitolo ----------------------------------------------------------- */

  function disegnaCapitolo() {
    const capitolo = CAPITOLI.find((c) => c.id === apertoSu) || CAPITOLI[0];
    const posizione = CAPITOLI.indexOf(capitolo);

    svuota(lettura).append(
      el("header", { class: "guida-testa" }, [
        el("span", { class: "guida-parte", text: capitolo.parte }),
        el("h2", { text: capitolo.titolo }),
        el("p", { class: "sotto", text: capitolo.sottotitolo })
      ]),
      el("div", { class: "guida-corpo" }, capitolo.sezioni.map(rendiBlocco)),
      el("footer", { class: "guida-piede" }, [
        posizione > 0
          ? el("button", { class: "bottone", text: `← ${CAPITOLI[posizione - 1].titolo}`, onclick: () => apri(CAPITOLI[posizione - 1].id) })
          : el("span", {}),
        el("span", { class: "spazio" }),
        posizione < CAPITOLI.length - 1
          ? el("button", { class: "bottone", text: `${CAPITOLI[posizione + 1].titolo} →`, onclick: () => apri(CAPITOLI[posizione + 1].id) })
          : null
      ])
    );

    lettura.scrollTop = 0;
  }

  function apri(id) {
    apertoSu = id;
    disegnaIndice();
    disegnaCapitolo();
  }

  /* --- Esportazione -------------------------------------------------------- */

  async function esporta() {
    const righe = [
      `GUIDA DI WIN STUDIO ADMIN ${ctx.versione}`,
      `${NOME_STUDIO}`,
      `Generata il ${new Date().toLocaleString("it-IT")}`,
      "", "=".repeat(78), ""
    ];
    for (const capitolo of CAPITOLI) {
      righe.push(`${capitolo.parte.toUpperCase()} — ${capitolo.titolo}`, capitolo.sottotitolo, "-".repeat(78), "");
      for (const blocco of capitolo.sezioni) {
        if (blocco.t === "h") righe.push("", `## ${blocco.testo}`, "");
        else if (blocco.t === "p") righe.push(blocco.testo, "");
        else if (blocco.t === "punti") righe.push(...blocco.voci.map((v) => `  · ${v}`), "");
        else if (blocco.t === "passi") righe.push(...blocco.voci.map((v, i) => `  ${i + 1}. ${v}`), "");
        else if (blocco.t === "nota") righe.push(`  [nota] ${blocco.testo}`, "");
        else if (blocco.t === "attenzione") righe.push(`  [ATTENZIONE] ${blocco.testo}`, "");
        else if (blocco.t === "tasti") righe.push(...blocco.voci.map(([k, d]) => `  ${k.padEnd(18)} ${d}`), "");
        else if (blocco.t === "tabella") {
          righe.push(`  ${blocco.intestazioni.join(" | ")}`);
          righe.push(...blocco.righe.map((r) => `  ${r.join(" | ")}`), "");
        } else if (blocco.t === "scorciatoie-vive") {
          righe.push(...SCORCIATOIE.map((s) => `  ${String(s.tasti).padEnd(18)} ${s.descrizione}`));
          righe.push(...VAI_A.map(([t, , n]) => `  ${`G ${t.toUpperCase()}`.padEnd(18)} ${n}`), "");
        }
      }
      righe.push("");
    }

    const esito = await window.studio.salvaTesto("guida-win-studio-admin.txt", righe.join("\n"), "Salva la guida");
    if (esito.ok && esito.dati) toast("Guida salvata.", "ok");
  }

  /* --- Comandi accanto al titolo di pagina --------------------------------- */

  const comandi = el("div", { class: "toolbar" }, [
    ricerca,
    el("button", { class: "bottone", text: "⌨ Scorciatoie", title: "Ctrl + /", onclick: mostraScorciatoie }),
    el("button", { class: "bottone", text: "⬇ Esporta in testo", onclick: esporta })
  ]);
  ctx.azioniPagina.appendChild(comandi);

  ricerca.addEventListener("input", () => {
    filtro = ricerca.value;
    disegnaIndice();
    // Se il capitolo aperto e sparito dai risultati, si apre il primo che c'e:
    // restare su un capitolo non piu in elenco sembrerebbe un errore.
    const visibili = capitoliVisibili();
    if (visibili.length && !visibili.some((c) => c.id === apertoSu)) apri(visibili[0].id);
  });

  radice.append(el("div", { class: "guida" }, [indice, lettura]));

  disegnaIndice();
  disegnaCapitolo();
  ricerca.focus();

  return () => { comandi.remove(); };
}
