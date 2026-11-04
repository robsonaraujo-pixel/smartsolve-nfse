import { el, esc } from "../dps/xml.js";
import { NFSE_NS, LEIAUTE_VERSAO } from "../dps/buildDps.js";

/** Códigos de evento do Sistema Nacional (AnexoII-LeiautesRN_Eventos). */
export const EVENTOS = {
  CANCELAMENTO: "e101101",
  CANCELAMENTO_SUBSTITUICAO: "e105102", // gerado pela Sefin ao substituir
  CONFIRMACAO_TOMADOR: "e202201",
  REJEICAO_TOMADOR: "e204201",
} as const;

export interface PedidoCancelamento {
  tpAmb: 1 | 2;
  verAplic: string;
  chaveAcesso: string;
  /** CNPJ ou CPF do autor (deve ser o emitente) */
  cnpjAutor?: string;
  cpfAutor?: string;
  /** 1 erro de emissão; 2 serviço não prestado; 9 outros (ver tabela do Anexo II) */
  cMotivo: 1 | 2 | 9;
  xMotivo?: string;
  nPedRegEvento?: number; // sequencial do pedido por nota; default 1
  dhEvento?: string;
}

/**
 * Monta o XML do Pedido de Registro de Evento de cancelamento (e101101), ainda sem assinatura.
 * Id = "PRE" + chaveAcesso + código do evento + nPedRegEvento (3 dígitos).
 */
export function buildPedidoCancelamento(p: PedidoCancelamento): { id: string; xml: string } {
  const seq = String(p.nPedRegEvento ?? 1).padStart(3, "0");
  const id = `PRE${p.chaveAcesso}101101${seq}`;
  const autor = p.cnpjAutor ? el("CNPJAutor", p.cnpjAutor) : el("CPFAutor", p.cpfAutor);
  const inf =
    el("tpAmb", p.tpAmb) +
    el("verAplic", p.verAplic) +
    el("dhEvento", p.dhEvento ?? new Date().toISOString().replace(/\.\d{3}Z$/, "-00:00")) +
    autor +
    el("chNFSe", p.chaveAcesso) +
    el("nPedRegEvento", p.nPedRegEvento ?? 1) +
    `<e101101>` +
    el("xDesc", "Cancelamento de NFS-e") +
    el("cMotivo", p.cMotivo) +
    el("xMotivo", p.xMotivo) +
    `</e101101>`;
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="${NFSE_NS}" versao="${LEIAUTE_VERSAO}">` +
    `<infPedReg Id="${esc(id)}">${inf}</infPedReg>` +
    `</pedRegEvento>`;
  return { id, xml };
}
