# Chính sách quyền riêng tư

Douyin HD Pro được thiết kế theo hướng **local-first** và không có backend do dự án vận hành.

## Dữ liệu được xử lý cục bộ

Khi người dùng bắt luồng/tải video, Extension có thể đọc URL request, metadata response và request header cần thiết của tab Douyin để xác định media stream. Dữ liệu này được xử lý trong Chrome và, khi dùng Native Helper, truyền qua Chrome Native Messaging tới tiến trình trên chính máy người dùng.

## Lịch sử tải

Lịch sử là tùy chọn. Khi bật, metadata như video ID, tiêu đề, tác giả, thumbnail, đường dẫn file, thời gian và quality được lưu trong `chrome.storage.local`. Người dùng có thể:

- tắt lưu lịch sử;
- xóa một mục;
- xóa toàn bộ lịch sử.

Khi tắt lịch sử, tính năng nhận diện video đã tải trước đó cũng không hoạt động.

## Settings và thư mục lưu

Settings giao diện được lưu bằng Chrome Storage. Native Helper lưu folder người dùng đã chọn vào cấu hình cục bộ của user Windows để có thể mở file/thư mục an toàn.

## Kết nối mạng ngoài Douyin

Update checker chỉ gọi GitHub API khi người dùng chủ động bấm **Kiểm tra cập nhật**. Không có analytics, tracking pixel, quảng cáo hoặc telemetry nền.

## Dữ liệu dự án không thu thập

Source chính thức không gửi lịch sử duyệt web, lịch sử tải, cookie, token hoặc nội dung file tải tới máy chủ của tác giả dự án.

Chính sách này áp dụng cho source/release chính thức. Fork hoặc binary bên thứ ba cần được audit độc lập.
