export const INVENTORY_PAGE_SIZE=8;
export function inventoryItems(rows){return (rows??[]).filter(x=>x&&String(x.name??'').trim()&&Number.isFinite(Number(x.count))&&Number(x.count)>0).map(x=>({name:String(x.name),count:Math.floor(Number(x.count)),description:String(x.description??'')})).filter(x=>x.count>0);}
