; Replaces electron-builder's "app is running, close it manually" check.
; If the journal (or a leftover background process of it) is still running, end it so the install can continue.
; The journal file is written atomically, so ending the process cannot leave it half-written.
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\taskkill.exe" /f /t /im "${APP_EXECUTABLE_FILENAME}"`
  Pop $0
  Sleep 1000
!macroend
