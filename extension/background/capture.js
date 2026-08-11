async function startCapture(tabId) {
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
  await scanPage(tabId);
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
    s.requests.set(params.requestId, meta);
  } else if (method === 'Network.requestWillBeSentExtraInfo') {
    const meta = s.requests.get(params.requestId) || {};
    meta.requestHeaders = {...meta.requestHeaders, ...(params.headers || {})};
    s.requests.set(params.requestId, meta);
  } else if (method === 'Network.responseReceived') {
    const r = params.response || {};
    const meta = s.requests.get(params.requestId) || {};
    meta.url = meta.url || r.url;
    meta.mime = r.mimeType || getHeader(r.headers || {}, 'content-type');
    meta.status = r.status || 0;
    meta.responseHeaders = r.headers || {};
    meta.size = Number(getHeader(r.headers || {}, 'content-length')) || 0;
    meta.totalSize = parseTotalSize(r.headers || {});
    s.requests.set(params.requestId, meta);
    addCandidate(tabId, {
      url: meta.url,
      mime: meta.mime,
      status: meta.status,
      size: meta.size,
      totalSize: meta.totalSize,
      requestHeaders: meta.requestHeaders || {},
      responseHeaders: meta.responseHeaders || {},
      source: 'network',
      requestId: params.requestId
    });
  } else if (method === 'Network.responseReceivedExtraInfo') {
    const meta = s.requests.get(params.requestId) || {};
    meta.responseHeaders = {...meta.responseHeaders, ...(params.headers || {})};
    meta.totalSize = parseTotalSize(meta.responseHeaders || {});
    s.requests.set(params.requestId, meta);
    if (meta.url) addCandidate(tabId, {...meta, source:'network'});
  } else if (method === 'Network.loadingFinished') {
    const meta = s.requests.get(params.requestId) || {};
    if (params.encodedDataLength && !meta.totalSize) meta.size = Math.max(meta.size || 0, Number(params.encodedDataLength) || 0);
    if (meta.url && isMediaCandidate(meta.url, meta.mime || '')) addCandidate(tabId, {...meta, source:'network'});
    const mime = (meta.mime || '').toLowerCase();
    if (mime.includes('json') && /aweme|detail|feed|recommend|post|search/i.test(meta.url || '')) inspectJsonResponse(tabId, params.requestId, meta);
  }
});

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onMessage.addListener(msg => {
      nativeReady = true;
      const downloadId = msg?.downloadId;
      let owner = null;
      if (downloadId) {
        owner = downloadOwners.get(downloadId) || null;
        const prev = downloadStates.get(downloadId) || {downloadId, mode:'native'};
        const next = {...prev, ...msg, mode:'native', updatedAt:Date.now()};
        downloadStates.set(downloadId, next);
        nativeDownloads.set(downloadId, next);
        if (owner) latestDownloadByTab.set(owner, downloadId);
      }
      if (owner) {
        void safeTabMessage(owner, {type:'NATIVE_EVENT', tabId:owner, event:downloadStates.get(downloadId) || msg});
        void safeRuntimeMessage({type:'NATIVE_EVENT', tabId:owner, event:downloadStates.get(downloadId) || msg});
        void broadcastState(owner);
      } else {
        void safeRuntimeMessage({type:'NATIVE_EVENT', event:msg});
      }
    });
    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      nativeReady = false;
      for (const [tabId] of sessions) broadcastState(tabId);
    });
    nativePort.postMessage({action:'hello', version:'1.0.3'});
  } catch {
    nativePort = null;
    nativeReady = false;
  }
}

connectNative();

async function ensureNative(timeoutMs = 700) {
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
