import { normalizeObject, refKey } from "./contracts.mjs";
import { deferredLocationTemplate } from './location-access.mjs';

export function objectEdges(raw) {
  const object = normalizeObject(raw), edges = [];
  const add = (label, ref, mode = "reference", source = "native") => { if (ref) edges.push({ id: `${source}:${label}:${refKey(ref)}`, label, ref, mode, source }); };
  if (object.kind === "character") {
    for (const ref of object.refs.achievements) add("成就", ref, "owned");
    for (const ref of object.refs.tasks) add("任务", ref, "owned");
    for (const ref of object.refs.favorEvents) add("好感事件", ref, "owned");
    add("独立日程", object.refs.schedule, "owned");
    for (const relation of object.relations) edges.push({ id: `relation:${relation.id}`, label: relation.type, ref: relation.target, mode: "reference", source: "relation", summary: relation.summary });
  } else if (object.kind === "location") {
    for (const ref of object.children) add("子地点", ref);
  } else if (object.kind === "schedule") {
    add("默认地点", object.defaultLocation);
    add("空日地点", object.emptyPolicy.location);
    add("空日事件", object.emptyPolicy.event);
    for (const [name, day] of [...Object.entries(object.days), ...Object.entries(object.holidays)]) {
      add(`${name} 默认地点`, day.defaultLocation);
      for (const entry of day.entries) { add(`${name}/${entry.id} 地点`, entry.location); add(`${name}/${entry.id} 事件`, entry.event); }
    }
  } else for (const ref of object.refs ?? []) add("关联对象", ref);
  for (const link of object.links) edges.push({ ...link, source: "link" });
  return edges;
}

export async function validateObjectGraph(root, resolve, { limit = 512 } = {}) {
  const visited = new Set(), stack = new Set();
  async function visit(ref, ownedPath) {
    const key = refKey(ref);
    const raw = await resolve(ref);
    if (!raw) throw new Error(`missing object reference: ${key}`);
    if (refKey(raw) !== key) throw new Error("object reference identity mismatch");
    if (ownedPath && stack.has(key)) throw new Error(`owned object cycle: ${key}`);
    if (visited.has(key)) return;
    if (visited.size >= limit) throw new Error(`object graph exceeds ${limit} objects`);
    visited.add(key); stack.add(key);
    for (const edge of objectEdges(raw)) {
      // Reference cycles (e.g. mutual friendships) are legal; owned edges are not.
      if (edge.mode === "owned") await visit(edge.ref, true);
      else { const target = await resolve(edge.ref); if (!target) throw new Error(`missing object reference: ${refKey(edge.ref)}`); }
    }
    stack.delete(key);
  }
  await visit(root, true);
  return [...visited];
}

export async function describeObjectStructure(root, resolve, { depth = 0, path = new Set(), maxDepth = 12, seen = new Set(), limit = 512 } = {}) {
  const object = await resolve(root);
  if (!object && deferredLocationTemplate(root)) return { ref: root, name: '未开放地点', kind: 'location', unavailable: true, children: [] };
  if (!object) throw new Error(`missing object: ${refKey(root)}`);
  const key = refKey(root);
  if (path.has(key) || seen.has(key)) return { ref: root, name: object.name, repeated: true };
  if (depth >= maxDepth || seen.size >= limit) return { ref: root, name: object.name, truncated: true };
  seen.add(key);
  const nextPath = new Set([...path, key]);
  const children = [];
  for (const edge of objectEdges(object)) children.push({ ...edge, node: await describeObjectStructure(edge.ref, resolve, { depth: depth + 1, path: nextPath, maxDepth, seen, limit }) });
  return { ref: root, name: object.name, kind: object.kind, elements: object.elements, values: object.values, children };
}

export async function ownedObjectScope(root, resolve, { activeTaskKeys = new Set() } = {}) {
  const result = [], seen = new Set();
  async function visit(ref, isRoot = false) {
    const key = refKey(ref);
    if (seen.has(key)) return;
    if (ref.kind === "task" && !activeTaskKeys.has(key)) return;
    if (!isRoot && ref.kind === "character") return; // child characters need their own slots
    if (!isRoot && ref.kind === "location") return; // location activation follows confirmed location
    const object = await resolve(ref);
    if (!object) throw new Error(`missing owned object: ${key}`);
    if (seen.size >= 512) throw new Error("owned scope exceeds 512 active objects");
    seen.add(key); result.push(normalizeObject(object));
    for (const edge of objectEdges(object)) if (edge.mode === "owned" && edge.enabled !== false) await visit(edge.ref);
  }
  await visit(root, true);
  return result;
}
