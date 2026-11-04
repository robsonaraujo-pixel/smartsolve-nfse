import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDps,
  buildIdDps,
  parseIdDps,
  carregarPfx,
  assinarXml,
  verificarAssinatura,
  gzipBase64,
  gunzipBase64,
  buildPedidoCancelamento,
  extrairResumoNfse,
  type DpsInput,
} from "../src/index.js";

function certTeste() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nfse-cert-"));
  const key = path.join(dir, "key.pem"), crt = path.join(dir, "cert.pem"), pfx = path.join(dir, "cert.pfx");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "2",
    "-subj", "/CN=SMARTSOLVE TESTE LTDA:12345678000195/O=ICP-Brasil/C=BR"], { stdio: "ignore" });
  execFileSync("openssl", ["pkcs12", "-export", "-inkey", key, "-in", crt, "-out", pfx, "-passout", "pass:1234"], { stdio: "ignore" });
  return carregarPfx(fs.readFileSync(pfx), "1234");
}

const entrada: DpsInput = {
  tpAmb: 2,
  verAplic: "SmartSolveNFSe 0.1.0",
  serie: "1",
  nDPS: 7,
  dCompet: "2026-11-03",
  tpEmit: 1,
  cLocEmi: "3550308",
  prest: {
    cnpj: "12345678000195",
    im: "12345",
    regTrib: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
  },
  toma: {
    cnpj: "98765432000100",
    xNome: "Cliente Exemplo Ltda",
    email: "fiscal@cliente.com.br",
    end: { endNac: { cMun: "3550308", CEP: "01001000", xLgr: "Praça da Sé", nro: "1", xBairro: "Sé" } },
  },
  serv: {
    cLocPrestacao: "3550308",
    cTribNac: "170201", // 17.02 ou conforme o item autorizado do cliente
    cNBS: "114019000",
    xDescServ: "Serviços contábeis - honorários competência 11/2026",
  },
  valores: {
    vServ: 1500,
    trib: {
      tribMun: { tribISSQN: 1, tpRetISSQN: 1 },
      tribFed: { piscofins: { CST: "00" } },
      totTrib: { pTotTribSN: 6 },
    },
  },
};

test("identificador da DPS tem 42 posições e é reversível", () => {
  const id = buildIdDps({ cLocEmi: "3550308", cnpj: "12345678000195", serie: "1", nDPS: 7 });
  assert.equal(id, "3550308" + "1" + "12345678000195" + "00001" + "000000000000007");
  assert.equal(id.length, 42);
  const p = parseIdDps("DPS" + id);
  assert.equal(p.nDPS, 7);
  assert.equal(p.cnpj, "12345678000195");
  const cpf = buildIdDps({ cLocEmi: "3550308", cpf: "12345678901", serie: "1", nDPS: 1 });
  assert.equal(cpf.slice(7, 22), "2" + "00012345678901");
});

test("monta XML da DPS com namespace, versão 1.01 e sequência de grupos", () => {
  const { idDps, xml } = buildDps(entrada);
  assert.match(xml, /<DPS xmlns="http:\/\/www.sped.fazenda.gov.br\/nfse" versao="1.01">/);
  assert.match(xml, new RegExp(`<infDPS Id="DPS${idDps}">`));
  const ordem = ["<tpAmb>", "<dhEmi>", "<verAplic>", "<serie>", "<nDPS>", "<dCompet>", "<tpEmit>", "<cLocEmi>", "<prest>", "<toma>", "<serv>", "<valores>"];
  let pos = -1;
  for (const t of ordem) {
    const i = xml.indexOf(t);
    assert.ok(i > pos, `ordem errada em ${t}`);
    pos = i;
  }
  assert.match(xml, /<regTrib><opSimpNac>3<\/opSimpNac><regApTribSN>1<\/regApTribSN><regEspTrib>0<\/regEspTrib><\/regTrib>/);
  assert.match(xml, /<vServ>1500.00<\/vServ>/);
  assert.match(xml, /<pTotTribSN>6.00<\/pTotTribSN>/);
  assert.match(xml, /<endNac><cMun>3550308<\/cMun><CEP>01001000<\/CEP><\/endNac><xLgr>Praça da Sé<\/xLgr>/);
});

test("assina a DPS (enveloped, SHA-256) e a assinatura confere", () => {
  const cert = certTeste();
  assert.equal(cert.cnpjOuCpf, "12345678000195");
  const { xml } = buildDps(entrada);
  const assinado = assinarXml(xml, cert, "infDPS");
  assert.match(assinado, /<Signature xmlns="http:\/\/www.w3.org\/2000\/09\/xmldsig#">/);
  assert.match(assinado, /rsa-sha256/);
  assert.match(assinado, /xmlenc#sha256/);
  assert.match(assinado, /<Reference URI="#DPS/);
  assert.match(assinado, /<X509Certificate>/);
  // Signature deve ser o último filho de <DPS>
  assert.match(assinado, /<\/Signature><\/DPS>$/);
  assert.deepEqual(verificarAssinatura(assinado), { valida: true });
  // qualquer alteração invalida
  const adulterado = assinado.replace("<vServ>1500.00</vServ>", "<vServ>1.00</vServ>");
  assert.equal(verificarAssinatura(adulterado).valida, false);
});

test("payload gzip/base64 é reversível", () => {
  const { xml } = buildDps(entrada);
  assert.equal(gunzipBase64(gzipBase64(xml)), xml);
});

test("pedido de cancelamento e101101 assina sobre infPedReg", () => {
  const cert = certTeste();
  const chave = "3".repeat(50);
  const { id, xml } = buildPedidoCancelamento({ tpAmb: 2, verAplic: "x", chaveAcesso: chave, cnpjAutor: "12345678000195", cMotivo: 1, xMotivo: "erro" });
  assert.equal(id, `PRE${chave}101101001`);
  const assinado = assinarXml(xml, cert, "infPedReg");
  assert.equal(verificarAssinatura(assinado).valida, true);
});

test("extrai resumo de um XML de NFS-e", () => {
  const { xml } = buildDps(entrada);
  const dpsSemDecl = xml.replace(/^<\?xml[^>]*\?>/, "");
  const chave = "35503081234567800019500000000000012026110300000017";
  const nfse = `<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${chave}"><nNFSe>17</nNFSe><cLocIncid>3550308</cLocIncid><dhProc>2026-11-03T10:00:00-03:00</dhProc><emit><CNPJ>12345678000195</CNPJ><xNome>SmartSolve</xNome></emit><valores><vLiq>1500.00</vLiq><vISSQN>0.00</vISSQN></valores>${dpsSemDecl}</infNFSe></NFSe>`;
  const r = extrairResumoNfse(nfse);
  assert.equal(r.chaveAcesso, chave);
  assert.equal(r.nNFSe, "17");
  assert.equal(r.tomador?.cnpj, "98765432000100");
  assert.equal(r.vServ, 1500);
  assert.equal(r.vLiq, 1500);
  assert.equal(r.cTribNac, "170201");
});
