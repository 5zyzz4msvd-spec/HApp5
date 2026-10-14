import { normalizeRef, assertObjectId } from "./contracts.mjs";

export const IMAGE_USAGES = Object.freeze(["portrait", "standee", "gallery", "background"]);
export function normalizeImageRef(value) {
  if (!value || typeof value !== "object" || !/^assets\/(character|location|custom|event|task|achievement|favor-event|schedule)\/[a-z0-9._-]+\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/i.test(value.path)) throw new Error("invalid local image reference");
  if (!IMAGE_USAGES.includes(value.usage)) throw new Error("invalid image usage");
  return { id: assertObjectId(value.id, "image id"), path: value.path, name: String(value.name ?? "图片"), usage: value.usage, mime: String(value.mime), size: Number(value.size) };
}

export async function saveObjectImage(store, owner, blob, { name = blob?.name ?? "图片", usage = "portrait" } = {}) {
  const ref = normalizeRef(owner);
  // Helper and phone run in different iframe realms; instanceof Blob rejects
  // a legitimate File from the other frame. Validate its byte interface instead.
  if (!blob || typeof blob.arrayBuffer !== "function" || typeof blob.slice !== "function" || !Number.isInteger(blob.size) || !blob.size || blob.size > 12 * 1024 * 1024) throw new Error("图片须为非空文件且不超过 12 MiB");
  if (!IMAGE_USAGES.includes(usage)) throw new Error("invalid image usage");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let mime = "", ext = "";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) { mime = "image/png"; ext = "png"; }
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mime = "image/jpeg"; ext = "jpg"; }
  else if (String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) { mime = "image/gif"; ext = "gif"; }
  else if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") { mime = "image/webp"; ext = "webp"; }
  else throw new Error("只接受 PNG、JPEG、WebP、GIF 图片，不接受 SVG / HTML");
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const tooLarge = bitmap.width > 16384 || bitmap.height > 16384 || bitmap.width * bitmap.height > 80_000_000;
    bitmap.close();
    if (tooLarge) throw new Error("图片像素过大，请缩小后上传");
  }
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `assets/${ref.kind}/${ref.id}/${hash}.${ext}`;
  await store.driver.writeBlobAtomic(store.path(path), new Blob([bytes], { type: mime }));
  return normalizeImageRef({ id: `image-${crypto.randomUUID()}`, path, name, usage, mime, size: bytes.length });
}

export async function readObjectImage(store, image) {
  const ref = normalizeImageRef(image);
  const blob = await store.driver.readBlob(store.path(ref.path));
  if (!blob) throw new Error("本地图片文件不存在");
  return blob.slice(0, blob.size, ref.mime);
}
