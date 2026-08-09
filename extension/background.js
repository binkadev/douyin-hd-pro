const HOST_NAME = 'com.douyin.hd_pro';
const sessions = new Map();
let nativePort = null;
let nativeReady = false;
const nativeDownloads = new Map();

function isDouyinUrl(url = '') {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'douyin.com' || h.endsWith('.douyin.com');
  } catch { return false; }
}

function getHeader(headers = {}, name) {
  const k = Object.keys(headers).find(x => x.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : '';
}

function parseTotalSize(headers = {}) {
  const cr = getHeader(headers, 'content-range');
  if (cr) {
    const m = /\/\s*(\d+)\s*$/.exec(cr);
    if (m) return Number(m[1]) || 0;
  }
  const cl = Number(getHeader(headers, 'content-length')) || 0;
  return cl;
}

function candidateScore(c) {
  const u = (c.url || '').toLowerCase();
  const m = (c.mime || '').toLowerCase();
  let s = 0;
  if (m.startsWith('video/')) s += 5000;
  if (m.includes('mp4')) s += 2200;
  if (/\.mp4(?:\?|$)/.test(u)) s += 1800;
  if (m.includes('mpegurl') || /\.m3u8(?:\?|$)/.test(u)) s += 900;
  if (/douyinvod|bytecdn|byteimg|douyin/.test(u)) s += 400;
  if (/origin|source|uhd|1080|2160|4k/.test(u)) s += 650;
  if (/720/.test(u)) s += 250;
  if (/audio|music|sound/.test(u) && !m.startsWith('video/')) s -= 5000;
  const size = c.totalSize || c.size || 0;
  if (size > 0) s += Math.min(1800, Math.log2(size + 1) * 75);
  if (c.width && c.height) s += Math.min(2200, (Number(c.width) * Number(c.height)) / 900);
  if (c.bitrate) s += Math.min(1500, Number(c.bitrate) / 12000);
  if (/origin|uhd|1080|4k|high/i.test(c.quality || '')) s += 500;
  const res = /(?:width|w)[=_-]?(\d{3,4}).*?(?:height|h)[=_-]?(\d{3,4})/i.exec(u) || /(?:height|h)[=_-]?(\d{3,4}).*?(?:width|w)[=_-]?(\d{3,4})/i.exec(u);
  if (res) s += Math.min(1800, (Number(res[1]) * Number(res[2])) / 1200);
  const br = /(?:bitrate|br)[=_-]?(\d{4,9})/i.exec(u);
  if (br) s += Math.min(1200, Number(br[1]) / 15000);
  return Math.round(s);
}

function isMediaCandidate(url, mime = '') {
  const u = (url || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (!/^https?:/.test(u)) return false;
  if (m.startsWith('audio/')) return false;
  if (m.startsWith('video/')) return true;
  if (m.includes('mpegurl')) return true;
  return /\.mp4(?:\?|$)|\.m3u8(?:\?|$)|douyinvod|video\/tos|playwm|play_addr|video_id/.test(u);
}

function cleanRequestHeaders(headers = {}) {
  const out = {};
  const skip = new Set(['host', 'content-length', 'range', 'accept-encoding', 'connection', 'proxy-connection']);
  for (const [k, v] of Object.entries(headers || {})) {
    if (!skip.has(k.toLowerCase()) && typeof v === 'string' && v.length < 32768) out[k] = v;
  }
  out['Accept-Encoding'] = 'identity';
  return out;
}

function getSession(tabId) {
  if (!sessions.has(tabId)) sessions.set(tabId, {attached:false, requests:new Map(), candidates:new Map(), startedAt:0});
  return sessions.get(tabId);
}

function publicCandidate(c) {
  return {
    id: c.id,
    url: c.url,
    mime: c.mime || '',
    size: c.size || 0,
    totalSize: c.totalSize || 0,
    status: c.status || 0,
    source: c.source || 'network',
    score: c.score || 0,
    timestamp: c.timestamp || 0,
    width: c.width || 0,
    height: c.height || 0,
    bitrate: c.bitrate || 0,
    quality: c.quality || ''
  };
}

async function safeRuntimeMessage(payload) {
  try { await chrome.runtime.sendMessage(payload); return true; } catch { return false; }
}

async function safeTabMessage(tabId, payload) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isDouyinUrl(tab?.url || '')) return false;
    await chrome.tabs.sendMessage(tabId, payload);
    return true;
  } catch { return false; }
}

async function broadcastState(tabId) {
  const s = getSession(tabId);
  const candidates = [...s.candidates.values()].sort((a,b) => b.score - a.score).slice(0, 20).map(publicCandidate);
  const payload = {type:'STATE', attached:s.attached, candidates, nativeReady};
  void safeRuntimeMessage({...payload, tabId});
  void safeTabMessage(tabId, payload);
}

function addCandidate(tabId, c) {
  if (!isMediaCandidate(c.url, c.mime)) return;
  const s = getSession(tabId);
  const key = c.url;
  const old = s.candidates.get(key);
  const merged = {...old, ...c};
  merged.id = old?.id || crypto.randomUUID();
  merged.timestamp = Date.now();
  merged.score = candidateScore(merged);
  if (!old || merged.score >= old.score || merged.totalSize > old.totalSize) s.candidates.set(key, merged);
  if (s.candidates.size > 80) {
    const arr = [...s.candidates.entries()].sort((a,b) => b[1].score - a[1].score).slice(0, 50);
    s.candidates = new Map(arr);
  }
  broadcastState(tabId);
}

function extractApiMedia(root) {
  const out = [];
  const seen = new Set();
  const walk = (node, path = '', inherited = {}) => {
    if (!node || out.length >= 120) return;
    if (Array.isArray(node)) { for (let i=0;i<node.length && out.length<120;i++) walk(node[i], `${path}[${i}]`, inherited); return; }
    if (typeof node !== 'object') return;
    const ctx = {...inherited};
    for (const [k,v] of Object.entries(node)) {
      const lk = k.toLowerCase();
      if ((lk === 'width' || lk === 'video_width') && Number(v)) ctx.width = Number(v);
      else if ((lk === 'height' || lk === 'video_height') && Number(v)) ctx.height = Number(v);
      else if (['bit_rate','bitrate','bit_rate_value'].includes(lk) && Number(v)) ctx.bitrate = Number(v);
      else if (['data_size','size','file_size'].includes(lk) && Number(v)) ctx.totalSize = Number(v);
      else if (['gear_name','quality','quality_type','definition'].includes(lk) && (typeof v==='string'||typeof v==='number')) ctx.quality = String(v);
    }
    for (const [k,v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (Array.isArray(v) && k.toLowerCase() === 'url_list') {
        const mediaPath = /video|play_addr|download_addr|bit_rate|playapi|play_api/i.test(p) && !/cover|avatar|music|audio|image/i.test(p);
        if (mediaPath) for (const u of v) if (typeof u === 'string' && /^https?:/.test(u) && !seen.has(u)) {
          seen.add(u); out.push({url:u, ...ctx, source:'api', mime:/m3u8/i.test(u)?'application/vnd.apple.mpegurl':'video/mp4'});
        }
      }
      if (typeof v === 'string' && /^https?:/.test(v) && /play_addr|download_addr|video_url/i.test(p) && !/cover|avatar|music|audio|image/i.test(p) && !seen.has(v)) {
        seen.add(v); out.push({url:v, ...ctx, source:'api', mime:/m3u8/i.test(v)?'application/vnd.apple.mpegurl':'video/mp4'});
      }
      if (v && typeof v === 'object') walk(v, p, ctx);
      if (out.length >= 120) break;
    }
  };
  walk(root);
  return out;
}

async function inspectJsonResponse(tabId, requestId, meta) {
  try {
    const r = await chrome.debugger.sendCommand({tabId}, 'Network.getResponseBody', {requestId});
    if (!r?.body || r.body.length > 15_000_000) return;
    let text = r.body;
    if (r.base64Encoded) {
      const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
      text = new TextDecoder().decode(bytes);
    }
    const data = JSON.parse(text);
    for (const item of extractApiMedia(data)) addCandidate(tabId, {...item, requestHeaders:meta.requestHeaders || {}});
  } catch {}
}

async function scanPage(tabId) {
  try {
    const result = await chrome.debugger.sendCommand({tabId}, 'Runtime.evaluate', {
      expression: `(() => {
        const out=[];
        document.querySelectorAll('video').forEach(v=>{
          const urls=[v.currentSrc,v.src,...Array.from(v.querySelectorAll('source')).map(s=>s.src)].filter(Boolean);
          urls.forEach(url=>out.push({url,source:'dom',width:v.videoWidth||0,height:v.videoHeight||0}));
        });
        performance.getEntriesByType('resource').slice(-500).forEach(e=>{
          if (/mp4|m3u8|douyinvod|video\\/tos|play_addr|video_id/i.test(e.name)) out.push({url:e.name,source:'performance',size:e.transferSize||e.encodedBodySize||0});
        });
        const seen=new Set(out.map(x=>x.url));
        const walk=(node,path='',ctx={})=>{
          if(!node||out.length>120)return;
          if(Array.isArray(node)){for(let i=0;i<node.length&&out.length<=120;i++)walk(node[i],path+'['+i+']',ctx);return;}
          if(typeof node!=='object')return;
          const c={...ctx};
          for(const [k,v] of Object.entries(node)){
            const lk=k.toLowerCase();
            if((lk==='width'||lk==='video_width')&&Number(v))c.width=Number(v);
            else if((lk==='height'||lk==='video_height')&&Number(v))c.height=Number(v);
            else if(['bit_rate','bitrate','bit_rate_value'].includes(lk)&&Number(v))c.bitrate=Number(v);
            else if(['data_size','file_size'].includes(lk)&&Number(v))c.totalSize=Number(v);
            else if(['gear_name','quality','quality_type','definition'].includes(lk)&&(typeof v==='string'||typeof v==='number'))c.quality=String(v);
          }
          for(const [k,v] of Object.entries(node)){
            const p=path?path+'.'+k:k;
            if(Array.isArray(v)&&k.toLowerCase()==='url_list'&&/video|play_addr|download_addr|bit_rate|playapi|play_api/i.test(p)&&!/cover|avatar|music|audio|image/i.test(p)){
              for(const u of v)if(typeof u==='string'&&/^https?:/.test(u)&&!seen.has(u)){seen.add(u);out.push({url:u,source:'hydration',...c});}
            }
            if(v&&typeof v==='object')walk(v,p,c);
            if(out.length>120)break;
          }
        };
        for(const sc of Array.from(document.scripts).slice(0,80)){
          const t=sc.textContent||'';
          if(t.length<50||t.length>8000000||!/(url_list|play_addr|bit_rate)/.test(t))continue;
          const q=t.trim();
          if(q[0]!=='{'&&q[0]!=='[')continue;
          try{walk(JSON.parse(q));}catch(e){}
          if(out.length>120)break;
        }
        return out;
      })()`,
      returnByValue: true
    });
    const items = result?.result?.value || [];
    for (const item of items) {
      if (!item?.url || !/^https?:/.test(item.url)) continue;
      const mime = /m3u8/i.test(item.url) ? 'application/vnd.apple.mpegurl' : (/mp4/i.test(item.url) ? 'video/mp4' : 'video/unknown');
      addCandidate(tabId, {...item, mime, totalSize:item.totalSize||item.size||0, requestHeaders:{}});
    }
  } catch {}
}

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
      if (msg?.downloadId) nativeDownloads.set(msg.downloadId, msg);
      for (const [tabId] of sessions) void safeTabMessage(tabId, {type:'NATIVE_EVENT', event:msg});
      void safeRuntimeMessage({type:'NATIVE_EVENT', event:msg});
    });
    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      nativeReady = false;
      for (const [tabId] of sessions) broadcastState(tabId);
    });
    nativePort.postMessage({action:'hello', version:'1.0.2'});
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

async function getPageMeta(tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({target:{tabId}, func:() => {
      const og = (n) => document.querySelector(`meta[property="${n}"]`)?.content || '';
      const title = og('og:title') || document.title || 'Douyin video';
      const author = document.querySelector('[data-e2e="video-author-uniqueid"]')?.textContent?.trim() ||
                     document.querySelector('[class*="author"]')?.textContent?.trim() || '';
      return {title, author, pageUrl:location.href};
    }});
    return r?.result || {};
  } catch {
    const tab = await chrome.tabs.get(tabId);
    return {title:tab.title || 'Douyin video', author:'', pageUrl:tab.url || ''};
  }
}

function filenameFromMeta(meta) {
  const title = (meta.title || 'Douyin video').replace(/\s*-\s*抖音.*$/i, '').trim();
  const author = (meta.author || '').trim();
  return `${author ? author + ' - ' : ''}${title}`.slice(0, 140) || 'Douyin video';
}

async function downloadCandidate(tabId, candidateId = null) {
  const s = getSession(tabId);
  await scanPage(tabId);
  const arr = [...s.candidates.values()].sort((a,b) => b.score - a.score);
  const c = candidateId ? arr.find(x => x.id === candidateId) : arr[0];
  if (!c) throw new Error('Chưa bắt được luồng video. Hãy cho video chạy 2–3 giây rồi thử lại.');
  const meta = await getPageMeta(tabId);
  const payload = {
    action:'download',
    downloadId:crypto.randomUUID(),
    url:c.url,
    mime:c.mime || '',
    headers:cleanRequestHeaders(c.requestHeaders || {}),
    filename:filenameFromMeta(meta),
    pageUrl:meta.pageUrl || '',
    expectedSize:c.totalSize || c.size || 0,
    score:c.score || 0
  };
  if (await ensureNative()) {
    try {
      nativePort.postMessage(payload);
      return {mode:'native', downloadId:payload.downloadId, candidate:publicCandidate(c)};
    } catch {}
  }
  // Fallback: Chrome downloads directly. This may fail on some signed/CDN URLs because custom request headers cannot be replayed.
  const ext = /m3u8/i.test(c.url + c.mime) ? '.m3u8' : '.mp4';
  const id = await chrome.downloads.download({url:c.url, filename:`DouyinHD/${filenameFromMeta(meta)}${ext}`, conflictAction:'uniquify', saveAs:false});
  return {mode:'browser', downloadId:String(id), candidate:publicCandidate(c)};
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = msg.tabId || sender.tab?.id;
    if (msg.type === 'GET_STATE') {
      const id = tabId || (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id;
      if (!id) throw new Error('Không tìm thấy tab hiện tại.');
      const tab = await chrome.tabs.get(id);
      const s = isDouyinUrl(tab?.url || '') ? getSession(id) : null;
      sendResponse({ok:true, tabId:id, attached:!!s?.attached, candidates:s?[...s.candidates.values()].sort((a,b)=>b.score-a.score).slice(0,20).map(publicCandidate):[], nativeReady, isDouyin:isDouyinUrl(tab?.url || '')});
      return;
    }
    if (!tabId) throw new Error('Không tìm thấy tab Douyin.');
    if (msg.type === 'START_CAPTURE') {
      await startCapture(tabId);
      sendResponse({ok:true});
    } else if (msg.type === 'STOP_CAPTURE') {
      await stopCapture(tabId);
      sendResponse({ok:true});
    } else if (msg.type === 'SCAN_PAGE') {
      await scanPage(tabId);
      sendResponse({ok:true});
    } else if (msg.type === 'DOWNLOAD') {
      const r = await downloadCandidate(tabId, msg.candidateId || null);
      sendResponse({ok:true, ...r});
    } else if (msg.type === 'QUICK_START') {
      await startCapture(tabId);
      sendResponse({ok:true});
    } else if (msg.type === 'QUICK_DOWNLOAD') {
      const r = await downloadCandidate(tabId, null);
      sendResponse({ok:true, ...r});
    } else if (msg.type === 'PING_NATIVE') {
      connectNative();
      sendResponse({ok:true, nativeReady});
    } else sendResponse({ok:false,error:'Lệnh không hỗ trợ'});
  })().catch(err => sendResponse({ok:false,error:err?.message || String(err)}));
  return true;
});
