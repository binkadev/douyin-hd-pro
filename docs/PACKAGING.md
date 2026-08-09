# Build & Packaging

Douyin HD Pro tách source và artifact để repository không phải lưu EXE build sẵn trong lịch sử Git.

## Gói Extension Only

Dành cho người chỉ cần phần Chrome Extension hoặc muốn dùng Chrome Downloads fallback.

```text
Douyin-HD-Pro-vX.Y.Z-Extension-Only.zip
```

## Gói Windows Full

Bao gồm:

- `extension/`;
- `native/`;
- `native/bin/douyin_hd_native.exe` do CI build;
- README.

```text
Douyin-HD-Pro-vX.Y.Z-Windows-Full.zip
```

## Source Archive

Source sạch theo commit hiện tại:

```text
Douyin-HD-Pro-vX.Y.Z-Source.zip
```

## Native Helper EXE

PyInstaller tạo:

```text
douyin_hd_native.exe
```

Executable chưa ký Code Signing có thể kích hoạt SmartScreen reputation warning. SHA-256 được phát hành kèm để kiểm tra tính toàn vẹn của artifact.

## Build trên máy

```powershell
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native --distpath native/bin native/host.py
.\scripts\package_release.ps1 -Version 1.0.2
```

## GitHub Actions

Workflow `.github/workflows/release.yml` chạy trên `windows-latest`, build helper, đóng gói và tạo Release khi chạy thủ công hoặc khi có tag `v*`.

Workflow `.github/workflows/ci.yml` kiểm tra syntax JavaScript, manifest JSON và Python trên push/PR.
