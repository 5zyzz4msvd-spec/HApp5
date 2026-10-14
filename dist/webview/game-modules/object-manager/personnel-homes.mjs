import { normalizeLocation, normalizeSchedule } from './contracts.mjs';
import { BUILTIN_OBJECT_CATALOG } from './builtin-catalog.mjs';
import { canonicalHomeTemplateFor, locationAcquired, locationAcquisitionNames, routineForCharacter } from './location-access.mjs';
import { initiallyKnown, personnelLocationEligible, scoutingRequired } from './personnel-access.mjs';
import { sha256 } from '../workshop/task-package.mjs';

export function fillLocationBackgroundReference(value, template) {
  if(value.ui.source!=='builtin-location-catalog')return false;
  const selected=Boolean(value.ui.sceneBackground)||(value.ui.images?.length??0)>0||Object.keys(value.ui.photo_refs??value.data.photo_refs??{}).length>0;
  if(selected)return false;
  let changed=false;const ready=template.ui.sceneBackgroundStatus==='ready'&&template.ui.sceneBackground;
  for(const key of ['sceneBackground','sceneBackgroundStatus','sceneBackgroundProvenance'])if(template.ui[key]!=null&&(ready||value.ui[key]==null)&&JSON.stringify(value.ui[key])!==JSON.stringify(template.ui[key])){value.ui[key]=structuredClone(template.ui[key]);changed=true;}
  return changed;
}

export function plannedHomeRef(actor) {
  const home = canonicalHomeTemplateFor(actor);
  return home ? { kind: 'location', id: home.id } : { kind: 'location', id: `home-${actor.id}`.slice(0, 127) };
}

export async function planUnlockedPersonnelLocations(runtime, actor, {objectOverrides=[],charactersOverride=null}={}) {
  if (!personnelLocationEligible(actor)) return [];
  const existing=new Map((await runtime.store.listObjects('location')).map(x=>[x.id,x]));
  for(const value of objectOverrides)if(value?.kind==='location')existing.set(value.id,value);
  const current=[...existing.values()], actors=(charactersOverride??await runtime.store.listObjects('character')).filter(x=>x.id!==actor.id).concat(actor);
  const values = new Map(current.map(x => [x.id, structuredClone(x)])), writes = new Map();
  const templates = BUILTIN_OBJECT_CATALOG.locations.filter(x => (locationAcquisitionNames(x).length || x.ui?.unlockWhenScoutedByIds?.length) && locationAcquired(x, actors));
  const homeRef = plannedHomeRef(actor);
  if (!templates.some(x => x.id === homeRef.id) && !values.has(homeRef.id)) templates.push(normalizeLocation({ ...homeRef, name: `${actor.name}的住处`, data: { category: '住宅', mapScope: 'world', sourceMapId: homeRef.id, description: '私人住宅。前往住址不等于获得入内许可。' }, ui: { source: 'personnel-service', unlockWhenScoutedByIds: [actor.id],sceneBackgroundStatus:'pending',sceneBackgroundProvenance:{status:'pending',reason:'尚无已确认的住宅原图'} } }));
  for (const template of templates) if (!values.has(template.id)) {
    const value = structuredClone(template); values.set(value.id, value); writes.set(value.id, value);
  } else {
    const value=values.get(template.id);
    if(fillLocationBackgroundReference(value,template))writes.set(value.id,value);
  }
  for (const template of templates) {
    const home = values.get(template.id);
    home.children = home.children.filter(ref => values.has(ref.id));
    if (home.ui.board) home.ui.board.cells = home.ui.board.cells.map(id => id && !values.has(id) ? null : id);
    // Move only a documented old built-in parent; preserve user placement and
    // deliberate detachment, including their retained historical object file.
    const existing = current.find(x => x.id === home.id), previous = [...values.values()].find(x => x.children.some(ref => ref.id === home.id));
    if (existing && !(existing.ui.source === 'builtin-location-catalog' && previous?.id === template.ui.routinePreviousParent)) continue;
    const parentTemplate = BUILTIN_OBJECT_CATALOG.locations.find(x => x.children.some(ref => ref.id === home.id));
    const parent = values.get(parentTemplate?.id) ?? [...values.values()].find(x => x.data?.routineKey === 'residential') ?? values.get('map-world');
    if (!parent) throw Error('住宅缺少城市父地点');
    if (previous && previous.id !== parent.id) { previous.children = previous.children.filter(ref => ref.id !== home.id); if (previous.ui.board) previous.ui.board.cells = previous.ui.board.cells.map(id => id === home.id ? null : id); writes.set(previous.id, previous); }
    if (!parent.children.some(ref => ref.id === home.id)) parent.children.push({ kind: 'location', id: home.id });
    parent.ui.board ??= { enabled: true, columns: 3, cells: [] };
    if (parent.ui.board.enabled && !parent.ui.board.cells.includes(home.id)) { const empty = parent.ui.board.cells.indexOf(null); if (empty >= 0) parent.ui.board.cells[empty] = home.id; else parent.ui.board.cells.push(home.id); }
    writes.set(parent.id, parent);
  }
  if (!actor.refs.schedule&&!await runtime.store.getObject({kind:'schedule',id:`${actor.id}-weekly`.slice(0,127)})) {
    const template=routineForCharacter(actor);
    const schedule = normalizeSchedule(template?{...structuredClone(template),id:`${actor.id}-weekly`.slice(0,127)}:{ kind: 'schedule', id: `${actor.id}-weekly`.slice(0, 127), name: `${actor.name}日程`, defaultLocation: homeRef, emptyPolicy: { location: homeRef }, ui: { source: 'personnel-service', routineKind: 'home', roleName: actor.name } });
    if(template){const definition=structuredClone(schedule);delete definition.id;delete definition.revision;delete definition.ui;schedule.ui.builtinScheduleHash=await sha256(JSON.stringify(definition));}
    actor.refs.schedule = { kind: 'schedule', id: schedule.id }; writes.set(schedule.id, schedule);
  }
  return [...writes.values()];
}

export async function recoverPersonnelLocationUnlocks(runtime) {
  const dossiers = await runtime.store.readJson('services/dossiers.json', {}), state = await runtime.store.readJson('services/detective.json', { history: [] });
  for (const actor of await runtime.store.listObjects('character')) {
    const completed = dossiers[actor.id]?.scouted === true || state.history?.some(job => job.kind === 'scout' && job.targetId === actor.id && typeof job.completedAt==='number'&&Number.isFinite(job.completedAt));
    const before=JSON.stringify(actor.ui);
    if(completed){actor.ui.scoutCompleted=true;actor.ui.residenceUnlocked=true;actor.ui.acquisitionState='scouted';actor.ui.scoutingPending=false;}
    if(initiallyKnown(actor)){actor.ui.acquisitionPolicy='known';actor.ui.acquisitionState='scouted';actor.ui.scoutingPending=false;}
    else if(scoutingRequired(actor)&&!completed&&!actor.ui.residenceUnlocked&&!actor.ui.scoutCompleted){actor.ui.acquisitionPolicy='scout';if(!actor.ui.scoutingPending&&actor.ui.acquisitionState!=='scouting')actor.ui.acquisitionState='unscouted';}
    if (!personnelLocationEligible(actor)) { if(JSON.stringify(actor.ui)!==before)await runtime._writeLocalObjects([actor]); continue; }
    const writes = await planUnlockedPersonnelLocations(runtime, actor);
    if (writes.length || JSON.stringify(actor.ui)!==before) await runtime._writeLocalObjects([actor, ...writes]);
  }
}
