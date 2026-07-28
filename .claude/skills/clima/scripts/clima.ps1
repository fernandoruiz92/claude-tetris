# clima.ps1 - Consulta el clima actual (y pronostico) desde Open-Meteo.
# Se ejecuta localmente: no requiere API key ni pasa por el cache de WebFetch.
#
# IMPORTANTE: este archivo se mantiene en ASCII puro a proposito. Windows PowerShell 5.1
# asume codificacion ANSI cuando un .ps1 no trae BOM, asi que cualquier caracter acentuado
# se leeria como mojibake. Los grados se emiten con [char]176 y las descripciones evitan
# tildes. Las descripciones con tildes viven en SKILL.md, que solo lee el modelo.

[CmdletBinding()]
param(
    # Nombre de ciudad a geocodificar. Si se omite (y no hay Lat/Lon), se usa Tunja.
    [string] $Ciudad,

    # Coordenadas explicitas. Si se pasan, tienen prioridad sobre -Ciudad.
    [double] $Lat = [double]::NaN,
    [double] $Lon = [double]::NaN,

    # Dias de pronostico diario a incluir (0 = solo condiciones actuales).
    [ValidateRange(0, 16)]
    [int] $Dias = 0,

    # Emite el JSON crudo en lugar del resumen legible.
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$DEG = [char]176

# --- Codigos WMO -> descripcion (ASCII, sin tildes) ---
$WMO = @{
    0 = 'Despejado';                 1 = 'Mayormente despejado'
    2 = 'Parcialmente nublado';      3 = 'Nublado'
    45 = 'Niebla';                   48 = 'Niebla con escarcha'
    51 = 'Llovizna ligera';          53 = 'Llovizna moderada';      55 = 'Llovizna intensa'
    56 = 'Llovizna helada ligera';   57 = 'Llovizna helada intensa'
    61 = 'Lluvia ligera';            63 = 'Lluvia moderada';        65 = 'Lluvia intensa'
    66 = 'Lluvia helada ligera';     67 = 'Lluvia helada intensa'
    71 = 'Nieve ligera';             73 = 'Nieve moderada';         75 = 'Nieve intensa'
    77 = 'Granizo fino'
    80 = 'Chubascos ligeros';        81 = 'Chubascos moderados';    82 = 'Chubascos violentos'
    85 = 'Chubascos de nieve';       86 = 'Chubascos de nieve fuertes'
    95 = 'Tormenta';                 96 = 'Tormenta con granizo';   99 = 'Tormenta con granizo fuerte'
}

function Get-WmoDesc([int] $code) {
    if ($WMO.ContainsKey($code)) { return $WMO[$code] }
    return "Codigo WMO $code"
}

function Get-Cardinal([double] $deg) {
    $pts = @('N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO')
    return $pts[[int](([math]::Round($deg / 22.5)) % 16)]
}

# Se escribe a stderr en crudo en lugar de usar Write-Error: con $ErrorActionPreference='Stop'
# este ultimo decora el mensaje con traza y posicion, y eso tapa el texto util.
function Write-Fallo([string] $msg) {
    [Console]::Error.WriteLine("clima: $msg")
    exit 1
}

function Invoke-Api([string] $url) {
    try {
        return Invoke-RestMethod -Uri $url -TimeoutSec 20
    } catch {
        Write-Fallo "no se pudo consultar Open-Meteo. $($_.Exception.Message)"
    }
}

# --- Resolver ubicacion ---
$tz = 'America/Bogota'
if (-not [double]::IsNaN($Lat) -and -not [double]::IsNaN($Lon)) {
    $etiqueta = "$Lat, $Lon"
    $tz = 'auto'
} elseif ($Ciudad) {
    $q = [uri]::EscapeDataString($Ciudad)
    $geo = Invoke-Api "https://geocoding-api.open-meteo.com/v1/search?name=$q&count=1&language=es&format=json"
    if (-not $geo.results -or $geo.results.Count -eq 0) {
        Write-Fallo "no se encontro la ciudad '$Ciudad'. Prueba con coordenadas: -Lat <n> -Lon <n>"
    }
    $g = $geo.results[0]
    $Lat = $g.latitude
    $Lon = $g.longitude
    $tz  = $g.timezone
    $etiqueta = $g.name
    if ($g.admin1) { $etiqueta = "$etiqueta, $($g.admin1)" }
    if ($g.country) { $etiqueta = "$etiqueta ($($g.country))" }
} else {
    # Ubicacion por defecto: Tunja, Boyaca (ciudad actual del usuario)
    $Lat = 5.5353
    $Lon = -73.3678
    $etiqueta = 'Tunja, Boyaca (Colombia)'
}

# --- Construir la consulta ---
$campos = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day'
$url = "https://api.open-meteo.com/v1/forecast?latitude=$Lat&longitude=$Lon&current=$campos&timezone=$tz"
if ($Dias -gt 0) {
    $url += "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=$Dias"
}

$r = Invoke-Api $url

if ($Json) {
    $r | ConvertTo-Json -Depth 6
    exit 0
}

# --- Resumen legible ---
$c = $r.current
$desc = Get-WmoDesc ([int] $c.weather_code)
$dir = Get-Cardinal ([double] $c.wind_direction_10m)
if ($c.is_day -eq 1) { $luz = 'dia' } else { $luz = 'noche' }

"$etiqueta - $($c.temperature_2m)$DEG`C (sensacion $($c.apparent_temperature)$DEG`C) | $desc"
"  Humedad $($c.relative_humidity_2m)% | viento $($c.wind_speed_10m) km/h $dir | precip $($c.precipitation) mm"
"  Observacion $($c.time) $($r.timezone_abbreviation) | refresco cada $($c.interval)s | altitud $($r.elevation) m | $luz"

if ($Dias -gt 0) {
    ''
    "Pronostico ($Dias dias):"
    # Se formatea con InvariantCulture para que el separador decimal sea punto en todo
    # el reporte; con el locale es-CO el operador -f emitiria coma y quedaria inconsistente
    # con la linea de condiciones actuales, que viene del JSON.
    $inv = [cultureinfo]::InvariantCulture
    for ($i = 0; $i -lt $r.daily.time.Count; $i++) {
        $d  = Get-WmoDesc ([int] $r.daily.weather_code[$i])
        $mn = ([double] $r.daily.temperature_2m_min[$i]).ToString('0.0', $inv)
        $mx = ([double] $r.daily.temperature_2m_max[$i]).ToString('0.0', $inv)
        $pp = ([double] $r.daily.precipitation_sum[$i]).ToString('0.0', $inv)
        $rango = "$mn/$mx $DEG`C"
        '  {0}  {1,-12}  {2,5} mm  {3,3}% prob  {4}' -f `
            $r.daily.time[$i], $rango, $pp, $r.daily.precipitation_probability_max[$i], $d
    }
}
