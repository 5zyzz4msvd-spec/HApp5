import { normalizeCharacter } from "./contracts.mjs";
import { sha256 } from "../workshop/task-package.mjs";
import { BUILTIN_OBJECT_CATALOG } from "./builtin-catalog.mjs";
import { prepareRoutineCatalog, installCharacterRoutine } from "./catalog-install.mjs";

export const DEFAULT_OBJECT_CHARACTERS = Object.freeze(["犬冢夏美", "西园寺爱丽莎", "月咏深雪", "阿宅"]);
export async function seedPhoneObjects(runtime, { characters = DEFAULT_OBJECT_CHARACTERS, rewards = {}, graphs = [], assetLoader = null } = {}) {
  const result = [];
  await prepareRoutineCatalog(runtime);
  const names = ["{{user}}", ...characters];
  for (const name of names) {
    const id = name === "{{user}}" ? "user" : `role-${(await sha256(name)).slice(0, 24)}`;
    let character = await runtime.store.getObject({ kind: "character", id });
    const template = BUILTIN_OBJECT_CATALOG.characters.find((item) => item.object.name === name);
    if (!character) {
      character = template ? structuredClone(template.object) : normalizeCharacter({ kind: "character", id, name, aliases: name === "{{user}}" ? [] : [name], summary: "", ui: { template: "phone/profile", images: [], source: "builtin-object-template" } });
      await runtime.saveCharacterDefinition(character);
      character = await installCharacterRoutine(runtime, character);
      if (template) for (const event of BUILTIN_OBJECT_CATALOG.favorEvents.filter((item) => item.id.startsWith(id + "-favor-"))) await runtime.createChildObject(character, event);
      character = await runtime.store.getObject(character);
      await runtime.loadCharacter(`default-${id}`, id);
    }
    if (template?.image && assetLoader && character.ui.source === "builtin-character-catalog" && !character.ui.catalogImageImported && !character.ui.images.length) {
      try {
        const blob = await assetLoader(template.image.assetPath);
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        if (digest !== template.image.sha256) throw new Error("内置图片 hash 与目录不一致");
        await runtime.addImage(character, blob, { name: template.image.name, usage: "portrait" }); character = await runtime.store.getObject(character);
        character.ui.catalogImageImported = true; delete character.ui.assetWarning; await runtime.saveCharacterDefinition(character);
      } catch (error) { character.ui.assetWarning = error.message; await runtime.saveCharacterDefinition(character); }
    }
    result.push(character);
    for (const [kind, items] of [["achievement", rewards.achievements ?? []], ["task", rewards.quests ?? []]]) {
      for (const item of items) {
        // Existing app quests are player goals (often involving several actors),
        // not four separate reward opportunities. Seed them once under USER.
        const self = kind === "task" || item.scope === "self" || item.scope === "other";
        if ((name === "{{user}}") !== self) continue;
        const childId = `${id}-${item.id}`.slice(0, 127);
        if (await runtime.store.getObject({ kind, id: childId })) continue;
        const parts = item.variableCondition?.parts ?? (item.variableCondition?.path ? [item.variableCondition] : []);
        const explicitOwners = parts.map((part) => String(part.path ?? "").match(/^角色\.([^.*{<]+)\./)?.[1]).filter(Boolean);
        if (!self && explicitOwners.length && !explicitOwners.includes(name)) continue;
        // Old task descriptions are templates, not live paths into another store.
        // Deterministic checks must be re-authored against independent objects.
        await runtime.saveCharacterChild({ kind, id: childId, name: item.title ?? item.id, owner: { kind: "character", id }, definition: { description: item.description ?? item.condition ?? "", completion: { mode: "narrative", text: item.condition ?? item.description ?? "", when: null }, rewards: item.reward ?? {} }, source: { kind: "builtin", templateId: item.id } });
      }
    }
  }
  for (const { scope, graph } of graphs) {
    const rootId = `map-${scope}`;
    const additions = [];
    for (const item of graph?.locations ?? []) {
      if (["secret-god-gazing-box", "schrodinger-greenhouse"].includes(item.id) || item.specialId || item.category === "特殊") continue;
      if (BUILTIN_OBJECT_CATALOG.locations.some((object) => object.data.mapScope === scope && object.data.sourceMapId === item.id) || item.id === "school") continue;
      const id = `place-${(await sha256(`${scope}:${item.id}`)).slice(0, 24)}`;
      if (!await runtime.store.getObject({ kind: "location", id })) additions.push({ kind: "location", id, name: item.label ?? item.name ?? item.id, data: { description: item.info ?? item.description ?? "", category: item.category ?? "", mapScope: scope, mapId: item.id }, children: [], features: [] });
    }
    const root = await runtime.store.getObject({ kind: "location", id: rootId });
    if (root && additions.length) { root.children.push(...additions.map((item) => ({ kind: "location", id: item.id }))); await runtime.saveLocationBatch([root, ...additions]); }
  }
  await runtime.evaluateChildConditions({});
  return result;
}
