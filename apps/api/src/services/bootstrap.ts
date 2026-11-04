import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { db, schema } from "./db.js";

/**
 * Bootstrap admin. ADMIN_RESET_PASSWORD is an explicit, temporary recovery
 * switch for an existing admin. Remove the Railway variable immediately after
 * the successful deployment; never log the supplied password.
 */
export async function garantirAdminInicial() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const resetPassword = process.env.ADMIN_RESET_PASSWORD;
  if (email && resetPassword) {
    const admin = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.email, email) });
    if (admin && admin.papel === "ADMIN") {
      await db.update(schema.usuarios)
        .set({ senhaHash: await bcrypt.hash(resetPassword, 12), ativo: true })
        .where(eq(schema.usuarios.id, admin.id));
      console.log("Senha do administrador redefinida por procedimento temporário.");
    }
  }

  const [{ n }] = await db.select({ n: count() }).from(schema.usuarios);
  if (n > 0) return;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) {
    console.warn("Nenhum usuário cadastrado e ADMIN_EMAIL/ADMIN_SENHA não definidos — ninguém conseguirá entrar.");
    return;
  }
  await db.insert(schema.usuarios).values({
    nome: "Administrador",
    email,
    senhaHash: await bcrypt.hash(senha, 12),
    papel: "ADMIN",
  });
  console.log(`Admin inicial criado: ${email}`);
}
