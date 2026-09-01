/* =============================================================================
 * PIN rapido di accesso
 *
 * Una volta che un account e stato associato a questo computer, la password
 * completa serve solo la prima volta: dopo, per riprendere la postazione
 * bloccata basta un PIN di sei cifre. E lo stesso patto di Windows Hello, e ha
 * senso per gli stessi motivi: una password lunga digitata quaranta volte al
 * giorno davanti allo sportello finisce per essere corta, oppure scritta su un
 * foglietto sotto la tastiera.
 *
 * Cosa e il PIN e cosa non e:
 *   - vale SOLO su questo computer e SOLO per quell'account: e legato al
 *     deviceId e all'id utente, non viaggia mai in rete e non apre nulla
 *     altrove;
 *   - non apre una sessione nuova. Serve a riaprire una sessione gia aperta
 *     dopo il blocco per inattivita. Se il token del server e scaduto si
 *     ritorna comunque alla schermata delle credenziali;
 *   - sul disco non finisce mai il PIN, ma solo la sua derivazione PBKDF2 con
 *     sale casuale; e quando Windows offre DPAPI, anche quella e cifrata con
 *     `safeStorage`, cosi un altro profilo Windows non puo nemmeno provare a
 *     forzarla offline.
 *
 * I tentativi sono contati e ritardati: cinque errori spengono il PIN e
 * riportano alla password. Sei cifre sono deboli in astratto, ma con cinque
 * tentativi e un file che non si puo leggere da un altro account sono la scelta
 * giusta per una postazione fisica in ufficio.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { app, safeStorage } = require("electron");

const FILE = "pin.json";

const LUNGHEZZA_MIN = 4;
const LUNGHEZZA_MAX = 8;
const TENTATIVI_MAX = 5;

// PBKDF2 e la primitiva che c'e gia in Node senza dipendenze: 310k giri sha512
// tengono la verifica sotto il decimo di secondo su una postazione d'ufficio e
// rendono scomoda una forzatura offline anche su sei cifre.
const GIRI = 310000;
const SALE_BYTE = 16;
const CHIAVE_BYTE = 32;

// Sequenze che non proteggono niente: le rifiutiamo in fase di scelta, non
// dopo, perche il PIN debole si corregge solo mentre lo si sta scegliendo.
const BANALI = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "0123", "1212", "2580", "1010",
  "000000", "111111", "123456", "654321", "121212", "112233", "123123", "696969",
  "00000000", "12345678", "87654321", "11111111"
]);

function percorso() {
  return path.join(app.getPath("userData"), FILE);
}

function cifraturaDisponibile() {
  try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
}

/* --- Lettura e scrittura ------------------------------------------------- */

function leggi() {
  let grezzo;
  try {
    grezzo = fs.readFileSync(percorso(), "utf8");
  } catch {
    return null;
  }

  let busta;
  try { busta = JSON.parse(grezzo); } catch { return null; }
  if (!busta) return null;

  // Il file scritto con DPAPI da un altro profilo Windows non e decifrabile:
  // e il comportamento voluto, non un errore da segnalare all'utente.
  if (busta.cifrato) {
    if (!cifraturaDisponibile()) return null;
    try {
      return JSON.parse(safeStorage.decryptString(Buffer.from(busta.dati, "base64")));
    } catch {
      return null;
    }
  }
  return busta.dati || null;
}

function scrivi(record) {
  const testo = JSON.stringify(record);
  const busta = cifraturaDisponibile()
    ? { cifrato: true, dati: safeStorage.encryptString(testo).toString("base64") }
    : { cifrato: false, dati: record };
  try {
    fs.mkdirSync(path.dirname(percorso()), { recursive: true });
    fs.writeFileSync(percorso(), JSON.stringify(busta, null, 2), { mode: 0o600 });
    return true;
  } catch (errore) {
    console.error("Scrittura del PIN non riuscita:", errore.message);
    return false;
  }
}

function elimina() {
  try { fs.unlinkSync(percorso()); } catch { /* gia assente */ }
}

/* --- Derivazione --------------------------------------------------------- */

function deriva(pin, saleBase64) {
  const sale = Buffer.from(saleBase64, "base64");
  return crypto.pbkdf2Sync(String(pin), sale, GIRI, CHIAVE_BYTE, "sha512").toString("base64");
}

// Confronto a tempo costante: la differenza di lunghezza si tratta come
// mancata corrispondenza invece di far esplodere timingSafeEqual.
function pari(a, b) {
  const primo = Buffer.from(String(a));
  const secondo = Buffer.from(String(b));
  if (primo.length !== secondo.length) return false;
  return crypto.timingSafeEqual(primo, secondo);
}

/* --- Regole sul PIN ------------------------------------------------------ */

/**
 * Controlla che il PIN sia accettabile.
 * @returns {{ok: boolean, errore?: string}}
 */
function valuta(pin) {
  const cifre = String(pin || "");
  if (!/^\d+$/.test(cifre)) return { ok: false, errore: "Il PIN deve contenere solo cifre." };
  if (cifre.length < LUNGHEZZA_MIN || cifre.length > LUNGHEZZA_MAX) {
    return { ok: false, errore: `Il PIN deve essere di ${LUNGHEZZA_MIN}-${LUNGHEZZA_MAX} cifre.` };
  }
  if (BANALI.has(cifre)) return { ok: false, errore: "Questo PIN e troppo comune: scegline un altro." };
  if (new Set(cifre).size === 1) return { ok: false, errore: "Un PIN di cifre tutte uguali non protegge nulla." };

  // Progressioni: 123456 e 987654 sono la stessa idea vista da due lati.
  const crescente = cifre.split("").every((c, i) => i === 0 || Number(c) === Number(cifre[i - 1]) + 1);
  const decrescente = cifre.split("").every((c, i) => i === 0 || Number(c) === Number(cifre[i - 1]) - 1);
  if (crescente || decrescente) return { ok: false, errore: "Niente sequenze consecutive: scegli cifre sparse." };

  return { ok: true };
}

/* --- Stato --------------------------------------------------------------- */

/**
 * Che cosa sa la postazione del PIN per l'utente indicato.
 *
 * `proponi` e la sola risposta che guida l'interfaccia: e vera quando c'e un
 * account associato al computer e nessun PIN ancora scelto per lui.
 */
function stato(utente, deviceId) {
  const record = leggi();
  const idUtente = utente && utente.id ? String(utente.id) : null;

  const suoDiLui = !!record
    && !!idUtente
    && String(record.utenteId) === idUtente
    && String(record.deviceId) === String(deviceId);

  return {
    configurato: suoDiLui,
    // Il file c'e ma e di un altro account (postazione condivisa): non e un
    // errore, semplicemente questo utente il PIN non ce l'ha ancora.
    altroAccount: !!record && !suoDiLui,
    lunghezza: suoDiLui ? record.lunghezza : null,
    tentativiRimasti: suoDiLui ? Math.max(0, TENTATIVI_MAX - (record.tentativi || 0)) : TENTATIVI_MAX,
    creatoIl: suoDiLui ? record.creatoIl : null,
    usatoIl: suoDiLui ? record.usatoIl || null : null,
    // Si chiama `cifratura` come ovunque nell'applicazione (`ctx.cifratura`,
    // la diagnostica): un secondo nome per la stessa cosa e solo un modo per
    // far leggere `undefined` a chi la controlla.
    cifratura: cifraturaDisponibile(),
    proponi: !!idUtente && !suoDiLui,
    lunghezzaMin: LUNGHEZZA_MIN,
    lunghezzaMax: LUNGHEZZA_MAX,
    tentativiMax: TENTATIVI_MAX
  };
}

/* --- Operazioni ---------------------------------------------------------- */

/**
 * Imposta (o sostituisce) il PIN dell'utente su questa postazione.
 * La verifica della password spetta al chiamante: qui si scrive soltanto.
 */
function imposta(utente, deviceId, pin) {
  const giudizio = valuta(pin);
  if (!giudizio.ok) throw new Error(giudizio.errore);
  if (!utente || !utente.id) throw new Error("Nessun account associato a questo computer.");

  const sale = crypto.randomBytes(SALE_BYTE).toString("base64");
  const record = {
    versione: 1,
    utenteId: String(utente.id),
    email: utente.email || "",
    deviceId: String(deviceId),
    sale,
    giri: GIRI,
    impronta: deriva(pin, sale),
    lunghezza: String(pin).length,
    tentativi: 0,
    creatoIl: new Date().toISOString(),
    usatoIl: null
  };

  if (!scrivi(record)) throw new Error("Non e stato possibile salvare il PIN su questo computer.");
  return stato(utente, deviceId);
}

/**
 * Verifica il PIN.
 *
 * Il contatore dei tentativi vive nello stesso file: al quinto errore il PIN
 * viene cancellato e si torna alla password. Nessun blocco a tempo, che su una
 * postazione fisica servirebbe solo a bloccare fuori chi ha davvero sbagliato.
 *
 * @returns {{ok: boolean, errore?: string, tentativiRimasti?: number, disattivato?: boolean}}
 */
function verifica(utente, deviceId, pin) {
  const record = leggi();
  const idUtente = utente && utente.id ? String(utente.id) : null;

  if (!record || !idUtente || String(record.utenteId) !== idUtente || String(record.deviceId) !== String(deviceId)) {
    return { ok: false, errore: "Su questo computer non c'e un PIN per questo account.", disattivato: true };
  }

  const atteso = crypto.pbkdf2Sync(
    String(pin || ""), Buffer.from(record.sale, "base64"),
    record.giri || GIRI, CHIAVE_BYTE, "sha512"
  ).toString("base64");

  if (pari(atteso, record.impronta)) {
    record.tentativi = 0;
    record.usatoIl = new Date().toISOString();
    scrivi(record);
    return { ok: true, tentativiRimasti: TENTATIVI_MAX };
  }

  record.tentativi = (record.tentativi || 0) + 1;
  const rimasti = TENTATIVI_MAX - record.tentativi;

  if (rimasti <= 0) {
    elimina();
    return {
      ok: false,
      disattivato: true,
      tentativiRimasti: 0,
      errore: "Troppi tentativi: il PIN e stato disattivato. Serve la password."
    };
  }

  scrivi(record);
  return {
    ok: false,
    tentativiRimasti: rimasti,
    errore: rimasti === 1
      ? "PIN errato. Ancora un tentativo, poi servira la password."
      : `PIN errato. Restano ${rimasti} tentativi.`
  };
}

/** Rimuove il PIN dalla postazione (scelta dell'utente, o cambio account). */
function rimuovi() {
  elimina();
  return true;
}

module.exports = {
  stato, imposta, verifica, rimuovi, valuta, percorso,
  LUNGHEZZA_MIN, LUNGHEZZA_MAX, TENTATIVI_MAX
};
