export const TWIN_SPEAKER_NAME='织田信长 & 明智光秀';
const aliases=new Set(['织田信长','明智光秀','oda-nobunaga','akechi-mitsuhide','织田信长&明智光秀','织田信长＆明智光秀','织田信长与明智光秀','织田信长、明智光秀']);
export function sharedTwinSpeaker(name){const value=String(name??'');return aliases.has(value.replace(/\s/g,''))?TWIN_SPEAKER_NAME:value;}
export function sharedTwinCast(names){return [...new Set(names.map(sharedTwinSpeaker))];}
