import { phoneIcon } from '../phone-v2/icons.mjs';
import { mountDaggerTransfer } from '../pet-v6/hyakka-transfer.mjs';
export function mountSceneTools(sceneRoot,actions={}){
 const doc=sceneRoot.ownerDocument,nav=doc.createElement('nav');nav.className='scene-tools';nav.setAttribute('aria-label','场景独立工具');
 const style=doc.createElement('style');style.textContent='.scene-tools{display:flex;gap:9px;align-items:center;overflow-x:auto;scrollbar-width:none;pointer-events:auto}.scene-tools button{flex:none;height:40px;display:flex;align-items:center;gap:7px;border:1px solid #ad92743b;border-radius:12px;background:#ffffff05;color:#dfd0bf;padding:0 14px;font:500 12px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer;white-space:nowrap}.scene-tools button:hover{background:#b599bb13}.scene-tools .ip-icon{width:18px;height:18px;display:block;flex:none}.scene-tools button:focus-visible{outline:2px solid #ddb787;outline-offset:-2px}@media(max-width:700px){.scene-tools{gap:7px}.scene-tools button{padding:0 10px;height:38px;font-size:11px}.scene-tools .ip-icon{width:16px;height:16px}}';
 for(const [id,label,icon]of [['slots','人物卡槽','people'],['detective','林安委托','search']])if(actions[id]){const button=doc.createElement('button');button.type='button';button.setAttribute('aria-label','打开'+label);button.innerHTML=phoneIcon(icon)+'<span>'+label+'</span>';button.addEventListener('click',actions[id]);nav.append(button);}
 const pet=actions.petController??mountDaggerTransfer(doc.body,{actions,assetBase:actions.assetBase??doc.defaultView.__ST_GAME_ASSET_BASE__??'/public/frontends/hypnosis-app/assets/'});
 nav.prepend(style);sceneRoot.querySelector('.scene-tools-slot').append(nav);return{root:nav,pet,destroy(){nav.remove();if(!actions.petController)pet.destroy();}};
}
