import { notebookValueRows } from './notebook-model.mjs';

export function notebookMeter(field) {
  if (typeof field.value !== 'number') return null;
  if(field.unit==='日元'||['现金','随身现金'].includes(field.label))return null;
  const stateKnown=/性欲|快感/.test(field.label),sensitivity=/敏感度/.test(field.label),known=/好感|警戒|配合|服从/.test(field.label)||stateKnown||sensitivity;
  const min = Number.isFinite(field.min) ? field.min : known ? 0 : null;
  const max = Number.isFinite(field.max) ? field.max : sensitivity ? 1000 : stateKnown ? 200 : known ? 100 : null;
  if (min == null || max == null || max <= min) return null;
  return { min, max, value: field.value, fraction: Math.max(0, Math.min(1, (field.value - min) / (max - min))), zero: Math.max(0, Math.min(1, -min / (max - min))) };
}
export function notebookReleaseTarget(progress) { return Number.isFinite(progress) && progress >= .5; }
export function notebookAdjacent(characters, selected, direction) {
  const index = characters.findIndex(x => x.id === selected);
  return index < 0 ? null : characters[index + direction] ?? null;
}
const valueText = value => value == null || value === '' ? '暂无' : typeof value === 'boolean' ? value ? '是' : '否' : String(value);
export function notebookCards(group) {
  const cards = [], byPath = new Map();
  for (const field of group.fields) {
    if (field.path?.length) {
      const key = field.path.join("\u0000");
      if (!byPath.has(key)) { const card = { title: field.path.at(-1), source: field.path.slice(0, -1).join(" / "), details: [] }; byPath.set(key, card); cards.push(card); }
      const card = byPath.get(key);
      card.details.push(...notebookValueRows({ ...field, path: [] }).map(row => `${row.label}：${row.value}`));
      continue;
    }
    const value = field.value;
    const entries = value && typeof value === 'object' ? Object.entries(value) : [];
    if (!entries.length) { cards.push({ title: field.label, details: [value && typeof value === 'object' ? '暂无' : valueText(value) + (field.unit ?? '')] }); continue; }
    for (const [key, item] of entries) {
      const title = Array.isArray(value) ? item?.名称 ?? item?.name ?? `${field.label} ${Number(key) + 1}` : key;
      const details = notebookValueRows({ label: '', value: item }).map(row => `${row.label.replace(/^ \/ /, '').trim()}${row.label.trim() ? '：' : ''}${row.value}`);
      cards.push({ title: String(title), details, source: field.label });
    }
  }
  return cards;
}

// Every block carries its measured height; special presentation never drops source values.
export function designNotebookPages(group, wrap, capacity = 432) {
  const kind = /物品|持有|库存/.test(group.label) ? 'items' : /事件|记录|记忆|日程/.test(group.label) ? 'records' : /效果/.test(group.label) ? 'effects' : 'fields';
  const blocks = [];
  function textBlocks(title, text, style = kind, extra = {}) {
    const lines = wrap(text || '暂无', style === 'items' ? 'card' : 'body');
    const titleLines = wrap(title, style === 'effects' ? 'effect-title' : style === 'items' ? 'card-title' : 'label');
    const lineHeight = style === 'items' ? 26 : 30, top = titleLines.length * 26 + 22;
    const maxLines = Math.max(1, Math.floor((capacity - top - (style === 'items' ? 12 : 0)) / lineHeight));
    for (let i = 0; i < lines.length; i += maxLines) {
      const part = lines.slice(i, i + maxLines);
      blocks.push({ style, title: title + (i ? ' · 续' : ''), titleLines, lines: part, height: Math.max(style === 'items' ? 104 : 64, top + part.length * lineHeight), ...extra });
    }
  }
  if (kind === 'items' || kind === 'effects') {
    for (const card of notebookCards(group)) textBlocks(card.title, card.details.join('\n'), kind, { source: card.source });
  } else {
    for (const field of group.fields) {
      if(field.namePresentation?.nickname){
        const originalLines=wrap(field.namePresentation.original,'body'),nicknameLines=wrap(field.namePresentation.nickname,'body'),titleLines=wrap(field.label,'label');
        const perPage=Math.max(1,Math.floor((capacity-26*titleLines.length-30*originalLines.length-24)/34));
        for(let i=0;i<nicknameLines.length;i+=perPage){const part=nicknameLines.slice(i,i+perPage);blocks.push({style:'nickname-name',title:field.label,titleLines,originalLines,nicknameLines:part,accepted:field.namePresentation.accepted,lines:[field.namePresentation.original+'（划去）',...part],height:26*titleLines.length+30*originalLines.length+34*part.length+24});}continue;
      }
      const meter = notebookMeter(field);
      if (kind === 'fields' && meter) { blocks.push({ style: 'meter', title: field.label, titleLines: wrap(field.label, 'label'), lines: [String(field.value)], meter, height: 86 }); continue; }
      for (const row of notebookValueRows(field)) {
        const title = row.label.replace(/ \/ 第(\d+)项$/, ' · $1');
        textBlocks(title, row.value, kind, { rawValue: row.value });
      }
    }
  }
  const pages = []; let entries = [], height = 0;
  const flush = () => { if (!entries.length) return; pages.push({ title: group.label, chapter: group.label, kind, blocks: entries, lines: entries.map(x => `${x.title}：${x.lines.join('')}`) }); entries = []; height = 0; };
  if (kind === 'items') {
    for (let i = 0; i < blocks.length; i += 2) {
      const pair = blocks.slice(i, i + 2), size = Math.max(...pair.map(x => x.height)) + 12;
      if (height + size > capacity) flush();
      entries.push({ style: 'item-pair', cards: pair, height: size, title: pair.map(x => x.title).join('、'), lines: pair.flatMap(x => x.lines) }); height += size;
    }
  } else {
    for (const block of blocks) { if (height + block.height > capacity) flush(); entries.push(block); height += block.height; }
  }
  flush();
  if (!pages.length) pages.push({ title: group.label, chapter: group.label, kind, blocks: [], lines: [] });
  return pages;
}

export function designAffinityPages(events, wrap, capacity=432){
  const pages=[];let blocks=[],height=0;const flush=()=>{if(blocks.length)pages.push({title:'事件',chapter:'事件',kind:'affinity',blocks,lines:blocks.map(x=>x.title+' '+x.date+' '+x.lines.join(''))});blocks=[];height=0;};
  for(const event of events){const lines=wrap(event.description||'','body'),titleLines=wrap(event.name,'label'),max=Math.max(1,Math.floor((capacity-94-titleLines.length*26)/30));
    for(let i=0;i<Math.max(1,lines.length);i+=max){const part=lines.slice(i,i+max),size=94+titleLines.length*26+part.length*30;if(height+size>capacity)flush();blocks.push({style:'affinity',title:event.name,titleLines,lines:part,date:event.date+' '+event.start,status:event.status==='occurred'?'已发生':'已预约',height:size});height+=size;}
  }flush();return pages;
}
