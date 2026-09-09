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
$prefix = 'https://storage.googleapis.com/jarbas-b5be5.appspot.com/'

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

# reparador de bytes: interpreta bytes sueltos Latin-1 (0xC0-0xFF sin continuacion UTF-8) como caracter
function Reparar-MiPodBytes([byte[]]$buf) {
    $sb = New-Object System.Text.StringBuilder
    $len = $buf.Length
    $i = 0
    while ($i -lt $len) {
        $b = $buf[$i]
        if ($b -ge 0xC0 -and $b -le 0xDF -and $i + 1 -lt $len -and (($buf[$i + 1] -band 0xC0) -eq 0x80)) {
            $cp = (($b -band 0x1F) -shl 6) -bor ($buf[$i + 1] -band 0x3F)
            [void]$sb.Append([char]$cp); $i += 2; continue
        }
        if ($b -ge 0xE0 -and $b -le 0xEF -and $i + 2 -lt $len -and (($buf[$i + 1] -band 0xC0) -eq 0x80) -and (($buf[$i + 2] -band 0xC0) -eq 0x80)) {
            $cp = (($b -band 0x0F) -shl 12) -bor (($buf[$i + 1] -band 0x3F) -shl 6) -bor ($buf[$i + 2] -band 0x3F)
            [void]$sb.Append([char]$cp); $i += 3; continue
        }
        if ($b -ge 0xF0 -and $b -le 0xF7 -and $i + 3 -lt $len -and (($buf[$i + 1] -band 0xC0) -eq 0x80) -and (($buf[$i + 2] -band 0xC0) -eq 0x80)) {
            $cp = ((($b -band 0x07) -shl 18) -bor (($buf[$i + 1] -band 0x3F) -shl 12) -bor (($buf[$i + 2] -band 0x3F) -shl 6) -bor ($buf[$i + 3] -band 0x3F)) - 0x10000
            [void]$sb.Append([char](0xD800 + [int]($cp / 0x400)))
            [void]$sb.Append([char](0xDC00 + ($cp % 0x400)))
            $i += 4; continue
        }
        [void]$sb.Append([char]$b)
        $i += 1
    }
    return $sb.ToString()
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
    'EMPER DONNA INTNESE BY STALLION 53'
)
$forzarInclude = @(
    'ARMAF ODYSSEY MANDARIN SKY VINTAGE',
    'ODYSSEY MANDARIN SKY ELIXIR'
)

# ---------- leer JSON actual ----------
if (-not (Test-Path -LiteralPath $archivo)) { throw "No existe: $archivo" }
$bytesActual = [System.IO.File]::ReadAllBytes((Resolve-Path $archivo))
$jsonRaw = Reparar-MiPodBytes $bytesActual
$productos = $jsonRaw | ConvertFrom-Json

$manuales = @()
$mipodbaPrev = @()
foreach ($p in $productos) {
    if ($p.imagen -like ('*' + $hostApodo + '*')) { $mipodbaPrev += $p }
    else { $manuales += $p }
}

# normalizar nombres manuales (para descartar duplicados de la API)
$nombresManuales = @()
foreach ($p in $productos) {
    if ($p.imagen -like ('*' + $hostApodo + '*')) { continue }
    $nombresManuales += $p.nombre
}

# ---------- descargar API (una llamada trae todos) ----------
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls
$req = [System.Net.HttpWebRequest]::Create($apiUrl)
$req.Timeout = 60000
$resp = $req.GetResponse()
$stream = $resp.GetResponseStream()
$ms = New-Object System.IO.MemoryStream
$respBytes = New-Object byte[] 65536
while (($leidos = $stream.Read($respBytes, 0, $respBytes.Length)) -gt 0) { $ms.Write($respBytes, 0, $leidos) }
$stream.Dispose()
$resp.Close()
$contenido = Reparar-MiPodBytes $ms.ToArray()
$j = $contenido | ConvertFrom-Json
$listaApi = @($j.products)

# generador de objeto de catalogo desde un producto API
$script:bloqueGenerar = {
    param($p)
    $name = ([string]$p.name).Trim()
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
    $nombre = ($resto -replace '\s*\d{2,3}\s*ML\s*$', '') -replace '\s*EDP\s*$', ''
    if ($forzarNombre.ContainsKey($name)) { $nombre = $forzarNombre[$name] }
    else { $nombre = Titulo $nombre }

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

    return [pscustomobject]@{
        marca = $marca; nombre = $nombre; notas = $notasStr; inspirado = $inspirado
        tamano = $tamano; precio = $precio; imagen = $img; apiName = $name
    }
}

$nuevos = @()
$agregadosNorm = @{}
foreach ($m0 in $nombresManuales) { $agregadosNorm[(Norm $m0)] = $true }

$dropeados = @()

# indice de la API por nombre de catalogo normalizado (maneja aliases de marca, tamano y EDP)
$apiPorGenNorm = @{}
foreach ($p in $listaApi) {
    $name = ([string]$p.name).Trim()
    if ($name -match '^ZZ|^KIT |DECANTS 10ML|VAPE|ELFBAR|30ML') { continue }
    $g = & $script:bloqueGenerar $p
    $gn = Norm $g.nombre
    if (-not $apiPorGenNorm.ContainsKey($gn)) { $apiPorGenNorm[$gn] = $p }
}

# indice por imagen exacta (todas las imagenes del producto)
$apiPorImg = @{}
foreach ($p in $listaApi) {
    foreach ($im in @($p.images)) {
        $camino = [string]$im
        if (-not $apiPorImg.ContainsKey($camino)) { $apiPorImg[$camino] = $p }
    }
}

# 1) conserva el orden previo; refresca los que siguen en la API y descarta los que ya no estan
#    clave primaria: imagen exacta (estable aun si MiPod renombra o corrompe el nombre);
#    clave secundaria: nombre normalizado.
$usadosPasada1 = @{}
foreach ($viejo in $mipodbaPrev) {
    $caminoViejo = ''
    if ($viejo.imagen -like ($prefix + '*')) { $caminoViejo = $viejo.imagen.Substring($prefix.Length) }
    $gn = Norm $viejo.nombre

    $api = $null
    if ($caminoViejo -and $apiPorImg.ContainsKey($caminoViejo)) { $api = $apiPorImg[$caminoViejo] }
    elseif ($apiPorGenNorm.ContainsKey($gn)) { $api = $apiPorGenNorm[$gn] }

    if (-not $api) {
        $dropeados += ($viejo.marca + ' ' + $viejo.nombre)
        continue
    }

    # consumir el producto API de ambos indices
    foreach ($im in @($api.images)) { $apiPorImg.Remove([string]$im) }
    $genNombre = (& $script:bloqueGenerar $api).nombre
    $apiPorGenNorm.Remove((Norm $genNombre))

    if ($api.images -and @($api.images).Count -gt 0 -and $api.salePrice) {
        $o = & $script:bloqueGenerar $api
        $o.marca = $viejo.marca
        $o.nombre = $viejo.nombre
        $nuevos += $o
    } else {
        $nuevos += $viejo
    }
    $usadosPasada1[(Norm $viejo.nombre)] = $true
    $usadosPasada1[(Norm $genNombre)] = $true
    $agregadosNorm[(Norm $viejo.nombre)] = $true
}

# 2) agrega al final los productos nuevos de la API (los que no estaban antes)
$excluidosAntes = @()
foreach ($p in $listaApi) {
    $name = ([string]$p.name).Trim()
    if ($name -match '^ZZ|^KIT |DECANTS 10ML|VAPE|ELFBAR|30ML') { continue }

    $g = & $script:bloqueGenerar $p
    $gn = Norm $g.nombre
    if ($usadosPasada1.ContainsKey($gn)) { continue }

    if (-not $p.images -or @($p.images).Count -eq 0) { continue }
    if (-not $p.salePrice -or $p.salePrice -le 0) { continue }
    if ($excluir -contains $name) { $excluidosAntes += $name; continue }

    $nn = Norm $name
    $nnCore = $nn -replace '(\d+ml|edp)$', ''
    $tokApi = ($name -split ' ')[0].ToLowerInvariant()
    $dupe = $false
    if ($forzarInclude -contains $name) { $dupe = $false }
    else {
        foreach ($c in $manuales) {
            $cn = Norm $c.nombre
            $tokMan = (($c.marca -split ' ')[0]).ToLowerInvariant()
            if ($tokMan -ne $tokApi) { continue }
            $igualFin = $nnCore.EndsWith($cn) -or $cn.EndsWith($nnCore)
            $medio = $cn.Length -ge 8 -and ($nn.Contains($cn) -or $cn.Contains($nn))
            if ($igualFin -or $medio) { $dupe = $true; break }
        }
        if (-not $dupe -and $agregadosNorm.ContainsKey($nn)) { $dupe = $true }
    }
    if ($dupe) { $excluidosAntes += $name; continue }

    $o = & $script:bloqueGenerar $p
    $agregadosNorm[$nn] = $true
    $nuevos += $o
}

Write-Output ("manuales: " + $manuales.Count + "   mipodba conservados/nuevos: " + $nuevos.Count + "   excluidos: " + $excluidosAntes.Count)
if ($dropeados.Count -gt 0) {
    Write-Output ("descartados (ya no estan en la API): " + $dropeados.Count)
    foreach ($d in $dropeados) { Write-Output ("  - " + $d) }
}

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
