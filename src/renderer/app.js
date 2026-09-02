/* =============================================================================
 * Guscio dell'applicazione
 *
 * Tiene insieme accesso, barra laterale, testata, barra di stato, navigazione,
 * comando rapido, blocco della postazione e scorciatoie da tastiera.
 *
 * Ogni sezione e un modulo che espone `monta(radice, ctx)` e restituisce, se
 * serve, la funzione di smontaggio: cambiare vista non lascia mai in giro
 * timer o ascoltatori di tastiera della vista precedente.
 *
 * La disposizione e quella dei gestionali da postazione fissa: navigazione a
 * sinistra raggruppata per mestiere, contesto e ricerca in alto, stato del
 * sistema sempre visibile in basso. Niente si sposta cambiando sezione.
 * ========================================================================== */

import { el, svuota, toast, api, modale, dataOra } from "./lib/ui.js";
import { marchio, logo, NOME_PRODOTTO } from "./lib/marchio.js";
import { icona, iconaMenu } from "./lib/icone.js";
import { creaSchede } from "./lib/schede.js";
import { schermataAccesso } from "./views/accesso.js";
import { sorveglia, ferma as fermaBlocco, bloccaOra } from "./lib/blocco.js";
import { installaScorciatoie, mostraScorciatoie } from "./lib/scorciatoie.js";
import { centroStato } from "./lib/stato-sistema.js";
import { configuraPin, proponiPinSeServe } from "./lib/pin.js";
import { capitoloPerSezione } from "./views/guida.js";

/* =============================================================================
 * Mappa delle sezioni
 *
 * I gruppi non sono decorazione: separano il lavoro sulle pratiche dalle
 * anagrafiche, dalle comunicazioni e da cio che vede solo il titolare. Chi
 * apre l'app la mattina guarda solo il primo gruppo.
 * ========================================================================== */

const SEZIONI = [
  {
    gruppo: "Operativita",
    voci: [
      { id: "panoramica", titolo: "Panoramica", icona: "panoramica", descrizione: "Come sta andando lo Studio oggi", modulo: () => import("./views/panoramica.js") },
      { id: "coda", titolo: "Coda segnalazioni", icona: "coda", descrizione: "Le pratiche aperte, in ordine di lavorazione", modulo: () => import("./views/coda.js") },
      { id: "promemoria", titolo: "Promemoria", icona: "sveglia", descrizione: "Gli impegni presi su questa postazione, con l'avviso all'ora giusta", modulo: () => import("./views/promemoria.js") },
      { id: "archivio", titolo: "Archivio", icona: "archivio", descrizione: "Schede e documenti conservati sulla postazione", modulo: () => import("./views/archivio.js") }
    ]
  },
  {
    gruppo: "Anagrafiche",
    voci: [
      { id: "condomini", titolo: "Condomini", icona: "condomini", descrizione: "Stabili amministrati e relative schede", modulo: () => import("./views/condomini.js") },
      { id: "morosi", titolo: "Morosi", icona: "morosi", descrizione: "Posizioni debitorie e stato dei solleciti", modulo: () => import("./views/morosi.js") },
      { id: "fornitori", titolo: "Fornitori", icona: "fornitori", descrizione: "Imprese, referenti e regolarita documentale", modulo: () => import("./views/fornitori.js") }
    ]
  },
  {
    gruppo: "Comunicazioni",
    voci: [
      { id: "whatsapp", titolo: "WhatsApp", icona: "whatsapp", descrizione: "Conversazioni con condomini e fornitori", modulo: () => import("./views/whatsapp.js") },
      { id: "posta", titolo: "Posta in arrivo", icona: "posta", descrizione: "Messaggi da smistare in segnalazioni", modulo: () => import("./views/posta.js") },
      { id: "notifiche", titolo: "Notifiche", icona: "notifiche", descrizione: "Cosa e cambiato mentre non guardavi", modulo: () => import("./views/notifiche.js") }
    ]
  },
  {
    gruppo: "Amministrazione",
    voci: [
      { id: "studio", titolo: "Studio", icona: "studio", descrizione: "Persone dello Studio e carichi di lavoro", modulo: () => import("./views/staff.js") },
      { id: "controllo", titolo: "Controllo", icona: "controllo", descrizione: "Sessioni, credenziali e attivita dello staff", modulo: () => import("./views/controllo.js") },
      { id: "registro", titolo: "Registro attivita", icona: "registro", descrizione: "Cosa e stato fatto da questa postazione", modulo: () => import("./views/registro.js") },
      { id: "impostazioni", titolo: "Impostazioni", icona: "impostazioni", descrizione: "Collegamento, sicurezza, aspetto e manutenzione", modulo: () => import("./views/impostazioni.js") }
    ]
  },
  {
    gruppo: "Aiuto",
    voci: [
      { id: "guida", titolo: "Guida del programma", icona: "guida", descrizione: "Manuale completo: come si fa ogni cosa, e cosa fare quando non funziona", modulo: () => import("./views/guida.js") }
    ]
  }
];

const TUTTE = SEZIONI.flatMap((g) => g.voci);

const radice = document.getElementById("app");

let stato = null;
let smontaVista = null;
let vistaCorrente = null;
let contenitoreVista = null;
let intestazionePagina = null;
let badgeNotifiche = null;
let conteggioLaterale = null;
let barraAggiornamento = null;
let spiaRete = null;
let vociStato = {};
let ultimoAggiornamentoDati = null;
let tendinaStato = null;
let staccaScorciatoie = null;
let schede = null;
let bottoneIngrandisci = null;

/* Cronologia della navigazione, per Alt+← e Alt+→.
 *
 * Non e la cronologia del browser: qui non esistono URL e ricaricare la pagina
 * ricomincerebbe da capo. E un semplice cursore su un elenco di destinazioni,
 * che e esattamente quello che serve per tornare alla coda dopo aver aperto
 * tre pratiche di fila — il gesto piu ripetuto della giornata. */
const cronologia = { voci: [], cursore: -1, inCorso: false };

// Le ultime sezioni e pratiche aperte: il comando rapido le rimette in cima,
// perche nove volte su dieci si torna dove si era un minuto fa.
const recenti = [];

/* =============================================================================
 * Guscio
 * ========================================================================== */

function iniziali(nome) {
  return String(nome || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((parte) => parte[0].toUpperCase()).join("");
}

function ruolo(utente) {
  return utente.role === "super_admin" ? "Titolare" : "Dipendente";
}

/**
 * Barra dei titoli dello Studio.
 *
 * Sostituisce quella di Windows per due motivi concreti: dice a quale server si
 * e collegati — cosa che la barra di sistema non puo dire, e che in uno Studio
 * che lavora anche contro il collaudo e la prima domanda da farsi — e restituisce
 * l'altezza di due righe di coda. I tre bottoni a destra sono quelli veri:
 * passano dall'IPC e muovono la finestra di Windows.
 */
function barraTitoli() {
  let indirizzo = stato.impostazioni.baseUrl || "";
  try { indirizzo = new URL(stato.impostazioni.baseUrl).host; } catch { /* scritto a mano */ }

  // Un indirizzo che non e quello di produzione va detto, non nascosto: chi
  // chiude una pratica sul collaudo credendo di essere in produzione se ne
  // accorge il giorno dopo, dal condomino che richiama.
  const produzione = /workers\.dev$|burchielli/i.test(indirizzo) && !/localhost|127\.0\.0\.1|:\d{4}$/.test(indirizzo);

  const comando = async (nome) => {
    const esito = await window.studio.finestra(nome);
    aggiornaBottoneFinestra(esito && esito.massimizzata);
  };

  bottoneIngrandisci = el("button", {
    title: "Ingrandisci", ariaLabel: "Ingrandisci", onclick: () => comando("ingrandisci")
  }, [icona("finestra_max", 14)]);

  return el("header", { class: "barra-titoli" }, [
    logo(19),
    el("span", { class: "barra-titoli-nome", text: NOME_PRODOTTO }),
    el("span", {
      class: `barra-titoli-contesto ${produzione ? "" : "collaudo"}`,
      title: produzione
        ? `Collegata al server dello Studio: ${indirizzo}`
        : `Attenzione: questa non e l'installazione di produzione. Server: ${indirizzo}`
    }, [
      icona("server", 12),
      el("span", { text: produzione ? indirizzo : `collaudo · ${indirizzo}` })
    ]),
    el("div", { class: "comandi-finestra" }, [
      el("button", { title: "Riduci a icona", ariaLabel: "Riduci a icona", onclick: () => comando("riduci") }, [icona("finestra_min", 14)]),
      bottoneIngrandisci,
      el("button", { class: "chiudi", title: "Chiudi (l'app resta nell'area di notifica)", ariaLabel: "Chiudi", onclick: () => comando("chiudi") }, [icona("chiudi", 14)])
    ])
  ]);
}

function aggiornaBottoneFinestra(massimizzata) {
  if (!bottoneIngrandisci) return;
  svuota(bottoneIngrandisci).append(icona(massimizzata ? "finestra_ripristina" : "finestra_max", 14));
  bottoneIngrandisci.title = massimizzata ? "Ripristina" : "Ingrandisci";
}

function costruisciGuscio() {
  svuota(radice);

  /* --- Barra laterale ---------------------------------------------------- */

  let scorciatoia = 0;
  const laterale = el("nav", { class: "laterale" }, [
    marchio({ dimensione: 30, sottotitolo: "Amm. Burchielli" }),
    ...SEZIONI.map((gruppo) => el("div", { class: "gruppo-menu" }, [
      el("div", { class: "gruppo-titolo", text: gruppo.gruppo }),
      ...gruppo.voci.map((sezione) => {
        scorciatoia += 1;
        const conteggio = sezione.id === "notifiche"
          ? (conteggioLaterale = el("span", { class: "conteggio-menu nascosta" }))
          : null;
        return el("button", {
          class: "voce-menu", dataSezione: sezione.id, title: sezione.descrizione,
          onclick: () => naviga(sezione.id)
        }, [
          iconaMenu(sezione.icona),
          el("span", { class: "etichetta-menu", text: sezione.titolo }),
          conteggio || (scorciatoia <= 9 ? el("span", { class: "tasto", text: `Ctrl+${scorciatoia}` }) : null)
        ]);
      })
    ])),
    el("div", { class: "spazio" }),
    el("button", {
      class: "utente", title: "Account e sessione (clic per aprire)",
      onclick: menuUtente
    }, [
      el("span", { class: "pastiglia-utente", text: iniziali(stato.utente.fullName) }),
      el("span", { class: "utente-testo" }, [
        el("strong", { text: stato.utente.fullName }),
        el("span", { class: "sotto", text: ruolo(stato.utente) })
      ])
    ])
  ]);

  /* --- Testata ----------------------------------------------------------- */

  badgeNotifiche = el("span", { class: "badge nascosta" });
  spiaRete = el("span", { class: "spia", text: "Collegato" });

  // Il centro di stato si costruisce prima della testata perche ne fa parte, e
  // parte subito a interrogare i servizi: il pallino deve essere gia vero
  // quando qualcuno lo guarda per la prima volta.
  if (tendinaStato) tendinaStato.distruggi();
  tendinaStato = centroStato({
    utente: stato.utente,
    impostazioni: stato.impostazioni,
    versione: stato.versione,
    naviga
  });

  const briciole = el("div", { class: "briciole" });

  const testa = el("header", { class: "testa" }, [
    el("button", {
      class: "icona", title: "Comprimi la barra laterale (Ctrl+B)", ariaLabel: "Comprimi la barra laterale",
      onclick: commutaLaterale
    }, [icona("menu")]),
    el("button", {
      class: "icona", title: "Indietro (Alt+←)", ariaLabel: "Indietro", onclick: () => spostaCronologia(-1)
    }, [icona("freccia_sinistra")]),
    el("button", {
      class: "icona", title: "Avanti (Alt+→)", ariaLabel: "Avanti", onclick: () => spostaCronologia(1)
    }, [icona("freccia_destra")]),
    el("span", { class: "divisore-testa" }),
    briciole,
    el("span", { class: "spazio" }),
    el("button", { class: "cerca-globale", title: "Comando rapido (Ctrl+K)", onclick: apriPalette }, [
      icona("cerca", 14),
      el("span", { text: "Cerca pratiche, sezioni, azioni…" }),
      el("span", { class: "tasto", text: "Ctrl+K" })
    ]),
    el("button", {
      class: "icona", title: "Nuovo promemoria", ariaLabel: "Nuovo promemoria",
      onclick: apriPromemoria
    }, [icona("sveglia")]),
    el("span", { class: "divisore-testa" }),
    spiaRete,
    tendinaStato.nodo,
    el("button", {
      class: "icona con-badge", title: "Notifiche", ariaLabel: "Notifiche", onclick: () => naviga("notifiche")
    }, [icona("notifiche"), badgeNotifiche]),
    el("button", {
      class: "icona bottone-tema", title: "Cambia tema (Ctrl+Shift+T)", ariaLabel: "Cambia tema",
      onclick: ruotaTema
    }, [icona(temaIcona())]),
    el("button", { class: "icona", title: "Guida del programma (F1)", ariaLabel: "Guida", onclick: () => naviga("guida") }, [icona("guida")]),
    el("button", { class: "icona", title: "Blocca la postazione (Ctrl+L)", ariaLabel: "Blocca la postazione", onclick: () => bloccaOra(stato.utente) }, [icona("blocca")])
  ]);

  /* --- Corpo ------------------------------------------------------------- */

  intestazionePagina = el("div", { class: "intestazione-pagina" });
  contenitoreVista = el("main", { class: "vista" });
  barraAggiornamento = el("div", { class: "barra-aggiornamento nascosta" });

  // Le schede si costruiscono prima del montaggio perche fanno parte del
  // guscio: il nastro sta fra la testata e la vista, dove sta su ogni
  // programma che ne ha.
  schede = creaSchede({
    naviga,
    impostazioni: stato.impostazioni,
    salva: (parziali) => {
      Object.assign(stato.impostazioni, parziali);
      window.studio.impostazioni(parziali);
    }
  });

  radice.append(el("div", { class: "guscio-verticale" }, [
    barraTitoli(),
    el("div", { class: "guscio" }, [
      laterale,
      el("div", { class: "corpo" }, [
        testa, barraAggiornamento, schede.nodo, intestazionePagina, contenitoreVista, barraStato()
      ])
    ])
  ]));

  schede.ripristina();
  aggiornaBottoneFinestra(stato.massimizzata);

  aggiornaBriciole = (sezione) => {
    svuota(briciole).append(
      el("span", { text: sezione.gruppo || "Win Studio Admin" }),
      el("span", { class: "separatore", text: "›" }),
      el("strong", { text: sezione.titolo })
    );
  };

  document.querySelector(".guscio").classList.toggle("compressa", !!stato.impostazioni.lateraleCompressa);
  window.studio.statoAggiornamento().then(mostraAggiornamento);
}

let aggiornaBriciole = () => {};

/* --- Barra di stato ------------------------------------------------------- */

function barraStato() {
  let server = stato.impostazioni.baseUrl;
  try { server = new URL(stato.impostazioni.baseUrl).host; } catch { /* indirizzo scritto a mano */ }

  vociStato = {
    sincronia: el("span", { class: "voce-stato", text: "In attesa del primo aggiornamento" }),
    silenzio: el("span", { class: "voce-stato nascosta" }),
    zoom: el("button", {
      class: "voce-stato nascosta", title: "Ingrandimento dell'interfaccia — Ctrl+0 riporta al 100%",
      onclick: () => cambiaZoom(0)
    })
  };

  return el("footer", { class: "barra-stato" }, [
    el("span", { class: "voce-stato" }, [icona("utente", 12), el("span", { text: `${stato.utente.fullName} · ${ruolo(stato.utente)}` })]),
    el("span", { class: "voce-stato" }, [icona("server", 12), el("span", { class: "mono", text: server })]),
    vociStato.sincronia,
    vociStato.silenzio,
    vociStato.zoom,
    el("span", { class: "spazio" }),
    el("button", { class: "voce-stato", text: "Scorciatoie (Ctrl+/)", onclick: mostraScorciatoie }),
    el("button", { class: "voce-stato", text: "Guida (F1)", onclick: () => naviga("guida") }),
    el("button", { class: "voce-stato", text: "Diagnostica", onclick: () => naviga("impostazioni") }),
    el("span", { class: "voce-stato", text: `v${stato.versione}` })
  ]);
}

function segnalaSincronia() {
  ultimoAggiornamentoDati = new Date();
  if (vociStato.sincronia) {
    vociStato.sincronia.textContent = `Ultimo aggiornamento ${dataOra(ultimoAggiornamentoDati.toISOString())}`;
  }
  if (spiaRete) {
    spiaRete.className = "spia viva";
    spiaRete.textContent = "Collegato";
  }
}

// La spia dice quello che sappiamo davvero: l'ultimo caricamento non e
// riuscito. Puo essere la rete, puo essere il server: non fingiamo di
// distinguerli da qui.
function segnalaCaduta(messaggio) {
  if (!spiaRete) return;
  spiaRete.className = "spia giu";
  spiaRete.textContent = messaggio || "Ultimo caricamento non riuscito";
}

/* --- Barra laterale: compressione ---------------------------------------- */

function commutaLaterale() {
  const guscio = document.querySelector(".guscio");
  if (!guscio) return;
  const compressa = !guscio.classList.contains("compressa");
  guscio.classList.toggle("compressa", compressa);
  stato.impostazioni.lateraleCompressa = compressa;
  window.studio.impostazioni({ lateraleCompressa: compressa });
}

/* --- Tema ----------------------------------------------------------------- */

const GIRO_TEMI = ["sistema", "chiaro", "scuro"];

function temaIcona() {
  return { sistema: "tema_sistema", chiaro: "tema_chiaro", scuro: "tema_scuro" }[stato.impostazioni.tema] || "tema_sistema";
}

function ruotaTema() {
  const prossimo = GIRO_TEMI[(GIRO_TEMI.indexOf(stato.impostazioni.tema) + 1) % GIRO_TEMI.length];
  stato.impostazioni.tema = prossimo;
  applicaAspetto(stato.impostazioni);
  window.studio.impostazioni({ tema: prossimo });
  // L'icona la aggiorna la funzione, non chi l'ha chiamata: il tema si cambia
  // anche da Ctrl+Shift+T e dal comando rapido, dove non c'e nessun bottone
  // sotto il dito.
  const bottone = document.querySelector(".bottone-tema");
  if (bottone) svuota(bottone).append(icona(temaIcona()));
  toast(`Tema: ${{ sistema: "come Windows", chiaro: "chiaro", scuro: "scuro" }[prossimo]}.`);
}

function applicaAspetto(impostazioni) {
  const tema = impostazioni.tema;
  document.documentElement.dataset.tema = tema === "chiaro" ? "chiaro" : tema === "scuro" ? "scuro" : "";
  document.documentElement.dataset.densita = impostazioni.densita === "comoda" ? "comoda" : "compatta";
}

/* --- Menu dell'utente ----------------------------------------------------- */

function menuUtente() {
  const voce = (testo, descrizione, azione, classe = "bottone largo") =>
    el("button", { class: classe, onclick: () => { finestra.chiudi(); azione(); }, title: descrizione, text: testo });

  const finestra = modale({
    titolo: "Account",
    larghezza: 420,
    contenuto: el("div", { class: "colonna" }, [
      el("dl", { class: "dati" }, [
        el("dt", { text: "Nome" }), el("dd", { text: stato.utente.fullName }),
        el("dt", { text: "Email" }), el("dd", { text: stato.utente.email }),
        el("dt", { text: "Ruolo" }), el("dd", { text: ruolo(stato.utente) }),
        el("dt", { text: "PIN rapido" }),
        el("dd", { text: stato.pin && stato.pin.configurato ? `attivo, ${stato.pin.lunghezza} cifre` : "non impostato" }),
        el("dt", { text: "Versione" }), el("dd", { text: stato.versione })
      ]),
      voce("Blocca la postazione", "Ctrl+L", () => bloccaOra(stato.utente)),
      voce(
        stato.pin && stato.pin.configurato ? "Cambia il PIN rapido" : "Imposta il PIN rapido",
        "Sblocco veloce di questa postazione",
        apriConfigurazionePin
      ),
      voce("Prendi un promemoria", "Ctrl+Shift+R", () => apriPromemoria()),
      voce("Impostazioni", "Collegamento, sicurezza, aspetto", () => naviga("impostazioni")),
      voce("Registro delle attivita", "Cosa e stato fatto da questo computer", () => naviga("registro")),
      voce("Guida del programma", "F1", () => naviga("guida")),
      voce("Scorciatoie da tastiera", "Ctrl+/", mostraScorciatoie),
      voce("Esci dall'account", "Chiude la sessione su questo computer", async () => {
        await window.studio.logout();
        location.reload();
      }, "bottone largo pericolo")
    ])
  });
}

/* =============================================================================
 * Navigazione
 * ========================================================================== */

function trovaSezione(nome) {
  if (nome === "ticket") {
    return { id: "ticket", titolo: "Segnalazione", gruppo: "Operativita", descrizione: "Scheda della pratica", modulo: () => import("./views/ticket.js") };
  }
  const voce = TUTTE.find((s) => s.id === nome);
  if (!voce) return TUTTE[0];
  return { ...voce, gruppo: SEZIONI.find((g) => g.voci.includes(voce)).gruppo };
}

function evidenziaMenu(idSezione) {
  for (const voce of radice.querySelectorAll(".voce-menu")) {
    voce.classList.toggle("attiva", voce.getAttribute("data-sezione") === idSezione);
  }
}

async function naviga(destinazione, parametri = {}) {
  // Prima di smontare qualunque cosa: la vista corrente puo avere del testo
  // non salvato — la risposta al condomino scritta a meta e la piu cara — e
  // averlo dichiarato con `ctx.trattieniScheda`. Il controllo sta qui e non
  // nel nastro delle schede perche `naviga` e l'unica strada per cambiare
  // vista: la barra laterale, il comando rapido, Alt+←, il collegamento
  // `winstudio://` e le linguette passano tutti di qua.
  if (schede && !(await schede.puoLasciare(destinazione))) return;

  if (typeof smontaVista === "function") {
    try { smontaVista(); } catch (errore) { console.error(errore); }
    smontaVista = null;
  }

  const [nome, parametro] = String(destinazione).split(":");
  const sezione = trovaSezione(nome);

  vistaCorrente = sezione.id;
  evidenziaMenu(sezione.id === "ticket" ? "coda" : sezione.id);
  aggiornaBriciole(sezione);
  svuota(contenitoreVista);
  document.title = `${sezione.titolo} · Win Studio Admin`;

  svuota(intestazionePagina).append(
    el("div", {}, [
      el("h1", { text: sezione.titolo }),
      el("span", { class: "sotto", text: sezione.descrizione || "" })
    ]),
    el("span", { class: "spazio" })
  );

  ricorda(sezione, destinazione);

  // La scheda si registra qui, non nelle viste: ogni apertura e una scheda, e
  // una vista che si dimenticasse di dirlo sparirebbe dal nastro.
  if (schede) {
    schede.segna(destinazione, {
      etichetta: sezione.id === "ticket" ? `Pratica ${parametro || ""}`.trim() : sezione.titolo,
      icona: sezione.icona || "scheda"
    });
  }

  const ctx = {
    utente: stato.utente,
    impostazioni: stato.impostazioni,
    versione: stato.versione,
    cifratura: stato.cifraturaDisponibile,
    parametro,
    parametri,
    filtriIniziali: nome === "coda" ? parametri : null,
    naviga,
    ricarica: () => avvia(),
    // Le viste possono appendere i propri comandi accanto al titolo di pagina
    // invece di inventarsi una barra tutta loro.
    azioniPagina: intestazionePagina,
    segnalaSincronia,

    // La scheda di una pratica nasce con "Pratica 1234" perche il numero e
    // tutto quello che si sa prima di aver caricato: appena la vista conosce
    // l'oggetto, lo mette sulla linguetta.
    rinominaScheda: (etichetta) => {
      if (schede && etichetta) schede.segna(destinazione, { etichetta, icona: sezione.icona || "scheda" });
    },

    // Una vista con del testo non salvato registra qui la domanda da fare
    // prima di cambiare scheda.
    trattieniScheda: (domanda) => (schede ? schede.trattieni(domanda) : () => {}),

    // Stampa della pratica su carta intestata dello Studio.
    stampa: (dati) => window.studio.stampaPratica(dati),

    // Promemoria collegato a quello che si sta guardando.
    promemoria: (opzioni) => apriPromemoria(opzioni)
  };

  try {
    const modulo = await sezione.modulo();
    smontaVista = await modulo.default(contenitoreVista, ctx);
    segnalaSincronia();
  } catch (errore) {
    console.error(errore);
    segnalaCaduta();
    contenitoreVista.appendChild(el("p", { class: "errore", text: `Sezione non caricata: ${errore.message}` }));
  }

  if (stato.impostazioni.ultimaVista !== sezione.id && sezione.id !== "ticket") {
    window.studio.impostazioni({ ultimaVista: sezione.id });
    stato.impostazioni.ultimaVista = sezione.id;
  }
}

function ricorda(sezione, destinazione) {
  const etichetta = sezione.id === "ticket" ? `Segnalazione ${destinazione.split(":")[1]}` : sezione.titolo;
  const indice = recenti.findIndex((r) => r.destinazione === destinazione);
  if (indice >= 0) recenti.splice(indice, 1);
  recenti.unshift({ etichetta, destinazione, icona: sezione.icona || "scheda" });
  recenti.splice(6);

  // Muoversi con Alt+← non deve riscrivere la cronologia, altrimenti non si
  // torna mai indietro davvero: si oscillerebbe fra le ultime due voci.
  if (cronologia.inCorso) return;
  // Ripremere la stessa voce di menu non e uno spostamento.
  if (cronologia.voci[cronologia.cursore] === destinazione) return;
  cronologia.voci.splice(cronologia.cursore + 1);
  cronologia.voci.push(destinazione);
  // Cinquanta passi bastano per una giornata e non fanno crescere la memoria
  // di un'app che resta aperta per settimane.
  if (cronologia.voci.length > 50) cronologia.voci.shift();
  cronologia.cursore = cronologia.voci.length - 1;
}

/* --- Avanti e indietro ---------------------------------------------------- */

function spostaCronologia(passo) {
  const destinazione = cronologia.cursore + passo;
  if (destinazione < 0 || destinazione >= cronologia.voci.length) {
    toast(passo < 0 ? "Sei alla prima sezione aperta." : "Sei all'ultima sezione aperta.");
    return;
  }
  cronologia.cursore = destinazione;
  cronologia.inCorso = true;
  naviga(cronologia.voci[destinazione]).finally(() => { cronologia.inCorso = false; });
}

/* =============================================================================
 * PIN rapido
 * ========================================================================== */

/**
 * Apre la procedura di scelta del PIN e tiene allineato lo stato in memoria:
 * il menu dell'account e la tendina di stato leggono da li.
 */
function apriConfigurazionePin() {
  configuraPin({
    utente: stato.utente,
    sostituzione: !!(stato.pin && stato.pin.configurato),
    fatto: (nuovo) => {
      stato.pin = nuovo;
      if (tendinaStato) tendinaStato.aggiorna();
    }
  });
}

/* =============================================================================
 * Ingrandimento dell'interfaccia
 *
 * Ctrl+= e Ctrl+- muovono l'app di un gradino, Ctrl+0 la riporta al 100%. La
 * scala la applica il processo principale (`setZoomFactor`), non un `transform`
 * CSS: cosi cresce anche il testo delle finestre di sistema e restano nitide le
 * icone, che con uno zoom finto diventerebbero sfocate.
 * ========================================================================== */

async function cambiaZoom(passo) {
  const esito = await window.studio.zoom(passo);
  const scala = (esito && esito.zoom) || 1;
  stato.impostazioni.zoom = scala;
  mostraZoom(scala);
  if (passo === 0) toast("Ingrandimento riportato al 100%.");
}

/* La voce in barra di stato compare solo quando l'ingrandimento non e al 100%:
 * altrimenti sarebbe una riga fissa che dice sempre la stessa cosa. Serve a chi
 * ha premuto Ctrl+= per sbaglio e non capisce perche tutto e diventato grande. */
function mostraZoom(scala) {
  if (!vociStato.zoom) return;
  const valore = Number(scala) || 1;
  vociStato.zoom.classList.toggle("nascosta", Math.abs(valore - 1) < 0.001);
  vociStato.zoom.textContent = `Ingrandimento ${Math.round(valore * 100)}% · Ctrl+0 per tornare al 100%`;
}

/* =============================================================================
 * Promemoria rapido
 *
 * Si apre dalla testata, dal comando rapido e dalla scheda di una pratica —
 * dove arriva gia collegato alla pratica che si sta guardando, che e l'unico
 * modo perche il promemoria serva davvero quando suona.
 * ========================================================================== */

async function apriPromemoria(opzioni = {}) {
  const { nuovoPromemoria } = await import("./views/promemoria.js");
  nuovoPromemoria({
    ...opzioni,
    fatto: () => { if (vistaCorrente === "promemoria") naviga("promemoria"); }
  });
}

/* =============================================================================
 * Comando rapido (Ctrl+K)
 *
 * Una sola casella per tutto: le sezioni, le azioni piu frequenti, le viste
 * salvate della coda e la ricerca di una pratica per numero, oggetto o
 * richiedente. Chi lavora tutto il giorno qui dentro non deve cercare un
 * pulsante con il mouse.
 * ========================================================================== */

function azioniPalette() {
  const viste = (stato.impostazioni.filtriSalvati || []).map((vista) => ({
    gruppo: "Viste salvate",
    icona: "coda",
    etichetta: vista.nome,
    dettaglio: "Coda con i filtri salvati",
    azione: () => naviga("coda", { ...vista.filtri, vistaSalvata: vista.id })
  }));

  return [
    ...recenti.slice(1).map((r) => ({
      gruppo: "Aperti di recente", icona: r.icona, etichetta: r.etichetta,
      azione: () => naviga(r.destinazione)
    })),
    ...viste,
    ...TUTTE.map((s) => ({
      gruppo: "Sezioni", icona: s.icona, etichetta: s.titolo, dettaglio: s.descrizione,
      azione: () => naviga(s.id)
    })),
    { gruppo: "Coda", icona: "coda", etichetta: "Coda: solo urgenti aperte", azione: () => naviga("coda", { status: "aperte", priority: "urgente" }) },
    { gruppo: "Coda", icona: "coda", etichetta: "Coda: non assegnate", azione: () => naviga("coda", { status: "aperte", assegnate: "nessuno" }) },
    { gruppo: "Coda", icona: "coda", etichetta: "Coda: assegnate a me", azione: () => naviga("coda", { status: "aperte", assegnate: "mie" }) },
    { gruppo: "Coda", icona: "coda", etichetta: "Coda: arrivate dal modulo contatti", azione: () => naviga("coda", { status: "aperte", channel: "contatto" }) },
    { gruppo: "Controllo", icona: "controllo", etichetta: "Controllo: sessioni attive", azione: () => naviga("controllo", { scheda: "sessioni" }) },
    { gruppo: "Controllo", icona: "controllo", etichetta: "Controllo: attivita dello staff", azione: () => naviga("controllo", { scheda: "attivita" }) },
    { gruppo: "Controllo", icona: "controllo", etichetta: "Controllo: credenziali dipendenti", azione: () => naviga("controllo", { scheda: "dipendenti" }) },
    { gruppo: "Controllo", icona: "controllo", etichetta: "Controllo: credenziali condomini", azione: () => naviga("controllo", { scheda: "condomini" }) },
    { gruppo: "Sistema", icona: "info", etichetta: "Stato del sistema: apri il quadro completo", dettaglio: "Server, email, WhatsApp, notifiche, sicurezza", azione: () => tendinaStato && tendinaStato.apri() },
    { gruppo: "Sistema", icona: "aggiorna", etichetta: "Ricontrolla adesso tutti i servizi", azione: () => tendinaStato && tendinaStato.aggiorna() },
    { gruppo: "Guida", icona: "guida", etichetta: "Guida del programma", dettaglio: "Il manuale completo, con la ricerca", azione: () => naviga("guida") },
    { gruppo: "Guida", icona: "guida", etichetta: "Guida: la sezione che ho aperto adesso", azione: apriGuidaContestuale },
    ...GUIDA_RAPIDA.map(([capitolo, etichetta]) => ({
      gruppo: "Guida", icona: "guida", etichetta: `Guida: ${etichetta}`, azione: () => naviga(`guida:${capitolo}`)
    })),
    { gruppo: "Guida", icona: "scheda", etichetta: "Scorciatoie da tastiera", azione: mostraScorciatoie },
    { gruppo: "Postazione", icona: "blocca", etichetta: stato.pin && stato.pin.configurato ? "Cambia il PIN rapido di accesso" : "Imposta il PIN rapido di accesso", azione: apriConfigurazionePin },
    { gruppo: "Postazione", icona: "notifiche", etichetta: "Aggiorna le notifiche adesso", azione: () => window.studio.aggiornaNotifiche() },
    { gruppo: "Postazione", icona: "notifiche", etichetta: stato.impostazioni.nonDisturbare ? "Riattiva le notifiche di Windows" : "Silenzia le notifiche di Windows", azione: commutaSilenzio },
    { gruppo: "Postazione", icona: "tema_chiaro", etichetta: "Cambia tema", azione: ruotaTema },
    { gruppo: "Postazione", icona: "menu", etichetta: "Comprimi o riapri la barra laterale", azione: commutaLaterale },
    { gruppo: "Postazione", icona: "blocca", etichetta: "Blocca la postazione", azione: () => bloccaOra(stato.utente) },
    { gruppo: "Postazione", icona: "sveglia", etichetta: "Prendi un promemoria", dettaglio: "Avviso di Windows all'ora che scegli", azione: () => apriPromemoria() },
    { gruppo: "Postazione", icona: "piu", etichetta: "Ingrandisci l'interfaccia", azione: () => cambiaZoom(1) },
    { gruppo: "Postazione", icona: "meno", etichetta: "Rimpicciolisci l'interfaccia", azione: () => cambiaZoom(-1) },
    { gruppo: "Postazione", icona: "aggiorna", etichetta: "Riporta l'interfaccia al 100%", azione: () => cambiaZoom(0) },
    { gruppo: "Postazione", icona: "scheda", etichetta: "Chiudi tutte le schede di lavoro", azione: () => schede && schede.chiudiTutte() },
    { gruppo: "Postazione", icona: "salvagente", etichetta: "Fai adesso una copia di sicurezza", dettaglio: "Schede, allegati, promemoria e registro di questa postazione", azione: async () => {
      const esito = await window.studio.copiaCrea();
      toast(esito.ok ? "Copia di sicurezza creata." : (esito.errore || "Copia non riuscita."), esito.ok ? "ok" : "errore");
    } },
    { gruppo: "Postazione", icona: "scarica", etichetta: "Controlla se c'e una versione nuova", azione: async () => {
      await window.studio.controllaAggiornamento();
      naviga("impostazioni");
    } },
    { gruppo: "Postazione", icona: "spegni", etichetta: "Esci dall'account", azione: async () => { await window.studio.logout(); location.reload(); } }
  ];
}

// I capitoli che vengono cercati piu spesso, raggiungibili dal comando rapido
// senza passare dall'indice della guida.
const GUIDA_RAPIDA = [
  ["pin", "il PIN rapido"],
  ["stato-sistema", "lo stato del sistema"],
  ["coda", "la coda delle segnalazioni"],
  ["schede", "le schede di lavoro"],
  ["promemoria", "i promemoria"],
  ["copie", "le copie di sicurezza"],
  ["aggiornamenti", "gli aggiornamenti"],
  ["scorciatoie", "tutte le scorciatoie"],
  ["problemi", "quando qualcosa non va"],
  ["domande", "domande frequenti"]
];

/** Shift+F1: la guida aperta sul capitolo che riguarda la sezione corrente. */
function apriGuidaContestuale() {
  naviga(`guida:${capitoloPerSezione(vistaCorrente || "coda")}`);
}

/**
 * Punteggio della corrispondenza: chi digita "coda urg" deve trovare
 * "Coda: solo urgenti aperte" anche se le parole non sono attaccate.
 */
function punteggio(etichetta, query) {
  if (!query) return 1;
  const testo = etichetta.toLowerCase();
  const parole = query.split(/\s+/).filter(Boolean);
  let totale = 0;
  for (const parola of parole) {
    const dove = testo.indexOf(parola);
    if (dove < 0) return 0;
    totale += dove === 0 ? 3 : 1;
  }
  return totale;
}

function apriPalette() {
  const esistente = document.querySelector(".palette-sfondo");
  if (esistente) esistente.remove();

  const campo = el("input", { class: "palette-campo", placeholder: "Vai a… oppure cerca una pratica per numero, oggetto o richiedente" });
  const risultati = el("div", { class: "palette-risultati" });
  const sfondo = el("div", { class: "palette-sfondo" }, [
    el("div", { class: "palette" }, [
      campo, risultati,
      el("div", { class: "palette-piede" }, [
        el("span", { text: "↑↓ scorri" }), el("span", { text: "↵ apri" }), el("span", { text: "Esc chiudi" })
      ])
    ])
  ]);

  const azioni = azioniPalette();
  let voci = [];
  let indice = 0;

  function disegna() {
    svuota(risultati);
    if (!voci.length) {
      risultati.appendChild(el("div", { class: "vuoto" }, [el("p", { class: "vuoto-sotto", text: "Nessun risultato." })]));
      return;
    }
    let gruppoCorrente = null;
    voci.forEach((voce, i) => {
      if (voce.gruppo !== gruppoCorrente) {
        gruppoCorrente = voce.gruppo;
        risultati.appendChild(el("div", { class: "palette-gruppo", text: gruppoCorrente }));
      }
      const nodo = el("button", {
        class: `palette-voce ${i === indice ? "attiva" : ""}`,
        onclick: () => { chiudi(); voce.azione(); }
      }, [
        iconaMenu(voce.icona || "scheda", 16),
        el("span", { class: "testi" }, [
          el("span", { text: voce.etichetta }),
          voce.dettaglio ? el("span", { class: "sotto", text: voce.dettaglio }) : null
        ])
      ]);
      risultati.appendChild(nodo);
      if (i === indice) nodo.scrollIntoView({ block: "nearest" });
    });
  }

  function filtra(testo) {
    const q = testo.toLowerCase().trim();
    voci = azioni
      .map((azione) => ({ azione, peso: punteggio(azione.etichetta, q) }))
      .filter((v) => v.peso > 0)
      .sort((a, b) => b.peso - a.peso)
      .map((v) => v.azione)
      .slice(0, 12);
    indice = 0;
    disegna();
    if (q.length >= 2) cercaPratiche(q);
  }

  let timer = null;
  async function cercaPratiche(q) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const dati = await api.get(`/api/tickets?q=${encodeURIComponent(q)}&perPage=8&status=`);
        const trovate = (dati.tickets || []).map((t) => ({
          gruppo: "Segnalazioni",
          icona: "coda",
          etichetta: `${t.ticket_number} · ${t.subject}`,
          dettaglio: `${t.condominio_nome || "—"} · ${t.status}`,
          azione: () => naviga(`ticket:${t.id}`)
        }));
        if (!document.body.contains(sfondo)) return;
        voci = [...voci.filter((v) => v.gruppo !== "Segnalazioni"), ...trovate];
        disegna();
      } catch { /* la ricerca e un aiuto, non deve bloccare la palette */ }
    }, 200);
  }

  function chiudi() {
    clearTimeout(timer);
    sfondo.remove();
    document.removeEventListener("keydown", suTasto, true);
  }

  // Ogni tasto che il comando rapido usa va anche fermato: intercettato ma
  // lasciato correre, Invio apriva insieme il risultato scelto qui *e* la
  // pratica selezionata nella coda sotto, e le frecce muovevano due elenchi
  // alla volta.
  function suTasto(evento) {
    if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); chiudi(); }
    else if (evento.key === "ArrowDown") { evento.preventDefault(); evento.stopPropagation(); indice = Math.min(voci.length - 1, indice + 1); disegna(); }
    else if (evento.key === "ArrowUp") { evento.preventDefault(); evento.stopPropagation(); indice = Math.max(0, indice - 1); disegna(); }
    else if (evento.key === "Enter" && voci[indice]) { evento.preventDefault(); evento.stopPropagation(); chiudi(); voci[indice].azione(); }
    else if (evento.key === "Home" || evento.key === "End" || evento.key === "Tab") evento.stopPropagation();
  }

  campo.addEventListener("input", () => filtra(campo.value));
  sfondo.addEventListener("mousedown", (evento) => { if (evento.target === sfondo) chiudi(); });
  document.addEventListener("keydown", suTasto, true);

  document.body.appendChild(sfondo);
  filtra("");
  campo.focus();
}

/* =============================================================================
 * Non disturbare
 * ========================================================================== */

async function commutaSilenzio() {
  const acceso = !stato.impostazioni.nonDisturbare;
  stato.impostazioni.nonDisturbare = acceso;
  await window.studio.impostazioni({ nonDisturbare: acceso });
  aggiornaSpiaSilenzio();
  toast(acceso ? "Notifiche di Windows silenziate." : "Notifiche di Windows riattivate.", "ok");
}

function aggiornaSpiaSilenzio() {
  if (!vociStato.silenzio) return;
  const orario = stato.impostazioni.orarioLavoro || {};
  const silenzio = stato.impostazioni.nonDisturbare || orario.attivo;
  vociStato.silenzio.classList.toggle("nascosta", !silenzio);
  svuota(vociStato.silenzio).append(
    icona("notifiche", 12),
    el("span", {
      text: stato.impostazioni.nonDisturbare
        ? "Non disturbare acceso"
        : "Notifiche solo in orario di lavoro"
    })
  );
}

/* =============================================================================
 * Scorciatoie globali
 *
 * Le combinazioni non sono scritte qui: stanno in lib/scorciatoie.js insieme
 * alla loro descrizione, e questo blocco si limita a dire che cosa fa ciascun
 * identificatore. E il motivo per cui la finestra dell'aiuto non puo diventare
 * bugiarda — elenco e comportamento vengono dalla stessa tabella.
 * ========================================================================== */

function scorciatoieGlobali() {
  if (staccaScorciatoie) staccaScorciatoie();

  staccaScorciatoie = installaScorciatoie({
    // Con una modale, il comando rapido o il velo di blocco a schermo, gli
    // eventi non arrivano fin qui: quelle sovrapposizioni fermano il tasto in
    // fase di cattura. Il controllo resta come rete di sicurezza.
    attiva: () => !!stato && stato.autenticato && !document.querySelector(".blocco"),

    azioni: {
      palette: apriPalette,
      "stato-sistema": () => tendinaStato && tendinaStato.commuta(),
      guida: () => naviga("guida"),
      "guida-sezione": apriGuidaContestuale,
      "elenco-scorciatoie": mostraScorciatoie,
      impostazioni: () => naviga("impostazioni"),
      ricarica: () => naviga(vistaCorrente === "ticket" ? cronologia.voci[cronologia.cursore] : (vistaCorrente || "coda")),
      blocca: () => bloccaOra(stato.utente),
      laterale: commutaLaterale,
      tema: ruotaTema,
      silenzio: commutaSilenzio,
      "aggiorna-notifiche": async () => {
        await window.studio.aggiornaNotifiche();
        toast("Controllo delle novita richiesto.", "ok");
      },
      indietro: () => spostaCronologia(-1),
      avanti: () => spostaCronologia(1),

      promemoria: () => apriPromemoria(),
      "zoom-piu": () => cambiaZoom(1),
      "zoom-meno": () => cambiaZoom(-1),
      "zoom-zero": () => cambiaZoom(0),

      "scheda-avanti": () => schede && schede.scorri(1),
      "scheda-indietro": () => schede && schede.scorri(-1),
      // La scheda su cui si sta lavorando la conosce il nastro: la cronologia
      // e un'altra cosa e dopo un Alt+← non punta piu alla linguetta accesa.
      "scheda-chiudi": () => schede && schede.chiudi(schede.attiva)
    },

    vaiA: (idSezione) => naviga(idSezione),

    // Ctrl+1…9 segue l'ordine con cui le voci compaiono nella barra laterale,
    // che e l'unico ordine che l'utente vede.
    perNumero: (numero) => {
      const sezione = TUTTE[numero - 1];
      if (sezione) naviga(sezione.id);
    }
  });
}

/* =============================================================================
 * Avvio
 * ========================================================================== */

async function avvia() {
  stato = await window.studio.stato();
  applicaAspetto(stato.impostazioni);

  if (!stato.autenticato) {
    fermaBlocco();
    if (tendinaStato) { tendinaStato.distruggi(); tendinaStato = null; }
    schermataAccesso(radice, {
      informazioni: {
        versione: stato.versione,
        baseUrl: stato.impostazioni.baseUrl,
        ultimaEmail: stato.impostazioni.ultimaEmail
      },
      entrato: avvia
    });
    return;
  }

  costruisciGuscio();
  aggiornaSpiaSilenzio();
  mostraZoom(stato.zoom);
  sorveglia({ minuti: stato.impostazioni.bloccoMinuti, utente: stato.utente });
  await naviga(stato.impostazioni.ultimaVista || "panoramica");

  // Il PIN si propone dopo che la coda e a schermo, non prima: la prima cosa
  // che deve comparire aprendo l'app e il lavoro, non una richiesta. E si
  // propone una volta sola per account — chi rimanda lo trova poi nel menu
  // dell'account, nelle impostazioni e nel comando rapido.
  proponiPinSeServe({
    utente: stato.utente,
    statoPin: stato.pin,
    impostazioni: stato.impostazioni,
    fatto: (nuovo) => {
      stato.pin = nuovo;
      if (tendinaStato) tendinaStato.aggiorna();
    }
  });
}

/* =============================================================================
 * Aggiornamento dell'applicazione
 *
 * La nuova versione arriva da sola: qui si vede solo a che punto e, e si puo
 * chiedere il riavvio quando fa comodo. Chi non tocca niente la trova
 * installata alla prossima apertura.
 * ========================================================================== */

function mostraAggiornamento(fase) {
  if (!barraAggiornamento || !fase) return;

  const visibile = ["scaricamento", "pronta", "errore"].includes(fase.fase);
  barraAggiornamento.classList.toggle("nascosta", !visibile);
  if (!visibile) return;

  svuota(barraAggiornamento);
  barraAggiornamento.classList.toggle("guasta", fase.fase === "errore");

  if (fase.fase === "scaricamento") {
    barraAggiornamento.append(
      el("span", { text: `⬇ Sto scaricando la versione ${fase.versione || ""}… ${fase.percentuale || 0}%` })
    );
    return;
  }

  if (fase.fase === "errore") {
    barraAggiornamento.append(
      el("span", { text: `⚠ Aggiornamento non riuscito: ${fase.errore}` }),
      el("span", { class: "spazio" }),
      el("button", { class: "bottone piccolo", text: "Riprova", onclick: () => window.studio.controllaAggiornamento() })
    );
    return;
  }

  barraAggiornamento.append(
    el("span", { text: `✓ E pronta la versione ${fase.versione}. Verra installata alla chiusura dell'app.` }),
    el("span", { class: "spazio" }),
    el("button", {
      class: "bottone piccolo", text: "Riavvia e aggiorna adesso",
      onclick: () => window.studio.installaAggiornamento()
    })
  );
}

/* =============================================================================
 * Eventi dal processo principale
 * ========================================================================== */

window.studio.su("app:aggiornamento", mostraAggiornamento);

// Doppio clic sulla barra dei titoli, Snap di Windows, tasto Windows+↑: la
// finestra si ingrandisce senza passare dai nostri bottoni, e il bottone deve
// seguirla.
window.studio.su("app:finestra", ({ massimizzata }) => aggiornaBottoneFinestra(massimizzata));

// Un promemoria suonato mentre la barra laterale e a schermo: il conteggio
// accanto alla voce si aggiorna da solo, senza aspettare che qualcuno ci vada.
window.studio.su("app:promemoria", () => {
  if (stato && stato.autenticato) toast("Hai un promemoria in scadenza.", "avviso");
});

window.studio.su("app:naviga", (destinazione) => { if (stato && stato.autenticato) naviga(destinazione); });

window.studio.su("app:notifiche", ({ nonLette }) => {
  segnalaSincronia();
  for (const nodo of [badgeNotifiche, conteggioLaterale]) {
    if (!nodo) continue;
    nodo.textContent = nonLette > 99 ? "99+" : String(nonLette);
    nodo.classList.toggle("nascosta", !nonLette);
  }
});

window.studio.su("app:sessione-scaduta", () => {
  fermaBlocco();
  toast("Sessione scaduta: serve un nuovo accesso.", "avviso");
  avvia().then(() => {
    const errore = radice.querySelector(".accesso .errore");
    if (errore) errore.textContent = "La sessione e scaduta. Accedi di nuovo.";
  });
});

window.studio.su("app:scorciatoia-globale", () => { if (stato && stato.autenticato) apriPalette(); });

scorciatoieGlobali();
avvia();
