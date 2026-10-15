import {normalizeObjectResources} from '../object-manager/account.mjs';
import { STORY_EVENT_DEFINITIONS } from './story-event-catalog.mjs';
import { evaluateCondition,normalizeCondition } from '../object-manager/conditions.mjs';
import { normalizeCharacter,normalizeRef } from '../object-manager/contracts.mjs';
import { encounterCharacterDraft } from '../object-manager/encounter-import.mjs';
import { planUnlockedPersonnelLocations } from '../object-manager/personnel-homes.mjs';
import { slotEligible } from '../object-manager/personnel-access.mjs';
import { PlayerSchedule,DAY_SLOTS,slotTime } from './schedule.mjs';

export const STORY_STATE_FILE='services/story-event-state.json';
export const STORY_HISTORY_FILE='services/story-event-history.json';
const emptyState=()=>({schema:1,completed:{},flags:{},receipts:{},unlocks:[]});
const eventAction=action=>action.type==='story-event'&&action.source==='story-event-engine-v1';
export function actorMetric(actor,metric){
 const label={affection:'好感度',obedience:'服从度'}[metric]??metric;let id;
 const visit=elements=>{for(const x of elements??[]){if(x.label===label)id=x.id;visit(x.elements);}};visit(actor?.elements);
 const raw=id!==undefined?actor?.values?.[id]:actor?.values?.[metric]??actor?.values?.[label]??actor?.values?.状态?.[label];
 return Number.isFinite(Number(raw))?Number(raw):0;
}
export function storyEventFacts(actors,context,state){
 const characters=Object.fromEntries(actors.filter(slotEligible).map(actor=>[actor.name,{affection:actorMetric(actor,'affection'),obedience:actorMetric(actor,'obedience')}]));
 return{user:{suspicion:Number(context.suspicion)||0},characters,completed:Object.fromEntries(Object.keys(state.completed??{}).map(id=>[id,true])),flags:state.flags??{}};
}
export function storyEventStatus(state){return{policeMonitoring:state.flags?.police1===true&&state.flags?.police2!==true,police1:state.flags?.police1===true,police2:state.flags?.police2===true,hospital1:state.flags?.hospital1===true,hospital2:state.flags?.hospital2===true,unlocks:[...(state.unlocks??[])]};}
function definition(raw){
 const d=structuredClone(raw);
 if(!/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(d.id??'')||!d.name||!Array.isArray(d.ownerNames)||!d.ownerNames.length)throw Error('事件须有稳定ID、名称和归属');
 d.when=normalizeCondition(d.when);if(!d.when)throw Error('事件须有明确条件');
 if(String(d.hiddenPrompt??'').length>2400)throw Error('事件提示词过长');
 d.effects??={};d.effects.characters??=[];d.effects.flags??={};d.effects.items??=[];d.effects.unlocks??=[];
 for(const item of d.effects.items)if(!String(item.name??'').trim()||['__proto__','constructor','prototype'].includes(item.name)||!Number.isSafeInteger(item.quantity)||item.quantity<1)throw Error('事件物品数量无效');
 for(const key of [...Object.keys(d.effects.flags),...d.effects.unlocks])if(!/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(key))throw Error('事件解锁标识无效');
 return d;
}
const stamp=(schedule,index)=>({date:schedule.today.date,index,slotId:'cell-'+index,start:index===schedule.cursor?String(Math.floor(schedule.minuteCursor/60)).padStart(2,'0')+':'+String(schedule.minuteCursor%60).padStart(2,'0'):slotTime(index),end:index===11?'24:00':slotTime(index+1)});
function markSent(snapshot,packet){
 const schedule=new PlayerSchedule({state:structuredClone(snapshot)});
 if(schedule.today.date===packet.date){
  schedule.acknowledgeSent(packet);
 }
 return schedule.snapshot();
}

export function createStoryEventEngine({runtime,getContext=async()=>({}),getDefinition=async()=>null,definitions=STORY_EVENT_DEFINITIONS}){
 const store=runtime.store;
 async function catalog(){const custom=await store.readJson('services/story-event-definitions.json',{events:[]});const rows=[...definitions,...(custom.events??[])].map(definition);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('事件ID重复');return rows.sort((a,b)=>(a.priority??100)-(b.priority??100));}
 async function snapshot(){return storyEventStatus(await store.readJson(STORY_STATE_FILE,emptyState()));}
 async function reconcile(schedule,{writable=true}={}){
  if(!writable||schedule.sending)return[];
  return runtime.personnelTransaction(async()=>{
   const state=await store.readJson(STORY_STATE_FILE,emptyState()),history=await store.readJson(STORY_HISTORY_FILE,{}),actors=await store.listObjects('character'),facts=storyEventFacts(actors,await getContext(),state),before=schedule.snapshot(),added=[];
   try{
    const pending=new Set(schedule.today.cells.flatMap(cell=>cell.actions.filter(eventAction).map(action=>action.payload.eventId)));
    for(const d of await catalog()){
     if(state.completed[d.id]||pending.has(d.id)||!evaluateCondition(d.when,facts))continue;
     const cell=schedule.reserveEvent({id:'story-event:'+d.id,type:'story-event',source:'story-event-engine-v1',title:d.name,payload:{eventId:d.id,ownerNames:d.ownerNames},hiddenPrompt:d.hiddenPrompt??''});
     if(!cell)break;
     const row={id:d.id,eventId:d.id,name:d.name,description:'',ownerNames:d.ownerNames,ownerIds:d.ownerNames.map(name=>name==='{{user}}'?'user':actors.find(x=>x.name===name)?.id).filter(Boolean),characterIds:[],...stamp(schedule,cell.index),status:'scheduled'};
     history[d.id]=row;added.push(d.id);pending.add(d.id);
    }
    if(added.length)await store.applyFileBatch(new Map([['ui/player-schedule.json',schedule.snapshot()],[STORY_HISTORY_FILE,history]]));
    return added;
   }catch(error){schedule.today=before.today;schedule.previous=before.previous;schedule.cursor=before.cursor;schedule.minuteCursor=before.minuteCursor;schedule.dispatchCursor=before.dispatchCursor;schedule.dispatchMinute=before.dispatchMinute;throw error;}
  });
 }
 async function decoratePayload(packet){
  const result=structuredClone(packet),state=await store.readJson(STORY_STATE_FILE,emptyState());let monitoring=storyEventStatus(state).policeMonitoring;
  for(const cell of result.cells){
   for(const action of cell.actions.filter(eventAction)){if(action.payload.eventId==='police-1')monitoring=true;if(action.payload.eventId==='police-2')monitoring=false;}
   const hasContent=cell.actions.length>0||Boolean(cell.attachments?.length)||Boolean(cell.note?.trim());
   if(monitoring&&hasContent)cell.actions.push({id:'monitor:'+result.date+':'+cell.index,type:'story-monitor',source:'story-event-engine-v1',title:'九鬼真白的监视',hiddenPrompt:'本格有实际行动或备注，九鬼真白持续监视{{user}}。把监视融入本格已有情节，不额外占格、推进时间或编造新事件。'});
   if(monitoring&&cell.index===DAY_SLOTS-1)cell.actions.push({id:'monitor-end:'+result.date,type:'story-day-end',source:'story-event-engine-v1',title:'九鬼真白的到访',hiddenPrompt:'这是当日最后一个日程格，九鬼真白出现并殴打{{user}}。只在本格结束处呈现，不再追加下一日行动。'});
  }
  return result;
 }
 async function commitSent(packet,{scheduleSnapshot=null}={}){
  return runtime.personnelTransaction(async()=>{
   const state=await store.readJson(STORY_STATE_FILE,emptyState()),history=await store.readJson(STORY_HISTORY_FILE,{}),receipt=[packet.date,packet.start,packet.end].join('|');
   if(state.receipts[receipt])return{alreadyCommitted:true};
   const defs=new Map((await catalog()).map(x=>[x.id,x])),actors=await store.listObjects('character'),values=new Map(),resources=normalizeObjectResources(await store.readJson('account/resources.json',{items:{}})),slots=await store.getCharacterSlots(),completed=[];
   for(const cell of packet.cells)for(const action of cell.actions.filter(eventAction)){
    const d=defs.get(action.payload?.eventId);
    if(!d||action.id!=='story-event:'+d.id||!history[d.id]||history[d.id].date!==packet.date||history[d.id].index!==cell.index)throw Error('事件预约与已发送日程不一致');
    if(state.completed[d.id])continue;
    const introduced=[];
    for(const name of d.effects.characters){
     let actor=actors.find(x=>x.name===name);
     if(!actor){const raw=await getDefinition(name);if(!raw)throw Error('尚无已维护的人物定义：'+name);actor=await encounterCharacterDraft({...raw,affectionChain:''},{initialData:raw.initialVariables});}
     actor=normalizeCharacter({...actor,ui:{...actor.ui,sourceType:'story-side',appearanceConfirmed:true,acquisitionState:'scouted',scoutingPending:false}});
     if(!actors.some(x=>x.id===actor.id))actors.push(actor);else actors[actors.findIndex(x=>x.id===actor.id)]=actor;
     values.set('character:'+actor.id,actor);
     for(const object of await planUnlockedPersonnelLocations(runtime,actor,{objectOverrides:[...values.values()],charactersOverride:actors}))values.set(object.kind+':'+object.id,object);
     if(!slots.some(slot=>slot.ref.id===actor.id))slots.push({slotId:'story-'+actor.id,ref:normalizeRef(actor,'character'),enabled:true,order:90});
     introduced.push(actor.id);
    }
    for(const item of d.effects.items){const old=Object.hasOwn(resources.items,item.name)?resources.items[item.name]:{quantity:0,description:''};resources.items={...resources.items,[item.name]:{quantity:(Number(old.quantity)||0)+item.quantity,description:old.description||String(item.description??'')}};}
    Object.assign(state.flags,d.effects.flags);state.unlocks=[...new Set([...state.unlocks,...d.effects.unlocks])];
    const row={...history[d.id],characterIds:introduced,status:'occurred',start:cell.index===packet.cells[0]?.index?packet.start:slotTime(cell.index),end:cell.index===11?'24:00':slotTime(cell.index+1)};
    history[d.id]=row;state.completed[d.id]={date:packet.date,index:cell.index,receipt};completed.push(d.id);
   }
   state.receipts[receipt]={date:packet.date,start:packet.start,end:packet.end,eventIds:completed};
   const saved=scheduleSnapshot??await store.readJson('ui/player-schedule.json',null),writes=new Map([[STORY_STATE_FILE,state],[STORY_HISTORY_FILE,history],['account/resources.json',resources],['slots/characters.json',slots]]);
   if(saved)writes.set('ui/player-schedule.json',markSent(saved,packet));
   await runtime._writeLocalObjects([...values.values()],writes);
   return{completed,status:storyEventStatus(state)};
  });
 }
 return{snapshot,reconcile,decoratePayload,commitSent,catalog};
}
