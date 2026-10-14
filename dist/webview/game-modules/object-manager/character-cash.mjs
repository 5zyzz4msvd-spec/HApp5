import {CHARACTER_CASH_PROFILES} from './character-cash-profiles.mjs';

export const CASH_POLICY_ID='personnel-cash-policy';
export const CASH_DATE_ID='personnel-cash-date';
const flat=elements=>elements.flatMap(field=>field.type==='group'?[field,...flat(field.elements??[])]:[field]);
const nameKey=name=>String(name??'').replace(/[\s＆&]/g,'');
export function cashAmountField(actor){return flat(actor.elements??[]).find(field=>field.type==='number'&&!field.binding&&['现金','随身现金'].includes(field.label));}
export function retainCharacterCashState(actor,current){
  if(!current||actor.id==='user'||!cashAmountField(current))return;
  const field=cashAmountField(actor);
  actor.values[field.id]=current.values[cashAmountField(current).id];
  if(current.cashRefresh)actor.cashRefresh=normalizeCashRefresh(current.cashRefresh);
  else {delete actor.cashRefresh;actor.values[CASH_POLICY_ID]=structuredClone(current.values[CASH_POLICY_ID]??cashProfileFor(current));actor.values[CASH_DATE_ID]=current.values[CASH_DATE_ID]??'';actor.ui.cashPendingFirstRefresh=current.ui?.cashPendingFirstRefresh===true;}
  ensureCharacterCash(actor);
}
export function cashProfileFor(actor){
  const exact=Object.entries(CHARACTER_CASH_PROFILES.characters).find(([name])=>nameKey(name)===nameKey(actor.name));
  return structuredClone(exact?.[1]??CHARACTER_CASH_PROFILES.fallback);
}
function validPolicy(value){return value&&[value.min,value.max,value.step].every(Number.isSafeInteger)&&value.min>=0&&value.max>=value.min&&value.step>=1&&(value.max-value.min)%value.step===0;}
export function normalizeCashRefresh(value){
  if(!validPolicy(value))throw Error('人物现金刷新属性无效');
  return {min:value.min,max:value.max,step:value.step,basis:String(value.basis??''),lastDate:String(value.lastDate??''),pendingFirstDraw:value.pendingFirstDraw===true};
}
export function ensureCharacterCash(actor,{profile=null}={}){
  if(actor.kind!=='character'||actor.id==='user')return actor;
  actor.ui??={};actor.values??={};actor.elements??=[];
  let amount=cashAmountField(actor);
  if(!amount){
    amount={id:'personnel-cash',label:'现金',type:'number',min:0,max:Number.MAX_SAFE_INTEGER,unit:'日元',audience:'shared',modelWritable:true};
    if(flat(actor.elements).some(x=>x.id===amount.id))throw Error('人物现金字段ID冲突');
    const group=actor.elements.find(x=>x.label==='状态'&&x.type==='group')??actor.elements.find(x=>x.id==='runtime'&&x.type==='group');
    if(group)group.elements.push(amount);else actor.elements.push({id:'personnel-wallet',label:'钱包',type:'group',elements:[amount]});
    actor.ui.cashPendingFirstRefresh=true;
  }
  const savedPolicy=actor.values[CASH_POLICY_ID];
  const policy=actor.cashRefresh??(savedPolicy&&Object.keys(savedPolicy).length?savedPolicy:profile??cashProfileFor(actor));
  if(!validPolicy(policy))throw Error('人物现金刷新区间无效：'+actor.name);
  if(!Object.hasOwn(actor.values,amount.id))actor.values[amount.id]=policy.min;
  if(!Number.isSafeInteger(actor.values[amount.id])||actor.values[amount.id]<0)throw Error('人物现金必须为非负整数：'+actor.name);
  Object.assign(amount,{min:0,max:Number.MAX_SAFE_INTEGER,unit:'日元',audience:'shared',modelWritable:true,enabled:true});
  actor.cashRefresh=normalizeCashRefresh({...policy,lastDate:policy.lastDate??actor.values[CASH_DATE_ID]??'',pendingFirstDraw:policy.pendingFirstDraw??actor.ui.cashPendingFirstRefresh??false});
  delete actor.ui.cashPendingFirstRefresh;delete actor.values[CASH_POLICY_ID];delete actor.values[CASH_DATE_ID];
  function strip(elements){return elements.filter(field=>![CASH_POLICY_ID,CASH_DATE_ID].includes(field.id)).filter(field=>{if(field.type==='group'){field.elements=strip(field.elements??[]);if(['personnel-cash-settings','personnel-wallet'].includes(field.id)&&!field.elements.length)return false;}return true;});}
  actor.elements=strip(actor.elements);
  let information=actor.elements.find(field=>field.type==='group'&&field.label==='信息');
  if(!information){information={id:'personnel-cash-information',label:'信息',type:'group',elements:[]};actor.elements.push(information);}
  function removeAmount(elements){return elements.filter(field=>field.id!==amount.id).map(field=>field.type==='group'?{...field,elements:removeAmount(field.elements??[])}:field);}
  actor.elements=removeAmount(actor.elements);information=actor.elements.find(field=>field.id===information.id);information.elements.push(amount);
  actor.elements=actor.elements.filter(field=>field.id!=='personnel-wallet'||field.elements.length);
  return actor;
}

// Stable across retries/reloads and independent of the host's wall clock.
// A story day replaces yesterday's wallet; skipped days do not accumulate.
export function dailyCashAmount(profile,seed){
  if(!validPolicy(profile))throw Error('Invalid daily cash profile');
  let hash=2166136261;for(const c of String(seed)){hash^=c.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
  return profile.min+(hash%(1+(profile.max-profile.min)/profile.step))*profile.step;
}
export function refreshActorCash(actor,{date,chatKey}){
  const before=JSON.stringify(actor);ensureCharacterCash(actor);
  if(actor.id==='user')return false;
  const previous=actor.cashRefresh.lastDate;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('现金刷新需要完整故事日期');
  if(previous&&date<=previous)return before!==JSON.stringify(actor);
  if(previous||actor.cashRefresh.pendingFirstDraw){
    actor.values[cashAmountField(actor).id]=dailyCashAmount(actor.cashRefresh,JSON.stringify([chatKey,actor.id,date]));
  }
  actor.cashRefresh.lastDate=date;actor.cashRefresh.pendingFirstDraw=false;
  return before!==JSON.stringify(actor);
}
export async function refreshCharacterCashInTransaction(runtime,{date,writable=true}={}){
  if(!writable)return {changed:0};
  const changed=[];
  for(const actor of await runtime.store.listObjects('character')){
    if(actor.id==='user')continue;
    const before=JSON.stringify(actor);
    if(date)refreshActorCash(actor,{date,chatKey:runtime.store.chatKey});else ensureCharacterCash(actor);
    if(before!==JSON.stringify(actor))changed.push(actor);
  }
  if(changed.length)await runtime._writeLocalObjects(changed);
  return {changed:changed.length};
}
export const migrateCharacterCash=runtime=>runtime.personnelTransaction(()=>refreshCharacterCashInTransaction(runtime));
export function validateCharacterCashUpdate(actor,fieldId,value){
  if(actor.kind==='character'&&cashAmountField(actor)?.id===fieldId&&(!Number.isSafeInteger(value)||value<0))throw Error('人物现金必须为非负整数');
}
export const CHARACTER_CASH_RULE=`人物现金来自各自独立人物文件的现金属性，单位日元，表示当天随身可支配的钱而非家族或公司总资产。模型只能读取及结算当前余额，不得自行刷新或追加每日额度。钱包金额多不代表角色愿意给钱。索要、交易或催眠命令只有在剧情中实际交付后才结算；拒绝、越界失败、小游戏胜利但未交付均不转钱。交给user的实际金额不得超过该人物当前现金：同笔收入增加系统.持有零花钱并用ObjectUpdate等额减少该人物现金，只各结算一次；不得只给user加钱、扣成负数、凭空透支或拿星光点代替。user付给人物的钱同理等额记账。未入人物卡槽的现金不可更新。双胞胎同属一个人物文件，共用一份现金，不能各领取一次。`;
