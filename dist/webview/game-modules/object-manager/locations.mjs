import { normalizeLocation, normalizeRef, refKey } from "./contracts.mjs";
import { evaluateCondition } from "./conditions.mjs";

// References describe navigation, not automatic activation of descendant content.
export async function validateLocationGraph(root, resolveObject) {
  const visited = new Set();
  const visiting = new Set();
  const parents = new Map();
  async function visit(ref, parent = null) {
    const key = refKey(normalizeRef(ref, "location"));
    if (parent) { if (parents.has(key) && parents.get(key) !== parent) throw new Error(`location must have one parent: ${key}`); parents.set(key, parent); }
    if (visiting.has(key)) throw new Error(`location reference cycle: ${key}`);
    if (visited.has(key)) return;
    if (visited.size + visiting.size >= 512) throw new Error("location graph exceeds 512 objects");
    const raw = await resolveObject(ref);
    if (!raw) throw new Error(`missing location reference: ${key}`);
    const location = normalizeLocation(raw);
    if (refKey(location) !== key) throw new Error(`location reference identity mismatch: ${key}`);
    visiting.add(key);
    for (const child of location.children) await visit(child, key);
    visiting.delete(key);
    visited.add(key);
  }
  await visit(root);
  return [...visited];
}

export function locationForest(rawLocations) {
  const locations = rawLocations.map(normalizeLocation), byId = new Map(locations.map((item) => [item.id, item])), parentById = new Map();
  for (const parent of locations) for (const ref of parent.children) {
    if (!byId.has(ref.id)) throw new Error(`missing location reference: location:${ref.id}`);
    if (parentById.has(ref.id) && parentById.get(ref.id) !== parent.id) throw new Error(`location must have one parent: location:${ref.id}`);
    parentById.set(ref.id, parent.id);
  }
  const nodes = new Map();
  for (const location of locations) {
    const path = [], seen = new Set(); let current = location.id;
    while (current) { if (seen.has(current)) throw new Error(`location reference cycle: location:${current}`); seen.add(current); path.unshift(current); current = parentById.get(current); }
    nodes.set(location.id, { object: location, parent: parentById.get(location.id) ? { kind: "location", id: parentById.get(location.id) } : null, depth: path.length - 1, path: path.map((id) => ({ kind: "location", id })) });
  }
  return { nodes, roots: locations.filter((item) => !parentById.has(item.id)).map((item) => ({ kind: "location", id: item.id })), parentById };
}

export class LocationFeatureRegistry {
  constructor() { this.actions = new Map(); this.components = new Set(["action-button"]); }
  registerComponent(id) { this.components.add(String(id)); }
  registerAction(id, { when = null, buildPrompt } = {}) {
    if (this.actions.has(id) || typeof buildPrompt !== "function") throw new Error(`invalid or duplicate action: ${id}`);
    this.actions.set(id, { when, buildPrompt });
  }
  check(location, feature, context) {
    if (!feature.enabled) return { allowed: false, reason: "disabled" };
    if (!this.components.has(feature.component) || !this.actions.has(feature.action)) return { allowed: false, reason: "unregistered" };
    if (context.location?.id !== location.id || context.location?.kind !== "location") return { allowed: false, reason: "not-current-location" };
    if (!evaluateCondition(feature.when, context) || !evaluateCondition(this.actions.get(feature.action).when, context)) return { allowed: false, reason: "condition-not-met" };
    return { allowed: true, reason: "script-approved" };
  }
  async buildPrompt(location, feature, context) {
    const decision = this.check(location, feature, context);
    if (!decision.allowed) return decision;
    const content = String(await this.actions.get(feature.action).buildPrompt({ location, feature, context }) ?? "").trim();
    return { ...decision, content };
  }
}
