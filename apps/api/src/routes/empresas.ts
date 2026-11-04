import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema, erro } from "../services/db.js";
import { salvarCertificado, salvarCertificadoEscritorio } from "../services/certificado.js";
import { cifrar } from "../services/cripto.js";

const { empresas, certificados, certificadoEscritorio, escritorio, syncDfe, auditoria } = schema;

const empresaSchema = z.object({
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/, "CNPJ com 14 posições, sem máscara"),
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional(),
  im: z.string().optional(),
  cMun: z.string().regex(/^\d{7}$/, "IBGE com 7 dígitos"),
  email: z.string().email().optional(),
  fone: z.string().optional(),
  opSimpNac: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  regApTribSN: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  regEspTrib: z.number().int().min(0).max(6).default(0),
  modoTotTrib: z.enum(["INFORMAR", "IBPT", "SN_NOMINAL"]).default("IBPT"),
  pTribSN: z.number().min(0).max(100).optional(),
  informarIbsCbs: z.boolean().default(false),
  tpAmb: z.union([z.literal(1), z.literal(2)]).default(2),
  serieDps: z.string().regex(/^\d{1,5}$/).default("1"),
  proximoNDps: z.number().int().min(1).optional(),
  modoAcesso: z.enum(["PORTAL_SENHA", "CERT_PROPRIO", "CERT_ESCRITORIO"]).default("CERT_PROPRIO"),
  procuracaoValidaAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const comData = <T extends { procuracaoValidaAte?: string }>(b: T) => ({ ...b, procuracaoValidaAte: b.procuracaoValidaAte ? new Date(b.procuracaoValidaAte) : undefined });

export default async function (app: FastifyInstance) {
  app.get("/empresas", { preHandler: app.autenticar }, async (req) => {
    const ids = await app.empresasVisiveis(req);
    const sel = {
      id: empresas.id, cnpj: empresas.cnpj, razaoSocial: empresas.razaoSocial, nomeFantasia: empresas.nomeFantasia, cMun: empresas.cMun, tpAmb: empresas.tpAmb,
      opSimpNac: empresas.opSimpNac, regApTribSN: empresas.regApTribSN, modoTotTrib: empresas.modoTotTrib, pTribSN: empresas.pTribSN, informarIbsCbs: empresas.informarIbsCbs, serieDps: empresas.serieDps,
      proximoNDps: empresas.proximoNDps, ativa: empresas.ativa, modoAcesso: empresas.modoAcesso, portalLogin: empresas.portalLogin, procuracaoValidaAte: empresas.procuracaoValidaAte, certSubject: certificados.subject, certValidoAte: certificados.validoAte,
    };
    const q = db.select(sel).from(empresas).leftJoin(certificados, eq(certificados.empresaId, empresas.id)).orderBy(empresas.razaoSocial);
    if (ids) return ids.length ? q.where(inArray(empresas.id, ids)) : [];
    return q;
  });

  app.get("/empresas/:id", { preHandler: app.autenticar }, async (req) => {
    const { id } = req.params as { id: string };
    await app.exigirEmpresa(req, id);
    const e = await db.query.empresas.findFirst({ where: eq(empresas.id, id) });
    if (!e) throw erro(404, "Empresa não encontrada");
    const cert = await db.select({ subject: certificados.subject, validoAte: certificados.validoAte }).from(certificados).where(eq(certificados.empresaId, id));
    const sync = await db.query.syncDfe.findFirst({ where: eq(syncDfe.empresaId, id) });
    return { ...e, certificado: cert[0] ?? null, syncDfe: sync ?? null };
  });

  app.post("/empresas", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req, reply) => {
    const body = empresaSchema.parse(req.body);
    const [e] = await db.insert(empresas).values(comData(body)).returning();
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId: e.id, acao: "EMPRESA_CRIADA", detalhe: e.cnpj });
    return reply.code(201).send(e);
  });

  app.patch("/empresas/:id", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req) => {
    const { id } = req.params as { id: string };
    const body = empresaSchema.partial().extend({ ativa: z.boolean().optional() }).parse(req.body);
    const [e] = await db.update(empresas).set(comData(body)).where(eq(empresas.id, id)).returning();
    if (!e) throw erro(404, "Empresa não encontrada");
    return e;
  });

  /** Upload do certificado A1: multipart com `pfx` (arquivo) e `senha`. */
  app.post("/empresas/:id/certificado", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    let pfx: Buffer | undefined;
    let senha: string | undefined;
    for await (const part of req.parts()) {
      if (part.type === "file" && part.fieldname === "pfx") pfx = await part.toBuffer();
      else if (part.type === "field" && part.fieldname === "senha") senha = String(part.value);
    }
    if (!pfx || !senha) return reply.code(422).send({ erro: "Envie o arquivo .pfx no campo 'pfx' e a senha no campo 'senha'" });
    const emp = await db.query.empresas.findFirst({ where: eq(empresas.id, id) });
    if (!emp) throw erro(404, "Empresa não encontrada");
    try {
      const info = await salvarCertificado(id, pfx, senha);
      const alerta = info.cnpjOuCpf && info.cnpjOuCpf !== emp.cnpj ? `Atenção: o certificado é de ${info.cnpjOuCpf}, empresa cadastrada com ${emp.cnpj}` : undefined;
      await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId: id, acao: "CERTIFICADO_ATUALIZADO", detalhe: info.subject });
      return { ...info, alerta };
    } catch (e) {
      return reply.code(422).send({ erro: `Não foi possível ler o PFX: ${(e as Error).message}` });
    }
  });

  /** Credenciais do portal nacional (modo PORTAL_SENHA). Senha cifrada; nunca retorna em claro. */
  app.put("/empresas/:id/portal-credenciais", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({ login: z.string().min(3), senha: z.string().min(1) }).parse(req.body);
    const s = cifrar(Buffer.from(body.senha, "utf8"));
    const [e] = await db.update(empresas).set({ portalLogin: body.login, portalSenhaCifrada: Buffer.concat([s.iv, s.cifrado]), modoAcesso: "PORTAL_SENHA" }).where(eq(empresas.id, id)).returning({ id: empresas.id, portalLogin: empresas.portalLogin });
    if (!e) throw erro(404, "Empresa não encontrada");
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId: id, acao: "PORTAL_CREDENCIAIS_ATUALIZADAS" });
    return e;
  });

  /** Certificado A1 do escritório contábil (usado por procuração). */
  app.get("/escritorio/certificado", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async () => {
    const c = await db.select({ subject: certificadoEscritorio.subject, cnpj: certificadoEscritorio.cnpj, validoAte: certificadoEscritorio.validoAte }).from(certificadoEscritorio);
    return c[0] ?? null;
  });
  app.post("/escritorio/certificado", { preHandler: app.exigirPapel("ADMIN") }, async (req, reply) => {
    let pfx: Buffer | undefined;
    let senha: string | undefined;
    for await (const part of req.parts()) {
      if (part.type === "file" && part.fieldname === "pfx") pfx = await part.toBuffer();
      else if (part.type === "field" && part.fieldname === "senha") senha = String(part.value);
    }
    if (!pfx || !senha) return reply.code(422).send({ erro: "Envie o arquivo .pfx no campo 'pfx' e a senha no campo 'senha'" });
    try {
      const info = await salvarCertificadoEscritorio(pfx, senha);
      await db.insert(auditoria).values({ usuarioId: req.user.id, acao: "CERTIFICADO_ESCRITORIO_ATUALIZADO", detalhe: info.subject });
      return info;
    } catch (e) {
      return reply.code(422).send({ erro: `Não foi possível ler o PFX: ${(e as Error).message}` });
    }
  });

  /** Dados do escritório contábil + flag do certificado matriz. */
  app.get("/escritorio", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async () => {
    const e = await db.query.escritorio.findFirst();
    const c = await db.select({ subject: certificadoEscritorio.subject, cnpj: certificadoEscritorio.cnpj, validoAte: certificadoEscritorio.validoAte }).from(certificadoEscritorio);
    return { ...(e ?? { id: "escritorio", cnpj: null, razaoSocial: null, nomeFantasia: null, email: null, fone: null, usarCertificadoParaTodas: false }), certificado: c[0] ?? null };
  });
  app.put("/escritorio", { preHandler: app.exigirPapel("ADMIN") }, async (req) => {
    const body = z.object({
      cnpj: z.string().regex(/^[0-9A-Z]{14}$/).optional(),
      razaoSocial: z.string().min(2).optional(),
      nomeFantasia: z.string().optional(),
      email: z.string().email().optional(),
      fone: z.string().optional(),
      usarCertificadoParaTodas: z.boolean().optional(),
    }).parse(req.body);
    const [e] = await db.insert(escritorio).values({ id: "escritorio", ...body }).onConflictDoUpdate({ target: escritorio.id, set: { ...body, atualizadoEm: new Date() } }).returning();
    await db.insert(auditoria).values({ usuarioId: req.user.id, acao: "ESCRITORIO_ATUALIZADO", detalhe: JSON.stringify(body) });
    return e;
  });
}
