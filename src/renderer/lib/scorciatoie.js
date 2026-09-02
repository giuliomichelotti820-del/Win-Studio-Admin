/* =============================================================================
 * Scorciatoie da tastiera
 *
 * Un gestionale si giudica da quanto lavoro si fa senza staccare le mani dalla
 * tastiera. Qui c'e l'elenco completo, ed e uno solo: le combinazioni, la loro
 * descrizione e il modo in cui vengono intercettate nascono dalla stessa
 * tabella. E il punto di questo file — finche l'elenco dell'aiuto e scritto a
 * mano da una parte e i tasti dall'altra, i due divergono in due settimane e la
 * finestra F1 inizia a mentire.
 *
 * Tre famiglie, scelte per come si usano davvero:
 *
 *   Ctrl + tasto      i comandi. Sono pochi e non cambiano mai.
 *   G poi tasto       gli spostamenti. Si legge "vai a": G C = vai alla Coda.
 *                     La lettera e l'iniziale del posto, non un numero da
 *                     ricordare; e dopo un giorno la mano ci arriva da sola.
 *   tasto singolo     le azioni sulla riga selezionata, dentro gli elenchi.
 *
 * Perche una sequenza e non un'altra scorciatoia con Ctrl: le combinazioni
 * libere sono finite. Ctrl+1…9 copre nove sezioni su quattordici e nessuno
 * ricorda quale sia la settima; "G poi F" per i Fornitori si ricorda subito e
 * lascia i Ctrl ai comandi veri.
 *
 * Nessuna scorciatoia distruttiva senza modificatore: la peggiore cosa che puo
 * fare un tasto premuto per sbaglio e cambiare sezione.
 * ========================================================================== */

import { el, svuota, modale } from "./ui.js";

/* =============================================================================
 * La tabella
 *
 * `id` e il contratto con il resto dell'applicazione: chi installa le
 * scorciatoie fornisce una funzione per ogni id che vuole gestire. Le voci
 * senza azione (quelle delle viste, o quelle di Windows) restano in elenco
 * perche vanno documentate comunque, ma non intercettano niente.
 * ========================================================================== */

export const SCORCIATOIE = [
  /* --- Comandi ----------------------------------------------------------- */
  { id: "palette", combo: "ctrl+k", alias: ["ctrl+shift+p"], gruppo: "Comandi", tasti: "Ctrl + K", descrizione: "Comando rapido: sezioni, azioni e ricerca delle pratiche", nota: "Anche Ctrl+Shift+P" },
  { id: "stato-sistema", combo: "ctrl+shift+s", gruppo: "Comandi", tasti: "Ctrl + Shift + S", descrizione: "Apri e chiudi lo stato globale del sistema" },
  { id: "guida", combo: "f1", gruppo: "Comandi", tasti: "F1", descrizione: "Guida del programma" },
  { id: "guida-sezione", combo: "shift+f1", gruppo: "Comandi", tasti: "Shift + F1", descrizione: "Guida della sezione che hai aperto adesso" },
  { id: "elenco-scorciatoie", combo: "ctrl+/", alias: ["shift+?"], gruppo: "Comandi", tasti: "Ctrl + /", descrizione: "Questo elenco", nota: "Anche ?" },
  { id: "impostazioni", combo: "ctrl+,", gruppo: "Comandi", tasti: "Ctrl + ,", descrizione: "Impostazioni della postazione" },
  { id: "ricarica", combo: "f5", alias: ["ctrl+r"], gruppo: "Comandi", tasti: "F5", descrizione: "Ricarica i dati della sezione aperta", nota: "Anche Ctrl+R" },

  /* --- Postazione --------------------------------------------------------- */
  { id: "blocca", combo: "ctrl+l", gruppo: "Postazione", tasti: "Ctrl + L", descrizione: "Blocca subito la postazione (si riapre con il PIN)" },
  { id: "laterale", combo: "ctrl+b", gruppo: "Postazione", tasti: "Ctrl + B", descrizione: "Comprimi o riapri la barra laterale" },
  { id: "tema", combo: "ctrl+shift+t", gruppo: "Postazione", tasti: "Ctrl + Shift + T", descrizione: "Cambia tema: come Windows, chiaro, scuro" },
  { id: "silenzio", combo: "ctrl+shift+d", gruppo: "Postazione", tasti: "Ctrl + Shift + D", descrizione: "Accendi o spegni il «non disturbare»" },
  { id: "aggiorna-notifiche", combo: "ctrl+shift+u", gruppo: "Postazione", tasti: "Ctrl + Shift + U", descrizione: "Controlla adesso se ci sono novita" },
  { id: "richiamo", combo: null, gruppo: "Postazione", tasti: "Ctrl + Alt + S", descrizione: "Richiama Win Studio Admin da qualunque programma di Windows", nota: "Vale in tutto il sistema" },
  { id: "promemoria", combo: "ctrl+shift+r", gruppo: "Postazione", tasti: "Ctrl + Shift + R", descrizione: "Prendi un promemoria: avviso di Windows all'ora che scegli" },
  { id: "zoom-piu", combo: "ctrl+=", alias: ["ctrl++"], gruppo: "Postazione", tasti: "Ctrl + +", descrizione: "Ingrandisci l'interfaccia di un gradino" },
  { id: "zoom-meno", combo: "ctrl+-", gruppo: "Postazione", tasti: "Ctrl + −", descrizione: "Rimpicciolisci l'interfaccia di un gradino" },
  { id: "zoom-zero", combo: "ctrl+0", gruppo: "Postazione", tasti: "Ctrl + 0", descrizione: "Riporta l'interfaccia al 100%" },

  /* --- Navigazione -------------------------------------------------------- */
  { id: "indietro", combo: "alt+arrowleft", gruppo: "Navigazione", tasti: "Alt + ←", descrizione: "Torna alla sezione precedente" },
  { id: "avanti", combo: "alt+arrowright", gruppo: "Navigazione", tasti: "Alt + →", descrizione: "Vai avanti nella cronologia" },
  { id: "sezione-numero", combo: null, gruppo: "Navigazione", tasti: "Ctrl + 1 … 9", descrizione: "Salta alle prime nove sezioni della barra laterale" },
  { id: "vai-a", combo: null, gruppo: "Navigazione", tasti: "G poi lettera", descrizione: "«Vai a»: premi G, lascia, premi l'iniziale della sezione" },
  { id: "chiudi", combo: null, gruppo: "Navigazione", tasti: "Esc", descrizione: "Chiudi finestra, comando rapido, tendina o selezione" },

  /* --- Schede di lavoro ---------------------------------------------------
   * Sono le stesse combinazioni di un browser, di proposito: chi apre otto
   * pratiche insieme le conosce gia da vent'anni e non deve impararle qui. */
  { id: "scheda-avanti", combo: "ctrl+tab", gruppo: "Schede di lavoro", tasti: "Ctrl + Tab", descrizione: "Passa alla scheda seguente" },
  { id: "scheda-indietro", combo: "ctrl+shift+tab", gruppo: "Schede di lavoro", tasti: "Ctrl + Shift + Tab", descrizione: "Passa alla scheda precedente" },
  { id: "scheda-chiudi", combo: "ctrl+w", gruppo: "Schede di lavoro", tasti: "Ctrl + W", descrizione: "Chiudi la scheda su cui stai lavorando" },
  { id: "scheda-fissa", combo: null, gruppo: "Schede di lavoro", tasti: "Doppio clic", descrizione: "Fissa una linguetta: resta anche quando chiudi tutto il resto" },
  { id: "scheda-chiudi-mouse", combo: null, gruppo: "Schede di lavoro", tasti: "Tasto centrale", descrizione: "Chiudi la linguetta sotto il puntatore" },
  { id: "scheda-menu", combo: null, gruppo: "Schede di lavoro", tasti: "Tasto destro", descrizione: "Menu della linguetta: apri, fissa, chiudi, chiudi le altre" }
];

/* --- La famiglia «vai a» --------------------------------------------------
 * La lettera e l'iniziale di come la sezione viene chiamata in ufficio, non
 * del nome che le abbiamo dato nel menu: gli stabili sono gli stabili anche se
 * la voce dice «Condomini», e la posta e l'email.
 * ------------------------------------------------------------------------ */

export const VAI_A = [
  ["p", "panoramica", "Panoramica"],
  ["c", "coda", "Coda segnalazioni"],
  ["a", "archivio", "Archivio"],
  ["s", "condomini", "Stabili (Condomini)"],
  ["m", "morosi", "Morosi"],
  ["f", "fornitori", "Fornitori"],
  ["w", "whatsapp", "WhatsApp"],
  ["e", "posta", "Email in arrivo (Posta)"],
  ["n", "notifiche", "Notifiche"],
  ["t", "studio", "Team dello Studio"],
  ["u", "controllo", "Utenze e sessioni (Controllo)"],
  ["r", "registro", "Registro attivita"],
  ["i", "impostazioni", "Impostazioni"],
  ["h", "guida", "Guida del programma"]
];

/* --- Le scorciatoie che vivono dentro le viste ---------------------------
 * Non le intercetta questo modulo — le gestisce la vista, che sa quale riga e
 * selezionata. Stanno qui perche l'elenco dell'aiuto deve essere completo:
 * l'utente non distingue chi ascolta il tasto, distingue se il tasto c'e.
 * ---------------------------------------------------------------------- */

export const SCORCIATOIE_VISTA = [
  ["Coda delle segnalazioni", [
    ["J / K", "Riga successiva o precedente (anche con le frecce)"],
    ["Invio", "Apri la segnalazione selezionata"],
    ["Spazio", "Seleziona o deseleziona la riga, per le azioni di massa"],
    ["1 … 6", "Cambia stato senza aprire la scheda"],
    ["A", "Assegna la pratica a te"],
    ["U", "Togli l'assegnazione"],
    ["R", "Ricarica la coda"],
    ["/", "Salta al campo di ricerca"],
    ["Home / Fine", "Prima o ultima riga dell'elenco"]
  ]],
  ["Finestre e moduli", [
    ["Invio", "Conferma il modulo aperto"],
    ["Esc", "Chiudi senza salvare"],
    ["Tab / Shift + Tab", "Campo successivo o precedente"]
  ]],
  ["Comando rapido (Ctrl + K)", [
    ["↑ / ↓", "Scorri i risultati"],
    ["Invio", "Apri il risultato selezionato"],
    ["Esc", "Chiudi il comando rapido"]
  ]],
  ["Schermata di blocco", [
    ["Cifre", "Digita il PIN: si sblocca da solo all'ultima cifra"],
    ["Backspace", "Cancella l'ultima cifra"],
    ["Canc", "Ricomincia da capo"]
  ]]
];

/* =============================================================================
 * Riconoscimento dei tasti
 * ========================================================================== */

/** Forma canonica di un evento: "ctrl+shift+k", "f1", "alt+arrowleft". */
function combo(evento) {
  const parti = [];
  if (evento.ctrlKey || evento.metaKey) parti.push("ctrl");
  if (evento.altKey) parti.push("alt");
  if (evento.shiftKey) parti.push("shift");
  parti.push(String(evento.key).toLowerCase());
  return parti.join("+");
}

const DENTRO_CAMPO = /^(INPUT|TEXTAREA|SELECT)$/;

function inScrittura(bersaglio) {
  return DENTRO_CAMPO.test(bersaglio.tagName) || bersaglio.isContentEditable;
}

/* =============================================================================
 * Installazione
 * ========================================================================== */

/**
 * Attacca il gestore globale delle scorciatoie.
 *
 * @param {object} opzioni
 * @param {object} opzioni.azioni      mappa id → funzione, dalla tabella sopra
 * @param {Function} opzioni.vaiA      chiamata con l'id della sezione (famiglia G)
 * @param {Function} opzioni.perNumero chiamata con 1…9 per Ctrl+numero
 * @param {Function} [opzioni.attiva]  se restituisce false le scorciatoie tacciono
 * @returns {Function} per staccare tutto
 */
export function installaScorciatoie({ azioni = {}, vaiA, perNumero, attiva }) {
  const mappa = new Map();
  for (const voce of SCORCIATOIE) {
    if (!voce.combo || !azioni[voce.id]) continue;
    mappa.set(voce.combo, azioni[voce.id]);
    for (const alias of voce.alias || []) mappa.set(alias, azioni[voce.id]);
  }

  let inSequenza = false;
  let timerSequenza = null;
  let suggerimento = null;

  /** La strisciolina che compare in basso: dice che l'app sta aspettando. */
  function mostraSuggerimento() {
    if (suggerimento) return;
    suggerimento = el("div", { class: "sequenza-suggerimento" }, [
      el("kbd", { text: "G" }),
      el("span", { text: "vai a…" }),
      el("span", { class: "sotto", text: VAI_A.slice(0, 6).map(([t, , n]) => `${t.toUpperCase()} ${n.split(" ")[0]}`).join("  ·  ") })
    ]);
    document.body.appendChild(suggerimento);
  }

  function fineSequenza() {
    inSequenza = false;
    clearTimeout(timerSequenza);
    if (suggerimento) { suggerimento.remove(); suggerimento = null; }
  }

  function suTasto(evento) {
    if (typeof attiva === "function" && !attiva()) return;

    // Una finestra modale, il comando rapido o il velo di blocco fermano
    // l'evento prima di qui: se e arrivato, siamo davvero nell'applicazione.
    const scrivendo = inScrittura(evento.target);

    /* --- Secondo tasto della sequenza «vai a» --------------------------- */
    if (inSequenza) {
      fineSequenza();
      if (evento.ctrlKey || evento.altKey || evento.metaKey) return;
      const destinazione = VAI_A.find(([tasto]) => tasto === String(evento.key).toLowerCase());
      if (destinazione) {
        evento.preventDefault();
        vaiA(destinazione[1]);
      }
      return;
    }

    /* --- Primo tasto della sequenza ------------------------------------- */
    if (!scrivendo && !evento.ctrlKey && !evento.altKey && !evento.metaKey && String(evento.key).toLowerCase() === "g") {
      evento.preventDefault();
      inSequenza = true;
      mostraSuggerimento();
      // Un secondo e mezzo: abbastanza per pensarci, non tanto da inghiottire
      // la lettera successiva di chi ha premuto G per sbaglio.
      timerSequenza = setTimeout(fineSequenza, 1500);
      return;
    }

    /* --- Il punto interrogativo ------------------------------------------ */
    if (!scrivendo && evento.key === "?" && !evento.ctrlKey && !evento.altKey) {
      if (azioni["elenco-scorciatoie"]) {
        evento.preventDefault();
        azioni["elenco-scorciatoie"]();
      }
      return;
    }

    const chiave = combo(evento);

    /* --- Ctrl + numero ---------------------------------------------------- */
    if (/^ctrl\+[1-9]$/.test(chiave) && typeof perNumero === "function") {
      evento.preventDefault();
      perNumero(Number(evento.key));
      return;
    }

    /* --- Tabella --------------------------------------------------------- */
    const azione = mappa.get(chiave);
    if (!azione) return;

    // F5 dentro un campo di ricerca deve ricaricare comunque; una lettera
    // sola, no. Le voci con modificatore o tasto funzione passano sempre.
    const conModificatore = evento.ctrlKey || evento.altKey || evento.metaKey || /^f\d+$/.test(String(evento.key).toLowerCase());
    if (scrivendo && !conModificatore) return;

    evento.preventDefault();
    azione();
  }

  document.addEventListener("keydown", suTasto);
  window.addEventListener("blur", fineSequenza);

  return () => {
    fineSequenza();
    document.removeEventListener("keydown", suTasto);
    window.removeEventListener("blur", fineSequenza);
  };
}

/* =============================================================================
 * La finestra dell'aiuto
 *
 * Con la casella di ricerca: quattordici destinazioni e venti comandi sono
 * troppi da scorrere quando si sta cercando «quello per assegnare a me».
 * ========================================================================== */

export function mostraScorciatoie() {
  const ricerca = el("input", {
    class: "campo largo", type: "search", placeholder: "Cerca una scorciatoia: «assegna», «tema», «blocca»…"
  });
  const elenco = el("div", { class: "scorciatoie-elenco" });

  // Tutto appiattito in righe uniformi: da qui in poi il filtro e una riga di
  // codice invece di tre rami diversi.
  const righe = [
    ...SCORCIATOIE.map((s) => ({
      gruppo: s.gruppo,
      tasti: s.tasti,
      descrizione: s.descrizione + (s.nota ? ` — ${s.nota}` : "")
    })),
    ...VAI_A.map(([tasto, , nome]) => ({
      gruppo: "Vai a (premi G, poi la lettera)",
      tasti: `G  ${tasto.toUpperCase()}`,
      descrizione: nome
    })),
    ...SCORCIATOIE_VISTA.flatMap(([gruppo, voci]) =>
      voci.map(([tasti, descrizione]) => ({ gruppo, tasti, descrizione })))
  ];

  function disegna(filtro) {
    const q = filtro.trim().toLowerCase();
    const visibili = q
      ? righe.filter((r) => `${r.tasti} ${r.descrizione} ${r.gruppo}`.toLowerCase().includes(q))
      : righe;

    svuota(elenco);
    if (!visibili.length) {
      elenco.append(el("p", { class: "vuoto-sotto", text: "Nessuna scorciatoia con queste parole." }));
      return;
    }
    for (const gruppo of [...new Set(visibili.map((r) => r.gruppo))]) {
      elenco.append(
        el("h2", { text: gruppo }),
        el("div", { class: "scorciatoie" }, visibili.filter((r) => r.gruppo === gruppo).map((r) =>
          el("div", { class: "riga-tasto" }, [
            el("kbd", { text: r.tasti }),
            el("span", { class: "sotto", text: r.descrizione })
          ])))
      );
    }
  }

  ricerca.addEventListener("input", () => disegna(ricerca.value));
  disegna("");

  modale({
    titolo: "Scorciatoie da tastiera",
    larghezza: 760,
    contenuto: el("div", { class: "colonna" }, [
      el("p", { class: "sotto", text: "Le combinazioni con Ctrl sono comandi. Per spostarti premi G e poi l'iniziale della sezione: G C porta alla coda, G S agli stabili." }),
      ricerca,
      elenco
    ]),
    azioni: [{ testo: "Chiudi", primaria: true, azione: (chiudi) => chiudi() }]
  });

  ricerca.focus();
}
