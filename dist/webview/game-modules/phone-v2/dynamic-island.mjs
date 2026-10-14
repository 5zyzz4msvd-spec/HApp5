const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const note='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 2 8 5v12.2c-.7-.3-1.7-.3-2.6 0C3.2 18 2 19.9 2.7 21.4c.6 1.4 2.8 1.8 5 .9 1.9-.8 3-2.3 2.8-3.6V9l6.5-1.8v7c-.7-.3-1.7-.3-2.6 0-2.2.8-3.4 2.7-2.7 4.2.6 1.4 2.8 1.8 5 .9 1.9-.8 3-2.3 2.8-3.6V3c0-.8-.3-1.2-.5-1z"/></svg>';
const pause='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.2"/><rect x="14" y="4" width="5" height="16" rx="1.2"/></svg>';
const next='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 5.2c-.7-.5-1.7 0-1.7.9v11.8c0 .9 1 1.4 1.7.9l8.5-5.9c.6-.4.6-1.3 0-1.7zM14.1 5.2c-.7-.5-1.6 0-1.6.9v11.8c0 .9.9 1.4 1.6.9l8.2-5.9c.6-.4.6-1.3 0-1.7z"/></svg>';
const expand='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// No media/source metadata or filenames cross the island's display boundary.
export function createIslandPlaybackState(onChange=()=>{}){
 let value=null,disposed=false;
 function update(snapshot,track){
  if(disposed)return;
  if(!snapshot?.playing||!track){value=null;onChange(value);return;}
  value={playing:true,title:snapshot.trackId==='track-03'?'你的名字':String(track.title??'音乐'),artist:snapshot.trackId==='track-03'?'电影原声':String(track.artist??''),artwork:String(track.artwork??''),time:Math.max(0,Number(snapshot.time)||0)};
  onChange({...value});
 }
 return {update,clear(){if(!disposed){value=null;onChange(null);}},snapshot:()=>value?{...value}:null,destroy(){if(disposed)return;value=null;onChange(null);disposed=true;}};
}
let islandPanelSequence=0;

// The camera cutout is hardware. All music presentation lives in a sibling layer.
export function mountMusicIsland(island,{onOpen=()=>{},onPause=()=>{},onNext=()=>{}}={}){
 const doc=island.ownerDocument,screen=island.closest('.ip-screen')??island.parentElement;
 if(!screen)throw Error('音乐覆盖层缺少手机屏幕');
 const body=doc.createElement('div');body.className='ip-island-music';body.hidden=true;
 body.setAttribute('aria-label','音乐状态与播放控制');screen.append(body);
 const panelId='ip-island-playback-'+(++islandPanelSequence);
 let expanded=false,signature='',destroyed=false,lastValue=null;
 function render(value){
  if(destroyed)return;
  lastValue=value;
  if(!value){expanded=false;signature='';body.hidden=true;body.replaceChildren();delete body.dataset.music;delete body.dataset.expanded;return;}
  body.hidden=false;body.dataset.music='playing';body.dataset.expanded=String(expanded);
  const nextSignature=JSON.stringify([value.title,value.artist,value.artwork,expanded]);if(signature===nextSignature)return;signature=nextSignature;
  const cover=value.artwork?`<img src="${esc(value.artwork)}" alt="${esc(value.title)}封面" draggable="false">`:note;
  const wave='<span class="ip-island-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
  body.innerHTML=`<div class="ip-island-compact"><button class="ip-island-open" data-island-open aria-label="正在播放${esc(value.title)}，打开音乐播放页"><span class="ip-island-cover">${cover}</span></button><span class="ip-island-camera-gap" aria-hidden="true"></span><button class="ip-island-expand" data-island-expand aria-controls="${panelId}" aria-expanded="${expanded}" aria-label="${expanded?'收起':'展开'}音乐播放控制">${wave}</button></div><div id="${panelId}" class="ip-island-panel" ${expanded?'':'hidden'}><div class="ip-island-expanded"><button class="ip-island-track" data-island-open aria-label="打开${esc(value.title)}播放界面"><span class="ip-island-cover">${cover}</span><span class="ip-island-titles"><strong>${esc(value.title)}</strong><small>${esc(value.artist)}</small></span></button><div class="ip-island-controls">${wave}<button data-island-pause aria-label="暂停音乐">${pause}</button><button data-island-next aria-label="下一首">${next}</button><button data-island-expand aria-label="收起音乐播放控制">${expand}</button></div></div></div>`;
 }
 const state=createIslandPlaybackState(render);
 function click(event){
  const button=event.target.closest('[data-island-open],[data-island-pause],[data-island-next],[data-island-expand]');if(!button||!body.contains(button))return;event.stopPropagation();
  if(button.hasAttribute('data-island-open')){if(expanded){expanded=false;render(lastValue);}onOpen();}
  else if(button.hasAttribute('data-island-pause'))onPause();
  else if(button.hasAttribute('data-island-next'))onNext();
  else{expanded=!expanded;render(lastValue);}
 }
 body.addEventListener('click',click);
 return {update:state.update,clear:state.clear,snapshot:state.snapshot,destroy(){if(destroyed)return;state.destroy();destroyed=true;body.removeEventListener('click',click);body.remove();}};
}

export const DYNAMIC_ISLAND_STYLE=`
.phone16-root .ip-island-music[hidden],.phone16-root .ip-island-panel[hidden]{display:none!important}
.phone16-root .ip-island-music{position:absolute;inset:0;z-index:52;pointer-events:none;color:#fff}
.phone16-root .ip-island-compact{position:absolute;left:50%;top:10px;transform:translateX(-50%);width:190px;height:39px;display:flex;align-items:center;justify-content:space-between;padding:0 2px;background:#07070b;border-radius:24px;pointer-events:auto}
.phone16-root .ip-island-camera-gap{width:126px;height:35px;flex:none;pointer-events:none}
.phone16-root .ip-island-music button{border:0;background:none;color:inherit;padding:0;cursor:pointer;font:inherit;min-height:35px}
.phone16-root .ip-island-music svg{width:20px;height:20px;fill:currentColor;display:block}
.phone16-root .ip-island-open,.phone16-root .ip-island-expand{width:30px;flex:none;display:grid;place-items:center}
.phone16-root .ip-island-cover{width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:#202023;overflow:hidden;flex:none}
.phone16-root .ip-island-cover img{width:100%;height:100%;object-fit:cover;display:block}
.phone16-root .ip-island-wave{height:21px;display:flex;align-items:center;gap:2px;width:24px;flex:none}
.phone16-root .ip-island-wave i{width:3px;height:15px;border-radius:2px;background:#fa4660;transform-origin:center;animation:ip-island-music-wave .75s ease-in-out infinite alternate}
.phone16-root .ip-island-wave i:nth-child(2){height:9px;animation-delay:-.3s}.phone16-root .ip-island-wave i:nth-child(3){height:19px;animation-delay:-.5s}.phone16-root .ip-island-wave i:nth-child(4){height:11px;animation-delay:-.15s}.phone16-root .ip-island-wave i:nth-child(5){height:16px;animation-delay:-.4s}
@keyframes ip-island-music-wave{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.phone16-root .ip-island-panel{position:absolute;left:50%;top:56px;transform:translateX(-50%);width:300px;max-width:calc(100% - 48px);height:112px;border-radius:31px;background:#07070b;box-shadow:0 6px 22px #0003;pointer-events:auto;overflow:hidden}
.phone16-root .ip-island-expanded{width:100%;padding:12px 17px 9px}
.phone16-root .ip-island-track{width:100%;display:flex;align-items:center;gap:12px;text-align:left}
.phone16-root .ip-island-track .ip-island-cover{width:44px;height:44px;border-radius:8px}
.phone16-root .ip-island-titles{display:block;min-width:0;flex:1}.phone16-root .ip-island-titles strong{display:block;font-size:16px;font-weight:600;letter-spacing:-.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.phone16-root .ip-island-titles small{display:block;font-size:12px;color:#a2a2a8;letter-spacing:0;margin-top:3px}
.phone16-root .ip-island-controls{display:flex;align-items:center;justify-content:space-between;padding:7px 1px 0}.phone16-root .ip-island-controls button{width:44px;min-height:35px;display:grid;place-items:center}.phone16-root .ip-island-controls .ip-island-wave{margin-right:auto}.phone16-root .ip-island-controls svg{width:20px;height:20px}
.phone16-root[data-orientation=landscape] .ip-island-compact{left:8px;top:50%;transform:translateY(-50%);width:39px;height:190px;flex-direction:column;padding:2px 0}
.phone16-root[data-orientation=landscape] .ip-island-camera-gap{width:35px;height:126px}
.phone16-root[data-orientation=landscape] .ip-island-open,.phone16-root[data-orientation=landscape] .ip-island-expand{width:35px;height:30px;min-height:30px}
.phone16-root[data-orientation=landscape] .ip-island-panel{left:57px;top:40px;transform:none;width:300px;max-width:calc(100% - 90px)}
@media(prefers-reduced-motion:reduce){.phone16-root .ip-island-wave i{animation:none}}
`;
