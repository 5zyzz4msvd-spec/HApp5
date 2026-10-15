// Shared by the card gate and compiled entry points. Keep this function self-contained.
export function inspectDistributionContext(start = globalThis) {
 const views=[];
 for(const view of [start,start?.parent,start?.top])try{if(view&&!views.includes(view))views.push(view);}catch{}
 let host,context;
 for(const view of views.reverse())try{if(typeof view?.SillyTavern?.getContext==='function'){host=view;context=view.SillyTavern.getContext();break;}}catch{}
 const fail=(code,reason)=>({ok:false,code,reason,host});
 if(!host)return fail('platform','仅支持在 SillyTavern 中运行。');
 const id=context?.characterId??context?.chid;
 const character=id===undefined||id===null?null:context.characters?.[id];
 if(!character)return fail('character','当前角色卡尚未就绪。');
 const card=character.data&&typeof character.data==='object'?character.data:character;
 const marked=name=>typeof name==='string'&&name.includes('louisHM')&&name.includes('完全免费');
 if(!marked(card.name)||(character.name!==undefined&&!marked(character.name)))return fail('card-name','角色卡名必须同时包含 louisHM、完全免费。');
 const embedded=card.character_book?.name,binding=card.extensions?.world;
 if(!marked(embedded)||!marked(binding))return fail('worldbook-name','角色绑定的世界书名必须同时包含 louisHM、完全免费。');
 if(embedded!==binding)return fail('worldbook-binding','内嵌世界书与当前绑定的世界书名称不一致。');
 return {ok:true,host,context,card};
}

export function requireDistributionAccess(start = globalThis) {
 const result=inspectDistributionContext(start),gate=result.host?.__ST_HYPNOOS_INTEGRITY_GATE_V1__;
 if(!result.ok||!gate?.authorize?.(gate.revision)){
  const reason=result.ok?'角色卡完整性授权尚未通过。':result.reason;
  reportDistributionFailure(result.host??start,reason);
  throw new Error('[HypnoOS 来源校验] '+reason);
 }
 return result.host;
}

export function reportDistributionFailure(host,reason) {
 try{
  const doc=host.document;if(!doc?.body)return;
  let status=doc.getElementById('hypnoos-distribution-error');
  if(!status){status=doc.createElement('aside');status.id='hypnoos-distribution-error';status.setAttribute('role','alert');status.style.cssText='position:fixed;left:20px;right:20px;bottom:24px;z-index:2147483646;padding:16px 20px;border:1px solid #ab6b76;border-radius:16px;background:#291b24;color:#fff;font:14px/1.7 system-ui';doc.body.append(status);}
  status.textContent='HypnoOS 已停止加载：'+reason;
 }catch{}
}
