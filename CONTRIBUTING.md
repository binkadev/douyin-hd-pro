# Đóng góp cho Douyin HD Pro

Cảm ơn bạn muốn cải thiện dự án.

## Nguyên tắc

- Không thêm cơ chế vượt DRM, giải mã nội dung được bảo vệ hoặc né kiểm soát truy cập.
- Không thêm telemetry/analytics nếu chưa có thảo luận rõ ràng.
- Không commit cookie, token, signed media URL hoặc dữ liệu cá nhân.
- Tiếng Việt là ngôn ngữ mặc định của sản phẩm; mọi chuỗi UI mới phải đi qua hệ thống i18n và có bản dịch cho 10 locale hiện có.
- Tên biến/code có thể dùng tiếng Anh để dễ bảo trì.

## Chạy Extension khi phát triển

1. Mở `chrome://extensions`.
2. Bật Developer mode.
3. Load unpacked thư mục `extension`.
4. Sau thay đổi background/manifest, bấm Reload Extension và reload tab Douyin.

## Kiểm tra

```bash
python -m py_compile native/host.py
node --check extension/background.js
node --check extension/background/core.js
node --check extension/background/capture.js
node --check extension/background/download.js
node --check extension/i18n.js
node --check extension/content.js
node --check extension/popup.js
```

## Build Native Helper

```powershell
native\install_windows.bat
```

## Pull Request

PR nên có mục tiêu thay đổi, cách kiểm thử, ảnh/video nếu thay UI và lưu ý tương thích Chrome MV3/Windows. Nếu thêm hoặc sửa text UI, cập nhật `extension/i18n.js`, `_locales` khi liên quan và tài liệu i18n.
