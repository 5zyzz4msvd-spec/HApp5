import { cloneValue } from "./contracts.mjs";
import { filterObjectAudience } from "./routing.mjs";

export function filterEntriesForMvuAudience(entries, { updateMethod = "extra", isExtraAnalysis = false } = {}) {
  return filterObjectAudience(Array.isArray(entries) ? entries : [], { mode: updateMethod, audience: isExtraAnalysis ? "update" : "plot" }).map(cloneValue);
}

export function extractLegacyJsonPatch(text) {
  const source = String(text ?? "");
  const wrappers = [...source.matchAll(/<UpdateVariable>\s*<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>\s*<\/UpdateVariable>/gi)];
  if (wrappers.length !== 1) return [];
  const parsed = JSON.parse(String(wrappers[0][1]).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
  return Array.isArray(parsed) ? parsed : [];
}
