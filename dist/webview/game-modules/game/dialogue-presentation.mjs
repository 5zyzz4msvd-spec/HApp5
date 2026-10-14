export const DEFAULT_DIALOGUE_SETTINGS={charactersPerSecond:34,autoDelay:1300,fontSize:16,opacity:.46,skipMode:'read'};
export function normalizeDialogueSettings(input={}){const value={...DEFAULT_DIALOGUE_SETTINGS,...input},bound=(x,min,max,fallback)=>Number.isFinite(Number(x))?Math.max(min,Math.min(max,Number(x))):fallback;return{charactersPerSecond:bound(value.charactersPerSecond,8,120,34),autoDelay:bound(value.autoDelay,400,6000,1300),fontSize:bound(value.fontSize,12,25,16),opacity:bound(value.opacity,.15,.8,.46),skipMode:value.skipMode==='all'?'all':'read'};}
export function dialogueGraphemes(text){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(String(text))].map(x=>x.segment):[...String(text)];}
export class DialoguePresentation{
 constructor(settings={}){this.settings=normalizeDialogueSettings(settings);this.key='';this.characters=[];this.visible=0;this.lastTime=0;this.accumulator=0;this.finishedAt=null;this.auto=false;this.skip=false;this.read=new Set();}
 setFrame(key,text,now){if(key===this.key)return false;this.key=key;this.characters=dialogueGraphemes(text);this.visible=0;this.lastTime=now;this.accumulator=0;this.finishedAt=this.characters.length?null:now;return true;}
 get complete(){return this.visible>=this.characters.length;}
 get text(){return this.characters.slice(0,this.visible).join('');}
 reveal(now){this.visible=this.characters.length;this.finishedAt??=now;this.read.add(this.key);}
 tick(now,{paused=false}={}){const elapsed=Math.max(0,now-this.lastTime),dt=Math.min(100,elapsed);this.lastTime=now;if(paused){if(this.finishedAt!==null)this.finishedAt+=elapsed;return false;}const maySkip=this.skip&&(this.settings.skipMode==='all'||this.read.has(this.key));if(maySkip){this.reveal(now);return now-this.finishedAt>=120;}
  if(!this.complete){this.accumulator+=dt;const interval=1000/this.settings.charactersPerSecond;while(this.accumulator>=interval&&this.visible<this.characters.length){this.accumulator-=interval;const char=this.characters[this.visible++];if(/[，。！？、；…,.!?]/.test(char))this.accumulator-=interval*2;}if(this.complete){this.finishedAt=now;this.read.add(this.key);}}
  return this.auto&&this.complete&&now-this.finishedAt>=this.settings.autoDelay+Math.min(1200,this.characters.length*12);
 }
}
