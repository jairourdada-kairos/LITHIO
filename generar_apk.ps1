# Genera el instalable de Android (APK) de LITHIO apuntando al servidor en la nube.
#
# Uso: doble clic en generar_apk.bat (despues de desplegar_nube.bat).
# La compilacion se hace en los servidores de Expo (EAS), no en esta PC.
# Lo unico manual: iniciar sesion en tu cuenta de Expo la primera vez.

$ErrorActionPreference = 'Stop'
$Mobile = Join-Path $PSScriptRoot 'moto_unc_mobile'
Set-Location $Mobile

function Eas { & npx -y 'eas-cli@latest' @args; if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: eas $($args -join ' ') fallo" -ForegroundColor Red; exit 1 } }

$apiLine = Get-Content '.env' -Encoding UTF8 | Where-Object { $_ -like 'EXPO_PUBLIC_API_URL=*' } | Select-Object -First 1
if (-not $apiLine -or $apiLine -notlike 'EXPO_PUBLIC_API_URL=https://*') {
  Write-Host 'ERROR: moto_unc_mobile\.env todavia apunta a esta PC. Ejecuta primero desplegar_nube.bat.' -ForegroundColor Red
  exit 1
}
Write-Host "Servidor de la app: $($apiLine.Substring('EXPO_PUBLIC_API_URL='.Length))" -ForegroundColor Cyan

Write-Host ''
Write-Host '==> 1/3 Cuenta de Expo' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' whoami 2>$null
if ($LASTEXITCODE -ne 0) { Eas login }

Write-Host ''
Write-Host '==> 2/3 Enviar la configuracion publica de la app (direccion del servidor y Firebase web)' -ForegroundColor Cyan
Eas env:push preview --path .env --force

Write-Host ''
Write-Host '==> 3/3 Compilar el APK (unos 15 minutos; la primera vez acepta crear la firma de Android)' -ForegroundColor Cyan
Eas build --platform android --profile preview

Write-Host ''
Write-Host 'LISTO: arriba esta el enlace para descargar el .apk.' -ForegroundColor Green
Write-Host 'Compartelo por WhatsApp; al instalar, Android pedira permitir "origenes desconocidos".'
