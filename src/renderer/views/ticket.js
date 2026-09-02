/* =============================================================================
 * Scheda della segnalazione: testo, conversazione, storico e tutti i comandi
 * di lavorazione in una sola schermata.
 *
 * La risposta si invia con Ctrl+Invio; Ctrl+Maiusc+Invio la salva come nota
 * interna (visibile solo allo staff, nessuna email al condomino). Gli stessi
 * tasti 1-6 della coda cambiano stato anche qui.
 * ========================================================================== */

import {
  el, svuota, api, cached, toast, dataOra, daQuando, pastigliaStato, pastigliaPriorita,
  STATI, PRIORITA, CANALI, statoVuoto, caricamento
} from "../lib/ui.js";

const ORDINE_STATI = ["nuova", "presa_in_carico", "in_lavorazione", "in_attesa", "risolta", "chiusa"];

export default async function monta(radice, ctx) {
  const ticketId = Number(ctx.parametro);
  radice.appendChild(caricamento("Apro la segnalazione…"));

  let ticket = null;
  let messaggi = [];

  const [staff, categorie, fornitori] = await Promise.all([
    cached("staff", () => api.get("/api/staff")).catch(() => []),
    cached("categorie", () => api.get("/api/categories")).catch(() => []),
    cached("fornitori", () => api.get("/api/suppliers")).catch(() => [])
  ]);

  async function carica({ silenzioso = false } = {}) {
    try {
      const [dettaglio, elenco] = await Promise.all([
        api.get(`/api/tickets/${ticketId}`),
        api.get(`/api/tickets/${ticketId}/messages`)
      ]);
      ticket = dettaglio;
      messaggi = elenco || [];
      disegna();
    } catch (errore) {
      if (!silenzioso) svuota(radice).appendChild(statoVuoto("Segnalazione non disponibile.", errore.message));
    }
  }

  async function aggiorna(modifica, descrizione) {
    try {
      await api.patch(`/api/tickets/${ticketId}`, modifica);
      toast(descrizione || "Segnalazione aggiornata.", "ok");
      await carica({ silenzioso: true });
    } catch (errore) {
      toast(errore.message, "errore");
    }
  }

  /* --- Stampa ---------------------------------------------------------------
   * La vista manda i dati che ha gia a schermo; il documento — carta intestata,
   * impaginazione, numeri di pagina — lo compone il processo principale, che e
   * anche l'unico posto in cui i valori vengono resi innocui prima di finire
   * dentro dell'HTML.
   * ---------------------------------------------------------------------- */

  async function stampaPratica() {
    if (!ticket) return;
    const esito = await ctx.stampa({
      numero: ticket.ticket_number,
      oggetto: ticket.subject,
      stato: STATI[ticket.status] || ticket.status,
      priorita: PRIORITA[ticket.priority] || ticket.priority,
      canale: CANALI[ticket.channel] || ticket.channel,
      condominio: ticket.condominio_nome,
      richiedente: ticket.requester_name,
      recapito: ticket.requester_email || ticket.requester_phone,
      assegnatario: ticket.assignee_name,
      fornitore: ticket.supplier_name,
      aperta: dataOra(ticket.created_at),
      aggiornata: dataOra(ticket.updated_at),
      descrizione: ticket.description,
      messaggi: messaggi.map((m) => ({
        autore: m.author_name,
        quando: dataOra(m.created_at),
        testo: m.message,
        interno: !!m.is_internal,
        staff: m.author_role !== "utente"
      })),
      storico: (ticket.history || []).map((v) => ({
        quando: dataOra(v.created_at),
        descrizione: v.description || v.action,
        chi: v.actor_name
      }))
    });

    if (!esito.ok) { toast(esito.errore || "Stampa non riuscita.", "errore"); return; }
    if (esito.dati && esito.dati.annullato) return;
    toast("PDF salvato.", "ok");
    if (esito.dati && esito.dati.percorso) window.studio.apriStampa(esito.dati.percorso);
  }

  /* --- Disegno ------------------------------------------------------------ */

  function disegna() {
    svuota(radice);

    // La linguetta della scheda nasce con il solo numero — e tutto quello che
    // si sa prima di caricare. Adesso che c'e anche l'oggetto, ci va quello:
    // otto schede aperte che dicono "Pratica 1204" non aiutano nessuno.
    if (typeof ctx.rinominaScheda === "function") {
      ctx.rinominaScheda(`${ticket.ticket_number} · ${ticket.subject}`);
    }

    radice.appendChild(el("div", { class: "scheda-testa" }, [
      el("button", { class: "bottone", text: "‹ Torna alla coda", onclick: () => ctx.naviga("coda") }),
      el("div", { class: "scheda-titolo" }, [
        el("h1", { text: `${ticket.ticket_number} · ${ticket.subject}` }),
        el("div", { class: "scheda-meta" }, [
          pastigliaStato(ticket.status),
          pastigliaPriorita(ticket.priority),
          el("span", { text: `${ticket.category_label || "—"} · ${CANALI[ticket.channel] || ticket.channel}` }),
          el("span", { text: `Aperta ${dataOra(ticket.created_at)}` }),
          el("span", { text: `Ultimo aggiornamento ${daQuando(ticket.updated_at)}` })
        ])
      ]),
      el("span", { class: "spazio" }),

      // Due gesti che finora si facevano fuori dall'app: ricordarsi di
      // richiamare qualcuno, e mettere la pratica su carta per il preventivo,
      // l'assemblea o il legale.
      el("button", {
        class: "bottone", text: "Promemoria",
        title: "Prendi un promemoria collegato a questa pratica",
        onclick: () => ctx.promemoria({
          titolo: `Ripassare ${ticket.ticket_number}: ${ticket.subject}`,
          destinazione: `ticket:${ticketId}`,
          contesto: `${ticket.ticket_number} · ${ticket.subject}`
        })
      }),
      el("button", {
        class: "bottone", text: "Stampa in PDF",
        title: "La pratica su carta intestata dello Studio",
        onclick: stampaPratica
      })
    ]));

    const colonnaSinistra = el("div", { class: "colonna-principale" });
    const colonnaDestra = el("div", { class: "colonna-laterale" });
    radice.appendChild(el("div", { class: "scheda-griglia" }, [colonnaSinistra, colonnaDestra]));

    /* Testo della segnalazione */
    colonnaSinistra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Richiesta" }),
      el("p", { class: "testo", text: ticket.description || "(nessun testo)" }),
      ticket.location ? el("p", { class: "sotto", text: `Luogo: ${ticket.location}` }) : null
    ]));

    /* Conversazione */
    const conversazione = el("div", { class: "conversazione" },
      messaggi.length
        ? messaggi.map((m) => el("article", { class: `messaggio ${m.is_internal ? "interno" : ""} ${m.author_role === "utente" ? "" : "staff"}` }, [
            el("header", {}, [
              el("strong", { text: m.author_name }),
              m.is_internal ? el("span", { class: "pill pill-interno", text: "Nota interna" }) : null,
              el("span", { class: "sotto", text: dataOra(m.created_at) })
            ]),
            el("p", { class: "testo", text: m.message }),
            m.attachments && m.attachments.length
              ? el("div", { class: "allegati" }, m.attachments.map((a) =>
                  el("button", {
                    class: "bottone piccolo",
                    text: `📎 ${a.fileName}`,
                    onclick: async () => {
                      const esito = await window.studio.scarica(`/api/attachments/${a.id}`, a.fileName);
                      if (esito.ok && esito.dati) toast("File salvato.", "ok");
                      else if (!esito.ok) toast(esito.errore, "errore");
                    }
                  })))
              : null
          ]))
        : [statoVuoto("Nessun messaggio.", "La prima risposta parte da qui sotto.")]);

    const testoRisposta = el("textarea", {
      class: "risposta", rows: 4,
      placeholder: "Rispondi al condomino…  (Ctrl+Invio invia · Ctrl+Maiusc+Invio salva come nota interna)"
    });

    async function invia(interna) {
      const testo = testoRisposta.value.trim();
      if (!testo) return;
      testoRisposta.disabled = true;
      try {
        await api.post(`/api/tickets/${ticketId}/messages`, { message: testo, isInternal: interna });
        testoRisposta.value = "";
        toast(interna ? "Nota interna salvata." : "Risposta inviata al condomino.", "ok");
        await carica({ silenzioso: true });
      } catch (errore) {
        toast(errore.message, "errore");
      } finally {
        testoRisposta.disabled = false;
        const nuovo = radice.querySelector("textarea.risposta");
        if (nuovo) nuovo.focus();
      }
    }

    testoRisposta.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        invia(evento.shiftKey);
      }
    });

    colonnaSinistra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: `Conversazione (${messaggi.length})` }),
      conversazione,
      el("div", { class: "composer" }, [
        testoRisposta,
        el("div", { class: "composer-azioni" }, [
          el("button", { class: "bottone primario", text: "Invia risposta", onclick: () => invia(false) }),
          el("button", { class: "bottone", text: "Nota interna", onclick: () => invia(true) })
        ])
      ])
    ]));

    /* Storico */
    colonnaSinistra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Storico stati" }),
      (ticket.history || []).length
        ? el("ul", { class: "storico" }, ticket.history.map((h) => el("li", {}, [
            el("span", { text: `${STATI[h.old_status] || h.old_status} → ${STATI[h.new_status] || h.new_status}` }),
            el("span", { class: "sotto", text: `${h.changed_by_name} · ${dataOra(h.created_at)}` }),
            h.note ? el("span", { class: "sotto", text: h.note }) : null
          ])))
        : statoVuoto("Nessun cambio di stato registrato.")
    ]));

    /* --- Colonna dei comandi --------------------------------------------- */

    colonnaDestra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Stato" }),
      el("div", { class: "griglia-bottoni" }, ORDINE_STATI.map((s, i) =>
        el("button", {
          class: `bottone ${ticket.status === s ? "attivo" : ""}`,
          text: `${i + 1} · ${STATI[s]}`,
          onclick: () => aggiorna({ status: s }, `Stato: ${STATI[s]}.`)
        })))
    ]));

    function selettore(etichetta, voci, valore, alCambio) {
      const scelta = el("select", { class: "campo largo" },
        voci.map(([v, t]) => el("option", { value: v === null ? "" : v, text: t, selected: String(v ?? "") === String(valore ?? "") })));
      scelta.addEventListener("change", () => alCambio(scelta.value));
      return el("label", { class: "campo-etichetta" }, [el("span", { text: etichetta }), scelta]);
    }

    colonnaDestra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Lavorazione" }),
      selettore("Priorita", Object.entries(PRIORITA), ticket.priority, (v) => aggiorna({ priority: v })),
      selettore("Assegnata a", [[null, "Nessuno"], ...staff.map((s) => [s.id, s.full_name])],
        (staff.find((s) => s.full_name === ticket.assigned_name) || {}).id,
        (v) => aggiorna({ assignedTo: v ? Number(v) : null })),
      selettore("Categoria", categorie.map((c) => [c.id, c.label]),
        (categorie.find((c) => c.slug === ticket.category_slug) || {}).id,
        (v) => aggiorna({ categoryId: Number(v) })),
      selettore("Fornitore", [[null, "Nessuno"], ...fornitori.map((f) => [f.id, f.name])],
        (fornitori.find((f) => f.name === ticket.supplier_name) || {}).id,
        (v) => aggiorna({ supplierId: v ? Number(v) : null })),
      el("button", {
        class: "bottone largo", text: "Assegna a me",
        onclick: () => aggiorna({ assignedTo: ctx.utente.id }, "Assegnata a te.")
      })
    ]));

    const notaTecnica = el("textarea", { class: "campo largo", rows: 4, text: ticket.technician_note || "" });
    const luogo = el("input", { class: "campo largo", value: ticket.location || "", placeholder: "Scala B, interno 4…" });
    colonnaDestra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Note di lavorazione" }),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Luogo" }), luogo]),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Nota tecnica (interna)" }), notaTecnica]),
      el("button", {
        class: "bottone largo primario", text: "Salva note",
        onclick: () => aggiorna({ technicianNote: notaTecnica.value, location: luogo.value }, "Note salvate.")
      })
    ]));

    colonnaDestra.appendChild(el("section", { class: "riquadro" }, [
      el("h2", { text: "Richiedente" }),
      el("dl", { class: "dati" }, [
        el("dt", { text: "Nome" }), el("dd", { text: ticket.client_name || ticket.contact_name || "—" }),
        el("dt", { text: "Email" }), el("dd", { text: ticket.client_email || ticket.contact_email || "—" }),
        el("dt", { text: "Telefono" }), el("dd", { text: ticket.contact_phone || "—" }),
        el("dt", { text: "Condominio" }), el("dd", { text: ticket.condominio_nome || "—" }),
        el("dt", { text: "Canale" }), el("dd", { text: CANALI[ticket.channel] || ticket.channel })
      ])
    ]));
  }

  /* --- Tastiera ------------------------------------------------------------ */

  function suTasto(evento) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(evento.target.tagName)) return;
    if (evento.key >= "1" && evento.key <= "6") {
      const nuovo = ORDINE_STATI[Number(evento.key) - 1];
      if (nuovo) aggiorna({ status: nuovo }, `Stato: ${STATI[nuovo]}.`);
    }
    if (evento.key === "a" || evento.key === "A") aggiorna({ assignedTo: ctx.utente.id }, "Assegnata a te.");
    if (evento.key === "r" || evento.key === "R") carica({ silenzioso: true });
    if (evento.key === "Escape") ctx.naviga("coda");
    if (evento.key === "m" || evento.key === "M") {
      const campo = radice.querySelector("textarea.risposta");
      if (campo) { evento.preventDefault(); campo.focus(); }
    }
  }

  document.addEventListener("keydown", suTasto);
  await carica();

  return () => document.removeEventListener("keydown", suTasto);
}
