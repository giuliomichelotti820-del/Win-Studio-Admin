/* =============================================================================
 * Utilita condivise dell'interfaccia: creazione elementi, formattazione,
 * pastiglie di stato, dialoghi e messaggi temporanei.
 * ========================================================================== */

export function el(tag, attributi = {}, figli = []) {
  const nodo = document.createElement(tag);
  for (const [chiave, valore] of Object.entries(attributi)) {
    if (valore === null || valore === undefined || valore === false) continue;
    if (chiave === "class") nodo.className = valore;
    else if (chiave === "text") nodo.textContent = valore;
    else if (chiave === "html") nodo.innerHTML = valore;
    else if (chiave.startsWith("on") && typeof valore === "function") nodo.addEventListener(chiave.slice(2), valore);
    else if (chiave.startsWith("data")) nodo.setAttribute(chiave.replace(/([A-Z])/g, "-$1").toLowerCase(), valore);
    else nodo.setAttribute(chiave, valore === true ? "" : valore);
  }
  for (const figlio of [].concat(figli)) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    nodo.appendChild(typeof figlio === "string" ? document.createTextNode(figlio) : figlio);
  }
  return nodo;
}

/**
 * Aggiunge figli scartando quelli assenti.
 *
 * `Node.append(null)` inserisce la parola "null" nella pagina, a differenza di
 * `el()` che i figli nulli li ignora: chi scrive `condizione ? nodo : null` in
 * una append se lo ritrova stampato a schermo.
 */
export function aggiungi(nodo, ...figli) {
  for (const figlio of figli.flat()) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    nodo.append(figlio);
  }
  return nodo;
}

export function svuota(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

/* --- Etichette di dominio ------------------------------------------------ */

export const STATI = {
  nuova: "Nuova",
  presa_in_carico: "Presa in carico",
  in_lavorazione: "In lavorazione",
  in_attesa: "In attesa",
  risolta: "Risolta",
  chiusa: "Chiusa"
};

export const PRIORITA = { bassa: "Bassa", media: "Media", alta: "Alta", urgente: "Urgente" };

export const CANALI = { segnalazione: "Segnalazione", contatto: "Contatto", email: "Email", whatsapp: "WhatsApp" };

export const STATI_APERTI = ["nuova", "presa_in_carico", "in_lavorazione", "in_attesa"];

export function pastiglia(testo, tipo) {
  return el("span", { class: `pill pill-${tipo}`, text: testo });
}

export function pastigliaStato(stato) {
  return pastiglia(STATI[stato] || stato, `stato-${stato}`);
}

export function pastigliaPriorita(priorita) {
  return pastiglia(PRIORITA[priorita] || priorita, `pri-${priorita}`);
}

/* --- Date ---------------------------------------------------------------- */

// Il Worker restituisce date SQLite in UTC senza suffisso: senza la "Z" il
// browser le interpreterebbe come ora locale, sfasando tutto di due ore.
export function aData(valore) {
  if (!valore) return null;
  const testo = String(valore);
  const iso = testo.includes("T") ? testo : `${testo.replace(" ", "T")}Z`;
  const data = new Date(iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function dataOra(valore) {
  const data = aData(valore);
  if (!data) return "—";
  return data.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function soloData(valore) {
  const data = aData(valore);
  if (!data) return "—";
  return data.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function daQuando(valore) {
  const data = aData(valore);
  if (!data) return "—";
  const minuti = Math.round((Date.now() - data.getTime()) / 60000);
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} h fa`;
  const giorni = Math.round(ore / 24);
  if (giorni < 30) return `${giorni} g fa`;
  return soloData(valore);
}

export function euro(valore) {
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return "—";
  return numero.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

/* --- Messaggi temporanei ------------------------------------------------- */

let contenitoreToast = null;

export function toast(messaggio, tipo = "info") {
  if (!contenitoreToast) {
    contenitoreToast = el("div", { class: "toasts" });
    document.body.appendChild(contenitoreToast);
  }
  const nodo = el("div", { class: `toast toast-${tipo}`, text: messaggio });
  contenitoreToast.appendChild(nodo);
  setTimeout(() => nodo.classList.add("uscita"), 3200);
  setTimeout(() => nodo.remove(), 3600);
}

/* --- Chiamate all'API ---------------------------------------------------- */

/**
 * Unico punto di contatto con il processo principale: srotola la busta
 * { ok, dati, errore } e trasforma l'insuccesso in un'eccezione, cosi le viste
 * scrivono `await api.get(...)` senza controlli ripetuti.
 */
export const api = {
  async chiama(metodo, percorso, corpo) {
    const risposta = await window.studio[metodo](percorso, corpo);
    if (!risposta.ok) {
      const errore = new Error(risposta.errore);
      errore.status = risposta.stato;
      throw errore;
    }
    return risposta.dati;
  },
  get: (percorso) => api.chiama("get", percorso),
  post: (percorso, corpo) => api.chiama("post", percorso, corpo),
  patch: (percorso, corpo) => api.chiama("patch", percorso, corpo),
  put: (percorso, corpo) => api.chiama("put", percorso, corpo),
  del: (percorso, corpo) => api.chiama("del", percorso, corpo)
};

/* --- Cache di sessione ---------------------------------------------------
 * Elenchi che cambiano di rado (staff, categorie, condomini, fornitori) e che
 * servono a ogni schermata: chiederli una volta sola tiene istantanei i menu
 * di assegnazione, che sono il gesto piu frequente della giornata.
 * ---------------------------------------------------------------------- */

const cache = new Map();

export async function cached(chiave, caricatore, ttlMs = 5 * 60 * 1000) {
  const voce = cache.get(chiave);
  if (voce && Date.now() - voce.quando < ttlMs) return voce.dati;
  const dati = await caricatore();
  cache.set(chiave, { dati, quando: Date.now() });
  return dati;
}

export function invalidaCache(chiave) {
  if (chiave) cache.delete(chiave);
  else cache.clear();
}

/* --- Dialogo modale ------------------------------------------------------ */

export function modale({ titolo, contenuto, azioni = [], larghezza = 520 }) {
  const sfondo = el("div", { class: "modale-sfondo" });
  const finestra = el("div", { class: "modale" }, [
    el("header", { class: "modale-testa" }, [
      el("h2", { text: titolo }),
      el("button", { class: "icona", text: "✕", onclick: chiudi, title: "Chiudi (Esc)" })
    ]),
    el("div", { class: "modale-corpo" }, [contenuto]),
    azioni.length
      ? el("footer", { class: "modale-piede" }, azioni.map((azione) =>
          el("button", {
            class: azione.primaria ? "bottone primario" : "bottone",
            text: azione.testo,
            onclick: () => azione.azione(chiudi)
          })))
      : null
  ]);

  function chiudi() {
    sfondo.remove();
    document.removeEventListener("keydown", suTasto, true);
  }

  function suTasto(evento) {
    if (evento.key === "Escape") { evento.stopPropagation(); chiudi(); }
  }

  // La CSP vieta l'attributo style: la larghezza si imposta dal CSSOM.
  finestra.style.maxWidth = `${larghezza}px`;

  sfondo.addEventListener("mousedown", (evento) => { if (evento.target === sfondo) chiudi(); });
  document.addEventListener("keydown", suTasto, true);
  sfondo.appendChild(finestra);
  document.body.appendChild(sfondo);

  const primoCampo = finestra.querySelector("input, textarea, select, button.primario");
  if (primoCampo) primoCampo.focus();

  return { chiudi, finestra };
}

export function conferma(messaggio, titolo = "Conferma") {
  return new Promise((risolvi) => {
    modale({
      titolo,
      contenuto: el("p", { text: messaggio }),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => { chiudi(); risolvi(false); } },
        { testo: "Conferma", primaria: true, azione: (chiudi) => { chiudi(); risolvi(true); } }
      ]
    });
  });
}

export function statoVuoto(messaggio, sotto) {
  return el("div", { class: "vuoto" }, [
    el("p", { class: "vuoto-titolo", text: messaggio }),
    sotto ? el("p", { class: "vuoto-sotto", text: sotto }) : null
  ]);
}

export function caricamento(testo = "Carico…") {
  return el("div", { class: "caricamento" }, [el("span", { class: "spinner" }), el("span", { text: testo })]);
}
