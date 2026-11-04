import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { db, schema, erro } from "../services/db.js";

export interface SessaoUsuario {
  id: string;
  papel: "ADMIN" | "OPERADOR" | "CLIENTE";
  nome: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessaoUsuario;
    user: SessaoUsuario;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    autenticar: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirPapel: (...papeis: SessaoUsuario["papel"][]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** ADMIN/OPERADOR: qualquer empresa. CLIENTE: só as vinculadas (e com a permissão pedida). Lança 403. */
    exigirEmpresa: (req: FastifyRequest, empresaId: string, permissao?: "podeEmitir" | "podeCancelar") => Promise<void>;
    /** IDs de empresas visíveis ao usuário (null = todas). */
    empresasVisiveis: (req: FastifyRequest) => Promise<string[] | null>;
  }
}

export default fp(async (app: FastifyInstance) => {
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? "troque-esta-chave-em-producao", sign: { expiresIn: "12h" } });

  app.decorate("autenticar", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ erro: "Não autenticado" });
    }
  });

  app.decorate("exigirPapel", (...papeis: SessaoUsuario["papel"][]) => async (req: FastifyRequest, reply: FastifyReply) => {
    await app.autenticar(req, reply);
    if (reply.sent) return;
    if (!papeis.includes(req.user.papel)) reply.code(403).send({ erro: "Sem permissão" });
  });

  app.decorate("exigirEmpresa", async (req: FastifyRequest, empresaId: string, permissao?: "podeEmitir" | "podeCancelar") => {
    if (req.user.papel === "ADMIN" || req.user.papel === "OPERADOR") return;
    const v = await db.query.usuarioEmpresas.findFirst({
      where: and(eq(schema.usuarioEmpresas.usuarioId, req.user.id), eq(schema.usuarioEmpresas.empresaId, empresaId)),
    });
    if (!v) throw erro(403, "Empresa não autorizada para este usuário");
    if (permissao && !v[permissao]) throw erro(403, "Operação não permitida para este usuário");
  });

  app.decorate("empresasVisiveis", async (req: FastifyRequest) => {
    if (req.user.papel !== "CLIENTE") return null;
    const v = await db.query.usuarioEmpresas.findMany({ where: eq(schema.usuarioEmpresas.usuarioId, req.user.id), columns: { empresaId: true } });
    return v.map((x) => x.empresaId);
  });
});
