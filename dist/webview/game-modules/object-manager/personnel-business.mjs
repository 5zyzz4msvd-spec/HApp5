import {createPaintedScoutingProvider,PAINTED_SCOUTING_NAMES} from './scouting-candidate-provider.mjs';
import { acquisitionState, slotEligible, scoutingRequired, scoutingCandidateEligible, scoutingAvailable, SCOUTING_COMING_SOON, SCOUT_REQUIRED_PERSONNEL } from './personnel-access.mjs';
import { applyPersonnelInitials } from './personnel-initials.mjs';
import { normalizeLocation } from './contracts.mjs';
import { PERSONNEL_TIME_SLOTS, fixedPersonnelRows } from './personnel-time-grid.mjs';
import { resolveScheduleDay } from './schedule.mjs';
import { DETECTIVE_PRICES, AFFINITY_DEFINITIONS } from './personnel-config.mjs';
import { LIN_AN_DEFINITION } from './lin-an-definition.mjs';
import { SharedRoleMedia } from './shared-role-media.mjs';
import { sha256 } from '../workshop/task-package.mjs';
import { encounterCharacterDraft } from './encounter-import.mjs';
import { plannedHomeRef, planUnlockedPersonnelLocations, recoverPersonnelLocationUnlocks } from './personnel-homes.mjs';
import { prepareRoutineCatalog } from './catalog-install.mjs';
import { retireLegacyAffinity } from './personnel-affinity-retirement.mjs';
import {personnelPermissions} from './personnel-permissions.mjs';
import {refreshCharacterCashInTransaction} from './character-cash.mjs';

export const PERSONNEL_POLICY={retiredGroups:['物品','事件','记录','子嗣'],retiredFields:['当前心情','心情','疲劳'],exposeRelations:false,fileAffinityEvents:true,historicalOrgasmCounts:true};
export function storyStamp(context) {
  const m=String(context.date??'').match(/(?:(\d{4})[年/.-])?(\d{1,2})[月/.-](\d{1,2})/),t=String(context.time??'').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const year=Number(m?.[1]??context.year);
  if(!m||!t||!Number.isInteger(year)||year<1900)throw Error('故事日期或时间尚未就绪');
  const value=new Date(Date.UTC(year,Number(m[2])-1,Number(m[3]),Number(t[1]),Number(t[2])));
  if(value.getUTCMonth()!==Number(m[2])-1||value.getUTCDate()!==Number(m[3]))throw Error('故事日期无效');
  return value.getTime()/60000;
}
export function isoStoryDate(stamp){return new Date(stamp*60000).toISOString().slice(0,10);}
const minutes=time=>{const a=String(time).split(':').map(Number);return a[0]*60+a[1];};
const timeText=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.codePointAt(0);n=Math.imul(n,16777619)>>>0;}return n;}
export function overlayScheduleRows(rows, overlays) {
  let result=structuredClone(rows??[]);
  for(const overlay of overlays??[]){const start=minutes(overlay.start),end=minutes(overlay.end),next=[];
    for(const row of result){const a=minutes(row.start),b=minutes(row.end);if(b<=start||a>=end)next.push(row);else {if(a<start)next.push({...row,id:row.id+'-before',end:overlay.start});if(b>end)next.push({...row,id:row.id+'-after',start:overlay.end});}}
    next.push({...overlay,enabled:true});result=next;
  }
  return result.sort((a,b)=>minutes(a.start)-minutes(b.start));
}
export function firstAvailableAffinitySlot(context) {
  const daily=context.daily;if(!daily||daily.date!==context.date)return null;
  if((daily.cards??[]).filter(x=>['action','note'].includes(x.kind)).length>=6)return null;
  return daily.slots.find(slot=>!slot.sent&&minutes(slot.time)>=minutes(context.time)&&!(daily.cards??[]).some(card=>card.slotId===slot.id))??null;
}
export function validateAffinityDefinition(definition) {
  const x=structuredClone(definition);
  if(!/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(x.id??'')||!String(x.name??'').trim()||!Number.isFinite(x.threshold))throw Error('好感事件定义缺少稳定ID、名称或阈值');
  if(!Number.isInteger(x.durationMinutes)||x.durationMinutes<1||x.durationMinutes>180)throw Error('好感事件时长须为1—180分钟');
  if(x.prompt?.content&&x.prompt.uses!==null&&(!Number.isInteger(x.prompt.uses)||x.prompt.uses<1))throw Error('隐藏提示词次数无效');
  return x;
}
export class PersonnelBusiness {
  constructor(runtime,{environment=null,random=()=>Math.random(),definitions=AFFINITY_DEFINITIONS}={}){this.runtime=runtime;this.store=runtime.store;this.media=new SharedRoleMedia(runtime.store.driver);this.environment=environment;this.random=random;this.definitions=definitions;this.ready=null;}
  configure(environment){this.environment=environment;}
  context(){if(!this.environment?.context)throw Error('故事时间接口未连接');return this.environment.context();}
  async init(){if(this.ready)return this.ready;this.ready=this.prepare();try{return await this.ready;}catch(e){this.ready=null;throw e;}}
  async prepare(){
    const runtime=this.runtime;
    const config=await this.store.readJson('services/detective-prices.json',null);
    if(!config)await this.store.writeJson('services/detective-prices.json',DETECTIVE_PRICES);
    if(!await this.store.readJson('services/affinity-definitions.json',null))await this.store.writeJson('services/affinity-definitions.json',this.definitions);
    await retireLegacyAffinity(runtime);
    runtime.personnelPolicy=PERSONNEL_POLICY;await this.store.writeJson('settings/personnel.json',PERSONNEL_POLICY);
    if(!await this.store.getObject(LIN_AN_DEFINITION))await runtime.saveCharacterDefinition(LIN_AN_DEFINITION);
    const officeRef={kind:'location',id:'lin-an-office'};
    if(!await this.store.getObject(officeRef)){
      const all=await this.store.listObjects('location'),parent=all.find(x=>x.name==='商业街')??all.find(x=>x.id==='map-world');
      if(!parent)throw Error('事务所缺少城市父地点');
      const building=normalizeLocation({kind:'location',id:'lin-an-office-building',name:'商业街小楼',children:[officeRef],data:{description:'一栋临街旧楼。',mapScope:'world',mapId:'lin-an-office-building'},ui:{source:'personnel-service'}});
      const office=normalizeLocation({...officeRef,name:'林安侦探事务所',data:{description:'一间朴素的小办公室，旧桌子、资料柜和两把椅子。',mapScope:'world',mapId:'lin-an-office'},ui:{source:'personnel-service',sceneBackground:'notebook/lin-an-office.png'}});
      parent.children.push({kind:'location',id:building.id}); if(parent.ui.board){ if(parent.children.length===1)parent.ui.board.enabled=true; if(parent.ui.board.enabled&&!parent.ui.board.cells.includes(building.id))parent.ui.board.cells.push(building.id); }
      await runtime.saveLocationBatch([parent,building,office]);
    }


    await prepareRoutineCatalog(runtime);
    await recoverPersonnelLocationUnlocks(runtime);await applyPersonnelInitials(runtime);await runtime.syncWorldbook();return this;
  }
  async quotesFor(rows) { await this.init(); return this.runtime.personnelTransaction(async () => {
    const config = await this.store.readJson('services/detective-prices.json'); const prices = {}, usedScout = new Set(Object.values(config.prices).map(x => x.scout)), usedInvestigation = new Set(Object.values(config.prices).map(x => x.investigate)); let changed = false;
    for (const row of rows) {
      if (!config.prices[row.name]) { const f = config.fallback ?? DETECTIVE_PRICES.fallback, index = hash(row.name) % f.variants; let scout = f.scoutBase + index * f.step, investigate = f.investigateBase + index * f.step; while (usedScout.has(scout)) scout += f.step; while (usedInvestigation.has(investigate)) investigate += f.step; config.prices[row.name] = { scout, investigate }; usedScout.add(scout); usedInvestigation.add(investigate); changed = true; }
      prices[row.id] = structuredClone(config.prices[row.name]);
    }
    if (changed) await this.store.writeJson('services/detective-prices.json', config); return prices;
  }); }
  async quote(name) { return (await this.quotesFor([{ id: name, name }]))[name]; }
  async requiredCandidateSources(){
    return (this.environment?.paintedScoutingProvider??createPaintedScoutingProvider()).candidates();
  }

  async candidateSource(id){const approved=(await this.requiredCandidateSources()).find(x=>x.id===id);return this.environment?.paintedScoutingOnly===true?approved??null:await this.environment?.candidate?.(id)??approved??null;}
  async candidateMediaOwner(id) {
    const actor = await this.store.getObject({kind:'character',id});
    if(actor && actor.id!=='user' && actor.id!=='lin-an')return actor;
    const candidate = await this.candidateSource(id);
    if (!candidate?.role) throw Error('物色来源已失效');
    return { name: candidate.name ?? candidate.role.name, ui: {} };
  }
  async putCandidateImage(id, blob, options) {
    if ((await this.context()).writable === false) throw Error('历史楼层不可更换照片');
    return this.media.put(await this.candidateMediaOwner(id), blob, options);
  }
  async selectCandidateImage(id, selection) {
    if ((await this.context()).writable === false) throw Error('历史楼层不可更换照片');
    await this.candidateMediaOwner(id);
    return this.runtime.personnelTransaction(async () => {
      const selections = await this.store.readJson('ui/scouting-images.json', {});
      selections[id] = selection;
      await this.store.writeJson('ui/scouting-images.json', selections);
    });
  }
  async snapshot(){await this.init();await applyPersonnelInitials(this.runtime);const context=await this.context();await this.tick(context);
    const permissionState=await this.runtime.resolvePersonnelPermissions();
    const state=await this.store.readJson('services/detective.json',{active:null,history:[]}),stamp=storyStamp(context);
    const candidates=await this.environment?.candidates?.()??[];const actors=await this.store.listObjects('character');
    const approved=await this.requiredCandidateSources();const sources=this.environment?.paintedScoutingOnly===true?[...approved]:[...candidates];if(this.environment?.paintedScoutingOnly!==true)for(const row of approved)if(!sources.some(x=>x.name===row.name))sources.push(row);
    const available=sources.filter(x=>scoutingCandidateEligible(x)&&!actors.some(a=>a.name===x.name&&acquisitionState(a)!=='unscouted'));
    for(const actor of actors)if((this.environment?.paintedScoutingOnly!==true||PAINTED_SCOUTING_NAMES.includes(actor.name))&&scoutingRequired(actor)&&acquisitionState(actor)==='unscouted'&&!available.some(x=>x.name===actor.name))available.push({id:actor.id,name:actor.name,portraits:actor.ui.sourcePortraits??[],info:{age:actor.values.age,identity:actor.values.identity}});
    const prices=await this.quotesFor([...actors.filter(x=>x.id!=='user'),...available]);
    const dossiers=await this.store.readJson("services/dossiers.json",{});
    const balance=await this.environment?.money?.read?.();
    const selections=await this.store.readJson('ui/scouting-images.json',{}),candidateRows=[];
    for(const candidate of available){
      const imageSelection=selections[candidate.id]??{mode:'portrait',portrait:0,standee:0,head:0},sharedAlbum=await this.media.album({name:candidate.name,ui:{}});
      const headRef=sharedAlbum.head?.[Number(imageSelection.head)||0];
      const information=Object.fromEntries(['姓名','性别','_年龄','年龄','社团或职业','身高','体重','三围'].filter(key=>candidate.information?.[key]!=null&&candidate.information[key]!=='').map(key=>[key,candidate.information[key]]));
      const clothing=Object.fromEntries(['头发','面部','上衣','下衣'].filter(key=>candidate.clothing?.[key]!=null).map(key=>[key,candidate.clothing[key]]));
      candidateRows.push({scoutingAllowed:scoutingAvailable(candidate),scoutingReason:scoutingAvailable(candidate)?'':SCOUTING_COMING_SOON,information,clothing,id:candidate.id,name:candidate.name,portrait:candidate.portrait??null,standee:candidate.standee??null,info:candidate.info??{},media:{portraits:[...new Set([...(candidate.portraits??[]),candidate.portrait].filter(Boolean))]},sharedAlbum,imageSelection,headUrl:headRef?await this.media.url(headRef):candidate.head??null,photoSource:candidate.photoSource??null,sourceEvidence:candidate.sourceEvidence??null});
    }
    return {active:state.active?{...state.active,progress:Math.max(0,Math.min(1,(stamp-state.active.startedAt)/(state.active.endsAt-state.active.startedAt)))}:null,last:state.history.at(-1)??null,balance:Number.isSafeInteger(balance)?balance:null,prices,characters:actors.filter(x=>x.id!=="user"&&acquisitionState(x)!=='unscouted').map(x=>({id:x.id,name:x.name,unlocked:personnelPermissions(x,permissionState).investigation&&dossiers[x.id]?.investigated===true,scoutingPending:acquisitionState(x)==='scouting',investigationAllowed:personnelPermissions(x,permissionState).investigation,permissionReason:personnelPermissions(x,permissionState).reason})),candidates:candidateRows,date:isoStoryDate(stamp),time:context.time};
  }
  async start(kind,targetId){await this.init();if(!['scout','investigate'].includes(kind))throw Error('委托类型无效');
    let actor=null,candidate=null;
    if(kind==='scout'){actor=await this.store.getObject({kind:'character',id:targetId});candidate=await this.candidateSource(targetId);if(!actor){if(!candidate?.role)throw Error('物色来源已失效');actor=await encounterCharacterDraft(candidate.role,{initialData:candidate.initialData});}}
    else actor=await this.store.getObject({kind:'character',id:targetId});
    if(!actor||actor.id==='user')throw Error('请选择有效的调查对象');
    if(kind==='scout'&&this.environment?.paintedScoutingOnly===true&&!PAINTED_SCOUTING_NAMES.includes(actor.name))throw Error('该人物不在已绘可物色来源范围；请按其原登场规则处理');
    if(kind==='scout'&&!scoutingRequired(actor))throw Error('这个人物无需物色；登场后可直接委托调查');
    if(kind==='scout'&&!scoutingAvailable(actor))throw Error(SCOUTING_COMING_SOON);
    if(kind==='scout'){const stored=(await this.store.listObjects('character')).find(x=>x.id===actor.id||x.name===actor.name);if(stored)actor=stored;if(!scoutingAvailable(actor))throw Error(SCOUTING_COMING_SOON);}
    const price=(await this.quote(actor.name))[kind];if(!Number.isSafeInteger(price)||price<1)throw Error('收费文件金额无效');
    return this.runtime.personnelTransaction(async()=>{
      if(kind==='scout'){const latest=await this.store.getObject(actor);if(!scoutingAvailable(latest??actor))throw Error(SCOUTING_COMING_SOON);}
      const context=await this.context();if(context.writable===false)throw Error('历史楼层不可受理委托');await this.recoverPayment();await this._tick(context);const stamp=storyStamp(context);
      if(kind==='investigate'){const decision=personnelPermissions(actor,await this.runtime.resolvePersonnelPermissions());if(!decision.investigation)throw Error(decision.reason);}
      const state=await this.store.readJson('services/detective.json',{active:null,history:[]});if(state.active)throw Error('林安正在工作，完成后才能接下一单');
      const existing=await this.store.listObjects('character'),stored=existing.find(x=>x.id===actor.id||x.name===actor.name);if(kind==='scout'&&stored&&acquisitionState(stored)==='scouted')throw Error('这个人物的物色已经完成');
      const dossiers=await this.store.readJson('services/dossiers.json',{});if(kind==='investigate'&&(!slotEligible(actor)||dossiers[actor.id]?.investigated))throw Error(!slotEligible(actor)?'先完成物色，再调查':'档案已经解密');
      if(!this.environment?.money?.compareAndSet)throw Error('现金接口未连接');const before=await this.environment.money.read();if(!Number.isSafeInteger(before)||before<price)throw Error('现金不足');
      const days=7+Math.min(7,Math.max(0,Math.floor(this.random()*8))),id='case-'+crypto.randomUUID();const job={id,kind,targetId:actor.id,targetName:actor.name,paid:price,days,startedAt:stamp,endsAt:stamp+days*1440,routeSeed:hash(id),residenceOnly:kind==='scout'&&Boolean(stored&&slotEligible(stored))};
      state.active=job;if(kind==='scout'){if(!job.residenceOnly){actor.ui.scoutingPending=true;actor.ui.acquisitionState='scouting';}if(candidate?.sourceEvidence&&!actor.ui.scoutingSourceEvidence)actor.ui.scoutingSourceEvidence=structuredClone(candidate.sourceEvidence);if(candidate)actor.ui.sourcePortraits=[...new Set([...(actor.ui.sourcePortraits??[]),...(candidate.portraits??[]),candidate.portrait,candidate.role?.imageDataUrl,candidate.role?.image].filter(x=>typeof x==='string'&&x))];}
      const pending={schema:1,job,before,after:before-price,actor:kind==='scout'?actor:null};await this.store.writeJson('services/detective-payment.json',pending);
      if(!await this.environment.money.compareAndSet(before,before-price)){await this.store.writeJson('services/detective-payment.json',null);throw Error('现金余额已变化，未受理委托');}
      try{
        const prompts=await this.store.readJson('prompts/personnel.json',[]);prompts.push({id:id+'-paid',content:`{{user}}已向林安支付${price}日元，请她${kind==='scout'?'物色':'调查'}${actor.name}。预计${days}个故事日。费用已由前端扣除，模型不得重复扣款或改变工期、任务状态、解密状态。`,remaining:1,kind:'receipt'});
        const files=new Map([['services/detective.json',state],['services/detective-payment.json',null],['prompts/personnel.json',prompts]]);
        if(kind==='scout'){
          const scoutingSelections=await this.store.readJson('ui/scouting-images.json',{});
          if(scoutingSelections[targetId]){const notebookSelections=await this.store.readJson('ui/notebook-images.json',{});notebookSelections[actor.id]=scoutingSelections[targetId];files.set('ui/notebook-images.json',notebookSelections);}
        }
        await this.runtime._writeLocalObjects(kind==='scout'?[actor]:[],files);
      }catch(e){const restored=await this.environment.money.compareAndSet(before-price,before);if(restored)await this.store.writeJson('services/detective-payment.json',null);else throw Error('委托保存失败，现金回滚未确认；请检查付款记录');throw e;}
      return job;
    });
  }
  async recoverPayment(){const pending=await this.store.readJson('services/detective-payment.json',null);if(!pending)return;const state=await this.store.readJson('services/detective.json',{active:null});if(state.active?.id===pending.job.id){await this.store.writeJson('services/detective-payment.json',null);return;}
    const balance=await this.environment?.money?.read?.();if(balance===pending.before){await this.store.writeJson('services/detective-payment.json',null);return;}
    if(balance===pending.after&&await this.environment.money.compareAndSet(pending.after,pending.before)){await this.store.writeJson('services/detective-payment.json',null);return;}
    throw Error('有未确认的委托付款，已停止新委托以免重复扣款');
  }
  async tick(context=undefined){await this.init();return this.runtime.personnelTransaction(async()=>{await this.recoverPayment();return this._tick(context??await this.context());});}
  async _tick(context){if(context.writable===false)return this.store.readJson('services/detective.json',{active:null,history:[]});const stamp=storyStamp(context),state=await this.store.readJson('services/detective.json',{active:null,history:[]});
    await refreshCharacterCashInTransaction(this.runtime,{date:isoStoryDate(stamp)});
    if(state.active&&stamp>=state.active.endsAt){const job=state.active,actor=await this.store.getObject({kind:'character',id:job.targetId});if(!actor)throw Error('委托对象缺失');if(job.kind==='investigate'&&!personnelPermissions(actor,await this.runtime.resolvePersonnelPermissions()).investigation)return state;const dossiers=await this.store.readJson('services/dossiers.json',{});dossiers[actor.id]={...(dossiers[actor.id]??{}),[job.kind==='scout'?'scouted':'investigated']:true,completedAt:job.endsAt};actor.ui.scoutingPending=false;actor.ui.acquisitionState='scouted';state.history.push({...job,completedAt:job.endsAt});state.active=null;
      const prompts=await this.store.readJson('prompts/personnel.json',[]);prompts.push({id:job.id+'-complete',content:`林安已完成对${job.targetName}的${job.kind==='scout'?'物色，该人物现可加入卡槽':'调查，人物档案现已解密'}。结算由脚本完成；不再次收费，不改人物数值。`,remaining:1,kind:'receipt'});
      if(job.kind==='scout'){actor.ui.residenceUnlocked=true;actor.ui.scoutCompleted=true;}
      const locations=job.kind==='scout'?await planUnlockedPersonnelLocations(this.runtime,actor):[];
      await this.runtime._writeLocalObjects([actor,...locations],new Map([['services/detective.json',state],['services/dossiers.json',dossiers],['prompts/personnel.json',prompts]]));
    }
    return state;
  }
  async homeFor(actor){return plannedHomeRef(actor);}
  async dayOverlays(context){return this.runtime.personnelTransaction(()=>this._dayOverlays(context));}
  async _dayOverlays(context){const stamp=storyStamp(context),date=isoStoryDate(stamp),saved=await this.store.readJson('services/date-routines.json',{});const result=structuredClone(saved[date]??{});const state=await this.store.readJson('services/detective.json',{active:null});
    if(!state.active||stamp<state.active.startedAt||stamp>=state.active.endsAt)return result;
    if(state.active.kind==='investigate'){const actor=await this.store.getObject({kind:'character',id:state.active.targetId});if(!actor||!personnelPermissions(actor,await this.runtime.resolvePersonnelPermissions()).investigation)return result;}
    const target=await this.store.getObject({kind:'character',id:state.active.targetId});const schedule=target.refs.schedule?await this.store.getObject(target.refs.schedule):null;let rows=schedule?fixedPersonnelRows(resolveScheduleDay(schedule,context),{defaultLocation:schedule.defaultLocation??schedule.emptyPolicy.location,name:target.name}):[];rows=overlayScheduleRows(rows,result[target.id]);const home=await this.homeFor(target);
    const boundaries=[540,1080,...rows.flatMap(x=>[minutes(x.start),minutes(x.end)]).filter(x=>x>540&&x<1080)];const marks=[...new Set(boundaries)].sort((a,b)=>a-b);const plan=[];
    for(let i=0;i<marks.length-1;i++){const a=marks[i],b=marks[i+1],row=rows.find(x=>minutes(x.start)<=a&&minutes(x.end)>=b),follow=row?.location&&(hash(`${state.active.routeSeed}:${date}:${a}`)%4!==0);plan.push({id:`detective-${i}`,start:timeText(a),end:timeText(b),location:follow?row.location:home,note:follow?'跟踪':'潜入',enabled:true});}
    result['lin-an']=plan;return result;
  }
  async triggerAffinity(){return {retired:true};}
  async hiddenPrompts(context=undefined){const ctx=context??await this.context();await this.tick(ctx);const records=await this.store.readJson('prompts/personnel.json',[]),date=isoStoryDate(storyStamp(ctx));
    const active=records.filter(x=>x.remaining===null||x.remaining>0).filter(x=>x.kind!=='affinity'||(x.manual===true||x.source==='user'||x.source==='manual')&&x.date===date&&ctx.daily?.cards?.some(card=>card.id==='affinity:'+x.eventKey&&ctx.daily.slots.find(s=>s.id===card.slotId)?.sent));
    const state=await this.store.readJson('services/detective.json',{active:null});let allowed=Boolean(state.active);if(state.active?.kind==='investigate'){const actor=await this.store.getObject({kind:'character',id:state.active.targetId});allowed=actor&&personnelPermissions(actor,await this.runtime.resolvePersonnelPermissions()).investigation;}if(allowed)active.push({id:'detective:work:'+state.active.id,kind:'work',content:`林安正在${state.active.kind==='scout'?'物色':'调查'}${state.active.targetName}，本次收费和工期已由前端确定并结算。她按目标当日去向跟踪或潜入；不得替脚本提前完成、重复收费或修改档案解密状态。`,remaining:null});return active;
  }
  async consumePrompts(ids,floorKey){return this.runtime.personnelTransaction(async()=>{const consumed=await this.store.readJson('services/personnel-prompt-replies.json',{});if(consumed[floorKey])return;const records=await this.store.readJson('prompts/personnel.json',[]),history=await this.store.readJson('services/affinity-history.json',{});for(const row of records)if(ids.includes(row.id)){if(row.remaining!==null)row.remaining=Math.max(0,row.remaining-1);if(row.eventKey&&history[row.eventKey])history[row.eventKey].status='occurred';}consumed[floorKey]=ids;await this.store.applyFileBatch(new Map([['prompts/personnel.json',records],['services/personnel-prompt-replies.json',consumed],['services/affinity-history.json',history]]));});}
}
