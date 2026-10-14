// Whole-character entrance/exit clips are model drawn. Only detached props and
// spatial movement are animated here. This module can be passed as transitionHooks.
export function createHyakkaLifecycle({root,sprite,assetBase,getManifest,motionPreference,onStage=()=>{}}){
 const doc=root.ownerDocument,win=doc.defaultView,reduce=motionPreference??win.matchMedia('(prefers-reduced-motion: reduce)');
 const style=doc.createElement('style');style.textContent=`.hx-entry-dagger,.hx-bomb,.hx-smoke,.hx-sweep{position:absolute;pointer-events:none;object-fit:contain}.hx-entry-dagger{width:30px;transform-origin:100% 50%;filter:drop-shadow(0 0 2px #ddd4f0)}.hx-bomb{width:24px;height:24px}.hx-smoke{width:256px;height:256px}.hx-sweep{width:210px;height:110px;mix-blend-mode:screen;filter:drop-shadow(0 0 6px #d5bcff)}.hx-ground-sweep{position:absolute;width:210px;height:70px;pointer-events:none;object-fit:contain;filter:drop-shadow(0 0 3px #bbf1f6)}.hx-ground-dust{position:absolute;width:4px;height:3px;background:#c7beab;border-radius:50%;pointer-events:none}.hx-ground-contact{position:absolute;width:6px;height:6px;background:#fff5da;clip-path:polygon(50% 0,65% 38%,100% 50%,65% 62%,50% 100%,35% 62%,0 50%,35% 38%);pointer-events:none}`;root.prepend(style);
 let epoch=0,busy=false,phase='idle',destroyed=false;const nodes=new Set(),animations=new Set(),timers=new Map(),events=[];
 const log=(event,extra={})=>{events.push({event,at:Math.round(win.performance.now()),...extra});if(events.length>40)events.shift();};
 const stage=name=>{phase=name;root.dataset.lifecycleStage=name;onStage(name);log(name);};
 function clear(){for(const [id,resolve]of timers){win.clearTimeout(id);resolve();}timers.clear();for(const a of animations)a.cancel();animations.clear();for(const n of nodes)n.remove();nodes.clear();sprite.style.removeProperty('translate');sprite.style.opacity='';sprite.style.filter='';}
 function cancel(reason='cancel'){epoch++;busy=false;clear();stage('idle');log(reason);}
 const alive=tag=>tag===epoch&&!destroyed;
 function pause(ms,tag){return new Promise(resolve=>{const id=win.setTimeout(()=>{timers.delete(id);resolve();},reduce.matches?0:ms);timers.set(id,resolve);}).then(()=>{if(!alive(tag))throw Error('lifecycle-cancelled');});}
 function picture(kind,file,x,y,initial={}){const el=doc.createElement('img');el.className='hx-'+kind;el.alt='';el.src=assetBase+file;el.style.left=x+'px';el.style.top=y+'px';Object.assign(el.style,initial);root.append(el);nodes.add(el);return el;}
 function effect(el,keyframes,{duration=300,delay=0,easing='ease-out',remove=false}={}){if(reduce.matches){if(remove){nodes.delete(el);el.remove();}return;}const a=el.animate(keyframes,{duration,delay,easing,fill:'forwards'});animations.add(a);a.finished.catch(()=>{}).finally(()=>{if(remove){nodes.delete(el);el.remove();}});return a;}
 function plantDagger(file,x,y,i,tag){
  // Delayed blades must already be hidden above the ground before insertion.
  // Otherwise forwards-only fill exposes the landing pose before the delay ends.
  const el=picture('entry-dagger',file,x-30,y-3,{opacity:'0',translate:'0 -100px',transform:`rotate(${90+(i%3-1)*7}deg)`});
  const a=el.animate([{opacity:0,translate:'0 -100px'},{opacity:1,translate:'0 0'}],{duration:240,delay:i*18,easing:'cubic-bezier(.4,0,.9,.7)',fill:'both'});animations.add(a);
  a.finished.then(()=>{
   if(alive(tag)&&nodes.has(el)){
    // Persist the landing pose, then release opacity/translate before sweeping.
    // Cancellation cannot flash the hidden inline start pose in a rendered frame.
    el.style.opacity='1';el.style.translate='0 0';a.cancel();
   }
   animations.delete(a);
  },()=>{animations.delete(a);});
  return el;
 }
 function sweep(point,fx,daggers){stage('entry-sweep');const cx=point.x+56,cy=point.y+99;
  const arc=picture('ground-sweep',fx.groundSweep,cx-105,cy-34);root.insertBefore(arc,sprite.parentElement);effect(arc,[{opacity:0,clipPath:'inset(0 100% 0 0)',scale:'.7 .8'},{opacity:.95,clipPath:'inset(0 0 0 0)',scale:'1 1',offset:.32},{opacity:0,scale:'1.2 1.12'}],{duration:430,remove:true});
  daggers.forEach((el,i)=>{const theta=i*Math.PI/4+Math.PI/2,dx=Math.cos(theta)*110,dy=Math.sin(theta)*42-55,delay=i*22;effect(el,[{opacity:1,transform:el.style.transform},{opacity:1,transform:`translate(${dx*.32}px,${dy*.35}px) rotate(${90+i*18+150}deg)`,offset:.3},{opacity:0,transform:`translate(${dx}px,${dy}px) rotate(${90+i*18+460}deg)`}],{duration:290,delay,remove:true});
   const hit=doc.createElement('i');hit.className='hx-ground-contact';hit.style.left=cx+Math.cos(i*Math.PI/4)*66-3+'px';hit.style.top=cy+Math.sin(i*Math.PI/4)*20-3+'px';root.append(hit);nodes.add(hit);effect(hit,[{opacity:0,scale:'.1'},{opacity:1,scale:'1.8',offset:.2},{opacity:0,scale:'.2'}],{duration:120,delay,remove:true});
  });log('daggers-swept',{count:daggers.length});
  for(let i=0;i<24;i++){const theta=i*Math.PI/12,el=doc.createElement('i');el.className='hx-ground-dust';el.style.cssText=`left:${cx+Math.cos(theta)*44}px;top:${cy+Math.sin(theta)*14}px`;root.append(el);nodes.add(el);effect(el,[{opacity:0,scale:'.2'},{opacity:.7,offset:.2},{opacity:0,translate:`${Math.cos(theta)*45}px ${Math.sin(theta)*14-8}px`,scale:'.7'}],{duration:340+i%4*30,delay:i*6,remove:true});}
 }
 async function run(kind,{role='hyakka',position,play,signal}={}){
  if(role!=='hyakka'||signal?.aborted)return false;if(busy||destroyed)return false;const fx=getManifest()?.transfer;if(!fx?.smoke||!fx?.smokeBomb||!fx?.groundSweep)throw Error('Hyakka lifecycle assets unavailable');
  const tag=++epoch;busy=true;clear();sprite.style.visibility='';const onAbort=()=>cancel('transition-aborted');signal?.addEventListener('abort',onAbort,{once:true});
  try{if(reduce.matches){play('idle');stage('idle');log(kind+'-complete',{reducedMotion:true});return true;}
   if(kind==='enter'){
    stage('entry-daggers');sprite.style.opacity='0';const daggers=[];
    for(let i=0;i<8;i++){const theta=i*Math.PI/4,x=position.x+56+Math.cos(theta)*66,y=position.y+98+Math.sin(theta)*20;daggers.push(plantDagger(fx.dagger,x,y,i,tag));}log('daggers-planted',{count:8});
    await pause(430,tag);stage('entry-descent');play('enter');sprite.style.opacity='';effect(sprite,[{opacity:0,translate:'0 -230px',offset:0},{opacity:1,translate:'0 -200px',offset:.12},{opacity:1,translate:'0 0'}],{duration:340,easing:'cubic-bezier(.42,0,.85,.4)'});
    await pause(340,tag);sweep(position,fx,daggers);await pause(930,tag);play('idle');stage('idle');log('enter-complete');
   }else{
    stage('exit-toss');play('exit');await pause(fx.exitEmitMs??320,tag);const bomb=picture('bomb',fx.smokeBomb,position.x+22,position.y+53);effect(bomb,[{opacity:1,translate:'0 0',rotate:'-25deg'},{opacity:1,translate:'-15px -12px',rotate:'90deg',offset:.35},{opacity:1,translate:'-7px 45px',rotate:'220deg'}],{duration:210,easing:'cubic-bezier(.35,.1,.85,.5)'});log('bomb-thrown');
    await pause(210,tag);nodes.delete(bomb);bomb.remove();stage('exit-smoke');const cloud=picture('smoke',fx.smoke,position.x-72,position.y-104);effect(cloud,[{opacity:0,scale:'.08'},{opacity:1,scale:'1',offset:.18},{opacity:1,scale:'1.12',offset:.5},{opacity:0,scale:'1.45'}],{duration:820});
    effect(sprite,[{opacity:1},{opacity:0}],{duration:140,delay:60});log('smoke-covered');await pause(820,tag);stage('idle');log('exit-complete');
   }
   if(kind==='exit')sprite.style.visibility='hidden';return true;
  }catch(error){if(error.message!=='lifecycle-cancelled')throw error;return false;}
  finally{signal?.removeEventListener('abort',onAbort);if(alive(tag)){busy=false;clear();}}
 }
 return {enter:ctx=>run('enter',ctx),exit:ctx=>run('exit',ctx),cancel,snapshot:()=>({busy,phase,daggerCount:root.querySelectorAll('.hx-entry-dagger').length,bombCount:root.querySelectorAll('.hx-bomb').length,smokeCount:root.querySelectorAll('.hx-smoke').length,effectCount:nodes.size,events:[...events]}),destroy(){cancel('destroy');destroyed=true;style.remove();}};
}
