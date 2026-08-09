# Kiến trúc kỹ thuật

## 1. Chrome Extension

`extension/background.js` quản lý capture session theo tab, attach Chrome Debugger và bật các domain CDP cần thiết. Media candidate được thu thập từ:

- `Network.requestWillBeSent` / `Network.responseReceived`;
- JSON response phù hợp;
- DOM `<video>` / `<source>`;
- Performance Resource Timing;
- dữ liệu JSON/hydration có `url_list`, `play_addr`, `bit_rate`.

Ứng viên được hợp nhất theo URL và chấm điểm để xác định nguồn tốt nhất.

## 2. Content Script

`extension/content.js` cung cấp nút tải nhanh trên trang Douyin và nhận trạng thái từ background.

## 3. Popup

`extension/popup.*` hiển thị danh sách media candidate, trạng thái capture/native helper và cho phép tải bản BEST hoặc tải từng ứng viên.

## 4. Native Messaging

Native Host: `com.douyin.hd_pro`.

Extension gửi metadata download sang `native/host.py`. Host chuẩn hóa header, kiểm tra kiểu nguồn và thực hiện tải.

## 5. HTTP Range

Nếu server trả `206 Partial Content` cùng tổng kích thước hợp lệ, downloader chia file thành nhiều range và tải song song. Số worker được giới hạn tối đa 16 và điều chỉnh theo CPU/kích thước file.

## 6. HLS

Với `.m3u8`, Native Helper phân tích playlist, chọn variant phù hợp và tải segment. Nếu output là MPEG-TS và FFmpeg có trong PATH, tool có thể remux sang MP4 mà không re-encode.

## 7. Ranh giới bảo mật

- Extension chỉ được cấu hình host permission cho Douyin.
- Native Messaging manifest chỉ cho phép Extension ID cố định.
- Tool không triển khai logic vượt DRM.
