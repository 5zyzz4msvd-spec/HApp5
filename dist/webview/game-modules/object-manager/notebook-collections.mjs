import { notebookValueRows } from './notebook-model.mjs';
export function paginateNotebookEntries(entries,{chapter,wrap,even=true,emptyText='暂无记录',capacity=432}){
  const pages=[];let blocks=[],height=0;
  const flush=()=>{if(blocks.length)pages.push({title:chapter,chapter,kind:'collection',blocks,lines:blocks.flatMap(x=>[...x.titleLines,...x.metaLines,...x.lines])});blocks=[];height=0;};
  const add=block=>{if(height+block.height>capacity)flush();blocks.push(block);height+=block.height;};
  for(const entry of entries){
    const titleLines=wrap(entry.title,'collection-title'),metadata=wrap([entry.status,entry.time].filter(Boolean).join(' · '),'collection-meta');
    const body=entry.details.flatMap(text=>wrap(String(text),'body'));const continuation=wrap(String(entry.title).slice(0,12)+' · 续','collection-title');
    let remainingTitle=[...titleLines],remainingMeta=[...metadata],offset=0,part=0,bodyPart=0,titleSent=false;
    while(remainingTitle.length>4){const partTitle=remainingTitle.splice(0,4);add({...entry,style:'collection',titleLines:partTitle,metaLines:[],lines:[],height:34+partTitle.length*27,part:part++});}
    while(remainingMeta.length>4){const partMeta=remainingMeta.splice(0,4),partTitle=titleSent?continuation:remainingTitle;titleSent=true;add({...entry,style:'collection',titleLines:partTitle,metaLines:partMeta,lines:[],height:34+partTitle.length*27+partMeta.length*24,part:part++});}
    do{
      const partTitle=titleSent||bodyPart?continuation:remainingTitle,partMeta=bodyPart?[]:remainingMeta,progressHeight=entry.progressRatio!=null&&bodyPart===0?22:0,header=34+partTitle.length*27+partMeta.length*24+progressHeight;
      const count=Math.max(1,Math.floor((capacity-header)/30)),lines=body.slice(offset,offset+count);
      add({...entry,style:'collection',titleLines:partTitle,metaLines:partMeta,lines,progressRatio:bodyPart===0?entry.progressRatio:null,height:Math.max(92,header+lines.length*30),part:part++});offset+=count;bodyPart++;
    }while(offset<body.length);
  }
  flush();if(!pages.length)pages.push({title:chapter,chapter,kind:'collection',blocks:[],lines:[emptyText],emptyText});
  if(even)while(pages.length<2||pages.length%2)pages.push({title:chapter,chapter,kind:'collection',blocks:[],lines:[],emptyText:''});
  return pages;
}
const humanKeys={current:'当前',target:'目标',remaining:'剩余',count:'次数',money:'现金',amount:'数量'};
function valueLines(value){return notebookValueRows({label:'',value}).map(x=>{const label=x.label.replace(/^ \/ /,'').split(' / ').map(key=>humanKeys[key]??key).join(' / ');return(label?label+'：':'')+x.value;});}
export function designChildRecordPages(records,chapter,wrap){
  const entries=records.map(record=>{
    const status=record.completed?(chapter==='成就'?'已达成':'已完成')+(record.claimed?' · 奖励已领取':' · 待领取'):chapter==='成就'?'未达成':record.accepted?'进行中':'未接取';
    const progress=record.progress??{},current=Number(progress.current??progress.当前),target=Number(progress.target??progress.目标);
    const ratio=chapter==='任务'?(record.completed?1:Number.isFinite(current)&&target>0?Math.max(0,Math.min(1,current/target)):null):null;
    const details=[record.description,record.conditionText&&'目标：'+record.conditionText,...(Object.keys(progress).length?valueLines(progress):[]),...(Object.keys(record.rewards??{}).length?['奖励',...valueLines(record.rewards)]:[])].filter(Boolean);
    return{title:record.name,status,details,variant:chapter==='任务'?'task':'achievement',progressRatio:ratio,completed:record.completed};
  });
  return paginateNotebookEntries(entries,{chapter,wrap,emptyText:'暂无'+chapter});
}
export function drawNotebookCollection(ctx,block,{x,y,width}){
  const ink=block.variant==='task'?'#658189':block.variant==='achievement'?'#a2844f':block.variant==='temporary'?'#73806a':block.variant==='permanent'?'#886e91':'#987c62';
  ctx.fillStyle=ink+'13';ctx.strokeStyle=ink+'64';ctx.lineWidth=.9;ctx.beginPath();ctx.roundRect(x,y,width,block.height-10,5);ctx.fill();ctx.stroke();
  const ix=x+20,iy=y+24;ctx.save();ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.2;
  if(block.variant==='task'){ctx.strokeRect(ix-6,iy-7,12,14);if(block.completed){ctx.beginPath();ctx.moveTo(ix-4,iy);ctx.lineTo(ix,iy+3);ctx.lineTo(ix+5,iy-4);ctx.stroke();}}
  else if(block.variant==='achievement'){for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(ix+Math.cos(a)*8,iy+Math.sin(a)*8,3.6,2.1,a,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.arc(ix,iy,4,0,Math.PI*2);ctx.stroke();}
  else{ctx.beginPath();ctx.arc(ix,iy,8,0,Math.PI*2);ctx.stroke();if(block.variant==='permanent'){ctx.font='17px Georgia,serif';ctx.textAlign='center';ctx.fillText('∞',ix,iy+5);ctx.textAlign='left';}else{ctx.beginPath();ctx.moveTo(ix,iy-5);ctx.lineTo(ix,iy);ctx.lineTo(ix+4,iy+2);ctx.stroke();}}
  ctx.restore();let top=y+26;ctx.font='24px "Songti SC",serif';ctx.fillStyle='#655038';for(const line of block.titleLines){ctx.fillText(line,x+39,top);top+=27;}
  ctx.font='22px "Songti SC",serif';ctx.fillStyle=ink;for(const line of block.metaLines){ctx.fillText(line,x+16,top+2);top+=24;}
  if(block.progressRatio!=null){ctx.fillStyle=ink+'28';ctx.fillRect(x+16,top+2,width-32,5);ctx.fillStyle=ink+'b0';ctx.fillRect(x+16,top+2,(width-32)*block.progressRatio,5);top+=22;}
  ctx.font='27px "Songti SC",serif';ctx.fillStyle='#7b674e';for(const line of block.lines){ctx.fillText(line,x+16,top+3);top+=30;}
}
