import {LOCATION_HYPNOSIS_CONTRACT,LOCATION_HYPNOSIS_FIELD_ID,locationHypnosisPromptRequest} from '../object-manager/location-hypnosis.mjs';
export const DAY_SLOTS=12;
const minuteTime=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
export const slotTime=index=>`${String(index*2).padStart(2,'0')}:00`;
export function shiftDate(date,days){const parsed=new Date(date+'T00:00:00Z');parsed.setUTCDate(parsed.getUTCDate()+days);return parsed.toISOString().slice(0,10);}
const partTimeAction=action=>action?.type==='part-time-job'&&action?.source==='part-time-jobs-v1';
const newDay=date=>({date,cells:Array.from({length:DAY_SLOTS},(_,index)=>({index,time:slotTime(index),actions:[],attachments:[],note:'',sent:false}))});
function migrateAttachments(day){for(const cell of day.cells){cell.attachments??=[];for(const action of cell.actions.filter(x=>x.type==='hypnosis'))if(!cell.attachments.some(x=>x.id===action.id))cell.attachments.push(action);cell.actions=cell.actions.filter(x=>x.type!=='hypnosis');}return day;}
export function scheduleActionForPrompt(action,date,time){
 const result=structuredClone(action);
 if(result.type==='hypnosis')for(const request of result.payload.requests){
  const duration=request.command.timed?request.minutes:10,parsed=new Date(date+'T'+time+':00Z');parsed.setUTCMinutes(parsed.getUTCMinutes()+duration);
  request.executionTime=date+' '+time;request.endTime=request.lifetime==='temporary'?`${parsed.getUTCFullYear()}年${parsed.getUTCMonth()+1}月${parsed.getUTCDate()}日 ${parsed.toISOString().slice(11,16)}`:null;
  request.effectContract=['location','group'].includes(request.command.scope)?LOCATION_HYPNOSIS_CONTRACT:'逐个实名目标独立判定，成功只写各自对应的临时或永久催眠效果';
  if(['location','group'].includes(request.command.scope)){const template=locationHypnosisPromptRequest(result,request,date,time);request.effectOwner=template.owner;request.effectField=LOCATION_HYPNOSIS_FIELD_ID;request.effectRequestId=template.requestId;request.resultTemplate=template;delete request.ruleId;}
 }
 return result;
}
export class PlayerSchedule{
 constructor({date='2026-10-12',cursor=0,time=null,state=null}={}){this.today=migrateAttachments(state?.today??newDay(date));this.previous=migrateAttachments(state?.previous??newDay(shiftDate(date,-1)));this.cursor=state?.cursor??cursor;this.minuteCursor=state?.minuteCursor??(time?Number(time.split(':')[0])*60+Number(time.split(':')[1]):this.cursor*120);this.dispatchCursor=state?.dispatchCursor??this.cursor;this.dispatchMinute=state?.dispatchMinute??this.minuteCursor;this.selected=this.cursor;this.sending=false;}
 snapshot(){return structuredClone({today:this.today,previous:this.previous,cursor:this.cursor,minuteCursor:this.minuteCursor,dispatchCursor:this.dispatchCursor,dispatchMinute:this.dispatchMinute});}
 select(index){if(!Number.isInteger(index)||index<this.cursor||index>=DAY_SLOTS)throw Error('日程只能向前安排');this.selected=index;}
 moveOperationTime(index){if(this.sending)throw Error('日程正在发送');this.select(index);if(index===this.cursor)return false;this.cursor=index;this.minuteCursor=Math.max(this.minuteCursor,index*120);return true;}
 acknowledgeSent(packet){if(packet.date!==this.today.date)return;for(const row of packet.cells)if(this.today.cells[row.index])this.today.cells[row.index].sent=true;const next=Number(packet.cells.at(-1)?.index??this.dispatchCursor-1)+1;this.dispatchCursor=Math.max(this.dispatchCursor,next);this.dispatchMinute=Math.max(this.dispatchMinute,this.dispatchCursor*120);this.cursor=Math.max(this.cursor,this.dispatchCursor);this.minuteCursor=Math.max(this.minuteCursor,this.cursor*120);if(packet.crossDay&&this.dispatchCursor===DAY_SLOTS){this.previous=this.today;this.today=newDay(shiftDate(this.today.date,1));this.cursor=this.minuteCursor=this.dispatchCursor=this.dispatchMinute=0;}this.selected=Math.min(this.cursor,DAY_SLOTS-1);}
 annotate(index,note){if(this.sending)throw Error('日程正在保存或发送');this.select(index);if(this.today.cells[index].actions.some(partTimeAction))throw Error('这一格已被打工占用，请先取消打工');this.today.cells[index].note=String(note).slice(0,1800);}
 reserveEvent(action){if(this.sending)return null;const cell=this.today.cells.find(x=>x.index>=this.cursor&&!x.sent&&!x.actions.length&&!x.note.trim());if(!cell)return null;cell.actions.push(structuredClone(action));return cell;}
 stage(action,{index=this.selected,mergeKey=''}={}){if(this.sending)throw Error('日程正在发送');this.select(index);const cell=this.today.cells[index],attachment=action.type==='hypnosis';if(cell.actions.some(partTimeAction)&&!attachment)throw Error('这一格已被打工占用，请先取消打工');if(cell.actions.some(x=>x.type==='story-event')&&!attachment&&action.type!=='location-note')throw Error('这一格已被事件占用，请选择其它日程格');const entries=attachment?cell.attachments:cell.actions,entry=structuredClone(action);entry.id??=globalThis.crypto?.randomUUID?.()??String(Date.now());entry.mergeKey=mergeKey;const old=mergeKey?entries.find(x=>x.mergeKey===mergeKey):null;if(old){Object.assign(old,entry);return old;}entries.push(entry);return entry;}
 async advance(end,{canAdvance,send,crossDay=false,preparePayload=async value=>value}={}){
  if(!canAdvance)throw Error('请先播放完最新楼层的全部对话');if(this.sending)throw Error('日程正在发送');if(!Number.isInteger(end)||end<0||end>=DAY_SLOTS||(end<this.cursor&&!(crossDay&&this.cursor===DAY_SLOTS&&end===DAY_SLOTS-1)))throw Error('不能回溯日程');
  const start=this.dispatchCursor,cells=this.today.cells.slice(start,end+1);for(const cell of cells)for(const action of cell.actions.filter(partTimeAction)){if(action.payload.start<start||action.payload.end>end)throw Error('请一次送出这次打工的全部日程格');}const payload={type:'schedule',date:this.today.date,start:minuteTime(this.dispatchMinute),end:end===DAY_SLOTS-1?'24:00':slotTime(end+1),crossDay,cells:cells.map(cell=>{const time=minuteTime(Math.max(cell.index*120,this.dispatchMinute));return{...structuredClone(cell),actions:cell.actions.map(action=>scheduleActionForPrompt(action,this.today.date,time)),attachments:cell.attachments.map(action=>scheduleActionForPrompt(action,this.today.date,time))};})};
  this.sending=true;try{const prepared=await preparePayload(payload);const content=['<玩家日程>',JSON.stringify(prepared),'</玩家日程>','只结算本区间操作，按先后顺序处理空格与备注；移动本身不产生额外催眠效果。'].join('\n');await send(content,prepared);this.acknowledgeSent(payload);return prepared;}finally{this.sending=false;}
 }
}
