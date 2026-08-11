$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$BuildDir = Join-Path $env:TEMP 'DouyinHDProBuild'
Set-Location -LiteralPath $NativeDir

function Find-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -c "import sys; print(sys.executable)" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { return 'py' } }
    if (Get-Command python -ErrorAction SilentlyContinue) { & python -c "import sys; print(sys.executable)" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { return 'python' } }
    return $null
}

Write-Host ''
Write-Host '=== Douyin HD Pro v1.1.0 - Tự build Native Helper từ source ===' -ForegroundColor Cyan
$Py = Find-Python
if (-not $Py -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'Chưa có Python. Đang cài Python 3.12 bằng winget...' -ForegroundColor Yellow
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    $env:Path += ";$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts"
    $Py = Find-Python
}
if (-not $Py) { throw 'Không tìm thấy Python. Hãy cài Python 3.11+ rồi chạy lại install_windows.bat.' }

if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$Venv = Join-Path $BuildDir 'venv'
if ($Py -eq 'py') { & py -3 -m venv $Venv } else { & python -m venv $Venv }
$VenvPython = Join-Path $Venv 'Scripts\python.exe'
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip pyinstaller

Write-Host 'Đang build Native Helper...' -ForegroundColor Yellow
$Dist = Join-Path $BuildDir 'dist'; $Work = Join-Path $BuildDir 'work'
Push-Location -LiteralPath $BuildDir
try {
    & $VenvPython -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath $Dist --workpath $Work --specpath $BuildDir (Join-Path $NativeDir 'host.py')
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller thất bại với mã $LASTEXITCODE." }
} finally { Pop-Location }
$Exe = Join-Path $Dist 'douyin_hd_native.exe'
if (-not (Test-Path $Exe)) { throw 'Không tạo được Native Helper.' }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $Exe (Join-Path $InstallDir 'douyin_hd_native.exe') -Force
$ManifestPath = Join-Path $InstallDir 'com.douyin.hd_pro.json'
$Manifest = @{ name=$HostName; description='Douyin HD Pro - bộ tải tốc độ cao chạy cục bộ'; path=(Join-Path $InstallDir 'douyin_hd_native.exe'); type='stdio'; allowed_origins=@("chrome-extension://$ExtensionId/") } | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ManifestPath,$Manifest,(New-Object Text.UTF8Encoding($false)))
reg.exe ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /ve /t REG_SZ /d "$ManifestPath" /f | Out-Null

Write-Host ''
Write-Host 'CÀI ĐẶT NATIVE HELPER THÀNH CÔNG.' -ForegroundColor Green
Write-Host "Thư mục Extension: $ExtensionDir" -ForegroundColor Cyan
Write-Host 'Chrome -> chrome://extensions -> bật Chế độ dành cho nhà phát triển -> Tải tiện ích đã giải nén -> chọn thư mục extension.' -ForegroundColor Yellow
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch {}
Read-Host 'Nhấn Enter để đóng'
