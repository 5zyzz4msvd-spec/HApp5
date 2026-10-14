import { sharedTwinSpeaker,sharedTwinCast } from './twin-presentation.mjs';
// Plain text protocol. No model-produced HTML is executed.
export const GALGAME_OUTPUT_CONTRACT=`所有正文（包括首楼）使用下面格式，不加代码围栏。可连续输出多个地点段，每段地点决定该段背景，人物名单只列实际在场人物。正文不在演出外重复。
<galgame>
【地点】稳定地点ID或完整地点名
【在场】人物完整原名、人物完整原名
【旁白】场景叙述
【人物】完整原名
【动作】动作
【想法】内心想法（可省略）
【语言】台词（可省略）
【地点】下一个地点
【在场】该地点人物名单
【旁白】下一段叙述
</galgame>
玩家输入的<玩家日程>是唯一行动结算清单。逐格读取cells中的actions、attachments、note及hiddenPrompt，时间只向前，不回溯。系统日期时间应推进到清单的date/end终点；crossDay=true则到下一日00:00，不额外跳日。第一格可从当前时分开始，不倒回整点。type=hypnosis时读取payload.requests：command.title/description决定原功能语义，scope/lifetime决定作用域和时效，targets/objectRef决定精确对象，minutes/number/partLabels/note决定参数，endTime是临时效果的绝对到期故事时间，不能延期或转永久。催眠命令在attachments附属格中，与同格正常actions和备注一起送出，但不占用正常空格。个人催眠的targets.resisted=true表示该目标抵抗成功，不可写催眠成功效果；resisted=false仅表示机制上的抵抗突破，仍需按人设、命令越界程度与剧情条件独立判定，越界依旧可以失败。旧结果没有resisted字段时沿用resistance.success。地点催眠的resistance.required=false，仅判断剧情门禁，未运行小游戏不代表自动成功。只对剧情实际成功的目标结算cost和效果；对象更新沿用原独立对象协议，不在MVU类变量中创建人物。地点规则写所选地点，开放常识可以选当前地点的祖先，封闭空间不可扩张。type=inventory按实际use/discard结果扣物品；type=investigation依人物文件价格安排调查，不因暂存开放档案。跨日只推进一次，上一日只读。
角色手机回复另附<phone_messages>JSON数组，每项只有contactId/name/text，contactId必须沿用玩家消息携带的已知联系人ID；电话中的人物不因此进入当前地点。app-service操作只按其hiddenPrompt返回精确<AppServiceReceipt>，前端控制资源与升级，模型不直接扣同笔费用或写升级文件。
所有可见正文都放入galgame，包括原先要求的固定收束尾段。固定标记可以留在旁白文本中，不能在块外另写可见剧情。
织田信长和明智光秀是始终同行的双胞胎，名字都是代号；每次两人同时说完全一样的话，一句只输出一次。【在场】和【人物】统一用“织田信长 & 明智光秀”，手机回复name也用这个共同名称。不得轮流发言、互相接话、拆开出现或分别移动。
催眠APP不能对双胞胎或林安使用，范围功能也不能将她们作为受影响目标。双胞胎不可调查、不可加入人物卡槽。林安的调查与卡槽资格只由前端检查本地酒馆角色卡名单后开放，不能由剧情宣称或模型更新自行解锁；即使资格开放，催眠APP限制仍不解除。
人物字段可重复形成连续对话；不得替user新增决定。变量更新协议继续放在块外，由原变量更新模型执行。小游戏结果只代表突破抵抗的技术门禁，剧情门禁仍独立判断人设、命令强度、条件、伦理边界和剧情阻力。失败不可写入成功效果；技术成功也不得自动接受极端要求，可拒绝、部分成功或延后，明确实际结果。`;

export function parseDialogue(content,{location='',cast=[]}={}){
 const text=String(content??''),block=text.match(/<galgame>([\s\S]*?)<\/galgame>/i)?.[1];
 const frames=[];let place=location,people=sharedTwinCast(cast),speaker='',guide='',time='';
 if(block!==undefined){
  const fields=[...block.matchAll(/【(地点|时间|教程|在场|旁白|人物|动作|想法|语言)】([\s\S]*?)(?=【(?:地点|时间|教程|在场|旁白|人物|动作|想法|语言)】|$)/g)];
  for(const [,kind,raw]of fields){const value=raw.trim();if(kind==='地点'){place=value;speaker='';people=[];}else if(kind==='时间')time=value;else if(kind==='教程')guide=value;else if(kind==='在场')people=sharedTwinCast(value.split(/[、,，]/).map(x=>x.trim()).filter(Boolean));else if(kind==='人物'){speaker=sharedTwinSpeaker(value);if(speaker&&!people.includes(speaker))people.push(speaker);}else if(value)frames.push({location:place,cast:[...people],speaker:kind==='旁白'?'':speaker,kind,text:value,guide,time});if(!['地点','时间','教程','在场','人物'].includes(kind))guide='';}
 }else{
  // Old floors stay readable without leaking model variable/control blocks.
  const legacy=text.replace(/<(?:UpdateVariable|JSONPatch|update|analysis|thinking|ObjectUpdate|phone_messages|AppServiceReceipt)[^>]*>[\s\S]*?<\/(?:UpdateVariable|JSONPatch|update|analysis|thinking|ObjectUpdate|phone_messages|AppServiceReceipt)>/gi,'').replace(/<StatusPlaceHolderImpl\s*\/>/g,'').replace(/<人物演出>[\s\S]*?<\/人物演出>/g,'').replace(/<[^>]+>/g,'').trim();
  for(const paragraph of legacy.split(/\n\s*\n/).filter(Boolean))frames.push({location:place,cast:[...people],speaker:'',kind:'旁白',text:paragraph});
 }
 return frames;
}
export class DialoguePlayback{
 constructor(){this.floors=[];this.floorId='';this.index=0;this.completed=new Set();this.generating=false;this.closed=false;}
 ingest(floors){const previous=this.floors.at(-1);this.floors=floors.filter(x=>x.frames?.length);const latest=this.floors.at(-1);if(latest&&(!previous||previous.id!==latest.id||previous.signature!==latest.signature)){this.completed.delete(latest.id);this.floorId=latest.id;this.index=0;this.closed=false;}}
 get floor(){return this.floors.find(x=>x.id===this.floorId)??this.floors.at(-1);}
 get frame(){return this.floor?.frames[this.index];}
 get historical(){return this.floor?.id!==this.floors.at(-1)?.id;}
 get canAdvance(){const latest=this.floors.at(-1);return !this.generating&&(!latest||this.completed.has(latest.id));}
 next(){if(!this.floor)return;if(this.index<this.floor.frames.length-1)this.index++;else{this.completed.add(this.floor.id);this.closed=true;}}
 open(id,index=0){const floor=this.floors.find(x=>x.id===id);if(!floor)return;this.floorId=id;this.closed=false;this.index=Math.max(0,Math.min(index,floor.frames.length-1));}
}
