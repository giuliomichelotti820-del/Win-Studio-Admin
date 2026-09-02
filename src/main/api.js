/* =============================================================================
 * Ponte verso le API del sito (Cloudflare Worker)
 *
 * L'app usa lo stesso account, la stessa tabella `sessions` e le stesse rotte
 * dell'area riservata: cambia solo il mezzo di trasporto. Il Worker prevede
 * gia un client non-browser (`client: "mobile"`), che porta il token in
 * `Authorization: Bearer` e dichiara un `X-Device-Id`: e la strada che segue
 * anche il desktop.
 *
 * Due vincoli del server governano il codice qui sotto:
 *   1. la sessione e legata all'hash dello User-Agent -> l'intestazione deve
 *      restare identica a ogni richiesta, per tutta la vita del token;
 *   2. le operazioni di modifica riservate allo staff vogliono un token CSRF
 *      monouso nel corpo JSON -> lo chiediamo appena prima, e ricordiamo quali
 *      rotte lo pretendono per non sprecare un giro di rete su quelle che non
 *      lo usano.
 *
 * Tutte le chiamate partono dal processo principale: il renderer non vede mai
 * il token e non ha accesso alla rete.
 * ========================================================================== */

const { app } = require("electron");
const store = require("./store");

const USER_AGENT = `WinStudioAdmin/${app.getVersion?.() || "1.0.0"} (Windows Desktop)`;

// Rotte che il Worker protegge con CSRF. L'elenco parte da quelle note e si
// completa da solo: al primo 403 "CSRF" la richiesta viene ripetuta con il
// token e la rotta resta segnata per le volte successive.
const RICHIEDONO_CSRF = new Set([
  "PATCH /api/tickets/:id",
  "PATCH /api/condomini/:id/morosita",
  "PATCH /api/condomini/:id/utenti/:id/morosita",
  "POST /api/staff/alerts",
  "POST /api/suppliers",
  "PATCH /api/suppliers/:id",
  "DELETE /api/suppliers/:id",
  "POST /api/admin/employees",
  "PATCH /api/admin/employees/:id",
  "PUT /api/admin/condomini/:id/staff",
  "POST /api/admin/email-send",
  "POST /api/admin/email-test",
  "POST /api/admin/email-invite-client",
  "POST /api/admin/inbound-poll",
  "POST /api/admin/inbound-simulate",
  "POST /api/admin/inbound-open",
  "POST /api/admin/whatsapp/send",
  "POST /api/admin/whatsapp/simulate",
  "PATCH /api/admin/whatsapp/contact",
  "POST /api/admin/whatsapp/open-ticket",
  "PUT /api/account/anagrafica"
]);

class ApiError extends Error {
  constructor(messaggio, stato, dati) {
    super(messaggio);
    this.name = "ApiError";
    this.status = stato;
    this.data = dati;
  }
}

function baseUrl() {
  return String(store.getImpostazioni().baseUrl || "").replace(/\/+$/, "");
}

// Firma della rotta indipendente dagli identificatori, per l'elenco CSRF.
function firma(metodo, percorso) {
  return `${metodo} ${percorso.split("?")[0].replace(/\/\d+/g, "/:id")}`;
}

function intestazioni(extra = {}) {
  const sessione = store.getSessione();
  const headers = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    ...extra
  };
  if (sessione.token) headers.Authorization = `Bearer ${sessione.token}`;
  if (sessione.deviceId) headers["X-Device-Id"] = sessione.deviceId;
  return headers;
}

async function leggiCorpo(risposta) {
  const tipo = risposta.headers.get("content-type") || "";
  if (tipo.includes("application/json")) {
    try { return await risposta.json(); } catch { return null; }
  }
  try { return await risposta.text(); } catch { return null; }
}

async function chiamata(metodo, percorso, opzioni = {}) {
  const url = `${baseUrl()}${percorso}`;
  const init = { method: metodo, headers: intestazioni(opzioni.headers) };

  const controller = new AbortController();
  const scadenza = setTimeout(() => controller.abort(), opzioni.timeoutMs || 25000);
  init.signal = controller.signal;

  if (opzioni.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opzioni.body);
  }

  let risposta;
  try {
    risposta = await fetch(url, init);
  } catch (errore) {
    clearTimeout(scadenza);
    if (errore.name === "AbortError") throw new ApiError("Il server non ha risposto in tempo.", 0);
    throw new ApiError("Server non raggiungibile. Controlla la connessione.", 0);
  }
  clearTimeout(scadenza);

  const dati = await leggiCorpo(risposta);
  if (risposta.ok) return dati;

  const messaggio = (dati && (dati.error || dati.message)) || `Errore ${risposta.status}.`;
  throw new ApiError(messaggio, risposta.status, dati);
}

async function tokenCsrf() {
  const dati = await chiamata("GET", "/api/auth/csrf");
  return dati && dati.csrfToken;
}

/**
 * Richiesta autenticata con gestione automatica del token CSRF: se la rotta e
 * gia nota come protetta lo allega subito, altrimenti prova senza e ripete una
 * volta sola quando il server risponde 403 per CSRF mancante.
 */
async function richiesta(metodo, percorso, corpo, opzioni = {}) {
  const chiave = firma(metodo, percorso);
  const modifica = metodo !== "GET" && metodo !== "HEAD";
  let payload = corpo;

  if (modifica && RICHIEDONO_CSRF.has(chiave)) {
    payload = { ...(corpo || {}), csrfToken: await tokenCsrf() };
  }

  try {
    return await chiamata(metodo, percorso, { ...opzioni, body: modifica ? payload || {} : undefined });
  } catch (errore) {
    const csrfMancante = errore.status === 403 && /csrf/i.test(errore.message || "");
    if (modifica && csrfMancante && !RICHIEDONO_CSRF.has(chiave)) {
      RICHIEDONO_CSRF.add(chiave);
      const conToken = { ...(corpo || {}), csrfToken: await tokenCsrf() };
      return chiamata(metodo, percorso, { ...opzioni, body: conToken });
    }
    throw errore;
  }
}

/* --- Autenticazione ----------------------------------------------------- */

function nomeDispositivo() {
  return `${require("node:os").hostname()} (Windows)`;
}

/**
 * Accesso.
 *
 * L'app si dichiara `client: "desktop"` e allega la chiave dell'applicazione:
 * se il Worker ha lo stesso segreto in DESKTOP_APP_KEY risponde subito con il
 * token, senza il codice a sei cifre. Altrimenti — chiave non configurata da
 * una delle due parti, oppure account condomino — risponde `otpRequired` e si
 * prosegue come sul sito. La differenza la decide il server: qui si chiede e
 * basta, e si e pronti a entrambe le risposte.
 */
async function login(email, password) {
  const sessione = store.getSessione();
  const chiave = String(store.getImpostazioni().chiaveApp || "");

  const dati = await chiamata("POST", "/api/auth/login", {
    headers: chiave ? { "X-App-Key": chiave } : {},
    body: {
      email,
      password,
      client: "desktop",
      deviceId: sessione.deviceId,
      deviceName: nomeDispositivo()
    }
  });

  // Accesso diretto concesso: la sessione e gia aperta, non c'e nessun codice
  // da chiedere a chi sta davanti allo schermo.
  if (dati && dati.token) {
    store.salvaSessione(dati.token, { id: dati.id, email: dati.email, fullName: dati.fullName, role: dati.role });
  }
  return dati;
}

async function verificaOtp(ticket, codice) {
  const sessione = store.getSessione();
  const dati = await chiamata("POST", "/api/auth/verify-otp", {
    body: {
      ticket,
      code: codice,
      client: "desktop",
      deviceId: sessione.deviceId,
      deviceName: nomeDispositivo()
    }
  });
  if (!dati || !dati.token) throw new ApiError("Il server non ha restituito un token di sessione.", 500);
  store.salvaSessione(dati.token, {
    id: dati.id, email: dati.email, fullName: dati.fullName, role: dati.role
  });
  return dati;
}

async function reinviaOtp(ticket) {
  return chiamata("POST", "/api/auth/resend-otp", { body: { ticket } });
}

async function logout() {
  try { await chiamata("POST", "/api/auth/logout", { body: {} }); } catch { /* la sessione locale va comunque chiusa */ }
  store.salvaSessione(null, null);
}

async function me() {
  return chiamata("GET", "/api/auth/me");
}

/* --- Risposte non JSON ---------------------------------------------------
 * Allegati da scaricare e documenti da caricare: il corpo non e JSON, quindi
 * non passa da `chiamata`, ma tutto il resto deve restare identico. Prima
 * queste due strade si ricostruivano a mano l'indirizzo, lo User-Agent e le
 * intestazioni di sessione — e siccome la sessione del Worker e legata
 * all'hash dello User-Agent, bastava una divergenza fra qui e li per far
 * scadere il token a meta scaricamento senza che nessuno capisse perche.
 * ---------------------------------------------------------------------- */

/**
 * Come `chiamata`, ma restituisce la Response grezza.
 * @returns {Promise<Response>}
 */
async function grezza(metodo, percorso, { body, headers, timeoutMs = 120000 } = {}) {
  const controller = new AbortController();
  const scadenza = setTimeout(() => controller.abort(), timeoutMs);
  let risposta;
  try {
    risposta = await fetch(`${baseUrl()}${percorso}`, {
      method: metodo,
      headers: intestazioni(headers),
      body,
      signal: controller.signal
    });
  } catch (errore) {
    clearTimeout(scadenza);
    if (errore.name === "AbortError") throw new ApiError("Il server non ha risposto in tempo.", 0);
    throw new ApiError("Server non raggiungibile. Controlla la connessione.", 0);
  }
  clearTimeout(scadenza);

  if (!risposta.ok) {
    const dati = await leggiCorpo(risposta);
    const messaggio = (dati && (dati.error || dati.message)) || `Errore ${risposta.status}.`;
    throw new ApiError(messaggio, risposta.status, dati);
  }
  return risposta;
}

module.exports = { ApiError, richiesta, chiamata, grezza, login, verificaOtp, reinviaOtp, logout, me, USER_AGENT };
