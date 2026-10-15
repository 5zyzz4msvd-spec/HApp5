import {DAY_SLOTS,PlayerSchedule,slotTime,shiftDate} from './schedule.mjs';
import {USER_REF,USER_SUSPICION_FIELD} from '../object-manager/user-management.mjs';

export const PART_TIME_STATE_FILE='services/part-time-jobs.json';
export const PART_TIME_JOURNAL_FILE='services/part-time-job-transaction.json';
export const PART_TIME_SOURCE='part-time-jobs-v1';
const freeze=value=>Object.freeze(value);
export const PART_TIME_JOBS=freeze([
 freeze({id:'lin-an-files',locationId:'lin-an-office',title:'整理资料',description:'在林安事务所整理委托资料、归档记录。',options:freeze([freeze({cells:1,money:4000,suspicion:0}),freeze({cells:2,money:9000,suspicion:0}),freeze({cells:3,money:15000,suspicion:0})])}),
 freeze({id:'field-app-test',locationId:'twins-workshop',title:'线下测试',description:'接受工作室委托，在线下对路人使用催眠 APP，收集测试数据。',options:freeze([freeze({cells:1,money:12000,suspicion:5}),freeze({cells:2,money:28000,suspicion:12}),freeze({cells:3,money:48000,suspicion:22})])}),
]);
const clone=value=>structuredClone(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const emptyState=()=>({schema:1,jobs:{}});
export const isPartTimeAction=action=>action?.type==='part-time-job'&&action?.source===PART_TIME_SOURCE;
const getJob=id=>PART_TIME_JOBS.find(job=>job.id===id);
const validAction=(row,action,packet,cell)=>row&&row.date===packet.date&&cell.index>=row.start&&cell.index<=row.end&&action.id===row.nonce+':'+cell.index&&action.payload?.nonce===row.nonce&&action.payload.jobId===row.jobId&&action.payload.date===row.date&&action.payload.start===row.start&&action.payload.end===row.end&&action.payload.cells===row.cells&&action.payload.part===cell.index-row.start+1&&action.payload.location?.kind==='location'&&action.payload.location.id===row.location.id;
function selectedOption(job,cells){const option=job?.options.find(option=>option.cells===cells);if(!option)throw Error('请选择有效的打工时长');return option;}
export function partTimeChoices(schedule,location,{writable=true}={}){
 const job=PART_TIME_JOBS.find(job=>job.locationId===location?.id);if(!job)return[];
 return job.options.map(option=>{
  let start=null;
  if(writable&&!schedule.sending){const minimum=Math.max(schedule.selected,schedule.cursor+(schedule.minuteCursor>schedule.cursor*120?1:0));for(let i=minimum;i+option.cells<=DAY_SLOTS;i++){const cells=schedule.today.cells.slice(i,i+option.cells);if(cells.every(cell=>!cell.sent&&!cell.actions.length&&!cell.note.trim())){start=i;break;}}}
  return{jobId:job.id,title:job.title,description:job.description,...option,hours:option.cells*2,start,end:start===null?null:start+option.cells-1,date:schedule.today.date,available:start!==null,reason:start===null?'今日剩余连续空格不足':'',time:start===null?'':slotTime(start)+'—'+(start+option.cells===DAY_SLOTS?'24:00':slotTime(start+option.cells))};
 });
}
const markSent=(raw,packet)=>{
 if(!raw)return null;const schedule=new PlayerSchedule({state:clone(raw)});if(schedule.today.date!==packet.date)return schedule.snapshot();
 schedule.acknowledgeSent(packet);return schedule.snapshot();
};
export function createPartTimeJobs({runtime,getSchedule,getContext,readResources,compareAndSetResources,isWritable=()=>true,onChange=()=>{}}){
 const store=runtime.store;
 const transaction=fn=>runtime.personnelTransaction(fn);
 async function state(){return store.readJson(PART_TIME_STATE_FILE,emptyState());}
 async function recoverUnlocked(){
  const journal=await store.readJson(PART_TIME_JOURNAL_FILE,null);if(!journal)return true;
  const currentResources=await readResources(),currentState=await state();
  if(same(currentState,journal.nextState)){await store.writeJson(PART_TIME_JOURNAL_FILE,null);return true;}
  if(same(currentState,journal.expectedState)&&same(currentResources,journal.expectedResources)){await store.writeJson(PART_TIME_JOURNAL_FILE,null);return true;}
  if(same(currentState,journal.expectedState)&&same(currentResources,journal.nextResources)){
   const actor=await store.getObject(USER_REF);if(!same(actor,journal.expectedActor))throw Error('打工结算需要恢复，玩家资料已改变');
   const writes=new Map([[PART_TIME_STATE_FILE,journal.nextState],...(journal.schedule?[['ui/player-schedule.json',journal.schedule]]:[])]);
   await runtime._writeLocalObjects(journal.nextActor?[journal.nextActor]:[],writes);await store.writeJson(PART_TIME_JOURNAL_FILE,null);return true;
  }
  throw Error('打工结算记录与账户不一致，已停止重复结算');
 }
 async function recover(){
  const liveSchedule=getSchedule?.(),beforeLive=liveSchedule?.snapshot();await transaction(recoverUnlocked);
  // The schedule's sent marker is durable dispatch evidence. It also covers a
  // crash between the story-event owner's commit and the job journal prepare.
  const persisted=await store.readJson('ui/player-schedule.json',null),saved=await state();
  for(const row of Object.values(saved.jobs??{}).filter(row=>row.status==='staged')){
   const day=[persisted?.today,persisted?.previous].find(day=>day?.date===row.date);if(!day)continue;
   const cells=day.cells.filter(cell=>cell.index>=row.start&&cell.index<=row.end),packet={type:'schedule',date:row.date,start:slotTime(row.start),end:row.end===DAY_SLOTS-1?'24:00':slotTime(row.end+1),cells:clone(cells)};
   if(cells.length!==row.cells||!cells.every(cell=>cell.sent&&cell.actions.some(action=>isPartTimeAction(action)&&validAction(row,action,packet,cell))))continue;
   await commitSent(packet,{scheduleSnapshot:await store.readJson('ui/player-schedule.json',null)});
  }
  const restored=await store.readJson('ui/player-schedule.json',null);
  if(restored&&liveSchedule&&!liveSchedule.sending&&same(liveSchedule.snapshot(),beforeLive)&&!same(restored,beforeLive)){
   const recovered=new PlayerSchedule({state:restored});liveSchedule.today=recovered.today;liveSchedule.previous=recovered.previous;liveSchedule.cursor=recovered.cursor;liveSchedule.minuteCursor=recovered.minuteCursor;liveSchedule.dispatchCursor=recovered.dispatchCursor;liveSchedule.dispatchMinute=recovered.dispatchMinute;liveSchedule.selected=recovered.selected;onChange();
  }
  return true;
 }
 async function menu(){return partTimeChoices(getSchedule(),getContext()?.location,{writable:isWritable()});}
 async function stage(jobId,cells){return transaction(async()=>{
  await recoverUnlocked();if(!isWritable())throw Error('当前日程不能安排打工');const schedule=getSchedule(),context=getContext(),job=getJob(jobId);selectedOption(job,cells);
  if(context?.location?.id!==job.locationId)throw Error('请在对应地点安排打工');
  const choice=partTimeChoices(schedule,context.location).find(row=>row.cells===cells);if(!choice?.available)throw Error(choice?.reason||'今日剩余连续空格不足');
  const nonce=globalThis.crypto.randomUUID(),before=await state(),next=clone(before),row={nonce,jobId,location:{kind:'location',id:job.locationId},locationName:String(context.location.name??job.locationId),date:choice.date,start:choice.start,end:choice.end,cells,money:choice.money,suspicion:choice.suspicion,status:'staged'};
  if(!isWritable()||getContext()?.location?.id!==job.locationId||schedule.today.date!==choice.date||schedule.sending)throw Error('地点或日程已改变，请重新安排打工');
  if(schedule.today.cells.slice(row.start,row.end+1).some(cell=>cell.sent||cell.actions.length||cell.note.trim()))throw Error('日程格已被其它安排占用');
  next.jobs[nonce]=row;const changed=[];schedule.sending=true;
  try{for(let index=row.start;index<=row.end;index++){
   const action={id:nonce+':'+index,type:'part-time-job',source:PART_TIME_SOURCE,title:job.title+' · '+(index-row.start+1)+'/'+cells,payload:{nonce,jobId,location:row.location,date:row.date,start:row.start,end:row.end,cells,part:index-row.start+1},hiddenPrompt:jobId==='lin-an-files'?'本格在林安事务所整理资料，按预约连续完成工作。报酬由打工服务在最后一格送出后结算，不额外更新钱。':'本格为工作室的线下测试兼职：对匿名路人使用催眠 APP，收集测试数据。路人仅为本次打工事件中的临时群体，不命名、不导入角色对象、不占人物卡槽，不借用既有人物。报酬和可疑度由打工服务在最后一格送出后结算，不额外更新这些变量。'};
   schedule.today.cells[index].actions.push(action);changed.push(action);
  }
  await store.applyFileBatch(new Map([[PART_TIME_STATE_FILE,next],['ui/player-schedule.json',schedule.snapshot()]]));
  }catch(error){for(const action of changed){const cell=schedule.today.cells.find(cell=>cell.actions.includes(action));if(cell)cell.actions=cell.actions.filter(item=>item!==action);}throw error;}finally{schedule.sending=false;}
  onChange();return clone(row);
 });}
 async function cancel(nonce){return transaction(async()=>{
  await recoverUnlocked();if(!isWritable())throw Error('当前日程不能修改');const saved=await state(),row=saved.jobs[nonce],schedule=getSchedule();if(!row||row.status!=='staged')throw Error('这次打工不能取消');
  if(schedule.sending||schedule.today.date!==row.date||row.start<schedule.cursor||schedule.today.cells.slice(row.start,row.end+1).some(cell=>cell.sent))throw Error('已发送的打工不能取消');
  const before=clone(schedule.today.cells);schedule.sending=true;for(const cell of schedule.today.cells)cell.actions=cell.actions.filter(action=>!isPartTimeAction(action)||action.payload.nonce!==nonce);row.status='cancelled';
  try{await store.applyFileBatch(new Map([[PART_TIME_STATE_FILE,saved],['ui/player-schedule.json',schedule.snapshot()]]));}catch(error){schedule.today.cells=before;throw error;}finally{schedule.sending=false;}onChange();return{cancelled:true};
 });}
 async function decoratePayload(packet){
  const saved=await state();for(const cell of packet.cells)for(const action of cell.actions.filter(isPartTimeAction)){
   const row=saved.jobs[action.payload?.nonce];if(!row||row.status!=='staged'||!validAction(row,action,packet,cell))throw Error('打工预约与日程不一致');
   for(let index=row.start;index<=row.end;index++)if(!packet.cells.some(cell=>cell.index===index&&cell.actions.some(action=>isPartTimeAction(action)&&validAction(row,action,packet,cell))))throw Error('请一次送出这次打工的全部日程格');
  }return packet;
 }
 async function commitSent(packet,{scheduleSnapshot=null}={}){return transaction(async()=>{
  await recoverUnlocked();const before=await state(),next=clone(before),completed=[];
  for(const cell of packet.cells)for(const action of cell.actions.filter(isPartTimeAction)){
   const row=next.jobs[action.payload?.nonce];if(row?.status==='settled')continue;
   if(!row||row.status!=='staged'||!validAction(row,action,packet,cell))throw Error('打工预约与已发送日程不一致');
   if(completed.some(item=>item.nonce===row.nonce))continue;
   for(let index=row.start;index<=row.end;index++)if(!packet.cells.some(cell=>cell.index===index&&cell.actions.some(action=>isPartTimeAction(action)&&validAction(row,action,packet,cell)&&action.payload.jobId===row.jobId)))throw Error('打工日程尚未完整送出');
   const option=selectedOption(getJob(row.jobId),row.cells);if(option.money!==row.money||option.suspicion!==row.suspicion)throw Error('打工预约报价无效');row.status='settled';row.dispatched={date:packet.date,start:packet.start,end:packet.end};completed.push(row);
  }
  if(!completed.length)return{completed:[],alreadyCommitted:true};
  const expectedResources=await readResources(),nextResources={...clone(expectedResources),money:Number(expectedResources.money)+completed.reduce((sum,row)=>sum+row.money,0)};
  if(!Number.isSafeInteger(nextResources.money)||nextResources.money<0||nextResources.money>1e9)throw Error('账户余额无法接收本次报酬');
  const expectedActor=await store.getObject(USER_REF),increase=completed.reduce((sum,row)=>sum+row.suspicion,0);if(increase&&!expectedActor)throw Error('玩家管理对象尚未连接');
  const nextActor=increase?clone(expectedActor):null;if(nextActor)nextActor.values[USER_SUSPICION_FIELD]=Math.max(0,Number(expectedActor.values[USER_SUSPICION_FIELD])||0)+increase;
  const snapshot=scheduleSnapshot??await store.readJson('ui/player-schedule.json',null),schedule=markSent(snapshot,packet),journal={schema:1,expectedResources,nextResources,expectedActor,nextActor,expectedState:before,nextState:next,schedule};
  await store.writeJson(PART_TIME_JOURNAL_FILE,journal);if(!await compareAndSetResources(expectedResources,nextResources)){await store.writeJson(PART_TIME_JOURNAL_FILE,null);throw Error('账户已改变，请恢复本次打工结算');}
  try{await runtime._writeLocalObjects(nextActor?[nextActor]:[],new Map([[PART_TIME_STATE_FILE,next],...(schedule?[['ui/player-schedule.json',schedule]]:[])]));}catch(error){if(await compareAndSetResources(nextResources,expectedResources))await store.writeJson(PART_TIME_JOURNAL_FILE,null);throw error;}
  try{await store.writeJson(PART_TIME_JOURNAL_FILE,null);}catch{}onChange();return{completed:completed.map(row=>clone(row))};
 });}
 return{menu,stage,cancel,decoratePayload,commitSent,recover,snapshot:state};
}
