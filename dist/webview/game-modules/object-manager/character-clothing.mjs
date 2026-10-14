export const CHARACTER_CLOTHING_LABELS=Object.freeze(['头发','面部','上衣','下衣']);
export function ensureCharacterClothing(actor){
  if(actor.kind!=='character'||actor.id==='user')return actor;
  actor.elements??=[];actor.values??={};actor.ui??={};
  let group=actor.elements.find(field=>field.type==='group'&&field.label==='衣着');
  if(!group){group={id:'personnel-clothing',label:'衣着',type:'group',elements:[]};actor.elements.push(group);}
  const fields=group.elements??[];
  const kept=[];
  for(const [index,label]of CHARACTER_CLOTHING_LABELS.entries()){
    const matches=fields.filter(field=>field.label===label&&field.type!=='group'&&!field.binding);
    const field=matches[0]??{id:'personnel-clothing-'+index,label,type:'textarea'};
    field.type=['text','textarea'].includes(field.type)?field.type:'textarea';
    Object.assign(field,{audience:'shared',modelWritable:true,enabled:true});
    actor.values[field.id]=String(actor.values[field.id]??'').trim()||'未记录';
    kept.push(field);
  }
  for(const field of fields.filter(field=>!kept.includes(field))){
    const stored={};function removeValues(node){if(Object.hasOwn(actor.values,node.id)){stored[node.id]=structuredClone(actor.values[node.id]);delete actor.values[node.id];}for(const child of node.elements??[])removeValues(child);}removeValues(field);
    actor.ui.clothingFieldArchive??={};actor.ui.clothingFieldArchive[field.id]??={definition:structuredClone(field),value:structuredClone(stored[field.id]??null),values:stored};
  }
  group.elements=kept;
  return actor;
}
export async function migrateCharacterClothing(runtime){return runtime.personnelTransaction(async()=>{const changed=[];for(const actor of await runtime.store.listObjects('character')){const before=JSON.stringify(actor);ensureCharacterClothing(actor);if(before!==JSON.stringify(actor))changed.push(actor);}if(changed.length)await runtime._writeLocalObjects(changed);return{changed:changed.length};});}
export const CHARACTER_CLOTHING_RULE='人物衣着只使用头发、面部、上衣、下衣四个字段，描述本轮真实外观和穿着。衣物、妆容或发型确实改变时才更新对应字段；不另建鞋袜、饰品或裸身字段。没有穿衣时，上衣和下衣分别描绘上半身与下半身的当前外观，不机械写成“裸体”两个字；头发、面部保留各自当前描述。只更新当前卡槽人物已有的字段，遵守本卡统一内容规则。';
