function views(start){const result=[];for(const x of [start,start?.parent,start?.top,globalThis])try{if(x&&!result.includes(x))result.push(x);}catch{}return result;}
function find(views,name){for(const view of views)for(const owner of [view,view.TavernHelper])if(typeof owner?.[name]==='function')return owner[name].bind(owner);return null;}
export function installPersonnelHooks(runtime,service,start=globalThis){
  if(runtime.__personnelHooks)return runtime.__personnelHooks;
  const scopes=views(start),on=find(scopes,'eventOn'),inject=find(scopes,'injectPrompts'),uninject=find(scopes,'uninjectPrompts');
  if(!on||!inject||!uninject)return {available:false};
  const eventOwner=scopes.find(x=>x.tavern_events)??start,events=eventOwner.tavern_events??{},host=scopes.find(x=>x.SillyTavern?.getContext),disposers=[];let installed=[],lease=null,type='normal',destroyed=false;
  const clear=async()=>{if(installed.length)await uninject(installed);installed=[];};
  const bind=(name,fallback,callback)=>{const key=events[name]??fallback;const result=on(key,callback);disposers.push(typeof result==='function'?result:()=>result?.stop?.());};
  async function prepare(_type,_option,dry){if(destroyed||dry===true||!['normal','regenerate','swipe','continue'].includes(type))return;const context=await service.context();if(context.chatId&&context.chatId!==runtime.store.chatId)return;
    const rows=await service.hiddenPrompts(context);await clear();if(!rows.length){lease=null;return;}
    const chat=host?.SillyTavern?.getContext?.()?.chat??[];let anchor='';for(let i=chat.length-1;i>=0;i--)if(chat[i].is_user||chat[i].role==='user'){anchor='user-'+i;break;}
    const payloads=rows.map(x=>({id:`personnel:${runtime.store.chatKey}:${x.id}`,position:'in_chat',depth:0,role:'system',content:x.content,should_scan:x.kind==='receipt'||x.kind==='work'}));
    await inject(payloads,{once:true});installed=payloads.map(x=>x.id);lease={chatId:runtime.store.chatId,anchor,ids:rows.map(x=>x.id)};
  }
  bind('GENERATION_STARTED','generation_started',(next,options,dry)=>{type=String(next??'normal');if(dry||options?.dry_run)return;return clear();});
  bind('GENERATE_BEFORE_COMBINE_PROMPTS','generate_before_combine_prompts',prepare);
  bind('GENERATION_ENDED','generation_ended',clear);
  bind('GENERATION_STOPPED','generation_stopped',async()=>{await clear();lease=null;});
  bind('CHAT_CHANGED','chat_id_changed',()=>{void handle.destroy();});
  runtime.afterBusinessOutput=async(snapshot)=>{if(lease&&lease.chatId===runtime.store.chatId&&(!lease.anchor||lease.anchor===snapshot.promptAnchor)){const ids=lease.ids;lease=null;await service.consumePrompts(ids,snapshot.floorKey);}await service.tick();};
  const handle={available:true,async destroy(){destroyed=true;await clear();lease=null;for(const dispose of disposers.splice(0))dispose();delete runtime.afterBusinessOutput;delete runtime.__personnelHooks;}};runtime.__personnelHooks=handle;return handle;
}
