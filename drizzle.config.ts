import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// db:pull überschreibt src/server/db/ mit dem Stand der echten Datenbank (Quelle: DB-Verantwortliche).
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/server/db/schema.ts", "./src/server/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
