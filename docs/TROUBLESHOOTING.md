# Khắc phục sự cố

## Không thấy nút tải nổi

1. Kiểm tra Extension đang bật.
2. Trong **Cài đặt → Nút tải nổi**, đảm bảo không chọn **Ẩn hoàn toàn**.
3. Reload tab Douyin bằng `Ctrl + Shift + R`.

## Tool chưa nhận đúng video

- Cho video hiện tại nằm rõ trong viewport và phát 1–3 giây.
- Bấm **Đặt lại** nếu vừa scroll rất nhanh.
- Nếu chọn chế độ thủ công, bấm **Bắt luồng** sau khi chuyển video.

Mỗi video là một session riêng; khi context đổi, stream cũ bị reset.

## Không có luồng / không có chất lượng

- Bấm **Bắt luồng**.
- Phát video 2–3 giây.
- Nếu vẫn trống, thử pause/play hoặc reload trang.
- Dùng **Cài đặt → Kiểm tra hệ thống** và sao chép báo cáo chẩn đoán khi cần gửi issue.

## Native Helper chưa kết nối hoặc khác phiên bản

Chạy lại trong gói Windows Full:

```bat
CAI-DAT-WINDOWS.bat
```

Sau đó đóng/mở Chrome hoặc Reload Extension. Extension v2 yêu cầu Native Helper major version 2.x; Helper cũ sẽ không được dùng cho custom folder/native download.

Registry:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.douyin.hd_pro
```

Extension ID:

```text
kfegbbjedamdmoiaomeaaopdeeeeedkm
```

## Tải xong nhưng không biết file ở đâu

Màn hình **Hiện tại** luôn hiển thị **Lưu vào** và nút **Thay đổi**. Sau tải có **Mở video**, **Mở thư mục**, **Sao chép đường dẫn**.

Nếu Native Helper không sẵn sàng, Chrome fallback lưu dưới `Downloads/DouyinHD` vì Chrome không cho Extension ghi vào đường dẫn tuyệt đối tùy ý.

## Nút Mở video / Mở thư mục lỗi

- File có thể đã bị di chuyển/xóa.
- Folder có thể không còn quyền truy cập.
- Native Helper phải cùng major version với Extension.

Các nút này chờ phản hồi thật từ Helper; lỗi được hiển thị thay vì báo thành công giả.

## File tải xong nhưng cảnh báo “chưa xác minh đầy đủ”

Native Helper luôn chạy basic verification. Cài `ffprobe` vào PATH (thường đi kèm FFmpeg) để kiểm tra stream, codec, duration và resolution chi tiết hơn.

## HLS ra `.ts`

Nếu nguồn là MPEG-TS và FFmpeg có trong PATH, Helper cố remux sang MP4 bằng stream copy. Không re-encode video.

## SmartScreen

Release EXE chưa có chứng thư Code Signing thương mại nên Windows có thể cảnh báo. Không cần tắt SmartScreen toàn hệ thống. Có thể chọn **More info → Run anyway** nếu bạn đã xác minh đúng Release/checksum, hoặc tự build bằng `native\install_windows.bat`.

## PyInstaller báo đang chạy từ `System32`

Không chạy installer bằng **Run as administrator** nếu không cần. Script hiện tự đổi working directory về thư mục source trước khi build.
