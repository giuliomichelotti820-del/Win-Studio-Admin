/* =============================================================================
 * Promemoria della postazione
 *
 * "Richiamare l'idraulico giovedi alle nove" non e uno stato della pratica: e
 * una cosa che deve fare una persona, a un'ora precisa. Finche non c'era un
 * posto dove metterla finiva su un foglietto, e il foglietto si perde.
 *
 * Sono locali di proposito. Il server non ha una rotta per i promemoria, e
 * inventarne una a meta — visibile solo da qui ma scritta la — sarebbe peggio
 * di tenerli dove sono: sul computer di chi li ha presi, che e anche l'unico
 * che li deve vedere suonare. La scheda dice a schermo dove stanno, cosi
 * nessuno ci mette dentro un impegno che riguarda tutto lo Studio.
 *
 * Il controllo gira ogni trenta secondi. Un promemoria scaduto mentre l'app era
 * chiusa suona alla riapertura, una volta sola: meglio in ritardo che mai, e
 * mai due volte.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { app, Notification } = require("electron");

const FILE = "promemoria.json";
const RITMO = 30_000;

let timer = null;
let elenco = null;
let avvisa = () => {};

function percorso() {
  return path.join(app.getPath("userData"), FILE);
}

function carica() {
  if (elenco) return elenco;
  try {
    const letto = JSON.parse(fs.readFileSync(percorso(), "utf8"));
    elenco = Array.isArray(letto) ? letto : [];
  } catch {
    elenco = [];
  }
  return elenco;
}

function salva() {
  try {
    fs.writeFileSync(percorso(), JSON.stringify(carica(), null, 2), { mode: 0o600 });
  } catch (errore) {
    console.error("Promemoria non salvati:", errore.message);
  }
}

/**
 * I promemoria dell'account collegato, dal piu vicino al piu lontano.
 *
 * Passano anche quelli senza id utente. Sono un caso di bordo — un promemoria
 * preso mentre la sessione non era ancora completa — ma un promemoria che
 * esiste sul disco e non compare in nessun elenco e peggio di un promemoria di
 * un collega: nessuno sapra mai che c'era, e all'ora giusta suonera comunque.
 */
function leggi({ utenteId = null, includiFatti = false } = {}) {
  return carica()
    .filter((p) => (utenteId ? p.utenteId === utenteId || !p.utenteId : true))
    .filter((p) => (includiFatti ? true : !p.fatto))
    .sort((a, b) => String(a.quando).localeCompare(String(b.quando)));
}

function aggiungi({ quando, titolo, nota = "", destinazione = null, utenteId = null }) {
  const istante = new Date(quando);
  if (Number.isNaN(istante.getTime())) throw new Error("Data del promemoria non valida.");
  if (!String(titolo || "").trim()) throw new Error("Il promemoria ha bisogno di un testo.");

  const voce = {
    id: crypto.randomUUID(),
    quando: istante.toISOString(),
    titolo: String(titolo).trim().slice(0, 200),
    nota: String(nota || "").trim().slice(0, 1000),
    destinazione,
    utenteId,
    creatoIl: new Date().toISOString(),
    suonato: false,
    fatto: false
  };
  carica().push(voce);
  salva();
  return voce;
}

function segna(id, campi) {
  const voce = carica().find((p) => p.id === id);
  if (!voce) return null;
  Object.assign(voce, campi);
  salva();
  return voce;
}

function elimina(id) {
  elenco = carica().filter((p) => p.id !== id);
  salva();
  return { rimossi: 1 };
}

/**
 * Rinvia di N minuti dall'adesso, non dall'ora originale: chi rimanda alle
 * 9:05 un promemoria delle 9:00 vuole essere richiamato alle 9:15, non alle
 * 9:10.
 */
function rinvia(id, minuti = 10) {
  const quando = new Date(Date.now() + Math.max(1, Number(minuti) || 10) * 60_000);
  return segna(id, { quando: quando.toISOString(), suonato: false, fatto: false });
}

/** Quelli scaduti e non ancora suonati. */
function scaduti(adesso = Date.now()) {
  return carica().filter((p) => !p.fatto && !p.suonato && new Date(p.quando).getTime() <= adesso);
}

function controlla() {
  const dovuti = scaduti();
  if (!dovuti.length) return;

  for (const voce of dovuti) {
    voce.suonato = true;
    if (Notification.isSupported()) {
      const avviso = new Notification({
        title: "Promemoria dello Studio",
        body: voce.titolo,
        silent: false
      });
      // Il promemoria che riguarda una pratica ci porta dentro con un clic:
      // altrimenti si legge l'avviso e si ricomincia a cercare la pratica.
      avviso.on("click", () => avvisa("apri", voce));
      avviso.show();
    }
    avvisa("scaduto", voce);
  }
  salva();
}

/** Parte con l'app e resta acceso: e l'unico modo perche suonino davvero. */
function avvia(alSuono) {
  if (typeof alSuono === "function") avvisa = alSuono;
  carica();
  ferma();
  controlla();
  timer = setInterval(controlla, RITMO);
}

function ferma() {
  clearInterval(timer);
  timer = null;
}

module.exports = { avvia, ferma, leggi, aggiungi, segna, elimina, rinvia, controlla };
