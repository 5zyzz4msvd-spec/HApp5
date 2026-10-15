import {scoutingAvailable,SCOUTING_COMING_SOON} from './personnel-access.mjs';
import {contentPolicyFieldApplicable} from '../safety/character-content-policy-client.mjs';
export const SCOUTING_VOLUME_SIZE = 6;
export const SCOUTING_SPREADS_PER_PERSON = 2;
export function scoutingPageAt(rows, index) {
  return { row: rows[Math.floor(index / 4)] ?? null, kind: ['profile','standee','information','clothing'][index % 4] };
}
export function scoutingNavigation(current, action, count) {
  const direction = action.startsWith('previous') ? -1 : 1;
  const volumeSpreads=SCOUTING_VOLUME_SIZE*SCOUTING_SPREADS_PER_PERSON;
  const target = action.includes('volume') ? (Math.floor(current / volumeSpreads) + direction) * volumeSpreads : current + direction;
  return Math.max(0, Math.min(Math.max(0, count * SCOUTING_SPREADS_PER_PERSON - 1), target));
}
export function scoutingFields(row, kind) {
  const fields=kind==='clothing'?row?.clothing:row?.information;
  return Object.entries(fields??{}).filter(([label])=>contentPolicyFieldApplicable(row,label)).map(([label,value])=>({label:label==='_年龄'?'年龄':label,value:String(value)}));
}

export function scoutingAction(row, price) {
  const allowed = scoutingAvailable(row) && row?.scoutingAllowed !== false;
  return {allowed, label:allowed ? `委托物色 · ¥${price}` : SCOUTING_COMING_SOON, reason:allowed ? '' : SCOUTING_COMING_SOON};
}
