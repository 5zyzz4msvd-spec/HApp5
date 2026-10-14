// Fields explicitly supported by the installed Tavern Helper 4.9.3 adapter.
const IMPLICIT_DEFAULTS = { addMemo: true, matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false, matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false, group: "", groupOverride: false, groupWeight: 100, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: "", ignoreBudget: false, outletName: "", triggers: [], characterFilter: { isExclude: false, names: [], tags: [] } };
export function worldbookImplicitFields(entry) {
  return Object.fromEntries(Object.entries(IMPLICIT_DEFAULTS).map(([key, fallback]) => [key, structuredClone(Object.hasOwn(entry?.implicit ?? {}, key) ? entry.implicit[key] : Object.hasOwn(entry ?? {}, key) ? entry[key] : fallback)]));
}
export function worldbookRecursion(entry) {
  const delay = entry.recursion?.delay_until ?? entry.delayUntilRecursion;
  return { prevent_incoming: entry.recursion?.prevent_incoming ?? entry.excludeRecursion === true, prevent_outgoing: entry.recursion?.prevent_outgoing ?? entry.preventRecursion === true, delay_until: typeof delay === "number" && delay > 0 ? delay : null };
}
export function worldbookEffect(entry) {
  return Object.fromEntries(["sticky", "cooldown", "delay"].map((key) => {
    const value = entry.effect?.[key] ?? entry[key];
    return [key, typeof value === "number" && value > 0 ? value : null];
  }));
}
