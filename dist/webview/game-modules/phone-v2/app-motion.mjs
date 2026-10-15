import { waitMotion } from '../ui/serial-motion.mjs';

// Rectangles are in viewport coordinates; compensate for the scaled phone shell.
export function appIconTransform(surface,icon,width,height){
 const sx=surface.width/(width||surface.width||1),sy=surface.height/(height||surface.height||1);
 const target=icon?.width>0&&icon?.height>0?icon:{left:surface.left+surface.width*.44,top:surface.top+surface.height*.78,width:surface.width*.12,height:surface.height*.07};
 return `translate(${(target.left+target.width/2-surface.left-surface.width/2)/sx}px, ${(target.top+target.height/2-surface.top-surface.height/2)/sy}px) scale(${Math.max(.02,target.width/(surface.width||1))}, ${Math.max(.02,target.height/(surface.height||1))})`;
}

export async function animateIosApp(content,{kind='open',origin=null,render=()=>{}}={}){
 const doc=content.ownerDocument,win=doc.defaultView;
 if(!content.isConnected||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!content.animate){await render();return;}
 const rect=content.getBoundingClientRect(),width=content.offsetWidth,height=content.offsetHeight;
 const old=content.cloneNode(true);old.setAttribute('aria-hidden','true');old.inert=true;old.removeAttribute('id');old.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
 old.dataset.appTransitionLayer='true';old.style.pointerEvents='none';old.style.zIndex=kind==='close'?'4':'1';old.style.margin='0';old.style.position='absolute';old.style.inset='auto';old.style.left=content.offsetLeft+'px';old.style.top=content.offsetTop+'px';old.style.width=width+'px';old.style.height=height+'px';
 // A clone uses the same positioned surface as the live content, never the device/camera.
 content.parentNode.insertBefore(old,content);
 const previous={transform:content.style.transform,borderRadius:content.style.borderRadius,transformOrigin:content.style.transformOrigin,willChange:content.style.willChange};
 const animations=[];
 try{
  await render();
  const target=typeof origin==='function'?origin():origin,icon=appIconTransform(rect,target,width,height);
  content.style.transformOrigin='50% 50%';content.style.willChange='transform,opacity';content.dataset.appMotion=kind;
  const timing={duration:kind==='open'?460:kind==='close'?380:280,easing:'cubic-bezier(.2,.82,.22,1)',fill:'both'};
  if(kind==='close'){
   old.style.transformOrigin='50% 50%';
   animations.push(old.animate([{transform:'none',opacity:1,borderRadius:'0px'},{transform:icon,opacity:.12,borderRadius:'80px'}],timing));
   animations.push(content.animate([{transform:'scale(.94)',opacity:.55},{transform:'none',opacity:1}],timing));
  }else if(kind==='open'){
   animations.push(old.animate([{transform:'none',opacity:1},{transform:'scale(1.06)',opacity:.35}],timing));
   animations.push(content.animate([{transform:icon,opacity:.25,borderRadius:'80px'},{transform:'none',opacity:1,borderRadius:'0px'}],timing));
  }else{
   animations.push(old.animate([{transform:'none',opacity:1},{transform:'translateX(-12%)',opacity:0}],timing));
   animations.push(content.animate([{transform:'translateX(18%)',opacity:0},{transform:'none',opacity:1}],timing));
  }
  await Promise.all(animations.map(waitMotion));
 }finally{for(const animation of animations)animation.cancel();old.remove();Object.assign(content.style,previous);delete content.dataset.appMotion;}
}
