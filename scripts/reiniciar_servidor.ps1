# Reinicia solo el servidor local (el backend en localhost:8000) para que tome los cambios hechos en los archivos .py.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot

Write-Host '==> Apagando el servidor' -ForegroundColor Cyan
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'uvicorn app.main:app' -or $_.CommandLine -match 'iniciar_servidor.bat' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host '==> Encendiendo el servidor con los cambios' -ForegroundColor Cyan
Start-Process cmd -ArgumentList '/c', "`"$Root\iniciar_servidor.bat`"" -WindowStyle Minimized

$up = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  try { Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2 | Out-Null; $up = $true; break } catch {}
}
if ($up) {
  Write-Host 'LISTO: el servidor ya tiene los cambios. Recarga la app (F5 en la web; cerrar y abrir en el telefono).' -ForegroundColor Green
} else {
  Write-Host 'ERROR: el servidor no arranco. Casi siempre es un error de escritura en el archivo que editaste' -ForegroundColor Red
  Write-Host '(una coma o una comilla que falta). Abre iniciar_servidor.bat para ver el mensaje.' -ForegroundColor Red
}
