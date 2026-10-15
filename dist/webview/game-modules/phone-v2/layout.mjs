export function phoneFrame(orientation='portrait'){
 if(!['portrait','landscape'].includes(orientation))throw Error('未知手机方向');
 return orientation==='landscape'?{width:868,height:409,screenWidth:852,screenHeight:393}:{width:409,height:868,screenWidth:393,screenHeight:852};
}
export function fitPhone(viewport,orientation){const frame=phoneFrame(orientation);return{...frame,scale:Math.max(0,Math.min(viewport.width/(frame.width+6),viewport.height/(frame.height+6),1))};}

export function phoneOverlayBounds({width,height,toolbarBottom=0,padding=12}){const top=Math.min(Math.max(0,toolbarBottom)+padding,Math.max(0,height-padding)),bottom=Math.max(top,height-padding);return{width:Math.max(0,width-padding*2),height:bottom-top,centerX:width/2,centerY:(top+bottom)/2};}
