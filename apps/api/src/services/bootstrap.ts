import bcrypt from "bcryptjs";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "./db.js";
import { buildDps, tribNacValido, nbsValido, type DpsInput } from "@smartsolve/nfse-core";

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

  let tomadorExistente = await db.query.tomadores.findFirst({
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

  // Serviço de palestra: códigos conferidos no catálogo nacional embarcado do projeto.
  const cTribNac = "172401";
  const cNBS = "122051400";
  if (!tribNacValido(cTribNac) || !nbsValido(cNBS)) {
    throw new Error("Código CTN/NBS do cenário de homologação não consta no catálogo nacional embarcado.");
  }
  let servico = await db.query.servicosCatalogo.findFirst({
    where: and(eq(schema.servicosCatalogo.empresaId, yellow.id), eq(schema.servicosCatalogo.apelido, "Palestras e conferências")),
  });
  if (!servico) {
    const [createdService] = await db.insert(schema.servicosCatalogo).values({
      empresaId: yellow.id,
      apelido: "Palestras e conferências",
      cTribNac,
      cNBS,
      descricaoPadrao: "Capacitação e treinamento profissional",
      cstPisCofins: "00",
      padrao: true,
    }).returning();
    servico = createdService;
  }

  // Criar um único rascunho demonstrativo; não assina e não transmite.
  const existingDraft = await db.query.dps.findFirst({
    where: and(eq(schema.dps.empresaId, yellow.id), eq(schema.dps.dCompet, "2026-11-04")),
  });
  if (!existingDraft) {
    const nDps = yellow.proximoNDps;
    const input: DpsInput = {
      tpAmb: 2,
      verAplic: "SmartEmitte-homologacao",
      serie: yellow.serieDps,
      nDPS: nDps,
      dCompet: "2026-11-04",
      tpEmit: 1,
      cLocEmi: "3550308",
      prest: {
        cnpj: yellowCnpj,
        im: "14448890",
        regTrib: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
      },
      toma: {
        cnpj: smartCnpj,
        xNome: "SMARTSOLVE AUDITORIA E CONSULTORIA CONTABIL LTDA.",
        email: "contato@smartsolve.com.br",
        fone: "1140841022",
        end: { endNac: { cMun: "3550308", CEP: "04757025", xLgr: "AV DAS NACOES UNIDAS", nro: "18801", xCpl: "CONJ 407 ANDAR 4", xBairro: "JARDIM DOM BOSCO" } },
      },
      serv: { cLocPrestacao: "3550308", cTribNac, cNBS, xDescServ: "Capacitação e treinamento profissional" },
      valores: { vServ: 1, trib: { tribMun: { tribISSQN: 1, tpRetISSQN: 1 }, tribFed: { piscofins: { CST: "00" } }, totTrib: { indTotTrib: 0 } } },
    };
    const built = buildDps(input);
    await db.insert(schema.dps).values({
      empresaId: yellow.id,
      serie: yellow.serieDps,
      nDps,
      idDps: built.idDps,
      dCompet: "2026-11-04",
      status: "RASCUNHO",
      entradaJson: JSON.stringify(input),
      criadoPorId: null,
    });
    await db.update(schema.empresas).set({ proximoNDps: nDps + 1 }).where(eq(schema.empresas.id, yellow.id));
    await db.insert(schema.auditoria).values({
      empresaId: yellow.id,
      acao: "DPS_RASCUNHO_HOMOLOGACAO_CRIADA",
      detalhe: "DPS demonstrativa R$ 1,00; não assinada e não transmitida. Classificação CTN/NBS consultada no catálogo nacional embarcado.",
    });
  }

  return { empresaId: yellow.id, prestadorCnpj: yellowCnpj, tomadorCnpj: smartCnpj, servicoId: servico.id };
}
