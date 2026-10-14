import { normalizeCharacter, normalizeRef, normalizeSchedule, refKey } from "./contracts.mjs";

function parseMinutes(value) {
  if (String(value).trim() === "24:00") return 1440;
  const match = String(value ?? "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error(`invalid time: ${String(value)}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function validateRange(value) {
  const start = parseMinutes(value.start);
  const end = parseMinutes(value.end);
  if (start >= 1440 || start >= end) throw new Error("schedule time range must have start < end (split overnight ranges by day)");
  return { start, end };
}

function formatMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function rangesOverlap(left, right) {
  const a = validateRange(left), b = validateRange(right);
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

export function resolveScheduleDay(schedule, { weekday, holidayId = "" }) {
  const value = normalizeSchedule(schedule);
  const holiday = String(holidayId ?? "").trim();
  if (holiday && value.holidays[holiday]) return { source: `holiday:${holiday}`, ...value.holidays[holiday] };
  const day = String(weekday ?? "").trim().toLowerCase();
  if (!value.days[day]) throw new Error(`unsupported weekday: ${weekday}`);
  return { source: `day:${day}`, ...value.days[day] };
}

function effectiveDefaultLocation(schedule, day) {
  return day.defaultLocation ?? schedule.defaultLocation ?? schedule.emptyPolicy.location ?? null;
}

export function findScheduleIntersections(schedule, userWindow) {
  const userRange = validateRange(userWindow);
  const value = normalizeSchedule(schedule);
  const day = resolveScheduleDay(value, userWindow);
  const userLocation = normalizeRef(userWindow.location, "location");
  const enabled = day.entries.filter((entry) => entry.enabled);
  if (enabled.length === 0) {
    const location = effectiveDefaultLocation(value, day);
    if (!location || refKey(location) !== refKey(userLocation)) return [];
    return [{
      schedule: { kind: "schedule", id: value.id },
      entryId: `${day.source}:empty`,
      start: String(userWindow.start),
      end: String(userWindow.end),
      location,
      event: value.emptyPolicy.event,
      source: day.source,
      empty: true,
    }];
  }
  const matches = enabled.filter((entry) => {
    const location = entry.location ?? effectiveDefaultLocation(value, day);
    return location && refKey(location) === refKey(userLocation) && rangesOverlap(entry, userWindow);
  }).map((entry) => ({
    schedule: { kind: "schedule", id: value.id },
    entryId: entry.id,
    start: formatMinutes(Math.max(parseMinutes(entry.start), userRange.start)),
    end: formatMinutes(Math.min(parseMinutes(entry.end), userRange.end)),
    location: entry.location ?? effectiveDefaultLocation(value, day),
    event: entry.event,
    note: entry.note,
    source: day.source,
    empty: false,
  }));
  // The residence applies to each gap, not only to an entirely empty day.
  const home = effectiveDefaultLocation(value, day);
  if (home && refKey(home) === refKey(userLocation)) {
    let cursor = userRange.start;
    const occupied = enabled.map(validateRange).sort((a, b) => a.start - b.start);
    function gap(start, end) {
      if (start >= end) return;
      matches.push({ schedule: { kind: "schedule", id: value.id }, entryId: `${day.source}:idle-${start}`, start: formatMinutes(start), end: formatMinutes(end), location: home, event: value.emptyPolicy.event, note: "空闲，回住宅", source: day.source, empty: true });
    }
    for (const range of occupied) {
      if (range.end <= cursor || range.start >= userRange.end) continue;
      gap(cursor, Math.min(range.start, userRange.end));
      cursor = Math.max(cursor, Math.min(range.end, userRange.end));
    }
    gap(cursor, userRange.end);
  }
  return matches.sort((a, b) => a.start.localeCompare(b.start));
}

export async function collectCharacterScheduleIntersections({ activeCharacters, userWindow, resolveObject }) {
  const results = [];
  for (const rawCharacter of activeCharacters) {
    const character = normalizeCharacter(rawCharacter);
    if (!character.refs.schedule) continue;
    const schedule = await resolveObject(character.refs.schedule);
    if (!schedule) throw new Error(`missing schedule ${refKey(character.refs.schedule)} for character ${character.id}`);
    const matches = findScheduleIntersections(schedule, userWindow);
    if (matches.length) results.push({ character: { kind: "character", id: character.id }, name: character.name, matches });
  }
  return results;
}

export function scheduleIntersectionsToHiddenPrompt(intersections, userWindow) {
  if (!Array.isArray(intersections) || intersections.length === 0) return null;
  const location = normalizeRef(userWindow.location, "location");
  const lines = intersections.map((item) => {
    const details = item.matches.map((match) => `${match.start}-${match.end}${match.note ? ` ${match.note}` : ""}${match.event ? ` event=${refKey(match.event)}` : ""}`).join("; ");
    return `- ${item.name} (${refKey(item.character)}): ${details}`;
  });
  return {
    id: `schedule-overlap:${String(userWindow.replyAnchor ?? "pending")}`,
    route: "plot",
    owner: { kind: "schedule", id: "user-overlap" },
    replyAnchor: String(userWindow.replyAnchor ?? ""),
    dependencies: intersections.map((item) => item.character),
    content: [
      "<schedule_location_overlap>",
      `USER=${String(userWindow.start)}-${String(userWindow.end)} location=${refKey(location)}`,
      ...lines,
      "Only these loaded characters have a schedule overlap at the same stable location. Treat this as availability context, not guaranteed dialogue or forced appearance.",
      "</schedule_location_overlap>",
    ].join("\n"),
  };
}

export function scheduleIntersectionsToHiddenPrompts(intersections, userWindow) {
  return intersections.map((item) => {
    const prompt = scheduleIntersectionsToHiddenPrompt([item], userWindow);
    return { ...prompt, id: `${prompt.id}:${item.character.id}`, owner: item.character };
  });
}
