# Changelog

## 1.1.0

- Làm lại onboarding thành **màn hình riêng** trong popup, loại bỏ lỗi crop/overflow của modal lần đầu.
- Chuẩn hóa font hiển thị tiếng Việt bằng `Segoe UI Variable Text`, `Segoe UI`, `system-ui`, `Noto Sans`; tăng cỡ chữ và độ tương phản.
- Thêm **thư mục lưu tùy chỉnh** qua Native Helper; đường dẫn hiện tại + nút **Thay đổi** luôn hiển thị ở giao diện chính.
- Mỗi video có **phiên stream riêng**; danh sách stream cũ không được dùng lại khi chuyển video.
- Thêm chế độ đổi video `auto`: reset luồng cũ và tự bắt luồng mới.
- Thêm chế độ đổi video `manual`: reset luồng cũ, dừng capture và yêu cầu bấm **Bắt luồng** cho video mới.
- Sau khi tải xong, phiên hiện tại chuyển trạng thái **Đã xong**; có nút **Đặt lại** để bắt lại từ đầu.
- Theo dõi video mới trên Douyin SPA bằng URL + media signature, có session epoch để bỏ response cũ sau reset.
- Native Helper v1.1.0 thêm `get_settings`, `choose_folder`, `set_save_folder` và phản hồi thao tác bằng `requestId`.
- Sửa **Mở video / Mở thư mục**: UI chỉ báo thành công khi Native Helper xác nhận thao tác thật.
- Duy trì 10 ngôn ngữ runtime, Tiếng Việt mặc định; các màn mới có fallback tiếng Anh và bản địa hóa các nhãn chính.

## 1.0.3

- Thiết kế lại popup với UX tải xuống đầy đủ.
- Hiển thị phần trăm, dung lượng, tốc độ và ETA theo thời gian thực.
- Thêm Mở video / Mở thư mục / Sao chép đường dẫn sau khi tải xong.
- Thêm hệ thống i18n thủ công với 10 ngôn ngữ, mặc định Tiếng Việt.
- Thêm `_locales` để Chrome bản địa hóa tên và mô tả Extension.
- Đồng bộ lựa chọn ngôn ngữ bằng `chrome.storage.sync`.
- Giữ trạng thái download trong background để popup mở lại vẫn thấy tiến trình gần nhất.
- Theo dõi download ở Chrome fallback.
- Native Helper thêm `speedBps`, `etaSeconds`, `open_file`, `open_folder`.
- Giới hạn lệnh mở file chỉ trong `Downloads\DouyinHD`.
- Thêm gói cài nhanh Windows và tài liệu tiếng Việt.
- Tối ưu Source.zip, loại binary/build không cần thiết.
- Thêm CI kiểm tra đủ 10 locale và đồng bộ version.

## 1.0.2

- Sửa lỗi `Receiving end does not exist` khi gửi message tới tab không có content script.
- Sửa installer với PyInstaller 6.22+ khi working directory là `System32`.
- Chuẩn hóa repo, GitHub Actions và Release artifacts.
