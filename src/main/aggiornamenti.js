/* =============================================================================
 * Aggiornamento dell'applicazione
 *
 * Il giro completo, da una parte all'altra:
 *
 *   push sul ramo principale
 *     -> .github/workflows/rilascio.yml alza la versione in package.json,
 *        compila l'installer NSIS e lo pubblica fra le Release del repository
 *     -> l'app installata interroga quelle Release (electron-updater legge la
 *        sezione `build.publish` di package.json: provider github, owner e repo)
 *     -> scarica il differenziale in sottofondo e installa quando si chiude.
 *
 * Chi guarda Impostazioni -> Aggiornamenti deve poter seguire quel giro senza
 * chiedere niente a nessuno: che versione ha, che versione c'e, a che punto e
 * lo scaricamento, e — se qualcosa non torna — perche.
 *
 * Due scelte deliberate:
 *   · non si installa mai di sorpresa mentre qualcuno sta scrivendo a un
 *     condomino: il riavvio parte solo su richiesta o alla chiusura;
 *   · un aggiornamento che non riesce non ferma il lavoro: l'errore finisce
 *     nel riquadro e l'app continua con la versione che ha gia.
 * ========================================================================== */

const { app, dialog, shell } = require("electron");

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
let preferenze = { automatico: true };
let pubblicazione = { owner: null, repo: null };

let statoCorrente = {
  fase: "sconosciuto",
  versione: null,          // la versione trovata sul repository
  versioneInstallata: null,
  note: null,
  urlNote: null,
  errore: null,
  percentuale: 0,
  byteScaricati: 0,
  byteTotali: 0,
  velocita: 0,
  ultimoControllo: null,
  automatico: true,
  origine: null            // owner/repo da cui arrivano le versioni
};

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

/** Da dove arrivano le versioni: la stessa cosa che legge electron-updater. */
function leggiPubblicazione() {
  try {
    const { build } = require("../../package.json");
    const prima = [].concat(build && build.publish ? build.publish : [])[0];
    if (prima && prima.owner && prima.repo) return { owner: prima.owner, repo: prima.repo };
  } catch { /* pacchetto senza sezione build */ }
  return { owner: null, repo: null };
}

function urlDellaVersione(versione) {
  if (!pubblicazione.owner || !versione) return null;
  return `https://github.com/${pubblicazione.owner}/${pubblicazione.repo}/releases/tag/v${versione}`;
}

function urlDelleVersioni() {
  if (!pubblicazione.owner) return null;
  return `https://github.com/${pubblicazione.owner}/${pubblicazione.repo}/releases`;
}

/* --- Avvio ---------------------------------------------------------------- */

function avvia(invia, impostazioni = {}) {
  inviaAllaFinestra = invia || (() => {});
  pubblicazione = leggiPubblicazione();
  preferenze.automatico = impostazioni.aggiornamentiAutomatici !== false;

  aggiorna({
    versioneInstallata: app.getVersion(),
    automatico: preferenze.automatico,
    origine: pubblicazione.owner ? `${pubblicazione.owner}/${pubblicazione.repo}` : null
  });

  if (!disponibile()) {
    aggiorna({ fase: app.isPackaged ? "non-configurato" : "sviluppo" });
    return;
  }

  // Con lo scaricamento automatico spento l'app avvisa e basta: chi lavora
  // sotto tethering, o su una linea che si divide con dieci persone, decide
  // lui quando spendere trenta megabyte.
  updater.autoDownload = preferenze.automatico;
  updater.autoInstallOnAppQuit = true;
  updater.logger = console;

  updater.on("checking-for-update", () => aggiorna({ fase: "controllo", errore: null }));

  updater.on("update-not-available", () => aggiorna({
    fase: "aggiornata",
    versione: null,
    ultimoControllo: new Date().toISOString()
  }));

  updater.on("update-available", (info) => aggiorna({
    fase: preferenze.automatico ? "scaricamento" : "disponibile",
    versione: info.version,
    urlNote: urlDellaVersione(info.version),
    note: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
    percentuale: 0,
    ultimoControllo: new Date().toISOString()
  }));

  updater.on("download-progress", (p) => aggiorna({
    fase: "scaricamento",
    percentuale: Math.round(p.percent),
    byteScaricati: p.transferred,
    byteTotali: p.total,
    velocita: Math.round(p.bytesPerSecond || 0)
  }));

  updater.on("update-downloaded", (info) => aggiorna({
    fase: "pronta",
    versione: info.version,
    urlNote: urlDellaVersione(info.version),
    percentuale: 100,
    note: typeof info.releaseNotes === "string" ? info.releaseNotes : null
  }));

  updater.on("error", (errore) => {
    console.error("Aggiornamento non riuscito:", errore);
    aggiorna({
      fase: "errore",
      errore: errore && errore.message ? errore.message : String(errore),
      ultimoControllo: new Date().toISOString()
    });
  });

  controlla();
  clearInterval(timer);
  timer = setInterval(controlla, INTERVALLO_MS);
}

/** Cambio di preferenza a caldo, senza riavviare l'app. */
function impostaAutomatico(automatico) {
  preferenze.automatico = automatico !== false;
  if (updater) updater.autoDownload = preferenze.automatico;
  aggiorna({ automatico: preferenze.automatico });
  return statoCorrente;
}

/* --- Controllo, scaricamento, installazione ------------------------------- */

function controlla() {
  if (!disponibile()) {
    aggiorna({
      fase: app.isPackaged ? "non-configurato" : "sviluppo",
      versioneInstallata: app.getVersion(),
      ultimoControllo: new Date().toISOString()
    });
    return Promise.resolve(statoCorrente);
  }
  return updater.checkForUpdates()
    .then(() => statoCorrente)
    .catch((errore) => {
      aggiorna({ fase: "errore", errore: errore.message, ultimoControllo: new Date().toISOString() });
      return statoCorrente;
    });
}

/**
 * Scaricamento su richiesta: serve quando l'automatico e spento, e come via
 * d'uscita quando uno scaricamento e fallito a meta.
 */
function scarica() {
  if (!disponibile()) return Promise.resolve(statoCorrente);
  if (!["disponibile", "errore", "scaricamento"].includes(statoCorrente.fase)) {
    return Promise.resolve(statoCorrente);
  }
  aggiorna({ fase: "scaricamento", errore: null, percentuale: statoCorrente.percentuale || 0 });
  return updater.downloadUpdate()
    .then(() => statoCorrente)
    .catch((errore) => {
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
    detail: "L'applicazione si chiude e si riapre aggiornata. Le schede aperte vengono ritrovate al riavvio."
  });
  if (scelta !== 0) return false;
  setImmediate(() => updater.quitAndInstall(false, true));
  return true;
}

/** Le note della versione, sul sito del repository. */
function apriNote() {
  const url = statoCorrente.urlNote || urlDelleVersioni();
  if (url) shell.openExternal(url);
  return url;
}

function stato() {
  return { ...statoCorrente, versioneInstallata: app.getVersion(), elencoVersioni: urlDelleVersioni() };
}

function ferma() {
  clearInterval(timer);
}

module.exports = { avvia, controlla, scarica, installaOra, impostaAutomatico, apriNote, stato, ferma };
