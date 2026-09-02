/* =============================================================================
 * Coda delle segnalazioni — la schermata dove si passa la giornata.
 *
 * Tutto e pensato per il volume: elenco denso, filtri sempre visibili,
 * navigazione da tastiera (j/k o frecce), selezione multipla con la barra
 * spaziatrice e azioni di massa. I tasti da 1 a 6 cambiano stato senza aprire
 * la scheda: e il gesto piu ripetuto della giornata e non deve costare un
 * caricamento di pagina.
 * ========================================================================== */

import {
  el, svuota, api, cached, toast, dataOra, daQuando, pastigliaStato, pastigliaPriorita,
  STATI, PRIORITA, CANALI, STATI_APERTI, statoVuoto, caricamento, modale, conferma
} from "../lib/ui.js";
import { esportaCsv } from "../lib/esporta.js";

const ORDINE_STATI = ["nuova", "presa_in_carico", "in_lavorazione", "in_attesa", "risolta", "chiusa"];

const FILTRI_INIZIALI = {
  status: "aperte", priority: "", channel: "", condominioId: "", q: "",
  sortBy: "updated_at", sortDir: "desc", page: 1, perPage: 50, assegnate: ""
};

export default async function monta(radice, ctx) {
  const stato = {
    filtri: { ...FILTRI_INIZIALI, ...(ctx.filtriIniziali || {}) },
    vistaSalvata: (ctx.filtriIniziali || {}).vistaSalvata || "",
    tickets: [],
    totale: 0,
    indice: 0,
    selezionati: new Set(),
    caricando: false
  };

  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  const piede = el("div", { class: "piede-coda" });
  const barraMassa = el("div", { class: "barra-massa nascosta" });

  radice.appendChild(barra);
  radice.appendChild(barraMassa);
  radice.appendChild(corpo);
  radice.appendChild(piede);

  const [staff, categorie, condomini] = await Promise.all([
    cached("staff", () => api.get("/api/staff")).catch(() => []),
    cached("categorie", () => api.get("/api/categories")).catch(() => []),
    cached("condomini", () => api.get("/api/condomini")).catch(() => [])
  ]);

  /* --- Barra dei filtri -------------------------------------------------- */

  const campoRicerca = el("input", {
    class: "ricerca", type: "search", placeholder: "Cerca numero, oggetto o richiedente…   ( / )",
    value: stato.filtri.q
  });

  let timerRicerca = null;
  campoRicerca.addEventListener("input", () => {
    clearTimeout(timerRicerca);
    timerRicerca = setTimeout(() => {
      stato.filtri.q = campoRicerca.value.trim();
      stato.filtri.page = 1;
      carica();
    }, 250);
  });

  function selettore(nome, etichetta, voci, valore) {
    const nodo = el("select", { class: "campo", title: etichetta },
      voci.map(([v, t]) => el("option", { value: v, text: t, selected: String(v) === String(valore) })));
    nodo.addEventListener("change", () => {
      stato.filtri[nome] = nodo.value;
      stato.filtri.page = 1;
      carica();
    });
    return nodo;
  }

  const selStato = selettore("status", "Stato", [
    ["aperte", "Aperte"], ["", "Tutti gli stati"],
    ...ORDINE_STATI.map((s) => [s, STATI[s]])
  ], stato.filtri.status);

  const selPriorita = selettore("priority", "Priorita", [
    ["", "Ogni priorita"], ...Object.entries(PRIORITA)
  ], stato.filtri.priority);

  const selCanale = selettore("channel", "Canale", [
    ["", "Ogni canale"], ...Object.entries(CANALI)
  ], stato.filtri.channel);

  const selCondominio = selettore("condominioId", "Condominio", [
    ["", "Ogni condominio"], ...condomini.map((c) => [c.id, c.nome])
  ], stato.filtri.condominioId);

  const selAssegnate = selettore("assegnate", "Assegnazione", [
    ["", "Tutte"], ["mie", "Assegnate a me"], ["nessuno", "Non assegnate"]
  ], stato.filtri.assegnate);

  const selOrdine = selettore("sortBy", "Ordinamento", [
    ["updated_at", "Ultimo aggiornamento"], ["created_at", "Data di apertura"],
    ["priority", "Priorita"], ["status", "Stato"]
  ], stato.filtri.sortBy);

  const bottoneAggiorna = el("button", { class: "bottone", text: "Aggiorna", title: "R", onclick: () => carica() });
  const bottoneAzzera = el("button", {
    class: "bottone", text: "Azzera filtri",
    onclick: () => { stato.filtri = { ...FILTRI_INIZIALI }; ricostruisciBarra(); carica(); }
  });

  /* --- Viste salvate ------------------------------------------------------
   * Ogni collega ha due o tre tagli della coda che rifa ogni giorno: "le mie
   * urgenti", "quelle del Condominio Aurora", "in attesa da piu di una
   * settimana". Salvarli una volta vale piu di sette tendine.
   * ---------------------------------------------------------------------- */

  const selViste = el("select", { class: "campo", title: "Viste salvate" });

  function vistiSalvate() {
    return ctx.impostazioni.filtriSalvati || [];
  }

  function ricostruisciViste() {
    svuota(selViste).append(
      el("option", { value: "", text: "— Viste salvate —" }),
      ...vistiSalvate().map((v) => el("option", { value: v.id, text: v.nome, selected: v.id === stato.vistaSalvata }))
    );
  }

  selViste.addEventListener("change", () => {
    const vista = vistiSalvate().find((v) => v.id === selViste.value);
    if (!vista) return;
    stato.filtri = { ...FILTRI_INIZIALI, ...vista.filtri, page: 1 };
    stato.vistaSalvata = vista.id;
    ricostruisciBarra();
    carica();
  });

  async function salvaVista() {
    const nome = el("input", { class: "campo largo", placeholder: "Per esempio: le mie urgenti" });
    modale({
      titolo: "Salva questa vista",
      contenuto: el("div", { class: "colonna" }, [
        el("label", { class: "campo-etichetta" }, [el("span", { text: "Nome della vista" }), nome]),
        el("p", { class: "sotto", text: "Vengono salvati i filtri attuali (stato, priorita, canale, condominio, assegnazione, ordinamento e testo cercato). La vista compare anche nel comando rapido." })
      ]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Salva", primaria: true,
          azione: async (chiudi) => {
            const etichetta = nome.value.trim();
            if (!etichetta) return;
            chiudi();
            const vista = {
              id: `v${Date.now().toString(36)}`,
              nome: etichetta,
              filtri: { ...stato.filtri, page: 1 }
            };
            const elenco = [...vistiSalvate().filter((v) => v.nome !== etichetta), vista];
            ctx.impostazioni.filtriSalvati = elenco;
            await window.studio.impostazioni({ filtriSalvati: elenco });
            window.studio.annota({ azione: "vista-salvata", oggetto: etichetta });
            stato.vistaSalvata = vista.id;
            ricostruisciViste();
            toast("Vista salvata: la trovi anche con Ctrl+K.", "ok");
          }
        }
      ]
    });
  }

  async function eliminaVista() {
    const vista = vistiSalvate().find((v) => v.id === selViste.value);
    if (!vista) {
      toast("Scegli prima una vista salvata.", "avviso");
      return;
    }
    if (!(await conferma(`Eliminare la vista "${vista.nome}"?`))) return;
    const elenco = vistiSalvate().filter((v) => v.id !== vista.id);
    ctx.impostazioni.filtriSalvati = elenco;
    await window.studio.impostazioni({ filtriSalvati: elenco });
    window.studio.annota({ azione: "vista-rimossa", oggetto: vista.nome });
    stato.vistaSalvata = "";
    ricostruisciViste();
    toast("Vista eliminata.", "ok");
  }

  const bottoneSalvaVista = el("button", { class: "bottone", text: "★ Salva vista", title: "Salva i filtri attuali", onclick: salvaVista });
  const bottoneEliminaVista = el("button", { class: "bottone piccolo", text: "✕", title: "Elimina la vista scelta", onclick: eliminaVista });

  /* --- Esportazione ------------------------------------------------------- */

  const bottoneEsporta = el("button", {
    class: "bottone", text: "Esporta CSV", title: "Le righe visibili, pronte per Excel",
    onclick: () => esportaCsv("coda-segnalazioni", stato.tickets, [
      { titolo: "Numero", valore: (t) => t.ticket_number },
      { titolo: "Oggetto", valore: (t) => t.subject },
      { titolo: "Categoria", valore: (t) => t.category_label || "" },
      { titolo: "Canale", valore: (t) => CANALI[t.channel] || t.channel },
      { titolo: "Condominio", valore: (t) => t.condominio_nome || "" },
      { titolo: "Richiedente", valore: (t) => t.client_name || t.contact_name || "" },
      { titolo: "Email richiedente", valore: (t) => t.client_email || t.contact_email || "" },
      { titolo: "Stato", valore: (t) => STATI[t.status] || t.status },
      { titolo: "Priorita", valore: (t) => PRIORITA[t.priority] || t.priority },
      { titolo: "Assegnata a", valore: (t) => t.assigned_name || "" },
      { titolo: "Aperta il", valore: (t) => dataOra(t.created_at) },
      { titolo: "Aggiornata il", valore: (t) => dataOra(t.updated_at) }
    ])
  });

  // `vistaSalvata` viaggia con i parametri di navigazione ma non e un filtro:
  // fuori dai filtri prima che qualcuno lo spedisca al server.
  delete stato.filtri.vistaSalvata;

  function ricostruisciBarra() {
    campoRicerca.value = stato.filtri.q;
    selStato.value = stato.filtri.status;
    selPriorita.value = stato.filtri.priority;
    selCanale.value = stato.filtri.channel;
    selCondominio.value = stato.filtri.condominioId;
    selAssegnate.value = stato.filtri.assegnate;
    selOrdine.value = stato.filtri.sortBy;
    selViste.value = stato.vistaSalvata || "";
  }

  barra.append(
    campoRicerca, selStato, selPriorita, selCanale, selCondominio, selAssegnate, selOrdine,
    bottoneAggiorna, bottoneAzzera,
    el("span", { class: "spazio" }),
    selViste, bottoneEliminaVista, bottoneSalvaVista, bottoneEsporta
  );
  ricostruisciViste();

  /* --- Caricamento -------------------------------------------------------- */

  function queryString() {
    const p = new URLSearchParams();
    const f = stato.filtri;
    if (f.status) p.set("status", f.status);
    if (f.priority) p.set("priority", f.priority);
    if (f.channel) p.set("channel", f.channel);
    if (f.condominioId) p.set("condominioId", f.condominioId);
    if (f.q) p.set("q", f.q);
    // L'assegnazione la taglia il server (assignedTo=id oppure "none"): fatta
    // qui sui dati gia scaricati filtrava la sola pagina corrente, lasciando
    // il conteggio e la paginazione a raccontare un'altra storia — tre righe a
    // schermo sotto la scritta «412 segnalazioni, pagina 1 di 9».
    if (f.assegnate === "mie") p.set("assignedTo", String(ctx.utente.id));
    else if (f.assegnate === "nessuno") p.set("assignedTo", "none");
    p.set("sortBy", f.sortBy);
    p.set("sortDir", f.sortDir);
    p.set("page", String(f.page));
    p.set("perPage", String(f.perPage));
    return p.toString();
  }

  async function carica({ silenzioso = false } = {}) {
    if (stato.caricando) return;
    stato.caricando = true;
    if (!silenzioso) svuota(corpo).appendChild(caricamento("Carico la coda…"));
    try {
      const dati = await api.get(`/api/tickets?${queryString()}`);
      const elenco = dati.tickets || [];

      stato.tickets = elenco;
      stato.totale = dati.total || elenco.length;
      stato.indice = Math.min(stato.indice, Math.max(0, elenco.length - 1));
      disegna();
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Non riesco a leggere la coda.", errore.message));
    } finally {
      stato.caricando = false;
    }
  }

  /* --- Disegno ------------------------------------------------------------ */

  function disegna() {
    svuota(corpo);
    if (!stato.tickets.length) {
      corpo.appendChild(statoVuoto("Nessuna segnalazione con questi filtri.", "Prova ad allargare la ricerca o ad azzerare i filtri."));
      aggiornaPiede();
      return;
    }

    const tabella = el("table", { class: `tabella ${ctx.impostazioni.densita === "compatta" ? "densa" : ""}` });
    const intestazione = el("thead", {}, [
      el("tr", {}, [
        el("th", { class: "col-sel" }),
        el("th", { text: "Numero" }),
        el("th", { text: "Oggetto" }),
        el("th", { text: "Condominio" }),
        el("th", { text: "Richiedente" }),
        el("th", { text: "Stato" }),
        el("th", { text: "Priorita" }),
        el("th", { text: "Assegnata a" }),
        el("th", { text: "Aggiornata" })
      ])
    ]);

    const righe = el("tbody");
    stato.tickets.forEach((ticket, i) => {
      const selezionata = stato.selezionati.has(ticket.id);
      const riga = el("tr", {
        class: `${i === stato.indice ? "attiva" : ""} ${selezionata ? "selezionata" : ""} ${ticket.priority === "urgente" && STATI_APERTI.includes(ticket.status) ? "urgente" : ""}`,
        onclick: (evento) => {
          stato.indice = i;
          if (evento.ctrlKey || evento.metaKey) commutaSelezione(ticket.id);
          else disegna();
        },
        ondblclick: () => apri(ticket)
      }, [
        el("td", { class: "col-sel" }, [
          el("input", {
            type: "checkbox", checked: selezionata,
            onclick: (evento) => { evento.stopPropagation(); commutaSelezione(ticket.id); }
          })
        ]),
        el("td", { class: "mono" }, [
          el("a", { class: "link", text: ticket.ticket_number, onclick: (e) => { e.preventDefault(); apri(ticket); } })
        ]),
        el("td", {}, [
          el("div", { class: "oggetto", text: ticket.subject }),
          el("div", { class: "sotto", text: `${ticket.category_label || "—"} · ${CANALI[ticket.channel] || ticket.channel}` })
        ]),
        el("td", { text: ticket.condominio_nome || "—" }),
        el("td", {}, [
          el("div", { text: ticket.client_name || ticket.contact_name || "—" }),
          el("div", { class: "sotto", text: ticket.client_email || ticket.contact_email || "" })
        ]),
        el("td", {}, [pastigliaStato(ticket.status)]),
        el("td", {}, [pastigliaPriorita(ticket.priority)]),
        el("td", { text: ticket.assigned_name || "—", class: ticket.assigned_name ? "" : "attenzione" }),
        el("td", { title: dataOra(ticket.updated_at), text: daQuando(ticket.updated_at) })
      ]);
      righe.appendChild(riga);
    });

    tabella.append(intestazione, righe);
    corpo.appendChild(tabella);
    aggiornaPiede();
    aggiornaBarraMassa();

    const attiva = righe.children[stato.indice];
    if (attiva) attiva.scrollIntoView({ block: "nearest" });
  }

  function aggiornaPiede() {
    svuota(piede);
    const pagine = Math.max(1, Math.ceil(stato.totale / stato.filtri.perPage));
    piede.append(
      el("span", { class: "conteggio", text: `${stato.totale} segnalazioni · pagina ${stato.filtri.page} di ${pagine}` }),
      el("span", { class: "spazio" }),
      el("button", {
        class: "bottone", text: "‹ Precedente", disabled: stato.filtri.page <= 1,
        onclick: () => { stato.filtri.page -= 1; carica(); }
      }),
      el("button", {
        class: "bottone", text: "Successiva ›", disabled: stato.filtri.page >= pagine,
        onclick: () => { stato.filtri.page += 1; carica(); }
      }),
      el("span", { class: "suggerimento", text: "j/k scorri · Invio apri · Spazio seleziona · 1-6 stato · A assegna a me" })
    );
  }

  /* --- Selezione multipla e azioni di massa ------------------------------- */

  function commutaSelezione(id) {
    if (stato.selezionati.has(id)) stato.selezionati.delete(id);
    else stato.selezionati.add(id);
    disegna();
  }

  function aggiornaBarraMassa() {
    const quante = stato.selezionati.size;
    barraMassa.classList.toggle("nascosta", quante === 0);
    if (!quante) return;
    svuota(barraMassa).append(
      el("strong", { text: `${quante} selezionate` }),
      el("button", { class: "bottone", text: "Stato…", onclick: () => modaleMassa("status") }),
      el("button", { class: "bottone", text: "Priorita…", onclick: () => modaleMassa("priority") }),
      el("button", { class: "bottone", text: "Assegna…", onclick: () => modaleMassa("assignedTo") }),
      el("button", { class: "bottone", text: "Assegna a me", onclick: () => applicaMassa({ assignedTo: ctx.utente.id }) }),
      el("span", { class: "spazio" }),
      el("button", { class: "bottone", text: "Deseleziona", onclick: () => { stato.selezionati.clear(); disegna(); } })
    );
  }

  function modaleMassa(campo) {
    const voci = campo === "status" ? ORDINE_STATI.map((s) => [s, STATI[s]])
      : campo === "priority" ? Object.entries(PRIORITA)
        : [["", "Nessuno"], ...staff.map((s) => [s.id, s.full_name])];

    const scelta = el("select", { class: "campo largo" }, voci.map(([v, t]) => el("option", { value: v, text: t })));
    modale({
      titolo: campo === "status" ? "Cambia stato" : campo === "priority" ? "Cambia priorita" : "Assegna a",
      contenuto: el("div", { class: "colonna" }, [scelta]),
      azioni: [
        { testo: "Annulla", azione: (chiudi) => chiudi() },
        {
          testo: "Applica", primaria: true,
          azione: (chiudi) => {
            chiudi();
            const valore = campo === "assignedTo" ? (scelta.value ? Number(scelta.value) : null) : scelta.value;
            applicaMassa({ [campo]: valore });
          }
        }
      ]
    });
  }

  async function applicaMassa(modifica) {
    const ids = [...stato.selezionati];
    let fatte = 0;
    let errori = 0;
    for (const id of ids) {
      try {
        await api.patch(`/api/tickets/${id}`, modifica);
        fatte += 1;
      } catch {
        errori += 1;
      }
    }
    stato.selezionati.clear();
    toast(errori ? `${fatte} aggiornate, ${errori} non riuscite.` : `${fatte} segnalazioni aggiornate.`, errori ? "avviso" : "ok");
    carica({ silenzioso: true });
  }

  /* --- Azioni sulla riga attiva ------------------------------------------ */

  function corrente() {
    return stato.tickets[stato.indice] || null;
  }

  function bersagli() {
    return stato.selezionati.size ? [...stato.selezionati] : (corrente() ? [corrente().id] : []);
  }

  async function applica(modifica, descrizione) {
    const ids = bersagli();
    if (!ids.length) return;
    if (ids.length === 1) {
      try {
        await api.patch(`/api/tickets/${ids[0]}`, modifica);
        toast(descrizione, "ok");
        carica({ silenzioso: true });
      } catch (errore) {
        toast(errore.message, "errore");
      }
      return;
    }
    applicaMassa(modifica);
  }

  function apri(ticket) {
    ctx.naviga(`ticket:${ticket.id}`);
  }

  /* --- Tastiera ----------------------------------------------------------- */

  function suTasto(evento) {
    const dentroCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(evento.target.tagName);
    if (evento.key === "/" && !dentroCampo) {
      evento.preventDefault();
      campoRicerca.focus();
      campoRicerca.select();
      return;
    }
    if (dentroCampo) {
      if (evento.key === "Escape") evento.target.blur();
      return;
    }

    const massimo = stato.tickets.length - 1;
    switch (evento.key) {
      case "j": case "ArrowDown":
        evento.preventDefault();
        stato.indice = Math.min(massimo, stato.indice + 1);
        disegna();
        break;
      case "k": case "ArrowUp":
        evento.preventDefault();
        stato.indice = Math.max(0, stato.indice - 1);
        disegna();
        break;
      case "Home":
        stato.indice = 0; disegna(); break;
      case "End":
        stato.indice = massimo; disegna(); break;
      case "Enter":
        if (corrente()) { evento.preventDefault(); apri(corrente()); }
        break;
      case " ":
        if (corrente()) { evento.preventDefault(); commutaSelezione(corrente().id); }
        break;
      case "a": case "A":
        applica({ assignedTo: ctx.utente.id }, "Assegnata a te.");
        break;
      case "u": case "U":
        applica({ assignedTo: null }, "Assegnazione rimossa.");
        break;
      case "r": case "R":
        carica();
        break;
      case "1": case "2": case "3": case "4": case "5": case "6": {
        const nuovo = ORDINE_STATI[Number(evento.key) - 1];
        if (!nuovo) break;
        if (["risolta", "chiusa"].includes(nuovo) && bersagli().length > 3) {
          conferma(`Segnare ${bersagli().length} segnalazioni come "${STATI[nuovo]}"?`).then((si) => {
            if (si) applica({ status: nuovo }, `Stato: ${STATI[nuovo]}.`);
          });
        } else {
          applica({ status: nuovo }, `Stato: ${STATI[nuovo]}.`);
        }
        break;
      }
      case "Escape":
        if (stato.selezionati.size) { stato.selezionati.clear(); disegna(); }
        break;
      default:
        break;
    }
  }

  document.addEventListener("keydown", suTasto);

  // Aggiornamento in sottofondo: la coda resta viva senza toccare nulla, ma
  // solo quando non c'e una selezione aperta (ridisegnare sotto le mani di chi
  // sta scegliendo e peggio che aspettare).
  const timer = setInterval(() => {
    if (!stato.selezionati.size && document.hasFocus()) carica({ silenzioso: true });
  }, Math.max(20, ctx.impostazioni.pollSeconds || 45) * 1000);

  await carica();

  return () => {
    document.removeEventListener("keydown", suTasto);
    clearInterval(timer);
  };
}
