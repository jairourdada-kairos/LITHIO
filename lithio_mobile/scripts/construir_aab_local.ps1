# Genera el AAB de LITHIO para Play Store EN ESTA PC (sin cola ni cuenta de EAS).
# Usa el JDK y el Android SDK de Escritorio\KairosTools. Resultado: Escritorio\Lithio-Android\Lithio.aab
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\construir_aab_local.ps1
$ErrorActionPreference = 'Stop'
$real = Split-Path $PSScriptRoot -Parent
# Windows limita las rutas del compilador nativo (CMake/ninja) a ~260 caracteres: se compila en una copia en C:\l (ruta corta)
$proj = 'C:\l'
New-Item -ItemType Directory -Force $proj | Out-Null
robocopy $real $proj /MIR /XD "$real\android" "$real\dist" "$real\dist-web" "$real\.expo" "$real\.git" /NFL /NDL /NJH /NJS /NP | Out-Null
$tools = Join-Path ([Environment]::GetFolderPath('Desktop')) 'KairosTools'
$env:JAVA_HOME = "$tools\jdk17"
$env:ANDROID_HOME = "$tools\android-sdk"
$env:ANDROID_SDK_ROOT = "$tools\android-sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:NODE_ENV = 'production'
Set-Location $proj

# 1) proyecto nativo (android/ está en .gitignore; se regenera siempre)
node "$proj\node_modules\expo\bin\cli" prebuild --platform android --clean --no-install
"sdk.dir=$($env:ANDROID_HOME -replace '\\','/')" | Set-Content "$proj\android\local.properties" -Encoding ASCII

# 2) llave de subida (una sola vez). GUARDA credentials\ en un lugar seguro: sin ella no podrás actualizar la app.
$credDir = Join-Path $proj 'credentials'
$ks = Join-Path $credDir 'lithio-upload.keystore'
$kp = Join-Path $credDir 'keystore.properties'
New-Item -ItemType Directory -Force $credDir | Out-Null
if (-not (Test-Path $ks)) {
  $pw0 = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore $ks -alias lithio -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pw0 -keypass $pw0 -dname 'CN=LITHIO, O=Kairos, C=VE' | Out-Null
  "storePassword=$pw0" | Set-Content $kp -Encoding ASCII
}
# las rutas de la llave se reescriben siempre con la carpeta de esta copia
$pw = ((Get-Content $kp | Where-Object { $_ -like 'storePassword=*' }) -replace '^storePassword=', '')
if (-not $pw) { throw 'No se encontró la contraseña de la llave en credentials\keystore.properties' }
"storeFile=$($ks -replace '\\','/')`nstorePassword=$pw`nkeyAlias=lithio`nkeyPassword=$pw" | Set-Content $kp -Encoding ASCII

# 3) firmar el release con esa llave (Expo usa la de depuración por defecto, que Play rechaza)
$gradle = "$proj\android\app\build.gradle"
$g = [System.IO.File]::ReadAllText($gradle)
$kpGradle = $kp -replace '\\', '/'
$block = @"
    signingConfigs {
        release {
            def p = new Properties()
            file('$kpGradle').withInputStream { p.load(it) }
            storeFile file(p['storeFile'])
            storePassword p['storePassword']
            keyAlias p['keyAlias']
            keyPassword p['keyPassword']
        }
    }
"@
if ($g -notmatch 'keystore\.properties') {
  $i = $g.IndexOf('buildTypes {')
  if ($i -lt 0) { throw 'No se encontró buildTypes en build.gradle' }
  $g = $g.Substring(0, $i) + $block + "`n    " + $g.Substring($i)
  $i = $g.IndexOf('buildTypes {'); $j = $g.IndexOf('release {', $i)
  $k = $g.IndexOf('signingConfig signingConfigs.debug', $j)
  if ($k -lt 0) { throw 'No se encontró la firma de release para reemplazar en build.gradle' }
  $g = $g.Substring(0, $k) + 'signingConfig signingConfigs.release' + $g.Substring($k + 'signingConfig signingConfigs.debug'.Length)
  [System.IO.File]::WriteAllText($gradle, $g, (New-Object System.Text.UTF8Encoding($false)))
}

# 3b) los objetos de C++ se compilan en C:\c (ruta muy corta), porque ninja replica la ruta completa de cada archivo
$g = [System.IO.File]::ReadAllText($gradle)
if ($g -notmatch 'buildStagingDirectory') {
  $g = [regex]::Replace($g, '(?m)^android \{', "android {`n    externalNativeBuild { cmake { buildStagingDirectory file('C:/c') } }", 1)
  [System.IO.File]::WriteAllText($gradle, $g, (New-Object System.Text.UTF8Encoding($false)))
}

# 4) compilar el AAB
Set-Location "$proj\android"
.\gradlew.bat --no-daemon bundleRelease "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a"
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Lithio-Android'
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item "$proj\android\app\build\outputs\bundle\release\app-release.aab" "$out\Lithio.aab" -Force
Write-Host "Listo: $out\Lithio.aab"

# la llave de subida se guarda también en el proyecto real
robocopy "$proj\credentials" "$real\credentials" /E /NFL /NDL /NJH /NJS /NP | Out-Null
Set-Location $env:USERPROFILE
