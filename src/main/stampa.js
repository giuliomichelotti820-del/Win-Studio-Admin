/* =============================================================================
 * Stampa di una pratica su carta intestata
 *
 * Una segnalazione finisce spesso fuori dallo schermo: allegata a un preventivo,
 * portata in assemblea, spedita a un legale. Finche l'unico modo era la stampa
 * della finestra, quello che usciva era una schermata di gestionale con la
 * barra laterale — non un documento dello Studio.
 *
 * Qui il documento si costruisce a parte: carta intestata con il marchio
 * ufficiale, dati della pratica, conversazione e storico, numero di pagina.
 *
 * Sicurezza: l'HTML lo compone il processo principale, mai il renderer. Il
 * renderer manda *dati*; ogni valore passa da `testo()` prima di finire nella
 * pagina, cosi l'oggetto di una segnalazione scritto da un condomino non puo
 * diventare markup. La finestra di stampa nasce senza preload, senza Node e
 * senza rete (`offscreen`), quindi non ha niente da cui attingere.
 * ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const { BrowserWindow, dialog, shell, app } = require("electron");

const NOME_STUDIO = "Studio Associato Amm. Burchielli";
const CLAIM = "Gestioni immobiliari e patrimoniali · dal 1970";

/** Ogni valore che entra nella pagina passa di qui. Nessuna eccezione. */
function testo(valore) {
  return String(valore === null || valore === undefined ? "" : valore)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragrafi(valore) {
  return String(valore || "")
    .split(/\n{2,}/)
    .map((blocco) => `<p>${testo(blocco).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function marchioSvg() {
  // Lo stesso tracciato del marchio ufficiale, in linea: un <img> verso il
  // disco costringerebbe la finestra di stampa ad avere accesso ai file.
  return `<svg viewBox="0 0 100 100" width="52" height="52" aria-hidden="true">
    <defs>
      <linearGradient id="v" x1="10" y1="0" x2="90" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#2E7A50"/><stop offset="45%" stop-color="#F4F8F6"/>
        <stop offset="50%" stop-color="#FFFFFF"/><stop offset="55%" stop-color="#F4F8F6"/>
        <stop offset="100%" stop-color="#2E7A50"/>
      </linearGradient>
      <linearGradient id="a" x1="0" y1="63" x2="0" y2="99" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#E8843D"/>
      </linearGradient>
    </defs>
    <polyline points="10,85 50,12 90,85" fill="none" stroke="url(#v)" stroke-width="24"/>
    <polyline points="34,80 50,48 66,80" fill="none" stroke="#0B2341" stroke-width="15"/>
    <circle cx="50" cy="82" r="17" fill="url(#a)"/>
  </svg>`;
}

function riga(etichetta, valore) {
  if (valore === null || valore === undefined || valore === "") return "";
  return `<div class="riga"><dt>${testo(etichetta)}</dt><dd>${testo(valore)}</dd></div>`;
}

/**
 * Compone il documento.
 *
 * `dati` e quello che la scheda della pratica ha gia a schermo: nessuna
 * chiamata di rete in piu, e cio che si stampa e esattamente cio che si vede.
 */
function documento(dati = {}) {
  const oggi = new Date().toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
  const messaggi = [].concat(dati.messaggi || []);
  const storico = [].concat(dati.storico || []);

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${testo(dati.numero || "Segnalazione")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #11202f; margin: 0; }
  header.carta { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0B2341; padding-bottom: 10px; margin-bottom: 18px; }
  .intestazione strong { display: block; font-size: 13pt; letter-spacing: .04em; color: #0B2341; font-style: italic; }
  .intestazione span { color: #56657a; font-size: 8.5pt; font-style: italic; }
  .protocollo { margin-left: auto; text-align: right; font-size: 8.5pt; color: #56657a; }
  h1 { font-size: 15pt; margin: 0 0 2px; color: #0B2341; }
  .sommario { color: #56657a; font-size: 9pt; margin: 0 0 16px; }
  h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .12em; color: #E8843D;
       border-bottom: 1px solid #dfe5ee; padding-bottom: 4px; margin: 22px 0 10px; }
  dl { margin: 0; }
  .riga { display: flex; gap: 10px; padding: 3px 0; border-bottom: 1px dotted #e6ebf2; }
  dt { flex: 0 0 34%; color: #56657a; margin: 0; }
  dd { flex: 1; margin: 0; font-weight: 500; }
  .testo p { margin: 0 0 8px; }
  .messaggio { border-left: 3px solid #dfe5ee; padding: 5px 0 5px 11px; margin: 0 0 11px; break-inside: avoid; }
  .messaggio.staff { border-left-color: #2E7A50; }
  .messaggio.interno { border-left-color: #E8843D; background: #fdf6f0; }
  .messaggio .chi { font-size: 8.5pt; color: #56657a; margin-bottom: 3px; }
  .messaggio .chi b { color: #11202f; }
  ol.storico { margin: 0; padding-left: 18px; font-size: 9.5pt; }
  ol.storico li { margin-bottom: 3px; }
  footer.carta { margin-top: 26px; padding-top: 8px; border-top: 1px solid #dfe5ee;
                 font-size: 7.5pt; color: #7a879a; display: flex; gap: 12px; }
  footer.carta span:last-child { margin-left: auto; }
</style></head>
<body>
  <header class="carta">
    ${marchioSvg()}
    <div class="intestazione">
      <strong>AMM. BURCHIELLI</strong>
      <span>${testo(CLAIM)}</span>
    </div>
    <div class="protocollo">
      <div>Estratto del ${testo(oggi)}</div>
      <div>${testo(dati.numero || "")}</div>
    </div>
  </header>

  <h1>${testo(dati.oggetto || "Segnalazione")}</h1>
  <p class="sommario">${testo(dati.numero || "")}${dati.condominio ? " · " + testo(dati.condominio) : ""}</p>

  <h2>Dati della pratica</h2>
  <dl>
    ${riga("Stato", dati.stato)}
    ${riga("Priorita", dati.priorita)}
    ${riga("Canale di arrivo", dati.canale)}
    ${riga("Condominio", dati.condominio)}
    ${riga("Richiedente", dati.richiedente)}
    ${riga("Recapito", dati.recapito)}
    ${riga("Assegnata a", dati.assegnatario)}
    ${riga("Fornitore", dati.fornitore)}
    ${riga("Aperta il", dati.aperta)}
    ${riga("Ultimo aggiornamento", dati.aggiornata)}
  </dl>

  ${dati.descrizione ? `<h2>Segnalazione</h2><div class="testo">${paragrafi(dati.descrizione)}</div>` : ""}

  ${messaggi.length ? `<h2>Conversazione</h2>${messaggi.map((m) => `
    <div class="messaggio ${m.interno ? "interno" : m.staff ? "staff" : ""}">
      <div class="chi"><b>${testo(m.autore || "—")}</b> · ${testo(m.quando || "")}${m.interno ? " · nota interna" : ""}</div>
      <div class="testo">${paragrafi(m.testo)}</div>
    </div>`).join("")}` : ""}

  ${storico.length ? `<h2>Storico</h2><ol class="storico">${storico
    .map((v) => `<li>${testo(v.quando || "")} — ${testo(v.descrizione || "")}${v.chi ? " (" + testo(v.chi) + ")" : ""}</li>`)
    .join("")}</ol>` : ""}

  <footer class="carta">
    <span>${testo(NOME_STUDIO)}</span>
    <span>Documento a uso interno · estratto da Win Studio Admin${dati.versione ? " v" + testo(dati.versione) : ""}</span>
  </footer>
</body></html>`;
}

/**
 * Genera il PDF e chiede dove salvarlo.
 *
 * L'HTML passa da un file temporaneo nella cartella dati: `loadURL` con un
 * data: URI ha un limite di lunghezza che una conversazione lunga supera senza
 * fatica, e il troncamento sarebbe silenzioso.
 */
async function pratica(genitore, dati = {}) {
  const nomeProposto = `${String(dati.numero || "segnalazione").replace(/[^\w.-]+/g, "-")}.pdf`;

  const scelta = await dialog.showSaveDialog(genitore, {
    title: "Salva la pratica in PDF",
    defaultPath: nomeProposto,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (scelta.canceled || !scelta.filePath) return { annullato: true };

  const temporaneo = path.join(app.getPath("temp"), `wsa-stampa-${Date.now()}.html`);
  fs.writeFileSync(temporaneo, documento(dati), "utf8");

  const finestra = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, images: true, sandbox: true, contextIsolation: true, nodeIntegration: false }
  });

  try {
    await finestra.loadFile(temporaneo);
    const pdf = await finestra.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font:7pt 'Segoe UI',sans-serif;color:#7a879a;width:100%;padding:0 16mm;text-align:right">
        Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></div>`,
      margins: { top: 0.7, bottom: 0.8, left: 0.63, right: 0.63 }
    });
    fs.writeFileSync(scelta.filePath, pdf);
    return { percorso: scelta.filePath };
  } finally {
    finestra.destroy();
    try { fs.unlinkSync(temporaneo); } catch { /* il temporaneo se ne va col riavvio */ }
  }
}

/** Apre il PDF appena salvato con il lettore di sistema. */
function apri(percorso) {
  return shell.openPath(percorso);
}

module.exports = { pratica, apri, documento };
