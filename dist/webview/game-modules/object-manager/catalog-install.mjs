import { BUILTIN_OBJECT_CATALOG } from "./builtin-catalog.mjs";
import { normalizeSchedule } from "./contracts.mjs";
import { sha256 } from "../workshop/task-package.mjs";
import { locationAcquired, routineForCharacter } from './location-access.mjs';
import { recoverPersonnelLocationUnlocks, planUnlockedPersonnelLocations, fillLocationBackgroundReference } from './personnel-homes.mjs';

function addChild(parent, id) {
  if (!parent.children.some((x) => x.id === id)) parent.children.push({ kind: "location", id });
  parent.ui.board ??= { enabled: true, columns: 3, cells: [] };
  if (parent.children.length === 1) parent.ui.board.enabled = true;
  if (!parent.ui.board.cells.includes(id)) {
    const empty = parent.ui.board.cells.indexOf(null);
    if (empty >= 0) parent.ui.board.cells[empty] = id;
    else parent.ui.board.cells.push(id);
  }
}
function removeChild(parent, id) {
  parent.children = parent.children.filter((x) => x.id !== id);
  if (parent.ui.board) parent.ui.board.cells = parent.ui.board.cells.map((x) => x === id ? null : x);
}

export async function installBuiltinLocations(runtime) {
  const actors = await runtime.store.listObjects('character');
  const templates = BUILTIN_OBJECT_CATALOG.locations.filter(x => locationAcquired(x, actors));
  const current = await runtime.store.listObjects("location");
  const existing = new Map(current.map((x) => [x.id, x]));
  const previousParents = new Map();
  for (const p of current) for (const child of p.children) previousParents.set(child.id, p.id);
  const candidates = new Map(current.map((x) => [x.id, structuredClone(x)]));
  const changed = new Set();
  for (const template of templates) if (!candidates.has(template.id)) {
    const value = structuredClone(template);
    value.children = value.children.filter(ref => templates.some(x => x.id === ref.id) || candidates.has(ref.id) && locationAcquired(candidates.get(ref.id), actors));
    if (value.ui.board) value.ui.board.cells = value.ui.board.cells.map(id => id && !value.children.some(x => x.id === id) ? null : id);
    candidates.set(template.id, value); changed.add(template.id);
  }
  for (const template of templates) {
    const parent = candidates.get(template.id);
    if(fillLocationBackgroundReference(parent,template))changed.add(parent.id);
    if(template.id==='twins-workshop'&&['书店二楼工作间','双胞胎工作室','书店二楼工作室'].includes(parent.name)){parent.name=template.name;parent.data.description=template.data.description;changed.add(parent.id);}
    if(template.data?.routineKey==='twins-home'&&parent.name==='双胞胎共同住宅'){parent.name=template.name;changed.add(parent.id);}
    for (const ref of template.children) {
      const child = candidates.get(ref.id), was = existing.get(ref.id), oldParentId = previousParents.get(ref.id);
      if (!child || !locationAcquired(child, actors)) continue;
      if (!was || oldParentId === parent.id) {
        if (!parent.children.some((x) => x.id === child.id)) { addChild(parent, child.id); changed.add(parent.id); }
        continue;
      }
      const childTemplate = BUILTIN_OBJECT_CATALOG.locations.find((x) => x.id === child.id);
      const compatibleMove = oldParentId && oldParentId === childTemplate?.ui.routinePreviousParent && was.ui.source === "builtin-location-catalog";
      if (compatibleMove) {
        removeChild(candidates.get(oldParentId), child.id); addChild(parent, child.id);
        changed.add(oldParentId); changed.add(parent.id);
        if (childTemplate.ui.routinePreviousName && child.name === childTemplate.ui.routinePreviousName) {
          child.name = childTemplate.name; changed.add(child.id);
        }
      } else if (!existing.has(parent.id)) {
        // User-reparented or deliberately detached locations keep that choice.
        removeChild(parent, child.id);
      }
    }
  }
  if (changed.size) await runtime.saveLocationBatch([...changed].map((id) => candidates.get(id)));
  await runtime.store.writeJson("catalog/ordinary-locations.json", { revision: BUILTIN_OBJECT_CATALOG.routineRevision });
}

export async function scheduleDefinitionHash(value) {
  const normalized = normalizeSchedule(value);
  delete normalized.id; delete normalized.revision; delete normalized.ui;
  return sha256(JSON.stringify(normalized));
}

async function pristineServiceHomeRoutine(character, current, template) {
  if (current?.ui.source !== 'personnel-service' || current.ui.routineKind !== 'home') return false;
  const home = { kind: 'location', id: `home-${character.id}`.slice(0,127) };
  const signature = await scheduleDefinitionHash(current);
  const names = [...new Set([character.name, ...(character.aliases ?? []), template.ui.roleName, ...(template.ui.roleAliases ?? [])].filter(Boolean))];
  for (const name of names) if (signature === await scheduleDefinitionHash({
    kind: 'schedule', id: current.id, name: `${name}日程`, defaultLocation: home, emptyPolicy: {location:home},
    ui: {source:'personnel-service',routineKind:'home'},
  })) return true;
  return false;
}

export async function installCharacterRoutine(runtime, rawCharacter) {
  const template = routineForCharacter(rawCharacter);
  if (!template) return rawCharacter;
  const character = await runtime.store.getObject(rawCharacter);
  const current = character.refs.schedule ? await runtime.store.getObject(character.refs.schedule) : null;
  const next = structuredClone(template); next.id = `${character.id}-weekly`;
  if (!character.refs.schedule) {
    // A detached but retained schedule is the user's choice, not a missing seed.
    if (await runtime.store.getObject(next)) return character;
    next.ui.builtinScheduleHash = await scheduleDefinitionHash(next);
    await runtime.createChildObject(character, next);
  } else if (await pristineServiceHomeRoutine(character, current, next)) {
    // The exact former route-generated fallback points at the retired placeholder.
    // Reuse its owned schedule ID and UI preferences; edited weeks are untouched.
    next.id = current.id; next.ui = {...current.ui,...next.ui,builtinScheduleHash:await scheduleDefinitionHash(next)};
    await runtime.saveObjectDefinition(next);
  } else if (current?.ui.source === 'personnel-service' && character.id === 'lin-an' && current.ui.routineKind === 'detective' &&
    current.defaultLocation?.id === 'lin-an-office' && current.emptyPolicy.location?.id === 'lin-an-office' && !current.emptyPolicy.event && !Object.keys(current.holidays).length &&
    Object.values(current.days).every(day => !day.entries.length && day.defaultLocation?.id === 'lin-an-office') && !current.summary && !current.worldbook.entries.length && !current.elements.length && !current.links.length) {
    // Exact previous service default only; edited detective schedules survive.
    next.id = current.id; next.ui = { ...current.ui, ...next.ui, builtinScheduleHash: await scheduleDefinitionHash(next) };
    await runtime.saveObjectDefinition(next);
  } else if (current && current.ui.source === "builtin-character-catalog") {
    const currentHash = await scheduleDefinitionHash(current);
    const legacy = BUILTIN_OBJECT_CATALOG.legacySchedules.find((x) => x.id === current.id);
    const pristine = currentHash === current.ui.builtinScheduleHash || legacy && currentHash === await scheduleDefinitionHash(legacy);
    if (pristine && current.ui.routineRevision !== BUILTIN_OBJECT_CATALOG.routineRevision) {
      next.id = current.id; next.ui = { ...current.ui, ...next.ui, builtinScheduleHash: await scheduleDefinitionHash(next) };
      await runtime.saveObjectDefinition(next);
    }
  }
  const updated=await runtime.store.getObject(character), locations=await planUnlockedPersonnelLocations(runtime,updated);
  if(locations.length)await runtime._writeLocalObjects([updated,...locations]);
  return updated;
}

export async function prepareRoutineCatalog(runtime) {
  await installBuiltinLocations(runtime);
  await recoverPersonnelLocationUnlocks(runtime);
  for (const event of BUILTIN_OBJECT_CATALOG.events) if (!await runtime.store.getObject(event)) await runtime.saveObjectDefinition(event);
  for (const character of await runtime.store.listObjects("character")) await installCharacterRoutine(runtime, character);
  runtime.__routineCatalogRevision = BUILTIN_OBJECT_CATALOG.routineRevision;
}
