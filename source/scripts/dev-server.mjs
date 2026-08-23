import { createReadStream, statSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendHeaders(response, status, filePath = "") {
  response.statusCode = status;
  for (const [key, value] of Object.entries({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Range",
    "Cache-Control": "no-store",
    "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
  })) {
    response.setHeader(key, value);
  }
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${PORT}`).pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(ROOT, safePath));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return null;
  return filePath;
}

async function existingFile(filePath) {
  if (!filePath) return null;
  try {
    const current = await stat(filePath);
    if (current.isDirectory()) return join(filePath, "index.html");
    return filePath;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", `http://127.0.0.1:${PORT}`).pathname);

  if (request.method === "OPTIONS") {
    sendHeaders(response, 204);
    response.end();
    return;
  }

  if (!["GET", "HEAD"].includes(request.method || "")) {
    sendHeaders(response, 405);
    response.end("Method not allowed");
    return;
  }

  const filePath = await existingFile(resolveRequestPath(request.url || "/"));
  try {
    if (!filePath) throw new Error("Not found");
    await access(filePath);
    const info = statSync(filePath);
    sendHeaders(response, 200, filePath);
    response.setHeader("Content-Length", info.size);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch {
    sendHeaders(response, 404, ".txt");
    response.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CORS dev server running at http://127.0.0.1:${PORT}/`);
});
