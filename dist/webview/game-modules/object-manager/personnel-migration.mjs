import { BUILTIN_OBJECT_CATALOG } from './builtin-catalog.mjs';
import { applyCharacterSourceMetadata } from './character-source-metadata.mjs';
// A live legacy role is evidence for ordinary missing facts, never permission
// to fill a minor's anatomy/history or overwrite already supplied values.
export async function migratePersonnelSourceFields(runtime,legacyRoles){
 if(!legacyRoles||typeof legacyRoles!=='object')return{migrated:0};
 return runtime.personnelTransaction(async()=>{const done=await runtime.store.readJson('migrations/personnel-source-fields.json',{}),changed=[];let migrated=0;for(const template of BUILTIN_OBJECT_CATALOG.characters){const actor=await runtime.store.getObject(template.object),legacy=legacyRoles[template.object.name];if(!actor||!legacy||done[actor.id]?.ordinaryOnlyV2)continue;const report=await applyCharacterSourceMetadata(actor,{name:actor.name},{initialData:legacy,ordinaryOnly:true});done[actor.id]={completed:true,ordinaryOnlyV2:true,imported:report.filled,preserved:report.preserved,invalid:report.conflicts};migrated+=report.filled.length;changed.push(actor);}if(changed.length)await runtime._writeLocalObjects(changed,new Map([['migrations/personnel-source-fields.json',done]]));return{migrated};});
}
