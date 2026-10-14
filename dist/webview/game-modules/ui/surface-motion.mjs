import { sceneRootFor } from './scene-dom.mjs';
import { installSerialMotion,waitMotion } from './serial-motion.mjs';
const running=new WeakMap();
export function runSceneTransition(doc,action){return installSerialMotion(doc).run(action);}
export async function animateSurface(node,enter,{duration=enter?260:200,distance=enter?-24:18}={}){
 if(!node?.isConnected)return;
 node.dataset.surfacePhase=enter?'enter':'leave';const win=node.ownerDocument.defaultView;
 if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!node.animate){node.style.opacity=enter?'1':'0';return;}
 const [x=0,y=0]=(node.style.translate||'0 0').split(/\s+/).map(parseFloat),base=`${x}px ${y}px`,offset=`${x}px ${y+distance}px`;
 const effect=node.animate(enter?[{opacity:0,translate:offset,scale:.985},{opacity:1,translate:base,scale:1}]:[{opacity:1,translate:base,scale:1},{opacity:0,translate:offset,scale:.985}],{duration,easing:'cubic-bezier(.22,.8,.2,1)',fill:'both'});
 running.set(node,effect);if(win.__ST_LOCAL_PREVIEW__||win.location?.search?.includes('motionAudit=1'))win.setTimeout(()=>{node.dataset.surfaceMotion=JSON.stringify({state:effect.playState,time:effect.currentTime,rate:effect.playbackRate,timeline:effect.timeline?.currentTime,progress:effect.effect?.getComputedTiming?.().progress});},duration+60);await waitMotion(effect);node.dataset.surfacePhase='finished';node.style.opacity=enter?'1':'0';effect.cancel();if(running.get(node)===effect)running.delete(node);node.dataset.surfacePhase='done';
}
export function surfaceLifecycle(doc,nodeOrGetter,toolbar,dispose,prepare=Promise.resolve()){
 const queue=installSerialMotion(doc),node=()=>typeof nodeOrGetter==='function'?nodeOrGetter():nodeOrGetter;let disposed=false,closing=null;
 const destroy=()=>{if(disposed)return;disposed=true;running.get(node())?.cancel();toolbar?.destroy();dispose();};
 const ready=queue.watch((async()=>{await prepare;await toolbar?.ready;if(!toolbar){const bar=sceneRootFor(doc)?.querySelector('.scene-topbar');if(bar?.style.opacity==='0')await animateSurface(bar,true,{duration:150,distance:-8});}if(!disposed)await animateSurface(node(),true);})(),'surface-ready');
 const close=()=>closing??=queue.watch((async()=>{await ready;if(disposed)return;node()?.closest('[role=dialog]')?.setAttribute('data-window-closing','true');await animateSurface(node(),false);await toolbar?.leave?.();destroy();await toolbar?.restored;})(),'surface-close');
 return{ready,close,destroy,setToolbar(next){toolbar=next;return queue.watch(next?.ready??Promise.resolve());}};
}
