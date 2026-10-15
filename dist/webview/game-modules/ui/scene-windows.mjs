const controllers=new WeakMap();
export function createSceneWindowController(){
 let current=null,lastClose=null;const closing=new Set();
 function beginClose(lease){
  if(!lease)return Promise.resolve();if(lease.closing)return lease.closing;
  closing.add(lease);let result;try{result=lease.close();}catch(error){result=Promise.reject(error);}
  lease.closing=Promise.resolve(result).finally(()=>closing.delete(lease));return lease.closing;
 }
 function handle(lease,reused){return{ready:lease.ready,reused,key:lease.key,isCurrent:()=>current===lease};}
 return{
  get switching(){return Boolean(current&&closing.size);},
  open(close,{key=close}={}){
   if(typeof close!=='function')throw TypeError('window close handler must be a function');
   if(current&&current.key===key)return handle(current,true);
   const old=current,lease={close,key},pending=old?null:lastClose;current=lease;lastClose=null;lease.ready=(old?beginClose(old):pending??Promise.resolve()).catch(error=>{if(current===lease)current=null;throw error;});return handle(lease,false);
  },
  release(close,{key}={}){if([...closing].some(lease=>lease.close===close&&(key===undefined||lease.key===key)))return;if(current?.close===close&&(key===undefined||current.key===key))current=null;},
  close(){if(!current)return lastClose??Promise.resolve();const old=current;current=null;lastClose=beginClose(old);return lastClose;}
 };
}
export function sceneWindowController(doc){if(!controllers.has(doc))controllers.set(doc,createSceneWindowController());return controllers.get(doc);}
