/* =============================================================================
 * Icone dell'applicazione
 *
 * Un solo insieme di pittogrammi, disegnati su una griglia di 24 con tratto da
 * 1.6: le emoji che c'erano prima (🏢 💬 🔧 📓) cambiano faccia a ogni versione
 * di Windows, non si possono colorare, non si allineano fra loro e su un
 * gestionale denso si vedono per quello che sono — un ripiego.
 *
 * Le icone qui sono tracciati: seguono `currentColor`, quindi la voce di menu
 * attiva le accende in arancio e la barra laterale compressa le mostra alla
 * stessa dimensione ottica delle altre.
 *
 * Chi aggiunge una sezione aggiunge una riga a `TRACCIATI` e la chiama per
 * nome: nessun file nuovo, nessun caricamento, nessuna richiesta di rete.
 * ========================================================================== */

/* Ogni voce e un elenco di elementi SVG: ["tag", { attributi }].
 * Tratto aperto per default; `fill` esplicito solo dove serve una campitura. */
const TRACCIATI = {
  /* --- Sezioni ----------------------------------------------------------- */
  panoramica: [
    ["rect", { x: 3, y: 3, width: 7.5, height: 8, rx: 1.5 }],
    ["rect", { x: 13.5, y: 3, width: 7.5, height: 5, rx: 1.5 }],
    ["rect", { x: 3, y: 14, width: 7.5, height: 7, rx: 1.5 }],
    ["rect", { x: 13.5, y: 11, width: 7.5, height: 10, rx: 1.5 }]
  ],
  coda: [
    ["path", { d: "M3.5 6h17M3.5 12h17M3.5 18h11" }],
    ["circle", { cx: 19, cy: 18, r: 2.2 }]
  ],
  archivio: [
    ["rect", { x: 3, y: 4, width: 18, height: 4.5, rx: 1.4 }],
    ["path", { d: "M4.5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-10" }],
    ["path", { d: "M10 13h4" }]
  ],
  condomini: [
    ["path", { d: "M4 21V9.5l7-4.5 7 4.5V21" }],
    ["path", { d: "M2.5 21h19" }],
    ["path", { d: "M8.5 11.5h1.5M12.5 11.5H14M8.5 15h1.5M12.5 15H14" }],
    ["path", { d: "M9.8 21v-3.2h2.4V21" }]
  ],
  morosi: [
    ["circle", { cx: 12, cy: 12, r: 8.6 }],
    ["path", { d: "M15 8.6a4 4 0 0 0-6.4 1.2M8.6 12h5.2M8.6 14.4h4.2" }],
    ["path", { d: "M8.6 13.4a4 4 0 0 0 6.4 2" }]
  ],
  fornitori: [
    ["path", { d: "M14.6 6.2a3.8 3.8 0 0 1 5 5l-8.2 8.2a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8z" }],
    ["path", { d: "M14.6 6.2 11 9.8" }],
    ["path", { d: "m5 5 2.6 2.6" }]
  ],
  whatsapp: [
    ["path", { d: "M20.5 11.6a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.5A8.5 8.5 0 1 1 20.5 11.6z" }],
    ["path", { d: "M8.9 9.2c.3-.7.7-.8 1.2-.7.4 0 .5.4.8 1.1.2.5 0 .8-.3 1.1.6 1.2 1.5 2 2.7 2.6.3-.3.6-.6 1.1-.4.7.3 1.1.4 1.2.8 0 .5-.1.9-.8 1.2-1.6.7-5.9-2.2-5.9-5.7z", fill: "currentColor", stroke: "none" }]
  ],
  posta: [
    ["rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }],
    ["path", { d: "m3.6 6.6 7.3 5.6a1.8 1.8 0 0 0 2.2 0l7.3-5.6" }]
  ],
  notifiche: [
    ["path", { d: "M18 9a6 6 0 1 0-12 0c0 5-1.8 6.4-1.8 6.4h15.6S18 14 18 9z" }],
    ["path", { d: "M13.7 19a2 2 0 0 1-3.4 0" }]
  ],
  studio: [
    ["circle", { cx: 9.2, cy: 8.6, r: 3.4 }],
    ["path", { d: "M3 20.2a6.2 6.2 0 0 1 12.4 0" }],
    ["path", { d: "M16.2 5.6a3.4 3.4 0 0 1 0 6" }],
    ["path", { d: "M17.6 14.4a6.2 6.2 0 0 1 3.4 5.8" }]
  ],
  controllo: [
    ["path", { d: "M12 3 4.6 6v5.6c0 4.5 3 8.1 7.4 9.4 4.4-1.3 7.4-4.9 7.4-9.4V6z" }],
    ["path", { d: "m9.2 12 2 2.1 3.6-4" }]
  ],
  registro: [
    ["path", { d: "M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" }],
    ["path", { d: "M5 8h14M8.6 12h7M8.6 15.6h4.6" }]
  ],
  impostazioni: [
    ["circle", { cx: 12, cy: 12, r: 2.9 }],
    ["path", { d: "M19.3 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1.1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.5h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.5-1.1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.5h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9z" }]
  ],
  guida: [
    ["path", { d: "M4 5.2A1.6 1.6 0 0 1 5.6 3.6H9a3 3 0 0 1 3 3v13a2.4 2.4 0 0 0-2.4-2.4H5.6A1.6 1.6 0 0 1 4 15.6z" }],
    ["path", { d: "M20 5.2a1.6 1.6 0 0 0-1.6-1.6H15a3 3 0 0 0-3 3v13a2.4 2.4 0 0 1 2.4-2.4h4A1.6 1.6 0 0 0 20 15.6z" }]
  ],

  /* --- Guscio e comandi --------------------------------------------------- */
  menu: [["path", { d: "M4 7h16M4 12h16M4 17h16" }]],
  cerca: [["circle", { cx: 11, cy: 11, r: 6.4 }], ["path", { d: "m20 20-3.4-3.4" }]],
  chiudi: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
  piu: [["path", { d: "M12 5v14M5 12h14" }]],
  meno: [["path", { d: "M5 12h14" }]],
  freccia_sinistra: [["path", { d: "M19 12H5m6-6-6 6 6 6" }]],
  freccia_destra: [["path", { d: "M5 12h14m-6-6 6 6-6 6" }]],
  freccia_giu: [["path", { d: "m6 9 6 6 6-6" }]],
  aggiorna: [
    ["path", { d: "M20.4 12a8.4 8.4 0 1 1-2.5-6" }],
    ["path", { d: "M20.6 3.6v5h-5" }]
  ],
  blocca: [
    ["rect", { x: 4.6, y: 10.4, width: 14.8, height: 10, rx: 2 }],
    ["path", { d: "M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" }]
  ],
  spegni: [["path", { d: "M12 3.6v8.2" }], ["path", { d: "M17.6 6.4a7.6 7.6 0 1 1-11.2 0" }]],
  tema_scuro: [["path", { d: "M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z" }]],
  tema_chiaro: [
    ["circle", { cx: 12, cy: 12, r: 4.2 }],
    ["path", { d: "M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2M6.6 6.6 5 5M19 19l-1.6-1.6M6.6 17.4 5 19M19 5l-1.6 1.6" }]
  ],
  tema_sistema: [
    ["rect", { x: 2.8, y: 4.4, width: 18.4, height: 12.4, rx: 2 }],
    ["path", { d: "M8.4 20.4h7.2M12 16.8v3.6" }]
  ],
  stampa: [
    ["path", { d: "M7 9V3.8h10V9" }],
    ["rect", { x: 3.6, y: 9, width: 16.8, height: 7.4, rx: 1.8 }],
    ["path", { d: "M7 14.4h10v5.8H7z" }]
  ],
  scarica: [["path", { d: "M12 3.6v11.2m0 0 4-4m-4 4-4-4" }], ["path", { d: "M4.4 19.6h15.2" }]],
  sveglia: [
    ["circle", { cx: 12, cy: 13.2, r: 7.6 }],
    ["path", { d: "M12 9.4v4l2.4 1.6" }],
    ["path", { d: "M4.6 4.4 7 2.6M19.4 4.4 17 2.6" }]
  ],
  copia: [
    ["rect", { x: 8.6, y: 8.6, width: 11.8, height: 11.8, rx: 2 }],
    ["path", { d: "M15.4 5.6V5a1.4 1.4 0 0 0-1.4-1.4H5A1.4 1.4 0 0 0 3.6 5v9a1.4 1.4 0 0 0 1.4 1.4h.6" }]
  ],
  cartella: [["path", { d: "M3.6 6.4A1.8 1.8 0 0 1 5.4 4.6h3.9l2 2.6h7.3a1.8 1.8 0 0 1 1.8 1.8v8.6a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8z" }]],
  salvagente: [
    ["circle", { cx: 12, cy: 12, r: 8.6 }], ["circle", { cx: 12, cy: 12, r: 3.6 }],
    ["path", { d: "m6 6 3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" }]
  ],
  scheda: [
    ["rect", { x: 3, y: 5, width: 18, height: 14.4, rx: 2 }],
    ["path", { d: "M3 9.4h6.6V5" }]
  ],
  spunta: [["path", { d: "m5 12.6 4.6 4.6L19 6.8" }]],
  avviso: [
    ["path", { d: "M10.6 3.9 2.9 17.2a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0z" }],
    ["path", { d: "M12 9.4v4M12 16.6h.01" }]
  ],
  info: [["circle", { cx: 12, cy: 12, r: 8.6 }], ["path", { d: "M12 11.4v4.8M12 8.2h.01" }]],
  utente: [["circle", { cx: 12, cy: 8.4, r: 3.8 }], ["path", { d: "M4.8 20.4a7.2 7.2 0 0 1 14.4 0" }]],
  server: [
    ["rect", { x: 3.4, y: 4.4, width: 17.2, height: 6, rx: 1.6 }],
    ["rect", { x: 3.4, y: 13.6, width: 17.2, height: 6, rx: 1.6 }],
    ["path", { d: "M7 7.4h.01M7 16.6h.01" }]
  ],
  finestra_min: [["path", { d: "M5 12h14" }]],
  finestra_max: [["rect", { x: 5.2, y: 5.2, width: 13.6, height: 13.6, rx: 1.4 }]],
  finestra_ripristina: [
    ["rect", { x: 4.6, y: 8, width: 11.4, height: 11.4, rx: 1.4 }],
    ["path", { d: "M8 8V6.2A1.6 1.6 0 0 1 9.6 4.6h9.8A1.6 1.6 0 0 1 21 6.2V16a1.6 1.6 0 0 1-1.6 1.6H16" }]
  ]
};

const NS = "http://www.w3.org/2000/svg";

/**
 * Restituisce l'icona richiesta come nodo SVG.
 *
 * `dimensione` e in pixel CSS; il tratto non si assottiglia con essa
 * (`vector-effect`) perche a 14 px una linea da 1.6 scalata sparisce.
 */
export function icona(nome, dimensione = 18) {
  const tracciati = TRACCIATI[nome];
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(dimensione));
  svg.setAttribute("height", String(dimensione));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  // Un nome sbagliato non deve far sparire un bottone: si disegna un cerchio,
  // che a schermo si nota e in revisione si corregge.
  for (const [tag, attributi] of tracciati || [["circle", { cx: 12, cy: 12, r: 7 }]]) {
    const nodo = document.createElementNS(NS, tag);
    for (const [chiave, valore] of Object.entries(attributi)) nodo.setAttribute(chiave, String(valore));
    svg.append(nodo);
  }
  return svg;
}

/** L'icona dentro il contenitore che la barra laterale e le tendine si aspettano. */
export function iconaMenu(nome, dimensione = 17) {
  const contenitore = document.createElement("span");
  contenitore.className = "icona-menu";
  contenitore.append(icona(nome, dimensione));
  return contenitore;
}

/** Elenco dei nomi disponibili: serve alla guida per non raccontarne di falsi. */
export const NOMI_ICONE = Object.keys(TRACCIATI);
