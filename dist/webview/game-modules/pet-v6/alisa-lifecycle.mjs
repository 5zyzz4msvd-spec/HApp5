import {assetUrl} from '../resources/asset-url.mjs';
import {clipDuration} from './motion.mjs';

// The stage is independent ImageGen decoration. Character poses remain approved
// whole-character strips; no limb or body transforms create new character poses.
export function createAlisaLifecycle({root,sprite,assetBase='/public/frontends/hypnosis-app/assets/',getManifest,motionPreference,onStage=()=>{}}){
 const doc=root.ownerDocument,win=doc.defaultView,reduce=motionPreference??win.matchMedia('(prefers-reduced-motion: reduce)');
 const style=doc.createElement('style');style.textContent=`
 .al-spotlight,.al-heart,.al-stage{position:absolute;pointer-events:none}
 .al-spotlight{width:184px;height:235px;background:linear-gradient(180deg,#fff4bdad,#ffdd965c 55%,#ffe8b508);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);filter:drop-shadow(0 0 10px #ffe6a3);mix-blend-mode:screen}
 .al-heart{color:#ff86b9;font:20px/1 Georgia,serif;text-shadow:0 0 5px #ffe0ee}
 .al-stage{width:192px;height:184px;isolation:isolate}
 .al-curtain-mask{position:absolute;inset:8px 0 0;overflow:hidden;filter:drop-shadow(0 4px 5px #21091955)}
 .al-curtain-drop{position:absolute;inset:0;will-change:transform;transform:translate3d(0,-100%,0)}
 .al-curtain-back{position:absolute;left:3%;right:3%;top:8%;bottom:8%;background:#682133}
 .al-curtain{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
 .al-stage-header{position:absolute;left:0;top:0;width:100%;height:32px;object-fit:fill;z-index:2;filter:drop-shadow(0 2px 2px #30172044)}
 `;root.prepend(style);
 let epoch=0,busy=false,phase='idle',destroyed=false;
 const nodes=new Set(),animations=new Set(),timers=new Map(),events=[];
 const log=(event,extra={})=>{events.push({event,at:Math.round(win.performance.now()),...extra});if(events.length>60)events.shift();};
 function stage(name){phase=name;root.dataset.alisaLifecycleStage=name;onStage(name);log(name);}
 function clear(){for(const [id,resolve]of timers){win.clearTimeout(id);resolve();}timers.clear();for(const a of animations)a.cancel();animations.clear();for(const n of nodes)n.remove();nodes.clear();sprite.style.opacity='';sprite.style.removeProperty('translate');sprite.style.removeProperty('transform-origin');}
 function cancel(reason='cancel'){epoch++;busy=false;clear();stage('idle');log(reason);}
 const alive=tag=>tag===epoch&&!destroyed;
 function assertAlive(tag){if(!alive(tag))throw Error('alisa-lifecycle-cancelled');}
 function pause(ms,tag){return new Promise(resolve=>{const id=win.setTimeout(()=>{timers.delete(id);resolve();},reduce.matches?0:Math.max(0,ms));timers.set(id,resolve);}).then(()=>assertAlive(tag));}
 function node(kind,x,y){const el=doc.createElement('i');el.className='al-'+kind;el.setAttribute('aria-hidden','true');el.style.left=x+'px';el.style.top=y+'px';root.append(el);nodes.add(el);return el;}
 function effect(el,keyframes,options){const a=el.animate(keyframes,{fill:'both',easing:'ease-out',...options});animations.add(a);a.finished.catch(()=>{});return a;}
 function curtainStage(position){
  const width=192,height=184,v=win.visualViewport;
  const left=v?.offsetLeft??0,top=v?.offsetTop??0,vw=v?.width??win.innerWidth,vh=v?.height??win.innerHeight;
  const stageRoot=node('stage',Math.max(left,Math.min(position.x-40,left+vw-width)),Math.max(top,Math.min(position.y-44,top+vh-height)));
  const mask=doc.createElement('span');mask.className='al-curtain-mask';
  const drop=doc.createElement('span');drop.className='al-curtain-drop';
  const back=doc.createElement('span');back.className='al-curtain-back';
  const cloth=doc.createElement('img');cloth.className='al-curtain';cloth.alt='';cloth.src=assetUrl(assetBase,'pet/v6/alisa-stage-cloth.png');cloth.draggable=false;drop.append(back,cloth);mask.append(drop);
  const header=doc.createElement('img');header.className='al-stage-header';header.alt='';header.src=assetUrl(assetBase,'pet/v6/alisa-stage-header.png');header.draggable=false;
  stageRoot.append(mask,header);return{stageRoot,cloth:drop};
 }
 async function finishClip(result,duration,tag){if(result?.then)await result;else await pause(duration,tag);assertAlive(tag);}
 async function run(kind,{role,position,play,signal}={}){
  if(role!=='alisa'||signal?.aborted||destroyed||busy)return false;
  const character=getManifest()?.characters?.alisa;if(!character?.clips?.[kind])return false;
  const timing=character.lifecycle??{},duration=clipDuration(character.clips[kind]),tag=++epoch;
  busy=true;clear();if(kind!=='enter')sprite.style.visibility='';
  const onAbort=()=>cancel('transition-aborted');signal?.addEventListener('abort',onAbort,{once:true});
  try{
   if(reduce.matches){play('idle');sprite.style.visibility='';stage('idle');log(kind+'-complete',{reducedMotion:true});return true;}
   if(kind==='enter'){
    stage('spotlight');const light=node('spotlight',position.x-36,position.y-128);root.insertBefore(light,sprite.parentElement);
    effect(light,[{opacity:0},{opacity:.7,offset:.18},{opacity:.65,offset:.82},{opacity:0}],{duration:duration+180});
    const entered=play('enter');sprite.style.transformOrigin=`${character.groundAnchor?.x??56}px ${character.groundAnchor?.y??108.7}px`;
    effect(sprite,[{opacity:0,scale:'.48',translate:'0 -24px'},{opacity:.65,scale:'.8',translate:'0 -9px',offset:.55},{opacity:1,scale:'1',translate:'0 0'}],{duration:Math.min(900,duration),easing:'cubic-bezier(.2,.65,.3,1)'});sprite.style.visibility='';log('enter-clip-start');
    // Heart cues follow the actual rendered wink, even after a main-thread stall.
    if(entered?.atFrame)await entered.atFrame(timing.winkFrame??3);else await pause(timing.heartMs??460,tag);
    assertAlive(tag);stage('wink-hearts');
    for(let i=0;i<3;i++){const heart=node('heart',position.x+78+i*6,position.y+24-i*7);heart.textContent='♥';effect(heart,[{opacity:0,scale:'.2',translate:'0 0'},{opacity:.9,scale:'.7',offset:.2},{opacity:0,scale:'.9',translate:`${12+i*9}px ${-22-i*8}px`}],{duration:500,delay:i*65});}
    log('hearts-emitted',{count:3});await finishClip(entered,duration,tag);play('idle');
   }else{
    stage('bow');const bowed=play('exit');log('bow-clip-start');await finishClip(bowed,duration,tag);log('bow-complete');
    // The complete bow is visible before the independent heavy cloth descends.
    stage('curtain-drop');const {stageRoot,cloth}=curtainStage(position);
    effect(stageRoot,[{opacity:0},{opacity:1}],{duration:120});
    const drop=720;effect(cloth,[{transform:'translate3d(0,-100%,0)'},{transform:'translate3d(0,0,0)'}],{duration:drop,delay:100,easing:'cubic-bezier(.32,.02,.25,1)'});
    log('curtain-drop-start',{delay:100,duration:drop});await pause(drop+100,tag);
    stage('curtain-covered');sprite.style.opacity='0';log('character-covered');await pause(240,tag);
    effect(stageRoot,[{opacity:1},{opacity:0}],{duration:180});await pause(180,tag);
   }
   stage('idle');log(kind+'-complete');return true;
  }catch(error){if(error.message!=='alisa-lifecycle-cancelled')throw error;return false;}
  finally{signal?.removeEventListener('abort',onAbort);if(alive(tag)){busy=false;clear();}}
 }
 return{enter:ctx=>run('enter',ctx),exit:ctx=>run('exit',ctx),cancel,snapshot:()=>({busy,phase,effectCount:nodes.size,spotlightCount:root.querySelectorAll('.al-spotlight').length,heartCount:root.querySelectorAll('.al-heart').length,curtainCount:root.querySelectorAll('.al-curtain').length,headerCount:root.querySelectorAll('.al-stage-header').length,events:[...events]}),destroy(){cancel('destroy');destroyed=true;style.remove();}};
}
