# Changelog

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
