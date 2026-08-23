import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  CARD_PATH,
  DIST_PHONE_DIR,
  DIST_REPO,
  DIST_REPO_URL,
  DIST_WEBVIEW_DIR,
  RELEASE_CARD_PATH,
  SOURCE_DIR,
  VERSION_NAME,
  remoteFrontendUrl,
  remotePhoneFrontendUrl,
} from "./card-config.mjs";

const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FRONTEND_DIR = join(ROOT, "public/frontends/hypnosis-app");
const PHONE_FRONTEND_DIR = join(ROOT, "public/frontends/hypnosis-app-phone");
const MAX_BUFFER = 64 * 1024 * 1024;
// GitHub's Git blobs endpoint accepts these generated 5–7 MiB files; keep a
// conservative ceiling below the platform's per-blob limit, and fall back to
// Git protocol only for genuinely larger new assets.
const GITHUB_BLOB_SAFE_BYTES = 8 * 1024 * 1024;
const PUBLISH_CARD_PATH = process.env.HYPNOOS_CARD_PATH || RELEASE_CARD_PATH;
const GITHUB_API = "https://api.github.com";
const PUBLISH_DRY_RUN = process.env.HYPNOOS_PUBLISH_DRY_RUN === "1";
const SOURCE_MANIFEST_PATH = `${SOURCE_DIR}/SOURCE_MANIFEST.json`;
const REQUIRED_SOURCE_PATHS = [
  "README.md",
  "package.json",
  "package-lock.json",
  "docs/PROJECT_STATE.md",
  "scripts/card-config.mjs",
  "scripts/finalize-card-v1_6.mjs",
  "scripts/mirror-frontend.mjs",
  "scripts/publish-card.mjs",
  "scripts/verify-card-release.mjs",
  "src/hypnoos-floating-bootstrap.js",
  "public/frontends/hypnosis-app/source.html",
];
const ALLOWED_SOURCE_ROOT_FILES = new Set([".gitignore", "README.md", "index.html", "package.json", "package-lock.json"]);
const ALLOWED_SOURCE_PREFIXES = ["docs/", "scripts/", "src/", "public/dev/", "public/vendor/", "public/frontends/"];
const SENSITIVE_SOURCE_PATH = /(^|\/)(?:\.env(?:\.[^/]*)?|id_(?:rsa|ed25519)|credentials?(?:\.[^/]*)?|auth(?:\.[^/]*)?|[^/]*\.(?:pem|key|p12|pfx))$/i;
const FORBIDDEN_SOURCE_PATH = /^(?:\.git|node_modules|tmp|public\/cards)(?:\/|$)|(^|\/)__pycache__(?:\/|$)|\.pyc$/;
const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
];
const CONTENT_CACHE = new Map();

async function run(command, args, options = {}) {
  if (!options.quiet) console.log(`$ ${[command, ...args].join(" ")}`);
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: MAX_BUFFER,
  });
  if (!options.quiet && stdout.trim()) console.log(stdout.trim());
  if (!options.quiet && stderr.trim()) console.error(stderr.trim());
}

async function capture(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

async function captureWithInput(command, args, input, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        rejectPromise(new Error(`${command} ${args.join(" ")} failed (${code}): ${errorOutput}`));
        return;
      }
      resolvePromise(output);
    });
    child.stdin.end(input);
  });
}

async function readCached(absolutePath) {
  let content = CONTENT_CACHE.get(absolutePath);
  if (!content) {
    content = await readFile(absolutePath);
    CONTENT_CACHE.set(absolutePath, content);
  }
  return content;
}

function gitBlobSha(content) {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function collectSourceFiles() {
  const { stdout } = await execFileAsync("git", [
    "-c",
    "core.quotePath=false",
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ], { cwd: ROOT, maxBuffer: MAX_BUFFER, encoding: "buffer" });
  const paths = stdout.toString("utf8").split("\0").filter(Boolean).sort();
  const files = [];

  for (const rawPath of paths) {
    const relativePath = rawPath.split("\\").join("/");
    if (FORBIDDEN_SOURCE_PATH.test(relativePath)) continue;
    if (!ALLOWED_SOURCE_ROOT_FILES.has(relativePath) && !ALLOWED_SOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
      throw new Error(`源码快照出现未分类路径，已停止发布: ${relativePath}`);
    }
    if (SENSITIVE_SOURCE_PATH.test(relativePath)) {
      throw new Error(`源码快照命中敏感路径，已停止发布: ${relativePath}`);
    }
    const absolutePath = resolve(ROOT, relativePath);
    if (!absolutePath.startsWith(`${ROOT}${sep}`)) {
      throw new Error(`源码路径越界，已停止发布: ${relativePath}`);
    }
    let info;
    try {
      info = await lstat(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue; // tracked but deleted in this worktree
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`源码快照不允许符号链接: ${relativePath}`);
    if (!info.isFile()) continue;
    const content = await readCached(absolutePath);
    if (!content.includes(0)) {
      const text = content.toString("utf8");
      if (SECRET_CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
        throw new Error(`源码快照疑似包含私密凭据，已停止发布: ${relativePath}`);
      }
    }
    files.push({
      absolutePath,
      remotePath: `${SOURCE_DIR}/${relativePath}`,
      content,
      sha: gitBlobSha(content),
      sourcePath: relativePath,
    });
  }

  const included = new Set(files.map((file) => file.sourcePath));
  const missing = REQUIRED_SOURCE_PATHS.filter((path) => !included.has(path));
  if (missing.length) throw new Error(`源码快照缺少必需文件: ${missing.join(", ")}`);

  const entries = files.map((file) => ({
    path: file.sourcePath,
    bytes: file.content.length,
    sha256: sha256(file.content),
  }));
  const sourceHead = await capture("git", ["rev-parse", "HEAD"]);
  const worktreeStatus = await capture("git", ["status", "--porcelain", "--untracked-files=all"]);
  const treeDigest = sha256(Buffer.from(entries.map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`).join("")));
  const manifestContent = Buffer.from(`${JSON.stringify({
    schema: "hypnoos.source-manifest/v1",
    version: VERSION_NAME,
    source_head: sourceHead,
    worktree_dirty: Boolean(worktreeStatus),
    file_count: entries.length,
    total_bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    source_tree_sha256: treeDigest,
    files: entries,
  }, null, 2)}\n`);
  files.push({
    absolutePath: null,
    remotePath: SOURCE_MANIFEST_PATH,
    content: manifestContent,
    sha: gitBlobSha(manifestContent),
    sourcePath: "SOURCE_MANIFEST.json",
  });
  console.log(`source snapshot: ${entries.length} files, ${entries.reduce((sum, entry) => sum + entry.bytes, 0)} bytes, dirty=${Boolean(worktreeStatus)}`);
  return files.sort((left, right) => left.remotePath.localeCompare(right.remotePath));
}

function shouldPublishWebview(relativePath) {
  return relativePath !== "source.html"
    && !relativePath.endsWith(".source.json")
    && !/^assets\/pet\/alisa-(?:ambient|move|mishap|drag)-v2\.png$/.test(relativePath)
    && !/^(?:assets\/encounter\/[^/]+\/layout\/worldbook-layout-report\.json)$/.test(relativePath);
}

function shouldPublishPhone(relativePath) {
  return basename(relativePath) !== "README.md";
}

async function collectPublishFiles(sourceRoot, remoteRoot, shouldInclude) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = relative(sourceRoot, absolutePath).split("\\").join("/");
      if (!shouldInclude(relativePath)) continue;
      const content = await readCached(absolutePath);
      files.push({
        absolutePath,
        remotePath: `${remoteRoot}/${relativePath}`,
        content,
        sha: gitBlobSha(content),
      });
    }
  }
  await walk(sourceRoot);
  return files.sort((left, right) => left.remotePath.localeCompare(right.remotePath));
}

async function githubRequest(token, method, path, body = undefined) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = json?.message || text || `${response.status} ${response.statusText}`;
    throw new Error(`GitHub API ${method} ${path} failed: ${detail}`);
  }
  return json;
}

async function createGitProtocolPublishCommit(localFiles) {
  const publishRoot = await mkdtemp(join(tmpdir(), "hypnoos-dist-publish-"));
  const remoteUrl = DIST_REPO_URL;
  try {
    await run("git", ["init", "--quiet"], { cwd: publishRoot });
    await run("git", ["remote", "add", "origin", remoteUrl], { cwd: publishRoot });
    // 只取 main 的提交与树元数据；不检出工作区，也不下载旧版大文件内容。
    await run("git", ["fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", "main"], { cwd: publishRoot });
    const parentCommit = await capture("git", ["rev-parse", "FETCH_HEAD"], { cwd: publishRoot });
    const parentTree = await capture("git", ["rev-parse", "FETCH_HEAD^{tree}"], { cwd: publishRoot });
    await run("git", ["read-tree", "FETCH_HEAD"], { cwd: publishRoot });

    const remotePathText = await capture("git", [
      "ls-tree",
      "-r",
      "--name-only",
      "FETCH_HEAD",
      SOURCE_DIR,
      DIST_WEBVIEW_DIR,
      DIST_PHONE_DIR,
    ], { cwd: publishRoot });
    const remotePaths = remotePathText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const localPaths = new Set(localFiles.map((file) => file.remotePath));
    let changedFiles = 0;

    for (const remotePath of remotePaths) {
      if (localPaths.has(remotePath)) continue;
      await run("git", ["update-index", "--force-remove", "--", remotePath], { cwd: publishRoot, quiet: true });
      changedFiles += 1;
    }
    for (const file of localFiles) {
      const blobSha = file.absolutePath
        ? await capture("git", ["hash-object", "-w", file.absolutePath], { cwd: publishRoot })
        : await captureWithInput("git", ["hash-object", "-w", "--stdin"], file.content, { cwd: publishRoot });
      if (blobSha !== file.sha) throw new Error(`Git blob SHA mismatch: ${file.remotePath}`);
      await run("git", ["update-index", "--add", "--cacheinfo", `100644,${blobSha},${file.remotePath}`], { cwd: publishRoot, quiet: true });
      changedFiles += 1;
    }

    const nextTree = await capture("git", ["write-tree"], { cwd: publishRoot });
    if (nextTree === parentTree) {
      console.log("source and dist unchanged; reusing current remote commit");
      await rm(publishRoot, { recursive: true, force: true });
      return { sha: parentCommit, advance: null, cleanup: null };
    }
    if (PUBLISH_DRY_RUN) {
      console.log(`dry run: would create one remote commit with up to ${changedFiles} indexed files`);
      await rm(publishRoot, { recursive: true, force: true });
      return { sha: parentCommit, advance: null, cleanup: null };
    }
    const message = `Update ${VERSION_NAME} source, webview and phone`;
    const commitEnv = {
      GIT_AUTHOR_NAME: "HypnosisAPP Release",
      GIT_AUTHOR_EMAIL: "noreply@users.noreply.github.com",
      GIT_COMMITTER_NAME: "HypnosisAPP Release",
      GIT_COMMITTER_EMAIL: "noreply@users.noreply.github.com",
    };
    const commit = await capture("git", ["commit-tree", nextTree, "-p", parentCommit, "-m", message], {
      cwd: publishRoot,
      env: commitEnv,
    });
    const candidateBranch = `release-candidate/${VERSION_NAME}-${commit.slice(0, 12)}`;
    await run("git", ["push", "origin", `${commit}:refs/heads/${candidateBranch}`], { cwd: publishRoot });
    console.log(`remote commit candidate created: ${commit} (${candidateBranch})`);
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      try {
        await run("git", ["push", "origin", "--delete", candidateBranch], { cwd: publishRoot });
      } catch (error) {
        console.error(`warning: failed to delete candidate branch ${candidateBranch}: ${error.message}`);
      }
      await rm(publishRoot, { recursive: true, force: true });
    };
    return {
      sha: commit,
      advance: async () => {
        await run("git", ["push", "origin", `${commit}:refs/heads/main`], { cwd: publishRoot });
        console.log(`remote main advanced after release-card verification: ${commit}`);
      },
      cleanup,
    };
  } catch (error) {
    await rm(publishRoot, { recursive: true, force: true });
    throw error;
  }
}

async function createGitHubPublishCommit() {
  const sourceFiles = await collectSourceFiles();
  const webviewFiles = await collectPublishFiles(FRONTEND_DIR, DIST_WEBVIEW_DIR, shouldPublishWebview);
  const phoneFiles = await collectPublishFiles(PHONE_FRONTEND_DIR, DIST_PHONE_DIR, shouldPublishPhone);
  const localFiles = [...sourceFiles, ...webviewFiles, ...phoneFiles];
  if (!localFiles.length) throw new Error("未找到可发布的源码或前端文件。");

  const token = await capture("gh", ["auth", "token"]);
  if (!token) throw new Error("未读取到 GitHub 认证；请先执行 gh auth login。");

  // 只读取远程 Git 元数据，不克隆、不检出、不下载发布资产。
  const ref = await githubRequest(token, "GET", `/repos/${DIST_REPO}/git/ref/heads/main`);
  const parentCommit = await githubRequest(token, "GET", `/repos/${DIST_REPO}/git/commits/${ref.object.sha}`);
  const remoteTree = await githubRequest(token, "GET", `/repos/${DIST_REPO}/git/trees/${parentCommit.tree.sha}?recursive=1`);
  if (remoteTree.truncated) throw new Error("远程发布仓库树过大且被 GitHub 截断，已停止发布以避免误删文件。");

  const remoteBlobs = new Map(
    (remoteTree.tree || [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => [entry.path, entry.sha])
  );
  const remoteBlobShas = new Set(remoteBlobs.values());
  const localPaths = new Set(localFiles.map((file) => file.remotePath));
  const tree = [];
  let changedFiles = 0;

  const changedLocalFiles = localFiles.filter((file) => remoteBlobs.get(file.remotePath) !== file.sha);
  const deletedRemotePaths = [...remoteBlobs.keys()].filter((remotePath) => {
    const isPublishPath = remotePath.startsWith(`${SOURCE_DIR}/`)
      || remotePath.startsWith(`${DIST_WEBVIEW_DIR}/`)
      || remotePath.startsWith(`${DIST_PHONE_DIR}/`);
    return isPublishPath && !localPaths.has(remotePath);
  });

  if (!changedLocalFiles.length && !deletedRemotePaths.length) {
    console.log("source and dist unchanged; reusing current remote commit");
    return { sha: ref.object.sha, advance: null, cleanup: null };
  }
  if (PUBLISH_DRY_RUN) {
    console.log(`dry run: would create one remote commit with ${changedLocalFiles.length + deletedRemotePaths.length} changed files`);
    return { sha: ref.object.sha, advance: null, cleanup: null };
  }
  const newLargeBlob = changedLocalFiles.find((file) => (
    file.content.length > GITHUB_BLOB_SAFE_BYTES && !remoteBlobShas.has(file.sha)
  ));
  if (newLargeBlob) {
    console.log(`new large blob detected (${newLargeBlob.remotePath}); using filtered git protocol publish`);
    return createGitProtocolPublishCommit(localFiles);
  }

  for (const file of changedLocalFiles) {
    if (remoteBlobShas.has(file.sha)) {
      tree.push({ path: file.remotePath, mode: "100644", type: "blob", sha: file.sha });
      changedFiles += 1;
      continue;
    }
    const blob = await githubRequest(token, "POST", `/repos/${DIST_REPO}/git/blobs`, {
      content: file.content.toString("base64"),
      encoding: "base64",
    });
    tree.push({ path: file.remotePath, mode: "100644", type: "blob", sha: blob.sha });
    changedFiles += 1;
  }

  // 与旧 rsync --delete 保持一致：仅清理 source/ 与两个 dist 发布目录。
  for (const remotePath of deletedRemotePaths) {
    tree.push({ path: remotePath, mode: "100644", type: "blob", sha: null });
    changedFiles += 1;
  }

  let nextTree = { sha: parentCommit.tree.sha };
  const treeChunkSize = 100;
  for (let offset = 0; offset < tree.length; offset += treeChunkSize) {
    const chunk = tree.slice(offset, offset + treeChunkSize);
    nextTree = await githubRequest(token, "POST", `/repos/${DIST_REPO}/git/trees`, {
      base_tree: nextTree.sha,
      tree: chunk,
    });
    console.log(`remote tree candidate: ${Math.min(offset + chunk.length, tree.length)}/${tree.length} paths`);
  }
  const commit = await githubRequest(token, "POST", `/repos/${DIST_REPO}/git/commits`, {
    message: `Update ${VERSION_NAME} source, webview and phone (${changedFiles} files)`,
    tree: nextTree.sha,
    parents: [ref.object.sha],
  });
  const candidateBranch = `release-candidate/${VERSION_NAME}-${commit.sha.slice(0, 12)}`;
  await githubRequest(token, "POST", `/repos/${DIST_REPO}/git/refs`, {
    ref: `refs/heads/${candidateBranch}`,
    sha: commit.sha,
  });
  console.log(`remote commit candidate created: ${commit.sha} (${changedFiles} files, ${candidateBranch})`);
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      await githubRequest(token, "DELETE", `/repos/${DIST_REPO}/git/refs/heads/${candidateBranch}`);
    } catch (error) {
      console.error(`warning: failed to delete candidate branch ${candidateBranch}: ${error.message}`);
    }
  };
  return {
    sha: commit.sha,
    advance: async () => {
      await githubRequest(token, "PATCH", `/repos/${DIST_REPO}/git/refs/heads/main`, {
        sha: commit.sha,
        force: false,
      });
      console.log(`remote main advanced after release-card verification: ${commit.sha}`);
    },
    cleanup,
  };
}

async function publishDist() {
  if (process.env.HYPNOOS_RUN_MIRROR === "1") {
    await run(process.execPath, ["scripts/apply-orjenrn-polish.mjs"]);
    await run(process.execPath, ["scripts/mirror-frontend.mjs"]);
  } else {
    console.log("skip mirror-frontend; publishing current checked-in webview");
  }
  await run(process.execPath, ["scripts/build-phone-frontend.mjs"]);
  // Validate the complete current source/generated/artifact graph before any
  // remote ref can move. The candidate commit itself is created next, but main
  // is advanced only after the commit-pinned release card also passes.
  await run("npm", ["run", "verify:pet"]);
  await run(process.execPath, ["scripts/verify-encounter-ejs.mjs"]);
  await run(process.execPath, ["scripts/verify-action-fold-compat.mjs"]);
  await run(process.execPath, ["scripts/verify-operation-ownership.mjs"]);
  await run(process.execPath, ["scripts/verify-card-release.mjs"]);
  await run(process.execPath, ["scripts/verify-finalizer-idempotency.mjs"]);
  return createGitHubPublishCommit();
}

const publication = await publishDist();
const commit = publication.sha;
if (!PUBLISH_DRY_RUN) {
  try {
    await run(process.execPath, ["scripts/finalize-card-v1_6.mjs"], {
      env: { HYPNOOS_REMOTE_COMMIT: commit, HYPNOOS_CARD_PATH: PUBLISH_CARD_PATH, HYPNOOS_RELEASE_CARD: "1" },
    });
    await run(process.execPath, ["scripts/verify-card-release.mjs"], {
      env: { HYPNOOS_REMOTE_COMMIT: commit, HYPNOOS_CARD_PATH: PUBLISH_CARD_PATH, HYPNOOS_RELEASE_CARD: "1" },
    });
    await run(process.execPath, ["scripts/verify-finalizer-idempotency.mjs"], {
      env: { HYPNOOS_REMOTE_COMMIT: commit, HYPNOOS_CARD_PATH: PUBLISH_CARD_PATH, HYPNOOS_RELEASE_CARD: "1" },
    });
    await publication.advance?.();
  } catch (error) {
    await publication.cleanup?.();
    throw error;
  }
  await publication.cleanup?.();
  if (resolve(PUBLISH_CARD_PATH) === resolve(RELEASE_CARD_PATH)) {
    await run(process.execPath, ["scripts/prune-card-outputs.mjs"]);
  }
}

console.log("");
console.log(`card: ${PUBLISH_CARD_PATH || CARD_PATH}`);
console.log(`commit: ${commit}`);
console.log(`cdn: ${remoteFrontendUrl(commit)}`);
console.log(`phone: ${remotePhoneFrontendUrl(commit)}`);
