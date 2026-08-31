/* =============================================================================
 * Esportazione degli elenchi
 *
 * Ogni tabella dell'app deve poter finire in Excel: e la richiesta che arriva
 * ogni volta che c'e da preparare un consiglio, una riunione o un sollecito.
 * Le viste descrivono le colonne una volta sola e chiamano `esportaCsv`.
 * ========================================================================== */

import { toast } from "./ui.js";

/** Una cella CSV secondo RFC 4180: virgolette raddoppiate, campo quotato. */
function cella(valore) {
  if (valore === null || valore === undefined) return "";
  const testo = String(valore).replace(/\r?\n/g, " ").trim();
  return /[";,\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

/**
 * Costruisce il testo CSV.
 * @param {Array<object>} righe
 * @param {Array<{titolo: string, valore: (riga: object) => any}>} colonne
 */
export function testoCsv(righe, colonne) {
  // Punto e virgola: e il separatore che Excel italiano si aspetta.
  const intestazione = colonne.map((c) => cella(c.titolo)).join(";");
  const corpo = righe.map((riga) => colonne.map((c) => cella(c.valore(riga))).join(";"));
  return [intestazione, ...corpo].join("\r\n");
}

function nomeConData(base) {
  const adesso = new Date();
  const parte = (n) => String(n).padStart(2, "0");
  const stampo = `${adesso.getFullYear()}${parte(adesso.getMonth() + 1)}${parte(adesso.getDate())}-${parte(adesso.getHours())}${parte(adesso.getMinutes())}`;
  return `${base}-${stampo}.csv`;
}

/**
 * Chiede dove salvare e scrive il CSV. Restituisce il percorso, oppure null se
 * la finestra di salvataggio e stata annullata.
 */
export async function esportaCsv(nomeBase, righe, colonne) {
  if (!righe.length) {
    toast("Non c'e niente da esportare con questi filtri.", "avviso");
    return null;
  }

  const esito = await window.studio.salvaTesto(
    nomeConData(nomeBase),
    testoCsv(righe, colonne),
    "Esporta in CSV"
  );

  if (!esito.ok) {
    toast(esito.errore, "errore");
    return null;
  }
  if (!esito.dati) return null; // annullato dall'utente

  toast(`${righe.length} righe esportate.`, "ok");
  return esito.dati;
}

/** Come sopra, ma per un oggetto qualunque salvato in JSON leggibile. */
export async function esportaJson(nomeFile, dati, titolo = "Esporta") {
  const esito = await window.studio.salvaTesto(nomeFile, JSON.stringify(dati, null, 2), titolo);
  if (!esito.ok) {
    toast(esito.errore, "errore");
    return null;
  }
  if (esito.dati) toast("File salvato.", "ok");
  return esito.dati;
}
