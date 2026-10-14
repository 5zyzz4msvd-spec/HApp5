import { normalizeCharacter } from './contracts.mjs';
import {inventoryFromState} from '../game/live-context.mjs';

export const USER_MANAGEMENT_FILE='migrations/user-management-v1.json';
export const USER_REF=Object.freeze({kind:'character',id:'user'});
export const USER_SUSPICION_FIELD='player-suspicion';
const own=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function hasLegacyUserState(state){return ['系统','主角','用户','user','玩家'].some(key=>own(state?.[key])&&Object.keys(state[key]).length>0)||own(state?.角色?.['{{user}}'])||own(state?.角色?.user);}
const fields=[
 {id:'player-state',type:'group',label:'状态',elements:[{id:USER_SUSPICION_FIELD,type:'number',label:'可疑度',min:0,audience:'shared'},{id:'player-possession',type:'text',label:'附身状态',audience:'plot',modelWritable:false}]},
 {id:'player-profile',type:'group',label:'自身资料',elements:[{id:'player-personal-record',type:'record',label:'个人资料',audience:'shared'}]},
];
export const USER_MANAGEMENT_CONTRACT='{{user}}是独立玩家对象character:user，其自身状态、资料、事件、任务与成就由该对象及归属子对象维护。可疑度只使用ObjectUpdate的replace /values/player-suspicion；自身资料只更新 /values/player-personal-record 的完整记录。不再修改旧系统.主角可疑度和系统._user身份，不创建第二个玩家，不把玩家算作调查、物色、催眠目标或人物卡槽候选。金钱、MC能量、MC上限、VIP仍由应用账户单一结算入口维护，不通过玩家资料字段或模型补发奖励。';
function sourceProfile(state,userName){
 const sources=[state?.主角,state?.用户,state?.user,state?.玩家,state?.角色?.['{{user}}'],state?.角色?.user,userName?state?.角色?.[userName]:null,state?.系统?.主角信息,state?.系统?.玩家信息];
 const profile={};for(const source of sources.filter(own))for(const [key,value]of Object.entries(source))if(!Object.hasOwn(profile,key)&&!['主角可疑度','可疑度','MC能量','MC能量上限','持有零花钱','催眠APP订阅等级','_催眠APP订阅等级','VIP等级','_VIP等级','星光点','持有物品','库存','道具'].includes(key))profile[key]=structuredClone(value);
 for(const [key,value]of Object.entries(state?.系统??{}))if(/^主角/.test(key)&&!['主角可疑度','主角信息'].includes(key)&&!Object.hasOwn(profile,key))profile[key]=structuredClone(value);
 if(state?.系统?._user身份!==undefined)profile.身份=structuredClone(state.系统._user身份);
 return profile;
}
export async function ensureUserManagement(runtime,{legacyState={},userName=''}={}){
 return runtime.personnelTransaction(async()=>{
  const marker=await runtime.store.readJson(USER_MANAGEMENT_FILE,null),before=await runtime.store.getObject(USER_REF);
  if(marker?.schema===2&&before?.ui?.userManagement===2)return before;
  const actor=before??normalizeCharacter({...USER_REF,name:userName||'{{user}}',elements:[],values:{}});
  const values={...actor.values},elements=[...actor.elements];
  const generic=elements.findIndex(x=>x.id==='runtime'&&x.elements?.length===3&&x.elements.every(f=>['affinity','alertness','cooperation'].includes(f.id)&&values[f.id]===0));
  if(actor.ui?.source==='builtin-object-template'&&generic>=0){for(const field of elements[generic].elements)delete values[field.id];elements.splice(generic,1);}
  for(const group of fields){const existing=elements.find(x=>x.id===group.id);if(existing){for(const field of group.elements)if(!existing.elements.some(x=>x.id===field.id))existing.elements.push(structuredClone(field));}else elements.push(structuredClone(group));}
  if(!Object.hasOwn(values,USER_SUSPICION_FIELD)){
   const old=actor.elements.flatMap(x=>x.elements??[x]).find(x=>['可疑度','主角可疑度'].includes(x.label));
   const raw=old?actor.values[old.id]:legacyState?.系统?.主角可疑度??legacyState?.主角?.可疑度??legacyState?.user?.可疑度??0;
   values[USER_SUSPICION_FIELD]=Math.max(0,Number(raw)||0);
  }
  if(!Object.hasOwn(values,'player-personal-record'))values['player-personal-record']=sourceProfile(legacyState,userName);
  else if(marker?.schema===1)values['player-personal-record']={...sourceProfile(legacyState,userName),...values['player-personal-record']};
  if(!Object.hasOwn(values,'player-possession'))values['player-possession']=String(legacyState?.系统?.附身??'');
  actor.elements=elements;actor.values=values;actor.ui={...actor.ui,userManagement:2};actor.aliases=[...new Set([...actor.aliases,'user','{{user}}',...(userName?[userName]:[])])];
  const entries=actor.worldbook.entries.filter(x=>x.id!=='player-management-policy');entries.push({id:'player-management-policy',comment:'玩家独立管理',content:USER_MANAGEMENT_CONTRACT,constant:true,position:4,depth:0,order:9});actor.worldbook.entries=entries;
  const slots=await runtime.store.getCharacterSlots();if(!slots.some(x=>x.ref.id==='user'&&x.enabled!==false))slots.push({slotId:'default-user',ref:USER_REF,enabled:true,order:0});
  const extra=new Map([['slots/characters.json',slots],[USER_MANAGEMENT_FILE,{schema:2,owner:USER_REF,source:'legacy user fields imported once; account resources stay at their existing owner'}]]);
  if(!await runtime.store.readJson('archives/user-source-v1.json',null))extra.set('archives/user-source-v1.json',{system:structuredClone(legacyState?.系统??{}),suspicion:legacyState?.系统?.主角可疑度,profile:sourceProfile(legacyState,userName)});
  await runtime._writeLocalObjects([actor],extra);
  return runtime.store.getObject(USER_REF);
 });
}
export async function readUserManagement(runtime){const actor=await runtime.store.getObject(USER_REF);return{actor,suspicion:Number(actor?.values?.[USER_SUSPICION_FIELD])||0};}
// Views read the existing resource owners; they never create another balance.
export async function userNotebookSources(runtime,{legacyState={},preview=false}={}){
 const system=legacyState.系统??{},owned=await runtime.store.readJson('account/resources.json',{starlight:0,items:{}});
 const playerResources=preview?{...await runtime.store.readJson('ui/demo-resources.json',{money:18000,energy:120,energyCap:1500,vipRank:0}),starlight:0}:{money:Number(system.持有零花钱??0),energy:Number(system.MC能量??0),energyCap:Number(system.MC能量上限??0),vipRank:Number(String(system.催眠APP订阅等级??system._催眠APP订阅等级??system.VIP等级??system._VIP等级??0).replace(/[^0-9]/g,'')),starlight:Number(system.星光点??0)};
 playerResources.rewardStarlight=Number(owned.starlight??0);
 const items=new Map(inventoryFromState(legacyState).map(item=>[item.name,item]));
 for(const [name,item]of Object.entries(owned.items??{})){const previous=items.get(name)??{name,count:0,description:''};items.set(name,{...previous,count:previous.count+Number(item.quantity??0),description:previous.description||item.description||''});}
 const playerContext=Object.fromEntries([['year',system.当前年份],['weekdayLabel',system._当前周几],['activity',system._当前日程],['specialDate',system._当前特殊日期],['event',system.当前事件]].filter(([,value])=>value!==undefined&&value!==''));
 return{playerResources,playerInventory:[...items.values()].filter(item=>item.count>0),playerContext};
}
export function userNotebookGroups(actor,resources=null,{context=null,inventory=null}={}){
 const state={id:'player-state',label:'状态',fields:[{id:USER_SUSPICION_FIELD,label:'可疑度',path:[],type:'number',min:0,max:100,value:Number(actor.values[USER_SUSPICION_FIELD])||0}]};
 if(resources)state.fields.push(...[['energy','MC能量','MC'],['energyCap','MC能量上限','MC'],['vipRank','VIP等级',''],['money','持有零花钱','日元'],['starlight','星光点',''],['rewardStarlight','成就任务奖励星光点','']].filter(([id])=>Object.hasOwn(resources,id)&&(id!=='rewardStarlight'||resources[id]!==0)).map(([id,label,unit])=>({id:'account-view-'+id,label,unit,path:[],type:'number',value:Number(resources[id])||0,readOnly:true})));
 if(actor.values['player-possession'])state.fields.push({id:'player-possession',label:'附身状态',path:[],type:'text',value:actor.values['player-possession'],readOnly:true});
 const result=[state,{id:'player-profile',label:'自身资料',fields:[{id:'player-personal-record',label:'个人资料',path:[],type:'record',value:structuredClone(actor.values['player-personal-record']??{})}]}];
 if(inventory)result.push({id:'player-inventory-view',label:'持有物品',fields:[{id:'inventory-view',label:'物品',path:[],type:'record',value:Object.fromEntries(inventory.map(item=>[item.name,{数量:item.count,描述:item.description||''}])),readOnly:true}]});
 if(context)result.push({id:'player-context-view',label:'当前行程',fields:[['date','当前日期',context.date],['time','当前时间',context.time],['location','当前地点',context.locationName??context.location?.name??''],['year','当前年份',context.year],['weekday','星期',context.weekdayLabel],['activity','当前日程',context.activity],['specialDate','特殊日期',context.specialDate],['event','当前事件',context.event]].filter(([, ,value])=>value).map(([id,label,value])=>({id:'context-view-'+id,label,path:[],type:'text',value,readOnly:true}))});
 // Keep explicitly stored player fields, including future custom variables.
 const displayed=new Set(['player-suspicion','player-possession','player-personal-record']);
 const collect=(elements,path,fields)=>{for(const field of elements??[]){if(field.enabled===false||field.binding||displayed.has(field.id)||['可疑度','主角可疑度'].includes(field.label))continue;if(field.type==='group')collect(field.elements,[...path,field.label],fields);else if(Object.hasOwn(actor.values,field.id)&&actor.values[field.id]!==''&&actor.values[field.id]!=null){fields.push({...field,path,type:field.type,value:structuredClone(actor.values[field.id])});displayed.add(field.id);}}};
 for(const group of actor.elements??[]){const extra=[];if(group.type==='group')collect(group.elements,[],extra);else collect([group],[],extra);if(group.id==='persona')for(let i=extra.length-1;i>=0;i--)if(['age','height'].includes(extra[i].id)&&extra[i].value===0)extra.splice(i,1);if(!extra.length)continue;const target=result.find(item=>item.id===group.id||item.label===group.label);if(target)target.fields.push(...extra);else result.push({id:group.id,label:group.label||'其他变量',fields:extra});}
 return result;
}
