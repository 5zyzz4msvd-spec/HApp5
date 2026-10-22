import {normalizeCondition,evaluateCondition} from '../object-manager/conditions.mjs';
const unsafe=new Set(['__proto__','prototype','constructor']);
const ident=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,95}$/i.test(value)&&!unsafe.has(value);
const esc=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
const text=value=>typeof value==='string'&&value.trim()&&!unsafe.has(value);
function refs(value,label){if(value===undefined)return[];if(!Array.isArray(value)||value.some(x=>!ident(x)))throw Error(label+'须为事件ID列表');return[...new Set(value)];}
export function eventCondition(raw,depth=0){
 if(depth>16)throw Error('事件条件嵌套超过16层');
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('事件须有明确条件');
 if(['all','any','not'].some(k=>Object.hasOwn(raw,k))){const key=Object.hasOwn(raw,'all')?'all':Object.hasOwn(raw,'any')?'any':'not';if(Object.keys(raw).length!==1)throw Error('条件组不能混写');if(key!=='not'&&(!Array.isArray(raw[key])||!raw[key].length||raw[key].length>64))throw Error('条件组须为1至64项');return normalizeCondition(key==='not'?{not:eventCondition(raw.not,depth+1)}:{[key]:raw[key].map(x=>eventCondition(x,depth+1))});}
 if(['gt','gte','lt','lte'].includes(raw.op)&&(!Number.isFinite(raw.value)||typeof raw.value!=='number'))throw Error('数值阈值须为有限数值');
 if(raw.op==='exists'&&Object.hasOwn(raw,'value')&&typeof raw.value!=='boolean')throw Error('exists须使用布尔值');
 if(Object.hasOwn(raw,'event')){if(!ident(raw.event)||Object.keys(raw).some(k=>!['event','state'].includes(k))||!['completed','not-completed'].includes(raw.state??'completed'))throw Error('前置事件条件无效');return normalizeCondition({path:'/completed/'+esc(raw.event),op:'exists',value:raw.state!=='not-completed'});}
 if(Object.hasOwn(raw,'characterId')){
  if(!text(raw.characterId)||Object.keys(raw).some(k=>!['characterId','field','attribute','measure','op','value'].includes(k))||Boolean(raw.field)===Boolean(raw.attribute)||raw.measure!==undefined&&raw.measure!=='count')throw Error('人物条件须指定稳定ID与唯一字段');
  const suffix=raw.field?'/'+esc(raw.field):String(raw.attribute);if(!suffix.startsWith('/'))throw Error('人物属性使用JSON Pointer');
  return normalizeCondition({path:'/actors/'+esc(raw.characterId)+'/'+(raw.measure==='count'?'counts/':'')+(raw.field?'values':'attributes')+(raw.measure==='count'&&!raw.field?'/'+esc(raw.attribute):suffix),op:raw.op,...(Object.hasOwn(raw,'value')?{value:raw.value}:{})});
 }
 return normalizeCondition(raw);
}
export function normalizeStoryEvent(raw){
 const d=structuredClone(raw);if(!d||!ident(d.id)||!text(d.name))throw Error('事件须有稳定ID与名称');
 if(Object.keys(d).some(k=>!['id','name','ownerNames','owners','priority','when','requires','excludes','branch','enabled','hiddenPrompt','effects'].includes(k)))throw Error('未知事件配置字段：'+d.id);
 d.ownerNames??=[];d.owners??=[];
 if(!Array.isArray(d.ownerNames)||d.ownerNames.some(x=>!text(x))||!Array.isArray(d.owners)||d.owners.some(x=>x?.kind!=='character'||!text(x.id)||Object.keys(x).some(k=>!['kind','id'].includes(k)))||!d.ownerNames.length&&!d.owners.length)throw Error('事件须归属玩家或一个以上人物');
 if(d.enabled!==undefined&&typeof d.enabled!=='boolean')throw Error('enabled须为布尔值');
 d.enabled??=true;d.priority??=100;if(!Number.isSafeInteger(d.priority))throw Error('事件优先级须为整数');
 d.when=eventCondition(d.when);d.requires=refs(d.requires,'前置事件');d.excludes=refs(d.excludes,'互斥事件');
 if(d.branch&&(!ident(d.branch.group)||!ident(d.branch.option)||Object.keys(d.branch).some(k=>!['group','option'].includes(k))))throw Error('事件分支须指定group和option');
 d.hiddenPrompt??='';if(typeof d.hiddenPrompt!=='string'||d.hiddenPrompt.length>2400)throw Error('事件提示词须为不超过2400字的文本');
 d.effects??={};if(!d.effects||typeof d.effects!=='object'||Array.isArray(d.effects)||Object.keys(d.effects).some(k=>!['characters','flags','items','unlocks'].includes(k)))throw Error('未知事件结果字段');
 d.effects.characters??=[];d.effects.flags??={};d.effects.items??=[];d.effects.unlocks??=[];
 if(!Array.isArray(d.effects.characters)||d.effects.characters.some(x=>!text(x))||!Array.isArray(d.effects.items)||!Array.isArray(d.effects.unlocks)||!d.effects.flags||typeof d.effects.flags!=='object'||Array.isArray(d.effects.flags))throw Error('事件结果格式无效');
 for(const item of d.effects.items)if(!text(item?.name)||!Number.isSafeInteger(item.quantity)||item.quantity<1||typeof(item.description??'')!=='string')throw Error('事件物品数量无效');
 for(const key of [...Object.keys(d.effects.flags),...d.effects.unlocks])if(!ident(key))throw Error('事件解锁标识无效');
 for(const v of Object.values(d.effects.flags))if(!['boolean','number','string'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))throw Error('事件标记只能是有限数值、布尔值或文本');
 return d;
}
function conditionReferences(c){if(c.all||c.any)return(c.all??c.any).flatMap(conditionReferences);if(c.not)return conditionReferences(c.not);const m=c.path?.match(/^\/completed\/([^/]+)$/);return m?[m[1].replaceAll('~1','/').replaceAll('~0','~')]:[];}
function conditionDependencies(c,positive=true){
 if(c.all||c.any){const groups=(c.all??c.any).map(x=>conditionDependencies(x,positive)),every=Boolean(c.all)===positive;return every?groups.flat():groups[0].filter(id=>groups.every(g=>g.includes(id)));}
 if(c.not)return conditionDependencies(c.not,!positive);
 const m=c.path?.match(/^\/completed\/([^/]+)$/),required=(c.op==='exists'&&c.value!==false)||(c.op==='eq'&&c.value===true);
 const negatedRequired=(c.op==='exists'&&c.value===false)||(c.op==='ne'&&c.value===true);
 return m&&(positive?required:negatedRequired)?[m[1].replaceAll('~1','/').replaceAll('~0','~')]:[];
}
export function validateStoryEvents(raw){
 if(!Array.isArray(raw)||raw.length>1000)throw Error('事件目录须为至多1000项的数组');
 const rows=raw.map(normalizeStoryEvent),byId=new Map();for(const d of rows){if(byId.has(d.id))throw Error('事件ID重复：'+d.id);byId.set(d.id,d);}
 const dependencies=new Map();
 for(const d of rows){const deps=[...new Set([...d.requires,...conditionDependencies(d.when)])];for(const id of [...deps,...conditionReferences(d.when),...d.excludes]){if(!byId.has(id))throw Error(d.id+'引用不存在事件：'+id);if(id===d.id)throw Error('事件不能引用自身：'+id);}if(deps.some(id=>d.excludes.includes(id)))throw Error('前置事件不能同时互斥：'+d.id);for(const id of deps){const parent=byId.get(id);if(d.branch&&parent.branch?.group===d.branch.group&&parent.branch.option!==d.branch.option)throw Error('前置事件位于互斥分支：'+d.id);}dependencies.set(d.id,deps);}
 const active=new Set(),done=new Set();function visit(id){if(active.has(id))throw Error('事件链存在循环：'+id);if(done.has(id))return;active.add(id);for(const next of dependencies.get(id))visit(next);active.delete(id);done.add(id);}for(const id of byId.keys())visit(id);
 return rows.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
}
export function eventConflict(a,b){return a.id!==b.id&&(a.excludes.includes(b.id)||b.excludes.includes(a.id)||Boolean(a.branch&&b.branch&&a.branch.group===b.branch.group&&a.branch.option!==b.branch.option));}
export function eventAvailability(d,{facts,state,chosen=[],catalog=[]}){
 if(!d.enabled)return{eligible:false,reason:'disabled'};
 if(Object.hasOwn(state.completed??{},d.id))return{eligible:false,reason:'completed'};
 if(d.requires.some(id=>!Object.hasOwn(state.completed??{},id)))return{eligible:false,reason:'prerequisite'};
 if(d.branch&&state.branches?.[d.branch.group]?.option&&state.branches[d.branch.group].option!==d.branch.option)return{eligible:false,reason:'branch'};
 const committed=catalog.filter(x=>Object.hasOwn(state.completed??{},x.id));
 if([...committed,...chosen].some(x=>eventConflict(d,x)))return{eligible:false,reason:'exclusive'};
 return evaluateCondition(d.when,facts)?{eligible:true,reason:'ready'}:{eligible:false,reason:'condition'};
}
