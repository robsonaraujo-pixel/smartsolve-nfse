import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "../services/db.js";

const { usuarios, usuarioEmpresas, empresas, auditoria } = schema;

export default async function (app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const body = z.object({ email: z.string().email(), senha: z.string().min(1) }).parse(req.body);
    const u = await db.query.usuarios.findFirst({ where: eq(usuarios.email, body.email.toLowerCase()) });
    if (!u || !u.ativo || !(await bcrypt.compare(body.senha, u.senhaHash))) return reply.code(401).send({ erro: "E-mail ou senha inválidos" });
    const token = app.jwt.sign({ id: u.id, papel: u.papel, nome: u.nome });
    let lista;
    if (u.papel === "CLIENTE") {
      const v = await db.query.usuarioEmpresas.findMany({ where: eq(usuarioEmpresas.usuarioId, u.id) });
      lista = v.length ? await db.select({ id: empresas.id, cnpj: empresas.cnpj, razaoSocial: empresas.razaoSocial }).from(empresas).where(inArray(empresas.id, v.map((x) => x.empresaId))) : [];
    } else {
      lista = await db.select({ id: empresas.id, cnpj: empresas.cnpj, razaoSocial: empresas.razaoSocial }).from(empresas).where(eq(empresas.ativa, true));
    }
    await db.insert(auditoria).values({ usuarioId: u.id, acao: "LOGIN" });
    return { token, usuario: { id: u.id, nome: u.nome, papel: u.papel }, empresas: lista };
  });

  app.get("/auth/me", { preHandler: app.autenticar }, async (req) => {
    const ids = await app.empresasVisiveis(req);
    const sel = { id: empresas.id, cnpj: empresas.cnpj, razaoSocial: empresas.razaoSocial, tpAmb: empresas.tpAmb };
    const lista = ids ? (ids.length ? await db.select(sel).from(empresas).where(inArray(empresas.id, ids)) : []) : await db.select(sel).from(empresas);
    return { usuario: req.user, empresas: lista };
  });
}
