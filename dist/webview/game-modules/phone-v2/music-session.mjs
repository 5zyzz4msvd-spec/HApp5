import { MUSIC_TRACKS } from './music-catalog.mjs';
import { createMusicPlayer,musicAsset } from './music-model.mjs';

// The mounted phone owns this audio session. App views only subscribe to it.
export function createMusicSession({tracks=MUSIC_TRACKS,resolveFile=x=>x,cache=new Map(),audioFactory=()=>new Audio(),urlApi=globalThis.URL,win=globalThis,onPlayback=()=>{}}={}){
 const lyricSources=cache.get('music-lyrics')??new Map(),audioSources=cache.get('music-audio')??new Map();cache.set('music-lyrics',lyricSources);cache.set('music-audio',audioSources);
 const list=tracks.map(track=>({...track,...(lyricSources.has(track.id)?{lyricsText:lyricSources.get(track.id)}:{}),...(audioSources.has(track.id)?{audioBlob:audioSources.get(track.id)}:{})}));
 const listeners=new Set();let player=null,disposed=false,value=cache.get('music-state')??{},mediaMetadata=null,mediaTrack='';
 const safeTrack=()=>{const item=list.find(x=>x.id===value.trackId);return item?{title:item.id==='track-03'?'你的名字':item.title,artist:item.id==='track-03'?'电影原声':item.artist,artwork:musicAsset(item.artwork,resolveFile)}:null;};
 function publish(next){
  if(disposed)return;value=next;cache.set('music-state',structuredClone(next));const item=safeTrack();
  if(next.playing&&mediaTrack!==next.trackId&&win?.MediaMetadata&&win.navigator?.mediaSession&&item)try{mediaMetadata=new win.MediaMetadata({title:item.title,artist:item.artist,artwork:item.artwork?[{src:item.artwork}]:[]});win.navigator.mediaSession.metadata=mediaMetadata;mediaTrack=next.trackId;}catch{}
  onPlayback(structuredClone(next),item);for(const listener of listeners)listener(structuredClone(next));
 }
 player=createMusicPlayer({tracks:list,resolveFile,state:value,audioFactory,urlApi,onChange:publish});value=player.snapshot();
 return {tracks:list,audio:player.audio,safeTrack,lyrics:player.lyrics,snapshot:player.snapshot,play:player.play,pause:player.pause,toggle:player.toggle,select:player.select,step:player.step,seek:player.seek,setVolume:player.setVolume,setRepeat:player.setRepeat,
  subscribe(listener){if(disposed)return()=>{};listeners.add(listener);listener(player.snapshot());return()=>listeners.delete(listener);},
  setLyrics(id,text){const item=list.find(x=>x.id===id);if(!item||disposed)return false;lyricSources.set(id,text);item.lyricsText=text;publish(player.snapshot());return true;},
  replaceAudio(id,blob){const item=list.find(x=>x.id===id);if(!item||disposed)return false;audioSources.set(id,blob);item.audioBlob=blob;return player.select(id);},
  destroy(){if(disposed)return;player.pause();cache.set('music-state',player.snapshot());disposed=true;listeners.clear();player.destroy();onPlayback(null,null);if(win?.navigator?.mediaSession?.metadata===mediaMetadata)win.navigator.mediaSession.metadata=null;},
 };
}
