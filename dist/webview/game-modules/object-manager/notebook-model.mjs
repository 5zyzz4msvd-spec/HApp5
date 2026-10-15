import {ENCOUNTER_NOTEBOOK_PORTRAITS} from './encounter-notebook-portraits.mjs';
import {contentPolicyFieldApplicable} from '../safety/character-content-policy-client.mjs';
import {NOTEBOOK_EVENT_CHARACTER_NAMES} from '../game/story-event-index.mjs';
import {userNotebookGroups} from './user-management.mjs';
import {CASH_POLICY_ID,CASH_DATE_ID} from './character-cash.mjs';


// Preserve the source schema hierarchy; persona prose is deliberately outside this view.
export function notebookPhotoSources(asset, media, mode, resolveFile) {
  const originals=ENCOUNTER_NOTEBOOK_PORTRAITS[asset?.name]?.portraits;
  const defaults = mode === 'head' ? asset?.head ? [asset.head] : [] : mode === 'standee' ? asset?.standees ?? [] : [...(originals??[]),...(asset?.portraits?.length ? asset.portraits : asset?.portrait ? [asset.portrait] : [])];
  const live = mode === 'portrait' ? media?.portraits ?? [] : [];
  const liveFiles = live.map(url => ({ key: url, url: /^(?:data:|blob:|https?:|\/)/.test(url)?url:resolveFile(url) }));
  const defaultFiles = defaults.map(file => ({ key: file, url: /^(?:data:|blob:|https?:|\/)/.test(file)?file:resolveFile(file) }));
  // Old solo media stays stored, but cannot split the inseparable pair in the UI.
  const files = asset?.presentationMode === 'joint' ? defaultFiles : [...liveFiles, ...defaultFiles];
  const seen = new Set();
  const isStandee=file=>mode==='portrait'&&(asset?.standees??[]).some(standee=>{const clean=value=>{try{return decodeURIComponent(String(value).split(/[?#]/)[0]);}catch{return String(value).split(/[?#]/)[0];}};const left=clean(file.url),right=clean(standee);return left===right||left.endsWith('/'+right)||right.endsWith('/'+left);});
  return files.filter(file => { if (isStandee(file)||!file.url || seen.has(file.url)) return false; seen.add(file.url); return true; });
}
export function notebookVariableGroups(actor) {
  const groups = [], ungrouped = [];
  function collect(elements, path, fields) {
    for (const element of elements) {
      if([CASH_POLICY_ID,CASH_DATE_ID].includes(element.id))continue;
      if (!contentPolicyFieldApplicable(actor,element.label,element.id)||element.enabled === false || element.binding || ["当前心情", "心情", "疲劳"].includes(element.label)) continue;
      if (element.type === "group") collect(element.elements ?? [], [...path, element.label], fields);
      else if (Object.hasOwn(actor.values, element.id)) fields.push({ id: element.id, label: element.id === "cooperation" ? "服从度" : element.label, path, type: element.type, value: structuredClone(actor.values[element.id]), unit: element.unit ?? "", min: element.min, max: element.max });
    }
  }
  for (const element of actor.elements ?? []) {
    if (element.enabled === false || ["basic", "persona"].includes(element.id) || ["物品", "关系", "事件", "记录", "子嗣"].includes(element.label)) continue;
    if (element.type === "group") {
      const fields = []; collect(element.elements ?? [], [], fields);
      groups.push({ id: element.id, label: element.id === "runtime" ? "状态" : element.label, fields });
    } else collect([element], [], ungrouped);
  }
  const metadata = (actor.elements?.find(x => x.id === "persona")?.elements ?? []).filter(x => ["age", "height", "gender", "identity"].includes(x.id) && actor.values[x.id] !== undefined && actor.values[x.id] !== "").map(x => ({ id: x.id, label: x.label, path: [], type: x.type, value: actor.values[x.id], unit: x.unit ?? "", min: x.min, max: x.max }));
  if (metadata.length) { const info = groups.find(x => x.label === "信息"); if (info) info.fields.unshift(...metadata); else groups.push({ id: "metadata", label: "信息", fields: metadata }); }
  if (ungrouped.length) groups.push({ id: "other-variables", label: "其他变量", fields: ungrouped });
  // Migration may retain an empty runtime group beside the original state group.
  // A chapter owns all fields with its label, regardless of their source group IDs.
  const chapters = new Map();
  for (const group of groups) {
    if (!chapters.has(group.label)) chapters.set(group.label, { ...group, fields: [] });
    const chapter = chapters.get(group.label);
    for (const field of group.fields) if (!chapter.fields.some(x => x.id === field.id)) chapter.fields.push(field);
  }
  const information=chapters.get('信息');
  if(information){
    const nickname=String(information.fields.find(field=>field.label==='绰号')?.value??'').trim();
    const accepted=information.fields.find(field=>field.label==='绰号已认可')?.value===true;
    information.fields=information.fields.filter(field=>!['绰号','绰号已认可'].includes(field.label));
    if(nickname){let name=information.fields.find(field=>field.label==='姓名');if(!name){name={id:'notebook-display-name',label:'姓名',type:'text',value:actor.name,path:[]};information.fields.unshift(name);}name.namePresentation={original:String(name.value||actor.name),nickname,accepted};}
  }
  return [...chapters.values()];
}

export function notebookValueRows(field) {
  if([CASH_POLICY_ID,CASH_DATE_ID].includes(field.id))return [];
  if(['现金','随身现金'].includes(field.label)&&typeof field.value==='number')return [{label:[...(field.path??[]),field.label].join(' / '),value:field.value.toLocaleString('zh-CN')+'日元'}];
  const result = [], prefix = [...(field.path ?? []), field.label];
  function visit(value, path) {
    if (value && typeof value === "object" && Object.keys(value).length) {
      for (const [key, child] of Object.entries(value)) visit(child, [...path, Array.isArray(value) ? `第${Number(key) + 1}项` : key]);
    } else result.push({ label: path.join(" / "), value: typeof value === "boolean" ? (value ? "是" : "否") : value && typeof value === "object" ? "暂无" : value == null || value === "" ? "暂无" : String(value) + (field.unit ?? "") });
  }
  visit(field.value, prefix); return result;
}

// Page capacity uses measured text, so long collections and paragraphs never get clipped.
export function paginateNotebookGroup(group, wrap, capacity = 304) {
  const pages = []; let rows = [], height = 0;
  const flush = () => { if (rows.length) { pages.push({ title: group.label, chapter: group.label, rows, lines: rows.map((x) => `${x.label}：${x.lines.join("")}`) }); rows = []; height = 0; } };
  for (const row of group.fields.flatMap(notebookValueRows)) {
    const labels = wrap(row.label, "label"), lines = wrap(row.value, "value");
    const perPage = Math.max(1, Math.floor((capacity - labels.length * 25 - 14) / 35));
    for (let i = 0; i < lines.length; i += perPage) {
      const part = lines.slice(i, i + perPage), size = labels.length * 25 + part.length * 35 + 14;
      if (height + size > capacity) flush();
      rows.push({ ...row, label: row.label + (i ? " · 续" : ""), labels: i ? wrap(row.label + " · 续", "label") : labels, lines: part, height: size }); height += size;
    }
  }
  flush();
  if (!pages.length) pages.push({ title: group.label, chapter: group.label, lines: ["暂无记录"] });
  return pages;
}

export const NOTEBOOK_VOLUME_SIZE = 6;
export const NOTEBOOK_PENDING_CHAPTERS=Object.freeze(['劣迹','改造','成就','任务']);
export function notebookChapterPending(label,actor=null){return NOTEBOOK_PENDING_CHAPTERS.includes(label)||Boolean(actor?.pendingChapters?.includes(label));}
export function notebookEventChapterAvailable(actor,history=[]) {
 if(actor.id==='user'||actor.values?.gender!=='女')return false;
 return NOTEBOOK_EVENT_CHARACTER_NAMES.includes(actor.name)||notebookStoryEventRows(history,actor).length>0;
}
export function notebookStoryEventRows(history, actor){
  const rows=Array.isArray(history)?history:Object.values(history??{});
  return rows.filter(row=>row&&(row.ownerIds?.includes(actor.id)||row.ownerNames?.includes(actor.name))).map(row=>({id:row.id,eventId:row.eventId,name:row.name??row.title??row.id,description:row.description??'',date:row.date??'',slotId:row.slotId,index:row.index,start:row.start??'',end:row.end??'',status:row.status}));
}
export function notebookVolumes(characters, { query = "", favouritesOnly = false, favourites = [], volume = 0 } = {}) {
  const text = query.trim().toLocaleLowerCase();
  const filtered = characters.filter((x) => (x.id !== "user" || x.userRecords) && (!favouritesOnly || favourites.includes(x.id)) && (!text || [x.name, ...(x.aliases ?? [])].some((value) => value.toLocaleLowerCase().includes(text))));
  const count = Math.max(1, Math.ceil(filtered.length / NOTEBOOK_VOLUME_SIZE));
  const index = Math.max(0, Math.min(count - 1, volume));
  return { rows: filtered.slice(index * NOTEBOOK_VOLUME_SIZE, (index + 1) * NOTEBOOK_VOLUME_SIZE), count, index, total: filtered.length };
}
export function notebookSlotPages(slots, page = 0) {
  const rows = slots.filter((x) => x.ref.id !== "user" && x.enabled !== false);
  const count = Math.max(1, Math.floor(rows.length / 6) + 1), index = Math.max(0, Math.min(count - 1, page));
  return { rows: rows.slice(index * 6, index * 6 + 6), count, index, total: rows.length };
}
function childRefs(actor,kind){return[...(actor.refs?.[kind==='task'?'tasks':'achievements']??[]),...(actor.links??[]).filter(x=>x.mode==='owned'&&x.enabled!==false&&x.ref?.kind===kind).map(x=>x.ref)].filter((ref,index,list)=>list.findIndex(x=>x.id===ref.id)===index);}
async function notebookChildRecords(runtime,actor,kind,taskSlots){const rows=[];for(const ref of childRefs(actor,kind)){const item=await runtime.store.getObject(ref);if(!item)throw Error('笔记子对象记录缺失');if(item.owner?.kind!=='character'||item.owner.id!==actor.id)throw Error('笔记子对象归属不一致');rows.push({id:item.id,name:item.name,description:item.definition.description,conditionText:item.definition.completion.text,rewards:item.definition.rewards,progress:item.data.progress,completed:item.data.completed,claimed:item.data.claimed,accepted:kind==='task'&&taskSlots.some(x=>x.ref.id===item.id&&x.owner.id===actor.id)});}return rows;}
export async function notebookSnapshot(runtime, { service = null, context = null, storyEventHistory=null,playerResources=null,playerInventory=null,playerContext=null } = {}) {
  const permissionState=await runtime.resolvePersonnelPermissions?.()??UNKNOWN_PERSONNEL_PERMISSIONS;
  const business = service ? await service.snapshot() : null;
  const dateOverrides = service && context ? await service.dayOverlays(context) : {};
  const storyHistory=storyEventHistory??await runtime.store.readJson('services/story-event-history.json',{});
  const imageSelections = await runtime.store.readJson("ui/notebook-images.json", {});
  const preferences = await runtime.store.readJson("ui/notebook.json", { favourites: [] });
  const dossiers = await runtime.store.readJson("services/dossiers.json", {}), slots = await runtime.store.getCharacterSlots();
  const taskSlots=await runtime.store.getTaskSlots();
  const characters = [];
  for (const actor of await runtime.store.listObjects("character")) {
    const userRecords=actor.id==='user';
    if (actor.id === 'user'&&!userRecords || !notebookEligible(actor)) continue;
    const permissions=personnelPermissions(actor,permissionState),unlocked = userRecords || permissions.investigation&&dossiers[actor.id]?.investigated === true;
    const record = { id: actor.id, name: userRecords?'我的记录':actor.name, aliases: actor.aliases, portrait: actor.ui.images?.find((x) => x.usage === "portrait") ?? null, unlocked, scoutingPending: acquisitionState(actor) === 'scouting', mounted: permissions.slot&&slotEligible(actor) && slots.some((x) => x.enabled !== false && x.ref.id === actor.id) };
    record.userRecords=Boolean(userRecords);record.acquisitionState = acquisitionState(actor); record.slotEligible = !userRecords&&permissions.slot&&slotEligible(actor);record.investigationAllowed=permissions.investigation;record.permissionReason=permissions.reason;
    record.eventsUnlocked=slotEligible(actor)&&notebookEventChapterAvailable(actor,storyHistory);
    record.affinityEvents=notebookStoryEventRows(storyHistory,actor);
    record.pendingChapters=[...NOTEBOOK_PENDING_CHAPTERS,...(record.eventsUnlocked?[]:['事件'])];
    record.images = actor.ui.images ?? [];
    record.sharedAlbum = service ? await service.media.album(actor) : null;
    const externalMedia=await service?.environment?.mediaFor?.(actor);
    record.media={portraits:[...(externalMedia?.portraits??[]),...(actor.ui.sourcePortraits??[])]};
    record.imageSelection = imageSelections[actor.id] ?? { mode: "portrait", portrait: 0, standee: 0 };
    record.price = business?.prices[actor.id]?.investigate ?? null;
    const headRef=record.sharedAlbum?.head?.[Number(record.imageSelection.head)||0];
    record.headUrl=headRef&&service?await service.media.url(headRef):null;
    if (unlocked) {
      record.groups = (userRecords?userNotebookGroups(actor,playerResources,{context:context||playerContext?{...context,...playerContext,locationName:(await runtime.availableLocations()).find(place=>place.id===context?.location?.id)?.name}:null,inventory:playerInventory}):notebookVariableGroups(actor).filter(group=>!['隐藏线','隐藏灵异线'].includes(group.label))).map(group=>notebookChapterPending(group.label,record)?{...group,fields:[],locked:true,pending:true}:group);
      record.tasks=await notebookChildRecords(runtime,actor,'task',taskSlots);record.achievements=await notebookChildRecords(runtime,actor,'achievement',taskSlots);
      record.schedule = actor.refs.schedule ? await runtime.store.getObject(actor.refs.schedule) : null;
      record.dateOverrides = dateOverrides[actor.id] ?? [];
    }
    characters.push(record);
  }
  const eligibleIds=new Set(characters.filter(x=>x.slotEligible).map(x=>x.id));
  return { characters, preferences, slots:slots.filter(x=>x.ref.id==='user'||eligibleIds.has(x.ref.id)), business, calendar: context, locations: (await runtime.availableLocations()).map((x) => ({ id: x.id, name: x.name })) };
}
export async function toggleNotebookFavourite(runtime, id) {
  if (!await runtime.store.getObject({ kind: "character", id })) throw Error("人物不存在");
  const value = await runtime.store.readJson("ui/notebook.json", { favourites: [] });
  value.favourites = value.favourites.includes(id) ? value.favourites.filter((x) => x !== id) : [...value.favourites, id];
  await runtime.store.writeJson("ui/notebook.json", value); return value;
}
export async function notebookMountCharacter(runtime, id) {
  if(id==='user')throw Error('玩家由独立管理脚本维护，不放入人物卡槽');
  const actor = await runtime.store.getObject({ kind: "character", id });
  if (!actor || !slotEligible(actor)) throw Error("物色完成后才能装入卡槽");
  const permissions=personnelPermissions(actor,await runtime.resolvePersonnelPermissions?.()??UNKNOWN_PERSONNEL_PERMISSIONS);if(!permissions.slot)throw Error(permissions.reason);
  return runtime.loadCharacter(`notebook-${id}`, id);
}
import { acquisitionState, notebookEligible, slotEligible } from './personnel-access.mjs';
import {personnelPermissions,UNKNOWN_PERSONNEL_PERMISSIONS} from './personnel-permissions.mjs';
