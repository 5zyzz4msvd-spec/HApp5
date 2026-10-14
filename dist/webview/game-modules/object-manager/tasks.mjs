import { MAX_ACTIVE_TASKS, normalizeRef, normalizeTask, refKey } from "./contracts.mjs";

export function normalizeTaskSlots(value) {
  if (!Array.isArray(value) || value.length > MAX_ACTIVE_TASKS) throw new Error("at most 3 active tasks are allowed per chat");
  const seen = new Set();
  return value.map((slot) => {
    const ref = normalizeRef(slot.ref, "task");
    const owner = normalizeRef(slot.owner, "character");
    if (seen.has(refKey(ref))) throw new Error("duplicate active task");
    seen.add(refKey(ref));
    return { ref, owner, acceptedAt: String(slot.acceptedAt ?? "") };
  });
}

export async function resolveActiveTasks(slots, resolveObject, { characters = null } = {}) {
  const activeOwners = characters ? new Set(characters.map((item) => refKey(item))) : null;
  const results = [];
  for (const slot of normalizeTaskSlots(slots)) {
    const raw = await resolveObject(slot.ref);
    if (!raw) throw new Error(`active task file is missing: ${refKey(slot.ref)}`);
    const task = normalizeTask(raw);
    if (refKey(task.owner) !== refKey(slot.owner)) throw new Error("active task owner mismatch");
    const character = characters?.find((item) => item.id === slot.owner.id);
    if (character && !character.refs.tasks.some((ref) => refKey(ref) === refKey(slot.ref))) throw new Error("active task is not a child of its loaded owner");
    if (task.data.completed) continue;
    if (activeOwners && !activeOwners.has(refKey(slot.owner))) continue;
    results.push({ ...slot, task });
  }
  return results;
}

export function activeTaskModelEntry(task, ownerName = "") {
  const value = normalizeTask(task);
  return {
    id: "active-task-state",
    comment: `[active_task]${value.id}`,
    content: JSON.stringify({ task: { kind: "task", id: value.id }, owner: value.owner, ownerName, name: value.name, definition: value.definition, data: { completed: value.data.completed, progress: value.data.progress }, writable: value.definition.completion.mode === "script" ? ["/data/progress/<leaf>"] : ["/data/progress/<leaf>", "replace /data/completed=true"] }),
    constant: true, order: 850, position: 4, depth: 0, role: 0,
  };
}
