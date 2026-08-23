import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("public/frontends/hypnosis-app/assets/encounter");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compileScriptlets(label, value) {
  const text = String(value || "");
  if (!text.includes("<%")) return;
  assert(
    !/stat_data\.角色\.\[[^\]\r\n]+\]/u.test(text),
    `${label}: unresolved dynamic role placeholder in stat_data path`
  );
  const tagPattern = /<%[_=-]?([\s\S]*?)[_-]?%>/g;
  let source = "";
  let match = null;
  let lastIndex = 0;
  let count = 0;
  while ((match = tagPattern.exec(text))) {
    assert(!text.slice(lastIndex, match.index).includes("%>"), `${label}: stray %>`);
    source += String(match[1] || "") + "\n";
    lastIndex = tagPattern.lastIndex;
    count += 1;
  }
  assert(count > 0, `${label}: missing EJS close tag`);
  assert(!text.slice(lastIndex).includes("<%") && !text.slice(lastIndex).includes("%>"), `${label}: unclosed EJS tag`);
  try {
    Function("getvar", "print", source);
  } catch (error) {
    throw new Error(`${label}: ${error?.message || error}`);
  }
}

function leadingSpaces(value) {
  const text = String(value || "");
  let count = 0;
  while (count < text.length && text[count] === " ") count += 1;
  return count;
}

function extractTaggedBlock(value, suffix) {
  const target = String(suffix || "").trim();
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  let active = false;
  let found = false;
  const output = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!active && trimmed.startsWith("<") && trimmed.endsWith(">") && !trimmed.startsWith("</") && trimmed.includes(target)) {
      active = true;
      found = true;
      continue;
    }
    if (active && trimmed.startsWith("</") && trimmed.endsWith(">") && trimmed.includes(target)) break;
    if (active && leadingSpaces(line) === 0 && trimmed.startsWith("<") && trimmed.endsWith(">") && !trimmed.startsWith("</")) {
      if (trimmed.includes(target) || (target === "人设" && trimmed.includes("行为指导"))) break;
    }
    if (active) output.push(line);
  }
  return found ? output.join("\n").trim() : "";
}

function collectEjsStrings(value, label, output) {
  if (typeof value === "string") {
    if (value.includes("<%")) output.push([label, value]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEjsStrings(item, `${label}[${index}]`, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) collectEjsStrings(item, `${label}.${key}`, output);
}

const directories = await readdir(ROOT, { withFileTypes: true });
let packageCount = 0;
let roleCount = 0;
let ejsCount = 0;

for (const directory of directories) {
  if (!directory.isDirectory()) continue;
  const packagePath = path.join(ROOT, directory.name, "package.json");
  let pkg = null;
  try {
    pkg = JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  packageCount += 1;
  const strings = [];
  collectEjsStrings(pkg, directory.name, strings);
  for (const [label, text] of strings) compileScriptlets(label, text);
  ejsCount += strings.length;

  for (const [index, role] of (Array.isArray(pkg.roles) ? pkg.roles : []).entries()) {
    roleCount += 1;
    const name = String(role?.name || role?.角色名 || `role-${index + 1}`).trim();
    const raw = String(role?.personaContent || role?.personaEntry?.content || role?.persona || "");
    if (!raw) continue;
    const persona = extractTaggedBlock(raw, "人设");
    const behavior = extractTaggedBlock(raw, "行为指导");
    if (raw.includes("行为指导>")) {
      assert(behavior, `${directory.name}/${name}: behavior block was swallowed by persona parsing`);
      assert(!persona.includes("行为指导>"), `${directory.name}/${name}: persona block still contains behavior block`);
    }
    compileScriptlets(`${directory.name}/${name}/normalized-persona`, [
      `<${name}人设>`,
      persona,
      `</${name}人设>`,
      behavior ? `<${name}行为指导>\n${behavior}\n</${name}行为指导>` : ""
    ].filter(Boolean).join("\n"));
  }
}

assert(packageCount > 0 && roleCount > 0 && ejsCount > 0, "encounter EJS audit found no package data");
console.log(`Encounter EJS verified: ${packageCount} packages, ${roleCount} roles, ${ejsCount} EJS strings.`);
