export function drawNotebookPageButton(ctx,{x,y,width,height=50,label,kind='outline',disabled=false,fontSize=22}) {
  ctx.save();ctx.globalAlpha=disabled?.25:1;
  if(kind==='star'){ctx.fillStyle='#a57e44';ctx.font='38px "Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+width/2,y+height/2);}
  else if(kind==='arrow'){ctx.fillStyle='#856442';ctx.font='26px "Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+width/2,y+height/2);}
  else{ctx.fillStyle='#d6b68821';ctx.fillRect(x,y,width,height);ctx.strokeStyle='#a7835966';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(x+.5,y+.5,width-1,height-1);ctx.setLineDash([]);ctx.fillStyle='#98634e';ctx.font=fontSize+'px "Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+width/2,y+height/2,width-20);}
  ctx.restore();
}
