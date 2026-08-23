import fs from "node:fs";
import path from "node:path";
import { normalizeOrjenrnPersonaEntry } from "./orjenrn-persona-normalization.mjs";
import {
  buildOrjenrnInitialVariables,
  refreshOrjenrnRoleInitialVariables
} from "./orjenrn-initial-variables.mjs";

const root = process.cwd();
const encounterRoot = path.join(root, "public/frontends/hypnosis-app/assets/encounter");
const packagePath = path.join(encounterRoot, "orjenrn/package.json");
const polishPath = path.join(encounterRoot, "orjenrn/polish-v0.32.source.json");
const miryukoPolishedPersonaPath = path.join(root, "src/worldbooks/miryuko-polished-persona.txt");
const sources = {
  北田雪路: ["akashi-maho", "encounter/akashi-maho/role-01.png"],
  萩生田梨果: ["akashi-maho", "encounter/akashi-maho/role-02.png"],
  凯瑟琳: ["baikai", "encounter/baikai/roles/凯瑟琳/凯瑟琳.png"],
  西园寺美织: ["baikai", "encounter/baikai/roles/西园寺美织/西园寺美织.png"],
  神谷凛: ["baikai", "encounter/baikai/roles/神谷凛/神谷凛.png"],
  星野海: ["baikai", "encounter/baikai/roles/星野海/星野海.png"],
  源薰子: ["baikai", "encounter/baikai/roles/源薰子/源薰子.png"]
};
const builtInReplacementNames = new Set(["犬冢穗波", "天城纱良", "弥留子", "阿宅女性化"]);
const builtInBranchPersonaOverrides = new Map([
  ["弥留子", fs.readFileSync(miryukoPolishedPersonaPath, "utf8").trim()]
]);

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const polish = JSON.parse(fs.readFileSync(polishPath, "utf8"));
const entries = Object.values(polish.entries || {})
  .filter((entry) => /人设\s*$/u.test(String(entry?.comment || "")))
  .map(normalizeOrjenrnPersonaEntry);

const entryRoleName = (entry) => String(entry.comment || "")
  .replace(/^\[mvu_plot\]\s*/u, "")
  .replace(/人设\s*$/u, "")
  .trim();
const packageFor = (id) => JSON.parse(fs.readFileSync(path.join(encounterRoot, id, "package.json"), "utf8"));
const roleKeys = (entry, roleName) => Array.from(new Set([
  roleName,
  ...(Array.isArray(entry.key) ? entry.key : []),
  ...(Array.isArray(entry.keys) ? entry.keys : [])
].map((value) => String(value || "").trim()).filter(Boolean)));
const variableRenderer = (roleName) => {
  const groups = ["衣着", "信息", "状态", "事件", "敏感", "效果", "劣迹", "改造", "物品", "子嗣"];
  return `<%_ {
var groupNames = ${JSON.stringify(groups)};
var groups = [];
for (var groupIndex = 0; groupIndex < groupNames.length; groupIndex += 1) groups.push(getvar('stat_data.角色.${roleName}.' + groupNames[groupIndex]) || {});
function valueText(value) {
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value === undefined || value === null ? '' : String(value);
}
print('  ${roleName}:' + String.fromCharCode(10));
for (var index = 0; index < groupNames.length; index += 1) {
  var source = groups[index] && typeof groups[index] === 'object' && !Array.isArray(groups[index]) ? groups[index] : {};
  print('    ' + groupNames[index] + ':' + String.fromCharCode(10));
  for (var key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    print('      ' + key + ': ' + valueText(source[key]) + String.fromCharCode(10));
  }
}
} _%>`;
};
const normalizeRoleInitialItems = (role) => {
  const rawItems = role?.initialVariables?.物品 && typeof role.initialVariables.物品 === "object" && !Array.isArray(role.initialVariables.物品)
    ? role.initialVariables.物品
    : {};
  const hasItemGroups = Object.prototype.hasOwnProperty.call(rawItems, "持有") || Object.prototype.hasOwnProperty.call(rawItems, "刷新");
  const heldItems = hasItemGroups && rawItems.持有 && typeof rawItems.持有 === "object" && !Array.isArray(rawItems.持有)
    ? structuredClone(rawItems.持有)
    : (hasItemGroups ? {} : structuredClone(rawItems));
  const legacyRefreshItems = hasItemGroups && rawItems.刷新 && typeof rawItems.刷新 === "object" && !Array.isArray(rawItems.刷新)
    ? rawItems.刷新
    : {};
  for (const [itemName, item] of Object.entries(legacyRefreshItems)) {
    if (!Object.prototype.hasOwnProperty.call(heldItems, itemName)) heldItems[itemName] = structuredClone(item);
  }
  role.initialVariables.物品 = { 持有: heldItems };
};
const makeRole = (entry, name) => {
  const renderer = variableRenderer(name);
  const keys = roleKeys(entry, name);
  return {
    id: `orjenrn-polished-role-${name}`,
    name,
    aliases: keys.filter((key) => key !== name),
    intro: String(entry.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220),
    encounterPrompt: "",
    variables: renderer,
    variableEntry: {
      key: keys,
      keys,
      keysecondary: [],
      secondary_keys: [],
      comment: `[mvu_update]${name}变量`,
      content: renderer,
      constant: false,
      selective: true,
      selectiveLogic: 0,
      order: 33,
      insertion_order: 33,
      position: 0,
      disable: false,
      disabled: false,
      enabled: true,
      use_regex: false,
      probability: 100,
      useProbability: true,
      depth: 4,
      extensions: { position: 0, depth: 4, role: 0, probability: 100, useProbability: true }
    },
    personaEntry: structuredClone(entry),
    personaContent: String(entry.content || ""),
    image: "",
    initialVariables: buildOrjenrnInitialVariables(name, entry.content)
  };
};

for (const entry of entries) {
  const name = entryRoleName(entry);
  if (builtInReplacementNames.has(name)) continue;
  let role = pkg.roles.find((candidate) => candidate.name === name);
  if (!role && sources[name]) {
    const [sourceId, image] = sources[name];
    const sourceRole = packageFor(sourceId).roles.find((candidate) => candidate.name === name);
    if (!sourceRole) throw new Error(`找不到原版角色：${name}`);
    role = structuredClone(sourceRole);
    role.id = `orjenrn-polished-${sourceRole.id || name}`;
    role.image = image;
    delete role.imageDataUrl;
    pkg.roles.push(role);
  }
  if (!role) {
    role = makeRole(entry, name);
    pkg.roles.push(role);
  }
  const keys = roleKeys(entry, name);
  role.aliases = keys.filter((key) => key !== name);
  role.personaEntry = structuredClone(entry);
  role.personaContent = String(entry.content || "");
  const renderer = variableRenderer(name);
  role.variables = renderer;
  role.variableEntry = {
    ...makeRole(entry, name).variableEntry,
    ...(role.variableEntry || {}),
    content: renderer,
    key: keys,
    keys,
    comment: `[mvu_update]${name}变量`
  };
  refreshOrjenrnRoleInitialVariables(role);
  normalizeRoleInitialItems(role);
}

for (const role of pkg.roles) {
  const roleName = String(role?.name || "").trim();
  refreshOrjenrnRoleInitialVariables(role);
  const renderer = variableRenderer(roleName);
  role.variables = renderer;
  if (role.variableEntry && typeof role.variableEntry === "object") role.variableEntry.content = renderer;
  normalizeRoleInitialItems(role);
}

pkg.name = "orjenrn 润色角色包";
pkg.intro = "orjenrn 润色版角色包。与其他作者包同名时，可在设置中选择只显示润色版、只显示原版或两边都显示。";
pkg.branchPersonaEntries = entries
  .filter((entry) => builtInReplacementNames.has(entryRoleName(entry)))
  .map((entry) => {
    const clone = structuredClone(entry);
    const override = builtInBranchPersonaOverrides.get(entryRoleName(entry));
    if (override) clone.content = override;
    return clone;
  });
const featuredRoleNames = new Map([
  ["西园寺美织", 0],
  ["桐生刹那", 1],
  ["白石响", 2]
]);
pkg.roles.sort((a, b) => {
  const leftRank = featuredRoleNames.get(String(a.name || "")) ?? featuredRoleNames.size;
  const rightRank = featuredRoleNames.get(String(b.name || "")) ?? featuredRoleNames.size;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN");
});

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`orjenrn 润色包已更新：${entries.length - builtInReplacementNames.size} 条包内人设，${pkg.roles.length} 个角色。`);
