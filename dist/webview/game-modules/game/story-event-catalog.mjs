export const STORY_EVENT_OUTPUT_CONTRACT=`事件只由前端规则预约尚未发送的空日程格，每个事件独占一格。阈值满足或预约不代表已发生；只有该格成功发送后，脚本才记录完成、解锁或发放物品。正文只执行本次玩家日程中story-event动作携带的少量hiddenPrompt，不自行创建事件、补旧好感链、修改事件记录或重复发奖。story-monitor与story-day-end只在警视厅线1已发送且线2未发送时生效：有内容的格伴随九鬼真白监视，当日最后格由她出现并殴打{{user}}；线2发送后终止。劣迹、改造和隐藏灵异线未完待续，不因旧变量、医院线2或警视厅线2开放。用户自己的事件与人物事件采用同一格预约机制；成就与任务仍由各自独立对象和奖励事务维护。`;

export const STORY_EVENT_DEFINITIONS=[
 {id:'police-1',name:'警视厅线1',ownerNames:['{{user}}'],priority:10,
  when:{path:'/user/suspicion',op:'gte',value:100},
  hiddenPrompt:'本格触发警视厅线1：九鬼真白以警视厅对催眠APP特务人员身份出现，开始关注{{user}}。只写这次登场与当下反应，不额外推进日程。',
  effects:{characters:['九鬼真白'],flags:{police1:true},items:[],unlocks:[]}},
 {id:'police-2',name:'警视厅线2',ownerNames:['{{user}}'],priority:20,
  when:{all:[{path:'/completed/police-1',op:'eq',value:true},{path:'/characters/九鬼真白/obedience',op:'gte',value:100}]},
  hiddenPrompt:'本格触发警视厅线2：九鬼真白停止持续监视{{user}}。之后不再附加监视、末格殴打或两秒秒杀机制；劣迹相关功能仍未完待续。',
  effects:{characters:[],flags:{police2:true},items:[],unlocks:[]}},
 {id:'hospital-1',name:'医院线1',ownerNames:['犬冢夏美'],priority:30,
  when:{path:'/characters/犬冢夏美/affection',op:'gte',value:100},
  hiddenPrompt:'本格触发医院线1：夏美强拉{{user}}去综合医院见母亲犬冢穗波，偶遇护士天城纱良，被纱良误当成病人扎了一针。只承接这段已指定情节，不额外安排后续事件。',
  effects:{characters:['犬冢穗波','天城纱良'],flags:{hospital1:true},items:[],unlocks:[]}},
 {id:'hospital-2',name:'医院线2',ownerNames:['犬冢穗波','天城纱良'],priority:40,
  when:{all:[{path:'/completed/hospital-1',op:'eq',value:true},{path:'/characters/犬冢穗波/obedience',op:'gte',value:100},{path:'/characters/天城纱良/obedience',op:'gte',value:100}]},
  hiddenPrompt:'本格触发穗波与纱良的共同事件医院线2。具体后续情节尚未定义，只承接当前已有剧情，不自行增添场景；改造功能暂不开放。',
  effects:{characters:[],flags:{hospital2:true},items:[],unlocks:[]}},
];
export const LOCKED_STORY_FEATURES=['劣迹','改造','隐藏灵异线'];
