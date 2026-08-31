/* =============================================================================
 * Archivio: tutto quello che si sa di un condominio e di ciascun condomino,
 * in un posto solo.
 *
 * Convivono due sorgenti, e la differenza e dichiarata a schermo perche
 * cambia chi vede cosa:
 *
 *   · i documenti del condominio stanno sul server dello Studio (verbali,
 *     rendiconti, regolamenti, comunicazioni): li vedono tutti i colleghi e,
 *     per le categorie previste, i condomini nella loro area riservata;
 *   · le schede di dettaglio — unita immobiliare, millesimi, recapiti,
 *     documenti d'identita, note di gestione — restano su questo computer,
 *     perche l'API dello Studio non ha (ancora) un posto dove conservarle.
 *
 * Le informazioni gia presenti sul server (posizione contabile, pratiche
 * aperte, condominio di appartenenza) vengono lette da li e mostrate accanto
 * alla scheda, cosi la pagina risponde da sola alla domanda «chi e questa
 * persona e a che punto siamo con lei».
 * ========================================================================== */

import {
  el, svuota, api, cached, invalidaCache, toast, euro, dataOra, soloData,
  statoVuoto, caricamento, modale, conferma, pastigliaStato, pastigliaPriorita
} from "../lib/ui.js";

const CATEGORIE_DOCUMENTI = [
  ["verbale", "Verbali di assemblea"],
  ["rendiconto", "Rendiconti e bilanci"],
  ["comunicazione", "Comunicazioni"],
  ["regolamento", "Regolamenti"],
  ["altro", "Altri documenti"]
];

const CAMPI_CONDOMINIO = [
  ["codice_fiscale", "Codice fiscale del condominio"],
  ["iban", "IBAN del conto condominiale"],
  ["banca", "Banca / filiale"],
  ["unita_totali", "Numero di unita immobiliari"],
  ["millesimi_totali", "Millesimi complessivi"],
  ["amministratore_referente", "Referente dello Studio"],
  ["polizza_globale", "Polizza globale fabbricato"],
  ["polizza_scadenza", "Scadenza polizza"],
  ["manutentore_ascensore", "Manutentore ascensore"],
  ["manutentore_caldaia", "Manutentore centrale termica"],
  ["ultima_assemblea", "Ultima assemblea"],
  ["prossima_assemblea", "Prossima assemblea"]
];

const CAMPI_PERSONA = [
  ["unita_immobiliare", "Unita immobiliare (scala, interno)"],
  ["millesimi", "Millesimi di proprieta"],
  ["titolo", "Titolo (proprietario, inquilino, usufruttuario)"],
  ["telefono", "Telefono"],
  ["telefono_alternativo", "Altro recapito"],
  ["pec", "PEC"],
  ["codice_fiscale", "Codice fiscale"],
  ["indirizzo_residenza", "Residenza"],
  ["referente", "Persona di riferimento"],
  ["consegna_chiavi", "Chiavi / accessi consegnati"]
];

export default async function monta(radice, ctx) {
  const colonnaCondomini = el("aside", { class: "lista-conversazioni" });
  const pannello = el("section", { class: "pannello-archivio" });
  radice.appendChild(el("div", { class: "due-colonne archivio" }, [colonnaCondomini, pannello]));

  let condomini = [];
  let filtro = "";
  let condominioAttivo = null;
  let schedaAperta = "documenti";

  /* --- Elenco condomini ---------------------------------------------------- */

  async function caricaCondomini(forza) {
    svuota(colonnaCondomini).appendChild(caricamento());
    if (forza) invalidaCache("condomini");
    try {
      condomini = await cached("condomini", () => api.get("/api/condomini"));
      disegnaElenco();
      const iniziale = (ctx.parametri && ctx.parametri.condominioId)
        ? condomini.find((c) => String(c.id) === String(ctx.parametri.condominioId))
        : condomini[0];
      if (iniziale) apriCondominio(iniziale);
    } catch (errore) {
      svuota(colonnaCondomini).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  function disegnaElenco() {
    svuota(colonnaCondomini);
    const ricerca = el("input", { class: "ricerca", type: "search", placeholder: "Cerca condominio…", value: filtro });
    ricerca.addEventListener("input", () => { filtro = ricerca.value.toLowerCase().trim(); disegnaElenco(); ricerca.focus(); });
    colonnaCondomini.appendChild(el("header", { class: "lista-testa" }, [ricerca]));

    const elenco = condomini.filter((c) => !filtro || `${c.nome} ${c.indirizzo || ""}`.toLowerCase().includes(filtro));
    if (!elenco.length) {
      colonnaCondomini.appendChild(statoVuoto("Nessun condominio."));
      return;
    }

    for (const c of elenco) {
      colonnaCondomini.appendChild(el("button", {
        class: `voce-conversazione ${condominioAttivo && condominioAttivo.id === c.id ? "attiva" : ""}`,
        onclick: () => apriCondominio(c)
      }, [
        el("div", { class: "riga" }, [
          el("strong", { text: c.nome }),
          c.open_count ? el("span", { class: "pill pill-conteggio", text: String(c.open_count) }) : null
        ]),
        el("div", { class: "sotto", text: c.indirizzo || "" }),
        el("div", { class: "sotto", text: `${c.member_count ?? 0} condomini` })
      ]));
    }
  }

  function apriCondominio(condominio) {
    condominioAttivo = condominio;
    disegnaElenco();
    disegnaPannello();
  }

  /* --- Pannello del condominio --------------------------------------------- */

  function disegnaPannello() {
    svuota(pannello);
    if (!condominioAttivo) {
      pannello.appendChild(statoVuoto("Scegli un condominio."));
      return;
    }

    pannello.appendChild(el("header", { class: "filo-testa" }, [
      el("div", {}, [
        el("h2", { text: condominioAttivo.nome }),
        el("span", { class: "sotto", text: condominioAttivo.indirizzo || "" })
      ]),
      el("div", { class: "azioni" }, [
        el("button", {
          class: "bottone piccolo", text: "Pratiche aperte",
          onclick: () => ctx.naviga("coda", { condominioId: condominioAttivo.id, status: "aperte" })
        })
      ])
    ]));

    const schede = [
      ["documenti", "Documenti del condominio"],
      ["scheda", "Scheda del condominio"],
      ["persone", "Condomini"]
    ];

    pannello.appendChild(el("nav", { class: "schede" }, schede.map(([id, etichetta]) =>
      el("button", {
        class: `scheda-tab ${schedaAperta === id ? "attiva" : ""}`,
        text: etichetta,
        onclick: () => { schedaAperta = id; disegnaPannello(); }
      }))));

    const contenuto = el("div", { class: "scheda-contenuto" }, [caricamento()]);
    pannello.appendChild(contenuto);

    if (schedaAperta === "documenti") documentiCondominio(contenuto);
    else if (schedaAperta === "scheda") schedaLocale(contenuto, "condominio", condominioAttivo.id, CAMPI_CONDOMINIO);
    else elencoPersone(contenuto);
  }

  /* --- Documenti sul server ------------------------------------------------ */

  async function documentiCondominio(contenitore) {
    svuota(contenitore).appendChild(caricamento("Carico i documenti…"));
    try {
      const dati = await api.get(`/api/documents?condominioId=${condominioAttivo.id}&perPage=50`);
      const documenti = dati.documents || [];

      svuota(contenitore).append(
        el("div", { class: "toolbar" }, [
          el("button", { class: "bottone primario", text: "Carica documento", onclick: caricaDocumento }),
          el("button", { class: "bottone", text: "Aggiorna", onclick: () => documentiCondominio(contenitore) }),
          el("span", { class: "sotto", text: "Questi file stanno sul server dello Studio e sono visibili ai colleghi." })
        ]),
        documenti.length
          ? el("table", { class: "tabella densa" }, [
              el("thead", {}, [el("tr", {}, [
                el("th", { text: "Documento" }), el("th", { text: "Categoria" }),
                el("th", { text: "Dimensione" }), el("th", { text: "Caricato" }), el("th", { text: "" })
              ])]),
              el("tbody", {}, documenti.map((d) => el("tr", {}, [
                el("td", {}, [
                  el("strong", { text: d.title }),
                  el("div", { class: "sotto", text: d.file_name }),
                  d.note ? el("div", { class: "sotto", text: d.note }) : null
                ]),
                el("td", { text: `${d.category_icon || ""} ${d.category_label || d.category}` }),
                el("td", { text: `${Math.round((d.file_size || 0) / 1024)} kB` }),
                el("td", { text: dataOra(d.created_at) }),
                el("td", { class: "azioni" }, [
                  el("button", {
                    class: "bottone piccolo", text: "Scarica",
                    onclick: async () => {
                      const esito = await window.studio.scarica(`/api/documents/${d.id}/download`, d.file_name);
                      if (esito.ok && esito.dati) toast("File salvato.", "ok");
                      else if (!esito.ok) toast(esito.errore, "errore");
                    }
                  }),
                  el("button", {
                    class: "bottone piccolo pericolo", text: "Elimina",
                    onclick: async () => {
                      if (!(await conferma(`Eliminare "${d.title}" dal server?`))) return;
                      try {
                        await api.del(`/api/documents/${d.id}`);
                        toast("Documento eliminato.", "ok");
                        documentiCondominio(contenitore);
                      } catch (errore) { toast(errore.message, "errore"); }
                    }
                  })
                ])
              ])))
            ])
          : statoVuoto("Nessun documento caricato per questo condominio.")
      );
    } catch (errore) {
      svuota(contenitore).appendChild(statoVuoto("Documenti non disponibili.", errore.message));
    }
  }

  function caricaDocumento() {
    const titolo = el("input", { class: "campo largo", placeholder: "Verbale assemblea del 12 marzo" });
    const categoria = el("select", { class: "campo largo" },
      CATEGORIE_DOCUMENTI.map(([v, t]) => el("option", { value: v, text: t })));
    const nota = el("input", { class: "campo largo", placeholder: "Nota facoltativa" });

    modale({
      titolo: `Carica un documento — ${condominioAttivo.nome}`,
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Titolo" }), titolo]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Categoria" }), categoria]),
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Nota" }), nota]),
        el("p", { class: "sotto", text: "PDF, immagini, Word o Excel fino a 20 MB. Il file viene scelto al passo successivo." })
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Scegli il file e carica", primaria: true,
          azione: async (chiudi) => {
            if (!titolo.value.trim()) { toast("Serve un titolo.", "avviso"); return; }
            const esito = await window.studio.caricaDocumento({
              condominioId: condominioAttivo.id,
              categoria: categoria.value,
              titolo: titolo.value.trim(),
              nota: nota.value.trim()
            });
            if (!esito.ok) { toast(esito.errore, "errore"); return; }
            chiudi();
            if (esito.dati) {
              toast("Documento caricato.", "ok");
              disegnaPannello();
            }
          }
        }
      ]
    });
  }

  /* --- Schede locali (condominio e persona) -------------------------------- */

  async function schedaLocale(contenitore, tipo, chiave, campi, intestazione) {
    const risposta = await window.studio.archivioLeggi(tipo, chiave);
    const scheda = risposta.ok ? risposta.dati : { campi: {}, note: "", allegati: [] };
    const nodi = {};

    const griglia = el("div", { class: "griglia-campi" }, campi.map(([nome, etichetta]) => {
      const input = el("input", { class: "campo largo", value: scheda.campi[nome] || "" });
      nodi[nome] = input;
      return el("label", { class: "campo-etichetta" }, [el("span", { text: etichetta }), input]);
    }));

    const note = el("textarea", { class: "campo largo", rows: 6, text: scheda.note || "" });

    const allegati = el("div", { class: "allegati-locali" });

    function disegnaAllegati(voci) {
      svuota(allegati);
      if (!voci.length) {
        allegati.appendChild(el("p", { class: "sotto", text: "Nessun file nella scheda." }));
        return;
      }
      for (const voce of voci) {
        allegati.appendChild(el("div", { class: "allegato-locale" }, [
          el("button", {
            class: "bottone piccolo", text: `📎 ${voce.nome}`,
            onclick: () => window.studio.archivioApri(voce.percorso)
          }),
          el("span", { class: "sotto", text: `${Math.round(voce.dimensione / 1024)} kB · ${soloData(voce.aggiunto)}` }),
          el("button", {
            class: "bottone piccolo pericolo", text: "Rimuovi",
            onclick: async () => {
              if (!(await conferma(`Rimuovere "${voce.nome}" dalla scheda?`))) return;
              await window.studio.archivioRimuoviAllegato(tipo, chiave, voce.id);
              const aggiornata = await window.studio.archivioLeggi(tipo, chiave);
              disegnaAllegati(aggiornata.ok ? aggiornata.dati.allegati || [] : []);
            }
          })
        ]));
      }
    }

    disegnaAllegati(scheda.allegati || []);

    svuota(contenitore).append(
      intestazione || null,
      el("p", { class: "avviso-locale", text: "Scheda conservata su questo computer: non viene inviata al sito ne condivisa con gli altri colleghi." }),
      griglia,
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Note di gestione" }), note]),
      el("div", { class: "toolbar" }, [
        el("button", {
          class: "bottone primario", text: "Salva scheda",
          onclick: async () => {
            const valori = Object.fromEntries(Object.entries(nodi).map(([k, v]) => [k, v.value.trim()]));
            const esito = await window.studio.archivioSalva(tipo, chiave, valori, note.value);
            toast(esito.ok ? "Scheda salvata." : esito.errore, esito.ok ? "ok" : "errore");
          }
        }),
        el("button", {
          class: "bottone", text: "Allega file",
          onclick: async () => {
            const esito = await window.studio.archivioAllega(tipo, chiave);
            if (!esito.ok) { toast(esito.errore, "errore"); return; }
            const aggiornata = await window.studio.archivioLeggi(tipo, chiave);
            disegnaAllegati(aggiornata.ok ? aggiornata.dati.allegati || [] : []);
            if (esito.dati.length) toast(`${esito.dati.length} file aggiunti alla scheda.`, "ok");
          }
        }),
        scheda.aggiornato ? el("span", { class: "sotto", text: `Ultimo salvataggio ${dataOra(scheda.aggiornato)}` }) : null
      ]),
      el("h3", { text: "File della scheda" }),
      allegati
    );
  }

  /* --- Persone del condominio ---------------------------------------------- */

  async function elencoPersone(contenitore) {
    svuota(contenitore).appendChild(caricamento("Carico i condomini…"));
    try {
      const [membri, morosi] = await Promise.all([
        api.get(`/api/condomini/${condominioAttivo.id}/membri`),
        api.get("/api/morosi").catch(() => [])
      ]);

      const perUtente = new Map((morosi || []).map((m) => [m.user_id, m]));

      svuota(contenitore).append(
        el("p", { class: "sotto", text: `${membri.length} condomini registrati. Apri una riga per la scheda completa.` }),
        membri.length
          ? el("table", { class: "tabella densa" }, [
              el("thead", {}, [el("tr", {}, [
                el("th", { text: "Condomino" }), el("th", { text: "Email" }),
                el("th", { text: "Posizione contabile" }), el("th", { text: "" })
              ])]),
              el("tbody", {}, membri.map((m) => {
                const moroso = perUtente.get(m.id);
                return el("tr", { class: moroso && moroso.morosita_status === "grave" ? "urgente" : "" }, [
                  el("td", {}, [el("strong", { text: m.full_name })]),
                  el("td", { text: m.email }),
                  el("td", {}, moroso
                    ? [el("span", { class: `pill pill-mor-${moroso.morosita_status}`, text: moroso.morosita_status.toUpperCase() }),
                       moroso.morosita_importo ? el("span", { class: "sotto", text: euro(moroso.morosita_importo) }) : null]
                    : [el("span", { class: "pill pill-mor-regolare", text: "REGOLARE" })]),
                  el("td", {}, [el("button", {
                    class: "bottone piccolo", text: "Apri scheda", onclick: () => schedaPersona(m, moroso)
                  })])
                ]);
              }))
            ])
          : statoVuoto("Nessun condomino registrato per questo stabile.")
      );
    } catch (errore) {
      svuota(contenitore).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  /* --- Scheda del singolo condomino ---------------------------------------- */

  function schedaPersona(persona, moroso) {
    const contenuto = el("div", { class: "scheda-persona" }, [caricamento()]);
    modale({ titolo: `${persona.full_name} — ${condominioAttivo.nome}`, contenuto, larghezza: 940 });

    (async () => {
      let pratiche = [];
      try {
        const dati = await api.get(`/api/tickets?q=${encodeURIComponent(persona.full_name)}&perPage=20&sortBy=updated_at`);
        pratiche = (dati.tickets || []).filter((t) => t.client_email === persona.email || t.client_name === persona.full_name);
      } catch { /* le pratiche sono un di piu: la scheda si apre comunque */ }

      svuota(contenuto);

      const riepilogo = el("section", { class: "riquadro" }, [
        el("h3", { text: "Dal gestionale" }),
        el("dl", { class: "dati orizzontali" }, [
          el("dt", { text: "Email" }), el("dd", { text: persona.email }),
          el("dt", { text: "Condominio" }), el("dd", { text: condominioAttivo.nome }),
          el("dt", { text: "Posizione contabile" }),
          el("dd", { text: moroso ? `${moroso.morosita_status} · ${euro(moroso.morosita_importo)}` : "regolare" }),
          el("dt", { text: "Aggiornata il" }),
          el("dd", { text: moroso && moroso.morosita_updated_at ? dataOra(moroso.morosita_updated_at) : "—" }),
          el("dt", { text: "Note contabili" }), el("dd", { text: (moroso && moroso.morosita_note) || "—" })
        ]),
        el("div", { class: "toolbar" }, [
          el("button", {
            class: "bottone piccolo", text: "Aggiorna posizione contabile",
            onclick: () => ctx.naviga("morosi")
          }),
          el("button", {
            class: "bottone piccolo", text: "Tutte le sue pratiche",
            onclick: () => ctx.naviga("coda", { q: persona.full_name, status: "" })
          })
        ])
      ]);

      const elencoPratiche = el("section", { class: "riquadro" }, [
        el("h3", { text: `Pratiche recenti (${pratiche.length})` }),
        pratiche.length
          ? el("table", { class: "tabella densa" }, [
              el("tbody", {}, pratiche.map((t) => el("tr", {}, [
                el("td", {}, [el("a", { class: "link", text: t.ticket_number, onclick: () => ctx.naviga(`ticket:${t.id}`) })]),
                el("td", { text: t.subject }),
                el("td", {}, [pastigliaStato(t.status)]),
                el("td", {}, [pastigliaPriorita(t.priority)]),
                el("td", { text: dataOra(t.updated_at) })
              ])))
            ])
          : statoVuoto("Nessuna pratica collegata.")
      ]);

      const schedaContenitore = el("section", { class: "riquadro" });
      contenuto.append(riepilogo, elencoPratiche, schedaContenitore);
      schedaLocale(schedaContenitore, "persona", persona.id, CAMPI_PERSONA, el("h3", { text: "Scheda anagrafica e documenti" }));
    })();
  }

  await caricaCondomini();
  return () => {};
}
