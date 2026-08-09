let tabId = null;
let state = {attached:false,candidates:[],nativeReady:false};
const $ = s => document.querySelector(s);
const fmtBytes = n => { if(!n)return 'không rõ dung lượng'; const u=['B','KB','MB','GB']; let i=0,x=n; while(x>=1024&&i<u.length-1){x/=1024;i++} return `${x.toFixed(i?1:0)} ${u[i]}`; };
const send = msg => new Promise(resolve => chrome.runtime.sendMessage({...msg,tabId},resolve));
function render(){
  $('#native').classList.toggle('ok',!!state.nativeReady);
  $('#native').title = state.nativeReady ? 'Native Helper: sẵn sàng' : 'Native Helper: chưa cài / chưa kết nối';
  $('#status').textContent = state.attached ? `Đang bắt luồng • ${state.nativeReady?'Turbo native':'Chrome fallback'}` : 'Chưa bắt luồng';
  $('#capture').textContent = state.attached ? 'Dừng bắt' : 'Bắt luồng';
  $('#count').textContent = state.candidates.length;
  $('#best').disabled = !state.candidates.length;
  const list=$('#list'); list.innerHTML='';
  if(!state.candidates.length){list.innerHTML='<div class="empty">Chưa có luồng video.</div>';return;}
  state.candidates.slice(0,10).forEach((c,i)=>{
    const d=document.createElement('div'); d.className='item'+(i===0?' best':'');
    const type=(c.mime||'video').replace('application/vnd.apple.','').replace('video/','').toUpperCase();
    const res=c.width&&c.height?`${c.width}×${c.height} • `:''; const br=c.bitrate?`${(c.bitrate/1000000).toFixed(1)} Mbps • `:'';
    d.innerHTML=`<div class="meta"><div class="name">${type}${i===0?'<span class="badge">BEST</span>':''}</div><div class="sub">${res}${br}${fmtBytes(c.totalSize||c.size)} • score ${c.score}</div></div><button>Tải</button>`;
    d.querySelector('button').onclick=async()=>{const r=await send({type:'DOWNLOAD',candidateId:c.id});if(!r?.ok)alert(r?.error||'Lỗi tải');};
    list.appendChild(d);
  });
}
async function refresh(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); tabId=tab?.id||null;
  if(!tabId){$('#status').textContent='Không tìm thấy tab';return;}
  const r=await send({type:'GET_STATE'}); if(r?.ok){state={attached:r.attached,candidates:r.candidates||[],nativeReady:r.nativeReady};render();}
}
$('#capture').onclick=async()=>{const type=state.attached?'STOP_CAPTURE':'START_CAPTURE';const r=await send({type});if(!r?.ok)alert(r?.error||'Lỗi');await refresh();};
$('#best').onclick=async()=>{const r=await send({type:'DOWNLOAD'});if(!r?.ok)alert(r?.error||'Lỗi tải');};
chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='STATE'&&(!msg.tabId||msg.tabId===tabId)){state.attached=msg.attached;state.candidates=msg.candidates||[];state.nativeReady=msg.nativeReady;render();}if(msg.type==='NATIVE_EVENT'&&msg.event){const e=msg.event;if(e.type==='complete')$('#status').textContent=`Tải xong: ${e.filename||'video'}`;else if(e.type==='progress')$('#status').textContent=`Đang tải ${Number(e.percent||0).toFixed(1)}% ${e.speed||''}`;else if(e.type==='error')$('#status').textContent=`Lỗi: ${e.error||''}`;}});
refresh();
