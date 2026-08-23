import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CARD_PATH } from "./card-config.mjs";
import { parseCharacterCard } from "../src/card-parser.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FINALIZER = join(ROOT, "scripts/finalize-card-v1_6.mjs");

function worldbookSignature(bytes, fileName) {
  const parsed = parseCharacterCard(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    fileName
  );
  const entries = parsed.card?.data?.character_book?.entries ?? [];
  return entries.map((entry) => ({
    id: entry?.id ?? null,
    comment: String(entry?.comment ?? ""),
    content: createHash("sha256").update(String(entry?.content ?? "")).digest("hex"),
  }));
}

function runFinalizer(cardPath) {
  const remoteCommit = process.env.HYPNOOS_REMOTE_COMMIT
    || (process.env.HYPNOOS_RELEASE_CARD === "1" ? "0000000000000000000000000000000000000000" : undefined);
  const result = spawnSync(process.execPath, [FINALIZER], {
    cwd: ROOT,
    env: {
      ...process.env,
      HYPNOOS_CARD_PATH: cardPath,
      ...(remoteCommit ? { HYPNOOS_REMOTE_COMMIT: remoteCommit } : {}),
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `finalizer failed during idempotency check\n${result.stdout || ""}\n${result.stderr || ""}`.trim()
    );
  }
}

const tempRoot = await mkdtemp(join(tmpdir(), "hypnoos-finalizer-idempotency-"));
const tempCard = join(tempRoot, "card.png");

try {
  await copyFile(CARD_PATH, tempCard);
  runFinalizer(tempCard);
  const once = worldbookSignature(await readFile(tempCard), tempCard);
  runFinalizer(tempCard);
  const twice = worldbookSignature(await readFile(tempCard), tempCard);

  if (JSON.stringify(once) !== JSON.stringify(twice)) {
    const firstDifference = once.findIndex((entry, index) => JSON.stringify(entry) !== JSON.stringify(twice[index]));
    throw new Error(
      `finalizer is not idempotent: entries ${once.length} -> ${twice.length}, first difference at ${firstDifference}`
    );
  }

  console.log(JSON.stringify({ ok: true, card: CARD_PATH, entries: once.length, stableAcrossTwoRuns: true }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
