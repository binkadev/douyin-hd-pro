async function getPageMeta(tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({target:{tabId}, func:() => {
      const og = (n) => document.querySelector(`meta[property="${n}"]`)?.content || '';
      const title = og('og:title') || document.title || 'Douyin video';
      const author = document.querySelector('[data-e2e="video-author-uniqueid"]')?.textContent?.trim() || document.querySelector('[class*="author"]')?.textContent?.trim() || '';
      return {title, author, pageUrl:location.href};
    }});
    return r?.result || {};
  } catch {
    const tab = await chrome.tabs.get(tabId);
    return {title:tab.title || 'Douyin video', author:'', pageUrl:tab.url || ''};
  }
}

function filenameFromMeta(meta, mode = 'author_title') {
  const title = (meta.title || 'Douyin video').replace(/\s*-\s*抖音.*$/i, '').trim();
  const author = (meta.author || '').trim();
  const date = new Date().toISOString().slice(0,10);
  let name = title;
  if (mode === 'author_title') name = `${author ? author + ' - ' : ''}${title}`;
  else if (mode === 'date_title') name = `${date} - ${title}`;
  return name.slice(0, 140) || 'Douyin video';
}

async function downloadCandidate(tabId, candidateId = null) {
  const s = getSession(tabId);
  await scanPage(tabId, false);
  const arr = [...s.candidates.values()].sort((a,b) => b.score - a.score);
  const c = candidateId ? arr.find(x => x.id === candidateId) : arr[0];
  if (!c) throw new Error('Chưa bắt được luồng video. Hãy cho video chạy 2–3 giây rồi thử lại.');
  const meta = await getPageMeta(tabId);
  const settings = await chrome.storage.sync.get({filenameMode:'author_title'});
  const fileBase = filenameFromMeta(meta, settings.filenameMode);
  const payload = {action:'download',downloadId:crypto.randomUUID(),url:c.url,mime:c.mime||'',headers:cleanRequestHeaders(c.requestHeaders||{}),filename:fileBase,pageUrl:meta.pageUrl||'',expectedSize:c.totalSize||c.size||0,score:c.score||0};
  downloadOwners.set(payload.downloadId, tabId);
  latestDownloadByTab.set(tabId, payload.downloadId);
  s.awaitingNewVideo = false;
  s.videoEvent = '';
  downloadStates.set(payload.downloadId, {type:'started',downloadId:payload.downloadId,mode:'native',percent:0,bytes:0,total:payload.expectedSize||0,candidate:publicCandidate(c),videoKey:s.videoKey||'',updatedAt:Date.now()});
  if (await ensureNative()) {
    try {
      nativePort.postMessage(payload);
      broadcastState(tabId);
      return {mode:'native',downloadId:payload.downloadId,candidate:publicCandidate(c)};
    } catch {}
  }
  const ext = /m3u8/i.test(c.url + c.mime) ? '.m3u8' : '.mp4';
  const browserId = await chrome.downloads.download({url:c.url,filename:`DouyinHD/${fileBase}${ext}`,conflictAction:'uniquify',saveAs:false});
  const did = payload.downloadId;
  browserDownloads.set(browserId, {downloadId:did,tabId});
  downloadStates.set(did, {type:'started',downloadId:did,mode:'browser',browserId,percent:0,bytes:0,total:payload.expectedSize||0,candidate:publicCandidate(c),videoKey:s.videoKey||'',updatedAt:Date.now()});
  broadcastState(tabId);
  return {mode:'browser',downloadId:did,browserId,candidate:publicCandidate(c)};
}

async function maybeHandleAfterDownload(tabId, downloadState) {
  if (!downloadState || downloadState.type !== 'complete') return;
  try {
    const {afterDownload='ask'} = await chrome.storage.sync.get({afterDownload:'ask'});
    if (afterDownload === 'open_file') {
      if (downloadState.mode === 'browser' && Number.isInteger(Number(downloadState.browserId))) await chrome.downloads.open(Number(downloadState.browserId));
      else if (downloadState.path) await nativeRequest('open_file', {path:String(downloadState.path)});
    } else if (afterDownload === 'open_folder') {
      if (downloadState.mode === 'browser' && Number.isInteger(Number(downloadState.browserId))) chrome.downloads.show(Number(downloadState.browserId));
      else await nativeRequest('open_folder', {path:String(downloadState.path || '')});
    }
  } catch (e) {
    void safeRuntimeMessage({type:'POST_DOWNLOAD_ACTION_ERROR',tabId,error:e?.message||String(e)});
  }
}

chrome.downloads.onChanged.addListener(async delta => {
  const meta = browserDownloads.get(delta.id);
  if (!meta) return;
  try {
    const [item] = await chrome.downloads.search({id:delta.id});
    if (!item) return;
    const total=Number(item.totalBytes||0),bytes=Number(item.bytesReceived||0),complete=item.state==='complete',interrupted=item.state==='interrupted';
    const prev=downloadStates.get(meta.downloadId)||{downloadId:meta.downloadId,mode:'browser',browserId:delta.id};
    const next={...prev,type:complete?'complete':interrupted?'error':'progress',mode:'browser',browserId:delta.id,bytes,total,percent:total?bytes*100/total:0,filename:item.filename?item.filename.split(/[\\/]/).pop():'',path:item.filename||'',error:interrupted?(item.error||'Chrome download interrupted'):'',updatedAt:Date.now()};
    downloadStates.set(meta.downloadId,next);const os=getSession(meta.tabId);if(!next.videoKey||!os.videoKey||next.videoKey===os.videoKey)latestDownloadByTab.set(meta.tabId,meta.downloadId);
    void safeRuntimeMessage({type:'NATIVE_EVENT',tabId:meta.tabId,event:next});void safeTabMessage(meta.tabId,{type:'NATIVE_EVENT',tabId:meta.tabId,event:next});void broadcastState(meta.tabId);
    if (complete) { const os=getSession(meta.tabId);if(!next.videoKey||!os.videoKey||next.videoKey===os.videoKey)markVideoCompleted(meta.tabId);void maybeHandleAfterDownload(meta.tabId,next); }
    if (complete||interrupted) browserDownloads.delete(delta.id);
  } catch {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = msg.tabId || sender.tab?.id;
    if (msg.type === 'GET_STATE') {
      const id = tabId || (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id;
      if (!id) throw new Error('Không tìm thấy tab hiện tại.');
      const tab=await chrome.tabs.get(id);const s=isDouyinUrl(tab?.url||'')?getSession(id):null;const lastId=latestDownloadByTab.get(id);
      sendResponse({ok:true,tabId:id,attached:!!s?.attached,candidates:s?[...s.candidates.values()].sort((a,b)=>b.score-a.score).slice(0,20).map(publicCandidate):[],nativeReady,isDouyin:isDouyinUrl(tab?.url||''),download:lastId?downloadStates.get(lastId)||null:null,awaitingNewVideo:!!s?.awaitingNewVideo,videoKey:s?.videoKey||'',videoEvent:s?.videoEvent||''});
      return;
    }
    if (msg.type === 'GET_NATIVE_SETTINGS') {
      const r=await nativeRequest('get_settings',{},5000);sendResponse({ok:true,saveFolder:r.saveFolder||''});return;
    }
    if (msg.type === 'CHOOSE_FOLDER') {
      const r=await nativeRequest('choose_folder',{initialPath:String(msg.initialPath||'')},60000);sendResponse({ok:!!r.ok,cancelled:!!r.cancelled,saveFolder:r.saveFolder||'',error:r.error||''});return;
    }
    if (!tabId) throw new Error('Không tìm thấy tab Douyin.');
    if (msg.type === 'VIDEO_CONTEXT') {
      await handleVideoContext(tabId,msg.context||{});sendResponse({ok:true});
    } else if (msg.type === 'RESET_VIDEO') {
      await resetCurrentVideo(tabId,{keepAttached:false,clearDownload:true});sendResponse({ok:true});
    } else if (msg.type === 'START_CAPTURE') {
      const s=getSession(tabId);s.awaitingNewVideo=false;s.videoEvent='';await startCapture(tabId,false);sendResponse({ok:true});
    } else if (msg.type === 'STOP_CAPTURE') {
      await stopCapture(tabId);sendResponse({ok:true});
    } else if (msg.type === 'SCAN_PAGE') {
      await scanPage(tabId,false);sendResponse({ok:true});
    } else if (msg.type === 'DOWNLOAD') {
      const r=await downloadCandidate(tabId,msg.candidateId||null);sendResponse({ok:true,...r});
    } else if (msg.type === 'QUICK_START') {
      const s=getSession(tabId);s.awaitingNewVideo=false;s.videoEvent='';await startCapture(tabId,false);sendResponse({ok:true});
    } else if (msg.type === 'QUICK_DOWNLOAD') {
      const r=await downloadCandidate(tabId,null);sendResponse({ok:true,...r});
    } else if (msg.type === 'PING_NATIVE') {
      connectNative();sendResponse({ok:true,nativeReady});
    } else if (msg.type === 'OPEN_FILE') {
      if (msg.mode === 'browser' && Number.isInteger(Number(msg.browserId))) {await chrome.downloads.open(Number(msg.browserId));sendResponse({ok:true,mode:'browser'});} else {if(!msg.path)throw new Error('Chưa có đường dẫn file đã tải.');const r=await nativeRequest('open_file',{path:String(msg.path)});sendResponse({ok:!!r.ok,mode:'native'});}
    } else if (msg.type === 'OPEN_FOLDER') {
      if (msg.mode === 'browser' && Number.isInteger(Number(msg.browserId))) {chrome.downloads.show(Number(msg.browserId));sendResponse({ok:true,mode:'browser'});} else {const r=await nativeRequest('open_folder',{path:String(msg.path||'')});sendResponse({ok:!!r.ok,mode:'native'});}
    } else sendResponse({ok:false,error:'Lệnh không hỗ trợ'});
  })().catch(err=>sendResponse({ok:false,error:err?.message||String(err)}));
  return true;
});
