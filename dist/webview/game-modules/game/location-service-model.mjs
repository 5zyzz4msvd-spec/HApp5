export const LOCATION_SERVICE_DEFINITIONS=Object.freeze([
 {id:'twins-workshop',aliases:['书店二楼技术工作室','书店二楼工作室','书店二楼工作间','双胞胎工作室'],services:['app-services','part-time']},
 {id:'lin-an-office',aliases:['林安事务所','林安侦探事务所'],services:['scout','detective','part-time']},
]);
export const LOCATION_SERVICE_ALIASES=Object.fromEntries(LOCATION_SERVICE_DEFINITIONS.map(item=>[item.id,[...item.aliases]]));
export function locationServices(location){
 const id=typeof location==='object'?String(location?.id??''):'';
 if(id)return LOCATION_SERVICE_DEFINITIONS.find(item=>item.id===id)?.services??[];
 const text=typeof location==='string'?location:String(location?.name??'');
 return LOCATION_SERVICE_DEFINITIONS.find(item=>item.id===text||item.aliases.includes(text))?.services??[];
}
const ref=value=>{if(value?.kind&&value.kind!=='location'||!value?.id)throw Error('地点尚未确认');return{kind:'location',id:String(value.id)};};
export function captureLocationNote(context,text){
 if(!context?.writable)throw Error('当前日程仅供查看');
 if(!Number.isInteger(context.index)||context.index<0||context.index>11||!context.date)throw Error('请选择可编辑的日程格');
 const location=ref(context.location),value=String(text??'').slice(0,1800);
 return {date:String(context.date),index:context.index,location,name:String(context.location.name??location.id),text:value,key:JSON.stringify([context.date,context.index,location.id])};
}
export function locationNoteAction(capture){return{type:'location-note',title:capture.name+' · 地点备注',payload:{location:structuredClone(capture.location),locationName:capture.name,text:capture.text},hiddenPrompt:'这条备注仅绑定payload.location的稳定地点。按本格实际在该地点的行动理解payload.text；不得因前端随后切换地点，将旧备注移交给其他地点。备注本身不自动收费、催眠、解锁人物或追加任务。'};}
export class LocationNoteDrafts{
 constructor({getContext,stage,remove=async()=>{},canStageCapture=()=>true,read=async()=>null,write=async()=>{}}){Object.assign(this,{getContext,stage,remove,canStageCapture,read,write});this.drafts={};this.confirmed={};this.pending=new Map();this.queue=Promise.resolve();}
 async init(){const saved=await this.read();if([1,2].includes(saved?.schema)&&saved.drafts&&typeof saved.drafts==='object')this.drafts=structuredClone(saved.drafts);if(saved?.schema===2)this.confirmed=structuredClone(saved.confirmed??{});return this;}
 key(){const context=this.getContext();return JSON.stringify([context.date,context.index,context.location?.id]);}
 text(){return String(this.drafts[this.key()]?.text??'');}
 textFor(context){return String(this.drafts[JSON.stringify([context.date,context.index,context.location?.id])]?.text??'');}
 setText(text,{context=this.getContext()}={}){const capture=captureLocationNote(context,text);this.drafts[capture.key]=capture;this.pending.set(capture.key,capture);return capture;}
 hasPending(context=this.getContext()){const key=JSON.stringify([context.date,context.index,context.location?.id]);return Boolean(this.drafts[key]&&this.drafts[key].text!==(this.confirmed[key]?.text??''));}
 flush(){const job=this.queue.then(async()=>{await this.write({schema:2,drafts:structuredClone(this.drafts),confirmed:structuredClone(this.confirmed)});return{staged:0,retained:this.pending.size};});this.queue=job.catch(()=>{});return job;}
 confirm(context=this.getContext()){const capture=captureLocationNote(context,this.textFor(context)),job=this.queue.then(async()=>{
   if(!this.canStageCapture(capture))throw Error('此日程格已不能写入，文字仍保留为草稿');
   const mergeKey='location-note:'+capture.key;
   await this.write({schema:2,drafts:structuredClone(this.drafts),confirmed:structuredClone(this.confirmed)});
   if(capture.text.trim())await this.stage(locationNoteAction(capture),{index:capture.index,mergeKey,expectedDate:capture.date,preserveSelection:true});else await this.remove(mergeKey,{index:capture.index,expectedDate:capture.date});
   const previous=this.confirmed[capture.key];this.confirmed[capture.key]=capture;
   if(this.pending.get(capture.key)?.text===capture.text)this.pending.delete(capture.key);
   try{await this.write({schema:2,drafts:structuredClone(this.drafts),confirmed:structuredClone(this.confirmed)});}catch(error){if(previous)this.confirmed[capture.key]=previous;else delete this.confirmed[capture.key];if(this.drafts[capture.key]?.text===capture.text)this.pending.set(capture.key,capture);throw error;}return{staged:1,retained:this.pending.size};
  });this.queue=job.catch(()=>{});return job;}
}
