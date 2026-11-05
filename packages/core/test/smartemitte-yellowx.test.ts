import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDps, type DpsInput } from "../src/index.js";

/**
 * Cenário operacional de homologação SmartEmitte:
 * YellowX (prestador) -> SmartSolve (tomador), palestra em São Paulo,
 * competência 04/11/2026, R$ 1,00, Simples Nacional e ISS não retido.
 *
 * Fixture de regressão local. Não contém certificado, não assina e não transmite.
 * Os códigos CTN/NBS são os candidatos definidos para este cenário e ainda
 * dependem da confirmação dos parâmetros oficiais do prestador/município.
 */
const entrada: DpsInput = {
  tpAmb: 2,
  dhEmi: "2026-11-04T13:12:00-03:00",
  verAplic: "SmartEmitte-homologacao",
  serie: "1",
  nDPS: 1,
  dCompet: "2026-11-04",
  tpEmit: 1,
  cLocEmi: "3550308",
  prest: {
    cnpj: "56153537000146",
    im: "14448890",
    regTrib: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
  },
  toma: {
    cnpj: "22489717000181",
    xNome: "SMARTSOLVE AUDITORIA E CONSULTORIA CONTABIL LTDA.",
    email: "contato@smartsolve.com.br",
    fone: "1140841022",
    end: {
      endNac: {
        cMun: "3550308",
        CEP: "04757025",
        xLgr: "AV DAS NACOES UNIDAS",
        nro: "18801",
        xCpl: "CONJ 407 ANDAR 4",
        xBairro: "JARDIM DOM BOSCO",
      },
    },
  },
  serv: {
    cLocPrestacao: "3550308",
    cTribNac: "172401",
    cNBS: "122051400",
    xDescServ: "Capacitação e treinamento profissional",
  },
  valores: {
    vServ: 1,
    trib: {
      tribMun: { tribISSQN: 1, tpRetISSQN: 1 },
      totTrib: { indTotTrib: 0 },
    },
  },
  // Simples Nacional, competência em 2026: não incluir grupo IBSCBS
};

test("SmartEmitte: monta DPS YellowX → SmartSolve em homologação sem destaque IBS/CBS", () => {
  const { idDps, xml } = buildDps(entrada);

  assert.equal(idDps.length, 42);
  assert.match(xml, /<tpAmb>2<\/tpAmb>/);
  assert.match(xml, /<dCompet>2026-11-04<\/dCompet>/);
  assert.match(xml, /<CNPJ>56153537000146<\/CNPJ>/);
  assert.match(xml, /<IM>14448890<\/IM>/);
  assert.match(xml, /<opSimpNac>3<\/opSimpNac>/);
  assert.match(xml, /<CNPJ>22489717000181<\/CNPJ>/);
  assert.match(xml, /<cMun>3550308<\/cMun><CEP>04757025<\/CEP>/);
  assert.match(xml, /<xLgr>AV DAS NACOES UNIDAS<\/xLgr>/);
  assert.match(xml, /<nro>18801<\/nro>/);
  assert.match(xml, /<xCpl>CONJ 407 ANDAR 4<\/xCpl>/);
  assert.match(xml, /<xBairro>JARDIM DOM BOSCO<\/xBairro>/);
  assert.match(xml, /<cTribNac>172401<\/cTribNac>/);
  assert.match(xml, /<cNBS>122051400<\/cNBS>/);
  assert.match(xml, /<vServ>1\.00<\/vServ>/);
  assert.match(xml, /<tpRetISSQN>1<\/tpRetISSQN>/);
  assert.match(xml, /<indTotTrib>0<\/indTotTrib>/);
  assert.doesNotMatch(xml, /IBSCBS|<IBSCBS>/);
  assert.doesNotMatch(xml, /<Signature/);
});
