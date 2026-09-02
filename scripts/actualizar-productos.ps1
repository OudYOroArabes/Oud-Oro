# actualizar-productos.ps1
# Sincroniza el catalogo con la API de mipodba:
#  - Conserva los productos "manuales" (imagen no GCS) tal cual estan.
#  - Regenera los productos "mipodba" (imagen storage.googleapis.com +35%, lista siempre al final).
# Escribe el resultado en data/productos.json
# Uso: powershell -ExecutionPolicy Bypass -File actualizar-productos.ps1

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$dataDir = Join-Path $PSScriptRoot '..\data'
$archivo = Join-Path $dataDir 'productos.json'
$apiUrl = 'https://mipodba.jarbas.net/api/products?limit=300'
$hostApodo = 'storage.googleapis.com'

function Norm([string]$t) {
    $t = [System.Text.RegularExpressions.Regex]::Replace($t, '<.*?>', '')
    $t = $t.ToLowerInvariant()
    $t = $t -replace '[áàäâ]', 'a' -replace '[éèëê]', 'e' -replace '[íìïî]', 'i' -replace '[óòöô]', 'o' -replace '[úùüû]', 'u' -replace 'ñ', 'n'
    $t = $t -replace '[^a-z0-9]', ''
    return $t
}

function Limpiar([string]$t) {
    if (-not $t) { return '' }
    $t = $t -replace '["\\`]', ''
    $t = $t -replace '\s+', ' '
    return $t.Trim()
}

function Titulo([string]$t) {
    if (-not $t) { return '' }
    $t = $t.Trim()
    if ($t.Length -eq 0) { return '' }
    $palabras = $t -split ' '
    $partes = @()
    foreach ($w in $palabras) {
        if ($w.Length -eq 0) { continue }
        $minus = $w.ToLowerInvariant()
        $u = $minus.Substring(0,1).ToUpperInvariant()
        $resto = if ($minus.Length -gt 1) { $minus.Substring(1) } else { '' }
        $partes += ($u + $resto)
    }
    return ($partes -join ' ')
}

$marcas = @{
    'AFNAN'                 = 'Afnan'
    'AL HARAMAIN'           = 'Al Haramain'
    'AL WATANIAH'           = 'Al Wataniah'
    'ARMAF'                 = 'Armaf'
    'ASTEN'                 = 'Asten'
    'BHARARA'               = 'Bharara'
    'DARK'                  = 'Maison Alhambra'
    'DUMONT'                = 'Dumont'
    'EMPER'                 = 'Emper'
    'FRAGRANCE WORLD'       = 'Fragrance World'
    'FRENCH AVENUE'         = 'French Avenue'
    'GAME OF SPADES'        = 'Game of Spades'
    'GULF ORCHID'           = 'Gulf Orchid'
    'KHADLAJ'               = 'Khadlaj'
    'LATTAFA'               = 'Lattafa'
    'LE BONHEUR'            = 'Le Bonheur'
    'MAISON ALHAMBRA'       = 'Maison Alhambra'
    'MAISON ASRAR'          = 'Maison Asrar'
    'ODYSSEY'               = 'Armaf'
    'PARIS CORNER'          = 'Paris Corner'
    'PENDORA SCENTS MILANO' = 'Pendora'
    'QAED'                  = 'Lattafa'
    'RASASI'                = 'Rasasi'
    'RAYHAAN'               = 'Rayhaan'
    'ZIMAYA'                = 'Zimaya'
}

$forzarNombre = @{ 'QAED AL FURSAN UNLIMITED' = 'Qaed Al Fursan Unlimited' }

$excluir = @(
    'ARMAF ODYSSEY MANDARIN SKY',
    'EMPER DONNA INTNESE BY STALLION 53'
)
$forzarInclude = @(
    'ARMAF ODYSSEY MANDARIN SKY VINTAGE',
    'ODYSSEY MANDARIN SKY ELIXIR'
)

# ---------- leer JSON actual ----------
if (-not (Test-Path -LiteralPath $archivo)) { throw "No existe: $archivo" }
$jsonRaw = [System.IO.File]::ReadAllText((Resolve-Path $archivo), $utf8)
$productos = $jsonRaw | ConvertFrom-Json

$manuales = @()
$mipodbaPrevios = 0
foreach ($p in $productos) {
    if ($p.imagen -like ('*' + $hostApodo + '*')) { $mipodbaPrevios++ }
    else { $manuales += $p }
}

# normalizar nombres manuales (para descartar duplicados de la API)
$nombresManuales = @()
foreach ($p in $productos) {
    if ($p.imagen -like ('*' + $hostApodo + '*')) { continue }
    $nombresManuales += $p.nombre
}

# ---------- descargar API ----------
$r = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 60
$j = $r.Content | ConvertFrom-Json

$conNombreNormalizado = @{}
foreach ($m0 in $nombresManuales) { $conNombreNormalizado[(Norm $m0)] = $true }

$nuevos = @()
$excluidos = @()

foreach ($p in $j.products) {
    $name = ([string]$p.name).Trim()
    if ($name -match '^ZZ|^KIT |DECANTS 10ML|VAPE|ELFBAR|30ML') { continue }
    if (-not $p.images -or @($p.images).Count -eq 0) { continue }
    if (-not $p.salePrice -or $p.salePrice -le 0) { continue }

    $nn = Norm $name
    $dupe = $false
    if ($forzarInclude -contains $name) { $dupe = $false }
    elseif ($excluir -contains $name) { $excluidos += $name; continue }
    else {
        foreach ($c in $nombresManuales) {
            $cn = Norm $c
            if ($nn -eq $cn -or $nn.Contains($cn) -or $cn.Contains($nn)) { $dupe = $true; break }
        }
        if (-not $dupe -and $conNombreNormalizado.ContainsKey($nn)) { $dupe = $true }
    }
    if ($dupe) { $excluidos += $name; continue }
    $conNombreNormalizado[$nn] = $true

    $marca = ''
    $resto = $name
    foreach ($k in $marcas.Keys) {
        if ($name -match ('^' + [regex]::Escape($k))) {
            $marca = $marcas[$k]
            $resto = $name.Substring($k.Length).Trim()
            break
        }
    }
    if (-not $marca) {
        $primera = ($name -split ' ')[0]
        $marca = Titulo $primera
        $resto = $name.Substring($primera.Length).Trim()
    }

    $tamano = '100ml'
    if ($name -match '(\d{2,3})\s*ML') { $tamano = $matches[1] + 'ml' }
    $nombre = $resto -replace '\s*\d{2,3}\s*ML\s*$', ''
    if ($forzarNombre.ContainsKey($name)) { $nombre = $forzarNombre[$name] }
    else { $nombre = Titulo ($nombre -replace '\s*EDP\s*$', '') }

    $desc = [System.Text.RegularExpressions.Regex]::Replace([string]$p.description, '<[^>]+>', ' ')
    $desc = $desc -replace '\s+', ' '
    $salida = ''; $corazon = ''; $fondo = ''
    if ($desc -match 'Notas de Salida son\s+(.*?)(?:;|\.)') { $salida = Limpiar $matches[1] }
    if ($desc -match 'Notas de Coraz.n son\s+(.*?)(?:;|\.)') { $corazon = Limpiar $matches[1] }
    if ($desc -match 'Notas de Fondo son\s+(.*?)(?:;|\.)') { $fondo = Limpiar $matches[1] }
    $piezas = @($salida, $corazon, $fondo) | Where-Object { $_ } | ForEach-Object { Limpiar ($_ -replace '^(y |la |las )', '') }
    $notasStr = $piezas -join ', '
    if (-not $notasStr) { $notasStr = $name }

    $inspirado = ''
    if ($desc -match 'INSPIRADO EN:\s*(.*)') {
        $inspirado = Limpiar $matches[1]
        $inspirado = $inspirado -replace ' para (Hombres|Mujeres)$', ''
        $inspirado = $inspirado -replace '[“”"]+', ''
    }
    if (-not $inspirado) { $inspirado = 'Creación original' }

    $base = [double]$p.salePrice
    $precio = [int]([Math]::Round($base * 1.35 / 500.0, [System.MidpointRounding]::AwayFromZero) * 500)

    $imgs = @($p.images)
    $ruta = [string]$imgs[0]
    $img = 'https://storage.googleapis.com/jarbas-b5be5.appspot.com/' + $ruta

    $nuevos += [pscustomobject]@{
        marca = $marca; nombre = $nombre; notas = $notasStr; inspirado = $inspirado
        tamano = $tamano; precio = $precio; imagen = $img; apiName = $name
    }
}

Write-Output ("manuales: " + $manuales.Count + "   mipodba nuevos: " + $nuevos.Count + "   excluidos: " + $excluidos.Count)

# ---------- recomponer JSON (manuales primero, mipodba al final) ----------
$final = @()
foreach ($m in $manuales) {
    $final += [pscustomobject]@{
        marca = $m.marca; nombre = $m.nombre; notas = $m.notas; inspirado = $m.inspirado
        tamano = $m.tamano; formato = $m.formato; precio = $m.precio; imagen = $m.imagen
    }
}
foreach ($o in $nuevos) {
    $final += [pscustomobject]@{
        marca = $o.marca; nombre = $o.nombre; notas = $o.notas; inspirado = $o.inspirado
        tamano = $o.tamano; formato = 'Botella Completa'; precio = $o.precio; imagen = $o.imagen
    }
}

$jsonOut = $final | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Resolve-Path $archivo), $jsonOut, $utf8)
Write-Output ("total objetos: " + $final.Count)
Write-Output "OK"
