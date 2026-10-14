import {contentPolicyCommandApplicable} from '../safety/character-content-policy-client.mjs';
import { HYPNOSIS_COMMANDS, HYPNOSIS_BODY_PARTS } from './hypnosis-catalog.mjs';
import {personnelPermissions} from '../object-manager/personnel-permissions.mjs';

export function hypnosisCommands(scope, lifetime) {
  if(!['personal','location'].includes(scope))return []; 
  return HYPNOSIS_COMMANDS.filter(command=>(scope==='personal'?command.scope==='people':['group','location'].includes(command.scope))&&command.lifetime===lifetime&&(scope==='personal'||lifetime==='temporary'));
}
export function hypnosisCost(command,{minutes=10,number=10,targetCount=1,partCount=1}={}) {
  const duration=command.timed?minutes:1,numeric=command.numeric?number:1,people=command.scope==='people'?targetCount:1;
  const cost=(command.parts?2:command.costValue)*duration*numeric*people*(command.parts?partCount:1);
  if(!Number.isSafeInteger(cost)||cost<0)throw Error('参数超出有效范围');
  return cost;
}
export function normalizeHypnosisRequest(draft,snapshot) {
  if(!['personal','location'].includes(draft.scope))throw Error('请选择催眠类别');
  if(draft.chatId&&draft.chatId!==snapshot.chatId)throw Error('当前聊天已经切换，请重新选择对象');
  if(snapshot.writable===false)throw Error('当前为历史记录，无法安排指令');
  const command=HYPNOSIS_COMMANDS.find(x=>x.id===draft.commandId);
  if(!command||!hypnosisCommands(draft.scope,draft.lifetime).includes(command))throw Error('请重新选择指令');
  const ids=[...new Set(draft.targetIds??[])],people=(snapshot.people??[]).filter(x=>ids.includes(x.id));
  if(command.scope==='people'){
    if(ids.some(id=>!personnelPermissions({id}).hypnosis)||people.some(actor=>!personnelPermissions(actor).hypnosis||actor.hypnosisEligible===false))throw Error('该人物不可作为催眠APP目标');
    if(!ids.length||people.length!==ids.length||people.some(x=>!x.present))throw Error('请选择当前时空在场的人物');
    if(people.some(x=>!contentPolicyCommandApplicable(x,command,draft.note)))throw Error('该指令没有适用的可选对象');
    if(people.length>99)throw Error('最多选择 99 位对象');
  }
  if(command.scope!=='people'&&!contentPolicyCommandApplicable(null,command,draft.note))throw Error('该指令没有适用的可选对象');
  if(command.scope!=='people'&&ids.length)throw Error('范围催眠无需选择人物或人数');
  const location=(snapshot.locations??[]).find(x=>x.id===draft.locationId);
  const allowedPlaces=new Set([snapshot.location?.id,...(snapshot.locationAncestors??[]).map(x=>x.id)]);
  if(command.scope!=='people'&&(!location||(!allowedPlaces.has(location.id))||(location.id!==snapshot.location?.id&&command.id!=='vip5_open_space_common_sense')))throw Error('请选择当前地点；开放空间常识可向上选择父地点');
  const minutes=Number(draft.minutes??10),number=Number(draft.number??command.numeric?.fallback??1);
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('持续时间应为 1—1440 分钟');
  if(command.numeric&&(!Number.isInteger(number)||number<command.numeric.min||number>command.numeric.max))throw Error('请输入有效的'+command.numeric.label);
  if((Number.isFinite(Number(snapshot.vipRank))?Number(snapshot.vipRank):0)<Number(command.tier.replace('VIP','')||0)&&command.tier!=='TRIAL')throw Error('该指令当前未解锁');
  const partIds=[...new Set(draft.partIds??[])],availableParts=hypnosisBodyParts(people);
  if(command.parts&&(!partIds.length||partIds.length>5||partIds.some(id=>!availableParts.some(x=>x.id===id))))throw Error('请选择 1—5 个有效部位');
  const cost=hypnosisCost(command,{minutes,number,targetCount:people.length,partCount:partIds.length});
  if(!Number.isFinite(Number(snapshot.energy))||Number(snapshot.energy)<cost)throw Error('当前 MC 能量不足');
  return {chatId:snapshot.chatId??'',scope:draft.scope,lifetime:command.lifetime,commandId:command.id,command,targets:command.scope==='people'?people.map(({id,name,objectRef})=>({id,name,objectRef})):[],location:command.scope!=='people'?{id:location.id,name:location.name,objectRef:location.objectRef}:null,effectOwner:command.scope==='people'?null:{kind:'location',id:location.id},minutes,number,partIds:command.parts?partIds:[],partLabels:command.parts?availableParts.filter(x=>partIds.includes(x.id)).map(x=>x.label):[],note:String(draft.note??'').trim().slice(0,1200),cost,contextKey:snapshot.contextKey};
}

export function hypnosisOrganTargetEligible(person) {
 return contentPolicyCommandApplicable(person,HYPNOSIS_COMMANDS.find(x=>x.id==='vip1_temp_sensitivity'));
}
export function hypnosisBodyParts(people=[]) {
 return people.length&&people.every(hypnosisOrganTargetEligible)?HYPNOSIS_BODY_PARTS:[];
}
export function normalizeHypnosisBatch(draft,snapshot) {
 if(!Array.isArray(draft.requests)||!draft.requests.length)throw Error('请先选择至少一条指令');
 const requests=draft.requests.map(request=>normalizeHypnosisRequest(request,snapshot));
 if(requests.some(x=>x.scope!==requests[0].scope||x.lifetime!==requests[0].lifetime))throw Error('请在同一类别内安排指令');
 if(new Set(requests.map(x=>x.commandId)).size!==requests.length)throw Error('同一指令不能重复添加');
 const soundwave=Boolean(draft.soundwave)&&requests.some(x=>x.command.scope==='people');
 if(soundwave&&Number(snapshot.vipRank)<1)throw Error('声波催眠当前未解锁');
 const cost=requests.reduce((sum,x)=>sum+x.cost,0)+(soundwave?100:0);
 if(Number(snapshot.energy)<cost)throw Error('当前 MC 能量不足');
 return {requests,soundwave,cost,chatId:snapshot.chatId,contextKey:snapshot.contextKey};
}
