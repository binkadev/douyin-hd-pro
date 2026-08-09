$ErrorActionPreference = 'Stop'
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$BuildDir = Join-Path $env:TEMP 'DouyinHDProBuild'

# PyInstaller 6.22+ refuses to run when the current working directory is System32.
# Always anchor the installer to its own/build directory so double-click/UAC cannot break it.
Set-Location -LiteralPath $NativeDir

function Find-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -c "import sys; print(sys.executable)" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return 'py' }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -c "import sys; print(sys.executable)" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return 'python' }
    }
    return $null
}

Write-Host ''
Write-Host '=== Douyin HD Pro - Native Helper Installer ===' -ForegroundColor Cyan
$Py = Find-Python
if (-not $Py) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host 'Chua co Python. Dang cai Python 3.12 bang winget...' -ForegroundColor Yellow
        winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        $env:Path += ";$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts"
        $Py = Find-Python
    }
}
if (-not $Py) {
    throw 'Khong tim thay Python. Cai Python 3.11+ tu python.org, sau do chay lai install_windows.bat.'
}

if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$Venv = Join-Path $BuildDir 'venv'
if ($Py -eq 'py') { & py -3 -m venv $Venv } else { & python -m venv $Venv }
$VenvPython = Join-Path $Venv 'Scripts\python.exe'
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip pyinstaller

Write-Host 'Dang build native helper...' -ForegroundColor Yellow
$Dist = Join-Path $BuildDir 'dist'
$Work = Join-Path $BuildDir 'work'
Push-Location -LiteralPath $BuildDir
try {
    & $VenvPython -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath $Dist --workpath $Work --specpath $BuildDir (Join-Path $NativeDir 'host.py')
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}
$Exe = Join-Path $Dist 'douyin_hd_native.exe'
if (-not (Test-Path $Exe)) { throw 'Build native helper that bai.' }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $Exe (Join-Path $InstallDir 'douyin_hd_native.exe') -Force
$ManifestPath = Join-Path $InstallDir 'com.douyin.hd_pro.json'
$Manifest = @{
    name = $HostName
    description = 'Douyin HD Pro native high-speed downloader'
    path = (Join-Path $InstallDir 'douyin_hd_native.exe')
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ManifestPath, $Manifest, (New-Object Text.UTF8Encoding($false)))
reg.exe ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /ve /t REG_SZ /d "$ManifestPath" /f | Out-Null

Write-Host ''
Write-Host 'CAI DAT NATIVE HELPER THANH CONG.' -ForegroundColor Green
Write-Host "Extension ID: $ExtensionId"
Write-Host "Thu muc Extension: $ExtensionDir" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Buoc cuoi:' -ForegroundColor Yellow
Write-Host '1. Chrome -> chrome://extensions'
Write-Host '2. Bat Developer mode'
Write-Host '3. Load unpacked -> chon thu muc extension o tren'
Write-Host '4. Reload Chrome/Douyin neu can'
Write-Host ''
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch {}
Read-Host 'Nhan Enter de dong'
