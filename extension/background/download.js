async function getPageMeta(tabId) {
  const s=getSession(tabId);
  if(s.videoMeta&&(s.videoMeta.title||s.videoMeta.videoId))return {...s.videoMeta};
  try{
    const [r]=await chrome.scripting.executeScript({target:{tabId},func:()=>{
      const og=n=>document.querySelector(`meta[property="${n}"]`)?.content||'';
      const title=og('og:title')||document.title||'Douyin video';
      const author=document.querySelector('[data-e2e="video-author-uniqueid"]')?.textContent?.trim()||document.querySelector('[class*="author"]')?.textContent?.trim()||'';
      const thumbnail=og('og:image')||document.querySelector('video')?.poster||'';
      const m=location.pathname.match(/\/video\/(\d+)/)||new URL(location.href).searchParams.get('modal_id');
      const videoId=Array.isArray(m)?m[1]:String(m||'');
      return {title,author,thumbnail,videoId,pageUrl:location.href,key:videoId?`id:${videoId}`:location.href};
    }});
    return r?.result||{};
  }catch{
    const tab=await chrome.tabs.get(tabId);
    return {title:tab.title||'Douyin video',author:'',thumbnail:'',videoId:'',pageUrl:tab.url||'',key:s.videoKey||tab.url||''};
  }
}

function qualityDistance(c,target){const r=candidateResolution(c);if(!r.shortSide)return 99999;return Math.abs(r.shortSide-target)}

function selectCandidate(arr,mode='best') {
  const list=[...arr].filter(c=>(c.mediaKind||'video')==='video');
  if(!list.length)return null;
  if(mode==='ask')return null;
  if(mode==='smallest'){
    const sized=list.filter(c=>Number(c.totalSize||c.size)>0).sort((a,b)=>Number(a.totalSize||a.size)-Number(b.totalSize||b.size));
    return sized[0]||list.sort((a,b)=>a.score-b.score)[0];
  }
  if(mode==='1080'||mode==='720'){
    const target=mode==='1080'?1080:720;
    const known=list.filter(c=>candidateResolution(c).shortSide>0);
    if(known.length)return known.sort((a,b)=>qualityDistance(a,target)-qualityDistance(b,target)||Number(b.bitrate||0)-Number(a.bitrate||0)||b.score-a.score)[0];
  }
  return list.sort((a,b)=>b.score-a.score)[0];
}

function browserSafeSegment(s) {
  return String(s||'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s+/g,' ').trim().replace(/^\.+$/,'_').slice(0,120)||'_';
}

function browserSafeRelative(raw) {
  return String(raw||'').split(/[\\/]+/).map(browserSafeSegment).filter(Boolean).slice(0,5).join('/');
}

async function downloadCandidate(tabId,candidateId=null,options={}) {
  const s=getSession(tabId);
  await scanPage(tabId,false);
  const prefs=await getPrefs();
  const arr=[...s.candidates.values()].sort((a,b)=>b.score-a.score);
  const qualityMode=options.qualityMode||prefs.qualityMode||'best';
  const c=candidateId?arr.find(x=>x.id===candidateId):selectCandidate(arr,qualityMode);
  if(!c&&qualityMode==='ask')return {needsChoice:true,candidates:arr.slice(0,12).map(publicCandidate)};
  if(!c)throw Object.assign(new Error('Chưa bắt được luồng video. Hãy cho video chạy 2–3 giây rồi thử lại.'),{code:'NO_STREAM'});
  const meta={...(await getPageMeta(tabId)),...(s.videoMeta||{})};
  meta.key=meta.key||s.videoKey||meta.videoId||meta.pageUrl||'';
  const previous=await findHistoryForVideo(meta);
  if(previous&&!options.allowDuplicate){
    if(prefs.duplicatePolicy==='skip')return {duplicate:true,skipped:true,record:previous,candidate:publicCandidate(c)};
    if(prefs.duplicatePolicy!=='redownload')return {duplicate:true,record:previous,candidate:publicCandidate(c)};
  }
  const fileBase=renderTemplate(prefs.filenameTemplate||'{author} - {title}',meta).slice(0,170)||'Douyin video';
  const relativeFolder=renderTemplate(prefs.subfolderTemplate||'',meta);
  const downloadId=crypto.randomUUID();
  const activeCount=[...downloadStates.values()].filter(d=>['queued','started','progress','verifying','merging'].includes(d.type)).length;
  const payload={
    action:'download',downloadId,url:c.url,mime:c.mime||'',headers:cleanRequestHeaders(c.requestHeaders||{}),
    filename:fileBase,relativeFolder,pageUrl:meta.pageUrl||'',expectedSize:c.totalSize||c.size||0,
    videoKey:s.videoKey||meta.key||'',video:publicVideoMeta({...meta,key:s.videoKey||meta.key||''}),candidate:publicCandidate(c),queueIndex:activeCount+1
  };
  downloadOwners.set(downloadId,tabId);
  s.currentDownloadId=downloadId;s.awaitingNewVideo=false;s.videoEvent='';s.lastError='';s.phase='downloading';
  latestDownloadByTab.set(tabId,downloadId);
  downloadStates.set(downloadId,{type:'started',downloadId,mode:'native',percent:0,bytes:0,total:payload.expectedSize||0,candidate:publicCandidate(c),videoKey:payload.videoKey,video:payload.video,createdAt:Date.now(),updatedAt:Date.now(),queueIndex:activeCount+1});
  if(await ensureNative()){
    try{nativePort.postMessage(payload);await broadcastState(tabId);void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});return {mode:'native',downloadId,candidate:publicCandidate(c),video:payload.video}}
    catch{}
  }
  const ext=/m3u8/i.test(c.url+c.mime)?'.m3u8':'.mp4';
  const rel=browserSafeRelative(relativeFolder),base=browserSafeSegment(fileBase);
  const filename=`DouyinHD/${rel?rel+'/':''}${base}${ext}`;
  const browserId=await chrome.downloads.download({url:c.url,filename,conflictAction:'uniquify',saveAs:false});
  browserDownloads.set(browserId,{downloadId,tabId});
  downloadStates.set(downloadId,{...downloadStates.get(downloadId),mode:'browser',browserId,updatedAt:Date.now()});
  await broadcastState(tabId);void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});
  return {mode:'browser',downloadId,browserId,candidate:publicCandidate(c),video:payload.video};
}

async function finalizeDownload(tabId,d) {
  if(!d||d._historySaved)return;
  d._historySaved=true;downloadStates.set(d.downloadId,d);
  const c=d.candidate||{},v=d.video||{};
  await addHistoryRecord({
    id:d.downloadId,videoKey:d.videoKey||v.key||'',videoId:v.videoId||'',title:v.title||'',author:v.author||'',thumbnail:v.thumbnail||'',pageUrl:v.pageUrl||'',
    filename:d.filename||'',path:d.path||'',completedAt:Date.now(),bytes:d.bytes||d.total||0,width:c.width||d.verification?.width||0,height:c.height||d.verification?.height||0,
    bitrate:c.bitrate||0,quality:c.quality||'',mime:c.mime||'',verified:!!(d.verification?.ok||d.verified),verification:d.verification||null,mode:d.mode||'native'
  });
  void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});
}

async function maybeHandleAfterDownload(tabId,downloadState) {
  if(!downloadState||downloadState.type!=='complete')return;
  try{
    const prefs=await getPrefs();
    if(prefs.afterDownload==='open_file'){
      if(downloadState.mode==='browser'&&Number.isInteger(Number(downloadState.browserId)))await chrome.downloads.open(Number(downloadState.browserId));
      else if(downloadState.path)await nativeRequest('open_file',{path:String(downloadState.path)});
    }else if(prefs.afterDownload==='open_folder'){
      if(downloadState.mode==='browser'&&Number.isInteger(Number(downloadState.browserId)))chrome.downloads.show(Number(downloadState.browserId));
      else await nativeRequest('open_folder',{path:String(downloadState.path||'')});
    }
  }catch(e){void safeRuntimeMessage({type:'POST_DOWNLOAD_ACTION_ERROR',tabId,error:e?.message||String(e),errorCode:e?.code||''})}
}

chrome.downloads.onChanged.addListener(async delta=>{
  const meta=browserDownloads.get(delta.id);if(!meta)return;
  try{
    const [item]=await chrome.downloads.search({id:delta.id});if(!item)return;
    const total=Number(item.totalBytes||0),bytes=Number(item.bytesReceived||0),complete=item.state==='complete',interrupted=item.state==='interrupted';
    const prev=downloadStates.get(meta.downloadId)||{downloadId:meta.downloadId,mode:'browser',browserId:delta.id,createdAt:Date.now()};
    const next={...prev,type:complete?'complete':interrupted?'error':'progress',mode:'browser',browserId:delta.id,bytes,total,percent:total?bytes*100/total:0,filename:item.filename?item.filename.split(/[\\/]/).pop():'',path:item.filename||'',error:interrupted?(item.error||'Chrome download interrupted'):'',errorCode:interrupted?'CHROME_INTERRUPTED':'',updatedAt:Date.now(),verification:complete?{ok:true,method:'chrome',note:'Chrome reported download complete'}:prev.verification};
    downloadStates.set(meta.downloadId,next);
    const s=sessions.get(meta.tabId)||null,isCurrent=!!s&&(!next.videoKey||!s.videoKey||next.videoKey===s.videoKey);
    if(isCurrent){s.currentDownloadId=meta.downloadId;latestDownloadByTab.set(meta.tabId,meta.downloadId);void safeRuntimeMessage({type:'NATIVE_EVENT',tabId:meta.tabId,event:next});void safeTabMessage(meta.tabId,{type:'NATIVE_EVENT',tabId:meta.tabId,event:next});void broadcastState(meta.tabId)}
    if(complete){await finalizeDownload(meta.tabId,next);if(isCurrent)markVideoCompleted(meta.tabId,meta.downloadId);void maybeHandleAfterDownload(meta.tabId,next)}
    if(complete||interrupted){browserDownloads.delete(delta.id);pruneDownloadStates()}
    void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});
  }catch{}
});

async function openStoredRecord(record,folder=false){
  if(!record?.path)throw new Error('File cũ không còn đường dẫn hợp lệ.');
  const r=await nativeRequest(folder?'open_folder':'open_file',{path:String(record.path)});
  return {ok:!!r.ok};
}

function friendlyDiagnostics(tabId,native={},isDouyin=false) {
  const s=isDouyin&&tabId?sessions.get(tabId)||null:null;
  const nativeVersion=native.version||nativeHello?.version||'';
  return {
    appVersion:APP_VERSION,nativeReady,nativeCompatible:nativeReady&&nativeVersionCompatible(nativeVersion),nativeVersion,platform:native.platform||nativeHello?.platform||'',
    saveFolder:native.saveFolder||nativeHello?.saveFolder||'',folderWritable:native.folderWritable!==false,
    ffmpeg:!!native.ffmpeg,ffmpegPath:native.ffmpegPath||'',ffprobe:!!native.ffprobe,ffprobePath:native.ffprobePath||'',
    isDouyin:!!isDouyin,attached:!!s?.attached,candidateCount:s?.candidates?.size||0,phase:s?.phase||'waiting',
    maxConcurrent:Number(native.maxConcurrent)||0,queueWaiting:Number(native.queueWaiting)||0,queueActive:Number(native.queueActive)||0
  };
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    const tabId=msg.tabId||sender.tab?.id;
    if(msg.type==='GET_STATE'){
      const id=tabId||(await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id;if(!id)throw new Error('Không tìm thấy tab hiện tại.');
      const tab=await chrome.tabs.get(id);const s=isDouyinUrl(tab?.url||'')?getSession(id):null;const lastId=s?.currentDownloadId||latestDownloadByTab.get(id);
      sendResponse({ok:true,tabId:id,attached:!!s?.attached,candidates:s?[...s.candidates.values()].sort((a,b)=>b.score-a.score).slice(0,24).map(publicCandidate):[],nativeReady,nativeCompatible:nativeReady&&nativeVersionCompatible(),nativeHello,isDouyin:isDouyinUrl(tab?.url||''),download:lastId?publicDownloadState(downloadStates.get(lastId)||{}):null,phase:s?.phase||'waiting',awaitingNewVideo:!!s?.awaitingNewVideo,videoKey:s?.videoKey||'',videoEvent:s?.videoEvent||'',video:publicVideoMeta(s?.videoMeta),lastError:s?.lastError||''});return;
    }
    if(msg.type==='GET_NATIVE_SETTINGS'){const r=await nativeRequest('get_settings',{},5000);sendResponse({ok:true,saveFolder:r.saveFolder||''});return}
    if(msg.type==='CHOOSE_FOLDER'){const r=await nativeRequest('choose_folder',{initialPath:String(msg.initialPath||'')},60000);sendResponse({ok:!!r.ok,cancelled:!!r.cancelled,saveFolder:r.saveFolder||'',error:r.error||''});return}
    if(msg.type==='SET_SAVE_FOLDER'){const r=await nativeRequest('set_save_folder',{path:String(msg.path||'')},15000);sendResponse({ok:!!r.ok,saveFolder:r.saveFolder||''});return}
    if(msg.type==='GET_ACTIVITY'){sendResponse({ok:true,...await getActivity()});return}
    if(msg.type==='CHECK_DUPLICATE'){const s=tabId?sessions.get(tabId)||null:null;const videoKey=s?.videoKey||'';const record=s?.videoMeta?await findHistoryForVideo(s.videoMeta):null;sendResponse({ok:true,videoKey,record:record||null});return}
    if(msg.type==='CLEAR_HISTORY'){await clearHistory();sendResponse({ok:true});void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});return}
    if(msg.type==='DELETE_HISTORY'){await removeHistoryItem(String(msg.id||''));sendResponse({ok:true});void safeRuntimeMessage({type:'ACTIVITY_UPDATED'});return}
    if(msg.type==='HISTORY_OPEN'){const h=await readHistory(),r=h.find(x=>x.id===msg.id);if(!r)throw new Error('Không tìm thấy mục lịch sử.');sendResponse(await openStoredRecord(r,!!msg.folder));return}
    if(msg.type==='GET_DIAGNOSTICS'){let n={};try{n=await nativeRequest('diagnostics',{},10000)}catch(e){n={error:e.message,errorCode:e.code||''}}let isD=false;if(tabId){try{isD=isDouyinUrl((await chrome.tabs.get(tabId))?.url||'')}catch{}}sendResponse({ok:true,diagnostics:friendlyDiagnostics(tabId,n,isD),nativeError:n.error||'',nativeErrorCode:n.errorCode||''});return}
    if(msg.type==='CHECK_UPDATE'){sendResponse({ok:true,...await checkForUpdate()});return}
    if(msg.type==='OPEN_RELEASE'){await chrome.tabs.create({url:String(msg.url||'https://github.com/binkadev/douyin-hd-pro/releases')});sendResponse({ok:true});return}
    if(msg.type==='EXPORT_SETTINGS'){sendResponse({ok:true,data:await exportSettings()});return}
    if(msg.type==='IMPORT_SETTINGS'){await importSettings(msg.data||{});sendResponse({ok:true});return}
    if(msg.type==='RESET_ALL_SETTINGS'){await chrome.storage.sync.clear();await chrome.storage.sync.set({...PREF_DEFAULTS,setupComplete:true,language:'vi'});let saveFolder='';try{const r=await nativeRequest('reset_settings',{},15000);saveFolder=r.saveFolder||''}catch{}sendResponse({ok:true,saveFolder});return}
    if(msg.type==='APPLY_PRESET'){const p=PRESETS[String(msg.preset||'personal')]||PRESETS.personal;await chrome.storage.sync.set({...p,preset:String(msg.preset||'personal')});sendResponse({ok:true,preferences:{...PREF_DEFAULTS,...p}});return}
    if(!tabId)throw new Error('Không tìm thấy tab Douyin.');
    if(msg.type==='VIDEO_CONTEXT'){await handleVideoContext(tabId,msg.context||{});sendResponse({ok:true});return}
    if(msg.type==='RESET_VIDEO'){await resetCurrentVideo(tabId,{keepAttached:!!msg.keepAttached,clearDownload:true});sendResponse({ok:true});return}
    if(msg.type==='START_CAPTURE'){const s=getSession(tabId);s.awaitingNewVideo=false;s.videoEvent='';await startCapture(tabId,false);sendResponse({ok:true});return}
    if(msg.type==='STOP_CAPTURE'){await stopCapture(tabId);sendResponse({ok:true});return}
    if(msg.type==='SCAN_PAGE'){await scanPage(tabId,false);sendResponse({ok:true});return}
    if(msg.type==='DOWNLOAD'||msg.type==='QUICK_DOWNLOAD'){
      const r=await downloadCandidate(tabId,msg.candidateId||null,{allowDuplicate:!!msg.allowDuplicate,qualityMode:msg.qualityMode||''});sendResponse({ok:true,...r});return;
    }
    if(msg.type==='QUICK_START'){const s=getSession(tabId);s.awaitingNewVideo=false;s.videoEvent='';await startCapture(tabId,false);sendResponse({ok:true});return}
    if(msg.type==='PING_NATIVE'){connectNative();sendResponse({ok:true,nativeReady});return}
    if(msg.type==='OPEN_FILE'){
      if(msg.mode==='browser'&&Number.isInteger(Number(msg.browserId))){await chrome.downloads.open(Number(msg.browserId));sendResponse({ok:true,mode:'browser'})}
      else{if(!msg.path)throw new Error('Chưa có đường dẫn file đã tải.');const r=await nativeRequest('open_file',{path:String(msg.path)});sendResponse({ok:!!r.ok,mode:'native'})}return;
    }
    if(msg.type==='OPEN_FOLDER'){
      if(msg.mode==='browser'&&Number.isInteger(Number(msg.browserId))){chrome.downloads.show(Number(msg.browserId));sendResponse({ok:true,mode:'browser'})}
      else{const r=await nativeRequest('open_folder',{path:String(msg.path||'')});sendResponse({ok:!!r.ok,mode:'native'})}return;
    }
    sendResponse({ok:false,error:'Lệnh không hỗ trợ'});
  })().catch(err=>sendResponse({ok:false,error:err?.message||String(err),errorCode:err?.code||''}));
  return true;
});
