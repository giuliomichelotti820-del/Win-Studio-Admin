/* =============================================================================
 * Posta in arrivo: diario del riconoscimento automatico delle email.
 * Da qui si forza una lettura della casella e si apre a mano la pratica dai
 * messaggi che il riconoscimento aveva scartato.
 * ========================================================================== */

import { el, svuota, api, toast, dataOra, statoVuoto, caricamento, conferma } from "../lib/ui.js";

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  barra.append(
    el("button", { class: "bottone", text: "Aggiorna", onclick: carica }),
    el("button", {
      class: "bottone primario", text: "Leggi la casella adesso",
      onclick: async () => {
        try {
          const esito = await api.post("/api/admin/inbound-poll", {});
          toast(`Lettura completata: ${esito.processed ?? esito.letti ?? 0} messaggi.`, "ok");
          carica();
        } catch (errore) { toast(errore.message, "errore"); }
      }
    })
  );

  async function carica() {
    svuota(corpo).appendChild(caricamento());
    try {
      const dati = await api.get("/api/admin/inbound?limit=60");
      disegna(dati);
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Diario non disponibile.", errore.message));
    }
  }

  function disegna(dati) {
    svuota(corpo);
    const settimana = dati.ultimaSettimana || {};

    corpo.appendChild(el("p", { class: "riepilogo", text:
      `Lettura ${dati.lettura} · ultimi 7 giorni: ${Object.entries(settimana).map(([k, v]) => `${k} ${v}`).join(" · ") || "nessun messaggio"}` }));

    const messaggi = dati.messages || [];
    if (!messaggi.length) {
      corpo.appendChild(statoVuoto("Nessun messaggio archiviato."));
      return;
    }

    corpo.appendChild(el("table", { class: "tabella densa" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Quando" }), el("th", { text: "Mittente" }), el("th", { text: "Oggetto" }),
        el("th", { text: "Esito" }), el("th", { text: "Pratica" }), el("th", { text: "" })
      ])]),
      el("tbody", {}, messaggi.map((m) => el("tr", {}, [
        el("td", { text: dataOra(m.created_at) }),
        el("td", {}, [el("div", { text: m.sender_name || m.sender }), el("div", { class: "sotto", text: m.sender })]),
        el("td", {}, [el("div", { text: m.subject || "(senza oggetto)" }), el("div", { class: "sotto testo-breve", text: m.snippet || "" })]),
        el("td", {}, [el("span", { class: `pill pill-esito-${m.outcome}`, text: m.outcome })]),
        el("td", {}, [
          m.ticket_id
            ? el("a", { class: "link", text: m.ticket_number || `#${m.ticket_id}`, onclick: () => ctx.naviga(`ticket:${m.ticket_id}`) })
            : el("span", { text: "—" })
        ]),
        el("td", {}, [
          m.ticket_id ? null : el("button", {
            class: "bottone piccolo", text: "Apri pratica",
            onclick: async () => {
              if (!(await conferma("Aprire una pratica da questo messaggio?"))) return;
              try {
                const esito = await api.post("/api/admin/inbound-open", { id: m.id });
                toast("Pratica aperta.", "ok");
                if (esito.ticketId) ctx.naviga(`ticket:${esito.ticketId}`);
                else carica();
              } catch (errore) { toast(errore.message, "errore"); }
            }
          })
        ])
      ])))
    ]));
  }

  await carica();
  return () => {};
}
