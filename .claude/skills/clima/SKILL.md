---
name: clima
description: Consulta el clima actual y el pronóstico de cualquier ciudad ejecutando un script local (Open-Meteo, sin API key). Úsala cuando se pregunte por el clima, el tiempo, la temperatura, si va a llover, la humedad o el pronóstico — por defecto para Tunja, Boyacá (ciudad del usuario). También responde a "weather", "forecast", "temperature", "va a llover", "cómo está el clima".
---

# Clima

Obtiene condiciones actuales y pronóstico desde **Open-Meteo**, ejecutando PowerShell
localmente. Sin API key, sin registro, sin límites prácticos de uso.

**Ventaja sobre `WebFetch`:** `WebFetch` cachea 15 minutos por URL, así que en consultas
repetidas devuelve datos idénticos sin que puedas distinguir caché de dato sin cambios.
Este script sale a la red en cada invocación. Prefiérelo siempre para clima.

## Uso

```powershell
$s = ".claude/skills/clima/scripts/clima.ps1"

# Tunja, Boyacá (por defecto) — condiciones actuales
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s

# Otra ciudad (se geocodifica automáticamente)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Ciudad "Bogotá"

# Con pronóstico diario (1–16 días)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Ciudad "Medellín" -Dias 5

# Coordenadas explícitas (tienen prioridad sobre -Ciudad; zona horaria automática)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Lat 5.5353 -Lon -73.3678

# JSON crudo, para cuando necesites los campos sin formatear
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Json
```

Salida típica:

```
Tunja, Boyaca (Colombia) - 14.7°C (sensacion 13.4°C) | Llovizna moderada
  Humedad 69% | viento 16.0 km/h SSE | precip 0.20 mm
  Observacion 2026-07-28T11:15 GMT-5 | refresco cada 900s | altitud 2818.0 m | dia
```

## Cómo reportarlo al usuario

El script emite **ASCII sin tildes a propósito** (ver "Notas" abajo). Al redactar la
respuesta, reescribe con ortografía correcta en español:

```
Tunja, Boyacá — 14.7 °C (sensación 13.4 °C) · Llovizna moderada · 69 % HR · viento 16 km/h SSE · 0.2 mm · 11:15 GMT-5
```

Reglas:

- Una línea compacta para condiciones actuales; tabla solo si se pidió pronóstico.
- `interval: 900` significa que **la observación se refresca cada 15 minutos**. Si te piden
  clima en un bucle más rápido que eso, dilo: la mayoría de las lecturas repetirán el valor.
- Si el valor no cambió respecto a la consulta anterior de la sesión, di `sin cambios` en vez
  de repetir la línea completa.
- No inventes datos que el script no devolvió (índice UV, calidad del aire, etc.). Si los
  piden, añade el campo a la consulta en lugar de estimarlo.

## Códigos WMO

El script ya traduce `weather_code`. Tabla de referencia por si lees el JSON crudo:

| Código | Significado |
|---|---|
| 0 | Despejado |
| 1–3 | Mayormente despejado · Parcialmente nublado · Nublado |
| 45, 48 | Niebla · Niebla con escarcha |
| 51, 53, 55 | Llovizna ligera · moderada · intensa |
| 56, 57 | Llovizna helada |
| 61, 63, 65 | Lluvia ligera · moderada · intensa |
| 66, 67 | Lluvia helada |
| 71, 73, 75 | Nieve ligera · moderada · intensa |
| 77 | Granizo fino |
| 80, 81, 82 | Chubascos ligeros · moderados · violentos |
| 85, 86 | Chubascos de nieve |
| 95, 96, 99 | Tormenta · Tormenta con granizo · con granizo fuerte |

## Añadir campos

Los parámetros `current=` y `daily=` de Open-Meteo son listas separadas por comas dentro de
`clima.ps1`. Para agregar datos, extiende `$campos` (actuales) o el bloque `&daily=`.
Campos útiles no incluidos: `uv_index`, `pressure_msl`, `cloud_cover`, `visibility`,
`sunrise`/`sunset` (solo en `daily`). Documentación: https://open-meteo.com/en/docs

## Notas

- **Encoding:** `clima.ps1` se mantiene en **ASCII puro**. Windows PowerShell 5.1 asume
  codificación ANSI cuando un `.ps1` no trae BOM, así que un literal acentuado saldría como
  mojibake. Los grados se emiten con `[char]176`. **No introduzcas tildes ni `°` literales
  en el script** — las tildes viven en este `SKILL.md`, que solo lee el modelo.
- **Separador decimal:** el pronóstico se formatea con `InvariantCulture` para que use punto,
  igual que la línea de condiciones actuales (que viene del JSON). Con el locale `es-CO` el
  operador `-f` emitiría coma e inconsistencia.
- Los nombres de ciudad devueltos por el geocodificador **sí** traen tildes (`Medellín`);
  vienen de la red, no de un literal del script, así que se muestran bien.
- Fuente de respaldo si Open-Meteo falla: `https://wttr.in/<ciudad>?format=j1`. Sus
  observaciones suelen ser más viejas y discrepar — úsala solo como fallback, no promedies.
- Ciudad no encontrada o red caída ⇒ el script escribe el error y sale con código 1.
