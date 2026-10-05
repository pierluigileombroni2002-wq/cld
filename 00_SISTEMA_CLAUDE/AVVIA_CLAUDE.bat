@echo off
title Avvio Claude Code con OmniRoute
rem Cartella del progetto = la cartella sopra a questo file (AnimeEdits)
for %%I in ("%~dp0..") do set "PROGETTO=%%~fI"

rem Impostazioni per usare i modelli gratuiti tramite OmniRoute (valgono solo per questa finestra)
set "ANTHROPIC_BASE_URL=http://127.0.0.1:20128"
set "ANTHROPIC_MODEL=free-coding"
set "ANTHROPIC_DEFAULT_OPUS_MODEL=free-coding"
set "ANTHROPIC_DEFAULT_SONNET_MODEL=free-coding"
set "ANTHROPIC_DEFAULT_HAIKU_MODEL=free-coding"
if defined OMNIROUTE_TOKEN set "ANTHROPIC_AUTH_TOKEN=%OMNIROUTE_TOKEN%"
if not defined ANTHROPIC_AUTH_TOKEN set "ANTHROPIC_AUTH_TOKEN=omniroute-locale"

rem 1) OmniRoute e' gia' acceso? Allora salta direttamente a Claude Code
call :controlla_porta
if not errorlevel 1 goto avvia_claude

echo Avvio OmniRoute in una nuova finestra...
start "OmniRoute" powershell -NoExit -Command "omniroute"

echo Attendo che OmniRoute sia pronto (massimo 2 minuti)...
set /a ATTESA=0
:attendi
timeout /t 2 /nobreak >nul
set /a ATTESA+=2
call :controlla_porta
if not errorlevel 1 goto pronto
if %ATTESA% GEQ 120 goto errore
goto attendi

:pronto
rem Qualche secondo in piu' per lasciarlo finire di caricare
timeout /t 3 /nobreak >nul

:avvia_claude
echo Avvio Claude Code (Claude-PowerShell) in "%PROGETTO%"...
start "Claude-PowerShell" /D "%PROGETTO%" powershell -NoExit -Command "claude --append-system-prompt 'Sei la sessione Claude-PowerShell del progetto AnimeEdits (vedi COLLABORAZIONE.md).'"
exit /b 0

:errore
echo.
echo OmniRoute non risponde dopo 2 minuti.
echo Controlla la finestra "OmniRoute" per vedere l'errore.
pause
exit /b 1

:controlla_porta
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 20128); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%
