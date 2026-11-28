// Build of the static demo: vinext (the Next.js API on Vite) builds the unchanged app; only the database client is swapped.
import path from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";

const realClient = path.resolve("src/server/db/client.ts");
const demoClient = path.resolve("demo/db-client.browser.ts");

const demoDatabase = (): Plugin => ({
  name: "kreiswerts-demo-database",
  enforce: "pre",
  load(id) {
    if (id.split("?")[0] === realClient) return readFileSync(demoClient, "utf8");
  },
});

// envDir false: no .env file is read – the worker's environment is public (demo/sw/globals.js).
export default defineConfig({ envDir: false, plugins: [demoDatabase(), vinext()] });
