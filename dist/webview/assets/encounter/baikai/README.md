# 邂逅角色包草稿

- `package.json`：可被邂逅导入的角色包草稿。
- `roles/*/persona-entry.encounter-layout.json`：套用默认三人模板后的角色人设世界书条目。
- `roles/*/variable-entry.encounter-layout.json`：套用默认三人模板后的角色变量世界书条目；前端购买时变量 entry 仍会按角色名固定生成，这里主要用于审查和保留布局。
- `layout/worldbook-layout-report.json`：记录默认模板、原始条目与导出条目的 order/depth/position/role/extensions。
- `prompts/role-image-prompts-oneline.txt`：每个角色一行图片提示词。

补图后可运行同一个脚本加 `--images <图片目录> --zip <输出.zip>` 重新生成带图片的 zip。
