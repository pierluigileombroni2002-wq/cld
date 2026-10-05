@echo off
title Avvio Claude Code con OmniRoute
rem Cartella del progetto = la cartella sopra a questo file (es. "Anime Edit S")
for %%I in ("%~dp0..") do set "PROGETTO=%%~fI"

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
echo Avvio Claude Code in "%PROGETTO%"...
start "Claude Code" /D "%PROGETTO%" powershell -NoExit -Command "claude"
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
