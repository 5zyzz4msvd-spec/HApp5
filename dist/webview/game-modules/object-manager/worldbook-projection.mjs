import {contentPolicyContextApplicable} from '../safety/character-content-policy-client.mjs';
import { cloneValue, normalizeCharacter, normalizeObject, normalizeRef, parseCommentRoute, refKey } from "./contracts.mjs";
import { evaluateCondition } from "./conditions.mjs";
import { worldbookImplicitFields, worldbookRecursion, worldbookEffect } from "./worldbook-policy.mjs";
import { activeTaskModelEntry } from "./tasks.mjs";
import { exposedElementValues } from "./structure-projection.mjs";
import { ownedObjectScope } from "./object-graph.mjs";
import { HISTORICAL_COUNT_POLICY } from './historical-count-policy.mjs';
import {locationHypnosisProjection} from './location-hypnosis.mjs';
import {cashAmountField,CHARACTER_CASH_RULE} from './character-cash.mjs';
import {CHARACTER_CLOTHING_RULE} from './character-clothing.mjs';

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (const char of text) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}

function entryPayload(entry) {
  const strategyType = entry?.strategy?.type;
  const positionTypes = {
    before_character_definition: 0,
    after_character_definition: 1,
    before_author_note: 2,
    after_author_note: 3,
    at_depth: 4,
    before_example_messages: 5,
    after_example_messages: 6,
    outlet: 7,
  };
  const roleTypes = { system: 0, user: 1, assistant: 2 };
  return {
    comment: entry.comment ?? entry.name ?? "",
    content: entry.content,
    key: entry.key ?? entry?.strategy?.keys?.map(String) ?? [],
    keysecondary: entry.keysecondary ?? entry?.strategy?.keys_secondary?.keys?.map(String) ?? [],
    constant: entry.constant === true || strategyType === "constant",
    vectorized: entry.vectorized === true || strategyType === "vectorized",
    selective: !(entry.constant === true || strategyType === "constant" || entry.vectorized === true || strategyType === "vectorized"),
    selectiveLogic: entry.selectiveLogic ?? ({ and_any: 0, not_all: 1, not_any: 2, and_all: 3 }[entry?.strategy?.keys_secondary?.logic] ?? 0),
    order: entry.order ?? entry?.position?.order ?? 100,
    position: typeof entry.position === "number" ? entry.position : (positionTypes[entry?.position?.type] ?? 1),
    depth: entry.depth ?? entry?.position?.depth ?? 4,
    role: typeof entry.role === "number" ? entry.role : (roleTypes[entry?.position?.role] ?? 0),
    probability: entry.probability ?? 100,
    scanDepth: entry.scanDepth ?? (entry?.strategy?.scan_depth === "same_as_global" ? null : entry?.strategy?.scan_depth) ?? null,
    recursion: worldbookRecursion(entry),
    effect: worldbookEffect(entry),
    implicit: worldbookImplicitFields(entry),
  };
}

function managedMeta(entry) {
  return entry?.extra?.hypnoosObjectManager ?? entry?.extensions?.hypnoosObjectManager;
}

export function isManagedWorldbookEntry(entry, chatKey = "") {
  const meta = managedMeta(entry);
  return Boolean(meta?.managed === true && meta?.schema === 1 && (!chatKey || meta.chatKey === chatKey));
}

export function makeManagedWorldbookEntry({ chatKey, owner, source, entry, projectionId }) {
  const ownerRef = normalizeRef(owner);
  const sourceRef = normalizeRef(source ?? owner);
  const route = entry.route ?? parseCommentRoute(entry.comment);
  const payload = entryPayload(entry);
  const key = `${refKey(ownerRef)}:${refKey(sourceRef)}:${projectionId ?? entry.id}`;
  const contentHash = stableHash(payload);
  const meta = {
    managed: true,
    schema: 1,
    chatKey,
    owner: ownerRef,
    source: sourceRef,
    projectionId: String(projectionId ?? entry.id),
    projectionKey: key,
    route,
    contentHash,
  };
  return {
    ...payload,
    disable: entry.enabled === false,
    enabled: entry.enabled !== false,
    extensions: {
      ...(entry.extensions && typeof entry.extensions === "object" ? cloneValue(entry.extensions) : {}),
      hypnoosObjectManager: meta,
    },
    extra: { ...(entry.extra ? cloneValue(entry.extra) : {}), hypnoosObjectManager: meta },
  };
}

export function toTavernHelperWorldbookEntry(entry) {
  const payload = entryPayload(entry);
  const meta = managedMeta(entry);
  const type = payload.constant ? "constant" : payload.vectorized ? "vectorized" : "selective";
  return {
    ...payload.implicit,
    ...(entry.uid === undefined ? {} : { uid: entry.uid }),
    name: payload.comment,
    enabled: entry.enabled !== false && entry.disable !== true,
    strategy: {
      type,
      keys: payload.key,
      keys_secondary: {
        logic: ({ 0: "and_any", 1: "not_all", 2: "not_any", 3: "and_all" })[payload.selectiveLogic] ?? "and_any",
        keys: payload.keysecondary,
      },
      scan_depth: payload.scanDepth ?? "same_as_global",
    },
    position: {
      type: ({ 0: "before_character_definition", 1: "after_character_definition", 2: "before_author_note", 3: "after_author_note", 4: "at_depth", 5: "before_example_messages", 6: "after_example_messages", 7: "outlet" })[payload.position] ?? "after_character_definition",
      role: ({ 0: "system", 1: "user", 2: "assistant" })[payload.role] ?? "system",
      depth: payload.depth,
      order: payload.order,
    },
    content: payload.content,
    probability: payload.probability,
    recursion: payload.recursion,
    effect: payload.effect,
    extra: {
      ...(entry.extra && typeof entry.extra === "object" ? cloneValue(entry.extra) : {}),
      ...(meta ? { hypnoosObjectManager: cloneValue(meta) } : {}),
    },
  };
}

function objectWorldbookEntries(object) {
  return Array.isArray(object?.worldbook?.entries) ? object.worldbook.entries : [];
}

export function materializeObjectKnowledge(object, context) {
  const result = [], groups = new Map();
  for (const entry of objectWorldbookEntries(object)) {
    const fragment = entry.extra?.hypnoosTemplateFragment;
    if (!fragment) { result.push(entry); continue; }
    if (entry.enabled === false || !evaluateCondition(entry.when, context)) continue;
    if (!groups.has(fragment.group)) { const compiled = { ...entry, id: `compiled-${fragment.group}`, comment: fragment.title, when: null, extra: {}, fragments: [] }; groups.set(fragment.group, compiled); result.push(compiled); }
    groups.get(fragment.group).fragments.push({ sequence: fragment.sequence, content: entry.content });
  }
  return result.map((entry) => { if (!entry.fragments) return entry; const { fragments, ...compiled } = entry; return { ...compiled, content: fragments.sort((left, right) => left.sequence - right.sequence).map((fragment) => fragment.content).join("") }; });
}

export async function projectActiveCharacters({ chatKey, characters, allCharacters = characters, resolveObject, hiddenPrompts = [], locations = [], context = {}, activeTaskRefs = [] }) {
  if (activeTaskRefs.length > 3) throw new Error("LLM projection cannot contain more than 3 active tasks");
  const activeTaskKeys = new Set(activeTaskRefs.map(refKey));
  const desired = [];
  const seen = new Set();
  const mounted = new Set(characters.map((x) => x.id));
  if(characters.some(x=>x.id!=='user'&&x.elements.some(field=>field.label==='衣着')))desired.push(makeManagedWorldbookEntry({chatKey,owner:{kind:'event',id:'character-clothing-policy'},entry:{id:'character-clothing-policy',comment:'人物衣着字段',content:CHARACTER_CLOTHING_RULE,constant:true,position:4,depth:0,order:10},projectionId:'character-clothing-policy'}));
  if(characters.some(x=>x.id!=='user'&&cashAmountField(x)))desired.push(makeManagedWorldbookEntry({chatKey,owner:{kind:'event',id:'character-cash-policy'},entry:{id:'character-cash-policy',comment:'人物现金结算',content:CHARACTER_CASH_RULE,constant:true,position:4,depth:0,order:9},projectionId:'character-cash-policy'}));
  if(context.personnelPolicy?.historicalOrgasmCounts&&characters.some(x=>contentPolicyContextApplicable(x,'historical-counts')))desired.push(makeManagedWorldbookEntry({chatKey,owner:{kind:'event',id:'historical-count-policy'},entry:{id:'historical-count-policy',comment:'人物历史次数口径',content:HISTORICAL_COUNT_POLICY,constant:true,position:4,depth:0,order:8},projectionId:'historical-count-policy'}));
  for (const raw of allCharacters) {
    const character = normalizeCharacter(raw);
    if (mounted.has(character.id)) continue;
    for (const entry of materializeObjectKnowledge(character, { ...context, owner: character })) {
      if (entry.route === "update" || !evaluateCondition(entry.when, { ...context, owner: character })) continue;
      const knowledge = { ...entry, route: "plot", comment: entry.comment.replace(/\[mvu_update\]/g, ""), key: entry.key.length ? entry.key : [character.name, ...character.aliases].filter(Boolean), constant: false, vectorized: false, selective: true, recursion: { ...entry.recursion, prevent_incoming: true, prevent_outgoing: true } };
      desired.push(makeManagedWorldbookEntry({ chatKey, owner: character, source: character, entry: knowledge, projectionId: entry.id }));
    }
  }
  const rosterOwner = { kind: "event", id: "object-character-slots" };
  desired.push(makeManagedWorldbookEntry({ chatKey, owner: rosterOwner, entry: { id: "mounted-character-roster", comment: "[object_slots]当前人物卡槽", content: JSON.stringify({ mountedCharacters: characters.map((x) => ({ id: x.id, name: x.name })), updatePolicy: "Only these mounted characters and their explicitly allowed child objects receive class-variable state and may update. Other character knowledge can match worldbook keywords, but it does not grant update permission or automatically mount a character." }), constant: true, position: 4, depth: 0, order: 5 }, projectionId: "mounted-character-roster" }));
  for (const rawCharacter of characters) {
    const character = normalizeCharacter(rawCharacter);
    const owner = { kind: "character", id: character.id };
    for (const route of ["plot", "update", "shared", "both"]) {
      const fields = exposedElementValues(character, context).filter((field) => field.audience === route);
      if (!fields.length) continue;
      const prefix = route === "plot" ? "[mvu_plot]" : route === "update" ? "[mvu_update]" : route === "both" ? "" : "";
      desired.push(makeManagedWorldbookEntry({ chatKey, owner, entry: { id: `elements-${route}`, comment: `${prefix}[object_elements]${character.name}`, content: JSON.stringify({ object: owner, fields, update: "Only writable field values use replace /values/<stable-element-id> in ObjectUpdate; do not write definitions, groups, bindings or references." }), constant: true, position: 4, depth: 0, order: 840 }, projectionId: `elements-${route}` }));
    }
    if (context.personnelPolicy?.exposeRelations !== false && character.relations.length) {
      const relationships = [];
      for (const relation of character.relations) { const target = await resolveObject(relation.target); if (!target) throw new Error("missing relationship target"); relationships.push({ target: relation.target, name: target.name, type: relation.type, summary: relation.summary }); }
      desired.push(makeManagedWorldbookEntry({ chatKey, owner, entry: { id: "relationship-summary", comment: `[mvu_plot][relationships]${character.name}`, content: JSON.stringify({ owner, relationships, boundary: "Relationship edges do not load related character personas or state." }), constant: true, position: 4, depth: 0, order: 830 }, projectionId: "relationship-summary" }));
    }
    for (const entry of materializeObjectKnowledge(character, { ...context, owner: character })) {
      if (!evaluateCondition(entry.when, { ...context, owner: character })) continue;
      const managed = makeManagedWorldbookEntry({ chatKey, owner, source: owner, entry, projectionId: entry.id });
      if (!seen.has(managed.extensions.hypnoosObjectManager.projectionKey)) {
        seen.add(managed.extensions.hypnoosObjectManager.projectionKey);
        desired.push(managed);
      }
    }
    const refs = [
      ...character.refs.achievements,
      ...character.refs.tasks,
      ...(context.personnelPolicy?.fileAffinityEvents ? [] : character.refs.favorEvents),
      ...(character.refs.schedule ? [character.refs.schedule] : []),
    ];
    for (const ref of refs) {
      if (ref.kind === "task" && !activeTaskKeys.has(refKey(ref))) continue;
      const child = await resolveObject(ref);
      if (!child) throw new Error(`missing referenced object: ${refKey(ref)}`);
      const normalized = normalizeObject(child);
      if (["task", "achievement"].includes(ref.kind) && refKey(normalized.owner) !== refKey(owner)) throw new Error("character child owner mismatch");
      if (ref.kind === "favor-event" && normalized.data.sourceDefinition && character.values.affinity >= normalized.data.threshold && (!normalized.data.requiredGender || normalized.data.requiredGender === character.values.gender)) {
        desired.push(makeManagedWorldbookEntry({ chatKey, owner, source: ref, entry: { id: "favor-definition", comment: `[mvu_plot]${character.name}/${normalized.name}事件定义`, content: JSON.stringify({ object: ref, definition: { name: normalized.name, description: normalized.data.description, threshold: normalized.data.threshold }, boundary: "Definition availability is not execution. No event occurs automatically; execution and history require an explicit frontend action. This definition and legacy event flags are not model-writable." }), constant: true, position: 4, depth: 0, order: 845 }, projectionId: `${refKey(ref)}:definition` }));
      }
      if (ref.kind === "task" && normalized.data.completed) continue;
      if (ref.kind === "task") desired.push(makeManagedWorldbookEntry({ chatKey, owner, source: ref, entry: activeTaskModelEntry(normalized, character.name), projectionId: `${refKey(ref)}:active-state` }));
      for (const entry of materializeObjectKnowledge(normalized, { ...context, owner: normalized, character })) {
        if (!evaluateCondition(entry.when, { ...context, owner: normalized, character })) continue;
        const managed = makeManagedWorldbookEntry({ chatKey, owner, source: ref, entry, projectionId: `${refKey(ref)}:${entry.id}` });
        if (!seen.has(managed.extensions.hypnoosObjectManager.projectionKey)) {
          seen.add(managed.extensions.hypnoosObjectManager.projectionKey);
          desired.push(managed);
        }
      }
    }
    const nativeKeys = new Set(refs.map(refKey));
    for (const nested of await ownedObjectScope(character, resolveObject, { activeTaskKeys })) {
      if (nested.kind === "character" || context.personnelPolicy?.fileAffinityEvents && nested.kind === "favor-event") continue;
      const source = { kind: nested.kind, id: nested.id };
      for (const route of ["plot", "update", "shared", "both"]) {
        const fields = exposedElementValues(nested, context).filter((field) => field.audience === route);
        if (!fields.length) continue;
        const prefix = route === "plot" ? "[mvu_plot]" : route === "update" ? "[mvu_update]" : route === "both" ? "" : "";
        desired.push(makeManagedWorldbookEntry({ chatKey, owner, source, entry: { id: `elements-${route}`, comment: `${prefix}[object_elements]${character.name}/${nested.name}`, content: JSON.stringify({ object: source, fields, update: "Writable fields only: replace /values/<stable-element-id> in ObjectUpdate." }), constant: true, position: 4, depth: 0, order: 840 }, projectionId: `${refKey(source)}:elements-${route}` }));
      }
      if (nativeKeys.has(refKey(source))) continue;
      for (const entry of materializeObjectKnowledge(nested, { ...context, owner: nested, character })) {
        if (!evaluateCondition(entry.when, { ...context, owner: nested, character })) continue;
        const managed = makeManagedWorldbookEntry({ chatKey, owner, source, entry, projectionId: `${refKey(source)}:${entry.id}` });
        const key = managed.extensions.hypnoosObjectManager.projectionKey;
        if (!seen.has(key)) { seen.add(key); desired.push(managed); }
      }
    }
  }
  for (const location of locations) {
    const hypnosis=locationHypnosisProjection(location,{writable:context.locationHypnosisWritableIds?.includes(location.id),within:context.locationHypnosisWithin?.includes(location.id),date:context.state?.date??context.date,time:context.state?.time??context.time});
    if(hypnosis)desired.push(makeManagedWorldbookEntry({chatKey,owner:location,source:location,entry:{id:'location-hypnosis',comment:'[location_hypnosis]'+location.name,content:JSON.stringify(hypnosis),constant:true,position:4,depth:0,order:841},projectionId:'location-hypnosis'}));
    for (const entry of materializeObjectKnowledge(location, { ...context, owner: location })) {
      if (!evaluateCondition(entry.when, { ...context, owner: location })) continue;
      desired.push(makeManagedWorldbookEntry({ chatKey, owner: location, source: location, entry, projectionId: entry.id }));
    }
  }
  for (const prompt of hiddenPrompts) {
    const prefix = prompt.route === "plot" ? "[mvu_plot]" : prompt.route === "update" ? "[mvu_update]" : prompt.route === "both" ? "" : "";
    const entry = {
      id: String(prompt.id).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase(),
      comment: `${prefix}[object_hidden]${prompt.id}`,
      content: String(prompt.content),
      key: [], keysecondary: [], constant: true, selective: false,
      order: Number(prompt.order ?? 900), position: 4, depth: Number(prompt.depth ?? 0), role: 0,
      probability: 100, enabled: prompt.enabled !== false,
    };
    desired.push(makeManagedWorldbookEntry({ chatKey, owner: prompt.owner, source: prompt.owner, entry, projectionId: `hidden:${prompt.id}` }));
  }
  if (desired.length > 0) {
    const owner = characters.length
      ? { kind: "character", id: normalizeCharacter(characters[0]).id }
      : { kind: "event", id: "object-manager-routing" };
    desired.unshift(makeManagedWorldbookEntry({
      chatKey,
      owner,
      source: owner,
      projectionId: "runtime-routing-marker",
      entry: {
        id: "runtime-routing-marker",
        comment: "[object_manager]路由支持",
        content: '<object_manager_route>Objects are independent chat-file state, not MVU. Only mounted objects and allowed fields may update. Append <ObjectUpdate><JSONPatch>{"schema":1,"transaction_id":"unique-per-reply","operations":[{"target":{"kind":"character","id":"stable-id"},"op":"replace","path":"/values/field-id","value":0}]}</JSONPatch></ObjectUpdate>. JSONPatch arrays may alternatively use /objects/character/stable-id/values/field-id. Never emit these changes in UpdateVariable. Do not alter definitions, references, worldbook entries, images or claims. Follow mode emits updates with the story; extra mode emits update blocks only.</object_manager_route>',
        key: [], keysecondary: [], constant: true, selective: false,
        order: 20, position: 1, depth: 4, role: 0, probability: 100, enabled: true,
      },
    }));
  }
  return desired;
}

export function reconcileWorldbookEntries(existingEntries, desiredEntries, { chatKey, allowAdoptDrift = false } = {}) {
  const existing = Array.isArray(existingEntries) ? existingEntries.map(cloneValue) : [];
  const desired = Array.isArray(desiredEntries) ? desiredEntries.map(cloneValue) : [];
  const existingManaged = new Map();
  for (const entry of existing) {
    if (!isManagedWorldbookEntry(entry, chatKey)) continue;
    const meta = managedMeta(entry);
    const actualHash = stableHash(entryPayload(entry));
    if (!allowAdoptDrift && meta.contentHash !== actualHash) throw new Error(`managed worldbook drift: ${meta.projectionKey}`);
    existingManaged.set(meta.projectionKey, entry);
  }
  const manualOrOtherChat = existing.filter((entry) => !isManagedWorldbookEntry(entry, chatKey));
  const nextManaged = desired.map((entry) => {
    const key = managedMeta(entry)?.projectionKey;
    const previous = existingManaged.get(key);
    return previous?.uid === undefined ? entry : { ...entry, uid: previous.uid };
  });
  return {
    entries: [...manualOrOtherChat, ...nextManaged],
    added: nextManaged.filter((entry) => !existingManaged.has(managedMeta(entry).projectionKey)).length,
    removed: [...existingManaged.keys()].filter((key) => !nextManaged.some((entry) => managedMeta(entry).projectionKey === key)).length,
    updated: nextManaged.filter((entry) => {
      const previous = existingManaged.get(managedMeta(entry).projectionKey);
      return previous && managedMeta(previous).contentHash !== managedMeta(entry).contentHash;
    }).length,
  };
}
