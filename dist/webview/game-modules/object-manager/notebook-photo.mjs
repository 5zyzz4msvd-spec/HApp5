import { notebookPhotoSources } from './notebook-model.mjs';

export function notebookGallery(actor, asset, mode, resolveFile) {
  const selection = actor.imageSelection ?? { mode: 'portrait', portrait: 0, standee: 0 };
  mode ??= selection.mode === 'standee' ? 'standee' : 'portrait';
  const files = Array(8).fill(null);
  notebookPhotoSources(asset, actor.media, mode, resolveFile).slice(0, 8).forEach((file, i) => { files[i] = file; });
  if(asset?.presentationMode==='joint')return {mode,files,index:0};
  for (const ref of actor.images ?? []) if (ref.usage === mode || mode === 'portrait' && ref.usage === 'gallery') {
    const index = files.findIndex(x => x === null);
    if (index >= 0) files[index] = { key: ref.path, ref };
  }
  for (const [i, ref] of (actor.sharedAlbum?.[mode] ?? []).entries()) if (ref && i < 8) files[i] = { key: ref.path, ref };
  return { mode, files, index: Math.max(0, Math.min(7, Number(selection[mode]) || 0)) };
}

export function drawNotebookPhoto(ctx, { photo, mode, name = null }) {
  if (name) { ctx.fillStyle = '#493723'; ctx.font = '500 40px "Songti SC",serif'; ctx.fillText(name, 34, 111); }
  const box = mode === 'standee' ? { x: 71, y: 92, w: 328, h: 456 } : { x: 87, y: 181, w: 284, h: 249 };
  if (!photo) {
    ctx.fillStyle = '#b4a185'; ctx.font = '27px "Songti SC",serif';
    ctx.fillText(mode === 'standee' ? '立绘尚未收录' : '胸像尚未收录', 132, 300);
    return;
  }
  const ratio = Math.min(box.w / photo.width, box.h / photo.height);
  if (mode === 'standee') {
    ctx.save(); ctx.shadowColor = '#71563524'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#f8f4e9'; ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24); ctx.restore();
    ctx.fillStyle = '#c8ae7150'; ctx.save(); ctx.translate(box.x + 35, box.y - 8); ctx.rotate(-.14); ctx.fillRect(-35, -8, 70, 17); ctx.restore();
    ctx.save(); ctx.translate(box.x + box.w - 28, box.y + box.h + 8); ctx.rotate(-.12); ctx.fillRect(-34, -8, 68, 16); ctx.restore();
  }
  ctx.save(); ctx.translate(box.x + box.w / 2, box.y + box.h / 2); ctx.rotate(-.012);
  ctx.drawImage(photo, -photo.width * ratio / 2, -photo.height * ratio / 2, photo.width * ratio, photo.height * ratio); ctx.restore();
}
