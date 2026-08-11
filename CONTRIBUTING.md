# Đóng góp cho Douyin HD Pro

Cảm ơn bạn muốn cải thiện dự án.

## Nguyên tắc

- Không thêm DRM bypass, giải mã nội dung được bảo vệ hoặc né kiểm soát truy cập.
- Không thêm telemetry/analytics mặc định nếu chưa có thiết kế privacy rõ ràng.
- Không commit cookie, token, signed media URL hoặc dữ liệu cá nhân.
- Tiếng Việt là ngôn ngữ mặc định. Chuỗi UI mới phải đi qua i18n.
- Giữ mỗi video là một session riêng; thay đổi capture/download không được làm candidate cũ lọt sang video mới.
- Các thao tác Native liên quan file/folder phải có validate đường dẫn và phản hồi `requestId`.

## Chạy Extension

1. `chrome://extensions`
2. Bật Developer mode.
3. Load unpacked thư mục `extension/`.
4. Sau thay đổi background/manifest, Reload Extension và reload tab Douyin.

## Test bắt buộc

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

## UI/i18n

- Không nhúng font binary; ưu tiên font hệ thống hỗ trợ Unicode/tiếng Việt.
- Khi thêm text, cập nhật Tiếng Việt + English và các locale còn lại khi có thể.
- UI popup phải dùng internal scroll, không dựa vào overlay fixed làm tăng kích thước popup.

## Pull Request

PR nên ghi rõ mục tiêu, rủi ro, cách test, ảnh/video nếu đổi UI và ảnh hưởng đến Chrome MV3/Native Helper. Thay đổi giao thức Native phải cập nhật version/tài liệu tương ứng.
