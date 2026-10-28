# Conecta "Entrar con Facebook" en un solo paso (después de crear la app en Meta).
#
# Pide el Identificador, la Clave secreta y el Token de cliente de la app de Meta
# (developers.facebook.com → tu app → Configuración de la app → Básica / Avanzada) y:
#   1. Activa Facebook en Firebase (la clave secreta solo va a Firebase).
#   2. Escribe el Identificador y el Token de cliente en lithio_mobile\.env.
#   3. Muestra lo que falta pegar en Meta: la URI de redireccionamiento y el hash
#      de clave del APK.
# Después: publicar_actualizacion.bat (web) y generar_apk.bat (Android).

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot

$appId = (Read-Host 'Identificador de la app de Meta (solo numeros)').Trim()
if ($appId -notmatch '^\d{6,20}$') { Write-Host 'ERROR: el identificador son solo numeros.' -ForegroundColor Red; exit 1 }
$secret = Read-Host 'Clave secreta de la app (boton Mostrar en Configuracion -> Basica)' -AsSecureString
$secretText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret))
$clientToken = (Read-Host 'Token de cliente (Configuracion -> Avanzada -> Seguridad)').Trim()
if (-not $secretText -or -not $clientToken) { Write-Host 'ERROR: faltan la clave secreta o el token de cliente.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '==> 1/3 Activando Facebook en Firebase' -ForegroundColor Cyan
Push-Location (Join-Path $Root 'lithio_backend')
& .\venv\Scripts\python.exe -m app.enable_facebook $appId $secretText
$ok = $LASTEXITCODE -eq 0
Pop-Location
$secretText = $null
if (-not $ok) { exit 1 }

Write-Host '==> 2/3 Guardando el identificador en lithio_mobile\.env' -ForegroundColor Cyan
$envFile = Join-Path $Root 'lithio_mobile\.env'
$lines = @(Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -notmatch '^(EXPO_PUBLIC_FACEBOOK_APP_ID|FACEBOOK_CLIENT_TOKEN)=' })
$lines += "EXPO_PUBLIC_FACEBOOK_APP_ID=$appId"
$lines += "FACEBOOK_CLIENT_TOKEN=$clientToken"
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))

Write-Host '==> 3/3 Pega esto en Meta (developers.facebook.com -> tu app)' -ForegroundColor Cyan
Write-Host '  Inicio de sesion con Facebook -> Configuracion -> URI de redireccionamiento de OAuth validos:'
Write-Host '    https://lithio-app.firebaseapp.com/__/auth/handler' -ForegroundColor Green
Write-Host '  Configuracion de la app -> Basica -> Android:'
Write-Host '    Paquete: com.lithio.app   Clase: com.lithio.app.MainActivity' -ForegroundColor Green
Write-Host '    Hash de clave: CH6topAB2Db0C738ufTnYEqiCNE=' -ForegroundColor Green
Write-Host '  Configuracion de la app -> Basica: Dominios de la app: lithio-app.firebaseapp.com' -ForegroundColor Green
Write-Host '  Arriba: cambia la app de "Desarrollo" a "Activo" (si no, solo entran los probadores).'
Write-Host ''
Write-Host 'Siguiente: publicar_actualizacion.bat (web y APK actuales) y generar_apk.bat (Facebook en Android).' -ForegroundColor Yellow
