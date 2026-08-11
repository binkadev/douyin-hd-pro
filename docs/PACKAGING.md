# Build & Packaging

Douyin HD Pro tách source và artifact để repository không lưu EXE build sẵn trong lịch sử Git.

## Artifact Release

### Windows Full

Gói khuyên dùng cho Windows 10/11:

```text
Douyin-HD-Pro-vX.Y.Z-Windows-Full.zip
```

Bao gồm `extension/`, `native/`, Native Helper EXE do CI build, `CAI-DAT-WINDOWS.bat`, hướng dẫn, README và LICENSE. Cache Python (`__pycache__`, `.pyc`, `.pyo`) được loại khỏi artifact.

### Extension Only

```text
Douyin-HD-Pro-vX.Y.Z-Extension-Only.zip
```

Dùng khi chỉ cần Chrome Extension/Chrome download fallback.

### Source

```text
Douyin-HD-Pro-vX.Y.Z-Source.zip
```

Gói source loại binary build sẵn, build directory và Python cache để dễ audit.

### Native Helper

```text
douyin_hd_native.exe
```

Binary được PyInstaller build trên `windows-latest`.

### Checksum

`SHA256SUMS.txt` chứa SHA-256 của các artifact Release.

## Build trên máy

```powershell
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath native/bin native/host_v104.py
.\scripts\package_release.ps1 -Version 1.0.4
```

## GitHub Actions

- `.github/workflows/ci.yml`: kiểm tra Python, toàn bộ background module, UI JS, manifest/version và đúng 10 locale.
- `.github/workflows/release.yml`: build Native Helper, đóng gói artifact, tạo checksum và phát hành GitHub Release.

Executable chưa có Code Signing certificate thương mại có thể kích hoạt SmartScreen reputation warning. Source và workflow build được công khai để người dùng tự kiểm tra.
