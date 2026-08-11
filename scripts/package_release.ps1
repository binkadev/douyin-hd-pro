param([string]$Version = '1.1.0')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'release'
$Temp = Join-Path $env:TEMP "DouyinHDProRelease-$Version"
Remove-Item $Out -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Out,$Temp | Out-Null

function Zip-Folder($Source,$Destination){ Compress-Archive -Path (Join-Path $Source '*') -DestinationPath $Destination -CompressionLevel Optimal -Force }
function Remove-BuildJunk($Path){
    Get-ChildItem $Path -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.pyc','.pyo') } | Remove-Item -Force -ErrorAction SilentlyContinue
}

# 1) Extension-only
$ExtTemp=Join-Path $Temp 'extension'
Copy-Item (Join-Path $Root 'extension') $ExtTemp -Recurse
Zip-Folder $ExtTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Extension-Only.zip")

# 2) Windows Full - gói khuyên dùng
$FullTemp=Join-Path $Temp 'windows-full'
New-Item -ItemType Directory -Force -Path $FullTemp | Out-Null
Copy-Item (Join-Path $Root 'extension') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'native') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'README.md') $FullTemp
Copy-Item (Join-Path $Root 'HUONG-DAN.md') $FullTemp
Copy-Item (Join-Path $Root 'CAI-DAT-WINDOWS.bat') $FullTemp
Copy-Item (Join-Path $Root 'LICENSE') $FullTemp
Remove-BuildJunk $FullTemp
if (Test-Path (Join-Path $Root 'native\bin\douyin_hd_native.exe')) { Zip-Folder $FullTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Windows-Full.zip") }

# 3) Source - loại binary/build/cache để gói nhẹ và dễ audit
$SourceTemp=Join-Path $Temp 'source'
New-Item -ItemType Directory -Force -Path $SourceTemp | Out-Null
$exclude=@('.git','release','build')
Get-ChildItem $Root -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object { Copy-Item $_.FullName $SourceTemp -Recurse -Force }
Remove-Item (Join-Path $SourceTemp 'native\bin\douyin_hd_native.exe') -Force -ErrorAction SilentlyContinue
Remove-BuildJunk $SourceTemp
Zip-Folder $SourceTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Source.zip")

Get-ChildItem $Out -File | Sort-Object Name | ForEach-Object { $h=Get-FileHash $_.FullName -Algorithm SHA256; "$($h.Hash.ToLower())  $($_.Name)" } | Set-Content (Join-Path $Out 'SHA256SUMS.txt') -Encoding ascii
Write-Host "Đã đóng gói artifact tại: $Out" -ForegroundColor Green
