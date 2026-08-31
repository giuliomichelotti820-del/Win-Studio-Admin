/* =============================================================================
 * Morosi: posizioni scoperte dei singoli condomini, con modifica rapida dello
 * stato e dell'importo. La riga si aggiorna senza ricaricare l'elenco.
 * ========================================================================== */

import { el, svuota, api, toast, euro, dataOra, statoVuoto, caricamento, modale } from "../lib/ui.js";

const STATI = [["regolare", "Regolare"], ["lieve", "Lieve"], ["grave", "Grave"]];

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  let righe = [];
  let filtro = "";

  const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca nome, email o condominio…" });
  ricerca.addEventListener("input", () => { filtro = ricerca.value.toLowerCase().trim(); disegna(); });
  barra.append(ricerca, el("button", { class: "bottone", text: "Aggiorna", onclick: carica }));

  async function carica() {
    svuota(corpo).appendChild(caricamento());
    try {
      righe = await api.get("/api/morosi");
      disegna();
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function disegna() {
    svuota(corpo);
    const elenco = righe.filter((r) =>
      !filtro || `${r.full_name} ${r.email} ${r.condominio_nome}`.toLowerCase().includes(filtro));

    if (!elenco.length) {
      corpo.appendChild(statoVuoto("Nessuna posizione scoperta.", "Tutti i condomini risultano regolari."));
      return;
    }

    const totale = elenco.reduce((somma, r) => somma + (Number(r.morosita_importo) || 0), 0);

    corpo.append(
      el("p", { class: "riepilogo", text: `${elenco.length} posizioni · totale scoperto ${euro(totale)}` }),
      el("table", { class: "tabella densa" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "Condomino" }), el("th", { text: "Condominio" }),
          el("th", { text: "Stato" }), el("th", { text: "Importo" }),
          el("th", { text: "Note" }), el("th", { text: "Aggiornata" }), el("th", { text: "" })
        ])]),
        el("tbody", {}, elenco.map((r) => el("tr", { class: r.morosita_status === "grave" ? "urgente" : "" }, [
          el("td", {}, [el("strong", { text: r.full_name }), el("div", { class: "sotto", text: r.email })]),
          el("td", { text: r.condominio_nome }),
          el("td", {}, [el("span", { class: `pill pill-mor-${r.morosita_status}`, text: r.morosita_status.toUpperCase() })]),
          el("td", { text: euro(r.morosita_importo) }),
          el("td", { class: "testo-breve", text: r.morosita_note || "—" }),
          el("td", { text: dataOra(r.morosita_updated_at) }),
          el("td", {}, [el("button", { class: "bottone piccolo", text: "Modifica", onclick: () => modifica(r) })])
        ])))
      ])
    );
  }

  function modifica(riga) {
    const stato = el("select", { class: "campo largo" },
      STATI.map(([v, t]) => el("option", { value: v, text: t, selected: v === riga.morosita_status })));
    const importo = el("input", { class: "campo largo", type: "number", step: "0.01", min: "0", value: riga.morosita_importo ?? "" });
    const note = el("textarea", { class: "campo largo", rows: 3, text: riga.morosita_note || "" });

    modale({
      titolo: `${riga.full_name} — ${riga.condominio_nome}`,
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Stato" }), stato]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Importo scoperto" }), importo]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Note" }), note]),
        el("p", { class: "sotto", text: "Il condomino riceve email e notifica quando la posizione passa a lieve o grave." })
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Salva", primaria: true,
          azione: async (chiudi) => {
            try {
              await api.patch(`/api/condomini/${riga.condominio_id}/utenti/${riga.user_id}/morosita`, {
                status: stato.value, importo: importo.value, note: note.value
              });
              chiudi();
              toast("Posizione aggiornata.", "ok");
              carica();
            } catch (errore) { toast(errore.message, "errore"); }
          }
        }
      ]
    });
  }

  await carica();
  return () => {};
}
