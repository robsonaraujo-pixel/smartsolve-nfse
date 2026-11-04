/**
 * Consulta pública de CNPJ. Fonte principal: BrasilAPI (espelho dos dados abertos da RFB, sem chave).
 * Fallback: ReceitaWS (também público, com limite de requisições por minuto).
 */
export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao?: string;
  cMun?: string; // IBGE 7
  municipio?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  email?: string;
  fone?: string;
  optanteSimples?: boolean;
  optanteMei?: boolean;
  cnaePrincipal?: { codigo: string; descricao: string };
  cnaesSecundarios?: { codigo: string; descricao: string }[];
  fonte: "brasilapi" | "receitaws";
}

const limpar = (s?: string | null) => (s ?? "").trim() || undefined;

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "SmartSolveNFSe/0.1" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function consultarCnpj(cnpjEntrada: string): Promise<DadosCnpj> {
  const cnpj = cnpjEntrada.replace(/\D/g, "");
  if (cnpj.length !== 14) throw Object.assign(new Error("CNPJ deve ter 14 dígitos"), { statusCode: 422 });

  try {
    const d = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    return {
      cnpj,
      razaoSocial: d.razao_social,
      nomeFantasia: limpar(d.nome_fantasia),
      situacao: limpar(d.descricao_situacao_cadastral),
      cMun: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : undefined,
      municipio: limpar(d.municipio),
      uf: limpar(d.uf),
      cep: limpar(d.cep)?.replace(/\D/g, ""),
      logradouro: limpar([d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ")),
      numero: limpar(d.numero),
      complemento: limpar(d.complemento),
      bairro: limpar(d.bairro),
      email: limpar(d.email)?.toLowerCase(),
      fone: limpar(d.ddd_telefone_1)?.replace(/\D/g, ""),
      optanteSimples: d.opcao_pelo_simples === true,
      optanteMei: d.opcao_pelo_mei === true,
      cnaePrincipal: d.cnae_fiscal ? { codigo: String(d.cnae_fiscal), descricao: d.cnae_fiscal_descricao } : undefined,
      cnaesSecundarios: Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios.map((c: any) => ({ codigo: String(c.codigo), descricao: c.descricao })) : undefined,
      fonte: "brasilapi",
    };
  } catch (e1) {
    try {
      const d = await fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
      if (d.status === "ERROR") throw new Error(d.message);
      return {
        cnpj,
        razaoSocial: d.nome,
        nomeFantasia: limpar(d.fantasia),
        situacao: limpar(d.situacao),
        cMun: undefined, // ReceitaWS não devolve IBGE
        municipio: limpar(d.municipio),
        uf: limpar(d.uf),
        cep: limpar(d.cep)?.replace(/\D/g, ""),
        logradouro: limpar(d.logradouro),
        numero: limpar(d.numero),
        complemento: limpar(d.complemento),
        bairro: limpar(d.bairro),
        email: limpar(d.email)?.toLowerCase(),
        fone: limpar(d.telefone)?.replace(/\D/g, "").slice(0, 11),
        optanteSimples: d.simples?.optante === true,
        optanteMei: d.simei?.optante === true,
        cnaePrincipal: d.atividade_principal?.[0] ? { codigo: d.atividade_principal[0].code.replace(/\D/g, ""), descricao: d.atividade_principal[0].text } : undefined,
        fonte: "receitaws",
      };
    } catch (e2) {
      throw Object.assign(new Error(`Não foi possível consultar o CNPJ agora (${(e1 as Error).message}; ${(e2 as Error).message}). Preencha manualmente.`), { statusCode: 502 });
    }
  }
}
