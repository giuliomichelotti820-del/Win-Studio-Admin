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
  "app:scorciatoia-globale": new Set(),
  "app:aggiornamento": new Set(),
  "app:promemoria": new Set(),
  "app:copia": new Set(),
  "app:finestra": new Set()
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
  sblocca: (password) => ipcRenderer.invoke("auth:sblocca", { password }),

  // PIN rapido: il codice attraversa il ponte in chiaro e non va oltre il
  // processo principale, che lo confronta con la derivazione salvata. Non
  // esiste una rotta che lo restituisca: si puo impostare e verificare, mai
  // rileggere.
  pinStato: () => ipcRenderer.invoke("pin:stato"),
  pinImposta: (pin, password) => ipcRenderer.invoke("pin:imposta", { pin, password }),
  pinVerifica: (pin) => ipcRenderer.invoke("pin:verifica", { pin }),
  pinRimuovi: () => ipcRenderer.invoke("pin:rimuovi"),

  get: (percorso) => ipcRenderer.invoke("api:richiesta", { metodo: "GET", percorso }),
  post: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "POST", percorso, corpo }),
  patch: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "PATCH", percorso, corpo }),
  put: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "PUT", percorso, corpo }),
  del: (percorso, corpo) => ipcRenderer.invoke("api:richiesta", { metodo: "DELETE", percorso, corpo }),

  statoAggiornamento: () => ipcRenderer.invoke("aggiornamento:stato"),
  controllaAggiornamento: () => ipcRenderer.invoke("aggiornamento:controlla"),
  scaricaAggiornamento: () => ipcRenderer.invoke("aggiornamento:scarica"),
  installaAggiornamento: () => ipcRenderer.invoke("aggiornamento:installa"),
  noteAggiornamento: () => ipcRenderer.invoke("aggiornamento:note"),
  aggiornamentiAutomatici: (acceso) => ipcRenderer.invoke("aggiornamento:automatico", acceso),

  // Comandi della finestra: la barra dei titoli e disegnata dall'app, quindi
  // riduci/ingrandisci/chiudi devono passare di qui per arrivare a Windows.
  finestra: (comando) => ipcRenderer.invoke("finestra:comando", comando),
  zoom: (passo) => ipcRenderer.invoke("finestra:zoom", passo),

  // Promemoria della postazione: locali, con l'avviso di Windows all'ora scelta.
  promemoria: (filtri) => ipcRenderer.invoke("promemoria:leggi", filtri),
  promemoriaAggiungi: (voce) => ipcRenderer.invoke("promemoria:aggiungi", voce),
  promemoriaFatto: (id, fatto) => ipcRenderer.invoke("promemoria:fatto", { id, fatto }),
  promemoriaRinvia: (id, minuti) => ipcRenderer.invoke("promemoria:rinvia", { id, minuti }),
  promemoriaElimina: (id) => ipcRenderer.invoke("promemoria:elimina", id),

  // Copie di sicurezza dei dati che stanno solo su questo computer.
  copie: () => ipcRenderer.invoke("copie:elenco"),
  copiaCrea: () => ipcRenderer.invoke("copie:crea"),
  copiaEsporta: () => ipcRenderer.invoke("copie:esporta"),
  copiaRimuovi: (nome) => ipcRenderer.invoke("copie:rimuovi", nome),
  copiaRipristina: (percorso) => ipcRenderer.invoke("copie:ripristina", percorso || null),

  // Stampa: il documento lo compone il processo principale, il renderer manda
  // solo i dati gia a schermo.
  stampaPratica: (dati) => ipcRenderer.invoke("stampa:pratica", dati),
  apriStampa: (percorso) => ipcRenderer.invoke("stampa:apri", percorso),

  archivioLeggi: (tipo, chiave) => ipcRenderer.invoke("archivio:leggi", { tipo, chiave }),
  archivioSalva: (tipo, chiave, campi, note) => ipcRenderer.invoke("archivio:salva", { tipo, chiave, campi, note }),
  archivioAllega: (tipo, chiave) => ipcRenderer.invoke("archivio:allega", { tipo, chiave }),
  archivioRimuoviAllegato: (tipo, chiave, id) => ipcRenderer.invoke("archivio:rimuovi-allegato", { tipo, chiave, id }),
  archivioApri: (percorso) => ipcRenderer.invoke("archivio:apri-allegato", percorso),
  caricaDocumento: (dati) => ipcRenderer.invoke("documenti:carica", dati),

  impostazioni: (parziali) => ipcRenderer.invoke("settings:set", parziali),
  esportaImpostazioni: () => ipcRenderer.invoke("impostazioni:esporta"),
  importaImpostazioni: () => ipcRenderer.invoke("impostazioni:importa"),

  annota: (voce) => ipcRenderer.invoke("registro:annota", voce),
  registro: (filtri) => ipcRenderer.invoke("registro:leggi", filtri),
  svuotaRegistro: () => ipcRenderer.invoke("registro:svuota"),

  salvaTesto: (nomeFile, contenuto, titolo) => ipcRenderer.invoke("app:salva-testo", { nomeFile, contenuto, titolo }),
  diagnostica: () => ipcRenderer.invoke("app:diagnostica"),
  apriCartellaDati: () => ipcRenderer.invoke("app:apri-cartella-dati"),
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
