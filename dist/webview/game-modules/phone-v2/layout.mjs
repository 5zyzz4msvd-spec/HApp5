export function phoneFrame(orientation='portrait'){
 if(!['portrait','landscape'].includes(orientation))throw Error('未知手机方向');
 return orientation==='landscape'?{width:868,height:409,screenWidth:852,screenHeight:393}:{width:409,height:868,screenWidth:393,screenHeight:852};
}
export function fitPhone(viewport,orientation){const frame=phoneFrame(orientation);return{...frame,scale:Math.max(0,Math.min(viewport.width/(frame.width+6),viewport.height/(frame.height+6),1))};}
