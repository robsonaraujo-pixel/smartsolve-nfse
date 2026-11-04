import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import auth from "./plugins/auth.js";
import rotasAuth from "./routes/auth.js";
import rotasUsuarios from "./routes/usuarios.js";
import rotasEmpresas from "./routes/empresas.js";
import rotasCadastros from "./routes/cadastros.js";
import rotasEmissao from "./routes/emissao.js";
import rotasDocumentos from "./routes/documentos.js";
import { migrarBanco } from "./db/index.js";
import { garantirAdminInicial } from "./services/bootstrap.js";

export async function construirApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true });
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(",") ?? true });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
  await app.register(auth);

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof ZodError) return reply.code(422).send({ erro: "Dados inválidos", detalhes: err.flatten() });
    const status = err.statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ erro: err.message });
  });

  // API sob /api (o front chama /api/...); mantém também a raiz para uso direto.
  const rotas = async (i: FastifyInstance) => {
    i.get("/health", async () => ({ ok: true, versao: "0.1.0" }));
    await i.register(rotasAuth);
    await i.register(rotasUsuarios);
    await i.register(rotasEmpresas);
    await i.register(rotasCadastros);
    await i.register(rotasEmissao);
    await i.register(rotasDocumentos);
  };
  await app.register(rotas, { prefix: "/api" });

  // Front compilado (apps/web/dist), quando existir: um único serviço na web.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = [path.resolve(here, "../../../web/dist"), path.resolve(here, "../../web/dist")].find((p) => existsSync(p));
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ erro: "Rota não encontrada" });
      return reply.sendFile("index.html");
    });
    app.log.info(`Servindo front de ${webDist}`);
  }
  return app;
}

const ehMain = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1]);
if (ehMain) {
  await migrarBanco();
  await garantirAdminInicial();
  const app = await construirApp();
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
}
