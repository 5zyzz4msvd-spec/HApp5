const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function assertPng(bytes) {
  if (bytes.length < 12) throw new Error("文件太小，不像 PNG。");
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error("不是有效 PNG 文件。");
  }
}

function readType(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function latin1(bytes) {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function base64ToUtf8(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return TEXT_DECODER.decode(bytes);
}

function utf8ToBase64(text) {
  const bytes = TEXT_ENCODER.encode(text);
  let bin = "";
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    bin += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(bin);
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function crc32(typeBytes, dataBytes) {
  let c = 0xffffffff;
  for (const byte of typeBytes) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  for (const byte of dataBytes) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = TEXT_ENCODER.encode(type);
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(typeBytes, data));
  return out;
}

function makeTextChunk(key, value) {
  const keyBytes = TEXT_ENCODER.encode(key);
  const valueBytes = TEXT_ENCODER.encode(value);
  const data = new Uint8Array(keyBytes.length + 1 + valueBytes.length);
  data.set(keyBytes, 0);
  data[keyBytes.length] = 0;
  data.set(valueBytes, keyBytes.length + 1);
  return makeChunk("tEXt", data);
}

export function parsePngChunks(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  assertPng(bytes);
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = readType(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.length) throw new Error(`PNG chunk ${type} 长度异常。`);
    chunks.push({
      type,
      length,
      offset,
      end,
      data: bytes.slice(dataStart, dataEnd),
      raw: bytes.slice(offset, end)
    });
    offset = end;
    if (type === "IEND") break;
  }
  return { bytes, chunks };
}

export function parseCharacterCard(arrayBuffer, fileName = "角色卡") {
  const png = parsePngChunks(arrayBuffer);
  const textChunks = png.chunks
    .filter((chunk) => chunk.type === "tEXt")
    .map((chunk) => {
      const zeroIndex = chunk.data.indexOf(0);
      if (zeroIndex < 0) return null;
      const key = latin1(chunk.data.slice(0, zeroIndex));
      const value = latin1(chunk.data.slice(zeroIndex + 1));
      return { key, value, length: chunk.length };
    })
    .filter(Boolean);

  const chara = textChunks.find((chunk) => chunk.key === "chara");
  const ccv3 = textChunks.find((chunk) => chunk.key === "ccv3");
  const selected = ccv3 || chara;
  if (!selected) throw new Error("没有找到 chara 或 ccv3 文本块。");

  const decodedText = base64ToUtf8(selected.value);
  const card = JSON.parse(decodedText);
  const charaCard = chara ? JSON.parse(base64ToUtf8(chara.value)) : null;
  const ccv3Card = ccv3 ? JSON.parse(base64ToUtf8(ccv3.value)) : null;

  return {
    id: crypto.randomUUID(),
    fileName,
    importedAt: Date.now(),
    imageBuffer: arrayBuffer,
    card,
    metadata: {
      width: null,
      height: null,
      textChunks: textChunks.map(({ key, length, value }) => ({ key, length, encodedLength: value.length })),
      hasChara: Boolean(chara),
      hasCcv3: Boolean(ccv3),
      charaEqualsCcv3: Boolean(charaCard && ccv3Card && JSON.stringify(charaCard) === JSON.stringify(ccv3Card))
    }
  };
}

export async function parseCharacterCardFile(file) {
  return parseCharacterCard(await file.arrayBuffer(), file.name);
}

export async function parseCharacterCardFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`加载失败：${response.status}`);
  const buffer = await response.arrayBuffer();
  const name = decodeURIComponent(url.split("/").pop() || "sample.png");
  return parseCharacterCard(buffer, name);
}

export function makeDownloadUrl(value, type = "application/json") {
  return URL.createObjectURL(new Blob([value], { type }));
}

export function downloadBlob(value, fileName, type) {
  const url = makeDownloadUrl(value, type);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCardJson(card) {
  downloadBlob(JSON.stringify(card, null, 2), `${safeFileName(card?.data?.name || card?.name || "card")}.json`, "application/json");
}

export function buildCardPngBytes(cardState, coverBuffer = null) {
  const imageBuffer = coverBuffer || cardState.imageBuffer;
  if (!imageBuffer) {
    throw new Error("当前卡没有原始 PNG，无法生成 PNG。");
  }
  const jsonText = JSON.stringify(cardState.card);
  const encoded = utf8ToBase64(jsonText);
  const replacementKeys = new Set(["chara", "ccv3"]);
  const parsed = parsePngChunks(imageBuffer);
  const parts = [parsed.bytes.slice(0, 8)];
  let inserted = false;

  for (const chunk of parsed.chunks) {
    if (chunk.type === "tEXt") {
      const zeroIndex = chunk.data.indexOf(0);
      const key = zeroIndex >= 0 ? latin1(chunk.data.slice(0, zeroIndex)) : "";
      if (replacementKeys.has(key)) {
        if (!inserted) {
          parts.push(makeTextChunk("chara", encoded));
          parts.push(makeTextChunk("ccv3", encoded));
          inserted = true;
        }
        continue;
      }
    }
    if (chunk.type === "IEND" && !inserted) {
      parts.push(makeTextChunk("chara", encoded));
      parts.push(makeTextChunk("ccv3", encoded));
      inserted = true;
    }
    parts.push(chunk.raw);
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

export function exportCardPng(cardState) {
  const bytes = buildCardPngBytes(cardState);
  downloadBlob(bytes, `${safeFileName(cardState.card?.data?.name || cardState.card?.name || "card")}.png`, "image/png");
}

export function safeFileName(name) {
  return String(name)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "card";
}

export function cloneCard(card) {
  return JSON.parse(JSON.stringify(card));
}

export function getCardData(card) {
  return card?.data || card || {};
}

export function ensureCardShape(card) {
  card.data ||= {};
  card.data.extensions ||= {};
  card.data.extensions.regex_scripts ||= [];
  card.data.character_book ||= { name: card.data.name || card.name || "世界书", entries: [] };
  card.data.character_book.entries ||= [];
  return card;
}
