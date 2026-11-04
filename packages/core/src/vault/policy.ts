/**
 * SmartVault — decisão de autorização independente de armazenamento e rede.
 * Não armazena nem retorna certificados, senhas, PFX ou chaves privadas.
 * A comprovação de poderes deve vir de uma fonte confiável do backend.
 */
export type VaultOperation = "MTLS" | "SIGN_DPS" | "SIGN_EVENT";
export type VaultActor = "HUMAN" | "AGENT";
export interface VaultRequest {
  actorId: string;
  actorType: VaultActor;
  ownerId?: string;
  operation: VaultOperation;
  officeCnpj: string;
  issuerCnpj: string;
  certificateCnpj: string;
  certificateValidUntil: string;
  delegation?: {
    officeCnpj: string;
    issuerCnpj: string;
    validFrom: string;
    validUntil: string;
    status: "VERIFIED" | "PENDING" | "REVOKED";
    operations: VaultOperation[];
  };
  approvedByHumanId?: string;
  authorizationVerifiedAt?: string;
  now: string;
}
export type VaultDecision = { allowed: true; reason: "AUTHORIZED" } |
  { allowed: false; reason: "INVALID_IDENTITY" | "CERT_EXPIRED" | "DELEGATION_MISSING" | "DELEGATION_UNVERIFIED" | "DELEGATION_EXPIRED" | "OPERATION_NOT_DELEGATED" | "HUMAN_APPROVAL_REQUIRED" };
const cnpj = (s: string) => s.replace(/[^0-9]/g, "");
const valid = (s: string) => cnpj(s).length === 14;
export function authorizeVaultUse(r: VaultRequest): VaultDecision {
  const office = cnpj(r.officeCnpj), issuer = cnpj(r.issuerCnpj), cert = cnpj(r.certificateCnpj);
  if (!r.actorId || !valid(office) || !valid(issuer) || !valid(cert) || cert !== office) {
    return { allowed: false, reason: "INVALID_IDENTITY" };
  }
  const now = Date.parse(r.now);
  if (!Number.isFinite(now) || !Number.isFinite(Date.parse(r.certificateValidUntil)) || Date.parse(r.certificateValidUntil) <= now) {
    return { allowed: false, reason: "CERT_EXPIRED" };
  }
  if (office !== issuer) {
    const d = r.delegation;
    if (!d) return { allowed: false, reason: "DELEGATION_MISSING" };
    if (d.status !== "VERIFIED" || cnpj(d.officeCnpj) !== office || cnpj(d.issuerCnpj) !== issuer) {
      return { allowed: false, reason: "DELEGATION_UNVERIFIED" };
    }
    if (!Number.isFinite(Date.parse(d.validFrom)) || !Number.isFinite(Date.parse(d.validUntil)) ||
      Date.parse(d.validFrom) > now || Date.parse(d.validUntil) <= now) {
      return { allowed: false, reason: "DELEGATION_EXPIRED" };
    }
    if (!d.operations.includes(r.operation)) return { allowed: false, reason: "OPERATION_NOT_DELEGATED" };
  }
  // Um agente não herda poderes do proprietário humano. Assinatura exige aprovação específica.
  if (r.actorType === "AGENT" && r.operation !== "MTLS" && !r.approvedByHumanId) {
    return { allowed: false, reason: "HUMAN_APPROVAL_REQUIRED" };
  }
  return { allowed: true, reason: "AUTHORIZED" };
}
