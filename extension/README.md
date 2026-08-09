# Chrome Extension

Phần extension của Douyin HD Pro dùng Chrome Manifest V3.

## File chính

- `manifest.json`: quyền, content script và service worker.
- `background.js`: Chrome Debugger/Network, candidate scoring, Native Messaging, download fallback.
- `content.js`: quét media đã xuất hiện trong DOM/Performance data của trang Douyin.
- `popup.html`, `popup.css`, `popup.js`: giao diện tiếng Việt.

## Quyền

### `debugger`

Dùng Chrome DevTools Protocol để theo dõi network của tab Douyin khi người dùng chủ động bấm **Bắt luồng**.

### `nativeMessaging`

Gửi tác vụ tải sang Native Helper cục bộ.

### `downloads`

Fallback cho MP4 trực tiếp khi Native Helper không khả dụng.

### `storage`, `tabs`

Dùng cho trạng thái extension và xác định tab Douyin đang hoạt động.

## Development

1. Mở `chrome://extensions`.
2. Bật Developer mode.
3. Chọn Load unpacked và trỏ tới thư mục `extension/`.
4. Sau mỗi thay đổi service worker/manifest, bấm Reload.
5. Reload tab Douyin trước khi test lại content script.

Không test bằng cách đăng cookie/token vào console công khai.
