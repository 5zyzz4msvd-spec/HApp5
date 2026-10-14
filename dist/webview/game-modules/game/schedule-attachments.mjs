export function hypnosisOutcome(action){
 const result=action?.payload?.resistance??{};
 if(result.required===false)return '待剧情判定';
 const targets=result.targets??[],passed=targets.filter(x=>x.resisted===false||x.defeated===true).length;
 if(passed&&passed<targets.length)return '部分突破，待剧情判定';
 return result.success?'抵抗突破，待剧情判定':'目标抵抗';
}
export function hypnosisAttachmentText(action){return (action?.payload?.resistance?.required===false?'地点催眠':'催眠')+' · '+hypnosisOutcome(action).replace('，待剧情判定','');}
