import { drawNotebookCollection } from './notebook-collections.mjs';
const font = (size) => `${size}px "Songti SC","STSong",serif`;
function round(ctx,x,y,w,h,r=5) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
function itemIcon(ctx,title,x,y) {
  ctx.save(); ctx.translate(x,y); ctx.strokeStyle='#8b765b'; ctx.lineWidth=1.5;
  if (/钥匙/.test(title)) {ctx.beginPath();ctx.arc(4,4,4,0,Math.PI*2);ctx.moveTo(7,7);ctx.lineTo(17,17);ctx.lineTo(20,14);ctx.moveTo(13,13);ctx.lineTo(16,10);ctx.stroke();}
  else if (/手册|书|便签/.test(title)) {ctx.strokeRect(0,0,17,21);ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(4,21);ctx.moveTo(8,6);ctx.lineTo(14,6);ctx.moveTo(8,11);ctx.lineTo(14,11);ctx.stroke();}
  else if (/笔/.test(title)) {ctx.beginPath();ctx.moveTo(3,21);ctx.lineTo(5,14);ctx.lineTo(16,1);ctx.lineTo(20,5);ctx.lineTo(9,18);ctx.closePath();ctx.stroke();}
  else {ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(7,0);ctx.lineTo(21,0);ctx.lineTo(21,19);ctx.lineTo(7,19);ctx.lineTo(0,14);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(5,9,1.4,0,7);ctx.stroke();}
  ctx.restore();
}
function itemCard(ctx,card,x,y,w,h) {
  ctx.fillStyle='#d8c29b20';ctx.strokeStyle='#b29b7770';ctx.lineWidth=1;round(ctx,x,y,w,h,4);ctx.fill();ctx.stroke();
  itemIcon(ctx,card.title,x+12,y+16);
  ctx.fillStyle='#55432c';ctx.font=font(24);
  let top=y+32;
  for(const line of card.titleLines){ctx.fillText(line,x+42,top);top+=26;}
  ctx.fillStyle='#857258';ctx.font=font(23);
  for(const line of card.lines){ctx.fillText(line,x+14,top+9);top+=26;}
}
export function drawNotebookBlocks(ctx,model,{x=34,y=132,width=402}={}) {
  let top=y;
  if (!model.blocks?.length) {ctx.fillStyle='#a08c6e';ctx.font=font(26);ctx.fillText(model.emptyText??'暂无记录',x+4,y+32);return;}
  for(const [index,block] of model.blocks.entries()) {
    if(block.style==='collection'){drawNotebookCollection(ctx,block,{x,y:top,width});}
    else if(block.style==='nickname-name') {
      ctx.font=font(23);ctx.fillStyle='#9b8260';let lineY=top+22;
      for(const line of block.titleLines){ctx.fillText(line,x+3,lineY);lineY+=26;}
      ctx.font=font(29);ctx.fillStyle='#948571';
      for(const line of block.originalLines){ctx.fillText(line,x+3,lineY+5);const length=Math.min(width-6,ctx.measureText(line).width);ctx.strokeStyle='#8c6c5599';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+1,lineY-5);ctx.lineTo(x+length+6,lineY-7);ctx.stroke();lineY+=30;}
      ctx.save();ctx.font='32px "Kaiti SC","STKaiti","KaiTi",cursive';ctx.fillStyle=block.accepted?'#4d7566':'#a25f4e';ctx.translate(x+5,lineY+5);ctx.rotate(-.025);
      for(const [i,line]of block.nicknameLines.entries())ctx.fillText(line,0,i*34,width-6);ctx.restore();
    }
    else if(block.style==='meter') {
      const fraction = block.meter.value >= 0 ? Math.max(0, Math.min(1, block.meter.value / block.meter.max)) : Math.max(0, Math.min(1, -block.meter.value / Math.abs(block.meter.min)));
      const appearance=notebookMeterAppearance(block.title,fraction,block.meter.value<0),color=appearance.color;
      ctx.fillStyle='#68533b';ctx.font=font(25);ctx.fillText(block.title,x+2,top+24);
      ctx.textAlign='right';ctx.fillStyle=color;ctx.font='32px Georgia,serif';ctx.fillText(block.meter.value,x+width-2,top+25);ctx.textAlign='left';
      if(appearance.kind==='sensitivity')drawSensitivityMeter(ctx,x+3,top+36,width-6,fraction,color);
      else if(appearance.kind==='desire')drawDesireMeter(ctx,x+3,top+36,width-6,fraction,color);
      else if(appearance.kind==='pleasure')drawPleasureMeter(ctx,x+3,top+36,width-6,fraction,color);
      else for (let i=0;i<10;i++) pencilMark(ctx,x+3+i*40,top+36,34,Math.max(0,Math.min(1,fraction*10-i)),color,appearance.kind,i);
    } else if(block.style==='item-pair') {
      for(const [i,card] of block.cards.entries()) itemCard(ctx,card,x+i*(width/2+6),top,width/2-6,block.height-12);
    } else if(block.style==='records') {
      const tx=x+37;
      ctx.strokeStyle='#b19a7766';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+12,top+7);ctx.lineTo(x+12,top+block.height-5);ctx.stroke();
      ctx.fillStyle='#99724b';ctx.beginPath();ctx.arc(x+12,top+18,3.5,0,7);ctx.fill();
      ctx.font=font(23);ctx.fillStyle='#947654';let lineY=top+22;
      for(const label of block.titleLines){ctx.fillText(label,tx,lineY);lineY+=26;}
      ctx.font=font(28);ctx.fillStyle='#594631';
      for(const line of block.lines){ctx.fillText(line,tx,lineY+6);lineY+=30;}
    } else if(block.style==='affinity') {
      ctx.fillStyle='#c9979520';ctx.strokeStyle='#b57d6c70';round(ctx,x,top,width,block.height-12,6);ctx.fill();ctx.stroke();
      ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x+16,top+57);ctx.lineTo(x+width-16,top+57);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#9d625c';ctx.font=font(23);ctx.fillText(block.date,x+16,top+28);ctx.textAlign='right';ctx.fillText(block.status,x+width-16,top+28);ctx.textAlign='left';
      ctx.font=font(27);ctx.fillStyle='#644538';let lineY=top+89;for(const text of block.titleLines){ctx.fillText(text,x+18,lineY);lineY+=26;}ctx.font=font(28);ctx.fillStyle='#79634a';for(const text of block.lines){ctx.fillText(text,x+18,lineY+9);lineY+=30;}
    } else if(block.style==='effects') {
      const permanent=/永久|长期|持续/.test(block.source??block.title),ink=permanent?'#755a87':'#71846e';
      ctx.fillStyle=permanent?'#b9a6c021':'#b3c3a321';ctx.strokeStyle=permanent?'#9b819a70':'#98a48270';round(ctx,x,top,width,block.height-10,5);ctx.fill();ctx.stroke();
      ctx.fillStyle=ink;ctx.fillRect(x,top+10,3,block.height-30);
      ctx.save();ctx.translate(x+width-27,top+23);ctx.strokeStyle=ink;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.stroke();if(permanent){ctx.font='18px Georgia,serif';ctx.textAlign='center';ctx.fillStyle=ink;ctx.fillText('∞',0,6);}else{ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,0);ctx.lineTo(5,3);ctx.stroke();}ctx.restore();
      ctx.font=font(24);ctx.fillStyle=ink;let lineY=top+24;
      for(const label of block.titleLines){ctx.fillText(label,x+15,lineY);lineY+=26;}
      ctx.font=font(28);ctx.fillStyle='#594b36';for(const line of block.lines){ctx.fillText(line,x+15,lineY+4);lineY+=30;}
    } else {
      ctx.font=font(23);ctx.fillStyle='#9b8260';let lineY=top+22;
      for(const label of block.titleLines){ctx.fillText(label,x+3,lineY);lineY+=26;}
      ctx.font=font(29);ctx.fillStyle='#594731';for(const line of block.lines){ctx.fillText(line,x+3,lineY+5);lineY+=30;}
      if(index<model.blocks.length-1){ctx.strokeStyle='#bca78340';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+3,top+block.height-5);ctx.lineTo(x+width,top+block.height-5);ctx.stroke();}
    }
    top+=block.height;
  }
}

function markPath(ctx,size,kind){
  ctx.beginPath();if(kind==='heart'){ctx.moveTo(size*.5,size*.92);ctx.bezierCurveTo(-size*.2,size*.44,0,-size*.07,size*.48,size*.21);ctx.bezierCurveTo(size*.92,-size*.06,size*1.14,size*.39,size*.5,size*.92);}
  else if(kind==='eye'){ctx.moveTo(0,size*.48);ctx.quadraticCurveTo(size*.46,-size*.02,size,size*.48);ctx.quadraticCurveTo(size*.5,size*.98,0,size*.48);}
  else{for(let i=0;i<10;i++){const r=i%2?size*.22:size*.48,a=-Math.PI/2+i*Math.PI/5,x=size*.5+Math.cos(a)*r,y=size*.5+Math.sin(a)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}}ctx.closePath();
}
function pencilMark(ctx,x,y,size,fraction,color,kind,seed){
  ctx.save();ctx.translate(x,y);ctx.rotate((seed%3-1)*.035);markPath(ctx,size,kind);ctx.strokeStyle='#9f8b6b9c';ctx.lineWidth=1.3;ctx.stroke();ctx.save();ctx.clip();ctx.beginPath();ctx.rect(0,-5,size*fraction,size+10);ctx.clip();ctx.fillStyle=color+'20';ctx.fillRect(0,0,size,size);ctx.strokeStyle=color;ctx.lineWidth=1.8;for(let i=-size;i<size*2;i+=3){ctx.beginPath();ctx.moveTo(i,-2);ctx.lineTo(i-size*.55,size+2);ctx.stroke();}ctx.strokeStyle=color+'aa';ctx.lineWidth=.6;for(let i=0;i<size;i+=4){ctx.beginPath();ctx.moveTo(-2,i);ctx.lineTo(size+2,i+3);ctx.stroke();}ctx.restore();if(kind==='eye'){ctx.beginPath();ctx.arc(size/2,size*.48,size*.12,0,7);ctx.strokeStyle='#9b876b80';ctx.lineWidth=1;ctx.stroke();}ctx.restore();
}


import { notebookMeterAppearance, drawDesireMeter, drawPleasureMeter, drawSensitivityMeter } from './notebook-meter-art.mjs';
