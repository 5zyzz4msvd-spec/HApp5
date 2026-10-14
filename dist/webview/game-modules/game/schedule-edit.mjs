const clone=structuredClone;
export async function stageScheduleAction(schedule,action,options={},persist=async()=>{}){
 if(options.expectedDate&&options.expectedDate!==schedule.today.date)throw Error('日程日期已改变，原地点文字保留为草稿');
 const index=options.index??schedule.selected,cell=schedule.today.cells[index],selected=schedule.selected;
 if(!cell)throw Error('请选择有效日程格');
 const bucket=action.type==='hypnosis'?'attachments':'actions',previous=options.mergeKey?cell[bucket].find(item=>item.mergeKey===options.mergeKey):null,before=previous?clone(previous):null;
 if(action.type==='location-note'&&previous&&previous.type!=='location-note')throw Error('这个备注标识已被其它操作使用，原操作未改变');
 const entry=schedule.stage(action,options),attempt=JSON.stringify(entry);if(options.preserveSelection)schedule.selected=selected;
 const selectedAfter=schedule.selected;
 try{await persist();return entry;}catch(error){
  // Revert only this edit. Other user actions/events added during an async file
  // write are not discarded by restoring a whole-day snapshot.
  if(cell[bucket].includes(entry)&&JSON.stringify(entry)===attempt){if(before){for(const key of Object.keys(entry))delete entry[key];Object.assign(entry,before);}else cell[bucket]=cell[bucket].filter(item=>item!==entry);}
  if(schedule.selected===selectedAfter)schedule.selected=selected;
  throw error;
 }
}
export async function removeLocationNote(schedule,mergeKey,{index=schedule.selected,expectedDate=schedule.today.date}={},persist=async()=>{}){
 if(schedule.sending||expectedDate!==schedule.today.date||index<schedule.cursor)throw Error('这段日程不能修改');
 const cell=schedule.today.cells[index];if(!cell||cell.sent)throw Error('这段日程不能修改');
 const removed=cell.actions.map((action,index)=>({action,index})).filter(item=>item.action.type==='location-note'&&item.action.mergeKey===mergeKey);
 cell.actions=cell.actions.filter(action=>!removed.some(item=>item.action===action));
 try{await persist();}catch(error){for(const item of removed)if(!cell.actions.some(action=>action.id===item.action.id))cell.actions.splice(Math.min(item.index,cell.actions.length),0,item.action);throw error;}
}
