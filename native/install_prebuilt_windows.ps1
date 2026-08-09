$ErrorActionPreference = 'Stop'
$HostName = 'com.douyin.hd_pro'
$ExtensionId = 'kfegbbjedamdmoiaomeaaopdeeeeedkm'
$NativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $NativeDir
$ExtensionDir = Join-Path $RootDir 'extension'
$InstallDir = Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
$SourceExe = Join-Path $NativeDir 'bin\douyin_hd_native.exe'

Set-Location -LiteralPath $NativeDir
Write-Host ''
Write-Host '=== Douyin HD Pro - Cai dat Native Helper ===' -ForegroundColor Cyan

if (-not (Test-Path $SourceExe)) {
    throw 'Khong tim thay native\bin\douyin_hd_native.exe. Hay dung goi Windows Full trong Releases, hoac chay install_windows.bat de build tu source.'
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $SourceExe (Join-Path $InstallDir 'douyin_hd_native.exe') -Force
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
Write-Host 'CAI DAT THANH CONG.' -ForegroundColor Green
Write-Host "Extension ID: $ExtensionId"
Write-Host "Thu muc Extension: $ExtensionDir" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Chrome -> chrome://extensions -> Developer mode -> Load unpacked -> chon thu muc extension.' -ForegroundColor Yellow
try { Start-Process 'chrome.exe' 'chrome://extensions/' } catch {}
Read-Host 'Nhan Enter de dong'
