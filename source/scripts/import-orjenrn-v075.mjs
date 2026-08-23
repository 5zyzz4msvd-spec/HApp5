import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  buildOrjenrnInitialVariables,
  refreshOrjenrnRoleInitialVariables
} from "./orjenrn-initial-variables.mjs";

const root = process.cwd();
const inputArg = String(process.argv[2] || "").trim();
if (!inputArg) {
  throw new Error("用法: node scripts/import-orjenrn-v075.mjs <改v0.75.json 路径>");
}
const inputPath = path.resolve(inputArg);
const packagePath = path.join(root, "public/frontends/hypnosis-app/assets/encounter/orjenrn/package.json");
const filteredSourcePath = path.join(root, "public/frontends/hypnosis-app/assets/encounter/orjenrn/polish-v0.75.source.json");

const branchKeepNames = new Set(["犬冢穗波", "天城纱良", "弥留子", "阿宅女性化"]);
const branchReplaceNames = new Set(["九鬼真白"]);
const v075EncounterNames = new Set(["凤条瑠衣", "浅仓步美", "尼子纯", "德川喜广", "鹰司千代", "九条凛音", "白鸟结衣"]);
const specialLocationRolePathOwners = new Map([
  ["白鹤茶会", "鹰司千代"]
]);

function entryComment(entry) {
  return String(entry?.comment || entry?.name || "").trim();
}

function canonicalComment(value) {
  return String(value || "")
    .trim()
    .replace(/^(\[mvu_(?:plot|update)\])\s*/u, "$1");
}

function personaRoleName(entry) {
  const comment = canonicalComment(entryComment(entry));
  const match = comment.match(/^\[mvu_plot\](.+?)人设$/u);
  return match ? String(match[1] || "").trim() : "";
}

function isLocationEntry(entry) {
  const comment = canonicalComment(entryComment(entry));
  return comment.startsWith("[mvu_plot]") && !/人设$/u.test(comment);
}

function entryKeys(entry, fallback = "") {
  return Array.from(new Set([
    fallback,
    ...(Array.isArray(entry?.key) ? entry.key : []),
    ...(Array.isArray(entry?.keys) ? entry.keys : [])
  ].map((value) => String(value || "").trim()).filter(Boolean)));
}

function cloneEntry(entry, comment = entryComment(entry)) {
  const clone = structuredClone(entry);
  const normalizedComment = canonicalComment(comment);
  clone.comment = normalizedComment;
  if (!clone.name || /^\[mvu_/u.test(String(clone.name || ""))) clone.name = normalizedComment;
  clone.key = entryKeys(clone);
  clone.keys = clone.key.slice();
  clone.keysecondary = Array.isArray(clone.keysecondary)
    ? clone.keysecondary.slice()
    : Array.isArray(clone.secondary_keys)
      ? clone.secondary_keys.slice()
      : [];
  clone.secondary_keys = clone.keysecondary.slice();
  clone.disable = false;
  clone.disabled = false;
  clone.enabled = true;
  return clone;
}

function variableRenderer(roleName) {
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
}

function makeRole(entry, roleName) {
  const personaEntry = cloneEntry(entry, `[mvu_plot]${roleName}人设`);
  const keys = entryKeys(personaEntry, roleName);
  const variables = variableRenderer(roleName);
  return {
    id: `orjenrn-polished-role-${roleName}`,
    name: roleName,
    aliases: keys.filter((key) => key !== roleName),
    intro: `orjenrn 润色版 · ${roleName}`,
    encounterPrompt: "",
    variables,
    variableEntry: {
      key: keys,
      keys,
      keysecondary: [],
      secondary_keys: [],
      comment: `[mvu_update]${roleName}变量`,
      content: variables,
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
    personaEntry,
    personaContent: String(personaEntry.content || ""),
    image: "",
    initialVariables: buildOrjenrnInitialVariables(roleName, personaEntry.content)
  };
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const entries = Array.isArray(input?.entries) ? input.entries : Object.values(input?.entries || {});
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const existingPolishedNames = new Set((pkg.roles || []).map((role) => String(role?.name || "").trim()).filter(Boolean));

const newPersonaEntries = entries.filter((entry) => {
  const roleName = personaRoleName(entry);
  return roleName && v075EncounterNames.has(roleName);
});
const branchEntries = entries
  .filter((entry) => branchReplaceNames.has(personaRoleName(entry)))
  .map((entry) => cloneEntry(entry, `[mvu_plot]${personaRoleName(entry)}人设`));
const specialLocationEntries = entries
  .filter(isLocationEntry)
  .map((entry) => {
    const displayName = canonicalComment(entryComment(entry)).replace(/^\[mvu_plot\]/u, "").trim();
    const canonical = `[mvu_plot]${displayName}`;
    const normalizedEntry = cloneEntry(entry, canonical);
    const rolePathOwner = specialLocationRolePathOwners.get(displayName);
    if (rolePathOwner && typeof normalizedEntry.content === "string") {
      normalizedEntry.content = normalizedEntry.content.replace(
        /stat_data\.角色\.\[角色名\]/gu,
        `stat_data.角色.${rolePathOwner}`
      );
    }
    return {
      id: `orjenrn-v075-${createHash("sha1").update(canonical).digest("hex").slice(0, 10)}`,
      kind: "special-location",
      displayName,
      canonicalComment: canonical,
      keys: entryKeys(entry, displayName),
      entry: normalizedEntry
    };
  });

for (const entry of newPersonaEntries) {
  const roleName = personaRoleName(entry);
  if (!pkg.roles.some((role) => String(role?.name || "").trim() === roleName)) {
    pkg.roles.push(makeRole(entry, roleName));
  }
}

for (const role of pkg.roles || []) refreshOrjenrnRoleInitialVariables(role);

const retainedBranchEntries = (Array.isArray(pkg.branchPersonaEntries) ? pkg.branchPersonaEntries : [])
  .filter((entry) => !branchReplaceNames.has(personaRoleName(entry)));
pkg.branchPersonaEntries = retainedBranchEntries.concat(branchEntries);
pkg.specialLocationEntries = specialLocationEntries;
pkg.polishSourceVersion = "v0.75";

const filteredSource = {
  version: "v0.75",
  rejectedExistingPersonaNames: entries
    .map(personaRoleName)
    .filter((name) => name
      && !v075EncounterNames.has(name)
      && !branchReplaceNames.has(name)
      && (existingPolishedNames.has(name) || branchKeepNames.has(name))),
  newPersonaEntries: newPersonaEntries.map((entry) => cloneEntry(entry, `[mvu_plot]${personaRoleName(entry)}人设`)),
  branchPersonaEntries: branchEntries,
  specialLocationEntries
};

fs.writeFileSync(filteredSourcePath, JSON.stringify(filteredSource, null, 2) + "\n");
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

console.log(JSON.stringify({
  source: inputPath,
  rejectedDuplicatePersonas: filteredSource.rejectedExistingPersonaNames.length,
  newEncounterPersonas: newPersonaEntries.map(personaRoleName),
  branchPersonaOverrides: branchEntries.map(personaRoleName),
  specialLocations: specialLocationEntries.map((item) => item.displayName)
}, null, 2));
