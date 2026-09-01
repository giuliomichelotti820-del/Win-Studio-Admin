/* =============================================================================
 * Copie di sicurezza dei dati della postazione
 *
 * Una parte di quello che l'app conserva non sta sul server e non sta da
 * nessun'altra parte: le schede di condominio e di condomino, i file che ci
 * sono attaccati, le viste salvate della coda, il registro locale. Se il disco
 * si rompe o il profilo Windows viene rifatto, quella roba non torna piu.
 *
 * Da qui una copia e una cartella, non un archivio compresso: si apre con
 * Esplora file, si legge con il Blocco note, si copia su una chiavetta a mano.
 * Un formato che richiede questo programma per essere riletto e esattamente il
 * formato sbagliato per una copia di sicurezza.
 *
 * Che cosa NON entra mai in una copia:
 *   - il token di sessione (session.json), che vale solo su questo profilo
 *     Windows e che rimetterlo altrove significherebbe clonare una sessione;
 *   - la derivazione del PIN (pin.json), legata a questo dispositivo;
 *   - la chiave dell'applicazione (`chiaveApp`), che e un segreto del Worker.
 * Una copia si porta in giro; queste tre cose no.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const CARTELLA = "copie";
const MANIFESTO = "copia.json";

// I file che compongono una copia. Chi ne aggiunge uno lo aggiunge qui, e la
// copia, il ripristino e la scheda in Impostazioni restano allineati da soli.
const CONTENUTO = [
  { nome: "archivio.json", tipo: "file", descrizione: "Schede di condominio e di condomino" },
  { nome: "archivio-file", tipo: "cartella", descrizione: "File allegati alle schede" },
  { nome: "registro-attivita.jsonl", tipo: "file", descrizione: "Registro locale delle attivita" },
  { nome: "promemoria.json", tipo: "file", descrizione: "Promemoria presi su questa postazione" }
];

// Dalle impostazioni si copia tutto tranne i segreti e cio che descrive
// *questo* computer e non avrebbe senso altrove.
const IMPOSTAZIONI_ESCLUSE = ["chiaveApp", "ultimaEmail", "finestra"];

function dati() {
  return app.getPath("userData");
}

function radiceCopie() {
  const percorso = path.join(dati(), CARTELLA);
  fs.mkdirSync(percorso, { recursive: true });
  return percorso;
}

function etichetta(istante = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${istante.getFullYear()}-${p(istante.getMonth() + 1)}-${p(istante.getDate())}`
    + `_${p(istante.getHours())}${p(istante.getMinutes())}`;
}

function pesoDi(percorso) {
  try {
    const info = fs.statSync(percorso);
    if (info.isFile()) return info.size;
    return fs.readdirSync(percorso).reduce((somma, n) => somma + pesoDi(path.join(percorso, n)), 0);
  } catch {
    return 0;
  }
}

function copiaVoce(origine, destinazione) {
  if (!fs.existsSync(origine)) return false;
  fs.cpSync(origine, destinazione, { recursive: true });
  return true;
}

/* --- Creazione ----------------------------------------------------------- */

/**
 * Crea una copia. `destinazione` permette di scriverla fuori dalla cartella
 * dati — su una chiavetta, su una cartella di rete — che e l'unico posto in cui
 * una copia serve davvero quando il disco si rompe.
 */
function crea({ motivo = "manuale", versione = "", destinazione = null } = {}) {
  const nome = `copia_${etichetta()}`;
  const cartella = path.join(destinazione || radiceCopie(), nome);
  fs.mkdirSync(cartella, { recursive: true });

  const dentro = [];
  for (const voce of CONTENUTO) {
    const origine = path.join(dati(), voce.nome);
    if (copiaVoce(origine, path.join(cartella, voce.nome))) {
      dentro.push({ ...voce, peso: pesoDi(origine) });
    }
  }

  // Le impostazioni si riscrivono ripulite, non si copiano: il file originale
  // contiene la chiave dell'applicazione.
  try {
    const lette = JSON.parse(fs.readFileSync(path.join(dati(), "settings.json"), "utf8"));
    for (const chiave of IMPOSTAZIONI_ESCLUSE) delete lette[chiave];
    fs.writeFileSync(path.join(cartella, "settings.json"), JSON.stringify(lette, null, 2));
    dentro.push({ nome: "settings.json", tipo: "file", descrizione: "Impostazioni della postazione (senza segreti)", peso: pesoDi(path.join(cartella, "settings.json")) });
  } catch { /* prima apertura: non c'e ancora niente da copiare */ }

  const manifesto = {
    creataIl: new Date().toISOString(),
    motivo,
    versione,
    contenuto: dentro,
    peso: dentro.reduce((s, v) => s + (v.peso || 0), 0),
    avvertenza: "Copia dei soli dati locali. Non contiene la sessione, il PIN ne la chiave dell'applicazione."
  };
  fs.writeFileSync(path.join(cartella, MANIFESTO), JSON.stringify(manifesto, null, 2));

  return { nome, percorso: cartella, ...manifesto };
}

/* --- Elenco e pulizia ----------------------------------------------------- */

function elenco() {
  let nomi = [];
  try { nomi = fs.readdirSync(radiceCopie()); } catch { return []; }

  return nomi
    .map((nome) => {
      const cartella = path.join(radiceCopie(), nome);
      try {
        if (!fs.statSync(cartella).isDirectory()) return null;
        const manifesto = JSON.parse(fs.readFileSync(path.join(cartella, MANIFESTO), "utf8"));
        return { nome, percorso: cartella, ...manifesto };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.creataIl).localeCompare(String(a.creataIl)));
}

/** Tiene le piu recenti e butta il resto: una copia di due anni fa non serve. */
function pota(quante = 10) {
  const vecchie = elenco().slice(Math.max(1, quante));
  for (const copia of vecchie) {
    try { fs.rmSync(copia.percorso, { recursive: true, force: true }); } catch { /* gia sparita */ }
  }
  return vecchie.length;
}

function rimuovi(nome) {
  const cartella = path.join(radiceCopie(), path.basename(nome));
  if (!cartella.startsWith(radiceCopie())) throw new Error("Percorso non ammesso.");
  fs.rmSync(cartella, { recursive: true, force: true });
  return { rimossa: nome };
}

/* --- Copia automatica ----------------------------------------------------- */

/**
 * Una copia al giorno, alla prima apertura utile. Non a orario fisso: l'app di
 * uno Studio non e accesa alle tre di notte, e una copia programmata che non
 * parte mai e una copia che non esiste.
 */
function copiaAutomaticaSeServe({ attiva = true, ogniGiorni = 1, quante = 10, versione = "" } = {}) {
  if (!attiva) return null;
  const ultima = elenco()[0];
  if (ultima) {
    const distanza = Date.now() - new Date(ultima.creataIl).getTime();
    if (distanza < Math.max(1, ogniGiorni) * 86_400_000) return null;
  }
  const fatta = crea({ motivo: "automatica", versione });
  pota(quante);
  return fatta;
}

/* --- Ripristino ----------------------------------------------------------- */

/**
 * Rimette al loro posto i file di una copia. Prima di toccare qualsiasi cosa
 * fa una copia dello stato attuale: un ripristino sbagliato deve restare
 * annullabile, altrimenti e solo un secondo modo di perdere i dati.
 *
 * Le impostazioni si fondono con quelle correnti invece di sostituirle, cosi
 * il ripristino non riporta indietro l'indirizzo del server ne cancella la
 * chiave dell'applicazione di questa postazione.
 */
function ripristina(percorsoCopia, { versione = "" } = {}) {
  const cartella = path.resolve(percorsoCopia);
  if (!fs.existsSync(path.join(cartella, MANIFESTO))) {
    throw new Error("Questa cartella non e una copia di Win Studio Admin.");
  }

  const rete = crea({ motivo: "prima-del-ripristino", versione });
  const rimessi = [];

  for (const voce of CONTENUTO) {
    const origine = path.join(cartella, voce.nome);
    if (!fs.existsSync(origine)) continue;
    const destinazione = path.join(dati(), voce.nome);
    try { fs.rmSync(destinazione, { recursive: true, force: true }); } catch { /* non c'era */ }
    fs.cpSync(origine, destinazione, { recursive: true });
    rimessi.push(voce.nome);
  }

  let impostazioni = null;
  try {
    const dalla = JSON.parse(fs.readFileSync(path.join(cartella, "settings.json"), "utf8"));
    for (const chiave of IMPOSTAZIONI_ESCLUSE) delete dalla[chiave];
    impostazioni = dalla;
    rimessi.push("settings.json");
  } catch { /* copia senza impostazioni */ }

  return { rimessi, impostazioni, retePrimaDel: rete.percorso };
}

module.exports = {
  CONTENUTO, crea, elenco, pota, rimuovi, ripristina, copiaAutomaticaSeServe, radiceCopie
};
