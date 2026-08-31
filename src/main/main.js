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

let finestra = null;
let tray = null;
let uscitaRichiesta = false;
let timerNotifiche = null;
let ultimaNotificaVista = 0;

const SVILUPPO = process.argv.includes("--dev");

// Una sola istanza: il secondo avvio riporta in primo piano quella aperta
// invece di aprire una seconda finestra con la stessa sessione.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostraFinestra);
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
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    title: "Win Studio Admin",
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
    if (!impostazioni.avvioMinimizzato) finestra.show();
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
  // Pallino chiaro disegnato al volo: evita di dipendere da un file binario
  // nel repository e resta leggibile sulla barra di Windows.
  const dimensione = 16;
  const buffer = Buffer.alloc(dimensione * dimensione * 4);
  for (let y = 0; y < dimensione; y += 1) {
    for (let x = 0; x < dimensione; x += 1) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dentro = dx * dx + dy * dy <= 49;
      const i = (y * dimensione + x) * 4;
      buffer[i] = dentro ? 0x4f : 0x00;      // B
      buffer[i + 1] = dentro ? 0x9c : 0x00;  // G
      buffer[i + 2] = dentro ? 0xf5 : 0x00;  // R
      buffer[i + 3] = dentro ? 0xff : 0x00;  // A
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: dimensione, height: dimensione });
}

function creaTray() {
  tray = new Tray(iconaTray());
  tray.setToolTip("Win Studio Admin");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Apri", click: mostraFinestra },
    { label: "Coda segnalazioni", click: () => vaiA("coda") },
    { label: "Nuove notifiche", click: () => vaiA("notifiche") },
    { label: "Controlla aggiornamenti", click: () => aggiornamenti.controlla() },
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

/* --- Notifiche di sistema ------------------------------------------------ */

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

    // Solo cio che e arrivato dopo l'ultimo controllo: riaprire l'app non deve
    // far ripiovere sul desktop notifiche gia viste.
    const nuove = nonLette.filter((n) => new Date(`${n.created_at}Z`).getTime() > ultimaNotificaVista);
    if (ultimaNotificaVista === 0) {
      ultimaNotificaVista = Date.now();
      return;
    }
    ultimaNotificaVista = Date.now();

    for (const notifica of nuove.slice(0, 4)) {
      const avviso = new Notification({ title: notifica.title || "Win Studio Admin", body: notifica.message || "" });
      avviso.on("click", () => {
        if (notifica.ticket_id) vaiA(`ticket:${notifica.ticket_id}`);
        else vaiA("notifiche");
      });
      avviso.show();
    }
  } catch (errore) {
    if (errore.status === 401) {
      store.salvaSessione(null, null);
      invia("app:sessione-scaduta");
    }
  }
}

function avviaPolling() {
  clearInterval(timerNotifiche);
  const secondi = Math.max(15, Number(store.getImpostazioni().pollSeconds) || 45);
  timerNotifiche = setInterval(controllaNotifiche, secondi * 1000);
  controllaNotifiche();
}

/* --- IPC ----------------------------------------------------------------- */

function risultato(promessa) {
  return promessa.then(
    (dati) => ({ ok: true, dati }),
    (errore) => ({ ok: false, errore: errore.message || "Errore imprevisto.", stato: errore.status || 0 })
  );
}

ipcMain.handle("app:stato", () => {
  const sessione = store.getSessione();
  return {
    autenticato: !!sessione.token,
    utente: sessione.user,
    impostazioni: store.getImpostazioni(),
    versione: app.getVersion(),
    cifraturaDisponibile: store.cifraturaDisponibile()
  };
});

ipcMain.handle("auth:login", (_e, { email, password }) => risultato(api.login(email, password)));
ipcMain.handle("auth:otp", (_e, { ticket, codice }) => risultato(api.verificaOtp(ticket, codice).then((dati) => {
  avviaPolling();
  return dati;
})));
ipcMain.handle("auth:resend", (_e, { ticket }) => risultato(api.reinviaOtp(ticket)));
ipcMain.handle("auth:logout", () => risultato(api.logout().then(() => {
  clearInterval(timerNotifiche);
  return true;
})));

ipcMain.handle("api:richiesta", (_e, { metodo, percorso, corpo }) => risultato(api.richiesta(metodo, percorso, corpo)));

ipcMain.handle("settings:set", (_e, parziali) => {
  const aggiornate = store.setImpostazioni(parziali);
  if (parziali.pollSeconds !== undefined) avviaPolling();
  return aggiornate;
});

ipcMain.handle("app:notifiche-ora", () => risultato(controllaNotifiche()));

// Scaricamento allegati e documenti: il file viaggia nel processo principale,
// il renderer riceve solo il percorso dove e stato salvato.
ipcMain.handle("api:scarica", (_e, { percorso, nomeFile }) => risultato((async () => {
  const scelta = await dialog.showSaveDialog(finestra, {
    defaultPath: path.join(app.getPath("downloads"), nomeFile || "allegato"),
    title: "Salva il file"
  });
  if (scelta.canceled || !scelta.filePath) return null;

  const impostazioni = store.getImpostazioni();
  const sessione = store.getSessione();
  const risposta = await fetch(`${String(impostazioni.baseUrl).replace(/\/+$/, "")}${percorso}`, {
    headers: {
      "User-Agent": api.USER_AGENT,
      Authorization: `Bearer ${sessione.token}`,
      "X-Device-Id": sessione.deviceId
    }
  });
  if (!risposta.ok) throw new Error(`Scaricamento non riuscito (${risposta.status}).`);
  fs.writeFileSync(scelta.filePath, Buffer.from(await risposta.arrayBuffer()));
  return scelta.filePath;
})()));

ipcMain.handle("aggiornamento:stato", () => aggiornamenti.stato());
ipcMain.handle("aggiornamento:controlla", () => risultato(aggiornamenti.controlla()));
ipcMain.handle("aggiornamento:installa", () => aggiornamenti.installaOra(finestra));

ipcMain.handle("app:apri-esterno", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});

ipcMain.handle("app:apri-file", (_e, percorso) => {
  shell.showItemInFolder(percorso);
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
ipcMain.handle("documenti:carica", (_e, { condominioId, categoria, titolo, nota }) => risultato((async () => {
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

  const impostazioni = store.getImpostazioni();
  const sessione = store.getSessione();
  const risposta = await fetch(`${String(impostazioni.baseUrl).replace(/\/+$/, "")}/api/documents`, {
    method: "POST",
    headers: {
      "User-Agent": api.USER_AGENT,
      Authorization: `Bearer ${sessione.token}`,
      "X-Device-Id": sessione.deviceId
    },
    body: modulo
  });
  const dati = await risposta.json().catch(() => null);
  if (!risposta.ok) throw new Error((dati && dati.error) || `Caricamento non riuscito (${risposta.status}).`);
  return dati;
})()));

/* --- Ciclo di vita ------------------------------------------------------- */

app.whenReady().then(() => {
  app.setAppUserModelId("net.burchielli.winstudioadmin");
  store.caricaImpostazioni();
  store.caricaSessione();
  creaFinestra();
  creaTray();
  if (store.getSessione().token) avviaPolling();

  // Aggiornamento automatico: cerca la versione pubblicata dall'ultimo push
  // sul repository, la scarica in sottofondo e la installa alla chiusura.
  aggiornamenti.avvia(invia);

  // Richiamo rapido da qualunque applicazione: Ctrl+Alt+S riporta su l'app e
  // apre la ricerca. Se la combinazione e gia occupata da un altro programma
  // l'app parte lo stesso, senza scorciatoia globale.
  try {
    globalShortcut.register("Control+Alt+S", () => {
      mostraFinestra();
      invia("app:scorciatoia-globale");
    });
  } catch { /* combinazione non disponibile */ }
});

app.on("window-all-closed", () => {
  // Su Windows resta l'icona in area di notifica: l'uscita avviene dal menu.
  if (process.platform !== "win32" && !tray) app.quit();
});

app.on("before-quit", () => { uscitaRichiesta = true; });
app.on("will-quit", () => { globalShortcut.unregisterAll(); aggiornamenti.ferma(); });
