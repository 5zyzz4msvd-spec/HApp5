const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const mix = (a,b,t) => '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');
export function notebookMeterAppearance(label,fraction,negative=false){
  const f=clamp(fraction);let kind='star',color='#607d6a';
  if(/敏感度/.test(label)){kind='sensitivity';const stops=[[83,142,138],[111,116,173],[177,100,142],[195,92,76]],part=Math.min(2,Math.floor(f*3));color=mix(stops[part],stops[part+1],f*3-part);}
  else if(/性欲/.test(label)){kind='desire';color=mix([184,143,86],[165,76,60],f);}
  else if(/快感/.test(label)){kind='pleasure';color=mix([124,132,173],[153,88,152],f);}
  else if(/好感/.test(label)){kind='heart';color='#995767';}
  else if(/警戒/.test(label)){kind='eye';color='#aa8141';}
  return {kind,color:negative?'#888176':color};
}
function band(ctx,x,y,w,h,color,fraction){
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,h/2);ctx.strokeStyle='#a28b6859';ctx.lineWidth=1.1;ctx.stroke();ctx.clip();
  ctx.beginPath();ctx.rect(x,y,w*clamp(fraction),h);ctx.clip();const wash=ctx.createLinearGradient(x,y,x+w*clamp(fraction),y+h);wash.addColorStop(0,color+'38');wash.addColorStop(.6,color+'80');wash.addColorStop(1,color+'cc');ctx.fillStyle=wash;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=color+'82';ctx.lineWidth=1;for(let i=-h;i<w;i+=4){ctx.beginPath();ctx.moveTo(x+i,y+h);ctx.lineTo(x+i+h*.6,y);ctx.stroke();}ctx.restore();
}
export function drawDesireMeter(ctx,x,y,w,f,color){
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(14,29);ctx.bezierCurveTo(-3,26,0,14,10,7);ctx.quadraticCurveTo(15,3,14,0);ctx.bezierCurveTo(29,13,29,27,14,29);ctx.closePath();ctx.fillStyle=color+'25';ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(14,26);ctx.bezierCurveTo(7,23,10,16,16,13);ctx.quadraticCurveTo(20,22,14,26);ctx.fillStyle=color+(f?'a0':'30');ctx.fill();ctx.restore();
  band(ctx,x+39,y+6,w-40,18,color,f);
  ctx.strokeStyle='#a78b6860';ctx.lineWidth=.8;for(let i=0;i<=8;i++){const px=x+39+(w-40)*i/8;ctx.beginPath();ctx.moveTo(px,y+27);ctx.lineTo(px,y+(i%2?30:33));ctx.stroke();}
}
export function drawPleasureMeter(ctx,x,y,w,f,color){
  ctx.save();ctx.translate(x,y);const amplitude=3+clamp(f)*3;
  function waves(){for(let line=0;line<3;line++){ctx.beginPath();for(let px=0;px<=w;px+=2){const py=7+line*9+Math.sin(px/19+line*.7)*amplitude;if(px)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.stroke();}}
  ctx.lineWidth=1;ctx.strokeStyle='#a999bd50';waves();ctx.save();ctx.beginPath();ctx.rect(0,-2,w*clamp(f),38);ctx.clip();ctx.lineWidth=1.7;ctx.strokeStyle=color;waves();ctx.restore();
  const end=w*clamp(f);ctx.fillStyle=color+'70';ctx.beginPath();ctx.arc(end,16,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color+'70';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(end,16,9,14,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
export function drawSensitivityMeter(ctx,x,y,w,f,color){
  band(ctx,x,y+5,w,21,color,f);ctx.save();ctx.translate(x,y);ctx.strokeStyle='#b0957170';ctx.lineWidth=.8;
  for(let i=1;i<5;i++){const px=w*i/5;ctx.beginPath();ctx.moveTo(px,30);ctx.lineTo(px+2,32);ctx.lineTo(px,34);ctx.lineTo(px-2,32);ctx.closePath();ctx.stroke();}
  const end=w*clamp(f);ctx.fillStyle='#f8edda';ctx.strokeStyle=color;ctx.lineWidth=1;
  for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;ctx.save();ctx.translate(end+Math.cos(a)*5,15+Math.sin(a)*5);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,0,4.6,2.8,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(end,15,2,0,Math.PI*2);ctx.fill();ctx.restore();
}
