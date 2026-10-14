const controllers=new WeakMap();
export function createSceneWindowController(){
 let current=null,closing=null;
 return{
  get switching(){return Boolean(current&&closing);},
  open(close){const old=current,lease={close};current=lease;closing=old;const ready=Promise.resolve(old?.close()).finally(()=>{if(closing===old)closing=null;});return{ready,isCurrent:()=>current===lease};},
  release(close){if(closing?.close===close)return;if(current?.close===close)current=null;},
  close(){const old=current;current=null;return old?.close();}
 };
}
export function sceneWindowController(doc){if(!controllers.has(doc))controllers.set(doc,createSceneWindowController());return controllers.get(doc);}
