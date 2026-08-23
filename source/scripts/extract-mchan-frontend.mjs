import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CARD = "public/cards/催眠app二改MVU v2.0.png";
const DEFAULT_OUTPUT = "public/frontends/mchan/index.html";

const cardPath = process.argv[2] || DEFAULT_CARD;
const output = process.argv[3] || DEFAULT_OUTPUT;
const LOCAL_VENDOR = {
  vueGlobal: "../../vendor/vue.global.prod.js",
  jqueryGlobal: "../../vendor/jquery.min.js",
  vueEsm: "../../vendor/vue.mjs",
  jqueryEsm: "../../vendor/jquery.mjs"
};

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

function parsePngTextChunks(bytes) {
  const chunks = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const len = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    if (type === "tEXt") {
      const zero = data.indexOf(0);
      if (zero >= 0) {
        chunks.push({
          key: data.subarray(0, zero).toString("latin1"),
          value: data.subarray(zero + 1).toString("latin1")
        });
      }
    }
    offset += 12 + len;
    if (type === "IEND") break;
  }
  return chunks;
}

function extractCard(bytes) {
  const chunks = parsePngTextChunks(bytes);
  const payload = chunks.find((chunk) => chunk.key === "ccv3") || chunks.find((chunk) => chunk.key === "chara");
  if (!payload) throw new Error("No chara/ccv3 metadata found.");
  return JSON.parse(Buffer.from(payload.value, "base64").toString("utf8"));
}

function patchMchanHtml(html) {
  let outputHtml = String(html || "");
  if (!/^<!doctype/i.test(outputHtml)) outputHtml = `<!doctype html>\n<html>\n${outputHtml}\n</html>`;
  const imports = [];
  if (outputHtml.includes("const o=Vue") && !outputHtml.includes("const Vue = globalThis.Vue;")) {
    imports.push(`const Vue = globalThis.Vue;`);
  }
  if (/\$(?:\s*\(|\.)/.test(outputHtml) && !outputHtml.includes("const $ = globalThis.jQuery || globalThis.$;")) {
    imports.push(`const $ = globalThis.jQuery || globalThis.$;`);
    imports.push(`globalThis.$ = globalThis.$ || $;`);
    imports.push(`globalThis.jQuery = globalThis.jQuery || $;`);
  }
  if (!outputHtml.includes("__ST_MCHAN_WORKBENCH_RUNTIME__")) {
    imports.push(previewRuntime());
  }
  if (imports.length) {
    outputHtml = injectClassicVendorScripts(outputHtml);
    outputHtml = outputHtml.replace(
      /<script(\s+type=["']module["'][^>]*)>/i,
      `<script$1>${imports.join("\n")}\n`
    );
  }
  return outputHtml
    .replaceAll("https://testingcf.jsdelivr.net/npm/vue@3/+esm", LOCAL_VENDOR.vueEsm)
    .replaceAll("https://cdn.jsdelivr.net/npm/vue@3/+esm", LOCAL_VENDOR.vueEsm)
    .replaceAll("https://testingcf.jsdelivr.net/npm/jquery/+esm", LOCAL_VENDOR.jqueryEsm)
    .replaceAll("https://cdn.jsdelivr.net/npm/jquery/+esm", LOCAL_VENDOR.jqueryEsm);
}

function injectClassicVendorScripts(html) {
  let outputHtml = html;
  const tags = [];
  if (!outputHtml.includes(LOCAL_VENDOR.vueGlobal)) {
    tags.push(`<script src="${LOCAL_VENDOR.vueGlobal}"></script>`);
  }
  if (!outputHtml.includes(LOCAL_VENDOR.jqueryGlobal)) {
    tags.push(`<script src="${LOCAL_VENDOR.jqueryGlobal}"></script>`);
  }
  if (!tags.length) return outputHtml;
  return outputHtml.replace(/<script(\s+type=["']module["'][^>]*)>/i, `${tags.join("")}<script$1>`);
}

function previewRuntime() {
  return `
const __ST_MCHAN_WORKBENCH_RUNTIME__ = true;
globalThis.SillyTavern = globalThis.SillyTavern || {
  getCurrentChatId: () => "workbench-preview",
  getContext: () => ({ chat: [], characterId: "workbench-preview", name1: "User", name2: "Character" })
};
const toastr = globalThis.toastr = globalThis.toastr || {
  success: (message) => console.info("[MChan]", message),
  warning: (message) => console.warn("[MChan]", message),
  error: (message) => console.error("[MChan]", message)
};
const errorCatched = globalThis.errorCatched = globalThis.errorCatched || ((fn) => (...args) => {
  try {
    const result = fn(...args);
    if (result?.catch) result.catch((error) => toastr.error(error?.message || String(error)));
    return result;
  } catch (error) {
    toastr.error(error?.message || String(error));
    return undefined;
  }
});
const tavern_events = globalThis.tavern_events = globalThis.tavern_events || {
  MESSAGE_UPDATED: "message_updated",
  MESSAGE_SWIPED: "message_swiped",
  GENERATION_ENDED: "generation_ended",
  CHAT_CHANGED: "chat_changed"
};
const eventOn = globalThis.eventOn = globalThis.eventOn || (() => {});
const triggerSlash = globalThis.triggerSlash = globalThis.triggerSlash || (async (command) => {
  globalThis.__ST_MCHAN_LAST_COMMAND__ = command;
  return true;
});
globalThis.__ST_MCHAN_CHAT__ = globalThis.__ST_MCHAN_CHAT__ || [{ message_id: 0, role: "assistant", message: "" }];
const getCurrentMessageId = globalThis.getCurrentMessageId = globalThis.getCurrentMessageId || (() => 0);
const getChatMessages = globalThis.getChatMessages = globalThis.getChatMessages || ((messageId = -1) => {
  const chat = globalThis.__ST_MCHAN_CHAT__;
  if (messageId === -1) return chat.slice(-1);
  return chat.filter((message) => Number(message.message_id) === Number(messageId));
});
const createChatMessages = globalThis.createChatMessages = globalThis.createChatMessages || (async (messages = []) => {
  const chat = globalThis.__ST_MCHAN_CHAT__;
  for (const message of messages) {
    chat.push({ message_id: chat.length, role: message.role || "user", message: message.message || "" });
  }
  return true;
});
`;
}

const bytes = await readFile(cardPath);
const card = extractCard(bytes);
const scripts = card.data?.extensions?.regex_scripts || [];
const mchan = scripts.find((script) => script.scriptName === "匿名版");
if (!mchan?.replaceString) throw new Error("No 匿名版 regex frontend found.");

const html = patchMchanHtml(stripCodeFence(mchan.replaceString));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);

console.log(`Extracted MChan frontend: ${cardPath} -> ${output}`);
console.log(`Size: ${Math.round(html.length / 1024)} KB`);
