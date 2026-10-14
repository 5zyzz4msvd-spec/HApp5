import { MUSIC_TRACKS } from './music-catalog.mjs';
import { MUSIC_STYLE } from './music-style.mjs';
import { formatMusicTime,lyricIndex,musicAsset,parseLrc } from './music-model.mjs';
import { createMusicSession } from './music-session.mjs';
import { patchHtml } from './dom-patch.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repeats={off:'顺序播放',list:'列表循环',one:'单曲循环'};
function icon(name){
 const shapes={
  play:'<path d="M6.4 3.8c-.9-.5-1.9.1-1.9 1.1v14.2c0 1 1 1.6 1.9 1.1l12.3-7.1c.9-.5.9-1.7 0-2.2z"/>',
  pause:'<rect x="5" y="4" width="5" height="16" rx="1.2"/><rect x="14" y="4" width="5" height="16" rx="1.2"/>',
  next:'<path d="M4.2 5.2c-.7-.5-1.7 0-1.7.9v11.8c0 .9 1 1.4 1.7.9l8.5-5.9c.6-.4.6-1.3 0-1.7zM14.1 5.2c-.7-.5-1.6 0-1.6.9v11.8c0 .9.9 1.4 1.6.9l8.2-5.9c.6-.4.6-1.3 0-1.7z"/>',
  previous:'<path d="M19.8 5.2c.7-.5 1.7 0 1.7.9v11.8c0 .9-1 1.4-1.7.9l-8.5-5.9c-.6-.4-.6-1.3 0-1.7zM9.9 5.2c.7-.5 1.6 0 1.6.9v11.8c0 .9-.9 1.4-1.6.9l-8.2-5.9c-.6-.4-.6-1.3 0-1.7z"/>',
  quiet:'<path d="M3 9h4l5-4v14l-5-4H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/>',
  volume:'<path d="M2 9h4l5-4v14l-5-4H2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><path d="M14 8c3 2 3 6 0 8m3-11c6 4 6 10 0 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  lyrics:'<path fill-rule="evenodd" d="M5 3a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h3v3l4-3h7a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H5zm1 5h12v2H6V8zm0 4h12v2H6v-2zm0 4h8v2H6v-2z"/>',
  queue:'<rect x="3" y="5" width="18" height="2.5" rx="1.2"/><rect x="3" y="11" width="18" height="2.5" rx="1.2"/><rect x="3" y="17" width="12" height="2.5" rx="1.2"/>',
  repeat:'<path d="m17 1 5 5-5 5V7H7a3 3 0 0 0-3 3H2a5 5 0 0 1 5-5h10V1zM7 23l-5-5 5-5v4h10a3 3 0 0 0 3-3h2a5 5 0 0 1-5 5H7v4z"/>',
  more:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
  down:'<path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron:'<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  library:'<rect x="3" y="7" width="18" height="15" rx="2"/><rect x="5" y="3" width="14" height="2" rx="1"/><rect x="7" width="10" height="1.5" rx=".7"/>',
  now:'<rect x="2" y="9" width="3" height="6" rx="1.5"/><rect x="6.3" y="4" width="3" height="16" rx="1.5"/><rect x="10.6" y="1" width="3" height="22" rx="1.5"/><rect x="14.9" y="5" width="3" height="14" rx="1.5"/><rect x="19.2" y="8" width="3" height="8" rx="1.5"/>',
  note:'<path d="M19 2 8 5v12.2c-.7-.3-1.7-.3-2.6 0C3.2 18 2 19.9 2.7 21.4c.6 1.4 2.8 1.8 5 .9 1.9-.8 3-2.3 2.8-3.6V9l6.5-1.8v7c-.7-.3-1.7-.3-2.6 0-2.2.8-3.4 2.7-2.7 4.2.6 1.4 2.8 1.8 5 .9 1.9-.8 3-2.3 2.8-3.6V3c0-.8-.3-1.2-.5-1z"/>',
  import:'<path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 };
 return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shapes[name]??shapes.note}</svg>`;
}

export function mountMusic(container,{resolveFile=x=>x,cache=new Map(),notify=()=>{},tracks=MUSIC_TRACKS,onPlayback=()=>{},session=null}={}){
 const doc=container.ownerDocument,win=doc.defaultView,ownsSession=!session;
 const player=session??createMusicSession({tracks,resolveFile,cache,audioFactory:()=>doc.createElement('audio'),urlApi:win?.URL??globalThis.URL,win,onPlayback});
 let destroyed=false,tab=cache.get('music-tab')??'library',showLyrics=Boolean(cache.get('music-show-lyrics')),menuOpen=false,state=player.snapshot(),lastStructure='',lastLyric=-1;
 const list=player.tracks;
 const track=()=>list.find(x=>x.id===state.trackId)??list[0];
 const picture=(item,css)=>{
  const src=musicAsset(item?.artwork,resolveFile);
  if(css==='ip-music-art')return `<div id="music-disc-${esc(item.id)}" class="ip-music-art ip-music-disc" role="img" aria-label="${esc(item.title)}光盘" data-playing="${Boolean(state.playing)}"><div class="ip-music-disc-rotor">${src?`<img src="${esc(src)}" alt="" draggable="false">`:`<span class="ip-music-disc-label">${icon('note')}</span>`}<span class="ip-music-disc-rings" aria-hidden="true"></span></div><span class="ip-music-disc-hub" aria-hidden="true"></span></div>`;
  return src?`<img class="${css}" src="${esc(src)}" alt="${esc(item.title)}封面" draggable="false">`:`<span class="ip-music-art-fallback ${css}" aria-label="专辑封面">${icon('note')}</span>`;
 };
 function update(next){if(destroyed)return;state=next;render();}
 const moreMenu=()=>menuOpen?`<div class="ip-music-menu" role="menu" aria-label="更多音乐操作"><button data-music-import role="menuitem">导入歌词${icon('lyrics')}</button><button data-music-replace role="menuitem">替换音源${icon('import')}</button><input type="file" data-music-lrc accept=".lrc,.txt,text/plain" hidden><input type="file" data-music-audio accept="audio/*" hidden></div>`:'';
 const songs=()=>`<div class="ip-music-song-list">${list.map(x=>`<button class="ip-music-song" data-music-track="${esc(x.id)}" aria-label="打开${esc(x.title)}">${picture(x,'ip-music-song-art')}<span class="ip-music-song-info"><strong>${esc(x.title)}</strong><small>${esc(x.artist)}</small>${icon('chevron')}</span></button>`).join('')}</div>`;
 const playButton=(css='')=>`<button class="ip-music-circle ${css}" data-music-play aria-label="${state.playing?'暂停':'播放'}">${icon(state.playing?'pause':'play')}</button>`;
 function render(){
  if(destroyed)return;const item=track();if(!item)return;
  const structural=JSON.stringify([tab,item.id,state.playing,state.error,state.repeat,showLyrics,state.playedIds,menuOpen]);
  if(structural!==lastStructure){lastStructure=structural;lastLyric=-1;
   const lyricsAllowed=state.playedIds?.includes(item.id),lines=player.lyrics();
   const head=tab==='library'?`<header class="ip-music-header"><h1>资料库</h1><button class="ip-music-circle" data-music-more aria-label="更多音乐操作" aria-expanded="${menuOpen}">${icon('more')}</button>${moreMenu()}</header>`:`<header class="ip-music-sheet-header"><span class="ip-music-handle" aria-hidden="true"></span><button class="ip-music-circle" data-music-tab="library" aria-label="收起播放界面">${icon('down')}</button><button class="ip-music-circle" data-music-more aria-label="更多音乐操作" aria-expanded="${menuOpen}">${icon('more')}</button>${moreMenu()}</header>`;
   const body=tab==='library'?`<div class="ip-music-library"><div><div class="ip-music-play-actions"><button data-music-all>${icon('play')}播放</button><button data-music-tab="now">${icon('now')}播放中</button></div></div><section><h2 class="ip-music-section-title">歌曲</h2>${songs()}</section></div>`:
    `<section class="ip-music-now">${picture(item,'ip-music-art')}<div class="ip-music-player-controls"><div class="ip-music-title-row"><div><h2 class="ip-music-title">${esc(item.title)}</h2><p class="ip-music-artist">${esc(item.artist)}</p></div></div><input type="range" data-music-seek min="0" max="${state.duration||1}" step="0.1" value="${state.time||0}" aria-label="播放进度" ${state.duration?'':'disabled'}><div class="ip-music-times"><span data-music-elapsed></span><span data-music-duration></span></div><div class="ip-music-controls"><button class="ip-music-control" data-music-step="-1" aria-label="上一首">${icon('previous')}</button>${playButton('ip-music-control ip-music-play')}<button class="ip-music-control" data-music-step="1" aria-label="下一首">${icon('next')}</button></div><label class="ip-music-volume">${icon('quiet')}<input type="range" data-music-volume min="0" max="1" step="0.01" value="${state.volume}" aria-label="音量">${icon('volume')}</label><div class="ip-music-options"><button data-music-lyrics aria-label="同步歌词" aria-pressed="${showLyrics}">${icon('lyrics')}</button><button data-music-repeat aria-label="${repeats[state.repeat]}，点击切换" aria-pressed="${state.repeat!=='off'}">${icon('repeat')}${state.repeat==='one'?'<sup>1</sup>':''}</button><button data-music-tab="library" aria-label="查看歌曲列表">${icon('queue')}</button></div>${state.error?`<p class="ip-music-error" role="status">${esc(state.error)}</p>`:''}${showLyrics?`<div class="ip-music-lyrics">${lines.length&&lyricsAllowed?lines.map((line,i)=>`<p data-music-lyric="${i}">${esc(line.text)||'…'}</p>`).join(''):`<p class="ip-music-empty-lyrics">${lines.length?'播放后显示同步歌词。':'暂无同步歌词'}</p>`}</div>`:''}</div></section>`;
   const bottom=tab==='library'?`<div class="ip-music-bottom"><footer class="ip-music-mini">${picture(item,'ip-music-mini-art')}<button class="ip-music-mini-info" data-music-tab="now" aria-label="打开${esc(item.title)}播放界面"><strong>${esc(item.title)}</strong></button>${playButton()}<button class="ip-music-circle" data-music-step="1" aria-label="下一首">${icon('next')}</button></footer><nav class="ip-music-tabbar" aria-label="音乐页面"><button data-music-tab="library" aria-pressed="true">${icon('library')}资料库</button><button data-music-tab="now" aria-pressed="false">${icon('now')}播放中</button></nav></div>`:'';
   patchHtml(container,`<style>${MUSIC_STYLE}</style><section class="ip-music ${tab==='now'?'ip-music-sheet':''}" aria-label="音乐">${head}<div class="ip-music-body" role="main">${body}</div>${bottom}</section>`);
   container.closest('.ip-screen')?.setAttribute('data-theme','music');
  }
  const seek=container.querySelector('[data-music-seek]');if(seek){seek.max=String(state.duration||1);seek.disabled=!state.duration;if(doc.activeElement!==seek)seek.value=String(state.time||0);seek.style.setProperty('--range-fill',(state.duration?Math.min(100,state.time/state.duration*100):0)+'%');seek.setAttribute('aria-valuetext',formatMusicTime(state.time)+' / '+formatMusicTime(state.duration));}
  const volume=container.querySelector('[data-music-volume]');if(volume)volume.style.setProperty('--range-fill',state.volume*100+'%');
  const elapsed=container.querySelector('[data-music-elapsed]'),duration=container.querySelector('[data-music-duration]');if(elapsed)elapsed.textContent=formatMusicTime(state.time);if(duration)duration.textContent=state.duration?formatMusicTime(state.duration):'—';
  if(showLyrics&&state.playedIds?.includes(item.id)){
   const current=lyricIndex(player.lyrics(),state.time);
   if(current!==lastLyric){lastLyric=current;for(const line of container.querySelectorAll('[data-music-lyric]'))line.classList.toggle('is-current',Number(line.dataset.musicLyric)===current);container.querySelector(`[data-music-lyric="${current}"]`)?.scrollIntoView?.({block:'nearest',behavior:'auto'});}
  }
 }
 function click(event){const button=event.target.closest('button');if(!button||!container.contains(button))return;const data=button.dataset;
  if(data.musicTab){tab=data.musicTab;menuOpen=false;cache.set('music-tab',tab);render();}
  else if(data.musicTrack){player.select(data.musicTrack);tab='now';menuOpen=false;showLyrics=false;cache.set('music-show-lyrics',false);cache.set('music-tab',tab);render();}
  else if('musicAll'in data){if(list[0])player.select(list[0].id,{autoplay:true});tab='now';menuOpen=false;cache.set('music-tab',tab);render();}
  else if('musicPlay'in data)void player.toggle();
  else if(data.musicStep)player.step(Number(data.musicStep));
  else if('musicRepeat'in data)player.setRepeat({off:'list',list:'one',one:'off'}[state.repeat]);
  else if('musicLyrics'in data){showLyrics=!showLyrics;cache.set('music-show-lyrics',showLyrics);render();}
  else if('musicMore'in data){menuOpen=!menuOpen;render();}
  else if('musicReplace'in data){const input=container.querySelector('[data-music-audio]');if(input){input.dataset.musicFor=state.trackId;input.click();}}
  else if('musicImport'in data){const input=container.querySelector('[data-music-lrc]');if(input){input.dataset.musicFor=state.trackId;input.click();}}
 }
 function input(event){if(event.target.hasAttribute('data-music-seek'))player.seek(event.target.value);else if(event.target.hasAttribute('data-music-volume'))player.setVolume(event.target.value);}
 async function change(event){
  if(event.target.hasAttribute('data-music-audio')){const file=event.target.files?.[0],id=event.target.dataset.musicFor??state.trackId;if(!file)return;if(file.size>128*1024*1024){notify('音源文件过大，请使用小于128MB的音频。');return;}const item=list.find(x=>x.id===id);if(!item)return;player.replaceAudio(id,file);menuOpen=false;lastStructure='';render();notify('音源已替换。');return;}
  if(!event.target.hasAttribute('data-music-lrc'))return;const file=event.target.files?.[0],id=event.target.dataset.musicFor??state.trackId;if(!file)return;if(file.size>512*1024){notify('歌词文件过大，请使用小于512KB的LRC文件。');return;}try{const text=await file.text();if(destroyed)return;if(!parseLrc(text).length){notify('没有识别到LRC时间标签。');return;}player.setLyrics(id,text);menuOpen=false;lastStructure='';render();notify('同步歌词已加入。');}catch{notify('无法读取这个歌词文件。');}}
 function key(event){if(event.key==='Escape'&&menuOpen){menuOpen=false;render();}}
 container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('change',change);container.addEventListener('keydown',key);
 const unsubscribe=player.subscribe(update);
 return {refresh(){render();},pause:()=>player.pause(),next:()=>player.step(1),openNowPlaying(){tab='now';menuOpen=false;cache.set('music-tab',tab);render();},snapshot:()=>player.snapshot(),destroy(){if(destroyed)return;destroyed=true;unsubscribe();container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',change);container.removeEventListener('keydown',key);if(ownsSession)player.destroy();}};
}
