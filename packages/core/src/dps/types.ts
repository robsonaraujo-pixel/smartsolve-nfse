/**
 * Tipos de entrada do motor fiscal.
 * Leiaute de referência: ANEXO_I-SEFIN_ADN-DPS_NFSe-SNNFSe v1.00 (10/12/2025) + XSD v1.01.
 * Escopo desta versão: emissão por prestador, Simples Nacional, sem grupo IBSCBS.
 * O grupo IBSCBS (NT 004/007/009) entra como extensão opcional em `ibscbs`.
 */

export type Ambiente = 1 | 2; // 1 produção, 2 produção restrita

/** regApTribSN: 1 federal+municipal pelo SN; 2 federal pelo SN e ISS pela NFS-e; 3 tudo pela NFS-e */
export type RegApTribSN = 1 | 2 | 3;

/** opSimpNac: 1 não optante; 2 MEI; 3 ME/EPP */
export type OpSimpNac = 1 | 2 | 3;

export interface EnderecoNacional {
  cMun: string; // IBGE 7
  CEP: string; // 8 dígitos
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

export interface EnderecoExterior {
  cPais: string; // ISO 3166-1 alpha-2
  cEndPost: string;
  xCidade: string;
  xEstProvReg: string;
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

export interface Prestador {
  cnpj?: string; // 14 dígitos (ou alfanumérico quando o CNPJ alfanumérico entrar)
  cpf?: string;
  im?: string; // inscrição municipal
  xNome?: string;
  fone?: string;
  email?: string;
  regTrib: {
    opSimpNac: OpSimpNac;
    regApTribSN?: RegApTribSN; // obrigatório quando opSimpNac = 3
    regEspTrib: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 nenhum, 1 ato cooperado, 2 estimativa, 3 microempresa municipal, 4 notário, 5 profissional autônomo, 6 sociedade de profissionais
  };
}

export interface Tomador {
  cnpj?: string;
  cpf?: string;
  nif?: string;
  cNaoNIF?: 0 | 1 | 2; // 0 não informado, 1 dispensado, 2 não exigência
  xNome: string;
  im?: string;
  fone?: string;
  email?: string;
  end?: { endNac?: EnderecoNacional; endExt?: EnderecoExterior };
}

export interface Servico {
  /** Local da prestação: município IBGE (Brasil) ou país */
  cLocPrestacao?: string;
  cPaisPrestacao?: string;
  /** Código de tributação nacional, 6 dígitos (item LC 116 + desdobro), ex.: "010701" */
  cTribNac: string;
  /** Código de tributação municipal, quando o município exigir */
  cTribMun?: string;
  /** Código NBS, 9 dígitos. Obrigatório se IBSCBS for informado. */
  cNBS?: string;
  /** Até 2000 caracteres */
  xDescServ: string;
  /** Código indicador de operação (Anexo VII). Opcional em 2026 sem IBSCBS. */
  cIndOp?: string;
  infoCompl?: { idDocTec?: string; docRef?: string; xInfComp?: string };
}

export interface TribMunicipal {
  /** 1 tributável, 2 imunidade, 3 exportação, 4 não incidência */
  tribISSQN: 1 | 2 | 3 | 4;
  /** quando tribISSQN=3 */
  cPaisResult?: string;
  tpImunidade?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Benefício municipal */
  BM?: { tpBM: 1 | 2 | 3; nBM: string; vRedBCBM?: number; pRedBCBM?: number };
  exigSusp?: { tpSusp: 1 | 2; nProcesso: string };
  /** 1 não retido; 2 retido pelo tomador; 3 retido pelo intermediário */
  tpRetISSQN: 1 | 2 | 3;
  /** Alíquota em %, só quando o ISS é apurado pela NFS-e (regApTribSN 2/3 ou não optante) */
  pAliq?: number;
}

export interface TribFederal {
  piscofins?: {
    /** CST PIS/COFINS, 2 dígitos ("00" nenhum) */
    CST: string;
    vBCPisCofins?: number;
    pAliqPis?: number;
    pAliqCofins?: number;
    vPis?: number;
    vCofins?: number;
    /** NT 007: 1 retido; 2 não retido */
    tpRetPisCofins?: 1 | 2;
  };
  vRetCP?: number;
  vRetIRRF?: number;
  vRetCSLL?: number;
}

export interface TotTrib {
  /** Opção A: valores monetários */
  vTotTrib?: { vTotTribFed: number; vTotTribEst: number; vTotTribMun: number };
  /** Opção B: percentuais */
  pTotTrib?: { pTotTribFed: number; pTotTribEst: number; pTotTribMun: number };
  /** Opção C: indicador de que o total não é informado (0) */
  indTotTrib?: 0;
  /** Opção D: alíquota do Simples Nacional em % */
  pTotTribSN?: number;
}

export interface Valores {
  vServ: number;
  vReceb?: number; // valor recebido pelo intermediário
  vDescIncond?: number;
  vDescCond?: number;
  /** vDedRed na v1.01; vira vAjusteBC na NT 009 */
  vDedRed?: { pDR?: number; vDR?: number };
  trib: { tribMun: TribMunicipal; tribFed?: TribFederal; totTrib: TotTrib };
}

export interface Substituicao {
  /** chave de acesso de 50 dígitos da NFS-e substituída */
  chSubstda: string;
  /** 1 desenquadramento Simples; 2 enquadramento; 3 erro de preenchimento; 4 outros */
  cMotivo: 1 | 2 | 3 | 4;
  xMotivo?: string;
}

export interface DpsInput {
  tpAmb: Ambiente;
  /** Data/hora de emissão; default agora (ISO com offset) */
  dhEmi?: string;
  verAplic: string;
  serie: string; // até 5
  nDPS: number; // até 15 dígitos
  dCompet: string; // YYYY-MM-DD
  /** 1 prestador, 2 tomador, 3 intermediário */
  tpEmit: 1 | 2 | 3;
  /** Município emissor IBGE 7 */
  cLocEmi: string;
  subst?: Substituicao;
  prest: Prestador;
  toma?: Tomador;
  interm?: Tomador;
  serv: Servico;
  valores: Valores;
  /** Grupo IBSCBS (NT 004+): XML pronto, inserido tal como veio. Fica para a etapa seguinte. */
  ibscbsXml?: string;
}

export interface SefinErro {
  codigo: string;
  descricao: string;
  complemento?: string;
}

export interface EmissaoResultado {
  ok: boolean;
  httpStatus: number;
  idDps: string;
  chaveAcesso?: string;
  nfseXml?: string;
  erros?: SefinErro[];
  rawResponse: unknown;
}
