// Builds the static demo into demo/out/<base path>/: client files, service worker with the server code, database files.
// Run `npm run demo:db` first (demo/demo-db.tar.gz).
import { build } from "esbuild";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, realpathSync, renameSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { ADMIN_PASSWORD, ARCHITECTURE_URL, AUTH_SECRET, BASE, SITE_PASSWORD } from "./config.mjs";

const DUMP = "demo/demo-db.tar.gz";
if (!existsSync(DUMP)) throw new Error(`${DUMP} is missing – run "npm run demo:db" first`);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const out = path.join("demo/out", BASE);

// The build runs in a copy of the sources: vinext writes next-env.d.ts and .next/types/routes.d.ts into the folder it
// builds in, and here those belong to the normal app (type check, dev server). The copy has no .env file either.
const work = realpathSync(mkdtempSync(path.join(tmpdir(), "kreiswerts-demo-build-")));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const generated = /^demo\/(out|sql|shots)(\/|$)/;
for (const entry of ["src", "public", "demo", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "package.json"]) {
  cpSync(entry, path.join(work, entry), { recursive: true, filter: (source) => !generated.test(source) });
}
symlinkSync(path.resolve("node_modules"), path.join(work, "node_modules"), "dir");

// Minimal environment: nothing from the shell reaches the bundle. NEXT_PUBLIC_* values are inlined into the pages
// (src/lib/demo.ts); the rest is only needed while building.
execFileSync("npx", ["--no-install", "vite", "build", "--config", "demo/vite.config.mts"], {
  cwd: work,
  stdio: ["ignore", "ignore", "inherit"],
  env: {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production",
    DEMO_BASE_PATH: BASE, DATABASE_URL: "pglite://browser", BETTER_AUTH_SECRET: AUTH_SECRET, BETTER_AUTH_URL: "http://127.0.0.1",
    NEXT_PUBLIC_DEMO_STATIC: "1", NEXT_PUBLIC_DEMO_BASE_PATH: BASE, NEXT_PUBLIC_DEMO_COMMIT: git("rev-parse", "--short", "HEAD"), NEXT_PUBLIC_DEMO_DATE: git("log", "-1", "--format=%cs"),
    NEXT_PUBLIC_DEMO_PASSWORD: SITE_PASSWORD, NEXT_PUBLIC_DEMO_ADMIN_PASSWORD: ADMIN_PASSWORD, NEXT_PUBLIC_DEMO_ARCHITECTURE_URL: ARCHITECTURE_URL,
  },
});

// Vite names modules of the linked node_modules by their real path, relative to the build folder: that would publish
// the home folder and the project path of this machine. Shorten those names (they are only keys) before bundling.
const localPrefixes = [[path.relative(work, path.resolve("node_modules")), "node_modules"], [work, ""]];
const withoutLocalPaths = (dir) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) withoutLocalPaths(file);
    else if (/\.(m?js|json|html|css)$/.test(name)) {
      const text = readFileSync(file, "utf8");
      const clean = localPrefixes.reduce((result, [from, to]) => result.replaceAll(from, to), text);
      if (clean !== text) writeFileSync(file, clean);
    }
  }
};
withoutLocalPaths(path.join(work, "dist"));

rmSync("demo/out", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(work, "dist/client"), out, { recursive: true });
rmSync(path.join(out, ".vite"), { recursive: true, force: true }); // build metadata nobody loads at run time
// vinext puts hashed assets under the base path inside dist/client; public files sit at its root → one folder for both
if (existsSync(path.join(out, BASE, "_next"))) {
  renameSync(path.join(out, BASE, "_next"), path.join(out, "_next"));
  rmSync(path.join(out, BASE.split("/")[1]), { recursive: true });
}
const walk = (dir, prefix = "") => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), `${prefix}/${name}`) : [`${prefix}/${name}`]));
const staticFiles = walk(out).filter((file) => !file.startsWith("/_next/static/"));

// Database files; their hashes tell the browser when to fetch them again and when to load the seeded data anew.
mkdirSync(path.join(out, "demo-files"));
const pglite = "node_modules/@electric-sql/pglite/dist";
const databaseFiles = [`${pglite}/pglite.wasm`, `${pglite}/initdb.wasm`, `${pglite}/pglite.data`, DUMP].map((source) => {
  const name = path.basename(source);
  cpSync(source, path.join(out, "demo-files", name));
  return { name, bytes: statSync(source).size, hash: createHash("sha256").update(readFileSync(source)).digest("hex").slice(0, 12) };
});
const dbVersion = databaseFiles.at(-1).hash;
const filesVersion = createHash("sha256").update(databaseFiles.map((file) => file.hash).join()).digest("hex").slice(0, 12);

const shim = (name) => path.join(work, `demo/sw/shims/${name}.js`);
const alias = {};
for (const [name, file] of Object.entries({ async_hooks: "async_hooks", crypto: "crypto", fs: "fs", "fs/promises": "fs-promises", path: "path", os: "os", url: "url", module: "module", buffer: "buffer", util: "util", stream: "stream" })) {
  alias[`node:${name}`] = shim(file);
  if (name !== "buffer") alias[name] = shim(file);
}
for (const name of ["zlib", "stream/promises", "events", "string_decoder", "http", "https", "net", "tls", "child_process", "worker_threads", "perf_hooks"]) alias[name] = alias[`node:${name}`] = path.join(work, "demo/sw/shims/unused.cjs");
const result = await build({
  entryPoints: [path.join(work, "demo/sw/entry.js")], absWorkingDir: work, outfile: path.resolve(out, "sw.js"), bundle: true, format: "iife", platform: "browser", target: "es2022",
  minify: process.env.DEMO_MINIFY !== "0", alias, logLevel: "warning", logOverride: { "direct-eval": "silent" }, conditions: ["worker", "browser"],
  define: {
    __STATIC_FILES__: JSON.stringify(staticFiles), __DEMO_BUILD__: JSON.stringify({ dbVersion, filesVersion, authSecret: AUTH_SECRET }),
    "import.meta.url": "__META_URL__", "import.meta.dirname": '"/"', "import.meta.filename": '"/sw.js"', "process.env.NODE_ENV": '"production"',
  },
  banner: { js: "var __META_URL__ = self.location.href;" },
});
writeFileSync(
  path.join(out, "index.html"),
  readFileSync("demo/boot.html", "utf8").replaceAll("__BASE__", BASE).replaceAll("__FILES_VERSION__", filesVersion)
    .replaceAll("__FILES__", JSON.stringify(databaseFiles.map(({ name, bytes }) => ({ name, bytes })))),
);

// GitHub Pages (Jekyll) leaves out every file and folder whose name starts with "_" → store them as "u_…";
// the worker maps the requests (sw/entry.js). The start page itself needs none of them.
const publishable = (dir) => {
  for (const name of readdirSync(dir)) {
    const target = path.join(dir, name.startsWith("_") ? `u${name}` : name);
    if (target !== path.join(dir, name)) renameSync(path.join(dir, name), target);
    if (statSync(target).isDirectory()) publishable(target);
  }
};
publishable(out);
// Deep link without the worker: the host answers 404. The portfolio's 404 page sends such paths to the start page
// (config of the portfolio); this copy does the same for demo/serve.mjs.
writeFileSync("demo/out/404.html", `<!doctype html><meta charset="utf-8"><title>KreiswertS</title><script>if (location.pathname.startsWith("${BASE}/")) location.replace("${BASE}/?next=" + encodeURIComponent(location.pathname + location.search + location.hash));</script>`);

// Last line of defence: no value of a local .env file and no path of this machine may appear in what gets published.
// Values that also stand in the tracked .env.example are public already (placeholders, the local address) and do
// not count. Searched as written and base64, hex, URL and JSON encoded, also inside gzipped files.
const example = existsSync(".env.example") ? readFileSync(".env.example", "utf8") : "";
const encodings = (value) => [...new Set([value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1), Buffer.from(value).toString("base64").replace(/=+$/, ""), Buffer.from(value).toString("hex")])];
const localValues = readdirSync(".").filter((file) => /^\.env(\..+)?$/.test(file) && file !== ".env.example").flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/^\s*(?:export\s+)?([\w.-]+)\s*[=:]\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|`([^`]*)`|([^#\r\n]*?))\s*(?:#.*)?$/gm)]
    .map(([, key, double, single, backtick, bare]) => ({ key, value: double ?? single ?? backtick ?? bare ?? "" }))
    .flatMap(({ key, value }) => [value, ...(value.match(/:\/\/[^:/]+:([^@]+)@/)?.slice(1) ?? [])].map((part) => ({ file, key, value: part }))) // a URL and the password inside it
    .filter(({ value }) => value.length >= 8 && !example.includes(value))
    .flatMap((entry) => encodings(entry.value).map((value) => ({ ...entry, value }))));
const localPaths = [homedir(), work].map((value) => ({ file: "this machine", key: "a local path", value }));
for (const published of walk("demo/out")) {
  const raw = readFileSync(path.join("demo/out", published));
  const texts = [raw.toString("utf8"), raw.toString("latin1"), ...(published.endsWith(".gz") ? [gunzipSync(raw).toString("latin1")] : [])];
  const hit = [...localValues, ...localPaths].find(({ value }) => texts.some((text) => text.includes(value)));
  if (hit) { rmSync("demo/out", { recursive: true }); throw new Error(`the value of ${hit.key} from ${hit.file} appears in ${published} – demo/out removed, nothing may be published`); }
}
const megabytes = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
console.log(`demo/out${BASE} · sw.js ${megabytes(statSync(path.join(out, "sw.js")).size)} · database files ${megabytes(databaseFiles.reduce((sum, file) => sum + file.bytes, 0))} · warnings: ${result.warnings.length} · local .env values checked: ${new Set(localValues.map((entry) => entry.file + entry.key)).size}, local paths: none`);
