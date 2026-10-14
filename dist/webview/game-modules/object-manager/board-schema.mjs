export const BOARD_MAX_ROWS = 64;
export const BOARD_DWELL_MS = 1000;
export const BOARD_LONG_PRESS_MS = 450;

export function normalizeLocationBoard(value, children = []) {
  const childIds = children.map((ref) => ref.id), ids = new Set(childIds);
  const columns = value?.columns ?? 3;
  if (!Number.isInteger(columns) || columns < 2 || columns > 6) throw new Error("board columns must be 2–6");
  const supplied = value?.cells ?? [];
  if (!Array.isArray(supplied) || supplied.length > columns * BOARD_MAX_ROWS) throw new Error("board cells exceed allowed size");
  const seen = new Set();
  const cells = supplied.map((id) => {
    if (id === null) return null;
    if (typeof id !== "string" || !ids.has(id) || seen.has(id)) throw new Error("board pieces must be unique direct children");
    seen.add(id); return id;
  });
  for (const id of childIds.filter((id) => !seen.has(id))) { const empty = cells.indexOf(null); if (empty >= 0) cells[empty] = id; else cells.push(id); }
  while (cells.length && cells.at(-1) === null) cells.pop();
  while (cells.length % columns) cells.push(null);
  if (cells.length > columns * BOARD_MAX_ROWS) throw new Error("board exceeds maximum rows");
  return { enabled: Boolean(value?.enabled && childIds.length), columns, cells };
}

export function swapLocationBoard(board, from, to, children) {
  const normalized = normalizeLocationBoard(board, children), cells = [...normalized.cells];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= cells.length || !cells[from] || to >= normalized.columns * BOARD_MAX_ROWS) throw new Error("invalid board swap");
  while (cells.length <= to) cells.push(null);
  [cells[from], cells[to]] = [cells[to] ?? null, cells[from]];
  return normalizeLocationBoard({ ...normalized, cells }, children);
}

// Transient rows only exist during an active drag and after a continuous dwell.
export class BoardDwellController {
  constructor({ dwellMs = BOARD_DWELL_MS, onExtend, schedule = setTimeout, cancel = clearTimeout }) { this.dwellMs = dwellMs; this.onExtend = onExtend; this.schedule = schedule; this.cancel = cancel; this.timer = null; this.active = false; this.bottom = false; }
  begin() { this.end(); this.active = true; }
  hoverBottom(value) {
    if (!this.active || !value) { this.bottom = false; this.clear(); return; }
    this.bottom = true;
    if (this.timer !== null) return;
    this.timer = this.schedule(() => { this.timer = null; if (this.active && this.bottom) { this.bottom = false; this.onExtend(); } }, this.dwellMs);
  }
  clear() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  end() { this.active = false; this.bottom = false; this.clear(); }
}
