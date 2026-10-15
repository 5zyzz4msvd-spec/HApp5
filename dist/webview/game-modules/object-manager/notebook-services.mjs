import {scoutingAvailable,SCOUTING_COMING_SOON} from './personnel-access.mjs';
// Notebook views can browse services anywhere; accepting work uses fresh scene access.
export function createNotebookServices({service,getAccess=()=>({writable:true})}){
 return{
  serviceSnapshot:async()=>{const snapshot=await service.snapshot(),access=await getAccess();return{...snapshot,writable:access.writable!==false,accessReason:access.writable===false?access.reason||'当前不能办理委托':''};},
  investigate:id=>submit('investigate',id),scout:id=>submit('scout',id)
 };
 async function submit(kind,id){const access=await getAccess();if(access.writable===false)throw Error(access.reason||'当前不能办理委托');if(kind==='scout'){const row=(await service.snapshot()).candidates?.find(candidate=>candidate.id===id);if(!scoutingAvailable(row)||row.scoutingAllowed===false)throw Error(SCOUTING_COMING_SOON);}return service.start(kind,id);}
}
