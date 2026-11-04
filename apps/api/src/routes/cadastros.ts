import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { db, schema, erro } from "../services/db.js";

const { tomadores, servicosCatalogo } = schema;

const tomadorSchema = z.object({
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/).optional(),
  cpf: z.string().regex(/^\d{11}$/).optional(),
  nif: z.string().optional(),
  nome: z.string().min(2),
  im: z.string().optional(),
  email: z.string().email().optional(),
  fone: z.string().optional(),
  cMun: z.string().regex(/^\d{7}$/).optional(),
  cep: z.string().regex(/^\d{8}$/).optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cPais: z.string().length(2).optional(),
});

const servicoSchema = z.object({
  apelido: z.string().min(2),
  cTribNac: z.string().regex(/^\d{6}$/, "cTribNac com 6 dígitos, ex.: 170201"),
  cTribMun: z.string().optional(),
  cNBS: z.string().regex(/^\d{9}$/).optional(),
  cIndOp: z.string().optional(),
  descricaoPadrao: z.string().min(2).max(2000),
  cstPisCofins: z.string().regex(/^\d{2}$/).default("00"),
  tpRetPisCofins: z.union([z.literal(1), z.literal(2)]).optional(),
  padrao: z.boolean().default(false),
});

/** Tomadores e catálogo de serviços, sempre dentro do escopo de uma empresa. */
export default async function (app: FastifyInstance) {
  app.addHook("preHandler", app.autenticar);

  app.get("/empresas/:empresaId/tomadores", async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId);
    const q = (req.query as { q?: string }).q;
    return db
      .select()
      .from(tomadores)
      .where(and(eq(tomadores.empresaId, empresaId), q ? or(like(tomadores.nome, `%${q}%`), like(tomadores.cnpj, `%${q}%`), like(tomadores.cpf, `%${q}%`)) : undefined))
      .orderBy(tomadores.nome)
      .limit(100);
  });

  app.post("/empresas/:empresaId/tomadores", async (req, reply) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId, "podeEmitir");
    const body = tomadorSchema.parse(req.body);
    if (!body.cnpj && !body.cpf && !body.nif) return reply.code(422).send({ erro: "Informe CNPJ, CPF ou NIF" });
    const [t] = await db.insert(tomadores).values({ empresaId, ...body }).returning();
    return reply.code(201).send(t);
  });

  app.patch("/empresas/:empresaId/tomadores/:id", async (req) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await app.exigirEmpresa(req, empresaId, "podeEmitir");
    const body = tomadorSchema.partial().parse(req.body);
    const [t] = await db.update(tomadores).set(body).where(and(eq(tomadores.id, id), eq(tomadores.empresaId, empresaId))).returning();
    if (!t) throw erro(404, "Tomador não encontrado");
    return t;
  });

  app.get("/empresas/:empresaId/servicos", async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId);
    return db.select().from(servicosCatalogo).where(eq(servicosCatalogo.empresaId, empresaId)).orderBy(desc(servicosCatalogo.padrao), servicosCatalogo.apelido);
  });

  app.post("/empresas/:empresaId/servicos", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req, reply) => {
    const { empresaId } = req.params as { empresaId: string };
    const body = servicoSchema.parse(req.body);
    if (body.padrao) await db.update(servicosCatalogo).set({ padrao: false }).where(eq(servicosCatalogo.empresaId, empresaId));
    const [s] = await db.insert(servicosCatalogo).values({ empresaId, ...body }).returning();
    return reply.code(201).send(s);
  });

  app.delete("/empresas/:empresaId/servicos/:id", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req, reply) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await db.delete(servicosCatalogo).where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.empresaId, empresaId)));
    return reply.code(204).send();
  });
}
