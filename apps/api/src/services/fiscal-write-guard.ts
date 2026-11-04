/**
 * SmartEmitte: bloqueio central de ações fiscais externas.
 * Fail-closed: a ausência da variável NÃO libera transmissão.
 * Alterar configuração exige novo processo de aprovação e revisão de segurança.
 */
export type FiscalWriteOperation = "TRANSMIT_NFSE" | "CANCEL_NFSE";
export function assertFiscalWriteEnabled(operation: FiscalWriteOperation): void {
  if (process.env.SMARTEMITTE_FISCAL_WRITES_ENABLED !== "true") {
    const err = new Error(`SmartEmitte homologação: ${operation} bloqueada. Apenas rascunhos e consultas são permitidos.`) as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
}
