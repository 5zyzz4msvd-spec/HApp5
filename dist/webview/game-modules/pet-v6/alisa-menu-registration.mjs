// Ground anchors measured from the existing approved whole-character drawings.
// These register the rendered tile; they do not alter or synthesize any pose.
export const ALISA_MENU_GROUND_ANCHORS=Object.freeze([
 {x:127.5,y:267},{x:136,y:268},{x:137,y:267},
 {x:120.5,y:267},{x:138,y:267},{x:120,y:267}
]);
export function alisaMenuRegistration(clip,index,size=112){
 const anchors=clip?.groundAnchors??(clip?.file==='pet/v6/alisa-v10-menu-open.png'?ALISA_MENU_GROUND_ANCHORS:null);
 const anchor=anchors?.[index],base=anchors?.[0];if(!anchor)return{x:0,y:0};
 return{x:(base.x-anchor.x)*size/256,y:(base.y-anchor.y)*size/256};
}
