import { sceneRootFor } from './scene-dom.mjs';
import { installSerialMotion,waitMotion } from './serial-motion.mjs';
const running=new WeakMap();
export function runSceneTransition(doc,action){return installSerialMotion(doc).run(action);}
export function surfaceOffscreenDistance(node,{margin=128}={}){
 const doc=node.ownerDocument,win=doc.defaultView,rect=node.getBoundingClientRect?.()??{top:0,height:0};
 const viewport=win.visualViewport,bottom=Number(viewport?.height)>0?Number(viewport.offsetTop??0)+Number(viewport.height):Number(win.innerHeight??doc.documentElement?.clientHeight??768);
 const height=Number(node.offsetHeight??node.clientHeight),scale=height>0&&Number(rect.height)>0?Number(rect.height)/height:1;
 return Math.max(margin,bottom-Number(rect.top??0)+margin)/scale;
}
function cancelSurface(node){const current=running.get(node);if(!current)return;running.delete(node);current.effect.cancel();}
async function animate(node,enter,frames,{duration,kind}){
 if(!node?.isConnected)return;cancelSurface(node);node.dataset.surfacePhase=enter?'enter':'leave';node.dataset.surfaceMotionKind=kind;const win=node.ownerDocument.defaultView;
 if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!node.animate||duration<=0){node.style.opacity=enter?'1':'0';node.dataset.surfacePhase='done';return;}
 // Add only motion: keep the underlying CSS transform, percent translate,
 // scale and floating-drag offset intact instead of parsing layout strings.
 let effect;try{effect=node.animate(frames,{duration,easing:'cubic-bezier(.22,.8,.2,1)',fill:'both',composite:'add'});}catch{node.style.opacity=enter?'1':'0';node.dataset.surfacePhase='done';return;}
 const record={effect};running.set(node,record);node.style.opacity='1';
 try{await waitMotion(effect);}finally{if(running.get(node)===record){node.style.opacity=enter?'1':'0';effect.cancel();running.delete(node);node.dataset.surfacePhase='done';}}
}
export async function animateSurface(node,enter,{duration=enter?420:340,margin=128}={}){
 if(!node?.isConnected)return;const offset=surfaceOffscreenDistance(node,{margin}),base={transform:'translate3d(0, 0px, 0)'},away={transform:`translate3d(0, ${offset}px, 0)`};
 return animate(node,enter,enter?[away,base]:[base,away],{duration,kind:'slide'});
}
export async function animateToolbarFace(node,enter,{duration=enter?180:140}={}){
 const base={transform:'perspective(900px) rotateX(0deg)'},away={transform:`perspective(900px) rotateX(${enter?90:-90}deg)`};
 return animate(node,enter,enter?[away,base]:[base,away],{duration,kind:'flip'});
}
export function surfaceLifecycle(doc,nodeOrGetter,toolbar,dispose,prepare=Promise.resolve()){
 const queue=installSerialMotion(doc),node=()=>typeof nodeOrGetter==='function'?nodeOrGetter():nodeOrGetter;let disposed=false,closing=null;
 const destroy=()=>{if(disposed)return;disposed=true;cancelSurface(node());toolbar?.destroy();dispose();};
 const ready=queue.watch((async()=>{await prepare;await toolbar?.ready;if(!disposed&&!toolbar){const bar=sceneRootFor(doc)?.querySelector('.scene-topbar');if(bar?.style.opacity==='0')await animateToolbarFace(bar,true);}if(!disposed)await animateSurface(node(),true);})(),'surface-ready');
 const close=()=>closing??=queue.watch((async()=>{await ready;if(disposed)return;node()?.closest('[role=dialog]')?.setAttribute('data-window-closing','true');await animateSurface(node(),false);await toolbar?.leave?.();destroy();await toolbar?.restored;})(),'surface-close');
 return{ready,close,destroy,setToolbar(next){toolbar=next;return queue.watch(next?.ready??Promise.resolve());}};
}
