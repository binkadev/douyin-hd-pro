# Kiến trúc kỹ thuật

## 1. Chrome Extension

Service worker được tách thành các module classic thông qua `importScripts`:

- `extension/background/core.js`: quản lý session/candidate, quét media từ Network, JSON/API, DOM, Performance Resource Timing và hydration data.
- `extension/background/capture.js`: attach Chrome Debugger, bật CDP Network/Runtime, tiếp nhận sự kiện request/response và kết nối Native Messaging.
- `extension/background/download.js`: chọn BEST/từng candidate, theo dõi Native/Chrome fallback, giữ trạng thái tải gần nhất và xử lý Mở file/Mở thư mục.

Ứng viên được hợp nhất theo URL và chấm điểm từ MIME, độ phân giải, bitrate, dung lượng, CDN/quality hint và metadata nguồn.

## 2. Content Script

`extension/content.js` cung cấp nút **↓ Tải HD** trên Douyin, nhận progress event và hiển thị toast theo ngôn ngữ người dùng.

## 3. Popup + i18n

`extension/popup.*` hiển thị candidate, BEST, trạng thái Native Helper, phần trăm, dung lượng, tốc độ, ETA và hành động sau khi tải xong.

`extension/i18n.js` cung cấp runtime dictionary 10 ngôn ngữ; lựa chọn được lưu bằng `chrome.storage.sync`. `_locales` bản địa hóa metadata Extension.

## 4. Native Messaging

Native Host: `com.douyin.hd_pro`.

Extension gửi URL/header cần thiết sang `native/host.py`. Host chuẩn hóa header, chọn direct/HLS, tải file vào `Downloads\DouyinHD` và gửi progress về Extension.

## 5. HTTP Range

Nếu CDN trả `206 Partial Content` với tổng kích thước hợp lệ, downloader chia file thành nhiều range và tải song song. Số worker tối đa 16 và được điều chỉnh theo CPU/kích thước file. Nếu CDN quảng cáo Range nhưng không ổn định, helper tự fallback về tải tuần tự.

## 6. HLS

Với `.m3u8`, helper chọn variant theo resolution/bandwidth rồi tải segment song song. Nếu output là MPEG-TS và FFmpeg có trong PATH, tool remux sang MP4 mà không re-encode.

Luồng HLS mã hóa được từ chối; dự án không triển khai cơ chế vượt DRM/mã hóa.

## 7. Ranh giới bảo mật

- Host permission giới hạn cho `douyin.com`.
- Native Messaging manifest chỉ cho phép Extension ID cố định.
- `open_file` / `open_folder` chỉ được mở đường dẫn bên trong `Downloads\DouyinHD`.
- Không có backend dự án nhận URL media/cookie/token.
