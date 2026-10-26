(function(){
function r6f2(start=globalThis){
 const w=[2190943589,2033026848,544194663,450787296,1646768177,1302463522,229834302,1276447281,2094063595,1765762346,672012943,3423290373,2609025748,2094420645,272459328,2380339621,338041316,2101271172,2140164186,322790753,2094063595,1765762346,1419583000,45457998,2190771153,1478107519,152257955,2260374235,1691466576,111759868,2411441414,2517573664,1010437396,3264965597,2202380563,3563633864,3321775072,78701521,2676961402,531365767,1710505822,3626528724,3638673662,3236781183,21221223,3429029295,1119464178,529415545,4088631661,1204255023,2900360431,3727006709,1131432182,2955630924,2354998357,1197519201,164710743,686532180],k=[2942192797,2090310455,3992063611,3074796867].map(x=>(x^3838045556)>>>0),bytes=[];
 for(let i=0;i<w.length;i+=2){let a=w[i],b=w[i+1],sum=0xc6ef3720;for(let j=0;j<32;j++){b=(b-(((((a<<4)^(a>>>5))+a)>>>0)^((sum+k[(sum>>>11)&3])>>>0)))>>>0;sum=(sum-0x9e3779b9)>>>0;a=(a-(((((b<<4)^(b>>>5))+b)>>>0)^((sum+k[sum&3])>>>0)))>>>0;}for(const v of [a,b])for(let n=0;n<4;n++)bytes.push((v>>>(n*8))&255);}
 const len=(bytes[0]|bytes[1]<<8|bytes[2]<<16|bytes[3]<<24)>>>0;let p;try{p=JSON.parse(String.fromCharCode(...bytes.slice(4,4+len)));}catch{return{ok:false,code:0,host:start};}
 let host,context;const views=[];for(const v of [start,start?.parent,start?.top])try{if(v&&!views.includes(v))views.push(v);}catch{}
 for(const v of views.reverse())try{if(typeof v?.[p[0]]?.[p[1]]==='function'){host=v;context=v[p[0]][p[1]]();break;}}catch{}
 const fail=code=>({ok:false,code,host:host??start,reason:p[11]});if(!host)return fail(p[12]);const id=context?.[p[3]]??context?.[p[4]],actor=id==null?null:context?.[p[2]]?.[id];if(!actor)return fail(p[13]);const card=actor[p[5]]&&typeof actor[p[5]]==='object'?actor[p[5]]:actor;const marked=x=>typeof x==='string'&&x.includes(p[10]);if(!marked(card[p[6]])||(actor[p[6]]!==undefined&&!marked(actor[p[6]])))return fail(p[14]);const book=card[p[7]]?.[p[6]],binding=card[p[8]]?.[p[9]];if(!marked(book)||!marked(binding))return fail(p[15]);if(book!==binding)return fail(p[16]);return{ok:true,host,context,card};
}
function inspectDistributionContext(start=globalThis){return r6f2(start);}
function reportDistributionFailure(host,reason,options={}){
 try{const doc=host?.document;if(!doc?.body)return;if(doc.getElementById('hypnoos-distribution-error'))return;
 if(options.cleanup!==false&&!host.__ST_PERMISSION_REVOKING__){host.__ST_PERMISSION_REVOKING__=true;try{host.__ST_HYPNOOS_INTEGRITY_GATE_V1__?.disposeAll?.();host.__ST_GAME_SHELL__?.destroy?.();const pending=host.__HYPNOOS_OBJECT_MANAGER_V1__?.destroy?.();pending?.catch?.(()=>{});}catch{}finally{host.__ST_PERMISSION_REVOKING__=false;}}
 for(const node of doc.querySelectorAll?.('.hypnoos-resource-setup,[data-hypnoos-owned="true"]')??[])node.remove();
 let status=doc.getElementById('hypnoos-distribution-error');if(status)return;status=doc.createElement('aside');status.id='hypnoos-distribution-error';status.setAttribute('role','alertdialog');status.setAttribute('aria-label','权限错误');status.setAttribute('aria-modal','true');status.style.cssText='position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#11121cb3;color:#fff;font:16px system-ui';
 if(typeof status.append==='function'){const panel=doc.createElement('section'),title=doc.createElement('p'),button=doc.createElement('button');panel.style.cssText='min-width:220px;padding:26px 34px;border:1px solid #aa92b9;border-radius:18px;background:#292332;text-align:center;box-shadow:0 15px 60px #0008';title.textContent='权限错误';button.textContent='确定';button.style.cssText='margin-top:14px;padding:8px 30px;border:0;border-radius:9px;background:#8b739b;color:white;font:inherit';button.onclick=()=>status.remove();panel.append(title,button);status.append(panel);}else status.textContent='权限错误';doc.body.append(status);
 }catch{}
}
function requireDistributionAccess(start = globalThis) {
 const result=inspectDistributionContext(start),gate=result.host?.__ST_HYPNOOS_INTEGRITY_GATE_V1__;
 if(!result.ok||!gate?.authorize?.(gate.revision)){
  const reason=result.ok?'角色卡完整性授权尚未通过。':result.reason;
  reportDistributionFailure(result.host??start,reason);
  throw new Error('[HypnoOS 来源校验] '+reason);
 }
 return result.host;
}
requireDistributionAccess(globalThis);
if(!document.getElementById('hypno-game-root')){const source=document.currentScript?.src||document.baseURI;const script=document.createElement('script');script.src=new URL('./game-host.js',source).href;script.dataset.assetBase=new URL('./assets/',source).href;document.head.append(script);}
})();