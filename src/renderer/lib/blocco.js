/* =============================================================================
 * Blocco della postazione per inattivita
 *
 * Lo Studio lavora su dati di condomini e morosita: una postazione lasciata
 * aperta in un ufficio dove entrano fornitori e amministrati e un problema
 * concreto. Dopo N minuti senza tastiera ne mouse lo schermo si oscura e per
 * tornare serve la password.
 *
 * La sessione col server non viene chiusa: si perderebbe il lavoro a meta e
 * si costringerebbe a un nuovo codice di verifica. Si verifica solo che davanti
 * al computer ci sia ancora la stessa persona.
 *
 * Come si torna dentro: con il PIN, se questa postazione ne ha uno per questo
 * account, altrimenti con la password. Il PIN e la strada preferita e il campo
 * ha gia il fuoco — chi si riaffaccia alla scrivania deve poter riprendere in
 * un secondo, senza toccare il mouse. La password resta sempre raggiungibile
 * con un clic, e diventa l'unica strada dopo cinque PIN sbagliati.
 * ========================================================================== */

import { el, svuota } from "./ui.js";
import { marchioEsteso } from "./marchio.js";
import { campoPin } from "./pin.js";

const EVENTI = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "focus"];

let sorveglianza = null;

// Il velo si costruisce dopo un await (lo stato del PIN): senza questa
// bandiera sincrona due chiamate ravvicinate — l'inattivita che scatta mentre
// qualcuno preme Ctrl+L — supererebbero entrambe il controllo sul DOM e
// impilerebbero due schermate di blocco.
let inApertura = false;

/**
 * Avvia (o riavvia) la sorveglianza.
 * @param {object} opzioni
 * @param {number} opzioni.minuti      0 disattiva il blocco
 * @param {object} opzioni.utente      per mostrare chi e bloccato
 * @param {Function} opzioni.suBlocco  chiamata quando lo schermo si blocca
 */
export function sorveglia({ minuti, utente, suBlocco }) {
  ferma();
  const attesa = Math.max(0, Number(minuti) || 0);
  if (!attesa) return;

  let timer = null;
  let bloccato = false;

  function riarma() {
    if (bloccato) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      bloccato = true;
      mostraBlocco(utente, () => {
        bloccato = false;
        riarma();
      });
      if (typeof suBlocco === "function") suBlocco();
    }, attesa * 60 * 1000);
  }

  for (const evento of EVENTI) document.addEventListener(evento, riarma, true);
  riarma();

  sorveglianza = () => {
    clearTimeout(timer);
    for (const evento of EVENTI) document.removeEventListener(evento, riarma, true);
  };
}

export function ferma() {
  if (sorveglianza) sorveglianza();
  sorveglianza = null;
}

/** Blocca subito, senza aspettare l'inattivita (Ctrl+L, menu utente). */
export function bloccaOra(utente) {
  mostraBlocco(utente, () => {});
}

async function mostraBlocco(utente, sbloccato) {
  if (inApertura || document.querySelector(".blocco")) return;
  inApertura = true;

  // Il PIN si chiede al processo principale ogni volta che lo schermo si
  // blocca, non una volta all'avvio: nel frattempo puo essere stato impostato,
  // sostituito o disattivato da cinque tentativi sbagliati.
  const statoPin = await window.studio.pinStato().catch(() => null);

  const errore = el("p", { class: "errore" });
  const suggerimento = el("p", { class: "sotto blocco-suggerimento" });
  const pannello = el("div", { class: "blocco-pannello" });

  const velo = el("div", { class: "blocco" }, [
    el("div", { class: "riquadro blocco-riquadro" }, [
      marchioEsteso(216),
      el("h1", { text: "Postazione bloccata" }),
      el("p", { class: "sotto", text: utente
        ? `Sessione di ${utente.fullName}, ancora aperta. Il lavoro in corso non e stato perso.`
        : "La sessione e ancora aperta." }),
      el("div", { class: "spaziatore" }),
      pannello,
      suggerimento,
      errore,
      el("button", {
        class: "bottone largo pericolo", text: "Esci dall'account",
        onclick: async () => { inApertura = false; await window.studio.logout(); location.reload(); }
      })
    ])
  ]);

  let mettiFuoco = () => {};

  function chiudiBlocco() {
    inApertura = false;
    velo.remove();
    document.removeEventListener("keydown", intrappola, true);
    sbloccato();
  }

  /* --- Sblocco con il PIN ------------------------------------------------- */

  function pannelloPin(info) {
    errore.textContent = "";
    suggerimento.textContent = `PIN di ${info.lunghezza} cifre · ${info.tentativiRimasti} tentativi rimasti`;

    let inCorso = false;

    const campo = campoPin({
      lunghezza: info.lunghezza,
      etichetta: "PIN di sblocco",
      suCompleto: (cifre) => verifica(cifre),
      suCambio: () => { errore.textContent = ""; }
    });

    async function verifica(cifre) {
      if (inCorso) return;
      inCorso = true;
      const esito = await window.studio.pinVerifica(cifre);
      inCorso = false;

      if (esito.ok) { chiudiBlocco(); return; }

      if (esito.disattivato) {
        // Il PIN non c'e piu: si passa alla password senza far ripetere il
        // gesto a vuoto, e senza nascondere il perche.
        pannelloPassword(esito.errore);
        return;
      }
      suggerimento.textContent = `PIN di ${info.lunghezza} cifre · ${esito.tentativiRimasti} tentativi rimasti`;
      // Prima la scossa, poi il messaggio: svuotare le caselle fa scattare
      // `suCambio`, che pulisce l'errore. Scritto nell'ordine opposto, il
      // motivo del rifiuto sparirebbe nello stesso istante in cui compare.
      campo.scuoti();
      errore.textContent = esito.errore;
    }

    svuota(pannello).append(
      campo.nodo,
      el("button", {
        class: "link", type: "button", text: "Usa la password invece del PIN",
        onclick: () => pannelloPassword()
      })
    );

    mettiFuoco = () => campo.focus();
    mettiFuoco();
  }

  /* --- Sblocco con la password -------------------------------------------- */

  function pannelloPassword(messaggio) {
    errore.textContent = messaggio || "";
    suggerimento.textContent = "La password e la stessa dell'area riservata del sito.";

    const password = el("input", {
      class: "campo largo", type: "password", placeholder: "Password", autocomplete: "current-password"
    });
    const bottone = el("button", { class: "bottone primario largo", text: "Sblocca" });

    async function sblocca() {
      if (!password.value) return;
      bottone.disabled = true;
      bottone.textContent = "Verifico…";
      const esito = await window.studio.sblocca(password.value);
      bottone.disabled = false;
      bottone.textContent = "Sblocca";

      if (!esito.ok) {
        errore.textContent = esito.errore;
        password.value = "";
        password.focus();
        return;
      }
      chiudiBlocco();
    }

    password.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") { evento.preventDefault(); sblocca(); }
    });
    bottone.addEventListener("click", sblocca);

    svuota(pannello).append(
      password,
      bottone,
      statoPin && statoPin.configurato && !messaggio
        ? el("button", { class: "link", type: "button", text: "← Torna al PIN", onclick: () => pannelloPin(statoPin) })
        : null
    );

    mettiFuoco = () => password.focus();
    mettiFuoco();
  }

  /* --- La trappola dei tasti -----------------------------------------------
   * Finche lo schermo e bloccato nessuna scorciatoia dell'app deve passare: il
   * comando rapido aprirebbe una ricerca sopra il velo, e Ctrl+K funzionerebbe
   * su una postazione che ha appena chiesto un PIN.
   *
   * Va fatto in due punti, e non e un dettaglio. Fermare tutto in fase di
   * cattura su `document` blocca anche la consegna al bersaglio: il campo del
   * PIN e fatto di caselle nostre, che i tasti li ricevono da un ascoltatore,
   * e non ne vedrebbe mai uno. Quindi:
   *
   *   - in cattura su `document` si fermano solo i tasti diretti FUORI dal
   *     velo, riportando il fuoco dove deve stare;
   *   - i tasti dentro il velo arrivano regolarmente al loro bersaglio e
   *     vengono fermati risalendo, sul velo stesso, prima di raggiungere gli
   *     ascoltatori dell'applicazione su `document`.
   * --------------------------------------------------------------------- */

  function intrappola(evento) {
    if (!document.body.contains(velo)) return;
    if (velo.contains(evento.target)) return;
    evento.preventDefault();
    evento.stopPropagation();
    mettiFuoco();
  }

  document.addEventListener("keydown", intrappola, true);
  velo.addEventListener("keydown", (evento) => evento.stopPropagation());
  document.body.appendChild(velo);

  if (statoPin && statoPin.configurato) pannelloPin(statoPin);
  else pannelloPassword();

  window.studio.annota({ azione: "blocco-postazione" });
  return () => svuota(velo);
}
