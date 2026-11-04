import bcrypt from "bcryptjs";
import { db, schema } from "./index.js";
import { eq } from "drizzle-orm";

const { usuarios, empresas, usuarioEmpresas, servicosCatalogo } = schema;

async function upsertUsuario(nome: string, email: string, senha: string, papel: "ADMIN" | "OPERADOR" | "CLIENTE") {
  const existente = await db.query.usuarios.findFirst({ where: eq(usuarios.email, email) });
  if (existente) return existente;
  const [u] = await db.insert(usuarios).values({ nome, email, senhaHash: await bcrypt.hash(senha, 10), papel }).returning();
  return u;
}

const admin = await upsertUsuario("Administrador SmartSolve", "admin@smartsolve.com.br", "admin12345", "ADMIN");
let empresa = await db.query.empresas.findFirst({ where: eq(empresas.cnpj, "12345678000195") });
if (!empresa) {
  [empresa] = await db.insert(empresas).values({ cnpj: "12345678000195", razaoSocial: "Cliente Exemplo Ltda", cMun: "3550308", opSimpNac: 3, regApTribSN: 1, aliquotaSN: 6, tpAmb: 2 }).returning();
  await db.insert(servicosCatalogo).values({ empresaId: empresa.id, apelido: "Consultoria", cTribNac: "170101", cNBS: "114019000", descricaoPadrao: "Serviços de consultoria empresarial", padrao: true });
}
const cliente = await upsertUsuario("Financeiro Cliente Exemplo", "financeiro@clienteexemplo.com.br", "cliente12345", "CLIENTE");
await db.insert(usuarioEmpresas).values({ usuarioId: cliente.id, empresaId: empresa.id, podeEmitir: true, podeCancelar: false }).onConflictDoNothing();
console.log("Seed ok:", { admin: admin.email, cliente: cliente.email, empresa: empresa.cnpj });
