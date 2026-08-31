/* =============================================================================
 * Elenco delle scorciatoie (F1)
 *
 * Un gestionale da tastiera ha senso solo se le combinazioni si imparano: la
 * finestra e la stessa che si apre dalla barra di stato, cosi nessuno deve
 * chiedere al collega "come si assegna a me".
 * ========================================================================== */

import { el, modale } from "./ui.js";

const GRUPPI = [
  ["Ovunque nell'applicazione", [
    ["Ctrl + K", "Comando rapido: sezioni, azioni e ricerca pratiche"],
    ["Ctrl + 1 … 9", "Vai direttamente alla sezione"],
    ["Ctrl + B", "Comprimi o riapri la barra laterale"],
    ["Ctrl + L", "Blocca subito la postazione"],
    ["Ctrl + Alt + S", "Richiama l'app da qualunque programma di Windows"],
    ["F5", "Ricarica la sezione aperta"],
    ["F1", "Questo elenco"],
    ["Esc", "Chiudi finestra, comando rapido o selezione"]
  ]],
  ["Coda delle segnalazioni", [
    ["j / k", "Riga successiva o precedente (anche con le frecce)"],
    ["Invio", "Apri la segnalazione"],
    ["Spazio", "Seleziona o deseleziona la riga"],
    ["1 … 6", "Cambia stato senza aprire la scheda"],
    ["A", "Assegna a te"],
    ["U", "Togli l'assegnazione"],
    ["R", "Ricarica la coda"],
    ["/", "Vai al campo di ricerca"],
    ["Home / Fine", "Prima o ultima riga"]
  ]]
];

export function mostraScorciatoie() {
  modale({
    titolo: "Scorciatoie da tastiera",
    larghezza: 720,
    contenuto: el("div", {}, GRUPPI.map(([titolo, righe]) => el("section", {}, [
      el("h2", { text: titolo }),
      el("div", { class: "scorciatoie" }, righe.map(([tasto, descrizione]) => el("div", { class: "riga-tasto" }, [
        el("kbd", { text: tasto }),
        el("span", { class: "sotto", text: descrizione })
      ])))
    ]))),
    azioni: [{ testo: "Chiudi", primaria: true, azione: (chiudi) => chiudi() }]
  });
}
