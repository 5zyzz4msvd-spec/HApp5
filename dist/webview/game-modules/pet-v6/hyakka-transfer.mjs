import {assetUrl} from '../resources/asset-url.mjs';
import {mountDesktopPet} from './desktop-pet.mjs';
import {frameAt,clampPetPosition,decodePetImage} from './motion.mjs';
import {createHyakkaLifecycle} from './hyakka-lifecycle.mjs';
import {createAlisaLifecycle} from './alisa-lifecycle.mjs';

// Independent composition around the main chat's controller; no shared source edits.
export function mountDaggerTransfer(container,options={}){
 const doc=container.ownerDocument??container,win=doc.defaultView;
 const assetBase=options.assetBase??'/public/frontends/hypnosis-app/assets/';
 let manifest=null,lifecycle=null,alisaLifecycle=null;
 const artReady=(async()=>{const response=await win.fetch(assetUrl(assetBase,'pet/v6/manifest.json'));if(!response.ok)throw Error('Transfer art manifest unavailable');manifest=await response.json();})();
 async function ensureStageArt(role){await artReady;const files=role==='hyakka'?['dagger','bladeSweep','groundSweep','smoke','smokeBomb'].map(name=>manifest.transfer[name]).filter(Boolean):['pet/v6/alisa-stage-cloth.png','pet/v6/alisa-stage-header.png'];await Promise.all(files.map(file=>decodePetImage(win,assetUrl(assetBase,file))));}
 const hook=kind=>async ctx=>{await ensureStageArt(ctx.role);if(ctx.signal?.aborted)return false;if(ctx.role==='hyakka'&&manifest.transfer.smoke)return lifecycle[kind](ctx);if(ctx.role==='alisa'&&manifest.characters.alisa?.lifecycle)return alisaLifecycle[kind](ctx);return options.transitionHooks?.[kind]?.(ctx);};
 const controller=mountDesktopPet(container,{...options,assetBase,transitionHooks:{prepare:ensureStageArt,enter:hook('enter'),exit:hook('exit')},initialCharacter:options.initialCharacter??'alisa',storageKey:options.storageKey??'hypno-pet-v6'});
 const root=controller.root,pet=controller.pet,sprite=root.querySelector('.dp-sprite'),ghost=root.querySelector('.dp-ghost');
 const abort=new win.AbortController(),signal=abort.signal,reduce=options.motionPreference??win.matchMedia('(prefers-reduced-motion: reduce)');
 const style=doc.createElement('style');style.textContent=`
 .hx-reticle{position:absolute;width:84px;height:28px;border:1px solid #c7b8f0;border-radius:50%;box-shadow:0 0 14px #9981d788;transform:translate(-50%,-50%);pointer-events:none;opacity:.65}
 .hx-reticle:before,.hx-reticle:after{content:"";position:absolute;background:#eee5ff;box-shadow:0 0 7px #a494eb}.hx-reticle:before{width:16px;height:1px;left:33px;top:13px}.hx-reticle:after{height:12px;width:1px;left:41px;top:8px}
 .hx-dagger{position:absolute;width:48px;height:auto;pointer-events:none;transform-origin:50% 50%;filter:drop-shadow(0 0 3px #e8dfff) drop-shadow(0 0 9px #b89cff)}
 .hx-streak,.hx-cut{position:absolute;pointer-events:none;transform-origin:0 50%;mix-blend-mode:screen;background:linear-gradient(180deg,transparent,#9b80f877 24%,#e6dcff 44%,#fff 49%,#fff 53%,#aa89ef 64%,transparent);filter:drop-shadow(0 0 9px #b599ff)}
 .hx-streak{height:18px;clip-path:polygon(0 48%,20% 39%,83% 18%,100% 46%,82% 60%,13% 67%)}
 .hx-cut{height:34px;clip-path:polygon(0 48%,36% 28%,78% 34%,100% 4%,88% 49%,100% 74%,54% 65%,13% 80%)}
 .hx-spark{position:absolute;width:4px;height:4px;background:#fff;border-radius:1px;box-shadow:0 0 8px #b998ff,0 0 3px #fff;pointer-events:none}
 .hx-arc{position:absolute;pointer-events:none;object-fit:contain;mix-blend-mode:screen;filter:drop-shadow(0 0 5px #c2acff) drop-shadow(0 0 18px #8e64df);transform-origin:50% 50%}
 .hx-shard{position:absolute;width:18px;height:3px;background:linear-gradient(90deg,#fff,#bb9fff,transparent);clip-path:polygon(0 45%,70% 0,100% 50%,65% 100%);filter:drop-shadow(0 0 5px #cbb4ff);pointer-events:none}
 .hx-core{position:absolute;height:3px;background:#fff;box-shadow:0 0 4px #fff,0 0 12px #c1a1ff,0 0 24px #926bed;transform-origin:0 50%;pointer-events:none}
 .hx-ring{position:absolute;border:2px solid #eadeff;width:80px;height:26px;border-radius:50%;box-shadow:0 0 18px #aa8af0,inset 0 0 10px #d5baff;pointer-events:none;transform:translate(-50%,-50%)}
 .hx-star{position:absolute;width:64px;height:64px;pointer-events:none;background:linear-gradient(90deg,transparent 47%,#fff 50%,transparent 53%),linear-gradient(0deg,transparent 47%,#fff 50%,transparent 53%);filter:drop-shadow(0 0 10px #ceafff);transform:translate(-50%,-50%)}
 .desktop-pet-v6[data-transfer-stage=aim] .dp-charge,.desktop-pet-v6[data-transfer-stage=throw] .dp-charge,.desktop-pet-v6[data-transfer-stage=flight] .dp-charge,.desktop-pet-v6[data-transfer-stage=finish] .dp-charge{opacity:.65;animation:dpCharge 700ms ease-in-out infinite alternate}
 `;root.prepend(style);
 let initialized=false,destroyed=false,selection=null,ghostClock=null,raf=0,epoch=0,busy=false,stage='idle',internalCancel=false,transferPromise=Promise.resolve();
 lifecycle=createHyakkaLifecycle({root,sprite,assetBase,getManifest:()=>manifest,motionPreference:reduce});
 alisaLifecycle=createAlisaLifecycle({root,sprite,assetBase,getManifest:()=>manifest,motionPreference:reduce});
 const nodes=new Set(),animations=new Set(),timers=new Map(),events=[];
 const log=(event,extra={})=>{events.push({event,at:Math.round(win.performance.now()),...extra});if(events.length>48)events.shift();};
 const setStage=value=>{stage=value;root.dataset.transferStage=value;log(value);};
 const clips=()=>manifest?.characters?.hyakka?.clips??{};
 const viewport=()=>{const v=win.visualViewport;return {left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??win.innerWidth,height:v?.height??win.innerHeight};};
 const alive=tag=>!destroyed&&tag===epoch;
 function pause(ms,tag){return new Promise(resolve=>{const id=win.setTimeout(()=>{timers.delete(id);resolve();},reduce.matches?0:ms);timers.set(id,resolve);}).then(()=>{if(!alive(tag))throw new Error('transfer-cancelled');});}
 function node(className,x,y){const el=doc.createElement('i');el.className=className;el.style.left=x+'px';el.style.top=y+'px';root.append(el);nodes.add(el);return el;}
 function remove(el){nodes.delete(el);el.remove();}
 function effect(el,keyframes,{duration=300,delay=0,easing='ease-out',removeAfter=true}={}){
  if(reduce.matches){if(removeAfter)remove(el);return;}
  // Finished fill-forwards animations still override inline styles. Retain
  // persistent effects until clearEffects cancels them, including ghost fades.
  const a=el.animate(keyframes,{duration,delay,easing,fill:'forwards'});animations.add(a);a.finished.catch(()=>{}).finally(()=>{if(removeAfter){animations.delete(a);a.cancel();remove(el);}});return a;
 }
 function clearEffects(){for(const [id,resolve]of timers){win.clearTimeout(id);resolve();}timers.clear();for(const a of animations)a.cancel();animations.clear();for(const el of nodes)el.remove();nodes.clear();}
 function stopGhost(){ghostClock=null;for(const a of ghost.getAnimations()){a.cancel();animations.delete(a);}ghost.dataset.visible='false';ghost.style.opacity='';ghost.style.filter='';ghost.style.removeProperty('translate');}
 function paintGhost(){if(!ghostClock)return;const c=clips()[ghostClock.name];if(!c)return;let value=frameAt(c,win.performance.now()-ghostClock.started);if(ghostClock.hold!=null)value.index=Math.min(value.index,ghostClock.hold);
  ghost.style.backgroundImage=`url('${assetUrl(assetBase,c.file)}')`;ghost.style.backgroundSize=`${c.columns*112}px ${c.rows*112}px`;ghost.style.backgroundPosition=`${-(value.index%c.columns)*112}px ${-Math.floor(value.index/c.columns)*112}px`;ghost.dataset.sourceIndex=c.sourceIndices[value.index];ghost.dataset.phase=ghostClock.name;
 }
 function tick(){raf=0;if(destroyed)return;paintGhost();if(ghostClock&&!doc.hidden)raf=win.requestAnimationFrame(tick);}
 function showGhost(name,target,hold=null){ghostClock={name,started:win.performance.now(),hold};ghost.dataset.visible='true';ghost.style.opacity='.68';ghost.style.filter='brightness(1.35) sepia(.15) drop-shadow(0 0 2px #f1ecff) drop-shadow(0 0 10px #9681ef)';ghost.style.setProperty('--dp-x',target.x+'px');ghost.style.setProperty('--dp-y',target.y+'px');paintGhost();if(!raf)raf=win.requestAnimationFrame(tick);}
 function reticle(target){let el=[...nodes].find(n=>n.className==='hx-reticle');if(!el)el=node('hx-reticle',target.x+56,target.y+100);el.style.left=target.x+56+'px';el.style.top=target.y+100+'px';return el;}
 function ring(point,large=false){const el=node('hx-ring',point.x+56,point.y+99);effect(el,[{opacity:0,scale:'.3',rotate:'0deg'},{opacity:1,scale:'1',offset:.2},{opacity:0,scale:large?'2.4':'1.7',rotate:'12deg'}],{duration:large?430:260});}
 function flash(point){const star=node('hx-star',point.x+56,point.y+54);effect(star,[{opacity:0,scale:'.15',rotate:'-20deg'},{opacity:1,scale:'1.05',offset:.18},{opacity:0,scale:'1.8',rotate:'25deg'}],{duration:230});}
 function pathBlades(from,to){if(reduce.matches)return;const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
  const core=node('hx-core',from.x+56,from.y+60);core.style.width=length+'px';core.style.rotate=angle+'deg';effect(core,[{opacity:0,scale:'0 1'},{opacity:1,scale:'1 2',offset:.2},{opacity:0,scale:'1 .1'}],{duration:230});
  if(manifest.transfer.bladeSweep){for(let i=0;i<5;i++){const t=(i+.5)/5,el=doc.createElement('img');el.className='hx-arc';el.alt='';el.src=assetUrl(assetBase,manifest.transfer.bladeSweep);el.style.cssText=`left:${from.x+56+dx*t-100}px;top:${from.y+60+dy*t-60}px;width:200px;height:120px;rotate:${angle+(i%2?34:-34)}deg;`;root.append(el);nodes.add(el);effect(el,[{opacity:0,scale:'.25 .1'},{opacity:1,scale:'1.1 1',offset:.17},{opacity:.65,offset:.45},{opacity:0,scale:'1.35 .3'}],{duration:370,delay:i*32});}}
  for(let j=0;j<3;j++){const el=node('hx-streak',from.x+56,from.y+58+(j-1)*7);el.style.width=Math.max(60,length+28)+'px';el.style.rotate=angle+(j-1)*2+'deg';effect(el,[{opacity:0,scale:'.03 .4'},{opacity:1,scale:'1 1',offset:.22},{opacity:.7,offset:.48},{opacity:0,scale:'1.08 .1'}],{duration:330+j*28,delay:j*15,easing:'cubic-bezier(.14,.8,.2,1)'});}
  const count=Math.min(9,Math.max(3,Math.ceil(length/70)));
  for(let i=0;i<count;i++){const t=(i+1)/(count+1),el=node('hx-cut',from.x+56+dx*t,from.y+60+dy*t);el.style.width=45+(i%3)*17+'px';el.style.rotate=angle+(i%2?-42:42)+'deg';effect(el,[{opacity:0,scale:'.15 .3'},{opacity:1,scale:'1 1.15',offset:.25},{opacity:0,scale:'1.45 .08'}],{duration:260+i*14,delay:i*16});}
  for(let i=0;i<24;i++){const t=(i+.5)/24,el=node('hx-spark',from.x+56+dx*t,from.y+62+dy*t),side=i%2?1:-1;effect(el,[{opacity:0,scale:'.2',rotate:'45deg'},{opacity:1,offset:.18},{opacity:0,translate:`${side*(10+i%5*5)}px ${side*(18+i%4*9)}px`,scale:'.1',rotate:'135deg'}],{duration:310+i%5*32,delay:i*5});}
  for(let i=0;i<36;i++){const t=(i+.5)/36,side=i%2?1:-1,travel=35+(i%7)*11,theta=(angle+side*(35+i%5*12))*Math.PI/180,el=node('hx-shard',from.x+56+dx*t,from.y+60+dy*t);el.style.rotate=theta*180/Math.PI+'deg';effect(el,[{opacity:0,scale:'.15 1'},{opacity:1,offset:.1},{opacity:0,translate:`${Math.cos(theta)*travel}px ${Math.sin(theta)*travel}px`,scale:'.4 .1'}],{duration:350+i%6*38,delay:t*140});}
 }
 function endOriginalDrag(id){internalCancel=true;try{pet.dispatchEvent(new win.PointerEvent('pointercancel',{bubbles:true,pointerId:id,pointerType:'mouse'}));}finally{internalCancel=false;}}
 function cancel(reason='cancel'){
  const origin=selection?.origin??busyOrigin;epoch++;if(selection)endOriginalDrag(selection.id);selection=null;busy=false;controller.cancelDrag();controller.cancelTransition();lifecycle.cancel(reason);alisaLifecycle.cancel(reason);clearEffects();stopGhost();win.cancelAnimationFrame(raf);raf=0;sprite.style.opacity='';sprite.style.filter='';sprite.style.visibility='';pet.disabled=!initialized;
  if(origin)controller.place(origin);controller.closeMenu({immediate:true});controller.play('idle');busyOrigin=null;setStage('idle');log(reason);
 }
 let busyOrigin=null;
 async function transfer(route){const tag=++epoch;busy=true;busyOrigin={...route.origin};pet.disabled=true;endOriginalDrag(route.id);controller.play(route.bodySourceIndex===0?'charge-await-0':route.bodySourceIndex===1?'charge-await-1':'charge-hold');setStage('throw');reticle(route.target);
  try{
   if(reduce.matches){controller.place(route.target,{persist:true});controller.play('idle');log('teleport',{target:controller.snapshot().position});setStage('idle');log('complete',{reducedMotion:true});return;}
   const aim=clips()['ghost-aim'],remaining=Math.max(0,aim.durations.slice(0,aim.holdFrame).reduce((a,b)=>a+b,0)-(win.performance.now()-route.ghostAimStarted));
   if(remaining>0){showGhost('ghost-aim',route.target,aim.holdFrame);ghostClock.started=route.ghostAimStarted;await pause(remaining,tag);}
   showGhost('ghost-throw',route.target);
   controller.play('charge-finish');setStage('finish');ring(route.origin);await pause(195,tag);controller.play('throw-hold');log('charge-complete');setStage('flight');log('dagger-launched',{from:route.origin,to:route.target});
   const start={x:route.origin.x+56,y:route.origin.y+53},end={x:route.target.x+56,y:route.target.y+98},dx=end.x-start.x,dy=end.y-start.y,angle=Math.atan2(dy,dx)*180/Math.PI,flight=Math.round(160+Math.min(100,Math.hypot(dx,dy)*.16));
   const dagger=doc.createElement('img');dagger.className='hx-dagger';dagger.alt='';dagger.src=assetUrl(assetBase,manifest.transfer.dagger);dagger.style.left=start.x-24+'px';dagger.style.top=start.y-7+'px';root.append(dagger);nodes.add(dagger);
   effect(dagger,[{opacity:0,transform:`translate3d(0,0,0) rotate(${angle}deg)`,offset:0},{opacity:1,transform:`translate3d(${dx*.12}px,${dy*.12-8}px,0) rotate(${angle+45}deg)`,offset:.12},{opacity:1,transform:`translate3d(${dx*.55}px,${dy*.55-28}px,0) rotate(${angle+200}deg)`,offset:.55},{opacity:1,transform:`translate3d(${dx}px,${dy}px,0) rotate(${angle+360}deg)`}],{duration:flight,easing:'cubic-bezier(.25,.6,.3,1)',removeAfter:false});
   await pause(flight,tag);remove(dagger);log('dagger-arrived');flash(route.target);ring(route.target);
   await pause(60,tag);effect(sprite,[{opacity:1,filter:'brightness(1)'},{opacity:.6,filter:'brightness(3)',offset:.45},{opacity:0,filter:'brightness(5)'}],{duration:75,removeAfter:false});
   await pause(75,tag);pathBlades(route.origin,route.target);controller.place(route.target);controller.play('arrival');log('teleport',{target:controller.snapshot().position});setStage('arrival');flash(route.target);ring(route.target,true);
   effect(ghost,[{opacity:.68},{opacity:0}],{duration:120,removeAfter:false});effect(sprite,[{opacity:0,filter:'brightness(4)'},{opacity:1,filter:'brightness(1)'}],{duration:150,removeAfter:false});
   await pause(150,tag);stopGhost();await pause(manifest.transfer.arrivalMs-150+120,tag);controller.play('idle');controller.place(controller.snapshot().position,{persist:true});setStage('idle');log('complete');
  }catch(error){if(alive(tag)&&error.message!=='transfer-cancelled'){cancel('error');throw error;}}
  finally{if(alive(tag)){busy=false;busyOrigin=null;pet.disabled=false;clearEffects();stopGhost();sprite.style.opacity='';sprite.style.filter='';root.dispatchEvent(new win.CustomEvent('hyakka-transfer-complete',{detail:snapshot()}));}}
 }
 pet.addEventListener('pointerdown',e=>{if(busy||!initialized){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal});
 pet.addEventListener('pointerdown',e=>{if(controller.snapshot().role==='hyakka'&&!busy&&(e.pointerType!=='mouse'||e.button===0)&&!controller.snapshot().locked)selection={id:e.pointerId,origin:controller.snapshot().position,target:controller.snapshot().position,moved:false};},{signal});
 pet.addEventListener('pointermove',e=>{if(!selection||e.pointerId!==selection.id||busy)return;const value=controller.snapshot();if(!value.drag?.moved)return;selection.target=value.drag.target;if(!selection.moved){selection.moved=true;showGhost('ghost-aim',selection.target,clips()['ghost-aim'].holdFrame);setStage('aim');}ghost.style.setProperty('--dp-x',selection.target.x+'px');ghost.style.setProperty('--dp-y',selection.target.y+'px');paintGhost();reticle(selection.target);},{signal});
 pet.addEventListener('pointerup',e=>{if(!selection||e.pointerId!==selection.id||controller.snapshot().role!=='hyakka')return;const route={...selection,bodySourceIndex:snapshot().bodySourceIndex,ghostAimStarted:ghostClock?.started??win.performance.now()};selection=null;if(!route.moved)return;e.preventDefault();e.stopImmediatePropagation();transferPromise=transfer(route);},{capture:true,signal});
 pet.addEventListener('pointercancel',()=>{if(!internalCancel&&(selection||busy))cancel('pointercancel');},{signal});
 pet.addEventListener('lostpointercapture',e=>{if(!internalCancel&&selection?.id===e.pointerId)cancel('lostpointercapture');},{signal});
 pet.addEventListener('click',e=>{if(busy){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&(selection||busy||(lifecycle.snapshot().busy||alisaLifecycle.snapshot().busy))){e.preventDefault();cancel('escape');}},{capture:true,signal});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&(selection||busy||(lifecycle.snapshot().busy||alisaLifecycle.snapshot().busy)))cancel('hidden');},{signal});
 win.addEventListener('blur',()=>{if(selection||busy||(lifecycle.snapshot().busy||alisaLifecycle.snapshot().busy))cancel('blur');},{signal});win.addEventListener('resize',()=>{if(selection||busy||(lifecycle.snapshot().busy||alisaLifecycle.snapshot().busy))cancel('resize');},{signal});
 reduce.addEventListener('change',()=>{if(selection||busy||(lifecycle.snapshot().busy||alisaLifecycle.snapshot().busy))cancel('motion-setting');},{signal});
 const ready=(async()=>{await Promise.all([artReady,controller.ready]);if(destroyed)return;initialized=true;pet.disabled=false;log('ready');})();
 async function demoLifecycle(kind,{role=controller.snapshot().role}={}){await ready;if(busy||selection||controller.snapshot().locked)return;if(controller.snapshot().role!==role)await controller.switchCharacter();const tag=++epoch;busy=true;busyOrigin=controller.snapshot().position;pet.disabled=true;sprite.style.visibility='';controller.closeMenu();setStage(kind);try{await ensureStageArt(role);if(!alive(tag))return;const completed=await (role==='alisa'?alisaLifecycle:lifecycle)[kind]({role,position:busyOrigin,play:controller.play});if(alive(tag)&&completed){controller.play('idle');if(kind==='exit')sprite.style.visibility='hidden';setStage('idle');log(kind+'-demo-complete');}}finally{if(alive(tag)){busy=false;busyOrigin=null;pet.disabled=kind==='exit';}}return snapshot();}
 function snapshot(){const value=controller.snapshot(),c=manifest?.characters?.[value.role]?.clips?.[value.state],index=Math.round(Math.abs(parseFloat(sprite.style.backgroundPosition)||0)/112);return {...value,reducedMotion:reduce.matches,transferStage:stage,transferBusy:busy,lifecycle:lifecycle.snapshot(),alisaLifecycle:alisaLifecycle.snapshot(),bodySourceIndex:c?.sourceIndices?.[index],ghost:{visible:ghost.dataset.visible==='true',phase:ghost.dataset.phase,sourceIndex:Number(ghost.dataset.sourceIndex)},daggerCount:root.querySelectorAll('.hx-dagger').length,effectCount:nodes.size,eventLog:[...events]};}
 return {...controller,ready,snapshot,cancel,entrance(options){transferPromise=demoLifecycle('enter',options);return transferPromise;},exit(options){transferPromise=demoLifecycle('exit',options);return transferPromise;},whenSettled:()=>controller.snapshot().role==='alisa'&&!busy?controller.whenSettled():transferPromise,openMenu(){if(!busy&&!selection)controller.openMenu();},switchCharacter(){if(!busy&&!selection)return controller.switchCharacter();},demo:async()=>{await ready;if(busy||selection)return;if(controller.snapshot().role!=='hyakka')await controller.switchCharacter();const v=viewport(),from=clampPetPosition({x:v.left+42,y:v.top+v.height-165},v),to=clampPetPosition({x:v.left+v.width-164,y:v.top+Math.max(160,v.height*.43)},v);controller.place(from);const id=913,event=(name,x,y)=>pet.dispatchEvent(new win.PointerEvent(name,{bubbles:true,pointerId:id,pointerType:'mouse',button:0,clientX:x,clientY:y}));event('pointerdown',from.x+56,from.y+44);event('pointermove',from.x+56+(to.x-from.x),from.y+44+(to.y-from.y));await pause(500,epoch);event('pointerup',to.x+56,to.y+44);await transferPromise;return snapshot();},destroy(){if(destroyed)return;cancel('destroy');destroyed=true;abort.abort();lifecycle.destroy();alisaLifecycle.destroy();controller.destroy();}};
}
