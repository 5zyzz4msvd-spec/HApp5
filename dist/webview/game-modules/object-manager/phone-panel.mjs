import { normalizeCharacter, normalizeLocation } from "./contracts.mjs";
import { mountObjectStructurePanel } from "./object-structure-panel.mjs";
import { importEncounterCharacter } from "./encounter-import.mjs";

export async function mountPhoneObjectPanel(container, { runtime, tab = "tasks", roleName = "", encounterRole = null, locationId = "", exportChat = null, onSpecialOpen = null, onChanged = () => {} }) {
  const page = document.createElement("div"); page.className = "om-phone";
  const style = document.createElement("style");
  style.textContent = `.om-phone{height:100%;display:flex;flex-direction:column;gap:10px;color:inherit;font:14px system-ui,sans-serif}.om-phone *{box-sizing:border-box}.om-phone button,.om-phone input,.om-phone textarea,.om-phone select{font:inherit;color:inherit}.om-phone button{border:1px solid currentColor;border-radius:6px;padding:7px 10px;background:transparent;cursor:pointer}.om-phone button:disabled{opacity:.4;cursor:default}.om-phone input,.om-phone textarea,.om-phone select{width:100%;background:rgba(0,0,0,.15);border:1px solid #697080;border-radius:6px;padding:8px}.om-phone textarea{min-height:78px;resize:vertical}.om-phone .om-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:none}.om-phone .om-bar select{flex:1;min-width:120px;width:auto}.om-phone .om-list{flex:1;min-height:0;overflow:auto;overflow-anchor:none}.om-phone .om-card{border:1px solid #687183;border-radius:8px;padding:12px;margin-bottom:10px;background:rgba(255,255,255,.035)}.om-phone .om-card h3{margin:0 0 6px;font-size:15px}.om-phone .om-card p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}.om-phone .om-small{font-size:12px;opacity:.75}.om-phone .om-notice{flex:none;min-height:1.3em;font-size:12px;color:#ddab75}.om-phone .om-pager{display:flex;align-items:center;justify-content:space-between;flex:none}.om-phone .om-active{background:#b83b47;color:#fff;border-color:#b83b47}.om-phone label{display:block;margin-bottom:12px}.om-phone fieldset{border:0;padding:0;margin:0}.om-phone legend{font-weight:700;margin-bottom:12px}`;
  const controls = document.createElement("div"), list = document.createElement("div"), notice = document.createElement("div"), pager = document.createElement("div");
  controls.className = "om-bar"; list.className = "om-list"; notice.className = "om-notice"; notice.setAttribute("role", "status"); pager.className = "om-pager";
  page.append(controls, notice, list, pager); container.replaceChildren(style, page);
  // The original reward app has light-paper text rules; override them only
  // inside this dark phone editor instead of inheriting black text on black.
  style.textContent += ".st-object-app .om-phone,.st-object-app .om-phone button,.st-object-app .om-phone input,.st-object-app .om-phone textarea,.st-object-app .om-phone select,.st-object-app .om-phone label,.st-object-app .om-phone h3,.st-object-app .om-phone p{color:#f5f1e8!important}.st-object-app .om-phone input,.st-object-app .om-phone textarea,.st-object-app .om-phone select{background:#16151b!important}.st-object-app .om-phone .om-notice{color:#f1c48e!important}";
  style.textContent += ".st-object-app .om-phone summary,.st-object-app .om-phone legend,.st-object-app .om-phone span{color:#f5f1e8!important}.om-structure>.om-bar{margin-bottom:9px}.om-structure details{margin:9px 0}.om-structure summary{cursor:pointer;font-weight:700;padding:6px 0}";
  style.textContent += `.om-phone{background:linear-gradient(155deg,#1d2430,#12151d);padding:12px;gap:12px;letter-spacing:.015em}.om-phone>.om-bar{gap:5px}.om-phone>.om-bar>button{flex:1;border:0;border-radius:10px;background:#282f3b;padding:10px 5px;font-size:13px;font-weight:650}.om-phone>.om-bar>button.om-active{background:#ddbb86;color:#1a2028!important}.om-phone .om-storage{width:100%;font-size:10px;letter-spacing:.08em;opacity:.6;padding-top:6px}.om-phone .om-card{border:1px solid #394353;background:#232a36;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 4px 16px #0002}.om-phone .om-card h3{font-size:16px;line-height:1.4;margin-bottom:10px}.om-phone button{border-color:#4e5a6e;border-radius:10px;background:#313d50;line-height:1.4;margin:3px 4px 3px 0;transition:background .15s}.om-phone button:hover{background:#40516b}.om-phone .om-library-summary{padding:6px 4px 14px}.om-phone .om-library-summary h3{font-size:23px;margin:0 0 7px}.om-phone .om-badge{display:inline-block;font-size:10px;padding:5px 8px;border-radius:20px;background:#23504e;color:#b5f5d7!important}.om-phone .om-role-card>img{float:right;width:68px;height:86px;object-fit:cover;border-radius:11px;margin:0 0 10px 10px}.om-phone .om-role-card:after{content:"";display:block;clear:both}.om-phone .om-function-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0 16px}.om-phone .om-function{display:flex;flex-direction:column;gap:7px;align-items:flex-start;text-align:left;margin:0;min-height:93px;padding:14px;background:#232a36;border:1px solid #3c4758;border-radius:14px}.om-phone .om-function strong{font-size:14px;color:#ead6b4}.om-phone .om-function span{font-size:11px;line-height:1.55;opacity:.7}.om-phone .om-profile-hero{border-top:3px solid #d6b37e;background:linear-gradient(130deg,#30394a,#242b36)}.om-phone .om-profile-hero .om-avatar{float:right;width:65px;height:80px;object-fit:cover;border-radius:10px}.om-phone .om-section-nav{margin:12px 0}.om-phone .om-section-nav>label{margin:0;font-size:11px;opacity:.85}.om-phone .om-section-nav select{margin-top:5px}.om-phone code{display:block;font:10px ui-monospace,monospace;overflow-wrap:anywhere;color:#a8b6c9;line-height:1.7}.om-phone .om-media-preview{display:block;max-width:100%;width:auto;height:170px;object-fit:contain;margin:8px auto;background:repeating-conic-gradient(#303744 0 25%,#252b36 0 50%) 50%/18px 18px;border-radius:10px}.om-phone .om-notice:empty{display:none}.om-phone .om-pager button{background:#242c38;font-size:12px}.om-phone label{font-size:12px;color:#b4c0d2!important}.om-phone label>input,.om-phone label>select,.om-phone label>textarea{margin-top:5px}.om-phone input[type=checkbox]{width:auto}.om-phone [hidden]{display:none!important}.om-phone .om-notice{line-height:1.6}`;
  let selected = "", index = 0, editing = null, focusId = "", structure = null, structurePanel = null, destroyed = false;
  if (encounterRole) { const imported = await importEncounterCharacter(runtime, encounterRole); structure = { kind: "character", id: imported.id }; tab = "characters"; }
  if (locationId && await runtime.store.getObject({ kind: "location", id: locationId })) { structure = { kind: "location", id: locationId }; tab = "locations"; }
  let focusRoleOnce = Boolean(roleName && !encounterRole);
  const make = (tag, text = "", cls = "") => { const element = document.createElement(tag); element.textContent = text; element.className = cls; return element; };
  async function run(work) { notice.textContent = "处理中…"; try { await work(); await refresh(); notice.textContent = runtime.store.driver.describe().persistent ? "操作完成 · 聊天文件已保存" : "操作完成 · 当前为内存预览"; onChanged(); } catch (error) { notice.textContent = error.message; } }
  function button(text, work, disabled = false, cls = "") {
    const element = make("button", text, cls); element.type = "button"; element.disabled = disabled;
    element.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); element.disabled = true; void run(work).finally(() => { element.disabled = disabled; }); }); return element;
  }
  function field(form, label, value, multiline = false) { const wrapper = make("label", label); const input = make(multiline ? "textarea" : "input"); input.value = value ?? ""; wrapper.append(input); form.append(wrapper); return input; }
  async function refresh() {
    if (destroyed) return;
    const scroll = list.scrollTop;
    const characters = await runtime.store.listObjects("character");
    const locations = await runtime.availableLocations();
    const slots = await runtime.store.getTaskSlots();
    const loaded = new Set((await runtime.store.getCharacterSlots()).filter((slot) => slot.enabled !== false).map((slot) => slot.ref.id));
    if (!selected || !characters.some((item) => item.id === selected)) selected = characters.find((item) => item.name === roleName || item.aliases.includes(roleName))?.id ?? characters.find((item) => item.id === "user")?.id ?? characters[0]?.id ?? "";
    if (focusRoleOnce && selected) { structure = { kind: "character", id: selected }; tab = "characters"; focusRoleOnce = false; }
    structurePanel?.destroy(); structurePanel = null;
    controls.replaceChildren(); list.replaceChildren(); pager.replaceChildren();
    for (const [id, label] of [["characters", "角色库"], ["locations", "地点库"], ["tasks", "任务"], ["achievements", "成就"]]) controls.append(button(label, async () => { tab = id; index = 0; editing = null; structure = null; }, false, tab === id ? "om-active" : ""));
    const meta = await runtime.store.readJson("meta.json");
    controls.append(make("span", `独立对象 · ${runtime.store.driver.describe().kind} · AI 第 ${meta.lastReplyOrdinal ?? 0} 层`, "om-storage"));
    if (["tasks", "achievements"].includes(tab)) {
      const select = make("select"); select.setAttribute("aria-label", "所属角色");
      for (const character of characters) { const option = make("option", character.id === "user" ? "自己" : character.name); option.value = character.id; option.selected = character.id === selected; select.append(option); }
      select.addEventListener("change", () => void run(async () => { selected = select.value; index = 0; editing = null; }));
      controls.append(select, make("span", `${slots.length}/3 活动任务`, "om-small"));
    }
    let rows = [];
    if (tab === "characters") rows = characters;
    else if (tab === "locations") rows = (await runtime.locationTree()).roots.map((ref) => locations.find((object) => object.id === ref.id));
    else {
      const owner = characters.find((item) => item.id === selected);
      for (const ref of owner?.refs[tab === "tasks" ? "tasks" : "achievements"] ?? []) { const child = await runtime.store.getObject(ref); if (child) rows.push(child); }
    }
    if (structure) {
      structurePanel = await mountObjectStructurePanel(list, { runtime, rootRef: structure, onChanged, onSpecialOpen, onBack: () => { structure = null; void run(async () => {}); }, onEditDefinition: (object) => { editing = structuredClone(object); structure = null; void run(async () => {}); } });
    } else if (editing) {
      renderEditor(editing, characters, locations);
    } else {
      if (focusId) { const position = rows.findIndex((row) => row.id === focusId); if (position >= 0) index = Math.floor(position / 4); focusId = ""; }
      const toolbar = make("div", "", "om-bar");
      toolbar.append(button("新增", async () => { const kind = { tasks: "task", achievements: "achievement", characters: "character", locations: "location" }[tab]; editing = { kind, id: `${kind}-${crypto.randomUUID()}`, name: "", owner: selected ? { kind: "character", id: selected } : null }; }, ["tasks", "achievements"].includes(tab) && !selected));
      if (tab === "tasks") {
        const settings = await runtime.workshopSettings();
        toolbar.append(button(settings.enabled ? "关闭工坊" : "启用工坊", () => runtime.setWorkshopEnabled(!settings.enabled)));
        if (settings.enabled && !runtime.workshopClient) toolbar.append(make("span", "工坊接口尚未配置；已接任务不受影响。", "om-small"));
        if (settings.enabled) toolbar.append(button("工坊任务", async () => {
          if (runtime.workshopClient?.connect) runtime.workshopClient.connect();
          const packages = await runtime.listWorkshopTasks(selected);
          list.replaceChildren();
          for (const pkg of packages) { const card = make("article", "", "om-card"); card.append(make("h3", pkg.task.name), make("p", pkg.task.definition.description), button("导入（不自动接取）", () => runtime.importWorkshopTask(pkg.id, selected))); list.append(card); }
        }, !runtime.workshopClient));
      }
      list.append(toolbar);
      if (tab === "locations") {
        toolbar.firstChild.textContent = "新增根地点";
        const summary = make("article", "", "om-library-summary"); summary.append(make("h3", "地点树"), make("p", `${rows.length} 个根节点 · ${locations.length} 个普通地点`, "om-small"), make("p", "根节点仍可增加父节点；有子地点的节点可启用棋盘。", "om-small")); list.prepend(summary);
        if (onSpecialOpen) toolbar.append(button("特殊地点 / 原地点功能", onSpecialOpen));
      }
      if (tab === "characters") {
        toolbar.firstChild.textContent = "创建角色";
        const importer = make("input"); importer.type = "file"; importer.accept = ".json,application/json"; importer.hidden = true;
        importer.addEventListener("change", () => void run(async () => { const file = importer.files?.[0]; if (!file || file.size > 20 * 1024 * 1024) throw new Error("请选择不超过 20 MiB 的角色 JSON"); const imported = await importEncounterCharacter(runtime, JSON.parse(await file.text())); structure = { kind: "character", id: imported.id }; }));
        toolbar.append(button("导入邂逅角色", async () => { importer.click(); }), importer);
        if (exportChat) toolbar.append(button("备份聊天文件夹", async () => exportChat(await runtime.exportChatFiles(), runtime.store.chatKey)));
        const summary = make("article", "", "om-library-summary"); summary.append(make("h3", "角色库"), make("p", `${loaded.size} 已挂载 / ${characters.length} 本地角色`, "om-small"), make("p", "挂载后参与世界书与独立类变量更新；未挂载时保留最后状态和全部图片。", "om-small")); list.prepend(summary);
      }
      index = Math.min(index, Math.max(0, Math.ceil(rows.length / 4) - 1));
      for (const object of rows.slice(index * 4, index * 4 + 4)) {
        const card = make("article", "", "om-card"); card.append(make("h3", object.name));
        if (["task", "achievement"].includes(object.kind)) {
          const active = slots.some((slot) => slot.ref.id === object.id);
          card.append(make("span", object.data.completed ? object.data.claimed ? "已完成 · 已领取" : "已完成 · 待领取" : active ? "进行中" : "未接取", "om-small"), make("p", object.definition.description));
          if (object.kind === "task" && !object.data.completed) card.append(button(active ? "取消接取" : "接取", () => active ? runtime.cancelTask(object.id) : runtime.acceptTask(object.id), !active && (slots.length >= 3 || !loaded.has(selected))));
          if (object.data.completed && !object.data.claimed) card.append(button("领取奖励", () => runtime.settleChildReward(object), !runtime.rewardAccount));
        } else if (object.kind === "character") {
          card.classList.add("om-role-card");
          const cover = object.ui.images?.find((image) => image.usage === "portrait");
          if (cover) { const image = make("img"); image.alt = object.name; const url = URL.createObjectURL(await runtime.imageBlob(cover)); image.src = url; image.onload = image.onerror = () => URL.revokeObjectURL(url); card.prepend(image); }
          card.append(make("span", loaded.has(object.id) ? "已挂载 · 模型可更新" : "本地保存 · 暂不参与模型", loaded.has(object.id) ? "om-badge" : "om-small"), make("p", object.summary || "设定、图片、关系与独立日程集中在档案中。", "om-small"));
          card.append(button(loaded.has(object.id) ? "取消挂载" : "挂载角色", async () => {
            const slot = (await runtime.store.getCharacterSlots()).find((item) => item.ref.id === object.id);
            if (loaded.has(object.id)) await runtime.unloadCharacter(slot.slotId); else await runtime.loadCharacter(`editor-${object.id}`, object.id);
          }, object.id === "user"));
        } else {
          card.append(make("p", object.data.description || "纯地点资料；可包含子地点，不强制带前端功能。", "om-small"), make("span", `深度 0 · ${object.children.length} 个直接子地点`, "om-badge"));
          const tree = await runtime.locationTree(), details = make("details"); details.append(make("summary", "展开层级"));
          const walk = (ref) => { const item = tree.nodes.get(ref.id); const row = make("div", "", "om-bar"); row.style.paddingLeft = `${Math.min(40, item.depth * 8)}px`; row.append(make("span", `深度 ${item.depth}`, "om-small"), button(item.object.name, async () => { structure = ref; })); details.append(row); for (const child of item.object.children) walk(child); }; for (const ref of object.children) walk(ref); card.append(details);
        }
        card.append(button(object.kind === "character" ? "角色档案" : object.kind === "location" ? "打开地点 / 棋盘" : "打开 / 编辑对象", async () => { structure = { kind: object.kind, id: object.id }; })); list.append(card);
      }
      if (!rows.length) list.append(make("p", "暂无记录，可以新增。", "om-small"));
      pager.append(button("上一页", async () => { index -= 1; }, index === 0), make("span", `${index + 1}/${Math.max(1, Math.ceil(rows.length / 4))}`), button("下一页", async () => { index += 1; }, (index + 1) * 4 >= rows.length));
    }
    list.scrollTop = scroll;
  }
  function renderEditor(value, characters, locations) {
    const form = make("form", "", "om-card"); form.addEventListener("submit", (event) => event.preventDefault());
    const name = field(form, "名称", value.name); name.required = true;
    const text = field(form, value.kind === "character" ? "简介 / 知识说明" : "说明", value.summary ?? value.definition?.description ?? value.data?.description ?? "", true);
    const child = ["task", "achievement"].includes(value.kind);
    const goal = child ? field(form, "完成条件（剧情目标）", value.definition?.completion.text ?? "", true) : null;
    const starlight = child ? field(form, "奖励星光点", value.definition?.rewards.starlight ?? 0) : null;
    if (starlight) { starlight.type = "number"; starlight.min = "0"; starlight.step = "1"; }
    const aliases = value.kind === "character" ? field(form, "别名（逗号分隔）", (value.aliases ?? []).join("，")) : null;
    const mapScope = null;
    if (mapScope) { const label = make("label", "所属地图"); for (const [id, text] of [["world", "城市"], ["school", "校园"]]) { const option = make("option", text); option.value = id; option.selected = (value.data?.mapScope ?? "world") === id; mapScope.append(option); } label.append(mapScope); form.append(label); }
    const children = null;
    if (children) {
      children.append(make("legend", "子地点"));
      for (const location of locations.filter((item) => item.id !== value.id && !item.data.mapRoot)) {
        const label = make("label", location.name); const checkbox = make("input"); checkbox.type = "checkbox"; checkbox.style.width = "auto"; checkbox.value = location.id; checkbox.checked = value.children?.some((ref) => ref.id === location.id) ?? false; label.prepend(checkbox); children.append(label);
      }
      form.append(children);
    }
    form.append(button("保存", async () => {
      if (!form.reportValidity()) return;
      const next = { ...value, name: name.value.trim() };
      if (child) {
        next.definition = { description: text.value.trim(), completion: { ...(value.definition?.completion ?? { mode: "narrative", when: null }), text: goal.value.trim() }, rewards: { ...(value.definition?.rewards ?? {}), starlight: Number(starlight.value) } };
        await runtime.saveCharacterChild(next);
      } else if (value.kind === "character") {
        const previous = value.worldbook?.entries ?? [];
        next.summary = text.value.trim(); next.aliases = aliases.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
        next.worldbook = { entries: previous.filter((entry) => entry.id !== "editable-summary") };
        if (next.summary) next.worldbook.entries.push({ id: "editable-summary", comment: `[mvu_plot]${next.name}本地资料`, content: next.summary, constant: true, order: 950, position: 4, depth: 0 });
        await runtime.saveCharacterDefinition(normalizeCharacter(next));
      } else if (value.kind === "location") {
        next.data = { ...(value.data ?? {}), description: text.value.trim() };
        if (mapScope) next.data.mapScope = mapScope.value;
        next.children = value.children ?? [];
        await runtime.saveLocationDefinition(normalizeLocation(next));
      } else {
        next.data = { ...(value.data ?? {}), description: text.value.trim() };
        if (value.kind === "schedule") next.summary = text.value.trim();
        await runtime.saveObjectDefinition(next);
      }
      focusId = next.id; editing = null; structure = { kind: next.kind, id: next.id };
    }), button("取消", async () => { editing = null; }));
    list.append(form);
  }
  await refresh();
  return { refresh, destroy() { destroyed = true; structurePanel?.destroy(); container.replaceChildren(); } };
}
