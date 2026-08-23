#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_ROLE_NAMES = new Set(["西园寺爱丽莎", "犬冢夏美", "月咏深雪", "阿宅", "阿宅君"]);
const DEFAULT_PACKAGE_NAME = "邂逅世界书角色包";
const ENCOUNTER_FORMAT = "hypnoos-role-package";

function usage() {
  console.log(`Usage:
  node scripts/prepare-encounter-worldbook-package.mjs <worldbook.json> [--out <dir>] [--package-name <name>] [--images <dir>] [--zip <file>]

Notes:
  - Extracts {name}人设 (also accepts legacy [mvu_plot]{name}人设) and {name}变量 entries.
  - Excludes 西园寺爱丽莎 / 犬冢夏美 / 月咏深雪.
  - Preserves and reports order/depth/position/role/layout fields.
  - If --images is provided, files named by role name are linked into package.json and copied into the output folder.
`);
}

function parseArgs(argv) {
  const args = { input: "", out: "", packageName: DEFAULT_PACKAGE_NAME, images: "", zip: "" };
  const rest = [...argv];
  while (rest.length) {
    const item = rest.shift();
    if (!item) continue;
    if (item === "--help" || item === "-h") {
      args.help = true;
      continue;
    }
    if (item === "--out") args.out = rest.shift() || "";
    else if (item === "--package-name") args.packageName = rest.shift() || DEFAULT_PACKAGE_NAME;
    else if (item === "--images") args.images = rest.shift() || "";
    else if (item === "--zip") args.zip = rest.shift() || "";
    else if (!args.input) args.input = item;
    else throw new Error("Unknown argument: " + item);
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function writeText(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, String(value || ""), "utf8");
}

function safeName(name, fallback = "role") {
  const text = String(name || fallback).trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return text || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function worldEntryValues(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const direct = data.entries || data.entry || data.world_info || data.worldInfo || null;
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === "object") return Object.values(direct);
  const cardBook = data.data?.character_book?.entries || data.character_book?.entries;
  if (Array.isArray(cardBook)) return cardBook;
  if (cardBook && typeof cardBook === "object") return Object.values(cardBook);
  return [];
}

function entryTitle(entry) {
  return String(entry?.comment || entry?.name || entry?.extra?.comment || "");
}

function entryText(entry) {
  return [
    entryTitle(entry),
    ...asArray(entry?.key),
    ...asArray(entry?.keys),
    ...asArray(entry?.keysecondary),
    ...asArray(entry?.secondary_keys),
    entry?.content
  ].map((item) => String(item || "")).join("\n");
}

function entryNumber(entry, names) {
  for (const name of names) {
    const value = name.split(".").reduce((target, key) => target?.[key], entry);
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function entryOrder(entry) {
  return entryNumber(entry, ["insertion_order", "order", "position.order", "extensions.order"]);
}

function entryDepth(entry) {
  return entryNumber(entry, ["depth", "position.depth", "extensions.depth"]);
}

function entryRole(entry) {
  const value = entry?.role ?? entry?.extensions?.role ?? entry?.position?.role;
  if (value === "assistant") return 1;
  if (value === "user") return 2;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function entryPositionName(entry) {
  const raw = String(entry?.position || "").trim();
  if (raw && raw !== "[object Object]") return raw;
  const type = String(entry?.position?.type || "").trim();
  if (/after_character_definition/i.test(type)) return "after_char";
  if (/before_character_definition/i.test(type)) return "before_char";
  if (/after_author_note/i.test(type)) return "after_author_note";
  if (/before_author_note/i.test(type)) return "before_author_note";
  if (/after_example_messages/i.test(type)) return "after_example";
  if (/before_example_messages/i.test(type)) return "before_example";
  if (/at_depth/i.test(type)) return "at_depth";
  const extPosition = Number(entry?.extensions?.position);
  if (extPosition === 1) return "after_char";
  if (extPosition === 4) return "at_depth";
  return "before_char";
}

function extensionPositionValue(positionName, fallback) {
  const raw = String(positionName || "").trim();
  if (/after_char/i.test(raw)) return 1;
  if (/depth/i.test(raw)) return 4;
  if (Number.isFinite(Number(fallback))) return Number(fallback);
  return 0;
}

function layoutOf(entry) {
  const ext = entry?.extensions && typeof entry.extensions === "object" && !Array.isArray(entry.extensions) ? entry.extensions : {};
  return {
    title: entryTitle(entry),
    insertion_order: entry?.insertion_order ?? null,
    order: entry?.order ?? null,
    resolvedOrder: entryOrder(entry),
    depth: entry?.depth ?? null,
    resolvedDepth: entryDepth(entry),
    position: entryPositionName(entry),
    role: entryRole(entry),
    probability: entry?.probability ?? ext.probability ?? null,
    useProbability: entry?.useProbability ?? ext.useProbability ?? null,
    constant: entry?.constant ?? null,
    selective: entry?.selective ?? null,
    disable: entry?.disable ?? entry?.disabled ?? null,
    extensions: Object.fromEntries(Object.entries(ext).filter(([key]) => [
      "position",
      "depth",
      "role",
      "probability",
      "useProbability",
      "exclude_recursion",
      "prevent_recursion",
      "delay_until_recursion",
      "scan_depth",
      "match_whole_words",
      "case_sensitive",
      "group",
      "group_override",
      "group_weight"
    ].includes(key)))
  };
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeEntryKeys(entry, name) {
  const keys = asArray(entry?.key).length ? asArray(entry.key) : asArray(entry?.keys);
  const normalized = keys.map((item) => String(item || "").trim()).filter(Boolean);
  if (!normalized.length && name) normalized.push(name);
  return normalized;
}

function cloneWorldbookEntry(entry, fallbackComment, name) {
  const cloned = cloneJson(entry) || {};
  delete cloned.uid;
  delete cloned.id;
  cloned.comment = String(cloned.comment || cloned.name || fallbackComment || "");
  cloned.content = String(cloned.content || "");
  const keys = normalizeEntryKeys(cloned, name);
  cloned.key = keys;
  cloned.keys = keys;
  if (!Array.isArray(cloned.keysecondary)) cloned.keysecondary = asArray(cloned.secondary_keys);
  if (!Array.isArray(cloned.secondary_keys)) cloned.secondary_keys = asArray(cloned.keysecondary);
  return cloned;
}

function applyTemplateLayout(entry, template) {
  if (!template) return entry;
  const next = cloneWorldbookEntry(entry, entry?.comment, entry?.comment);
  const sourceExt = template.extensions && typeof template.extensions === "object" && !Array.isArray(template.extensions) ? template.extensions : {};
  const nextExt = next.extensions && typeof next.extensions === "object" && !Array.isArray(next.extensions) ? { ...next.extensions } : {};
  for (const key of Object.keys(sourceExt)) {
    if (sourceExt[key] === undefined) continue;
    nextExt[key] = Array.isArray(sourceExt[key]) ? sourceExt[key].slice() : sourceExt[key];
  }
  const order = entryOrder(template);
  if (Number.isFinite(order)) {
    next.insertion_order = order;
    next.order = order;
  }
  const depth = entryDepth(template);
  if (Number.isFinite(depth)) {
    next.depth = depth;
    nextExt.depth = depth;
  }
  const role = entryRole(template);
  next.role = role;
  nextExt.role = role;
  const position = entryPositionName(template);
  next.position = position;
  nextExt.position = extensionPositionValue(position, nextExt.position);
  for (const key of ["constant", "selective", "enabled", "disable", "disabled", "use_regex", "probability", "useProbability"]) {
    if (template[key] !== undefined) next[key] = template[key];
  }
  next.extensions = nextExt;
  return next;
}

function classifyEntry(entry) {
  const title = entryTitle(entry).trim();
  let match = title.match(/^(?:\[mvu_plot\])?(.+?)人设$/);
  if (match) return { kind: "persona", name: match[1].trim() };
  match = title.match(/^\[mvu_update\](.+?)变量$/);
  if (match) return { kind: "variable", name: match[1].trim() };
  return null;
}

function findDefaultTemplates(entries) {
  const result = { persona: null, variable: null, defaults: [] };
  for (const entry of entries) {
    const info = classifyEntry(entry);
    if (!info || !DEFAULT_ROLE_NAMES.has(info.name)) continue;
    result.defaults.push({ name: info.name, kind: info.kind, layout: layoutOf(entry) });
    if (!result[info.kind]) result[info.kind] = entry;
  }
  return result;
}

function extractRoles(entries) {
  const roles = new Map();
  for (const entry of entries) {
    const info = classifyEntry(entry);
    if (!info || DEFAULT_ROLE_NAMES.has(info.name)) continue;
    const current = roles.get(info.name) || { name: info.name };
    current[info.kind + "Entry"] = entry;
    roles.set(info.name, current);
  }
  return Array.from(roles.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function compactText(text, limit = 260) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > limit ? value.slice(0, limit - 1) + "…" : value;
}

function personaIntro(content) {
  const text = String(content || "");
  const interesting = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^<\/?.+>$/.test(line))
    .filter((line) => /外貌|appearance|身高|体重|三围|头发|面部|上衣|下衣|identity|personality|title|public|hidden|overview|style|attire/i.test(line))
    .slice(0, 10)
    .join(" ");
  return compactText(interesting || text, 360);
}

function imagePromptForRole(role) {
  const persona = role.personaEntry?.content || "";
  const summary = personaIntro(persona);
  return [
    role.name + "：",
    "证件照样式，腹部以上构图，纯白或浅灰背景，统一二次元半写实精致赛璐璐风，干净线稿，柔和室内光，角色正面或轻微三分之二视角，表情和气质严格按人设，不要复杂背景，不要多人，不要文字。",
    "角色人设外观要点：" + summary
  ].join("");
}

function findRoleImage(imagesDir, name) {
  if (!imagesDir) return null;
  if (!fs.existsSync(imagesDir)) return null;
  const files = fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const safe = safeName(name);
  const found = files.find((file) => {
    const ext = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return false;
    const base = path.basename(file, ext);
    return base === name || base === safe || base.includes(name) || name.includes(base);
  });
  return found ? path.join(imagesDir, found) : null;
}

function buildPackage(roles, options, templates, outDir) {
  const manifestRoles = [];
  const report = {
    source: path.basename(options.input),
    packageName: options.packageName,
    excludedDefaults: Array.from(DEFAULT_ROLE_NAMES),
    templateLayouts: {
      variable: templates.variable ? layoutOf(templates.variable) : null,
      persona: templates.persona ? layoutOf(templates.persona) : null,
      defaultEntries: templates.defaults
    },
    roles: []
  };
  for (const role of roles) {
    const roleDir = path.join(outDir, "roles", safeName(role.name));
    const originalVariable = role.variableEntry ? cloneWorldbookEntry(role.variableEntry, role.name + "变量", role.name) : null;
    const originalPersona = role.personaEntry ? cloneWorldbookEntry(role.personaEntry, role.name + "人设", role.name) : null;
    const variableEntry = originalVariable ? applyTemplateLayout(originalVariable, templates.variable) : null;
    if (variableEntry) {
      variableEntry.position = "at_depth";
      variableEntry.depth = 0;
      variableEntry.extensions = { ...(variableEntry.extensions || {}), position: 4, depth: 0, role: 0 };
    }
    const personaEntry = originalPersona ? applyTemplateLayout(originalPersona, templates.persona) : null;
    const imagePath = findRoleImage(options.images, role.name);
    let imageRel = "";
    if (imagePath) {
      imageRel = "roles/" + safeName(role.name) + "/" + path.basename(imagePath);
      ensureDir(roleDir);
      fs.copyFileSync(imagePath, path.join(outDir, imageRel));
    }
    if (originalVariable) writeJson(path.join(roleDir, "variable-entry.original.json"), originalVariable);
    if (originalPersona) writeJson(path.join(roleDir, "persona-entry.original.json"), originalPersona);
    if (variableEntry) writeJson(path.join(roleDir, "variable-entry.encounter-layout.json"), variableEntry);
    if (personaEntry) writeJson(path.join(roleDir, "persona-entry.encounter-layout.json"), personaEntry);
    const prompt = imagePromptForRole(role);
    const roleJson = {
      id: "role-" + safeName(role.name),
      name: role.name,
      aliases: "",
      intro: compactText(personaIntro(originalPersona?.content || originalVariable?.content || role.name), 180),
      variables: originalVariable?.content || "",
      variableEntry: variableEntry || undefined,
      personaEntry: personaEntry || undefined,
      personaContent: personaEntry?.content || "",
      image: imageRel || undefined
    };
    writeJson(path.join(roleDir, "role.json"), roleJson);
    writeText(path.join(roleDir, "image-prompt.txt"), prompt + "\n");
    manifestRoles.push(roleJson);
    report.roles.push({
      name: role.name,
      hasVariableEntry: Boolean(originalVariable),
      hasPersonaEntry: Boolean(originalPersona),
      image: imageRel || null,
      originalLayouts: {
        variable: originalVariable ? layoutOf(originalVariable) : null,
        persona: originalPersona ? layoutOf(originalPersona) : null
      },
      encounterLayouts: {
        variable: variableEntry ? layoutOf(variableEntry) : null,
        persona: personaEntry ? layoutOf(personaEntry) : null
      }
    });
  }
  const manifest = {
    format: ENCOUNTER_FORMAT,
    version: 1,
    name: options.packageName,
    intro: "由静态世界书 JSON 抽取生成的邂逅角色包草稿。图片可在打包前补充。",
    price: manifestRoles.length * 4,
    variableWorldbook: "人物变量世界书",
    personaWorldbook: "人设世界书",
    roles: manifestRoles
  };
  writeJson(path.join(outDir, "package.json"), manifest);
  writeJson(path.join(outDir, "layout", "worldbook-layout-report.json"), report);
  writeText(path.join(outDir, "prompts", "role-image-prompts-oneline.txt"), roles.map(imagePromptForRole).join("\n") + "\n");
  writeText(path.join(outDir, "README.md"), [
    "# 邂逅角色包草稿",
    "",
    "- `package.json`：可被邂逅导入的角色包草稿。",
    "- `roles/*/persona-entry.encounter-layout.json`：套用默认三人模板后的角色人设世界书条目。",
    "- `roles/*/variable-entry.encounter-layout.json`：套用默认三人模板后的角色变量世界书条目；前端购买时变量 entry 仍会按角色名固定生成，这里主要用于审查和保留布局。",
    "- `layout/worldbook-layout-report.json`：记录默认模板、原始条目与导出条目的 order/depth/position/role/extensions。",
    "- `prompts/role-image-prompts-oneline.txt`：每个角色一行图片提示词。",
    "",
    "补图后可运行同一个脚本加 `--images <图片目录> --zip <输出.zip>` 重新生成带图片的 zip。"
  ].join("\n") + "\n");
  return { manifest, report };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function listFiles(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full, base));
    else if (entry.isFile()) result.push({ full, name: path.relative(base, full).split(path.sep).join("/") });
  }
  return result;
}

function createZipFromDirectory(sourceDir, outputZip) {
  const files = listFiles(sourceDir)
    .filter((file) => file.name === "package.json" || /^roles\/.+\.(png|jpg|jpeg|webp)$/i.test(file.name) || /^cover\.(png|jpg|jpeg|webp)$/i.test(file.name));
  const chunks = [];
  const central = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();
  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const data = fs.readFileSync(file.full);
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), nameBuffer, data
    ]);
    chunks.push(local);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBuffer
    ]));
    offset += local.length;
  }
  const centralStart = offset;
  const centralData = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralData.length), u32(centralStart), u16(0)
  ]);
  ensureDir(path.dirname(outputZip));
  fs.writeFileSync(outputZip, Buffer.concat([...chunks, centralData, end]));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  args.input = path.resolve(args.input);
  args.out = path.resolve(args.out || path.join("tmp", "encounter-worldbook-package"));
  if (args.images) args.images = path.resolve(args.images);
  if (args.zip) args.zip = path.resolve(args.zip);
  const entries = worldEntryValues(readJson(args.input));
  if (!entries.length) throw new Error("No worldbook entries found in " + args.input);
  const templates = findDefaultTemplates(entries);
  const roles = extractRoles(entries);
  ensureDir(args.out);
  const { report } = buildPackage(roles, args, templates, args.out);
  if (args.zip) createZipFromDirectory(args.out, args.zip);
  console.log("Extracted roles: " + roles.length);
  console.log("Output: " + args.out);
  console.log("Layout report: " + path.join(args.out, "layout", "worldbook-layout-report.json"));
  console.log("Image prompts:");
  for (const role of roles) console.log("- " + imagePromptForRole(role));
  const missing = report.roles.filter((role) => !role.hasVariableEntry || !role.hasPersonaEntry);
  if (missing.length) {
    console.warn("Missing counterpart entries: " + missing.map((role) => role.name).join("、"));
  }
  if (args.zip) console.log("Zip: " + args.zip);
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
