# Copia de seguridad de la base de datos de la nube (PostgreSQL en Railway) a esta PC.
#
# Uso: doble clic en respaldar_nube.bat
#   (o: powershell -ExecutionPolicy Bypass -File scripts\respaldar_nube.ps1)
#
# Se conecta por SSH al servicio Postgres de Railway (llave "lithio-pc"), ejecuta
# pg_dump y guarda el archivo en lithio_backend\backups\nube\ (no se sube a git).
# Conserva las 30 copias más recientes. CAMBIA AQUÍ cuántas copias guardar:
$Keep = 30

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Dir = Join-Path $Root 'lithio_backend\backups\nube'
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$File = Join-Path $Dir ("lithio_{0}.sql" -f (Get-Date -Format 'yyyyMMdd_HHmm'))
$ErrLog = Join-Path $env:TEMP 'lithio_respaldo_error.txt'

Write-Host '==> Copiando la base de datos de la nube...' -ForegroundColor Cyan
$proc = Start-Process -FilePath 'npx.cmd' -WorkingDirectory $Root -NoNewWindow -Wait -PassThru `
  -ArgumentList '-y @railway/cli@latest ssh --service Postgres -- "pg_dump -U $PGUSER -d $PGDATABASE --no-owner"' `
  -RedirectStandardOutput $File -RedirectStandardError $ErrLog

$ok = $proc.ExitCode -eq 0 -and (Test-Path $File) -and ((Get-Item $File).Length -gt 1000) -and (Select-String -Path $File -Pattern 'PostgreSQL database dump complete' -Quiet)
if (-not $ok) {
  Write-Host "ERROR: el respaldo no se completo. Detalle en $ErrLog" -ForegroundColor Red
  if (Test-Path $File) { Remove-Item $File -Force }
  exit 1
}

Get-ChildItem $Dir -Filter 'lithio_*.sql' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force
$kb = [math]::Round((Get-Item $File).Length / 1KB)
Write-Host "LISTO: respaldo guardado en $File ($kb KB)." -ForegroundColor Green
