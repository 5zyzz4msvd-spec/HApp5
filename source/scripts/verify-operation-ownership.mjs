import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const frontend = await readFile("public/frontends/hypnosis-app/index.html", "utf8");
const start = frontend.indexOf("const operationOwnershipPathValues =");
const end = frontend.indexOf("const operationIsHypnosisCustomItemRecord =", start);
assert(start >= 0 && end > start, "generated frontend is missing the operation ownership classifier");

const context = vm.createContext({
  cleanOperationText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  },
  operationValueToDenseText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
});
vm.runInContext(
  frontend.slice(start, end)
    + "\nglobalThis.classifyOperation = operationVariableOwnership;"
    + "\nglobalThis.ownershipPromptLine = operationOwnershipPromptLine;",
  context
);

function classify(source, action, details = {}) {
  return context.classifyOperation({ source, action, details });
}

function hasPaths(actual, key, expected) {
  for (const path of expected) {
    assert(actual[key].includes(path), `${actual.mode} missing ${key} path: ${path}`);
  }
}

{
  const visibleStart = frontend.indexOf("const OPERATION_CURRENT_DETAIL_KEYS =");
  const visibleEnd = frontend.indexOf("const operationHasAction =", visibleStart);
  assert(visibleStart >= 0 && visibleEnd > visibleStart, "generated frontend is missing prompt visibility helpers");
  const visibleContext = vm.createContext({
    cleanOperationText(value) {
      return String(value ?? "").replace(/\s+/g, " ").trim();
    },
    cleanOperationFieldText(value) {
      return String(value ?? "").replace(/[<>]/g, "").trim();
    }
  });
  vm.runInContext(
    frontend.slice(visibleStart, visibleEnd)
      + "\nglobalThis.visibleEntries = operationVisibleDetailEntries;"
      + "\nglobalThis.visibleDense = operationVisibleValueToDenseText;",
    visibleContext
  );
  const record = {
    source: "催眠APP",
    action: "启动催眠",
    details: {
      功能列表: [{ 指令ID: "vip3_visual_filter", 指令: "幻视滤镜" }],
      催眠指令: [{ 指令: "幻视滤镜", 备注: "把使用者看作爱丽莎", 效果结束时间: "2024年4月9日 12:40" }]
    }
  };
  const visible = visibleContext.visibleEntries(record, "prompt");
  assert(!visible.some(([key]) => key === "功能列表"), "machine hypnosis feature rows must be hidden from the staged prompt");
  const rendered = visible.map(([key, value]) => key + "=" + visibleContext.visibleDense(value)).join("｜");
  assert(rendered.includes("催眠指令=指令=幻视滤镜"), "staged prompt must keep the readable Chinese hypnosis command");
  assert(!rendered.includes("vip3_visual_filter") && !rendered.includes("指令ID"), "staged prompt must not leak hypnosis machine IDs");
}

{
  const expiryStart = frontend.indexOf("function tempHypnosisEffectEndText(value)");
  const expiryEnd = frontend.indexOf("function tempHypnosisEffectSummary", expiryStart);
  assert(expiryStart >= 0 && expiryEnd > expiryStart, "generated frontend is missing temporary-hypnosis expiry parser");
  const expiryContext = vm.createContext({
    isPlainObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    },
    effectScalar(value) {
      return value == null ? "" : String(value);
    },
    parseStoryDate(text) {
      const match = String(text || "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? { year, month, day } : null;
    },
    storyDateSerialDay(date) {
      return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86400000);
    }
  });
  vm.runInContext(
    frontend.slice(expiryStart, expiryEnd)
      + "\nglobalThis.expiryStamp = tempHypnosisEffectEndStamp;",
    expiryContext
  );
  assert(expiryContext.expiryStamp({ 效果: "幻视", 结束时间: "2024年4月9日 13:00" }) > 0, "canonical temporary hypnosis end time must parse");
  for (const invalid of [
    "有效至13:00",
    { 效果: "幻视", 结束时间: "13:00" },
    { 效果: "幻视", 结束时间: "2024年4月9日" },
    { 效果: "幻视", 结束时间: "2024年4月9日 24:00" },
    { 效果: "幻视" }
  ]) {
    assert.equal(expiryContext.expiryStamp(invalid), 0, `invalid temporary hypnosis end time must not be guessed: ${JSON.stringify(invalid)}`);
  }
}

{
  const result = classify("催眠APP", "购买VIP等级", {
    前端处理: "已由前端直接写入变量",
    变量写入路径: ["/系统/持有零花钱", "/系统/星光点", "/系统/催眠APP订阅等级"]
  });
  assert.equal(result.mode, "frontend");
  hasPaths(result, "frontendPaths", ["/系统/持有零花钱", "/系统/星光点", "/系统/催眠APP订阅等级"]);
}

{
  const result = classify("催眠APP", "资源兑换", {
    项目: "定制趣味物品",
    前端处理: "前端只暂存需求，不直接写入变量",
    变量写入路径: ["/系统/星光点", "/系统/持有物品"]
  });
  assert.equal(result.mode, "ai");
  hasPaths(result, "aiPaths", ["/系统/星光点", "/系统/持有物品"]);
}

{
  const taskRoot = "/任务/daily-new-quest:2024年4月10日:abc:犬冢穗波";
  const details = {
    变量处理: "协同",
    前端已写路径: [
      taskRoot + "/奖励星光点",
      taskRoot + "/已完成"
    ],
    AI写入方式: "replace",
    AI写入路径: [taskRoot + "/任务", taskRoot + "/完成条件"]
  };
  const result = classify("成就和任务", "新增任务", {
    ...details
  });
  assert.equal(result.mode, "shared");
  hasPaths(result, "frontendPaths", [taskRoot + "/奖励星光点", taskRoot + "/已完成"]);
  hasPaths(result, "aiPaths", [taskRoot + "/任务", taskRoot + "/完成条件"]);
  const line = context.ownershipPromptLine({
    source: "成就和任务",
    action: "新增任务",
    details
  });
  assert(line.includes(taskRoot + "/任务") && line.includes(taskRoot + "/完成条件"), "the shared operation contract must expose exact placeholder paths");
  const internalDetailStart = frontend.indexOf("const OPERATION_PROMPT_INTERNAL_DETAIL_KEYS =");
  const internalDetailEnd = frontend.indexOf("const operationShouldHideDetail =", internalDetailStart);
  assert(internalDetailStart >= 0 && internalDetailEnd > internalDetailStart, "generated frontend is missing prompt-internal detail filtering");
  const internalDetailBlock = frontend.slice(internalDetailStart, internalDetailEnd);
  for (const key of ["新增请求ID", "AI写入方式", "AI写入路径", "AI写入对象结构"]) {
    assert(internalDetailBlock.includes(`"${key}"`), `the shared plot prompt must hide task machine detail: ${key}`);
  }
}

{
  const result = classify("警视厅", "性格特调", {
    前端写入路径: [
      "/角色/九鬼真白/劣迹/性格/色欲/状态",
      "/角色/九鬼真白/劣迹/性格/色欲/特调",
      "/系统/星光点"
    ],
    AI写入路径: ["/角色/九鬼真白/劣迹/性格/色欲/特调"],
    变量写入路径: [
      "/角色/九鬼真白/劣迹/性格/色欲/状态",
      "/角色/九鬼真白/劣迹/性格/色欲/特调",
      "/系统/星光点"
    ],
    AI执行规范: "只replace特调，不得重复扣星光点或改写状态"
  });
  assert.equal(result.mode, "shared");
  hasPaths(result, "frontendPaths", ["/角色/九鬼真白/劣迹/性格/色欲/状态", "/系统/星光点"]);
  hasPaths(result, "aiPaths", ["/角色/九鬼真白/劣迹/性格/色欲/特调"]);
  assert(!result.frontendPaths.includes("/角色/九鬼真白/劣迹/性格/色欲/特调"), "an AI-writable leaf must not also be labeled AI不动");
}

{
  const result = classify("综合医院", "医院改造", {
    角色名: "犬冢穗波",
    前端处理: "前端只锁定改造意图，不写入改造，不扣除日元；AI成功结算",
    变量写入路径: ["/角色/犬冢穗波/改造/头/眼"]
  });
  assert.equal(result.mode, "ai");
  hasPaths(result, "aiPaths", ["/系统/持有零花钱", "/角色/犬冢穗波/改造/头/眼"]);
}

{
  const result = classify("旧校舍", "首次附身", {
    前端处理: "前端已直接写入只读线路与唯一宿主",
    变量写入路径: ["/系统/_灵异线", "/系统/附身"]
  });
  assert.equal(result.mode, "frontend");
  hasPaths(result, "frontendPaths", ["/系统/_灵异线", "/系统/附身"]);
}

{
  const result = classify("催眠APP", "妊娠确认", {
    目标角色: "月咏深雪",
    变量处理: "AI结算",
    AI可写路径: ["/系统/星光点", "/角色/月咏深雪/子嗣/测试子嗣"]
  });
  assert.equal(result.mode, "ai");
  hasPaths(result, "aiPaths", ["/系统/星光点", "/角色/月咏深雪/子嗣/测试子嗣"]);
}

{
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{
      指令ID: "vip5_permanent",
      指令: "永久常识修改",
      等级: "VIP5",
      人数: 1,
      备注: "深雪认为给我看裸体是标准的同学间问候"
    }],
    MC能量消耗: "2000点",
    施术模式: "指定目标看3秒手机屏幕"
  });
  assert.equal(result.mode, "ai");
  hasPaths(result, "aiPaths", ["/系统/MC能量", "/角色/*/效果/永久催眠效果"]);
  assert(!result.aiPaths.includes("/角色/*/效果/临时催眠效果"), "vip5_permanent must never expose the temporary-effect root");
}

for (const commandId of [
  "vip5_excretion_control",
  "vip5_lactation",
  "vip5_fetish_implant",
  "vip5_permanent_false_memory",
  "vip5_permanent_personality"
]) {
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{ 指令ID: commandId, 指令: commandId, 目标角色: "月咏深雪" }]
  });
  hasPaths(result, "aiPaths", ["/角色/月咏深雪/效果/永久催眠效果"]);
  assert(!result.aiPaths.some((path) => path.includes("临时催眠效果")), `${commandId} must be permanent-only`);
}

{
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{
      指令ID: "vip3_temp_common_sense",
      指令: "限时常识修改",
      目标角色: "月咏深雪、犬冢夏美",
      人数: 2
    }]
  });
  hasPaths(result, "aiPaths", [
    "/角色/月咏深雪/效果/临时催眠效果",
    "/角色/犬冢夏美/效果/临时催眠效果"
  ]);
  assert(!result.aiPaths.some((path) => path.includes("永久催眠效果")), "multi-target temporary hypnosis must not expose any permanent-effect root");
  assert(!result.aiPaths.includes("/规则/*"), "multiple named targets must not be reclassified as an open-space rule");
}

{
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{
      指令ID: "vip3_temp_common_sense",
      指令: "限时常识修改",
      人数: 2
    }],
    目标选择模式: "数字人数"
  });
  hasPaths(result, "aiPaths", ["/系统/MC能量", "/角色/*/效果/临时催眠效果"]);
  assert(!result.aiPaths.some((path) => path.includes("永久催眠效果")), "numeric temporary hypnosis must expose only the temporary wildcard envelope");
}

for (const commandId of ["vip4_closed_space_common_sense", "vip4_closed_space_cognitive_block"]) {
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{ 指令ID: commandId, 指令: commandId }],
    目标选择模式: "范围命令"
  });
  hasPaths(result, "aiPaths", ["/系统/MC能量"]);
  assert(!result.aiPaths.some((path) => path.includes("催眠效果") || path.startsWith("/规则/")), `${commandId} must stay a closed-space narrative range: ${JSON.stringify(result.aiPaths)}`);
}

{
  const rulePath = "/规则/hypnosis-open-test";
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [{
      指令ID: "vip5_open_space_common_sense",
      指令: "开放空间常识修改",
      规则ID: "hypnosis-open-test",
      唯一变量路径: rulePath,
      作用域: "开放空间范围；不是指定多人，也不按人数结算"
    }],
    AI可写路径: ["/系统/MC能量", rulePath]
  });
  hasPaths(result, "aiPaths", ["/系统/MC能量", rulePath]);
  assert(!result.aiPaths.includes("/规则/*"), "an exact open-space rule path must not be widened to /规则/*");
  assert(!result.aiPaths.some((path) => path.includes("临时催眠效果") || path.includes("永久催眠效果")), "open-space common sense must not expose role-effect paths");
}

{
  const result = classify("催眠APP", "启动催眠", {
    功能列表: [
      { 指令ID: "vip3_temp_common_sense", 目标角色: "月咏深雪" },
      { 指令ID: "vip5_permanent", 目标角色: "犬冢夏美" }
    ]
  });
  hasPaths(result, "aiPaths", [
    "/角色/月咏深雪/效果/临时催眠效果",
    "/角色/犬冢夏美/效果/永久催眠效果"
  ]);
  assert(!result.aiPaths.includes("/角色/月咏深雪/效果/永久催眠效果"), "mixed commands must not grant the temporary target a permanent path");
  assert(!result.aiPaths.includes("/角色/犬冢夏美/效果/临时催眠效果"), "mixed commands must not grant the permanent target a temporary path");
}

{
  const result = classify("催眠APP", "取消催眠", {});
	  hasPaths(result, "aiPaths", ["/角色/*/效果/临时催眠效果"]);
	  assert(!result.aiPaths.includes("/系统/MC能量"), "cancel hypnosis must not spend MC energy");
  assert(!result.aiPaths.some((path) => path.includes("永久催眠效果")), "cancel hypnosis must never expose permanent effects");
}

{
  const ruleRoot = "/规则/radar-test-rule";
  const result = classify("地图", "发布地点规则", {
    前端处理: "只暂存用户意图；尚未扣除常识修改雷达，也未写入/规则。",
    AI可写路径: ["/系统/持有物品/常识修改雷达/数量", ruleRoot],
    AI写入方式: "常识修改雷达数量用replace写当前值-1；地点规则根用add写入完整对象。"
  });
  assert.equal(result.mode, "ai");
  hasPaths(result, "aiPaths", ["/系统/持有物品/常识修改雷达/数量", ruleRoot]);
  assert.equal(result.frontendPaths.length, 0, "publishing a location rule must not be labeled as a frontend-settled mutation");
}

{
  const result = classify("课程表", "使用课程表魔改券", {
    变量处理: "协同",
    前端已写路径: ["/系统/持有物品/课程表魔改券", "/系统/_课程表/2/魔改课程"],
    AI可写路径: ["/系统/_课程表/2/魔改课程描述"]
  });
  assert.equal(result.mode, "shared");
  hasPaths(result, "frontendPaths", ["/系统/持有物品/课程表魔改券", "/系统/_课程表/2/魔改课程"]);
  hasPaths(result, "aiPaths", ["/系统/_课程表/2/魔改课程描述"]);
}

{
  const result = classify("邂逅", "角色包已购买", {
    前端处理: "已由前端扣除星光点，只解锁桃花运份数"
  });
  assert.equal(result.mode, "frontend");
  hasPaths(result, "frontendPaths", ["/系统/星光点"]);
  assert(!result.frontendPaths.includes("/系统/持有物品"), "role package purchase must not freeze unrelated inventory");
}

for (const needle of [
  '"｜AI不动=" + (ownership.frontendPaths.length',
  '"｜AI写=" + (ownership.aiPaths.length',
  "const line = operationOwnershipPromptLine(record);",
  'selected["任务"] = variables?.["任务"]',
  "每项只按自己的AI写执行",
  "<本轮执行边界>",
  "主剧情必须优先逐项处理本容器内的全部操作",
  "全局至少推进1分钟只用于时间变量，不构成追加剧情的理由",
  "额外变量模型必须逐项核对AI写与AI不动",
  "const base = stripOperationBlocks(current);"
]) {
  assert(frontend.includes(needle), `generated frontend is missing concise per-operation ownership/upsert behavior: ${needle}`);
}
assert(
  frontend.includes("任务占位补全只由[mvu_update]变量更新规则处理"),
  "the shared task prompt must explicitly leave placeholder completion to [mvu_update]"
);
assert(!frontend.includes('lines.push("前端已写: "'), "operation block must not collapse all frontend paths into a global union");
assert(!frontend.includes('lines.push("AI可写: "'), "operation block must not collapse all AI paths into a global union");

assert(frontend.includes('trim() === "作弊模式进行中"') && !frontend.includes('/^作弊模式/.test'), "cheat status reminder must not delete start/close operations");
for (const retired of ["ST_WORK_JOBS", "openWorkPage", "renderWorkPage", "workEncounterProgressStorageKey", "__ST_OPEN_WORK_APP__", ".st-work-app"]) {
  assert(!frontend.includes(retired), `retired work runtime leaked into generated source: ${retired}`);
}

console.log("Operation ownership verification passed (daily-schedule operation ownership cases).");
