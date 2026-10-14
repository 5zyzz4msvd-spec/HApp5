const clone=value=>structuredClone(value),nonce=()=>globalThis.crypto.randomUUID();
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const same=(left,right)=>JSON.stringify(canonical(left))===JSON.stringify(canonical(right));
export const APP_SERVICE_TARGET='user-phone';
export const APP_SERVICE_QUOTE_VERSION=3;
export const VIP_SERVICE_PRICES=Object.freeze([50000,150000,500000,1500000,5000000,15000000]);
export const MC_ENERGY_UNIT_PRICE=100;
export const MC_CAP_BENEFIT_TIERS=Object.freeze([
 Object.freeze({id:'A',name:'单人永久催眠测试',requiredCharacters:1,minPermanent:1,increase:1500}),
 Object.freeze({id:'B',name:'单人多项永久催眠测试',requiredCharacters:1,minPermanent:5,increase:1500}),
 Object.freeze({id:'C',name:'双人永久催眠测试',requiredCharacters:2,minPermanent:3,increase:1500}),
]);
export function appResourcesFromSystem(system={}){return{money:Number(system.持有零花钱??0),energy:Number(system.MC能量??0),vipRank:Number(String(system.催眠APP订阅等级??system._催眠APP订阅等级??system.VIP等级??0).replace(/[^0-9]/g,'')),energyCap:Number(system.MC能量上限??0)};}
export function applyAppResourcesToSystem(system,next){system.持有零花钱=next.money;system.MC能量=next.energy;const key=Object.hasOwn(system,'催眠APP订阅等级')?'催眠APP订阅等级':Object.hasOwn(system,'_催眠APP订阅等级')?'_催眠APP订阅等级':'催眠APP订阅等级';system[key]=next.vipRank?'VIP'+next.vipRank:'';if(Number.isFinite(next.energyCap))system.MC能量上限=next.energyCap;return system;}
export function normalizeAppUpgrades(raw={}){raw=raw&&typeof raw==='object'?raw:{};const capBenefitClaims={};for(const tier of MC_CAP_BENEFIT_TIERS){const claim=raw.capBenefitClaims?.[tier.id];if(claim&&typeof claim==='object'&&typeof claim.nonce==='string'&&claim.nonce)capBenefitClaims[tier.id]=clone(claim);}return{schema:1,revision:Math.max(0,Math.floor(Number(raw.revision)||0)),hp:bounded(raw.hp,320,100,3000),cooldown:bounded(raw.cooldown,380,80,3000),range:bounded(raw.range,128,60,450),arc:['horizontal','vertical','all'].includes(raw.arc)?raw.arc:'horizontal',remote:raw.remote===true,receipts:Array.isArray(raw.receipts)?[...new Set(raw.receipts.filter(x=>typeof x==='string'))]:[],capBenefitClaims};}
function resources(raw={}){raw=raw&&typeof raw==='object'?raw:{};return{money:bounded(raw.money,0,0,1e9),energy:bounded(raw.energy,0,0,1e9),vipRank:Math.floor(bounded(raw.vipRank,0,0,6)),...(Number.isFinite(raw.energyCap)&&raw.energyCap>=0?{energyCap:bounded(raw.energyCap,0,0,1e9)}:{})};}
function meaningfulPermanent(value){if(typeof value==='string')return value.trim().length>0;if(!value||typeof value!=='object'||Array.isArray(value))return false;return ['效果','effect','描述','description','内容'].some(key=>typeof value[key]==='string'&&value[key].trim());}
// Only caller-supplied authoritative active object rows are examined. No count
// from a form, receipt, character catalogue or detached MVU role is accepted.
export function permanentHypnosisCount(character){const fields=[];function visit(elements,path=[]){for(const element of elements??[]){if(element.enabled===false)continue;const next=[...path,element.label];if(element.type==='group')visit(element.elements,next);else if(element.type==='record'&&!element.binding&&next.join('.')==='效果.永久催眠效果')fields.push(element);}}visit(character?.elements);if(fields.length!==1)return 0;const map=character?.values?.[fields[0].id];if(!map||typeof map!=='object'||Array.isArray(map))return 0;return Object.entries(map).filter(([key,value])=>key.trim()&&meaningfulPermanent(value)).length;}
export function appBenefitCandidates(characters=[]){const seen=new Set();return(Array.isArray(characters)?characters:[]).filter(character=>character?.kind==='character'&&character.id!=='user'&&typeof character.id==='string'&&!seen.has(character.id)&&(seen.add(character.id),true)).map(character=>({id:character.id,name:String(character.name??character.id),permanentCount:permanentHypnosisCount(character)}));}
function benefitSelection(tierId,ids,candidates){const tier=MC_CAP_BENEFIT_TIERS.find(x=>x.id===tierId);if(!tier)throw Error('请选择有效福利档位');if(!Array.isArray(ids)||ids.length!==tier.requiredCharacters||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('请选择'+tier.requiredCharacters+'位不同的槽内人物');const selected=ids.map(id=>candidates.find(x=>x.id===id));if(selected.some(x=>!x||x.permanentCount<tier.minPermanent))throw Error('人物必须仍在卡槽内，且每位至少有'+tier.minPermanent+'个实际永久催眠');return selected;}
function quoteService(serviceId,options,upgrades,balances,candidates=[],pricingVersion=APP_SERVICE_QUOTE_VERSION){const u=normalizeAppUpgrades(upgrades),r=resources(balances);let quote;
 if(serviceId==='vip-next'){const target=options.targetRank??r.vipRank+1;if(!Number.isInteger(target)||target<1||target>6)throw Error('请选择VIP 1—6目标等级');quote={id:serviceId,name:'VIP '+target+' 升级',description:'升级到所选目标等级，可跨级选择',price:{currency:'money',amount:pricingVersion===2?500*target:VIP_SERVICE_PRICES[target-1]},available:target>r.vipRank,parameters:{targetRank:target},targetRanks:Array.from({length:Math.max(0,6-r.vipRank)},(_,i)=>r.vipRank+i+1)};if(!quote.available)quote.reason='目标等级必须高于当前等级';}
 else if(serviceId==='energy-refill'){const amount=options.amount??1000;if(!Number.isSafeInteger(amount)||amount<=0||amount>1e9)throw Error('补充额度必须是有效的正整数MC');const cap=r.energyCap??1e9;quote={id:serviceId,name:'能量补充',description:'补充 '+amount.toLocaleString()+' MC 能量',price:{currency:'money',amount:pricingVersion===2?Math.ceil(amount/5):amount*MC_ENERGY_UNIT_PRICE},available:r.energy+amount<=cap,parameters:{amount},amountOptions:[100,500,1000,5000]};if(!quote.available)quote.reason='补充后将超过MC能量上限';}
 else if(serviceId==='energy-cap-benefit'){const tier=MC_CAP_BENEFIT_TIERS.find(x=>x.id===options.tier);if(!tier)throw Error('请选择有效福利档位');const claimed=Boolean(u.capBenefitClaims[tier.id]);quote={id:serviceId,name:'MC上限福利 · '+tier.id,description:'免费提升1,500 MC容量，每档仅可领取一次',price:{currency:'money',amount:0},available:!claimed&&Number.isFinite(r.energyCap)&&r.energyCap<=1e9-1500,claimed,parameters:{tier:tier.id,characterIds:Array.isArray(options.characterIds)?[...options.characterIds]:[]},tiers:MC_CAP_BENEFIT_TIERS.map(item=>({...item,claimed:Boolean(u.capBenefitClaims[item.id])}))};if(claimed)quote.reason='本档福利已领取';else if(!quote.available)quote.reason='当前MC容量数据不可办理';if(quote.available)try{quote.characters=benefitSelection(tier.id,options.characterIds,candidates);}catch(error){quote.available=false;quote.reason=error.message;}}
 else throw Error('当前无法申请这一服务');
 if(quote.available&&r.money<quote.price.amount){quote.available=false;quote.reason='零花钱不足';}return quote;
}
export function appServiceMenu(upgrades={},balances={}){const u=normalizeAppUpgrades(upgrades),r=resources(balances),targetRank=Math.min(6,r.vipRank+1);const vip=quoteService('vip-next',{targetRank},u,r),energy=quoteService('energy-refill',{},u,r);if(r.vipRank===6){vip.name='VIP 已达最高级';vip.available=false;}return[vip,energy,{id:'energy-cap-benefit',name:'MC上限福利',description:'测试用户福利，每档免费提升1,500 MC上限；三档最多增加4,500',price:{currency:'money',amount:0},available:Number.isFinite(r.energyCap)&&MC_CAP_BENEFIT_TIERS.some(x=>!u.capBenefitClaims[x.id]),tiers:MC_CAP_BENEFIT_TIERS.map(item=>({...item,claimed:Boolean(u.capBenefitClaims[item.id])}))}];}
export function parseAppServiceReceipts(text){const block=String(text).match(/<AppServiceReceipt>([\s\S]*?)<\/AppServiceReceipt>/i)?.[1];if(!block||block.length>12000)return[];try{const data=JSON.parse(block);return(Array.isArray(data)?data:[data]).filter(x=>x&&typeof x==='object').slice(0,20);}catch{return[];}}
export class AppUpgradeService{
 constructor({readUpgrades=async()=>({}),readResources=async()=>({}),readCharacters=async()=>[],readRequests=async()=>null,writeRequests=async()=>{},commit=null,stage,isWritable=()=>true,canAccessService=()=>true,getRequestContext=()=>null,getCellKey=()=>'',onChange=()=>{}}={}){Object.assign(this,{readUpgrades,readResources,readCharacters,readRequests,writeRequests,commit,stage,isWritable,canAccessService,getRequestContext,getCellKey,onChange});this.state={schema:1,pending:{},settled:[]};this.menu=[];this.candidates=[];this.queue=Promise.resolve();}
 serial(fn){const job=this.queue.then(fn);this.queue=job.catch(()=>{});return job;}
 async init(){const state=await this.readRequests();if(state?.schema===1&&state.pending&&typeof state.pending==='object'&&!Array.isArray(state.pending))this.state={schema:1,pending:clone(state.pending),settled:Array.isArray(state.settled)?state.settled:[]};await this.refresh();return this;}
 async refresh(){this.menu=appServiceMenu(await this.readUpgrades(),await this.readResources());this.candidates=appBenefitCandidates(await this.readCharacters());this.onChange();return this.menu;}
 async quote(serviceId,options={}){return quoteService(serviceId,options,await this.readUpgrades(),await this.readResources(),appBenefitCandidates(await this.readCharacters()));}
 async save(){await this.writeRequests(clone(this.state));}
 async request(serviceId,options={}){return this.serial(async()=>{
  if(!this.isWritable())throw Error('历史记录只能查看');if(!this.canAccessService(serviceId))throw Error('请到双胞胎工作室办理服务');if(typeof this.stage!=='function')throw Error('日程尚未连接');
  const requestContext=clone(this.getRequestContext()),capturedCellKey=String(this.getCellKey()),before=clone(this.state),upgrades=normalizeAppUpgrades(await this.readUpgrades()),rawBalance=await this.readResources(),balance=resources(rawBalance),service=quoteService(serviceId,options,upgrades,rawBalance,appBenefitCandidates(await this.readCharacters()));
  if(!service.available)throw Error(service.reason||'当前无法申请这一服务');
  const token=nonce(),mergeKey='app-service:'+capturedCellKey+':'+serviceId+(serviceId==='energy-cap-benefit'?':'+service.parameters.tier:'');
  for(const old of Object.values(this.state.pending))if(old.mergeKey===mergeKey&&old.status==='staged')old.status='superseded';
  const payload={nonce:token,target:APP_SERVICE_TARGET,serviceId,quantity:1,quoteVersion:APP_SERVICE_QUOTE_VERSION,parameters:clone(service.parameters),price:clone(service.price),baseRevision:upgrades.revision,baseVipRank:balance.vipRank};
  if(requestContext?.location?.id)payload.location={kind:'location',id:String(requestContext.location.id)};
  const receipt={nonce:token,target:APP_SERVICE_TARGET,serviceId,quantity:1,quoteVersion:APP_SERVICE_QUOTE_VERSION,parameters:clone(service.parameters),success:true,price:clone(service.price)};
  const action={id:token,type:'app-service',title:service.name,payload,hiddenPrompt:'这是用户已选择的应用服务请求，尚未扣款、升级或领取。先由双胞胎联络员按实际场景判断能否办理；仅对该请求返回 <AppServiceReceipt>'+JSON.stringify(receipt)+'</AppServiceReceipt>，不能办理时只将success改成false，其余授权字段逐字保持。不要直接修改MC能量、MC能量上限、零花钱、VIP等级或ui/app-upgrades.json；只有该日程成功送出且成功收据核验后，前端权威账户才原子结算。'};
  if(serviceId==='energy-cap-benefit')action.hiddenPrompt+=' 催眠APP幕后组织给予user测试用户福利，希望获得更多测试数据。本档只验证所选槽内人物的实际永久催眠数量，不消耗或移除人物及其催眠，每档只可领取一次；本次免费增加1500 MC上限，不增加当前能量、不扣钱。所选人物：'+service.characters.map(x=>x.name).join('、')+'。';
  if(payload.location)action.hiddenPrompt+=' 本次办理地点固定为payload.location，不把服务改为电话购买或其它地点交易。';
  this.state.pending[token]={...clone(payload),actionId:token,mergeKey,status:'staged'};
  try{await this.save();if(!this.canAccessService(serviceId)||requestContext?.location?.id&&this.getRequestContext()?.location?.id!==requestContext.location.id)throw Error('地点已改变，请在工作室重新选择服务');const result=await this.stage(action,{mergeKey,...(requestContext?{index:requestContext.index,expectedDate:requestContext.date,preserveSelection:true}:{})});if(result?.ok===false)throw Error(result.message||'无法加入日程');}catch(error){this.state=before;await this.save();throw error;}
  return clone(action);
 });}
 async markDispatched(actions){return this.serial(async()=>{let changed=false;for(const action of actions){if(action.type!=='app-service')continue;const p=this.state.pending[action.payload?.nonce];if(!p||p.status!=='staged'||p.actionId!==action.id)continue;const {actionId,mergeKey,status,...authorized}=p;if(same(authorized,action.payload)){p.status='dispatched';changed=true;}}if(changed)await this.save();});}
 async settle(receipt){return this.serial(async()=>{
  const p=this.state.pending[receipt?.nonce];if(!p||p.status!=='dispatched')return{ok:false,reason:'unapproved-or-replayed'};
  if(receipt.target!==APP_SERVICE_TARGET||receipt.serviceId!==p.serviceId||receipt.quantity!==1||typeof receipt.success!=='boolean'||receipt.price?.currency!=='money'||receipt.price.amount!==p.price.amount)return{ok:false,reason:'receipt-mismatch'};
  const rawU=await this.readUpgrades(),u=normalizeAppUpgrades(rawU);
  // Preserve recovery for already-committed legacy receipts, including retired
  // modules. Retired unpaid modules never become a new charge after migration.
  if(u.receipts.includes(receipt.nonce)){p.status='applied';if(!this.state.settled.includes(receipt.nonce))this.state.settled.push(receipt.nonce);await this.save();await this.refresh();return{ok:true,applied:false,recovered:true};}
  // Existing saved requests keep the price schedule they were authorized with.
  // Incoming receipt text cannot downgrade the stored protocol or choose a price.
  const version=p.quoteVersion??1;let parameters=p.parameters;
  if(version===1){
   if(!Number.isInteger(p.baseVipRank)||p.baseVipRank<0||p.baseVipRank>5||!Number.isInteger(p.baseRevision)||p.baseRevision<0)return{ok:false,reason:'stale-quote'};
   if(p.serviceId==='vip-next')parameters={targetRank:p.baseVipRank+1};
   else if(p.serviceId==='energy-refill')parameters={amount:1000};
   else return{ok:false,reason:'stale-quote'};
   if(receipt.quoteVersion!=null||receipt.parameters!=null)return{ok:false,reason:'receipt-mismatch'};
  }else if(![2,APP_SERVICE_QUOTE_VERSION].includes(version))return{ok:false,reason:'stale-quote'};
  else if(receipt.quoteVersion!==version||!same(receipt.parameters,p.parameters))return{ok:false,reason:'receipt-mismatch'};
  if(!receipt.success){p.status='declined';await this.save();return{ok:true,applied:false};}
  if(typeof this.commit!=='function')return{ok:false,reason:'atomic-owner-unavailable'};
  const rawR=await this.readResources(),r=resources(rawR);let service;try{service=quoteService(p.serviceId,parameters,u,rawR,appBenefitCandidates(await this.readCharacters()),version===APP_SERVICE_QUOTE_VERSION?APP_SERVICE_QUOTE_VERSION:2);}catch{return{ok:false,reason:'stale-quote'};}
  if(p.baseRevision>u.revision||(p.serviceId==='vip-next'&&p.baseVipRank!==r.vipRank)||!same(service.price,p.price))return{ok:false,reason:'stale-quote'};
  if(!service.available)return{ok:false,reason:service.reason==='零花钱不足'?'insufficient-funds':p.serviceId==='energy-cap-benefit'&&service.claimed?'already-claimed':'stale-quote'};
  const nextResources={...clone(rawR),...r,money:r.money-p.price.amount},nextUpgrades={...u,revision:u.revision+1,receipts:[...u.receipts,receipt.nonce]};
  switch(p.serviceId){case'vip-next':nextResources.vipRank=parameters.targetRank;break;case'energy-refill':nextResources.energy=r.energy+parameters.amount;break;case'energy-cap-benefit':nextResources.energyCap=r.energyCap+1500;nextUpgrades.capBenefitClaims[p.parameters.tier]={nonce:p.nonce,increase:1500,characters:clone(service.characters)};break;default:return{ok:false,reason:'unknown-service'};}
  const validate=p.serviceId==='energy-cap-benefit'?async()=>{try{benefitSelection(p.parameters.tier,p.parameters.characterIds,appBenefitCandidates(await this.readCharacters()));return true;}catch{return false;}}:null;
  const committed=await this.commit({nonce:receipt.nonce,expectedResources:clone(rawR),expectedUpgrades:clone(rawU),nextResources,nextUpgrades,...(validate?{validate}: {})});
  if(committed!==true&&committed?.ok!==true)return{ok:false,reason:'compare-and-set-failed'};
  p.status='applied';if(!this.state.settled.includes(receipt.nonce))this.state.settled.push(receipt.nonce);await this.save();await this.refresh();return{ok:true,applied:true,serviceId:p.serviceId};
 });}
}
export const createAppUpgradeService=async options=>new AppUpgradeService(options).init();
