const ALLOWED_PREF_KEYS = new Set(Object.keys(PREF_DEFAULTS));
const PRESETS = Object.freeze({
  personal:{autoCapture:true,videoChangeMode:'auto',afterDownload:'ask',qualityMode:'best',duplicatePolicy:'ask',filenameTemplate:'{author} - {title}',subfolderTemplate:'',floatingVisibility:'always',floatingSide:'right',floatingVertical:'middle',historyEnabled:true,historyLimit:80},
  creator:{autoCapture:true,videoChangeMode:'auto',afterDownload:'open_folder',qualityMode:'best',duplicatePolicy:'ask',filenameTemplate:'{author} - {title}',subfolderTemplate:'{author}/{date}',floatingVisibility:'always',floatingSide:'right',floatingVertical:'middle',historyEnabled:true,historyLimit:150},
  researcher:{autoCapture:true,videoChangeMode:'auto',afterDownload:'ask',qualityMode:'best',duplicatePolicy:'skip',filenameTemplate:'{date} - {video_id} - {author} - {title}',subfolderTemplate:'{author}',floatingVisibility:'hover',floatingSide:'right',floatingVertical:'middle',historyEnabled:true,historyLimit:250},
  advanced:{autoCapture:false,videoChangeMode:'manual',afterDownload:'none',qualityMode:'ask',duplicatePolicy:'ask',filenameTemplate:'{author} - {title}',subfolderTemplate:'',floatingVisibility:'hover',floatingSide:'right',floatingVertical:'bottom',historyEnabled:true,historyLimit:200}
});

function sanitizeHistoryLimit(n) {
  n=Number(n)||100;
  return Math.min(500,Math.max(20,Math.round(n)));
}

async function readHistory() {
  const r=await chrome.storage.local.get({[HISTORY_KEY]:[]});
  return Array.isArray(r[HISTORY_KEY])?r[HISTORY_KEY]:[];
}

async function writeHistory(items) {
  await chrome.storage.local.set({[HISTORY_KEY]:items});
  return items;
}

async function addHistoryRecord(record) {
  const prefs=await getPrefs();
  if (!prefs.historyEnabled) return null;
  const history=await readHistory();
  const clean={
    id:String(record.id||record.downloadId||crypto.randomUUID()),
    videoKey:String(record.videoKey||''),
    videoId:String(record.videoId||''),
    title:String(record.title||''),
    author:String(record.author||''),
    thumbnail:String(record.thumbnail||''),
    pageUrl:String(record.pageUrl||''),
    filename:String(record.filename||''),
    path:String(record.path||''),
    completedAt:Number(record.completedAt||Date.now()),
    bytes:Number(record.bytes)||0,
    width:Number(record.width)||0,
    height:Number(record.height)||0,
    bitrate:Number(record.bitrate)||0,
    quality:String(record.quality||''),
    mime:String(record.mime||''),
    verified:!!record.verified,
    verification:record.verification&&typeof record.verification==='object'?record.verification:null,
    mode:String(record.mode||'native')
  };
  const dedup=history.filter(x=>x.id!==clean.id);
  dedup.unshift(clean);
  dedup.splice(sanitizeHistoryLimit(prefs.historyLimit));
  await writeHistory(dedup);
  return clean;
}

async function findHistoryForVideo(metaOrKey) {
  const prefs=await getPrefs();
  if (!prefs.historyEnabled) return null;
  const history=await readHistory();
  const videoKey=typeof metaOrKey==='string'?metaOrKey:String(metaOrKey?.key||'');
  const videoId=typeof metaOrKey==='object'?String(metaOrKey?.videoId||''):'';
  return history.find(x=>(videoId&&x.videoId===videoId)||(videoKey&&x.videoKey===videoKey))||null;
}

async function clearHistory() {
  await writeHistory([]);
}

async function removeHistoryItem(id) {
  const h=await readHistory();
  await writeHistory(h.filter(x=>x.id!==id));
}

function sanitizeTemplateText(value,max=200) {
  return String(value||'').replace(/[\r\n\0]/g,' ').trim().slice(0,max);
}

function templateVars(meta={}) {
  const d=new Date();
  const date=d.toISOString().slice(0,10);
  const time=[d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join('-');
  return {
    author:String(meta.author||'Douyin'),
    title:String(meta.title||'Douyin video'),
    date,
    time,
    video_id:String(meta.videoId||'video'),
    id:String(meta.videoId||'video')
  };
}

function renderTemplate(template,meta={}) {
  const vars=templateVars(meta);
  return sanitizeTemplateText(template||'{author} - {title}').replace(/\{(author|title|date|time|video_id|id)\}/g,(_,k)=>vars[k]||'');
}

function validateImportedPrefs(raw) {
  if (!raw||typeof raw!=='object') throw new Error('Tệp cài đặt không hợp lệ.');
  const source=raw.preferences&&typeof raw.preferences==='object'?raw.preferences:raw;
  const out={};
  for(const [k,v] of Object.entries(source)) if(ALLOWED_PREF_KEYS.has(k)) out[k]=v;
  if (out.videoChangeMode&&!['auto','manual'].includes(out.videoChangeMode)) delete out.videoChangeMode;
  if (out.afterDownload&&!['ask','open_file','open_folder','none'].includes(out.afterDownload)) delete out.afterDownload;
  if (out.qualityMode&&!['best','1080','720','smallest','ask'].includes(out.qualityMode)) delete out.qualityMode;
  if (out.duplicatePolicy&&!['ask','redownload','skip'].includes(out.duplicatePolicy)) delete out.duplicatePolicy;
  if (out.floatingVisibility&&!['always','hover','hidden'].includes(out.floatingVisibility)) delete out.floatingVisibility;
  if (out.floatingSide&&!['left','right'].includes(out.floatingSide)) delete out.floatingSide;
  if (out.floatingVertical&&!['top','middle','bottom'].includes(out.floatingVertical)) delete out.floatingVertical;
  if (out.preset&&!Object.keys(PRESETS).includes(out.preset)) delete out.preset;
  if ('historyLimit' in out) out.historyLimit=sanitizeHistoryLimit(out.historyLimit);
  if ('filenameTemplate' in out) out.filenameTemplate=sanitizeTemplateText(out.filenameTemplate,220);
  if ('subfolderTemplate' in out) out.subfolderTemplate=sanitizeTemplateText(out.subfolderTemplate,160);
  return out;
}

async function exportSettings() {
  const preferences=await getPrefs();
  const language=(await chrome.storage.sync.get({language:'vi'})).language||'vi';
  let saveFolder='';
  try { const r=await nativeRequest('get_settings',{},5000); saveFolder=r.saveFolder||''; } catch {}
  return {schema:'douyin-hd-pro-settings',schemaVersion:2,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),language,preferences,saveFolder};
}

async function importSettings(payload) {
  const preferences=validateImportedPrefs(payload);
  const lang=String(payload?.language||'');
  await chrome.storage.sync.set({...preferences,...(lang?{language:lang}:{})});
  if (payload?.saveFolder) {
    try { await nativeRequest('set_save_folder',{path:String(payload.saveFolder)},15000); } catch {}
  }
  return {ok:true};
}

function publicDownloadState(d={}) {
  return {
    type:d.type||'',downloadId:d.downloadId||'',mode:d.mode||'',browserId:d.browserId,
    percent:Number(d.percent)||0,bytes:Number(d.bytes)||0,total:Number(d.total)||0,
    speed:d.speed||'',speedBps:Number(d.speedBps)||0,etaSeconds:Number(d.etaSeconds)||0,
    filename:d.filename||'',path:d.path||'',error:d.error||'',errorCode:d.errorCode||'',
    updatedAt:Number(d.updatedAt)||0,createdAt:Number(d.createdAt)||0,
    videoKey:d.videoKey||'',video:d.video||null,candidate:d.candidate||null,
    verification:d.verification||null,verified:!!d.verified,queueIndex:Number(d.queueIndex)||0,
    queuePosition:Number(d.queuePosition)||0,maxConcurrent:Number(d.maxConcurrent)||0
  };
}

async function getActivity() {
  const active=[...downloadStates.values()].filter(d=>['queued','started','progress','verifying','merging'].includes(d.type)).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).map(publicDownloadState);
  const history=await readHistory();
  return {active,history};
}

async function checkForUpdate() {
  const r=await fetch('https://api.github.com/repos/binkadev/douyin-hd-pro/releases/latest',{headers:{Accept:'application/vnd.github+json'}});
  if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
  const data=await r.json();
  const latest=String(data.tag_name||'').replace(/^v/,'');
  return {current:APP_VERSION,latest,available:!!latest&&semverCompare(latest,APP_VERSION)>0,url:data.html_url||'https://github.com/binkadev/douyin-hd-pro/releases'};
}
