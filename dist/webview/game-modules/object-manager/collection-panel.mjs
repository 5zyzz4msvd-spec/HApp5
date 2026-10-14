export function mountCollectionEditor(container, { runtime, objectRef, field, value }) {
  let original = structuredClone(value), trail = [], page = 0;
  const root = document.createElement("section"); container.append(root);
  const node = (tag, text = "") => { const item = document.createElement(tag); item.textContent = text; return item; };
  const at = (source, path) => path.reduce((item, key) => item[key], source);
  let notice;
  async function save(change) {
    const draft = structuredClone(original); change(at(draft, trail));
    try { await runtime.setElementValue(objectRef, field.id, draft, { expectedValue: original }); original = draft; render(); notice.textContent = "集合已保存。"; } catch (error) { notice.textContent = error.message; }
  }
  function button(text, work, disabled = false) { const item = node("button", text); item.type = "button"; item.disabled = disabled; item.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); work(); }); return item; }
  function input(parent, label, text, type = "text") { const wrap = node("label", label), control = node(type === "textarea" ? "textarea" : "input"); if (type !== "textarea") control.type = type; if (type === "checkbox") control.checked = Boolean(text); else control.value = text ?? ""; wrap.append(control); parent.append(wrap); return control; }
  function render() {
    root.replaceChildren(); const current = at(original, trail), keys = Object.keys(current); page = Math.min(page, Math.max(0, Math.ceil(keys.length / 4) - 1));
    if (trail.length) root.append(button("返回上一层集合", () => { trail.pop(); page = 0; render(); }));
    root.append(node("p", `${field.label}${trail.length ? " / " + trail.join(" / ") : ""} · ${keys.length} 项`));
    notice = node("p"); notice.className = "om-notice"; notice.setAttribute("role", "status"); root.append(notice);
    for (const key of keys.slice(page * 4, page * 4 + 4)) {
      const item = node("article"); item.className = "om-card"; root.append(item); const stored = current[key]; item.append(node("h3", key));
      if (stored && typeof stored === "object") item.append(button(`打开${Array.isArray(stored) ? "列表" : "记录"}（${Object.keys(stored).length} 项）`, () => { trail.push(key); page = 0; render(); }));
      else { const type = typeof stored === "number" ? "number" : typeof stored === "boolean" ? "checkbox" : "textarea", control = input(item, "值", stored, type); item.append(button("保存此项", () => void save((draft) => { draft[key] = type === "number" ? Number(control.value) : type === "checkbox" ? control.checked : control.value; }))); }
      item.append(button("移除此项", () => void save((draft) => { if (Array.isArray(draft)) draft.splice(Number(key), 1); else delete draft[key]; })));
    }
    const pager = node("div"); pager.className = "om-pager"; pager.append(button("上一页", () => { page -= 1; render(); }, page === 0), node("span", `${page + 1}/${Math.max(1, Math.ceil(keys.length / 4))}`), button("下一页", () => { page += 1; render(); }, (page + 1) * 4 >= keys.length)); root.append(pager);
    const tools = node("details"); tools.append(node("summary", "新增集合条目")); root.append(tools);
    const key = Array.isArray(current) ? null : input(tools, "条目名", "");
    const wrap = node("label", "条目类型"), type = node("select"); for (const [id, title] of [["text", "文本"], ["number", "数字"], ["boolean", "开关"], ["record", "嵌套记录"], ["list", "嵌套列表"]]) { const option = node("option", title); option.value = id; type.append(option); } wrap.append(type); tools.append(wrap);
    const text = input(tools, "初始值（记录/列表留空）", "");
    tools.append(button("添加条目", () => { const id = key?.value.trim(); if (key && (!id || ["__proto__", "constructor", "prototype"].includes(id) || Object.hasOwn(current, id))) { notice.textContent = "条目名为空、重复或不安全。"; return; } const stored = type.value === "record" ? {} : type.value === "list" ? [] : type.value === "number" ? Number(text.value) : type.value === "boolean" ? text.value === "true" : text.value; void save((draft) => { if (Array.isArray(draft)) draft.push(stored); else draft[id] = stored; }); }));
  }
  render(); return { destroy() { root.remove(); } };
}
