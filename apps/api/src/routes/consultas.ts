import type { FastifyInstance } from "fastify";
import { consultarCnpj } from "../services/cnpj.js";

/** Consultas públicas auxiliares (CNPJ, CEP). Exigem usuário autenticado para evitar abuso da URL. */
export default async function (app: FastifyInstance) {
  app.addHook("preHandler", app.autenticar);
  app.get("/consultas/cnpj/:cnpj", async (req) => consultarCnpj((req.params as { cnpj: string }).cnpj));
  app.get("/consultas/cep/:cep", async (req, reply) => {
    const cep = (req.params as { cep: string }).cep.replace(/\D/g, "");
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!r.ok) return reply.code(404).send({ erro: "CEP não encontrado" });
    const d: any = await r.json();
    return { cep, uf: d.state, municipio: d.city, bairro: d.neighborhood, logradouro: d.street };
  });
}
