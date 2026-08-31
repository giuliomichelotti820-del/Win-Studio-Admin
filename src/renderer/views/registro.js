/* =============================================================================
 * Registro delle attivita della postazione
 *
 * Il server sa cosa e stato cambiato sulle pratiche; questo registro sa cosa e
 * stato fatto *da questo computer*, anche quando la rete era giu: accessi
 * riusciti e negati, sblocchi, esportazioni, importazioni di impostazioni.
 *
 * Serve a due domande che prima o poi arrivano sempre: "chi ha esportato
 * l'elenco dei morosi?" e "qualcuno ha provato a entrare col mio account?".
 * ========================================================================== */

import { el, svuota, dataOra, daQuando, statoVuoto, caricamento, conferma, toast } from "../lib/ui.js";
import { esportaCsv } from "../lib/esporta.js";

const ETICHETTE = {
  accesso: "Accesso effettuato",
  "accesso-negato": "Accesso rifiutato",
  "accesso-codice-richiesto": "Richiesto codice di verifica",
  uscita: "Uscita dall'account",
  "blocco-postazione": "Postazione bloccata",
  sblocco: "Postazione sbloccata",
  "sblocco-negato": "Sblocco rifiutato",
  esportazione: "Esportazione su file",
  "impostazioni-importate": "Impostazioni importate",
  "vista-salvata": "Vista della coda salvata",
  "vista-rimossa": "Vista della coda rimossa"
};

const PERIODI = [
  ["", "Sempre"],
  ["1", "Ultime 24 ore"],
  ["7", "Ultimi 7 giorni"],
  ["30", "Ultimi 30 giorni"]
];

export default async function monta(radice, ctx) {
  const stato = { voci: [], totale: 0, percorso: "", azione: "", giorni: "", testo: "" };

  const corpo = el("div", {});
  const riepilogo = el("p", { class: "riepilogo" });

  const cerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca nel registro…" });
  cerca.addEventListener("input", () => { stato.testo = cerca.value.trim().toLowerCase(); disegna(); });

  const selAzione = el("select", { class: "campo" }, [
    el("option", { value: "", text: "Ogni attivita" }),
    ...Object.entries(ETICHETTE).map(([v, t]) => el("option", { value: v, text: t }))
  ]);
  selAzione.addEventListener("change", () => { stato.azione = selAzione.value; carica(); });

  const selPeriodo = el("select", { class: "campo" },
    PERIODI.map(([v, t]) => el("option", { value: v, text: t })));
  selPeriodo.addEventListener("change", () => { stato.giorni = selPeriodo.value; carica(); });

  radice.append(
    el("div", { class: "toolbar" }, [
      cerca, selAzione, selPeriodo,
      el("button", { class: "bottone", text: "Aggiorna", onclick: () => carica() }),
      el("button", { class: "bottone", text: "Esporta CSV", onclick: esporta }),
      el("button", { class: "bottone", text: "Apri la cartella dati", onclick: () => window.studio.apriCartellaDati() }),
      el("span", { class: "spazio" }),
      ctx.utente.role === "super_admin"
        ? el("button", { class: "bottone pericolo", text: "Svuota il registro", onclick: svuotaRegistro })
        : null
    ]),
    riepilogo,
    corpo
  );

  function filtrate() {
    if (!stato.testo) return stato.voci;
    return stato.voci.filter((v) => [
      ETICHETTE[v.azione] || v.azione,
      v.oggetto, v.dettaglio, v.utente && v.utente.nome, v.utente && v.utente.email
    ].filter(Boolean).join(" ").toLowerCase().includes(stato.testo));
  }

  async function carica() {
    svuota(corpo).appendChild(caricamento("Leggo il registro…"));
    const da = stato.giorni
      ? new Date(Date.now() - Number(stato.giorni) * 86400000).toISOString()
      : null;

    const esito = await window.studio.registro({ limite: 1000, azione: stato.azione, da });
    if (!esito.ok) {
      svuota(corpo).appendChild(statoVuoto("Registro non leggibile.", esito.errore));
      return;
    }
    stato.voci = esito.dati.voci;
    stato.totale = esito.dati.totale;
    stato.percorso = esito.dati.percorso;
    disegna();
  }

  function disegna() {
    const righe = filtrate();
    riepilogo.textContent = `${righe.length} voci mostrate su ${stato.totale} conservate · file ${stato.percorso}`;

    svuota(corpo);
    if (!righe.length) {
      corpo.appendChild(statoVuoto(
        "Nessuna attivita registrata con questi filtri.",
        "Il registro si riempie man mano che si lavora da questa postazione."
      ));
      return;
    }

    corpo.appendChild(el("div", { class: "tabella-wrap" }, [
      el("table", { class: `tabella ${ctx.impostazioni.densita === "compatta" ? "densa" : ""}` }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "Quando" }),
          el("th", { text: "Attivita" }),
          el("th", { text: "Utente" }),
          el("th", { text: "Oggetto" }),
          el("th", { text: "Dettaglio" })
        ])]),
        el("tbody", {}, righe.map((voce) => el("tr", { class: voce.esito === "errore" ? "urgente" : "" }, [
          el("td", { title: dataOra(voce.quando) }, [
            el("div", { text: daQuando(voce.quando) }),
            el("div", { class: "sotto", text: dataOra(voce.quando) })
          ]),
          el("td", {}, [
            el("span", {
              class: `pill ${voce.esito === "errore" ? "pill-pri-alta" : "pill-stato-chiusa"}`,
              text: ETICHETTE[voce.azione] || voce.azione
            })
          ]),
          el("td", {}, [
            el("div", { text: (voce.utente && voce.utente.nome) || "—" }),
            el("div", { class: "sotto", text: (voce.utente && voce.utente.email) || "" })
          ]),
          el("td", { class: "testo-breve", title: voce.oggetto || "", text: voce.oggetto || "—" }),
          el("td", { class: "testo-breve sotto", title: voce.dettaglio || "", text: voce.dettaglio || "" })
        ])))
      ])
    ]));
  }

  function esporta() {
    return esportaCsv("registro-attivita", filtrate(), [
      { titolo: "Quando", valore: (v) => dataOra(v.quando) },
      { titolo: "Attivita", valore: (v) => ETICHETTE[v.azione] || v.azione },
      { titolo: "Esito", valore: (v) => v.esito },
      { titolo: "Utente", valore: (v) => (v.utente && v.utente.nome) || "" },
      { titolo: "Email", valore: (v) => (v.utente && v.utente.email) || "" },
      { titolo: "Oggetto", valore: (v) => v.oggetto || "" },
      { titolo: "Dettaglio", valore: (v) => v.dettaglio || "" }
    ]);
  }

  async function svuotaRegistro() {
    const risposta = await conferma(
      "Il registro locale viene cancellato definitivamente da questo computer. Le attivita gia registrate sul server non sono toccate.",
      "Svuotare il registro?"
    );
    if (!risposta) return;
    const esito = await window.studio.svuotaRegistro();
    toast(esito.ok ? "Registro svuotato." : esito.errore, esito.ok ? "ok" : "errore");
    carica();
  }

  await carica();
}
