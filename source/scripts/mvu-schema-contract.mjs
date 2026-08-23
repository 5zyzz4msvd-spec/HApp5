export const MVU_SCHEMA_SCRIPT_ID = "2d4a28a2-0a83-4b68-97a5-894e1b77da92";
export const MVU_SCHEMA_SCRIPT_NAME = "MVU 当前变量结构";
export const MVU_CONTRACT_VERSION = 7;

/**
 * Single source of truth for the card's current MVU contract.
 * Keep every helper inside this function: the same function is serialized into
 * the Tavern Helper runtime script and executed directly by the release verifier.
 */
export function createMvuSchema(z, options = {}) {
  const contractObject = (shape) => {
    const schema = z.object(shape);
    if (options?.dropUnknown || options?.stripUnknown) return schema.strip();
    if (options?.preserveUnknown) return schema.passthrough();
    return schema.strict();
  };
  const boundedNumber = (min, max, initial = 0) => options?.patchValidation
    ? z.number().min(min).max(max)
    : z.coerce.number().prefault(initial).transform((value) => Math.min(max, Math.max(min, value)));
  const nonnegativeNumber = (initial = 0) => options?.patchValidation
    ? z.number().min(0)
    : z.coerce.number().prefault(initial).transform((value) => Math.max(0, value));
  const nonnegativeInteger = (initial = 0) => options?.patchValidation
    ? z.number().int().min(0)
    : z.coerce.number().prefault(initial).transform((value) => Math.max(0, Math.trunc(value)));
  const boundedSensitivity = () => boundedNumber(0, 1000, 100);
  const boundedState = () => boundedNumber(-200, 200, 0);

  const InventoryItem = contractObject({
    描述: z.string().prefault("未记录"),
    数量: nonnegativeInteger(1),
  });
  const RoleItem = contractObject({
    描述: z.string().prefault("未记录"),
    数量: nonnegativeInteger(1),
    固定: z.boolean().prefault(false),
  });
  const TimetableItem = contractObject({
    课节: z.string().prefault(""),
    科目: z.string().prefault(""),
    原课程描述: z.string().prefault(""),
    是否魔改: z.boolean().prefault(false),
    魔改课程: z.string().prefault(""),
    魔改课程描述: z.string().prefault(""),
  });
  const PersonalitySetting = contractObject({
    状态: z.string().prefault("无"),
    特调: z.string().prefault(""),
  });
  const Personality = contractObject({
    愤怒: PersonalitySetting.optional(),
    色欲: PersonalitySetting.optional(),
    暴食: PersonalitySetting.optional(),
    傲慢: PersonalitySetting.optional(),
    嫉妒: PersonalitySetting.optional(),
    怠惰: PersonalitySetting.optional(),
    贪婪: PersonalitySetting.optional(),
    忧郁: PersonalitySetting.optional(),
    虚伪: PersonalitySetting.optional(),
  }).prefault({});
  const Crime = contractObject({
    盗窃: nonnegativeInteger(0),
    露出: nonnegativeInteger(0),
    私闯: nonnegativeInteger(0),
    伤害: nonnegativeInteger(0),
    淫乱: nonnegativeInteger(0),
    强奸: nonnegativeInteger(0),
  }).prefault({});
  const Remodel = contractObject({
    头: contractObject({
      头: z.string().optional(), 脸: z.string().optional(), 发: z.string().optional(), 脖子: z.string().optional(),
      唇: z.string().optional(), 齿: z.string().optional(), 口: z.string().optional(), 眼: z.string().optional(),
      鼻: z.string().optional(), 耳: z.string().optional(), 其他: z.string().optional(),
    }).optional(),
    躯干: contractObject({
      乳: z.string().optional(), 穴: z.string().optional(), 菊: z.string().optional(), 肚脐: z.string().optional(),
      腹: z.string().optional(), 背: z.string().optional(), 其他: z.string().optional(),
    }).optional(),
    双臂: contractObject({
      腋: z.string().optional(), 臂: z.string().optional(), 手: z.string().optional(), 其他: z.string().optional(),
    }).optional(),
    双腿: contractObject({
      腿: z.string().optional(), 足: z.string().optional(), 其他: z.string().optional(),
    }).optional(),
    整体: contractObject({
      外表: z.string().optional(), 内脏: z.string().optional(), 疾病: z.string().optional(), 其他: z.string().optional(),
    }).optional(),
  }).prefault({});
  const Child = contractObject({
    名称: z.string().prefault("未命名"),
    性别: z.literal("女").prefault("女"),
    阶段: z.enum(["胚胎", "孩童", "角色"]).prefault("胚胎"),
    妊娠开始日期: z.string().prefault(""),
    出生日期: z.string().prefault(""),
    角色名: z.string().prefault(""),
    说明: z.string().prefault(""),
  });

  const CharacterStats = contractObject({
    衣着: contractObject({
      头发: z.string().prefault("未记录"),
      面部: z.string().prefault("未记录"),
      上衣: z.string().prefault("未记录"),
      下衣: z.string().prefault("未记录"),
    }).prefault({}),
    信息: contractObject({
      姓名: z.string().prefault(""),
      性别: z.enum(["男", "女"]).prefault("女"),
      _年龄: z.string().optional(),
      年龄: z.string().optional(),
      社团或职业: z.string().prefault("未记录"),
      身高: z.string().prefault("未记录"),
      体重: z.string().prefault("未记录"),
      三围: z.string().optional(),
      阴茎长度: z.string().optional(),
      绰号: z.string().prefault(""),
      绰号已认可: z.boolean().prefault(false),
    }).prefault({}),
    状态: contractObject({
      好感度: boundedState(),
      警戒度: boundedState(),
      服从度: boundedState(),
      性欲: boundedState(),
      快感值: boundedState(),
    }).prefault({}),
    事件: contractObject({
      _事件记录: z.string().prefault("000000"),
      至关重要记忆: z.string().prefault(""),
    }).prefault({}),
    敏感: contractObject({
      阴蒂敏感度: boundedSensitivity().optional(),
      小穴敏感度: boundedSensitivity().optional(),
      菊穴敏感度: boundedSensitivity().optional(),
      尿道敏感度: boundedSensitivity().optional(),
      乳头敏感度: boundedSensitivity().optional(),
      阴茎敏感度: boundedSensitivity().optional(),
      龟头敏感度: boundedSensitivity().optional(),
      前列腺敏感度: boundedSensitivity().optional(),
      阴蒂高潮次数: nonnegativeInteger(0).optional(),
      小穴高潮次数: nonnegativeInteger(0).optional(),
      菊穴高潮次数: nonnegativeInteger(0).optional(),
      尿道高潮次数: nonnegativeInteger(0).optional(),
      乳头高潮次数: nonnegativeInteger(0).optional(),
      阴茎高潮次数: nonnegativeInteger(0).optional(),
      龟头高潮次数: nonnegativeInteger(0).optional(),
      前列腺高潮次数: nonnegativeInteger(0).optional(),
    }).prefault({}),
    效果: contractObject({
      心理: z.string().prefault("未记录"),
      临时催眠效果: z.record(z.string(), z.any()).prefault({}),
      永久催眠效果: z.record(z.string(), z.any()).prefault({}),
    }).prefault({}),
    劣迹: contractObject({ 性格: Personality, 罪行: Crime }).prefault({}),
    改造: Remodel,
    物品: contractObject({
      持有: z.record(z.string(), RoleItem).prefault({}),
    }).prefault({ 持有: {} }),
    子嗣: contractObject({
      是否妊娠中: z.boolean().prefault(false),
      生产数量: nonnegativeInteger(0),
      子嗣列表: z.record(z.string(), Child).prefault({}),
    }).prefault({ 是否妊娠中: false, 生产数量: 0, 子嗣列表: {} }),
  }).superRefine((role, ctx) => {
    const info = role?.信息 || {};
    const sensitive = role?.敏感 || {};
    const maleOnly = ["阴茎敏感度", "龟头敏感度", "前列腺敏感度", "阴茎高潮次数", "龟头高潮次数", "前列腺高潮次数"];
    const femaleOnly = ["阴蒂敏感度", "小穴敏感度", "菊穴敏感度", "阴蒂高潮次数", "小穴高潮次数", "菊穴高潮次数"];
    const reject = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (info.性别 === "男") {
      if (Object.prototype.hasOwnProperty.call(info, "三围")) reject(["信息", "三围"], "男性角色不能使用三围字段");
      for (const key of femaleOnly) {
        if (Object.prototype.hasOwnProperty.call(sensitive, key)) reject(["敏感", key], "男性角色不能使用女性专属部位字段");
      }
    } else {
      if (Object.prototype.hasOwnProperty.call(info, "阴茎长度")) reject(["信息", "阴茎长度"], "女性角色不能使用阴茎长度字段");
      for (const key of maleOnly) {
        if (Object.prototype.hasOwnProperty.call(sensitive, key)) reject(["敏感", key], "女性角色不能使用男性专属部位字段");
      }
    }
  }).prefault({});

  const LocationRule = contractObject({
    名称: z.string().prefault(""),
    内容: z.string().prefault(""),
    目标范围: z.string().prefault("范围内所有人"),
    生效范围: z.string().prefault(""),
    来源: z.string().prefault("高级广范围雷达"),
    地点ID: z.string().prefault(""),
    地点名: z.string().prefault(""),
    地图层级: z.string().prefault("city"),
    地点路径: z.string().prefault(""),
    持续类型: z.enum(["永久", "临时"]).prefault("永久"),
  });
  const Task = contractObject({
    任务: z.string().prefault(""),
    任务ID: z.string().optional(),
    完成条件: z.string().prefault(""),
    奖励星光点: nonnegativeInteger(0),
    奖励物品: z.record(z.string(), InventoryItem).optional(),
    已完成: z.boolean().prefault(false),
  });
  const System = contractObject({
    当前年份: (options?.patchValidation ? z.number().int().min(1) : z.coerce.number().int().min(1).prefault(2024)),
    当前日期: z.string().regex(/^\d{1,2}月\d{1,2}日$/).prefault("4月9日"),
    _当前周几: z.string().prefault("星期三"),
    当前时间: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).prefault("12:30"),
    _当前日程: z.string().prefault("午休"),
    _当前特殊日期: z.string().prefault(""),
    _课程表: z.array(TimetableItem).prefault([]),
    当前事件: z.string().prefault(""),
    当前出场角色: z.array(z.string()).prefault([]),
    _user身份: z.record(z.string(), z.any()).prefault({}),
    当前地点: z.string().prefault("教室"),
    催眠APP订阅等级: z.string().prefault("试用期"),
    MC能量上限: nonnegativeNumber(25),
    MC能量: nonnegativeNumber(25),
    主角可疑度: boundedNumber(0, 100, 0),
    _警视厅线: (options?.patchValidation ? z.number().int().min(0).max(2) : z.coerce.number().int().min(0).max(2).prefault(0)),
    _医院线: (options?.patchValidation ? z.number().int().min(0).max(2) : z.coerce.number().int().min(0).max(2).prefault(0)),
    _灵异线: (options?.patchValidation ? z.number().int().min(0).max(2) : z.coerce.number().int().min(0).max(2)).optional(),
    附身: z.string().optional(),
    持有零花钱: nonnegativeNumber(0),
    星光点: nonnegativeInteger(0),
    持有物品: z.record(z.string(), InventoryItem).prefault({}),
  }).prefault({});

  return contractObject({
    系统: System,
    规则: z.record(z.string(), LocationRule).prefault({}),
    任务: z.record(z.string(), Task).prefault({}),
    角色: z.record(z.string(), CharacterStats).prefault({}),
  });
}

export function normalizeMvuImportStatData(z, input, options = {}) {
  let candidate = input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const oldDollarKey = "$" + "user身份";
    const system = input.系统;
    if (system && typeof system === "object" && !Array.isArray(system)) {
      candidate = { ...input, 系统: { ...system } };
      if (!Object.prototype.hasOwnProperty.call(candidate.系统, "_user身份")) {
        if (Object.prototype.hasOwnProperty.call(candidate.系统, oldDollarKey)) candidate.系统._user身份 = candidate.系统[oldDollarKey];
        else if (Object.prototype.hasOwnProperty.call(candidate.系统, "user身份")) candidate.系统._user身份 = candidate.系统["user身份"];
      }
      delete candidate.系统[oldDollarKey];
      delete candidate.系统["user身份"];
    }

    // Contract v5 retires the former monitor/dispatch business model.  Contract
    // v6 also retires the complete work/buff chain. These are
    // exact, project-owned legacy keys rather than arbitrary unknown data, so
    // migration removes only this closed list while preserving every unrelated
    // extension leaf.  Character ages and persona-derived fields are untouched.
    if (candidate.系统 && typeof candidate.系统 === "object" && !Array.isArray(candidate.系统)) {
      delete candidate.系统.派遣岗位;
      delete candidate.系统.监控派遣岗位;
      for (const key of ["_社畜值", "社畜值", "打工值", "社畜经验", "_buff", "_buff结束时间", "buff", "buff结束时间"]) {
        delete candidate.系统[key];
      }
      const inventory = candidate.系统.持有物品;
      if (inventory && typeof inventory === "object" && !Array.isArray(inventory)) {
        candidate.系统.持有物品 = { ...inventory };
        for (const [itemName, rawItem] of Object.entries(candidate.系统.持有物品)) {
          if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
          if (String(rawItem.名称 ?? "") !== itemName) continue;
          const nextItem = { ...rawItem };
          delete nextItem.名称;
          candidate.系统.持有物品[itemName] = nextItem;
        }
      }
    }
    if (candidate.角色 && typeof candidate.角色 === "object" && !Array.isArray(candidate.角色)) {
      candidate = { ...candidate, 角色: { ...candidate.角色 } };
      for (const [roleName, rawRole] of Object.entries(candidate.角色)) {
        if (!rawRole || typeof rawRole !== "object" || Array.isArray(rawRole)) continue;
        const role = { ...rawRole };
        if (role.状态 && typeof role.状态 === "object" && !Array.isArray(role.状态)) {
          role.状态 = { ...role.状态 };
          delete role.状态.是否派遣中;
        }
        if (role.信息 && typeof role.信息 === "object" && !Array.isArray(role.信息)) {
          role.信息 = { ...role.信息 };
          for (const key of ["工作价值", "身价", "派遣身价", "日收益"]) delete role.信息[key];
        }
        for (const key of ["是否派遣中", "工作价值", "身价", "派遣身价", "日收益"]) delete role[key];
        candidate.角色[roleName] = role;
      }
    }
  }
  // Existing chat state is compatibility data, not a new patch request.  Preserve
  // unknown fields during automatic migration/import so a newer/third-party leaf
  // cannot be silently destroyed.  Explicit user-confirmed cleanup may opt into
  // dropUnknown; patch-path authorization remains a separate strict contract.
  const schema = createMvuSchema(z, options?.dropUnknown
    ? { dropUnknown: true }
    : { preserveUnknown: true, patchValidation: options?.preserveValues === true });
  const result = schema.safeParse(candidate);
  if (result.success) {
    const strictResult = createMvuSchema(z).safeParse(candidate);
    const unknown = [];
    if (!strictResult.success) {
      for (const issue of strictResult.error?.issues || []) {
        if (issue?.code !== "unrecognized_keys" || !Array.isArray(issue.keys)) continue;
        const basePath = Array.isArray(issue.path) ? issue.path.map(String) : [];
        for (const key of issue.keys) unknown.push({ path: basePath.concat(String(key)), code: "unrecognized_key" });
      }
    }
    return { ok: true, value: options?.preserveValues === true ? candidate : result.data, issues: [], unknown };
  }
  return {
    ok: false,
    value: null,
    unknown: [],
    issues: (result.error?.issues || []).map((issue) => ({
      path: Array.isArray(issue.path) ? issue.path.map(String) : [],
      message: String(issue.message || "变量格式不符合当前 Schema"),
      code: String(issue.code || "invalid"),
    })),
  };
}

export const MVU_SCHEMA_SCRIPT_CONTENT = [
  "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';",
  `const createMvuSchema = ${createMvuSchema.toString()};`,
  "// Runtime state accepts and preserves legacy/third-party leaves. New patch paths are authorized separately.",
  "export const Schema = createMvuSchema(z, { preserveUnknown: true });",
  "$(() => registerMvuSchema(Schema));",
].join("\n\n");
