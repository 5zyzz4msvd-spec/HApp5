import { DEFAULT_STARLIGHT_REWARD, buildDefaultRewardDatabase } from "./reward-defaults.js";

const DEFAULT_REWARD_DATABASE = buildDefaultRewardDatabase();
const ROLE_RELATED_REWARD_RE = /角色|目标|任意角色|好感|警戒|服从|性欲|快感|敏感|高潮|心理|身体检测|西园寺|爱丽莎|月咏|深雪|犬冢|夏美/;
const REWARD_ITEM_PRESETS = [
  {
    name: "星光点兑换券",
    description: "APP任务奖励道具。VIP5用户可在邂逅商店消耗本券，并以10000零花钱兑换1星光点；仅有零花钱但没有兑换券时不能兑换。",
  },
  {
    name: "常识修改雷达",
    description: "催眠APP的VIP6一次性道具。每个常识修改雷达可在地图中为一个地点及其子地点写入一条永久规则。",
  },
];
const INITIAL_ROLE_NAMES = ["西园寺爱丽莎", "月咏深雪", "犬冢夏美", "阿宅"];

const SCOPE_LABELS = {
  self: "自己",
  role: "角色",
  system: "系统",
  other: "其他",
};

const SYSTEM_VARIABLE_OPTIONS = [
  { value: "系统.当前年份", label: "系统 / 当前年份" },
  { value: "系统.当前日期", label: "系统 / 当前日期" },
  { value: "系统._当前周几", label: "系统 / _当前周几" },
  { value: "系统.当前时间", label: "系统 / 当前时间" },
  { value: "系统.当前地点", label: "系统 / 当前地点" },
  { value: "系统.当前事件", label: "系统 / 当前事件" },
  { value: "系统._当前日程", label: "系统 / _当前日程" },
  { value: "系统._当前特殊日期", label: "系统 / _当前特殊日期" },
  { value: "系统.MC能量", label: "系统 / MC能量" },
  { value: "系统.MC能量上限", label: "系统 / MC能量上限" },
  { value: "系统.持有零花钱", label: "系统 / 持有零花钱" },
  { value: "系统.星光点", label: "系统 / 星光点" },
  { value: "系统.主角可疑度", label: "系统 / 主角可疑度" },
  { value: "系统.社畜值", label: "系统 / 社畜值" },
  { value: "系统.当天课程表", label: "系统 / 当天课程表" },
  { value: "系统.当天原课程表", label: "系统 / 当天原课程表" },
  { value: "系统.当天魔改课程表", label: "系统 / 当天魔改课程表" },
  { value: "系统.催眠APP订阅等级", label: "系统 / 催眠APP订阅等级" },
  { value: "系统.持有物品.星光点兑换券.数量", label: "系统 / 星光点兑换券数量" },
  { value: "系统.持有物品.常识修改雷达.数量", label: "系统 / 常识修改雷达数量" },
];

const ROLE_VARIABLE_FIELDS = [
  { value: "好感度", label: "好感度" },
  { value: "警戒度", label: "警戒度" },
  { value: "服从度", label: "服从度" },
  { value: "性欲", label: "性欲" },
  { value: "快感值", label: "快感值" },
  { value: "信息.性别", label: "信息 / 性别" },
  { value: "信息.绰号", label: "信息 / 绰号" },
  { value: "效果.心理", label: "效果 / 心理" },
  { value: "衣着.照片", label: "衣着 / 照片" },
  { value: "信息.姓名", label: "信息 / 姓名" },
  { value: "信息.年龄", label: "信息 / 年龄" },
  { value: "信息.社团或职业", label: "信息 / 社团或职业" },
  { value: "信息.身高", label: "信息 / 身高" },
  { value: "信息.体重", label: "信息 / 体重" },
  { value: "信息.三围", label: "信息 / 三围" },
  { value: "信息.阴茎长度", label: "信息 / 阴茎长度" },
  { value: "衣着.头发", label: "衣着 / 头发" },
  { value: "衣着.面部", label: "衣着 / 面部" },
  { value: "衣着.上衣", label: "衣着 / 上衣" },
  { value: "衣着.下衣", label: "衣着 / 下衣" },
  { value: "阴蒂敏感度", label: "阴蒂敏感度" },
  { value: "小穴敏感度", label: "小穴敏感度" },
  { value: "菊穴敏感度", label: "菊穴敏感度" },
  { value: "尿道敏感度", label: "尿道敏感度" },
  { value: "乳头敏感度", label: "乳头敏感度" },
  { value: "阴蒂高潮次数", label: "阴蒂高潮次数" },
  { value: "小穴高潮次数", label: "小穴高潮次数" },
  { value: "菊穴高潮次数", label: "菊穴高潮次数" },
  { value: "尿道高潮次数", label: "尿道高潮次数" },
  { value: "乳头高潮次数", label: "乳头高潮次数" },
  { value: "临时催眠效果", label: "临时催眠效果" },
  { value: "永久催眠效果", label: "永久催眠效果" },
];

const VARIABLE_CONDITION_OPTIONS = [
  ...SYSTEM_VARIABLE_OPTIONS,
  ...INITIAL_ROLE_NAMES.flatMap((roleName) =>
    ROLE_VARIABLE_FIELDS.map((field) => ({
      value: `角色.${roleName}.${field.value}`,
      label: `${roleName} / ${field.label}`,
    }))
  ),
];
const DEFAULT_VARIABLE_CONDITION_PATH = "系统.主角可疑度";

const CONDITION_OPERATOR_LABELS = {
  ">=": "大于等于",
  ">": "大于",
  "<=": "小于等于",
  "<": "小于",
  "==": "等于",
  "!=": "不等于",
};

const state = {
  database: normalizeDatabase(DEFAULT_REWARD_DATABASE),
  activeKind: "achievements",
  selectedId: "",
  selectedIds: new Set(),
  search: "",
  editor: null,
  jsonText: "",
  status: "纯 JSON 模式：未连接卡片、前端或任何保存接口。",
  error: "",
  dirty: false,
  entryListScrollTop: 0,
  pageScrollTop: 0,
  restorePageScroll: false,
};

const app = document.querySelector("#app");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function rewardPresetByName(name) {
  const clean = String(name || "").trim();
  return REWARD_ITEM_PRESETS.find((item) => item.name === clean) || null;
}

function normalizeRewardItem(item) {
  const name = String(item?.name || item?.["名称"] || "").trim();
  const preset = rewardPresetByName(name);
  return {
    name,
    description: String(item?.description || item?.["描述"] || preset?.description || "").trim(),
    quantity: Math.max(1, Math.trunc(Number(item?.quantity ?? item?.["数量"]) || 1)),
  };
}

function normalizeReward(reward) {
  const raw = reward && typeof reward === "object" ? reward : {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    starlight: Math.max(0, Math.trunc(Number(raw.starlight ?? raw.rewardStarlight ?? raw["奖励星光点"]) || 0)),
    items: items.filter((item) => item && typeof item === "object").map(normalizeRewardItem).filter((item) => item.name),
  };
}

function normalizeConditionOperator(operator) {
  const text = String(operator || "").trim();
  if (text === "=") return "==";
  return Object.prototype.hasOwnProperty.call(CONDITION_OPERATOR_LABELS, text) ? text : ">=";
}

function normalizeConditionValue(value) {
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value ?? "").trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^(true|false)$/i.test(text)) return /^true$/i.test(text);
  const quoted = text.match(/^["'“”‘’](.*)["'“”‘’]$/);
  return quoted ? quoted[1] : text;
}

function normalizeLogicalExpression(value) {
  return String(value ?? "").replaceAll("＆＆", "&&").replaceAll("｜｜", "||").trim();
}

function parseVariableConditionText(text) {
  const match = normalizeLogicalExpression(text).match(/^(?:stat_data\.)?((?:系统|角色)(?:\.[^\s]+)+)\s*(>=|<=|>|<|==|=|!=)\s*(.+)$/);
  if (!match) return null;
  return {
    path: match[1],
    operator: normalizeConditionOperator(match[2]),
    value: normalizeConditionValue(match[3]),
  };
}

function normalizeConditionLogic(value) {
  const text = normalizeLogicalExpression(value);
  return text === "||" ? "||" : "&&";
}

function parseVariableConditionExpression(text) {
  const normalized = normalizeLogicalExpression(text);
  if (!normalized) return { logic: "&&", parts: [] };
  const tokens = normalized.split(/\s*(&&|\|\|)\s*/).filter(Boolean);
  const logic = tokens.find((token) => token === "&&" || token === "||") || "&&";
  const parts = tokens
    .filter((token) => token !== "&&" && token !== "||")
    .map(parseVariableConditionText)
    .filter(Boolean)
    .slice(0, 2);
  return { logic, parts };
}

function normalizeConditionPart(part, parsed, fallbackPath = "") {
  const raw = part && typeof part === "object" && !Array.isArray(part) ? part : {};
  const path = String(raw.path || raw.variablePath || raw.variable || raw["变量路径"] || raw["变量"] || parsed?.path || fallbackPath).trim();
  const value = raw.value ?? raw.target ?? raw.threshold ?? raw["目标值"] ?? raw["值"] ?? parsed?.value ?? "";
  return {
    path,
    operator: normalizeConditionOperator(raw.operator || raw.op || raw["比较符"] || parsed?.operator),
    value: normalizeConditionValue(value),
  };
}

function buildVariableConditionExpression(parts, logic = "&&") {
  return parts
    .filter((part) => String(part?.path || "").trim())
    .slice(0, 2)
    .map((part) => `${part.path} ${normalizeConditionOperator(part.operator)} ${part.value}`)
    .join(` ${normalizeConditionLogic(logic)} `);
}

function looksLikeLogicalConditionExpression(text) {
  const normalized = normalizeLogicalExpression(text);
  if (!normalized || !/(?:&&|\|\|)/.test(normalized)) return false;
  return normalized.split(/\s*(?:&&|\|\|)\s*/).filter(Boolean).every((part) => Boolean(parseVariableConditionText(part)));
}

function normalizeVariableCondition(condition, fallbackText = "", options = {}) {
  const raw = condition && typeof condition === "object" && !Array.isArray(condition) ? condition : {};
  const rawExpression = normalizeLogicalExpression(raw.expression || raw.expr || raw["表达式"] || raw["组合条件"] || "");
  const fallbackExpression = looksLikeLogicalConditionExpression(fallbackText) ? normalizeLogicalExpression(fallbackText) : "";
  const expression = rawExpression || fallbackExpression;
  const parsed = parseVariableConditionText(fallbackText);
  const fallbackPath = options.allowEmpty ? "" : DEFAULT_VARIABLE_CONDITION_PATH;
  const expressionParts = parseVariableConditionExpression(expression);
  const rawParts = Array.isArray(raw.parts || raw.conditions || raw["条件列表"]) ? raw.parts || raw.conditions || raw["条件列表"] : [];
  const parts = rawParts.length
    ? rawParts.map((part) => normalizeConditionPart(part, null, "")).filter((part) => part.path).slice(0, 2)
    : expressionParts.parts;
  if (!parts.length) {
    const part = normalizeConditionPart(raw, parsed, fallbackPath);
    if (part.path) parts.push(part);
  }
  if (!parts.length && options.allowEmpty) return null;
  if (!parts.length) parts.push(normalizeConditionPart({}, null, fallbackPath));
  const logic = normalizeConditionLogic(raw.logic || raw.joiner || raw["逻辑"] || expressionParts.logic);
  const cleanParts = parts.filter((part) => part.path).slice(0, 2);
  if (!cleanParts.length && options.allowEmpty) return null;
  const first = cleanParts[0] || parts[0];
  return {
    path: first.path,
    operator: normalizeConditionOperator(first.operator),
    value: first.value,
    logic,
    parts: cleanParts.length ? cleanParts : [first],
    expression: buildVariableConditionExpression(cleanParts.length ? cleanParts : [first], logic),
  };
}

function variableConditionToText(condition) {
  const normalized = normalizeVariableCondition(condition, "", { allowEmpty: true });
  if (!normalized) return "";
  return normalized.expression || buildVariableConditionExpression(normalized.parts || [normalized], normalized.logic);
}

function normalizeEntry(entry, kind) {
  const fallbackPrefix = kind === "achievements" ? "ach" : "quest";
  const raw = entry && typeof entry === "object" ? entry : {};
  const normalized = {
    id: String(raw.id || raw.ID || makeId(fallbackPrefix)).trim(),
    title: String(raw.title || raw.name || raw["名称"] || raw["成就"] || raw["任务"] || "未命名").trim(),
    description: String(raw.description || raw.desc || raw.condition || raw["描述"] || raw["条件"] || "").trim(),
    condition: String(raw.condition || raw.description || raw["完成条件"] || raw["条件"] || "").trim(),
    scope: String(raw.scope || raw["分类"] || "other").trim(),
    reward: normalizeReward(raw.reward || {
      starlight: raw.rewardStarlight ?? raw.starlight ?? raw["奖励星光点"] ?? raw["星光点"] ?? 0,
      items: raw.rewardItems ?? raw.items ?? raw["奖励物品"] ?? [],
    }),
  };
  const variableCondition = normalizeVariableCondition(
    raw.variableCondition || raw.conditionVariable || raw["变量条件"],
    normalized.condition,
    { allowEmpty: kind !== "achievements" }
  );
  if (variableCondition) normalized.variableCondition = variableCondition;
  return normalized;
}

function isRoleRelatedEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const text = [source.id, source.title, source.name, source.description, source.desc, source.condition, source.scope]
    .map((value) => String(value ?? ""))
    .join(" ");
  return ROLE_RELATED_REWARD_RE.test(text);
}

function normalizeEntryList(value, kind) {
  const list = Array.isArray(value) ? value : [];
  const normalized = list.map((item) => normalizeEntry(item, kind));
  return kind === "achievements" ? normalized.filter((item) => !isRoleRelatedEntry(item)) : normalized;
}

function normalizeDatabase(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    achievements: normalizeEntryList(Array.isArray(raw.achievements) ? raw.achievements : DEFAULT_REWARD_DATABASE.achievements, "achievements"),
    quests: normalizeEntryList(Array.isArray(raw.quests) ? raw.quests : DEFAULT_REWARD_DATABASE.quests, "quests"),
  };
}

function getEntries() {
  return state.database[state.activeKind] || [];
}

function setEntries(entries) {
  state.database[state.activeKind] = entries;
}

function selectedEntry() {
  return getEntries().find((item) => item.id === state.selectedId) || getEntries()[0] || null;
}

function setStatus(message, error = "") {
  state.status = message || "";
  state.error = error || "";
  render();
}

function rememberEntryListScroll() {
  const list = app.querySelector("[data-entry-list]");
  if (list) state.entryListScrollTop = list.scrollTop;
  state.pageScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  state.restorePageScroll = true;
}

function restoreEntryListScroll() {
  const list = app.querySelector("[data-entry-list]");
  if (list) list.scrollTop = state.entryListScrollTop || 0;
  if (state.restorePageScroll) {
    window.scrollTo(0, state.pageScrollTop || 0);
    state.restorePageScroll = false;
  }
}

function markDirty() {
  state.dirty = true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rewardSummary(reward) {
  const normalized = normalizeReward(reward);
  const parts = [];
  if (normalized.starlight) parts.push(`${normalized.starlight} 星光点`);
  for (const item of normalized.items) parts.push(`${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`);
  return parts.join(" + ") || "无奖励";
}

function currentJson() {
  syncEditorToDatabase();
  return JSON.stringify(normalizeDatabase(state.database), null, 2);
}

function visibleEntries() {
  const query = state.search.trim().toLowerCase();
  if (!query) return getEntries();
  return getEntries().filter((item) =>
    [item.id, item.title, item.description, item.condition, item.scope, variableConditionToText(item.variableCondition), rewardSummary(item.reward)]
      .join("\n")
      .toLowerCase()
      .includes(query)
  );
}

function syncEditorFromSelection() {
  const entry = selectedEntry();
  state.editor = entry ? clone(entry) : null;
}

function syncEditorToDatabase() {
  if (!state.editor) return;
  const entries = getEntries();
  const normalized = normalizeEntry(state.editor, state.activeKind);
  const index = entries.findIndex((item) => item.id === state.selectedId);
  if (index >= 0) {
    entries[index] = normalized;
    state.selectedId = normalized.id;
  }
  state.editor = clone(normalized);
}

function selectKind(kind) {
  syncEditorToDatabase();
  state.activeKind = kind;
  state.selectedIds.clear();
  state.selectedId = getEntries()[0]?.id || "";
  state.entryListScrollTop = 0;
  syncEditorFromSelection();
  render();
}

function selectEntry(id) {
  rememberEntryListScroll();
  syncEditorToDatabase();
  state.selectedId = id;
  syncEditorFromSelection();
  render();
}

function addEntry() {
  syncEditorToDatabase();
  const kind = state.activeKind;
  const entry = normalizeEntry({
    id: makeId(kind === "achievements" ? "ach" : "quest"),
    title: kind === "achievements" ? "新成就" : "新任务",
    condition: kind === "achievements" ? "系统.主角可疑度 >= 1" : "",
    variableCondition: kind === "achievements" ? { path: "系统.主角可疑度", operator: ">=", value: 1 } : undefined,
    scope: kind === "achievements" ? "self" : "other",
    reward: { starlight: DEFAULT_STARLIGHT_REWARD, items: [] },
  }, kind);
  getEntries().unshift(entry);
  state.selectedId = entry.id;
  state.selectedIds.clear();
  syncEditorFromSelection();
  markDirty();
  render();
}

function duplicateEntry(entry = selectedEntry()) {
  if (!entry) return;
  syncEditorToDatabase();
  const copy = clone(entry);
  copy.id = makeId(state.activeKind === "achievements" ? "ach" : "quest");
  copy.title = `${copy.title} 副本`;
  const entries = getEntries();
  const index = entries.findIndex((item) => item.id === entry.id);
  entries.splice(index + 1, 0, copy);
  state.selectedId = copy.id;
  syncEditorFromSelection();
  markDirty();
  render();
}

function deleteEntries(ids) {
  const set = new Set(ids);
  if (!set.size) return;
  setEntries(getEntries().filter((item) => !set.has(item.id)));
  if (set.has(state.selectedId)) state.selectedId = getEntries()[0]?.id || "";
  state.selectedIds.clear();
  syncEditorFromSelection();
  markDirty();
  render();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("已复制 JSON 到剪贴板。");
  } catch {
    setStatus("复制失败", "当前浏览器不允许写入剪贴板。");
  }
}

function downloadJson() {
  const blob = new Blob([currentJson()], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reward-database-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  state.dirty = false;
  setStatus("已导出 JSON 文件。");
}

function copySelected() {
  const ids = state.selectedIds.size ? state.selectedIds : new Set([state.selectedId]);
  const items = getEntries().filter((item) => ids.has(item.id));
  if (!items.length) return;
  void copyText(JSON.stringify(items.length === 1 ? items[0] : items, null, 2));
}

function copyDatabase() {
  void copyText(currentJson());
}

function putDatabaseIntoTextBox() {
  state.jsonText = currentJson();
  setStatus("已把当前整库 JSON 放入文本框。");
}

function parseItemsField(text) {
  return String(text || "")
    .split(/[;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, description = "", quantity = "1"] = part.split(":").map((item) => item.trim());
      return { name, description, quantity: Number(quantity) || 1 };
    })
    .filter((item) => item.name);
}

function parseBatchLine(line) {
  const parts = line.split("|").map((item) => item.trim());
  if (parts.length < 3) return null;
  const [idOrTitle, titleOrCondition, conditionOrStarlight, starlightOrItems, itemsText] = parts;
  const hasExplicitId = /^[a-z]+[_-]/i.test(idOrTitle);
  const id = hasExplicitId ? idOrTitle : makeId(state.activeKind === "achievements" ? "ach" : "quest");
  const title = hasExplicitId ? titleOrCondition : idOrTitle;
  const condition = hasExplicitId ? conditionOrStarlight : titleOrCondition;
  const starlight = hasExplicitId ? starlightOrItems : conditionOrStarlight;
  const itemField = hasExplicitId ? itemsText : starlightOrItems;
  return normalizeEntry({
    id,
    title,
    description: condition,
    condition,
    scope: "other",
    reward: { starlight: Number(starlight) || 0, items: parseItemsField(itemField || "") },
  }, state.activeKind);
}

function extractRewardDatabaseSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return value.rewardDatabase
    || value.database
    || value.data?.extensions?.workbench?.rewardDatabase
    || value.data?.extensions?.rewardDatabase
    || value;
}

function importPayloadFromJson(value) {
  if (Array.isArray(value)) return { kind: "list", list: normalizeEntryList(value, state.activeKind) };
  if (value && typeof value === "object") {
    const databaseSource = extractRewardDatabaseSource(value);
    const hasAchievements = Array.isArray(databaseSource.achievements);
    const hasQuests = Array.isArray(databaseSource.quests);
    if (hasAchievements || hasQuests) {
      return {
        kind: "database",
        replaceAll: hasAchievements && hasQuests,
        database: {
          version: 1,
          achievements: hasAchievements ? normalizeEntryList(databaseSource.achievements, "achievements") : null,
          quests: hasQuests ? normalizeEntryList(databaseSource.quests, "quests") : null,
        },
      };
    }
    return { kind: "list", list: [normalizeEntry(value, state.activeKind)] };
  }
  return { kind: "empty", list: [] };
}

function mergeEntries(current, incoming) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function applyImportedPayload(payload, mode) {
  const effectiveMode = payload.kind === "database" && payload.replaceAll ? "replace" : mode;
  if (payload.kind === "database") {
    if (payload.replaceAll) {
      state.database = normalizeDatabase({
        achievements: payload.database.achievements || [],
        quests: payload.database.quests || [],
      });
    } else {
      if (payload.database.achievements) {
        state.database.achievements = effectiveMode === "merge"
          ? mergeEntries(state.database.achievements, payload.database.achievements)
          : payload.database.achievements;
      }
      if (payload.database.quests) {
        state.database.quests = effectiveMode === "merge"
          ? mergeEntries(state.database.quests, payload.database.quests)
          : payload.database.quests;
      }
    }
  } else if (payload.kind === "list") {
    setEntries(effectiveMode === "merge" ? mergeEntries(getEntries(), payload.list) : payload.list);
  }
  state.selectedId = getEntries()[0]?.id || "";
  state.selectedIds.clear();
  state.entryListScrollTop = 0;
  syncEditorFromSelection();
  markDirty();
  render();
  return effectiveMode;
}

function applyJsonText(mode) {
  const text = state.jsonText.trim();
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    const effectiveMode = applyImportedPayload(importPayloadFromJson(parsed), mode);
    setStatus(`已${effectiveMode === "merge" ? "合并" : "替换"} JSON${effectiveMode !== mode ? "；完整整库已清空原库并全覆盖" : ""}。`);
  } catch (error) {
    const incoming = text.split(/\n+/).map(parseBatchLine).filter(Boolean);
    if (!incoming.length) {
      setStatus("导入失败", error.message);
      return;
    }
    applyImportedPayload({ kind: "list", list: incoming }, mode);
    setStatus(`已按批量行${mode === "merge" ? "合并" : "替换"} ${incoming.length} 条。`);
  }
}

async function importJsonFile(file, mode) {
  if (!file) return;
  try {
    state.jsonText = await file.text();
    applyJsonText(mode);
  } catch (error) {
    setStatus("读取 JSON 文件失败", error.message);
  }
}

function resetDefaults() {
  state.database = normalizeDatabase(DEFAULT_REWARD_DATABASE);
  state.activeKind = "achievements";
  state.selectedIds.clear();
  state.selectedId = state.database.achievements[0]?.id || "";
  state.jsonText = "";
  syncEditorFromSelection();
  markDirty();
  render();
}

function updateEditor(path, value) {
  if (!state.editor) return;
  const keys = path.split(".");
  let target = state.editor;
  for (let index = 0; index < keys.length - 1; index += 1) {
    target[keys[index]] ||= {};
    target = target[keys[index]];
  }
  target[keys[keys.length - 1]] = value;
  if (path.startsWith("variableCondition.")) syncEditorVariableCondition();
  markDirty();
}

function defaultConditionPart() {
  return { path: DEFAULT_VARIABLE_CONDITION_PATH, operator: ">=", value: 0 };
}

function blankConditionPart() {
  return { path: "", operator: ">=", value: "" };
}

function conditionAllowEmpty() {
  return state.activeKind !== "achievements";
}

function editableVariableCondition() {
  const normalized = normalizeVariableCondition(state.editor?.variableCondition, state.editor?.condition, { allowEmpty: conditionAllowEmpty() });
  if (normalized?.parts?.length) return clone(normalized);
  return {
    logic: "&&",
    parts: [conditionAllowEmpty() ? blankConditionPart() : defaultConditionPart()],
  };
}

function syncEditorVariableCondition(condition = state.editor?.variableCondition) {
  if (!state.editor) return null;
  const normalized = normalizeVariableCondition(condition, "", { allowEmpty: conditionAllowEmpty() });
  if (normalized) {
    state.editor.variableCondition = normalized;
    return normalized;
  }
  delete state.editor.variableCondition;
  return null;
}

function refreshConditionPreview() {
  const preview = app.querySelector("[data-condition-preview]");
  if (preview) preview.textContent = variableConditionToText(state.editor?.variableCondition) || "未启用变量条件";
}

function updateVariableConditionPart(index, key, value) {
  if (!state.editor) return;
  const condition = editableVariableCondition();
  condition.parts ||= [];
  while (condition.parts.length <= index) condition.parts.push(defaultConditionPart());
  condition.parts[index][key] = key === "operator" ? normalizeConditionOperator(value) : value;
  condition.parts = condition.parts.slice(0, 2);
  syncEditorVariableCondition(condition);
  markDirty();
  refreshConditionPreview();
}

function updateVariableConditionLogic(value) {
  if (!state.editor) return;
  const condition = editableVariableCondition();
  condition.logic = normalizeConditionLogic(value);
  syncEditorVariableCondition(condition);
  markDirty();
  refreshConditionPreview();
}

function addVariableConditionPart() {
  if (!state.editor) return;
  const condition = editableVariableCondition();
  const activeParts = (condition.parts || []).filter((part) => part.path);
  if (!activeParts.length) {
    condition.parts = [defaultConditionPart()];
  } else if (activeParts.length < 2) {
    condition.parts = [...activeParts, defaultConditionPart()];
  }
  syncEditorVariableCondition(condition);
  markDirty();
  render();
}

function removeVariableConditionPart(index) {
  if (!state.editor) return;
  const condition = editableVariableCondition();
  condition.parts = (condition.parts || []).filter((_, partIndex) => partIndex !== index);
  if (!conditionAllowEmpty() && !condition.parts.length) condition.parts = [defaultConditionPart()];
  syncEditorVariableCondition(condition);
  markDirty();
  render();
}

function addEditorItem(presetName = "") {
  if (!state.editor) return;
  state.editor.reward ||= { starlight: 0, items: [] };
  state.editor.reward.items ||= [];
  const preset = rewardPresetByName(presetName);
  state.editor.reward.items.push(preset ? { ...preset, quantity: 1 } : { name: "新物品", description: "", quantity: 1 });
  markDirty();
  render();
}

function updateEditorItem(index, key, value) {
  const item = state.editor?.reward?.items?.[index];
  if (!item) return;
  if (key === "preset") {
    const preset = rewardPresetByName(value);
    if (preset) {
      item.name = preset.name;
      item.description = preset.description;
    }
  } else {
    item[key] = key === "quantity" ? Math.max(1, Math.trunc(Number(value) || 1)) : value;
    if (key === "name" && !String(item.description || "").trim()) {
      const preset = rewardPresetByName(value);
      if (preset) item.description = preset.description;
    }
  }
  markDirty();
}

function removeEditorItem(index) {
  if (!state.editor?.reward?.items) return;
  state.editor.reward.items.splice(index, 1);
  markDirty();
  render();
}

function renderList() {
  const entries = visibleEntries();
  return `
    <section class="panel list-panel">
      <div class="tabs">
        <button class="${state.activeKind === "achievements" ? "active" : ""}" data-action="kind" data-kind="achievements">成就</button>
        <button class="${state.activeKind === "quests" ? "active" : ""}" data-action="kind" data-kind="quests">任务</button>
      </div>
      <div class="toolbar">
        <input value="${escapeHtml(state.search)}" placeholder="搜索 ID、名称、条件、奖励" data-field="search" />
        <button class="primary" data-action="add">新增</button>
      </div>
      <div class="bulk-actions">
        <button data-action="copy-selected">复制所选 JSON</button>
        <button data-action="duplicate">复制为新条目</button>
        <button class="danger" data-action="delete-selected">删除</button>
      </div>
      <div class="entry-list" data-entry-list>
        ${entries.map((item) => `
          <article class="entry-row ${item.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(item.id)}">
            <label class="check">
              <input type="checkbox" data-action="toggle-select" data-id="${escapeHtml(item.id)}" ${state.selectedIds.has(item.id) ? "checked" : ""} />
            </label>
            <button data-action="select" data-id="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.id)}</span>
              <em>${escapeHtml(rewardSummary(item.reward))}</em>
            </button>
          </article>
        `).join("") || `<p class="empty">没有条目。</p>`}
      </div>
    </section>
  `;
}

function renderVariableConditionOptions() {
  return VARIABLE_CONDITION_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" label="${escapeHtml(option.label)}"></option>`).join("");
}

function renderVariableConditionEditor(item) {
  const isAchievement = state.activeKind === "achievements";
  const condition = normalizeVariableCondition(item.variableCondition, item.condition, { allowEmpty: !isAchievement }) || {
    logic: "&&",
    parts: [blankConditionPart()],
  };
  if (condition.expression || condition.path || condition.parts?.some((part) => part.path)) item.variableCondition = condition;
  else delete item.variableCondition;
  const preview = variableConditionToText(condition);
  const activeParts = (condition.parts || []).filter((part) => part.path);
  const parts = activeParts.length ? condition.parts.slice(0, 2) : [blankConditionPart()];
  const canRemoveOnlyPart = !isAchievement;
  return `
    <section class="condition-builder">
      <div class="linked-head">
        <div>
          <h3>${isAchievement ? "前端完成条件" : "可选变量条件"}</h3>
          <p class="muted">${isAchievement ? "成就按这里的变量条件由前端判断。" : "任务可以留空交给AI或任务变量判断；这里仅作为 JSON 配置字段。"}</p>
        </div>
        <button data-action="sync-condition-text" ${preview ? "" : "disabled"}>同步到说明</button>
      </div>
      <div class="condition-parts">
        <datalist id="variable-condition-options">${renderVariableConditionOptions()}</datalist>
        ${parts.map((part, index) => `
          ${index === 1 ? `
            <div class="condition-join">
              <span>组合关系</span>
              <select data-condition-logic>
                <option value="&&" ${condition.logic !== "||" ? "selected" : ""}>&& 并且</option>
                <option value="||" ${condition.logic === "||" ? "selected" : ""}>|| 或者</option>
              </select>
            </div>
          ` : ""}
          <div class="condition-grid">
            <label><span>变量路径 ${index + 1}</span>
              <input value="${escapeHtml(part.path || "")}" list="variable-condition-options" placeholder="选择或手填变量路径" data-condition-part-index="${index}" data-condition-part-key="path" />
            </label>
            <label><span>比较</span>
              <select data-condition-part-index="${index}" data-condition-part-key="operator">
                ${Object.entries(CONDITION_OPERATOR_LABELS).map(([value, label]) => `<option value="${value}" ${normalizeConditionOperator(part.operator) === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
            <label><span>目标值</span><input value="${escapeHtml(part.value ?? "")}" placeholder="数字或文本" data-condition-part-index="${index}" data-condition-part-key="value" /></label>
            <button class="danger icon" data-action="remove-condition-part" data-index="${index}" ${parts.length === 1 && !canRemoveOnlyPart ? "disabled" : ""}>−</button>
          </div>
        `).join("")}
      </div>
      <div class="condition-actions">
        <button data-action="add-condition-part" ${activeParts.length >= 2 ? "disabled" : ""}>+ ${activeParts.length ? "添加第二变量" : "添加变量条件"}</button>
      </div>
      <p class="condition-preview" data-condition-preview>${preview ? escapeHtml(preview) : "未启用变量条件"}</p>
    </section>
  `;
}

function renderEditor() {
  const item = state.editor;
  if (!item) return `<section class="panel editor-panel"><p class="empty">选择或新增一个条目。</p></section>`;
  const reward = normalizeReward(item.reward);
  item.reward = reward;
  return `
    <section class="panel editor-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">${state.activeKind === "achievements" ? "Achievement" : "Quest"}</span>
          <h2>${escapeHtml(item.title || "未命名")}</h2>
        </div>
      </div>
      <div class="form-grid">
        <label><span>ID</span><input value="${escapeHtml(item.id)}" data-edit="id" /></label>
        <label><span>名称</span><input value="${escapeHtml(item.title)}" data-edit="title" /></label>
        <label><span>分类</span>
          <select data-edit="scope">
            ${Object.entries(SCOPE_LABELS).map(([value, label]) => `<option value="${value}" ${item.scope === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label><span>星光点</span><input type="number" min="0" step="1" value="${reward.starlight}" data-edit="reward.starlight" /></label>
      </div>
      <label class="stack"><span>描述</span><textarea data-edit="description">${escapeHtml(item.description)}</textarea></label>
      ${renderVariableConditionEditor(item)}
      <label class="stack"><span>${state.activeKind === "achievements" ? "完成条件显示文案" : "完成条件 / AI 判定说明"}</span><textarea data-edit="condition">${escapeHtml(item.condition)}</textarea></label>
      <section class="reward-items">
        <div class="linked-head">
          <h3>物品奖励</h3>
          <div class="preset-actions">
            ${REWARD_ITEM_PRESETS.map((preset) => `<button data-action="add-item" data-preset="${escapeHtml(preset.name)}">${escapeHtml(preset.name)}</button>`).join("")}
            <button data-action="add-item">自定义物品</button>
          </div>
        </div>
        ${reward.items.map((rewardItem, index) => `
          <div class="item-row">
            <select data-item-index="${index}" data-item-key="preset">
              <option value="custom" ${rewardPresetByName(rewardItem.name) ? "" : "selected"}>自定义</option>
              ${REWARD_ITEM_PRESETS.map((preset) => `<option value="${escapeHtml(preset.name)}" ${rewardItem.name === preset.name ? "selected" : ""}>${escapeHtml(preset.name)}</option>`).join("")}
            </select>
            <input placeholder="物品名" value="${escapeHtml(rewardItem.name)}" data-item-index="${index}" data-item-key="name" />
            <input placeholder="描述" value="${escapeHtml(rewardItem.description)}" data-item-index="${index}" data-item-key="description" />
            <input class="qty" type="number" min="1" step="1" value="${rewardItem.quantity}" data-item-index="${index}" data-item-key="quantity" />
            <button class="danger icon" data-action="remove-item" data-index="${index}">×</button>
          </div>
        `).join("") || `<p class="muted">没有物品奖励。</p>`}
      </section>
    </section>
  `;
}

function renderJsonPanel() {
  return `
    <section class="panel json-panel">
      <div class="linked-head">
        <h3>JSON 导入 / 导出</h3>
        <button data-action="json-to-box">当前整库放入文本框</button>
      </div>
      <p class="muted">这个工作台只处理 JSON。导入不会读卡，导出不会写入项目文件；完整整库 JSON 会自动清空原库并全覆盖。</p>
      <input hidden type="file" accept=".json,application/json" data-field="jsonFile" />
      <textarea class="json-box" data-field="jsonText" placeholder="粘贴 rewardDatabase JSON，或粘贴当前列表的数组 / 单个条目 / 批量行。">${escapeHtml(state.jsonText)}</textarea>
      <div class="bulk-actions">
        <button data-action="choose-import-merge">选择 JSON 合并</button>
        <button data-action="choose-import-replace">选择 JSON 替换</button>
        <button data-action="import-merge">合并 JSON</button>
        <button data-action="import-replace">替换 JSON</button>
        <button data-action="copy-db">复制整库 JSON</button>
        <button class="primary" data-action="download-db">下载 JSON</button>
        <button class="danger" data-action="reset-defaults">重置默认</button>
      </div>
    </section>
  `;
}

function render() {
  app.innerHTML = `
    <main class="workbench">
      <header class="topbar">
        <div>
          <span class="eyebrow">JSON Only</span>
          <h1>成就与任务 JSON 工作台</h1>
          <p>纯浏览器内存编辑；不读取卡片，不渲染前端，不写入项目文件。</p>
        </div>
        <div class="top-actions">
          <span class="status ${state.error ? "error" : ""}">${escapeHtml(state.error || state.status)}</span>
          ${state.dirty ? `<span class="dirty">内存有改动</span>` : `<span class="saved">已导出/初始</span>`}
          <button data-action="copy-db">复制 JSON</button>
          <button class="primary" data-action="download-db">下载 JSON</button>
        </div>
      </header>
      <section class="main-grid">
        <div class="left-column">
          ${renderList()}
          ${renderJsonPanel()}
        </div>
        ${renderEditor()}
      </section>
    </main>
  `;
  restoreEntryListScroll();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button, input[type='checkbox']");
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;
  event.preventDefault();
  if (action === "kind") selectKind(target.dataset.kind);
  if (action === "select") selectEntry(target.dataset.id);
  if (action === "toggle-select") {
    rememberEntryListScroll();
    const id = target.dataset.id;
    if (target.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    render();
  }
  if (action === "add") addEntry();
  if (action === "duplicate") duplicateEntry();
  if (action === "delete-selected") deleteEntries(state.selectedIds.size ? state.selectedIds : [state.selectedId]);
  if (action === "copy-selected") copySelected();
  if (action === "copy-db") copyDatabase();
  if (action === "download-db") downloadJson();
  if (action === "json-to-box") putDatabaseIntoTextBox();
  if (action === "choose-import-merge" || action === "choose-import-replace") {
    const input = app.querySelector("[data-field='jsonFile']");
    if (input instanceof HTMLInputElement) {
      input.dataset.importMode = action === "choose-import-merge" ? "merge" : "replace";
      input.value = "";
      input.click();
    }
  }
  if (action === "import-merge") applyJsonText("merge");
  if (action === "import-replace") applyJsonText("replace");
  if (action === "reset-defaults") resetDefaults();
  if (action === "add-item") addEditorItem(target.dataset.preset || "");
  if (action === "remove-item") removeEditorItem(Number(target.dataset.index));
  if (action === "add-condition-part") addVariableConditionPart();
  if (action === "remove-condition-part") removeVariableConditionPart(Number(target.dataset.index));
  if (action === "sync-condition-text" && state.editor && state.editor.variableCondition) {
    state.editor.condition = variableConditionToText(state.editor.variableCondition);
    markDirty();
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  if (target.dataset.field === "search") {
    state.search = target.value;
    render();
    return;
  }
  if (target.dataset.field === "jsonText") {
    state.jsonText = target.value;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "conditionPartIndex")) {
    updateVariableConditionPart(Number(target.dataset.conditionPartIndex), target.dataset.conditionPartKey, target.value);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "conditionLogic")) {
    updateVariableConditionLogic(target.value);
    return;
  }
  if (target.dataset.edit) {
    updateEditor(target.dataset.edit, target.type === "number" ? Number(target.value) : target.value);
    return;
  }
  if (target.dataset.itemIndex) {
    updateEditorItem(Number(target.dataset.itemIndex), target.dataset.itemKey, target.value);
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target instanceof HTMLInputElement && target.dataset.field === "jsonFile") {
    importJsonFile(target.files?.[0], target.dataset.importMode || "merge");
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "conditionPartIndex")) {
    updateVariableConditionPart(Number(target.dataset.conditionPartIndex), target.dataset.conditionPartKey, target.value);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "conditionLogic")) {
    updateVariableConditionLogic(target.value);
    return;
  }
  if (target.dataset.edit) {
    updateEditor(target.dataset.edit, target.value);
    return;
  }
  if (target.dataset.itemIndex) {
    updateEditorItem(Number(target.dataset.itemIndex), target.dataset.itemKey, target.value);
  }
});

state.selectedId = state.database.achievements[0]?.id || "";
syncEditorFromSelection();
render();
