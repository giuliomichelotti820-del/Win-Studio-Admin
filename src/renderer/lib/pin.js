/* =============================================================================
 * PIN rapido: campo, configurazione, verifica
 *
 * Il PIN e la scorciatoia che rende sopportabile il blocco per inattivita. Se
 * per riprendere la postazione serve ogni volta una password lunga, dopo tre
 * giorni il blocco viene alzato a sessanta minuti e la sicurezza sparisce: e
 * sempre finita cosi, in ogni ufficio. Sei cifre e un tastierino sono la
 * differenza fra una regola rispettata e una aggirata.
 *
 * Qui sta solo l'interfaccia. Il PIN non viene mai confrontato dentro la
 * pagina: si manda al processo principale, che tiene la derivazione, il sale e
 * il contatore dei tentativi (vedi src/main/pin.js).
 *
 * Sul campo di inserimento: niente <input> di sistema. Le caselle sono nostre e
 * ricevono i tasti dal contenitore, cosi il gestore password del browser non
 * prova a riempirle, il PIN non finisce in nessuna cronologia di modulo e il
 * tastierino a schermo si comporta esattamente come la tastiera fisica.
 * ========================================================================== */

import { el, svuota, modale, toast } from "./ui.js";

/* =============================================================================
 * Campo PIN
 * ========================================================================== */

/**
 * Casella a cifre per il PIN.
 *
 * @param {object} opzioni
 * @param {number} [opzioni.lunghezza]     lunghezza esatta attesa (sblocco)
 * @param {number} [opzioni.lunghezzaMin]  minimo accettabile (configurazione)
 * @param {number} [opzioni.lunghezzaMax]  massimo accettabile (configurazione)
 * @param {boolean} [opzioni.tastierino]   mostra il tastierino a schermo
 * @param {Function} [opzioni.suCompleto]  chiamata quando si raggiunge la lunghezza esatta
 * @param {Function} [opzioni.suCambio]    chiamata a ogni cifra
 * @param {Function} [opzioni.suInvio]     chiamata su Invio
 */
export function campoPin({
  lunghezza = null, lunghezzaMin = 4, lunghezzaMax = 8,
  tastierino = true, suCompleto, suCambio, suInvio, etichetta = "PIN"
} = {}) {
  const massimo = lunghezza || lunghezzaMax;
  let cifre = "";

  const caselle = el("div", { class: "pin-caselle" });
  const contenitore = el("div", {
    class: "pin-campo", tabindex: "0", role: "textbox",
    "aria-label": etichetta, "aria-describedby": "pin-aiuto"
  }, [caselle]);

  function disegna() {
    svuota(caselle);
    for (let i = 0; i < massimo; i += 1) {
      const piena = i < cifre.length;
      // Oltre il minimo le caselle sono facoltative: si vedono piu tenui,
      // cosi si capisce a colpo d'occhio che il PIN puo finire prima.
      const facoltativa = !lunghezza && i >= lunghezzaMin;
      caselle.append(el("span", {
        class: `pin-casella ${piena ? "piena" : ""} ${facoltativa ? "facoltativa" : ""} ${i === cifre.length ? "cursore" : ""}`,
        text: piena ? "●" : ""
      }));
    }
  }

  function imposta(nuovo) {
    cifre = String(nuovo).replace(/\D/g, "").slice(0, massimo);
    disegna();
    if (typeof suCambio === "function") suCambio(cifre);
    if (lunghezza && cifre.length === lunghezza && typeof suCompleto === "function") suCompleto(cifre);
  }

  function aggiungi(cifra) {
    if (cifre.length >= massimo) return;
    imposta(cifre + cifra);
  }

  function cancella() {
    imposta(cifre.slice(0, -1));
  }

  contenitore.addEventListener("keydown", (evento) => {
    if (evento.key >= "0" && evento.key <= "9") { evento.preventDefault(); aggiungi(evento.key); return; }
    if (evento.key === "Backspace") { evento.preventDefault(); cancella(); return; }
    if (evento.key === "Delete" || evento.key === "Escape") { evento.preventDefault(); imposta(""); return; }
    if (evento.key === "Enter") { evento.preventDefault(); if (typeof suInvio === "function") suInvio(cifre); return; }
    // Le lettere non devono passare oltre: senza questo, la "l" di chi sbaglia
    // riga arriverebbe alla scorciatoia globale e bloccherebbe la postazione.
    if (evento.key.length === 1) evento.preventDefault();
  });

  contenitore.addEventListener("paste", (evento) => {
    evento.preventDefault();
    imposta(evento.clipboardData.getData("text"));
  });

  contenitore.addEventListener("click", () => contenitore.focus());

  const tasti = tastierino
    ? el("div", { class: "pin-tastierino" }, [
      ...["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => el("button", {
        class: "pin-tasto", type: "button", text: n, tabindex: "-1",
        onclick: () => { aggiungi(n); contenitore.focus(); }
      })),
      el("button", {
        class: "pin-tasto pin-tasto-servizio", type: "button", text: "C", tabindex: "-1",
        title: "Cancella tutto", onclick: () => { imposta(""); contenitore.focus(); }
      }),
      el("button", {
        class: "pin-tasto", type: "button", text: "0", tabindex: "-1",
        onclick: () => { aggiungi("0"); contenitore.focus(); }
      }),
      el("button", {
        class: "pin-tasto pin-tasto-servizio", type: "button", text: "⌫", tabindex: "-1",
        title: "Cancella l'ultima cifra", onclick: () => { cancella(); contenitore.focus(); }
      })
    ])
    : null;

  const nodo = el("div", { class: "pin-blocco" }, [contenitore, tasti]);

  disegna();

  return {
    nodo,
    contenitore,
    valore: () => cifre,
    imposta,
    pulisci: () => imposta(""),
    focus: () => contenitore.focus(),
    /** Scossa e svuotamento: il feedback fisico di un PIN sbagliato. */
    scuoti() {
      contenitore.classList.remove("scossa");
      // Riavvio dell'animazione: senza il reflow la classe rimessa subito non
      // fa ripartire niente e il secondo errore resta senza risposta.
      void contenitore.offsetWidth;
      contenitore.classList.add("scossa");
      imposta("");
      contenitore.focus();
    }
  };
}

/* =============================================================================
 * Configurazione del PIN
 *
 * Tre passi in una sola finestra: scegli, ripeti, conferma con la password.
 * L'ultimo non e burocrazia — impostare un PIN significa lasciare una chiave
 * corta su questa scrivania, e va fatto solo da chi la password ce l'ha.
 * ========================================================================== */

const REGOLE = [
  "Da 4 a 8 cifre: sei sono l'equilibrio giusto fra velocita e sicurezza.",
  "Niente date di nascita, targhe o numeri civici dello Studio.",
  "Niente sequenze (1234) o cifre tutte uguali (0000): l'app le rifiuta.",
  "Vale solo su questo computer e solo per il tuo account: non apre nulla altrove.",
  "Dopo 5 tentativi sbagliati si disattiva da solo e torna a servire la password."
];

/**
 * Apre la procedura guidata di scelta del PIN.
 *
 * @param {object} opzioni
 * @param {object} opzioni.utente
 * @param {boolean} [opzioni.sostituzione]  true se un PIN c'e gia
 * @param {Function} [opzioni.fatto]        chiamata con il nuovo stato del PIN
 * @param {Function} [opzioni.rimandato]    chiamata se si chiude senza impostare
 */
export function configuraPin({ utente, sostituzione = false, fatto, rimandato } = {}) {
  let passo = "scelta";
  let primoPin = "";
  let concluso = false;

  const corpo = el("div", { class: "pin-procedura" });
  const errore = el("p", { class: "errore" });

  const finestra = modale({
    titolo: sostituzione ? "Cambia il PIN rapido" : "Imposta il PIN rapido",
    larghezza: 480,
    contenuto: corpo
  });

  // Chiudere senza impostare non e un fallimento: si puo sempre fare dopo dalle
  // impostazioni. Ma va saputo da chi ha aperto la procedura.
  // La finestra si chiude anche con Esc, con la ✕ e con un clic fuori: l'unico
  // modo affidabile di accorgersene e guardare quando sparisce dal documento.
  const chiusuraOriginale = finestra.chiudi;
  const osservatore = new MutationObserver(() => {
    if (!document.body.contains(finestra.finestra)) {
      osservatore.disconnect();
      if (!concluso && typeof rimandato === "function") rimandato();
    }
  });
  osservatore.observe(document.body, { childList: true });

  /* --- Passo 1: scelta ---------------------------------------------------- */

  function mostraScelta() {
    passo = "scelta";
    errore.textContent = "";

    const suggerimento = el("p", { class: "sotto", id: "pin-aiuto", text: "Digita da 4 a 8 cifre, poi premi Invio." });
    const avanti = el("button", { class: "bottone primario largo", text: "Continua", disabled: true });

    const campo = campoPin({
      etichetta: "Nuovo PIN",
      suCambio: (cifre) => {
        avanti.disabled = cifre.length < 4;
        suggerimento.textContent = cifre.length < 4
          ? `Ancora ${4 - cifre.length} cifre almeno.`
          : `${cifre.length} cifre. Premi Invio per continuare.`;
      },
      suInvio: () => { if (!avanti.disabled) prosegui(); }
    });

    function prosegui() {
      primoPin = campo.valore();
      mostraConferma();
    }

    avanti.addEventListener("click", prosegui);

    svuota(corpo).append(
      el("p", { text: sostituzione
        ? "Scegli il nuovo PIN che userai per riprendere questa postazione."
        : `Questo computer ha appena associato l'account di ${utente.fullName}. Scegli un PIN per riprendere il lavoro dopo il blocco senza ridigitare la password.` }),
      el("div", { class: "spaziatore" }),
      campo.nodo,
      suggerimento,
      errore,
      avanti,
      el("details", { class: "pin-regole" }, [
        el("summary", { text: "Come deve essere un buon PIN" }),
        el("ul", {}, REGOLE.map((regola) => el("li", { class: "sotto", text: regola })))
      ]),
      el("button", {
        class: "link", type: "button", text: sostituzione ? "Annulla" : "Lo imposto piu tardi",
        onclick: () => chiusuraOriginale()
      })
    );

    campo.focus();
  }

  /* --- Passo 2: conferma --------------------------------------------------- */

  function mostraConferma() {
    passo = "conferma";
    errore.textContent = "";

    const avanti = el("button", { class: "bottone primario largo", text: "Continua", disabled: true });

    const campo = campoPin({
      lunghezza: primoPin.length,
      etichetta: "Ripeti il PIN",
      suCambio: (cifre) => { avanti.disabled = cifre.length !== primoPin.length; },
      suCompleto: () => verifica(),
      suInvio: () => verifica()
    });

    function verifica() {
      if (campo.valore() !== primoPin) {
        errore.textContent = "I due PIN non coincidono. Riprova.";
        campo.scuoti();
        return;
      }
      mostraPassword();
    }

    avanti.addEventListener("click", verifica);

    svuota(corpo).append(
      el("p", { text: "Ripeti il PIN per essere sicuro di averlo digitato come volevi." }),
      el("div", { class: "spaziatore" }),
      campo.nodo,
      errore,
      avanti,
      el("button", { class: "link", type: "button", text: "← Scegli un altro PIN", onclick: mostraScelta })
    );

    campo.focus();
  }

  /* --- Passo 3: password ---------------------------------------------------- */

  function mostraPassword() {
    passo = "password";
    errore.textContent = "";

    const password = el("input", {
      class: "campo largo", type: "password", autocomplete: "current-password",
      placeholder: "Password dell'account"
    });
    const conferma = el("button", { class: "bottone primario largo", text: "Attiva il PIN" });

    async function salva() {
      if (!password.value) {
        errore.textContent = "Serve la password dell'account.";
        password.focus();
        return;
      }
      conferma.disabled = true;
      conferma.textContent = "Verifico…";

      const esito = await window.studio.pinImposta(primoPin, password.value);

      conferma.disabled = false;
      conferma.textContent = "Attiva il PIN";

      if (!esito.ok) {
        errore.textContent = esito.errore;
        password.value = "";
        password.focus();
        // Un PIN rifiutato dalle regole del processo principale si corregge
        // solo tornando alla scelta: la password non c'entra.
        if (/PIN/i.test(esito.errore) && !/[Pp]assword/.test(esito.errore)) {
          setTimeout(mostraScelta, 1200);
        }
        return;
      }

      concluso = true;
      osservatore.disconnect();
      chiusuraOriginale();
      toast("PIN attivo su questa postazione.", "ok");
      if (typeof fatto === "function") fatto(esito.dati);
    }

    password.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") { evento.preventDefault(); salva(); }
    });
    conferma.addEventListener("click", salva);

    svuota(corpo).append(
      el("p", { text: "Ultimo passaggio: conferma con la password dell'account. Serve a garantire che il PIN lo stia scegliendo il titolare dell'account, e non chi ha trovato la postazione aperta." }),
      el("div", { class: "spaziatore" }),
      el("label", { class: "campo-etichetta" }, [el("span", { text: `Password di ${utente.email}` }), password]),
      errore,
      conferma,
      el("button", { class: "link", type: "button", text: "← Torna indietro", onclick: mostraConferma })
    );

    password.focus();
  }

  mostraScelta();

  return { chiudi: chiusuraOriginale, passo: () => passo };
}

/* =============================================================================
 * Proposta automatica dopo l'associazione dell'account
 *
 * Si mostra una volta sola per account e postazione: se si rimanda, l'app non
 * insiste a ogni avvio. La riproposta resta a portata di mano nelle
 * impostazioni e fra le voci del comando rapido.
 * ========================================================================== */

const CHIAVE_RIMANDO = "pinRimandato";

export function proponiPinSeServe({ utente, statoPin, impostazioni, fatto }) {
  if (!statoPin || !statoPin.proponi) return false;
  if (impostazioni && impostazioni[CHIAVE_RIMANDO] === String(utente.id)) return false;

  configuraPin({
    utente,
    fatto,
    rimandato: () => {
      window.studio.impostazioni({ [CHIAVE_RIMANDO]: String(utente.id) });
      toast("Puoi impostare il PIN quando vuoi da Impostazioni → Sicurezza.", "info");
    }
  });
  return true;
}
