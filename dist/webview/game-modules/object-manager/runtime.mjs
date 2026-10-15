import { OBJECT_KINDS, characterReachableRefs, normalizeCharacter, normalizeLocation, normalizeObject, normalizeRef, normalizeTask, refKey } from "./contracts.mjs";
import { normalizeTaskSlots, resolveActiveTasks } from "./tasks.mjs";
import { objectEdges, validateObjectGraph, ownedObjectScope } from "./object-graph.mjs";
import { flattenElements, validateElementValue } from "./structure-schema.mjs";
import { exposedElementValues } from "./structure-projection.mjs";
import { sha256, validateApprovedTaskPackage } from "../workshop/task-package.mjs";
import { LocationFeatureRegistry, validateLocationGraph, locationForest } from "./locations.mjs";
import { availableLocations, deferredLocationTemplate, retainHiddenLocationChildren } from './location-access.mjs';
import { personnelPermissions, UNKNOWN_PERSONNEL_PERMISSIONS } from './personnel-permissions.mjs';
import { normalizeLocationBoard, swapLocationBoard } from "./board-schema.mjs";
import { applyObjectPatchEnvelope, normalizeObjectPatchEnvelope, parseObjectUpdateBlocks } from "./json-patch.mjs";
import { DurablePromptLedger } from "./prompt-ledger.mjs";
import {LOCATION_HYPNOSIS_FIELD_ID,locationHypnosisProjectionState,locationHypnosisAuthorizations,authorizedLocationIds,validateLocationHypnosisUpdate,guardLocationHypnosisCharacterWrite} from './location-hypnosis.mjs';
import { collectCharacterScheduleIntersections, scheduleIntersectionsToHiddenPrompts } from "./schedule.mjs";
import { projectActiveCharacters } from "./worldbook-projection.mjs";
import { saveObjectImage, readObjectImage } from "./assets.mjs";
import { filterObjectAudience } from "./routing.mjs";
import {ensureCharacterCash,retainCharacterCashState} from './character-cash.mjs';
import {ensureCharacterClothing} from './character-clothing.mjs';

export class ObjectManagerRuntime {
  constructor({ store, worldbookAdapter, featureRegistry = new LocationFeatureRegistry(), workshopClient = null, rewardAccount = null,personnelPermissionSource=null }) {
    if (!store || !worldbookAdapter) throw new Error("store and worldbookAdapter are required");
    this.store = store;
    this.worldbook = worldbookAdapter;
    this.ledger = new DurablePromptLedger(store);
    this.promptAnchor = "";
    this.featureRegistry = featureRegistry;
    this.workshopClient = workshopClient;
    this.rewardAccount = rewardAccount;
    this.locationContext = { location: null, state: {} };
    this.personnelPermissionState={...UNKNOWN_PERSONNEL_PERMISSIONS};this.personnelPermissionSource=typeof personnelPermissionSource==='function'?personnelPermissionSource:null;this._permissionEpoch=0;
    this._queue = Promise.resolve();
    for (const name of ["loadCharacter", "unloadCharacter", "handleModelOutput", "stageScheduleOverlap", "setLocationContext", "stageLocationFeature", "saveCharacterChild", "acceptTask", "cancelTask", "completeTask", "recordRewardClaim", "setWorkshopEnabled", "importWorkshopTask", "saveCharacterDefinition", "saveLocationDefinition", "evaluateChildConditions", "settleChildReward", "saveObjectDefinition", "attachChildObject", "createChildObject", "removeObjectLink", "setElementValue", "saveCharacterRelation", "personnelTransaction", "addImage", "removeImage", "saveProfileValues", "observeReply", "rollbackReplies", "setUpdateMode", "insertLocationParent", "moveLocation", "setLocationBoard", "swapLocationCells", "saveLocationBatch"]) {
      const implementation = this[name].bind(this);
      this[name] = (...args) => {
        const result = this._queue.then(() => implementation(...args));
        this._queue = result.catch(() => {});
        return result;
      };
    }
  }

  async init({ promptAnchor = "" } = {}) {
    await this.store.init();
    await this.worldbook.ensure();
    this.promptAnchor = String(promptAnchor ?? "");
    this.personnelPolicy = await this.store.readJson("settings/personnel.json", null);
    this.locationContext = await this.store.readJson("context/location.json", { location: null, state: {} });
    this.updateMode = (await this.store.readJson("settings/runtime.json", { updateMode: "follow" })).updateMode;
    await this.refreshPersonnelPermissions();
    await this.syncWorldbook();
    return { chatKey: this.store.chatKey, worldbookName: this.worldbook.worldbookName, driver: this.store.driver.describe() };
  }

  async activeCharacters(slotsOverride = null) {
    const permissions=await this.resolvePersonnelPermissions();
    const slots = slotsOverride ?? await this.store.getCharacterSlots();
    const enabled = slots.filter((slot) => slot.enabled !== false).sort((left, right) => Number(right.order ?? 0) - Number(left.order ?? 0));
    const characters = [];
    for (const slot of enabled) {
      const value = await this.store.getObject(slot.ref);
      if (!value) throw new Error(`loaded character is missing: ${refKey(slot.ref)}`);
      if (slotEligible(value)&&personnelPermissions(value,permissions).slot) characters.push(normalizeCharacter(value));
    }
    return characters;
  }

  async writableKeys(characters = null, {promptAnchor=this.promptAnchor}={}) {
    const permissions=await this.resolvePersonnelPermissions();
    const result = new Set();
    const activeTaskKeys = new Set((await this.store.getTaskSlots()).map((slot) => refKey(slot.ref)));
    const active=(characters ?? await this.activeCharacters()).filter(x=>slotEligible(x)&&personnelPermissions(x,permissions).slot);
    for (const character of active) {
      result.add(refKey({ kind: "character", id: character.id }));
      for (const ref of characterReachableRefs(character)) {
        if (ref.kind === "favor-event" && !this.personnelPolicy?.fileAffinityEvents && !(await this.store.getObject(ref))?.data.sourceDefinition) result.add(refKey(ref));
        if (ref.kind === "achievement") {
          const achievement = await this.store.getObject(ref);
          if (!achievement || refKey(achievement.owner) !== refKey(character)) throw new Error("achievement owner mismatch");
          if (!achievement.data.completed) result.add(refKey(ref));
        }
      }
      for (const object of await ownedObjectScope(character, (ref) => this.store.getObject(ref), { activeTaskKeys })) if (!(this.personnelPolicy?.fileAffinityEvents && object.kind === "favor-event") && exposedElementValues(object, { ...this.locationContext, personnelPolicy: this.personnelPolicy }).some((field) => field.writable)) result.add(refKey(object));
    }
    for (const slot of await resolveActiveTasks(await this.store.getTaskSlots(), (ref) => this.store.getObject(ref), { characters:active })) result.add(refKey(slot.ref));
    for (const id of authorizedLocationIds(await locationHypnosisAuthorizations(this),promptAnchor)) if((await this.availableLocations()).some(place=>place.id===id)) result.add(refKey({kind:'location',id}));
    return result;
  }

  async projection({ characters = null, objectOverrides = new Map(), promptAnchor = this.promptAnchor, taskSlotsOverride = null } = {}) {
    const permissions=await this.resolvePersonnelPermissions();
    const active = (characters ?? await this.activeCharacters()).filter(x=>slotEligible(x)&&personnelPermissions(x,permissions).slot);
    const resolveObject = async (ref) => objectOverrides.get(refKey(ref)) ?? await this.store.getObject(ref);
    const activeKeys = new Set(active.map((character) => refKey({ kind: "character", id: character.id })));
    const activeTasks = await resolveActiveTasks(taskSlotsOverride ?? await this.store.getTaskSlots(), resolveObject, { characters: active });
    const locationState=await locationHypnosisProjectionState(this,{promptAnchor,objectOverrides});
    const locations = locationState.locations.map(normalizeLocation);
    if (this.locationContext.location) {
      const location = (await this.availableLocations()).find(x => x.id === this.locationContext.location.id);
      if (location) { if(!locations.some(x=>x.id===location.id))locations.push(normalizeLocation(objectOverrides.get(refKey(location))??location)); activeKeys.add(refKey(this.locationContext.location)); }
    }
    const hiddenPrompts = promptAnchor
      ? (await this.ledger.activeFor(promptAnchor)).filter((prompt) => (prompt.dependencies ?? []).every((ref) => activeKeys.has(refKey(ref))))
      : [];
    const approvedPrompts = hiddenPrompts.filter((prompt) => {
      if (prompt.gate?.type !== "location-feature") return true;
      const location = locations.find((item) => item.id === prompt.owner.id);
      const feature = location?.features.find((item) => item.id === prompt.gate.featureId);
      return Boolean(feature && this.featureRegistry.check(location, feature, this.locationContext).allowed);
    });
    const allCharacters = (await this.store.listObjects("character")).map((object) => objectOverrides.get(refKey(object)) ?? object);
    for (const object of objectOverrides.values()) if (object.kind === "character" && !allCharacters.some(item => item.id === object.id)) allCharacters.push(object);
    return projectActiveCharacters({ chatKey: this.store.chatKey, characters: active, allCharacters, resolveObject, hiddenPrompts: approvedPrompts, locations, context: { ...this.locationContext, personnelPolicy: this.personnelPolicy,locationHypnosisWithin:locationState.within,locationHypnosisWritableIds:locationState.writableIds }, activeTaskRefs: activeTasks.map((item) => item.ref) });
  }

  async syncWorldbook(options = {}) {
    const desired = await this.projection(options);
    return this.worldbook.sync(filterObjectAudience(desired, { mode: this.updateMode, audience: "plot" }));
  }

  async setUpdateMode(mode) {
    if (!["follow", "extra"].includes(mode)) throw new Error("invalid update mode");
    const before = this.updateMode; this.updateMode = mode;
    try { await this.syncWorldbook(); await this.store.writeJson("settings/runtime.json", { updateMode: mode }); }
    catch (error) { this.updateMode = before; await this.syncWorldbook(); throw error; }
  }
  async buildUpdateRequest(plotText) {
    const entries = filterObjectAudience(await this.projection(), { mode: "extra", audience: "update" });
    return { chatKey: this.store.chatKey, messages: [{ role: "system", content: entries.map((entry) => entry.content).join("\n\n") }, { role: "user", content: String(plotText) }], entries };
  }

  async loadCharacter(slotId, characterId, { order = 100 } = {}) {
    const ref = { kind: "character", id: characterId };
    const character = await this.store.getObject(ref);
    if (!character) throw new Error(`character does not exist: ${characterId}`);
    const permissions=personnelPermissions(character,await this.resolvePersonnelPermissions());if(!permissions.slot)throw Error(permissions.reason);
    if (!slotEligible(character)) throw new Error("物色完成后才能装入卡槽");
    const beforeSlots = await this.store.getCharacterSlots();
    const nextSlots = beforeSlots.filter((slot) => slot.slotId !== slotId && refKey(slot.ref) !== refKey(ref));
    nextSlots.push({ slotId, ref, enabled: true, order });
    const snapshot = await this.worldbook.snapshot();
    try {
      await this.store.setCharacterSlots(nextSlots);
      await this.syncWorldbook({ characters: await this.activeCharacters(nextSlots) });
      return nextSlots;
    } catch (error) {
      await this.store.setCharacterSlots(beforeSlots);
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  async unloadCharacter(slotId) {
    const beforeSlots = await this.store.getCharacterSlots();
    const nextSlots = beforeSlots.filter((slot) => slot.slotId !== slotId);
    const snapshot = await this.worldbook.snapshot();
    try {
      await this.store.setCharacterSlots(nextSlots);
      await this.syncWorldbook({ characters: await this.activeCharacters(nextSlots) });
      return nextSlots;
    } catch (error) {
      await this.store.setCharacterSlots(beforeSlots);
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  async handleModelOutput(text, { replyAnchor, floorKey = replyAnchor, replyOrdinal = null, source = "follow", promptAnchor = this.promptAnchor } = {}) {
    await this.store.observeReply({ replyAnchor, floorKey, replyOrdinal, source });
    // A swipe can roll back values even when its replacement has no commands.
    await this.syncWorldbook();
    const envelopes = parseObjectUpdateBlocks(text, { transactionPrefix: replyAnchor });
    if (envelopes.length === 0) return { applied: 0, skipped: 0 };
    const unseen = [];
    for (const envelope of envelopes) if (!(await this.store.hasTransaction(envelope.transactionId))) unseen.push(envelope);
    if (!unseen.length) return { applied: 0, skipped: envelopes.length };
    const merged = normalizeObjectPatchEnvelope({
      schema: 1,
      transaction_id: unseen.map((item) => item.transactionId).join("+"),
      operations: unseen.flatMap((item) => item.operations),
    });
    const active = await this.activeCharacters();
    const allowed = await this.writableKeys(active,{promptAnchor});
    const locationAuth=await locationHypnosisAuthorizations(this);
    const baselines = new Map();
    for (const operation of merged.operations) {
      const key = refKey(operation.target);
      if (!baselines.has(key)) {
        const value = await this.store.getObject(operation.target);
        if (!value) throw new Error(`missing patch target: ${key}`);
        baselines.set(key, value);
      }
    }
    const candidate = applyObjectPatchEnvelope(baselines, merged, allowed).objects;
    for (const operation of merged.operations) {
      const baseline = baselines.get(refKey(operation.target));
      if(baseline.kind==='character')guardLocationHypnosisCharacterWrite(operation,baseline,locationAuth,promptAnchor);
      if(baseline.kind==='location'&&authorizedLocationIds(locationAuth,promptAnchor).includes(baseline.id)){
        if(operation.path!=='/values/'+LOCATION_HYPNOSIS_FIELD_ID||operation.op!=='replace')throw new Error('地点催眠仅授权该地点催眠记录属性');
        validateLocationHypnosisUpdate(baseline,candidate.get(refKey(baseline)),locationAuth,promptAnchor);
      }else if(baseline.kind==='location'&&operation.path==='/values/'+LOCATION_HYPNOSIS_FIELD_ID)throw new Error('地点催眠本轮未发送授权');
      if (operation.path.startsWith("/values/")) {
        const id = operation.path.slice("/values/".length);
        if (!exposedElementValues(baseline, { ...this.locationContext, personnelPolicy: this.personnelPolicy }).some((field) => field.id === id && field.writable)) throw new Error("element condition denied model update");
      } else if (baseline.kind === "character" && baseline.ui.source === "builtin-character-catalog") throw new Error("adapted character values have one owner; alternate state copies are not writable");
      else if (["custom", "event", "schedule", "location"].includes(baseline.kind)) throw new Error("only explicitly exposed element values may be updated on this object");
    }
    const candidateActive = active.map((character) => candidate.get(refKey({ kind: "character", id: character.id })) ?? character);
    const slotsBefore = await this.store.getTaskSlots();
    const nextSlots = [];
    for (const slot of slotsBefore) {
      const task = candidate.get(refKey(slot.ref)) ?? await this.store.getObject(slot.ref);
      if (!task?.data.completed) nextSlots.push(slot);
    }
    const desired = await this.projection({ characters: candidateActive, objectOverrides: candidate, promptAnchor, taskSlotsOverride: nextSlots });
    const worldbookSnapshot = await this.worldbook.snapshot();
    try {
      await this.worldbook.sync(filterObjectAudience(desired, { mode: this.updateMode, audience: "plot" }));
      await this.store.commitEnvelope(merged, {
        replyAnchor,
        source,
        allowedKeys: allowed,
        transactionIds: unseen.map((item) => item.transactionId),
        extraFiles: new Map([["slots/tasks.json", nextSlots]]),
      });
    } catch (error) {
      await this.worldbook.restore(worldbookSnapshot);
      throw error;
    }
    return { applied: unseen.length, skipped: envelopes.length - unseen.length };
  }

  async observeReply(options) { return this.store.observeReply(options); }
  async exportChatFiles() { await this._queue; return this.store.exportFiles(); }
  async rollbackReplies(steps) { const result = await this.store.rollback(steps); await this.syncWorldbook(); return result; }

  async addImage(ref, blob, options) {
    const object = await this.store.getObject(ref);
    if (!object) throw new Error("图片所属对象不存在");
    const image = await saveObjectImage(this.store, object, blob, options);
    object.ui ??= {}; object.ui.images = [...(object.ui.images ?? []), image];
    await this._writeLocalObjects([object]);
    return image;
  }
  async removeImage(ref, imageId) {
    const object = await this.store.getObject(ref);
    if (!object) throw new Error("对象不存在");
    object.ui.images = (object.ui.images ?? []).filter((image) => image.id !== imageId);
    // Unlink only: file remains recoverable in the same chat folder.
    await this._writeLocalObjects([object]);
  }
  async imageBlob(image) { return readObjectImage(this.store, image); }
  async saveProfileValues(ref, values, definition = {}) {
    const object = await this.store.getObject(ref);
    if (!object) throw new Error("对象不存在");
    for (const [id, value] of Object.entries(values)) {
      const field = flattenElements(object.elements).find((item) => item.id === id);
      if (!field || field.binding || field.type === "group") throw new Error("invalid profile field");
      object.values[id] = validateElementValue(field, value);
    }
    for (const key of ["name", "aliases", "summary"]) if (Object.hasOwn(definition, key)) object[key] = definition[key];
    await this._writeLocalObjects([object]);
    return object;
  }

  async stageScheduleOverlap(userWindow, { promptAnchor }) {
    if (!(await this.availableLocations()).some(x => x.id === userWindow.location?.id)) throw new Error('地点尚未开放');
    const characters = await this.activeCharacters();
    const intersections = await collectCharacterScheduleIntersections({
      activeCharacters: characters,
      userWindow: { ...userWindow, replyAnchor: promptAnchor },
      resolveObject: (ref) => this.store.getObject(ref),
    });
    const prompts = scheduleIntersectionsToHiddenPrompts(intersections, { ...userWindow, replyAnchor: promptAnchor });
    const before = await this.ledger.list();
    const beforeAnchor = this.promptAnchor;
    const snapshot = await this.worldbook.snapshot();
    try {
      await this.store.writeJson("prompts/hidden.json", before.filter((item) => !(item.replyAnchor === String(promptAnchor) && item.id.startsWith("schedule-overlap:"))));
      for (const prompt of prompts) await this.ledger.upsert(prompt);
      this.promptAnchor = String(promptAnchor);
      await this.syncWorldbook({ characters, promptAnchor: this.promptAnchor });
      return prompts;
    } catch (error) {
      this.promptAnchor = beforeAnchor;
      await this.store.writeJson("prompts/hidden.json", before);
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  // The caller must supply an established location, never an unconfirmed travel intent.
  async setLocationContext(locationRef, { state = {} } = {}) {
    const ref = locationRef ? normalizeRef(locationRef, "location") : null;
    if (ref && !(await this.availableLocations()).some(x => x.id === ref.id)) throw new Error('地点尚未开放');
    if (ref) await validateLocationGraph(ref, (item) => this.store.getObject(item));
    const before = structuredClone(this.locationContext);
    const snapshot = await this.worldbook.snapshot();
    try {
      this.locationContext = { location: ref, state: structuredClone(state) };
      await this.store.writeJson("context/location.json", this.locationContext);
      await this.syncWorldbook();
      return structuredClone(this.locationContext);
    } catch (error) {
      this.locationContext = before;
      await this.store.writeJson("context/location.json", before);
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  async stageLocationFeature(locationId, featureId, { promptAnchor }) {
    if (!(await this.availableLocations()).some(x => x.id === locationId)) throw new Error('地点尚未开放');
    if (!String(promptAnchor ?? "").trim()) throw new Error("promptAnchor is required");
    const raw = await this.store.getObject({ kind: "location", id: locationId });
    if (!raw) throw new Error(`missing location: ${locationId}`);
    const location = normalizeLocation(raw);
    const feature = location.features.find((item) => item.id === featureId);
    if (!feature) throw new Error(`missing location feature: ${featureId}`);
    const decision = await this.featureRegistry.buildPrompt(location, feature, structuredClone(this.locationContext));
    const id = `location-feature:${location.id}:${feature.id}:${promptAnchor}`;
    const before = await this.ledger.list();
    const beforeAnchor = this.promptAnchor;
    const snapshot = await this.worldbook.snapshot();
    try {
      if (decision.allowed && decision.content) {
        await this.ledger.upsert({ id, owner: { kind: "location", id: location.id }, dependencies: [{ kind: "location", id: location.id }], replyAnchor: promptAnchor, route: feature.route, content: decision.content, gate: { type: "location-feature", featureId: feature.id, action: feature.action, reason: decision.reason } });
      } else await this.ledger.remove(id);
      this.promptAnchor = String(promptAnchor);
      await this.syncWorldbook();
      return decision;
    } catch (error) {
      this.promptAnchor = beforeAnchor;
      await this.store.writeJson("prompts/hidden.json", before);
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  async personnelTransaction(work) { return work(this); }

  setPersonnelPermissionSource(source){this.personnelPermissionSource=typeof source==='function'?source:null;this.personnelPermissionState={...UNKNOWN_PERSONNEL_PERMISSIONS};this._permissionEpoch++;this._permissionInflight=null;}
  resolvePersonnelPermissions(){
    if(this._permissionInflight)return this._permissionInflight;
    const epoch=this._permissionEpoch,source=this.personnelPermissionSource;this.personnelPermissionState={...UNKNOWN_PERSONNEL_PERMISSIONS};
    const pending=(async()=>{let next;try{next=await source?.();}catch{}
      if(epoch!==this._permissionEpoch)return this.resolvePersonnelPermissions();
      this.personnelPermissionState=next?.status==='ready'?{status:'ready',linAnUnlocked:next.linAnUnlocked===true}:{...UNKNOWN_PERSONNEL_PERMISSIONS};return {...this.personnelPermissionState};
    })();this._permissionInflight=pending;pending.finally(()=>{if(this._permissionInflight===pending)this._permissionInflight=null;});return pending;
  }
  async refreshPersonnelPermissions(){
    await this.resolvePersonnelPermissions();const epoch=this._permissionEpoch;
    return this.personnelTransaction(async()=>{const state=epoch!==this._permissionEpoch?await this.resolvePersonnelPermissions():this._permissionInflight?await this._permissionInflight:{...this.personnelPermissionState},slots=await this.store.getCharacterSlots(),blocked=[];
    for(const slot of slots){const actor=await this.store.getObject(slot.ref);if(actor&&!personnelPermissions(actor,state).slot)blocked.push(slot);}
    if(blocked.length){const archive=await this.store.readJson('archives/personnel-restricted-slots-v1.json',{schema:1,slots:[]});for(const slot of blocked)if(!archive.slots.some(x=>JSON.stringify(x)===JSON.stringify(slot)))archive.slots.push(structuredClone(slot));await this._writeLocalObjects([],new Map([['slots/characters.json',slots.filter(slot=>!blocked.includes(slot))],['archives/personnel-restricted-slots-v1.json',archive]]));}
    return state;
    });
  }

  async _writeLocalObjects(values, extraFiles = new Map()) {
    const objects = values.map(normalizeObject);
    const overrides = new Map(objects.map((object) => [refKey(object), object]));
    let characters = (await this.activeCharacters()).map((object) => overrides.get(refKey(object)) ?? object);
    const nextCharacterSlots = extraFiles.get("slots/characters.json");
    if (nextCharacterSlots) {
      if (!Array.isArray(nextCharacterSlots)) throw new Error("character slots must be an array");
      characters = [];
      for (const slot of [...nextCharacterSlots].filter(x => x.enabled !== false).sort((a,b) => Number(b.order??0)-Number(a.order??0))) {
        const ref = normalizeRef(slot.ref,"character"), object = overrides.get(refKey(ref)) ?? await this.store.getObject(ref);
        if (!object) throw new Error("loaded character is missing: "+refKey(ref));
        if (slotEligible(object)&&personnelPermissions(object,await this.resolvePersonnelPermissions()).slot) characters.push(normalizeCharacter(object));
      }
    }
    const snapshot = await this.worldbook.snapshot();
    const desired = await this.projection({ characters, objectOverrides: overrides, taskSlotsOverride: extraFiles.get("slots/tasks.json") ?? null });
    const writes = new Map(objects.map((object) => [`objects/${object.kind}/${object.id}.json`, object]));
    for (const [file, value] of extraFiles) writes.set(file, value);
    try {
      await this.worldbook.sync(filterObjectAudience(desired, { mode: this.updateMode, audience: "plot" }));
      await this.store.applyFileBatch(writes);
      return objects;
    } catch (error) {
      await this.worldbook.restore(snapshot);
      throw error;
    }
  }

  async saveCharacterChild(value) {
    const child = normalizeObject(value);
    if (!["task", "achievement"].includes(child.kind)) throw new Error("only character tasks and achievements are supported");
    const character = await this.store.getObject(child.owner);
    if (!character) throw new Error("child owner does not exist");
    const existing = await this.store.getObject(child);
    if (existing) child.data = existing.data;
    if (existing && refKey(existing.owner) !== refKey(child.owner)) throw new Error("cannot transfer a child object to another character");
    if (child.source.kind === "workshop" && !existing) throw new Error("workshop source requires authenticated gateway import");
    if (existing?.source.kind === "workshop") child.source = { kind: "local", origin: existing.source, locallyEdited: true };
    const field = child.kind === "task" ? "tasks" : "achievements";
    if (!character.refs[field].some((ref) => refKey(ref) === refKey(child))) character.refs[field].push({ kind: child.kind, id: child.id });
    const slots = (await this.store.getTaskSlots()).filter((slot) => !(slot.ref.id === child.id && child.kind === "task" && child.data.completed));
    await this._writeLocalObjects([child, character], new Map([["slots/tasks.json", slots]]));
    return child;
  }

  async acceptTask(taskId) {
    const task = await this.store.getObject({ kind: "task", id: taskId });
    if (!task) throw new Error("task does not exist");
    const owner = (await this.activeCharacters()).find((character) => character.id === task.owner.id);
    if (!owner || !owner.refs.tasks.some((ref) => ref.id === task.id)) throw new Error("acceptance requires a loaded owning character");
    if (task.data.completed) throw new Error("completed tasks stay archived and cannot be accepted again");
    const slots = await this.store.getTaskSlots();
    if (slots.some((slot) => slot.ref.id === task.id)) return { accepted: false, alreadyAccepted: true, task };
    normalizeTaskSlots([...slots, { ref: { kind: "task", id: task.id }, owner: task.owner }]);
    slots.push({ ref: { kind: "task", id: task.id }, owner: task.owner, acceptedAt: new Date().toISOString() });
    await this._writeLocalObjects([], new Map([["slots/tasks.json", slots]]));
    return { accepted: true, task };
  }

  async cancelTask(taskId) {
    const slots = await this.store.getTaskSlots();
    const next = slots.filter((slot) => slot.ref.id !== taskId);
    await this._writeLocalObjects([], new Map([["slots/tasks.json", next]]));
    return { canceled: slots.length !== next.length, retainedLocally: true };
  }

  async completeTask(taskId, { context = {} } = {}) {
    const task = await this.store.getObject({ kind: "task", id: taskId });
    if (!task) throw new Error("task does not exist");
    const slots = await this.store.getTaskSlots();
    if (!task.data.completed && !slots.some((slot) => slot.ref.id === taskId)) throw new Error("only accepted tasks can complete");
    if (task.definition.completion.mode === "script") {
      const { evaluateCondition } = await import("./conditions.mjs");
      if (!evaluateCondition(task.definition.completion.when, context)) throw new Error("script completion condition not met");
    }
    task.data.completed = true;
    await this._writeLocalObjects([task], new Map([["slots/tasks.json", slots.filter((slot) => slot.ref.id !== taskId)]]));
    return task;
  }

  // Records an already committed reward receipt. It does not mint resources or
  // perform legacy MVU writes; the future reward executor owns actual settlement.
  async recordRewardClaim(ref, receiptId) {
    const value = await this.store.getObject(normalizeRef(ref));
    if (!["task", "achievement"].includes(value?.kind) || !value.data.completed) throw new Error("only completed rewards can be recorded");
    if (!String(receiptId ?? "").trim()) throw new Error("committed reward receipt is required");
    if (value.data.claimed) return { recorded: false, value };
    value.data.claimed = true;
    value.data.claimReceipt = String(receiptId);
    await this._writeLocalObjects([value]);
    return { recorded: true, value };
  }

  async workshopSettings() { return this.store.readJson("settings/workshop.json", { enabled: false }); }
  async setWorkshopEnabled(enabled) {
    if (typeof enabled !== "boolean") throw new Error("workshop toggle must be boolean");
    await this.store.applyFileBatch(new Map([["settings/workshop.json", { enabled }]]));
    if (!enabled) this.workshopClient?.disconnect?.();
    return { enabled };
  }

  async listWorkshopTasks(characterId) {
    if (!(await this.workshopSettings()).enabled) return [];
    if (!this.workshopClient) throw new Error("workshop gateway is not configured");
    return this.workshopClient.listTasks({ targetCharacterId: characterId });
  }

  async importWorkshopTask(packageId, characterId) {
    if (!(await this.workshopSettings()).enabled) throw new Error("workshop is disabled");
    if (!this.workshopClient) throw new Error("workshop gateway is not configured");
    const character = await this.store.getObject({ kind: "character", id: characterId });
    if (!character) throw new Error("owning character does not exist");
    // Fetch from the authenticated gateway, never trust uploaded JSON claiming
    // reviewStatus=approved as evidence of remote approval or membership.
    const pkg = await validateApprovedTaskPackage(await this.workshopClient.getApprovedTask(packageId));
    if (pkg.task.targetCharacterId !== character.id) throw new Error("workshop task targets a different character");
    const id = `workshop-${(await sha256(`${character.id}:${pkg.id}`)).slice(0, 40)}`;
    const existing = await this.store.getObject({ kind: "task", id });
    if (existing) return { imported: false, retainedSnapshot: true, task: existing };
    const task = normalizeTask({ kind: "task", id, name: pkg.task.name, owner: { kind: "character", id: character.id }, definition: pkg.task.definition, source: { kind: "workshop", packageId: pkg.id, revision: pkg.revision, contentHash: pkg.contentHash } });
    character.refs.tasks.push({ kind: "task", id });
    await this._writeLocalObjects([task, character]);
    return { imported: true, accepted: false, task };
  }

  async saveCharacterDefinition(value) {
    const character = normalizeCharacter(value);
    ensureCharacterCash(character);
    ensureCharacterClothing(character);
    const current = await this.store.getObject(character);
    // Definition editor cannot overwrite gameplay state or child ownership.
    if (current) { character.state = current.state; character.refs = current.refs; retainCharacterCashState(character,current); }
    await this._writeLocalObjects([character]);
    return character;
  }

  async saveLocationDefinition(value) {
    const location = normalizeLocation(value);
    await retainHiddenLocationChildren(this, location);
    await this._validateDefinitions([location]);
    await this._writeLocalObjects([location]);
    return location;
  }

  async availableLocations() { return availableLocations(this); }
  async locationTree() { return locationForest(await this.availableLocations()); }
  async saveLocationBatch(values) {
    const objects = values.map(normalizeLocation);
    await this._validateDefinitions(objects); await this._writeLocalObjects(objects); return objects;
  }
  async insertLocationParent(ref, value) {
    if (!(await this.availableLocations()).some(x => x.id === ref.id)) throw new Error('地点尚未开放');
    const tree = locationForest(await this.store.listObjects('location')), child = tree.nodes.get(normalizeRef(ref, "location").id);
    if (!child) throw new Error("子地点不存在");
    const parent = normalizeLocation({ ...value, kind: "location", children: [{ kind: "location", id: child.object.id }] });
    if (tree.nodes.has(parent.id)) throw new Error("新父地点 ID 已存在");
    const writes = [parent];
    if (child.parent) { const grand = tree.nodes.get(child.parent.id).object; grand.children = grand.children.map((item) => item.id === child.object.id ? { kind: "location", id: parent.id } : item); grand.ui.board.cells = grand.ui.board.cells.map((id) => id === child.object.id ? parent.id : id); writes.push(grand); }
    await this._validateDefinitions(writes); await this._writeLocalObjects(writes); return parent;
  }
  async moveLocation(ref, parentRef = null) {
    const available = new Set((await this.availableLocations()).map(x => x.id));
    if (!available.has(ref.id) || parentRef && !available.has(parentRef.id)) throw new Error('地点尚未开放');
    const tree = locationForest(await this.store.listObjects('location')), child = tree.nodes.get(normalizeRef(ref, "location").id);
    if (!child) throw new Error("地点不存在");
    const parent = parentRef ? tree.nodes.get(normalizeRef(parentRef, "location").id) : null;
    if (parentRef && !parent) throw new Error("父地点不存在");
    if (parent?.path.some((item) => item.id === child.object.id)) throw new Error("location reference cycle: cannot move under a descendant");
    if (child.parent?.id === parent?.object.id) return child.object;
    const writes = [];
    if (child.parent) { const previous = tree.nodes.get(child.parent.id).object; previous.children = previous.children.filter((item) => item.id !== child.object.id); previous.ui.board.cells = previous.ui.board.cells.map((id) => id === child.object.id ? null : id); writes.push(previous); }
    if (parent) { parent.object.children.push({ kind: "location", id: child.object.id }); writes.push(parent.object); }
    if (writes.length) { await this._validateDefinitions(writes); await this._writeLocalObjects(writes); }
    return child.object;
  }
  async setLocationBoard(ref, value) {
    const object = await this.store.getObject(normalizeRef(ref, "location"));
    if (!object) throw new Error("地点不存在");
    if (value.enabled && !object.children.length) throw new Error("只有有子地点的节点可以启用棋盘");
    object.ui.board = normalizeLocationBoard(value, object.children);
    await this._writeLocalObjects([object]); return object.ui.board;
  }
  async swapLocationCells(ref, from, to) {
    const object = await this.store.getObject(normalizeRef(ref, "location"));
    if (!object?.ui.board.enabled) throw new Error("棋盘未启用");
    object.ui.board = swapLocationBoard(object.ui.board, from, to, object.children);
    await this._writeLocalObjects([object]); return object.ui.board;
  }

  async evaluateChildConditions(context) {
    const { evaluateCondition } = await import("./conditions.mjs");
    const characters = await this.activeCharacters();
    const slots = await this.store.getTaskSlots();
    const accepted = new Set(slots.map((slot) => slot.ref.id));
    const updated = [];
    for (const character of characters) {
      for (const ref of [...character.refs.achievements, ...character.refs.tasks]) {
        const child = await this.store.getObject(ref);
        if (!child || child.data.completed || child.definition.completion.mode !== "script" || child.kind === "task" && !accepted.has(child.id)) continue;
        if (evaluateCondition(child.definition.completion.when, { ...context, owner: character })) { child.data.completed = true; updated.push(child); }
      }
    }
    if (updated.length) await this._writeLocalObjects(updated, new Map([["slots/tasks.json", slots.filter((slot) => !updated.some((item) => item.id === slot.ref.id))]]));
    return updated;
  }

  async settleChildReward(ref) {
    const child = await this.store.getObject(ref);
    if (!["task", "achievement"].includes(child?.kind) || !child.data.completed) throw new Error("只有已完成的成就或任务才能领取");
    if (child.data.claimed) return { granted: false, alreadyClaimed: true };
    if (!this.rewardAccount) throw new Error("奖励结算接口未接入，不能只标记领取");
    const receipts = await this.store.readJson("rewards/receipts.json", []);
    const receipt = `${refKey(child)}:reward`;
    if (await this.store.readJson("rewards/pending.json", null)) throw new Error("存在未确认的奖励事务，请先核验，避免重复发放");
    if (receipts.some((item) => item.id === receipt)) throw new Error("奖励收据与对象状态不一致，请先检查本地文件");
    const rewards = child.definition.rewards;
    for (const item of rewards.items ?? []) {
      if (!item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || ["__proto__", "prototype", "constructor"].includes(item.name)) throw new Error("奖励物品无效");
    }
    const before = await this.rewardAccount.snapshot();
    await this.store.writeJson("rewards/pending.json", { id: receipt, target: { kind: child.kind, id: child.id }, phase: "prepared", rewards, createdAt: new Date().toISOString() });
    const written = await this.rewardAccount.apply(rewards);
    await this.store.writeJson("rewards/pending.json", { id: receipt, target: { kind: child.kind, id: child.id }, phase: "account-written", rewards, createdAt: new Date().toISOString() });
    try {
      receipts.push({ id: receipt, owner: child.owner, grantedAt: new Date().toISOString() });
      child.data.claimed = true; child.data.claimReceipt = receipt;
      await this._writeLocalObjects([child], new Map([["rewards/receipts.json", receipts], ["rewards/pending.json", null]]));
      return { granted: true, receipt };
    } catch (error) {
      await this.rewardAccount.restoreIfUnchanged(before, written);
      await this.store.applyFileBatch(new Map([["rewards/pending.json", null]]));
      throw error;
    }
  }

  async _validateDefinitions(objects) {
    const overrides = new Map(objects.map((object) => [refKey(object), normalizeObject(object)]));
    const resolve = async (ref) => overrides.get(refKey(ref)) ?? await this.store.getObject(ref) ?? deferredLocationTemplate(ref);
    const candidates = new Map(overrides);
    for (const kind of OBJECT_KINDS) for (const object of await this.store.listObjects(kind)) if (!candidates.has(refKey(object))) candidates.set(refKey(object), object);
    locationForest([...candidates.values()].filter((object) => object.kind === "location"));
    const containers = new Map();
    for (const parent of candidates.values()) for (const edge of objectEdges(parent).filter((edge) => edge.mode === "owned")) {
      const key = refKey(edge.ref), container = refKey(parent);
      if (containers.has(key) && containers.get(key) !== container) throw new Error("owned child already has a container; use a reference instead");
      containers.set(key, container);
      if (["task", "achievement"].includes(edge.ref.kind)) {
        const child = await resolve(edge.ref);
        if (parent.kind !== "character" || !child || refKey(child.owner) !== container) throw new Error("task/achievement requires its owning character container");
      }
    }
    for (const object of overrides.values()) {
      await validateObjectGraph(object, resolve);
      if (object.kind === "location") await validateLocationGraph(object, resolve);
    }
  }

  async saveObjectDefinition(value) {
    const object = normalizeObject(value);
    if(object.kind==='character')ensureCharacterCash(object);
    if(object.kind==='character')ensureCharacterClothing(object);
    if (object.kind === 'location') await retainHiddenLocationChildren(this, object);
    const existing = await this.store.getObject(object);
    if (existing) {
      if (object.kind === "character") { object.state = existing.state; object.refs = existing.refs; retainCharacterCashState(object,existing); }
      if (["task", "achievement"].includes(object.kind)) {
        if (refKey(object.owner) !== refKey(existing.owner)) throw new Error("child ownership is immutable");
        object.data = existing.data;
        if (existing.source.kind === "workshop") object.source = { kind: "local", origin: existing.source, locallyEdited: true };
      }
    } else if (["task", "achievement"].includes(object.kind) && object.source.kind === "workshop") throw new Error("workshop source requires authenticated import");
    await this._validateDefinitions([object]);
    await this._writeLocalObjects([object]);
    return object;
  }

  async _attach(parent, child, { mode = "reference", label = "" } = {}) {
    if (refKey(parent) === refKey(child)) throw new Error("self object link is not allowed");
    const native = parent.kind === "character" && mode === "owned";
    if (native && ["task", "achievement"].includes(child.kind)) {
      if (refKey(child.owner) !== refKey(parent)) throw new Error("task/achievement belongs to another character");
      const field = child.kind === "task" ? "tasks" : "achievements";
      if (!parent.refs[field].some((ref) => refKey(ref) === refKey(child))) parent.refs[field].push({ kind: child.kind, id: child.id });
    } else if (native && child.kind === "schedule") {
      if (parent.refs.schedule && refKey(parent.refs.schedule) !== refKey(child)) throw new Error("character already has an independent schedule");
      parent.refs.schedule = { kind: "schedule", id: child.id };
    } else if (native && child.kind === "favor-event") {
      if (!parent.refs.favorEvents.some((ref) => refKey(ref) === refKey(child))) parent.refs.favorEvents.push({ kind: child.kind, id: child.id });
    } else if (parent.kind === "location" && child.kind === "location" && mode === "owned") {
      if (!parent.children.some((item) => item.id === child.id)) parent.children.push({ kind: "location", id: child.id });
    } else {
      if (!["owned", "reference"].includes(mode)) throw new Error("invalid link mode");
      if (!parent.links.some((link) => refKey(link.ref) === refKey(child))) parent.links.push({ id: `link-${crypto.randomUUID()}`, label: label || child.name, ref: { kind: child.kind, id: child.id }, mode, enabled: true });
    }
    // An owned object has one container; references may be shared freely.
    if (mode === "owned") {
      for (const kind of ["character", "location", "task", "achievement", "schedule", "favor-event", "event", "custom"]) {
        for (const object of await this.store.listObjects(kind)) {
          if (refKey(object) === refKey(parent)) continue;
          if (objectEdges(object).some((edge) => edge.mode === "owned" && refKey(edge.ref) === refKey(child))) throw new Error("owned child already has a container; use a reference instead");
        }
      }
    }
    return parent;
  }

  async attachChildObject(parentRef, childRef, options = {}) {
    const parent = await this.store.getObject(parentRef), child = await this.store.getObject(childRef);
    if (!parent || !child) throw new Error("parent/child object does not exist");
    await this._attach(parent, child, options);
    await this._validateDefinitions([parent]);
    await this._writeLocalObjects([parent]);
    return parent;
  }

  async createChildObject(parentRef, value, options = {}) {
    const parent = await this.store.getObject(parentRef);
    if (!parent) throw new Error("parent object does not exist");
    if (["task", "achievement"].includes(value.kind) && parent.kind !== "character") throw new Error("task/achievement creation requires its owning character");
    const child = normalizeObject({ ...value, ...(["task", "achievement"].includes(value.kind) ? { owner: { kind: "character", id: parent.id } } : {}) });
    if (await this.store.getObject(child)) throw new Error("child ID already exists; attach a reference instead");
    if (child.source?.kind === "workshop") throw new Error("workshop tasks must use authenticated import");
    await this._attach(parent, child, { mode: "owned", ...options });
    await this._validateDefinitions([parent, child]);
    await this._writeLocalObjects([parent, child]);
    return child;
  }

  async removeObjectLink(parentRef, edgeId) {
    const parent = await this.store.getObject(parentRef);
    if (!parent) throw new Error("parent object does not exist");
    const edge = objectEdges(parent).find((item) => item.id === edgeId);
    if (!edge) return { removed: false };
    if (edge.source === "link") parent.links = parent.links.filter((link) => link.id !== edge.id);
    else if (edge.source === "relation") parent.relations = parent.relations.filter((relation) => `relation:${relation.id}` !== edge.id);
    else if (parent.kind === "character") {
      if (edge.ref.kind === "task" && (await this.store.getTaskSlots()).some((slot) => refKey(slot.ref) === refKey(edge.ref))) throw new Error("cancel the active task before unlinking it");
      const field = { task: "tasks", achievement: "achievements", "favor-event": "favorEvents" }[edge.ref.kind];
      if (field) parent.refs[field] = parent.refs[field].filter((ref) => refKey(ref) !== refKey(edge.ref));
      else if (edge.ref.kind === "schedule") parent.refs.schedule = null;
      else throw new Error("use the native object editor for this link");
    } else if (parent.kind === "location") { parent.children = parent.children.filter((ref) => refKey(ref) !== refKey(edge.ref)); parent.ui.board.cells = parent.ui.board.cells.map((id) => id === edge.ref.id ? null : id); }
    else throw new Error("use the native object editor for this link");
    await this._writeLocalObjects([parent]);
    return { removed: true, fileRetained: true };
  }

  async setElementValue(ref, elementId, value, { expectedValue } = {}) {
    const object = await this.store.getObject(ref);
    if (!object) throw new Error("object does not exist");
    if (expectedValue !== undefined && JSON.stringify(object.values[elementId]) !== JSON.stringify(expectedValue)) throw new Error("该集合已被其他操作更新，请重新打开后编辑");
    const field = flattenElements(object.elements).find((item) => item.id === elementId);
    if (!field || field.type === "group" || field.binding) throw new Error("element is not directly editable");
    object.values[elementId] = validateElementValue(field, value);
    await this._writeLocalObjects([object]);
    return object;
  }

  async saveCharacterRelation(characterRef, { id = `relation-${crypto.randomUUID()}`, target, type = "相关人物", summary = "" }) {
    const character = await this.store.getObject(characterRef), related = await this.store.getObject(target);
    if (character?.kind !== "character" || related?.kind !== "character") throw new Error("relationship must link two characters");
    if (character.id === related.id) throw new Error("self relationship is not allowed");
    const next = { id, target: { kind: "character", id: related.id }, type, summary };
    character.relations = [...character.relations.filter((relation) => relation.id !== id), next];
    await this._validateDefinitions([character]);
    await this._writeLocalObjects([character]);
    return character;
  }
}
import { slotEligible } from './personnel-access.mjs';
