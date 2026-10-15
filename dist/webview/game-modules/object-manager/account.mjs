// Remove retired currency from old chat files without converting balances or rewards.
const retiredKeys = new Set(['starlight', 'rewardStarlight', '奖励星光点', '星光点', 'reward_starlight', 'starlightCost']);
const retiredElement = item => item && typeof item === 'object' && (['星光点', '奖励星光点', '成就任务奖励星光点'].includes(item.label) || item.name === '星光点兑换券' || ['starlight', 'rewardStarlight', 'account-view-starlight', 'account-view-rewardStarlight'].includes(item.id));
export function withoutRetiredCurrency(value) {
  if (Array.isArray(value)) return value.filter(item => !retiredElement(item)).map(withoutRetiredCurrency);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).filter(([key]) => !retiredKeys.has(key) && key !== '星光点兑换券').map(([key, item]) => [key, withoutRetiredCurrency(item)]));
  if (result.values && Array.isArray(value.elements)) {
    const visit = (elements, removed = false) => { for (const element of elements) { const remove = removed || retiredElement(element); if (remove) delete result.values[element.id]; if (Array.isArray(element.elements)) visit(element.elements, remove); } };
    visit(value.elements);
  }
  return result;
}
export function normalizeObjectResources(value = {}) {
  const result = withoutRetiredCurrency(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  return {...result, items: result.items && typeof result.items === 'object' && !Array.isArray(result.items) ? result.items : {}};
}
// Resource settlement belongs to this chat's object files, never to MVU.
export function createObjectRewardAccount(store) {
  const snapshot = async () => {
    const saved = await store.readJson("account/resources.json", { items: {} });
    const value = normalizeObjectResources(saved);
    if (JSON.stringify(saved) !== JSON.stringify(value)) await store.writeJson("account/resources.json", value);
    return value;
  };
  return {
    snapshot,
    async apply(reward) {
      const value = await snapshot();
      for (const item of withoutRetiredCurrency(reward).items ?? []) {
        const previous = value.items[item.name] ?? { quantity: 0, description: item.description ?? "" };
        value.items[item.name] = { ...previous, quantity: previous.quantity + item.quantity };
      }
      await store.writeJson("account/resources.json", value);
      return value;
    },
    async restoreIfUnchanged(before, written) {
      if (JSON.stringify(await snapshot()) !== JSON.stringify(written)) throw new Error("object account changed; refusing reward compensation");
      await store.writeJson("account/resources.json", normalizeObjectResources(before));
    }
  };
}
