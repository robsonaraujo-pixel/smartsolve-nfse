import bcrypt from "bcryptjs";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "./db.js";

/**
 * Bootstrap admin. ADMIN_RESET_PASSWORD is an explicit, temporary recovery
 * switch for an existing admin. Remove the Railway variable immediately after
 * the successful deployment; never log the supplied password.
 */
export async function garantirAdminInicial() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const resetPassword = process.env.ADMIN_RESET_PASSWORD;
  if (email && resetPassword) {
    const admin = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.email, email) });
    if (admin && admin.papel === "ADMIN") {
      await db.update(schema.usuarios)
        .set({ senhaHash: await bcrypt.hash(resetPassword, 12), ativo: true })
        .where(eq(schema.usuarios.id, admin.id));
      console.log("Senha do administrador redefinida por procedimento temporário.");
    }
  }

  const [{ n }] = await db.select({ n: count() }).from(schema.usuarios);
  if (n > 0) return;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) {
    console.warn("Nenhum usuário cadastrado e ADMIN_EMAIL/ADMIN_SENHA não definidos — ninguém conseguirá entrar.");
    return;
  }
  await db.insert(schema.usuarios).values({
    nome: "Administrador",
    email,
    senhaHash: await bcrypt.hash(senha, 12),
    papel: "ADMIN",
  });
  console.log(`Admin inicial criado: ${email}`);
}

/**
 * Seed idempotente do cenário de homologação YellowX → SmartSolve.
 * Não configura validade da procuração nem habilita emissão/transmissão.
 * Dados de endereço da SmartSolve foram transcritos do comprovante RFB fornecido.
 */
export async function garantirCadastrosHomologacao() {
  const yellowCnpj = "56153537000146";
  const smartCnpj = "22489717000181";

  let yellow = await db.query.empresas.findFirst({
    where: eq(schema.empresas.cnpj, yellowCnpj),
  });

  if (!yellow) {
    const [created] = await db.insert(schema.empresas).values({
      cnpj: yellowCnpj,
      razaoSocial: "YELLOWX PUBLICIDADE E TREINAMENTOS LTDA",
      im: "14448890",
      cMun: "3550308",
      opSimpNac: 3,
      regEspTrib: 0,
      informarIbsCbs: false,
      modoAcesso: "CERT_ESCRITORIO",
      tpAmb: 2,
      serieDps: "1",
      proximoNDps: 1,
      ativa: true,
    }).returning();
    yellow = created;
  }

  const tomadorExistente = await db.query.tomadores.findFirst({
    where: and(
      eq(schema.tomadores.empresaId, yellow.id),
      eq(schema.tomadores.cnpj, smartCnpj),
    ),
  });

  if (!tomadorExistente) {
    await db.insert(schema.tomadores).values({
      empresaId: yellow.id,
      cnpj: smartCnpj,
      nome: "SMARTSOLVE AUDITORIA E CONSULTORIA CONTABIL LTDA.",
      email: "contato@smartsolve.com.br",
      fone: "1140841022",
      cMun: "3550308",
      cep: "04757025",
      logradouro: "AV DAS NACOES UNIDAS",
      numero: "18801",
      complemento: "CONJ 407 ANDAR 4",
      bairro: "JARDIM DOM BOSCO",
      cPais: "BR",
    });
  }

  await db.insert(schema.auditoria).values({
    empresaId: yellow.id,
    acao: "SEED_HOMOLOGACAO_YELLOWX_SMARTSOLVE",
    detalhe: "Cadastro idempotente de prestador e tomador para homologação; procuração não verificada; transmissão bloqueada.",
  });

  return { empresaId: yellow.id, prestadorCnpj: yellowCnpj, tomadorCnpj: smartCnpj };
}
