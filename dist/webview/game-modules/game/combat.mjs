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
 cheat(){if(this.state==='cancelled')return false;this.cheated=true;this.state='success';this.endReason='cheat';for(const target of this.targets)target.hp=0;this.bullets=[];this.friendlyBullets=[];this.effects=[];return true;}
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
 result(){return{gate:'resistance',success:this.state==='success',duration:Math.round(this.elapsedMs/100)/10,...(this.cheated?{cheated:true}:{}),...(this.endReason?{reason:this.endReason}:{}),targets:this.targets.map(x=>({id:x.id,name:x.name,defeated:x.hp<=0,resisted:x.hp>0})),plotGate:'pending',rule:'每个目标的resisted记录其机制上的抵抗结果。resisted=true不得写成功效果；false仅突破抵抗，剧情仍须独立判断命令是否越界、人设和条件，仍可拒绝或部分失败。'};}
}
export async function runResistanceBattle(container,people,options={}){
 const doc=container.ownerDocument,win=doc.defaultView,root=doc.createElement('section');root.className='hypnosis-battle';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','催眠抵抗模拟器');
 // Battle controls must remain interactive while the enclosing phone action
 // awaits this decision; they cannot join its serial surface-animation queue.
 root.innerHTML='<style>.hypnosis-battle{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;background:#100c19da;backdrop-filter:blur(14px);color:#eee1ff;font:14px system-ui}.battle-card{width:min(760px,94vw);max-height:94vh;overflow:auto;border:1px solid #aa8abb55;border-radius:28px;background:radial-gradient(at 50% 70%,#342340,#171222 72%);padding:22px;box-sizing:border-box;box-shadow:0 30px 90px #0008}.battle-card header{display:flex;justify-content:space-between;align-items:center;gap:16px}.battle-card h2{margin:4px 0;font-weight:500}.battle-card small,.battle-card p{color:#bba9c8}.battle-card canvas{width:100%;max-height:57vh;object-fit:contain;display:block}.battle-result{text-align:center;font-size:18px;min-height:30px;margin-top:12px}.battle-credit{font-size:10px;text-align:center}.battle-controls{display:flex;gap:8px;align-items:center}.battle-controls button,.battle-confirm{border:0;border-radius:12px;background:#ffffff16;color:inherit;padding:10px 15px;min-height:42px;font:inherit;cursor:pointer}.battle-controls button:disabled{opacity:.4;cursor:default}.battle-cheat{margin-left:auto;color:#dac8ee!important}.battle-confirm{display:block;width:100%;min-height:46px;margin-top:16px;background:#e9ddf7;color:#271835;font-weight:600}.battle-confirm:disabled{opacity:.4;cursor:default}.battle-decision-copy{text-align:center;font-size:12px;line-height:1.5;margin:10px 0 0}.battle-warning{color:#ffd19e!important;font-weight:600;border:1px solid #ffbe7955;border-radius:12px;padding:12px;margin:12px 0}.hypnosis-battle [hidden]{display:none!important}.battle-card button:focus-visible{outline:2px solid #e4c7ff;outline-offset:3px}@media(max-height:520px){.battle-card{padding:14px 20px}.battle-card canvas{max-height:42vh}.battle-card h2{font-size:20px}.battle-controls button{min-height:36px;padding:6px 12px}.battle-card [data-battle-mode]{margin:8px 0}.battle-confirm{margin-top:10px}.battle-result{margin-top:6px}.battle-credit{margin:7px 0 0}}</style><div class="battle-card"><header><div><small>RESISTANCE / 01</small><h2>穿过抵抗</h2></div><span data-battle-health></span></header><div class="battle-controls"><button type="button" data-battle-pause>暂停</button><button type="button" data-battle-cancel>取消</button><button type="button" class="battle-cheat" data-battle-cheat aria-label="作弊：小游戏胜利">作弊 · 胜利</button></div><p data-battle-warning class="battle-warning" role="status" aria-live="polite" hidden></p><p data-battle-mode>手机自动移动与攻击</p><canvas width="640" height="480"></canvas><div class="battle-result" role="status" aria-live="polite">正在连接目标意识…</div><button type="button" class="battle-confirm" data-battle-confirm hidden>确认结算</button><p class="battle-decision-copy" data-battle-decision-copy hidden>确认后加入日程；剧情条件仍独立判定。</p><p class="battle-credit"></p></div>';
 root.querySelector('.battle-credit').textContent=CREDIT;container.append(root);const battle=new ResistanceBattle(people,options),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),icons=new Map();root.querySelector('[data-battle-mode]').textContent='手机自动移动与攻击 · '+battle.commandProfile.label+' · '+battle.commandProfile.pattern;for(const person of people)if(person.head){const img=new win.Image();img.src=person.head;icons.set(person.id,img);}
 let raf=0,last=null,decision=null,review=false,resolveBattle,resolveDecision;
 const battleDone=new Promise(resolve=>{resolveBattle=resolve;}),decisionDone=new Promise(resolve=>{resolveDecision=resolve;});
 const pauseButton=root.querySelector('[data-battle-pause]'),cancelButton=root.querySelector('[data-battle-cancel]'),cheatButton=root.querySelector('[data-battle-cheat]'),confirmButton=root.querySelector('[data-battle-confirm]');
 const terminal=()=>!['running','paused'].includes(battle.state);
 const syncPause=()=>{pauseButton.textContent=battle.state==='paused'?'继续':'暂停';pauseButton.disabled=terminal();};
 const pause=()=>{battle.pause();last=null;syncPause();};
 const togglePause=()=>{if(battle.state==='paused')battle.resume();else battle.pause();last=null;syncPause();};
 function decide(value){if(decision)return;if(value==='confirm'&&(!terminal()||battle.state==='cancelled'||!root.isConnected))return;decision=value;if(value==='cancel')battle.cancel();confirmButton.disabled=true;cancelButton.disabled=true;cheatButton.disabled=true;pauseButton.disabled=true;win.cancelAnimationFrame(raf);resolveBattle();resolveDecision();}
 const cancel=()=>decide('cancel');
 const abort=()=>{if(decision==='confirm')decision=null;cancel();};
 const confirm=()=>decide('confirm');
 function showResult(){if(decision)return;const result=battle.result(),first=!review;review=true;root.dataset.battlePhase='review';root.dataset.battleState=battle.state;root.querySelector('[data-battle-warning]').hidden=true;pauseButton.disabled=true;cancelButton.textContent='放弃';confirmButton.hidden=false;root.querySelector('[data-battle-decision-copy]').hidden=false;cheatButton.disabled=Boolean(battle.cheated);cheatButton.textContent=battle.cheated?'已启用作弊':'作弊 · 胜利';root.querySelector('.battle-result').textContent=result.success?(result.cheated?'小游戏胜利 · 已启用作弊':'抵抗突破 · 等待剧情判定'):result.reason==='police-deadline'?'九鬼真白反击命中 · 本次抵抗失败':result.targets.some(x=>x.defeated)?'部分目标抵抗突破 · 等待剧情判定':result.reason==='timeout'?'连接超时 · 目标抵抗成功':'手机生命归零 · 目标抵抗成功';if(first)confirmButton.focus?.({preventScroll:true});}
 const cheat=()=>{if(decision||!battle.cheat())return;last=null;win.cancelAnimationFrame(raf);draw(false);showResult();resolveBattle();};
 const onKey=event=>{if(event.key==='Escape'){event.preventDefault();cancel();}};
 const onVisibility=()=>{if(doc.hidden)pause();};
 pauseButton.addEventListener('click',togglePause);cancelButton.addEventListener('click',cancel);cheatButton.addEventListener('click',cheat);confirmButton.addEventListener('click',confirm);doc.addEventListener('keydown',onKey);doc.addEventListener('visibilitychange',onVisibility);win.addEventListener('blur',pause);win.addEventListener('pagehide',abort);options.signal?.addEventListener('abort',abort,{once:true});
 const cleanup=()=>{win.cancelAnimationFrame(raf);doc.removeEventListener('keydown',onKey);doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('blur',pause);win.removeEventListener('pagehide',abort);options.signal?.removeEventListener('abort',abort);pauseButton.removeEventListener('click',togglePause);cancelButton.removeEventListener('click',cancel);cheatButton.removeEventListener('click',cheat);confirmButton.removeEventListener('click',confirm);};
 function draw(advance=true,now=win.performance.now()){
  if(advance&&battle.state==='running'){if(last!==null)battle.step((now-last)/1000);last=now;}else last=null;
ctx.clearRect(0,0,640,480);ctx.strokeStyle='#9f7bb955';ctx.lineWidth=2;ctx.beginPath();ctx.arc(320,240,210,0,Math.PI*2);ctx.stroke();
  for(const fx of battle.effects){ctx.save();ctx.globalAlpha=Math.min(1,fx.life*4);ctx.fillStyle=fx.kind==='player'?'#c6a8ed22':'#ff907933';ctx.beginPath();if(fx.kind==='player'){if(fx.arc==='all'){ctx.arc(fx.x,fx.y,fx.range,0,Math.PI*2);}else for(const angle of fx.arc==='vertical'?[0,Math.PI,Math.PI/2,-Math.PI/2]:[0,Math.PI]){ctx.moveTo(fx.x,fx.y);ctx.arc(fx.x,fx.y,fx.range,angle-Math.PI/6,angle+Math.PI/6);ctx.closePath();}}else if(fx.kind==='sector'){ctx.moveTo(fx.x,fx.y);ctx.arc(fx.x,fx.y,fx.range,fx.angle-.75,fx.angle+.75);ctx.closePath();}else ctx.arc(fx.x,fx.y,25,0,Math.PI*2);if(fx.kind==='player'){ctx.strokeStyle='#bfa5dd66';ctx.lineWidth=1.4;ctx.stroke();}else ctx.fill();ctx.restore();}
  for(const bullet of battle.friendlyBullets){ctx.fillStyle='#cfc1ff';ctx.beginPath();ctx.arc(bullet.x,bullet.y,4,0,Math.PI*2);ctx.fill();}for(const bullet of battle.bullets){ctx.fillStyle='#ffb993';ctx.beginPath();ctx.arc(bullet.x,bullet.y,4,0,Math.PI*2);ctx.fill();}
  for(const actor of [battle.player,...battle.targets]){if(actor.hp<=0)continue;ctx.save();ctx.shadowColor=actor.id==='phone'?'#d3b3ff':'#a783bc';ctx.shadowBlur=12;ctx.fillStyle=actor.id==='phone'?'#c3a1e0':'#3e2e53';ctx.beginPath();ctx.arc(actor.x,actor.y,actor.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;const img=icons.get(actor.id);if(img?.complete&&img.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(actor.x,actor.y,actor.r-1,0,Math.PI*2);ctx.clip();ctx.drawImage(img,actor.x-actor.r,actor.y-actor.r,actor.r*2,actor.r*2);ctx.restore();}else{ctx.fillStyle=actor.id==='phone'?'#21152e':'#eee';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(actor.id==='phone'?'▯':actor.name.slice(0,1),actor.x,actor.y);}ctx.fillStyle='#ffffff22';ctx.fillRect(actor.x-18,actor.y+21,36,3);ctx.fillStyle='#d3b3eb';ctx.fillRect(actor.x-18,actor.y+21,36*actor.hp/actor.maxHp,3);ctx.restore();}

  const warning=battle.policeWarning(),warningNode=root.querySelector('[data-battle-warning]');warningNode.hidden=!warning;
  if(warning)warningNode.textContent=`九鬼真白正在准备反击 · ${(Math.ceil(warning.remainingMs/100)/10).toFixed(1)} 秒后强制中断催眠${battle.state==='paused'?' · 已暂停':''}`;
  syncPause();root.querySelector('[data-battle-health]').textContent=`手机 ${Math.ceil(battle.player.hp)} / ${battle.player.maxHp}`;root.dataset.battleState=battle.state;
 }
 function tick(now){if(decision)return;if(!root.isConnected){cancel();return;}draw(true,now);if(!terminal()){root.dataset.battlePhase='battle';root.querySelector('.battle-result').textContent=battle.state==='paused'?'抵抗已暂停 · 点继续恢复':`抵抗中 · ${battle.targets.filter(x=>x.hp>0).length} 个目标 · ${(battle.elapsedMs/1000).toFixed(1)} 秒`;raf=win.requestAnimationFrame(tick);}else{showResult();resolveBattle();}}
 try{
  await animateSurface(root,true);if(options.signal?.aborted||!root.isConnected)abort();if(doc.hidden)pause();
  if(!decision){if(terminal()){draw(false);showResult();resolveBattle();}else raf=win.requestAnimationFrame(tick);}
  await battleDone;if(!decision)await decisionDone;await animateSurface(root,false);
  const result=battle.result();return decision==='confirm'?{...result,confirmed:true}:{...result,success:false,reason:'cancelled',confirmed:false,targets:[],plotGate:'pending'};
 }finally{cleanup();root.remove();}
}
