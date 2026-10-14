import { cloneValue, normalizeObject, normalizeRef, refKey } from "./contracts.mjs";
import { flattenElements, validateElementValue } from "./structure-schema.mjs";
import {validateCharacterCashUpdate} from './character-cash.mjs';

export function decodePointer(path) {
  const text = String(path ?? "");
  if (!text.startsWith("/") || text === "/") throw new Error(`invalid JSON Pointer: ${text}`);
  if (/~(?:[^01]|$)/.test(text)) throw new Error(`invalid JSON Pointer escape: ${text}`);
  const segments = text.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (segments.some((part) => ["__proto__", "constructor", "prototype"].includes(part))) throw new Error("unsafe JSON Pointer");
  return segments;
}

function locateParent(root, segments) {
  let parent = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!parent || typeof parent !== "object" || !Object.prototype.hasOwnProperty.call(parent, segment)) {
      throw new Error(`missing parent at /${segments.slice(0, index + 1).join("/")}`);
    }
    parent = parent[segment];
  }
  return { parent, key: segments.at(-1) };
}

function applyOne(root, operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) throw new Error("patch operation must be an object");
  if (!["add", "replace", "remove"].includes(operation.op)) throw new Error(`unsupported patch op: ${String(operation.op)}`);
  const segments = decodePointer(operation.path);
  const { parent, key } = locateParent(root, segments);
  if (!parent || typeof parent !== "object") throw new Error(`patch parent is not a collection: ${operation.path}`);

  if (Array.isArray(parent)) {
    const index = key === "-" ? parent.length : Number(key);
    if (!Number.isInteger(index) || index < 0 || index > parent.length) throw new Error(`invalid array index: ${operation.path}`);
    if (operation.op === "add") {
      if (!Object.prototype.hasOwnProperty.call(operation, "value")) throw new Error("add requires value");
      parent.splice(index, 0, cloneValue(operation.value));
      return;
    }
    if (index >= parent.length) throw new Error(`array item does not exist: ${operation.path}`);
    if (operation.op === "remove") parent.splice(index, 1);
    else {
      if (!Object.prototype.hasOwnProperty.call(operation, "value")) throw new Error("replace requires value");
      parent[index] = cloneValue(operation.value);
    }
    return;
  }

  const exists = Object.prototype.hasOwnProperty.call(parent, key);
  if (operation.op === "add") {
    if (exists) throw new Error(`add target already exists: ${operation.path}`);
    if (!Object.prototype.hasOwnProperty.call(operation, "value")) throw new Error("add requires value");
    parent[key] = cloneValue(operation.value);
  } else if (operation.op === "replace") {
    if (!exists) throw new Error(`replace target is missing: ${operation.path}`);
    if (!Object.prototype.hasOwnProperty.call(operation, "value")) throw new Error("replace requires value");
    parent[key] = cloneValue(operation.value);
  } else {
    if (!exists) throw new Error(`remove target is missing: ${operation.path}`);
    delete parent[key];
  }
}

export function applyJsonPatch(document, operations, validator = (value) => value) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("patch batch must contain operations");
  const draft = cloneValue(document);
  for (const operation of operations) applyOne(draft, operation);
  return validator(draft);
}

export function normalizeObjectPatchEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ObjectUpdate must contain an object");
  if (value.schema !== 1) throw new Error(`unsupported ObjectUpdate schema: ${String(value.schema)}`);
  const transactionId = String(value.transaction_id ?? value.transactionId ?? "").trim();
  if (!transactionId) throw new Error("ObjectUpdate requires transaction_id");
  if (!Array.isArray(value.operations) || value.operations.length === 0) throw new Error("ObjectUpdate requires operations");
  return {
    schema: 1,
    transactionId,
    operations: value.operations.map((operation, index) => {
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) throw new Error(`operation ${index} must be an object`);
      const target = normalizeRef(operation.target);
      return {
        target,
        op: String(operation.op ?? ""),
        path: String(operation.path ?? ""),
        ...(Object.prototype.hasOwnProperty.call(operation, "value") ? { value: cloneValue(operation.value) } : {}),
      };
    }),
  };
}

export function parseObjectUpdateBlocks(text, { transactionPrefix = "standalone" } = {}) {
  const source = String(text ?? "");
  const matches = [...source.matchAll(/<ObjectUpdate>([\s\S]*?)<\/ObjectUpdate>/gi)];
  const envelopes = [];
  for (const match of matches) {
    const inner = String(match[1] ?? "");
    const patch = inner.match(/<JSON_?Patch>([\s\S]*?)<\/JSON_?Patch>/i);
    const body = String(patch ? patch[1] : inner)
      .trim()
      .replace(/^<JSONPatch>\s*/i, "")
      .replace(/\s*<\/JSONPatch>$/i, "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      let hash = 0x811c9dc5; for (const char of body) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
      const operations = parsed.map((operation) => {
        if (operation.target) return operation;
        const segments = decodePointer(operation.path);
        if (segments[0] !== "objects" || segments.length < 5) throw new Error("object JSONPatch paths must use /objects/<kind>/<id>/<field>/...; MVU paths are not accepted");
        return { ...operation, target: { kind: segments[1], id: segments[2] }, path: "/" + segments.slice(3).map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1")).join("/") };
      });
      envelopes.push(normalizeObjectPatchEnvelope({ schema: 1, transaction_id: `${transactionPrefix}-patch-${hash.toString(16)}`, operations }));
    } else envelopes.push(normalizeObjectPatchEnvelope(parsed));
  }
  return envelopes;
}

export function applyObjectPatchEnvelope(objectsByKey, envelope, allowedKeys = null) {
  const normalized = normalizeObjectPatchEnvelope(envelope);
  const drafts = new Map([...objectsByKey].map(([key, value]) => [key, cloneValue(value)]));
  for (const operation of normalized.operations) {
    const key = refKey(operation.target);
    if (allowedKeys && !allowedKeys.has(key)) throw new Error(`patch target is not active/reachable: ${key}`);
    if (!drafts.has(key)) throw new Error(`patch target does not exist: ${key}`);
    const field = decodePointer(operation.path)[0];
    const object = drafts.get(key);
    const permittedFields = object.kind === "character" ? ["state", "values"] : ["data", "values"];
    if (!permittedFields.includes(field) || !Object.hasOwn(object, field)) throw new Error(`model patch field is not writable: ${field}`);
    if (field === "values") {
      const segments = decodePointer(operation.path);
      const definition = flattenElements(object.elements).find((item) => item.id === segments[1]);
      if (segments.length !== 2 || operation.op !== "replace" || !definition || definition.type === "group" || definition.binding || definition.modelWritable === false || definition.audience === "local" || !definition.enabled) throw new Error("element is not model-writable");
      validateElementValue(definition, operation.value);
      validateCharacterCashUpdate(object,segments[1],operation.value);
    } else if (["task", "achievement"].includes(object.kind)) {
      const segments = decodePointer(operation.path);
      const completion = operation.path === "/data/completed" && operation.op === "replace" && operation.value === true && object.definition.completion.mode === "narrative";
      const progress = segments[1] === "progress" && segments.length >= 3;
      if (!completion && !progress) throw new Error("task/achievement lifecycle, claims and definitions are script-owned");
      if (object.data.completed) throw new Error("completed archive is not model-writable");
    }
    drafts.set(key, applyJsonPatch(drafts.get(key), [operation], normalizeObject));
  }
  return { transactionId: normalized.transactionId, objects: drafts };
}
