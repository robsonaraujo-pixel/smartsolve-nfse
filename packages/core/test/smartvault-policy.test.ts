import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeVaultUse, type VaultRequest } from "../src/vault/policy.js";

const base: VaultRequest = {
  actorId: "operador-1", actorType: "HUMAN", operation: "SIGN_DPS",
  officeCnpj: "22489717000181", issuerCnpj: "56153537000146",
  certificateCnpj: "22489717000181", certificateValidUntil: "2027-04-14T23:59:59-03:00",
  now: "2026-11-04T13:12:00-03:00",
  delegation: {
    officeCnpj: "22489717000181", issuerCnpj: "56153537000146",
    validFrom: "2026-01-01T00:00:00-03:00", validUntil: "2026-12-31T23:59:59-03:00",
    status: "VERIFIED", operations: ["MTLS", "SIGN_DPS"],
  },
};
test("YellowX por procuração verificada permite assinatura no cenário simulado", () => {
  assert.deepEqual(authorizeVaultUse(base), { allowed: true, reason: "AUTHORIZED" });
});
test("procuração ausente bloqueia", () => {
  assert.equal(authorizeVaultUse({ ...base, delegation: undefined }).reason, "DELEGATION_MISSING");
});
test("procuração pendente ou revogada bloqueia", () => {
  for (const status of ["PENDING", "REVOKED"] as const) {
    assert.equal(authorizeVaultUse({ ...base, delegation: { ...base.delegation!, status } }).reason, "DELEGATION_UNVERIFIED");
  }
});
test("procuração vencida bloqueia", () => {
  assert.equal(authorizeVaultUse({ ...base, delegation: { ...base.delegation!, validUntil: "2026-10-01" } }).reason, "DELEGATION_EXPIRED");
});
test("poder não delegado bloqueia", () => {
  assert.equal(authorizeVaultUse({ ...base, operation: "SIGN_EVENT" }).reason, "OPERATION_NOT_DELEGATED");
});
test("certificado errado ou vencido bloqueia", () => {
  assert.equal(authorizeVaultUse({ ...base, certificateCnpj: "56153537000146" }).reason, "INVALID_IDENTITY");
  assert.equal(authorizeVaultUse({ ...base, certificateValidUntil: "2026-01-01" }).reason, "CERT_EXPIRED");
});
test("agente não assina sem aprovação humana", () => {
  assert.equal(authorizeVaultUse({ ...base, actorId: "yellowdot", actorType: "AGENT", ownerId: "robson" }).reason, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(authorizeVaultUse({ ...base, actorId: "yellowdot", actorType: "AGENT", ownerId: "robson", approvedByHumanId: "robson" }).reason, "AUTHORIZED");
});

test("agente sem proprietário vinculado é bloqueado inclusive para mTLS", () => {
  assert.equal(authorizeVaultUse({ ...base, actorId: "yellowdot", actorType: "AGENT", ownerId: undefined, operation: "MTLS" }).reason, "OWNER_MISMATCH");
});
test("aprovação de humano diferente do proprietário não autoriza agente", () => {
  assert.equal(authorizeVaultUse({ ...base, actorId: "yellowdot", actorType: "AGENT", ownerId: "robson", approvedByHumanId: "outro" }).reason, "OWNER_MISMATCH");
});
