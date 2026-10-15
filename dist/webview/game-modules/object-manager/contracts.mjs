import { withoutRetiredCurrency } from './account.mjs';
import { normalizeCondition } from "./conditions.mjs";
import { worldbookImplicitFields, worldbookRecursion, worldbookEffect } from "./worldbook-policy.mjs";
import { normalizeStructure, defaultCharacterElements } from "./structure-schema.mjs";
import { normalizeLocationBoard } from "./board-schema.mjs";
import {normalizeCashRefresh} from './character-cash.mjs';

export const OBJECT_SCHEMA = "hypnoos-object-v1";
export const OBJECT_KINDS = Object.freeze([
  "character",
  "location",
  "achievement",
  "task",
  "favor-event",
  "schedule",
  "event",
  "custom",
]);
export const WEEKDAYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
export const MAX_REPLY_CHECKPOINTS = 3;
export const MAX_ACTIVE_TASKS = 3;

export function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function assertObjectId(value, label = "object id") {
  const text = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(text)) {
    throw new Error(`${label} must match /^[a-z0-9][a-z0-9._-]{0,127}$/i`);
  }
  return text;
}

export function normalizeRef(value, expectedKind = "") {
  if (!isPlainObject(value)) throw new Error("object reference must be an object");
  const kind = String(value.kind ?? "").trim();
  if (!OBJECT_KINDS.includes(kind)) throw new Error(`unsupported object kind: ${kind}`);
  if (expectedKind && kind !== expectedKind) throw new Error(`expected ${expectedKind} reference, got ${kind}`);
  return Object.freeze({ kind, id: assertObjectId(value.id, `${kind} id`) });
}

export function refKey(value) {
  const ref = normalizeRef(value);
  return `${ref.kind}:${ref.id}`;
}

export function parseCommentRoute(comment) {
  const text = String(comment ?? "").trim();
  const plot = /\[mvu_plot\]/i.test(text);
  const update = /\[mvu_update\]/i.test(text);
  if (plot && update) return "both";
  if (plot) return "plot";
  if (update) return "update";
  return "shared";
}

export function normalizeWorldbookEntry(value, index = 0) {
  if (!isPlainObject(value)) throw new Error(`worldbook entry ${index} must be an object`);
  const comment = String(value.comment ?? value.name ?? "").trim();
  if (!comment) throw new Error(`worldbook entry ${index} is missing comment`);
  const content = String(value.content ?? "").trim();
  if (!content) throw new Error(`worldbook entry ${comment} is missing content`);
  return {
    id: assertObjectId(value.id ?? `entry-${index + 1}`, `worldbook entry ${comment} id`),
    comment,
    route: parseCommentRoute(comment),
    content,
    key: (value.key ?? value.keys ?? value.strategy?.keys ?? []).map(String),
    keysecondary: (value.keysecondary ?? value.secondary_keys ?? value.strategy?.keys_secondary?.keys ?? []).map(String),
    constant: value.constant === true || value.strategy?.type === "constant",
    vectorized: value.vectorized === true || value.strategy?.type === "vectorized",
    selective: value.selective === true || value.strategy?.type === "selective",
    selectiveLogic: Number.isInteger(value.selectiveLogic) ? value.selectiveLogic : ({ and_any: 0, not_all: 1, not_any: 2, and_all: 3 }[value.strategy?.keys_secondary?.logic] ?? 0),
    order: Number(value.order ?? value.position?.order ?? 100),
    position: Number.isInteger(value.position) ? value.position : ({ before_character_definition: 0, after_character_definition: 1, before_author_note: 2, after_author_note: 3, at_depth: 4, before_example_messages: 5, after_example_messages: 6, outlet: 7 }[value.position?.type] ?? 1),
    depth: value.depth ?? value.position?.depth ?? 4,
    role: Number.isInteger(value.role) ? value.role : ({ system: 0, user: 1, assistant: 2 }[value.position?.role] ?? 0),
    probability: value.useProbability === false ? 100 : Number.isFinite(Number(value.probability)) ? Number(value.probability) : 100,
    scanDepth: Number.isInteger(value.scanDepth ?? value.strategy?.scan_depth) ? (value.scanDepth ?? value.strategy.scan_depth) : null,
    recursion: worldbookRecursion(value),
    effect: worldbookEffect(value),
    implicit: worldbookImplicitFields(value),
    extra: isPlainObject(value.extra) ? cloneValue(value.extra) : {},
    enabled: value.enabled !== false && value.disable !== true && value.disabled !== true,
    when: normalizeCondition(value.when),
  };
}

function normalizeRefArray(value, kind) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${kind} references must be an array`);
  const seen = new Set();
  return value.map((item) => normalizeRef(item, kind)).filter((item) => {
    const key = refKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeCharacter(value) {
  value = withoutRetiredCurrency(value);
  if (!isPlainObject(value)) throw new Error("character must be an object");
  const id = assertObjectId(value.id, "character id");
  const name = String(value.name ?? "").trim();
  if (!name) throw new Error(`character ${id} is missing name`);
  const relations = Array.isArray(value.relations) ? value.relations.map((relation, index) => {
    if (!isPlainObject(relation)) throw new Error(`character ${id} relation ${index} must be an object`);
    return {
      id: assertObjectId(relation.id ?? `relation-${index + 1}`, `character ${id} relation id`),
      target: normalizeRef(relation.target, "character"),
      type: String(relation.type ?? "related").trim() || "related",
      summary: String(relation.summary ?? "").trim(),
    };
  }) : [];
  const refs = isPlainObject(value.refs) ? value.refs : {};
  const worldbook = isPlainObject(value.worldbook) ? value.worldbook : {};
  const entries = Array.isArray(worldbook.entries)
    ? worldbook.entries.map((entry, index) => normalizeWorldbookEntry(entry, index))
    : [];
  return {
    schema: OBJECT_SCHEMA,
    kind: "character",
    ...(value.cashRefresh?{cashRefresh:normalizeCashRefresh(value.cashRefresh)}:{}),
    ...normalizeStructure({ ...value, elements: value.elements ?? defaultCharacterElements() }, { assertId: assertObjectId, normalizeRef, normalizeCondition }),
    id,
    name,
    aliases: Array.isArray(value.aliases) ? value.aliases.map(String).map((item) => item.trim()).filter(Boolean) : [],
    summary: String(value.summary ?? "").trim(),
    state: isPlainObject(value.state) ? cloneValue(value.state) : {},
    relations,
    refs: {
      achievements: normalizeRefArray(refs.achievements, "achievement"),
      tasks: normalizeRefArray(refs.tasks, "task"),
      favorEvents: normalizeRefArray(refs.favorEvents, "favor-event"),
      schedule: refs.schedule ? normalizeRef(refs.schedule, "schedule") : null,
    },
    worldbook: { entries },
    ui: isPlainObject(value.ui) ? cloneValue(value.ui) : { template: "character/default", theme: {}, tabs: [] },
    revision: Math.max(0, Math.trunc(Number(value.revision) || 0)),
  };
}

function normalizeScheduleDay(value, label) {
  const source = isPlainObject(value) ? value : {};
  return {
    defaultLocation: source.defaultLocation ? normalizeRef(source.defaultLocation, "location") : null,
    entries: Array.isArray(source.entries) ? source.entries.map((entry, index) => {
      if (!isPlainObject(entry)) throw new Error(`${label} entry ${index} must be an object`);
      const id = assertObjectId(entry.id ?? `${label}-${index + 1}`, `${label} entry id`);
      const start = String(entry.start ?? "").trim();
      const end = String(entry.end ?? "").trim();
      if (entry.enabled !== false) {
        const minutes = (time) => {
          if (time === "24:00") return 1440;
          const match = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
          if (!match) throw new Error(`${label} entry ${id} has invalid time`);
          return Number(match[1]) * 60 + Number(match[2]);
        };
        if (minutes(start) >= 1440 || minutes(start) >= minutes(end)) throw new Error(`${label} entry ${id} must have start < end`);
      }
      return {
        id,
        start,
        end,
        location: entry.location ? normalizeRef(entry.location, "location") : null,
        event: entry.event ? normalizeRef(entry.event, "event") : null,
        enabled: entry.enabled !== false,
        note: String(entry.note ?? "").trim(),
      };
    }) : [],
  };
}

export function normalizeSchedule(value) {
  if (!isPlainObject(value)) throw new Error("schedule must be an object");
  const id = assertObjectId(value.id, "schedule id");
  const sourceDays = isPlainObject(value.days) ? value.days : {};
  const days = Object.fromEntries(WEEKDAYS.map((day) => [day, normalizeScheduleDay(sourceDays[day], day)]));
  const holidays = {};
  if (isPlainObject(value.holidays)) {
    for (const [holidayId, holiday] of Object.entries(value.holidays)) {
      holidays[assertObjectId(holidayId, "holiday id")] = normalizeScheduleDay(holiday, `holiday-${holidayId}`);
    }
  }
  const emptyPolicy = isPlainObject(value.emptyPolicy) ? value.emptyPolicy : {};
  return {
    schema: OBJECT_SCHEMA,
    kind: "schedule",
    ...normalizeStructure(value, { assertId: assertObjectId, normalizeRef, normalizeCondition }),
    id,
    name: String(value.name ?? id).trim() || id,
    summary: String(value.summary ?? value.data?.description ?? ""),
    defaultLocation: value.defaultLocation ? normalizeRef(value.defaultLocation, "location") : null,
    days,
    holidays,
    emptyPolicy: {
      location: emptyPolicy.location ? normalizeRef(emptyPolicy.location, "location") : null,
      event: emptyPolicy.event ? normalizeRef(emptyPolicy.event, "event") : null,
    },
    worldbook: {
      entries: Array.isArray(value.worldbook?.entries)
        ? value.worldbook.entries.map((entry, index) => normalizeWorldbookEntry(entry, index))
        : [],
    },
    ui: isPlainObject(value.ui) ? cloneValue(value.ui) : { template: "schedule/default", theme: {}, tabs: [] },
    revision: Math.max(0, Math.trunc(Number(value.revision) || 0)),
  };
}

export function normalizeGenericObject(value, kind) {
  if (!isPlainObject(value)) throw new Error(`${kind} must be an object`);
  const id = assertObjectId(value.id, `${kind} id`);
  return {
    schema: OBJECT_SCHEMA,
    kind,
    ...normalizeStructure(value, { assertId: assertObjectId, normalizeRef, normalizeCondition }),
    ...(kind === "custom" ? { typeId: assertObjectId(value.typeId ?? "custom", "custom type id") } : {}),
    id,
    name: String(value.name ?? id).trim() || id,
    data: isPlainObject(value.data) ? cloneValue(value.data) : {},
    refs: Array.isArray(value.refs) ? value.refs.map((item) => normalizeRef(item)) : [],
    worldbook: {
      entries: Array.isArray(value.worldbook?.entries)
        ? value.worldbook.entries.map((entry, index) => normalizeWorldbookEntry(entry, index))
        : [],
    },
    ui: isPlainObject(value.ui) ? cloneValue(value.ui) : { template: `${kind}/default`, theme: {}, tabs: [] },
    revision: Math.max(0, Math.trunc(Number(value.revision) || 0)),
  };
}

export function normalizeCharacterChild(value, kind) {
  const base = normalizeGenericObject(value, kind);
  const owner = normalizeRef(value.owner, "character");
  const definition = isPlainObject(value.definition) ? value.definition : {};
  const completion = isPlainObject(definition.completion) ? definition.completion : {};
  const mode = completion.mode ?? "narrative";
  if (!["narrative", "script"].includes(mode)) throw new Error("unsupported completion mode");
  const when = normalizeCondition(completion.when);
  if (mode === "script" && !when) throw new Error("script completion requires a predicate");
  const data = isPlainObject(value.data) ? value.data : {};
  for (const field of ["completed", "claimed"]) if (data[field] !== undefined && typeof data[field] !== "boolean") throw new Error(`${kind} ${field} must be boolean`);
  if (data.claimed === true && data.completed !== true) throw new Error("incomplete reward cannot be claimed");
  const source = isPlainObject(value.source) ? cloneValue(value.source) : { kind: "builtin" };
  if (!["builtin", "local", "workshop"].includes(source.kind)) throw new Error("invalid child object source");
  return {
    ...base,
    owner,
    definition: {
      description: String(definition.description ?? "").trim(),
      completion: { mode, text: String(completion.text ?? "").trim(), when },
      rewards: isPlainObject(definition.rewards) ? withoutRetiredCurrency(definition.rewards) : {},
    },
    data: { completed: data.completed === true, claimed: data.claimed === true, progress: isPlainObject(data.progress) ? cloneValue(data.progress) : {}, claimReceipt: data.claimReceipt ? String(data.claimReceipt) : null },
    source,
  };
}

export const normalizeTask = (value) => normalizeCharacterChild(value, "task");
export const normalizeAchievement = (value) => normalizeCharacterChild(value, "achievement");

export function normalizeLocation(value) {
  const base = normalizeGenericObject(value, "location");
  const features = Array.isArray(value.features) ? value.features : [];
  const ids = new Set();
  const children = normalizeRefArray(value.children, "location");
  return {
    ...base,
    children,
    ui: { ...base.ui, board: normalizeLocationBoard(base.ui.board, children) },
    features: features.map((feature) => {
      if (!isPlainObject(feature)) throw new Error("location feature must be an object");
      const id = assertObjectId(feature.id, "feature id");
      if (ids.has(id)) throw new Error(`duplicate location feature: ${id}`);
      ids.add(id);
      return {
        id,
        label: String(feature.label ?? id),
        component: assertObjectId(feature.component ?? "action-button", "feature component"),
        action: assertObjectId(feature.action, "feature action"),
        enabled: feature.enabled !== false,
        when: normalizeCondition(feature.when),
        prompt: String(feature.prompt ?? "").trim(),
        route: ["plot", "update", "shared", "both"].includes(feature.route) ? feature.route : "plot",
      };
    }),
  };
}

export function normalizeObject(value) {
  if (!isPlainObject(value)) throw new Error("object must be an object");
  if (value.schema !== undefined && value.schema !== OBJECT_SCHEMA) {
    throw new Error(`unsupported object schema: ${String(value.schema)}`);
  }
  const kind = String(value.kind ?? "").trim();
  if (!OBJECT_KINDS.includes(kind)) throw new Error(`unsupported object kind: ${kind}`);
  if (kind === "character") return normalizeCharacter(value);
  if (kind === "schedule") return normalizeSchedule(value);
  if (kind === "location") return normalizeLocation(value);
  if (kind === "task") return normalizeTask(value);
  if (kind === "achievement") return normalizeAchievement(value);
  return normalizeGenericObject(value, kind);
}

export function characterReachableRefs(character) {
  const value = normalizeCharacter(character);
  return [
    ...value.relations.map((item) => item.target),
    ...value.refs.achievements,
    ...value.refs.tasks,
    ...value.refs.favorEvents,
    ...(value.refs.schedule ? [value.refs.schedule] : []),
  ];
}
