/* =============================================================================
 * Marchio dello Studio
 *
 * Il marchio e quello ufficiale — lo stesso file vettoriale del sito, non un
 * ridisegno per l'app: cambiarlo in un posto lo cambia in tutti e due.
 *
 * Tre risorse, tre usi distinti:
 *   marchio.svg          il solo simbolo, su fondo trasparente. Va bene sulle
 *                        superfici chiare, dove la "A" blu notte si legge.
 *   logo.svg             lo stesso simbolo dentro una tessera chiara. E la
 *                        forma che serve sulle superfici scure — barra
 *                        laterale, barra dei titoli — ed e anche l'icona che
 *                        Windows mostra sulla barra delle applicazioni: il
 *                        simbolo dell'app e quello dell'icona coincidono.
 *   marchio-esteso.svg   il lockup completo con ragione sociale e attivita,
 *                        per le due schermate a tutto campo (accesso, blocco).
 * ========================================================================== */

import { el } from "./ui.js";

export const NOME_STUDIO = "Studio Associato Amm. Burchielli";
export const NOME_PRODOTTO = "Win Studio Admin";
export const CLAIM_STUDIO = "Gestioni immobiliari e patrimoniali · dal 1970";

/** Solo il simbolo, nella tessera chiara, alla dimensione richiesta. */
export function logo(dimensione = 32) {
  return el("img", {
    class: "logo",
    src: "assets/logo.svg",
    width: String(dimensione),
    height: String(dimensione),
    alt: NOME_STUDIO,
    draggable: "false"
  });
}

/** Il simbolo nudo, senza tessera: per fondi gia chiari. */
export function simbolo(dimensione = 32) {
  return el("img", {
    class: "logo nudo",
    src: "assets/marchio.svg",
    width: String(dimensione),
    height: String(Math.round(dimensione)),
    alt: NOME_STUDIO,
    draggable: "false"
  });
}

/** Simbolo piu nome: la firma che compare in testa alle schermate. */
export function marchio({ dimensione = 32, sottotitolo = NOME_STUDIO, compatto = false } = {}) {
  return el("div", { class: `marchio ${compatto ? "compatto" : ""}` }, [
    logo(dimensione),
    compatto ? null : el("div", { class: "marchio-testo" }, [
      el("span", { class: "marchio-nome", text: NOME_PRODOTTO }),
      sottotitolo ? el("span", { class: "marchio-sotto", text: sottotitolo }) : null
    ])
  ]);
}

/**
 * Il lockup completo dello Studio, come sulla carta intestata.
 *
 * Si usa solo dove c'e spazio per leggerlo per intero: la schermata di accesso
 * e quella di blocco. In testata e in barra laterale resterebbe illeggibile, e
 * un marchio illeggibile e peggio di nessun marchio.
 */
export function marchioEsteso(larghezza = 232) {
  return el("img", {
    class: "marchio-esteso",
    src: "assets/marchio-esteso.svg",
    width: String(larghezza),
    alt: `${NOME_STUDIO} — ${CLAIM_STUDIO}`,
    draggable: "false"
  });
}
