import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import YAML from "yaml";
import { z } from "../public/vendor/zod.mjs";
import { CARD_COVER_PATH, CARD_DISPLAY_NAME, CARD_PATH, DIST_REPO, VERSION_NAME } from "./card-config.mjs";
import { MVU_CONTRACT_VERSION, createMvuSchema, normalizeMvuImportStatData, MVU_SCHEMA_SCRIPT_CONTENT, MVU_SCHEMA_SCRIPT_ID, MVU_SCHEMA_SCRIPT_NAME } from "./mvu-schema-contract.mjs";
import { parseCharacterCard, parsePngChunks } from "../src/card-parser.js";
import {
  EXPECTED_OPEN,
  INTEGRITY_GATE_ID,
  INTEGRITY_GATE_NAME,
  INTEGRITY_PROJECT_ID,
  INTEGRITY_SCHEMA,
  INTEGRITY_VERSION,
  applyCardIntegrity,
  distributionTreeSha256,
  recomputeIntegrityFingerprints,
  recomputeIntegrityManifestCore,
  stripExpectedEnvelope,
} from "./card-integrity-contract.mjs";

const REQUIRED_SECTIONS = ["系统", "规则", "任务", "角色"];
const DEFAULT_ROLES = ["西园寺爱丽莎", "月咏深雪", "犬冢夏美", "阿宅"];
const BANNED_INITIAL_ROLES = ["阿宅君", "九鬼真白", "黒泽怜奈", "黑泽怜奈"];
const RETIRED_INITIAL_RULE_NAMES = ["仪容礼仪", "出勤学习", "校内安全", "校内风纪", "环境卫生"];
const BANNED_ENTRY_COMMENTS = [
  "[mvu_update]校规规则",
  "[mvu_update]校规变量",
  "校规变量",
  "[mvu_update]APP操作-地图与校规",
  "[mvu_update]特殊地点准入证规则",
  "[mvu_update](分步更新变量的时候开)变量更新任务说明",
  "[mvu_update]APP操作-警用催眠",
  "[mvu_update]警视厅线规则",
  "[mvu_update]警视厅线变量",
  "警视厅线警务人员：黒泽怜奈",
  "警视厅线⬇️世界书开始⬇️",
  "警视厅线⬆️世界书结束⬆️",
  "[mvu_plot]”白瓷”艺术体操部",
  "[mvu_plot]密室“窥神之匣”",
  "[mvu_plot]办公室“薛定谔的温室”",
  "[mvu_plot]商业街",
  "[mvu_plot]梦幻岛奇迹游乐园",
  "[mvu_plot]新月港湾区",
  "[mvu_plot]伊甸园半山富人区",
  "[mvu_plot]翡翠心市中心公园",
  "[mvu_plot]白鹤茶会"
];
const DEPRECATED_RECENT_INTERACTION_FEMALE_FIELD = "最近交互" + "女性";
const DEPRECATED_RECENT_INTERACTION_FEMALE_ALT = "最近互动" + "女性";
const DEPRECATED_RECENT_INTERACTION_FEMALE_PATH = "/系统/" + DEPRECATED_RECENT_INTERACTION_FEMALE_FIELD;
const DEPRECATED_RECENT_INTERACTION_FEMALE_RULE_COMMENT = "[mvu_update]" + DEPRECATED_RECENT_INTERACTION_FEMALE_FIELD + "规则";
const DAILY_SETTLEMENT_SCRIPT_ID = "77618567-3f61-4303-908f-9ee59ab45cd2";
const DAILY_SETTLEMENT_SCRIPT_NAME = "数值控制脚本";
const MOBILE_MAIN_FRONTEND_TEST_GREETING = "<StatusPlaceHolderImpl/>";
const DEBUG_TEST_GREETING = "Debug测试\n<StatusPlaceHolderImpl/>";
const DEBUG_TEST_ALT_SCRIPT_ID = "b9bff1e1-c605-43c4-8cf5-d8e01a8f053e";
const POLICE_LINE_TEST_GREETING = "警视厅关注测试\n<StatusPlaceHolderImpl/>";
const POLICE_LINE_TEST_ALT_SCRIPT_ID = "e468b754-8e7b-4c6e-9766-90a3a7f7f30e";
const POLICE_LINE_BAIL_TEST_GREETING = "警视厅担保测试\n<StatusPlaceHolderImpl/>";
const POLICE_LINE_BAIL_TEST_ALT_SCRIPT_ID = "f7946d2d-706a-4ec3-8c2b-47e9d43a5e0d";
const LEGACY_POLICE_LINE_TEST_ALT_SCRIPT_ID = "6c8f5a81-6f96-4f56-9084-50214c54c5a7";
const MVU_MISSING_VALUE_REPAIR_SCRIPT_ID = "9e1d0d41-8f80-44a8-a90c-6f1b558f2153";
const LOCAL_FRONTEND_ORIGIN = (process.env.HYPNOOS_LOCAL_FRONTEND_ORIGIN || "http://127.0.0.1:5173").replace(/\/$/, "");
const RELEASE_CARD_MODE = process.env.HYPNOOS_RELEASE_CARD === "1";
const BANNED_TEXT_PATTERNS = [
  /MC能量.*恢复.*一半/,
  /恢复.*MC能量上限.*一半/,
  /半管/,
  /每天恢复[^。\n]*50\s*%/,
  /MC能量[^。\n]*50\s*%/,
  /regenPerDay\s*=\s*safeMax\s*\*\s*0\.5/,
  /safeMax\s*\*\s*0\.5/,
  /每天降低[^。\n]*(主角可疑度|警戒度)/,
  /每个角色每\s*5\s*点[^。\n]*警戒度[^。\n]*(主角可疑度|可疑度)/,
  /dailySuspicionIncrease/,
  /nextAlertness/,
  /变量结构\s*01\/14/,
  /Reconciling schema/i,
  /黒泽怜奈|黑泽怜奈/,
  /警用版本催眠APP/,
  /stat_data\.警视厅/,
  /主角可疑度达到150/,
  /警视厅线已完成/
];
const BANNED_FRONTEND_TEXT = [
  "encounterSystemWorldbookEntries",
  "encounterEnsureSystemWorldbooks",
  "邂逅系统世界书",
  "特殊地点准入证规则"
];
const BANNED_PROMPT_MACRO_PATTERNS = [
  /\{\{(?:get|format)_message_variable::stat_data\s*(?:\}\}|$)/
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function duplicateEntries(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].filter(([, count]) => count > 1);
}

function normalizedContent(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function assertNoLegacyRoleVariablePaths(scope, text) {
  const value = String(text || "");
  const legacyRoleLeafPattern = new RegExp("/角色/[^\\s/`'\"，。；：<>]+/(?:好感度|警戒度|服从度|性欲|快感值|是否派遣中|工作价值|绰号|绰号已认可|_事件记录|至关重要记忆|心理|临时催眠效果|永久催眠效果)(?:/|[\\s`'\"，。；：<>]|$)");
  const legacyRoleDotPattern = new RegExp("stat[_*]data\\.角色\\.[^.\\s`'\"]+\\.(?:好感度|警戒度|服从度|性欲|快感值|是否派遣中|工作价值|绰号|绰号已认可|_事件记录|至关重要记忆|心理|临时催眠效果|永久催眠效果)(?=\\.|[\\s`'\"]|$)");
  const legacyProfilePath = /\/角色\/[^\s/`'"，。；：<>]+\/档案(?:\/|[\s`'"，。；：<>]|$)/;
  const legacyProfileDot = /stat[_*]data\.角色\.[^.\s`'"]+\.档案\./;
  const invalidRolePsychologyPath = /\/角色\/[^\s/`'"，。；：<>]+\/状态\/心理(?:\/|[\s`'"，。；：<>]|$)/;
  const invalidRolePsychologyDot = /stat[_*]data\.角色\.[^.\s`'"]+\.状态\.心理/;
  const invalidEnglishRootPatchPath = /\/(?:user|world|characters)\/(?:status|current_time|location|alisa|miyuki|natsumi|otaku|[^/\s`'"，。；：<>]+)(?:\/|[\s`'"，。；：<>]|$)/;
  const invalidEnglishRootDotPath = /\b(?:user|world|characters)\.(?:status|current_time|location|alisa|miyuki|natsumi|otaku)\b/;
  const deprecatedStoryLine = /\$警视厅线|\$医院线|\$灵异线/;
  const removedRoleSchemaVersion = /_角色变量结构版本/;
  for (const [name, pattern] of [
    ["legacy role-root path", legacyRoleLeafPattern],
    ["legacy role-root dot path", legacyRoleDotPattern],
    ["removed profile path", legacyProfilePath],
    ["removed profile dot path", legacyProfileDot],
    ["invalid 状态/心理 path", invalidRolePsychologyPath],
    ["invalid 状态.心理 dot path", invalidRolePsychologyDot],
    ...(scope === "frontend" ? [] : [
      ["invalid English root JSON Patch path", invalidEnglishRootPatchPath],
      ["invalid English root dot path", invalidEnglishRootDotPath]
    ]),
    ["deprecated $ story line", deprecatedStoryLine],
    ["removed role schema version marker", removedRoleSchemaVersion]
  ]) {
    const match = value.match(pattern);
    assert(!match, `${scope} contains ${name}: ${match?.[0] || "unknown"}`);
  }
}

function scriptText(script) {
  return [
    script?.scriptName,
    script?.name,
    script?.info,
    script?.content,
    script?.replaceString
  ].map((value) => String(value || "")).join("\n");
}

function executableScriptText(value) {
  return stripExpectedEnvelope(value).replace(/^\s+/, "");
}

function runOperationGateFixture(source, chat, { injectAvailable = true, injectThrows = false } = {}) {
  const injections = [];
  const extensionPrompts = [];
  const uninjections = [];
  const eventHandlers = new Map();
  const context = {
    chat,
    name1: "测试用户",
    setExtensionPrompt: (...args) => extensionPrompts.push(args)
  };
  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    document: { readyState: "complete", addEventListener() {} },
    SillyTavern: { getContext: () => context },
    tavern_events: {
      CHAT_CHANGED: "chat_changed",
      MESSAGE_SENT: "message_sent",
      MESSAGE_SWIPED: "message_swiped",
      MESSAGE_UPDATED: "message_updated",
      MESSAGE_EDITED: "message_edited",
      MESSAGE_DELETED: "message_deleted",
      GENERATION_AFTER_COMMANDS: "generation_after_commands",
      GENERATION_STARTED: "generation_started"
    },
    uninjectPrompts: (...args) => uninjections.push(args),
    eventOn: (name, handler) => {
      eventHandlers.set(name, handler);
      return () => eventHandlers.delete(name);
    },
    eventOff: (name) => eventHandlers.delete(name),
    addEventListener() {}
  };
  if (injectAvailable) {
    sandbox.injectPrompts = (rows) => {
      if (injectThrows) throw new Error("fixture inject failure");
      injections.push(rows);
      return { uninject() {} };
    };
  }
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  new Script(executableScriptText(source), { filename: "operation-execution-gate.js" }).runInNewContext(sandbox);
  return { chat, injections, extensionPrompts, uninjections, eventHandlers, runtime: sandbox.__ST_HYPNOOS_CURRENT_OPERATION_GATE_RUNTIME__ };
}

function runLatestUserDeliveryFixture(source, chat) {
  const injections = [];
  const uninjections = [];
  const eventHandlers = new Map();
  const logs = [];
  const context = { chat, setExtensionPrompt() {} };
  const sandbox = {
    console: { info: (...args) => logs.push(args), warn() {}, error() {}, log() {} },
    document: { readyState: "complete", addEventListener() {} },
    SillyTavern: { getContext: () => context },
    tavern_events: {
      MESSAGE_SENT: "message_sent",
      CHAT_COMPLETION_PROMPT_READY: "chat_completion_prompt_ready",
      GENERATION_STARTED: "generation_started",
      GENERATION_STOPPED: "generation_stopped",
      GENERATION_ENDED: "generation_ended",
      CHAT_CHANGED: "chat_changed"
    },
    injectPrompts: (rows) => {
      injections.push(rows);
      return { uninject() {} };
    },
    uninjectPrompts: (...args) => uninjections.push(args),
    eventOn: (name, handler) => {
      eventHandlers.set(name, handler);
      return () => eventHandlers.delete(name);
    },
    eventMakeLast: (name, handler) => {
      eventHandlers.set(name, handler);
      return () => eventHandlers.delete(name);
    },
    eventOff: (name) => eventHandlers.delete(name),
    addEventListener() {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  new Script(executableScriptText(source), { filename: "latest-user-delivery-guard.js" }).runInNewContext(sandbox);
  return { chat, injections, uninjections, eventHandlers, logs, runtime: sandbox.__ST_HYPNOOS_LATEST_USER_DELIVERY_GUARD__ };
}

function storedRegex(value) {
  const source = String(value || "");
  const match = source.match(/^\/([\s\S]*)\/([a-z]*)$/i);
  assert(match, `invalid stored regex literal: ${source.slice(0, 120)}`);
  return new RegExp(match[1], match[2]);
}

function isEntryEnabled(entry) {
  return entry?.enabled !== false && entry?.disable !== true && entry?.disabled !== true;
}

function isScriptEnabled(script) {
  return script?.enabled !== false && script?.disabled !== true;
}

function assertNoBannedText(label, text) {
  for (const pattern of BANNED_TEXT_PATTERNS) {
    assert(!pattern.test(text), `banned legacy text matched in ${label}: ${pattern}`);
  }
}

function assertEjsPromptSafety(label, text) {
  const source = String(text || "");
  const opens = (source.match(/<%_/g) || []).length;
  const closes = (source.match(/_%>/g) || []).length;
  assert(opens === closes, `${label} has unbalanced EJS delimiters: ${opens} opens / ${closes} closes`);
  assert(!/stat\*data\b/.test(source), `${label} contains misspelled stat_data path`);
  assert(
    !/getvar\(\s*['"]stat_data(?:\.[^'"]+)+['"]\s*\)\s*(?:[<>]=?|={2,3}|!={1,2})/.test(source),
    `${label} compares getvar() without a missing-value default`
  );
  const ejsBlocks = [...source.matchAll(/<%_[\s\S]*?_%>/g)].map((match) => match[0]).join("\n");
  for (const pattern of [/\b(?:const|let)\s+/, /=>/, /Object\.entries\s*\(/, /\?\?/, /`/]) {
    assert(!pattern.test(ejsBlocks), `${label} contains non-ES5 EJS syntax: ${pattern}`);
  }
}

const SENSITIVITY_EJS_FIELDS = new Set([
  "阴蒂敏感度", "小穴敏感度", "菊穴敏感度", "尿道敏感度", "乳头敏感度"
]);

function assertEncounterRolePromptPaths(path, roles) {
  const roleMap = new Map((Array.isArray(roles) ? roles : []).map((role) => [String(role?.name || "").trim(), role]).filter(([name]) => Boolean(name)));
  const hasNestedPath = (source, fieldPath) => String(fieldPath || "").split(".").filter(Boolean).every((part) => {
    if (!source || typeof source !== "object" || Array.isArray(source) || !Object.hasOwn(source, part)) return false;
    source = source[part];
    return true;
  });
  for (const role of roleMap.values()) {
    const ownInitial = role.initialVariables;
    if (!ownInitial || typeof ownInitial !== "object" || Array.isArray(ownInitial)) continue;
    const texts = [role.personaContent, role.personaEntry?.content, role.persona, role.behaviorGuidance]
      .filter((value) => typeof value === "string");
    for (const text of texts) {
      for (const match of text.matchAll(/getvar\(['"]stat_data\.角色\.([^.'"]+)\.([^'"]+)['"]/g)) {
        const [, roleName, field] = match;
        const target = roleMap.get(roleName);
        assert(target, `${path} EJS reads unknown role: ${roleName}`);
        const initial = target.initialVariables;
        assert(initial && typeof initial === "object" && !Array.isArray(initial) && hasNestedPath(initial, field), `${path} EJS reads missing initial field: ${roleName}.${field}`);
        if (field.includes("敏感度")) assert(SENSITIVITY_EJS_FIELDS.has(field.split(".").at(-1)), `${path} EJS reads non-whitelist sensitivity field: ${roleName}.${field}`);
      }
      for (const match of text.matchAll(/\{\{(?:get|format)_message_variable::stat_data\.角色\.([^}.]+)(?:\.([^}]+))?\}\}/g)) {
        const [, roleName, field] = match;
        const target = roleMap.get(roleName);
        assert(target, `${path} display macro reads unknown role: ${roleName}`);
        if (field) {
          const initial = target.initialVariables;
          assert(initial && typeof initial === "object" && !Array.isArray(initial) && hasNestedPath(initial, field), `${path} display macro reads missing initial field: ${roleName}.${field}`);
          if (field.includes("敏感度")) assert(SENSITIVITY_EJS_FIELDS.has(field.split(".").at(-1)), `${path} display macro reads non-whitelist sensitivity field: ${roleName}.${field}`);
        }
      }
    }
  }
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function readTextFilesRecursive(root) {
  const texts = [];
  async function visit(path) {
    let items = [];
    try {
      items = await readdir(path, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const child = `${path}/${item.name}`;
      if (item.isDirectory()) {
        await visit(child);
      } else if (/\.(?:json|txt|md|js|html)$/i.test(item.name)) {
        texts.push({ path: child, text: await readText(child) });
      }
    }
  }
  await visit(root);
  return texts;
}

function assertInlineScriptsParse(label, html) {
  let index = 0;
  for (const match of String(html || "").matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    index += 1;
    try {
      new Script(match[1], { filename: `${label}-inline-${index}.js` });
    } catch (error) {
      throw new Error(`${label} inline script ${index} failed to parse: ${error?.message || error}`);
    }
  }
  assert(index > 0, `${label} contains no inline scripts to validate`);
}

const parsed = parseCharacterCard(await readFile(CARD_PATH));
const data = parsed.card.data || parsed.card;
const entries = data.character_book?.entries || [];
const artifactText = JSON.stringify(data);
const coverBytes = await readFile(CARD_COVER_PATH);
const coverSha256 = createHash("sha256").update(coverBytes).digest("hex");
const pngImageCore = (value) => {
  const parsedPng = parsePngChunks(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  const parts = [value.subarray(0, 8)];
  for (const chunk of parsedPng.chunks) {
    if (chunk.type === "tEXt") {
      const zero = chunk.data.indexOf(0);
      const key = zero >= 0 ? Buffer.from(chunk.data.subarray(0, zero)).toString("latin1") : "";
      if (key === "chara" || key === "ccv3") continue;
    }
    parts.push(Buffer.from(chunk.raw));
  }
  return Buffer.concat(parts.map((part) => Buffer.from(part)));
};
const readPngDimensions = (value) => {
  const parsedPng = parsePngChunks(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  const ihdr = parsedPng.chunks.find((chunk) => chunk.type === "IHDR")?.data;
  assert(ihdr?.length >= 8, "card cover must contain a valid IHDR chunk");
  return { width: Buffer.from(ihdr).readUInt32BE(0), height: Buffer.from(ihdr).readUInt32BE(4) };
};
assert(JSON.stringify(readPngDimensions(coverBytes)) === JSON.stringify({ width: 640, height: 800 }), "card cover source must be exactly 640x800");
assert(JSON.stringify(readPngDimensions(Buffer.from(parsed.imageBuffer))) === JSON.stringify({ width: 640, height: 800 }), "final card cover must be exactly 640x800");
assert(pngImageCore(Buffer.from(parsed.imageBuffer)).equals(coverBytes), "final card PNG image core must exactly match the maintained cover source");
for (const helper of data.extensions?.tavern_helper?.scripts || []) {
  const syntax = spawnSync(process.execPath, ["--check", "--input-type=module", "-"], {
    input: String(helper?.content || ""),
    encoding: "utf8",
  });
  assert(
    syntax.status === 0,
    `final protected Tavern Helper module must parse (${helper?.name || helper?.id || "unknown"}): ${String(syntax.stderr || syntax.stdout || "syntax error").trim()}`,
  );
}
assert(!artifactText.includes("2024基准年龄") && !/AI只读[^。]{0,80}年龄|年龄[^。]{0,80}AI只读/u.test(artifactText), "final card must not derive, govern, or add read-only restrictions to authored character ages");
assert(String(parsed.card?.name || "") === String(data.name || ""), "root card name must equal data.name");
assert(parsed.metadata?.hasChara && parsed.metadata?.hasCcv3 && parsed.metadata?.charaEqualsCcv3, "PNG chara and ccv3 payloads must both exist and remain semantically identical");
assert(String(data.name || "") === CARD_DISPLAY_NAME, `card display name must be ${CARD_DISPLAY_NAME}`);
assert(String(data.character_version || "") === VERSION_NAME, `card character_version must be ${VERSION_NAME}`);
const integrity = data.extensions?.hypnoos_integrity;
assert(integrity?.schema === INTEGRITY_SCHEMA, "card integrity manifest schema is missing or invalid");
assert(integrity?.project_id === INTEGRITY_PROJECT_ID, "card integrity project id is missing or invalid");
assert(integrity?.integrity_version === INTEGRITY_VERSION && integrity?.canonicalization === "hypnoos-card-cover-v2", "card integrity canonicalization must include the cover contract");
assert(integrity?.cover_sha256 === coverSha256, "card integrity cover hash must match the maintained cover source");
assert(integrity?.release_version === VERSION_NAME, "card integrity version must match the current build version");
assert(integrity?.card_name === data.name, "card integrity name must match card data");
assert(integrity?.worldbook_name === data.character_book?.name, "card integrity worldbook name must match card data");
assert(integrity?.world_binding === data.extensions?.world, "card integrity world binding must match card data");
assert(integrity?.distribution_tree_sha256 === await distributionTreeSha256(), "card integrity frontend tree hash must match the current publish tree");
const expectedRemoteCommit = String(process.env.HYPNOOS_REMOTE_COMMIT || "").trim();
if (RELEASE_CARD_MODE) {
  assert(integrity?.mode === "remote", "release card integrity mode must be remote");
  assert(/^[a-f0-9]{40}$/.test(String(integrity?.remote_commit || "")), "release card integrity must contain an exact 40-character commit");
  if (expectedRemoteCommit) assert(integrity.remote_commit === expectedRemoteCommit, "release card integrity commit must equal HYPNOOS_REMOTE_COMMIT");
  const pins = [...JSON.stringify(data).matchAll(/cdn\.jsdelivr\.net\/gh\/[^@"']+@([a-f0-9]{40})\//g)].map((match) => match[1]);
  assert(pins.length > 0 && pins.every((commit) => commit === integrity.remote_commit), "every release CDN reference must use the manifest commit");
} else {
  assert(integrity?.mode === "local" && integrity?.remote_commit === "", "local card integrity must not claim a remote commit");
}
assert(/^[a-f0-9]{64}$/.test(String(integrity?.fingerprints?.runtime || "")), "card runtime fingerprint must be SHA-256");
assert(/^[a-f0-9]{64}$/.test(String(integrity?.fingerprints?.package || "")), "card package fingerprint must be SHA-256");
assert(Array.isArray(integrity?.surfaces) && integrity.surfaces.length > 50, "card integrity surface manifest is incomplete");
const integrityFingerprints = recomputeIntegrityFingerprints(parsed.card);
assert(integrityFingerprints.runtime === integrity.fingerprints.runtime, "card runtime fingerprint does not match the final artifact");
assert(integrityFingerprints.package === integrity.fingerprints.package, "card package fingerprint does not match the final artifact");
const integrityCore = await recomputeIntegrityManifestCore(parsed.card, {
  version: VERSION_NAME,
  mode: RELEASE_CARD_MODE ? "remote" : "local",
  remoteCommit: integrity.remote_commit || "",
  coverSha256,
});
for (const key of ["content_digest", "build_revision", "canary", "distribution_tree_sha256"]) {
  assert(integrity[key] === integrityCore[key], `card integrity ${key} must be independently reproducible`);
}
assert(JSON.stringify(integrity.surfaces) === JSON.stringify(integrityCore.surfaces), "card integrity surface hashes must be independently reproducible");
const integrityScripts = data.extensions?.tavern_helper?.scripts || [];
assert(integrityScripts[0]?.id === INTEGRITY_GATE_ID && integrityScripts[0]?.name === INTEGRITY_GATE_NAME && integrityScripts[0]?.enabled === true, "integrity gate must be first and enabled");
assert(integrityScripts.filter((script) => script?.id === INTEGRITY_GATE_ID).length === 1, "integrity gate must be unique");
for (const script of integrityScripts.slice(1)) {
  assert(String(script?.content || "").includes(EXPECTED_OPEN), `protected helper is missing its integrity envelope: ${script?.name || script?.id}`);
}
const mainWorldbookBootstraps = integrityScripts.filter((script) => script?.name === "主世界书自动导入绑定（请勿关闭）");
assert(mainWorldbookBootstraps.length === 1 && mainWorldbookBootstraps[0]?.enabled === true, "main embedded worldbook bootstrap must exist exactly once and stay enabled");
for (const needle of ["convertCharacterBook", "loadWorldInfo", "saveWorldInfo", "主世界书写后读回不完整", "card?.extensions?.world || '') !== worldName"]) {
  assert(String(mainWorldbookBootstraps[0]?.content || "").includes(needle), `main worldbook bootstrap is missing its fail-closed contract: ${needle}`);
}
assert(!String(mainWorldbookBootstraps[0]?.content || "").includes("rebindCharWorldbooks"), "main worldbook bootstrap must not mutate an already exact protected card binding");
function runIntegrityGateSandbox(cardData, idKey = "characterId") {
  let currentData = cardData;
  let subscriptions = 0;
  const sandbox = {
    TextEncoder,
    Promise,
    console: { log() {}, warn() {}, error() {} },
    document: { querySelectorAll: () => [] },
    eventOn() { subscriptions += 1; },
    SillyTavern: { getContext: () => currentData ? ({ [idKey]: 0, name2: currentData.name, characters: [{ data: currentData }] }) : ({ characters: [] }) },
  };
  sandbox.globalThis = sandbox;
  new Script(String(integrityScripts[0]?.content || ""), { filename: "hypnoos-integrity-gate.js" }).runInNewContext(sandbox);
  return {
    gate: sandbox.__ST_HYPNOOS_INTEGRITY_GATE_V1__,
    setData(value) { currentData = value; },
    subscriptions: () => subscriptions,
  };
}
function runIntegrityGateFixture(cardData, idKey) { return runIntegrityGateSandbox(cardData, idKey).gate; }
assert(runIntegrityGateFixture(data)?.authorized === true, "integrity gate must authorize the unchanged final card");
assert(runIntegrityGateFixture(data, "chid")?.authorized === true, "integrity gate must resolve the host chid alias including index zero");
assert(runIntegrityGateFixture(null)?.authorized === false, "integrity gate must fail closed when current character context is unavailable");
assert(String(INTEGRITY_GATE_ID).startsWith("00000000-"), "integrity gate id must sort before every protected Tavern Helper iframe");
{
  const host = {
    TextEncoder,
    Promise,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    console: { log() {}, warn() {}, error() {} },
    document: { querySelectorAll: () => [] },
    SillyTavern: { getContext: () => ({ characterId: 0, name2: data.name, characters: [{ data }] }) },
  };
  host.globalThis = host;
  host.parent = host;
  host.top = host;
  const protectedScript = integrityScripts.find((script) => script?.id !== INTEGRITY_GATE_ID);
  const isolatedContent = String(protectedScript?.content || "").replace(
    /\/\*<HYPNOOS_PAYLOAD_V2>\*\/[\s\S]*?\/\*<\/HYPNOOS_PAYLOAD_V2>\*\//,
    "/*<HYPNOOS_PAYLOAD_V2>*/\nglobalThis.__hypnoosIsolatedFixtureStarted = true;\n/*</HYPNOOS_PAYLOAD_V2>*/",
  );
  const helperRealm = {
    globalThis: null,
    parent: host,
    top: host,
    TextEncoder,
    Promise,
    Date,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    console: { log() {}, warn() {}, error() {} },
  };
  helperRealm.globalThis = helperRealm;
  const pending = new Script(`(async () => {\n${isolatedContent}\n})()`, { filename: "hypnoos-protected-helper-isolated.js" }).runInNewContext(helperRealm);
  assert(helperRealm.__hypnoosIsolatedFixtureStarted !== true, "protected helper must wait when its isolated realm starts before the shared gate");
  const gateRealm = { ...host, globalThis: null, parent: host, top: host };
  gateRealm.globalThis = gateRealm;
  new Script(String(integrityScripts[0]?.content || ""), { filename: "hypnoos-integrity-gate-isolated.js" }).runInNewContext(gateRealm);
  await Promise.resolve(pending);
  assert(host.__ST_HYPNOOS_INTEGRITY_GATE_V1__?.authorized === true, "integrity gate must publish authorization to the shared host realm");
  assert(helperRealm.__hypnoosIsolatedFixtureStarted === true, "protected helper must start exactly after the shared cross-realm gate becomes authorized");
}
{
  const runtime = runIntegrityGateSandbox(data);
  assert(runtime.subscriptions() >= 4, "integrity gate must subscribe through global eventOn when eventSource is unavailable");
  let disposed = 0;
  runtime.gate.register("fixture", () => { disposed += 1; });
  assert(runtime.gate.evaluate() && disposed === 0, "unchanged re-evaluation must not tear down authorized components");
  const tampered = structuredClone(data);
  tampered.name += "-tampered";
  runtime.setData(tampered);
  assert(!runtime.gate.evaluate() && disposed === 1, "authorized-to-unauthorized transition must dispose registered components exactly once");
}
for (const mutate of [
  (clone) => { clone.data.name += "-tampered"; },
  (clone) => { clone.data.character_book.name += "-tampered"; },
  (clone) => { clone.data.extensions.tavern_helper.scripts[1].content += "\n// tampered"; },
  (clone) => { clone.data.creator += "-tampered"; },
  (clone) => { clone.data.extensions.hypnoos_integrity.project_id += "-tampered"; },
  (clone) => { clone.data.extensions.hypnoos_integrity.canary += "-tampered"; },
  (clone) => { clone.data.extensions.hypnoos_integrity.cover_sha256 = "0".repeat(64); },
  (clone) => { clone.data.extensions.world += "-tampered"; },
  (clone) => { clone.data.extensions.regex_scripts[0].replaceString += "<!-- tampered -->"; },
  (clone) => { clone.data.extensions.hypnoos_integrity.distribution_tree_sha256 = "0".repeat(64); },
]) {
  const clone = structuredClone(parsed.card);
  mutate(clone);
  assert(runIntegrityGateFixture(clone.data)?.authorized === false, "integrity gate must reject the tampered runtime surface");
}
const upgradeVersion = `${VERSION_NAME}-integrity-upgrade-test`;
const upgradeFixture = structuredClone(parsed.card);
upgradeFixture.data.name = upgradeFixture.name = `${CARD_DISPLAY_NAME} ${upgradeVersion}`;
upgradeFixture.data.character_version = upgradeVersion;
upgradeFixture.data.character_book.name = `催眠APP（二改MVU ${upgradeVersion}）`;
upgradeFixture.data.extensions.world = upgradeFixture.data.character_book.name;
const upgradedIntegrity = await applyCardIntegrity(upgradeFixture, { version: upgradeVersion, mode: RELEASE_CARD_MODE ? "remote" : "local", remoteCommit: integrity.remote_commit || "", coverSha256 });
assert(upgradedIntegrity.build_revision !== integrity.build_revision, "normal version upgrade must regenerate the integrity revision");
assert(upgradedIntegrity.fingerprints.runtime !== integrity.fingerprints.runtime, "normal version upgrade must regenerate the runtime fingerprint");
assert(recomputeIntegrityFingerprints(upgradeFixture).runtime === upgradedIntegrity.fingerprints.runtime, "new-version integrity must authorize its own final content");
const frontendSource = await readText("scripts/mirror-frontend.mjs");
assert(
  frontendSource.includes('"犬冢夏美": { "衣着"')
    && frontendSource.includes('"社团或职业": "田径部", "身高": "148cm", "体重": "40kg", "三围": "B72 / W52 / H76（A罩杯）"')
    && !frontendSource.includes('"犬冢夏美": { "衣着": { "头发": "短发", "面部": "开朗", "上衣": "校服", "下衣": "校裙" }, "信息": { "姓名": "犬冢夏美", "性别": "女", "_年龄": "17", "社团或职业": "学生", "身高": "160cm"'),
  "local preview fixture must preserve Natsumi's authoritative 148cm profile",
);
for (const needle of [
  "if (!window.__ST_HYPNOOS_HAS_FRONTEND_CONTEXT__()) return false",
  "if (!current || latestIds.size === 0) return false",
  "Mutations must never fall through to the host's implicit/default scope",
  "const readBackMvu = await Mvu.getMvuData(option)",
  "课程表变量同步回滚未能确认",
]) {
  assert(frontendSource.includes(needle), `frontend missing fail-closed MVU transaction contract: ${needle}`);
}
{
  const migrationStart = frontendSource.indexOf("async function migrateCurrentMvuContractOnce()");
  const migrationEnd = frontendSource.indexOf("window.__ST_HYPNOOS_MIGRATE_CURRENT_MVU_CONTRACT__", migrationStart);
  const migrationSource = frontendSource.slice(migrationStart, migrationEnd);
  assert(migrationSource.includes("{ preserveValues: true }"), "automatic contract migration must preserve existing known values");
  assert(!migrationSource.includes("normalizeStatRolePages("), "automatic contract migration must not rewrite role profile fields such as age");
}
{
  const roleNormalizeStart = frontendSource.indexOf("function normalizeRoleSevenPages(");
  const roleNormalizeEnd = frontendSource.indexOf("function roleSevenPagesComplete", roleNormalizeStart);
  const roleNormalizeSource = frontendSource.slice(roleNormalizeStart, roleNormalizeEnd);
  assert(!roleNormalizeSource.includes('copyIfMissing("信息", "_年龄"') && !roleNormalizeSource.includes('delete existingInfo["年龄"]'), "role-page compatibility migration must leave existing age fields untouched");
}
{
  const repairStart = frontendSource.indexOf("async function repairCurrentMvuDynamicSchema()");
  const repairEnd = frontendSource.indexOf("function refreshPhoneVariableViews", repairStart);
  const repairSource = frontendSource.slice(repairStart, repairEnd);
  assert(repairSource.includes("return false") && !repairSource.includes("window.Mvu.replaceMvuData("), "automatic dynamic-schema refresh must not mutate host MVU state or report a fake repair");
}
for (const needle of [
  "renderProfileChildRoleManualForm",
  "profileChildRoleManualPayload",
  "data-profile-child-role-form",
  "encounterInitialVariablesFormHtml",
  "encounterPersonaContent",
  "profileChildRoleStaticVariableWorldbookContent",
  "角色卡世界书写入失败",
  "无法读取当前角色卡世界书，未写入任何内容",
  "自动回滚未完全通过校验",
  "变量处理: \"前端已结算\"",
  "AI不可写路径"
]) {
  assert(frontendSource.includes(needle), `child-to-role manual form/worldbook workflow missing: ${needle}`);
}
assert(!frontendSource.includes("function generateProfileChildRoleWithConnector"), "child-to-role workflow must not call an independent text model");
assert(!frontendSource.includes("function profileChildRoleGenerationPayload"), "obsolete child-to-role connector payload parser must be removed");
const childManualWorkflowStart = frontendSource.indexOf("function renderProfileChildRoleManualForm");
const childManualWorkflowEnd = frontendSource.indexOf("\n  function renderProfileChildrenPanel", childManualWorkflowStart);
assert(childManualWorkflowStart >= 0 && childManualWorkflowEnd > childManualWorkflowStart, "missing complete child-to-role manual workflow");
const childManualWorkflowSource = frontendSource.slice(childManualWorkflowStart, childManualWorkflowEnd);
assert(!childManualWorkflowSource.includes("invokeIndependentTextModel"), "child-to-role manual workflow must not invoke the independent text model");
for (const needle of [
  "hospitalLineWorldbookCommentSnapshot",
  "encounterRoleExistsInWorldbook",
  "PROFILE_CHILD_ROLE_ACTIVE_SCOPES",
  "PROFILE_CHILD_ROLE_ACTIVE_NAMES",
  "profileChildRoleCloneCandidate",
  "profileChildRoleCommitted",
  "profileChildRoleWorldbookVerified",
  "profileChildRoleRollbackVariable",
  "hospitalLineRollbackWorldbook",
  "const lockedWorldbook = await encounterReadCharacterWorldEntries(worldbookPackage)",
  "const lockedLatest = encounterCurrentMvuData()",
  "角色卡世界书绑定在校验期间发生变化",
  "当前变量楼层在校验期间发生变化",
  "profileChildRoleSnapshotJson(roles[nextName]) !== profileChildRoleSnapshotJson(expectedInitialVariables)",
  "if (!added) throw new Error(\"暂存区写入失败。\")",
  "已恢复角色变量、母亲子嗣记录与角色卡世界书"
]) {
  assert(childManualWorkflowSource.includes(needle), `child-to-role collision/rollback guard missing: ${needle}`);
}
for (const needle of [
  "profileChildRoleExactInitialVariables",
  "profileChildRoleHasExactContract",
  "PROFILE_CHILD_ROLE_ROOT_KEYS",
  "该角色名属于系统保留名称",
  "profileChildPath(roleName, childKey)",
  "profileChildRoleRootPath(nextName)"
]) {
  assert(childManualWorkflowSource.includes(needle), `child-to-role exact ten-page contract missing: ${needle}`);
}
assert(
  childManualWorkflowSource.indexOf("profileChildRoleCommitted(")
    < childManualWorkflowSource.indexOf("encounterInsertPackageWorldbooks(worldbookPackage)"),
  "child-to-role transaction must read back the exact role variable contract before writing worldbook entries"
);
assert(
  childManualWorkflowSource.indexOf("profileChildRoleWorldbookVerified(")
    < childManualWorkflowSource.indexOf("appendAppOperation(payload)"),
  "child-to-role transaction must verify both worldbook entries before staging the operation"
);
const childStaticWorldbookStart = frontendSource.indexOf("function profileChildRoleStaticVariableWorldbookContent");
const childStaticWorldbookEnd = frontendSource.indexOf("\n  function profileChildRoleWorldbookEntries", childStaticWorldbookStart);
assert(childStaticWorldbookStart >= 0 && childStaticWorldbookEnd > childStaticWorldbookStart, "missing child static variable worldbook builder");
const childStaticWorldbookSource = frontendSource.slice(childStaticWorldbookStart, childStaticWorldbookEnd);
assert(!childStaticWorldbookSource.includes("getvar(") && !childStaticWorldbookSource.includes("<%"), "child variable worldbook must be a static initial snapshot");
{
  const start = frontendSource.indexOf("const PROFILE_CHILD_ROLE_ROOT_KEYS");
  const end = frontendSource.indexOf("\n  function profileChildRoleManualPayload", start);
  assert(start >= 0 && end > start, "missing child-to-role exact-contract helper block");
  const helperSource = frontendSource.slice(start, end);
  const roleRootKeys = ["衣着", "信息", "状态", "事件", "敏感", "效果", "劣迹", "改造", "物品", "子嗣"];
  const defaultRole = (role = {}) => {
    const gender = role.gender === "男" ? "男" : "女";
    return {
      衣着: { 头发: "未记录", 面部: "未记录", 上衣: "未记录", 下衣: "未记录" },
      信息: {
        姓名: role.name || "",
        性别: gender,
        _年龄: role.age || "未记录",
        社团或职业: "未记录",
        身高: "未记录",
        体重: "未记录",
        ...(gender === "男" ? { 阴茎长度: "未记录" } : { 三围: "未记录" }),
        绰号: "",
        绰号已认可: false
      },
      状态: { 好感度: 0, 警戒度: 0, 服从度: 0, 性欲: 0, 快感值: 0 },
      事件: { _事件记录: "000000", 至关重要记忆: "" },
      敏感: gender === "男"
        ? { 阴茎敏感度: 100, 龟头敏感度: 100, 前列腺敏感度: 100, 尿道敏感度: 100, 乳头敏感度: 100, 阴茎高潮次数: 0, 龟头高潮次数: 0, 前列腺高潮次数: 0, 尿道高潮次数: 0, 乳头高潮次数: 0 }
        : { 阴蒂敏感度: 100, 小穴敏感度: 100, 菊穴敏感度: 100, 尿道敏感度: 100, 乳头敏感度: 100, 阴蒂高潮次数: 0, 小穴高潮次数: 0, 菊穴高潮次数: 0, 尿道高潮次数: 0, 乳头高潮次数: 0 },
      效果: { 心理: "未记录", 临时催眠效果: {}, 永久催眠效果: {} },
      劣迹: { 性格: {}, 罪行: { 盗窃: 0, 露出: 0, 私闯: 0, 伤害: 0, 淫乱: 0, 强奸: 0 } },
      改造: {},
      物品: { 持有: {} },
      子嗣: { 是否妊娠中: false, 生产数量: 0, 子嗣列表: {} }
    };
  };
  const sandbox = {
    Array,
    JSON,
    Math,
    Number,
    Object,
    Promise,
    Set,
    String,
    ROLE_PAGE_SECTIONS: roleRootKeys.slice(0, 7),
    ROLE_EXTRA_ROOT_OBJECTS: roleRootKeys.slice(7),
    ROLE_CLOTHING_FIELDS: ["头发", "面部", "上衣", "下衣"],
    ROLE_STATE_FIELDS: ["好感度", "警戒度", "服从度", "性欲", "快感值"],
    ROLE_EVENT_FIELDS: ["_事件记录", "至关重要记忆"],
    ROLE_MALE_SENSITIVE_FIELDS: ["阴茎敏感度", "龟头敏感度", "前列腺敏感度", "尿道敏感度", "乳头敏感度", "阴茎高潮次数", "龟头高潮次数", "前列腺高潮次数", "尿道高潮次数", "乳头高潮次数"],
    ROLE_FEMALE_SENSITIVE_FIELDS: ["阴蒂敏感度", "小穴敏感度", "菊穴敏感度", "尿道敏感度", "乳头敏感度", "阴蒂高潮次数", "小穴高潮次数", "菊穴高潮次数", "尿道高潮次数", "乳头高潮次数"],
    ROLE_REMODEL_AREAS: ["头"],
    ROLE_REMODEL_DETAIL_FIELDS: { 头: ["头", "脸", "发", "其他"] },
    isPlainObject(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    },
    encounterClone(value) {
      return structuredClone(value);
    },
    encounterNormalizeRole(role) {
      return { ...role };
    },
    normalizedRoleGender(value) {
      return value === "男" ? "男" : "女";
    },
    normalizeRoleSevenPages() {},
    encounterDefaultInitialVariableObject: defaultRole,
    ensureRoleBaselineItems(value) {
      const held = value?.持有 && typeof value.持有 === "object" ? value.持有 : {};
      return {
        持有: Object.fromEntries(Object.entries(held).map(([name, item]) => [
          name,
          { 描述: String(item?.描述 || "未记录"), 数量: Math.max(1, Number(item?.数量) || 1), 固定: item?.固定 === true }
        ]))
      };
    },
    normalizeRoleChildren(value) {
      const source = value && typeof value === "object" ? value : {};
      const list = {};
      for (const [key, child] of Object.entries(source.子嗣列表 || {})) {
        list[key] = {
          名称: String(child?.名称 || "未命名"),
          性别: "女",
          阶段: ["胚胎", "孩童", "角色"].includes(child?.阶段) ? child.阶段 : "胚胎",
          妊娠开始日期: String(child?.妊娠开始日期 || ""),
          出生日期: String(child?.出生日期 || ""),
          角色名: String(child?.角色名 || ""),
          说明: String(child?.说明 || "")
        };
      }
      return {
        是否妊娠中: source.是否妊娠中 === true,
        生产数量: Math.max(0, Math.floor(Number(source.生产数量) || 0)),
        子嗣列表: list
      };
    },
    encounterPlainLine(value) {
      return String(value || "").replace(/[\r\n]+/g, " ").trim();
    }
  };
  new Script(
    helperSource
      + "\nglobalThis.exactChildRole = profileChildRoleExactInitialVariables;"
      + "\nglobalThis.validChildRole = profileChildRoleHasExactContract;"
      + "\nglobalThis.childRoleRootPath = profileChildRoleRootPath;",
    { filename: "child-role-exact-contract.js" }
  ).runInNewContext(sandbox);
  for (const gender of ["女", "男"]) {
    const input = defaultRole({ name: "测试子嗣", gender, age: "12岁" });
    input.未知根 = { 错误: true };
    input.信息.未知键 = "不应保留";
    input.敏感.未知敏感键 = 999;
    input.劣迹.罪行.未知罪行 = 3;
    input.改造 = { 头: { 发: "保留", 未知细分: "删除" }, 未知部位: { 其他: "删除" } };
    input.物品 = { 持有: { 护符: { 描述: "测试", 数量: 1, 固定: true, 未知键: "删除" } }, 未知组: {} };
    const output = sandbox.exactChildRole(input, { name: "测试子嗣", gender, age: "12岁" });
    assert(Object.keys(output).length === 10 && roleRootKeys.every((key) => Object.hasOwn(output, key)), `child-to-role ${gender} contract must contain exactly ten roots`);
    assert(!Object.hasOwn(output, "未知根") && !Object.hasOwn(output.信息, "未知键"), `child-to-role ${gender} contract must strip unknown root/fixed keys`);
    assert(!Object.hasOwn(output.敏感, "未知敏感键") && !Object.hasOwn(output.劣迹.罪行, "未知罪行"), `child-to-role ${gender} contract must strip unknown sensitive/crime keys`);
    assert(!Object.hasOwn(output.改造, "未知部位") && !Object.hasOwn(output.改造.头, "未知细分"), `child-to-role ${gender} contract must strip unknown remodel keys`);
    assert(sandbox.validChildRole(output, { name: "测试子嗣", gender, age: "12岁" }), `child-to-role ${gender} exact contract must validate its normalized output`);
    output.信息.未知键 = true;
    assert(!sandbox.validChildRole(output, { name: "测试子嗣", gender, age: "12岁" }), `child-to-role ${gender} exact contract must reject an added unknown key`);
  }
  assert(sandbox.childRoleRootPath("A/B~C") === "/角色/A~1B~0C", "child-to-role role root must use JSON Pointer escaping");
}
const lineWorldbookSnapshotStart = frontendSource.indexOf("function hospitalLineWorldbookCommentRecords");
const lineWorldbookSnapshotEnd = frontendSource.indexOf("\n  async function hospitalLineStart", lineWorldbookSnapshotStart);
assert(lineWorldbookSnapshotStart >= 0 && lineWorldbookSnapshotEnd > lineWorldbookSnapshotStart, "missing branch-line worldbook transaction snapshot");
const lineWorldbookSnapshotSource = frontendSource.slice(lineWorldbookSnapshotStart, lineWorldbookSnapshotEnd);
for (const needle of [
  "encounterEnsureCharacterWorldbookWithTavernHelper",
  'getWorldbook(helperBound.worldName)',
  "updateWorldbookWith(bound.worldName",
  "encounterEnsureCharacterWorldbookWithSillyTavernModule",
  "hospitalLineRestoreWorldbookCommentRecords",
  "ENCOUNTER_WORLDBOOK_BOUNDARY_COMMENTS",
  "hospitalLineRollbackWorldbookBinding"
]) {
  assert(lineWorldbookSnapshotSource.includes(needle), `branch-line worldbook transaction is missing host-bridge compatibility: ${needle}`);
}
assert(
  lineWorldbookSnapshotSource.indexOf("encounterEnsureCharacterWorldbookWithTavernHelper")
    < lineWorldbookSnapshotSource.indexOf("encounterEnsureCharacterWorldbookWithSillyTavernModule"),
  "branch-line worldbook preflight must try the floating-phone Tavern Helper bridge before direct module import"
);
const characterWorldbookEnsureStart = frontendSource.indexOf("async function encounterEnsureCharacterWorldbookWithTavernHelper");
const characterWorldbookEnsureEnd = frontendSource.indexOf("\n  async function encounterInsertEntriesWithTavernHelper", characterWorldbookEnsureStart);
assert(characterWorldbookEnsureStart >= 0 && characterWorldbookEnsureEnd > characterWorldbookEnsureStart, "missing Tavern Helper character-worldbook resolver");
const characterWorldbookEnsureSource = frontendSource.slice(characterWorldbookEnsureStart, characterWorldbookEnsureEnd);
{
  const calls = { create: [], rebind: [] };
  let books = { primary: null, additional: [] };
  const target = {
    async getCharWorldbookNames() {
      return structuredClone(books);
    },
    async createWorldbook(worldName, worldbook) {
      calls.create.push({ worldName, worldbook: structuredClone(worldbook) });
      return true;
    },
    async rebindCharWorldbooks(_characterName, nextBooks) {
      calls.rebind.push(structuredClone(nextBooks));
      books = structuredClone(nextBooks);
    }
  };
  const sandbox = {
    Array,
    Object,
    Promise,
    Set,
    String,
    encounterTavernHelperTargets() {
      return [target];
    },
    encounterNormalizeBoundWorldbooks(value) {
      return {
        primary: String(value?.primary || "").trim() || null,
        additional: Array.isArray(value?.additional) ? value.additional.slice() : []
      };
    },
    encounterBoundWorldbookNameFromBooks(value) {
      return String(value?.primary || value?.additional?.[0] || "").trim();
    },
    encounterCurrentCharacterEmbeddedWorldbook() {
      return {
        name: "旧卡内置完整世界书",
        entries: [
          { comment: "旧卡基础规则甲", content: "base-a" },
          { comment: "旧卡基础规则乙", content: "base-b" }
        ]
      };
    },
    encounterSafeWorldbookName(value) {
      return String(value || "").trim();
    },
    encounterToTavernHelperEntry(entry) {
      return { name: entry.comment, content: entry.content };
    },
    encounterClone(value) {
      return structuredClone(value);
    }
  };
  new Script(
    characterWorldbookEnsureSource + "\nglobalThis.ensureCharacterWorldbook = encounterEnsureCharacterWorldbookWithTavernHelper;",
    { filename: "character-worldbook-resolver.js" }
  ).runInNewContext(sandbox);
  const created = await sandbox.ensureCharacterWorldbook({}, "不应使用的缩略回退名", { create: true });
  assert(created?.worldName === "旧卡内置完整世界书" && created.createdBinding && created.createdWorldbook, "unbound legacy cards must bind a full embedded character worldbook before a branch transaction");
  assert(calls.create.length === 1 && calls.create[0].worldbook.length === 2, "legacy binding must seed the complete embedded worldbook instead of a route-only book");
  assert(calls.rebind.length === 1 && calls.rebind[0].primary === "旧卡内置完整世界书", "legacy binding must bind the created book to the current character");
  books = { primary: null, additional: ["旧附加主书"] };
  const reused = await sandbox.ensureCharacterWorldbook({}, "不应创建的新书", { create: true });
  assert(reused?.worldName === "旧附加主书" && !reused.createdBinding, "legacy additional character-worldbook bindings must be reused without creating another target");
  assert(calls.create.length === 1 && calls.rebind.length === 1, "an existing legacy bound worldbook must not be recreated or rebound");
}
const insertWorldbookStart = frontendSource.indexOf("async function encounterInsertPackageWorldbooks");
const insertWorldbookEnd = frontendSource.indexOf("\n  function encounterConfirm", insertWorldbookStart);
assert(insertWorldbookStart >= 0 && insertWorldbookEnd > insertWorldbookStart, "missing dynamic character-worldbook insertion");
const insertWorldbookSource = frontendSource.slice(insertWorldbookStart, insertWorldbookEnd);
assert(
  insertWorldbookSource.indexOf("encounterInsertEntriesWithTavernHelper")
    < insertWorldbookSource.indexOf("encounterInsertEntriesWithSillyTavernModule"),
  "dynamic worldbook insertion must use the same Tavern Helper binding priority as branch preflight and rollback"
);
{
  let helperWorldbook = [
    { uid: 1, name: "保留条目甲", content: "keep-a", enabled: true },
    { uid: 2, name: "支线已有条目", content: "user-preserved", enabled: false },
    { uid: 3, name: "保留条目乙", content: "keep-b", enabled: true }
  ];
  let directModuleAttempts = 0;
  const helperBound = {
    worldName: "当前角色卡主世界书",
    method: "TavernHelper",
    createdBinding: false,
    createdWorldbook: false,
    target: {
      async getWorldbook() {
        return structuredClone(helperWorldbook);
      },
      async updateWorldbookWith(_worldName, updater) {
        helperWorldbook = await updater(structuredClone(helperWorldbook));
        return structuredClone(helperWorldbook);
      }
    }
  };
  let activeHelperBound = helperBound;
  const sandbox = {
    Array,
    JSON,
    Math,
    Number,
    Object,
    Promise,
    Set,
    String,
    ENCOUNTER_WORLDBOOK_BOUNDARY_COMMENTS: new Set(["支线布局边界"]),
    encounterWorldbookEntryList(pkg) {
      return pkg.entries;
    },
    encounterDefaultCharacterWorldbookName() {
      return "兼容回退名";
    },
    encounterCandidateWindows() {
      return [{}];
    },
    async encounterEnsureCharacterWorldbookWithTavernHelper() {
      return activeHelperBound;
    },
    async encounterEnsureCharacterWorldbookWithSillyTavernModule() {
      directModuleAttempts += 1;
      return null;
    },
    encounterClone(value) {
      return structuredClone(value);
    },
    encounterNormalizeBoundWorldbooks(value) {
      return {
        primary: String(value?.primary || "").trim() || null,
        additional: Array.isArray(value?.additional) ? value.additional.slice() : []
      };
    }
  };
  new Script(
    lineWorldbookSnapshotSource
      + "\nglobalThis.takeLineWorldbookSnapshot = hospitalLineWorldbookCommentSnapshot;"
      + "\nglobalThis.rollbackLineWorldbook = hospitalLineRollbackWorldbook;",
    { filename: "branch-line-worldbook-transaction.js" }
  ).runInNewContext(sandbox);
  const snapshot = await sandbox.takeLineWorldbookSnapshot({
    entries: [
      { comment: "支线已有条目" },
      { comment: "支线新增条目" }
    ]
  });
  assert(snapshot?.ok, "branch-line preflight must read the character worldbook through the floating-phone bridge");
  assert(snapshot.originals.length === 1 && snapshot.originals[0].entry.content === "user-preserved", "branch-line preflight must preserve existing user worldbook content");
  assert(directModuleAttempts === 0, "branch-line preflight must not require direct world-info module access when the host bridge works");
  helperWorldbook = [
    { uid: 1, name: "保留条目甲", content: "keep-a", enabled: true },
    { uid: 2, name: "支线已有条目", content: "temporarily-updated", enabled: true },
    { uid: 4, name: "支线新增条目", content: "new-route-entry", enabled: true },
    { uid: 5, name: "支线布局边界", content: "", enabled: false },
    { uid: 3, name: "保留条目乙", content: "keep-b", enabled: true }
  ];
  assert(await sandbox.rollbackLineWorldbook(snapshot), "branch-line rollback must work through updateWorldbookWith");
  assert(
    JSON.stringify(helperWorldbook.map((entry) => [entry.name, entry.content, entry.enabled])) === JSON.stringify([
      ["保留条目甲", "keep-a", true],
      ["支线已有条目", "user-preserved", false],
      ["保留条目乙", "keep-b", true]
    ]),
    "branch-line rollback must remove newly inserted route entries and restore existing entries without touching unrelated content"
  );
  const bindingCalls = { rebind: [], deleted: [] };
  activeHelperBound = {
    ...helperBound,
    worldName: "旧卡内置完整世界书",
    previousBooks: { primary: null, additional: [] },
    createdBinding: true,
    createdWorldbook: true,
    target: {
      ...helperBound.target,
      async rebindCharWorldbooks(_characterName, books) {
        bindingCalls.rebind.push(structuredClone(books));
      },
      async deleteWorldbook(worldName) {
        bindingCalls.deleted.push(worldName);
        return true;
      }
    }
  };
  helperWorldbook = [{ uid: 8, name: "保留条目甲", content: "keep-a", enabled: true }];
  const createdBindingSnapshot = await sandbox.takeLineWorldbookSnapshot({
    entries: [{ comment: "支线新增条目" }]
  });
  helperWorldbook.push({ uid: 9, name: "支线新增条目", content: "new-route-entry", enabled: true });
  assert(await sandbox.rollbackLineWorldbook(createdBindingSnapshot), "failed branch transactions must roll back a worldbook binding created for an old card");
  assert(bindingCalls.rebind.length === 1 && bindingCalls.rebind[0].primary === null, "old-card rollback must restore the previous unbound character-worldbook state");
  assert(bindingCalls.deleted.length === 1 && bindingCalls.deleted[0] === "旧卡内置完整世界书", "old-card rollback must delete only the worldbook created by this transaction");
}
const rewardDailyGuardStart = frontendSource.indexOf("function rewardDailyQuestAlreadyUsed");
const rewardDailyGuardEnd = frontendSource.indexOf("\n  function rewardPendingDailyQuestHas", rewardDailyGuardStart);
assert(rewardDailyGuardStart >= 0 && rewardDailyGuardEnd > rewardDailyGuardStart, "frontend missing daily-quest guard");
const rewardDailyGuardSource = frontendSource.slice(rewardDailyGuardStart, rewardDailyGuardEnd);
for (const helper of ["rewardFrontendCurrentPosition", "rewardDailyQuestStateKey", "rewardFrontendClaimRecordIsActive"]) {
  assert(rewardDailyGuardSource.includes(helper), `daily-quest guard must use lite-page scoped helper: ${helper}`);
}
for (const leakedHelper of ["frontendRewardCurrentPosition", "dailyQuestStateKey", "frontendRewardClaimRecordIsActive"]) {
  assert(!new RegExp(`(?<!reward)\\b${leakedHelper}\\b`).test(rewardDailyGuardSource), `daily-quest guard leaks React-closure helper: ${leakedHelper}`);
}
const orjenrnEncounterPackage = JSON.parse(await readText("public/frontends/hypnosis-app/assets/encounter/orjenrn/package.json"));
const p5rEncounterPackage = JSON.parse(await readText("public/frontends/hypnosis-app/assets/encounter/xiao-qiao-p5r/package.json"));
const polishedMiryukoSource = (await readText("src/worldbooks/miryuko-polished-persona.txt")).trim();
const comments = entries.map((entry) => String(entry.comment || ""));
const duplicateWorldbookComments = [...new Set(comments.filter((comment, index) => comment && comments.indexOf(comment) !== index))];
assert(!duplicateWorldbookComments.length, `worldbook comments must be unique: ${duplicateWorldbookComments.join(", ")}`);
for (const entry of entries) {
  const comment = String(entry?.comment || "(unnamed)");
  assert(Array.isArray(entry?.key), `worldbook key must be an array: ${comment}`);
  assert(Array.isArray(entry?.keysecondary), `worldbook keysecondary must be an array: ${comment}`);
  assert(JSON.stringify(entry?.key) === JSON.stringify(entry?.keys || []), `worldbook key/keys drift: ${comment}`);
  assert(JSON.stringify(entry?.keysecondary) === JSON.stringify(entry?.secondary_keys || []), `worldbook keysecondary/secondary_keys drift: ${comment}`);
}
const worldbookExtensionPosition = new Map([["before_char", 0], ["after_char", 1], ["at_depth", 4]]);
const sourcePreservedPositionComments = new Set([
  "[mvu_plot]阿宅女性化人设",
  "[mvu_plot] 办公室“薛定谔的温室”"
]);
for (const entry of entries.filter(isEntryEnabled)) {
  const comment = String(entry?.comment || "(unnamed)");
  const constant = Boolean(entry?.constant);
  const selective = Boolean(entry?.selective);
  const keys = Array.isArray(entry?.keys) ? entry.keys : Array.isArray(entry?.key) ? entry.key : [];
  assert(constant !== selective, `enabled worldbook must be exactly blue or green: ${comment}`);
  if (!constant) assert(keys.some((key) => String(key || "").trim()), `green worldbook must have a keyword: ${comment}`);
  const expectedExtensionPosition = worldbookExtensionPosition.get(String(entry?.position || ""));
  if (expectedExtensionPosition !== undefined && !sourcePreservedPositionComments.has(comment)) {
    assert(Number(entry?.extensions?.position) === expectedExtensionPosition, `worldbook position metadata mismatch: ${comment}`);
  }
}
for (const removedComment of ["[mvu_update]匿名版介绍", "催眠指导", "[mvu_plot]具体地点1*制作中", "[mvu_plot]具体地点2*制作中"]) {
  assert(!comments.includes(removedComment), `removed worldbook entry still exists: ${removedComment}`);
}
const otakuFemaleEntry = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]阿宅女性化人设");
const otakuFemalePackageEntry = (orjenrnEncounterPackage?.branchPersonaEntries || [])
  .find((entry) => String(entry?.comment || "") === "[mvu_plot]阿宅女性化人设");
for (const [label, entry] of [["card", otakuFemaleEntry], ["package", otakuFemalePackageEntry]]) {
  const content = String(entry?.content || "");
  assert(content, `${label} missing Otaku feminized persona`);
  for (const removedPhrase of [
    "HP归零",
    "属性面板",
    "系统设定Bug",
    "按键音设定",
    "系统宕机",
    "敏感度BUG修复情况",
    "设定更新”与“肉体覆写"
  ]) {
    assert(!content.includes(removedPhrase), `${label} Otaku feminized persona still treats reality as a game: ${removedPhrase}`);
  }
  for (const requiredPhrase of [
    "一旦聊起动画、漫画设定或游戏攻略",
    "清楚现实不是游戏，也不会真的把自己当成游戏角色",
    "偶尔会用新番、攻略或角色梗吐槽现实"
  ]) {
    assert(content.includes(requiredPhrase), `${label} Otaku feminized persona missing grounded otaku characterization: ${requiredPhrase}`);
  }
}
const legacyGalgameWorldbookComment = "[mvu_plot]（关闭galgame模式请关这个）Galgame人物演出";
assert(!entries.some((entry) => String(entry?.comment || "") === legacyGalgameWorldbookComment), "Galgame protocol must not remain in the worldbook");
const operationWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]本轮操作");
const operationPlotBoundaryWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]本轮操作执行边界");
const dailySchedulePlotWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]USER日程格执行边界");
const dailyScheduleUpdateWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]USER日程格变量规则");
const hypnosisSemanticPlotWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]催眠指令语义映射");
const hypnosisBillingWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]催眠命令计费规则");
const hypnosisOperationWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]APP操作-催眠与资源");
const hypnosisStateWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]角色催眠状态一致性");
const hypnosisEffectsPlotWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]当前有效催眠效果角色");
const currentSceneRoleScopeWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]当前出场角色变量范围");
const profileMiscWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]APP操作-档案与杂项");
assert(operationWorldbook?.constant === true && operationWorldbook?.selective === false && (operationWorldbook?.keys || []).length === 0, "current operation worldbook must be an always-on blue entry");
assert(!entries.some((entry) => ["[mvu_update]首楼身份选择规则", "[mvu_plot]首楼互斥开场世界书"].includes(String(entry?.comment || ""))), "retired first-floor opening worldbooks must be absent");
assert(operationPlotBoundaryWorldbook?.constant === true && operationPlotBoundaryWorldbook?.selective === false && (operationPlotBoundaryWorldbook?.keys || []).length === 0, "plot operation boundary must be an always-on blue entry");
for (const needle of [
  "正文的最高优先级执行队列",
  "当前一次回复中按顺序完成所有暂存项",
  "只停在最后一项的直接后果",
  "若专题操作明确规定了阶段硬终点",
  "不能拿“最新行动已处理”作为提前停下的理由",
  "每轮至少推进1分钟只更新时间变量",
  "时空分镜与人物演出也只能用于操作本身及其直接反应"
]) {
  assert(String(operationPlotBoundaryWorldbook?.content || "").includes(needle), `plot operation boundary missing: ${needle}`);
}
assert(dailySchedulePlotWorldbook?.constant === false && dailySchedulePlotWorldbook?.selective === true, "daily schedule plot boundary must be a keyword-triggered green entry");
assert(dailyScheduleUpdateWorldbook?.constant === false && dailyScheduleUpdateWorldbook?.selective === true, "daily schedule update rule must be a keyword-triggered green entry");
for (const entry of [dailySchedulePlotWorldbook, dailyScheduleUpdateWorldbook]) {
  assert(Number(entry?.extensions?.scan_depth) === 0, "daily schedule entries must scan only the current user turn");
  assert(entry?.extensions?.exclude_recursion === true && entry?.extensions?.prevent_recursion === true, "daily schedule entries must reject recursion");
}
for (const needle of ["待安排区", "最后一个有内容的格子", "催眠命令卡不是独立行动", "赌博结算是基础行动", "真正跨到操作给出的次日"]) {
  assert(String(dailySchedulePlotWorldbook?.content || "").includes(needle), `daily schedule plot rule missing: ${needle}`);
}
for (const needle of ["不是MVU变量", "课程表魔改", "同轮原子写入", "赌博只承认卡片中已经验证并写回的最终资源"]) {
  assert(String(dailyScheduleUpdateWorldbook?.content || "").includes(needle), `daily schedule update rule missing: ${needle}`);
}
assert(hypnosisSemanticPlotWorldbook?.constant === false && hypnosisSemanticPlotWorldbook?.selective === true, "hypnosis command semantics must be a keyword-triggered plot entry");
for (const needle of [
	"机器指令ID不会进入剧情提示",
	"中文`指令`、`效果时效`、`作用域`和`唯一结果位置`",
	"“永久常识修改”永远是VIP5永久指定目标命令",
  "不得描写成初级一般催眠、临时暗示",
	  "排泄控制",
	  "泌乳诱导",
	  "不得因一次性计费或名称未带“永久”就降为临时",
  "多个单体目标逐人判定",
	"开放空间常识修改",
  "不是对若干角色逐个催眠",
  "数字人数模式不预先指定姓名",
  "本轮明确出现并实际接受该条指令施术",
  "同一回复的变量更新必须同时扣除实际MC",
  "禁止剧情成功而变量只改心理或普通状态"
]) {
  assert(String(hypnosisSemanticPlotWorldbook?.content || "").includes(needle), `plot hypnosis semantics missing: ${needle}`);
}
assert(hypnosisBillingWorldbook, "hypnosis billing worldbook is missing");
const hypnosisBillingText = String(hypnosisBillingWorldbook?.content || "");
const hypnosisCommandSection = hypnosisBillingText.split("催眠命令清单:")[1] || "";
const hypnosisIds = [...hypnosisCommandSection.matchAll(/（([a-z][a-z0-9_]+)）/g)].map((match) => match[1]);
assert(hypnosisIds.length === 36, "hypnosis billing must contain exactly 36 command ID rows");
assert(new Set(hypnosisIds).size === 36, "every hypnosis command ID must be unique");
for (const needle of [
	  "机器指令ID仅供前端内部判重与权限计算，不进入本轮剧情提示",
	  "中文指令名与这三项结算合同共同构成最高权威",
  "同时出现临时与永久通配根时，只表示整批命令的最大能力包络，不是让AI任选其一",
  "`trial_basic`属于TRIAL指定目标临时命令",
  "`vip3_temp_common_sense`属于VIP3指定目标临时常识修改",
  "`vip5_permanent`属于VIP5指定目标永久常识修改",
  "成功目标只能写`/角色/<目标>/效果/永久催眠效果`",
	  "`vip5_excretion_control`、`vip5_lactation`",
	  "排泄控制与泌乳诱导虽采用一次性计费，也不得因此改写为临时效果",
  "`vip5_open_space_common_sense`属于VIP5地点范围临时规则",
  "只按前端给出的`/规则/<规则ID>` add 临时地点规则",
  "`目标选择模式=数字人数`时不要求前端预填姓名",
  "最终JSON Patch不得出现星号路径",
  "催眠成功必须原子结算",
  "禁止写成成功后只更新心理、好感、服从或其他普通字段",
  "2至10字的简洁中文语义名",
  "`裸体问好`",
  "严禁使用指令ID、VIP编号、英文下划线、时间戳、随机数",
	  "{效果:\"具体效果\",结束时间:\"YYYY年M月D日 HH:MM\"}",
	  "没有合法结束时间就不能把正文判为临时催眠成功",
	  "新增永久催眠效果时"
]) {
  assert(hypnosisBillingText.includes(needle), `hypnosis billing unique-result contract missing: ${needle}`);
}
assert(hypnosisOperationWorldbook, "hypnosis operation worldbook is missing");
for (const needle of [
  "目标选择模式=数字人数",
  "通配路径只是最大权限包络",
  "最终JSON Patch必须换成真实角色名",
  "角色催眠成功是不可拆分的原子结果",
  "不得只更新该角色心理、好感、服从或普通状态",
  "开放空间成功则原子写MC与指定/规则路径",
  "动态效果键必须使用2至10字中文语义名称",
  "不得把指令ID、VIP等级、英文代码、时间戳或随机编号用作效果键"
]) {
  assert(String(hypnosisOperationWorldbook?.content || "").includes(needle), `hypnosis operation atomic contract missing: ${needle}`);
}
assert(hypnosisStateWorldbook?.constant === true && hypnosisStateWorldbook?.selective === false, "hypnosis state boundary must be an always-on blue entry");
assert(hypnosisEffectsPlotWorldbook?.constant === true && hypnosisEffectsPlotWorldbook?.selective === false, "active hypnosis effects plot reminder must be an always-on blue entry");
for (const needle of ["stat_data.角色", "stat_data.系统.当前出场角色", "临时催眠效果", "永久催眠效果"]) {
  assert(String(hypnosisEffectsPlotWorldbook?.content || "").includes(needle), `active hypnosis effects plot reminder missing: ${needle}`);
}
assert(currentSceneRoleScopeWorldbook?.constant === true && currentSceneRoleScopeWorldbook?.selective === false, "current scene role scope must be an always-on variable-model entry");
for (const needle of [
  "stat_data.系统.当前出场角色",
  "stat_data.角色",
  "lastUserMessage",
  "lastCharMessage",
  "用户明确要求即将出场的候选",
  "本轮回复点名的在场核验候选",
  "即使名单不变、没有其他变量变化",
  "本轮正文中新登场者",
  "不得因为世界书",
]) {
  assert(String(currentSceneRoleScopeWorldbook?.content || "").includes(needle), `current scene role scope missing: ${needle}`);
}
{
  const source = String(currentSceneRoleScopeWorldbook?.content || "");
  const block = source.match(/<%_([\s\S]*?)_%>/)?.[1] || "";
  const output = [];
  const sandbox = {
    Array,
    Object,
    String,
    lastUserMessage: "接下来去学生会室找月咏深雪，并让犬冢夏美过来会合。",
    lastCharMessage: "月咏深雪已经走进学生会室，西园寺爱丽莎只在电话里被提到。",
    getvar(path) {
      if (path === "stat_data.角色") {
        return {
          "月咏深雪": {},
          "犬冢夏美": {},
          "西园寺爱丽莎": {},
          "阿宅": {},
        };
      }
      if (path === "stat_data.系统.当前出场角色") return ["阿宅"];
      return undefined;
    },
    print(value) { output.push(String(value)); },
  };
  new Script(`(function(){${block}})()`, { filename: "current-scene-role-scope.ejs" }).runInNewContext(sandbox);
  const rendered = output.join("");
  assert(rendered.includes("用户明确要求即将出场的候选: 月咏深雪、犬冢夏美"), "scene scope EJS must expose explicit upcoming role candidates");
  assert(rendered.includes("本轮回复点名的在场核验候选: 月咏深雪、西园寺爱丽莎"), "scene scope EJS must expose current reply role candidates");
  assert(rendered.includes("候选只是核验范围，不自动等于在场"), "scene scope EJS must not auto-promote mentions into the final scene list");
}
{
  const source = String(hypnosisEffectsPlotWorldbook?.content || "");
  const block = source.match(/<%_([\s\S]*?)_%>/)?.[1] || "";
  const output = [];
  const roleRoot = {
    "在场甲": { "效果": { "临时催眠效果": { "服从": "有效至13:00" }, "永久催眠效果": {} } },
    "消息新登场乙": { "效果": { "临时催眠效果": {}, "永久催眠效果": { "忠诚": "永久" } } },
    "离场丙": { "效果": { "临时催眠效果": { "遗留": "不应输出" }, "永久催眠效果": {} } },
    "空效果丁": { "效果": { "临时催眠效果": {}, "永久催眠效果": {} } },
  };
  const sandbox = {
    Array,
    JSON,
    Object,
    String,
    YAML,
    lastUserMessage: "",
    lastCharMessage: "消息新登场乙走入房间。",
    getvar(path) {
      if (path === "stat_data.角色") return roleRoot;
      if (path === "stat_data.系统.当前出场角色") return ["在场甲"];
      return undefined;
    },
    print(value) { output.push(String(value)); },
  };
  new Script(`(function(){${block}})()`, { filename: "active-hypnosis-effects.ejs" }).runInNewContext(sandbox);
  const rendered = output.join("");
  assert(rendered.includes("在场甲") && rendered.includes("消息新登场乙"), "active hypnosis EJS must include listed and newly mentioned roles");
  assert(!rendered.includes("离场丙") && !rendered.includes("空效果丁"), "active hypnosis EJS must exclude off-scene and empty-effect roles");
}
assert(
  ["效果/临时催眠效果", "效果/永久催眠效果", "临时效果到期", "永久效果只有明确解除或删除才消失", "YYYY年M月D日 HH:MM", "旧字符串、缺结束时间或非法时间不会被猜测删除", "永久效果根永远不参与到期扫描"].every((needle) =>
    String(hypnosisStateWorldbook?.content || "").includes(needle)
  ),
  "always-on hypnosis state boundary must govern both temporary and permanent hypnosis effects"
);
assert(profileMiscWorldbook?.constant === false && profileMiscWorldbook?.selective === true, "profile/nickname operation worldbook must be a current-operation green entry");
assert(Number(profileMiscWorldbook?.extensions?.scan_depth) === 0, "profile/nickname operation worldbook must scan only the current user turn");
for (const needle of ["必须同时replace", "拒绝、反感、尴尬或没有接受时仍必须保留档案中的新绰号并写false", "清除绰号时把绰号replace为空字符串并同时写false"]) {
  assert(String(profileMiscWorldbook?.content || "").includes(needle), `profile/nickname operation worldbook missing strict update rule: ${needle}`);
}
assert(!entries.some((entry) => String(entry?.comment || "") === "催眠指导"), "obsolete <催眠发送>-only worldbook must be removed");
const timelineWorldbook = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]时空跳转剧情书");
assert(!timelineWorldbook, "temporal narrative semantics and output format must not remain in a keyword-triggered worldbook");
for (const entry of entries) {
  const content = String(entry?.content || "");
  assert(!content.includes("【时空轮转·其一｜时间｜地点｜视角】"), `worldbook must not retain temporal rotation format: ${entry?.comment || "unnamed"}`);
  assert(!content.includes("【时空收束｜最终时间｜最终地点】"), `worldbook must not retain temporal convergence format: ${entry?.comment || "unnamed"}`);
}
assert(
  String(profileMiscWorldbook?.content || "").includes("每次AI回复仍必须更新/系统/当前年份、/系统/当前日期和/系统/当前时间")
  && String(profileMiscWorldbook?.content || "").includes("至少推进1分钟")
  && !String(profileMiscWorldbook?.content || "").includes("只有本轮操作、剧情行动、打工、派遣结算或AI叙事明确推进时才由AI更新"),
  "profile/misc worldbook must not make the mandatory clock update conditional"
);
const identityBootstrapEntries = data.extensions?.workbench?.identityBootstrapEntries || [];
const init = entries.find((entry) => String(entry.comment || "") === "[initvar]变量初始化不需要开");
const initContent = String(init?.content || "");

assert(init, "missing [initvar]变量初始化不需要开");
assert(!isEntryEnabled(init), "[initvar]变量初始化不需要开 must remain disabled");
let initData;
try {
  initData = YAML.parse(initContent);
} catch (error) {
  throw new Error(`init variables are not valid YAML: ${error?.message || error}`);
}
const currentMvuSchema = createMvuSchema(z);
const initSchemaResult = currentMvuSchema.safeParse(initData);
assert(initSchemaResult.success, `init variables do not satisfy the current MVU Schema: ${JSON.stringify(initSchemaResult.error?.issues || [])}`);
assert(initData?.系统?.当前年份 === 2024, "init variables must store current year separately");
assert(initData?.系统?.当前日期 === "4月9日", "init variables current date must contain month and day only");
assert(Array.isArray(initData?.系统?.当前出场角色), "init variables must include /系统/当前出场角色 as an array");
assert(Object.prototype.hasOwnProperty.call(initData?.系统 || {}, "_user身份"), "init variables must use /系统/_user身份");
assert(!Object.prototype.hasOwnProperty.call(initData?.系统 || {}, "$" + "user身份"), "init variables must not retain the legacy dollar-prefixed user identity");
assert(!Object.prototype.hasOwnProperty.call(initData?.系统 || {}, "user身份"), "init variables must not retain /系统/user身份");
for (const [roleName, role] of Object.entries(initData?.角色 || {})) {
  assert(role?.信息 && typeof role.信息 === "object", `init role must keep an information page without normalizing age: ${roleName}`);
}
{
  const legacyAge = structuredClone(initData);
  legacyAge.角色.西园寺爱丽莎.信息.年龄 = legacyAge.角色.西园寺爱丽莎.信息._年龄;
  delete legacyAge.角色.西园寺爱丽莎.信息._年龄;
  assert(currentMvuSchema.safeParse(legacyAge).success, "MVU compatibility schema must accept an existing character age key without renaming it");
}
const timetableLeafKeys = ["课节", "科目", "原课程描述", "是否魔改", "魔改课程", "魔改课程描述"].sort();
assert(Array.isArray(initData?.系统?._课程表) && initData.系统._课程表.length > 0, "init variables must include current timetable rows");
for (const [index, row] of initData.系统._课程表.entries()) {
  assert(
    JSON.stringify(Object.keys(row || {}).sort()) === JSON.stringify(timetableLeafKeys),
    `timetable row ${index} must use the exact current leaf contract: ${Object.keys(row || {}).join(",")}`
  );
}

function schemaMutation(mutator) {
  const value = structuredClone(initData);
  mutator(value);
  return currentMvuSchema.safeParse(value);
}

function expectSchemaReject(label, mutator) {
  assert(!schemaMutation(mutator).success, `MVU Schema must reject ${label}`);
}

expectSchemaReject("legacy role 档案 root", (value) => { value.角色.西园寺爱丽莎.档案 = {}; });
expectSchemaReject("心理 under 状态", (value) => { value.角色.西园寺爱丽莎.状态.心理 = "错误路径"; });
expectSchemaReject("面部 under 信息", (value) => { value.角色.西园寺爱丽莎.信息.面部 = "错误路径"; });
expectSchemaReject("unknown remodel leaf", (value) => { value.角色.西园寺爱丽莎.改造.头 = { 不存在字段: "错误" }; });
expectSchemaReject("remodel disease synonym", (value) => { value.角色.西园寺爱丽莎.改造.整体 = { 病症: "错误同义叶" }; });
expectSchemaReject("primitive personality item", (value) => { value.角色.西园寺爱丽莎.劣迹.性格.愤怒 = "正"; });
expectSchemaReject("story line outside 0..2", (value) => { value.系统._警视厅线 = 3; });
expectSchemaReject("year embedded in current date", (value) => { value.系统.当前日期 = "2024年4月9日"; });
expectSchemaReject("invalid current year", (value) => { value.系统.当前年份 = 0; });
expectSchemaReject("legacy user identity key", (value) => { value.系统.user身份 = {}; });
expectSchemaReject("removed recent interaction roles", (value) => { value.系统.最近交互角色 = []; });
expectSchemaReject("legacy timetable 日期 leaf", (value) => { value.系统._课程表[0].日期 = "4月9日"; });
expectSchemaReject("legacy timetable 星期 leaf", (value) => { value.系统._课程表[0].星期 = "星期三"; });
expectSchemaReject("removed timetable 课程描述 leaf", (value) => { value.系统._课程表[0].课程描述 = "重复字段"; });
const dailyTaskShape = {
  任务: "观察今日目标",
  完成条件: "完成一次明确互动",
  奖励星光点: 1,
  已完成: false
};
const dailyTaskResult = schemaMutation((value) => {
  value.任务["daily-new-quest:2024-04-09:test"] = dailyTaskShape;
});
assert(dailyTaskResult.success, "MVU Schema must accept the lightweight daily-task shape");
for (const [field, fieldValue] of [["每日任务日期", "4月9日"], ["任务目标", "西园寺爱丽莎"], ["已领取", false]]) {
  expectSchemaReject(`unknown daily-task leaf ${field}`, (value) => {
    value.任务["daily-new-quest:2024-04-09:test"] = { ...dailyTaskShape, [field]: fieldValue };
  });
}
const fixedTaskIdResult = schemaMutation((value) => {
  value.任务["fixed:test"] = { ...dailyTaskShape, 任务ID: "fixed:test" };
});
assert(fixedTaskIdResult.success, "MVU Schema must keep the optional fixed-task ID compatibility field");

const optionalGhostResult = schemaMutation((value) => {
  value.系统._灵异线 = 1;
  value.系统.附身 = "月咏深雪";
});
assert(optionalGhostResult.success, "MVU Schema must accept optional ghost-line fields when frontend creates them");
const remodelDiseaseResult = schemaMutation((value) => {
  value.角色.西园寺爱丽莎.改造.整体 = { 疾病: "术后形成的长期疾病记录" };
});
assert(remodelDiseaseResult.success, "MVU Schema must accept /改造/整体/疾病 as the only disease leaf");
const clampResult = schemaMutation((value) => {
  value.角色.西园寺爱丽莎.敏感.阴蒂敏感度 = 9999;
  value.角色.西园寺爱丽莎.敏感.阴蒂高潮次数 = -5;
});
assert(clampResult.success, "MVU Schema clamp fixture must parse");
assert(clampResult.data.角色.西园寺爱丽莎.敏感.阴蒂敏感度 === 1000, "MVU Schema must clamp sensitivity to 1000");
assert(clampResult.data.角色.西园寺爱丽莎.敏感.阴蒂高潮次数 === 0, "MVU Schema must clamp climax counts to zero");
const importFixture = structuredClone(initData);
delete importFixture.系统.MC能量;
delete importFixture.角色.西园寺爱丽莎.物品;
importFixture.系统.旧版本字段 = "必须保留并告警";
importFixture.系统.最近交互角色 = [{ 角色名: "旧变量" }];
importFixture.系统.当前出场角色 = ["犬冢夏美"];
importFixture.角色.西园寺爱丽莎.状态.旧数值 = 999;
importFixture.角色.未来新增角色 = {
  信息: { 姓名: "未来新增角色", _年龄: "18", 旧资料: "必须保留并告警" },
  状态: { 好感度: 12 },
  未知页面: { 任意: true }
};
const normalizedImport = normalizeMvuImportStatData(z, importFixture);
assert(normalizedImport.ok, `import normalizer must accept a partial current-contract snapshot: ${JSON.stringify(normalizedImport.issues || [])}`);
assert(normalizedImport.value.系统.旧版本字段 === "必须保留并告警", "automatic import normalization must preserve unknown system fields");
assert(Array.isArray(normalizedImport.value.系统.最近交互角色), "automatic import normalization must preserve unknown legacy fields until explicit cleanup");
assert(
  JSON.stringify(normalizedImport.value.系统.当前出场角色) === JSON.stringify(["犬冢夏美"]),
  "import normalizer must preserve the legal current-scene role array"
);
assert(normalizedImport.value.角色.西园寺爱丽莎.状态.旧数值 === 999, "automatic import normalization must preserve unknown role leaves");
assert(normalizedImport.value.角色.未来新增角色.未知页面?.任意 === true, "automatic import normalization must preserve unknown role pages");
assert((normalizedImport.unknown || []).some((item) => item.path.join("/") === "系统/旧版本字段"), "import normalizer must diagnose preserved unknown fields");
assert(normalizedImport.value.系统.MC能量 === 25, "import normalizer must fill missing current system defaults");
assert(normalizedImport.value.角色.西园寺爱丽莎.物品?.持有 && !Object.prototype.hasOwnProperty.call(normalizedImport.value.角色.西园寺爱丽莎.物品, "刷新"), "import normalizer must keep only the held-item subtree");
assert(normalizedImport.value.角色.未来新增角色.状态.好感度 === 12, "import normalizer must preserve imported values for arbitrary future roles");
assert(normalizedImport.value.角色.未来新增角色.衣着?.头发 === "未记录", "import normalizer must apply the role template recursively to arbitrary future roles");
assert(createMvuSchema(z, { preserveUnknown: true }).safeParse(normalizedImport.value).success, "normalized imports must satisfy the compatibility state Schema");
assert(!currentMvuSchema.safeParse(normalizedImport.value).success, "strict patch Schema must continue to reject unknown paths");
const explicitlyCleanedImport = normalizeMvuImportStatData(z, normalizedImport.value, { dropUnknown: true });
assert(explicitlyCleanedImport.ok && currentMvuSchema.safeParse(explicitlyCleanedImport.value).success, "explicit confirmed cleanup must produce a strict-contract snapshot");
assert(!Object.prototype.hasOwnProperty.call(explicitlyCleanedImport.value.系统, "旧版本字段"), "explicit confirmed cleanup must remove unknown fields");
const normalizedImportAgain = normalizeMvuImportStatData(z, normalizedImport.value);
assert(normalizedImportAgain.ok && JSON.stringify(normalizedImportAgain.value) === JSON.stringify(normalizedImport.value), "import normalization must be idempotent");
{
  const retiredFixture = structuredClone(initData);
  retiredFixture.系统.派遣岗位 = { "1号门": { 角色名: "犬冢夏美" } };
  retiredFixture.系统.监控派遣岗位 = { "2号门": { 角色名: "月咏深雪" } };
  retiredFixture.系统.持有物品["星光点兑换券"] = { 描述: "测试", 数量: 10001 };
  retiredFixture.角色.西园寺爱丽莎.状态.是否派遣中 = true;
  retiredFixture.角色.西园寺爱丽莎.信息.工作价值 = 999;
  retiredFixture.角色.西园寺爱丽莎.信息.第三方资料 = "必须保留";
  const beforeAge = retiredFixture.角色.西园寺爱丽莎.信息._年龄;
  const migrated = normalizeMvuImportStatData(z, retiredFixture);
  assert(migrated.ok, "retired dispatch/work-value fields must migrate through the current normalizer");
  assert(!Object.hasOwn(migrated.value.系统, "派遣岗位") && !Object.hasOwn(migrated.value.系统, "监控派遣岗位"), "retired system dispatch slots must be removed");
  assert(!Object.hasOwn(migrated.value.角色.西园寺爱丽莎.状态, "是否派遣中"), "retired role dispatch state must be removed");
  assert(!Object.hasOwn(migrated.value.角色.西园寺爱丽莎.信息, "工作价值"), "retired work value must be removed");
  assert(migrated.value.角色.西园寺爱丽莎.信息.第三方资料 === "必须保留", "unrelated unknown role fields must survive the retired-field migration");
  assert(migrated.value.角色.西园寺爱丽莎.信息._年龄 === beforeAge, "retired-field migration must leave age untouched");
  assert(migrated.value.系统.持有物品["星光点兑换券"].数量 === 10001, "starlight voucher inventory must not have an artificial quantity cap");
  const legacyVoucher = structuredClone(initData);
  legacyVoucher.系统.持有物品["星光点兑换券"] = { 名称: "星光点兑换券", 描述: "旧版任务奖励", 数量: 2 };
  legacyVoucher.系统.持有物品["第三方物品"] = { 名称: "并非字典键", 描述: "第三方字段必须保留", 数量: 1 };
  const migratedVoucher = normalizeMvuImportStatData(z, legacyVoucher);
  assert(migratedVoucher.ok && !Object.hasOwn(migratedVoucher.value.系统.持有物品["星光点兑换券"], "名称"), "legacy voucher migration must remove only the redundant matching name leaf");
  assert(migratedVoucher.value.系统.持有物品["第三方物品"].名称 === "并非字典键", "legacy voucher migration must preserve unrelated third-party name leaves");
  assert(createMvuSchema(z).safeParse(migratedVoucher.value).success === false, "preserved third-party unknown leaves must remain visible to strict diagnostics");
  const migratedAgain = normalizeMvuImportStatData(z, migrated.value);
  assert(migratedAgain.ok && JSON.stringify(migratedAgain.value) === JSON.stringify(migrated.value), "retired-field migration must be idempotent");
}
{
  const legacyDollarKey = "$" + "user身份";
  const legacyOnly = structuredClone(initData);
  delete legacyOnly.系统._user身份;
  legacyOnly.系统[legacyDollarKey] = { 姓名: "旧身份", 照片: "legacy-photo" };
  const migratedLegacyOnly = normalizeMvuImportStatData(z, legacyOnly);
  assert(migratedLegacyOnly.ok, "legacy dollar-prefixed user identity must migrate through the current normalizer");
  assert(migratedLegacyOnly.value.系统._user身份?.姓名 === "旧身份", "legacy user identity value must migrate to /系统/_user身份");
  assert(!Object.hasOwn(migratedLegacyOnly.value.系统, legacyDollarKey), "legacy dollar-prefixed identity key must be removed after migration");

  const mixedIdentity = structuredClone(initData);
  mixedIdentity.系统._user身份 = { 姓名: "新身份" };
  mixedIdentity.系统[legacyDollarKey] = { 姓名: "旧身份" };
  mixedIdentity.系统.user身份 = { 姓名: "更旧身份" };
  const migratedMixedIdentity = normalizeMvuImportStatData(z, mixedIdentity);
  assert(migratedMixedIdentity.ok, "mixed identity keys must normalize successfully");
  assert(migratedMixedIdentity.value.系统._user身份?.姓名 === "新身份", "the current /系统/_user身份 value must take precedence over legacy keys");
  assert(
    !Object.hasOwn(migratedMixedIdentity.value.系统, legacyDollarKey)
      && !Object.hasOwn(migratedMixedIdentity.value.系统, "user身份"),
    "all legacy identity keys must be removed after migration"
  );
}
assert(Array.isArray(data.alternate_greetings) && data.alternate_greetings.length === 0, "local and release cards must not contain alternate openings");

const positions = Object.fromEntries(
  REQUIRED_SECTIONS.map((name) => [name, initContent.search(new RegExp("^" + name + ":", "m"))])
);
for (const name of REQUIRED_SECTIONS) assert(positions[name] >= 0, `missing init section: ${name}`);
assert(!/^成就:/m.test(initContent), "init variables must not contain deprecated 成就 root");
for (let index = 1; index < REQUIRED_SECTIONS.length; index += 1) {
  const prev = REQUIRED_SECTIONS[index - 1];
  const current = REQUIRED_SECTIONS[index];
  assert(positions[prev] < positions[current], `bad init section order: ${prev} before ${current}`);
}

const systemBlock = initContent.slice(positions["系统"], positions["规则"]);
for (const [name, pattern] of Object.entries({
  "_课程表": /^\s{2}_课程表:\s*$/m,
  "_警视厅线": /^\s{2}_警视厅线:\s*0\s*$/m,
  "_医院线": /^\s{2}_医院线:\s*0\s*$/m
})) {
  assert(pattern.test(systemBlock), `missing story-line init variable: ${name}`);
}
const storyLineOrder = ["_警视厅线", "_医院线"].map((name) => systemBlock.indexOf(`  ${name}: 0`));
for (const name of ["_警视厅线", "_医院线"]) {
  const matches = systemBlock.match(new RegExp(`^\\s{2}\\${name}:`, "gm")) || [];
  assert(matches.length === 1, `story-line init must exist exactly once: ${name}, found ${matches.length}`);
}
assert(storyLineOrder[0] < storyLineOrder[1], "story-line init must be ordered 警视厅线 -> 医院线");
assert(!/^\s{2}_灵异线:\s*/m.test(systemBlock), "ordinary init must not create _灵异线 before 白枢暗子 exists");
assert(!/^\s{2}\$(?:警视厅线|医院线|灵异线):/m.test(systemBlock), "init must not retain deprecated $ story lines");
assert(!/^\s{2}_角色变量结构版本:\s*/m.test(systemBlock), "ordinary init must not retain removed role schema version marker");
assert(!/^\s{2}附身:\s*/m.test(systemBlock), "ordinary init must not create possession host before ghost line 1->2");
assert(
  !/^\s{2}(_社畜值|社畜值|打工值|社畜经验|_buff|_buff结束时间|buff|buff结束时间|课程表):\s*/m.test(systemBlock),
  "legacy writable work/schedule variable leaked into system init block"
);

const ruleBlock = initContent.slice(positions["规则"], positions["任务"]);
assert(/规则:\s*\{\}/u.test(ruleBlock), "initial variables must start with no mutable location rules");
assert(RETIRED_INITIAL_RULE_NAMES.every((name) => !ruleBlock.includes(name)), "retired initial rules must not remain in initial variables");

const roleSection = initContent.slice(positions["角色"]);
const initialRoles = [...roleSection.matchAll(/^  ([^\s\n][^:\n]*):\s*$/gm)].map((match) => match[1]);
function initialRoleBlock(roleName) {
  const escaped = roleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp("^  " + escaped + ":\\s*$", "m");
  const match = roleSection.match(header);
  if (!match) return "";
  const start = match.index;
  const afterHeader = start + match[0].length;
  const rest = roleSection.slice(afterHeader);
  const nextRole = rest.search(/\n  [^\s\n][^:\n]*:\s*$/m);
  const end = nextRole >= 0 ? afterHeader + nextRole : roleSection.length;
  return roleSection.slice(start, end);
}
assert(
  DEFAULT_ROLES.every((name, index) => initialRoles[index] === name),
  `bad default role order: ${initialRoles.slice(0, DEFAULT_ROLES.length).join(", ")}`
);
assert(
  initialRoles.length === DEFAULT_ROLES.length && DEFAULT_ROLES.every((name, index) => initialRoles[index] === name),
  `initial role set must contain exactly the four defaults, found: ${initialRoles.join(", ")}`
);
const missingInitialRoles = DEFAULT_ROLES.filter((name) => !initialRoles.includes(name));
assert(!missingInitialRoles.length, `missing initial role variables: ${missingInitialRoles.join(", ")}`);
const bannedInitialRoles = BANNED_INITIAL_ROLES.filter((name) => initialRoles.includes(name));
assert(!bannedInitialRoles.length, `legacy roles leaked into init variables: ${bannedInitialRoles.join(", ")}`);
for (const roleName of DEFAULT_ROLES) {
  const block = initialRoleBlock(roleName);
  assert(block, `missing initial role block: ${roleName}`);
  for (const page of ["衣着", "信息", "状态", "事件", "敏感", "效果", "劣迹"]) {
    assert(new RegExp(`^    ${page}:\\s*$`, "m").test(block), `initial role missing seven-page object ${page}: ${roleName}`);
  }
  assert(/\n\s+性别:\s*(?:男|女)\s*(?:\n|$)/.test(block), `initial role missing canonical gender: ${roleName}`);
  assert(!/\n\s+工作价值:\s*/.test(block), `removed work value leaked into initial role: ${roleName}`);
  for (const legacy of ["好感度", "警戒度", "服从度", "性欲", "快感值", "是否派遣中", "工作价值", "绰号", "绰号已认可", "_事件记录", "至关重要记忆", "心理", "临时催眠效果", "永久催眠效果", "档案"]) {
    assert(!new RegExp(`^    ${legacy}:`, "m").test(block), `legacy root role field leaked into init ${roleName}: ${legacy}`);
  }
  assert(block.includes('心理: "未记录"'), `initial role psychology must be unrecorded: ${roleName}`);
  assert(/\n\s+_事件记录:\s*"?000000"?/.test(block), `initial role missing event record: ${roleName}`);
  assert(!/(^|\n)\s+事件记录:\s*/.test(block), `legacy event record leaked into init variables: ${roleName}`);
  assert(block.includes('至关重要记忆: ""'), `initial role missing important memory: ${roleName}`);
  assert(block.includes('劣迹:\n      性格: {}\n      罪行:'), `initial role missing bad-record personality/crime block: ${roleName}`);
  for (const crime of ["盗窃", "露出", "私闯", "伤害", "淫乱", "强奸"]) {
    assert(block.includes(crime + ': 0'), `initial role missing zero crime count ${crime}: ${roleName}`);
  }
  assert(/^\s+性格:\s*\{\}\s*$/m.test(block), `initial role must preserve an empty locked bad-record personality object: ${roleName}`);
  assert(/^    改造:\s*\{\}\s*$/m.test(block), `initial role must keep an empty, fully locked hospital-remodel root: ${roleName}`);
  assert(/^    物品:\s*$/m.test(block) && /^      持有:\s*/m.test(block) && !/^      刷新:\s*/m.test(block), `initial role must keep only the held-item group: ${roleName}`);
  assert(/钱包|钱夹|皮夹|零钱包/u.test(block), `initial role missing baseline wallet item: ${roleName}`);
  assert(/内衣|内裤|胸罩|文胸/u.test(block), `initial role missing baseline underwear item: ${roleName}`);
  assert(/^    子嗣:\s*$/m.test(block) && /\n      是否妊娠中: false\n      生产数量: 0\n      子嗣列表: \{\}/.test(block), `initial role must keep a normalized empty child root: ${roleName}`);
}
for (const [roleName, itemNames] of Object.entries({
  "西园寺爱丽莎": ["西园寺家定制钱包", "当前穿着的成套内衣"],
  "月咏深雪": ["深色折叠钱包", "当前穿着的内衣"],
  "犬冢夏美": ["运动零钱包", "当前穿着的运动内裤"]
})) {
  const block = initialRoleBlock(roleName);
  for (const itemName of itemNames) assert(block.includes(itemName + ":"), `initial role missing seeded item ${itemName}: ${roleName}`);
}
for (const comment of [
  "西园寺爱丽莎变量",
  "月咏深雪变量",
  "犬冢夏美变量",
  "阿宅变量",
  "[mvu_plot]西园寺爱丽莎人设",
  "[mvu_plot]月咏深雪人设",
  "[mvu_plot]犬冢夏美人设",
  "[mvu_plot]阿宅人设",
  "[mvu_plot]阿宅女性化人设"
]) {
  assert(comments.includes(comment), `missing main-card identity entry: ${comment}`);
}
for (const name of [
  "核心设定",
  "西园寺爱丽莎人设",
  "月咏深雪人设",
  "犬冢夏美人设",
  "阿宅人设",
  "阿宅女性化人设",
  "通用好感链",
  "西园寺爱丽莎好感事件链",
  "月咏深雪好感事件链",
  "犬冢夏美好感事件链",
  "时间和地点提醒",
  "热带雨林区",
  "旧图书馆塔楼“巴别”",
  "学校简介和地点列表-明德大学",
  "私立斋明学园设定"
]) {
  assert(comments.includes("[mvu_plot]" + name), `missing plot-only worldbook entry: ${name}`);
  assert(!comments.includes(name), `plot-only worldbook entry leaked into shared route: ${name}`);
}
assert(!identityBootstrapEntries.length, "identity entries must not be stored for chat-worldbook bootstrap");
const hospitalDynamicPack = data.extensions?.workbench?.dynamicRolePacks?.hospital;
assert(hospitalDynamicPack?.line?.owner === "frontend", "hospital dynamic line must remain frontend-owned");
assert(hospitalDynamicPack?.line?.openConditions?.mode === "all", "hospital room must require all configured role conditions");
const hospitalOpenRules = Array.isArray(hospitalDynamicPack?.line?.openConditions?.rules) ? hospitalDynamicPack.line.openConditions.rules : [];
for (const roleName of ["犬冢穗波", "天城纱良"]) {
  assert(hospitalOpenRules.some((rule) => rule?.role === roleName && rule?.path === "状态/服从度" && Number(rule?.minimum) === 100), `hospital room missing obedience-100 condition: ${roleName}`);
  assert(!roleSection.includes(`\n  ${roleName}:`), `hospital dynamic role leaked into initial roles: ${roleName}`);
}
const hospitalRoleSeeds = new Map((hospitalDynamicPack?.roles || []).map((role) => [role?.name, role?.initial]));
const honamiSeed = hospitalRoleSeeds.get("犬冢穗波");
const saraSeed = hospitalRoleSeeds.get("天城纱良");
assert(honamiSeed?.状态?.警戒度 === 10 && honamiSeed?.状态?.服从度 === 0 && honamiSeed?.信息?.性别 === "女" && !Object.hasOwn(honamiSeed?.信息 || {}, "工作价值"), "Honami initial relationship/gender contract mismatch");
assert(honamiSeed?.信息?.身高 === "148cm" && honamiSeed?.信息?.体重 === "41kg" && honamiSeed?.信息?.三围 === "B82 / W54 / H81", "Honami profile measurements incomplete");
assert(String(honamiSeed?.信息?.社团或职业 || "").includes("外科医生") && String(honamiSeed?.衣着?.头发 || "").includes("双丸子"), "Honami profession/hairstyle mismatch");
assert(saraSeed?.状态?.服从度 === 40 && saraSeed?.信息?.性别 === "女" && !Object.hasOwn(saraSeed?.信息 || {}, "工作价值"), "Sara initial obedience/gender contract mismatch");
assert(saraSeed?.信息?.身高 === "204cm" && saraSeed?.信息?.体重 === "78kg" && saraSeed?.信息?.三围 === "B96 / W66 / H98", "Sara profile measurements incomplete");
for (const comment of ["犬冢穗波变量", "[mvu_update]犬冢穗波变量", "[mvu_plot]犬冢穗波人设", "天城纱良变量", "[mvu_update]天城纱良变量", "[mvu_plot]天城纱良人设", "[mvu_plot]医院线初遇：犬冢穗波与天城纱良", "[mvu_plot]医院改造室开放"]) {
  const matches = entries.filter((entry) => String(entry?.comment || "") === comment);
  assert(matches.length === 0, `hospital dynamic template must not be preinstalled in main worldbook: ${comment}`);
}
assert(frontendSource.includes("function hospitalLinePackage") && frontendSource.includes("犬冢穗波") && frontendSource.includes("天城纱良") && frontendSource.includes("医院线初遇：犬冢穗波与天城纱良") && frontendSource.includes("医院改造室开放"), "hospital dynamic templates must remain in frontend package");
const hospitalPersonaTemplateText = frontendSource;
for (const needle of ["relationship_value_priority", "好感度40-69", "服从度>=100", "警戒度70-99", "AI不得自行开放医院线"]) {
  assert(hospitalPersonaTemplateText.includes(needle), `hospital persona stages missing: ${needle}`);
}
const naturalizedSpecialPersonaText = entries
  .filter((entry) => ["[mvu_plot]犬冢穗波人设", "[mvu_plot]天城纱良人设", "[mvu_plot]综合医院初遇后续", "[mvu_plot]弥留子人设", "[mvu_plot]旧校舍亡魂初遇", "[mvu_plot]灵异线深雪附身确认"].includes(String(entry?.comment || "")))
  .map((entry) => String(entry?.content || ""))
  .join("\n");
for (const pattern of [/临床|术前|创伤评估|多科会诊|复核|流程|设备|数据|医疗伦理|护理伦理|专业判断|腕带|双人确认|上报|实体质量|锚点|遮蔽物|队形|来者重心|侦察|巡视|魔力残留|谨慎推断|调查记忆/u]) {
  assert(!pattern.test(naturalizedSpecialPersonaText), `special persona must use natural language, matched: ${pattern}`);
}
const ghostDynamicPack = data.extensions?.workbench?.dynamicRolePacks?.ghost;
assert(ghostDynamicPack?.line?.owner === "frontend", "ghost dynamic line must remain frontend-owned");
assert(ghostDynamicPack?.line?.path === "/系统/_灵异线", "ghost dynamic line path mismatch");
assert(ghostDynamicPack?.line?.seedWhenRoleExists === "白枢暗子", "ghost line must only be seeded after 白枢暗子 exists");
assert(ghostDynamicPack?.line?.possessed === 2 && ghostDynamicPack?.line?.possessionPath === "/系统/附身" && ghostDynamicPack?.line?.possessionOwner === "frontend", "ghost possession line contract mismatch");
assert(ghostDynamicPack?.line?.possessionConditions?.currentState === 1 && ghostDynamicPack?.line?.possessionConditions?.host === "月咏深雪" && ghostDynamicPack?.line?.possessionConditions?.atomicWrites?.["/系统/_灵异线"] === 2 && ghostDynamicPack?.line?.possessionConditions?.atomicWrites?.["/系统/附身"] === "月咏深雪", "ghost 1->2 atomic possession contract incomplete");
const ghostRules = Array.isArray(ghostDynamicPack?.line?.unlockConditions?.rules) ? ghostDynamicPack.line.unlockConditions.rules : [];
for (const roleName of ["白枢暗子", "千杀百花", "中村樱"]) {
  assert(ghostRules.some((rule) => rule?.role === roleName && rule?.path === "状态/好感度" && Number(rule?.minimum) === 100), `ghost line missing eligibility rule: ${roleName}`);
}
const ghostRoleSeed = ghostDynamicPack?.roles?.find((role) => role?.name === "弥留子");
assert(ghostRoleSeed?.initial?.信息?.性别 === "女" && !Object.hasOwn(ghostRoleSeed?.initial?.信息 || {}, "工作价值") && !Object.hasOwn(ghostRoleSeed?.initial?.状态 || {}, "是否派遣中"), "Miryuko must not contain retired dispatch/work-value fields");
assert(
  ghostRoleSeed?.restrictions?.personalityTuning === false
  && ghostRoleSeed?.restrictions?.remodeling === false
  && ghostRoleSeed?.restrictions?.immuneWhenUnpossessed === true
  && ghostRoleSeed?.restrictions?.affectedWhenPossessing === true
  && ghostRoleSeed?.restrictions?.physicalMirrorOwner === "frontend"
  && ghostRoleSeed?.restrictions?.unpossessedPhysicalValue === 0
  && ghostRoleSeed?.restrictions?.clearTemporaryEffectsOnCancel === true
  && ghostRoleSeed?.restrictions?.preservePermanentEffectsOnCancel === true
  && ghostRoleSeed?.restrictions?.preserveOrgasmCountsOnCancel === true
  && !Object.hasOwn(ghostRoleSeed?.restrictions || {}, "hypnosisImmune"),
  "Miryuko conditional restrictions incomplete"
);
assert(ghostRoleSeed?.initial?.信息?.身高 === "180cm" && ghostRoleSeed?.initial?.信息?.体重 === "0kg" && ghostRoleSeed?.initial?.信息?.三围 === "B103 / W68 / H97", "Miryuko profile measurements incomplete");
assert(ghostRoleSeed?.initial?.状态?.性欲 === 0 && ghostRoleSeed?.initial?.状态?.快感值 === 0, "Miryuko initial desire/pleasure must be zero while unpossessed");
for (const [field, value] of Object.entries(ghostRoleSeed?.initial?.敏感 || {})) {
  if (field.endsWith("敏感度")) assert(Number(value) === 0, `Miryuko initial sensitivity must be zero: ${field}`);
}
assert(!Object.hasOwn(ghostRoleSeed?.initial?.状态 || {}, "附身"), "possession host must be a system field, not a Miryuko state leaf");
assert(!roleSection.includes("\n  弥留子:"), "Miryuko must not leak into ordinary initial roles");
for (const comment of ["弥留子变量", "[mvu_update]弥留子变量", "[mvu_plot]弥留子人设", "[mvu_plot]旧校舍亡魂初遇", "[mvu_plot]灵异线深雪附身确认"]) {
  const matches = entries.filter((entry) => String(entry?.comment || "") === comment);
  assert(matches.length === 0, `ghost dynamic template must not be preinstalled in main worldbook: ${comment}`);
}
assert(frontendSource.includes("function ghostLinePackage") && frontendSource.includes("弥留子") && frontendSource.includes("旧校舍亡魂初遇") && frontendSource.includes("灵异线深雪附身确认"), "ghost dynamic templates must remain in frontend package");
const ghostTemplateText = frontendSource;
const polishedMiryukoEntry = (orjenrnEncounterPackage?.branchPersonaEntries || [])
  .find((entry) => String(entry?.comment || "") === "[mvu_plot]弥留子人设");
assert(polishedMiryukoEntry, "orjenrn polished package missing Miryuko persona override");
const polishedMiryukoText = String(polishedMiryukoEntry?.content || "");
assert(polishedMiryukoText.trim() === polishedMiryukoSource, "orjenrn package Miryuko persona must match the canonical polished source");
for (const needle of [
  "未附身时，弥留子完全免疫催眠APP",
  "好感度>=100且服从度>=100",
  "清醒、自愿地假装催眠命令生效",
  "解除附身后保留下来的永久催眠效果",
  "不得新增催眠效果变量",
  "不把白枢暗子写成弥留子渴望夺取的容器"
]) {
  assert(polishedMiryukoText.includes(needle), `polished Miryuko worldbook missing rule: ${needle}`);
}
for (const forbidden of [
  "APP的灵魂侵入",
  "最完美的肉体容器",
  "APP可以直接改写",
  "对中村樱：",
  "对{{user}}："
]) {
  assert(!polishedMiryukoText.includes(forbidden), `polished Miryuko worldbook retained removed setting: ${forbidden}`);
}
assert(
  Array.isArray(ghostDynamicPack?.worldbookComments)
  && ghostDynamicPack.worldbookComments.includes("[mvu_plot]灵异线深雪附身确认"),
  "Miryuko/Miyuki relationship worldbook must remain in the ghost dynamic package"
);
assert(!entries.some((entry) => String(entry?.comment || "") === "[mvu_plot]千杀百花灵异线补充"), "Hyakka magic constraint must not be a ghost-line template");
for (const needle of [
  "未附身时，弥留子完全免疫新的催眠",
  "在未附身时继续有效并约束她的行为与心理",
  "对弥留子或当前宿主身体成功施加的催眠同时作用于二人",
  "未附身和附身期间都不得对这些路径输出add、replace、remove",
  "性欲、快感值和敏感度仍只由前端镜像，AI不得patch",
  "取消附身时，前端会同时清空/角色/弥留子/效果/临时催眠效果与原宿主的临时催眠效果",
  "永久催眠效果与全部高潮次数必须保留",
  "正常消耗资源",
  "不得向/角色/弥留子/效果/临时催眠效果",
  "好感度>=100且服从度>=100",
  "不可进行警视厅性格特调或医院改造",
  "所有普通人都能稳定看见和听见弥留子",
  "穿过墙壁、门窗、地面与其他障碍",
  "平时留在旧校舍",
  "没有蓝光、透明、雾化",
  "HYPNOOS_GHOST_FIRST_ENCOUNTER_V1"
]) {
  assert(ghostTemplateText.includes(needle), `ghost worldbook missing rule: ${needle}`);
}
for (const needle of [
  "HYPNOOS_GHOST_POSSESSION_MIYUKI_V1",
  "/系统/附身是前端独占字符串",
  "AI只能读取，绝对不得add、replace、remove、清空或切换宿主",
  "附身这个事实本身绝不自动修改宿主",
  "同一临时/永久催眠效果必须同时写入二人的同类效果字段",
  "月咏深雪是唯一已确认可以保持清醒并与弥留子共同操控身体的特例",
  "初登场的弥留子是彻底失忆的白纸",
  "异世界身份必须故意留白",
  "暗子一脸痴相地盯着弥留子",
  "{{user}}左拥千杀百花和中村樱",
  "众人动用樱提供的资金研究亡魂",
  "完全没用、只会把气氛带偏的搞笑中二灵异知识",
  "月咏深雪因为寻找{{user}}一路跟到旧校舍",
  "两道平行灵魂自行产生无法抗拒的吸引",
  "任何魔法道具都不是原因",
  "异世界的月咏深雪平行体",
  "异世界的具体身份、经历、阵营、使命和死亡原因仍然全部留白"
]) {
  assert(ghostTemplateText.includes(needle), `ghost possession worldbook missing rule: ${needle}`);
}
for (const needle of ["affection_stages", "obedience_stages", "alertness_stages", "好感度>=100", "服从度>=100", "警戒度>=100"]) {
  assert(ghostTemplateText.includes(needle), `ghost relationship stages missing: ${needle}`);
}
for (const comment of [
  "[mvu_update]九鬼真白变量",
  "[mvu_plot]九鬼真白人设",
  "[mvu_update]警视厅监视结算规则",
  "[mvu_plot]警视厅关注事件",
  "九鬼真白人设",
  "警视厅关注事件"
]) {
  assert(!comments.includes(comment), `police attention dynamic entry must not be preinstalled in the card: ${comment}`);
}

const duplicateComments = duplicateEntries(comments.filter(Boolean));
assert(!duplicateComments.length, `duplicate worldbook comments: ${duplicateComments.map(([name]) => name).join(", ")}`);

const contentPrefixes = entries
  .map((entry) => normalizedContent(entry.content).slice(0, 600))
  .filter(Boolean);
const duplicateContent = duplicateEntries(contentPrefixes);
assert(!duplicateContent.length, `duplicate worldbook content prefixes: ${duplicateContent.length}`);

for (const comment of BANNED_ENTRY_COMMENTS) {
  assert(!comments.includes(comment), `banned worldbook entry still exists: ${comment}`);
}
assert(
  !comments.includes(DEPRECATED_RECENT_INTERACTION_FEMALE_RULE_COMMENT),
  `deprecated recent interaction worldbook entry still exists: ${DEPRECATED_RECENT_INTERACTION_FEMALE_RULE_COMMENT}`
);

const allWorldbookText = entries.map((entry) => String(entry.content || "")).join("\n");
assertNoLegacyRoleVariablePaths("worldbook", allWorldbookText);
assert(
  !allWorldbookText.includes("<人物演出>") && !allWorldbookText.includes("Galgame人物演出格式"),
  "Galgame output protocol must not have a worldbook injection bypass"
);
for (const staleProfileHint of [
  "档案`子字段",
  "档案子字段",
  "变量结构需包含`档案`",
  "变量结构需包含「档案」",
  "档案(姓名、年龄、社团/职业、身高、体重、三围、头发、面部、上衣、下衣)"
]) {
  assert(!allWorldbookText.includes(staleProfileHint), `worldbook still contains legacy profile hint: ${staleProfileHint}`);
}
const variableUpdateFormatEntry = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]变量更新格式");
assert(variableUpdateFormatEntry, "missing [mvu_update]变量更新格式");
for (const needle of [
  "变量更新必须视为原子事务",
  "角色命令同时写实际MC扣除与成功目标对应的临时/永久催眠效果",
  "数字人数模式的通配路径只是权限包络",
  "最终patch必须使用本轮实际受术且成功的已有实名角色",
  "绝不能输出星号",
  "/角色/犬冢夏美/效果/永久催眠效果/裸体问好",
  "禁止使用指令ID、VIP编号、英文下划线、时间戳、随机数或机器生成编号"
]) {
  assert(String(variableUpdateFormatEntry?.content || "").includes(needle), `variable update atomic hypnosis contract missing: ${needle}`);
}
assert(
  !entries.some((entry) => String(entry?.comment || "") === "[mvu_plot]正文模型变量边界"),
  "obsolete additive plot-model variable boundary must be removed"
);
for (const entry of entries.filter(isEntryEnabled)) {
  const comment = String(entry?.comment || "");
  if (comment.startsWith("[mvu_update]")) continue;
  const content = String(entry?.content || "");
  if (!/<UpdateVariable>|<JSONPatch>/.test(content)) continue;
  assert(false, `plot-visible worldbook must not mention a variable machine block: ${comment || "(unnamed)"}`);
}
{
  const variableUpdateFormatText = String(variableUpdateFormatEntry.content || "");
  const lines = variableUpdateFormatText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const seenLines = new Set();
  const duplicatedLines = [];
  for (const line of lines) {
    if (seenLines.has(line)) duplicatedLines.push(line);
    seenLines.add(line);
  }
  assert(!duplicatedLines.length, `variable update format has duplicated lines: ${duplicatedLines.slice(0, 3).join(" | ")}`);
  assert(variableUpdateFormatText.includes("每个add/replace项必须含`op`、`path`、`value`"), "variable update format must require op/path/value for add and replace");
  assert(variableUpdateFormatText.includes("本条只供额外变量模型") && variableUpdateFormatText.includes("主剧情模型只写正文，绝不输出变量块"), "variable update format must assign the machine block only to the extra variable model");
  assert(!variableUpdateFormatText.includes("剧情模型把变量块放在正文最后"), "variable update format must not ask the plot model to emit a variable block");
  assert(variableUpdateFormatText.includes("remove项只含`op`、`path`"), "variable update format must keep remove free of value");
  assert(variableUpdateFormatText.includes("同一对象内键名不得重复"), "variable update format must reject duplicate object keys");
  assert(variableUpdateFormatText.includes("逐项检查并复核整个数组"), "variable update format must require a whole-array strict JSON review");
  assert(!/"path"\s*:\s*"[^"]+"\s*:\s*[\[{]/.test(variableUpdateFormatText), "variable update format must not contain a missing-value malformed example");
  assert((variableUpdateFormatText.match(/<UpdateVariable>/g) || []).length === 1, "variable update format must contain exactly one UpdateVariable opening tag");
  assert((variableUpdateFormatText.match(/<\/UpdateVariable>/g) || []).length === 1, "variable update format must contain exactly one UpdateVariable closing tag");
  assert((variableUpdateFormatText.match(/<JSONPatch>/g) || []).length === 1, "variable update format must contain exactly one JSONPatch opening tag");
  assert((variableUpdateFormatText.match(/<\/JSONPatch>/g) || []).length === 1, "variable update format must contain exactly one JSONPatch closing tag");
  assert(variableUpdateFormatText.includes("<UpdateVariable><JSONPatch>"), "variable update format must keep the canonical wrapper contiguous");
  assert(!/<UpdateVariable>\s*\[/.test(variableUpdateFormatText), "variable update format must not put a bare JSON array inside UpdateVariable");
  assert(!/<\/?update(?:\s|>)/i.test(variableUpdateFormatText), "variable update format must not retain the legacy update wrapper");
  assert(!/<\/?update_analysis>/i.test(variableUpdateFormatText), "variable update format must not request update_analysis output");
  assert(!/you must output the update analysis/i.test(variableUpdateFormatText), "variable update format must not request verbose analysis output");
  assert(!variableUpdateFormatText.includes("角色资料十页结构："), "variable update format must not duplicate the central role leaf contract");
  assert(variableUpdateFormatText.includes("具体叶子、范围、只读所有权由当前MVU Schema与<变量说明和更新规则>决定"), "variable update format must delegate leaf ownership to the single current contract");
  for (const needle of [
    "每次AI回复必须推进时间",
    "至少推进1分钟",
    "不能与上一层相同或倒退",
    "每轮必须且只能各有一次replace `/系统/当前年份`、`/系统/当前日期`、`/系统/当前时间`",
    "只在正文里写时间不算变量更新"
  ]) {
    assert(variableUpdateFormatText.includes(needle), `variable update format missing mandatory per-reply clock rule: ${needle}`);
  }
  for (const needle of [
    "新增任务的父对象与占位叶均已由前端创建",
    "只允许replace操作列出的两个精确叶",
    "`AI写`是本轮最终白名单",
    "新增任务的两个路径也必须逐字复制"
  ]) {
    assert(variableUpdateFormatText.includes(needle), `variable update format missing frontend-seeded daily-task rule: ${needle}`);
  }
  assert(
    !variableUpdateFormatText.includes("前端已处理、已写入、已删除或明确禁止二次结算的路径不再输出patch"),
    "variable update format must not broadly freeze AI-write leaves under a frontend-created task root"
  );
}
const rewardWorldbookEntries = [
  entries.find((entry) => String(entry?.comment || "") === "[mvu_update]成就与任务回馈机制"),
  entries.find((entry) => String(entry?.comment || "") === "[mvu_update]APP操作-成就任务")
];
for (const entry of rewardWorldbookEntries) {
  assert(entry, "missing achievement/task update worldbook");
  const content = String(entry.content || "");
  for (const needle of ["<操作名>新增任务</操作名>", "前端", "精确路径", "replace", "{{user}}拿起手机接取任务"]) {
    assert(content.includes(needle), `${entry.comment} missing mandatory new-task rule: ${needle}`);
  }
}
assert(
  !allWorldbookText.includes("来源=成就和任务、操作=新增任务"),
  "task rules must match the actual tagged operation structure instead of an absent source/action sentence"
);
const taskVariableContractText = String(entries.find((entry) => String(entry?.comment || "").startsWith("[mvu_update]变量说明和更新规则"))?.content || "");
assert(
  taskVariableContractText.includes("结构: /任务/<真实根键>/{任务,任务ID?"),
  "central task contract must require a generated task display name"
);
assert(
  taskVariableContractText.includes("前端先在/任务/真实根键写入完整每日任务位"),
  "task schema prompt must keep the frontend-seeded daily task object"
);
for (const entry of entries.filter(isEntryEnabled)) {
  assert(!/<\/?update(?:\s|>)/i.test(String(entry?.content || "")), `enabled worldbook retains legacy <update> wrapper: ${entry?.comment || "(unnamed)"}`);
}
assert(!comments.includes("[mvu_update]本轮APP操作"), "obsolete duplicate APP-operation update entry must be removed");
const operationContractText = String(entries.find((entry) => entry?.comment === "[mvu_update]本轮操作")?.content || "");
assert(operationContractText.length > 0 && operationContractText.length <= 2200, "operation overview contract must stay concise");
for (const mode of ["前端已写", "AI结算", "协同", "仅叙事"]) {
  assert(operationContractText.includes(mode), `operation overview contract missing ownership mode: ${mode}`);
}
for (const ownershipLabel of ["AI不动", "AI写", "AI写=无", "前端后值"]) {
  assert(operationContractText.includes(ownershipLabel), `operation overview contract missing per-operation ownership rule: ${ownershipLabel}`);
}
for (const needle of [
  "当前回复最高优先级的执行队列",
  "本次回复按顺序处理全部操作",
  "只停在最后一项的直接后果",
  "每轮至少推进1分钟仅是时间变量合同",
  "变量模型须逐项核对AI写/AI不动"
]) {
  assert(operationContractText.includes(needle), `operation overview contract missing mandatory execution boundary: ${needle}`);
}
const centralVariableContractText = String(entries.find((entry) => String(entry?.comment || "").startsWith("[mvu_update]变量说明和更新规则"))?.content || "");
for (const needle of [
  "每次AI回复必须推进",
  "至少比上一层晚1分钟",
  "除每轮强制写入的当前年份、当前日期、当前时间和当前出场角色外"
]) {
  assert(centralVariableContractText.includes(needle), `central variable contract missing mandatory per-reply clock rule: ${needle}`);
}
assert(centralVariableContractText.includes("已有数值先确定增量Δ"), "central variable contract must require numeric delta reasoning");
assert(centralVariableContractText.includes("replace.value只写最终值，不写Δ") && centralVariableContractText.includes("100+3写103"), "central variable contract must convert deltas into final JSON Patch values");
assert(centralVariableContractText.includes("物品`数量`也必须这样累计或扣减"), "central variable contract must apply delta reasoning to item quantities");
assert(centralVariableContractText.includes("获得1个不是把既有数量replace成1") && centralVariableContractText.includes("减到0才remove物品根"), "central variable contract must distinguish item quantity deltas from final JSON Patch values");
assert(String(variableUpdateFormatEntry.content || "").includes("已有物品数量的增减先用当前数量加本轮增量"), "variable update format must repeat the item-quantity delta rule");
if (!RELEASE_CARD_MODE) {
  for (const needle of [
    "本轮操作为`索要角色物品`或`使用角色物品`",
    "前端只是提交请求，绝不代表成功",
    "物品路径只使用`/角色/<角色名>/物品/持有/<物品名>`",
    "固定生成四件不重名物品",
    "未消耗则保留原变量"
  ]) {
    assert(allWorldbookText.includes(needle), `worldbook missing role-item story adjudication rule: ${needle}`);
  }
  assert(!allWorldbookText.includes("`/角色/<角色名>/物品/刷新`是前端与独立文生文插头独占路径"), "obsolete refresh-item ownership must be removed");
}
assert(!allWorldbookText.includes('"op":"delta"'), "worldbook must not introduce a non-standard delta JSON Patch operation");
assert(allWorldbookText.includes("心理唯一合法路径为/角色/<角色名>/效果/心理"), "worldbook must explicitly constrain psychology to 效果/心理");
assert(allWorldbookText.includes("整体: 外表、内脏、疾病、其他"), "worldbook must expose the current remodel overall disease leaf");
assert(
  allWorldbookText.includes("大多数改造不改变它们") && allWorldbookText.includes("只有本次手术明确造成对应的长期身体变化"),
  "hospital remodel contract must keep height, weight and measurements as low-frequency optional consequences"
);
assert(!allWorldbookText.includes("/系统/_角色变量结构版本"), "worldbook must not retain removed role schema version marker");
assert(
  allWorldbookText.includes("附身（前端只读，AI不得写）")
    || (allWorldbookText.includes("/系统/附身") && (allWorldbookText.includes("前端独占字符串") || allWorldbookText.includes("绝对前端专属"))),
  "system variable output must mark possession as frontend-owned read-only"
);
for (const lineKey of ["_警视厅线", "_医院线", "_灵异线"]) {
  assert(allWorldbookText.includes(lineKey), `system EJS/worldbook missing readonly story line: ${lineKey}`);
}
assert(allWorldbookText.includes("0=未开始，1=进行中，2=结束；前端只读，AI不得写"), "system EJS must explain readonly story-line states");
const allWorldbookSearchText = entries.map((entry) => [
  entry.comment,
  Array.isArray(entry.keys) ? entry.keys.join("|") : "",
  Array.isArray(entry.key) ? entry.key.join("|") : "",
  entry.content
].map((value) => String(value || "")).join("\n")).join("\n");
for (const needle of [
  DEPRECATED_RECENT_INTERACTION_FEMALE_FIELD,
  DEPRECATED_RECENT_INTERACTION_FEMALE_ALT,
  DEPRECATED_RECENT_INTERACTION_FEMALE_PATH
]) {
  assert(!allWorldbookSearchText.includes(needle), `deprecated recent interaction field leaked into worldbook: ${needle}`);
}
assert(
  !initContent.includes(DEPRECATED_RECENT_INTERACTION_FEMALE_FIELD)
  && !initContent.includes(DEPRECATED_RECENT_INTERACTION_FEMALE_ALT),
  "deprecated recent interaction field leaked into init variables"
);
assertNoBannedText("worldbook", allWorldbookText);
assertEjsPromptSafety("worldbook", allWorldbookText);
assert(!allWorldbookSearchText.includes("$警视厅线") && !allWorldbookSearchText.includes("$医院线") && !allWorldbookSearchText.includes("$灵异线"), "worldbook must not retain deprecated $ story lines");
for (const pattern of BANNED_PROMPT_MACRO_PATTERNS) {
  assert(!pattern.test(allWorldbookText), `banned variable macro exposes private/full root data: ${pattern}`);
}
for (const pattern of [
  /\b(?:setvar|incvar|decvar)\s*\(/,
  /<%[=-]/,
  /getvar\(\s*['"]stat_data['"]\s*\)/
]) {
  assert(!pattern.test(allWorldbookText), `unsafe EJS pattern leaked into worldbook: ${pattern}`);
}
assert(
  allWorldbookText.includes("<新增地点补充>")
  && allWorldbookText.includes("前端尚未")
  && allWorldbookText.includes("前端收到后才保存"),
  "worldbook must require AI to emit <新增地点补充> before frontend stores custom locations"
);
for (const needle of ["/系统/_课程表"]) {
  assert(allWorldbookText.includes(needle), `worldbook missing readonly path: ${needle}`);
}
for (const retired of ["/系统/_社畜值", "/系统/_buff", "/系统/_buff结束时间"]) {
  assert(!allWorldbookText.includes(retired), `retired work path leaked into worldbook: ${retired}`);
}

const finalizerText = await readText("scripts/finalize-card-v1_6.mjs");
assert(!/patchMvuSchemaScript\(script\./.test(finalizerText), "finalizer must not call the obsolete regex-based schema patcher");
assert(finalizerText.includes("__ST_HYPNOOS_INTEGRITY_GATE_V1__") && finalizerText.includes("return false;\n})();\nfunction __ST_HYPNOOS_DISTRIBUTION_FAIL__"), "regex staging frontend must use the shared fail-closed integrity gate");
assert(!finalizerText.includes("if (!names.length) return true;"), "runtime ownership checks must never fail open when card identity is unavailable");
const encounterInventoryBlock = frontendSource.slice(
  frontendSource.indexOf("function encounterEnsureSystemInventory"),
  frontendSource.indexOf("function encounterShopState")
);
for (const needle of [
  'inventory[name] = {',
  '"描述": String(description || "").trim() || oldDescription || "未记录"',
  '"数量": oldCount + count',
  "encounterAddInventoryItem(stat, itemName, amount, description);"
]) {
  assert(encounterInventoryBlock.includes(needle), `encounter shop inventory writer missing canonical MVU shape: ${needle}`);
}
for (const forbidden of [
  "inventory[name] = count",
  'inventory.push({ "名称": name',
  'inventory[name] = { "名称": name'
]) {
  assert(!encounterInventoryBlock.includes(forbidden), `encounter shop inventory writer still emits invalid MVU shape: ${forbidden}`);
}
assert(!/(?:^|\n)\s*课程描述:\s*originalDescription\s*,/.test(frontendSource), "frontend must not generate the removed timetable 课程描述 leaf");
assert(!frontendSource.includes('row["课程描述"]'), "frontend must not read the removed timetable 课程描述 leaf");
for (const needle of [
  'const ST_TIMETABLE_ROW_KEYS = ["课节", "科目", "原课程描述", "是否魔改", "魔改课程", "魔改课程描述"]',
  "function normalizeReadonlyTimetableRows(rows)",
  "const timetableSourceRows = Array.isArray(dailySchedule?.课程表)",
  'system["_课程表"] = normalizeReadonlyTimetableRows(dailySchedule.课程表)',
  "window.setTimeout(() => scheduleReadonlyScheduleSyncForCurrentClock(0), 0)",
  "function writeWeeklyTimetableState(table, descriptions, { scheduleSync = true } = {})",
  "function commitTimetableModification(details = {})",
  "settingsReadMvuCandidateForOption(option, { requireReplace: true })",
  "const rowMatches = Boolean(expectedRow && actualRow && JSON.stringify(actualRow) === JSON.stringify(expectedRow))",
  "const countMatches = Boolean(readBack?.stat) && timetableModificationCouponCount(readBack.stat) === expectedCount",
  "const appended = await appendAppOperation(timetableOperationPayload(details, beforeCount))",
  'if (page.dataset.timetableSaving === "true") return',
  'page.dataset.timetableSaving = "true"'
]) {
  assert(frontendSource.includes(needle), `frontend missing targeted timetable-row migration: ${needle}`);
}
const timetableTransactionBlock = frontendSource.slice(
  frontendSource.indexOf("function timetableOperationPayload"),
  frontendSource.indexOf("async function consumeTimetableModificationCoupon")
);
assert(timetableTransactionBlock.includes("restoreTimetableStorageSnapshot") && timetableTransactionBlock.includes("restoreTimetableMvuSnapshot"), "timetable transaction must roll back both local and MVU state");
assert(timetableTransactionBlock.indexOf("settingsReadMvuCandidateForOption(option") < timetableTransactionBlock.indexOf("appendAppOperation"), "timetable operation must be staged only after same-floor MVU readback");
assert(!frontendSource.includes('AI可写路径: [rowPath + "/魔改课程描述"]'), "timetable description must not remain AI-writable");
assert(frontendSource.includes("AI不可写路径: frontendPaths") && frontendSource.includes("AI可写路径: []"), "timetable operation must freeze all front-end-written timetable leaves");

async function runTimetableTransactionFixture({ appendSucceeds = true, replaceSucceeds = true } = {}) {
  let localTable = { 1: ["数学", "英语", "国语", "体育", "化学", "历史"] };
  let localDescriptions = { 1: ["", "", "", "", "", ""] };
  let persistedMvu = {
    stat_data: {
      系统: {
        持有物品: { 课程表魔改券: { 描述: "课程表编辑权限", 数量: 2 } },
        _课程表: Array.from({ length: 6 }, (_, index) => ({
          课节: `${index + 1}限`, 科目: localTable[1][index], 原课程描述: `原课程${index + 1}`,
          是否魔改: false, 魔改课程: "", 魔改课程描述: ""
        }))
      }
    }
  };
  let candidateMvu = structuredClone(persistedMvu);
  let localRollbackCount = 0;
  let appendCalledAfterReadback = false;
  let readbackCompleted = false;
  const candidate = {
    mvu: candidateMvu,
    stat: candidateMvu.stat_data,
    option: { type: "message", message_id: 7 },
    replace: async (next) => {
      if (!replaceSucceeds) return false;
      persistedMvu = structuredClone(next);
      return true;
    }
  };
  let reads = 0;
  const dependencies = {
    ST_TIMETABLE_ROW_KEYS: ["课节", "科目", "原课程描述", "是否魔改", "魔改课程", "魔改课程描述"],
    ST_CLASS_PERIODS: Array.from({ length: 6 }, (_, index) => ({ index: index + 1, label: `${index + 1}限` })),
    TIMETABLE_MOD_COUPON_ITEM: "课程表魔改券",
    requireWritablePhoneFloor: () => true,
    getCurrentVariableOption: () => ({ type: "message", message_id: 7 }),
    settingsReadMvuCandidateForOption: async () => {
      reads += 1;
      if (reads === 1) return candidate;
      readbackCompleted = true;
      return { stat: persistedMvu.stat_data, option: candidate.option, replace: candidate.replace };
    },
    settingsClone: (value) => structuredClone(value),
    timetableModificationCouponCount: (stat) => Number(stat?.系统?.持有物品?.课程表魔改券?.数量 || 0),
    readWeeklyTimetable: () => structuredClone(localTable),
    readWeeklyTimetableDescriptions: () => structuredClone(localDescriptions),
    normalizeWeeklyTimetable: (value) => structuredClone(value),
    normalizeWeeklyTimetableDescriptions: (value) => structuredClone(value),
    defaultCourseDescription: (subject) => `${subject}说明`,
    writeWeeklyTimetableState: (table, descriptions) => {
      const before = { table: structuredClone(localTable), descriptions: structuredClone(localDescriptions) };
      localTable = structuredClone(table);
      localDescriptions = structuredClone(descriptions);
      return { ok: true, before };
    },
    restoreTimetableStorageSnapshot: (before) => {
      localRollbackCount += 1;
      localTable = structuredClone(before.table);
      localDescriptions = structuredClone(before.descriptions);
      return true;
    },
    encounterConsumeInventoryItem: (stat) => {
      stat.系统.持有物品.课程表魔改券.数量 -= 1;
      return true;
    },
    applyReadonlySchedule: (system) => {
      system._课程表 = Array.from({ length: 6 }, (_, index) => {
        const subject = localTable[1][index];
        const modified = subject !== ["数学", "英语", "国语", "体育", "化学", "历史"][index] || Boolean(localDescriptions[1][index]);
        return {
          课节: `${index + 1}限`, 科目: ["数学", "英语", "国语", "体育", "化学", "历史"][index], 原课程描述: `原课程${index + 1}`,
          是否魔改: modified, 魔改课程: modified ? subject : "", 魔改课程描述: modified ? localDescriptions[1][index] : ""
        };
      });
    },
    normalizeReadonlyTimetableRows: (rows) => structuredClone(rows || []),
    appendAppOperation: async () => {
      appendCalledAfterReadback = readbackCompleted;
      return appendSucceeds;
    },
    globalThis: {}
  };
  const factory = new Function("deps", `
    const { ST_TIMETABLE_ROW_KEYS, ST_CLASS_PERIODS, TIMETABLE_MOD_COUPON_ITEM,
      requireWritablePhoneFloor, getCurrentVariableOption, settingsReadMvuCandidateForOption,
      settingsClone, timetableModificationCouponCount, readWeeklyTimetable,
      readWeeklyTimetableDescriptions, normalizeWeeklyTimetable,
      normalizeWeeklyTimetableDescriptions, defaultCourseDescription, writeWeeklyTimetableState,
      restoreTimetableStorageSnapshot, encounterConsumeInventoryItem, applyReadonlySchedule,
      normalizeReadonlyTimetableRows, appendAppOperation, globalThis } = deps;
    ${timetableTransactionBlock}
    return commitTimetableModification;
  `);
  const commit = factory(dependencies);
  const result = await commit({
    consumeCoupon: true, day: 1, period: 2, label: "周一 2限",
    dateText: "2024年4月8日", weekday: "星期一", timeText: "09:35",
    originalSubject: "英语", currentSubject: "英语", nextSubject: "礼仪实践",
    originalDescription: "原课程2", currentDescription: "原课程2", nextDescription: "礼仪实践说明"
  });
  return { result, localTable, localDescriptions, persistedMvu, localRollbackCount, appendCalledAfterReadback };
}

const timetableSuccessFixture = await runTimetableTransactionFixture();
assert(timetableSuccessFixture.result.ok, "timetable transaction success fixture must commit");
assert(timetableSuccessFixture.localTable[1][1] === "礼仪实践", "timetable transaction must update the visible local timetable cell");
assert(timetableSuccessFixture.persistedMvu.stat_data.系统._课程表[1].魔改课程 === "礼仪实践", "timetable transaction must update the exact MVU timetable row");
assert(timetableSuccessFixture.persistedMvu.stat_data.系统.持有物品.课程表魔改券.数量 === 1, "timetable transaction must consume exactly one coupon");
assert(timetableSuccessFixture.appendCalledAfterReadback, "timetable operation must append only after verified readback");
const timetableAppendFailureFixture = await runTimetableTransactionFixture({ appendSucceeds: false });
assert(!timetableAppendFailureFixture.result.ok && timetableAppendFailureFixture.localRollbackCount > 0, "timetable append failure must roll back local state");
assert(timetableAppendFailureFixture.persistedMvu.stat_data.系统.持有物品.课程表魔改券.数量 === 2, "timetable append failure must restore the coupon");
const clockCourseRowsBlock = frontendSource.match(/const courseRowsForDate\s*=\s*\([\s\S]*?\n\s*\};\n\s*const firstClassForDate/);
assert(clockCourseRowsBlock, "frontend clock timetable-row builder must be extractable");
assert(!/\n\s*日期:|\n\s*星期:/.test(clockCourseRowsBlock[0]), "frontend clock timetable rows must not retain legacy 日期/星期 leaves");
for (const needle of [
  "const CURRENT_MVU_CONTRACT_MIGRATION_VERSION = MVU_CONTRACT_VERSION",
  'const CURRENT_MVU_CONTRACT_MIGRATION_PREFIX = "hypnoos.mvu-contract-migration.v"',
  "async function migrateCurrentMvuContractOnce()",
  "if (currentMvuContractMigrationComplete())",
  "return { ok: true, changed: false, skipped: true }",
  "const runtimeZod = globalThis.__ST_HYPNOOS_ZOD__",
  "const normalized = normalizeMvuImportStatData(runtimeZod, candidateStat, { preserveValues: true })",
  "const verified = createMvuSchema(runtimeZod, { preserveUnknown: true }).safeParse(readBack)",
  "settingsVerifiedReplaceCandidate(candidate, nextMvu, normalized.value, option)",
  "同一楼层写后读回与预期不一致",
  "markCurrentMvuContractMigrationComplete()",
  "window.__ST_HYPNOOS_MIGRATE_CURRENT_MVU_CONTRACT__ = migrateCurrentMvuContractOnce"
]) {
  assert(frontendSource.includes(needle), `frontend missing versioned full-contract MVU migration: ${needle}`);
}
{
  const systemDefaultsStart = frontendSource.indexOf("const SETTINGS_SYSTEM_DEFAULTS = {");
  const systemDefaultsEnd = frontendSource.indexOf("\n\t  };", systemDefaultsStart);
  assert(systemDefaultsStart >= 0 && systemDefaultsEnd > systemDefaultsStart, "frontend variable-check system defaults must be extractable");
  const systemDefaultsSource = frontendSource.slice(systemDefaultsStart, systemDefaultsEnd);
  assert(systemDefaultsSource.includes('"当前出场角色": []'), "frontend variable checker must treat current-scene roles as a legal system field");

  const reportStart = frontendSource.indexOf("function settingsVariableReport(");
  const reportEnd = frontendSource.indexOf("\n  function settingsApplyMissingDefault", reportStart);
  assert(reportStart >= 0 && reportEnd > reportStart, "frontend variable report source must be extractable");
  const reportSource = frontendSource.slice(reportStart, reportEnd);
  assert(reportSource.includes("未知键只以当前统一 Zod 合同为准"), "frontend variable report must use the canonical Schema as its unknown-key authority");
  assert(reportSource.includes("report.invalid.push"), "frontend variable report must expose non-unknown blocking Schema issues");
  assert(!reportSource.includes("if (!systemAllowed.has(key))"), "frontend variable report must not use a stale hand-written system allowlist for unknown keys");

  const repairStart = frontendSource.indexOf("async function settingsCorrectCurrentVariableFormat()");
  const repairEnd = frontendSource.indexOf("\n\t  function settingsVariableFormatBridgeReport", repairStart);
  assert(repairStart >= 0 && repairEnd > repairStart, "frontend variable repair source must be extractable");
  const repairSource = frontendSource.slice(repairStart, repairEnd);
  for (const needle of [
    "const writeSucceeded = await encounterReplaceMvuData(data)",
    "typeof data.read === \"function\" ? await data.read(data.option)",
    "expectedSnapshot !== actualSnapshot",
    "const postReport = settingsVariableReport(readBack.stat)",
    "removedExtraCount,"
  ]) {
    assert(repairSource.includes(needle), `frontend variable repair missing verified writeback step: ${needle}`);
  }
  assert(!repairSource.includes("removedExtraCount: report.extra.length"), "frontend variable repair must not claim every pre-report extra was removed");
  assert(!repairSource.includes("extraCount: 0"), "frontend variable repair must report the actual post-write unknown-key count");
}
assert(frontendSource.includes("globalThis.__ST_HYPNOOS_ZOD__ = z"), "frontend must expose its imported Zod namespace to classic migration/runtime scripts");
assert(!/localStorage\??\.clear\s*\(/.test(frontendSource), "frontend MVU migration must not clear unrelated browser storage");
for (const needle of [
  "const daysInStoryMonth",
  "Date.UTC",
  "getUTCDay",
  "getUTCFullYear",
  "data-calendar-year",
  "calendarSelectedYear",
  "data-calendar-year-input",
  "description:"
]) {
  assert(frontendSource.includes(needle), `dynamic story calendar missing: ${needle}`);
}
for (const forbidden of [
  "__ST_HYPNOOS_FIXED_STORY_CALENDAR__",
  "const ST_MONTH_DAYS",
  "schoolYearDay(month, day) - schoolYearDay(4, 9)",
  "weekdayForStoryDate(month + \"月1日\")",
  "data-calendar-time-input",
  "calendarViewTime",
  "查看时间"
]) {
  assert(!frontendSource.includes(forbidden), `dynamic story calendar must remove fixed-year logic: ${forbidden}`);
}
const specialDaysStart = frontendSource.indexOf("  const ST_SPECIAL_DAYS = [");
const specialDaysEnd = frontendSource.indexOf("\n  ];", specialDaysStart);
assert(specialDaysStart >= 0 && specialDaysEnd > specialDaysStart, "special-day source block must exist");
const specialDayRows = [...frontendSource.slice(specialDaysStart, specialDaysEnd).matchAll(
  /\{ m: .*?title: "([^"]+)", detail: "([^"]*)", description: "([^"]+)"/g
)];
assert(specialDayRows.length === 57, `calendar must define 57 described special dates, got ${specialDayRows.length}`);
const specialDayDescriptions = specialDayRows.map((row) => String(row[3] || "").trim());
assert(
  specialDayDescriptions.every((text) => text.length >= 18)
  && new Set(specialDayDescriptions).size === specialDayDescriptions.length,
  "every special date must have a distinct, concrete description"
);
const storyWeekday = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();
assert(storyWeekday(2024, 4, 9) === 2, "2024-04-09 must be Tuesday");
assert(storyWeekday(2025, 4, 9) === 3, "2025-04-09 must be Wednesday");
assert(storyWeekday(2028, 2, 29) === 2, "2028-02-29 must be Tuesday");
const compactSystemSource = finalizerText.slice(finalizerText.indexOf("function compactSystemVariableListWorldbook"), finalizerText.indexOf("function compactLocationRuleVariableListWorldbook"));
assert(!/\b(?:const|let)\s+|=>|Object\.entries\s*\(|\?\?|catch\s*\{/.test(compactSystemSource), "compact system EJS must remain ES5-safe");

const regexText = JSON.stringify(data.extensions?.regex_scripts || []);
assertNoLegacyRoleVariablePaths("regex_scripts", regexText);
const regexScripts = data.extensions?.regex_scripts || [];
const regexIds = regexScripts.map((script) => String(script?.id || "").trim());
assert(regexIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)), "all regex scripts must have a valid UUID v4 id");
const duplicateRegexIds = duplicateEntries(regexIds);
assert(!duplicateRegexIds.length, `regex script ids must be unique: ${duplicateRegexIds.join(", ")}`);
const mapPayloadHideRegex = regexScripts.find((script) => String(script?.scriptName || script?.name || "") === "[隐藏]地图更新标签");
assert(
  mapPayloadHideRegex?.disabled !== true
  && mapPayloadHideRegex?.markdownOnly === true
  && mapPayloadHideRegex?.promptOnly === true
  && mapPayloadHideRegex?.minDepth === 0
  && ["地图更新", "学校地图更新", "新增地点补充", "地点信息更新"].every((tag) => String(mapPayloadHideRegex?.findRegex || "").includes(tag)),
  "all machine-readable map payload tags must be hidden from display and model prompt at every depth"
);
const profileEventHideRegex = regexScripts.find((script) => String(script?.scriptName || script?.name || "") === "优化隐藏<人物档案事件记录>");
assert(
  profileEventHideRegex?.disabled !== true
  && profileEventHideRegex?.markdownOnly === true
  && profileEventHideRegex?.promptOnly === true
  && profileEventHideRegex?.minDepth === 0,
  "profile event memory payload must be hidden from display and prompt immediately after frontend ingestion"
);
const deprecatedRegexNames = new Set([
  "测试用",
  "匿名版测试",
  "匿名版",
  "前端（手机端）",
  "主仓库",
  "本轮操作AI提醒美化",
  "本轮操作旧格式操作项美化",
  "本轮操作旧格式简项美化"
]);
const deprecatedRegexIds = new Set([
  "fe9113dc-f89b-4e42-8187-986861e67ab3",
  "4f95726c-735e-4601-a240-c2470f5e23bc",
  "38aa5a0f-66de-4901-8361-85ded033f8a1",
  "0bb99406-4667-48e0-9574-4f0367c5dd7e",
  "53757492-5ce3-4ad7-ad1a-334c41088542",
  "2dc9a4a7-7a28-4bf6-ae1b-30228687a50a",
  "349ea1ae-6f13-43c4-968b-45344140ebd3",
  "f9f7fab4-6f72-4665-8092-e7bc8a6e5874"
]);
assert(
  !regexScripts.some((script) =>
    deprecatedRegexNames.has(String(script?.scriptName || script?.name || ""))
    || deprecatedRegexIds.has(String(script?.id || ""))
  ),
  "deprecated anonymous/test/legacy-operation regexes must not be bundled"
);
for (const name of ["本轮操作卡片", "本轮操作五层后隐藏", "提示词仅保留当前本轮操作", "提示词清理历史本轮操作"]) {
  assert(regexScripts.some((script) => String(script?.scriptName || script?.name || "") === name && script?.disabled !== true), `missing current operation regex: ${name}`);
}
for (const name of ["本轮操作AI提醒标签美化", "本轮操作项美化", "本轮操作子封装美化"]) {
  assert(!regexScripts.some((script) => String(script?.scriptName || script?.name || "") === name), `legacy nested operation regex must be removed: ${name}`);
}
const galgameDisplayRegex = (data.extensions?.regex_scripts || []).find((script) =>
  String(script?.id || "") === "691f9c3a-9da3-44ae-8b0d-8c64f7d3e8e1"
);
const galgamePromptRegex = (data.extensions?.regex_scripts || []).find((script) =>
  String(script?.id || "") === "2d16e34c-c413-465c-939f-1282c15957a8"
);
assert(galgameDisplayRegex && galgamePromptRegex, "missing Galgame marker display/history regex pair");
assert(
  galgameDisplayRegex.disabled !== true
  && galgameDisplayRegex.markdownOnly === true
  && galgameDisplayRegex.promptOnly === false
  && galgameDisplayRegex.minDepth == null
  && galgameDisplayRegex.maxDepth === 4,
  "Galgame display regex must render only the newest five floors"
);
assert(
  galgamePromptRegex.disabled !== true
  && galgamePromptRegex.markdownOnly === true
  && galgamePromptRegex.promptOnly === false
  && galgamePromptRegex.minDepth === 5
  && galgamePromptRegex.maxDepth == null,
  "Galgame history regex must unwrap visual protocol from the sixth floor onward"
);
assert(galgameDisplayRegex.findRegex === galgamePromptRegex.findRegex, "Galgame display/history regexes must parse exactly the same total block");
assert(storedRegex(galgameDisplayRegex.findRegex).global, "Galgame total-block regex must be global");
const galgameShortSample = `普通正文。
<人物演出>
【月咏深雪】(￣ヘ￣)【交互】〔动作〕她推了推眼镜。〔思考〕不能让他看出动摇。〔台词〕你终于来了。
【西园寺爱丽莎】(¬_¬)【交互】〔动作〕她停下脚步。〔台词〕有事就快说。
</人物演出>`;
const galgameDisplayRendered = galgameShortSample.replace(storedRegex(galgameDisplayRegex.findRegex), String(galgameDisplayRegex.replaceString || ""));
assert(
  galgameDisplayRendered.includes("普通正文。")
  && (galgameDisplayRendered.match(/⟪人物演出总块⟫/g) || []).length === 1
  && galgameDisplayRendered.includes("⟪人物演出总块⟫⟪/人物演出总块⟫")
  && !galgameDisplayRendered.includes("【月咏深雪】")
  && !galgameDisplayRendered.includes("〔思考〕")
  && !galgameDisplayRendered.includes("<人物演出>")
  && !galgameDisplayRendered.includes("<style")
  && !galgameDisplayRendered.includes("<img"),
  "Galgame display regex must emit one payload-free marker so Markdown cannot consume angle brackets"
);
const galgamePromptRendered = galgameShortSample.replace(storedRegex(galgamePromptRegex.findRegex), String(galgamePromptRegex.replaceString || ""));
assert(
  galgamePromptRendered.includes("⟪人物演出历史块⟫⟪/人物演出历史块⟫")
  && !galgamePromptRendered.includes("【月咏深雪】")
  && !galgamePromptRendered.includes("<人物演出>")
  && !galgamePromptRendered.includes("⟪人物演出总块⟫"),
  "Galgame history regex must also keep the payload out of Markdown"
);
const galgameSevenPersonSample = `普通正文。
<人物演出>
【犬冢穗波】(´•_•\`)【交互】〔动作〕在水里轻轻踩水。〔台词〕“不着急做决定，慢慢想。”〔思考〕*我会等他。*
【天城纱良】(〃ω〃)【交互】〔动作〕双手在水下搅动。〔台词〕“我在这边。”
【犬冢夏美】(｀ε´)【交互】〔动作〕拍了一下水。〔台词〕“快点嘛！”
【月咏深雪】(⊙ˍ⊙)【交互】〔动作〕按实浴巾边缘。〔台词〕“不要勉强。”〔思考〕*希望他能感受到。*
【西园寺爱丽莎】(￣へ￣)【交互】〔动作〕抱在胸前。〔台词〕“随便你。”
【阿宅】(´；ω；\`)【交互】〔动作〕缩了缩掌机。〔台词〕“存档点在附近。”
【九鬼真白】(╬ Ò﹏Ó)【交互】〔动作〕敲了一下椅背。〔台词〕“别让我等太久。”〔思考〕*他选错就有他受的。*
</人物演出>
<fox_selc>
(￣へ￣)<font color="#FF4500">选择一。</font>
</fox_selc>
<fox_tip>提示。</fox_tip>`;
const galgameSevenPersonRendered = galgameSevenPersonSample.replace(
  storedRegex(galgameDisplayRegex.findRegex),
  String(galgameDisplayRegex.replaceString || "")
);
assert(
  (galgameSevenPersonRendered.match(/⟪人物演出总块⟫/g) || []).length === 1
  && !["犬冢穗波", "天城纱良", "犬冢夏美", "月咏深雪", "西园寺爱丽莎", "阿宅", "九鬼真白"].some((name) =>
    galgameSevenPersonRendered.includes(`【${name}】`)
  )
  && galgameSevenPersonRendered.includes("<fox_selc>")
  && galgameSevenPersonRendered.includes("<fox_tip>")
  && galgameSevenPersonRendered.indexOf("⟪/人物演出总块⟫") < galgameSevenPersonRendered.indexOf("<fox_selc>"),
  "Galgame display regex must isolate the complete block without consuming adjacent fox blocks"
);
for (const [label, sample] of [
  ["retired labeled fields", "<人物演出>【角色】月咏深雪【表情】(・_・)【交互】〔动作〕旧格式</人物演出>"],
  ["missing expression", "<人物演出>【月咏深雪】【交互】〔动作〕缺少颜文字</人物演出>"],
  ["missing interaction field", "<人物演出>【月咏深雪】(・_・)〔动作〕缺少交互字段</人物演出>"],
  ["legacy child tags", "<人物演出><角色>月咏深雪</角色><内容>旧格式</内容></人物演出>"],
  ["literal less-than", "<人物演出>【月咏深雪】(・_・)【交互】〔动作〕HP<10，转向<门外>。</人物演出>"],
  ["nested html-like text", "<人物演出>【月咏深雪】(・_・)【交互】<b>按纯文本保留。</b></人物演出>"]
]) {
  assert(
    sample.replace(storedRegex(galgameDisplayRegex.findRegex), "changed") === "changed",
    `Galgame total-block regex must tolerate ${label}`
  );
}
const galgameBookTitleWrapper = "《人物演出》【月咏深雪】(・_・)【交互】〔动作〕错误外壳《/人物演出》";
assert(
  galgameBookTitleWrapper.replace(storedRegex(galgameDisplayRegex.findRegex), "changed") === galgameBookTitleWrapper,
  "Galgame total-block regex must still require the ASCII outer wrapper"
);
assert(
  ["<人物演出>", "【最终短场景参与人物的完整原名】", "【交互】", "〔动作〕", "〔台词〕", "〔思考〕", "每一轮回复都必须有该块"].every((needle) => finalizerText.includes(needle))
  && finalizerText.includes("不要输出【角色】或【表情】字段名"),
  "Galgame injection prompt must define only the current total-block grammar"
);
assert(
  finalizerText.includes("不输出、复述或修复<UpdateVariable>") && finalizerText.includes("变量只由额外变量模型追加"),
  "Galgame injection prompt must keep variable output out of the plot model"
);
assert("普通环境叙述。".replace(storedRegex(galgameDisplayRegex.findRegex), "changed") === "普通环境叙述。", "Galgame regex must leave ordinary prose unchanged");
const variableUpdateHideRegex = regexScripts.find((script) =>
  String(script?.scriptName || script?.name || "") === "[隐藏]变量更新"
);
assert(variableUpdateHideRegex, "missing unified variable display hide regex");
assert(
  !regexScripts.some((script) =>
    ["[折叠]完整变量更新", "[隐藏]无效旧变量更新"].includes(String(script?.scriptName || script?.name || ""))
  ),
  "legacy variable fold/invalid-hide regexes must be removed instead of layered"
);
const canonicalVariableSample = '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/系统/当前时间","value":"12:33"}]</JSONPatch></UpdateVariable>';
const invalidVariableSample = '<UpdateVariable>{"系统":{"当前时间":"12:33"}}</UpdateVariable>';
assert(
  canonicalVariableSample.replace(storedRegex(variableUpdateHideRegex.findRegex), String(variableUpdateHideRegex.replaceString || "")) === "",
  "canonical variable update must be hidden from display"
);
assert(
  invalidVariableSample.replace(storedRegex(variableUpdateHideRegex.findRegex), String(variableUpdateHideRegex.replaceString || "")) === "",
  "MVU first-floor object snapshot must be hidden by the same existing display rule"
);
const actionFoldRegex = (data.extensions?.regex_scripts || []).find((script) =>
  String(script?.scriptName || script?.name || "") === "本轮操作卡片"
);
assert(actionFoldRegex, "missing operation action-fold regex");
assert(
  String(actionFoldRegex.replaceString || "") === "⟪HYPNOOS_ACTION_FOLD_V3⟫$1⟪/HYPNOOS_ACTION_FOLD_V3⟫"
  && !String(actionFoldRegex.replaceString || "").includes("<"),
  "operation action-fold regex must emit one HTML-free host marker"
);
assert(
  JSON.stringify(actionFoldRegex.placement) === JSON.stringify([1]),
  "operation action-fold regex must only run on user input"
);
const actionFoldSample = "玩家正文前\\n<本轮操作>\\n<操作项><操作名>测试操作</操作名><操作内容>测试内容</操作内容></操作项>\\n</本轮操作>\\n玩家正文后";
const actionFoldRendered = actionFoldSample.replace(
  storedRegex(actionFoldRegex.findRegex),
  String(actionFoldRegex.replaceString || "")
);
assert(
  actionFoldRendered.includes("玩家正文前")
  && actionFoldRendered.includes("玩家正文后")
  && actionFoldRendered.includes("⟪HYPNOOS_ACTION_FOLD_V3⟫")
  && actionFoldRendered.includes("⟪/HYPNOOS_ACTION_FOLD_V3⟫")
  && actionFoldRendered.includes("测试操作"),
  "operation action-fold regex must preserve surrounding user prose and expose one host-rendered body"
);
const promptCurrentOperationRegex = regexScripts.find((item) => String(item?.scriptName || item?.name || "") === "提示词仅保留当前本轮操作");
const promptHistoryOperationRegex = regexScripts.find((item) => String(item?.scriptName || item?.name || "") === "提示词清理历史本轮操作");
assert(
  promptCurrentOperationRegex?.promptOnly === true
  && promptCurrentOperationRegex?.markdownOnly === false
  && promptCurrentOperationRegex?.maxDepth === 0
  && promptHistoryOperationRegex?.promptOnly === true
  && promptHistoryOperationRegex?.markdownOnly === false
  && promptHistoryOperationRegex?.minDepth === 1,
  "prompt operation regexes must expose only the current operation and remove historical operations"
);
assert(
  String(promptCurrentOperationRegex?.replaceString || "") === "<本轮操作>$1</本轮操作>",
  "current prompt operation regex must preserve the semantic wrapper used by the mandatory operation worldbook"
);
const promptOperationSample = "普通用户文字<本轮操作><本轮执行边界>必须结算</本轮执行边界><操作项>测试</操作项></本轮操作>尾部";
const promptOperationRendered = promptOperationSample.replace(
  storedRegex(promptCurrentOperationRegex.findRegex),
  String(promptCurrentOperationRegex.replaceString || "")
);
assert(
  promptOperationRendered.includes("普通用户文字")
  && promptOperationRendered.includes("尾部")
  && (promptOperationRendered.match(/<本轮操作>/g) || []).length === 1
  && (promptOperationRendered.match(/<\/本轮操作>/g) || []).length === 1
  && promptOperationRendered.includes("<本轮执行边界>必须结算</本轮执行边界>"),
  "current prompt operation regex must retain one complete mandatory queue without touching surrounding user prose"
);
const oldMessagePromptHideRegex = regexScripts.find((item) =>
  String(item?.id || "") === "226cb5b2-e3d7-4a23-a9ed-7ab4d3dc0fe6"
  || String(item?.scriptName || item?.name || "") === "提示词隐藏十层前完整消息"
);
assert(oldMessagePromptHideRegex, "missing old-message prompt hide regex");
assert(
  oldMessagePromptHideRegex.disabled !== true
  && oldMessagePromptHideRegex.promptOnly === true
  && oldMessagePromptHideRegex.markdownOnly === false
  && JSON.stringify(oldMessagePromptHideRegex.placement) === JSON.stringify([1, 2])
  && oldMessagePromptHideRegex.minDepth === 10
  && oldMessagePromptHideRegex.maxDepth == null
  && String(oldMessagePromptHideRegex.findRegex || "") === "/[\\s\\S]+/g"
  && String(oldMessagePromptHideRegex.replaceString || "") === "",
  "old-message prompt hide must remove complete user/assistant messages from depth 10 onward without changing chat display"
);
assert(
  !(data.extensions?.regex_scripts || []).some((script) =>
    String(script?.id || "") === "153bbe31-704b-48fc-b111-6063ded9e3d2"
    || String(script?.scriptName || script?.name || "") === "外层rawData本轮操作折叠兼容"
  ),
  "legacy rawData source-rewrite regex must not be bundled"
);
const rewardDatabase = data.extensions?.workbench?.rewardDatabase || {};
const rewardAchievements = Array.isArray(rewardDatabase.achievements) ? rewardDatabase.achievements : [];
for (const expected of [
  ["ach_line_police_complete", "超越规则", "完成警视厅线。", "系统._警视厅线", 30],
  ["ach_line_hospital_complete", "非道德企划", "完成医院线。", "系统._医院线", 30],
  ["ach_line_ghost_complete", "\"月咏深雪\"", "完成隐藏线。", "系统._灵异线", 30]
]) {
  const [id, title, description, path, starlight] = expected;
  const item = rewardAchievements.find((entry) => String(entry?.id || "") === id);
  assert(item, `missing line-completion achievement: ${id}`);
  assert(String(item.title || "") === title, `bad achievement title for ${id}: ${item.title}`);
  assert(String(item.description || "") === description, `bad achievement description for ${id}: ${item.description}`);
  assert(Number(item.reward?.starlight) === starlight, `bad achievement reward for ${id}: ${item.reward?.starlight}`);
  const expression = String(item.variableCondition?.expression || "").trim();
  assert(expression === `${path} >= 2`, `bad achievement condition for ${id}: ${expression}`);
}
const tavernHelperScripts = data.extensions?.tavern_helper?.scripts || [];
const operationExecutionGateScripts = tavernHelperScripts.filter((script) => String(script?.id || "") === "d565c0ba-0c82-45b0-b12a-48a771d96b27");
assert(operationExecutionGateScripts.length === 1, "current-operation execution gate must be provided by exactly one Tavern Helper script");
const operationExecutionGateScript = operationExecutionGateScripts[0];
assert(isScriptEnabled(operationExecutionGateScript), "current-operation execution gate must be enabled");
assert(String(operationExecutionGateScript?.name || "") === "本轮操作执行闸门（请勿关闭）", "current-operation execution gate name mismatch");
const operationExecutionGateText = scriptText(operationExecutionGateScript);
for (const needle of [
  "[本轮操作执行闸门｜只认最新用户消息]", "最新一条真实user消息", "isVisibleUserMessage",
  "latestUserText", "latestUserRecord", "applyFromMessageId", "handleGeneration", "extractOperationBlock", "message?.mes ?? message?.message ?? message?.content ?? message?.text",
  "GENERATION_AFTER_COMMANDS", "GENERATION_STARTED", "MESSAGE_SENT", "MESSAGE_SWIPED",
  "injectPrompts", "uninjectPrompts", "setExtensionPrompt", "position: 'in_chat'", "role: 'system'", "depth: 0",
  "用户无具体动作", "用户只选择了开场"
]) {
  assert(operationExecutionGateText.includes(needle), `current-operation execution gate missing: ${needle}`);
}
assert(!/MutationObserver|setInterval\s*\(/.test(operationExecutionGateText), "current-operation execution gate must not poll or scan the DOM");
assert(!/https?:\/\//.test(operationExecutionGateText), "current-operation execution gate must not load an external URL");
assert(/should_scan\s*:\s*true/.test(operationExecutionGateText), "current-operation execution gate must let the current operation activate scan-depth-zero mechanism entries");
new Script(executableScriptText(operationExecutionGateScript?.content), { filename: "operation-execution-gate-parse.js" });
const fixtureOperation = [
  "<本轮操作>",
  "<本轮执行边界>本轮必须优先执行全部操作。</本轮执行边界>",
  "<课程表><操作项><操作名>推进日程格</操作名><操作内容>目标日期=2024年4月9日｜目标时间=14:20｜选中格数=2</操作内容></操作项></课程表>",
  "</本轮操作>"
].join("\n");
const currentOperationFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: false, mes: "旧剧情" },
  { is_user: true, mes: fixtureOperation }
]);
assert(currentOperationFixture.injections.length === 1, "latest user operation must be injected exactly once at boot");
const currentOperationRow = currentOperationFixture.injections[0]?.[0];
assert(currentOperationRow?.position === "in_chat" && currentOperationRow?.depth === 0 && currentOperationRow?.role === "system", "current operation must inject as depth-0 in-chat system prompt");
assert(
  String(currentOperationRow?.content || "").includes("<本轮操作><本轮执行边界>本轮必须优先执行全部操作。</本轮执行边界>")
  && String(currentOperationRow?.content || "").includes("<操作名>推进日程格</操作名>")
  && String(currentOperationRow?.content || "").includes("目标时间=14:20")
  && String(currentOperationRow?.content || "").endsWith("</本轮操作>"),
  "current operation injection must preserve the complete latest operation container"
);
assert(String(currentOperationRow?.content || "").includes("若任何思考步骤得出“用户无具体动作”"), "current operation injection must invalidate no-action/opening misclassification");
const rerollFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: true, mes: fixtureOperation },
  { is_user: false, mes: "上一次错误回复" }
]);
assert(rerollFixture.injections.length === 1, "assistant reroll must retain the latest user operation gate");
const staleOperationFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: true, mes: fixtureOperation },
  { is_user: false, mes: "含有<本轮操作>复述的旧回复</本轮操作>" },
  { is_user: true, mes: "这次只是普通对话" },
  { is_user: false, mes: "助手再次复述" + fixtureOperation }
]);
assert(staleOperationFixture.injections.length === 0, "historical user operations and assistant repetitions must not reactivate the gate after a newer normal user message");
const malformedOperationFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: true, mes: "<本轮操作><课程表>缺少闭合标签" }
]);
assert(malformedOperationFixture.injections.length === 0, "an unclosed current-operation container must not be injected");
const duplicateOperationFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: true, mes: fixtureOperation + "\n" + fixtureOperation }
]);
assert(duplicateOperationFixture.injections.length === 0, "duplicate current-operation containers must fail closed");
const fallbackChat = [{ is_user: true, mes: fixtureOperation }];
const fallbackOperationFixture = runOperationGateFixture(operationExecutionGateScript?.content, fallbackChat, { injectAvailable: false });
assert(
  fallbackOperationFixture.extensionPrompts.some((args) => String(args?.[1] || "").includes("<操作名>推进日程格</操作名>")),
  "current-operation execution gate must fall back to setExtensionPrompt"
);
fallbackChat.push({ is_user: false, mes: "错误回复" }, { is_user: true, mes: "新的普通对话" });
await fallbackOperationFixture.runtime.apply();
assert(
  fallbackOperationFixture.extensionPrompts.some((args) => args?.[1] === ""),
  "a newer normal user message must clear the fallback operation prompt"
);
assert(typeof currentOperationFixture.runtime?.apply === "function", "current-operation execution gate must expose a reusable event refresh method");
const exactMessageGateFixture = runOperationGateFixture(operationExecutionGateScript?.content, [
  { is_user: true, mes: fixtureOperation },
  { is_user: false, mes: "旧回复" }
]);
await exactMessageGateFixture.eventHandlers.get("generation_started")?.("normal", {});
const gateInjectionsBeforeCurrentSend = exactMessageGateFixture.injections.length;
exactMessageGateFixture.chat.push({ is_user: true, mes: "普通新消息" });
await exactMessageGateFixture.eventHandlers.get("message_sent")?.(exactMessageGateFixture.chat.length - 1);
assert(exactMessageGateFixture.injections.length === gateInjectionsBeforeCurrentSend, "normal generation must not re-read and inject a stale operation before MESSAGE_SENT");
exactMessageGateFixture.chat.push({ is_user: true, mes: fixtureOperation });
await exactMessageGateFixture.eventHandlers.get("message_sent")?.(exactMessageGateFixture.chat.length - 1);
assert(exactMessageGateFixture.injections.length === gateInjectionsBeforeCurrentSend + 1, "MESSAGE_SENT must bind the operation gate to the exact latest user message id");
await exactMessageGateFixture.eventHandlers.get("message_sent")?.(0);
assert(exactMessageGateFixture.injections.length === gateInjectionsBeforeCurrentSend + 1, "an inserted historical user message id must not reactivate the operation gate");
await exactMessageGateFixture.eventHandlers.get("generation_started")?.("regenerate", {});
assert(exactMessageGateFixture.injections.length === gateInjectionsBeforeCurrentSend + 2, "regenerate must retain the latest real user operation without a new MESSAGE_SENT event");

const latestUserDeliveryScripts = tavernHelperScripts.filter((script) => String(script?.id || "") === "c2bdd9a1-20d7-41ad-9f7f-51ab56b35c8d");
assert(latestUserDeliveryScripts.length === 1, "latest-user delivery guard must exist exactly once");
const latestUserDeliveryScript = latestUserDeliveryScripts[0];
assert(isScriptEnabled(latestUserDeliveryScript), "latest-user delivery guard must be enabled");
assert(String(latestUserDeliveryScript?.name || "") === "最新用户消息送模完整性守卫（请勿关闭）", "latest-user delivery guard name mismatch");
const latestUserDeliveryText = scriptText(latestUserDeliveryScript);
for (const needle of [
  "HYPNOOS_LATEST_USER_ANCHOR", "MESSAGE_SENT", "CHAT_COMPLETION_PROMPT_READY", "eventMakeLast",
  "nativeSeen", "当前轮最新用户消息送模补偿", "position: 'in_chat'", "depth: 0", "role: 'system'"
]) {
  assert(latestUserDeliveryText.includes(needle), `latest-user delivery guard missing: ${needle}`);
}
assert(!/MutationObserver|setInterval\s*\(|https?:\/\//.test(latestUserDeliveryText), "latest-user delivery guard must not poll the DOM or load an external URL");
const nativeDeliveryChat = [{ is_user: false, mes: "旧回复" }, { is_user: true, mes: "和两人亲亲" }];
const nativeDeliveryFixture = runLatestUserDeliveryFixture(latestUserDeliveryScript?.content, nativeDeliveryChat);
await nativeDeliveryFixture.eventHandlers.get("message_sent")?.(1);
const nativeAnchor = String(nativeDeliveryFixture.injections.at(-1)?.[0]?.content || "");
assert(/^\[\[HYPNOOS_LATEST_USER_ANCHOR:/.test(nativeAnchor) && !nativeAnchor.includes("和两人亲亲"), "delivery anchor must contain metadata only, never the user text");
const nativePromptChat = [{ role: "system", content: nativeAnchor }, { role: "user", content: "和两人亲亲" }];
nativeDeliveryFixture.eventHandlers.get("chat_completion_prompt_ready")?.({ chat: nativePromptChat, dryRun: false });
assert(nativePromptChat.some((message) => message.role === "user" && message.content === "和两人亲亲"), "native latest user message must remain in the final prompt");
assert(!nativePromptChat.some((message) => String(message.content || "").includes("送模补偿") || String(message.content || "").includes("HYPNOOS_LATEST_USER_ANCHOR")), "native delivery must remove the anchor without duplicating user text");

const missingDeliveryFixture = runLatestUserDeliveryFixture(latestUserDeliveryScript?.content, [{ is_user: true, mes: "和两人亲亲" }]);
await missingDeliveryFixture.eventHandlers.get("message_sent")?.(0);
const missingAnchor = String(missingDeliveryFixture.injections.at(-1)?.[0]?.content || "");
const missingPromptChat = [{ role: "system", content: missingAnchor }, { role: "assistant", content: "旧回复" }];
missingDeliveryFixture.eventHandlers.get("chat_completion_prompt_ready")?.({ chat: missingPromptChat, dryRun: false });
assert(missingPromptChat.filter((message) => String(message.content || "").includes("和两人亲亲")).length === 1, "missing native user text must be repaired exactly once at prompt-ready");
assert(missingPromptChat.some((message) => message.role === "system" && String(message.content || "").includes("不得延迟到下一楼")), "delivery repair must identify the restored message as the current turn");
missingDeliveryFixture.eventHandlers.get("chat_completion_prompt_ready")?.({ chat: missingPromptChat, dryRun: false });
assert(missingPromptChat.filter((message) => String(message.content || "").includes("和两人亲亲")).length === 1, "a consumed delivery repair must not repeat for extra-model prompt events");
assert(!JSON.stringify(missingDeliveryFixture.logs).includes("和两人亲亲"), "delivery diagnostics must not log user text");

const operationDeliveryFixture = runLatestUserDeliveryFixture(latestUserDeliveryScript?.content, [{ is_user: true, mes: fixtureOperation }]);
await operationDeliveryFixture.eventHandlers.get("message_sent")?.(0);
assert(operationDeliveryFixture.injections.length === 0, "operation containers must be handled only by the operation gate, not ordinary-user delivery repair");
const pendingTaskInjectionScript = tavernHelperScripts.find((script) => String(script?.name || "") === "未完成任务动态注入");
assert(pendingTaskInjectionScript, "missing unfinished-task dynamic injection script");
const pendingTaskInjectionText = scriptText(pendingTaskInjectionScript);
assert(!pendingTaskInjectionText.includes("task['已领取']"), "unfinished-task injection must use the lightweight task contract without a claim flag");
assert(pendingTaskInjectionText.includes("这里只列当前已经存在的有效任务"), "unfinished-task injection must describe only valid existing tasks");
assert(
  !tavernHelperScripts.some((script) =>
    String(script?.id || "") === "5532ee0a-a57c-4f5d-8d1b-0623e3b41632"
    || String(script?.name || "") === "新聊天初始角色空根守卫"
  ),
  "initial-role empty-root guard must not be bundled; fix the existing initialization writer instead"
);
const floatingPhoneHostScripts = tavernHelperScripts.filter((script) => String(script?.id || "") === "4ebce7e7-3a35-4fa1-9130-bf397905f236");
assert(floatingPhoneHostScripts.length === 1, "floating phone host must be provided by exactly one Tavern Helper script");
assert(floatingPhoneHostScripts[0]?.enabled !== false, "floating phone Tavern Helper host script must be enabled");
const floatingPhoneHostText = scriptText(floatingPhoneHostScripts[0]);
for (const needle of [
  "floating-bootstrap.js", "dataset.mode = 'host'", "CHAT_CHANGED", "MESSAGE_SENT", "CHARACTER_MESSAGE_RENDERED", "character_message_rendered", "MESSAGE_SWIPED",
  "MESSAGE_UPDATED", "MESSAGE_DELETED", "HYPNOOS_FLOATING_REGISTRY_READY", "destroy",
  "8f69fa0e-1a51-4f63-9dc0-1129ef0ab4d7", "dataset.galgameScriptId", "dataset.galgameScriptName"
]) {
  assert(floatingPhoneHostText.includes(needle), `floating phone Tavern Helper host missing: ${needle}`);
}
assert(!floatingPhoneHostText.includes("MutationObserver") && !floatingPhoneHostText.includes("setInterval"), "floating phone Tavern Helper host must not poll or scan the chat DOM");
try {
  new Script(executableScriptText(floatingPhoneHostScripts[0]?.content), { filename: "floating-phone-host.js" });
} catch (error) {
  throw new Error(`floating phone Tavern Helper host failed to parse: ${error?.message || error}`);
}

const frontendMode = String(data.extensions?.workbench?.frontendMode || "local");
const localDesktopRegex = regexScripts.find((script) => String(script?.scriptName || script?.name || "") === "暂存区（本地版）");
const remoteStagingRegex = regexScripts.find((script) => String(script?.scriptName || script?.name || "") === "暂存区");
const activeStagingRegex = frontendMode === "remote" ? remoteStagingRegex : localDesktopRegex;
assert(activeStagingRegex && activeStagingRegex.disabled !== true, "missing enabled staging placeholder regex");
assert(String(activeStagingRegex.findRegex || "").includes("StatusPlaceHolderImpl"), "staging regex must match StatusPlaceHolderImpl");
assert(String(activeStagingRegex.replaceString || "").includes("floating-bootstrap.js"), "staging regex must load the lightweight bootstrap");
assert(String(activeStagingRegex.replaceString || "").includes('bootstrap.dataset.mode = "stage"'), "staging regex must use stage-only bootstrap mode");
assert(!String(activeStagingRegex.replaceString || "").includes("hypnosis-app-phone/st-load-inline.html"), "staging regex must not own or load the phone frontend");
if (frontendMode === "remote") {
  assert(!localDesktopRegex, "remote card must not include local desktop frontend regex");
  assert(remoteStagingRegex, "remote card must include the staging placeholder regex");
  assert(!regexText.includes("暂存区（本地版）"), "remote card regex still contains local staging regex name");
  assert(!regexText.includes(LOCAL_FRONTEND_ORIGIN), "remote card regex must not reference local frontend origin");
  assert(regexText.includes(`cdn.jsdelivr.net/gh/${DIST_REPO}@`), "remote card regex does not use commit-pinned CDN");
  assert(!regexText.includes(`cdn.jsdelivr.net/gh/${DIST_REPO}@main`), "card regex points at mutable main branch");
  assert(floatingPhoneHostText.includes(`cdn.jsdelivr.net/gh/${DIST_REPO}@`), "remote floating host must use commit-pinned CDN assets");
  assert(!floatingPhoneHostText.includes(`cdn.jsdelivr.net/gh/${DIST_REPO}@main`), "remote floating host points at mutable main branch");
  assert(floatingPhoneHostText.includes("/dist/phone/st-load-inline.html"), "remote floating host does not own the phone frontend URL");
} else {
  assert(localDesktopRegex, "missing local desktop frontend regex");
  assert(Boolean(localDesktopRegex.disabled) === false, "local desktop frontend regex must be enabled in local mode");
  assert(!remoteStagingRegex, "local card must not include the remote staging regex");
  assert(
    String(data.extensions?.workbench?.frontendUrl || "") === LOCAL_FRONTEND_ORIGIN + "/public/frontends/hypnosis-app/st-load-inline.html",
    "local card workbench desktop frontend URL is invalid"
  );
  assert(!regexText.includes(`cdn.jsdelivr.net/gh/${DIST_REPO}@`), "local card regex must not silently load CDN frontend");
  assert(String(localDesktopRegex.replaceString || "").includes(LOCAL_FRONTEND_ORIGIN + "/public/frontends/hypnosis-app/floating-bootstrap.js"), "local desktop regex does not load floating phone bootstrap");
  assert(!String(localDesktopRegex.replaceString || "").includes(LOCAL_FRONTEND_ORIGIN + "/public/frontends/hypnosis-app/st-load-inline.html"), "local staging regex must not embed the desktop frontend");
  assert(floatingPhoneHostText.includes(LOCAL_FRONTEND_ORIGIN + "/public/frontends/hypnosis-app-phone/st-load-inline.html"), "local floating host does not own the phone frontend URL");
  assert(floatingPhoneHostText.includes(LOCAL_FRONTEND_ORIGIN + "/public/frontends/hypnosis-app/floating-bootstrap.js"), "local floating host does not load the bootstrap");
}
assertNoBannedText("regex_scripts", regexText);
const identityRegex = (data.extensions?.regex_scripts || []).find((script) => String(script?.id || "") === "24624365-b2bb-46be-92eb-8aa6e4c61a05" || String(script?.scriptName || script?.name || "") === "首楼身份选择前端");
assert(!identityRegex, "retired first-floor identity regex must be absent");
const xiaoQiaoCredit = "@小乔 的世界书";
assert(frontendSource.split(xiaoQiaoCredit).length - 1 === 1, "help credits must include @小乔 exactly once");
assert(entries.every((entry) => !String(entry?.content || "").includes(xiaoQiaoCredit)), "community credits must not leak into AI-visible worldbooks");
for (const needle of ["催眠APP使用者登记", "__ST_OPEN_USER_REGISTRATION_APP__", "registrationCommit", 'data.stat["系统"]["_user身份"] = identity', "一键默认填写", "开场说明已填入酒馆输入框"]) {
  assert(frontendSource.includes(needle), `phone registration app missing contract: ${needle}`);
}

const mirroredFrontendSource = await readFile("public/frontends/hypnosis-app/index.html", "utf8");
for (const frontendPath of [
  "public/frontends/hypnosis-app/index.html",
  "public/frontends/hypnosis-app/st-load.html",
  "public/frontends/hypnosis-app/st-load-inline.html",
  "public/frontends/hypnosis-app-phone/st-load-inline.html",
]) {
  const generatedFrontend = await readText(frontendPath);
  const natsumiStart = generatedFrontend.indexOf('"犬冢夏美":');
  const natsumiPreview = natsumiStart >= 0 ? generatedFrontend.slice(natsumiStart, natsumiStart + 1400) : "";
  assert(natsumiStart >= 0, `${frontendPath} missing Natsumi preview fixture`);
  assert(natsumiPreview.includes('"身高":"148cm"'), `${frontendPath} must derive Natsumi's authoritative 148cm height`);
  assert(!natsumiPreview.includes('"身高":"160cm"'), `${frontendPath} retained the obsolete Natsumi 160cm preview height`);
}
for (const needle of [
  "HYPNOOS_DAILY_SCHEDULE_CHANGED",
  "__ST_HYPNOOS_DAILY_SCHEDULE_API__",
  "__ST_HYPNOOS_TIMETABLE_SNAPSHOT__",
  "__ST_HYPNOOS_TIMETABLE_COMMIT__",
  "__ST_HYPNOOS_TIMETABLE_MOVE_CARD__",
  "__ST_HYPNOOS_TIMETABLE_ADD_NOTE__",
  "__ST_HYPNOOS_TIMETABLE_ADVANCE__",
  "__ST_HYPNOOS_TIMETABLE_NEXT_DAY__",
  "reserveDailyGamblingCard",
  "settleDailyGamblingResult",
  "openGamblingPage",
  "gamblingRandomInt",
  "crypto.getRandomValues",
  "settingsVerifiedReplaceCandidate",
  '前端已写路径: ["/系统/持有零花钱"]',
  'AI不可写路径: ["/系统/持有零花钱"]',
  "日程卡保存失败，本局已回滚",
  "推进到最后一个有内容的格子",
  '"/系统/当前地点"',
  "今天六次行动机会",
  "function hypnosisEffectDisplayTitle",
  "return \"裸体问好\""
]) {
  assert(mirroredFrontendSource.includes(needle), `mirrored daily schedule runtime missing: ${needle}`);
}
for (const retired of ["ST_WORK_JOBS", "openWorkPage", "renderWorkPage", "workEncounterProgressStorageKey", "__ST_OPEN_WORK_APP__", ".st-work-app", ".st-work-room", "syncWorkBuffStatusReminder", "normalizeWorkEncounterPhasePayload", "__ST_PRUNE_EXPIRED_WORK_OPERATIONS__", "__ST_HYPNOOS_UPDATE_WORK_LEVER__", "encounterInferWorkValueFromRole"]) {
  assert(!mirroredFrontendSource.includes(retired), `retired work runtime leaked into mirrored frontend: ${retired}`);
}
assert(mirroredFrontendSource.includes("anchor < current"), "daily schedule must keep the exactly-current action slot usable");

assert(!mirroredFrontendSource.includes("encounterRepairBrokenPersonaEntry"), "encounter frontend must never overwrite an existing persona entry");
assert(
  mirroredFrontendSource.includes('target === "人设" && trimmed.includes("行为指导")')
  && mirroredFrontendSource.includes('if (/^<%/.test(trimmed)) continue;'),
  "encounter persona parser must isolate behavior EJS from malformed persona tags"
);

const galgameInjectionScripts = tavernHelperScripts.filter((script) => String(script?.id || "") === "8f69fa0e-1a51-4f63-9dc0-1129ef0ab4d7");
const floatingBootstrapSource = await readText("src/hypnoos-floating-bootstrap.js");
assert(!floatingBootstrapSource.includes('panel.insertBefore(radar, panel.querySelector(".phone-wrap"))'), "floating shell must not insert radar before a non-child phone-wrap node");
for (const needle of ['panel.querySelector(":scope > .dual-stage")', "shellReady = true", "resetIncompleteShell", "isReady: function ()"]) {
  assert(floatingBootstrapSource.includes(needle), `floating shell missing transactional readiness contract: ${needle}`);
}
for (const needle of [
  "function isVisibleAssistantMessage",
  "function visibleAssistantRecords",
  "function chatTopologySignature",
  "message.is_system === true",
  "message.hidden === true",
  "message.extra_model === true",
  "loadedForWritableId = \"\""
]) {
  assert(floatingBootstrapSource.includes(needle), `floating host missing hidden/extra-model floor protection: ${needle}`);
}
assert(
  floatingBootstrapSource.includes("ST_HYPNOOS_OPENING_WORLDINFO_REQUEST")
  && floatingBootstrapSource.includes("ensureOpeningWorldbooks")
  && floatingBootstrapSource.includes('"rebindCharWorldbooks"')
  && floatingBootstrapSource.includes("'deleteWorldbook'")
  && floatingBootstrapSource.includes("importHostWorldInfoModule")
  && floatingBootstrapSource.includes("ensureOpeningWorldbooksRaw")
  && floatingBootstrapSource.includes("host-native-raw")
  && floatingBootstrapSource.includes("mod.loadWorldInfo")
  && floatingBootstrapSource.includes("mod.saveWorldInfo"),
  "floating host must broker raw opening worldbook writes, binding and duplicate checks"
);
assert(galgameInjectionScripts.length === 1, "Galgame protocol must be provided by exactly one Tavern Helper script");
assert(
  tavernHelperScripts.filter((script) => scriptText(script).includes("【HYPNOOS_GALGAME_MODE_ON】")).length === 1,
  "Galgame output protocol must have exactly one Tavern Helper injection provider"
);
assert(
  floatingBootstrapSource.includes("galgameRawMessageForContainer")
  && floatingBootstrapSource.includes("galgamePayloadForContainer")
  && floatingBootstrapSource.includes("message.mes ?? message.message ?? message.content ?? message.text")
  && floatingBootstrapSource.includes("return entries.length ? entries : [[\"演出记录\", \"\", source]]"),
  "Galgame host must read the exact floor's raw message and degrade malformed content without losing the block"
);
assert(
  floatingBootstrapSource.includes("GALGAME_RUNTIME_KEY")
  && floatingBootstrapSource.includes("new MutationObserverCtor")
  && floatingBootstrapSource.includes("/⟪人物演出(?:总|历史)块⟫/.test(String(message.textContent || \"\"))")
  && floatingBootstrapSource.includes("hostDocument.createTextNode(galgamePayloadForContainer")
  && floatingBootstrapSource.includes("galgameFinalRenderEvents.has(eventName)")
  && floatingBootstrapSource.includes("scheduleGalgameRender();")
  && floatingBootstrapSource.includes("renderGalgameMarkers"),
  "Galgame renderer must restore history as text and rescan finalized character messages"
);
assert(
  frontendSource.includes("Number(previousRuntime.version) >= 11")
  && frontendSource.includes("version: 11")
  && !frontendSource.includes("runtime.renderGalgame("),
  "full phone frontend must not own Galgame marker observation"
);
assert(galgameInjectionScripts[0]?.enabled !== false, "Galgame Tavern Helper injection script must be enabled");
const galgameInjectionText = scriptText(galgameInjectionScripts[0]);
for (const needle of [
  "injectPrompts", "uninjectPrompts", "setExtensionPrompt", "candidateWindows", "findFunction",
  "GENERATION_STARTED", "GENERATION_AFTER_COMMANDS", "CHAT_CHANGED", "MESSAGE_SWIPED",
  "VARIABLE_INITIALIZED", "VARIABLE_UPDATE_ENDED", "waitGlobalInitialized",
  "runtimeEnabled", "setEnabled", "runtime-toggle-on",
  "【HYPNOOS_GALGAME_MODE_ON】", "完整原名",
  "<人物演出>", "</人物演出>", "【最终短场景参与人物的完整原名】", "【交互】",
  "〔动作〕", "〔台词〕", "〔思考〕", "〔思考〕是否出现不作硬性要求",
  "每一轮回复都必须有该块", "人物演出块是本轮正文之后真正发生的最后一个短场景",
  "正文里已经出现过的内容不得摘录、改写、概括或再次引用", "才以“user”收录",
  "人物演出块始终至少有一条", "一次且仅一次人物演出块",
  "不能只挑最后说话或最后动作的一人", "最终场景有多人继续在场时",
  "脚本禁用时完全不输出人物演出格式"
]) {
  assert(galgameInjectionText.includes(needle), `Galgame Tavern Helper script missing: ${needle}`);
}
for (const removedNeedle of [
  "<kg ", "<small>", "<i>", "<b>", 'p=\\"auto\\"', 's=\\"1\\"',
  "DEFAULT_ROLE_NAMES", "__HYPNOOS_ROLE_NAMES__", "currentRoleNames", "当前合法角色名",
  "⟪人物演出总块⟫", "由你逐句检查本轮正文", "正文落点后紧接的一次简短补充互动",
  "优先写正文没有出现的新动作", "普通正文照常书写", "补充的一句回应",
  "完整原名在本轮正文中一次也没有出现", "正文已经出现过名字的角色绝不重复输出",
  "没有遗漏角色时完全不输出空块", "【角色】月咏深雪【表情】",
  "正文已经写过也照常收录", "只提取该人物本轮最后一次交互",
  "本轮每名实际出场人物恰好一条"
]) {
  assert(!galgameInjectionText.includes(removedNeedle), `Galgame script must not retain removed protocol/runtime text: ${removedNeedle}`);
}
assert(
  String(galgameInjectionScripts[0]?.info || "").includes("每轮正文末尾强制输出")
  && String(galgameInjectionScripts[0]?.info || "").includes("正文之后新发生")
  && String(galgameInjectionScripts[0]?.info || "").includes("不复述正文")
  && String(galgameInjectionScripts[0]?.info || "").includes("人物框、照片与绰号由已加载前端建立"),
  "Galgame script info must describe the mandatory tail-block protocol and frontend integration"
);
try {
  new Script(executableScriptText(galgameInjectionScripts[0]?.content), { filename: "galgame-injection.js" });
} catch (error) {
  throw new Error(`Galgame Tavern Helper script failed to parse: ${error?.message || error}`);
}
assert(!/\$(?:照片|人物照片|当前照片)/.test(galgameInjectionText), "Galgame mode must not introduce a photo variable");
const closingInjectionDefinitions = [
  {
    id: "0b6d09f3-9380-46f0-95e4-cd55cf1790fd",
    label: "temporal narrative format",
    needles: [
      "CONFIG.mode === 'temporal'", "injectPrompts", "uninjectPrompts", "setExtensionPrompt",
      "CHAT_CHANGED", "MESSAGE_SENT", "GENERATION_STARTED", "VARIABLE_UPDATE_ENDED",
      "hypnoos-temporal-narrative-v1", "__ST_HYPNOOS_TEMPORAL_NARRATIVE_RUNTIME__",
      "[时空轮转与收束输出协议]", "唯一来源", "普通单一连续场景不得硬加标题",
      "【时空轮转·其一｜时间｜地点｜视角】", "【时空收束｜最终时间｜最终地点】",
      "催眠APP不能提供全知视角", "角色也只能知道自己在场",
      "目标课节晚于当前时间时", "最终时间至少到该课开始", "剧情实际经过更久则以剧情终点为准", "课节已过不得倒退",
      "时空收束节点决定/系统/当前年份", "人物演出只能承接时空收束所指的最终节点"
    ]
  },
  {
    id: "34eb4b11-8519-4c3a-a6f8-6d687587b6c8",
    label: "Kuki closing",
    needles: ["injectPrompts", "setExtensionPrompt", "CHAT_CHANGED", "MESSAGE_SENT", "VARIABLE_UPDATE_ENDED", "_警视厅线", "九鬼真白", "【九鬼真白的施虐】"]
  },
  {
    id: "5a91c8d7-47b6-4c8e-983f-5bb6d1c4fc24",
    label: "pending task",
    needles: [
      "injectPrompts", "setExtensionPrompt", "CHAT_CHANGED", "MESSAGE_SENT", "VARIABLE_UPDATE_ENDED",
      "CONFIG.mode === 'tasks'", "root['任务']", "task['已完成'] !== false", "rows.length >= 3",
      "/已完成", '"op":"replace"', '"value":true', "已完成任务不参与判断"
    ]
  }
];
for (const definition of closingInjectionDefinitions) {
  const matches = tavernHelperScripts.filter((script) => String(script?.id || "") === definition.id);
  assert(matches.length === 1, `${definition.label} must be provided by exactly one Tavern Helper script`);
  assert(matches[0]?.enabled !== false, `${definition.label} Tavern Helper script must be enabled`);
  const text = scriptText(matches[0]);
  for (const needle of definition.needles) assert(text.includes(needle), `${definition.label} script missing: ${needle}`);
  assert(!/https?:\/\//.test(text), `${definition.label} script must not load an external URL`);
  assert(!/MutationObserver|setInterval\s*\(/.test(text), `${definition.label} script must not poll or scan the DOM`);
  const syntax = spawnSync(process.execPath, ["--check", "--input-type=module", "-"], {
    input: String(matches[0]?.content || ""), encoding: "utf8",
  });
  assert(syntax.status === 0, `${definition.label} protected module must parse`);
}
assert(!tavernHelperScripts.some((script) => String(script?.id || "") === "d7bc7f38-3d32-4c57-88ab-9a43573fa0e2"), "retired dispatch closing helper must be absent");
assert(!entries.some((entry) => String(entry?.comment || "") === "[mvu_plot]AI固定收束输出控制"), "legacy fixed-closing worldbook must be removed");
const dispatchClosingRegex = (data.extensions?.regex_scripts || []).find((script) => String(script?.id || "") === "a62a52df-8a39-447c-bae2-6b72b412bc1f");
const kukiClosingRegex = (data.extensions?.regex_scripts || []).find((script) => String(script?.id || "") === "e6f44d9a-43d1-4c01-a71a-2a6d777ba720");
assert(!dispatchClosingRegex && kukiClosingRegex, "retired dispatch regex must be absent and Kuki regex must remain");
assert(Number(kukiClosingRegex.maxDepth) === 4, "Kuki closing display regex must stop after five visible layers");
assert(String(kukiClosingRegex.replaceString || "").includes("<details open"), "Kuki closing must be expanded by default");
const bundledSchemaScripts = tavernHelperScripts.filter((script) => /registerMvuSchema\s*\(/.test(scriptText(script)));
assert(bundledSchemaScripts.length === 1, `final card must bundle exactly one registerMvuSchema script, found ${bundledSchemaScripts.length}`);
const bundledSchemaScript = bundledSchemaScripts[0];
assert(isScriptEnabled(bundledSchemaScript), "bundled registerMvuSchema script must be enabled");
assert(String(bundledSchemaScript?.id || "") === MVU_SCHEMA_SCRIPT_ID, `bundled Schema script id mismatch: ${bundledSchemaScript?.id || ""}`);
assert(String(bundledSchemaScript?.name || "") === MVU_SCHEMA_SCRIPT_NAME, `bundled Schema script name mismatch: ${bundledSchemaScript?.name || ""}`);
assert(executableScriptText(bundledSchemaScript?.content) === MVU_SCHEMA_SCRIPT_CONTENT, "bundled Schema script must come from the current single-source contract");
assert((scriptText(bundledSchemaScript).match(/registerMvuSchema\s*\(/g) || []).length === 1, "bundled Schema script must register exactly once");

const fixedVariableLists = new Map([
  ["系统变量列表", { depth: 0, constant: true, selective: false }],
  ["地点规则变量", { depth: 0, constant: true, selective: false }],
  ["库存物品变量", { depth: 1, constant: false, selective: true }],
  ["课程表变量", { depth: 1, constant: true, selective: false }],
  ["地点变量", { depth: 1, constant: false, selective: true }],
]);
for (const comment of ["[mvu_plot]劣迹性格表现", "[mvu_plot]劣迹罪行记录", "[mvu_plot]长期改造生效"]) {
  const matches = entries.filter((entry) => String(entry?.comment || "") === comment);
  assert(matches.length === 1, `persistent plot worldbook must exist exactly once: ${comment}`);
  assert(isEntryEnabled(matches[0]) && matches[0]?.constant === true && matches[0]?.selective === false, `persistent plot worldbook must be blue/always-on: ${comment}`);
}
for (const comment of ["日历和日程表*EJS制作中"]) {
  const matches = entries.filter((entry) => String(entry?.comment || "") === comment);
  assert(matches.length === 1, `calendar/timetable worldbook must exist exactly once: ${comment}`);
  assert(isEntryEnabled(matches[0]) && matches[0]?.constant === true && matches[0]?.selective === false, `calendar/timetable worldbook must be blue/always-on: ${comment}`);
}
const timetableVariableEntry = entries.find((entry) => String(entry?.comment || "") === "课程表变量");
for (const needle of [
  "1限08:40-09:30",
  "2限09:40-10:30",
  "5限13:20-14:10",
  "只在本轮明确上课",
  "最终时间不得早于开始时间",
  "剧情实际终点更晚时以剧情为准",
  "若该课已过，绝不倒退",
  "仅看到课表不得自动跳课",
  "魔改课程沿用它所在课节的固定时间"
]) {
  assert(String(timetableVariableEntry?.content || "").includes(needle), `timetable time contract missing: ${needle}`);
}
const timetableModificationEntry = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]课程表魔改券规则");
assert(timetableModificationEntry?.constant === false && timetableModificationEntry?.selective === true, "timetable modification rules must activate only for the current modification operation");
assert(Number(timetableModificationEntry?.extensions?.scan_depth) === 0, "timetable modification rules must not reactivate from historical operations");
for (const needle of [
  "永久修改本聊天周课表中的“星期＋课节”单格",
  "课程描述也没有AI写入例外",
  "不是`/规则`地点规则",
  "不生成持续时间、到期时间或解除事件",
  "范围只限被选择的“星期＋课节”单格"
]) {
  assert(String(timetableModificationEntry?.content || "").includes(needle), `timetable modification boundary missing: ${needle}`);
}
const remodelPlotEntry = entries.find((entry) => String(entry?.comment || "") === "[mvu_plot]长期改造生效");
for (const needle of ["getvar('stat_data.角色'", "role['改造']", "Object.keys(remodel).length === 0", "疾病事实", "前端明确撤销"]) {
  assert(String(remodelPlotEntry?.content || "").includes(needle), `persistent remodel plot worldbook missing: ${needle}`);
}
const locationRuleVariableEntry = entries.find((entry) => String(entry?.comment || "") === "地点规则变量");
for (const needle of [
  "getvar('stat_data.规则'",
  "getvar('stat_data.系统.当前地点'",
  "typeof lastUserMessage",
  "appliesToCurrent",
  "appliesToIntent",
  "当前地点或其子地点命中",
  "本轮明确准备前往",
  "<当前适用地点规则>"
]) {
  assert(String(locationRuleVariableEntry?.content || "").includes(needle), `location-rule EJS applicability filter missing: ${needle}`);
}
assert(!String(locationRuleVariableEntry?.content || "").includes("YAML.stringify(rules)"), "location-rule EJS must not dump every rule without applicability filtering");
const locationRuleContractEntry = entries.find((entry) => String(entry?.comment || "") === "[mvu_update]地点常识规则");
for (const needle of ["变量路径: /规则", "持续类型: 永久 | 临时", "lastUserMessage", "永久", "子地点", "再次进入或准备前往"]) {
  assert(String(locationRuleContractEntry?.content || "").includes(needle), `location-rule update contract missing: ${needle}`);
}
assert(!entries.some((entry) => ["任务变量", "[mvu_update]任务变量"].includes(String(entry?.comment || ""))), "legacy keyword-triggered task variable worldbook must be removed");
assert(!entries.some((entry) => String(entry?.comment || "") === "[mvu_update]最近交互角色规则"), "removed recent interaction role worldbook must not remain");
assert(!entries.some((entry) => String(entry?.comment || "") === "[mvu_update]未完成任务判定*EJS"), "obsolete pending-task EJS worldbook must be removed");
const variableListEntries = entries.filter((entry) => {
  const comment = String(entry?.comment || "");
  return fixedVariableLists.has(comment)
    || (/变量$/.test(comment) && /stat(?:\*|_)data\.角色\./.test(String(entry?.content || "")));
});
for (const [comment, expected] of fixedVariableLists) {
  assert(variableListEntries.some((entry) => String(entry?.comment || "") === comment), `missing shared variable-list entry: ${comment}`);
  const entry = variableListEntries.find((candidate) => String(candidate?.comment || "") === comment);
  assert(!/^\[mvu_(?:update|plot)\]/.test(comment), `variable list must be shared by both models: ${comment}`);
  assert(isEntryEnabled(entry), `variable list must be enabled: ${comment}`);
  assert(String(entry?.position || "") === "at_depth", `variable list must use at_depth: ${comment}`);
  assert(Number(entry?.extensions?.position) === 4, `variable list must use extension position 4: ${comment}`);
  assert(Number(entry?.extensions?.depth) === expected.depth, `variable list depth mismatch: ${comment}`);
  assert(Boolean(entry?.constant) === expected.constant, `variable list constant mismatch: ${comment}`);
  assert(Boolean(entry?.selective) === expected.selective, `variable list selective mismatch: ${comment}`);
  if (expected.selective) {
    const keys = Array.isArray(entry?.keys) ? entry.keys : Array.isArray(entry?.key) ? entry.key : [];
    assert(keys.some((key) => String(key || "").trim()), `selective variable list must have a keyword: ${comment}`);
  }
}
for (const entry of variableListEntries) {
  const comment = String(entry?.comment || "");
  assert(!/^\[mvu_(?:update|plot)\]/.test(comment), `role variable list must be shared by both models: ${comment}`);
  assert(isEntryEnabled(entry), `role variable list must be enabled: ${comment}`);
  assert(String(entry?.position || "") === "at_depth" && Number(entry?.extensions?.position) === 4, `role variable list placement mismatch: ${comment}`);
  if (!fixedVariableLists.has(comment)) {
    assert(Number(entry?.extensions?.depth) === 0, `role variable list must use D0: ${comment}`);
    assert(Boolean(entry?.constant) === false && Boolean(entry?.selective) === true, `role variable list must be keyword-triggered: ${comment}`);
  }
}

const enabledConstantMvuEntries = entries.filter((entry) => isEntryEnabled(entry) && entry?.constant === true && String(entry?.comment || "").startsWith("[mvu_update]"));
const alwaysOnMvuChars = enabledConstantMvuEntries.reduce((sum, entry) => sum + String(entry?.content || "").length, 0);
assert(alwaysOnMvuChars <= 16000, `always-on MVU prompt exceeds budget: ${alwaysOnMvuChars}/16000`);
for (const entry of enabledConstantMvuEntries) {
  const length = String(entry?.content || "").length;
  assert(length <= 9000, `single always-on MVU entry too large: ${entry?.comment || "(unnamed)"} ${length}/9000`);
}
const missingValueRepairScripts = tavernHelperScripts.filter((script) => String(script?.id || "") === MVU_MISSING_VALUE_REPAIR_SCRIPT_ID);
assert(missingValueRepairScripts.length === 1, `MVU missing-value repair helper must exist exactly once, found ${missingValueRepairScripts.length}`);
const missingValueRepairText = scriptText(missingValueRepairScripts[0]);
const missingValueRepairContent = String(missingValueRepairScripts[0]?.content || "");
for (const needle of [
  "COMMAND_PARSED", "JSON.parse(repaired)", "commands.push(...operations.map(toCommand))",
  "filterProtectedRoleCommands", "currentAuthorizedPaths", "eventMakeLast", "segments.length >= 4"
]) {
  assert(missingValueRepairText.includes(needle), `MVU missing-value repair helper missing narrow guard: ${needle}`);
}
for (const forbidden of ["getChatMessages", "replaceMvuData", "updateVariablesWith", "jsonrepair", "JSON5", "YAML", "toastr"]) {
  assert(!missingValueRepairText.includes(forbidden), `MVU missing-value repair helper must not use broad/direct mechanism: ${forbidden}`);
}
{
  const handlers = new Map();
  let latestOperation = "";
  const context = {
    eventOn(name, handler) { handlers.set(name, handler); },
    eventMakeLast(name, handler) { handlers.set(name, handler); },
    Mvu: { events: { COMMAND_PARSED: "mag_command_parsed" } },
    __ST_HYPNOOS_ZOD__: z,
    __ST_HYPNOOS_CURRENT_OPERATION_GATE_RUNTIME__: {
      latestUserText: () => latestOperation,
      extractOperationBlock: (value) => String(value || "")
    }
  };
  context.globalThis = context;
  new Script(executableScriptText(missingValueRepairContent)).runInNewContext(context);
  const handler = handlers.get("mag_command_parsed");
  assert(typeof handler === "function", "MVU missing-value repair helper must register COMMAND_PARSED handler");
  const recover = (content, seed = []) => {
    handler({ stat_data: structuredClone(initData) }, seed, content);
    return seed;
  };
  const recoveredArray = recover('<UpdateVariable><json_patch>[{"op":"replace","path":"/系统/_课程表":[{"课节":"1限","科目":"英语","原课程描述":"测试","是否魔改":false,"魔改课程":"","魔改课程描述":""}]},{"op":"replace","path":"/系统/当前时间","value":"12:30"}]</json_patch></UpdateVariable>');
  assert(recoveredArray.length === 2 && recoveredArray[0]?.type === "set" && recoveredArray[1]?.type === "set", "MVU repair must recover a missing array value and preserve sibling operations");
  const recoveredObject = recover('<json_patch>[{"op":"add","path":"/系统/持有物品/护符":{"描述":"测试","数量":1}}]</json_patch>');
  assert(recoveredObject.length === 1 && recoveredObject[0]?.type === "insert", "MVU repair must recover a missing object value");
  const recoveredBareWrapper = recover('<UpdateVariable>[{"op":"replace","path":"/系统/当前时间","value":"12:31"}]</UpdateVariable>');
  assert(recoveredBareWrapper.length === 1 && recoveredBareWrapper[0]?.type === "set", "MVU repair must narrowly recover one strict bare Patch array inside UpdateVariable");
  assert(recover('<UpdateVariable>{"ops":[{"type":"replace","path":"/任务/quest_gay_gay/已完成","value":true}]}</UpdateVariable>').length === 0, "MVU repair must reject legacy ops/type task envelopes");
  assert(recover('<UpdateVariable>{"op":"replace","path":"/系统/当前时间","value":"12:31"}</UpdateVariable>').length === 0, "MVU repair must reject a bare Patch object");
  assert(recover('<UpdateVariable>[{"op":"replace","path":"/系统/当前时间","value":"12:31"}]</UpdateVariable><UpdateVariable>[]</UpdateVariable>').length === 0, "MVU repair must reject multiple bare UpdateVariable blocks");
  assert(recover('<json_patch>[{"op":"replace","path":"/系统/当前时间":"12:30"}]</json_patch>').length === 0, "MVU repair must reject missing scalar value syntax");
  assert(recover('<json_patch>[{"op":"replace","path":"/系统/当前时间":["甲"]}]</json_patch><json_patch>[]</json_patch>').length === 0, "MVU repair must reject multiple patch blocks");
  const existing = [{ type: "set", full_match: JSON.stringify({ op: "replace", path: "/系统/当前时间", value: "12:31" }), args: ["系统.当前时间", JSON.stringify("12:31")] }];
  recover('<json_patch>[{"op":"replace","path":"/系统/当前时间":["甲"]}]</json_patch>', existing);
  assert(existing.length === 1, "MVU repair must not run when parsed commands already exist");

  const statVariables = { stat_data: structuredClone(initData) };
  statVariables.stat_data.角色.东乡一二三 = structuredClone(initData.角色.西园寺爱丽莎);
  statVariables.stat_data.角色.东乡一二三.信息.姓名 = "东乡一二三";
  const command = (op, path, value = {}) => ({
    type: op === "add" ? "insert" : op === "remove" ? "delete" : "set",
    full_match: JSON.stringify(op === "remove" ? { op, path } : { op, path, value }),
    args: []
  });
  const structuralCommands = [
    command("add", "/角色/新角色", { 信息: {} }),
    command("replace", "/角色/东乡一二三", { 信息: {} }),
    command("replace", "/角色/东乡一二三/劣迹", { 罪行: {} }),
    command("remove", "/角色/东乡一二三"),
    command("replace", "/角色/东乡一二三/状态/好感度", 1),
    command("replace", "/角色/东乡一二三/效果/临时催眠效果/短时命令", { 内容: "测试" }),
    command("replace", "/系统/当前时间", "12:31")
  ];
  handler(statVariables, structuralCommands, "");
  assert(structuralCommands.length === 0, "a batch containing unauthorized role roots or whole pages must be rejected atomically");

  latestOperation = [
    "<本轮操作>",
    "<本轮执行边界>测试</本轮执行边界>",
    "<变量权限>- 人物档案/删除角色｜AI不动=无｜AI写=/角色/东乡一二三</变量权限>",
    "<操作项><操作名>删除角色</操作名></操作项>",
    "</本轮操作>"
  ].join("\n");
  const authorizedDelete = [command("remove", "/角色/东乡一二三")];
  handler(statVariables, authorizedDelete, "");
  assert(authorizedDelete.length === 1, "an existing role root remove with an exact current AI-write permission must remain valid");

  latestOperation = [
    "<本轮操作>",
    "<本轮执行边界>测试</本轮执行边界>",
    "<变量权限>- 子嗣/转入角色｜AI不动=无｜AI写=/角色/子嗣甲</变量权限>",
    "<操作项><操作名>转入角色</操作名></操作项>",
    "</本轮操作>"
  ].join("\n");
  const childRoleSeed = structuredClone(initData.角色.西园寺爱丽莎);
  childRoleSeed.信息.姓名 = "子嗣甲";
  const authorizedCreate = [command("add", "/角色/子嗣甲", childRoleSeed)];
  handler(statVariables, authorizedCreate, "");
  assert(authorizedCreate.length === 1, "an absent role root add with an exact current AI-write permission must remain valid");
  const duplicateCreate = [command("add", "/角色/东乡一二三", { 信息: {} })];
  latestOperation = latestOperation.replaceAll("子嗣甲", "东乡一二三");
  handler(statVariables, duplicateCreate, "");
  assert(duplicateCreate.length === 0, "an authorized add must still reject a duplicate existing role root");

  latestOperation = "";
  const invalidTimeBatch = [
    command("replace", "/系统/当前时间", "12:31"),
    command("replace", "/系统/当前时间", "99:99")
  ];
  handler({ stat_data: structuredClone(initData) }, invalidTimeBatch, "");
  assert(invalidTimeBatch.length === 0, "a later invalid value must reject the entire ordered Patch batch");
  const invalidRemodelLeaf = [command("add", "/角色/西园寺爱丽莎/改造/头/未知细分", "x")];
  handler({ stat_data: structuredClone(initData) }, invalidRemodelLeaf, "");
  assert(invalidRemodelLeaf.length === 0, "Patch authorization must reject unknown remodel leaves");
  const smuggledRemodelLeaf = [command("replace", "/角色/西园寺爱丽莎/改造/头", { 头: "保留", 未知细分: "x" })];
  const remodelRoot = structuredClone(initData);
  remodelRoot.角色.西园寺爱丽莎.改造.头 = { 头: "原值" };
  handler({ stat_data: remodelRoot }, smuggledRemodelLeaf, "");
  assert(smuggledRemodelLeaf.length === 0, "whole-object replace must not smuggle a new unknown fixed leaf");
  const unknownBaseline = structuredClone(initData);
  unknownBaseline.系统.旧版本字段 = { 保留: true };
  const legalWithUnknownBaseline = [command("replace", "/系统/当前时间", "12:31")];
  handler({ stat_data: unknownBaseline }, legalWithUnknownBaseline, "");
  assert(legalWithUnknownBaseline.length === 1, "an unchanged legacy unknown key must not block an otherwise valid Patch");
  const repairedRootAndLeaf = recover('<json_patch>[{"op":"add","path":"/角色/重复角色":{"信息":{"姓名":"重复角色"}}},{"op":"replace","path":"/角色/东乡一二三/状态/好感度","value":2}]</json_patch>');
  assert(repairedRootAndLeaf.length === 0, "missing-value repair output containing an unauthorized root must reject the whole batch");
}
const dailySettlementScripts = tavernHelperScripts.filter((script) =>
  String(script?.id || "") === DAILY_SETTLEMENT_SCRIPT_ID || String(script?.name || "") === DAILY_SETTLEMENT_SCRIPT_NAME
);
assert(dailySettlementScripts.length === 0, `daily settlement helper script must not be bundled, found ${dailySettlementScripts.length}`);
assert(
  !tavernHelperScripts.some((script) => String(script?.id || "") === LEGACY_POLICE_LINE_TEST_ALT_SCRIPT_ID || /警视厅线测试开场白变量初始化/.test(String(script?.name || ""))),
  "legacy police-line helper must not be bundled"
);
for (const retiredOpeningScriptId of [DEBUG_TEST_ALT_SCRIPT_ID, POLICE_LINE_TEST_ALT_SCRIPT_ID, POLICE_LINE_BAIL_TEST_ALT_SCRIPT_ID]) {
  assert(!tavernHelperScripts.some((script) => String(script?.id || "") === retiredOpeningScriptId), `retired alternate-opening helper must be absent: ${retiredOpeningScriptId}`);
}
for (const script of tavernHelperScripts) {
  const id = String(script?.id || "");
  const name = String(script?.name || "");
  const text = scriptText(script);
  assertNoBannedText(`tavern_helper script ${name || id || "unknown"}`, text);
  assertNoLegacyRoleVariablePaths(`tavern_helper script ${name || id || "unknown"}`, text);
}

const desktopInlineFrontend = await readText("public/frontends/hypnosis-app/st-load-inline.html");
const phoneInlineFrontend = await readText("public/frontends/hypnosis-app-phone/st-load-inline.html");
const floatingPhoneBootstrap = await readText("public/frontends/hypnosis-app/floating-bootstrap.js");
for (const needle of [
  "function hasApi(name)",
  "function hasMvu(name)",
  "if(r.hasApi('updateVariablesWith'))",
  "typeof sourceMvu.getMvuData==='function'",
  "typeof sourceMvu.replaceMvuData==='function'",
  "typeof sourceMvu.setMvuVariable==='function'",
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating bridge must expose only real host capabilities: ${needle}`);
}
assertInlineScriptsParse("desktop frontend", desktopInlineFrontend);
assertInlineScriptsParse("phone frontend", phoneInlineFrontend);
new Function(floatingPhoneBootstrap);
for (const needle of [
  "const option = getCurrentVariableOption();",
  'const mvu = window.Mvu?.getMvuData?.(option);',
  'if (mvu && typeof mvu.then !== "function" && usable(root)) return root;',
  'const vars = typeof getVariables === "function" ? getVariables(option) : null;',
  'if (vars && typeof vars.then !== "function" && usable(root)) return root;'
]) {
  assert(desktopInlineFrontend.includes(needle), `frontend historical snapshot reader missing strict selected-floor behavior: ${needle}`);
}
assert(
  desktopInlineFrontend.includes('packageId.startsWith("single-role:" + ENCOUNTER_ORJENRN_PACKAGE_ID + ":")'),
  "orjenrn standalone roles must retain their polished-source side for filtering and purchase/use availability"
);
for (const needle of [
  'title: "关闭世界书管理"',
  'confirmText: "确认关闭"',
  'cancelText: "保留开启"'
]) {
  assert(desktopInlineFrontend.includes(needle), `encounter management must use the themed frontend confirmation dialog: ${needle}`);
}
assert(
  !desktopInlineFrontend.includes('window.confirm("关闭管理会把'),
  "encounter management must not fall back to the browser-native confirmation dialog"
);
const starlightExchangeSource = desktopInlineFrontend.match(/async function encounterShopExchangeStarlight\([\s\S]*?\n\s*}\n\s*\n\s*async function encounterShopBuyRuleCoupon/)?.[0] || "";
const encounterShopRenderSource = desktopInlineFrontend.match(/function renderEncounterShop\([\s\S]*?\n\s*}\n\s*\n\s*function renderEncounter/)?.[0] || "";
assert(starlightExchangeSource.includes("Number.isSafeInteger(count)") && starlightExchangeSource.includes("Number.isSafeInteger(costMoney)"), "starlight exchange must reject invalid or unsafe quantities");
assert(starlightExchangeSource.includes("encounterRestoreBaselineMvuData(data)") && starlightExchangeSource.includes("if (!staged)"), "starlight exchange must roll back verified MVU state when staging fails");
const starlightQuantityInput = encounterShopRenderSource.match(/<input[^>]*data-encounter-shop-starlight-qty[^>]*>/)?.[0] || "";
assert(starlightQuantityInput && !/\bmax=/.test(starlightQuantityInput), "starlight voucher input must not expose an artificial maximum");
for (const needle of [
  "function updateEncounterDetailSection(page, section)",
  '["detail-section", "detail-role-page", "select-role"].includes(action)',
  "event.stopImmediatePropagation()",
  '{ name: "西园寺美织", packageId: "orjenrn-role-pack" }',
  "只填写需要覆盖默认值的项目",
  "事件记录、至关重要记忆、绰号认可、高潮次数"
]) {
  assert(desktopInlineFrontend.includes(needle), `encounter detail/custom-role regression guard missing: ${needle}`);
}
const encounterInitialMainSpecs = desktopInlineFrontend.match(/const ENCOUNTER_INITIAL_MAIN_FIELD_SPECS = \[([\s\S]*?)\n\s*\];/)?.[1] || "";
const encounterInitialBodySpecs = desktopInlineFrontend.match(/const ENCOUNTER_INITIAL_BODY_FIELD_SPECS = \[([\s\S]*?)\n\s*\];/)?.[1] || "";
const profilePickerImplementation = desktopInlineFrontend.match(/function profilePickerHtml\([\s\S]*?\n\s*\}\n\s*\n\s*function profileStorageScope/)?.[0] || "";
assert(profilePickerImplementation, "person-profile picker implementation must exist");
assert(!profilePickerImplementation.includes("staticView"), "person-profile picker must not retain the removed Isaac static-view variable");
assert(!profilePickerImplementation.includes("profilePossessionButtonHtml"), "person-profile picker must not expose possession controls before entering a concrete dossier");
const profileDeskCardImplementation = desktopInlineFrontend.match(/function profileDeskCardHtml\([\s\S]*?\n\s*\}\n\s*\n\s*function renderPersonProfileDeskPage/)?.[0] || "";
assert(profileDeskCardImplementation && !profileDeskCardImplementation.includes("profilePossessionButtonHtml"), "person-profile desk cards must not expose possession controls");
for (const needle of [
  'name: \'女性档案\'',
  'name: \'男性档案\'',
  "window.__ST_OPEN_FEMALE_PROFILE_APP__",
  "window.__ST_OPEN_MALE_PROFILE_APP__",
  'page.dataset.profileGender = effectiveGender',
  'return orderedProfileRoleNames(roles, profileGenderFilterForPage(page))'
]) {
  assert(desktopInlineFrontend.includes(needle), `female/male profile applications must remain independent: ${needle}`);
}
assert(!desktopInlineFrontend.includes("{ id: 'profile', name: '人物档案'"), "legacy single profile home app must not return");
for (const needle of [
  'profiles/kuki-mashiro-odor-fan-dance.png',
  'profiles/kuki-mashiro-prank-glasses.png',
  'version: 3',
  'if (source && !merged[index]) merged[index] = source'
]) {
  assert(desktopInlineFrontend.includes(needle), `Kuki Mashiro four-slot photo set/migration missing: ${needle}`);
}
for (const needle of ["profileFavoriteStampHtml()", "isFavoriteRoleName(roleName)", 'navSet === "confidential"', "人物档案 · ", "is-switch"]) {
  assert(profileDeskCardImplementation.includes(needle), `person-profile desk cards must mirror favorite and remembered normal/deep UI state: ${needle}`);
}
assert(!profileDeskCardImplementation.includes("<i>☆</i>"), "person-profile desk cards must not retain the static legacy star");
assert(
  desktopInlineFrontend.includes("'<span>' + escapeHtml(field.label) + '</span>' +\n        '<strong>' + valueHtml + '</strong>' +\n        editButton"),
  "person-profile name row must place the displayed name before the nickname pencil"
);
for (const [label, frontend] of [["desktop", desktopInlineFrontend], ["phone", phoneInlineFrontend]]) {
  for (const needle of [
    "refreshCurrentProfileItemsWithConnector",
    "replaceCurrentProfileRefreshItemsMap",
    "刷新当前角色",
    'data-profile-item-action="use"',
    "data-profile-item-use-note",
    '操作: operation',
    'AI执行规范: "前端只提交请求，不代表成功。'
  ]) {
    assert(frontend.includes(needle), `${label} frontend role-item workflow missing: ${needle}`);
  }
  assert(!frontend.includes('data-profile-item-action="discard"'), `${label} frontend must replace the direct discard action with use`);
  const refreshBranchStart = frontend.indexOf('if (kind === "refresh")');
  const refreshBranchEnd = frontend.indexOf("const groupName =", refreshBranchStart);
  const refreshBranch = refreshBranchStart >= 0 && refreshBranchEnd > refreshBranchStart
    ? frontend.slice(refreshBranchStart, refreshBranchEnd)
    : "";
  assert(refreshBranch.includes("refreshCurrentProfileItemsWithConnector"), `${label} frontend refresh branch must call the independent text connector`);
  assert(!refreshBranch.includes("appendAppOperation"), `${label} frontend refresh branch must not stage a story-model operation`);
}
for (const needle of ["__ST_HYPNOOS_UPDATE_PROFILE_POSSESSION__", "__ST_HYPNOOS_PROFILE_POSSESSION__", "possessionAvailable ? {", "profilePossessionAvailable(selectedName"]) {
  assert(desktopInlineFrontend.includes(needle), `person-profile detail-only possession bridge missing: ${needle}`);
}
for (const needle of ["encounterUpdateExternalPossessionDecor", "__ST_HYPNOOS_UPDATE_ENCOUNTER_POSSESSION_DECOR__", "ST_GHOST_REQUIRED_ROLES.includes(roleName)", "encounterHideExternalPossessionDecor", "normalized !== \"encounter\"", "window.parent?.__ST_HYPNOOS_FLOATING_SINGLETON__?.updateEncounterPossessionDecor?.(null)"]) {
  assert(desktopInlineFrontend.includes(needle), `Encounter special-role possession decoration bridge missing: ${needle}`);
}
for (const needle of ["encounterPurchaseOperationKind", 'action === "角色包已购买"', '!== "used"', '=== "unlock"']) {
  assert(desktopInlineFrontend.includes(needle), `Encounter purchased/used state classifier missing: ${needle}`);
}
const profileDeskOpenImplementation = desktopInlineFrontend.match(/function openPersonProfileDeskRole\([\s\S]*?\n\s*\}\n\s*\n\s*function handlePersonProfilePrimaryClick/)?.[0] || "";
assert(profileDeskOpenImplementation.includes("return withLatestStatDataReadScope"), "person-profile desk click must keep role lookup, state write and detail render in one selected-floor snapshot scope");
assert(profileDeskOpenImplementation.includes("renderPersonProfilePageFromSnapshot(page)"), "person-profile desk click must not refetch the selected-floor snapshot before rendering detail");
const policeAttentionPackageImplementation = desktopInlineFrontend.match(/function policeAttentionPackage\(\)[\s\S]*?\n\s*\}\n\s*\n\s*function hospitalLinePackage/)?.[0] || "";
for (const needle of ["updateEntry.constant = true", "updateEntry.selective = false", "updateEntry.key = []", "updateEntry.keys = []"]) {
  assert(policeAttentionPackageImplementation.includes(needle), `police settlement dynamic worldbook must be a keyword-free blue entry: ${needle}`);
}
const ghostLinePackageImplementation = desktopInlineFrontend.match(/function ghostLinePackage\(\)[\s\S]*?\n\s*\}\n\s*\n\s*function encounterEntryText/)?.[0] || "";
for (const needle of ["possessionConfirm.constant = true", "possessionConfirm.selective = false", "possessionConfirm.key = []", "possessionConfirm.keys = []"]) {
  assert(ghostLinePackageImplementation.includes(needle), `ghost possession dynamic worldbook must be a keyword-free blue entry: ${needle}`);
}
for (const needle of [
  '"[mvu_update]警视厅监视结算规则"',
  '"[mvu_plot]灵异线深雪附身确认"',
  'target.strategy.type = "constant"',
  "target.constant = true",
  "target.selective = false"
]) {
  assert(desktopInlineFrontend.includes(needle), `managed dynamic worldbook activation migration missing: ${needle}`);
}
for (const hiddenDefaultPath of ["事件.至关重要记忆", "信息.绰号已认可"]) {
  assert(!encounterInitialMainSpecs.includes(hiddenDefaultPath), `custom-role form must not expose pure default field: ${hiddenDefaultPath}`);
}
assert(!encounterInitialBodySpecs.includes("高潮次数"), "custom-role form must not expose default-zero climax counters");
const orjenrnPackage = JSON.parse(await readText("public/frontends/hypnosis-app/assets/encounter/orjenrn/package.json"));
assert(
  JSON.stringify(orjenrnPackage?.roles?.slice(0, 3).map((role) => role?.name)) === JSON.stringify(["西园寺美织", "桐生刹那", "白石响"]),
  "orjenrn featured roles must be ordered as 西园寺美织 / 桐生刹那 / 白石响"
);
const encounterPackageRoot = "public/frontends/hypnosis-app/assets/encounter";
const encounterPackageDirs = (await readdir(encounterPackageRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
let encounterPackageRoleCount = 0;
for (const directory of encounterPackageDirs) {
  const packagePath = `${encounterPackageRoot}/${directory.name}/package.json`;
  let packageData;
  try { packageData = JSON.parse(await readText(packagePath)); } catch { continue; }
  for (const role of Array.isArray(packageData?.roles) ? packageData.roles : []) {
    encounterPackageRoleCount += 1;
    const initial = typeof role?.initialVariables === "string"
      ? JSON.parse(role.initialVariables || "{}")
      : (role?.initialVariables && typeof role.initialVariables === "object" ? role.initialVariables : {});
    assert(!Object.hasOwn(initial?.状态 || {}, "是否派遣中"), `encounter role contains retired dispatch state: ${directory.name}/${role?.name || "unnamed"}`);
    for (const holder of [initial, initial?.信息 || {}]) {
      for (const key of ["工作价值", "身价", "派遣身价", "日收益"]) {
        assert(!Object.hasOwn(holder || {}, key), `encounter role contains retired work-value field ${key}: ${directory.name}/${role?.name || "unnamed"}`);
      }
    }
  }
}
assert(encounterPackageRoleCount === 87, `encounter package role count drifted: ${encounterPackageRoleCount}`);
const generatedOrjenrnPortraitRoles = new Set(["白鸟结衣", "德川喜广", "凤条瑠衣", "九条凛音", "尼子纯", "浅仓步美", "鹰司千代"]);
const reviewedOrjenrnAges = new Map([
  ["白鸟结衣", "24"],
  ["德川喜广", "28"],
  ["凤条瑠衣", "26"],
  ["九条凛音", "41"],
  ["奈幽", "17"],
  ["尼子纯", "24"],
  ["浅仓步美", "16"],
  ["缇娅", "0"],
  ["鹰司千代", "68"]
]);
const orjenrnInitialPlaceholderRe = /^(?:未定义|undefined|未知|未记录|无记录|待补充|待ai补充|暂无)$/iu;
const orjenrnRoleRootKeys = ["衣着", "信息", "状态", "事件", "敏感", "效果", "劣迹", "改造", "物品", "子嗣"].sort();
const orjenrnNormalizedNames = new Set();
for (const role of orjenrnPackage?.roles || []) {
  const roleName = String(role?.name || "").trim();
  const normalizedRoleName = roleName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
  assert(normalizedRoleName && !orjenrnNormalizedNames.has(normalizedRoleName), `orjenrn encounter role name must be unique after normalization: ${roleName || "(unnamed)"}`);
  orjenrnNormalizedNames.add(normalizedRoleName);
  assert(role?.initialVariables && typeof role.initialVariables === "object" && !Array.isArray(role.initialVariables), `orjenrn encounter role must include initial variables: ${roleName}`);
  assert(
    JSON.stringify(Object.keys(role.initialVariables || {}).sort()) === JSON.stringify(orjenrnRoleRootKeys),
    `orjenrn encounter role initial variables must contain exactly ten pages: ${roleName}`
  );
  const roleGender = String(role?.gender || role?.initialVariables?.信息?.性别 || "").trim() === "男" ? "男" : "女";
  const roleSensitive = role?.initialVariables?.敏感 || {};
  if (roleGender === "男") {
    assert(Object.hasOwn(roleSensitive, "阴茎敏感度") && !Object.hasOwn(roleSensitive, "阴蒂敏感度"), `orjenrn male initial variables must use male-sensitive fields: ${roleName}`);
  } else {
    assert(Object.hasOwn(roleSensitive, "阴蒂敏感度") && !Object.hasOwn(roleSensitive, "阴茎敏感度"), `orjenrn female initial variables must use female-sensitive fields: ${roleName}`);
  }
  const roleFixture = structuredClone(initData);
  roleFixture.角色 = { [roleName]: structuredClone(role.initialVariables) };
  const roleSchemaResult = currentMvuSchema.safeParse(roleFixture);
  assert(roleSchemaResult.success, `orjenrn role initial variables must satisfy the current MVU Schema: ${roleName} ${JSON.stringify(roleSchemaResult.error?.issues || [])}`);
  const roleMeasurementKey = roleGender === "男" ? "阴茎长度" : "三围";
  for (const [page, key] of [
    ["衣着", "头发"],
    ["衣着", "面部"],
    ["衣着", "上衣"],
    ["衣着", "下衣"],
    ["信息", "社团或职业"],
    ["信息", "身高"],
    ["信息", "体重"],
    ["信息", roleMeasurementKey],
    ["效果", "心理"]
  ]) {
    const value = String(role.initialVariables?.[page]?.[key] ?? "").trim();
    assert(value && !orjenrnInitialPlaceholderRe.test(value), `orjenrn initial variable must be substantive: ${roleName}/${page}/${key}`);
  }
  if (reviewedOrjenrnAges.has(roleName)) {
    assert(
      String(role.initialVariables?.信息?._年龄 ?? "") === reviewedOrjenrnAges.get(roleName),
      `orjenrn reviewed role age must match persona evidence: ${roleName}`
    );
  }
  const image = String(role?.image || "").trim();
  assert(image, `orjenrn encounter role must have a portrait: ${roleName || "(unnamed)"}`);
  const portraitPath = image.startsWith("encounter/")
    ? `public/frontends/hypnosis-app/assets/${image}`
    : `public/frontends/hypnosis-app/assets/encounter/orjenrn/${image}`;
  let portrait = null;
  try {
    portrait = await readFile(portraitPath);
  } catch (_) {}
  assert(portrait?.length > 24, `orjenrn encounter portrait file missing: ${roleName || "(unnamed)"} -> ${portraitPath}`);
  if (!generatedOrjenrnPortraitRoles.has(roleName)) continue;
  assert(
    portrait.subarray(1, 4).toString("ascii") === "PNG"
      && portrait.readUInt32BE(16) === 1086
      && portrait.readUInt32BE(20) === 1448,
    `generated orjenrn portrait must match the 1086x1448 九条樱 dossier format: ${roleName || "(unnamed)"}`
  );
}
{
  const expectedP5rNames = ["高卷杏", "新岛真", "佐仓双叶", "奥村春", "芳泽霞", "新岛冴", "川上贞代", "武见妙", "东乡一二三", "御船千早", "大宅一子"];
  assert(frontendSource.includes('"public/frontends/hypnosis-app/assets/encounter/xiao-qiao-p5r/package.json"'), "P5R encounter package must be registered as a built-in source");
  assert(p5rEncounterPackage?.id === "p5r-female-role-package", "P5R encounter package must retain its stable id");
  assert(p5rEncounterPackage?.name === "小乔的p5r角色包", "P5R encounter package must use the requested display name");
  assert(p5rEncounterPackage?.author === "@小乔", "P5R encounter package must retain source attribution");
  assert(String(p5rEncounterPackage?.intro || "").includes("作者：@小乔"), "P5R encounter package runtime intro must expose source attribution");
  assert(
    JSON.stringify((p5rEncounterPackage?.roles || []).map((role) => role?.name)) === JSON.stringify(expectedP5rNames),
    "P5R encounter package must contain the reviewed 11 roles in source order"
  );
  const existingPackagePaths = [
    "public/frontends/hypnosis-app/assets/encounter/orjenrn/package.json",
    "public/frontends/hypnosis-app/assets/encounter/akashi-maho/package.json",
    "public/frontends/hypnosis-app/assets/encounter/wangfeng/package.json",
    "public/frontends/hypnosis-app/assets/encounter/baikai/package.json",
    "public/frontends/hypnosis-app/assets/encounter/sdz-aser/package.json"
  ];
  const existingNames = new Set((await Promise.all(existingPackagePaths.map(async (packagePath) =>
    (JSON.parse(await readText(packagePath))?.roles || []).map((role) => String(role?.name || "").trim())
  ))).flat().filter(Boolean));
  const normalizedNames = new Set();
  for (const role of p5rEncounterPackage.roles || []) {
    const roleName = String(role?.name || "").trim();
    const normalizedName = roleName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
    assert(normalizedName && !normalizedNames.has(normalizedName), `P5R encounter role name must be unique: ${roleName || "(unnamed)"}`);
    normalizedNames.add(normalizedName);
    assert(!existingNames.has(roleName), `P5R encounter role must not duplicate an existing built-in role: ${roleName}`);
    const initialVariables = typeof role?.initialVariables === "string" ? JSON.parse(role.initialVariables) : role?.initialVariables;
    assert(
      JSON.stringify(Object.keys(initialVariables || {}).sort()) === JSON.stringify(orjenrnRoleRootKeys),
      `P5R encounter role initial variables must contain exactly ten pages: ${roleName}`
    );
    const fixture = structuredClone(initData);
    fixture.角色 = { [roleName]: structuredClone(initialVariables) };
    const schemaResult = currentMvuSchema.safeParse(fixture);
    assert(schemaResult.success, `P5R encounter role initial variables must satisfy the current MVU Schema: ${roleName} ${JSON.stringify(schemaResult.error?.issues || [])}`);
    assert(
      String(role?.personaEntry?.content || "").trim()
      && String(role?.personaEntry?.content || "") === String(role?.personaContent || ""),
      `P5R encounter role must preserve its reviewed persona source: ${roleName}`
    );
    const image = String(role?.image || "").trim();
    assert(image, `P5R encounter role must have a portrait: ${roleName}`);
    const portraitPath = `public/frontends/hypnosis-app/assets/encounter/xiao-qiao-p5r/${image}`;
    const portrait = await readFile(portraitPath);
    const isPng = portrait?.length > 24 && portrait.subarray(1, 4).toString("ascii") === "PNG";
    const isJpeg = portrait?.length > 4 && portrait[0] === 0xff && portrait[1] === 0xd8 && portrait[2] === 0xff;
    assert(isPng || isJpeg, `P5R encounter portrait must match its readable image bytes: ${roleName}`);
    assert((image.endsWith(".jpg") && isJpeg) || (image.endsWith(".png") && isPng), `P5R encounter portrait extension must match its image bytes: ${roleName}`);
  }
  const shujin = (p5rEncounterPackage.specialLocationEntries || []).find((entry) => entry?.id === "shujin-academy");
  assert(shujin?.displayName === "秀尽学园" && shujin?.mapLayer === "city", "P5R package must provide 秀尽学园 as a city special location");
  assert(shujin?.category === "学校" && shujin?.iconNodeId === "shujin-academy", "秀尽学园 must retain its school map metadata");
  assert(shujin?.canonicalComment === "[mvu_plot]秀尽学园", "秀尽学园 must retain a stable worldbook comment");
  assert(JSON.stringify(shujin?.entry?.key || []) === JSON.stringify(shujin?.entry?.keys || []), "秀尽学园 worldbook key/keys must stay synchronized");
  assert(JSON.stringify(shujin?.entry?.keysecondary || []) === JSON.stringify(shujin?.entry?.secondary_keys || []), "秀尽学园 worldbook secondary keys must stay synchronized");
}
{
  const wallpaperPath = "public/frontends/hypnosis-app/assets/wallpapers/inuzuka-natsumi-prank-v1.png";
  let wallpaper = null;
  try {
    wallpaper = await readFile(wallpaperPath);
  } catch (_) {}
  assert(wallpaper?.length > 24, `fourth default wallpaper asset missing: ${wallpaperPath}`);
  assert(
    wallpaper.subarray(1, 4).toString("ascii") === "PNG"
      && wallpaper.readUInt32BE(16) === 941
      && wallpaper.readUInt32BE(20) === 1672,
    "fourth default wallpaper must keep the generated 941x1672 portrait PNG"
  );
}
for (const needle of [
  "__ST_HYPNOOS_FLOATING_SINGLETON__", "hypnoos-operation-placeholder", "跟随视口", "历史楼层 · 只读",
  "normalizeMessageOption", "guardedMvu", 'config.mode === "host"', "HYPNOOS_FLOATING_REGISTRY_READY",
  "酒馆助手正在启动悬浮手机与暂存队列", "stageAttached", "start: function"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone bootstrap missing: ${needle}`);
}
for (const needle of ["toggleShell(!shellOpen)", "data-surface-drag='phone'", "data-surface-drag='timetable'", "beginSurfaceDrag", "beginLauncherDrag", "launcherX", "floor-drawer", "class='sidecar'", ".sidecar{", "left:calc(100% + 14px)", "pointer-events:none", "white-space:nowrap", "word-break:keep-all"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone bootstrap missing shell behavior: ${needle}`);
}
for (const needle of [
  "pet-sprite",
  "PET_CHARACTER_ORDER",
  '"alisa", "hyakka"',
  "petAssetName",
  'return "v5/" + role + "/" + role + "-" + group + "-v5.png"',
  "MAX_DECODED_PET_SHEETS = 8",
  "MAX_PET_LOADS_IN_FLIGHT = 2",
  "pet-menu",
  "data-pet-action='switch'",
  "pet-character-toggle",
  "人物 · ",
  "updatePetCharacterButton",
  "petCharacterId",
  "held_scared",
  "unique_a",
  "unique_b",
  'group: "drag", total: 8',
  "PET_BASE_FACING = 1",
  "PET_RENDER_SIZE = 96",
  "PET_DRAG_GRIP_Y = 5",
  "PET_DRAG_SPEED_GAIN = 0.022",
  "PET_DRAG_MAX_ANGULAR_SPEED = 26",
  "PET_DRAG_SAMPLE_GRACE_MS = 45",
  "PET_DRAG_STALE_DECAY = 18",
  "driveOmega",
  "function petDragSpinStep(",
  "function animateLauncherDragPhysics(",
  'setPetState("held_scared", { static: true })',
  '--pet-drag-angle',
  'playPetShellAction("unique_a", true)',
  'playPetShellAction("unique_b", false)',
  "gripClientX - launcherDragState.gripX",
  "gripClientY - launcherDragState.gripY",
  "if (launcher && !launcherDragState) applySavedLauncherPosition()",
  "if (launcher.hasPointerCapture && launcher.hasPointerCapture(cancelled.pointerId)) launcher.releasePointerCapture(cancelled.pointerId)",
  "function startPetLoadTask(task)",
  "clearPetMotionFrame",
  'Math.min(16, Math.max(1, meta.fps))',
  "visibilitychange",
  "prefers-reduced-motion: reduce",
  "clearPetFrameTimer",
  "clearPetActivityTimer"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone desktop-pet behavior missing: ${needle}`);
}
for (const retiredPetPhysics of ["petPendulumStep", "PET_DRAG_COM_LENGTH", "accelerationX", "accelerationY", "0.0022"]) {
  assert(!floatingPhoneBootstrap.includes(retiredPetPhysics), `floating phone retains conflicting drag physics: ${retiredPetPhysics}`);
}
const petDragSpinSource = floatingPhoneBootstrap.match(/function petDragSpinStep\([\s\S]*?\n\s*}\n\n\s*function animateLauncherDragPhysics/)?.[0]
  ?.replace(/\n\n\s*function animateLauncherDragPhysics[\s\S]*$/, "") || "";
assert(petDragSpinSource, "floating phone pet drag spin function could not be extracted");
const petDragSpinStepFixture = new Function(
  "PET_DRAG_SAMPLE_GRACE_MS",
  "PET_DRAG_STALE_DECAY",
  "PET_DRAG_MAX_ANGULAR_SPEED",
  "PET_DRAG_SPEED_GAIN",
  "PET_DRAG_GRAVITY_RESPONSE",
  "PET_DRAG_RESPONSE",
  "PET_DRAG_IDLE_DAMPING",
  `return (${petDragSpinSource});`
)(45, 18, 26, 0.022, 4.2, 14, 5.5);
const petSpinAtSpeed = (velocityX, steps = 18, sampleAgeMs = 0) => {
  let state = { angle: 0, angularVelocity: 0 };
  for (let index = 0; index < steps; index += 1) {
    state = petDragSpinStepFixture(state.angle, state.angularVelocity, velocityX, sampleAgeMs, 1 / 60);
  }
  return state;
};
const petSpinRightSlow = petSpinAtSpeed(240);
const petSpinRightFast = petSpinAtSpeed(900);
const petSpinRightFlick = petSpinAtSpeed(1800);
const petSpinLeftFast = petSpinAtSpeed(-900);
assert(petSpinRightSlow.angularVelocity < 0 && petSpinLeftFast.angularVelocity > 0, "pet drag spin direction must reverse with horizontal drag direction");
assert(Math.abs(petSpinRightSlow.angularVelocity) < Math.abs(petSpinRightFast.angularVelocity) && Math.abs(petSpinRightFast.angularVelocity) < Math.abs(petSpinRightFlick.angularVelocity), "pet drag spin must grow monotonically with drag speed");
assert(Math.abs(petSpinRightFlick.angularVelocity) <= 26 && Number.isFinite(petSpinRightFlick.angle), "pet drag spin must remain finite and respect its angular-speed cap");
assert(Math.abs(petSpinAtSpeed(900, 18, 500).angularVelocity) < Math.abs(petSpinRightFast.angularVelocity), "pet drag spin must decay after pointer samples go stale");
assert(
  !floatingPhoneBootstrap.includes('Math.random() < 0.5 ? "unique_a" : "unique_b"'),
  "desktop pet unique actions must be bound to phone open/close instead of random playback"
);
assert(/function writeTargetsWritable[\s\S]*?if \(!ids\.length\) return false;/.test(floatingPhoneBootstrap), "floating host must reject every mutation without an explicit writable message id");
const petSwitchImplementation = floatingPhoneBootstrap.match(/function switchPetCharacter\(\)[\s\S]*?\n\s*\}\n\s*\n\s*function clearPetMenuLongPress/)?.[0] || "";
assert(petSwitchImplementation.includes('loadPetAsset(next, "idle")'), "desktop pet switch must preload the selected character idle sheet");
assert(petSwitchImplementation.includes('loadPetAsset(next, "enter")'), "desktop pet switch must preload the selected character entry sheet");
assert(petSwitchImplementation.includes("completePetSwitch();"), "desktop pet sidecar switch must apply the selected character directly");
assert(!petSwitchImplementation.includes('loadPetAsset(petCharacterId, "exit")'), "desktop pet sidecar switch must not wait for the previous character exit sheet");
assert(!petSwitchImplementation.includes('setPetState("exit")'), "desktop pet sidecar switch must not gate selection on the previous exit animation");
for (const needle of [
  "image-rendering:pixelated",
  "image-rendering:crisp-edges",
  "scaleX(var(--pet-direction",
  "Math.cos(petSpinAngle) < 0",
  "function petMoveForFrame",
  '"miyuki", "natsumi", "mashiro"',
  "data-pet-action='flick'",
  "data-pet-action='stroke'",
  "flick_react",
  "stroke_react",
  "release_sweat"
]) {
  assert(!floatingPhoneBootstrap.includes(needle), `floating phone desktop-pet legacy artifact remains: ${needle}`);
}
for (const needle of [
  "function syncPanelSize()",
  'var baseWidth = timetableFocus === "phone" ? 650 : timetableFocus === "timetable" ? 850 : 1240',
  'var visibleLeft = timetableFocus === "phone" ? 520 : timetableFocus === "timetable" ? -24 : 0',
  "var baseHeight = 812",
  "widthAllowance / baseWidth",
  "heightAllowance / baseHeight",
  "syncPanelSize();"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone bootstrap must preserve its width/height ratio on narrow viewports: ${needle}`);
}
for (const needle of ["dual-stage", "cuboid", "timetable-surface", "phone-surface", "data-surface-switch='phone'", "data-surface-switch='timetable'", "timetableSetFocus", "週間時間割", "USER 日程", "data-schedule-card", "data-schedule-pending", "data-standalone-note", "__ST_HYPNOOS_TIMETABLE_MOVE_CARD__", "__ST_HYPNOOS_TIMETABLE_ADD_NOTE__", "推进到最后有内容格", "--stage-offset-x", "--phone-face-width", "--phone-drag-x", "--timetable-drag-x", "rotateY(90deg)", ".panel.focus-timetable .cuboid", ".panel.focus-phone .cuboid", 'phoneContent.inert = timetableFocus === "timetable"', 'timetableContent.inert = timetableFocus === "phone"']) {
  assert(floatingPhoneBootstrap.includes(needle), `floating dual-surface timetable is missing: ${needle}`);
}
assert((floatingPhoneBootstrap.match(/data-surface-switch='phone'/g) || []).length === 2, "timetable face must keep a phone switch on both sides");
assert((floatingPhoneBootstrap.match(/data-surface-switch='timetable'/g) || []).length === 2, "phone face must keep a timetable switch on both sides");
assert(!floatingPhoneBootstrap.includes(".panel.focus-phone .timetable-surface,.panel.focus-timetable .phone-surface") && !floatingPhoneBootstrap.includes("phoneSurface.inert = hidePhone") && !floatingPhoneBootstrap.includes("timetableSurface.inert = hideTimetable"), "adjacent cuboid faces must remain visible while only their content becomes inert");
assert(!floatingPhoneBootstrap.includes("surface-cover") && !floatingPhoneBootstrap.includes("data-focus-surface"), "transparent surface covers must not intercept phone iframe clicks");
assert(floatingPhoneBootstrap.includes(".phone{display:block") && floatingPhoneBootstrap.includes("pointer-events:auto"), "visible phone iframe must remain directly clickable");
assert(!desktopInlineFrontend.includes("ROLE_SENSITIVITY_FIELDS") && !phoneInlineFrontend.includes("ROLE_SENSITIVITY_FIELDS"), "phone frontend must not reference the retired sensitivity-field alias during boot");
assert(desktopInlineFrontend.includes("function hasPendingStoryLocationOperation()") && phoneInlineFrontend.includes("function hasPendingStoryLocationOperation()"), "map apps must retain their pending-location operation guard");
assert(
  floatingPhoneBootstrap.indexOf("class='galgame-toggle'") < floatingPhoneBootstrap.indexOf("class='resource-panel")
  && floatingPhoneBootstrap.indexOf("class='resource-panel") < floatingPhoneBootstrap.indexOf("class='variable-format-toggle'")
  && floatingPhoneBootstrap.indexOf("class='variable-format-toggle'") < floatingPhoneBootstrap.indexOf("class='readonly'")
  && floatingPhoneBootstrap.indexOf("class='readonly'") < floatingPhoneBootstrap.indexOf("class='pet-character-toggle'")
  && floatingPhoneBootstrap.indexOf("class='pet-character-toggle'") < floatingPhoneBootstrap.indexOf("class='floor-toggle'")
  && floatingPhoneBootstrap.indexOf("class='floor-toggle'") < floatingPhoneBootstrap.indexOf("class='floor-drawer'"),
  "sidecar must keep Galgame, resources, variable checker, read-only warning, character button, floor button and drawer in order"
);
for (const needle of [
  "resource-panel", "data-resource-money", "data-resource-starlight", "data-resource-energy",
  'system["持有零花钱"]', 'system["星光点"]', 'system["MC能量"]',
  "VARIABLE_INITIALIZED", "VARIABLE_UPDATE_ENDED", "return result.slice(-4)",
  "variable-format-toggle", "变量格式检查", "pet-character-toggle", "人物 · 爱丽莎", "__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__",
  "__ST_HYPNOOS_CORRECT_VARIABLE_FORMAT__", "发现未知变量键", "清理并补齐"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone sidecar/history behavior missing: ${needle}`);
}
assert(
  !floatingPhoneBootstrap.includes("left:calc(100% + 76px)"),
  "Galgame control must not use the retired horizontal side-by-side offset"
);
for (const needle of [
  "galgame-toggle", "8f69fa0e-1a51-4f63-9dc0-1129ef0ab4d7", "getScriptTrees", "replaceScriptTrees",
  '{ type: "character" }', "findGalgameScript(item.scripts)", "TavernHelper", "只切换",
  "syncGalgameRuntimeEnabled", "__ST_HYPNOOS_GALGAME_INJECTION_RUNTIME__", "runtime.setEnabled",
  "galgame-dialog", "Galgame人物演出已开启", "从下一轮开始更可靠", "当前运行时未确认即时切换"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating phone bootstrap missing Galgame script toggle behavior: ${needle}`);
}
for (const forbidden of ["getTavernRegexes", "replaceTavernRegexes", "updateTavernRegexesWith", "691f9c3a-9da3-44ae-8b0d-8c64f7d3e8e1", "2d16e34c-c413-465c-939f-1282c15957a8"]) {
  assert(!floatingPhoneBootstrap.includes(forbidden), `Galgame side switch must not manage regex state: ${forbidden}`);
}
for (const legacyShellNeedle of ["class='bar'", "class='close'"]) {
  assert(!floatingPhoneBootstrap.includes(legacyShellNeedle), `floating phone bootstrap still contains legacy outer shell: ${legacyShellNeedle}`);
}
for (const needle of ["tone-hypnosis", "tone-reward", "tone-location", "is-locked", "查看完整内容", "item-detail"]) {
  assert(floatingPhoneBootstrap.includes(needle), `staging placeholder missing typed operation-card UI: ${needle}`);
}
for (const needle of [
  "HYPNOOS_ACTION_FOLD_V3", "ensureActionFoldRenderer", "scheduleActionFoldRender",
  "createActionFoldCard", "data-hypnoos-action-fold", "renderActionFoldMarkers"
]) {
  assert(floatingPhoneBootstrap.includes(needle), `stable host missing real-time action-fold renderer: ${needle}`);
}
for (const [label, frontend] of [["desktop", desktopInlineFrontend], ["phone", phoneInlineFrontend]]) {
  assert((frontend.match(/iconStyle:/g) || []).length >= 14, `${label} frontend is missing stable home icon styles`);
  assert(frontend.includes("style: app.iconStyle"), `${label} frontend does not apply stable home icon styles`);
  for (const needle of ["__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__", "requireWritablePhoneFloor", "encounterSetWorldbookCommentsEnabledWithTavernHelper", "updateWorldbookWith(worldName"]) {
    assert(frontend.includes(needle), `${label} frontend missing writable-floor/worldbook guard: ${needle}`);
  }
	  for (const needle of ["operationEntryVisual", "operationVariableOwnership", "buildOperationOwnershipLines", "explicitSummary", "renderProfileChildRoleManualForm", "profileChildRoleManualPayload", "<变量权限>", "已结算 · 前端", "待结算 · AI", "前端预写 · AI补全", "仅剧情提示", "结果锁", "事务锁", "st-operation-item-detail", "st-operation-item-state", "tone-hypnosis", "查看完整内容"]) {
	    assert(frontend.includes(needle), `${label} frontend missing typed staging UI: ${needle}`);
	  }
	  for (const needle of [
	    "OPERATION_HYPNOSIS_PERMANENT_IDS",
	    "operationHypnosisResultContracts",
	    "hypnosisFeatureResultContract",
	    "指令判定权威",
	    "效果时效",
	    "唯一结果位置",
	    "hypnosis-open-",
	    "数字模式不预设姓名",
	    "数字模式目标规则",
	    "selectionMode ? hypnosisSelectedRoleNames(feature, draft) : []",
	    "目标选择模式",
	    "成功是原子结果",
	    "角色命令成功=同轮扣除实际MC能量",
	    "开放空间命令成功=同轮扣除实际MC能量+仅写入本指令给出的/规则/<规则ID>",
	    "OPERATION_HYPNOSIS_NARRATIVE_RANGE_IDS"
	    ,"hypnosisTemporaryEffectEndTextByMinutes"
	    ,"hypnosisPromptCommandList"
	    ,"tempHypnosisEffectEndStamp"
	    ,"条目值必须是包含效果与结束时间"
	  ]) {
	    assert(frontend.includes(needle), `${label} frontend missing deterministic hypnosis contract: ${needle}`);
	  }
	  assert(
	    !frontend.includes('addAi("/系统/MC能量", "/角色/*/效果/临时催眠效果", "/角色/*/效果/永久催眠效果")'),
	    `${label} frontend must not expose both hypnosis effect roots unconditionally`
	  );
	  assert(!frontend.includes("指定单人或多人催眠必须切换到「选择」"), `${label} frontend must allow unnamed numeric hypnosis mode`);
	  assert(frontend.includes('"功能列表"') && frontend.includes('operationPayload["催眠指令"]'), `${label} frontend must keep machine hypnosis rows internal and expose a readable command list`);
  for (const needle of [
    "ACTION_FOLD_MARKER", "repairLiteralActionFolds", "repairWrappedActionFold",
    "createActionFoldCard", "actionFoldUserSource", "data-king-game-action-fold-host-repaired",
    "ensureTemporalNarrativeDocument", "observeNarrativeFrame", "version: 11"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing outer-wrapper action-fold compatibility: ${needle}`);
  }
  assert(
    frontend.includes("历史隐藏正则已经清空可见内容时，绝不从 rawData 复活旧操作"),
    `${label} frontend must guard against reviving hidden historical action blocks`
  );
  for (const needle of [
    "profile-nav-normal-v1.png", "profile-nav-confidential-v1.png",
    "data-profile-nav-set", "toggle-tab-group", '"常规" : "深层"',
    "hypnoos:profile-ui:v2", "__ST_HYPNOOS_UPDATE_PROFILE_NEIGHBORS__",
    "profileRemodelSelectedPart", "profileRemodelSelectedDetail",
    "data-profile-remodel-overview", "改造总览",
    "profile-primary-v8", "profileRemodelDetailScrollLeft",
    ".st-state-meter.is-positive .st-state-meter-track::after",
    ".st-state-meter.is-negative .st-state-meter-track::after",
    ".st-state-meter-fill::after",
    'content:"♥  ♥  ♥',
    ".st-person-body-panel-head strong",
    ".st-profile-radar-card.is-sensitivity",
    "clip-path:polygon(0 50%,7% 12%"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing Persona-style profile/remodel behavior: ${needle}`);
  }
  for (const needle of [
    "st-person-delete-role__icon",
    'data-profile-action="delete-role"',
    'aria-label="删除角色"',
    ".st-reward-ransom",
    ".st-reward-solid",
    "rewardRansomText(row.title)",
    "escapeHtml(row.description || \"\")",
    "rewardSolidText(statusText + \" · \" + reward)",
    "rewardRansomText(primaryText)",
    'rewardRansomText("新增任务")',
    'data-reward-tab="new"',
    'rewardRansomText("每日生成")',
    'data-reward-open-new',
    '每日任务 · 独立插头',
    '独立插头生成候选 · 领取后才写入变量',
    'rewardGenerateDailyQuestCandidate',
    'dailyQuestCandidates',
    'rewardConnectorStateHtml(page)',
    'page.dataset.rewardConnectorState = "running"',
    'page.dataset.rewardConnectorState = result?.ok ? "success" : "error"',
    "taskIslandHtml()"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing icon-only delete/reward ransom typography: ${needle}`);
  }
  for (const needle of [
    "encounterPersonaNameKey",
    ".replace(/[\\s·・•‧∙･]/g, \"\")",
    "encounterFlattenPersonaAliasRoots",
    "__HYPNOOS_STORE_DAILY_QUEST_CANDIDATE__",
    "__HYPNOOS_REMOVE_DAILY_QUEST_CANDIDATE__",
    'source: "generated-daily"',
    '任务来源: item.source === "generated-daily" ? "独立插头每日任务"',
    "if (/新增任务/.test(action) && !hasExplicitOwnership) legacyPaths.forEach((path) => aiPaths.add(path))"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing persona import/task request contract: ${needle}`);
  }
  for (const needle of [
    "你是每日任务设计器，只生成一项可在当前剧情中明确判定完成与否的任务。",
    "黑色、色情、幽默三项缺一不可",
    "这是星光点兑换券任务：必须是高难度黑色色情幽默任务",
    "按当前剧情评估应当成功率低",
    "极其触犯指定目标目前最在意、最难退让的底线",
    "这是星光点任务：必须是黑色色情幽默任务",
    "【输出协议：违反任意一条即视为失败】",
    "对象必须且只能包含两个键",
    "完成条件为12至160字的单句",
    "现有任务（不得重复）",
    "只生成候选，不写变量。",
    "候选已生成",
    "function connectorJsonObjectSlices(text)",
    "function validateDailyQuestConnectorPayload(payload, targetName)",
    "deferSuccessFeedback: true",
    "maxTokensOverride: 4096",
    "returnMeta: true",
    'response?.finishReason === "length"',
    "reasoning_content:",
    "for (let attempt = 0; attempt < 2; attempt += 1)",
    "JSON格式校验通过，任务候选已加入列表。",
    "rawResponses.push",
    "function independentConnectorTextContent(data)",
    "st-connector-raw",
    "查看模型原始返回",
    "page.dataset.rewardConnectorRaw = JSON.stringify(result.rawResponses)"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing independent daily-task connector contract: ${needle}`);
  }
  for (const needle of [
    "const dailyPriority = (item)",
    'item?.source === "generated-daily"',
    "dailyPriority(a) - dailyPriority(b)",
    "星光点兑换券任务：高难度黑色色情幽默"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing daily-task priority or reward-mode copy: ${needle}`);
  }
  for (const needle of [
    "function showIndependentConnectorFeedback(kind, state, detail = \"\")",
    "st-independent-connector-toast",
    'showIndependentConnectorFeedback("text", "running"',
    'showIndependentConnectorFeedback("text", "success"',
    'showIndependentConnectorFeedback("text", "error"'
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing independent connector visible feedback: ${needle}`);
  }
  for (const forbidden of [
    "invokeIndependentImageModel",
    'showIndependentConnectorFeedback("image"',
    "文生图插头",
    "cameraGenerateBackImage",
    "cameraBackPhotoStorageKey"
  ]) {
    assert(!frontend.includes(forbidden), `${label} frontend must not retain the removed image-generation/rear-camera path: ${forbidden}`);
  }
  for (const needle of [
    "data-board-extra-delete",
    "async function deleteMapBoardAddedLocation",
    "__ST_HYPNOOS_MAP_EXTRA_DELETE__",
    "deletable: !defaultIds.has",
    "固定地点与特殊地点不能删除"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing deletable generated-location contract: ${needle}`);
  }
  {
    const start = frontend.indexOf("async function rewardGenerateDailyQuestCandidate");
    const end = frontend.indexOf("async function rewardCreateFrontendQuestsDirect", start);
    assert(start >= 0 && end > start, `${label} frontend missing independent daily-task candidate function`);
    const taskRequestFunction = frontend.slice(start, end);
    assert(taskRequestFunction.includes("invokeIndependentTextModel"), `${label} daily-task generation must use the independent text connector`);
    assert(taskRequestFunction.includes("__HYPNOOS_STORE_DAILY_QUEST_CANDIDATE__"), `${label} generated task must be stored as a frontend candidate`);
    assert(!taskRequestFunction.includes("rewardApplySystemMutation"), `${label} candidate generation must not write MVU variables`);
    assert(!taskRequestFunction.includes("appendAppOperation"), `${label} candidate generation must not enter the chat operation queue`);
    assert(!taskRequestFunction.includes("待AI命名") && !taskRequestFunction.includes("待AI生成"), `${label} candidate generation must not create placeholders`);
  }
  assert(frontend.includes('if (item.source !== "generated-daily") task["任务ID"] = item.id;'), `${label} accepted daily tasks must keep the lightweight variable shape without a duplicate task-id field`);
  {
    const start = frontend.indexOf("async function rewardAcceptStaticQuestDirect");
    const end = frontend.indexOf("function rewardDailyQuestCandidateFor", start);
    assert(start >= 0 && end > start, `${label} frontend missing direct task-accept function`);
    const acceptFunction = frontend.slice(start, end);
    assert(!acceptFunction.includes('task["每日任务日期"]'), `${label} accepted daily task must not write 每日任务日期 into MVU`);
    assert(!acceptFunction.includes('task["任务目标"]'), `${label} accepted daily task must not write 任务目标 into MVU`);
  }
  assert(!frontend.includes('content:"删除档案"'), `${label} frontend must not render delete-button text`);
  assert(!frontend.includes("decorateRewardRansomTypography"), `${label} reward typography must not depend on post-render DOM rewriting`);
  assert(!frontend.includes('aria-label="删除角色" title="删除角色"'), `${label} delete button must not show a browser tooltip`);
  assert(!frontend.includes("renderStateMeterHearts"), `${label} frontend must not retain the removed state-meter heart renderer`);
  assert(!frontend.includes("st-state-meter-heart"), `${label} frontend must not retain state-meter heart nodes or styles`);
  for (const needle of [
    "--p5-red:#ed1831",
    ".st-calendar-lite-app .st-cal-day",
    ".st-calendar-lite-app .st-lite-card.st-cal-hero",
    ".st-calendar-lite-app .st-cal-day.is-special i{color:#ff8090!important}",
    ".st-timetable-app .st-tt-day",
    ".st-timetable-app .st-tt-day.is-active .st-tt-period :is(strong,small,em){color:#111!important",
    ".st-timetable-app .st-tt-day.is-active .st-tt-period:is(.is-current,.is-selected,.is-modified)",
    ".st-clock-app .st-clock-action",
    ".st-school-app .st-rule-item",
    ".st-city-map-app:not(.st-police-hq-app):not(.st-hospital-remodel-app)",
    ".st-board-node{clip-path:none}",
    "催眠 APP 独占哥特主题",
    "--hg-void:#060408",
    ".st-hypnosis-lite-app:not(.st-police-hq-v5-app):not(.st-police-hq-app)",
    '[data-st-phone-app="hypnosis"]',
    ".st-clean-hypnosis-island .st-app-island-progress",
    "linear-gradient(90deg,#641022 0,#b91939 58%,#b69259 100%)"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing Persona-style utility/map theme: ${needle}`);
  }
  for (const mapIconKey of [
    "city:university", "city:school", "city:shujin-academy", "city:saionji-company", "city:police-headquarters",
    "city:general-hospital", "city:miyuki-home", "city:natsumi-home", "city:saionji-home",
    "campus:babel", "campus:classroom", "campus:tropical-rainforest", "campus:old-school-building",
    "campus:corridor", "campus:library", "campus:field", "campus:school", "campus:pool",
    "teaching:teacher-office", "teaching:principal", "teaching:boys-restroom", "teaching:corridor",
    "teaching:girls-restroom", "teaching:classroom-1", "teaching:classroom", "teaching:classroom-3",
    "teaching:secret-god-gazing-box", "teaching:schrodinger-greenhouse", "teaching:nurse-room", "teaching:rooftop"
  ]) {
    assert(frontend.includes(`"${mapIconKey}"`), `${label} frontend missing dedicated map icon: ${mapIconKey}`);
  }
  assert(frontend.includes("mapBoardIconSvg(layerId, node)"), `${label} map icons must be resolved by layer and node id`);
  assert(frontend.includes(".st-board-symbol *{pointer-events:none}"), `${label} map icon internals must not intercept node clicks`);
  for (const needle of [
    "const INVENTORY_LOCKER_PAGE_SIZE = 8",
    "st-inventory-wheel-grid",
    'data-wheel-dir="nw"',
    'data-wheel-dir="se"',
    "st-inventory-wheel-hub",
    "st-inventory-detail",
    "updateInventoryPageView",
    "overflow-wrap:anywhere",
    "st-profile-favorite-stamp",
    "st-profile-favorite-stamp__glyph",
    "stProfileStampPress",
    "stProfileStampImprint",
    "prefers-reduced-motion:reduce",
    "st-hypnosis-trance-overlay is-gothic-curtain",
    "st-hypnosis-curtain",
    "stHypnosisCurtainSweep",
    "stHypnosisCurtainPetal",
    "if (root.querySelector?.(\":scope > .st-hypnosis-trance-overlay\")) return",
    "addEventListener(\"animationend\", cleanup, { once: true })",
    "fallbackTimer = window.setTimeout(cleanup, 3500)",
    "if (added) playHypnosisTranceAnimation(page)",
    "data-inventory-wheel-gun",
    "bindInventoryWheelAim",
    "playInventoryShot",
    "st-inventory-shot",
    "stInventoryGunRecoil",
    "inventoryShotBusy",
    "--shot-counter",
    "shortestInventoryGunTurn",
    "stInventoryGunTurn",
    "inventoryGunTurn",
    "KIA!",
    "BANG!",
    "PIA!",
    "st-inventory-island",
    "<strong>ITEM</strong>",
    "st-task-island",
    "<strong>TASK</strong>",
    ".st-galgame-card.is-side-right::before{background:linear-gradient(242deg",
    ".st-galgame-card.is-side-right>summary{background:linear-gradient(248deg"
  ]) {
    assert(frontend.includes(needle), `${label} frontend missing inventory/stamp/curtain/Galgame release behavior: ${needle}`);
  }
  assert(!frontend.includes('stAssetUrl("inventory/locker-inventory.png")'), `${label} inventory must not load the obsolete locker background`);
  for (const obsoleteTranceNeedle of ["stHypnosisSeraphEyePulse", "stHypnosisEyeSplit", "st-hypnosis-seraph", "data-hypnosis-seraph", "stHypnosisSeraphManifest", "hypnosis-seraph-sacred-v1.webp", "st-hypnosis-seraph-demon", "st-hypnosis-seraph-angel", "st-hypnosis-trance-core", "st-hypnosis-trance-eye"]) {
    assert(!frontend.includes(obsoleteTranceNeedle), `${label} hypnosis apparition must not retain cartoon SVG treatment: ${obsoleteTranceNeedle}`);
  }
  assert(!frontend.includes("turn += (target - current + 360) % 360"), `${label} inventory gun must not retain clockwise-only rotation`);
  assert(frontend.includes('bindInventoryWheelAim(layer, root, "stInventoryGunTurn")'), `${label} floating inventory must preserve its transient gun angle`);
  assert(frontend.includes('bindInventoryWheelAim(view, page, "inventoryGunTurn")'), `${label} lite inventory must preserve its transient gun angle`);
  assert(frontend.includes('root.dataset.stInventoryGunTurn = direction === "prev" ? "180" : "0"'), `${label} floating inventory BANG/PIA must become fixed page angles`);
  assert(frontend.includes('page.dataset.inventoryGunTurn = direction === "prev" ? "180" : "0"'), `${label} lite inventory BANG/PIA must become fixed page angles`);
  for (const obsolete of ["st-hypnosis-trance-overlay is-gothic-wither", "st-hypnosis-wither-", "stHypnosisWither", "st-starlight-island", 'starlight.toLocaleString() + " Task"', "st-profile-favorite-stamp__mark", "st-profile-favorite-stamp__handle", ">藏<"]) {
    assert(!frontend.includes(obsolete), `${label} frontend still contains obsolete visual/runtime text: ${obsolete}`);
  }
  assert(!frontend.includes("page.dataset.profileRemodelPart ="), `${label} frontend must not write the colliding legacy remodel-part dataset`);
  assert(!frontend.includes("page.dataset.profileRemodelDetail ="), `${label} frontend must not write the colliding legacy remodel-detail dataset`);
}
for (const needle of ["profile-neighbor-host", "profile-neighbor-rail", "updateProfileNeighbors", "__ST_HYPNOOS_PROFILE_NAV__", "profile-turning-prev", "profile-turning-next"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating host missing outside-phone profile navigation rail: ${needle}`);
}
for (const needle of ["profile-possession-host", "profile-possession-grip", "profile-possession-top-grip-v1.png", "top:-88px", "updateProfilePossession", "__ST_HYPNOOS_PROFILE_POSSESSION__", "data-profile-possession-host", "filter:blur(4px)"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating host missing outside-phone detail-only possession grip: ${needle}`);
}
for (const needle of ["encounter-possession-decor-host", "encounter-possession-decor-visible", "updateEncounterPossessionDecor", "__ST_HYPNOOS_UPDATE_ENCOUNTER_POSSESSION_DECOR__", "encounterPossessionDecorHost.hidden = !visible", "encounter-possession-decor-host[hidden]"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating host missing non-interactive Encounter possession decoration: ${needle}`);
}
assert(!floatingPhoneBootstrap.includes("data-encounter-possession-decor"), "Encounter possession decoration must not be an interactive button");
for (const needle of ["hypnosis-judgement-perch", "hypnosis-judgement-figure is-demon", "hypnosis-judgement-figure is-angel", "hypnosis-demon-side-v3.png", "hypnosis-angel-side-v3.png", "hypnosis-judgement-figure__rear", "hypnosis-judgement-figure__front", "hypnosis-perch-visible", "updateHypnosisPerch", "__ST_HYPNOOS_UPDATE_HYPNOSIS_PERCH__"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating host missing hypnosis judgement pseudo-3D layer: ${needle}`);
}
for (const obsolete of ["raven-perch", "hypnosis-raven", "hypnosis-makima", "hypnosis-judgement-perch-v1.png", "hypnosis-judgement-sides-v2.png"]) {
  assert(!floatingPhoneBootstrap.includes(obsolete), `floating host still contains obsolete hypnosis perch asset: ${obsolete}`);
}
for (const needle of [".st-galgame-card.is-side-right>summary", "linear-gradient(248deg"]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating host missing odd/even Galgame far-side decoration: ${needle}`);
}
assert(!floatingPhoneBootstrap.includes("profile-possession-rear"), "top-rim possession grip must not retain the obsolete lower wrist layer");
assert(!floatingPhoneBootstrap.includes("<strong>附身</strong>"), "possession grip image must be the button without a text plate");
for (const needle of ["stPersonSlashRight", "translate3d(58px,-18px,0)", ".st-profile-crime-ledger", ".st-profile-items-notice"]) {
  assert(desktopInlineFrontend.includes(needle) && phoneInlineFrontend.includes(needle), `frontends missing mirrored profile transition/readability theme: ${needle}`);
}
for (const needle of [
  ".st-profile-app .st-profile-desk-card.is-confidential",
  "const previewFields = PERSON_PROFILE_CLOTHING_FIELDS"
]) {
  assert(desktopInlineFrontend.includes(needle) && phoneInlineFrontend.includes(needle), `frontends missing desk confidential/clothing behavior: ${needle}`);
}
const frontendTexts = [
  desktopInlineFrontend,
  phoneInlineFrontend,
  floatingPhoneBootstrap,
  await readText("scripts/mirror-frontend.mjs")
].join("\n");
assert(/function syncLocationRuleDeleteToCurrentLayer[\s\S]*?if \(!option\) return false;/.test(frontendTexts), "location-rule deletion must fail closed when the current message option is unavailable");
assert(frontendTexts.includes("openPersonProfileDeskRole(page, deskCard.getAttribute"), "frontend source missing unified profile desktop-card open path");
assertNoLegacyRoleVariablePaths("frontend", frontendTexts);
for (const path of [
  "public/frontends/hypnosis-app/assets/police/kuki-trait-target-silhouette.png",
  "public/frontends/hypnosis-app/assets/police/kuki-trait-self-silhouette.png",
  "public/frontends/hypnosis-app/assets/profiles/miryuko.png",
  "public/frontends/hypnosis-app/assets/profile-ui/hypnosis-demon-side-v3.png",
  "public/frontends/hypnosis-app/assets/profile-ui/hypnosis-angel-side-v3.png"
]) {
  const asset = await readFile(path).catch(() => null);
  assert(asset && asset.length > 1024, `missing or invalid police-console silhouette asset: ${path}`);
}
for (const role of ["alisa", "hyakka"]) {
  for (const group of ["idle", "unique-a", "unique-b", "drag", "landing", "enter", "exit"]) {
    const path = `public/frontends/hypnosis-app/assets/pet/v5/${role}/${role}-${group}-v5.png`;
    const asset = await readFile(path).catch(() => null);
    assert(asset && asset.length > 1024, `missing or invalid desktop-pet v5 asset: ${path}`);
  }
}
for (const needle of [
  'landing: { group: "landing", total: 12',
  "function playPetLandingAfterDrag()",
  'loadPetAsset(petCharacterId, "landing")',
  'playPetLandingAfterDrag();',
  '["unique-a", "unique-b", "drag", "exit"]',
  'loadPetAsset(next, "landing")'
]) {
  assert(floatingPhoneBootstrap.includes(needle), `floating desktop-pet missing drag-release landing contract: ${needle}`);
}
for (const forbidden of ["PET_AMBIENT_INTERVAL_MS", "petAmbientCursor", "ambient-a", "ambient-b"]) {
  assert(!floatingPhoneBootstrap.includes(forbidden), `floating desktop-pet still contains cancelled ambient action: ${forbidden}`);
}
for (const needle of BANNED_FRONTEND_TEXT) {
  assert(!frontendTexts.includes(needle), `banned frontend text still exists: ${needle}`);
}
for (const retired of ['system["_buff结束时间"]', 'setCurrentLayerSystemField("_buff结束时间"', "/系统/_buff结束时间", "ST_WORK_JOBS", "workEncounterProgressStorageKey", ".st-work-room", "syncWorkBuffStatusReminder", "normalizeWorkEncounterPhasePayload", "__ST_PRUNE_EXPIRED_WORK_OPERATIONS__", "__ST_HYPNOOS_UPDATE_WORK_LEVER__"]) {
  assert(!frontendTexts.includes(retired), `retired work runtime leaked into frontend: ${retired}`);
}
for (const needle of ["repairCurrentMvuDynamicSchema", "repairDynamicMvuSchemaTree", "recursiveExtensible", "持有物品", "奖励物品", "删除地点规则只承认<变量权限>中的前端结果"]) {
  assert(frontendTexts.includes(needle), `frontend missing dynamic schema/school-rule safety text: ${needle}`);
}
for (const needle of [
  "只暂存用户意图；尚未扣除常识修改雷达，也未写入/规则",
  "自行生成名称并润色内容",
  "mapLayerIsDescendantOf(ruleLayer, layerId) || mapLayerIsDescendantOf(layerId, ruleLayer)",
  ".st-location-rule-drawer .st-rule-item::before{display:none!important}",
  'value?.["名称"] || value?.["规则名"] || scope',
  "提交规则请求",
  "const pageSize = 4",
  "data-location-rule-page",
  "每页4项",
  "现有雷达已被本轮待发送的规则请求占用"
]) {
  assert(frontendTexts.includes(needle), `frontend missing AI-settled/paginated location-rule flow: ${needle}`);
}
for (const needle of [
  "st-police-attention-overlay",
  "__ST_SET_POLICE_ATTENTION_STATUS_REMINDER__",
  "九鬼真白",
  "警视厅特设对催眠犯罪特别对策室",
  "警视厅关注事件",
  "九鬼真白替我担保无辜",
  'roleStateValue(role, "服从度", 0)) >= 100',
  'system[ST_POLICE_LINE_KEY] = 2',
  "[mvu_update]警视厅监视结算规则",
  "[mvu_plot]警视厅关注事件",
  "/角色/九鬼真白/状态/警戒度+10",
  "/角色/九鬼真白/状态/服从度-10",
  "九鬼真白的施虐",
  "每次仅对实际目击者写/角色/角色名/状态/好感度-5",
  "服从度>=100且警视厅线仍为1",
  "好感度只调节她的情绪底色",
  "从本轮起特别关注已结束",
  "九鬼真白初次登场",
  "单独把{{user}}拉到无人处殴打",
  "surveillance_method",
  "被动过的私人物件、只给{{user}}看的痕迹",
  "主内容是殴打、动作命令和少量短句羞辱",
  "VIP3以下的催眠不能让她停下",
  "心理压力与肉体压力",
  "好感度60-99",
  "警戒度31-60",
  "固定优先级为：警视厅线与角色硬边界",
  "if (!lifecycle?.ok)",
  "已回滚警视厅线",
  "本条被移除后停止全部自动结算",
  "policeAttentionSetMonitoringEntriesEnabled(false)",
  "policeAttentionSyncWorldbookLifecycle",
  "ST_POLICE_ATTENTION_BASE_COMMENTS",
  "ST_POLICE_ATTENTION_MONITORING_COMMENTS",
  "ST_POLICE_ATTENTION_AFFECTION_COMMENTS",
  "policeAttentionAffectionUnlocked",
  "hospitalRemodelAvailability",
  "犬冢穗波与天城纱良已共同确认",
  "犬冢穗波与天城纱良的服从度均已达到100",
  "前端已直接写入只读的/系统/_医院线=2",
  "renderHospitalEntryDialog",
  "data-hospital-entry-layer",
  "renderOldSchoolUnavailableDialog",
  "data-old-school-unavailable-layer",
  "ensureStoryLineDefaults",
  "已补齐前端线路默认变量。",
  "ST_GHOST_FIRST_ENCOUNTER_TRIGGER",
  "HYPNOOS_GHOST_FIRST_ENCOUNTER_V1",
  "ghostLineEligibility",
  "ghostLinePackage",
  "ghostLineStart",
  "千杀百花停下了脚步",
  "百花注意到旧校舍里有一道亡魂气息",
  "profiles/miryuko.png",
  "ST_NON_OPERABLE_ROLE_NAMES",
  "弥留子没有可供医院改造的实体",
  "ST_NON_OPERABLE_ROLE_NAMES.has(roleName)",
  "data-profile-locked-remodel",
  "医院线尚未完成共同确认，医院改造室暂未开放。",
  "renderPoliceHeadquartersPage",
  "policeApplyBadRecordTrait",
  "data-police-hq-v5-apply",
  "[mvu_plot]九鬼真白好感链",
  "{ create: false }",
  "await policeAttentionSyncWorldbookLifecycle(2)",
  "badRecordTraits",
  "badRecordPersonality",
  "极端易怒",
  "极端坦率",
  "profiles/kuki-mashiro.png",
  "police/trait-scene-generic-female.png",
  "hospital/remodel-generic-female.png",
  "police/kuki-trait-self-silhouette.png",
  "st-profile-trait-sigil",
  "st-police-hq-v5-overview",
  'var roleRoot = getvar("stat_data.角色") || {};',
  "roleRoot && typeof roleRoot === \"object\" && !Array.isArray(roleRoot)",
  "profileLockedDialog",
  "九鬼真白正在持续监视"
]) {
  assert(frontendTexts.includes(needle), `frontend missing police attention dynamic implementation: ${needle}`);
}
assert(!frontendTexts.includes("𝙆𝙪𝙠𝙞 · 私下监视记录"), "legacy Kuki private monitoring title must be removed");
assert(frontendTexts.includes("施虐欲在第一次正式任务中被完全激发") || frontendTexts.includes("施虐欲彻底释放"), "Kuki sadism must remain the primary hidden drive");
for (const needle of [
  '"身高": "164cm"', '"体重": "49kg"', '"三围": "B84 / W57 / H85"',
  '"身高": "148cm"', '"体重": "41kg"', '"三围": "B82 / W54 / H81"',
  '"身高": "204cm"', '"体重": "78kg"', '"三围": "B96 / W66 / H98"',
  '"身高": "180cm"', '"体重": "0kg"', '"三围": "B103 / W68 / H97"',
  'String(item?.name || "").trim() === "白枢暗子"',
  'systemSnapshot[ST_GHOST_LINE_KEY] = undefined',
  'await appendAppOperation({\n        来源: "综合医院",\n        操作: "追上夏美与医院初遇"',
  '五大部位',
  '{ id: "整体", label: "整体", detail: ["外表", "内脏", "疾病", "其他"] }',
  '"整体": ["外表", "内脏", "疾病", "其他"]',
  "hospitalRemodelStableInfoPaths",
  "身高、体重、三围或阴茎长度大多数改造保持原值",
  '建议≤4个 · 一次10w日元',
  '取消改造',
  '同一暂存格无论包含多少细分改造，成功结算只从/系统/持有零花钱扣除100000日元一次',
  '/改造/" + escapePointer(partId) + "/" + escapePointer(detailId)',
  '不要在帖子点zany_face',
  '开启作弊模式',
  '!inEventsMode && activeTab === tab.id',
  '!inEventsMode && activeTab === "remodel"'
]) {
  assert(frontendTexts.includes(needle), `frontend missing special-role transaction/profile contract: ${needle}`);
}
assert(!frontendTexts.includes('$警视厅线') && !frontendTexts.includes('$医院线') && !frontendTexts.includes('$灵异线'), "frontend must not retain deprecated $ story lines");
for (const needle of [
  "[mvu_plot]警视厅担保结束",
  "[mvu_plot]医院改造室开放",
  "不具备徒手或直接施法能力",
  "不能凭空释放法术、创造魔法道具、操控灵魂、指定宿主或制造附身"
]) {
  assert(frontendTexts.includes(needle), `frontend missing line-completion or Hyakka magic contract: ${needle}`);
}
assert(finalizerText.includes("每条暂存操作的AI不动/AI写是该按钮的唯一变量归属"), "worldbook must use per-operation ownership fields");
for (const needle of [
  "<本轮操作>是当前回复的最高优先级执行队列",
  "所有暂存操作处理完后，正文只收束到最后一项的直接后果",
  "本轮存在<本轮操作>时，分镜只能拆分这些操作的执行阶段、必要移动与直接后果",
  "人物演出块只能完成这些暂存操作的直接结果与在场反应",
  "不得因为正文同时出现其他事件、正文较短或操作较多而漏掉任一暂存项"
]) {
  assert(finalizerText.includes(needle), `worldbook/injection missing mandatory staged-operation boundary: ${needle}`);
}
for (const needle of [
  "<本轮执行边界>",
  "主剧情必须优先逐项处理本容器内的全部操作",
  "全局至少推进1分钟只用于时间变量，不构成追加剧情的理由",
  "额外变量模型必须逐项核对AI写与AI不动"
]) {
  assert(frontendSource.includes(needle), `frontend operation block missing mandatory execution boundary: ${needle}`);
}
for (const retired of ["派遣岗位: 仅当本轮对应操作", "是否派遣中为true", "监控APP的`派遣角色`"]) {
  assert(!finalizerText.includes(retired), `retired dispatch mechanism leaked into finalizer: ${retired}`);
}
assert(finalizerText.includes("绝对前端专属：`/系统/_警视厅线`"), "story lines and possession must remain absolutely frontend-owned");
assert(frontendTexts.includes("AI不可写路径: frontendPaths") && frontendTexts.includes("AI可写路径: []"), "timetable handoff must keep every timetable leaf front-end-owned");
assert(frontendTexts.includes("AI可写路径: [\"/系统/星光点\", rolePageVariablePath(cleanRoleName, \"子嗣\") + \"/\" + childKey]"), "pregnancy confirmation must expose exact AI settlement paths");
assert(!frontendTexts.includes("operationFrontendSettledHypnosisNotice"), "related-variable snapshots must not append duplicate frontend-settlement warnings");
assert(finalizerText.includes("已解锁项固定为{状态,特调}"), "worldbook must preserve the bad-record personality leaf contract");
assert(finalizerText.includes("[mvu_plot]劣迹性格表现"), "worldbook must expose configured bad-record personality prompts to the plot model");
assert(finalizerText.includes("[mvu_plot]劣迹罪行记录"), "worldbook must expose recorded bad-record crime counts to the plot model");
assert(finalizerText.includes("const badRecordCrimes = ['盗窃', '露出', '私闯', '伤害', '淫乱', '强奸'];"), "crime EJS must list every fixed crime field");
for (const needle of [
  ".st-galgame-card[data-galgame-role]",
  ".st-galgame-card__portrait",
  ".st-galgame-card__name",
  "profilePhotoAllReadKeys",
  "profilePhotoSource(name, roleData)",
  "refreshGalgameCardsForRole",
  "hydrateGalgameCardPhoto(card, roleName)",
  "hydrateGalgameCardNickname",
  "roleNickname(name, roleData)",
  "roleNicknameClass(roleData)",
  "st-galgame-card__name-original",
  "st-galgame-card__name-nickname",
  "card.dataset.galgameNickname = nickname",
  "registerGalgameHydrationProvider",
  "registry.registerGalgameHydrator"
]) {
  assert(frontendSource.includes(needle), `frontend missing Galgame hydration integration: ${needle}`);
}
for (const needle of [
  "function connectorStoryMessageAllowed(message)",
  ".filter(connectorStoryMessageAllowed)",
  ".slice(-10)",
  "message.is_deleted",
  "message.is_internal",
  "message.extra_model",
  "extra.isSmallSys",
  '"system", "internal", "developer", "tool", "analysis", "reasoning"'
]) {
  assert(frontendSource.includes(needle), `independent connectors must isolate live visible story context: ${needle}`);
}
for (const needle of [
  "function connectorShouldUseHostProxy(profile)",
  "connectorEndpointIsExternal(profile?.endpoint)",
  "invokeIndependentTextModelThroughHost(profile, messages, signal)",
  'origin + "/api/backends/chat-completions/generate"',
  'chat_completion_source: "custom"',
  "custom_include_headers: customHeaders",
  "__ST_HYPNOOS_HOST_REQUEST_HEADERS__",
  "window.parent?.SillyTavern",
  "context?.getRequestHeaders",
  "registry.getRequestHeaders()",
  "connectorCustomApiBase(profile.endpoint)"
]) {
  assert(frontendSource.includes(needle), `independent text connector must use the SillyTavern same-origin backend proxy: ${needle}`);
}
assert(
  !frontendSource.includes('return import(origin + "/script.js")'),
  "independent connector iframe must not import SillyTavern script.js in its own realm because that module requires host jQuery"
);
assert(
  floatingBootstrapSource.includes('typeof ctx.getRequestHeaders === "function"')
  && floatingBootstrapSource.includes('views[i].TavernHelper && views[i].TavernHelper.SillyTavern')
  && !floatingBootstrapSource.includes("import('/script.js')"),
  "floating host must reuse the loaded SillyTavern.getContext().getRequestHeaders API instead of importing script.js again"
);
for (const needle of [
  "host.visualViewport",
  "scale(var(--stage-scale))",
  "width:1240px;height:812px",
  'panel.style.setProperty("--stage-scale", String(scale))'
]) {
  assert(floatingBootstrapSource.includes(needle), `floating host missing logical-canvas mobile scaling: ${needle}`);
}
for (const needle of [
  "data-map-special-toggle",
  "st-secret-coordinate",
  "SPECIAL_LOCATION_LAYER_META",
  "SPECIAL_LOCATION_DYNAMIC_META",
  "specialLocationCatalogForLayer",
  "data-special-location-map-layer",
  "st-secret-pin-summary",
  "st-secret-pin-icon",
  "mapBoardIconSvg(layerId, iconNode)",
  "st-secret-coordinate-pager",
  "data-special-location-layer",
  "data-special-location-select",
  "data-special-location-page",
  'data-special-location-state="',
  '"worldbook-missing"',
  '"locked"',
  '"ready"',
  "function specialLocationEntrySummary",
  "const pageSize = 4",
  "每页 4 个坐标",
  "选择坐标后可查看完整档案、准入状态与载入操作",
  "data-special-location-install",
  "data-special-location-rule",
  "specialLocationRuleTarget",
  "activeLocationRuleTarget",
  "locationRuleReturnSpecial",
  "refreshSpecialLocationWorldbookState",
  "hospitalLineRollbackWorldbook(snapshot)",
  "未覆盖原条目",
  "const page = openCityMapPage(tile);",
  'page.dataset.mapBoardSpecialOpen = "true"'
]) {
  assert(frontendSource.includes(needle), `frontend missing on-demand special-location worldbook workflow: ${needle}`);
}
assert(
  !frontendSource.includes('page.className = "st-lite-app st-special-location-app"'),
  "legacy special-location entry must open the in-map classified coordinate layer instead of a standalone app"
);
for (const needle of [
  '"inuzuka-natsumi-prank-v1"',
  'version: 3',
  '{ kind: "builtin", builtinId: "inuzuka-natsumi-prank-v1", name: "夏美的鬼脸" }',
  'const identity = getSystemState()?.["_user身份"]',
  'system["_user身份"]["照片"] = dataUrl',
  'data-camera-action="rear-unavailable" disabled',
  "后置不可用"
]) {
  assert(frontendSource.includes(needle), `frontend missing wallpaper/camera simplification contract: ${needle}`);
}
for (const forbidden of [
  "invokeIndependentImageModel",
  "cameraGenerateBackImage",
  "cameraBackPhotoStorageKey",
  "文生图插头"
]) {
  assert(!frontendSource.includes(forbidden), `frontend must not retain removed image-generation/rear-camera source: ${forbidden}`);
}
{
  const start = frontendSource.indexOf("function bindSpecialLocationActions(page)");
  const end = frontendSource.indexOf("\n  function openSpecialLocationPage", start);
  assert(start >= 0 && end > start, "special-location action binding must be extractable");
  const specialActionSource = frontendSource.slice(start, end);
  assert(!specialActionSource.includes("scrollIntoView"), "special-location selection and paging must not jump the map viewport");
  assert(!specialActionSource.includes("button.blur()"), "special-location selection and paging must preserve the mobile viewport before rerendering");
}
for (const needle of [
  '"orjenrn-v075-e6895d65f1": { mapLayer: "campus"',
  '"orjenrn-v075-1ebdc0671b": { mapLayer: "teaching"',
  '"orjenrn-v075-4851a4da38": { mapLayer: "teaching"',
  '"orjenrn-v075-abc028312e": { mapLayer: "city"',
  '"orjenrn-v075-aa6ca0745f": { mapLayer: "city"',
  '"orjenrn-v075-1fb20605f2": { mapLayer: "city"',
  '"orjenrn-v075-0e51ca76f0": { mapLayer: "city"',
  '"orjenrn-v075-d7156fed34": { mapLayer: "city"',
  '"orjenrn-v075-bccbad514c": { mapLayer: "city"',
  "const specialSurface = page.querySelector?.(\".st-secret-coordinate\")",
  "nextSpecialSurface.scrollTop = specialScrollTop"
]) {
  assert(frontendSource.includes(needle), `frontend missing stable special-location layering/scroll contract: ${needle}`);
}
{
  const start = frontendSource.indexOf("const SPECIAL_LOCATION_STATIC_ITEMS");
  const end = frontendSource.indexOf("\n\t  function specialLocationCanonicalComment", start);
  assert(start >= 0 && end > start, "special-location catalog metadata must be extractable");
  const metadataSource = frontendSource.slice(start, end);
  const staticLayers = [...metadataSource.matchAll(/\{ id: "(?:tropical-rainforest|babel|university)"[^\n]+?mapLayer: "(city|campus|teaching)"/g)].map((match) => match[1]);
  const dynamicLayers = [...metadataSource.matchAll(/"orjenrn-v075-[a-f0-9]+": \{ mapLayer: "(city|campus|teaching)"/g)].map((match) => match[1]);
  const packagedDynamicLayers = (p5rEncounterPackage?.specialLocationEntries || []).map((entry) => String(entry?.mapLayer || "")).filter(Boolean);
  const counts = [...staticLayers, ...dynamicLayers, ...packagedDynamicLayers].reduce((result, layer) => ({ ...result, [layer]: (result[layer] || 0) + 1 }), {});
  assert(staticLayers.length === 3 && dynamicLayers.length === 9 && packagedDynamicLayers.length === 1, "special-location metadata must cover all 3 static and 10 dynamic locations by stable ID");
  assert(counts.city === 8 && counts.campus === 3 && counts.teaching === 2, "special locations must remain split into city 8, campus 3, teaching 2");
  assert(frontendSource.includes("encounterReadPackages().flatMap((pkg)"), "special-location catalog must consume every built-in package source");
  assert(frontendSource.includes('mapLayer: String(source?.mapLayer || meta.mapLayer || "city")'), "package special locations must preserve their explicit map layer");
  assert(frontendSource.includes('{ id: "shujin-academy", specialId: "shujin-academy"'), "city board must expose the 秀尽学园 special-location pin");
  assert(frontendSource.includes("specialLocationCatalog().find((item) => item.id === node.specialId)"), "city board must resolve package-backed special locations");
}
{
  const start = frontendSource.indexOf("function bindSpecialLocationActions(page)");
  const end = frontendSource.indexOf("\n  function openSpecialLocationPage", start);
  const source = frontendSource.slice(start, end);
  for (const needle of [
    "page.dataset.locationRuleSpecialId = id",
    'page.dataset.locationRuleReturnSpecial = "true"',
    'page.dataset.mapBoardRulesOpen = "true"',
    "renderCityMapPage(page)"
  ]) {
    assert(source.includes(needle), `special-location rule handler missing state transition: ${needle}`);
  }
}
{
  const start = frontendSource.indexOf("function renderSpecialLocationCard(page)");
  const end = frontendSource.indexOf("\n  function bindSpecialLocationActions", start);
  assert(start >= 0 && end > start, "special-location renderer must be extractable");
  const source = frontendSource.slice(start, end);
  for (const needle of [
    "specialLocationCatalogForLayer(layerId)",
    "const pageSize = 4",
    "mapBoardIconSvg(layerId, iconNode)",
    "data-special-location-rule"
  ]) {
    assert(source.includes(needle), `special-location renderer missing layered map contract: ${needle}`);
  }
}
{
  const start = frontendSource.indexOf("function specialLocationRuleTarget(locationId)");
  const end = frontendSource.indexOf("\n  function activeLocationRuleTarget", start);
  assert(start >= 0 && end > start, "special-location rule target must be extractable");
  const source = frontendSource.slice(start, end);
  for (const needle of [
    "specialLocationLayerId(location)",
    "mapLayerPathLabels(layerId)",
    '地点ID: layerId + ":" + String(location.id)',
    '地点路径: path.join(" / ")'
  ]) {
    assert(source.includes(needle), `special-location rule target missing exact ID/path contract: ${needle}`);
  }
}
{
  const start = frontendSource.indexOf("function closeLocationRuleDrawer(page)");
  const end = frontendSource.indexOf("\n  function mapBoard", start);
  assert(start >= 0 && end > start, "location-rule close handler must be extractable");
  const source = frontendSource.slice(start, end);
  assert(source.includes('page.dataset.mapBoardSpecialOpen = "true"'), "closing a special-location rule must return to the classified coordinate view");
  assert(source.includes("delete page.dataset.locationRuleSpecialId"), "closing a special-location rule must clear its transient target");
}
for (const needle of [
  "特殊地点在机密坐标中固定归入城市、校园、教学楼三级地图",
  "校园或教学楼内的叶级特殊地点规则也不得退化为整个私立斋明学园通用规则",
  "layer=campus，path=私立斋明学园 / 第1生物特别温室",
  "layer=city，path=明德大学",
  "function isSchoolParentRule(name, path)",
  "return isSchoolParentRule(name, path) && schoolChild(currentLocation)",
  "return isSchoolParentRule(name, path) && schoolChild(nextIntent)"
]) {
  assert(finalizerText.includes(needle), `worldbook missing special-location rule/layer contract: ${needle}`);
}
for (const needle of [
  "if (created === false) return null;",
  "if (updated === false) return null;",
  "if (saved === false) return null;"
]) {
  assert(frontendSource.includes(needle), `worldbook transaction adapter must reject explicit host failure: ${needle}`);
}
for (const needle of [
  "function encounterDefaultSensitiveVariableObject(gender)",
  'normalizedRoleGender(gender, "女") === "男"',
  '"阴茎敏感度": 100',
  '"龟头敏感度": 100',
  '"前列腺敏感度": 100',
  "function encounterInitialProfileFieldSpecs(gender)",
  "function encounterInitialBodyFieldSpecs(gender)"
]) {
  assert(frontendSource.includes(needle), `frontend missing gender-aware custom-role fields: ${needle}`);
}
for (const needle of [
  'page.querySelectorAll(\'select[name="roleGender"]\')',
  'select.addEventListener("change"',
  "性别已切换，初始变量表已同步为对应身体字段",
  "settingsReadMvuCandidateForOption(data.option)",
  "profileChildRoleSnapshotJson(expected) !== profileChildRoleSnapshotJson(actual)",
  "await encounterRestoreRoleVariables(snapshot, systemSnapshot)"
]) {
  assert(frontendSource.includes(needle), `frontend missing custom-role gender rerender or exact initial-variable readback: ${needle}`);
}
for (const needle of [
  "async function requestOtakuFemaleTransform(page)",
  'data.stat["角色"][roleName] = femaleRole',
  '"性别": "女"',
  '"操作": "阿宅女性化完成"',
  '"前端已写路径"',
  "现实不是游戏"
]) {
  assert(frontendSource.includes(needle), `frontend missing direct grounded Otaku feminization: ${needle}`);
}
{
  const start = frontendSource.indexOf("function encounterPurchasePayload");
  const end = frontendSource.indexOf("async function encounterHandleRandomRomance", start);
  assert(start >= 0 && end > start, "frontend missing encounter redemption payload");
  const payloadSource = frontendSource.slice(start, end);
  assert(!payloadSource.includes("消耗星光点"), "encounter redemption payload must not reactivate the starlight worldbook");
  assert(!payloadSource.includes("新增任务"), "encounter redemption payload must not reactivate the task worldbook");
  assert(!payloadSource.includes("任务隔离"), "encounter redemption payload must not duplicate task-isolation prose");
  assert(payloadSource.includes(".slice(0, 360)"), "encounter redemption role prompt must keep a bounded prompt budget");
}
assert(
  frontendSource.includes("乌黑长发扎成单马尾")
  && frontendSource.includes("乌黑柔顺的长发扎成单马尾"),
  "Kuki Mashiro hair must stay a single ponytail in frontend and worldbook seeds"
);
assert(
  !frontendSource.includes("ensureGalgameNarrativeHostStyle(targetDocument);"),
  "full frontend must not inject a second Galgame style owner"
);
assert(
  frontendSource.includes('"九鬼真白": [')
  && frontendSource.includes('stAssetUrl("profiles/kuki-mashiro.png")')
  && frontendSource.includes('stAssetUrl("profiles/kuki-mashiro-glasses-contempt.png")'),
  "Kuki Mashiro must retain her original photo and add the glasses/contempt image as the second default slot"
);
const kukiSecondPhoto = await readFile("public/frontends/hypnosis-app/assets/profiles/kuki-mashiro-glasses-contempt.png");
assert(kukiSecondPhoto.length > 10_000, "Kuki Mashiro second profile photo asset is missing or unexpectedly small");
for (const needle of [
  "GALGAME_MARKER_RE",
  "parseGalgameEntries",
  "hostDocument.createRange()",
  "ensureGalgameStyle",
  "GALGAME_STALE_STYLE_IDS",
  "st-galgame-narrative-bootstrap-style-v3",
  "registerGalgameHydrator",
  "refreshGalgameRole",
  "GALGAME_RUNTIME_KEY",
  "st-galgame-card__portrait",
  ".st-galgame-card[data-galgame-role]",
  'card.dataset.galgameUser !== "true"',
  "openProfileRole(roleName)"
]) {
  assert(floatingBootstrapSource.includes(needle), `floating host missing Galgame profile integration: ${needle}`);
}
for (const removedNeedle of ["kg-g-portrait", ".kg-g[data-hypnoos-galgame", 'card.dataset.galgameUser !== "玩家"', "invalid-role"]) {
  assert(!floatingBootstrapSource.includes(removedNeedle), `floating host must not retain obsolete Galgame selector/state: ${removedNeedle}`);
}
for (const [label, bootstrap] of [["source", floatingBootstrapSource], ["generated", floatingPhoneBootstrap]]) {
  for (const needle of ["--gg-ink:#151515", "--gg-paper:#f6f3ed", "font-size:16px", "border-radius:7px 19px 19px 19px"]) {
    assert(bootstrap.includes(needle), `${label} Galgame host missing restrained speech-bubble theme token: ${needle}`);
  }
  assert(
    bootstrap.includes('openProfile("", name);'),
    `${label} Galgame portrait must preserve the remembered profile group/page`
  );
  assert(
    !bootstrap.includes('openProfile("clothing", name);'),
    `${label} Galgame portrait must not force the clothing tab`
  );
  for (const needle of [
    "galgameRoleTone",
    "card.dataset.galgameTone",
    "st-galgame-card__index",
    "--gg-role:#b34b57",
    "data-galgame-tone"
  ]) {
    assert(bootstrap.includes(needle), `${label} Galgame host missing multi-role distinction: ${needle}`);
  }
  const registerLifecycle = bootstrap.match(/function register\(owner\)\s*\{[\s\S]*?(?=\n\s*function unregister\()/)?.[0] || "";
  assert(
    registerLifecycle.includes("notifyStages();")
    && registerLifecycle.includes("scheduleGalgameRender();")
    && registerLifecycle.indexOf("notifyStages();") < registerLifecycle.indexOf("scheduleGalgameRender();"),
    `${label} floating bootstrap must render Galgame at the final stage-registration lifecycle`
  );
}
const kukiInitialVariables = frontendTexts.match(/const ST_POLICE_ATTENTION_INITIAL_VARIABLES\s*=\s*\{([\s\S]*?)^\s*\};/m)?.[1] || "";
assert(kukiInitialVariables.includes('"劣迹": {') && kukiInitialVariables.includes('"性格": {}') && kukiInitialVariables.includes('"罪行": { "盗窃": 0, "露出": 0, "私闯": 0, "伤害": 0, "淫乱": 0, "强奸": 0 }'), "Kuki initial variables must include an empty personality object and zero crime counts");
assert(!/"(?:愤怒|色欲|暴食|傲慢|嫉妒|怠惰|贪婪|忧郁|虚伪)"\s*:/.test(kukiInitialVariables), "Kuki initial variables must not pre-unlock bad-record traits");
assert(frontendTexts.includes("function encounterSupplementBadRecordContract"), "encounter imports must supplement missing bad-record fields for existing roles without replacing them");
assert(frontendTexts.includes('"物品": { "持有": {} }') && !frontendTexts.includes('"物品": { "持有": {}, "刷新": {} }') && frontendTexts.includes('"子嗣": { "是否妊娠中": false, "生产数量": 0, "子嗣列表": {} }'), "encounter/default role initializers must use the held-only item structure");
for (const needle of [
  "data-profile-item-refresh-tendency",
  "items长度必须为4",
  "无论倾向如何都必须给出4件",
  "文生文插头必须返回4件有效且不重名的新物品",
  "物品已生成，但MVU变量复核未通过",
  "刷新并补入4件",
]) {
  assert(frontendTexts.includes(needle), `profile item refresh flow missing: ${needle}`);
}
assert(!frontendTexts.includes('data-profile-items-segment="refresh"'), "profile item UI must not retain a refresh variable segment");
assert(!frontendTexts.includes("图片 URL / 相对资源路径"), "encounter silhouette editor must not expose URL/path inputs");
assert(frontendTexts.includes("function encounterApplyCanonicalRoleWorldbookLayout"), "encounter role worldbooks must use a canonical variable/persona/affection layout");
assert(frontendTexts.includes('position: "at_depth", extensionPosition: 4, depth: 2'), "encounter affection chains must be inserted at the same depth as default role affection chains");
assert(frontendTexts.includes("existingCommentsToRepair"), "TavernHelper imports must repair and re-enable every matching role worldbook entry");
assert(frontendTexts.includes("an existing persona entry is left byte-for-byte"), "TavernHelper imports must preserve existing persona content and activation state");
for (const needle of [
  "覆盖肩颈、胸腹、背部和上肢",
  "覆盖腰胯、臀腿和足部",
  "不能只写“无”或“裸体”"
]) {
  assert(finalizerText.includes(needle), `worldbook missing normalized clothing visibility semantics: ${needle}`);
}
assert(!data.alternate_greetings?.length, "built card must remain free of test alternate openings");

const encounterAssetTexts = await readTextFilesRecursive("public/frontends/hypnosis-app/assets/encounter");
const encounterAssetText = encounterAssetTexts.map(({ path, text }) => `${path}\n${text}`).join("\n");
for (const { path, text } of encounterAssetTexts) {
  assertEjsPromptSafety(path, text);
  assert(!/\{\{(?:get|format)_message_variable::(?:系统|角色)\./.test(text), `${path} has a display macro missing stat_data`);
  assert(!/\{\{(?:get|format)_message_variable::stat_data\.[^}]*\.\$/.test(text), `${path} exposes a private $ variable`);
  assert(!/getvar\(['"]stat_data\.[^'"]*\.\$/.test(text), `${path} reads a private $ variable through EJS`);
  if (!/\.json$/i.test(path)) continue;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  const roles = Array.isArray(parsed?.roles) ? parsed.roles : [parsed];
  assertEncounterRolePromptPaths(path, roles);
  for (const role of roles) {
    if (!role?.initialVariables || typeof role.initialVariables !== "object" || Array.isArray(role.initialVariables)) continue;
    const fixture = structuredClone(initData);
    fixture.角色[String(role.name || "测试角色")] = structuredClone(role.initialVariables);
    const result = currentMvuSchema.safeParse(fixture);
    assert(result.success, `${path} role initialVariables violate current MVU Schema: ${role.name || "(unnamed)"} ${JSON.stringify(result.error?.issues || [])}`);
  }
}
for (const needle of [
  "function roleDisplayAge(",
  'readRolePageField(roleData, "信息", "_年龄"',
  'ENCOUNTER_INITIAL_VARIABLE_SKIP_FILL_PATHS = new Set(["信息._年龄"'
]) {
  assert(frontendTexts.includes(needle), `frontend missing age compatibility/display contract: ${needle}`);
}
assert(!frontendTexts.includes("Number(baseText) + currentYear - 2024"), "frontend must not derive or advance character ages from the system year");
assert(!frontendTexts.includes("2024基准年龄"), "frontend must not reinterpret authored character ages as a managed base-year field");
for (const pattern of [
  /getvar\(\s*['"]stat_data\.角色\.[^'"]+\.发情值['"]\s*\)/,
  /\{\{get_message_variable::stat_data\.角色\.[^}]+\.发情值\}\}/,
  /\{\{format_message_variable::stat_data\.角色\.[^}]+\.发情值\}\}/
]) {
  assert(!pattern.test(encounterAssetText), `encounter assets contain deprecated arousal EJS path: ${pattern}`);
}
for (const pattern of [
  /\b(?:setvar|incvar|decvar)\s*\(/,
  /getvar\(\s*['"]stat_data['"]\s*\)/
]) {
  assert(!pattern.test(encounterAssetText), `unsafe EJS pattern leaked into encounter assets: ${pattern}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      card: CARD_PATH,
      entries: entries.length,
      defaultRoles: initialRoles.slice(0, DEFAULT_ROLES.length),
      retiredInitialRules: RETIRED_INITIAL_RULE_NAMES
    },
    null,
    2
  )
);
