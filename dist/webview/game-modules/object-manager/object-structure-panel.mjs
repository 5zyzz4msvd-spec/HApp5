import { OBJECT_KINDS, WEEKDAYS, refKey } from "./contracts.mjs";
import { objectEdges } from "./object-graph.mjs";
import { ELEMENT_TYPES, flattenElements, pointerRead } from "./structure-schema.mjs";
import { mountLocationBoard } from "./location-board-panel.mjs";
import { mountCollectionEditor } from "./collection-panel.mjs";

export async function mountObjectStructurePanel(container, { runtime, rootRef, onBack, onEditDefinition, onChanged = () => {}, onSpecialOpen = null }) {
  const labels = { character: "角色", task: "任务", achievement: "成就", schedule: "日程", location: "地点", "favor-event": "好感事件", event: "事件", custom: "自定义类" };
  const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  let trail = [rootRef], section = "overview", childPage = 0, scheduleDay = "monday", formMode = null, object = null, alive = true;
  const openGroups = new Set();
  const imageUrls = new Set(); let imagePage = 0;
  let boardPanel = null;
  const releaseImages = () => { for (const url of imageUrls) URL.revokeObjectURL(url); imageUrls.clear(); };
  async function preview(image, parent, cls = "") { const img = node("img", "", cls); img.alt = image.name; img.src = URL.createObjectURL(await runtime.imageBlob(image)); imageUrls.add(img.src); parent.append(img); }
  const root = document.createElement("section"); root.className = "om-structure"; container.replaceChildren(root);
  const node = (tag, text = "", cls = "") => { const element = document.createElement(tag); element.textContent = text; element.className = cls; return element; };
  let notice;
  async function action(work) {
    notice.textContent = "处理中…";
    try { await work(); await render(); await onChanged(); notice.textContent = runtime.store.driver.describe().persistent ? "操作完成 · 聊天文件已保存" : "操作完成 · 当前为内存预览"; }
    catch (error) { notice.textContent = error.message; }
  }
  function button(text, work, disabled = false) { const element = node("button", text); element.type = "button"; element.disabled = disabled; element.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); element.disabled = true; void action(work).finally(() => { element.disabled = disabled; }); }); return element; }
  function input(form, label, value = "", type = "text") { const wrapper = node("label", label); const control = document.createElement(type === "textarea" ? "textarea" : "input"); if (type !== "textarea") control.type = type; if (type === "checkbox") { control.checked = Boolean(value); control.style.width = "auto"; } else control.value = value ?? ""; wrapper.append(control); form.append(wrapper); return control; }
  function select(form, label, options, value) { const wrapper = node("label", label), control = node("select"); for (const [id, title] of options) { const option = node("option", title); option.value = id; option.selected = id === value; control.append(option); } wrapper.append(control); form.append(wrapper); return control; }
  const card = (title) => { const element = node("article", "", "om-card"); if (title) element.append(node("h3", title)); root.append(element); return element; };
  async function allObjects() { const result = []; for (const kind of OBJECT_KINDS) result.push(...await (kind === "location" ? runtime.availableLocations() : runtime.store.listObjects(kind))); return result; }
  async function render() {
    if (!alive) return;
    const previousScroll = container.scrollTop;
    object = await runtime.store.getObject(trail.at(-1));
    if (object?.kind === 'location') object = (await runtime.availableLocations()).find(x => x.id === object.id);
    if (!object) throw new Error("对象文件不存在");
    if (object.kind === "location") trail = (await runtime.locationTree()).nodes.get(object.id).path;
    boardPanel?.destroy(); boardPanel = null;
    releaseImages(); root.replaceChildren();
    const breadcrumb = node("div", "", "om-bar");
    breadcrumb.append(button(trail.length > 1 ? "返回父对象" : "返回目录", async () => { if (trail.length > 1) { trail.pop(); section = "overview"; formMode = null; childPage = 0; } else onBack(); }));
    for (let index = 0; index < trail.length; index += 1) { const item = await runtime.store.getObject(trail[index]); breadcrumb.append(button(item?.name ?? trail[index].id, async () => { trail = trail.slice(0, index + 1); section = "overview"; formMode = null; childPage = 0; })); }
    root.append(breadcrumb);
    const tabs = node("div", "", "om-section-nav");
    const choices = object.kind === "character" ? [["overview", "角色总览"], ["profile", "角色设定"], ["images", "图片素材"], ["elements", "类变量与字段"], ["relations", "人物关系"], ["activities", "专属任务 / 成就 / 事件"], ["character-schedule", "独立日程"], ["worldbook", "世界书与提示词"], ["children", "高级对象结构"]] : [["overview", "对象总览"], ["elements", "元素 / 分组"], ["images", "图片素材"], ["children", "子对象"], ["worldbook", "世界书"]];
    if (object.kind === "schedule") choices.push(["schedule", "一周 / 节假日"]);
    if (object.kind === "location") { choices[0][1] = "地点与棋盘"; choices.splice(1, 0, ["location-tree", "层级与子地点"]); }
    const sectionPicker = select(tabs, "当前分区", choices, section);
    sectionPicker.addEventListener("change", () => void action(async () => { section = sectionPicker.value; formMode = null; }));
    notice = node("p", "", "om-notice"); notice.setAttribute("role", "status"); root.append(tabs, notice);
    if (formMode) await renderForm();
    else if (section === "profile") renderProfile();
    else if (section === "images") await renderImages();
    else if (section === "activities") await renderActivities();
    else if (section === "character-schedule") renderCharacterSchedule();
    else if (section === "location-tree") await renderLocationTree();
    else if (section === "elements") renderElements();
    else if (section === "children") await renderChildren();
    else if (section === "relations") await renderRelations();
    else if (section === "worldbook") renderWorldbook();
    else if (section === "schedule") await renderSchedule();
    else await renderOverview();
    container.scrollTop = previousScroll;
  }
  async function renderOverview() {
    if (object.kind === "location") { await renderLocationOverview(); return; }
    const basic = card(`${labels[object.kind]} · ${object.name}`);
    basic.classList.add("om-profile-hero");
    const cover = object.ui?.images?.find((image) => image.usage === "portrait");
    if (cover) await preview(cover, basic, "om-avatar");
    basic.append(node("p", object.summary ?? object.definition?.description ?? object.data?.description ?? "", "om-small"), node("p", `元素 ${flattenElements(object.elements).filter((item) => item.type !== "group").length} · 分组 ${flattenElements(object.elements).filter((item) => item.type === "group").length} · 关联对象 ${objectEdges(object).length}`, "om-small"), button("编辑基本资料", () => onEditDefinition(object)));
    if (object.kind === "character") {
      const mounted = (await runtime.store.getCharacterSlots()).some((slot) => slot.enabled !== false && slot.ref.id === object.id);
      basic.append(node("span", mounted ? "已挂载 · 世界书与类变量生效" : "未挂载 · 状态与图片保留在本地", "om-badge"));
      const grid = node("div", "", "om-function-grid"); root.append(grid);
      for (const [id, title, description] of [["profile", "角色设定", "身份、外貌、性格与邂逅"], ["images", "图片素材", `${object.ui.images?.length ?? 0} 张 · 头像 / 立绘 / 相册`], ["elements", "独立类变量", "模型可更新字段与数值"], ["relations", "人物关系", `${object.relations.length} 位关联角色`], ["activities", "专属目标与事件", `${object.refs.tasks.length} 任务 · ${object.refs.achievements.length} 成就`], ["character-schedule", "独立日程", object.refs.schedule ? "一周七天与节假日" : "尚未建立 · 可留空"], ["worldbook", "世界书与提示词", `${object.worldbook.entries.length} 条知识 · 剧情 / 更新路由`], ["children", "高级对象结构", "同类与异类子对象、共享引用"]]) {
        const entry = button("", async () => { section = id; }); entry.className = "om-function"; entry.append(node("strong", title), node("span", description)); grid.append(entry);
      }
      const files = card("聊天专属本地文件"); files.append(node("p", "角色定义、独立数值与图片在同一个聊天目录。取消挂载只停用模型内容，不删除存档。", "om-small"), node("code", `${runtime.store.root}/`), node("p", `当前更新方式：${runtime.updateMode === "extra" ? "独立额外模型" : "跟随 AI 正文"}`, "om-small"));
      const settings = node("details"); settings.append(node("summary", "更新方式设置"));
      const mode = select(settings, "模型更新方式", [["follow", "跟随正文输出"], ["extra", "额外模型输出（需宿主配置独立模型接口）"]], runtime.updateMode);
      settings.append(button("保存更新方式", () => runtime.setUpdateMode(mode.value))); files.append(settings);
      return;
    }
    const attributes = card("元素与属性");
    attributes.append(button("打开元素树", async () => { section = "elements"; }), button("添加分组或字段", async () => { formMode = { type: "element", parent: "" }; }));
  }
  async function renderLocationOverview() {
    const tree = await runtime.locationTree(), location = tree.nodes.get(object.id);
    const header = card(`${object.ui.symbol ?? "◇"} ${object.name}`);
    header.append(node("p", location.path.map((ref) => tree.nodes.get(ref.id).object.name).join(" › "), "om-board-path"), node("span", `深度 ${location.depth} · ${object.children.length} 个直接子地点`, "om-badge"));
    header.append(button("地点资料", () => onEditDefinition(object)), button("层级管理", async () => { section = "location-tree"; }), button("增加上级地点", async () => { formMode = { type: "location-parent" }; }));
    const information = node("details"); information.append(node("summary", "地点说明 / 设置"), node("p", object.data.description ?? "", "om-small")); header.append(information);
    if (onSpecialOpen && object.id === "map-world") information.append(button("特殊地点 / 原地点功能", onSpecialOpen));
    if (object.children.length) {
      const settings = node("details"); settings.append(node("summary", "棋盘设置")); information.append(settings);
      const enabled = input(settings, "此节点显示子地点棋盘", object.ui.board.enabled, "checkbox"), columns = select(settings, "棋盘列数", [2, 3, 4, 5, 6].map((value) => [String(value), `${value} 列`]), String(object.ui.board.columns));
      settings.append(button("保存棋盘设置", () => runtime.setLocationBoard(object, { enabled: enabled.checked, columns: Number(columns.value), cells: object.ui.board.cells })));
      if (object.ui.board.enabled) boardPanel = await mountLocationBoard(root, { runtime, locationRef: object, onOpen: (ref) => void action(async () => { trail = [ref]; section = "overview"; }), onChanged });
      else { const children = card("直接子地点"); for (const ref of object.children) children.append(button(tree.nodes.get(ref.id).object.name, async () => { trail = [ref]; section = "overview"; })); }
    } else { const leaf = card("叶节点"); leaf.append(node("p", "此地点暂无下级。可以添加子地点后启用棋盘。", "om-small"), button("添加子地点", async () => { formMode = { type: "create-object", kind: "location" }; })); }
    const extra = card("地点资料与引用"); extra.append(button("地点知识", async () => { section = "worldbook"; }), button("背景图片", async () => { section = "images"; }), node("p", "浏览棋盘只打开地点目录，不代表角色已到达。特殊地点尚未转交。", "om-small"));
  }
  async function renderLocationTree() {
    const tree = await runtime.locationTree(), current = tree.nodes.get(object.id), tools = card("地点层级");
    tools.append(node("p", current.path.map((ref) => tree.nodes.get(ref.id).object.name).join(" › "), "om-board-path"), node("p", "每个地点只有一个父地点。增加上级会整体包住当前节点；移动子树不改变其内部层级。", "om-small"), button("增加上级地点", async () => { formMode = { type: "location-parent" }; }), button("添加子地点", async () => { formMode = { type: "create-object", kind: "location" }; }));
    const parent = select(tools, "移动当前子树到", [["", "成为独立根节点"], ...[...tree.nodes.values()].filter((node) => !node.path.some((ref) => ref.id === object.id)).map((node) => [node.object.id, `${"· ".repeat(node.depth)}${node.object.name}`])], current.parent?.id ?? "");
    tools.append(button("移动子树", () => runtime.moveLocation(object, parent.value ? { kind: "location", id: parent.value } : null)));
    const children = object.children; childPage = Math.min(childPage, Math.max(0, Math.ceil(children.length / 4) - 1));
    for (const ref of children.slice(childPage * 4, childPage * 4 + 4)) { const item = tree.nodes.get(ref.id), box = card(item.object.name); box.append(node("p", `深度 ${item.depth} · ${item.object.children.length} 个直接子地点`, "om-small"), button("打开子地点", async () => { trail = [ref]; section = "overview"; }), button("移为独立根节点", () => runtime.moveLocation(ref, null))); }
    const pager = node("div", "", "om-pager"); pager.append(button("上一页", async () => { childPage -= 1; }, childPage === 0), node("span", `${childPage + 1}/${Math.max(1, Math.ceil(children.length / 4))}`), button("下一页", async () => { childPage += 1; }, (childPage + 1) * 4 >= children.length)); root.append(pager);
  }
  function renderProfile() {
    const form = card("角色设定"); form.append(node("p", "这就是统一的邂逅自定义角色档案；图片与独立数值不会写入 MVU。", "om-small"));
    const name = input(form, "角色名称", object.name), aliases = input(form, "别名（逗号分隔）", object.aliases.join("，")), summary = input(form, "简介", object.summary, "textarea");
    const edits = [];
    for (const field of flattenElements(object.elements).filter((item) => ["gender", "identity", "appearance", "personality", "background", "first-encounter", "behavior", "age", "height"].includes(item.id) && !item.binding)) edits.push({ field, control: input(form, field.label + (field.unit ? `（${field.unit}）` : ""), object.values[field.id], field.type === "number" ? "number" : field.type === "textarea" ? "textarea" : "text") });
    form.append(button("保存角色设定", async () => {
      if (!name.value.trim()) throw new Error("请填写角色名称");
      const values = Object.fromEntries(edits.map(({ field, control }) => [field.id, field.type === "number" ? Number(control.value) : control.value]));
      await runtime.saveProfileValues(object, values, { name: name.value, aliases: aliases.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean), summary: summary.value });
    }));
  }
  async function renderImages() {
    const tools = card("图片素材"); tools.append(node("p", "头像、全身立绘和相册分别管理。图片原文件在此聊天 assets 目录，不写入 JSON / MVU / 浏览器键值缓存。", "om-small"));
    const usage = select(tools, "图片用途", [["portrait", "头像"], ["standee", "全身立绘"], ["gallery", "相册"], ["background", "背景"]], object.kind === "location" ? "background" : "portrait");
    const upload = input(tools, "选择本地图片（≤12 MiB）", "", "file"); upload.accept = "image/png,image/jpeg,image/webp,image/gif";
    tools.append(button("保存图片", async () => { const file = upload.files?.[0]; if (!file) throw new Error("请先选择图片"); await runtime.addImage(object, file, { usage: usage.value, name: file.name }); }));
    const images = object.ui?.images ?? []; imagePage = Math.min(imagePage, Math.max(0, Math.ceil(images.length / 4) - 1));
    const names = { portrait: "头像", standee: "全身立绘", gallery: "相册", background: "背景" };
    for (const image of images.slice(imagePage * 4, imagePage * 4 + 4)) {
      const item = card(`${names[image.usage]} · ${image.name}`); await preview(image, item, "om-media-preview");
      item.append(node("p", `${Math.round(image.size / 1024)} KB · 本地文件`, "om-small"), button("从档案移除（保留原文件）", () => runtime.removeImage(object, image.id)));
    }
    const pager = node("div", "", "om-pager"); pager.append(button("上一页", async () => { imagePage -= 1; }, imagePage === 0), node("span", `${imagePage + 1}/${Math.max(1, Math.ceil(images.length / 4))}`), button("下一页", async () => { imagePage += 1; }, (imagePage + 1) * 4 >= images.length)); root.append(pager);
  }
  async function renderActivities() {
    childPage = Math.min(childPage, Math.max(0, ...[object.refs.tasks, object.refs.achievements, object.refs.favorEvents].map((list) => Math.ceil(list.length / 4) - 1)));
    for (const [field, kind, title] of [["tasks", "task", "任务"], ["achievements", "achievement", "成就"], ["favorEvents", "favor-event", "好感事件"]]) {
      const group = card(`${title} · ${object.refs[field].length}`); group.append(button(`新建${title}`, async () => { formMode = { type: "create-object", kind }; }));
      for (const ref of object.refs[field].slice(childPage * 4, childPage * 4 + 4)) { const child = await runtime.store.getObject(ref); group.append(button(child?.name ?? ref.id, async () => { trail.push(ref); section = "overview"; })); }
    }
    const max = Math.max(1, ...[object.refs.tasks, object.refs.achievements, object.refs.favorEvents].map((list) => Math.ceil(list.length / 4)));
    const pager = node("div", "", "om-pager"); pager.append(button("上一页", async () => { childPage -= 1; }, childPage === 0), node("span", `${childPage + 1}/${max}`), button("下一页", async () => { childPage += 1; }, childPage + 1 >= max)); root.append(pager);
  }
  function renderCharacterSchedule() {
    const item = card("独立日程"); item.append(node("p", "按一周七天、节假日分别设置地点与事件。只有和 USER 日程推进时间重叠且地点相同，脚本才生成隐藏提示词。", "om-small"));
    item.append(object.refs.schedule ? button("编辑一周与节假日", async () => { trail.push(object.refs.schedule); section = "schedule"; }) : button("建立独立日程", async () => { formMode = { type: "create-object", kind: "schedule" }; }));
  }
  function renderElements() {
    const tools = card("元素树"); tools.append(button("添加顶层元素", async () => { formMode = { type: "element", parent: "" }; }));
    function walk(elements, parent) {
      for (const element of elements) {
        const box = node(element.type === "group" ? "details" : "article", "", "om-card"); parent.append(box);
        if (element.type === "group") { const key = `${refKey(object)}:${element.id}`; box.open = openGroups.has(key) || element.id === "basic"; box.addEventListener("toggle", () => { if (box.open) openGroups.add(key); else openGroups.delete(key); }); box.append(node("summary", element.label)); walk(element.elements, box); box.append(button("组内添加", async () => { formMode = { type: "element", parent: element.id }; })); }
        else {
          box.append(node("h3", element.label), node("span", `${element.type}${element.unit ? " · " + element.unit : ""} · ${element.audience === "local" ? "仅本地" : element.audience}`, "om-small"));
          const value = element.binding ? pointerRead(object, element.binding.path) : object.values[element.id];
          if (element.binding) box.append(node("p", `只读绑定：${value === undefined ? "尚无值" : String(value)}`, "om-small"));
          else if (["record", "list"].includes(element.type)) mountCollectionEditor(box, { runtime, objectRef: object, field: element, value });
          else {
            const control = element.type === "choice" ? select(box, "值", element.choices.map((choice) => [choice, choice]), value) : input(box, "值", value, element.type === "textarea" ? "textarea" : element.type === "number" ? "number" : element.type === "boolean" ? "checkbox" : "text");
            box.append(button("保存值", async () => { await runtime.setElementValue(object, element.id, element.type === "number" ? Number(control.value) : element.type === "boolean" ? control.checked : control.value); }));
          }
        }
        const settings = node("details"); settings.append(node("summary", "元素设置"), button("编辑元素定义", async () => { formMode = { type: "element", element, parent: "" }; }), button("移除元素", async () => { const ids = new Set(flattenElements([element]).map((item) => item.id)); function remove(nodes) { return nodes.filter((item) => item.id !== element.id).map((item) => item.type === "group" ? { ...item, elements: remove(item.elements) } : item); } object.elements = remove(object.elements); for (const id of ids) delete object.values[id]; await runtime.saveObjectDefinition(object); })); box.append(settings);
      }
    }
    if (!object.elements.length) tools.append(node("p", "可建立信息、外观、背景等分组，每组再添加字段或分组。", "om-small"));
    walk(object.elements, root);
  }
  async function renderChildren() {
    const tools = card("子对象与引用"); tools.append(button("新建子对象", async () => { formMode = { type: "create-object", kind: "custom" }; }), button("引用已有对象", async () => { formMode = { type: "link-object" }; }));
    const visibleLocations = new Set((await runtime.availableLocations()).map(x => x.id));
    const edges = objectEdges(object).filter(edge => edge.ref.kind !== 'location' || visibleLocations.has(edge.ref.id)); childPage = Math.min(childPage, Math.max(0, Math.ceil(edges.length / 4) - 1));
    for (const edge of edges.slice(childPage * 4, childPage * 4 + 4)) {
      const child = await runtime.store.getObject(edge.ref); const box = card(`${edge.label || labels[edge.ref.kind]} · ${child?.name ?? edge.ref.id}`);
      box.append(node("p", `${labels[edge.ref.kind]} · ${edge.mode === "owned" ? "包含子对象" : "引用对象"}`, "om-small"), button("打开对象", async () => { trail.push(edge.ref); section = "overview"; childPage = 0; }), button("移除关联（保留文件）", async () => { await runtime.removeObjectLink(object, edge.id); }));
    }
    if (!edges.length) tools.append(node("p", "这个对象还没有子对象。", "om-small"));
    const pager = node("div", "", "om-pager"); pager.append(button("上一页", async () => { childPage -= 1; }, childPage === 0), node("span", `${childPage + 1}/${Math.max(1, Math.ceil(edges.length / 4))}`), button("下一页", async () => { childPage += 1; }, (childPage + 1) * 4 >= edges.length)); root.append(pager);
  }
  async function renderRelations() {
    const tools = card("人物关系"); tools.append(button("添加关系", async () => { formMode = { type: "relation" }; }));
    for (const relation of object.relations) { const target = await runtime.store.getObject(relation.target); const box = card(target?.name ?? relation.target.id); box.append(node("p", `${relation.type}：${relation.summary}`), button("编辑关系", async () => { formMode = { type: "relation", relation }; }), button("查看关联角色", async () => { trail.push(relation.target); section = "overview"; }), button("移除关系", () => runtime.removeObjectLink(object, `relation:${relation.id}`))); }
  }
  function renderWorldbook() {
    const tools = card("该对象的世界书条目"); tools.append(button("添加知识条目", async () => { formMode = { type: "worldbook" }; }));
    for (const entry of object.worldbook.entries) { const box = card(entry.comment); box.append(node("p", `${entry.enabled ? "启用" : "关闭"} · ${entry.route}`, "om-small"), button("编辑条目", async () => { formMode = { type: "worldbook", entry }; })); }
  }
  async function renderSchedule() {
    const form = card("一周与节假日日程");
    const locations = await runtime.availableLocations(), events = await runtime.store.listObjects("event");
    const days = [...WEEKDAYS.map((day, i) => [day, dayLabels[i]]), ...Object.keys(object.holidays).map((id) => [`holiday:${id}`, `节假日 ${id}`])];
    const selectedDay = days.some(([id]) => id === scheduleDay) ? scheduleDay : WEEKDAYS[0];
    const picker = select(form, "日期类型", days, selectedDay);
    const holidayId = input(form, "添加节假日标识（例如 summer-break）", "");
    form.append(button("添加节假日", async () => { if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(holidayId.value)) throw new Error("节假日标识使用字母、数字和连字符"); object.holidays[holidayId.value] ??= { defaultLocation: null, entries: [] }; await runtime.saveObjectDefinition(object); }));
    const locationOptions = [["", "空 / 无指定地点"], ...locations.map((item) => [item.id, item.name])];
    const defaultLocation = select(form, "整份日程空日默认地点", locationOptions, object.defaultLocation?.id ?? "");
    form.append(button("保存默认地点", async () => { object.defaultLocation = defaultLocation.value ? { kind: "location", id: defaultLocation.value } : null; await runtime.saveObjectDefinition(object); }));
    const rows = node("div"); form.append(rows);
    const showRows = () => {
      rows.replaceChildren();
      const key = picker.value; const day = key.startsWith("holiday:") ? object.holidays[key.slice(8)] : object.days[key];
      const dayDefault = select(rows, "此日默认地点", locationOptions, day.defaultLocation?.id ?? "");
      const edits = [];
      for (const entry of day.entries) {
        const box = node("article", "", "om-card"); rows.append(box);
        const start = input(box, "开始", entry.start, "time"), end = input(box, "结束", entry.end, "time"), place = select(box, "地点", locationOptions, entry.location?.id ?? ""), event = select(box, "事件对象", [["", "不引用事件"], ...events.map((item) => [item.id, item.name])], entry.event?.id ?? ""), note = input(box, "日程说明", entry.note, "textarea");
        edits.push({ entry, start, end, place, event, note });
        box.append(button("移除此日程项", async () => { day.entries = day.entries.filter((item) => item.id !== entry.id); await runtime.saveObjectDefinition(object); }));
      }
      rows.append(button("保存这一天", async () => { day.defaultLocation = dayDefault.value ? { kind: "location", id: dayDefault.value } : null; day.entries = edits.map(({ entry, start, end, place, event, note }) => ({ ...entry, start: start.value, end: end.value, location: place.value ? { kind: "location", id: place.value } : null, event: event.value ? { kind: "event", id: event.value } : null, note: note.value })); await runtime.saveObjectDefinition(object); }), button("新增日程项", async () => { day.entries.push({ id: `entry-${crypto.randomUUID()}`, start: "09:00", end: "10:00", location: null, event: null, note: "", enabled: true }); await runtime.saveObjectDefinition(object); }));
    };
    picker.addEventListener("change", () => { scheduleDay = picker.value; showRows(); }); showRows();
  }
  async function renderForm() {
    const mode = formMode; const form = card("结构编辑");
    form.append(button("取消", async () => { formMode = null; }));
    if (mode.type === "element") {
      const existing = mode.element;
      const title = input(form, "元素名称", existing?.label ?? ""); title.required = true;
      const type = select(form, "元素类型", ELEMENT_TYPES.map((id) => [id, { text: "短文本", textarea: "长文本", number: "数字", boolean: "开关", choice: "选项", record: "记录集合", list: "列表集合", group: "分组" }[id]]), existing?.type ?? "text");
      const audience = select(form, "模型可见范围", [["local", "仅本地"], ["shared", "剧情与更新共享"], ["plot", "仅剧情"], ["update", "仅更新"], ["both", "两种显式路由"]], existing?.audience ?? "local");
      const choices = input(form, "选项（逗号分隔；仅选项类型需要）", existing?.choices?.join("，") ?? "");
      const unit = input(form, "数字单位（可空）", existing?.unit ?? "");
      const minimum = input(form, "数字下限（可空）", existing?.min ?? "", "number"), maximum = input(form, "数字上限（可空）", existing?.max ?? "", "number");
      const bindingSource = select(form, "值来源", [["", "独立元素值"], ["object", "当前对象字段（只读）"]], existing?.binding?.source ?? "");
      const bindingPath = input(form, "只读绑定路径（例如 /state/score）", existing?.binding?.path ?? "");
      const conditional = input(form, "启用脚本前置条件", Boolean(existing?.when), "checkbox");
      const conditionPath = input(form, "条件路径（例如 /values/focus 或 /owner/state/score）", existing?.when?.path ?? "");
      const conditionOp = select(form, "条件比较", [["eq", "等于"], ["ne", "不等于"], ["gte", "大于等于"], ["lte", "小于等于"], ["gt", "大于"], ["lt", "小于"], ["exists", "存在"]], existing?.when?.op ?? "eq");
      const conditionValueType = select(form, "条件值类型", [["text", "文本"], ["number", "数字"], ["boolean", "开关"]], typeof existing?.when?.value === "number" ? "number" : typeof existing?.when?.value === "boolean" ? "boolean" : "text");
      const conditionValue = input(form, "条件值", existing?.when?.value ?? "");
      const complexCondition = existing?.when && !existing.when.path;
      if (complexCondition) form.append(node("p", "当前组合条件保持原配置；取消勾选可移除条件。", "om-small"));
      const updateFieldControls = () => {
        choices.parentElement.hidden = type.value !== "choice";
        for (const control of [unit, minimum, maximum]) control.parentElement.hidden = type.value !== "number";
        audience.parentElement.hidden = type.value === "group";
        bindingSource.parentElement.hidden = type.value === "group";
        bindingPath.parentElement.hidden = type.value === "group" || !bindingSource.value;
        for (const control of [conditionPath, conditionOp, conditionValueType, conditionValue]) control.parentElement.hidden = !conditional.checked || complexCondition;
      };
      type.addEventListener("change", updateFieldControls); bindingSource.addEventListener("change", updateFieldControls); conditional.addEventListener("change", updateFieldControls); updateFieldControls();
      form.append(button("保存元素", async () => {
        if (!title.value.trim()) throw new Error("请填写元素名称");
        if (conditional.checked && !complexCondition && conditionOp.value !== "exists" && conditionValueType.value === "boolean" && !["true", "false"].includes(conditionValue.value)) throw new Error("开关条件值须填写 true 或 false");
        const id = existing?.id ?? `element-${crypto.randomUUID()}`;
        const next = type.value === "group" ? { ...(existing ?? {}), id, label: title.value.trim(), type: "group", elements: existing?.type === "group" ? existing.elements : [], enabled: existing?.enabled !== false } : { ...(existing ?? {}), id, label: title.value.trim(), type: type.value, audience: audience.value, choices: choices.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean), binding: bindingSource.value ? { source: bindingSource.value, path: bindingPath.value } : null, unit: unit.value, min: minimum.value === "" ? null : Number(minimum.value), max: maximum.value === "" ? null : Number(maximum.value), enabled: existing?.enabled !== false };
        next.when = !conditional.checked ? null : complexCondition ? existing.when : { path: conditionPath.value, op: conditionOp.value, ...(conditionOp.value === "exists" ? {} : { value: conditionValueType.value === "number" ? Number(conditionValue.value) : conditionValueType.value === "boolean" ? conditionValue.value === "true" : conditionValue.value }) };
        function replace(nodes) { return nodes.map((item) => item.id === id ? next : item.type === "group" ? { ...item, elements: replace(item.elements) } : item); }
        if (existing) {
          // Renaming a group or changing its condition must preserve every child value.
          if (next.type !== existing.type) for (const item of flattenElements([existing])) delete object.values[item.id];
          else if (next.type !== "group" && next.binding) delete object.values[id];
          object.elements = replace(object.elements);
        }
        else if (mode.parent) flattenElements(object.elements).find((item) => item.id === mode.parent).elements.push(next);
        else object.elements.push(next);
        await runtime.saveObjectDefinition(object); formMode = null; section = "elements";
      }));
    } else if (mode.type === "create-object") {
      const type = select(form, "对象类", OBJECT_KINDS.map((id) => [id, labels[id]]), mode.kind ?? object.kind);
      const name = input(form, "对象名称", "");
      const description = input(form, "说明", "", "textarea");
      const typeId = input(form, "自定义类标识（例如 skill / organization）", "custom");
      const condition = input(form, "任务/成就完成条件", "", "textarea");
      const updateObjectControls = () => { typeId.parentElement.hidden = type.value !== "custom"; condition.parentElement.hidden = !["task", "achievement"].includes(type.value); };
      type.addEventListener("change", updateObjectControls); updateObjectControls();
      form.append(button("创建并关联", async () => {
        if (!name.value.trim()) throw new Error("请填写对象名称");
        const kind = type.value;
        const value = { kind, id: `${kind}-${crypto.randomUUID()}`, name: name.value.trim(), ...(kind === "character" ? { summary: description.value } : ["task", "achievement"].includes(kind) ? { definition: { description: description.value, completion: { mode: "narrative", text: condition.value }, rewards: {} } } : { data: { description: description.value } }), ...(kind === "custom" ? { typeId: typeId.value } : {}) };
        const child = await runtime.createChildObject(object, value); trail.push({ kind: child.kind, id: child.id }); formMode = null; section = kind === "schedule" ? "schedule" : "overview";
      }));
    } else if (mode.type === "link-object") {
      const objects = (await allObjects()).filter((item) => refKey(item) !== refKey(object));
      const target = select(form, "对象", objects.map((item) => [refKey(item), `${labels[item.kind]} · ${item.name}`]), objects[0] ? refKey(objects[0]) : "");
      const relation = select(form, "关联方式", [["reference", "引用 / 可共享"], ["owned", "包含 / 唯一归属"]], "reference");
      const label = input(form, "分区名称", "");
      form.append(button("保存关联", async () => { const selected = objects.find((item) => refKey(item) === target.value); if (!selected) throw new Error("没有可选对象"); await runtime.attachChildObject(object, selected, { mode: relation.value, label: label.value }); formMode = null; section = "children"; }));
    } else if (mode.type === "location-parent") {
      const name = input(form, "新增父地点名称", ""), description = input(form, "父地点说明", "", "textarea");
      form.append(button("创建上级并保留整个子树", async () => { if (!name.value.trim()) throw new Error("请填写父地点名称"); const parent = await runtime.insertLocationParent(object, { kind: "location", id: `location-${crypto.randomUUID()}`, name: name.value.trim(), data: { description: description.value }, ui: { board: { enabled: true, columns: 3 } } }); trail = [parent]; formMode = null; section = "overview"; }));
    } else if (mode.type === "relation") {
      const characters = (await runtime.store.listObjects("character")).filter((item) => item.id !== object.id);
      const target = select(form, "关联角色", characters.map((item) => [item.id, item.name]), mode.relation?.target.id ?? characters[0]?.id);
      const type = input(form, "关系类型", mode.relation?.type ?? "朋友"), summary = input(form, "关系说明", mode.relation?.summary ?? "", "textarea");
      form.append(button("保存关系", async () => { if (!target.value) throw new Error("没有其他角色"); await runtime.saveCharacterRelation(object, { ...(mode.relation ?? {}), target: { kind: "character", id: target.value }, type: type.value, summary: summary.value }); formMode = null; }));
    } else if (mode.type === "worldbook") {
      const title = input(form, "条目标题（支持 mvu_plot / mvu_update 前缀）", mode.entry?.comment ?? "[mvu_plot]对象资料"), content = input(form, "知识内容", mode.entry?.content ?? "", "textarea"), enabled = input(form, "启用", mode.entry?.enabled !== false, "checkbox");
      form.append(button("保存条目", async () => { const entry = { ...(mode.entry ?? {}), id: mode.entry?.id ?? `entry-${crypto.randomUUID()}`, comment: title.value, content: content.value, enabled: enabled.checked, constant: mode.entry?.constant ?? true }; object.worldbook.entries = [...object.worldbook.entries.filter((item) => item.id !== entry.id), entry]; await runtime.saveObjectDefinition(object); formMode = null; }));
    }
  }
  await render();
  return { refresh: render, destroy() { alive = false; boardPanel?.destroy(); releaseImages(); container.replaceChildren(); } };
}
