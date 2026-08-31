/* =============================================================================
 * Ponte fra pagina e processo principale
 *
 * Espone una superficie minima e tipizzata: nessun accesso a Node, nessun
 * token, nessuna URL arbitraria. Il renderer puo solo chiedere rotte dell'API
 * dello Studio, che il processo principale firma con la sessione corrente.
 * ========================================================================== */

const { contextBridge, ipcRenderer } = require("electron");

const eventi = {
  "app:naviga": new Set(),
  "app:notifiche": new Set(),
  "app:sessione-scaduta": new Set(),
  "app:scorciatoia-globale": new Set()
};

for (const canale of Object.keys(eventi)) {
  ipcRenderer.on(canale, (_e, dati) => {
    for (const ascoltatore of eventi[canale]) {
      try { ascoltatore(dati); } catch (errore) { console.error(errore); }
    }
  });
}

contextBridge.exposeInMainWorld("studio", {
  stato: () => ipcRenderer.invoke("app:stato"),

  login: (email, password) => ipcRenderer.invoke("auth:login", { email, password }),
  verificaOtp: (ticket, codice) => ipcRenderer.invoke("auth:otp", { ticket, codice }),
  reinviaOtp: (ticket) => ipcRenderer.invoke("auth:resend", { ticket }),
  logout: () => ipcRenderer.invoke("auth:logout"),

  get: (percorso) => ipcRenderer.invoke("api:richiesta", { metodo: "GET", percorso }),
  post: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "POST", percorso, corpo }),
  patch: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "PATCH", percorso, corpo }),
  put: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "PUT", percorso, corpo }),
  del: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "DELETE", percorso, corpo }),

  archivioLeggi: (tipo, chiave) => ipcRenderer.invoke("archivio:leggi", { tipo, chiave }),
  archivioSalva: (tipo, chiave, campi, note) => ipcRenderer.invoke("archivio:salva", { tipo, chiave, campi, note }),
  archivioAllega: (tipo, chiave) => ipcRenderer.invoke("archivio:allega", { tipo, chiave }),
  archivioRimuoviAllegato: (tipo, chiave, id) => ipcRenderer.invoke("archivio:rimuovi-allegato", { tipo, chiave, id }),
  archivioApri: (percorso) => ipcRenderer.invoke("archivio:apri-allegato", percorso),
  caricaDocumento: (dati) => ipcRenderer.invoke("documenti:carica", dati),

  impostazioni: (parziali) => ipcRenderer.invoke("settings:set", parziali),
  aggiornaNotifiche: () => ipcRenderer.invoke("app:notifiche-ora"),
  scarica: (percorso, nomeFile) => ipcRenderer.invoke("api:scarica", { percorso, nomeFile }),
  apriEsterno: (url) => ipcRenderer.invoke("app:apri-esterno", url),
  mostraNellaCartella: (percorso) => ipcRenderer.invoke("app:apri-file", percorso),

  su: (canale, ascoltatore) => {
    if (!eventi[canale]) return () => {};
    eventi[canale].add(ascoltatore);
    return () => eventi[canale].delete(ascoltatore);
  }
});
