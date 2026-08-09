$ErrorActionPreference='SilentlyContinue'
reg.exe DELETE "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.douyin.hd_pro" /f | Out-Null
Remove-Item (Join-Path $env:LOCALAPPDATA 'DouyinHDPro') -Recurse -Force
Write-Host 'Da go Native Helper Douyin HD Pro.' -ForegroundColor Green
Read-Host 'Nhan Enter de dong'
