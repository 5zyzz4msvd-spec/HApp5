import {assetUrl} from '../resources/asset-url.mjs';
import {scoutingAvailable,SCOUTING_COMING_SOON} from './personnel-access.mjs';
import {PAINTED_SCOUTING_CATALOG} from '../game/painted-scouting-catalog.mjs';
import {ordinaryCharacterSource,roleInitialData} from './character-source-metadata.mjs';
export const PAINTED_SCOUTING_NAMES=Object.freeze(PAINTED_SCOUTING_CATALOG.records.map(row=>row.name));
export function createPaintedScoutingProvider({assetBase='/public/frontends/hypnosis-app/assets/',catalog=PAINTED_SCOUTING_CATALOG}={}){
 const file=path=>typeof path==='string'&&path?assetUrl(assetBase,path):null;
 const rows=catalog.records.map(record=>{const role=structuredClone(record.role),assets=role.mediaAssets;Object.assign(role,{imageDataUrl:file(assets.portrait),images:(assets.portraits??[]).map(file),head:file(assets.head),portrait:file(assets.portrait),standee:file(assets.standees[0])});const initial=roleInitialData(role),facts=ordinaryCharacterSource(role,{initialData:initial});return{id:record.id,name:record.name,scoutingAllowed:scoutingAvailable(record),scoutingReason:scoutingAvailable(record)?'':SCOUTING_COMING_SOON,role,initialData:initial,portrait:role.portrait,portraits:role.images,head:role.head,standee:role.standee,information:initial.信息??facts.data.信息,clothing:facts.data.衣着,info:{gender:facts.gender,age:facts.age,identity:facts.identity,height:facts.height},sourceEvidence:structuredClone(record.source),photoSource:record.source.photoSource};});
 const byId=new Map(rows.map(row=>[row.id,row])),byName=new Map(rows.map(row=>[row.name,row]));
 // Each returned definition is detached. Browsing has no runtime/store access.
 return{names:PAINTED_SCOUTING_NAMES,candidates:()=>structuredClone(rows),candidate:id=>{const row=byId.get(id);return row?structuredClone(row):null;},role:name=>{const row=byName.get(name);return row?structuredClone(row.role):null;}};
}
