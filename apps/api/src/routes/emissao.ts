import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, like } from "drizzle-orm";
import { db, schema, erro } from "../services/db.js";
import { prepararDps, transmitirDps, cancelarNfse } from "../services/emissao.js";

const { dps, documentos, tentativas, servicosCatalogo, auditoria, STATUS_DPS } = schema;

const pedidoSchema = z.object({
  dCompet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tomadorId: z.string().optional(),
  servicoId: z.string().optional(),
  servico: z
    .object({
      cTribNac: z.string().regex(/^\d{6}$/),
      cTribMun: z.string().optional(),
      cNBS: z.string().optional(),
      cIndOp: z.string().optional(),
      xDescServ: z.string().min(1).max(2000),
      cLocPrestacao: z.string().regex(/^\d{7}$/).optional(),
    })
    .optional(),
  xDescServ: z.string().max(2000).optional(), // sobrescreve a descrição padrão do serviço do catálogo
  vServ: z.number().positive(),
  vDescIncond: z.number().nonnegative().optional(),
  vDescCond: z.number().nonnegative().optional(),
  tribMun: z
    .object({
      tribISSQN: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      tpRetISSQN: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      pAliq: z.number().optional(),
    })
    .default({}),
  tribFed: z
    .object({
      cstPisCofins: z.string().regex(/^\d{2}$/).optional(),
      tpRetPisCofins: z.union([z.literal(1), z.literal(2)]).optional(),
      vRetCP: z.number().optional(),
      vRetIRRF: z.number().optional(),
      vRetCSLL: z.number().optional(),
    })
    .optional(),
  ibscbsXml: z.string().optional(),
  substituir: z.object({ chaveAcesso: z.string().length(50), cMotivo: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), xMotivo: z.string().optional() }).optional(),
  /** true = só prepara (rascunho) e devolve o XML para conferência; omitido = transmite */
  somenteRascunho: z.boolean().default(false),
});

export default async function (app: FastifyInstance) {
  app.addHook("preHandler", app.autenticar);

  app.get("/empresas/:empresaId/dps", async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId);
    const q = req.query as { status?: string; competencia?: string; page?: string };
    const take = 50;
    const skip = (Number(q.page ?? 1) - 1) * take;
    const status = STATUS_DPS.find((s) => s === q.status);
    return db
      .select({
        id: dps.id, serie: dps.serie, nDps: dps.nDps, idDps: dps.idDps, status: dps.status, dCompet: dps.dCompet, chaveAcesso: dps.chaveAcesso, erros: dps.erros, criadoEm: dps.criadoEm,
        nNfse: documentos.nNfse, tomadorNome: documentos.tomadorNome, vServ: documentos.vServ, vLiq: documentos.vLiq, cancelada: documentos.cancelada,
      })
      .from(dps)
      .leftJoin(documentos, eq(documentos.id, dps.documentoId))
      .where(and(eq(dps.empresaId, empresaId), status ? eq(dps.status, status) : undefined, q.competencia ? like(dps.dCompet, `${q.competencia}%`) : undefined))
      .orderBy(desc(dps.nDps))
      .limit(take)
      .offset(skip);
  });

  app.post("/empresas/:empresaId/dps", async (req, reply) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId, "podeEmitir");
    const body = pedidoSchema.parse(req.body);

    let servico = body.servico;
    let tribFed = body.tribFed;
    if (!servico && body.servicoId) {
      const s = await db.query.servicosCatalogo.findFirst({ where: and(eq(servicosCatalogo.id, body.servicoId), eq(servicosCatalogo.empresaId, empresaId)) });
      if (!s) throw erro(404, "Serviço do catálogo não encontrado");
      servico = { cTribNac: s.cTribNac, cTribMun: s.cTribMun ?? undefined, cNBS: s.cNBS ?? undefined, cIndOp: s.cIndOp ?? undefined, xDescServ: body.xDescServ ?? s.descricaoPadrao };
      tribFed = { cstPisCofins: s.cstPisCofins, tpRetPisCofins: (s.tpRetPisCofins ?? undefined) as 1 | 2 | undefined, ...body.tribFed };
    }
    if (!servico) return reply.code(422).send({ erro: "Informe servicoId (catálogo) ou servico" });

    const prep = await prepararDps({ empresaId, usuarioId: req.user.id, dCompet: body.dCompet, tomadorId: body.tomadorId, servico, vServ: body.vServ, vDescIncond: body.vDescIncond, vDescCond: body.vDescCond, tribMun: body.tribMun, tribFed, ibscbsXml: body.ibscbsXml, substituir: body.substituir });
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId, acao: "DPS_CRIADA", detalhe: prep.dps.idDps });
    if (body.somenteRascunho) return reply.code(201).send({ dps: prep.dps, xml: prep.xml });

    const result = await transmitirDps(prep.dps.id);
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId, acao: `DPS_${result.status}`, detalhe: result.chaveAcesso ?? result.idDps });
    return reply.code(result.status === "AUTORIZADA" ? 201 : 422).send(result);
  });

  /** Retransmite um rascunho ou uma DPS com erro de comunicação (idempotente). */
  app.post("/empresas/:empresaId/dps/:id/transmitir", async (req, reply) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await app.exigirEmpresa(req, empresaId, "podeEmitir");
    const row = await db.query.dps.findFirst({ where: and(eq(dps.id, id), eq(dps.empresaId, empresaId)) });
    if (!row) throw erro(404, "DPS não encontrada");
    const result = await transmitirDps(id);
    return reply.code(result.status === "AUTORIZADA" ? 200 : 422).send(result);
  });

  app.get("/empresas/:empresaId/dps/:id", async (req) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await app.exigirEmpresa(req, empresaId);
    const row = await db.query.dps.findFirst({ where: and(eq(dps.id, id), eq(dps.empresaId, empresaId)) });
    if (!row) throw erro(404, "DPS não encontrada");
    const tent = await db.select().from(tentativas).where(eq(tentativas.dpsId, id)).orderBy(desc(tentativas.em));
    const doc = row.documentoId ? await db.select({ id: documentos.id, nNfse: documentos.nNfse, chaveAcesso: documentos.chaveAcesso, cancelada: documentos.cancelada }).from(documentos).where(eq(documentos.id, row.documentoId)) : [];
    return { ...row, tentativas: tent, documento: doc[0] ?? null };
  });

  app.post("/empresas/:empresaId/dps/:id/cancelar", async (req, reply) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await app.exigirEmpresa(req, empresaId, "podeCancelar");
    const body = z.object({ cMotivo: z.union([z.literal(1), z.literal(2), z.literal(9)]), xMotivo: z.string().max(255).optional() }).parse(req.body);
    const row = await db.query.dps.findFirst({ where: and(eq(dps.id, id), eq(dps.empresaId, empresaId)) });
    if (!row) throw erro(404, "DPS não encontrada");
    const r = await cancelarNfse(id, body.cMotivo, body.xMotivo);
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId, acao: r.ok ? "NFSE_CANCELADA" : "CANCELAMENTO_REJEITADO", detalhe: id });
    return reply.code(r.ok ? 200 : 422).send(r);
  });
}
