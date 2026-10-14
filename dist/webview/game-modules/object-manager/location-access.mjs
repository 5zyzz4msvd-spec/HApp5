import { BUILTIN_OBJECT_CATALOG } from './builtin-catalog.mjs';
import { normalizeLocation } from './contracts.mjs';
import { personnelLocationEligible } from './personnel-access.mjs';

export function routineForCharacter(actor) {
  const schedules = BUILTIN_OBJECT_CATALOG.schedules;
  return schedules.find(x => x.ui.characterId === actor.id || x.ui.characterIds?.includes(actor.id)) ??
    schedules.find(x => x.ui.roleName === actor.name) ??
    schedules.find(x => [x.ui.roleName, ...(x.ui.roleAliases ?? [])].some(name => name && [actor.name, ...(actor.aliases ?? [])].includes(name)));
}

// Source templates remain definitions until acquisition. Old prematurely seeded
// files are retained for history; these gates only control current navigation.
export function locationAcquisitionNames(location) {
  if (Array.isArray(location.ui?.unlockWhenScoutedByNames)) return location.ui.unlockWhenScoutedByNames;
  const template = BUILTIN_OBJECT_CATALOG.locations.find(x => x.id === location.id);
  if (!template || location.ui?.source !== 'builtin-location-catalog') return [];
  if (Array.isArray(template.ui?.unlockWhenScoutedByNames)) return template.ui.unlockWhenScoutedByNames;
  if (template.data.category !== '住宅' || /住宅区|住宅街/.test(template.name)) return [];
  return BUILTIN_OBJECT_CATALOG.schedules.filter(x => x.defaultLocation?.id === location.id).map(x => x.ui.roleName);
}

export function canonicalHomeTemplateFor(actor) {
  const routine = routineForCharacter(actor);
  return BUILTIN_OBJECT_CATALOG.locations.find(x => x.id === routine?.defaultLocation?.id && x.data.category === '住宅' &&
    (locationAcquisitionNames(x).length || x.ui?.unlockWhenScoutedByIds?.length)) ?? null;
}

function definitionSignature(raw) {
  const value = structuredClone(raw); delete value.revision;
  function sorted(item) { return Array.isArray(item) ? item.map(sorted) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sorted(item[key])])) : item; }
  return JSON.stringify(sorted(value));
}

// Match the complete former homeFor() default, rather than a name/category
// heuristic. Personal descriptions, children, features, UI and names survive.
export function isPristineLegacyPersonnelHome(location, { ownerIds = [], names = [] } = {}) {
  if (location.ui?.source !== 'personnel-service' || !ownerIds.some(id => location.id === `home-${id}`.slice(0,127))) return false;
  const actual = structuredClone(location); delete actual.ui.jointResidenceAliasOf;
  return names.some(name => definitionSignature(actual) === definitionSignature(normalizeLocation({
    kind: 'location', id: location.id, name: `${name}的住处`,
    data: { category: '住宅', mapScope: 'world', mapId: location.id }, ui: { source: 'personnel-service' },
  })));
}

function supersededLegacyHome(location, actors) {
  if (location.ui?.source !== 'personnel-service' || !location.id.startsWith('home-')) return false;
  return actors.some(actor => {
    const canonical = canonicalHomeTemplateFor(actor), routine = routineForCharacter(actor);
    return personnelLocationEligible(actor) && canonical && canonical.id !== location.id && isPristineLegacyPersonnelHome(location, {
      ownerIds: [actor.id], names: [...new Set([actor.name, ...(actor.aliases ?? []), routine?.ui.roleName, ...(routine?.ui.roleAliases ?? [])].filter(Boolean))],
    });
  });
}

export function locationAcquired(location, actors) {
  if(location.ui?.source==='builtin-location-catalog'&&BUILTIN_OBJECT_CATALOG.inactiveRoutineLocationIds?.includes(location.id))return false;
  if (location.ui?.jointResidenceAliasOf) return false;
  if (supersededLegacyHome(location, actors)) return false;
  const names = locationAcquisitionNames(location), ids = location.ui?.unlockWhenScoutedByIds ??
    (location.ui?.source === 'personnel-service' && location.id.startsWith('home-') ? [location.id.slice(5)] : []);
  return !names.length && !ids.length || actors.some(actor => personnelLocationEligible(actor) &&
    (ids.includes(actor.id) || names.some(name => [actor.name, ...(actor.aliases ?? []), routineForCharacter(actor)?.ui.roleName].includes(name))));
}

export function availableLocationRows(locations, actors) {
  const hidden = new Set(locations.filter(x => !locationAcquired(x, actors)).map(x => x.id));
  let changed = true;
  while (changed) { changed = false; for (const parent of locations) if (hidden.has(parent.id)) for (const ref of parent.children) if (!hidden.has(ref.id)) { hidden.add(ref.id); changed = true; } }
  const visible = new Set(locations.filter(x => !hidden.has(x.id)).map(x => x.id));
  return locations.filter(x => visible.has(x.id)).map(raw => {
    const value = structuredClone(raw);
    value.children = value.children.filter(ref => visible.has(ref.id));
    if (value.ui.board) value.ui.board.cells = value.ui.board.cells.map(id => id && !visible.has(id) ? null : id);
    return value;
  });
}

export async function availableLocations(runtime) {
  return availableLocationRows(await runtime.store.listObjects('location'), await runtime.store.listObjects('character'));
}

export async function retainHiddenLocationChildren(runtime, object) {
  const existing = await runtime.store.getObject(object);
  if (!existing) return object;
  const visible = new Set((await availableLocations(runtime)).map(x => x.id));
  for (const ref of existing.children.filter(ref => !visible.has(ref.id))) {
    if (!object.children.some(x => x.id === ref.id)) object.children.push(ref);
    if (object.ui.board && !object.ui.board.cells.includes(ref.id)) {
      const position = existing.ui.board?.cells.indexOf(ref.id) ?? -1;
      if (position >= 0 && !object.ui.board.cells[position]) { while (object.ui.board.cells.length <= position) object.ui.board.cells.push(null); object.ui.board.cells[position] = ref.id; }
      else object.ui.board.cells.push(ref.id);
    }
  }
  return object;
}

export function deferredLocationTemplate(ref) {
  if (ref?.kind !== 'location') return null;
  return BUILTIN_OBJECT_CATALOG.locations.find(x => x.id === ref.id && (locationAcquisitionNames(x).length || x.ui?.unlockWhenScoutedByIds?.length)) ?? null;
}
