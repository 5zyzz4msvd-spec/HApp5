const h='<span class="hypno-rotate-device" aria-hidden="true">\u21BB</span><strong>\u8BF7\u6A2A\u5C4F\u4F7F\u7528</strong><p>\u624B\u673A\u8BF7\u65CB\u8F6C\u5C4F\u5E55\uFF1B\u7535\u8111\u8BF7\u6269\u5927\u7A97\u53E3\u3002</p>',l='.hypno-orientation-gate{position:fixed;inset:0;z-index:2147483646;display:none;align-content:center;justify-items:center;gap:16px;background:radial-gradient(ellipse at 50% 30%,#30283a,#151a23 70%);color:#e8deeb;font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center;padding:32px;box-sizing:border-box}.hypno-orientation-gate strong{font-size:21px;font-weight:500}.hypno-orientation-gate p{margin:0;color:#b9acbe;max-width:260px}.hypno-rotate-device{font:64px/1 system-ui;color:#d4bddb}.hypno-orientation-gate[data-blocked=true]{display:grid}',c=`@media(max-height:520px) and (orientation:landscape){
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
}`;function x({width:e,height:t,coarse:i=!1,orientation:n}){return(i||e<900)&&(i&&n?/^portrait/.test(n):t>e)}function m(e,t){return{width:e.innerWidth,height:e.innerHeight,coarse:!!t,orientation:t?e.screen?.orientation?.type:void 0}}function g({left:e=0,top:t=0,width:i,height:n,headerBottom:o=t}){const r=Math.max(t,Math.min(t+n,o));return{left:e,top:r,width:Math.max(1,i),height:Math.max(1,t+n-r)}}function u(e){const t=e.defaultView;if(e.querySelector("style[data-hypno-viewport]"))return()=>{};const i=e.createElement("style");if(i.dataset.hypnoViewport="true",i.textContent=l+c,e.head.append(i),e.documentElement.dataset.hypnoSceneViewport="landscape",t.__ST_GAME_EMBEDDED__)return()=>{i.remove(),delete e.documentElement.dataset.hypnoSceneViewport};const n=e.createElement("section");n.className="hypno-orientation-gate",n.dataset.hypnoOrientation="true",n.setAttribute("role","status"),n.innerHTML=h,e.body.append(i,n);const o=new Map,r=t.matchMedia?.("(pointer:coarse)");function p(){const s=x(m(t,r?.matches));n.dataset.blocked=String(s),n.hidden=!s;for(const a of e.body.children)a===n||a===i||["SCRIPT","STYLE"].includes(a.tagName)||(s?(o.has(a)||o.set(a,a.inert),a.inert=!0):o.has(a)&&(a.inert=o.get(a),o.delete(a)))}const d=new t.MutationObserver(p);return d.observe(e.body,{childList:!0}),t.addEventListener("resize",p),t.screen?.orientation?.addEventListener?.("change",p),r?.addEventListener?.("change",p),p(),()=>{d.disconnect(),t.removeEventListener("resize",p),t.screen?.orientation?.removeEventListener?.("change",p),r?.removeEventListener?.("change",p);for(const[s,a]of o)s.inert=a;n.remove(),i.remove(),delete e.documentElement.dataset.hypnoSceneViewport}}export{l as ORIENTATION_CSS,h as ORIENTATION_MARKUP,g as gameViewport,u as installSceneOrientationGate,x as portraitBlocked,m as viewportOrientation};
