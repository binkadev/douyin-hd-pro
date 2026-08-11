# Changelog

## 2.0.0 — 2026-08-11

### Added
- Active video detector cho Douyin SPA/feed.
- Current video card với thumbnail/title/author/video ID.
- State machine theo từng video.
- Native download queue giới hạn 2 tác vụ song song + activity tab.
- Local history + duplicate detection.
- Quality profiles: best/1080/720/smallest/ask.
- Custom filename/subfolder templates.
- Native file verification bằng FFprobe/basic container check.
- Diagnostics + copy report, update checker, export/import settings.
- Floating button customization.
- Presets cho cá nhân/content/research/advanced.
- History privacy toggle.

### Changed
- Popup được thiết kế lại hoàn toàn với font hệ thống tối ưu tiếng Việt.
- Stream list không còn hiển thị điểm ranking nội bộ.
- Video switching reset session theo video key và epoch.
- Native Helper nâng lên v2.0.0, version compatibility check, destination subfolder an toàn và queue concurrency.

### Reliability
- Thêm unit/smoke test cho Native Helper và background logic.
- Prune runtime download state và cleanup session khi tab đóng.
- Cảnh báo Native Helper cũ/không tương thích.

### Security / Privacy
- Update checker chỉ gọi GitHub API khi người dùng bấm kiểm tra.
- Folder con bị sanitize và bắt buộc nằm trong root folder đã whitelist.
- Không vượt DRM/encryption.
