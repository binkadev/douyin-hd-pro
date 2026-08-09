# Đóng góp cho Douyin HD Pro

Cảm ơn bạn muốn cải thiện dự án.

## Nguyên tắc

- Không thêm cơ chế vượt DRM, giải mã nội dung được bảo vệ hoặc né kiểm soát truy cập.
- Không thêm telemetry/analytics nếu chưa có thảo luận rõ ràng.
- Không commit cookie, token, request URL có chữ ký hoặc dữ liệu cá nhân.
- Giữ UI tiếng Việt rõ ràng; tên biến/code có thể dùng tiếng Anh để dễ bảo trì.

## Chạy Extension khi phát triển

1. Mở `chrome://extensions`.
2. Bật Developer mode.
3. Load unpacked thư mục `extension`.
4. Sau mỗi thay đổi background/manifest, bấm Reload Extension.

## Build Native Helper

```powershell
cd native
.\install_windows.bat
```

Hoặc build thủ công:

```powershell
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --clean --onefile --name douyin_hd_native native\host.py
```

## Pull Request

PR nên có:

- mục tiêu thay đổi;
- cách kiểm thử;
- ảnh/video nếu thay UI;
- lưu ý tương thích với Chrome MV3 và Windows.
