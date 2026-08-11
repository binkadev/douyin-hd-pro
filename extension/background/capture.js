async function startCapture(tabId, fresh=false) {
  const tab = await chrome.tabs.get(tabId);
  if (!isDouyinUrl(tab.url)) throw new Error('Hãy mở một video trên douyin.com trước.');
  const s = getSession(tabId);
  if (!s.attached) {
    await chrome.debugger.attach({tabId}, '1.3');
    s.attached = true;
    s.startedAt = Date.now();
    await chrome.debugger.sendCommand({tabId}, 'Network.enable', {});
    await chrome.debugger.sendCommand({tabId}, 'Runtime.enable');
  }
  await scanPage(tabId, fresh);
  await broadcastState(tabId);
  return true;
}

async function stopCapture(tabId) {
  const s = getSession(tabId);
  if (s.attached) {
    try { await chrome.debugger.detach({tabId}); } catch {}
  }
  s.attached = false;
  await broadcastState(tabId);
}

async function resetCurrentVideo(tabId, {keepAttached=false, clearDownload=true}={}) {
  const s = getSession(tabId);
  if (!keepAttached && s.attached) {
    try { await chrome.debugger.detach({tabId}); } catch {}
    s.attached = false;
  }
  clearSessionData(tabId, {clearDownload});
  s.awaitingNewVideo = false;
  s.completedVideoKey = '';
  try {
    if (s.attached) await chrome.debugger.sendCommand({tabId}, 'Runtime.evaluate', {expression:'try{performance.clearResourceTimings()}catch(e){}'});
  } catch {}
  await broadcastState(tabId);
  return true;
}

async function handleVideoContext(tabId, ctx={}) {
  const tab = await chrome.tabs.get(tabId).catch(()=>null);
  if (!tab || !isDouyinUrl(tab.url || '')) return;
  const s = getSession(tabId);
  const pageUrl = normalizePageUrl(ctx.pageUrl || tab.url || '');
  const mediaSig = String(ctx.mediaSig || '');
  const key = String(ctx.key || `${pageUrl}|${mediaSig}`);
  if (!s.videoKey) {
    s.videoKey = key;
    s.pageUrl = pageUrl;
    s.mediaSig = mediaSig;
    await broadcastState(tabId);
    return;
  }
  const pageChanged = !!pageUrl && !!s.pageUrl && pageUrl !== s.pageUrl;
  const mediaChanged = !!mediaSig && !!s.mediaSig && mediaSig !== s.mediaSig;
  if (!pageChanged && !mediaChanged) {
    s.videoKey = key || s.videoKey;
    s.pageUrl = pageUrl || s.pageUrl;
    s.mediaSig = mediaSig || s.mediaSig;
    return;
  }
  if (Date.now() - (s.resetAt || 0) < 700) {
    s.videoKey = key;
    s.pageUrl = pageUrl;
    s.mediaSig = mediaSig;
    return;
  }
  const {videoChangeMode='auto'} = await chrome.storage.sync.get({videoChangeMode:'auto'});
  const mode = videoChangeMode === 'manual' ? 'manual' : 'auto';
  const wasAttached = s.attached;
  clearSessionData(tabId, {clearDownload:true});
  s.videoKey = key;
  s.pageUrl = pageUrl;
  s.mediaSig = mediaSig;
  s.awaitingNewVideo = false;
  s.completedVideoKey = '';
  s.videoEvent = mode === 'auto' ? 'new_auto' : 'new_manual';
  try {
    if (wasAttached) await chrome.debugger.sendCommand({tabId}, 'Runtime.evaluate', {expression:'try{performance.clearResourceTimings()}catch(e){}'});
  } catch {}
  if (mode === 'manual') {
    if (wasAttached) {
      try { await chrome.debugger.detach({tabId}); } catch {}
    }
    s.attached = false;
    await broadcastState(tabId);
    void safeRuntimeMessage({type:'VIDEO_SESSION_EVENT',tabId,event:'new_manual'});
    void safeTabMessage(tabId,{type:'VIDEO_SESSION_EVENT',tabId,event:'new_manual'});
    return;
  }
  try {
    if (!s.attached) await startCapture(tabId, true);
    else {
      await scanPage(tabId, true);
      await broadcastState(tabId);
    }
    setTimeout(()=>scanPage(tabId, true).catch(()=>{}), 900);
  } catch {}
  void safeRuntimeMessage({type:'VIDEO_SESSION_EVENT',tabId,event:'new_auto'});
  void safeTabMessage(tabId,{type:'VIDEO_SESSION_EVENT',tabId,event:'new_auto'});
}

function markVideoCompleted(tabId) {
  const s = getSession(tabId);
  s.awaitingNewVideo = true;
  s.completedVideoKey = s.videoKey || '';
  s.videoEvent = '';
  broadcastState(tabId);
}

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId == null) return;
  const s = getSession(source.tabId);
  s.attached = false;
  broadcastState(source.tabId);
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  if (tabId == null) return;
  const s = getSession(tabId);
  if (method === 'Network.requestWillBeSent') {
    const r = params.request || {};
    const meta = s.requests.get(params.requestId) || {};
    meta.url = r.url;
    meta.method = r.method;
    meta.requestHeaders = {...meta.requestHeaders, ...(r.headers || {})};
    meta.resourceType = params.type || '';
    meta.epoch = s.epoch || 0;
    s.requests.set(params.requestId, meta);
  } else if (method === 'Network.requestWillBeSentExtraInfo') {
    const meta = s.requests.get(params.requestId) || {epoch:s.epoch||0};
    meta.requestHeaders = {...meta.requestHeaders, ...(params.headers || {})};
    s.requests.set(params.requestId, meta);
  } else if (method === 'Network.responseReceived') {
    let meta = s.requests.get(params.requestId);
    if (!meta && Date.now() - (s.resetAt || 0) < 1800) return;
    meta = meta || {epoch:s.epoch||0};
    if (meta.epoch !== (s.epoch||0)) return;
    const r = params.response || {};
    meta.url = meta.url || r.url;
    meta.mime = r.mimeType || getHeader(r.headers || {}, 'content-type');
    meta.status = r.status || 0;
    meta.responseHeaders = r.headers || {};
    meta.size = Number(getHeader(r.headers || {}, 'content-length')) || 0;
    meta.totalSize = parseTotalSize(r.headers || {});
    s.requests.set(params.requestId, meta);
    addCandidate(tabId, {url:meta.url,mime:meta.mime,status:meta.status,size:meta.size,totalSize:meta.totalSize,requestHeaders:meta.requestHeaders||{},responseHeaders:meta.responseHeaders||{},source:'network',requestId:params.requestId,epoch:meta.epoch});
  } else if (method === 'Network.responseReceivedExtraInfo') {
    const meta = s.requests.get(params.requestId);
    if (!meta || meta.epoch !== (s.epoch||0)) return;
    meta.responseHeaders = {...meta.responseHeaders, ...(params.headers || {})};
    meta.totalSize = parseTotalSize(meta.responseHeaders || {});
    s.requests.set(params.requestId, meta);
    if (meta.url) addCandidate(tabId, {...meta, source:'network'});
  } else if (method === 'Network.loadingFinished') {
    const meta = s.requests.get(params.requestId);
    if (!meta || meta.epoch !== (s.epoch||0)) return;
    if (params.encodedDataLength && !meta.totalSize) meta.size = Math.max(meta.size || 0, Number(params.encodedDataLength) || 0);
    if (meta.url && isMediaCandidate(meta.url, meta.mime || '')) addCandidate(tabId, {...meta, source:'network'});
    const mime = (meta.mime || '').toLowerCase();
    if (mime.includes('json') && /aweme|detail|feed|recommend|post|search/i.test(meta.url || '')) inspectJsonResponse(tabId, params.requestId, meta);
  }
});

const pendingNativeOps = new Map();

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onMessage.addListener(msg => {
      nativeReady = true;
      if ((msg?.type === 'operation_result' || msg?.type === 'open_result') && msg.requestId) {
        const pending = pendingNativeOps.get(msg.requestId);
        if (pending) {
          pendingNativeOps.delete(msg.requestId);
          clearTimeout(pending.timer);
          if (msg.ok) pending.resolve(msg);
          else pending.reject(new Error(msg.error || 'Native operation failed'));
        }
        return;
      }
      const downloadId = msg?.downloadId;
      let owner = null;
      if (downloadId) {
        owner = downloadOwners.get(downloadId) || null;
        const prev = downloadStates.get(downloadId) || {downloadId, mode:'native'};
        const next = {...prev, ...msg, mode:'native', updatedAt:Date.now()};
        downloadStates.set(downloadId, next);
        nativeDownloads.set(downloadId, next);
        if (owner) {
          const os = getSession(owner);
          if (!next.videoKey || !os.videoKey || next.videoKey === os.videoKey) latestDownloadByTab.set(owner, downloadId);
        }
      }
      if (owner) {
        void safeTabMessage(owner, {type:'NATIVE_EVENT', tabId:owner, event:downloadStates.get(downloadId) || msg});
        void safeRuntimeMessage({type:'NATIVE_EVENT', tabId:owner, event:downloadStates.get(downloadId) || msg});
        void broadcastState(owner);
        if (msg?.type === 'complete') {
          const os = getSession(owner);
          const currentDownload = downloadStates.get(downloadId) || msg;
          if (!currentDownload.videoKey || !os.videoKey || currentDownload.videoKey === os.videoKey) markVideoCompleted(owner);
          if (typeof maybeHandleAfterDownload === 'function') void maybeHandleAfterDownload(owner, downloadStates.get(downloadId) || msg);
        }
      } else if (msg?.type !== 'hello' && msg?.type !== 'pong') {
        void safeRuntimeMessage({type:'NATIVE_EVENT', event:msg});
      }
    });
    nativePort.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError?.message || 'Native Helper disconnected';
      nativePort = null;
      nativeReady = false;
      for (const [id,pending] of pendingNativeOps) {
        clearTimeout(pending.timer);
        pending.reject(new Error(err));
        pendingNativeOps.delete(id);
      }
      for (const [tabId] of sessions) broadcastState(tabId);
    });
    nativePort.postMessage({action:'hello', version:'1.1.0'});
  } catch {
    nativePort = null;
    nativeReady = false;
  }
}

connectNative();

async function ensureNative(timeoutMs = 1400) {
  connectNative();
  if (nativeReady && nativePort) return true;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await new Promise(r => setTimeout(r, 50));
    if (nativeReady && nativePort) return true;
    if (!nativePort) break;
  }
  return false;
}

async function nativeRequest(action, payload = {}, timeoutMs = 15000) {
  if (!(await ensureNative())) throw new Error('Native Helper chưa kết nối.');
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingNativeOps.delete(requestId);
      reject(new Error('Native Helper không phản hồi thao tác.'));
    }, timeoutMs);
    pendingNativeOps.set(requestId, {resolve, reject, timer});
    try { nativePort.postMessage({action, requestId, ...payload}); }
    catch (e) {
      clearTimeout(timer);
      pendingNativeOps.delete(requestId);
      reject(e);
    }
  });
}
