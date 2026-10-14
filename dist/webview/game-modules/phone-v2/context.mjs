import {contentPolicyEvidence} from '../safety/character-content-policy-client.mjs';
import {characterDemographics} from '../object-manager/character-source-metadata.mjs';
import { locationForest } from '../object-manager/locations.mjs';
import { actorsAtScene } from '../object-manager/scene-presence.mjs';
import {personnelPermissions} from '../object-manager/personnel-permissions.mjs';

function publicValue(actor,label,fallback='') {
  let id;
  const visit=elements=>{for(const element of elements??[]){if(element.label===label)id=element.id;if(element.elements)visit(element.elements);}};
  visit(actor.elements);
  return actor.values?.[id]??fallback;
}
export function phoneSnapshotFromScene(scene,{time='',date='',year=2026,energy=0,vipRank=0,writable=true,confirmedNames=[],photos={},history=[],assetBase='',chatId='',investigatedIds=[]}={}) {
  const available=actorsAtScene(scene),presence=new Map(available.map(x=>[x.id,x]));
  const confirmed=new Set(confirmedNames);
  const isConfirmed=actor=>[actor.name,actor.id,...(actor.aliases??[])].some(name=>confirmed.has(name));
  const people=(scene.characters??[]).filter(x=>x.id!=='user').map(actor=>({
    id:actor.id,name:actor.name,head:actor.headUrl??'',hypnosisEligible:personnelPermissions(actor).hypnosis,combatValues:{affection:publicValue(actor,'好感度',0),vigilance:publicValue(actor,'警戒度',0),obedience:publicValue(actor,'服从度',0),desire:publicValue(actor,'性欲',0),pleasure:publicValue(actor,'快感值',0),sensitivity:(()=>{const values=[];const visit=rows=>{for(const x of rows??[]){if(x.label?.endsWith('敏感度'))values.push(Number(actor.values?.[x.id]??100));visit(x.elements);}};visit(actor.elements);return values.length?values.reduce((a,b)=>a+b,0)/values.length:100;})()},objectRef:{kind:'character',id:actor.id},
    gender:characterDemographics(actor).gender,
    contentPolicyEvidence:contentPolicyEvidence(actor),
    unlocked:investigatedIds.includes(actor.id),
    age:investigatedIds.includes(actor.id)?actor.values?.age??publicValue(actor,'年龄',publicValue(actor,'_年龄','')):'',
    identity:investigatedIds.includes(actor.id)?String(actor.values?.identity??publicValue(actor,'社团或职业','')):'',
    present:!scene.overrides?.[actor.id]?.absent&&!scene.overrides?.[actor.id]?.possessed&&!(actor.name==='弥留子'&&actor.values?.possessed===true)&&(presence.has(actor.id)||isConfirmed(actor)),activity:presence.get(actor.id)?.activity??(isConfirmed(actor)?'此刻在这里':''),photo:photos[actor.name]??actor.headUrl??'',mounted:actor.mounted===true
  }));
  const forest=locationForest(scene.locations??[]),path=forest.nodes.get(scene.location?.id)?.path??[];
  return {chatId,people,locationAncestors:path.slice(0,-1).reverse().map(ref=>({id:ref.id,name:forest.nodes.get(ref.id).object.name})),locations:(scene.locations??[]).map(x=>({id:x.id,name:x.name,description:x.data?.description??'',image:assetBase&&x.data?.sourceMapId==='classroom'?assetBase+'scene-presence/backgrounds/classroom.png':assetBase&&x.ui?.sceneBackground?assetBase+x.ui.sceneBackground:'',objectRef:{kind:'location',id:x.id}})),location:scene.location?{id:scene.location.id,name:scene.location.name,objectRef:{kind:'location',id:scene.location.id}}:null,time:time||scene.time||'',date,year,energy,vipRank,writable,history,contextKey:[chatId,date,time||scene.time,scene.location?.id].join('|')};
}
