/* =============================================================================
 * Impostazioni dell'applicazione: server, ritmo degli aggiornamenti, aspetto,
 * dispositivi collegati all'account e chiusura della sessione.
 * ========================================================================== */

import { el, svuota, api, toast, dataOra, statoVuoto, caricamento, conferma } from "../lib/ui.js";

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
    svuota(statoAggiornamento).append(
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
