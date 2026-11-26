import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// db:pull overwrites src/server/db/ with the state of the real database (source: database owners).
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/server/db/schema.ts", "./src/server/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
