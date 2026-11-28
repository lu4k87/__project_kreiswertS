// Plain static file server for testing the built demo. Behaves like GitHub Pages: no file or folder starting with "_"
// or "." is served, and a missing path gets 404.html with status 404.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PORT } from "./config.mjs";
const root = path.resolve("demo/out");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://x").pathname); } catch { response.writeHead(400).end(); return; }
  let file = path.join(root, pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file) || /\/[_.]/.test(file.slice(root.length))) { response.writeHead(404, { "content-type": TYPES[".html"] }).end(readFileSync(path.join(root, "404.html"))); return; }
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(PORT, "127.0.0.1", () => console.log(`static demo: http://127.0.0.1:${PORT}/ (files from demo/out)`));
