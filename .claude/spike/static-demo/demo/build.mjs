// Builds the static demo into demo/out/<base path>/: client files, service worker with the server code, database files.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, renameSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_PATH ?? "/web_kreiswerts/app";
const out = path.join("demo/out", BASE);
execFileSync("npx", ["vite", "build"], {
  stdio: ["ignore", "ignore", "inherit"],
  env: { ...process.env, DEMO_BASE_PATH: BASE, DEMO_DB_CLIENT: "demo/db-client.browser.ts", DATABASE_URL: "pglite://browser",
    BETTER_AUTH_SECRET: "kreiswerts-static-demo-public-not-a-secret-0001", BETTER_AUTH_URL: "http://127.0.0.1" },
});
rmSync("demo/out", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("dist/client", out, { recursive: true });
// vinext puts hashed assets under the base path inside dist/client; public files sit at its root → one folder for both
if (existsSync(path.join(out, BASE, "_next"))) {
  renameSync(path.join(out, BASE, "_next"), path.join(out, "_next"));
  rmSync(path.join(out, BASE.split("/")[1]), { recursive: true });
}
const walk = (dir, prefix = "") => readdirSync(dir).flatMap((name) => statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), `${prefix}/${name}`) : [`${prefix}/${name}`]);
const staticFiles = walk(out).filter((file) => !file.startsWith("/_next/static/"));
mkdirSync(path.join(out, "_demo"));
const pglite = "node_modules/@electric-sql/pglite/dist";
for (const name of ["pglite.wasm", "initdb.wasm", "pglite.data"]) cpSync(path.join(pglite, name), path.join(out, "_demo", name));
cpSync("demo/demo-db.tar.gz", path.join(out, "_demo/demo-db.tar.gz"));
const shim = (name) => path.resolve(`demo/sw/shims/${name}.js`);
const alias = {};
for (const [name, file] of Object.entries({ async_hooks: "async_hooks", crypto: "crypto", fs: "fs", "fs/promises": "fs-promises", path: "path", os: "os", url: "url", module: "module", buffer: "buffer", util: "util", stream: "stream" })) {
  alias[`node:${name}`] = shim(file);
  if (name !== "buffer") alias[name] = shim(file);
}
for (const name of ["zlib", "stream/promises", "events", "string_decoder", "http", "https", "net", "tls", "child_process", "worker_threads", "perf_hooks"]) alias[name] = alias[`node:${name}`] = path.resolve("demo/sw/shims/unused.cjs");
const result = await build({
  entryPoints: ["demo/sw/entry.js"], outfile: path.join(out, "sw.js"), bundle: true, format: "iife", platform: "browser", target: "es2022",
  minify: process.env.DEMO_MINIFY !== "0", alias, logLevel: "warning", metafile: true, conditions: ["worker", "browser"],
  define: { __STATIC_FILES__: JSON.stringify(staticFiles), "import.meta.url": "__META_URL__", "import.meta.dirname": '"/"', "import.meta.filename": '"/sw.js"', "process.env.NODE_ENV": '"production"' },
  banner: { js: "var __META_URL__ = self.location.href;" },
});
writeFileSync(path.join(out, "index.html"), readFileSync("demo/boot.html", "utf8").replaceAll("__BASE__", BASE));
const size = (file) => `${(statSync(file).size / 1e6).toFixed(1)} MB`;
console.log(`sw.js ${size(path.join(out, "sw.js"))} · static files outside _next/static: ${staticFiles.length} · warnings: ${result.warnings.length}`);
