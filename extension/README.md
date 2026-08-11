# Chrome Extension

Phần trình duyệt của Douyin HD Pro v1.0.4 sử dụng Chrome Manifest V3.

## Cấu trúc

- `manifest.json`: quyền, locale, content script và service worker.
- `background.js`: loader của background service worker.
- `background/core.js`: phát hiện/chấm điểm media candidate và quét JSON/DOM/Performance.
- `background/capture.js`: Chrome Debugger/CDP, Network events và Native Messaging.
- `background/download.js`: tải BEST/từng candidate, Chrome fallback và trạng thái tiến trình.
- `i18n.js`: từ điển runtime 10 ngôn ngữ; mặc định Tiếng Việt.
- `_locales/`: metadata bản địa hóa cho Chrome Extension.
- `content.js`: nút **↓ Tải HD** trên Douyin.
- `popup.*`: giao diện chọn luồng, đổi ngôn ngữ, progress, tốc độ, ETA, mở file/thư mục.

## Quyền

- `debugger`: dùng Chrome DevTools Protocol khi người dùng chủ động bắt luồng.
- `nativeMessaging`: giao tác vụ tải với Native Helper cục bộ.
- `downloads`: Chrome fallback và thao tác với file fallback.
- `storage`: lưu ngôn ngữ bằng `chrome.storage.sync`.
- `scripting`, `activeTab`, `tabs`: đọc metadata và quản lý đúng tab Douyin.

## Phát triển

1. Mở `chrome://extensions`.
2. Bật **Chế độ dành cho nhà phát triển**.
3. Chọn **Tải tiện ích đã giải nén** và trỏ tới `extension/`.
4. Sau thay đổi service worker/manifest, bấm **Reload** Extension.
5. Reload tab Douyin trước khi test content script.

Kiểm tra nhanh:

```bash
node --check background.js
node --check background/core.js
node --check background/capture.js
node --check background/download.js
node --check i18n.js
node --check content.js
node --check popup.js
```

Không đưa cookie, token, signed media URL hoặc request header nhạy cảm vào issue/log công khai.


## Trải nghiệm v1.0.4

- Lần đầu mở sẽ có trình thiết lập bằng tiếng Việt để hỏi ngôn ngữ, tự bắt luồng, hành động sau tải và cách đặt tên file.
- Mặc định sau khi tải xong sẽ hỏi người dùng muốn **Mở video**, **Mở thư mục** hay chỉ sao chép đường dẫn.
- `i18n-v104.js` mở rộng từ điển cho các màn hình/thiết lập mới mà vẫn giữ 10 ngôn ngữ hiện có.
- Các nút mở file/thư mục đợi phản hồi thật từ Native Helper và hiển thị toast thành công/thất bại.
