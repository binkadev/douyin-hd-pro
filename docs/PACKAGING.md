# Build & Packaging

Repository không commit EXE build sẵn. Native Helper được GitHub Actions build trên `windows-latest`, sau đó đóng gói thành Release artifact.

## Artifact

- `Douyin-HD-Pro-vX.Y.Z-Windows-Full.zip`: gói khuyên dùng, gồm Extension + Native Helper EXE + installer + tài liệu.
- `Douyin-HD-Pro-vX.Y.Z-Extension-Only.zip`: chỉ Extension, dùng Chrome fallback nếu không có Helper.
- `Douyin-HD-Pro-vX.Y.Z-Source.zip`: source sạch, không EXE/cache/build output.
- `douyin_hd_native.exe`: Helper độc lập.
- `SHA256SUMS.txt`: checksum SHA-256 cho artifact.

## Build Native Helper trên Windows

```powershell
python -m pip install --upgrade pyinstaller
python -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath native/bin --workpath build/native --specpath build native/host.py
.\scripts\package_release.ps1 -Version 2.0.0
```

`host.py` import `host_core.py`; PyInstaller tự đưa module này vào bundle.

## Kiểm tra trước build

```bash
python -m py_compile native/host.py native/host_core.py
python -m unittest tests.test_native -v
node tests/test_background.js
node --check extension/background.js
node --check extension/background/core.js
node --check extension/background/capture.js
node --check extension/background/library.js
node --check extension/background/download.js
node --check extension/i18n.js
node --check extension/i18n-v200-vi.js
node --check extension/i18n-v200-en.js
node --check extension/i18n-v200-extra.js
node --check extension/content.js
node --check extension/popup-core.js
node --check extension/popup-actions.js
```

## GitHub Actions

- `ci.yml`: syntax, smoke test Native/background, manifest/version và 10 locale.
- `release.yml`: lặp lại validation, build EXE bằng PyInstaller, package, checksum và tạo GitHub Release.

Binary hiện chưa có Code Signing certificate thương mại, vì vậy SmartScreen có thể cảnh báo reputation. Người dùng có thể audit source/workflow hoặc tự build Helper.
