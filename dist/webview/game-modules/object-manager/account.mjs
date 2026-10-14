// Resource settlement belongs to this chat's object files, never to MVU.
export function createObjectRewardAccount(store) {
  const snapshot = () => store.readJson("account/resources.json", { starlight: 0, items: {} });
  return {
    snapshot,
    async apply(reward) {
      const value = await snapshot();
      value.starlight += Number(reward.starlight ?? 0);
      for (const item of reward.items ?? []) {
        const previous = value.items[item.name] ?? { quantity: 0, description: item.description ?? "" };
        value.items[item.name] = { ...previous, quantity: previous.quantity + item.quantity };
      }
      await store.writeJson("account/resources.json", value);
      return value;
    },
    async restoreIfUnchanged(before, written) {
      if (JSON.stringify(await snapshot()) !== JSON.stringify(written)) throw new Error("object account changed; refusing reward compensation");
      await store.writeJson("account/resources.json", before);
    }
  };
}
