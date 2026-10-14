// Native SillyTavern exposes chat APIs through getContext(); older helpers may
// also expose the same function directly on the namespace.
export function hasTavernContext(view){
 return typeof view?.SillyTavern?.getContext==='function'||typeof view?.SillyTavern?.getCurrentChatId==='function';
}
export function readTavernChatId(view){
 const api=view?.SillyTavern;
 if(typeof api?.getCurrentChatId==='function')return String(api.getCurrentChatId()??'');
 const context=api?.getContext?.();
 return String(typeof context?.getCurrentChatId==='function'?context.getCurrentChatId()??'':context?.chatId??'');
}
