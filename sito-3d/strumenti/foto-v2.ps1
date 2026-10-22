# Foto del sito v2 con Chrome senza finestra (headless), pilotato via DevTools (CDP).
# Sostituisce il vecchio foto-v2.js. Serve il server locale acceso (strumenti/server.ps1).
# Uso:
#   powershell -ExecutionPolicy Bypass -File sito-3d\strumenti\foto-v2.ps1 -Out <cartella> -T 1.8,3.4,6.5,9.6
#   -Passi <file.json>   passi personalizzati: [{ "nome": "...", "js": "...", "shot": "nome.jpg", "attesa": 60000 }]
#   -Swiftshader         rendering software (lento) se la GPU non va
param(
  [string]$Url = 'http://localhost:8790/v2/?test=1&nointro=1',
  [string]$Out,
  [string]$T = '',                 # tempi separati da virgola, es. 1.8,3.4,6.5
  [string]$Passi,
  [int]$Larghezza = 1280,
  [int]$Altezza = 720,
  [int]$Porta = 9351,
  [int]$AttesaS = 120,
  [switch]$Swiftshader
)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { $chrome = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
New-Item -ItemType Directory -Force $Out | Out-Null
$prof = Join-Path $Out 'profilo'
$arg = @('--headless=new', "--remote-debugging-port=$Porta", "--user-data-dir=$prof", '--no-first-run', '--no-default-browser-check',
         "--window-size=$Larghezza,$Altezza", '--hide-scrollbars', '--ignore-gpu-blocklist', 'about:blank')
if ($Swiftshader) { $arg += @('--use-angle=swiftshader', '--enable-unsafe-swiftshader') }
$proc = Start-Process -FilePath $chrome -PassThru -ArgumentList $arg
$log = New-Object System.Collections.ArrayList
try {
  $lista = $null
  for ($i = 0; $i -lt 40 -and -not $lista; $i++) { Start-Sleep -Milliseconds 500; try { $lista = Invoke-RestMethod "http://127.0.0.1:$Porta/json/list" } catch {} }
  $pagina = @($lista | Where-Object { $_.type -eq 'page' })[0]
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$pagina.webSocketDebuggerUrl, $ct).Wait()
  $script:id = 0; $script:pend = $null
  $buf = New-Object byte[] 65536
  function Ricevi([int]$ms) {
    $acc = New-Object IO.MemoryStream
    while ($true) {
      if (-not $script:pend) { $seg = New-Object 'ArraySegment[byte]' -ArgumentList @(, $buf); $script:pend = $ws.ReceiveAsync($seg, $ct) }
      if (-not $script:pend.Wait($ms)) { return $null }
      $r = $script:pend.Result; $script:pend = $null
      $acc.Write($buf, 0, $r.Count)
      if ($r.EndOfMessage) { return [Text.Encoding]::UTF8.GetString($acc.ToArray()) }
      $ms = 30000
    }
  }
  function Evento($testo) {
    if ($testo -match '"method":"(Runtime\.consoleAPICalled|Runtime\.exceptionThrown)"') {
      $o = $testo | ConvertFrom-Json
      if ($o.method -eq 'Runtime.consoleAPICalled') { [void]$log.Add("[$($o.params.type)] " + (($o.params.args | ForEach-Object { if ($_.value -ne $null) { $_.value } else { $_.description } }) -join ' ')) }
      else { [void]$log.Add('[eccezione] ' + $o.params.exceptionDetails.exception.description + ' ' + $o.params.exceptionDetails.text) }
    }
  }
  function Chiama($metodo, $par, [int]$attesa = 60000) {
    $script:id++; $mio = $script:id
    $json = (@{ id = $mio; method = $metodo; params = $par } | ConvertTo-Json -Depth 10 -Compress)
    $b = [Text.Encoding]::UTF8.GetBytes($json); $seg = New-Object 'ArraySegment[byte]' -ArgumentList @(, $b)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $t0 = Get-Date
    while (((Get-Date) - $t0).TotalMilliseconds -lt $attesa) {
      $m = Ricevi 2000; if (-not $m) { continue }
      if ($m -match ('^\{"id":' + $mio + ',')) { return $m }
      Evento $m
    }
    throw "timeout $metodo"
  }
  function Valuta($js, [int]$attesa = 60000) {
    $o = (Chiama 'Runtime.evaluate' @{ expression = $js; awaitPromise = $true; returnByValue = $true } $attesa) | ConvertFrom-Json
    if ($o.result.exceptionDetails) { return 'ECCEZIONE: ' + $o.result.exceptionDetails.exception.description }
    return $o.result.result.value
  }
  function Foto($nome) {
    $r = Chiama 'Page.captureScreenshot' @{ format = 'jpeg'; quality = 88 }
    if ($r -match '"data":"([^"]+)"') { [IO.File]::WriteAllBytes((Join-Path $Out $nome), [Convert]::FromBase64String($Matches[1])); "foto $nome" }
  }
  [void](Chiama 'Runtime.enable' @{}); [void](Chiama 'Page.enable' @{})
  [void](Chiama 'Page.navigate' @{ url = $Url })
  $t0 = Get-Date; $pronto = $false
  while (((Get-Date) - $t0).TotalSeconds -lt $AttesaS) {
    Start-Sleep -Milliseconds 1500
    try { $v = Valuta '!!(window.__eri && window.__eri.pronto)' 20000 } catch { $v = $false }
    if ($v -eq $true) { $pronto = $true; break }
  }
  "pronto: $pronto dopo $([int]((Get-Date) - $t0).TotalSeconds) s"
  "stato: " + (Valuta "JSON.stringify({errori: __eri.errori, guasti: Object.entries(__eri.moduli()).filter(([k, v]) => v !== 'ok')})")
  foreach ($tt in ($T -split ',' | Where-Object { $_.Trim() })) {
    $tt = $tt.Trim()
    [void](Valuta "__eri.vaiT($tt).then(() => new Promise(r => setTimeout(r, 400))).then(() => 1)" 180000)
    Foto ("T" + $tt.Replace('.', '_') + '.jpg')
  }
  if ($Passi) {
    foreach ($s in (Get-Content -Raw $Passi | ConvertFrom-Json)) {
      if ($s.js) { $a = 120000; if ($s.attesa) { $a = [int]$s.attesa }; "== $($s.nome): " + (Valuta $s.js $a) }
      if ($s.shot) { Foto $s.shot }
    }
  }
  while ($m = Ricevi 500) { Evento $m }
  '--- console ---'
  $log
} finally {
  try { $ws.Dispose() } catch {}
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
