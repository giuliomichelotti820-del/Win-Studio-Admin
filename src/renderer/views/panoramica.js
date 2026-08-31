/* =============================================================================
 * Panoramica: i numeri della giornata e le scorciatoie ai lavori che
 * aspettano. Ogni riquadro e cliccabile e porta alla coda gia filtrata.
 * ========================================================================== */

import { el, svuota, api, toast, daQuando, soloData, statoVuoto, caricamento, STATI, euro } from "../lib/ui.js";

export default async function monta(radice, ctx) {
  radice.appendChild(caricamento("Raccolgo i numeri…"));

  async function carica() {
    const [stats, ops, alerts] = await Promise.all([
      api.get("/api/admin/stats").catch(() => null),
      api.get("/api/ops/summary?days=14").catch(() => null),
      api.get("/api/staff/alerts?limit=8").catch(() => [])
    ]);
    disegna(stats, ops, alerts);
  }

  function tessera(titolo, valore, filtri, tono) {
    return el("button", {
      class: `tessera ${tono || ""}`,
      onclick: () => ctx.naviga("coda", filtri)
    }, [
      el("span", { class: "tessera-valore", text: String(valore ?? "—") }),
      el("span", { class: "tessera-titolo", text: titolo })
    ]);
  }

  function disegna(stats, ops, alerts) {
    svuota(radice);

    radice.appendChild(el("h1", { class: "titolo-pagina", text: `Buon lavoro, ${ctx.utente.fullName.split(" ")[0]}` }));

    if (stats) {
      const aperte = ["nuova", "presa_in_carico", "in_lavorazione", "in_attesa"]
        .reduce((somma, s) => somma + (stats.byStatus[s] || 0), 0);

      radice.appendChild(el("section", { class: "tessere" }, [
        tessera("Aperte", aperte, { status: "aperte" }),
        tessera("Nuove", stats.byStatus.nuova || 0, { status: "nuova" }, "accento"),
        tessera("Urgenti aperte", stats.urgent, { status: "aperte", priority: "urgente" }, stats.urgent ? "allarme" : ""),
        tessera("Non assegnate", stats.unassigned, { status: "aperte", assegnate: "nessuno" }, stats.unassigned ? "avviso" : ""),
        tessera("Dal modulo contatti", stats.contactPending, { status: "aperte", channel: "contatto" }),
        tessera("Risolte in totale", (stats.byStatus.risolta || 0) + (stats.byStatus.chiusa || 0), { status: "risolta" })
      ]));

      radice.appendChild(el("section", { class: "riquadro" }, [
        el("h2", { text: "Tempi e volumi" }),
        el("dl", { class: "dati orizzontali" }, [
          el("dt", { text: "Segnalazioni totali" }), el("dd", { text: String(stats.total) }),
          el("dt", { text: "Tempo medio di risoluzione" }),
          el("dd", { text: stats.avgResolutionHours ? `${stats.avgResolutionHours} ore` : "—" }),
          el("dt", { text: "Da WhatsApp" }), el("dd", { text: String(stats.byChannel.whatsapp || 0) }),
          el("dt", { text: "Da email" }), el("dd", { text: String(stats.byChannel.email || 0) })
        ])
      ]));

      if (stats.employees && stats.employees.length) {
        radice.appendChild(el("section", { class: "riquadro" }, [
          el("h2", { text: "Attivita dello staff" }),
          el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Persona" }), el("th", { text: "Assegnate" }),
              el("th", { text: "Aperte" }), el("th", { text: "Risolte" }), el("th", { text: "Risposte" })
            ])]),
            el("tbody", {}, stats.employees.map((r) => el("tr", {}, [
              el("td", { text: r.full_name }),
              el("td", { text: String(r.assigned_count ?? r.assegnate ?? 0) }),
              el("td", { text: String(r.open_count ?? r.aperte ?? 0) }),
              el("td", { text: String(r.resolved_count ?? r.risolte ?? 0) }),
              el("td", { text: String(r.message_count ?? r.messaggi ?? 0) })
            ])))
          ])
        ]));
      }
    }

    if (ops && ops.conteggi) {
      const c = ops.conteggi;
      radice.appendChild(el("section", { class: "riquadro" }, [
        el("h2", { text: "Operativita" }),
        el("dl", { class: "dati orizzontali" }, [
          el("dt", { text: "Interventi aperti" }), el("dd", { text: String(c.interventi_aperti ?? 0) }),
          el("dt", { text: "Da assegnare" }), el("dd", { text: String(c.interventi_da_assegnare ?? 0) }),
          el("dt", { text: "Preventivi attesi" }), el("dd", { text: String(c.preventivi_attesi ?? 0) }),
          el("dt", { text: "Preventivi da decidere" }), el("dd", { text: String(c.preventivi_da_decidere ?? 0) }),
          el("dt", { text: "Sinistri aperti" }), el("dd", { text: String(c.sinistri_aperti ?? 0) }),
          el("dt", { text: "Pratiche legali" }), el("dd", { text: String(c.legali_aperte ?? 0) }),
          el("dt", { text: "Attivita scadute" }), el("dd", { class: c.attivita_scadute ? "attenzione" : "", text: String(c.attivita_scadute ?? 0) }),
          el("dt", { text: "DURC scaduti" }), el("dd", { class: c.durc_scaduti ? "attenzione" : "", text: String(c.durc_scaduti ?? 0) })
        ])
      ]));

      if ((ops.scadenze || []).length) {
        radice.appendChild(el("section", { class: "riquadro" }, [
          el("h2", { text: "Scadenze entro 14 giorni" }),
          el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Scadenza" }), el("th", { text: "Attivita" }),
              el("th", { text: "Condominio" }), el("th", { text: "Assegnata a" })
            ])]),
            el("tbody", {}, ops.scadenze.map((s) => el("tr", {
              class: new Date(s.due_date) < new Date() ? "urgente" : ""
            }, [
              el("td", { text: soloData(s.due_date) }),
              el("td", { text: s.title }),
              el("td", { text: s.condominio_nome || "—" }),
              el("td", { text: s.assigned_name || "—" })
            ])))
          ])
        ]));
      }
    }

    if ((alerts || []).length) {
      radice.appendChild(el("section", { class: "riquadro" }, [
        el("h2", { text: "Ultimi avvisi inviati" }),
        el("ul", { class: "elenco" }, alerts.map((a) => el("li", {}, [
          el("strong", { text: a.title }),
          el("span", { class: "sotto", text: `${a.condominio_nome} · ${a.created_by_name} · ${daQuando(a.created_at)}` }),
          el("span", { class: "testo", text: a.message })
        ])))
      ]));
    }

    radice.appendChild(el("p", { class: "suggerimento", text: "Ctrl+K apre il comando rapido · Ctrl+1…9 cambia sezione · R aggiorna" }));
  }

  try {
    await carica();
  } catch (errore) {
    svuota(radice).appendChild(statoVuoto("Panoramica non disponibile.", errore.message));
  }

  const timer = setInterval(() => { if (document.hasFocus()) carica().catch(() => {}); }, 120000);
  return () => clearInterval(timer);
}
