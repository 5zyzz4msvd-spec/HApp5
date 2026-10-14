export const PHONE_MESSAGE_FILE = 'phone/messages.json';
// ChatObjectStore supplies the chat-specific file root, backup and browser driver.
export function phoneMessageFiles(store) {
 if (!store?.readJson || !store?.writeJson || !store.chatId) throw Error('手机消息需要独立聊天文件存储');
 return {
  async read() {
   const current = await store.readJson(PHONE_MESSAGE_FILE, null);
   if (current) return current;
   const previous = await store.readJson('ui/contact-chat.json', null);
   if (previous) await store.writeJson(PHONE_MESSAGE_FILE, previous);
   return previous;
  },
  write: value => store.writeJson(PHONE_MESSAGE_FILE, value),
 };
}
