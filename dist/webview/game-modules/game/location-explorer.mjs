import { patchHtml } from '../phone-v2/dom-patch.mjs';
import { CREDIT } from './credits.mjs';
import { locationExplorerModel, locationImageFile } from './location-explorer-model.mjs';
import { LOCATION_EXPLORER_STYLE } from './location-explorer-style.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export async function mountLocationExplorer(container, { runtime, locationId='map-world', currentLocation=null, resolveFile=x=>x, onMove=async()=>{}, canMove=()=>true }) {
  const doc = container.ownerDocument, root = doc.createElement('section'), style = doc.createElement('style');
  root.className = 'location-explorer'; style.textContent = LOCATION_EXPLORER_STYLE; container.append(style, root);
  let locations = await runtime.availableLocations(), selectedId = currentLocation?.id ?? locationId,
    expanded = [], query = '', notice = '', moving = false, disposed = false;
  const failedImages = new Set();
  const model = (expandSelection=false) => locationExplorerModel(locations, { selectedId, currentId: currentLocation?.id, expanded, expandSelection });
  expanded=[...model(true).expanded];

  function treeRow(place, depth, state) {
    const branch = place.children.length > 0, open = state.expanded.has(place.id);
    return `<li id="location-node-${esc(place.id)}"><div class="location-tree-row" style="--depth:${depth}" data-selected="${state.selected?.id === place.id}">
      ${branch ? `<button type="button" class="location-toggle" data-toggle="${esc(place.id)}" aria-expanded="${open}" aria-label="${open?'收起':'展开'}${esc(place.name)}">${open?'⌄':'›'}</button>` : '<span class="location-toggle-space"></span>'}
      <button type="button" class="location-tree-choice" data-select="${esc(place.id)}" ${state.selected?.id===place.id?'aria-current="page"':''}><span>${esc(place.name)}</span>${currentLocation?.id===place.id?'<i class="location-current-dot" aria-label="当前位置"></i>':''}</button></div>
      ${branch && open ? `<ul>${place.children.map(ref => treeRow(state.forest.nodes.get(ref.id).object, depth+1, state)).join('')}</ul>` : ''}</li>`;
  }

  function render() {
    if (disposed) return;
    const state = model(), target = state.selected; selectedId = target?.id; expanded = [...state.expanded];
    const path = target ? state.path(target.id) : [], file = locationImageFile(target), image = failedImages.has(file) ? '' : file, parent = path.at(-2);
    const rows = query.trim() ? state.search(query).map(place => `<li id="location-result-${esc(place.id)}" class="location-search-result"><button type="button" class="location-tree-choice" data-select="${esc(place.id)}" ${selectedId===place.id?'aria-current="page"':''}><span>${esc(place.name)}</span><small>${esc(state.path(place.id).map(x=>x.name).join(' › '))}</small></button></li>`).join('') : state.forest.roots.map(ref => treeRow(state.forest.nodes.get(ref.id).object,0,state)).join('');
    patchHtml(root, `<aside class="location-index"><div class="location-index-heading"><small>PLACES</small><strong>地点目录</strong></div><label class="location-search"><input id="location-search" aria-label="搜索已开放地点" value="${esc(query)}" placeholder="搜索地点"><span aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span></label><nav class="location-tree" aria-label="地点层级"><ul>${rows || '<li class="location-no-results">没有找到已开放地点</li>'}</ul></nav></aside>
      <section class="location-reading"><nav class="location-path" aria-label="地点路径">${path.map(place=>`<button type="button" data-select="${esc(place.id)}" ${place.id===selectedId?'aria-current="page"':''}>${esc(place.name)}</button>`).join('<span aria-hidden="true">›</span>')}</nav>
      <article class="location-description" aria-label="选中地点详情"><div class="location-selected-heading"><div><span class="location-category">${esc(target?.data?.category || '区域')}</span><h2>${esc(target?.name || '暂无开放地点')}</h2></div>${currentLocation?.id===selectedId?'<span class="location-current-label">你在这里</span>':''}</div>
      <figure class="location-selected-picture">${image ? `<img id="location-selected-image" src="${esc(resolveFile(image))}" alt="${esc(target.name)}">` : `<div class="location-picture-empty"><span class="location-monogram" aria-hidden="true">${esc(target?.name?.slice(0,1) || '◇')}</span><small>地点图片待补全</small></div>`}</figure>
      <p class="location-selected-description">${esc(target?.data?.description || '这里的资料尚未补全。')}</p>
      ${target?.children.length?`<section class="location-within"><h3>这里包含 ${target.children.length} 处地点</h3><div class="location-within-list">${target.children.map(ref=>{const child=state.forest.nodes.get(ref.id).object;return `<button type="button" data-select="${esc(child.id)}">${esc(child.name)}<span aria-hidden="true">›</span></button>`;}).join('')}</div></section>`:''}
      ${parent?`<button type="button" class="location-parent-link" data-select="${esc(parent.id)}">↑ 返回${esc(parent.name)}</button>`:''}</article>
      <footer class="location-action"><p role="status">${esc(notice || (currentLocation?.id===selectedId?'当前所在地点':'选择地点查看资料，点击前往后才会移动'))}</p><button type="button" class="location-move" data-move ${!target||moving||!canMove()||currentLocation?.id===selectedId?'disabled':''}>${moving?'正在前往…':'前往这里 →'}</button></footer><div class="location-credit">${CREDIT}</div></section>`);
  }

  function onInput(event) { if (event.target.id==='location-search') { query=event.target.value; render(); } }
  function onImageError(event) { if (event.target.id==='location-selected-image') { failedImages.add(locationImageFile(model().selected)); render(); } }
  async function onClick(event) {
    const button=event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.toggle) {
      const id=button.dataset.toggle, open=new Set(expanded); open.has(id)?open.delete(id):open.add(id); expanded=[...open]; render();
    } else if (button.dataset.select) {
      selectedId=button.dataset.select; expanded=[...model(true).expanded]; notice=''; query=''; render();
    } else if (button.hasAttribute('data-move')) {
      if (moving || !canMove()) return;
      const id=selectedId; moving=true; render();
      try {
        const fresh=await runtime.availableLocations(), destination=fresh.find(place=>place.id===id);
        if (!destination) throw Error('这个地点尚未开放');
        if (disposed || !canMove()) return;
        await onMove(destination); currentLocation=destination; locations=fresh; notice='已到达 '+destination.name;
      } catch(error) { notice=error.message || '移动未完成'; }
      finally { moving=false; render(); }
    }
  }
  root.addEventListener('input',onInput);root.addEventListener('click',onClick);root.addEventListener('error',onImageError,true);render();
  return { root, async refresh() {locations=await runtime.availableLocations();failedImages.clear();expanded=[...model(true).expanded];render();}, destroy() {disposed=true;root.removeEventListener('input',onInput);root.removeEventListener('click',onClick);root.removeEventListener('error',onImageError,true);root.remove();style.remove();} };
}
