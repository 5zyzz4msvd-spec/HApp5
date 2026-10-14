import { surfaceLifecycle } from '../ui/surface-motion.mjs';
import { dockSceneToolbar } from '../ui/scene-toolbar.mjs';
import { mountLocationExplorer } from '../game/location-explorer.mjs';
import { bindFloatingDrag } from '../ui/floating-window.mjs';
import { installSerialMotion } from '../ui/serial-motion.mjs';

export async function mountSceneLocationWindow(container,{onClose=()=>{},...options}){
 const doc=container.ownerDocument;installSerialMotion(doc);
 const root=doc.createElement('section');root.className='location-window';root.style.opacity='0';root.setAttribute('role','dialog');root.setAttribute('aria-label','地点');
 const style=doc.createElement('style');style.textContent='.location-window{position:fixed;left:var(--hypno-scene-center-x,50%);top:var(--hypno-scene-center-y,50%);transform:translate(-50%,-50%);width:min(940px,calc(var(--hypno-scene-width,100vw)*.92));height:min(660px,calc(var(--hypno-scene-height,100vh)*.94));pointer-events:auto;display:flex;flex-direction:column;color:#1c1c1e;font:17px -apple-system,BlinkMacSystemFont,system-ui;background:#f2f2f7;border-radius:22px;overflow:hidden;box-shadow:0 20px 80px #0003}.location-window>header{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;user-select:none}.location-window>header strong{font-size:20px;font-weight:600}.location-window>header button{border:0;border-radius:50%;width:30px;height:30px;color:#8e8e93;background:#e5e5ea;font-size:20px;cursor:pointer}.location-window>main{flex:1;min-height:0}.location-window .om-phone{border-radius:0 0 20px 20px}';
 const header=doc.createElement('header');header.innerHTML='<strong>地点</strong><button type="button" aria-label="关闭地点">×</button>';header.querySelector('button').addEventListener('click',onClose);
 const body=doc.createElement('main');root.append(style,header,body);container.append(root);const drag=bindFloatingDrag(header,root),toolbarDock=dockSceneToolbar(doc,header);
 try{const view=await mountLocationExplorer(body,options);const lifecycle=surfaceLifecycle(doc,root,toolbarDock,()=>{drag.destroy();view.destroy();root.remove();});return{root,...lifecycle};}catch(error){toolbarDock.destroy();drag.destroy();root.remove();throw error;}
}
