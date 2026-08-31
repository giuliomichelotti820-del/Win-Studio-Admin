/* =============================================================================
 * Accesso allo Studio
 *
 * Due schermate: credenziali e, quando il server lo chiede, codice a sei cifre.
 * Entrambe montano lo stesso guscio a due pannelli — vetrina del marchio a
 * sinistra, modulo a destra — cosi l'app si presenta come uno strumento dello
 * Studio e non come una finestra di sistema.
 *
 * Chi entra qui lo fa ogni mattina: l'obiettivo e arrivare alla coda senza
 * toccare il mouse. Email ricordata, invio con Enter, sei cifre che si
 * incollano e si convalidano da sole.
 * ========================================================================== */

import { el, svuota, toast } from "../lib/ui.js";
import { marchio, NOME_STUDIO } from "../lib/marchio.js";

const PUNTI = [
  ["◎", "Coda delle segnalazioni sempre allineata con il sito dello Studio"],
  ["🛡", "Sessione cifrata sul dispositivo e revocabile in ogni momento"],
  ["⚡", "Comando rapido, scorciatoie e azioni di massa per il lavoro di volume"]
];

/** Guscio comune alle due schermate: vetrina a sinistra, riquadro a destra. */
function guscio(riquadro, informazioni) {
  return el("div", { class: "accesso" }, [
    el("aside", { class: "accesso-vetrina" }, [
      marchio({ dimensione: 40 }),
      el("div", { class: "vetrina-claim" }, [
        el("h2", { text: "Gestionale dello Studio" }),
        el("p", { class: "grande", text: "Tutte le segnalazioni dei condomini in un solo posto." }),
        el("p", { class: "sotto", text: `${NOME_STUDIO} — amministrazione condominiale. Questa e la postazione di lavoro dello staff: coda, anagrafiche, comunicazioni e controllo, con gli stessi dati dell'area riservata del sito.` }),
        el("ul", { class: "vetrina-punti" }, PUNTI.map(([segno, testo]) => el("li", {}, [
          el("span", { class: "segno", text: segno }),
          el("span", { text: testo })
        ])))
      ]),
      el("div", { class: "vetrina-piede" }, [
        el("span", { text: `© ${new Date().getFullYear()} ${NOME_STUDIO}` }),
        el("span", { class: "spazio" }),
        el("span", { text: `Versione ${informazioni.versione || "—"}` })
      ])
    ]),
    el("div", { class: "accesso-pannello" }, [riquadro])
  ]);
}

/** Riga di chiusura del riquadro: a quale server stiamo per collegarci. */
function piedeServer(informazioni) {
  let indirizzo = informazioni.baseUrl || "";
  try { indirizzo = new URL(informazioni.baseUrl).host; } catch { /* indirizzo scritto a mano */ }
  return el("p", { class: "accesso-nota" }, [
    el("span", { text: "Server dello Studio: " }),
    el("span", { class: "mono", text: indirizzo || "non configurato" })
  ]);
}

/* =============================================================================
 * Credenziali
 * ========================================================================== */

export function schermataAccesso(radice, { messaggio, informazioni, entrato } = {}) {
  svuota(radice);

  const email = el("input", {
    class: "campo largo", type: "email", autocomplete: "username",
    placeholder: "nome@studio.it", value: informazioni.ultimaEmail || ""
  });
  const password = el("input", {
    class: "campo largo", type: "password", autocomplete: "current-password", placeholder: "Password"
  });

  const mostra = el("button", {
    class: "icona", type: "button", text: "👁", title: "Mostra la password",
    onclick: () => {
      const nascosta = password.type === "password";
      password.type = nascosta ? "text" : "password";
      mostra.title = nascosta ? "Nascondi la password" : "Mostra la password";
      password.focus();
    }
  });

  const avvisoMaiuscole = el("p", { class: "accesso-avviso nascosta" }, [
    el("span", { text: "⇪" }), el("span", { text: "Bloc Maiusc e attivo." })
  ]);

  const ricorda = el("input", { type: "checkbox", checked: !!informazioni.ultimaEmail });
  const errore = el("p", { class: "errore", text: messaggio || "" });
  const bottone = el("button", { class: "bottone primario largo", type: "submit", text: "Accedi" });

  function segnalaMaiuscole(evento) {
    if (typeof evento.getModifierState !== "function") return;
    avvisoMaiuscole.classList.toggle("nascosta", !evento.getModifierState("CapsLock"));
  }

  async function accedi() {
    errore.textContent = "";
    email.classList.remove("guasto");
    password.classList.remove("guasto");

    if (!email.value.trim()) {
      errore.textContent = "Serve l'indirizzo email.";
      email.classList.add("guasto");
      email.focus();
      return;
    }
    if (!password.value) {
      errore.textContent = "Serve la password.";
      password.classList.add("guasto");
      password.focus();
      return;
    }

    bottone.disabled = true;
    bottone.textContent = "Verifico…";
    const esito = await window.studio.login(email.value.trim(), password.value);
    bottone.disabled = false;
    bottone.textContent = "Accedi";

    if (!esito.ok) {
      errore.textContent = esito.errore;
      password.select();
      return;
    }

    // L'email si ricorda solo su richiesta: sulle postazioni condivise dello
    // Studio la casella resta vuota per il collega successivo.
    window.studio.impostazioni({ ultimaEmail: ricorda.checked ? email.value.trim() : "" });

    // Il server decide: o manda il codice a sei cifre, o apre subito la
    // sessione perche riconosce l'app dello Studio (chiave dell'applicazione).
    if (esito.dati && esito.dati.otpRequired) {
      schermataCodice(radice, { datiOtp: esito.dati, informazioni, entrato });
      return;
    }
    entrato();
  }

  for (const campo of [email, password]) {
    campo.addEventListener("keydown", (evento) => {
      segnalaMaiuscole(evento);
      if (evento.key === "Enter") { evento.preventDefault(); accedi(); }
    });
    campo.addEventListener("keyup", segnalaMaiuscole);
  }

  radice.appendChild(guscio(
    el("form", { class: "riquadro accesso-riquadro", onsubmit: (evento) => { evento.preventDefault(); accedi(); } }, [
      el("h1", { text: "Accedi allo Studio" }),
      el("p", { class: "sotto", text: "Le stesse credenziali dell'area riservata del sito." }),
      el("div", { class: "spaziatore" }),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Email" }), email]),
      el("label", { class: "campo-etichetta" }, [
        el("span", { text: "Password" }),
        el("div", { class: "campo-con-azione" }, [password, mostra])
      ]),
      avvisoMaiuscole,
      el("label", { class: "campo-inline" }, [ricorda, el("span", { class: "sotto", text: "Ricorda l'email su questo computer" })]),
      errore,
      bottone,
      el("p", { class: "accesso-nota", text: "Se questo computer e riconosciuto come postazione dello Studio si entra subito; altrimenti arriva un codice di verifica via email." }),
      piedeServer(informazioni)
    ]),
    informazioni
  ));

  (informazioni.ultimaEmail ? password : email).focus();
}

/* =============================================================================
 * Codice a sei cifre
 * ========================================================================== */

export function schermataCodice(radice, { datiOtp, informazioni, entrato }) {
  svuota(radice);

  const caselle = Array.from({ length: 6 }, () => el("input", {
    class: "cifra", inputmode: "numeric", maxlength: "1", autocomplete: "one-time-code"
  }));
  const errore = el("p", { class: "errore" });
  const bottone = el("button", { class: "bottone primario largo", text: "Entra" });
  const rinvia = el("button", { class: "bottone largo", type: "button", text: "Invia di nuovo il codice" });

  const codice = () => caselle.map((c) => c.value).join("");

  function scrivi(testo) {
    const cifre = testo.replace(/\D/g, "").slice(0, 6).split("");
    caselle.forEach((casella, i) => { casella.value = cifre[i] || ""; });
    const prossima = caselle[Math.min(cifre.length, 5)];
    if (prossima) prossima.focus();
    if (cifre.length === 6) verifica();
  }

  caselle.forEach((casella, i) => {
    casella.addEventListener("input", () => {
      // Chi digita in fretta, o incolla dentro una casella, non deve accorgersi
      // che le caselle sono sei e non una.
      if (casella.value.length > 1) { scrivi(casella.value); return; }
      casella.value = casella.value.replace(/\D/g, "");
      if (casella.value && caselle[i + 1]) caselle[i + 1].focus();
      if (codice().length === 6) verifica();
    });
    casella.addEventListener("keydown", (evento) => {
      if (evento.key === "Backspace" && !casella.value && caselle[i - 1]) {
        evento.preventDefault();
        caselle[i - 1].focus();
        caselle[i - 1].value = "";
      }
      if (evento.key === "ArrowLeft" && caselle[i - 1]) caselle[i - 1].focus();
      if (evento.key === "ArrowRight" && caselle[i + 1]) caselle[i + 1].focus();
      if (evento.key === "Enter") verifica();
    });
    casella.addEventListener("paste", (evento) => {
      evento.preventDefault();
      scrivi(evento.clipboardData.getData("text"));
    });
  });

  let inCorso = false;
  async function verifica() {
    if (inCorso) return;
    if (codice().length !== 6) {
      errore.textContent = "Il codice e di sei cifre.";
      return;
    }
    inCorso = true;
    errore.textContent = "";
    bottone.disabled = true;
    bottone.textContent = "Controllo…";

    const esito = await window.studio.verificaOtp(datiOtp.ticket, codice());

    inCorso = false;
    bottone.disabled = false;
    bottone.textContent = "Entra";

    if (!esito.ok) {
      errore.textContent = esito.errore;
      caselle.forEach((c) => { c.value = ""; });
      caselle[0].focus();
      return;
    }
    entrato();
  }

  // Il rinvio si riapre dopo trenta secondi: prima di allora il codice
  // precedente e quasi sempre ancora in arrivo.
  let attesa = 30;
  rinvia.disabled = true;
  const conto = setInterval(() => {
    attesa -= 1;
    if (attesa > 0) {
      rinvia.textContent = `Invia di nuovo il codice (${attesa}s)`;
      return;
    }
    clearInterval(conto);
    rinvia.disabled = false;
    rinvia.textContent = "Invia di nuovo il codice";
  }, 1000);
  rinvia.textContent = `Invia di nuovo il codice (${attesa}s)`;

  rinvia.addEventListener("click", async () => {
    rinvia.disabled = true;
    const esito = await window.studio.reinviaOtp(datiOtp.ticket);
    toast(esito.ok ? "Codice inviato di nuovo." : esito.errore, esito.ok ? "ok" : "errore");
    rinvia.disabled = false;
  });

  bottone.addEventListener("click", verifica);

  radice.appendChild(guscio(
    el("div", { class: "riquadro accesso-riquadro" }, [
      el("h1", { text: "Verifica in due passaggi" }),
      el("p", { class: "sotto", text: `Abbiamo inviato un codice a ${datiOtp.maskedEmail}. Scade tra ${datiOtp.expiresInMinutes} minuti.` }),
      el("div", { class: "cifre" }, caselle),
      errore,
      bottone,
      rinvia,
      el("button", {
        class: "bottone largo", type: "button", text: "Torna indietro",
        onclick: () => { clearInterval(conto); schermataAccesso(radice, { informazioni, entrato }); }
      }),
      piedeServer(informazioni)
    ]),
    informazioni
  ));

  caselle[0].focus();
}
