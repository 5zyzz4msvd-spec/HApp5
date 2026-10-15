import { registerSceneRoot,sceneRootFor,unregisterSceneRoot } from '../ui/scene-dom.mjs';
import { installSerialMotion } from '../ui/serial-motion.mjs';
import { actorsAtScene, chooseSceneActor, landscapeFit } from "./scene-presence.mjs";
import { sceneStandeeLayout } from "./scene-layout.mjs";
import { sceneActorMatchesCast, sceneActorAsset, sceneStandeeEntries } from './scene-character-presentation.mjs';
import {createBackgroundSwap} from '../ui/background-image.mjs';

export function mountScheduleScene(container, { assets, resolveFile, onSelect = () => {} }) {
  const doc = container.ownerDocument;installSerialMotion(doc);
  const style = doc.createElement("style");
  style.textContent = `
  .routine-scene{position:absolute;inset:0;overflow:hidden;display:grid;grid-template-rows:76px minmax(0,1fr) clamp(128px,18vh,180px);background:#151a23;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#fff;isolation:isolate}
  .routine-scene *{box-sizing:border-box}.scene-topbar{display:flex;align-items:center;gap:20px;padding:8px 24px;background:linear-gradient(120deg,#292433,#1b202a);border-bottom:1px solid #ba9e7b29;pointer-events:auto;z-index:2}.routine-context{display:flex;align-items:center;gap:12px;white-space:nowrap;font-size:14px;flex:0 1 240px;min-width:0;color:#e2d6c5}.routine-place{overflow:hidden;text-overflow:ellipsis}.routine-time{color:#baacc5;font-size:12px}
  .routine-viewport{position:relative;min-height:0;overflow:hidden;background:radial-gradient(ellipse at center,#35333a,#151a23 85%)}.routine-world{position:absolute;width:1280px;height:720px;transform-origin:top left;overflow:hidden;background:transparent}.routine-background{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}.routine-shade{position:absolute;inset:0;background:linear-gradient(#10203012,transparent 40%,transparent 80%,#07121e30);pointer-events:none}.routine-actor-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}.routine-standee{position:absolute;object-fit:contain;display:block;transition:opacity 180ms ease}
  .routine-wheel{pointer-events:auto;position:relative;flex:1;max-width:820px;min-width:0;height:56px;margin:auto;display:flex;align-items:center;gap:6px}.routine-roster{height:56px;flex:1;min-width:0;display:flex;gap:12px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;align-items:center;scrollbar-width:none;padding:2px 0;scroll-snap-type:x proximity;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}.routine-roster::-webkit-scrollbar{display:none}.routine-roster:before,.routine-roster:after{content:"";flex:0 0 calc(50% - 26px);height:1px}.routine-wheel-arrow{flex:none;width:44px;height:48px;border:0;background:none;color:#d7c7de;font:400 26px/1 system-ui;cursor:pointer;touch-action:manipulation}.routine-wheel-arrow:disabled{opacity:.25;cursor:default}.routine-wheel[hidden]{display:none}.routine-multiple{order:-1;flex:none;height:40px;padding:0 12px;border:1px solid #baa3c430;border-radius:12px;background:#ffffff05;color:#b9a8c4;font:500 12px system-ui;cursor:pointer}.routine-multiple[aria-pressed=true]{color:#ffe292;border-color:#d9bd7550}
  .routine-avatar{position:relative;flex:0 0 52px;width:52px;height:52px;padding:3px;border:0;background:none;cursor:pointer;touch-action:pan-x;scroll-snap-align:center;opacity:.55;transform:scale(.86);transition:transform 260ms cubic-bezier(.2,.8,.2,1),opacity 260ms}.routine-avatar[aria-pressed=true]{transform:scale(1);opacity:1}.routine-avatar[data-mounted=false]{opacity:.3}.routine-avatar[data-mounted=false][aria-pressed=true]{opacity:.55}.routine-avatar[aria-pressed=true]:after{content:"";position:absolute;left:20px;bottom:0;width:12px;height:3px;border-radius:2px;background:#ffe292}.routine-avatar:focus-visible{outline:2px solid #bda3d9;outline-offset:-3px}.routine-avatar img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 1px 2px #fff3)}.routine-avatar[data-presentation=joint]{width:82px;flex-basis:82px}.routine-avatar[data-presentation=joint][aria-pressed=true]:after{left:35px}.routine-avatar span{font-size:16px;color:#e3d6d9}
  .scene-workspace{margin:0;padding:14px 24px;display:flex;flex-direction:column;gap:12px;min-height:0;background:linear-gradient(145deg,#272131,#171b24);border-top:1px solid #c1a87f35;pointer-events:auto}.scene-workspace-head{display:flex;align-items:center;justify-content:space-between;gap:20px;min-width:0}.scene-tools-slot{min-width:0}.scene-workspace-body{flex:1;min-height:20px;border-top:1px solid #bd9e7d14}.routine-caption{display:flex;align-items:center;gap:10px;white-space:nowrap;font-size:13px;min-width:0;color:#bcaabb;margin:0}.routine-caption strong{font-size:15px;font-weight:500;color:#ede0cb;flex-shrink:0}.routine-caption span{overflow:hidden;text-overflow:ellipsis}.routine-empty{position:absolute;left:15%;top:40%;width:70%;text-align:center;font-size:28px;text-shadow:0 2px 5px #000}.routine-avatar[hidden],.routine-background[hidden],.routine-empty[hidden]{display:none}
  .phone-toolbar-actions{display:flex;align-items:center;gap:8px}
  .routine-scene[data-window-toolbar]{grid-template-rows:minmax(52px,max-content) minmax(0,1fr) clamp(128px,18vh,180px)}
  .scene-topbar [data-scene-toolbar]{position:static!important;left:auto!important;right:auto!important;top:auto!important;width:100%!important;height:auto!important;display:flex!important;align-items:center;gap:8px;flex-wrap:wrap;padding:0!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;color:#e4d5bd;font:13px system-ui}.scene-topbar [data-scene-toolbar] strong{font:500 14px system-ui;width:auto;max-width:180px;letter-spacing:0;white-space:nowrap}.scene-topbar [data-scene-toolbar] input{font:13px system-ui;flex:1;min-width:120px;max-width:220px;width:150px;height:36px;border-radius:9px;padding:8px 10px;background:#f0e5cc;color:#55442f}.scene-topbar [data-scene-toolbar] button{font:12px system-ui!important;background:#ffffff05;border:1px solid #baa07740;border-radius:9px;color:#e4d5bd;cursor:pointer;letter-spacing:0;min-width:32px!important;width:auto!important;height:36px!important;min-height:36px!important;padding:6px 10px!important;white-space:nowrap}.scene-topbar [data-scene-toolbar] [data-action=scout]{flex:none}.scene-topbar [data-scene-toolbar] small{display:none}.scene-topbar [data-scene-toolbar] h1{font:500 14px system-ui;margin:0}.scene-topbar [data-scene-toolbar] button:focus-visible{outline:2px solid #cdb283}.scene-topbar [data-scene-toolbar] [aria-pressed=true]{background:#b8936036;border-radius:8px}
  @media(max-width:700px){.routine-scene[data-window-toolbar]{grid-template-rows:minmax(52px,max-content) minmax(0,1fr) 142px}.routine-scene{grid-template-rows:92px minmax(0,1fr) 142px}.scene-topbar{flex-direction:column;gap:3px;align-items:stretch;padding:7px 12px}.routine-context{flex:none;justify-content:space-between;font-size:12px;height:22px}.routine-wheel{width:100%;height:50px;flex:none;gap:2px}.routine-roster{height:50px;gap:8px}.routine-avatar{width:46px;height:46px;flex-basis:46px}.routine-avatar[aria-pressed=true]:after{left:17px}.routine-avatar[data-presentation=joint]{width:72px;flex-basis:72px}.routine-avatar[data-presentation=joint][aria-pressed=true]:after{left:30px}.routine-wheel-arrow{width:30px;height:46px}.routine-multiple{padding:0 8px}.scene-workspace{padding:12px;gap:10px}.scene-workspace-head{flex-direction:column;align-items:stretch;gap:10px}.routine-caption{font-size:11px}.routine-caption strong{font-size:13px}.scene-workspace-body{min-height:10px}}
  `;
  const root = doc.createElement("section"); root.className = "routine-scene"; root.setAttribute("aria-label", "地点人物场景");
  root.innerHTML = '<header class="scene-topbar"><div class="routine-context"><strong class="routine-place"></strong><span class="routine-time"></span></div><div class="routine-wheel"><button class="routine-multiple" type="button" aria-label="复选人物" aria-pressed="false">多选</button><button class="routine-wheel-arrow prev" type="button" aria-label="上一位人物">‹</button><nav class="routine-roster" aria-label="此时在场人物"></nav><button class="routine-wheel-arrow next" type="button" aria-label="下一位人物">›</button></div></header><main class="routine-viewport"><div class="routine-world"><img class="routine-background" alt="" hidden><div class="routine-shade"></div><div class="routine-actor-layer"></div><p class="routine-empty" hidden></p></div></main><section class="scene-workspace" aria-label="下方预留栏位"><div class="scene-workspace-head"><div class="scene-tools-slot"></div><div class="routine-caption" aria-live="polite"></div></div><div class="scene-workspace-body"></div></section>';
  root.prepend(style);container.append(root);registerSceneRoot(doc,root);installSerialMotion(doc,root.getRootNode());
  const viewportArea=root.querySelector('.routine-viewport'),world = root.querySelector('.routine-world'), roster = root.querySelector('.routine-roster'), layer = root.querySelector('.routine-actor-layer'), caption = root.querySelector('.routine-caption'), empty = root.querySelector('.routine-empty');
  let bg=root.querySelector('.routine-background');
  const wheel = root.querySelector('.routine-wheel'), prev = root.querySelector('.routine-wheel-arrow.prev'), nextButton = root.querySelector('.routine-wheel-arrow.next');
  let stageHeight=Number(assets.stage?.height)||720,actorGroundFloor=stageHeight+24;
  let selectedId = "", locationId = "", state = null, actors = [], rosterKey = "", animation = null, epoch = 0, transitionTarget = "", scrollTimer = 0, wheelTime = 0;
  let multiple = false; const selectedIds = new Set(); const multipleButton = root.querySelector(".routine-multiple");
  const reduced = () => Boolean(doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  function resize() {
    const nextHeight=bg.naturalWidth&&bg.naturalHeight?1280*bg.naturalHeight/bg.naturalWidth:Number(assets.stage?.height)||720;
    const previousGroundFloor=actorGroundFloor;const changed=stageHeight!==nextHeight;stageHeight=nextHeight;
    const fit = landscapeFit({width:viewportArea.clientWidth,height:viewportArea.clientHeight},{width:1280,height:stageHeight});
    world.style.height=stageHeight+'px';world.style.left=fit.left+'px';fit.top=viewportArea.clientHeight-stageHeight*fit.scale;world.style.top=fit.top+'px';world.style.transform='scale('+fit.scale+')';
    actorGroundFloor=stageHeight+24;
    root.dataset.scale=String(fit.scale);root.dataset.backgroundFit='contain';root.dataset.characterFraming='galgame-stable-bottom-occlusion';
    const rect=world.getBoundingClientRect(),css=doc.documentElement.style;
    for(const [name,value]of Object.entries({left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:doc.defaultView.innerWidth-rect.right,bottom:doc.defaultView.innerHeight-rect.bottom,'center-x':rect.left+rect.width/2,'center-y':rect.top+rect.height/2}))css.setProperty('--hypno-scene-'+name,value+'px');
    if((changed||previousGroundFloor!==actorGroundFloor)&&state)paintActor(state.dialogue?actors:multiple?actors.filter(x=>selectedIds.has(x.id)):chooseSceneActor(actors,selectedId));
    root.dispatchEvent(new doc.defaultView.CustomEvent('hypno:scene-fit',{bubbles:true}));
    return fit;
  }
  const viewportObserver=doc.defaultView.ResizeObserver?new doc.defaultView.ResizeObserver(()=>resize()):null;viewportObserver?.observe(viewportArea);
  const backgroundSwap=createBackgroundSwap({
    createImage(){const image=doc.createElement('img');image.className='routine-background';image.alt='';return image;},
    onPending(){root.dataset.backgroundState='loading';},
    onCommit(image,detail){bg.replaceWith(image);bg=image;root.dataset.backgroundAvailable='true';root.dataset.backgroundState='ready';root.dataset.backgroundLocationId=detail.locationId;resize();},
    onFallback({image}){root.dataset.backgroundAvailable=String(Boolean(image));root.dataset.backgroundState=image?'fallback':'empty';if(!image)bg.hidden=true;},
  });
  root.addEventListener('hypno:toolbar-change',resize);
  function select(id, toggle = true) {
    if(state?.dialogue)return;
    const oldIndex = actors.findIndex((x) => x.id === selectedId), index = actors.findIndex((x) => x.id === id);
    if (index < 0 || !multiple && id === selectedId) return;
    if (multiple && toggle) { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); }
    selectedId = id; render(state, { animate: true, direction: index > oldIndex ? 1 : -1 }); onSelect(actors[index]);
  }
  multipleButton.addEventListener("click", () => { multiple = !multiple; selectedIds.clear(); if (multiple && selectedId) selectedIds.add(selectedId); multipleButton.setAttribute("aria-pressed", String(multiple)); multipleButton.textContent = multiple ? "单选" : "多选"; render(state); });
  function step(direction) { const index = actors.findIndex((x) => x.id === selectedId); const target = actors[Math.max(0, Math.min(actors.length - 1, index + direction))]; if (target) select(target.id, false); }
  prev.addEventListener("click", () => step(-1)); nextButton.addEventListener("click", () => step(1));
  roster.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); } });
  wheel.addEventListener("wheel", (event) => { event.preventDefault(); const now = Date.now(); if (now - wheelTime < 180) return; const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY; if (Math.abs(delta) > 4) { wheelTime = now; step(delta > 0 ? 1 : -1); } }, { passive: false });
  roster.addEventListener("scroll", () => {
    clearTimeout(scrollTimer); scrollTimer = setTimeout(() => {
      const center = roster.scrollLeft + roster.clientWidth / 2;
      const buttons = [...roster.children]; const closest = buttons.sort((a, b) => Math.abs(a.offsetLeft + a.offsetWidth / 2 - center) - Math.abs(b.offsetLeft + b.offsetWidth / 2 - center))[0];
      if (closest && closest.dataset.actor !== selectedId) select(closest.dataset.actor, false);
    }, 130);
  });
  function render(next, { animate = false, direction = 1 } = {}) {
    state = next; const changedLocation = next.location?.id !== locationId;
    if (changedLocation) { selectedId = ""; selectedIds.clear(); locationId = next.location?.id ?? ""; }
    actors = next.dialogue ? next.characters.filter(x=>sceneActorMatchesCast(x,next.dialogue.cast)) : actorsAtScene(next); const selected = chooseSceneActor(actors, selectedId);
    for (const id of selectedIds) if (!actors.some((x) => x.id === id)) selectedIds.delete(id);
    if (multiple && changedLocation && selected) selectedIds.add(selected.id);
    selectedId = selected?.id ?? ""; root.dataset.selectedActor = selectedId;
    root.querySelector(".routine-place").textContent = next.location?.name ?? "地点未确认";
    root.querySelector(".routine-time").textContent = next.time || "时间未确认";
    const scene = assets.backgrounds.find((x) => x.locationId === locationId);
    const file = next.location?.ui?.sceneBackground ?? scene?.file;
    void backgroundSwap.select(file?resolveFile(file):'',{key:locationId+':'+(file??''),locationId});
    const key = actors.map((x) => `${x.id}:${x.name}:${x.mounted}:${x.headUrl??''}`).join("|");
    if (key !== rosterKey) { rosterKey = key; roster.replaceChildren(); }
    for (const actor of actors.filter((x) => ![...roster.children].some((button) => button.dataset.actor === x.id))) {
      const asset = sceneActorAsset(actor, assets.characters), button = doc.createElement("button");
      button.type = "button"; button.className = "routine-avatar"; button.dataset.presentation = asset?.presentationMode ?? 'single'; button.title = actor.name; button.setAttribute("aria-label", `切换到${actor.name}`); button.setAttribute("aria-pressed", String(actor.id === selectedId));
      if (actor.headUrl||asset?.head) { const img = doc.createElement("img"); img.src = actor.headUrl||resolveFile(asset.head); img.alt = ""; img.draggable = false; button.append(img); } else { const text = doc.createElement("span"); text.textContent = actor.name.slice(0, 1); button.append(text); }
      button.dataset.actor = actor.id; button.dataset.mounted = String(actor.mounted !== false); button.addEventListener("click", () => select(actor.id)); roster.append(button);
    }
    for (const button of roster.children) { button.setAttribute("aria-pressed", String(multiple ? selectedIds.has(button.dataset.actor) : button.dataset.actor === selectedId)); button.title = `${actors.find((x) => x.id === button.dataset.actor)?.name ?? ""}${multiple ? " · 点击复选" : ""}`; }
    const activeButton = [...roster.children].find((x) => x.dataset.actor === selectedId);
    if (activeButton) roster.scrollTo({ left: activeButton.offsetLeft + activeButton.offsetWidth / 2 - roster.clientWidth / 2, behavior: animate && !reduced() ? "smooth" : "instant" });
    const index = actors.findIndex((x) => x.id === selectedId); prev.disabled = index <= 0; nextButton.disabled = index >= actors.length - 1; wheel.hidden = Boolean(next.dialogue)||!actors.length;multipleButton.disabled=Boolean(next.dialogue);
    if(next.dialogue){epoch++;animation?.cancel();delete root.dataset.sceneMoving;paintActor(actors);for(const image of layer.querySelectorAll('img')){const active=next.dialogue.speaker&&(image.alt===next.dialogue.speaker||image.dataset.actor===next.dialogue.speaker||JSON.parse(image.dataset.speakerNames??'[]').includes(next.dialogue.speaker));image.style.opacity=active?'1':next.dialogue.speaker?'.32':'.58';image.dataset.opacity=image.style.opacity;}}
    else if (multiple) {
      epoch++; animation?.cancel(); transitionTarget = "";delete root.dataset.sceneMoving;
      const chosen = actors.filter((x) => selectedIds.has(x.id));
      const layoutKey=chosen.map(x=>`${x.id}:${x.values?.height??''}`).join('|');
      if (root.dataset.displayedActors !== chosen.map((x) => x.id).join(",") || root.dataset.heightLayout!==layoutKey) {
        root.dataset.heightLayout=layoutKey;
        const previous = new Map([...layer.querySelectorAll("img")].map((x) => [x.alt, parseFloat(x.style.left)]));
        paintActor(chosen);
        if (animate && !reduced()) for (const image of layer.querySelectorAll("img")) {
          const offset = previous.has(image.alt) ? previous.get(image.alt) - parseFloat(image.style.left) : direction * 120;
          image.animate([{ transform: `translateX(${offset}px)`, opacity: previous.has(image.alt) ? Number(image.dataset.opacity ?? 1) : 0 }, { transform: "translateX(0)", opacity: Number(image.dataset.opacity ?? 1) }], { duration: 320, easing: "cubic-bezier(.16,1,.3,1)" });
        }
      }
    }
    else if (changedLocation || !animate && (selectedId !== transitionTarget || !selected)) { epoch++; animation?.cancel(); transitionTarget = "";delete root.dataset.sceneMoving; paintActor(selected); }
    else if (animate) animateActor(selected, direction);
    empty.hidden = multiple ? selectedIds.size > 0 : Boolean(selected); empty.textContent = multiple && actors.length ? "点击头像选择要显示的人物" : next.location ? "此时没有日程中的人物在这里" : "确认到达地点后显示人物";
    resize(); return { actors, selected };
  }
  function paintActor(selected) {
    // Single mode keeps one node; explicit multi-selection owns its chosen set.
    const existing=new Map([...layer.querySelectorAll("img")].map(image=>[image.dataset.presentationId??image.dataset.actor,image]));const images=[];caption.replaceChildren(); root.dataset.paintedActor = selected?.id ?? "";
    const displayed = Array.isArray(selected) ? selected : selected ? [selected] : [];
    root.dataset.displayedActors = displayed.map((x) => x.id).join(",");
    const entries=sceneStandeeEntries(displayed,assets.characters);
    const sceneEntries=sceneStandeeEntries(actors,assets.characters).filter(entry=>entry.geometry);
    const referenceHeightCm=Math.max(168,...sceneEntries.map(x=>x.heightCm)),referenceWidthCm=Math.max(1,...sceneEntries.map(x=>x.heightCm*(x.geometry.bounds[2]-x.geometry.bounds[0])/(x.geometry.bounds[3]-x.geometry.bounds[1])));
    for (const {actor,asset,width,height,left:actorLeft,top,ground} of sceneStandeeLayout(entries,{width:1280,height:stageHeight,occlusionBottom:actorGroundFloor,referenceHeightCm,referenceWidthCm})) {
        const image = existing.get(actor.presentationId)??doc.createElement("img");image.dataset.actor=actor.id;image.dataset.presentationId=actor.presentationId;image.dataset.speakerNames=JSON.stringify([actor.name,...(actor.aliases??[]),...(actor.ui?.sceneMembers??[]).flatMap(member=>[member.name,member.id])]);
        image.dataset.opacity = actor.mounted === false ? "0.5" : "1"; image.style.opacity = image.dataset.opacity; image.className = "routine-standee"; image.alt = actor.name; image.draggable = false; image.src = resolveFile(asset.standee);
        image.dataset.ground=String(ground); image.style.width = `${width}px`; image.style.height = `${height}px`; image.style.left = `${actorLeft}px`; image.style.top = `${top}px`;images.push(image);
    }
    const keep=new Set(images);for(const child of [...layer.children])if(!keep.has(child))child.remove();for(const [index,image]of images.entries())if(layer.children[index]!==image)layer.insertBefore(image,layer.children[index]??null);
    if(state?.dialogue)for(const image of images){const active=state.dialogue.speaker&&(image.alt===state.dialogue.speaker||image.dataset.actor===state.dialogue.speaker||JSON.parse(image.dataset.speakerNames??'[]').includes(state.dialogue.speaker));image.style.opacity=active?'1':state.dialogue.speaker?'.32':'.58';image.dataset.opacity=image.style.opacity;}

    const name = doc.createElement("strong"), activity = doc.createElement("span"); name.textContent = displayed.length > 1 ? `已选${displayed.length}人` : displayed[0]?.name ?? ""; activity.textContent = displayed.length > 1 ? displayed.map((x) => x.name).join(" · ") : displayed[0]?.activity ?? ""; caption.append(name, activity);
  }
  async function animateActor(selected, direction) {
    const version = ++epoch; animation?.cancel(); transitionTarget = selected?.id ?? "";
    const old = layer.querySelector("img");
    if (!old || reduced() || typeof old.animate !== "function") { paintActor(selected); transitionTarget = ""; return; }
    root.dataset.sceneMoving='true';root.dataset.motion = direction > 0 ? "forward" : "backward";
    try {
      animation = old.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-direction * 700}px)`, opacity: 0 }], { duration: 180, easing: "cubic-bezier(.4,0,.8,.3)", fill: "forwards" });
      await animation.finished; if (version !== epoch) return;
      paintActor(selected); const image = layer.querySelector("img");
      if (image) {
        image.style.opacity = "0";
        if (typeof image.decode === "function") await image.decode().catch(() => {});
        if (version !== epoch) return;
        animation = image.animate([{ transform: `translateX(${direction * 700}px)`, opacity: 0 }, { transform: `translateX(${-direction * 14}px)`, opacity: Number(image.dataset.opacity ?? 1), offset: .82 }, { transform: "translateX(0)", opacity: Number(image.dataset.opacity ?? 1) }], { duration: 300, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
        await animation.finished;
        if (version === epoch) { image.style.opacity = image.dataset.opacity ?? "1"; animation.cancel(); }
      }
    } catch (_) { /* A newer selection cancels this motion; it owns the next frame. */ }
    finally { if (version === epoch) { animation = null; transitionTarget = ""; delete root.dataset.motion;delete root.dataset.sceneMoving; } }
  }
  return { root, render, resize, destroy() { epoch++;backgroundSwap.destroy(); animation?.cancel(); clearTimeout(scrollTimer); viewportObserver?.disconnect();root.removeEventListener('hypno:toolbar-change',resize);root.remove();unregisterSceneRoot(doc,root);if(!sceneRootFor(doc))for(const name of ['left','top','width','height','right','bottom','center-x','center-y'])doc.documentElement.style.removeProperty('--hypno-scene-'+name);state=null; } };
}
