import { cloneValue, normalizeRef } from "./contracts.mjs";

export class DurablePromptLedger {
  constructor(store) { this.store = store; }
  async list() { return this.store.readJson("prompts/hidden.json", []); }
  async upsert(record) {
    const value = {
      id: String(record.id ?? "").trim(),
      owner: normalizeRef(record.owner),
      route: ["plot", "update", "shared", "both"].includes(record.route) ? record.route : "shared",
      replyAnchor: String(record.replyAnchor ?? "").trim(),
      dependencies: Array.isArray(record.dependencies) ? record.dependencies.map((item) => normalizeRef(item)) : [],
      gate: record.gate ? cloneValue(record.gate) : null,
      content: String(record.content ?? "").trim(),
      enabled: record.enabled !== false,
      order: Number(record.order ?? 900),
      depth: Number(record.depth ?? 0),
      createdAt: record.createdAt ?? new Date().toISOString(),
      expiresAfterAnchor: record.expiresAfterAnchor ? String(record.expiresAfterAnchor) : null,
    };
    if (!value.id || !value.content || !value.replyAnchor) throw new Error("hidden prompt requires id, content and replyAnchor");
    const records = await this.list();
    const index = records.findIndex((item) => item.id === value.id);
    if (index >= 0) records[index] = value;
    else records.push(value);
    await this.store.writeJson("prompts/hidden.json", records);
    return cloneValue(value);
  }
  async activeFor(replyAnchor) {
    return (await this.list()).filter((item) => item.enabled !== false && item.replyAnchor === String(replyAnchor));
  }
  async remove(id) {
    const records = await this.list();
    const next = records.filter((item) => item.id !== id);
    await this.store.writeJson("prompts/hidden.json", next);
    return next.length !== records.length;
  }
  async pruneToAnchors(anchors) {
    const allowed = new Set(anchors.map(String));
    const records = await this.list();
    const next = records.filter((item) => allowed.has(item.replyAnchor));
    await this.store.writeJson("prompts/hidden.json", next);
    return records.length - next.length;
  }
}

export class EphemeralInjectionRegistry {
  constructor({ inject, uninject }) {
    this.inject = inject;
    this.uninject = uninject;
    this.records = new Map();
    this.installedIds = new Set();
    this.queue = Promise.resolve();
  }
  stage(record) {
    const id = String(record.id ?? "").trim();
    if (!id) throw new Error("injection id is required");
    this.records.set(id, cloneValue(record));
  }
  async installFor({ chatId, replyAnchor, audience }) {
    return this.run(() => this.install({ chatId, replyAnchor, audience }));
  }
  run(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  async install({ chatId, replyAnchor, audience }) {
    const records = [...this.records.values()].filter((record) =>
      String(record.chatId) === String(chatId)
      && String(record.replyAnchor) === String(replyAnchor)
      && (record.route === "shared" || record.route === "both" || record.route === audience)
    );
    const ids = records.map((record) => record.id);
    const remove = [...new Set([...this.installedIds, ...ids])];
    if (remove.length) await this.uninject(remove);
    this.installedIds.clear();
    if (records.length) {
      this.installedIds = new Set(ids);
      try { await this.inject(records.map((record) => ({
      id: record.id,
      position: record.position ?? "in_chat",
      depth: Number(record.depth ?? 0),
      role: record.role ?? "system",
      content: String(record.content),
      should_scan: record.shouldScan === true,
      }))); } catch (error) {
        try { await this.uninject(ids); this.installedIds.clear(); } catch {}
        throw error;
      }
    }
    return ids;
  }
  async clearAll() {
    return this.run(async () => {
      const ids = [...new Set([...this.records.keys(), ...this.installedIds])];
      if (ids.length) await this.uninject(ids);
      this.installedIds.clear();
      this.records.clear();
    });
  }
}
