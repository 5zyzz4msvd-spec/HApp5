import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const INTEGRITY_SCHEMA = "hypnoos.integrity/v1";
export const INTEGRITY_PROJECT_ID = "hypnoos-louishm-free";
export const INTEGRITY_CREATOR_ID = "louisHM";
export const INTEGRITY_UPSTREAM_CREATOR_ID = "Ramiel";
export const INTEGRITY_VERSION = 2;
export const INTEGRITY_GATE_ID = "00000000-0000-4000-8000-000000000001";
const LEGACY_INTEGRITY_GATE_IDS = new Set(["76d66196-488d-43dd-99b0-7dc919eeb4ab"]);
export const INTEGRITY_GATE_NAME = "HypnoOS 完整性授权闸门（请勿关闭）";
export const INTEGRITY_GLOBAL = "__ST_HYPNOOS_INTEGRITY_GATE_V1__";
export const EXPECTED_OPEN = "/*<HYPNOOS_EXPECTED_V1>*/";
export const EXPECTED_CLOSE = "/*</HYPNOOS_EXPECTED_V1>*/";
const PROTECTED_OPEN = "/*<HYPNOOS_PROTECTED_V2>*/";
const PROTECTED_CLOSE = "/*</HYPNOOS_PROTECTED_V2>*/";
const PAYLOAD_OPEN = "/*<HYPNOOS_PAYLOAD_V2>*/";
const PAYLOAD_CLOSE = "/*</HYPNOOS_PAYLOAD_V2>*/";

const EXPECTED_RE = /\/\*<HYPNOOS_EXPECTED_V1>\*\/[\s\S]*?\/\*<\/HYPNOOS_EXPECTED_V1>\*\//g;
const PROTECTED_RE = /\/\*<HYPNOOS_PROTECTED_V2>\*\/[\s\S]*?\/\*<HYPNOOS_PAYLOAD_V2>\*\/([\s\S]*?)\/\*<\/HYPNOOS_PAYLOAD_V2>\*\/[\s\S]*?\/\*<\/HYPNOOS_PROTECTED_V2>\*\//;

export function canonicalJson(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
    }
    return item;
  };
  return JSON.stringify(sort(value));
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function stripExpectedEnvelope(value) {
  const source = String(value ?? "");
  const protectedMatch = source.match(PROTECTED_RE);
  if (protectedMatch) return protectedMatch[1].replace(/^\n|\n$/g, "");
  return source.replace(EXPECTED_RE, "/*<HYPNOOS_EXPECTED_V1>*/__EXPECTED__/*</HYPNOOS_EXPECTED_V1>*/");
}

function removeExpectedEnvelope(value) {
  const source = String(value ?? "");
  const protectedMatch = source.match(PROTECTED_RE);
  if (protectedMatch) return protectedMatch[1].replace(/^\n|\n$/g, "");
  return source.includes(EXPECTED_OPEN) ? source.replace(EXPECTED_RE, "").replace(/^\n/, "") : source;
}

export function stripLegacyIntegrity(data) {
  if (!data || typeof data !== "object") return;
  if (data.extensions && typeof data.extensions === "object") delete data.extensions.hypnoos_integrity;
  const helper = data.extensions?.tavern_helper;
  if (helper && Array.isArray(helper.scripts)) {
    helper.scripts = helper.scripts
      .filter((script) => script?.id !== INTEGRITY_GATE_ID && !LEGACY_INTEGRITY_GATE_IDS.has(String(script?.id || "")) && script?.name !== INTEGRITY_GATE_NAME)
      .map((script) => ({
        ...script,
        content: typeof script?.content === "string" ? removeExpectedEnvelope(script.content) : script?.content,
        replaceString: typeof script?.replaceString === "string" ? removeExpectedEnvelope(script.replaceString) : script?.replaceString,
      }));
  }
}

// This function is serialized into the runtime gate. Keep it self-contained.
export function projectRuntimeData(data) {
  const expectedRe = /\/\*<HYPNOOS_EXPECTED_V1>\*\/[\s\S]*?\/\*<\/HYPNOOS_EXPECTED_V1>\*\//g;
  const protectedRe = /\/\*<HYPNOOS_PROTECTED_V2>\*\/[\s\S]*?\/\*<HYPNOOS_PAYLOAD_V2>\*\/([\s\S]*?)\/\*<\/HYPNOOS_PAYLOAD_V2>\*\/[\s\S]*?\/\*<\/HYPNOOS_PROTECTED_V2>\*\//g;
  const clean = (value, key = "") => {
    if (Array.isArray(value)) return value.map((item) => clean(item));
    if (!value || typeof value !== "object") {
      return typeof value === "string" ? value.replace(protectedRe, (_all, payload) => String(payload || "").replace(/^\n|\n$/g, "")).replace(expectedRe, "").replace(/^\n/, "").replace(/\r\n?/g, "\n") : value;
    }
    const out = {};
    for (const name of Object.keys(value)) {
      if (key === "extensions" && name === "hypnoos_integrity") continue;
      if (key === "workbench" && name === "updatedAt") continue;
      if (["fav", "talkativeness"].includes(name)) continue;
      out[name] = clean(value[name], name);
    }
    return out;
  };
  const source = clean(data || {});
  const scripts = Array.isArray(source?.extensions?.tavern_helper?.scripts)
    ? source.extensions.tavern_helper.scripts
    : [];
  if (source?.extensions?.tavern_helper) {
    source.extensions.tavern_helper.scripts = scripts
      .filter((script) => !["00000000-0000-4000-8000-000000000001", "76d66196-488d-43dd-99b0-7dc919eeb4ab"].includes(String(script?.id || "")))
      .map((script) => {
        const next = { ...script };
        delete next.enabled;
        return next;
      });
  }
  if (Array.isArray(source?.extensions?.regex_scripts)) {
    source.extensions.regex_scripts = source.extensions.regex_scripts.map((script) => {
      const next = { ...script };
      delete next.disabled;
      return next;
    });
  }
  if (Array.isArray(source?.character_book?.entries)) {
    source.character_book.entries = source.character_book.entries.map((entry) => {
      const next = { ...entry };
      delete next.enabled;
      delete next.disable;
      delete next.disabled;
      return next;
    });
  }
  return source;
}

function projectPackageData(data) {
  const clone = JSON.parse(JSON.stringify(data || {}));
  if (clone.extensions) delete clone.extensions.hypnoos_integrity;
  if (clone.extensions?.workbench) delete clone.extensions.workbench.updatedAt;
  if (Array.isArray(clone.extensions?.tavern_helper?.scripts)) {
    clone.extensions.tavern_helper.scripts = clone.extensions.tavern_helper.scripts
      .filter((script) => script?.id !== INTEGRITY_GATE_ID)
      .map((script) => ({ ...script, content: stripExpectedEnvelope(script?.content), replaceString: stripExpectedEnvelope(script?.replaceString) }));
  }
  return clone;
}

function protectedSurfaces(data) {
  const surfaces = [];
  for (const script of data?.extensions?.tavern_helper?.scripts || []) {
    if (script?.id === INTEGRITY_GATE_ID) continue;
    surfaces.push({ id: String(script?.id || script?.name || ""), kind: "helper", sha256: sha256Text(stripExpectedEnvelope(script?.content).replace("/*<HYPNOOS_EXPECTED_V1>*/__EXPECTED__/*</HYPNOOS_EXPECTED_V1>*/", "").replace(/^\n/, "")) });
  }
  for (const script of data?.extensions?.regex_scripts || []) {
    surfaces.push({ id: String(script?.id || script?.scriptName || ""), kind: "regex", sha256: sha256Text(canonicalJson(script)) });
  }
  for (const entry of data?.character_book?.entries || []) {
    surfaces.push({ id: String(entry?.id ?? entry?.comment ?? ""), kind: "worldbook", sha256: sha256Text(canonicalJson({ comment: entry?.comment, key: entry?.key, keys: entry?.keys, content: entry?.content, position: entry?.position, extensions: entry?.extensions })) });
  }
  return surfaces.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}

async function hashTree(root, relativeRoot = root, shouldInclude = () => true) {
  const rows = [];
  let names = [];
  try { names = await readdir(root, { withFileTypes: true }); } catch { return rows; }
  names.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of names) {
    const full = path.join(root, item.name);
    if (item.isDirectory()) rows.push(...await hashTree(full, relativeRoot, shouldInclude));
    else if (item.isFile()) {
      const relativeName = path.relative(relativeRoot, full).replaceAll(path.sep, "/");
      if (!shouldInclude(relativeName)) continue;
      const bytes = await readFile(full);
      rows.push(`${relativeName}\0${createHash("sha256").update(bytes).digest("hex")}`);
    }
  }
  return rows;
}

export async function distributionTreeSha256() {
  const roots = [
    {
      root: path.join(PROJECT_ROOT, "public/frontends/hypnosis-app"),
      label: "public/frontends/hypnosis-app",
      include: (name) => name !== "source.html"
        && !name.endsWith(".source.json")
        && !/^assets\/pet\/alisa-(?:ambient|move|mishap|drag)-v2\.png$/.test(name)
        && !/^assets\/encounter\/[^/]+\/layout\/worldbook-layout-report\.json$/.test(name),
    },
    { root: path.join(PROJECT_ROOT, "public/frontends/hypnosis-app-phone"), label: "public/frontends/hypnosis-app-phone", include: (name) => path.basename(name) !== "README.md" },
  ];
  const rows = [];
  for (const item of roots) {
    for (const row of await hashTree(item.root, item.root, item.include)) rows.push(`${item.label}\0${row}`);
  }
  return sha256Text(rows.sort().join("\n"));
}

function runtimeGuardSource(expected) {
  const projectionSource = projectRuntimeData.toString();
  const canonicalSource = canonicalJson.toString();
  return `
const __HYPNOOS_EXPECTED_MANIFEST__ = ${JSON.stringify(expected)};
const __hypnoosProjectRuntimeData = ${projectionSource};
const __hypnoosCanonicalJson = ${canonicalSource};
const __hypnoosViews = () => {
  const values = [];
  const append = (value) => { if (value && !values.includes(value)) values.push(value); };
  try { append(globalThis); } catch {}
  try { append(globalThis.parent); } catch {}
  try { append(globalThis.top); } catch {}
  return values;
};
const __hypnoosHost = (() => {
  const views = __hypnoosViews().slice().reverse();
  for (const view of views) {
    try {
      if (view?.SillyTavern?.getContext || typeof view?.getContext === "function") return view;
    } catch {}
  }
  return globalThis;
})();
const __hypnoosContext = () => {
  for (const view of [__hypnoosHost, ...__hypnoosViews()]) {
    try {
      const current = view?.SillyTavern?.getContext?.() || view?.getContext?.();
      if (current) return current;
    } catch {}
  }
  return null;
};
const __hypnoosSha256 = (value) => {
  const bytes = new TextEncoder().encode(String(value ?? ""));
  const rightRotate = (x, n) => (x >>> n) | (x << (32 - n));
  const words = [];
  const bitLength = bytes.length * 8;
  for (let index = 0; index < bytes.length; index += 1) words[index >> 2] = (words[index >> 2] || 0) | (bytes[index] << (24 - (index % 4) * 8));
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;
  const primes = []; for (let number = 2; primes.length < 64; number += 1) if (!primes.some((prime) => number % prime === 0)) primes.push(number);
  const h = primes.slice(0, 8).map((prime) => (Math.sqrt(prime) * 0x100000000) | 0);
  const k = primes.map((prime) => (Math.cbrt(prime) * 0x100000000) | 0);
  for (let offset = 0; offset < words.length; offset += 16) {
    const w = Array.from({ length: 16 }, (_, index) => words[offset + index] || 0); while (w.length < 64) { const i = w.length; const s0 = rightRotate(w[i-15],7)^rightRotate(w[i-15],18)^(w[i-15]>>>3); const s1 = rightRotate(w[i-2],17)^rightRotate(w[i-2],19)^(w[i-2]>>>10); w.push((w[i-16]+s0+w[i-7]+s1)|0); }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i=0;i<64;i+=1) { const s1=rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25); const ch=(e&f)^((~e)&g); const t1=(hh+s1+ch+k[i]+w[i])|0; const s0=rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22); const maj=(a&b)^(a&c)^(b&c); const t2=(s0+maj)|0; hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    [a,b,c,d,e,f,g,hh].forEach((value,index) => { h[index]=(h[index]+value)|0; });
  }
  return h.map((value) => (value >>> 0).toString(16).padStart(8,"0")).join("");
};
const __hypnoosCleanup = () => {
  try { __hypnoosHost.__ST_HYPNOOS_INTEGRITY_GATE_V1__?.disposeAll?.(); } catch {}
  try { __hypnoosHost.__ST_HYPNOOS_FLOATING_SINGLETON__?.destroy?.(); } catch {}
  try { __hypnoosHost.document?.querySelectorAll?.("[data-hypnoos-owned='true'],#hypnoos-floating-phone-shell,#hypnoos-pet-context-menu").forEach((node) => node.remove()); } catch {}
};
const __hypnoosGate = {
  authorized: false,
  revision: "",
  reason: "尚未校验",
  components: new Map(),
  authorize(revision) { return this.authorized === true && String(revision || "") === this.revision; },
  register(id, cleanup) {
    const key = String(id || "").trim();
    if (!key || typeof cleanup !== "function") return () => {};
    try { this.components.get(key)?.(); } catch {}
    this.components.set(key, cleanup);
    return () => { if (this.components.get(key) === cleanup) this.components.delete(key); };
  },
  disposeAll() {
    for (const cleanup of this.components.values()) { try { cleanup(); } catch {} }
    this.components.clear();
  },
  evaluate() {
    const previousAuthorized = this.authorized;
    const previousRevision = this.revision;
    this.authorized = false;
    this.reason = "当前卡不可解析";
    try {
      const context = __hypnoosContext();
      const id = context?.characterId ?? context?.chid ?? __hypnoosHost.this_chid ?? globalThis.this_chid;
      if (id === undefined || id === null || id === "") throw new Error("缺少当前角色ID");
      const character = context?.characters?.[id];
      if (!character || typeof character !== "object") throw new Error("当前角色对象不存在或不唯一");
      const data = character.data && typeof character.data === "object" ? character.data : character;
      const manifest = data?.extensions?.hypnoos_integrity;
      if (!manifest || manifest.schema !== __HYPNOOS_EXPECTED_MANIFEST__.schema || manifest.project_id !== __HYPNOOS_EXPECTED_MANIFEST__.project_id) throw new Error("完整性清单缺失或项目不匹配");
      for (const key of ["creator_id", "upstream_creator_id", "release_version", "mode", "card_name", "worldbook_name", "world_binding", "remote_commit", "integrity_version", "canonicalization", "algorithm", "content_digest", "build_revision", "canary", "cover_sha256", "distribution_tree_sha256"]) {
        if (manifest[key] !== __HYPNOOS_EXPECTED_MANIFEST__[key]) throw new Error(key + "不匹配");
      }
      if (manifest.fingerprints?.package !== __HYPNOOS_EXPECTED_MANIFEST__.fingerprints?.package || JSON.stringify(manifest.surfaces) !== JSON.stringify(__HYPNOOS_EXPECTED_MANIFEST__.surfaces)) throw new Error("出厂清单不匹配");
      if (data.name !== manifest.card_name || data.character_version !== manifest.release_version) throw new Error("卡名或版本不匹配");
      if (data.character_book?.name !== manifest.worldbook_name || data.extensions?.world !== manifest.world_binding) throw new Error("世界书绑定不匹配");
      if (String(context?.name2 || "").trim() && String(context.name2).trim() !== String(data.name || "").trim()) throw new Error("当前角色名交叉核对失败");
      const projected = __hypnoosCanonicalJson(__hypnoosProjectRuntimeData(data));
      const fingerprint = __hypnoosSha256("runtime\\0" + projected);
      if (fingerprint !== manifest.fingerprints?.runtime || fingerprint !== __HYPNOOS_EXPECTED_MANIFEST__.fingerprints?.runtime) throw new Error("运行时内容指纹不匹配");
      if (previousAuthorized && previousRevision !== manifest.build_revision) this.disposeAll();
      this.authorized = true;
      this.revision = manifest.build_revision;
      this.reason = "";
      return true;
    } catch (error) {
      this.reason = String(error?.message || error || "完整性校验失败");
      __hypnoosCleanup();
      console.error("[HypnoOS] 完整性授权失败：" + this.reason);
      return false;
    }
  }
};
try {
  const previous = __hypnoosHost.${INTEGRITY_GLOBAL};
  if (previous && previous !== __hypnoosGate) previous.disposeAll?.();
} catch {}
try { __hypnoosHost.${INTEGRITY_GLOBAL} = __hypnoosGate; } catch {}
globalThis.${INTEGRITY_GLOBAL} = __hypnoosGate;
__hypnoosGate.ready = Promise.resolve(__hypnoosGate.evaluate());
try {
  const context = __hypnoosContext();
  const source = context?.eventSource;
  const refresh = () => { __hypnoosGate.ready = Promise.resolve(__hypnoosGate.evaluate()); };
  for (const name of ["CHAT_CHANGED", "CHARACTER_MESSAGE_RENDERED", "MESSAGE_SENT", "MESSAGE_SWIPED"]) {
    const eventName = context?.eventTypes?.[name] || name;
    if (source?.on) source.on(eventName, refresh);
    else if (typeof __hypnoosHost.eventOn === "function") __hypnoosHost.eventOn(eventName, refresh);
    else if (typeof globalThis.eventOn === "function") globalThis.eventOn(eventName, refresh);
  }
} catch {}
`.trim();
}

function protectScript(source, revision) {
  return `${PROTECTED_OPEN}
${EXPECTED_OPEN}
const __hypnoosIntegrityViews = [];
for (const __hypnoosIntegrityView of [globalThis, globalThis.parent, globalThis.top]) {
  try { if (__hypnoosIntegrityView && !__hypnoosIntegrityViews.includes(__hypnoosIntegrityView)) __hypnoosIntegrityViews.push(__hypnoosIntegrityView); } catch {}
}
const __hypnoosFindIntegrityGate = () => __hypnoosIntegrityViews.map((view) => {
  try { return view?.${INTEGRITY_GLOBAL}; } catch { return null; }
}).find((gate) => gate?.authorize?.(${JSON.stringify(revision)}));
const __hypnoosIntegrityGate = __hypnoosFindIntegrityGate() || await new Promise((resolve) => {
  const startedAt = Date.now();
  const check = () => {
    const gate = __hypnoosFindIntegrityGate();
    if (gate) return resolve(gate);
    if (Date.now() - startedAt >= 5000) return resolve(null);
    setTimeout(check, 25);
  };
  check();
});
if (!__hypnoosIntegrityGate) throw new Error("HypnoOS 完整性授权失败，已阻止此模块启动。");
${EXPECTED_CLOSE}
${PAYLOAD_OPEN}
${String(source ?? "")}
${PAYLOAD_CLOSE}
queueMicrotask(() => {
  for (const key of Object.keys(globalThis)) {
    if (key === ${JSON.stringify(INTEGRITY_GLOBAL)} || !/^__(?:ST_|HYPNOOS_)/.test(key)) continue;
    const value = globalThis[key];
    if (value && typeof value.dispose === "function") __hypnoosIntegrityGate.register?.(${JSON.stringify(revision)} + ":" + key, () => value.dispose());
  }
});
${PROTECTED_CLOSE}`;
}

export async function applyCardIntegrity(card, { version, mode, remoteCommit = "", coverSha256 = "" } = {}) {
  const data = card?.data;
  if (!data || typeof data !== "object") throw new Error("Cannot apply integrity to a card without data");
  if (!/^[a-f0-9]{64}$/.test(String(coverSha256))) throw new Error("Cannot apply integrity without an exact cover SHA-256");
  stripLegacyIntegrity(data);
  const treeHash = await distributionTreeSha256();
  const runtimeProjectionJson = canonicalJson(projectRuntimeData(data));
  const contentDigest = sha256Text(`content\0${canonicalJson({ runtime: JSON.parse(runtimeProjectionJson), cover_sha256: coverSha256 })}`);
  const worldbookName = String(data.character_book?.name || "");
  const worldBinding = String(data.extensions?.world || "");
  const revisionSeed = canonicalJson({ version, mode, remoteCommit, cardName: data.name, worldbookName, worldBinding, contentDigest, treeHash, cover_sha256: coverSha256 });
  const buildRevision = `${version}:${mode}:${sha256Text(`revision\0${revisionSeed}`).slice(0, 16)}`;
  const canary = `HYPNOOS_AUTH_V1:${sha256Text(`canary\0${revisionSeed}`).slice(0, 24)}`;
  const manifest = {
    schema: INTEGRITY_SCHEMA,
    project_id: INTEGRITY_PROJECT_ID,
    creator_id: INTEGRITY_CREATOR_ID,
    upstream_creator_id: INTEGRITY_UPSTREAM_CREATOR_ID,
    release_version: String(version || ""),
    mode: String(mode || "local"),
    card_name: String(data.name || ""),
    worldbook_name: worldbookName,
    world_binding: worldBinding,
    remote_commit: String(remoteCommit || ""),
    integrity_version: INTEGRITY_VERSION,
    canonicalization: "hypnoos-card-cover-v2",
    algorithm: "sha256",
    content_digest: contentDigest,
    build_revision: buildRevision,
    canary,
    cover_sha256: coverSha256,
    distribution_tree_sha256: treeHash,
    surfaces: protectedSurfaces(data),
    fingerprints: { runtime: "", package: "" },
  };
  data.extensions ??= {};
  data.extensions.hypnoos_integrity = manifest;
  const helper = data.extensions.tavern_helper ??= {};
  const scripts = Array.isArray(helper.scripts) ? helper.scripts : [];
  for (const script of scripts) {
    if (script?.id === INTEGRITY_GATE_ID || script?.name === INTEGRITY_GATE_NAME) continue;
    if (typeof script?.content === "string") script.content = protectScript(script.content, buildRevision);
  }
  scripts.unshift({
    type: "script",
    enabled: true,
    name: INTEGRITY_GATE_NAME,
    id: INTEGRITY_GATE_ID,
    content: runtimeGuardSource(manifest),
    info: "离线完整性授权；每次构建按当前版本和内容重新生成，不联网、不读取聊天内容。",
    button: { enabled: false, buttons: [] },
    data: {},
    export_with: { data: true, button: false },
  });
  helper.scripts = scripts;
  manifest.fingerprints.runtime = sha256Text(`runtime\0${canonicalJson(projectRuntimeData(data))}`);
  manifest.fingerprints.package = sha256Text(`package\0${canonicalJson({ card: projectPackageData(data), cover_sha256: coverSha256 })}`);
  scripts[0].content = runtimeGuardSource(manifest);
  return manifest;
}

export function recomputeIntegrityFingerprints(card) {
  const data = card?.data || {};
  const coverSha256 = String(data?.extensions?.hypnoos_integrity?.cover_sha256 || "");
  return {
    runtime: sha256Text(`runtime\0${canonicalJson(projectRuntimeData(data))}`),
    package: sha256Text(`package\0${canonicalJson({ card: projectPackageData(data), cover_sha256: coverSha256 })}`),
  };
}

export async function recomputeIntegrityManifestCore(card, { version, mode, remoteCommit = "", coverSha256 = "" } = {}) {
  const data = card?.data || {};
  if (!/^[a-f0-9]{64}$/.test(String(coverSha256))) throw new Error("Cannot recompute integrity without an exact cover SHA-256");
  const treeHash = await distributionTreeSha256();
  const contentDigest = sha256Text(`content\0${canonicalJson({ runtime: projectRuntimeData(data), cover_sha256: coverSha256 })}`);
  const worldbookName = String(data.character_book?.name || "");
  const worldBinding = String(data.extensions?.world || "");
  const revisionSeed = canonicalJson({
    version,
    mode,
    remoteCommit,
    cardName: data.name,
    worldbookName,
    worldBinding,
    contentDigest,
    treeHash,
    cover_sha256: coverSha256,
  });
  return {
    content_digest: contentDigest,
    build_revision: `${version}:${mode}:${sha256Text(`revision\0${revisionSeed}`).slice(0, 16)}`,
    canary: `HYPNOOS_AUTH_V1:${sha256Text(`canary\0${revisionSeed}`).slice(0, 24)}`,
    distribution_tree_sha256: treeHash,
    surfaces: protectedSurfaces(data),
  };
}
