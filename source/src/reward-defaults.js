export const DEFAULT_STARLIGHT_REWARD = 5;

export const STARLIGHT_VOUCHER_DESCRIPTION =
  "APP任务奖励道具。VIP5及以上用户可在邂逅商店消耗本券，并以10000零花钱兑换1星光点；仅有零花钱但没有兑换券时不能兑换。";

function starlightReward(items = []) {
  return {
    starlight: DEFAULT_STARLIGHT_REWARD,
    items,
  };
}

function starlightRewardAmount(starlight, items = []) {
  return {
    starlight,
    items,
  };
}

function starlightVoucher(quantity = 1) {
  return {
    name: "星光点兑换券",
    description: STARLIGHT_VOUCHER_DESCRIPTION,
    quantity,
  };
}

function variableCondition(path, operator, value) {
  return {
    path,
    operator,
    value,
    logic: "&&",
    parts: [{ path, operator, value }],
    expression: `${path} ${operator} ${value}`,
  };
}

export const DEFAULT_REWARD_DATABASE = {
  version: 1,
  achievements: [
    {
      id: "ach_main_suspicion_30",
      title: "嫌疑犯",
      description: "主角可疑度达到 30。",
      condition: "系统.主角可疑度 >= 30",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.主角可疑度", ">=", 30),
    },
    {
      id: "ach_main_suspicion_60",
      title: "真凶",
      description: "主角可疑度达到 60。",
      condition: "系统.主角可疑度 >= 60",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.主角可疑度", ">=", 60),
    },
    {
      id: "ach_main_suspicion_100",
      title: "罪不可恕",
      description: "主角可疑度达到 100。",
      condition: "系统.主角可疑度 >= 100",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.主角可疑度", ">=", 100),
    },
    {
      id: "ach_main_money_50000",
      title: "小有资产",
      description: "持有零花钱达到 50000。",
      condition: "系统.持有零花钱 >= 50000",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.持有零花钱", ">=", 50000),
    },
    {
      id: "ach_main_money_500000",
      title: "颇具资产",
      description: "持有零花钱达到 500000。",
      condition: "系统.持有零花钱 >= 500000",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.持有零花钱", ">=", 500000),
    },
    {
      id: "ach_main_mc_energy_max_100",
      title: "能量小子",
      description: "MC能量上限达到 100。",
      condition: "系统.MC能量上限 >= 100",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.MC能量上限", ">=", 100),
    },
    {
      id: "ach_main_mc_energy_max_500",
      title: "催眠小伙能量大",
      description: "MC能量上限达到 500。",
      condition: "系统.MC能量上限 >= 500",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.MC能量上限", ">=", 500),
    },
    {
      id: "ach_main_mc_energy_max_3000",
      title: "能量超人",
      description: "MC能量上限达到 3000。",
      condition: "系统.MC能量上限 >= 3000",
      scope: "self",
      reward: starlightReward(),
      variableCondition: variableCondition("系统.MC能量上限", ">=", 3000),
    },
    {
      id: "ach_human_1",
      title: "也不是不行",
      description: "阿宅好感度达到 100。",
      condition: "角色.阿宅.状态.好感度 >= 100",
      scope: "role",
      reward: starlightReward([starlightVoucher()]),
      variableCondition: variableCondition("角色.阿宅.状态.好感度", ">=", 100),
    },
    {
      id: "ach_human_2",
      title: "兄弟",
      description: "犬冢夏美好感度达到 100。",
      condition: "角色.犬冢夏美.状态.好感度 >= 100",
      scope: "role",
      reward: starlightReward([starlightVoucher()]),
      variableCondition: variableCondition("角色.犬冢夏美.状态.好感度", ">=", 100),
    },
    {
      id: "ach_human_3",
      title: "喜欢二次元的大小姐",
      description: "西园寺爱丽莎好感度达到 100。",
      condition: "角色.西园寺爱丽莎.状态.好感度 >= 100",
      scope: "role",
      reward: starlightReward([starlightVoucher()]),
      variableCondition: variableCondition("角色.西园寺爱丽莎.状态.好感度", ">=", 100),
    },
    {
      id: "ach_human_4",
      title: "大和抚子",
      description: "月咏深雪好感度达到 100。",
      condition: "角色.月咏深雪.状态.好感度 >= 100",
      scope: "role",
      reward: starlightReward([starlightVoucher()]),
      variableCondition: variableCondition("角色.月咏深雪.状态.好感度", ">=", 100),
    },
    {
      id: "ach_line_police_complete",
      title: "超越规则",
      description: "完成警视厅线。",
      condition: "系统._警视厅线 >= 2",
      scope: "self",
      reward: starlightRewardAmount(30),
      variableCondition: variableCondition("系统._警视厅线", ">=", 2),
    },
    {
      id: "ach_line_hospital_complete",
      title: "非道德企划",
      description: "完成医院线。",
      condition: "系统._医院线 >= 2",
      scope: "self",
      reward: starlightRewardAmount(30),
      variableCondition: variableCondition("系统._医院线", ">=", 2),
    },
    {
      id: "ach_line_ghost_complete",
      title: "\"月咏深雪\"",
      description: "完成隐藏线。",
      condition: "系统._灵异线 >= 2",
      scope: "self",
      reward: starlightRewardAmount(30),
      variableCondition: variableCondition("系统._灵异线", ">=", 2),
    },
  ],
  quests: [
    ["quest_Four_great", "青龙朱雀白虎玄武", "让犬冢夏美、西园寺爱丽莎、月咏深雪、阿宅（女）一起摸你的阴茎", "other"],
    ["quest_Cain", "该隐", "让一名角色主动帮助你对她的亲人出手", "other"],
    ["quest_gay_gay", "！？给给？！", "让阿宅（无论男女都行）向你表白", "role"],
    ["quest_Human_Joystick", "人体摇杆", "让一名角色自我认知为手柄，她的乳头是摇杆，肚脐眼是按键，小穴是大招键", "other"],
    ["quest_Adult_pacifier", "成人奶嘴", "让月咏深雪含住你的睾丸，当成奶嘴吮吸", "role"],
    ["quest_delicious_drink", "可口饮料", "让月咏深雪把你的精液当作可口饮料喝下", "role"],
    ["quest_cuckold_request", "绿帽请求", "让阿宅君请求你跟爱丽莎发生关系。", "role"],
    ["quest_slave_circle", "奴隶循环", "让A认为B是她的奴隶，B认为C是她的奴隶，C认为A是她的奴隶。", "other"],
    ["quest_furniture_mindset", "家具化", "让一名角色深信自己是一件家具。", "other"],
    ["quest_pure_love_ntr", "纯爱牛", "让一名角色认为出轨是纯爱的表现。", "other"],
    ["quest_proxy_hypno", "代理催眠", "让一名角色用APP催眠另一名角色。", "other"],
    ["quest_public_leak", "论外", "让一名角色在公众场合失禁。", "other"],
    ["quest_best_buddy", "好哥们", "给阿宅君发送爱丽莎的色情影片，但不要让他认出是爱丽莎。", "role"],
    ["quest_male_swimsuit", "男泳装挑战", "让夏美在公众场合穿男泳装。", "role"],
    ["quest_ntr_phone", "寝取电话", "让爱丽莎一边跟你做爱一边跟阿宅君打电话。", "role"],
    ["quest_cosplay_cm", "Cosplay露出", "让爱丽莎穿上非常暴露的cos服去CM。", "role"],
    ["quest_body_paint", "人体彩绘", "让夏美在公共场合只涂着人体彩绘。", "role"],
  ].map(([id, title, condition, scope]) => ({
    id,
    title,
    description: condition,
    condition,
    scope,
    reward: starlightReward(),
  })).concat({
    id: "quest_naked_double_standard",
    title: "赤身裸体与裸体赤身",
    description: "让两个角色在公共场合都不穿衣服，但是指责对方不穿衣服不知廉耻。",
    condition: "让两个角色在公共场合都不穿衣服，但是指责对方不穿衣服不知廉耻。",
    scope: "other",
    reward: {
      starlight: 0,
      items: [starlightVoucher(2)],
    },
  }, {
    id: "quest_orgasm_strongest",
    title: "最强绝顶",
    description: "让角色的快感值到达500后高潮。",
    condition: "让角色的快感值到达500后高潮。",
    scope: "other",
    reward: {
      starlight: 0,
      items: [starlightVoucher()],
    },
  }),
};

export function buildDefaultRewardDatabase() {
  return JSON.parse(JSON.stringify(DEFAULT_REWARD_DATABASE));
}
