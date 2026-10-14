export const LIN_AN_PERMISSION_CARD_NAME='读心术者的匿名国王游戏';
export const UNKNOWN_PERSONNEL_PERMISSIONS=Object.freeze({status:'unknown',linAnUnlocked:false});
function identities(actor){return [actor?.id,actor?.objectRef?.id,actor?.name];}
export function isTwinPersonnel(actor){return identities(actor).some(x=>['oda-nobunaga','akechi-mitsuhide','织田信长','明智光秀','织田信长 & 明智光秀','织田信长&明智光秀','织田信长＆明智光秀','织田信长与明智光秀'].includes(x));}
export function isLinAnPersonnel(actor){return identities(actor).some(x=>x==='lin-an'||x==='林安');}
export function personnelPermissions(actor,state=UNKNOWN_PERSONNEL_PERMISSIONS){
  if(isTwinPersonnel(actor))return {hypnosis:false,investigation:false,slot:false,reason:'双胞胎不可催眠、调查或加入人物卡槽'};
  if(isLinAnPersonnel(actor)){const allowed=state?.status==='ready'&&state.linAnUnlocked===true;return {hypnosis:false,investigation:allowed,slot:allowed,reason:allowed?'':'林安的调查与人物卡槽权限尚未开放'};}
  return {hypnosis:true,investigation:true,slot:true,reason:''};
}

// Read only the native host character inventory. Names of folders, chats,
// worldbooks, selected titles and actor values are never entitlement evidence.
export async function readHostPersonnelPermissions(start=globalThis){
  const views=[];for(const key of ['self','parent','top'])try{const view=key==='self'?start:start?.[key];if(view&&!views.includes(view))views.push(view);}catch{}
  for(const view of views)try{
    if(view.__ST_LOCAL_PREVIEW__||typeof view.SillyTavern?.getContext!=='function')continue;
    const context=await view.SillyTavern.getContext();
    if(!Array.isArray(context?.characters))return {...UNKNOWN_PERSONNEL_PERMISSIONS};
    return {status:'ready',linAnUnlocked:context.characters.some(card=>typeof card?.name==='string'&&card.name.includes(LIN_AN_PERMISSION_CARD_NAME))};
  }catch{return {...UNKNOWN_PERSONNEL_PERMISSIONS};}
  return {...UNKNOWN_PERSONNEL_PERMISSIONS};
}
