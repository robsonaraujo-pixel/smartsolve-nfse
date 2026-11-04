import crypto from "node:crypto";
/** ID curto, ordenável no tempo (base36 de ms + aleatório). */
export function createId(): string {
  return Date.now().toString(36) + crypto.randomBytes(6).toString("hex");
}
