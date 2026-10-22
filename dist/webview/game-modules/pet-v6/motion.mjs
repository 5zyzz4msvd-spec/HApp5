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
// Horizontal distance supplies spin drive; vertical movement never supplies
// angular torque. Consume the drive over 65ms rather than flipping speed at an
// individual pointer sample. Coordinates stay unwrapped through full turns.
export function impulseDragRotation(state,{dx=0}={}){
 return{...state,drive:Math.max(-18,Math.min(18,(state.drive??0)-Math.max(-240,Math.min(240,dx))*.075))};
}
export function stepDragSpring(state,velocity={},dt){
 const h=Math.max(0,Math.min(Number(dt)||0,.05)),steps=Math.max(1,Math.ceil(h*240)),step=h/steps;
 let{angle=0,omega=0,drive=0,stretch=0,stretchV=0}=state;
 const target=Math.max(-.065,Math.min(.065,(velocity?.vy??0)*.000035));
 for(let i=0;i<steps;i++){
  const transfer=drive*(1-Math.exp(-step/.065));drive-=transfer;
  omega=Math.max(-13,Math.min(13,(omega+transfer)*Math.exp(-.85*step)));angle+=omega*step;
  stretchV+=(220*(target-stretch)-22*stretchV)*step;stretch+=stretchV*step;
 }
 return{angle,omega,drive,stretch:Math.max(-.085,Math.min(.085,stretch)),stretchV};
}
// A small clip catches the same hair grip. Keep its world position fixed while
// continuing the current angular velocity, then brake into an upright full turn.
export function beginPetSettle(state){
 const angle=state.angle??0,omega=state.omega??0,turn=Math.PI*2;
 let target=Math.round(angle/turn)*turn;
 if(Math.abs(omega)>1){const predicted=angle+omega*.18;target=(omega>0?Math.ceil(predicted/turn):Math.floor(predicted/turn))*turn;}
 const delta=target-angle,duration=Math.max(.42,Math.min(1.15,2*Math.abs(delta)/Math.max(4,Math.abs(omega))));
 return{...state,startAngle:angle,startOmega:omega,target,duration,elapsed:0,drive:0,done:false};
}
export function stepPetSettle(state,dt){
 const elapsed=Math.min(state.duration,state.elapsed+Math.max(0,Math.min(Number(dt)||0,.05))),u=elapsed/state.duration,d=state.target-state.startAngle,v=state.startOmega*state.duration;
 const a=10*d-6*v,b=-15*d+8*v,c=6*d-3*v,angle=state.startAngle+v*u+a*u**3+b*u**4+c*u**5,omega=(v+3*a*u*u+4*b*u**3+5*c*u**4)/state.duration;
 const shape=stepDragSpring({...state,angle,omega,drive:0},{},elapsed-state.elapsed);
 return{...state,stretch:shape.stretch,stretchV:shape.stretchV,angle,omega,elapsed,done:elapsed>=state.duration};
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

