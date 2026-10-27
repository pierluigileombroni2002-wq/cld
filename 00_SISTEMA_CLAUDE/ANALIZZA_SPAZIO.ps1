# Analizza lo spazio occupato sui dischi. NON CANCELLA NIENTE: scrive solo un report sul Desktop.
# Uso: tasto destro su questo file -> "Esegui con PowerShell" (oppure: powershell -ExecutionPolicy Bypass -File ANALIZZA_SPAZIO.ps1)
# Puo' metterci diversi minuti.

$ErrorActionPreference = 'SilentlyContinue'
$progetto = Split-Path $PSScriptRoot -Parent
$report = Join-Path ([Environment]::GetFolderPath('Desktop')) 'REPORT_SPAZIO.txt'

# Da non toccare mai: setup di OmniRoute e di Claude-PowerShell
$protetti = @(
    (Join-Path $progetto '00_SISTEMA_CLAUDE'),
    "$HOME\.omniroute",
    "$HOME\.claude",
    "$HOME\.claude.json",
    "$env:APPDATA\npm",
    "$env:ProgramFiles\nodejs"
) | ForEach-Object { $_.TrimEnd('\') }

function Etichetta($p) {
    foreach ($x in $protetti) {
        if ($p -eq $x -or $p.StartsWith("$x\")) { return '[PROTETTO]   ' }
        if ($x.StartsWith("$p\")) { return '[CONTIENE PROTETTI]' }
    }
    if ($p -eq $progetto -or $p.StartsWith("$progetto\")) { return '[CANALE]     ' }
    return '             '
}
function GB($b) { '{0,8:N2} GB' -f ($b / 1GB) }

$cartelle = @{}
$grandi = New-Object System.Collections.Generic.List[object]
$saltare = @('Windows', '$Recycle.Bin', 'System Volume Information')

$dischi = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 }
foreach ($d in $dischi) {
    Write-Host "Analizzo $($d.Root) ..."
    Get-ChildItem $d.Root -Force | Where-Object { $saltare -notcontains $_.Name } | ForEach-Object {
        $voci = if ($_.PSIsContainer) { Get-ChildItem $_.FullName -Recurse -File -Force } else { $_ }
        foreach ($f in $voci) {
            if ($f.Length -ge 500MB) { $grandi.Add($f) }
            $parti = $f.FullName.Split('\')
            for ($i = 2; $i -le [Math]::Min(6, $parti.Length - 1); $i++) {
                $k = ($parti[0..($i - 1)] -join '\')
                $cartelle[$k] = $cartelle[$k] + $f.Length
            }
        }
    }
}

$out = New-Object System.Collections.Generic.List[string]
$out.Add("REPORT SPAZIO - $(Get-Date)   (nessun file e' stato cancellato)")
$out.Add('')
$out.Add('== SPAZIO LIBERO ==')
foreach ($d in $dischi) { $out.Add("$($d.Root)  libero $(GB $d.Free)  usato $(GB $d.Used)") }

$out.Add('')
$out.Add('== CARTELLE PIU'' GRANDI (per livello) ==')
for ($liv = 2; $liv -le 6; $liv++) {
    $out.Add('')
    $out.Add("-- livello $liv --")
    $cartelle.GetEnumerator() | Where-Object { $_.Key.Split('\').Length -eq $liv -and $_.Value -ge 200MB } |
        Sort-Object Value -Descending | Select-Object -First 25 |
        ForEach-Object { $out.Add("$(GB $_.Value)  $(Etichetta $_.Key)  $($_.Key)") }
}

$out.Add('')
$out.Add('== FILE SINGOLI OLTRE 500 MB ==')
$grandi | Sort-Object Length -Descending | Select-Object -First 80 |
    ForEach-Object { $out.Add("$(GB $_.Length)  $(Etichetta $_.FullName)  $($_.LastWriteTime.ToString('yyyy-MM-dd'))  $($_.FullName)") }

$out | Set-Content -Path $report -Encoding UTF8
Write-Host ''
Write-Host "Fatto. Report salvato in: $report"
Read-Host 'Premi Invio per chiudere'
