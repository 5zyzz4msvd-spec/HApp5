import { MAX_REPLY_CHECKPOINTS, cloneValue, normalizeObject, normalizeRef, refKey } from "./contracts.mjs";
import { applyObjectPatchEnvelope, normalizeObjectPatchEnvelope } from "./json-patch.mjs";
import { normalizeTaskSlots } from "./tasks.mjs";

function stableFolderHash(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value ?? "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function safeAnchor(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("reply anchor is required");
  return text.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 96) || stableFolderHash(text);
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export class MemoryFileDriver {
  constructor() { this.files = new Map(); }
  async readText(path) { return this.files.has(path) ? this.files.get(path) : null; }
  async writeTextAtomic(path, text) { this.files.set(path, String(text)); }
  async remove(path) { this.files.delete(path); }
  async readBlob(path) { const value = this.files.get(path); return value instanceof Blob ? value : null; }
  async writeBlobAtomic(path, blob) { this.files.set(path, blob.slice(0, blob.size, blob.type)); }
  async list(prefix = "") { return [...this.files.keys()].filter((key) => key.startsWith(prefix)).sort(); }
  async listTree(prefix = "") { return this.list(prefix); }
  describe() { return { kind: "memory", persistent: false }; }
}

async function opfsDirectory(root, segments, create) {
  let directory = root;
  for (const segment of segments) directory = await directory.getDirectoryHandle(segment, { create });
  return directory;
}

export class OpfsFileDriver {
  constructor(root) { this.root = root; }
  static async create(navigatorObject = globalThis.navigator) {
    const root = await navigatorObject?.storage?.getDirectory?.();
    if (!root) throw new Error("OPFS is unavailable");
    return new OpfsFileDriver(root);
  }
  async readText(path) {
    const segments = String(path).split("/").filter(Boolean);
    const filename = segments.pop();
    try {
      const directory = await opfsDirectory(this.root, segments, false);
      const handle = await directory.getFileHandle(filename, { create: false });
      return await (await handle.getFile()).text();
    } catch (error) {
      if (error?.name === "NotFoundError") return null;
      throw error;
    }
  }
  async writeTextAtomic(path, text) {
    const segments = String(path).split("/").filter(Boolean);
    const filename = segments.pop();
    const directory = await opfsDirectory(this.root, segments, true);
    const tempName = `.${filename}.${Date.now().toString(36)}.tmp`;
    const temp = await directory.getFileHandle(tempName, { create: true });
    const tempWriter = await temp.createWritable();
    await tempWriter.write(String(text));
    await tempWriter.close();
    const verified = await (await temp.getFile()).text();
    if (verified !== String(text)) throw new Error(`OPFS temp verification failed: ${path}`);
    const target = await directory.getFileHandle(filename, { create: true });
    const writer = await target.createWritable();
    await writer.write(verified);
    await writer.close();
    await directory.removeEntry(tempName);
  }
  async remove(path) {
    const segments = String(path).split("/").filter(Boolean);
    const filename = segments.pop();
    try { await (await opfsDirectory(this.root, segments, false)).removeEntry(filename); } catch (error) { if (error?.name !== "NotFoundError") throw error; }
  }
  async readBlob(path) {
    const segments = String(path).split("/").filter(Boolean), filename = segments.pop();
    try { return await (await (await opfsDirectory(this.root, segments, false)).getFileHandle(filename)).getFile(); }
    catch (error) { if (error?.name === "NotFoundError") return null; throw error; }
  }
  async writeBlobAtomic(path, blob) {
    const segments = String(path).split("/").filter(Boolean), filename = segments.pop();
    const directory = await opfsDirectory(this.root, segments, true);
    const writer = await (await directory.getFileHandle(filename, { create: true })).createWritable();
    try { await writer.write(blob); await writer.close(); } catch (error) { await writer.abort?.(); throw error; }
    if ((await this.readBlob(path)).size !== blob.size) throw new Error("image file verification failed");
  }
  async list(prefix = "") {
    const segments = String(prefix).split("/").filter(Boolean);
    let directory;
    try { directory = await opfsDirectory(this.root, segments, false); } catch (error) { if (error?.name === "NotFoundError") return []; throw error; }
    const output = [];
    for await (const [name, handle] of directory.entries()) if (handle.kind === "file") output.push(`${segments.join("/")}${segments.length ? "/" : ""}${name}`);
    return output.sort();
  }
  describe() { return { kind: "opfs", persistent: true }; }
  async listTree(prefix = "") {
    const segments = String(prefix).split("/").filter(Boolean);
    let directory;
    try { directory = await opfsDirectory(this.root, segments, false); } catch (error) { if (error?.name === "NotFoundError") return []; throw error; }
    const files = [];
    async function visit(handle, path) { for await (const [name, child] of handle.entries()) { if (name.startsWith(".")) continue; const full = `${path}/${name}`; if (child.kind === "directory") await visit(child, full); else files.push(full); } }
    await visit(directory, segments.join("/"));
    return files.sort();
  }
}

export class IndexedDbFileDriver {
  constructor(database) { this.database = database; }
  static async create(indexedDBObject = globalThis.indexedDB) {
    if (!indexedDBObject) throw new Error("IndexedDB is unavailable");
    const database = await new Promise((resolve, reject) => {
      const request = indexedDBObject.open("hypnoos-object-store-v1", 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files"); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new IndexedDbFileDriver(database);
  }
  request(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = this.database.transaction("files", mode);
      const result = action(tx.objectStore("files"));
      tx.oncomplete = () => resolve(result?.result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  }
  async readText(path) { return this.request("readonly", (store) => store.get(path)); }
  async writeTextAtomic(path, text) { await this.request("readwrite", (store) => store.put(String(text), path)); }
  async remove(path) { await this.request("readwrite", (store) => store.delete(path)); }
  async readBlob(path) { return this.request("readonly", (store) => store.get(path)); }
  async writeBlobAtomic(path, blob) { await this.request("readwrite", (store) => store.put(blob, path)); }
  async list(prefix = "") {
    const keys = await this.request("readonly", (store) => store.getAllKeys());
    return (keys ?? []).map(String).filter((key) => key.startsWith(prefix)).sort();
  }
  describe() { return { kind: "indexeddb-fallback", persistent: true }; }
  async listTree(prefix = "") { return this.list(prefix); }
}

export async function createBrowserFileDriver({ navigatorObject = globalThis.navigator, indexedDBObject = globalThis.indexedDB, allowIndexedDbFallback = false } = {}) {
  try { return await OpfsFileDriver.create(navigatorObject); } catch (opfsError) {
    if (!allowIndexedDbFallback) throw new Error(`OPFS unavailable and IndexedDB fallback disabled: ${opfsError}`);
    return IndexedDbFileDriver.create(indexedDBObject);
  }
}

export class ChatObjectStore {
  constructor({ driver, chatId, maxCheckpoints = MAX_REPLY_CHECKPOINTS }) {
    if (!driver) throw new Error("file driver is required");
    this.driver = driver;
    this.chatId = String(chatId ?? "").trim();
    if (!this.chatId) throw new Error("chatId is required");
    this.maxCheckpoints = Math.max(1, Math.min(MAX_REPLY_CHECKPOINTS, Math.trunc(Number(maxCheckpoints) || MAX_REPLY_CHECKPOINTS)));
    this.chatKey = `chat-${stableFolderHash(this.chatId)}`;
    this.root = `hypnoos-object-store/v1/chats/${this.chatKey}`;
  }

  path(relative) { return `${this.root}/${relative}`; }
  objectPath(ref) { const value = normalizeRef(ref); return this.path(`objects/${value.kind}/${value.id}.json`); }

  async readJson(relative, fallback = null) {
    const text = await this.driver.readText(this.path(relative));
    return text === null ? cloneValue(fallback) : JSON.parse(text);
  }
  async writeJson(relative, value) { await this.driver.writeTextAtomic(this.path(relative), jsonText(value)); }

  async init() {
    await this.recoverPendingWrite();
    const existing = await this.readJson("meta.json", null);
    const now = new Date().toISOString();
    const meta = existing ?? { schema: 1, chatId: this.chatId, chatKey: this.chatKey, createdAt: now, sequence: 0 };
    if (meta.schema !== 1 || meta.chatId !== this.chatId || meta.chatKey !== this.chatKey) throw new Error("chat object store metadata mismatch");
    meta.updatedAt = now;
    await this.writeJson("meta.json", meta);
    if ((await this.driver.readText(this.path("slots/characters.json"))) === null) await this.writeJson("slots/characters.json", []);
    if ((await this.driver.readText(this.path("slots/tasks.json"))) === null) await this.writeJson("slots/tasks.json", []);
    if ((await this.driver.readText(this.path("revisions/index.json"))) === null) await this.writeJson("revisions/index.json", []);
    return { chatKey: this.chatKey, driver: this.driver.describe() };
  }

  async getObject(ref) {
    const text = await this.driver.readText(this.objectPath(ref));
    if (text === null) return null;
    const object = normalizeObject(JSON.parse(text));
    if (refKey(object) !== refKey(ref)) throw new Error("stored object identity does not match its file reference");
    return object;
  }
  async putObject(value) {
    const object = normalizeObject(value);
    await this.driver.writeTextAtomic(this.objectPath(object), jsonText(object));
    return object;
  }
  async listObjects(kind) {
    const files = await this.driver.list(this.path(`objects/${kind}/`));
    const result = [];
    for (const file of files.filter((path) => path.endsWith(".json"))) result.push(normalizeObject(JSON.parse(await this.driver.readText(file))));
    return result;
  }
  async getCharacterSlots() { return this.readJson("slots/characters.json", []); }
  async getTaskSlots() { return normalizeTaskSlots(await this.readJson("slots/tasks.json", [])); }
  async setCharacterSlots(slots) {
    if (!Array.isArray(slots)) throw new Error("character slots must be an array");
    const normalized = slots.map((slot, index) => ({
      slotId: String(slot.slotId ?? `character-${index + 1}`).trim(),
      ref: normalizeRef(slot.ref, "character"),
      enabled: slot.enabled !== false,
      order: Number.isFinite(Number(slot.order)) ? Number(slot.order) : 100 - index,
    }));
    await this.writeJson("slots/characters.json", normalized);
    return normalized;
  }

  async checkpointIndex() { return this.readJson("revisions/index.json", []); }
  async exportFiles() {
    await this.recoverPendingWrite();
    const files = []; let size = 0;
    for (const path of await this.driver.listTree(this.root + "/")) {
      const value = path.endsWith(".json") ? new TextEncoder().encode(await this.driver.readText(path)) : new Uint8Array(await (await this.driver.readBlob(path)).arrayBuffer());
      size += value.length;
      if (size > 256 * 1024 * 1024) throw new Error("聊天素材超过 256 MiB，请分批备份");
      files.push({ name: `${this.chatKey}/${path.slice(this.root.length + 1)}`, bytes: value });
    }
    return files;
  }

  // Every AI reply advances the chat window, even with zero patches or slots.
  async observeReply({ replyAnchor, floorKey = replyAnchor, replyOrdinal = null, source = "model" }) {
    const anchor = safeAnchor(replyAnchor), floor = safeAnchor(floorKey);
    let index = await this.checkpointIndex(), meta = await this.readJson("meta.json");
    const last = index.at(-1);
    if (last && (last.floorKey ?? last.replyAnchor) === floor) {
      if (last.replyAnchor === anchor) return this.readJson(last.file);
      await this.rollback(1); // New swipe starts from this floor's before image.
      index = await this.checkpointIndex(); meta = await this.readJson("meta.json");
    } else if (index.some((item) => (item.floorKey ?? item.replyAnchor) === floor)) throw new Error("older reply requires explicit branch rollback");
    const ordinal = replyOrdinal == null ? Number(meta.lastReplyOrdinal ?? 0) + 1 : Number(replyOrdinal);
    if (!Number.isInteger(ordinal) || ordinal <= Number(meta.lastReplyOrdinal ?? 0)) throw new Error("reply floor is outside the retained window; HEAD will not be initialized or overwritten");
    meta.sequence = Number(meta.sequence ?? 0) + 1;
    const file = `revisions/${String(meta.sequence).padStart(8, "0")}-${anchor}.json`;
    const record = { schema: 1, file, sequence: meta.sequence, floorKey: floor, replyOrdinal: ordinal, replyAnchor: anchor, sources: [source], transactions: [], changes: [], fileChanges: [], createdAt: new Date().toISOString() };
    index.push({ sequence: meta.sequence, floorKey: floor, replyOrdinal: ordinal, replyAnchor: anchor, file });
    const writes = new Map([[file, record]]);
    while (index.length > this.maxCheckpoints) writes.set(index.shift().file, null);
    meta.lastReplyOrdinal = ordinal;
    writes.set("revisions/index.json", index); writes.set("meta.json", meta);
    await this.applyFileBatch(writes);
    return cloneValue(record);
  }

  async recoverPendingWrite() {
    const pending = await this.readJson("transactions/pending.json", null);
    if (!pending) return;
    if (pending.schema !== 1 || !Array.isArray(pending.writes)) throw new Error("invalid pending object transaction");
    if (pending.phase !== "committed") {
      for (const write of [...pending.writes].reverse()) {
        if (write.before === null) await this.driver.remove(this.path(write.path));
        else await this.driver.writeTextAtomic(this.path(write.path), write.before);
      }
    }
    await this.driver.remove(this.path("transactions/pending.json"));
  }

  // Write-ahead before images cover HEAD, history and metadata together. A crash
  // before the durable commit marker is rolled back on the next store init.
  async applyFileBatch(values) {
    await this.recoverPendingWrite();
    const writes = [];
    for (const [path, value] of values) writes.push({ path, before: await this.driver.readText(this.path(path)), after: value === null ? null : jsonText(value) });
    const journal = { schema: 1, phase: "prepared", writes };
    await this.writeJson("transactions/pending.json", journal);
    try {
      for (const write of writes) {
        if (write.after === null) await this.driver.remove(this.path(write.path));
        else await this.driver.writeTextAtomic(this.path(write.path), write.after);
      }
      await this.writeJson("transactions/pending.json", { ...journal, phase: "committed" });
    } catch (error) {
      await this.recoverPendingWrite();
      throw error;
    }
    // Cleanup failure does not turn a committed write into an apparent failure.
    try { await this.driver.remove(this.path("transactions/pending.json")); } catch {}
  }

  async hasTransaction(transactionId) {
    const id = String(transactionId ?? "").trim();
    if (!id) return false;
    for (const item of await this.checkpointIndex()) {
      const record = await this.readJson(item.file, null);
      if (record?.transactions?.includes(id)) return true;
    }
    return false;
  }

  async commitEnvelope(envelope, { replyAnchor, source = "follow", allowedKeys = null, transactionIds = null, extraFiles = new Map() } = {}) {
    const normalized = normalizeObjectPatchEnvelope(envelope);
    const anchor = safeAnchor(replyAnchor);
    const objectKeys = new Set(normalized.operations.map((operation) => refKey(operation.target)));
    const before = new Map();
    for (const operation of normalized.operations) {
      const key = refKey(operation.target);
      if (!before.has(key)) {
        const object = await this.getObject(operation.target);
        if (!object) throw new Error(`missing patch target: ${key}`);
        before.set(key, object);
      }
    }
    const result = applyObjectPatchEnvelope(before, normalized, allowedKeys);
    const changes = [...objectKeys].map((key) => ({ key, before: before.get(key), after: result.objects.get(key) }));
    const writes = new Map(changes.map((change) => [`objects/${change.after.kind}/${change.after.id}.json`, change.after]));
    const fileChanges = [];
    for (const [file, value] of extraFiles) {
      if (file !== "slots/tasks.json") throw new Error("unsupported model transaction sidecar");
      const after = normalizeTaskSlots(value);
      fileChanges.push({ file, before: await this.readJson(file, []), after });
      writes.set(file, after);
    }

    const meta = await this.readJson("meta.json");
    let index = await this.checkpointIndex();
    let record = index.length ? await this.readJson(index.at(-1).file, null) : null;
    if (record?.replyAnchor === anchor) {
      const merged = new Map(record.changes.map((change) => [change.key, change]));
      for (const change of changes) {
        const previous = merged.get(change.key);
        merged.set(change.key, { key: change.key, before: previous?.before ?? change.before, after: change.after });
      }
      record.changes = [...merged.values()];
      const mergedFiles = new Map((record.fileChanges ?? []).map((change) => [change.file, change]));
      for (const change of fileChanges) mergedFiles.set(change.file, { ...change, before: mergedFiles.get(change.file)?.before ?? change.before });
      record.fileChanges = [...mergedFiles.values()];
      record.sources = [...new Set([...(record.sources ?? []), source])];
      record.transactions = [...new Set([...(record.transactions ?? []), ...(transactionIds ?? [normalized.transactionId])])];
      record.updatedAt = new Date().toISOString();
      writes.set(record.file, record);
    } else {
      meta.sequence = Math.max(0, Math.trunc(Number(meta.sequence) || 0)) + 1;
      const file = `revisions/${String(meta.sequence).padStart(8, "0")}-${anchor}.json`;
      record = {
        schema: 1,
        file,
        sequence: meta.sequence,
        replyAnchor: anchor,
        sources: [source],
        transactions: [...new Set(transactionIds ?? [normalized.transactionId])],
        createdAt: new Date().toISOString(),
        changes,
        fileChanges,
      };
      writes.set(file, record);
      index.push({ sequence: record.sequence, replyAnchor: anchor, file });
      while (index.length > this.maxCheckpoints) {
        const removed = index.shift();
        writes.set(removed.file, null);
      }
      writes.set("revisions/index.json", index);
      meta.updatedAt = new Date().toISOString();
      writes.set("meta.json", meta);
    }
    await this.applyFileBatch(writes);
    return cloneValue(record);
  }

  async rollback(steps = 1) {
    const count = Math.max(1, Math.min(this.maxCheckpoints, Math.trunc(Number(steps) || 1)));
    const index = await this.checkpointIndex();
    if (index.length < count) throw new Error(`only ${index.length} reply checkpoint(s) are available`);
    const selected = index.slice(index.length - count).reverse();
    const writes = new Map();
    for (const item of selected) {
      const record = await this.readJson(item.file);
      for (const change of [...record.changes].reverse()) writes.set(`objects/${change.before.kind}/${change.before.id}.json`, change.before);
      for (const change of record.fileChanges ?? []) writes.set(change.file, change.before);
      writes.set(item.file, null);
    }
    writes.set("revisions/index.json", index.slice(0, index.length - count));
    const meta = await this.readJson("meta.json");
    meta.lastReplyOrdinal = index.at(index.length - count - 1)?.replyOrdinal ?? Math.max(0, Number(selected.at(-1)?.replyOrdinal ?? (await this.readJson(selected.at(-1).file)).replyOrdinal ?? 1) - 1);
    writes.set("meta.json", meta);
    await this.applyFileBatch(writes);
    return { rolledBack: selected.map((item) => item.replyAnchor), remaining: index.length - count };
  }
}
