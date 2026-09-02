# actualizar-productos.ps1
# Sincroniza el catalogo con la API de mipodba:
#  - Conserva los productos "manuales" (imagen no GCS) tal cual estan.
#  - Regenera los productos "mipodba" (imagen storage.googleapis.com +35%, lista siempre al final).
# Uso: powershell -ExecutionPolicy Bypass -File actualizar-productos.ps1

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$archivo = 'index.html'
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

# ---------- leer HTML actual ----------
if (-not (Test-Path -LiteralPath $archivo)) { throw "No existe: $archivo" }
$html = [System.IO.File]::ReadAllText((Resolve-Path $archivo), $utf8)

$colon = $html.IndexOf('const productos = [')
if ($colon -lt 0) { throw 'No se encontro const productos = [' }
$cierre = $html.IndexOf('];', $colon)
if ($cierre -lt 0) { throw 'No se encontro el cierre del array de productos' }

$arrayRaw = $html.Substring($colon, $cierre - $colon + 2)

# parsear bloques { ... } del array actual
$patron = '(?s)\{\s*marca:\s*"([^"]*)"\s*,\s*nombre:\s*"([^"]*)"\s*,\s*notas:\s*"((?:[^"\\]|\\.)*)"\s*,\s*inspirado:\s*"((?:[^"\\]|\\.)*)"\s*,\s*tamano:\s*"([^"]*)"\s*,\s*formato:\s*"([^"]*)"\s*,\s*precio:\s*(\d+)\s*,\s*imagen:\s*"([^"]*)"\s*\}'
$bloques = [regex]::Matches($arrayRaw, $patron)

$manualesRaw = @()
$mipodbaPrevios = 0
foreach ($b in $bloques) {
    $img = $b.Groups[8].Value
    if ($img -like ('*' + $hostApodo + '*')) { $mipodbaPrevios++ }
    else { $manualesRaw += $b.Value }
}
Write-Output ("manuales: " + $manualesRaw.Count + "   mipodba previos: " + $mipodbaPrevios)

# normalizar nombres manuales (para descartar duplicados de la API)
$nombresManuales = @()
foreach ($b in $bloques) {
    $img = $b.Groups[8].Value
    if ($img -like ('*' + $hostApodo + '*')) { continue }
    $nombresManuales += $b.Groups[2].Value
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

Write-Output ("mipodba nuevos: " + $nuevos.Count + "   excluidos: " + $excluidos.Count)

# ---------- recomponer el array ----------
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('const productos = [' + "`n")
foreach ($b in $manualesRaw) {
    $indent = "            "
    [void]$sb.Append($indent + $b + ',' + "`n")
}
foreach ($o in $nuevos) {
    [void]$sb.Append("            {`n")
    [void]$sb.Append('                marca: "' + $o.marca + '",' + "`n")
    [void]$sb.Append('                nombre: "' + $o.nombre + '",' + "`n")
    [void]$sb.Append('                notas: "' + $o.notas + '",' + "`n")
    [void]$sb.Append('                inspirado: "' + $o.inspirado + '",' + "`n")
    [void]$sb.Append('                tamano: "' + $o.tamano + '",' + "`n")
    [void]$sb.Append('                formato: "Botella Completa",' + "`n")
    [void]$sb.Append('                precio: ' + $o.precio + ',' + "`n")
    [void]$sb.Append('                imagen: "' + $o.imagen + '"' + "`n")
    [void]$sb.Append("            }," + "`n")
}
$nuevoArray = $sb.ToString().TrimEnd("`n").TrimEnd(',') + "`n        ];"

$nuevoHtml = $html.Substring(0, $colon) + $nuevoArray + $html.Substring($cierre + 2)

[System.IO.File]::WriteAllText((Resolve-Path $archivo), $nuevoHtml, $utf8)
Write-Output ("total objetos: " + ($manualesRaw.Count + $nuevos.Count))
Write-Output "OK"