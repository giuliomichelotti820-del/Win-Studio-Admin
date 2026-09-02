; =============================================================================
; Installer di Win Studio Admin — aggiunte allo scheletro di electron-builder
;
; L'installazione e per utente e non chiede i diritti di amministratore: sulle
; postazioni dello Studio nessuno li ha, e un installer che li chiede finisce
; con una telefonata al consulente informatico invece che con un programma
; installato.
;
; Che cosa fa questo file, oltre a quello che electron-builder fa da solo:
;
;   1. chiude l'applicazione se e aperta — compresa quella che sta solo
;      nell'area di notifica, che e il caso normale visto che l'app ci resta
;      tutto il giorno. Senza questo passaggio l'aggiornamento fallisce con un
;      "file in uso" che non spiega niente a nessuno;
;   2. offre l'avvio automatico con Windows, spento di default;
;   3. registra il collegamento `winstudio://` per aprire una pratica da un
;      link in una email;
;   4. alla disinstallazione chiede se buttare via anche i dati locali —
;      schede, allegati, promemoria, copie di sicurezza — e di default li
;      lascia stare. Chi disinstalla per reinstallare non deve perdere niente.
;
; Le stringhe sono in italiano perche l'installer parla alla stessa persona a
; cui parla il programma.
; =============================================================================

!macro customHeader
  BrandingText "Studio Associato Amm. Burchielli"
!macroend

; --- Chiusura dell'applicazione in esecuzione --------------------------------
; L'app vive nell'area di notifica: `taskkill` sul nome del processo e l'unica
; cosa che la ferma davvero, e il secondo giro con /F copre il caso in cui la
; finestra stia rispondendo a un dialogo.
!macro chiudiApplicazione
  DetailPrint "Chiudo Win Studio Admin, se e aperta…"
  nsExec::Exec 'taskkill /IM "Win Studio Admin.exe"'
  Sleep 1200
  nsExec::Exec 'taskkill /F /IM "Win Studio Admin.exe"'
  Sleep 400
!macroend

!macro customInit
  !insertmacro chiudiApplicazione
!macroend

!macro customUnInit
  !insertmacro chiudiApplicazione
!macroend

; --- Ultima pagina: due caselle ---------------------------------------------
; Definendo `customFinishPage` si sostituisce la pagina finale di
; electron-builder, compresa la sua casella "avvia l'applicazione": va
; rimessa qui, altrimenti installare e poi non vedere partire niente sembra un
; guasto. Alla sua destra si aggiunge la seconda casella, quella dell'avvio con
; Windows — chi installa il programma sulla postazione della segreteria lo
; decide adesso, non fra tre giorni.
!macro customFinishPage
  ; Casella 1: avvia adesso. E la stessa funzione del modello originale, con
  ; l'argomento `--updated` quando l'installazione e un aggiornamento.
  Function AvviaOra
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "AvviaOra"

  ; Casella 2: avvio automatico con Windows, spenta di default.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Avvia Win Studio Admin all'accesso a Windows"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "AvvioConWindows"

  Function AvvioConWindows
    ; L'avvio automatico si scrive nella chiave dell'utente corrente: coerente
    ; con un'installazione per utente, e non tocca gli altri profili del
    ; computer. L'argomento fa partire l'app nell'area di notifica invece che a
    ; tutto schermo davanti al desktop appena acceso.
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
      "WinStudioAdmin" "$\"$INSTDIR\Win Studio Admin.exe$\" --avvio-automatico"
  FunctionEnd

  !insertmacro MUI_PAGE_FINISH
!macroend

; --- Installazione -----------------------------------------------------------
!macro customInstall
  ; `winstudio://pratica/1234` apre la pratica dentro l'app. Serve ai link nelle
  ; email di servizio dello Studio: senza questa registrazione Windows non sa a
  ; chi darli e li apre nel browser, che non li capisce.
  WriteRegStr HKCU "Software\Classes\winstudio" "" "URL:Win Studio Admin"
  WriteRegStr HKCU "Software\Classes\winstudio" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\winstudio\DefaultIcon" "" "$INSTDIR\Win Studio Admin.exe,0"
  WriteRegStr HKCU "Software\Classes\winstudio\shell\open\command" "" \
    '"$INSTDIR\Win Studio Admin.exe" "%1"'

  ; Due righe per l'assistenza: quando qualcuno chiede "che versione hai?", la
  ; risposta e in Installazione applicazioni, senza aprire il programma.
  WriteRegStr HKCU "Software\Studio Associato Amm. Burchielli\Win Studio Admin" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Studio Associato Amm. Burchielli\Win Studio Admin" "Versione" "${VERSION}"
!macroend

; --- Disinstallazione --------------------------------------------------------
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WinStudioAdmin"
  DeleteRegKey HKCU "Software\Classes\winstudio"
  DeleteRegKey HKCU "Software\Studio Associato Amm. Burchielli\Win Studio Admin"

  ; La domanda si fa solo a chi sta disinstallando davvero: durante un
  ; aggiornamento il disinstallatore gira in silenzio ($UninstallSilent) e i
  ; dati non si toccano mai.
  ${ifNot} ${isUpdated}
    ${ifNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
        "Vuoi eliminare anche i dati di Win Studio Admin conservati su questo computer?$\r$\n$\r$\nSono le schede di condominio e di condomino, i file che ci sono attaccati, i promemoria, il registro della postazione e le copie di sicurezza.$\r$\n$\r$\nScegli No se stai reinstallando il programma." \
        /SD IDNO IDNO mantieniDati
        RMDir /r "$APPDATA\Win Studio Admin"
        RMDir /r "$LOCALAPPDATA\win-studio-admin-updater"
      mantieniDati:
    ${endIf}
  ${endIf}
!macroend
