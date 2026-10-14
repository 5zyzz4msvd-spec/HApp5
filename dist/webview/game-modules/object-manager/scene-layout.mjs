// Keep each original PNG intact. Galgame framing extends the lower body behind the bottom workspace.
export function sceneStandeeLayout(entries, { width: stageWidth = 1280, height: stageHeight = 720, occlusionBottom = stageHeight + 24, referenceHeightCm = 204, referenceWidthCm = 168 } = {}) {
  const count = entries.length;
  if (!count) return [];
  const margin = 36;
  // Reference the whole scene roster, never the currently selected subset.
  const pixelsPerCm=Math.max(.001,Math.min(stageHeight*1.62/referenceHeightCm,(stageWidth-margin*2)/referenceWidthCm));
  const bodyWidthCm = entry => entry.heightCm * (entry.geometry.bounds[2] - entry.geometry.bounds[0]) / (entry.geometry.bounds[3] - entry.geometry.bounds[1]);
  const widest=Math.max(...entries.map(entry=>bodyWidthCm(entry)*pixelsPerCm));
  const ground = Math.max(occlusionBottom,24+referenceHeightCm*pixelsPerCm);
  return entries.map((entry,index) => {
    const g = entry.geometry;
    const visibleHeight = entry.heightCm * pixelsPerCm;
    const height = visibleHeight / ((g.bounds[3] - g.bounds[1]) / g.height);
    const width = height * g.width / g.height;
    const center=count===1?stageWidth/2:margin+widest/2+(stageWidth-margin*2-widest)*index/(count-1);
    const left = center-bodyWidthCm(entry)*pixelsPerCm/2-width*g.bounds[0]/g.width;
    const top = ground - height * g.bounds[3] / g.height;
    return { ...entry, width, height, left, top, visibleHeight, ground: top + height * g.bounds[3] / g.height };
  });
}
