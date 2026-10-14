import {hasTavernContext,readTavernChatId} from "./tavern-context.mjs";
import { ObjectManagerRuntime } from "./runtime.mjs";
import { ChatObjectStore, createBrowserFileDriver } from "./store.mjs";
import { TavernChatWorldbookAdapter, resolveTavernWorldbookApi } from "./worldbook-host.mjs";
import {readHostPersonnelPermissions} from './personnel-permissions.mjs';
import {installLocationHypnosisHooks,registerLocationHypnosisUserMessage} from './location-hypnosis.mjs';

function candidateViews(start = globalThis) {
  const views = [];
  for (const view of [start, start?.parent, start?.top]) {
    try { if (view && !views.includes(view)) views.push(view); } catch {}
  }
  return views;
}

function resolveHost(start = globalThis) {
  for (const view of candidateViews(start).reverse()) {
    try {
      if (hasTavernContext(view)) return view;
    } catch {}
  }
  throw new Error("SillyTavern host is unavailable");
}

function bindEvent(host, eventName, listener) {
  if (!eventName || typeof host.eventOn !== "function") return () => {};
  const result = host.eventOn(eventName, listener);
  if (typeof result === "function") return result;
  if (typeof result?.stop === "function") return () => result.stop();
  return () => { try { host.eventRemoveListener?.(eventName, listener); } catch {} };
}

function latestUserAnchor(host, messageId) {
  const chat = host?.SillyTavern?.getContext?.()?.chat ?? host?.SillyTavern?.chat ?? [];
  for (let index = Math.min(Number(messageId) - 1, chat.length - 1); index >= 0; index -= 1) {
    const message = chat[index];
    if (message?.is_user === true || message?.role === "user") return `user-${index}`;
  }
  return `user-before-${messageId}`;
}

function assistantSnapshot(host, messageId) {
  const id = Number(messageId);
  const chat = host?.SillyTavern?.getContext?.()?.chat ?? host?.SillyTavern?.chat ?? [];
  const message = chat[id];
  if (!message || message.is_user === true || message.role === "user" || message.is_system === true || message.role === "system") return null;
  const swipeId = Number(message.swipe_id ?? 0);
  const content = Array.isArray(message.swipes) ? message.swipes[swipeId] : message.mes ?? message.message ?? "";
  return {
    messageId: id,
    swipeId,
    content: String(content ?? ""),
    replyAnchor: `assistant-${id}-swipe-${swipeId}`,
    floorKey: `assistant-${id}`,
    replyOrdinal: chat.slice(0, id + 1).filter((item) => item && !item.is_user && item.role !== "user" && !item.is_system && item.role !== "system").length,
    promptAnchor: latestUserAnchor(host, id),
  };
}

export async function createObjectManagerForCurrentChat({
  start = globalThis,
  allowIndexedDbFallback = false,
  maxCheckpoints = 3,
  promptAnchor = "",
  workshopClient = null,
  fileDriver = null,
} = {}) {
  const host = resolveHost(start);
  const chatId = String(readTavernChatId(host) ?? "").trim();
  if (!chatId) throw new Error("current chat id is unavailable");
  const driver = fileDriver ?? await createBrowserFileDriver({
    navigatorObject: host.navigator,
    indexedDBObject: host.indexedDB,
    allowIndexedDbFallback,
  });
  const store = new ChatObjectStore({ driver, chatId, maxCheckpoints });
  const api = resolveTavernWorldbookApi(start) ?? resolveTavernWorldbookApi(host);
  if (!api) throw new Error("Tavern Helper chat-worldbook API is unavailable");
  const worldbookAdapter = new TavernChatWorldbookAdapter({ api, chatKey: store.chatKey });
  const runtime = new ObjectManagerRuntime({
    store,
    worldbookAdapter,
    workshopClient,
    personnelPermissionSource:()=>readHostPersonnelPermissions(host),
  });
  await runtime.init({ promptAnchor });
  installLocationHypnosisHooks(runtime,start);
  // Catch up the floor clock without replaying historical output into HEAD.
  const chat = host.SillyTavern.getContext?.()?.chat ?? host.SillyTavern.chat ?? [];
  const snapshots = chat.map((_item, index) => assistantSnapshot(host, index)).filter(Boolean);
  const cursor = (await store.readJson("meta.json")).lastReplyOrdinal ?? 0;
  for (const snapshot of snapshots.slice(-3).filter((item) => item.replyOrdinal > cursor)) await runtime.observeReply({ ...snapshot, source: "history-clock" });
  return { host, chatId, runtime };
}

export async function installObjectManagerLifecycle(options = {}) {
  const host = resolveHost(options.start ?? globalThis);
  const eventHost = typeof options.start?.eventOn === "function" ? options.start : typeof globalThis.eventOn === "function" ? globalThis : host;
  const globalKey = "__HYPNOOS_OBJECT_MANAGER_V1__";
  try { await host[globalKey]?.destroy?.(); } catch {}
  let active = null;
  let generation = 0;
  const disposers = [];
  let facade = null;
  let messageQueue = Promise.resolve();
  const extraRequests = new Map();
  const automaticExtraAttempts = new Set();
  const extraKey = (snapshot, chatId) => JSON.stringify([generation, chatId, snapshot.replyAnchor, snapshot.content]);

  const transition = () => {
    const token = ++generation;
    extraRequests.clear();
    automaticExtraAttempts.clear();
    void active?.runtime?.__personnelHooks?.destroy?.();
    active?.runtime?.__locationHypnosisHooks?.destroy?.();
    const task = createObjectManagerForCurrentChat(options).then(async (next) => {
      if (token !== generation) return active;
      await options.prepareRuntime?.(next.runtime);
      if (token !== generation) return active;
      active = next;
      facade.chatId = next.chatId;
      facade.runtime = next.runtime;
      return next;
    });
    if (facade) facade.ready = task;
    return task;
  };

  const handleMessage = async (messageId, source = "model") => {
    const chatIdAtRead = String(readTavernChatId(host) ?? "");
    const snapshot = assistantSnapshot(host, messageId);
    if (!snapshot) return { applied: 0, skipped: 0 };
    if (!active || active.chatId !== String(readTavernChatId(host) ?? "")) await transition();
    if (active.chatId !== chatIdAtRead) throw new Error("chat changed before reply processing");
    const chat = host.SillyTavern.getContext?.()?.chat ?? host.SillyTavern.chat ?? [];
    const cursor = (await active.runtime.store.readJson("meta.json")).lastReplyOrdinal ?? 0;
    for (let id = 0; id < snapshot.messageId; id += 1) {
      const prior = assistantSnapshot(host, id);
      if (prior && prior.replyOrdinal > cursor) await active.runtime.observeReply({ ...prior, source: "history-clock" });
    }
    const userIndex=Number(snapshot.promptAnchor.replace(/^user-/,''));
    if(Number.isInteger(userIndex)&&chat[userIndex])await registerLocationHypnosisUserMessage(active.runtime,chat[userIndex],{promptAnchor:snapshot.promptAnchor});
    const result = await active.runtime.handleModelOutput(snapshot.content, {
      ...snapshot,
      promptAnchor: snapshot.promptAnchor,
      source,
    });
    if (active.runtime.afterBusinessOutput) await active.runtime.afterBusinessOutput(snapshot);
    else if (active.runtime.personnelService) await active.runtime.personnelService.tick();
    return result;
  };

  const events = eventHost.tavern_events ?? host.tavern_events ?? {};
  const scheduleHandle = (payload, source) => {
    const messageId = typeof payload === "object" && payload !== null ? payload.message_id ?? payload.messageId : payload;
    if (!Number.isInteger(Number(messageId))) return;
    messageQueue = messageQueue.then(() => handleMessage(Number(messageId), source)).catch((error) => console.error("[HypnoOS Object Manager] output handling failed", error));
  };
  disposers.push(bindEvent(eventHost, events.MESSAGE_RECEIVED ?? "message_received", (messageId) => scheduleHandle(messageId, "model")));
  disposers.push(bindEvent(eventHost, events.MESSAGE_UPDATED ?? "message_updated", (messageId) => scheduleHandle(messageId, "model-update")));
  disposers.push(bindEvent(eventHost, events.MESSAGE_SWIPED ?? "message_swiped", (messageId) => scheduleHandle(messageId, "swipe")));
  if (typeof options.generateUpdate === "function") disposers.push(bindEvent(eventHost, events.GENERATION_ENDED ?? "generation_ended", () => {
    messageQueue = messageQueue.then(async () => {
      await facade.ready;
      if (facade.runtime.updateMode !== "extra") return;
      const chat = host.SillyTavern.getContext?.()?.chat ?? host.SillyTavern.chat ?? [];
      for (let id = chat.length - 1; id >= 0; id -= 1) {
        const snapshot = assistantSnapshot(host, id);
        if (!snapshot) continue;
        const key = extraKey(snapshot, facade.chatId);
        // Nested update-model generation events must not schedule themselves.
        if (automaticExtraAttempts.has(key)) break;
        automaticExtraAttempts.add(key);
        while (automaticExtraAttempts.size > 32) automaticExtraAttempts.delete(automaticExtraAttempts.values().next().value);
        await facade.requestExtraUpdate(id, options.generateUpdate);
        break;
      }
    }).catch((error) => console.error("[HypnoOS Object Manager] independent extra update failed", error));
  }));
  disposers.push(bindEvent(eventHost, events.CHAT_CHANGED ?? "chat_id_changed", () => { void transition().catch((error) => console.error("[HypnoOS Object Manager] chat transition failed", error)); }));

  facade = {
    version: 1,
    chatId: "",
    runtime: null,
    ready: Promise.resolve(null),
    handleMessage,
    async applyExtraOutput(messageId, text) {
      await facade.ready;
      const snapshot = assistantSnapshot(host, messageId);
      if (!snapshot) throw new Error("extra output requires an existing AI floor");
      return facade.runtime.handleModelOutput(text, { ...snapshot, source: "extra" });
    },
    async requestExtraUpdate(messageId, generateUpdate) {
      await facade.ready;
      if (typeof generateUpdate !== "function") throw new Error("independent extra model transport is not configured");
      const snapshot = assistantSnapshot(host, messageId), chatId = facade.chatId;
      if (!snapshot) throw new Error("AI reply is missing");
      const key = extraKey(snapshot, chatId), existing = extraRequests.get(key);
      if (existing) return existing.promise;
      const runtime = facade.runtime, token = generation;
      const request = { settled: false, promise: null };
      request.promise = (async () => {
        const text = await generateUpdate(await runtime.buildUpdateRequest(snapshot.content));
        const current = assistantSnapshot(host, messageId);
        if (generation !== token || facade.runtime !== runtime || facade.chatId !== chatId || String(readTavernChatId(host) ?? '') !== chatId || current?.replyAnchor !== snapshot.replyAnchor || current?.content !== snapshot.content) {
          throw new Error('chat, reply or swipe changed while extra model was running');
        }
        return runtime.handleModelOutput(text, { ...snapshot, source: 'extra' });
      })();
      extraRequests.set(key, request);
      try {
        const result = await request.promise;
        request.settled = true;
        for (const [oldKey, oldRequest] of extraRequests) if (extraRequests.size > 32 && oldRequest.settled) extraRequests.delete(oldKey);
        return result;
      } catch (error) {
        if (extraRequests.get(key) === request) extraRequests.delete(key);
        throw error;
      }
    },
    async loadCharacter(slotId, characterId, config) { await facade.ready; return facade.runtime.loadCharacter(slotId, characterId, config); },
    async unloadCharacter(slotId) { await facade.ready; return facade.runtime.unloadCharacter(slotId); },
    async stageScheduleOverlap(userWindow, config) { await facade.ready; return facade.runtime.stageScheduleOverlap(userWindow, config); },
    async syncWorldbook() { await facade.ready; return facade.runtime.syncWorldbook(); },
    async setWorkshopEnabled(enabled) { await facade.ready; return facade.runtime.setWorkshopEnabled(enabled); },
    async listWorkshopTasks(characterId) { await facade.ready; return facade.runtime.listWorkshopTasks(characterId); },
    async importWorkshopTask(packageId, characterId) { await facade.ready; return facade.runtime.importWorkshopTask(packageId, characterId); },
    async saveCharacterChild(value) { await facade.ready; return facade.runtime.saveCharacterChild(value); },
    async acceptTask(taskId) { await facade.ready; return facade.runtime.acceptTask(taskId); },
    async cancelTask(taskId) { await facade.ready; return facade.runtime.cancelTask(taskId); },
    async completeTask(taskId, options) { await facade.ready; return facade.runtime.completeTask(taskId, options); },
    async destroy() {
      generation += 1;
      extraRequests.clear();
      automaticExtraAttempts.clear();
      await active?.runtime?.__personnelHooks?.destroy?.();
      active?.runtime?.__locationHypnosisHooks?.destroy?.();
      options.workshopClient?.disconnect?.();
      disposers.splice(0).forEach((dispose) => { try { dispose(); } catch {} });
      if (host[globalKey] === facade) delete host[globalKey];
    },
  };
  facade.ready = transition();
  host[globalKey] = facade;
  await facade.ready;
  return facade;
}
