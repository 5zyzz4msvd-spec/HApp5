import {sceneRootFor} from './scene-dom.mjs';
import {animateSurface,animateToolbarFace} from './surface-motion.mjs';
import {installSerialMotion} from './serial-motion.mjs';
import {sceneWindowController} from './scene-windows.mjs';
const active=new WeakMap();
export function dockSceneToolbar(doc,toolbar){
 const bar=sceneRootFor(doc)?.querySelector('.scene-topbar');
 if(!bar||!toolbar?.isConnected)return{docked:false,ready:Promise.resolve(),restored:Promise.resolve(),destroy(){}};
 active.get(doc)?.destroy({restore:false});
 const queue=installSerialMotion(doc),parent=toolbar.parentNode,marker=doc.createComment('scene toolbar'),scene=bar.closest('.routine-scene');parent.insertBefore(marker,toolbar);
 const workspace=scene.querySelector('.scene-workspace'),ownFooter=toolbar.classList?.contains('location-mode-toolbar'),footer=ownFooter?null:workspace;
 const originalScope=toolbar.getRootNode(),barScope=bar.getRootNode(),sourceStyle=toolbar.closest('.dn-window,.collection-window,.location-window')?.querySelector('style');let copiedStyle=null;if(originalScope!==barScope&&barScope.nodeType===11&&sourceStyle){copiedStyle=sourceStyle.cloneNode(true);barScope.append(copiedStyle);}
 const siblings=[...bar.children].map(node=>[node,node.style.display]);let disposed=false,leaving=null;
 async function leaveBars(){if(disposed)return;if(bar.style.opacity!=='0')await animateToolbarFace(bar,false);if(disposed)return;if(footer&&footer.style.opacity!=='0')await animateSurface(footer,false,{duration:140,margin:32});}
 async function enterBars(){await animateToolbarFace(bar,true);if(disposed)return;if(footer)await animateSurface(footer,true,{duration:180,margin:32});else if(workspace?.style.opacity==='0')workspace.style.opacity='1';}
 const view={docked:true,restored:Promise.resolve(),leave:()=>leaving??=queue.watch((async()=>{await view.ready;if(!disposed)await leaveBars();})(),'toolbar-leave'),destroy({restore=!sceneWindowController(doc).switching}={}){
  if(disposed)return;disposed=true;view.docked=false;copiedStyle?.remove();toolbar.removeAttribute('data-scene-toolbar');if(marker.isConnected)marker.replaceWith(toolbar);else toolbar.remove();for(const [node,display]of siblings)node.style.display=display;delete bar.dataset.context;delete scene.dataset.windowToolbar;scene.dispatchEvent(new doc.defaultView.CustomEvent('hypno:toolbar-change'));if(active.get(doc)===view)active.delete(doc);
  if(restore)view.restored=queue.watch((async()=>{await animateToolbarFace(bar,true);if(!active.has(doc)&&footer)await animateSurface(footer,true,{duration:180,margin:32});})(),'toolbar-restored');
 }};
 view.ready=queue.watch((async()=>{await leaveBars();if(disposed)return;for(const [node]of siblings)node.style.display='none';toolbar.setAttribute('data-scene-toolbar','');bar.append(toolbar);bar.dataset.context='window';scene.dataset.windowToolbar='true';scene.dispatchEvent(new doc.defaultView.CustomEvent('hypno:toolbar-change'));await enterBars();})(),'toolbar-ready');
 active.set(doc,view);return view;
}
