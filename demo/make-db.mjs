// Builds the demo database once: schema (drizzle-kit generate) + seed (unchanged scripts/seed.mjs) into PGlite, then dumps it.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { ADMIN_PASSWORD, SITE_PASSWORD } from "./config.mjs";

const run = (cmd, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → ${code}`))));
  });

const PORT = 55433;
rmSync("demo/sql", { recursive: true, force: true });
await run("npx", ["drizzle-kit", "generate", "--config", "demo/drizzle.config.ts"]);
const sqlFile = readdirSync("demo/sql").find((name) => name.endsWith(".sql"));
const db = await PGlite.create();
for (const statement of readFileSync(`demo/sql/${sqlFile}`, "utf8").split("--> statement-breakpoint")) await db.exec(statement);
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();
await run("node", ["scripts/seed.mjs", "--demo"], {
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`,
  DEMO_PASSWORD: SITE_PASSWORD, // set here → the seed never takes the ones from .env.demo
  DEMO_ADMIN_PASSWORD: ADMIN_PASSWORD,
});
await server.stop();
const counts = (await db.query("select (select count(*)::int from sites) as sites, (select count(*)::int from auth_users) as accounts, (select count(*)::int from offers) as offers")).rows[0];
const dump = Buffer.from(await (await db.dumpDataDir("gzip")).arrayBuffer());
writeFileSync("demo/demo-db.tar.gz", dump);
console.log(`demo/demo-db.tar.gz · ${(dump.length / 1e6).toFixed(1)} MB · sites ${counts.sites} · accounts ${counts.accounts} · offers ${counts.offers}`);
await db.close();
