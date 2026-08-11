## Douyin HD Pro v1.0.4

Bản v1.0.4 tập trung vào **UX thực tế và độ tin cậy của các nút thao tác**.

### Điểm mới

- Màn hình thiết lập lần đầu bằng **Tiếng Việt**.
- Hỏi người dùng cách muốn công cụ hoạt động: tự bắt luồng, hành động sau tải và cách đặt tên file.
- Mặc định sau khi tải xong sẽ hỏi: **Mở video / Mở thư mục / Sao chép đường dẫn**.
- Nút **Mở video** và **Mở thư mục** giờ chờ phản hồi thật từ Native Helper, có timeout và báo lỗi rõ ràng.
- **Sao chép đường dẫn** có Clipboard API + fallback để tăng độ tương thích.
- Có toast phản hồi cho mọi thao tác, không còn trường hợp bấm nút mà không biết có chạy hay không.
- Tùy chọn tự mở video hoặc thư mục sau khi tải xong.
- 3 kiểu đặt tên file: `Tác giả - Tiêu đề`, `Chỉ tiêu đề`, `Ngày - Tiêu đề`.
- Vẫn hỗ trợ 10 ngôn ngữ: Tiếng Việt, English, 简体中文, 繁體中文, 한국어, 日本語, ไทย, Bahasa Indonesia, Español, Français.

### Gói khuyên dùng

- **Douyin-HD-Pro-v1.0.4-Windows-Full.zip**: bản đầy đủ cho Windows 10/11.
- **Extension-Only.zip**: chỉ Chrome Extension.
- **Source.zip**: source sạch để audit/build.
- **douyin_hd_native.exe**: Native Helper độc lập.
- **SHA256SUMS.txt**: checksum SHA-256.

> Native Helper chưa có Code Signing certificate thương mại nên Windows SmartScreen có thể cảnh báo reputation. Source và workflow build được công khai để kiểm tra.
