# Chính sách quyền riêng tư

Douyin HD Pro được thiết kế theo hướng **local-first**.

## Dữ liệu được xử lý

Khi người dùng chủ động bắt/tải video, Extension có thể đọc URL request, response metadata và một số request headers của tab Douyin hiện tại nhằm xác định luồng video và tải file. Các dữ liệu này được xử lý cục bộ trong Chrome và, khi dùng Native Helper, được gửi qua Chrome Native Messaging tới tiến trình cục bộ trên chính máy người dùng.

## Dữ liệu không được thu thập bởi dự án

Dự án không triển khai analytics, telemetry, tracking pixel, tài khoản người dùng hoặc máy chủ trung gian để lưu lịch sử tải. Source hiện tại không gửi lịch sử duyệt web hoặc nội dung video đến máy chủ của tác giả dự án.

## File tải xuống

Native Helper lưu file mặc định tại `Downloads\DouyinHD`. Việc quản lý, sao lưu và xóa các file này thuộc quyền kiểm soát của người dùng.

## Phạm vi

Chính sách này áp dụng cho source code trong repository chính thức. Nếu bạn sử dụng fork hoặc bản chỉnh sửa từ bên thứ ba, hãy tự kiểm tra source và chính sách của bản đó.
