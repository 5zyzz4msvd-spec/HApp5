import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { LOCAL_CARD_BASENAME, RELEASE_CARD_BASENAME } from "./card-config.mjs";

const CARD_DIR = path.resolve("public/cards");
const KEEP = new Set([LOCAL_CARD_BASENAME, RELEASE_CARD_BASENAME]);
const dryRun = process.argv.includes("--dry-run");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
// Keep recovery on the same filesystem so moving large PNGs is atomic and does
// not fail with EXDEV on external workspaces. This archive is outside public/cards.
const recycleRoot = path.resolve(process.env.HYPNOOS_CARD_RECYCLE_DIR || path.join(path.dirname(path.resolve(".")), ".recycle", `hypnoos-card-outputs-${stamp}`));

const names = (await readdir(CARD_DIR, { withFileTypes: true }))
  .filter((item) => item.isFile() && /\.png$/i.test(item.name))
  .map((item) => item.name)
  .sort();
for (const keep of KEEP) {
  if (!names.includes(keep)) throw new Error(`Refusing to prune: current card output is missing: ${keep}`);
}
const stale = names.filter((name) => !KEEP.has(name));
for (const name of stale) {
  const source = path.resolve(CARD_DIR, name);
  if (path.dirname(source) !== CARD_DIR) throw new Error(`Unsafe card path: ${source}`);
}

console.log(JSON.stringify({ dryRun, keep: [...KEEP], stale, recycleRoot }, null, 2));
if (!dryRun && stale.length) {
  await mkdir(recycleRoot, { recursive: true });
  for (const name of stale) await rename(path.join(CARD_DIR, name), path.join(recycleRoot, name));
}
