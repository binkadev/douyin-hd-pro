(() => {
  if (window.__DYHD_PRO_LOADED__) return;
  window.__DYHD_PRO_LOADED__ = true;
  const btn = document.createElement('button');
  btn.id = 'dyhd-pro-btn';
  btn.textContent = '↓ Tải HD';
  const toast = document.createElement('div');
  toast.id = 'dyhd-pro-toast';
  document.documentElement.append(btn, toast);
  let toastTimer;
  const show = (text, ms=2600) => {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add('show');
    toastTimer = setTimeout(()=>toast.classList.remove('show'), ms);
  };
  const send = (msg) => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
  btn.addEventListener('click', async () => {
    btn.classList.add('dyhd-busy');
    btn.textContent = 'Đang bắt luồng…';
    try {
      const v = [...document.querySelectorAll('video')].find(x => !x.paused) || document.querySelector('video');
      let r = await send({type:'QUICK_START'});
      if (!r?.ok) throw new Error(r?.error || 'Không thể bắt luồng');
      if (v) { try { await v.play(); } catch {} }
      show('Đang phân tích luồng chất lượng cao nhất…', 2200);
      await new Promise(r=>setTimeout(r, 1800));
      await send({type:'SCAN_PAGE'});
      r = await send({type:'QUICK_DOWNLOAD'});
      if (!r?.ok) throw new Error(r?.error || 'Không thể tải video');
      show(r.mode === 'native' ? 'Đã gửi sang bộ tải tốc độ cao.' : 'Đang tải bằng Chrome (chế độ dự phòng).', 3200);
      setTimeout(()=>send({type:'STOP_CAPTURE'}), 600);
    } catch (e) {
      show(e.message || String(e), 5000);
    } finally {
      btn.classList.remove('dyhd-busy');
      btn.textContent = '↓ Tải HD';
    }
  });
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type !== 'NATIVE_EVENT' || !msg.event) return;
    const e = msg.event;
    if (e.type === 'progress') {
      const p = typeof e.percent === 'number' ? ` ${e.percent.toFixed(1)}%` : '';
      show(`Đang tải${p} • ${e.speed || ''}`.trim(), 1200);
    } else if (e.type === 'complete') show(`Tải xong: ${e.filename || 'video'}`, 4500);
    else if (e.type === 'error') show(`Lỗi tải: ${e.error || 'Không xác định'}`, 6000);
  });
})();
