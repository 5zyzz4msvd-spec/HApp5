import { BOARD_LONG_PRESS_MS, BOARD_DWELL_MS, BOARD_MAX_ROWS, BoardDwellController } from "./board-schema.mjs";

export async function mountLocationBoard(container, { runtime, locationRef, onOpen = () => {}, onChanged = () => {} }) {
  let object = await runtime.store.getObject(locationRef), cells = [...object.ui.board.cells], selected = null, pending = null, drag = null, pressTimer = null, frame = null, alive = true, busy = false;
  const root = document.createElement("section"); root.className = "om-location-board";
  const style = document.createElement("style"); style.textContent = `.om-location-board{position:relative;margin:12px 0}.om-board-grid{display:grid;gap:6px;isolation:isolate}.om-phone .om-board-cell{position:relative;margin:0;min-height:84px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;touch-action:none;user-select:none;border:1px solid #4c5970;border-radius:12px;background:linear-gradient(140deg,#39475b,#263243);transition:background .15s,box-shadow .15s,opacity .15s}.om-board-cell strong{font:600 11px/1.35 system-ui,sans-serif;overflow-wrap:anywhere;max-width:100%;pointer-events:none}.om-board-cell small{font-size:9px;opacity:.7;pointer-events:none}.om-phone .om-board-cell.is-empty{background:#1a202b;border-style:dashed;opacity:.45}.om-phone .om-board-cell.is-target{box-shadow:inset 0 0 0 2px #edd098,0 0 18px #d6b37e44;background:#645642;opacity:1}.om-board-cell.is-source{opacity:.25;transform:scale(.93)}.om-board-cell.is-picked{outline:2px solid #d6b37e}.om-board-symbol{font-size:23px;pointer-events:none}.om-board-ghost{position:fixed;pointer-events:none;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#465875ee;border:2px solid #ead09d;border-radius:12px;color:#fff;box-shadow:0 14px 35px #0008;transform:rotate(-3deg) scale(1.05);will-change:left,top}.om-board-ghost strong{font:600 12px system-ui,sans-serif;max-width:95%;overflow-wrap:anywhere;text-align:center}.om-board-footer{height:28px;display:flex;align-items:center;justify-content:center;font:10px system-ui,sans-serif;color:#adb9c9;transition:background .2s}.om-board-footer.is-dwelling{color:#f4d59c;background:#70592c44;border-radius:8px}.om-board-tools{display:flex;gap:6px;align-items:center;margin-top:7px}.om-board-hint{font:11px/1.6 system-ui,sans-serif;color:#bbc7d8;margin:8px 0}.om-board-path{font:11px/1.7 system-ui,sans-serif;color:#e5c692;overflow-wrap:anywhere}@media(prefers-reduced-motion:reduce){.om-board-cell{transition:none}}`;
  const grid = document.createElement("div"), footer = document.createElement("div"), hint = document.createElement("p"), status = document.createElement("p"), tools = document.createElement("div");
  grid.className = "om-board-grid"; grid.style.gridTemplateColumns = `repeat(${object.ui.board.columns},minmax(0,1fr))`; grid.setAttribute("aria-label", "子地点棋盘");
  footer.className = "om-board-footer"; hint.className = "om-board-hint"; hint.textContent = "长按棋子拖拽交换位置；底边停留 1 秒才增加一行。松手后自动保存，末行不留空。";
  status.className = "om-notice"; status.setAttribute("role", "status"); tools.className = "om-board-tools";
  const moveButton = document.createElement("button"); moveButton.type = "button"; moveButton.textContent = "点选换位";
  moveButton.addEventListener("click", () => { selected = selected === "pick" ? null : "pick"; hint.textContent = selected === "pick" ? "先选棋子，再点任意位置交换。再次点击可取消。" : "长按拖拽交换；底部停留 1 秒扩展。"; renderCells(); });
  tools.append(moveButton); root.append(hint, grid, footer, tools, status); container.append(style, root);
  const children = new Map(); for (const ref of object.children) children.set(ref.id, await runtime.store.getObject(ref));
  const scroller = container.closest(".om-list") ?? container.closest(".st-lite-body");
  const dwell = new BoardDwellController({ onExtend() {
    if (!drag || cells.length / object.ui.board.columns >= BOARD_MAX_ROWS) return;
    cells.push(...Array(object.ui.board.columns).fill(null)); renderCells(); footer.classList.remove("is-dwelling"); status.textContent = "已展开一行，将棋子放入后保留。";
    scroller?.scrollBy({ top: 90, behavior: "smooth" });
  } });
  function clearPress() { if (pressTimer !== null) clearTimeout(pressTimer); pressTimer = null; }
  function renderCells() {
    grid.replaceChildren(); footer.textContent = drag ? "拖到底边停留 1 秒展开下一行" : `直接子地点 ${object.children.length} · ${cells.length / object.ui.board.columns} 行`;
    cells.forEach((id, index) => {
      const cell = document.createElement("button"); cell.type = "button"; cell.className = `om-board-cell${id ? "" : " is-empty"}${drag?.from === index ? " is-source" : ""}${selected === index ? " is-picked" : ""}`; cell.dataset.boardIndex = String(index);
      const item = id ? children.get(id) : null;
      cell.setAttribute("aria-label", `棋盘位置 ${Math.floor(index / object.ui.board.columns) + 1} 行 ${index % object.ui.board.columns + 1} 列${item ? " · " + item.name : " · 空位"}`);
      if (item) { const icon = document.createElement("span"), name = document.createElement("strong"), info = document.createElement("small"); icon.className = "om-board-symbol"; icon.textContent = item.ui.symbol ?? (item.children.length ? "▦" : "◇"); name.textContent = item.name; info.textContent = item.children.length ? `${item.children.length} 个下级` : item.data.category ?? "地点"; cell.dataset.locationPiece = item.id; cell.append(icon, name, info); }
      else { const empty = document.createElement("small"); empty.textContent = "空位"; cell.append(empty); }
      cell.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        if (drag || pending || busy || performance.now() < suppressClickUntil) return;
        if (selected === "pick") { if (id) { selected = index; renderCells(); } }
        else if (typeof selected === "number") { const from = selected; selected = null; void saveSwap(from, index); }
        else if (id) onOpen({ kind: "location", id });
      });
      grid.append(cell);
    });
  }
  let suppressClickUntil = 0;
  function rects() { return new Map([...grid.querySelectorAll("[data-location-piece]")].map((item) => [item.dataset.locationPiece, item.getBoundingClientRect()])); }
  async function saveSwap(from, to) {
    if (busy) return; busy = true; const before = rects(); status.textContent = "保存棋盘…";
    try {
      const board = await runtime.swapLocationCells(locationRef, from, to); object.ui.board = board; cells = [...board.cells]; renderCells();
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) for (const item of grid.querySelectorAll("[data-location-piece]")) { const previous = before.get(item.dataset.locationPiece), next = item.getBoundingClientRect(); if (previous) item.animate([{ transform: `translate(${previous.x - next.x}px,${previous.y - next.y}px) scale(.96)` }, { transform: "translate(0,0) scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }); }
      status.textContent = "棋盘位置已保存。"; await onChanged();
    } catch (error) { cells = [...object.ui.board.cells]; renderCells(); status.textContent = error.message; }
    finally { busy = false; }
  }
  function finish(cancel = false) {
    clearPress(); dwell.end(); footer.classList.remove("is-dwelling");
    const current = drag, pendingId = pending?.pointerId; pending = null; drag = null;
    if (frame !== null) cancelAnimationFrame(frame); frame = null;
    if (pendingId !== undefined && root.hasPointerCapture(pendingId)) root.releasePointerCapture(pendingId);
    if (!current) return;
    suppressClickUntil = performance.now() + 450; current.ghost.remove();
    if (current.pointerId !== undefined && root.hasPointerCapture(current.pointerId)) root.releasePointerCapture(current.pointerId);
    if (!cancel && current.to !== null) void saveSwap(current.from, current.to);
    else { cells = [...object.ui.board.cells]; renderCells(); }
  }
  function startDrag() {
    if (!pending || busy) return;
    const cell = grid.querySelector(`[data-board-index="${pending.from}"]`), rect = cell.getBoundingClientRect(), ghost = cell.cloneNode(true);
    ghost.className = "om-board-ghost"; ghost.removeAttribute("aria-label"); ghost.setAttribute("aria-hidden", "true"); ghost.style.width = `${rect.width}px`; ghost.style.height = `${rect.height}px`; document.body.append(ghost);
    drag = { ...pending, ghost, width: rect.width, height: rect.height, to: pending.from }; root.setPointerCapture(pending.pointerId); pending = null; dwell.begin(); renderCells(); positionDrag(drag.x, drag.y);
    const tick = () => { if (!drag || !alive) return; positionDrag(drag.x, drag.y); frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick);
    ghost.animate([{ opacity: .5, transform: "scale(.95)" }, { opacity: 1, transform: "rotate(-3deg) scale(1.05)" }], { duration: 160 });
  }
  function positionDrag(x, y) {
    if (!drag) return;
    drag.x = x; drag.y = y;
    drag.ghost.style.left = `${x - drag.width / 2}px`; drag.ghost.style.top = `${y - drag.height / 2}px`;
    drag.to = null;
    for (const cell of grid.children) { const rect = cell.getBoundingClientRect(), hit = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom; cell.classList.toggle("is-target", hit); if (hit) drag.to = Number(cell.dataset.boardIndex); }
    const rect = grid.getBoundingClientRect(), atBottom = x >= rect.left && x <= rect.right && y >= rect.bottom - 24 && y <= rect.bottom + 26;
    dwell.hoverBottom(atBottom); footer.classList.toggle("is-dwelling", atBottom);
    if (scroller && !atBottom) { const area = scroller.getBoundingClientRect(); if (y < area.top + 25) scroller.scrollBy({ top: -12 }); else if (y > area.bottom - 25) scroller.scrollBy({ top: 12 }); }
  }
  root.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest("[data-board-index]"); if (!cell || event.button !== 0 || busy || !cells[Number(cell.dataset.boardIndex)] || selected !== null) return;
    pending = { pointerId: event.pointerId, from: Number(cell.dataset.boardIndex), x: event.clientX, y: event.clientY, previousY: event.clientY, touch: event.pointerType === "touch", panning: false }; clearPress(); pressTimer = setTimeout(startDrag, BOARD_LONG_PRESS_MS);
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener("pointermove", (event) => {
    if (drag?.pointerId === event.pointerId) { event.preventDefault(); positionDrag(event.clientX, event.clientY); }
    else if (pending?.pointerId === event.pointerId) { const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8; if (moved) { clearPress(); pending.panning = true; if (pending.touch) scroller?.scrollBy({ top: pending.previousY - event.clientY }); } pending.previousY = event.clientY; }
  });
  root.addEventListener("pointerup", (event) => { if (drag?.pointerId === event.pointerId) { event.preventDefault(); finish(); } else if (pending?.pointerId === event.pointerId) { const current = pending; suppressClickUntil = performance.now() + 450; clearPress(); pending = null; if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId); if (!current.panning && cells[current.from]) onOpen({ kind: "location", id: cells[current.from] }); } });
  root.addEventListener("contextmenu", (event) => { if (event.target.closest("[data-board-index]")) event.preventDefault(); });
  root.addEventListener("pointercancel", () => finish(true)); root.addEventListener("lostpointercapture", () => { if (drag) finish(true); });
  renderCells();
  return { destroy() { alive = false; finish(true); root.remove(); style.remove(); }, async refresh() { if (!alive) return; finish(true); object = await runtime.store.getObject(locationRef); cells = [...object.ui.board.cells]; renderCells(); } };
}
