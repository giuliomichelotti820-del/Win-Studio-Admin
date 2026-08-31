/* =============================================================================
 * Fornitori: rubrica operativa con DURC e assicurazione in evidenza, perche
 * sono le due informazioni che decidono se un intervento si puo affidare.
 * ========================================================================== */

import {
  el, svuota, api, cached, invalidaCache, toast, soloData, aData, statoVuoto, caricamento, modale, conferma
} from "../lib/ui.js";

const CAMPI = [
  ["name", "Nome", "text"], ["company", "Ragione sociale", "text"], ["category", "Categoria", "text"],
  ["phone", "Telefono", "text"], ["whatsapp", "WhatsApp", "text"], ["email", "Email", "email"],
  ["pec", "PEC", "email"], ["vat_number", "Partita IVA", "text"], ["tax_code", "Codice fiscale", "text"],
  ["address", "Indirizzo", "text"], ["durc_number", "Numero DURC", "text"],
  ["durc_expires_at", "Scadenza DURC", "date"], ["insurance_company", "Compagnia assicurativa", "text"],
  ["insurance_policy", "Polizza", "text"], ["insurance_expires_at", "Scadenza polizza", "date"],
  ["notes", "Note", "text"]
];

function scaduto(data) {
  const d = aData(data);
  return d ? d.getTime() < Date.now() : false;
}

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  let fornitori = [];
  let filtro = "";

  const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca fornitore, categoria o telefono…" });
  ricerca.addEventListener("input", () => { filtro = ricerca.value.toLowerCase().trim(); disegna(); });

  barra.append(
    ricerca,
    el("button", { class: "bottone", text: "Aggiorna", onclick: () => carica(true) }),
    el("button", { class: "bottone primario", text: "Nuovo fornitore", onclick: () => scheda(null) })
  );

  async function carica(forza) {
    svuota(corpo).appendChild(caricamento());
    if (forza) invalidaCache("fornitori");
    try {
      fornitori = await cached("fornitori", () => api.get("/api/suppliers"));
      disegna();
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function disegna() {
    svuota(corpo);
    const elenco = fornitori.filter((f) =>
      !filtro || `${f.name} ${f.company || ""} ${f.category || ""} ${f.phone || ""}`.toLowerCase().includes(filtro));

    if (!elenco.length) {
      corpo.appendChild(statoVuoto("Nessun fornitore."));
      return;
    }

    corpo.appendChild(el("table", { class: "tabella densa" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Fornitore" }), el("th", { text: "Categoria" }), el("th", { text: "Contatti" }),
        el("th", { text: "DURC" }), el("th", { text: "Assicurazione" }), el("th", { text: "" })
      ])]),
      el("tbody", {}, elenco.map((f) => el("tr", { class: scaduto(f.durc_expires_at) ? "urgente" : "" }, [
        el("td", {}, [el("strong", { text: f.name }), f.company ? el("div", { class: "sotto", text: f.company }) : null]),
        el("td", { text: f.category || "—" }),
        el("td", {}, [
          el("div", { text: f.phone || "—" }),
          f.email ? el("div", { class: "sotto", text: f.email }) : null
        ]),
        el("td", {}, [
          el("span", { class: `pill pill-durc-${f.durc_status || "assente"}`, text: (f.durc_status || "assente").replace("_", " ") }),
          f.durc_expires_at ? el("div", { class: "sotto", text: `scade ${soloData(f.durc_expires_at)}` }) : null
        ]),
        el("td", {}, [
          el("div", { text: f.insurance_company || "—" }),
          f.insurance_expires_at ? el("div", { class: "sotto", text: `scade ${soloData(f.insurance_expires_at)}` }) : null
        ]),
        el("td", { class: "azioni" }, [
          el("button", { class: "bottone piccolo", text: "Modifica", onclick: () => scheda(f) }),
          f.whatsapp || f.phone
            ? el("button", {
                class: "bottone piccolo", text: "WhatsApp",
                onclick: () => ctx.naviga("whatsapp", { telefono: f.whatsapp || f.phone })
              })
            : null,
          el("button", {
            class: "bottone piccolo pericolo", text: "Elimina",
            onclick: async () => {
              if (!(await conferma(`Eliminare il fornitore "${f.name}"?`))) return;
              try {
                await api.del(`/api/suppliers/${f.id}`);
                toast("Fornitore eliminato.", "ok");
                carica(true);
              } catch (errore) { toast(errore.message, "errore"); }
            }
          })
        ])
      ])))
    ]));
  }

  function scheda(fornitore) {
    const campi = {};
    const contenuto = el("div", { class: "griglia-campi" }, CAMPI.map(([nome, etichetta, tipo]) => {
      const input = el("input", { class: "campo largo", type: tipo, value: (fornitore && fornitore[nome]) || "" });
      campi[nome] = input;
      return el("label", { class: "campo-etichetta" }, [el("span", { text: etichetta }), input]);
    }));

    const durc = el("select", { class: "campo largo" }, ["regolare", "irregolare", "in_verifica", "assente"].map((s) =>
      el("option", { value: s, text: s.replace("_", " "), selected: (fornitore && fornitore.durc_status) === s })));
    campi.durc_status = durc;
    contenuto.appendChild(el("label", { class: "campo-etichetta" }, [el("span", { text: "Stato DURC" }), durc]));

    modale({
      titolo: fornitore ? `Modifica ${fornitore.name}` : "Nuovo fornitore",
      larghezza: 760,
      contenuto,
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Salva", primaria: true,
          azione: async (chiudi) => {
            const corpoDati = {};
            for (const [nome, input] of Object.entries(campi)) {
              if (input.value !== "") corpoDati[nome] = input.value;
            }
            if (!corpoDati.name) { toast("Il nome e obbligatorio.", "avviso"); return; }
            try {
              if (fornitore) await api.patch(`/api/suppliers/${fornitore.id}`, corpoDati);
              else await api.post("/api/suppliers", corpoDati);
              chiudi();
              toast("Fornitore salvato.", "ok");
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
