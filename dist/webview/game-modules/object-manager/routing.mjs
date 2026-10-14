import { parseCommentRoute } from "./contracts.mjs";

// Prefix-compatible routing implemented here, without loading MagVarUpdate.
export function filterObjectAudience(entries, { mode = "follow", audience = "plot" } = {}) {
  if (!["follow", "extra"].includes(mode) || !["plot", "update"].includes(audience)) throw new Error("invalid object update routing");
  return entries.filter((entry) => {
    if (mode === "follow") return true;
    const route = entry.extra?.hypnoosObjectManager?.route ?? parseCommentRoute(entry.comment ?? entry.name);
    return route === "both" || route === "shared" || route === audience;
  });
}
