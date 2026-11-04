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

export async function certificadoDaEmpresa(empresaId: string): Promise<CertificadoA1> {
  const hit = cache.get(empresaId);
  if (hit && Date.now() - hit.em < 10 * 60_000) return hit.cert;
  const row = await db.query.certificados.findFirst({ where: eq(schema.certificados.empresaId, empresaId) });
  if (!row) throw erro(422, "Empresa sem certificado digital cadastrado");
  if (row.validoAte < new Date()) throw erro(422, `Certificado vencido em ${row.validoAte.toISOString().slice(0, 10)}`);
  const pfx = decifrar(Buffer.from(row.pfxCifrado), Buffer.from(row.iv));
  const sc = Buffer.from(row.senhaCifrada);
  const senha = decifrar(sc.subarray(12), sc.subarray(0, 12)).toString("utf8");
  const cert = carregarPfx(pfx, senha);
  cache.set(empresaId, { cert, em: Date.now() });
  return cert;
}
