// Declarative predicates only; object files cannot execute JavaScript.
const OPS = new Set(["eq", "ne", "gt", "gte", "lt", "lte", "exists", "includes"]);
const UNSAFE = new Set(["__proto__", "prototype", "constructor"]);

export function normalizeCondition(value, depth = 0) {
  if (value == null) return null;
  if (depth > 16 || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid condition");
  const groups = ["all", "any", "not"].filter((key) => Object.hasOwn(value, key));
  if (groups.length) {
    if (groups.length !== 1 || Object.keys(value).length !== 1) throw new Error("ambiguous condition");
    const key = groups[0];
    if (key === "not") {
      if (value.not == null) throw new Error("not requires a condition");
      return { not: normalizeCondition(value.not, depth + 1) };
    }
    if (!Array.isArray(value[key]) || !value[key].length || value[key].length > 64 || value[key].some((item) => item == null)) throw new Error("condition group requires 1–64 predicates");
    return { [key]: value[key].map((item) => normalizeCondition(item, depth + 1)) };
  }
  const path = String(value.path ?? "");
  if (!path.startsWith("/") || /~(?:[^01]|$)/.test(path)) throw new Error("invalid condition pointer");
  const segments = path.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (segments.some((part) => !part || UNSAFE.has(part))) throw new Error("unsafe condition path");
  if (!OPS.has(value.op)) throw new Error("unsupported condition operator");
  if (Object.keys(value).some((key) => !["path", "op", "value"].includes(key))) throw new Error("unknown condition field");
  if (value.op !== "exists" && !Object.hasOwn(value, "value")) throw new Error("condition requires value");
  return { path, op: value.op, ...(Object.hasOwn(value, "value") ? { value: structuredClone(value.value) } : {}) };
}

export function evaluateCondition(raw, context) {
  const condition = normalizeCondition(raw);
  if (!condition) return true;
  if (condition.all) return condition.all.every((item) => evaluateCondition(item, context));
  if (condition.any) return condition.any.some((item) => evaluateCondition(item, context));
  if (condition.not) return !evaluateCondition(condition.not, context);
  let actual = context;
  for (const part of condition.path.slice(1).split("/").map((item) => item.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (!actual || typeof actual !== "object" || !Object.hasOwn(actual, part)) { actual = undefined; break; }
    actual = actual[part];
  }
  if (condition.op === "exists") return (actual !== undefined) === (condition.value !== false);
  if (actual === undefined) return false;
  if (condition.op === "eq") return JSON.stringify(actual) === JSON.stringify(condition.value);
  if (condition.op === "ne") return JSON.stringify(actual) !== JSON.stringify(condition.value);
  if (condition.op === "includes") return Array.isArray(actual) && actual.some((item) => JSON.stringify(item) === JSON.stringify(condition.value));
  if (typeof actual !== "number" || !Number.isFinite(actual) || typeof condition.value !== "number" || !Number.isFinite(condition.value)) return false;
  return ({ gt: () => actual > condition.value, gte: () => actual >= condition.value, lt: () => actual < condition.value, lte: () => actual <= condition.value })[condition.op]();
}
