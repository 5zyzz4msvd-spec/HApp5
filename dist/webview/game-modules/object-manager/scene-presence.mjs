import { notebookEligible, slotEligible } from './personnel-access.mjs';
import { overlayScheduleRows } from './personnel-business.mjs';
import { resolveScheduleDay } from "./schedule.mjs";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export function storyCalendar(system = {}) {
  const names = { 周一: "monday", 周二: "tuesday", 周三: "wednesday", 周四: "thursday", 周五: "friday", 周六: "saturday", 周日: "sunday", 星期一: "monday", 星期二: "tuesday", 星期三: "wednesday", 星期四: "thursday", 星期五: "friday", 星期六: "saturday", 星期日: "sunday" };
  let weekday = names[system._当前周几] ?? (weekdays.includes(system._当前周几) ? system._当前周几 : "");
  const date = String(system.当前日期 ?? "").match(/(?:(\d{4})[年/-])?(\d{1,2})[月/-](\d{1,2})/);
  if (!weekday && date) {
    const year = Number(date[1] || system.当前年份), month = Number(date[2]), day = Number(date[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year > 1900 && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) weekday = weekdays[parsed.getUTCDay()];
  }
  const special = String(system._当前特殊日期 ?? "");
  const holidayId = /暑假/.test(special) ? "summer-break" : /寒假/.test(special) ? "winter-break" : /春假/.test(special) ? "spring-break" : /放假|休校|节假日/.test(special) ? "school-holiday" : "";
  return { weekday, holidayId, time: String(system.当前时间 ?? "").match(/(?:^|\s)([0-2]?\d:[0-5]\d)(?:\s|$)/)?.[1] ?? "", locationText: String(system.当前地点 ?? "").trim() };
}

export function resolveSceneLocation(locations, token, aliases = {}) {
  if (token?.kind === "location") return locations.find((x) => x.id === token.id) ?? null;
  const text = String(token ?? "").trim();
  if (!text) return null;
  const candidates = locations.filter((x) => x.id === text || x.name === text || (x.data?.sourceMapId==='classroom'&&['教室','二年A组教室','二年A班教室'].includes(text)) || (x.aliases ?? []).includes(text) || (aliases[x.id] ?? []).includes(text));
  return candidates.length === 1 ? candidates[0] : null;
}
const minute = (value) => {
  if (value === "24:00") return 1440;
  const parts = String(value).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : NaN;
};

// This computes display availability. It never moves, mounts or mutates an actor.
export function actorsAtScene({ characters, schedules, location, weekday, holidayId = "", time, overrides = {} }) {
  const now = minute(time);
  if (!location || !Number.isFinite(now) || !weekdays.includes(weekday)) return [];
  const result = [];
  for (const actor of characters) {
    if (actor.id === "user") continue;
    const override = overrides[actor.id];
    if (override?.absent || override?.possessed || actor.name === "弥留子" && actor.values?.possessed === true) continue;
    if (override?.location) {
      if (override.location.id === location.id) result.push({ ...actor, activity: override.note ?? "在这里", entryId: "confirmed-presence" });
      continue;
    }
    const schedule = schedules.find((x) => x.id === actor.refs?.schedule?.id);
    if (!schedule) continue;
    const day = resolveScheduleDay(schedule, { weekday, holidayId });
    let row = day.entries.find((x) => x.enabled && minute(x.start) <= now && now < minute(x.end) && (x.location ?? day.defaultLocation ?? schedule.defaultLocation)?.id === location.id);
    const busy = day.entries.some((x) => x.enabled && minute(x.start) <= now && now < minute(x.end));
    if (!row && !busy && (day.defaultLocation ?? schedule.defaultLocation ?? schedule.emptyPolicy.location)?.id === location.id) row = { id: "default-routine", note: "空闲，回住宅" };
    if (row) result.push({ ...actor, activity: row.note, entryId: row.id });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));
}

export function chooseSceneActor(actors, selectedId) { return actors.find((x) => x.id === selectedId) ?? actors[0] ?? null; }

export function landscapeFit(viewport, { width = 1280, height = 600, safe = {} } = {}) {
  const availableWidth = Math.max(1, viewport.width - (safe.left ?? 0) - (safe.right ?? 0));
  const availableHeight = Math.max(1, viewport.height - (safe.top ?? 0) - (safe.bottom ?? 0));
  const scale = Math.min(availableWidth / width, availableHeight / height);
  return { scale, width, height, left: (safe.left ?? 0) + (availableWidth - width * scale) / 2, top: (safe.top ?? 0) + (availableHeight - height * scale) / 2, textPx: 32 * scale, targetPx: 84 * scale };
}

export async function readSceneObjects(runtime, { context = null, dateOverrides = {} } = {}) {
  const slots = await runtime.store.getCharacterSlots(), characters = (await runtime.store.listObjects("character")).filter(notebookEligible).map(x => ({ ...x, mounted: slotEligible(x)&&slots.some(s => s.enabled !== false && s.ref.id === x.id) }));
  const schedules = await runtime.store.listObjects("schedule");
  if (context?.weekday) for (const actor of characters) {
    const overlay = dateOverrides[actor.id] ?? [];
    const schedule = schedules.find(x => x.id === actor.refs.schedule?.id);
    if (!schedule || !overlay.length) continue;
    const day = resolveScheduleDay(schedule, context);
    // Keep the exact source intervals. Fixed notebook cells are display-only.
    const next = { ...day, entries: overlayScheduleRows(day.entries, overlay) };
    if (context.holidayId && schedule.holidays[context.holidayId]) schedule.holidays[context.holidayId] = next;
    else schedule.days[context.weekday] = next;
  }
  return { characters, schedules, locations: await runtime.availableLocations(), overrides: await runtime.store.readJson("context/scene-presence.json", {}) };
}
