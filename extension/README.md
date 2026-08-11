# Chrome Extension

Chrome Extension của Douyin HD Pro v2.0.0 dùng Manifest V3.

## Cấu trúc

- `manifest.json`: permission, locale, service worker, content script.
- `background.js`: loader.
- `background/core.js`: session/candidate/media discovery.
- `background/capture.js`: CDP Network + Native Messaging + session isolation.
- `background/library.js`: history, preset, template, backup/update.
- `background/download.js`: quality policy, duplicate handling, download/activity/diagnostics.
- `i18n.js`: runtime i18n nền.
- `i18n-v200-vi.js`, `i18n-v200-en.js`, `i18n-v200-extra.js`: chuỗi UX v2 tách theo nhóm ngôn ngữ.
- `_locales/`: metadata 10 locale.
- `content.js` / `content.css`: nhận diện video active và nút tải nổi.
- `popup.*`: onboarding, Current/Activity/Settings.

## Luồng phiên video

```text
Video A → capture → download → complete
             ↓ chuyển video
Video B → reset state A → session mới → auto capture hoặc chờ người dùng
```

Session epoch chặn request/response cũ quay lại sau reset.

## Quyền chính

- `debugger`: CDP Network/Runtime cho tab Douyin.
- `nativeMessaging`: tải/verify/custom folder với Helper cục bộ.
- `downloads`: Chrome fallback.
- `storage`: settings/history.
- `scripting`, `activeTab`, `tabs`: metadata và đúng tab hiện tại.
- host permission `douyin.com`; `api.github.com` chỉ dùng khi người dùng bấm kiểm tra cập nhật.

## Test

```bash
node --check background.js
node --check background/core.js
node --check background/capture.js
node --check background/library.js
node --check background/download.js
node --check i18n.js
node --check i18n-v200-vi.js
node --check i18n-v200-en.js
node --check i18n-v200-extra.js
node --check content.js
node --check popup-core.js
node --check popup-actions.js
node ../tests/test_background.js
```

Không đăng công khai request headers/signed media URL khi debug.
