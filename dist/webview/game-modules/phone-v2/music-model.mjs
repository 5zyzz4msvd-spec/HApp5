const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const seconds=value=>Math.max(0,Number(value)||0);

// User-supplied LRC only. Metadata is not promoted to display titles/artists.
export function parseLrc(text){
 const source=String(text??''),offset=Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1]??0)/1000,lines=[];
 for(const raw of source.split(/\r?\n/)){
  const stamps=[...raw.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
  if(!stamps.length)continue;
  const content=raw.replace(/\[[^\]]*\]/g,'').trim();
  for(const stamp of stamps)lines.push({time:Math.max(0,Number(stamp[1])*60+Number(stamp[2])+Number('0.'+(stamp[3]??'0'))+offset),text:content});
 }
 return lines.sort((a,b)=>a.time-b.time);
}
export function lyricIndex(lines,time){let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time<=time)index=i;else break;}return index;}
export function formatMusicTime(time){const n=Math.floor(seconds(time));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function musicAsset(value,resolveFile=x=>x){const text=String(value??'');if(!text)return '';if(/^(?:https?:|blob:|data:audio\/|data:image\/)/i.test(text))return text;if(/^[a-z][a-z0-9+.-]*:/i.test(text)||text.startsWith('//'))return '';return resolveFile(text);}

export function createMusicPlayer({tracks=[],audioFactory=()=>new Audio(),resolveFile=x=>x,state={},onChange=()=>{},urlApi=globalThis.URL}={}){
 const audio=audioFactory(),listeners=[],ownedUrls=new Set();let destroyed=false,token=0,desired=false,pendingSeek=null,metadataReady=false;
 const current={trackId:tracks.some(x=>x.id===state.trackId)?state.trackId:tracks[0]?.id??'',time:seconds(state.time),duration:0,volume:state.volume == null ? 0.7 : clamp(state.volume,0,1),repeat:['off','list','one'].includes(state.repeat)?state.repeat:'list',playing:false,error:'',playedIds:Array.isArray(state.playedIds)?state.playedIds.filter(id=>tracks.some(x=>x.id===id)):[]};
 audio.preload='metadata';audio.loop=false;audio.volume=current.volume;
 const track=()=>tracks.find(x=>x.id===current.trackId)??null;
 const snapshot=()=>structuredClone(current);
 const emit=()=>{if(!destroyed)onChange(snapshot());};
 function listen(name,fn){audio.addEventListener(name,fn);listeners.push([name,fn]);}
 function confirmSeek(){
  if(pendingSeek===null||!metadataReady||audio.seeking===true||Math.abs(seconds(audio.currentTime)-pendingSeek)>.1)return false;
  current.time=seconds(audio.currentTime);pendingSeek=null;return true;
 }
 function applySeek(){
  if(pendingSeek===null||!metadataReady)return;
  pendingSeek=clamp(pendingSeek,0,current.duration||Number.MAX_SAFE_INTEGER);current.time=pendingSeek;
  try{audio.currentTime=pendingSeek;}catch{}
  // A setter can succeed before the decoder actually seeks. The target remains
  // authoritative until seeked/timeupdate confirms it, rather than caching zero.
  confirmSeek();
 }
 function readTime(){
  if(!metadataReady)return;
  if(pendingSeek!==null){confirmSeek();return;}
  current.time=seconds(audio.currentTime);
 }
 function seek(value){current.time=clamp(value,0,current.duration||Number.MAX_SAFE_INTEGER);pendingSeek=current.time;applySeek();emit();}
 function pause(){desired=false;token++;readTime();audio.pause();current.playing=false;emit();}
 async function play(){
  if(destroyed)return false;
  if(!audio.src){current.error='这首歌的音源尚未加入。';emit();return false;}
  desired=true;const version=++token;current.error='';emit();
  try{await audio.play();if(destroyed||version!==token||!desired){if(!desired||destroyed)audio.pause();return false;}current.playing=true;if(!current.playedIds.includes(current.trackId))current.playedIds.push(current.trackId);emit();return true;}
  catch{if(!destroyed&&version===token){desired=false;current.playing=false;current.error='无法播放这首歌，请检查音源或网络后重试。';emit();}return false;}
 }
 function load(id,time=0){
  token++;desired=false;metadataReady=false;current.trackId=id;current.time=seconds(time);current.duration=0;current.playing=false;current.error='';pendingSeek=current.time>0?current.time:null;audio.pause();
  for(const url of ownedUrls){urlApi?.revokeObjectURL?.(url);}ownedUrls.clear();
  const item=track();let src=musicAsset(item?.src,resolveFile);
  if(item?.audioBlob&&urlApi?.createObjectURL){src=urlApi.createObjectURL(item.audioBlob);ownedUrls.add(src);}
  audio.removeAttribute('src');if(src)audio.src=src;audio.load?.();emit();
 }
 function select(id,{autoplay=false}={}){if(destroyed||!tracks.some(x=>x.id===id))return false;load(id);if(autoplay)void play();return true;}
 function step(delta,{autoplay=current.playing}={}){
  if(!tracks.length||destroyed)return false;
  if(delta<0&&current.time>3){seek(0);return true;}
  const index=tracks.findIndex(x=>x.id===current.trackId),next=(index+delta+tracks.length)%tracks.length;
  return select(tracks[next].id,{autoplay});
 }
 function toggle(){return current.playing||desired?(pause(),Promise.resolve(false)):play();}
 function setVolume(value){current.volume=clamp(value,0,1);audio.volume=current.volume;emit();}
 function setRepeat(value){if(['off','list','one'].includes(value)){current.repeat=value;emit();}}
 listen('loadedmetadata',()=>{metadataReady=true;current.duration=Number.isFinite(audio.duration)?seconds(audio.duration):0;applySeek();emit();});
 for(const event of ['loadeddata','canplay'])listen(event,()=>{applySeek();emit();});
 listen('seeked',()=>{confirmSeek();emit();});
 listen('durationchange',()=>{current.duration=Number.isFinite(audio.duration)?seconds(audio.duration):0;emit();});
 listen('timeupdate',()=>{readTime();emit();});
 listen('playing',()=>{if(!desired){audio.pause();return;}current.playing=true;if(!current.playedIds.includes(current.trackId))current.playedIds.push(current.trackId);emit();});
 listen('pause',()=>{desired=false;current.playing=false;readTime();emit();});
 listen('error',()=>{desired=false;token++;current.playing=false;current.error='音源加载失败，请检查文件或网络后重试。';emit();});
 listen('ended',()=>{
  const index=tracks.findIndex(x=>x.id===current.trackId);current.playing=false;
  if(current.repeat==='one'){seek(0);void play();}
  else if(index<tracks.length-1||current.repeat==='list')step(1,{autoplay:true});
  else{desired=false;emit();}
 });
 load(current.trackId,current.time);
 return {audio,track,snapshot,play,pause,toggle,select,step,seek,setVolume,setRepeat,
  lyrics:()=>{const item=track();return item?.lyricsText?parseLrc(item.lyricsText):Array.isArray(item?.lyrics)?item.lyrics.filter(x=>Number.isFinite(x.time)&&typeof x.text==='string').slice().sort((a,b)=>a.time-b.time):[];},
  destroy(){if(destroyed)return;destroyed=true;desired=false;token++;audio.pause();for(const [name,fn]of listeners)audio.removeEventListener(name,fn);audio.removeAttribute('src');audio.load?.();for(const url of ownedUrls)urlApi?.revokeObjectURL?.(url);ownedUrls.clear();},
 };
}
