import { ordinaryCharacterSource,applyCharacterSourceMetadata,roleInitialData } from './character-source-metadata.mjs';
import {ensureCharacterCash} from './character-cash.mjs';
import {ensureCharacterClothing} from './character-clothing.mjs';
import { normalizeCharacter } from "./contracts.mjs";
import { sha256 } from "../workshop/task-package.mjs";
import { prepareRoutineCatalog, installCharacterRoutine } from "./catalog-install.mjs";

// Explicit import of a selected role definition, never of live MVU state.
export async function encounterCharacterDraft(role, { initialData = null } = {}) {
  if (!role || !String(role.name ?? "").trim()) throw new Error("角色文件缺少名称");
  const id = `encounter-${(await sha256(String(role.id ?? role.name))).slice(0, 32)}`;
  const actor = normalizeCharacter({ kind: "character", id, name: role.name, aliases: Array.isArray(role.aliases) ? role.aliases : [], summary: role.intro ?? role.summary ?? "", ui: { source: "encounter-custom", images: [] } });
  for (const [key, source] of Object.entries({ gender: "gender", identity: "identity", appearance: "appearance", personality: "personality", background: "persona", behavior: "behaviorGuidance" })) actor.values[key] = String(role[source] ?? "");
  for (const key of ["age", "height"]) if (Number.isFinite(Number(role[key]))) actor.values[key] = Math.max(0, Number(role[key]));
  if (role.personaEntry?.content || role.persona) actor.worldbook.entries.push({ id: "imported-persona", comment: "[mvu_plot]" + actor.name + "人设", key: [actor.name], constant: false, content: String(role.personaEntry?.content ?? role.persona) });
  const declared=roleInitialData(role,initialData);await applyCharacterSourceMetadata(actor,role,{initialData:declared,initializing:true});await applyCharacterSourceMetadata(actor,role,{initialData:declared,ordinaryOnly:false,initializing:true});
  ensureCharacterCash(actor,{profile:role.cashProfile});ensureCharacterClothing(actor);return normalizeCharacter(actor);
}

export async function appendOriginalFields(actor, initialData) {
  await applyCharacterSourceMetadata(actor,{name:actor.name},{initialData,ordinaryOnly:false});
  return actor;
}

export async function importEncounterCharacter(runtime, source) {
  const role = source?.role ?? source;
  if (!role || typeof role !== "object" || !String(role.name ?? "").trim()) throw new Error("角色文件缺少名称");
  const id = `encounter-${(await sha256(String(role.id ?? role.name))).slice(0, 32)}`;
  const existing = await runtime.store.getObject({ kind: "character", id });
  await prepareRoutineCatalog(runtime);
  if (existing) {const persona=existing.worldbook.entries.find(entry=>entry.id==='imported-persona'),sourcePersona=role.personaEntry?.content??role.persona??role.personaContent;const report=await applyCharacterSourceMetadata(existing,role,{initialData:roleInitialData(role,source.initialData),ordinaryOnly:Boolean(persona?.content&&sourcePersona&&persona.content!==sourcePersona)});if(report.added.length||report.filled.length)await runtime.saveCharacterDefinition(existing);return installCharacterRoutine(runtime,existing);}
  const character = normalizeCharacter({ kind: "character", id, name: role.name, aliases: Array.isArray(role.aliases) ? role.aliases : String(role.aliases ?? "").split(/[,，]/).filter(Boolean), summary: role.intro ?? role.summary ?? "", ui: { template: "phone/profile", source: "encounter-custom", images: [] } });
  for (const [target, keys] of Object.entries({ gender: ["gender"], identity: ["identity"], appearance: ["appearance"], personality: ["personality", "habit"], background: ["socialConnection", "persona"], "first-encounter": ["firstEncounter", "encounterPrompt"], behavior: ["behaviorGuidance"] })) character.values[target] = keys.map((key) => String(role[key] ?? "")).filter(Boolean).join("\n");
  for (const [key, sourceKey] of [["age", "age"], ["height", "height"]]) if (Number.isFinite(Number(role[sourceKey])) && Number(role[sourceKey]) >= 0) character.values[key] = Number(role[sourceKey]);
  if (role.personaEntry?.content) character.worldbook.entries.push({ id: "imported-persona", comment: `[mvu_plot]${character.name}角色设定`, content: String(role.personaEntry.content), constant: true });
  const custom = Array.isArray(role.personaFields) ? role.personaFields : [];
  if (custom.length) {
    character.elements.push({ id: "imported-fields", type: "group", label: "邂逅自定义设定", elements: custom.map((field, index) => ({ id: `custom-persona-${index}`, label: String(field.key ?? field.name ?? "设定"), type: "textarea", audience: "plot" })) });
    custom.forEach((field, index) => { character.values[`custom-persona-${index}`] = String(field.content ?? field.value ?? ""); });
  }
  const declared=roleInitialData(role,source.initialData);await applyCharacterSourceMetadata(character,role,{initialData:declared,initializing:true});await applyCharacterSourceMetadata(character,role,{initialData:declared,ordinaryOnly:false,initializing:true});
  ensureCharacterCash(character,{profile:role.cashProfile});ensureCharacterClothing(character);await runtime.saveCharacterDefinition(character);
  await installCharacterRoutine(runtime, character);
  const images = [...new Set([role.imageDataUrl, ...(Array.isArray(role.images) ? role.images : [])].filter((value) => typeof value === "string" && value.startsWith("data:image/")))];
  for (const [index, url] of images.entries()) {
    const match = url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
    if (!match || match[2].length > 18 * 1024 * 1024) continue;
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    await runtime.addImage(character, new Blob([bytes], { type: match[1] }), { name: `导入图片 ${index + 1}`, usage: index === 0 ? "portrait" : "gallery" });
  }
  return runtime.store.getObject(character);
}
