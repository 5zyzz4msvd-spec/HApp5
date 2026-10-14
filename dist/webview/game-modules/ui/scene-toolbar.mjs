import { sceneRootFor } from './scene-dom.mjs';
import { animateSurface } from './surface-motion.mjs';
import { installSerialMotion } from './serial-motion.mjs';
import { sceneWindowController } from './scene-windows.mjs';
const active=new WeakMap();
export function dockSceneToolbar(doc,toolbar){
 const bar=sceneRootFor(doc)?.querySelector('.scene-topbar');
 if(!bar||!toolbar?.isConnected)return{docked:false,ready:Promise.resolve(),destroy(){}};
 active.get(doc)?.destroy();
 const queue=installSerialMotion(doc),parent=toolbar.parentNode,marker=doc.createComment('scene toolbar'),scene=bar.closest('.routine-scene');parent.insertBefore(marker,toolbar);
 const originalScope=toolbar.getRootNode(),barScope=bar.getRootNode(),sourceStyle=toolbar.closest('.dn-window,.collection-window,.location-window')?.querySelector('style');let copiedStyle=null;if(originalScope!==barScope&&barScope.nodeType===11&&sourceStyle){copiedStyle=sourceStyle.cloneNode(true);barScope.append(copiedStyle);}
 const siblings=[...bar.children].map(node=>[node,node.style.display]);let disposed=false;
 const view={docked:true,restored:Promise.resolve(),leave:()=>queue.watch(animateSurface(bar,false,{duration:130,distance:-8})),destroy(){if(disposed)return;disposed=true;view.docked=false;copiedStyle?.remove();toolbar.removeAttribute('data-scene-toolbar');if(marker.isConnected)marker.replaceWith(toolbar);else toolbar.remove();for(const [node,display]of siblings)node.style.display=display;delete bar.dataset.context;delete scene.dataset.windowToolbar;scene.dispatchEvent(new doc.defaultView.CustomEvent('hypno:toolbar-change'));if(active.get(doc)===view)active.delete(doc);if(!sceneWindowController(doc).switching)view.restored=queue.watch(animateSurface(bar,true,{duration:150,distance:-8}),'toolbar-restored');}};
 view.ready=queue.watch((async()=>{if(bar.style.opacity!=='0')await animateSurface(bar,false,{duration:130,distance:-8});if(disposed)return;for(const [node]of siblings)node.style.display='none';toolbar.setAttribute('data-scene-toolbar','');bar.append(toolbar);bar.dataset.context='window';scene.dataset.windowToolbar='true';scene.dispatchEvent(new doc.defaultView.CustomEvent('hypno:toolbar-change'));await animateSurface(bar,true,{duration:150,distance:-8});})(),'toolbar-ready');
 active.set(doc,view);return view;
}
