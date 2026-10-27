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

# File di Windows: si riducono dalle impostazioni, mai cancellandoli a mano
$fileSistema = @('pagefile.sys', 'hiberfil.sys', 'swapfile.sys')

function Dentro($p, $cartella) {
    $p.Equals($cartella, 'OrdinalIgnoreCase') -or $p.StartsWith("$cartella\", 'OrdinalIgnoreCase')
}
function Etichetta($p) {
    if ($fileSistema -contains (Split-Path $p -Leaf)) { return '[SISTEMA]    ' }
    foreach ($x in $protetti) { if (Dentro $p $x) { return '[PROTETTO]   ' } }
    foreach ($x in $protetti) { if (Dentro $x $p) { return '[CONTIENE PROTETTI]' } }
    if (Dentro $p $progetto) { return '[CANALE]     ' }
    return '             '
}
function GB($b) { '{0,8:N2} GB' -f ($b / 1GB) }

$cartelle = @{}
$grandi = New-Object System.Collections.Generic.List[object]
$dischi = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq 'Fixed' -and $_.IsReady }

foreach ($d in $dischi) {
    Write-Host "Analizzo $($d.Name) ..."
    # La cartella Windows si salta: non c'e' niente da cancellare a mano
    Get-ChildItem $d.Name -Force | Where-Object { $_.Name -ne 'Windows' } | ForEach-Object {
        if ($_.PSIsContainer) { Get-ChildItem $_.FullName -Recurse -File -Force } else { $_ }
    } | ForEach-Object {
        if ($_.Length -ge 500MB) { $grandi.Add($_) }
        $parti = $_.FullName.Split('\')
        for ($i = 2; $i -le [Math]::Min(6, $parti.Length - 1); $i++) {
            $k = ($parti[0..($i - 1)] -join '\')
            $cartelle[$k] = $cartelle[$k] + $_.Length
        }
    }
}

$out = New-Object System.Collections.Generic.List[string]
$out.Add("REPORT SPAZIO - $(Get-Date)   (nessun file e' stato cancellato)")
$out.Add("Progetto: $progetto")
$out.Add('')
$out.Add('== SPAZIO LIBERO ==')
foreach ($d in $dischi) { $out.Add("$($d.Name)  libero $(GB $d.AvailableFreeSpace)  totale $(GB $d.TotalSize)") }

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
