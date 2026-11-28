// Plain static file server for testing the built demo (what GitHub Pages does).
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const root = path.resolve("demo/out");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
createServer((request, response) => {
  response.on("finish", () => console.log(response.statusCode, request.url));
  let file = path.join(root, decodeURIComponent(new URL(request.url, "http://x").pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file)) { response.writeHead(404, { "content-type": "text/plain" }).end("404 (static host)"); return; }
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(Number(process.env.PORT ?? 4312), "127.0.0.1");
