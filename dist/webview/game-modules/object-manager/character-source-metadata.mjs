import {contentPolicyDemographics,contentPolicyParseAge,contentPolicySourceRestorationAllowed,contentPolicyContainsSexualText} from '../safety/character-content-policy-client.mjs';
import { flattenElements,validateElementValue } from './structure-schema.mjs';
import { sha256 } from '../workshop/task-package.mjs';
const clone=structuredClone;
const ordinaryInfo=new Set(['姓名','性别','年龄','_年龄','身高','体重','社团或职业','身份','职业','绰号','绰号已认可']);
const ordinaryClothes=new Set(['头发','面部','上衣','下衣']);
const sexualText={test:contentPolicyContainsSexualText};
export function sourceNumber(raw,{age=false}={}){if(age)return contentPolicyParseAge(raw);const match=String(raw??'').trim().match(/^(\d+(?:\.\d+)?)(?:\s*(?:cm|厘米))?$/i);if(!match)return null;const value=Number(match[1]);return Number.isFinite(value)&&value>0?value:null;}
function fieldValue(actor,path,label){const rows=flattenElements(actor?.elements??[]),id=actor?.ui?.sourceFieldPaths?.[path];if(id&&Object.hasOwn(actor.values??{},id))return actor.values[id];const field=rows.find(row=>row.type!=='group'&&(Array.isArray(label)?label:[label]).includes(row.label));return field?actor.values?.[field.id]:undefined;}
export function characterDemographics(actor){const demographics=contentPolicyDemographics(actor),height=[actor?.values?.height,actor?.height,fieldValue(actor,'信息.身高','身高')].map(value=>sourceNumber(value)).find(value=>value!==null)??null;return{...demographics,height};}
export function roleInitialData(role,provided=null){const raw=provided??role?.initialVariables??role?.initial??{};return raw?.[role?.name]&&typeof raw[role.name]==='object'?raw[role.name]:raw;}
// Extract only ordinary facts, never infer age, gender or centimetres from prose.
export function ordinaryCharacterSource(role,{initialData=null}={}){
 const raw=roleInitialData(role,initialData),info=raw.信息??{},data={信息:{},衣着:{}};
 for(const [key,value]of Object.entries(info))if(ordinaryInfo.has(key)&&value!=null&&(!sexualText.test(String(value))))data.信息[key]=clone(value);
 const fallback={姓名:role?.name,性别:role?.gender,_年龄:role?.age,身高:role?.height,社团或职业:role?.identity};
 for(const [key,value]of Object.entries(fallback))if(!Object.hasOwn(data.信息,key)&&value!==undefined&&value!==null&&String(value).trim()&&!sexualText.test(String(value)))data.信息[key]=clone(value);
 for(const [key,value]of Object.entries(raw.衣着??{}))if(ordinaryClothes.has(key)&&value!=null&&!sexualText.test(String(value)))data.衣着[key]=clone(value);
 for(const group of ['状态','效果']){const allowed=group==='状态'?['好感度','警戒度','服从度']:['心理','临时催眠效果','永久催眠效果'];const rows=Object.fromEntries(allowed.filter(key=>Object.hasOwn(raw[group]??{},key)).map(key=>[key,clone(raw[group][key])]));if(Object.keys(rows).length)data[group]=rows;}
 const appearance=Object.entries(data.衣着).map(([label,value])=>label+'：'+value).join('\n');
 return{data,gender:String(data.信息.性别??'').trim(),age:sourceNumber(data.信息._年龄??data.信息.年龄,{age:true}),height:sourceNumber(data.信息.身高),identity:String(data.信息.社团或职业??data.信息.身份??data.信息.职业??''),appearance:appearance||(!sexualText.test(String(role?.appearance??''))?String(role?.appearance??''):''),withheld:Object.keys(info).filter(key=>!ordinaryInfo.has(key)),heightDescription:String(info.身高??role?.height??'')};
}
export function safeOriginalInitialData(actor,initialData){
 const ordinary=ordinaryCharacterSource({name:actor.name,gender:actor.values?.gender,age:actor.values?.age},{initialData}).data;
 const current=characterDemographics(actor),gender=current.gender;
 if(contentPolicySourceRestorationAllowed(actor,initialData)){
  const numeric=value=>typeof value==='number'||value==='未记录'||typeof value==='string'&&sourceNumber(value)!==null;
  if(gender==='男'){for(const [label,value]of Object.entries(initialData?.信息??{}))if(label==='阴茎长度'&&numeric(value))ordinary.信息[label]=clone(value);}
  else{const value=initialData?.信息?.三围;if(numeric(value)||typeof value==='string'&&/^(?:B\d+(?:\.\d+)?\/W\d+(?:\.\d+)?\/H\d+(?:\.\d+)?|\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?)(?:cm)?$/i.test(value.trim()))ordinary.信息.三围=clone(value);}
  const sensitivity=gender==='男'?/^(阴茎|龟头|前列腺|尿道|乳头)(敏感度|高潮次数)$/:/^(阴蒂|小穴|菊穴|尿道|乳头)(敏感度|高潮次数)$/;
  for(const [label,value]of Object.entries(initialData?.敏感??{}))if(sensitivity.test(label)&&numeric(value)){ordinary.敏感??={};ordinary.敏感[label]=clone(value);}
  for(const [label,value]of Object.entries(initialData?.状态??{}))if(['性欲','快感值'].includes(label)&&numeric(value)){ordinary.状态??={};ordinary.状态[label]=clone(value);}
 }
 return ordinary;
}
const mapped={'信息.性别':'gender','信息._年龄':'age','信息.年龄':'age','信息.身高':'height','信息.社团或职业':'identity','状态.好感度':'affinity','状态.警戒度':'alertness','状态.服从度':'cooperation'};
const missing=(value,id)=>value===undefined||value===null||value===''||value==='未记录'||['age','height'].includes(id)&&value===0;
export async function applyCharacterSourceMetadata(actor,role,{initialData=null,ordinaryOnly=true,initializing=false}={}){
 const original=ordinaryCharacterSource(role,{initialData}),raw=ordinaryOnly?original.data:safeOriginalInitialData(actor,roleInitialData(role,initialData)),report={added:[],filled:[],preserved:[],conflicts:[]};actor.ui??={};actor.ui.sourceFieldPaths??={};actor.values??={};
 const all=()=>flattenElements(actor.elements??[]),known=new Map(all().map(x=>[x.id,x]));
 async function addGroup(label,data,parent=actor.elements,path=[]){const sourceGroupLabel=label;if(!data||typeof data!=='object'||Array.isArray(data))return;let group=parent.find(row=>row.type==='group'&&(Array.isArray(label)?label:[label]).includes(row.label));if(!group){const id='metadata-'+(await sha256([...path,label].join('.'))).slice(0,22),existing=known.get(id);if(existing){if(existing.type!=='group'){report.conflicts.push([...path,label].join('.'));return;}group=existing;}else{group={id,label,type:'group',elements:[]};parent.push(group);known.set(id,group);report.added.push(id);}}for(const [label,value]of Object.entries(data)){const current=[...path,sourceGroupLabel,label],sourcePath=current.join('.');let id=actor.ui.sourceFieldPaths[sourcePath]??mapped[sourcePath]??'source-'+(await sha256(sourcePath)).slice(0,24),converted=value;
   if(['age','height'].includes(id)){converted=sourceNumber(value,{age:id==='age'});if(converted===null){if(id==='height'&&String(value??'').trim()){id='source-'+(await sha256(sourcePath+'描述')).slice(0,24);converted=String(value);}else continue;}}
   let field=known.get(id);if(!field){const existing=group.elements.find(row=>row.type!=='group'&&(Array.isArray(label)?label:[label]).includes(row.label));if(existing){field=existing;id=existing.id;}}
   if(field?.type==='group'||field?.binding)continue;
   if(!field){const type=Array.isArray(converted)?'list':converted&&typeof converted==='object'?'record':typeof converted==='number'?'number':typeof converted==='boolean'?'boolean':'textarea';field={id,label:id.startsWith('source-')&&mapped[sourcePath]==='height'?'身高描述':label.replace(/^_/,''),type,audience:['信息','衣着'].includes(group.label)?'plot':'shared',modelWritable:!label.startsWith('_')&&sourcePath!=='信息.姓名',...(type==='number'?{min:Math.min(0,converted)}:{})};group.elements.push(field);known.set(id,field);report.added.push(id);}
   if(initializing&&label.startsWith('_'))field.modelWritable=false;
   if(id!=='age'&&id!=='height'||typeof converted==='number')actor.ui.sourceFieldPaths[sourcePath]=id;
   if(missing(actor.values[id],id)||initializing&&['affinity','alertness','cooperation'].includes(id)){try{if(initializing&&['affinity','alertness','cooperation'].includes(id)&&field.type==='number'){field.min=Math.min(-200,converted);field.max=Math.max(200,converted);}validateElementValue(field,converted);if(!Object.hasOwn(actor.values,id)||JSON.stringify(actor.values[id])!==JSON.stringify(converted)){actor.values[id]=clone(converted);report.filled.push(id);}}catch{report.conflicts.push(sourcePath);}}
   else{report.preserved.push(id);if(['gender','age','height','identity'].includes(id)&&String(actor.values[id])!==String(converted))report.conflicts.push(sourcePath);}
  }}
 for(const [group,data]of Object.entries(raw))await addGroup(group,data);
 if(missing(actor.values.appearance,'appearance')&&original.appearance&&known.has('appearance')){actor.values.appearance=original.appearance;report.filled.push('appearance');}
 actor.ui.ordinarySourceMetadata={schema:1,gender:original.gender||null,age:original.age,height:original.height,sourceRoleId:role?.id??null};
 return report;
}
