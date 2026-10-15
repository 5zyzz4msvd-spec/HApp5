const imagePools=new WeakMap();
export function decodePetImage(win,url){
 let pool=imagePools.get(win);if(!pool){pool=new Map();imagePools.set(win,pool);}
 if(pool.has(url))return pool.get(url);
 const task=new Promise((resolve,reject)=>{const image=new win.Image();image.onload=()=>Promise.resolve(image.decode?.()).then(()=>resolve(image),reject);image.onerror=()=>reject(Error('桌宠动作加载失败：'+url));image.src=url;});
 pool.set(url,task);task.catch(()=>{if(pool.get(url)===task)pool.delete(url);});return task;
}
export const PET_CHARACTERS=['alisa','hyakka'];
export const PET_NAMES={alisa:'西园寺爱丽莎',hyakka:'千杀百花'};
export function clampPetPosition(position,viewport,size=112){
 const padding=8;
 return {x:Math.max(viewport.left+padding,Math.min(position.x,viewport.left+viewport.width-size-padding)),y:Math.max(viewport.top+padding,Math.min(position.y,viewport.top+viewport.height-size-padding))};
}
// A suspended toy keeps an unwrapped angular coordinate. Pointer acceleration
// supplies an impulse; gravity and air drag settle it into the nearest full turn.
export function impulseDragRotation(state,{vx=0,vy=0,previousVx=0,previousVy=0}={}){
 const angle=state.angle??0,raw=-((vx-previousVx)*Math.cos(angle)+(vy-previousVy)*Math.sin(angle))*.012;
 // A coalesced high-speed pointer sample cannot reverse the toy's angular
 // velocity from one saturation extreme to the other in a single event.
 const impulse=Math.sign(raw)*Math.min(12,Math.abs(raw));
 return {...state,angle,omega:Math.max(-14,Math.min(14,(state.omega??0)+impulse))};
}
export function stepDragSpring(state,_velocity,dt,manualTarget=null){
 const h=Math.max(0,Math.min(dt,.05)),steps=Math.max(1,Math.ceil(h/.005)),step=h/steps;
 let {angle=0,omega=0}=state;
 for(let i=0;i<steps;i++){
  const torque=Number.isFinite(manualTarget)?95*(manualTarget-angle)-18*omega:-9*Math.sin(angle)-1.1*omega;
  omega+=torque*step;if(Number.isFinite(manualTarget))omega=Math.max(-18,Math.min(18,omega));angle+=omega*step;
 }
 return {angle,omega};
}
// Playback consumes a bounded amount of visible time after a stalled main
// thread. Every real pose remains readable instead of skipping the whole action.
export function advanceClipClock(clock,now,maxStep=50){
 return {at:now,elapsed:clock.elapsed+Math.max(0,Math.min(maxStep,now-clock.at))};
}
export function reversedMenuClip(base,index,opening,origin){
 const forward=opening===(origin==='menu-open'),frames=[];
 for(let i=index;forward?i<base.frames:i>=0;i+=forward?1:-1)frames.push(i);
 return {...base,menuOrigin:origin,frames:frames.length,frameIndices:frames,durations:frames.map(i=>Math.min(85,base.durations?.[i]??75)),loop:false};
}
export function clipDuration(clip){return (clip?.durations??Array(clip?.frames??1).fill(1000/(clip?.fps??16))).reduce((a,b)=>a+b,0);}
// Grip coordinates live in the authored tile, so the whole drawn body rotates
// around the hair grasp without any limb manipulation or pointer-follow lag.
export function dragGripForClip(character,clip,index=0,size=112){
 const grip=clip?.grips?.[index]??clip?.grip??character?.dragGrip??{x:56,y:18,tileSize:112};
 const scale=size/(grip.tileSize??character?.dragGrip?.tileSize??112);
 return {x:grip.x*scale,y:grip.y*scale};
}
export function anchoredPetPosition(pointer,grip){return {x:pointer.x-grip.x,y:pointer.y-grip.y};}
export function continuousTurnDelta(previous,current){return Math.atan2(Math.sin(current-previous),Math.cos(current-previous));}
export function chooseIdle(previous,random=Math.random,available=['idle','idle-look','idle-greet']){
 const variants=available.filter(x=>x!==previous);
 if(!variants.length)return available[0]??'idle';
 return variants[Math.min(variants.length-1,Math.floor(random()*variants.length))];
}
export function frameAt(clip,elapsed){
 const durations=clip.durations??Array(clip.frames).fill(1000/(clip.fps??16));
 const total=durations.reduce((a,b)=>a+b,0);
 let t=clip.loop?elapsed%total:Math.min(elapsed,total-Number.EPSILON);
 for(let index=0;index<durations.length;index++){if(t<durations[index])return {index,done:!clip.loop&&elapsed>=total,total};t-=durations[index];}
 return {index:durations.length-1,done:!clip.loop&&elapsed>=total,total};
}
export function legacyClips(role,base){
 const make=(group,frames=8,fps=16)=>({url:base+'pet/v5/'+role+'/'+role+'-'+group+'-v5.png',frames,columns:frames,rows:1,fps,loop:false});
 return {idle:{...make('idle'),durations:[1500,90,70,55,65,80,100,100],loop:true},'idle-look':make('unique-a'), 'idle-greet':make('unique-b'),drag:{...make('drag'),loop:true},landing:make('landing',12,20),enter:make('enter',8,18),exit:make('exit',8,18),charge:make('drag'),blink:make('landing',12,24)};
}

// Launch in world coordinates. Replacing the hair pivot with the body centre
// preserves every drawn pixel at release; v = omega × radius supplies the toss.
export function releasePetFlight({position,grip={x:56,y:18},angle=0,omega=0,vx=0,vy=0,velocityAge=Infinity,size=112}={}){
 if(!position||!Number.isFinite(angle)||!Number.isFinite(omega)||Math.abs(omega)<5.2)return null;
 const half=size/2,dx=half-grip.x,dy=half-grip.y,cos=Math.cos(angle),sin=Math.sin(angle),rx=dx*cos-dy*sin,ry=dx*sin+dy*cos;
 const freshness=Number.isFinite(velocityAge)?Math.exp(-Math.max(0,velocityAge)/.075):0,carry=.18*freshness;
 let launchVx=-omega*ry+Math.max(-1800,Math.min(1800,vx))*carry,launchVy=omega*rx+Math.max(-1800,Math.min(1800,vy))*carry;
 const speed=Math.hypot(launchVx,launchVy);if(speed>1150){launchVx*=1150/speed;launchVy*=1150/speed;}
 return{cx:position.x+grip.x+rx,cy:position.y+grip.y+ry,vx:launchVx,vy:launchVy,angle,omega,size,elapsed:0,wallBounces:0,floorBounces:0,done:false};
}
export function flightPetPosition(state){return{x:state.cx-state.size/2,y:state.cy-state.size/2};}
export function petFlightLandingPosition(state,viewport){const position=flightPetPosition(state);return clampPetPosition({...position,y:viewport.top+viewport.height-state.size-8},viewport,state.size);}
// A fixed 240Hz solver keeps the same bounces at 30/60/120Hz. A stalled tab
// consumes at most 50ms, matching the visible animation clock instead of warping.
export function stepPetFlight(state,viewport,dt){
 if(!state||state.done)return state;
 const result={...state},h=Math.max(0,Math.min(Number(dt)||0,.05)),count=Math.max(1,Math.ceil(h*240-1e-10)),step=h/count;
 for(let i=0;i<count&&!result.done;i++){
  const drag=Math.exp(-.16*step),spin=Math.exp(-.72*step);result.elapsed+=step;result.vx*=drag;result.vy=(result.vy+1100*step)*drag;result.cx+=result.vx*step;result.cy+=result.vy*step;result.angle+=result.omega*(1-spin)/.72;result.omega*=spin;
  const radius=result.size/2*(Math.abs(Math.cos(result.angle))+Math.abs(Math.sin(result.angle))),padding=8;
  let left=viewport.left+padding+radius,right=viewport.left+viewport.width-padding-radius,top=viewport.top+padding+radius,bottom=viewport.top+viewport.height-padding-radius;
  if(left>right)left=right=viewport.left+viewport.width/2;if(top>bottom)top=bottom=viewport.top+viewport.height/2;
  if(result.cx<left){result.cx=left;if(result.vx<0){result.vx=-result.vx*.62;result.omega*=.9;result.wallBounces++;}}
  if(result.cx>right){result.cx=right;if(result.vx>0){result.vx=-result.vx*.62;result.omega*=.9;result.wallBounces++;}}
  if(result.cy<top){result.cy=top;if(result.vy<0){result.vy=-result.vy*.58;result.omega*=.9;result.wallBounces++;}}
  if(result.cy>=bottom){
   result.cy=bottom;
   if(result.vy>75){result.vy=-result.vy*.32;result.vx*=.76;result.omega*=.76;result.floorBounces++;}
   else{result.vy=0;result.vx*=Math.exp(-8*step);result.omega*=Math.exp(-3*step);}
   if((Math.abs(result.vy)<28&&Math.abs(result.vx)<42)||result.elapsed>=6){result.done=true;result.vy=0;}
  }
 }
 return result;
}
