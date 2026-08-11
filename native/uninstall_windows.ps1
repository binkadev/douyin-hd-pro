$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new()
$HostName='com.douyin.hd_pro'
$InstallDir=Join-Path $env:LOCALAPPDATA 'DouyinHDPro'
Write-Host 'Đang gỡ Douyin HD Pro Native Helper...' -ForegroundColor Yellow
reg.exe DELETE "HKCU\Software\Google\Chrome\NativeMessagingHosts\$HostName" /f | Out-Null
Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Đã gỡ Native Helper. Bạn có thể xóa Extension tại chrome://extensions nếu không còn sử dụng.' -ForegroundColor Green
Read-Host 'Nhấn Enter để đóng'
