import crypto from "node:crypto";

/** Chave de 32 bytes derivada de APP_ENCRYPTION_KEY (qualquer string); use um segredo forte em produção. */
function chave(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k) throw new Error("APP_ENCRYPTION_KEY não definida");
  return crypto.createHash("sha256").update(k).digest();
}

export function cifrar(dados: Buffer): { cifrado: Buffer; iv: Buffer } {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(dados), c.final()]);
  const tag = c.getAuthTag();
  return { cifrado: Buffer.concat([enc, tag]), iv };
}

export function decifrar(cifrado: Buffer, iv: Buffer): Buffer {
  const tag = cifrado.subarray(cifrado.length - 16);
  const enc = cifrado.subarray(0, cifrado.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]);
}
