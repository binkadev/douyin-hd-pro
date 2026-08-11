(async()=>{
  if(window.__DYHD_PRO_LOADED__)return;window.__DYHD_PRO_LOADED__=true;
  let lang=await DYHD_I18N.getLanguage();const t=(key,vars={})=>DYHD_I18N.t(lang,key,vars);
  const btn=document.createElement('button');btn.id='dyhd-pro-btn';
  const toast=document.createElement('div');toast.id='dyhd-pro-toast';
  const progress=document.createElement('span');progress.className='dyhd-progress';btn.append(document.createTextNode(t('quickDownload')),progress);
  document.documentElement.append(btn,toast);
  let toastTimer;const setButton=(busy=false)=>{btn.childNodes[0].nodeValue=busy?t('quickCapturing'):t('quickDownload');};
  const show=(text,ms=2600)=>{clearTimeout(toastTimer);toast.textContent=text;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),ms)};
  const send=msg=>new Promise(resolve=>chrome.runtime.sendMessage(msg,resolve));
  btn.addEventListener('click',async()=>{btn.classList.add('dyhd-busy');setButton(true);progress.textContent='';try{const v=[...document.querySelectorAll('video')].find(x=>!x.paused)||document.querySelector('video');let r=await send({type:'QUICK_START'});if(!r?.ok)throw new Error(r?.error||t('cannotCapture'));if(v){try{await v.play()}catch{}}show(t('analyzing'),2200);await new Promise(r=>setTimeout(r,1800));await send({type:'SCAN_PAGE'});r=await send({type:'QUICK_DOWNLOAD'});if(!r?.ok)throw new Error(r?.error||t('cannotDownload'));show(r.mode==='native'?t('sentNative'):t('chromeFallback'),3200);setTimeout(()=>send({type:'STOP_CAPTURE'}),600)}catch(e){show(e.message||String(e),5000)}finally{btn.classList.remove('dyhd-busy');setButton(false)}});
  chrome.runtime.onMessage.addListener(msg=>{if(msg.type!=='NATIVE_EVENT'||!msg.event)return;const e=msg.event;if(e.type==='progress'){const p=typeof e.percent==='number'?e.percent.toFixed(0):'';progress.textContent=p?` ${p}%`:'';show(t('downloadProgress',{percent:p||'…',speed:e.speed||''}),1200)}else if(e.type==='complete'){progress.textContent='';show(t('downloadComplete',{filename:e.filename||'video'}),4500)}else if(e.type==='error'){progress.textContent='';show(t('downloadError',{error:e.error||''}),6000)}});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes.language){lang=DYHD_I18N.normalize(changes.language.newValue);setButton(btn.classList.contains('dyhd-busy'))}});
})();
