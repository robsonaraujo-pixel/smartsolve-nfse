import type { FastifyInstance } from "fastify";
import { buscarTribNac, buscarNbs, enumsXsd, CATALOGO_VERSAO, ENUMS_VERSAO } from "@smartsolve/nfse-core";

/** Catálogo oficial (lista de serviços nacional + NBS) e enums do XSD. Público para usuários autenticados. */
export default async function (app: FastifyInstance) {
  app.addHook("preHandler", app.autenticar);
  app.get("/catalogo/trib-nac", async (req) => buscarTribNac((req.query as { q?: string }).q ?? ""));
  app.get("/catalogo/nbs", async (req) => buscarNbs((req.query as { q?: string }).q ?? ""));
  app.get("/catalogo/enums", async () => ({ ...enumsXsd, versaoCatalogo: CATALOGO_VERSAO, versaoXsd: ENUMS_VERSAO }));
}
