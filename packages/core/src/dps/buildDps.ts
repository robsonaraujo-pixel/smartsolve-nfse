import { buildIdDps } from "./idDps.js";
import { dec, el, esc } from "./xml.js";
import type { DpsInput, Tomador, Valores } from "./types.js";

export const NFSE_NS = "http://www.sped.fazenda.gov.br/nfse";
export const LEIAUTE_VERSAO = "1.01";

function nowIso(): string {
  // ISO 8601 com offset local (a Sefin exige fuso); ex.: 2026-11-03T22:41:00-03:00
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${hh}:${mm}`;
}

function pessoa(p: Tomador): string {
  const ident =
    (p.cnpj && el("CNPJ", p.cnpj)) ||
    (p.cpf && el("CPF", p.cpf)) ||
    (p.nif && el("NIF", p.nif)) ||
    (p.cNaoNIF !== undefined ? el("cNaoNIF", p.cNaoNIF) : "");
  const end = p.end
    ? el("end", {
        ...(p.end.endNac
          ? {
              endNac: { cMun: p.end.endNac.cMun, CEP: p.end.endNac.CEP },
              xLgr: p.end.endNac.xLgr,
              nro: p.end.endNac.nro,
              xCpl: p.end.endNac.xCpl,
              xBairro: p.end.endNac.xBairro,
            }
          : {}),
        ...(p.end.endExt
          ? {
              endExt: {
                cPais: p.end.endExt.cPais,
                cEndPost: p.end.endExt.cEndPost,
                xCidade: p.end.endExt.xCidade,
                xEstProvReg: p.end.endExt.xEstProvReg,
              },
              xLgr: p.end.endExt.xLgr,
              nro: p.end.endExt.nro,
              xCpl: p.end.endExt.xCpl,
              xBairro: p.end.endExt.xBairro,
            }
          : {}),
      })
    : "";
  return ident + el("IM", p.im) + el("xNome", p.xNome) + end + el("fone", p.fone) + el("email", p.email);
}

function valores(v: Valores): string {
  const { tribMun, tribFed, totTrib } = v.trib;

  const tribMunXml =
    el("tribISSQN", tribMun.tribISSQN) +
    el("cPaisResult", tribMun.cPaisResult) +
    (tribMun.BM
      ? el("BM", {
          tpBM: tribMun.BM.tpBM,
          nBM: tribMun.BM.nBM,
          vRedBCBM: tribMun.BM.vRedBCBM !== undefined ? dec(tribMun.BM.vRedBCBM) : undefined,
          pRedBCBM: tribMun.BM.pRedBCBM !== undefined ? dec(tribMun.BM.pRedBCBM) : undefined,
        })
      : "") +
    (tribMun.exigSusp ? el("exigSusp", tribMun.exigSusp) : "") +
    el("tpImunidade", tribMun.tpImunidade) +
    el("tpRetISSQN", tribMun.tpRetISSQN) +
    (tribMun.pAliq !== undefined ? el("pAliq", dec(tribMun.pAliq)) : "");

  const pc = tribFed?.piscofins;
  const tribFedXml = tribFed
    ? (pc
        ? el("piscofins", {
            CST: pc.CST,
            vBCPisCofins: pc.vBCPisCofins !== undefined ? dec(pc.vBCPisCofins) : undefined,
            pAliqPis: pc.pAliqPis !== undefined ? dec(pc.pAliqPis) : undefined,
            pAliqCofins: pc.pAliqCofins !== undefined ? dec(pc.pAliqCofins) : undefined,
            vPis: pc.vPis !== undefined ? dec(pc.vPis) : undefined,
            vCofins: pc.vCofins !== undefined ? dec(pc.vCofins) : undefined,
            tpRetPisCofins: pc.tpRetPisCofins,
          })
        : "") +
      (tribFed.vRetCP !== undefined ? el("vRetCP", dec(tribFed.vRetCP)) : "") +
      (tribFed.vRetIRRF !== undefined ? el("vRetIRRF", dec(tribFed.vRetIRRF)) : "") +
      (tribFed.vRetCSLL !== undefined ? el("vRetCSLL", dec(tribFed.vRetCSLL)) : "")
    : "";

  let totTribXml = "";
  if (totTrib.vTotTrib) {
    totTribXml = el("vTotTrib", {
      vTotTribFed: dec(totTrib.vTotTrib.vTotTribFed),
      vTotTribEst: dec(totTrib.vTotTrib.vTotTribEst),
      vTotTribMun: dec(totTrib.vTotTrib.vTotTribMun),
    });
  } else if (totTrib.pTotTrib) {
    totTribXml = el("pTotTrib", {
      pTotTribFed: dec(totTrib.pTotTrib.pTotTribFed),
      pTotTribEst: dec(totTrib.pTotTrib.pTotTribEst),
      pTotTribMun: dec(totTrib.pTotTrib.pTotTribMun),
    });
  } else if (totTrib.indTotTrib !== undefined) {
    totTribXml = el("indTotTrib", 0);
  } else if (totTrib.pTotTribSN !== undefined) {
    totTribXml = el("pTotTribSN", dec(totTrib.pTotTribSN));
  }

  return (
    el("vServPrest", {
      vReceb: v.vReceb !== undefined ? dec(v.vReceb) : undefined,
      vServ: dec(v.vServ),
    }) +
    (v.vDescIncond !== undefined || v.vDescCond !== undefined
      ? el("vDescCondIncond", {
          vDescIncond: v.vDescIncond !== undefined ? dec(v.vDescIncond) : undefined,
          vDescCond: v.vDescCond !== undefined ? dec(v.vDescCond) : undefined,
        })
      : "") +
    (v.vDedRed
      ? el("vDedRed", {
          pDR: v.vDedRed.pDR !== undefined ? dec(v.vDedRed.pDR) : undefined,
          vDR: v.vDedRed.vDR !== undefined ? dec(v.vDedRed.vDR) : undefined,
        })
      : "") +
    `<trib><tribMun>${tribMunXml}</tribMun>${tribFedXml ? `<tribFed>${tribFedXml}</tribFed>` : ""}<totTrib>${totTribXml}</totTrib></trib>`
  );
}

export interface BuiltDps {
  idDps: string; // 42 posições
  xml: string; // XML da DPS sem assinatura
}

/** Monta o XML da DPS (v1.01) a partir da entrada tipada. Não assina. */
export function buildDps(input: DpsInput): BuiltDps {
  const idDps = buildIdDps({
    cLocEmi: input.cLocEmi,
    cnpj: input.prest.cnpj,
    cpf: input.prest.cpf,
    serie: input.serie,
    nDPS: input.nDPS,
  });

  if (input.prest.regTrib.opSimpNac === 3 && !input.prest.regTrib.regApTribSN) {
    throw new Error("regApTribSN é obrigatório para ME/EPP optante (opSimpNac=3)");
  }
  if (input.serv.xDescServ.length > 2000) throw new Error("xDescServ excede 2000 caracteres");

  const prest = input.prest;
  const prestXml =
    (prest.cnpj ? el("CNPJ", prest.cnpj) : el("CPF", prest.cpf)) +
    el("IM", prest.im) +
    el("xNome", prest.xNome) +
    el("fone", prest.fone) +
    el("email", prest.email) +
    el("regTrib", {
      opSimpNac: prest.regTrib.opSimpNac,
      regApTribSN: prest.regTrib.regApTribSN,
      regEspTrib: prest.regTrib.regEspTrib,
    });

  const servXml =
    el("locPrest", {
      cLocPrestacao: input.serv.cLocPrestacao,
      cPaisPrestacao: input.serv.cPaisPrestacao,
    }) +
    el("cServ", {
      cTribNac: input.serv.cTribNac,
      cTribMun: input.serv.cTribMun,
      xDescServ: input.serv.xDescServ,
      cNBS: input.serv.cNBS,
      cIntContrib: undefined,
    }) +
    (input.serv.infoCompl ? el("infoCompl", input.serv.infoCompl) : "");

  const infDps =
    el("tpAmb", input.tpAmb) +
    el("dhEmi", input.dhEmi ?? nowIso()) +
    el("verAplic", input.verAplic) +
    el("serie", input.serie) +
    el("nDPS", input.nDPS) +
    el("dCompet", input.dCompet) +
    el("tpEmit", input.tpEmit) +
    el("cLocEmi", input.cLocEmi) +
    (input.subst ? el("subst", { chSubstda: input.subst.chSubstda, cMotivo: input.subst.cMotivo, xMotivo: input.subst.xMotivo }) : "") +
    `<prest>${prestXml}</prest>` +
    (input.toma ? `<toma>${pessoa(input.toma)}</toma>` : "") +
    (input.interm ? `<interm>${pessoa(input.interm)}</interm>` : "") +
    `<serv>${servXml}</serv>` +
    `<valores>${valores(input.valores)}</valores>` +
    (input.ibscbsXml ?? "");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="${NFSE_NS}" versao="${LEIAUTE_VERSAO}">` +
    `<infDPS Id="DPS${esc(idDps)}">${infDps}</infDPS>` +
    `</DPS>`;

  return { idDps, xml };
}
