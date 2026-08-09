# Khắc phục sự cố

## Không thấy nút tải trên Douyin

- Kiểm tra Extension đang bật.
- Reload tab Douyin bằng `Ctrl + Shift + R`.
- Đảm bảo URL thuộc `douyin.com`.

## Danh sách luồng trống

- Bấm **Bắt luồng**.
- Cho video chạy 2–3 giây.
- Thử chuyển chất lượng/phát lại để trình duyệt tạo request media mới.

## Tải xong nhưng không thấy trong Chrome Downloads

Native Helper ghi trực tiếp vào:

```text
%USERPROFILE%\Downloads\DouyinHD
```

Mở `Win + R`, dán đường dẫn trên và Enter.

## `Receiving end does not exist`

Dùng v1.0.2 trở lên. Nếu vừa cập nhật Extension, bấm Reload trên `chrome://extensions` và reload tab Douyin.

## PyInstaller từ chối chạy trong System32

Dùng installer v1.0.2 trở lên. Script đã tự `Set-Location` về thư mục native/build.

## Native Helper không kết nối

1. Chạy lại installer.
2. Kiểm tra Extension ID là `kfegbbjedamdmoiaomeaaopdeeeeedkm`.
3. Đóng/mở lại Chrome.
4. Kiểm tra key:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.douyin.hd_pro
```

## SmartScreen

Release build sẵn có thể bị cảnh báo vì chưa có Code Signing certificate. Không cần tắt SmartScreen toàn hệ thống. Nếu muốn tránh binary build sẵn, dùng `native/install_windows.bat` để build từ source trực tiếp trên máy.

## HLS tải ra `.ts`

Cài FFmpeg vào PATH rồi thử lại nếu bạn muốn remux sang `.mp4`. Tool không re-encode, nên chất lượng hình ảnh không bị giảm bởi bước remux.
