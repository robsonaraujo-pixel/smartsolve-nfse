import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, like, or, sum } from "drizzle-orm";
import { db, schema, erro } from "../services/db.js";
import { sincronizarDfe } from "../services/dfe.js";

const { documentos, auditoria } = schema;

/** Banco de XML: NFS-e emitidas, recebidas e sincronizadas, e eventos. */
export default async function (app: FastifyInstance) {
  app.addHook("preHandler", app.autenticar);

  app.get("/empresas/:empresaId/documentos", async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId);
    const q = req.query as { tipo?: "NFSE" | "EVENTO"; origem?: "EMITIDA" | "RECEBIDA" | "SINCRONIZADA"; competencia?: string; tomador?: string; page?: string };
    const take = 50;
    const page = Number(q.page ?? 1);
    const where = and(
      eq(documentos.empresaId, empresaId),
      eq(documentos.tipo, q.tipo ?? "NFSE"),
      q.origem ? eq(documentos.origem, q.origem) : undefined,
      q.competencia ? like(documentos.dCompet, `${q.competencia}%`) : undefined,
      q.tomador ? or(like(documentos.tomadorDoc, `%${q.tomador}%`), like(documentos.tomadorNome, `%${q.tomador}%`)) : undefined,
    );
    const [{ total }] = await db.select({ total: count() }).from(documentos).where(where);
    const itens = await db
      .select({
        id: documentos.id, tipo: documentos.tipo, origem: documentos.origem, chaveAcesso: documentos.chaveAcesso, tipoEvento: documentos.tipoEvento, nNfse: documentos.nNfse, dCompet: documentos.dCompet, dhProc: documentos.dhProc,
        emitenteDoc: documentos.emitenteDoc, emitenteNome: documentos.emitenteNome, tomadorDoc: documentos.tomadorDoc, tomadorNome: documentos.tomadorNome, cTribNac: documentos.cTribNac,
        vServ: documentos.vServ, vLiq: documentos.vLiq, vIssqn: documentos.vIssqn, cancelada: documentos.cancelada, importadoEm: documentos.importadoEm,
      })
      .from(documentos)
      .where(where)
      .orderBy(desc(documentos.dhProc), desc(documentos.importadoEm))
      .limit(take)
      .offset((page - 1) * take);
    return { total, page, itens };
  });

  app.get("/empresas/:empresaId/documentos/:id/xml", async (req, reply) => {
    const { empresaId, id } = req.params as { empresaId: string; id: string };
    await app.exigirEmpresa(req, empresaId);
    const d = await db.query.documentos.findFirst({ where: and(eq(documentos.id, id), eq(documentos.empresaId, empresaId)) });
    if (!d) throw erro(404, "Documento não encontrado");
    const nome = d.tipo === "NFSE" ? `NFSe_${d.chaveAcesso}.xml` : `EVT_${d.tipoEvento}_${d.chaveAcesso}.xml`;
    return reply.header("Content-Type", "application/xml; charset=utf-8").header("Content-Disposition", `attachment; filename="${nome}"`).send(d.xml);
  });

  /** Resumo por competência para fechamento (PGDAS-D / conferência do escritório). */
  app.get("/empresas/:empresaId/documentos/resumo", async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    await app.exigirEmpresa(req, empresaId);
    return db
      .select({ dCompet: documentos.dCompet, origem: documentos.origem, cancelada: documentos.cancelada, qtd: count(), vServ: sum(documentos.vServ), vLiq: sum(documentos.vLiq), vIssqn: sum(documentos.vIssqn) })
      .from(documentos)
      .where(and(eq(documentos.empresaId, empresaId), eq(documentos.tipo, "NFSE")))
      .groupBy(documentos.dCompet, documentos.origem, documentos.cancelada)
      .orderBy(desc(documentos.dCompet));
  });

  /** Puxa a caixa de DF-e do ADN (notas recebidas/sincronizadas e eventos). Agende por cron em produção. */
  app.post("/empresas/:empresaId/documentos/sincronizar", { preHandler: app.exigirPapel("ADMIN", "OPERADOR") }, async (req) => {
    const { empresaId } = req.params as { empresaId: string };
    const r = await sincronizarDfe(empresaId);
    await db.insert(auditoria).values({ usuarioId: req.user.id, empresaId, acao: "DFE_SINCRONIZADO", detalhe: JSON.stringify(r) });
    return r;
  });
}
