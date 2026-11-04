import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { db, schema } from "./db.js";

/**
 * Na primeira subida em produção não há como fazer seed manual.
 * Se não existir nenhum usuário, cria o ADMIN a partir de ADMIN_EMAIL / ADMIN_SENHA.
 */
export async function garantirAdminInicial() {
  const [{ n }] = await db.select({ n: count() }).from(schema.usuarios);
  if (n > 0) return;
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) {
    console.warn("Nenhum usuário cadastrado e ADMIN_EMAIL/ADMIN_SENHA não definidos — ninguém conseguirá entrar.");
    return;
  }
  await db.insert(schema.usuarios).values({ nome: "Administrador", email: email.toLowerCase(), senhaHash: await bcrypt.hash(senha, 10), papel: "ADMIN" });
  console.log(`Admin inicial criado: ${email}`);
}
