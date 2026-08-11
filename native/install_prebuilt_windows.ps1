$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$SourceExe = Join-Path $NativeDir 'bin\douyin_hd_native.exe'
Set-Location -LiteralPath $NativeDir

Write-Host ''
Write-Host '=====================================================' -ForegroundColor DarkGray
Write-Host '  Douyin HD Pro v1.1.0 - Trình cài đặt Windows' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path $SourceExe)) {
    throw 'Không tìm thấy native\bin\douyin_hd_native.exe. Hãy tải gói Windows-Full trong Releases hoặc chạy install_windows.bat để tự build từ source.'
}

Write-Host '[1/3] Đang cài Native Helper...' -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $SourceExe (Join-Path $InstallDir 'douyin_hd_native.exe') -Force
$ManifestPath = Join-Path $InstallDir 'com.douyin.hd_pro.json'
$Manifest = @{
    name = $HostName
    description = 'Douyin HD Pro - bộ tải tốc độ cao chạy cục bộ'
    path = (Join-Path $InstallDir 'douyin_hd_native.exe')
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ManifestPath, $Manifest, (New-Object Text.UTF8Encoding($false)))
reg.exe ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /ve /t REG_SZ /d "$ManifestPath" /f | Out-Null

Write-Host '[2/3] Đã đăng ký kết nối với Chrome.' -ForegroundColor Green
Write-Host '[3/3] Mở trang quản lý tiện ích Chrome...' -ForegroundColor Yellow
Write-Host ''
Write-Host 'BƯỚC CUỐI TRÊN CHROME:' -ForegroundColor Cyan
Write-Host '  1. Bật "Chế độ dành cho nhà phát triển".'
Write-Host '  2. Chọn "Tải tiện ích đã giải nén".'
Write-Host '  3. Chọn đúng thư mục:' -NoNewline
Write-Host " $ExtensionDir" -ForegroundColor Green
Write-Host ''
Write-Host "Extension ID cố định: $ExtensionId" -ForegroundColor DarkGray
Write-Host "Thư mục mặc định: $env:USERPROFILE\Downloads\DouyinHD (có thể đổi trong popup)" -ForegroundColor DarkGray
Write-Host ''
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch { Write-Host 'Không thể tự mở Chrome. Hãy mở chrome://extensions thủ công.' -ForegroundColor Yellow }
Read-Host 'Nhấn Enter để đóng trình cài đặt'
