import {
  buildDps,
  assinarXml,
  SefinNacional,
  extrairResumoNfse,
  buildPedidoCancelamento,
  type DpsInput,
  type Ambiente,
} from "@smartsolve/nfse-core";
import { and, eq, sql } from "drizzle-orm";
import { db, schema, erro } from "./db.js";
import { certificadoDaEmpresa } from "./certificado.js";

const { empresas, tomadores, dps, tentativas, documentos } = schema;
export const VER_APLIC = "SmartSolveNFSe/0.1.0";

export interface PedidoEmissao {
  empresaId: string;
  usuarioId: string;
  dCompet: string;
  tomadorId?: string;
  tomador?: DpsInput["toma"];
  servico: { cTribNac: string; cTribMun?: string; cNBS?: string; cIndOp?: string; xDescServ: string; cLocPrestacao?: string };
  vServ: number;
  vDescIncond?: number;
  vDescCond?: number;
  tribMun: { tribISSQN?: 1 | 2 | 3 | 4; tpRetISSQN?: 1 | 2 | 3; pAliq?: number; exigSusp?: { tpSusp: 1 | 2; nProcesso: string } };
  tribFed?: { cstPisCofins?: string; tpRetPisCofins?: 1 | 2; vRetCP?: number; vRetIRRF?: number; vRetCSLL?: number };
  /** Valor aproximado dos tributos informado na emissão (modo INFORMAR): percentual total ou valores */
  totTrib?: { pTotTrib?: number; vTotTrib?: { fed: number; est: number; mun: number } };
  /** XML do grupo IBSCBS, quando a empresa estiver marcada para informar (2027 ou regime regular) */
  ibscbsXml?: string;
  substituir?: { chaveAcesso: string; cMotivo: 1 | 2 | 3 | 4; xMotivo?: string };
}

export const IBPT_PERCENTUAL_PADRAO = 13.45;

/**
 * Lei 12.741/2012 — valor aproximado dos tributos. Três políticas por empresa:
 *  INFORMAR   → o usuário informa a cada emissão (percentual total ou valores fed/est/mun); se não informar, indTotTrib=0
 *  IBPT       → percentual único 13,45% (tabela IBPT para serviços, aproximação adotada pelo escritório)
 *  SN_NOMINAL → alíquota nominal do Simples cadastrada na empresa (pTotTribSN)
 */
export function resolverTotTrib(modo: "INFORMAR" | "IBPT" | "SN_NOMINAL", pTribSN: number | null, informado?: PedidoEmissao["totTrib"]): DpsInput["valores"]["trib"]["totTrib"] {
  if (modo === "SN_NOMINAL") {
    if (pTribSN == null) throw erro(422, "Empresa configurada para alíquota nominal do Simples, mas o percentual não foi cadastrado");
    return { pTotTribSN: pTribSN };
  }
  if (modo === "IBPT") return { pTotTrib: { pTotTribFed: IBPT_PERCENTUAL_PADRAO, pTotTribEst: 0, pTotTribMun: 0 } };
  if (informado?.vTotTrib) return { vTotTrib: { vTotTribFed: informado.vTotTrib.fed, vTotTribEst: informado.vTotTrib.est, vTotTribMun: informado.vTotTrib.mun } };
  if (informado?.pTotTrib != null) return { pTotTrib: { pTotTribFed: informado.pTotTrib, pTotTribEst: 0, pTotTribMun: 0 } };
  return { indTotTrib: 0 };
}

/** Monta o DpsInput a partir da empresa + pedido, reserva o número e grava o rascunho. */
export async function prepararDps(p: PedidoEmissao) {
  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.id, p.empresaId) });
  if (!empresa) throw erro(404, "Empresa não encontrada");
  if (!empresa.ativa) throw erro(422, "Empresa inativa");

  let toma = p.tomador;
  if (!toma && p.tomadorId) {
    const t = await db.query.tomadores.findFirst({ where: and(eq(tomadores.id, p.tomadorId), eq(tomadores.empresaId, p.empresaId)) });
    if (!t) throw erro(404, "Tomador não encontrado");
    toma = {
      cnpj: t.cnpj ?? undefined,
      cpf: t.cpf ?? undefined,
      nif: t.nif ?? undefined,
      xNome: t.nome,
      im: t.im ?? undefined,
      email: t.email ?? undefined,
      fone: t.fone ?? undefined,
      end: t.cMun
        ? { endNac: { cMun: t.cMun, CEP: t.cep ?? "", xLgr: t.logradouro ?? "", nro: t.numero ?? "S/N", xCpl: t.complemento ?? undefined, xBairro: t.bairro ?? "" } }
        : undefined,
    };
  }

  // Reserva atômica do número da DPS.
  const [reservado] = await db
    .update(empresas)
    .set({ proximoNDps: sql`${empresas.proximoNDps} + 1` })
    .where(eq(empresas.id, p.empresaId))
    .returning({ proximo: empresas.proximoNDps });
  const nDps = reservado.proximo - 1;

  const input: DpsInput = {
    tpAmb: empresa.tpAmb as Ambiente,
    verAplic: VER_APLIC,
    serie: empresa.serieDps,
    nDPS: nDps,
    dCompet: p.dCompet,
    tpEmit: 1,
    cLocEmi: empresa.cMun,
    subst: p.substituir ? { chSubstda: p.substituir.chaveAcesso, cMotivo: p.substituir.cMotivo, xMotivo: p.substituir.xMotivo } : undefined,
    prest: {
      cnpj: empresa.cnpj,
      im: empresa.im ?? undefined,
      regTrib: {
        opSimpNac: empresa.opSimpNac as 1 | 2 | 3,
        regApTribSN: empresa.opSimpNac === 3 ? ((empresa.regApTribSN ?? 1) as 1 | 2 | 3) : undefined,
        regEspTrib: empresa.regEspTrib as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      },
    },
    toma,
    serv: {
      cLocPrestacao: p.servico.cLocPrestacao ?? empresa.cMun,
      cTribNac: p.servico.cTribNac,
      cTribMun: p.servico.cTribMun,
      cNBS: p.servico.cNBS,
      cIndOp: p.servico.cIndOp,
      xDescServ: p.servico.xDescServ,
    },
    valores: {
      vServ: p.vServ,
      vDescIncond: p.vDescIncond,
      vDescCond: p.vDescCond,
      trib: {
        tribMun: { tribISSQN: p.tribMun.tribISSQN ?? 1, tpRetISSQN: p.tribMun.tpRetISSQN ?? 1, pAliq: p.tribMun.pAliq, exigSusp: p.tribMun.exigSusp },
        tribFed: {
          piscofins: { CST: p.tribFed?.cstPisCofins ?? "00", tpRetPisCofins: p.tribFed?.tpRetPisCofins },
          vRetCP: p.tribFed?.vRetCP,
          vRetIRRF: p.tribFed?.vRetIRRF,
          vRetCSLL: p.tribFed?.vRetCSLL,
        },
        totTrib: resolverTotTrib(empresa.modoTotTrib, empresa.pTribSN, p.totTrib),
      },
    },
    ibscbsXml: empresa.informarIbsCbs ? p.ibscbsXml : undefined,
  };

  const built = buildDps(input);
  const [row] = await db
    .insert(dps)
    .values({ empresaId: p.empresaId, serie: empresa.serieDps, nDps, idDps: built.idDps, dCompet: p.dCompet, status: "RASCUNHO", entradaJson: JSON.stringify(input), criadoPorId: p.usuarioId })
    .returning();
  return { dps: row, input, xml: built.xml, empresa };
}

async function buscarDps(dpsId: string) {
  const row = await db.query.dps.findFirst({ where: eq(dps.id, dpsId) });
  if (!row) throw erro(404, "DPS não encontrada");
  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.id, row.empresaId) });
  if (!empresa) throw erro(404, "Empresa não encontrada");
  return { row, empresa };
}

/** Assina, transmite e persiste. Idempotente: se já houver NFS-e para o idDps, recupera em vez de duplicar. */
export async function transmitirDps(dpsId: string) {
  const { row, empresa } = await buscarDps(dpsId);
  if (row.status === "AUTORIZADA") return row;
  const cert = await certificadoDaEmpresa(row.empresaId);
  const input = JSON.parse(row.entradaJson) as DpsInput;
  const built = buildDps(input);
  const xmlAssinado = assinarXml(built.xml, cert, "infDPS");
  await db.update(dps).set({ status: "ENVIANDO", xmlAssinado, atualizadoEm: new Date() }).where(eq(dps.id, dpsId));

  const sefin = new SefinNacional(cert, empresa.tpAmb as Ambiente);

  // Idempotência: após timeout, a Sefin pode já ter gerado a nota.
  if (row.status === "ERRO_COMUNICACAO" && (await sefin.dpsJaGerada(row.idDps))) {
    const c = await sefin.consultarChavePorDps(row.idDps);
    if (c.chaveAcesso) {
      const n = await sefin.consultarNfse(c.chaveAcesso);
      if (n.nfseXml) return registrarAutorizada(dpsId, row.empresaId, c.chaveAcesso, n.nfseXml, input);
    }
  }

  try {
    const r = await sefin.emitir(xmlAssinado, row.idDps);
    await db.insert(tentativas).values({ dpsId, httpStatus: r.httpStatus, resposta: JSON.stringify(r.rawResponse).slice(0, 20000) });
    if (r.ok && r.chaveAcesso && r.nfseXml) return registrarAutorizada(dpsId, row.empresaId, r.chaveAcesso, r.nfseXml, input);
    const [u] = await db.update(dps).set({ status: "REJEITADA", erros: JSON.stringify(r.erros ?? []), atualizadoEm: new Date() }).where(eq(dps.id, dpsId)).returning();
    return u;
  } catch (e) {
    await db.insert(tentativas).values({ dpsId, erro: (e as Error).message });
    const [u] = await db
      .update(dps)
      .set({ status: "ERRO_COMUNICACAO", erros: JSON.stringify([{ codigo: "COM", descricao: (e as Error).message }]), atualizadoEm: new Date() })
      .where(eq(dps.id, dpsId))
      .returning();
    return u;
  }
}

async function registrarAutorizada(dpsId: string, empresaId: string, chaveAcesso: string, nfseXml: string, input: DpsInput) {
  const r = extrairResumoNfse(nfseXml);
  const [doc] = await db
    .insert(documentos)
    .values({
      empresaId,
      tipo: "NFSE",
      origem: "EMITIDA",
      chaveAcesso,
      tipoEvento: "",
      nNfse: r.nNFSe,
      dCompet: r.dCompet,
      dhProc: r.dhProc ? new Date(r.dhProc) : undefined,
      emitenteDoc: r.emitente?.cnpj ?? r.emitente?.cpf,
      emitenteNome: r.emitente?.xNome,
      tomadorDoc: r.tomador?.cnpj ?? r.tomador?.cpf,
      tomadorNome: r.tomador?.xNome,
      cTribNac: r.cTribNac,
      vServ: r.vServ,
      vLiq: r.vLiq,
      vIssqn: r.vISSQN,
      xml: nfseXml,
    })
    .onConflictDoUpdate({ target: [documentos.empresaId, documentos.chaveAcesso, documentos.tipo, documentos.tipoEvento], set: { xml: nfseXml } })
    .returning();

  if (input.subst?.chSubstda) {
    await db.update(dps).set({ status: "SUBSTITUIDA" }).where(eq(dps.chaveAcesso, input.subst.chSubstda));
    await db.update(documentos).set({ cancelada: true }).where(and(eq(documentos.empresaId, empresaId), eq(documentos.chaveAcesso, input.subst.chSubstda), eq(documentos.tipo, "NFSE")));
  }
  const [u] = await db.update(dps).set({ status: "AUTORIZADA", chaveAcesso, documentoId: doc.id, erros: null, atualizadoEm: new Date() }).where(eq(dps.id, dpsId)).returning();
  return u;
}

export async function cancelarNfse(dpsId: string, cMotivo: 1 | 2 | 9, xMotivo?: string) {
  const { row, empresa } = await buscarDps(dpsId);
  if (row.status !== "AUTORIZADA" || !row.chaveAcesso) throw erro(422, "Só é possível cancelar NFS-e autorizada");
  const cert = await certificadoDaEmpresa(row.empresaId);
  const ped = buildPedidoCancelamento({ tpAmb: empresa.tpAmb as Ambiente, verAplic: VER_APLIC, chaveAcesso: row.chaveAcesso, cnpjAutor: empresa.cnpj, cMotivo, xMotivo });
  const assinado = assinarXml(ped.xml, cert, "infPedReg");
  const sefin = new SefinNacional(cert, empresa.tpAmb as Ambiente);
  const r = await sefin.registrarEvento(row.chaveAcesso, assinado);
  if (!r.ok) return { ok: false as const, erros: r.erros ?? [{ codigo: `HTTP${r.status}`, descricao: "Falha no registro do evento" }] };
  if (r.eventoXml) {
    await db.insert(documentos).values({ empresaId: row.empresaId, tipo: "EVENTO", origem: "EMITIDA", chaveAcesso: row.chaveAcesso, tipoEvento: "e101101", xml: r.eventoXml }).onConflictDoNothing();
  }
  await db.update(documentos).set({ cancelada: true }).where(and(eq(documentos.empresaId, row.empresaId), eq(documentos.chaveAcesso, row.chaveAcesso), eq(documentos.tipo, "NFSE")));
  await db.update(dps).set({ status: "CANCELADA", atualizadoEm: new Date() }).where(eq(dps.id, dpsId));
  return { ok: true as const };
}
