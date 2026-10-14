import { COMBAT_CONFIG } from './combat-config.mjs';
import { commandBattleProfile,vipHealth } from './combat-command-profile.mjs';
import { animateSurface } from '../ui/surface-motion.mjs';
import { CREDIT } from './credits.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
export function resistanceStats(values={}){
 const affection=clamp(values.affection??values.好感度,-100,100),vigilance=clamp(values.vigilance??values.警戒度,0,100),obedience=clamp(values.obedience??values.服从度,0,100);
 const desire=clamp(values.desire??values.性欲,0,100),pleasure=clamp(values.pleasure??values.快感值,0,100),sensitivity=clamp(values.sensitivity??values.敏感度??100,0,300);
 const susceptibility=.4*desire/100+.35*pleasure/100+.25*sensitivity/300;
 return{hp:Math.max(100,Math.round(300-2*affection)),mitigation:.72*(vigilance/100)**1.35,damage:Math.round(6+18*(1-obedience/100)**1.2),cooldown:Math.round(650+1950*susceptibility)};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const playerInArc=(player,target)=>{const dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy)||1;return player.arc==='all'||(player.arc==='vertical'?Math.max(Math.abs(dx),Math.abs(dy))/d>=Math.cos(Math.PI/6):Math.abs(dx)/d>=Math.cos(Math.PI/6));};
export class ResistanceBattle{
 constructor(people,{seed=7291,commandRequests=[],storyEvents={},vipRank}={}){
  this.seed=seed;this.time=0;this.elapsedMs=0;this.state='running';this.endReason='';this.policeMonitoring=storyEvents.policeMonitoring===true;this.bullets=[];this.friendlyBullets=[];this.effects=[];this.arena={x:320,y:240,r:210};
  this.commandProfile=commandBattleProfile(commandRequests);const power=this.commandProfile,rank=vipRank??power.tier,health=vipHealth(rank);
  this.player={...power,id:'phone',name:'手机',x:320,y:240,r:14,vx:73,vy:49,hp:health,maxHp:health,vipRank:Number(rank)||0,cd:power.cooldown/1000,attack:power.warmup/1000,invulnerable:0};
  this.targets=people.map((person,index)=>{const stats=resistanceStats(person.combatValues),config=COMBAT_CONFIG[person.name]??{mechanism:'barrage',speed:62,range:140,projectileCount:3};const a=index*Math.PI*2/Math.max(1,people.length)+.3;const policeDeadline=this.policeMonitoring&&person.name==='九鬼真白';return{...person,...stats,config,policeDeadline,hp:stats.hp,maxHp:stats.hp,x:320+Math.cos(a)*150,y:240+Math.sin(a)*150,vx:Math.cos(a+1)*config.speed,vy:Math.sin(a+1)*config.speed,r:16,attack:index*.25,contact:0};});
  if(!this.targets.length)this.state='success';
 }
 pause(){if(this.state==='running')this.state='paused';}
 resume(){if(this.state==='paused')this.state='running';}
 cancel(){if(['running','paused'].includes(this.state)){this.state='cancelled';this.endReason='cancelled';this.bullets=[];this.friendlyBullets=[];this.effects=[];}}
 policeWarning(){const attacker=this.targets.find(t=>t.policeDeadline&&t.hp>0);return attacker&&['running','paused'].includes(this.state)?{name:attacker.name,remainingMs:Math.max(0,2000-this.elapsedMs)}:null;}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 bounce(body,dt){body.x+=body.vx*dt;body.y+=body.vy*dt;const dx=body.x-this.arena.x,dy=body.y-this.arena.y,d=Math.hypot(dx,dy),limit=this.arena.r-body.r;if(d>limit){const nx=dx/d,ny=dy/d,dot=body.vx*nx+body.vy*ny;if(dot>0){body.vx-=2*dot*nx;body.vy-=2*dot*ny;}body.x=this.arena.x+nx*limit;body.y=this.arena.y+ny*limit;}}
 hitPlayer(damage){if(this.player.invulnerable<=0){this.player.hp=Math.max(0,this.player.hp-damage);this.player.invulnerable=.18;this.effects.push({kind:'hit',x:this.player.x,y:this.player.y,life:.25});}}
 step(dt){if(this.state!=='running')return;const activeDt=Number.isFinite(dt)?Math.max(0,dt):0;this.elapsedMs+=activeDt*1000;
  // The telegraphed strike uses active elapsed time, independent of capped physics and defence.
  if(this.elapsedMs>=2000-1e-7&&this.targets.some(t=>t.policeDeadline&&t.hp>0)){this.player.hp=0;this.state='failure';this.endReason='police-deadline';this.effects.push({kind:'hit',x:this.player.x,y:this.player.y,life:.25});return;}
  dt=Math.min(.035,activeDt);this.time+=dt;const p=this.player;p.invulnerable-=dt;this.bounce(p,dt);p.attack-=dt;
  const reachable=this.targets.filter(target=>target.hp>0&&distance(p,target)<=p.acquireRange&&(p.remote||playerInArc(p,target)));
  if(p.attack<=0&&reachable.length){
   p.attack=p.cd;
   this.effects.push({kind:'player',x:p.x,y:p.y,life:.45,range:p.range,arc:p.arc});
   if(p.remote){
    // All projectiles from a volley share hit ownership; one target takes one strike per volley.
    const waveHits=new Set(),nearest=reachable.reduce((a,b)=>distance(p,a)<=distance(p,b)?a:b),lead=distance(p,nearest)/p.projectileSpeed,aim=Math.atan2(nearest.y+nearest.vy*lead-p.y,nearest.x+nearest.vx*lead-p.x),directions=Array.from({length:p.projectileCount},(_,i)=>aim+i*Math.PI*2/p.projectileCount);
    for(const a of directions)this.friendlyBullets.push({x:p.x,y:p.y,vx:Math.cos(a)*p.projectileSpeed,vy:Math.sin(a)*p.projectileSpeed,r:4,life:p.range/p.projectileSpeed,hitIds:[],waveHits});
   }else for(const target of reachable)target.hp=Math.max(0,target.hp-p.damage*(1-target.mitigation));
  }
  for(const t of this.targets.filter(x=>x.hp>0)){this.bounce(t,dt);if(t.policeDeadline)continue;if(t.swing){t.swing.remaining-=dt;if(t.swing.remaining<=0){if(distance(p,t)<t.swing.range&&Math.abs(angleDiff(Math.atan2(p.y-t.y,p.x-t.x),t.swing.angle))<t.swing.degrees*Math.PI/360)this.hitPlayer(t.damage);t.swing=null;}}t.attack-=dt;t.contact-=dt;if(distance(p,t)<p.r+t.r&&t.contact<=0){this.hitPlayer(t.damage);t.contact=.6;}
   if(t.attack<=0){t.attack=t.cooldown/1000;const angle=Math.atan2(p.y-t.y,p.x-t.x),cfg=t.config;
    if(cfg.mechanism==='sector'){this.effects.push({kind:'sector',x:t.x,y:t.y,angle,range:cfg.range,life:.3});t.swing={angle,range:cfg.range,degrees:cfg.sectorDegrees,remaining:.22};}
    else if(cfg.mechanism==='ram'){const speed=cfg.speed*(cfg.acceleration?2.5:1);t.vx=Math.cos(angle)*speed;t.vy=Math.sin(angle)*speed;this.effects.push({kind:'dash',x:t.x,y:t.y,life:.3});}
    else for(let i=0;i<cfg.projectileCount;i++){const a=angle+(i-(cfg.projectileCount-1)/2)*.23;this.bullets.push({x:t.x,y:t.y,vx:Math.cos(a)*145,vy:Math.sin(a)*145,damage:t.damage,r:4,life:3});}
   }
  }
  for(const bullet of this.bullets){bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;if(distance(bullet,p)<p.r+bullet.r){this.hitPlayer(bullet.damage);bullet.life=0;}if(distance(bullet,this.arena)>this.arena.r)bullet.life=0;}
  for(const bullet of this.friendlyBullets){if(p.homing){const target=this.targets.filter(t=>t.hp>0&&!bullet.hitIds.includes(t.id)&&!bullet.waveHits?.has(t.id)).sort((a,b)=>distance(bullet,a)-distance(bullet,b))[0];if(target){const a=Math.atan2(target.y-bullet.y,target.x-bullet.x),turn=Math.min(1,dt*9);bullet.vx+=(Math.cos(a)*p.projectileSpeed-bullet.vx)*turn;bullet.vy+=(Math.sin(a)*p.projectileSpeed-bullet.vy)*turn;}}bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;for(const t of this.targets.filter(x=>x.hp>0))if(!bullet.hitIds.includes(t.id)&&!bullet.waveHits?.has(t.id)&&distance(bullet,t)<bullet.r+t.r){t.hp=Math.max(0,t.hp-p.damage*(1-t.mitigation));bullet.hitIds.push(t.id);(bullet.waveHits??=new Set()).add(t.id);if(!p.pierce){bullet.life=0;break;}}if(distance(bullet,this.arena)>this.arena.r)bullet.life=0;}this.friendlyBullets=this.friendlyBullets.filter(x=>x.life>0);
  this.bullets=this.bullets.filter(x=>x.life>0);for(const fx of this.effects)fx.life-=dt;this.effects=this.effects.filter(x=>x.life>0);
  if(this.player.hp<=0){this.state='failure';this.endReason='phone-defeated';}else if(this.targets.every(x=>x.hp<=0))this.state='success';else if(this.time>=35){this.state='failure';this.endReason='timeout';}
 }
 result(){return{gate:'resistance',success:this.state==='success',duration:Math.round(this.elapsedMs/100)/10,...(this.endReason?{reason:this.endReason}:{}),targets:this.targets.map(x=>({id:x.id,name:x.name,defeated:x.hp<=0,resisted:x.hp>0})),plotGate:'pending',rule:'每个目标的resisted记录其机制上的抵抗结果。resisted=true不得写成功效果；false仅突破抵抗，剧情仍须独立判断命令是否越界、人设和条件，仍可拒绝或部分失败。'};}
}
export async function runResistanceBattle(container,people,options={}){
 const doc=container.ownerDocument,win=doc.defaultView,root=doc.createElement('section');root.className='hypnosis-battle floating-surface';root.setAttribute('role','dialog');root.setAttribute('aria-label','催眠抵抗模拟器');
 root.innerHTML='<style>.hypnosis-battle{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;background:#100c19da;backdrop-filter:blur(14px);color:#eee1ff;font:14px system-ui}.battle-card{width:min(760px,94vw);border:1px solid #aa8abb55;border-radius:28px;background:radial-gradient(at 50% 70%,#342340,#171222 72%);padding:22px;box-sizing:border-box;box-shadow:0 30px 90px #0008}.battle-card header{display:flex;justify-content:space-between;align-items:center}.battle-card h2{margin:4px 0;font-weight:500}.battle-card small,.battle-card p{color:#bba9c8}.battle-card canvas{width:100%;max-height:65vh;object-fit:contain;display:block}.battle-result{text-align:center;font-size:18px;min-height:30px}.battle-credit{font-size:10px;text-align:center}.battle-controls{display:flex;gap:8px}.battle-controls button{border:0;border-radius:12px;background:#ffffff16;color:inherit;padding:9px 13px;font:inherit}.battle-warning{color:#ffd19e!important;font-weight:600;border:1px solid #ffbe7955;border-radius:12px;padding:12px;margin:12px 0}.battle-warning[hidden]{display:none}</style><div class="battle-card"><header><div><small>RESISTANCE / 01</small><h2>穿过抵抗</h2></div><span data-battle-health></span></header><div class="battle-controls"><button type="button" data-battle-pause>暂停</button><button type="button" data-battle-cancel>取消</button></div><p data-battle-warning class="battle-warning" role="status" aria-live="polite" hidden></p><p data-battle-mode>手机自动移动与攻击 · 初始攻击范围：左右扇区</p><canvas width="640" height="480"></canvas><div class="battle-result" role="status">正在连接目标意识…</div><p class="battle-credit"></p></div>';
 root.querySelector('.battle-credit').textContent=CREDIT;container.append(root);const battle=new ResistanceBattle(people,options),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),icons=new Map();root.querySelector('[data-battle-mode]').textContent='手机自动移动与攻击 · '+battle.commandProfile.label+' · '+battle.commandProfile.pattern;for(const person of people)if(person.head){const img=new win.Image();img.src=person.head;icons.set(person.id,img);}
 let raf,last=null,settle,endingTimer,finishEnding,ended=false;
 const pauseButton=root.querySelector('[data-battle-pause]');
 const syncPause=()=>{pauseButton.textContent=battle.state==='paused'?'继续':'暂停';pauseButton.disabled=!['running','paused'].includes(battle.state);};
 const pause=()=>{battle.pause();last=null;syncPause();};
 const togglePause=()=>{if(battle.state==='paused')battle.resume();else battle.pause();last=null;syncPause();};
 const cancel=()=>{battle.cancel();ended=true;win.cancelAnimationFrame(raf);if(endingTimer!==undefined)win.clearTimeout(endingTimer);finishEnding?.();settle?.();};
 const onKey=event=>{if(event.key==='Escape'){event.preventDefault();cancel();}};
 const onVisibility=()=>{if(doc.hidden)pause();};
 pauseButton.addEventListener('click',togglePause);root.querySelector('[data-battle-cancel]').addEventListener('click',cancel);doc.addEventListener('keydown',onKey);doc.addEventListener('visibilitychange',onVisibility);win.addEventListener('blur',pause);options.signal?.addEventListener('abort',cancel,{once:true});
 const cleanup=()=>{win.cancelAnimationFrame(raf);if(endingTimer!==undefined)win.clearTimeout(endingTimer);doc.removeEventListener('keydown',onKey);doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('blur',pause);options.signal?.removeEventListener('abort',cancel);pauseButton.removeEventListener('click',togglePause);root.querySelector('[data-battle-cancel]').removeEventListener('click',cancel);};
 try{await animateSurface(root,true);if(options.signal?.aborted||!root.isConnected)cancel();if(doc.hidden)pause();
 await new Promise(resolve=>{settle=resolve;if(ended){resolve();return;}const tick=now=>{if(!root.isConnected){cancel();return;}if(battle.state==='running'){if(last!==null)battle.step((now-last)/1000);last=now;}else last=null;ctx.clearRect(0,0,640,480);ctx.strokeStyle='#9f7bb955';ctx.lineWidth=2;ctx.beginPath();ctx.arc(320,240,210,0,Math.PI*2);ctx.stroke();
  for(const fx of battle.effects){ctx.save();ctx.globalAlpha=Math.min(1,fx.life*4);ctx.fillStyle=fx.kind==='player'?'#c6a8ed22':'#ff907933';ctx.beginPath();if(fx.kind==='player'){if(fx.arc==='all'){ctx.arc(fx.x,fx.y,fx.range,0,Math.PI*2);}else for(const angle of fx.arc==='vertical'?[0,Math.PI,Math.PI/2,-Math.PI/2]:[0,Math.PI]){ctx.moveTo(fx.x,fx.y);ctx.arc(fx.x,fx.y,fx.range,angle-Math.PI/6,angle+Math.PI/6);ctx.closePath();}}else if(fx.kind==='sector'){ctx.moveTo(fx.x,fx.y);ctx.arc(fx.x,fx.y,fx.range,fx.angle-.75,fx.angle+.75);ctx.closePath();}else ctx.arc(fx.x,fx.y,25,0,Math.PI*2);if(fx.kind==='player'){ctx.strokeStyle='#bfa5dd66';ctx.lineWidth=1.4;ctx.stroke();}else ctx.fill();ctx.restore();}
  for(const bullet of battle.friendlyBullets){ctx.fillStyle='#cfc1ff';ctx.beginPath();ctx.arc(bullet.x,bullet.y,4,0,Math.PI*2);ctx.fill();}for(const bullet of battle.bullets){ctx.fillStyle='#ffb993';ctx.beginPath();ctx.arc(bullet.x,bullet.y,4,0,Math.PI*2);ctx.fill();}
  for(const actor of [battle.player,...battle.targets]){if(actor.hp<=0)continue;ctx.save();ctx.shadowColor=actor.id==='phone'?'#d3b3ff':'#a783bc';ctx.shadowBlur=12;ctx.fillStyle=actor.id==='phone'?'#c3a1e0':'#3e2e53';ctx.beginPath();ctx.arc(actor.x,actor.y,actor.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;const img=icons.get(actor.id);if(img?.complete&&img.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(actor.x,actor.y,actor.r-1,0,Math.PI*2);ctx.clip();ctx.drawImage(img,actor.x-actor.r,actor.y-actor.r,actor.r*2,actor.r*2);ctx.restore();}else{ctx.fillStyle=actor.id==='phone'?'#21152e':'#eee';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(actor.id==='phone'?'▯':actor.name.slice(0,1),actor.x,actor.y);}ctx.fillStyle='#ffffff22';ctx.fillRect(actor.x-18,actor.y+21,36,3);ctx.fillStyle='#d3b3eb';ctx.fillRect(actor.x-18,actor.y+21,36*actor.hp/actor.maxHp,3);ctx.restore();}
  const warning=battle.policeWarning(),warningNode=root.querySelector('[data-battle-warning]');warningNode.hidden=!warning;
  if(warning)warningNode.textContent=`九鬼真白正在准备反击 · ${(Math.ceil(warning.remainingMs/100)/10).toFixed(1)} 秒后强制中断催眠${battle.state==='paused'?' · 已暂停':''}`;
  syncPause();root.querySelector('[data-battle-health]').textContent=`手机 ${Math.ceil(battle.player.hp)} / ${battle.player.maxHp}`;root.dataset.battleState=battle.state;
  if(['running','paused'].includes(battle.state)){root.querySelector('.battle-result').textContent=battle.state==='paused'?'抵抗已暂停 · 点继续恢复':`抵抗中 · ${battle.targets.filter(x=>x.hp>0).length} 个目标 · ${(battle.elapsedMs/1000).toFixed(1)} 秒`;raf=win.requestAnimationFrame(tick);}else resolve();};raf=win.requestAnimationFrame(tick);});
 win.cancelAnimationFrame(raf);const result=battle.result();root.querySelector('[data-battle-warning]').hidden=true;pauseButton.disabled=true;root.querySelector('.battle-result').textContent=result.success?'抵抗突破 · 等待剧情判定':result.reason==='police-deadline'?'九鬼真白反击命中 · 手机生命归零，本次催眠失败':result.reason==='cancelled'?'已取消抵抗模拟':result.targets.some(x=>x.defeated)?'部分目标抵抗突破 · 等待剧情判定':result.reason==='timeout'?'连接超时 · 目标抵抗成功':'手机生命归零 · 目标抵抗成功';
 if(!ended)await new Promise(resolve=>{finishEnding=resolve;endingTimer=win.setTimeout(resolve,1300);});await animateSurface(root,false);return result;
 }finally{cleanup();root.remove();}
}
