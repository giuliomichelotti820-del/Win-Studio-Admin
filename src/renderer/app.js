/* =============================================================================
 * Guscio dell'applicazione: accesso, barra laterale, navigazione, comando
 * rapido e scorciatoie da tastiera.
 *
 * Ogni sezione e un modulo che espone `monta(radice, ctx)` e restituisce, se
 * serve, la funzione di smontaggio: cambiare vista non lascia mai in giro
 * timer o ascoltatori di tastiera della vista precedente.
 * ========================================================================== */

import { el, svuota, toast, api } from "./lib/ui.js";

const SEZIONI = [
  { id: "panoramica", titolo: "Panoramica", icona: "◎", modulo: () => import("./views/panoramica.js") },
  { id: "coda", titolo: "Coda segnalazioni", icona: "▤", modulo: () => import("./views/coda.js") },
  { id: "archivio", titolo: "Archivio", icona: "🗄", modulo: () => import("./views/archivio.js") },
  { id: "condomini", titolo: "Condomini", icona: "🏢", modulo: () => import("./views/condomini.js") },
  { id: "morosi", titolo: "Morosi", icona: "€", modulo: () => import("./views/morosi.js") },
  { id: "fornitori", titolo: "Fornitori", icona: "🔧", modulo: () => import("./views/fornitori.js") },
  { id: "whatsapp", titolo: "WhatsApp", icona: "💬", modulo: () => import("./views/whatsapp.js") },
  { id: "posta", titolo: "Posta in arrivo", icona: "✉", modulo: () => import("./views/posta.js") },
  { id: "notifiche", titolo: "Notifiche", icona: "🔔", modulo: () => import("./views/notifiche.js") },
  { id: "studio", titolo: "Studio", icona: "👥", modulo: () => import("./views/staff.js") },
  { id: "controllo", titolo: "Controllo", icona: "🛡", modulo: () => import("./views/controllo.js") },
  { id: "impostazioni", titolo: "Impostazioni", icona: "⚙", modulo: () => import("./views/impostazioni.js") }
];

const radice = document.getElementById("app");
let stato = null;
let smontaVista = null;
let vistaCorrente = null;
let contenitoreVista = null;
let badgeNotifiche = null;
let barraAggiornamento = null;

/* =============================================================================
 * Accesso
 * ========================================================================== */

function schermataAccesso(messaggio) {
  svuota(radice);

  const email = el("input", { class: "campo largo", type: "email", placeholder: "nome@studio.it", autofocus: true });
  const password = el("input", { class: "campo largo", type: "password", placeholder: "Password" });
  const errore = el("p", { class: "errore", text: messaggio || "" });
  const bottone = el("button", { class: "bottone primario largo", text: "Accedi" });

  async function accedi() {
    errore.textContent = "";
    if (!email.value.trim() || !password.value) {
      errore.textContent = "Servono email e password.";
      return;
    }
    bottone.disabled = true;
    bottone.textContent = "Verifico…";
    const esito = await window.studio.login(email.value.trim(), password.value);
    bottone.disabled = false;
    bottone.textContent = "Accedi";

    if (!esito.ok) {
      errore.textContent = esito.errore;
      return;
    }
    // Il server decide: o manda il codice a sei cifre, o apre subito la
    // sessione perche riconosce l'app dello Studio (chiave dell'applicazione).
    if (esito.dati && esito.dati.otpRequired) {
      schermataCodice(esito.dati);
      return;
    }
    avvia();
  }

  bottone.addEventListener("click", accedi);
  for (const campo of [email, password]) {
    campo.addEventListener("keydown", (evento) => { if (evento.key === "Enter") accedi(); });
  }

  radice.appendChild(el("div", { class: "accesso" }, [
    el("form", { class: "riquadro accesso-riquadro", onsubmit: (e) => e.preventDefault() }, [
      el("h1", { text: "Win Studio Admin" }),
      el("p", { class: "sotto", text: "Gestione segnalazioni dello Studio Associato Amm. Burchielli" }),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Email" }), email]),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Password" }), password]),
      errore,
      bottone,
      el("p", { class: "sotto", text: "Sono le stesse credenziali dell'area riservata del sito. Se questo computer e riconosciuto come postazione dello Studio si entra subito; altrimenti arriva un codice via email." })
    ])
  ]));

  email.focus();
}

function schermataCodice(datiOtp) {
  svuota(radice);

  const codice = el("input", {
    class: "campo largo codice", inputmode: "numeric", maxlength: "6", placeholder: "······"
  });
  const errore = el("p", { class: "errore" });
  const bottone = el("button", { class: "bottone primario largo", text: "Entra" });

  async function verifica() {
    if (!/^\d{6}$/.test(codice.value)) {
      errore.textContent = "Il codice e di sei cifre.";
      return;
    }
    bottone.disabled = true;
    bottone.textContent = "Controllo…";
    const esito = await window.studio.verificaOtp(datiOtp.ticket, codice.value);
    bottone.disabled = false;
    bottone.textContent = "Entra";
    if (!esito.ok) {
      errore.textContent = esito.errore;
      codice.select();
      return;
    }
    avvia();
  }

  bottone.addEventListener("click", verifica);
  codice.addEventListener("keydown", (evento) => { if (evento.key === "Enter") verifica(); });
  // Sei cifre incollate o digitate: si entra senza toccare il mouse.
  codice.addEventListener("input", () => { if (/^\d{6}$/.test(codice.value)) verifica(); });

  radice.appendChild(el("div", { class: "accesso" }, [
    el("div", { class: "riquadro accesso-riquadro" }, [
      el("h1", { text: "Codice di accesso" }),
      el("p", { class: "sotto", text: `Abbiamo inviato un codice a ${datiOtp.maskedEmail}. Scade tra ${datiOtp.expiresInMinutes} minuti.` }),
      codice,
      errore,
      bottone,
      el("button", {
        class: "bottone largo", text: "Invia di nuovo il codice",
        onclick: async () => {
          const esito = await window.studio.reinviaOtp(datiOtp.ticket);
          toast(esito.ok ? "Codice inviato di nuovo." : esito.errore, esito.ok ? "ok" : "errore");
        }
      }),
      el("button", { class: "bottone largo", text: "Torna indietro", onclick: () => schermataAccesso() })
    ])
  ]));

  codice.focus();
}

/* =============================================================================
 * Guscio
 * ========================================================================== */

function costruisciGuscio() {
  svuota(radice);

  const laterale = el("nav", { class: "laterale" }, [
    el("div", { class: "marchio" }, [
      el("span", { class: "marchio-punto" }),
      el("span", { text: "Win Studio Admin" })
    ]),
    ...SEZIONI.map((sezione, indice) => el("button", {
      class: "voce-menu", dataSezione: sezione.id,
      onclick: () => naviga(sezione.id)
    }, [
      el("span", { class: "icona-menu", text: sezione.icona }),
      el("span", { text: sezione.titolo }),
      indice < 9 ? el("span", { class: "tasto", text: `Ctrl+${indice + 1}` }) : null
    ])),
    el("div", { class: "spazio" }),
    el("div", { class: "utente" }, [
      el("strong", { text: stato.utente.fullName }),
      el("span", { class: "sotto", text: stato.utente.role === "super_admin" ? "Titolare" : "Dipendente" })
    ])
  ]);

  badgeNotifiche = el("span", { class: "badge nascosta" });

  const testa = el("header", { class: "testa" }, [
    el("button", { class: "bottone", text: "⌘ Comando rapido  (Ctrl+K)", onclick: apriPalette }),
    el("span", { class: "spazio" }),
    el("button", { class: "bottone", onclick: () => naviga("notifiche") }, [
      el("span", { text: "🔔 Notifiche" }), badgeNotifiche
    ]),
    el("button", { class: "bottone", text: "Nuova ricerca", onclick: () => naviga("coda") })
  ]);

  contenitoreVista = el("main", { class: "vista" });
  barraAggiornamento = el("div", { class: "barra-aggiornamento nascosta" });

  radice.append(el("div", { class: "guscio" }, [
    laterale,
    el("div", { class: "corpo" }, [testa, barraAggiornamento, contenitoreVista])
  ]));

  window.studio.statoAggiornamento().then(mostraAggiornamento);
}

function evidenziaMenu(idSezione) {
  for (const voce of radice.querySelectorAll(".voce-menu")) {
    voce.classList.toggle("attiva", voce.getAttribute("data-sezione") === idSezione);
  }
}

/* =============================================================================
 * Navigazione
 * ========================================================================== */

async function naviga(destinazione, parametri = {}) {
  if (typeof smontaVista === "function") {
    try { smontaVista(); } catch (errore) { console.error(errore); }
    smontaVista = null;
  }

  const [nome, parametro] = String(destinazione).split(":");
  const sezione = nome === "ticket"
    ? { id: "ticket", titolo: "Segnalazione", modulo: () => import("./views/ticket.js") }
    : SEZIONI.find((s) => s.id === nome) || SEZIONI[0];

  vistaCorrente = sezione.id;
  evidenziaMenu(sezione.id === "ticket" ? "coda" : sezione.id);
  svuota(contenitoreVista);
  document.title = `${sezione.titolo} · Win Studio Admin`;

  const ctx = {
    utente: stato.utente,
    impostazioni: stato.impostazioni,
    versione: stato.versione,
    parametro,
    parametri,
    filtriIniziali: nome === "coda" ? parametri : null,
    naviga,
    ricarica: () => avvia()
  };

  try {
    const modulo = await sezione.modulo();
    smontaVista = await modulo.default(contenitoreVista, ctx);
  } catch (errore) {
    console.error(errore);
    contenitoreVista.appendChild(el("p", { class: "errore", text: `Sezione non caricata: ${errore.message}` }));
  }

  if (stato.impostazioni.ultimaVista !== sezione.id && sezione.id !== "ticket") {
    window.studio.impostazioni({ ultimaVista: sezione.id });
    stato.impostazioni.ultimaVista = sezione.id;
  }
}

/* =============================================================================
 * Comando rapido (Ctrl+K)
 *
 * Una sola casella per tutto: le sezioni, le azioni piu frequenti e la ricerca
 * di una pratica per numero, oggetto o richiedente. Chi lavora tutto il giorno
 * qui dentro non deve cercare un pulsante con il mouse.
 * ========================================================================== */

function apriPalette() {
  const esistente = document.querySelector(".palette-sfondo");
  if (esistente) esistente.remove();

  const campo = el("input", { class: "palette-campo", placeholder: "Vai a… oppure cerca una pratica" });
  const risultati = el("div", { class: "palette-risultati" });
  const sfondo = el("div", { class: "palette-sfondo" }, [
    el("div", { class: "palette" }, [campo, risultati])
  ]);

  let voci = [];
  let indice = 0;

  const azioni = [
    ...SEZIONI.map((s) => ({ etichetta: `Vai a ${s.titolo}`, azione: () => naviga(s.id) })),
    { etichetta: "Coda: solo urgenti aperte", azione: () => naviga("coda", { status: "aperte", priority: "urgente" }) },
    { etichetta: "Coda: non assegnate", azione: () => naviga("coda", { status: "aperte", assegnate: "nessuno" }) },
    { etichetta: "Coda: assegnate a me", azione: () => naviga("coda", { status: "aperte", assegnate: "mie" }) },
    { etichetta: "Coda: arrivate dal modulo contatti", azione: () => naviga("coda", { status: "aperte", channel: "contatto" }) },
    { etichetta: "Controllo: sessioni attive", azione: () => naviga("controllo", { scheda: "sessioni" }) },
    { etichetta: "Controllo: attivita dello staff", azione: () => naviga("controllo", { scheda: "attivita" }) },
    { etichetta: "Controllo: credenziali dipendenti", azione: () => naviga("controllo", { scheda: "dipendenti" }) },
    { etichetta: "Controllo: credenziali condomini", azione: () => naviga("controllo", { scheda: "condomini" }) },
    { etichetta: "Aggiorna le notifiche adesso", azione: () => window.studio.aggiornaNotifiche() },
    { etichetta: "Esci dall'account", azione: async () => { await window.studio.logout(); location.reload(); } }
  ];

  function disegna() {
    svuota(risultati);
    voci.forEach((voce, i) => {
      risultati.appendChild(el("button", {
        class: `palette-voce ${i === indice ? "attiva" : ""}`,
        onclick: () => { chiudi(); voce.azione(); }
      }, [
        el("span", { text: voce.etichetta }),
        voce.dettaglio ? el("span", { class: "sotto", text: voce.dettaglio }) : null
      ]));
    });
  }

  function filtra(testo) {
    const q = testo.toLowerCase().trim();
    voci = azioni.filter((a) => !q || a.etichetta.toLowerCase().includes(q)).slice(0, 8);
    indice = 0;
    disegna();
    if (q.length >= 2) cercaPratiche(q);
  }

  let timer = null;
  async function cercaPratiche(q) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const dati = await api.get(`/api/tickets?q=${encodeURIComponent(q)}&perPage=8&status=`);
        const trovate = (dati.tickets || []).map((t) => ({
          etichetta: `${t.ticket_number} · ${t.subject}`,
          dettaglio: `${t.condominio_nome || ""} · ${t.status}`,
          azione: () => naviga(`ticket:${t.id}`)
        }));
        voci = [...voci.filter((v) => !v.dettaglio), ...trovate];
        disegna();
      } catch { /* la ricerca e un aiuto, non deve bloccare la palette */ }
    }, 200);
  }

  function chiudi() {
    sfondo.remove();
    document.removeEventListener("keydown", suTasto, true);
  }

  function suTasto(evento) {
    if (evento.key === "Escape") { evento.stopPropagation(); chiudi(); }
    else if (evento.key === "ArrowDown") { evento.preventDefault(); indice = Math.min(voci.length - 1, indice + 1); disegna(); }
    else if (evento.key === "ArrowUp") { evento.preventDefault(); indice = Math.max(0, indice - 1); disegna(); }
    else if (evento.key === "Enter" && voci[indice]) { evento.preventDefault(); chiudi(); voci[indice].azione(); }
  }

  campo.addEventListener("input", () => filtra(campo.value));
  sfondo.addEventListener("mousedown", (evento) => { if (evento.target === sfondo) chiudi(); });
  document.addEventListener("keydown", suTasto, true);

  document.body.appendChild(sfondo);
  filtra("");
  campo.focus();
}

/* =============================================================================
 * Scorciatoie globali dell'applicazione
 * ========================================================================== */

function scorciatoie() {
  document.addEventListener("keydown", (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
      evento.preventDefault();
      apriPalette();
      return;
    }
    if ((evento.ctrlKey || evento.metaKey) && evento.key >= "1" && evento.key <= "9") {
      const sezione = SEZIONI[Number(evento.key) - 1];
      if (sezione) { evento.preventDefault(); naviga(sezione.id); }
      return;
    }
    if (evento.key === "F5" || ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "r")) {
      evento.preventDefault();
      naviga(vistaCorrente || "coda");
    }
  });
}

/* =============================================================================
 * Avvio
 * ========================================================================== */

function applicaTema(tema) {
  document.documentElement.dataset.tema = tema === "chiaro" ? "chiaro" : tema === "scuro" ? "scuro" : "";
}

async function avvia() {
  stato = await window.studio.stato();
  applicaTema(stato.impostazioni.tema);

  if (!stato.autenticato) {
    schermataAccesso();
    return;
  }

  costruisciGuscio();
  await naviga(stato.impostazioni.ultimaVista || "panoramica");
}

/* =============================================================================
 * Aggiornamento dell'applicazione
 *
 * La nuova versione arriva da sola: qui si vede solo a che punto e, e si puo
 * chiedere il riavvio quando fa comodo. Chi non tocca niente la trova
 * installata alla prossima apertura.
 * ========================================================================== */

function mostraAggiornamento(stato) {
  if (!barraAggiornamento || !stato) return;

  const visibile = ["scaricamento", "pronta", "errore"].includes(stato.fase);
  barraAggiornamento.classList.toggle("nascosta", !visibile);
  if (!visibile) return;

  svuota(barraAggiornamento);
  barraAggiornamento.classList.toggle("guasta", stato.fase === "errore");

  if (stato.fase === "scaricamento") {
    barraAggiornamento.append(
      el("span", { text: `Sto scaricando la versione ${stato.versione || ""}… ${stato.percentuale || 0}%` })
    );
    return;
  }

  if (stato.fase === "errore") {
    barraAggiornamento.append(
      el("span", { text: `Aggiornamento non riuscito: ${stato.errore}` }),
      el("span", { class: "spazio" }),
      el("button", { class: "bottone piccolo", text: "Riprova", onclick: () => window.studio.controllaAggiornamento() })
    );
    return;
  }

  barraAggiornamento.append(
    el("span", { text: `E pronta la versione ${stato.versione}. Verra installata alla chiusura dell'app.` }),
    el("span", { class: "spazio" }),
    el("button", {
      class: "bottone piccolo", text: "Riavvia e aggiorna adesso",
      onclick: () => window.studio.installaAggiornamento()
    })
  );
}

window.studio.su("app:aggiornamento", mostraAggiornamento);

window.studio.su("app:naviga", (destinazione) => { if (stato && stato.autenticato) naviga(destinazione); });

window.studio.su("app:notifiche", ({ nonLette }) => {
  if (!badgeNotifiche) return;
  badgeNotifiche.textContent = String(nonLette);
  badgeNotifiche.classList.toggle("nascosta", !nonLette);
});

window.studio.su("app:sessione-scaduta", () => {
  toast("Sessione scaduta: serve un nuovo accesso.", "avviso");
  schermataAccesso("La sessione e scaduta. Accedi di nuovo.");
});

window.studio.su("app:scorciatoia-globale", () => { if (stato && stato.autenticato) apriPalette(); });

scorciatoie();
avvia();
