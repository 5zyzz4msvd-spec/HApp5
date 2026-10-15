import { HYPNOSIS_COMMANDS } from '../phone-v2/hypnosis-catalog.mjs';
export const VIP_HEALTH=Object.freeze([20,35,100,225,420,620,800]);
export function vipHealth(rank){const value=Number(rank);return VIP_HEALTH[Math.max(0,Math.min(6,Number.isFinite(value)?Math.floor(value):0))];}
// Player power belongs to the selected command, never the account's VIP rank or old modules.
export const COMMAND_BATTLE_PROFILES=Object.freeze([
 {tier:0,label:'试用',pattern:'左右扇区',hp:320,damage:26,cooldown:1900,range:128,arc:'horizontal',remote:false,projectileCount:0,projectileSpeed:280,homing:false,pierce:false},
 {tier:1,label:'VIP 1',pattern:'扩展扇区',hp:360,damage:34,cooldown:1750,range:154,arc:'horizontal',remote:false,projectileCount:0,projectileSpeed:280,homing:false,pierce:false},
 {tier:2,label:'VIP 2',pattern:'交叉扇区',hp:420,damage:44,cooldown:1600,range:186,arc:'vertical',remote:false,projectileCount:0,projectileSpeed:280,homing:false,pierce:false},
 {tier:3,label:'VIP 3',pattern:'环周脉冲',hp:500,damage:70,cooldown:5500,range:220,arc:'all',remote:false,projectileCount:0,projectileSpeed:280,homing:false,pierce:false},
 {tier:4,label:'VIP 4',pattern:'环形弹幕',hp:600,damage:70,cooldown:1650,range:280,arc:'all',remote:true,projectileCount:8,projectileSpeed:300,homing:false,pierce:false},
 {tier:5,label:'VIP 5',pattern:'追踪穿透弹幕',hp:720,damage:88,cooldown:1400,range:350,arc:'all',remote:true,projectileCount:6,projectileSpeed:340,homing:true,pierce:true},
].map(item=>Object.freeze({...item,hp:vipHealth(item.tier),acquireRange:item.range,warmup:1000})));
export function commandBattleProfile(requests=[]){
 const commands=requests.map(request=>HYPNOSIS_COMMANDS.find(x=>x.id===(request?.commandId??request?.id))).filter(x=>x?.scope==='people');
 const tier=Math.max(0,...commands.map(x=>Number(x.tier.replace('VIP',''))||0));
 return {...COMMAND_BATTLE_PROFILES[tier],commandIds:[...new Set(commands.map(x=>x.id))]};
}
export async function runHypnosisResistanceGate(batch,people,{runBattle,storyEvents={},vipRank}={}){
 if(batch.requests.every(x=>x.scope==='location'))return {gate:'not-required',required:false,plotGate:'pending',targets:[],rule:'地点催眠无需小游戏；效果仅由剧情按命令、地点和条件判断。双胞胎与林安不受影响。'};
 const result=await runBattle(people,{commandRequests:batch.requests,storyEvents,vipRank});
 if(result?.confirmed!==true)return{gate:'resistance',required:true,success:false,reason:'cancelled',confirmed:false,targets:[],plotGate:'pending'};
 return{...result,plotGate:'pending'};
}
export function hypnosisGatePrompt(scope){return scope==='location'?'地点催眠不运行抵抗小游戏，resistance.required=false；仅依据所选地点、催眠命令、人设与剧情条件判定效果，不把跳过小游戏当成成功，不影响双胞胎或林安。只按实际剧情结果结算能量，前端暂存不扣款。':'逐目标读取 resistance.targets.resisted：true代表目标抵抗成功，不可写催眠成功效果；false仅代表机制上的抵抗突破。旧结果无该字段时读取resistance.success。突破后仍依据人设、命令越界程度、条件和剧情阻碍独立判断，越界仍可失败，不得直接接受极端要求。只按实际剧情结果写入效果并结算能量，前端暂存不扣款。';}
