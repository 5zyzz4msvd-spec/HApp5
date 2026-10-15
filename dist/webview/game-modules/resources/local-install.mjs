import {requireDistributionAccess} from '../distribution/access.mjs';
import {registerResourceMap} from './asset-url.mjs';
export const RESOURCE_INDEX='hypnoos-assets-index-v1.json';
export function resourceFileName(file){return 'hypnoos-asset-'+file.sha256+'.'+file.path.split('.').pop().toLowerCase();}
export function validateResourceManifest(value){
 if(value?.schema!==1||!Array.isArray(value.files)||!value.files.length||value.count!==value.files.length||!/^[a-f0-9]{64}$/.test(value.revision))throw Error('资源清单格式错误');
 const seen=new Set();let total=0;
 for(const f of value.files){if(typeof f.path!=='string'||f.path.startsWith('/')||f.path.includes('\\')||f.path.split('/').some(x=>!x||x==='.'||x==='..')||!/\.(png|jpe?g|webp|gif|svg|m4a|mp3|ogg|wav|mp4|webm|woff2?|json)$/i.test(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.size)||f.size<1||f.size>64*1048576||seen.has(f.path))throw Error('资源清单包含无效文件');seen.add(f.path);total+=f.size;}
 if(total!==value.totalBytes||total>2*1024**3)throw Error('资源总大小错误');return value;
}
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
export function createResourceInstaller({manifest,remoteBase,host,authorize=()=>requireDistributionAccess(host),onProgress=()=>{},timeoutMs=60000}){
 validateResourceManifest(manifest);const context=()=>host.SillyTavern.getContext();
 const headers=()=>{const get=context()?.getRequestHeaders??host.getRequestHeaders;if(typeof get!=='function')throw Error('酒馆文件保存接口尚未就绪');return get();};
 const indexUrl=new URL('/user/files/'+RESOURCE_INDEX,host.location.href).href;
 const localUrl=file=>new URL('/user/files/'+resourceFileName(file),host.location.href).href;
 let receipt={schema:1,revision:manifest.revision,files:{}},completed=new Set(),running=null,saveChain=Promise.resolve();
 async function request(url,options={},read="json"){authorize();const controller=new host.AbortController(),timer=host.setTimeout(()=>controller.abort(),timeoutMs);try{const response=await host.fetch(url,{...options,signal:controller.signal,redirect:'error'});if(!response.ok)throw Error('资源请求失败（'+response.status+'）');return await response[read]();}finally{host.clearTimeout(timer);}}
 const notify=()=>onProgress({complete:completed.size,count:manifest.count,bytes:manifest.files.reduce((n,f)=>n+(completed.has(f.path)?f.size:0),0),totalBytes:manifest.totalBytes});
 async function verify(){
  authorize();try{const saved=await request(indexUrl,{credentials:'same-origin',cache:'no-store'});if(saved?.schema===1&&saved.files&&typeof saved.files==='object')receipt={schema:1,revision:manifest.revision,files:saved.files};}catch{}
  const candidates=manifest.files.filter(f=>receipt.files[f.path]===f.sha256);
  for(let i=0;i<candidates.length;i+=100){const group=candidates.slice(i,i+100);const valid=await request('/api/files/verify',{method:'POST',credentials:'same-origin',headers:headers(),body:JSON.stringify({urls:group.map(f=>'user/files/'+resourceFileName(f))})});for(const file of group)if(valid['user/files/'+resourceFileName(file)]===true)completed.add(file.path);}
  notify();return completed.size===manifest.count;
 }
 async function upload(name,data){const result=await request('/api/files/upload',{method:'POST',credentials:'same-origin',headers:headers(),body:JSON.stringify({name,data})});const expected=new URL('/user/files/'+name,host.location.href);if(new URL('/'+String(result.path??'').replace(/^\//,''),host.location.href).href!==expected.href)throw Error('本地资源保存路径不一致');}
 const base64=bytes=>{let binary='';const array=new Uint8Array(bytes);for(let i=0;i<array.length;i+=32768)binary+=String.fromCharCode(...array.subarray(i,i+32768));return host.btoa(binary);};
 const save=()=>{const saved=JSON.stringify(receipt);saveChain=saveChain.catch(()=>{}).then(()=>upload(RESOURCE_INDEX,base64(new TextEncoder().encode(saved))));return saveChain;};
 async function install(){if(running)return running;running=(async()=>{
  saveChain=saveChain.catch(()=>{});let cursor=0,failure=null;const pending=manifest.files.filter(f=>!completed.has(f.path));
  async function worker(){while(!failure){const file=pending[cursor++];if(!file)return;try{authorize();const bytes=await request(new URL(file.path,remoteBase).href,{credentials:'omit',cache:'force-cache'},'arrayBuffer');if(bytes.byteLength!==file.size||hex(await host.crypto.subtle.digest('SHA-256',bytes))!==file.sha256)throw Error('文件校验未通过：'+file.path);await upload(resourceFileName(file),base64(bytes));completed.add(file.path);receipt.files[file.path]=file.sha256;notify();await save();}catch(error){failure=error;}}}
  await Promise.all(Array.from({length:4},worker));await saveChain;if(failure)throw failure;if(completed.size!==manifest.count)throw Error('资源尚未完整保存');await save();return activate();
 })().finally(()=>{running=null;});return running;}
 function activate(){authorize();if(completed.size!==manifest.count)throw Error('资源未完整安装');const entries=manifest.files.map(f=>[f.path,localUrl(f)]);registerResourceMap(remoteBase,entries);return {revision:manifest.revision,count:manifest.count,entries};}
 return{verify,install,activate,get complete(){return completed.size===manifest.count;}};
}
export async function prepareRuntimeResources({remoteBase,win=globalThis,force=false}){
 const host=requireDistributionAccess(win),key='__HYPNOOS_RESOURCE_INSTALL_V1__';
 if(!force&&host[key]?.base===remoteBase){const installed=await host[key].promise;registerResourceMap(remoteBase,installed.entries);return installed;}
 const doc=win.document,overlay=doc.createElement('section');overlay.className='hypnoos-resource-setup';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','首次启动资源下载');
 overlay.innerHTML='<style>.hypnoos-resource-setup{position:fixed;inset:0;z-index:2147483500;display:grid;place-items:center;background:#12131fc9;backdrop-filter:blur(18px);color:#eee9f5;font:14px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;padding:24px;box-sizing:border-box}.hr-card{width:min(470px,100%);padding:32px;border:1px solid #ffffff20;border-radius:28px;background:linear-gradient(145deg,#353044,#211f2c);box-shadow:0 24px 90px #0007;box-sizing:border-box}.hr-card small{color:#c9b9d9;letter-spacing:.16em}.hr-card h1{font-size:25px;margin:10px 0 16px}.hr-card p{color:#cec7d8;margin:12px 0}.hr-card progress{width:100%;height:8px;accent-color:#c4a6e0}.hr-card button{width:100%;border:0;border-radius:15px;padding:13px;background:#dbc4ef;color:#31283d;font:600 15px system-ui;margin-top:16px;cursor:pointer}.hr-card button:disabled{opacity:.6;cursor:wait}.hr-card [role=alert]{color:#f0b9bf;overflow-wrap:anywhere}.hr-card .hr-meta{font-size:12px;color:#a99bb9}</style><div class="hr-card"><small>WELCOME TO HYPNOOS</small><h1>先准备好你的世界</h1><p>首次启动需要下载图片和音乐。资源会保存在当前酒馆用户的配套资源目录，完成后才能进入游戏。</p><p data-size>正在读取资源清单…</p><progress max="1" value="0" aria-label="资源下载进度"></progress><p role="status">已有文件会自动检查；中断后可继续下载。</p><p role="alert"></p><p class="hr-meta">保存在酒馆 user/files 中，不包含聊天记录或角色状态。</p><button type="button" disabled>准备中</button></div>';
 doc.body.append(overlay);const button=overlay.querySelector('button'),status=overlay.querySelector('[role=status]'),error=overlay.querySelector('[role=alert]'),progress=overlay.querySelector('progress');
 let installer;const onProgress=value=>{progress.max=value.totalBytes;progress.value=value.bytes;status.textContent=value.complete+' / '+value.count+' 个文件 · '+(value.bytes/1048576).toFixed(1)+' / '+(value.totalBytes/1048576).toFixed(1)+' MB';};
 const promise=new Promise((resolve,reject)=>{
  let busy=false;
  const run=async()=>{if(busy)return;busy=true;button.disabled=true;error.textContent='';try{requireDistributionAccess(win);if(!installer){const controller=new host.AbortController(),timer=host.setTimeout(()=>controller.abort(),20000);let response;try{response=await host.fetch(new URL('../resource-manifest.json',remoteBase).href,{signal:controller.signal,credentials:'omit',cache:'no-cache'});if(!response.ok)throw Error('资源清单暂时无法读取');const manifest=validateResourceManifest(await response.json());overlay.querySelector('[data-size]').textContent=manifest.count+' 个文件，约 '+Math.ceil(manifest.totalBytes/1048576)+' MB。只需下载一次，更新时仅补充变化的文件。';installer=createResourceInstaller({manifest,remoteBase,host,authorize:()=>requireDistributionAccess(win),onProgress});}finally{host.clearTimeout(timer);}if(await installer.verify()){const result=installer.activate();overlay.remove();resolve(result);return;}button.textContent='下载资源并开始';return;}
   button.textContent='正在下载…';const result=await installer.install();overlay.remove();resolve(result);
  }catch(cause){error.textContent=String(cause.message??cause);button.textContent=installer?'继续下载':'重试读取清单';}finally{busy=false;button.disabled=false;}};
  button.addEventListener('click',()=>void run());void run();
  win.addEventListener('pagehide',()=>{overlay.remove();reject(Error('资源准备页面已关闭'));},{once:true});
 });
 host[key]={base:remoteBase,promise};try{return await promise;}catch(error){if(host[key]?.promise===promise)delete host[key];throw error;}
}
