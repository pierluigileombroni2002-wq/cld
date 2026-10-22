# Server locale minimo per provare il sito (sostituisce "python -m http.server").
# Uso:  powershell -ExecutionPolicy Bypass -File sito-3d\strumenti\server.ps1 [-Porta 8790]
# Poi aprire http://localhost:8790/v2/
param([int]$Porta = 8790)

$radice = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tipi = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'
  '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'
  '.jpg'='image/jpeg'; '.webp'='image/webp'; '.hdr'='application/octet-stream'; '.glb'='model/gltf-binary'
  '.woff2'='font/woff2'; '.ttf'='font/ttf'; '.md'='text/plain; charset=utf-8'; '.txt'='text/plain; charset=utf-8'
}

$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Porta/")
$l.Start()
Write-Host "Server attivo: http://localhost:$Porta/  (cartella $radice)  - Ctrl+C per fermare"

while ($l.IsListening) {
  $c = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  $file = Join-Path $radice $rel
  if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
  $r = $c.Response
  $r.Headers.Add('Cache-Control', 'no-store')
  $dentro = ([IO.Path]::GetFullPath($file)).StartsWith($radice)
  if ($dentro -and (Test-Path $file -PathType Leaf)) {
    $est = [IO.Path]::GetExtension($file).ToLower()
    $r.ContentType = if ($tipi.ContainsKey($est)) { $tipi[$est] } else { 'application/octet-stream' }
    $byte = [IO.File]::ReadAllBytes($file)
    $r.ContentLength64 = $byte.Length
    try { $r.OutputStream.Write($byte, 0, $byte.Length) } catch {}
  } else {
    $r.StatusCode = 404
  }
  $r.Close()
}
