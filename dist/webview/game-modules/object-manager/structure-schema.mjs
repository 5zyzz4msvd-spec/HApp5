const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export const ELEMENT_TYPES = Object.freeze(["text", "textarea", "number", "boolean", "choice", "record", "list", "group"]);

export function defaultCharacterElements() {
  const fields = [{ id: "basic", type: "group", label: "基本资料", elements: [{ id: "display-name", type: "text", label: "档案名称", binding: { source: "object", path: "/name" }, audience: "plot" }, { id: "summary", type: "textarea", label: "简介", binding: { source: "object", path: "/summary" }, audience: "plot" }] }];
  fields.push({ id: "persona", type: "group", label: "角色设定", elements: [
    ...[["gender", "性别"], ["identity", "身份 / 职业"], ["appearance", "外貌与衣着"], ["personality", "性格与习惯"], ["background", "背景经历"], ["first-encounter", "初次邂逅"], ["behavior", "行为与对话风格"]].map(([id, label]) => ({ id, label, type: ["gender", "identity"].includes(id) ? "text" : "textarea", audience: "plot" })),
    ...[["age", "年龄"], ["height", "身高", "cm"]].map(([id, label, unit]) => ({ id, label, type: "number", min: 0, audience: "plot", unit: unit ?? "" }))
  ] });
  fields.push({ id: "runtime", type: "group", label: "独立类变量", elements: [["affinity", "好感度"], ["alertness", "警戒度"], ["cooperation", "服从度"]].map(([id, label]) => ({ id, label, type: "number", min: 0, max: 100, audience: "shared" })) });
  return fields;
}

export function normalizeStructure(source, { assertId, normalizeRef, normalizeCondition }) {
  const ids = new Set();
  let count = 0;
  function elements(raw, depth = 0) {
    if (!Array.isArray(raw) || depth > 12) throw new Error("elements must be an array with nesting depth at most 12");
    return raw.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid object element");
      const id = assertId(item.id, "element id");
      if (FORBIDDEN_KEYS.has(id) || ids.has(id) || ++count > 512) throw new Error("element IDs must be unique and safe; maximum 512 elements");
      ids.add(id);
      if (!ELEMENT_TYPES.includes(item.type)) throw new Error(`unsupported element type: ${item.type}`);
      const base = { id, type: item.type, label: String(item.label ?? id), enabled: item.enabled !== false, when: normalizeCondition(item.when) };
      if (item.type === "group") return { ...base, elements: elements(item.elements ?? [], depth + 1) };
      const binding = item.binding ? {
        source: String(item.binding.source),
        path: String(item.binding.path ?? ""),
      } : null;
      if (binding && (binding.source !== 'object' || !binding.path.startsWith("/") || /~(?:[^01]|$)/.test(binding.path) || binding.path.split("/").some((part) => FORBIDDEN_KEYS.has(part)))) throw new Error("invalid element binding; management fields cannot bind MVU");
      const audience = item.audience ?? "local";
      if (!["local", "plot", "update", "shared", "both"].includes(audience)) throw new Error("invalid element audience");
      const choices = item.type === "choice" ? (item.choices ?? []).map(String) : [];
      if (item.type === "choice" && (!choices.length || choices.length > 100 || new Set(choices).size !== choices.length)) throw new Error("choice element needs 1–100 distinct options");
      const min = item.min == null ? null : Number(item.min), max = item.max == null ? null : Number(item.max);
      if (min !== null && !Number.isFinite(min) || max !== null && !Number.isFinite(max) || min !== null && max !== null && min > max) throw new Error("invalid numeric element range");
      return { ...base, binding, audience, modelWritable: item.modelWritable !== false, choices, min, max, unit: String(item.unit ?? "") };
    });
  }
  const definitions = elements(source.elements ?? []);
  const flat = flattenElements(definitions);
  const supplied = source.values ?? {};
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) throw new Error("element values must be an object");
  for (const key of Object.keys(supplied)) if (!flat.some((item) => item.type !== "group" && !item.binding && item.id === key)) throw new Error(`value has no writable element definition: ${key}`);
  const values = {};
  for (const field of flat.filter((item) => item.type !== "group" && !item.binding)) {
    const value = Object.hasOwn(supplied, field.id) ? structuredClone(supplied[field.id]) : field.type === "record" ? {} : field.type === "list" ? [] : field.type === "number" ? (field.min ?? 0) : field.type === "boolean" ? false : field.type === "choice" ? field.choices[0] : "";
    validateElementValue(field, value);
    values[field.id] = value;
  }
  const linkIds = new Set();
  const links = (source.links ?? []).map((link) => {
    const id = assertId(link.id, "link id");
    if (linkIds.has(id)) throw new Error("duplicate object link id"); linkIds.add(id);
    const mode = link.mode ?? "reference";
    if (!["owned", "reference"].includes(mode)) throw new Error("invalid object link mode");
    return { id, label: String(link.label ?? ""), ref: normalizeRef(link.ref), mode, enabled: link.enabled !== false };
  });
  return { elements: definitions, values, links };
}

export function flattenElements(elements) {
  return elements.flatMap((element) => element.type === "group" ? [element, ...flattenElements(element.elements)] : [element]);
}

export function validateElementValue(field, value) {
  if (["record", "list"].includes(field.type)) {
    if (!value || typeof value !== "object" || (field.type === "list") !== Array.isArray(value)) throw new Error(`invalid collection for ${field.id}`);
    let count = 0;
    function validate(node, depth = 0) { if (++count > 2000 || depth > 12) throw new Error("collection exceeds limits"); if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) { if (FORBIDDEN_KEYS.has(key)) throw new Error("unsafe collection key"); validate(child, depth + 1); } else if (node !== null && !["string", "number", "boolean"].includes(typeof node) || typeof node === "number" && !Number.isFinite(node)) throw new Error("invalid collection value"); }
    validate(value);
  } else if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || field.min !== null && value < field.min || field.max !== null && value > field.max) throw new Error(`invalid number value for ${field.id}`);
  } else if (field.type === "boolean") {
    if (typeof value !== "boolean") throw new Error(`invalid boolean value for ${field.id}`);
  } else if (typeof value !== "string" || field.type === "choice" && !field.choices.includes(value)) throw new Error(`invalid text/choice value for ${field.id}`);
  return value;
}

export function pointerRead(root, path) {
  let node = root;
  for (const part of path.slice(1).split("/").map((value) => value.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (!node || typeof node !== "object" || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return node;
}
