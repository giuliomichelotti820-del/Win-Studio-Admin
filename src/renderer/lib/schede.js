/* =============================================================================
 * Schede di lavoro
 *
 * Una segnalazione non si lavora mai da sola. Si apre la pratica del
 * lastrico, si va a vedere la scheda del condominio, si controlla il DURC del
 * fornitore, si torna alla pratica. Con una vista sola, ogni salto costava il
 * ritorno alla coda e la ricerca da capo — dieci volte al giorno, per anni.
 *
 * Le schede tengono aperti fino a dodici posti insieme e si ritrovano al
 * riavvio, come le finestre di un browser. Il numero non e per capriccio: oltre
 * quella soglia le linguette diventano illeggibili, e una scheda che non si
 * legge non e una scheda aperta, e disordine.
 *
 * Cosa una scheda conserva e cosa no, detto chiaro perche cambia l'uso: una
 * scheda conserva il *posto*, non lo stato della pagina. Tornandoci la vista si
 * ricarica dal server — quindi i dati sono freschi, ma un modulo lasciato a
 * meta non si ritrova. Le viste che hanno testo in lavorazione (la risposta al
 * condomino) lo dicono prima di lasciar cambiare scheda.
 * ========================================================================== */

import { el, svuota } from "./ui.js";
import { icona } from "./icone.js";

const MASSIMO = 12;

export function creaSchede({ naviga, impostazioni, salva }) {
  const nastro = el("div", { class: "nastro-schede", role: "tablist", ariaLabel: "Schede di lavoro" });
  const nodo = el("div", { class: "schede-lavoro nascosta" }, [nastro]);

  // Ogni scheda: { destinazione, etichetta, icona, fissata }
  let aperte = [];
  let attiva = null;
  let bloccoUscita = null;   // funzione che puo negare il cambio di scheda

  /* --- Persistenza -------------------------------------------------------- */

  function memorizza() {
    // La scheda di una pratica si ritrova al riavvio; le sezioni no: la barra
    // laterale le raggiunge in un clic, e riaprirle tutte come schede
    // renderebbe il nastro un secondo menu, peggio del primo.
    const daTenere = aperte
      .filter((s) => s.destinazione.includes(":"))
      .map(({ destinazione, etichetta, icona: nome }) => ({ destinazione, etichetta, icona: nome }));
    salva({ schedeAperte: daTenere });
  }

  function ripristina() {
    const salvate = [].concat(impostazioni.schedeAperte || []).slice(0, MASSIMO);
    aperte = salvate.filter((s) => s && s.destinazione);
    disegna();
    return aperte;
  }

  /* --- Registrazione ------------------------------------------------------ */

  /**
   * Chiamata dalla navigazione a ogni spostamento: se il posto e gia aperto lo
   * mette in evidenza, altrimenti gli fa una scheda. E questo il motivo per cui
   * non esiste un "apri in una scheda nuova": ogni apertura *e* una scheda, come
   * su un browser che non chiede mai il permesso.
   */
  function segna(destinazione, { etichetta, icona: nome }) {
    attiva = destinazione;
    const esistente = aperte.find((s) => s.destinazione === destinazione);
    if (esistente) {
      esistente.etichetta = etichetta || esistente.etichetta;
    } else {
      aperte.push({ destinazione, etichetta, icona: nome || "scheda" });
      // Si chiude la piu vecchia non fissata: chiudere quella su cui si sta
      // lavorando sarebbe il modo piu rapido di far odiare le schede.
      if (aperte.length > MASSIMO) {
        const vittima = aperte.findIndex((s) => !s.fissata && s.destinazione !== destinazione);
        aperte.splice(vittima >= 0 ? vittima : 0, 1);
      }
    }
    disegna();
    memorizza();
  }

  async function vaiA(destinazione) {
    if (destinazione === attiva) return;
    // La domanda sul lavoro non salvato la fa `naviga`, che e l'unica strada
    // per cambiare vista: farla anche qui significherebbe chiederla due volte
    // a chi cambia scheda, e non chiederla affatto a chi usa la barra
    // laterale, il comando rapido o Alt+←.
    naviga(destinazione);
  }

  /**
   * Si puo lasciare la vista corrente?
   *
   * Chiamata dalla navigazione prima di smontare qualunque vista. Senza
   * risposta negativa possibile, `trattieni` sarebbe una promessa che il
   * programma non mantiene.
   */
  async function puoLasciare(destinazione) {
    if (!bloccoUscita) return true;
    if (destinazione === attiva) return true;
    return !!(await bloccoUscita(destinazione));
  }

  function chiudi(destinazione) {
    const posizione = aperte.findIndex((s) => s.destinazione === destinazione);
    if (posizione < 0) return;
    aperte.splice(posizione, 1);
    disegna();
    memorizza();

    // Chiudendo la scheda in cui si sta lavorando si finisce sulla vicina di
    // destra, e se non c'e su quella di sinistra: e il gesto che tutti si
    // aspettano, e l'unico che non riporta alla schermata iniziale.
    if (destinazione !== attiva) return;
    const prossima = aperte[posizione] || aperte[posizione - 1];
    vaiA(prossima ? prossima.destinazione : "coda");
  }

  function chiudiAltre(destinazione) {
    aperte = aperte.filter((s) => s.destinazione === destinazione || s.fissata);
    disegna();
    memorizza();
  }

  function chiudiTutte() {
    aperte = aperte.filter((s) => s.fissata);
    disegna();
    memorizza();
    if (!aperte.some((s) => s.destinazione === attiva)) vaiA(aperte[0] ? aperte[0].destinazione : "coda");
  }

  /** Una scheda fissata resta anche quando si chiude tutto il resto. */
  function fissa(destinazione) {
    const scheda = aperte.find((s) => s.destinazione === destinazione);
    if (!scheda) return;
    scheda.fissata = !scheda.fissata;
    // Le fissate stanno in testa, come su ogni programma a schede.
    aperte.sort((a, b) => Number(!!b.fissata) - Number(!!a.fissata));
    disegna();
    memorizza();
  }

  /** Ctrl+Tab e Ctrl+Maiusc+Tab: giro circolare fra le schede aperte. */
  function scorri(passo) {
    if (aperte.length < 2) return;
    const posizione = aperte.findIndex((s) => s.destinazione === attiva);
    const prossima = aperte[(posizione + passo + aperte.length) % aperte.length];
    if (prossima) vaiA(prossima.destinazione);
  }

  /**
   * Una vista con del testo non salvato registra qui una domanda da fare prima
   * di lasciarla. Restituendo `false` il cambio di scheda non avviene.
   */
  function trattieni(domanda) {
    bloccoUscita = domanda;
    return () => { if (bloccoUscita === domanda) bloccoUscita = null; };
  }

  /* --- Menu del tasto destro -----------------------------------------------
   * Il tasto destro su una linguetta e il gesto che tutti provano, in ogni
   * programma a schede: senza, «chiudi le altre» e «fissa» restavano
   * raggiungibili solo da chi conosceva il doppio clic — cioe nessuno.
   * ---------------------------------------------------------------------- */

  let menuAperto = null;

  function chiudiMenu() {
    if (!menuAperto) return;
    menuAperto.remove();
    menuAperto = null;
    document.removeEventListener("mousedown", fuoriDalMenu, true);
    document.removeEventListener("keydown", tastoNelMenu, true);
  }

  function fuoriDalMenu(evento) {
    if (menuAperto && !menuAperto.contains(evento.target)) chiudiMenu();
  }

  function tastoNelMenu(evento) {
    if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); chiudiMenu(); }
  }

  function apriMenu(scheda, x, y) {
    chiudiMenu();

    const voce = (testo, azione, spenta = false) => el("button", {
      class: "voce-contestuale", text: testo, disabled: spenta,
      onclick: () => { chiudiMenu(); azione(); }
    });

    const altre = aperte.filter((s) => s.destinazione !== scheda.destinazione && !s.fissata).length;

    menuAperto = el("div", { class: "menu-contestuale", role: "menu" }, [
      voce("Apri", () => vaiA(scheda.destinazione)),
      el("div", { class: "divisore-contestuale" }),
      voce(scheda.fissata ? "Libera la scheda" : "Fissa la scheda", () => fissa(scheda.destinazione)),
      el("div", { class: "divisore-contestuale" }),
      voce("Chiudi", () => chiudi(scheda.destinazione)),
      voce(altre ? `Chiudi le altre (${altre})` : "Chiudi le altre", () => chiudiAltre(scheda.destinazione), !altre),
      voce("Chiudi tutte", chiudiTutte)
    ]);

    // Fuori schermo il menu non si legge: si aggancia al bordo. La misura si
    // puo prendere solo dopo averlo messo in pagina.
    document.body.appendChild(menuAperto);
    const misura = menuAperto.getBoundingClientRect();
    menuAperto.style.left = `${Math.max(4, Math.min(x, window.innerWidth - misura.width - 4))}px`;
    menuAperto.style.top = `${Math.max(4, Math.min(y, window.innerHeight - misura.height - 4))}px`;

    document.addEventListener("mousedown", fuoriDalMenu, true);
    document.addEventListener("keydown", tastoNelMenu, true);
    const primo = menuAperto.querySelector("button:not([disabled])");
    if (primo) primo.focus();
  }

  /* --- Disegno ------------------------------------------------------------ */

  function disegna() {
    chiudiMenu();
    svuota(nastro);
    // Con una scheda sola il nastro e solo una riga di pixel sprecata.
    nodo.classList.toggle("nascosta", aperte.length < 2);
    if (aperte.length < 2) return;

    for (const scheda of aperte) {
      const corrente = scheda.destinazione === attiva;
      const linguetta = el("div", {
        class: `scheda-lavoro ${corrente ? "attiva" : ""} ${scheda.fissata ? "fissata" : ""}`,
        role: "tab", ariaSelected: corrente ? "true" : "false",
        title: `${scheda.etichetta}${scheda.fissata ? " · fissata" : ""}`,
        // Il tasto centrale chiude, come ovunque: chi lo sa lo usa, chi non lo
        // sa non se ne accorge.
        onauxclick: (evento) => { if (evento.button === 1) { evento.preventDefault(); chiudi(scheda.destinazione); } },
        ondblclick: () => fissa(scheda.destinazione),
        oncontextmenu: (evento) => { evento.preventDefault(); apriMenu(scheda, evento.clientX, evento.clientY); }
      }, [
        el("button", {
          class: "scheda-lavoro-apri",
          onclick: () => vaiA(scheda.destinazione)
        }, [
          icona(scheda.icona || "scheda", 14),
          el("span", { class: "scheda-lavoro-testo", text: scheda.etichetta })
        ]),
        el("button", {
          class: "scheda-lavoro-chiudi",
          title: scheda.fissata ? "Scheda fissata: doppio clic sulla linguetta per liberarla" : "Chiudi la scheda (Ctrl+W)",
          ariaLabel: `Chiudi ${scheda.etichetta}`,
          onclick: (evento) => { evento.stopPropagation(); chiudi(scheda.destinazione); }
        }, [icona(scheda.fissata ? "spunta" : "chiudi", 12)])
      ]);
      nastro.append(linguetta);
      if (corrente) linguetta.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    nastro.append(
      el("span", { class: "spazio" }),
      el("button", {
        class: "icona piccola", title: "Chiudi tutte le schede tranne quelle fissate",
        ariaLabel: "Chiudi tutte le schede", onclick: chiudiTutte
      }, [icona("chiudi", 13)])
    );
  }

  return { nodo, segna, chiudi, chiudiAltre, chiudiTutte, fissa, scorri, ripristina, trattieni, puoLasciare,
    get aperte() { return aperte.slice(); },
    get attiva() { return attiva; } };
}
