/* =============================================================================
 * Aggiornamento automatico
 *
 * Ogni push sul repository produce una nuova versione pubblicata fra le
 * Release di GitHub (vedi .github/workflows/rilascio.yml). L'app la cerca da
 * sola: controlla all'avvio, poi a intervalli regolari, scarica in sottofondo
 * e installa alla chiusura — oppure subito, se chi sta lavorando lo chiede dal
 * riquadro che compare in alto.
 *
 * Due scelte deliberate:
 *   · non si installa mai di sorpresa mentre qualcuno sta scrivendo una
 *     risposta a un condomino: il riavvio parte solo su richiesta o quando
 *     l'applicazione viene chiusa;
 *   · un aggiornamento che non riesce non deve fermare il lavoro: l'errore
 *     finisce nel registro e nel riquadro, e l'app continua con la versione
 *     che ha gia.
 * ========================================================================== */

const { app, dialog } = require("electron");

let updater = null;
try {
  ({ autoUpdater: updater } = require("electron-updater"));
} catch {
  // Avvio da sorgente senza dipendenze di produzione installate: l'app deve
  // partire lo stesso, semplicemente senza aggiornamento automatico.
  updater = null;
}

const INTERVALLO_MS = 60 * 60 * 1000; // un controllo all'ora

let inviaAllaFinestra = () => {};
let timer = null;
let statoCorrente = { fase: "sconosciuto", versione: null, note: null, errore: null, percentuale: 0 };

function aggiorna(parziale) {
  statoCorrente = { ...statoCorrente, ...parziale };
  inviaAllaFinestra("app:aggiornamento", statoCorrente);
}

function disponibile() {
  // In sviluppo electron-updater non ha un pacchetto installato su cui
  // lavorare: senza questo controllo ogni avvio da `npm start` finirebbe con
  // un errore rumoroso e inutile.
  return !!updater && app.isPackaged;
}

function avvia(invia) {
  inviaAllaFinestra = invia || (() => {});

  if (!disponibile()) {
    aggiorna({ fase: app.isPackaged ? "non-configurato" : "sviluppo" });
    return;
  }

  updater.autoDownload = true;          // scarica appena trova qualcosa
  updater.autoInstallOnAppQuit = true;  // installa quando si chiude l'app
  updater.logger = console;

  updater.on("checking-for-update", () => aggiorna({ fase: "controllo", errore: null }));
  updater.on("update-not-available", () => aggiorna({ fase: "aggiornata", versione: app.getVersion() }));
  updater.on("update-available", (info) => aggiorna({ fase: "scaricamento", versione: info.version, percentuale: 0 }));
  updater.on("download-progress", (p) => aggiorna({ fase: "scaricamento", percentuale: Math.round(p.percent) }));
  updater.on("update-downloaded", (info) => aggiorna({
    fase: "pronta", versione: info.version, percentuale: 100,
    note: typeof info.releaseNotes === "string" ? info.releaseNotes : null
  }));
  updater.on("error", (errore) => {
    console.error("Aggiornamento non riuscito:", errore);
    aggiorna({ fase: "errore", errore: errore && errore.message ? errore.message : String(errore) });
  });

  controlla();
  clearInterval(timer);
  timer = setInterval(controlla, INTERVALLO_MS);
}

function controlla() {
  if (!disponibile()) {
    aggiorna({ fase: app.isPackaged ? "non-configurato" : "sviluppo" });
    return Promise.resolve(statoCorrente);
  }
  return updater.checkForUpdates().then(() => statoCorrente).catch((errore) => {
    aggiorna({ fase: "errore", errore: errore.message });
    return statoCorrente;
  });
}

/** Riavvio immediato sulla nuova versione, su richiesta esplicita. */
function installaOra(finestra) {
  if (!disponibile() || statoCorrente.fase !== "pronta") return false;
  const scelta = dialog.showMessageBoxSync(finestra, {
    type: "question",
    buttons: ["Riavvia e aggiorna", "Piu tardi"],
    defaultId: 0,
    cancelId: 1,
    title: "Aggiornamento pronto",
    message: `La versione ${statoCorrente.versione} e pronta.`,
    detail: "L'applicazione si chiude e si riapre aggiornata. Le pratiche aperte restano dove sono."
  });
  if (scelta !== 0) return false;
  setImmediate(() => updater.quitAndInstall(false, true));
  return true;
}

function stato() {
  return statoCorrente;
}

function ferma() {
  clearInterval(timer);
}

module.exports = { avvia, controlla, installaOra, stato, ferma };
