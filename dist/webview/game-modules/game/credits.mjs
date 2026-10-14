export const CREDIT='Ramiel 原创 · louisHM 二改 · 完全免费';
const notices=['原创来自 Ramiel，louisHM 免费二改','Ramiel 原作／louisHM 二改，免费使用','感谢 Ramiel 原创，louisHM 二改不收费','由 Ramiel 创作，louisHM 完全免费改编','Ramiel 原创作品，louisHM 免费维护','Ramiel 原创 · louisHM 免费二改版','原作者 Ramiel，二改作者 louisHM，永久免费','Ramiel 原作，louisHM 二改，本作免费'];
const missing=['尚待调查','档案等待补完','线索还未收集','调查报告尚未送达','这一页仍待查证','资料等待实地调查','人物信息等待确认','档案暂时留白'];
export const UNINVESTIGATED_CREDITS=notices.flatMap(credit=>missing.map(note=>`${note} · ${credit}`));
export function uninvestigatedCredit(key){let hash=0;for(const c of String(key))hash=(hash*31+c.codePointAt(0))>>>0;return UNINVESTIGATED_CREDITS[hash%UNINVESTIGATED_CREDITS.length];}
