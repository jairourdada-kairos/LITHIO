# Baja a este PC los cambios de colores y letras que los compañeros subieron a la rama "practica".
#
# Solo copia archivos de ESTILO (lista blanca de abajo). Cualquier otro archivo que
# ellos cambien se ignora, así nunca llega código ajeno al servidor.
#   - tema_app.py          -> se ve en la app y en la web sin reiniciar y sin publicar.
#   - style.css / páginas  -> se ven con Ctrl+F5 en el navegador.
#   - archivos de la app   -> se publican solos con publicar_actualizacion.ps1.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$branch = 'practica'

# Solo estos archivos se aceptan desde la rama de práctica.
$allowed = @(
  'lithio_backend/app/tema_app.py',
  'lithio_dashboard/style.css',
  'lithio_descarga/index.html',
  'lithio_backend/app/legal/terminos.html',
  'lithio_backend/app/legal/privacidad.html',
  'lithio_backend/app/legal/eliminar-cuenta.html',
  'lithio_mobile/src/constants/theme.ts',
  'lithio_mobile/src/components/brand/PrimaryButton.tsx',
  'lithio_mobile/src/components/nav/BottomTabBar.tsx',
  'lithio_mobile/src/components/ui/ScreenHeader.tsx'
)
$appFiles = $allowed | Where-Object { $_ -like 'lithio_mobile/*' }

Write-Host "==> Buscando cambios nuevos en la rama '$branch'" -ForegroundColor Cyan
git fetch origin $branch 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: no existe la rama '$branch' en GitHub o no hay internet." -ForegroundColor Red; exit 1 }

$base = (git merge-base HEAD "origin/$branch").Trim()
$changed = @(git diff --name-only $base "origin/$branch")
if ($changed.Count -eq 0) { Write-Host 'No hay cambios nuevos.' -ForegroundColor Yellow; exit 0 }

$applied = @(); $skipped = @()
foreach ($f in $changed) {
  if ($allowed -notcontains $f) { $skipped += "$f (no es un archivo de estilo)"; continue }
  if (git status --porcelain -- $f) { $skipped += "$f (tiene cambios tuyos sin guardar en git)"; continue }
  git checkout "origin/$branch" -- $f
  if ($LASTEXITCODE -eq 0) { $applied += $f } else { $skipped += "$f (error al copiar)" }
}

Write-Host ''
if ($applied.Count) { Write-Host 'Aplicados:' -ForegroundColor Green; $applied | ForEach-Object { Write-Host "  $_" } }
if ($skipped.Count) { Write-Host 'Ignorados:' -ForegroundColor Yellow; $skipped | ForEach-Object { Write-Host "  $_" } }

if ($applied | Where-Object { $appFiles -contains $_ }) {
  Write-Host ''
  Write-Host '==> Cambio la app: publicando para el telefono y la web' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'publicar_actualizacion.ps1')
} elseif ($applied) {
  Write-Host ''
  Write-Host 'Listo. Para el panel y las paginas, recarga con Ctrl+F5; tema_app.py ya esta activo.' -ForegroundColor Green
}
