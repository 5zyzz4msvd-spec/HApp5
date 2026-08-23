import fs from "node:fs";
import path from "node:path";
import { refreshOrjenrnRoleInitialVariables } from "./orjenrn-initial-variables.mjs";

const packagePath = path.join(
  process.cwd(),
  "public/frontends/hypnosis-app/assets/encounter/orjenrn/package.json"
);
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
for (const role of pkg.roles || []) refreshOrjenrnRoleInitialVariables(role);
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`orjenrn 初始变量已复核：${(pkg.roles || []).length} 个角色。`);
