/* =============================================================================
 * Archivio locale delle schede
 *
 * Il server dello Studio conserva i documenti del condominio (bucket R2,
 * rotta /api/documents) ma non ha un posto dove tenere la scheda di dettaglio
 * di un singolo condomino: unita immobiliare, millesimi, recapiti alternativi,
 * note di gestione, copie di visure e contratti. Quelle informazioni vivono
 * qui, sul computer dello Studio, in un archivio locale:
 *
 *   archivio.json         schede (condominio e condomino) in formato leggibile
 *   archivio-file/        copia dei file allegati alle schede
 *
 * E una scelta esplicita e va conosciuta: quanto sta qui non viene sincronizzato
 * con il sito e non e visibile agli altri computer. I documenti che devono
 * essere condivisi (verbali, rendiconti, regolamenti) vanno caricati sul
 * server dalla stessa schermata, non lasciati nell'archivio locale.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { app } = require("electron");

function cartella() {
  return app.getPath("userData");
}

function fileArchivio() {
  return path.join(cartella(), "archivio.json");
}

function cartellaFile() {
  const percorso = path.join(cartella(), "archivio-file");
  fs.mkdirSync(percorso, { recursive: true });
  return percorso;
}

const VUOTO = { condomini: {}, persone: {}, versione: 1 };

function leggi() {
  try {
    const dati = JSON.parse(fs.readFileSync(fileArchivio(), "utf8"));
    return { ...VUOTO, ...dati, condomini: dati.condomini || {}, persone: dati.persone || {} };
  } catch {
    return { ...VUOTO };
  }
}

function scrivi(archivio) {
  fs.writeFileSync(fileArchivio(), JSON.stringify(archivio, null, 2), { mode: 0o600 });
  return archivio;
}

/** Scheda di un condominio o di una persona, con i valori gia normalizzati. */
function scheda(tipo, chiave) {
  const archivio = leggi();
  const insieme = tipo === "persona" ? archivio.persone : archivio.condomini;
  return insieme[String(chiave)] || { campi: {}, note: "", allegati: [], aggiornato: null };
}

function salvaScheda(tipo, chiave, { campi, note }) {
  const archivio = leggi();
  const insieme = tipo === "persona" ? archivio.persone : archivio.condomini;
  const precedente = insieme[String(chiave)] || { allegati: [] };
  insieme[String(chiave)] = {
    ...precedente,
    campi: campi || {},
    note: note || "",
    allegati: precedente.allegati || [],
    aggiornato: new Date().toISOString()
  };
  scrivi(archivio);
  return insieme[String(chiave)];
}

/** Copia un file dentro l'archivio: l'originale puo essere spostato o perso. */
function allega(tipo, chiave, percorsoOrigine) {
  const archivio = leggi();
  const insieme = tipo === "persona" ? archivio.persone : archivio.condomini;
  const corrente = insieme[String(chiave)] || { campi: {}, note: "", allegati: [] };

  const id = crypto.randomUUID();
  const estensione = path.extname(percorsoOrigine);
  const destinazione = path.join(cartellaFile(), `${id}${estensione}`);
  fs.copyFileSync(percorsoOrigine, destinazione);

  const voce = {
    id,
    nome: path.basename(percorsoOrigine),
    percorso: destinazione,
    dimensione: fs.statSync(destinazione).size,
    aggiunto: new Date().toISOString()
  };

  corrente.allegati = [...(corrente.allegati || []), voce];
  insieme[String(chiave)] = corrente;
  scrivi(archivio);
  return voce;
}

function rimuoviAllegato(tipo, chiave, id) {
  const archivio = leggi();
  const insieme = tipo === "persona" ? archivio.persone : archivio.condomini;
  const corrente = insieme[String(chiave)];
  if (!corrente) return false;
  const voce = (corrente.allegati || []).find((a) => a.id === id);
  if (voce) {
    try { fs.unlinkSync(voce.percorso); } catch { /* file gia rimosso a mano */ }
  }
  corrente.allegati = (corrente.allegati || []).filter((a) => a.id !== id);
  scrivi(archivio);
  return true;
}

module.exports = { scheda, salvaScheda, allega, rimuoviAllegato, leggi, cartella: cartellaFile };
