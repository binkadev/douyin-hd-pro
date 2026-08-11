const HOST_NAME = 'com.douyin.hd_pro';
const sessions = new Map();
let nativePort = null;
let nativeReady = false;
const nativeDownloads = new Map();
const downloadOwners = new Map();
const downloadStates = new Map();
const latestDownloadByTab = new Map();
const browserDownloads = new Map();

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
  const lastId = latestDownloadByTab.get(tabId);
  const download = lastId ? downloadStates.get(lastId) || null : null;
  const payload = {type:'STATE', attached:s.attached, candidates, nativeReady, download};
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
