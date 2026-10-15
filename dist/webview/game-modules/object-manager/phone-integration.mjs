import {requireDistributionAccess} from '../distribution/access.mjs';
import {hasTavernContext,readTavernChatId} from "./tavern-context.mjs";
import {ensureUserManagement,hasLegacyUserState,userNotebookSources} from './user-management.mjs';
import {installLocationHypnosisHooks,stageLegacyLocationHypnosis,migrateLegacyLocationHypnosis} from './location-hypnosis.mjs';
import { surfaceLifecycle as lifecycle, runSceneTransition as transition } from '../ui/surface-motion.mjs';
import { dockSceneToolbar as dockToolbar } from '../ui/scene-toolbar.mjs';
import { sceneWindowController as getSceneWindows } from '../ui/scene-windows.mjs';
import { mountSceneLocationWindow } from './scene-location-window.mjs';
import { mountFloatingWindow as mountFloat, bindFloatingDrag as bindFloatDrag } from '../ui/floating-window.mjs';
import { mountInventoryCollection as mountCollectionWindow } from '../inventory/collection.mjs';
import { mountSceneTools as mountTools } from './scene-tools.mjs';
import { mountDesktopPet as mountPet } from '../pet-v6/desktop-pet.mjs';
export function mountDesktopPet(root,options){return mountPet(root,options);}
import { normalizeHypnosisRequest, normalizeHypnosisBatch } from '../phone-v2/hypnosis-model.mjs';
import { mountIphone16Phone as mountPhoneV2 } from '../phone-v2/phone.mjs';
import { phoneSnapshotFromScene as phoneSceneSnapshot } from '../phone-v2/context.mjs';
import { ChatObjectStore, createBrowserFileDriver, MemoryFileDriver } from "./store.mjs";
import { ObjectManagerRuntime } from "./runtime.mjs";
import { resolveTavernWorldbookApi, TavernChatWorldbookAdapter } from "./worldbook-host.mjs";
import { installObjectManagerLifecycle } from "./bootstrap.mjs";
import { seedPhoneObjects } from "./seed.mjs";
import { prepareRoutineCatalog } from "./catalog-install.mjs";
import { BUILTIN_OBJECT_CATALOG } from "./builtin-catalog.mjs";
import { mountPhoneObjectPanel } from "./phone-panel.mjs";
import { buildDefaultRewardDatabase } from "../reward-defaults.js";
import { createObjectRewardAccount } from "./account.mjs";
import { readSceneObjects, storyCalendar, resolveSceneLocation } from "./scene-presence.mjs";
import { mountScheduleScene } from "./scene-view.mjs";
import { notebookSnapshot, toggleNotebookFavourite, notebookMountCharacter } from "./notebook-model.mjs";
import { mountDetectiveNotebook } from "./detective-notebook.mjs";
import { mountCharacterSlots as mountSlotsWindow } from "./character-slot-tray.mjs";
import { PersonnelBusiness } from "./personnel-business.mjs";
import { installPersonnelHooks } from "./personnel-hooks.mjs";
import { migratePersonnelSourceFields } from "./personnel-migration.mjs";
import { mountDetectiveDesk as mountDeskWindow } from "./detective-desk.mjs";
import { encounterCharacterDraft } from "./encounter-import.mjs";
import { installCharacterRoutine } from "./catalog-install.mjs";
import { LIN_AN_DEFINITION } from "./lin-an-definition.mjs";
import {readHostPersonnelPermissions,personnelPermissions as permissionsForPersonnel} from './personnel-permissions.mjs';
export function personnelPermissions(actor,state){return permissionsForPersonnel(actor,state);}

export function mountCharacterSlots(container, options) { return mountSlotsWindow(container, options); }
export function mountDetectiveDesk(container, options) { return mountDeskWindow(container, options); }
export function validatePhoneHypnosis(draft,snapshot){return normalizeHypnosisRequest(draft,snapshot);}
export function mountIphone16Phone(container,options){return mountPhoneV2(container,options);}
export function iphone16SceneSnapshot(scene,options){return phoneSceneSnapshot(scene,options);}
export function mountNotebook(container, options) { return mountDetectiveNotebook(container, options); }
export async function connectPersonnelBusiness(start = globalThis) {
  const bridge=findHost(start).__ST_GAME_RUNTIME_BRIDGE__;if(bridge&&bridge.connectPersonnelBusiness!==connectPersonnelBusiness)return bridge.connectPersonnelBusiness(start);
  const runtime = await ensurePhoneObjectRuntime(start);
  const environment = start.__ST_HYPNOOS_PERSONNEL_ENV__?.();
  if (environment?.context) { const read = environment.context; environment.context = async () => { const value = await read(); return { ...value, location: value.location ?? sceneLocation(await runtime.availableLocations(), value.locationText) }; }; }
  if (!runtime.personnelService) runtime.personnelService = new PersonnelBusiness(runtime, { environment });
  else if (environment) runtime.personnelService.configure(environment);
  await runtime.personnelService.init();
  if (environment?.legacyProfiles) {
    const legacy = await environment.legacyProfiles();
    const imported = await runtime.store.readJson("migrations/personnel-existing-actors.json", {});
    const existingNames = new Set((await runtime.store.listObjects("character")).map(x => x.name));
    for (const [name, data] of Object.entries(legacy ?? {})) {
      if (existingNames.has(name) || imported[name] || ["user", "{{user}}", "林安"].includes(name) || !data || typeof data !== "object") continue;
      const definition = await environment.existingRole?.(name) ?? { name };
      const actor = await encounterCharacterDraft(definition, { initialData: data });
      await runtime.saveCharacterDefinition(actor); await installCharacterRoutine(runtime, actor); imported[name] = actor.id; existingNames.add(name);
    }
    await runtime.store.writeJson("migrations/personnel-existing-actors.json", imported);
    await migratePersonnelSourceFields(runtime, legacy);
  }
  installPersonnelHooks(runtime, runtime.personnelService, runtime.__helperStart ?? start);
  return runtime.personnelService;
}
export async function notebookAccess(start = globalThis) {
  const runtime = await ensurePhoneObjectRuntime(start), service = await connectPersonnelBusiness(start);
  return { snapshot: async () => { const host=findHost(start),owner=[start,start.TavernHelper,host,host.TavernHelper].find(view=>typeof view?.getVariables==='function');const raw=owner?await owner.getVariables({type:'message',message_id:'latest'}):{};return notebookSnapshot(runtime,{service,context:await service.context(),...await userNotebookSources(runtime,{legacyState:raw?.stat_data??raw??{},preview:!!host.__ST_LOCAL_PREVIEW__})}); }, favourite: (id) => toggleNotebookFavourite(runtime, id), mountCharacter: (id) => notebookMountCharacter(runtime, id), unloadCharacter: (slot) => runtime.unloadCharacter(slot), portraitFile: (ref) => ref.scope === "shared" ? service.media.read(ref) : runtime.imageBlob(ref), uploadImage: async (id, blob, options) => service.media.put(await runtime.store.getObject({kind:"character",id}), blob, options), imageSelection: async (id, selection) => { const prefs = await runtime.store.readJson("ui/notebook-images.json", {}); prefs[id] = selection; await runtime.store.writeJson("ui/notebook-images.json", prefs); }, investigate: (id) => service.start("investigate", id), serviceSnapshot: () => service.snapshot(), scoutingUploadImage:(id,blob,info)=>service.putCandidateImage(id,blob,info),scoutingImageSelection:(id,selection)=>service.selectCandidateImage(id,selection), scout: (id) => service.start("scout", id) };
}

export async function sceneObjectSnapshot(start = globalThis, confirmedSystem = null) {
  const runtime = await ensurePhoneObjectRuntime(start), service = await connectPersonnelBusiness(start);
  const context = await service.context();
  await service.tick(context);
  const scene=await readSceneObjects(runtime, { context, dateOverrides: await service.dayOverlays(context) });
  const selections=await runtime.store.readJson('ui/notebook-images.json',{});
  for(const actor of scene.characters){const album=await service.media.album(actor),ref=album.head?.[Number(selections[actor.id]?.head)||0];if(ref)actor.headUrl=await service.media.url(ref);}
  return scene;
}
export function mountRoutineScene(container, options) { return mountScheduleScene(container, options); }
export function sceneCalendar(system) { return storyCalendar(system); }
export function sceneLocation(locations, text) {
  const classroom = locations.find((x) => x.data.sourceLayer === "teaching" && x.data.sourceMapId === "classroom");
  return resolveSceneLocation(locations, text, classroom ? { [classroom.id]: ["教室", "二年A组教室", "二年A班教室", "二年级教室"] } : {});
}

function findHost(start) {
  for (const view of [start.top, start.parent, start]) {
    try { if (hasTavernContext(view)) return view; } catch {}
  }
  throw new Error("当前聊天宿主尚未就绪");
}

export async function ensurePhoneObjectRuntime(start = globalThis, { graphs = [], characters, encounterRole = null, assetLoader = null } = {}) {
  const host = findHost(start);
  const accessGuard=host.__ST_HYPNOOS_INTEGRITY_GATE_V1__?()=>requireDistributionAccess(host):()=>{};accessGuard();
  const bridge=host.__ST_GAME_RUNTIME_BRIDGE__;if(bridge&&bridge.ensurePhoneObjectRuntime!==ensurePhoneObjectRuntime)return bridge.ensurePhoneObjectRuntime(start,{graphs,characters,encounterRole,assetLoader});
  const chatId = String(readTavernChatId(host) ?? "");
  if (!chatId) throw new Error("无法确认当前聊天");
  let facade = host.__HYPNOOS_OBJECT_MANAGER_V1__;
  if (facade?.chatId && facade.chatId !== chatId) { await facade.destroy?.(); facade = null; }
  if (!facade) {
    if (host.__ST_LOCAL_PREVIEW__) {
      const store = new ChatObjectStore({ driver: new MemoryFileDriver(), chatId });
      let entries = [];
      const adapter = { async ensure() {}, async snapshot() { return structuredClone(entries); }, async restore(next) { entries = next; }, async sync(next) { entries = next; host.__HYPNOOS_OBJECT_PROMPTS__ = structuredClone(next); } };
      const runtime = new ObjectManagerRuntime({ store, worldbookAdapter: adapter,personnelPermissionSource:()=>readHostPersonnelPermissions(host) });
      await runtime.init();
      facade = { chatId, runtime, ready: Promise.resolve(), async destroy() { delete host.__HYPNOOS_OBJECT_MANAGER_V1__; } };
      host.__HYPNOOS_OBJECT_MANAGER_V1__ = facade;
    } else {
      if (!resolveTavernWorldbookApi(start) && !resolveTavernWorldbookApi(host)) throw new Error("酒馆助手世界书接口尚未就绪");
      facade = await installObjectManagerLifecycle({ start, authorize:accessGuard });
    }
  }
  await facade.ready;accessGuard();
  const runtime = facade.runtime;
  installLocationHypnosisHooks(runtime,start);
  if(runtime.__personnelPermissionHost!==host){runtime.setPersonnelPermissionSource(()=>readHostPersonnelPermissions(host));runtime.__personnelPermissionHost=host;}
  await runtime.refreshPersonnelPermissions();
  runtime.__graphBases ??= new Map(graphs.map(({ scope, graph }) => [scope, graph]));
  runtime.rewardAccount ??= createObjectRewardAccount(runtime.store);
  if (!runtime.__phoneSeeded) {
    if (!runtime.__phoneSeeding) runtime.__phoneSeeding = seedPhoneObjects(runtime, { characters, graphs, assetLoader, rewards: buildDefaultRewardDatabase() }).then(() => { runtime.__phoneSeeded = true; });
    await runtime.__phoneSeeding;
  }
  if (assetLoader && !runtime.__builtinAssetsReady) { await seedPhoneObjects(runtime, { characters, assetLoader }); runtime.__builtinAssetsReady = true; }
  // A TH host may initialize before the phone has supplied its map catalogs.
  // Do not let that early role seed suppress later location initialization.
  if (graphs.length && !runtime.__graphSeeded) {
    await seedPhoneObjects(runtime, { characters: [], rewards: {}, graphs });
    runtime.__graphSeeded = true;
  }
  if (runtime.__routineCatalogRevision !== BUILTIN_OBJECT_CATALOG.routineRevision) await prepareRoutineCatalog(runtime);
  const legacyOwner=[start,start.TavernHelper,host,host.TavernHelper].find(view=>typeof view?.getVariables==='function');
  if(legacyOwner){const raw=await legacyOwner.getVariables({type:'message',message_id:'latest'}),state=raw?.stat_data??raw;if(state?.规则&&Object.keys(state.规则).length)await migrateLegacyLocationHypnosis(runtime,state.规则,{clearMigrated:typeof legacyOwner.updateVariablesWith==='function'?async(before,next)=>{let changed=false;await legacyOwner.updateVariablesWith(variables=>{const root=variables.stat_data??variables;if(JSON.stringify(root.规则)!==JSON.stringify(before))return variables;root.规则=next;changed=true;return variables;},{type:'message',message_id:'latest'});return changed;}:null});}
  if(!runtime.__userManaged){const owner=[start,start.TavernHelper,host,host.TavernHelper].find(view=>typeof view?.getVariables==='function');const raw=owner?await owner.getVariables({type:'message',message_id:'latest'}):null,state=raw?.stat_data??raw;if(hasLegacyUserState(state)){await ensureUserManagement(runtime,{legacyState:state,userName:host.SillyTavern?.getContext?.()?.name1??''});runtime.__userManaged=true;}}
  await runtime.evaluateChildConditions({});
  await publishGraphViews(runtime, host);
  return runtime;
}

async function publishGraphViews(runtime, host) {
  if (String(readTavernChatId(host) ?? "") !== runtime.store.chatId) return;
  const views = {};
  for (const scope of ["world", "school"]) {
    const root = await runtime.store.getObject({ kind: "location", id: `map-${scope}` });
    if (!root) continue;
    const base = runtime.__graphBases?.get(scope) ?? { locations: [] };
    const locations = [];
    const tree = await runtime.locationTree();
    for (const node of tree.nodes.values()) {
      const object = node.object;
      if (object.data.mapScope !== scope || object.data.mapRoot) continue;
      const legacyId = object.data.mapId ?? object.data.sourceMapId ?? object.id;
      const layout = base.locations?.find((item) => item.id === legacyId) ?? {};
      locations.push({ ...layout, id: legacyId, objectRef: { kind: "location", id: object.id }, parentRef: node.parent, depth: node.depth, label: object.name, info: object.data.description ?? "", category: object.data.category ?? "" });
    }
    views[scope] = { ...base, locations };
  }
  host.__HYPNOOS_OBJECT_GRAPH_VIEWS__ = views;
  host.__HYPNOOS_OBJECT_GRAPH_CHAT__ = runtime.store.chatId;
}

export async function mountPhoneObjects(container, options = {}) {
  const runtime = await ensurePhoneObjectRuntime(globalThis, options);
  return mountPhoneObjectPanel(container, { runtime, tab: options.tab, roleName: options.roleName, encounterRole: options.encounterRole, locationId: options.locationId, exportChat: options.exportChat, onSpecialOpen: options.onSpecialOpen, onChanged: async () => { await publishGraphViews(runtime, findHost(globalThis)); options.onChanged?.(); } });
}

export async function initializeObjectHost(start = globalThis) {
  const facade = await installObjectManagerLifecycle({ start, prepareRuntime: async (runtime) => {
    runtime.__helperStart = start;
    await seedPhoneObjects(runtime, { rewards: buildDefaultRewardDatabase() });
    runtime.rewardAccount = createObjectRewardAccount(runtime.store);
    runtime.__phoneSeeded = true;
  } });
  return facade;
}

export function validatePhoneHypnosisBatch(draft,snapshot){return normalizeHypnosisBatch(draft,snapshot);}
export async function stagePhoneLocationHypnosisLegacy(batch,start=globalThis){const runtime=await ensurePhoneObjectRuntime(start);if(!runtime.__locationHypnosisHooks?.available)throw Error('地点催眠真实发送接口尚未就绪');return stageLegacyLocationHypnosis(runtime,batch);}

export function mountInventoryCollection(container,options){return mountCollectionWindow(container,options);}
export function mountSceneTools(root,actions){return mountTools(root,actions);}
export function mountSceneLocations(container,options){return mountSceneLocationWindow(container,options);}

export function mountFloatingWindow(container,options){return mountFloat(container,options);}
export function bindFloatingDrag(handle,panel){return bindFloatDrag(handle,panel);}

export function sceneWindowController(doc){return getSceneWindows(doc);}

export function dockSceneToolbar(doc,toolbar){return dockToolbar(doc,toolbar);}

export function surfaceLifecycle(doc,node,toolbar,dispose,prepare){return lifecycle(doc,node,toolbar,dispose,prepare);}
export function runSceneTransition(doc,action){return transition(doc,action);}
