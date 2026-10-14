import { locationForest } from '../object-manager/locations.mjs';
export const NAVIGATION_BRANCH_IDS=Object.freeze(['map-world','map-school','place-teaching-building']);
export const navigationLabel=place=>({'map-world':'城市','map-school':'校园','place-teaching-building':'教学楼'}[place?.id]??place?.name??'地点');
export function navigationImageFile(place,backgrounds=[]){return place?.ui?.sceneBackground||place?.ui?.locationImage?.file||backgrounds.find(item=>item.locationId===place?.id)?.file||'';}

// This is only a navigation projection. Original objects, parent/child refs,
// residences and conditional worldbook graphs remain untouched in the store.
export function locationNavigationProjection(locations){
 const forest=locationForest(locations),source=new Map(locations.map(place=>[place.id,place])),root=source.get('map-world');
 if(!root)throw Error('城市地点尚未准备好');
 const hidden=new Set(),nodes=new Map(),parents=new Map(),children=new Map();
 // Only declared organizational folders are transparent. A physical building
 // remains a destination even without artwork; its interiors stay in storage.
 const directory=place=>place?.data?.routineKey==='residential'||['目录','楼层'].includes(place?.data?.category)||place?.ui?.directoryContainer===true;
 const serviceIds=new Set(['lin-an-office','twins-workshop']);
 const projectedParent=place=>{
  if(place.id==='map-world')return null;
  if(place.id==='map-school')return 'map-world';
  if(place.id==='place-teaching-building')return source.has('map-school')?'map-school':'map-world';
  if(serviceIds.has(place.id))return 'map-world';
  const path=forest.nodes.get(place.id)?.path.map(ref=>ref.id)??[place.id];
  const ancestors=path.slice(0,-1).filter(id=>!directory(source.get(id)));
  const immediate=ancestors.at(-1);
  if(immediate==='place-teaching-building')return 'place-teaching-building';
  if(immediate==='map-school')return 'map-school';
  if(immediate==='map-world'||!immediate)return 'map-world';
  // Independent shops directly on the maintained street may be city leaves.
  // A shop's own rooms are not promoted alongside it.
  if(source.get(immediate)?.data?.routineKey==='shopping-street'&&ancestors.at(-2)==='map-world')return 'map-world';
  return undefined;
 };
 for(const place of locations){
  const canonical=NAVIGATION_BRANCH_IDS.includes(place.id),parent=projectedParent(place);
  if((directory(place)&&!canonical)||parent===undefined){hidden.add(place.id);continue;}
  nodes.set(place.id,place);children.set(place.id,[]);if(parent)parents.set(place.id,parent);
 }
 for(const [id,parent] of parents)children.get(parent).push(id);
 function path(id){const result=[],seen=new Set();let current=id;while(nodes.has(current)&&!seen.has(current)){seen.add(current);result.unshift(nodes.get(current));current=parents.get(current);}return result;}
 return{nodes,parents,hidden,rootId:'map-world',children:id=>(children.get(id)??[]).map(child=>nodes.get(child)),path,
  branch:id=>NAVIGATION_BRANCH_IDS.includes(id)&&nodes.has(id),
  nearestVisible(id){const original=forest.nodes.get(id)?.path??[];return nodes.has(id)?id:[...original].reverse().find(ref=>nodes.has(ref.id))?.id??'map-world';},
 };
}
export class LocationNavigationState{
 constructor({locations,currentId,loadLocations=async()=>locations,canMove=()=>true,onMove=async()=>{}}){Object.assign(this,{locations,currentId,loadLocations,canMove,onMove});this.moving=false;this.disposed=false;const projection=locationNavigationProjection(locations);this.selectedId=projection.nearestVisible(currentId);this.scopeId=projection.branch(this.selectedId)?this.selectedId:projection.parents.get(this.selectedId)??'map-world';}
 view(){const projection=locationNavigationProjection(this.locations),selected=projection.nodes.get(this.selectedId)??projection.nodes.get(projection.rootId);return{projection,selected,choices:projection.children(this.scopeId),path:projection.path(selected.id),currentId:this.currentId,moving:this.moving};}
 select(id){if(this.disposed||this.moving)return false;const projection=locationNavigationProjection(this.locations);if(!projection.nodes.has(id))throw Error('这个地点不在当前开放目录中');this.selectedId=id;this.scopeId=projection.branch(id)?id:projection.parents.get(id)??projection.rootId;return true;}
 reload(locations,currentId=this.currentId){if(this.disposed)return;this.locations=locations;this.currentId=currentId;const projection=locationNavigationProjection(locations);this.selectedId=projection.nearestVisible(this.selectedId);this.scopeId=projection.branch(this.selectedId)?this.selectedId:projection.parents.get(this.selectedId)??projection.rootId;}
 async arrive(){
  if(this.disposed||this.moving)return false;if(!this.canMove())throw Error('请先回到当前楼层并读完对白，等待生成结束');
  if(this.selectedId==='map-world')throw Error('城市用于浏览目的地，请选择具体地点');
  const id=this.selectedId;this.moving=true;
  try{const fresh=await this.loadLocations(),projection=locationNavigationProjection(fresh),target=projection.nodes.get(id);if(!target)throw Error('这个地点尚未开放');if(this.disposed||!this.canMove())throw Error('当前不能移动');if(id===this.currentId)return false;
   const result=await this.onMove(target);if(result?.ok===false)throw Error(result.message??'前往未完成');this.currentId=id;this.locations=fresh;return target;
  }finally{this.moving=false;}
 }
 destroy(){this.disposed=true;}
}
