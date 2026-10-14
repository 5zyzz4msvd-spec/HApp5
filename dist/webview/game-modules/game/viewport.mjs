export const ORIENTATION_MARKUP='<span class="hypno-rotate-device" aria-hidden="true">↻</span><strong>请横屏使用</strong><p>手机请旋转屏幕；电脑请扩大窗口。</p>';
export const ORIENTATION_CSS=`.hypno-orientation-gate{position:fixed;inset:0;z-index:2147483646;display:none;align-content:center;justify-items:center;gap:16px;background:radial-gradient(ellipse at 50% 30%,#30283a,#151a23 70%);color:#e8deeb;font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center;padding:32px;box-sizing:border-box}.hypno-orientation-gate strong{font-size:21px;font-weight:500}.hypno-orientation-gate p{margin:0;color:#b9acbe;max-width:260px}.hypno-rotate-device{font:64px/1 system-ui;color:#d4bddb}.hypno-orientation-gate[data-blocked=true]{display:grid}`;
const LANDSCAPE_CSS=`@media(max-height:520px) and (orientation:landscape){
html[data-hypno-scene-viewport] .routine-scene[data-schedule-display=today]{grid-template-rows:42px minmax(0,1fr) 124px}
html[data-hypno-scene-viewport] .routine-scene[data-schedule-display=today][data-window-toolbar]{grid-template-rows:minmax(42px,max-content) minmax(0,1fr) 124px}
html[data-hypno-scene-viewport] .scene-topbar{flex-direction:row;gap:8px;padding:3px 12px;align-items:center}
html[data-hypno-scene-viewport] .routine-context{flex:0 1 165px;height:auto;font-size:12px;justify-content:flex-start;gap:8px}
html[data-hypno-scene-viewport] .routine-wheel{flex:1;width:auto;height:36px;gap:3px}
html[data-hypno-scene-viewport] .routine-roster{height:36px;gap:7px}
html[data-hypno-scene-viewport] .routine-avatar{height:34px;width:34px;flex-basis:34px;padding:1px}
html[data-hypno-scene-viewport] .routine-avatar[data-presentation=joint]{width:54px;flex-basis:54px}
html[data-hypno-scene-viewport] .routine-avatar[aria-pressed=true]:after{left:11px}
html[data-hypno-scene-viewport] .routine-wheel-arrow{height:36px;width:26px}
html[data-hypno-scene-viewport] .routine-multiple{height:30px;padding:0 8px;font-size:11px}
html[data-hypno-scene-viewport] .schedule-row{grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:minmax(48px,1fr);min-height:48px;gap:3px}
html[data-hypno-scene-viewport] .schedule-cell{min-height:48px;padding:3px!important;gap:1px}
html[data-hypno-scene-viewport] .schedule-cell span{font-size:10px;line-height:13px}
html[data-hypno-scene-viewport] .location-service-row{padding:0 0 4px;gap:5px}
html[data-hypno-scene-viewport] .location-service-row label{height:28px;padding:0 8px}
html[data-hypno-scene-viewport] .location-service-row input{height:26px;font-size:12px}
html[data-hypno-scene-viewport] .location-service-row button{min-height:28px;padding:3px 8px;font-size:11px}
html[data-hypno-scene-viewport] .schedule-actions{gap:4px;flex-wrap:nowrap}
html[data-hypno-scene-viewport] .schedule-actions button{padding:3px 6px;font-size:10px}
html[data-hypno-scene-viewport] .gal-dialogue{bottom:7px;padding:7px 12px;line-height:1.55}
html[data-hypno-scene-viewport] .gal-dialogue p{margin:4px 0;max-height:56px}
html[data-hypno-scene-viewport] .gal-dialogue header strong{font-size:12px}
html[data-hypno-scene-viewport] .gal-dialogue header nav button{font-size:10px;padding:3px 6px}
}`;

export function portraitBlocked({width,height,coarse=false,orientation}){return (coarse||width<900)&&(coarse&&orientation?/^portrait/.test(orientation):height>width);}
export function viewportOrientation(win,coarse){return {width:win.innerWidth,height:win.innerHeight,coarse:Boolean(coarse),orientation:coarse?win.screen?.orientation?.type:undefined};}
export function gameViewport({left=0,top=0,width,height,headerBottom=top}){
 const y=Math.max(top,Math.min(top+height,headerBottom));
 return{left,top:y,width:Math.max(1,width),height:Math.max(1,top+height-y)};
}

// The standalone maintained page uses the same orientation rule as its host.
export function installSceneOrientationGate(doc){
 const win=doc.defaultView;if(doc.querySelector('style[data-hypno-viewport]'))return()=>{};
 const style=doc.createElement('style');style.dataset.hypnoViewport='true';style.textContent=ORIENTATION_CSS+LANDSCAPE_CSS;doc.head.append(style);doc.documentElement.dataset.hypnoSceneViewport='landscape';
 if(win.__ST_GAME_EMBEDDED__)return()=>{style.remove();delete doc.documentElement.dataset.hypnoSceneViewport;};
 const gate=doc.createElement('section');gate.className='hypno-orientation-gate';gate.dataset.hypnoOrientation='true';gate.setAttribute('role','status');gate.innerHTML=ORIENTATION_MARKUP;doc.body.append(style,gate);
 const saved=new Map(),coarse=win.matchMedia?.('(pointer:coarse)');
 function sync(){const blocked=portraitBlocked(viewportOrientation(win,coarse?.matches));gate.dataset.blocked=String(blocked);gate.hidden=!blocked;for(const node of doc.body.children){if(node===gate||node===style||['SCRIPT','STYLE'].includes(node.tagName))continue;if(blocked){if(!saved.has(node))saved.set(node,node.inert);node.inert=true;}else if(saved.has(node)){node.inert=saved.get(node);saved.delete(node);}}}
 const observer=new win.MutationObserver(sync);observer.observe(doc.body,{childList:true});win.addEventListener('resize',sync);win.screen?.orientation?.addEventListener?.('change',sync);coarse?.addEventListener?.('change',sync);sync();
 return()=>{observer.disconnect();win.removeEventListener('resize',sync);win.screen?.orientation?.removeEventListener?.('change',sync);coarse?.removeEventListener?.('change',sync);for(const [node,inert]of saved)node.inert=inert;gate.remove();style.remove();delete doc.documentElement.dataset.hypnoSceneViewport;};
}
