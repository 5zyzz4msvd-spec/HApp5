import {normalizeObjectResources} from '../object-manager/account.mjs';
import { STORY_EVENT_DEFINITIONS } from './story-event-catalog.mjs';
import {validateStoryEvents,eventAvailability,eventConflict} from './story-event-rules.mjs';
import { normalizeCharacter,normalizeRef } from '../object-manager/contracts.mjs';
import { encounterCharacterDraft } from '../object-manager/encounter-import.mjs';
import { planUnlockedPersonnelLocations } from '../object-manager/personnel-homes.mjs';
import { slotEligible } from '../object-manager/personnel-access.mjs';
import { PlayerSchedule,DAY_SLOTS,slotTime } from './schedule.mjs';

export const STORY_STATE_FILE='services/story-event-state.json';
export const STORY_HISTORY_FILE='services/story-event-history.json';
const emptyState=()=>({schema:2,completed:{},flags:{},receipts:{},unlocks:[],branches:{}});
export const STORY_DEFINITIONS_FILE='services/story-event-definitions.json';
const eventAction=action=>action.type==='story-event'&&action.source==='story-event-engine-v1';
export function actorMetric(actor,metric){
 const label={affection:'好感度',obedience:'服从度'}[metric]??metric;let id;
 const visit=elements=>{for(const x of elements??[]){if(x.label===label)id=x.id;visit(x.elements);}};visit(actor?.elements);
 const raw=id!==undefined?actor?.values?.[id]:actor?.values?.[metric]??actor?.values?.[label]??actor?.values?.状态?.[label];
 return Number.isFinite(Number(raw))?Number(raw):0;
}
function countValues(value){if(Array.isArray(value))return value.length;if(value&&typeof value==='object')return Object.keys(value).length;return 0;}
function actorFacts(actor){
 const attributes={};
 function visit(elements,target){for(const el of elements??[]){if(['__proto__','constructor','prototype'].includes(el.label))continue;if(el.elements?.length){target[el.label]??={};visit(el.elements,target[el.label]);}else if(Object.hasOwn(actor.values??{},el.id))target[el.label]=structuredClone(actor.values[el.id]);}}visit(actor.elements,attributes);
 function attributeCounts(value,prefix='',result={}){for(const [key,v]of Object.entries(value??{})){const path=prefix+'/'+key.replaceAll('~','~0').replaceAll('/','~1');result[path]=countValues(v);if(v&&typeof v==='object'&&!Array.isArray(v))attributeCounts(v,path,result);}return result;}

 return{id:actor.id,name:actor.name,values:structuredClone(actor.values??{}),attributes,counts:{values:Object.fromEntries(Object.entries(actor.values??{}).map(([k,v])=>[k,countValues(v)])),attributes:attributeCounts(attributes)},affection:actorMetric(actor,'affection'),obedience:actorMetric(actor,'obedience')};
}
export function storyEventFacts(actors,context,state){
 const eligible=actors.filter(slotEligible),rows=eligible.map(actorFacts),characters=Object.fromEntries(rows.map(row=>[row.name,row])),byId=Object.fromEntries(rows.map(row=>[row.id,row]));
 const time=String(context.time??'').match(/^(\d{1,2}):(\d{2})$/);
 return{user:{...(byId.user??{}),suspicion:Number(context.suspicion)||0},actors:byId,characters,context:{...structuredClone(context),minute:time?Number(time[1])*60+Number(time[2]):null},completed:Object.fromEntries(Object.keys(state.completed??{}).map(id=>[id,true])),flags:state.flags??{},branches:state.branches??{}};
}
export function storyEventStatus(state){return{policeMonitoring:state.flags?.police1===true&&state.flags?.police2!==true,police1:state.flags?.police1===true,police2:state.flags?.police2===true,hospital1:state.flags?.hospital1===true,hospital2:state.flags?.hospital2===true,unlocks:[...(state.unlocks??[])],completed:Object.keys(state.completed??{}),branches:structuredClone(state.branches??{})};}
function chosenEvents(state,defs,history){return Object.keys(state.completed??{}).map(id=>history[id]?.definition??defs.find(d=>d.id===id)).filter(Boolean);}
function assertReservation(action,cell,packet,history,defs){const id=action.payload?.eventId,row=history[id],d=row?.definition??defs.find(x=>x.id===id);if(!d||action.id!=='story-event:'+id||!row||row.status!=='scheduled'&&row.status!=='occurred'||row.date!==packet.date||row.index!==cell.index||action.hiddenPrompt!==(d.hiddenPrompt??''))throw Error('事件预约与已发送日程不一致');return d;}
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
 async function readState(){const value=await store.readJson(STORY_STATE_FILE,emptyState());return{...emptyState(),...value,branches:value.branches??{}};}
 async function catalog(){const custom=await store.readJson(STORY_DEFINITIONS_FILE,{events:[]});return validateStoryEvents([...definitions,...(custom.events??[])]);}
 async function saveDefinitions(input,{replace=false}={}){return runtime.personnelTransaction(async()=>{
  const events=Array.isArray(input)?input:input?.events;if(!Array.isArray(events))throw Error('导入格式须包含events数组');
  const previous=await store.readJson(STORY_DEFINITIONS_FILE,{events:[]}),byId=new Map((replace?[]:previous.events??[]).map(d=>[d.id,d]));
  const inputIds=new Set();for(const d of events){if(inputIds.has(d.id))throw Error('事件ID重复：'+d.id);inputIds.add(d.id);if(definitions.some(b=>b.id===d.id))throw Error('不能覆盖内置事件：'+d.id);byId.set(d.id,d);}
  const next=[...byId.values()],all=validateStoryEvents([...definitions,...next]),history=await store.readJson(STORY_HISTORY_FILE,{});
  for(const row of Object.values(history)){if(!['scheduled','occurred'].includes(row.status))continue;const old=validateStoryEvents([...definitions,...(previous.events??[])]).find(d=>d.id===row.eventId),current=all.find(d=>d.id===row.eventId);if(old&&JSON.stringify(old)!==JSON.stringify(current))throw Error('已预约或发生的事件不能改写，请创建新ID：'+row.eventId);}
  await store.writeJson(STORY_DEFINITIONS_FILE,{schema:2,events:next});return{count:next.length};
 });}
 async function snapshot(){return storyEventStatus(await readState());}
 async function inspect(){const state=await readState(),history=await store.readJson(STORY_HISTORY_FILE,{}),defs=await catalog(),facts=storyEventFacts(await store.listObjects('character'),await getContext(),state),chosen=chosenEvents(state,defs,history);return defs.map(d=>({id:d.id,name:d.name,owners:d.owners,ownerNames:d.ownerNames,branch:d.branch??null,...eventAvailability(d,{facts,state,chosen,catalog:defs}),status:state.completed[d.id]?'occurred':history[d.id]?.status??'waiting'}));}
 async function reconcile(schedule,{writable=true}={}){
  if(!writable||schedule.sending)return[];
  return runtime.personnelTransaction(async()=>{
   const state=await readState(),history=await store.readJson(STORY_HISTORY_FILE,{}),actors=await store.listObjects('character'),facts=storyEventFacts(actors,await getContext(),state),before=schedule.snapshot(),selected=schedule.selected,added=[],defs=await catalog(),chosen=chosenEvents(state,defs,history);let changed=false;
   try{
    const pending=new Set();
    for(const cell of schedule.today.cells)if(!cell.sent){cell.actions=cell.actions.filter(action=>{
     if(!eventAction(action))return true;const row=history[action.payload?.eventId],current=defs.find(x=>x.id===action.payload?.eventId),d=row?.prepared?row.definition??current:current;
     const prepared=row?.prepared===true&&Object.hasOwn(state.completed,d?.id);
     const valid=d&&row&&!pending.has(d.id)&&row.date===schedule.today.date&&row.index===cell.index&&(prepared||eventAvailability(d,{facts,state,chosen,catalog:defs}).eligible)&&(prepared||!row.definition||JSON.stringify(row.definition)===JSON.stringify(d));
     if(!valid){changed=true;if(row&&!pending.has(d?.id))row.status='cancelled';return false;}
     if(!chosen.some(x=>x.id===d.id))chosen.push(d);pending.add(d.id);return true;
    });}
    for(const d of defs){
     if(pending.has(d.id)||!eventAvailability(d,{facts,state,chosen,catalog:defs}).eligible)continue;
     const names=[...new Set([...d.ownerNames,...d.owners.map(ref=>actors.find(x=>x.id===ref.id)?.name??ref.id)])];
     const cell=schedule.reserveEvent({id:'story-event:'+d.id,type:'story-event',source:'story-event-engine-v1',title:d.name,payload:{eventId:d.id,ownerNames:names},hiddenPrompt:d.hiddenPrompt});
     if(!cell)break;
     history[d.id]={id:d.id,eventId:d.id,name:d.name,description:'',ownerNames:names,ownerIds:[...new Set([...d.owners.map(x=>x.id),...d.ownerNames.map(name=>name==='{{user}}'?'user':actors.find(x=>x.name===name)?.id).filter(Boolean)])],characterIds:[],...stamp(schedule,cell.index),status:'scheduled',definition:structuredClone(d)};
     added.push(d.id);pending.add(d.id);chosen.push(d);changed=true;
    }
    if(changed)await store.applyFileBatch(new Map([['ui/player-schedule.json',schedule.snapshot()],[STORY_HISTORY_FILE,history]]));
    return added;
   }catch(error){const restored=new PlayerSchedule({state:before});Object.assign(schedule,{today:restored.today,previous:restored.previous,cursor:restored.cursor,minuteCursor:restored.minuteCursor,dispatchCursor:restored.dispatchCursor,dispatchMinute:restored.dispatchMinute,selected});throw error;}
  });
 }
 async function validatePacket(packet){
  const state=await readState(),history=await store.readJson(STORY_HISTORY_FILE,{}),defs=await catalog(),facts=storyEventFacts(await store.listObjects('character'),await getContext(),state),chosen=chosenEvents(state,defs,history),seen=new Set();
  for(const cell of packet.cells)for(const action of cell.actions.filter(eventAction)){
   const d=assertReservation(action,cell,packet,history,defs);if(seen.has(d.id))throw Error('事件日程重复：'+d.id);seen.add(d.id);
   const prepared=history[d.id].prepared===true&&Object.hasOwn(state.completed,d.id);
   if(!prepared&&!eventAvailability(d,{facts,state,chosen,catalog:defs}).eligible)throw Error('事件条件或分支已变化，请刷新日程：'+d.id);
   if(!chosen.some(x=>x.id===d.id))chosen.push(d);
  }
  return{state,history,defs};
 }
 async function decoratePayload(packet){
  const result=structuredClone(packet),{state,history}=await validatePacket(packet);let monitoring=storyEventStatus(state).policeMonitoring;
  // A failed message insertion may be retried after effects were already applied.
  // Reconstruct the interval's initial monitoring state, not the final flags.
  for(const cell of result.cells){const first=cell.actions.find(a=>eventAction(a)&&typeof history[a.payload.eventId]?.monitoringBefore==='boolean');if(first){monitoring=history[first.payload.eventId].monitoringBefore;break;}}
  for(const cell of result.cells){
   cell.actions=cell.actions.filter(a=>!['story-monitor','story-day-end'].includes(a.type)||a.source!=='story-event-engine-v1');
   for(const action of cell.actions.filter(eventAction)){if(action.payload.eventId==='police-1')monitoring=true;if(action.payload.eventId==='police-2')monitoring=false;}
   const hasContent=cell.actions.length>0||Boolean(cell.attachments?.length)||Boolean(cell.note?.trim());
   if(monitoring&&hasContent)cell.actions.push({id:'monitor:'+result.date+':'+cell.index,type:'story-monitor',source:'story-event-engine-v1',title:'九鬼真白的监视',hiddenPrompt:'本格有实际行动或备注，九鬼真白持续监视{{user}}。把监视融入本格已有情节，不额外占格、推进时间或编造新事件。'});
   if(monitoring&&cell.index===DAY_SLOTS-1)cell.actions.push({id:'monitor-end:'+result.date,type:'story-day-end',source:'story-event-engine-v1',title:'九鬼真白的到访',hiddenPrompt:'这是当日最后一个日程格，九鬼真白出现并殴打{{user}}。只在本格结束处呈现，不再追加下一日行动。'});
  }
  return result;
 }
 async function prepareAdvance(packet){
  return runtime.personnelTransaction(async()=>{
   const prepared=await decoratePayload(packet),{state,history,defs}=await validatePacket(packet),chosen=chosenEvents(state,defs,history),dossiers=await store.readJson('services/dossiers.json',{}),actors=await store.listObjects('character'),values=new Map(),resources=normalizeObjectResources(await store.readJson('account/resources.json',{items:{}})),slots=await store.getCharacterSlots(),completed=[];
   for(const cell of prepared.cells)for(const action of cell.actions.filter(eventAction)){
    const d=assertReservation(action,cell,prepared,history,defs);
    if(!state.completed[d.id]){
     const monitoringBefore=storyEventStatus(state).policeMonitoring,introduced=[];
     for(const name of d.effects.characters){
      let actor=actors.find(x=>x.name===name||x.id===name);
      if(!actor){const raw=await getDefinition(name);if(!raw)throw Error('尚无已维护的人物定义：'+name);actor=raw.kind==='character'?normalizeCharacter(raw):await encounterCharacterDraft({...raw,affectionChain:''},{initialData:raw.initialVariables});if(raw.mediaAssets||raw.images)actor.ui.sourcePortraits=[...new Set([...(raw.images??[]),raw.portrait,raw.imageDataUrl].filter(x=>typeof x==='string'&&x))];}
      actor=normalizeCharacter({...actor,ui:{...actor.ui,sourceType:actor.ui?.sourceType??'story-side',appearanceConfirmed:true,scoutCompleted:true,residenceUnlocked:true,acquisitionState:'scouted',scoutingPending:false}});
      if(!actors.some(x=>x.id===actor.id))actors.push(actor);else actors[actors.findIndex(x=>x.id===actor.id)]=actor;
      dossiers[actor.id]={...(dossiers[actor.id]??{}),scouted:true,sourceEvent:d.id};values.set('character:'+actor.id,actor);
      for(const object of await planUnlockedPersonnelLocations(runtime,actor,{objectOverrides:[...values.values()],charactersOverride:actors}))values.set(object.kind+':'+object.id,object);
      if(!slots.some(slot=>slot.ref.id===actor.id))slots.push({slotId:'story-'+actor.id,ref:normalizeRef(actor,'character'),enabled:true,order:90});introduced.push({id:actor.id,name:actor.name});
     }
     for(const item of d.effects.items){const old=Object.hasOwn(resources.items,item.name)?resources.items[item.name]:{quantity:0,description:''};resources.items={...resources.items,[item.name]:{quantity:(Number(old.quantity)||0)+item.quantity,description:old.description||String(item.description??'')}};}
     if(d.branch)state.branches[d.branch.group]={option:d.branch.option,eventId:d.id,date:packet.date,index:cell.index};chosen.push(d);
     Object.assign(state.flags,d.effects.flags);state.unlocks=[...new Set([...state.unlocks,...d.effects.unlocks])];
     history[d.id]={...history[d.id],characterIds:introduced.map(x=>x.id),ownerIds:[...new Set([...d.owners.map(x=>x.id),...d.ownerNames.map(name=>name==='{{user}}'?'user':actors.find(x=>x.name===name)?.id).filter(Boolean)])],status:'occurred',prepared:true,monitoringBefore,results:{applied:true,characters:introduced,items:structuredClone(d.effects.items),flags:structuredClone(d.effects.flags),unlocks:[...d.effects.unlocks]},start:cell.index===packet.cells[0]?.index?packet.start:slotTime(cell.index),end:cell.index===11?'24:00':slotTime(cell.index+1)};
     state.completed[d.id]={date:packet.date,index:cell.index};completed.push(d.id);
    }
    action.payload.results=structuredClone(history[d.id].results??{applied:true});
   }
   if(completed.length){state.schema=2;await runtime._writeLocalObjects([...values.values()],new Map([[STORY_STATE_FILE,state],[STORY_HISTORY_FILE,history],['account/resources.json',resources],['slots/characters.json',slots],['services/dossiers.json',dossiers]]));}
   return prepared;
  });
 }
 async function commitSent(packet,{scheduleSnapshot=null}={}){
  // Compatibility for old callers: preparation is idempotent. Production calls
  // it before creating the user message, and this phase only acknowledges it.
  const stateBefore=await readState(),receipt=[packet.date,packet.start,packet.end].join('|');if(stateBefore.receipts[receipt])return{alreadyCommitted:true};
  await prepareAdvance(packet);
  return runtime.personnelTransaction(async()=>{
   const state=await readState(),history=await store.readJson(STORY_HISTORY_FILE,{});if(state.receipts[receipt])return{alreadyCommitted:true};
   const completed=[];for(const cell of packet.cells)for(const action of cell.actions.filter(eventAction)){assertReservation(action,cell,packet,history,await catalog());history[action.payload.eventId].prepared=false;completed.push(action.payload.eventId);}
   state.receipts[receipt]={date:packet.date,start:packet.start,end:packet.end,eventIds:completed};
   const saved=scheduleSnapshot??await store.readJson('ui/player-schedule.json',null),writes=new Map([[STORY_STATE_FILE,state],[STORY_HISTORY_FILE,history]]);if(saved)writes.set('ui/player-schedule.json',markSent(saved,packet));await store.applyFileBatch(writes);
   return{completed,status:storyEventStatus(state)};
  });
 }
 return{snapshot,reconcile,decoratePayload,prepareAdvance,commitSent,catalog,saveDefinitions,inspect};
}
