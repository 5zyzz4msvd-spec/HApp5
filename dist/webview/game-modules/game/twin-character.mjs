// One persistent character; members are presentation data, never extra targets.
import { installCharacterRoutine, scheduleDefinitionHash } from '../object-manager/catalog-install.mjs';
import { routineForCharacter, isPristineLegacyPersonnelHome } from '../object-manager/location-access.mjs';
import { plannedHomeRef, recoverPersonnelLocationUnlocks } from '../object-manager/personnel-homes.mjs';

function completedScout(record, id) {
  return record?.kind === 'scout' && record.targetId === id &&
    typeof record.completedAt === 'number' && Number.isFinite(record.completedAt);
}

async function archiveTwinMember(runtime, member, ownerId, ownerName, ownerScheduleId) {
  const file = 'archives/twin-members/' + member.id + '.json';
  const previous = await runtime.store.readJson(file, null);
  const live = await runtime.store.getObject({ kind: 'character', id: member.id });
  const legacy = live ?? (previous?.owner?.id === ownerId ? previous.character : null);
  if (!legacy || legacy.ui?.source !== 'tutorial-hacker-twins') return;
  for (const slot of await runtime.store.getCharacterSlots()) if (slot.ref.id === member.id) await runtime.unloadCharacter(slot.slotId);
  const dossiers = await runtime.store.readJson('services/dossiers.json', {});
  const detective = await runtime.store.readJson('services/detective.json', { active: null, history: [] });
  const payment = await runtime.store.readJson('services/detective-payment.json', null);
  const history = (detective.history ?? []).filter(job => job.targetId === member.id);
  const receipts = previous?.serviceReceipts ?? {
    dossier: dossiers[member.id] ?? null, history,
    active: detective.active?.targetId === member.id ? detective.active : null,
    payment: payment?.job?.targetId === member.id ? payment : null,
  };
  const completionRecords = [...new Map([...(previous?.scoutCompletionRecords ?? []), ...history.filter(job => completedScout(job, member.id))]
    .map(job => [JSON.stringify([job.id, job.completedAt]), job])).values()];
  const qualified = previous?.formalScoutQualification === true || legacy.ui.residenceUnlocked === true || dossiers[member.id]?.scouted === true ||
    history.some(job => completedScout(job, member.id)) || receipts.dossier?.scouted === true ||
    receipts.history?.some(job => completedScout(job, member.id)) === true;
  const legacySchedule = legacy.refs?.schedule ? await runtime.store.getObject(legacy.refs.schedule) : null;
  const archiveSchedule = legacySchedule?.id === member.id + '-weekly' && legacySchedule.id !== ownerScheduleId;
  const archive = { ...(previous ?? {}), schema: 1, owner: { kind: 'character', id: ownerId },
    character: previous?.character ?? legacy, schedule: previous?.schedule ?? (archiveSchedule ? legacySchedule : null),
    serviceReceipts: receipts, scoutCompletionRecords: completionRecords,
    formalScoutQualification: previous?.formalScoutQualification === true || qualified,
    reason: '双胞胎永久共用一个游戏角色；保留旧成员数据以便恢复。' };
  const writes = new Map([[file, archive]]);
  if (live) writes.set('objects/character/' + member.id + '.json', null);
  if (archiveSchedule) writes.set('objects/schedule/' + legacySchedule.id + '.json', null);
  if (qualified) {
    const owner = await runtime.store.getObject({ kind: 'character', id: ownerId });
    owner.ui = { ...owner.ui, residenceUnlocked: true, scoutingPending: false, acquisitionState: 'scouted' };
    writes.set('objects/character/' + ownerId + '.json', owner);
    // Transfer this one qualification only. Keep each dossier's private investigation fields separate.
    dossiers[ownerId] = { ...(dossiers[ownerId] ?? {}), scouted: true };
    writes.set('services/dossiers.json', dossiers);
  }
  // An unfinished job keeps its fee, deadline and status; its target becomes the shared owner.
  if (detective.active?.targetId === member.id) {
    detective.active = { ...detective.active, targetId: ownerId, targetName: ownerName };
    writes.set('services/detective.json', detective);
  }
  await runtime.store.applyFileBatch(writes);
}

async function supersedeTwinResidences(runtime, twins, owner) {
  const commonHome = plannedHomeRef(owner), ids = twins.members.map(member => member.id), names = twins.members.map(member => member.codename);
  const locations = await runtime.store.listObjects('location');
  const writes = new Map(), file = 'archives/twin-residences/' + owner.id + '.json';
  const snapshots = await runtime.store.readJson(file, {});
  for (const location of locations) {
    if (location.id === commonHome.id) continue;
    const pristine = isPristineLegacyPersonnelHome(location, { ownerIds: ids, names: [...names, owner.name, ...owner.aliases] });
    if (!pristine) {
      // Undo only a marker recorded by this migration; keep every current user edit.
      if (snapshots[location.id] && !snapshots[location.id].ui?.jointResidenceAliasOf && location.ui.jointResidenceAliasOf?.id === commonHome.id) {
        const restored = structuredClone(location); delete restored.ui.jointResidenceAliasOf;
        writes.set('objects/location/' + location.id + '.json', restored);
      }
      continue;
    }
    if (location.ui.jointResidenceAliasOf?.id === commonHome.id) continue;
    snapshots[location.id] ??= location;
    writes.set('objects/location/' + location.id + '.json', { ...location, ui: { ...location.ui, jointResidenceAliasOf: commonHome } });
  }
  if (writes.size) { writes.set(file, snapshots); await runtime.store.applyFileBatch(writes); }
}

async function markPristineLegacyRoutine(runtime, actor, twins) {
  if (!actor.refs.schedule) return;
  const current = await runtime.store.getObject(actor.refs.schedule);
  if (!current || current.id !== actor.id + '-weekly' || current.ui?.routineKind !== 'contact-service' ||
    Object.keys(current.ui).length !== 1) return;
  const currentHash = await scheduleDefinitionHash(current);
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const name of ['双胞胎工作日程', twins.members[0].codename + '工作日程']) {
    const original = { kind: 'schedule', id: current.id, name,
      defaultLocation: { kind: 'location', id: 'twins-workshop' },
      days: Object.fromEntries(weekdays.map(day => [day, { entries: [{ id: 'work', start: '08:00', end: '20:00', note: '维护应用与联络', location: { kind: 'location', id: 'twins-workshop' } }] }])),
      ui: { routineKind: 'contact-service' } };
    if (currentHash !== await scheduleDefinitionHash(original)) continue;
    // Only an exact former default becomes managed by the catalog's hash guard.
    await runtime.saveObjectDefinition({ ...current, ui: { ...current.ui, source: 'builtin-character-catalog', routineRevision: 0, builtinScheduleHash: currentHash } });
    return;
  }
}

export async function installTwinCharacter(runtime, twins) {
  const ownerId = twins.mechanics?.characterId ?? twins.members[0].id;
  const name = twins.mechanics?.characterName ?? twins.sharedAccount;
  const current = await runtime.store.getObject({ kind: 'character', id: ownerId });
  if (current && current.ui?.source !== 'tutorial-hacker-twins') throw new Error('双胞胎角色ID已有其他来源的对象，不能覆盖');
  const memberNames = twins.members.map(member => member.codename);
  const catalogAliases = routineForCharacter({ id: ownerId, name, aliases: memberNames })?.ui.roleAliases ?? [];
  const definition = {
    ...(current ?? {}), kind: 'character', id: ownerId, name,
    aliases: [...new Set([...(current?.aliases ?? []), ...memberNames, ...catalogAliases])], summary: '19岁双胞胎，以一个共同角色维护。两个名称均为代号。',
    values: { ...(current?.values ?? {}), gender: '女', age: 19, height: twins.members[0].heightCm,
      identity: '为催眠APP背后组织工作的19岁双胞胎黑客，真名未公开。',
      appearance: twins.members.map(member => member.appearance).join('\n'),
      personality: twins.members.map(member => member.codename + '：' + member.personality).join('\n'),
      background: JSON.stringify(twins) },
    ui: { ...(current?.ui ?? {}), source: 'tutorial-hacker-twins', personaVersion: twins.personaVersion,
      acquisitionState: 'scouted', images: current?.ui?.images ?? [],
      imagePresentation:{mode:'joint',assetId:'hacker-twins',memberNames:['织田信长','明智光秀']},
      sceneMembers: twins.members.map(member => ({ id: member.id, name: member.codename, alias:true })) },
    worldbook: { entries: [
      ...(current?.worldbook?.entries ?? []).filter(entry => entry.id !== 'persona'),
      { id: 'persona', comment: '[mvu_plot]双胞胎人设与共同角色边界', constant: true, content: JSON.stringify(twins) },
    ] },
  };
  await runtime.saveCharacterDefinition(definition);
  // Archive receipts and transfer formal acquisition in the same recoverable write batch.
  for (const member of twins.members.filter(member => member.id !== ownerId)) {
    await archiveTwinMember(runtime, member, ownerId, name, current?.refs?.schedule?.id);
  }
  await runtime.refreshPersonnelPermissions();
  const actor = await runtime.store.getObject({ kind: 'character', id: ownerId });
  await markPristineLegacyRoutine(runtime, actor, twins);
  await installCharacterRoutine(runtime, actor);
  await supersedeTwinResidences(runtime, twins, actor);
  await recoverPersonnelLocationUnlocks(runtime);
  return runtime.store.getObject({ kind: 'character', id: ownerId });
}
