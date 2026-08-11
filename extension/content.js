(async()=>{
  if(window.__DYHD_PRO_V2__)return;window.__DYHD_PRO_V2__=true;
  let lang=await DYHD_I18N.getLanguage();
  const t=(key,vars={})=>DYHD_I18N.t(lang,key,vars);
  let prefs=await chrome.storage.sync.get({qualityMode:'best',floatingVisibility:'always',floatingSide:'right',floatingVertical:'middle'});
  let lastContextKey='',state={phase:'waiting',candidates:[],download:null,video:null};

  const btn=document.createElement('button');btn.id='dyhd-pro-btn';btn.type='button';
  const icon=document.createElement('span');icon.className='dyhd-icon';icon.textContent='↓';
  const label=document.createElement('span');label.className='dyhd-label';label.textContent=t('quickDownload');
  const toast=document.createElement('div');toast.id='dyhd-pro-toast';
  btn.append(icon,label);document.documentElement.append(btn,toast);
  let toastTimer;

  const send=msg=>new Promise(resolve=>chrome.runtime.sendMessage(msg,r=>{const e=chrome.runtime.lastError;resolve(e?{ok:false,error:e.message}:r)}));
  const show=(text,ms=2800,error=false)=>{clearTimeout(toastTimer);toast.textContent=text;toast.classList.toggle('error',!!error);toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),ms)};
  const canonicalMedia=src=>{try{const u=new URL(src);return `${u.hostname}${u.pathname}`}catch{return String(src||'').slice(0,260)}};
  const visibleRatio=el=>{const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)return 0;const iw=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));const ih=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));return iw*ih/(r.width*r.height)};
  const videoScore=v=>{const r=v.getBoundingClientRect(),ratio=visibleRatio(v);const cx=r.left+r.width/2,cy=r.top+r.height/2,dist=Math.hypot(cx-innerWidth/2,cy-innerHeight/2)/Math.max(innerWidth,innerHeight);return ratio*100+(v.paused?0:28)+(v.readyState>=2?8:0)+(v.muted?0:2)-dist*18};
  const activeVideo=()=>{const all=[...document.querySelectorAll('video')];const visible=all.filter(v=>visibleRatio(v)>.04).sort((a,b)=>videoScore(b)-videoScore(a));if(visible[0])return visible[0];const playing=all.filter(v=>!v.paused&&v.readyState>=2).sort((a,b)=>videoScore(b)-videoScore(a));return playing[0]||null};

  function findVideoAnchor(v){
    let n=v;
    for(let i=0;i<8&&n;i++,n=n.parentElement){const a=n.querySelector?.('a[href*="/video/"]');if(a)return a}
    return document.querySelector('a[href*="/video/"][aria-current="page"]');
  }
  function textFrom(root,selectors){for(const s of selectors){const el=root?.querySelector?.(s)||document.querySelector(s);const text=el?.textContent?.trim();if(text&&text.length<500)return text}return ''}
  function buildContext(){
    const v=activeVideo();
    const anchor=v?findVideoAnchor(v):null;
    const url=anchor?.href||location.href;
    let videoId='';
    try{const u=new URL(url,location.href);videoId=(u.pathname.match(/\/video\/(\d+)/)||[])[1]||u.searchParams.get('modal_id')||u.searchParams.get('aweme_id')||''}catch{}
    if(!videoId){videoId=(location.pathname.match(/\/video\/(\d+)/)||[])[1]||new URL(location.href).searchParams.get('modal_id')||''}
    const root=(()=>{let n=v;for(let i=0;i<6&&n;i++,n=n.parentElement){if(n.querySelector?.('[data-e2e="video-desc"], [data-e2e="video-author-uniqueid"], a[href*="/video/"]'))return n}return v?.parentElement||document})();
    const og=n=>document.querySelector(`meta[property="${n}"]`)?.content||'';
    let title=textFrom(root,['[data-e2e="video-desc"]','[class*="video-desc"]','[class*="desc"]','[class*="title"]']);
    if(!title)title=og('og:title')||document.title||'Douyin video';
    title=title.replace(/\s*[-|]\s*抖音.*$/i,'').trim().slice(0,220);
    let author=textFrom(root,['[data-e2e="video-author-uniqueid"]','[class*="author"] a','[class*="author"]']);
    author=author.replace(/^@/,'').trim().slice(0,80);
    const thumbnail=v?.poster||og('og:image')||root?.querySelector?.('img')?.src||'';
    const src=v?.currentSrc||v?.src||'';
    const mediaSig=canonicalMedia(src||thumbnail||url);
    const key=videoId?`id:${videoId}`:`media:${mediaSig}|${title.slice(0,60)}`;
    return {key,videoId,title,author,thumbnail,pageUrl:location.href,mediaSig};
  }

  function applyPrefs(){
    btn.dataset.visibility=prefs.floatingVisibility||'always';
    btn.dataset.side=prefs.floatingSide||'right';
    btn.dataset.vertical=prefs.floatingVertical||'middle';
  }
  function bestLabel(){const c=state.candidates?.[0];if(!c)return '';if(c.width&&c.height)return `${Math.min(c.width,c.height)}p`;if(c.quality)return String(c.quality).toUpperCase();return 'HD'}
  function renderButton(){
    const phase=state.phase||'waiting';btn.classList.toggle('busy',phase==='downloading'||phase==='capturing');btn.classList.toggle('done',phase==='complete');
    if(phase==='downloading'){const p=Number(state.download?.percent);label.textContent=Number.isFinite(p)&&p>0?`${Math.round(p)}%`:t('downloading');icon.textContent='↓'}
    else if(phase==='complete'){label.textContent=t('alreadyDownloadedShort');icon.textContent='✓'}
    else if(phase==='ready'){label.textContent=`${bestLabel()} · ${t('download')}`;icon.textContent='↓'}
    else if(phase==='capturing'){label.textContent=t('analyzingShort');icon.textContent='…'}
    else if(phase==='error'){label.textContent=t('retry');icon.textContent='↻'}
    else{label.textContent=t('quickDownload');icon.textContent='↓'}
  }

  async function reportContext(force=false){
    const ctx=buildContext();
    const sig=JSON.stringify([ctx.key,ctx.title,ctx.author,ctx.thumbnail]);
    if(force||sig!==lastContextKey){lastContextKey=sig;await send({type:'VIDEO_CONTEXT',context:ctx})}
  }

  btn.addEventListener('click',async()=>{
    if(state.phase==='downloading'){show(t('downloadStillRunning'));return}
    if(state.phase==='complete'){show(t('alreadyDownloadedHint'));return}
    btn.classList.add('busy');
    try{
      await reportContext(true);
      if(state.phase!=='ready'){
        let r=await send({type:'QUICK_START'});if(!r?.ok)throw new Error(r?.error||t('cannotCapture'));
        show(t('analyzing'),1600);await new Promise(r=>setTimeout(r,1400));await send({type:'SCAN_PAGE'});
      }
      const r=await send({type:'QUICK_DOWNLOAD',qualityMode:prefs.qualityMode||'best'});
      if(!r?.ok)throw new Error(r?.error||t('cannotDownload'));
      if(r.needsChoice){show(t('openPopupChooseQuality'),4200);return}
      if(r.duplicate){show(r.skipped?t('duplicateSkipped'):t('duplicateOpenPopup'),4300);return}
      show(r.mode==='native'?t('sentNative'):t('chromeFallback'),3000);
    }catch(e){show(e.message||String(e),5200,true)}finally{btn.classList.remove('busy')}
  });

  chrome.runtime.onMessage.addListener(msg=>{
    if(msg.type==='STATE'){
      state={...state,phase:msg.phase||state.phase,candidates:msg.candidates||[],download:msg.download||null,video:msg.video||state.video};renderButton();
    }else if(msg.type==='VIDEO_SESSION_EVENT'){
      reportContext(true);if(msg.event==='new_manual')show(t('manualCaptureRequired'),3300);else if(msg.event==='new_auto')show(t('autoCaptureNewVideo'),2200);
    }else if(msg.type==='NATIVE_EVENT'&&msg.event){state.download={...(state.download||{}),...msg.event};if(['queued','started','progress','verifying','merging'].includes(msg.event.type))state.phase='downloading';if(msg.event.type==='complete')state.phase='complete';if(msg.event.type==='error')state.phase='error';renderButton()}
  });

  chrome.storage.onChanged.addListener(async(changes,area)=>{
    if(area!=='sync')return;
    if(changes.language){lang=DYHD_I18N.normalize(changes.language.newValue);renderButton()}
    for(const k of ['qualityMode','floatingVisibility','floatingSide','floatingVertical'])if(changes[k])prefs[k]=changes[k].newValue;
    applyPrefs();
  });

  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(()=>reportContext(false),180)});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','poster']});
  let lastHref=location.href;
  setInterval(()=>{if(location.href!==lastHref){lastHref=location.href;reportContext(true)}else reportContext(false)},750);
  applyPrefs();renderButton();await reportContext(true);
})();
