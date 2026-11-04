import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../services/db.js";

const { usuarios, usuarioEmpresas, empresas, auditoria } = schema;

/** Gestão de usuários — só ADMIN. Um CLIENTE nasce vinculado a uma ou mais empresas (CNPJ). */
export default async function (app: FastifyInstance) {
  const admin = { preHandler: app.exigirPapel("ADMIN") };

  app.get("/usuarios", admin, async () => {
    const lista = await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo, criadoEm: usuarios.criadoEm }).from(usuarios).orderBy(usuarios.nome);
    const vinculos = await db
      .select({ usuarioId: usuarioEmpresas.usuarioId, empresaId: usuarioEmpresas.empresaId, podeEmitir: usuarioEmpresas.podeEmitir, podeCancelar: usuarioEmpresas.podeCancelar, cnpj: empresas.cnpj, razaoSocial: empresas.razaoSocial })
      .from(usuarioEmpresas)
      .innerJoin(empresas, eq(empresas.id, usuarioEmpresas.empresaId));
    return lista.map((u) => ({ ...u, empresas: vinculos.filter((v) => v.usuarioId === u.id) }));
  });

  app.post("/usuarios", admin, async (req, reply) => {
    const body = z
      .object({
        nome: z.string().min(2),
        email: z.string().email(),
        senha: z.string().min(8),
        papel: z.enum(["ADMIN", "OPERADOR", "CLIENTE"]).default("CLIENTE"),
        empresas: z.array(z.object({ empresaId: z.string(), podeEmitir: z.boolean().default(true), podeCancelar: z.boolean().default(false) })).default([]),
      })
      .parse(req.body);
    if (body.papel === "CLIENTE" && body.empresas.length === 0) return reply.code(422).send({ erro: "Usuário CLIENTE precisa de ao menos uma empresa vinculada" });
    const [u] = await db.insert(usuarios).values({ nome: body.nome, email: body.email.toLowerCase(), senhaHash: await bcrypt.hash(body.senha, 10), papel: body.papel }).returning({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel });
    if (body.empresas.length) await db.insert(usuarioEmpresas).values(body.empresas.map((e) => ({ usuarioId: u.id, ...e })));
    await db.insert(auditoria).values({ usuarioId: req.user.id, acao: "USUARIO_CRIADO", detalhe: u.email });
    return reply.code(201).send(u);
  });

  app.patch("/usuarios/:id", admin, async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({ nome: z.string().min(2).optional(), senha: z.string().min(8).optional(), ativo: z.boolean().optional(), papel: z.enum(["ADMIN", "OPERADOR", "CLIENTE"]).optional() }).parse(req.body);
    const [u] = await db
      .update(usuarios)
      .set({ nome: body.nome, ativo: body.ativo, papel: body.papel, senhaHash: body.senha ? await bcrypt.hash(body.senha, 10) : undefined })
      .where(eq(usuarios.id, id))
      .returning({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo });
    return u;
  });

  /** Vincula/atualiza acesso de um usuário a uma empresa (restrição por CNPJ). */
  app.put("/usuarios/:id/empresas/:empresaId", admin, async (req) => {
    const { id, empresaId } = req.params as { id: string; empresaId: string };
    const body = z.object({ podeEmitir: z.boolean().default(true), podeCancelar: z.boolean().default(false) }).parse(req.body ?? {});
    const [v] = await db
      .insert(usuarioEmpresas)
      .values({ usuarioId: id, empresaId, ...body })
      .onConflictDoUpdate({ target: [usuarioEmpresas.usuarioId, usuarioEmpresas.empresaId], set: body })
      .returning();
    return v;
  });

  app.delete("/usuarios/:id/empresas/:empresaId", admin, async (req, reply) => {
    const { id, empresaId } = req.params as { id: string; empresaId: string };
    await db.delete(usuarioEmpresas).where(and(eq(usuarioEmpresas.usuarioId, id), eq(usuarioEmpresas.empresaId, empresaId)));
    return reply.code(204).send();
  });
}
