function loadedImage(image,source){
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);};
  const loaded=()=>{cleanup();if(image.naturalWidth>0)resolve(image);else reject(new Error('Background image has no drawable pixels'));};
  const failed=()=>{cleanup();reject(new Error('Background image could not be loaded'));};
  image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});
  image.src=source;
  if(image.complete){if(image.naturalWidth>0)loaded();else failed();}
 });
}

// Keep the last drawable image mounted until its replacement is fully decoded.
// Each selection owns a revision; slower previous requests never take it back.
export function createBackgroundSwap({createImage,onCommit,onPending=()=>{},onFallback=()=>{}}){
 let revision=0,disposed=false,requestedKey=null,current=null,task=Promise.resolve({status:'empty'});
 return{
  select(source,detail={}){
   if(disposed)return Promise.resolve({status:'disposed'});
   source=String(source??'');const key=detail.key??source;
   if(key===requestedKey)return task;
   requestedKey=key;const version=++revision;
   if(!source){onFallback({image:current,detail,missing:true});task=Promise.resolve({status:'missing',image:current});return task;}
   onPending({image:current,detail});
   const image=createImage();image.decoding='async';
   task=loadedImage(image,source).then(async()=>{if(typeof image.decode==='function')await image.decode();if(disposed||version!==revision)return{status:'stale'};onCommit(image,detail);current=image;return{status:'ready',image};}).catch(error=>{if(disposed||version!==revision)return{status:'stale'};onFallback({image:current,detail,missing:false,error});return{status:'failed',image:current};});
   return task;
  },
  destroy(){disposed=true;revision++;},
 };
}
