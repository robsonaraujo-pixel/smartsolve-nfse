import { sqliteTable, text, integer, blob, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createId } from "./id.js";

// Banco: SQLite/libsql em dev. Para Postgres, troque este arquivo por pg-core (mesmos nomes) e o driver em db.ts.

const id = () => text("id").primaryKey().$defaultFn(createId);
const agora = () => integer("em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

// ---------- Acesso ----------
export const usuarios = sqliteTable("usuarios", {
  id: id(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  /** ADMIN | OPERADOR | CLIENTE */
  papel: text("papel", { enum: ["ADMIN", "OPERADOR", "CLIENTE"] }).notNull().default("CLIENTE"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Vínculo usuário × empresa. CLIENTE enxerga apenas as empresas aqui listadas. */
export const usuarioEmpresas = sqliteTable(
  "usuario_empresas",
  {
    usuarioId: text("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
    empresaId: text("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
    podeEmitir: integer("pode_emitir", { mode: "boolean" }).notNull().default(true),
    podeCancelar: integer("pode_cancelar", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.empresaId] })],
);

// ---------- Empresa (prestador) ----------
export const empresas = sqliteTable("empresas", {
  id: id(),
  cnpj: text("cnpj").notNull().unique(), // 14 posições; aceita alfanumérico (NT 009)
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  im: text("im"),
  cMun: text("c_mun").notNull(), // IBGE 7 (cLocEmi)
  email: text("email"),
  fone: text("fone"),
  opSimpNac: integer("op_simp_nac").notNull().default(3), // 1 não optante, 2 MEI, 3 ME/EPP
  regApTribSN: integer("reg_ap_trib_sn").default(1), // 1,2,3
  regEspTrib: integer("reg_esp_trib").notNull().default(0),
  /** Valor aproximado dos tributos (Lei 12.741): INFORMAR (a cada emissão) | IBPT (13,45%) | SN_NOMINAL (alíquota nominal do Simples, %) */
  modoTotTrib: text("modo_tot_trib", { enum: ["INFORMAR", "IBPT", "SN_NOMINAL"] }).notNull().default("IBPT"),
  /** Percentual usado quando modoTotTrib = SN_NOMINAL */
  pTribSN: real("p_trib_sn"),
  informarIbsCbs: integer("informar_ibs_cbs", { mode: "boolean" }).notNull().default(false),
  /** Forma de acesso ao portal nacional: PORTAL_SENHA (usuário/senha do portal, só emissor web) | CERT_PROPRIO (A1 da empresa) | CERT_ESCRITORIO (A1 do escritório por procuração) */
  modoAcesso: text("modo_acesso", { enum: ["PORTAL_SENHA", "CERT_PROPRIO", "CERT_ESCRITORIO"] }).notNull().default("CERT_PROPRIO"),
  portalLogin: text("portal_login"),
  portalSenhaCifrada: blob("portal_senha_cifrada", { mode: "buffer" }), // iv(12)+cifra
  procuracaoValidaAte: integer("procuracao_valida_ate", { mode: "timestamp_ms" }),
  tpAmb: integer("tp_amb").notNull().default(2), // 2 produção restrita, 1 produção
  serieDps: text("serie_dps").notNull().default("1"),
  proximoNDps: integer("proximo_n_dps").notNull().default(1),
  ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const certificados = sqliteTable("certificados", {
  id: id(),
  empresaId: text("empresa_id").notNull().unique().references(() => empresas.id, { onDelete: "cascade" }),
  pfxCifrado: blob("pfx_cifrado", { mode: "buffer" }).notNull(), // AES-256-GCM
  senhaCifrada: blob("senha_cifrada", { mode: "buffer" }).notNull(), // iv(12)+cifra
  iv: blob("iv", { mode: "buffer" }).notNull(),
  subject: text("subject").notNull(),
  validoAte: integer("valido_ate", { mode: "timestamp_ms" }).notNull(),
  criadoEm: integer("criado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Certificado A1 do escritório contábil (usado nas empresas com modoAcesso = CERT_ESCRITORIO) */
export const certificadoEscritorio = sqliteTable("certificado_escritorio", {
  id: text("id").primaryKey().default("escritorio"),
  pfxCifrado: blob("pfx_cifrado", { mode: "buffer" }).notNull(),
  senhaCifrada: blob("senha_cifrada", { mode: "buffer" }).notNull(),
  iv: blob("iv", { mode: "buffer" }).notNull(),
  subject: text("subject").notNull(),
  cnpj: text("cnpj"),
  validoAte: integer("valido_ate", { mode: "timestamp_ms" }).notNull(),
  criadoEm: integer("criado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const tomadores = sqliteTable(
  "tomadores",
  {
    id: id(),
    empresaId: text("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
    cnpj: text("cnpj"),
    cpf: text("cpf"),
    nif: text("nif"),
    nome: text("nome").notNull(),
    im: text("im"),
    email: text("email"),
    fone: text("fone"),
    cMun: text("c_mun"),
    cep: text("cep"),
    logradouro: text("logradouro"),
    numero: text("numero"),
    complemento: text("complemento"),
    bairro: text("bairro"),
    cPais: text("c_pais"),
  },
  (t) => [index("tomadores_empresa_cnpj").on(t.empresaId, t.cnpj), index("tomadores_empresa_cpf").on(t.empresaId, t.cpf)],
);

/** Serviços que a empresa presta, com os códigos resolvidos (base CNAE × LC116 × CTN × NBS) */
export const servicosCatalogo = sqliteTable("servicos_catalogo", {
  id: id(),
  empresaId: text("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  apelido: text("apelido").notNull(),
  cTribNac: text("c_trib_nac").notNull(),
  cTribMun: text("c_trib_mun"),
  cNBS: text("c_nbs"),
  cIndOp: text("c_ind_op"),
  descricaoPadrao: text("descricao_padrao").notNull(),
  cstPisCofins: text("cst_pis_cofins").notNull().default("00"),
  tpRetPisCofins: integer("tp_ret_pis_cofins"),
  padrao: integer("padrao", { mode: "boolean" }).notNull().default(false),
});

// ---------- Emissão ----------
export const STATUS_DPS = ["RASCUNHO", "ENVIANDO", "AUTORIZADA", "REJEITADA", "CANCELADA", "SUBSTITUIDA", "ERRO_COMUNICACAO"] as const;
export type StatusDps = (typeof STATUS_DPS)[number];

export const dps = sqliteTable(
  "dps",
  {
    id: id(),
    empresaId: text("empresa_id").notNull().references(() => empresas.id),
    serie: text("serie").notNull(),
    nDps: integer("n_dps").notNull(),
    idDps: text("id_dps").notNull().unique(), // 42 posições
    status: text("status", { enum: STATUS_DPS }).notNull().default("RASCUNHO"),
    dCompet: text("d_compet").notNull(),
    entradaJson: text("entrada_json").notNull(),
    xmlAssinado: text("xml_assinado"),
    chaveAcesso: text("chave_acesso").unique(),
    erros: text("erros"), // JSON
    documentoId: text("documento_id"),
    criadoPorId: text("criado_por_id"),
    criadoEm: integer("criado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    atualizadoEm: integer("atualizado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("dps_empresa_serie_num").on(t.empresaId, t.serie, t.nDps)],
);

export const tentativas = sqliteTable("tentativas", {
  id: id(),
  dpsId: text("dps_id").notNull().references(() => dps.id, { onDelete: "cascade" }),
  httpStatus: integer("http_status"),
  resposta: text("resposta"),
  erro: text("erro"),
  em: agora(),
});

// ---------- Banco de XML ----------
export const documentos = sqliteTable(
  "documentos",
  {
    id: id(),
    empresaId: text("empresa_id").notNull().references(() => empresas.id),
    tipo: text("tipo", { enum: ["NFSE", "EVENTO"] }).notNull(),
    /** EMITIDA (por aqui) | RECEBIDA (como tomador, via ADN) | SINCRONIZADA (emitida fora, via ADN) */
    origem: text("origem", { enum: ["EMITIDA", "RECEBIDA", "SINCRONIZADA"] }).notNull(),
    chaveAcesso: text("chave_acesso").notNull(),
    tipoEvento: text("tipo_evento").notNull().default(""), // "" para NFS-e
    nsu: integer("nsu"),
    nNfse: text("n_nfse"),
    dCompet: text("d_compet"),
    dhProc: integer("dh_proc", { mode: "timestamp_ms" }),
    emitenteDoc: text("emitente_doc"),
    emitenteNome: text("emitente_nome"),
    tomadorDoc: text("tomador_doc"),
    tomadorNome: text("tomador_nome"),
    cTribNac: text("c_trib_nac"),
    vServ: real("v_serv"),
    vLiq: real("v_liq"),
    vIssqn: real("v_issqn"),
    cancelada: integer("cancelada", { mode: "boolean" }).notNull().default(false),
    xml: text("xml").notNull(),
    pdfPath: text("pdf_path"),
    importadoEm: integer("importado_em", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("documentos_chave_unica").on(t.empresaId, t.chaveAcesso, t.tipo, t.tipoEvento),
    index("documentos_empresa_compet").on(t.empresaId, t.dCompet),
    index("documentos_empresa_tomador").on(t.empresaId, t.tomadorDoc),
  ],
);

/** Posição da distribuição de DF-e por empresa (último NSU lido) */
export const syncDfe = sqliteTable("sync_dfe", {
  empresaId: text("empresa_id").primaryKey().references(() => empresas.id, { onDelete: "cascade" }),
  ultimoNsu: integer("ultimo_nsu").notNull().default(0),
  ultimaExec: integer("ultima_exec", { mode: "timestamp_ms" }),
  ultimoErro: text("ultimo_erro"),
});

export const auditoria = sqliteTable("auditoria", {
  id: id(),
  usuarioId: text("usuario_id"),
  empresaId: text("empresa_id"),
  acao: text("acao").notNull(),
  detalhe: text("detalhe"),
  em: agora(),
});

export const _sql = sql; // evita import não usado em alguns bundlers
