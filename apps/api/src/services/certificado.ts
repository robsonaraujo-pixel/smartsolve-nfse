import { carregarPfx, type CertificadoA1 } from "@smartsolve/nfse-core";
import { eq } from "drizzle-orm";
import { db, schema, erro } from "./db.js";
import { cifrar, decifrar } from "./cripto.js";

export async function salvarCertificado(empresaId: string, pfx: Buffer, senha: string) {
  const cert = carregarPfx(pfx, senha); // valida o PFX antes de guardar
  const p = cifrar(pfx);
  const s = cifrar(Buffer.from(senha, "utf8"));
  const senhaCifrada = Buffer.concat([s.iv, s.cifrado]);
  const row = { empresaId, pfxCifrado: p.cifrado, iv: p.iv, senhaCifrada, subject: cert.subject, validoAte: cert.validoAte };
  await db
    .insert(schema.certificados)
    .values(row)
    .onConflictDoUpdate({ target: schema.certificados.empresaId, set: { pfxCifrado: row.pfxCifrado, iv: row.iv, senhaCifrada, subject: row.subject, validoAte: row.validoAte } });
  cache.delete(empresaId);
  return { subject: cert.subject, validoAte: cert.validoAte, cnpjOuCpf: cert.cnpjOuCpf };
}

const cache = new Map<string, { cert: CertificadoA1; em: number }>();

function abrir(row: { pfxCifrado: Buffer | Uint8Array; iv: Buffer | Uint8Array; senhaCifrada: Buffer | Uint8Array; validoAte: Date }, rotulo: string): CertificadoA1 {
  if (row.validoAte < new Date()) throw erro(422, `${rotulo} vencido em ${row.validoAte.toISOString().slice(0, 10)}`);
  const pfx = decifrar(Buffer.from(row.pfxCifrado), Buffer.from(row.iv));
  const sc = Buffer.from(row.senhaCifrada);
  const senha = decifrar(sc.subarray(12), sc.subarray(0, 12)).toString("utf8");
  return carregarPfx(pfx, senha);
}

export async function salvarCertificadoEscritorio(pfx: Buffer, senha: string) {
  const cert = carregarPfx(pfx, senha);
  const p = cifrar(pfx);
  const s = cifrar(Buffer.from(senha, "utf8"));
  const row = { id: "escritorio", pfxCifrado: p.cifrado, iv: p.iv, senhaCifrada: Buffer.concat([s.iv, s.cifrado]), subject: cert.subject, cnpj: cert.cnpjOuCpf, validoAte: cert.validoAte };
  await db.insert(schema.certificadoEscritorio).values(row).onConflictDoUpdate({ target: schema.certificadoEscritorio.id, set: { pfxCifrado: row.pfxCifrado, iv: row.iv, senhaCifrada: row.senhaCifrada, subject: row.subject, cnpj: row.cnpj, validoAte: row.validoAte } });
  cache.clear();
  return { subject: cert.subject, validoAte: cert.validoAte, cnpjOuCpf: cert.cnpjOuCpf };
}

export async function certificadoEscritorio(): Promise<CertificadoA1> {
  const hit = cache.get("__escritorio");
  if (hit && Date.now() - hit.em < 10 * 60_000) return hit.cert;
  const row = await db.query.certificadoEscritorio.findFirst();
  if (!row) throw erro(422, "Certificado do escritório não cadastrado em Empresas / Acessos");
  const cert = abrir(row, "Certificado do escritório");
  cache.set("__escritorio", { cert, em: Date.now() });
  return cert;
}

/** Resolve o certificado a usar na API conforme o modo de acesso da empresa. */
export async function certificadoDaEmpresa(empresaId: string): Promise<CertificadoA1> {
  const emp = await db.query.empresas.findFirst({ where: eq(schema.empresas.id, empresaId), columns: { modoAcesso: true, procuracaoValidaAte: true, razaoSocial: true } });
  if (!emp) throw erro(404, "Empresa não encontrada");
  if (emp.modoAcesso === "PORTAL_SENHA") {
    throw erro(422, "Esta empresa está configurada para acesso por usuário e senha do portal. A transmissão pela API exige certificado digital (próprio ou do escritório por procuração); use o Emissor Web ou altere o modo de acesso em Empresas / Acessos.");
  }
  if (emp.modoAcesso === "CERT_ESCRITORIO") {
    if (emp.procuracaoValidaAte && emp.procuracaoValidaAte < new Date()) throw erro(422, `Procuração da empresa ${emp.razaoSocial} vencida em ${emp.procuracaoValidaAte.toISOString().slice(0, 10)}`);
    return certificadoEscritorio();
  }
  const hit = cache.get(empresaId);
  if (hit && Date.now() - hit.em < 10 * 60_000) return hit.cert;
  const row = await db.query.certificados.findFirst({ where: eq(schema.certificados.empresaId, empresaId) });
  if (!row) throw erro(422, "Empresa sem certificado digital próprio cadastrado");
  const cert = abrir(row, "Certificado da empresa");
  cache.set(empresaId, { cert, em: Date.now() });
  return cert;
}
