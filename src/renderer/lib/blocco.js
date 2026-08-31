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
 * ========================================================================== */

import { el, svuota } from "./ui.js";
import { marchio } from "./marchio.js";

const EVENTI = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "focus"];

let sorveglianza = null;

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

function mostraBlocco(utente, sbloccato) {
  if (document.querySelector(".blocco")) return;

  const password = el("input", { class: "campo largo", type: "password", placeholder: "Password", autocomplete: "current-password" });
  const errore = el("p", { class: "errore" });
  const bottone = el("button", { class: "bottone primario largo", text: "Sblocca" });

  const velo = el("div", { class: "blocco" }, [
    el("div", { class: "riquadro blocco-riquadro" }, [
      marchio({ dimensione: 40, sottotitolo: null }),
      el("h1", { text: "Postazione bloccata" }),
      el("p", { class: "sotto", text: utente ? `Sessione di ${utente.fullName}. Inserisci la password per riprendere.` : "Inserisci la password per riprendere." }),
      el("div", { class: "spaziatore" }),
      password,
      errore,
      bottone,
      el("button", {
        class: "bottone largo pericolo", text: "Esci dall'account",
        onclick: async () => { await window.studio.logout(); location.reload(); }
      })
    ])
  ]);

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
    velo.remove();
    document.removeEventListener("keydown", intrappola, true);
    sbloccato();
  }

  // Finche lo schermo e bloccato, nessuna scorciatoia dell'app deve passare:
  // il comando rapido aprirebbe una ricerca sopra il velo.
  function intrappola(evento) {
    if (!document.body.contains(velo)) return;
    if (!velo.contains(evento.target)) {
      evento.preventDefault();
      evento.stopPropagation();
      password.focus();
      return;
    }
    if (evento.key === "Enter") { evento.preventDefault(); sblocca(); }
    evento.stopPropagation();
  }

  bottone.addEventListener("click", sblocca);
  document.addEventListener("keydown", intrappola, true);
  document.body.appendChild(velo);
  password.focus();

  window.studio.annota({ azione: "blocco-postazione" });
  return () => svuota(velo);
}
