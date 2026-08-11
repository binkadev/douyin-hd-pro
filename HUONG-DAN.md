# Hướng dẫn Douyin HD Pro v2.0.0

## Cài đặt

1. Giải nén `Douyin-HD-Pro-v2.0.0-Windows-Full.zip`.
2. Chạy `CAI-DAT-WINDOWS.bat` — không cần Administrator.
3. Vào `chrome://extensions` → bật **Chế độ dành cho nhà phát triển**.
4. Chọn **Tải tiện ích đã giải nén** → chọn thư mục `extension`.
5. Mở Douyin và tải video.

## Lần đầu mở

Tool hỏi:
- mục đích sử dụng;
- ngôn ngữ;
- thư mục lưu;
- tự động hay thủ công khi đổi video;
- chất lượng mặc định;
- hành động sau tải;
- có lưu lịch sử hay không.

## Chuyển video

**Tự động:** xóa stream cũ, tạo session mới; nếu đang capture thì phân tích video mới.

**Thủ công:** xóa stream cũ, dừng capture và chờ bấm **Bắt luồng**.

## Nếu video đã tải

Tool có thể hỏi bạn để:
- mở file cũ;
- tải lại;
- hoặc bỏ qua theo cài đặt.

## File lưu ở đâu?

Đường dẫn luôn xuất hiện ở màn hình chính. Bấm **Thay đổi** để chọn folder khác.

## Hàng đợi

Native Helper chạy tối đa 2 video cùng lúc. Nếu tải nhanh nhiều video, các video dư sẽ hiện **Đang chờ** trong tab **Hoạt động** và tự chạy khi có slot trống.

## Báo lỗi

Vào **Cài đặt → Kiểm tra hệ thống** → **Sao chép báo cáo chẩn đoán**. Gửi báo cáo cùng phần **Chi tiết kỹ thuật** nếu lỗi lặp lại.

Nếu Native Helper báo khác phiên bản với Extension, chạy lại `CAI-DAT-WINDOWS.bat`.
