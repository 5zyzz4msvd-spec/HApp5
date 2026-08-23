import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const frontend = await readFile(
  new URL("../public/frontends/hypnosis-app/st-load-inline.html", import.meta.url),
  "utf8"
);
const start = frontend.indexOf("  function cleanActionFoldBody(value) {");
const end = frontend.indexOf("  function renderActionFoldCompatibility(targetDocument) {", start);
assert(start >= 0 && end > start, "generated frontend is missing the action-fold compatibility implementation");
const implementation = frontend.slice(start, end);

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName || "").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = {};
    this.style = { cssText: "" };
    this._text = "";
    this.open = false;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this._text = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener() {}

  querySelector(selector) {
    const matches = (node) => {
      const attribute = /^\[([^=]+)="([^"]+)"\]$/.exec(selector);
      if (attribute) return node.attributes[attribute[1]] === attribute[2];
      if (selector === "aside") return node.tagName === "ASIDE";
      return false;
    };
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child)) return child;
        const nested = visit(child);
        if (nested) return nested;
      }
      return null;
    };
    return visit(this);
  }

  querySelectorAll(selector) {
    const found = [];
    const attribute = /^\[([^=]+)="([^"]+)"\]$/.exec(selector);
    const matches = (node) => {
      if (attribute) return node.attributes[attribute[1]] === attribute[2];
      return selector === "aside" && node.tagName === "ASIDE";
    };
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  get textContent() {
    if (this.children.length) return this.children.map((child) => child.textContent).join("");
    return this._text;
  }

  set textContent(value) {
    this.children = [];
    this._text = String(value == null ? "" : value);
  }
}

function createFixture(rawText, visibleText) {
  const elements = {};
  const document = {
    body: { scrollHeight: 120 },
    defaultView: null,
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    getElementById(id) {
      return elements[id] || null;
    }
  };
  document.defaultView = { parent: null };
  document.defaultView.parent = document.defaultView;
  const raw = new FakeElement("script", document);
  raw.textContent = rawText;
  elements.rawData = raw;
  const content = new FakeElement("div", document);
  content.textContent = visibleText;
  elements.userInputContent = content;
  return { document, content };
}

const context = {
  console,
  setTimeout,
  window: { setTimeout },
  ACTION_FOLD_MARKER: 'data-king-game-action-fold="v2"',
  ACTION_FOLD_BODY_START: "<!--KGAF_BODY_START-->",
  ACTION_FOLD_BODY_END: "<!--KGAF_BODY_END-->",
  ACTION_FOLD_OUTER_RAW_ID: "rawData",
  ACTION_FOLD_OUTER_CONTENT_ID: "userInputContent"
};
context.globalThis = context;
vm.runInNewContext(
  `${implementation}\nglobalThis.__repairWrappedActionFold = repairWrappedActionFold;`,
  context,
  { filename: "generated-action-fold-compat.js" }
);
const repair = context.__repairWrappedActionFold;
assert.equal(typeof repair, "function");

const semanticBody = [
  "<本轮执行边界>必须先结算暂存操作并停在直接后果。</本轮执行边界>",
  "<变量权限>规则：AI只执行明确列入AI写的变量。</变量权限>",
  "<AI提醒>本轮没有催眠操作。</AI提醒>",
  "<相关变量>/系统/当前时间：前端写</相关变量>",
  "<时钟>",
  "<操作项><操作名>测试操作一</操作名><操作内容>测试内容一</操作内容></操作项>",
  "<操作项><操作名>测试操作二</操作名><操作内容>测试内容二</操作内容></操作项>",
  "</时钟>"
].join("\n");
const semanticFixture = createFixture(
  `<本轮用户输入>玩家前文\n<本轮操作>${semanticBody}</本轮操作>\n玩家后文</本轮用户输入>`,
  `<本轮操作>${semanticBody}</本轮操作>`
);
assert.equal(repair(semanticFixture.document), true);
const semanticDetails = semanticFixture.content.querySelector('[data-king-game-action-fold="v2"]');
assert(semanticDetails, "semantic operation block was not rebuilt as details");
assert.equal(semanticDetails.open, false);
const semanticActionBody = semanticDetails.querySelector('[data-king-game-action-body="v2"]');
assert.equal(semanticActionBody.querySelectorAll('[data-king-game-action-permission="v2"]').length, 1);
assert.equal(semanticActionBody.querySelectorAll('[data-king-game-action-notice="v2"]').length, 1);
assert.equal(semanticActionBody.querySelectorAll('[data-king-game-action-section="v2"]').length, 2);
assert.equal(semanticActionBody.querySelectorAll('[data-king-game-action-item="v2"]').length, 2);
assert(semanticActionBody.querySelectorAll('[data-king-game-action-section="v2"]').every((node) => node.open === false));
assert(semanticActionBody.querySelectorAll('[data-king-game-action-item="v2"]').every((node) => node.open === false));
assert(semanticFixture.content.textContent.includes("玩家前文"));
assert(semanticFixture.content.textContent.includes("玩家后文"));
assert.equal((semanticFixture.content.textContent.match(/测试内容一/g) || []).length, 1);
assert.equal((semanticFixture.content.textContent.match(/测试内容二/g) || []).length, 1);
assert.equal((semanticFixture.content.textContent.match(/必须先结算暂存操作并停在直接后果/g) || []).length, 1);

const markedItem = (title, body) =>
  `<!--KGAF_ITEM_V2_START--><details><summary><span><!--KGAF_ITEM_V2_TITLE_START-->${title}<!--KGAF_ITEM_V2_TITLE_END--></span></summary><div><!--KGAF_ITEM_V2_BODY_START-->${body}<!--KGAF_ITEM_V2_BODY_END--></div></details><!--KGAF_ITEM_V2_END-->`;
const markerBody = [
  "<变量权限>只允许AI改动AI写路径。</变量权限>",
  "<!--KGAF_AI_V2_START--><aside><span><!--KGAF_AI_V2_BODY_START-->不要重复前端结算。<!--KGAF_AI_V2_BODY_END--></span></aside><!--KGAF_AI_V2_END-->",
  "<!--KGAF_SECTION_V2_START--><details><summary><span><!--KGAF_SECTION_V2_TITLE_START-->时钟<!--KGAF_SECTION_V2_TITLE_END--></span></summary>",
  `<div><!--KGAF_SECTION_V2_BODY_START-->${markedItem("推进时间", "增加15分钟")}${markedItem("更新事件", "写入午休")}<!--KGAF_SECTION_V2_BODY_END--></div>`,
  "</details><!--KGAF_SECTION_V2_END-->"
].join("");
const markerHtml = `<details data-king-game-action-fold="v2"><div><!--KGAF_BODY_START-->${markerBody}<!--KGAF_BODY_END--></div></details>`;
const markerFixture = createFixture(
  `<本轮用户输入>说明文字\n${markerHtml}\n收尾文字</本轮用户输入>`,
  markerHtml
);
assert.equal(repair(markerFixture.document), true);
assert(markerFixture.content.querySelector('[data-king-game-action-fold="v2"]'));
assert(markerFixture.content.textContent.includes("说明文字"));
assert(markerFixture.content.textContent.includes("收尾文字"));
assert.equal(markerFixture.content.querySelectorAll('[data-king-game-action-notice="v2"]').length, 1);
assert.equal(markerFixture.content.querySelectorAll('[data-king-game-action-section="v2"]').length, 1);
assert.equal(markerFixture.content.querySelectorAll('[data-king-game-action-item="v2"]').length, 2);
assert.equal((markerFixture.content.textContent.match(/增加15分钟/g) || []).length, 1);
assert.equal((markerFixture.content.textContent.match(/写入午休/g) || []).length, 1);

const malformedBody = "<!--KGAF_ITEM_V2_START--><script>不可信节点</script>";
const malformedHtml = `<details data-king-game-action-fold="v2"><div><!--KGAF_BODY_START-->${malformedBody}<!--KGAF_BODY_END--></div></details>`;
const malformedFixture = createFixture(
  `<本轮用户输入>${malformedHtml}</本轮用户输入>`,
  malformedHtml
);
assert.equal(repair(malformedFixture.document), true);
assert.equal(malformedFixture.content.querySelectorAll('[data-king-game-action-item="v2"]').length, 0);
assert(malformedFixture.content.textContent.includes("不可信节点"));

const historyFixture = createFixture(
  `<本轮用户输入><本轮操作>${semanticBody}</本轮操作></本轮用户输入>`,
  ""
);
assert.equal(repair(historyFixture.document), false);
assert.equal(historyFixture.content.querySelector('[data-king-game-action-fold="v2"]'), null);
assert.equal(historyFixture.content.textContent, "");

console.log("Action-fold outer-wrapper compatibility verification passed.");
