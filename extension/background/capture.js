async function startCapture(tabId,fresh=false) {
  const tab=await chrome.tabs.get(tabId);
  if(!isDouyinUrl(tab?.url||'')) throw new Error('Hãy mở một video trên douyin.com trước.');
  const s=getSession(tabId);
  if(!s.attached) {
    await chrome.debugger.attach({tabId},'1.3');
    s.attached=true;
    s.startedAt=Date.now();
    await chrome.debugger.sendCommand({tabId},'Network.enable',{});
    await chrome.debugger.sendCommand({tabId},'Runtime.enable');
  }
  s.awaitingNewVideo=false;
  s.lastError='';
  s.phase='capturing';
  await scanPage(tabId,!!fresh);
  await broadcastState(tabId);
  return true;
}

async function stopCapture(tabId) {
  const s=getSession(tabId);
  if(s.attached){try{await chrome.debugger.detach({tabId})}catch{}}
  s.attached=false;
  if(!s.candidates.size&&!s.awaitingNewVideo)s.phase='waiting';
  await broadcastState(tabId);
}

async function resetCurrentVideo(tabId,{keepAttached=false,clearDownload=true}={}) {
  const s=getSession(tabId);
  const wasAttached=s.attached;
  if(!keepAttached&&wasAttached){try{await chrome.debugger.detach({tabId})}catch{}s.attached=false}
  clearSessionData(tabId,{clearDownload,keepMeta:true});
  if(keepAttached&&wasAttached){
    s.attached=true;
    try{await chrome.debugger.sendCommand({tabId},'Runtime.evaluate',{expression:'try{performance.clearResourceTimings()}catch(e){}'})}catch{}
    await scanPage(tabId,true);
  }
  await broadcastState(tabId);
  return true;
}

function contextChanged(s,ctx) {
  if(!s.videoKey)return true;
  const key=String(ctx.key||'');
  if(key&&s.videoKey){
    if(key!==s.videoKey)return true;
    if(key.startsWith('id:')&&s.videoKey.startsWith('id:'))return false;
  }
  const page=normalizePageUrl(ctx.pageUrl||'');
  if(page&&s.pageUrl&&page!==s.pageUrl)return true;
  const sig=String(ctx.mediaSig||'');
  if(!key&&sig&&s.mediaSig&&sig!==s.mediaSig)return true;
  return false;
}

async function handleVideoContext(tabId,ctx={}) {
  const tab=await chrome.tabs.get(tabId).catch(()=>null);
  if(!tab||!isDouyinUrl(tab.url||''))return;
  const s=getSession(tabId);
  const pageUrl=normalizePageUrl(ctx.pageUrl||tab.url||'');
  const mediaSig=String(ctx.mediaSig||'');
  const key=String(ctx.key||ctx.videoId||`${pageUrl}|${mediaSig}`);
  const meta={key,videoId:String(ctx.videoId||''),title:String(ctx.title||''),author:String(ctx.author||''),thumbnail:String(ctx.thumbnail||''),pageUrl,mediaSig};
  if(!s.videoKey){
    s.videoKey=key;s.pageUrl=pageUrl;s.mediaSig=mediaSig;s.videoMeta=meta;
    await broadcastState(tabId);return;
  }
  if(!contextChanged(s,meta)){
    s.videoKey=key||s.videoKey;s.pageUrl=pageUrl||s.pageUrl;s.mediaSig=mediaSig||s.mediaSig;s.videoMeta={...(s.videoMeta||{}),...meta};
    await broadcastState(tabId);return;
  }
  if(Date.now()-(s.resetAt||0)<600){s.videoKey=key;s.pageUrl=pageUrl;s.mediaSig=mediaSig;s.videoMeta=meta;return}
  const prefs=await getPrefs();
  const mode=prefs.videoChangeMode==='manual'?'manual':'auto';
  const wasAttached=s.attached;
  clearSessionData(tabId,{clearDownload:true,keepMeta:false});
  s.videoKey=key;s.pageUrl=pageUrl;s.mediaSig=mediaSig;s.videoMeta=meta;
  s.videoEvent=mode==='auto'?'new_auto':'new_manual';
  try{if(wasAttached)await chrome.debugger.sendCommand({tabId},'Runtime.evaluate',{expression:'try{performance.clearResourceTimings()}catch(e){}'})}catch{}
  if(mode==='manual'){
    if(wasAttached){try{await chrome.debugger.detach({tabId})}catch{}}
    s.attached=false;s.phase='waiting';
    await broadcastState(tabId);
    void safeRuntimeMessage({type:'VIDEO_SESSION_EVENT',tabId,event:'new_manual',video:publicVideoMeta(meta)});
    void safeTabMessage(tabId,{type:'VIDEO_SESSION_EVENT',tabId,event:'new_manual',video:publicVideoMeta(meta)});
    return;
  }
  if(wasAttached){
    s.attached=true;s.phase='capturing';
    try{await scanPage(tabId,true);setTimeout(()=>scanPage(tabId,true).catch(()=>{}),800)}catch{}
  } else {
    s.attached=false;s.phase='waiting';
  }
  await broadcastState(tabId);
  void safeRuntimeMessage({type:'VIDEO_SESSION_EVENT',tabId,event:'new_auto',video:publicVideoMeta(meta)});
  void safeTabMessage(tabId,{type:'VIDEO_SESSION_EVENT',tabId,event:'new_auto',video:publicVideoMeta(meta)});
}

function markVideoCompleted(tabId,downloadId='') {
  const s=getSession(tabId);
  s.awaitingNewVideo=true;
  s.completedVideoKey=s.videoKey||'';
  s.videoEvent='';
  if(downloadId)s.currentDownloadId=downloadId;
  s.phase='complete';
  broadcastState(tabId);
}

chrome.debugger.onDetach.addListener(source=>{
  if(source.tabId==null)return;
  const s=getSession(source.tabId);s.attached=false;
  if(s.phase==='capturing')s.phase=s.candidates.size?'ready':'waiting';
  broadcastState(source.tabId);
});

chrome.debugger.onEvent.addListener((source,method,params)=>{
  const tabId=source.tabId;if(tabId==null)return;
  const s=getSession(tabId);
  if(method==='Network.requestWillBeSent'){
    const r=params.request||{},meta=s.requests.get(params.requestId)||{};
    meta.url=r.url;meta.method=r.method;meta.requestHeaders={...meta.requestHeaders,...(r.headers||{})};meta.resourceType=params.type||'';meta.epoch=s.epoch||0;s.requests.set(params.requestId,meta);
  }else if(method==='Network.requestWillBeSentExtraInfo'){
    const meta=s.requests.get(params.requestId)||{epoch:s.epoch||0};meta.requestHeaders={...meta.requestHeaders,...(params.headers||{})};s.requests.set(params.requestId,meta);
  }else if(method==='Network.responseReceived'){
    let meta=s.requests.get(params.requestId);if(!meta&&Date.now()-(s.resetAt||0)<1800)return;meta=meta||{epoch:s.epoch||0};if(meta.epoch!==(s.epoch||0))return;
    const r=params.response||{};meta.url=meta.url||r.url;meta.mime=r.mimeType||getHeader(r.headers||{},'content-type');meta.status=r.status||0;meta.responseHeaders=r.headers||{};meta.size=Number(getHeader(r.headers||{},'content-length'))||0;meta.totalSize=parseTotalSize(r.headers||{});s.requests.set(params.requestId,meta);
    addCandidate(tabId,{url:meta.url,mime:meta.mime,status:meta.status,size:meta.size,totalSize:meta.totalSize,requestHeaders:meta.requestHeaders||{},responseHeaders:meta.responseHeaders||{},source:'network',requestId:params.requestId,epoch:meta.epoch},meta.url||'');
  }else if(method==='Network.responseReceivedExtraInfo'){
    const meta=s.requests.get(params.requestId);if(!meta||meta.epoch!==(s.epoch||0))return;meta.responseHeaders={...meta.responseHeaders,...(params.headers||{})};meta.totalSize=parseTotalSize(meta.responseHeaders||{});s.requests.set(params.requestId,meta);if(meta.url)addCandidate(tabId,{...meta,source:'network'},meta.url||'');
  }else if(method==='Network.loadingFinished'){
    const meta=s.requests.get(params.requestId);if(!meta||meta.epoch!==(s.epoch||0))return;if(params.encodedDataLength&&!meta.totalSize)meta.size=Math.max(meta.size||0,Number(params.encodedDataLength)||0);if(meta.url&&isMediaCandidate(meta.url,meta.mime||'',meta.url))addCandidate(tabId,{...meta,source:'network'},meta.url||'');const mime=String(meta.mime||'').toLowerCase();if(mime.includes('json')&&/aweme|detail|feed|recommend|post|search/i.test(meta.url||''))inspectJsonResponse(tabId,params.requestId,meta);
  }
});

const pendingNativeOps=new Map();

function connectNative(){
  if(nativePort)return;
  try{
    nativePort=chrome.runtime.connectNative(HOST_NAME);
    nativePort.onMessage.addListener(msg=>{
      nativeReady=true;
      if(msg?.type==='hello'){nativeHello=msg;for(const [tabId] of sessions)broadcastState(tabId);return}
      if((msg?.type==='operation_result'||msg?.type==='open_result')&&msg.requestId){
        const pending=pendingNativeOps.get(msg.requestId);if(pending){pendingNativeOps.delete(msg.requestId);clearTimeout(pending.timer);msg.ok?pending.resolve(msg):pending.reject(Object.assign(new Error(msg.error||'Native operation failed'),{code:msg.errorCode||''}))}return;
      }
      const downloadId=msg?.downloadId;if(!downloadId){if(msg?.type!=='pong')void safeRuntimeMessage({type:'NATIVE_EVENT',event:msg});return}
      const owner=downloadOwners.get(downloadId)||null;
      const prev=downloadStates.get(downloadId)||{downloadId,mode:'native',createdAt:Date.now()};
      const next={...prev,...msg,mode:'native',updatedAt:Date.now()};
      downloadStates.set(downloadId,next);nativeDownloads.set(downloadId,next);
      if(owner){
        const os=sessions.get(owner)||null,isCurrent=!!os&&(!next.videoKey||!os.videoKey||next.videoKey===os.videoKey);
        if(isCurrent){os.currentDownloadId=downloadId;latestDownloadByTab.set(owner,downloadId);void safeTabMessage(owner,{type:'NATIVE_EVENT',tabId:owner,event:next});void safeRuntimeMessage({type:'NATIVE_EVENT',tabId:owner,event:next});void broadcastState(owner)}
        else void safeRuntimeMessage({type:'QUEUE_EVENT',tabId:owner,event:next});
        if(msg?.type==='complete'){
          if(typeof finalizeDownload==='function')void finalizeDownload(owner,next);
          if(isCurrent)markVideoCompleted(owner,downloadId);
          if(typeof maybeHandleAfterDownload==='function')void maybeHandleAfterDownload(owner,next);
          pruneDownloadStates();
        } else if(msg?.type==='error') {
          if(isCurrent&&os){os.lastError=msg.error||'';os.phase='error';broadcastState(owner)}
          pruneDownloadStates();
        }
      }
    });
    nativePort.onDisconnect.addListener(()=>{
      const err=chrome.runtime.lastError?.message||'Native Helper disconnected';nativePort=null;nativeReady=false;nativeHello=null;
      for(const [id,pending] of pendingNativeOps){clearTimeout(pending.timer);pending.reject(new Error(err));pendingNativeOps.delete(id)}
      for(const [tabId] of sessions)broadcastState(tabId);
    });
    nativePort.postMessage({action:'hello',version:APP_VERSION});
  }catch{nativePort=null;nativeReady=false;nativeHello=null}
}

connectNative();

async function ensureNative(timeoutMs=1600){
  connectNative();
  if(nativeReady&&nativePort&&nativeVersionCompatible())return true;
  const end=Date.now()+timeoutMs;
  while(Date.now()<end){await new Promise(r=>setTimeout(r,50));if(nativeReady&&nativePort&&nativeVersionCompatible())return true;if(!nativePort)break}
  return false;
}

async function nativeRequest(action,payload={},timeoutMs=15000){
  if(!(await ensureNative())){
    if(nativeReady&&nativePort&&!nativeVersionCompatible())throw Object.assign(new Error(`Native Helper v${nativeHello?.version||'?'} không tương thích với Extension v${APP_VERSION}. Hãy chạy lại CAI-DAT-WINDOWS.bat.`),{code:'NATIVE_VERSION'});
    throw Object.assign(new Error('Native Helper chưa kết nối.'),{code:'NATIVE_MISSING'});
  }
  const requestId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pendingNativeOps.delete(requestId);reject(Object.assign(new Error('Native Helper không phản hồi thao tác.'),{code:'NATIVE_TIMEOUT'}))},timeoutMs);
    pendingNativeOps.set(requestId,{resolve,reject,timer});
    try{nativePort.postMessage({action,requestId,...payload})}catch(e){clearTimeout(timer);pendingNativeOps.delete(requestId);reject(e)}
  });
}
