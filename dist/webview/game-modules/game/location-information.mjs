import {locationForest} from '../object-manager/locations.mjs';
import {LOCATION_HYPNOSIS_FIELD_ID,locationHypnosisActiveRows} from '../object-manager/location-hypnosis.mjs';
import {HYPNOSIS_COMMANDS} from '../phone-v2/hypnosis-catalog.mjs';
export function navigationCategory(place){
  if(place.id==='map-school')return '校园';
  if(['lin-an-office','twins-workshop'].includes(place.id)||['lin-an-office','twins-workshop'].includes(place.data?.routineKey))return '服务';
  if(place.data?.category==='住宅')return '住宅';
  const text=String(place.name??'');
  if(/医院|诊室|护士站|手术|警视厅|公园/.test(text))return '公共设施';
  if(/公司|企业|工作室|商店|便利店|美容|护理|商业街/.test(text))return '商业';
  if(/咖啡|茶室|餐|饮食/.test(text))return '饮食';
  if(['map-school','place-teaching-building'].includes(place.id)||place.data?.sourceLayer==='campus')return place.data?.category||'校园';
  return ({公共:'公共设施',办公:'商业',日常:'生活',学校:'校园',医疗:'公共设施',商业:'商业'}[place.data?.category]??place.data?.category)||'其它';
}
export function locationCategories(places){const counts=new Map();for(const place of places){const category=navigationCategory(place);counts.set(category,(counts.get(category)??0)+1);}return [...counts].map(([name,count])=>({name,count}));}
export function locationHypnosisInformation(selected,locations,{date='',time=''}={}){
  const now=/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time)?Date.parse(date+'T'+time+':00Z'):NaN;
  const forest=locationForest(locations),path=forest.nodes.get(selected.id)?.path??[{kind:'location',id:selected.id}],index=new Map(locations.map(place=>[place.id,place])),rows=[];
  for(const ref of path){const place=index.get(ref.id);if(!place)continue;const inherited=place.id!==selected.id;
    const record=inherited?(Number.isFinite(now)?locationHypnosisActiveRows(place,new Date(now)):[]):Object.values(place.values?.[LOCATION_HYPNOSIS_FIELD_ID]??{});
    for(const row of record){if(!row||typeof row!=='object'||row.owner?.id&&row.owner.id!==place.id)continue;
      let status={pending:'待剧情判定',failed:'失败',active:'生效中'}[row.status]??'已记录';
      if(row.status==='active'){if(!Number.isFinite(now))status='时钟未就绪';else if(row.endTime&&now>=Date.parse(row.endTime))status='已到期';else if(row.startTime&&now<Date.parse(row.startTime))status='待生效';}
      rows.push({id:String(row.requestId??rows.length),title:HYPNOSIS_COMMANDS.find(command=>command.id===row.commandId)?.title??'地点催眠',status,inherited,source:place.name,effect:String(row.effect??''),reason:String(row.reason??''),startTime:String(row.startTime??''),endTime:String(row.endTime??''),permanent:row.lifetime==='permanent'});
    }
  }
  return rows;
}
