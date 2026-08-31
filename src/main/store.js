/* =============================================================================
 * Stato locale dell'applicazione
 *
 * Due file dentro la cartella dati dell'utente (%APPDATA%\Win Studio Admin):
 *   settings.json   preferenze non riservate (indirizzo del server, filtri
 *                   salvati, ultima vista aperta, dimensioni finestra);
 *   session.json    token di sessione e identificativo del dispositivo.
 *
 * Il token non viene mai scritto in chiaro quando Windows mette a disposizione
 * DPAPI attraverso `safeStorage`: in quel caso sul disco finisce solo il
 * cifrato, leggibile unicamente dall'account Windows che ha fatto l'accesso.
 * Se la cifratura non e disponibile (sessione senza profilo, Windows in stato
 * anomalo) il token resta in memoria per la sessione corrente e non viene
 * scritto affatto: meglio richiedere di nuovo le credenziali che lasciare un
 * token in chiaro sul disco.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { app, safeStorage } = require("electron");

const DEFAULTS = {
  baseUrl: "https://sitoamm.giuliomichelotti820.workers.dev",
  pollSeconds: 45,
  notificheDesktop: true,
  avvioMinimizzato: false,
  densita: "compatta",
  tema: "sistema",
  ultimaVista: "coda",
  filtriSalvati: [],
  finestra: { width: 1440, height: 900, maximized: true }
};

let cartella = null;
let impostazioni = null;
let sessione = { token: null, user: null, deviceId: null, deviceName: null };

function file(nome) {
  if (!cartella) cartella = app.getPath("userData");
  return path.join(cartella, nome);
}

function leggiJson(nome, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(nome), "utf8"));
  } catch {
    return fallback;
  }
}

function scriviJson(nome, valore) {
  try {
    fs.mkdirSync(path.dirname(file(nome)), { recursive: true });
    fs.writeFileSync(file(nome), JSON.stringify(valore, null, 2), { mode: 0o600 });
  } catch (errore) {
    console.error("Scrittura di", nome, "non riuscita:", errore.message);
  }
}

/* --- Impostazioni ------------------------------------------------------- */

function caricaImpostazioni() {
  impostazioni = { ...DEFAULTS, ...leggiJson("settings.json", {}) };
  return impostazioni;
}

function getImpostazioni() {
  return impostazioni || caricaImpostazioni();
}

function setImpostazioni(parziali) {
  impostazioni = { ...getImpostazioni(), ...parziali };
  scriviJson("settings.json", impostazioni);
  return impostazioni;
}

/* --- Dispositivo -------------------------------------------------------- */

// Il Worker lega la sessione "mobile" a un device_id casuale di 32 caratteri
// esadecimali (vedi deviceIdFromRequest in src/worker.js del sito): lo
// generiamo una volta sola alla prima apertura e non cambia piu, altrimenti
// ogni avvio aprirebbe una sessione nuova lasciando indietro quella vecchia.
function getDeviceId() {
  const salvato = leggiJson("device.json", null);
  if (salvato && /^[a-f0-9]{32}$/.test(salvato.deviceId || "")) return salvato.deviceId;
  const deviceId = crypto.randomBytes(16).toString("hex");
  scriviJson("device.json", { deviceId, creato: new Date().toISOString() });
  return deviceId;
}

/* --- Sessione ----------------------------------------------------------- */

function cifraturaDisponibile() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function caricaSessione() {
  const salvata = leggiJson("session.json", null);
  sessione.deviceId = getDeviceId();
  if (!salvata || !salvata.token) return sessione;

  let token = null;
  if (salvata.cifrato && cifraturaDisponibile()) {
    try {
      token = safeStorage.decryptString(Buffer.from(salvata.token, "base64"));
    } catch {
      token = null; // token di un altro profilo Windows o file manomesso
    }
  }

  sessione.token = token;
  sessione.user = token ? salvata.user || null : null;
  return sessione;
}

function salvaSessione(token, user) {
  sessione.token = token;
  sessione.user = user;
  if (!token) {
    try { fs.unlinkSync(file("session.json")); } catch { /* gia assente */ }
    return;
  }
  if (!cifraturaDisponibile()) {
    console.warn("safeStorage non disponibile: il token resta solo in memoria.");
    return;
  }
  scriviJson("session.json", {
    cifrato: true,
    token: safeStorage.encryptString(token).toString("base64"),
    user,
    salvataIl: new Date().toISOString()
  });
}

function getSessione() {
  if (!sessione.deviceId) caricaSessione();
  return sessione;
}

module.exports = {
  DEFAULTS,
  caricaImpostazioni,
  getImpostazioni,
  setImpostazioni,
  caricaSessione,
  salvaSessione,
  getSessione,
  getDeviceId,
  cifraturaDisponibile
};
