param([string]$Version = '1.0.2')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'release'
$Temp = Join-Path $env:TEMP "DouyinHDProRelease-$Version"
Remove-Item $Out -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Out,$Temp | Out-Null

function Zip-Folder($Source, $Destination) {
    Compress-Archive -Path (Join-Path $Source '*') -DestinationPath $Destination -CompressionLevel Optimal -Force
}

# Extension-only
$ExtTemp = Join-Path $Temp 'extension'
Copy-Item (Join-Path $Root 'extension') $ExtTemp -Recurse
Zip-Folder $ExtTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Extension-Only.zip")

# Windows full: requires prebuilt native/bin/douyin_hd_native.exe
$FullTemp = Join-Path $Temp 'windows-full'
New-Item -ItemType Directory -Force -Path $FullTemp | Out-Null
Copy-Item (Join-Path $Root 'extension') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'native') $FullTemp -Recurse
Copy-Item (Join-Path $Root 'README.md') $FullTemp
Copy-Item (Join-Path $Root 'LICENSE') $FullTemp
if (Test-Path (Join-Path $Root 'native\bin\douyin_hd_native.exe')) {
    Zip-Folder $FullTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Windows-Full.zip")
}

# Source package (exclude .git/release)
$SourceTemp = Join-Path $Temp 'source'
New-Item -ItemType Directory -Force -Path $SourceTemp | Out-Null
Get-ChildItem $Root -Force | Where-Object { $_.Name -notin @('.git','release') } | ForEach-Object { Copy-Item $_.FullName $SourceTemp -Recurse -Force }
Zip-Folder $SourceTemp (Join-Path $Out "Douyin-HD-Pro-v$Version-Source.zip")

# SHA256
Get-ChildItem $Out -File | Sort-Object Name | ForEach-Object {
    $h = Get-FileHash $_.FullName -Algorithm SHA256
    "$($h.Hash.ToLower())  $($_.Name)"
} | Set-Content (Join-Path $Out 'SHA256SUMS.txt') -Encoding ascii
Write-Host "Artifacts: $Out" -ForegroundColor Green
