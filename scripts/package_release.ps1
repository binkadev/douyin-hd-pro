param([string]$Version = '1.0.3')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'release'
$Temp = Join-Path $env:TEMP "DouyinHDProRelease-$Version"
Remove-Item $Out -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Out,$Temp | Out-Null

function Zip-Folder($Source,$Destination){ Compress-Archive -Path (Join-Path $Source '*') -DestinationPath $Destination -CompressionLevel Optimal -Force }

$ExtTemp=Join-Path $Temp 'extension'
Copy-Item (Join-Path $Root 'extension') $ExtTemp -Recurse
Zip-Folder $ExtTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Extension-Only.zip")

$FullTemp=Join-Path $Temp 'windows-full'
New-Item -ItemType Directory -Force -Path $FullTemp | Out-Null
Copy-Item (Join-Path $Root 'extension') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'native') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'README.md') $FullTemp
Copy-Item (Join-Path $Root 'HUONG-DAN.md') $FullTemp
Copy-Item (Join-Path $Root 'CAI-DAT-WINDOWS.bat') $FullTemp
Copy-Item (Join-Path $Root 'LICENSE') $FullTemp
if (Test-Path (Join-Path $Root 'native\bin\douyin_hd_native.exe')) { Zip-Folder $FullTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Windows-Full.zip") }

$SourceTemp=Join-Path $Temp 'source'
New-Item -ItemType Directory -Force -Path $SourceTemp | Out-Null
$exclude=@('.git','release','build')
Get-ChildItem $Root -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object { Copy-Item $_.FullName $SourceTemp -Recurse -Force }
Remove-Item (Join-Path $SourceTemp 'native\bin\douyin_hd_native.exe') -Force -ErrorAction SilentlyContinue
Zip-Folder $SourceTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Source.zip")

Get-ChildItem $Out -File | Sort-Object Name | ForEach-Object { $h=Get-FileHash $_.FullName -Algorithm SHA256; "$($h.Hash.ToLower())  $($_.Name)" } | Set-Content (Join-Path $Out 'SHA256SUMS.txt') -Encoding ascii
Write-Host "Đã đóng gói artifact tại: $Out" -ForegroundColor Green
