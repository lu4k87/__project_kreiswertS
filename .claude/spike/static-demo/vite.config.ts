import path from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";

const realClient = path.resolve("src/server/db/client.ts");
const demoClient = path.resolve(process.env.DEMO_DB_CLIENT ?? "demo/db-client.node.ts");

// Swaps the database client for the in-process one; every other file stays as it is.
const demoDatabase = (): Plugin => ({
  name: "kreiswerts-demo-database",
  enforce: "pre",
  load(id) {
    if (id.split("?")[0] === realClient) return readFileSync(demoClient, "utf8");
  },
});

export default defineConfig({ plugins: [demoDatabase(), vinext()] });
