export const LEGACY_AFFINITY_ARCHIVE='archives/personnel-affinity-v1.json';
function manual(row){return row?.manual===true||row?.authoredByUser===true||row?.source&&row.source!=='personnel-affinity';}
function automaticHistory(key,row){return !manual(row)&&row&&key===`${row.characterId}:${row.id}`&&['scheduled','occurred'].includes(row.status)&&row.slotId&&row.date&&row.start&&row.end;}

export async function retireLegacyAffinity(runtime){
  if((await runtime.store.readJson(LEGACY_AFFINITY_ARCHIVE,null))?.completed)return;
  const store=runtime.store, definitions=await store.readJson('services/affinity-definitions.json',{schema:1,characters:{}}), history=await store.readJson('services/affinity-history.json',{}), prompts=await store.readJson('prompts/personnel.json',[]), dates=await store.readJson('services/date-routines.json',{});
  const retiredKeys=new Set(Object.entries(history).filter(([key,row])=>automaticHistory(key,row)).map(([key])=>key));
  // Rows lost from history can still be identified by the service's exact
  // eventId/id pair. A user/manual source always protects the record.
  for(const actors of Object.values(dates))for(const rows of Object.values(actors??{}))for(const row of rows??[])if(!manual(row)&&typeof row.eventId==='string'&&row.eventId.includes(':')&&row.id==='affinity-'+row.eventId.slice(row.eventId.indexOf(':')+1))retiredKeys.add(row.eventId);
  const keepHistory=Object.fromEntries(Object.entries(history).filter(([key,row])=>!retiredKeys.has(key)||manual(row)));
  const keepPrompts=prompts.filter(row=>!(row.kind==='affinity'&&!manual(row)&&retiredKeys.has(row.eventKey)&&row.id==='affinity:'+row.eventKey));
  const keepDates=structuredClone(dates);
  for(const [date,actors]of Object.entries(keepDates))for(const [id,rows]of Object.entries(actors??{})){actors[id]=rows.filter(row=>!(!manual(row)&&retiredKeys.has(row.eventId)&&row.id==='affinity-'+row.eventId.slice(row.eventId.indexOf(':')+1)));if(!actors[id].length)delete actors[id];if(!Object.keys(actors).length)delete keepDates[date];}
  const emptyDefinitions={...definitions,characters:Object.fromEntries(Object.keys(definitions.characters??{}).map(name=>[name,[]]))};
  await store.applyFileBatch(new Map([
    [LEGACY_AFFINITY_ARCHIVE,{schema:1,completed:true,retiredKeys:[...retiredKeys],files:{'services/affinity-definitions.json':definitions,'services/affinity-history.json':history,'prompts/personnel.json':prompts,'services/date-routines.json':dates},reason:'旧自动好感事件已停用；原始定义、历史与预约可恢复。'}],
    ['services/affinity-definitions.json',emptyDefinitions],['services/affinity-history.json',keepHistory],['prompts/personnel.json',keepPrompts],['services/date-routines.json',keepDates],
  ]));
}
