// Builds the demo database once: schema (drizzle-kit generate) + seed (unchanged scripts/seed.mjs) into PGlite, then dumps it.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";

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
  DEMO_PASSWORD: process.env.DEMO_PASSWORD ?? "Demo-Kreiswert-2026",
  DEMO_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD ?? "Admin-Kreiswert-2026",
});
await server.stop();
const counts = await db.query(`select string_agg(relname || '=' || n_live_tup, ' ' order by relname) as tables from pg_stat_user_tables where n_live_tup > 0`);
console.log("rows:", counts.rows[0]);
const dump = await db.dumpDataDir("gzip");
writeFileSync("demo/demo-db.tar.gz", Buffer.from(await dump.arrayBuffer()));
console.log("dump bytes:", (await dump.arrayBuffer()).byteLength);
await db.close();
