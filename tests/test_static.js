const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
global.window={};
global.chrome={storage:{sync:{get:async d=>d,set:async()=>{}}}};
for(const f of ['extension/i18n.js','extension/i18n-v200-vi.js','extension/i18n-v200-en.js','extension/i18n-v200-extra.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
const I=window.DYHD_I18N;
function assert(c,m){if(!c)throw new Error(m)}
assert(I.LANGUAGES.length===10,'runtime language list must contain exactly 10 languages');
const vi=I.dict.vi,en=I.dict.en;
const v2Keys=Object.keys(vi).filter(k=>Object.prototype.hasOwnProperty.call(en,k));
for(const k of Object.keys(vi))assert(en[k]!==undefined,`English missing i18n key: ${k}`);
for(const {code} of I.LANGUAGES){assert(I.dict[code],`Missing runtime dictionary: ${code}`);for(const k of v2Keys)assert(I.dict[code][k]!==undefined,`${code} cannot resolve key ${k}`)}
const html=fs.readFileSync(path.join(root,'extension/popup.html'),'utf8');
const js=['extension/popup-core.js','extension/popup-actions.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
for(const m of js.matchAll(/\$\('#([^']+)'\)/g)){const id=m[1];if(id==='openReleaseNow')continue;assert(ids.has(id),`popup.js references missing #${id}`)}
assert(!/@font-face|fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(fs.readFileSync(path.join(root,'extension/popup.css'),'utf8')),'Popup must not depend on remote/font binaries');
console.log('OK: i18n + popup static checks');
