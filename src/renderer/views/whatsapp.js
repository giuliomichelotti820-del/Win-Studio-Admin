/* =============================================================================
 * WhatsApp: conversazioni a sinistra, filo del discorso a destra.
 *
 * Fuori dalla finestra di 24 ore Meta accetta solo i template approvati: il
 * server lo dice nella risposta del thread e qui la casella di scrittura si
 * comporta di conseguenza, invece di far scrivere un messaggio che verrebbe
 * rifiutato.
 * ========================================================================== */

import { el, svuota, api, toast, dataOra, daQuando, statoVuoto, caricamento } from "../lib/ui.js";

export default async function monta(radice, ctx) {
  const elenco = el("aside", { class: "lista-conversazioni" });
  const filo = el("section", { class: "filo" });
  radice.appendChild(el("div", { class: "due-colonne" }, [elenco, filo]));

  let conversazioni = [];
  let attiva = (ctx.parametri && ctx.parametri.telefono) || null;

  async function caricaElenco() {
    svuota(elenco).appendChild(caricamento());
    try {
      const dati = await api.get("/api/admin/whatsapp/conversations?limit=80");
      conversazioni = dati.conversations || [];
      disegnaElenco();
      if (!attiva && conversazioni.length) apri(conversazioni[0].phone);
      else if (attiva) apri(attiva);
    } catch (errore) {
      svuota(elenco).appendChild(statoVuoto("Conversazioni non disponibili.", errore.message));
    }
  }

  function disegnaElenco() {
    svuota(elenco);
    elenco.appendChild(el("header", { class: "lista-testa" }, [
      el("strong", { text: `Conversazioni (${conversazioni.length})` }),
      el("button", { class: "bottone piccolo", text: "Aggiorna", onclick: caricaElenco })
    ]));

    if (!conversazioni.length) {
      elenco.appendChild(statoVuoto("Nessun messaggio WhatsApp."));
      return;
    }

    for (const c of conversazioni) {
      elenco.appendChild(el("button", {
        class: `voce-conversazione ${c.phone === attiva ? "attiva" : ""}`,
        onclick: () => apri(c.phone)
      }, [
        el("div", { class: "riga" }, [
          el("strong", { text: c.display_name || c.user_name || c.supplier_name || c.phone }),
          el("span", { class: "sotto", text: daQuando(c.last_at) })
        ]),
        el("div", { class: "sotto anteprima", text: `${c.last_direction === "in" ? "↙ " : "↗ "}${c.last_body || ""}` }),
        c.condominio_nome ? el("div", { class: "sotto", text: c.condominio_nome }) : null,
        c.opt_out ? el("span", { class: "pill pill-avviso", text: "opt-out" }) : null
      ]));
    }
  }

  async function apri(telefono) {
    attiva = telefono;
    disegnaElenco();
    svuota(filo).appendChild(caricamento());
    try {
      const dati = await api.get(`/api/admin/whatsapp/thread?phone=${encodeURIComponent(telefono)}`);
      disegnaFilo(dati);
    } catch (errore) {
      svuota(filo).appendChild(statoVuoto("Conversazione non disponibile.", errore.message));
    }
  }

  function disegnaFilo(dati) {
    svuota(filo);
    const contatto = dati.contact || dati.contatto || {};
    const messaggi = dati.messages || dati.messaggi || [];
    const finestraAperta = dati.windowOpen ?? dati.finestraAperta ?? true;

    filo.appendChild(el("header", { class: "filo-testa" }, [
      el("div", {}, [
        el("h2", { text: contatto.display_name || contatto.user_name || attiva }),
        el("span", { class: "sotto", text: [attiva, contatto.condominio_nome, contatto.supplier_name].filter(Boolean).join(" · ") })
      ]),
      el("div", { class: "azioni" }, [
        el("button", {
          class: "bottone piccolo", text: "Apri pratica",
          onclick: async () => {
            try {
              const esito = await api.post("/api/admin/whatsapp/open-ticket", { phone: attiva });
              toast(`Pratica ${esito.ticketNumber || esito.ticket_number || ""} aperta.`, "ok");
              if (esito.ticketId || esito.ticket_id) ctx.naviga(`ticket:${esito.ticketId || esito.ticket_id}`);
            } catch (errore) { toast(errore.message, "errore"); }
          }
        })
      ])
    ]));

    const bolle = el("div", { class: "bolle" }, messaggi.length
      ? messaggi.map((m) => el("div", { class: `bolla ${m.direction === "in" ? "entrata" : "uscita"}` }, [
          el("p", { class: "testo", text: m.body || m.template_name || "(messaggio)" }),
          el("span", { class: "sotto", text: [dataOra(m.created_at), m.sent_by_name, m.ticket_number, m.status].filter(Boolean).join(" · ") })
        ]))
      : [statoVuoto("Nessun messaggio con questo numero.")]);
    filo.appendChild(bolle);
    bolle.scrollTop = bolle.scrollHeight;

    const testo = el("textarea", {
      class: "risposta", rows: 3,
      placeholder: finestraAperta
        ? "Scrivi su WhatsApp…  (Ctrl+Invio invia)"
        : "Fuori dalla finestra di 24 ore: serve un template approvato."
    });

    async function invia() {
      const messaggio = testo.value.trim();
      if (!messaggio) return;
      testo.disabled = true;
      try {
        const esito = await api.post("/api/admin/whatsapp/send", { to: attiva, body: messaggio });
        testo.value = "";
        if (esito && esito.link) {
          await window.studio.apriEsterno(esito.link);
          toast("WhatsApp non e collegato: ho aperto il messaggio nel browser.", "avviso");
        } else {
          toast("Messaggio inviato.", "ok");
        }
        apri(attiva);
      } catch (errore) {
        toast(errore.message, "errore");
      } finally {
        testo.disabled = false;
      }
    }

    testo.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) { evento.preventDefault(); invia(); }
    });

    filo.appendChild(el("div", { class: "composer" }, [
      testo,
      el("div", { class: "composer-azioni" }, [
        el("button", { class: "bottone primario", text: "Invia", onclick: invia }),
        finestraAperta ? null : el("span", { class: "sotto", text: "Finestra di 24 ore chiusa" })
      ])
    ]));
  }

  await caricaElenco();
  const timer = setInterval(() => { if (document.hasFocus()) caricaElenco().catch(() => {}); }, 60000);
  return () => clearInterval(timer);
}
