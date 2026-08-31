/* =============================================================================
 * Pannello di controllo — solo per il titolare (super_admin).
 *
 * Quattro domande, quattro schede:
 *   · chi sta lavorando adesso, da quale computer e da quanto (Sessioni);
 *   · che cosa ha fatto ciascun dipendente nel periodo (Attivita);
 *   · chi entra nel gestionale e con quali credenziali (Dipendenti);
 *   · chi sono i condomini registrati e come si sblocca chi resta fuori
 *     (Condomini).
 *
 * Tutte le operazioni delicate — reset di una password, chiusura di una
 * sessione, disattivazione di un account — lasciano traccia nel diario dello
 * Studio con il nome di chi le ha fatte: e la contropartita di poterle fare da
 * qui in tre secondi.
 * ========================================================================== */

import {
  el, svuota, api, toast, dataOra, daQuando, statoVuoto, caricamento, modale, conferma
} from "../lib/ui.js";

const SCHEDE = [
  ["sessioni", "Sessioni attive"],
  ["attivita", "Attivita dello staff"],
  ["dipendenti", "Credenziali dipendenti"],
  ["condomini", "Credenziali condomini"],
  ["diario", "Diario completo"]
];

const NOMI_CLIENT = { web: "Browser", mobile: "App Android", desktop: "App Windows" };

const AZIONI = {
  login: "Accesso",
  login_desktop: "Accesso da app Windows",
  login_failed: "Accesso fallito",
  login_otp_sent: "Codice inviato",
  logout: "Uscita",
  post_message: "Risposta su pratica",
  create_ticket: "Nuova pratica",
  update_ticket: "Modifica pratica",
  revoke_session: "Sessione chiusa",
  control_set_password: "Password reimpostata",
  control_update_user: "Account modificato",
  create_employee: "Dipendente creato",
  deactivate_employee: "Dipendente disattivato",
  reactivate_employee: "Dipendente riattivato",
  upload_document: "Documento caricato",
  session_resumed: "Sessione ripresa"
};

function etichettaAzione(azione) {
  return AZIONI[azione] || String(azione).replace(/_/g, " ");
}

export default async function monta(radice, ctx) {
  if (ctx.utente.role !== "super_admin") {
    radice.appendChild(statoVuoto(
      "Pannello riservato al titolare.",
      "L'analisi delle sessioni e la gestione delle credenziali non sono accessibili agli account dipendente."
    ));
    return () => {};
  }

  let schedaAperta = (ctx.parametri && ctx.parametri.scheda) || "sessioni";
  let giorni = 30;

  const navigazione = el("nav", { class: "schede" });
  const contenuto = el("div", { class: "scheda-contenuto" });
  radice.append(el("h1", { class: "titolo-pagina", text: "Controllo" }), navigazione, contenuto);

  function disegnaNavigazione() {
    svuota(navigazione);
    for (const [id, etichetta] of SCHEDE) {
      navigazione.appendChild(el("button", {
        class: `scheda-tab ${schedaAperta === id ? "attiva" : ""}`,
        text: etichetta,
        onclick: () => { schedaAperta = id; apri(); }
      }));
    }
  }

  function apri() {
    disegnaNavigazione();
    svuota(contenuto).appendChild(caricamento());
    if (schedaAperta === "sessioni") sessioni();
    else if (schedaAperta === "attivita") attivita();
    else if (schedaAperta === "dipendenti") utenti("staff");
    else if (schedaAperta === "condomini") utenti("condomino");
    else diario();
  }

  /* --- Sessioni attive ------------------------------------------------------ */

  async function sessioni() {
    try {
      const righe = await api.get("/api/control/sessions");
      const staff = righe.filter((r) => r.role !== "condomino");
      const condomini = righe.filter((r) => r.role === "condomino");

      svuota(contenuto).append(
        el("div", { class: "toolbar" }, [
          el("span", { class: "riepilogo", text: `${righe.length} sessioni aperte · ${staff.length} dello Studio · ${condomini.length} di condomini` }),
          el("span", { class: "spazio" }),
          el("button", { class: "bottone", text: "Aggiorna", onclick: apri })
        ]),
        tabellaSessioni("Studio", staff),
        tabellaSessioni("Condomini", condomini)
      );
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Sessioni non disponibili.", errore.message));
    }
  }

  function tabellaSessioni(titolo, righe) {
    return el("section", { class: "riquadro" }, [
      el("h2", { text: `${titolo} (${righe.length})` }),
      righe.length
        ? el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Persona" }), el("th", { text: "Da dove" }),
              el("th", { text: "Aperta" }), el("th", { text: "Ultima attivita" }),
              el("th", { text: "Scade" }), el("th", { text: "" })
            ])]),
            el("tbody", {}, righe.map((s) => {
              const viva = s.last_seen_at && Date.now() - new Date(`${String(s.last_seen_at).replace(" ", "T")}Z`).getTime() < 2 * 60 * 60 * 1000;
              return el("tr", { class: s.suspended_at ? "spenta" : "" }, [
                el("td", {}, [
                  el("strong", { text: s.full_name }),
                  el("div", { class: "sotto", text: s.email }),
                  viva ? el("span", { class: "pill pill-stato-risolta", text: "attiva ora" }) : null
                ]),
                el("td", {}, [
                  el("div", { text: `${NOMI_CLIENT[s.client] || s.client || "Browser"}${s.device_name ? ` · ${s.device_name}` : ""}` }),
                  el("div", { class: "sotto testo-breve", text: (s.user_agent || "").slice(0, 80) })
                ]),
                el("td", { text: dataOra(s.created_at) }),
                el("td", { title: dataOra(s.last_seen_at), text: s.last_seen_at ? daQuando(s.last_seen_at) : "—" }),
                el("td", { text: dataOra(s.expires_at) }),
                el("td", {}, [el("button", {
                  class: "bottone piccolo pericolo", text: "Chiudi",
                  onclick: async () => {
                    if (!(await conferma(`Chiudere la sessione di ${s.full_name}? Quel dispositivo dovra rientrare.`))) return;
                    try {
                      await api.del(`/api/control/sessions/${s.id}`);
                      toast("Sessione chiusa.", "ok");
                      apri();
                    } catch (errore) { toast(errore.message, "errore"); }
                  }
                })])
              ]);
            }))
          ])
        : statoVuoto("Nessuna sessione aperta.")
    ]);
  }

  /* --- Attivita dello staff ------------------------------------------------- */

  async function attivita() {
    try {
      const dati = await api.get(`/api/control/staff-activity?days=${giorni}`);
      const righe = dati.staff || [];

      const periodo = el("select", { class: "campo" }, [7, 14, 30, 90, 365].map((g) =>
        el("option", { value: g, text: `Ultimi ${g} giorni`, selected: g === giorni })));
      periodo.addEventListener("change", () => { giorni = Number(periodo.value); apri(); });

      svuota(contenuto).append(
        el("div", { class: "toolbar" }, [periodo, el("button", { class: "bottone", text: "Aggiorna", onclick: apri })]),
        el("section", { class: "riquadro" }, [
          el("h2", { text: `Cosa ha fatto ciascuno (${dati.giorni} giorni)` }),
          el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Persona" }), el("th", { text: "Accessi" }),
              el("th", { text: "Risposte" }), el("th", { text: "Note interne" }),
              el("th", { text: "Cambi di stato" }), el("th", { text: "Chiusure" }),
              el("th", { text: "In carico" }), el("th", { text: "Sessioni" }),
              el("th", { text: "Ultima attivita" })
            ])]),
            el("tbody", {}, righe.map((r) => el("tr", { class: r.active === 0 ? "spenta" : "" }, [
              el("td", {}, [
                el("strong", { text: r.full_name }),
                el("div", { class: "sotto", text: `${r.email} · ${r.role === "super_admin" ? "titolare" : "dipendente"}` }),
                r.locked_until ? el("span", { class: "pill pill-avviso", text: "bloccato" }) : null
              ]),
              el("td", {}, [
                el("div", { text: String(r.accessi || 0) }),
                r.accessi_desktop ? el("div", { class: "sotto", text: `${r.accessi_desktop} da app` }) : null,
                r.tentativi_falliti ? el("div", { class: "sotto attenzione", text: `${r.tentativi_falliti} falliti` }) : null
              ]),
              el("td", { text: String(r.risposte || 0) }),
              el("td", { text: String(r.note_interne || 0) }),
              el("td", { text: String(r.cambi_stato || 0) }),
              el("td", { text: String(r.chiusure || 0) }),
              el("td", { text: String(r.in_carico || 0) }),
              el("td", {}, [
                el("div", { text: String(r.sessioni_attive || 0) }),
                r.client ? el("div", { class: "sotto", text: String(r.client).split(",").map((c) => NOMI_CLIENT[c] || c).join(", ") }) : null
              ]),
              el("td", { title: dataOra(r.ultima_attivita), text: r.ultima_attivita ? daQuando(r.ultima_attivita) : "—" })
            ])))
          ])
        ]),
        el("section", { class: "riquadro" }, [
          el("h2", { text: "Ultimi eventi dello staff" }),
          (dati.ultimiEventi || []).length
            ? el("table", { class: "tabella densa" }, [
                el("tbody", {}, dati.ultimiEventi.map((e) => el("tr", {}, [
                  el("td", { text: dataOra(e.created_at) }),
                  el("td", { text: e.full_name }),
                  el("td", { text: etichettaAzione(e.action) }),
                  el("td", { class: "sotto", text: [e.entity_type, e.entity_id].filter(Boolean).join(" ") })
                ])))
              ])
            : statoVuoto("Nessun evento nel periodo.")
        ])
      );
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Attivita non disponibile.", errore.message));
    }
  }

  /* --- Credenziali ----------------------------------------------------------- */

  async function utenti(gruppo) {
    let ricercaTesto = "";

    async function carica() {
      const parametri = new URLSearchParams({ perPage: "100" });
      if (ricercaTesto) parametri.set("q", ricercaTesto);
      if (gruppo === "condomino") parametri.set("role", "condomino");

      const dati = await api.get(`/api/control/users?${parametri}`);
      let righe = dati.users || [];
      if (gruppo === "staff") righe = righe.filter((u) => u.role !== "condomino");

      const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca nome o email…", value: ricercaTesto });
      let timer = null;
      ricerca.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { ricercaTesto = ricerca.value.trim(); carica(); }, 250);
      });

      svuota(contenuto).append(
        el("div", { class: "toolbar" }, [
          ricerca,
          gruppo === "staff"
            ? el("button", { class: "bottone primario", text: "Nuovo dipendente", onclick: nuovoDipendente })
            : null,
          el("span", { class: "riepilogo", text: `${righe.length} account` })
        ]),
        righe.length
          ? el("table", { class: "tabella densa" }, [
              el("thead", {}, [el("tr", {}, [
                el("th", { text: "Persona" }), el("th", { text: "Ruolo" }),
                el("th", { text: "Stato" }), el("th", { text: "Ultimo accesso" }),
                gruppo === "condomino" ? el("th", { text: "Condomini" }) : el("th", { text: "Registrato" }),
                el("th", { text: "Azioni" })
              ])]),
              el("tbody", {}, righe.map((u) => el("tr", { class: u.active === 0 ? "spenta" : "" }, [
                el("td", {}, [el("strong", { text: u.full_name }), el("div", { class: "sotto", text: u.email })]),
                el("td", { text: u.role === "super_admin" ? "Titolare" : u.role === "dipendente" ? "Dipendente" : "Condomino" }),
                el("td", {}, [
                  el("span", {
                    class: `pill ${u.active ? "pill-stato-risolta" : "pill-stato-chiusa"}`,
                    text: u.active ? "attivo" : "disattivato"
                  }),
                  u.locked_until ? el("div", { class: "sotto attenzione", text: `bloccato fino a ${dataOra(u.locked_until)}` }) : null,
                  u.failed_login_count ? el("div", { class: "sotto", text: `${u.failed_login_count} tentativi falliti` }) : null
                ]),
                el("td", { text: u.last_login_at ? dataOra(u.last_login_at) : "mai" }),
                el("td", { class: "testo-breve", text: gruppo === "condomino" ? (u.condomini || "—") : dataOra(u.created_at) }),
                el("td", { class: "azioni" }, [
                  el("button", { class: "bottone piccolo", text: "Password", onclick: () => cambiaPassword(u, carica) }),
                  u.locked_until || u.failed_login_count
                    ? el("button", {
                        class: "bottone piccolo", text: "Sblocca",
                        onclick: () => modificaUtente(u, { unlock: true }, "Account sbloccato.", carica)
                      })
                    : null,
                  u.id === ctx.utente.id
                    ? null
                    : el("button", {
                        class: "bottone piccolo", text: u.active ? "Disattiva" : "Riattiva",
                        onclick: async () => {
                          if (u.active && !(await conferma(`Disattivare l'account di ${u.full_name}? Le sue sessioni verranno chiuse.`))) return;
                          modificaUtente(u, { active: !u.active }, "Account aggiornato.", carica);
                        }
                      }),
                  gruppo === "staff" && u.id !== ctx.utente.id
                    ? el("button", {
                        class: "bottone piccolo", text: u.role === "dipendente" ? "Rendi titolare" : "Rendi dipendente",
                        onclick: async () => {
                          const nuovo = u.role === "dipendente" ? "super_admin" : "dipendente";
                          if (!(await conferma(`Cambiare il ruolo di ${u.full_name} in "${nuovo === "super_admin" ? "titolare" : "dipendente"}"?`))) return;
                          modificaUtente(u, { role: nuovo }, "Ruolo aggiornato.", carica);
                        }
                      })
                    : null
                ])
              ])))
            ])
          : statoVuoto("Nessun account trovato.")
      );
    }

    try {
      await carica();
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Account non disponibili.", errore.message));
    }
  }

  async function modificaUtente(utente, modifica, messaggio, ricarica) {
    try {
      await api.patch(`/api/control/users/${utente.id}`, modifica);
      toast(messaggio, "ok");
      ricarica();
    } catch (errore) {
      toast(errore.message, "errore");
    }
  }

  function cambiaPassword(utente, ricarica) {
    const password = el("input", { class: "campo largo", type: "text", value: generaPassword() });
    const ripeti = el("input", { class: "campo largo", type: "text" });

    modale({
      titolo: `Nuova password — ${utente.full_name}`,
      contenuto: el("div", { class: "colonna" }, [
        el("p", { class: "sotto", text: "Almeno 12 caratteri con maiuscola, minuscola, numero e carattere speciale. Tutte le sessioni aperte di questo account verranno chiuse." }),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Password" }), password]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Ripeti" }), ripeti]),
        el("button", { class: "bottone", text: "Genera un'altra", onclick: () => { password.value = generaPassword(); ripeti.value = ""; } }),
        el("p", { class: "avviso-locale", text: "Consegna la password a voce o di persona: qui resta visibile solo finche la finestra e aperta." })
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Imposta", primaria: true,
          azione: async (chiudi) => {
            if (ripeti.value && ripeti.value !== password.value) { toast("Le due password non coincidono.", "avviso"); return; }
            try {
              const esito = await api.post(`/api/control/users/${utente.id}/password`, { password: password.value });
              chiudi();
              toast(esito.message || "Password aggiornata.", "ok");
              ricarica();
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  // Password proposta: rispetta le regole del server e non costringe a
  // inventarne una al momento, che e come nascono quelle deboli.
  function generaPassword() {
    const gruppi = [
      "ABCDEFGHJKLMNPQRSTUVWXYZ",
      "abcdefghijkmnopqrstuvwxyz",
      "23456789",
      "!@#$%&*?-+"
    ];
    const casuali = new Uint32Array(16);
    crypto.getRandomValues(casuali);
    const tutti = gruppi.join("");
    const caratteri = gruppi.map((g, i) => g[casuali[i] % g.length]);
    for (let i = 4; i < 16; i += 1) caratteri.push(tutti[casuali[i] % tutti.length]);
    return caratteri.sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] > 127 ? 1 : -1)).join("");
  }

  function nuovoDipendente() {
    const nome = el("input", { class: "campo largo" });
    const email = el("input", { class: "campo largo", type: "email" });
    const password = el("input", { class: "campo largo", type: "text", value: generaPassword() });

    modale({
      titolo: "Nuovo dipendente",
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Nome e cognome" }), nome]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Email" }), email]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Password iniziale" }), password]),
        el("p", { class: "sotto", text: "L'account nasce come dipendente; il ruolo si cambia poi dall'elenco." })
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Crea", primaria: true,
          azione: async (chiudi) => {
            try {
              await api.post("/api/admin/employees", {
                fullName: nome.value, email: email.value, password: password.value
              });
              chiudi();
              toast("Dipendente creato.", "ok");
              apri();
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  /* --- Diario completo -------------------------------------------------------- */

  async function diario() {
    let filtri = { q: "", action: "", days: 30, staff: "1", page: 1 };

    async function carica() {
      const parametri = new URLSearchParams({ perPage: "80", page: String(filtri.page), days: String(filtri.days) });
      if (filtri.q) parametri.set("q", filtri.q);
      if (filtri.action) parametri.set("action", filtri.action);
      if (filtri.staff) parametri.set("staff", "1");

      const dati = await api.get(`/api/control/audit?${parametri}`);

      const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca azione o persona…", value: filtri.q });
      let timer = null;
      ricerca.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { filtri.q = ricerca.value.trim(); filtri.page = 1; carica(); }, 250);
      });

      const soloStaff = el("input", { type: "checkbox", checked: !!filtri.staff });
      soloStaff.addEventListener("change", () => { filtri.staff = soloStaff.checked ? "1" : ""; filtri.page = 1; carica(); });

      const periodo = el("select", { class: "campo" }, [7, 30, 90, 365].map((g) =>
        el("option", { value: g, text: `Ultimi ${g} giorni`, selected: g === filtri.days })));
      periodo.addEventListener("change", () => { filtri.days = Number(periodo.value); filtri.page = 1; carica(); });

      svuota(contenuto).append(
        el("div", { class: "toolbar" }, [
          ricerca, periodo,
          el("label", { class: "campo-inline" }, [soloStaff, el("span", { text: "Solo Studio" })]),
          el("span", { class: "riepilogo", text: `${dati.total} eventi` })
        ]),
        (dati.logs || []).length
          ? el("table", { class: "tabella densa" }, [
              el("thead", {}, [el("tr", {}, [
                el("th", { text: "Quando" }), el("th", { text: "Chi" }),
                el("th", { text: "Azione" }), el("th", { text: "Oggetto" }), el("th", { text: "Dettagli" })
              ])]),
              el("tbody", {}, dati.logs.map((r) => el("tr", {}, [
                el("td", { text: dataOra(r.created_at) }),
                el("td", {}, [el("div", { text: r.full_name || "—" }), el("div", { class: "sotto", text: r.email || "" })]),
                el("td", { text: etichettaAzione(r.action) }),
                el("td", { class: "sotto", text: [r.entity_type, r.entity_id].filter(Boolean).join(" ") }),
                el("td", { class: "sotto testo-breve", text: r.metadata || "" })
              ])))
            ])
          : statoVuoto("Nessun evento con questi filtri."),
        el("div", { class: "piede-coda" }, [
          el("button", {
            class: "bottone", text: "‹ Precedente", disabled: filtri.page <= 1,
            onclick: () => { filtri.page -= 1; carica(); }
          }),
          el("button", {
            class: "bottone", text: "Successiva ›",
            disabled: filtri.page * dati.perPage >= dati.total,
            onclick: () => { filtri.page += 1; carica(); }
          })
        ])
      );
    }

    try {
      await carica();
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Diario non disponibile.", errore.message));
    }
  }

  apri();
  return () => {};
}
