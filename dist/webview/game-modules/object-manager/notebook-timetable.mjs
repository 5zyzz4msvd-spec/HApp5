import { resolveScheduleDay } from './schedule.mjs';
import { overlayScheduleRows } from './personnel-business.mjs';
import { PERSONNEL_TIME_SLOTS, fixedPersonnelRows } from './personnel-time-grid.mjs';
const labels={monday:'一',tuesday:'二',wednesday:'三',thursday:'四',friday:'五',saturday:'六',sunday:'日'};
export function designTimetablePages(schedule,{calendar={},dateOverrides=[],locations=[],name='',wrap}){
  const cells={};
  for(const day of Object.keys(labels)){
    const source=schedule?resolveScheduleDay(schedule,{weekday:day,holidayId:day===calendar?.weekday?calendar.holidayId??'':''}):{entries:[]};
    const rows=fixedPersonnelRows(source,{defaultLocation:schedule?.defaultLocation??schedule?.emptyPolicy?.location,name});
    const effective=day===calendar?.weekday?overlayScheduleRows(rows,dateOverrides):rows;
    cells[day]=PERSONNEL_TIME_SLOTS.map(slot=>{const matched=effective.filter(x=>x.start<slot.end&&x.end>slot.start),special=matched.find(x=>x.id.startsWith('affinity')||['跟踪','潜入'].includes(x.note)),row=special??matched[0];const text=row?.note??'空闲';return{label:text,note:text,location:locations.find(x=>x.id===row?.location?.id)?.name??'未指定地点',special:Boolean(special),lines:wrap(text,'grid-cell').slice(0,2)};});
  }
  const days=Object.keys(labels);
  return [0,1].map(wideSide=>({title:'一周日程',chapter:'日程',kind:'week-grid',days,cells,labels,wide:true,wideSide,table:true,lines:days.flatMap(day=>cells[day].map((x,i)=>'周'+labels[day]+' '+PERSONNEL_TIME_SLOTS[i].start+'—'+PERSONNEL_TIME_SLOTS[i].end+' '+x.note+' / '+x.location))}));
}
export function drawTimetable(ctx,model,{x=34,y=124,width=402}={}){
  if(!model.days)return;if(model.wide){ctx.save();ctx.beginPath();ctx.rect(0,0,470,620);ctx.clip();ctx.translate(model.wideSide?-470:0,0);width=872;}const timeWidth=63,cw=(width-timeWidth)/model.days.length,header=33,rowHeight=36,top=y;
  ctx.fillStyle='#b79c662c';ctx.fillRect(x,top,width,header);ctx.font='22px "Songti SC",serif';ctx.fillStyle='#735a39';ctx.fillText('时段',x+8,top+24);ctx.textAlign='center';model.days.forEach((day,i)=>ctx.fillText('周'+model.labels[day],x+timeWidth+cw*(i+.5),top+24));ctx.textAlign='left';
  for(const [index,slot]of PERSONNEL_TIME_SLOTS.entries()){
    const rowY=top+header+index*rowHeight;ctx.fillStyle=index%2?'#ad987312':'#ffffff08';ctx.fillRect(x,rowY,width,rowHeight);ctx.font='16px Georgia,serif';ctx.fillStyle='#998165';ctx.fillText(slot.start,x+7,rowY+15);ctx.fillText(slot.end,x+7,rowY+31);
    for(const [i,day]of model.days.entries()){const cell=model.cells[day][index],cx=x+timeWidth+cw*i;if(cell.special){ctx.fillStyle='#aa77521c';ctx.fillRect(cx,rowY,cw,rowHeight);ctx.fillStyle='#a9795e';ctx.fillRect(cx,rowY+5,2,rowHeight-10);}ctx.font='18px "Songti SC",serif';ctx.fillStyle=cell.special?'#8c543e':'#66513a';ctx.textAlign='center';for(const[j,text]of cell.lines.entries())ctx.fillText(text,cx+cw/2,rowY+(cell.lines.length===1?24:15+j*17),cw-9);ctx.textAlign='left';}
    ctx.strokeStyle='#b09a785e';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,rowY+rowHeight);ctx.lineTo(x+width,rowY+rowHeight);ctx.stroke();
  }
  const height=header+PERSONNEL_TIME_SLOTS.length*rowHeight;ctx.strokeStyle='#ac947163';ctx.lineWidth=.7;for(let i=0;i<=model.days.length;i++){const col=x+timeWidth+cw*i;ctx.beginPath();ctx.moveTo(col,top);ctx.lineTo(col,top+height);ctx.stroke();}ctx.strokeRect(x,top,width,height);if(model.wide)ctx.restore();
}
