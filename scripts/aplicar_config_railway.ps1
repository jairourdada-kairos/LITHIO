# Aplica en Railway la configuración de .railway\railway.ts (reemplazo de railway.json).
#
# Uso: doble clic en aplicar_config_railway.bat
# Muestra primero el plan (qué cambia) y luego pide confirmación antes de aplicarlo.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# El SDK de Railway busca la herramienta "railway" en el PATH: usa la que descarga npx.
& npx -y '@railway/cli@latest' --version | Out-Null
$exe = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'npm-cache\_npx') -Recurse -Filter 'railway.exe' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $exe) { Write-Host 'ERROR: no encontre railway.exe. Ejecuta: npx @railway/cli --version' -ForegroundColor Red; exit 1 }
$env:_ = $exe
$env:Path = (Split-Path $exe) + ';' + $env:Path

Write-Host '==> Plan (que va a cambiar):' -ForegroundColor Cyan
& $exe config plan
Write-Host ''
Write-Host 'Debe decir "0 to destroy" y NO mencionar el disco /data. Si menciona borrar algo, NO confirmes.' -ForegroundColor Yellow
& $exe config apply
