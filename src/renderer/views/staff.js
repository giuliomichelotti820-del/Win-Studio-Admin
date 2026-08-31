/* =============================================================================
 * Studio: account dipendente, invio email dallo Studio e invito di un nuovo
 * cliente. Riservato al super_admin — un dipendente vede la sezione ma il
 * server rifiuta le operazioni, quindi qui la si nasconde del tutto.
 * ========================================================================== */

import { el, svuota, api, toast, dataOra, statoVuoto, caricamento, modale } from "../lib/ui.js";

export default async function monta(radice, ctx) {
  if (ctx.utente.role !== "super_admin") {
    radice.appendChild(statoVuoto("Sezione riservata.", "La gestione degli account e delle email e affidata al titolare dello Studio."));
    return () => {};
  }

  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  barra.append(
    el("button", { class: "bottone", text: "Aggiorna", onclick: carica }),
    el("button", { class: "bottone primario", text: "Nuovo dipendente", onclick: nuovoDipendente }),
    el("button", { class: "bottone", text: "Invita cliente", onclick: invitaCliente }),
    el("button", { class: "bottone", text: "Scrivi email", onclick: scriviEmail }),
    el("button", { class: "bottone", text: "Stato posta", onclick: statoPosta })
  );

  async function carica() {
    svuota(corpo).appendChild(caricamento());
    try {
      const dipendenti = await api.get("/api/admin/employees");
      disegna(dipendenti || []);
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function disegna(dipendenti) {
    svuota(corpo);
    corpo.appendChild(el("table", { class: "tabella densa" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Persona" }), el("th", { text: "Ruolo" }), el("th", { text: "Assegnate" }),
        el("th", { text: "Aperte" }), el("th", { text: "Risolte" }), el("th", { text: "Ultimo accesso" }), el("th", { text: "" })
      ])]),
      el("tbody", {}, dipendenti.map((d) => el("tr", { class: d.active === 0 ? "spenta" : "" }, [
        el("td", {}, [el("strong", { text: d.full_name }), el("div", { class: "sotto", text: d.email })]),
        el("td", { text: d.role === "super_admin" ? "Titolare" : "Dipendente" }),
        el("td", { text: String(d.assigned_count ?? 0) }),
        el("td", { text: String(d.open_count ?? 0) }),
        el("td", { text: String(d.resolved_count ?? 0) }),
        el("td", { text: d.last_login_at ? dataOra(d.last_login_at) : "—" }),
        el("td", {}, [
          el("button", {
            class: "bottone piccolo",
            text: d.active === 0 ? "Riattiva" : "Disattiva",
            onclick: async () => {
              try {
                await api.patch(`/api/admin/employees/${d.id}`, { active: d.active === 0 });
                toast("Account aggiornato.", "ok");
                carica();
              } catch (errore) { toast(errore.message, "errore"); }
            }
          })
        ])
      ])))
    ]));
  }

  function form(campi, titolo, invio, testoAzione = "Salva") {
    const nodi = {};
    const contenuto = el("div", { class: "colonna" }, campi.map(([nome, etichetta, tipo, placeholder]) => {
      const input = tipo === "textarea"
        ? el("textarea", { class: "campo largo", rows: 6, placeholder: placeholder || "" })
        : el("input", { class: "campo largo", type: tipo || "text", placeholder: placeholder || "" });
      nodi[nome] = input;
      return el("label", { class: "campo-etichetta" }, [el("span", { text: etichetta }), input]);
    }));

    modale({
      titolo,
      contenuto,
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: testoAzione, primaria: true,
          azione: async (chiudi) => {
            const valori = Object.fromEntries(Object.entries(nodi).map(([k, v]) => [k, v.value]));
            try {
              await invio(valori);
              chiudi();
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  function nuovoDipendente() {
    form([
      ["fullName", "Nome e cognome", "text"],
      ["email", "Email", "email"],
      ["password", "Password iniziale", "password"]
    ], "Nuovo dipendente", async (v) => {
      await api.post("/api/admin/employees", v);
      toast("Account creato.", "ok");
      carica();
    }, "Crea");
  }

  function invitaCliente() {
    form([
      ["email", "Email del cliente", "email"],
      ["fullName", "Nome e cognome", "text"],
      ["condominio", "Condominio", "text"]
    ], "Invita un cliente", async (v) => {
      await api.post("/api/admin/email-invite-client", v);
      toast("Invito inviato.", "ok");
    }, "Invia invito");
  }

  function scriviEmail() {
    form([
      ["to", "Destinatario", "email"],
      ["subject", "Oggetto", "text"],
      ["message", "Messaggio", "textarea"]
    ], "Scrivi dallo Studio", async (v) => {
      await api.post("/api/admin/email-send", v);
      toast("Email inviata.", "ok");
    }, "Invia");
  }

  async function statoPosta() {
    const contenuto = el("div", {}, [caricamento()]);
    modale({ titolo: "Stato della posta", contenuto });
    try {
      const stato = await api.get("/api/admin/email-status");
      svuota(contenuto).appendChild(el("pre", { class: "codice", text: JSON.stringify(stato, null, 2) }));
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Stato non disponibile.", errore.message));
    }
  }

  await carica();
  return () => {};
}
