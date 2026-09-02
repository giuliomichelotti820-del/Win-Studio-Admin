/* =============================================================================
 * Promemoria della postazione
 *
 * "Richiamare l'idraulico giovedi alle nove" non e uno stato della pratica: e
 * un impegno di una persona, a un'ora precisa. Prima finiva su un foglietto.
 *
 * Sono locali, e la scheda lo dice a schermo invece di lasciarlo intuire: chi
 * ci mette dentro un impegno che riguarda tutto lo Studio deve sapere che i
 * colleghi non lo vedranno. Per quello ci sono le note interne sulla pratica.
 * ========================================================================== */

import { el, svuota, toast, modale, conferma, statoVuoto, caricamento, dataOra, daQuando } from "../lib/ui.js";
import { icona } from "../lib/icone.js";

/* --- Scelta del quando ------------------------------------------------------
 * Le scorciatoie coprono nove promemoria su dieci. La data per esteso resta,
 * ma sotto, perche digitare giorno e ora per ricordarsi qualcosa fra un'ora e
 * sproporzionato. */

const SCORCIATOIE = [
  ["Fra un'ora", () => new Date(Date.now() + 3_600_000)],
  ["Stasera alle 17", () => alle(17, 0, 0)],
  ["Domani mattina alle 9", () => alle(9, 0, 1)],
  ["Dopodomani alle 9", () => alle(9, 0, 2)],
  ["Lunedi prossimo alle 9", () => prossimoLunedi()]
];

function alle(ora, minuti, fraGiorni) {
  const quando = new Date();
  quando.setDate(quando.getDate() + fraGiorni);
  quando.setHours(ora, minuti, 0, 0);
  // "Stasera alle 17" chiesto alle 17:30 vuol dire domani, non un promemoria
  // gia scaduto che suona nello stesso istante in cui lo si scrive.
  if (quando.getTime() <= Date.now()) quando.setDate(quando.getDate() + 1);
  return quando;
}

function prossimoLunedi() {
  const quando = new Date();
  quando.setDate(quando.getDate() + ((8 - quando.getDay()) % 7 || 7));
  quando.setHours(9, 0, 0, 0);
  return quando;
}

/** Il formato che <input type="datetime-local"> si aspetta, in ora locale. */
function perCampo(data) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
    + `T${p(data.getHours())}:${p(data.getMinutes())}`;
}

/**
 * La finestra di creazione, richiamabile anche dalla scheda di una pratica:
 * passando `destinazione` il promemoria ci riporta dentro con un clic.
 */
export function nuovoPromemoria({ titolo = "", destinazione = null, contesto = "", fatto = () => {} } = {}) {
  const campoTesto = el("input", { class: "campo largo", value: titolo, placeholder: "Che cosa va ricordato" });
  const campoQuando = el("input", { class: "campo largo", type: "datetime-local", value: perCampo(alle(9, 0, 1)) });
  const campoNota = el("textarea", { class: "campo largo", rows: "3", placeholder: "Nota (facoltativa)" });

  const scorciatoie = el("div", { class: "azioni" }, SCORCIATOIE.map(([etichetta, calcola]) =>
    el("button", {
      class: "bottone piccolo", text: etichetta,
      onclick: () => {
        campoQuando.value = perCampo(calcola());
        for (const altro of scorciatoie.children) altro.classList.remove("attivo");
      }
    })
  ));

  const finestra = modale({
    titolo: "Nuovo promemoria",
    larghezza: 480,
    contenuto: el("div", { class: "colonna" }, [
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Promemoria" }), campoTesto]),
      el("span", { class: "sotto", text: "Quando avvisare" }),
      scorciatoie,
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Oppure data e ora precise" }), campoQuando]),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Nota" }), campoNota]),
      contesto ? el("p", { class: "sotto", text: `Collegato a: ${contesto}` }) : null,
      el("p", { class: "accesso-nota", text: "Il promemoria resta su questo computer e avvisa solo qui: e un impegno tuo, non dello Studio. Quello che devono vedere anche i colleghi va scritto come nota interna sulla pratica." })
    ]),
    azioni: [
      { testo: "Annulla", azione: (chiudi) => chiudi() },
      {
        testo: "Prendi il promemoria", primaria: true,
        azione: async (chiudi) => {
          const esito = await window.studio.promemoriaAggiungi({
            titolo: campoTesto.value,
            quando: new Date(campoQuando.value).toISOString(),
            nota: campoNota.value,
            destinazione
          });
          if (!esito.ok) { toast(esito.errore || "Promemoria non salvato.", "errore"); return; }
          chiudi();
          toast(`Ti avviso ${daQuando(esito.dati.quando)}.`, "ok");
          fatto(esito.dati);
        }
      }
    ]
  });

  if (!campoTesto.value) campoTesto.focus();
  return finestra;
}

/* --- La sezione ----------------------------------------------------------- */

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "colonna" });
  radice.append(barra, corpo);

  let mostraFatti = false;

  barra.append(
    el("button", { class: "bottone primario", onclick: () => nuovoPromemoria({ fatto: carica }) },
      [icona("piu", 14), el("span", { text: "Nuovo promemoria" })]),
    el("button", { class: "bottone", text: "Aggiorna", onclick: carica }),
    el("span", { class: "spazio" }),
    el("div", { class: "segmenti" }, [
      el("button", { class: "attivo", text: "Da fare", onclick: (e) => commuta(e, false) }),
      el("button", { text: "Anche i fatti", onclick: (e) => commuta(e, true) })
    ])
  );

  function commuta(evento, valore) {
    mostraFatti = valore;
    for (const b of evento.currentTarget.parentElement.children) b.classList.remove("attivo");
    evento.currentTarget.classList.add("attivo");
    carica();
  }

  async function carica() {
    svuota(corpo).append(caricamento());
    const esito = await window.studio.promemoria({ utenteId: ctx.utente.id, includiFatti: mostraFatti });
    if (!esito.ok) {
      svuota(corpo).append(statoVuoto("Promemoria non leggibili.", esito.errore));
      return;
    }
    disegna(esito.dati || []);
  }

  function disegna(elenco) {
    svuota(corpo);
    if (!elenco.length) {
      corpo.append(statoVuoto(
        mostraFatti ? "Nessun promemoria." : "Niente in agenda.",
        "I promemoria presi qui avvisano con una notifica di Windows all'ora che scegli, anche a finestra chiusa."
      ));
      return;
    }

    const adesso = Date.now();
    for (const voce of elenco) {
      const scaduto = !voce.fatto && new Date(voce.quando).getTime() <= adesso;
      corpo.append(el("div", { class: `riquadro promemoria ${scaduto ? "scaduto" : ""} ${voce.fatto ? "concluso" : ""}` }, [
        el("div", { class: "promemoria-testa" }, [
          el("div", { class: "colonna" }, [
            el("strong", { text: voce.titolo }),
            el("span", { class: "sotto", text: `${dataOra(voce.quando)} · ${daQuando(voce.quando)}` })
          ]),
          el("span", { class: "spazio" }),
          scaduto ? el("span", { class: "pill pill-avviso", text: "Scaduto" }) : null,
          voce.fatto ? el("span", { class: "pill pill-stato-chiusa", text: "Fatto" }) : null
        ]),
        voce.nota ? el("p", { class: "testo", text: voce.nota }) : null,
        el("div", { class: "azioni" }, [
          voce.destinazione
            ? el("button", { class: "bottone piccolo", text: "Vai alla pratica", onclick: () => ctx.naviga(voce.destinazione) })
            : null,
          voce.fatto
            ? el("button", {
                class: "bottone piccolo", text: "Rimetti da fare",
                onclick: async () => { await window.studio.promemoriaFatto(voce.id, false); carica(); }
              })
            : el("button", {
                class: "bottone piccolo", text: "Fatto",
                onclick: async () => { await window.studio.promemoriaFatto(voce.id, true); carica(); }
              }),
          !voce.fatto ? el("button", {
            class: "bottone piccolo", text: "Rinvia di 10 minuti",
            onclick: async () => { await window.studio.promemoriaRinvia(voce.id, 10); toast("Rinviato di dieci minuti."); carica(); }
          }) : null,
          !voce.fatto ? el("button", {
            class: "bottone piccolo", text: "Rinvia a domani",
            onclick: async () => { await window.studio.promemoriaRinvia(voce.id, 24 * 60); toast("Rinviato a domani."); carica(); }
          }) : null,
          el("button", {
            class: "bottone piccolo pericolo", text: "Elimina",
            onclick: async () => {
              if (!(await conferma(`Elimino il promemoria "${voce.titolo}"?`))) return;
              await window.studio.promemoriaElimina(voce.id);
              carica();
            }
          })
        ])
      ]));
    }
  }

  // Un promemoria che suona mentre la sezione e aperta deve comparire da solo:
  // altrimenti l'avviso di Windows dice una cosa e la schermata un'altra.
  const stacca = window.studio.su("app:promemoria", carica);

  await carica();
  return () => stacca();
}
