import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

/**
 * DATABASE_URL:
 *   file:./dev.db                      → SQLite local (dev) ou em volume (produção simples)
 *   libsql://xxx.turso.io + DATABASE_AUTH_TOKEN → Turso (SQLite gerenciado, sem volume)
 */
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./dev.db", authToken: process.env.DATABASE_AUTH_TOKEN });
export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;

/** Aplica as migrações SQL de apps/api/drizzle na subida do servidor. */
export async function migrarBanco() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/src/db → ../../../drizzle ; src/db → ../../drizzle
  const candidatos = [path.resolve(here, "../../../drizzle"), path.resolve(here, "../../drizzle")];
  const { existsSync } = await import("node:fs");
  const dir = candidatos.find((c) => existsSync(c));
  if (!dir) throw new Error("Pasta de migrações 'drizzle' não encontrada");
  await migrate(db, { migrationsFolder: dir });
}
