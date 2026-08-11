# Khắc phục sự cố

## Không thấy nút tải trên Douyin

- Kiểm tra Extension đang bật.
- Reload tab bằng `Ctrl + Shift + R`.
- Đảm bảo URL thuộc `douyin.com`.

## Danh sách luồng trống

- Bấm **Bắt luồng**.
- Cho video chạy 2–3 giây.
- Thử phát lại hoặc chuyển chất lượng để trình duyệt tạo request media mới.

## Tải xong nhưng không thấy file

Native Helper lưu trực tiếp vào:

```text
%USERPROFILE%\Downloads\DouyinHD
```

Từ v1.0.3, popup có nút **Mở video** và **Mở thư mục** sau khi tải hoàn tất.

## `Receiving end does not exist`

Bản v1.0.2+ đã tránh gửi message tới tab không có content script. Nếu vừa cập nhật Extension, bấm **Reload** ở `chrome://extensions` rồi reload tab Douyin.

## PyInstaller từ chối chạy trong `System32`

Installer v1.0.2+ tự chuyển working directory về thư mục build. Không chạy file BAT bằng **Run as administrator** nếu không cần thiết.

## Native Helper không kết nối

1. Chạy `CAI-DAT-WINDOWS.bat` trong gói Windows Full.
2. Kiểm tra Extension ID: `kfegbbjedamdmoiaomeaaopdeeeeedkm`.
3. Đóng/mở lại Chrome.
4. Kiểm tra registry:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.douyin.hd_pro
```

## SmartScreen

Binary Release được build bằng GitHub Actions nhưng chưa có Code Signing certificate thương mại nên Windows có thể hiển thị cảnh báo reputation. Không cần tắt SmartScreen toàn hệ thống. Nếu muốn tự audit/build, dùng `native\install_windows.bat`.

## HLS tải ra `.ts`

Nếu stream là MPEG-TS, cài FFmpeg vào PATH để helper remux sang `.mp4`. Bước remux dùng stream copy, không re-encode.

## Đổi ngôn ngữ

Mở popup Extension và chọn ngôn ngữ ở góc trên bên phải. Lựa chọn được đồng bộ qua `chrome.storage.sync`. Mặc định là Tiếng Việt.


## Nút Mở video / Mở thư mục không phản hồi

Từ v1.0.4, các nút này dùng request ID và chờ phản hồi trực tiếp từ Native Helper. Nếu thao tác thất bại, popup sẽ hiển thị lỗi thay vì báo thành công giả.

Kiểm tra:

1. Chấm trạng thái Native Helper phải màu xanh.
2. File phải nằm trong `%USERPROFILE%\Downloads\DouyinHD`.
3. Nếu vừa nâng cấp, hãy chạy lại `CAI-DAT-WINDOWS.bat` để Native Helper cũng lên đúng v1.0.4.
