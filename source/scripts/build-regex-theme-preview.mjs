import { mkdir, writeFile } from "node:fs/promises";
import {
  KUKI_CLOSING_REPLACEMENT,
  TEMPORAL_ROTATION_REPLACEMENT
} from "./regex-theme-contract.mjs";
import { TEMPORAL_CONVERGENCE_REPLACEMENT } from "./temporal-convergence-theme.mjs";

const fill = (template, captures) => template.replace(/\$(\d)/g, (_, index) => captures[Number(index)] ?? "");
const temporalCards = [
  fill(TEMPORAL_ROTATION_REPLACEMENT, ["", "其一", "4月10日 16:40", "私立斋明学园·旧校舍", "月咏深雪"]),
  fill(TEMPORAL_ROTATION_REPLACEMENT, ["", "其二", "4月10日 18:15", "西园寺宅邸·泳池", "西园寺爱丽莎"]),
  fill(TEMPORAL_CONVERGENCE_REPLACEMENT, ["", "4月10日 21:30", "西园寺宅邸·客厅"])
].join("");
const kukiCard = fill(KUKI_CLOSING_REPLACEMENT, [
  "",
  "",
  "她没有立刻现身。楼梯间的灯先灭了一盏，随后皮鞋跟敲过你身后的地面。九鬼真白用指节抵住你的肩胛，平静地提醒你：今天做过的每一件事，她都记得。"
]);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HypnoOS 正则主题预览</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,"Noto Sans SC",system-ui,sans-serif;background:#090b11;color:#eef2ff}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 0,#1a2438,transparent 34%),radial-gradient(circle at 90% 20%,#251524,transparent 30%),#090b11}
    header{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:16px clamp(16px,4vw,54px);border-bottom:1px solid #303849;background:rgba(8,10,16,.9);backdrop-filter:blur(16px)}
    header strong{font-size:clamp(16px,2vw,22px)}header span{color:#99a4bb;font-size:12px}
    main{width:min(1180px,calc(100% - 28px));margin:26px auto 56px;display:grid;gap:24px}
    .sample{border:1px solid #30384a;border-radius:18px;background:rgba(15,18,27,.92);box-shadow:0 20px 50px rgba(0,0,0,.3);overflow:hidden}
    .sample-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #2a3140;background:#111621}
    .sample-head b{font-size:14px}.sample-head small{margin-left:auto;color:#8995aa}
    .viewport{padding:clamp(14px,3vw,32px);background:linear-gradient(180deg,#17191e,#111317);font-size:16px}
    .temporal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .hint{margin:0;padding:11px 16px;border-top:1px solid #2a3140;color:#909bb0;font-size:12px;line-height:1.6}
    @media(max-width:760px){.temporal-grid{grid-template-columns:1fr}.viewport{font-size:14px}.sample-head small{display:none}}
  </style>
</head>
<body>
  <header><strong>正则主题实验室</strong><span>与角色卡共用同一替换模板 · 点击尾段标题可展开/收起</span></header>
  <main>
    <section class="sample">
      <div class="sample-head"><b>时空轮转与收束 · 时之笛式时间仪表</b><small>轮转：编号 / 时间 / 地点 / 视角；收束：最终时间 / 地点</small></div>
      <div class="viewport"><div class="temporal-grid">${temporalCards}</div></div>
      <p class="hint">森林神殿色、古金边框、乐符与时间圆盘构成转场；没有外部图片依赖。</p>
    </section>
    <section class="sample">
      <div class="sample-head"><b>九鬼真白的施虐 · 生化危机式危险档案</b><small>默认展开</small></div>
      <div class="viewport">${kukiCard}</div>
      <p class="hint">采用旧式生物危害档案、警戒条和打字机信息层级，长文本会自然换行。</p>
    </section>
  </main>
</body>
</html>`;

const output = new URL("../docs/previews/regex-theme-gallery.html", import.meta.url);
await mkdir(new URL("../docs/previews/", import.meta.url), { recursive: true });
await writeFile(output, html);
console.log(`Built ${output.pathname}`);
