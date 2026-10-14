import {gameViewport,portraitBlocked,viewportOrientation,ORIENTATION_CSS,ORIENTATION_MARKUP} from './viewport.mjs';

const ROOT_ID='hypno-game-root',SHELL_KEY='__ST_GAME_SHELL__';
function safeScript(value){return JSON.stringify(value).replace(/</g,'\\u003c');}
function htmlAttribute(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

export function nativeHeaderNodes(doc){return ['top-bar','top-settings-holder'].map(id=>doc.getElementById(id)).filter(Boolean);}
export function nativeHeaderBottom(doc,top=0){
 const win=doc.defaultView;let bottom=top;
 for(const node of nativeHeaderNodes(doc)){
  const css=win.getComputedStyle(node),rect=node.getBoundingClientRect();if(css.display==='none'||css.visibility==='hidden'||rect.width<=0||rect.height<=0)continue;
  // Expanded drawers are overlays, not extra toolbar height.
  const toggles=node.id==='top-settings-holder'?[...node.querySelectorAll(':scope > .drawer > .drawer-toggle')]:[];
  const row=toggles.length?Math.max(...toggles.map(x=>x.getBoundingClientRect().bottom)):rect.bottom;
  bottom=Math.max(bottom,row);
 }
 return bottom;
}

export function sceneFrameDocument(template,{sceneBase,assetBase}){
 const setup=`window.__ST_GAME_EMBEDDED__=true;window.__ST_GAME_ASSET_BASE__=${safeScript(assetBase)};const fail=()=>{if(document.querySelector('.routine-scene'))return;const scene=document.getElementById('scene');if(scene){scene.textContent='场景暂时无法加载，请刷新页面重试。';scene.style.cssText='display:grid;place-items:center;color:#e8ddec;font:14px system-ui;padding:24px';}};window.addEventListener('error',fail);window.addEventListener('unhandledrejection',fail);`;
 return template.replace('<head>',`<head><base href="${htmlAttribute(sceneBase)}"><script>${setup}</script>`);
}

export function mountTavernGameShell({host=window,template,sceneBase,assetBase,expectedCardName=''}){
 const active=host.SillyTavern?.getContext?.(),name=active?.characters?.[active.characterId??active.chid]?.name;if(expectedCardName&&name&&name!==expectedCardName)return;
 const doc=host.document;if(doc.getElementById(ROOT_ID))return host[SHELL_KEY];
 const root=doc.createElement('section');root.id=ROOT_ID;root.setAttribute('aria-label','HypnoOS 游戏画面');
 root.style.cssText='position:fixed;z-index:2147483000;overflow:hidden;background:#151a23;box-sizing:border-box;padding:0 env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
 const frame=doc.createElement('iframe');frame.title='HypnoOS 游戏场景';frame.dataset.hypnoGameFrame='true';frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#151a23';
 // srcdoc inherits the Tavern origin: existing parent APIs remain accessible.
 // A separate viewport contains every fixed modal and pet, including portals.
 frame.srcdoc=sceneFrameDocument(template,{sceneBase,assetBase});
 const gate=doc.createElement('section');gate.className='hypno-orientation-gate';gate.setAttribute('role','status');gate.innerHTML=ORIENTATION_MARKUP;gate.style.position='absolute';
 const style=doc.createElement('style');style.dataset.hypnoTavernViewport='true';style.textContent=ORIENTATION_CSS+`html[data-hypno-game-host] #top-bar,html[data-hypno-game-host] #top-settings-holder{z-index:2147483001!important}html[data-hypno-game-host] #character_popup{z-index:2147483002!important}html[data-hypno-game-host],html[data-hypno-game-host] body{overflow:hidden!important}`;
 const previous=doc.documentElement.getAttribute('data-hypno-game-host');doc.documentElement.dataset.hypnoGameHost='true';doc.head.append(style);root.append(frame,gate);doc.body.append(root);
 const coarse=host.matchMedia?.('(pointer:coarse)'),observed=new Set();let queued=0,destroyed=false;
 const observer=host.ResizeObserver?new host.ResizeObserver(schedule):null;
 function sync(){
  if(destroyed)return;const view=host.visualViewport,viewport={left:view?.offsetLeft??0,top:view?.offsetTop??0,width:view?.width??host.innerWidth,height:view?.height??host.innerHeight};
  const rect=gameViewport({...viewport,headerBottom:nativeHeaderBottom(doc,viewport.top)});
  for(const key of ['left','top','width','height'])root.style[key]=rect[key]+'px';
  const blocked=portraitBlocked(viewportOrientation(host,coarse?.matches));root.dataset.orientation=blocked?'portrait-blocked':'landscape';gate.dataset.blocked=String(blocked);gate.hidden=!blocked;frame.inert=blocked;frame.style.visibility=blocked?'hidden':'visible';if(blocked&&doc.activeElement===frame){gate.tabIndex=-1;gate.focus({preventScroll:true});}
  for(const node of observed)if(!node.isConnected){observer?.unobserve(node);observed.delete(node);}
  for(const node of nativeHeaderNodes(doc))if(!observed.has(node)){observer?.observe(node);headerMutation.observe(node,{attributes:true,attributeFilter:['style','class','hidden']});observed.add(node);}
 }
 function schedule(){if(!queued&&!destroyed)queued=host.requestAnimationFrame(()=>{queued=0;sync();});}
 const headerMutation=new host.MutationObserver(schedule);headerMutation.observe(doc.body,{childList:true,attributes:true,attributeFilter:['style','class']});headerMutation.observe(doc.documentElement,{attributes:true,attributeFilter:['style','class']});
 host.addEventListener('resize',schedule);host.screen?.orientation?.addEventListener?.('change',schedule);host.visualViewport?.addEventListener('resize',schedule);host.visualViewport?.addEventListener('scroll',schedule);coarse?.addEventListener?.('change',schedule);sync();
 const context=host.SillyTavern?.getContext?.(),source=context?.eventSource,chatChanged=context?.eventTypes?.CHAT_CHANGED??host.event_types?.CHAT_CHANGED??'chat_id_changed';
 const onChatChanged=()=>{const current=host.SillyTavern.getContext(),name=current.characters?.[current.characterId??current.chid]?.name;if(expectedCardName&&name&&name!==expectedCardName)api.destroy();else api.reload();};
 const api={root,frame,sync,reload(){frame.srcdoc=sceneFrameDocument(template,{sceneBase,assetBase});},destroy(){if(destroyed)return;destroyed=true;if(queued)host.cancelAnimationFrame(queued);observer?.disconnect();headerMutation.disconnect();source?.removeListener?.(chatChanged,onChatChanged);host.removeEventListener('resize',schedule);host.screen?.orientation?.removeEventListener?.('change',schedule);host.visualViewport?.removeEventListener('resize',schedule);host.visualViewport?.removeEventListener('scroll',schedule);coarse?.removeEventListener?.('change',schedule);root.remove();style.remove();if(previous===null)delete doc.documentElement.dataset.hypnoGameHost;else doc.documentElement.setAttribute('data-hypno-game-host',previous);for(const node of doc.querySelectorAll('style[data-hypno-galgame-input]'))node.remove();if(host[SHELL_KEY]===api)delete host[SHELL_KEY];}};
 source?.on?.(chatChanged,onChatChanged);
 host[SHELL_KEY]=api;return api;
}
