/* =============================================================================
 * Notifiche ricevute dall'account: sono le stesse dell'area riservata, qui
 * con il salto diretto alla pratica citata.
 * ========================================================================== */

import { el, svuota, api, toast, daQuando, dataOra, statoVuoto, caricamento } from "../lib/ui.js";

export default async function monta(radice, ctx) {
  const barra = el("div", { class: "toolbar" });
  const corpo = el("div", { class: "tabella-wrap" });
  radice.append(barra, corpo);

  barra.append(
    el("button", { class: "bottone", text: "Aggiorna", onclick: carica }),
    el("button", {
      class: "bottone", text: "Segna tutte come lette",
      onclick: async () => {
        try {
          await api.post("/api/notifications/read-all", {});
          toast("Notifiche segnate come lette.", "ok");
          window.studio.aggiornaNotifiche();
          carica();
        } catch (errore) { toast(errore.message, "errore"); }
      }
    })
  );

  async function carica() {
    svuota(corpo).appendChild(caricamento());
    try {
      const elenco = await api.get("/api/notifications");
      disegna(elenco || []);
    } catch (errore) {
      svuota(corpo).appendChild(statoVuoto("Notifiche non disponibili.", errore.message));
    }
  }

  function disegna(elenco) {
    svuota(corpo);
    if (!elenco.length) {
      corpo.appendChild(statoVuoto("Nessuna notifica."));
      return;
    }
    corpo.appendChild(el("ul", { class: "elenco notifiche" }, elenco.map((n) => el("li", {
      class: n.read ? "" : "non-letta",
      onclick: async () => {
        if (!n.read) {
          try { await api.post(`/api/notifications/${n.id}/read`, {}); window.studio.aggiornaNotifiche(); } catch { /* non blocca l'apertura */ }
        }
        if (n.ticket_id) ctx.naviga(`ticket:${n.ticket_id}`);
        else carica();
      }
    }, [
      el("strong", { text: n.title }),
      el("span", { class: "testo", text: n.message }),
      el("span", { class: "sotto", title: dataOra(n.created_at), text: daQuando(n.created_at) })
    ]))));
  }

  await carica();
  return () => {};
}
