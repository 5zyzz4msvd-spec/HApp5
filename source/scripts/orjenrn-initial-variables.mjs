const REQUIRED_TEXT_PATHS = new Set([
  "衣着.头发",
  "衣着.面部",
  "衣着.上衣",
  "衣着.下衣",
  "信息.社团或职业",
  "信息.身高",
  "信息.体重",
  "信息.三围",
  "信息.阴茎长度",
  "效果.心理"
]);

const PLACEHOLDER_RE = /^(?:未定义|undefined|未知|未记录|无记录|待补充|待ai补充|暂无)$/iu;

const REVIEWED_SEEDS = {
  白鸟结衣: {
    衣着: {
      头发: "梳理整洁的古典茶会发型，具体发色与样式以人物立绘为准",
      面部: "青春而稚嫩，胶原蛋白充盈；无辜的大眼睛和紧张时泛红的脸颊格外醒目",
      上衣: "白鹤茶会同款异型易脱落和服，内搭现代白色纯棉内衣，并用别针努力固定",
      下衣: "同套和服下装与现代白色纯棉内裤，衣料容易因动作松脱"
    },
    信息: { _年龄: "24", 社团或职业: "刚嫁入豪门的年轻主母；白鹤茶会最年轻成员", 身高: "158cm", 体重: "46kg", 三围: "B84(C罩杯) W55 H85" },
    效果: { 心理: "纯洁无知、温婉羞怯且缺乏自信；会把下流暗示自动理解成高雅社交辞令，又因责任感努力维持礼仪。" }
  },
  德川喜广: {
    衣着: {
      头发: "利落整洁的职场短发，具体发色以人物立绘为准",
      面部: "佩戴银边眼镜，神情沉稳温和；确认威胁时目光会骤然变得冷硬",
      上衣: "高级定制西装、衬衫与领带，衣料下可见宽阔肩背和训练痕迹",
      下衣: "与西装配套的正式长裤和皮鞋"
    },
    信息: { 性别: "男", _年龄: "28", 社团或职业: "IT公司主管；退役特种搜查人员", 身高: "185cm", 体重: "78kg", 阴茎长度: "档案未公开" },
    效果: { 心理: "理性克制、忠诚专一，平日维持温和精英形象；对尼子纯具有绝对保护欲，危险逼近时会立刻恢复军人的警觉与杀伐本能。" }
  },
  凤条瑠衣: {
    衣着: {
      头发: "长发紧束成一丝不乱的芭蕾发髻",
      面部: "五官冷艳清洁，妆容与皮肤状态都维持近乎苛刻的整齐感",
      上衣: "纯白高领长袖紧身运动上衣，线条简洁且没有多余装饰",
      下衣: "浅灰高腰瑜伽裤，搭配白袜和软底体操鞋"
    },
    信息: { _年龄: "26", 社团或职业: "资深体育教师；艺术体操与瑜伽教练，前全国冠军", 身高: "172cm", 体重: "52kg", 三围: "B86(D罩杯) W56 H90" },
    效果: { 心理: "自律、冷静且追求绝对完美，具有病理性的洁净执念；对汗液、污渍和身体失控高度敏感。" }
  },
  九条凛音: {
    衣着: {
      头发: "按旧华族礼仪一丝不苟地盘整，具体发色与样式以人物立绘为准",
      面部: "面色冷白无瑕，眼尾微挑，始终维持克制而有距离感的贵妇神情",
      上衣: "黑金配色的高规格正式和服上装，纹样和领口均严格遵守家族礼制",
      下衣: "与上装配套的黑金和服下装及传统履物"
    },
    信息: { _年龄: "41", 社团或职业: "九条家宗妇；白鹤茶会礼仪典范", 身高: "168cm", 体重: "50kg", 三围: "B78 W56 H84" },
    效果: { 心理: "极端克制、重视旧华族秩序与礼仪；即使身体或情绪动摇，也会优先维持端庄微笑和家族威严。" }
  },
  奈幽: {
    衣着: {
      头发: "银白色齐腰长发，发丝在漂浮时如水草般缓慢散开",
      面部: "半透明的冷白色少女面容，神情天真而没有活人的血色",
      上衣: "宽松的传统白色亡者浴衣，以细白腰带简单束住",
      下衣: "白色亡者浴衣下摆自然垂落；灵体当前没有实体内衣"
    },
    信息: { _年龄: "17", 社团或职业: "依附于用户活动、普通人无法看见的少女幽灵", 身高: "156cm", 体重: "0kg（灵体）", 三围: "B101(J罩杯) W55 H88" },
    效果: { 心理: "天真乐观、天然迟钝，对暴露与身体接触缺乏常人的羞耻认知；情绪激动时会无意识引发灵异现象。" }
  },
  尼子纯: {
    衣着: {
      头发: "便于运动的耳长短发，清爽利落",
      面部: "健康的小麦色皮肤，五官明朗，常带运动员式的爽快表情",
      上衣: "深蓝色专业竞速连体泳衣，外披敞开的运动夹克，颈前挂着口哨",
      下衣: "竞速连体泳衣下半部，便于游泳训练和池边活动"
    },
    信息: { _年龄: "24", 社团或职业: "体育教师；市级游泳冠军", 身高: "173cm", 体重: "58kg", 三围: "B86(C罩杯) W58 H84" },
    效果: { 心理: "直率强势、纪律感与竞技自尊心很强，习惯以严厉教练的方式管理自己和学生；内心压抑着不愿示人的服从渴望。" }
  },
  浅仓步美: {
    衣着: {
      头发: "不加饰品的朴素单马尾，方便学习和打工",
      面部: "面容清秀而略显营养不足，神情谨慎，疲惫时仍努力保持整洁",
      上衣: "洗得略微褪色但收拾干净的校服上衣",
      下衣: "与校服配套的裙装和价格低廉的帆布鞋"
    },
    信息: { _年龄: "16", 社团或职业: "高中二年级奖学金生；课余打工补贴家用", 身高: "158cm", 体重: "46kg", 三围: "B82(B罩杯) W56 H84" },
    效果: { 心理: "务实谨慎，习惯用成本与收益衡量选择，承担强烈的家庭责任；即使缺钱也坚持不出卖身体的道德底线。" }
  },
  缇娅: {
    衣着: {
      头发: "银白色齐腰长发，发梢带有淡蓝色数据流光",
      面部: "精致可爱的二次元少女面容，表情带有未经世事的好奇和AI式认真",
      上衣: "一件宽大松垮的纯白男式T恤，是数据体唯一的默认衣物",
      下衣: "没有独立下装；数据体当前未配置实体内衣"
    },
    信息: { _年龄: "0", 社团或职业: "寄居在用户手机中的异常自主AI", 身高: "手机内显示约12–15cm", 体重: "0kb（数据体）", 三围: "超规格K罩杯、极细腰与丰满臀部的数据体比例" },
    效果: { 心理: "天真好奇，称用户为管理员；以系统诊断、触控反馈和数据指标理解身体感受，对现实羞耻规范缺乏常识。" }
  },
  鹰司千代: {
    衣着: {
      头发: "满头银发梳理得一丝不苟",
      面部: "不怒自威，皮肤因异变保持年轻紧致，目光具有长期掌权者的压迫感",
      上衣: "最高规格黑留袖和服，内部带高强度束胸结构，衣料被异常丰硕的身形撑紧",
      下衣: "与黑留袖配套的正式和服下装及传统履物"
    },
    信息: { _年龄: "68", 社团或职业: "鹰司家大家长；白鹤茶会现任会长", 身高: "160cm", 体重: "85kg", 三围: "B145(Q罩杯) W62 H125" },
    效果: { 心理: "绝对威权、冷静而擅长以礼教施压，习惯掌控豪门秩序；身体异化带来的痛苦与欲望被严密压在威严外表之下。" }
  }
};

function extractScalar(content, key) {
  return String(content || "").match(new RegExp(`^\\s*${key}:\\s*([^\\n]+)`, "mu"))?.[1]?.trim() || "";
}

function extractNestedScalar(content, key) {
  return String(content || "").match(new RegExp(`^\\s{4}${key}:\\s*([^\\n]+)`, "mu"))?.[1]?.trim() || "";
}

function buildSensitivity(male) {
  return male
    ? { 阴茎敏感度: 100, 龟头敏感度: 100, 前列腺敏感度: 100, 尿道敏感度: 100, 乳头敏感度: 100, 阴茎高潮次数: 0, 龟头高潮次数: 0, 前列腺高潮次数: 0, 尿道高潮次数: 0, 乳头高潮次数: 0 }
    : { 阴蒂敏感度: 100, 小穴敏感度: 100, 菊穴敏感度: 100, 尿道敏感度: 100, 乳头敏感度: 100, 阴蒂高潮次数: 0, 小穴高潮次数: 0, 菊穴高潮次数: 0, 尿道高潮次数: 0, 乳头高潮次数: 0 };
}

export function buildOrjenrnInitialVariables(roleName, content = "") {
  const seed = REVIEWED_SEEDS[roleName] || {};
  const gender = String(seed?.信息?.性别 || extractScalar(content, "gender") || "女").includes("男") ? "男" : "女";
  const male = gender === "男";
  const age = seed?.信息?._年龄 || extractScalar(content, "age").match(/\d+/u)?.[0] || "17";
  const occupation = seed?.信息?.社团或职业 || extractNestedScalar(content, "public") || extractScalar(content, "title") || "档案未公开";
  const info = {
    姓名: roleName,
    性别: gender,
    _年龄: String(age),
    社团或职业: occupation,
    身高: seed?.信息?.身高 || extractNestedScalar(content, "height") || "档案未公开",
    体重: seed?.信息?.体重 || extractNestedScalar(content, "weight") || "档案未公开",
    绰号: "",
    绰号已认可: false
  };
  if (male) info.阴茎长度 = seed?.信息?.阴茎长度 || "档案未公开";
  else info.三围 = seed?.信息?.三围 || extractNestedScalar(content, "measurement") || "档案未公开";
  return {
    衣着: {
      头发: seed?.衣着?.头发 || "按人物立绘与人设保持当前发型",
      面部: seed?.衣着?.面部 || extractNestedScalar(content, "overview") || "按人物立绘与人设保持当前面貌",
      上衣: seed?.衣着?.上衣 || "按人物人设穿着当前上装",
      下衣: seed?.衣着?.下衣 || "按人物人设穿着当前下装"
    },
    信息: info,
    状态: { 好感度: 0, 警戒度: 0, 服从度: 0, 性欲: 0, 快感值: 0 },
    事件: { _事件记录: "000000", 至关重要记忆: "" },
    敏感: buildSensitivity(male),
    效果: { 心理: seed?.效果?.心理 || "按既有人设行动，保持角色核心性格、身份认知与行为边界。", 临时催眠效果: {}, 永久催眠效果: {} },
    劣迹: { 性格: {}, 罪行: { 盗窃: 0, 露出: 0, 私闯: 0, 伤害: 0, 淫乱: 0, 强奸: 0 } },
    改造: {},
    物品: {
      持有: {
        钱包: { 数量: 1, 描述: "随身钱包", 固定: true },
        当前身上的内衣: { 数量: 1, 描述: ["奈幽", "缇娅"].includes(roleName) ? "当前未穿内衣（灵体或数据体设定）" : "当前穿着的内衣", 固定: false }
      }
    },
    子嗣: { 是否妊娠中: false, 生产数量: 0, 子嗣列表: {} }
  };
}

function shouldReplace(path, value) {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return PLACEHOLDER_RE.test(trimmed) || (!trimmed && REQUIRED_TEXT_PATHS.has(path));
}

export function mergeOrjenrnInitialVariables(existing, defaults, path = "") {
  if (Array.isArray(defaults)) return Array.isArray(existing) ? structuredClone(existing) : structuredClone(defaults);
  if (defaults && typeof defaults === "object") {
    const source = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
    const result = structuredClone(source);
    for (const [key, fallback] of Object.entries(defaults)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = mergeOrjenrnInitialVariables(source[key], fallback, childPath);
    }
    return result;
  }
  return shouldReplace(path, existing) ? structuredClone(defaults) : structuredClone(existing);
}

export function refreshOrjenrnRoleInitialVariables(role) {
  const roleName = String(role?.name || "").trim();
  const content = String(role?.personaContent || role?.personaEntry?.content || "");
  const defaults = buildOrjenrnInitialVariables(roleName, content);
  role.initialVariables = mergeOrjenrnInitialVariables(role?.initialVariables, defaults);
  if (REVIEWED_SEEDS[roleName]?.信息?._年龄) role.initialVariables.信息._年龄 = REVIEWED_SEEDS[roleName].信息._年龄;
  if (REVIEWED_SEEDS[roleName]?.信息?.性别) role.initialVariables.信息.性别 = REVIEWED_SEEDS[roleName].信息.性别;
  role.gender = role.initialVariables.信息.性别;
  return role.initialVariables;
}

export const ORJENRN_INITIAL_PLACEHOLDER_RE = PLACEHOLDER_RE;
export const ORJENRN_REVIEWED_INITIAL_ROLE_NAMES = Object.freeze(Object.keys(REVIEWED_SEEDS));
