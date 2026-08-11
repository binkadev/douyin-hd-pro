$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$SourceExe = Join-Path $NativeDir 'bin\douyin_hd_native.exe'
$TargetExe = Join-Path $InstallDir 'douyin_hd_native.exe'
$StageExe = Join-Path $InstallDir 'douyin_hd_native.new.exe'
Set-Location -LiteralPath $NativeDir

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
    foreach ($p in $items) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
    }
    $deadline = (Get-Date).AddSeconds(6)
    do {
        Start-Sleep -Milliseconds 200
        $left = @(Get-InstalledNativeProcesses)
        if ($left.Count -eq 0) { return }
    } while ((Get-Date) -lt $deadline)
    throw 'Không thể dừng Native Helper cũ. Hãy đóng Chrome hoàn toàn rồi chạy lại CAI-DAT-WINDOWS.bat.'
}

function Install-NativeExecutable {
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
    throw "Không thể cập nhật Native Helper sau nhiều lần thử. Hãy đóng Chrome hoàn toàn rồi chạy lại. Chi tiết: $($lastError.Exception.Message)"
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor DarkGray
Write-Host '  Douyin HD Pro v2.0.1 - Trình cài đặt Windows' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path $SourceExe)) {
    throw 'Không tìm thấy native\bin\douyin_hd_native.exe. Hãy tải gói Windows-Full trong Releases hoặc chạy install_windows.bat để tự build từ source.'
}

Write-Host '[1/3] Đang cài Native Helper...' -ForegroundColor Yellow
Install-NativeExecutable
$ManifestPath = Join-Path $InstallDir 'com.douyin.hd_pro.json'
$Manifest = @{
    name = $HostName
    description = 'Douyin HD Pro - bộ tải tốc độ cao chạy cục bộ'
    path = $TargetExe
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ManifestPath, $Manifest, (New-Object Text.UTF8Encoding($false)))
reg.exe ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /ve /t REG_SZ /d "$ManifestPath" /f | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Không thể đăng ký Native Messaging Host trong Registry.' }

Write-Host '[2/3] Đã đăng ký kết nối với Chrome.' -ForegroundColor Green
Write-Host '[3/3] Mở trang quản lý tiện ích Chrome...' -ForegroundColor Yellow
Write-Host ''
Write-Host 'CÀI ĐẶT NATIVE HELPER THÀNH CÔNG.' -ForegroundColor Green
Write-Host ''
Write-Host 'BƯỚC CUỐI TRÊN CHROME:' -ForegroundColor Cyan
Write-Host '  1. Bật "Chế độ dành cho nhà phát triển".'
Write-Host '  2. Nếu Douyin HD Pro đã có: bấm Reload.'
Write-Host '  3. Nếu chưa có: chọn "Tải tiện ích đã giải nén" và chọn:' -NoNewline
Write-Host " $ExtensionDir" -ForegroundColor Green
Write-Host ''
Write-Host "Extension ID cố định: $ExtensionId" -ForegroundColor DarkGray
Write-Host "Native Helper: $TargetExe" -ForegroundColor DarkGray
Write-Host 'Không cần chạy trình cài đặt bằng quyền Administrator.' -ForegroundColor DarkGray
Write-Host ''
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch { Write-Host 'Không thể tự mở Chrome. Hãy mở chrome://extensions thủ công.' -ForegroundColor Yellow }
Read-Host 'Nhấn Enter để đóng trình cài đặt'
