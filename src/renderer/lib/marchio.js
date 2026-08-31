/* =============================================================================
 * Marchio dello Studio
 *
 * Un solo file SVG per tutta l'applicazione (accesso, barra laterale, finestre
 * di sistema): cambiare il logo dello Studio significa sostituire
 * `assets/logo.svg`, non rincorrere venti punti dell'interfaccia.
 * ========================================================================== */

import { el } from "./ui.js";

export const NOME_STUDIO = "Studio Associato Amm. Burchielli";
export const NOME_PRODOTTO = "Win Studio Admin";

/** Solo il simbolo, alla dimensione richiesta. */
export function logo(dimensione = 32) {
  return el("img", {
    class: "logo",
    src: "assets/logo.svg",
    width: String(dimensione),
    height: String(dimensione),
    alt: NOME_STUDIO
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
