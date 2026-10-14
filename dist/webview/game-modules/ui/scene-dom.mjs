const scenes=new WeakMap();
export function registerSceneRoot(doc,root){scenes.set(doc,root);}
export function sceneRootFor(doc){const root=scenes.get(doc);return root?.isConnected?root:doc.querySelector('.routine-scene');}
export function unregisterSceneRoot(doc,root){if(scenes.get(doc)===root)scenes.delete(doc);}
