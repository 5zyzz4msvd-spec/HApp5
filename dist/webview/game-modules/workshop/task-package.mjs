import { assertObjectId, isPlainObject, normalizeTask } from "../object-manager/contracts.mjs";

export async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function normalizeTaskSubmission(raw) {
  if (!isPlainObject(raw) || Object.keys(raw).some((key) => !["name", "targetCharacterId", "definition"].includes(key))) throw new Error("unsupported workshop task fields");
  const targetCharacterId = assertObjectId(raw.targetCharacterId, "target character id");
  const name = String(raw.name ?? "").trim();
  if (!name || name.length > 120) throw new Error("task title must contain 1–120 characters");
  const definition = raw.definition;
  if (!isPlainObject(definition) || Object.keys(definition).some((key) => !["description", "completion", "rewards"].includes(key))) throw new Error("invalid task definition");
  if (!isPlainObject(definition.completion) || Object.keys(definition.completion).some((key) => !["mode", "text", "when"].includes(key))) throw new Error("invalid completion definition");
  const normalized = normalizeTask({ kind: "task", id: "workshop-template", name, owner: { kind: "character", id: targetCharacterId }, definition });
  if (!normalized.definition.description || !normalized.definition.completion.text) throw new Error("task description and completion text are required");
  const rewards = normalized.definition.rewards;
  if (Object.keys(rewards).some((key) => !["items"].includes(key))) throw new Error("unsupported reward type");
  if (rewards.items !== undefined && (!Array.isArray(rewards.items) || rewards.items.length > 20)) throw new Error("invalid reward items");
  const items = (rewards.items ?? []).map((item) => {
    if (!isPlainObject(item) || Object.keys(item).some((key) => !["name", "description", "quantity"].includes(key))) throw new Error("invalid reward item");
    if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new Error("invalid reward item fields");
    return { name: item.name.trim(), description: String(item.description ?? ""), quantity: item.quantity };
  });
  const task = { name, targetCharacterId, definition: { ...normalized.definition, rewards: { items } } };
  const text = JSON.stringify(task);
  if (text.length > 32000 || /<%|<\/?script\b/i.test(text)) throw new Error("workshop tasks must be bounded data, not executable templates");
  return task;
}

export async function validateApprovedTaskPackage(raw) {
  if (raw?.schema !== 1 || raw?.reviewStatus !== "approved" || !Number.isInteger(raw.revision) || raw.revision < 1) throw new Error("only administrator-approved task revisions may be imported");
  const id = assertObjectId(raw.id, "workshop package id");
  const task = normalizeTaskSubmission(raw.task);
  const expected = await sha256({ id, revision: raw.revision, task });
  if (raw.contentHash !== expected) throw new Error("workshop task hash mismatch");
  return { schema: 1, id, revision: raw.revision, reviewStatus: "approved", contentHash: expected, task };
}
