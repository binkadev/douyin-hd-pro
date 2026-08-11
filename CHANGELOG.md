# Changelog

## 1.0.4

- Thêm màn hình thiết lập lần đầu bằng tiếng Việt, cho phép chọn cách công cụ hoạt động trước khi sử dụng.
- Thêm cài đặt: tự bắt luồng khi mở popup, hành động sau khi tải xong và cách đặt tên file.
- Mặc định sau khi tải xong sẽ **hỏi người dùng** muốn Mở video / Mở thư mục / Sao chép đường dẫn.
- Sửa toàn bộ luồng nút Mở video / Mở thư mục để chờ phản hồi thực tế từ Native Helper thay vì trả thành công giả.
- Thêm request ID + timeout cho Native Messaging action, hiển thị lỗi rõ ràng nếu helper không phản hồi.
- Sửa Sao chép đường dẫn bằng Clipboard API + fallback `execCommand`, thêm quyền `clipboardWrite`.
- Thêm toast thành công/thất bại để mọi thao tác đều có phản hồi.
- Có thể tự mở video hoặc thư mục sau khi tải nếu người dùng chọn trong cài đặt.
- Hỗ trợ 3 kiểu đặt tên file: `Tác giả - Tiêu đề`, `Chỉ tiêu đề`, `Ngày - Tiêu đề`.
- Giữ đủ 10 ngôn ngữ; người dùng nâng cấp từ bản cũ sẽ thấy màn hình thiết lập đầu tiên bằng Tiếng Việt.

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
