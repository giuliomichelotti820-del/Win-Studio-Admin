/* =============================================================================
 * Centro di controllo dello stato del sistema
 *
 * Il menu a tendina in testata risponde a una domanda sola, quella che chiunque
 * si fa prima di dare la colpa all'app: «sta funzionando tutto?».
 *
 * Al posto di quattro spie sparse per l'applicazione — una in fondo alla barra
 * di stato, una nelle impostazioni, una dentro WhatsApp, una nella posta — c'e
 * un unico elenco con dentro ogni pezzo che puo rompersi: il server dello
 * Studio, la sessione, l'API, la casella email, il canale WhatsApp, la lettura
 * automatica della posta, le notifiche di Windows, l'aggiornamento dell'app, la
 * sicurezza della postazione e il carico della coda.
 *
 * Tre regole di lettura:
 *
 *   1. Ogni sonda dice sempre una delle cinque cose: va, va con riserva, non
 *      va, e spenta apposta, non lo sappiamo. Non esiste il verde per
 *      «probabilmente»: se non abbiamo interrogato, l'esito e "ignoto" e si
 *      vede.
 *   2. Il pallino in testata riassume la peggiore. Se e rosso, in ufficio si
 *      sta gia perdendo tempo su qualcosa.
 *   3. Ogni riga porta dove si risolve. Uno stato che non si puo affrontare da
 *      nessuna parte e una notizia inutile.
 *
 * Le sonde girano in parallelo e ognuna cade per conto suo: il canale WhatsApp
 * fuori uso non deve nascondere che invece l'email funziona. Chi non ha i
 * permessi (un dipendente sulle rotte da titolare) non vede un errore rosso, ma
 * una riga onesta che dice che quel dato lo vede solo il titolare.
 * ========================================================================== */

import { el, svuota, api, dataOra, daQuando, toast } from "./ui.js";

/* --- Vocabolario degli stati ---------------------------------------------- */

const ORDINE = { guasto: 0, avviso: 1, ignoto: 2, spento: 3, ok: 4 };

const ETICHETTE = {
  ok: "Operativo",
  avviso: "Da controllare",
  guasto: "Non funziona",
  spento: "Disattivato",
  ignoto: "Non verificato"
};

const SEGNI = { ok: "●", avviso: "▲", guasto: "■", spento: "○", ignoto: "?" };

/** Lo stato complessivo e il peggiore fra quelli che contano davvero. */
function riassunto(sonde) {
  let peggiore = "ok";
  for (const sonda of sonde) {
    // "Spento" e una scelta dello Studio, non un guasto: non peggiora il
    // riassunto, altrimenti chi tiene il non disturbare acceso vedrebbe
    // l'app perennemente gialla.
    if (sonda.stato === "spento") continue;
    if (ORDINE[sonda.stato] < ORDINE[peggiore]) peggiore = sonda.stato;
  }
  return peggiore;
}

function titoloRiassunto(livello, sonde) {
  const guasti = sonde.filter((s) => s.stato === "guasto").length;
  const avvisi = sonde.filter((s) => s.stato === "avviso").length;
  if (livello === "guasto") return guasti === 1 ? "1 servizio non funziona" : `${guasti} servizi non funzionano`;
  if (livello === "avviso") return avvisi === 1 ? "1 servizio da controllare" : `${avvisi} servizi da controllare`;
  if (livello === "ignoto") return "Stato non verificato";
  return "Tutto in ordine";
}

/* --- Costruzione di una riga ---------------------------------------------- */

function sonda(gruppo, titolo, stato, valore, dettaglio, azione) {
  return { gruppo, titolo, stato, valore, dettaglio, azione };
}

/* =============================================================================
 * Le sonde
 *
 * Ognuna e una funzione async che riceve il contesto e restituisce un elenco di
 * righe. Restituire piu righe da una sola chiamata di rete e voluto: un solo
 * giro su /api/admin/whatsapp/status racconta insieme la connessione, la
 * qualita del numero e i messaggi non partiti.
 * ========================================================================== */

/* --- Postazione: quello che sappiamo senza chiedere niente al server ------- */

async function sondaPostazione(ctx) {
  const esito = await window.studio.diagnostica();
  const d = esito.ok ? esito.dati : null;
  const righe = [];

  if (!d) {
    righe.push(sonda("Postazione", "Diagnostica locale", "guasto", "non disponibile", esito.errore));
    return righe;
  }

  /* Collegamento al server dello Studio ---------------------------------- */
  let statoRete = "guasto";
  let valoreRete = "irraggiungibile";
  if (d.raggiungibile) {
    // Sopra il mezzo secondo l'app resta usabile ma si sente: vale un giallo,
    // perche di solito e il primo sintomo di una linea che sta cedendo.
    statoRete = d.latenza != null && d.latenza > 1200 ? "avviso" : "ok";
    valoreRete = d.latenza != null ? `${d.latenza} ms` : "risponde";
  }
  righe.push(sonda(
    "Collegamento", "Server dello Studio", statoRete, valoreRete,
    `${d.baseUrl} · ${d.dettaglioRete || "—"}`,
    { testo: "Impostazioni del collegamento", vai: "impostazioni" }
  ));

  /* Aggiornamento dell'applicazione -------------------------------------- */
  const agg = d.aggiornamento || {};
  const mappaAgg = {
    pronta: ["avviso", `versione ${agg.versione || "nuova"} pronta`, "Verra installata alla chiusura dell'app."],
    scaricamento: ["ok", `scarico ${agg.percentuale || 0}%`, `Versione ${agg.versione || ""} in arrivo.`],
    errore: ["avviso", "non riuscito", agg.errore || "Riprova dalle impostazioni."],
    disattivato: ["spento", "disattivati", "Gli aggiornamenti automatici sono spenti in questa build."]
  };
  const [statoAgg, valoreAgg, dettAgg] = mappaAgg[agg.fase]
    || ["ok", `versione ${d.versione}`, "Nessun aggiornamento in attesa."];
  righe.push(sonda("Postazione", "Aggiornamento applicazione", statoAgg, valoreAgg, dettAgg,
    { testo: "Controlla adesso", fai: () => window.studio.controllaAggiornamento() }));

  /* Protezione del token sul disco --------------------------------------- */
  righe.push(sonda(
    "Sicurezza", "Sessione cifrata sul disco",
    d.cifratura ? "ok" : "avviso",
    d.cifratura ? "DPAPI attiva" : "non disponibile",
    d.cifratura
      ? "Il token e leggibile solo dall'account Windows che ha fatto l'accesso."
      : "Windows non offre la cifratura: il token resta in memoria e a ogni riavvio serve un nuovo accesso."
  ));

  /* Notifiche di Windows -------------------------------------------------- */
  const impostazioni = ctx.impostazioni || {};
  const silenzio = d.silenzio || impostazioni.nonDisturbare;
  righe.push(sonda(
    "Comunicazioni", "Notifiche di Windows",
    !impostazioni.notificheDesktop ? "spento" : silenzio ? "spento" : "ok",
    !impostazioni.notificheDesktop ? "disattivate"
      : impostazioni.nonDisturbare ? "non disturbare"
        : silenzio ? "fuori orario" : `ogni ${impostazioni.pollSeconds || 45}s`,
    silenzio
      ? "Le segnalazioni continuano ad arrivare, ma Windows non le annuncia."
      : "Il controllo delle nuove segnalazioni gira in sottofondo.",
    { testo: "Aggiorna le notifiche adesso", fai: () => window.studio.aggiornaNotifiche() }
  ));

  /* Cartella dei dati locali --------------------------------------------- */
  righe.push(sonda(
    "Postazione", "Dati locali", "ok", "in ordine",
    `${d.cartellaDati} · dispositivo ${String(d.deviceId || "").slice(0, 8)}…`,
    { testo: "Apri la cartella", fai: () => window.studio.apriCartellaDati() }
  ));

  return righe;
}

/* --- PIN e blocco della postazione ---------------------------------------- */

async function sondaSicurezza(ctx) {
  const righe = [];
  const impostazioni = ctx.impostazioni || {};

  const minuti = Number(impostazioni.bloccoMinuti) || 0;
  righe.push(sonda(
    "Sicurezza", "Blocco per inattivita",
    minuti > 0 ? (minuti > 30 ? "avviso" : "ok") : "avviso",
    minuti > 0 ? `dopo ${minuti} min` : "disattivato",
    minuti > 0
      ? "Lo schermo si oscura e per riprendere serve il PIN o la password."
      : "La postazione resta aperta a chiunque passi dalla scrivania.",
    { testo: "Impostazioni di sicurezza", vai: "impostazioni" }
  ));

  const pin = await window.studio.pinStato().catch(() => null);
  righe.push(sonda(
    "Sicurezza", "PIN rapido di accesso",
    pin && pin.configurato ? "ok" : "avviso",
    pin && pin.configurato ? `${pin.lunghezza} cifre` : "non impostato",
    pin && pin.configurato
      ? `Impostato il ${dataOra(pin.creatoIl)}${pin.usatoIl ? ` · ultimo uso ${daQuando(pin.usatoIl)}` : ""}.`
      : "Senza PIN ogni sblocco chiede la password completa.",
    { testo: "Impostazioni di sicurezza", vai: "impostazioni" }
  ));

  return righe;
}

/* --- API dello Studio: la sessione e ancora buona? ------------------------ */

async function sondaSessione(ctx) {
  const partenza = Date.now();
  try {
    const me = await api.get("/api/auth/me");
    const durata = Date.now() - partenza;
    return [sonda(
      "Collegamento", "API dello Studio",
      durata > 1500 ? "avviso" : "ok",
      `${durata} ms`,
      `Sessione valida per ${me && me.fullName ? me.fullName : ctx.utente.fullName}.`
    )];
  } catch (errore) {
    // Sessione scaduta o server che rifiuta: in entrambi i casi da qui non si
    // lavora piu, quindi e rosso. Cambia solo che cosa c'e da fare, e lo dice
    // il pulsante della riga.
    return [sonda(
      "Collegamento", "API dello Studio", "guasto",
      errore.status === 401 ? "sessione scaduta" : "errore",
      errore.message,
      errore.status === 401
        ? { testo: "Esci e rientra", fai: async () => { await window.studio.logout(); location.reload(); } }
        : null
    )];
  }
}

/* --- Canale email (Gmail) -------------------------------------------------- */

async function sondaEmail() {
  try {
    const dati = await api.get("/api/admin/email-status");
    const config = dati.config || {};
    const check = dati.check || {};
    const righe = [];

    righe.push(sonda(
      "Comunicazioni", "Invio email (Gmail)",
      check.ok ? (dati.failures ? "avviso" : "ok") : "guasto",
      check.ok ? (config.sender || "collegato") : (check.stage === "config" ? "non configurato" : "credenziali rifiutate"),
      check.ok
        ? (dati.failures
          ? `${dati.failures} invii non riusciti fra gli ultimi ${(dati.recent || []).length}.`
          : `Ultimi ${(dati.recent || []).length} invii tutti consegnati.`)
        : `${check.error || "Canale non verificabile."}${check.hint ? ` — ${check.hint}` : ""}`,
      { testo: "Apri la posta", vai: "posta" }
    ));

    const ultimo = (dati.recent || [])[0];
    if (ultimo) {
      righe.push(sonda(
        "Comunicazioni", "Ultima email inviata",
        ultimo.status === "failed" ? "avviso" : "ok",
        dataOra(ultimo.created_at),
        `${ultimo.subject || "(senza oggetto)"} → ${ultimo.recipient || "—"}${ultimo.error ? ` · ${ultimo.error}` : ""}`
      ));
    }
    return righe;
  } catch (errore) {
    if (errore.status === 403) {
      return [sonda("Comunicazioni", "Invio email (Gmail)", "ignoto", "riservato al titolare",
        "Lo stato del canale email lo vede solo chi ha il ruolo di titolare.")];
    }
    return [sonda("Comunicazioni", "Invio email (Gmail)", "ignoto", "non verificato", errore.message)];
  }
}

/* --- Lettura automatica della posta in arrivo ----------------------------- */

async function sondaPostaInArrivo() {
  try {
    const dati = await api.get("/api/admin/inbound?limit=1");
    const spenta = dati.lettura !== "attiva";
    const ultimo = dati.ultimoMessaggio;
    // Se la lettura e accesa ma non entra niente da un giorno intero, o la
    // casella e davvero ferma o la lettura si e inceppata: in entrambi i casi
    // e una cosa da guardare, non da ignorare.
    const fermaDaUnGiorno = !spenta && (!ultimo || Date.now() - new Date(`${String(ultimo).replace(" ", "T")}Z`).getTime() > 24 * 3600 * 1000);

    return [sonda(
      "Comunicazioni", "Lettura automatica della posta",
      spenta ? "spento" : fermaDaUnGiorno ? "avviso" : "ok",
      spenta ? "disattivata" : `ogni ${dati.ogniMinuti || "—"} min`,
      spenta
        ? "Le email in arrivo non diventano segnalazioni da sole."
        : `Casella ${dati.casellaLetta || "—"} · ultimo messaggio ${ultimo ? daQuando(ultimo) : "mai"}.`,
      { testo: "Apri la posta in arrivo", vai: "posta" }
    )];
  } catch (errore) {
    if (errore.status === 403) return [];
    return [sonda("Comunicazioni", "Lettura automatica della posta", "ignoto", "non verificata", errore.message)];
  }
}

/* --- Canale WhatsApp ------------------------------------------------------ */

async function sondaWhatsApp() {
  try {
    const dati = await api.get("/api/admin/whatsapp/status");
    const conteggi = dati.counts || {};
    const righe = [];

    righe.push(sonda(
      "Comunicazioni", "WhatsApp Business",
      dati.ok ? "ok" : dati.connected ? "guasto" : "spento",
      dati.ok ? (dati.displayNumber || "collegato") : dati.connected ? "errore Meta" : "non configurato",
      dati.ok
        ? `${dati.verifiedName || "numero dello Studio"}${dati.qualityRating ? ` · qualita ${dati.qualityRating}` : ""}.`
        : dati.error || "Senza credenziali si continua a lavorare con i link wa.me.",
      { testo: "Apri WhatsApp", vai: "whatsapp" }
    ));

    // Il webhook e la meta che manca piu spesso: senza, i messaggi dei
    // condomini non entrano e nessuno se ne accorge finche non telefonano.
    if (dati.connected) {
      righe.push(sonda(
        "Comunicazioni", "Webhook WhatsApp in entrata",
        dati.webhookReady ? (dati.signatureChecked ? "ok" : "avviso") : "guasto",
        dati.webhookReady ? (dati.signatureChecked ? "verificato" : "senza firma") : "non attivo",
        dati.webhookReady
          ? (dati.signatureChecked
            ? `Ultimo messaggio ricevuto ${conteggi.ultimo_in ? daQuando(conteggi.ultimo_in) : "mai"}.`
            : "Manca WHATSAPP_APP_SECRET: le chiamate in entrata non vengono verificate.")
          : "Manca WHATSAPP_VERIFY_TOKEN: i messaggi dei condomini non arrivano."
      ));
    }

    if (conteggi.falliti) {
      righe.push(sonda(
        "Comunicazioni", "Messaggi WhatsApp non partiti", "avviso", `${conteggi.falliti} in 7 giorni`,
        `Inviati ${conteggi.out_settimana || 0}, ricevuti ${conteggi.in_settimana || 0} nella stessa settimana.`,
        { testo: "Apri WhatsApp", vai: "whatsapp" }
      ));
    }
    return righe;
  } catch (errore) {
    if (errore.status === 403) return [];
    return [sonda("Comunicazioni", "WhatsApp Business", "ignoto", "non verificato", errore.message)];
  }
}

/* --- Carico della coda ----------------------------------------------------- */

async function sondaCoda() {
  try {
    const dati = await api.get("/api/admin/stats");
    const righe = [];

    righe.push(sonda(
      "Lavoro", "Segnalazioni urgenti aperte",
      dati.urgent > 0 ? (dati.urgent > 3 ? "guasto" : "avviso") : "ok",
      String(dati.urgent || 0),
      dati.urgent ? "Hanno la precedenza su tutto il resto della coda." : "Nessuna urgenza in sospeso.",
      { testo: "Vai alle urgenti", vai: "coda", parametri: { status: "aperte", priority: "urgente" } }
    ));

    righe.push(sonda(
      "Lavoro", "Segnalazioni senza assegnatario",
      dati.unassigned > 0 ? (dati.unassigned > 10 ? "avviso" : "ok") : "ok",
      String(dati.unassigned || 0),
      dati.unassigned ? "Nessuno le ha ancora prese in carico." : "Tutte le pratiche aperte hanno un responsabile.",
      { testo: "Vai alle non assegnate", vai: "coda", parametri: { status: "aperte", assegnate: "nessuno" } }
    ));

    if (dati.contactPending) {
      righe.push(sonda(
        "Lavoro", "Richieste dal modulo contatti", dati.contactPending > 5 ? "avviso" : "ok",
        String(dati.contactPending),
        "Arrivate dal sito e ancora da smistare.",
        { testo: "Aprile", vai: "coda", parametri: { status: "aperte", channel: "contatto" } }
      ));
    }

    righe.push(sonda(
      "Lavoro", "Tempo medio di chiusura", "ok",
      dati.avgResolutionHours != null ? `${dati.avgResolutionHours} h` : "—",
      `Su ${dati.total || 0} segnalazioni registrate in tutto.`
    ));

    return righe;
  } catch (errore) {
    if (errore.status === 403) return [];
    return [sonda("Lavoro", "Carico della coda", "ignoto", "non verificato", errore.message)];
  }
}

/* =============================================================================
 * Raccolta
 * ========================================================================== */

const SONDE = [sondaPostazione, sondaSessione, sondaSicurezza, sondaEmail, sondaPostaInArrivo, sondaWhatsApp, sondaCoda];

/**
 * Interroga tutte le sonde in parallelo.
 *
 * Nessuna sonda puo far fallire il quadro: quella che esplode diventa una riga
 * "non verificato", che e comunque un'informazione — e in genere la piu utile,
 * perche indica dove guardare.
 */
export async function raccogliStato(ctx) {
  const esiti = await Promise.all(SONDE.map(async (fn) => {
    try { return await fn(ctx); } catch (errore) {
      console.error("Sonda di stato non riuscita:", errore);
      return [sonda("Sistema", "Controllo interno", "ignoto", "non riuscito", errore.message)];
    }
  }));
  return esiti.flat().filter(Boolean);
}

/* =============================================================================
 * Il menu a tendina
 * ========================================================================== */

const ORDINE_GRUPPI = ["Collegamento", "Comunicazioni", "Lavoro", "Sicurezza", "Postazione", "Sistema"];

/**
 * Costruisce il pulsante di testata e il pannello che gli si apre sotto.
 *
 * @param {object} ctx  contesto dell'app: utente, impostazioni, versione, naviga
 * @returns {{nodo: HTMLElement, commuta: Function, aggiorna: Function, distruggi: Function}}
 */
export function centroStato(ctx) {
  const pallino = el("span", { class: "stato-pallino stato-ignoto" });
  const etichetta = el("span", { class: "stato-etichetta", text: "Stato sistema" });
  const freccia = el("span", { class: "stato-freccia", text: "▾" });

  const bottone = el("button", {
    class: "centro-stato-bottone",
    title: "Stato globale del sistema (Ctrl+Shift+S)",
    "aria-haspopup": "true",
    "aria-expanded": "false"
  }, [pallino, etichetta, freccia]);

  const corpo = el("div", { class: "centro-stato-corpo" });
  const riepilogo = el("div", { class: "centro-stato-riepilogo" });
  const piede = el("div", { class: "centro-stato-piede" });

  const pannello = el("div", { class: "centro-stato-pannello nascosta", role: "dialog", "aria-label": "Stato del sistema" }, [
    el("header", { class: "centro-stato-testa" }, [
      el("div", {}, [
        el("strong", { text: "Stato del sistema" }),
        el("span", { class: "sotto", text: "Tutto quello che puo smettere di funzionare, in un posto solo" })
      ]),
      el("span", { class: "spazio" }),
      el("button", { class: "bottone piccolo", text: "↻ Aggiorna", onclick: () => aggiorna(true) })
    ]),
    riepilogo,
    corpo,
    piede
  ]);

  const nodo = el("div", { class: "centro-stato" }, [bottone, pannello]);

  let aperto = false;
  let inCorso = false;
  let ultimaRaccolta = null;
  let timer = null;

  /* --- Disegno ----------------------------------------------------------- */

  function riga(s) {
    const azione = s.azione
      ? el("button", {
        class: "centro-stato-azione", text: s.azione.testo,
        onclick: async () => {
          if (s.azione.vai) { chiudi(); ctx.naviga(s.azione.vai, s.azione.parametri || {}); return; }
          try {
            await s.azione.fai();
            toast("Fatto.", "ok");
            aggiorna(true);
          } catch (errore) {
            toast(errore.message || "Non riuscito.", "errore");
          }
        }
      })
      : null;

    return el("div", { class: `centro-stato-riga riga-${s.stato}` }, [
      el("span", { class: `stato-pallino stato-${s.stato}`, title: ETICHETTE[s.stato], text: SEGNI[s.stato] }),
      el("div", { class: "centro-stato-testi" }, [
        el("div", { class: "centro-stato-titolo" }, [
          el("span", { text: s.titolo }),
          el("span", { class: "spazio" }),
          el("span", { class: `centro-stato-valore valore-${s.stato}`, text: s.valore || ETICHETTE[s.stato] })
        ]),
        s.dettaglio ? el("p", { class: "sotto", text: s.dettaglio }) : null,
        azione
      ])
    ]);
  }

  function disegna(sonde) {
    const livello = riassunto(sonde);

    pallino.className = `stato-pallino stato-${livello}`;
    etichetta.textContent = titoloRiassunto(livello, sonde);
    bottone.classList.toggle("allarme", livello === "guasto");
    bottone.classList.toggle("attenzione", livello === "avviso");

    svuota(riepilogo).append(
      ...["ok", "avviso", "guasto", "spento", "ignoto"].map((tipo) => {
        const quanti = sonde.filter((s) => s.stato === tipo).length;
        return quanti
          ? el("span", { class: `centro-stato-conteggio conteggio-${tipo}` }, [
            el("span", { class: `stato-pallino stato-${tipo}` }),
            el("span", { text: `${quanti} ${ETICHETTE[tipo].toLowerCase()}` })
          ])
          : null;
      })
    );

    svuota(corpo);
    const gruppi = [...new Set(sonde.map((s) => s.gruppo))]
      .sort((a, b) => (ORDINE_GRUPPI.indexOf(a) + 99) % 99 - (ORDINE_GRUPPI.indexOf(b) + 99) % 99);

    for (const gruppo of gruppi) {
      const dentro = sonde
        .filter((s) => s.gruppo === gruppo)
        .sort((a, b) => ORDINE[a.stato] - ORDINE[b.stato]);
      corpo.append(
        el("div", { class: "centro-stato-gruppo", text: gruppo }),
        ...dentro.map(riga)
      );
    }

    svuota(piede).append(
      el("span", { text: `Controllato ${dataOra(new Date().toISOString())}` }),
      el("span", { class: "spazio" }),
      el("button", {
        class: "link", text: "Diagnostica completa",
        onclick: () => { chiudi(); ctx.naviga("impostazioni"); }
      }),
      el("button", {
        class: "link", text: "Copia il rapporto",
        onclick: () => copiaRapporto(sonde)
      })
    );
  }

  /**
   * Rapporto testuale: quando si telefona a chi tiene i sistemi, questa e
   * l'unica cosa che serve incollare.
   */
  async function copiaRapporto(sonde) {
    const righe = [
      `Win Studio Admin ${ctx.versione} — stato del sistema`,
      `Rilevato il ${new Date().toLocaleString("it-IT")}`,
      `Utente: ${ctx.utente.fullName} (${ctx.utente.email})`,
      ""
    ];
    for (const gruppo of [...new Set(sonde.map((s) => s.gruppo))]) {
      righe.push(`[${gruppo}]`);
      for (const s of sonde.filter((x) => x.gruppo === gruppo)) {
        righe.push(`  ${ETICHETTE[s.stato].toUpperCase()} · ${s.titolo}: ${s.valore || "—"}`);
        if (s.dettaglio) righe.push(`      ${s.dettaglio}`);
      }
      righe.push("");
    }
    const testo = righe.join("\n");
    try {
      await navigator.clipboard.writeText(testo);
      toast("Rapporto copiato negli appunti.", "ok");
    } catch {
      // Appunti negati dal sistema: il rapporto vale di piu di un messaggio
      // d'errore, quindi lo si salva su file.
      const esito = await window.studio.salvaTesto("stato-sistema.txt", testo, "Salva il rapporto di stato");
      toast(esito.ok && esito.dati ? "Rapporto salvato." : "Non e stato possibile copiare il rapporto.", esito.ok ? "ok" : "errore");
    }
  }

  /* --- Aggiornamento ------------------------------------------------------ */

  async function aggiorna(forzato = false) {
    if (inCorso) return;
    // Fuori dal pannello aperto ci si accontenta di un giro al minuto: le
    // sonde costano quattro chiamate di rete, non e roba da fare a vuoto.
    if (!forzato && ultimaRaccolta && Date.now() - ultimaRaccolta < 55000) return;

    inCorso = true;
    bottone.classList.add("in-corso");
    if (aperto && !corpo.childElementCount) {
      corpo.append(el("div", { class: "caricamento" }, [el("span", { class: "spinner" }), el("span", { text: "Controllo i servizi…" })]));
    }
    try {
      const sonde = await raccogliStato(ctx);
      ultimaRaccolta = Date.now();
      disegna(sonde);
    } finally {
      inCorso = false;
      bottone.classList.remove("in-corso");
    }
  }

  /* --- Apertura e chiusura ------------------------------------------------ */

  function apri() {
    aperto = true;
    pannello.classList.remove("nascosta");
    bottone.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", fuori, true);
    document.addEventListener("keydown", suTasto, true);
    aggiorna(true);
  }

  function chiudi() {
    aperto = false;
    pannello.classList.add("nascosta");
    bottone.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", fuori, true);
    document.removeEventListener("keydown", suTasto, true);
  }

  function commuta() {
    if (aperto) chiudi(); else apri();
  }

  function fuori(evento) {
    if (!nodo.contains(evento.target)) chiudi();
  }

  function suTasto(evento) {
    if (evento.key === "Escape") { evento.stopPropagation(); chiudi(); bottone.focus(); }
  }

  bottone.addEventListener("click", commuta);

  // Il primo giro parte subito, i successivi ogni minuto: il pallino in
  // testata deve essere gia vero prima che qualcuno lo guardi.
  aggiorna(true);
  timer = setInterval(() => aggiorna(false), 60000);

  return {
    nodo,
    commuta,
    apri,
    chiudi,
    aggiorna: () => aggiorna(true),
    distruggi: () => { clearInterval(timer); chiudi(); }
  };
}
