import { migrateCharacterSourceMetadata } from './character-metadata-migration.mjs';
import {migrateCharacterCash} from './character-cash.mjs';
import {migrateCharacterClothing} from './character-clothing.mjs';
// Historical authoring counts remain in old saves. They are not evidence for
// new defaults: initialization now restores only maintained source facts.
export const applyPersonnelInitials=async runtime=>{const metadata=await migrateCharacterSourceMetadata(runtime);await migrateCharacterCash(runtime);await migrateCharacterClothing(runtime);return metadata;};
