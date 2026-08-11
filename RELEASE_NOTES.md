## Douyin HD Pro v1.1.0

v1.1.0 là bản nâng cấp lớn về **quy trình sử dụng**, tập trung vào việc mỗi video là một phiên riêng biệt, tránh giữ nhầm luồng của video trước và cho người dùng kiểm soát rõ nơi lưu file.

### Điểm mới chính

- Onboarding lần đầu được làm lại thành **màn hình riêng**, không dùng modal cố định nên không còn lỗi cắt giao diện popup.
- Giao diện mặc định dùng font hệ thống tối ưu cho tiếng Việt: **Segoe UI Variable / Segoe UI / system-ui / Noto Sans**.
- Tăng kích thước chữ, khoảng cách và độ tương phản để tiếng Việt dễ đọc hơn.
- Thêm **Chọn thư mục** ngay trong thiết lập đầu tiên và nút **Thay đổi** luôn xuất hiện ở giao diện chính cạnh đường dẫn lưu.
- Native Helper lưu thư mục đã chọn trên máy và mọi video sau đó được tải vào đúng thư mục đó.
- Hai chế độ khi chuyển video:
  - **Tự động — Khuyên dùng:** reset toàn bộ luồng cũ và tự bắt luồng video mới.
  - **Thủ công:** reset luồng cũ, dừng capture và yêu cầu người dùng bấm **Bắt luồng** cho video mới.
- Sau khi một video tải xong, phiên video được đánh dấu **Đã xong**. Khi chuyển video, trạng thái và danh sách stream cũ được loại bỏ.
- Thêm nút **Đặt lại** để xóa phiên hiện tại và bắt lại từ đầu.
- Theo dõi thay đổi video trên trang Douyin SPA bằng URL + media signature, không phụ thuộc việc reload trang.
- Bảo vệ khỏi response cũ quay lại sau khi reset bằng session epoch.
- Sửa hoàn chỉnh giao thức Native Helper: mọi thao tác **Mở video / Mở thư mục / Chọn thư mục** đều có `requestId` và phản hồi thật.
- Thư mục tùy chỉnh được ghi nhớ cục bộ; các thư mục đã chọn được whitelist để thao tác mở file an toàn.
- Giữ đủ 10 ngôn ngữ: Tiếng Việt, English, 简体中文, 繁體中文, 한국어, 日本語, ไทย, Bahasa Indonesia, Español, Français.

### Gói khuyên dùng

- **Douyin-HD-Pro-v1.1.0-Windows-Full.zip** — đầy đủ Extension + Native Helper cho Windows 10/11.
- **Extension-Only.zip** — chỉ Chrome Extension, không hỗ trợ chọn thư mục tùy ý khi Native Helper không có.
- **Source.zip** — source sạch để audit/build.
- **douyin_hd_native.exe** — Native Helper độc lập.
- **SHA256SUMS.txt** — checksum SHA-256.

> Native Helper chưa có chứng thư Code Signing thương mại nên Windows SmartScreen có thể cảnh báo reputation. Source và workflow build đều công khai.
