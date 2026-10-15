import {PET_RESOURCE_REVISION} from './local-resource-revision.mjs';

export function matchesPetResourceReceipt(receipt,expected=PET_RESOURCE_REVISION){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||receipt.schema!==1||receipt.revision!==expected.revision||receipt.count!==expected.count||receipt.totalBytes!==expected.totalBytes||!Array.isArray(receipt.files)||receipt.files.length!==expected.files.length)return false;
 return receipt.files.every((file,index)=>{const required=expected.files[index];return file&&typeof file==='object'&&!Array.isArray(file)&&file.path===required.path&&file.size===required.size&&file.sha256===required.sha256;});
}

// Optional same-origin static assets. Every failure keeps the existing CDN base.
export async function resolveLocalPetResources(remoteBase,{win=globalThis,enabled=false}={}){
 if(enabled!==true)return remoteBase;
 let host=null;for(const view of [win,win?.parent,win?.top])try{if(typeof view?.SillyTavern?.getContext==='function'&&/^https?:$/.test(view.location?.protocol)&&typeof view.fetch==='function'){host=view;break;}}catch{}
 if(!host||typeof host.AbortController!=='function'||typeof host.setTimeout!=='function'||typeof host.clearTimeout!=='function')return remoteBase;
 let base,controller;try{base=new URL('/user/files/hypnoos-pet-v6/',host.location.href).href;controller=new host.AbortController();}catch{return remoteBase;}let timer;
 const options={credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal};
 const verify=async()=>{
  const response=await host.fetch(base+'hypnoos-pet-resources.json',{...options,method:'GET'});if(!response.ok)return remoteBase;
  const length=response.headers?.get('content-length');if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>128*1024))return remoteBase;
  const receipt=await response.json();if(!matchesPetResourceReceipt(receipt))return remoteBase;
  let index=0;
  async function worker(){while(!controller.signal.aborted){const entry=PET_RESOURCE_REVISION.files[index++];if(!entry)return;const head=await host.fetch(base+entry.path,{...options,method:'HEAD'});const size=head.headers?.get('content-length');if(!head.ok||typeof size!=='string'||!/^\d+$/.test(size)||Number(size)!==entry.size)throw Error('Local pet file unavailable');}}
  await Promise.all(Array.from({length:Math.min(8,PET_RESOURCE_REVISION.count)},()=>worker()));return !controller.signal.aborted?base:remoteBase;
 };
 try{return await Promise.race([verify(),new Promise(resolve=>{timer=host.setTimeout(()=>{controller.abort();resolve(remoteBase);},1000);})]);}catch{return remoteBase;}finally{host.clearTimeout(timer);controller.abort();}
}
