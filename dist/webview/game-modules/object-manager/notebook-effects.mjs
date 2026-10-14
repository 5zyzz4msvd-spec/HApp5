import { notebookValueRows } from './notebook-model.mjs';
export function effectEntries(groups){const result={temporary:[],permanent:[],psychology:[]};
  for(const field of groups.flatMap(x=>x.fields??[])){const mode=/永久|长期|持续/.test(field.label)?'permanent':/临时/.test(field.label)?'temporary':'psychology';const source=field.value;if(source&&typeof source==='object'){for(const[key,value]of Object.entries(source)){const title=String(value?.名称??value?.name??value?.标题??key),time=String(value?.结束时间??value?.到期时间??value?.剩余时间??value?.持续时间??value?.持续分钟??value?.duration??'未注明');const details=notebookValueRows({label:'',value}).map(x=>(x.label.trim()?x.label.replace(/^ \/ /,'')+'：':'')+x.value);result[mode].push({title,time,details});}}else if(source&&!/^(未记录|暂无|无)$/.test(String(source)))result[mode].push({title:field.label,time:'未注明',details:[String(source)]});}
  return result;
}
export function designEffectPages(groups,wrap){const entries=effectEntries(groups),pages=[];
  for(const [mode,label]of [['temporary','临时效果'],['permanent','永久效果']])pages.push(...paginateNotebookEntries(entries[mode].map(x=>({...x,status:label,variant:mode,time:mode==='temporary'?x.time:'',progressRatio:null})),{chapter:'效果',wrap,even:false,emptyText:'暂无'+label}));
  if(entries.psychology.length)pages.push(...paginateNotebookEntries(entries.psychology.map(x=>({...x,status:'心理记录',variant:'psychology',time:'',progressRatio:null})),{chapter:'效果',wrap,even:false}));
  if(pages.length%2)pages.push({title:'效果',chapter:'效果',blocks:[],lines:[],emptyText:''});return pages;
}
import { paginateNotebookEntries } from './notebook-collections.mjs';
