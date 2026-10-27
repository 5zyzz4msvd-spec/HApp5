# louisHM 独立桌宠 · 1.0.0

仅含当前正式爱丽莎、百花的动画、拖拽、入退场和可配置圆形菜单，不含手机、笔记、库存、事件、人物卡槽或任何游戏窗口；不依赖 SillyTavern、角色卡、模型 API 或本地开发服务。请保留 louisHM 署名。

```js
import {createDesktopPet} from '替换为CDN目录/index.mjs';
const pet = createDesktopPet({
  container: document.body,
  initialCharacter: 'alisa', // 或 hyakka
  storageKey: 'my-site-pet', // 每个实例使用独立键；记忆位置和人物
  zIndex: 100, // 宿主弹窗应高于此值
  menu: [
    {id:'notes', label:'我的笔记', iconText:'✎', onClick:({character,pet})=>openMyNotes()},
    {id:'tools', label:'工具', icon:'people', disabled:false, visible:true, onClick:()=>openMyTools()},
    {id:'switch', label:'换人', iconText:'↔'},
  ],
  menuLayout: {radius:90, startAngle:-90},
  theme: {menuSize:'52px', menuColor:'#fff', menuBackground:'#42324f'},
  onCharacter: role => console.log(role),
});
await pet.ready;
pet.setMenu([{id:'hello',label:'你好',iconText:'♡',onClick:()=>{}}]);
pet.place({x:80,y:140},{persist:true});
await pet.switchCharacter();
pet.destroy(); // 清理 DOM、监听、动画、定时器，允许重新创建
```

- 菜单默认只有“换人”，传 `[]` 可清空。顺序按数组；名称和 iconText 为纯文本；icon 为内置图标名，className 可用来标识按钮。不会执行 HTML 图标。
- 支持 `ariaLabel`、`visible`、`disabled`；回调接收 `{id,character,pet}`，可以打开你自己的窗口。回调错误通过 `pet.root` 的 `pet-action-error` 事件报告。
- 外观在开放 Shadow DOM 内；可通过 `pet.host.shadowRoot` 添加自定义样式。menuLayout 半径至少40px；入口较多时应设置更大的半径并保证可用屏幕空间。
- 相同 CDN 版本目录会自动定位同仓库正式素材；自托管时传 `assetBase`，其下需有 `pet/v6/manifest.json` 和对应素材。素材按人物加载；因仓库超过 jsDelivr 50MB 限额，默认素材使用同一提交的 GitHub Raw 公共地址，JS 使用 jsDelivr。
- 示例 `demo.html` 需放到你自己的 HTTP(S) 站点（jsDelivr 会将 HTML 当文本提供）。用 HTTP(S) 页面接入，需要允许 CDN 脚本、图片和 fetch；不支持直接以 file:// 双击运行。
- 本目录只发布压缩 ESM 运行产物，无源码或 source map。动画素材复用仓库现有正式版本，不复制旧图。
