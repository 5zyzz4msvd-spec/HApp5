import { uninvestigatedCredit } from '../game/credits.mjs';
import { sceneActorAsset } from './scene-character-presentation.mjs';
import { surfaceLifecycle } from '../ui/surface-motion.mjs';
import { dockSceneToolbar } from '../ui/scene-toolbar.mjs';
import { bindFloatingDrag, sceneSurfaceRect } from '../ui/floating-window.mjs';
import { installSerialMotion } from '../ui/serial-motion.mjs';
import { designChildRecordPages } from './notebook-collections.mjs';
import { mountScoutingBook } from './scouting-book.mjs';
import { notebookVolumes, notebookChapterPending } from "./notebook-model.mjs";
import { mountCurvedPage } from "./page-curl.mjs";
import { NOTEBOOK_STYLE } from "./notebook-style.mjs";
import { designNotebookPages, notebookAdjacent, notebookReleaseTarget, designAffinityPages } from "./notebook-presentation.mjs";
import { designTimetablePages, drawTimetable } from "./notebook-timetable.mjs";
import { drawNotebookPageButton } from './notebook-page-actions.mjs';
import { notebookBookSwitcher } from './notebook-book-switch.mjs';
import { notebookGallery, drawNotebookPhoto } from './notebook-photo.mjs';
import { mountRoleGallery } from "./role-gallery.mjs";
import { openNotebookPopup } from "./notebook-popup.mjs";
import { designEffectPages } from "./notebook-effects.mjs";
import { PERSONNEL_TIME_SLOTS } from "./personnel-time-grid.mjs";
import { drawNotebookBlocks } from "./notebook-ink.mjs";

export async function mountDetectiveNotebook(container, { snapshot, assets, resolveFile, portraitFile = async () => null, favourite, investigate = null, uploadImage = null, imageSelection = null, serviceSnapshot = null, scout = null, scoutingUploadImage = null, scoutingImageSelection = null, onOpenDetective = null, onClose = () => {}, initialRole = "" }) {
  const doc = container.ownerDocument, win = doc.defaultView;installSerialMotion(doc);
  const W = 1280, H = 840, PW = 470, PH = 620, SPINE = 715, TOP = 156;
  const root = doc.createElement("section"); root.className = "dn-window"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "林安的侦探笔记");
  const style = doc.createElement("style");
  style.textContent = NOTEBOOK_STYLE;
  root.innerHTML = '<div class="dn-stage"><div class="dn-header"><strong>林安的侦探笔记</strong><input type="search" aria-label="搜索人物" placeholder="搜索人物"><button type="button" data-action="people" aria-pressed="true">人物</button><button type="button" data-action="user" aria-pressed="false"></button><button type="button" data-action="album" aria-pressed="false">收藏簿</button><button type="button" data-action="detective">委托</button><button type="button" data-action="scout" aria-pressed="false">物色簿</button><button type="button" data-action="close" aria-label="关闭笔记">×</button></div><div class="dn-book-unit"><div class="dn-book"><img alt="展开的侦探笔记"></div><div class="dn-pages"><canvas class="dn-page left"></canvas><canvas class="dn-page right"></canvas></div><canvas class="dn-curl"></canvas><div class="dn-bookmarks" aria-label="人物书签"></div><div class="dn-collection"><button data-action="previous-volume" aria-label="换上一本">‹</button><span></span><button data-action="next-volume" aria-label="换下一本">›</button></div><div class="dn-edge left" tabindex="0" role="button" aria-label="按住左页边缘拖动翻页"></div><div class="dn-edge right" tabindex="0" role="button" aria-label="按住右页边缘拖动翻页"></div><nav class="dn-chapters" aria-label="人物笔记章节"></nav><button class="dn-photo-favourite" data-action="favourite" aria-label="收藏当前人物">☆</button><button class="dn-photo-zone portrait" aria-label="选择胸像"></button><button class="dn-photo-zone standee" aria-label="选择全身立绘"></button><div class="dn-page-hits"></div><div class="dn-footer"><button data-action="previous-page" aria-label="上一页">‹</button><span class="dn-sr-number"></span><button data-action="next-page" aria-label="下一页">›</button></div><div class="dn-notice" role="status"></div><div class="dn-sr" aria-live="polite"></div></div></div>';
  root.prepend(style); container.append(root);
  const stage = root.querySelector(".dn-stage"), book = root.querySelector(".dn-book"), left = root.querySelector(".dn-page.left"), right = root.querySelector(".dn-page.right"), curlCanvas = root.querySelector(".dn-curl"), notice = root.querySelector(".dn-notice");
  stage.style.opacity="0";
  const toolbar=root.querySelector(".dn-header"),collection=root.querySelector(".dn-collection");toolbar.insertBefore(collection,toolbar.querySelector('[data-action="close"]'));collection.setAttribute("aria-label","人物笔记切册");let toolbarDock={docked:false,destroy(){}};
  const floatingDrag=bindFloatingDrag(toolbar,stage,{visibleTop:()=>toolbarDock.docked?100*scale:0});
  const reduced = () => Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  let scale = 1, data = await snapshot(), selected = "", volume = 0, spreadIndex = 0, album = false, query = "", pageModels = [], pageTextures = [], turn = null, frame = 0, epoch = 0, destroyed = false;
  let userMode = false, peoplePosition = null, userSpread = 0;
  let bookSwap = 0, galleryView = null, galleryHost = null, scoutingView = null, scoutingHost = null, modeBusy = false;
  const bookSwitcher = notebookBookSwitcher(root, { reduced });
  let neighbours = {}, drag = null, idleTimer = 0; const bundleCache = new Map();
  const imageCache = new Map(), portraitCache = new Map(), urls = [];
  async function image(url) { if (!url) return null; if (!imageCache.has(url)) imageCache.set(url, new Promise((resolve) => { const img = new win.Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url; })); return imageCache.get(url); }
  const paper = await image(resolveFile(assets.spread));
  const portraitPaper = await image(resolveFile(assets.portraitPage)), notesPaper = await image(resolveFile(assets.notesPage));
  book.querySelector("img").src = resolveFile(assets.spread);
  let curved = null; try { curved = mountCurvedPage(curlCanvas, { width: W, height: H }); } catch (_) {}
  root.dataset.pageRenderer = curved ? "webgl-curved-texture" : "flat-fallback";
  function fit(){const bounds=sceneSurfaceRect(doc);scale=Math.min(1,bounds.width*.92/W,bounds.height*.94/(H-(toolbarDock.docked?100:0)));stage.style.left=`${bounds.left+(bounds.width-W*scale)/2}px`;stage.style.top=`${bounds.top+(bounds.height-(H-(toolbarDock.docked?100:0))*scale)/2-(toolbarDock.docked?100*scale:0)}px`;stage.style.transform=`scale(${scale})`;root.dataset.scale=String(scale);}
  function actorAsset(actor) { return sceneActorAsset(actor, assets.characters); }
  function wrap(context, text, width = PW - 82) { const rows = []; let line = ""; for (const char of String(text ?? "")) { if (char === "\n") { rows.push(line); line = ""; } else if (context.measureText(line + char).width > width && line) { if (/[，。！？；：、）】》」』]/.test(char) && line.length > 2) { rows.push(line.slice(0, -2)); line = line.slice(-2) + char; } else { rows.push(line); line = char; } } else line += char; } if (line) rows.push(line); return rows; }
  function texture(model, side) {
    const canvas = doc.createElement("canvas"); canvas.width = PW * 2; canvas.height = PH * 2; const ctx = canvas.getContext("2d"); ctx.scale(2, 2);
    const skin = model.cover && model.mode !== "standee" ? portraitPaper : notesPaper;
    if (skin) ctx.drawImage(skin, 0, 0, PW, PH);
    else if (paper) { const x = side === "left" ? .066 : .5; ctx.drawImage(paper, paper.width * x, paper.height * .062, paper.width * .434, paper.height * .882, 0, 0, PW, PH); }
    else { ctx.fillStyle = "#f4e8ce"; ctx.fillRect(0, 0, PW, PH); }
    if (model.folio === 1) { ctx.fillStyle = "#493723"; ctx.font = '500 40px "Songti SC",serif'; ctx.fillText(model.name,34,111); }
    if (model.cover) {
      drawNotebookPhoto(ctx, { photo: model.photo, mode: model.mode });

    } else if(model.pending){ctx.fillStyle='#a08c70';ctx.font='32px "Songti SC",serif';ctx.textAlign='center';ctx.fillText('未完待续',PW/2,PH/2);ctx.textAlign='left';
    } else if (model.locked) {
      ctx.fillStyle = "#ac9777"; ctx.font = '32px "Songti SC",serif'; ctx.textAlign = "center"; ctx.fillText(uninvestigatedCredit(selected+":"+model.title).split(" · ")[0], PW / 2, PH / 2);ctx.font='15px "Songti SC",serif';ctx.fillText(uninvestigatedCredit(selected+":"+model.title).split(" · ").slice(1).join(" · "),PW/2,PH/2+45); ctx.textAlign = "left";
    } else if (model.table) drawTimetable(ctx, model);
    else if (model.blocks) drawNotebookBlocks(ctx, model);
    else { ctx.fillStyle = "#8f795c"; ctx.font = '28px "Songti SC",serif'; for (const [i, line] of (model.lines ?? []).entries()) ctx.fillText(line, 34, 175 + i * 32); }
    if(model.cover&&model.mode==='portrait')drawNotebookPageButton(ctx,{x:405,y:40,width:42,height:42,label:data.preferences.favourites?.includes(model.actorId)?'★':'☆',kind:'star'});
    if(model.investigationLabel){ctx.font='22px "Songti SC",serif';drawNotebookPageButton(ctx,{x:210,y:72,width:ctx.measureText(model.investigationLabel).width+26,label:model.investigationLabel,disabled:model.investigationDisabled});}
    const roster=libraryRows(),atStart=!roster.length||model.folio===1&&roster[0]?.id===model.actorId,atEnd=!roster.length||model.folio===model.totalPages&&roster.at(-1)?.id===model.actorId;
    drawNotebookPageButton(ctx,{x:side==='left'?26:351,y:561,width:72,height:44,label:side==='left'?'‹':'›',kind:'arrow',disabled:side==='left'?atStart:atEnd});
    ctx.font = '22px Georgia,serif'; ctx.fillStyle = "#9b8562"; ctx.textAlign = "center"; ctx.fillText(String(model.folio ?? ""), PW / 2, PH - 24); ctx.textAlign = "left";
    return canvas;
  }
  function galleryFor(actor, overrideMode = null) {
    return notebookGallery(actor, actorAsset(actor), overrideMode, resolveFile);
  }
  async function fileUrl(file) { if (!file) return null; if (file.url) return file.url; const key=JSON.stringify(file.ref); if(!portraitCache.has(key))portraitCache.set(key,(async()=>{const blob=await portraitFile(file.ref);if(!blob)return null;const url=URL.createObjectURL(blob);urls.push(url);return url;})());return portraitCache.get(key); }
  async function showGallery(initialMode) {
    const id=selected; if(!id)return; galleryView?.destroy();galleryHost?.remove();galleryHost=doc.createElement("div");galleryHost.style.cssText="position:absolute;inset:0;z-index:50";root.append(galleryHost);
    const actor=()=>data.characters.find(x=>x.id===id);
    galleryView=await mountRoleGallery(galleryHost,{name:actor().name,initialMode,gallery:async mode=>galleryFor(actor(),mode),resolveImage:fileUrl,onClose:()=>{galleryView?.destroy();galleryView=null;galleryHost?.remove();galleryHost=null;},onSelect:async(mode,index)=>transact(()=>imageSelection?.(id,{...actor().imageSelection,mode,[mode]:index})),onUpload:async(mode,index,blob)=>transact(()=>uploadImage?.(id,blob,{usage:mode,slot:index,name:blob.name}))});
  }
  async function buildPages(actor) {
    const models = [];
    if(actor.userRecords){
      const measure=doc.createElement('canvas').getContext('2d'),wrapText=(text,kind)=>{measure.font=`${kind==='collection-title'?24:kind==='collection-meta'?22:29}px "Songti SC",serif`;return wrap(measure,text,kind==='collection-title'?330:363);};
      const add=(pages,title)=>{if(notebookChapterPending(title,actor))pages=[{title,chapter:title,locked:true,pending:true,lines:['未完待续']}];models.push(...pages);if(!pages.length)models.push({title,chapter:title,lines:['暂无记录']});if(models.length%2)models.push({title,chapter:title,lines:[]});};
      for(const group of actor.groups??[])add(designNotebookPages(group,wrapText),group.label);
      add(designChildRecordPages(actor.achievements??[],'成就',wrapText),'成就');add(designChildRecordPages(actor.tasks??[],'任务',wrapText),'任务');add(designAffinityPages(actor.affinityEvents??[],wrapText),'事件');
      models.forEach((model,i)=>{model.folio=i+1;model.name=actor.name;model.actorId=actor.id;model.totalPages=models.length;});return{models,textures:new Array(models.length)};
    }
    for (const mode of ["portrait", "standee"]) { const gallery = galleryFor(actor, mode), file = gallery.files[gallery.index], photo = file ? await image(await fileUrl(file)) : null; models.push({ title: "人物档案", chapter: "档案", cover: true, name: actor.name, photo, mode, locked: !actor.unlocked, lines: [actor.name] }); }
    const measure = doc.createElement("canvas").getContext("2d");
    const measuredWrap = (text, kind) => { const size = kind === "collection-meta" ? 22 : kind === "collection-title" ? 24 : kind === "grid-cell" ? 18 : kind === "label" ? 23 : ["card-title", "effect-title"].includes(kind) ? 24 : kind === "card" ? 23 : kind === "schedule-note" ? 22 : kind === "schedule-place" ? 21 : 29; measure.font = `${size}px "Songti SC",serif`; return wrap(measure, text || "", kind === "collection-title" ? 330 : kind === "grid-cell" ? 79 : kind === "card" ? 170 : kind === "card-title" ? 148 : kind === "effect-title" ? 331 : kind === "schedule-note" ? 139 : kind === "schedule-place" ? 145 : 363); };
    let groups = actor.unlocked ? [...(actor.groups ?? [])].filter(x => !["物品", "关系", "事件", "记录", "子嗣", "隐藏线", "隐藏灵异线"].includes(x.label)) : ["状态", "信息", "衣着", "敏感", "效果", "劣迹", "改造", "成就", "任务"].map((label) => ({ label, fields: [] }));
    if (actor.unlocked) for (const label of ["衣着", "状态", "信息", "敏感", "效果", "劣迹", "改造", "成就", "任务"]) if (!groups.some(x => x.label === label)) groups.push({ label, fields: [] });
    const ordered = ["状态", "信息", "衣着", "敏感", "效果", "劣迹", "改造", "成就", "任务"];
    groups = [...ordered.map(label => groups.find(x=>x.label===label) ?? {label,fields:[]}),...groups.filter(x=>!ordered.includes(x.label))];
    // Every chapter starts on an even leaf boundary and occupies complete spreads.
    function padChapter(start, title) { const single=models[start];if(models.length-start===1&&single?.blocks?.length>1){const split=Math.ceil(single.blocks.length/2),second={...single,blocks:single.blocks.slice(split)};single.blocks=single.blocks.slice(0,split);single.lines=single.blocks.map(x=>[x.title,...(x.metaLines??[]),...x.lines].join(" "));second.lines=second.blocks.map(x=>[x.title,...(x.metaLines??[]),...x.lines].join(" "));models.push(second);} if(models.length-start<2)models.push({title,chapter:title,lines:[]});if((models.length-start)%2)models.push({title,chapter:title,lines:[]}); }
    for (const [i, group] of groups.entries()) {
      const start = models.length;
      if(notebookChapterPending(group.label,actor))models.push({title:group.label,chapter:group.label,locked:true,pending:true,lines:['未完待续']});
      else if (!actor.unlocked) models.push({ title: group.label, chapter: group.label, locked: true, lines: [] });
      else if (group.label === "效果") models.push(...designEffectPages([group], measuredWrap));
      else if(["成就","任务"].includes(group.label))models.push(...designChildRecordPages(group.label==="成就"?actor.achievements??[]:actor.tasks??[],group.label,measuredWrap));
      else models.push(...designNotebookPages(group, measuredWrap));
      padChapter(start, group.label);
      if(group.label==='状态'&&!actor.unlocked)models[start].investigationLabel=actor.investigationAllowed===false?'调查未开放':actor.scoutingPending?'物色进行中':`委托调查 · ¥${actor.price??'—'}`;
    }
    const eventStart = models.length;
    if(notebookChapterPending('事件',actor))models.push({title:'事件',chapter:'事件',locked:true,pending:true,lines:['未完待续']});
    else if(actor.eventsUnlocked??actor.unlocked)models.push(...designAffinityPages(actor.affinityEvents ?? [],measuredWrap));
    else models.push({title:"事件",chapter:"事件",locked:true,lines:[]});
    padChapter(eventStart,"事件");
    const scheduleStart=models.length;
    if(actor.unlocked)models.push(...designTimetablePages(actor.schedule,{calendar:data.calendar,dateOverrides:actor.dateOverrides??[],locations:data.locations,name:actor.name,wrap:measuredWrap}));
    else models.push({title:"一周日程",chapter:"日程",locked:true,lines:[]});
    padChapter(scheduleStart,"日程");
    models.forEach((model, i) => { model.folio = i + 1;model.actorId=actor.id;model.totalPages=models.length;model.investigationDisabled=actor.scoutingPending||actor.investigationAllowed===false; });
    return { models, textures: new Array(models.length) };
  }
  function prepare(index) { for (let i = Math.max(0, index * 2 - 2); i < Math.min(pageTextures.length, index * 2 + 4); i++) if (!pageTextures[i]) pageTextures[i] = texture(pageModels[i], i % 2 ? "right" : "left"); }
  function paint(index = spreadIndex) {
    prepare(index);
    for (let i = 0; i < pageTextures.length; i++) if (i < index * 2 - 2 || i > index * 2 + 3) pageTextures[i] = undefined;
    for (const [canvas, source] of [[left, pageTextures[index * 2]], [right, pageTextures[index * 2 + 1]]]) { canvas.width = PW * 2; canvas.height = PH * 2; if (source) canvas.getContext("2d").drawImage(source, 0, 0); }
    root.querySelector(".dn-sr-number").textContent = `${index * 2 + 1}—${index * 2 + 2} / ${pageTextures.length}`;
    root.dataset.spreadIndex = String(index); root.dataset.pageCount = String(pageTextures.length);
    root.querySelector(".dn-sr").textContent = pageModels.slice(index * 2, index * 2 + 2).map((x) => `${x.title} ${x.name ?? ""} ${x.pending?'未完待续':x.locked ? "未记录" : x.lines?.join(" ") ?? ""}`).join("\n");
  }
  function libraryRows() { if(userMode)return data.characters.filter(x=>x.userRecords);return notebookVolumes(data.characters, { query, favouritesOnly: album, favourites: data.preferences.favourites ?? [] }).total ? data.characters.filter(x => (x.id !== "user" && !x.userRecords) && (!album || data.preferences.favourites?.includes(x.id)) && (!query.trim() || [x.name, ...(x.aliases ?? [])].some(v => v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))) : []; }
  function bundleFor(actor) { if (!bundleCache.has(actor.id)) bundleCache.set(actor.id, buildPages(actor)); return bundleCache.get(actor.id); }
  async function primeNeighbours() {
    const token = epoch, id = selected, rows = libraryRows(); neighbours = {};
    const nearby = new Set([id, ...[-1, 1].map(direction => notebookAdjacent(rows, id, direction)?.id)]);
    for (const key of bundleCache.keys()) if (!nearby.has(key)) bundleCache.delete(key);
    await Promise.all([-1, 1].map(async direction => {
      const actor = notebookAdjacent(rows, id, direction); if (!actor) return;
      const bundle = await bundleFor(actor);
      if (token === epoch && selected === id) neighbours[direction] = { actor, ...bundle };
    }));
    if (token === epoch && selected === id) controls();
  }
  function stopIdle() { if (idleTimer) win.clearTimeout(idleTimer); idleTimer = 0; }
  function cancelTurn() { const hadTurn=Boolean(turn);stopIdle(); drag = null; epoch++; if (frame) win.cancelAnimationFrame(frame); frame = 0; turn = null; curved?.clear(); left.style.visibility = right.style.visibility = "visible"; delete root.dataset.turnProgress; for(const tab of root.querySelectorAll('.dn-tab,.dn-chapter-row'))tab.style.removeProperty('left'); win.requestAnimationFrame(()=>{if(!turn)delete root.dataset.bookmarkTurning;});if(hadTurn&&!destroyed&&pageTextures.length){paint();controls();} }
  function begin(direction, grabY = .5, destination = null) {
    if (turn || !pageTextures.length || root.dataset.bookChanging) return false;
    const target = spreadIndex + direction, boundary = destination ? Boolean(destination.actor && destination.actor.id !== selected) : target < 0 || target >= pageTextures.length / 2;
    const next = destination ?? (boundary ? neighbours[direction] : { models: pageModels, textures: pageTextures });
    if (!next) return false;
    const targetIndex = destination ? destination.index : boundary ? direction > 0 ? 0 : next.models.length / 2 - 1 : target;
    const pair = targetIndex * 2;
    for (let i = pair; i < pair + 2; i++) if (!next.textures[i]) next.textures[i] = texture(next.models[i], i % 2 ? "right" : "left");
    turn = { direction, target: targetIndex, progress: 0, grabY, boundary, next };
    root.querySelector('[data-action="favourite"]').disabled=true;
    root.querySelector('[data-action="favourite"]').dataset.turnDisabled='true';
    root.querySelectorAll('.dn-photo-zone,.dn-page-hits button,.dn-footer button').forEach(button=>{button.disabled=true;button.dataset.turnDisabled='true';});
    if (curved && !reduced()) {
      curved.setPages(direction > 0 ? pageTextures[spreadIndex * 2 + 1] : pageTextures[spreadIndex * 2], next.textures[pair + (direction > 0 ? 0 : 1)]);
      (direction > 0 ? right : left).getContext("2d").drawImage(next.textures[pair + (direction > 0 ? 1 : 0)], 0, 0);
    }
    return true;
  }
  function drawTurn(progress) { if (!turn) return; turn.progress = Math.max(0, Math.min(1, progress)); root.dataset.turnProgress = String(turn.progress); syncTurnBookmarks(turn.progress); if (curved && !reduced()) curved.render({ progress: turn.progress, direction: turn.direction, grabY: turn.grabY, spine: SPINE, top: TOP, width: PW, height: PH }); }
  function syncTurnBookmarks(progress){
    root.dataset.bookmarkTurning='true';
    const destinationActor=turn.next.actor?.id??selected;
    for(const tab of root.querySelectorAll('.dn-tab')){const from=tab.dataset.id===selected?92:138,to=tab.dataset.id===destinationActor?92:138;tab.style.left=`${from+(to-from)*progress}px`;}
    const fromChapters=new Set(pageModels.slice(spreadIndex*2,spreadIndex*2+2).map(x=>x.chapter));
    const toChapters=new Set(turn.next.models.slice(turn.target*2,turn.target*2+2).map(x=>x.chapter));
    for(const row of root.querySelectorAll('.dn-chapter-row')){const from=fromChapters.has(row.dataset.chapter)?0:-8,to=toChapters.has(row.dataset.chapter)?0:-8;row.style.left=`${from+(to-from)*progress}px`;}
  }
  function settle(commit = notebookReleaseTarget(turn?.progress)) {
    if (!turn || turn.settling) return; stopIdle(); drag = null; turn.settling = true;
    const current = turn, token = ++epoch, start = current.progress, end = commit ? 1 : 0, started = win.performance.now(); const duration = reduced() || !curved ? 0 : 420 * Math.max(.25, Math.abs(end - start));
    function tick(now) {
      if (token !== epoch || destroyed) return;
      const t = duration ? Math.min(1, (now - started) / duration) : 1; drawTurn(start + (end - start) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = win.requestAnimationFrame(tick);
      else {
        if (commit && current.boundary) { selected = current.next.actor.id; pageModels = current.next.models; pageTextures = current.next.textures; root.dataset.selectedActor = selected; if(!userMode)volume = Math.floor(libraryRows().findIndex(x => x.id === selected) / 6); renderBookmarks(); }
        spreadIndex = commit ? current.target : spreadIndex; cancelTurn(); paint(); controls(); void primeNeighbours();
      }
    }
    frame = win.requestAnimationFrame(tick);
  }
  function turnPage(direction) { if (begin(direction)) { drawTurn(0); settle(true); } }
  function releaseDrag() { if (drag && turn) settle(); }
  function dragMove(event) {
    if (!drag || !turn || turn.settling || event.pointerId !== drag.pointerId) return;
    drawTurn(drag.direction * (drag.startX - event.clientX) / (PW * scale));
    stopIdle(); idleTimer = win.setTimeout(releaseDrag, 700);
  }
  doc.addEventListener("pointermove", dragMove); doc.addEventListener("pointerup", releaseDrag); doc.addEventListener("pointercancel", releaseDrag); win.addEventListener("blur", releaseDrag);
  for (const [side, direction] of [["right", 1], ["left", -1]]) {
    const edge = root.querySelector(`.dn-edge.${side}`);
    edge.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = stage.getBoundingClientRect(), y = (event.clientY - rect.top) / scale;
      if (!begin(direction, (y - TOP) / PH)) return;
      drag = { pointerId: event.pointerId, startX: event.clientX, direction }; edge.setPointerCapture(event.pointerId); event.preventDefault(); drawTurn(.001);
      stopIdle(); idleTimer = win.setTimeout(releaseDrag, 900);
    });
    edge.addEventListener("lostpointercapture", releaseDrag);
    edge.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); turnPage(direction); } });
  }
  function controls() {
    const prev = root.querySelector('[data-action="previous-page"]'), next = root.querySelector('[data-action="next-page"]');
    prev.disabled = Boolean(turn) || !selected || spreadIndex === 0 && !neighbours[-1]; next.disabled = Boolean(turn) || !selected || spreadIndex >= pageTextures.length / 2 - 1 && !neighbours[1];
    const fav = root.querySelector('[data-action="favourite"]'); fav.hidden = !pageModels.slice(spreadIndex * 2, spreadIndex * 2 + 2).some(x => x.cover); fav.disabled=Boolean(turn);fav.dataset.turnDisabled=String(Boolean(turn));fav.textContent = data.preferences.favourites?.includes(selected) ? "★" : "☆"; fav.setAttribute("aria-pressed", String(data.preferences.favourites?.includes(selected) ?? false));
    const actor = data.characters.find(x => x.id === selected), onPhoto = pageModels.slice(spreadIndex * 2, spreadIndex * 2 + 2).some(x => x.cover);
    root.querySelectorAll('.dn-photo-zone').forEach(button => { button.hidden = !onPhoto;button.disabled=Boolean(turn); });
    const chapters = root.querySelector(".dn-chapters"), titles = [...new Set(pageModels.map(x=>x.chapter).filter(Boolean))];
    const key=titles.map(title=>title+":"+notebookChapterPending(title,actor)).join("|"); if(chapters.dataset.key!==key){chapters.dataset.key=key;chapters.replaceChildren();for(const title of titles){const row=doc.createElement("div");row.className="dn-chapter-row";row.dataset.chapter=title;const button=doc.createElement("button");button.type="button";button.textContent=title;if(title.length>3)button.style.fontSize="19px";button.setAttribute("aria-label",notebookChapterPending(title,actor)?`${title}已锁定，未完待续`:`打开${title}章节`);if(notebookChapterPending(title,actor)){row.classList.add("is-locked");button.setAttribute("aria-disabled","true");}button.addEventListener("click",()=>{if(notebookChapterPending(title,actor)){notice.textContent="未完待续";return;}const target=Math.floor(pageModels.findIndex(x=>x.chapter===title)/2);cancelTurn();paint();controls();if(target===spreadIndex)return;if(begin(target>spreadIndex?1:-1,.5,{models:pageModels,textures:pageTextures,index:target}))settle(true);});row.append(button);chapters.append(row);}}
    for(const row of chapters.children){const current=pageModels.slice(spreadIndex*2,spreadIndex*2+2).some(x=>x.chapter===row.dataset.chapter);row.setAttribute("aria-current",String(current));row.firstElementChild.setAttribute("aria-current",String(current));}

    renderPageHits();
  }
  function renderPageHits(){const layer=root.querySelector('.dn-page-hits');if(turn){for(const button of layer.querySelectorAll('button')){button.disabled=true;button.dataset.turnDisabled='true';}return;}layer.replaceChildren();
    for(let side=0;side<2;side++){const model=pageModels[spreadIndex*2+side],leftX=side?SPINE:SPINE-PW;
      const actor=data.characters.find(x=>x.id===selected);
      if(model?.chapter==='状态'&&!actor?.unlocked&&spreadIndex*2+side===pageModels.findIndex(x=>x.chapter==='状态')){const button=doc.createElement('button');button.className='dn-investigate-page';button.style.cssText=`left:${leftX+210}px;top:${TOP+72}px`;button.textContent=actor.investigationAllowed===false?'调查未开放':actor.scoutingPending?'物色进行中':`委托调查 · ¥${actor.price??'—'}`;button.disabled=actor.scoutingPending||actor.investigationAllowed===false;button.title=actor.permissionReason??"";button.setAttribute('aria-label',`调查${actor.name}，查看价格`);button.addEventListener('click',()=>void openDetective('investigate',selected));layer.append(button);}


      if(model?.kind==='week-grid'){const cw=((model.wide?872:402)-63)/model.days.length;for(let dayIndex=0;dayIndex<model.days.length;dayIndex++)for(let rowIndex=0;rowIndex<PERSONNEL_TIME_SLOTS.length;rowIndex++){const day=model.days[dayIndex],cell=model.cells[day][rowIndex],slot=PERSONNEL_TIME_SLOTS[rowIndex],button=doc.createElement('button');button.className='dn-detail-hit';const sx=34+63+dayIndex*cw-(model.wideSide?470:0),ex=sx+cw,visibleStart=Math.max(0,sx),visibleEnd=Math.min(470,ex);if(visibleEnd<=visibleStart)continue;button.style.cssText=`left:${leftX+visibleStart}px;top:${TOP+124+33+rowIndex*36}px;width:${visibleEnd-visibleStart}px;height:36px`;button.setAttribute('aria-label',`周${model.labels[day]} ${slot.start} ${cell.note}`);button.addEventListener('click',()=>openNotebookPopup(root,'日程详情',[{title:'周'+model.labels[day]+' · '+slot.name,time:slot.start+'—'+slot.end,details:[cell.note,cell.location]}]));layer.append(button);}}
    }
  }
  async function selectActor(id, animate = true) {
    notice.textContent="";cancelTurn(); const token = epoch;
    if (animate && selected && id && pageModels.length) { const actor = data.characters.find(x => x.id === id); if (!actor) return; const bundle = await bundleFor(actor); if (token !== epoch || destroyed) return; if (id === selected && spreadIndex === 0) return; const direction = libraryRows().findIndex(x => x.id === id) >= libraryRows().findIndex(x => x.id === selected) && id !== selected ? 1 : -1; if (begin(direction, .5, { actor, ...bundle, index: 0 })) settle(true); return; }
    selected = id; spreadIndex = 0; root.dataset.selectedActor = id;
    const actor = data.characters.find((x) => x.id === id); if (!actor) { pageModels = [{ title: "收藏簿", lines: ["还没有收藏的人物"] }, { title: "人物检索", lines: ["没有匹配的人物"] }]; pageTextures = pageModels.map((x, i) => texture(x, i ? "right" : "left")); } else { const result = await bundleFor(actor); if (token !== epoch) return; pageModels = result.models; pageTextures = result.textures; }
    paint(); controls(); await primeNeighbours(); if (token !== epoch || selected !== id || destroyed) return; for (const tab of root.querySelectorAll(".dn-tab")) tab.setAttribute("aria-current", String(tab.dataset.id === id));
    if (animate && !reduced()) root.querySelector(".dn-pages").animate([{ opacity: .35 }, { opacity: 1 }], { duration: 220 });
  }
  function renderBookmarks() {
    const vol = notebookVolumes(data.characters, { query, favouritesOnly: album, favourites: data.preferences.favourites ?? [], volume }); volume = vol.index;
    const rows=userMode?[]:vol.rows;const tabs = root.querySelector(".dn-bookmarks");tabs.hidden=userMode;const rosterKey=rows.map(x=>x.id).join("|"); const changed=tabs.dataset.key!==rosterKey; if(changed){tabs.dataset.key=rosterKey;tabs.replaceChildren();}
    for (const actor of rows.filter(x=>![...tabs.children].some(tab=>tab.dataset.id===x.id))) { const tab = doc.createElement("button"); tab.type = "button"; tab.className = "dn-tab"; tab.dataset.id = actor.id; tab.setAttribute("aria-current", String(actor.id === selected)); tab.setAttribute("aria-label", `打开${actor.name}笔记`); tab.draggable = actor.slotEligible!==false&&!actor.scoutingPending;
      const skin = doc.createElement("img"); skin.className = "skin"; skin.alt = ""; skin.src = resolveFile(assets.bookmark); tab.append(skin);
      const asset = actorAsset(actor); if (actor.headUrl||asset?.head) { const face = doc.createElement("img"); face.className = "face"; face.alt = actor.name; face.src = actor.headUrl??resolveFile(asset.head); tab.append(face); } else { const initial = doc.createElement("span"); initial.className = "initial"; initial.textContent = actor.name.slice(-2); tab.append(initial); }
      tab.addEventListener("dragstart", (event) => { if (actor.scoutingPending||actor.slotEligible===false) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-hypnoos-character", actor.id); }); tab.addEventListener("click", () => void selectActor(actor.id)); tabs.append(tab);
    }
    for(const tab of tabs.children){tab.setAttribute("aria-current",String(tab.dataset.id===selected));const actor=data.characters.find(x=>x.id===tab.dataset.id);if(actor?.headUrl){let face=tab.querySelector(".face");if(!face){face=doc.createElement("img");face.className="face";face.alt=actor.name;tab.querySelector(".initial")?.remove();tab.append(face);}face.src=actor.headUrl;}}
    collection.querySelector("span").textContent = `${volume + 1} / ${vol.count} 册`;
    collection.querySelector('[data-action="previous-volume"]').disabled = volume === 0; collection.querySelector('[data-action="next-volume"]').disabled = volume + 1 >= vol.count;
  }
  async function renderLibrary({ changeBook = false, restoreSpread = 0 } = {}) {
    const token=++bookSwap,unit=root.querySelector('.dn-book-unit');
    const prepare=async()=>{
      renderBookmarks();const vol=notebookVolumes(data.characters,{query,favouritesOnly:album,favourites:data.preferences.favourites??[],volume});
      const candidate=userMode?data.characters.find(x=>x.userRecords):vol.rows.find(x=>x.id===selected)??vol.rows[0];await selectActor(candidate?.id??'',false);if(restoreSpread){spreadIndex=Math.max(0,Math.min(restoreSpread,pageTextures.length/2-1));paint();controls();}syncBookTabs();
    };
    if(changeBook){cancelTurn();await bookSwitcher.swap({outgoing:unit,prepare});}
    else await prepare();
    if(token!==bookSwap||destroyed)return;
  }
  async function switchBookMode(entering,prepare=async()=>{}) {
    cancelTurn();scoutingView.cancelMotion();
    const original=root.querySelector('.dn-book-unit'),scouting=scoutingView.root.querySelector('.dn-book-unit');
    if(entering)scouting.hidden=true;scoutingHost.style.visibility='visible';
    return bookSwitcher.swap({outgoing:entering?original:scouting,incoming:entering?scouting:original,prepare});
  }
  async function openScouting(){
    if(modeBusy||destroyed)return;if(!serviceSnapshot||!scout){notice.textContent='物色簿服务接口未连接';return;}modeBusy=true;const input=toolbar.querySelector('input');
    input.disabled=true;try{
      if(!scoutingView){scoutingHost=doc.createElement('div');scoutingHost.style.cssText='position:absolute;inset:0;z-index:40;visibility:hidden';stage.append(scoutingHost);
        scoutingView=await mountScoutingBook(scoutingHost,{assets,resolveFile,serviceSnapshot,scout,portraitFile,bookSwitcher,uploadImage:scoutingUploadImage,imageSelection:scoutingImageSelection,embedded:true,onClose,onChanged:async()=>{data=await snapshot();bundleCache.clear();}});
        await switchBookMode(true);if(destroyed)return;root.querySelector('.dn-book-unit').style.visibility='hidden';scoutingHost.style.visibility='visible';root.dataset.bookMode='scouting';input.value='';input.placeholder='检索人选';input.setAttribute('aria-label','检索物色人选');syncBookTabs();
      }else{const previousActor=selected,previousSpread=spreadIndex;
        data=await snapshot();bundleCache.clear();
        await switchBookMode(false,async()=>{await renderLibrary();if(selected===previousActor){spreadIndex=Math.min(previousSpread,pageTextures.length/2-1);paint();controls();}prepare(spreadIndex);});
        if(destroyed)return;scoutingView.destroy();scoutingView=null;scoutingHost.remove();scoutingHost=null;root.dataset.bookMode='people';input.value=query;input.placeholder='搜索人物';input.setAttribute('aria-label','搜索人物');syncBookTabs();controls();}

    }catch(error){notice.textContent=error.message;if(scoutingHost){scoutingView?.destroy();scoutingView=null;scoutingHost.remove();scoutingHost=null;}root.querySelector('.dn-book-unit').hidden=false;root.querySelector('.dn-book-unit').style.visibility='visible';root.querySelector('.dn-book-unit').inert=false;root.dataset.bookMode='people';input.value=query;input.placeholder='搜索人物';input.setAttribute('aria-label','搜索人物');syncBookTabs();delete root.dataset.bookChanging;}
    finally{modeBusy=false;input.disabled=userMode&&!scoutingView;}
  }
  function syncBookTabs(){
    const inScouting=Boolean(scoutingView);
    const user=data.characters.find(x=>x.userRecords),userButton=toolbar.querySelector('[data-action="user"]');userButton.textContent=user?.name??'玩家';userButton.title=user?`${user.name}的笔记`:'玩家笔记';userButton.setAttribute('aria-label',user?`打开${user.name}自己的笔记`:'打开玩家自己的笔记');userButton.disabled=!user;collection.hidden=inScouting||userMode;toolbar.querySelector('input').disabled=userMode&&!inScouting;root.dataset.bookMode=inScouting?'scouting':userMode?'user':'people';
    for(const [action,current]of [['people',!inScouting&&!userMode&&!album],['user',!inScouting&&userMode],['album',!inScouting&&!userMode&&album],['scout',inScouting]])toolbar.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed',String(current));
    toolbar.closest('.routine-scene')?.dispatchEvent(new win.CustomEvent('hypno:toolbar-change')); 
  }
  async function selectBookTab(action){
    if(modeBusy||bookSwitcher.isBusy())return;
    if(action==='scout'){if(!scoutingView)await openScouting();syncBookTabs();return;}
    const wantsUser=action==='user'&&(!userMode||Boolean(scoutingView));
    if(wantsUser&&!data.characters.some(x=>x.userRecords))return;
    let restoreSpread=0;
    if(wantsUser&&!userMode){peoplePosition={selected,volume,album,query,spreadIndex};userMode=true;restoreSpread=userSpread;}
    else if(!wantsUser&&userMode){userSpread=spreadIndex;userMode=false;if(peoplePosition){({selected,volume,album,query}=peoplePosition);restoreSpread=peoplePosition.spreadIndex;}if((action==='album'&&!album)||(action==='people'&&album)){album=action==='album';volume=0;restoreSpread=0;}}
    else if(!wantsUser){const wantsAlbum=action==='album';if(album!==wantsAlbum){album=wantsAlbum;volume=0;}else if(!scoutingView){syncBookTabs();return;}}
    if(scoutingView){await openScouting();if(restoreSpread){spreadIndex=Math.max(0,Math.min(restoreSpread,pageTextures.length/2-1));paint();controls();}}
    else await renderLibrary({changeBook:true,restoreSpread});
    toolbar.querySelector('input').value=query;syncBookTabs();
  }
  async function openDetective(kind='investigate',id=''){try{if(!onOpenDetective)throw Error('委托柜台接口未连接');await onOpenDetective(kind,id);}catch(error){notice.textContent=error.message;}}
  async function transact(work) { notice.textContent = ""; try { const id = selected, page = spreadIndex; await work(); data = await snapshot(); bundleCache.clear(); await renderLibrary(); if (selected === id) { spreadIndex = Math.min(page, pageTextures.length / 2 - 1); paint(); controls(); } } catch (error) { notice.textContent = error.message; } }
  root.querySelector("input").addEventListener("input", (event) => { if(scoutingView){void scoutingView.setQuery(event.target.value);return;} query = event.target.value; volume = 0; void renderLibrary(); });
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if(modeBusy&&action!=="close")return;
    if (action === "close") onClose();
    else if (action === "detective") void openDetective();
    else if (['people','scout','album','user'].includes(action)) void selectBookTab(action);
    else if (action.endsWith("volume")&&!userMode&&!scoutingView&&!bookSwitcher.isBusy()) { volume += action === "next-volume" ? 1 : -1; void renderLibrary({ changeBook: true }); }
    else if (action.endsWith("page")) turnPage(action === "next-page" ? 1 : -1);
    else if (action === "favourite" && selected && !button.hidden) void transact(() => favourite(selected));
    else if (action === "investigate" && selected && investigate) void transact(() => investigate(selected));
  }));
  root.querySelectorAll('.dn-photo-zone').forEach(button=>button.addEventListener('click',()=>void showGallery(button.classList.contains('standee')?'standee':'portrait')));
  const wanted = data.characters.find((x) => x.name === initialRole || x.id === initialRole); if (wanted) { selected = wanted.id;userMode=Boolean(wanted.userRecords);if(!userMode)volume = Math.floor(libraryRows().findIndex((x) => x.id === wanted.id) / 6); }
  fit(); await renderLibrary(); syncBookTabs();win.addEventListener("resize", fit);doc.addEventListener("hypno:scene-fit",fit);
  const key = (event) => { if (scoutingView || modeBusy || event.target.tagName === "INPUT") return; if (event.key === "Escape") onClose(); if (event.key === "ArrowRight") turnPage(1); if (event.key === "ArrowLeft") turnPage(-1); }; root.addEventListener("keydown", key);toolbarDock=dockSceneToolbar(doc,toolbar);if(toolbarDock.docked)toolbar.addEventListener("keydown",key);fit();
  const view={ root, openScouting:()=>scoutingView?Promise.resolve():openScouting(), refresh: async () => { if(scoutingView){await scoutingView.refresh();return;} if (turn || root.dataset.bookChanging) return; const next = await snapshot(); if (JSON.stringify(next) === JSON.stringify(data)) return; const id = selected, page = spreadIndex; data = next; bundleCache.clear(); await renderLibrary(); if (selected === id) { spreadIndex = Math.min(page, pageTextures.length / 2 - 1); paint(); controls(); } }, resize: fit, inspectTurn(progress,direction=1) { if (progress <= 0) { cancelTurn(); paint(); return; } if (!turn) begin(direction); drawTurn(progress); }, destroy() { floatingDrag.destroy(); destroyed = true; bookSwitcher.destroy(); scoutingView?.destroy(); scoutingHost?.remove(); galleryView?.destroy(); galleryHost?.remove(); bookSwap++; cancelTurn(); curved?.destroy(); doc.removeEventListener("pointermove", dragMove); doc.removeEventListener("pointerup", releaseDrag); doc.removeEventListener("pointercancel", releaseDrag); win.removeEventListener("blur", releaseDrag); win.removeEventListener("resize", fit);doc.removeEventListener("hypno:scene-fit",fit); for (const url of urls) URL.revokeObjectURL(url); root.remove(); } };
  const lifecycle=surfaceLifecycle(doc,stage,toolbarDock,view.destroy);return {...view,...lifecycle};
}
