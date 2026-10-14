export const INITIAL_KNOWN_PERSONNEL = Object.freeze(['西园寺爱丽莎','月咏深雪','犬冢夏美','阿宅','林安','织田信长 & 明智光秀']);
export const SCOUT_REQUIRED_PERSONNEL = Object.freeze(['千杀百花','中村樱','白枢暗子']);
export function initiallyKnown(actor) {
  return INITIAL_KNOWN_PERSONNEL.includes(actor.name) || actor.id==='lin-an' || actor.id==='oda-nobunaga' ||
    ['织田信长&明智光秀','织田信长＆明智光秀','织田信长与明智光秀'].includes(actor.name);
}
export function scoutingRequired(actor) {
  if(initiallyKnown(actor))return false;
  if(SCOUT_REQUIRED_PERSONNEL.includes(actor.name))return true;
  if(actor.ui?.appearanceConfirmed===true||actor.ui?.sourceType==='story-side')return false;
  return ['encounter-custom','encounter-role'].includes(actor.ui?.source);
}
export function scoutingCandidateEligible(candidate){return !initiallyKnown(candidate)&&candidate.ui?.sourceType!=='story-side'&&candidate.ui?.appearanceConfirmed!==true;}
export function acquisitionState(actor) {
  if(initiallyKnown(actor)||!scoutingRequired(actor)&&actor.ui?.appearanceConfirmed===true)return 'scouted';
  if (actor.ui?.scoutingPending) return 'scouting';
  if(scoutingRequired(actor))return actor.ui?.scoutCompleted===true||actor.ui?.residenceUnlocked===true?'scouted':'unscouted';
  if(actor.ui?.sourceType==='story-side'&&!actor.ui.scoutCompleted&&!actor.ui.residenceUnlocked)return 'unscouted';
  return ['unscouted','scouting','scouted'].includes(actor.ui?.acquisitionState) ? actor.ui.acquisitionState : 'scouted';
}
export function personnelLocationEligible(actor) {
  return initiallyKnown(actor) || scoutingRequired(actor) && acquisitionState(actor)==='scouted' ||
    !scoutingRequired(actor) && (actor.ui?.appearanceConfirmed===true || actor.ui?.scoutCompleted===true || actor.ui?.residenceUnlocked===true || actor.ui?.sourceType!=='story-side'&&actor.ui?.acquisitionState==='scouted');
}
export function notebookEligible(actor) { return acquisitionState(actor) !== 'unscouted'; }
export function slotEligible(actor) { return acquisitionState(actor) === 'scouted'; }
