$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$BuildDir = Join-Path $env:TEMP 'DouyinHDProBuild'
$TargetExe = Join-Path $InstallDir 'douyin_hd_native.exe'
$StageExe = Join-Path $InstallDir 'douyin_hd_native.new.exe'
Set-Location -LiteralPath $NativeDir

function Find-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -c "import sys; print(sys.executable)" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { return 'py' } }
    if (Get-Command python -ErrorAction SilentlyContinue) { & python -c "import sys; print(sys.executable)" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { return 'python' } }
    return $null
}

function Get-InstalledNativeProcesses {
    if (-not (Test-Path $TargetExe)) { return @() }
    $target = [IO.Path]::GetFullPath($TargetExe)
    $items = @()
    try {
        $items = @(Get-CimInstance Win32_Process -Filter "Name='douyin_hd_native.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.ExecutablePath -and [string]::Equals([IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase)
        })
    } catch {}
    return $items
}

function Stop-InstalledNativeHelper {
    $items = @(Get-InstalledNativeProcesses)
    if ($items.Count -eq 0) { return }
    Write-Host "Đang dừng Native Helper cũ ($($items.Count) tiến trình)..." -ForegroundColor Yellow
    foreach ($p in $items) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
    $deadline = (Get-Date).AddSeconds(6)
    do {
        Start-Sleep -Milliseconds 200
        $left = @(Get-InstalledNativeProcesses)
        if ($left.Count -eq 0) { return }
    } while ((Get-Date) -lt $deadline)
    throw 'Không thể dừng Native Helper cũ. Hãy đóng Chrome hoàn toàn rồi chạy lại install_windows.bat.'
}

function Install-NativeExecutable([string]$SourceExe) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Remove-Item $StageExe -Force -ErrorAction SilentlyContinue
    Copy-Item $SourceExe $StageExe -Force
    Stop-InstalledNativeHelper
    $lastError = $null
    for ($i = 1; $i -le 12; $i++) {
        try {
            if (Test-Path $TargetExe) { Remove-Item $TargetExe -Force -ErrorAction Stop }
            Move-Item $StageExe $TargetExe -Force -ErrorAction Stop
            return
        } catch {
            $lastError = $_
            Stop-InstalledNativeHelper
            Start-Sleep -Milliseconds (250 + ($i * 100))
        }
    }
    Remove-Item $StageExe -Force -ErrorAction SilentlyContinue
    throw "Không thể cập nhật Native Helper. Hãy đóng Chrome hoàn toàn rồi chạy lại. Chi tiết: $($lastError.Exception.Message)"
}

Write-Host ''
Write-Host '=== Douyin HD Pro v2.0.1 - Tự build Native Helper từ source ===' -ForegroundColor Cyan
Write-Host 'Không cần chạy bằng quyền Administrator.' -ForegroundColor DarkGray
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
if ($LASTEXITCODE -ne 0) { throw 'Không thể cài PyInstaller.' }

Write-Host 'Đang build Native Helper...' -ForegroundColor Yellow
$Dist = Join-Path $BuildDir 'dist'; $Work = Join-Path $BuildDir 'work'
Push-Location -LiteralPath $BuildDir
try {
    & $VenvPython -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath $Dist --workpath $Work --specpath $BuildDir (Join-Path $NativeDir 'host.py')
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller thất bại với mã $LASTEXITCODE." }
} finally { Pop-Location }
$Exe = Join-Path $Dist 'douyin_hd_native.exe'
if (-not (Test-Path $Exe)) { throw 'Không tạo được Native Helper.' }

Install-NativeExecutable $Exe
$ManifestPath = Join-Path $InstallDir 'com.douyin.hd_pro.json'
$Manifest = @{ name=$HostName; description='Douyin HD Pro - bộ tải tốc độ cao chạy cục bộ'; path=$TargetExe; type='stdio'; allowed_origins=@("chrome-extension://$ExtensionId/") } | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ManifestPath,$Manifest,(New-Object Text.UTF8Encoding($false)))
reg.exe ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /ve /t REG_SZ /d "$ManifestPath" /f | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Không thể đăng ký Native Messaging Host trong Registry.' }

Write-Host ''
Write-Host 'CÀI ĐẶT NATIVE HELPER THÀNH CÔNG.' -ForegroundColor Green
Write-Host "Thư mục Extension: $ExtensionDir" -ForegroundColor Cyan
Write-Host 'Chrome -> chrome://extensions -> bật Chế độ dành cho nhà phát triển -> Reload bản cũ hoặc Tải tiện ích đã giải nén -> chọn thư mục extension.' -ForegroundColor Yellow
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch {}
Read-Host 'Nhấn Enter để đóng'
