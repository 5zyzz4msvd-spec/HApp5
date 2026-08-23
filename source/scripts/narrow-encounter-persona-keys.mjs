import fs from "node:fs";
import path from "node:path";

const targets = [
  ["orjenrn", "真白阿丽亚", "真白"],
  ["baikai", "西园寺美织", "西园寺"],
  ["sdz-aser", "月咏皋月", "月咏"],
  ["sdz-aser", "真白阿丽亚", "真白"]
];
const root = path.join(process.cwd(), "public/frontends/hypnosis-app/assets/encounter");

for (const [packageName, roleName, unsafeKey] of targets) {
  const file = path.join(root, packageName, "package.json");
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  const role = pkg.roles.find((candidate) => candidate.name === roleName);
  if (!role) throw new Error(`找不到角色：${packageName}/${roleName}`);
  for (const field of ["key", "keys"]) {
    if (Array.isArray(role.personaEntry?.[field])) {
      role.personaEntry[field] = role.personaEntry[field].filter((key) => String(key).trim() !== unsafeKey);
    }
  }
  if (Array.isArray(role.aliases)) role.aliases = role.aliases.filter((key) => String(key).trim() !== unsafeKey);
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}

console.log("已移除会撞到默认/支线角色的宽泛姓氏关键词。");
