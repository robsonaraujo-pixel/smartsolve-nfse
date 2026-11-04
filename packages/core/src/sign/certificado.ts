import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export interface CertificadoA1 {
  /** PEM da chave privada (PKCS#8) */
  privateKeyPem: string;
  /** PEM do certificado X.509 do titular */
  certPem: string;
  /** Cadeia (quando presente no PFX), PEM concatenado */
  chainPem?: string;
  /** Buffer original do PFX e senha — usados no mTLS */
  pfx: Buffer;
  passphrase: string;
  subject: string;
  cnpjOuCpf?: string;
  validoAte: Date;
}

/**
 * Carrega um certificado A1 (.pfx/.p12). Usa só APIs nativas do Node (>=20):
 * o PFX é passado direto ao TLS; a chave/cert em PEM são extraídos via X509Certificate
 * quando disponível, e caímos em `openssl` só se o Node não expuser a chave privada.
 */
export function carregarPfx(pfx: Buffer, passphrase: string): CertificadoA1 {
  // Node não tem parser PKCS#12 público; usamos o openssl do sistema (presente em qualquer Linux/macOS/Windows com Git).
  const run = (args: string[]) =>
    execFileSync("openssl", args, { input: pfx, env: { ...process.env, PW: passphrase } }).toString("utf8");
  const common = ["pkcs12", "-passin", "env:PW", "-legacy"];

  let privateKeyPem: string;
  let certPem: string;
  let chainPem: string | undefined;
  try {
    privateKeyPem = run([...common, "-nocerts", "-nodes"]);
    certPem = run([...common, "-clcerts", "-nokeys"]);
    chainPem = run([...common, "-cacerts", "-nokeys"]);
  } catch {
    // openssl 3 sem provider legacy: tenta sem -legacy
    const c2 = common.filter((a) => a !== "-legacy");
    privateKeyPem = run([...c2, "-nocerts", "-nodes"]);
    certPem = run([...c2, "-clcerts", "-nokeys"]);
    chainPem = run([...c2, "-cacerts", "-nokeys"]);
  }
  privateKeyPem = extractPem(privateKeyPem, "PRIVATE KEY");
  certPem = extractPem(certPem, "CERTIFICATE");
  chainPem = chainPem && chainPem.includes("BEGIN CERTIFICATE") ? chainPem : undefined;

  const x509 = new crypto.X509Certificate(certPem);
  return {
    privateKeyPem,
    certPem,
    chainPem,
    pfx,
    passphrase,
    subject: x509.subject,
    cnpjOuCpf: extrairDocumentoIcpBrasil(x509),
    validoAte: new Date(x509.validTo),
  };
}

function extractPem(text: string, label: string): string {
  const re = new RegExp(`-----BEGIN (?:[A-Z ]*)?${label}-----[\\s\\S]*?-----END (?:[A-Z ]*)?${label}-----`);
  const m = text.match(re);
  if (!m) throw new Error(`Não encontrei bloco PEM ${label} no PFX`);
  return m[0] + "\n";
}

/** Em certificados ICP-Brasil o CNPJ/CPF fica em OIDs do SAN (2.16.76.1.3.3 CNPJ, 2.16.76.1.3.1 CPF). Extraímos pelo CN "NOME:CNPJ" como aproximação. */
function extrairDocumentoIcpBrasil(x509: crypto.X509Certificate): string | undefined {
  const cn = /CN=([^\n,]+)/.exec(x509.subject)?.[1];
  const m = cn?.match(/:(\d{11}|\d{14})\s*$/);
  return m?.[1];
}

/** PEM do certificado sem cabeçalhos e quebras (formato do X509Certificate no KeyInfo) */
export function certBase64(certPem: string): string {
  return certPem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
}
