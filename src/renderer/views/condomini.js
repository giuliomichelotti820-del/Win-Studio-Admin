/* =============================================================================
 * Anagrafica condomini: elenco, carico di lavoro, morosita dello stabile e
 * avvisi allo stabile o al singolo condomino.
 * ========================================================================== */

import {
  el, svuota, api, cached, invalidaCache, toast, euro, soloData, statoVuoto, caricamento, modale
} from "../lib/ui.js";

const STATI_MOROSITA = [["regolare", "Regolare"], ["lieve", "Lieve"], ["grave", "Grave"]];

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  let condomini = [];
  let filtro = "";

  const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca condominio o indirizzo…" });
  ricerca.addEventListener("input", () => { filtro = ricerca.value.toLowerCase().trim(); disegna(); });

  barra.append(
    ricerca,
    el("button", { class: "bottone", text: "Aggiorna", onclick: () => carica(true) }),
    el("button", { class: "bottone primario", text: "Nuovo condominio", onclick: nuovoCondominio })
  );

  async function carica(forza) {
    svuota(corpo).appendChild(caricamento());
    if (forza) invalidaCache("condomini");
    try {
      condomini = await cached("condomini", () => api.get("/api/condomini"));
      disegna();
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function disegna() {
    svuota(corpo);
    const elenco = condomini.filter((c) =>
      !filtro || `${c.nome} ${c.indirizzo || ""}`.toLowerCase().includes(filtro));

    if (!elenco.length) {
      corpo.appendChild(statoVuoto("Nessun condominio."));
      return;
    }

    corpo.appendChild(el("table", { class: "tabella densa" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Condominio" }), el("th", { text: "Indirizzo" }),
        el("th", { text: "Condomini" }), el("th", { text: "Pratiche aperte" }),
        el("th", { text: "Morosita" }), el("th", { text: "Referenti" }), el("th", { text: "Azioni" })
      ])]),
      el("tbody", {}, elenco.map((c) => el("tr", { class: c.morosita_status === "grave" ? "urgente" : "" }, [
        el("td", {}, [el("strong", { text: c.nome })]),
        el("td", { text: c.indirizzo || "—" }),
        el("td", { text: String(c.member_count ?? "—") }),
        el("td", {}, [
          el("a", {
            class: "link", text: String(c.open_count ?? 0),
            onclick: () => ctx.naviga("coda", { condominioId: c.id, status: "aperte" })
          })
        ]),
        el("td", {}, [
          el("span", { class: `pill pill-mor-${c.morosita_status || "regolare"}`, text: (c.morosita_status || "regolare").toUpperCase() }),
          c.morosita_importo ? el("span", { class: "sotto", text: euro(c.morosita_importo) }) : null
        ]),
        el("td", { text: c.staff_names || "—" }),
        el("td", { class: "azioni" }, [
          el("button", { class: "bottone piccolo", text: "Morosita", onclick: () => modaleMorosita(c) }),
          el("button", { class: "bottone piccolo", text: "Avviso", onclick: () => modaleAvviso(c) }),
          el("button", { class: "bottone piccolo", text: "Condomini", onclick: () => modaleMembri(c) })
        ])
      ])))
    ]));
  }

  function modaleMorosita(condominio) {
    const stato = el("select", { class: "campo largo" },
      STATI_MOROSITA.map(([v, t]) => el("option", { value: v, text: t, selected: v === (condominio.morosita_status || "regolare") })));
    const importo = el("input", { class: "campo largo", type: "number", step: "0.01", min: "0", value: condominio.morosita_importo ?? "" });
    const note = el("textarea", { class: "campo largo", rows: 3, text: condominio.morosita_note || "" });

    modale({
      titolo: `Morosita — ${condominio.nome}`,
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Stato" }), stato]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Importo scoperto" }), importo]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Note" }), note])
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Salva", primaria: true,
          azione: async (chiudi) => {
            try {
              await api.patch(`/api/condomini/${condominio.id}/morosita`, {
                status: stato.value, importo: importo.value, note: note.value
              });
              chiudi();
              toast("Posizione aggiornata.", "ok");
              carica(true);
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  function modaleAvviso(condominio) {
    const titolo = el("input", { class: "campo largo", placeholder: "Oggetto dell'avviso" });
    const gravita = el("select", { class: "campo largo" }, [
      el("option", { value: "info", text: "Informazione" }),
      el("option", { value: "avviso", text: "Avviso" }),
      el("option", { value: "urgente", text: "Urgente" })
    ]);
    const messaggio = el("textarea", { class: "campo largo", rows: 5, placeholder: "Testo inviato ai condomini" });

    modale({
      titolo: `Avviso — ${condominio.nome}`,
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Oggetto" }), titolo]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Gravita" }), gravita]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Messaggio" }), messaggio])
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Invia a tutto il condominio", primaria: true,
          azione: async (chiudi) => {
            if (!titolo.value.trim() || !messaggio.value.trim()) { toast("Servono oggetto e messaggio.", "avviso"); return; }
            try {
              const esito = await api.post("/api/staff/alerts", {
                condominioId: condominio.id, scope: "condominio", severity: gravita.value,
                title: titolo.value, message: messaggio.value
              });
              chiudi();
              toast(`Avviso inviato a ${esito.recipients ?? esito.recipients_count ?? "tutti i"} destinatari.`, "ok");
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  async function modaleMembri(condominio) {
    const contenuto = el("div", {}, [caricamento()]);
    modale({ titolo: `Condomini — ${condominio.nome}`, contenuto, larghezza: 720 });
    try {
      const membri = await api.get(`/api/condomini/${condominio.id}/membri`);
      svuota(contenuto).appendChild(membri.length
        ? el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Nome" }), el("th", { text: "Email" }),
              el("th", { text: "Morosita" }), el("th", { text: "Aggiornata" })
            ])]),
            el("tbody", {}, membri.map((m) => el("tr", {}, [
              el("td", { text: m.full_name }),
              el("td", { text: m.email }),
              el("td", { text: (m.morosita_status || "regolare") + (m.morosita_importo ? ` · ${euro(m.morosita_importo)}` : "") }),
              el("td", { text: m.morosita_updated_at ? soloData(m.morosita_updated_at) : "—" })
            ])))
          ])
        : statoVuoto("Nessun condomino registrato."));
    } catch (errore) {
      svuota(contenuto).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function nuovoCondominio() {
    const nome = el("input", { class: "campo largo", placeholder: "Condominio Via Roma 12" });
    const indirizzo = el("input", { class: "campo largo", placeholder: "Via Roma 12, Firenze" });
    modale({
      titolo: "Nuovo condominio",
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Nome" }), nome]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Indirizzo" }), indirizzo])
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Crea", primaria: true,
          azione: async (chiudi) => {
            try {
              await api.post("/api/condomini", { nome: nome.value, indirizzo: indirizzo.value });
              chiudi();
              toast("Condominio creato.", "ok");
              carica(true);
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  await carica();
  return () => {};
}
