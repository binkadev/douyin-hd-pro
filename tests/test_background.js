const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const noop=()=>{};
const asyncNoop=async()=>{};
const fakePort={onMessage:{addListener:noop},onDisconnect:{addListener:noop},postMessage:noop};
const syncStore={};
const localStore={};
const makeStore=store=>({
  async get(defaults={}){return {...defaults,...store}},
  async set(values={}){Object.assign(store,values)},
  async clear(){for(const k of Object.keys(store))delete store[k]}
});
global.chrome={
  tabs:{get:async id=>({id,url:'https://www.douyin.com/video/123'}),query:async()=>[{id:1,url:'https://www.douyin.com/video/123'}],sendMessage:asyncNoop,create:asyncNoop,onRemoved:{addListener:noop}},
  runtime:{sendMessage:asyncNoop,connectNative:()=>fakePort,onMessage:{addListener:noop},lastError:null},
  storage:{sync:makeStore(syncStore),local:makeStore(localStore)},
  debugger:{attach:asyncNoop,detach:asyncNoop,sendCommand:async()=>({result:{value:[]}}),onDetach:{addListener:noop},onEvent:{addListener:noop}},
  downloads:{download:async()=>1,search:async()=>[],open:asyncNoop,show:noop,onChanged:{addListener:noop}},
  scripting:{executeScript:async()=>[{result:{title:'T',author:'A',videoId:'123',key:'id:123',pageUrl:'https://www.douyin.com/video/123'}}]}
};
global.crypto=require('crypto').webcrypto;
global.fetch=async()=>({ok:true,json:async()=>({tag_name:'v2.0.1',html_url:'https://example.invalid/release'})});
for(const f of ['extension/background/core.js','extension/background/capture.js','extension/background/library.js','extension/background/download.js']){
  vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
}
function assert(cond,msg){if(!cond)throw new Error(msg)}
const a={id:'a',url:'https://x/video.mp4?720',mime:'video/mp4',mediaKind:'video',width:720,height:1280,bitrate:2_000_000,totalSize:10_000_000,score:100};
const b={id:'b',url:'https://x/video.mp4?1080',mime:'video/mp4',mediaKind:'video',width:1080,height:1920,bitrate:5_000_000,totalSize:20_000_000,score:200};
assert(selectCandidate([a,b],'1080').id==='b','1080 selection failed');
assert(selectCandidate([a,b],'720').id==='a','720 selection failed');
assert(selectCandidate([a,b],'smallest').id==='a','smallest selection failed');
assert(renderTemplate('{date}/{author}/{video_id}',{author:'abc',videoId:'123'}).endsWith('/abc/123'),'template failed');
assert(nativeVersionCompatible('2.9.0'),'compatible native major should pass');
assert(!nativeVersionCompatible('1.9.9'),'incompatible native major should fail');
(async()=>{const u=await checkForUpdate();assert(u.available&&u.latest==='2.0.1','update checker failed');console.log('OK: background smoke tests')})().catch(e=>{console.error(e);process.exit(1)});
