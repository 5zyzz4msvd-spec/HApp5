# 催眠app二改 v5.0 源码

本目录是“催眠app二改 v5.0（louisHM 完全免费）”的可维护源码，包含角色卡封装脚本、世界书与 MVU 合同、桌面/手机前端真源、素材和验证器。发布产物位于同一仓库根目录的 `../dist/`。

从 `HApp5` Fork 后，先进入源码目录：

```bash
cd source
npm install
```

当前只维护 v5.0。本地卡与发布卡均由脚本生成到被 Git 忽略的 `public/cards/`，不把 PNG 成品当作源码修改。

角色卡封装脚本会读取一张已有的 v5.0 基卡；该 PNG 不放进 `source/`（发布卡内部需要引用本次远程 commit，无法把自身再放进同一 commit）。需要重新封装时，请先从原作者提供的 v5.0 卡复制到下面任一路径，再运行对应脚本：

```text
public/cards/催眠app二改 v5.0（louisHM 完全免费） 本地版.png
public/cards/催眠app二改 v5.0（louisHM 完全免费） 发布版.png
```

## 运行

```bash
npm run dev
```

然后打开：

```text
http://localhost:5173
```

## 本地前端镜像

开发阶段默认预览本地镜像：

```text
public/frontends/hypnosis-app/index.html
```

重新从本地基底生成镜像：

```bash
npm run mirror:frontend
```

默认基底已经固定在工作区内：

```text
public/frontends/hypnosis-app/source.html
```

如果确实要更新远程原始前端，先刷新本地基底，再重新生成镜像：

```bash
npm run refresh:frontend-source
npm run mirror:frontend
```

也可以临时直接用远程源生成一次：

```bash
npm run mirror:frontend:remote
```

从角色卡旧匿名版正则提取 MChan 本地镜像。`mirror:frontend` 会读取这个镜像里的种子帖，注入到手机内部的静态只读匿名版页面：

```bash
npm run extract:mchan
```

## 能做什么

- 编辑成就和任务条目，支持增删查改、复制和批量合并/替换。
- 奖励使用 `星光点` 和可选物品，物品包含名称、描述和数量。
- 本地封装会写入 `public/cards/催眠app二改 v5.0（louisHM 完全免费） 本地版.png`。
- 保留手机前端预览与输入框测试区。
- 手机前端采用“AI 是变量唯一写入源，前端只读展示和提交操作意图”的工作流。

## 唯一发布命令

发布远程前端并把 CDN commit 回写到唯一卡：

```bash
npm run publish:card
```

这个命令会把当前 v5.0 源码同步到 `5zyzz4msvd-spec/HApp5/source/`，把桌面端和手机端产物覆盖到同级 `dist/`，创建候选 commit，并用该 immutable commit 重建和验证发布版 PNG；只有验证通过后才推进远端 `main`。

`source/` 不包含 `.git`、`node_modules`、`tmp`、本地卡、忽略文件或私密凭据。二次改版应修改 `source/` 内的维护真源并重新生成，不要直接把 `dist/` 当作源码编辑；请保留原作者 louisHM 与上游 Ramiel 的署名和完整性说明。

仓库当前没有统一的开源 `LICENSE`。仓库所有者允许为二次改版而 Fork 本仓库，但角色素材、第三方前端与上游内容仍按各自原有权利边界使用；这段说明不把第三方素材重新授权为任意用途。如需公开再分发，请先确认对应素材与上游项目的许可。

新对话接手前只需要读：

```text
docs/PROJECT_STATE.md
```
