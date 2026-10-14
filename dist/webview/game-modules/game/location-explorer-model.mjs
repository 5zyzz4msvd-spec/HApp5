import { locationForest } from '../object-manager/locations.mjs';

export function locationExplorerModel(locations, { selectedId, currentId, expanded = [], expandSelection = true } = {}) {
  const forest = locationForest(locations);
  const selected = forest.nodes.get(selectedId) ?? forest.nodes.get(currentId) ?? forest.nodes.get(forest.roots[0]?.id);
  const open = new Set(expanded.filter(id => forest.nodes.has(id)));
  if (expandSelection) for (const ref of selected?.path.slice(0, -1) ?? []) open.add(ref.id);
  const path = id => (forest.nodes.get(id)?.path ?? []).map(ref => forest.nodes.get(ref.id).object);
  return { forest, selected: selected?.object ?? null, expanded: open, path,
    search(query) {
      const needle = String(query).trim().toLocaleLowerCase();
      if (!needle) return [];
      return locations.filter(place => [place.name, place.data?.category, place.data?.description, ...path(place.id).map(x => x.name)]
        .join(' ').toLocaleLowerCase().includes(needle));
    },
  };
}

export function locationImageFile(place) {
  return place?.ui?.sceneBackground || place?.ui?.locationImage?.file ||
    (place?.data?.sourceMapId === 'classroom' ? 'scene-presence/backgrounds/classroom.png' : '');
}
