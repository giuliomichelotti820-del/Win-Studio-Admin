/* =============================================================================
 * Impostazioni dell'applicazione: server, ritmo degli aggiornamenti, aspetto,
 * dispositivi collegati all'account e chiusura della sessione.
 * ========================================================================== */

import { el, svuota, aggiungi, api, toast, dataOra, statoVuoto, caricamento, conferma, pastiglia } from "../lib/ui.js";
import { esportaJson } from "../lib/esporta.js";
import { configuraPin } from "../lib/pin.js";

export default async function monta(radice, ctx) {
  const impostazioni = ctx.impostazioni;

  const indirizzo = el("input", { class: "campo largo", value: impostazioni.baseUrl });
  const chiaveApp = el("input", { class: "campo largo", type: "password", value: impostazioni.chiaveApp || "", placeholder: "vuota: il codice via email viene sempre chiesto" });
  const ritmo = el("input", { class: "campo largo", type: "number", min: "15", max: "600", value: String(impostazioni.pollSeconds) });
  const notifiche = el("input", { type: "checkbox", checked: impostazioni.notificheDesktop });
  const minimizzato = el("input", { type: "checkbox", checked: impostazioni.avvioMinimizzato });
  const densita = el("select", { class: "campo largo" }, [
    el("option", { value: "compatta", text: "Compatta (piu righe a schermo)", selected: impostazioni.densita === "compatta" }),
    el("option", { value: "comoda", text: "Comoda", selected: impostazioni.densita !== "compatta" })
  ]);
  const tema = el("select", { class: "campo largo" }, [
    ["sistema", "Come Windows"], ["scuro", "Scuro"], ["chiaro", "Chiaro"]
  ].map(([v, t]) => el("option", { value: v, text: t, selected: impostazioni.tema === v })));

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Collegamento" }),
    el("label", { class: "campo-etichetta" }, [el("span", { text: "Indirizzo del server" }), indirizzo]),
    el("label", { class: "campo-etichetta" }, [
      el("span", { text: "Chiave dell'applicazione (accesso senza codice via email)" }), chiaveApp
    ]),
    el("p", { class: "sotto", text: "Deve coincidere con il segreto DESKTOP_APP_KEY del server. Quando coincide, da questo computer si entra con sole email e password; lasciata vuota, l'accesso chiede il codice a sei cifre come sul sito." }),
    el("label", { class: "campo-etichetta" }, [el("span", { text: "Aggiornamento notifiche (secondi)" }), ritmo]),
    el("h2", { text: "Aspetto e comportamento" }),
    el("label", { class: "campo-etichetta" }, [el("span", { text: "Densita dell'elenco" }), densita]),
    el("label", { class: "campo-etichetta" }, [el("span", { text: "Tema" }), tema]),
    el("label", { class: "campo-inline" }, [notifiche, el("span", { text: "Mostra le notifiche di Windows" })]),
    el("label", { class: "campo-inline" }, [minimizzato, el("span", { text: "All'avvio parti in area di notifica" })]),
    el("button", {
      class: "bottone primario", text: "Salva impostazioni",
      onclick: async () => {
        await window.studio.impostazioni({
          baseUrl: indirizzo.value.trim().replace(/\/+$/, ""),
          chiaveApp: chiaveApp.value.trim(),
          pollSeconds: Math.max(15, Number(ritmo.value) || 45),
          notificheDesktop: notifiche.checked,
          avvioMinimizzato: minimizzato.checked,
          densita: densita.value,
          tema: tema.value
        });
        toast("Impostazioni salvate.", "ok");
        ctx.ricarica();
      }
    })
  ]));

  /* --- Aggiornamenti ----------------------------------------------------- */

  const statoAggiornamento = el("div", { class: "colonna" }, [caricamento("Controllo…")]);

  const DESCRIZIONI = {
    controllo: "Sto cercando una versione piu recente…",
    scaricamento: "Sto scaricando la nuova versione in sottofondo.",
    pronta: "La nuova versione e pronta: viene installata alla chiusura dell'app.",
    aggiornata: "Questa e l'ultima versione pubblicata.",
    errore: "L'ultimo controllo non e riuscito.",
    sviluppo: "Avvio da sorgente: l'aggiornamento automatico vale solo sull'app installata.",
    "non-configurato": "Aggiornamento automatico non disponibile in questa installazione.",
    sconosciuto: "Nessun controllo ancora eseguito."
  };

  async function disegnaAggiornamento(dati) {
    const info = dati || (await window.studio.statoAggiornamento());
    aggiungi(svuota(statoAggiornamento),
      el("p", { text: DESCRIZIONI[info.fase] || info.fase }),
      info.versione && info.fase !== "aggiornata" ? el("p", { class: "sotto", text: `Versione trovata: ${info.versione}` }) : null,
      info.fase === "scaricamento" ? el("p", { class: "sotto", text: `${info.percentuale || 0}% scaricato` }) : null,
      info.errore ? el("p", { class: "errore", text: info.errore }) : null,
      el("div", { class: "toolbar" }, [
        el("button", {
          class: "bottone", text: "Controlla adesso",
          onclick: async () => {
            svuota(statoAggiornamento).appendChild(caricamento("Controllo…"));
            const esito = await window.studio.controllaAggiornamento();
            disegnaAggiornamento(esito.ok ? esito.dati : null);
          }
        }),
        info.fase === "pronta"
          ? el("button", { class: "bottone primario", text: "Riavvia e aggiorna", onclick: () => window.studio.installaAggiornamento() })
          : null
      ])
    );
  }

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Aggiornamenti" }),
    el("p", { class: "sotto", text: "Ogni pubblicazione sul repository dello Studio diventa una nuova versione: l'app la cerca da sola ogni ora, la scarica in sottofondo e la installa alla chiusura." }),
    statoAggiornamento
  ]));

  const staccaAggiornamento = window.studio.su("app:aggiornamento", (dati) => disegnaAggiornamento(dati));
  disegnaAggiornamento();

  /* --- Sicurezza della postazione -----------------------------------------
   * Lo Studio tratta dati di condomini, morosita e fornitori: una postazione
   * lasciata aperta nell'ufficio dove entrano amministrati e fornitori e un
   * problema concreto, non un'ipotesi.
   * ---------------------------------------------------------------------- */

  const blocco = el("select", { class: "campo largo" }, [
    ["0", "Mai (sconsigliato sulle postazioni condivise)"],
    ["5", "Dopo 5 minuti di inattivita"],
    ["15", "Dopo 15 minuti di inattivita"],
    ["30", "Dopo 30 minuti di inattivita"],
    ["60", "Dopo un'ora di inattivita"]
  ].map(([v, t]) => el("option", { value: v, text: t, selected: String(impostazioni.bloccoMinuti) === v })));

  const registroAttivo = el("input", { type: "checkbox", checked: impostazioni.registroAttivo !== false });

  /* Il PIN rapido: il riquadro si ridisegna da solo dopo ogni operazione, cosi
   * chi lo imposta vede subito che c'e e di quante cifre, senza ricaricare la
   * sezione. E la conferma che serve dopo aver digitato due volte un codice. */

  const rigaPin = el("div", { class: "pin-riepilogo" });

  async function disegnaPin() {
    const info = await window.studio.pinStato().catch(() => null);
    svuota(rigaPin);

    if (!info) {
      rigaPin.append(el("p", { class: "sotto", text: "Stato del PIN non disponibile." }));
      return;
    }

    rigaPin.append(
      el("div", { class: "pin-riepilogo-testa" }, [
        el("strong", { text: "PIN rapido di accesso" }),
        el("span", { class: "spazio" }),
        pastiglia(info.configurato ? `Attivo · ${info.lunghezza} cifre` : "Non impostato", info.configurato ? "stato-risolta" : "avviso")
      ]),
      el("p", { class: "sotto", text: info.configurato
        ? `Impostato il ${dataOra(info.creatoIl)}. Sblocca questa postazione senza ridigitare la password; vale solo qui e solo per il tuo account. Dopo ${info.tentativiMax} tentativi sbagliati si disattiva da solo.`
        : `Senza PIN ogni sblocco chiede la password completa. Il PIN e da ${info.lunghezzaMin} a ${info.lunghezzaMax} cifre, resta su questo computer e non apre nulla altrove.` }),
      info.cifratura === false
        ? el("p", { class: "sotto", text: "Windows non offre la cifratura dei dati locali: il PIN verrebbe salvato senza la protezione del profilo." })
        : null,
      el("div", { class: "griglia-bottoni" }, [
        el("button", {
          class: info.configurato ? "bottone" : "bottone primario",
          text: info.configurato ? "Cambia il PIN" : "Imposta il PIN",
          onclick: () => configuraPin({
            utente: ctx.utente,
            sostituzione: info.configurato,
            fatto: disegnaPin
          })
        }),
        info.configurato
          ? el("button", {
            class: "bottone pericolo", text: "Rimuovi il PIN",
            onclick: async () => {
              if (!await conferma("Da questo momento ogni sblocco della postazione chiedera la password completa. Rimuovere il PIN?", "Rimuovi il PIN")) return;
              const esito = await window.studio.pinRimuovi();
              toast(esito.ok ? "PIN rimosso da questa postazione." : esito.errore, esito.ok ? "ok" : "errore");
              disegnaPin();
            }
          })
          : null
      ])
    );
  }

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Sicurezza della postazione" }),
    el("label", { class: "campo-etichetta" }, [el("span", { text: "Blocca lo schermo" }), blocco]),
    el("p", { class: "sotto", text: "Allo scadere del tempo l'app si oscura e chiede di nuovo la password. La sessione con il server resta aperta: non serve un nuovo codice di verifica e non si perde il lavoro a meta. Si puo bloccare subito con Ctrl+L." }),
    el("label", { class: "campo-inline" }, [
      registroAttivo, el("span", { text: "Tieni il registro delle attivita di questa postazione" })
    ]),
    el("p", { class: "sotto", text: "Accessi riusciti e rifiutati, sblocchi, esportazioni e importazioni restano annotati in un file locale, consultabile dalla sezione Registro attivita." }),
    el("dl", { class: "dati" }, [
      el("dt", { text: "Sessione sul disco" }),
      el("dd", { text: ctx.cifratura === false ? "Solo in memoria (cifratura di Windows non disponibile)" : "Cifrata con le chiavi dell'account Windows" })
    ]),
    rigaPin,
    el("button", {
      class: "bottone primario", text: "Salva la sicurezza",
      onclick: async () => {
        await window.studio.impostazioni({
          bloccoMinuti: Number(blocco.value),
          registroAttivo: registroAttivo.checked
        });
        toast("Impostazioni di sicurezza salvate.", "ok");
        ctx.ricarica();
      }
    })
  ]));

  disegnaPin();

  /* --- Silenzio delle notifiche -------------------------------------------
   * Le notifiche di Windows che saltano su alle undici di sera sono il modo
   * piu rapido per far disinstallare un gestionale.
   * ---------------------------------------------------------------------- */

  const orario = impostazioni.orarioLavoro || {};
  const nonDisturbare = el("input", { type: "checkbox", checked: !!impostazioni.nonDisturbare });
  const orarioAttivo = el("input", { type: "checkbox", checked: !!orario.attivo });
  const oraInizio = el("input", { class: "campo", type: "time", value: orario.inizio || "08:30" });
  const oraFine = el("input", { class: "campo", type: "time", value: orario.fine || "18:30" });
  const soloFeriali = el("input", { type: "checkbox", checked: orario.feriali !== false });

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Quando avvisare" }),
    el("label", { class: "campo-inline" }, [
      nonDisturbare, el("span", { text: "Non disturbare: nessuna notifica di Windows finche resta acceso" })
    ]),
    el("label", { class: "campo-inline" }, [
      orarioAttivo, el("span", { text: "Avvisa solo durante l'orario di lavoro" })
    ]),
    el("div", { class: "griglia-campi" }, [
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Dalle" }), oraInizio]),
      el("label", { class: "campo-etichetta" }, [el("span", { text: "Alle" }), oraFine])
    ]),
    el("label", { class: "campo-inline" }, [
      soloFeriali, el("span", { text: "Silenzio il sabato e la domenica" })
    ]),
    el("p", { class: "sotto", text: "Il silenzio riguarda solo i riquadri di Windows: la coda continua ad aggiornarsi e il numero delle notifiche non lette resta visibile nell'app." }),
    el("button", {
      class: "bottone primario", text: "Salva gli avvisi",
      onclick: async () => {
        await window.studio.impostazioni({
          nonDisturbare: nonDisturbare.checked,
          orarioLavoro: {
            attivo: orarioAttivo.checked,
            inizio: oraInizio.value || "08:30",
            fine: oraFine.value || "18:30",
            feriali: soloFeriali.checked
          }
        });
        toast("Preferenze degli avvisi salvate.", "ok");
        ctx.ricarica();
      }
    })
  ]));

  /* --- Copia di sicurezza delle impostazioni ------------------------------- */

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Copia delle impostazioni" }),
    el("p", { class: "sotto", text: "Server, viste salvate della coda, aspetto, sicurezza e orari si portano su un'altra postazione senza rifare la configurazione a mano. La chiave dell'applicazione e le credenziali non vengono mai esportate." }),
    el("div", { class: "azioni" }, [
      el("button", {
        class: "bottone", text: "Esporta su file",
        onclick: async () => {
          const esito = await window.studio.esportaImpostazioni();
          if (!esito.ok) { toast(esito.errore, "errore"); return; }
          await esportaJson("impostazioni-win-studio-admin.json", esito.dati, "Esporta le impostazioni");
        }
      }),
      el("button", {
        class: "bottone", text: "Importa da file",
        onclick: async () => {
          if (!(await conferma("Le impostazioni attuali di questa postazione vengono sostituite da quelle del file. Procedere?", "Importare le impostazioni?"))) return;
          const esito = await window.studio.importaImpostazioni();
          if (!esito.ok) { toast(esito.errore, "errore"); return; }
          if (esito.dati === null) return;
          toast(`${esito.dati} impostazioni importate.`, "ok");
          ctx.ricarica();
        }
      }),
      el("button", { class: "bottone", text: "Apri la cartella dati", onclick: () => window.studio.apriCartellaDati() })
    ])
  ]));

  /* --- Diagnostica ---------------------------------------------------------
   * La prima domanda dell'assistenza e sempre la stessa: che versione hai, il
   * server risponde, dove sono i file. Qui c'e tutto, copiabile in un colpo.
   * ---------------------------------------------------------------------- */

  const pannelloDiagnostica = el("div", {}, [caricamento("Controllo il collegamento…")]);

  function rigaDiagnostica(dati) {
    const stato = !dati.raggiungibile ? "giu" : dati.latenza > 1200 ? "lenta" : "viva";
    const giudizio = !dati.raggiungibile
      ? `Non raggiungibile (${dati.dettaglioRete})`
      : dati.latenza > 1200 ? `Risposta lenta: ${dati.latenza} ms` : `Risponde in ${dati.latenza} ms`;

    return el("div", { class: "colonna" }, [
      el("p", {}, [el("span", { class: `spia ${stato}`, text: giudizio })]),
      el("dl", { class: "dati" }, [
        el("dt", { text: "Server" }), el("dd", { class: "mono", text: dati.baseUrl }),
        el("dt", { text: "Versione app" }), el("dd", { text: dati.versione }),
        el("dt", { text: "Electron / Chrome" }), el("dd", { text: `${dati.electron} / ${dati.chrome}` }),
        el("dt", { text: "Sistema" }), el("dd", { text: dati.piattaforma }),
        el("dt", { text: "Identificativo dispositivo" }), el("dd", { class: "mono", text: dati.deviceId || "—" }),
        el("dt", { text: "Cifratura sessione" }), el("dd", { text: dati.cifratura ? "Disponibile" : "Non disponibile" }),
        el("dt", { text: "Notifiche" }), el("dd", { text: dati.silenzio ? "Silenziate adesso" : "Attive" }),
        el("dt", { text: "Cartella dati" }), el("dd", { class: "mono testo-breve", title: dati.cartellaDati, text: dati.cartellaDati }),
        el("dt", { text: "Registro" }), el("dd", { class: "mono testo-breve", title: dati.registro, text: dati.registro })
      ]),
      el("div", { class: "azioni" }, [
        el("button", { class: "bottone", text: "Ricontrolla", onclick: caricaDiagnostica }),
        el("button", {
          class: "bottone", text: "Esporta il rapporto",
          onclick: () => esportaJson("diagnostica-win-studio-admin.json", dati, "Esporta la diagnostica")
        })
      ])
    ]);
  }

  async function caricaDiagnostica() {
    svuota(pannelloDiagnostica).appendChild(caricamento("Controllo il collegamento…"));
    const esito = await window.studio.diagnostica();
    svuota(pannelloDiagnostica).appendChild(esito.ok
      ? rigaDiagnostica(esito.dati)
      : statoVuoto("Diagnostica non disponibile.", esito.errore));
  }

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Diagnostica" }),
    el("p", { class: "sotto", text: "Da leggere all'assistenza quando qualcosa non va, prima di qualunque altra prova." }),
    pannelloDiagnostica
  ]));

  caricaDiagnostica();

  const dispositivi = el("div", {}, [caricamento()]);
  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Dispositivi collegati" }),
    el("p", { class: "sotto", text: "Sono le sessioni aperte sul tuo account: app desktop, telefono, browser. Revocarne una richiede un nuovo accesso su quel dispositivo." }),
    dispositivi
  ]));

  async function caricaDispositivi() {
    try {
      const elenco = await api.get("/api/auth/devices");
      const righe = elenco.devices || elenco || [];
      svuota(dispositivi).appendChild(righe.length
        ? el("table", { class: "tabella densa" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Dispositivo" }), el("th", { text: "Tipo" }),
              el("th", { text: "Ultimo utilizzo" }), el("th", { text: "Scadenza" }), el("th", { text: "" })
            ])]),
            el("tbody", {}, righe.map((d) => el("tr", {}, [
              el("td", { text: d.device_name || d.deviceName || "Browser" }),
              el("td", { text: d.client || "web" }),
              el("td", { text: dataOra(d.last_seen_at || d.lastSeenAt) }),
              el("td", { text: dataOra(d.expires_at || d.expiresAt) }),
              el("td", {}, [
                d.id ? el("button", {
                  class: "bottone piccolo pericolo", text: "Revoca",
                  onclick: async () => {
                    if (!(await conferma("Revocare questo dispositivo?"))) return;
                    try {
                      await api.del(`/api/auth/devices/${d.id}`);
                      toast("Dispositivo revocato.", "ok");
                      caricaDispositivi();
                    } catch (errore) { toast(errore.message, "errore"); }
                  }
                }) : null
              ])
            ])))
          ])
        : statoVuoto("Nessun dispositivo elencato."));
    } catch (errore) {
      svuota(dispositivi).appendChild(statoVuoto("Elenco non disponibile.", errore.message));
    }
  }

  radice.appendChild(el("section", { class: "riquadro stretto" }, [
    el("h2", { text: "Account" }),
    el("dl", { class: "dati" }, [
      el("dt", { text: "Nome" }), el("dd", { text: ctx.utente.fullName }),
      el("dt", { text: "Email" }), el("dd", { text: ctx.utente.email }),
      el("dt", { text: "Ruolo" }), el("dd", { text: ctx.utente.role === "super_admin" ? "Titolare" : "Dipendente" }),
      el("dt", { text: "Versione app" }), el("dd", { text: ctx.versione })
    ]),
    el("button", {
      class: "bottone pericolo", text: "Esci dall'account",
      onclick: async () => {
        if (!(await conferma("Uscire dall'account su questo computer?"))) return;
        await window.studio.logout();
        location.reload();
      }
    })
  ]));

  await caricaDispositivi();
  return () => staccaAggiornamento();
}
