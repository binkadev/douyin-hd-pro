const APP_VERSION = '2.0.0';
const HOST_NAME = 'com.douyin.hd_pro';
const HISTORY_KEY = 'downloadHistoryV2';
const PREF_DEFAULTS = Object.freeze({
  setupComplete:false,
  preset:'personal',
  autoCapture:true,
  videoChangeMode:'auto',
  afterDownload:'ask',
  qualityMode:'best',
  duplicatePolicy:'ask',
  filenameTemplate:'{author} - {title}',
  subfolderTemplate:'',
  floatingVisibility:'always',
  floatingSide:'right',
  floatingVertical:'middle',
  historyEnabled:true,
  historyLimit:100
});

const sessions = new Map();
const nativeDownloads = new Map();
const downloadOwners = new Map();
const downloadStates = new Map();
const latestDownloadByTab = new Map();
const browserDownloads = new Map();
let nativePort = null;
let nativeReady = false;
let nativeHello = null;

function isDouyinUrl(url='') {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'douyin.com' || h.endsWith('.douyin.com');
  } catch { return false; }
}

function normalizePageUrl(url='') {
  try {
    const u = new URL(url);
    u.hash = '';
    return `${u.origin}${u.pathname}${u.search}`;
  } catch { return String(url||'').split('#')[0]; }
}

function getHeader(headers={}, name) {
  const k = Object.keys(headers).find(x => x.toLowerCase() === String(name).toLowerCase());
  return k ? headers[k] : '';
}

function parseTotalSize(headers={}) {
  const cr = getHeader(headers, 'content-range');
  if (cr) {
    const m = /\/\s*(\d+)\s*$/.exec(cr);
    if (m) return Number(m[1]) || 0;
  }
  return Number(getHeader(headers, 'content-length')) || 0;
}

function mediaKind(url='', mime='', pathHint='') {
  const u = String(url).toLowerCase();
  const m = String(mime).toLowerCase();
  const p = String(pathHint).toLowerCase();
  if (m.startsWith('audio/') || /audio|music|sound/.test(p) || /\/audio\//.test(u)) return 'audio';
  if (m.startsWith('video/') || m.includes('mpegurl') || /\.mp4(?:\?|$)|\.m3u8(?:\?|$)|douyinvod|video\/tos|playwm|play_addr|video_id/.test(u)) return 'video';
  return '';
}

function isMediaCandidate(url='', mime='', pathHint='') {
  return /^https?:/i.test(String(url)) && !!mediaKind(url, mime, pathHint);
}

function candidateResolution(c={}) {
  const w = Number(c.width)||0, h = Number(c.height)||0;
  const shortSide = w && h ? Math.min(w,h) : 0;
  const longSide = w && h ? Math.max(w,h) : 0;
  return {w,h,shortSide,longSide,pixels:w*h};
}

function candidateScore(c={}) {
  if ((c.mediaKind || mediaKind(c.url,c.mime,c.pathHint)) === 'audio') return -100000;
  const u = String(c.url||'').toLowerCase();
  const m = String(c.mime||'').toLowerCase();
  const q = String(c.quality||'').toLowerCase();
  const r = candidateResolution(c);
  let s = 0;
  if (m.startsWith('video/')) s += 5200;
  if (m.includes('mp4')) s += 2200;
  if (/\.mp4(?:\?|$)/.test(u)) s += 1700;
  if (m.includes('mpegurl') || /\.m3u8(?:\?|$)/.test(u)) s += 850;
  if (/douyinvod|bytecdn|video\/tos|douyin/.test(u)) s += 450;
  if (/origin|source|uhd|2160|4k/.test(`${u} ${q}`)) s += 850;
  else if (/1080|fullhd|fhd/.test(`${u} ${q}`)) s += 650;
  else if (/720|hd/.test(`${u} ${q}`)) s += 300;
  if (r.pixels) s += Math.min(2600, r.pixels/750);
  if (Number(c.bitrate)) s += Math.min(1700, Number(c.bitrate)/10000);
  const size = Number(c.totalSize||c.size)||0;
  if (size > 0) s += Math.min(1600, Math.log2(size+1)*70);
  if (/watermark|playwm/.test(u)) s -= 900;
  if (c.source === 'api' || c.source === 'hydration') s += 200;
  return Math.round(s);
}

function cleanRequestHeaders(headers={}) {
  const out = {};
  const skip = new Set(['host','content-length','range','accept-encoding','connection','proxy-connection']);
  for (const [k,v] of Object.entries(headers||{})) {
    if (!skip.has(k.toLowerCase()) && typeof v === 'string' && v.length < 32768 && !/[\r\n]/.test(v)) out[k] = v;
  }
  out['Accept-Encoding'] = 'identity';
  return out;
}

function initialSession() {
  return {
    attached:false,
    requests:new Map(),
    candidates:new Map(),
    audioCandidates:new Map(),
    startedAt:0,
    epoch:0,
    resetAt:0,
    videoKey:'',
    pageUrl:'',
    mediaSig:'',
    videoMeta:null,
    awaitingNewVideo:false,
    completedVideoKey:'',
    videoEvent:'',
    currentDownloadId:'',
    lastError:'',
    phase:'waiting'
  };
}

function getSession(tabId) {
  if (!sessions.has(tabId)) sessions.set(tabId, initialSession());
  return sessions.get(tabId);
}

function clearSessionData(tabId,{clearDownload=true,keepMeta=true}={}) {
  const s = getSession(tabId);
  s.epoch = (s.epoch||0)+1;
  s.requests.clear();
  s.candidates.clear();
  s.audioCandidates.clear();
  s.resetAt = Date.now();
  s.startedAt = Date.now();
  s.awaitingNewVideo = false;
  s.completedVideoKey = '';
  s.videoEvent = '';
  s.lastError = '';
  s.phase = s.attached ? 'capturing' : 'waiting';
  if (!keepMeta) {
    s.videoKey=''; s.pageUrl=''; s.mediaSig=''; s.videoMeta=null;
  }
  if (clearDownload) {
    latestDownloadByTab.delete(tabId);
    s.currentDownloadId='';
  }
  return s;
}

function publicCandidate(c={}) {
  return {
    id:c.id,
    url:c.url,
    mime:c.mime||'',
    mediaKind:c.mediaKind||mediaKind(c.url,c.mime,c.pathHint),
    size:Number(c.size)||0,
    totalSize:Number(c.totalSize)||0,
    status:Number(c.status)||0,
    source:c.source||'network',
    score:Number(c.score)||0,
    timestamp:Number(c.timestamp)||0,
    width:Number(c.width)||0,
    height:Number(c.height)||0,
    bitrate:Number(c.bitrate)||0,
    quality:c.quality||'',
    codec:c.codec||'',
    container:c.container||''
  };
}

function publicVideoMeta(meta) {
  if (!meta) return null;
  return {
    key:String(meta.key||''),
    videoId:String(meta.videoId||''),
    title:String(meta.title||''),
    author:String(meta.author||''),
    thumbnail:String(meta.thumbnail||''),
    pageUrl:String(meta.pageUrl||''),
    mediaSig:String(meta.mediaSig||'')
  };
}

function computePhase(s) {
  const currentId = s.currentDownloadId || '';
  const d = currentId ? downloadStates.get(currentId) : null;
  if (d && ['queued','started','progress','verifying','merging'].includes(d.type)) return 'downloading';
  if (d && d.type === 'complete' && (!d.videoKey || !s.videoKey || d.videoKey === s.videoKey)) return 'complete';
  if (d && d.type === 'error' && (!d.videoKey || !s.videoKey || d.videoKey === s.videoKey)) return 'error';
  if (s.awaitingNewVideo) return 'complete';
  if (s.candidates.size) return 'ready';
  if (s.attached) return 'capturing';
  return 'waiting';
}

async function safeRuntimeMessage(payload) {
  try { await chrome.runtime.sendMessage(payload); return true; } catch { return false; }
}

async function safeTabMessage(tabId,payload) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isDouyinUrl(tab?.url||'')) return false;
    await chrome.tabs.sendMessage(tabId,payload);
    return true;
  } catch { return false; }
}

async function getPrefs(extra={}) {
  return chrome.storage.sync.get({...PREF_DEFAULTS,...extra});
}

async function broadcastState(tabId) {
  const s = getSession(tabId);
  s.phase = computePhase(s);
  const candidates = [...s.candidates.values()].sort((a,b)=>b.score-a.score).slice(0,24).map(publicCandidate);
  const lastId = s.currentDownloadId || latestDownloadByTab.get(tabId);
  const download = lastId ? downloadStates.get(lastId)||null : null;
  const payload = {
    type:'STATE',tabId,
    attached:!!s.attached,
    candidates,
    nativeReady,
    nativeCompatible:nativeReady&&nativeVersionCompatible(),
    nativeHello,
    isDouyin:true,
    download,
    phase:s.phase,
    awaitingNewVideo:!!s.awaitingNewVideo,
    videoKey:s.videoKey||'',
    videoEvent:s.videoEvent||'',
    video:publicVideoMeta(s.videoMeta),
    lastError:s.lastError||''
  };
  void safeRuntimeMessage(payload);
  void safeTabMessage(tabId,payload);
}

function addCandidate(tabId,c,pathHint='') {
  if (!c?.url || !isMediaCandidate(c.url,c.mime,pathHint||c.pathHint)) return;
  const s = getSession(tabId);
  if (c.epoch != null && Number(c.epoch)!==Number(s.epoch||0)) return;
  const kind = mediaKind(c.url,c.mime,pathHint||c.pathHint);
  const store = kind === 'audio' ? s.audioCandidates : s.candidates;
  const key = c.url;
  const old = store.get(key);
  const merged = {...old,...c,mediaKind:kind,pathHint:pathHint||c.pathHint||''};
  merged.id = old?.id || crypto.randomUUID();
  merged.timestamp = Date.now();
  merged.score = candidateScore(merged);
  if (!old || merged.score>=old.score || Number(merged.totalSize)>Number(old.totalSize)) store.set(key,merged);
  if (kind==='video' && s.videoEvent==='new_auto' && s.candidates.size) s.videoEvent='';
  if (store.size>90) {
    const arr=[...store.entries()].sort((a,b)=>b[1].score-a[1].score).slice(0,60);
    if (kind==='audio') s.audioCandidates=new Map(arr); else s.candidates=new Map(arr);
  }
  broadcastState(tabId);
}

function extractApiMedia(root) {
  const out=[];
  const seen=new Set();
  const walk=(node,path='',inherited={})=>{
    if (!node || out.length>=180) return;
    if (Array.isArray(node)) { for(let i=0;i<node.length&&out.length<180;i++) walk(node[i],`${path}[${i}]`,inherited); return; }
    if (typeof node!=='object') return;
    const ctx={...inherited};
    for(const [k,v] of Object.entries(node)) {
      const lk=k.toLowerCase();
      if ((lk==='width'||lk==='video_width')&&Number(v)) ctx.width=Number(v);
      else if ((lk==='height'||lk==='video_height')&&Number(v)) ctx.height=Number(v);
      else if (['bit_rate','bitrate','bit_rate_value'].includes(lk)&&Number(v)) ctx.bitrate=Number(v);
      else if (['data_size','size','file_size'].includes(lk)&&Number(v)) ctx.totalSize=Number(v);
      else if (['gear_name','quality','quality_type','definition'].includes(lk)&&(typeof v==='string'||typeof v==='number')) ctx.quality=String(v);
      else if (['codec_type','codec','vcodec'].includes(lk)&&typeof v==='string') ctx.codec=v;
    }
    for(const [k,v] of Object.entries(node)) {
      const p=path?`${path}.${k}`:k;
      const lp=p.toLowerCase();
      if (Array.isArray(v)&&k.toLowerCase()==='url_list') {
        const relevant=/video|play_addr|download_addr|bit_rate|playapi|play_api|audio|music/.test(lp)&&!/cover|avatar|image/.test(lp);
        if (relevant) for(const u of v) if(typeof u==='string'&&/^https?:/.test(u)&&!seen.has(u)) {
          seen.add(u);
          const kind=/audio|music/.test(lp)?'audio':'video';
          out.push({url:u,...ctx,source:'api',pathHint:p,mediaKind:kind,mime:kind==='audio'?'audio/mp4':(/m3u8/i.test(u)?'application/vnd.apple.mpegurl':'video/mp4')});
        }
      }
      if (typeof v==='string'&&/^https?:/.test(v)&&/play_addr|download_addr|video_url|audio_url/.test(lp)&&!/cover|avatar|image/.test(lp)&&!seen.has(v)) {
        seen.add(v);
        const kind=/audio|music/.test(lp)?'audio':'video';
        out.push({url:v,...ctx,source:'api',pathHint:p,mediaKind:kind,mime:kind==='audio'?'audio/mp4':(/m3u8/i.test(v)?'application/vnd.apple.mpegurl':'video/mp4')});
      }
      if (v&&typeof v==='object') walk(v,p,ctx);
      if (out.length>=180) break;
    }
  };
  walk(root);
  return out;
}

async function inspectJsonResponse(tabId,requestId,meta) {
  try {
    const r=await chrome.debugger.sendCommand({tabId},'Network.getResponseBody',{requestId});
    if (!r?.body || r.body.length>18_000_000) return;
    let text=r.body;
    if (r.base64Encoded) {
      const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
      text=new TextDecoder().decode(bytes);
    }
    const data=JSON.parse(text);
    const s=getSession(tabId);
    for(const item of extractApiMedia(data)) addCandidate(tabId,{...item,requestHeaders:meta.requestHeaders||{},epoch:s.epoch},item.pathHint||'');
  } catch {}
}

async function scanPage(tabId,fresh=false) {
  try {
    const result=await chrome.debugger.sendCommand({tabId},'Runtime.evaluate',{
      expression:`(() => {
        const fresh=${fresh?'true':'false'}, out=[];
        if(fresh){try{performance.clearResourceTimings()}catch(e){}}
        const vids=[...document.querySelectorAll('video')];
        const score=v=>{const r=v.getBoundingClientRect();const vw=innerWidth,vh=innerHeight;const iw=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0));const ih=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));const ratio=r.width*r.height?iw*ih/(r.width*r.height):0;return ratio*100+(v.paused?0:25)+(v.readyState>=2?5:0)};
        vids.sort((a,b)=>score(b)-score(a)).slice(0,3).forEach(v=>{
          const urls=[v.currentSrc,v.src,...[...v.querySelectorAll('source')].map(s=>s.src)].filter(Boolean);
          urls.forEach(url=>out.push({url,source:'dom',width:v.videoWidth||0,height:v.videoHeight||0}));
        });
        if(!fresh) performance.getEntriesByType('resource').slice(-700).forEach(e=>{if(/mp4|m3u8|douyinvod|video\\/tos|audio\\/tos|play_addr|video_id/i.test(e.name))out.push({url:e.name,source:'performance',size:e.transferSize||e.encodedBodySize||0})});
        const seen=new Set(out.map(x=>x.url));
        const walk=(node,path='',ctx={})=>{
          if(!node||out.length>180)return;
          if(Array.isArray(node)){for(let i=0;i<node.length&&out.length<=180;i++)walk(node[i],path+'['+i+']',ctx);return}
          if(typeof node!=='object')return;
          const c={...ctx};
          for(const [k,v] of Object.entries(node)){const lk=k.toLowerCase();if((lk==='width'||lk==='video_width')&&Number(v))c.width=Number(v);else if((lk==='height'||lk==='video_height')&&Number(v))c.height=Number(v);else if(['bit_rate','bitrate','bit_rate_value'].includes(lk)&&Number(v))c.bitrate=Number(v);else if(['data_size','file_size'].includes(lk)&&Number(v))c.totalSize=Number(v);else if(['gear_name','quality','quality_type','definition'].includes(lk)&&(typeof v==='string'||typeof v==='number'))c.quality=String(v)}
          for(const [k,v] of Object.entries(node)){const p=path?path+'.'+k:k,lp=p.toLowerCase();if(Array.isArray(v)&&k.toLowerCase()==='url_list'&&/video|play_addr|download_addr|bit_rate|playapi|audio|music/.test(lp)&&!/cover|avatar|image/.test(lp)){for(const u of v)if(typeof u==='string'&&/^https?:/.test(u)&&!seen.has(u)){seen.add(u);out.push({url:u,source:'hydration',pathHint:p,...c})}}if(v&&typeof v==='object')walk(v,p,c);if(out.length>180)break}
        };
        for(const sc of [...document.scripts].slice(0,100)){const t=sc.textContent||'';if(t.length<50||t.length>9000000||!/(url_list|play_addr|bit_rate)/.test(t))continue;const q=t.trim();if(q[0]!=='{'&&q[0]!=='[')continue;try{walk(JSON.parse(q))}catch(e){}if(out.length>180)break}
        return out;
      })()`,returnByValue:true
    });
    const items=result?.result?.value||[];
    const s=getSession(tabId);
    for(const item of items) {
      if(!item?.url||!/^https?:/.test(item.url))continue;
      const kind=mediaKind(item.url,'',item.pathHint||'');
      const mime=kind==='audio'?'audio/mp4':(/m3u8/i.test(item.url)?'application/vnd.apple.mpegurl':(/mp4/i.test(item.url)?'video/mp4':'video/unknown'));
      addCandidate(tabId,{...item,mime,mediaKind:kind,totalSize:item.totalSize||item.size||0,requestHeaders:{},epoch:s.epoch},item.pathHint||'');
    }
  } catch {}
}

function nativeVersionCompatible(version=nativeHello?.version) {
  const appMajor=String(APP_VERSION).split('.')[0];
  const hostMajor=String(version||'').replace(/^v/,'').split('.')[0];
  return !!hostMajor && hostMajor===appMajor;
}

function pruneDownloadStates(limit=120) {
  const activeTypes=new Set(['queued','started','progress','verifying','merging']);
  const all=[...downloadStates.entries()];
  const active=all.filter(([,d])=>activeTypes.has(d?.type));
  const finished=all.filter(([,d])=>!activeTypes.has(d?.type)).sort((a,b)=>(Number(b[1]?.updatedAt)||0)-(Number(a[1]?.updatedAt)||0));
  const keep=new Set([...active,...finished.slice(0,Math.max(20,limit-active.length))].map(([id])=>id));
  for(const id of downloadStates.keys()) if(!keep.has(id)){downloadStates.delete(id);nativeDownloads.delete(id);downloadOwners.delete(id)}
}

chrome.tabs?.onRemoved?.addListener?.(tabId=>{
  sessions.delete(tabId);
  latestDownloadByTab.delete(tabId);
});

function semverCompare(a,b) {
  const pa=String(a||'0').replace(/^v/,'').split('.').map(Number), pb=String(b||'0').replace(/^v/,'').split('.').map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){const x=pa[i]||0,y=pb[i]||0;if(x!==y)return x>y?1:-1}return 0;
}
