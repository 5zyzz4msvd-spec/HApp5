import { cloneValue } from "./contracts.mjs";
import {
  isManagedWorldbookEntry,
  reconcileWorldbookEntries,
  toTavernHelperWorldbookEntry,
} from "./worldbook-projection.mjs";

function candidateViews(start = globalThis) {
  const views = [];
  for (const view of [start, start?.parent, start?.top]) {
    try { if (view && !views.includes(view)) views.push(view); } catch {}
  }
  return views;
}

function bindApi(view, name) {
  try { return typeof view?.[name] === "function" ? view[name].bind(view) : null; } catch { return null; }
}

export function resolveTavernWorldbookApi(start = globalThis) {
  for (const view of candidateViews(start)) {
    const api = {
      getChatWorldbookName: bindApi(view, "getChatWorldbookName"),
      getOrCreateChatWorldbook: bindApi(view, "getOrCreateChatWorldbook"),
      rebindChatWorldbook: bindApi(view, "rebindChatWorldbook"),
      getWorldbook: bindApi(view, "getWorldbook"),
      createWorldbook: bindApi(view, "createWorldbook"),
      updateWorldbookWith: bindApi(view, "updateWorldbookWith"),
    };
    if (api.getWorldbook && api.updateWorldbookWith && (api.getOrCreateChatWorldbook || (api.createWorldbook && api.rebindChatWorldbook))) {
      return api;
    }
  }
  return null;
}

function projectionKey(entry) {
  return entry?.extra?.hypnoosObjectManager?.projectionKey ?? entry?.extensions?.hypnoosObjectManager?.projectionKey ?? "";
}

export class TavernChatWorldbookAdapter {
  constructor({ api, chatKey, preferredName = "" }) {
    if (!api) throw new Error("worldbook API is required");
    this.api = api;
    this.chatKey = String(chatKey);
    this.preferredName = preferredName || `HypnoOS Objects · ${this.chatKey}`;
    this.worldbookName = "";
  }

  async ensure() {
    let name = this.api.getChatWorldbookName?.("current") ?? "";
    if (!name && this.api.getOrCreateChatWorldbook) name = await this.api.getOrCreateChatWorldbook("current", this.preferredName);
    if (!name) {
      await this.api.createWorldbook(this.preferredName, []);
      await this.api.rebindChatWorldbook("current", this.preferredName);
      name = this.preferredName;
    }
    this.worldbookName = String(name);
    return this.worldbookName;
  }

  async read() {
    const name = this.worldbookName || await this.ensure();
    return cloneValue(await this.api.getWorldbook(name));
  }

  async snapshot() { return { worldbookName: this.worldbookName || await this.ensure(), entries: await this.read() }; }

  async restore(snapshot) {
    const name = snapshot?.worldbookName || this.worldbookName || await this.ensure();
    const entries = cloneValue(snapshot?.entries ?? []);
    const result = await this.api.updateWorldbookWith(name, () => entries, { render: "immediate" });
    this.worldbookName = name;
    return result;
  }

  async sync(desiredEntries, { allowAdoptDrift = false } = {}) {
    const name = this.worldbookName || await this.ensure();
    let summary = null;
    const updated = await this.api.updateWorldbookWith(name, (current) => {
      summary = reconcileWorldbookEntries(current, desiredEntries, { chatKey: this.chatKey, allowAdoptDrift });
      return summary.entries.map((entry) => entry.comment === undefined ? entry : toTavernHelperWorldbookEntry(entry));
    }, { render: "immediate" });
    const expected = new Set(desiredEntries.map(projectionKey));
    const actual = new Set(updated.filter((entry) => isManagedWorldbookEntry(entry, this.chatKey)).map(projectionKey));
    if (expected.size !== actual.size || [...expected].some((key) => !actual.has(key))) throw new Error("managed worldbook readback mismatch");
    return { worldbookName: name, ...summary, entries: cloneValue(updated) };
  }
}
