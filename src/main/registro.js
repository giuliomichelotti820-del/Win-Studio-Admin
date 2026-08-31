/* =============================================================================
 * Registro locale delle attivita
 *
 * Traccia cosa e stato fatto da questa postazione: accessi, cambi di stato,
 * assegnazioni, esportazioni, revoche. E un registro *locale*, complementare
 * a quello del server: risponde alla domanda "cosa e stato fatto da questo
 * computer", che il server non puo sapere quando la rete e caduta.
 *
 * Formato JSONL, una riga per voce: si apre con qualunque editor, si taglia
 * senza riscrivere il file e non si corrompe se l'app viene chiusa a meta
 * scrittura. Il file ruota da solo per non crescere all'infinito.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const NOME = "registro-attivita.jsonl";
const MAX_BYTE = 2 * 1024 * 1024;   // oltre i 2 MB si ruota
const MAX_VOCI = 5000;              // e si tengono le ultime 5000 righe

function percorso() {
  return path.join(app.getPath("userData"), NOME);
}

/**
 * Aggiunge una voce. Non lancia mai: un registro che rompe l'operazione che
 * doveva annotare sarebbe peggio di un registro incompleto.
 */
function annota(voce) {
  try {
    const riga = JSON.stringify({
      quando: new Date().toISOString(),
      azione: String(voce.azione || "sconosciuta"),
      oggetto: voce.oggetto === undefined ? null : voce.oggetto,
      dettaglio: voce.dettaglio === undefined ? null : voce.dettaglio,
      utente: voce.utente || null,
      esito: voce.esito || "ok"
    });
    fs.appendFileSync(percorso(), `${riga}\n`, { mode: 0o600 });
    ruota();
    return true;
  } catch (errore) {
    console.error("Registro non scritto:", errore.message);
    return false;
  }
}

function ruota() {
  try {
    const dimensione = fs.statSync(percorso()).size;
    if (dimensione < MAX_BYTE) return;
    const righe = fs.readFileSync(percorso(), "utf8").split("\n").filter(Boolean);
    fs.writeFileSync(percorso(), `${righe.slice(-MAX_VOCI).join("\n")}\n`, { mode: 0o600 });
  } catch { /* il file non esiste ancora, o e in uso: si riprova al prossimo giro */ }
}

/** Le voci piu recenti, gia ordinate dalla piu nuova alla piu vecchia. */
function leggi({ limite = 500, azione = "", da = null } = {}) {
  let righe = [];
  try {
    righe = fs.readFileSync(percorso(), "utf8").split("\n").filter(Boolean);
  } catch {
    return { voci: [], totale: 0, percorso: percorso() };
  }

  const voci = [];
  for (let i = righe.length - 1; i >= 0; i -= 1) {
    let voce = null;
    try { voce = JSON.parse(righe[i]); } catch { continue; }
    if (azione && voce.azione !== azione) continue;
    if (da && voce.quando < da) continue;
    voci.push(voce);
    if (voci.length >= limite) break;
  }
  return { voci, totale: righe.length, percorso: percorso() };
}

function svuota() {
  try { fs.unlinkSync(percorso()); } catch { /* gia assente */ }
  return true;
}

module.exports = { annota, leggi, svuota, percorso };
