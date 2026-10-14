// Visual members share their owner's state and selection. They are never objects.
export function sceneActorMatchesCast(actor, cast = []) {
  const names = [actor.id, actor.name, ...(actor.aliases ?? []), ...(actor.ui?.sceneMembers ?? []).flatMap(member => [member.id, member.name])];
  return names.some(name => cast.includes(name));
}

export function sceneActorAsset(actor, assets = []) {
  const joint = assets.find(asset => asset.presentationMode === 'joint' &&
    (asset.id === actor?.ui?.imagePresentation?.assetId || asset.ownerId === actor?.id ||
      asset.name === actor?.name || (asset.memberIds ?? []).includes(actor?.id)));
  if (actor?.ui?.imagePresentation?.mode === 'joint' || actor?.ui?.source === 'tutorial-hacker-twins') return joint;
  return joint ?? assets.find(asset => asset.name === actor?.name)
    ?? assets.find(asset => (actor?.aliases ?? []).includes(asset.name));
}

export function sceneActorMatchesSpeaker(actor, speaker) {
  if (!speaker) return false;
  return sceneActorMatchesCast(actor, [speaker]);
}

export function sceneStandeeEntries(actors, assets) {
  const seenJoint = new Set();
  return actors.flatMap(owner => {
    const joint = sceneActorAsset(owner, assets);
    if (!joint && (owner.ui?.imagePresentation?.mode === 'joint' || owner.ui?.source === 'tutorial-hacker-twins')) return [];
    if (joint?.presentationMode === 'joint') {
      if (!joint.standee || seenJoint.has(joint.id)) return [];
      seenJoint.add(joint.id);
      const actual = Number(owner.values?.height);
      const heightCm = Number.isFinite(actual) && actual > 0 ? actual : joint.heightCm;
      const actor = { ...owner, name: joint.name,
        aliases: [...new Set([...(owner.aliases ?? []), ...(joint.memberNames ?? []), ...(joint.memberIds ?? [])])],
        presentationId: (joint.ownerId ?? owner.id) + '/' + joint.id };
      return [{ actor, asset: joint, geometry: joint.geometry, heightCm, assetHeightCm: joint.heightCm }];
    }
    const members = owner.ui?.sceneMembers?.length ? owner.ui.sceneMembers : [{ id: owner.id, name: owner.name }];
    return members.map(member => {
      const asset = assets.find(asset => asset.id === member.id || asset.name === member.name);
      if (!asset?.standee) return null;
      const actual = Number(owner.values?.height);
      const heightCm = Number.isFinite(actual) && actual > 0 ? actual : Number(member.heightCm) || asset.heightCm;
      const actor = { ...owner, name: member.name, presentationId: owner.id + '/' + member.id };
      return { actor, asset, geometry: asset.geometry, heightCm, assetHeightCm: asset.heightCm };
    }).filter(Boolean);
  });
}
