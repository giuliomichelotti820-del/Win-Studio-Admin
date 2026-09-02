/* =============================================================================
 * Processo principale
 *
 * Tiene la finestra, la sessione, la rete e le notifiche di sistema. Il
 * renderer non parla mai direttamente con il server: chiede qui, tramite IPC,
 * e riceve solo dati gia pronti. Cosi il token di sessione non entra mai nella
 * pagina.
 * ========================================================================== */

const path = require("node:path");
const fs = require("node:fs");
const {
  app, BrowserWindow, ipcMain, Notification, Tray, Menu, shell, dialog, nativeImage, globalShortcut
} = require("electron");

const store = require("./store");
const api = require("./api");
const archivio = require("./archivio");
const aggiornamenti = require("./aggiornamenti");
const registro = require("./registro");
const pin = require("./pin");
const promemoria = require("./promemoria");
const copie = require("./copie");
const stampa = require("./stampa");

let finestra = null;
let tray = null;
let uscitaRichiesta = false;
let timerNotifiche = null;

// La notifica piu recente gia vista, come istante. Non e "adesso": e un valore
// che viene dai dati del server, e va confrontato solo con altri valori che
// vengono dal server. Misurarlo con l'orologio del computer — come faceva la
// versione precedente — significa che una postazione avanti di due minuti non
// annuncia piu niente, e una indietro riannuncia tutto a ogni giro.
let ultimaNotificaVista = 0;

const SVILUPPO = process.argv.includes("--dev");

// Una sola istanza: il secondo avvio riporta in primo piano quella aperta
// invece di aprire una seconda finestra con la stessa sessione.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Il secondo avvio porta in primo piano quello aperto — e, se e stato
  // lanciato da un collegamento `winstudio://`, ci porta anche dove dice il
  // collegamento. Su Windows l'indirizzo arriva negli argomenti della seconda
  // istanza, non da un evento: e li che va cercato.
  app.on("second-instance", (_evento, argomenti) => {
    mostraFinestra();
    apriCollegamento(argomenti);
  });
}

/* --- Collegamenti winstudio:// -------------------------------------------
 * Le email di servizio dello Studio possono portare un link diretto alla
 * pratica: `winstudio://pratica/1204` la apre dentro l'app invece di
 * costringere a cercarla nella coda. L'indirizzo lo registra l'installer
 * (build/installer.nsh); qui si traduce in una destinazione della navigazione.
 *
 * Si accettano solo le forme conosciute: un indirizzo storto non deve poter
 * pilotare l'app in un posto qualsiasi.
 * ------------------------------------------------------------------------ */

const DESTINAZIONI_COLLEGAMENTO = {
  pratica: (valore) => (/^\d+$/.test(valore) ? `ticket:${valore}` : null),
  ticket: (valore) => (/^\d+$/.test(valore) ? `ticket:${valore}` : null),
  sezione: (valore) => (/^[a-z]{3,20}$/.test(valore) ? valore : null)
};

function destinazioneDaUrl(url) {
  try {
    const indirizzo = new URL(url);
    if (indirizzo.protocol !== "winstudio:") return null;
    const cosa = (indirizzo.hostname || "").toLowerCase();
    const valore = decodeURIComponent(indirizzo.pathname.replace(/^\/+/, ""));
    const traduci = DESTINAZIONI_COLLEGAMENTO[cosa];
    return traduci ? traduci(valore) : null;
  } catch {
    return null;
  }
}

function apriCollegamento(argomenti = process.argv) {
  const url = [].concat(argomenti).find((a) => typeof a === "string" && a.startsWith("winstudio://"));
  if (!url) return false;
  const destinazione = destinazioneDaUrl(url);
  if (!destinazione) return false;
  vaiA(destinazione);
  return true;
}

/* --- Finestra ------------------------------------------------------------ */

function creaFinestra() {
  const impostazioni = store.getImpostazioni();
  const geometria = impostazioni.finestra || {};

  finestra = new BrowserWindow({
    width: geometria.width || 1440,
    height: geometria.height || 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: impostazioni.tema === "chiaro" ? "#EEF1F6" : "#090D14",
    autoHideMenuBar: true,
    title: "Win Studio Admin",
    icon: path.join(__dirname, "..", "..", "build", "icon.ico"),

    // Cornice dello Studio al posto di quella di Windows: la barra dei titoli
    // dell'app dice a quale server si e collegati, cosa che quella di sistema
    // non puo dire, e recupera i 32 pixel di altezza che in un elenco denso
    // valgono due righe di pratiche. I comandi finestra restano quelli veri
    // (`titleBarOverlay` non serve: li disegniamo noi e li colleghiamo per IPC).
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  });

  finestra.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  finestra.once("ready-to-show", () => {
    if (geometria.maximized) finestra.maximize();
    // Avviata da Windows all'accesso (installer.nsh passa --avvio-automatico)
    // l'app parte nell'area di notifica: nessuno vuole una finestra a tutto
    // schermo davanti al desktop appena acceso il computer.
    const daAvvioAutomatico = process.argv.includes("--avvio-automatico");
    if (!impostazioni.avvioMinimizzato && !daAvvioAutomatico) finestra.show();
    if (SVILUPPO) finestra.webContents.openDevTools({ mode: "detach" });
  });

  // La chiusura manda in area di notifica: il flusso di lavoro tipico e tenere
  // l'app aperta tutto il giorno e riaprirla in un istante.
  finestra.on("close", (evento) => {
    if (uscitaRichiesta) return;
    evento.preventDefault();
    salvaGeometria();
    finestra.hide();
  });

  finestra.on("resize", salvaGeometria);
  finestra.on("move", salvaGeometria);

  // La barra dei titoli disegna il bottone "ingrandisci" o "ripristina" a
  // seconda dello stato: senza questi due eventi resterebbe quello sbagliato
  // dopo un doppio clic sulla barra o uno Snap di Windows.
  finestra.on("maximize", () => invia("app:finestra", { massimizzata: true }));
  finestra.on("unmaximize", () => invia("app:finestra", { massimizzata: false }));

  // Ingrandimento dell'interfaccia: chi lavora su un 27 pollici a 4K la vuole
  // piu grande, chi sta su un portatile la vuole piu fitta. Si applica appena
  // la pagina e pronta, altrimenti il primo disegno parte alla scala sbagliata.
  finestra.webContents.on("did-finish-load", () => {
    finestra.webContents.setZoomFactor(zoomValido(store.getImpostazioni().zoom));
  });

  // Ogni link esterno va nel browser di sistema, mai dentro l'app.
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

let timerGeometria = null;
function salvaGeometria() {
  if (!finestra || finestra.isDestroyed()) return;
  clearTimeout(timerGeometria);
  timerGeometria = setTimeout(() => {
    if (!finestra || finestra.isDestroyed()) return;
    const massimizzata = finestra.isMaximized();
    const bounds = massimizzata ? finestra.getNormalBounds() : finestra.getBounds();
    store.setImpostazioni({ finestra: { width: bounds.width, height: bounds.height, maximized: massimizzata } });
  }, 400);
}

/* --- Ingrandimento dell'interfaccia --------------------------------------
 * Sei passi, dal 75% al 175%. Non e un cursore continuo di proposito: fra un
 * gradino e l'altro si vede la differenza, e chi preme Ctrl+= tre volte deve
 * arrivare dove voleva, non a un valore a caso.
 * ---------------------------------------------------------------------- */

const SCALE = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75];

function zoomValido(valore) {
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return 1;
  return Math.min(SCALE[SCALE.length - 1], Math.max(SCALE[0], numero));
}

function cambiaZoom(passo) {
  if (!finestra || finestra.isDestroyed()) return 1;
  const attuale = zoomValido(store.getImpostazioni().zoom);
  let prossimo;
  if (passo === 0) {
    prossimo = 1;
  } else {
    // L'indice piu vicino allo zoom corrente: dopo un Ctrl+rotellina il valore
    // puo non stare esattamente su un gradino.
    let vicino = 0;
    for (let i = 1; i < SCALE.length; i += 1) {
      if (Math.abs(SCALE[i] - attuale) < Math.abs(SCALE[vicino] - attuale)) vicino = i;
    }
    prossimo = SCALE[Math.min(SCALE.length - 1, Math.max(0, vicino + passo))];
  }
  finestra.webContents.setZoomFactor(prossimo);
  store.setImpostazioni({ zoom: prossimo });
  return prossimo;
}

function mostraFinestra() {
  if (!finestra || finestra.isDestroyed()) {
    creaFinestra();
    return;
  }
  if (!finestra.isVisible()) finestra.show();
  if (finestra.isMinimized()) finestra.restore();
  finestra.focus();
}

/* --- Area di notifica ---------------------------------------------------- */

function iconaTray() {
  // Il marchio dello Studio, non un pallino generico: in un'area di notifica
  // con quindici icone si riconosce quella giusta dalla forma, non dal colore.
  const file = path.join(__dirname, "..", "..", "build", "tray.png");
  const immagine = nativeImage.createFromPath(file);
  if (!immagine.isEmpty()) return immagine.resize({ width: 16, height: 16, quality: "best" });

  // Se il file manca (albero incompleto) meglio un quadrato chiaro che
  // un'icona vuota, che su Windows diventa un buco nella barra.
  const lato = 16;
  const buffer = Buffer.alloc(lato * lato * 4);
  for (let i = 0; i < lato * lato; i += 1) {
    buffer[i * 4] = 0x3d; buffer[i * 4 + 1] = 0x84; buffer[i * 4 + 2] = 0xe8; buffer[i * 4 + 3] = 0xff;
  }
  return nativeImage.createFromBuffer(buffer, { width: lato, height: lato });
}

function creaTray() {
  tray = new Tray(iconaTray());
  tray.setToolTip("Win Studio Admin");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Apri", click: mostraFinestra },
    { label: "Coda segnalazioni", click: () => vaiA("coda") },
    { label: "Nuove notifiche", click: () => vaiA("notifiche") },
    { label: "Promemoria", click: () => vaiA("promemoria") },
    { type: "separator" },
    { label: "Controlla aggiornamenti", click: () => aggiornamenti.controlla() },
    { label: "Fai subito una copia di sicurezza", click: () => {
      try {
        const fatta = copie.crea({ motivo: "manuale", versione: app.getVersion() });
        copie.pota(store.getImpostazioni().copieDaTenere || 10);
        annota("copia-creata", { percorso: fatta.percorso });
        invia("app:copia", fatta);
      } catch (errore) {
        console.error("Copia non riuscita:", errore.message);
      }
    } },
    { type: "separator" },
    { label: "Esci", click: () => { uscitaRichiesta = true; app.quit(); } }
  ]));
  tray.on("click", mostraFinestra);
}

function vaiA(vista) {
  mostraFinestra();
  invia("app:naviga", vista);
}

function invia(canale, dati) {
  if (finestra && !finestra.isDestroyed()) finestra.webContents.send(canale, dati);
}

/* --- Registro locale ----------------------------------------------------- */

// Ogni annotazione porta con se chi era collegato: il registro deve dire *chi*
// ha fatto cosa da questa postazione, non solo cosa e successo.
function annota(azione, dettagli = {}) {
  if (!store.getImpostazioni().registroAttivo) return false;
  const utente = store.getSessione().user;
  return registro.annota({
    azione,
    utente: utente ? { id: utente.id, nome: utente.fullName, email: utente.email } : null,
    ...dettagli
  });
}

/* --- Silenzio delle notifiche -------------------------------------------- */

function minutiDelGiorno(orario) {
  const [ore, minuti] = String(orario || "").split(":").map(Number);
  if (!Number.isFinite(ore) || !Number.isFinite(minuti)) return null;
  return ore * 60 + minuti;
}

/**
 * Vero quando le notifiche di Windows devono restare ferme: interruttore
 * "non disturbare" acceso a mano, oppure siamo fuori dall'orario di lavoro
 * dichiarato nelle impostazioni.
 *
 * L'app continua comunque a scaricare le notifiche: si vede il pallino nella
 * barra laterale, non salta su il riquadro di Windows.
 */
function silenzioAttivo(adesso = new Date()) {
  const impostazioni = store.getImpostazioni();
  if (impostazioni.nonDisturbare) return true;

  const orario = impostazioni.orarioLavoro || {};
  if (!orario.attivo) return false;

  const giorno = adesso.getDay();
  if (orario.feriali && (giorno === 0 || giorno === 6)) return true;

  const inizio = minutiDelGiorno(orario.inizio);
  const fine = minutiDelGiorno(orario.fine);
  if (inizio === null || fine === null) return false;

  const ora = adesso.getHours() * 60 + adesso.getMinutes();
  // Turno che scavalca la mezzanotte: fuori orario e la fascia *interna*.
  return fine <= inizio ? (ora >= fine && ora < inizio) : (ora < inizio || ora >= fine);
}

/* --- Notifiche di sistema ------------------------------------------------ */

/**
 * Le date del Worker arrivano da SQLite in UTC, quasi sempre come
 * "2026-03-04 09:12:33" — senza la T e senza la Z. Attaccare una "Z" a occhi
 * chiusi funziona per quella forma e rompe le altre: su un valore che gia
 * finisce per Z (o che porta un fuso esplicito) si ottiene "…ZZ", cioe NaN, e
 * una notifica con la data illeggibile non veniva mai annunciata.
 */
function istante(valore) {
  if (!valore) return 0;
  const testo = String(valore).trim();
  const iso = testo.includes("T") ? testo : testo.replace(" ", "T");
  const conFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const quando = new Date(conFuso).getTime();
  return Number.isNaN(quando) ? 0 : quando;
}

async function controllaNotifiche() {
  const sessione = store.getSessione();
  if (!sessione.token) return;

  try {
    const elenco = await api.richiesta("GET", "/api/notifications");
    if (!Array.isArray(elenco)) return;

    const nonLette = elenco.filter((n) => !n.read);
    invia("app:notifiche", { elenco, nonLette: nonLette.length });

    if (tray) {
      tray.setToolTip(nonLette.length ? `Win Studio Admin — ${nonLette.length} da leggere` : "Win Studio Admin");
    }

    if (!store.getImpostazioni().notificheDesktop || !Notification.isSupported()) return;
    if (silenzioAttivo()) return;

    // Solo cio che e arrivato dopo l'ultimo controllo: riaprire l'app non deve
    // far ripiovere sul desktop notifiche gia viste. Il confine e la notifica
    // piu recente che abbiamo gia visto, non l'ora del computer.
    const piuRecente = elenco.reduce((massimo, n) => Math.max(massimo, istante(n.created_at)), 0);

    // Primo giro dopo l'avvio: si prende nota di dove siamo e non si annuncia
    // niente. Quello che e arrivato mentre l'app era chiusa si legge nella
    // sezione Notifiche, non salta su dal desktop tutto insieme.
    if (ultimaNotificaVista === 0) {
      ultimaNotificaVista = piuRecente;
      return;
    }

    const nuove = nonLette.filter((n) => istante(n.created_at) > ultimaNotificaVista);
    ultimaNotificaVista = Math.max(ultimaNotificaVista, piuRecente);

    for (const notifica of nuove.slice(0, 4)) {
      const avviso = new Notification({ title: notifica.title || "Win Studio Admin", body: notifica.message || "" });
      avviso.on("click", () => {
        if (notifica.ticket_id) vaiA(`ticket:${notifica.ticket_id}`);
        else vaiA("notifiche");
      });
      avviso.show();
    }
  } catch (errore) {
    if (errore.status === 401) sessioneCaduta();
  }
}

function avviaPolling() {
  clearInterval(timerNotifiche);
  const secondi = Math.max(15, Number(store.getImpostazioni().pollSeconds) || 45);
  timerNotifiche = setInterval(controllaNotifiche, secondi * 1000);
  controllaNotifiche();
}

/* --- IPC ----------------------------------------------------------------- */

/**
 * Sessione caduta: si chiude qui, una volta sola, da qualunque strada arrivi
 * il 401 — il controllo delle notifiche, una richiesta della pagina, uno
 * scaricamento. Prima lo riconosceva solo il polling: un allegato scaricato
 * con il token scaduto rispondeva «Scaricamento non riuscito (401)» e l'app
 * restava li a fingere di essere collegata fino al giro successivo.
 */
function sessioneCaduta() {
  store.salvaSessione(null, null);
  clearInterval(timerNotifiche);
  timerNotifiche = null;
  ultimaNotificaVista = 0;
  if (tray) tray.setToolTip("Win Studio Admin");
  invia("app:sessione-scaduta");
}

function risultato(promessa) {
  return promessa.then(
    (dati) => ({ ok: true, dati }),
    (errore) => ({ ok: false, errore: errore.message || "Errore imprevisto.", stato: errore.status || 0 })
  );
}

/**
 * Come `risultato`, ma per le chiamate che viaggiano con il token di sessione:
 * li un 401 significa che il token non vale piu, e va trattato come tale.
 *
 * Non vale per tutto, e la distinzione conta: sbloccare la postazione e
 * impostare il PIN verificano la password ricontattando /api/auth/login, che a
 * una password sbagliata risponde anch'esso 401. Trattare quel 401 come una
 * sessione caduta butterebbe fuori dall'applicazione chi ha solo digitato male
 * la password — esattamente il momento in cui non deve succedere.
 */
function risultatoSessione(promessa) {
  return promessa.then(
    (dati) => ({ ok: true, dati }),
    (errore) => {
      if (errore.status === 401 && store.getSessione().token) sessioneCaduta();
      return { ok: false, errore: errore.message || "Errore imprevisto.", stato: errore.status || 0 };
    }
  );
}

ipcMain.handle("app:stato", () => {
  const sessione = store.getSessione();
  return {
    autenticato: !!sessione.token,
    utente: sessione.user,
    impostazioni: store.getImpostazioni(),
    versione: app.getVersion(),
    cifraturaDisponibile: store.cifraturaDisponibile(),
    // Lo stato del PIN viaggia con lo stato generale: il guscio deve sapere
    // gia al primo disegno se proporre la configurazione rapida.
    pin: sessione.user ? pin.stato(sessione.user, sessione.deviceId) : null,
    // La finestra e disegnata dall'app: il guscio deve sapere subito se
    // mostrare "ingrandisci" o "ripristina", e a quale scala partire.
    massimizzata: !!(finestra && !finestra.isDestroyed() && finestra.isMaximized()),
    zoom: zoomValido(store.getImpostazioni().zoom),
    // Promemoria in scadenza: la pastiglia sulla voce di menu deve essere gia
    // vera quando la barra laterale compare, non un secondo dopo.
    promemoriaAperti: sessione.user ? promemoria.leggi({ utenteId: sessione.user.id }).length : 0
  };
});

ipcMain.handle("auth:login", (_e, { email, password }) => risultato(api.login(email, password).then((dati) => {
  // Accesso senza codice: la sessione e gia aperta, il controllo delle
  // notifiche puo partire subito come dopo la verifica dell'OTP.
  if (dati && dati.token) {
    avviaPolling();
    annota("accesso", { oggetto: email, dettaglio: "senza codice di verifica" });
  } else {
    annota("accesso-codice-richiesto", { oggetto: email });
  }
  return dati;
}).catch((errore) => {
  // Il tentativo fallito e la voce piu importante del registro: e l'unica che
  // racconta qualcosa che nessuno ha voluto fare.
  registro.annota({ azione: "accesso-negato", oggetto: email, dettaglio: errore.message, esito: "errore" });
  throw errore;
})));

ipcMain.handle("auth:otp", (_e, { ticket, codice }) => risultato(api.verificaOtp(ticket, codice).then((dati) => {
  avviaPolling();
  annota("accesso", { dettaglio: "codice di verifica corretto" });
  return dati;
})));

ipcMain.handle("auth:resend", (_e, { ticket }) => risultato(api.reinviaOtp(ticket)));

ipcMain.handle("auth:logout", () => risultato(api.logout().then(() => {
  annota("uscita");
  clearInterval(timerNotifiche);
  timerNotifiche = null;
  // Il confine delle notifiche appartiene alla sessione: chi entra dopo, anche
  // se e un altro collega sulla stessa postazione, riparte da capo.
  ultimaNotificaVista = 0;
  if (tray) tray.setToolTip("Win Studio Admin");
  invia("app:notifiche", { elenco: [], nonLette: 0 });
  return true;
})));

// Riaggancio dopo il blocco per inattivita: la password viene verificata dal
// server, ma la sessione aperta resta la stessa.
ipcMain.handle("auth:sblocca", (_e, { password }) => risultato((async () => {
  const utente = store.getSessione().user;
  if (!utente || !utente.email) throw new Error("Nessuna sessione da sbloccare.");
  try {
    await api.login(utente.email, password);
  } catch (errore) {
    annota("sblocco-negato", { dettaglio: errore.message, esito: "errore" });
    throw errore;
  }
  annota("sblocco");
  return true;
})()));

/* --- PIN rapido -----------------------------------------------------------
 * Il PIN non apre sessioni: riapre quella gia aperta dopo il blocco. Per
 * questo la verifica e tutta locale e non tocca il server, mentre impostarlo
 * o sostituirlo richiede prima la password completa — l'unica prova che
 * davanti alla tastiera c'e ancora il titolare dell'account.
 * ------------------------------------------------------------------------ */

ipcMain.handle("pin:stato", () => {
  const sessione = store.getSessione();
  return sessione.user ? pin.stato(sessione.user, sessione.deviceId) : pin.stato(null, sessione.deviceId);
});

ipcMain.handle("pin:imposta", (_e, { pin: codice, password }) => risultato((async () => {
  const sessione = store.getSessione();
  if (!sessione.user || !sessione.token) throw new Error("Serve una sessione aperta per impostare il PIN.");

  // La password si ricontrolla sempre, anche subito dopo l'accesso: impostare
  // un PIN e consegnare una scorciatoia permanente a questa postazione.
  try {
    await api.login(sessione.user.email, password);
  } catch (errore) {
    annota("pin-negato", { dettaglio: errore.message, esito: "errore" });
    throw new Error("Password non corretta: il PIN non e stato modificato.");
  }

  const esito = pin.imposta(sessione.user, sessione.deviceId, codice);
  annota("pin-impostato", { dettaglio: `${String(codice).length} cifre` });
  return esito;
})()));

ipcMain.handle("pin:verifica", (_e, { pin: codice }) => {
  const sessione = store.getSessione();
  const esito = pin.verifica(sessione.user, sessione.deviceId, codice);
  if (esito.ok) {
    annota("sblocco-pin");
  } else {
    registro.annota({
      azione: esito.disattivato ? "pin-disattivato" : "sblocco-pin-negato",
      dettaglio: esito.errore,
      esito: "errore"
    });
  }
  return esito;
});

ipcMain.handle("pin:rimuovi", () => risultato(Promise.resolve((() => {
  pin.rimuovi();
  annota("pin-rimosso");
  const sessione = store.getSessione();
  return sessione.user ? pin.stato(sessione.user, sessione.deviceId) : null;
})())));

ipcMain.handle("api:richiesta", (_e, { metodo, percorso, corpo }) => risultatoSessione(api.richiesta(metodo, percorso, corpo)));

ipcMain.handle("settings:set", (_e, parziali) => {
  const aggiornate = store.setImpostazioni(parziali);
  if (parziali.pollSeconds !== undefined) avviaPolling();
  return aggiornate;
});

ipcMain.handle("app:notifiche-ora", () => risultato(controllaNotifiche()));

// Scaricamento allegati e documenti: il file viaggia nel processo principale,
// il renderer riceve solo il percorso dove e stato salvato.
ipcMain.handle("api:scarica", (_e, { percorso, nomeFile }) => risultatoSessione((async () => {
  const scelta = await dialog.showSaveDialog(finestra, {
    defaultPath: path.join(app.getPath("downloads"), nomeFile || "allegato"),
    title: "Salva il file"
  });
  if (scelta.canceled || !scelta.filePath) return null;

  const risposta = await api.grezza("GET", percorso);
  fs.writeFileSync(scelta.filePath, Buffer.from(await risposta.arrayBuffer()));
  return scelta.filePath;
})()));

ipcMain.handle("aggiornamento:stato", () => aggiornamenti.stato());
ipcMain.handle("aggiornamento:controlla", () => risultato(aggiornamenti.controlla()));
ipcMain.handle("aggiornamento:scarica", () => risultato(aggiornamenti.scarica()));
ipcMain.handle("aggiornamento:installa", () => aggiornamenti.installaOra(finestra));
ipcMain.handle("aggiornamento:note", () => risultato(Promise.resolve({ url: aggiornamenti.apriNote() })));
ipcMain.handle("aggiornamento:automatico", (_e, automatico) => risultato(Promise.resolve((() => {
  store.setImpostazioni({ aggiornamentiAutomatici: !!automatico });
  annota(automatico ? "aggiornamenti-automatici-accesi" : "aggiornamenti-automatici-spenti");
  return aggiornamenti.impostaAutomatico(!!automatico);
})())));

/* --- Comandi della finestra e ingrandimento ------------------------------
 * La barra dei titoli e disegnata dall'app, quindi i tre bottoni di destra
 * devono arrivare fin qui: sono gli unici che possono davvero muovere la
 * finestra di Windows.
 * ---------------------------------------------------------------------- */

ipcMain.handle("finestra:comando", (_e, comando) => {
  if (!finestra || finestra.isDestroyed()) return { massimizzata: false };
  if (comando === "riduci") finestra.minimize();
  else if (comando === "chiudi") finestra.close();
  else if (comando === "ingrandisci") {
    if (finestra.isMaximized()) finestra.unmaximize(); else finestra.maximize();
  }
  return { massimizzata: finestra.isMaximized() };
});

ipcMain.handle("finestra:zoom", (_e, passo) => ({ zoom: cambiaZoom(Number(passo) || 0) }));

/* --- Promemoria ----------------------------------------------------------- */

ipcMain.handle("promemoria:leggi", (_e, filtri) => risultato(Promise.resolve(promemoria.leggi(filtri || {}))));
ipcMain.handle("promemoria:aggiungi", (_e, voce) => risultato(Promise.resolve((() => {
  const utente = store.getSessione().user;
  const creato = promemoria.aggiungi({ ...voce, utenteId: utente ? utente.id : null });
  annota("promemoria-creato", { quando: creato.quando, titolo: creato.titolo });
  return creato;
})())));
ipcMain.handle("promemoria:fatto", (_e, { id, fatto }) => risultato(Promise.resolve(promemoria.segna(id, { fatto: !!fatto }))));
ipcMain.handle("promemoria:rinvia", (_e, { id, minuti }) => risultato(Promise.resolve(promemoria.rinvia(id, minuti))));
ipcMain.handle("promemoria:elimina", (_e, id) => risultato(Promise.resolve(promemoria.elimina(id))));

/* --- Copie di sicurezza --------------------------------------------------- */

ipcMain.handle("copie:elenco", () => risultato(Promise.resolve(copie.elenco())));
ipcMain.handle("copie:crea", () => risultato(Promise.resolve((() => {
  const fatta = copie.crea({ motivo: "manuale", versione: app.getVersion() });
  copie.pota(store.getImpostazioni().copieDaTenere || 10);
  annota("copia-creata", { percorso: fatta.percorso });
  return fatta;
})())));

// Una copia fuori dalla cartella dati e l'unica che serve quando il disco si
// rompe: qui si sceglie dove, e la si puo mettere su una chiavetta.
ipcMain.handle("copie:esporta", () => risultato((async () => {
  const scelta = await dialog.showOpenDialog(finestra, {
    title: "Dove mettere la copia di sicurezza",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Metti qui la copia"
  });
  if (scelta.canceled || !scelta.filePaths[0]) return { annullato: true };
  const fatta = copie.crea({ motivo: "esportata", versione: app.getVersion(), destinazione: scelta.filePaths[0] });
  annota("copia-esportata", { percorso: fatta.percorso });
  return fatta;
})()));

ipcMain.handle("copie:rimuovi", (_e, nome) => risultato(Promise.resolve(copie.rimuovi(nome))));

ipcMain.handle("copie:ripristina", (_e, percorsoCopia) => risultato((async () => {
  let percorso = percorsoCopia;
  if (!percorso) {
    const scelta = await dialog.showOpenDialog(finestra, {
      title: "Quale copia ripristinare",
      properties: ["openDirectory"],
      defaultPath: copie.radiceCopie(),
      buttonLabel: "Ripristina questa copia"
    });
    if (scelta.canceled || !scelta.filePaths[0]) return { annullato: true };
    percorso = scelta.filePaths[0];
  }

  const conferma = dialog.showMessageBoxSync(finestra, {
    type: "warning",
    buttons: ["Ripristina e riavvia", "Annulla"],
    defaultId: 1,
    cancelId: 1,
    title: "Ripristino dei dati locali",
    message: "Le schede, i file allegati, i promemoria e il registro di questa postazione tornano com'erano nella copia.",
    detail: "Lo stato attuale viene messo da parte in una copia di riserva, quindi il ripristino resta annullabile. L'applicazione si riavvia."
  });
  if (conferma !== 0) return { annullato: true };

  const esito = copie.ripristina(percorso, { versione: app.getVersion() });
  if (esito.impostazioni) store.setImpostazioni(esito.impostazioni);
  annota("copia-ripristinata", { percorso, rimessi: esito.rimessi.join(", ") });

  uscitaRichiesta = true;
  app.relaunch();
  setTimeout(() => app.exit(0), 400);
  return esito;
})()));

/* --- Stampa --------------------------------------------------------------- */

ipcMain.handle("stampa:pratica", (_e, dati) => risultato((async () => {
  const esito = await stampa.pratica(finestra, { ...dati, versione: app.getVersion() });
  if (esito.percorso) annota("pratica-stampata", { numero: dati && dati.numero, percorso: esito.percorso });
  return esito;
})()));
ipcMain.handle("stampa:apri", (_e, percorso) => shell.openPath(percorso));

ipcMain.handle("app:apri-esterno", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});

ipcMain.handle("app:apri-file", (_e, percorso) => {
  shell.showItemInFolder(percorso);
  return true;
});

/* --- Registro locale delle attivita -------------------------------------- */

ipcMain.handle("registro:annota", (_e, voce) => annota(voce.azione, voce));
ipcMain.handle("registro:leggi", (_e, filtri) => risultato(Promise.resolve(registro.leggi(filtri || {}))));
ipcMain.handle("registro:svuota", () => risultato(Promise.resolve(registro.svuota())));

/* --- Esportazione su file ------------------------------------------------
 * Un solo canale per tutte le esportazioni dell'app (CSV degli elenchi, JSON
 * delle impostazioni, registro delle attivita): il renderer prepara il testo,
 * il processo principale chiede dove salvarlo e scrive.
 * ---------------------------------------------------------------------- */

ipcMain.handle("app:salva-testo", (_e, { nomeFile, contenuto, titolo }) => risultato((async () => {
  const estensione = path.extname(nomeFile || "").replace(".", "") || "txt";
  const scelta = await dialog.showSaveDialog(finestra, {
    title: titolo || "Salva il file",
    defaultPath: path.join(app.getPath("downloads"), nomeFile || "esportazione.txt"),
    filters: [{ name: estensione.toUpperCase(), extensions: [estensione] }]
  });
  if (scelta.canceled || !scelta.filePath) return null;

  // Il BOM serve a Excel italiano: senza, le lettere accentate dei nomi dei
  // condomini escono illeggibili al doppio clic sul CSV.
  const testo = estensione === "csv" ? `\uFEFF${contenuto}` : contenuto;
  fs.writeFileSync(scelta.filePath, testo, "utf8");
  annota("esportazione", { oggetto: path.basename(scelta.filePath), dettaglio: `${contenuto.length} caratteri` });
  return scelta.filePath;
})()));

/* --- Impostazioni: copia di sicurezza ------------------------------------
 * Le preferenze della postazione (server, viste salvate, orari, aspetto) si
 * portano su un altro computer senza rifare la configurazione a mano. La
 * chiave dell'applicazione e le credenziali non escono mai dal file.
 * ---------------------------------------------------------------------- */

const NON_ESPORTABILI = ["chiaveApp", "ultimaEmail", "finestra"];

ipcMain.handle("impostazioni:esporta", () => risultato(Promise.resolve((() => {
  const copia = { ...store.getImpostazioni() };
  for (const chiave of NON_ESPORTABILI) delete copia[chiave];
  return {
    generato: new Date().toISOString(),
    applicazione: "Win Studio Admin",
    versione: app.getVersion(),
    impostazioni: copia
  };
})())));

ipcMain.handle("impostazioni:importa", () => risultato((async () => {
  const scelta = await dialog.showOpenDialog(finestra, {
    title: "Scegli la copia delle impostazioni",
    properties: ["openFile"],
    filters: [{ name: "Impostazioni", extensions: ["json"] }]
  });
  if (scelta.canceled || !scelta.filePaths.length) return null;

  let contenuto = null;
  try {
    contenuto = JSON.parse(fs.readFileSync(scelta.filePaths[0], "utf8"));
  } catch {
    throw new Error("Il file non e una copia valida delle impostazioni.");
  }
  const nuove = contenuto && contenuto.impostazioni;
  if (!nuove || typeof nuove !== "object") throw new Error("Il file non contiene impostazioni.");

  // Si applicano solo le chiavi che l'app conosce davvero: un file di una
  // versione diversa non deve poter iniettare voci sconosciute.
  const ammesse = {};
  for (const chiave of Object.keys(store.DEFAULTS)) {
    if (NON_ESPORTABILI.includes(chiave)) continue;
    if (nuove[chiave] !== undefined) ammesse[chiave] = nuove[chiave];
  }
  store.setImpostazioni(ammesse);
  annota("impostazioni-importate", { oggetto: path.basename(scelta.filePaths[0]), dettaglio: `${Object.keys(ammesse).length} voci` });
  avviaPolling();
  return Object.keys(ammesse).length;
})()));

/* --- Diagnostica ---------------------------------------------------------
 * Quello che serve alla prima domanda dell'assistenza — "che versione hai, il
 * server risponde, dove sono i file?" — senza far aprire il prompt a nessuno.
 * ---------------------------------------------------------------------- */

ipcMain.handle("app:diagnostica", () => risultato((async () => {
  const impostazioni = store.getImpostazioni();
  const sessione = store.getSessione();

  let latenza = null;
  let raggiungibile = false;
  let dettaglioRete = "";
  const partenza = Date.now();
  try {
    const risposta = await fetch(`${String(impostazioni.baseUrl).replace(/\/+$/, "")}/api/health`, {
      method: "GET",
      headers: { "User-Agent": api.USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    latenza = Date.now() - partenza;

    // /api/health e una rotta vera del Worker e risponde con lo stato del
    // database. Un 404 significa che dall'altra parte c'e un server piu
    // vecchio di questa app: risponde, ma non e detto che il resto funzioni, e
    // vale la pena dirlo invece di far passare tutto per verde.
    let corpo = null;
    try { corpo = await risposta.json(); } catch { /* non era JSON */ }

    if (risposta.status === 404) {
      raggiungibile = true;
      dettaglioRete = "risponde, ma non conosce /api/health: server piu vecchio dell'applicazione";
    } else if (risposta.ok && corpo && corpo.database === "ok") {
      raggiungibile = true;
      dettaglioRete = "servizio e banca dati operativi";
    } else if (corpo && corpo.database && corpo.database !== "ok") {
      raggiungibile = true;
      dettaglioRete = `il server risponde ma la banca dati no (HTTP ${risposta.status})`;
    } else {
      // Anche un 401 o un 502 dice quel che ci interessa per la prima domanda:
      // qualcosa dall'altra parte c'e.
      raggiungibile = risposta.status < 500;
      dettaglioRete = `HTTP ${risposta.status}`;
    }
  } catch (errore) {
    latenza = Date.now() - partenza;
    dettaglioRete = errore.name === "TimeoutError" ? "nessuna risposta entro 8 secondi" : errore.message;
  }

  return {
    versione: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    piattaforma: `${process.platform} ${process.arch}`,
    baseUrl: impostazioni.baseUrl,
    raggiungibile,
    latenza,
    dettaglioRete,
    deviceId: sessione.deviceId,
    cifratura: store.cifraturaDisponibile(),
    silenzio: silenzioAttivo(),
    cartellaDati: app.getPath("userData"),
    registro: registro.percorso(),
    aggiornamento: aggiornamenti.stato()
  };
})()));

ipcMain.handle("app:apri-cartella-dati", () => {
  shell.openPath(app.getPath("userData"));
  return true;
});


/* --- Archivio locale delle schede ---------------------------------------- */

ipcMain.handle("archivio:leggi", (_e, { tipo, chiave }) => risultato(Promise.resolve(archivio.scheda(tipo, chiave))));
ipcMain.handle("archivio:salva", (_e, { tipo, chiave, campi, note }) =>
  risultato(Promise.resolve(archivio.salvaScheda(tipo, chiave, { campi, note }))));
ipcMain.handle("archivio:rimuovi-allegato", (_e, { tipo, chiave, id }) =>
  risultato(Promise.resolve(archivio.rimuoviAllegato(tipo, chiave, id))));

ipcMain.handle("archivio:allega", (_e, { tipo, chiave }) => risultato((async () => {
  const scelta = await dialog.showOpenDialog(finestra, {
    title: "Scegli i file da allegare alla scheda",
    properties: ["openFile", "multiSelections"]
  });
  if (scelta.canceled) return [];
  return scelta.filePaths.map((percorso) => archivio.allega(tipo, chiave, percorso));
})()));

ipcMain.handle("archivio:apri-allegato", (_e, percorso) => shell.openPath(percorso));

// Caricamento di un documento condominiale sul server (bucket R2 dello
// Studio): e l'unica chiamata multipart dell'app, il resto e JSON.
ipcMain.handle("documenti:carica", (_e, { condominioId, categoria, titolo, nota }) => risultatoSessione((async () => {
  const scelta = await dialog.showOpenDialog(finestra, {
    title: "Scegli il documento da caricare",
    properties: ["openFile"],
    filters: [{ name: "Documenti", extensions: ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx", "xls", "xlsx"] }]
  });
  if (scelta.canceled || !scelta.filePaths.length) return null;

  const percorsoFile = scelta.filePaths[0];
  const contenuto = fs.readFileSync(percorsoFile);
  const estensione = path.extname(percorsoFile).toLowerCase();
  const tipi = {
    ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
  const tipo = tipi[estensione];
  if (!tipo) throw new Error("Tipo di file non consentito dal server (PDF, immagini, Word, Excel).");
  if (contenuto.length > 20 * 1024 * 1024) throw new Error("Il file supera i 20 MB accettati dal server.");

  const modulo = new FormData();
  modulo.set("condominioId", String(condominioId));
  modulo.set("category", categoria);
  modulo.set("title", titolo);
  if (nota) modulo.set("note", nota);
  modulo.set("file", new Blob([contenuto], { type: tipo }), path.basename(percorsoFile));

  const risposta = await api.grezza("POST", "/api/documents", { body: modulo });
  return risposta.json().catch(() => null);
})()));

/* --- Ciclo di vita ------------------------------------------------------- */

app.whenReady().then(() => {
  app.setAppUserModelId("net.burchielli.winstudioadmin");
  // Anche fuori dall'installer (avvio da sorgente, copia scompattata a mano)
  // l'app si dichiara padrona dei collegamenti winstudio://.
  try { app.setAsDefaultProtocolClient("winstudio"); } catch { /* senza permessi: pazienza */ }
  store.caricaImpostazioni();
  store.caricaSessione();
  creaFinestra();
  creaTray();
  if (store.getSessione().token) avviaPolling();

  // Aggiornamento automatico: cerca la versione pubblicata dall'ultimo push
  // sul repository, la scarica in sottofondo e la installa alla chiusura.
  aggiornamenti.avvia(invia, store.getImpostazioni());

  // Promemoria: partono con l'app perche altrimenti non suonano. Quelli
  // scaduti mentre l'app era chiusa suonano adesso, una volta sola.
  promemoria.avvia((tipo, voce) => {
    if (tipo === "apri") {
      mostraFinestra();
      if (voce.destinazione) vaiA(voce.destinazione);
      else vaiA("promemoria");
      return;
    }
    invia("app:promemoria", voce);
  });

  // Copia di sicurezza dei dati locali, una volta al giorno alla prima
  // apertura utile. Non blocca l'avvio: se fallisce, l'app parte lo stesso e
  // il motivo finisce nel registro.
  setTimeout(() => {
    try {
      const impostazioni = store.getImpostazioni();
      const fatta = copie.copiaAutomaticaSeServe({
        attiva: impostazioni.copieAutomatiche !== false,
        ogniGiorni: impostazioni.copieOgniGiorni || 1,
        quante: impostazioni.copieDaTenere || 10,
        versione: app.getVersion()
      });
      if (fatta) annota("copia-automatica", { percorso: fatta.percorso, peso: fatta.peso });
    } catch (errore) {
      annota("copia-non-riuscita", { errore: errore.message });
    }
  }, 4000);

  // Richiamo rapido da qualunque applicazione: Ctrl+Alt+S riporta su l'app e
  // apre la ricerca. Se la combinazione e gia occupata da un altro programma
  // l'app parte lo stesso, senza scorciatoia globale.
  try {
    globalShortcut.register("Control+Alt+S", () => {
      mostraFinestra();
      invia("app:scorciatoia-globale");
    });
  } catch { /* combinazione non disponibile */ }

  // Aperta *da* un collegamento: la pagina deve prima esistere, altrimenti la
  // destinazione arriva a una finestra che non ha ancora nessuno in ascolto.
  finestra.webContents.once("did-finish-load", () => apriCollegamento(process.argv));
});

app.on("window-all-closed", () => {
  // Su Windows resta l'icona in area di notifica: l'uscita avviene dal menu.
  if (process.platform !== "win32" && !tray) app.quit();
});

app.on("before-quit", () => { uscitaRichiesta = true; });
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  aggiornamenti.ferma();
  promemoria.ferma();
});
